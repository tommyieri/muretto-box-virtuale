#!/usr/bin/env python
"""Ingresso OpenF1 realtime (MQTT) per il collettore — Fase 2 addendum.

Decisione a verbale (FASE2_PREREG, addendum): CloudFront blocca gli IP
datacenter sul feed SignalR, l'ingresso primario del VPS diventa OpenF1:
  - OAuth2: POST https://api.openf1.org/token (username/password da file
    env, MAI in git), token valido 3600 s, rinnovo automatico;
  - MQTT su TLS mqtt.openf1.org:8883 (paho-mqtt), token come password;
  - riconnessione con lo stesso backoff 1->60 s del client SignalR,
    daemon che non esce mai; riconnessione proattiva prima della scadenza
    del token (paho non permette di cambiare password a caldo);
  - registrazione grezza: ogni messaggio MQTT su file JSONL rotanti
    (una riga: {"t": <ricezione UTC>, "topic": ..., "payload": ...});
    il grezzo si conserva, i replay si costruiscono da li'.

Semantica messaggi (openf1.org): `_id` ordina i messaggi per topic,
`_key` identifica l'oggetto logico aggiornato. La deduplica/ordinamento
per `_id` avviene nella mappatura (mappa_openf1), non qui: il grezzo
registra TUTTO cio' che arriva, nell'ordine d'arrivo.

Import di paho-mqtt/requests solo a connessione (il Mac testa la parte
file/replay senza nuove dipendenze).
"""

import json
import logging
import ssl
import threading
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger("ingress_openf1")

URL_TOKEN = "https://api.openf1.org/token"
HOST_MQTT = "mqtt.openf1.org"
PORTA_MQTT = 8883

TOPICS_OPENF1 = ["v1/location", "v1/intervals", "v1/laps", "v1/position",
                 "v1/race_control", "v1/pit", "v1/sessions", "v1/drivers",
                 "v1/car_data", "v1/weather"]

# ---------------------------------------------------------------------
# LIMITI UFFICIALI OPENF1 (mail di Bruno, OpenF1, 21/07/2026 — incidente
# del 20/07, vedi REPORT_MQTT_INGRESS.md):
#   1. massimo 10 connessioni MQTT/WebSocket CONCORRENTI per abbonamento;
#   2. piu' di 10 DISCONNESSIONI in un minuto -> account bloccato per 10
#      minuti (e' l'origine dei CONNACK 0x85 'Client identifier not
#      valid' visti durante i tentativi ripetuti).
# Conseguenza vincolante per questo modulo: ogni tentativo fallito vale
# una disconnessione, quindi il tetto di sicurezza e' <=5 CONNECT al
# minuto (margine 2x sulla soglia). Misurato il 21/07 sul VPS: con i
# retry interni di paho ATTIVI (default) una singola caduta produceva
# 15 CONNECT/minuto — da soli oltre la soglia, cioe' 10 minuti di buio
# auto-inflitti. Non alzare questi valori senza rifare la misura.
# ---------------------------------------------------------------------
BACKOFF_MIN_S = 5.0
BACKOFF_MAX_S = 60.0
# CONNACK di rifiuto dal broker (auth/ACL): NON e' un problema di rete,
# ritentare a raffica non aiuta e puo' peggiorare lo stato lato server
# (rate-limit). Cadenza dedicata, piu' lenta (incidente 20/07: ore di
# rifiuti 'Client identifier not valid'/'Not authorized' con OAuth sano).
BACKOFF_RIFIUTO_S = 300.0
MAX_CONNECT_FINESTRA = 5       # tetto duro: 5 CONNECT ogni...
FINESTRA_CONNECT_S = 60.0      # ...60 secondi (meta' della soglia OpenF1)
CONNESSIONE_SANA_S = 120.0
# rinnovo proattivo: riconnessione con token fresco prima della scadenza
MARGINE_RINNOVO_S = 300.0
ROTAZIONE_MAX_BYTE = 512 * 1024 * 1024
ROTAZIONE_MAX_S = 6 * 3600

PERCORSO_ENV_DEFAULT = "~/.openf1.env"


class RifiutoBroker(ConnectionError):
    """CONNACK di errore dal broker MQTT (credenziali OAuth valide):
    autorizzazione negata lato server, non un guasto di rete."""


