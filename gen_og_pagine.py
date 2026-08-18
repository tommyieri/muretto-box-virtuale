#!/usr/bin/env python3
"""gen_og_pagine.py — L'ANTEPRIMA SOCIAL DELLE PAGINE FISSE.

Gli articoli ce l'avevano da sempre (statico.py::genera_og, una PNG per pezzo).
Le sette pagine del sito no: chi incollava murettobox.com in WhatsApp, su X o in
un messaggio vedeva un rettangolo grigio col dominio, e basta.  Il link piu'
condiviso del sito era l'unico senza faccia.

Stesso disegno delle anteprime degli articoli — stesso fondo, stesso marchio,
stessa fascia rossa — perche' un link alla home e un link a un articolo devono
sembrare la stessa cosa: sono lo stesso sito.

Si rilancia a mano quando cambia un titolo:  python3 gen_og_pagine.py
"""
import os

QUI = os.path.dirname(os.path.abspath(__file__))
OG = os.path.join(QUI, "demo", "og")

W, H = 1200, 630
FONDO, TESTO, FIOCO, LINEA = "#0A0B0E", "#EEF1F6", "#868E9F", "#282C35"


def _rosso() -> str:
    """Il rosso del marchio, LETTO da demo/muro.css invece che ribattuto qui:
    era una tonalita' diversa da quella del sito, per lo stesso marchio."""
    try:
        from ai_lab.social.marca import c
        return c("rosso")
    except Exception:
        return "#FF1E3C"


ROSSO = _rosso()

# occhiello, titolo, riga sotto.  Il titolo NON e' il <title> della pagina:
# li' serve il nome del sito per i risultati di ricerca, qui il marchio c'e' gia'
# scritto sopra e ripeterlo mangerebbe una riga.
PAGINE = [
    ("index",      "IL BOX VIRTUALE",  "La Formula 1 vista dal muretto",
     "Rivedi ogni gara giro per giro e decidi tu quando fermarti."),
    ("stagione",   "STAGIONE 2026",    "Ventidue gare, una per volta",
     "Ogni gara corsa si rivede giro per giro, col pannello strategia."),
    ("gara",       "RIVEDI LA GARA",   "Tu al muretto, giro per giro",
     "Sposta la sosta e il motore ti dice dove rientri."),
    ("live",       "IN DIRETTA",       "Il weekend mentre succede",
     "Classifica in tempo reale e la prossima sessione."),
    ("analisi",    "ARTICOLI",         "Un fatto per volta, dai dati",
     "Telemetria, passo gara, qualifiche e strategia."),
    ("telemetria", "TELEMETRIA",       "Qualunque giro, qualunque pilota",
     "Velocità, gas, freno e marce. E due giri a confronto."),
    ("campionato", "CAMPIONATO 2026",  "Piloti e costruttori",
     "La classifica, e la scheda di ognuno."),
]


def font(dim, grassetto=False):
    from PIL import ImageFont
    nomi = (["/System/Library/Fonts/Supplemental/Arial Bold.ttf",
             "/Library/Fonts/Arial Bold.ttf"] if grassetto else
            ["/System/Library/Fonts/Supplemental/Arial.ttf", "/Library/Fonts/Arial.ttf"])
    for n in nomi + ["/System/Library/Fonts/Helvetica.ttc"]:
        try:
            return ImageFont.truetype(n, dim)
        except Exception:
            continue
    return ImageFont.load_default()


def a_capo(d, testo, f, largo):
    righe, cur = [], ""
    for p in testo.split():
        prova = (cur + " " + p).strip()
        if d.textlength(prova, font=f) > largo and cur:
            righe.append(cur)
            cur = p
        else:
            cur = prova
    if cur:
        righe.append(cur)
    return righe



def _marchio(d, img, x=64, y=56, lato=56, colore="#FF1E3C"):
    """Incolla il segno del Muretto (la M sopra il muretto).

    NON ridisegna la lettera: chiede l'immagine a ai_lab/social/marchio.py, che
    e' l'unico posto dove quella geometria e' definita — la stessa da cui escono
    la favicon del sito e la foto profilo di Instagram. Se marchio.py non e'
    importabile ripiega sul quadrato rosso con la M, cosi' l'anteprima esce
    comunque invece di far fallire tutta la generazione."""
    try:
        import sys, os
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from ai_lab.social import marchio as _m
        seg = _m.png(lato, fondo=colore, margine=.10)
        img.paste(seg, (int(x), int(y)), seg)
        return True
    except Exception:
        d.rounded_rectangle([x, y, x + lato, y + lato], radius=13, fill=colore)
        return False

def disegna(nome, occhiello, titolo, sotto):
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (W, H), FONDO)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 8], fill=ROSSO)

    if not _marchio(d, img, 64, 56, 56, ROSSO):
        d.text((92, 84), "M", font=font(34, True), fill="#FFFFFF", anchor="mm")
    d.text((136, 72), "MURETTO", font=font(26, True), fill=TESTO)
    d.text((137, 104), "BOX VIRTUALE", font=font(15), fill=FIOCO)

    # IL BLOCCO STA IN MEZZO, non appeso in alto con il sottotitolo schiacciato
    # a fondo pagina: un titolo di una riga lasciava 180 px di vuoto nel mezzo.
    f_occ, f_tit, f_sot = font(22, True), font(62, True), font(26)
    righeT = a_capo(d, titolo, f_tit, W - 128)[:3]
    righeS = a_capo(d, sotto, f_sot, W - 128)[:2]
    alto = 30 + 22 + 76 * len(righeT) + 12 + 38 * len(righeS)
    y = 150 + max(0, (H - 150 - 60 - alto) // 2)

    d.text((64, y), occhiello, font=f_occ, fill=ROSSO)
    y += 30 + 22
    for r in righeT:
        d.text((64, y), r, font=f_tit, fill=TESTO)
        y += 76
    y += 12
    for r in righeS:
        d.text((64, y), r, font=f_sot, fill=FIOCO)
        y += 38

    d.rectangle([0, H - 10, W, H], fill=LINEA)
    os.makedirs(OG, exist_ok=True)
    img.save(os.path.join(OG, f"pagina-{nome}.png"), "PNG", optimize=True)
    return True


if __name__ == "__main__":
    for nome, occ, tit, sot in PAGINE:
        disegna(nome, occ, tit, sot)
        print(f"  og/pagina-{nome}.png")
    print(f"{len(PAGINE)} anteprime social")
