"""gen_pitloss_placebo.py — Sessione F: il giudice (metodo gap) regge? Bias con segno via
PLACEBO STRUTTURATO, risoluzione, sensibilita'. NON fa girare il motore; NON sostituisce nulla;
generatore committato.

CORREZIONE alla Sessione E: il KPI del controllo a vuoto misurava la mediana del VALORE
ASSOLUTO = RUMORE, non il BIAS con segno. Il rumore per-stop non uccide un giudice: la mediana
su n stop converge come sigma/sqrt(n). Il bias con segno si'. Le soglie del verdetto (1,5/3,0 s)
NON cambiano; cambia solo il criterio di validita' dello strumento.

TRAPPOLA evitata: un controllo a vuoto su coppie ARBITRARIE di non-pittanti da' mediana con
segno ZERO per algebra (scambiando trattato e riferimento il valore cambia segno). Non e' un
test. Il test valido e' il PLACEBO STRUTTURATO: pit FINTI su piloti che non pittano ma appaiati
per VITA-GOMMA e GIRO ai pittanti veri, cosi' si replica la struttura di selezione dei casi.

METODO gap (E1, invariato): pit_loss_gap[P,L] = mediana su riferimenti validi di
  ( cum(P,L+1)-cum(ref,L+1) ) - ( cum(P,L-1)-cum(ref,L-1) ), sincronizzato per NUMERO di giro.
ref valido = non pitta in {L-1,L,L+1}, presente a L-1 e L+1, non neutralizzato, non doppiato/
doppiante rispetto al soggetto. Positivo = il soggetto perde tempo (pit-loss).

SEGNO ATTESO del bias (dichiarato PRIMA): chi pitta passa da gomma VECCHIA a NUOVA; la
variazione del gap contiene pit-loss MENO il guadagno gomma fresca -> il gap potrebbe
SOTTOSTIMARE il pit-loss. Il placebo, appaiato per vita-gomma ma SENZA cambio gomma, isola la
deriva-passo di SELEZIONE (soggetto su gomma vecchia vs pool di riferimento) e NON cattura il
guadagno-gomma. Quindi il placebo corregge il bias di selezione/deriva, NON il guadagno-gomma:
limite dichiarato. gap_corretto resta un possibile sotto-stima per la componente gomma.
"""
import csv, json
import numpy as np

RACES = {
    'Australia': ['melbourne', 18.15], 'Austria': ['spielberg', 21.63], 'Canada': ['montreal', 24.37],
    'Cina': ['shanghai', 22.97], 'Giappone': ['suzuka', 23.72], 'Gran Bretagna': ['silverstone', 29.12],
    'Miami': ['miami', 22.63], 'Monaco': ['monaco', 24.8], 'Spagna': ['catalunya', 22.38],
}
ROBUSTI = ['Gran Bretagna', 'Miami', 'Monaco']
MIN_REFS, MIN_PLACEBO, TYRE_TOL, NB, SEED = 4, 2, 3, 10000, 20260711
NEU = json.load(open('demo/neutralizzazione.json'))

def build(g):
    r = json.load(open(f'demo/data/{g}.json')); byLap = {lp['lap']: lp['cars'] for lp in r['laps']}
    N = r['n_laps']; W = [*NEU.get(g, {}).get('sc', []), *NEU.get(g, {}).get('vsc', [])]
    inj = lambda L: any(a <= L <= b for a, b in W)
    pit_of = {}
    for L in byLap:
        for d, c in byLap[L].items():
            if c['in_lap']: pit_of.setdefault(d, set()).add(L)
    def cum(d, L):
        c = byLap.get(L, {}).get(d); return c['cum_time'] if c and isinstance(c['cum_time'], (int, float)) else None
    def neu(d, L):
        c = byLap.get(L, {}).get(d); return bool(c and c['neutralized']) or inj(L)
    def age(d, L):
        c = byLap.get(L, {}).get(d); return c['tyre_age'] if c else None
    def medlap(L):
        lts = [byLap[L][d]['lap_time'] for d in byLap.get(L, {}) if isinstance(byLap[L][d].get('lap_time'), (int, float))]
        return float(np.median(lts)) if lts else 90.0
    def rank(d, L):  # posizione = rango per cum al giro L (il formato demo non ha 'pos')
        o = sorted([x for x in byLap.get(L, {}) if cum(x, L) is not None], key=lambda x: cum(x, L))
        return o.index(d) if d in o else None
    return byLap, N, pit_of, cum, neu, age, medlap, rank, r['drivers']

