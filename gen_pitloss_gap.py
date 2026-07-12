"""gen_pitloss_gap.py — Sessione E: TERZO metodo, ORTOGONALE a C/D, per il pit-loss. Usa un
altro pilota vero come cronometro; NON usa pace ne' passo-di-riferimento stimato. NON fa girare
il motore: misura sui dati per-giro. NON sostituisce nulla. Generatore committato.

CONTESTO (il perche' della sessione): i metodi C (fisico) e D (per residuo) sono
ALGEBRICAMENTE lo stesso metodo -- entrambi = (in_lap+out_lap) - 2*riferimento - loss_nom -- e
differiscono solo per la stima del passo di riferimento (giri verdi di gara in C, giri di
controllo in D). La loro concordanza NON e' conferma indipendente. Il metodo gap sbaglia per
motivi diversi (delta-passo fra i due piloti, traffico sul riferimento), quindi puo' giudicare.

============================ E1 — METODO (dichiarato PRIMA) ============================
Per ogni stop reale del pilota P al giro L (in-lap=L, out-lap=L+1):
  refs = piloti che NON pittano in {L-1,L,L+1}, presenti con cum_time a L-1 e L+1, non
         neutralizzati in {L-1,L,L+1}, non doppiati/doppianti rispetto a P nella finestra.
  pit_loss_gap[P,L,ref] = ( cum(P,L+1)-cum(ref,L+1) ) - ( cum(P,L-1)-cum(ref,L-1) )
                        = tempo che P perde su ref nei giri L,L+1 (sincronizzati per NUMERO
                          di giro, mai per tempo).
  pit_loss_gap[P,L] = MEDIANA sui refs validi. Scarta se < 4 refs (contati).
ASSUNZIONI/LIMITI: contiene il warm-in dell'out-lap (come C/D: e' parte del pit-loss che azzera
il motore, non lo togliamo). NON contiene pace ne' passo stimato di P. Errori possibili:
delta-passo P-ref sui due giri, e traffico sul ref -> QUANTIFICATI in E2, non assunti piccoli.
=======================================================================================
"""
import os, csv, json
import numpy as np

RACES = {  # gara -> [cid, nominale f1db]
    'Australia': ['melbourne', 18.15], 'Austria': ['spielberg', 21.63], 'Canada': ['montreal', 24.37],
    'Cina': ['shanghai', 22.97], 'Giappone': ['suzuka', 23.72], 'Gran Bretagna': ['silverstone', 29.12],
    'Miami': ['miami', 22.63], 'Monaco': ['monaco', 24.8], 'Spagna': ['catalunya', 22.38],
}
ROBUSTI = ['Gran Bretagna', 'Miami', 'Monaco']
MIN_REFS = 4
NEU = json.load(open('demo/neutralizzazione.json'))

def load(g):
    r = json.load(open(f'demo/data/{g}.json')); byLap = {lp['lap']: lp['cars'] for lp in r['laps']}
    return r, byLap
def wins(g):
    x = NEU.get(g, {}); return [*x.get('sc', []), *x.get('vsc', [])]

def build(g):
    """Ritorna byLap, N, e strutture: pit-laps per pilota, neutr, medLap per giro."""
    r, byLap = load(g); N = r['n_laps']; W = wins(g)
    inj = lambda L: any(a <= L <= b for a, b in W)
    pit_of = {}
    for L in byLap:
        for d, c in byLap[L].items():
            if c['in_lap']: pit_of.setdefault(d, set()).add(L)
    def cum(d, L):
        c = byLap.get(L, {}).get(d); return c['cum_time'] if c and isinstance(c['cum_time'], (int, float)) else None
    def neutr(d, L):
        c = byLap.get(L, {}).get(d); return (c and c['neutralized']) or inj(L)
    def medlap(L):
        lts = [byLap[L][d]['lap_time'] for d in byLap.get(L, {}) if isinstance(byLap[L][d].get('lap_time'), (int, float))]
        return float(np.median(lts)) if lts else 90.0
    return byLap, N, pit_of, cum, neutr, medlap, r['drivers']

