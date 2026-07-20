#!/usr/bin/env python
"""Collettore live (Fase 2): feed SignalR -> registrazione + eventi WebSocket.

Un daemon unico che:
  - si connette al feed live timing F1 (SignalR) con riconnessione
    automatica a backoff esponenziale (1s -> 60s), senza mai uscire:
    i periodi senza sessione sono normali, nessun dato != errore;
  - registra il flusso grezzo su file rotanti in --out-dir, nello STESSO
    formato del registratore Mac (ispezionabili con inspect_recording.py,
    riproducibili con replay.py);
  - decodifica in-process (decoder + state manager di Fase 1) e serve gli
    eventi via WebSocket con l'interfaccia del replay (position_frame,
    timing_update, track_status, session_status) piu' uno snapshot alla
    connessione; gli eventi sono ritardati di --buffer secondi (default 4)
    per assorbire il jitter del feed (FASE2_PREREG);
  - espone /status HTTP (porta --status-port) con connessione, eta' ultimo
    messaggio, sessione corrente, client WS, validita' token, spazio disco.

Modalita' --replay FILE...: stesso daemon alimentato da una registrazione
(per sviluppo frontend, test client, validazione). Nessuna differenza
osservabile lato client; --exit-al-termine chiude a replay finito (test).

Scelte non ovvie documentate in README.md (stessa cartella). La piu'
importante: NIENTE fastf1 a runtime — get_auth_token() di fastf1, a token
mancante/scaduto, apre un login interattivo nel browser e blocca per
sempre: inaccettabile in un daemon headless. Il client SignalR e'
ricostruito qui su signalrcore rispecchiando fastf1 3.8.3 (stessi topic,
stessa negoziazione, stesso formato file); il token e' letto e validato
localmente (exp del JWT, senza rete) e a token assente/scaduto si connette
NON autenticato loggando un warning CRITICAL a ogni tentativo.

Dipendenze (venv server): websockets, signalrcore, requests, platformdirs.
In modalita' --replay basta websockets (import SignalR pigri).
"""

import argparse
import asyncio
import base64
import binascii
import json
import logging
import queue
import shutil
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from decoder import (  # noqa: E402
    StatisticheDecoder,
    StatoSessione,
    messaggi_da_righe,
)
from inspect_recording import parse_timestamp  # noqa: E402
from replay import (  # noqa: E402
    _scorri_a_velocita,
    eventi_da_messaggi,
    eventi_replay,
)

log = logging.getLogger("collector")

# Topic del feed: identici a fastf1 3.8.3 (SignalRClient.topics)
TOPICS = ["Heartbeat", "AudioStreams", "DriverList",
          "ExtrapolatedClock", "RaceControlMessages",
          "SessionInfo", "SessionStatus", "TeamRadio",
          "TimingAppData", "TimingStats", "TrackStatus",
          "WeatherData", "Position.z", "CarData.z",
          "ContentStreams", "SessionData", "TimingData",
          "TopThree", "RcmSeries", "LapCount"]

URL_CONNESSIONE = "wss://livetiming.formula1.com/signalrcore"
URL_NEGOZIAZIONE = "https://livetiming.formula1.com/signalrcore/negotiate"

BACKOFF_MIN_S = 1.0
BACKOFF_MAX_S = 60.0
CONNESSIONE_SANA_S = 120.0     # dati per almeno 2 min -> backoff azzerato
ROTAZIONE_MAX_BYTE = 512 * 1024 * 1024
ROTAZIONE_MAX_S = 6 * 3600


# ------------------------------------------------------------------ token

def percorso_token():
    """Percorso di f1auth.json (identico a fastf1: platformdirs)."""
    import platformdirs
    return Path(platformdirs.user_data_dir("fastf1")) / "f1auth.json"


def leggi_token():
    """(token, scadenza_utc) dal f1auth.json di fastf1; (None, None) se
    assente/illeggibile. La scadenza e' l'exp del JWT, decodificato in
    locale senza verifica di firma (la verifica vera la fa il server F1)."""
    try:
        token = percorso_token().read_text().strip()
    except OSError:
        return None, None
    if not token:
        return None, None
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        exp = json.loads(base64.urlsafe_b64decode(payload)).get("exp")
        scadenza = (datetime.fromtimestamp(exp, tz=timezone.utc)
                    if exp else None)
    except (IndexError, ValueError, binascii.Error):
        return None, None
    return token, scadenza


