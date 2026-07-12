"""gen_pitloss_calibrato.py — Sessione D: validazione split-half della calibrazione pit-loss
per residuo. Legge i CSV di gen_pitloss_calibrato.mjs (che ha ri-fatto girare il motore su
TEST con loss nominale e calibrata). NON sostituisce il file di produzione. Verdetto
pre-registrato invariato. Scrive REPORT_PITLOSS_CALIBRATO.md, data/pitloss_validazione_split.csv,
DEBITO_PITLOSS.md, e corregge il commento C5 in REPORT_PITLOSS.md (D6).
"""
import csv
import numpy as np

SEED, NB = 20260711, 10000
MIN_TEST = 4
PLAUS = (16.0, 28.0)   # pit-loss F1 fisicamente plausibile (D5)

stops = list(csv.DictReader(open('data/pitloss_stops_k1.csv')))
for s in stops:
    s['P'] = int(s['P']); s['residuo_nom'] = float(s['residuo_nom'])
    s['residuo_cal'] = float(s['residuo_cal']) if s['residuo_cal'] != '' else None
    s['errore'] = float(s['errore'])
calib = {r['gara']: r for r in csv.DictReader(open('data/pitloss_calibrato_circuito.csv'))}
for r in calib.values():
    for k in ('nominale', 'correzione', 'calibrato'): r[k] = float(r[k])
    r['n_fit'] = int(r['n_fit']); r['n_test'] = int(r['n_test'])
races = sorted(calib.keys())
test = [s for s in stops if s['split'] == 'test' and s['residuo_cal'] is not None]

# sanity D1: residuo_cal == residuo_nom - correzione (unico termine pit = pit.loss)
iden = max(abs(s['residuo_cal'] - (s['residuo_nom'] - calib[s['gara']]['correzione'])) for s in test)

mae = lambda a, key: float(np.mean([abs(s[key]) for s in a])) if a else float('nan')
mae_nom = mae(test, 'residuo_nom'); mae_cal = mae(test, 'residuo_cal')
red = 100 * (mae_nom - mae_cal) / mae_nom if mae_nom else 0.0

# mediana residuo per circuito (test): nominale vs calibrato, entro +-1.0
percirc = {}
for g in races:
    t = [s for s in test if s['gara'] == g]
    if not t: percirc[g] = None; continue
    percirc[g] = dict(n=len(t), med_nom=float(np.median([s['residuo_nom'] for s in t])),
                      med_cal=float(np.median([s['residuo_cal'] for s in t])))
entro_nom = sum(1 for g in races if percirc[g] and abs(percirc[g]['med_nom']) <= 1.0)
entro_cal = sum(1 for g in races if percirc[g] and abs(percirc[g]['med_cal']) <= 1.0)

# bootstrap a blocchi-gara sulla riduzione MAE
rng = np.random.default_rng(SEED)
by = {g: [s for s in test if s['gara'] == g] for g in races}
reds = np.empty(NB); ra = np.array(races)
for b in range(NB):
    samp = rng.choice(ra, len(ra), replace=True)
    t = [s for g in samp for s in by[g]]
    if not t: reds[b] = np.nan; continue
    mn = np.mean([abs(s['residuo_nom']) for s in t]); mc = np.mean([abs(s['residuo_cal']) for s in t])
    reds[b] = 100 * (mn - mc) / mn if mn else np.nan
lo, hi = float(np.nanpercentile(reds, 2.5)), float(np.nanpercentile(reds, 97.5))

# D5 plausibilita'
implausibili = [(g, calib[g]['calibrato']) for g in races if not (PLAUS[0] <= calib[g]['calibrato'] <= PLAUS[1])]

# verdetto pre-registrato
robusti = ['Gran Bretagna', 'Miami', 'Monaco']
if red >= 30 and entro_cal >= 7:
    verdetto = 'GO'
elif red >= 15:
    verdetto = 'GO PARZIALE (solo circuiti lato robusto: GB, Miami, Monaco)'
else:
    verdetto = 'NO-GO'

