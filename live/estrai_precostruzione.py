#!/usr/bin/env python3
"""Pre-costruzione degli asset live di un circuito dall'anno PRECEDENTE
(PREREG_HUN_PREP, P1) — generalizzazione parametrica del ruolo una-tantum
di estrai_riferimenti.py.

ATTENZIONE: come estrai_riferimenti.py, usa FastF1 e va lanciato col
python3 UTENTE (fastf1+pandas2, NON la .venv del kernel). I JSON prodotti
diventano input statici per gli strumenti stdlib-only del modulo live/.

Produce in --out-dir (default data/live_derived/):
  - <circuito>_ref_track.json    polilinea GREZZA (decimi di metro) di UN
                                 giro pulito della sessione indicata,
                                 criteri IDENTICI a gen_pista_svg.py;
  - <circuito>_pit_samples.json  campioni posizione (x, y grezzi) nelle
                                 finestre pit dei laps FastF1
                                 (PitInTime del giro -> PitOutTime del
                                 giro successivo, per pilota). Input per
                                 costruisci_corridoio.py (fonte .json).

Uso:
  python3 live/estrai_precostruzione.py --anno 2025 \
      --gara "Hungarian Grand Prix" --circuito ungheria
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


def giro_pulito(sess):
    """Il giro valido piu' veloce con telemetria GPS pulita (criteri e
    ordinamento di gen_pista_svg.py / estrai_riferimenti.py)."""
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
            "_nota": "polilinea GREZZA (decimi di metro), giro pulito — "
                     "criteri di gen_pista_svg.py (estrai_precostruzione)",
            "sorgente": {
                "evento": f"{str(sess.event['EventName'])} "
                          f"{sess.event.year}",
                "sessione": str(sess.name),
                "pilota": str(lap["Driver"]),
                "giro": int(lap["LapNumber"]),
                "lap_time_s": float(lap["LapTime"].total_seconds()),
            },
            "lunghezza_m": round(lung, 1),
            "punti": [[int(x), int(y)] for x, y in zip(xs, ys)],
        }
    raise RuntimeError("nessun giro passa i controlli di qualita'")


def finestre_pit(laps):
    """Per pilota: [(t_in, t_out)] = PitInTime del giro -> PitOutTime del
    giro successivo (tempi-sessione FastF1). Finestre senza uscita (es.
    ritiro ai box) vengono SCARTATE e contate: un'auto parcheggiata non
    deve allungare il corridoio."""
    finestre, aperte = {}, 0
    for num, grp in laps.groupby("DriverNumber"):
        grp = grp.sort_values("LapNumber")
        eventi = []
        for _, lap in grp.iterrows():
            t_out = lap["PitOutTime"]
            t_in = lap["PitInTime"]
            if t_out == t_out and t_out is not None:
                eventi.append(("out", t_out))
            if t_in == t_in and t_in is not None:
                eventi.append(("in", t_in))
        eventi.sort(key=lambda e: e[1])
        t_aperto = None
        for tipo, t in eventi:
            if tipo == "in":
                t_aperto = t
            elif t_aperto is not None:
                finestre.setdefault(str(num), []).append((t_aperto, t))
                t_aperto = None
        if t_aperto is not None:
            aperte += 1
    return finestre, aperte


def campioni_pit(sess, finestre):
    """Campioni (x, y) grezzi nelle finestre pit, dal pos-data per auto."""
    punti = []
    for num, coppie in finestre.items():
        try:
            pos = sess.pos_data[num]
        except KeyError:
            continue
        col_t = "SessionTime" if "SessionTime" in pos.columns else "Time"
        t = pos[col_t]
        for t0, t1 in coppie:
            dentro = pos[(t >= t0) & (t <= t1)]
            for x, y in zip(dentro["X"], dentro["Y"]):
                if x == x and y == y and not (x == 0 and y == 0):
                    punti.append([int(x), int(y)])
    return punti


def main():
    ap = argparse.ArgumentParser(
        description="Pre-costruzione asset live dall'anno precedente.")
    ap.add_argument("--anno", type=int, required=True)
    ap.add_argument("--gara", required=True,
                    help="nome evento FastF1 (es. 'Hungarian Grand Prix')")
    ap.add_argument("--circuito", required=True,
                    help="prefisso dei file prodotti (es. ungheria)")
    ap.add_argument("--sessione", default="R")
    ap.add_argument("--out-dir", default="data/live_derived")
    args = ap.parse_args()
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)

    sess = fastf1.get_session(args.anno, args.gara, args.sessione)
    sess.load(telemetry=True, weather=False, messages=False)

    ref = giro_pulito(sess)
    dest_ref = out / f"{args.circuito}_ref_track.json"
    dest_ref.write_text(json.dumps(ref), encoding="utf-8")
    print(f"{dest_ref.name}:", ref["sorgente"], ref["lunghezza_m"], "m,",
          len(ref["punti"]), "punti")

    finestre, aperte = finestre_pit(sess.laps)
    punti = campioni_pit(sess, finestre)
    n_fin = sum(len(v) for v in finestre.values())
    campioni = {
        "_nota": ("campioni posizione GREZZI (decimi di metro) nelle "
                  "finestre pit FastF1 (PitInTime -> PitOutTime "
                  "successivo, per pilota). Input per "
                  "costruisci_corridoio.py (fonte .json). Finestre senza "
                  "uscita scartate."),
        "sorgente": {"evento": f"{args.anno} {args.gara}",
                     "sessione": args.sessione,
                     "fastf1": fastf1.__version__},
        "finestre": n_fin,
        "finestre_scartate_senza_uscita": aperte,
        "punti": punti,
    }
    dest_pit = out / f"{args.circuito}_pit_samples.json"
    dest_pit.write_text(json.dumps(campioni), encoding="utf-8")
    print(f"{dest_pit.name}: {len(punti)} campioni da {n_fin} finestre pit "
          f"({aperte} scartate senza uscita)")


if __name__ == "__main__":
    main()
