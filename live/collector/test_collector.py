#!/usr/bin/env python
"""Test locali del collettore (Fase 2) — modalita' --replay.

1. Fixture sintetica (DriverList + trasponder 242): snapshot alla
   connessione, politica extra_cars (FASE2_PREREG), /status ben formato,
   eventi WS identici a eventi_replay sul medesimo file.
2. End-to-end FP2: il daemon in --replay --speed max serve via WebSocket
   eventi IDENTICI al replay diretto (skip esplicito se FP2 non su disco).

Uso:  .venv/bin/python live/collector/test_collector.py
"""

import asyncio
import json
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

QUI = Path(__file__).resolve().parent
sys.path.insert(0, str(QUI.parent))
from replay import eventi_replay  # noqa: E402
from test_fase1 import FP2, comprimi_z  # noqa: E402

PYTHON = sys.executable

_esiti = []


def caso(nome):
    def decoratore(fn):
        _esiti.append((nome, fn))
        return fn
    return decoratore


def porte_libere(n=2):
    porte = []
    prese = []
    for _ in range(n):
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        prese.append(s)
        porte.append(s.getsockname()[1])
    for s in prese:
        s.close()
    return porte


def avvia_collettore(replay_files, ws_port, status_port, exit_al_termine=True):
    flags = ["--exit-al-termine"] if exit_al_termine else []
    proc = subprocess.Popen(
        [PYTHON, str(QUI / "collector.py"),
         "--replay", *[str(f) for f in replay_files],
         "--speed", "max", "--buffer", "0",
         "--ws-port", str(ws_port), "--status-port", str(status_port),
         "--attendi-primo-client", *flags,
         "--out-dir", tempfile.mkdtemp()],
        cwd=QUI.parent.parent,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    # attesa che il WS accetti connessioni
    for _ in range(100):
        try:
            with socket.create_connection(("127.0.0.1", ws_port),
                                          timeout=0.2):
                return proc
        except OSError:
            if proc.poll() is not None:
                raise RuntimeError("collettore morto in avvio")
            time.sleep(0.1)
    proc.kill()
    raise RuntimeError("WS mai in ascolto")


async def raccogli_eventi(ws_port):
    """Si connette, riceve fino a chiusura: (snapshot, eventi)."""
    import websockets
    eventi = []
    snapshot = None
    async with websockets.connect(
            f"ws://127.0.0.1:{ws_port}", max_size=2**23,
            open_timeout=30, close_timeout=30) as ws:
        try:
            while True:
                msg = json.loads(await asyncio.wait_for(ws.recv(), 120))
                if snapshot is None:
                    assert msg["type"] == "snapshot", msg["type"]
                    snapshot = msg
                else:
                    eventi.append(msg)
        except Exception:
            pass
    return snapshot, eventi


def fixture_242(tmp):
    """Registrazione sintetica: DriverList {1,44} + frame con 242."""
    z = comprimi_z({"Position": [{
        "Timestamp": "2026-07-19T13:00:01.0000000Z",
        "Entries": {
            "1": {"Status": "OnTrack", "X": 100, "Y": 100, "Z": 1},
            "44": {"Status": "OnTrack", "X": 200, "Y": 200, "Z": 1},
            "242": {"Status": "OnTrack", "X": 300, "Y": 300, "Z": 1},
        }}]})
    righe = [
        ["DriverList", json.dumps({"1": {"Tla": "NOR"},
                                   "44": {"Tla": "HAM"}}), ""],
        ["SessionStatus", {"Status": "Started"},
         "2026-07-19T13:00:00.000Z"],
        ["Position.z", z, "2026-07-19T13:00:01.100Z"],
        ["TimingData", {"Lines": {"44": {"Position": "1"}}},
         "2026-07-19T13:00:02.000Z"],
        ["TrackStatus", {"Status": "2", "Message": "Yellow"},
         "2026-07-19T13:00:10.000Z"],
    ]
    f = Path(tmp) / "fixture_242.txt"
    f.write_text("\n".join(str(r) for r in righe) + "\n", encoding="utf-8")
    return f


@caso("fixture 242: snapshot, extra_cars, /status, identita' col replay")
def test_fixture_242():
    with tempfile.TemporaryDirectory() as tmp:
        f = fixture_242(tmp)
        attesi = list(eventi_replay([f]))
        ws_port, status_port = porte_libere()
        proc = avvia_collettore([f], ws_port, status_port)
        try:
            stato = json.loads(urllib.request.urlopen(
                f"http://127.0.0.1:{status_port}/status", timeout=5).read())
            assert stato["modalita"] == "replay", stato
            assert "token" in stato and "disco" in stato, stato
            snapshot, eventi = asyncio.run(raccogli_eventi(ws_port))
        finally:
            proc.wait(timeout=30)

    assert eventi == attesi, (len(eventi), len(attesi))
    frame = next(e for e in eventi if e["type"] == "position_frame")
    assert set(frame["cars"]) == {"1", "44"}, frame
    assert set(frame.get("extra_cars", {})) == {"242"}, frame
    assert snapshot["type"] == "snapshot"
    assert snapshot["cars"] == {}, "snapshot iniziale vuoto (nessun evento"\
        " ancora servito)"


@caso("snapshot a meta' flusso: client tardivo riceve lo stato accumulato")
def test_snapshot_tardivo():
    with tempfile.TemporaryDirectory() as tmp:
        f = fixture_242(tmp)
        ws_port, status_port = porte_libere()
        proc = avvia_collettore([f], ws_port, status_port,
                                exit_al_termine=False)

        async def due_client():
            import websockets
            async with websockets.connect(
                    f"ws://127.0.0.1:{ws_port}", max_size=2**23) as ws1:
                s1 = json.loads(await ws1.recv())
                # consuma tutto il flusso del primo client
                try:
                    while True:
                        await asyncio.wait_for(ws1.recv(), timeout=2)
                except (asyncio.TimeoutError, Exception):
                    pass
                # secondo client a replay finito: snapshot pieno
                async with websockets.connect(
                        f"ws://127.0.0.1:{ws_port}", max_size=2**23) as ws2:
                    s2 = json.loads(await ws2.recv())
                return s1, s2

        try:
            s1, s2 = asyncio.run(due_client())
        finally:
            proc.kill()
            proc.wait(timeout=10)

    assert s1["cars"] == {}, s1
    assert s2["cars"].get("44", {}).get("pos") == 1, s2
    assert s2["cars"].get("1", {}).get("x") == 100, s2
    assert s2["extra_cars"].get("242", {}).get("x") == 300, s2
    assert s2["track_status"] == "Yellow", s2
    assert s2["session_status"] == "Started", s2


@caso("e2e FP2: eventi WS del collettore identici al replay diretto")
def test_e2e_fp2():
    if not FP2.is_file():
        print("SKIP (FP2 non su disco)", end=" ")
        return
    attesi = list(eventi_replay([FP2]))
    ws_port, status_port = porte_libere()
    proc = avvia_collettore([FP2], ws_port, status_port)
    try:
        snapshot, eventi = asyncio.run(raccogli_eventi(ws_port))
    finally:
        proc.wait(timeout=120)
    assert snapshot is not None
    assert len(eventi) == len(attesi), (len(eventi), len(attesi))
    diversi = sum(1 for a, b in zip(eventi, attesi) if a != b)
    assert diversi == 0, f"{diversi} eventi diversi"
    print(f"[{len(eventi)} eventi identici]", end=" ")


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
