# REPORT FASE 1B — validazione del motore replay sulla gara di Spa

Data verdetto: 2026-07-19, sera della gara. KPI e arbitro dichiarati in
[FASE1B_PREREG.md](FASE1B_PREREG.md) (commit `4f29eeb`, prima di qualsiasi
numero). Nessun KPI modificato a posteriori.

**Sintesi: 4 GO su 4 misurabili; KPI 3 (pit stop) RINVIATO per assenza
dell'arbitro, non fallito.**

| KPI | Gate | Verdetto |
|---|---|---|
| 1 replay end-to-end | 0 eccezioni, 4 tipi evento, 22/22 auto | **GO** |
| 2 classifica finale | ordine = arbitro, ritirati inclusi | **GO** (22/22) |
| 3 pit stop | conteggio ≥95% piloti, giro ±1 | **RINVIATO** (arbitro assente) |
| 4 GPS↔pit in gara | coerenza ≥90% | **GO** (30/30, 100%) |
| 5 neutralizzazioni | cronaca coperta, no falsi positivi | **GO** (3/3, 0 fp) |

Input: gara `data/live_raw/2026-07-19_14-53-28.txt` (70.223 righe, file
unico). Arbitro:
[gara_spa_2026_pubblicata.json](../data/live_derived/gara_spa_2026_pubblicata.json)
— f1db fermo a v2026.9.1 (2026-07-06, pre-Spa, verificato prima del
prereg), quindi classifica pubblicata congelata con fonti e data; **il
cross-check f1db va rifatto al rilascio**.

## KPI 1 — replay end-to-end: GO

- **70.223/70.223 righe parsate (100%)**, nessuna eccezione.
- Eventi: 22.513 `position_frame`, 23.423 `timing_update`,
  12 `track_status`, 4 `session_status` — tutti e quattro i tipi.
- **22/22 auto** nei `position_frame`, piu' il trasponder **242 = safety
  car** (compare durante i periodi SC; nota per la Fase 2: i consumatori
  filtrino sui numeri della `DriverList`).

## KPI 2 — classifica finale: GO

- Ordine a fine replay **= arbitro in tutte e 22 le posizioni**, ritirati
  inclusi (P20 STR, P21 PER, P22 RUS).
- Vincitore (ANT #12): **44 giri** = giri totali ufficiali; `LapCount`
  finale **44**.
- Griglia pre-partenza: ultimo frame prima di `Started`
  (13:03:51.7 UTC) con **22/22 auto entro 500 m dal traguardo**,
  incolonnate sul rettilineo — conferma geometrica + visiva in
  [spa_2026_race_xy.svg](../data/live_derived/spa_2026_race_xy.svg)
  (punti rossi).

## KPI 3 — pit stop: RINVIATO (arbitro assente, non fallito)

La sera stessa **nessuna fonte pubblica per-pilota**: il pit-stop-summary
di formula1.com era vuoto e f1db non ha ancora Spa 2026. Come da prereg il
confronto completo (conteggio ≥95%, giro ±1) e' **rinviato al rilascio
f1db**. Nel frattempo:

- Convenzione osservata e documentata: giro dello stop =
  `NumberOfLaps` all'ingresso + 1; ingresso senza uscita (ritiro, parco
  chiuso) non conteggiato.
- **Spot-check di cronaca 3/3**: NOR giro 30 ✓, LEC giro 20 (sotto VSC) ✓,
  HAD giro 20 (sotto VSC) ✓.
- Stop ricostruiti: 30 periodi completati; 21 piloti con ≥1 stop
  (RUS zero stop: ritirato al giro 1 — coerente). Limite noto: 5 ingressi
  sotto la SC dei giri 1–2 hanno giro non attribuito (`NumberOfLaps` non
  ancora nello stato a inizio gara) — da risolvere nel confronto f1db.
- Tutti i numeri in
  [kpi_fase1b.json](../data/live_derived/kpi_fase1b.json).

## KPI 4 — GPS↔pit in gara: GO

- **30/30 periodi InPit verificabili coerenti (100%)** col corridoio
  [pitlane_spa.json](../data/live_derived/pitlane_spa.json) costruito da
  FP2 (soglie identiche alla Fase 1: ≥10 campioni, ≥80% entro 25 m).
- E' anche il test di **stabilita' del corridoio tra sessioni**: superato.

## KPI 5 — neutralizzazioni: GO

Timeline `TrackStatus` del replay vs cronaca pubblica (granularita' di
giro, come dichiarato nell'arbitro congelato):

| Cronaca | Replay | Esito |
|---|---|---|
| SC giro 1 (incidente Russell) | SC giri 1–4 (13:05:25→13:13:49) | coperto |
| VSC giro 18 (detriti curva 17) | VSC giro 18 (13:39:13→13:39:58, 45 s) | coperto |
| VSC giro 20 (pit di Leclerc/Hadjar) | VSC giri 20–21 (13:43:18→13:45:06) | coperto |

- **Zero periodi SC/VSC/rossa nel replay non presenti in cronaca.**
- La VSC del giro 18 dura 45 s (coerente con "nessuno riesce a pittare"),
  quella del giro 20 quasi 2 minuti (la finestra pit della cronaca).
- Nota di misura (nel codice, non nei dati): l'attribuzione del giro alla
  SC della partenza richiede il fallback "dopo il via e prima del primo
  `LapCount` live il giro corrente e' 1".

## Chiusura Fase 1

- **Decoder, replay, allineamento, pit lane, neutralizzazioni: validati
  su FP2 e su una gara completa con SC e 2 VSC.** L'interfaccia eventi di
  `replay.py` e' pronta per il collettore live (Fase 2).
- **Aperto un solo punto**: KPI 3 in attesa dell'arbitro f1db (rilascio
  con Spa 2026). Non e' un NO-GO: e' un verdetto rinviato, con spot-check
  3/3 favorevoli.
- Restano a verbale dalla Fase 1: il NO-GO formale del KPI 2 FP2
  (arbitro miscalibrato, motore corretto — vedi
  [REPORT_FASE1.md](REPORT_FASE1.md)) e la conseguenza per la Fase 2:
  pre-registrare arbitro e politica giri cancellati.
