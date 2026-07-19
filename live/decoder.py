#!/usr/bin/env python
"""Decoder del feed live timing registrato: da file grezzo a messaggi tipizzati.

Input: file scritti da record_session.py (una riga per messaggio, formato repr
del client FastF1; le righe dello snapshot iniziale hanno payload JSON-stringa
e timestamp vuoto). Il parsing riga/timestamp riusa la logica gia' validata in
inspect_recording.py.

Livelli:
  - messaggi(path)            -> flusso (topic, payload decodificato, ts busta)
  - campioni_posizione(...)   -> un campione per auto per timestamp (Position.z)
  - campioni_cardata(...)     -> canali telemetria per auto (CarData.z)
  - StatoSessione             -> session state manager: fonde i delta TimingData
                                 in uno stato per-pilota persistente + stati
                                 semplici (TrackStatus, SessionStatus,
                                 DriverList, WeatherData, RaceControlMessages)

Regole dure:
  - (X,Y,Z)=(0,0,0) = posizione NON disponibile (garage/trasponder muto):
    mai emessa come posizione valida.
  - righe non riconosciute: contate e loggate, mai crash (il decoder deve
    digerire anche registrazioni troncate con inizio/fine bruschi).

Solo libreria standard; nessun import dal kernel.
"""

import json
import logging
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from inspect_recording import decodifica_z, parse_riga, parse_timestamp  # noqa: E402

log = logging.getLogger("decoder")

# Mappatura canali CarData.z (feed live timing F1; verificata empiricamente
# su FP2 Spa 2026: range fisicamente plausibili, vedi REPORT_FASE1.md):
#   '0'  = RPM motore
#   '2'  = velocita' [km/h]
#   '3'  = marcia (0 = folle/retro)
#   '4'  = throttle [%] (il feed usa 0-104: >100 osservato, non errore)
#   '5'  = freno (0/104 on-off nel feed)
#   '45' = DRS (codici stato: 0/8 chiuso, 10/12/14 aperto)
CANALI_CARDATA = {
    "0": "rpm",
    "2": "velocita",
    "3": "marcia",
    "4": "throttle",
    "5": "freno",
    "45": "drs",
}

# Range di plausibilita' fisica: fuori range -> warning (mai crash).
RANGE_PLAUSIBILI = {
    "rpm": (0, 20000),
    "velocita": (0, 360),
    "marcia": (0, 8),
    "throttle": (0, 110),
    "freno": (0, 110),
    "drs": (0, 15),
}
_MAX_WARNING_PER_CANALE = 5


@dataclass
class CampionePosizione:
    t: Optional[datetime]
    auto: str
    x: int
    y: int
    z: int
    status: str


@dataclass
class CampioneCarData:
    t: Optional[datetime]
    auto: str
    canali: dict  # nome canale -> valore (solo canali mappati)


class StatisticheDecoder:
    """Contatori del passaggio su un file: righe ok/errore, topic visti."""

    def __init__(self):
        self.righe_totali = 0
        self.righe_ok = 0
        self.righe_vuote = 0
        self.righe_errore = 0
        self.per_topic = {}

    @property
    def frazione_ok(self):
        utili = self.righe_totali - self.righe_vuote
        return self.righe_ok / utili if utili else 1.0


def messaggi_da_righe(righe, stats=None):
    """Genera (topic, payload, ts) da un iterabile di righe grezze.

    E' il decoder per-riga condiviso: usato da messaggi() sui file
    registrati e dal collettore live (Fase 2) sulle righe appena ricevute —
    stesso codice, stessa semantica. payload e' gia' decodificato
    (JSON-stringa -> oggetto, topic .z -> base64+deflate raw -> oggetto);
    ts e' il timestamp della busta (None per le righe di snapshot).
    Righe illeggibili: contate, mai eccezioni.
    """
    if stats is None:
        stats = StatisticheDecoder()
    for riga in righe:
        stats.righe_totali += 1
        if not riga.strip():
            stats.righe_vuote += 1
            continue
        parsato = parse_riga(riga)
        if parsato is None:
            stats.righe_errore += 1
            log.warning("riga %d illeggibile (troncata?): %.80s",
                        stats.righe_totali, riga.strip())
            continue
        topic, payload, ts = parsato
        try:
            if topic.endswith(".z"):
                if isinstance(payload, str):
                    payload = decodifica_z(payload)
            elif isinstance(payload, str):
                payload = json.loads(payload)
        except Exception as e:
            stats.righe_errore += 1
            log.warning("riga %d: payload %s non decodificabile (%r)",
                        stats.righe_totali, topic, e)
            continue
        stats.righe_ok += 1
        stats.per_topic[topic] = stats.per_topic.get(topic, 0) + 1
        yield topic, payload, ts


def messaggi(path, stats=None):
    """Genera (topic, payload, ts) dalle righe di un file registrato."""
    with open(path, encoding="utf-8") as f:
        yield from messaggi_da_righe(f, stats)


