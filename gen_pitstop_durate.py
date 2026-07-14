"""gen_pitstop_durate.py — G0: ingestione delle DURATE per-stop f1db per le 9 gare demo, dalla
API Jolpica (successore di Ergast). Generatore committato. Sola lettura esterna; nessun dato
documentale entra nel motore.

CAMPO INGERITO: PitStops[].duration della stagione 2026 (le gare demo SONO il 2026: round 1-9).
La durata Ergast/Jolpica e' il TEMPO IN PIT-LANE per lo stop (ingresso->uscita, ~28-30 s a
Silverstone), NON la sola sosta (~2-3 s): verificato in sonda (Silverstone med 29,6 s).
Questa e' la stima diretta di pit_lane_time[c] per G1/G4.

FONTE: https://api.jolpi.ca/ergast/f1/2026/<round>/pitstops (raggiungibile via urllib in questo
ambiente; WebFetch era 403, urllib 200). Mappa gara-demo -> round 2026 dichiarata sotto.
"""
import csv, os, json, socket
import urllib.request

BASE = 'https://api.jolpi.ca/ergast/f1/2026'
ROUND = {  # gara demo -> (round 2026, circuitId atteso)
    'Australia': (1, 'albert_park'), 'Cina': (2, 'shanghai'), 'Giappone': (3, 'suzuka'),
    'Miami': (4, 'miami'), 'Canada': (5, 'villeneuve'), 'Monaco': (6, 'monaco'),
    'Spagna': (7, 'catalunya'), 'Austria': (8, 'red_bull_ring'), 'Gran Bretagna': (9, 'silverstone'),
}
OUT = os.path.join('data', 'pitstop_durate_f1db.csv')

def get(url):
    with urllib.request.urlopen(url, timeout=20) as r:
        return json.load(r)

def parse_dur(s):
    """durata in secondi. Ergast la da' come '28.734' o, per soste lunghe/anomale, 'MM:SS.mmm'."""
    s = str(s).strip()
    if ':' in s:
        mm, ss = s.split(':'); return int(mm) * 60 + float(ss)
    return float(s)

def main():
    rows = []; diag = []
    for gara, (rd, cid) in ROUND.items():
        try:
            d = get(f'{BASE}/{rd}/pitstops/?limit=200')
            races = d['MRData']['RaceTable']['Races']
            if not races:
                diag.append((gara, rd, 'nessuna gara')); continue
            got_cid = races[0]['Circuit']['circuitId']
            stops = races[0].get('PitStops', [])
            for s in stops:
                rows.append(dict(gara=gara, round=rd, circuitId=got_cid, pilota=s['driverId'],
                                 giro=int(s['lap']), stop=int(s['stop']), durata_s=parse_dur(s["duration"])))
            diag.append((gara, rd, f'{len(stops)} stop, circuit={got_cid} ({"OK" if got_cid == cid else "ATTESO "+cid})'))
        except Exception as e:
            diag.append((gara, rd, f'ERRORE {type(e).__name__}: {e}'))
    rows.sort(key=lambda r: (r['gara'], r['giro'], r['pilota']))
    with open(OUT, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['gara', 'round', 'circuitId', 'pilota', 'giro', 'stop', 'durata_s'])
        w.writeheader()
        for r in rows: w.writerow({**r, 'durata_s': f"{r['durata_s']:.3f}"})
    print('G0 — ingestione durate per-stop f1db (Jolpica 2026):')
    for gara, rd, res in diag: print(f'  {gara:14s} round {rd}: {res}')
    print(f'[scritto] {OUT} ({len(rows)} pit stop)')

if __name__ == '__main__':
    main()
