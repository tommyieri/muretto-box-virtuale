#!/usr/bin/env python3
"""formati/numero.py — un numero solo, misurato, con scritto da dove viene.

E' IL FORMATO DEL PRE-LANCIO. Non racconta una domenica: racconta cosa sappiamo.
Un risultato di gara invecchia in tre giorni, «fermarsi ai box a Spa costa 18,40
secondi» no — ed e' un numero che nessun'altra pagina di F1 pubblica, perche'
nessun'altra pagina lo ha misurato.

Il disegno e' quasi vuoto di proposito: su un profilo fatto di torri e grafici,
una tela con dentro un numero solo e' quella che ferma il pollice.
"""
from __future__ import annotations

from .. import marca as M
from . import base


def disegna(fatto, cartella: str) -> dict:
    d = fatto.dati
    ac = base.accento(fatto)
    t = base.apri(fatto, "feed")

    occhiello = d.get("circuito") or fatto.gara or "misurato dal Muretto"
    y = t.occhiello(232, occhiello, colore=ac)

    # il numero, grande quanto la colonna glielo consente
    _, piede = t.cifrone(M.MARGINE, y + 70, d["valore"], None, dim=300,
                         colore="testo", larghezza_max=M.LARGA)

    # l'unita' SOTTO l'inchiostro vero, non sotto il corpo nominale del font
    y_u = piede + 34
    alto = 0
    for i, riga in enumerate(str(d.get("unita", "")).split("\n")):
        t.testo(M.MARGINE, y_u + i * 58, riga, "disp", 52, 700, ac,
                tracking=.04, maiuscolo=True)
        alto = y_u + (i + 1) * 58

    if d.get("nota"):
        t.testo(M.MARGINE, alto + 34, d["nota"], "mono", 26, 400, "calmo", tracking=.04)
        alto += 34 + 26

    # la frase intera, in piccolo: chi arriva dal profilo capisce senza contesto
    t.piastra(M.MARGINE, 1074, M.LARGA, 108, r=12, riemp="carbonio", bordo="bordo")
    t.paragrafo(M.MARGINE + 30, 1102, fatto.titolo, M.LARGA - 60, "sans", 32, 500,
                "testo", interlinea=1.28, massimo_righe=2)

    base.chiudi(t, fatto)
    p = base.percorso(cartella, "numero-feed.jpg")
    t.salva(p)
    return {"immagini": [p],
            "alt": [f"{fatto.titolo} — dato misurato dal Muretto Box Virtuale."]}
