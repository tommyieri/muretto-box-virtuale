#!/usr/bin/env python3
"""coda.py — il cancello umano fra la bozza e Instagram.

Stesso confine della redazione (`ai_lab/redazione/coda.py`), con una differenza
che conta: qui NON esiste una politica di auto-pubblicazione, e non deve
esistere. Un articolo sbagliato sul sito si corregge e la versione vecchia
sparisce; un post sbagliato su Instagram e' gia' negli screenshot di qualcuno
dieci minuti dopo. L'asimmetria e' tutta da una parte, quindi il cancello sta
sempre chiuso finche' un essere umano non lo apre.

    bozza ──approva(attore)──► approvato ──pubblica.py──► pubblicato
          └─respingi(attore)─► respinto (resta, col perche')

APPROVARE NON PUBBLICA. Mette solo il post in fila. La pubblicazione vera e' un
comando a parte, con la sua conferma: cosi' nessuno pubblica per errore mentre
sta solo facendo ordine nella coda.

Uso:
    python3 ai_lab/social/coda.py --lista
    python3 ai_lab/social/coda.py --mostra <id>
    python3 ai_lab/social/coda.py --approva <id> --attore "Tommi" [--nota "..."]
    python3 ai_lab/social/coda.py --respingi <id> --attore "Tommi" --nota "perche'"
"""
from __future__ import annotations
import os
import json
import argparse
import datetime

QUI = os.path.dirname(os.path.abspath(__file__))
BOZZE = os.path.join(QUI, "bozze")

TRANSIZIONI = {
    "bozza": {"approvato", "respinto"},
    "approvato": {"pubblicato", "respinto", "bozza"},
    "respinto": {"bozza"},
    "pubblicato": set(),          # cio' che e' uscito e' uscito
}
ATTI_UMANI = {"approvato", "respinto"}


def _dir(ident):
    return os.path.join(BOZZE, ident)


def leggi(ident) -> tuple:
    d = _dir(ident)
    post = json.load(open(os.path.join(d, "post.json"), encoding="utf-8"))
    stato = json.load(open(os.path.join(d, "stato.json"), encoding="utf-8"))
    return post, stato


def scrivi_stato(ident, stato):
    json.dump(stato, open(os.path.join(_dir(ident), "stato.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)


def elenco() -> list:
    if not os.path.isdir(BOZZE):
        return []
    fuori = []
    for n in sorted(os.listdir(BOZZE)):
        try:
            post, stato = leggi(n)
        except Exception:
            continue
        fuori.append((n, post, stato))
    return fuori


def transizione(ident, nuovo, attore, nota=None):
    post, stato = leggi(ident)
    ora = stato.get("stato", "bozza")
    if nuovo not in TRANSIZIONI.get(ora, set()):
        raise ValueError(f"{ident}: da '{ora}' non si va a '{nuovo}'")
    if nuovo in ATTI_UMANI and (not attore or attore.strip().lower() == "auto"):
        # il senso di questo file e' tutto qui
        raise ValueError(f"'{nuovo}' e' un atto umano: serve --attore con un nome vero")
    stato["stato"] = nuovo
    stato.setdefault("storia", []).append({
        "stato": nuovo, "attore": attore,
        "quando": datetime.datetime.now().isoformat(timespec="seconds"),
        **({"nota": nota} if nota else {})})
    scrivi_stato(ident, stato)
    return stato


def approvati() -> list:
    return [(n, p) for n, p, s in elenco() if s.get("stato") == "approvato"]


SIMBOLO = {"bozza": "·", "approvato": "✓", "respinto": "✗", "pubblicato": "▲"}


def main():
    ap = argparse.ArgumentParser(description="la coda di revisione dei post")
    ap.add_argument("--lista", action="store_true")
    ap.add_argument("--mostra")
    ap.add_argument("--approva")
    ap.add_argument("--respingi")
    ap.add_argument("--attore")
    ap.add_argument("--nota")
    a = ap.parse_args()

    if a.lista or not any([a.mostra, a.approva, a.respingi]):
        righe = elenco()
        if not righe:
            print("nessuna bozza. generane con:  python3 -m ai_lab.social.genera --gara <Gara>")
            return
        print(f"{'':2} {'id':<38} {'tipo':<11} {'forza':>5}  prima riga")
        for n, p, s in righe:
            st = s.get("stato", "bozza")
            print(f"{SIMBOLO.get(st, '?'):2} {n:<38} {p['tipo']:<11} "
                  f"{p.get('forza', 0):>5.2f}  {p.get('prima_riga', '')[:52]}")
        conteggi = {}
        for _, _, s in righe:
            conteggi[s.get("stato", "bozza")] = conteggi.get(s.get("stato", "bozza"), 0) + 1
        print("\n" + " · ".join(f"{SIMBOLO.get(k, '?')} {k}: {v}" for k, v in sorted(conteggi.items())))
        return

    if a.mostra:
        post, stato = leggi(a.mostra)
        print(f"--- {a.mostra}  [{stato.get('stato')}]")
        print(f"tipo: {post['tipo']}   gara: {post['gara']}   forza: {post.get('forza')}")
        print(f"immagini: {', '.join(os.path.join(_dir(a.mostra), i) for i in post['immagini'])}")
        print(f"\nprovenienza: {post['provenienza']}")
        print("\n" + "=" * 60 + "\n" + post["didascalia"] + "\n" + "=" * 60)
        for s in stato.get("storia", []):
            print(f"  {s['quando']}  {s['stato']:<11} {s.get('attore', '')} {s.get('nota', '')}")
        return

    ident = a.approva or a.respingi
    nuovo = "approvato" if a.approva else "respinto"
    try:
        st = transizione(ident, nuovo, a.attore, a.nota)
    except ValueError as e:
        raise SystemExit(f"[coda] {e}")
    print(f"{ident} -> {st['stato']} (da {a.attore})")
    if nuovo == "approvato":
        print("NB: approvare non pubblica. Per mandarlo davvero online:\n"
              "    python3 -m ai_lab.social.pubblica --id " + ident + " --conferma")


if __name__ == "__main__":
    main()
