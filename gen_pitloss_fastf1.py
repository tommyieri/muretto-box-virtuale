#!/usr/bin/env python3
"""
gen_pitloss_fastf1.py — Sessione FF (pre-registrata in PREREG_SESSIONE_FF.md).

Misura il pit-loss a SILVERSTONE con FastF1, usando due cose che i metodi C-I non avevano:
  1. i timestamp di pit-in / pit-out  -> pit_lane_time e' una MISURA DIRETTA, non una stima;
  2. i tempi per SETTORE              -> il pit-loss si misura sui soli settori toccati dalla
                                        pit lane, non sul giro intero.

NON tocca alcun file di produzione. NON corregge nulla. Scrive solo:
  - data/fastf1_silverstone_stops.csv
  - (i numeri del REPORT su stdout)

Uso:  python3 gen_pitloss_fastf1.py
"""

import logging
import sys
import numpy as np
import pandas as pd
import fastf1

logging.getLogger('fastf1').setLevel(logging.ERROR)
fastf1.Cache.enable_cache('data/ff1_cache')

SEASONS = [2023, 2024, 2025, 2026]
EVENT = 'Silverstone'

# --- costanti pre-registrate (PREREG_SESSIONE_FF.md) -------------------------
MIN_GREEN_LAPS = 4        # stint con meno di 4 giri verdi -> escluso
OUT_REF_POS = (2, 5)      # riferimento out-lap: giri 2-5 del nuovo stint (NON il giro 1)
MIN_OUT_REF = 2           # almeno 2 giri utili nella finestra 2-5
AFFECT_THRESHOLD = 1.0    # |delta mediano| >= 1.0 s -> settore "affetto"
N_BOOT = 10000
SECTORS = ['Sector1Time', 'Sector2Time', 'Sector3Time']
SLABEL = {'Sector1Time': 'S1', 'Sector2Time': 'S2', 'Sector3Time': 'S3'}

rng = np.random.default_rng(20260714)


def secs(td):
    """timedelta -> secondi float, NaN se assente."""
    if pd.isna(td):
        return np.nan
    return td.total_seconds()


def is_green(track_status):
    """Verde = lo status del giro contiene SOLO '1'.
    Vocabolario FIA: 1=verde, 2=giallo, 4=SC, 5=rossa, 6=VSC, 7=fine VSC.
    TrackStatus di un giro e' la CONCATENAZIONE degli stati attraversati nel giro:
    basta un carattere != '1' perche' il giro non sia interamente verde."""
    if pd.isna(track_status):
        return False
    return set(str(track_status)) <= {'1'}


def load_season(year):
    s = fastf1.get_session(year, EVENT, 'R')
    s.load(laps=True, telemetry=False, weather=False, messages=False)
    return s


def stint_frame(laps):
    """Aggiunge posizione-nello-stint e flag verde/utile."""
    df = laps.copy()
    df['green'] = df['TrackStatus'].apply(is_green)
    # posizione nello stint: 1 = out-lap dello stint
    df['stint_start'] = df.groupby(['Driver', 'Stint'])['LapNumber'].transform('min')
    df['pos_in_stint'] = df['LapNumber'] - df['stint_start'] + 1
    # giro di RIFERIMENTO utilizzabile: verde + IsAccurate + non e' un giro di pit.
    # NOTA (dichiarata nel report): IsAccurate=True e' applicato ai giri di RIFERIMENTO,
    # NON ai giri di in/out-lap. In FastF1 OGNI giro di pit ha IsAccurate=False per
    # definizione: applicarlo agli in/out-lap azzererebbe il campione.
    df['usable_ref'] = (df['green'] & (df['IsAccurate'] == True)
                        & df['PitInTime'].isna() & df['PitOutTime'].isna())
    for c in SECTORS:
        df[c + '_s'] = df[c].apply(secs)
    return df