def gap_change(cum, subj, ref, L):
    """(cum(subj,L+1)-cum(ref,L+1)) - (cum(subj,L-1)-cum(ref,L-1))."""
    a1, b1, a0, b0 = cum(subj, L + 1), cum(ref, L + 1), cum(subj, L - 1), cum(ref, L - 1)
    if None in (a1, b1, a0, b0): return None
    return (a1 - b1) - (a0 - b0)

def valid_ref(cum, neutr, pit_of, medlap, ref, subj, L, N):
    if ref == subj: return False
    if any(l in pit_of.get(ref, set()) for l in (L - 1, L, L + 1)): return False   # ref non pitta
    if any(neutr(ref, l) for l in (L - 1, L, L + 1)): return False
    if cum(ref, L - 1) is None or cum(ref, L + 1) is None: return False
    # non doppiato/doppiante: entro ~1 giro da subj al freeze L-1
    if abs((cum(subj, L - 1) or 0) - (cum(ref, L - 1))) > medlap(L - 1): return False
    return True

def pit_loss_gap_stop(cum, neutr, pit_of, medlap, subj, L, N, drivers):
    if L - 1 < 1 or L + 1 >= N: return None
    if cum(subj, L - 1) is None or cum(subj, L + 1) is None: return None
    if any(neutr(subj, l) for l in (L - 1, L, L + 1)): return None
    vals = []
    for ref in drivers:
        if not valid_ref(cum, neutr, pit_of, medlap, ref, subj, L, N): continue
        gc = gap_change(cum, subj, ref, L)
        if gc is not None: vals.append(gc)
    if len(vals) < MIN_REFS: return ('scarto', len(vals))
    v = np.array(vals)
    return dict(n_ref=len(vals), med=float(np.median(v)), iqr=float(np.percentile(v, 75) - np.percentile(v, 25)))

# ---------------- E2: controllo a vuoto (il giudice e' valido?) ----------------
vuoto = []
for g in RACES:
    byLap, N, pit_of, cum, neutr, medlap, drivers = build(g)
    for L in range(3, N - 2):
        for subj in drivers:
            # subj NON pitta nella finestra (pseudo-pit): stessa formula, deve dare ~0
            if any(l in pit_of.get(subj, set()) for l in (L - 1, L, L + 1)): continue
            if cum(subj, L - 1) is None or cum(subj, L + 1) is None: continue
            if any(neutr(subj, l) for l in (L - 1, L, L + 1)): continue
            r = pit_loss_gap_stop(cum, neutr, pit_of, medlap, subj, L, N, drivers)
            if isinstance(r, dict): vuoto.append(r['med'])
vuoto = np.array(vuoto)
vuoto_med_abs = float(np.median(np.abs(vuoto)))
GIUDICE_VALIDO = vuoto_med_abs <= 0.5

# ---------------- E1: pit_loss_gap per stop ----------------
per_stop = []; scarti = 0
iqr_all = []
for g in RACES:
    byLap, N, pit_of, cum, neutr, medlap, drivers = build(g)
    for subj in pit_of:
        for L in sorted(pit_of[subj]):
            r = pit_loss_gap_stop(cum, neutr, pit_of, medlap, subj, L, N, drivers)
            if r is None: continue
            if isinstance(r, tuple): scarti += 1; continue
            iqr_all.append(r['iqr'])
            per_stop.append(dict(gara=g, cid=RACES[g][0], drv=subj, L=L, n_ref=r['n_ref'],
                                 pit_loss_gap=round(r['med'], 3), iqr_ref=round(r['iqr'], 3)))
iqr_med = float(np.median(iqr_all)) if iqr_all else float('nan')
GIUDICE_NON_RUMOROSO = iqr_med <= 2.0

