# live/collector/ — collettore live (Fase 2)

Daemon sul VPS Hetzner (`167.233.236.186`): si connette al feed SignalR,
registra il flusso grezzo, decodifica con il codice di Fase 1 e serve
eventi WebSocket. KPI e decisioni congelate in
[../FASE2_PREREG.md](../FASE2_PREREG.md).

- **WebSocket**: porta 8765 — alla connessione uno `snapshot`, poi il
  flusso eventi del replay (`position_frame`, `timing_update`,
  `track_status`, `session_status`) ritardato del buffer (default 4 s).
- **Stato**: `http://167.233.236.186:8766/status` (JSON).
- **Registrazioni**: `~/muretto/data/live_raw/` sul server, stesso formato
  del Mac (ispezionabili con `inspect_recording.py`, riproducibili con
  `replay.py`). Il server e' il registratore primario, il Mac il backup.

## Scelte architettoniche non ovvie

1. **Niente fastf1 a runtime.** `get_auth_token()` di fastf1, a token
   mancante o scaduto, apre un login interattivo nel browser e **blocca
   per sempre**: in un daemon headless significherebbe appendersi alla
   prima scadenza. Il client SignalR e' ricostruito su `signalrcore`
   rispecchiando fastf1 3.8.3 (stessi topic, stessa negoziazione
   AWSALBCORS, **stesso formato file riga per riga**); il token e' letto
   dallo stesso `f1auth.json` di fastf1 e la scadenza (exp del JWT) e'
   decodificata in locale senza rete. Token assente/scaduto → connessione
   NON autenticata (dati parziali meglio di zero) con **warning CRITICAL a
   ogni tentativo di connessione**: impossibile non vederlo nei log.
2. **Un solo percorso di codice per replay e live.** Il collettore usa
   `decoder.messaggi_da_righe` + `replay.eventi_da_messaggi` di Fase 1:
   la modalita' `--replay` e il live attraversano la stessa pipeline, e il
   test e2e verifica che gli eventi WS siano IDENTICI al replay diretto.
3. **Snapshot da replica, mai dallo stato interno.** Lo snapshot inviato a
   un nuovo client e' costruito da una replica alimentata DAGLI EVENTI GIA'
   SERVITI (buffer incluso): un client tardivo vede esattamente lo stato
   che avrebbe accumulato un client connesso da sempre, mai uno stato "piu'
   avanti" del flusso bufferizzato.
4. **Apertura pigra dei file.** Tra una sessione e l'altra il feed tace e
   le riconnessioni sono normali: il file di registrazione viene creato
   solo alla prima riga ricevuta (niente valanga di file vuoti). Rotazione
   per riconnessione + taglia (512 MiB) + eta' (6 h); le parti si
   ricompongono per primo timestamp (`replay.ordina_parti`), come per le
   parti `_partN` del Mac.
