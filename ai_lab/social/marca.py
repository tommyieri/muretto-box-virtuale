#!/usr/bin/env python3
"""marca.py — i colori, i font e le misure del Muretto sui formati social.

PERCHE' ESISTE. I token vivono in `demo/muro.css` e li' devono restare: quello e'
il sito. Ma PIL non legge il CSS, e un secondo elenco di colori scritto a mano si
sfasa dal primo alla prima modifica. Quindi qui i valori NON sono ribattuti a
memoria: si leggono da `muro.css` al volo (`_dal_css`), e le costanti qui sotto
sono solo il ripiego se il foglio non e' raggiungibile.

Se un giorno il rosso del sito cambia, cambia anche il rosso dei post, da solo.

LE MISURE NON SONO QUELLE DEL SITO. Il sito si guarda a 1360 px su un monitor;
un post si guarda a ~400 px su un telefono. Un corpo da 15 px del sito qui e'
illeggibile. La scala qui sotto e' ricalcolata per la distanza di lettura vera,
non riscalata da quella del sito.
"""
from __future__ import annotations
import os
import re
import functools

QUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(QUI, "..", ".."))
CSS = os.path.join(REPO, "demo", "muro.css")
FONT = os.path.join(QUI, "font")

# ---------------------------------------------------------------- i colori
# Ripiego: usati solo se muro.css non si legge. Tenuti allineati a mano una volta
# sola (09/08/2026); la fonte viva e' il CSS.
_RIPIEGO = {
    "nero": "#08090C", "carbonio": "#0E1116", "piastra": "#141821",
    "alto": "#1B2029", "bordo": "#242A36", "bordo-2": "#333B4A",
    "testo": "#EDF1F7", "calmo": "#A7B0BF", "fioco": "#838D9D",
    "rosso": "#FF1E3C", "rosso-cupo": "#B3122A", "ciano": "#24E3D2",
    "ambra": "#FFB000", "verde": "#2FD576", "viola": "#B47CFF",
    "soft": "#FF2E3F", "medium": "#FFD32A", "hard": "#EDEFF2",
    "inter": "#43C464", "wet": "#2E7FE8",
}


@functools.lru_cache(maxsize=1)
def _dal_css() -> dict:
    """Legge le variabili :root di muro.css. Se il file non c'e', ripiego."""
    try:
        testo = open(CSS, encoding="utf-8").read()
    except Exception:
        return dict(_RIPIEGO)
    root = re.search(r":root\s*\{(.*?)\}", testo, re.S)
    if not root:
        return dict(_RIPIEGO)
    letti = dict(re.findall(r"--([a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{3,8})\s*;", root.group(1)))
    # il CSS vince, ma cio' che manca lo copre il ripiego
    fusi = dict(_RIPIEGO)
    fusi.update(letti)
    return fusi


def c(nome: str) -> str:
    """Un colore per nome, come nel CSS: c('rosso') -> '#FF1E3C'."""
    v = _dal_css().get(nome)
    if v is None:
        raise KeyError(f"colore sconosciuto: {nome!r}")
    return v


def rgb(nome_o_hex: str) -> tuple:
    h = nome_o_hex if nome_o_hex.startswith("#") else c(nome_o_hex)
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def misto(a: str, b: str, t: float) -> str:
    """Interpola due colori. t=0 -> a, t=1 -> b. Serve alle sfumature."""
    ra, rb = rgb(a), rgb(b)
    v = tuple(round(ra[i] + (rb[i] - ra[i]) * t) for i in range(3))
    return "#%02X%02X%02X" % v


# le mescole, col nome che usa il resto del progetto
MESCOLA = {
    "SOFT": "soft", "MEDIUM": "medium", "HARD": "hard",
    "INTERMEDIATE": "inter", "WET": "wet",
}


def colore_mescola(nome: str | None) -> str:
    return c(MESCOLA.get((nome or "").upper(), "fioco"))


# ----------------------------------------------------------------- i font
_FILE = {
    ("disp", 700): "BarlowCondensed-Bold.ttf",
    ("disp", 600): "BarlowCondensed-SemiBold.ttf",
    ("disp", 500): "BarlowCondensed-Medium.ttf",
    ("sans", 400): "Barlow-Regular.ttf",
    ("sans", 500): "Barlow-Medium.ttf",
    ("sans", 700): "Barlow-Bold.ttf",
    ("mono", 400): "JetBrainsMono-Regular.ttf",
    ("mono", 700): "JetBrainsMono-Bold.ttf",
}

# Ripiego di sistema, in ordine. Non e' cosmetica: se i font veri non ci sono il
# post esce lo stesso, solo piu' brutto — e `font_veri()` lo dice a chi chiama,
# cosi' la pipeline puo' rifiutarsi di pubblicare invece di sfornare roba scadente.
_DI_SISTEMA = {
    "disp": ["/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf",
             "/System/Library/Fonts/Supplemental/Arial Bold.ttf"],
    "sans": ["/System/Library/Fonts/Supplemental/Arial.ttf"],
    "mono": ["/System/Library/Fonts/Supplemental/Andale Mono.ttf",
             "/System/Library/Fonts/Menlo.ttc"],
}


@functools.lru_cache(maxsize=256)
def font(famiglia: str, dim: int, peso: int = 700):
    """font('disp', 120) -> ImageFont. Famiglie: disp, sans, mono."""
    from PIL import ImageFont
    nome = _FILE.get((famiglia, peso))
    if nome:
        p = os.path.join(FONT, nome)
        if os.path.exists(p):
            return ImageFont.truetype(p, dim)
    for p in _DI_SISTEMA.get(famiglia, []):
        try:
            return ImageFont.truetype(p, dim)
        except Exception:
            continue
    return ImageFont.load_default(dim)


def font_veri() -> bool:
    """True se TUTTI i font del progetto sono presenti: la pipeline lo controlla
    prima di generare, perche' un post in Arial non e' un post del Muretto."""
    return all(os.path.exists(os.path.join(FONT, n)) for n in _FILE.values())


def mancanti() -> list:
    return [n for n in _FILE.values() if not os.path.exists(os.path.join(FONT, n))]


# --------------------------------------------------------------- i formati
# (larghezza, altezza) — i tre che Instagram tratta bene nel 2026.
FORMATI = {
    "feed":    (1080, 1350),   # 4:5, il post che occupa piu' schermo nel flusso
    "storia":  (1080, 1920),   # 9:16, storie e reel
    "quadro":  (1080, 1080),   # 1:1, quando serve la griglia regolare
}

# --------------------------------------------------------------- le misure
MARGINE = 76          # respiro laterale su 1080
GRIGLIA = 12          # passo verticale
LARGA = 1080 - 2 * MARGINE   # 928 px di colonna utile

# La scala tipografica, in pixel su tela 1080. Ricalcolata per la lettura sul
# telefono: sotto i 26 px non si mette niente che debba essere letto.
TIPO = {
    "cifrone":  260,   # il numero che ferma il pollice
    "cifra":    150,
    "titolo":   104,
    "sotto":     62,
    "corpo":     38,
    "corpetto":  32,
    "etichetta": 27,   # minimo assoluto leggibile
}

DOMINIO = "murettobox.com"
MARCHIO = "MURETTO"
SOTTOMARCHIO = "BOX VIRTUALE"


if __name__ == "__main__":
    print("colori letti da muro.css:", "si" if os.path.exists(CSS) else "NO (ripiego)")
    for n in ("nero", "rosso", "ciano", "testo", "medium"):
        print(f"  {n:<10} {c(n)}")
    print("font veri:", font_veri(), "— mancanti:", mancanti() or "nessuno")
