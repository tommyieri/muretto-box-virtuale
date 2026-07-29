"""gen_classifica_giro.py — GENERATORE COMMITTATO di data/classifica_giro_2026.csv.

CHIUDE UN DEBITO: il CSV esisteva senza nessuno script che lo scrivesse (fonte orfana,
la classe di stint_gold / long_run_fp / warm-in). Era fermo a 7 gare e non si estendeva:
alla gara nuova nessuno lo aggiornava perche' nessuno sapeva come era stato fatto.

COS'E' IL FILE: il giro-per-giro di gara 2026 in forma tabellare — una riga per
(gara, pilota, giro), presa dal grezzo TracingInsights cosi' com'e'. NON e' un modello:
non c'e' nessuna stima qui dentro, solo una proiezione colonnare del Race.json piu' UNA
grandezza derivata, il gap dal leader.

MAPPATURA (verificata cella per cella sulle 7 gare gia' presenti nel CSV):
  giro       <- lap          pilota <- drv        team <- team
  pos        <- pos          (vuoto se il feed non la da': auto ferma / ritirata)
  compound   <- compound     stint  <- stint      life <- life
  pit        <- (pin != None) OR (pout != None)   -> il giro tocca la pit lane
  tempo_giro <- time         (vuoto se il feed non lo da')
  sesT       <- sesT         status <- status     (codici: v. data/status_vocabolario.csv)
  gap_leader <- sesT - min(sesT dello stesso giro), arrotondato a 3 decimali
               (il leader del giro e' l'auto che ha tagliato quel giro per prima)

PERIMETRO DERIVATO dal registro (data/gare_registro.json): ogni gara pubblicata entra da
sola, nessuna lista cablata. L'ordine delle gare e' quello del registro (cronologico);
dentro una gara l'ordine delle righe e' quello del grezzo, invariato.

GUARDIA (non negoziabile): prima di scrivere, ogni cella gia' presente nel CSV deve essere
riprodotta IDENTICA. Se una gara del CSV sparisce dal registro, o se anche una sola cella
cambia, il generatore SI FERMA e stampa le differenze: non sovrascrive. Il file vecchio
resta finche' un umano non ha capito perche' il grezzo e' cambiato.

UNICA EQUIVALENZA DICHIARATA (ASSENTE): il file orfano scriveva il valore mancante in due
modi diversi per la stessa cosa — vuoto in `pos` e `tempo_giro` (21 e 32 celle), la stringa
letterale 'None' in `life` (21 celle, tutte e sole le celle in cui il feed non da' il dato).
Il generatore uniforma a VUOTO, e la guardia considera '' e 'None' equivalenti SOLO come
marcatori di assenza. Nessun'altra equivalenza e' ammessa: qualsiasi altra differenza ferma
la scrittura. (Verificato: nel CSV congelato la stringa 'None' compare solo in `life`.)

Uso:
  python3 gen_classifica_giro.py           # CHECK: rigenera, confronta, NON scrive
  python3 gen_classifica_giro.py --write   # scrive solo se la guardia passa
"""
import csv
import json
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
REGISTRO = os.path.join(ROOT, 'data', 'gare_registro.json')
CSV_PATH = os.path.join(ROOT, 'data', 'classifica_giro_2026.csv')
COLS = ['gara', 'giro', 'pilota', 'team', 'pos', 'compound', 'stint', 'life',
        'pit', 'tempo_giro', 'sesT', 'gap_leader', 'status']
CHIAVE = ('gara', 'pilota', 'giro')   # identifica la riga per il confronto
ASSENTE = {'', 'None'}                # v. "UNICA EQUIVALENZA DICHIARATA" in testa al file


def cella(v):
    """Formattazione canonica di una cella: il 'None' del feed diventa vuoto."""
    if v is None or v == 'None':
        return ''
    if isinstance(v, bool):
        return str(v)
    return str(v)


def leggi_registro():
    return json.load(open(REGISTRO, encoding='utf-8'))


def gare_nel_csv(path=CSV_PATH):
    """Le gare gia' congelate nel CSV, nell'ordine in cui compaiono."""
    if not os.path.exists(path):
        return []
    viste = []
    for r in csv.DictReader(open(path, encoding='utf-8')):
        if r['gara'] not in viste:
            viste.append(r['gara'])
    return viste


