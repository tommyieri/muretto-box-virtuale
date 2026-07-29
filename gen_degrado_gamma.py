"""gen_degrado_gamma.py — generatore VERIFICATO dei coefficienti gamma lin+log.

CHIUDE UN DEBITO: data/degrado_gamma_linlog.csv era "riferimento congelato" ma NON
aveva writer — i valori erano TRASCRITTI A MANO dallo stdout di test_forma_fgiro.py
(che fa solo print). Stessa classe dell'incidente warm-in.

Questo script RIGENERA i gamma dal dato grezzo cosi' che il CSV possa essere
VERIFICATO o FALSIFICATO. NON riproduce il CSV: ricalcola dalla fonte e confronta.

DISEGNO (identico alla Fase 2.1-bis, import diretto — una sola definizione dei filtri):
  - base per (pilota, gara), MAI per stint (vincolo di disegno che identifica il degrado);
  - forma f(giro) = lineare + logaritmica  (beta1*(giro-media) + beta2*ln(giro));
  - stesse gare 2026 dry + British (storico archivio) di test_identificabilita_degrado.RACES;
  - stessi filtri F1..F7, stesso guardrail compound (>=3 stint, >=30 giri), stesso
    rif. MEDIUM, stessa SE cluster-robust per (pilota,stint), IC95.
Le funzioni sono IMPORTATE da test_forma_fgiro / test_identificabilita_degrado: questo
script non ridefinisce il calcolo, lo esegue e lo scrive.

Uso:
  python3 gen_degrado_gamma.py          # CHECK: rigenera e confronta col CSV attuale, NON scrive
  python3 gen_degrado_gamma.py --write  # scrive data/degrado_gamma_linlog.csv (writer verificato)

Nota precisione: il CSV congela 4 decimali (deciso 2026-07-07 per eliminare la fragilita'
del bordo di arrotondamento che aveva prodotto 5 celle sbagliate di +-0.001 nella
trascrizione a mano — doppio arrotondamento pieno->4dp->3dp con half-up). Il confronto
dichiara "identico" se il valore rigenerato ARROTONDATO a 4 decimali riproduce la cella
(|delta| <= 5e-5); oltre = discrepanza.
"""
import sys, csv, os, json
import numpy as np
from test_identificabilita_degrado import (RACES, SLICK, SOGLIA_OUTLIER,
                                           carica, pulisci, filtro_outlier)
from test_forma_fgiro import prepara, costruisci, stima
from drycheck_2026 import valuta

FORMA = 'linlog'
CSV_PATH = os.path.join(os.path.dirname(__file__), 'data', 'degrado_gamma_linlog.csv')
REGISTRO = os.path.join(os.path.dirname(__file__), 'data', 'gare_registro.json')
COLS = ['gara', 'compound', 'gamma', 'ic_lo', 'ic_hi', 'significativo']
# la chiave-RACES 'British' e' etichettata 'Gran Bretagna' (nome IT) nel CSV congelato.
NOME_CSV = {'British': 'Gran Bretagna'}
DECIMALI = 4          # precisione congelata del CSV
TOL = 5e-5            # trascrizione fedele => arrotonda a DECIMALI cifre


def calcola_gamma(path):
    """Catena di calcolo gamma lin+log per UNA gara (path del Race.json).
    Riusa IDENTICI i filtri (carica->pulisci->filtro_outlier), il guardrail compound
    (prepara), la forma f(giro)=[giro-media, ln(giro)] (costruisci) e gli SE cluster-robust
    (stima) gia' validati — non reimplementa nulla. Ritorna la stima grezza + i conteggi.

    Usata sia dal percorso 2026 (rigenera, invariante bit-identica) sia dallo studio
    storico core-5 (gen_degrado_storico_core5.py): una sola definizione del calcolo."""
    rows0 = carica(path)
    keep, _, N = pulisci(rows0)
    keep, _ = filtro_outlier(keep, SOGLIA_OUTLIER)
    rows, ident, stint_per_c, giri_per_c = prepara(keep)
    X, y, grp, gidx, drvs, di = costruisci(rows, ident, N, FORMA)
    s = stima(X, y, grp, gidx)
    return dict(s=s, ident=ident, stint_per_c=stint_per_c, giri_per_c=giri_per_c,
                gidx=gidx, drvs=drvs, N=N)


