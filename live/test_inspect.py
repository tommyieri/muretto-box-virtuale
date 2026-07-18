#!/usr/bin/env python
"""Test minimo di inspect_recording.py su una fixture sintetica.

Costruisce un file di 4 righe nel formato grezzo del SignalRClient
(inclusa una Position.z ottenuta comprimendo un JSON noto) e verifica
che l'analisi riporti conteggi, gap e decodifica esatti.
"""

import base64
import json
import sys
import tempfile
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from inspect_recording import analizza  # noqa: E402

POSIZIONE_NOTA = {
    "Position": [{
        "Timestamp": "2026-07-16T12:00:02.0000000Z",
        "Entries": {
            "1": {"Status": "OnTrack", "X": 1234, "Y": -567, "Z": 89},
        },
    }],
}


def comprimi_z(obj) -> str:
    comp = zlib.compressobj(wbits=-zlib.MAX_WBITS)
    grezzo = comp.compress(json.dumps(obj).encode()) + comp.flush()
    return base64.b64encode(grezzo).decode()


def scrivi_fixture(path: Path):
    righe = [
        ["Heartbeat", {"Utc": "2026-07-16T12:00:00.000Z"},
         "2026-07-16T12:00:00.000Z"],
        ["TimingData", {"Lines": {"1": {"LastLapTime": {"Value": "1:30.000"}}}},
         "2026-07-16T12:00:01.000Z"],
        ["Position.z", comprimi_z(POSIZIONE_NOTA),
         "2026-07-16T12:00:02.000Z"],
        ["TimingData", {"Lines": {"1": {"Position": "3"}}},
         "2026-07-16T12:00:20.000Z"],
    ]
    path.write_text("\n".join(str(r) for r in righe) + "\n", encoding="utf-8")


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        fixture = Path(tmp) / "fixture_live.txt"
        scrivi_fixture(fixture)
        r = analizza(fixture)

    attesi = {"Heartbeat": 1, "TimingData": 2, "Position.z": 1}
    assert r["conteggi"] == attesi, r["conteggi"]
    assert r["righe_illeggibili"] == 0, r["righe_illeggibili"]

    assert r["esempi_z"]["Position.z"] == POSIZIONE_NOTA, r["esempi_z"]
    assert r["errori_z"] == {}, r["errori_z"]

    assert str(r["primo_ts"]) == "2026-07-16 12:00:00", r["primo_ts"]
    assert str(r["ultimo_ts"]) == "2026-07-16 12:00:20", r["ultimo_ts"]
    assert r["durata_s"] == 20.0, r["durata_s"]

    assert len(r["gaps"]) == 1, r["gaps"]
    assert r["gaps"][0][2] == 18.0, r["gaps"]

    freq = r["frequenze_z"]["Position.z"]
    assert abs(freq - 1 / 20.0) < 1e-12, freq

    print("OK — test_inspect: conteggi, decodifica .z, timestamp e gap esatti")
    return 0


if __name__ == "__main__":
    sys.exit(main())
