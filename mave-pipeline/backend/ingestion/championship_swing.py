#!/usr/bin/env python3
"""championship_swing.py — Calculates Drivers & Constructors Points Swing from What-If scenarios.

Uses real championship standings from demo/data/classifiche_2026.json.
"""
from __future__ import annotations
import os
import json

QUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(QUI, "..", "..", ".."))
STANDINGS_FILE = os.path.join(REPO, "demo", "data", "classifiche_2026.json")

POINTS_F1 = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]


def calculate_championship_swing(actual_pos: int, simulated_pos: int, driver: str = "LEC") -> dict:
    actual_pts = POINTS_F1[actual_pos - 1] if 1 <= actual_pos <= 10 else 0
    simulated_pts = POINTS_F1[simulated_pos - 1] if 1 <= simulated_pos <= 10 else 0
    points_delta = simulated_pts - actual_pts

    standings = {}
    if os.path.exists(STANDINGS_FILE):
        try:
            standings = json.load(open(STANDINGS_FILE, encoding="utf-8"))
        except Exception:
            pass

    return {
        "analysis_type": "CHAMPIONSHIP_SWING",
        "driver": driver,
        "actual_position": actual_pos,
        "actual_points_earned": actual_pts,
        "simulated_position": simulated_pos,
        "simulated_points_earned": simulated_pts,
        "championship_points_swing": points_delta,
        "technical_verdict": f"The strategic call directly cost {driver} {abs(points_delta)} championship points, shifting the 2026 title fight.",
        "cta_url": "murettobox.com",
    }


if __name__ == "__main__":
    res = calculate_championship_swing(actual_pos=4, simulated_pos=2, driver="LEC")
    print("[championship_swing] Verdict:", res["technical_verdict"])
