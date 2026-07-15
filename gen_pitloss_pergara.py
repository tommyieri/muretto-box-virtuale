#!/usr/bin/env python3
"""
gen_pitloss_pergara.py — Sessione FF5 (pre-registrata in PREREG_SESSIONE_FF5.md).

Pit-loss REALIZZATO per-gara delle 9 gare demo 2026: la grandezza che serve alla demo,
che rigioca gare specifiche ("se pitti al giro X, dove rientri IN QUELLA GARA").
Metodo FF4 invariato e IMPORTATO (giro intero, warm-in incluso; filtri FF2/FF3).

Controllo di riproducibilita' pre-registrato: le stime di scoping del 14/07 sono incise
qui sotto; se un valore ufficiale ne differisce di piu' di 0,2 s il generatore ESCE CON
ERRORE (generatore e scratchpad non calcolano la stessa cosa: diagnosi prima di tutto).

NON tocca alcun file di produzione. L'attivazione (F5.5) e' un'altra fase, dopo il
checkpoint PO. Scrive:
  - data/pitloss_realizzato_2026.csv  (una gara demo per riga)
  - data/pergara_stops.csv            (uno stop per riga, 9 circuiti, tutte le stagioni:
                                       la fonte per la tipicita' di demo/att6.mjs)

Uso:  python3 gen_pitloss_pergara.py
"""

import json
import sys
import numpy as np
import pandas as pd
import fastf1  # cache abilitata dagli import sotto

from gen_censimento_pitloss import events_for, classify, log, SEASONS
from gen_pitloss_engine_ready import collect_whole_lap

# --- soglie pre-registrate (PREREG_SESSIONE_FF5.md) ---------------------------
MIN_STOP = 5            # F5.2: sotto 5 stop validi -> NON MISURABILE (non si abbassa)
SOGLIA_CALIBRATA = 1.0  # F5.2: |prod - realizzato| <= 1,0 -> GIA' CALIBRATA
TOL_RIPRODUCIBILITA = 0.2

# stime di scoping dichiarate nel prereg (quadro del 14/07, scratchpad)
STIME = {'Australia': 24.10, 'Cina': 34.51, 'Giappone': 22.79, 'Miami': 20.11,
         'Canada': 24.24, 'Monaco': 22.61, 'Spagna': 24.59, 'Austria': 21.98,
         'Gran Bretagna': 20.43}

DEMO = [  # (cid, keys calendario, nome gara demo = chiave di pitloss.json)
    ('melbourne',   ['melbourne'],            'Australia'),
    ('shanghai',    ['shanghai'],             'Cina'),
    ('suzuka',      ['suzuka'],               'Giappone'),
    ('miami',       ['miami'],                'Miami'),
    ('montreal',    ['montr'],                'Canada'),
    ('monaco',      ['monte', 'monaco'],      'Monaco'),
    ('catalunya',   ['barcelona', 'montmel'], 'Spagna'),
    ('spielberg',   ['spielberg'],            'Austria'),
    ('silverstone', ['silverstone'],          'Gran Bretagna'),
]

PROD = json.load(open('demo/data/pitloss.json'))


def med(v):
    v = [x for x in v if x is not None and not np.isnan(x)]
    return float(np.median(v)) if v else np.nan


def main():
    tabella, per_stop = [], []
    for cid, keys, nome in DEMO:
        circ = dict(cid=cid, keys=keys)
        rows_all = []
        for y in SEASONS:
            for rnd, name, date in events_for(circ, y):
                label = f'{y}-r{rnd}'
                try:
                    s = fastf1.get_session(y, rnd, 'R')
                    s.load(laps=True, telemetry=False, weather=True, messages=False)
                    cond, fw, fr, _ = classify(s)
                    rows, dg = collect_whole_lap(s, cid, y, label)
                    # riconciliazione esatta (regola di sempre)
                    n_valid = sum(1 for r in rows if r.get('escluso') == '')
                    scarti = sum(v for k, v in dg.items() if k != 'stop_grezzi')
                    if n_valid + scarti != dg['stop_grezzi']:
                        sys.exit(f'RICONCILIAZIONE FALLITA {cid} {label}: '
                                 f'{dg["stop_grezzi"]} != {n_valid}+{scarti}. STOP.')
                    for r in rows:
                        r['condizione'] = cond
                    rows_all += rows
                except Exception as e:
                    log(f'  [{cid}] {label} skip: {type(e).__name__}: {e}')
        valid = [r for r in rows_all if r.get('escluso') == '']
        per_stop += valid
        df = pd.DataFrame(valid)

        g26 = df[df['stagione'] == 2026] if len(df) else df
        realized = med(list(g26['pit_loss'])) if len(g26) else np.nan
        iqr = (float(np.percentile(g26['pit_loss'], 75) - np.percentile(g26['pit_loss'], 25))
               if len(g26) >= 2 else np.nan)
        cond26 = g26['condizione'].iloc[0] if len(g26) else '-'
        storico = df[(df['stagione'] <= 2025) & (df['condizione'] == 'DRY')] if len(df) else df
        blocchi = [med(list(v['pit_loss'])) for _, v in storico.groupby('gara')] if len(storico) else []
        tipico = float(np.median(blocchi)) if blocchi else np.nan
        prod = PROD[nome]
        delta = prod - realized if not np.isnan(realized) else np.nan

        # F5.1: controllo di riproducibilita' (pre-registrato, esce con errore)
        stima = STIME[nome]
        if np.isnan(realized) or abs(realized - stima) > TOL_RIPRODUCIBILITA:
            sys.exit(f'RIPRODUCIBILITA VIOLATA su {nome}: ufficiale '
                     f'{realized:.2f} vs stima {stima:.2f} (tol {TOL_RIPRODUCIBILITA}). STOP.')

        # F5.2: classificazione (precedenza pre-registrata)
        if len(g26) < MIN_STOP:
            classe = 'NON MISURABILE'
        elif abs(delta) <= SOGLIA_CALIBRATA:
            classe = 'GIA CALIBRATA'
        else:
            classe = 'DA ATTIVARE'

        tabella.append(dict(gara=nome, circuito=cid, condizione_2026=cond26,
                            n_stop_2026=len(g26), realizzato=round(realized, 2),
                            iqr_2026=round(iqr, 2) if not np.isnan(iqr) else None,
                            tipico_2018_2025=round(tipico, 2) if not np.isnan(tipico) else None,
                            n_blocchi_storico=len(blocchi), produzione=prod,
                            delta_prod_realizzato=round(delta, 2), classe=classe))
        log(f'[{cid}] {nome}: realizzato {realized:.2f} (n={len(g26)}) -> {classe}')

    tdf = pd.DataFrame(tabella)
    tdf.to_csv('data/pitloss_realizzato_2026.csv', index=False)
    scols = ['circuito', 'stagione', 'gara', 'condizione', 'pilota', 'giro',
             'pit_lane_time', 'delta_inlap', 'delta_outlap', 'pit_loss']
    pd.DataFrame(per_stop).reindex(columns=scols).to_csv(
        'data/pergara_stops.csv', index=False, float_format='%.4f')

    print('\n' + tdf.to_string(index=False))
    print('\nclassi:', tdf['classe'].value_counts().to_dict())
    print('[scritto] data/pitloss_realizzato_2026.csv + data/pergara_stops.csv '
          f'({len(per_stop)} stop)')
    print('Riproducibilita: TUTTE le 9 gare entro '
          f'{TOL_RIPRODUCIBILITA} s dalle stime dichiarate (altrimenti sarei uscito con errore).')


if __name__ == '__main__':
    main()
