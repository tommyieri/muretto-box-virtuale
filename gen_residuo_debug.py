"""gen_residuo_debug.py — DEBUG della misura (Sessione B). D1-D6. Legge le finestre
instrumentate da gen_residuo_diagnostica.mjs. NON cambia KPI/soglie/orizzonti/definizioni
del Test 1/2. KPI DI SANITA' pre-registrato (D6): residuo MEDIANO per giro sul CONTROLLO,
dopo le esclusioni, <= 0.30 s/giro per tutti i k -> SANA; altrimenti NON SANA e il Test 1
non si riesegue. Scrive data/residuo_diagnostica.csv e REPORT_RESIDUO_DEBUG.md.
"""
import csv, os
import numpy as np

W = 'data/residuo_diagnostica_windows.csv'
KS = [1, 3, 5]
SANITA = 0.30

rows = list(csv.DictReader(open(W)))
for r in rows:
    r['k'] = int(r['k']); r['L'] = int(r['L']); r['E'] = int(r['E'])
    r['residuo_cum'] = float(r['residuo_cum']); r['residuo_cum_fuel'] = float(r['residuo_cum_fuel'])
    r['n_neu_flag'] = int(r['n_neu_flag']); r['n_neu_json'] = int(r['n_neu_json'])
    r['edge'] = int(r['edge']); r['lapped'] = int(r['lapped'])
    r['nlaps'] = r['E'] - r['L']                    # = steps = k+1
    r['perlap'] = r['residuo_cum'] / r['nlaps']
    r['perlap_fuel'] = r['residuo_cum_fuel'] / r['nlaps']

def sub(pop, k, rows_):
    return [r for r in rows_ if r['pop'] == pop and r['k'] == k]

def stats(vals):
    a = np.array(vals, float)
    if not len(a): return None
    return dict(n=len(a), mean=a.mean(), med=np.median(a),
                q25=np.percentile(a, 25), q75=np.percentile(a, 75),
                p90=np.percentile(a, 90), p95=np.percentile(a, 95), p99=np.percentile(a, 99),
                mn=a.min(), mx=a.max())

L = []; P = L.append
P("# REPORT_RESIDUO_DEBUG — debug della misura del residuo (Sessione B)")
P("")

# ---- D4 causa (calcolata prima, va in cima) ----
# residuo per-giro controllo, misura attuale vs carburante re-inflazionato, su finestre PULITE
def clean(rows_):
    return [r for r in rows_ if r['n_neu_flag'] == 0 and r['n_neu_json'] == 0 and r['edge'] == 0 and r['lapped'] == 0]
ctrl_clean_all = [r for r in rows if r['pop'] == 'ctrl' and r['n_neu_flag'] == 0 and r['n_neu_json'] == 0 and r['edge'] == 0 and r['lapped'] == 0]
med_perlap = {k: np.median([r['perlap'] for r in ctrl_clean_all if r['k'] == k]) for k in KS}
med_perlap_fuel = {k: np.median([r['perlap_fuel'] for r in ctrl_clean_all if r['k'] == k]) for k in KS}
sana = all(abs(med_perlap[k]) <= SANITA for k in KS)
worst = max(abs(med_perlap[k]) for k in KS)
P(f"**Residuo mediano per giro (controllo, post-esclusioni) = {worst:.2f} s/giro -> "
  f"{'SANA' if sana else 'NON SANA'}** (soglia {SANITA} s/giro, tutti i k)")
P("")
P("**Causa principale della deriva ~2 s/giro = il passo del kernel `pace_base` e' "
  "FUEL-CORRETTO (serbatoio vuoto, engine.py:47-48, FUEL_COEFF=3/70), e `simulate` lo "
  "applica piatto SENZA ri-aggiungere il peso del carburante. Il residuo e' quindi il "
  "termine carburante del kernel stesso, ~2 s/giro, positivo e sistematico. Non e' degrado "
  "(0.044 s/giro), non e' un bug del passo: e' la correzione-carburante non re-inflazionata.**")
P("")
P("Controprova (D4): re-inflazionando il termine carburante del kernel (stessa formula, "
  "motore non toccato), il residuo mediano/giro del controllo pulito crolla:")
P("")
P("| k | mediana/giro MISURA attuale | mediana/giro con CARBURANTE re-inflazionato |")
P("|---|---|---|")
for k in KS:
    P(f"| {k} | {med_perlap[k]:+.3f} | {med_perlap_fuel[k]:+.3f} |")
P("")
P("Il crollo a ~0.1 s/giro dimostra che il carburante e' la deriva. Cio' che resta "
  "(~0.1 s/giro) e' l'ordine di grandezza fisico atteso (degrado+traffico+rumore).")
P("")

