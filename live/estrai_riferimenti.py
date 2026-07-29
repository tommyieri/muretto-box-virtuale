#!/usr/bin/env python3
"""Estrazione UNA TANTUM dei riferimenti per la verifica Fase 1 (Spa).

ATTENZIONE: questo e' l'unico script del modulo live/ che usa FastF1 e va
lanciato col python3 UTENTE (fastf1+pandas2, NON la .venv del kernel), come i
generatori del sito (vedi SETUP_AMBIENTE.md). I JSON prodotti diventano input
statici per verify_alignment.py e kpi_fase1.py, che restano stdlib-only.

Produce in data/live_derived/:
  - spa_ref_track.json     polilinea del tracciato da UN giro pulito di
                           telemetria GPS del GP Belgio 2025 (stessa fonte e
                           stessi criteri di qualita' di gen_pista_svg.py),
                           coordinate GREZZE FastF1 (decimi di metro)
  - fp2_spa_2026_ufficiale.json  classifica ufficiale FP2 Spa 2026 da FastF1
                           results (arbitro gia' adottato dal progetto)

Uso:  python3 live/estrai_riferimenti.py [--out-dir data/live_derived]
"""

import argparse
import json
import os
from pathlib import Path

import fastf1

fastf1.Cache.enable_cache(os.path.expanduser("~/muretto_shared/ff1_cache"))

# criteri del giro pulito: identici a gen_pista_svg.py
MAX_GAP_S = 1.5
MAX_CHIUSURA_M = 60.0
MIN_CAMPIONI = 100
LUNGHEZZA_MIN_M, LUNGHEZZA_MAX_M = 3000.0, 8000.0


def lunghezza_m(xs, ys):
    return sum(((xs[i + 1] - xs[i]) ** 2 + (ys[i + 1] - ys[i]) ** 2) ** 0.5
               for i in range(len(xs) - 1)) / 10.0


def giro_pulito_2025():
    sess = fastf1.get_session(2025, "Belgium", "R")
    sess.load(telemetry=True, weather=False, messages=False)
    laps = sess.laps[sess.laps["LapTime"].notna()].copy()
    laps = laps.sort_values(
        ["IsAccurate", "LapTime", "DriverNumber", "LapNumber"],
        ascending=[False, True, True, True])
    for _, lap in laps.iterrows():
        try:
            pos = lap.get_pos_data()
        except Exception:
            continue
        pos = pos[pos["Status"] == "OnTrack"]
        if len(pos) < MIN_CAMPIONI:
            continue
        gaps = pos["Time"].diff().dt.total_seconds().iloc[1:]
        if len(gaps) and gaps.max() > MAX_GAP_S:
            continue
        xs, ys = pos["X"].tolist(), pos["Y"].tolist()
        chiusura = (((xs[0] - xs[-1]) ** 2
                     + (ys[0] - ys[-1]) ** 2) ** 0.5) / 10.0
        if chiusura > MAX_CHIUSURA_M:
            continue
        lung = lunghezza_m(xs, ys)
        if not (LUNGHEZZA_MIN_M <= lung <= LUNGHEZZA_MAX_M):
            continue
        return {
            "_nota": "polilinea GREZZA (decimi di metro), giro pulito GP "
                     "Belgio 2025 — criteri di gen_pista_svg.py",
            "sorgente": {
                "evento": str(sess.event["EventName"]) + " 2025",
                "sessione": "Race",
                "pilota": str(lap["Driver"]),
                "giro": int(lap["LapNumber"]),
                "lap_time_s": float(lap["LapTime"].total_seconds()),
            },
            "lunghezza_m": round(lung, 1),
            "punti": [[int(x), int(y)] for x, y in zip(xs, ys)],
        }
    raise RuntimeError("nessun giro 2025 passa i controlli di qualita'")


def classifica_fp2_2026():
    sess = fastf1.get_session(2026, "Belgium", "FP2")
    sess.load(laps=True, telemetry=False, weather=False, messages=False)
    res = sess.results
    per_auto = {}
    for _, riga in res.iterrows():
        num = str(riga["DriverNumber"])
        tempo = riga.get("Time")
        per_auto[num] = {
            "pos": int(riga["Position"]) if riga["Position"] == riga["Position"] else None,
            "sigla": str(riga["Abbreviation"]),
            "best_lap_s": (float(tempo.total_seconds())
                           if tempo == tempo and tempo is not None else None),
        }
    # fallback/controllo: best lap dai giri (stessa sessione, stessa fonte)
    for num, grp in sess.laps.groupby("DriverNumber"):
        best = grp["LapTime"].min()
        if num in per_auto and best == best:
            per_auto[str(num)]["best_lap_giri_s"] = float(best.total_seconds())
    return {"_nota": "classifica ufficiale FP2 Spa 2026 (FastF1 results; "
                     "best_lap_giri_s = min LapTime dai giri caricati)",
            "auto": per_auto}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="data/live_derived")
    args = ap.parse_args()
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)

    ref = giro_pulito_2025()
    (out / "spa_ref_track.json").write_text(
        json.dumps(ref), encoding="utf-8")
    print("spa_ref_track.json:", ref["sorgente"], ref["lunghezza_m"], "m,",
          len(ref["punti"]), "punti")

    cls = classifica_fp2_2026()
    (out / "fp2_spa_2026_ufficiale.json").write_text(
        json.dumps(cls, ensure_ascii=False, indent=1), encoding="utf-8")
    print("fp2_spa_2026_ufficiale.json:", len(cls["auto"]), "auto")


if __name__ == "__main__":
    main()
