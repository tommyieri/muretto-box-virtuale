#!/usr/bin/env python3
"""
gen_pitloss_fastf1_esteso.py — Sessione FF2 (pre-registrata in PREREG_SESSIONE_FF2.md).

Estende la Sessione FF a Silverstone 2018-2026 con la decisione di dominio del PO:
dry e wet sono DUE parametri fisici distinti. Il verdetto si emette solo su pit_loss_dry;
pit_loss_wet si misura e si archivia senza soglie.

NON tocca alcun file di produzione. NON corregge nulla. Scrive solo:
  - data/fastf1_silverstone_stops_esteso.csv
  - data/pitloss_silverstone_dry_wet.csv
  - (i numeri del REPORT su stdout)

Uso:  python3 gen_pitloss_fastf1_esteso.py
"""

import logging
import os
import sys
import numpy as np
import pandas as pd
import fastf1

logging.getLogger('fastf1').setLevel(logging.ERROR)
# cache in sede stabile, fuori dal repo e da ogni worktree (vedi SETUP_AMBIENTE.md)
fastf1.Cache.enable_cache(os.path.expanduser('~/muretto_shared/ff1_cache'))

SEASONS = list(range(2018, 2027))
LOCATION = 'Silverstone'

# --- costanti pre-registrate (PREREG_SESSIONE_FF2.md) ------------------------
WET_COMPOUNDS = {'INTERMEDIATE', 'WET'}
WET_COMPOUND_FRAC = 0.20   # F2.0 criterio A: gara wet-per-mescole se >=20% giri-pilota su inter/wet
RAIN_FRAC = 0.20           # F2.0 criterio B: gara wet-per-meteo se >=20% campioni con Rainfall=True
STATIONARITY_TOL = 2.0     # F2.2: gara esclusa se |mediana - mediana(altre)| > 2,0 s
MAX_EXCLUDED = 3           # F2.2: piu' di 3 escluse -> STOP, pooling non legittimo
AFFECT_THRESHOLD = 1.0     # F2.3: |delta mediano| >= 1,0 s -> settore affetto (invariata da FF)
MAX_AFFECTED = 2           # F2.3: gara con >2 settori affetti -> non misurabile, esclusa
MIN_GREEN_LAPS = 4         # stint con meno di 4 giri verdi di riferimento -> escluso
OUT_REF_POS = (2, 5)       # riferimento out-lap: giri 2-5 del nuovo stint (mai il giro 1)
MIN_OUT_REF = 2
MIN_DRY_BLOCKS = 5         # F2.5: sotto 5 blocchi dry -> NON ESEGUIBILE (non si abbassa a 4)
N_BOOT = 10000
SECTORS = ['Sector1Time', 'Sector2Time', 'Sector3Time']
SLABEL = {'Sector1Time': 'S1', 'Sector2Time': 'S2', 'Sector3Time': 'S3'}

rng = np.random.default_rng(20260714)


def secs(td):
    if pd.isna(td):
        return np.nan
    return td.total_seconds()


def is_green(track_status):
    """Verde = lo status contiene SOLO '1' (vocabolario FIA: 1 verde, 2 giallo, 4 SC,
    5 rossa, 6 VSC, 7 fine VSC; TrackStatus e' la concatenazione degli stati del giro)."""
    if pd.isna(track_status):
        return False
    return set(str(track_status)) <= {'1'}


def silverstone_events(year):
    """Tutte le gare a Silverstone dell'anno, per LOCALITA' (nel 2020 sono DUE:
    British GP e 70th Anniversary GP -> due blocchi distinti)."""
    sch = fastf1.get_event_schedule(year, include_testing=False)
    rows = sch[sch['Location'].str.contains(LOCATION, case=False, na=False)]
    return [(int(r['RoundNumber']), str(r['EventName'])) for _, r in rows.iterrows()]