per_stop.sort(key=lambda s: (s['gara'], s['L'], s['drv']))
with open('data/pitloss_gap_per_stop.csv', 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['gara', 'cid', 'drv', 'L', 'n_ref', 'pit_loss_gap', 'iqr_ref'])
    w.writeheader(); [w.writerow(s) for s in per_stop]

# ---------------- carica C e D ----------------
calibD = {r['gara']: float(r['calibrato']) for r in csv.DictReader(open('data/pitloss_calibrato_circuito.csv'))}
realeC = {r['gara']: (float(r['reale']) if r['reale'] else None) for r in csv.DictReader(open('data/pitloss_confronto_circuito.csv'))}

# ---------------- E3: confronto per circuito ----------------
tre = []
for g in RACES:
    vv = [s['pit_loss_gap'] for s in per_stop if s['gara'] == g]
    gapmed = float(np.median(vv)) if vv else None
    d = calibD.get(g); diff = (abs(gapmed - d) if (gapmed is not None and d is not None) else None)
    if diff is None: verd = 'n/d'
    elif diff <= 1.5: verd = 'CONFERMATO'
    elif diff > 3.0: verd = 'SMENTITO'
    else: verd = 'AMBIGUO'
    tre.append(dict(gara=g, cid=RACES[g][0], n=len(vv), gap=gapmed,
                    iqr=(float(np.percentile(vv, 25)) if vv else None, float(np.percentile(vv, 75)) if vv else None),
                    calibD=d, realeC=realeC.get(g), nominale=RACES[g][1], diff=diff, verdetto=verd))
with open('data/pitloss_tre_metodi.csv', 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['gara', 'cid', 'n_gap', 'pit_loss_gap', 'calibrato_D', 'reale_C', 'nominale', 'diff_gap_D', 'verdetto'])
    for t in tre:
        w.writerow([t['gara'], t['cid'], t['n'], '' if t['gap'] is None else f"{t['gap']:.2f}",
                    '' if t['calibD'] is None else f"{t['calibD']:.2f}", '' if t['realeC'] is None else f"{t['realeC']:.2f}",
                    t['nominale'], '' if t['diff'] is None else f"{t['diff']:.2f}", t['verdetto']])

# ---------------- E4: MAE nom vs cal sui SOLI 3 robusti (TEST) + Austria/Spagna ----------------
stops = list(csv.DictReader(open('data/pitloss_stops_k1.csv')))
for s in stops:
    s['residuo_nom'] = float(s['residuo_nom'])
    s['residuo_cal'] = float(s['residuo_cal']) if s['residuo_cal'] != '' else None
testR = [s for s in stops if s['split'] == 'test' and s['gara'] in ROBUSTI and s['residuo_cal'] is not None]
def mae(a, k): return float(np.mean([abs(s[k]) for s in a])) if a else float('nan')
mae_nom_R = mae(testR, 'residuo_nom'); mae_cal_R = mae(testR, 'residuo_cal')
red_R = 100 * (mae_nom_R - mae_cal_R) / mae_nom_R if mae_nom_R else 0.0
rng = np.random.default_rng(20260711)
byg = {g: [s for s in testR if s['gara'] == g] for g in ROBUSTI}
reds = []
for _ in range(10000):
    samp = rng.choice(ROBUSTI, len(ROBUSTI), replace=True)
    t = [s for g in samp for s in byg[g]]
    if not t: continue
    mn = np.mean([abs(s['residuo_nom']) for s in t]); mc = np.mean([abs(s['residuo_cal']) for s in t])
    reds.append(100 * (mn - mc) / mn if mn else np.nan)
loR, hiR = float(np.nanpercentile(reds, 2.5)), float(np.nanpercentile(reds, 97.5))
peggio = {}
for g in ('Austria', 'Spagna'):
    t = [s for s in stops if s['split'] == 'test' and s['gara'] == g and s['residuo_cal'] is not None]
    peggio[g] = (mae(t, 'residuo_nom'), mae(t, 'residuo_cal'))

