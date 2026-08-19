#!/usr/bin/env python3
"""tts_synthesizer.py — Synthesizes voiceover with word-level alignment for Remotion.

Uses ElevenLabs API (eleven_turbo_v2_5 / Adam / George) if ELEVENLABS_API_KEY is set.
Includes a deterministic fallback synthesizer with word-timing calculation when offline.
"""
from __future__ import annotations
import os
import json
import urllib.request
import urllib.error

QUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(QUI, "..", "..", ".."))
DEFAULT_AUDIO_DIR = os.path.join(REPO, "mave-pipeline", "remotion", "public", "audio")

ELEVENLABS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps"
# Default voice: "pNInz6obpgDQGcFmaJgB" (Adam - Analytical / Broadcast English)
VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "pNInz6obpgDQGcFmaJgB")


def synthesize_voiceover(text: str, out_dir: str = DEFAULT_AUDIO_DIR, duration_s: float = 25.0) -> dict:
    os.makedirs(out_dir, exist_ok=True)
    api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()

    mp3_path = os.path.join(out_dir, "voiceover.mp3")
    align_path = os.path.join(out_dir, "alignment.json")

    if api_key:
        try:
            url = ELEVENLABS_URL.format(voice_id=VOICE_ID)
            payload = {
                "text": text,
                "model_id": "eleven_turbo_v2_5",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.8,
                    "style": 0.2,
                }
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "xi-api-key": api_key,
                }
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            import base64
            audio_bytes = base64.b64decode(data.get("audio_base64", ""))
            with open(mp3_path, "wb") as f:
                f.write(audio_bytes)

            alignment = data.get("alignment", {})
            json.dump(alignment, open(align_path, "w", encoding="utf-8"), indent=2)
            print(f"[tts] Successfully synthesized ElevenLabs audio ({len(audio_bytes)} bytes)")
            return {"audio": mp3_path, "alignment": align_path, "mode": "elevenlabs"}

        except Exception as e:
            print(f"[tts] ElevenLabs API call failed ({e}). Using offline alignment generator...")

    # Offline / Fallback alignment calculation
    alignment_data = _generate_offline_alignment(text, duration_s)
    json.dump(alignment_data, open(align_path, "w", encoding="utf-8"), indent=2)

    # Generate a silent or tone MP4/MP3 carrier file if missing
    if not os.path.exists(mp3_path):
        _create_dummy_mp3(mp3_path, duration_s)

    return {"audio": mp3_path, "alignment": align_path, "mode": "fallback"}


def _generate_offline_alignment(text: str, duration_s: float) -> dict:
    """Generates word-level timestamps linearly distributed over duration."""
    words = text.split()
    total_words = len(words)
    if not total_words:
        return {"words": []}

    time_per_word = (duration_s * 0.92) / total_words

    alignment_words = []
    cur_time = 0.4
    for w in words:
        alignment_words.append({
            "word": w,
            "start": round(cur_time, 3),
            "end": round(cur_time + time_per_word * 0.9, 3),
        })
        cur_time += time_per_word

    return {
        "text": text,
        "words": alignment_words,
        "duration": duration_s,
    }


def _create_dummy_mp3(out_path: str, duration_s: float):
    import subprocess
    import shutil
    exe = shutil.which("ffmpeg")
    if exe:
        cmd = [
            exe, "-y", "-f", "lavfi",
            "-i", f"anullsrc=r=44100:cl=mono",
            "-t", str(duration_s),
            "-q:a", "9",
            "-acodec", "libmp3lame",
            out_path
        ]
        subprocess.run(cmd, capture_output=True)
    else:
        open(out_path, "wb").write(b"")


if __name__ == "__main__":
    sample_text = "Forty-three milliseconds decided pole position today. Telemetry shows it was won in two distinct braking zones."
    res = synthesize_voiceover(sample_text, duration_s=6.0)
    print("[tts] Alignment created:", res)