def collect(year):
    """Ritorna (righe_stop, diagnostica) per una stagione."""
    s = load_season(year)
    laps = stint_frame(s.laps)
    last_lap = laps['LapNumber'].max()
    rows, diag = [], {'scartati_no_timestamp': 0, 'scartati_non_verde': 0,
                      'scartati_stint_corto': 0, 'scartati_settori_nan': 0,
                      'scartati_primo_ultimo': 0, 'stop_grezzi': 0}

    for drv, d in laps.groupby('Driver'):
        d = d.sort_values('LapNumber')
        idx = list(d.index)
        for k, i in enumerate(idx):
            row = d.loc[i]
            if pd.isna(row['PitInTime']):
                continue
            diag['stop_grezzi'] += 1
            if k + 1 >= len(idx):
                diag['scartati_no_timestamp'] += 1
                continue
            nxt = d.loc[idx[k + 1]]
            # l'out-lap deve essere il giro immediatamente successivo e avere PitOutTime
            if pd.isna(nxt['PitOutTime']) or nxt['LapNumber'] != row['LapNumber'] + 1:
                diag['scartati_no_timestamp'] += 1
                continue

            # --- FF1: misura diretta -----------------------------------------
            plt_ = secs(nxt['PitOutTime']) - secs(row['PitInTime'])

            # primo/ultimo giro di gara
            if row['LapNumber'] <= 1 or nxt['LapNumber'] >= last_lap:
                diag['scartati_primo_ultimo'] += 1
                continue
            # SC/VSC/rossa su in-lap o out-lap
            if not (row['green'] and nxt['green']):
                diag['scartati_non_verde'] += 1
                rows.append(dict(stagione=year, pilota=drv, giro=int(row['LapNumber']),
                                 pit_lane_time=plt_, delta_inlap=np.nan,
                                 delta_outlap=np.nan, pit_loss=np.nan,
                                 escluso='non_verde'))
                continue

            # --- riferimenti di stint ----------------------------------------
            st_in = d[(d['Stint'] == row['Stint']) & d['usable_ref']]
            st_out_all = d[(d['Stint'] == nxt['Stint']) & d['usable_ref']]
            if len(st_in) < MIN_GREEN_LAPS or len(st_out_all) < MIN_GREEN_LAPS:
                diag['scartati_stint_corto'] += 1
                rows.append(dict(stagione=year, pilota=drv, giro=int(row['LapNumber']),
                                 pit_lane_time=plt_, delta_inlap=np.nan,
                                 delta_outlap=np.nan, pit_loss=np.nan,
                                 escluso='stint_corto'))
                continue
            st_out = st_out_all[(st_out_all['pos_in_stint'] >= OUT_REF_POS[0]) &
                                (st_out_all['pos_in_stint'] <= OUT_REF_POS[1])]
            if len(st_out) < MIN_OUT_REF:
                diag['scartati_stint_corto'] += 1
                rows.append(dict(stagione=year, pilota=drv, giro=int(row['LapNumber']),
                                 pit_lane_time=plt_, delta_inlap=np.nan,
                                 delta_outlap=np.nan, pit_loss=np.nan,
                                 escluso='out_ref_corto'))
                continue

            rec = dict(stagione=year, pilota=drv, giro=int(row['LapNumber']),
                       pit_lane_time=plt_, escluso='',
                       compound_in=row['Compound'], compound_out=nxt['Compound'],
                       n_ref_in=len(st_in), n_ref_out=len(st_out))
            nan_hit = False
            for c in SECTORS:
                v_in, v_out = row[c + '_s'], nxt[c + '_s']
                m_in = st_in[c + '_s'].median()
                m_out = st_out[c + '_s'].median()
                if np.isnan(v_in) or np.isnan(v_out) or np.isnan(m_in) or np.isnan(m_out):
                    nan_hit = True
                rec['d_in_' + SLABEL[c]] = v_in - m_in
                rec['d_out_' + SLABEL[c]] = v_out - m_out
            if nan_hit:
                diag['scartati_settori_nan'] += 1
                rec['escluso'] = 'settori_nan'
            rows.append(rec)
    return rows, diag


