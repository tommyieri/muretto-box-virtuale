#!/usr/bin/env python
"""gen_tele.py — estrae la TELEMETRIA del giro veloce di ogni pilota da una
REGISTRAZIONE del collettore (path 3, R3). Autonomo: niente FastF1 (bloccato
sul VPS); la registrazione ha gia' il CarData del feed live, decodificato da
decoder.py. Funziona per il 2026 (a differenza di FastF1 per le practice/SQ).

Metodo (dichiarato): dal TimingData i completamenti-giro per pilota (quando
NumberOfLaps avanza; il tempo del giro e' LastLapTime); il giro piu' veloce
= min LastLapTime; la sua finestra temporale [fine - durata, fine]; i campioni
CarData in quella finestra sono la traccia (asse x = tempo dall'inizio giro).
Nessun dato inventato: un pilota senza giro cronometrato non entra.

Output: demo/data/tele_<gara>_<sess>.json
  {gara, sessione, piloti:{SIGLA:{num, best_lap, giro_s, punti:[t,v,thr,brk,gear]...}}}
Solo i canali reali del feed (velocita, throttle, freno, marcia, rpm).

Uso: python3 gen_tele.py REGISTRAZIONE --gara Belgio --sessione gara \
        --evento "GP del Belgio"
"""
import argparse
import json
import os
import sys

# decoder di Fase 1 (in live/)
_HERE = os.path.dirname(os.path.abspath(__file__))
for _p in (_HERE, os.path.join(_HERE, "live"), os.path.join(_HERE, "..", "live")):
    if os.path.isdir(_p):
        sys.path.insert(0, _p)
from decoder import (messaggi_da_righe, campioni_cardata, StatoSessione,  # noqa: E402
                     _valore_tempo)


def _lap_secondi(testo):
    """'1:49.098' o '49.098' -> secondi (float); None se vuoto."""
    if not testo:
        return None
    try:
        if ":" in testo:
            m, s = testo.split(":")
            return int(m) * 60 + float(s)
        return float(testo)
    except (ValueError, TypeError):
        return None


def estrai(righe):
    """Da un iterabile di righe grezze del collettore ai dati telemetria.
    Ritorna: driver_sigla, campioni_per_auto, giri_per_auto."""
    stato = StatoSessione()
    campioni = {}          # auto -> [(t, {canali})]
    giri = {}              # auto -> [(t_fine, lap_s)]
    prev_nl = {}
    for topic, payload, ts in messaggi_da_righe(righe):
        if topic == "CarData.z":
            for c in campioni_cardata(payload):
                if c.t is None:
                    continue
                campioni.setdefault(c.auto, []).append((c.t, c.canali))
        elif topic == "TimingData":
            for auto, delta in payload.get("Lines", {}).items():
                if not isinstance(delta, dict):
                    continue
                stato.aggiorna("TimingData", {"Lines": {auto: delta}}, ts)
                st = stato.piloti.get(str(auto), {})
                nl = st.get("NumberOfLaps")
                if nl is not None and prev_nl.get(str(auto)) != nl and ts:
                    prev_nl[str(auto)] = nl
                    lap_s = _lap_secondi(_valore_tempo(st.get("LastLapTime")))
                    giri.setdefault(str(auto), []).append((ts, lap_s))
        elif topic in ("DriverList",):
            stato.aggiorna(topic, payload, ts)
    return stato, campioni, giri


def traccia_giro_veloce(campioni_auto, giri_auto, margine=0.4):
    """La traccia CarData del giro piu' veloce (min lap_s con tempo valido).
    margine: padding [s] sui bordi della finestra (jitter dei clock)."""
    validi = [(t_fine, lap_s) for (t_fine, lap_s) in giri_auto
              if lap_s and lap_s > 0]
    if not validi:
        return None, None
    t_fine, lap_s = min(validi, key=lambda x: x[1])
    from datetime import timedelta
    t0 = t_fine - timedelta(seconds=lap_s)
    a = t0 - timedelta(seconds=margine)
    b = t_fine + timedelta(seconds=margine)
    punti = []
    for (t, can) in campioni_auto:
        if a <= t <= b:
            x = (t - t0).total_seconds()
            punti.append([
                round(x, 2),
                int(can.get("velocita")) if isinstance(can.get("velocita"), (int, float)) else None,
                int(can.get("throttle")) if isinstance(can.get("throttle"), (int, float)) else None,
                1 if (isinstance(can.get("freno"), (int, float)) and can.get("freno") > 50) else 0,
                int(can.get("marcia")) if isinstance(can.get("marcia"), (int, float)) else None,
            ])
    punti.sort(key=lambda p: p[0])
    return lap_s, punti


def fmt_lap(lap_s):
    if not lap_s:
        return None
    m = int(lap_s // 60)
    return f"{m}:{lap_s - m*60:06.3f}"


def costruisci(stato, campioni, giri):
    piloti = {}
    for auto in campioni:
        lap_s, punti = traccia_giro_veloce(campioni[auto], giri.get(auto, []))
        if not punti or len(punti) < 30:
            continue
        d = stato.driver_list.get(str(auto), {})
        sigla = d.get("Tla") or str(auto)
        colore = d.get("TeamColour")
        piloti[sigla] = {
            "num": str(auto),
            "colore": ("#" + colore) if colore else None,
            "best_lap": fmt_lap(lap_s),
            "giro_s": round(lap_s, 3),
            "punti": punti,
        }
    return piloti


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("recording")
    ap.add_argument("--gara", required=True)
    ap.add_argument("--sessione", required=True, help="slug: gara/qualifiche/fp1...")
    ap.add_argument("--evento", default=None)
    ap.add_argument("--out-dir", default=os.path.join("demo", "data"))
    args = ap.parse_args()

    with open(args.recording, encoding="utf-8") as f:
        stato, campioni, giri = estrai(f)
    piloti = costruisci(stato, campioni, giri)
    if len(piloti) < 5:
        sys.exit(f"[tele] solo {len(piloti)} piloti con traccia: registrazione scarsa?")
    doc = {"gara": args.gara, "sessione": args.sessione,
           "evento": args.evento or args.gara,
           "canali": ["t", "velocita", "throttle", "freno", "marcia"],
           "piloti": piloti}
    os.makedirs(args.out_dir, exist_ok=True)
    fname = f"tele_{args.gara}_{args.sessione}.json"
    fp = os.path.join(args.out_dir, fname)
    with open(fp, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    # manifest (per i link dalla stagione)
    man_fp = os.path.join(args.out_dir, "tele_manifest.json")
    man = {"disponibili": []}
    if os.path.exists(man_fp):
        try:
            man = json.load(open(man_fp, encoding="utf-8"))
        except Exception:
            pass
    voce = {"gara": args.gara, "sessione": args.sessione,
            "evento": doc["evento"], "file": fname}
    man["disponibili"] = [v for v in man.get("disponibili", [])
                          if not (v.get("gara") == args.gara
                                  and v.get("sessione") == args.sessione)] + [voce]
    with open(man_fp, "w", encoding="utf-8") as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
    print(f"[tele] scritto {fp} ({len(piloti)} piloti) + {man_fp}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
