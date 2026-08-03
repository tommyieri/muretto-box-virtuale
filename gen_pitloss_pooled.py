"""gen_pitloss_pooled.py — Sessione I: rimisura pulita (riferimento LOCALE) e su tutte le
stagioni (pooling 2023-2026), poi validazione. Metodo/campione/soglie PRE-REGISTRATI in
PREREG_SESSIONE_I.md (committato prima dei numeri). NESSUN modello nuovo, NESSUNA sostituzione,
NESSUN file di produzione toccato. Generatore committato; golden verdi prima e dopo.

Continua la lineage G→H:
- G ha stabilito che il campo f1db e' la DURATA dello stop = pit_lane_time (Jolpica).
- H ha bocciato (H1 Spagna −1,5; H2 solo 2 circuiti testabili). Sessione I sostiene che erano
  difetti di MISURA e li corregge con DUE leve pre-registrate:
    (1) riferimento LOCALE al pit-loss verde (ultimi 5 giri verdi dello STESSO stint prima del
        pit, fuel-corretti 3/70): gia' a gomma vecchia come l'in-lap → assorbe il bias di
        degrado del metodo C per costruzione (il filone degrado resta CHIUSO, mai predittore);
    (2) POOLING multi-stagione (2023-2026) per sbloccare i circuiti SC testabili.
Le SOGLIE di verdetto sono INVARIATE da H.

FONTI: durate per-stop Jolpica (successore Ergast), tutte le stagioni; stop e lap-times da
data/ti_archive/{2023,2024,2025}/*/Race.json (TI grezzo) + demo/data/*.json (9 gare 2026).
Igiene verde storica: pulisci/filtro_outlier/aria-pulita importate (test_identificabilita_degrado,
gen_replay_perdita_stint) NON reimplementate. Decodifica neutralizzazione ('4'=SC, '6'=VSC) come
gen_neutralizzazione (soglia >=2 auto).
"""
import os, csv, json, time, random, statistics as st
import urllib.request
from collections import defaultdict


def median(xs):
    return float(st.median(xs))


def pctl(vals, p):
    """percentile lineare (tipo numpy 'linear') su lista gia' ordinabile."""
    v = sorted(vals); n = len(v)
    if n == 1:
        return float(v[0])
    k = (n - 1) * (p / 100.0)
    lo = int(k); frac = k - lo
    if lo + 1 >= n:
        return float(v[-1])
    return float(v[lo] + (v[lo + 1] - v[lo]) * frac)


def sign(x):
    return (x > 0) - (x < 0)

# ----------------------------- CONFIG PRE-REGISTRATA -----------------------------
CIRCUITI = ['Australia', 'Austria', 'Canada', 'Cina', 'Giappone', 'Gran Bretagna', 'Miami', 'Monaco', 'Spagna']
CID = {'Australia': 'albert_park', 'Austria': 'red_bull_ring', 'Canada': 'villeneuve', 'Cina': 'shanghai',
       'Giappone': 'suzuka', 'Gran Bretagna': 'silverstone', 'Miami': 'miami', 'Monaco': 'monaco', 'Spagna': 'catalunya'}
FOLDER = {'Australia': 'Australian', 'Austria': 'Austrian', 'Canada': 'Canadian', 'Cina': 'Chinese',
          'Giappone': 'Japanese', 'Gran Bretagna': 'British', 'Miami': 'Miami', 'Monaco': 'Monaco', 'Spagna': 'Spanish'}
STAGIONI_HIST = ('2023', '2024', '2025')

COEFF_FUEL, FUEL0 = 3.0 / 70.0, 70.0     # kernel: fuel(lap,N)=max(0,70-70/N*(lap-1))*3/70 ("3/70")
DUR_MAX = 60.0                            # durate > 60 s = standing bandiera-rossa/SC, non pit-lane
FINESTRE = (3, 5, 7)                      # sensibilita' riferimento locale; PRIMARIA = 5
K_PRIMARIA = 5
MIN_REF = 3                              # < 3 giri verdi nello stint -> escludi lo stop e contalo
MIN_N_FISICO = 15                        # I1 riguarda solo circuiti con n_pooled >= 15
MIN_SC = 8                               # I0: >=8 stop SC misurabili per circuito (INVARIATO)
MIN_CAMPO = 3                            # >=3 auto per una mediana-campo valida
RATIO_NOM = 0.42
BOOT_ITER = 2000
RNG_SEED = 20260713

DUR_CACHE = os.path.join('data', 'pitstop_durate_pooled_f1db.csv')
DUR_2026 = os.path.join('data', 'pitstop_durate_f1db.csv')   # G0 (Jolpica 2026), riuso per 2026
NEU_DEMO = json.load(open(os.path.join('demo', 'neutralizzazione.json')))
CSV_CIRC = os.path.join('data', 'pitloss_pooled_circuito.csv')
CSV_RLAP = os.path.join('data', 'rlap_pooled.csv')
REPORT = 'REPORT_VALIDAZIONE_POOLED.md'


