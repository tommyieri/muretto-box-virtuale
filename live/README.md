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
