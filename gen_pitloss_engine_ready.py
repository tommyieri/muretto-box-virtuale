#!/usr/bin/env python3
"""
gen_pitloss_engine_ready.py — Sessione FF4 (pre-registrata in PREREG_SESSIONE_FF4.md).

Pit-loss ENGINE-READY: delta sul GIRO INTERO (warm-in incluso per costruzione), che e' la
grandezza che il motore applica come costo totale del pittare. FF2/FF3 sommavano solo i
settori sopra soglia -> LIMITE INFERIORE (diagnosi del fallimento ATT6 a Montreal).

Gli helper di scarico/classificazione/stazionarieta'/bootstrap sono IMPORTATI dal generatore
FF3 committato: il metodo non puo' divergere da quello gia' validato. L'unica cosa nuova qui
e' la misura (giro intero invece che settori) e il set di veti (vedi prereg).

NON tocca file di produzione. NESSUNA attivazione. Scrive:
  - data/pitloss_engine_ready.csv   (un circuito per riga)
  - data/engine_ready_stops.csv     (uno stop per riga)

Uso:  python3 gen_pitloss_engine_ready.py
"""

import sys
import numpy as np
import pandas as pd

from gen_censimento_pitloss import (
    secs, is_green, classify, events_for, boot_unweighted, stint_frame,
    STATIONARITY_TOL, MIN_GREEN_LAPS, OUT_REF_POS, MIN_OUT_REF, MIN_DRY_BLOCKS,
    MAX_STAT_EXCL, GO_WIDTH, NO_WIDTH, GO_RATIO, CALIB_GAIN, SECTORS, SEASONS, log,
)
import fastf1  # noqa: F401  (la cache e' gia' abilitata dall'import sopra)

# --- costanti pre-registrate specifiche FF4 ---------------------------------
SIL_TOL = 1.5          # F4.0: |engine_ready - 20,80| > 1,5 -> ROLLBACK e STOP
SIL_PROD = 20.80
MAX_NONPOS_FRAC = 0.10  # >10% stop dry con pit_loss <= 0 -> NON MISURABILE

CIRCUITS = [
    dict(cid='silverstone',       keys=['silverstone'], prod=20.80, ff3=20.80, bloccante=True),
    dict(cid='montreal',          keys=['montr'],       prod=24.37, ff3=18.96),
    dict(cid='spa-francorchamps', keys=['spa'],         prod=23.36, ff3=19.04),
    dict(cid='austin',            keys=['austin'],      prod=24.25, ff3=20.57),
]


def lap_seconds(row):
    """LapTime in secondi. Se FastF1 lascia LapTime a NaN ma i tre settori ci sono, si usa
    S1+S2+S3: e' la stessa grandezza per definizione (verificato in FF). Regola pre-registrata."""
    t = secs(row['LapTime'])
    if not np.isnan(t):
        return t
    s = [secs(row[c]) for c in SECTORS]
    if all(not np.isnan(x) for x in s):
        return float(sum(s))
    return np.nan


