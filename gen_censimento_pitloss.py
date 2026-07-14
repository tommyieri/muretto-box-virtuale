#!/usr/bin/env python3
"""
gen_censimento_pitloss.py — Sessione FF3 (pre-registrata in PREREG_SESSIONE_FF3.md).

Censimento del pit-loss per i circuiti del calendario 2026 (22 gare; Silverstone escluso,
gia' attivato). Metodo FF2 INVARIATO per circuito; estensioni pre-registrate: verdetti
GIA' CALIBRATO / METODO NON APPLICABILE / DATO ROTTO, rapporto >= 3x sul GO, regola del
cambio-layout (esclusioni-prefisso), regola >50% per il metodo non applicabile.

NON tocca file di produzione. NON corregge nulla. Scrive:
  - data/censimento_pitloss_2026.csv  (una riga per circuito: la tabella dei verdetti)
  - data/censimento_stops.csv         (una riga per stop)
Riesegue tutto dalla cache FastF1 (data/ff1_cache, gitignorata).

Uso:  python3 gen_censimento_pitloss.py
"""

import logging
import sys
import datetime
import numpy as np
import pandas as pd
import fastf1

logging.getLogger('fastf1').setLevel(logging.ERROR)
fastf1.Cache.enable_cache('data/ff1_cache')

TODAY = datetime.date(2026, 7, 14)          # data di sessione (prereg)
SEASONS = list(range(2018, 2027))

# --- costanti pre-registrate (FF2, invariate) --------------------------------
WET_COMPOUNDS = {'INTERMEDIATE', 'WET'}
WET_COMPOUND_FRAC = 0.20
RAIN_FRAC = 0.20
STATIONARITY_TOL = 2.0
AFFECT_THRESHOLD = 1.0
MAX_AFFECTED = 2
MIN_GREEN_LAPS = 4
OUT_REF_POS = (2, 5)
MIN_OUT_REF = 2
MIN_DRY_BLOCKS = 5
N_BOOT = 10000
# --- soglie di verdetto FF3 (pre-registrate) ---------------------------------
GO_WIDTH = 3.0
NO_WIDTH = 6.0
GO_RATIO = 3.0
CALIB_GAIN = 1.0
NA_FRAC = 0.50            # >50% gare dry con >2 settori affetti -> METODO NON APPLICABILE
MAX_STAT_EXCL = 3         # >3 esclusioni stazionarieta' NON a prefisso -> DATO ROTTO
FALLBACK_PROD = 22.0      # pipeline_gara.py per cid assente (Madrid)

SECTORS = ['Sector1Time', 'Sector2Time', 'Sector3Time']
SLABEL = {'Sector1Time': 'S1', 'Sector2Time': 'S2', 'Sector3Time': 'S3'}
rng = np.random.default_rng(20260714)

# Ordine di priorita' FF3.1 (inciso nel prereg). keys = substring (lowercase) su Location.
CIRCUITS = [
    dict(cid='miami',             keys=['miami'],               prod=22.63, ci=19.5),
    dict(cid='monaco',            keys=['monte', 'monaco'],     prod=24.80, ci=22.0),
    dict(cid='spielberg',         keys=['spielberg'],           prod=21.63, ci=21.6),
    dict(cid='marina-bay',        keys=['marina', 'singapore'], prod=29.55, ci=None),
    dict(cid='lusail',            keys=['lusail', 'daayen', 'doha'], prod=28.82, ci=None),
    dict(cid='monza',             keys=['monza'],               prod=24.66, ci=None),
    dict(cid='montreal',          keys=['montr'],               prod=24.37, ci=None),
    dict(cid='austin',            keys=['austin'],              prod=24.25, ci=None),
    dict(cid='interlagos',        keys=['paulo'],               prod=23.73, ci=None),
    dict(cid='suzuka',            keys=['suzuka'],              prod=23.72, ci=None),
    dict(cid='spa-francorchamps', keys=['spa'],                 prod=23.36, ci=None),
    dict(cid='shanghai',          keys=['shanghai'],            prod=22.97, ci=None),
    dict(cid='mexico-city',       keys=['mexico'],              prod=22.69, ci=None),
    dict(cid='catalunya',         keys=['barcelona', 'montmel'], prod=22.38, ci=None),
    dict(cid='yas-marina',        keys=['yas', 'abu dhabi'],    prod=22.01, ci=None),
    dict(cid='hungaroring',       keys=['budapest'],            prod=21.80, ci=None),
    dict(cid='las-vegas',         keys=['vegas'],               prod=21.58, ci=None),
    dict(cid='baku',              keys=['baku'],                prod=20.72, ci=None),
    dict(cid='zandvoort',         keys=['zandvoort'],           prod=20.41, ci=None),
    dict(cid='melbourne',         keys=['melbourne'],           prod=18.15, ci=None),
    dict(cid='madrid',            keys=['madrid'],              prod=None,  ci=None),
]


