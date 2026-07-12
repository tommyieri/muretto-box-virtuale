# REPORT_PITLOSS_CALIBRATO — calibrazione del pit-loss per residuo (split-half)

Riduzione MAE sul TEST = **22%** (IC95 bootstrap a blocchi-gara [-19%, 44%]) -> **GO PARZIALE (solo circuiti lato robusto: GB, Miami, Monaco)**
Circuiti con mediana residuo entro ±1,0 s dopo calibrazione: **3/9** (nominale: 1/9)
Valori fisicamente implausibili (fuori 16-28 s): **Cina 34.3s**

Soglie PRE-REGISTRATE: GO se riduzione MAE >=30% E >=7/9 entro ±1,0 s; GO PARZIALE 15-30% (solo GB/Miami/Monaco); NO-GO <15%. Calibrazione IN-SAMPLE di un parametro per-circuito, validata FUORI campione (split-half); NON generalizza a circuiti mai visti (come il pit-loss oggi). Split deterministico: stop ordinati per (giro,pilota), indici pari=FIT, dispari=TEST.

## D1 — Il residuo È l'errore del pit-loss (dimostrato sul codice)

`demo/engine.mjs:32`: `if (pit && d===pit.driver && curLap===pit.lap) cum[d] += pit.loss;` e' l'UNICO termine specifico del pit nell'avanzamento. `demo/pitscenario.mjs:37`: il `cum` viene solo da `simulate`; il resto legge il risultato per posizione/gap, non lo cambia. Il gancio degrado non e' nel path (si importa `simulate`, non `treScenari`). Quindi errore_pitloss = residuo_pit_k1 − mediana(residuo_controllo_k1 stesso pilota/gara).
Verifica numerica: residuo_cal (motore ri-girato) == residuo_nom − correzione entro 5.0e-04 s -> conferma che il solo termine pit e' la loss.

## D2/D3 — Split-half e calibrazione (correzione = MEDIANA errore su FIT)

| circuito | nominale | correzione | calibrato | n_fit | n_test | Δ Sessione C (fisico) | concordano? |
|---|---|---|---|---|---|---|---|
| Gran Bretagna | 29.12 | -9.40 | 19.71 | 7 | 7 | -8.22 | sì |
| Miami | 22.63 | -2.98 | 19.65 | 9 | 8 | -3.12 | sì |
| Monaco | 24.80 | -2.78 | 22.02 | 6 | 6 | -2.80 | sì |
| Spagna | 22.38 | -0.78 | 21.60 | 15 | 15 | +1.99 | no |
| Austria | 21.63 | -0.72 | 20.91 | 15 | 15 | +0.24 | sì |
| Giappone | 23.72 | -0.24 | 23.48 | 5 | 4 | -0.40 | sì |
| Canada | 24.37 | +0.62 | 24.99 | 5 | 4 | +2.96 | no |
| Australia | 18.15 | +6.90 | 25.05 ⚠n_test | 2 | 2 | +7.02 | sì |
| Cina | 22.97 | +11.30 | 34.27 ⚠n_test | 2 | 2 | +9.65 | no |

Cross-check con Sessione C (metodo FISICO indipendente): concordano su **GB (−9,4 vs −8,2), Miami (−3,0 vs −3,1), Monaco (−2,8 vs −2,8)** — il numero e' vero (due metodi diversi, stesso risultato). Sui Δ positivi a piccolo campione (Cina/Australia) i metodi non concordano e nessuno dei due e' affidabile lì. ⚠ = n_test < 4 (verifica non affidabile).

## D4 — Validazione sul solo TEST

- MAE residuo pit k=1: nominale 3.174 s -> calibrato 2.487 s, riduzione 22%.
- Mediana residuo per circuito entro ±1,0 s: nominale 1/9 -> calibrato 3/9.
| circuito | n_test | MAE nom | MAE cal | mediana nom | mediana cal |
|---|---|---|---|---|---|
| Australia | 2 | 2.58 | 4.32 | +2.58 | -4.32 |
| Austria | 15 | 1.04 | 1.37 | +0.52 | +1.24 |
| Canada | 4 | 4.08 | 3.77 | +2.70 | +2.08 |
| Cina | 2 | 4.93 | 6.37 | +4.93 | -6.37 |
| Giappone | 4 | 1.56 | 1.31 | -1.35 | -1.10 |
| Gran Bretagna | 7 | 10.91 | 5.14 | -8.78 | +0.62 |
| Miami | 8 | 2.88 | 0.86 | -3.15 | -0.18 |
| Monaco | 6 | 3.31 | 2.79 | -2.30 | +0.47 |
| Spagna | 15 | 1.83 | 2.32 | +1.85 | +2.63 |

## D5 — Sanità fisica (indipendente dal KPI)

Valori calibrati FUORI 16-28 s (campanello: assorbono altro, NON proporre a prescindere dal KPI):
- **Cina: 34.3 s** (n_fit=2): implausibile. Su pochi stop la mediana cattura contaminazione (in-lap su gomma vecchia, traffico), non il pit-loss. ESCLUSO.

## Verdetto

**GO PARZIALE (solo circuiti lato robusto: GB, Miami, Monaco).** La riduzione MAE sul TEST (22%) sta nella banda 15-30%: si propone la sostituzione SOLO sui circuiti del lato robusto (GB, Miami, Monaco), dove la calibrazione per residuo e il metodo fisico di Sessione C convergono e i calibrati sono plausibili (GB 19,7 / Miami 19,7 / Monaco 22,0 s). Gli altri restano al nominale. Cina (34,3 s, n_test basso) e' fisicamente implausibile e comunque escluso da D5.

NOTA onesta: l'IC95 della riduzione complessiva [-19%, 44%] include lo zero (potenza bassa, 9 blocchi, e la calibrazione PEGGIORA i circuiti gia' buoni come Austria/Spagna, trascinando giu' la media). Il caso GO PARZIALE NON poggia sull'IC complessivo ma sui tre robusti presi da soli: mediana residuo che passa entro ±1 s (GB −8,8→+0,6; Miami −3,2→−0,2; Monaco −2,3→+0,5), convergenza col metodo fisico di Sessione C, e valori calibrati plausibili. La forza sta nella convergenza di due metodi indipendenti, non nel p-value.

La SOSTITUZIONE del file di produzione NON e' in questa sessione: `pit_loss_circuito_f1db.csv` alimenta il modulo pit congelato e i suoi 11/11 golden, che certificano il codice non il dato e vanno rigenerati con nota di metodo — checkpoint umano dedicato, reversibile. Verdetto strategico: del PO.
