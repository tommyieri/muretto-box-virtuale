#!/usr/bin/env python3
"""formati/scelta.py — «lo fermi adesso o fra tre giri?»

E' IL FORMATO DEL PRODOTTO, e da oggi e' il primo di tutti. Gli altri raccontano
la Formula 1; questo fa vedere cosa sa fare il Muretto, che e' una cosa sola e
molto precisa: **dove rientri**, non se conviene.

IL DISEGNO. Due carte affiancate, la domanda sopra, e in mezzo l'unica cosa che
cambia fra le due — il momento. Le posizioni sono grandi come le cifre di un
cronometro perche' sono la risposta, e la risposta e' il prodotto.

La carta migliore e' evidenziata, ma senza la parola «meglio»: il motore dice
dove rientri, non cosa conviene fare. Allargare quella promessa in una didascalia
sarebbe il modo piu' rapido di rendere il prodotto una scommessa.
"""
from __future__ import annotations

from .. import marca as M
from . import base


def _carta(t, x, y, w, h, etichetta, giro_pit, posizione, accento, forte):
    t.piastra(x, y, w, h, r=14,
              riemp="alto" if forte else "piastra",
              bordo=accento if forte else "bordo",
              spess=2 if forte else 1)
    t.testo(x + 26, y + 26, etichetta, "mono", 24, 700,
            accento if forte else "fioco", tracking=.16, maiuscolo=True)
    t.testo(x + 26, y + 62, f"sosta al giro {giro_pit}", "sans", 27, 400, "calmo")
    # la risposta
    t.testo(x + w / 2, y + h - 54, f"P{posizione}", "mono", 128, 700,
            "testo" if forte else "calmo", ancora="md")
    t.testo(x + w / 2, y + h - 40, "dove rientri", "mono", 21, 400, "fioco",
            tracking=.14, ancora="ma", maiuscolo=True)


def disegna(fatto, cartella: str) -> dict:
    d = fatto.dati
    ac = "ciano"
    t = base.apri(fatto, "feed")

    y = t.occhiello(206, f"{d.get('circuito') or fatto.gara} · giro {d['giro']} di {d['n_giri']}",
                    colore="rosso")

    # la domanda, che e' il gancio
    t.testo(M.MARGINE, y + 28, f"{d['pilota']} È {d['pos_al_congelamento']}°.",
            "disp", 100, 700, "testo", tracking=.005)
    t.testo(M.MARGINE, y + 132, "LO FERMI ADESSO?", "disp", 100, 700, "rosso", tracking=.005)

    # le due carte
    y_c = y + 268
    alt = 300
    w = (M.LARGA - 32) / 2
    ora, dopo = d["box_ora"], d["box_dopo"]
    meglio_dopo = d["meglio_aspettare"]
    _carta(t, M.MARGINE, y_c, w, alt, "box ora", ora["giro_pit"], ora["posizione"],
           ac, not meglio_dopo)
    _carta(t, M.MARGINE + w + 32, y_c, w, alt, f"fra {d['attesa']} giri",
           dopo["giro_pit"], dopo["posizione"], ac, meglio_dopo)

    # COSA CAMBIA FRA LE DUE, detto per esteso: e' tutta la lezione del muretto,
    # ed e' anche la garanzia che il confronto sia onesto.
    y_n = y_c + alt + 36
    t.piastra(M.MARGINE, y_n, M.LARGA, 168, r=12, riemp="carbonio", bordo="bordo")
    t.testo(M.MARGINE + 30, y_n + 26, "cosa cambia fra le due", "mono", 21, 400,
            "fioco", tracking=.14, maiuscolo=True)
    t.testo(M.MARGINE + 30, y_n + 62, "solo il momento.", "disp", 52, 700, ac,
            tracking=.02, maiuscolo=True)
    t.testo(M.MARGINE + 30, y_n + 126,
            f"stessa gomma ({d['mescola']}), stesso pit-loss, stessi rivali.",
            "sans", 26, 400, "calmo")

    n = abs(d["differenza"])
    t.piastra(M.MARGINE, y_n + 196, M.LARGA, 96, r=12, riemp="carbonio", bordo="bordo")
    t.testo(M.MARGINE + 30, y_n + 244,
            f"{n} posizion{'e' if n == 1 else 'i'} di differenza. Provalo tu.",
            "sans", 32, 500, "testo", ancora="lm")

    base.chiudi(t, fatto)
    p = base.percorso(cartella, "scelta-feed.jpg")
    t.salva(p)
    return {"immagini": [p],
            "alt": [f"{d['pilota']} al giro {d['giro']} del {fatto.gara}: fermandosi subito "
                    f"rientra {ora['posizione']}°, fermandosi {d['attesa']} giri dopo "
                    f"rientra {dopo['posizione']}°."]}
