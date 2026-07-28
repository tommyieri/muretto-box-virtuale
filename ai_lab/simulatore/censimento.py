#!/usr/bin/env python3
"""censimento.py — FASE 0, passo 1: COSA C'E' DAVVERO NEL GREZZO 2026.

    python3 ai_lab/simulatore/censimento.py
    python3 ai_lab/simulatore/censimento.py --json ai_lab/simulatore/esito_censimento.json

REGOLA DI QUESTO ARCO (decisione PO, 28/07/2026): non si eredita NIENTE dai derivati.
Non si legge demo/data/*.json, non si legge data/modello_*.json, non si legge nessun CSV
di laboratorio. Si legge il grezzo, e basta:

    data/gare_registro.json  ->  data/ti_cache/*.json  e  data/ti_archive/2026/*/Race.json

`lab/fondo.py` viene usato come PORTA (sa dove stanno i file), ma questo script NON si
fida: rilegge gli stessi file a mano e verifica che le due letture coincidano riga per
riga. Un lettore e' codice come un altro, e puo' sbagliare.

COSA CENSISCE, e perche' ognuna di queste cose serve al simulatore:

    giri / piloti / copertura      quanto materiale c'e' per stimare qualunque cosa
    mescole                        se una mescola ha pochi giri, il suo coefficiente non
                                   e' stimabile e va detto, non inventato
    stint chiusi e durate          il BERSAGLIO del simulatore: e' la scelta vera delle
                                   squadre, ed e' anche il segnale d'allarme del §4.2 del
                                   piano ("i team fanno max 10 giri su quella mescola")
    soste (pin/pout)               dove cade la decisione che stiamo modellando
    neutralizzazioni (status 4/6)  i giri che NON parlano di degrado
    bagnato (dal compound)         il regime che oggi il prodotto rifiuta
    giri cancellati (del)          rumore da escludere dalle stime

NIENTE STIME QUI. Questo file conta e basta: e' la fotografia contro cui ogni numero
delle fasi successive dovra' tornare.
"""
import argparse
import json
import os
import sys
from collections import Counter, defaultdict

QUI = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(QUI))
sys.path.insert(0, os.path.join(ROOT, 'lab'))
import fondo  # noqa: E402   la PORTA sul grezzo, non una fonte di numeri

ASCIUTTE = ('SOFT', 'MEDIUM', 'HARD')
BAGNATE = ('INTERMEDIATE', 'WET')

# Monaco: escluso dalle stime di degrado su indicazione del PO e per precedente di
# progetto (CID_NO_DEGRADO). Qui si CENSISCE lo stesso — si esclude quando si stima,
# non quando si guarda.
ESCLUSE_DEGRADO = {'Monaco'}


def _n(x):
    """il grezzo scrive la STRINGA 'None' per i mancanti: e' una trappola, non un valore"""
    return None if x is None or x == 'None' or x == '' else x


def leggi_grezzo_a_mano(percorso):
    """Rilettura INDIPENDENTE dal lettore di libreria: colonne -> righe, senza fondo.py."""
    with open(percorso) as f:
        d = json.load(f)
    if not isinstance(d, dict) or 'lap' not in d:
        return []
    cols = list(d)
    n = len(d['lap'])
    return [{c: _n(d[c][i]) for c in cols} for i in range(n)]


def neutralizzato(r):
    """status del feed: 4 = safety car, 6 = virtual safety car (vocabolario gia' a referto)"""
    s = str(r.get('status') or '')
    return ('4' in s) or ('6' in s)


