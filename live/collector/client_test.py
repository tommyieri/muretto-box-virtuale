#!/usr/bin/env python
"""Client di test del collettore: salva gli eventi ricevuti in JSONL.

Ogni riga: {"ricevuto_utc": <iso>, "evento": {...}} — serve alla
validazione del weekend (KPI 3 coerenza eventi, KPI 4 latenza: differenza
tra timestamp evento e ricezione).

Uso:  .venv/bin/python live/collector/client_test.py ws://HOST:8765 \
          --out eventi_client.jsonl
"""

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone


async def raccogli(url, out):
    import websockets
    n = 0
    async with websockets.connect(url, max_size=2**23) as ws:
        with open(out, "w", encoding="utf-8") as f:
            try:
                while True:
                    msg = await ws.recv()
                    f.write(json.dumps({
                        "ricevuto_utc": datetime.now(
                            timezone.utc).isoformat(timespec="milliseconds"),
                        "evento": json.loads(msg)}, ensure_ascii=False)
                        + "\n")
                    n += 1
                    if n % 1000 == 0:
                        f.flush()
                        print(f"{n} eventi...", file=sys.stderr)
            except Exception as e:
                print(f"chiuso dopo {n} eventi: {e!r}", file=sys.stderr)
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url", help="es. ws://167.233.236.186:8765")
    ap.add_argument("--out", default="eventi_client.jsonl")
    args = ap.parse_args()
    n = asyncio.run(raccogli(args.url, args.out))
    print(f"{n} eventi salvati in {args.out}")


if __name__ == "__main__":
    main()
