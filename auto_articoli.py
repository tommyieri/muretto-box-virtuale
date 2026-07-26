"""auto_articoli.py — pubblica gli ARTICOLI della redazione appena una sessione e'
disponibile su FastF1. Pensato per la CRONTAB del Mac (ogni 30 min), gemello di
auto_tele.py ma per i pezzi editoriali.

COSA FA. Trova il Gran Premio del weekend in corso (dal calendario) e, per ogni
sessione utile non ancora fatta, genera -> VERIFICA (verificatore-LLM) -> pubblica
-> mette online. FP1 escluso (assetti/benzina non affidabili).

IDEMPOTENTE. Una sessione gia' fatta viene saltata (stato in data/.auto_articoli_stato.json):
il cron puo' girare ogni 30 min senza sfornare doppioni. Una sessione non ancora su
FastF1 non produce nulla e NON viene segnata: si ritenta al giro dopo.

Uso:
  python3 auto_articoli.py            # genera + commit locale (no push)
  python3 auto_articoli.py --push     # + push su main (deploy Vercel)
  python3 auto_articoli.py --dry-run  # dice solo cosa farebbe
  python3 auto_articoli.py --gara "Ungheria"   # forza il GP
"""
from __future__ import annotations
import os
import sys
import json
import argparse

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_QUI, "ai_lab", "redazione"))
sys.path.insert(0, os.path.join(_QUI, "ai_lab", "redazione", "rilevatori"))

import genera_weekend  # noqa: E402

STATO = os.path.join(_QUI, "data", ".auto_articoli_stato.json")
SESSIONI = ["FP2", "FP3", "Q", "R"]   # FP1 escluso di proposito


def _stato():
    try:
        return json.load(open(STATO))
    except Exception:
        return {}


def _salva(s):
    os.makedirs(os.path.dirname(STATO), exist_ok=True)
    json.dump(s, open(STATO, "w"), ensure_ascii=False, indent=2)


def gp_attivo():
    """Il GP del weekend ATTIVO: quello con la gara entro +/-3 giorni da oggi (cosi'
    resta attivo dal venerdi' fino a un paio di giorni DOPO la gara -> i pezzi post-gara
    fanno in tempo a uscire). gp_weekend_in_corso() invece guarda solo avanti e, finita
    la gara, salterebbe gia' al GP successivo. Fallback: gp_weekend_in_corso()."""
    import datetime
    cal_p = os.path.join(_QUI, "demo", "data", "calendario_2026.json")
    try:
        cal = json.load(open(cal_p))
        oggi = datetime.date.today()
        best, best_d = None, 99
        for g in cal.get("gare", []):
            d = g.get("data")
            if not d:
                continue
            try:
                delta = abs((datetime.date.fromisoformat(d) - oggi).days)
            except ValueError:
                continue
            if delta <= 3 and delta < best_d:
                best, best_d = g.get("nome"), delta
        if best:
            return best
    except Exception:
        pass
    return genera_weekend.gp_weekend_in_corso()


def main():
    ap = argparse.ArgumentParser(description="Auto-pubblica gli articoli per sessione (cron Mac)")
    ap.add_argument("--push", action="store_true", help="commit + push su main (deploy)")
    ap.add_argument("--gara", default=None, help="forza il GP; default = weekend attivo")
    ap.add_argument("--dry-run", action="store_true", help="non pubblica, dice solo cosa farebbe")
    a = ap.parse_args()

    gara = a.gara or gp_attivo()
    if not gara:
        print("nessun GP del weekend in corso (calendario): esco.")
        return 0

    st = _stato()
    fatte = set(st.get(gara, []))
    print(f"GP in corso: {gara} · sessioni gia' fatte: {sorted(fatte) or '-'}")

    for ses in SESSIONI:
        if ses in fatte:
            continue
        # prova a generare i pezzi di questa sessione (self-skip se FastF1 non ha ancora i dati)
        _, prodotti = genera_weekend.genera_per_gp(gara, [ses])
        if not prodotti:
            print(f"  {ses}: non ancora disponibile / niente pezzi — ritento al prossimo giro")
            continue
        if a.dry_run:
            print(f"  {ses}: {len(prodotti)} bozze pronte (dry-run, NON pubblico): "
                  f"{[r['id'] for r in prodotti]}")
            continue
        pubbl = genera_weekend.pubblica_e_deploy(prodotti, deploy=a.push)
        fatte.add(ses)
        st[gara] = sorted(fatte)
        _salva(st)
        print(f"  {ses}: pubblicati {pubbl}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
