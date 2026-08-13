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
MAX_GAP_S = 1.5           # fra due rilevazioni DISTINTE, non fra due campioni
MAX_CHIUSURA_M = 60.0
MIN_CAMPIONI = 100        # posizioni DISTINTE: una ripetizione non e' una misura
# nessuna vettura fa piu' di ~94 m/s: sopra i 150 m fra due rilevazioni distinte la
# polilinea non segue piu' il tracciato, lo taglia. Misurato: i giri sani stanno sotto
# i 105 m (Spa 2026, il piu' veloce), l'Ungheria 2026 arriva a 347 m.
MAX_CORDA_M = 150.0
LUNGHEZZA_M = (3000.0, 8000.0)


def carica_registro():
    with open(os.path.join('data', 'gare_registro.json')) as f:
        return json.load(f)


def valida_giro(pos):
    """Controlli di qualita' sul pos-data di un giro. Ritorna (ok, motivo, xy, diagnostica).

    UNA RIPETIZIONE NON E' UNA MISURA, e per questo i controlli girano sulle posizioni
    DISTINTE. Quando FastF1 non ha una posizione nuova RIPETE l'ultima: il feed parla ma
    non sa niente di nuovo. All'Ungheria 2026 il 92% dei campioni di un giro sono
    ripetizioni — restano 26 posizioni vere in 82 secondi — e la polilinea che ne esce
    non e' un circuito: e' un poligono di 26 lati che taglia le curve con corde fino a
    347 m, lungo 3.650 m invece di 4.326.

    Quel giro passava tutti e cinque i vecchi controlli. `max(diff(t)) > 1,5 s` guarda i
    BUCHI (campioni che mancano) e una tenuta non e' un buco: i campioni ci sono tutti,
    puntuali, e ripetono. La lunghezza 3.650 m stava dentro la finestra 3-8 km, pensata
    per distinguere un circuito da un errore, non per accorgersi che ne manca il 16%.
    Il buco che conta e' quello fra due cose che il feed sapeva davvero.

    Il nastro che ne usciva non e' solo brutto da vedere: e' il RIGHELLO su cui
    gen_replay.py misura la frazione di giro di ogni vettura. Dove il righello taglia la
    curva, la frazione non avanza e il pallino si ferma in pista (misurato: fattore 0,000
    fra la frazione 0,825 e la 0,875 dell'Hungaroring, cioe' l'ingresso dell'ultimo
    settore). Vedi la testa di gen_replay.py.
    """
    if pos is None or len(pos) < MIN_CAMPIONI:
        return False, f'campioni insufficienti ({0 if pos is None else len(pos)})', None, {}
    t = pos['Time'].dt.total_seconds().to_numpy()
    xy = np.column_stack([pos['X'].to_numpy(float), pos['Y'].to_numpy(float)])
    if np.any(~np.isfinite(xy)):
        return False, 'coordinate non finite', None, {}
    diverso = np.ones(len(xy), dtype=bool)
    diverso[1:] = (np.diff(xy[:, 0]) != 0) | (np.diff(xy[:, 1]) != 0)
    n_grezzi = len(xy)
    t, xy = t[diverso], xy[diverso]
    tenute = 1.0 - len(xy) / n_grezzi
    diag = {'campioni_gps': n_grezzi, 'campioni_distinti': int(len(xy)),
            'tenute_pct': round(100 * tenute, 1)}
    # da qui in poi xy si restituisce SEMPRE (serve a chi il nastro ce l'ha gia' e vuole
    # solo sapere se passerebbe i controlli di oggi); e' `ok` a dire se e' utilizzabile.
    if len(xy) < MIN_CAMPIONI:
        return False, (f'solo {len(xy)} posizioni distinte su {n_grezzi} '
                       f'({100 * tenute:.0f}% tenute del feed)'), xy, diag
    buco = float(np.max(np.diff(t))) if len(t) > 1 else 0.0
    diag['buco_max_distinti_s'] = round(buco, 2)
    if buco > MAX_GAP_S:
        return False, f'buco fra due rilevazioni distinte ({buco:.1f}s)', xy, diag
    chiusura_m = float(np.hypot(*(xy[0] - xy[-1]))) / 10.0
    if chiusura_m > MAX_CHIUSURA_M:
        return False, f'anello non chiuso ({chiusura_m:.0f} m)', xy, diag
    seg = np.hypot(*np.diff(xy, axis=0).T)
    lung_m = float(seg.sum()) / 10.0
    diag['corda_max_m'] = round(float(seg.max()) / 10.0, 1)
    diag['lunghezza_grezza_m'] = round(lung_m, 1)
    if not (LUNGHEZZA_M[0] <= lung_m <= LUNGHEZZA_M[1]):
        return False, f'lunghezza implausibile ({lung_m:.0f} m)', xy, diag
    if diag['corda_max_m'] > MAX_CORDA_M:
        return False, (f'corda troppo lunga fra due rilevazioni '
                       f'({diag["corda_max_m"]:.0f} m): taglierebbe una curva'), xy, diag
    return True, '', xy, diag