def refs_of(subj, L, N, pit_of, cum, neu, age, medlap, rank, drivers):
    """lista (ref, gap_change, ahead, ref_age, posdiff) per il soggetto al giro L."""
    if L - 1 < 1 or L + 1 >= N: return None
    if cum(subj, L - 1) is None or cum(subj, L + 1) is None: return None
    if any(neu(subj, l) for l in (L - 1, L, L + 1)): return None
    out = []
    rS = rank(subj, L - 1)
    for ref in drivers:
        if ref == subj: continue
        if any(l in pit_of.get(ref, set()) for l in (L - 1, L, L + 1)): continue
        if any(neu(ref, l) for l in (L - 1, L, L + 1)): continue
        if cum(ref, L - 1) is None or cum(ref, L + 1) is None: continue
        if abs(cum(subj, L - 1) - cum(ref, L - 1)) > medlap(L - 1): continue   # non doppiato
        gc = (cum(subj, L + 1) - cum(ref, L + 1)) - (cum(subj, L - 1) - cum(ref, L - 1))
        ahead = cum(ref, L - 1) < cum(subj, L - 1)
        rR = rank(ref, L - 1)
        posdiff = abs((rS if rS is not None else 0) - (rR if rR is not None else 0))
        out.append((ref, gc, ahead, age(ref, L), posdiff))
    return out if len(out) >= MIN_REFS else None

def med(a): return float(np.median(a)) if len(a) else None
def boot_med(vals, rng):
    v = np.array(vals); n = len(v)
    if n == 0: return None, None, (None, None)
    bs = np.array([np.median(rng.choice(v, n, replace=True)) for _ in range(NB)])
    return float(np.median(v)), float(np.std(bs)), (float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5)))

# ---------------- raccolta: pit reali + refs ----------------
real = {}   # gara -> list of dict(drv,L,age,refs=[(ref,gc,ahead,refage,posdiff)], gapmed)
allbuild = {}
for g in RACES:
    b = build(g); allbuild[g] = b
    byLap, N, pit_of, cum, neu, age, medlap, rank, drivers = b
    lst = []
    for P in pit_of:
        for L in sorted(pit_of[P]):
            rf = refs_of(P, L, N, pit_of, cum, neu, age, medlap, rank, drivers)
            if rf is None: continue
            lst.append(dict(drv=P, L=L, age=age(P, L), refs=rf, gapmed=med([x[1] for x in rf])))
    real[g] = lst

# ---------------- F0: risoluzione (bootstrap mediana di circuito) ----------------
rng = np.random.default_rng(SEED)
F0 = {}
for g in RACES:
    vals = [s['gapmed'] for s in real[g]]
    m, se, ic = boot_med(vals, np.random.default_rng(SEED))
    F0[g] = dict(n=len(vals), med=m, se=se, ic=ic,
                 refs_med=(float(np.median([len(s['refs']) for s in real[g]])) if real[g] else None))
F0_ok = all(F0[g]['se'] is not None and F0[g]['se'] <= 1.0 for g in ROBUSTI)

# ---------------- F1: placebo strutturato ----------------
placebo = {g: [] for g in RACES}; escl_placebo = 0
for g in RACES:
    byLap, N, pit_of, cum, neu, age, medlap, rank, drivers = allbuild[g]
    for s in real[g]:
        L, V = s['L'], s['age']
        found = 0
        for Q in drivers:
            if Q == s['drv']: continue
            if any(l in pit_of.get(Q, set()) for l in (L - 1, L, L + 1)): continue   # Q non pitta
            aQ = age(Q, L)
            if aQ is None or V is None or abs(aQ - V) > TYRE_TOL: continue           # appaiato per vita-gomma
            rf = refs_of(Q, L, N, pit_of, cum, neu, age, medlap, rank, drivers)
            if rf is None: continue
            placebo[g].append(med([x[1] for x in rf])); found += 1
        if found < MIN_PLACEBO: escl_placebo += 1
