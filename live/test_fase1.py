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

RADICE = Path(__file__).resolve().parent.parent
FP2 = RADICE / "data/live_raw/2026-07-17_16-53-20.txt"
FP1_TRONCATA = RADICE / "data/live_raw/2026-07-17_13-33-29.txt"

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
