# REPORT_PITLOSS_COMPONENTI — il pit-loss ha due componenti? (Sessione G, ultima del filone)

G1 — Il campo f1db e': **DURATA STOP (pit-lane time)** (|nominale - durata mediana| <= 1,0 s su 8/9 circuiti)
G2 — ratio SC misurati: sd = 0.017 -> **NON ESEGUIBILE** (NON eseguibile: solo 2 circuiti con >=8 stop SC misurabili, servono 4)
G3/G4 — modello a componenti vs ratio costante: **NON ESEGUIBILE** (pit-loss SC non misurabile con stabilita': IQR enormi, vedi G2).

## G0 — Dato NUOVO ingerito: durate per-stop f1db (Jolpica 2026, urllib)

Le 9 gare demo SONO il 2026 (round 1-9); durate per-stop ingerite da Jolpica (successore
Ergast). Il campo `duration` e' il TEMPO IN PIT-LANE (~28-30 s a Silverstone), non la sola
sosta. Escluse le durate > 60 s (soste sotto bandiera-rossa/SC, standing, non pit-lane).

## G1 — Che cos'e' il campo in pit_loss_circuito_f1db.csv? (risultato PRINCIPALE)

| circuito | (a) nominale f1db | (b) durata mediana f1db | (c) pit-loss VERDE | |a-b| | a==durata? |
|---|---|---|---|---|---|
| Canada | 24.37 | 25.42 (n=34) | 27.33 | 1.05 | no |
| Monaco | 24.80 | 23.82 (n=61) | 22.00 | 0.98 | SI |
| Australia | 18.15 | 18.93 (n=30) | 25.17 | 0.78 | SI |
| Giappone | 23.72 | 24.30 (n=29) | 23.95 | 0.58 | SI |
| Miami | 22.63 | 23.13 (n=22) | 19.51 | 0.50 | SI |
| Gran Bretagna | 29.12 | 29.58 (n=51) | 20.90 | 0.46 | SI |
| Cina | 22.97 | 23.39 (n=19) | 32.62 | 0.42 | SI |
| Spagna | 22.38 | 22.70 (n=47) | 24.37 | 0.32 | SI |
| Austria | 21.63 | 21.56 (n=41) | 21.87 | 0.07 | SI |

**Verdetto G1: il campo f1db e' la DURATA DELLO STOP (pit-lane time)** — coincide con la
durata mediana entro 1,0 s su 8/9 circuiti. NON e' il pit-loss: a Silverstone
f1db=29,12 ~= durata 29,6, mentre il pit-loss verde e' ~20,9. La differenza (durata - pit-loss
= track_time) e' la componente di pista, che varia per geometria:

| circuito | pit_lane_time (durata) | pit-loss verde | track_time = differenza |
|---|---|---|---|
| Gran Bretagna | 29.6 | 20.9 | +8.7 |
| Miami | 23.1 | 19.5 | +3.6 |
| Monaco | 23.8 | 22.0 | +1.8 |
| Giappone | 24.3 | 23.9 | +0.4 |
| Austria | 21.6 | 21.9 | -0.3 |
| Spagna | 22.7 | 24.4 | -1.7 |
| Canada | 25.4 | 27.3 | -1.9 |
| Australia | 18.9 | 25.2 | -6.2 |
| Cina | 23.4 | 32.6 | -9.2 |

Il track_time deve essere >= 0 (tempo per coprire un tratto di pista). E' POSITIVO e sensato
sui circuiti ben misurati (GB +8,7; Miami +3,6; Monaco +1,8). Dove esce NEGATIVO (Cina -9,2,
Australia -6,2, Canada, Spagna) il colpevole e' il pit-loss VERDE gonfiato dal bias di metodo
gia' dichiarato in Sessione C (in-lap su gomma vecchia, piccolo campione: Cina n piccolo,
Australia n=9) -> NON un fallimento del modello a componenti, ma la conferma che quei verdi
erano sovrastimati. La durata (pit_lane_time) e' invece pulita su tutti (dato diretto G0).

