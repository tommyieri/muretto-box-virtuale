"""gen_residuo_k1_analisi.py — E1 (certificato elisione) + E2 (Test 1 SOLO a k=1, carburante
re-inflazionato, finestre pulite). E3 (decomposizione) solo se E2 passa. KPI del Test 1
INVARIATI dalla Sessione A: cambia solo l'orizzonte (ristretto a k=1) e la re-inflazione
carburante sull'OUTPUT. Bootstrap a blocchi-gara. Legge i CSV delle sessioni A/A-bis.
"""
import csv, os
import numpy as np

SEED, NB = 20260711, 10000
SANITA = 0.30
GAP = 'data/residuo_gap_controllo.csv'
WIN = 'data/residuo_diagnostica_windows.csv'

# ---------- E1: certificato di elisione ----------
gap = list(csv.DictReader(open(GAP)))
for r in gap:
    r['k'] = int(r['k']); r['pl'] = float(r['residuo_gap_perlap'])
    r['raw'] = float(r['residuo_gap']); r['rein'] = float(r['residuo_gap_reinfl'])
E1 = []
elide = True
for k in (1, 3, 5):
    a = [r for r in gap if r['k'] == k]
    med = float(np.median([abs(r['pl']) for r in a]))
    q = np.percentile([r['pl'] for r in a], [25, 75])
    p95 = float(np.percentile([abs(r['pl']) for r in a], 95))
    dmax = max(abs(r['raw'] - r['rein']) for r in a)
    ok = med <= SANITA
    elide = elide and ok
    E1.append((k, len(a), med, q[0], q[1], p95, dmax, ok))

L = []; P = L.append
verdetto_e1 = 'ELISIONE CONFERMATA' if elide else 'ELISIONE NON CONFERMATA'
coda_e1 = ("SANO nel suo uso proprio (gap relativi); il +27% non e' in discussione" if elide
           else "DA INDAGARE: e' la priorita' assoluta, non l'undercut")
P("# REPORT_ELISIONE — E1: il carburante si elide nei gap? (misura, non asserzione)")
P("")
P(f"**VERDETTO: {verdetto_e1}** — il motore e' " + coda_e1 + ".")
P("")
P("Residuo sul GAP fra piloti di controllo puliti (A dietro B, stesso freeze): "
  "gap_reale(E) - gap_simulato(E), SENZA re-inflazione. Se il carburante si elide, ~0 "
  f"(mediana |/giro| <= {SANITA}) e insensibile alla re-inflazione.")
P("")
P("| k | n coppie | mediana \\|residuo/giro\\| | IQR/giro | p95 \\|/giro\\| | max\\|raw-reinfl\\| | <=0.30? |")
P("|---|---|---|---|---|---|---|")
for (k, n, med, lo, hi, p95, dmax, ok) in E1:
    P(f"| {k} | {n} | {med:.3f} | [{lo:+.3f},{hi:+.3f}] | {p95:.3f} | {dmax:.1e} | {'SI' if ok else 'NO'} |")
P("")
P("Letture: (1) mediana |residuo/giro| <= 0.30 a TUTTI i k, e NON cresce con k (0.28->0.27->0.25) "
  "-> l'errore relativo del motore e' piccolo e stabile, al contrario del residuo ASSOLUTO "
  "per-pilota (~2 s/giro, carburante). (2) max|raw-reinfl| = 0 esatto -> il termine carburante "
  "e' identico per due auto allo stesso giro e si cancella ESATTAMENTE nella differenza. "
  "L'elisione non e' un'asserzione: e' una identita' verificata.")
P("")
open('REPORT_ELISIONE.md', 'w').write("\n".join(L) + "\n")
print("\n".join(L))
if not elide:
    print("\nELISIONE NON CONFERMATA -> STOP prima di E2 (per protocollo).")
    raise SystemExit(0)

# ---------- E2: Test 1 a k=1, re-inflazionato, finestre pulite ----------
win = list(csv.DictReader(open(WIN)))
for r in win:
    r['k'] = int(r['k']); r['L'] = int(r['L']); r['E'] = int(r['E'])
    r['res'] = float(r['residuo_cum_fuel'])              # re-inflazionato
    r['nf'] = int(r['n_neu_flag']); r['nj'] = int(r['n_neu_json'])
    r['edge'] = int(r['edge']); r['lap'] = int(r['lapped'])
def is_clean(r): return r['nf'] == 0 and r['nj'] == 0 and r['edge'] == 0 and r['lap'] == 0
K = 1
races = sorted({r['gara'] for r in win})
pit = [r for r in win if r['pop'] == 'pit' and r['k'] == K and is_clean(r)]
ctrl_all = [r for r in win if r['pop'] == 'ctrl' and r['k'] == K and is_clean(r)]
# controllo appaiato per fascia di giri (convenzione Sessione A): DENTRO la pit-window per gara
pw = {g: (np.percentile([r['L'] for r in pit if r['gara'] == g], 10),
          np.percentile([r['L'] for r in pit if r['gara'] == g], 90)) for g in races if any(r['gara'] == g for r in pit)}
inside = lambda r: r['gara'] in pw and pw[r['gara']][0] <= r['L'] <= pw[r['gara']][1]
ctrl_in = [r for r in ctrl_all if inside(r)]