def token_valido(scadenza):
    return scadenza is not None and scadenza > datetime.now(timezone.utc)


# ------------------------------------------------------- registratore raw

class RegistratoreRotante:
    """Scrive righe grezze su file rotanti in formato record_session.

    Il file viene aperto PIGRAMENTE alla prima riga (le riconnessioni a
    vuoto tra una sessione e l'altra non producono file vuoti) e ruotato
    per dimensione/eta'. Una rotazione per (ri)connessione: chi consuma
    ordina le parti per primo timestamp (replay.ordina_parti)."""

    def __init__(self, cartella):
        self.cartella = Path(cartella)
        self.cartella.mkdir(parents=True, exist_ok=True)
        self._file = None
        self._byte = 0
        self._aperto_da = 0.0
        self.percorso = None

    def scrivi(self, riga):
        if (self._file is not None
                and (self._byte > ROTAZIONE_MAX_BYTE
                     or time.monotonic() - self._aperto_da > ROTAZIONE_MAX_S)):
            log.info("rotazione file registrazione (%s)", self.percorso)
            self.chiudi()
        if self._file is None:
            nome = datetime.now(timezone.utc).strftime(
                "%Y-%m-%d_%H-%M-%S") + ".txt"
            self.percorso = self.cartella / nome
            self._file = open(self.percorso, "a", encoding="utf-8")
            self._byte = self.percorso.stat().st_size
            self._aperto_da = time.monotonic()
            log.info("nuovo file registrazione: %s", self.percorso)
        self._file.write(riga + "\n")
        self._file.flush()
        self._byte += len(riga) + 1

    def chiudi(self):
        if self._file is not None:
            self._file.close()
            self._file = None
            self.percorso = None


# ------------------------------------------------------- feed live SignalR

class FeedLive:
    """Connessione al feed + loop di riconnessione. Vive per sempre.

    Le righe formattate (stesso formato di fastf1/record_session: repr
    della lista messaggio; snapshot Subscribe -> una riga per topic con
    payload JSON-stringa e ts vuoto) vanno sia sul file sia in coda_righe.
    """

    def __init__(self, coda_righe, registratore, stato_condiviso,
                 timeout_stallo):
        self.coda = coda_righe
        self.reg = registratore
        self.cond = stato_condiviso
        self.timeout_stallo = timeout_stallo
        self._t_ultimo = None          # monotonic ultimo messaggio
        self._chiusa = threading.Event()

    # -- formattazione identica a fastf1 3.8.3 SignalRClient._on_message
    def _su_messaggio(self, msg):
        from signalrcore.messages.completion_message import CompletionMessage
        self._t_ultimo = time.monotonic()
        self.cond["ultimo_messaggio_utc"] = datetime.now(
            timezone.utc).isoformat(timespec="seconds")
        if isinstance(msg, CompletionMessage):
            righe = [str([chiave, json.dumps(msg.result[chiave]), ""])
                     for chiave in msg.result.keys()]
        elif isinstance(msg, list):
            righe = [str(msg)]
        else:
            log.error("tipo messaggio sconosciuto: %s", type(msg))
            return
        for riga in righe:
            self.reg.scrivi(riga)
            self.coda.put(riga)

    def _connetti(self):
        """Una connessione: torna quando cade o va in stallo."""
        import requests
        from signalrcore.hub_connection_builder import HubConnectionBuilder

        token, scadenza = leggi_token()
        autenticato = token_valido(scadenza)
        if not autenticato:
            log.critical(
                "TOKEN F1TV %s — connessione NON autenticata (dati "
                "parziali). Rinnovare: procedura in live/collector/"
                "README.md, sezione token.",
                "SCADUTO il %s" % scadenza.isoformat()
                if scadenza else "MANCANTE")
        self.cond["token_usato"] = "autenticato" if autenticato \
            else "non_autenticato"

        r = requests.options(URL_NEGOZIAZIONE, timeout=30)
        opzioni = {
            "verify_ssl": True,
            "access_token_factory": (lambda: token) if autenticato else None,
            "headers": {"Cookie":
                        f"AWSALBCORS={r.cookies['AWSALBCORS']}"},
        }
        conn = HubConnectionBuilder() \
            .with_url(URL_CONNESSIONE, options=opzioni) \
            .configure_logging(logging.WARNING) \
            .build()

        self._chiusa.clear()
        aperta = threading.Event()
        conn.on_open(aperta.set)
        conn.on_close(self._chiusa.set)
        conn.on("feed", self._su_messaggio)
        conn.start()
        if not aperta.wait(timeout=30):
            raise ConnectionError("connessione non aperta entro 30s")
        conn.send("Subscribe", [TOPICS], on_invocation=self._su_messaggio)
        self.cond["connesso"] = True
        self.cond["ingresso_ultima_connessione_ok_utc"] = datetime.now(
            timezone.utc).isoformat(timespec="seconds")
        self.cond["ingresso_fallimenti_consecutivi"] = 0
        log.info("connesso al feed (%s)",
                 "autenticato" if autenticato else "NON autenticato")

        self._t_ultimo = time.monotonic()
        try:
            while not self._chiusa.is_set():
                if time.monotonic() - self._t_ultimo > self.timeout_stallo:
                    log.warning("stallo: nessun messaggio da %ds, "
                                "riconnetto", self.timeout_stallo)
                    break
                self._chiusa.wait(timeout=1.0)
        finally:
            self.cond["connesso"] = False
            try:
                conn.stop()
            except Exception:
                log.exception("errore in stop() della connessione")

    def per_sempre(self):
        backoff = BACKOFF_MIN_S
        while True:
            inizio = time.monotonic()
            try:
                self._connetti()
                log.warning("connessione chiusa (%s UTC)",
                            datetime.now(timezone.utc).isoformat(
                                timespec="seconds"))
            except Exception as e:
                self.cond["ingresso_fallimenti_consecutivi"] = \
                    self.cond.get("ingresso_fallimenti_consecutivi", 0) + 1
                self.cond["ingresso_ultimo_errore"] = {
                    "errore": repr(e)[:200],
                    "utc": datetime.now(timezone.utc).isoformat(
                        timespec="seconds")}
                log.warning("connessione fallita: %r (%s UTC)", e,
                            datetime.now(timezone.utc).isoformat(
                                timespec="seconds"))
            self.reg.chiudi()   # nuova connessione -> nuovo file (pigro)
            durata = time.monotonic() - inizio
            if durata >= CONNESSIONE_SANA_S:
                backoff = BACKOFF_MIN_S
            log.info("riconnessione tra %.0fs", backoff)
            time.sleep(backoff)
            backoff = min(backoff * 2, BACKOFF_MAX_S)