placebo_all = [v for g in RACES for v in placebo[g]]
bias, bias_se, bias_ic = boot_med(placebo_all, np.random.default_rng(SEED + 1))
placebo_perc = {g: boot_med(placebo[g], np.random.default_rng(SEED + 2))[0] for g in RACES}
if bias is None: bias = 0.0
if abs(bias) <= 0.5: F1 = 'NON DISTORTO'
elif abs(bias) <= 2.0: F1 = 'DISTORTO MA CORREGGIBILE'
else: F1 = 'NON VALIDO'
correzione = bias if F1 == 'DISTORTO MA CORREGGIBILE' else 0.0

# ---------------- F2: sensibilita' alla scelta dei riferimenti ----------------
def circ_med_strato(g, filt):
    per = []
    for s in real[g]:
        sub = [x[1] for x in s['refs'] if filt(x)]
        if len(sub) >= 1: per.append(med(sub))
    return med(per)
strati = {'davanti': lambda x: x[2], 'dietro': lambda x: not x[2],
          'gomma<10': lambda x: x[3] is not None and x[3] < 10, 'gomma>=10': lambda x: x[3] is not None and x[3] >= 10,
          'entro5pos': lambda x: x[4] <= 5, 'oltre5pos': lambda x: x[4] > 5}
F2 = {}
for g in ROBUSTI:
    vals = {k: circ_med_strato(g, f) for k, f in strati.items()}
    good = [v for v in vals.values() if v is not None]
    F2[g] = dict(vals=vals, spread=(max(good) - min(good)) if good else None)

# ---------------- carica C/D ----------------
calibD = {r['gara']: float(r['calibrato']) for r in csv.DictReader(open('data/pitloss_calibrato_circuito.csv'))}
realeC = {r['gara']: (float(r['reale']) if r['reale'] else None) for r in csv.DictReader(open('data/pitloss_confronto_circuito.csv'))}

# ---------------- F3: verdetto (gap corretto vs D) ----------------
verd = {}
for g in RACES:
    gm = F0[g]['med']
    gc = (gm - correzione) if gm is not None else None
    d = calibD.get(g); diff = abs(gc - d) if (gc is not None and d is not None) else None
    if not F0_ok or F1 == 'NON VALIDO': v = 'NON EMESSO'
    elif diff is None: v = 'n/d'
    elif diff <= 1.5: v = 'CONFERMATO'
    elif diff > 3.0: v = 'SMENTITO'
    else: v = 'AMBIGUO'
    verd[g] = dict(gap=gm, gap_corr=gc, ic=F0[g]['ic'], D=d, C=realeC.get(g), nom=RACES[g][1], diff=diff, v=v)

robusti_conf = all(verd[g]['v'] == 'CONFERMATO' for g in ROBUSTI)
robusti_smentito = any(verd[g]['v'] == 'SMENTITO' for g in ROBUSTI)

# ---------------- CSV ----------------
with open('data/pitloss_placebo.csv', 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['gara', 'tipo', 'valore'])
    for g in RACES:
        for v in placebo[g]: w.writerow([g, 'placebo', f"{v:.4f}"])
with open('data/pitloss_verdetto_finale.csv', 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['gara', 'gap', 'correzione', 'gap_corretto', 'ic95_lo', 'ic95_hi', 'calibrato_D', 'reale_C', 'nominale', 'diff_gapcorr_D', 'verdetto'])
    for g in RACES:
        x = verd[g]
        w.writerow([g, '' if x['gap'] is None else f"{x['gap']:.2f}", f"{correzione:.2f}",
                    '' if x['gap_corr'] is None else f"{x['gap_corr']:.2f}",
                    '' if x['ic'][0] is None else f"{x['ic'][0]:.2f}", '' if x['ic'][1] is None else f"{x['ic'][1]:.2f}",
                    f"{x['D']:.2f}", '' if x['C'] is None else f"{x['C']:.2f}", x['nom'],
                    '' if x['diff'] is None else f"{x['diff']:.2f}", x['v']])