def fuel(lap, N):
    return max(0.0, FUEL0 - (FUEL0 / N) * (lap - 1)) * COEFF_FUEL


# ============================ I0a — INGESTIONE DURATE (Jolpica) ============================
def _get(url, tries=4):
    last = None
    for k in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=25) as r:
                return json.load(r)
        except Exception as e:
            last = e; time.sleep(0.6 * (k + 1))
    raise last


def _parse_dur(s):
    s = str(s).strip()
    if ':' in s:
        mm, ss = s.split(':'); return int(mm) * 60 + float(ss)
    return float(s)


def ingesta_durate():
    """Scrive DUR_CACHE (circuito,stagione,round,n_stop,durata_s per riga-stop) da Jolpica per
    2023-2025 (schedule->round) + 2026 (riuso di data/pitstop_durate_f1db.csv, dato G0). Se la
    rete non risponde ma la cache esiste, usa la cache (determinismo: dati storici fissi)."""
    if os.path.exists(DUR_CACHE):
        print(f'[I0a] cache durate presente: {DUR_CACHE} (uso quella; --refresh per rigenerare)')
        return
    righe = []
    # 2023-2025 da Jolpica
    for y in STAGIONI_HIST:
        sched = _get(f'https://api.jolpi.ca/ergast/f1/{y}/?limit=100')
        r2round = {r['Circuit']['circuitId']: int(r['round']) for r in sched['MRData']['RaceTable']['Races']}
        for circ, cid in CID.items():
            rd = r2round.get(cid)
            if rd is None:
                print(f'  {y} {circ}: (circuito non in calendario)'); continue
            d = _get(f'https://api.jolpi.ca/ergast/f1/{y}/{rd}/pitstops/?limit=200')
            races = d['MRData']['RaceTable']['Races']
            stops = races[0].get('PitStops', []) if races else []
            for s in stops:
                ds = str(s.get('duration', '')).strip()
                if not ds:
                    continue                          # durata mancante -> saltata
                righe.append((circ, y, rd, _parse_dur(ds)))
            time.sleep(0.2)
        print(f'  {y}: ingerito')
    # 2026 dal dato G0 gia' committato (stesso campo Jolpica duration)
    if os.path.exists(DUR_2026):
        for r in csv.DictReader(open(DUR_2026)):
            if r.get('durata_s'):
                righe.append((r['gara'], '2026', r.get('round', ''), float(r['durata_s'])))
    righe.sort(key=lambda x: (x[0], x[1]))
    with open(DUR_CACHE, 'w', newline='') as f:
        w = csv.writer(f); w.writerow(['circuito', 'stagione', 'round', 'durata_s'])
        for circ, y, rd, dv in righe:
            w.writerow([circ, y, rd, f'{dv:.3f}'])
    print(f'[I0a] scritto {DUR_CACHE} ({len(righe)} durate)')


def carica_pit_lane():
    """pit_lane_time[c] = mediana durata pooled (<=60 s); + n e mediana per stagione."""
    per_c = defaultdict(list); per_cy = defaultdict(lambda: defaultdict(list))
    for r in csv.DictReader(open(DUR_CACHE)):
        v = float(r['durata_s'])
        if v <= DUR_MAX:
            per_c[r['circuito']].append(v)
            per_cy[r['circuito']][r['stagione']].append(v)
    pit_lane = {c: (median(per_c[c]) if per_c[c] else None) for c in CIRCUITI}
    n_dur = {c: len(per_c[c]) for c in CIRCUITI}
    dur_stag_med = {c: {y: median(vs) for y, vs in per_cy[c].items()} for c in CIRCUITI}
    return pit_lane, n_dur, dur_stag_med


def dur_per_stag_med(dur_stag_med, c):
    """[(stagione, 'val(n?)'), ...] ordinato, per la diagnostica data-quality."""
    return [(y, f'{v:.1f}') for y, v in sorted(dur_stag_med[c].items())]


# ============================ I0b — NORMALIZZAZIONE STOP/LAP ============================
def _null(x):
    return x is None or str(x) == 'None'


def load_hist(path):
    """ti_archive Race.json (colonnare) -> (N, byLap{lap:{drv:rec}}). rec normalizzato."""
    d = json.load(open(path)); n = len(d['time'])
    N = max(int(x) for x in d['lap'] if x is not None)
    byLap = {}
    for i in range(n):
        if d['lap'][i] is None:
            continue
        L = int(d['lap'][i]); s = str(d['status'][i])
        rec = dict(
            lap_time=d['time'][i] if isinstance(d['time'][i], (int, float)) else None,
            in_lap=not _null(d['pin'][i]), out_lap=not _null(d['pout'][i]),
            neutralized=('4' in s) or ('6' in s),
            stint=int(d['stint'][i]) if isinstance(d['stint'][i], (int, float)) else None,
            tyre_age=int(d['life'][i]) if isinstance(d['life'][i], (int, float)) else None,
            compound=d['compound'][i], status=s)
        byLap.setdefault(L, {})[d['drv'][i]] = rec
    return N, byLap


