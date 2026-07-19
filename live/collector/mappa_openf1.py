#!/usr/bin/env python
"""Mappatura messaggi OpenF1 -> interfaccia eventi di Fase 1.

Il client WebSocket non deve poter distinguere l'ingresso SignalR
dall'ingresso OpenF1: stessi tipi (position_frame, timing_update,
track_status, session_status), stessi campi. Dove OpenF1 non fornisce un
campo, il campo resta ASSENTE (tabella di copertura nel README) — mai
inventato; le derivazioni esplicite sono dichiarate qui e nel README:

  - position_frame  <- v1/location (raggruppati per `date`; regola dura
                       (0,0,0) invariata; `status` NON disponibile);
  - timing_update   <- v1/position (pos), v1/intervals (gap),
                       v1/laps (last_lap); in_pit dal classificatore
                       GEOMETRICO (inpit_geometrico.py, Fase 3) quando il
                       corridoio del circuito esiste, altrimenti assente;
                       v1/pit resta nel grezzo come arbitro a posteriori;
  - track_status    <- v1/race_control (solo eventi track-wide:
                       categoria SafetyCar o flag con scope Track);
  - driver_list     <- v1/drivers (sigla=name_acronym,
                       colore=team_colour) — Fase 3;
  - session_status  <- NON DISPONIBILE da OpenF1 (v1/sessions non ha
                       transizioni di stato): mai emesso, documentato.
                       v1/sessions alimenta solo /status.

Ordinamento: eventi emessi in ordine d'arrivo, `t` = timestamp ORIGINE
del dato (`date`); la registrazione JSONL preserva l'ordine d'arrivo,
quindi replay della registrazione == flusso live (KPI 4). Deduplica per
`_id` (per topic, monotono) quando presente; `_key` non serve qui: lo
stato per-pilota e' gia' un merge per driver_number.

Formati derivati (conversioni, non invenzioni):
  - gap: numero -> "+X.XXX" (0/None -> "" come il feed per il leader;
    stringhe tipo "+1 LAP" passate come sono);
  - last_lap: secondi -> "M:SS.mmm" (stesso formato del feed SignalR).

Solo stdlib.
"""

import logging
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from replay import _fmt  # noqa: E402

log = logging.getLogger("mappa_openf1")

CAMPI_TIMING = ("pos", "gap", "in_pit", "last_lap")


