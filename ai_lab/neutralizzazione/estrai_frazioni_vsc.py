"""estrai_frazioni_vsc.py — la FONTE NUOVA di PREREG_vsc_a_tempo.md, e nient'altro.

    python3 ai_lab/neutralizzazione/estrai_frazioni_vsc.py

Per le 11 gare 2026 del registro: finestre VSC/SC a tempo dal track_status FastF1
(orologio di sessione, lo stesso dei confini di giro) e frazione f(auto, giro) del
giro coperta da ciascun regime. Scrive frazioni_vsc_2026.json con targhetta.

QUESTO SCRIPT NON CALCOLA R_LAP: la statistica non rifa' mai il metro (regola 8).
Il metro e' misura_vsc_a_tempo.mjs, lo stesso di V1.

Cross-check dichiarato in prereg: il numero di finestre VSC dal track_status deve
coincidere col numero di coppie DEPLOYED/ENDING dei messaggi race control.
"""
import os, json
import fastf1

fastf1.Cache.enable_cache(os.path.expanduser('~/muretto_shared/ff1_cache'))
fastf1.set_log_level('ERROR')

QUI = os.path.dirname(os.path.abspath(__file__))
REG = json.load(open(os.path.join('data', 'gare_registro.json')))

VERDI = {'1', '2'}  # AllClear e Yellow chiudono una finestra di regime (la gialla non e' un regime)


def finestre_da_track_status(ts, fine_sessione):
    """[(inizio_s, fine_s, 'VSC'|'SC')] dal track_status. La coda Ending conta col
    suo regime (scelta misurata del live: Ending = regime pieno, 870/871)."""
    out = []
    aperta = None  # (inizio, regime)
    for _, r in ts.iterrows():
        t = r['Time'].total_seconds()
        s = str(r['Status'])
        regime = 'SC' if s == '4' else ('VSC' if s in ('6', '7') else None)
        if aperta is None:
            if regime is not None:
                aperta = (t, regime)
        else:
            if regime is None:
                out.append((aperta[0], t, aperta[1]))
                aperta = None
            elif regime != aperta[1]:              # passaggio diretto VSC->SC o viceversa
                out.append((aperta[0], t, aperta[1]))
                aperta = (t, regime)
    if aperta is not None:
        out.append((aperta[0], fine_sessione, aperta[1]))
    return out


def sovrapposizione(a0, a1, b0, b1):
    return max(0.0, min(a1, b1) - max(a0, b0))


def main():
    esito = {
        '_targhetta': {
            'cosa_e': "frazione di giro sotto VSC/SC per (gara, pilota, giro) — fonte: track_status FastF1 "
                      "(orologio di sessione) + confini di giro LapStartTime/Time. PREREG_vsc_a_tempo.md.",
            'generato_da': 'ai_lab/neutralizzazione/estrai_frazioni_vsc.py',
            'data': '2026-08-07',
            'finestra': "VSC = [VSCDeployed, primo verde); la coda Ending conta come regime pieno "
                        "(scelta misurata del live, 870/871)",
        },
        'gare': {},
    }
    for nome, v in REG.items():
        s = fastf1.get_session(2026, v['ti'], 'R')
        s.load(laps=True, telemetry=False, weather=False, messages=True)
        laps = s.laps
        fine = float(laps['Time'].max().total_seconds()) + 120.0
        fin = finestre_da_track_status(s.track_status, fine)
        # cross-check dichiarato: finestre VSC vs coppie DEPLOYED/ENDING dei messaggi
        m = s.race_control_messages
        dep = int(m['Message'].astype(str).str.contains('VSC DEPLOYED', case=False).sum())
        n_vsc = sum(1 for f in fin if f[2] == 'VSC')
        piloti = {}
        for drv in sorted(set(laps['Driver'].dropna())):
            perGiro = {}
            for _, l in laps.pick_drivers(drv).iterrows():
                if l['LapStartTime'] is None or l['Time'] is None:
                    continue
                try:
                    t0 = float(l['LapStartTime'].total_seconds())
                    t1 = float(l['Time'].total_seconds())
                except (TypeError, ValueError):
                    continue
                if not (t1 > t0):
                    continue
                cop = {'VSC': 0.0, 'SC': 0.0}
                for (w0, w1, reg) in fin:
                    cop[reg] += sovrapposizione(t0, t1, w0, w1)
                dur = t1 - t0
                perGiro[int(l['LapNumber'])] = {
                    'f_vsc': round(cop['VSC'] / dur, 4),
                    'f_sc': round(cop['SC'] / dur, 4),
                }
            piloti[drv] = perGiro
        esito['gare'][nome] = {
            'finestre': [{'da_s': round(a, 3), 'a_s': round(b, 3), 'regime': r} for (a, b, r) in fin],
            'crosscheck_vsc': {'finestre_track_status': n_vsc, 'deployed_race_control': dep,
                               'coincide': n_vsc == dep},
            'piloti': piloti,
        }
        print(f"{nome:<15} finestre VSC {n_vsc} (rc {dep}{'' if n_vsc == dep else ' — DIVERGE'}) · SC "
              f"{sum(1 for f in fin if f[2] == 'SC')}")
    out = os.path.join(QUI, 'frazioni_vsc_2026.json')
    with open(out, 'w') as fh:
        json.dump(esito, fh, indent=1, ensure_ascii=False)
        fh.write('\n')
    print(f"scritto {out}")


if __name__ == '__main__':
    main()