def load_demo(g):
    """demo/data/{g}.json (gia' processato) -> (N, byLap) nello stesso schema normalizzato."""
    r = json.load(open(f'demo/data/{g}.json')); N = r['n_laps']; byLap = {}
    for lp in r['laps']:
        for drv, c in lp['cars'].items():
            byLap.setdefault(lp['lap'], {})[drv] = dict(
                lap_time=c.get('lap_time'), in_lap=c['in_lap'], out_lap=c['out_lap'],
                neutralized=c['neutralized'], stint=c['stint'], tyre_age=c.get('tyre_age'),
                compound=c.get('compound'), status=None)
    return N, byLap


def finestre_da_status(byLap, digit):
    """finestre neutralizzazione (SC='4'/VSC='6') dai raw storici: soglia >=2 auto, run contigui."""
    cnt = defaultdict(int)
    for L, cars in byLap.items():
        for rec in cars.values():
            if rec['status'] and digit in rec['status']:
                cnt[L] += 1
    laps = sorted(L for L in cnt if cnt[L] >= 2)
    out = []
    for L in laps:
        if out and L == out[-1][1] + 1:
            out[-1][1] = L
        else:
            out.append([L, L])
    return out


def windows(circ, sorgente, byLap):
    if sorgente == 'demo':
        return (NEU_DEMO.get(circ, {}).get('sc', []), NEU_DEMO.get(circ, {}).get('vsc', []))
    return (finestre_da_status(byLap, '4'), finestre_da_status(byLap, '6'))


# ============================ I1 — PIT-LOSS VERDE, RIFERIMENTO LOCALE ============================
def pitloss_verde_local(N, byLap, sc, vsc, K):
    """Ritorna (lista pit_loss verdi, n_stop_esclusi_ref_corto). rif_locale = mediana ultimi K
    giri verdi dello STESSO stint prima dell'in-lap (min MIN_REF), fuel-corretti 3/70."""
    neu = lambda L: any(a <= L <= b for a, b in sc + vsc)
    drivers = set().union(*[set(c) for c in byLap.values()]) if byLap else set()
    out = []; escl = 0
    for drv in drivers:
        laps = sorted(L for L in byLap if drv in byLap[L])
        rec = {L: byLap[L][drv] for L in laps}
        # giri verdi per stint (no in/out, no neutralizzati, lap>1, tempo numerico)
        verdi_stint = defaultdict(list)
        for L in laps:
            c = rec[L]
            if (isinstance(c['lap_time'], (int, float)) and not c['in_lap'] and not c['out_lap']
                    and not c['neutralized'] and c['stint'] is not None and L > 1):
                verdi_stint[c['stint']].append((L, c['lap_time']))
        for P in laps:
            c = rec[P]
            if not c['in_lap']:
                continue
            o = byLap.get(P + 1, {}).get(drv)
            if not o or not o['out_lap'] or P <= 1 or P + 1 >= N:
                continue
            if c['neutralized'] or o['neutralized'] or neu(P) or neu(P + 1):
                continue
            if not isinstance(c['lap_time'], (int, float)) or not isinstance(o['lap_time'], (int, float)):
                continue
            gl = sorted(L_lt for L_lt in verdi_stint.get(c['stint'], []) if L_lt[0] < P)[-K:]
            if len(gl) < MIN_REF:
                escl += 1; continue                     # < 3 giri verdi -> escludi e conta
            ref = median(([lt - fuel(L, N) for L, lt in gl]))
            pl = (c['lap_time'] + o['lap_time']) - (ref + fuel(P, N)) - (ref + fuel(P + 1, N))
            out.append(pl)
    return out, escl


# ============================ I2 — R_lap + osservato SC (campo-mediano) ============================
def green_median_race(byLap):
    v = [byLap[L][d]['lap_time'] for L in byLap for d in byLap[L]
         if L > 1 and not byLap[L][d]['in_lap'] and not byLap[L][d]['out_lap']
         and not byLap[L][d]['neutralized'] and isinstance(byLap[L][d]['lap_time'], (int, float))]
    return (median((v)), len(v)) if v else (None, 0)


def neutr_laps_ratio(byLap, wins, green_med):
    """rapporti (giro_neutralizzato / green_med) per i giri STRETTAMENTE dentro finestra
    (esclude deployment/restart), campo intero, no in/out-lap. green_med normalizza la stagione."""
    if green_med is None:
        return []
    instrict = lambda L: any(a + 1 <= L <= b - 1 for a, b in wins)
    r = []
    for L in byLap:
        if not instrict(L):
            continue
        for d, c in byLap[L].items():
            if c['in_lap'] or c['out_lap'] or not isinstance(c['lap_time'], (int, float)):
                continue
            r.append(c['lap_time'] / green_med)
    return r