def perimetro():
    """Le gare su cui i gamma si calcolano, DERIVATE dal registro invece che scritte a mano.

    PERCHE' NON PIU' LA LISTA FISSA. RACES era congelata a 8 gare e non si estendeva: la
    prima gara nuova con casi undercut avrebbe trovato la sua (gara, compound) mancante e
    il backtest sarebbe ripiegato sulla mediana dei compound — la gomma GREZZA proprio
    fuori campione, dove si decide. Il perimetro derivato si estende da solo a ogni gara
    pubblicata, e l'esclusione del Canada NON e' piu' una riga cablata: cade da sola dal
    dry-check (partenza umida -> BAGNATA), che e' la regola gia' dichiarata altrove.

    GUARDIA CONTRO LA DERIVA: il perimetro derivato deve CONTENERE, con gli stessi
    percorsi, tutte le gare della lista congelata. Se una sparisce o cambia sorgente, il
    generatore si ferma invece di riscrivere il CSV su un perimetro diverso in silenzio."""
    reg = json.load(open(REGISTRO))
    fuori = {}
    for nome, v in reg.items():
        if valuta(json.load(open(v['raw'])), 'Race')['esito'] != 'OK':
            continue
        fuori[nome] = v['raw']
    for nome, path in RACES.items():
        atteso = NOME_CSV.get(nome, nome)
        if atteso not in fuori:
            raise RuntimeError(f"deriva del perimetro: '{atteso}' e' nella lista congelata "
                               f"(RACES) ma non nel registro dry -> il CSV cambierebbe base")
        if os.path.normpath(fuori[atteso]) != os.path.normpath(path):
            raise RuntimeError(f"deriva del perimetro: '{atteso}' cambia sorgente "
                               f"({path} -> {fuori[atteso]})")
    return fuori


def rigenera():
    """Ricalcola i gamma linlog 2026 dal dato grezzo. Ritorna lista di dict a PIENA precisione."""
    out = []
    for nome, path in perimetro().items():
        r = calcola_gamma(path)
        s = r['s']
        if s is None:
            raise RuntimeError(f'{nome}: design matrix rank-deficiente — gamma non identificato')
        gara = NOME_CSV.get(nome, nome)
        for c in SLICK:  # ordine canonico SOFT/MEDIUM/HARD, solo i compound identificabili
            if c not in s['gamme']:
                continue
            g = s['gamme'][c]
            out.append(dict(gara=gara, compound=c,
                            gamma=g['gamma'], ic_lo=g['lo'], ic_hi=g['hi'],
                            significativo=(g['lo'] > 0 or g['hi'] < 0)))
    return out


def fmt(x):
    """formattazione canonica a DECIMALI cifre del CSV (evita '-0.0000')."""
    s = f"{x:.{DECIMALI}f}"
    zero = "0." + "0" * DECIMALI
    return zero if s == "-" + zero else s