def stint_chiusi(righe_pilota):
    """Stint CHIUSI (ne esiste uno successivo): durata = giri percorsi su quella gomma.

    Uno stint ancora aperto a fine gara dice solo "almeno tanto" e NON entra nelle durate:
    e' la stessa regola gia' scritta in demo/grossi.mjs, e vale perche' la durata di uno
    stint aperto e' censurata a destra."""
    per_stint = defaultdict(list)
    for lap in sorted(righe_pilota):
        r = righe_pilota[lap]
        s = r.get('stint')
        if s is None:
            continue
        per_stint[int(s)].append(r)
    out = []
    chiavi = sorted(per_stint)
    for i, s in enumerate(chiavi):
        righe = per_stint[s]
        aperto = (i == len(chiavi) - 1)
        comp = Counter(r.get('compound') for r in righe if r.get('compound')).most_common(1)
        out.append({
            'stint': s,
            'compound': comp[0][0] if comp else None,
            'giri': len(righe),
            'lap_da': min(int(r['lap']) for r in righe),
            'lap_a': max(int(r['lap']) for r in righe),
            'aperto': aperto,
            # una gomma "vissuta" sotto safety car non racconta il degrado nello stesso modo
            'giri_neutralizzati': sum(1 for r in righe if neutralizzato(r)),
        })
    return out


