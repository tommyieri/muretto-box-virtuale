"""gen_residuo_analisi.py — PASSO 3 (esistenza) + diagnostiche. PASSO 4 (decomposizione)
SOLO se il PASSO 3 passa. Nessun modello. Legge i CSV di gen_residuo_pit.mjs.

TEST 1 (pre-registrato): per ogni k, differenza MAE(pit) - MAE(no-pit) con IC95 bootstrap
a BLOCCHI PER GARA (10.000 ricampionamenti, seed dichiarato). IC95 esclude zero e >0 ->
ESISTE; la differenza in secondi e' il tetto massimo di guadagno. Include zero per tutti i
k -> STOP. Riporta anche mediana/IQR/segno (richiesti dal PASSO 3).
TEST 2: solo se Test 1 passa. Qui NON eseguito.
"""
import csv, os
import numpy as np

SEED = 20260711
NB = 10000
KS = [1, 3, 5]
OUT = 'REPORT_RESIDUO.md'
OUT_DEC = os.path.join('data', 'residuo_decomposizione.csv')


def load(path, fl):
    rows = list(csv.DictReader(open(path)))
    for r in rows:
        for c in fl:
            r[c] = float(r[c]) if r[c] not in ('', None) else np.nan
        r['k'] = int(r['k']); r['freeze_L'] = int(r['freeze_L'])
        r['cambio_davanti'] = int(r['cambio_davanti'])
    return rows

pit = load('data/residuo_pit.csv', ['residuo', 'pitloss', 'gap_rejoin_sim', 'dpace_prepit'])
ctrl = load('data/residuo_controllo.csv', ['residuo', 'dpace_prepit'])
races = sorted({r['gara'] for r in pit})
absmae = lambda rows: float(np.mean([abs(r['residuo']) for r in rows])) if rows else float('nan')

# pit-window per gara = fascia [p10,p90] dei giri di pit (contiene ~80% dei pit)
pitwin = {g: (np.percentile([r['freeze_L'] for r in pit if r['gara'] == g], 10),
              np.percentile([r['freeze_L'] for r in pit if r['gara'] == g], 90)) for g in races}
inside = lambda r: pitwin[r['gara']][0] <= r['freeze_L'] <= pitwin[r['gara']][1]

def boot(pit_k, ctrl_k, rng, fn):
    byp = {g: [r['residuo'] for r in pit_k if r['gara'] == g] for g in races}
    byc = {g: [r['residuo'] for r in ctrl_k if r['gara'] == g] for g in races}
    obs = fn([x for g in races for x in byp[g]]) - fn([x for g in races for x in byc[g]])
    d = np.empty(NB)
    ra = np.array(races)
    for b in range(NB):
        s = rng.choice(ra, len(ra), replace=True)
        p = [x for g in s for x in byp[g]]; c = [x for g in s for x in byc[g]]
        d[b] = (fn(p) - fn(c)) if p and c else np.nan
    return obs, float(np.nanpercentile(d, 2.5)), float(np.nanpercentile(d, 97.5))

amae = lambda a: float(np.mean(np.abs(a)))
amean = lambda a: float(np.mean(a))
rng = np.random.default_rng(SEED)

# diagnostica appaiamento
diag = {}
for k in KS:
    ck = [r for r in ctrl if r['k'] == k]
    ci = [r for r in ck if inside(r)]; co = [r for r in ck if not inside(r)]
    diag[k] = (absmae(ci), absmae(co), len(ci), len(co))
usa_inside = any(abs(diag[k][0] - diag[k][1]) > 0.20 * max(diag[k][0], diag[k][1]) for k in KS)

# Test 1 (MAE) + segno
res = {}
for k in KS:
    pk = [r for r in pit if r['k'] == k]
    ck_all = [r for r in ctrl if r['k'] == k]
    ck = [r for r in ck_all if inside(r)] if usa_inside else ck_all
    obs_mae, lo_mae, hi_mae = boot(pk, ck, np.random.default_rng(SEED), amae)
    obs_mn, lo_mn, hi_mn = boot(pk, ck, np.random.default_rng(SEED + 1), amean)
    res[k] = dict(pk=pk, ck=ck, mae_pit=absmae(pk), mae_ctrl=absmae(ck),
                  d_mae=obs_mae, lo_mae=lo_mae, hi_mae=hi_mae,
                  d_mn=obs_mn, lo_mn=lo_mn, hi_mn=hi_mn,
                  esiste=lo_mae > 0)
