# FASE 1 — PRE-REGISTRAZIONE (commit prima dei numeri)

Data: 2026-07-17. Committato PRIMA di implementare decoder, replay e verifica
di allineamento, e prima di calcolare qualsiasi numero sui dati registrati.
Nessun KPI puo' essere modificato a posteriori: fallire un KPI = NO-GO su quel
fronte, si documenta, non si aggiusta il KPI.

## Dati di ingresso (registrati, gia' su disco, mai ancora analizzati)

- FP2 Spa 2026 (completa): `data/live_raw/2026-07-17_16-53-20.txt`
- FP1 Spa 2026 (troncata, inizio/fine bruschi): `data/live_raw/2026-07-17_13-33-29.txt`
- Riferimento mappa: telemetria storica FastF1 (GP Belgio 2025, cache
  `~/muretto_shared/ff1_cache/`), stessa fonte usata da `gen_pista_svg.py`
  per le mappe del sito — `pista_Spa` non esiste ancora nel sito perche' la
  gara 2026 non e' corsa.
- Classifica ufficiale FP2: FastF1 results (arbitro gia' adottato dal progetto).

## KPI pre-registrati

1. **Decoder**: ≥99% delle righe di FP2 parsate senza errore; 0 crash su FP1
   troncato; tutte le 20 auto presenti nei `position_frame` di FP2.
2. **Replay**: l'ordine dei migliori tempi ricostruito dallo stato a fine
   replay FP2 coincide con la classifica ufficiale FP2 di Spa; i best lap
   coincidono al millesimo con i tempi ufficiali per almeno 18 auto su 20
   (tolleranza per auto senza tempo).
3. **Frequenza posizioni**: frequenza effettiva mediana per auto misurata e
   riportata (atteso ~2–5 Hz; solo report, non gate).
4. **Allineamento**: dopo l'eventuale trasformazione fissa, ≥95% dei punti
   on-track entro 15 m dalla polilinea del tracciato del sito; punti pit dei
   periodi InPit che formano un corridoio unico coerente.
5. **Cross-check pit**: coerenza GPS↔InPit ≥90% dei periodi pit (il resto
   documentato).

## Vincoli dichiarati

- Lavoro esclusivamente in `live/` + output dati in `data/live_derived/`.
- Nessun import dal kernel; Python della `.venv`; nessuna nuova dipendenza
  (SVG scritto a mano con stdlib, niente matplotlib).
- Eccezione dichiarata (come per i generatori del sito): l'estrazione della
  polilinea di riferimento storica e della classifica ufficiale usa FastF1
  e va lanciata una tantum col `python3` utente; i file derivati diventano
  input statici, gli script di verifica restano stdlib-only.
- Verdetto KPI per KPI in `live/REPORT_FASE1.md`, solo a implementazione
  conclusa.
