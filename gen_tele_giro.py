"""gen_tele_giro.py — LA TELEMETRIA ANCORATA AL TRACCIATO, per tutte le gare.

Per ogni gara produce demo/data/tele_giro_<gara>.json: il giro piu' veloce di ogni pilota,
coi canali vettura (velocita', gas, freno, marcia) campionati non nel TEMPO ma lungo il
NASTRO — la stessa parametrizzazione di pista_<gara>.json. Serve a colorare il tracciato
col canale scelto: dove si sta a gas pieno, dove si frena, in che marcia si passa.

PERCHE' ESISTE, VISTO CHE C'E' GIA' gen_tele.py. Sono due cose diverse, e la differenza
e' la COPERTURA:
  - gen_tele.py legge le REGISTRAZIONI del collettore live (~/muretto/data/live_raw/), che
    stanno sul Mac, sono in .gitignore ed esistono solo per i weekend in cui il collettore
    girava: 6 sessioni su 2 Gran Premi;
  - questo legge FastF1 dalla cache locale, che copre 11 gare su 11 con 22 piloti ciascuna.
Il limite del 2 su 11 non era mai stato dei dati: era della SORGENTE. Sta scritto anche in
ai_lab/redazione/tele.py — «i canali auto FastF1 sono in cache ma NESSUNO script del repo
li estraeva» — e per lo stesso motivo il progetto di riferimento le aveva tutte.

PERCHE' ADESSO SI PUO' FARE, e prima no. Un canale disegnato sul tracciato dice «qui
andavi a 300». Finche' la posizione era una frazione di TEMPO (velocita' assunta uniforme
dentro il giro) quel «qui» era falso al metro, e sovrapporlo alla pista lo avrebbe
nascosto invece che dichiararlo. Da quando le posizioni sono misurate sul GPS
(gen_replay.py) il punto e' vero, e l'overlay diventa lecito.

CANALI 2026, MISURATI: velocita', gas, freno, marcia, giri motore. Il DRS NON c'e' — nel
2026 non esiste (Manual Override Mode), e infatti FastF1 lo riporta a zero. Non si esporta
un canale che non e' stato trasmesso.

Uso:  python3 gen_tele_giro.py [--gara Belgio] [--punti 200]
"""
import argparse, json, logging, os, sys, warnings

import numpy as np
import fastf1

import gen_pista_svg as G
import gen_replay as R

warnings.filterwarnings('ignore')
logging.getLogger('fastf1').setLevel(logging.ERROR)
fastf1.Cache.enable_cache(os.path.expanduser('~/muretto_shared/ff1_cache'))

ANNO = 2026
N_PUNTI = 200          # campioni lungo il giro: ~35 m a Spa, piu' fitto della resa a schermo
MIN_CAMPIONI = 50      # sotto questo un giro non descrive niente
MAX_CONFLITTO = 0.05   # quota massima di punti con gas pieno E freno: oltre, l'ancoraggio non tiene


def canali_del_giro(lap, proj, L):
    """Il giro di un pilota -> canali campionati lungo il NASTRO (frazione 0..1).
    Ritorna None se il giro non ha telemetria utilizzabile."""
    try:
        tel = lap.get_telemetry()
    except Exception:
        return None
    if tel is None or len(tel) < MIN_CAMPIONI:
        return None
    for c in ('X', 'Y', 'Speed', 'Throttle', 'Brake', 'nGear'):
        if c not in tel.columns:
            return None
    xy = np.column_stack([tel['X'].to_numpy(float), tel['Y'].to_numpy(float)])
    if not np.isfinite(xy).all():
        return None
    fr, lat = proj(xy)                       # frazione di giro di ogni campione
    # srotola: il giro parte dalla linea e ci torna
    ordine = np.argsort(fr)
    fr = fr[ordine]
    griglia = np.linspace(0.0, 1.0, N_PUNTI, endpoint=False)

    def campiona(nome, tipo=float):
        v = tel[nome].to_numpy(float)[ordine]
        return np.interp(griglia, fr, v)

    v = campiona('Speed')
    gas = campiona('Throttle')
    freno = campiona('Brake')                # booleano nel feed: qui frazione di campioni in frenata
    marcia = campiona('nGear')
    return {
        'giro': int(lap['LapNumber']),
        'tempo_s': round(float(lap['LapTime'].total_seconds()), 3),
        'v': [int(round(x)) for x in v],
        'gas': [int(round(x)) for x in np.clip(gas, 0, 100)],
        'freno': [int(round(x * 100)) for x in np.clip(freno, 0, 1)],
        'marcia': [int(round(x)) for x in np.clip(marcia, 0, 8)],
        'scarto_nastro_m': round(float(np.median(lat)) / 10.0, 1),
    }


