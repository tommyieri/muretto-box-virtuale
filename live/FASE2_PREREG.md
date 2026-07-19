# FASE 2 — PRE-REGISTRAZIONE (commit prima dell'implementazione)

Data: 2026-07-19. Committato PRIMA di implementare il collettore live.
Nessun KPI puo' essere modificato a posteriori: fallire un KPI = NO-GO
documentato, mai aggiustato.

## Decisioni congelate (ereditate dai verbali di Fase 1)

1. **Arbitro FP e politica giri cancellati** (verbale KPI 2 FP2,
   REPORT_FASE1.md): per le sessioni di prove la classifica di riferimento
   e' quella **al netto dei giri cancellati** — cioe' il comportamento del
   feed live (`BestLapTime` revocato). **FastF1 results NON e' arbitro per
   le FP.**
2. **Trasponder safety car (242)** (verbale FASE1B): nei `position_frame`
   le auto NON presenti nella `DriverList` sono **filtrate di default** dal
   campo `cars` e conservate nel campo separato **`extra_cars`** (cosi' la
   mappa potra' mostrare la SC durante le neutralizzazioni). **Mai nella
   classifica.** Il filtro e' attivo solo a `DriverList` nota: senza
   `DriverList` (fixture sintetiche) nessun filtro.
3. **Buffer di distribuzione**: gli eventi sono serviti ai client con
   **ritardo fisso configurabile, default 4 s** (dall'arrivo al collettore)
   per assorbire il jitter del feed.

## KPI pre-registrati (validazione al prossimo weekend di GP)

Durante il weekend il collettore gira sul VPS; in parallelo Tommi registra
dal Mac come backup (doppia registrazione = confronto indipendente).

1. **Uptime**: il collettore copre tutte le sessioni del weekend senza
   intervento manuale; riconnessioni automatiche ammesse e loggate; zero
   buchi >30 s durante le sessioni — GO/NO-GO.
2. **Parita' registrazione**: conteggi per topic del file server vs file
   Mac entro ±1% sulle sessioni coperte da entrambi — GO/NO-GO.
3. **Coerenza eventi**: gli eventi serviti via WebSocket durante una
   sessione, salvati da un client di test, coincidono con quelli prodotti
   da `replay.py` sul file registrato dal server nello stesso intervallo —
   GO/NO-GO.
4. **Latenza**: differenza mediana tra timestamp evento e ricezione
   client < buffer + 5 s, misurata e riportata — GO/NO-GO.
5. **Token**: procedura di rinnovo eseguita da Tommi almeno una volta con
   successo, documentata — GO/NO-GO.

## Vincoli dichiarati

- Codice in `live/collector/`; nessun import dal kernel.
- Sul SERVER: venv dedicata con dipendenze minime dichiarate
  (`fastf1` per client SignalR + autenticazione, `websockets` per il
  server WS; il resto stdlib). Sul Mac restano le regole di sempre
  (la `.venv` esistente gia' soddisfa entrambe).
- Registrazione grezza sul server in formato IDENTICO al registratore Mac:
  file ispezionabili con `inspect_recording.py`, riproducibili con
  `replay.py`.
- Interfaccia eventi IDENTICA al replay di Fase 1 (`position_frame`,
  `timing_update`, `track_status`, `session_status`) + snapshot alla
  connessione; modalita' `--replay` del collettore indistinguibile dal
  live lato client.
- Test locali consegnati subito (daemon `--replay` su FP2 = eventi
  identici al replay diretto); la validazione live aspetta il prossimo GP.
- Scelte architettoniche non ovvie documentate in
  `live/collector/README.md`; verdetti in `live/REPORT_FASE2.md` dopo il
  weekend di validazione.