def scegli_giro(session, verboso=False):
    """Il giro valido piu' veloce con telemetria pulita (criterio in testa al file).
    Ritorna (lap, xy, diagnostica) — la diagnostica finisce nella targhetta del file."""
    laps = session.laps
    laps = laps[laps['LapTime'].notna()]
    if 'IsAccurate' in laps.columns and laps['IsAccurate'].any():
        laps = laps[laps['IsAccurate']]
    laps = laps.copy()
    laps['_ord_drv'] = laps['DriverNumber'].astype(str)
    laps = laps.sort_values(['LapTime', '_ord_drv', 'LapNumber'])
    motivi = {}
    for _, lap in laps.iterrows():
        try:
            pos = lap.get_pos_data()
            if 'Status' in pos.columns:
                pos = pos[pos['Status'] == 'OnTrack']
        except Exception:
            continue
        ok, motivo, xy, diag = valida_giro(pos)
        if ok:
            return lap, xy, diag
        motivi[motivo.split('(')[0].strip()] = motivi.get(motivo.split('(')[0].strip(), 0) + 1
    if verboso and motivi:
        for m, q in sorted(motivi.items(), key=lambda kv: -kv[1]):
            print(f'      scartati {q} giri: {m}')
    return None, None, {}


def giro_del_disegno(nome, session=None, anno=ANNO):
    """IL RIGHELLO E' UNO SOLO: il nastro che la pagina DISEGNA.

    pista_<gara>.json porta in targhetta il giro esatto da cui la geometria e' stata
    ricavata (evento, sessione, pilota, giro). Chi deve MISURARE qualcosa su quel nastro
    — la frazione di giro del replay, i canali dell'overlay telemetrico — deve ripartire
    da QUEL giro, non ri-sceglierne uno per conto suo.

    NON E' PIGNOLERIA. All'Ungheria pista_Ungheria.json viene dal 2025 (il feed 2026 non
    ha un giro con GPS utilizzabile) mentre gen_replay.py ri-sceglieva dal 2026: per una
    stagione intera il replay ha misurato le frazioni su un righello diverso da quello
    disegnato, e la sua targhetta dichiarava «stesso giro di riferimento» — che era falso.

    Ritorna (lap, xy_distinti, targhetta_pista) oppure (None, None, {}) se la pista non
    c'e' o il giro dichiarato non e' piu' recuperabile.
    """
    perc = os.path.join('demo', 'data', f'pista_{nome}.json')
    if not os.path.exists(perc):
        return None, None, {}
    with open(perc) as f:
        pista = json.load(f)
    rif = pista.get('sorgente') or {}
    if not rif.get('pilota') or rif.get('giro') is None:
        return None, None, {}
    ev = str(rif.get('evento', ''))                      # "2025 Hungarian Grand Prix"
    pezzi = ev.split(' ', 1)
    anno_rif = int(pezzi[0]) if pezzi and pezzi[0].isdigit() else anno
    ti_rif = pezzi[1] if len(pezzi) > 1 else None
    sess_rif = rif.get('sessione', 'R')
    if session is not None and anno_rif == anno and sess_rif == 'R':
        s = session                                       # gia' caricata dal chiamante
    else:
        s = fastf1.get_session(anno_rif, ti_rif, sess_rif)
        s.load(laps=True, telemetry=True, weather=False, messages=False)
    sel = s.laps[(s.laps['Driver'] == rif['pilota'])
                 & (s.laps['LapNumber'] == int(rif['giro']))]
    if not len(sel):
        return None, None, {}
    lap = sel.iloc[0]
    pos = lap.get_pos_data()
    if 'Status' in pos.columns:
        pos = pos[pos['Status'] == 'OnTrack']
    ok, motivo, xy, _ = valida_giro(pos)
    if xy is None:
        return None, None, {}
    # il giro dichiarato puo' non passare piu' i controlli (li abbiamo irrigiditi): non e'
    # un motivo per cambiarlo — e' il nastro che la pagina disegna, e va usato com'e'.
    targhetta = dict(rif)
    targhetta['lunghezza_m'] = pista.get('lunghezza_m')
    targhetta['controlli'] = 'passa' if ok else f'non passa oggi ({motivo})'
    return lap, xy, targhetta


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