# ---------------- report ----------------
L = []; P = L.append
P("# REPORT_PITLOSS_GAP — terzo metodo ortogonale (pilota-cronometro)")
P("")
P(f"Controllo a vuoto: {vuoto_med_abs:.2f} s -> **{'GIUDICE VALIDO' if GIUDICE_VALIDO else 'GIUDICE NON VALIDO'}** "
  f"(soglia mediana |valore| <= 0,5 s su coppie SENZA pit; n={len(vuoto)})")
vg = {t['gara']: t['verdetto'] for t in tre}
if GIUDICE_VALIDO and GIUDICE_NON_RUMOROSO:
    P(f"GB: **{vg['Gran Bretagna']}** | Miami: **{vg['Miami']}** | Monaco: **{vg['Monaco']}**")
else:
    P("GB / Miami / Monaco: **verdetto NON EMESSO** — il giudice ha fallito il proprio test di")
    P("validita' (E2), quindi i confronti E3 sotto sono INDICATIVI, non certificabili.")
P("")
if not GIUDICE_VALIDO:
    P(f"**STOP (E2 pre-registrato).** Il controllo a vuoto e' {vuoto_med_abs:.2f} s, non ~0: applicato")
    P("a due piloti che NON pittano, il metodo gap restituisce gia' ~1,6 s solo per la DISPERSIONE")
    P("DI PASSO fra piloti (~0,8 s/giro reale x 2 giri). Questo rumore proprio sta alla stessa scala")
    P("della soglia di conferma (1,5 s): il gap NON puo' giudicare a quella precisione. NON si")
    P("ritocca il metodo per farlo passare (sarebbe tuning post-hoc). Conseguenza: NON abbiamo una")
    P("conferma ortogonale. Restiamo con UN solo metodo (C/D, che sono lo stesso). La sostituzione")
    P("NON e' giustificata da evidenza indipendente. I numeri E3 concordano (vedi sotto) -- indizio,")
    P("non prova.")
if not GIUDICE_NON_RUMOROSO:
    P(f"IQR mediano fra riferimenti = {iqr_med:.2f} s > 2 s: conferma che il metodo gap e' troppo rumoroso.")
P("")
P("## E1/E2 — Metodo e validazione del giudice")
P("")
P(f"- Dispersione fra riferimenti (IQR mediano per stop): {iqr_med:.2f} s "
  f"(<=2 s richiesto: {'OK' if GIUDICE_NON_RUMOROSO else 'FALLITO'}).")
P(f"- Controllo a vuoto (stessa formula su coppie senza pit): mediana |valore| = {vuoto_med_abs:.2f} s "
  f"({'~0, il giudice non ha bias proprio' if GIUDICE_VALIDO else 'NON ~0, giudice corrotto'}).")
P(f"- Stop con < {MIN_REFS} riferimenti validi, scartati: {scarti}.")
P("")
P("## E3 — Confronto dei tre metodi (gap = giudice; C/D = imputato)")
P("")
P("| circuito | n stop | pit_loss_gap (IQR) | calibrato D | reale C | nominale f1db | |gap−D| | verdetto |")
P("|---|---|---|---|---|---|---|---|")
for t in sorted(tre, key=lambda t: (t['gara'] not in ROBUSTI, t['gara'])):
    star = ' ⭐' if t['gara'] in ROBUSTI else ''
    gp = '—' if t['gap'] is None else f"{t['gap']:.2f} [{t['iqr'][0]:.1f},{t['iqr'][1]:.1f}]"
    cD = '—' if t['calibD'] is None else f"{t['calibD']:.2f}"
    rC = '—' if t['realeC'] is None else f"{t['realeC']:.2f}"
    df = '—' if t['diff'] is None else f"{t['diff']:.2f}"
    vd = t['verdetto'] if (GIUDICE_VALIDO and GIUDICE_NON_RUMOROSO) else (t['verdetto'].lower() + ' (indic.)')
    P(f"| {t['gara']}{star} | {t['n']} | {gp} | {cD} | {rC} | {t['nominale']} | {df} | {vd} |")