class GuardiaConnessioni:
    """Tetto DURO ai CONNECT verso il broker, valido per OGNI percorso
    (riconnessione proattiva per il token, retry su errore, primo avvio).

    Finestra scorrevole: al massimo `massimo` CONNECT ogni `finestra_s`
    secondi; oltre il tetto si ATTENDE, non si rinuncia — il recupero
    automatico resta garantito, solo piu' lento della soglia OpenF1
    (limiti in testa al modulo, mail OpenF1 del 21/07/2026).

    `orologio` e `dormi` sono iniettabili per i test (nessuna attesa
    reale nei test)."""

    def __init__(self, massimo=MAX_CONNECT_FINESTRA,
                 finestra_s=FINESTRA_CONNECT_S,
                 orologio=time.monotonic, dormi=time.sleep):
        self.massimo = massimo
        self.finestra_s = finestra_s
        self._orologio = orologio
        self._dormi = dormi
        self._istanti = deque()
        self._lock = threading.Lock()

    def attendi_slot(self):
        """Blocca finche' un CONNECT e' consentito; registra il consumo.
        Ritorna i secondi attesi (0.0 se nessuna attesa)."""
        atteso = 0.0
        while True:
            with self._lock:
                adesso = self._orologio()
                while self._istanti and \
                        adesso - self._istanti[0] >= self.finestra_s:
                    self._istanti.popleft()
                if len(self._istanti) < self.massimo:
                    self._istanti.append(adesso)
                    return atteso
                attesa = self.finestra_s - (adesso - self._istanti[0])
            log.warning("tetto CONNECT raggiunto (%d in %.0fs, limiti "
                        "OpenF1): attendo %.1fs prima di riprovare",
                        self.massimo, self.finestra_s, attesa)
            self._dormi(max(attesa, 0.05))
            atteso += max(attesa, 0.05)


# ------------------------------------------------------------ credenziali

def leggi_env(percorso=PERCORSO_ENV_DEFAULT):
    """Credenziali da file KEY=VALUE (permessi 600, mai in git).

    Chiavi: OPENF1_USERNAME, OPENF1_PASSWORD."""
    p = Path(percorso).expanduser()
    valori = {}
    try:
        for riga in p.read_text().splitlines():
            riga = riga.strip()
            if not riga or riga.startswith("#") or "=" not in riga:
                continue
            chiave, _, valore = riga.partition("=")
            valori[chiave.strip()] = valore.strip()
    except OSError:
        return None, None
    return valori.get("OPENF1_USERNAME"), valori.get("OPENF1_PASSWORD")


class TokenOpenF1:
    """Token OAuth2 con rinnovo automatico (thread-safe)."""

    def __init__(self, percorso_env=PERCORSO_ENV_DEFAULT):
        self.percorso_env = percorso_env
        self._token = None
        self._scade = 0.0          # time.time()
        self._lock = threading.Lock()
        self.ultimo_rinnovo_utc = None
        self.errore = None

    def token(self):
        """Token valido, rinnovato se mancano <MARGINE_RINNOVO_S secondi."""
        with self._lock:
            if self._token and time.time() < self._scade - MARGINE_RINNOVO_S:
                return self._token
            return self._rinnova()

    def _rinnova(self):
        import requests
        utente, password = leggi_env(self.percorso_env)
        if not utente or not password:
            self.errore = ("credenziali OpenF1 mancanti in %s"
                           % self.percorso_env)
            log.critical("CREDENZIALI OPENF1 MANCANTI (%s) — impossibile "
                         "autenticarsi. Vedi README, sezione OpenF1.",
                         self.percorso_env)
            return None
        r = requests.post(URL_TOKEN, data={
            "username": utente, "password": password,
            "grant_type": "password"}, timeout=30)
        if r.status_code != 200:
            self.errore = f"token HTTP {r.status_code}"
            log.error("rinnovo token OpenF1 fallito: HTTP %d %.200s",
                      r.status_code, r.text)
            return None
        dati = r.json()
        self._token = dati["access_token"]
        self._scade = time.time() + float(dati.get("expires_in", 3600))
        self.ultimo_rinnovo_utc = datetime.now(timezone.utc).isoformat(
            timespec="seconds")
        self.errore = None
        log.info("token OpenF1 rinnovato (scade tra %.0fs)",
                 self._scade - time.time())
        return self._token

    def stato(self):
        return {
            "presente": self._token is not None,
            "scadenza_utc": datetime.fromtimestamp(
                self._scade, tz=timezone.utc).isoformat(timespec="seconds")
            if self._token else None,
            "valido": self._token is not None and time.time() < self._scade,
            "ultimo_rinnovo_utc": self.ultimo_rinnovo_utc,
            "errore": self.errore,
        }


# ------------------------------------------------------- registratore raw