# ---------------- REPORT ----------------
L = []; P = L.append
P("# REPORT_GIUDICE — il metodo gap regge come strumento di misura? (Sessione F)")
P("")
se_str = ", ".join(f"{g.split()[0]} {F0[g]['se']:.2f}" for g in ROBUSTI)
P(f"F0 risoluzione: SE mediana di circuito = [{se_str}] s -> **{'SUFFICIENTE' if F0_ok else 'INSUFFICIENTE'}** (soglia <=1,0 s)")
P(f"F1 bias (placebo strutturato, con segno) = {bias:+.2f} s (IC95 [{bias_ic[0]:+.2f},{bias_ic[1]:+.2f}]) -> **{F1}**")
if F0_ok and F1 != 'NON VALIDO':
    P(f"F3: GB **{verd['Gran Bretagna']['v']}** | Miami **{verd['Miami']['v']}** | Monaco **{verd['Monaco']['v']}**")
else:
    P("F3: **verdetto NON EMESSO** (F0 insufficiente o F1 non valido).")
P("")
P("## F0 — Risoluzione (bootstrap 10.000 sulla mediana di circuito)")
P("")
P("| circuito | n stop | refs/stop (mediana) | mediana gap | SE mediana | IC95 |")
P("|---|---|---|---|---|---|")
for g in RACES:
    x = F0[g]; star = ' ⭐' if g in ROBUSTI else ''
    P(f"| {g}{star} | {x['n']} | {x['refs_med']:.0f} | {x['med']:.2f} | {x['se']:.2f} | [{x['ic'][0]:.1f},{x['ic'][1]:.1f}] |")
P("")
P(f"Atteso SE ~0,7 s (sigma/sqrt(n)); MISURATO 1,4-2,0 s sui robusti -> **sopra la soglia 1,0 s**.")
P("La differenza: la distribuzione per-stop del gap ha CODE DESTRE grasse (alcuni stop 26-40 s),")
P("che gonfiano l'SE bootstrap della mediana oltre l'attesa gaussiana. Sommato alla sensibilita'")
P(f"ai riferimenti (F2, spread 4-5 s), lo strumento NON ha la risoluzione richiesta. F0: **{'PASS' if F0_ok else 'STOP'}**.")
P("")
P("## F1 — Placebo strutturato (il bias con segno; il test centrale)")
P("")
P("Pit FINTI assegnati a piloti NON pittanti, appaiati per vita-gomma (+/-3 giri) e giro ai")
P("pittanti veri; stessa identica procedura gap. Atteso ~0. Segno atteso dichiarato PRIMA: il")
P("placebo isola la deriva-passo di SELEZIONE (soggetto su gomma vecchia vs pool), NON il")
P("guadagno-gomma del pit vero -> corregge il bias di selezione, non quello gomma (limite).")
P("")
P(f"- Bias complessivo (mediana CON SEGNO, n_placebo={len(placebo_all)}): **{bias:+.2f} s** "
  f"(IC95 [{bias_ic[0]:+.2f},{bias_ic[1]:+.2f}], SE {bias_se:.2f}).")
P("- Per circuito: " + ", ".join(f"{g.split()[0]} {('n/d' if placebo_perc[g] is None else f'{placebo_perc[g]:+.2f}')}" for g in RACES) + ".")
P(f"- Pit reali senza >=2 placebo appaiati, esclusi: {escl_placebo}.")
P(f"- KPI: |bias|={abs(bias):.2f} -> **{F1}**. "
  + ("Correzione applicata: gap_corretto = gap − (%.2f)." % correzione if correzione else "Nessuna correzione applicata."))
if F1 == 'NON VALIDO':
    P("  -> **STOP: il metodo gap non puo' giudicare. Nessun verdetto, nessuna sostituzione.**")
P("")
P("## F2 — Sensibilita' alla scelta dei riferimenti")
P("")
P("| circuito | davanti | dietro | gomma<10 | gomma>=10 | entro5pos | oltre5pos | spread |")
P("|---|---|---|---|---|---|---|---|")
for g in ROBUSTI:
    v = F2[g]['vals']; sp = F2[g]['spread']
    cell = lambda k: ('n/d' if v[k] is None else f"{v[k]:.1f}")
    P(f"| {g} | {cell('davanti')} | {cell('dietro')} | {cell('gomma<10')} | {cell('gomma>=10')} | "
      f"{cell('entro5pos')} | {cell('oltre5pos')} | {'n/d' if sp is None else f'{sp:.1f}'} |")
