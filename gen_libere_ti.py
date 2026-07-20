#!/usr/bin/env python
"""gen_libere_ti.py — genera i timesheet delle PROVE LIBERE da
TracingInsights (stessa fonte e stesso metodo delle qualifiche: raw GitHub,
VPS-ok, niente FastF1).

Un timesheet di libere E' una classifica sul giro veloce con settori:
riusa lo STESSO transform delle qualifiche (costruisci_quali_da_ti). Prova
le sessioni Practice 1/2/3 (e 4): include quelle ONLINE, salta le mancanti
(un weekend sprint ha solo Practice 1 -> le altre 404, ignorate).

Un file per GP, che CRESCE durante il weekend man mano che le sessioni
finiscono: demo/data/libere_<gara>.json
  {gara, evento, sessioni:{fp1:{sessione, piloti:[...]}, fp2:{...}, ...}}
+ aggiornamento demo/data/libere_manifest.json.

Idempotente per costruzione: rigenera dallo stato attuale di TI; chi lo
chiama (auto_gara) committa solo se il file cambia (git diff). Micro-
settori NON inclusi (artefatto del feed live): tempi di settore colorati.

Uso (di solito da auto_gara.py, per il GP del weekend in corso):
  python3 gen_libere_ti.py --gara Belgio --ti "Belgian Grand Prix" \
      --evento "GP del Belgio"
"""

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request

from gen_quali_ti import costruisci_quali_da_ti

# (cartella TracingInsights, slug interno, etichetta)
SESSIONI = [
    ("Practice 1", "fp1", "Prove libere 1"),
    ("Practice 2", "fp2", "Prove libere 2"),
    ("Practice 3", "fp3", "Prove libere 3"),
    ("Practice 4", "fp4", "Prove libere 4"),
]
MIN_PILOTI = 8   # sotto questa soglia la sessione e' troppo scarna: si salta


def raw_url(ti, sess):
    return ("https://raw.githubusercontent.com/TracingInsights/2026/main/"
            + urllib.parse.quote(ti) + "/" + urllib.parse.quote(sess)
            + "/session_laptimes.json")


def scarica(ti, sess):
    """Ritorna il JSON della sessione, o None se non online / illeggibile."""
    req = urllib.request.Request(raw_url(ti, sess),
                                 headers={"User-Agent": "muretto"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return json.loads(r.read())
    except Exception:
        return None


def scrivi(doc, gara, evento, slugs, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    fp = os.path.join(out_dir, f"libere_{gara}.json")
    with open(fp, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    man_fp = os.path.join(out_dir, "libere_manifest.json")
    man = {"disponibili": [], "ultima": None}
    if os.path.exists(man_fp):
        try:
            man = json.load(open(man_fp, encoding="utf-8"))
        except Exception:
            pass
    voce = {"gara": gara, "evento": evento, "data": doc.get("data"),
            "file": f"libere_{gara}.json", "sessioni": slugs}
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

    sessioni = {}
    slugs = []
    for cartella, slug, etichetta in SESSIONI:
        d = scarica(args.ti, cartella)
        if d is None:
            continue
        piloti = costruisci_quali_da_ti(d, colori)
        if len(piloti) < MIN_PILOTI:
            continue     # sessione appena iniziata: si riprovera' al giro dopo
        sessioni[slug] = {"sessione": etichetta, "piloti": piloti}
        slugs.append(slug)

    if not sessioni:
        sys.exit(f"[libere] nessuna sessione utile online per {args.gara} "
                 f"(o tutte parziali): non pubblico.")

    doc = {"gara": args.gara, "evento": args.evento, "data": args.data,
           "sessioni": sessioni}
    fp, man_fp = scrivi(doc, args.gara, args.evento, slugs, args.out_dir)
    print(f"[libere] scritto {fp} (sessioni: {', '.join(slugs)}) + {man_fp}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
