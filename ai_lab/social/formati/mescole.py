#!/usr/bin/env python3
"""formati/mescole.py — quanto e' durata davvero ogni gomma.

Il dato che tutti discutono al bar e che nessuno pubblica: non la durata
DICHIARATA, ma quella osservata, contando l'eta' della gomma al momento in cui
ogni pilota ha cambiato set. Le barre sono nei colori veri delle mescole, quindi
il post si legge senza leggenda.
"""
from __future__ import annotations

from .. import marca as M
from . import base

ORDINE = ["SOFT", "MEDIUM", "HARD"]
NOME = {"SOFT": "morbida", "MEDIUM": "media", "HARD": "dura"}


def disegna(fatto, cartella: str) -> dict:
    d = fatto.dati
    mesc = d["mescole"]
    ac = base.accento(fatto)
    t = base.apri(fatto, "feed")

    y = t.occhiello(212, d.get("circuito") or fatto.gara, colore=ac)
    y = base.titolo_grande(t, y + 30, ["quanto e' durata", "ogni gomma"],
                           accento_su=None, dim=96)

    presenti = [m for m in ORDINE if m in mesc]
    massimo = max(mesc[m]["max"] for m in presenti) or 1

    y_b = y + 60
    alt_riga = 168
    for m in presenti:
        v = mesc[m]
        col = M.colore_mescola(m)
        t.testo(M.MARGINE, y_b, f"{m} · {NOME[m]}", "disp", 44, 700, col,
                tracking=.05, maiuscolo=True)
        # la barra copre min..max, il segno pieno e' la mediana
        x0 = M.MARGINE
        larga = M.LARGA - 250
        t.barra(x0, y_b + 60, larga, 26, v["max"] / massimo, colore="alto", fondo="carbonio")
        t.barra(x0, y_b + 60, larga, 26, v["mediana"] / massimo, colore=col, fondo="carbonio")
        # l'estensione osservata, scritta: la barra da sola nasconde la dispersione
        t.testo(x0, y_b + 100, f"da {v['min']} a {v['max']} giri · {v['n']} stint osservati",
                "mono", 22, 400, "fioco", tracking=.04)
        t.testo(M.MARGINE + M.LARGA, y_b + 44, str(v["mediana"]), "mono", 76, 700,
                "testo", ancora="ra")
        t.testo(M.MARGINE + M.LARGA, y_b + 118, "giri (mediana)", "mono", 21, 400,
                "fioco", tracking=.08, ancora="ra")
        y_b += alt_riga

    base.chiudi(t, fatto)
    p = base.percorso(cartella, "mescole-feed.jpg")
    t.salva(p)
    return {"immagini": [p],
            "alt": [f"Durata mediana di ogni mescola al {fatto.gara}."]}