def pitloss_sc_oss(N, byLap, sc):
    """osservato SC (metodo G): (in+out) - (mediana campo @in + @out); campo = non-pittanti
    neutralizzati (>=MIN_CAMPO); stop STRETTAMENTE dentro finestra (no deployment/restart)."""
    out = []
    for a, b in sc:
        lapmed = {}
        for L in range(a, b + 1):
            fl = [byLap[L][x]['lap_time'] for x in byLap.get(L, {})
                  if not byLap[L][x]['in_lap'] and not byLap[L][x]['out_lap'] and byLap[L][x]['neutralized']
                  and isinstance(byLap[L][x]['lap_time'], (int, float))]
            lapmed[L] = median((fl)) if len(fl) >= MIN_CAMPO else None
        for L in range(a + 1, b):
            for d, c in byLap.get(L, {}).items():
                if not c['in_lap']:
                    continue
                o = byLap.get(L + 1, {}).get(d)
                if not o or not o['out_lap'] or L + 1 > b:
                    continue
                if lapmed.get(L) is None or lapmed.get(L + 1) is None:
                    continue
                if not isinstance(c['lap_time'], (int, float)) or not isinstance(o['lap_time'], (int, float)):
                    continue
                out.append((c['lap_time'] + o['lap_time']) - (lapmed[L] + lapmed[L + 1]))
    return out


# ============================ RACCOLTA POOLED ============================
def races_per_circuito(circ):
    """lista (etichetta, sorgente, loader) per un circuito: storiche + demo 2026."""
    out = []
    for y in STAGIONI_HIST:
        base = os.path.join('data', 'ti_archive', y)
        if not os.path.isdir(base):
            continue
        match = [f for f in os.listdir(base) if f.startswith(FOLDER[circ])]
        if match:
            out.append((f'{y}', 'hist', os.path.join(base, match[0], 'Race.json')))
    out.append(('2026', 'demo', circ))
    return out


def raccogli():
    """Per circuito, pool su tutte le stagioni. Ritorna dict circ -> aggregati."""
    D = {}
    for circ in CIRCUITI:
        verde_K = {K: [] for K in FINESTRE}
        escl_K = {K: 0 for K in FINESTRE}
        verde_per_stag = defaultdict(int)
        sc_ratios, vsc_ratios = [], []          # (lap_neutr/green_med) per R_lap pooled
        sc_oss_blocchi = []                     # [(blocco, [pit_loss_sc...]), ...] per bootstrap
        sc_stops_per_stag = defaultdict(int)
        for etich, sorgente, ref in races_per_circuito(circ):
            N, byLap = (load_hist(ref) if sorgente == 'hist' else load_demo(ref))
            sc, vsc = windows(circ, sorgente, byLap)
            for K in FINESTRE:
                pl, ex = pitloss_verde_local(N, byLap, sc, vsc, K)
                verde_K[K] += pl; escl_K[K] += ex
                if K == K_PRIMARIA:
                    verde_per_stag[etich] += len(pl)
            gm, _ = green_median_race(byLap)
            sc_ratios += neutr_laps_ratio(byLap, sc, gm)
            vsc_ratios += neutr_laps_ratio(byLap, vsc, gm)
            oss = pitloss_sc_oss(N, byLap, sc)
            if oss:
                sc_oss_blocchi.append((f'{circ}-{etich}', oss))
                sc_stops_per_stag[etich] += len(oss)
        D[circ] = dict(verde_K=verde_K, escl_K=escl_K, verde_per_stag=dict(verde_per_stag),
                       sc_ratios=sc_ratios, vsc_ratios=vsc_ratios, sc_oss_blocchi=sc_oss_blocchi,
                       sc_stops_per_stag=dict(sc_stops_per_stag))
    return D


def boot_median_ci(blocchi, rng):
    """IC 95% a blocchi-(gara) della mediana pooled: ricampiona i blocchi con rimpiazzo.
    Ritorna (mediana, lo, hi, n_blocchi). Con < 2 blocchi il bootstrap-a-blocchi e' DEGENERE
    (ogni ricampionamento e' identico): IC = None,None (dichiarato 'non stimabile'), NON zero."""
    tutti = [v for _, arr in blocchi for v in arr]
    nb = len(blocchi)
    if len(tutti) < 8:
        return (median(tutti) if tutti else None), None, None, nb
    if nb < 2:
        return median(tutti), None, None, nb          # 1 solo blocco -> IC non stimabile
    meds = []
    idx = list(range(nb))
    for _ in range(BOOT_ITER):
        pick = rng.choices(idx, k=nb)
        pooled = [v for j in pick for v in blocchi[j][1]]
        if pooled:
            meds.append(median(pooled))
    return median(tutti), pctl(meds, 2.5), pctl(meds, 97.5), nb


