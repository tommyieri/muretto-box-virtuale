#!/usr/bin/env python3
"""formati/classifica.py — il campionato dopo l'ultima gara.

Formato di servizio: non e' il post che fa crescere il profilo, e' quello che lo
tiene vivo fra una gara e l'altra e che la gente salva. La torre e' la stessa del
sito e della televisione, coi punti in monospazio incolonnati.
"""
from __future__ import annotations

from .. import marca as M
from . import base


def disegna(fatto, cartella: str) -> dict:
    d = fatto.dati
    ac = base.accento(fatto)
    t = base.apri(fatto, "feed")

    y = t.occhiello(212, f"dopo {d.get('titolo_gara', '')} · round {d.get('round', '')}",
                    colore=ac)
    y = base.titolo_grande(t, y + 30, ["il campionato", "piloti"],
                           accento_su=1, colore_acc=ac, dim=96)

    y_r = y + 54
    alt = 88
    massimo = max((p["punti"] for p in d["piloti"]), default=1) or 1
    for p in d["piloti"]:
        primo = p["pos"] == 1
        if primo:
            t.piastra(M.MARGINE, y_r - 6, M.LARGA, alt - 4, r=10,
                      riemp="alto", bordo="bordo-2")
        # la barra dei punti, dietro, discreta: fa vedere il distacco senza numeri
        t.d.rectangle([t._p(M.MARGINE + 250), t._p(y_r + alt - 20),
                       t._p(M.MARGINE + 250 + (M.LARGA - 420) * p["punti"] / massimo),
                       t._p(y_r + alt - 17)], fill=M.rgb(p["colore"]))
        t.testo(M.MARGINE + 24, y_r + alt / 2 - 8, str(p["pos"]), "mono", 34, 400,
                "testo" if primo else "fioco", ancora="lm")
        t.d.rectangle([t._p(M.MARGINE + 86), t._p(y_r + 14),
                       t._p(M.MARGINE + 91), t._p(y_r + alt - 26)],
                      fill=M.rgb(p["colore"]))
        t.testo(M.MARGINE + 112, y_r + alt / 2 - 8, p["sigla"], "disp", 46, 700,
                "testo" if primo else "calmo", tracking=.04, ancora="lm")
        t.testo(M.MARGINE + M.LARGA - 24, y_r + alt / 2 - 8,
                f"{p['punti']:.0f}", "mono", 46, 700,
                "testo" if primo else "calmo", ancora="rm")
        if not primo and p.get("distacco"):
            t.testo(M.MARGINE + M.LARGA - 130, y_r + alt / 2 - 8,
                    f"−{abs(p['distacco']):.0f}", "mono", 26, 400, "fioco", ancora="rm")
        y_r += alt

    base.chiudi(t, fatto)
    p = base.percorso(cartella, "classifica-feed.jpg")
    t.salva(p)
    return {"immagini": [p], "alt": ["Classifica piloti del campionato 2026."]}
