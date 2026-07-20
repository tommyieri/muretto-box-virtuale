#!/usr/bin/env python
"""gen_quali.py — genera il dataset PERSISTENTE di una qualifica per la
pagina Live (R2b). Da FastF1 (fonte principe, IP residenziale) a
demo/data/quali_<gara>.json + aggiornamento di demo/data/quali_manifest.json.

Serve a rendere la board qualifica visibile ANCHE fuori sessione: quando
apri il sito e non c'e' un live, vedi l'ultima qualifica vera (dati reali,
etichettati GP + data). Nessun numero finto: se un campo manca, resta null.

Va eseguito SUL MAC (FastF1 richiede l'IP residenziale; dal VPS/datacenter
CloudFront blocca, stesso 403 del collettore). Esempio:

    .venv/bin/python gen_quali.py --anno 2026 --gp Belgium --gara Belgio \
        --evento "GP del Belgio"

Schema di quali_<gara>.json (stesso vocabolario colori/sigle del live):
  {gara, evento, sessione, data, piloti:[{pos,num,sigla,colore,best,gap,
   q1,q2,q3,sectors:[{t,best}]}]}
  - `best` = miglior giro del pilota (il piu' veloce fra Q1/Q2/Q3 raggiunti)
  - `gap`  = distacco dalla pole ("+X.XXX"; "" per la pole)
  - `sectors[i].best` = 'o' (miglior settore assoluto) / 'p' (personale) / None
  Micro-settori: NON inclusi nel persistente (sono un artefatto del feed
  live; qui ci sono i TEMPI di settore, non le barrette).

Solo FastF1 + stdlib.
"""

import argparse
import json
import sys
from pathlib import Path


def fmt_gap(secondi):
    """distacco in secondi -> '+X.XXX'; 0/None -> '' (pole)."""
    if secondi is None or secondi != secondi or secondi <= 0:
        return ""
    return f"+{secondi:.3f}"


def _secondi(td):
    try:
        s = td.total_seconds()
        return s if s == s and s > 0 else None
    except AttributeError:
        return None


def costruisci_piloti(righe):
    """Da righe grezze (una per pilota) alla lista `piloti` ordinata e
    con gap dalla pole e settori colorati. FUNZIONE PURA (testabile):
    ogni riga = {pos,num,sigla,colore,q1,q2,q3, s1,s2,s3} con tempi in
    secondi (float) o None."""
    piloti = []
    for r in righe:
        tempi = [r.get("q1"), r.get("q2"), r.get("q3")]
        validi = [t for t in tempi if isinstance(t, (int, float)) and t > 0]
        best = min(validi) if validi else None
        piloti.append({
            "pos": r.get("pos"),
            "num": str(r.get("num")),
            "sigla": r.get("sigla"),
            "colore": r.get("colore"),
            "_best_s": best,
            "q1": fmt_giro_secondi(r.get("q1")),
            "q2": fmt_giro_secondi(r.get("q2")),
            "q3": fmt_giro_secondi(r.get("q3")),
            "_s": [r.get("s1"), r.get("s2"), r.get("s3")],
        })
    # pole = miglior best
    best_vali = [p["_best_s"] for p in piloti if p["_best_s"] is not None]
    pole = min(best_vali) if best_vali else None
    # miglior settore assoluto per S1/S2/S3
    migliori_sett = []
    for i in range(3):
        vals = [p["_s"][i] for p in piloti
                if isinstance(p["_s"][i], (int, float)) and p["_s"][i] > 0]
        migliori_sett.append(min(vals) if vals else None)
    out = []
    for p in piloti:
        best = p["_best_s"]
        gap = fmt_gap(best - pole) if (best is not None and pole is not None
                                       and best > pole) else ""
        sectors = []
        for i in range(3):
            v = p["_s"][i]
            if isinstance(v, (int, float)) and v > 0:
                miglior = "o" if (migliori_sett[i] is not None
                                  and abs(v - migliori_sett[i]) < 1e-6) else None
                sectors.append({"t": f"{v:.3f}", "best": miglior})
            else:
                sectors.append({"t": None, "best": None})
        out.append({
            "pos": p["pos"], "num": p["num"], "sigla": p["sigla"],
            "colore": p["colore"], "best": fmt_giro_secondi(best),
            "gap": gap, "q1": p["q1"], "q2": p["q2"], "q3": p["q3"],
            "sectors": sectors,
        })
    out.sort(key=lambda x: (x["pos"] is None, x["pos"] or 999))
    return out


