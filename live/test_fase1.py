#!/usr/bin/env python
"""Test Fase 1 del modulo live: decoder, replay, robustezza.

Fixture sintetiche (nessuna dipendenza dai dati reali) + test end-to-end
sulle registrazioni FP1/FP2 di Spa 2026 se presenti su disco (altrimenti
i test end-to-end vengono saltati con messaggio esplicito).

Uso:  .venv/bin/python live/test_fase1.py
"""

import base64
import json
import sys
import tempfile
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from decoder import (  # noqa: E402
    StatisticheDecoder,
    StatoSessione,
    campioni_posizione,
    merge_delta,
    messaggi,
)

def _dato_grezzo(nome):
    """Le registrazioni sono input non tracciati: nel worktree possono non
    esserci, si ripiega sul checkout principale ~/muretto."""
    candidati = [Path(__file__).resolve().parent.parent / "data/live_raw",
                 Path.home() / "muretto/data/live_raw"]
    for cartella in candidati:
        if (cartella / nome).is_file():
            return cartella / nome
    return candidati[0] / nome  # non esiste: i test relativi fanno SKIP


FP2 = _dato_grezzo("2026-07-17_16-53-20.txt")
FP1_TRONCATA = _dato_grezzo("2026-07-17_13-33-29.txt")

_esiti = []


def caso(nome):
    def decoratore(fn):
        _esiti.append((nome, fn))
        return fn
    return decoratore


def comprimi_z(obj) -> str:
    comp = zlib.compressobj(wbits=-zlib.MAX_WBITS)
    grezzo = comp.compress(json.dumps(obj).encode()) + comp.flush()
    return base64.b64encode(grezzo).decode()


# ---------------------------------------------------------------- decoder

@caso("merge delta 1: chiavi presenti aggiornano, assenti persistono")
def test_merge_persistenza():
    stato = StatoSessione()
    stato.aggiorna("TimingData", {"Lines": {"4": {
        "Position": "3", "InPit": True, "NumberOfLaps": 5,
        "LastLapTime": {"Value": "1:45.000"}}}})
    stato.aggiorna("TimingData", {"Lines": {"4": {"Position": "2"}}})
    v = stato.vista_pilota("4")
    assert v["pos"] == 2, v
    assert v["in_pit"] is True, v          # persistito
    assert v["last_lap"] == "1:45.000", v  # persistito
    assert stato.numero_giri("4") == 5


@caso("merge delta 2: merge annidato dei dict (LastLapTime.Value)")
def test_merge_annidato():
    stato = StatoSessione()
    stato.aggiorna("TimingData", {"Lines": {"81": {
        "LastLapTime": {"Value": "1:46.100", "PersonalFastest": False}}}})
    stato.aggiorna("TimingData", {"Lines": {"81": {
        "LastLapTime": {"Value": "1:44.900"}}}})
    nodo = stato.piloti["81"]["LastLapTime"]
    assert nodo["Value"] == "1:44.900", nodo
    assert nodo["PersonalFastest"] is False, nodo  # persistito nel merge


@caso("merge delta 3: delta dict su lista (Sectors per indice)")
def test_merge_lista_per_indice():
    base = {"Sectors": [{"Value": "30.1"}, {"Value": ""}, {"Value": ""}]}
    merge_delta(base, {"Sectors": {"1": {"Value": "28.6"}}})
    assert base["Sectors"][1]["Value"] == "28.6", base
    assert base["Sectors"][0]["Value"] == "30.1", base


@caso("filtro (0,0,0): mai emesso come posizione valida")
def test_filtro_zero():
    payload = {"Position": [{
        "Timestamp": "2026-07-17T15:00:00.0000000Z",
        "Entries": {
            "1": {"Status": "OnTrack", "X": 0, "Y": 0, "Z": 0},
            "44": {"Status": "OnTrack", "X": 100, "Y": 200, "Z": 3},
            "63": {"Status": "OnTrack", "X": 0, "Y": 0, "Z": 7},
        }}]}
    campioni = list(campioni_posizione(payload))
    assert [c.auto for c in campioni] == ["44", "63"], campioni
    assert campioni[0].x == 100 and campioni[0].y == 200