# ------------------------------------------------- pipeline righe -> eventi

def pipeline_live(coda_righe, coda_eventi, loop, stato, cond):
    """Thread: righe grezze -> messaggi -> eventi (codice di Fase 1)."""
    stats = StatisticheDecoder()

    def righe():
        while True:
            yield coda_righe.get()

    for evento in eventi_da_messaggi(
            messaggi_da_righe(righe(), stats), stato=stato):
        cond["sessione"] = _nome_sessione(stato)
        loop.call_soon_threadsafe(
            coda_eventi.put_nowait, (time.monotonic(), evento))


def _con_inpit_geometrico(eventi, pitlane):
    """Avvolge il flusso eventi col classificatore geometrico (Fase 3)
    se un corridoio pit e' configurato; altrimenti in_pit resta assente
    (mai inventato). Solo per l'ingresso OpenF1: il SignalR ha l'InPit
    del timing vero."""
    if not pitlane:
        return eventi
    from inpit_geometrico import ClassificatoreInPit, arricchisci_in_pit
    log.info("in_pit geometrico attivo (corridoio: %s)", pitlane)
    return arricchisci_in_pit(eventi,
                              ClassificatoreInPit.da_file(pitlane))


def pipeline_replay(files, speed, coda_eventi, loop, stato, cond,
                    al_termine, primo_client=None, pitlane=None):
    """Thread: eventi dal replay (stesso codice del live, pacing --speed).

    File .jsonl = registrazioni OpenF1 (adapter mappa_openf1), altrimenti
    formato SignalR di Fase 1. Nessuna differenza lato client."""
    if primo_client is not None:
        log.info("replay in attesa del primo client WS")
        primo_client.wait()
    percorsi = [Path(f) for f in files]
    if all(p.suffix == ".jsonl" for p in percorsi):
        from mappa_openf1 import eventi_replay_openf1
        eventi = eventi_replay_openf1(percorsi, stato=stato)
        eventi = _con_inpit_geometrico(eventi, pitlane)
    elif any(p.suffix == ".jsonl" for p in percorsi):
        raise SystemExit("replay misto SignalR/JSONL non supportato")
    else:
        eventi = eventi_replay(percorsi, stato=stato)
    if speed != "max":
        eventi = _scorri_a_velocita(eventi, float(speed))
    for evento in eventi:
        cond["sessione"] = _nome_sessione(stato)
        loop.call_soon_threadsafe(
            coda_eventi.put_nowait, (time.monotonic(), evento))
    log.info("replay terminato")
    loop.call_soon_threadsafe(al_termine.set)