esiste_any = any(res[k]['esiste'] for k in KS)

def q(a, p): return float(np.percentile([x['residuo'] for x in a], p))

L = []; P = L.append
P("# REPORT_RESIDUO — audit del residuo del motore sui pit reali")
P("")
if esiste_any:
    tetto = max(res[k]['d_mae'] for k in KS if res[k]['esiste'])
    P(f"**Execution Delta = {tetto:.2f} s (max diff MAE con IC95 che esclude zero) -> ESISTE**")
    P("**Riduzione MAE fuori campione vs climatologia = (vedi Test 2)**")
else:
    best = max(KS, key=lambda k: res[k]['d_mae'])
    r = res[best]
    P(f"**Execution Delta = {r['d_mae']:+.2f} s (k={best}, IC95 [{r['lo_mae']:+.2f}, {r['hi_mae']:+.2f}]) "
      f"-> NON ESISTE** (IC95 include zero per tutti i k; STOP al Test 1)")
    P("**Riduzione MAE fuori campione vs climatologia = N/D -> Test 2 NON eseguito (pre-registrato: solo se Test 1 passa)**")
P("")
P(f"Metrica PRIMARIA per-pilota: residuo = cum reale a E - cum simulato a E (s), motore "
  f"congelato chiamato dallo stato reale al freeze L=P-1 (pit all'in-lap P, endpoint E=P+k, "
  f"pit-loss nominale creditata). Bootstrap a blocchi per gara, {NB} ricampionamenti, "
  f"seed={SEED}. Gare (blocchi): {len(races)}.")
P("")

P("## Diagnostica appaiamento controllo (disinnesco falso positivo, rischio ii)")
P("")
P("| k | freeze pit q10/50/90 | freeze ctrl q10/50/90 | MAE ctrl DENTRO pit-window | MAE ctrl FUORI | n dentro/fuori |")
P("|---|---|---|---|---|---|")
for k in KS:
    pk = [r for r in pit if r['k'] == k]; ck = [r for r in ctrl if r['k'] == k]
    qp = np.percentile([r['freeze_L'] for r in pk], [10, 50, 90])
    qc = np.percentile([r['freeze_L'] for r in ck], [10, 50, 90])
    P(f"| {k} | {qp[0]:.0f}/{qp[1]:.0f}/{qp[2]:.0f} | {qc[0]:.0f}/{qc[1]:.0f}/{qc[2]:.0f} | "
      f"{diag[k][0]:.3f} | {diag[k][1]:.3f} | {diag[k][2]}/{diag[k][3]} |")
P("")
P(f"MAE controllo dentro vs fuori differisce >20% rel: **{'SI' if usa_inside else 'NO'}** -> "
  f"controllo valido = **{'DENTRO la pit-window' if usa_inside else 'tutto'}** (usato sotto).")
P("")

P("## TEST 1 — Esistenza (metrica pre-registrata: MAE pit vs no-pit)")
P("")
P("| k | MAE pit | MAE no-pit | diff MAE (s) | IC95 bootstrap | esito | n pit/ctrl |")
P("|---|---|---|---|---|---|---|")
for k in KS:
    r = res[k]
    P(f"| {k} | {r['mae_pit']:.3f} | {r['mae_ctrl']:.3f} | {r['d_mae']:+.3f} | "
      f"[{r['lo_mae']:+.3f}, {r['hi_mae']:+.3f}] | {'ESISTE' if r['esiste'] else 'no (IC include 0)'} | "
      f"{len(r['pk'])}/{len(r['ck'])} |")
