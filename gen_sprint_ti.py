#!/usr/bin/env python
"""gen_sprint_ti.py — genera le sessioni SPRINT di un weekend sprint da
TracingInsights (stessa fonte di gare/quali/libere: raw GitHub, VPS-ok).

Due sessioni:
  - "Sprint Qualifying"  -> TIMESHEET sul giro veloce (riusa il transform
                            delle qualifiche: gap dalla pole, settori);
  - "Sprint"             -> ORDINE D'ARRIVO (nuovo transform: posizione
                            all'ultimo giro; mostra giri completati e il
                            giro piu' veloce). NON un timesheet: e' una gara.

Un file per GP: demo/data/sprint_<gara>.json
  {gara, evento, data, sprint_quali:{piloti:[...]}, sprint:{piloti:[...]}}
+ aggiornamento demo/data/sprint_manifest.json. Presente solo per i weekend
sprint (le cartelle non esistono su TI negli altri -> saltate, nessun errore).

Onesto: il giro piu' veloce e' quello del pilota, non un tempo di gara; la
colonna "arrivo" e' l'ordine reale (pos all'ultimo giro), non il giro veloce.
Micro-settori assenti (artefatto del feed live).

Uso (di solito da auto_gara.py):
  python3 gen_sprint_ti.py --gara Cina --ti "Chinese Grand Prix" --evento "GP di Cina"
"""

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request

from gen_quali_ti import costruisci_quali_da_ti, ALIAS_TEAM, _num
from gen_quali import fmt_giro_secondi


def raw_url(ti, sess):
    return ("https://raw.githubusercontent.com/TracingInsights/2026/main/"
            + urllib.parse.quote(ti) + "/" + urllib.parse.quote(sess)
            + "/session_laptimes.json")


def scarica(ti, sess):
    req = urllib.request.Request(raw_url(ti, sess),
                                 headers={"User-Agent": "muretto"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return json.loads(r.read())
    except Exception:
        return None


def _colore(colori, team, sigla):
    return (colori.get(team) or colori.get(ALIAS_TEAM.get(team, ""))
            or colori.get(sigla))


def costruisci_arrivo_da_ti(d, colori):
    """ORDINE D'ARRIVO da TI: per ogni pilota la posizione all'ULTIMO giro
    percorso; ordine per (giri desc, pos asc). Mostra giri e giro veloce.
    FUNZIONE PURA (testabile)."""
    dnum = d.get("dNum") or []
    n = len(dnum)
    drv = d.get("drv") or []
    team = d.get("team") or []
    lap = d.get("lap") or []
    pos = d.get("pos") or []
    s1, s2, s3 = d.get("s1") or [], d.get("s2") or [], d.get("s3") or []
    per = {}
    for i in range(n):
        num = str(dnum[i])
        v = per.setdefault(num, {"maxlap": -1, "pos": None, "best": None,
                                 "sigla": drv[i] if i < len(drv) else num,
                                 "team": team[i] if i < len(team) else None})
        L = lap[i] if i < len(lap) else None
        if isinstance(L, (int, float)) and L > v["maxlap"]:
            v["maxlap"] = L
            P = pos[i] if i < len(pos) else None
            if isinstance(P, (int, float)):
                v["pos"] = int(P)
        a = _num(s1[i] if i < len(s1) else None)
        b = _num(s2[i] if i < len(s2) else None)
        c = _num(s3[i] if i < len(s3) else None)
        if a and b and c:
            lt = a + b + c
            if v["best"] is None or lt < v["best"]:
                v["best"] = lt
        v["sigla"] = drv[i] if i < len(drv) else num
        v["team"] = team[i] if i < len(team) else v["team"]
    ordinati = sorted(per.items(),
                      key=lambda kv: (-(kv[1]["maxlap"] if kv[1]["maxlap"] >= 0 else 0),
                                      kv[1]["pos"] if kv[1]["pos"] is not None else 999))
    out = []
    for fp, (num, v) in enumerate(ordinati, 1):
        out.append({
            "pos": fp, "num": num, "sigla": v["sigla"],
            "colore": _colore(colori, v["team"], v["sigla"]),
            "giri": int(v["maxlap"]) if v["maxlap"] >= 0 else None,
            "best": fmt_giro_secondi(v["best"]),
        })
    return out


def scrivi(doc, gara, evento, sezioni, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    fp = os.path.join(out_dir, f"sprint_{gara}.json")
    with open(fp, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    man_fp = os.path.join(out_dir, "sprint_manifest.json")
    man = {"disponibili": [], "ultima": None}
    if os.path.exists(man_fp):
        try:
            man = json.load(open(man_fp, encoding="utf-8"))
        except Exception:
            pass
    voce = {"gara": gara, "evento": evento, "data": doc.get("data"),
            "file": f"sprint_{gara}.json", "sezioni": sezioni}
    man["disponibili"] = [v for v in man.get("disponibili", [])
                          if v.get("gara") != gara] + [voce]
    man["ultima"] = voce
    with open(man_fp, "w", encoding="utf-8") as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
    return fp, man_fp


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gara", required=True)
    ap.add_argument("--ti", required=True)
    ap.add_argument("--evento", required=True)
    ap.add_argument("--out-dir", default=os.path.join("demo", "data"))
    ap.add_argument("--colori", default=os.path.join("demo", "team_colori.json"))
    ap.add_argument("--data", default=None)
    args = ap.parse_args()

    try:
        colori = json.load(open(args.colori, encoding="utf-8"))
    except Exception:
        colori = {}

    doc = {"gara": args.gara, "evento": args.evento, "data": args.data}
    sezioni = []
    dq = scarica(args.ti, "Sprint Qualifying")
    if dq is not None:
        piloti = costruisci_quali_da_ti(dq, colori)
        if len(piloti) >= 8:
            doc["sprint_quali"] = {"sessione": "Sprint Qualifying", "piloti": piloti}
            sezioni.append("sprint_quali")
    ds = scarica(args.ti, "Sprint")
    if ds is not None:
        arrivo = costruisci_arrivo_da_ti(ds, colori)
        if len(arrivo) >= 8:
            doc["sprint"] = {"sessione": "Sprint", "piloti": arrivo}
            sezioni.append("sprint")

    if not sezioni:
        sys.exit(f"[sprint] nessuna sessione sprint utile online per {args.gara} "
                 f"(weekend non-sprint o sessioni parziali): non pubblico.")
    fp, man_fp = scrivi(doc, args.gara, args.evento, sezioni, args.out_dir)
    print(f"[sprint] scritto {fp} (sezioni: {', '.join(sezioni)}) + {man_fp}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