@caso("decodifica .z bit-identica al JSON noto")
def test_z_bit_identica():
    noto = {"Position": [{"Timestamp": "2026-07-17T15:00:00.0000000Z",
                          "Entries": {"1": {"Status": "OnTrack",
                                            "X": 1, "Y": 2, "Z": 3}}}]}
    riga = str(["Position.z", comprimi_z(noto),
                "2026-07-17T15:00:00.000Z"]) + "\n"
    with tempfile.TemporaryDirectory() as tmp:
        f = Path(tmp) / "f.txt"
        f.write_text(riga)
        (topic, payload, ts), = list(messaggi(f))
    assert topic == "Position.z" and payload == noto, payload


@caso("righe illeggibili contate, mai crash")
def test_righe_illeggibili():
    contenuto = ("['TrackStatus', {'Status': '1', 'Message': 'AllClear'}, "
                 "'2026-07-17T15:00:00.000Z']\n"
                 "RIGA COMPLETAMENTE ROTTA [[[\n"
                 "['SessionStatus', {'Status': 'Started'}, '2026-07-17T15:0")
    with tempfile.TemporaryDirectory() as tmp:
        f = Path(tmp) / "f.txt"
        f.write_text(contenuto)
        stats = StatisticheDecoder()
        msg = list(messaggi(f, stats))
    assert len(msg) == 1 and msg[0][0] == "TrackStatus", msg
    assert stats.righe_errore == 2, stats.righe_errore


@caso("snapshot: payload JSON-stringa decodificato, ts assente tollerato")
def test_snapshot_stringa():
    riga = str(["TimingData", json.dumps(
        {"Lines": {"16": {"Position": "1"}}}), ""]) + "\n"
    with tempfile.TemporaryDirectory() as tmp:
        f = Path(tmp) / "f.txt"
        f.write_text(riga)
        (topic, payload, ts), = list(messaggi(f))
    assert payload == {"Lines": {"16": {"Position": "1"}}} and ts is None


# ----------------------------------------------------------------- replay

def _riga(topic, payload, ts):
    return str([topic, payload, ts])


def _fixture_parti(tmp):
    """Due parti con overlap: la parte 2 ricomincia prima della fine della 1."""
    z1 = comprimi_z({"Position": [
        {"Timestamp": "2026-07-17T15:00:00.0000000Z",
         "Entries": {"1": {"Status": "OnTrack", "X": 10, "Y": 10, "Z": 1}}},
        {"Timestamp": "2026-07-17T15:00:01.0000000Z",
         "Entries": {"1": {"Status": "OnTrack", "X": 20, "Y": 20, "Z": 1}}},
    ]})
    z2 = comprimi_z({"Position": [
        {"Timestamp": "2026-07-17T15:00:01.0000000Z",   # overlap: gia' visto
         "Entries": {"1": {"Status": "OnTrack", "X": 20, "Y": 20, "Z": 1}}},
        {"Timestamp": "2026-07-17T15:00:02.0000000Z",
         "Entries": {"1": {"Status": "OnTrack", "X": 30, "Y": 30, "Z": 1}}},
    ]})
    parte1 = Path(tmp) / "a.txt"
    parte2 = Path(tmp) / "b.txt"
    # nomi invertiti rispetto all'ordine cronologico: b.txt inizia prima
    parte2.write_text("\n".join([
        _riga("SessionStatus", {"Status": "Started"},
              "2026-07-17T15:00:00.000Z"),
        _riga("Position.z", z1, "2026-07-17T15:00:01.100Z"),
    ]) + "\n")
    parte1.write_text("\n".join([
        _riga("Position.z", z2, "2026-07-17T15:00:02.100Z"),
        _riga("TrackStatus", {"Status": "2", "Message": "Yellow"},
              "2026-07-17T15:00:03.000Z"),
    ]) + "\n")
    return [parte1, parte2]


