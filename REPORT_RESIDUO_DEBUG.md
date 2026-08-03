# REPORT_RESIDUO_DEBUG — debug della misura del residuo (Sessione B)

**Residuo mediano per giro (controllo, post-esclusioni) = 1.88 s/giro -> NON SANA** (soglia 0.3 s/giro, tutti i k)

**Causa principale della deriva ~2 s/giro = il passo del kernel `pace_base` e' FUEL-CORRETTO (serbatoio vuoto, engine.py:47-48, FUEL_COEFF=3/70), e `simulate` lo applica piatto SENZA ri-aggiungere il peso del carburante. Il residuo e' quindi il termine carburante del kernel stesso, ~2 s/giro, positivo e sistematico. Non e' degrado (0.044 s/giro), non e' un bug del passo: e' la correzione-carburante non re-inflazionata.**

Controprova (D4): re-inflazionando il termine carburante del kernel (stessa formula, motore non toccato), il residuo mediano/giro del controllo pulito crolla:

| k | mediana/giro MISURA attuale | mediana/giro con CARBURANTE re-inflazionato |
|---|---|---|
| 1 | +1.876 | +0.269 |
| 3 | +1.850 | +0.319 |
| 5 | +1.819 | +0.370 |

Il crollo a ~0.1 s/giro dimostra che il carburante e' la deriva. Cio' che resta (~0.1 s/giro) e' l'ordine di grandezza fisico atteso (degrado+traffico+rumore).

## D1 — Statistica descrittiva del residuo PER GIRO (cumulato / n_giri finestra)

| pop | k | n | media | MEDIANA | IQR | p90 | p95 | p99 | min | max |
|---|---|---|---|---|---|---|---|---|---|---|
| pit | 1 | 288 | +12.79 | +3.44 | [+1.59,+18.72] | +28.38 | +30.95 | +42.81 | -3.40 | +537.93 |
| pit | 3 | 283 | +11.23 | +2.58 | [+1.29,+15.26] | +30.07 | +41.09 | +52.42 | -1.79 | +269.43 |
| pit | 5 | 267 | +8.60 | +2.96 | [+1.27,+10.15] | +24.40 | +35.74 | +45.21 | -1.18 | +127.24 |
| ctrl | 1 | 6910 | +3.34 | +1.89 | [+1.13,+2.69] | +3.82 | +10.32 | +47.30 | -4.53 | +463.93 |
| ctrl | 3 | 6063 | +3.36 | +1.95 | [+1.17,+2.82] | +4.99 | +11.67 | +41.70 | -4.52 | +233.19 |
| ctrl | 5 | 5254 | +3.35 | +2.02 | [+1.21,+2.99] | +5.03 | +9.89 | +37.47 | -3.76 | +155.37 |

Mediana vs media (controllo k=5): mediana +2.02 ~ media +3.35 -> la deriva e' SISTEMATICA (non una coda di outlier). Ma p99=+37.5 e max=+155.4: esiste ANCHE una coda (neutralizzazione, vedi D2/D5), sovrapposta alla deriva sistematica.

### 20 finestre con |residuo cumulato| maggiore

| pop | gara | drv | L | k | residuo_cum | n_neu | edge | lapped |
|---|---|---|---|---|---|---|---|---|
| pit | Australia | STR | 33 | 3 | +1077.7 | 2 | 0 | 1 |
| pit | Australia | STR | 33 | 1 | +1075.9 | 2 | 0 | 1 |
| ctrl | Monaco | STR | 53 | 3 | +932.8 | 1 | 0 | 1 |
| ctrl | Monaco | STR | 51 | 5 | +932.2 | 1 | 0 | 1 |
| ctrl | Monaco | STR | 55 | 1 | +927.9 | 1 | 0 | 1 |
| pit | Spagna | ALB | 33 | 5 | +763.4 | 1 | 0 | 1 |
| pit | Spagna | ALB | 33 | 3 | +762.4 | 1 | 0 | 1 |
| pit | Spagna | ALB | 33 | 1 | +761.4 | 1 | 0 | 1 |
| ctrl | Miami | ANT | 5 | 5 | +303.3 | 7 | 0 | 0 |
| ctrl | Miami | LEC | 5 | 5 | +302.9 | 7 | 0 | 0 |
| ctrl | Miami | NOR | 5 | 5 | +302.3 | 7 | 0 | 0 |
| ctrl | Miami | RUS | 5 | 5 | +301.0 | 7 | 0 | 0 |
| ctrl | Miami | PIA | 5 | 5 | +299.7 | 7 | 0 | 0 |
| ctrl | Miami | HAM | 5 | 5 | +298.6 | 7 | 0 | 0 |
| ctrl | Miami | COL | 5 | 5 | +293.7 | 7 | 0 | 0 |
| ctrl | Giappone | LEC | 21 | 5 | +286.2 | 7 | 0 | 0 |
| ctrl | Giappone | NOR | 21 | 5 | +285.9 | 7 | 0 | 0 |
| pit | Giappone | ANT | 21 | 5 | +283.7 | 7 | 0 | 0 |
| ctrl | Miami | ALB | 5 | 5 | +282.0 | 7 | 0 | 0 |
| pit | Giappone | HAM | 21 | 5 | +281.2 | 7 | 0 | 0 |

