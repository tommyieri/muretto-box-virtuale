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

## ⚠️ BLOCCO CloudFront sul feed dal VPS (2026-07-19, da risolvere)

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