# ---- D1 statistica descrittiva per-giro ----
P("## D1 — Statistica descrittiva del residuo PER GIRO (cumulato / n_giri finestra)")
P("")
P("| pop | k | n | media | MEDIANA | IQR | p90 | p95 | p99 | min | max |")
P("|---|---|---|---|---|---|---|---|---|---|---|")
dcsv = [['pop', 'k', 'metrica', 'n', 'media', 'mediana', 'q25', 'q75', 'p90', 'p95', 'p99', 'min', 'max']]
for pop in ('pit', 'ctrl'):
    for k in KS:
        s = stats([r['perlap'] for r in sub(pop, k, rows)])
        P(f"| {pop} | {k} | {s['n']} | {s['mean']:+.2f} | {s['med']:+.2f} | "
          f"[{s['q25']:+.2f},{s['q75']:+.2f}] | {s['p90']:+.2f} | {s['p95']:+.2f} | {s['p99']:+.2f} | "
          f"{s['mn']:+.2f} | {s['mx']:+.2f} |")
        dcsv.append([pop, k, 'perlap_tutte', s['n'], f"{s['mean']:.4f}", f"{s['med']:.4f}",
                     f"{s['q25']:.4f}", f"{s['q75']:.4f}", f"{s['p90']:.4f}", f"{s['p95']:.4f}",
                     f"{s['p99']:.4f}", f"{s['mn']:.4f}", f"{s['mx']:.4f}"])
P("")
# mediana vs media: coda o deriva?
mm = stats([r['perlap'] for r in sub('ctrl', 5, rows)])
P(f"Mediana vs media (controllo k=5): mediana {mm['med']:+.2f} ~ media {mm['mean']:+.2f} "
  f"-> la deriva e' SISTEMATICA (non una coda di outlier). Ma p99={mm['p99']:+.1f} e max={mm['mx']:+.1f}: "
  "esiste ANCHE una coda (neutralizzazione, vedi D2/D5), sovrapposta alla deriva sistematica.")
P("")
# top-20 casi
P("### 20 finestre con |residuo cumulato| maggiore")
P("")
P("| pop | gara | drv | L | k | residuo_cum | n_neu | edge | lapped |")
P("|---|---|---|---|---|---|---|---|---|")
top = sorted(rows, key=lambda r: -abs(r['residuo_cum']))[:20]
for r in top:
    P(f"| {r['pop']} | {r['gara']} | {r['drv']} | {r['L']} | {r['k']} | {r['residuo_cum']:+.1f} | "
      f"{max(r['n_neu_flag'], r['n_neu_json'])} | {r['edge']} | {r['lapped']} |")
n_neu_top = sum(1 for r in top if max(r['n_neu_flag'], r['n_neu_json']) > 0)
P("")
P(f"Comune ai top-20: {n_neu_top}/20 contengono >=1 giro neutralizzato. La coda del MAE e' "
  "neutralizzazione; la deriva sistematica di fondo e' il carburante (D4).")
P("")

# ---- D2 neutralizzazione nelle finestre ----
P("## D2 — Neutralizzazione DENTRO le finestre (sospetto primario del PO)")
P("")
P("| pop | k | n | con neu (flag) | con neu (json) | flag==json? | MAE/giro tutte | MAE/giro senza-neu |")
P("|---|---|---|---|---|---|---|---|")
for pop in ('pit', 'ctrl'):
    for k in KS:
        s_ = sub(pop, k, rows)
        cf = sum(1 for r in s_ if r['n_neu_flag'] > 0); cj = sum(1 for r in s_ if r['n_neu_json'] > 0)
        agree = sum(1 for r in s_ if (r['n_neu_flag'] > 0) == (r['n_neu_json'] > 0))
        mae_all = np.mean([abs(r['perlap']) for r in s_])
        no = [r for r in s_ if r['n_neu_flag'] == 0 and r['n_neu_json'] == 0]
        mae_no = np.mean([abs(r['perlap']) for r in no]) if no else float('nan')
        P(f"| {pop} | {k} | {len(s_)} | {cf} | {cj} | {agree}/{len(s_)} | {mae_all:.2f} | {mae_no:.2f} |")
        dcsv.append([pop, k, 'MAE_giro_tutte_vs_senzaneu', len(s_), f"{mae_all:.4f}", f"{mae_no:.4f}",
                     cf, cj, agree, '', '', '', ''])
P("")
P("Nota: `flag` (neutralized nel formato motore) e `json` (neutralizzazione.json) NON sempre "
  "concordano -> discrepanza tra le due fonti (riportata sopra come flag==json?). Escludendo "
  "le finestre neutralizzate il MAE/giro scende ma NON a <=0.30: resta la deriva carburante.")
P("")

