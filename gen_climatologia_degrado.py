"""gen_climatologia_degrado.py — CLIMATOLOGIA DEL DEGRADO (statistica DESCRITTIVA).

Distribuzione di cio' che il degrado marginale E' STATO, per (mescola, circuito 2026),
pesata verso il 2026, per alimentare il gancio v1.5 con tre scenari ETICHETTATI COME
SCENARI. NON e' una riapertura del degrado-predizione (chiuso): nessun gamma fisico
universale, nessuna stabilita' cross-anno rivendicata, la parola "previsto" non esiste.

Protocollo: PREREG_SESSIONE_CLIM.md (committata prima dei numeri).
CONFINE: sola lettura su data/ti_archive/ + data/ti_cache/ + pit_loss_circuito_f1db.csv;
scrive SOLO data/climatologia_degrado.csv e data/CLIMATOLOGIA_REPORT.txt.
Kernel, modulo pit, gancio, golden, produzione: MAI toccati.

Uso:
  python3 gen_climatologia_degrado.py           # calcola, stampa K1/K2/K3, verifica CSV se esiste
  python3 gen_climatologia_degrado.py --write   # scrive CSV + report (writer auto-verificato)

DEFINIZIONE OPERATIVA (dalla prereg, fissata in esplorazione PRIMA dei numeri finali):
  - tempo fuel-corretto convenzione kernel (3/70): t_fc = t - max(0, 70-(70/N)*(lap-1))*(3/70)
  - degrado marginale dello stint = pendenza OLS di t_fc su life, sui giri di PLATEAU
    (life >= L_PLATEAU_MIN = 3; esplorazione: pendenza insensibile a Lmin 3->5, cliff
    NON emerso sulle mediane -> nessun taglio di coda)
  - riferimento LOCALE allo stint (mai passo di gara intera); l'evoluzione pista resta
    dentro: bias verso il basso, DICHIARATO
  - warm-in (struttura emersa): delta mediano t_fc(life=2) - mediana t_fc(life 4-6)
    dello stint, riportato per combinazione dove n_giri_life2 >= 10

IGIENE (mandato): verdi status=='1', no in/out-lap (copre il drive-through: righe pit
valorizzate), slick, 2<=lap<=N-1, stint >= 5 giri usabili, outlier 1.07x mediana stint.
GUARDIA GARA-BAGNATA (operativizza "bagnato = regime separato mai mescolato", decisa in
esplorazione PRIMA dei numeri finali: British 2025 su pista che si asciuga da' pendenze
~-0.4 s/giro, artefatto di regime misto): una gara con quota giri INT/WET > 5% del
totale giri con compound noto e' ESCLUSA per intero dalla climatologia.

PESI DI RECENZA (prereg, non ritoccati): 2026=1.0, 2025=0.5, 2024=0.25, 2023=0.125.
Quantili pesati: interpolazione lineare sulla ripartizione dei pesi cumulati (Hazen,
c_i = (W_{<=i} - w_i/2)/W). Bootstrap K2: blocchi = gare 2026, B=1000, seed=20260716.
"""
import sys, os, csv, json, statistics as st
import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
SLICK = ('SOFT', 'MEDIUM', 'HARD')
WET = ('INTERMEDIATE', 'WET')
FUEL_COEFF = 3.0 / 70.0
L_PLATEAU_MIN = 3
MIN_STINT_LAPS = 5          # stint qualificato (mandato: >=5 giri verdi usabili)
SOGLIA_OUTLIER = 1.07
QUOTA_WET_MAX = 0.05        # guardia gara-bagnata (dichiarata)
PESI = {2023: 0.125, 2024: 0.25, 2025: 0.5, 2026: 1.0}

# GUARDIA DEGRADO-NON-MISURABILE (ratifica PO 2026-07-20). Circuiti dove il passo NON e'
# governato dal degrado ma dalla track-position: chi sta davanti detta il ritmo (spesso
# frenando apposta), quindi la pendenza-life misura traffico, non gomma. Esclusi da
# climatologia, K2, K3 e bande. Li' il gancio resta banda-zero PER SEMPRE e la strategia
# e' dominio del modulo pit/track-position. Coerente con: K2 Monaco 26.7% (peggiore),
# K3 SOFT@monaco -0.38 (coda-traffico), arco pit-loss (Monaco gia' inciso "coda-traffico").
CID_NO_DEGRADO = ('monaco',)

