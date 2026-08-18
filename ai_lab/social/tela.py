#!/usr/bin/env python3
"""tela.py — il foglio da disegno dei post. Un piccolo motore di impaginazione.

COSA RISOLVE. PIL sa mettere pixel, non sa impaginare: non ha crenatura estesa
(letter-spacing), non manda a capo, non conosce una griglia. Il sito e' fatto di
maiuscolo condensato spaziato e di numeri monospazio incolonnati — senza quelle
tre cose i post NON sembrano il Muretto, sembrano generici. Qui dentro ci sono.

COORDINATE LOGICHE. Chi disegna ragiona sempre su una tela larga 1080, qualunque
sia il campionamento vero. La classe tiene un fattore di scala `s` e moltiplica
lei; `salva()` rimpicciolisce con LANCZOS. Cosi' le curve, le diagonali e le
linee sottili escono pulite e il codice dei formati resta leggibile.
    s=2 per le immagini ferme (qualita'), s=1 per i fotogrammi dei reel (sono
    centinaia, e li' vince la velocita').

REGOLA. Nessun formato disegna testo con `draw.text` diretto: passa da qui. E'
l'unico posto dove la tipografia del progetto e' definita una volta sola.
"""
from __future__ import annotations
import os
from PIL import Image, ImageDraw, ImageFilter

from . import marca as M


