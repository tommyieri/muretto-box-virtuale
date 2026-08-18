#!/usr/bin/env python3
"""genera.py — da una gara a una cartella di bozze pronte da guardare.

    fatti.raccogli()  ->  formati.disegna()  ->  didascalia.scrivi()  ->  bozze/

Non pubblica niente: scrive in `bozze/`, che e' area Lab. Portare online e' un
atto separato e umano (`coda.py`), e la pubblicazione vera un altro ancora
(`pubblica.py`). Stessa scala di confini della redazione.

QUANTI POST. Non tutti quelli che riesce a fare: `MASSIMO_PER_GARA`. Una
settimana con nove post identici nella forma stanca il pubblico piu' in fretta di
una con tre. La scelta la fa la `forza` del fatto, e i doppioni dello stesso tipo
si scartano — meglio tre formati diversi che tre soste.

Uso:
    python3 ai_lab/social/genera.py --gara Belgio
    python3 ai_lab/social/genera.py --tutte            # tutte le gare con dati
    python3 ai_lab/social/genera.py --numeri           # solo i fatti senza gara
"""
from __future__ import annotations
import os
import json
import shutil
import argparse
import datetime
import hashlib

from . import fatti as F
from . import formati
from . import didascalia as D
from . import marca as M

QUI = os.path.dirname(os.path.abspath(__file__))
BOZZE = os.path.join(QUI, "bozze")

MASSIMO_PER_GARA = 3
FORZA_MINIMA = 0.45


def _id(fatto) -> str:
    """Un identificatore stabile: lo stesso fatto rigenerato non crea una bozza
    nuova. Serve perche' la pipeline gira ogni mezz'ora e non deve accumulare
    ottanta copie dello stesso post."""
    seme = f"{fatto.tipo}|{fatto.gara}|{fatto.titolo}"
    return f"{fatto.tipo}-{(fatto.gara or 'x').lower().replace(' ', '-')}-" \
           f"{hashlib.sha1(seme.encode()).hexdigest()[:8]}"


def scegli(elenco: list, massimo: int = MASSIMO_PER_GARA, vari: bool = True) -> list:
    """I migliori, e di norma di tipi diversi: in una settimana di gara la
    varieta' vale piu' della forza — tre soste di fila stancano prima di tre
    formati diversi.

    `vari=False` toglie il vincolo. Serve al pre-lancio: i fatti «numero» sono
    due (pit-loss e degrado) e col vincolo attivo ne usciva sempre e solo uno,
    proprio nelle tre settimane in cui sono l'unico materiale che non dipende
    dalla domenica.
    """
    fuori, tipi = [], set()
    for f in sorted(elenco, key=lambda x: -x.forza):
        if f.forza < FORZA_MINIMA or not formati.sa_disegnare(f.tipo):
            continue
        if vari and f.tipo in tipi:
            continue
        tipi.add(f.tipo)
        fuori.append(f)
        if len(fuori) >= massimo:
            break
    return fuori


def genera_uno(fatto, forza_rifare: bool = False) -> dict | None:
    ident = _id(fatto)
    cartella = os.path.join(BOZZE, ident)
    stato_p = os.path.join(cartella, "stato.json")

    if os.path.exists(stato_p) and not forza_rifare:
        st = json.load(open(stato_p, encoding="utf-8"))
        if st.get("stato") != "bozza":
            return None                      # gia' giudicata: non si tocca
        shutil.rmtree(cartella)              # ancora bozza: si riscrive aggiornata

    os.makedirs(cartella, exist_ok=True)
    reso = formati.disegna(fatto, cartella)
    testo = D.scrivi(fatto)
    ok, intruse = D.cifre_coerenti(testo, fatto)
    if not ok:
        # non si pubblica una didascalia con dentro un numero che il fatto non ha
        print(f"[social] {ident}: didascalia con cifre estranee {intruse} — scarto")
        shutil.rmtree(cartella, ignore_errors=True)
        return None

    post = {
        "id": ident,
        "tipo": fatto.tipo,
        "gara": fatto.gara,
        "titolo": fatto.titolo,
        "provenienza": fatto.provenienza,
        "forza": round(fatto.forza, 3),
        "didascalia": testo,
        "prima_riga": D.prima_riga(testo),
        "immagini": [os.path.basename(p) for p in reso["immagini"]],
        "alt": reso.get("alt", []),
        "creato_il": datetime.datetime.now().isoformat(timespec="seconds"),
    }
    json.dump(post, open(os.path.join(cartella, "post.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    json.dump({"stato": "bozza", "storia": [
        {"stato": "bozza", "attore": "auto", "quando": post["creato_il"]}]},
        open(stato_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return post


def genera(gara: str | None = None, massimo: int = MASSIMO_PER_GARA,
           vari: bool = True) -> list:
    if not M.font_veri():
        # un post in Arial non e' un post del Muretto: meglio nessun post
        print(f"[social] FERMO: mancano i font {M.mancanti()} — "
              f"rilanciare lo scarico in ai_lab/social/font/")
        return []
    fatti_gara = F.raccogli(gara)
    fuori = []
    for f in scegli(fatti_gara, massimo, vari):
        p = genera_uno(f)
        if p:
            fuori.append(p)
    return fuori


def main():
    ap = argparse.ArgumentParser(description="genera bozze social dai dati veri")
    ap.add_argument("--gara")
    ap.add_argument("--tutte", action="store_true")
    ap.add_argument("--numeri", action="store_true",
                    help="solo i fatti che non dipendono da una gara")
    ap.add_argument("--massimo", type=int, default=MASSIMO_PER_GARA)
    a = ap.parse_args()

    gare = ([None] if a.numeri else
            F.gare_disponibili() if a.tutte else
            [a.gara] if a.gara else [F.gare_disponibili()[-1]])

    # I fatti che non dipendono da una gara (i «numeri») escono per OGNI gara e
    # hanno lo stesso id stabile: sul disco sono una bozza sola. Contare le righe
    # invece delle cartelle dava «33 bozze» dove la coda ne mostrava 23.
    tot = {}
    for g in gare:
        for p in genera(g, a.massimo, vari=not a.numeri):
            if p["id"] not in tot:
                print(f"  {p['id']:<38} [{p['forza']:.2f}] {p['prima_riga'][:60]}")
            tot[p["id"]] = p
    print(f"\n{len(tot)} bozze in {BOZZE}")
    if tot:
        print("guardale con:  python3 ai_lab/social/coda.py --lista")


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.abspath(os.path.join(QUI, "..", "..")))
    main()