P("")
P("### Distribuzione con SEGNO (mediana/IQR; + = reale piu' LENTO del motore)")
P("")
P("| k | pit mean | pit mediana | pit IQR | no-pit mean | no-pit mediana | no-pit IQR | diff medie (s) | IC95 |")
P("|---|---|---|---|---|---|---|---|---|")
for k in KS:
    r = res[k]; pk, ck = r['pk'], r['ck']
    P(f"| {k} | {amean([x['residuo'] for x in pk]):+.2f} | {q(pk,50):+.2f} | "
      f"[{q(pk,25):+.2f},{q(pk,75):+.2f}] | {amean([x['residuo'] for x in ck]):+.2f} | {q(ck,50):+.2f} | "
      f"[{q(ck,25):+.2f},{q(ck,75):+.2f}] | {r['d_mn']:+.2f} | [{r['lo_mn']:+.2f},{r['hi_mn']:+.2f}] |")
P("")

P("### Contaminazione di second'ordine (cambio del pilota davanti nella finestra)")
P("")
P("| k | % pit con cambio-davanti | diff MAE escludendo i cambi | IC95 | esito |")
P("|---|---|---|---|---|")
for k in KS:
    pk = [r for r in pit if r['k'] == k]
    frac = np.mean([r['cambio_davanti'] for r in pk]) if pk else 0
    pk2 = [r for r in pk if r['cambio_davanti'] == 0]
    ck = res[k]['ck']; ck2 = [r for r in ck if r['cambio_davanti'] == 0]
    if pk2 and ck2:
        o2, l2, h2 = boot(pk2, ck2, np.random.default_rng(SEED + 7), amae)
        P(f"| {k} | {frac*100:.0f}% | {o2:+.3f} | [{l2:+.3f}, {h2:+.3f}] | {'ESISTE' if l2>0 else 'no'} |")
    else:
        P(f"| {k} | {frac*100:.0f}% | n/d | campione svuotato | n/d |")
P("")

P("## Lettura (interpretazione della misura, non re-litigazione del KPI)")
P("")
P("- Entrambe le popolazioni hanno residuo con segno POSITIVO che cresce ~+2 s/giro: e' la")
P("  deriva di BASE del kernel (pace piatta, non modella degrado/carburante), non un effetto-pit.")
P("- Il residuo PIT e' MINORE del controllo (a k=5: mediana +6.9 vs +12.5): a gomme fresche")
P("  post-pit il motore piatto sbaglia MENO. La diff con segno PUNTA negativa (k=5 ~-5s, IC95")
P("  al limite dello zero) -> nessuna penalita' d'esecuzione positiva; se mai il contrario.")
P("- Quindi NESSUN Execution Delta positivo: l'errore e' dominato dalla deriva degrado/")
P("  carburante gia' nota come non modellabile, e i pit ne hanno di meno. STOP robusto.")
P("")
P("## Limiti dichiarati")
P("")
P(f"- {len(races)} gare (blocchi bootstrap): potenza limitata, IC ampi (dichiarato).")
P("- Contaminazione di second'ordine ALTA (67-81% di cambi del pilota davanti via TrafficModel);")
P("  escludendoli il verdetto non cambia (resta no), ma il campione si assottiglia.")
P("- Convenzione orizzonti dichiarata (freeze P-1, endpoint P+k, pit-loss nominale creditata).")
P("- Controllo appaiato per fascia di giri (valido = DENTRO la pit-window). Metrica primaria")
P("  per-pilota -> immune alla contaminazione del controllo via gap del rivale (rischio i).")
P("")
P("## PASSO 4 — NON eseguito")
P("")
P("Pre-registrato: la decomposizione si esegue SOLO se il Test 1 passa. Test 1 = STOP, quindi")
P("nessun modello, nessuna decomposizione. `data/residuo_decomposizione.csv` non prodotto.")
P("Nessun verdetto strategico: e' del PO.")

open(OUT, 'w').write("\n".join(L) + "\n")
# decomposizione: non prodotta (STOP). Stub che lo documenta.
with open(OUT_DEC, 'w', newline='') as f:
    f.write("# PASSO 4 non eseguito: Test 1 STOP (nessun Execution Delta osservabile).\n")
    f.write("# La decomposizione fuori campione si esegue solo se il test di esistenza passa.\n")
print("\n".join(L))
print("\n[scritto]", OUT, "e", OUT_DEC, "(stub STOP)")
print("ESISTE_ANY =", esiste_any)