# K1 (prereg): informativa <=> n_stint>=10 & n_gare>=2 & (IQR_cond<IQR_glob o
#              |med_cond-med_glob|>IQR_glob/4)
K1_MIN_STINT, K1_MIN_GARE = 10, 2
# K2 (prereg): copertura pooled 2026 in [q25,q75] leave-2026-out >= 40% -> TRASFERIBILE
K2_SOGLIA = 0.40
K2_B, K2_SEED = 1000, 20260716
# K3 (prereg): banda ordinata/finita; centrale in [-0.10,+0.35], max<=0.60 s/giro;
#              (max-min)*5 <= 25% pit-loss circuito; conteggi coerenti
K3_CENTRALE = (-0.10, 0.35)
K3_MAX = 0.60
K3_UTIL_RATIO, K3_UTIL_LAPS = 0.25, 5

CSV_PATH = os.path.join(ROOT, 'data', 'climatologia_degrado.csv')
TXT_PATH = os.path.join(ROOT, 'data', 'CLIMATOLOGIA_REPORT.txt')
PITL_PATH = os.path.join(ROOT, 'data', 'pit_loss_circuito_f1db.csv')
COLS = ['compound', 'cid', 'banda_min_q25', 'banda_centrale_med', 'banda_max_q75',
        'n_stint', 'n_gare', 'peso_recenza_eff', 'quota_peso_2026',
        'warmin_life2_med', 'n_giri_life2', 'flag_k1', 'include_2026']
DECIMALI, TOL = 4, 5e-5

# mappatura DICHIARATA cartella-archivio -> circuitId 2026 (verificata a mano su
# data/calendario_2026.json). Gare d'archivio su circuiti FUORI dal calendario 2026
# (Bahrain, Jeddah, Imola) NON entrano. Madrid (madring): nuovo, nessuna storia.
FOLDER2CID = {
    'Abu Dhabi Grand Prix': 'yas-marina',   'Australian Grand Prix': 'melbourne',
    'Austrian Grand Prix': 'spielberg',     'Azerbaijan Grand Prix': 'baku',
    'Belgian Grand Prix': 'spa-francorchamps', 'British Grand Prix': 'silverstone',
    'Canadian Grand Prix': 'montreal',      'Chinese Grand Prix': 'shanghai',
    'Dutch Grand Prix': 'zandvoort',        'Hungarian Grand Prix': 'hungaroring',
    'Italian Grand Prix': 'monza',          'Japanese Grand Prix': 'suzuka',
    'Las Vegas Grand Prix': 'las-vegas',    'Mexico City Grand Prix': 'mexico-city',
    'Miami Grand Prix': 'miami',            'Monaco Grand Prix': 'monaco',
    'Qatar Grand Prix': 'lusail',           'Singapore Grand Prix': 'marina-bay',
    'Spanish Grand Prix': 'catalunya',      'São Paulo Grand Prix': 'interlagos',
    'United States Grand Prix': 'austin',
}
TICACHE2CID = {   # 2026, data/ti_cache/<file>.json
    'Australian': 'melbourne', 'Austrian': 'spielberg', 'Barcelona': 'catalunya',
    'Canadian': 'montreal', 'Chinese': 'shanghai', 'Japanese': 'suzuka',
    'Miami': 'miami', 'Monaco': 'monaco',
}


def nullo(x):
    return x is None or str(x) == 'None'