@caso("replay: ordinamento cronologico multi-file con overlap")
def test_replay_multifile():
    from replay import eventi_replay
    with tempfile.TemporaryDirectory() as tmp:
        eventi = list(eventi_replay(_fixture_parti(tmp)))
    tempi = [e["t"] for e in eventi]
    assert tempi == sorted(tempi), tempi
    frames = [e for e in eventi if e["type"] == "position_frame"]
    # 4 campioni nelle due parti, 1 in overlap -> 3 frame emessi
    assert len(frames) == 3, frames
    assert [f["cars"]["1"]["x"] for f in frames] == [10, 20, 30], frames
    assert eventi[0]["type"] == "session_status", eventi[0]
    assert eventi[-1] == {"type": "track_status",
                          "t": "2026-07-17T15:00:03.000Z",
                          "status": "Yellow"}, eventi[-1]


@caso("replay: timing_update emette solo i campi cambiati")
def test_replay_diff():
    from replay import eventi_replay
    with tempfile.TemporaryDirectory() as tmp:
        f = Path(tmp) / "f.txt"
        f.write_text("\n".join([
            _riga("TimingData", {"Lines": {"4": {
                "Position": "3", "InPit": True,
                "TimeDiffToFastest": "+0.500"}}},
                  "2026-07-17T15:00:00.000Z"),
            _riga("TimingData", {"Lines": {"4": {"Position": "2"}}},
                  "2026-07-17T15:00:01.000Z"),
            _riga("TimingData", {"Lines": {"4": {"Position": "2"}}},
                  "2026-07-17T15:00:02.000Z"),   # nessun cambio -> no evento
        ]) + "\n")
        eventi = [e for e in eventi_replay([f]) if e["type"] == "timing_update"]
    assert len(eventi) == 2, eventi
    assert eventi[0]["cars"]["4"] == {"pos": 3, "gap": "+0.500",
                                      "in_pit": True}, eventi[0]
    assert eventi[1]["cars"]["4"] == {"pos": 2}, eventi[1]


@caso("e2e: replay --speed max dell'intera FP2, 4 tipi di evento > 0")
def test_e2e_fp2():
    if not FP2.is_file():
        print("SKIP (FP2 non su disco)", end=" ")
        return
    from decoder import StatisticheDecoder
    from replay import eventi_replay
    stats = StatisticheDecoder()
    conteggi = {}
    for e in eventi_replay([FP2], stats=stats):
        conteggi[e["type"]] = conteggi.get(e["type"], 0) + 1
    for tipo in ("position_frame", "timing_update",
                 "track_status", "session_status"):
        assert conteggi.get(tipo, 0) > 0, conteggi
    assert stats.righe_ok > 0
    print(f"[eventi: {conteggi}]", end=" ")


@caso("robustezza: replay del file FP1 troncato senza crash")
def test_fp1_troncata():
    if not FP1_TRONCATA.is_file():
        print("SKIP (FP1 non su disco)", end=" ")
        return
    from decoder import StatisticheDecoder
    from replay import eventi_replay
    stats = StatisticheDecoder()
    n = sum(1 for _ in eventi_replay([FP1_TRONCATA], stats=stats))
    assert n > 0
    print(f"[{n} eventi, {stats.righe_errore} righe illeggibili]", end=" ")


# ------------------------------------------------------------------ main

def main() -> int:
    falliti = 0
    for nome, fn in _esiti:
        try:
            fn()
            print(f"OK   {nome}")
        except AssertionError as e:
            falliti += 1
            print(f"FAIL {nome}: {e}")
        except Exception as e:
            falliti += 1
            print(f"ERR  {nome}: {e!r}")
    print(f"\n{len(_esiti) - falliti}/{len(_esiti)} casi passati")
    return 1 if falliti else 0


if __name__ == "__main__":
    sys.exit(main())