class RegistratoreJSONL:
    """File JSONL rotanti per il grezzo OpenF1 (apertura pigra, stessa
    politica del registratore SignalR: per connessione + taglia + eta')."""

    def __init__(self, cartella):
        self.cartella = Path(cartella)
        self.cartella.mkdir(parents=True, exist_ok=True)
        self._file = None
        self._byte = 0
        self._aperto_da = 0.0
        self.percorso = None

    def scrivi(self, topic, payload_grezzo, ricevuto_utc):
        riga = json.dumps({"t": ricevuto_utc, "topic": topic,
                           "payload": payload_grezzo}, ensure_ascii=False)
        if (self._file is not None
                and (self._byte > ROTAZIONE_MAX_BYTE
                     or time.monotonic() - self._aperto_da > ROTAZIONE_MAX_S)):
            log.info("rotazione file OpenF1 (%s)", self.percorso)
            self.chiudi()
        if self._file is None:
            nome = datetime.now(timezone.utc).strftime(
                "%Y-%m-%d_%H-%M-%S") + ".jsonl"
            self.percorso = self.cartella / nome
            self._file = open(self.percorso, "a", encoding="utf-8")
            self._byte = self.percorso.stat().st_size
            self._aperto_da = time.monotonic()
            log.info("nuovo file OpenF1: %s", self.percorso)
        self._file.write(riga + "\n")
        self._file.flush()
        self._byte += len(riga) + 1

    def chiudi(self):
        if self._file is not None:
            self._file.close()
            self._file = None
            self.percorso = None


def leggi_jsonl(path):
    """Genera (topic, payload, ts_ricezione) da un file JSONL registrato.
    Righe illeggibili: saltate con warning, mai eccezioni (stessa regola
    del decoder SignalR)."""
    from inspect_recording import parse_timestamp
    with open(path, encoding="utf-8") as f:
        for n, riga in enumerate(f, 1):
            riga = riga.strip()
            if not riga:
                continue
            try:
                obj = json.loads(riga)
                ts = parse_timestamp(obj.get("t", "").replace("+00:00", "Z"))
                yield obj["topic"], obj["payload"], ts
            except (ValueError, KeyError) as e:
                log.warning("riga %d illeggibile in %s: %r", n, path, e)


# ------------------------------------------------------------- MQTT live