def collect_whole_lap(session, cid, year, label):
    """Come collect() di FF3 ma la misura e' il delta sul GIRO INTERO.
    Nessuna selezione di settori: il giro cattura il warm-in ovunque cada."""
    laps = stint_frame(session.laps)
    laps['lap_s'] = laps.apply(lap_seconds, axis=1)
    last_lap = laps['LapNumber'].max()
    rows = []
    diag = {'stop_grezzi': 0, 'no_timestamp': 0, 'drive_through': 0, 'primo_ultimo': 0,
            'non_verde': 0, 'stint_corto': 0, 'giro_nan': 0}

    for drv, d in laps.groupby('Driver'):
        d = d.sort_values('LapNumber')
        idx = list(d.index)
        for k, i in enumerate(idx):
            row = d.loc[i]
            if pd.isna(row['PitInTime']):
                continue
            diag['stop_grezzi'] += 1
            if k + 1 >= len(idx):
                diag['no_timestamp'] += 1
                continue
            nxt = d.loc[idx[k + 1]]
            if pd.isna(nxt['PitOutTime']) or nxt['LapNumber'] != row['LapNumber'] + 1:
                diag['no_timestamp'] += 1
                continue
            # drive-through: rilevatore FF3 (gomma che continua a invecchiare, o Stint invariato)
            same_stint = (pd.notna(row['Stint']) and pd.notna(nxt['Stint'])
                          and nxt['Stint'] == row['Stint'])
            tyre_kept = (pd.notna(row['TyreLife']) and pd.notna(nxt['TyreLife'])
                         and nxt['Compound'] == row['Compound']
                         and nxt['TyreLife'] == row['TyreLife'] + 1)
            if same_stint or tyre_kept:
                diag['drive_through'] += 1
                continue
            plt_ = secs(nxt['PitOutTime']) - secs(row['PitInTime'])
            if row['LapNumber'] <= 1 or nxt['LapNumber'] >= last_lap:
                diag['primo_ultimo'] += 1
                continue

            base = dict(circuito=cid, stagione=year, gara=label, pilota=drv,
                        giro=int(row['LapNumber']), pit_lane_time=plt_,
                        compound_in=row['Compound'])
            if not (row['green'] and nxt['green']):
                diag['non_verde'] += 1
                rows.append({**base, 'escluso': 'non_verde'})
                continue
            st_in = d[(d['Stint'] == row['Stint']) & d['usable_ref']]
            st_out_all = d[(d['Stint'] == nxt['Stint']) & d['usable_ref']]
            if len(st_in) < MIN_GREEN_LAPS or len(st_out_all) < MIN_GREEN_LAPS:
                diag['stint_corto'] += 1
                rows.append({**base, 'escluso': 'stint_corto'})
                continue
            st_out = st_out_all[(st_out_all['pos_in_stint'] >= OUT_REF_POS[0]) &
                                (st_out_all['pos_in_stint'] <= OUT_REF_POS[1])]
            if len(st_out) < MIN_OUT_REF:
                diag['stint_corto'] += 1
                rows.append({**base, 'escluso': 'out_ref_corto'})
                continue

            v_in, v_out = row['lap_s'], nxt['lap_s']
            m_in = st_in['lap_s'].median()
            m_out = st_out['lap_s'].median()
            if any(np.isnan(x) for x in (v_in, v_out, m_in, m_out)):
                diag['giro_nan'] += 1
                rows.append({**base, 'escluso': 'giro_nan'})
                continue
            d_in, d_out = v_in - m_in, v_out - m_out
            rows.append({**base, 'escluso': '', 'delta_inlap': d_in, 'delta_outlap': d_out,
                         'pit_loss': d_in + d_out, 'n_ref_in': len(st_in),
                         'n_ref_out': len(st_out)})
    return rows, diag


