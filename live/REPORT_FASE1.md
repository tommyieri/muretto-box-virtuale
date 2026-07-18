# REPORT FASE 1 — decoder, replay, verifica allineamento

Data verdetto: 2026-07-18 (misure eseguite la sera del 17/07, dopo FP2).
KPI dichiarati in [FASE1_PREREG.md](FASE1_PREREG.md) (commit `e962d0f`,
prima di qualunque numero). Nessun KPI modificato a posteriori.

**Sintesi: 4 GO, 1 NO-GO (KPI 2, ordine classifica), 1 solo-report.**

| KPI | Gate | Verdetto |
|---|---|---|
| 1 decoder | ≥99% righe; 0 crash FP1; tutte le auto | **GO** (100%; 0; 22/22) |
| 2 replay vs ufficiale | ordine coincide E ≥18 best al millesimo | **NO-GO** (ordine no; best 20/22) |
| 3 frequenza posizioni | solo report | mediana **3,825 Hz** |
| 4 allineamento | ≥95% on-track entro 15 m | **GO** (97,7%, identità) |
| 5 cross-check pit | coerenza ≥90% | **GO** (98,97%) |

Input: FP2 `data/live_raw/2026-07-17_16-53-20.txt`, FP1 troncata
`data/live_raw/2026-07-17_13-33-29.txt`, riferimento e classifica da
FastF1 (estratti una tantum con [estrai_riferimenti.py](estrai_riferimenti.py)).

## KPI 1 — decoder: GO

- Righe FP2: **24.476/24.476 parsate senza errore (100%)**, soglia ≥99%.
- FP1 troncata: replay completo **senza alcuna eccezione** (10.843 eventi,
  0 righe illeggibili: il troncamento cade tra righe intere).
- Auto nei `position_frame` di FP2: **22 su 22 iscritte**. Nota: il prereg
  scriveva "tutte le 20 auto" ma la griglia 2026 ha 22 auto; letto secondo
  l'intento ("tutte le auto della sessione"), criterio piu' severo, non piu'
  lasco.

## KPI 2 — replay vs classifica ufficiale: NO-GO

Gate congiunto: meta' superata, meta' no → **NO-GO** sul fronte replay.

- **Best al millesimo: 20/22** (soglia ≥18: rispettata). Le 2 divergenze:
  - GAS #10: ufficiale 107,360 / replay 108,955 (Δ +1.595 ms)
  - LEC #16: ufficiale 107,035 / replay 107,468 (Δ +433 ms)
- **Ordine: NON coincide** (P7–P13 scalate dalle posizioni di GAS e LEC).

Causa, verificata nel feed grezzo: **giri cancellati per track limits**
(10 cancellazioni nei RaceControlMessages della sessione). Il feed live
trasmette il best (GAS 1:47.360 al giro 12, LEC 1:47.035 al giro 7) e poi
lo **revoca** riportando `BestLapTime` al tempo precedente. Lo stato replay
rispecchia fedelmente il feed a fine sessione (giri cancellati esclusi);
l'arbitro pre-registrato (FastF1 results) invece **include** i giri
cancellati nelle FP. Con l'arbitro dichiarato il verdetto e' NO-GO e tale
resta; la discrepanza e' dell'arbitro sulle FP, non del decoder — evidenza
utile per la Fase 2, non un via libera.

Nota di misura (non e' un cambio di KPI): per le FP FastF1 lascia
`results.Position` vuota, quindi il confronto d'ordine originario era
degenerato (lista ufficiale vuota → falso a tavolino). L'ordine ufficiale
e' ora derivato dai best ufficiali della stessa fonte-arbitro — per una FP
la classifica E' l'ordine dei best. Ordini completi in
[kpi_fase1.json](../data/live_derived/kpi_fase1.json).

## KPI 3 — frequenza posizioni: solo report

Frequenza effettiva per auto sui `position_frame` FP2: **mediana 3,825 Hz**
(min 3,821, max 3,826 — praticamente identica per tutte le auto: il feed
campiona a blocchi sincroni). Dentro l'atteso 2–5 Hz.

## KPI 4 — allineamento coordinate: GO

- Trasformazione: **identità** (`stimata: false` in
  [transform_spa.json](../data/live_derived/transform_spa.json)) — le
  coordinate live 2026 sono gia' nel sistema della telemetria storica
  FastF1 2025, nessuna correzione per-circuito necessaria a Spa.
- **97,7%** dei 211.073 punti on-track entro 15 m dalla polilinea di
  riferimento (giro pulito ANT, GP Belgio 2025), soglia ≥95%. Il 2,3%
  residuo: escursioni reali (sottosterzi, runoff, giri di rientro).
- SVG: [spa_2026_fp2_xy.svg](../data/live_derived/spa_2026_fp2_xy.svg) —
  riferimento blu, nuvola FP2 arancio (1/10), punti InPit + corridoio verdi.
  Ispezione visiva: la nuvola copre il riferimento su tutto il giro.

## KPI 5 — cross-check GPS↔InPit: GO

- Periodi InPit totali: 120, di cui **23 senza dati GPS** (auto in garage,
  trasponder a (0,0,0): comportamento atteso e dichiarato nel prereg della
  misura) → 97 verificabili.
- **96/97 coerenti (98,97%)**, soglia ≥90%.
- Corridoio pit ([pitlane_spa.json](../data/live_derived/pitlane_spa.json)):
  **68 punti, 376 m**, unico e contiguo, parallelo al rettilineo box —
  coerente con la pit lane reale di Spa (~380 m).
- L'unico periodo divergente, documentato (mai corretto in silenzio):
  auto #10 (GAS), 15:53:37→15:55:35 UTC, 453 campioni, 0% nel corridoio —
  **auto ferma in pista ~2 minuti marcata InPit dal timing** (stesso evento
  del cluster di 5 m scartato dalla costruzione del corridoio, riportato in
  `cluster_scartati`). E' un caso reale di divergenza GPS↔timing, esattamente
  cio' che il KPI doveva far emergere.

## Parametri e file prodotti

- `data/live_derived/transform_spa.json` — identità, `stimata: false`
- `data/live_derived/pitlane_spa.json` — polilinea pit (68 punti, 376 m)
- `data/live_derived/spa_2026_fp2_xy.svg` — verifica visiva
- `data/live_derived/verifica_allineamento.json` — numeri KPI 4–5
- `data/live_derived/kpi_fase1.json` — numeri KPI 1–3 (confronto per auto)
- `data/live_derived/spa_ref_track.json`, `fp2_spa_2026_ufficiale.json` —
  riferimenti estratti una tantum (FastF1, `python3` utente)

Test: `live/test_fase1.py` **11/11** (fixture sintetiche + end-to-end FP2 +
robustezza FP1 troncata).

## Conseguenze per la Fase 2

1. Il fronte replay e' NO-GO **sull'arbitro**, non sul motore: prima di
   costruire la UI live sui best lap serve decidere come trattare i giri
   cancellati (il feed li revoca, FastF1 results FP li tiene). Da risolvere
   con dati alla mano, non aggiustando il KPI a posteriori.
2. Decoder, allineamento (identita', zero taratura) e pit lane sono GO:
   l'interfaccia eventi di `replay.py` e' pronta per il collettore live.
3. La polilinea pit di Spa e' il primo elemento della serie per-circuito.