def gare():
    """[(anno, cid, etichetta, path)] — solo circuiti del calendario 2026."""
    out = []
    for anno in (2023, 2024, 2025):
        base = os.path.join(ROOT, 'data', 'ti_archive', str(anno))
        for folder in sorted(os.listdir(base)):
            cid = FOLDER2CID.get(folder)
            p = os.path.join(base, folder, 'Race.json')
            if cid and os.path.exists(p):
                out.append((anno, cid, f'{anno} {folder}', p))
    for f, cid in sorted(TICACHE2CID.items()):
        out.append((2026, cid, f'2026 {f}', os.path.join(ROOT, 'data', 'ti_cache', f + '.json')))
    out.append((2026, 'silverstone', '2026 British',
                os.path.join(ROOT, 'data', 'ti_archive', '2026', 'British Grand Prix', 'Race.json')))
    # riesecuzione post-Spa (TODO voce 7): 10a gara 2026 nel campione; KPI intatti.
    # Spa 2026: asciutta (quota INT/WET 0%), passa la guardia gara-bagnata.
    p_spa = os.path.join(ROOT, 'data', 'ti_archive', '2026', 'Belgian Grand Prix', 'Race.json')
    if os.path.exists(p_spa):
        out.append((2026, 'spa-francorchamps', '2026 Belgian', p_spa))
    return [g for g in out if g[1] not in CID_NO_DEGRADO]   # guardia degrado-non-misurabile


def carica(path):
    d = json.load(open(path))
    n = len(d['time'])
    return [{k: d[k][i] for k in ('drv', 'lap', 'time', 'life', 'stint',
                                  'compound', 'status', 'pin', 'pout')} for i in range(n)]


def quota_wet(rows):
    con_c = [r for r in rows if isinstance(r['compound'], str)]
    if not con_c:
        return 1.0
    return sum(1 for r in con_c if r['compound'] in WET) / len(con_c)


def stint_di_gara(rows):
    """igiene mandato -> {(drv,stint): [righe usabili ordinate per life, con t_fc]}."""
    N = max(int(r['lap']) for r in rows if r['lap'] is not None)
    keep = []
    for r in rows:
        if not all(isinstance(r[k], (int, float)) for k in ('lap', 'time', 'life', 'stint')):
            continue
        if str(r['status']) != '1':
            continue
        if not (nullo(r['pin']) and nullo(r['pout'])):
            continue
        if r['compound'] not in SLICK:
            continue
        L = int(r['lap'])
        if L < 2 or L > N - 1:
            continue
        if int(r['life']) < 2:      # out-lap/life1 fuori; life=2 tenuto per il warm-in
            continue
        keep.append(r)
    per_stint = {}
    for r in keep:
        per_stint.setdefault((r['drv'], int(r['stint'])), []).append(r)
    fpl = 70.0 / N
    out = {}
    for k, rs in per_stint.items():
        med = st.median([r['time'] for r in rs])
        rs = [r for r in rs if r['time'] <= SOGLIA_OUTLIER * med]      # F7
        if len(rs) < MIN_STINT_LAPS:
            continue
        if len({r['compound'] for r in rs}) != 1:
            continue
        for r in rs:
            r['tfc'] = r['time'] - max(0.0, 70.0 - fpl * (int(r['lap']) - 1)) * FUEL_COEFF
        out[k] = sorted(rs, key=lambda r: int(r['life']))
    return out


def misura_stint(rs):
    """(pendenza plateau, warmin_delta o None). None se il plateau non misura."""
    plateau = [r for r in rs if int(r['life']) >= L_PLATEAU_MIN]
    if len(plateau) < 3 or len({int(r['life']) for r in plateau}) < 2:
        return None, None
    x = np.array([int(r['life']) for r in plateau], float)
    y = np.array([r['tfc'] for r in plateau], float)
    slope = float(np.polyfit(x, y, 1)[0])
    ref = [r['tfc'] for r in rs if 4 <= int(r['life']) <= 6]
    g2 = [r['tfc'] for r in rs if int(r['life']) == 2]
    warmin = (st.median(g2) - st.median(ref)) if (len(ref) >= 2 and g2) else None
    return slope, warmin


def raccogli():
    """stint qualificati con misura + registro gare escluse dalla guardia bagnato."""
    stints, escluse = [], []
    for anno, cid, label, path in gare():
        rows = carica(path)
        qw = quota_wet(rows)
        if qw > QUOTA_WET_MAX:
            escluse.append((label, qw))
            continue
        for (drv, sid), rs in stint_di_gara(rows).items():
            slope, warmin = misura_stint(rs)
            if slope is None:
                continue
            stints.append(dict(anno=anno, cid=cid, gara=label, drv=drv,
                               comp=rs[0]['compound'], marg=slope, warmin=warmin,
                               peso=PESI[anno]))
    return stints, escluse


