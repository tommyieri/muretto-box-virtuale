"""gen_pista_svg.py — GENERATORE dei tracciati per la vista pallini della demo.

Per ogni gara del registro (data/gare_registro.json) produce demo/data/pista_<gara>.json:
la geometria del circuito ricavata da UN giro pulito di telemetria GPS FastF1, gia'
parametrizzata in distanza — cio' che serve ai pallini (posizione = f(frazione di giro)).

CRITERIO DEL GIRO (dichiarato, deterministico):
  tra i giri di gara con LapTime valido (preferendo IsAccurate), in ordine di LapTime
  crescente (tie-break: numero pilota, numero giro), il PRIMO la cui telemetria di
  posizione passa i controlli di qualita':
    - >= 100 campioni GPS on-track;
    - nessun buco temporale > 1.5 s tra campioni (continuita');
    - anello chiuso: distanza inizio-fine <= 60 m;
    - lunghezza totale plausibile (3-8 km).
  Un giro VELOCE e' il piu' pulito geometricamente (niente pit, niente fuori-traiettoria
  da SC): stesso criterio del prototipo Silverstone ("giro veloce gara").

GEOMETRIA (deterministica, stesso input -> stesso output):
  1. polilinea X,Y del giro (unita' FastF1: decimi di metro), anello chiuso;
  2. ricampionamento UNIFORME IN DISTANZA a N=500 punti + media mobile circolare (k=3):
     semplifica e leviga senza casualita';
  3. orientamento: rotazione della mappa ufficiale F1 (circuit_info MultiViewer, gradi
     registrati nel JSON; 0 se non disponibile), poi y invertita per lo schermo (SVG);
  4. normalizzazione nel viewBox [0,0,1000,H] (H dal rapporto d'aspetto);
  5. dist[i] = frazione di giro cumulata al punto i (0 = start/finish, senso di marcia);
     il segmento di chiusura (ultimo punto -> punto 0) completa la frazione a 1.

La UI (demo/pista.mjs) interpola i pallini lungo `punti` via `dist`: replay posizionale
dai tempi-giro reali, NON simulazione. Gare senza telemetria utilizzabile: nessun file,
il placeholder resta (MAI piste disegnate a mano).

Uso:   python3 gen_pista_svg.py            # tutte le gare del registro
       python3 gen_pista_svg.py --gara Miami
Nota:  richiede il python3 utente (fastf1, NON venv) e scarica i position-data se non
       in cache (~minuti a gara la prima volta). Cache: ~/muretto_shared/ff1_cache/.
"""
import argparse, json, logging, math, os, sys

import numpy as np
import fastf1

logging.getLogger('fastf1').setLevel(logging.ERROR)
# cache in sede stabile, fuori dal repo e da ogni worktree (vedi SETUP_AMBIENTE.md)
fastf1.Cache.enable_cache(os.path.expanduser('~/muretto_shared/ff1_cache'))

ANNO = 2026
N_PUNTI = 500
MAX_GAP_S = 1.5
MAX_CHIUSURA_M = 60.0
MIN_CAMPIONI = 100
LUNGHEZZA_M = (3000.0, 8000.0)


def carica_registro():
    with open(os.path.join('data', 'gare_registro.json')) as f:
        return json.load(f)


def valida_giro(pos):
    """Controlli di qualita' sul pos-data di un giro. Ritorna (ok, motivo, xy)."""
    if pos is None or len(pos) < MIN_CAMPIONI:
        return False, f'campioni insufficienti ({0 if pos is None else len(pos)})', None
    t = pos['Time'].dt.total_seconds().to_numpy()
    if np.max(np.diff(t)) > MAX_GAP_S:
        return False, f'buco temporale {np.max(np.diff(t)):.1f}s', None
    xy = np.column_stack([pos['X'].to_numpy(float), pos['Y'].to_numpy(float)])
    if np.any(~np.isfinite(xy)):
        return False, 'coordinate non finite', None
    chiusura_m = float(np.hypot(*(xy[0] - xy[-1]))) / 10.0
    if chiusura_m > MAX_CHIUSURA_M:
        return False, f'anello non chiuso ({chiusura_m:.0f} m)', None
    seg = np.hypot(*np.diff(xy, axis=0).T)
    lung_m = float(seg.sum()) / 10.0
    if not (LUNGHEZZA_M[0] <= lung_m <= LUNGHEZZA_M[1]):
        return False, f'lunghezza implausibile ({lung_m:.0f} m)', None
    return True, '', xy