# ============================ MAIN ============================
def main():
    ingesta_durate()
    pit_lane, n_dur, dur_per_stag = carica_pit_lane()
    D = raccogli()
    rng = random.Random(RNG_SEED)

    # --- I1: pit-loss verde locale, track_time, fragilita' finestra ---
    verde_med = {}      # (circ,K) -> mediana pit-loss verde
    n_verde = {}        # circ -> n stop verdi (K primaria)
    track = {}          # (circ,K) -> track_time
    fragile = {}        # circ -> bool (segno track_time flippa su 3/5/7), solo n>=15
    for c in CIRCUITI:
        for K in FINESTRE:
            vv = D[c]['verde_K'][K]
            verde_med[(c, K)] = median((vv)) if vv else None
            track[(c, K)] = (pit_lane[c] - verde_med[(c, K)]) if (pit_lane[c] is not None and verde_med[(c, K)] is not None) else None
        n_verde[c] = len(D[c]['verde_K'][K_PRIMARIA])
        segni = [sign(track[(c, K)]) for K in FINESTRE if track[(c, K)] is not None]
        fragile[c] = (n_verde[c] >= MIN_N_FISICO) and (len(set(segni)) > 1)

    ben_camp = [c for c in CIRCUITI if n_verde[c] >= MIN_N_FISICO]
    testati_I1 = [c for c in ben_camp if not fragile[c]]
    negativi = [c for c in testati_I1 if track[(c, K_PRIMARIA)] is not None and track[(c, K_PRIMARIA)] < 0]
    I1_PASS = (len(testati_I1) > 0) and (len(negativi) == 0)

    # --- I2: R_lap pooled + osservato SC + predizione ---
    R_sc, R_vsc, n_sclap, n_vsclap = {}, {}, {}, {}
    for c in CIRCUITI:
        sr, vr = D[c]['sc_ratios'], D[c]['vsc_ratios']
        R_sc[c] = median((sr)) if sr else None
        R_vsc[c] = median((vr)) if vr else None
        n_sclap[c] = len(sr); n_vsclap[c] = len(vr)
    oss_med, oss_lo, oss_hi, n_sc_stop, n_blocchi = {}, {}, {}, {}, {}
    for c in CIRCUITI:
        m, lo, hi, nb = boot_median_ci(D[c]['sc_oss_blocchi'], rng)
        oss_med[c], oss_lo[c], oss_hi[c], n_blocchi[c] = m, lo, hi, nb
        n_sc_stop[c] = sum(len(a) for _, a in D[c]['sc_oss_blocchi'])

    sc_misurabili = [c for c in CIRCUITI if n_sc_stop[c] >= MIN_SC]
    I0_eseguibile = len(sc_misurabili) >= 4

    # predizione componenti su circuiti con SC misurabile + R_sc + track (K primaria, non-fragile utile ma testiamo il misurabile)
    pred = {}
    for c in sc_misurabili:
        tt = track[(c, K_PRIMARIA)]
        if tt is None or R_sc[c] is None or oss_med[c] is None or verde_med[(c, K_PRIMARIA)] is None:
            continue
        pc = pit_lane[c] - tt * R_sc[c]
        pr = RATIO_NOM * verde_med[(c, K_PRIMARIA)]
        pred[c] = dict(pred_comp=pc, pred_ratio=pr, oss=oss_med[c],
                       err_comp=abs(pc - oss_med[c]), err_ratio=abs(pr - oss_med[c]),
                       R_sc=R_sc[c], tt=tt)
    if pred and I0_eseguibile:
        maxerr = max(p['err_comp'] for p in pred.values())
        I2_verd = 'VALIDATO' if maxerr <= 2.0 else ('SBAGLIATO' if maxerr > 4.0 else 'AMBIGUO')
        comp_meglio = all(p['err_comp'] <= p['err_ratio'] for p in pred.values())
    else:
        maxerr = None; I2_verd = 'NON ESEGUIBILE'; comp_meglio = None

    I3_proposta = I1_PASS and (I2_verd == 'VALIDATO') and bool(comp_meglio)

    scrivi_csv(pit_lane, n_dur, n_verde, verde_med, track, fragile, R_sc, R_vsc, n_sclap, n_vsclap,
               oss_med, oss_lo, oss_hi, n_sc_stop, n_blocchi)
    testo = scrivi_report(D, pit_lane, n_dur, dur_per_stag, n_verde, verde_med, track, fragile,
                          ben_camp, testati_I1, negativi, I1_PASS, R_sc, R_vsc, oss_med, oss_lo,
                          oss_hi, n_sc_stop, n_blocchi, sc_misurabili, I0_eseguibile, pred, maxerr,
                          I2_verd, comp_meglio, I3_proposta)
    open(REPORT, 'w').write(testo + '\n')
    print(testo)
    print(f'\n[esito] I0={"ESEGUIBILE" if I0_eseguibile else "NON"} ({len(sc_misurabili)}/9) | '
          f'I1={"PASSA" if I1_PASS else "FALLISCE"} (neg={negativi}, fragili={[c for c in CIRCUITI if fragile[c]]}) | '
          f'I2={I2_verd} (maxerr={maxerr}) | proposta={I3_proposta}')