P("")
sens = [g for g in ROBUSTI if F2[g]['spread'] is not None and F2[g]['spread'] > 1.0]
if sens:
    P(f"**Sensibile alla selezione** (spread > 1,0 s): {', '.join(sens)}. Allarga l'incertezza; "
      "non e' STOP automatico ma il verdetto su questi circuiti e' meno fermo.")
else:
    P("Nessun circuito robusto varia > 1,0 s fra gli strati: selezione dei riferimenti robusta.")
P("")
P("## F3 — Verdetto (gap corretto vs calibrato D; soglie invariate 1,5 / 3,0 s)")
P("")
P("| circuito | gap | gap_corretto (IC95) | calibrato D | reale C | nominale | |gapcorr−D| | verdetto |")
P("|---|---|---|---|---|---|---|---|")
for g in sorted(RACES, key=lambda g: (g not in ROBUSTI, g)):
    x = verd[g]; star = ' ⭐' if g in ROBUSTI else ''
    gc = '—' if x['gap_corr'] is None else f"{x['gap_corr']:.2f} [{x['ic'][0]:.1f},{x['ic'][1]:.1f}]"
    cc = '—' if x['C'] is None else f"{x['C']:.2f}"
    df = '—' if x['diff'] is None else f"{x['diff']:.2f}"
    P(f"| {g}{star} | {x['gap']:.2f} | {gc} | {x['D']:.2f} | {cc} | {x['nom']} | {df} | {x['v']} |")
P("")
if robusti_smentito:
    P("**SI FERMA TUTTO: almeno un circuito robusto e' SMENTITO -> riesaminare il METODO, non il")
    P("circuito. Nessuna sostituzione.**")
elif not (F0_ok and F1 != 'NON VALIDO'):
    P("**STOP (F0 pre-registrato): il giudice non ha risoluzione (SE mediana 1,4-2,0 s > 1,0 s).**")
    P("Verdetto NON emesso, nessuna sostituzione. GB resta a 29,12, il debito resta scritto.")
    P("")
    P("Onesta': i punti-stima del gap corretto CADONO vicinissimi a D (GB 20,4 vs 19,7 -> 0,65; "
      "Miami 20,3 vs 19,7 -> 0,63; Monaco 21,5 vs 22,0 -> 0,51), il che e' suggestivo. MA la soglia")
    P("di conferma e' 1,5 s e l'incertezza PROPRIA dello strumento (SE 1,4-2,0 s + spread 4-5 s fra")
    P("riferimenti davanti/dietro) e' dello stesso ordine: la vicinanza potrebbe essere fortuna. Il")
    P("giudice, cosi' com'e', non e' abbastanza fermo per autorizzare la riscrittura dei golden di un")
    P("modulo congelato. Un NO qui e' un risultato, non un fallimento.")
elif robusti_conf:
    P("**3/3 robusti CONFERMATI** dal giudice validato (risoluzione sufficiente, bias "
      + ("corretto" if correzione else "trascurabile") + "). Preparata la PROPOSTA (F4), NON eseguita.")
else:
    amb = [g for g in ROBUSTI if verd[g]['v'] == 'AMBIGUO']
    P(f"Non 3/3 CONFERMATO (AMBIGUO: {', '.join(amb) if amb else '—'}). Nessuna sostituzione.")
P("")
P("LIMITE del giudice (dichiarato): il placebo corregge la deriva di selezione ma NON il")
P("guadagno-gomma; gap_corretto puo' restare una lieve sotto-stima del pit-loss vero. Non tocca")
P("il verdetto vs D (che misura la stessa quantita' col vero out-lap), ma va ricordato.")
P("")
P("Nessun verdetto strategico (sostituire, rigenerare golden): e' del PO.")
open('REPORT_GIUDICE.md', 'w').write("\n".join(L) + "\n")
print("\n".join(L))
print("\nF0_ok =", F0_ok, "| F1 =", F1, f"({bias:+.2f})", "| robusti:", {g: verd[g]['v'] for g in ROBUSTI})
print("PROPOSTA_DA_SCRIVERE =", (F0_ok and F1 != 'NON VALIDO' and robusti_conf))
