#!/usr/bin/env python3
"""fondo_identita.py — CHE PISTA E'. Una mappa dichiarata, non indovinata.

    python3 fondo_identita.py            # verifica che ogni cartella del fondo sia mappata
    python3 fondo_identita.py --tabella  # stampa la tabella per cid

PERCHE' NON SI PUO' DEDURRE DAL NOME. Il nome del Gran Premio e' un'etichetta commerciale,
il circuito e' un fatto fisico, e i due divergono in modi che rovinano ogni confronto
storico se si lascia decidere a una somiglianza di stringa:

  - "Spanish Grand Prix" e' BARCELLONA dal 2018 al 2025. Nel 2026 il calendario ha DUE gare
    in Spagna, Spagna->catalunya e Madrid->madring: un accoppiamento per nome puo' mandare
    otto stagioni di Catalunya su una pista dove non si e' mai corso.
  - "Sakhir Grand Prix" (2020) NON e' il Bahrain: e' il layout ESTERNO dello stesso
    autodromo, giro da 3,5 km invece di 5,4. Fonderli significa mescolare due piste diverse
    nella stessa cella. Qui restano separati.
  - "Styrian" e' il Red Bull Ring, come "Austrian" — stessa pista, due gare nello stesso anno.
  - "70th Anniversary" e' Silverstone. "Eifel" e' il Nurburgring. "Tuscan" e' il Mugello.
  - "Mexican" e "Mexico City" sono la stessa pista con due nomi in anni diversi.
  - "Brazilian" e "Sao Paulo" idem (Interlagos).

I cid sono gli stessi di data/calendario_2026.json, cosi' storico e 2026 finiscono nella
stessa cella quando — e SOLO quando — sono davvero la stessa pista.
"""
import argparse
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
FONDO = os.path.join(ROOT, 'data', 'fondo')

# nome cartella (come sta online) -> cid. Chi aggiunge una riga qui dichiara una identita':
# non e' manutenzione, e' una decisione su quali dati si possono sommare.
NOME2CID = {
    '70th Anniversary Grand Prix': 'silverstone',   # Silverstone, seconda gara 2020
    'Abu Dhabi Grand Prix':        'yas-marina',
    'Australian Grand Prix':       'melbourne',
    'Austrian Grand Prix':         'spielberg',
    'Azerbaijan Grand Prix':       'baku',
    'Bahrain Grand Prix':          'bahrain',
    'Belgian Grand Prix':          'spa-francorchamps',
    'Brazilian Grand Prix':        'interlagos',    # stesso di Sao Paulo
    'British Grand Prix':          'silverstone',
    'Canadian Grand Prix':         'montreal',
    'Chinese Grand Prix':          'shanghai',
    'Dutch Grand Prix':            'zandvoort',
    'Eifel Grand Prix':            'nurburgring',   # 2020
    'Emilia Romagna Grand Prix':   'imola',
    'French Grand Prix':           'paul-ricard',
    'German Grand Prix':           'hockenheim',
    'Hungarian Grand Prix':        'hungaroring',
    'Italian Grand Prix':          'monza',
    'Japanese Grand Prix':         'suzuka',
    'Las Vegas Grand Prix':        'las-vegas',
    'Mexican Grand Prix':          'mexico-city',   # stesso di Mexico City
    'Mexico City Grand Prix':      'mexico-city',
    'Miami Grand Prix':            'miami',
    'Monaco Grand Prix':           'monaco',
    'Portuguese Grand Prix':       'portimao',
    'Qatar Grand Prix':            'lusail',
    'Russian Grand Prix':          'sochi',
    'Sakhir Grand Prix':           'bahrain-outer', # ATTENZIONE: NON e' 'bahrain'
    'Saudi Arabian Grand Prix':    'jeddah',
    'Singapore Grand Prix':        'marina-bay',
    'Spanish Grand Prix':          'catalunya',     # ATTENZIONE: NON e' 'madring'
    'Styrian Grand Prix':          'spielberg',     # stesso di Austrian
    'São Paulo Grand Prix':        'interlagos',
    'Turkish Grand Prix':          'istanbul',
    'Tuscan Grand Prix':           'mugello',       # 2020
    'United States Grand Prix':    'austin',
}

# Piste che NON esistono nel 2026: il confronto con il regime nuovo qui non si puo' fare,
# e va detto invece di lasciarlo scoprire a chi legge una cella vuota.
FUORI_2026 = {'bahrain', 'bahrain-outer', 'nurburgring', 'hockenheim', 'paul-ricard',
              'portimao', 'sochi', 'istanbul', 'mugello', 'imola', 'jeddah'}


def cid(nome_cartella):
    """cid della pista, o None se la cartella non e' dichiarata. Mai un tentativo."""
    return NOME2CID.get(nome_cartella)


def cartelle_del_fondo():
    out = set()
    if not os.path.isdir(FONDO):
        return out
    for y in os.listdir(FONDO):
        d = os.path.join(FONDO, y)
        if not (y.isdigit() and os.path.isdir(d)):
            continue
        for g in os.listdir(d):
            if os.path.isdir(os.path.join(d, g)):
                out.add(g)
    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--tabella', action='store_true')
    a = p.parse_args()

    trovate = cartelle_del_fondo()
    orfane = sorted(g for g in trovate if g not in NOME2CID)
    inutili = sorted(g for g in NOME2CID if g not in trovate)

    if a.tabella:
        per_cid = {}
        for n, c in NOME2CID.items():
            if n in trovate:
                per_cid.setdefault(c, []).append(n)
        print(f"{'cid':20} {'nel 2026?':10} nomi storici")
        for c in sorted(per_cid):
            nel26 = 'no' if c in FUORI_2026 else 'si'
            print(f'  {c:18} {nel26:10} {", ".join(sorted(per_cid[c]))}')
        return 0

    print(f'cartelle nel fondo: {len(trovate)}   mappate: {len(trovate)-len(orfane)}')
    if orfane:
        print('\n✗ NON DICHIARATE — vanno aggiunte a NOME2CID prima di usarle:')
        for g in orfane:
            print(f'    {g}')
        return 1
    if inutili:
        print(f'\n  (nella mappa ma non nel fondo, innocuo: {", ".join(inutili)})')
    cid_unici = {NOME2CID[g] for g in trovate}
    print(f'  piste distinte: {len(cid_unici)}   di cui fuori dal 2026: '
          f'{len(cid_unici & FUORI_2026)}')
    print('\n✓ ogni cartella del fondo ha una identita dichiarata')
    return 0


if __name__ == '__main__':
    sys.exit(main())
