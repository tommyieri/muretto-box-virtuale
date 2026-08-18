#!/usr/bin/env python3
"""formati/base.py — l'ossatura comune di ogni post.

Ogni formato disegna cose diverse ma la CORNICE e' sempre la stessa: fascia
d'accento, marchio, occhiello, titolo, e in fondo la riga di provenienza. Se ogni
formato se la ridisegnasse per conto suo, dopo sei formati il profilo sembrerebbe
sei account diversi. La coerenza della griglia e' cio' che, scorrendo, fa
riconoscere il Muretto prima di aver letto una parola.

INTERFACCIA. Un formato e' una funzione:

    disegna(fatto, cartella) -> dict con {immagini: [percorsi], alt: [str]}

Non scrive didascalie (le fa `didascalia.py`) e non pubblica (lo fa `coda.py`).
"""
from __future__ import annotations
import os

from .. import marca as M
from ..tela import Tela

ACCENTI = {
    "sosta": "rosso", "compagni": "ciano", "numero": "rosso",
    "mescole": "ambra", "classifica": "viola",
}


def accento(fatto) -> str:
    return fatto.dati.get("accento") or ACCENTI.get(fatto.tipo, "rosso")


def apri(fatto, formato="feed", s=2) -> Tela:
    """La tela gia' vestita: fondo, fascia, marchio."""
    ac = accento(fatto)
    t = Tela(formato, s=s)
    t.ground(alone=ac)
    t.barra_alto(ac)
    t.marchio()
    return t


def chiudi(t: Tela, fatto, y=None):
    """La riga di provenienza. Passa da qui perche' nessun formato deve poterla
    dimenticare: e' la firma del progetto."""
    t.pie_pagina(fatto.provenienza, y=y)


def titolo_grande(t: Tela, y, righe, accento_su=-1, colore_acc="rosso",
                  dim=None, interlinea=1.02):
    """Il titolo a blocchi, con l'ultima riga (o quella indicata) in accento.
    Restituisce la y sotto l'ultima riga."""
    dim = dim or M.TIPO["titolo"]
    n = len(righe)
    for i, r in enumerate(righe):
        col = colore_acc if (i == accento_su or (accento_su == -1 and i == n - 1)) else "testo"
        t.testo(M.MARGINE, y + i * dim * interlinea, r, "disp", dim, 700, col,
                tracking=.005, maiuscolo=True)
    return y + n * dim * interlinea


def spezza_titolo(t: Tela, testo, dim=None, larghezza=None, massimo=4):
    """Manda a capo un titolo alla larghezza della colonna, in maiuscolo
    condensato. Torna la lista di righe."""
    dim = dim or M.TIPO["titolo"]
    larghezza = larghezza or M.LARGA
    righe, cur = [], ""
    for p in testo.upper().split():
        prova = (cur + " " + p).strip()
        if t.larghezza(prova, "disp", dim, 700, .005) <= larghezza or not cur:
            cur = prova
        else:
            righe.append(cur)
            cur = p
    if cur:
        righe.append(cur)
    return righe[:massimo]


def percorso(cartella, nome) -> str:
    os.makedirs(cartella, exist_ok=True)
    return os.path.join(cartella, nome)


def freccia_su_giu(t: Tela, x, y, lato, verso, colore):
    """Il triangolino guadagno/perdita. verso: +1 su, -1 giu'."""
    if verso > 0:
        punti = [(x, y + lato), (x + lato / 2, y), (x + lato, y + lato)]
    else:
        punti = [(x, y), (x + lato / 2, y + lato), (x + lato, y)]
    t.d.polygon([(t._p(a), t._p(b)) for a, b in punti], fill=M.rgb(colore))