def log(msg):
    print(msg, file=sys.stderr, flush=True)


def secs(td):
    if pd.isna(td):
        return np.nan
    return td.total_seconds()


def is_green(track_status):
    if pd.isna(track_status):
        return False
    return set(str(track_status)) <= {'1'}


# ----------------------------------------------------------------- calendario
_SCHED = {}
def schedule(year):
    if year not in _SCHED:
        _SCHED[year] = fastf1.get_event_schedule(year, include_testing=False)
    return _SCHED[year]


def events_for(circ, year):
    """Eventi (round, nome, data) del circuito nell'anno, per substring di localita'.
    Gare future (>= TODAY) escluse: non esistono ancora."""
    out = []
    try:
        sch = schedule(year)
    except Exception as e:
        log(f'  [{circ["cid"]}] calendario {year} non disponibile: {type(e).__name__}')
        return out
    for _, e in sch.iterrows():
        loc = str(e['Location']).lower()
        if any(k in loc for k in circ['keys']):
            d = e['EventDate'].date() if pd.notna(e['EventDate']) else None
            if d is not None and d >= TODAY:
                continue
            out.append((int(e['RoundNumber']), str(e['EventName']), d))
    return out


# ----------------------------------------------------------------- FF2, invariato
def classify(session):
    laps = session.laps
    comp = laps['Compound'].dropna()
    frac_wet_comp = float(comp.isin(WET_COMPOUNDS).mean()) if len(comp) else np.nan
    a_wet = frac_wet_comp >= WET_COMPOUND_FRAC
    wd = session.weather_data
    if wd is not None and len(wd) and 'Rainfall' in wd.columns:
        frac_rain = float(wd['Rainfall'].astype(bool).mean())
        b_wet = frac_rain >= RAIN_FRAC
        cond = 'WET' if (a_wet and b_wet) else ('DRY' if (not a_wet and not b_wet) else 'MISTA')
        return cond, frac_wet_comp, frac_rain, True
    return ('WET' if a_wet else 'DRY'), frac_wet_comp, np.nan, False


def stint_frame(laps):
    df = laps.copy()
    df['green'] = df['TrackStatus'].apply(is_green)
    df['stint_start'] = df.groupby(['Driver', 'Stint'])['LapNumber'].transform('min')
    df['pos_in_stint'] = df['LapNumber'] - df['stint_start'] + 1
    df['usable_ref'] = (df['green'] & (df['IsAccurate'] == True)
                        & df['PitInTime'].isna() & df['PitOutTime'].isna())
    for c in SECTORS:
        df[c + '_s'] = df[c].apply(secs)
    return df