def pipeline_live_openf1(coda_messaggi, coda_eventi, loop, stato, cond,
                         pitlane=None):
    """Thread: messaggi MQTT OpenF1 -> eventi (mappa_openf1)."""
    from mappa_openf1 import eventi_da_openf1

    def flusso():
        while True:
            yield coda_messaggi.get()

    eventi = _con_inpit_geometrico(
        eventi_da_openf1(flusso(), stato=stato), pitlane)
    for evento in eventi:
        cond["sessione"] = _nome_sessione(stato)
        loop.call_soon_threadsafe(
            coda_eventi.put_nowait, (time.monotonic(), evento))


def _nome_sessione(stato):
    info = getattr(stato, "session_info", None)
    if info is not None:                      # StatoSessione (SignalR)
        meeting = (info.get("Meeting") or {}).get("Name")
        nome = info.get("Name")
        return " — ".join(p for p in (meeting, nome) if p) or None
    sess = getattr(stato, "sessione", None)   # StatoOpenF1
    if isinstance(sess, dict):
        return " — ".join(p for p in (sess.get("circuit_short_name"),
                                      sess.get("session_name")) if p) \
            or None
    return None


# ----------------------------------------------------- replica per snapshot

class Replica:
    """Stato ricostruito DAGLI EVENTI GIA' SERVITI: lo snapshot inviato a
    un nuovo client coincide esattamente con cio' che avrebbe visto un
    client connesso da sempre (niente stato 'piu' avanti' del flusso)."""

    def __init__(self):
        self.cars = {}
        self.extra = {}
        self.drivers = {}
        self.track_status = None
        self.session_status = None
        self.t = None

    def applica(self, e):
        self.t = e.get("t") or self.t
        if e["type"] == "position_frame":
            for auto, xy in e["cars"].items():
                self.cars.setdefault(auto, {}).update(xy)
            for auto, xy in e.get("extra_cars", {}).items():
                self.extra.setdefault(auto, {}).update(xy)
        elif e["type"] == "timing_update":
            for auto, diff in e["cars"].items():
                self.cars.setdefault(auto, {}).update(diff)
        elif e["type"] == "driver_list":
            for auto, voce in e["cars"].items():
                self.drivers.setdefault(auto, {}).update(voce)
        elif e["type"] == "track_status":
            self.track_status = e["status"]
        elif e["type"] == "session_status":
            self.session_status = e["status"]

    def snapshot(self):
        return {"type": "snapshot", "t": self.t, "cars": self.cars,
                "extra_cars": self.extra, "driver_list": self.drivers,
                "track_status": self.track_status,
                "session_status": self.session_status}


# ------------------------------------------------------------- server WS

async def servi(coda_eventi, replica, clients, buffer_s, cond, al_termine):
    """Distribuzione: ogni evento parte a (arrivo + buffer)."""
    import websockets
    while True:
        if al_termine is not None and al_termine.is_set() \
                and coda_eventi.empty():
            for ws in list(clients):
                await ws.close()
            log.info("buffer svuotato dopo il replay: esco")
            asyncio.get_running_loop().stop()
            return
        try:
            arrivo, evento = await asyncio.wait_for(
                coda_eventi.get(), timeout=0.5)
        except asyncio.TimeoutError:
            continue
        ritardo = arrivo + buffer_s - time.monotonic()
        if ritardo > 0:
            await asyncio.sleep(ritardo)
        replica.applica(evento)
        cond["ultimo_evento_t"] = evento.get("t")
        if clients:
            websockets.broadcast(clients, json.dumps(
                evento, ensure_ascii=False))


def gestore_ws(replica, clients, cond, primo_client=None):
    async def gestisci(ws):
        snapshot = json.dumps(replica.snapshot(), ensure_ascii=False)
        clients.add(ws)          # nessun await tra snapshot e iscrizione:
        cond["client_ws"] = len(clients)   # niente eventi persi in mezzo
        if primo_client is not None:
            primo_client.set()
        log.info("client WS connesso (%d)", len(clients))
        try:
            await ws.send(snapshot)
            await ws.wait_closed()
        finally:
            clients.discard(ws)
            cond["client_ws"] = len(clients)
            log.info("client WS disconnesso (%d)", len(clients))
    return gestisci