def censisci(anno, gara):
    percorso = None
    if str(anno) == '2026':
        p = os.path.join(ROOT, 'data', 'ti_archive', '2026', gara, 'Race.json')
        percorso = p if os.path.exists(p) else fondo._percorsi_2026().get(gara)

    righe = fondo.giri(anno, gara, 'Race')
    verifica = None
    if percorso and os.path.exists(percorso):
        a_mano = leggi_grezzo_a_mano(percorso)
        verifica = {
            'righe_lettore': len(righe),
            'righe_a_mano': len(a_mano),
            'identiche': len(righe) == len(a_mano) and all(
                x == y for x, y in zip(righe, a_mano)),
            'file': os.path.relpath(percorso, ROOT),
        }

    per_pil = fondo.per_pilota(righe)
    piloti = sorted(per_pil)
    n_laps = max((int(r['lap']) for r in righe if r.get('lap') is not None), default=0)

    comp = Counter(r['compound'] for r in righe if r.get('compound'))
    con_tempo = sum(1 for r in righe if r.get('time') is not None)
    neutri = sum(1 for r in righe if neutralizzato(r))
    cancellati = sum(1 for r in righe if r.get('del') is True)
    soste = sum(1 for r in righe if r.get('pin') is not None)
    bagnati = sum(1 for r in righe if r.get('compound') in BAGNATE)

    durate = defaultdict(list)
    stint_tot = 0
    for d in piloti:
        for st in stint_chiusi(per_pil[d]):
            stint_tot += 1
            if st['aperto'] or st['compound'] not in ASCIUTTE:
                continue
            # una gomma passata in larga parte sotto neutralizzazione non parla di degrado
            if st['giri'] and st['giri_neutralizzati'] / st['giri'] > 0.5:
                continue
            durate[st['compound']].append(st['giri'])

    # temperatura pista: entra nel modello del degrado piu' avanti, qui si censisce
    tt = [r['wTT'] for r in righe if r.get('wTT') is not None]
    pioggia = sum(1 for r in righe if r.get('wR') is True)

    return {
        'gara': gara,
        'n_laps': n_laps,
        'piloti': len(piloti),
        'righe': len(righe),
        'righe_con_tempo': con_tempo,
        'copertura_tempo': round(con_tempo / len(righe), 4) if righe else 0.0,
        'giri_neutralizzati': neutri,
        'quota_neutralizzata': round(neutri / len(righe), 4) if righe else 0.0,
        'giri_cancellati': cancellati,
        'soste': soste,
        'giri_bagnati': bagnati,
        'bagnata': bagnati > 0,
        'flag_pioggia_wR': pioggia,
        'temp_pista_mediana': round(sorted(tt)[len(tt) // 2], 1) if tt else None,
        'compound': dict(comp.most_common()),
        'stint_totali': stint_tot,
        'durate_stint_chiusi': {k: sorted(v) for k, v in sorted(durate.items())},
        'verifica_lettore': verifica,
        'esclusa_da_degrado': gara_demo_di(gara) in ESCLUSE_DEGRADO,
    }


def gara_demo_di(nome_ti):
    with open(os.path.join(ROOT, 'data', 'gare_registro.json')) as f:
        reg = json.load(f)
    for demo, v in reg.items():
        if v['ti'] == nome_ti:
            return demo
    return nome_ti


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--anno', default='2026')
    ap.add_argument('--json', help='dove scrivere l esito')
    a = ap.parse_args()

    gare = fondo.gare(a.anno, 'Race')
    out = [censisci(a.anno, g) for g in gare]

    print('=' * 100)
    print(f'CENSIMENTO GREZZO {a.anno} — {len(out)} gare, lette dalla fonte')
    print('=' * 100)
    print(f"{'gara':32} {'giri':>4} {'pil':>4} {'tempi':>6} {'neutr':>6} {'soste':>6} "
          f"{'bagn':>5} {'stint':>6}  mescole")
    for r in out:
        mesc = ' '.join(f"{k[:4]}:{v}" for k, v in r['compound'].items())
        flag = '  [ESCLUSA DEGRADO]' if r['esclusa_da_degrado'] else ''
        print(f"{r['gara'][:32]:32} {r['n_laps']:4d} {r['piloti']:4d} "
              f"{r['copertura_tempo']*100:5.1f}% {r['quota_neutralizzata']*100:5.1f}% "
              f"{r['soste']:6d} {r['giri_bagnati']:5d} {r['stint_totali']:6d}  {mesc}{flag}")

    print()
    print('VERIFICA DEL LETTORE (fondo.py contro rilettura indipendente del file)')
    ko = [r for r in out if r['verifica_lettore'] and not r['verifica_lettore']['identiche']]
    for r in out:
        v = r['verifica_lettore']
        if not v:
            print(f"  {r['gara'][:34]:34} percorso non risolto")
            continue
        segno = 'OK ' if v['identiche'] else 'KO '
        print(f"  {segno} {r['gara'][:34]:34} {v['righe_lettore']:5d} righe   {v['file']}")
    print(f"  -> {len(out) - len(ko)}/{len(out)} identiche")

    print()
    print('DURATE DEGLI STINT CHIUSI (giri) — la scelta vera delle squadre, per mescola')
    print('  esclusi: stint aperti a fine gara (censurati) e stint per meta sotto neutralizzazione')
    agg = defaultdict(list)
    for r in out:
        if r['esclusa_da_degrado']:
            continue
        for k, v in r['durate_stint_chiusi'].items():
            agg[k].extend(v)
    for k in ('SOFT', 'MEDIUM', 'HARD'):
        v = sorted(agg.get(k, []))
        if not v:
            print(f'  {k:7} nessuno stint chiuso')
            continue
        q = lambda p: v[min(len(v) - 1, int(len(v) * p))]  # noqa: E731
        print(f'  {k:7} n={len(v):4d}   min {v[0]:3d}   p25 {q(.25):3d}   mediana {q(.5):3d}   '
              f'p75 {q(.75):3d}   max {v[-1]:3d}')

    print()
    print('PERIMETRO PER LE STIME DI DEGRADO')
    dentro = [r for r in out if not r['esclusa_da_degrado'] and not r['bagnata']]
    fuori_b = [r['gara'] for r in out if r['bagnata']]
    fuori_m = [r['gara'] for r in out if r['esclusa_da_degrado']]
    print(f'  gare dentro : {len(dentro)}')
    print(f'  fuori (bagnate)      : {fuori_b or "nessuna"}')
    print(f'  fuori (escluse a mano): {fuori_m or "nessuna"}')

    if a.json:
        with open(a.json, 'w') as f:
            json.dump({'anno': a.anno, 'gare': out}, f, indent=1, ensure_ascii=False)
        print(f'\nscritto {a.json}')


if __name__ == '__main__':
    main()
