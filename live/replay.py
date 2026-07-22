#!/usr/bin/env python
"""Motore replay: da registrazioni grezze a flusso di eventi JSON ordinato.

Legge una o piu' registrazioni (parti multiple in ordine cronologico, con
gestione dell'overlap), le decodifica con decoder.py e riemette lo stato come
eventi in ordine di tempo, a velocita' configurabile.

Interfaccia di uscita (in Fase 2 sara' alimentata dal collettore live: il
consumatore non deve poter distinguere replay da live):

  {"type": "position_frame",  "t": <utc>, "cars": {"<num>": {"x": int,
      "y": int, "status": str}}}          # solo auto con posizione valida
  {"type": "timing_update",   "t": <utc>, "cars": {"<num>": {"pos": int,
      "gap": str, "in_pit": bool, "last_lap": str|null}}}  # solo campi cambiati
  {"type": "track_status",    "t": <utc>, "status": str}
  {"type": "session_status",  "t": <utc>, "status": str}
  {"type": "driver_list",     "t": <utc>, "cars": {"<num>": {"sigla": str,
      "colore": "#RRGGBB"|null}}}        # solo voci nuove/cambiate (Fase 3)

API Python: eventi_replay(paths) e' un generatore che yielda gli eventi
(sara' consumato dal WebSocket in Fase 2). CLI: scrive JSONL su --out o
--stdout, con --speed 1 / 10 / max.

Solo libreria standard; nessun import dal kernel.
"""

import argparse
import json
import logging
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from decoder import (  # noqa: E402
    StatisticheDecoder,
    StatoSessione,
    campioni_posizione,
    messaggi,
)
from inspect_recording import parse_timestamp  # noqa: E402

log = logging.getLogger("replay")

CAMPI_TIMING = ("pos", "gap", "in_pit", "last_lap",
                "best_lap", "interval", "sectors", "micro",
                "compound", "tyre_age",   # Fase C: stint gomma (SignalR)
                # il muretto in live: giro per-pilota e gap in SECONDI (22/07/2026).
                # Senza questi il flusso disegna una classifica ma non simula niente.
                "lap", "gap_s", "interval_s", "pit_stops", "retired")


def _vista_driver(stato, auto):
    d = stato.driver_list.get(str(auto), {})
    colore = d.get("TeamColour")
    return {"sigla": d.get("Tla"),
            "colore": ("#" + colore) if colore else None,
            # la squadra: il pannello scompone il pit-loss in "pista" e "squadra",
            # e senza questo campo la seconda meta' non e' calcolabile in live
            "team": d.get("TeamName")}


def _fmt(ts):
    return ts.isoformat(timespec="milliseconds") + "Z" if ts else None


def _primo_timestamp(path):
    """Primo timestamp di busta di un file (per l'ordinamento delle parti)."""
    for _topic, _payload, ts in messaggi(path):
        if ts is not None:
            return ts
    return None


def ordina_parti(paths):
    """Ordina i file per primo timestamp (i file senza timestamp in coda)."""
    con_ts = [(p, _primo_timestamp(p)) for p in paths]
    return [p for p, ts in sorted(
        con_ts, key=lambda c: (c[1] is None, c[1] or 0, str(c[0])))]


MARGINE_RIORDINO_S = 5.0  # jitter massimo atteso fra timestamp busta/interni


