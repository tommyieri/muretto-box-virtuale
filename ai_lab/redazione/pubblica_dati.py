"""
pubblica_dati.py — assembla i dati per il cruscotto interattivo di Analisi.

Legge i feature per-gara (dati_stagione/) e scrive UN file che il front-end
consuma: demo/data/analisi/stagione_dati.json. La pagina (demo/dati.html) calcola
da sola percentili e aggregati (stagione / ultime 5 / per-gara).

E' DATO, non verdetto: si rigenera a ogni gara (agganciato al ciclo post-gara),
cosi' le tabelle interattive si aggiornano da sole — nessuna revisione per-item,
come classifiche e schede.

Puro Python (nessun fastf1): puo' girare ovunque.
"""
from __future__ import annotations
import os
import json
import glob
import datetime

_QUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(_QUI, "..", ".."))
SORG = os.path.join(_QUI, "dati_stagione")
DEST = os.path.join(REPO, "demo", "data", "analisi", "stagione_dati.json")


def pubblica(anno=2026, oggi=None):
    gare = []
    for f in sorted(glob.glob(os.path.join(SORG, f"{anno}_*.json"))):
        d = json.load(open(f))
        gare.append({
            "gp": d.get("gp"), "circuito": d.get("circuito"),
            "data": d.get("data", ""), "round": d.get("round", 0),
            "dna": d.get("dna"),
            "team": {t: {"vmax": v["vmax"], "cornering": v["cornering"]}
                     for t, v in d.get("team", {}).items()},
        })
    gare.sort(key=lambda g: (g["round"] or 0, g["data"] or ""))
    out = {
        "anno": anno,
        "aggiornato": oggi or datetime.date.today().isoformat(),
        "n_gare": len(gare),
        "ultima": gare[-1]["circuito"] if gare else None,
        "gare": gare,
    }
    os.makedirs(os.path.dirname(DEST), exist_ok=True)
    json.dump(out, open(DEST, "w"), ensure_ascii=False, indent=2)
    return out


if __name__ == "__main__":
    o = pubblica()
    print(f"Pubblicato demo/data/analisi/stagione_dati.json: {o['n_gare']} gare, "
          f"ultima {o['ultima']}")
    for g in o["gare"]:
        dna = g.get("dna") or {}
        print(f"  r{g['round']:<2} {g['circuito'][:16]:16} gas {dna.get('full_throttle_pct','?')}%  "
              f"team {len(g['team'])}")
