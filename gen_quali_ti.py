#!/usr/bin/env python
"""gen_quali_ti.py — genera il dataset qualifica da TracingInsights (la
STESSA fonte delle gare: raw GitHub, fetchabile dal VPS — niente FastF1,
niente CloudFront). E' la versione per l'AUTOMAZIONE (auto_gara.py).

Da .../2026/main/<TI>/Qualifying/session_laptimes.json a
demo/data/quali_<gara>.json + aggiornamento demo/data/quali_manifest.json,
stesso schema del persistente R2b (lo consumano live.html e quali.html):
  {gara, evento, sessione, data, piloti:[{pos,num,sigla,colore,best,gap,
   q1,q2,q3,sectors:[{t,best}]}]}

Metodo (dichiarato): per ogni pilota il MIGLIOR giro = min(s1+s2+s3) sui
giri con tutti e tre i settori validi; i settori mostrati sono quelli di
quel giro; ordine per miglior giro; gap dalla pole. Nessun dato inventato:
un pilota senza un giro completo non entra (o entra senza tempo). Micro-
settori NON inclusi (sono un artefatto del feed live).

Riusa costruisci_piloti() di gen_quali.py per gap-dalla-pole e colore
settori (viola=assoluto, verde=personale). Gira su Mac E su VPS (solo rete
verso raw.githubusercontent.com).

Uso (di solito chiamato da auto_gara.py):
  python3 gen_quali_ti.py --gara Belgio --ti "Belgian Grand Prix" \
      --evento "GP del Belgio"
"""

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request

from gen_quali import costruisci_piloti

# TI/FastF1 team -> chiave di demo/team_colori.json (alias dei casi noti)
ALIAS_TEAM = {
    "Red Bull": "Red Bull Racing",
    "Haas": "Haas F1 Team",
    "RB": "Racing Bulls",
    "Visa Cash App RB": "Racing Bulls",
    "Kick Sauber": "Audi",
    "Sauber": "Audi",
    "Stake F1 Team Kick Sauber": "Audi",
}


def raw_url_quali(ti):
    return ("https://raw.githubusercontent.com/TracingInsights/2026/main/"
            + urllib.parse.quote(ti) + "/Qualifying/session_laptimes.json")


def scarica_ti_quali(ti):
    req = urllib.request.Request(raw_url_quali(ti),
                                 headers={"User-Agent": "muretto"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.loads(r.read())


def _num(x):
    return x if isinstance(x, (int, float)) and x == x and x > 0 else None


def costruisci_quali_da_ti(d, colori):
    """Da TI (dict di array colonnari) alla lista `piloti`. Funzione PURA
    (testabile). `colori`: mappa team->hex (demo/team_colori.json)."""
    dnum = d.get("dNum") or d.get("dnum") or []
    n = len(dnum)
    drv = d.get("drv") or []
    team = d.get("team") or []
    s1, s2, s3 = d.get("s1") or [], d.get("s2") or [], d.get("s3") or []
    per = {}   # num -> {lt, s:[..], sigla, team}
    for i in range(n):
        a = _num(s1[i] if i < len(s1) else None)
        b = _num(s2[i] if i < len(s2) else None)
        c = _num(s3[i] if i < len(s3) else None)
        if a is None or b is None or c is None:
            continue
        lt = a + b + c
        num = str(dnum[i])
        cur = per.get(num)
        if cur is None or lt < cur["lt"]:
            per[num] = {"lt": lt, "s": [a, b, c],
                        "sigla": drv[i] if i < len(drv) else num,
                        "team": team[i] if i < len(team) else None}
    ordinati = sorted(per.items(), key=lambda kv: kv[1]["lt"])
    righe = []
    for pos, (num, v) in enumerate(ordinati, 1):
        tm = v["team"]
        colore = (colori.get(tm) or colori.get(ALIAS_TEAM.get(tm, ""))
                  or colori.get(v["sigla"]))
        righe.append({
            "pos": pos, "num": num, "sigla": v["sigla"], "colore": colore,
            "q1": None, "q2": None, "q3": v["lt"],
            "s1": v["s"][0], "s2": v["s"][1], "s3": v["s"][2],
        })
    return costruisci_piloti(righe)


def scrivi(doc, gara, evento, out_dir):
    out = os.path.join(out_dir)
    os.makedirs(out, exist_ok=True)
    fp = os.path.join(out, f"quali_{gara}.json")
    with open(fp, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    # manifest
    man_fp = os.path.join(out, "quali_manifest.json")
    man = {"disponibili": [], "ultima": None}
    if os.path.exists(man_fp):
        try:
            man = json.load(open(man_fp, encoding="utf-8"))
        except Exception:
            pass
    voce = {"gara": gara, "evento": evento, "data": doc.get("data"),
            "file": f"quali_{gara}.json"}
    man["disponibili"] = [v for v in man.get("disponibili", [])
                          if v.get("gara") != gara] + [voce]
    man["ultima"] = voce
    with open(man_fp, "w", encoding="utf-8") as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
    return fp, man_fp


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gara", required=True, help="nome interno (es. Belgio)")
    ap.add_argument("--ti", required=True, help="cartella TracingInsights (es. 'Belgian Grand Prix')")
    ap.add_argument("--evento", required=True, help="titolo (es. 'GP del Belgio')")
    ap.add_argument("--out-dir", default=os.path.join("demo", "data"))
    ap.add_argument("--colori", default=os.path.join("demo", "team_colori.json"))
    ap.add_argument("--data", default=None, help="data sessione YYYY-MM-DD (opzionale)")
    args = ap.parse_args()

    try:
        colori = json.load(open(args.colori, encoding="utf-8"))
    except Exception:
        colori = {}
    d = scarica_ti_quali(args.ti)
    piloti = costruisci_quali_da_ti(d, colori)
    if len(piloti) < 10:
        sys.exit(f"[quali] solo {len(piloti)} piloti con giro completo: "
                 f"sessione parziale? Non pubblico (riprovera' al prossimo giro).")
    doc = {"gara": args.gara, "evento": args.evento, "sessione": "Qualifiche",
           "data": args.data, "piloti": piloti}
    fp, man_fp = scrivi(doc, args.gara, args.evento, args.out_dir)
    print(f"[quali] scritto {fp} ({len(piloti)} piloti) + {man_fp}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
