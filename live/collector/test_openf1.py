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