class Tela:
    def __init__(self, formato: str = "feed", s: int = 2, fondo: str | None = None):
        if formato not in M.FORMATI:
            raise ValueError(f"formato sconosciuto: {formato} (ho {list(M.FORMATI)})")
        self.formato = formato
        self.L, self.H = M.FORMATI[formato]
        self.s = s
        self.img = Image.new("RGB", (self.L * s, self.H * s), M.rgb(fondo or "nero"))
        self.d = ImageDraw.Draw(self.img)

    # ------------------------------------------------------------ utilita'
    def _p(self, v):
        """da coordinata logica a pixel veri"""
        return v * self.s

    def _f(self, famiglia, dim, peso=700):
        return M.font(famiglia, int(dim * self.s), peso)

    # -------------------------------------------------------------- fondi
    def ground(self, tinta: str | None = None, trama: bool = True, alone: str | None = None):
        """Il fondo del sito: nero, trama diagonale a 115°, e un alone di colore
        in alto a sinistra. La trama e' quella di muro.css riga 110 — stessa
        inclinazione, stesso passo di 7 px, stessa opacita' quasi invisibile.
        Non si vede e si sente: senza, il fondo e' una parete piatta."""
        self.d.rectangle([0, 0, self.img.width, self.img.height], fill=M.rgb(tinta or "nero"))

        if alone:
            # un velo di colore sfumato: si disegna piccolo e si ingrandisce,
            # cosi' la sfumatura e' morbida senza costare un pixel per volta.
            piccolo = Image.new("RGB", (64, 64), M.rgb(tinta or "nero"))
            pd = ImageDraw.Draw(piccolo)
            for i in range(26, 0, -1):
                t = i / 26.0
                pd.ellipse([-30 + 0, -34, 30 + i * 1.6, 18 + i * 1.6],
                           fill=M.rgb(M.misto(tinta or "nero", alone, 0.10 * (1 - t))))
            velo = piccolo.resize(self.img.size, Image.LANCZOS)
            self.img = Image.blend(self.img, velo, 0.85)
            self.d = ImageDraw.Draw(self.img)

        if trama:
            passo, W, H = 7 * self.s, self.img.width, self.img.height
            velo = Image.new("L", self.img.size, 0)
            vd = ImageDraw.Draw(velo)
            # 115° in CSS = diagonale che scende verso destra
            for x in range(-H, W + H, passo):
                vd.line([(x, 0), (x + H // 2, H)], fill=10, width=self.s)
            self.img.paste(Image.new("RGB", self.img.size, (255, 255, 255)), (0, 0), velo)
            self.d = ImageDraw.Draw(self.img)

    def piastra(self, x, y, w, h, r=14, riemp="piastra", bordo="bordo", spess=1):
        """La piastra del sito: fondo appena piu' chiaro, bordo sottile."""
        self.d.rounded_rectangle(
            [self._p(x), self._p(y), self._p(x + w), self._p(y + h)],
            radius=self._p(r),
            fill=M.rgb(riemp) if riemp else None,
            outline=M.rgb(bordo) if bordo else None,
            width=self._p(spess) if bordo else 0)

    def barra_alto(self, colore="rosso", h=8):
        """La fascia d'accento in cima: la firma visiva del sito."""
        self.d.rectangle([0, 0, self.img.width, self._p(h)], fill=M.rgb(colore))

    # -------------------------------------------------------------- testo
    def testo(self, x, y, testo, famiglia="disp", dim=None, peso=700, colore="testo",
              tracking=0.0, ancora="la", maiuscolo=False):
        """Testo con crenatura estesa. `tracking` e' in frazione di corpo, come
        l'`em` del CSS: .18 = letter-spacing:.18em.

        PIL non sa spaziare, quindi quando serve si disegna carattere per
        carattere. Quando non serve (tracking=0) si passa dalla via veloce, che
        conserva la crenatura vera del font.
        """
        dim = dim or M.TIPO["corpo"]
        f = self._f(famiglia, dim, peso)
        if maiuscolo:
            testo = testo.upper()
        col = M.rgb(colore)

        if not tracking:
            self.d.text((self._p(x), self._p(y)), testo, font=f, fill=col, anchor=ancora)
            return self.larghezza(testo, famiglia, dim, peso, tracking)

        passo = tracking * dim * self.s
        largo = self._larghezza_px(testo, f, passo)
        px, py = self._p(x), self._p(y)
        oriz, vert = (ancora + "a")[0], (ancora + "a")[1]
        if oriz == "m":
            px -= largo / 2
        elif oriz == "r":
            px -= largo
        for ch in testo:
            self.d.text((px, py), ch, font=f, fill=col, anchor="l" + vert)
            px += f.getlength(ch) + passo
        return largo / self.s

    def _larghezza_px(self, testo, f, passo_px):
        if not testo:
            return 0
        return sum(f.getlength(ch) for ch in testo) + passo_px * (len(testo) - 1)

    def larghezza(self, testo, famiglia="disp", dim=None, peso=700, tracking=0.0):
        """Larghezza in coordinate logiche: serve a centrare e a incolonnare."""
        dim = dim or M.TIPO["corpo"]
        f = self._f(famiglia, dim, peso)
        return self._larghezza_px(testo, f, tracking * dim * self.s) / self.s

    def fondo_inchiostro(self, testo, famiglia="disp", dim=None, peso=700):
        """Quanto scende DAVVERO il testo sotto la sua y, disegnato con ancora
        'la'. Non e' il corpo del font: un 300 px monospazio ha il riquadro alto
        ~390 px e l'inchiostro finisce molto prima.

        Serve a impilare: la prima versione del formato «numero» metteva l'unita'
        a `y + corpo*0.86` e gliela stampava SOPRA le cifre."""
        dim = dim or M.TIPO["corpo"]
        f = self._f(famiglia, dim, peso)
        return f.getbbox(str(testo))[3] / self.s

    def paragrafo(self, x, y, testo, larghezza, famiglia="sans", dim=None, peso=400,
                  colore="calmo", interlinea=1.34, ancora="la", massimo_righe=None):
        """Manda a capo dentro `larghezza` e restituisce l'altezza occupata.
        Se le righe eccedono `massimo_righe`, tronca con l'ellissi."""
        dim = dim or M.TIPO["corpo"]
        f = self._f(famiglia, dim, peso)
        righe, cur = [], ""
        for parola in testo.split():
            prova = (cur + " " + parola).strip()
            if f.getlength(prova) / self.s <= larghezza or not cur:
                cur = prova
            else:
                righe.append(cur)
                cur = parola
        if cur:
            righe.append(cur)
        if massimo_righe and len(righe) > massimo_righe:
            righe = righe[:massimo_righe]
            righe[-1] = righe[-1].rstrip(" ,.;:") + "…"
        passo = dim * interlinea
        for i, r in enumerate(righe):
            self.testo(x, y + i * passo, r, famiglia, dim, peso, colore, ancora=ancora)
        return len(righe) * passo

    # ---------------------------------------------------------- componenti
    def marchio(self, x=None, y=56, colore="rosso", scala=1.0):
        """Il lockup: quadretto rosso con la M, poi MURETTO / BOX VIRTUALE.
        E' lo stesso disegno della favicon e delle anteprime degli articoli."""
        x = M.MARGINE if x is None else x
        lato = 58 * scala
        self.d.rounded_rectangle(
            [self._p(x), self._p(y), self._p(x + lato), self._p(y + lato)],
            radius=self._p(13 * scala), fill=M.rgb(colore))
        self.testo(x + lato / 2, y + lato / 2 + 2 * scala, "M", "disp", 40 * scala, 700,
                   "#FFFFFF", ancora="mm")
        self.testo(x + lato + 18 * scala, y + 6 * scala, M.MARCHIO, "disp", 30 * scala, 700,
                   "testo", tracking=.06)
        self.testo(x + lato + 18 * scala, y + 36 * scala, M.SOTTOMARCHIO, "mono", 15 * scala, 400,
                   "fioco", tracking=.20)
        return y + lato

    def occhiello(self, y, testo, colore="rosso", x=None, trattino=True):
        """La riga sopra il titolo: mono, maiuscola, spaziata, col trattino."""
        x = M.MARGINE if x is None else x
        if trattino:
            self.d.rectangle([self._p(x), self._p(y + 11), self._p(x + 34), self._p(y + 13)],
                             fill=M.rgb(colore))
            x += 48
        self.testo(x, y, testo, "mono", M.TIPO["etichetta"], 700, colore,
                   tracking=.16, maiuscolo=True)
        return y + M.TIPO["etichetta"]

    def cifrone(self, x, y, valore, unita=None, dim=None, colore="testo",
                colore_unita=None, larghezza_max=None, ancora="la"):
        """Il numero che ferma il pollice, con l'unita' accanto.

        Si RIMPICCIOLISCE da solo finche' numero+unita' stanno in
        `larghezza_max`: un numero a due cifre e uno a cinque non possono avere
        lo stesso corpo, e nessun formato deve accorgersene. L'unita' lunga va a
        capo in colonna invece di uscire dalla tela.
        """
        dim = dim or M.TIPO["cifrone"]
        larghezza_max = larghezza_max or (self.L - x - M.MARGINE)
        val = str(valore)
        # l'unita' si prende al piu' un terzo dello spazio, il numero il resto
        largo_unita = 0
        if unita:
            largo_unita = min(larghezza_max * .34,
                              self.larghezza(unita, "disp", dim * .26, 700, .06) + 14)
        spazio_num = larghezza_max - largo_unita
        for _ in range(40):                       # scende a passi del 4%
            if self.larghezza(val, "mono", dim, 700) <= spazio_num or dim < 40:
                break
            dim *= 0.96
        largo = self.testo(x, y, val, "mono", dim, 700, colore, ancora=ancora)
        if unita:
            # in colonna accanto al numero, allineata al piede della cifra
            corpo = max(20, dim * .26)
            self.paragrafo(x + largo + 16, y + dim * .52, unita,
                           max(120, largo_unita - 16), "disp", corpo, 700,
                           colore_unita or "fioco", interlinea=1.06)
        # si restituisce ANCHE il piede vero dell'inchiostro: il corpo qui dentro
        # puo' essere sceso, e chi impila sotto non ha modo di saperlo altrimenti.
        return largo, y + self.fondo_inchiostro(val, "mono", dim, 700)

    def pastiglia_mescola(self, x, y, mescola, dim=30):
        """La pastiglia della gomma: pallino del colore giusto + sigla."""
        col = M.colore_mescola(mescola)
        r = dim * 0.42
        self.d.ellipse([self._p(x), self._p(y), self._p(x + 2 * r), self._p(y + 2 * r)],
                       outline=M.rgb(col), width=self._p(3))
        self.d.ellipse([self._p(x + r * .55), self._p(y + r * .55),
                        self._p(x + 2 * r - r * .55), self._p(y + 2 * r - r * .55)],
                       fill=M.rgb(col))
        self.testo(x + 2 * r + 14, y + r, (mescola or "").upper(), "mono", dim * .72, 700,
                   col, tracking=.10, ancora="lm")

    def riga_torre(self, x, y, w, pos, sigla, colore_team, delta=None, h=62,
                   evidenzia=False, dim=None):
        """Una riga della torre di cronometraggio: posizione, livrea, sigla, gap.
        E' il componente piu' riconoscibile del sito — chi guarda la F1 lo legge
        senza istruzioni."""
        dim = dim or 34
        if evidenzia:
            self.piastra(x, y, w, h, r=8, riemp="alto", bordo="bordo-2")
        else:
            self.d.rectangle([self._p(x), self._p(y + h - 1), self._p(x + w), self._p(y + h)],
                             fill=M.rgb("bordo"))
        cy = y + h / 2
        self.testo(x + 22, cy, str(pos), "mono", dim * .82, 400, "fioco", ancora="lm")
        # la livrea: la barretta del colore squadra
        self.d.rectangle([self._p(x + 62), self._p(y + h * .22),
                          self._p(x + 66), self._p(y + h * .78)], fill=M.rgb(colore_team))
        self.testo(x + 84, cy, sigla, "disp", dim, 700,
                   "testo" if evidenzia else "calmo", tracking=.05, ancora="lm")
        if delta is not None:
            self.testo(x + w - 22, cy, delta, "mono", dim * .80, 700,
                       "testo" if evidenzia else "calmo", ancora="rm")

    def barra(self, x, y, w, h, frazione, colore="rosso", fondo="alto", r=None):
        """Barra di confronto. `frazione` da 0 a 1."""
        r = h / 2 if r is None else r
        self.d.rounded_rectangle([self._p(x), self._p(y), self._p(x + w), self._p(y + h)],
                                 radius=self._p(r), fill=M.rgb(fondo))
        larga = max(h, w * max(0.0, min(1.0, frazione)))
        self.d.rounded_rectangle([self._p(x), self._p(y), self._p(x + larga), self._p(y + h)],
                                 radius=self._p(r), fill=M.rgb(colore))

    def traccia(self, x, y, w, h, valori, colore="ciano", spess=4, sotto=False,
                minimo=None, massimo=None):
        """Una traccia tipo telemetria dentro il riquadro dato. `valori` e' una
        lista di numeri; la scala verticale si prende dai dati salvo diverso
        ordine (serve a mettere due tracce sulla STESSA scala per confrontarle)."""
        if not valori:
            return
        lo = minimo if minimo is not None else min(valori)
        hi = massimo if massimo is not None else max(valori)
        campo = (hi - lo) or 1.0
        n = len(valori)
        punti = [(self._p(x + w * i / (n - 1 or 1)),
                  self._p(y + h - h * (v - lo) / campo)) for i, v in enumerate(valori)]
        if sotto:
            poli = punti + [(self._p(x + w), self._p(y + h)), (self._p(x), self._p(y + h))]
            velo = Image.new("RGBA", self.img.size, (0, 0, 0, 0))
            ImageDraw.Draw(velo).polygon(poli, fill=M.rgb(colore) + (46,))
            self.img = Image.alpha_composite(self.img.convert("RGBA"), velo).convert("RGB")
            self.d = ImageDraw.Draw(self.img)
        self.d.line(punti, fill=M.rgb(colore), width=self._p(spess), joint="curve")

    def griglia_fondo(self, x, y, w, h, colonne=0, righe=4, colore="bordo"):
        """Il reticolo dietro un grafico: fa leggere le altezze."""
        for i in range(righe + 1):
            yy = y + h * i / righe
            self.d.line([(self._p(x), self._p(yy)), (self._p(x + w), self._p(yy))],
                        fill=M.rgb(colore), width=max(1, self.s))
        for i in range(colonne + 1) if colonne else []:
            xx = x + w * i / colonne
            self.d.line([(self._p(xx), self._p(y)), (self._p(xx), self._p(y + h))],
                        fill=M.rgb(colore), width=max(1, self.s))

    def pie_pagina(self, provenienza: str | None = None, y: int | None = None,
                   dominio: bool = True):
        """LA FIRMA DEL PROGETTO. Ogni post dice da dove viene il suo numero.

        Non e' un vezzo: e' la sola cosa che distingue questo account da mille
        pagine che sparano cifre. Se un formato non sa dire la provenienza, il
        numero non si pubblica."""
        y = y if y is not None else self.H - 108
        self.d.rectangle([self._p(M.MARGINE), self._p(y), self._p(self.L - M.MARGINE),
                          self._p(y + 1)], fill=M.rgb("bordo"))
        if provenienza:
            # tre righe, non due: la provenienza di una sosta dice il metodo, la
            # finestra E il regime di gara, e troncata a «gara in…» non prova piu'
            # niente — che e' esattamente il contrario del suo scopo.
            self.paragrafo(M.MARGINE, y + 20, provenienza, M.LARGA - 250,
                           "mono", 20, 400, "fioco", interlinea=1.38, massimo_righe=3)
        if dominio:
            self.testo(self.L - M.MARGINE, y + 26, M.DOMINIO, "disp", 30, 700,
                       "testo", tracking=.08, ancora="ra")

    # ------------------------------------------------------------- uscita
    def immagine(self) -> Image.Image:
        if self.s == 1:
            return self.img
        return self.img.resize((self.L, self.H), Image.LANCZOS)

    def salva(self, percorso: str, qualita: int = 92) -> str:
        os.makedirs(os.path.dirname(os.path.abspath(percorso)), exist_ok=True)
        img = self.immagine()
        if percorso.lower().endswith((".jpg", ".jpeg")):
            img.save(percorso, quality=qualita, subsampling=0, optimize=True)
        else:
            img.save(percorso, optimize=True)
        return percorso
