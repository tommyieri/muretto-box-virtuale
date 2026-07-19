#!/usr/bin/env python
"""Test locali dell'ingresso OpenF1 (senza rete, senza paho).

Uso:  .venv/bin/python live/collector/test_openf1.py
"""

import json
import sys
import tempfile
from datetime import datetime
from pathlib import Path

QUI = Path(__file__).resolve().parent
sys.path.insert(0, str(QUI.parent))
sys.path.insert(0, str(QUI))

from ingress_openf1 import (  # noqa: E402
    RegistratoreJSONL,
    leggi_env,
    leggi_jsonl,
)

_esiti = []


def caso(nome):
    def decoratore(fn):
        _esiti.append((nome, fn))
        return fn
    return decoratore


@caso("env: parsing KEY=VALUE, commenti e righe vuote ignorati")
def test_env():
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp) / "openf1.env"
        p.write_text("# commento\n\nOPENF1_USERNAME=user@example.com\n"
                     "OPENF1_PASSWORD=segreta=con=uguali\n")
        u, pw = leggi_env(p)
    assert u == "user@example.com", u
    assert pw == "segreta=con=uguali", pw
    assert leggi_env("/percorso/inesistente") == (None, None)


@caso("registratore JSONL: roundtrip scrittura -> lettura")
def test_jsonl_roundtrip():
    with tempfile.TemporaryDirectory() as tmp:
        reg = RegistratoreJSONL(tmp)
        reg.scrivi("v1/location",
                   [{"driver_number": 1, "x": 100, "y": -200, "z": 3,
                     "date": "2026-07-25T13:00:00.100000+00:00"}],
                   "2026-07-25T13:00:01.000")
        reg.scrivi("v1/race_control",
                   {"flag": "RED", "date": "2026-07-25T13:00:02+00:00"},
                   "2026-07-25T13:00:02.500")
        percorso = reg.percorso
        reg.chiudi()
        letti = list(leggi_jsonl(percorso))
    assert len(letti) == 2, letti
    topic, payload, ts = letti[0]
    assert topic == "v1/location" and payload[0]["x"] == 100
    assert ts == datetime(2026, 7, 25, 13, 0, 1), ts
    assert letti[1][1]["flag"] == "RED"


@caso("registratore JSONL: righe rotte saltate, mai eccezioni")
def test_jsonl_robusto():
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp) / "rotto.jsonl"
        p.write_text(json.dumps({"t": "2026-07-25T13:00:01.000",
                                 "topic": "v1/laps", "payload": {}})
                     + "\nRIGA ROTTA {{{\n"
                     + '{"senza_topic": 1}\n')
        letti = list(leggi_jsonl(p))
    assert len(letti) == 1 and letti[0][0] == "v1/laps", letti


@caso("registratore JSONL: apertura pigra (nessun file senza messaggi)")
def test_apertura_pigra():
    with tempfile.TemporaryDirectory() as tmp:
        reg = RegistratoreJSONL(tmp)
        assert list(Path(tmp).iterdir()) == []
        reg.chiudi()
        assert list(Path(tmp).iterdir()) == []
        reg.scrivi("v1/pit", {}, "2026-07-25T13:00:00.000")
        assert len(list(Path(tmp).iterdir())) == 1
        reg.chiudi()


# ---------------------------------------------------------- mappatura

def _eventi(messaggi_):
    from mappa_openf1 import eventi_da_openf1
    return list(eventi_da_openf1(iter(messaggi_)))