def genera(nome, reg, forza=False, sessione='R', anno=ANNO):
    dest = os.path.join('demo', 'data', f'pista_{nome}.json')
    ti = reg['ti']
    print(f'== {nome} ({ti}) ==')
    session = fastf1.get_session(anno, ti, sessione)
    session.load(laps=True, telemetry=True, weather=False, messages=False)
    lap, xy, diag = scegli_giro(session, verboso=True)
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
            'evento': f'{anno} {ti}', 'sessione': sessione,
            'pilota': str(lap['Driver']), 'giro': int(lap['LapNumber']),
            'lap_time_s': round(lap['LapTime'].total_seconds(), 3),
            'criterio': 'giro valido piu veloce con telemetria GPS pulita (vedi testa del generatore)',
            'rotazione_gradi': round(rot_gradi, 1),
            # la qualita' del feed su QUESTO giro, non solo quanti campioni erano: una
            # ripetizione non e' una misura, e il nastro e' il righello del replay
            # (campioni_gps = grezzi, campioni_distinti = quelli che il feed sapeva davvero)
            **diag,
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
    ap.add_argument('--sessione', default='R',
                    help="sessione FastF1 per la telemetria (default R; es. FP1 per "
                         "avere la pista del circuito nuovo gia' al venerdi' — "
                         "runbook live, Fase 3)")
    ap.add_argument('--anno', type=int, default=ANNO,
                    help=f"anno FastF1 della telemetria (default {ANNO}; es. l'anno "
                         "precedente per la PRE-costruzione di un circuito che non ha "
                         "ancora girato — runbook live)")
    ap.add_argument('--ti', help="nome evento FastF1 per una gara NON ancora a registro "
                                 "(pre-costruzione; es. 'Hungarian Grand Prix'). "
                                 "Il registro NON viene toccato.")
    ap.add_argument('--cid', help="codice circuito f1db per una gara NON a registro "
                                  "(es. hungaroring)")
    args = ap.parse_args()
    registro = carica_registro()
    nomi = [args.gara] if args.gara else list(registro)
    if args.gara and args.gara not in registro:
        if not args.ti:
            sys.exit(f'gara sconosciuta: {args.gara} (registro: {", ".join(registro)}); '
                     'per una pre-costruzione passare --ti (e --cid)')
        registro = dict(registro, **{args.gara: {'ti': args.ti, 'cid': args.cid}})
    esiti = {}
    for nome in nomi:
        try:
            esiti[nome] = genera(nome, registro[nome], sessione=args.sessione,
                                 anno=args.anno)
        except Exception as e:
            print(f'   ERRORE {nome}: {e}')
            esiti[nome] = False
    print('\nRIEPILOGO:', ', '.join(f'{n}={"OK" if v else "placeholder"}' for n, v in esiti.items()))
    if args.gara and not esiti.get(args.gara):
        sys.exit(1)


if __name__ == '__main__':
    main()