def classify(session):
    """F2.0 — classificazione DRY/WET/MISTA, congelata PRIMA di qualsiasi pit-loss.
    Criterio A: mescole. Criterio B: Rainfall in weather_data. DRY/WET solo se concordano."""
    laps = session.laps
    comp = laps['Compound'].dropna()
    frac_wet_comp = float(comp.isin(WET_COMPOUNDS).mean()) if len(comp) else np.nan
    a_wet = frac_wet_comp >= WET_COMPOUND_FRAC

    wd = session.weather_data
    if wd is not None and len(wd) and 'Rainfall' in wd.columns:
        frac_rain = float(wd['Rainfall'].astype(bool).mean())
        b_wet = frac_rain >= RAIN_FRAC
        if a_wet and b_wet:
            cond = 'WET'
        elif (not a_wet) and (not b_wet):
            cond = 'DRY'
        else:
            cond = 'MISTA'
        return cond, frac_wet_comp, frac_rain, True
    # weather non disponibile: solo criterio A, dichiarato (nessuna MISTA possibile)
    return ('WET' if a_wet else 'DRY'), frac_wet_comp, np.nan, False


def stint_frame(laps):
    df = laps.copy()
    df['green'] = df['TrackStatus'].apply(is_green)
    df['stint_start'] = df.groupby(['Driver', 'Stint'])['LapNumber'].transform('min')
    df['pos_in_stint'] = df['LapNumber'] - df['stint_start'] + 1
    # IsAccurate SOLO sui giri di riferimento, MAI sugli in/out-lap (che sono
    # False per definizione in FastF1: il filtro letterale azzera il campione).
    df['usable_ref'] = (df['green'] & (df['IsAccurate'] == True)
                        & df['PitInTime'].isna() & df['PitOutTime'].isna())
    for c in SECTORS:
        df[c + '_s'] = df[c].apply(secs)
    return df


def collect(session, year, label):
    """Righe-stop di una gara. PitIn (in-lap) accoppiato con PitOut (out-lap successivo
    dello stesso pilota): stanno su RIGHE DIVERSE (verificato in FF)."""
    laps = stint_frame(session.laps)
    last_lap = laps['LapNumber'].max()
    rows = []
    diag = {'stop_grezzi': 0, 'no_timestamp': 0, 'primo_ultimo': 0,
            'non_verde': 0, 'stint_corto': 0, 'settori_nan': 0}

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

            plt_ = secs(nxt['PitOutTime']) - secs(row['PitInTime'])

            if row['LapNumber'] <= 1 or nxt['LapNumber'] >= last_lap:
                diag['primo_ultimo'] += 1
                continue

            base = dict(gara=label, stagione=year, pilota=drv,
                        giro=int(row['LapNumber']), pit_lane_time=plt_,
                        compound_in=row['Compound'], compound_out=nxt['Compound'])

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

            rec = {**base, 'escluso': '', 'n_ref_in': len(st_in), 'n_ref_out': len(st_out)}
            nan_hit = False
            for c in SECTORS:
                v_in, v_out = row[c + '_s'], nxt[c + '_s']
                m_in = st_in[c + '_s'].median()
                m_out = st_out[c + '_s'].median()
                if any(np.isnan(x) for x in (v_in, v_out, m_in, m_out)):
                    nan_hit = True
                rec['d_in_' + SLABEL[c]] = v_in - m_in
                rec['d_out_' + SLABEL[c]] = v_out - m_out
            if nan_hit:
                diag['settori_nan'] += 1
                rec['escluso'] = 'settori_nan'
            rows.append(rec)
    return rows, diag


def boot_unweighted(blocks):
    """IC95 F2.4: blocchi CONTATI COME BLOCCHI — mediana delle mediane di gara,
    MAI pesata per numero di stop (la lezione di FF, incisa nel prereg)."""
    nb = len(blocks)
    block_meds = [np.median(b) for b in blocks]
    meds = [np.median([block_meds[j] for j in rng.integers(0, nb, nb)])
            for _ in range(N_BOOT)]
    return float(np.percentile(meds, 2.5)), float(np.percentile(meds, 97.5))


def boot_pooled(blocks):
    """Bootstrap POOLED (pesato per stop): SOLO per confronto, MAI per il verdetto."""
    nb = len(blocks)
    meds = [np.median(np.concatenate([blocks[j] for j in rng.integers(0, nb, nb)]))
            for _ in range(N_BOOT)]
    return float(np.percentile(meds, 2.5)), float(np.percentile(meds, 97.5))


