#!/usr/bin/env python
"""Trasformazione coordinate LIVE (raw FastF1, decimi di metro) -> viewBox
della pista del sito (pista_<gara>.json) — Fase 3, parte C.

gen_pista_svg.py normalizza cosi': rotazione (gradi in sorgente del JSON),
y invertita, traslazione al minimo, scala 1000/xmax — ma NON salva minimo
e scala (dipendono dal giro sorgente). Qui la trasformazione si RICAVA:
si applica la rotazione+flip nota alla polilinea di riferimento raw del
circuito (es. spa_ref_track.json, stesso sistema del live: verificato in
Fase 1) e si stimano scala+traslazione minimizzando la distanza dalla
polilinea del sito (discesa per coordinate; residuo riportato nel JSON:
va controllato, non assunto).

Output (asset del sito): demo/data/live_geo_<gara>.json con
  {rotazione_deg, scala, tx, ty, residuo_medio_vb, corridoio_pit_vb}
La pagina live applica:  vbx = scala*(x*cos - y*sin) + tx
                         vby = scala*(-(x*sin + y*cos)) + ty

Uso:
  .venv/bin/python live/gen_live_geo.py --gara Belgio \
      --ref data/live_derived/spa_ref_track.json \
      --pitlane data/live_derived/pitlane_spa.json
"""

import argparse
import json
import math
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from verify_alignment import IndiceGriglia, ricampiona  # noqa: E402

RADICE = Path(__file__).resolve().parent.parent


def ruota_flip(punti, gradi):
    a = math.radians(gradi)
    c, s = math.cos(a), math.sin(a)
    return [(x * c - y * s, -(x * s + y * c)) for x, y in punti]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--gara", required=True, help="es. Belgio")
    ap.add_argument("--ref", required=True,
                    help="polilinea raw del circuito (spa_ref_track.json)")
    ap.add_argument("--pitlane", required=True,
                    help="corridoio pit raw (pitlane_spa.json)")
    args = ap.parse_args()

    pista = json.loads(
        (RADICE / f"demo/data/pista_{args.gara}.json").read_text())
    ref = json.loads(Path(args.ref).read_text())
    pit = json.loads(Path(args.pitlane).read_text())
    rot = float(pista["sorgente"]["rotazione_gradi"])

    vb = [tuple(p) for p in pista["punti"]]
    indice = IndiceGriglia(ricampiona(vb, passo=2.0), cella=20.0)
    ruotati = ruota_flip([tuple(p) for p in ref["punti"]], rot)

    # stima iniziale dai bounding box
    def bbox(punti):
        xs = [p[0] for p in punti]
        ys = [p[1] for p in punti]
        return min(xs), min(ys), max(xs), max(ys)

    rx0, ry0, rx1, ry1 = bbox(ruotati)
    vx0, vy0, vx1, vy1 = bbox(vb)
    scala = ((vx1 - vx0) / (rx1 - rx0) + (vy1 - vy0) / (ry1 - ry0)) / 2
    tx = vx0 - rx0 * scala
    ty = vy0 - ry0 * scala

    campione = ruotati[::3]

    def costo(s, x0, y0):
        d = [indice.distanza(px * s + x0, py * s + y0, massimo=300.0)
             for px, py in campione]
        return statistics.fmean(d)

    # discesa per coordinate con passi decrescenti
    passi = [(scala * 0.01, 5.0), (scala * 0.002, 1.0),
             (scala * 0.0005, 0.2)]
    migliore = costo(scala, tx, ty)
    for passo_s, passo_t in passi:
        migliorato = True
        while migliorato:
            migliorato = False
            for ds, dx, dy in [(passo_s, 0, 0), (-passo_s, 0, 0),
                               (0, passo_t, 0), (0, -passo_t, 0),
                               (0, 0, passo_t), (0, 0, -passo_t)]:
                c = costo(scala + ds, tx + dx, ty + dy)
                if c < migliore:
                    migliore = c
                    scala, tx, ty = scala + ds, tx + dx, ty + dy
                    migliorato = True

    corridoio_vb = [
        [round(px * scala + tx, 1), round(py * scala + ty, 1)]
        for px, py in ruota_flip([tuple(p) for p in pit["punti"]], rot)]

    out = {
        "_nota": ("GENERATO da live/gen_live_geo.py: trasformazione "
                  "coordinate live raw (decimi di metro FastF1) -> viewBox "
                  "di pista_<gara>.json, stimata sulla polilinea di "
                  "riferimento del circuito. vb = scala*ruota_flip(x,y) + "
                  "(tx,ty). Controllare residuo_medio_vb (~1-2 = ok)."),
        "gara": args.gara,
        "rotazione_deg": rot,
        "scala": round(scala, 8),
        "tx": round(tx, 3),
        "ty": round(ty, 3),
        "residuo_medio_vb": round(migliore, 2),
        "corridoio_pit_vb": corridoio_vb,
        "provenienza": {"ref": str(args.ref), "pitlane": str(args.pitlane),
                        "pista": f"pista_{args.gara}.json"},
    }
    dest = RADICE / f"demo/data/live_geo_{args.gara}.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=1),
                    encoding="utf-8")
    print(f"{dest.name}: scala {scala:.6f}, t=({tx:.1f},{ty:.1f}), "
          f"residuo medio {migliore:.2f} vb "
          f"({migliore / scala / 10:.1f} m), corridoio {len(corridoio_vb)} punti")
    return 0


if __name__ == "__main__":
    sys.exit(main())