@caso("mappa: location raggruppate per date, (0,0,0) filtrato, extra_cars")
def test_mappa_location():
    eventi = _eventi([
        ("v1/drivers", [{"driver_number": 1, "name_acronym": "NOR"},
                        {"driver_number": 44, "name_acronym": "HAM"}], None),
        ("v1/location", [
            {"driver_number": 1, "x": 100, "y": 200, "z": 1,
             "date": "2026-07-25T13:00:01+00:00"},
            {"driver_number": 44, "x": 0, "y": 0, "z": 0,
             "date": "2026-07-25T13:00:01+00:00"},
            {"driver_number": 242, "x": 300, "y": 300, "z": 1,
             "date": "2026-07-25T13:00:01+00:00"},
            {"driver_number": 1, "x": 110, "y": 210, "z": 1,
             "date": "2026-07-25T13:00:01.250000+00:00"},
        ], None),
    ])
    assert len(eventi) == 3, eventi
    dl, f1, f2 = eventi
    assert dl["type"] == "driver_list" and \
        dl["cars"]["1"]["sigla"] == "NOR", dl
    assert f1["type"] == "position_frame"
    assert f1["cars"] == {"1": {"x": 100, "y": 200}}, f1   # 44=(0,0,0) fuori
    assert f1["extra_cars"] == {"242": {"x": 300, "y": 300}}, f1
    assert f1["t"] == "2026-07-25T13:00:01.000Z", f1
    assert f2["cars"]["1"]["x"] == 110 and "extra_cars" not in f2, f2


@caso("mappa: timing_update solo campi cambiati; formati gap/last_lap")
def test_mappa_timing():
    eventi = _eventi([
        ("v1/position", {"driver_number": 4, "position": 3,
                         "date": "2026-07-25T13:00:01+00:00"}, None),
        ("v1/position", {"driver_number": 4, "position": 3,
                         "date": "2026-07-25T13:00:02+00:00"}, None),
        ("v1/intervals", {"driver_number": 4, "gap_to_leader": 1.5,
                          "date": "2026-07-25T13:00:03+00:00"}, None),
        ("v1/intervals", {"driver_number": 16, "gap_to_leader": None,
                          "date": "2026-07-25T13:00:03.500000+00:00"}, None),
        ("v1/laps", {"driver_number": 4, "lap_duration": 103.123,
                     "date_start": "2026-07-25T13:00:04+00:00"}, None),
    ])
    assert [e["type"] for e in eventi] == ["timing_update"] * 3, eventi
    assert eventi[0]["cars"] == {"4": {"pos": 3}}, eventi[0]
    assert eventi[1]["cars"] == {"4": {"gap": "+1.500"}}, eventi[1]
    assert eventi[2]["cars"] == {"4": {"last_lap": "1:43.123"}}, eventi[2]


@caso("mappa: v1/pit non emette eventi (in_pit e' del geometrico, Fase 3)")
def test_mappa_pit():
    eventi = _eventi([
        ("v1/pit", {"driver_number": 81, "pit_duration": 22.5,
                    "lap_number": 20,
                    "date": "2026-07-25T13:10:00+00:00"}, None),
    ])
    assert eventi == [], eventi


@caso("in_pit geometrico: K=3 consecutivi + isteresi, eventi intercalati")
def test_inpit_geometrico():
    from inpit_geometrico import ClassificatoreInPit, arricchisci_in_pit
    # corridoio sintetico: segmento orizzontale y=0, x in [0, 2000] dm
    corridoio = [[0, 0], [1000, 0], [2000, 0]]
    c = ClassificatoreInPit(corridoio, soglia_dm=50, k=3)
    # 2 campioni dentro non bastano, il terzo scatta
    assert c.aggiorna("4", 100, 10) is None
    assert c.aggiorna("4", 200, 10) is None
    assert c.aggiorna("4", 300, 10) is True
    # un campione fuori isolato non fa sfarfallare
    assert c.aggiorna("4", 400, 500) is None
    assert c.aggiorna("4", 500, 10) is None
    assert c.stato("4") is True
    # tre fuori consecutivi -> esce
    assert c.aggiorna("4", 600, 500) is None
    assert c.aggiorna("4", 700, 500) is None
    assert c.aggiorna("4", 800, 500) is False

    def frame(t, x, y):
        return {"type": "position_frame", "t": t,
                "cars": {"4": {"x": x, "y": y}}}
    c2 = ClassificatoreInPit(corridoio, soglia_dm=50, k=3)
    eventi = list(arricchisci_in_pit(iter([
        frame("T1", 100, 10), frame("T2", 200, 10),
        frame("T3", 300, 10)]), c2))
    assert [e["type"] for e in eventi] == [
        "position_frame"] * 3 + ["timing_update"], eventi
    assert eventi[-1] == {"type": "timing_update", "t": "T3",
                          "cars": {"4": {"in_pit": True}}}, eventi[-1]


