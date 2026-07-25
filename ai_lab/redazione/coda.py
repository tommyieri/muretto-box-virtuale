"""
coda.py — la coda di revisione della redazione: il gate umano bozza->pubblicato.

Modella lo stesso confine del laboratorio (ai_lab/designer): l'agente produce
BOZZE; APPROVATO/RESPINTO sono atti UMANI con --attore obbligatorio, scritti in
uno storico append-only.  La pubblicazione (scrittura in demo/, l'unico posto
online) avviene SOLO su APPROVATO.

  bozza ──anteprima──► (visibile solo via link diretto, non nell'indice)
        └─approva(attore)─► approvato ─► pubblicato (compare in analisi.html)
        └─respingi(attore)─► respinto  (resta in bozze, col perche')

Uso:
  python3 ai_lab/redazione/coda.py --lista
  python3 ai_lab/redazione/coda.py --anteprima <id>
  python3 ai_lab/redazione/coda.py --approva <id> --attore "Tommi" [--nota "..."]
  python3 ai_lab/redazione/coda.py --respingi <id> --attore "Tommi" --nota "..."

NB: nessun comando qui fa 'git push'.  Portare online = merge su main, gesto tuo.
"""
from __future__ import annotations
import os
import sys
import json
import argparse
import datetime

_QUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(_QUI, "..", ".."))
BOZZE = os.path.join(_QUI, "bozze")
ANALISI_DIR = os.path.join(REPO, "demo", "data", "analisi")
MANIFEST = os.path.join(REPO, "demo", "data", "analisi_articoli.json")

TRANSIZIONI = {
    "bozza": {"approvato", "respinto"},
    "approvato": {"pubblicato", "respinto"},
    "respinto": {"bozza"},
    "pubblicato": {"respinto"},
}
ATTI_UMANI = {"approvato", "respinto"}


def _oggi():
    return datetime.date.today().isoformat()


def _leggi(id_):
    d = os.path.join(BOZZE, id_)
    art = json.load(open(os.path.join(d, "articolo.json")))
    st = json.load(open(os.path.join(d, "stato.json")))
    return d, art, st


def _card(art):
    return {
        "id": art["id"], "titolo": art["titolo"], "occhiello": art["occhiello"],
        "sommario": art["sommario"], "data": art["data"], "stato": art["stato"],
        "tag": art.get("tag", []), "circuito": art.get("circuito"),
        "sessione": art.get("sessione"), "accent": art.get("accent"),
        # raggruppamento per Gran Premio nell'indice: gp = nome del GP (es. "Ungheria"),
        # assente/None = articolo trasversale (piu' gare). round = ordina i GP.
        "gp": art.get("gp"), "round": art.get("round"),
    }


def _upsert_manifest(card):
    os.makedirs(ANALISI_DIR, exist_ok=True)
    man = []
    if os.path.exists(MANIFEST):
        man = json.load(open(MANIFEST))
    man = [m for m in man if m["id"] != card["id"]]
    man.append(card)
    man.sort(key=lambda m: (m["data"], m["id"]), reverse=True)
    json.dump(man, open(MANIFEST, "w"), ensure_ascii=False, indent=2)


def _scrivi_demo(art):
    """Copia l'articolo (col suo stato) in demo/data/analisi/ e aggiorna l'indice."""
    os.makedirs(ANALISI_DIR, exist_ok=True)
    json.dump(art, open(os.path.join(ANALISI_DIR, art["id"] + ".json"), "w"),
              ensure_ascii=False, indent=2)
    _upsert_manifest(_card(art))


def _salva_stato(d, art, st):
    json.dump(st, open(os.path.join(d, "stato.json"), "w"), ensure_ascii=False, indent=2)
    json.dump(art, open(os.path.join(d, "articolo.json"), "w"), ensure_ascii=False, indent=2)


def transizione(id_, nuovo, attore=None, nota=None):
    d, art, st = _leggi(id_)
    cur = st["stato"]
    if nuovo not in TRANSIZIONI.get(cur, set()):
        amm = ", ".join(sorted(TRANSIZIONI.get(cur, set()))) or "nessuna"
        sys.exit(f"[coda] transizione non ammessa {cur} -> {nuovo}. Ammesse: {amm}")
    if nuovo in ATTI_UMANI and not attore:
        sys.exit(f"[coda] '{nuovo}' e' un atto umano: --attore obbligatorio.")
    st["stato"] = nuovo
    art["stato"] = nuovo
    st.setdefault("storico", []).append(
        {"stato": nuovo, "attore": attore or "redazione", "quando": _oggi(), "nota": nota})
    if attore:
        st["attore"] = attore
    _salva_stato(d, art, st)
    # pubblicazione in demo/ solo da approvato in poi
    if nuovo in ("approvato", "pubblicato"):
        if nuovo == "approvato":
            # approvazione ratifica -> stato finale visibile = pubblicato
            st["stato"] = art["stato"] = "pubblicato"
            st["storico"].append({"stato": "pubblicato", "attore": attore,
                                   "quando": _oggi(), "nota": "pubblicato all'approvazione"})
            _salva_stato(d, art, st)
        _scrivi_demo(art)
    elif nuovo == "respinto":
        # ritira dall'indice se c'era
        if os.path.exists(MANIFEST):
            man = [m for m in json.load(open(MANIFEST)) if m["id"] != id_]
            json.dump(man, open(MANIFEST, "w"), ensure_ascii=False, indent=2)
    return art["stato"]


def anteprima(id_):
    """Rende l'articolo visibile in-sito (via link diretto) SENZA pubblicarlo
    nell'indice: stato resta 'bozza'.  Serve alla revisione umana."""
    _, art, _ = _leggi(id_)
    _scrivi_demo(art)               # manifest lo segna 'bozza' -> l'indice lo salta
    print(f"[coda] anteprima pronta: demo/articolo.html?id={id_}  (stato: {art['stato']}, "
          f"NON nell'indice pubblico)")


def lista():
    if not os.path.isdir(BOZZE):
        print("(nessuna bozza)")
        return
    for id_ in sorted(os.listdir(BOZZE)):
        p = os.path.join(BOZZE, id_, "stato.json")
        if not os.path.exists(p):
            continue
        st = json.load(open(p))
        print(f"  {st['stato']:11} {id_:32} attore={st.get('attore') or '-'}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--lista", action="store_true")
    ap.add_argument("--anteprima", metavar="ID")
    ap.add_argument("--approva", metavar="ID")
    ap.add_argument("--respingi", metavar="ID")
    ap.add_argument("--attore")
    ap.add_argument("--nota")
    a = ap.parse_args()
    if a.lista:
        lista()
    elif a.anteprima:
        anteprima(a.anteprima)
    elif a.approva:
        s = transizione(a.approva, "approvato", a.attore, a.nota)
        print(f"[coda] {a.approva} -> {s} (attore: {a.attore})")
    elif a.respingi:
        s = transizione(a.respingi, "respinto", a.attore, a.nota)
        print(f"[coda] {a.respingi} -> {s} (attore: {a.attore})")
    else:
        ap.print_help()