def fmt_giro_secondi(s):
    if not isinstance(s, (int, float)) or s != s or s <= 0:
        return None
    m = int(s // 60)
    return f"{m}:{s - m * 60:06.3f}"


def carica_da_fastf1(anno, gp, cache_dir=None):
    """Carica la qualifica da FastF1 e ritorna le righe grezze per
    costruisci_piloti. Gira sul Mac (IP residenziale)."""
    import fastf1
    if cache_dir:
        Path(cache_dir).mkdir(parents=True, exist_ok=True)
        fastf1.Cache.enable_cache(cache_dir)
    ses = fastf1.get_session(anno, gp, "Q")
    ses.load()
    res = ses.results
    laps = ses.laps
    righe = []
    for _, row in res.iterrows():
        num = str(row.get("DriverNumber"))
        try:
            best_lap = laps.pick_drivers(num).pick_fastest()
        except Exception:
            best_lap = None
        s1 = s2 = s3 = None
        if best_lap is not None:
            s1 = _secondi(best_lap.get("Sector1Time"))
            s2 = _secondi(best_lap.get("Sector2Time"))
            s3 = _secondi(best_lap.get("Sector3Time"))
        colore = row.get("TeamColor")
        righe.append({
            "pos": int(row["Position"]) if row.get("Position") == row.get("Position") else None,
            "num": num,
            "sigla": row.get("Abbreviation"),
            "colore": ("#" + colore) if colore else None,
            "q1": _secondi(row.get("Q1")),
            "q2": _secondi(row.get("Q2")),
            "q3": _secondi(row.get("Q3")),
            "s1": s1, "s2": s2, "s3": s3,
        })
    return righe, ses


def main():
    ap = argparse.ArgumentParser(description="Genera quali_<gara>.json da FastF1")
    ap.add_argument("--anno", type=int, required=True)
    ap.add_argument("--gp", required=True, help="nome GP per FastF1 (es. Belgium)")
    ap.add_argument("--gara", required=True, help="nome interno (es. Belgio)")
    ap.add_argument("--evento", required=True, help="titolo (es. 'GP del Belgio')")
    ap.add_argument("--out-dir", default="demo/data")
    ap.add_argument("--cache", default=".fastf1_cache")
    args = ap.parse_args()

    righe, ses = carica_da_fastf1(args.anno, args.gp, args.cache)
    piloti = costruisci_piloti(righe)
    data = None
    try:
        data = str(ses.date.date()) if getattr(ses, "date", None) is not None else None
    except Exception:
        data = None

    doc = {"gara": args.gara, "evento": args.evento, "sessione": "Qualifiche",
           "data": data, "piloti": piloti}
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    fp = out_dir / f"quali_{args.gara}.json"
    fp.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"scritto {fp} ({len(piloti)} piloti)")

    # manifest: elenco quali disponibili + ultima
    man_fp = out_dir / "quali_manifest.json"
    man = {"disponibili": [], "ultima": None}
    if man_fp.exists():
        try:
            man = json.loads(man_fp.read_text(encoding="utf-8"))
        except Exception:
            pass
    voce = {"gara": args.gara, "evento": args.evento, "data": data,
            "file": f"quali_{args.gara}.json"}
    man["disponibili"] = [v for v in man.get("disponibili", [])
                          if v.get("gara") != args.gara] + [voce]
    man["ultima"] = voce
    man_fp.write_text(json.dumps(man, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"aggiornato {man_fp} (ultima: {args.gara})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