def scrivi(righe, path=CSV_PATH):
    with open(path, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(COLS)
        for r in righe:
            w.writerow([r['gara'], r['compound'], fmt(r['gamma']),
                        fmt(r['ic_lo']), fmt(r['ic_hi']), str(r['significativo'])])


def leggi_csv(path=CSV_PATH):
    if not os.path.exists(path):
        return None
    with open(path, newline='') as f:
        return {(r['gara'], r['compound']): r for r in csv.DictReader(f)}


def confronta(righe, vecchio):
    """Confronta rigenerato vs CSV attuale. Ritorna (righe_tabella, n_discrepanze)."""
    tab, discrep = [], 0
    for r in righe:
        key = (r['gara'], r['compound'])
        v = vecchio.get(key) if vecchio else None
        riga = {'gara': r['gara'], 'compound': r['compound']}
        ok_cella = True
        for campo, nuovo in (('gamma', r['gamma']), ('ic_lo', r['ic_lo']), ('ic_hi', r['ic_hi'])):
            old = float(v[campo]) if v else None
            nuovo_r = float(fmt(nuovo))
            delta = None if old is None else nuovo_r - old
            riga[campo] = dict(old=old, new_full=nuovo, new_r=nuovo_r, delta=delta)
            if old is None or abs(nuovo_r - old) > TOL:
                ok_cella = False
        sig_old = (v['significativo'] == 'True') if v else None
        riga['significativo'] = dict(old=sig_old, new=r['significativo'])
        if sig_old is None or sig_old != r['significativo']:
            ok_cella = False
        riga['assente'] = (v is None)
        riga['ok'] = ok_cella
        if not ok_cella:
            discrep += 1
        tab.append(riga)
    # celle nel CSV vecchio ma NON rigenerate (chiavi orfane)
    if vecchio:
        rigen_keys = {(r['gara'], r['compound']) for r in righe}
        for key in vecchio:
            if key not in rigen_keys:
                tab.append({'gara': key[0], 'compound': key[1], 'orfana': True, 'ok': False})
                discrep += 1
    return tab, discrep


def stampa(tab):
    print(f"{'gara':14s} {'cmp':6s} | {'gamma_old':>9s} {'gamma_new':>10s} {'d':>8s} | "
          f"{'lo_old':>7s} {'lo_new':>7s} | {'hi_old':>7s} {'hi_new':>7s} | {'sig o/n':>8s}  esito")
    for r in tab:
        if r.get('orfana'):
            print(f"{r['gara']:14s} {r['compound']:6s} | "
                  f"{'--- presente nel CSV ma NON rigenerata (chiave orfana) ---':>60s}  DISCREPANZA")
            continue
        g, lo, hi = r['gamma'], r['ic_lo'], r['ic_hi']
        sig = r['significativo']
        esito = 'ok' if r['ok'] else '*** DIFF ***'
        dtxt = f"{g['delta']:+.4f}" if g['delta'] is not None else 'n/a'
        print(f"{r['gara']:14s} {r['compound']:6s} | "
              f"{g['old']!s:>9s} {g['new_r']:>10.4f} {dtxt:>8s} | "
              f"{lo['old']!s:>7s} {lo['new_r']:>7.4f} | {hi['old']!s:>7s} {hi['new_r']:>7.4f} | "
              f"{str(sig['old'])[:1]+'/'+str(sig['new'])[:1]:>8s}  {esito}")


if __name__ == '__main__':
    scrivi_flag = '--write' in sys.argv
    righe = rigenera()

    if scrivi_flag:
        scrivi(righe)
        print(f"SCRITTO {CSV_PATH} ({len(righe)} righe) — writer verificato.")
    else:
        vecchio = leggi_csv()
        if vecchio is None:
            print(f"CSV attuale assente ({CSV_PATH}): niente da confrontare. Usa --write per crearlo.")
        else:
            print(f"=== VERIFICA TRASCRIZIONE: rigenerato (linlog, dato grezzo) vs CSV attuale ===")
            print(f"    tolleranza: |delta| <= {TOL:g} (il CSV congela {DECIMALI} decimali)\n")
            tab, discrep = confronta(righe, vecchio)
            stampa(tab)
            maxd = max((abs(r['gamma']['delta']) for r in tab
                        if not r.get('orfana') and r['gamma']['delta'] is not None), default=0.0)
            print(f"\nrighe confrontate: {len([r for r in tab if not r.get('orfana')])} | "
                  f"discrepanze: {discrep} | max |delta| gamma: {maxd:.6f}")
            if discrep == 0:
                print(f"ESITO: VERIFICA OK — ogni cella rigenerata riproduce il CSV a {DECIMALI} decimali.")
                print("       Il debito e' chiuso: il file ha un writer verificato (esegui con --write).")
            else:
                print("ESITO: DISCREPANZE TROVATE — NON sovrascrivere. Vedi righe '*** DIFF ***' sopra.")
