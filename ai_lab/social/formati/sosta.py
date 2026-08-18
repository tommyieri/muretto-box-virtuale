#!/usr/bin/env python3
"""formati/sosta.py — «la sosta che ha spostato la gara».

E' IL FORMATO CHIAVE, perche' e' il prodotto in miniatura: il sito serve a
chiedersi cosa succede se ti fermi ORA, e questo post mostra cosa e' successo
davvero quando si e' fermato qualcun altro. Chi lo capisce ha gia' capito
murettobox.com senza che nessuno glielo spieghi.

IL DISEGNO. Due torri di cronometraggio affiancate — prima della sosta e otto
giri dopo — con il pilota evidenziato in tutte e due. Il salto si vede
nell'occhio, non si legge in una didascalia: e' la stessa torre che la gente
guarda in televisione ogni domenica, e non ha bisogno di istruzioni.
"""
from __future__ import annotations

from .. import marca as M
from . import base


def intervallo(pos_a: int, pos_b: int, quante: int = 7) -> tuple:
    """LO STESSO intervallo di posizioni nelle due torri.

    La prima versione centrava la finestra sul pilota in ognuna delle due, e le
    torri finivano per mostrare posizioni diverse (1-5 a sinistra, 4-8 a destra):
    sembravano due classifiche scollegate invece che la stessa classifica che si
    riordina. Con l'intervallo comune le righe sono confrontabili riga per riga,
    e il salto si vede senza doverlo spiegare.
    """
    lo, hi = min(pos_a, pos_b), max(pos_a, pos_b)
    span = hi - lo + 1
    quante = max(quante, span)
    avanzo = quante - span
    da = max(1, lo - avanzo // 2)
    return da, da + quante - 1


def _torre(t, fatto, x, w, y, classifica, etichetta, sigla, colori, da, a):
    ac = base.accento(fatto)
    t.testo(x, y, etichetta, "mono", 24, 700, ac, tracking=.16, maiuscolo=True)
    yy = y + 44
    dentro = sorted(((s, p) for s, p in classifica.items() if da <= p <= a),
                    key=lambda kv: kv[1])
    for s, pos in dentro:
        t.riga_torre(x, yy, w, pos, s, colori.get(s, "#8A8F98"),
                     None, h=62, evidenzia=(s == sigla), dim=32)
        yy += 62
    return yy


def disegna(fatto, cartella: str) -> dict:
    d = fatto.dati
    sigla = d["sigla"]
    ac = base.accento(fatto)
    colori = {s: _col(team) for s, team in d.get("team_di", {}).items()}

    t = base.apri(fatto, "feed")
    y = t.occhiello(212, f"{d.get('circuito') or fatto.gara} · giro {d['giro']} di {d['n_giri']}",
                    colore=ac)

    righe = base.spezza_titolo(t, f"{sigla} si ferma al giro {d['giro']}", dim=98, massimo=2)
    # nessuna riga in accento: qui l'accento se lo prende il verdetto qui sotto
    y = base.titolo_grande(t, y + 30, righe, accento_su=None, dim=98)

    # il verdetto, in una riga sola e grande: e' cio' che si ricorda
    guadagno = d["delta"] > 0
    n = abs(d["delta"])
    colore_esito = "verde" if guadagno else "rosso"
    parola = ("guadagnata" if n == 1 else "guadagnate") if guadagno else \
             ("persa" if n == 1 else "perse")
    base.freccia_su_giu(t, M.MARGINE, y + 26, 34, 1 if guadagno else -1, colore_esito)
    t.testo(M.MARGINE + 52, y + 22, f"{n} posizion{'e' if n == 1 else 'i'} {parola}",
            "disp", 54, 700, colore_esito, tracking=.02, maiuscolo=True)

    # le due torri, sullo STESSO intervallo di posizioni
    da, a = intervallo(d["pos_prima"], d["pos_dopo"])
    y_t = y + 112
    largo = (M.LARGA - 48) / 2
    fondo = _torre(t, fatto, M.MARGINE, largo, y_t, d["classifica_prima"],
                   f"giro {d['giro'] - 1} · prima", sigla, colori, da, a)
    _torre(t, fatto, M.MARGINE + largo + 48, largo, y_t, d["classifica_dopo"],
           f"giro {d['giro'] + 8} · dopo", sigla, colori, da, a)

    # la gomma montata, subito sotto le torri: prima restava orfana in fondo.
    # La pastiglia si posiziona DOPO l'etichetta misurandola, non a occhio: con
    # un offset fisso «RIENTRA CON» ci finiva sotto.
    if d.get("a"):
        etich = "rientra con"
        largo_e = t.testo(M.MARGINE, fondo + 34, etich, "mono", 22, 400, "fioco",
                          tracking=.14, maiuscolo=True)
        t.pastiglia_mescola(M.MARGINE + largo_e + 26, fondo + 26, d["a"], dim=30)

    # LA DOMANDA. Lo spazio in fondo non e' un vuoto da riempire: e' il punto in
    # cui il post smette di raccontare e chiede. Il prodotto serve esattamente a
    # rispondere, quindi la domanda e' anche la dimostrazione.
    y_q = fondo + 104
    t.piastra(M.MARGINE, y_q, M.LARGA, 96, r=12, riemp="carbonio", bordo="bordo")
    t.testo(M.MARGINE + 30, y_q + 48, f"E tu, l’avresti fermato al giro {d['giro']}?",
            "sans", 34, 500, "testo", ancora="lm")

    base.chiudi(t, fatto)
    p = base.percorso(cartella, "sosta-feed.jpg")
    t.salva(p)
    return {
        "immagini": [p],
        "alt": [f"Torre dei tempi prima e dopo la sosta di {sigla} al giro {d['giro']} "
                f"del {fatto.gara}: {n} posizioni {parola}."],
    }


def _col(team):
    from .. import fatti
    return fatti.colore(team)