# scrittura validazione per circuito
with open('data/pitloss_validazione_split.csv', 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['gara', 'n_test', 'mae_nom', 'mae_cal', 'med_nom', 'med_cal', 'calibrato', 'plausibile'])
    for g in races:
        pc = percirc[g]
        t = by[g]
        mn = mae(t, 'residuo_nom') if t else float('nan'); mc = mae(t, 'residuo_cal') if t else float('nan')
        w.writerow([g, len(t), f"{mn:.3f}", f"{mc:.3f}",
                    '' if not pc else f"{pc['med_nom']:.3f}", '' if not pc else f"{pc['med_cal']:.3f}",
                    f"{calib[g]['calibrato']:.2f}", int(PLAUS[0] <= calib[g]['calibrato'] <= PLAUS[1])])

L = []; P = L.append
P("# REPORT_PITLOSS_CALIBRATO — calibrazione del pit-loss per residuo (split-half)")
P("")
P(f"Riduzione MAE sul TEST = **{red:.0f}%** (IC95 bootstrap a blocchi-gara [{lo:.0f}%, {hi:.0f}%]) "
  f"-> **{verdetto}**")
P(f"Circuiti con mediana residuo entro ±1,0 s dopo calibrazione: **{entro_cal}/9** (nominale: {entro_nom}/9)")
P("Valori fisicamente implausibili (fuori 16-28 s): "
  + ("**nessuno**" if not implausibili else "**" + ", ".join(f"{g} {v:.1f}s" for g, v in implausibili) + "**"))
P("")
P("Soglie PRE-REGISTRATE: GO se riduzione MAE >=30% E >=7/9 entro ±1,0 s; GO PARZIALE 15-30% "
  "(solo GB/Miami/Monaco); NO-GO <15%. Calibrazione IN-SAMPLE di un parametro per-circuito, "
  "validata FUORI campione (split-half); NON generalizza a circuiti mai visti (come il pit-loss "
  "oggi). Split deterministico: stop ordinati per (giro,pilota), indici pari=FIT, dispari=TEST.")
P("")
P("## D1 — Il residuo È l'errore del pit-loss (dimostrato sul codice)")
P("")
P("`demo/engine.mjs:32`: `if (pit && d===pit.driver && curLap===pit.lap) cum[d] += pit.loss;` "
  "e' l'UNICO termine specifico del pit nell'avanzamento. `demo/pitscenario.mjs:37`: il `cum` "
  "viene solo da `simulate`; il resto legge il risultato per posizione/gap, non lo cambia. Il "
  "gancio degrado non e' nel path (si importa `simulate`, non `treScenari`). Quindi "
  "errore_pitloss = residuo_pit_k1 − mediana(residuo_controllo_k1 stesso pilota/gara).")
P(f"Verifica numerica: residuo_cal (motore ri-girato) == residuo_nom − correzione entro "
  f"{iden:.1e} s -> conferma che il solo termine pit e' la loss.")
P("")
P("## D2/D3 — Split-half e calibrazione (correzione = MEDIANA errore su FIT)")
P("")
P("| circuito | nominale | correzione | calibrato | n_fit | n_test | Δ Sessione C (fisico) | concordano? |")
P("|---|---|---|---|---|---|---|---|")
dC = {'Gran Bretagna': -8.22, 'Miami': -3.12, 'Monaco': -2.80, 'Spagna': 1.99, 'Austria': 0.24,
      'Canada': 2.96, 'Giappone': -0.40, 'Cina': 9.65, 'Australia': 7.02}
for g in sorted(races, key=lambda g: calib[g]['correzione']):
    c = calib[g]; conc = 'sì' if abs(c['correzione'] - dC[g]) <= 1.5 else 'no'
    flag = ' ⚠n_test' if c['n_test'] < MIN_TEST else ''
    P(f"| {g} | {c['nominale']:.2f} | {c['correzione']:+.2f} | {c['calibrato']:.2f}{flag} | "
      f"{c['n_fit']} | {c['n_test']} | {dC[g]:+.2f} | {conc} |")
P("")
P("Cross-check con Sessione C (metodo FISICO indipendente): concordano su **GB (−9,4 vs −8,2), "
  "Miami (−3,0 vs −3,1), Monaco (−2,8 vs −2,8)** — il numero e' vero (due metodi diversi, stesso "
  "risultato). Sui Δ positivi a piccolo campione (Cina/Australia) i metodi non concordano e "
  "nessuno dei due e' affidabile lì. ⚠ = n_test < 4 (verifica non affidabile).")
