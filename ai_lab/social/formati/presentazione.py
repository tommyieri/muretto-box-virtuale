#!/usr/bin/env python3
"""formati/presentazione.py — «questo è il Muretto, e questo è cosa fa».

Gli altri formati mostrano il prodotto AL LAVORO su una gara. Questo lo presenta
e basta, e serve in due momenti: il primo post di un profilo vuoto, e ogni volta
che arriva gente nuova da un reel e non ha idea di cosa sia questa pagina.

Non ha numeri di gara, quindi non ha una provenienza da dati: la sua provenienza
e' il prodotto stesso. E' l'unico formato a cui e' concesso — e per questo dice
solo cose che il sito fa davvero, verificabili aprendolo.
"""
from __future__ import annotations

from .. import marca as M
from . import base


def disegna(fatto, cartella: str) -> dict:
    d = fatto.dati
    ac = d.get("accento", "rosso")
    t = base.apri(fatto, "feed")

    y = t.occhiello(206, d.get("occhiello", "murettobox.com"), colore=ac)

    righe = d.get("titolo_righe") or base.spezza_titolo(t, fatto.titolo, dim=98, massimo=3)
    y = base.titolo_grande(t, y + 30, righe, accento_su=d.get("accento_riga", len(righe) - 1),
                           colore_acc=ac, dim=98)

    if d.get("sottotitolo"):
        y += 18
        y += t.paragrafo(M.MARGINE, y, d["sottotitolo"], M.LARGA - 40,
                         "sans", 34, 400, "calmo", interlinea=1.42)

    # le voci: numerate solo se sono davvero una sequenza, altrimenti col trattino
    voci = d.get("voci") or []
    y += 44
    for i, v in enumerate(voci):
        alt = 128
        t.piastra(M.MARGINE, y, M.LARGA, alt, r=12, riemp="piastra", bordo="bordo")
        t.d.rectangle([t._p(M.MARGINE), t._p(y), t._p(M.MARGINE + 4), t._p(y + alt)],
                      fill=M.rgb(ac))
        t.testo(M.MARGINE + 30, y + 26, v["titolo"], "disp", 44, 700, "testo",
                tracking=.02, maiuscolo=True)
        t.paragrafo(M.MARGINE + 30, y + 76, v["testo"], M.LARGA - 70,
                    "sans", 26, 400, "calmo", interlinea=1.32, massimo_righe=1)
        y += alt + 14

    if d.get("chiusa"):
        y += 20
        t.testo(M.MARGINE, y, d["chiusa"], "disp", 52, 700, ac, tracking=.02, maiuscolo=True)

    base.chiudi(t, fatto)
    p = base.percorso(cartella, "presentazione-feed.jpg")
    t.salva(p)
    return {"immagini": [p], "alt": [d.get("alt") or fatto.titolo]}