class IngressoOpenF1:
    """Connessione MQTT + loop di riconnessione. Vive per sempre.

    Ogni messaggio: registrato sul JSONL e accodato come
    (topic, payload decodificato, ts ricezione) per la mappatura."""

    def __init__(self, coda_messaggi, registratore, stato_condiviso,
                 percorso_env=PERCORSO_ENV_DEFAULT, guardia=None):
        self.coda = coda_messaggi
        self.reg = registratore
        self.cond = stato_condiviso
        self.token = TokenOpenF1(percorso_env)
        # UNICA porta verso il broker: ogni CONNECT passa di qui
        self.guardia = guardia or GuardiaConnessioni()
        self._t_ultimo = time.monotonic()
        self._chiusa = threading.Event()

    def _su_messaggio(self, _client, _userdata, msg):
        adesso = datetime.now(timezone.utc)
        ricevuto = adesso.isoformat(timespec="milliseconds")
        self._t_ultimo = time.monotonic()
        self.cond["ultimo_messaggio_utc"] = adesso.isoformat(
            timespec="seconds")
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            log.warning("payload non JSON su %s (%d byte): registrato "
                        "come stringa", msg.topic, len(msg.payload))
            payload = msg.payload.decode("utf-8", "replace")
        self.reg.scrivi(msg.topic, payload, ricevuto)
        self.coda.put((msg.topic, payload,
                       adesso.replace(tzinfo=None)))

    def _connetti(self):
        import paho.mqtt.client as mqtt

        token = self.token.token()
        if token is None:
            raise ConnectionError("nessun token OpenF1 (vedi log CRITICAL)")

        utente, _pw = leggi_env(self.token.percorso_env)
        # reconnect_on_failure=False: DISATTIVA i retry interni di paho.
        # loop_start() esegue loop_forever in un thread, che di suo
        # ritenta da solo a ogni caduta: misurato sul VPS il 21/07,
        # 15 CONNECT/minuto da una sola caduta — sopra la soglia OpenF1
        # (10 disconnessioni/minuto = blocco di 10 minuti). L'UNICA
        # sorgente di CONNECT dev'essere il nostro backoff, sotto
        # GuardiaConnessioni.
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2,
                             protocol=mqtt.MQTTv5,
                             reconnect_on_failure=False)
        client.username_pw_set(utente, token)
        client.tls_set(cert_reqs=ssl.CERT_REQUIRED)
        connesso = threading.Event()
        rc_conn = {}

        def su_connect(_c, _u, _flags, reason, _props=None):
            rc_conn["reason"] = str(reason)
            rc_conn["rifiutata"] = bool(getattr(reason, "is_failure", False))
            if rc_conn["rifiutata"]:
                self._chiusa.set()
            else:
                connesso.set()

        def su_disconnect(_c, _u, _flags, reason, _props=None):
            log.warning("MQTT disconnesso: %s (%s UTC)", reason,
                        datetime.now(timezone.utc).isoformat(
                            timespec="seconds"))
            self._chiusa.set()

        client.on_connect = su_connect
        client.on_disconnect = su_disconnect
        client.on_message = self._su_messaggio

        self._chiusa.clear()
        self.guardia.attendi_slot()      # tetto 5 CONNECT/minuto
        client.connect(HOST_MQTT, PORTA_MQTT, keepalive=60)
        client.loop_start()
        try:
            # attesa della CONNACK: un rifiuto esplicito interrompe SUBITO
            # (prima si aspettava l'intero timeout mentre paho ritentava in
            # automatico: ~6 CONNECT extra per tentativo, raffica inutile)
            scadenza = time.monotonic() + 30.0
            while not connesso.is_set() and not self._chiusa.is_set() \
                    and time.monotonic() < scadenza:
                connesso.wait(timeout=0.5)
            if not connesso.is_set():
                if rc_conn.get("rifiutata"):
                    raise RifiutoBroker(f"CONNACK: {rc_conn.get('reason')}")
                raise ConnectionError(
                    f"MQTT non connesso entro 30s ({rc_conn.get('reason')})")
            for topic in TOPICS_OPENF1:
                client.subscribe(topic)
            self.cond["connesso"] = True
            self.cond["ingresso_ultima_connessione_ok_utc"] = \
                datetime.now(timezone.utc).isoformat(timespec="seconds")
            self.cond["ingresso_fallimenti_consecutivi"] = 0
            log.info("connesso a OpenF1 MQTT, %d topic sottoscritti",
                     len(TOPICS_OPENF1))
            self._t_ultimo = time.monotonic()
            inizio = time.monotonic()
            while not self._chiusa.is_set():
                # riconnessione proattiva col token fresco prima della
                # scadenza (955s di vita utile con margine 300 su 3600)
                if time.monotonic() - inizio > 3600 - 2 * MARGINE_RINNOVO_S:
                    log.info("riconnessione proattiva per rinnovo token")
                    break
                self._chiusa.wait(timeout=1.0)
        finally:
            self.cond["connesso"] = False
            try:
                client.loop_stop()
                client.disconnect()
            except Exception:
                log.exception("errore in disconnessione MQTT")

    def _registra_fallimento(self, e):
        """Contatori di sanita' per /status: un ingresso morto deve essere
        VISIBILE (incidente 20/07: ore di rifiuti senza segnale esplicito)."""
        self.cond["ingresso_fallimenti_consecutivi"] = \
            self.cond.get("ingresso_fallimenti_consecutivi", 0) + 1
        self.cond["ingresso_ultimo_errore"] = {
            "errore": repr(e)[:200],
            "utc": datetime.now(timezone.utc).isoformat(timespec="seconds")}

    def per_sempre(self):
        backoff = BACKOFF_MIN_S
        while True:
            inizio = time.monotonic()
            rifiuto = False
            try:
                self._connetti()
                log.warning("connessione OpenF1 chiusa (%s UTC)",
                            datetime.now(timezone.utc).isoformat(
                                timespec="seconds"))
            except RifiutoBroker as e:
                rifiuto = True
                self._registra_fallimento(e)
                log.critical(
                    "broker OpenF1 RIFIUTA la connessione: %s — token OAuth "
                    "ottenuto regolarmente: probabile stato account/"
                    "abbonamento o incidente lato OpenF1 (bozza ticket in "
                    "live/collector/TICKET_OPENF1.md). Riprovo tra %.0fs.",
                    e, BACKOFF_RIFIUTO_S)
            except Exception as e:
                self._registra_fallimento(e)
                log.warning("connessione OpenF1 fallita: %r (%s UTC)", e,
                            datetime.now(timezone.utc).isoformat(
                                timespec="seconds"))
            self.reg.chiudi()
            durata = time.monotonic() - inizio
            if durata >= CONNESSIONE_SANA_S:
                backoff = BACKOFF_MIN_S
            if rifiuto:
                attesa = BACKOFF_RIFIUTO_S
            else:
                attesa = backoff
                backoff = min(backoff * 2, BACKOFF_MAX_S)
            log.info("riconnessione OpenF1 tra %.0fs", attesa)
            time.sleep(attesa)
