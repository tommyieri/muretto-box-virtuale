# live/ — registrazione del feed live timing F1

Modulo separato dal resto del progetto: **nessun import dal kernel** (`engine/`)
ne' dagli altri script. Usa il `SignalRClient` di FastF1 per salvare il flusso
live grezzo su file, riga per riga, senza alcun processing.

## Ambiente

Si usa il Python della `.venv` del repo. fastf1 e' installato nella venv
**senza dipendenze** per non retrocedere pandas 3.0.3 del kernel (fastf1
dichiara `pandas<3`, ma per il solo livetiming pandas 3 funziona).
Procedura completa in [requirements.txt](requirements.txt).

`inspect_recording.py` e il test usano solo la libreria standard.

## Registrare una sessione

Lanciare **prima** dell'inizio della sessione (il feed parte qualche minuto
prima; a sessione non ancora live il client resta in ascolto finche' non
arrivano messaggi, poi scrive tutto):

```bash
cd ~/muretto
.venv/bin/python live/record_session.py
```

Opzioni:

- `--out PATH` — file di output (default: `data/live_raw/{data}_{ora}.txt`,
  es. `data/live_raw/2026-07-19_14-45-00.txt`);
- `--timeout N` — secondi senza messaggi prima dell'uscita pulita
  (default: 60). A fine sessione il feed si spegne e lo script termina da solo.

Interruzione manuale: `Ctrl-C` (uscita pulita, il file resta valido).

### Limite noto: disconnessione a ~2h

Il server chiude la connessione dopo circa due ore. Lo script lo rileva
(i dati scorrevano e si sono fermati) e **riavvia da solo** la registrazione
su un nuovo file con suffisso incrementale:

```
2026-07-19_14-45-00.txt          <- parte 1
2026-07-19_14-45-00_part2.txt    <- dopo la prima disconnessione
2026-07-19_14-45-00_part3.txt    <- eventuale successiva
```

L'istante del gap viene loggato a video (`gap alle <UTC> — riavvio su parte N`).
Nel buco tra chiusura e riconnessione i messaggi vanno persi: e' il limite
del protocollo, non un errore dello script.

## Ispezionare una registrazione

```bash
.venv/bin/python live/inspect_recording.py data/live_raw/2026-07-19_14-45-00.txt
```

Stampa:

- numero di messaggi per topic;
- presenza e frequenza media di `Position.z` e `CarData.z`;
- primo e ultimo timestamp e durata coperta;
- gap > 10 s tra messaggi consecutivi (per capire se la registrazione ha buchi);
- un messaggio d'esempio decodificato per ogni topic `.z`
  (base64 + zlib deflate raw, `wbits=-zlib.MAX_WBITS`).

Con registrazioni in piu' parti, ispezionare ogni file separatamente.

## Test

```bash
.venv/bin/python live/test_inspect.py
```

Costruisce una fixture sintetica di 4 righe (inclusa una `Position.z`
compressa da JSON noto) e verifica conteggi, decodifica, timestamp e gap.

---

# Fase 1 — decoder, replay, verifica allineamento

KPI pre-registrati in [FASE1_PREREG.md](FASE1_PREREG.md), verdetti in
[REPORT_FASE1.md](REPORT_FASE1.md). Tutto stdlib-only tranne
`estrai_riferimenti.py` (una tantum, `python3` utente con FastF1).

## Decoder (`decoder.py`)

Dal file grezzo ai messaggi tipizzati: `.z` decodificati (base64+deflate raw),
`(0,0,0)` mai emesso come posizione valida, canali CarData mappati e
controllati (fuori range → warning), `TimingData` fusi in uno stato
per-pilota persistente (merge ricorsivo dei delta), righe illeggibili
contate mai fatali.

## Replay (`replay.py`)

```bash
.venv/bin/python live/replay.py data/live_raw/FILE.txt [FILE_part2.txt ...] \
    --speed max --out eventi.jsonl     # oppure --stdout, --speed 1, 10, ...
```

Riemette lo stato come eventi JSON in ordine di tempo (`position_frame`,
`timing_update` con soli campi cambiati, `track_status`, `session_status`).
Parti multiple ordinate e deduplicate sull'overlap. L'API Python
(`eventi_replay(paths)`) e' il generatore che in Fase 2 alimentera' il
WebSocket: il consumatore non distingue replay da live.

## Verifica allineamento (`verify_alignment.py`)

```bash
python3 live/estrai_riferimenti.py          # una tantum (FastF1, python3)
.venv/bin/python live/verify_alignment.py   # KPI 4-5, SVG e JSON derivati
.venv/bin/python live/kpi_fase1.py          # KPI 1-3
```

Output in `data/live_derived/`: `spa_2026_fp2_xy.svg` (nuvola FP2 vs
riferimento 2025 vs punti pit), `transform_spa.json`, `pitlane_spa.json`,
`verifica_allineamento.json`, `kpi_fase1.json`.

## Test Fase 1

```bash
.venv/bin/python live/test_fase1.py
```

Fixture sintetiche (merge delta, filtro zero, `.z` bit-identica, multi-file
con overlap) + end-to-end su FP2 completa e FP1 troncata (skip espliciti se
le registrazioni non sono su disco).