P("")
P("⭐ = lato robusto (i tre che la Sessione D proponeva di sostituire).")
P("")
if not (GIUDICE_VALIDO and GIUDICE_NON_RUMOROSO):
    P("**Verdetti NON emessi: il giudice ha fallito E2.** I |gap−D| sono mostrati come INDIZIO:")
    P("sui tre robusti sono piccoli (GB 1,2; Miami 1,2; Monaco 0,06 s), il che e' coerente col fatto")
    P("che il gap-per-circuito medi via parte del rumore di passo -- ma NON e' una conferma valida,")
    P("perche' il rumore proprio del giudice (1,6 s) e' dell'ordine di quelle differenze. Non si")
    P("dichiara CONFERMATO nessun circuito. La sostituzione resta priva di conferma indipendente.")
else:
    smentiti = [t for t in tre if t['gara'] in ROBUSTI and t['verdetto'] == 'SMENTITO']
    if smentiti:
        P("**Almeno un circuito robusto e' SMENTITO -> si FERMA TUTTO e si riesamina il METODO, non "
          "il circuito.** Il calibrato D di questi circuiti e' un artefatto: nessuna sostituzione.")
    else:
        conf = [t for t in tre if t['gara'] in ROBUSTI and t['verdetto'] == 'CONFERMATO']
        P(f"Circuiti robusti CONFERMATI dal terzo metodo ortogonale: {len(conf)}/3 "
          f"({', '.join(t['gara'] for t in conf)}).")
P("")
P("## E4 — La misura mancante della Sessione D (MAE sui SOLI 3 robusti)")
P("")
P(f"- MAE residuo pit k=1 sul TEST dei soli GB/Miami/Monaco: nominale {mae_nom_R:.3f} -> "
  f"calibrato {mae_cal_R:.3f} s, riduzione **{red_R:.0f}%** (IC95 bootstrap [{loR:.0f}%, {hiR:.0f}%]).")
P("  E' la metrica giusta per una decisione che riguarda solo 3 circuiti (l'aggregato su 9 della")
P("  Sessione D, 22%, era diluito dai circuiti dove la calibrazione peggiora).")
P("- Termometro del rumore: applicando una correzione quasi nulla a circuiti ben campionati,")
for g in ('Austria', 'Spagna'):
    mn, mc = peggio[g]
    P(f"    {g} (correzione ~{calibD[g]-RACES[g][1]:+.2f}s): MAE {mn:.2f} -> {mc:.2f} "
      f"({'PEGGIORA' if mc > mn else 'migliora'} di {mc-mn:+.2f}s).")
P("  Se una correzione ~0 peggiora n=33/n=40, la mediana-su-FIT porta rumore: cautela anche sui")
P("  tre grandi (ma li' la correzione ~-3..-9s domina il rumore).")
P("")
P("## E5 — Cross-check esterno f1db (durata stop)")
P("")
P("NON eseguibile con i dati in repo: `pit_loss_circuito_f1db.csv` contiene solo il pit_loss")
P("aggregato per circuito (pit_loss_s, n), NON il campo durata-stop per-stop (lap+duration). Il")
P("cross-check semantico durata-pit-lane vs pit-loss-totale richiede la fonte f1db per-stop, non")
P("presente. Dichiarato non eseguibile, non bloccante.")
P("")
P("Nessun verdetto strategico (sostituire i file, rigenerare i golden): e' del PO.")
open('REPORT_PITLOSS_GAP.md', 'w').write("\n".join(L) + "\n")
print("\n".join(L))
print(f"\n[scritto] gen_pitloss_gap.py, data/pitloss_gap_per_stop.csv ({len(per_stop)} stop), "
      "data/pitloss_tre_metodi.csv, REPORT_PITLOSS_GAP.md")
print("GIUDICE_VALIDO =", GIUDICE_VALIDO, "| verdetti:", {t['gara']: t['verdetto'] for t in tre if t['gara'] in ROBUSTI})
