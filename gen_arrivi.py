"""gen_arrivi.py — GENERATORE COMMITTATO di data/arrivi_2026.csv.

CHIUDE UN DEBITO: il CSV esisteva senza nessuno script che lo scrivesse (fonte orfana —
verifica_rc2.py lo chiama 'orfano' in faccia, riga 150). Era fermo a 7 gare e non si
estendeva. Ora si ricostruisce dal grezzo, si auto-verifica e cresce da solo.

COS'E' IL FILE: una riga per (gara, pilota) con come e' finita la gara. NON e' la
classifica ufficiale FIA: e' la classifica DEI DATI DI PISTA (TracingInsights), ed e'
esattamente questo il motivo per cui verifica_rc2.py la tiene come confronto di
trasparenza e NON come arbitro. L'arbitro resta FastF1 results (v. REPORT_RACE_CONTROL.md).

MAPPATURA (verificata cella per cella sulle 7 gare gia' presenti: 153/153 righe, 0 diffe-
renze su tutte e 11 le colonne):
  team        <- team dell'ultimo giro registrato
  giri        <- lap dell'ultimo giro registrato
  sesT_fin    <- sesT dell'ultimo giro registrato (orologio di sessione all'arrivo)
  partenza    <- compound del primo giro registrato (mescola di partenza)
  soste       <- 'giro:mescola_nuova' separati da ';', letti dai cambi di stint FRA giri
                 consecutivi effettivamente registrati (giro = l'ultimo prima del cambio)
  n_soste     <- numero di giri con pit-IN (pin != None). NON e' max(stint)-1: chi si
                 ritira in pit lane ha un ingresso senza stint successivo, e il CSV
                 congelato conta l'ingresso (16 righe lo dimostrano). Per lo stesso motivo
                 n_soste puo' essere > del numero di voci in `soste`.
  tipo_arrivo <- demo/data/esiti.json (pieno_giro / doppiato / RIT / NP), che ha gia' un
                 generatore committato (pipeline_gara.py, euristica dichiarata in testa a
                 quel file) piu' la marcatura NP che il giro-per-giro NON puo' dare
                 ('NP non derivabile senza griglia f1db'). Non la ri-derivo qui: una sola
                 definizione, quella.
  classificato<- tipo_arrivo in (pieno_giro, doppiato)
  pos_finale  <- rango sui piloti NON-NP ordinati per (giri DESC, sesT_fin ASC).
                 I NP non hanno posizione (cella vuota). Questa e' la classifica di pista,
                 non la FIA: nessuna penalita' post-gara, nessuna esclusione.

PERIMETRO DERIVATO dal registro (data/gare_registro.json) intersecato con esiti.json:
nessuna lista cablata. Una gara del registro che non e' ancora stata pubblicata in demo/
(quindi senza esiti) viene saltata con motivo esplicito, non silenziosamente.

GUARDIA (non negoziabile): prima di scrivere, ogni cella gia' presente nel CSV deve essere
riprodotta IDENTICA. Se una gara del CSV sparisce dal perimetro, o se anche una sola cella
cambia, il generatore SI FERMA e stampa le differenze: non sovrascrive.

Uso:
  python3 gen_arrivi.py           # CHECK: rigenera, confronta, NON scrive
  python3 gen_arrivi.py --write   # scrive solo se la guardia passa
"""
import csv
import json
import os
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.abspath(__file__))
REGISTRO = os.path.join(ROOT, 'data', 'gare_registro.json')
ESITI = os.path.join(ROOT, 'demo', 'data', 'esiti.json')
CSV_PATH = os.path.join(ROOT, 'data', 'arrivi_2026.csv')
COLS = ['gara', 'pilota', 'team', 'pos_finale', 'classificato', 'tipo_arrivo',
        'giri', 'sesT_fin', 'partenza', 'soste', 'n_soste']
CHIAVE = ('gara', 'pilota')
CLASSIFICATI = ('pieno_giro', 'doppiato')


def cella(v):
    return '' if v is None or v == 'None' else str(v)


def gare_nel_csv(path=CSV_PATH):
    if not os.path.exists(path):
        return []
    viste = []
    for r in csv.DictReader(open(path, encoding='utf-8')):
        if r['gara'] not in viste:
            viste.append(r['gara'])
    return viste