def main():
    # ---------------- F2.1 — scarico ----------------
    print('===== F2.1 — scarico Silverstone 2018-2026 =====')
    races = []   # (label, year, session)
    for y in SEASONS:
        try:
            evs = silverstone_events(y)
        except Exception as e:
            print(f'  {y}: calendario NON disponibile ({type(e).__name__}: {e})')
            continue
        if not evs:
            print(f'  {y}: nessuna gara a Silverstone in calendario')
            continue
        for rnd, name in evs:
            label = f'{y}-{ "70th" if "70th" in name else "BGP" }'
            try:
                s = fastf1.get_session(y, rnd, 'R')
                s.load(laps=True, telemetry=False, weather=True, messages=False)
                races.append((label, y, name, s))
                print(f'  {label}: "{name}" (round {rnd}) caricata, {len(s.laps)} giri-pilota')
            except Exception as e:
                print(f'  {label}: "{name}" NON caricabile ({type(e).__name__}: {e})')
    if len([1 for l, *_ in races if l.startswith('2020')]) == 2:
        print('  NOTA: 2020 ha DUE gare a Silverstone -> DUE BLOCCHI DISTINTI (pre-registrato).')

    # ---------------- F2.0 — classificazione (PRIMA di ogni pit-loss) ----------------
    print('\n===== F2.0 — classificazione DRY/WET (congelata PRIMA dei pit-loss) =====')
    print(f'{"gara":>10} {"%giri inter/wet":>16} {"%campioni pioggia":>18} {"meteo disp.":>12} {"condizione":>11}')
    cond_map = {}
    for label, y, name, s in races:
        cond, fw, fr, has_w = classify(s)
        cond_map[label] = cond
        fr_txt = f'{100*fr:.0f}%' if not np.isnan(fr) else 'n/d'
        print(f'{label:>10} {100*fw:>15.0f}% {fr_txt:>18} {("si" if has_w else "NO (solo mescole)"):>12} {cond:>11}')
    print('\nDRY  :', [l for l in cond_map if cond_map[l] == 'DRY'])
    print('WET  :', [l for l in cond_map if cond_map[l] == 'WET'])
    print('MISTE:', [l for l in cond_map if cond_map[l] == 'MISTA'], '(escluse da entrambi i panieri)')

    # ---------------- raccolta stop ----------------
    all_rows, diags = [], {}
    for label, y, name, s in races:
        r, dg = collect(s, y, label)
        all_rows += r
        diags[label] = dg
    df = pd.DataFrame(all_rows)
    df['condizione'] = df['gara'].map(cond_map)

    # riconciliazione aritmetica obbligatoria
    print('\n===== riconciliazione scarti (totale grezzo = usati + scarti, esatta) =====')
    tot_raw = sum(d['stop_grezzi'] for d in diags.values())
    keys = ['no_timestamp', 'primo_ultimo', 'non_verde', 'stint_corto', 'settori_nan']
    tot_sc = {k: sum(d[k] for d in diags.values()) for k in keys}
    n_valid = int((df['escluso'] == '').sum())
    somma = n_valid + sum(tot_sc.values())
    print(f'  grezzi {tot_raw} = validi {n_valid} + ' +
          ' + '.join(f'{k} {v}' for k, v in tot_sc.items()) +
          f'  -> somma {somma} {"OK" if somma == tot_raw else "*** NON TORNA ***"}')
    if somma != tot_raw:
        sys.exit('RICONCILIAZIONE FALLITA: aritmetica degli scarti non torna. STOP.')

    # ---------------- F2.2 — stazionarieta' (VETO) ----------------
    print('\n===== F2.2 — stazionarieta pit_lane_time (VETO) =====')
    print(f'{"gara":>10} {"n":>4} {"mediana":>9} {"IQR":>18} {"dev. vs altre":>14} {"esito":>10}')
    plt_med = {l: float(df[df['gara'] == l]['pit_lane_time'].median()) for l, *_ in races}
    excluded_stat = []
    for label, *_ in races:
        others = [plt_med[l] for l, *_ in races if l != label]
        dev = abs(plt_med[label] - float(np.median(others)))
        v = df[df['gara'] == label]['pit_lane_time'].dropna()
        q1, q3 = np.percentile(v, 25), np.percentile(v, 75)
        out = dev > STATIONARITY_TOL
        if out:
            excluded_stat.append(label)
        print(f'{label:>10} {len(v):>4} {plt_med[label]:>9.2f} {("[%.2f - %.2f]" % (q1, q3)):>18} '
              f'{dev:>14.2f} {("ESCLUSA" if out else "ok"):>10}')
    if len(excluded_stat) > MAX_EXCLUDED:
        sys.exit(f'STOP F2.2: {len(excluded_stat)} gare fuori stazionarieta (> {MAX_EXCLUDED}): '
                 'il pooling non e legittimo.')
    print(f'escluse per stazionarieta: {excluded_stat if excluded_stat else "nessuna"}')

    # ---------------- F2.3 — settori affetti PER GARA (rideterminati, non assunti) ---
    print('\n===== F2.3 — settori affetti, rideterminati per gara (soglia 1,0 s) =====')
    valid = df[(df['escluso'] == '') & (~df['gara'].isin(excluded_stat))].copy()
    dcols = [f'd_{lab}_{SLABEL[c]}' for lab in ('in', 'out') for c in SECTORS]
    excluded_sect, affected_sets = [], {}
    print(f'{"gara":>10} {"n":>4}  ' + '  '.join(f'{c.replace("d_","")[::-1].replace("_","-",1)[::-1]:>8}' for c in dcols) + '   affetti')
    for label, *_ in races:
        if label in excluded_stat:
            continue
        g = valid[valid['gara'] == label]
        if not len(g):
            affected_sets[label] = None
            print(f'{label:>10} {0:>4}  ' + '(nessuno stop valido -> nessun blocco)')
            continue
        meds = {c: float(np.median(g[c].dropna())) for c in dcols}
        aff = [c for c in dcols if abs(meds[c]) >= AFFECT_THRESHOLD]
        affected_sets[label] = aff
        if len(aff) > MAX_AFFECTED:
            excluded_sect.append(label)
        print(f'{label:>10} {len(g):>4}  ' + '  '.join(f'{meds[c]:>8.2f}' for c in dcols) +
              f'   {[a.replace("d_", "") for a in aff]}' +
              ('  *** >2: NON MISURABILE, ESCLUSA ***' if len(aff) > MAX_AFFECTED else ''))
    modal = max((tuple(a) for a in affected_sets.values() if a), key=lambda t: sum(1 for a in affected_sets.values() if a and tuple(a) == t))
    print(f'insieme modale: {[a.replace("d_", "") for a in modal]}; '
          f'gare con insieme DIVERSO dal modale: '
          f'{[l for l, a in affected_sets.items() if a is not None and tuple(a) != modal] or "nessuna"}')
    if excluded_sect:
        print(f'escluse per >2 settori affetti: {excluded_sect}')
    valid = valid[~valid['gara'].isin(excluded_sect)]

    # pit_loss per stop, con l'insieme affetto DELLA SUA gara
    def pit_loss_row(r):
        aff = affected_sets.get(r['gara']) or []
        d_in = sum(r[c] for c in aff if c.startswith('d_in_'))
        d_out = sum(r[c] for c in aff if c.startswith('d_out_'))
        return pd.Series({'delta_inlap': d_in, 'delta_outlap': d_out,
                          'pit_loss': d_in + d_out})
    valid[['delta_inlap', 'delta_outlap', 'pit_loss']] = valid.apply(pit_loss_row, axis=1)

    # ---------------- F2.4 — i due parametri ----------------
    print('\n===== F2.4 — pit_loss per gara e i due parametri =====')
    print(f'{"gara":>10} {"cond.":>6} {"n":>4} {"mediana":>9}')
    for label, *_ in races:
        g = valid[valid['gara'] == label]['pit_loss'].dropna()
        note = 'ESCLUSA F2.2' if label in excluded_stat else ('ESCLUSA F2.3' if label in excluded_sect else '')
        if len(g):
            print(f'{label:>10} {cond_map[label]:>6} {len(g):>4} {np.median(g):>9.2f} {note}')
        else:
            print(f'{label:>10} {cond_map[label]:>6} {0:>4} {"--":>9} {note or "(0 stop validi)"}')

    results = []
    for cond in ('DRY', 'WET'):
        sub = valid[valid['condizione'] == cond]
        blocks, labels = [], []
        for label in sorted(sub['gara'].unique()):
            b = sub[sub['gara'] == label]['pit_loss'].dropna().values
            if len(b):
                blocks.append(b)
                labels.append(label)
        n_stop = sum(len(b) for b in blocks)
        nb = len(blocks)
        print(f'\n--- pit_loss_{cond.lower()}: {nb} blocchi {labels}, {n_stop} stop ---')
        if nb == 0:
            results.append(dict(parametro=cond.lower(), mediana=np.nan, n_stop=0, n_blocchi=0))
            continue
        pooled_all = np.concatenate(blocks)
        block_meds = [float(np.median(b)) for b in blocks]
        med = float(np.median(block_meds))   # mediana delle mediane di gara (mai pesata)
        q1, q3 = np.percentile(pooled_all, 25), np.percentile(pooled_all, 75)
        if nb >= 2:
            lo, hi = boot_unweighted(blocks)
            plo, phi = boot_pooled(blocks)
        else:
            lo = hi = plo = phi = np.nan
        print(f'  mediana (delle mediane di gara) = {med:.2f} s   IQR stop [{q1:.2f} - {q3:.2f}]')
        print(f'  IC95 NON pesato (blocchi come blocchi) = [{lo:.2f} - {hi:.2f}]  larghezza {hi-lo:.2f} s')
        print(f'  [solo confronto] IC95 POOLED (pesato)  = [{plo:.2f} - {phi:.2f}]  larghezza {phi-plo:.2f} s')
        print(f'  mediane di blocco: ' + ', '.join(f'{l}={m:.2f}' for l, m in zip(labels, block_meds)))
        results.append(dict(parametro=cond.lower(), mediana=round(med, 4),
                            iqr_lo=round(float(q1), 4), iqr_hi=round(float(q3), 4),
                            ic95_lo=round(lo, 4), ic95_hi=round(hi, 4),
                            larghezza=round(hi - lo, 4),
                            pooled_lo=round(plo, 4), pooled_hi=round(phi, 4),
                            n_stop=n_stop, n_blocchi=nb, blocchi=';'.join(labels)))

    # ---------------- F2.5 — verdetto (solo dry) ----------------
    print('\n===== F2.5 — VERDETTO (solo pit_loss_dry) =====')
    dry = next(r for r in results if r['parametro'] == 'dry')
    d_sub = valid[valid['condizione'] == 'DRY']
    veto = []
    n_neg = int((d_sub['pit_loss'] < 0).sum())
    n_over = int((d_sub['pit_loss'] > d_sub['pit_lane_time']).sum())
    if n_neg:
        veto.append(f'pit_loss < 0 su {n_neg} stop dry')
    if n_over:
        veto.append(f'pit_loss > pit_lane_time su {n_over} stop dry')
    plt_dry = float(d_sub['pit_lane_time'].median()) if len(d_sub) else np.nan
    track_time = plt_dry - dry['mediana'] if dry['n_blocchi'] else np.nan
    if not np.isnan(track_time) and track_time <= 0:
        veto.append(f'track_time = {track_time:.2f} <= 0')
    print(f'  vincoli: pit_loss<0: {n_neg}/{len(d_sub)} | pit_loss>pit_lane_time: {n_over}/{len(d_sub)} | '
          f'track_time = {plt_dry:.2f} - {dry["mediana"]:.2f} = {track_time:.2f} s (atteso ~8)')
    if veto:
        verdict = 'NO (VETO FISICO: ' + '; '.join(veto) + ')'
    elif dry['n_blocchi'] < MIN_DRY_BLOCKS:
        verdict = f'NON ESEGUIBILE (blocchi dry = {dry["n_blocchi"]} < {MIN_DRY_BLOCKS})'
    elif dry['larghezza'] <= 3.0:
        verdict = 'GO'
    elif dry['larghezza'] <= 6.0:
        verdict = 'AMBIGUO'
    else:
        verdict = 'NO definitivo'
    print(f'\n  VERDETTO: {verdict}   (IC95 non pesato, larghezza {dry["larghezza"]:.2f} s, '
          f'{dry["n_blocchi"]} blocchi dry)')

    # ---------------- output CSV ----------------
    cols = ['gara', 'stagione', 'condizione', 'pilota', 'giro', 'pit_lane_time',
            'delta_inlap', 'delta_outlap', 'pit_loss', 'compound_in', 'compound_out',
            'n_ref_in', 'n_ref_out'] + dcols
    valid.reindex(columns=cols).to_csv('data/fastf1_silverstone_stops_esteso.csv',
                                       index=False, float_format='%.4f')
    pd.DataFrame(results).to_csv('data/pitloss_silverstone_dry_wet.csv', index=False)
    print(f'\n[scritto] data/fastf1_silverstone_stops_esteso.csv ({len(valid)} stop)')
    print('[scritto] data/pitloss_silverstone_dry_wet.csv')
    print(f'[diagnostica per gara] {diags}')


if __name__ == '__main__':
    main()