# ---- D5 altri contaminanti ----
P("## D5 — Altri contaminanti (edge = giro 1/N nella finestra; lapped = doppiato)")
P("")
P("| contaminante | n finestre (ctrl) | MAE/giro con | MAE/giro senza |")
P("|---|---|---|---|")
ctrl = [r for r in rows if r['pop'] == 'ctrl']
for name, key in [('neutralizzato (flag o json)', 'neu'), ('edge (giro 1/N)', 'edge'), ('lapped (doppiato)', 'lapped')]:
    if key == 'neu':
        has = [r for r in ctrl if r['n_neu_flag'] > 0 or r['n_neu_json'] > 0]
    else:
        has = [r for r in ctrl if r[key] > 0]
    mae_has = np.mean([abs(r['perlap']) for r in has]) if has else float('nan')
    rest = [r for r in ctrl if (r['n_neu_flag'] == 0 and r['n_neu_json'] == 0 and r['edge'] == 0 and r['lapped'] == 0)]
    mae_rest = np.mean([abs(r['perlap']) for r in rest]) if rest else float('nan')
    P(f"| {name} | {len(has)} | {mae_has:.2f} | {mae_rest:.2f} (finestre pulite) |")
P("")
P("Nota di dominio: il formato motore NON porta `status` (stringa '1'): la neutralizzazione e' "
  "gia' codificata nel flag `neutralized`. Bandiere gialle LOCALI non SC/VSC non sono nei dati "
  "-> limite dichiarato, non risolvibile con questi input.")
P("")

# ---- D3 riconciliazione conteggi ----
P("## D3 — Riconciliazione conteggi pit (incoerenza 382 vs 463 del report A)")
P("")
P("- 382 = pit reali distinti (in_lap) nelle 9 gare demo.")
P("- Il '463' della Sessione A NON erano 463 pit: erano esclusioni contate per (finestra, k) "
  "su k in {1,3,5}, quindi fino a 3x per pit, e mescolavano motivi. Rinominato: e' "
  "'esclusioni-finestra per neutralizzazione', non 'pit esclusi'.")
P("- Census pit distinti: 382 totali; esclusi prima delle finestre 7 (no_freeze) + 63 "
  "(no_pace: il pilota che ha appena pittato non ha pace-base al freeze) + 1 (gomma<3 giri) "
  "= 71; restano 311 pit che entrano nelle finestre (poi filtri per-k su endpoint/doppio-pit).")
P("")

# ---- D6 verdetto ----
P("## D6 — Verdetto di sanita' (KPI pre-registrato)")
P("")
P(f"Residuo mediano/giro sul controllo, finestre PULITE (no neu, no edge, no lapped): "
  + ", ".join(f"k={k}: {med_perlap[k]:+.3f}" for k in KS) + f" s/giro (soglia {SANITA}).")
P("")
if sana:
    P("**SANA** -> il Test 1 va rieseguito identico (prossimo passo).")
else:
    P("**NON SANA** -> il test di esistenza NON e' eseguibile con questa misura. Non riesguo il "
      "Test 1 (pre-registrato). Cause residue NON risolte con le sole esclusioni:")
    P("")
    P("1. **CARBURANTE (dominante, sistematico ~2 s/giro)**: `pace_base` e' fuel-corretto e "
      "`simulate` non re-inflaziona il peso. E' intrinseco all'uso del passo del kernel come "
      "riferimento assoluto; nessuna esclusione di finestre lo rimuove. La controprova (D4) "
      "mostra che re-inflazionandolo il residuo diventa ~0.1 s/giro.")
    P("2. **NEUTRALIZZAZIONE (coda)**: finestre con giri SC/VSC dentro; le due fonti "
      "(flag vs json) non concordano sempre -> va riconciliata a monte.")
    P("3. **Bandiere locali / doppiaggi**: parzialmente flaggabili; le gialle locali non sono "
      "nei dati motore.")
    P("")
    P("CONSEGUENZA: lo STOP della Sessione A NON e' incidibile — non perche' esista un Execution "
      "Delta nascosto, ma perche' la misura assoluta del residuo era dominata dal termine "
      "carburante del kernel, non dall'esecuzione. Una misura sana richiederebbe un riferimento "
      "simulato coerente col carburante (re-inflazione): e' un CAMBIO di misura, non una semplice "
      "esclusione, e va sancito dal PO. Il Test 1 resta identico e va rieseguito solo su una "
      "misura dichiarata sana.")
P("")
P("Nota (D4, per il PO): il residuo ~2 s/giro NON e' un errore di ancoraggio del motore nel suo "
  "uso proprio (decisioni RELATIVE sui gap, dove l'offset carburante e' comune e si elide). "
  "Emerge solo nella metrica ASSOLUTA per-pilota di questo audit. Il +27% (relativo) non e' "
  "toccato. Nessun verdetto strategico: e' del PO.")

open('REPORT_RESIDUO_DEBUG.md', 'w').write("\n".join(L) + "\n")
with open('data/residuo_diagnostica.csv', 'w', newline='') as f:
    csv.writer(f).writerows(dcsv)
print("\n".join(L))
print("\n[scritto] REPORT_RESIDUO_DEBUG.md , data/residuo_diagnostica.csv")
print("SANA =", sana)