def perimetro():
    """Gare da scrivere: registro con grezzo presente E esiti gia' pubblicati.
    Guardia: deve contenere tutte le gare gia' nel CSV."""
    reg = json.load(open(REGISTRO, encoding='utf-8'))
    esiti = json.load(open(ESITI, encoding='utf-8'))
    fuori = {}
    for nome, v in reg.items():
        raw = os.path.join(ROOT, v['raw'])
        if not os.path.exists(raw):
            print(f"[arrivi] salto '{nome}': grezzo assente ({v['raw']})")
            continue
        if nome not in esiti:
            print(f"[arrivi] salto '{nome}': nessun esito in demo/data/esiti.json "
                  f"(gara non ancora pubblicata) -> tipo_arrivo non derivabile")
            continue
        fuori[nome] = (raw, esiti[nome])
    for nome in gare_nel_csv():
        if nome not in fuori:
            raise RuntimeError(
                f"deriva del perimetro: '{nome}' e' nel CSV congelato ma non e' piu' "
                f"derivabile (grezzo o esiti mancanti) -> non scrivo")
    return fuori


def righe_gara(nome, raw_path, esiti_gara):
    d = json.load(open(raw_path, encoding='utf-8'))
    n = len(d['lap'])
    per_drv = defaultdict(list)
    for i in range(n):
        per_drv[d['drv'][i]].append({k: d[k][i] for k in
                                     ('lap', 'sesT', 'team', 'compound', 'stint', 'pin')})
    calc = {}
    for drv, giri in per_drv.items():
        giri = sorted(giri, key=lambda r: r['lap'])
        soste, prec = [], None
        for r in giri:
            if prec is not None and r['stint'] != prec['stint']:
                soste.append(f"{prec['lap']}:{r['compound']}")
            prec = r
        ultimo = giri[-1]
        tipo = esiti_gara.get(drv)
        if tipo is None:
            raise RuntimeError(f"{nome}: '{drv}' e' nel grezzo ma non in esiti.json — "
                               f"esito non derivabile, non scrivo")
        calc[drv] = dict(
            team=ultimo['team'], giri=ultimo['lap'], sesT=ultimo['sesT'],
            partenza=giri[0]['compound'], soste=';'.join(soste),
            n_soste=sum(1 for r in giri if r['pin'] not in (None, 'None')),
            tipo=tipo)
    ordine = sorted([k for k in calc if calc[k]['tipo'] != 'NP'],
                    key=lambda k: (-calc[k]['giri'], calc[k]['sesT']))
    pos = {k: i + 1 for i, k in enumerate(ordine)}
    out = []
    for drv in sorted(calc):
        c = calc[drv]
        out.append({
            'gara': nome, 'pilota': drv, 'team': cella(c['team']),
            'pos_finale': '' if drv not in pos else cella(float(pos[drv])),
            'classificato': str(c['tipo'] in CLASSIFICATI),
            'tipo_arrivo': c['tipo'], 'giri': cella(c['giri']),
            'sesT_fin': cella(c['sesT']), 'partenza': cella(c['partenza']),
            'soste': c['soste'], 'n_soste': cella(c['n_soste']),
        })
    return out


def rigenera():
    out = []
    for nome, (raw, esiti_gara) in perimetro().items():
        out.extend(righe_gara(nome, raw, esiti_gara))
    return out


def confronta(nuove, path=CSV_PATH):
    if not os.path.exists(path):
        return []
    vecchie = {tuple(r[k] for k in CHIAVE): r
               for r in csv.DictReader(open(path, encoding='utf-8'))}
    idx = {tuple(r[k] for k in CHIAVE): r for r in nuove}
    diffs = []
    for k, vecchia in vecchie.items():
        nuova = idx.get(k)
        if nuova is None:
            diffs.append((k, 'RIGA', 'presente', 'assente'))
            continue
        for c in COLS:
            if vecchia.get(c, '') != nuova[c]:
                diffs.append((k, c, vecchia.get(c, ''), nuova[c]))
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
    print(f"[arrivi] rigenerate {len(nuove)} righe su {len(gare)} gare: {', '.join(gare)}")
    vecchie = gare_nel_csv()
    print(f"[arrivi] il CSV attuale copriva {len(vecchie)} gare: "
          f"{', '.join(vecchie) or '(file assente)'}")
    if diffs:
        print(f"[arrivi] GUARDIA FALLITA: {len(diffs)} celle gia' congelate NON sono "
              f"riprodotte. NON scrivo.")
        for k, c, vecchio, nuovo in diffs[:20]:
            print(f"    {k} {c}: CSV={vecchio!r} rigenerato={nuovo!r}")
        if len(diffs) > 20:
            print(f"    ... e altre {len(diffs)-20}")
        return 1
    print("[arrivi] guardia OK: tutte le celle gia' presenti sono riprodotte identiche.")
    if write:
        scrivi(nuove)
        print(f"[arrivi] scritto {os.path.relpath(CSV_PATH, ROOT)} "
              f"({len(nuove)} righe, {len(gare)} gare).")
    else:
        print("[arrivi] CHECK: nessuna scrittura (usa --write).")
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