def q_pesato(vals, pesi, p):
    """quantile pesato, interpolazione lineare su c_i=(W_<=i - w_i/2)/W (Hazen)."""
    idx = np.argsort(vals)
    v = np.asarray(vals, float)[idx]
    w = np.asarray(pesi, float)[idx]
    W = w.sum()
    c = (np.cumsum(w) - 0.5 * w) / W
    return float(np.interp(p, c, v))


def banda(stint_sel):
    v = [s['marg'] for s in stint_sel]
    w = [s['peso'] for s in stint_sel]
    return (q_pesato(v, w, 0.25), q_pesato(v, w, 0.50), q_pesato(v, w, 0.75))


def per_combo(stints):
    combi = {}
    for s in stints:
        combi.setdefault((s['comp'], s['cid']), []).append(s)
    return combi


def righe_csv(stints, include_2026):
    """righe finali + distribuzione globale pesata (per K1)."""
    sel = stints if include_2026 else [s for s in stints if s['anno'] != 2026]
    gv = [s['marg'] for s in sel]
    gw = [s['peso'] for s in sel]
    g25, g50, g75 = q_pesato(gv, gw, .25), q_pesato(gv, gw, .50), q_pesato(gv, gw, .75)
    iqr_glob = g75 - g25
    righe = []
    for (comp, cid), ss in sorted(per_combo(sel).items(), key=lambda kv: (kv[0][1], kv[0][0])):
        q25, med, q75 = banda(ss)
        n_stint = len(ss)
        n_gare = len({s['gara'] for s in ss})
        pesi_tot = sum(s['peso'] for s in ss)
        quota26 = sum(s['peso'] for s in ss if s['anno'] == 2026) / pesi_tot
        wm = [s['warmin'] for s in ss if s['warmin'] is not None]
        informativa = (n_stint >= K1_MIN_STINT and n_gare >= K1_MIN_GARE and
                       ((q75 - q25) < iqr_glob or abs(med - g50) > iqr_glob / 4))
        righe.append(dict(
            compound=comp, cid=cid, banda_min_q25=q25, banda_centrale_med=med,
            banda_max_q75=q75, n_stint=n_stint, n_gare=n_gare,
            peso_recenza_eff=pesi_tot / n_stint, quota_peso_2026=quota26,
            warmin_life2_med=(st.median(wm) if len(wm) >= 10 else None),
            n_giri_life2=len(wm),
            flag_k1='INFORMATIVA' if informativa else 'NON-INFORMATIVA',
            include_2026=include_2026))
    glob = dict(q25=g25, med=g50, q75=g75, iqr=iqr_glob, n=len(sel))
    return righe, glob


# ------------------------------------------------------------------ K2
def k2_coerenza(stints):
    """bande leave-2026-out -> copertura degli stint 2026 in [q25,q75]."""
    pre = [s for s in stints if s['anno'] != 2026]
    post = [s for s in stints if s['anno'] == 2026]
    bande = {}
    for (comp, cid), ss in per_combo(pre).items():
        if len(ss) >= K1_MIN_STINT and len({s['gara'] for s in ss}) >= K1_MIN_GARE:
            bande[(comp, cid)] = banda(ss)
    dentro, testati = [], []
    for s in post:
        b = bande.get((s['comp'], s['cid']))
        if b is None:
            continue
        testati.append(s)
        dentro.append(1 if b[0] <= s['marg'] <= b[2] else 0)
    cov = (sum(dentro) / len(dentro)) if dentro else float('nan')
    # bootstrap a blocchi: le GARE 2026 sono i blocchi
    per_gara = {}
    for s, d in zip(testati, dentro):
        per_gara.setdefault(s['gara'], []).append(d)
    gare26 = sorted(per_gara)
    rng = np.random.default_rng(K2_SEED)
    boots = []
    for _ in range(K2_B):
        picks = rng.choice(len(gare26), size=len(gare26), replace=True)
        flat = [d for i in picks for d in per_gara[gare26[i]]]
        if flat:
            boots.append(sum(flat) / len(flat))
    ci = (float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))) if boots else (float('nan'),) * 2
    # dettaglio per compound e per gara
    per_comp = {}
    for s, d in zip(testati, dentro):
        per_comp.setdefault(s['comp'], []).append(d)
    det_comp = {c: (sum(v) / len(v), len(v)) for c, v in per_comp.items()}
    det_gara = {g: (sum(v) / len(v), len(v)) for g, v in sorted(per_gara.items())}
    return dict(cov=cov, n=len(dentro), ci=ci, per_comp=det_comp, per_gara=det_gara,
                n_bande=len(bande), esito='TRASFERIBILE' if cov >= K2_SOGLIA else 'STOP')