def scegli_giro(session):
    """Il giro valido piu' veloce con telemetria pulita (criterio in testa al file)."""
    laps = session.laps
    laps = laps[laps['LapTime'].notna()]
    if 'IsAccurate' in laps.columns and laps['IsAccurate'].any():
        laps = laps[laps['IsAccurate']]
    laps = laps.copy()
    laps['_ord_drv'] = laps['DriverNumber'].astype(str)
    laps = laps.sort_values(['LapTime', '_ord_drv', 'LapNumber'])
    for _, lap in laps.iterrows():
        try:
            pos = lap.get_pos_data()
            if 'Status' in pos.columns:
                pos = pos[pos['Status'] == 'OnTrack']
        except Exception:
            continue
        ok, motivo, xy = valida_giro(pos)
        if ok:
            return lap, xy
    return None, None


def pitlane_stilizzata(punti, fe=0.95, fx=0.05, W=22.0, n=60):
    """Pit-lane STILIZZATA (non geometria reale, dichiarato): corre parallela al nastro
    a cavallo della linea del traguardo (frazione 0 = inizio del lap time => li' ci sono
    i box), spostata verso l'INTERNO del circuito, con rampe morbide d'ingresso/uscita.
    I punti del nastro sono equidistanti in arco => frazione ~ indice/N.
    Ritorna (punti_pitlane, dist_normalizzata, fe, fx)."""
    N = len(punti)
    C = punti.mean(axis=0)
    # verso interno deciso UNA volta alla linea (coerenza lungo tutto il rettilineo)
    t0 = punti[1 % N] - punti[-1]
    n0 = np.array([t0[1], -t0[0]])
    segno = 1.0 if np.dot(C - punti[0], n0) > 0 else -1.0
    idx = np.linspace(fe * N, (1 + fx) * N, n)          # indici frazionari, anello
    out = []
    for j, fi in enumerate(idx):
        i = int(fi) % N
        p = punti[i]
        t = punti[(i + 1) % N] - punti[(i - 1) % N]
        t = t / (np.hypot(*t) or 1.0)
        nrm = segno * np.array([t[1], -t[0]])
        u = j / (n - 1)                                  # rampe smoothstep ai due capi
        rampa = min(u, 1 - u) / 0.25
        prof = 1.0 if rampa >= 1 else rampa * rampa * (3 - 2 * rampa)
        out.append(p + nrm * W * prof)
    out = np.array(out)
    seg = np.hypot(*np.diff(out, axis=0).T)
    dist = np.concatenate([[0.0], np.cumsum(seg)]) / seg.sum()
    return out, dist, fe, fx


def ricampiona_anello(xy, n):
    """Anello chiuso -> n punti equidistanti in arco + media mobile circolare k=3."""
    ring = np.vstack([xy, xy[:1]])                      # chiude l'anello
    seg = np.hypot(*np.diff(ring, axis=0).T)
    cum = np.concatenate([[0.0], np.cumsum(seg)])
    tot = cum[-1]
    tgt = np.linspace(0.0, tot, n, endpoint=False)
    px = np.interp(tgt, cum, ring[:, 0])
    py = np.interp(tgt, cum, ring[:, 1])
    p = np.column_stack([px, py])
    p = (np.roll(p, 1, axis=0) + p + np.roll(p, -1, axis=0)) / 3.0   # levigatura circolare
    return p, tot


