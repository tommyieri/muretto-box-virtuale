# REPORT — Diagnosi ingresso MQTT OpenF1 (branch fix-mqtt-ingress)

**Verdetto: NON e' una collisione di client-id ne' un problema del nostro
client — e' un rifiuto lato server (OpenF1) con OAuth perfettamente
funzionante. Evidenza raccolta, bozza ticket pronta
([live/collector/TICKET_OPENF1.md](live/collector/TICKET_OPENF1.md)),
da inviare OGGI. Nel branch: backoff dedicato ai rifiuti del broker +
verdetto di sanita' esplicito in /status (punto 4, versione minima del
punto 14). Produzione NON toccata: il deploy richiede merge + un
riavvio (deploy.sh), decisione PO.**

## 1. Da quando, esattamente — e NO, non coincide col deploy Fase 3

Timeline ricostruita dai journal del VPS (tutta l'evidenza in UTC):

| quando | cosa |
|---|---|
| 19/07 19:48–20:13 | deploy Fase 3 + restart; alle 20:13:16 connesso, 10 topic |
| 19/07 21:53:22 | ultimo restart del processo (pid 5197); connesso subito |
| 21:53 → 02:53 | **6 cicli di riconnessione proattiva tutti riusciti** (ogni ~50 min, rinnovo token alternato: comportamento da progetto) |
| **20/07 03:43:38** | la riconnessione proattiva successiva viene **RIFIUTATA**: da qui in poi ogni CONNECT fallisce (CONNACK `Client identifier not valid`, 0x85) |
| 09:30:49 → 09:36:22 | UNA connessione riesce spontaneamente, sottoscrive i 10 topic, e cade **esattamente alla scadenza del token** — poi di nuovo rifiuti |
| 09:49–09:57 | probe dal VPS (stesso account, token appena emesso): **Not authorized** (0x87), 9/9 tentativi |

Il deploy Fase 3 e' di sabato sera; il client ha funzionato per altre
7,5 ore senza alcun cambio (stesso processo dal 21:53). **Il punto di
rottura (03:43:38) non coincide con nessuna azione nostra.**

## 2. Due processi con lo stesso client-id? NO — escluso

- Sul VPS: **un solo processo** (`muretto-live`, systemd); niente tmux/
  screen; nessun socket aperto verso `mqtt.openf1.org:8883` oltre ai
  tentativi del servizio; nessun residuo del `--replay` (il replay non
  usa MQTT per costruzione).
- Sul Mac: nessun processo openf1/mqtt, nessun `~/.openf1.env` (le
  credenziali vivono solo sul VPS).
- Controprova: il probe con client-id **esplicito e univoco** viene
  rifiutato uguale al vuoto → il client-id non e' la causa.

## 3. Evidenza per il ticket (raccolta, non invasiva)

- OAuth sempre OK: `POST /token` → 200, ID-token Firebase valido
  (RS256, progetto `openf1-fb-0`, scadenza 3600 s). **Il token non
  contiene claim di entitlement**: l'autorizzazione realtime e' decisa
  dal broker lato server a CONNECT.
- Rifiuti incoerenti: il servizio vede 0x85, i probe freschi 0x87, e
  una connessione e' riuscita alle 09:30 — **stato lato server
  instabile**, non un errore deterministico del client.
- Probe 9/9 rifiutati con: id vuoto E esplicito × MQTTv5 E v3.1.1 ×
  3 ripetizioni. DNS: un solo A record (34.34.151.228). IP sorgente
  VPS: 167.233.236.186.
- **Sospetto concreto da verificare PRIMA di inviare il ticket** (2
  minuti sul pannello OpenF1): l'add-on realtime/MQTT e' a pagamento —
  un abbonamento scaduto nella notte produrrebbe esattamente questo
  quadro (OAuth vivo, MQTT non autorizzato). Se l'account risulta
  attivo, inviare la bozza: `live/collector/TICKET_OPENF1.md`.

## 4. Modifiche nel branch (pronte, non deployate)

1. **Sanita' in /status** (`sanita_ingresso`, collector.py): verdetto
   esplicito mai ambiguo — `OK: connesso, ultimo messaggio ricevuto X
   secondi fa` / `OK … nessun messaggio (normale fuori sessione)` /
   `non connesso (riconnessione in corso)` / **`INGRESSO MORTO: N
   connessioni consecutive fallite (ultimo errore: …)`** — con
   `ultima_connessione_ok_utc`, `fallimenti_consecutivi`,
   `ultimo_errore`. Vale per entrambi gli ingressi (OpenF1 e SignalR).
   Un ingresso morto da 6 ore non potra' piu' sembrare un normale
   "connesso: false".
2. **Rifiuto del broker = classe d'errore propria** (`RifiutoBroker`):
   la CONNACK di errore interrompe subito il tentativo (prima si
   aspettava il timeout di 30 s mentre paho ri-tentava da solo: ~6
   CONNECT extra a tentativo — una raffica inutile che puo' solo
   peggiorare un eventuale rate-limit lato server) e il log diventa
   CRITICAL con rimando al ticket.
3. **Backoff dedicato ai rifiuti**: 300 s (invece del backoff di rete
   1→60 s). Da stanotte il servizio ha fatto ~4-6 CONNECT/min per ore;
   con la modifica: 1 ogni 5 minuti, che tiene comunque il recupero
   automatico quando OpenF1 sistema.

Test: `test_collector.py` 4/4 (incluso il nuovo caso sanita'),
`test_openf1.py` 11/11.

## Deploy e prossimi passi (PO)

- Il fix nostro richiede: **merge di fix-mqtt-ingress + deploy.sh (un
  solo riavvio)**. Non riavvia il feed da solo — rende visibile lo
  stato e ferma la raffica; **la riattivazione dipende da OpenF1** (o
  dal rinnovo abbonamento, se e' quello).
- Oggi: controllo abbonamento → invio ticket (bozza pronta).
- Nota di trasparenza: i probe diagnostici hanno emesso 3 token OAuth
  extra e ~12 CONNECT dal VPS tra le 09:48 e le 09:57 UTC; nessun
  impatto sul servizio (gia' in loop di rifiuto). File probe rimasti in
  `/tmp` sul VPS (`probe_mqtt*.py`, `probe_claims.py`), innocui.

---

# CHIUSURA — risposta OpenF1 del 21/07/2026: causa accertata

**Incidente CHIUSO.** Risposta di Bruno (OpenF1) al ticket: modifiche
recenti al broker MQTT/WebSocket con **un problema di configurazione
lato loro**, ora risolto. Confermato dai fatti: il collettore si e'
riconnesso da solo alle **09:08:36 UTC del 21/07**, 10 topic
sottoscritti, senza alcun nostro intervento.

## Causa: due fattori, uno loro e uno nostro

1. **Innesco (OpenF1)**: la configurazione errata del broker ha iniziato
   a rifiutare le connessioni alle 03:43:38 del 20/07 — spiega il
   `Not authorized` (0x87) sui tentativi puliti.
2. **Amplificazione (nostra)**: OpenF1 documenta un limite finora
   ignoto — **piu' di 10 disconnessioni in un minuto = account bloccato
   per 10 minuti**. `loop_start()` di paho esegue `loop_forever` in un
   thread che **ritenta da solo** a ogni caduta: misurato sul VPS il
   21/07 con un broker fittizio locale, **15 CONNECT/minuto da una sola
   caduta**. Il nostro loop di riconnessione, da solo, superava la
   soglia e si auto-infliggeva blocchi di 10 minuti: e' l'origine dei
   CONNACK `Client identifier not valid` (0x85) della notte, che
   infatti convivevano con gli 0x87 dei probe isolati e con la
   connessione riuscita alle 09:30 — l'incoerenza che avevamo
   registrato senza saperla spiegare.

## Limiti ufficiali OpenF1 (ora documentati nel codice)

| limite | valore | dove e' onorato |
|---|---|---|
| connessioni MQTT/WS concorrenti | 10 per abbonamento | una sola connessione per processo, un solo processo (verificato); il poller stint (PR #69) e' REST, non consuma slot |
| disconnessioni prima del blocco | >10 in 1 minuto → 10 min di blocco | tetto nostro **5 CONNECT/minuto** (margine 2x) |

## Misure applicate (branch `mqtt-limiti-openf1`)

1. **`reconnect_on_failure=False`** sul client paho: i retry interni
   sono spenti, l'unica sorgente di CONNECT e' il nostro backoff.
   Misurato: da 15 CONNECT/minuto a **1 per tentativo**.
2. **`GuardiaConnessioni`**: tetto duro a finestra scorrevole, **5
   CONNECT ogni 60 s**, attraversato da OGNI percorso (primo avvio,
   riconnessione proattiva per il token, retry su errore). Oltre il
   tetto attende: il recupero automatico resta garantito.
3. **`BACKOFF_MIN_S` 1 s → 5 s**: la sola scala di backoff resta sotto
   il tetto anche senza guardia (difesa in profondita').
4. **`RestartSec` 5 s → 30 s** nell'unit systemd: la guardia vive nel
   processo, quindi un crash-loop la aggirerebbe (a 5 s farebbe 12
   CONNECT/minuto; a 30 s ne fa 2).
5. Vincolo **documentato nel codice** con riferimento esplicito alla
   mail OpenF1 del 21/07 e alla misura, in testa a `ingress_openf1.py`.
6. **Runbook**: se l'ingresso risulta bloccato, NON insistere —
   attendere 10 minuti e' la cura, martellare e' la causa.

Test: `test_openf1.py` — due nuovi casi (`guardia = max 5
CONNECT/minuto`, `il backoff da solo resta sotto 5 CONNECT/minuto`)
verdi; `test_collector.py` 4/4.