# ------------------------------------------------------------------ K3
def k3_sanita(righe):
    pit = {}
    with open(PITL_PATH, newline='') as f:
        for r in csv.DictReader(f):
            pit[r['cid']] = float(r['pit_loss_s'])
    viol = []
    for r in righe:
        if r['flag_k1'] != 'INFORMATIVA':
            continue
        tag = f"{r['compound']}@{r['cid']}"
        lo, ce, hi = r['banda_min_q25'], r['banda_centrale_med'], r['banda_max_q75']
        if not (np.isfinite(lo) and np.isfinite(ce) and np.isfinite(hi) and lo <= ce <= hi):
            viol.append(f"{tag}: banda non ordinata/finita ({lo:.4f},{ce:.4f},{hi:.4f})")
        if not (K3_CENTRALE[0] <= ce <= K3_CENTRALE[1]):
            viol.append(f"{tag}: centrale {ce:+.4f} fuori da [{K3_CENTRALE[0]},{K3_CENTRALE[1]}]")
        if hi > K3_MAX:
            viol.append(f"{tag}: max {hi:+.4f} > {K3_MAX}")
        pl = pit.get(r['cid'])
        if pl is None:
            viol.append(f"{tag}: pit-loss circuito assente ({r['cid']})")
        elif (hi - lo) * K3_UTIL_LAPS > K3_UTIL_RATIO * pl:
            viol.append(f"{tag}: larghezza*{K3_UTIL_LAPS} = {(hi-lo)*K3_UTIL_LAPS:.2f}s "
                        f"> {K3_UTIL_RATIO:.0%} del pit-loss {pl:.2f}s")
        if r['n_stint'] < K1_MIN_STINT or r['n_gare'] < K1_MIN_GARE:
            viol.append(f"{tag}: conteggi incoerenti col flag K1")
    return viol


# ------------------------------------------------------------------ CSV
def fmt(x):
    if x is None:
        return ''
    if isinstance(x, bool):
        return str(x)
    if isinstance(x, float):
        s = f"{x:.{DECIMALI}f}"
        zero = '0.' + '0' * DECIMALI
        return zero if s == '-' + zero else s
    return str(x)