def eventi_da_messaggi(flusso, stato=None):
    """Generatore degli eventi dal flusso (topic, payload, ts), in ordine
    di tempo. E' il cuore condiviso di replay e collettore live (Fase 2):
    stessa trasformazione, stessi eventi.

    Ordine di tempo garantito con un buffer di riordino (min-heap): i
    timestamp interni dei Position.z restano leggermente indietro rispetto
    alle buste degli altri topic, quindi un evento esce solo quando il flusso
    ha superato il suo timestamp di MARGINE_RIORDINO_S.

    Parti multiple: i frame posizione con timestamp non successivo
    all'ultimo frame gia' accodato (overlap alla riconnessione) vengono
    scartati; i delta TimingData dell'overlap sono innocui (il diff
    sopprime i campi invariati). Gli eventi generati dallo snapshot
    iniziale (senza timestamp) escono al primo timestamp utile.

    Politica trasponder extra (FASE2_PREREG): a DriverList nota, le auto
    non in DriverList (es. 242 = safety car) escono dal campo `cars` dei
    position_frame e finiscono in `extra_cars`; senza DriverList nessun
    filtro. Mai nella classifica (i timing_update restano per-pilota).
    """
    import heapq

    if stato is None:
        stato = StatoSessione()

    heap = []             # (ts, seq, evento) in attesa di maturare
    seq = 0               # spareggio per timestamp uguali (ordine d'arrivo)
    ts_massimo = None     # massimo timestamp visto nel flusso
    in_sospeso = []       # eventi da snapshot, in attesa del primo ts
    ts_frame_max = None   # watermark dei frame posizione (dedup overlap)

    def spingi(evento, ts):
        nonlocal seq, ts_massimo
        if ts is None:
            in_sospeso.append(evento)
            return []
        while in_sospeso:
            e = in_sospeso.pop(0)
            e["t"] = _fmt(ts)
            heapq.heappush(heap, (ts, seq, e))
            seq += 1
        evento["t"] = _fmt(ts)
        heapq.heappush(heap, (ts, seq, evento))
        seq += 1
        if ts_massimo is None or ts > ts_massimo:
            ts_massimo = ts
        maturi = []
        while heap and (ts_massimo - heap[0][0]).total_seconds() \
                >= MARGINE_RIORDINO_S:
            maturi.append(heapq.heappop(heap)[2])
        return maturi

    def evento_frame(auto_xy):
        if stato.driver_list:
            noti = {a: c for a, c in auto_xy.items()
                    if a in stato.driver_list}
            extra = {a: c for a, c in auto_xy.items()
                     if a not in stato.driver_list}
            evento = {"type": "position_frame", "cars": noti}
            if extra:
                evento["extra_cars"] = extra
            return evento
        return {"type": "position_frame", "cars": auto_xy}

    for topic, payload, ts in flusso:
        if topic == "Position.z":
            frames = {}
            for c in campioni_posizione(payload):
                frames.setdefault(c.t, {})[c.auto] = {
                    "x": c.x, "y": c.y, "status": c.status}
            for t_frame in sorted(frames, key=lambda t: (t is None, t)):
                if t_frame is not None:
                    if ts_frame_max is not None \
                            and t_frame <= ts_frame_max:
                        continue  # overlap fra parti: frame gia' coperto
                    ts_frame_max = t_frame
                for e in spingi(evento_frame(frames[t_frame]), t_frame):
                    yield e

        elif topic in ("TimingData", "TimingAppData"):
            # TimingAppData porta gli stint gomma (Fase C): stesso percorso di
            # diff di TimingData -> timing_update coi campi compound/tyre_age.
            auto_toccate = list(payload.get("Lines", {}).keys())
            prima = {a: stato.vista_pilota(a) for a in auto_toccate}
            stato.aggiorna(topic, payload, ts)
            cambi = {}
            for a in auto_toccate:
                dopo = stato.vista_pilota(a)
                diff = {k: dopo[k] for k in CAMPI_TIMING
                        if dopo[k] != prima[a][k]}
                if diff:
                    cambi[str(a)] = diff
            if cambi:
                for e in spingi({"type": "timing_update",
                                 "cars": cambi}, ts):
                    yield e

        elif topic == "DriverList":
            toccate = [a for a in payload
                       if isinstance(payload.get(a), dict)]
            prima = {a: _vista_driver(stato, a) for a in toccate}
            stato.aggiorna(topic, payload, ts)
            cambi = {}
            for a in toccate:
                dopo = _vista_driver(stato, a)
                if dopo != prima[a] and (dopo["sigla"] or dopo["colore"]
                                         or dopo["team"]):
                    cambi[str(a)] = dopo
            if cambi:
                for e in spingi({"type": "driver_list",
                                 "cars": cambi}, ts):
                    yield e

        elif topic == "TrackStatus":
            precedente = stato.track_status
            stato.aggiorna(topic, payload, ts)
            if stato.track_status != precedente:
                for e in spingi({"type": "track_status",
                                 "status": stato.track_status}, ts):
                    yield e

        elif topic == "LapCount":
            # giro di gara e distanza. Il feed lo manda a ogni giro; TotalLaps
            # solo nel primo messaggio (e' un delta), quindi lo si tiene nello
            # stato e si ripete: chi si collega a meta' gara deve saperlo.
            stato.aggiorna(topic, payload, ts)
            n = stato.lap_count.get("CurrentLap")
            tot = stato.lap_count.get("TotalLaps")
            if n is not None:
                for e in spingi({"type": "lap_count", "giro": n,
                                 "giri_totali": tot}, ts):
                    yield e

        elif topic == "SessionStatus":
            precedente = stato.session_status
            stato.aggiorna(topic, payload, ts)
            if stato.session_status != precedente:
                for e in spingi({"type": "session_status",
                                 "status": stato.session_status}, ts):
                    yield e

        else:
            stato.aggiorna(topic, payload, ts)

    # fine flusso: svuota il buffer di riordino in ordine di tempo
    import heapq as _hq
    while heap:
        yield _hq.heappop(heap)[2]


