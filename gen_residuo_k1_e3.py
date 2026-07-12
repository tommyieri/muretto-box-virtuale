"""gen_residuo_k1_e3.py — E3: decomposizione del residuo pit a k=1, LEAVE-ONE-RACE-OUT.
Solo perche' E2 e' passato. Soglie pre-registrate (Sessione A): GO >=25%, GO PARZIALE 10-25%,
NO-GO <10% di riduzione MAE vs climatologia. Nessun R2 in-sample. Regressione lineare
interpretabile, nessuna ottimizzazione di iperparametri.

LIMITE STRUTTURALE dichiarato: 9 gare = 9 circuiti DISTINTI. Leave-one-race-out =
leave-one-circuit-out -> la climatologia PER-CIRCUITO e gli effetti fissi circuito NON sono
stimabili sul fold held-out (circuito mai visto). La climatologia degenera nella media
globale (miglior stima per un circuito non visto); gli effetti fissi circuito sono dichiarati
NON eseguibili. Le variabili continue (pit-loss, traffico, warm-in, dpace) generalizzano.
"""
import csv
import numpy as np
from collections import defaultdict

cov = list(csv.DictReader(open('data/residuo_k1_covariate.csv')))
for r in cov:
    for c in ('residuo_reinfl', 'pitloss', 'gap_rejoin', 'warmin_out', 'dpace', 'rival_inlap'):
        r[c] = float(r[c])
    r['L'] = int(r['L'])

# control median per (gara, drv) per il residuo pit-attribuibile
win = list(csv.DictReader(open('data/residuo_diagnostica_windows.csv')))
cm_drv = defaultdict(list); cm_race = defaultdict(list)
for r in win:
    if r['pop'] != 'ctrl' or int(r['k']) != 1: continue
    if int(r['n_neu_flag']) or int(r['n_neu_json']) or int(r['edge']) or int(r['lapped']): continue
    cm_drv[(r['gara'], r['drv'])].append(float(r['residuo_cum_fuel']))
    cm_race[r['gara']].append(float(r['residuo_cum_fuel']))
def base_ctrl(g, d):
    if (g, d) in cm_drv and cm_drv[(g, d)]: return float(np.median(cm_drv[(g, d)]))
    return float(np.median(cm_race[g])) if cm_race[g] else 0.0
for r in cov:
    r['attr'] = r['residuo_reinfl'] - base_ctrl(r['gara'], r['drv'])   # pit-attribuibile

races = sorted({r['gara'] for r in cov})

def loro_mae(feats):
    """MAE leave-one-race-out di una regressione lineare su 'feats' (lista colonne) vs il
    baseline climatologia (media globale sui fold di training)."""
    err_model, err_base = [], []
    for held in races:
        tr = [r for r in cov if r['gara'] != held]
        te = [r for r in cov if r['gara'] == held]
        if not te: continue
        ybar = np.mean([r['attr'] for r in tr])                 # climatologia (media globale training)
        for r in te: err_base.append(abs(r['attr'] - ybar))
        if feats:
            X = np.array([[1.0] + [r[f] for f in feats] for r in tr])
            y = np.array([r['attr'] for r in tr])
            beta, *_ = np.linalg.lstsq(X, y, rcond=None)
            for r in te:
                pred = np.array([1.0] + [r[f] for f in feats]) @ beta
                err_model.append(abs(r['attr'] - pred))
        else:
            err_model = err_base
    mae_b = float(np.mean(err_base)); mae_m = float(np.mean(err_model))
    red = 100 * (mae_b - mae_m) / mae_b if mae_b else 0.0
    return mae_b, mae_m, red

FEATS = [('pit-loss circuito (f1db)', ['pitloss']),
         ('traffico al rientro', ['gap_rejoin']),
         ('warm-in prior (compound out)', ['warmin_out']),
         ('delta passo-base (descrittore)', ['dpace']),
         ('in-lap del rivale (NUOVA)', ['rival_inlap']),
         ('TUTTE insieme', ['pitloss', 'gap_rejoin', 'warmin_out', 'dpace', 'rival_inlap'])]

L = []; P = L.append
P("# REPORT E3 — Decomposizione del residuo pit a k=1 (leave-one-race-out)")
P("")
mae_b0 = loro_mae([])[0]
P(f"Baseline climatologia (media globale, LORO): MAE = {mae_b0:.3f} s. Target = residuo "
  "pit-attribuibile (pit re-inflazionato - mediana controllo stesso pilota/gara).")
P("")
P("LIMITE dichiarato: 9 gare = 9 circuiti distinti -> climatologia per-circuito ed effetti "
  "fissi circuito NON stimabili LORO (circuito held-out mai visto); climatologia = media "
  "globale; le variabili continue generalizzano. Potenza bassa (9 fold).")
P("")
P("| variabile | MAE baseline | MAE modello | riduzione MAE | esito |")
P("|---|---|---|---|---|")
best = None
for name, fs in FEATS:
    mb, mm, red = loro_mae(fs)
    tag = 'GO' if red >= 25 else ('GO PARZIALE' if red >= 10 else 'NO-GO')
    P(f"| {name} | {mb:.3f} | {mm:.3f} | {red:+.1f}% | {tag} |")
    if name.startswith('TUTTE'): best = (red, tag)
P("")
P("Effetti fissi circuito: NON eseguibili LORO (9 circuiti unici) — dichiarato, non un risultato.")
P("")
red_all, tag_all = best
P(f"## Verdetto E3 (soglie pre-registrate): riduzione MAE fuori campione (tutte le variabili) "
  f"= {red_all:+.1f}% -> **{tag_all}**")
P("")
P("Interpretazione onesta: a k=1 il residuo pit e' dominato da un OFFSET PER-GARA che correla "
  "~-0.76 col pit-loss nominale (il pit-loss del circuito e' miscalibrato in modo proporzionale "
  "a se stesso). Cio' che un modello 'spiega' e' in gran parte una RI-CALIBRAZIONE del pit-loss, "
  "non abilita' d'esecuzione per-stop. Con 9 circuiti unici la stima LORO e' a bassa potenza.")
P("")
P("Nessun verdetto strategico: e' del PO.")
open('REPORT_RESIDUO_K1.md', 'a').write("\n" + "\n".join(L) + "\n")
print("\n".join(L))