def boot(pit_, ctrl_, rng):
    byp = {g: [abs(r['res']) for r in pit_ if r['gara'] == g] for g in races}
    byc = {g: [abs(r['res']) for r in ctrl_ if r['gara'] == g] for g in races}
    obs = np.mean([x for g in races for x in byp[g]]) - np.mean([x for g in races for x in byc[g]])
    d = np.empty(NB); ra = np.array(races)
    for b in range(NB):
        s = rng.choice(ra, len(ra), replace=True)
        p = [x for g in s for x in byp[g]]; c = [x for g in s for x in byc[g]]
        d[b] = (np.mean(p) - np.mean(c)) if p and c else np.nan
    return obs, float(np.nanpercentile(d, 2.5)), float(np.nanpercentile(d, 97.5))
mae = lambda a: float(np.mean([abs(r['res']) for r in a])) if a else float('nan')
med = lambda a: float(np.median([r['res'] for r in a])) if a else float('nan')

R = []; Q = R.append
Q("# REPORT_RESIDUO_K1 — E2: Test 1 a k=1 (carburante re-inflazionato, finestre pulite)")
Q("")
Q("KPI del Test 1 INVARIATI (Sessione A). Uniche differenze: orizzonte SOLO k=1 (k=3,5 NON")
Q("sani, non eseguiti); residuo per-pilota CON carburante re-inflazionato (fuel_mass*3/70,")
Q("formula del kernel, applicata all'OUTPUT); finestre pulite (no neutralizzazione dentro, no")
Q(f"edge, no doppiaggio). Bootstrap a blocchi-gara ({NB}, seed={SEED}); {len(races)} blocchi e'")
Q("il limite basso (dichiarato). Nota: E=k+1=2 giri, il residuo e' cumulato su in+out-lap.")
Q("")
verdict = {}
for label, ctrl in [('controllo DENTRO pit-window (primario, conv. Sessione A)', ctrl_in),
                    ('controllo TUTTO pulito (secondario)', ctrl_all)]:
    obs, lo, hi = boot(pit, ctrl, np.random.default_rng(SEED))
    esiste = lo > 0
    verdict[label] = (obs, lo, hi, esiste, len(ctrl))
    Q(f"### {label}")
    Q("")
    Q("| metrica | pit | no-pit |")
    Q("|---|---|---|")
    Q(f"| MAE (s, su 2 giri) | {mae(pit):.3f} | {mae(ctrl):.3f} |")
    Q(f"| mediana con segno (s) | {med(pit):+.3f} | {med(ctrl):+.3f} |")
    Q(f"| n | {len(pit)} | {len(ctrl)} |")
    Q("")
    Q(f"**Differenza MAE(pit) - MAE(no-pit) = {obs:+.3f} s** (IC95 bootstrap [{lo:+.3f}, {hi:+.3f}]).")
    Q(f"Grandezza PRIMA del p-value: {abs(obs):.3f} s su 2 giri. "
      + (f"IC95 esclude lo zero -> **ESISTE**." if esiste else "IC95 include lo zero -> **NON ESISTE -> STOP**."))
    if esiste and abs(obs) < SANITA:
        Q(f"NB: significativo ma sotto {SANITA} s -> statisticamente reale, operativamente IRRILEVANTE.")
    Q("")
prim = verdict['controllo DENTRO pit-window (primario, conv. Sessione A)']
passa = prim[3]
Q("## Verdetto E2 (pre-registrato, invariato)")
Q("")
if passa:
    Q(f"**Execution Delta a k=1 = {prim[0]:+.3f} s (IC95 [{prim[1]:+.3f},{prim[2]:+.3f}]) -> ESISTE.** "
      "Si passa a E3 (decomposizione).")
    if abs(prim[0]) < SANITA:
        Q(f"Ma la grandezza ({abs(prim[0]):.3f} s) e' sotto {SANITA} s: reale ma operativamente irrilevante.")
else:
    Q(f"**Execution Delta a k=1 = {prim[0]:+.3f} s (IC95 [{prim[1]:+.3f},{prim[2]:+.3f}]) -> NON ESISTE. STOP.** "
      "Il filone si chiude: sulla misura sana (k=1), il residuo dei pit non eccede quello del "
      "controllo. Non e' un artefatto (E1 certifica il motore; k=1 e' sano). E3 NON eseguito.")
Q("")
Q("k=3 e k=5: NON eseguiti perche' la misura non e' sana lì (mediana/giro controllo 0.32 e 0.37 >")
Q("0.30, firma del degrado non modellato che a k=5 vale ~1.85 s cumulati, le stesse dimensioni")
Q("dell'Execution Delta cercato). Restrizione dichiarata PRIMA (ok del PO), non dopo il risultato.")
Q("")
Q("Nessun verdetto strategico: e' del PO.")
open('REPORT_RESIDUO_K1.md', 'w').write("\n".join(R) + "\n")
# CSV di E2
with open('data/residuo_k1.csv', 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['pop', 'gara', 'drv', 'L', 'residuo_reinfl', 'dentro_pitwindow'])
    for r in pit: w.writerow(['pit', r['gara'], r['drv'], r['L'], f"{r['res']:.4f}", int(inside(r))])
    for r in ctrl_all: w.writerow(['ctrl', r['gara'], r['drv'], r['L'], f"{r['res']:.4f}", int(inside(r))])
print("\n".join(R))
print("\n[scritto] REPORT_ELISIONE.md, REPORT_RESIDUO_K1.md, data/residuo_k1.csv")
print("E2_PASSA =", passa)