5. **Maturazione eventi col watermark del flusso.** Il riordino degli
   eventi (heap con margine 5 s, Fase 1) avanza col timestamp dei messaggi:
   durante le sessioni il feed e' continuo (Heartbeat), quindi il watermark
   scorre; a feed muto gli ultimi eventi restano nel buffer finche' non
   arriva altro — accettato e documentato (a sessione finita non arriva
   piu' nulla che serva in tempo reale).
6. **Porte aperte senza autenticazione**: il WS serve dati pubblici in
   sola lettura; `/status` non espone segreti (solo scadenza token, mai il
   token). Accettato per la Fase 2.

## Ingresso primario: OpenF1 MQTT (addendum FASE2_PREREG)

Per via del blocco CloudFront (sezione sotto) l'ingresso del VPS e'
**OpenF1 realtime**: MQTT su TLS `mqtt.openf1.org:8883`, OAuth2 su
`api.openf1.org/token` (token 3600 s, rinnovo automatico con margine
300 s; paho non cambia password a caldo → riconnessione proattiva col
token fresco prima della scadenza). Il client SignalR resta nel codice
(`--ingress signalr`) per la registrazione residenziale dal Mac e futuri
fallback. Stato OAuth2 in `/status` → campo `openf1_token`.

**Credenziali** (mai in git): file `~/.openf1.env` dell'utente `muretto`
sul server, permessi **600**:

```
OPENF1_USERNAME=...
OPENF1_PASSWORD=...
```

**Registrazione grezza**: JSONL rotanti in `data/live_raw/openf1/`, una
riga per messaggio MQTT `{"t": <ricezione UTC>, "topic": ..., "payload":
...}`; replay con `collector.py --replay FILE.jsonl` (adapter
`mappa_openf1.eventi_replay_openf1`, rilevato dall'estensione).

### Copertura campo per campo (OpenF1 vs SignalR) — mai inventato

| Evento / campo | SignalR | OpenF1 | Nota |
|---|---|---|---|
| `position_frame.cars[].x,y` | si' | si' (`v1/location`) | stesso sistema di coordinate atteso: KPI 5 lo MISURA, non lo assume |
| `position_frame.cars[].status` | si' (`OnTrack`/...) | **ASSENTE** | OpenF1 non lo fornisce |
| `position_frame.extra_cars` | si' (DriverList) | si' (`v1/drivers`) | stessa politica 242 |
| `timing_update.pos` | si' | si' (`v1/position`) | |
| `timing_update.gap` | si' (stringa feed) | derivato: numero → `"+X.XXX"`, 0/None → `""` | conversione di formato, stessa semantica |
| `timing_update.last_lap` | si' (stringa feed) | derivato: `lap_duration` → `"M:SS.mmm"` | conversione di formato |
| `timing_update.in_pit` | si' (live, ingresso/uscita) | **GEOMETRICO** (Fase 3: `inpit_geometrico.py`, attivo con `--pitlane CORRIDOIO`; K=3 campioni, D=5 m, isteresi; concordanza 30/30 col timing SignalR sulla gara di Spa) | senza corridoio il campo resta ASSENTE; `v1/pit` resta nel grezzo come arbitro a posteriori |
| `track_status` | si' (TrackStatus) | derivato da `v1/race_control` track-wide (categoria SafetyCar, flag con scope Track) | gialli di settore ignorati (TrackStatus SignalR era track-wide) |
| `driver_list` (sigla+colore team) | si' (DriverList: Tla, TeamColour) | si' (`v1/drivers`: name_acronym, team_colour) | evento additivo Fase 3, solo voci nuove/cambiate |
| `session_status` | si' (SessionStatus) | **MAI EMESSO** | `v1/sessions` non ha transizioni di stato; alimenta solo `/status` |
| snapshot alla connessione | si' | si' | identico (replica eventi serviti) |

Ordinamento: eventi in ordine d'arrivo, `t` = timestamp origine (`date`);
deduplica `_id` monotona per topic. La registrazione preserva l'ordine
d'arrivo: replay del grezzo ≡ flusso live (KPI 4).

**Smoke test sul VPS (2026-07-19 20:13 UTC, fuori sessione)**: token
OAuth2 rinnovato (scadenza +3600 s), connessione MQTT stabilita, 10 topic
sottoscritti, `/status` → `connesso: true`, `openf1_token.valido: true`.
Messaggi attesi solo a sessione attiva; la validazione completa e' al
prossimo weekend di GP (KPI in FASE2_PREREG, addendum).

## ⚠️ BLOCCO CloudFront sul feed dal VPS (2026-07-19, risolto con OpenF1)

Verificato empiricamente durante il primo deploy:
`livetiming.formula1.com` risponde **403 "Error from cloudfront"** a OGNI
richiesta dall'IP del VPS Hetzner (negotiate, JSON statici, qualunque
User-Agent, IPv6 senza rotta), mentre `api.formula1.com` e
`www.formula1.com` rispondono 200 dallo stesso IP. Dal Mac (IP
residenziale) il negotiate risponde regolarmente col cookie AWSALBCORS.
Conclusione: la distribuzione CloudFront del live timing **blocca gli IP
datacenter**; non e' aggirabile con header, e' un blocco a livello IP/ASN.

Stato: tutto il resto dello stack e' operativo sul VPS (daemon systemd
attivo, backoff a vuoto come da progetto, `/status` raggiungibile,
modalita' `--replay` testata 3/3 sul server). Opzioni sul tavolo, da
decidere con Tommi:

1. **Relay dal Mac**: il Mac (che il feed lo riceve) inoltra le righe
   grezze al VPS; il VPS resta distributore/registratore. Contro: il Mac
   deve essere acceso durante le sessioni (il KPI 1 "senza intervento"
   cambia natura).
2. **Tunnel via rete di casa** (WireGuard/SSH verso un dispositivo sempre
   acceso a casa): il VPS esce con IP residenziale solo per livetiming.
3. **Altro provider/IP** (ASN non bloccato): da verificare empiricamente,
   nessuna garanzia.
4. **Proxy residenziale commerciale**: costo e fragilita'.

## Setup server (fatto una volta, documentato per ripetibilita')

Da root sul VPS (Ubuntu):

```bash
adduser --disabled-password --gecos '' muretto
install -d -m 700 -o muretto -g muretto /home/muretto/.ssh
cp /root/.ssh/authorized_keys /home/muretto/.ssh/ && chown muretto:muretto /home/muretto/.ssh/authorized_keys
apt-get update && apt-get install -y python3-venv git ufw
ufw allow OpenSSH && ufw allow 8765/tcp && ufw allow 8766/tcp && ufw --force enable
```

Da utente `muretto`:

```bash
git clone https://github.com/tommyieri/muretto-box-virtuale.git ~/muretto
cd ~/muretto && python3 -m venv .venv-live
.venv-live/bin/pip install -r live/collector/requirements.txt
```

Unit systemd (da root):

```bash
cp /home/muretto/muretto/live/collector/muretto-live.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now muretto-live
journalctl -u muretto-live -f     # log (UTC)
```

Il permesso di restart per l'utente (usato da `deploy.sh`) e' in
`/etc/sudoers.d/muretto-live`:

```
muretto ALL=NOPASSWD: /usr/bin/systemctl restart muretto-live
```

## Deploy (aggiornamenti)

```bash
ssh muretto@167.233.236.186 'sh muretto/live/collector/deploy.sh'
```

Fa `git pull --ff-only` + pip + restart + stampa `/status`. Niente
automazioni: il deploy e' sempre un gesto esplicito.

## Token F1TV — procedura per Tommi

Il feed autenticato richiede un abbonamento F1TV; il token dura ~1
settimana. Rinnovo (dal Mac):

1. **Login sul Mac** (apre il browser):

   ```bash
   cd ~/muretto && .venv/bin/python -m fastf1 auth f1tv login
   ```

2. **Copia del token sul server** (il percorso platformdirs sul Mac e'
   `~/Library/Application Support/fastf1/f1auth.json`, sul server
   `~/.local/share/fastf1/f1auth.json`):

   ```bash
   ssh muretto@167.233.236.186 'mkdir -p ~/.local/share/fastf1'
   scp "$HOME/Library/Application Support/fastf1/f1auth.json" \
       muretto@167.233.236.186:.local/share/fastf1/f1auth.json
   ```

3. **Riavvio e verifica**:

   ```bash
   ssh muretto@167.233.236.186 'sudo systemctl restart muretto-live'
   curl -s http://167.233.236.186:8766/status | python3 -m json.tool
   ```

   Controllare `token.valido: true` e `token.scadenza_utc`. A token
   scaduto/mancante il daemon **continua in modalita' non autenticata**
   (dati parziali) e logga un warning CRITICAL a ogni connessione:
   `journalctl -u muretto-live | grep TOKEN`.

## Modalita' replay (sviluppo/test, identica al live per i client)

```bash
.venv/bin/python live/collector/collector.py \
    --replay data/live_raw/2026-07-17_16-53-20.txt --speed 10 --buffer 4
# client di test:
.venv/bin/python live/collector/client_test.py ws://127.0.0.1:8765 --out eventi.jsonl
```

`--speed max --buffer 0 --exit-al-termine --attendi-primo-client` e' la
combinazione usata dai test (`test_collector.py`, 3/3 sul Mac).

## Validazione al prossimo weekend di GP (KPI in FASE2_PREREG)

Doppia registrazione (server primario + Mac backup con
`record_session.py`), client di test collegato durante almeno una
sessione (`client_test.py` salva `ricevuto_utc` per la latenza KPI 4),
poi confronto server/Mac (`inspect_recording.py`) e coerenza eventi
(`replay.py` sul file server vs eventi salvati dal client). Verdetti in
`live/REPORT_FASE2.md`.

## Fase 3 — in_pit geometrico, TLS, mappa live

- `--pitlane data/live_derived/pitlane_<circ>.json` attiva il
  classificatore geometrico sull'ingresso OpenF1 (live e replay .jsonl);
  sul server si imposta per weekend via `~/.muretto-live.env`
  (`PITLANE_ARGS=...`, vedi unit systemd e RUNBOOK_WEEKEND.md).
- TLS: Caddy (`Caddyfile` in questa cartella) su `ws.murettobox.com`
  (`/ws` -> WebSocket, `/status` -> stato; allowlist Origin; 8765/8766
  chiuse all'esterno). Serve il record DNS A verso il VPS.
- La mappa live del sito (demo/live.html + live_mappa.mjs) consuma questa
  interfaccia; il fit coordinate raw->viewBox e' in
  `demo/data/live_geo_<gara>.json` (generato da live/gen_live_geo.py).
- Runbook operativo del weekend: `live/RUNBOOK_WEEKEND.md`.
