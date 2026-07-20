#!/usr/bin/env python
"""Estrazione dei buchi di feed da una registrazione del collettore
(PREREG_HUN_PREP, P3): buchi > 10 s tra messaggi consecutivi DENTRO la
sessione attiva, con lo stato che il sito mostrava in quel momento.

Definizioni (pre-registrate in PREREG_HUN_PREP.md):
  - sessione attiva = dal primo all'ultimo messaggio con dati di
    posizione della registrazione (v1/location per i JSONL OpenF1,
    Position.z per i .txt SignalR);
  - buco = differenza > 10 s tra i timestamp di due messaggi consecutivi
    (qualunque topic) dentro la sessione attiva;
  - stato del sito durante un buco, dalle regole pre-registrate della
    pagina live (live_config.mjs + live.html):
      +10 s  -> marker grigi (staleness);
      +30 s  -> badge "NESSUNA SESSIONE IN CORSO" (heartbeat);
      +60 s  -> marker rimossi.

Input: .jsonl (OpenF1, timestamp di RICEZIONE) oppure .txt (SignalR,
timestamp di busta del feed — dichiarato: non e' l'arrivo locale ma il
jitter e' dell'ordine del secondo, irrilevante su soglia 10 s).

Uso:
  .venv/bin/python live/estrai_gap.py REGISTRAZIONE... [--soglia-s 10]
      [--out report.json]
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "collector"))

SOGLIA_GAP_S = 10.0
STALE_GRIGIO_S = 10.0      # live_config.mjs (pre-registrate, Fase 3)
HEARTBEAT_LIVE_S = 30.0
STALE_RIMOZIONE_S = 60.0


def flusso_timestamp(path):
    """Genera (ts, ha_posizione) da una registrazione .jsonl o .txt."""
    if path.suffix == ".jsonl":
        from ingress_openf1 import leggi_jsonl
        for topic, _payload, ts in leggi_jsonl(path):
            if ts is not None:
                yield ts, topic == "v1/location"
    else:
        from decoder import messaggi
        for topic, _payload, ts in messaggi(path):
            if ts is not None:
                yield ts, topic == "Position.z"


def stato_sito(durata_s):
    """Cosa mostrava il sito durante un buco di questa durata."""
    fasi = [f"marker grigi da +{STALE_GRIGIO_S:.0f} s"]
    if durata_s > HEARTBEAT_LIVE_S:
        fasi.append(f"badge NESSUNA SESSIONE IN CORSO da +{HEARTBEAT_LIVE_S:.0f} s")
    if durata_s > STALE_RIMOZIONE_S:
        fasi.append(f"marker rimossi da +{STALE_RIMOZIONE_S:.0f} s")
    return "; ".join(fasi)


def analizza(path, soglia_s):
    serie = list(flusso_timestamp(path))
    if not serie:
        return {"file": str(path), "errore": "nessun timestamp"}
    pos = [ts for ts, e_pos in serie if e_pos]
    if not pos:
        return {"file": str(path), "errore": "nessun dato di posizione: "
                                             "sessione attiva non definibile"}
    inizio_att, fine_att = min(pos), max(pos)
    buchi = []
    prec = None
    for ts, _e_pos in serie:
        if prec is not None and inizio_att <= prec and ts <= fine_att:
            d = (ts - prec).total_seconds()
            if d > soglia_s:
                buchi.append({
                    "inizio_utc": prec.isoformat(sep=" ", timespec="seconds"),
                    "durata_s": round(d, 1),
                    "sito": stato_sito(d),
                })
        if prec is None or ts > prec:
            prec = ts
    return {
        "file": str(path),
        "sessione_attiva_utc": [
            inizio_att.isoformat(sep=" ", timespec="seconds"),
            fine_att.isoformat(sep=" ", timespec="seconds")],
        "messaggi": len(serie),
        "soglia_s": soglia_s,
        "buchi": buchi,
    }


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Buchi > soglia nel feed registrato, con lo stato "
                    "che il sito mostrava.")
    ap.add_argument("file", nargs="+",
                    help="registrazioni .jsonl (OpenF1) o .txt (SignalR)")
    ap.add_argument("--soglia-s", type=float, default=SOGLIA_GAP_S)
    ap.add_argument("--out", help="scrive il report JSON qui")
    args = ap.parse_args()

    esiti = [analizza(Path(f), args.soglia_s) for f in args.file]
    for e in esiti:
        print(f"== {e['file']} ==")
        if "errore" in e:
            print(f"   {e['errore']}")
            continue
        a0, a1 = e["sessione_attiva_utc"]
        print(f"   sessione attiva: {a0} -> {a1} ({e['messaggi']} messaggi)")
        if not e["buchi"]:
            print(f"   nessun buco > {e['soglia_s']:.0f} s")
        for b in e["buchi"]:
            print(f"   BUCO {b['durata_s']:>7.1f} s da {b['inizio_utc']} "
                  f"— sito: {b['sito']}")
    if args.out:
        Path(args.out).write_text(
            json.dumps({"_nota": ("buchi di feed da live/estrai_gap.py "
                                  "(definizioni in PREREG_HUN_PREP.md)"),
                        "esiti": esiti}, ensure_ascii=False, indent=1),
            encoding="utf-8")
        print(f"-> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
