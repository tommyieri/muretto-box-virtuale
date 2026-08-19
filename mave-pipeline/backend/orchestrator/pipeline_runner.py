#!/usr/bin/env python3
"""pipeline_runner.py — Master CLI Orchestrator for Muretto Automated Video Engine.

Usage:
  python3 pipeline_runner.py --session FP2 --circuit Zandvoort --year 2026
  python3 pipeline_runner.py --session QUALI --circuit Zandvoort --year 2026
  python3 pipeline_runner.py --session PRE_RACE --circuit Zandvoort --year 2026
  python3 pipeline_runner.py --session POST_RACE --circuit Zandvoort --year 2026
"""
from __future__ import annotations
import os
import sys
import json
import argparse
import subprocess

QUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(QUI, "..", "..", ".."))
PIPELINE_ROOT = os.path.abspath(os.path.join(QUI, "..", ".."))
REMOTION_DIR = os.path.join(PIPELINE_ROOT, "remotion")
REMOTION_DATA = os.path.join(REMOTION_DIR, "src", "data")
REMOTION_PUBLIC = os.path.join(REMOTION_DIR, "public")
OUT_DIR = os.path.join(PIPELINE_ROOT, "out")

from ..ingestion import fp2_race_pace, quali_forensics, race_strategy, sprint_engine
from . import script_generator, tts_synthesizer


def run_pipeline(session: str, circuit: str, year: int, render: bool = True) -> dict:
    os.makedirs(REMOTION_DATA, exist_ok=True)
    os.makedirs(os.path.join(REMOTION_PUBLIC, "audio"), exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)

    session_up = session.upper()
    is_sprint = sprint_engine.is_sprint_weekend(year, circuit)
    weekend_tag = "SPRINT WEEKEND" if is_sprint else "STANDARD WEEKEND"

    print(f"\n============================================================")
    print(f"🚀 MAVE PIPELINE START: {session_up} · {circuit} {year} [{weekend_tag}]")
    print(f"============================================================")

    # 1. INGESTION
    print(f"\n[1/4] Running Analytical Ingestion Engine...")
    if session_up in ("SPRINT_QUALI", "SPRINT_SHOOTOUT", "SQ"):
        payload = sprint_engine.analyze_sprint_shootout(year, circuit)
        composition_id = "QualiForensicsVideo"
    elif session_up in ("SPRINT", "SPRINT_RACE"):
        payload = sprint_engine.analyze_sprint_race(year, circuit)
        composition_id = "SprintRaceVideo"
    elif session_up in ("FP2", "FP2_LONG_RUN"):
        payload = fp2_race_pace.analyze_fp2(year, circuit)
        composition_id = "FP2RacePaceVideo"
    elif session_up in ("QUALI", "QUALIFYING", "QUALIFYING_FORENSICS"):
        from ..ingestion import telemetry_analysis
        payload = telemetry_analysis.analyze_qualifying_telemetry(year, circuit, "NOR", "HAM")
        composition_id = "QualiForensicsVideo"
    elif session_up in ("PRE_RACE", "STRATEGY_ALERT"):
        payload = race_strategy.analyze_strategy(year, circuit, "PRE_RACE_ALERT")
        composition_id = "PreRaceStrategyVideo"
    else:
        payload = race_strategy.analyze_strategy(year, circuit, "POST_RACE_AUTOPSY")
        composition_id = "RaceAutopsyVideo"

    payload_file = os.path.join(REMOTION_DATA, "session_payload.json")
    json.dump(payload, open(payload_file, "w", encoding="utf-8"), indent=2)
    print(f"      ✓ Ingested {payload['session_type']} -> {payload_file}")

    # 2. SCRIPT GENERATION
    print(f"\n[2/4] Generating Narration Script & UI Cue Points...")
    narration = script_generator.generate_narration(payload)
    script_file = os.path.join(REMOTION_DATA, "narration_script.json")
    json.dump(narration, open(script_file, "w", encoding="utf-8"), indent=2)
    print(f"      ✓ Script duration: {narration['duration_s']}s ({len(narration['script'].split())} words)")

    # 3. TTS SYNTHESIS & ALIGNMENT
    print(f"\n[3/4] Synthesizing Voiceover with Word Alignment...")
    tts_res = tts_synthesizer.synthesize_voiceover(
        narration["script"],
        out_dir=os.path.join(REMOTION_PUBLIC, "audio"),
        duration_s=narration["duration_s"]
    )
    print(f"      ✓ Audio mode: {tts_res['mode']} -> {tts_res['audio']}")

    # 4. REMOTION RENDER
    out_video = os.path.join(OUT_DIR, f"{session.lower()}_{circuit.lower()}_{year}.mp4")
    if render and os.path.exists(os.path.join(REMOTION_DIR, "node_modules")):
        print(f"\n[4/4] Rendering 9:16 Video (1080x1920 @ 60 FPS) via Remotion...")
        cmd = [
            "npx", "remotion", "render",
            composition_id,
            out_video,
            "--props", payload_file
        ]
        try:
            subprocess.run(cmd, cwd=REMOTION_DIR, check=True)
            print(f"      ✓ Render Complete: {out_video}")
        except Exception as e:
            print(f"      ⚠️ Remotion render execution failed ({e}). Composition is ready in {REMOTION_DIR}")
    else:
        print(f"\n[4/4] Remotion Assets Prepared in {REMOTION_DIR}. (Ready for render)")

    # 5. SOCIAL CAPTION
    template_path = os.path.join(QUI, "..", "templates", "social_captions.json")
    captions = json.load(open(template_path, encoding="utf-8"))
    cap_tpl = captions.get(payload["session_type"], {})

    print(f"\n============================================================")
    print(f"✨ MAVE PIPELINE COMPLETE")
    print(f"============================================================")
    print(f"Payload:     {payload_file}")
    print(f"Script:      {script_file}")
    print(f"Voiceover:   {tts_res['audio']}")
    print(f"Video Path:  {out_video}")
    print(f"============================================================\n")

    return {
        "payload": payload,
        "narration": narration,
        "tts": tts_res,
        "video": out_video,
        "caption_template": cap_tpl,
    }


def main():
    ap = argparse.ArgumentParser(description="MAVE Master Session Orchestrator")
    ap.add_argument("--session", default="QUALI", choices=["FP2", "QUALI", "PRE_RACE", "POST_RACE"])
    ap.add_argument("--circuit", default="Zandvoort")
    ap.add_argument("--year", type=int, default=2026)
    ap.add_argument("--no-render", action="store_true")
    args = ap.parse_args()

    run_pipeline(args.session, args.circuit, args.year, render=not args.no_render)


if __name__ == "__main__":
    main()