def collect(session, cid, year, label):
    laps = stint_frame(session.laps)
    last_lap = laps['LapNumber'].max()
    rows = []
    diag = {'stop_grezzi': 0, 'no_timestamp': 0, 'drive_through': 0, 'primo_ultimo': 0,
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
            # DRIVE-THROUGH: transito in pit lane SENZA cambio gomme. L'esclusione era gia'
            # dichiarata nel prereg FF ("drive-through ... scartati"), ma col meccanismo
            # sbagliato: un drive-through HA entrambi i timestamp (scoperto sul caso BOT
            # Miami 2026: transito 17,0 s vs mediana 23,1, Stint 3->4 MA TyreLife 9->10
            # sulla stessa MEDIUM — FastF1 incrementa lo Stint a ogni transito, quindi il
            # rilevatore affidabile e' la GOMMA CHE CONTINUA A INVECCHIARE: stesso compound
            # e TyreLife = precedente + 1). Non e' uno stop: fuori sia dal pit_loss sia
            # dalle statistiche di pit_lane_time (il transito senza sosta e' ~5 s piu'
            # corto e inquinerebbe anche la stazionarieta').
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
            rec = {**base, 'escluso': ''}
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
    nb = len(blocks)
    bm = [np.median(b) for b in blocks]
    meds = [np.median([bm[j] for j in rng.integers(0, nb, nb)]) for _ in range(N_BOOT)]
    return float(np.percentile(meds, 2.5)), float(np.percentile(meds, 97.5))


DCOLS = [f'd_{lab}_{SLABEL[c]}' for lab in ('in', 'out') for c in SECTORS]


# ----------------------------------------------------------------- per circuito
def census_circuit(circ):
    cid = circ['cid']
    races = []       # dict: label, year, date, cond, n_giri
    all_rows, diags = [], {}
    for y in SEASONS:
        for rnd, name, date in events_for(circ, y):
            label = f'{y}-r{rnd}'
            try:
                s = fastf1.get_session(y, rnd, 'R')
                s.load(laps=True, telemetry=False, weather=True, messages=False)
                cond, fw, fr, has_w = classify(s)
                rows, dg = collect(s, cid, y, label)
                races.append(dict(label=label, year=y, date=date, cond=cond,
                                  fw=fw, fr=fr, has_w=has_w))
                all_rows += rows
                diags[label] = dg
                log(f'  [{cid}] {label} "{name}": {cond}, {dg["stop_grezzi"]} stop grezzi')
            except Exception as e:
                log(f'  [{cid}] {label} "{name}" NON caricabile: {type(e).__name__}: {e}')
                races.append(dict(label=label, year=y, date=date, cond='NON_CARICABILE',
                                  fw=np.nan, fr=np.nan, has_w=False))
    df = pd.DataFrame(all_rows)
    note = []
    loaded = [r for r in races if r['cond'] != 'NON_CARICABILE']
    failed = [r for r in races if r['cond'] == 'NON_CARICABILE']
    if failed:
        note.append(f"{len(failed)} gare non caricabili: {[r['label'] for r in failed]}")
    if not loaded or not len(df):
        return dict(circuito=cid, verdetto='NON ESEGUIBILE', n_blocchi=0,
                    note='; '.join(note + ['nessuna gara caricata']) or 'nessuna gara'), df, diags

    # riconciliazione scarti (esatta, pena uscita)
    tot_raw = sum(d['stop_grezzi'] for d in diags.values())
    keys = ['no_timestamp', 'drive_through', 'primo_ultimo', 'non_verde', 'stint_corto',
            'settori_nan']
    n_valid = int((df['escluso'] == '').sum())
    somma = n_valid + sum(sum(d[k] for d in diags.values()) for k in keys)
    if somma != tot_raw:
        sys.exit(f'RICONCILIAZIONE FALLITA su {cid}: grezzi {tot_raw} != somma {somma}. STOP.')

    # ---- stazionarieta' + regola del prefisso (cambio layout)
    plt_med = {}
    for r in loaded:
        v = df[df['gara'] == r['label']]['pit_lane_time'].dropna()
        plt_med[r['label']] = float(v.median()) if len(v) else np.nan
    usable = [r for r in loaded if not np.isnan(plt_med[r['label']])]
    excl_stat = []
    for r in usable:
        others = [plt_med[o['label']] for o in usable if o['label'] != r['label']]
        if others and abs(plt_med[r['label']] - float(np.median(others))) > STATIONARITY_TOL:
            excl_stat.append(r['label'])
    layout_from = min((r['year'] for r in usable), default=None)
    if excl_stat:
        inc = [r for r in usable if r['label'] not in excl_stat]
        exc = [r for r in usable if r['label'] in excl_stat]
        prefix = inc and exc and max(r['date'] for r in exc) < min(r['date'] for r in inc)
        if prefix:
            layout_from = min(r['year'] for r in inc)
            note.append(f'cambio layout: escluse {sorted(excl_stat)}; layout attuale dal {layout_from}')
        elif len(excl_stat) > MAX_STAT_EXCL:
            return dict(circuito=cid, verdetto='DATO ROTTO', n_blocchi=0,
                        note='; '.join(note + [f'stazionarieta non spiegabile: {len(excl_stat)} '
                                               f'esclusioni non a prefisso {sorted(excl_stat)}'])), df, diags
        else:
            note.append(f'escluse per stazionarieta (sporadiche): {sorted(excl_stat)}')

    valid = df[(df['escluso'] == '') & (~df['gara'].isin(excl_stat))].copy()
    cond_map = {r['label']: r['cond'] for r in loaded}
    valid['condizione'] = valid['gara'].map(cond_map)

    # ---- settori affetti per gara + regola >50% (sulle gare DRY altrimenti valide)
    affected_sets, excl_sect = {}, []
    for lbl in sorted(valid['gara'].unique()):
        g = valid[valid['gara'] == lbl]
        meds = {c: float(np.median(g[c].dropna())) if g[c].notna().any() else 0.0 for c in DCOLS}
        aff = [c for c in DCOLS if abs(meds[c]) >= AFFECT_THRESHOLD]
        affected_sets[lbl] = aff
        if len(aff) > MAX_AFFECTED:
            excl_sect.append(lbl)
    dry_candidates = [l for l in affected_sets if cond_map.get(l) == 'DRY']
    dry_over = [l for l in dry_candidates if l in excl_sect]
    if dry_candidates and len(dry_over) / len(dry_candidates) > NA_FRAC:
        return dict(circuito=cid, verdetto='METODO NON APPLICABILE', n_blocchi=0,
                    note='; '.join(note + [f'{len(dry_over)}/{len(dry_candidates)} gare dry con '
                                           f'>2 settori affetti'])), df, diags
    if excl_sect:
        note.append(f'escluse per >2 settori affetti: {sorted(excl_sect)}')
    valid = valid[~valid['gara'].isin(excl_sect)].copy()

    def pit_loss_row(r):
        aff = affected_sets.get(r['gara']) or []
        d_in = sum(r[c] for c in aff if c.startswith('d_in_'))
        d_out = sum(r[c] for c in aff if c.startswith('d_out_'))
        return pd.Series({'delta_inlap': d_in, 'delta_outlap': d_out, 'pit_loss': d_in + d_out})
    if len(valid):
        valid[['delta_inlap', 'delta_outlap', 'pit_loss']] = valid.apply(pit_loss_row, axis=1)
        valid['settori_usati'] = valid['gara'].map(
            lambda l: '+'.join(a.replace('d_', '') for a in (affected_sets.get(l) or [])))

    # ---- panieri
    res = dict(circuito=cid, produzione=circ['prod'], prod_assente=circ['prod'] is None)
    out_stats = {}
    for cond in ('DRY', 'WET'):
        sub = valid[valid['condizione'] == cond]
        blocks = [g['pit_loss'].dropna().values for _, g in sub.groupby('gara')]
        blocks = [b for b in blocks if len(b)]
        st = dict(n_blocchi=len(blocks), n_stop=sum(len(b) for b in blocks))
        if blocks:
            bm = [float(np.median(b)) for b in blocks]
            st['mediana'] = float(np.median(bm))
            if len(blocks) >= 2:
                st['lo'], st['hi'] = boot_unweighted(blocks)
        out_stats[cond] = st

    dry = out_stats['DRY']
    d_sub = valid[valid['condizione'] == 'DRY']
    plt_dry = float(d_sub['pit_lane_time'].median()) if len(d_sub) else np.nan
    res.update(pit_lane_time=round(plt_dry, 2) if not np.isnan(plt_dry) else None,
               n_blocchi=dry['n_blocchi'], n_stop=dry['n_stop'],
               wet_mediana=out_stats['WET'].get('mediana'),
               wet_blocchi=out_stats['WET']['n_blocchi'],
               layout_dal=layout_from)

    # ---- verdetto (precedenza pre-registrata)
    prod = circ['prod'] if circ['prod'] is not None else FALLBACK_PROD
    if dry['n_blocchi'] >= 1 and 'mediana' in dry:
        n_neg = int((d_sub['pit_loss'] < 0).sum())
        n_over = int((d_sub['pit_loss'] > d_sub['pit_lane_time']).sum())
        track_time = plt_dry - dry['mediana']
        res.update(pit_loss_dry=round(dry['mediana'], 2), track_time=round(track_time, 2))
        if n_neg or n_over or track_time <= 0:
            # Riclassificazione decisa dal PO dopo la lettura del censimento (decisione di
            # dominio, stessa sostanza: nessun verdetto, nessuna correzione): il veto fisico
            # non indica dati rotti ma una MISURA NON SEPARABILE. Causa data-driven:
            # - guadagno geometrico ~0 (track_time piccolo): il warm-in, dentro la misura per
            #   costruzione, raggiunge/supera il transito;
            # - guadagno geometrico grande (Monaco): al warm-in si somma il TRAFFICO al
            #   rientro — non separabile nemmeno in linea di principio, proprieta' permanente
            #   del tracciato, non un difetto di metodo.
            causa = ('traffico al rientro in aggiunta al warm-in: proprieta permanente del '
                     'tracciato' if track_time >= 2.5 else 'warm-in >= guadagno geometrico')
            res['verdetto'] = 'MISURA NON SEPARABILE'
            note.append(f'{causa}; veto fisico: pit_loss<0 su {n_neg}, >lane su {n_over}, '
                        f'track_time {track_time:.2f}; produzione (lane time) vicina al vero '
                        f'(errore <~1-2 s): debito di bassa priorita')
            res['note'] = '; '.join(note)
            return res, valid, diags
    if dry['n_blocchi'] < MIN_DRY_BLOCKS:
        res['verdetto'] = 'NON ESEGUIBILE'
        note.append(f'mancano {MIN_DRY_BLOCKS - dry["n_blocchi"]} blocchi dry; layout attuale '
                    f'stabile dal {layout_from}')
        res['note'] = '; '.join(note)
        return res, valid, diags
    lo, hi = dry['lo'], dry['hi']
    width = hi - lo
    gain = prod - dry['mediana']
    ratio = abs(gain) / (width / 2) if width > 0 else np.inf
    res.update(ic95=f'[{lo:.2f} - {hi:.2f}]', larghezza=round(width, 2),
               guadagno=round(gain, 2), rapporto=round(ratio, 1))
    if abs(gain) <= CALIB_GAIN and width <= NO_WIDTH:
        v = "GIA' CALIBRATO"
    elif width <= GO_WIDTH and ratio >= GO_RATIO:
        v = 'GO'
    elif width <= NO_WIDTH:
        v = 'AMBIGUO'
    else:
        v = 'NO'
    res['verdetto'] = v
    if circ['ci'] is not None and 'mediana' in dry:
        dv = abs(dry['mediana'] - circ['ci'])
        note.append(f"C-I {circ['ci']}: {'CONVERGE' if dv <= 2.0 else f'DIVERGE {dv:.1f} s'}")
    res['note'] = '; '.join(note)
    return res, valid, diags


def main():
    census, stop_frames = [], []
    for circ in CIRCUITS:
        log(f'=== {circ["cid"]} ===')
        try:
            row, stops, _ = census_circuit(circ)
        except SystemExit:
            raise
        except Exception as e:
            log(f'  [{circ["cid"]}] ERRORE CIRCUITO: {type(e).__name__}: {e}')
            row, stops = dict(circuito=circ['cid'], verdetto='DATO ROTTO',
                              note=f'errore: {type(e).__name__}: {e}'), pd.DataFrame()
        row.setdefault('produzione', circ['prod'])
        census.append(row)
        if len(stops):
            stop_frames.append(stops)
        log(f'  [{circ["cid"]}] VERDETTO: {row["verdetto"]}')

    cdf = pd.DataFrame(census)
    cols = ['circuito', 'pit_lane_time', 'produzione', 'pit_loss_dry', 'ic95', 'larghezza',
            'n_blocchi', 'n_stop', 'guadagno', 'rapporto', 'verdetto', 'track_time',
            'wet_mediana', 'wet_blocchi', 'layout_dal', 'note']
    cdf = cdf.reindex(columns=cols)
    cdf.to_csv('data/censimento_pitloss_2026.csv', index=False)
    if stop_frames:
        sdf = pd.concat(stop_frames, ignore_index=True)
        scols = ['circuito', 'stagione', 'gara', 'condizione', 'pilota', 'giro',
                 'pit_lane_time', 'settori_usati', 'delta_inlap', 'delta_outlap', 'pit_loss']
        sdf.reindex(columns=scols).to_csv('data/censimento_stops.csv', index=False,
                                          float_format='%.4f')
    print(cdf.to_string(index=False))
    print('\nriepilogo verdetti:', cdf['verdetto'].value_counts().to_dict())


if __name__ == '__main__':
    main()