def perimetro():
    """Le gare da scrivere, DERIVATE dal registro, con guardia contro la deriva.

    Il perimetro derivato deve CONTENERE tutte le gare gia' nel CSV: se una sparisce
    (rinominata a monte, tolta dal registro) il generatore si ferma invece di riscrivere
    il file su una base diversa in silenzio."""
    reg = leggi_registro()
    fuori = {}
    for nome, v in reg.items():
        raw = os.path.join(ROOT, v['raw'])
        if not os.path.exists(raw):
            print(f"[classifica_giro] salto '{nome}': grezzo assente ({v['raw']})")
            continue
        fuori[nome] = raw
    for nome in gare_nel_csv():
        if nome not in fuori:
            raise RuntimeError(
                f"deriva del perimetro: '{nome}' e' nel CSV congelato ma non e' "
                f"derivabile dal registro (grezzo assente o gara rimossa) -> "
                f"il CSV cambierebbe base, non scrivo")
    return fuori


def righe_gara(nome, raw_path):
    """Proiezione colonnare di un Race.json TracingInsights, ordine del grezzo."""
    d = json.load(open(raw_path, encoding='utf-8'))
    n = len(d['lap'])
    # leader del giro = sesT minimo fra le auto che hanno chiuso quel giro
    lead = {}
    for i in range(n):
        g, t = d['lap'][i], d['sesT'][i]
        if t is None or t == 'None':
            continue
        if g not in lead or t < lead[g]:
            lead[g] = t
    out = []
    for i in range(n):
        t = d['sesT'][i]
        gap = '' if (t is None or t == 'None' or d['lap'][i] not in lead) \
            else cella(round(t - lead[d['lap'][i]], 3))
        pit = (d['pin'][i] not in (None, 'None')) or (d['pout'][i] not in (None, 'None'))
        pos = d['pos'][i]
        out.append({
            'gara': nome,
            'giro': cella(d['lap'][i]),
            'pilota': cella(d['drv'][i]),
            'team': cella(d['team'][i]),
            'pos': '' if pos in (None, 'None') else cella(float(pos)),
            'compound': cella(d['compound'][i]),
            'stint': cella(d['stint'][i]),
            'life': cella(d['life'][i]),
            'pit': str(bool(pit)),
            'tempo_giro': cella(d['time'][i]),
            'sesT': cella(t),
            'gap_leader': gap,
            'status': cella(d['status'][i]),
        })
    return out


def rigenera():
    out = []
    for nome, raw in perimetro().items():
        out.extend(righe_gara(nome, raw))
    return out


def confronta(nuove, path=CSV_PATH):
    """Ogni cella gia' nel CSV dev'essere riprodotta identica. Ritorna la lista dei
    disaccordi (vuota = guardia passata)."""
    if not os.path.exists(path):
        return []
    vecchie = {tuple(r[k] for k in CHIAVE): r
               for r in csv.DictReader(open(path, encoding='utf-8'))}
    nuove_idx = {tuple(r[k] for k in CHIAVE): r for r in nuove}
    diffs = []
    for k, vecchia in vecchie.items():
        nuova = nuove_idx.get(k)
        if nuova is None:
            diffs.append((k, 'RIGA', 'presente', 'assente'))
            continue
        for c in COLS:
            a, b = vecchia.get(c, ''), nuova[c]
            if a == b or (a in ASSENTE and b in ASSENTE):
                continue
            diffs.append((k, c, a, b))
    return diffs


def scrivi(righe, path=CSV_PATH):
    with open(path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        w.writeheader()
        w.writerows(righe)


def main(argv):
    write = '--write' in argv
    nuove = rigenera()
    gare = []
    for r in nuove:
        if r['gara'] not in gare:
            gare.append(r['gara'])
    diffs = confronta(nuove)
    print(f"[classifica_giro] rigenerate {len(nuove)} righe su {len(gare)} gare: "
          f"{', '.join(gare)}")
    vecchie_gare = gare_nel_csv()
    print(f"[classifica_giro] il CSV attuale copriva {len(vecchie_gare)} gare: "
          f"{', '.join(vecchie_gare) or '(file assente)'}")
    if diffs:
        print(f"[classifica_giro] GUARDIA FALLITA: {len(diffs)} celle gia' congelate NON "
              f"sono riprodotte. NON scrivo.")
        for k, c, vecchio, nuovo in diffs[:20]:
            print(f"    {k} {c}: CSV={vecchio!r} rigenerato={nuovo!r}")
        if len(diffs) > 20:
            print(f"    ... e altre {len(diffs)-20}")
        return 1
    print("[classifica_giro] guardia OK: tutte le celle gia' presenti sono riprodotte "
          "identiche.")
    if write:
        scrivi(nuove)
        print(f"[classifica_giro] scritto {os.path.relpath(CSV_PATH, ROOT)} "
              f"({len(nuove)} righe, {len(gare)} gare).")
    else:
        print("[classifica_giro] CHECK: nessuna scrittura (usa --write).")
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