def eventi_replay(paths, stato=None, stats=None):
    """Eventi di replay da uno o piu' file registrati (interfaccia Fase 1:
    parti multiple ordinate cronologicamente, dedup sull'overlap)."""
    if stats is None:
        stats = StatisticheDecoder()

    def flusso():
        for path in ordina_parti(paths):
            log.info("replay parte: %s", path)
            yield from messaggi(path, stats)

    yield from eventi_da_messaggi(flusso(), stato=stato)


def _scorri_a_velocita(eventi, speed):
    """Riemette gli eventi dormendo secondo i delta di tempo reali/speed."""
    precedente = None
    for evento in eventi:
        t = parse_timestamp((evento.get("t") or "").rstrip("Z") + "Z"
                            if evento.get("t") else "")
        if precedente is not None and t is not None:
            attesa = (t - precedente).total_seconds() / speed
            if attesa > 0:
                time.sleep(attesa)
        if t is not None:
            precedente = t
        yield evento


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Replay di registrazioni live timing come eventi JSONL.")
    parser.add_argument("file", nargs="+", help="registrazioni (parti)")
    parser.add_argument("--speed", default="max",
                        help="1, 10, ... oppure 'max' (default: max)")
    parser.add_argument("--out", help="scrive gli eventi su file JSONL")
    parser.add_argument("--stdout", action="store_true",
                        help="scrive gli eventi su stdout")
    args = parser.parse_args()

    if not args.out and not args.stdout:
        parser.error("serve --out FILE oppure --stdout")

    logging.basicConfig(format="%(asctime)s - %(levelname)s: %(message)s",
                        level=logging.INFO)

    stats = StatisticheDecoder()
    eventi = eventi_replay([Path(f) for f in args.file], stats=stats)
    if args.speed != "max":
        eventi = _scorri_a_velocita(eventi, float(args.speed))

    conteggi = {}
    uscita = open(args.out, "w", encoding="utf-8") if args.out else sys.stdout
    try:
        for evento in eventi:
            conteggi[evento["type"]] = conteggi.get(evento["type"], 0) + 1
            uscita.write(json.dumps(evento, ensure_ascii=False) + "\n")
    finally:
        if args.out:
            uscita.close()

    log.info("eventi emessi: %s | righe: %d ok, %d errore",
             conteggi, stats.righe_ok, stats.righe_errore)
    return 0


if __name__ == "__main__":
    sys.exit(main())
