# REPORT — FASE C, abilitante: decodifica stint nel collettore (compound + età-gomma live)

*Sessione 2026-07-20, branch claude/fase-c-abilitante. Autorizzato dal PO ("dai l'ok
all'abilitante nel collettore"). Segue la fattibilità (PR #65).*

## Cosa cambia

Il collettore ora **decodifica gli stint gomma** dal feed SignalR (`TimingAppData`) e li
espone al client live come `compound` + `tyre_age` — gli input che servono agli scenari
di degrado live. Tre modifiche mirate, tutte sul percorso SignalR (il ramo OpenF1
rotto/sperimentale non è toccato):

1. **`live/decoder.py`**
   - `StatoSessione.aggiorna`: nuovo handler `TimingAppData` — fonde `Lines[num]` (che
     contiene `Stints`) nello STESSO stato per-pilota di `TimingData`, riusando
     `merge_delta` (gestisce sia la lista-snapshot sia il diff per-indice).
   - `_vista_stint(stints)`: estrae `Compound` + `TotalLaps` (età-gomma) dello stint
     CORRENTE (l'ultimo). Compound non slick/wet noto → `None` (mai inventato).
   - `vista_pilota`: aggiunge i campi `compound` e `tyre_age`.
2. **`live/replay.py`**
   - `CAMPI_TIMING`: aggiunge `compound`, `tyre_age`.
   - `eventi_da_messaggi`: `TimingAppData` percorre lo stesso diff di `TimingData` →
     emette `timing_update` coi campi gomma **solo quando cambiano** (None→None non entra
     nel delta: i timing_update esistenti restano invariati).
   - Lo snapshot del collettore fa `.update(diff)` → compound/tyre_age entrano anche lì.

## Perché è sicuro

- **Nessun campo emesso a vuoto**: compound/tyre_age compaiono nel delta solo quando
  passano a un valore reale (garantito dal test e dalla logica del diff). I timing_update
  esistenti (pos/gap/settori) sono byte-identici finché non arriva uno stint.
- **Ramo OpenF1 intatto**: `mappa_openf1.py` ha una sua `CAMPI_TIMING` e un suo stato,
  importa da `replay` solo `_fmt` → la modifica non lo tocca.
- **Un solo percorso replay/live**: la stessa `eventi_da_messaggi` alimenta replay e
  collettore live (il test e2e lo verifica), quindi il comportamento live = quello testato.

## Verifica

- `live/test_fase1.py`: **13/13** (2 casi nuovi: estrazione stint da lista+diff con
  compound ignoto→None e pilota senza stint; emissione timing_update solo su cambio).
- `live/collector/test_collector.py`: **4/4** (incl. e2e "eventi WS del collettore
  IDENTICI al replay diretto").
- **Prova sul feed reale**: alimentando `StatoSessione` coi `TimingAppData` della
  registrazione British (`data/live_raw/`), `vista_pilota` restituisce gli stint correnti
  coerenti con l'archivio (VER MEDIUM 8, HAM SOFT 7, LEC SOFT 7, RUS MEDIUM 24).
- Pre-esistente (NON causato da qui): `test_openf1.py` 10/11, il fail è nel ramo OpenF1
  (verificato identico stashando le modifiche).

## Cosa resta (dichiarato)

- **Deploy sul VPS** (`deploy.sh` + riavvio del collettore): decisione/azione del PO.
  Questa sessione tocca il codice + i test, non la macchina di produzione.
- **Shadow-run durante HUN**: col dato che ora fluisce, il protocollo pre-registrato
  (`PREREG_SESSIONE_FASEC.md`) calcola i tre scenari in diretta, li registra senza
  mostrarli, e a gara finita misura copertura + plausibilità + banda-zero. Pubblicazione
  live = decisione PO.

Kernel, gancio, modulo pit, demo: non toccati. Golden JS non pertinenti (modifica solo
al collettore Python del live).
