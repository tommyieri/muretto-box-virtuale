# REPORT_GIUDICE — il metodo gap regge come strumento di misura? (Sessione F)

F0 risoluzione: SE mediana di circuito = [Gran 1.97, Miami 1.64, Monaco 1.38] s -> **INSUFFICIENTE** (soglia <=1,0 s)
F1 bias (placebo strutturato, con segno) = +0.57 s (IC95 [+0.36,+0.71]) -> **DISTORTO MA CORREGGIBILE**
F3: **verdetto NON EMESSO** (F0 insufficiente o F1 non valido).

## F0 — Risoluzione (bootstrap 10.000 sulla mediana di circuito)

| circuito | n stop | refs/stop (mediana) | mediana gap | SE mediana | IC95 |
|---|---|---|---|---|---|
| Australia | 8 | 12 | 26.05 | 5.10 | [18.7,39.0] |
| Austria | 33 | 11 | 21.87 | 0.48 | [21.2,22.5] |
| Canada | 16 | 16 | 27.66 | 1.21 | [25.2,29.8] |
| Cina | 6 | 15 | 34.87 | 5.17 | [26.6,45.6] |
| Giappone | 14 | 17 | 24.47 | 4.57 | [22.2,43.3] |
| Gran Bretagna ⭐ | 18 | 16 | 20.93 | 1.97 | [19.8,26.6] |
| Miami ⭐ | 19 | 14 | 20.85 | 1.64 | [17.7,22.3] |
| Monaco ⭐ | 19 | 14 | 22.08 | 1.38 | [18.3,22.8] |
| Spagna | 40 | 11 | 24.13 | 0.66 | [22.8,25.1] |

Atteso SE ~0,7 s (sigma/sqrt(n)); MISURATO 1,4-2,0 s sui robusti -> **sopra la soglia 1,0 s**.
La differenza: la distribuzione per-stop del gap ha CODE DESTRE grasse (alcuni stop 26-40 s),
che gonfiano l'SE bootstrap della mediana oltre l'attesa gaussiana. Sommato alla sensibilita'
ai riferimenti (F2, spread 4-5 s), lo strumento NON ha la risoluzione richiesta. F0: **STOP**.

## F1 — Placebo strutturato (il bias con segno; il test centrale)

Pit FINTI assegnati a piloti NON pittanti, appaiati per vita-gomma (+/-3 giri) e giro ai
pittanti veri; stessa identica procedura gap. Atteso ~0. Segno atteso dichiarato PRIMA: il
placebo isola la deriva-passo di SELEZIONE (soggetto su gomma vecchia vs pool), NON il
guadagno-gomma del pit vero -> corregge il bias di selezione, non quello gomma (limite).

- Bias complessivo (mediana CON SEGNO, n_placebo=1213): **+0.57 s** (IC95 [+0.36,+0.71], SE 0.08).
- Per circuito: Australia +0.68, Austria +1.52, Canada +0.72, Cina +1.09, Giappone +0.10, Gran -0.06, Miami +0.66, Monaco -0.26, Spagna +0.71.
- Pit reali senza >=2 placebo appaiati, esclusi: 26.
- KPI: |bias|=0.57 -> **DISTORTO MA CORREGGIBILE**. Correzione applicata: gap_corretto = gap − (0.57).

## F2 — Sensibilita' alla scelta dei riferimenti

| circuito | davanti | dietro | gomma<10 | gomma>=10 | entro5pos | oltre5pos | spread |
|---|---|---|---|---|---|---|---|
| Gran Bretagna | 23.9 | 19.5 | 21.5 | 20.8 | 21.8 | 20.6 | 4.4 |
| Miami | 22.4 | 17.1 | 22.0 | 19.5 | 20.4 | 19.6 | 5.4 |
| Monaco | 23.6 | 19.2 | 22.1 | 20.0 | 20.2 | 20.3 | 4.3 |

**Sensibile alla selezione** (spread > 1,0 s): Gran Bretagna, Miami, Monaco. Allarga l'incertezza; non e' STOP automatico ma il verdetto su questi circuiti e' meno fermo.

## F3 — Verdetto (gap corretto vs calibrato D; soglie invariate 1,5 / 3,0 s)

| circuito | gap | gap_corretto (IC95) | calibrato D | reale C | nominale | |gapcorr−D| | verdetto |
|---|---|---|---|---|---|---|---|
| Gran Bretagna ⭐ | 20.93 | 20.36 [19.8,26.6] | 19.71 | 20.90 | 29.12 | 0.65 | NON EMESSO |
| Miami ⭐ | 20.85 | 20.28 [17.7,22.3] | 19.65 | 19.51 | 22.63 | 0.63 | NON EMESSO |
| Monaco ⭐ | 22.08 | 21.51 [18.3,22.8] | 22.02 | 22.00 | 24.8 | 0.51 | NON EMESSO |
| Australia | 26.05 | 25.48 [18.7,39.0] | 25.05 | 25.17 | 18.15 | 0.43 | NON EMESSO |
| Austria | 21.87 | 21.30 [21.2,22.5] | 20.91 | 21.87 | 21.63 | 0.39 | NON EMESSO |
| Canada | 27.66 | 27.09 [25.2,29.8] | 24.99 | 27.33 | 24.37 | 2.10 | NON EMESSO |
| Cina | 34.87 | 34.30 [26.6,45.6] | 34.27 | 32.62 | 22.97 | 0.03 | NON EMESSO |
| Giappone | 24.47 | 23.90 [22.2,43.3] | 23.48 | 23.32 | 23.72 | 0.42 | NON EMESSO |
| Spagna | 24.13 | 23.56 [22.8,25.1] | 21.60 | 24.37 | 22.38 | 1.96 | NON EMESSO |

**STOP (F0 pre-registrato): il giudice non ha risoluzione (SE mediana 1,4-2,0 s > 1,0 s).**
Verdetto NON emesso, nessuna sostituzione. GB resta a 29,12, il debito resta scritto.

Onesta': i punti-stima del gap corretto CADONO vicinissimi a D (GB 20,4 vs 19,7 -> 0,65; Miami 20,3 vs 19,7 -> 0,63; Monaco 21,5 vs 22,0 -> 0,51), il che e' suggestivo. MA la soglia
di conferma e' 1,5 s e l'incertezza PROPRIA dello strumento (SE 1,4-2,0 s + spread 4-5 s fra
riferimenti davanti/dietro) e' dello stesso ordine: la vicinanza potrebbe essere fortuna. Il
giudice, cosi' com'e', non e' abbastanza fermo per autorizzare la riscrittura dei golden di un
modulo congelato. Un NO qui e' un risultato, non un fallimento.

LIMITE del giudice (dichiarato): il placebo corregge la deriva di selezione ma NON il
guadagno-gomma; gap_corretto puo' restare una lieve sotto-stima del pit-loss vero. Non tocca
il verdetto vs D (che misura la stessa quantita' col vero out-lap), ma va ricordato.

Nessun verdetto strategico (sostituire, rigenerare golden): e' del PO.