# ---------------------------------------------------------- /status HTTP

def sanita_ingresso(cond, eta_ultimo_messaggio_s):
    """Verdetto esplicito sull'ingresso per /status (versione minima del
    punto 14, incidente 20/07: un ingresso morto non deve restare
    invisibile). Tre stati, mai ambigui:
      OK / IN RICONNESSIONE / MORTO (>=3 fallimenti consecutivi)."""
    fallimenti = cond.get("ingresso_fallimenti_consecutivi", 0)
    if cond.get("modalita") == "replay":
        verdetto = "replay (nessun ingresso esterno)"
    elif cond.get("connesso"):
        if eta_ultimo_messaggio_s is None:
            verdetto = ("OK: connesso, nessun messaggio ricevuto "
                        "(normale fuori sessione)")
        else:
            verdetto = ("OK: connesso, ultimo messaggio ricevuto "
                        f"{round(eta_ultimo_messaggio_s)} secondi fa")
    elif fallimenti >= 3:
        ultimo = (cond.get("ingresso_ultimo_errore") or {})
        verdetto = (f"INGRESSO MORTO: {fallimenti} connessioni consecutive "
                    f"fallite (ultimo errore: {ultimo.get('errore')})")
    else:
        verdetto = "non connesso (riconnessione in corso)"
    return {
        "verdetto": verdetto,
        "ultimo_messaggio_s_fa": (round(eta_ultimo_messaggio_s)
                                  if eta_ultimo_messaggio_s is not None
                                  else None),
        "ultima_connessione_ok_utc":
            cond.get("ingresso_ultima_connessione_ok_utc"),
        "fallimenti_consecutivi": fallimenti,
        "ultimo_errore": cond.get("ingresso_ultimo_errore"),
    }


def avvia_status_http(porta, cond, out_dir):
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

    class Gestore(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path != "/status":
                self.send_error(404)
                return
            _token, scadenza = leggi_token()
            ultimo = cond.get("ultimo_messaggio_utc")
            eta = None
            if ultimo:
                eta = (datetime.now(timezone.utc)
                       - datetime.fromisoformat(ultimo)).total_seconds()
            try:
                disco = shutil.disk_usage(out_dir)
            except OSError:
                disco = None
            token_of1 = cond.get("_token_openf1")
            corpo = json.dumps({
                "modalita": cond.get("modalita"),
                "ingress": cond.get("ingress"),
                "connesso": cond.get("connesso", False),
                "sanita": sanita_ingresso(cond, eta),
                "openf1_token": token_of1.stato() if token_of1 else None,
                "ultimo_messaggio_utc": ultimo,
                "eta_ultimo_messaggio_s":
                    round(eta) if eta is not None else None,
                "sessione": cond.get("sessione"),
                "ultimo_evento_t": cond.get("ultimo_evento_t"),
                "client_ws": cond.get("client_ws", 0),
                "buffer_s": cond.get("buffer_s"),
                "token": {
                    "presente": _token is not None,
                    "scadenza_utc":
                        scadenza.isoformat() if scadenza else None,
                    "valido": token_valido(scadenza),
                    "usato": cond.get("token_usato"),
                },
                "disco": {
                    "liberi_gb": round(disco.free / 2**30, 1),
                    "totale_gb": round(disco.total / 2**30, 1),
                } if disco else None,
            }, ensure_ascii=False).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(corpo)))
            self.end_headers()
            self.wfile.write(corpo)

        def log_message(self, *a):   # niente rumore su journald
            pass

    server = ThreadingHTTPServer(("0.0.0.0", porta), Gestore)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    log.info("/status su porta %d", porta)


# ------------------------------------------------------------------ main