def block_bootstrap(df, value_col='pit_loss', weighted=True):
    """IC95 ricampionando i BLOCCHI-GARA (stagione), NON gli stop.
    Gli stop della stessa gara condividono meteo/gomme/SC/stato pista: non sono indipendenti.

    Due letture, ENTRAMBE fedeli a "ricampiona i blocchi", che il prereg NON disambigua:
      weighted=True  -> pool dei blocchi ricampionati, poi mediana. E' la versione standard,
                        ma la mediana resta PESATA dal numero di stop: un blocco con il 62%
                        degli stop domina ogni ricampionamento.
      weighted=False -> mediana delle MEDIANE di blocco: ogni gara pesa UNO, che e' la lettura
                        letterale di "conta i BLOCCHI, non gli stop", ed e' l'estimatore giusto
                        se l'estimando e' "il pit-loss di una NUOVA gara a Silverstone".
    """
    blocks = [g[value_col].dropna().values for _, g in df.groupby('stagione')]
    blocks = [b for b in blocks if len(b)]
    nb = len(blocks)
    if nb < 3:
        return (np.nan, np.nan), nb
    meds = []
    for _ in range(N_BOOT):
        pick = rng.integers(0, nb, nb)
        if weighted:
            meds.append(np.median(np.concatenate([blocks[j] for j in pick])))
        else:
            meds.append(np.median([np.median(blocks[j]) for j in pick]))
    return (float(np.percentile(meds, 2.5)), float(np.percentile(meds, 97.5))), nb


def stop_bootstrap(df, value_col='pit_loss'):
    """IC ricampionando gli STOP. NON VALIDO come metro (violerebbe l'indipendenza).
    Calcolato solo per MOSTRARE quanto sarebbe ingannevole. Vedi criterio 6 del prereg."""
    v = df[value_col].dropna().values
    if len(v) < 3:
        return (np.nan, np.nan)
    meds = [np.median(rng.choice(v, len(v), replace=True)) for _ in range(N_BOOT)]
    return (float(np.percentile(meds, 2.5)), float(np.percentile(meds, 97.5)))