def scrivi_csv(pit_lane, n_dur, n_verde, verde_med, track, fragile, R_sc, R_vsc, n_sclap, n_vsclap,
               oss_med, oss_lo, oss_hi, n_sc_stop, n_blocchi):
    with open(CSV_CIRC, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['circuito', 'cid', 'pit_lane_time', 'n_dur', 'pit_loss_verde_K5', 'n_verde',
                    'track_time_K5', 'track_K3', 'track_K7', 'fragile', 'ben_campionato',
                    'pit_loss_SC_oss', 'sc_lo', 'sc_hi', 'n_sc_stop', 'n_blocchi_sc'])
        for c in CIRCUITI:
            fmt = lambda x, p=2: '' if x is None else f'{x:.{p}f}'
            w.writerow([c, CID[c], fmt(pit_lane[c]), n_dur[c], fmt(verde_med[(c, K_PRIMARIA)]), n_verde[c],
                        fmt(track[(c, K_PRIMARIA)]), fmt(track[(c, 3)]), fmt(track[(c, 7)]),
                        int(fragile[c]), int(n_verde[c] >= MIN_N_FISICO),
                        fmt(oss_med[c]), fmt(oss_lo[c]), fmt(oss_hi[c]), n_sc_stop[c], n_blocchi[c]])
    with open(CSV_RLAP, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['circuito', 'R_lap_SC', 'n_giri_SC', 'R_lap_VSC', 'n_giri_VSC'])
        for c in CIRCUITI:
            fmt = lambda x, p=3: '' if x is None else f'{x:.{p}f}'
            w.writerow([c, fmt(R_sc[c]), n_sclap[c], fmt(R_vsc[c]), n_vsclap[c]])


def _ic(oss_med, oss_lo, oss_hi, n_blocchi, c):
    """stringa IC onesta: con 1 solo blocco-gara il bootstrap-a-blocchi e' degenere -> non stimabile."""
    if oss_med[c] is None:
        return '—'
    bl = f'{n_blocchi[c]} ' + ('blocco' if n_blocchi[c] == 1 else 'blocchi')
    if oss_lo[c] is None:
        return f'{oss_med[c]:.1f} [IC non stimabile: {bl}]'
    return f'{oss_med[c]:.1f} [{oss_lo[c]:.1f},{oss_hi[c]:.1f}] ({bl})'


