#!/usr/bin/env python3
"""marchio.py — il segno del Muretto, disegnato una volta e reso ovunque.

IL CONCETTO. «Muretto box» e' il muro dove siede la squadra e si decide la
strategia. Il segno e' esattamente quello: la **M sopra il muretto**. Due forme
sole — la lettera e la barra che la regge — perche' a 40 pixel, che e' la misura
vera di una foto profilo nel flusso di Instagram, tutto il resto diventa fango.

La M non e' inventata da zero: conserva il taglio condensato di quella che il
sito ha gia' nella favicon. Il muretto sotto e' nuovo, ed e' cio' che distingue
il segno da una qualunque iniziale dentro un quadrato.

UNA SOLA FONTE. Le coordinate stanno qui sotto, in un sistema 0-100, e da quelle
si generano SIA il percorso SVG (per il sito) SIA i poligoni PIL (per i PNG di
Instagram). Disegnarlo due volte a mano vorrebbe dire vederlo divergere alla
prima correzione.

    python3 -m ai_lab.social.marchio            # scrive tutto in demo/assets/marchio/
"""
from __future__ import annotations
import os

from . import marca as M

QUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(QUI, "..", ".."))
USCITA = os.path.join(REPO, "demo", "assets", "marchio")

# ------------------------------------------------------------- la geometria
# Sistema 0-100. Il blocco (M + muretto) e' centrato: va da y=18 a y=83.
M_LETTERA = [
    (20, 64), (20, 18), (31.5, 18), (50, 42), (68.5, 18), (80, 18), (80, 64),
    (69.5, 64), (69.5, 34), (54, 55), (46, 55), (30.5, 34), (30.5, 64),
]
# IL MURETTO. Due misure decidono se si legge come muro o come sottolineatura:
# lo stacco dalla lettera (9, non 8: sotto i 40 px un filo piu' stretto e i due
# segni si fondono) e la sporgenza laterale — il muro esce di 8 per lato oltre la
# M, cosi' la REGGE invece di stare appeso sotto.
MURETTO = [(12, 73), (88, 73), (88, 84), (12, 84)]

RAGGIO_QUADRO = 22          # su 100: lo stesso arrotondamento delle piastre del sito


def _punti(poli, scala=1.0, dx=0.0, dy=0.0):
    return [(x * scala + dx, y * scala + dy) for x, y in poli]


def percorso_svg(poli) -> str:
    d = f"M{poli[0][0]:g} {poli[0][1]:g}"
    for x, y in poli[1:]:
        d += f"L{x:g} {y:g}"
    return d + "Z"


def svg(fondo: str | None = None, inchiostro: str = "#FFFFFF", lato: int = 100,
        tondo: bool = False) -> str:
    """Il segno in SVG. `fondo=None` lo lascia trasparente (versione da usare
    sopra il nero del sito); con un fondo diventa l'icona quadrata o tonda."""
    pezzi = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" '
             f'width="{lato}" height="{lato}" role="img" aria-label="Muretto Box Virtuale">']
    if fondo:
        if tondo:
            pezzi.append(f'<circle cx="50" cy="50" r="50" fill="{fondo}"/>')
        else:
            pezzi.append(f'<rect width="100" height="100" rx="{RAGGIO_QUADRO}" fill="{fondo}"/>')
    pezzi.append(f'<path d="{percorso_svg(M_LETTERA)}" fill="{inchiostro}"/>')
    pezzi.append(f'<path d="{percorso_svg(MURETTO)}" fill="{inchiostro}"/>')
    pezzi.append("</svg>")
    return "".join(pezzi)


def png(lato: int, fondo: str | None = "#FF1E3C", inchiostro: str = "#FFFFFF",
        tondo: bool = False, margine: float = 0.0):
    """Il segno rasterizzato. Si disegna 4x e si rimpicciolisce: le diagonali
    della M a 32 px, senza sovracampionamento, escono seghettate."""
    from PIL import Image, ImageDraw
    S = 4
    L = lato * S
    img = Image.new("RGBA", (L, L), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if fondo:
        if tondo:
            d.ellipse([0, 0, L - 1, L - 1], fill=fondo)
        else:
            d.rounded_rectangle([0, 0, L - 1, L - 1], radius=RAGGIO_QUADRO / 100 * L, fill=fondo)
    # il margine rimpicciolisce il segno DENTRO il fondo, senza spostarne il centro
    scala = L / 100 * (1 - 2 * margine)
    off = L * margine
    for poli in (M_LETTERA, MURETTO):
        d.polygon(_punti(poli, scala, off, off), fill=inchiostro)
    return img.resize((lato, lato), Image.LANCZOS)


def favicon_data_uri() -> str:
    """La stringa pronta da incollare in <link rel=icon>: e' la forma che il sito
    usa gia' oggi, cosi' si sostituisce senza aggiungere una richiesta di rete."""
    import urllib.parse
    s = svg(fondo=M.c("rosso"), inchiostro="#FFFFFF", lato=32)
    return "data:image/svg+xml," + urllib.parse.quote(s, safe="")


def scrivi_tutto(dove: str = USCITA) -> list:
    os.makedirs(dove, exist_ok=True)
    rosso, nero = M.c("rosso"), M.c("nero")
    fatti = []

    def sv(nome, testo):
        p = os.path.join(dove, nome)
        open(p, "w", encoding="utf-8").write(testo)
        fatti.append(p)

    def pg(nome, img):
        p = os.path.join(dove, nome)
        img.save(p)
        fatti.append(p)

    # --- SVG, per il sito
    sv("marchio.svg", svg(fondo=None, inchiostro="#FFFFFF"))            # sopra il nero
    sv("marchio-rosso.svg", svg(fondo=None, inchiostro=rosso))          # sopra il chiaro
    sv("marchio-quadro.svg", svg(fondo=rosso, inchiostro="#FFFFFF"))    # icona
    sv("marchio-tondo.svg", svg(fondo=rosso, inchiostro="#FFFFFF", tondo=True))

    # --- PNG, per Instagram e per i browser
    # La foto profilo la ritaglia Instagram in tondo: il segno sta al 68% del
    # quadro, cosi' il muretto non tocca mai il bordo del ritaglio.
    pg("profilo-1080.png", png(1080, fondo=rosso, margine=.16))
    pg("profilo-320.png", png(320, fondo=rosso, margine=.16))
    pg("icona-512.png", png(512, fondo=rosso, margine=.12))
    pg("icona-180.png", png(180, fondo=rosso, margine=.12))
    pg("icona-32.png", png(32, fondo=rosso, margine=.10))
    pg("marchio-bianco-1024.png", png(1024, fondo=None, inchiostro="#FFFFFF"))
    return fatti


if __name__ == "__main__":
    for p in scrivi_tutto():
        print("  ", os.path.relpath(p, REPO))
    print("\nfavicon pronta da incollare (<link rel=icon href=\"...\">):")
    print(favicon_data_uri()[:120] + "…")
