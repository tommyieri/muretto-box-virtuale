# REPORT — Poller REST degli stint OpenF1 (compound + età-gomma per il live)

*Sessione 2026-07-21, branch claude/stint-poller. Segue la verifica "OpenF1 espone gli
stint in realtime?" e il vincolo CloudFront inciso in `live/RUNBOOK_WEEKEND.md`.*

## Perché REST e non MQTT/SignalR (vincoli misurati, non ipotesi)

| via | stint gomma | raggiungibile dal VPS |
|---|---|---|
| SignalR `TimingAppData` | **sì** | **no** — CloudFront blocca gli IP datacenter (403 su ogni richiesta, IP/ASN) |
| OpenF1 MQTT | `v1/stints` **non documentato** | broker rifiuta (`Not authorized`, dal 20/07) |
| **OpenF1 REST `/v1/stints`** | **sì** | **sì — 200 dal VPS in ~25 ms** |

Host diverso da `livetiming.formula1.com` → nessun blocco CloudFront; protocollo diverso
dall'MQTT → il rifiuto del broker è irrilevante. E gli stint sono dati a **bassa
frequenza** (cambiano solo ai pit stop): **un polling ogni 30-60 s basta**, non serve
uno stream.

## La formula dell'età-gomma è CALIBRATA, non assunta

Il punto delicato era un off-by-one. Calibrato empiricamente contro l'archivio
(`demo/data/Gran Bretagna.json` vs OpenF1 `session_key=11326`, stessa gara):

| formula | match su 1059 confronti |
|---|---|
| `tyre_age_at_start + (giro − lap_start)` | **0 (0.0%)** |
| **`tyre_age_at_start + (giro − lap_start) + 1`** | **1038 (98.0%)** |

Il `+1` conta il giro in corso. Verdetto netto, e la formula è bloccata da un test di
regressione. (Il 2% residuo: casi di bordo su confini di stint tra le due fonti.)

## Cosa fa il modulo

`live/collector/stint_poller.py`:
- `scarica()` — GET dell'endpoint, **mai eccezioni**: su errore/timeout ritorna `None`
  e logga (un poller che muore è peggio di uno che salta un giro);
- `stint_corrente()` — lo stint che **contiene** il giro se noto, altrimenti quello con
  `stint_number` massimo;
- `stato_da_stints()` — `{numero: {compound, tyre_age}}`; compound fuori dal vocabolario
  noto → `None` (**mai inventato**); pilota senza dati → assente;
- `StintPoller.aggiorna()` — **emette solo i campi cambiati**, esattamente la
  convenzione dei `timing_update` del collettore;
- `evento_timing_update()` — confeziona l'evento nella forma del collettore, così i
  campi `compound`/`tyre_age` viaggiano sul canale **già esistente** (li ho aggiunti a
  `CAMPI_TIMING` e `vista_pilota` in PR #66) e arrivano al client senza altri innesti;
- **CLI** per la verifica manuale a sessione aperta.

Il giro corrente: se il chiamante lo passa (dal feed live) è la fonte autorevole;
altrimenti si usa `lap_end` dello stint — che durante una sessione viva dovrebbe seguire
il giro in corso, **semantica da confermare alla prima sessione**.

## Verifica

- `live/collector/test_stint_poller.py` **5/5** (senza rete, fetch iniettato): formula
  calibrata, scelta dello stint corrente, onestà su compound ignoto, diff solo-cambiati,
  errore di rete → nessun evento.
- **CLI su dati reali** (Spa, `session_key=11334`): 51 righe stint → compound + età per
  pilota, coerenti.

## Cosa resta (dichiarato, NON fatto qui)

1. **Innesto nel daemon**: un thread che chiama `aggiorna()` ogni ~45 s e mette
   `evento_timing_update(...)` nella coda eventi del collettore. Non l'ho fatto perché
   è subordinato al punto 2: attivarlo prima significherebbe pollare a vuoto.
2. **Verifica a FP1 (Ungheria, session_key 11342, 26/07)** — la doc distingue
   *"Historical data (2023+) is free… Real-time data requires a paid subscription"*:
   va confermato che la sessione **in corso** sia leggibile con le nostre credenziali.
   ```bash
   # a sessione aperta, dal VPS:
   python3 live/collector/stint_poller.py --session-key latest
   # se vuoto/fermo, riprovare con --token <bearer OpenF1>
   ```
3. Solo dopo: shadow-run di Fase C in live.

Nessun file di produzione toccato: il modulo è nuovo e non ancora chiamato da nessuno.