def main():
    all_rows, diags = [], {}
    for y in SEASONS:
        try:
            r, d = collect(y)
            all_rows += r
            diags[y] = d
            print(f'[load] {y}: {len(r)} righe stop, diag={d}', file=sys.stderr)
        except Exception as e:
            print(f'[load] {y} FALLITA: {type(e).__name__}: {e}', file=sys.stderr)
            diags[y] = {'errore': f'{type(e).__name__}: {e}'}

    df = pd.DataFrame(all_rows)
    valid = df[df['escluso'] == ''].copy()

    # ---------------- FF1 ----------------
    print('\n===== FF1 — pit_lane_time MISURATO (PitOut(out-lap) - PitIn(in-lap)) =====')
    print(f"{'stagione':>9} {'n':>4} {'mediana':>9} {'IQR':>18}")
    ff1 = {}
    for y in SEASONS:
        v = df[(df['stagione'] == y)]['pit_lane_time'].dropna()
        if not len(v):
            print(f'{y:>9} {0:>4}        --')
            continue
        q1, q3 = np.percentile(v, 25), np.percentile(v, 75)
        ff1[y] = float(np.median(v))
        print(f'{y:>9} {len(v):>4} {np.median(v):>9.2f} {("[%.2f - %.2f]" % (q1, q3)):>18}')
    allv = df['pit_lane_time'].dropna()
    print(f"{'TUTTE':>9} {len(allv):>4} {np.median(allv):>9.2f}")
    if 2023 in ff1 and 2026 in ff1:
        drift = abs(ff1[2023] - ff1[2026])
        print(f'\nVINCOLO STABILITA: |mediana 2023 - mediana 2026| = {drift:.2f} s '
              f'(soglia 2,0) -> {"STABILE" if drift <= 2.0 else "INSTABILE -> STOP"}')

    # ---------------- FF2 ----------------
    print('\n===== FF2 — quali settori tocca la pit lane (DAI DATI) =====')
    print(f"{'settore':>10} {'delta mediano':>15} {'n':>5}   affetto(|d|>=1,0)")
    affected = []
    for lab in ('in', 'out'):
        for c in SECTORS:
            col = f'd_{lab}_{SLABEL[c]}'
            v = valid[col].dropna()
            if not len(v):
                continue
            m = float(np.median(v))
            hit = abs(m) >= AFFECT_THRESHOLD
            if hit:
                affected.append((lab, SLABEL[c], m))
            print(f'{SLABEL[c]+"-"+lab:>10} {m:>15.3f} {len(v):>5}   {"SI" if hit else "no"}')
    print(f'\nsettori affetti: {[f"{s}-{l}" for l, s, _ in affected]}  (n={len(affected)})')
    if len(affected) > 2:
        print('>>> PIU DI DUE SETTORI AFFETTI: il metodo per settori NON funziona a Silverstone.')

    # ---------------- FF3 ----------------
    in_aff = [s for l, s, _ in affected if l == 'in']
    out_aff = [s for l, s, _ in affected if l == 'out']

    # Regola pre-registrata applicata alla LETTERA: "pit_loss = somma dei delta sui SOLI
    # settori affetti". Se NESSUN settore dell'in-lap supera la soglia, la somma sull'insieme
    # vuoto e' 0: l'in-lap non perde nulla di MISURATO. Il prereg si aspettava un settore-in e
    # un settore-out (S3-in/S1-out); i dati dicono che a Silverstone l'in-lap contribuisce zero.
    # Questo va DICHIARATO nel report, non nascosto: la soglia (1,0 s) NON viene spostata.
    valid['delta_inlap'] = (valid[[f'd_in_{s}' for s in in_aff]].sum(axis=1)
                            if in_aff else 0.0)
    valid['delta_outlap'] = (valid[[f'd_out_{s}' for s in out_aff]].sum(axis=1)
                             if out_aff else np.nan)
    valid['pit_loss'] = valid['delta_inlap'] + valid['delta_outlap']

    # SENSIBILITA' (non e' il numero di testa): pit_loss includendo ANCHE i settori sotto
    # soglia dell'in-lap. Serve a mostrare quanto pesa la regola della soglia, NON a scegliere
    # il numero piu' comodo.
    valid['pit_loss_sens_S3in'] = valid['d_in_S3'] + valid['delta_outlap']

    print('\n===== FF3 — pit_loss per settori =====')
    pl = valid['pit_loss'].dropna()
    if len(pl):
        med = float(np.median(pl))
        q1, q3 = np.percentile(pl, 25), np.percentile(pl, 75)
        (lo_w, hi_w), nb = block_bootstrap(valid, weighted=True)
        (lo, hi), _ = block_bootstrap(valid, weighted=False)
        print(f'pit_loss mediana = {med:.2f} s   IQR [{q1:.2f} - {q3:.2f}]   n stop = {len(pl)}')
        print(f'IC95 blocchi, POOLED (pesato dagli stop) = [{lo_w:.2f} - {hi_w:.2f}]  '
              f'larghezza = {hi_w-lo_w:.2f} s')
        print(f'IC95 blocchi, NON pesato (ogni gara = 1) = [{lo:.2f} - {hi:.2f}]  '
              f'larghezza = {hi-lo:.2f} s   <-- ADOTTATO')
        print(f'n BLOCCHI = {nb}')
        slo, shi = stop_bootstrap(valid)
        print(f'[NON VALIDO — solo per confronto] IC95 ricampionando gli STOP = '
              f'[{slo:.2f} - {shi:.2f}]  larghezza = {shi-slo:.2f} s')
        print('\nper stagione (mediana di blocco):')
        secmed = []
        for y in SEASONS:
            v = valid[valid['stagione'] == y]['pit_loss'].dropna()
            if len(v):
                secmed.append(float(np.median(v)))
                print(f'  {y}: mediana {np.median(v):>6.2f}  n={len(v):>3}  '
                      f'({100*len(v)/len(pl):.0f}% del campione)')
        print(f'spread fra mediane di stagione = {max(secmed)-min(secmed):.2f} s')
        print(f'l\'IC POOLED contiene tutte le mediane di stagione? '
              f'{all(lo_w <= m <= hi_w for m in secmed)}   '
              f'(se NO, l\'IC pooled non rappresenta la variabilita\' gara-a-gara)')
        print('\nCONFRONTO metodi vecchi:  C 20,90 | D 19,71 | E 20,93 | nominale produzione 29,12')

        # composizione bagnato/asciutto — DIAGNOSTICA, non un filtro.
        # Escludere il bagnato dopo aver visto l'IC e' una LEVA VIETATA (prereg): si riporta.
        print('\nComposizione mescole (diagnostica, NESSUNA esclusione applicata):')
        for y in SEASONS:
            v = valid[valid['stagione'] == y]
            if not len(v):
                continue
            wet = v['compound_in'].isin(['INTERMEDIATE', 'WET']).sum()
            print(f'  {y}: {len(v)} stop validi, di cui {wet} con gomma da bagnato in in-lap')
        ps = valid['pit_loss_sens_S3in'].dropna()
        print(f'\n[SENSIBILITA, non il numero di testa] pit_loss includendo anche S3-in '
              f'(sotto soglia): mediana {np.median(ps):.2f} s')

        # ---------------- FF4 ----------------
        print('\n===== FF4 — vincoli fisici (VETO) =====')
        neg = int((pl < 0).sum())
        over = int((valid['pit_loss'] > valid['pit_lane_time']).sum())
        print(f'pit_loss < 0            : {neg}/{len(pl)} stop')
        print(f'pit_loss > pit_lane_time: {over}/{len(pl)} stop')
        tt = (valid['pit_lane_time'] - valid['pit_loss']).dropna()
        print(f'track_time = pit_lane_time - pit_loss: mediana {np.median(tt):.2f} s '
              f'(atteso ~8-9 s)   <=0 su {int((tt<=0).sum())}/{len(tt)} stop')

        # ---------------- FF5 ----------------
        # VERDETTO sull'IC NON pesato: e' l'estimatore fedele a "conta i BLOCCHI, non gli stop",
        # ed e' quello giusto se l'estimando e' "il pit-loss di una NUOVA gara a Silverstone".
        # Il prereg NON disambiguava fra le due letture e le due CAVALCANO la soglia
        # (2,43 -> GO ; 4,09 -> AMBIGUO). Una pre-registrazione che non decide NON puo'
        # autorizzare a posteriori il ramo piu' comodo: si adotta il CONSERVATIVO.
        def classify(w):
            if nb < 3:
                return 'NO (per non-stimabilita: blocchi < 3)'
            return 'GO' if w <= 3.0 else ('AMBIGUO' if w <= 6.0 else 'NO')

        width, width_w = hi - lo, hi_w - lo_w
        print(f'\n===== FF5 — VERDETTO =====')
        print(f'  IC pooled     larghezza {width_w:.2f} s -> {classify(width_w)}')
        print(f'  IC non pesato larghezza {width:.2f} s -> {classify(width)}   <-- ADOTTATO')
        print(f'\nVERDETTO: {classify(width)}   (le due letture cavalcano la soglia; '
              f'si adotta il conservativo)')
        print('Confronto con lo stato precedente: IC di oggi in produzione ~6,8 s -> '
              f'{width:.2f} s. Il metodo per settori MIGLIORA la precisione, ma non basta.')

    # ---------------- output CSV ----------------
    cols = ['stagione', 'pilota', 'giro', 'pit_lane_time', 'delta_inlap', 'delta_outlap',
            'pit_loss']
    out = valid.reindex(columns=cols + ['compound_in', 'compound_out', 'n_ref_in', 'n_ref_out']
                        + [f'd_{l}_{SLABEL[c]}' for l in ('in', 'out') for c in SECTORS])
    out.to_csv('data/fastf1_silverstone_stops.csv', index=False, float_format='%.4f')
    print(f'\n[scritto] data/fastf1_silverstone_stops.csv ({len(out)} stop validi)')
    print(f'[diagnostica scarti] {diags}')


if __name__ == '__main__':
    main()
