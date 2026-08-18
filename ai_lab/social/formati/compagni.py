#!/usr/bin/env python3
"""formati/compagni.py — stessa macchina, giornata diversa.

PERCHE' FUNZIONA SU INSTAGRAM. E' l'unico confronto in F1 in cui il mezzo non e'
una scusa, quindi e' l'unico su cui la gente litiga volentieri nei commenti. E il
numero che mettiamo non e' il giro veloce — e' la MEDIANA dei giri puliti, cioe'
il passo vero: un pilota puo' avere il giro veloce e il passo peggiore, e questa
distinzione da sola vale il post.
"""
from __future__ import annotations

from .. import marca as M
from .. import fatti as F
from . import base


def _tempo(s: float) -> str:
    """Secondi -> 1:50,717, come si legge in televisione. I millesimi restano
    tutti: su un passo mediano la terza cifra e' spesso l'intera differenza."""
    m = int(s // 60)
    if not m:
        return F.num(s, 3)
    return f"{m}:{s - m * 60:06.3f}".replace(".", ",")


def disegna(fatto, cartella: str) -> dict:
    d = fatto.dati
    ac = base.accento(fatto)
    t = base.apri(fatto, "feed")

    y = t.occhiello(212, f"{d.get('circuito') or fatto.gara} · {d['team']}", colore=ac)

    righe = base.spezza_titolo(t, "stessa macchina", dim=104, massimo=1)
    y = base.titolo_grande(t, y + 30, righe, accento_su=None, dim=104)
    t.testo(M.MARGINE, y + 6, f"{F.num(abs(d['divario']))} s al giro di differenza",
            "disp", 56, 700, ac, tracking=.02, maiuscolo=True)

    # le due colonne, divise dalla livrea della squadra
    y_c = y + 106
    alt = 300
    largo = (M.LARGA - 40) / 2
    for i, (sig, pos, passo) in enumerate([
            (d["davanti"], d["pos_davanti"], d["passo_davanti"]),
            (d["dietro"], d["pos_dietro"], d["passo_dietro"])]):
        x = M.MARGINE + i * (largo + 40)
        primo = (i == 0)
        t.piastra(x, y_c, largo, alt, r=14,
                  riemp="alto" if primo else "piastra",
                  bordo="bordo-2" if primo else "bordo")
        # la livrea in cima alla piastra
        t.d.rectangle([t._p(x), t._p(y_c), t._p(x + largo), t._p(y_c + 5)],
                      fill=M.rgb(d["colore"]))
        t.testo(x + 28, y_c + 40, sig, "disp", 120, 700,
                "testo" if primo else "calmo", tracking=.02)
        t.testo(x + largo - 28, y_c + 58, f"P{pos}", "mono", 40, 700,
                "testo" if primo else "fioco", ancora="ra")
        t.d.rectangle([t._p(x + 28), t._p(y_c + 186), t._p(x + largo - 28), t._p(y_c + 187)],
                      fill=M.rgb("bordo"))
        t.testo(x + 28, y_c + 206, "passo mediano", "mono", 21, 400, "fioco",
                tracking=.14, maiuscolo=True)
        t.testo(x + 28, y_c + 238, _tempo(passo), "mono", 46, 700,
                "testo" if primo else "calmo")

    # COSA VUOL DIRE quel divario. Nove decimi al giro non dicono niente finche'
    # non li moltiplichi per la gara. La moltiplicazione e' scritta in chiaro
    # (0,89 × 44) e il condizionale c'e': proiettare un passo mediano su tutta la
    # gara e' aritmetica, non e' una previsione: nella gara vera ci sono le soste,
    # il traffico e le bandiere. Dirlo e' la differenza fra un dato e una vanteria.
    y_n = y_c + alt + 44
    giri = d.get("n_giri")
    if giri:
        tot = abs(d["divario"]) * giri
        t.piastra(M.MARGINE, y_n, M.LARGA, 176, r=12, riemp="carbonio", bordo="bordo")
        t.testo(M.MARGINE + 30, y_n + 26, "su tutta la gara", "mono", 22, 400,
                "fioco", tracking=.14, maiuscolo=True)
        t.testo(M.MARGINE + 30, y_n + 62,
                f"{F.num(abs(d['divario']))} × {giri} giri = {F.num(tot, 1)} s",
                "mono", 46, 700, ac)
        t.paragrafo(M.MARGINE + 30, y_n + 124,
                    "aritmetica, non una previsione: nella gara vera ci sono soste, "
                    "traffico e bandiere.", M.LARGA - 60, "sans", 25, 400, "fioco",
                    interlinea=1.25, massimo_righe=2)
        y_n += 200

    # NIENTE targa riassuntiva: ripeteva parola per parola il titolo qui sopra.
    # Su una tela stretta lo spazio bianco vale piu' di una frase gia' letta.
    base.chiudi(t, fatto)
    p = base.percorso(cartella, "compagni-feed.jpg")
    t.salva(p)
    return {"immagini": [p],
            "alt": [f"Confronto fra compagni di squadra {d['davanti']} e {d['dietro']} "
                    f"({d['team']}) al {fatto.gara}."]}