def scrivi(righe):
    with open(CSV_PATH, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(COLS)
        for r in righe:
            w.writerow([fmt(r[c]) for c in COLS])


def verifica(righe):
    if not os.path.exists(CSV_PATH):
        print(f"(CSV assente: {CSV_PATH} — usa --write)\n")
        return None
    with open(CSV_PATH, newline='') as f:
        old = {(r['compound'], r['cid']): r for r in csv.DictReader(f)}
    disc = 0
    for r in righe:
        v = old.get((r['compound'], r['cid']))
        if v is None:
            disc += 1
            continue
        for c in COLS:
            a, b = fmt(r[c]), v[c]
            try:
                if abs(float(a) - float(b)) > TOL:
                    disc += 1
                    break
            except ValueError:
                if a != b:
                    disc += 1
                    break
    if len(old) != len(righe):
        disc += abs(len(old) - len(righe))
    print(f"auto-verifica CSV: {len(righe)} righe, {disc} discrepanze -> "
          f"{'OK (riproducibile)' if disc == 0 else 'DISCREPANZE — NON fidarsi'}\n")
    return disc


# ------------------------------------------------------------------ main
def main():
    stints, escluse = raccogli()
    k2 = k2_coerenza(stints)
    include_2026 = (k2['esito'] == 'TRASFERIBILE')
    righe, glob = righe_csv(stints, include_2026)
    viol = k3_sanita(righe)
    inf = [r for r in righe if r['flag_k1'] == 'INFORMATIVA']

    L = []
    w = L.append
    w('=' * 78)
    w('CLIMATOLOGIA DEGRADO — descrittivo per (mescola, circuito 2026), pesato al 2026')
    w('=' * 78)
    w('Protocollo: PREREG_SESSIONE_CLIM.md. Scenari etichettati come scenari; nessuna')
    w('parola sul futuro. Pesi 2026/25/24/23 = 1/.5/.25/.125; quantili pesati (Hazen).')
    w('')
    w(f'STINT QUALIFICATI: {len(stints)}  (2023-25: {sum(1 for s in stints if s["anno"] != 2026)}, '
      f'2026: {sum(1 for s in stints if s["anno"] == 2026)})')
    w(f'GARE ESCLUSE dalla guardia bagnato (quota INT/WET > {QUOTA_WET_MAX:.0%}): {len(escluse)}')
    for label, qw in escluse:
        w(f'  - {label}  (quota bagnato {qw:.1%})')
    w('')
    w(f'DISTRIBUZIONE GLOBALE pesata ({"con" if include_2026 else "senza"} 2026): '
      f'med {glob["med"]:+.4f}, IQR [{glob["q25"]:+.4f},{glob["q75"]:+.4f}] '
      f'(larghezza {glob["iqr"]:.4f}), n={glob["n"]}')
    w('')
    w('-' * 78)
    n_tot = len(righe)
    w(f"K1 — INFORMATIVITA': combinazioni informative {len(inf)}/{n_tot}")
    w('  criterio: n_stint>=10 & n_gare>=2 & (IQR_cond < IQR_glob | '
      '|med_cond-med_glob| > IQR_glob/4)')
    for r in inf:
        w(f'  {r["compound"]:6s} @ {r["cid"]:18s} banda [{r["banda_min_q25"]:+.4f}, '
          f'{r["banda_centrale_med"]:+.4f}, {r["banda_max_q75"]:+.4f}]  '
          f'n_stint={r["n_stint"]:3d} n_gare={r["n_gare"]} quota26={r["quota_peso_2026"]:.2f}')
    w('')
    w('-' * 78)
    w(f'K2 — COERENZA 2026 (bande leave-2026-out, soglia >= {K2_SOGLIA:.0%})')
    w(f'  stint 2026 testati: {k2["n"]} (su {k2["n_bande"]} bande valide leave-2026-out)')
    w(f'  copertura pooled in [q25,q75]: {k2["cov"]:.1%}  '
      f'IC95 bootstrap blocchi-gara [{k2["ci"][0]:.1%}, {k2["ci"][1]:.1%}]  (B={K2_B}, seed={K2_SEED})')
    for c, (cv, n) in sorted(k2['per_comp'].items()):
        w(f'    {c:6s}: {cv:.1%} (n={n})')
    for g, (cv, n) in k2['per_gara'].items():
        w(f'    {g:22s}: {cv:.1%} (n={n})')
    w(f'  => K2: {k2["esito"]}'
      + ('' if include_2026 else '  (CSV archiviato in versione leave-2026-out, gancio resta banda-zero)'))
    w('')
    w('-' * 78)
    w(f"K3 — SANITA' FISICA (sulle {len(inf)} righe informative)")
    if viol:
        w(f'  VIOLAZIONI ({len(viol)}):')
        for v in viol:
            w('   - ' + v)
    else:
        w("  PASSA: zero violazioni (ordine, magnitudini, utilita' vs pit-loss, conteggi).")
    w('')
    w('NOTE DI FORMA (esplorazione, incise per il lettore del CSV):')
    w('  - plateau ~lineare in life; L_PLATEAU_MIN=3 (pendenza insensibile 3->5)')
    w('  - warm-in reale sui primi 2-3 giri (colonna warmin_life2_med dove n>=10)')
    w('  - cliff NON emerso sulle mediane (caveat sopravvivenza: gli stint tirati oltre')
    w('    il limite non esistono nei dati)')
    w("  - il riferimento locale lascia dentro l'evoluzione pista: bias verso il basso")
    w('=' * 78)
    testo = '\n'.join(L)
    print(testo)

    if '--write' in sys.argv:
        scrivi(righe)
        open(TXT_PATH, 'w').write(testo + '\n')
        print(f'\nSCRITTO {CSV_PATH} ({len(righe)} righe) e {TXT_PATH}')
    else:
        print()
        verifica(righe)


if __name__ == '__main__':
    main()
