# FASE 1B — PRE-REGISTRAZIONE (commit prima dei numeri)

Data: 2026-07-19, sera dopo la gara. Committato PRIMA di eseguire il replay
della gara e di calcolare qualsiasi numero sulla registrazione. Nessun KPI
puo' essere modificato a posteriori: fallire un KPI = NO-GO documentato,
mai aggiustato.

## Dati di ingresso

- Gara Spa 2026 (registrazione live, mai ancora analizzata):
  `data/live_raw/2026-07-19_14-53-28.txt` (file unico, nessuna parte).
- Corridoio pit di riferimento: `data/live_derived/pitlane_spa.json`
  (costruito da FP2 in Fase 1 — il riuso in gara e' anche test di
  stabilita' tra sessioni).

## Arbitro (lezione del KPI 2 FP2, a verbale in REPORT_FASE1.md)

- **f1db NON disponibile**: ultimo rilascio v2026.9.1 del 2026-07-06,
  precedente a Spa (verificato su GitHub prima di questo commit).
- Arbitro quindi: **classifica ufficiale di gara pubblicata da
  formula1.com**, congelata in
  `data/live_derived/gara_spa_2026_pubblicata.json` con fonti e data di
  recupero (come per FP2). Pit stop per-pilota (numero e giro) e cronaca
  delle neutralizzazioni dalla stessa operazione di congelamento.
- **Il cross-check f1db andra' rifatto al rilascio** con Spa 2026
  (classifica + pit stop per-stop con giro e durata).
- Nota: per la classifica di GARA il problema dei giri cancellati non si
  pone (l'ordine e' dato dall'arrivo): l'ambiguita' d'arbitro delle FP qui
  non esiste.

## KPI pre-registrati (GO/NO-GO)

1. **Replay gara**: `replay.py --speed max` sull'intera gara senza
   eccezioni; eventi di tutti e quattro i tipi; 22/22 auto nei
   `position_frame`.
2. **Classifica finale**: ordine dei classificati a fine replay =
   classifica ufficiale (ritirati inclusi, come da arbitro).
3. **Pit stop**: dai periodi InPit dello state manager, numero di stop
   esatto per ≥95% dei piloti; giro d'ingresso entro ±1 giro dall'arbitro
   (la convenzione di attribuzione del giro puo' differire di uno:
   si documenta la convenzione osservata, non si aggiustano i dati).
4. **Pit lane GPS in gara**: i punti posizione dei periodi InPit cadono
   nel corridoio `pitlane_spa.json` di FP2 per ≥90% dei periodi
   verificabili (criteri di verificabilita' identici alla Fase 1:
   ≥10 campioni, quota ≥80% entro 25 m).
5. **Neutralizzazioni**: timeline `TrackStatus` del replay coerente con la
   cronaca pubblica: ogni periodo SC/VSC/rossa della cronaca compare nella
   timeline con inizio/fine entro ±30 s. Se la gara e' stata tutta verde:
   timeline replay tutta verde, nessun falso positivo.

Verifica aggiuntiva dichiarata (dentro KPI 2, non gate autonomo): il
vincitore completa 44 giri e il `LapCount` finale e' coerente; griglia di
partenza verificata geometricamente sul primo `position_frame`
pre-partenza + conferma visiva `spa_2026_race_xy.svg` (punti pit in colore
distinto).

## Vincoli dichiarati

- Solo `live/` + `data/live_derived/`; nessun import dal kernel; Python
  della `.venv`; nessuna nuova dipendenza; SVG stdlib.
- Script di verifica TRACCIATI: `live/verifica_gara.py` (niente pattern
  gitignorato `diag_*`).
- Output numerico: `data/live_derived/kpi_fase1b.json`; verdetto KPI per
  KPI in `live/REPORT_FASE1B.md`.
- Con 5 GO la Fase 1 e' formalmente chiusa; ogni NO-GO resta aperto e
  documentato.