def measure(circ):
    cid = circ['cid']
    races, all_rows, diags = [], [], {}
    for y in SEASONS:
        for rnd, name, date in events_for(circ, y):
            label = f'{y}-r{rnd}'
            try:
                s = fastf1.get_session(y, rnd, 'R')
                s.load(laps=True, telemetry=False, weather=True, messages=False)
                cond, fw, fr, has_w = classify(s)
                rows, dg = collect_whole_lap(s, cid, y, label)
                races.append(dict(label=label, year=y, date=date, cond=cond))
                all_rows += rows
                diags[label] = dg
                log(f'  [{cid}] {label} "{name}": {cond}, {dg["stop_grezzi"]} grezzi')
            except Exception as e:
                log(f'  [{cid}] {label} NON caricabile: {type(e).__name__}: {e}')
    df = pd.DataFrame(all_rows)
    note = []
    if not len(df):
        return dict(circuito=cid, verdetto='NON ESEGUIBILE', note='nessuna gara'), df

    # riconciliazione esatta
    tot_raw = sum(d['stop_grezzi'] for d in diags.values())
    keys = ['no_timestamp', 'drive_through', 'primo_ultimo', 'non_verde', 'stint_corto',
            'giro_nan']
    n_valid = int((df['escluso'] == '').sum())
    somma = n_valid + sum(sum(d[k] for d in diags.values()) for k in keys)
    if somma != tot_raw:
        sys.exit(f'RICONCILIAZIONE FALLITA su {cid}: grezzi {tot_raw} != somma {somma}. STOP.')
    log(f'  [{cid}] riconciliazione OK: {tot_raw} = {n_valid} validi + scarti')

    # stazionarieta' (identica a FF3)
    plt_med, usable = {}, []
    for r in races:
        v = df[df['gara'] == r['label']]['pit_lane_time'].dropna()
        if len(v):
            plt_med[r['label']] = float(v.median())
            usable.append(r)
    excl_stat = []
    for r in usable:
        others = [plt_med[o['label']] for o in usable if o['label'] != r['label']]
        if others and abs(plt_med[r['label']] - float(np.median(others))) > STATIONARITY_TOL:
            excl_stat.append(r['label'])
    layout_from = min((r['year'] for r in usable), default=None)
    if excl_stat:
        inc = [r for r in usable if r['label'] not in excl_stat]
        exc = [r for r in usable if r['label'] in excl_stat]
        if inc and exc and max(r['date'] for r in exc) < min(r['date'] for r in inc):
            layout_from = min(r['year'] for r in inc)
            note.append(f'cambio layout: escluse {sorted(excl_stat)}; layout dal {layout_from}')
        elif len(excl_stat) > MAX_STAT_EXCL:
            return dict(circuito=cid, verdetto='NON MISURABILE',
                        note=f'stazionarieta non spiegabile: {sorted(excl_stat)}'), df
        else:
            note.append(f'escluse per stazionarieta: {sorted(excl_stat)}')

    cond_map = {r['label']: r['cond'] for r in races}
    valid = df[(df['escluso'] == '') & (~df['gara'].isin(excl_stat))].copy()
    valid['condizione'] = valid['gara'].map(cond_map)

    res = dict(circuito=cid, produzione=circ['prod'], ff3_settori=circ['ff3'],
               layout_dal=layout_from)
    stats = {}
    for cond in ('DRY', 'WET'):
        sub = valid[valid['condizione'] == cond]
        blocks, labels = [], []
        for lbl in sorted(sub['gara'].unique()):
            b = sub[sub['gara'] == lbl]['pit_loss'].dropna().values
            if len(b):
                blocks.append(b)
                labels.append(lbl)
        st = dict(n_blocchi=len(blocks), n_stop=sum(len(b) for b in blocks),
                  labels=labels, blocks=blocks)
        if blocks:
            st['mediana'] = float(np.median([np.median(b) for b in blocks]))
            if len(blocks) >= 2:
                st['lo'], st['hi'] = boot_unweighted(blocks)
        stats[cond] = st

    dry = stats['DRY']
    d_sub = valid[valid['condizione'] == 'DRY']
    plt_dry = float(d_sub['pit_lane_time'].median()) if len(d_sub) else np.nan
    res.update(pit_lane_time=round(plt_dry, 2) if not np.isnan(plt_dry) else None,
               n_blocchi=dry['n_blocchi'], n_stop=dry['n_stop'],
               wet_mediana=round(stats['WET']['mediana'], 2) if 'mediana' in stats['WET'] else None,
               wet_blocchi=stats['WET']['n_blocchi'])
    res['_blocchi_dry'] = list(zip(dry['labels'], [float(np.median(b)) for b in dry['blocks']]))

    # veto pre-registrato: pit_loss > 0 (il veto <= pit_lane_time CADE, vedi prereg)
    n_nonpos = int((d_sub['pit_loss'] <= 0).sum())
    frac = n_nonpos / len(d_sub) if len(d_sub) else 0.0
    res['stop_nonpos'] = f'{n_nonpos}/{len(d_sub)}'
    if 'mediana' in dry:
        res.update(pit_loss_engine=round(dry['mediana'], 2),
                   track_time=round(plt_dry - dry['mediana'], 2),
                   viol_lane=int((d_sub['pit_loss'] > d_sub['pit_lane_time']).sum()),
                   warmin_fuori_settori=round(dry['mediana'] - circ['ff3'], 2))
    if frac > MAX_NONPOS_FRAC:
        res['verdetto'] = 'NON MISURABILE'
        note.append(f'{n_nonpos}/{len(d_sub)} stop dry con pit_loss <= 0 (>10%): rumore')
        res['note'] = '; '.join(note)
        return res, valid
    if dry['n_blocchi'] < MIN_DRY_BLOCKS:
        res['verdetto'] = 'NON ESEGUIBILE'
        note.append(f'mancano {MIN_DRY_BLOCKS - dry["n_blocchi"]} blocchi dry')
        res['note'] = '; '.join(note)
        return res, valid

    lo, hi = dry['lo'], dry['hi']
    width, gain = hi - lo, circ['prod'] - dry['mediana']
    ratio = abs(gain) / (width / 2) if width > 0 else np.inf
    res.update(ic95=f'[{lo:.2f} - {hi:.2f}]', larghezza=round(width, 2),
               guadagno=round(gain, 2), rapporto=round(ratio, 1))
    if abs(gain) <= CALIB_GAIN and width <= NO_WIDTH:
        res['verdetto'] = "GIA' CALIBRATO"
    elif width <= GO_WIDTH and ratio >= GO_RATIO:
        res['verdetto'] = 'GO'
    elif width <= NO_WIDTH:
        res['verdetto'] = 'AMBIGUO'
    else:
        res['verdetto'] = 'NO'
    res['note'] = '; '.join(note)
    return res, valid