def genera(nome, reg, anno=ANNO):
    ti = reg['ti']
    print(f'== {nome} ({ti}) ==')
    s = fastf1.get_session(anno, ti, 'R')
    s.load(laps=True, telemetry=True, weather=False, messages=False)

    # STESSO nastro di pista_<gara>.json e di replay_<gara>.json: l'overlay deve cadere
    # sulla polilinea che la pagina disegna davvero, non su una geometria parallela.
    # Lo dichiarava gia', ma ri-sceglieva il giro per conto suo e all'Ungheria finiva su
    # un nastro diverso: ora il giro lo legge dalla targhetta della pista (regola 1).
    lap_rif, xy, _targ = G.giro_del_disegno(nome, session=s, anno=anno)
    if lap_rif is None:
        print(f'   NIENTE: demo/data/pista_{nome}.json non dichiara un giro di riferimento '
              f'recuperabile — senza il nastro disegnato non c\'e\' overlay')
        return None
    punti, passi, L = R.nastro_fine(xy)
    proj = R.Proiettore(punti, passi, L)

    piloti, saltati = {}, []
    for sig in sorted(set(s.laps['Driver'])):
        gl = s.laps[s.laps['Driver'] == sig].pick_quicklaps() if hasattr(s.laps, 'pick_quicklaps') else None
        cand = s.laps[s.laps['Driver'] == sig]
        cand = cand[cand['LapTime'].notna()]
        if 'IsAccurate' in cand.columns and cand['IsAccurate'].any():
            cand = cand[cand['IsAccurate']]
        if not len(cand):
            saltati.append(sig); continue
        lap = cand.loc[cand['LapTime'].idxmin()]
        d = canali_del_giro(lap, proj, L)
        if d is None:
            saltati.append(sig); continue
        piloti[sig] = d

    if len(piloti) < 5:
        print(f'   NIENTE: solo {len(piloti)} piloti con telemetria utilizzabile')
        return None

    # IL GENERATORE CONTROLLA IL PROPRIO ANCORAGGIO, e non pubblica se non tiene.
    # Il segnale non ha bisogno di un arbitro esterno: gas a tavoletta e freno premuto
    # insieme e' una cosa che in un giro non succede (misurato: 0,2-3% dove l'ancoraggio
    # regge). Se la quota esplode, i campioni sono finiti nel punto sbagliato del nastro e
    # i canali si sovrappongono a caso — all'Ungheria fa il 13,8%, per la stessa deriva del
    # feed di posizione che le nega il replay a posizioni vere. Meglio nessun overlay che
    # un overlay che colora la frenata cento metri piu' in la'.
    conf = tot = 0
    for p in piloti.values():
        for g, f in zip(p['gas'], p['freno']):
            tot += 1
            if g > 80 and f > 50:
                conf += 1
    quota = conf / max(tot, 1)
    if quota > MAX_CONFLITTO:
        print(f'   DECLINATO: gas e freno insieme nel {quota:.1%} dei punti (soglia '
              f'{MAX_CONFLITTO:.0%}) — i canali non sono ancorati al tracciato in modo '
              f'affidabile, nessun overlay per questa gara')
        return None

    out = {
        '_nota': ('GENERATO da gen_tele_giro.py (FastF1 car_data). Il giro piu\' veloce di '
                  'ogni pilota, coi canali campionati lungo il NASTRO (stessa '
                  'parametrizzazione di pista_<gara>.json) invece che nel tempo: serve a '
                  'colorare il tracciato col canale. Il DRS non c\'e\' perche\' nel 2026 '
                  'non esiste. Non modificare a mano.'),
        'gara': nome,
        'n': N_PUNTI,
        'canali': {'v': 'km/h', 'gas': '% acceleratore', 'freno': '% campioni in frenata',
                   'marcia': 'rapporto'},
        'piloti': piloti,
        'sorgente': {
            'evento': f'{anno} {ti}', 'sessione': 'R',
            'nastro': f'pista_{nome}.json (riferimento {lap_rif["Driver"]} giro {int(lap_rif["LapNumber"])})',
            'criterio': 'giro piu veloce valido di ciascun pilota (IsAccurate dove disponibile)',
            'piloti_saltati': saltati,
            'fastf1': fastf1.__version__,
        },
    }
    dest = os.path.join('demo', 'data', f'tele_giro_{nome}.json')
    with open(dest, 'w') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
    kb = os.path.getsize(dest) / 1024
    scarti = [p['scarto_nastro_m'] for p in piloti.values()]
    print(f'   scritto {dest}: {len(piloti)} piloti, {N_PUNTI} punti/giro, {kb:.0f} KB '
          f'(scarto dal nastro mediano {np.median(scarti):.1f} m)'
          + (f', saltati {saltati}' if saltati else ''))
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--gara')
    ap.add_argument('--punti', type=int, default=N_PUNTI)
    ap.add_argument('--anno', type=int, default=ANNO)
    a = ap.parse_args()
    globals()['N_PUNTI'] = a.punti
    registro = G.carica_registro()
    nomi = [a.gara] if a.gara else list(registro)
    if a.gara and a.gara not in registro:
        sys.exit(f'gara sconosciuta: {a.gara}')
    esiti = {}
    for nome in nomi:
        try:
            esiti[nome] = genera(nome, registro[nome], anno=a.anno)
        except Exception as e:
            import traceback; traceback.print_exc()
            print(f'   ERRORE {nome}: {e}')
            esiti[nome] = False
    eti = {True: 'OK', None: 'niente', False: 'ERRORE'}
    print('\nRIEPILOGO:', ', '.join(f'{n}={eti[v]}' for n, v in esiti.items()))
    if any(v is False for v in esiti.values()):
        sys.exit(1)


if __name__ == '__main__':
    main()