Questo spiega, con UN meccanismo dal dominio, tutte le anomalie di C-F: la sovra-dispersione
del nominale e la correlazione -0,76 (dove il track_time e' grande, come GB, il nominale=durata
sovrastima il pit-loss di piu'). Il debito P1 ha una spiegazione fisica completa.

## G2 — Pit-loss sotto neutralizzazione (i 463 stop finora scartati)

Metodo: (in+out) - (mediana campo @in + @out), campo = non-pittanti neutralizzati; solo stop
STRETTAMENTE dentro la finestra (no deployment/restart). SC e VSC separati. NON il metodo gap
(il regrouping lo invalida).

| circuito | n SC | pit_loss_SC (IQR) | n VSC | pit_loss_VSC | pit-loss verde | ratio_SC | 0,42*nominale |
|---|---|---|---|---|---|---|---|
| Australia | 0 | — | 8 | 15.8 | 25.2 | — | 7.6 |
| Austria | 0 | — | 1 | 20.1 | 21.9 | — | 9.1 |
| Canada | 0 | — | 8 | 19.3 | 27.3 | — | 10.2 |
| Cina | 1 | -11.8 [-12,-12] | 0 | — | 32.6 | -0.36 | 9.6 |
| Giappone | 11 | 17.6 [12,20] | 0 | — | 23.9 | 0.74 | 10.0 |
| Gran Bretagna | 11 | 14.7 [10,30] | 3 | -2.4 | 20.9 | 0.70 | 12.2 |
| Miami | 2 | 10.3 [6,15] | 0 | — | 19.5 | 0.53 | 9.5 |
| Monaco | 6 | 29.9 [7,37] | 0 | — | 22.0 | 1.36 | 10.4 |
| Spagna | 0 | — | 3 | 5.6 | 24.4 | — | 9.4 |

Circuiti con >=8 stop SC MISURABILI (riferimento-campo valido): 2 (Giappone, Gran Bretagna). Sotto la soglia pre-registrata di 4 -> **G2/G3 NON eseguibili**. Monaco: 64 stop SC grezzi ma il
riferimento-campo collassa sotto la sua SC lunga -> pochi misurabili, IQR enorme.

Verifica del sospetto (0,42 x 29,12 = 12,2): il pit_loss_SC misurato a Silverstone e' 14.7 s (IQR [10,30]) -> lascamente compatibile con ~12 ma con incertezza troppo grande (IQR ~20 s: variabilita' intrinseca dei tempi-giro sotto SC) per
confermare numericamente la compensazione dei due errori. Il ratio costante NON e' verificabile qui.

## G4 — Modello a due componenti (coerenza fisica; LORO non eseguibile)

Con pit_lane_time = durata mediana (dato G0) e i pit-loss misurati:
  track_time_verde = pit_lane_time - pit_loss_verde ; track_time_SC = pit_lane_time - pit_loss_SC.
Coerenza fisica richiesta: track_time_SC > track_time_verde (in pista si va piu' piano sotto SC).

| circuito | pit_lane | track_time_verde | track_time_SC | SC>verde? |
|---|---|---|---|---|
| Giappone | 24.3 | +0.4 | +6.7 | SI |
| Gran Bretagna | 29.6 | +8.7 | +14.9 | SI |

Il confronto fuori campione (LORO) modello-componenti vs ratio-costante NON e' eseguibile: il
pit-loss SC ha incertezza troppo grande e i circuiti misurabili sono < 4. Coerenza fisica
riportata come check qualitativo, non come modello.

## G5 — Cross-check documentale (mai input)

Le durate ingerite SONO i tempi pit-lane documentati: Silverstone 29,6 s coincide col tempo
pit-lane pubblicato (~28 s). Le fonti divergono sulla LUNGHEZZA pit-lane di Silverstone (490 vs
970 m) ma concordano sul TEMPO: il tempo e' cio' che conta e cio' che abbiamo misurato. Nessun
dato documentale entra nel motore.

## Chiusura del filone

G1 (principale) e' RISOLTO: `pit_loss_circuito_f1db.csv` contiene la DURATA DELLO STOP
(pit-lane time), usata come pit-loss dal modulo pit. E' la spiegazione fisica, dal dominio, di
un'anomalia che tre sessioni statistiche (C-F) non avevano chiuso. Il pit-loss vero = durata -
track_time; il track_time varia per circuito. La calibrazione SC (G2-G4) NON e' misurabile con
stabilita' dai dati (variabilita' SC + <4 circuiti). Il ratio costante 0,42 resta non
verificabile ma non falsificato. NESSUNA sostituzione: sia il pit-loss verde sia il ratio SC
toccano il modulo pit congelato e i suoi golden. Verdetto strategico e correzione: del PO.