@caso("mappa: race_control track-wide -> track_status, settore ignorato")
def test_mappa_race_control():
    eventi = _eventi([
        ("v1/race_control", {"category": "Flag", "flag": "GREEN",
                             "scope": "Track",
                             "date": "2026-07-25T13:00:00+00:00"}, None),
        ("v1/race_control", {"category": "Flag", "flag": "YELLOW",
                             "scope": "Sector", "sector": 7,
                             "date": "2026-07-25T13:01:00+00:00"}, None),
        ("v1/race_control", {"category": "SafetyCar", "flag": None,
                             "message": "SAFETY CAR DEPLOYED",
                             "date": "2026-07-25T13:02:00+00:00"}, None),
        ("v1/race_control", {"category": "Flag", "flag": "CLEAR",
                             "scope": "Track",
                             "date": "2026-07-25T13:05:00+00:00"}, None),
    ])
    assert [(e["type"], e["status"]) for e in eventi] == [
        ("track_status", "AllClear"),
        ("track_status", "SCDeployed"),
        ("track_status", "AllClear")], eventi


@caso("mappa: deduplica per _id monotono per topic")
def test_mappa_dedup_id():
    eventi = _eventi([
        ("v1/position", {"_id": 10, "driver_number": 4, "position": 3,
                         "date": "2026-07-25T13:00:01+00:00"}, None),
        ("v1/position", {"_id": 10, "driver_number": 4, "position": 5,
                         "date": "2026-07-25T13:00:01+00:00"}, None),
        ("v1/position", {"_id": 11, "driver_number": 4, "position": 2,
                         "date": "2026-07-25T13:00:02+00:00"}, None),
    ])
    assert [e["cars"]["4"]["pos"] for e in eventi] == [3, 2], eventi


# ------------------------------------------------------------------ e2e

def _fixture_jsonl(tmp):
    from ingress_openf1 import RegistratoreJSONL
    reg = RegistratoreJSONL(tmp)
    reg.scrivi("v1/drivers",
               [{"driver_number": 1, "name_acronym": "NOR"}],
               "2026-07-25T12:59:59.000")
    reg.scrivi("v1/location",
               [{"driver_number": 1, "x": 100, "y": 200, "z": 1,
                 "date": "2026-07-25T13:00:01+00:00"},
                {"driver_number": 242, "x": 5, "y": 5, "z": 1,
                 "date": "2026-07-25T13:00:01+00:00"}],
               "2026-07-25T13:00:01.900")
    reg.scrivi("v1/position", {"driver_number": 1, "position": 1,
                               "date": "2026-07-25T13:00:02+00:00"},
               "2026-07-25T13:00:02.500")
    reg.scrivi("v1/race_control", {"category": "Flag", "flag": "RED",
                                   "date": "2026-07-25T13:00:10+00:00"},
               "2026-07-25T13:00:10.800")
    percorso = reg.percorso
    reg.chiudi()
    return percorso


@caso("e2e: collettore --replay JSONL = eventi dell'adapter, via WS")
def test_e2e_jsonl():
    import asyncio
    from mappa_openf1 import eventi_replay_openf1
    from test_collector import avvia_collettore, porte_libere, \
        raccogli_eventi
    with tempfile.TemporaryDirectory() as tmp:
        f = _fixture_jsonl(tmp)
        attesi = list(eventi_replay_openf1([f]))
        ws_port, status_port = porte_libere()
        proc = avvia_collettore([f], ws_port, status_port)
        try:
            import urllib.request
            stato = json.loads(urllib.request.urlopen(
                f"http://127.0.0.1:{status_port}/status", timeout=5).read())
            snapshot, eventi = asyncio.run(raccogli_eventi(ws_port))
        finally:
            proc.wait(timeout=30)
    assert stato["ingress"] == "openf1", stato
    assert eventi == attesi, (eventi, attesi)
    assert snapshot["type"] == "snapshot"
    frame = next(e for e in eventi if e["type"] == "position_frame")
    assert frame["extra_cars"] == {"242": {"x": 5, "y": 5}}, frame
    assert eventi[-1] == {"type": "track_status",
                          "t": "2026-07-25T13:00:10.000Z",
                          "status": "Red"}, eventi[-1]


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