Comune ai top-20: 20/20 contengono >=1 giro neutralizzato. La coda del MAE e' neutralizzazione; la deriva sistematica di fondo e' il carburante (D4).

## D2 — Neutralizzazione DENTRO le finestre (sospetto primario del PO)

| pop | k | n | con neu (flag) | con neu (json) | flag==json? | MAE/giro tutte | MAE/giro senza-neu |
|---|---|---|---|---|---|---|---|
| pit | 1 | 288 | 128 | 127 | 281/288 | 13.15 | 2.43 |
| pit | 3 | 283 | 140 | 145 | 274/283 | 11.36 | 1.65 |
| pit | 5 | 267 | 150 | 154 | 261/267 | 8.67 | 1.41 |
| ctrl | 1 | 6910 | 692 | 928 | 6670/6910 | 3.40 | 1.88 |
| ctrl | 3 | 6063 | 856 | 1049 | 5868/6063 | 3.41 | 1.88 |
| ctrl | 5 | 5254 | 965 | 1124 | 5093/5254 | 3.38 | 1.87 |

Nota: `flag` (neutralized nel formato motore) e `json` (neutralizzazione.json) NON sempre concordano -> discrepanza tra le due fonti (riportata sopra come flag==json?). Escludendo le finestre neutralizzate il MAE/giro scende ma NON a <=0.30: resta la deriva carburante.

## D5 — Altri contaminanti (edge = giro 1/N nella finestra; lapped = doppiato)

| contaminante | n finestre (ctrl) | MAE/giro con | MAE/giro senza |
|---|---|---|---|
| neutralizzato (flag o json) | 3105 | 10.79 | 1.91 (finestre pulite) |
| edge (giro 1/N) | 206 | 2.57 | 1.91 (finestre pulite) |
| lapped (doppiato) | 3923 | 2.92 | 1.91 (finestre pulite) |

Nota di dominio: il formato motore NON porta `status` (stringa '1'): la neutralizzazione e' gia' codificata nel flag `neutralized`. Bandiere gialle LOCALI non SC/VSC non sono nei dati -> limite dichiarato, non risolvibile con questi input.

## D3 — Riconciliazione conteggi pit (incoerenza 382 vs 463 del report A)

- 382 = pit reali distinti (in_lap) nelle 9 gare demo.
- Il '463' della Sessione A NON erano 463 pit: erano esclusioni contate per (finestra, k) su k in {1,3,5}, quindi fino a 3x per pit, e mescolavano motivi. Rinominato: e' 'esclusioni-finestra per neutralizzazione', non 'pit esclusi'.
- Census pit distinti: 382 totali; esclusi prima delle finestre 7 (no_freeze) + 63 (no_pace: il pilota che ha appena pittato non ha pace-base al freeze) + 1 (gomma<3 giri) = 71; restano 311 pit che entrano nelle finestre (poi filtri per-k su endpoint/doppio-pit).

## D6 — Verdetto di sanita' (KPI pre-registrato)

Residuo mediano/giro sul controllo, finestre PULITE (no neu, no edge, no lapped): k=1: +1.876, k=3: +1.850, k=5: +1.819 s/giro (soglia 0.3).

**NON SANA** -> il test di esistenza NON e' eseguibile con questa misura. Non riesguo il Test 1 (pre-registrato). Cause residue NON risolte con le sole esclusioni:

1. **CARBURANTE (dominante, sistematico ~2 s/giro)**: `pace_base` e' fuel-corretto e `simulate` non re-inflaziona il peso. E' intrinseco all'uso del passo del kernel come riferimento assoluto; nessuna esclusione di finestre lo rimuove. La controprova (D4) mostra che re-inflazionandolo il residuo diventa ~0.1 s/giro.
2. **NEUTRALIZZAZIONE (coda)**: finestre con giri SC/VSC dentro; le due fonti (flag vs json) non concordano sempre -> va riconciliata a monte.
3. **Bandiere locali / doppiaggi**: parzialmente flaggabili; le gialle locali non sono nei dati motore.

CONSEGUENZA: lo STOP della Sessione A NON e' incidibile — non perche' esista un Execution Delta nascosto, ma perche' la misura assoluta del residuo era dominata dal termine carburante del kernel, non dall'esecuzione. Una misura sana richiederebbe un riferimento simulato coerente col carburante (re-inflazione): e' un CAMBIO di misura, non una semplice esclusione, e va sancito dal PO. Il Test 1 resta identico e va rieseguito solo su una misura dichiarata sana.

Nota (D4, per il PO): il residuo ~2 s/giro NON e' un errore di ancoraggio del motore nel suo uso proprio (decisioni RELATIVE sui gap, dove l'offset carburante e' comune e si elide). Emerge solo nella metrica ASSOLUTA per-pilota di questo audit. Il +27% (relativo) non e' toccato. Nessun verdetto strategico: e' del PO.
