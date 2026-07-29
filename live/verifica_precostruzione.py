#!/usr/bin/env python3
"""Verifica di allineamento della PRE-costruzione di un circuito contro
la prima sessione reale (runbook weekend: FP1 = SOLO questa verifica).

Estrae un giro pulito della sessione indicata (criteri IDENTICI a
gen_pista_svg.py) e misura le distanze punto -> polilinea di riferimento
della pre-costruzione (<circuito>_ref_track.json, stesso sistema di
coordinate grezze FastF1). Verdetto sulla soglia PRE-registrata:
**p95 <= 3 m** (PREREG_HUN_PREP). Se NO-GO: percorso di rigenerazione
da FP1 nel runbook (obiettivo 30 minuti).

ATTENZIONE: usa FastF1 — python3 UTENTE, come i generatori del sito.

Uso:
  python3 live/verifica_precostruzione.py --anno 2026 \
      --gara "Hungarian Grand Prix" --sessione FP1 \
      --ref data/live_derived/ungheria_ref_track.json
"""

import argparse
import json
import os
import statistics
import sys
from pathlib import Path

import fastf1

sys.path.insert(0, str(Path(__file__).resolve().parent))
from verify_alignment import IndiceGriglia, ricampiona  # noqa: E402
from estrai_precostruzione import giro_pulito  # noqa: E402

fastf1.Cache.enable_cache(os.path.expanduser("~/muretto_shared/ff1_cache"))

SOGLIA_P95_M = 3.0        # PREREG_HUN_PREP, scritta prima delle verifiche
PASSO_FINE_DM = 5.0       # ricampionamento fitto: errore indice <= 0.25 m


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Verifica pre-costruzione vs sessione reale "
                    "(p95 <= 3 m).")
    ap.add_argument("--anno", type=int, required=True)
    ap.add_argument("--gara", required=True,
                    help="nome evento FastF1 (es. 'Hungarian Grand Prix')")
    ap.add_argument("--sessione", default="FP1")
    ap.add_argument("--ref", required=True,
                    help="polilinea di pre-costruzione "
                         "(<circuito>_ref_track.json)")
    ap.add_argument("--soglia-m", type=float, default=SOGLIA_P95_M)
    ap.add_argument("--out", help="JSON di verifica (default: accanto a "
                                  "--ref, suffisso _verifica_<sessione>)")
    args = ap.parse_args()

    ref = json.loads(Path(args.ref).read_text())
    indice = IndiceGriglia(
        ricampiona([tuple(p) for p in ref["punti"]], passo=PASSO_FINE_DM),
        cella=200.0)

    sess = fastf1.get_session(args.anno, args.gara, args.sessione)
    sess.load(telemetry=True, weather=False, messages=False)
    giro = giro_pulito(sess)

    dist_m = sorted(indice.distanza(x, y, massimo=3000.0) / 10.0
                    for x, y in giro["punti"])
    n = len(dist_m)
    p95 = dist_m[min(n - 1, round(0.95 * (n - 1)))]
    esito = {
        "_nota": ("verifica pre-costruzione (runbook weekend): distanze "
                  "giro pulito sessione reale -> polilinea di riferimento "
                  "pre-costruita, coordinate grezze FastF1, metri. "
                  f"Soglia PRE-registrata: p95 <= {args.soglia_m} m."),
        "ref": str(args.ref),
        "ref_sorgente": ref.get("sorgente"),
        "giro_sorgente": giro["sorgente"],
        "campioni": n,
        "dist_media_m": round(statistics.fmean(dist_m), 2),
        "dist_p95_m": round(p95, 2),
        "dist_max_m": round(dist_m[-1], 2),
        "soglia_p95_m": args.soglia_m,
        "verdetto": "GO" if p95 <= args.soglia_m else "NO-GO",
    }
    dest = Path(args.out) if args.out else Path(args.ref).with_name(
        Path(args.ref).stem.replace("_ref_track", "")
        + f"_verifica_{args.sessione.lower()}.json")
    dest.write_text(json.dumps(esito, ensure_ascii=False, indent=1),
                    encoding="utf-8")
    print(f"{dest.name}: {esito['verdetto']} — p95 {p95:.2f} m "
          f"(soglia {args.soglia_m}), media {esito['dist_media_m']} m, "
          f"max {esito['dist_max_m']} m su {n} campioni "
          f"[giro {giro['sorgente']['pilota']} "
          f"{giro['sorgente']['lap_time_s']:.3f}s]")
    return 0 if esito["verdetto"] == "GO" else 1


if __name__ == "__main__":
    sys.exit(main())