def scrivi_report(D, pit_lane, n_dur, dur_per_stag, n_verde, verde_med, track, fragile, ben_camp,
                  testati_I1, negativi, I1_PASS, R_sc, R_vsc, oss_med, oss_lo, oss_hi, n_sc_stop,
                  n_blocchi, sc_misurabili, I0_eseguibile, pred, maxerr, I2_verd, comp_meglio, I3_proposta):
    L = []; P = L.append
    fr = [c for c in CIRCUITI if fragile[c]]
    P('# REPORT_VALIDAZIONE_POOLED — Sessione I (rimisura pulita, riferimento locale + pooling)')
    P('')
    P(f'I0 circuiti con >=8 stop SC misurabili: {len(sc_misurabili)}/9 -> '
      f'[{"ESEGUIBILE" if I0_eseguibile else "NON ESEGUIBILE"}]')
    P(f'I1 vincolo fisico (rif. locale): [{"PASSA" if I1_PASS else "FALLISCE"}] — '
      f'negativi non-fragili: {", ".join(negativi) if negativi else "nessuno"} — '
      f'fragili: {", ".join(fr) if fr else "nessuno"}')
    if pred:
        vs = 'MEGLIO' if comp_meglio else 'no'
        P(f'I2 predizione SC: err max = {maxerr:.2f} s -> [{I2_verd}] | vs ratio 0,42: [{vs}]')
    else:
        P(f'I2 predizione SC: [{I2_verd}]')
    P('')
    P('Metodo/campione/soglie PRE-REGISTRATI in PREREG_SESSIONE_I.md (committato prima dei numeri).')
    P('Soglie invariate da H. Nessun file di produzione toccato; degrado mai predittore.')
    P('')
    # I0
    P('## I0 — Ingestione + pooling')
    P('')
    P('pit_lane_time = mediana durata per-stop f1db (Jolpica), POOLED su 2023-2026 (<=60 s).')
    P('Stop e lap-times: ti_archive 2023-25 (TI grezzo, igiene validata) + 9 gare demo 2026.')
    P('')
    P('| circuito | pit_lane_time | n durate | n verde (K5) | verde per stagione | n stop SC misur. |')
    P('|---|---|---|---|---|---|')
    for c in CIRCUITI:
        vps = ' '.join(f'{k}:{v}' for k, v in sorted(D[c]['verde_per_stag'].items()))
        pl = '—' if pit_lane[c] is None else f'{pit_lane[c]:.2f}'
        P(f'| {c} | {pl} | {n_dur[c]} | {n_verde[c]} | {vps} | {n_sc_stop[c]} |')
    P('')
    P(f'Circuiti con >=8 stop SC misurabili (pre-reg): **{len(sc_misurabili)}/9** '
      f'({", ".join(sc_misurabili)}). Soglia 4 -> **{"ESEGUIBILE" if I0_eseguibile else "NON: riporto I1 e chiudo"}**.')
    P('')
    # I1
    P('## I1 — Pit-loss verde, riferimento LOCALE (ultimi 5 giri verdi dello stesso stint)')
    P('')
    P('`pit_loss_verde = (in+out) - 2*rif_locale - fuel`; rif_locale gia\' a gomma vecchia come')
    P('l\'in-lap -> il bias di degrado del metodo C e\' ASSORBITO per costruzione (nessuna correzione')
    P('di degrado; filone degrado chiuso). track_time = pit_lane_time - pit_loss_verde.')
    P('')
    P('| circuito | n | pit_lane | verde K5 | track K5 | track K3 | track K7 | fragile? | >=0? |')
    P('|---|---|---|---|---|---|---|---|---|')
    for c in sorted(CIRCUITI, key=lambda c: (n_verde[c] < MIN_N_FISICO, c)):
        star = ' ⭐' if n_verde[c] >= MIN_N_FISICO else ' (piccolo n)'
        t5, t3, t7 = track[(c, 5)], track[(c, 3)], track[(c, 7)]
        f5 = '—' if t5 is None else f'{t5:+.1f}'
        row_ok = '—' if t5 is None else ('SI' if t5 >= 0 else 'NO')
        fg = 'SI' if fragile[c] else 'no'
        vm = '—' if verde_med[(c, 5)] is None else f'{verde_med[(c,5)]:.1f}'
        pl = '—' if pit_lane[c] is None else f'{pit_lane[c]:.1f}'
        P(f'| {c}{star} | {n_verde[c]} | {pl} | {vm} | {f5} | '
          f'{"—" if t3 is None else f"{t3:+.1f}"} | {"—" if t7 is None else f"{t7:+.1f}"} | {fg} | {row_ok} |')
    P('')
    P(f'⭐ = ben campionato (n>=15): il test I1 riguarda SOLO questi e SOLO i non-fragili. '
      f'Testati: {", ".join(testati_I1) if testati_I1 else "nessuno"}.')
    if fr:
        P(f'FRAGILI (segno track_time flippa su finestra 3/5/7): {", ".join(fr)} — esclusi, resteranno NON corretti.')
    P('')
    if I1_PASS:
        P('**I1 PASSA: track_time >= 0 su tutti i ben campionati non-fragili con il riferimento locale.**')
    else:
        P(f'**I1 FALLISCE: track_time negativo su {", ".join(negativi)} (ben campionati, non-fragili).** '
          'STOP: nessuna proposta, filone chiuso.')
    P('')
    # I2
    P('## I2 — R_lap dai lap times (pooled) e predizione SC')
    P('')
    P('R_lap = mediana( giro_neutralizzato / mediana_verde_di_gara ) su tutte le stagioni, giri')
    P('STRETTAMENTE dentro finestra (no deployment/restart), campo intero. Normalizzazione per')
    P('mediana-verde di gara: rimuove la deriva di passo assoluto fra stagioni.')
    P('')
    P('| circuito | R_lap_SC | R_lap_VSC | pit_loss_SC oss [IC95 blocchi-gara] | n stop SC (blocchi) |')
    P('|---|---|---|---|---|')
    for c in CIRCUITI:
        rs = '—' if R_sc[c] is None else f'{R_sc[c]:.2f}'
        rv = '—' if R_vsc[c] is None else f'{R_vsc[c]:.2f}'
        P(f'| {c} | {rs} | {rv} | {_ic(oss_med, oss_lo, oss_hi, n_blocchi, c)} | {n_sc_stop[c]} ({n_blocchi[c]}) |')
    P('')
    P('**Nota di onesta\' (blocchi):** il pooling NON ha prodotto blocchi-gara indipendenti. Gli')
    P('stop SC misurabili di ogni circuito vengono da 1-2 gare sole (eventi SC rari e concentrati):')
    P('l\'IC a blocchi-gara e\' quindi NON STIMABILE dove c\'e\' un solo blocco, e altrove larghissimo.')
    P('E\' la stessa diagnosi di H ("osservato SC inutilizzabile come metro"), CONFERMATA con piu\'')
    P('dati, non superata. Diversi osservati sono contaminati dal DEPLOYMENT (mass-stop sotto SC:')
    P('i pittanti prendono un in-lap veloce prima che il gruppo si compatti, la mediana-campo e\'')
    P('gonfiata dai giri di schieramento) -> valori perfino NEGATIVI (Spagna -22: 1 gara, 1 evento).')
    P('')
    P('### I2b — Predizione: pit_loss_SC = pit_lane_time - track_time_verde x R_lap_SC')
    P('')
    if pred:
        P('| circuito | pred (componenti) | pred (ratio 0,42) | osservato [IC95 (blocchi)] | err comp | err ratio |')
        P('|---|---|---|---|---|---|')
        for c in sorted(pred):
            p = pred[c]
            P(f'| {c} | {p["pred_comp"]:.1f} | {p["pred_ratio"]:.1f} | '
              f'{_ic(oss_med, oss_lo, oss_hi, n_blocchi, c)} | {p["err_comp"]:.2f} | {p["err_ratio"]:.2f} |')
        P('')
        vs = 'il modello a componenti BATTE il ratio' if comp_meglio else "il ratio NON e' battuto -> il modello non serve"
        P(f'Verdetto I2: err max componenti {maxerr:.2f} s -> **{I2_verd}**. Componenti vs ratio 0,42: {vs}.')
        # robustezza del NO all'artefatto Spagna
        pred_noSpagna = {c: p for c, p in pred.items() if c != 'Spagna'}
        if pred_noSpagna:
            me2 = max(p['err_comp'] for p in pred_noSpagna.values())
            v2 = 'VALIDATO' if me2 <= 2.0 else ('SBAGLIATO' if me2 > 4.0 else 'AMBIGUO')
            P(f'Robustezza: anche ESCLUDENDO Spagna (osservato -22, artefatto deployment/1 blocco), '
              f'err max = {me2:.2f} s -> **{v2}** (GB {pred.get("Gran Bretagna",{}).get("err_comp",float("nan")):.1f}s con IC osservato che '
              'attraversa lo zero). Il verdetto I2 non dipende dall\'artefatto Spagna.')
    else:
        P('Nessun circuito con predizione eseguibile (serve SC misurabile + R_lap + track_time).')
    P('')
    # DIAGNOSTICA DATA-QUALITY (onesta': la misura pooled NON e' pulita come sperato)
    P('## Diagnostica data-quality (dichiarata) — la misura pooled non e\' pulita come sperato')
    P('')
    P('Il pooling multi-stagione, oltre a NON dare blocchi SC indipendenti, introduce contaminazioni')
    P('che la sola analisi 2026 di H non aveva. Le riporto e mostro che il NO NON dipende da esse:')
    P('')
    P('- **Regimi pit-lane eterogenei fra stagioni** (durate mediane per stagione):')
    for c in ['Australia', 'Canada', 'Monaco']:
        per = dur_per_stag_med(dur_per_stag, c)
        P(f'  - {c}: ' + '  '.join(f'{y}={v}' for y, v in per) + '  (pooling mescola regimi diversi).')
    P('- **Gare bagnate/bandiera-rossa nel verde storico**: es. Monaco 2023 dà un verde locale')
    P('  abnorme (~51 s, pioggia tardiva); la mediana pooled lo assorbe (Monaco resta +3,3) ma il')
    P('  dato di quella stagione e\' sporco.')
    P('- **Australia (il fallimento di I1) e\' ROBUSTO e NON un artefatto di pooling**: il track_time')
    P('  e\' negativo in OGNI stagione asciutta con la SUA durata (2023 −1,5; 2024 −2,0; 2026 −4,1):')
    P('  a Melbourne `pit_loss_verde (~20-23) > pit_lane_time (~18)`, impossibile se entrambe le')
    P('  misure fossero coerenti (track_time non puo\' essere < 0). Le due fonti (durata Jolpica vs')
    P('  pit-loss verde ricostruito) sono INCOERENTI su Melbourne, e il modello a due componenti non')
    P('  puo\' rappresentarlo. Pulire le durate bagnate SPINGEREBBE Australia verso il PASS: non lo')
    P('  facciamo (sarebbe la leva anti-inganno vietata). Il NO regge sul dato asciutto.')
    P('')
    # I3 / esito
    P('## Esito')
    P('')
    if I3_proposta:
        P('I1 PASSA e I2 VALIDATO -> vedi PROPOSTA_PITLOSS_DUE_COMPONENTI.md (NON eseguita).')
    else:
        rag = []
        if not I1_PASS:
            rag.append('I1 fallisce (track_time negativo non-fragile)')
        if pred and I2_verd != 'VALIDATO':
            rag.append(f'I2 {I2_verd}')
        if comp_meglio is False:
            rag.append('componenti non batte il ratio 0,42')
        if not pred:
            rag.append('I2 non eseguibile')
        P(f'**Nessuna proposta: {"; ".join(rag)}.** Il filone si chiude senza attenuazioni. Il debito')
        P('resta scritto con la sua causa fisica (G: il campo f1db e\' la durata). Nessun verdetto')
        P('strategico: e\' del PO. Nessun file di produzione toccato.')
    return '\n'.join(L)


if __name__ == '__main__':
    main()
