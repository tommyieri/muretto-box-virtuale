#!/usr/bin/env python
"""Concordanza del classificatore in_pit GEOMETRICO con il verbale
Fase 1b: i 30 periodi InPit del timing SignalR nella gara di Spa 2026.

Metrica dichiarata (Fase 3, parte A): percentuale dei periodi InPit del
timing (finestra di gara, con dati GPS) durante i quali il classificatore
geometrico risulta in_pit — attesa >=90%. Riportati anche i periodi
geometrici SENZA riscontro nel timing (falsi positivi) e gli scarti
mediani ai bordi (ingresso/uscita).

Skip esplicito se la registrazione della gara non e' su disco.
Uso:  .venv/bin/python live/collector/test_inpit_spa.py
"""

import json
import statistics
import sys
from pathlib import Path

QUI = Path(__file__).resolve().parent
sys.path.insert(0, str(QUI.parent))
sys.path.insert(0, str(QUI))

from inpit_geometrico import ClassificatoreInPit  # noqa: E402
from inspect_recording import parse_timestamp  # noqa: E402
from replay import eventi_replay  # noqa: E402
from test_fase1 import _dato_grezzo  # noqa: E402

GARA = _dato_grezzo("2026-07-19_14-53-28.txt")
PITLANE = QUI.parent.parent / "data/live_derived/pitlane_spa.json"


def t_di(evento):
    return parse_timestamp((evento.get("t") or "").rstrip("Z") + "Z")


def intervalli_da_transizioni(transizioni, fine):
    """[(t, bool)] -> [(t0, t1)] dei tratti a True (aperti chiusi a fine)."""
    out, aperto = [], None
    for t, dentro in transizioni:
        if dentro and aperto is None:
            aperto = t
        elif not dentro and aperto is not None:
            out.append((aperto, t))
            aperto = None
    if aperto is not None:
        out.append((aperto, fine))
    return out


def sovrappone(a, b):
    return a[0] < b[1] and b[0] < a[1]


def main() -> int:
    if not GARA.is_file():
        print("SKIP: registrazione gara non su disco")
        return 0
    classif = ClassificatoreInPit.da_file(PITLANE)

    timing = {}       # auto -> [(t, bool)]
    geom = {}         # auto -> [(t, bool)]
    t_start = t_ultimo = None
    for e in eventi_replay([GARA]):
        t = t_di(e)
        if t is not None:
            t_ultimo = t
        if e["type"] == "session_status" and e["status"] == "Started" \
                and t_start is None:
            t_start = t
        elif e["type"] == "timing_update":
            for auto, diff in e["cars"].items():
                if "in_pit" in diff:
                    timing.setdefault(auto, []).append((t, diff["in_pit"]))
        elif e["type"] == "position_frame":
            for auto, xy in e["cars"].items():
                nuovo = classif.aggiorna(auto, xy["x"], xy["y"])
                if nuovo is not None:
                    geom.setdefault(auto, []).append((t, nuovo))

    per_timing = {a: intervalli_da_transizioni(v, t_ultimo)
                  for a, v in timing.items()}
    per_geom = {a: intervalli_da_transizioni(v, t_ultimo)
                for a, v in geom.items()}

    totali = concordi = 0
    delta_ingresso = []
    falsi_positivi = 0
    for auto, periodi in per_timing.items():
        for p in periodi:
            if not (t_start and p[0] and p[0] > t_start):
                continue          # griglia/pre-gara: fuori dal verbale
            totali += 1
            match = [g for g in per_geom.get(auto, []) if sovrappone(p, g)]
            if match:
                concordi += 1
                delta_ingresso.append(
                    abs((match[0][0] - p[0]).total_seconds()))
    for auto, periodi in per_geom.items():
        for g in periodi:
            if not (t_start and g[0] and g[0] > t_start):
                continue
            if not any(sovrappone(g, p) for p in per_timing.get(auto, [])):
                falsi_positivi += 1

    quota = concordi / totali if totali else 0.0
    print(f"periodi InPit timing (gara): {totali}")
    print(f"concordi col geometrico:     {concordi} ({100 * quota:.1f}%)")
    print(f"falsi positivi geometrici:   {falsi_positivi}")
    if delta_ingresso:
        print(f"scarto ingresso mediano:     "
              f"{statistics.median(delta_ingresso):.1f}s "
              f"(p95 {sorted(delta_ingresso)[int(0.95 * len(delta_ingresso))]:.1f}s)")
    assert totali >= 25, f"attesi ~30 periodi dal verbale, trovati {totali}"
    assert quota >= 0.90, f"concordanza {quota:.1%} sotto il 90%"
    print("\nOK — concordanza >=90% col verbale Fase 1b")
    return 0


if __name__ == "__main__":
    sys.exit(main())