def main():
    out, frames = [], []
    for circ in CIRCUITS:
        log(f'=== {circ["cid"]} ===')
        row, stops = measure(circ)
        out.append(row)
        if len(stops):
            frames.append(stops)

        if circ.get('bloccante'):
            # ---- F4.0: test bloccante di Silverstone ----
            val = row.get('pit_loss_engine')
            print('\n' + '=' * 72)
            print('F4.0 — TEST BLOCCANTE SILVERSTONE (soglia pre-registrata 1,5 s)')
            if val is None:
                print('  engine-ready NON CALCOLABILE -> non si puo confermare il 20,80. STOP.')
                esito = 'NON CALCOLABILE -> STOP'
            else:
                delta = abs(val - SIL_PROD)
                print(f'  engine-ready = {val:.2f}   produzione = {SIL_PROD:.2f}   '
                      f'|delta| = {delta:.2f} s   (blocchi dry {row["n_blocchi"]}, '
                      f'stop {row["n_stop"]})')
                esito = 'CONFERMATO' if delta <= SIL_TOL else 'ROLLBACK'
                print(f'  -> {esito}')
            print('=' * 72 + '\n')
            if val is None or abs(val - SIL_PROD) > SIL_TOL:
                print('F4.0 FALLITO: il valore in produzione e sbagliato. Si riporta ROLLBACK '
                      'e CI SI FERMA.\nMontreal, Spa e Austin NON vengono misurati '
                      '(regola pre-registrata).')
                pd.DataFrame(out).to_csv('data/pitloss_engine_ready.csv', index=False)
                if frames:
                    pd.concat(frames, ignore_index=True).to_csv(
                        'data/engine_ready_stops.csv', index=False, float_format='%.4f')
                sys.exit(2)

    cdf = pd.DataFrame(out)
    for _, r in cdf.iterrows():
        print(f'\n--- {r["circuito"]} ---')
        print(f'  blocchi dry: {r.get("_blocchi_dry")}')
        print(f'  engine-ready {r.get("pit_loss_engine")}  IC95 {r.get("ic95")} '
              f'largh {r.get("larghezza")}  n blocchi {r.get("n_blocchi")} stop {r.get("n_stop")}')
        print(f'  produzione {r.get("produzione")}  guadagno {r.get("guadagno")}  '
              f'rapporto {r.get("rapporto")}  -> {r.get("verdetto")}')
        print(f'  FF3 settori {r.get("ff3_settori")}  warm-in fuori dai settori '
              f'{r.get("warmin_fuori_settori")}')
        print(f'  [diagnostica] lane {r.get("pit_lane_time")} track_time {r.get("track_time")} '
              f'viol_lane {r.get("viol_lane")}  stop<=0 {r.get("stop_nonpos")}  '
              f'wet {r.get("wet_mediana")} ({r.get("wet_blocchi")} blocchi)')
        if r.get('note'):
            print(f'  note: {r["note"]}')

    cdf.drop(columns=['_blocchi_dry']).to_csv('data/pitloss_engine_ready.csv', index=False)
    scols = ['circuito', 'stagione', 'gara', 'condizione', 'pilota', 'giro', 'pit_lane_time',
             'delta_inlap', 'delta_outlap', 'pit_loss']
    pd.concat(frames, ignore_index=True).reindex(columns=scols).to_csv(
        'data/engine_ready_stops.csv', index=False, float_format='%.4f')
    print('\n[scritto] data/pitloss_engine_ready.csv + data/engine_ready_stops.csv')
    print('riepilogo:', cdf['verdetto'].value_counts().to_dict())


if __name__ == '__main__':
    main()