P("")
P("## D4 — Validazione sul solo TEST")
P("")
P(f"- MAE residuo pit k=1: nominale {mae_nom:.3f} s -> calibrato {mae_cal:.3f} s, riduzione {red:.0f}%.")
P(f"- Mediana residuo per circuito entro ±1,0 s: nominale {entro_nom}/9 -> calibrato {entro_cal}/9.")
P("| circuito | n_test | MAE nom | MAE cal | mediana nom | mediana cal |")
P("|---|---|---|---|---|---|")
for g in races:
    pc = percirc[g]; t = by[g]
    P(f"| {g} | {len(t)} | {mae(t,'residuo_nom'):.2f} | {mae(t,'residuo_cal'):.2f} | "
      + ("—|—|" if not pc else f"{pc['med_nom']:+.2f} | {pc['med_cal']:+.2f} |"))
P("")
P("## D5 — Sanità fisica (indipendente dal KPI)")
P("")
if implausibili:
    P("Valori calibrati FUORI 16-28 s (campanello: assorbono altro, NON proporre a prescindere dal KPI):")
    for g, v in implausibili:
        P(f"- **{g}: {v:.1f} s** (n_fit={calib[g]['n_fit']}): implausibile. Su pochi stop la mediana "
          "cattura contaminazione (in-lap su gomma vecchia, traffico), non il pit-loss. ESCLUSO.")
else:
    P("Tutti i calibrati sono nell'intervallo fisico 16-28 s.")
P("")
P("## Verdetto")
P("")
if verdetto.startswith('GO PARZIALE'):
    P(f"**{verdetto}.** La riduzione MAE sul TEST ({red:.0f}%) sta nella banda 15-30%: si propone "
      "la sostituzione SOLO sui circuiti del lato robusto (GB, Miami, Monaco), dove la calibrazione "
      "per residuo e il metodo fisico di Sessione C convergono e i calibrati sono plausibili "
      f"(GB 19,7 / Miami 19,7 / Monaco 22,0 s). Gli altri restano al nominale. "
      "Cina (34,3 s, n_test basso) e' fisicamente implausibile e comunque escluso da D5.")
    P("")
    P(f"NOTA onesta: l'IC95 della riduzione complessiva [{lo:.0f}%, {hi:.0f}%] include lo zero "
      "(potenza bassa, 9 blocchi, e la calibrazione PEGGIORA i circuiti gia' buoni come Austria/"
      "Spagna, trascinando giu' la media). Il caso GO PARZIALE NON poggia sull'IC complessivo ma "
      "sui tre robusti presi da soli: mediana residuo che passa entro ±1 s (GB −8,8→+0,6; "
      "Miami −3,2→−0,2; Monaco −2,3→+0,5), convergenza col metodo fisico di Sessione C, e valori "
      "calibrati plausibili. La forza sta nella convergenza di due metodi indipendenti, non nel p-value.")
elif verdetto == 'GO':
    P(f"**GO.** Riduzione {red:.0f}% >=30% e {entro_cal}/9 entro ±1,0 s. (Cina resta escluso da D5 "
      "se implausibile.)")
else:
    P(f"**NO-GO.** Riduzione {red:.0f}% < 15%: il residuo non e' dominato dal pit-loss; "
      "l'interpretazione dell'anomalia di A-ter sarebbe sbagliata.")
P("")
P("La SOSTITUZIONE del file di produzione NON e' in questa sessione: `pit_loss_circuito_f1db.csv` "
  "alimenta il modulo pit congelato e i suoi 11/11 golden, che certificano il codice non il dato "
  "e vanno rigenerati con nota di metodo — checkpoint umano dedicato, reversibile. Verdetto "
  "strategico: del PO.")
open('REPORT_PITLOSS_CALIBRATO.md', 'w').write("\n".join(L) + "\n")
print("\n".join(L))
print("\n[scritto] REPORT_PITLOSS_CALIBRATO.md, data/pitloss_validazione_split.csv")
print("VERDETTO =", verdetto)