def parse_data(testo):
    """Timestamp OpenF1 (ISO, con offset o Z) -> datetime naive UTC
    (stessa convenzione del decoder di Fase 1)."""
    if not testo:
        return None
    try:
        dt = datetime.fromisoformat(str(testo).replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is not None:
        dt = (dt - dt.utcoffset()).replace(tzinfo=None)
    return dt


def formatta_gap(valore):
    if valore is None or valore == 0:
        return ""
    if isinstance(valore, str):
        return valore
    try:
        return f"+{float(valore):.3f}"
    except (TypeError, ValueError):
        return ""


def formatta_giro(secondi):
    if not isinstance(secondi, (int, float)) or secondi <= 0:
        return None
    minuti = int(secondi // 60)
    resto = secondi - minuti * 60
    return f"{minuti}:{resto:06.3f}"


class StatoOpenF1:
    """Stato della mappatura: piloti noti, vista timing, track status."""

    def __init__(self):
        self.driver_list = {}      # str(num) -> {"Tla": ...}
        self.timing = {}           # str(num) -> {pos,gap,in_pit,last_lap}
        self.track_status = None
        self.sessione = None       # info v1/sessions per /status
        self._ultimo_id = {}       # topic -> _id massimo visto

    def vista(self, auto):
        return self.timing.setdefault(
            str(auto), {"pos": None, "gap": "", "in_pit": False,
                        "last_lap": None})


def _mappa_race_control(obj):
    """Un messaggio race_control -> stato TrackStatus (o None se non
    track-wide). Vocabolario di Fase 1: AllClear/Yellow/Red/SCDeployed/
    SCEnding/VSCDeployed/VSCEnding."""
    msg = (obj.get("message") or "").upper()
    flag = (obj.get("flag") or "").upper()
    scope = (obj.get("scope") or "").capitalize()
    categoria = obj.get("category") or ""
    if "VIRTUAL SAFETY CAR DEPLOYED" in msg:
        return "VSCDeployed"
    if "VIRTUAL SAFETY CAR ENDING" in msg:
        return "VSCEnding"
    if "SAFETY CAR DEPLOYED" in msg or flag == "SAFETY CAR":
        return "SCDeployed"
    if categoria == "SafetyCar" and "IN THIS LAP" in msg:
        return "SCEnding"
    if flag == "RED":
        return "Red"
    if scope and scope != "Track":
        return None          # gialli di settore/pilota: non track-wide
    if flag in ("YELLOW", "DOUBLE YELLOW"):
        return "Yellow"
    if flag in ("GREEN", "CLEAR"):
        return "AllClear"
    return None


def eventi_da_openf1(flusso, stato=None):
    """Da (topic, payload, ts_ricezione) OpenF1 agli eventi di Fase 1."""
    if stato is None:
        stato = StatoOpenF1()

    def normalizza(payload):
        oggetti = payload if isinstance(payload, list) else [payload]
        return [o for o in oggetti if isinstance(o, dict)]

    def nuovo(topic, obj):
        oid = obj.get("_id")
        if oid is None:
            return True
        ultimo = stato._ultimo_id.get(topic)
        if ultimo is not None and oid <= ultimo:
            return False
        stato._ultimo_id[topic] = oid
        return True

    def evento_timing(auto, diff, t):
        if diff:
            return [{"type": "timing_update", "t": _fmt(t),
                     "cars": {str(auto): diff}}]
        return []

    def applica(auto, campi, t):
        vista = stato.vista(auto)
        diff = {k: v for k, v in campi.items() if vista[k] != v}
        vista.update(diff)
        return evento_timing(auto, diff, t)

    for topic, payload, _ts_ricezione in flusso:
        oggetti = [o for o in normalizza(payload) if nuovo(topic, o)]
        if not oggetti:
            continue

        if topic == "v1/location":
            frames = {}
            for o in oggetti:
                x, y, z = o.get("x", 0), o.get("y", 0), o.get("z", 0)
                if x == 0 and y == 0 and z == 0:
                    continue      # regola dura di Fase 1: mai emesso
                t = parse_data(o.get("date"))
                if t is None or o.get("driver_number") is None:
                    continue
                frames.setdefault(t, {})[str(o["driver_number"])] = {
                    "x": int(x), "y": int(y)}
            for t in sorted(frames):
                auto_xy = frames[t]
                if stato.driver_list:
                    noti = {a: c for a, c in auto_xy.items()
                            if a in stato.driver_list}
                    extra = {a: c for a, c in auto_xy.items()
                             if a not in stato.driver_list}
                    evento = {"type": "position_frame", "t": _fmt(t),
                              "cars": noti}
                    if extra:
                        evento["extra_cars"] = extra
                else:
                    evento = {"type": "position_frame", "t": _fmt(t),
                              "cars": auto_xy}
                yield evento

        elif topic == "v1/drivers":
            cambi = {}
            t_drv = None
            for o in oggetti:
                num = o.get("driver_number")
                if num is None:
                    continue
                colore = o.get("team_colour")
                voce = {"sigla": o.get("name_acronym"),
                        "colore": ("#" + colore) if colore else None}
                if stato.driver_list.get(str(num)) != voce \
                        and (voce["sigla"] or voce["colore"]):
                    stato.driver_list[str(num)] = voce
                    cambi[str(num)] = voce
                    t_drv = parse_data(o.get("date")) or t_drv
            if cambi:
                yield {"type": "driver_list",
                       "t": _fmt(t_drv) if t_drv else None,
                       "cars": cambi}

        elif topic == "v1/position":
            for o in oggetti:
                t = parse_data(o.get("date"))
                if o.get("driver_number") is None or t is None:
                    continue
                try:
                    pos = int(o.get("position"))
                except (TypeError, ValueError):
                    continue
                yield from applica(o["driver_number"], {"pos": pos}, t)

        elif topic == "v1/intervals":
            for o in oggetti:
                t = parse_data(o.get("date"))
                if o.get("driver_number") is None or t is None:
                    continue
                yield from applica(
                    o["driver_number"],
                    {"gap": formatta_gap(o.get("gap_to_leader"))}, t)

        elif topic == "v1/laps":
            for o in oggetti:
                t = parse_data(o.get("date_start")) \
                    or parse_data(o.get("date"))
                giro = formatta_giro(o.get("lap_duration"))
                if o.get("driver_number") is None or t is None \
                        or giro is None:
                    continue
                yield from applica(o["driver_number"],
                                   {"last_lap": giro}, t)

        elif topic == "v1/pit":
            # FASE 3: nessun evento da v1/pit. Il campo in_pit e' popolato
            # dal classificatore GEOMETRICO (inpit_geometrico, quando il
            # corridoio del circuito esiste); v1/pit resta nel grezzo come
            # arbitro a posteriori. La vecchia derivazione (true a date,
            # false a date+pit_duration) e' stata rimossa: arrivava a stop
            # concluso, mai tempo reale.
            pass

        elif topic == "v1/race_control":
            for o in oggetti:
                nuovo_stato = _mappa_race_control(o)
                t = parse_data(o.get("date"))
                if nuovo_stato is None or t is None:
                    continue
                if nuovo_stato != stato.track_status:
                    stato.track_status = nuovo_stato
                    yield {"type": "track_status", "t": _fmt(t),
                           "status": nuovo_stato}

        elif topic == "v1/sessions":
            # nessuna transizione di stato in OpenF1: solo info /status
            stato.sessione = oggetti[-1]

        # v1/car_data, v1/weather: registrati, nessun evento (non fanno
        # parte dell'interfaccia eventi di Fase 1)


def ordina_jsonl(paths):
    """Ordina i file JSONL per primo timestamp di ricezione."""
    from ingress_openf1 import leggi_jsonl

    def primo_ts(p):
        for _t, _p, ts in leggi_jsonl(p):
            if ts is not None:
                return ts
        return None

    con_ts = [(p, primo_ts(p)) for p in paths]
    return [p for p, ts in sorted(
        con_ts, key=lambda c: (c[1] is None, c[1] or 0, str(c[0])))]


def eventi_replay_openf1(paths, stato=None):
    """Replay di registrazioni JSONL OpenF1: stessi eventi del live
    (stessa mappatura, ordine d'arrivo preservato dal grezzo)."""
    from ingress_openf1 import leggi_jsonl

    def flusso():
        for path in ordina_jsonl(paths):
            log.info("replay OpenF1: %s", path)
            yield from leggi_jsonl(path)

    yield from eventi_da_openf1(flusso(), stato=stato)