def campioni_posizione(payload):
    """Da un payload Position.z ai campioni per auto per timestamp.

    Regola dura: (X,Y,Z)=(0,0,0) = posizione non disponibile, mai emessa.
    """
    for campione in payload.get("Position", []):
        ts = parse_timestamp(campione.get("Timestamp", ""))
        for auto, voce in campione.get("Entries", {}).items():
            x = voce.get("X", 0)
            y = voce.get("Y", 0)
            z = voce.get("Z", 0)
            if x == 0 and y == 0 and z == 0:
                continue
            yield CampionePosizione(t=ts, auto=str(auto), x=x, y=y, z=z,
                                    status=voce.get("Status", ""))


_contatori_warning = {}


def campioni_cardata(payload):
    """Da un payload CarData.z ai canali per auto (solo canali mappati).

    Valori fuori dai range di plausibilita': warning (limitato), mai crash.
    """
    for voce in payload.get("Entries", []):
        ts = parse_timestamp(voce.get("Utc", ""))
        for auto, dati in voce.get("Cars", {}).items():
            canali = {}
            for codice, valore in dati.get("Channels", {}).items():
                nome = CANALI_CARDATA.get(str(codice))
                if nome is None:
                    continue
                minimo, massimo = RANGE_PLAUSIBILI[nome]
                if not (isinstance(valore, (int, float))
                        and minimo <= valore <= massimo):
                    n = _contatori_warning.get(nome, 0)
                    _contatori_warning[nome] = n + 1
                    if n < _MAX_WARNING_PER_CANALE:
                        log.warning("CarData auto %s: %s=%r fuori range "
                                    "[%s, %s]", auto, nome, valore,
                                    minimo, massimo)
                canali[nome] = valore
            yield CampioneCarData(t=ts, auto=str(auto), canali=canali)


def merge_delta(base, delta):
    """Merge ricorsivo dei delta del feed nello stato persistente.

    Chiavi presenti nel delta aggiornano, chiavi assenti persistono.
    Caso feed: un delta dict puo' aggiornare una lista per indice
    ({'Sectors': {'2': {...}}} su una lista di settori).
    """
    if isinstance(base, dict) and isinstance(delta, dict):
        for chiave, valore in delta.items():
            if chiave in base:
                base[chiave] = merge_delta(base[chiave], valore)
            else:
                base[chiave] = valore
        return base
    if isinstance(base, list) and isinstance(delta, dict):
        for chiave, valore in delta.items():
            try:
                indice = int(chiave)
            except (TypeError, ValueError):
                return delta
            if 0 <= indice < len(base):
                base[indice] = merge_delta(base[indice], valore)
            elif indice == len(base):
                base.append(valore)
        return base
    return delta


def _valore_tempo(nodo):
    """Estrae 'Value' da un nodo tempo del feed; None se vuoto/assente."""
    if isinstance(nodo, dict):
        valore = nodo.get("Value", "")
    else:
        valore = nodo
    return valore if valore else None


class StatoSessione:
    """Session state manager: stato per-pilota + stati semplici di sessione."""

    def __init__(self):
        self.piloti = {}          # numero auto -> stato TimingData fuso
        self.driver_list = {}     # numero auto -> anagrafica
        self.track_status = None  # es. 'AllClear'
        self.session_status = None  # es. 'Started'
        self.weather = {}
        self.race_control = []    # lista messaggi race control
        self.session_info = {}

    def aggiorna(self, topic, payload, ts=None):
        """Applica un messaggio decodificato allo stato. Ritorna True se il
        topic e' gestito dallo stato, False altrimenti."""
        if topic == "TimingData":
            for auto, delta in payload.get("Lines", {}).items():
                stato = self.piloti.setdefault(str(auto), {})
                merge_delta(stato, delta if isinstance(delta, dict) else {})
            return True
        if topic == "DriverList":
            for auto, delta in payload.items():
                if isinstance(delta, dict):
                    merge_delta(self.driver_list.setdefault(str(auto), {}),
                                delta)
            return True
        if topic == "TrackStatus":
            self.track_status = payload.get("Message") or payload.get("Status")
            return True
        if topic == "SessionStatus":
            self.session_status = payload.get("Status")
            return True
        if topic == "WeatherData":
            merge_delta(self.weather, payload)
            return True
        if topic == "RaceControlMessages":
            nuovi = payload.get("Messages", [])
            if isinstance(nuovi, dict):  # delta per indice
                nuovi = list(nuovi.values())
            self.race_control.extend(m for m in nuovi if isinstance(m, dict))
            return True
        if topic == "SessionInfo":
            merge_delta(self.session_info, payload)
            return True
        return False

    def vista_pilota(self, auto):
        """Vista sintetica per-pilota (l'interfaccia dei timing_update)."""
        stato = self.piloti.get(str(auto), {})
        pos = stato.get("Position")
        try:
            pos = int(pos) if pos not in (None, "") else None
        except (TypeError, ValueError):
            pos = None
        gap = (stato.get("GapToLeader")
               or stato.get("TimeDiffToFastest") or "")
        return {
            "pos": pos,
            "gap": gap if isinstance(gap, str) else "",
            "in_pit": bool(stato.get("InPit", False)),
            "last_lap": _valore_tempo(stato.get("LastLapTime")),
        }

    def best_lap(self, auto):
        """Best lap del pilota dallo stato fuso ('' -> None)."""
        return _valore_tempo(self.piloti.get(str(auto), {}).get("BestLapTime"))

    def numero_giri(self, auto):
        return self.piloti.get(str(auto), {}).get("NumberOfLaps")