def genera(nome, reg, forza=False):
    dest = os.path.join('demo', 'data', f'pista_{nome}.json')
    ti = reg['ti']
    print(f'== {nome} ({ti}) ==')
    session = fastf1.get_session(ANNO, ti, 'R')
    session.load(laps=True, telemetry=True, weather=False, messages=False)
    lap, xy = scegli_giro(session)
    if lap is None:
        print(f'   NIENTE: nessun giro con telemetria GPS utilizzabile -> resta il placeholder')
        return False

    punti, tot_units = ricampiona_anello(xy, N_PUNTI)

    # orientamento: mappa ufficiale (MultiViewer via fastf1); 0 se non disponibile
    rot_gradi = 0.0
    try:
        rot_gradi = float(session.get_circuit_info().rotation)
    except Exception:
        pass
    a = math.radians(rot_gradi)
    punti = punti @ np.array([[math.cos(a), math.sin(a)], [-math.sin(a), math.cos(a)]])

    # schermo: y invertita; normalizzazione nel viewBox [0,0,1000,H]
    punti[:, 1] = -punti[:, 1]
    punti -= punti.min(axis=0)
    scala = 1000.0 / punti[:, 0].max()
    punti *= scala
    H = float(punti[:, 1].max())

    # frazione di giro cumulata (il segmento di chiusura completa a 1)
    seg = np.hypot(*np.diff(np.vstack([punti, punti[:1]]), axis=0).T)
    dist = np.concatenate([[0.0], np.cumsum(seg[:-1])]) / seg.sum()

    pl_punti, pl_dist, fe, fx = pitlane_stilizzata(punti)

    out = {
        '_nota': ('GENERATO da gen_pista_svg.py (FastF1). Replay posizionale: la UI muove i '
                  'pallini come f(frazione di giro) sui tempi-giro reali. Non modificare a mano.'),
        'gara': nome, 'cid': reg.get('cid'),
        'viewBox': [0, 0, 1000, round(H, 1)],
        'punti': [[round(float(x), 1), round(float(y), 1)] for x, y in punti],
        'dist': [round(float(d), 6) for d in dist],
        'pitlane': {
            'nota': ('STILIZZATA, non geometria reale: parallela interna al nastro a cavallo '
                     'della linea (frazione 0 = inizio lap time = box). Serve al transito '
                     'visivo dei pallini in in/out-lap.'),
            'punti': [[round(float(x), 1), round(float(y), 1)] for x, y in pl_punti],
            'dist': [round(float(d), 6) for d in pl_dist],
            'frazione_ingresso': fe, 'frazione_uscita': fx,
        },
        'lunghezza_m': round(tot_units / 10.0, 1),
        'sorgente': {
            'evento': f'{ANNO} {ti}', 'sessione': 'Race',
            'pilota': str(lap['Driver']), 'giro': int(lap['LapNumber']),
            'lap_time_s': round(lap['LapTime'].total_seconds(), 3),
            'criterio': 'giro valido piu veloce con telemetria GPS pulita (vedi testa del generatore)',
            'rotazione_gradi': round(rot_gradi, 1),
            'campioni_gps': int(len(xy)),
            'fastf1': fastf1.__version__,
        },
    }
    with open(dest, 'w') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
    print(f'   scritto {dest}: {lap["Driver"]} giro {int(lap["LapNumber"])} '
          f'({out["sorgente"]["lap_time_s"]}s), {len(punti)} punti, {out["lunghezza_m"]} m, rot {rot_gradi:.0f}°')
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--gara', help='solo questa gara (nome demo, es. Miami); default: tutte')
    args = ap.parse_args()
    registro = carica_registro()
    nomi = [args.gara] if args.gara else list(registro)
    if args.gara and args.gara not in registro:
        sys.exit(f'gara sconosciuta: {args.gara} (registro: {", ".join(registro)})')
    esiti = {}
    for nome in nomi:
        try:
            esiti[nome] = genera(nome, registro[nome])
        except Exception as e:
            print(f'   ERRORE {nome}: {e}')
            esiti[nome] = False
    print('\nRIEPILOGO:', ', '.join(f'{n}={"OK" if v else "placeholder"}' for n, v in esiti.items()))
    if args.gara and not esiti.get(args.gara):
        sys.exit(1)


if __name__ == '__main__':
    main()