async def _main_async(args):
    import websockets

    replay_jsonl = bool(args.replay) and all(
        str(f).endswith(".jsonl") for f in args.replay)
    ingress_openf1 = (args.ingress == "openf1" and not args.replay) \
        or replay_jsonl
    cond = {"modalita": "replay" if args.replay else "live",
            "ingress": "openf1" if ingress_openf1 else "signalr",
            "buffer_s": args.buffer, "client_ws": 0}
    if ingress_openf1:
        from mappa_openf1 import StatoOpenF1
        stato = StatoOpenF1()
    else:
        stato = StatoSessione()
    replica = Replica()
    clients = set()
    coda_eventi = asyncio.Queue()
    loop = asyncio.get_running_loop()
    al_termine = asyncio.Event() if (args.replay and args.exit_al_termine) \
        else None
    primo_client = threading.Event() if (args.replay
                                         and args.attendi_primo_client) \
        else None

    Path(args.out_dir).mkdir(parents=True, exist_ok=True)
    avvia_status_http(args.status_port, cond, args.out_dir)

    if args.replay:
        threading.Thread(
            target=pipeline_replay,
            args=(args.replay, args.speed, coda_eventi, loop, stato, cond,
                  al_termine if al_termine is not None else asyncio.Event(),
                  primo_client, args.pitlane),
            daemon=True).start()
    elif ingress_openf1:
        from ingress_openf1 import (
            IngressoOpenF1,
            RegistratoreJSONL,
        )
        coda_messaggi = queue.Queue()
        registratore = RegistratoreJSONL(Path(args.out_dir) / "openf1")
        ingresso = IngressoOpenF1(coda_messaggi, registratore, cond,
                                  args.env_file)
        cond["_token_openf1"] = ingresso.token
        threading.Thread(target=ingresso.per_sempre, daemon=True).start()
        threading.Thread(
            target=pipeline_live_openf1,
            args=(coda_messaggi, coda_eventi, loop, stato, cond,
                  args.pitlane),
            daemon=True).start()
    else:
        coda_righe = queue.Queue()
        registratore = RegistratoreRotante(args.out_dir)
        feed = FeedLive(coda_righe, registratore, cond, args.timeout)
        threading.Thread(target=feed.per_sempre, daemon=True).start()
        threading.Thread(
            target=pipeline_live,
            args=(coda_righe, coda_eventi, loop, stato, cond),
            daemon=True).start()

    async with websockets.serve(
            gestore_ws(replica, clients, cond, primo_client),
            "0.0.0.0", args.ws_port):
        log.info("WebSocket su porta %d (buffer %.1fs)",
                 args.ws_port, args.buffer)
        await servi(coda_eventi, replica, clients, args.buffer, cond,
                    al_termine)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Collettore live: feed SignalR -> registrazione + "
                    "eventi WebSocket (o --replay da file).")
    parser.add_argument("--ws-port", type=int, default=8765)
    parser.add_argument("--status-port", type=int, default=8766)
    parser.add_argument("--buffer", type=float, default=4.0,
                        help="ritardo fisso di distribuzione [s] "
                             "(default 4, FASE2_PREREG)")
    parser.add_argument("--out-dir", default="data/live_raw",
                        help="cartella registrazioni grezze")
    parser.add_argument("--timeout", type=int, default=600,
                        help="stallo feed: riconnetti dopo N secondi "
                             "senza messaggi (default 600)")
    parser.add_argument("--ingress", choices=("openf1", "signalr"),
                        default="openf1",
                        help="ingresso live: OpenF1 MQTT (default, "
                             "FASE2_PREREG addendum) o SignalR diretto "
                             "(bloccato dai datacenter)")
    parser.add_argument("--env-file", default="~/.openf1.env",
                        help="file credenziali OpenF1 (KEY=VALUE, 600)")
    parser.add_argument("--pitlane",
                        help="corridoio pit del circuito (formato "
                             "pitlane_spa.json): attiva l'in_pit "
                             "geometrico sull'ingresso OpenF1")
    parser.add_argument("--replay", nargs="+", metavar="FILE",
                        help="alimenta il daemon da registrazioni")
    parser.add_argument("--speed", default="1",
                        help="velocita' replay: 1, 10, ... o 'max'")
    parser.add_argument("--exit-al-termine", action="store_true",
                        help="(solo --replay) esci a buffer svuotato")
    parser.add_argument("--attendi-primo-client", action="store_true",
                        help="(solo --replay) parti al primo client WS "
                             "(per i test: nessun evento perso)")
    args = parser.parse_args()

    logging.basicConfig(
        format="%(asctime)s - %(name)s - %(levelname)s: %(message)s",
        level=logging.INFO)
    logging.Formatter.converter = time.gmtime   # log in UTC

    try:
        asyncio.run(_main_async(args))
    except RuntimeError as e:
        if "Event loop stopped" not in str(e):   # uscita --exit-al-termine
            raise
    except KeyboardInterrupt:
        log.info("interrotto dall'utente")
    return 0


if __name__ == "__main__":
    sys.exit(main())
