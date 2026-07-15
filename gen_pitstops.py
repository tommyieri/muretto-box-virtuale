"""gen_pitstops.py — GENERATORE di demo/data/pitstops_2026.json (durate pit per-stop).

NOTA DI METODO (5 righe):
  1. Fonte: f1db races-pit-stops (stagione 2026, solo gare in demo); giro f1db == nostro
     in_lap (verificato 292/292 sugli stessi stop).
  2. SEMANTICA della durata: verificata EMPIRICAMENTE contro data/censimento_stops.csv
     (pit_lane_time misurato FastF1, stessi stop 2026): mediana scarto +0.004 s,
     IQR [-0.049, +0.049], 98/98 entro ±0.4 s -> la durata f1db e' il TRANSITO IN
     PIT-LANE ("transito_pitlane"), NON la sosta ferma (~2-4 s).
  3. La verifica RIGIRA a ogni esecuzione: se gli scarti smettono di essere piccoli e
     simmetrici il generatore SI FERMA (exit 1) e stampa la distribuzione — l'etichetta
     non e' mai asserita, e' misurata. Stop senza durata f1db: durata_s = null.
  4. La UI etichetta i valori come "pit lane: X s" (mai "pit stop" generico ne' "sosta").
  5. Deterministico e idempotente; entra in aggiorna_ui.py dopo le schede.

Uso: python3 gen_pitstops.py [--zip f1db-csv.zip] [--release vX]
"""
import argparse, csv, json, os, statistics as st, sys
import f1db_zip

ANNO = '2026'
SOGLIA_MEDIANA_TRANSITO = 0.5   # |mediana scarto| per dichiarare transito
SOGLIA_IQR = 1.0                # ampiezza IQR massima per "scarti piccoli e simmetrici"
BANDA_SOSTA = (-25.0, -8.0)     # mediana attesa se f1db fosse la sosta ferma


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--zip'); ap.add_argument('--release', default=f1db_zip.RELEASE)
    args = ap.parse_args()
    zf = f1db_zip.apri(args.release, args.zip)

    ps = [r for r in f1db_zip.tabella(zf, 'races-pit-stops') if r['year'] == ANNO]
    sigla = {d['id']: d['abbreviation'] for d in f1db_zip.tabella(zf, 'drivers')}
    cal = json.load(open(os.path.join('demo', 'data', 'calendario_2026.json')))
    demo_per_round = {g['round']: g['gara_demo'] for g in cal['gare'] if g['gara_demo']}
    cid_per_round = {g['round']: g['circuitId'] for g in cal['gare']}

    # --- verifica semantica (rigira ogni volta): scarto vs pit_lane_time FastF1 ---
    cens = {}
    with open(os.path.join('data', 'censimento_stops.csv')) as f:
        for r in csv.DictReader(f):
            if r['stagione'] == ANNO:
                cens[(r['circuito'], r['pilota'], int(r['giro']))] = float(r['pit_lane_time'])
    scarti = []
    for r in ps:
        if not r['time']: continue
        k = (cid_per_round.get(int(r['round'])), sigla.get(r['driverId']), int(r['lap']))
        if k in cens:
            scarti.append(float(r['time']) - cens[k])
    if len(scarti) < 20:
        sys.exit(f'STOP: solo {len(scarti)} stop confrontabili col censimento — verifica impossibile.')
    mediana = st.median(scarti)
    q1, q3 = sorted(scarti)[len(scarti)//4], sorted(scarti)[3*len(scarti)//4]
    if abs(mediana) <= SOGLIA_MEDIANA_TRANSITO and (q3 - q1) <= SOGLIA_IQR:
        semantica = 'transito_pitlane'
    elif BANDA_SOSTA[0] <= mediana <= BANDA_SOSTA[1] and (q3 - q1) <= SOGLIA_IQR:
        semantica = 'sosta_ferma'
    else:
        sys.exit(f'STOP: semantica non pulita — mediana {mediana:.3f}s, IQR [{q1:.3f},{q3:.3f}], '
                 f'n={len(scarti)}. Nessuna etichetta inventata.')
    print(f'verifica semantica: {semantica} (n={len(scarti)}, mediana {mediana:+.3f}s, '
          f'IQR [{q1:+.3f},{q3:+.3f}])')

    gare = {}
    for r in sorted(ps, key=lambda r: (int(r['round']), int(r['lap']), r['driverId'])):
        gara = demo_per_round.get(int(r['round']))
        if not gara: continue
        s = sigla.get(r['driverId'])
        gare.setdefault(gara, {}).setdefault(s, []).append({
            'giro': int(r['lap']), 'n': int(r['stop']),
            'durata_s': round(float(r['time']), 3) if r['time'] else None,
        })

    out = {
        '_nota': ('GENERATO da gen_pitstops.py (f1db races-pit-stops, gare in demo). '
                  'SEMANTICA VERIFICATA contro il censimento FastF1 a ogni esecuzione '
                  '(vedi testa del generatore). giro == in_lap dei dati gara. '
                  'Non modificare a mano.'),
        'semantica': semantica,
        'verifica': {'n_confrontati': len(scarti), 'mediana_scarto_s': round(mediana, 3),
                     'iqr_s': [round(q1, 3), round(q3, 3)],
                     'confronto': 'data/censimento_stops.csv (pit_lane_time FastF1, 2026)'},
        'aggiornato_al': cal['gare'][max(demo_per_round)-1]['titolo'] if demo_per_round else None,
        'gare': {g: dict(sorted(v.items())) for g, v in sorted(gare.items())},
    }
    dest = os.path.join('demo', 'data', 'pitstops_2026.json')
    with open(dest, 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1); f.write('\n')
    n = sum(len(v) for g in gare.values() for v in g.values())
    print(f'scritto {dest}: {n} stop in {len(gare)} gare, semantica={semantica}')


if __name__ == '__main__':
    main()
