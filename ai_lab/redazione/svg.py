"""
svg.py — grafici SVG per gli articoli della redazione.

Differenza chiave rispetto al pattern di weekend.html (che usa
preserveAspectRatio="none"): qui l'aspetto e' PRESERVATO e ogni coordinata e'
calcolata in pixel in Python.  Cosi' le annotazioni (cerchi, frecce, etichette)
sul punto esatto dell'anomalia NON si deformano — requisito della redazione.

Tema: usa le variabili CSS del sito via var(--...), che si risolvono quando
l'SVG e' iniettato nella pagina (stesso trucco di weekend.html per le linee).
I colori-dato (team) sono invece esadecimali espliciti.
"""
from __future__ import annotations
import html

MONO = "'JetBrains Mono',ui-monospace,Menlo,monospace"
DISP = "'Barlow Condensed','Arial Narrow',sans-serif"


def esc(s):
    return html.escape(str(s), quote=True)


class Scala:
    """Mappa lineare valore-dato -> pixel."""
    def __init__(self, d0, d1, p0, p1):
        self.d0, self.d1, self.p0, self.p1 = d0, d1, p0, p1
        self.k = (p1 - p0) / (d1 - d0) if d1 != d0 else 0.0

    def __call__(self, v):
        return self.p0 + (v - self.d0) * self.k


def _path(punti):
    if not punti:
        return ""
    d = "M" + f"{punti[0][0]:.2f} {punti[0][1]:.2f}"
    for x, y in punti[1:]:
        d += f" L{x:.2f} {y:.2f}"
    return d


def grafico_lift(serie, x_lift, etichetta_lift, *, dmax=250.0,
                 v_range=(150, 300), titolo="", sub=""):
    """Grafico a due pannelli (velocita' sopra, gas sotto) con asse x =
    distanza dalla linea del traguardo (m, 0 a destra sulla linea).

    serie: lista di dict {sigla, colore, punti:[(dist_dalla_linea, v_kmh, thr_pct)]}
    x_lift: distanza-dalla-linea del punto di lift da annotare (m)
    etichetta_lift: testo dell'annotazione (es. "lift  -45 m")
    """
    W, H = 760, 440
    ml, mr, mt = 52, 16, 58
    # due pannelli
    h_v = 168      # velocita'
    gap = 30
    h_t = 96       # gas
    y_v0, y_v1 = mt, mt + h_v
    y_t0, y_t1 = y_v1 + gap, y_v1 + gap + h_t
    x0, x1 = ml, W - mr

    sx = Scala(dmax, 0, x0, x1)                 # dist-dalla-linea: dmax a sx, 0 a dx
    sv = Scala(v_range[0], v_range[1], y_v1, y_v0)
    stt = Scala(0, 100, y_t1, y_t0)

    out = [f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" '
           f'font-family="{MONO}" class="art-svg">']
    out.append('<style>.art-svg text{fill:var(--dim)}.art-svg .lbl{fill:var(--txt)}'
               '.art-svg .grid{stroke:var(--line);stroke-width:1}'
               '.art-svg .axis{stroke:var(--line2);stroke-width:1}</style>')
    if titolo:
        out.append(f'<text x="{x0}" y="17" class="lbl" font-size="14" '
                   f'font-family="{DISP}" letter-spacing="0.5">{esc(titolo)}</text>')
    if sub:
        out.append(f'<text x="{x0}" y="33" font-size="10.5">{esc(sub)}</text>')

    # --- griglia + assi y ---
    # velocita': tacche ogni 25
    v = v_range[0]
    while v <= v_range[1]:
        y = sv(v)
        out.append(f'<line x1="{x0}" y1="{y:.1f}" x2="{x1}" y2="{y:.1f}" class="grid"/>')
        out.append(f'<text x="{x0-6}" y="{y+3:.1f}" font-size="9.5" text-anchor="end">{v}</text>')
        v += 25
    out.append(f'<text x="{x0-6}" y="{y_v0-8}" font-size="9" text-anchor="end" fill="var(--accent)">km/h</text>')
    # gas: 0 / 50 / 100
    for t in (0, 50, 100):
        y = stt(t)
        out.append(f'<line x1="{x0}" y1="{y:.1f}" x2="{x1}" y2="{y:.1f}" class="grid"/>')
        out.append(f'<text x="{x0-6}" y="{y+3:.1f}" font-size="9.5" text-anchor="end">{t}</text>')
    out.append(f'<text x="{x0-6}" y="{y_t0-6}" font-size="9" text-anchor="end" fill="var(--accent)">gas %</text>')

    # --- asse x (distanza dalla linea) ---
    d = 0
    while d <= dmax:
        x = sx(d)
        out.append(f'<line x1="{x:.1f}" y1="{y_t1}" x2="{x:.1f}" y2="{y_t1+4}" class="axis"/>')
        lab = "traguardo" if d == 0 else f"-{d:.0f}"
        anc = "end" if d == 0 else "middle"
        out.append(f'<text x="{x:.1f}" y="{y_t1+16}" font-size="9.5" text-anchor="{anc}">{lab}</text>')
        d += 50
    out.append(f'<text x="{(x0+x1)/2:.0f}" y="{H-4}" font-size="9.5" text-anchor="middle">'
               f'distanza dalla linea del traguardo (m)</text>')

    # --- linea del traguardo (bordo destro) ---
    xL = sx(0)
    out.append(f'<line x1="{xL:.1f}" y1="{y_v0}" x2="{xL:.1f}" y2="{y_t1}" '
               f'stroke="var(--brand)" stroke-width="1.5" stroke-dasharray="2 3" opacity="0.8"/>')

    # --- annotazione del lift (linea verticale + etichetta) ---
    if x_lift is not None:
        xa = sx(x_lift)
        out.append(f'<line x1="{xa:.1f}" y1="{y_v0}" x2="{xa:.1f}" y2="{y_t1}" '
                   f'stroke="var(--accent)" stroke-width="1" stroke-dasharray="3 3" opacity="0.85"/>')
        # etichetta sopra il pannello: ancorata a fine se vicina al bordo destro
        anc = "end" if xa > x1 - 90 else "middle"
        tx = xa if anc == "middle" else xa + 4
        out.append(f'<text x="{tx:.1f}" y="{y_v0-8}" font-size="10.5" text-anchor="{anc}" '
                   f'class="lbl" font-family="{DISP}" letter-spacing="0.4">{esc(etichetta_lift)}</text>')
        out.append(f'<path d="M{xa:.1f} {y_v0-5} l-3 -5 h6 z" fill="var(--accent)"/>')

    # --- serie ---
    for s in serie:
        col = s.get("colore") or "var(--dim)"
        pv = [(sx(d), sv(max(v_range[0], min(v_range[1], v)))) for d, v, _ in s["punti"]]
        pt = [(sx(d), stt(max(0, min(100, t)))) for d, _, t in s["punti"]]
        out.append(f'<path d="{_path(pv)}" fill="none" stroke="{col}" stroke-width="2" '
                   f'stroke-linejoin="round" stroke-linecap="round"/>')
        out.append(f'<path d="{_path(pt)}" fill="none" stroke="{col}" stroke-width="2" '
                   f'stroke-linejoin="round" stroke-linecap="round"/>')

    # --- marcatore sul punto di lift della prima serie (dove il gas lascia il pieno) ---
    if serie and x_lift is not None:
        s0 = serie[0]
        # punto piu' vicino a x_lift
        near = min(s0["punti"], key=lambda p: abs(p[0] - x_lift))
        cx, cy = sx(near[0]), stt(near[2])
        out.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="4.5" fill="none" '
                   f'stroke="{s0.get("colore") or "var(--accent)"}" stroke-width="2"/>')

    # --- legenda ---
    lx = x0 + 4
    ly = y_v0 + 12
    for s in serie:
        col = s.get("colore") or "var(--dim)"
        out.append(f'<rect x="{lx}" y="{ly-8}" width="14" height="3" rx="1.5" fill="{col}"/>')
        out.append(f'<text x="{lx+20}" y="{ly-4}" font-size="10.5" class="lbl">{esc(s["sigla"])}</text>')
        lx += 20 + 12 * len(s["sigla"]) + 22
    out.append('</svg>')
    return "".join(out)


def grafico_xy(serie, *, x_range, y_range, x_ticks, y_ticks, x_label="", y_label="",
               x_annota=None, annota_txt="", titolo="", sub=""):
    """Grafico a linee generico (x crescente a destra). Aspetto preservato.

    serie: [{sigla, colore, punti:[(x,y)]}]. x_annota: valore x su cui tracciare
    una verticale annotata (etichetta annota_txt sopra il pannello).
    """
    W, H = 760, 380
    ml, mr, mt, mb = 60, 16, 54, 44
    x0, x1 = ml, W - mr
    y0, y1 = mt, H - mb
    sx = Scala(x_range[0], x_range[1], x0, x1)
    sy = Scala(y_range[0], y_range[1], y1, y0)

    out = [f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" '
           f'font-family="{MONO}" class="art-svg">']
    out.append('<style>.art-svg text{fill:var(--dim)}.art-svg .lbl{fill:var(--txt)}'
               '.art-svg .grid{stroke:var(--line);stroke-width:1}</style>')
    if titolo:
        out.append(f'<text x="{x0}" y="17" class="lbl" font-size="14" '
                   f'font-family="{DISP}" letter-spacing="0.5">{esc(titolo)}</text>')
    if sub:
        out.append(f'<text x="{x0}" y="33" font-size="10.5">{esc(sub)}</text>')
    for yv in y_ticks:
        y = sy(yv)
        out.append(f'<line x1="{x0}" y1="{y:.1f}" x2="{x1}" y2="{y:.1f}" class="grid"/>')
        out.append(f'<text x="{x0-6}" y="{y+3:.1f}" font-size="9.5" text-anchor="end">{yv}</text>')
    out.append(f'<text x="{x0-6}" y="{y0-8}" font-size="9" text-anchor="end" fill="var(--accent)">{esc(y_label)}</text>')
    for xv in x_ticks:
        x = sx(xv)
        out.append(f'<line x1="{x:.1f}" y1="{y1}" x2="{x:.1f}" y2="{y1+4}" stroke="var(--line2)"/>')
        out.append(f'<text x="{x:.1f}" y="{y1+16}" font-size="9.5" text-anchor="middle">{xv}</text>')
    out.append(f'<text x="{(x0+x1)/2:.0f}" y="{H-6}" font-size="9.5" text-anchor="middle">{esc(x_label)}</text>')

    if x_annota is not None:
        xa = sx(x_annota)
        out.append(f'<line x1="{xa:.1f}" y1="{y0}" x2="{xa:.1f}" y2="{y1}" '
                   f'stroke="var(--accent)" stroke-width="1" stroke-dasharray="3 3" opacity="0.8"/>')
        if annota_txt:
            anc = "end" if xa > x1 - 120 else "middle"
            tx = xa - 4 if anc == "end" else xa
            out.append(f'<text x="{tx:.1f}" y="{y0-6}" font-size="10.5" text-anchor="{anc}" '
                       f'class="lbl" font-family="{DISP}">{esc(annota_txt)}</text>')

    for s in serie:
        col = s.get("colore") or "var(--dim)"
        pts = [(sx(x), sy(max(y_range[0], min(y_range[1], y)))) for x, y in s["punti"]]
        out.append(f'<path d="{_path(pts)}" fill="none" stroke="{col}" stroke-width="2.2" '
                   f'stroke-linejoin="round" stroke-linecap="round"/>')
    # legenda
    lx, ly = x0 + 4, y0 + 12
    for s in serie:
        col = s.get("colore") or "var(--dim)"
        out.append(f'<rect x="{lx}" y="{ly-8}" width="14" height="3" rx="1.5" fill="{col}"/>')
        out.append(f'<text x="{lx+20}" y="{ly-4}" font-size="10.5" class="lbl">{esc(s["sigla"])}</text>')
        lx += 20 + 11 * len(str(s["sigla"])) + 20
    out.append('</svg>')
    return "".join(out)


def grafico_curva(serie, *, meta=140.0, v_range=(150, 300), g_range=(3, 8),
                  apex_txt="", titolo="", sub=""):
    """Due pannelli (velocita' sopra, marcia sotto) attorno a una curva; x =
    distanza dall'apice in metri (0 al centro). serie: [{sigla,colore,tratteggio,
    punti:[(dx, speed, gear, rpm)]}]. Aspetto preservato.
    """
    W, H = 760, 420
    ml, mr, mt = 52, 16, 56
    h_v, gap, h_g = 158, 30, 96
    y_v0, y_v1 = mt, mt + h_v
    y_g0, y_g1 = y_v1 + gap, y_v1 + gap + h_g
    x0, x1 = ml, W - mr
    sx = Scala(-meta, meta, x0, x1)
    sv = Scala(v_range[0], v_range[1], y_v1, y_v0)
    sg = Scala(g_range[0], g_range[1], y_g1, y_g0)

    out = [f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" '
           f'font-family="{MONO}" class="art-svg">']
    out.append('<style>.art-svg text{fill:var(--dim)}.art-svg .lbl{fill:var(--txt)}'
               '.art-svg .grid{stroke:var(--line);stroke-width:1}</style>')
    if titolo:
        out.append(f'<text x="{x0}" y="17" class="lbl" font-size="14" '
                   f'font-family="{DISP}" letter-spacing="0.5">{esc(titolo)}</text>')
    if sub:
        out.append(f'<text x="{x0}" y="33" font-size="10.5">{esc(sub)}</text>')
    # griglia velocita'
    v = v_range[0]
    while v <= v_range[1]:
        y = sv(v)
        out.append(f'<line x1="{x0}" y1="{y:.1f}" x2="{x1}" y2="{y:.1f}" class="grid"/>')
        out.append(f'<text x="{x0-6}" y="{y+3:.1f}" font-size="9.5" text-anchor="end">{v}</text>')
        v += 25
    out.append(f'<text x="{x0-6}" y="{y_v0-8}" font-size="9" text-anchor="end" fill="var(--accent)">km/h</text>')
    # griglia marce (interi)
    for g in range(int(g_range[0]), int(g_range[1]) + 1):
        y = sg(g)
        out.append(f'<line x1="{x0}" y1="{y:.1f}" x2="{x1}" y2="{y:.1f}" class="grid"/>')
        out.append(f'<text x="{x0-6}" y="{y+3:.1f}" font-size="9.5" text-anchor="end">{g}ª</text>')
    out.append(f'<text x="{x0-6}" y="{y_g0-6}" font-size="9" text-anchor="end" fill="var(--accent)">marcia</text>')
    # asse x
    for dx in (-100, -50, 0, 50, 100):
        if abs(dx) > meta:
            continue
        x = sx(dx)
        lab = "apice" if dx == 0 else f"{dx:+d}"
        out.append(f'<line x1="{x:.1f}" y1="{y_g1}" x2="{x:.1f}" y2="{y_g1+4}" stroke="var(--line2)"/>')
        out.append(f'<text x="{x:.1f}" y="{y_g1+16}" font-size="9.5" text-anchor="middle">{lab}</text>')
    out.append(f'<text x="{(x0+x1)/2:.0f}" y="{H-4}" font-size="9.5" text-anchor="middle">distanza dall’apice (m)</text>')
    # apice
    xa = sx(0)
    out.append(f'<line x1="{xa:.1f}" y1="{y_v0}" x2="{xa:.1f}" y2="{y_g1}" '
               f'stroke="var(--accent)" stroke-width="1" stroke-dasharray="3 3" opacity="0.85"/>')
    if apex_txt:
        out.append(f'<text x="{xa:.1f}" y="{y_v0-8}" font-size="11" text-anchor="middle" '
                   f'class="lbl" font-family="{DISP}" letter-spacing="0.3">{esc(apex_txt)}</text>')
    # serie
    for s in serie:
        col = s.get("colore") or "var(--dim)"
        dash = ' stroke-dasharray="6 4"' if s.get("tratteggio") else ''
        pv = [(sx(dx), sv(max(v_range[0], min(v_range[1], v)))) for dx, v, g, r in s["punti"]]
        pg = [(sx(dx), sg(max(g_range[0], min(g_range[1], g)))) for dx, v, g, r in s["punti"]]
        out.append(f'<path d="{_path(pv)}" fill="none" stroke="{col}" stroke-width="2.2" '
                   f'stroke-linejoin="round" stroke-linecap="round"{dash}/>')
        out.append(f'<path d="{_path(pg)}" fill="none" stroke="{col}" stroke-width="2.2" '
                   f'stroke-linejoin="round" stroke-linecap="round"{dash}/>')
    # legenda
    lx, ly = x0 + 4, y_v0 + 12
    for s in serie:
        col = s.get("colore") or "var(--dim)"
        dash = 'stroke-dasharray="6 4"' if s.get("tratteggio") else ''
        out.append(f'<line x1="{lx}" y1="{ly-6}" x2="{lx+16}" y2="{ly-6}" stroke="{col}" stroke-width="2.4" {dash}/>')
        out.append(f'<text x="{lx+22}" y="{ly-3}" font-size="10.5" class="lbl">{esc(s["sigla"])}</text>')
        lx += 22 + 11 * len(str(s["sigla"])) + 20
    out.append('</svg>')
    return "".join(out)


def grafico_gas_curva(serie, *, meta=160.0, v_range=(60, 320), apex_txt="",
                      marker_label="", titolo="", sub=""):
    """Due pannelli (velocita' sopra, gas sotto) attorno a una curva; x = distanza
    dall'apice (0 al centro). Ogni serie ha un MARKER verticale a `marker` (dx) —
    il punto-firma (frenata per M2, gas pieno per T2). serie: [{sigla,colore,
    tratteggio,marker,punti:[(dx,speed,throttle)]}]. Aspetto preservato.
    """
    W, H = 760, 420
    ml, mr, mt = 52, 16, 56
    h_v, gap, h_t = 168, 28, 92
    y_v0, y_v1 = mt, mt + h_v
    y_t0, y_t1 = y_v1 + gap, y_v1 + gap + h_t
    x0, x1 = ml, W - mr
    sx = Scala(-meta, meta, x0, x1)
    sv = Scala(v_range[0], v_range[1], y_v1, y_v0)
    stt = Scala(0, 100, y_t1, y_t0)

    out = [f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" '
           f'font-family="{MONO}" class="art-svg">']
    out.append('<style>.art-svg text{fill:var(--dim)}.art-svg .lbl{fill:var(--txt)}'
               '.art-svg .grid{stroke:var(--line);stroke-width:1}</style>')
    if titolo:
        out.append(f'<text x="{x0}" y="17" class="lbl" font-size="14" '
                   f'font-family="{DISP}" letter-spacing="0.5">{esc(titolo)}</text>')
    if sub:
        out.append(f'<text x="{x0}" y="33" font-size="10.5">{esc(sub)}</text>')
    v = v_range[0]
    while v <= v_range[1]:
        y = sv(v)
        out.append(f'<line x1="{x0}" y1="{y:.1f}" x2="{x1}" y2="{y:.1f}" class="grid"/>')
        out.append(f'<text x="{x0-6}" y="{y+3:.1f}" font-size="9.5" text-anchor="end">{v:.0f}</text>')
        v += 50
    out.append(f'<text x="{x0-6}" y="{y_v0-8}" font-size="9" text-anchor="end" fill="var(--accent)">km/h</text>')
    for t in (0, 50, 100):
        y = stt(t)
        out.append(f'<line x1="{x0}" y1="{y:.1f}" x2="{x1}" y2="{y:.1f}" class="grid"/>')
        out.append(f'<text x="{x0-6}" y="{y+3:.1f}" font-size="9.5" text-anchor="end">{t}</text>')
    out.append(f'<text x="{x0-6}" y="{y_t0-6}" font-size="9" text-anchor="end" fill="var(--accent)">gas %</text>')
    for dx in (-150, -100, -50, 0, 50, 100, 150):
        if abs(dx) > meta:
            continue
        x = sx(dx)
        lab = "apice" if dx == 0 else f"{dx:+d}"
        out.append(f'<line x1="{x:.1f}" y1="{y_t1}" x2="{x:.1f}" y2="{y_t1+4}" stroke="var(--line2)"/>')
        out.append(f'<text x="{x:.1f}" y="{y_t1+16}" font-size="9.5" text-anchor="middle">{lab}</text>')
    out.append(f'<text x="{(x0+x1)/2:.0f}" y="{H-4}" font-size="9.5" text-anchor="middle">distanza dall’apice (m)</text>')
    # apice
    xa = sx(0)
    out.append(f'<line x1="{xa:.1f}" y1="{y_v0}" x2="{xa:.1f}" y2="{y_t1}" '
               f'stroke="var(--line2)" stroke-width="1" stroke-dasharray="2 3" opacity="0.8"/>')
    if apex_txt:
        out.append(f'<text x="{xa:.1f}" y="{y_t1+30}" font-size="9.5" text-anchor="middle">{esc(apex_txt)}</text>')
    # serie + marker
    for s in serie:
        col = s.get("colore") or "var(--dim)"
        dash = ' stroke-dasharray="6 4"' if s.get("tratteggio") else ''
        pv = [(sx(dx), sv(max(v_range[0], min(v_range[1], v)))) for dx, v, t in s["punti"]]
        pt = [(sx(dx), stt(max(0, min(100, t)))) for dx, v, t in s["punti"]]
        out.append(f'<path d="{_path(pv)}" fill="none" stroke="{col}" stroke-width="2.2" '
                   f'stroke-linejoin="round" stroke-linecap="round"{dash}/>')
        out.append(f'<path d="{_path(pt)}" fill="none" stroke="{col}" stroke-width="2.2" '
                   f'stroke-linejoin="round" stroke-linecap="round"{dash}/>')
        if s.get("marker") is not None:
            xm = sx(s["marker"])
            out.append(f'<line x1="{xm:.1f}" y1="{y_v0}" x2="{xm:.1f}" y2="{y_v1}" '
                       f'stroke="{col}" stroke-width="1.4" stroke-dasharray="3 3"/>')
            out.append(f'<circle cx="{xm:.1f}" cy="{y_v0+7}" r="3.5" fill="{col}"/>')
    if marker_label:
        out.append(f'<text x="{x0+4}" y="{y_v0-8}" font-size="10" class="lbl" '
                   f'font-family="{DISP}">{esc(marker_label)}</text>')
    # legenda
    lx, ly = x0 + 4, y_v0 + 20
    for s in serie:
        col = s.get("colore") or "var(--dim)"
        dash = 'stroke-dasharray="6 4"' if s.get("tratteggio") else ''
        out.append(f'<line x1="{lx}" y1="{ly-6}" x2="{lx+16}" y2="{ly-6}" stroke="{col}" stroke-width="2.4" {dash}/>')
        out.append(f'<text x="{lx+22}" y="{ly-3}" font-size="10.5" class="lbl">{esc(s["sigla"])}</text>')
        lx += 22 + 11 * len(str(s["sigla"])) + 20
    out.append('</svg>')
    return "".join(out)


def grafico_scatter(punti, *, x_range=(0, 100), y_range=(0, 100),
                    x_ticks=(0, 25, 50, 75, 100), y_ticks=(0, 25, 50, 75, 100),
                    x_label="", y_label="", cx=50, cy=50, titolo="", sub="",
                    ang=("", "", "", "")):
    """Dispersione etichettata (aspetto preservato). punti: [{label, colore, x, y,
    evidenza}]. cx/cy = crocevia dei quadranti. ang = etichette dei 4 quadranti
    (basso-dx, alto-dx, alto-sx, basso-sx)."""
    W, H = 720, 470
    ml, mr, mt, mb = 56, 118, 56, 44
    x0, x1 = ml, W - mr
    y0, y1 = mt, H - mb
    sx = Scala(x_range[0], x_range[1], x0, x1)
    sy = Scala(y_range[0], y_range[1], y1, y0)

    out = [f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" '
           f'font-family="{MONO}" class="art-svg">']
    out.append('<style>.art-svg text{fill:var(--dim)}.art-svg .lbl{fill:var(--txt)}'
               '.art-svg .grid{stroke:var(--line);stroke-width:1}</style>')
    if titolo:
        out.append(f'<text x="{x0}" y="17" class="lbl" font-size="14" '
                   f'font-family="{DISP}" letter-spacing="0.5">{esc(titolo)}</text>')
    if sub:
        out.append(f'<text x="{x0}" y="33" font-size="10.5">{esc(sub)}</text>')
    # cornice + griglia
    out.append(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" fill="none" stroke="var(--line)"/>')
    for xv in x_ticks:
        x = sx(xv)
        out.append(f'<line x1="{x:.1f}" y1="{y1}" x2="{x:.1f}" y2="{y1+4}" stroke="var(--line2)"/>')
        out.append(f'<text x="{x:.1f}" y="{y1+16}" font-size="9" text-anchor="middle">{xv}</text>')
    for yv in y_ticks:
        y = sy(yv)
        out.append(f'<line x1="{x0-4}" y1="{y:.1f}" x2="{x0}" y2="{y:.1f}" stroke="var(--line2)"/>')
        out.append(f'<text x="{x0-7}" y="{y+3:.1f}" font-size="9" text-anchor="end">{yv}</text>')
    # crocevia quadranti
    xcx, ycy = sx(cx), sy(cy)
    out.append(f'<line x1="{xcx:.1f}" y1="{y0}" x2="{xcx:.1f}" y2="{y1}" class="grid" stroke-dasharray="3 3"/>')
    out.append(f'<line x1="{x0}" y1="{ycy:.1f}" x2="{x1}" y2="{ycy:.1f}" class="grid" stroke-dasharray="3 3"/>')
    ap = [(x1 - 6, y1 - 8, "end"), (x1 - 6, y0 + 14, "end"), (x0 + 6, y0 + 14, "start"), (x0 + 6, y1 - 8, "start")]
    for (tx, ty, anc), lab in zip(ap, ang):
        if lab:
            out.append(f'<text x="{tx:.1f}" y="{ty:.1f}" font-size="9" text-anchor="{anc}" '
                       f'opacity="0.75" font-style="italic">{esc(lab)}</text>')
    # assi
    out.append(f'<text x="{(x0+x1)/2:.0f}" y="{H-6}" font-size="10" text-anchor="middle">{esc(x_label)}</text>')
    out.append(f'<text x="14" y="{(y0+y1)/2:.0f}" font-size="10" text-anchor="middle" '
               f'transform="rotate(-90 14 {(y0+y1)/2:.0f})">{esc(y_label)}</text>')
    # punti + etichette (etichetta a destra del punto)
    for p in sorted(punti, key=lambda q: q["x"]):
        px, py = sx(max(x_range[0], min(x_range[1], p["x"]))), sy(max(y_range[0], min(y_range[1], p["y"])))
        col = p.get("colore") or "var(--dim)"
        r = 6 if p.get("evidenza") else 4.5
        out.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{r}" fill="{col}" '
                   + ('stroke="var(--txt)" stroke-width="1.5"' if p.get("evidenza") else '') + '/>')
        lx = px + r + 4
        anc = "start"
        if lx > x1 + 4:
            lx, anc = px - r - 4, "end"
        out.append(f'<text x="{lx:.1f}" y="{py+3:.1f}" font-size="9.5" text-anchor="{anc}" '
                   f'class="{"lbl" if p.get("evidenza") else ""}">{esc(p["label"])}</text>')
    out.append('</svg>')
    return "".join(out)


def barre_dv(righe, *, titolo="", sub="", unita="km/h", base=0.0, ml=52,
             caption="km/h persi alla linea (giro veloce)", dec=1):
    """Barre orizzontali: una riga per elemento. righe: [{sigla,colore,valore,
    evidenza(bool)}] gia' ordinata. base>0 tronca l'asse (per differenze piccole
    su valori grandi): va sempre dichiarato nella caption. ml = margine sinistro
    per le etichette (allargalo se le sigle sono lunghe, es. nomi team).
    dec = cifre decimali dell'etichetta numerica (default 1 = km/h; usa 3 per i
    distacchi in secondi/millesimi). dec=1 riproduce il comportamento storico.
    """
    n = len(righe)
    rowh = 20
    W = 760
    mt, mb = 40, 18
    H = mt + n * rowh + mb
    x0 = ml
    x1 = W - 90
    vmax = max([r["valore"] for r in righe] + [base + 1.0])
    sx = Scala(base, vmax + (vmax - base) * 0.12, x0, x1)

    out = [f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" '
           f'font-family="{MONO}" class="art-svg">']
    out.append('<style>.art-svg text{fill:var(--dim)}.art-svg .lbl{fill:var(--txt)}</style>')
    if titolo:
        out.append(f'<text x="{x0}" y="18" class="lbl" font-size="14" '
                   f'font-family="{DISP}" letter-spacing="0.5">{esc(titolo)}</text>')
    if sub:
        out.append(f'<text x="{W-16}" y="18" font-size="10.5" text-anchor="end">{esc(sub)}</text>')
    # asse zero
    out.append(f'<line x1="{x0}" y1="{mt-4}" x2="{x0}" y2="{H-mb}" stroke="var(--line2)" stroke-width="1"/>')
    for i, r in enumerate(righe):
        y = mt + i * rowh
        col = r.get("colore") or "var(--dim)"
        val = r["valore"]
        w = max(0.0, sx(val) - x0)
        op = "1" if r.get("evidenza") else "0.32"
        out.append(f'<text x="{x0-8}" y="{y+rowh/2+3:.1f}" font-size="10.5" text-anchor="end" '
                   f'class="{"lbl" if r.get("evidenza") else ""}">{esc(r["sigla"])}</text>')
        if w > 0.4:
            out.append(f'<rect x="{x0}" y="{y+3:.1f}" width="{w:.1f}" height="{rowh-8}" '
                       f'rx="2" fill="{col}" opacity="{op}"/>')
        vt = f'{val:.{dec}f}' if val >= 0.5 * 10 ** (-dec) else '0'
        tx = x0 + w + 6 if w > 0.4 else x0 + 6
        out.append(f'<text x="{tx:.1f}" y="{y+rowh/2+3:.1f}" font-size="10" '
                   f'class="{"lbl" if r.get("evidenza") else ""}">{vt}</text>')
    out.append(f'<text x="{x1}" y="{H-4}" font-size="9.5" text-anchor="end">{esc(caption)}</text>')
    out.append('</svg>')
    return "".join(out)


def grafico_pole(serie, delta, corners, settori, *, dist_max, v_range,
                 titolo="", sub="", endpoint_txt="", picco=None, avvallamento=None):
    """GRAFICO-EROE «dove si è vinta la pole». Due pannelli allineati sull'asse
    x = distanza sul giro (m, 0 = linea del traguardo a sinistra):
      A (alto)  = overlay velocità dei due giri veloci;
      B (basso) = traccia del VANTAGGIO cumulato del protagonista (s), positivo
                  in alto = protagonista avanti, negativo = rivale avanti.
    Le tre ZONE-SETTORE sono ombreggiate e etichettate col delta ufficiale, nel
    colore del pilota che vince quel settore. Aspetto preservato (annotazioni non
    si deformano).

    serie:   [{sigla, colore, punti:[(dist, speed)]}]  (protagonista per primo)
    delta:   [(dist, vantaggio_protagonista_sec)]
    corners: [{label, dist}]
    settori: [{d0, d1, testo, colore}]  colore = colore del vincitore del settore
    picco/avvallamento: dict opzionale {dist, val, txt} da annotare sul pannello B
    """
    W, H = 780, 470
    ml, mr, mt = 54, 18, 70
    h_a, gap, h_b = 200, 40, 96
    y_a0, y_a1 = mt, mt + h_a
    y_b0, y_b1 = y_a1 + gap, y_a1 + gap + h_b
    x0, x1 = ml, W - mr
    sx = Scala(0, dist_max, x0, x1)
    sv = Scala(v_range[0], v_range[1], y_a1, y_a0)
    dvals = [d for _, d in delta]
    dlo = min(dvals + [0.0]); dhi = max(dvals + [0.0])
    pad = (dhi - dlo) * 0.15 or 0.02
    sd = Scala(dlo - pad, dhi + pad, y_b1, y_b0)

    out = [f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" '
           f'font-family="{MONO}" class="art-svg">']
    out.append('<style>.art-svg text{fill:var(--dim)}.art-svg .lbl{fill:var(--txt)}'
               '.art-svg .grid{stroke:var(--line);stroke-width:1}</style>')
    if titolo:
        out.append(f'<text x="{x0}" y="18" class="lbl" font-size="14.5" '
                   f'font-family="{DISP}" letter-spacing="0.5">{esc(titolo)}</text>')
    if sub:
        out.append(f'<text x="{x0}" y="34" font-size="10.5">{esc(sub)}</text>')

    # --- zone settore (ombra su entrambi i pannelli) + etichetta col delta ufficiale ---
    for s in settori:
        xa, xb = sx(s["d0"]), sx(s["d1"])
        col = s.get("colore") or "var(--dim)"
        out.append(f'<rect x="{xa:.1f}" y="{y_a0}" width="{xb-xa:.1f}" height="{y_a1-y_a0}" '
                   f'fill="{col}" opacity="0.07"/>')
        out.append(f'<rect x="{xa:.1f}" y="{y_b0}" width="{xb-xa:.1f}" height="{y_b1-y_b0}" '
                   f'fill="{col}" opacity="0.07"/>')
        out.append(f'<line x1="{xb:.1f}" y1="{y_a0}" x2="{xb:.1f}" y2="{y_b1}" '
                   f'stroke="var(--line2)" stroke-width="1" stroke-dasharray="2 3" opacity="0.7"/>')
        out.append(f'<text x="{(xa+xb)/2:.1f}" y="{mt-8}" font-size="11" text-anchor="middle" '
                   f'class="lbl" font-family="{DISP}" letter-spacing="0.3" fill="{col}">{esc(s["testo"])}</text>')

    # --- pannello A: griglia velocità ---
    v = v_range[0]
    while v <= v_range[1]:
        y = sv(v)
        out.append(f'<line x1="{x0}" y1="{y:.1f}" x2="{x1}" y2="{y:.1f}" class="grid"/>')
        out.append(f'<text x="{x0-6}" y="{y+3:.1f}" font-size="9" text-anchor="end">{v}</text>')
        v += 50
    out.append(f'<text x="{x0-6}" y="{y_a0-6}" font-size="9" text-anchor="end" fill="var(--accent)">km/h</text>')

    # --- curve: tacche + numeri sull'asse fra i pannelli ---
    for c in corners:
        xc = sx(c["dist"])
        out.append(f'<line x1="{xc:.1f}" y1="{y_a1}" x2="{xc:.1f}" y2="{y_a1+4}" stroke="var(--line2)"/>')
        out.append(f'<text x="{xc:.1f}" y="{y_a1+14}" font-size="8" text-anchor="middle">{esc(c["label"])}</text>')

    # --- velocità: serie ---
    for i, s in enumerate(serie):
        col = s.get("colore") or "var(--dim)"
        dash = ' stroke-dasharray="5 4"' if i else ''
        pts = [(sx(d), sv(max(v_range[0], min(v_range[1], v)))) for d, v in s["punti"]]
        out.append(f'<path d="{_path(pts)}" fill="none" stroke="{col}" stroke-width="2.1" '
                   f'stroke-linejoin="round" stroke-linecap="round"{dash}/>')
    # legenda (in alto a dx del pannello A)
    lx = x1 - 4
    for s in reversed(serie):
        col = s.get("colore") or "var(--dim)"
        sig = str(s["sigla"])
        lx -= 11 * len(sig) + 8
        out.append(f'<text x="{lx+22}" y="{y_a0+13}" font-size="10.5" class="lbl" text-anchor="start">{esc(sig)}</text>')
        out.append(f'<rect x="{lx}" y="{y_a0+5}" width="16" height="3" rx="1.5" fill="{col}"/>')
        lx -= 12

    # --- pannello B: vantaggio cumulato ---
    yz = sd(0.0)
    # aree riempite: sopra lo zero = protagonista avanti; sotto = rivale avanti
    col_pro = serie[0].get("colore") or "var(--accent)"
    col_riv = serie[1].get("colore") if len(serie) > 1 else "var(--dim)"
    trace = [(sx(d), sd(v)) for d, v in delta]
    if trace:
        area_up = f'M{trace[0][0]:.1f} {yz:.1f} ' + " ".join(f'L{x:.1f} {y:.1f}' for x, y in trace) + \
                  f' L{trace[-1][0]:.1f} {yz:.1f} Z'
        # clip alle metà con due rettangoli
        out.append(f'<clipPath id="cpU"><rect x="{x0}" y="{y_b0}" width="{x1-x0}" height="{yz-y_b0:.1f}"/></clipPath>')
        out.append(f'<clipPath id="cpD"><rect x="{x0}" y="{yz:.1f}" width="{x1-x0}" height="{y_b1-yz:.1f}"/></clipPath>')
        out.append(f'<path d="{area_up}" fill="{col_pro}" opacity="0.16" clip-path="url(#cpU)"/>')
        out.append(f'<path d="{area_up}" fill="{col_riv}" opacity="0.16" clip-path="url(#cpD)"/>')
    # linea zero
    out.append(f'<line x1="{x0}" y1="{yz:.1f}" x2="{x1}" y2="{yz:.1f}" stroke="var(--line2)" stroke-width="1"/>')
    # tacche y del delta (0 e gli estremi arrotondati)
    for dv in (dlo, 0.0, dhi):
        y = sd(dv)
        out.append(f'<text x="{x0-6}" y="{y+3:.1f}" font-size="8.5" text-anchor="end">'
                   f'{("+%.2f"%dv).replace(".",",") if dv else "0"}</text>')
    out.append(f'<text x="{x0-6}" y="{y_b0-4}" font-size="8.5" text-anchor="end" fill="var(--accent)">'
               f'vantaggio (s)</text>')
    # traccia del vantaggio
    out.append(f'<path d="{_path(trace)}" fill="none" stroke="var(--txt)" stroke-width="1.8" '
               f'stroke-linejoin="round" stroke-linecap="round"/>')
    # annotazioni picco / avvallamento
    for an, colr in ((avvallamento, col_riv), (picco, col_pro)):
        if not an:
            continue
        ax, ay = sx(an["dist"]), sd(an["val"])
        out.append(f'<circle cx="{ax:.1f}" cy="{ay:.1f}" r="3" fill="{colr}"/>')
        dy = -6 if an["val"] >= 0 else 12
        anc = "middle" if x0 + 60 < ax < x1 - 60 else ("start" if ax <= x0 + 60 else "end")
        out.append(f'<text x="{ax:.1f}" y="{ay+dy:.1f}" font-size="9" text-anchor="{anc}" '
                   f'class="lbl">{esc(an["txt"])}</text>')
    # endpoint: la pole
    if trace:
        ex, ey = trace[-1]
        out.append(f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="4" fill="{col_pro}" '
                   f'stroke="var(--txt)" stroke-width="1"/>')
        if endpoint_txt:
            out.append(f'<text x="{ex-6:.1f}" y="{ey-6:.1f}" font-size="10.5" text-anchor="end" '
                       f'class="lbl" font-family="{DISP}">{esc(endpoint_txt)}</text>')
    # asse x (distanza) sotto il pannello B
    for dm in range(0, int(dist_max) + 1, 500):
        x = sx(dm)
        out.append(f'<line x1="{x:.1f}" y1="{y_b1}" x2="{x:.1f}" y2="{y_b1+4}" stroke="var(--line2)"/>')
        lab = "traguardo" if dm == 0 else f"{dm}"
        anc = "start" if dm == 0 else "middle"
        out.append(f'<text x="{x:.1f}" y="{y_b1+15}" font-size="8.5" text-anchor="{anc}">{lab}</text>')
    out.append(f'<text x="{(x0+x1)/2:.0f}" y="{H-5}" font-size="9.5" text-anchor="middle">'
               f'distanza sul giro (m) — sopra = più veloce, sotto = chi è avanti sul cronometro</text>')
    out.append('</svg>')
    return "".join(out)


def barre_divergenti(righe, *, col_pos, col_neg, lbl_pos="", lbl_neg="",
                     titolo="", sub="", unita="km/h", caption="", ml=58):
    """Barre orizzontali DIVERGENTI da uno zero centrale — una riga per curva,
    nell'ordine dato (giro dall'alto in basso). valore>0 va a destra (col_pos),
    valore<0 a sinistra (col_neg). righe: [{label, valore(±), nota}].
    Mostra a colpo d'occhio DOVE il protagonista guadagna e dove perde.
    """
    n = len(righe)
    rowh = 19
    W = 760
    mt, mb = 46, 26
    H = mt + n * rowh + mb
    cx = ml + (W - ml - 150) * 0.5 + 40      # zero centrale, spazio per note a dx
    half = (W - 150 - cx)                      # semiampiezza max a destra
    half = min(half, cx - ml - 6)
    vmax = max((abs(r["valore"]) for r in righe), default=1.0) or 1.0
    sx = Scala(0, vmax * 1.12, 0, half)

    out = [f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" '
           f'font-family="{MONO}" class="art-svg">']
    out.append('<style>.art-svg text{fill:var(--dim)}.art-svg .lbl{fill:var(--txt)}</style>')
    if titolo:
        out.append(f'<text x="{ml-6}" y="18" class="lbl" font-size="14" '
                   f'font-family="{DISP}" letter-spacing="0.5">{esc(titolo)}</text>')
    if sub:
        out.append(f'<text x="{W-16}" y="18" font-size="10.5" text-anchor="end">{esc(sub)}</text>')
    # intestazioni dei due lati
    if lbl_neg:
        out.append(f'<text x="{cx-6:.0f}" y="{mt-6}" font-size="10" text-anchor="end" '
                   f'fill="{col_neg}" font-family="{DISP}">◄ {esc(lbl_neg)}</text>')
    if lbl_pos:
        out.append(f'<text x="{cx+6:.0f}" y="{mt-6}" font-size="10" text-anchor="start" '
                   f'fill="{col_pos}" font-family="{DISP}">{esc(lbl_pos)} ►</text>')
    # asse zero
    out.append(f'<line x1="{cx:.1f}" y1="{mt-2}" x2="{cx:.1f}" y2="{H-mb+2}" stroke="var(--line2)" stroke-width="1.2"/>')
    for i, r in enumerate(righe):
        y = mt + i * rowh
        val = r["valore"]
        w = sx(abs(val))
        col = col_pos if val > 0 else (col_neg if val < 0 else "var(--dim)")
        out.append(f'<text x="{ml-6}" y="{y+rowh/2+3:.1f}" font-size="10" text-anchor="end" '
                   f'class="lbl">{esc(r["label"])}</text>')
        if w > 0.4:
            bx = cx if val > 0 else cx - w
            out.append(f'<rect x="{bx:.1f}" y="{y+3:.1f}" width="{w:.1f}" height="{rowh-8}" '
                       f'rx="2" fill="{col}" opacity="0.9"/>')
            vt = (f'{val:+.0f}').replace("-", "−")
            tx = cx + w + 5 if val > 0 else cx - w - 5
            anc = "start" if val > 0 else "end"
            out.append(f'<text x="{tx:.1f}" y="{y+rowh/2+3:.1f}" font-size="9.5" '
                       f'text-anchor="{anc}" class="lbl">{esc(vt)}</text>')
        else:
            out.append(f'<text x="{cx+5:.1f}" y="{y+rowh/2+3:.1f}" font-size="9.5" text-anchor="start">=</text>')
        if r.get("nota"):
            out.append(f'<text x="{W-14}" y="{y+rowh/2+3:.1f}" font-size="9" text-anchor="end">{esc(r["nota"])}</text>')
    if caption:
        out.append(f'<text x="{ml-6}" y="{H-8}" font-size="9.5">{esc(caption)}</text>')
    out.append('</svg>')
    return "".join(out)


def mappa_dominanza(segmenti, corners, *, x_range, y_range, col_prot, col_riv,
                    sig_prot, sig_riv, n_prot, n_riv, start_xy=None,
                    titolo="", sub="", caption=""):
    """MAPPA DI DOMINANZA A MINISETTORI, sulla pianta GPS del circuito in scala
    REALE (assi uguali: 1 metro in X = 1 metro in Y, così il tracciato non si
    deforma). Ogni minisettore è disegnato del colore del pilota più veloce IN
    QUEL TRATTO — mostra DOVE, metro per metro, nasce il vantaggio sul giro.

    segmenti: [{punti:[(x,y)], prot:bool}]  (prot=True -> lo vince il protagonista)
    corners:  [{label, x, y}]               (numeri-curva da posare sulla pianta)
    x_range/y_range: estensione dati (min,max) su X e Y (stessa scala del GPS)
    n_prot/n_riv: quanti minisettori vince ciascuno (per la legenda)
    start_xy: (x,y) della linea del traguardo, se nota (marcatore).
    """
    W = 760
    ml, mr, mt, mb = 22, 22, 66, 30
    aw, ah = W - ml - mr, 520
    dxr = (x_range[1] - x_range[0]) or 1.0
    dyr = (y_range[1] - y_range[0]) or 1.0
    k = min(aw / dxr, ah / dyr)                    # scala UNICA -> aspetto reale
    plot_w, plot_h = dxr * k, dyr * k
    ox = ml + (aw - plot_w) / 2                    # centra il tracciato nel riquadro
    oy = mt + (ah - plot_h) / 2
    H = mt + ah + mb

    def px(x):
        return ox + (x - x_range[0]) * k

    def py(y):
        return oy + (y_range[1] - y) * k          # Y del GPS va in su -> flip

    out = [f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" '
           f'font-family="{MONO}" class="art-svg">']
    out.append('<style>.art-svg text{fill:var(--dim)}.art-svg .lbl{fill:var(--txt)}</style>')
    if titolo:
        out.append(f'<text x="{ml}" y="18" class="lbl" font-size="14.5" '
                   f'font-family="{DISP}" letter-spacing="0.5">{esc(titolo)}</text>')
    if sub:
        out.append(f'<text x="{ml}" y="34" font-size="10.5">{esc(sub)}</text>')

    # --- sagoma di fondo (grigia, sotto): il tracciato intero, per contesto ---
    allpts = [p for s in segmenti for p in s["punti"]]
    if allpts:
        base_path = _path([(px(x), py(y)) for x, y in allpts])
        out.append(f'<path d="{base_path}" fill="none" stroke="var(--line)" '
                   f'stroke-width="9" stroke-linejoin="round" stroke-linecap="round" opacity="0.5"/>')

    # --- minisettori colorati (sopra) ---
    for s in segmenti:
        col = col_prot if s.get("prot") else col_riv
        p = _path([(px(x), py(y)) for x, y in s["punti"]])
        out.append(f'<path d="{p}" fill="none" stroke="{col}" stroke-width="5.5" '
                   f'stroke-linejoin="round" stroke-linecap="round"/>')

    # --- curve: piccoli numeri sulla pianta ---
    for c in corners:
        cx, cy = px(c["x"]), py(c["y"])
        out.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="1.6" fill="var(--dim)"/>')
        out.append(f'<text x="{cx+4:.1f}" y="{cy-3:.1f}" font-size="8" '
                   f'opacity="0.85">{esc(c["label"])}</text>')

    # --- linea del traguardo ---
    if start_xy is not None:
        sxp, syp = px(start_xy[0]), py(start_xy[1])
        out.append(f'<circle cx="{sxp:.1f}" cy="{syp:.1f}" r="4.5" fill="none" '
                   f'stroke="var(--txt)" stroke-width="1.6"/>')
        out.append(f'<text x="{sxp+7:.1f}" y="{syp+3:.1f}" font-size="9" '
                   f'class="lbl" font-family="{DISP}">START</text>')

    # --- legenda con conteggio dei minisettori vinti ---
    lx, ly = ml + 2, mt - 14
    for sig, col, n in ((sig_prot, col_prot, n_prot), (sig_riv, col_riv, n_riv)):
        out.append(f'<rect x="{lx}" y="{ly-9}" width="16" height="5" rx="2" fill="{col}"/>')
        out.append(f'<text x="{lx+22}" y="{ly-4}" font-size="11" class="lbl">'
                   f'{esc(sig)} · {n} settori</text>')
        lx += 22 + 8 * len(f"{sig} · {n} settori") + 24
    if caption:
        out.append(f'<text x="{W-mr}" y="{H-10}" font-size="9.5" text-anchor="end">{esc(caption)}</text>')
    out.append('</svg>')
    return "".join(out)


def delta_cumulato(serie, delta, corners, *, dist_max, v_range, col_prot, col_riv,
                   titolo="", sub="", slope=None, peak=None, dip=None, endpoint_txt=""):
    """DELTA-TIME CUMULATO su asse-distanza (il grafico che l'appassionato vede in
    TV e non sa leggere). Due pannelli allineati su x = distanza sul giro (m):
      A (alto)  = overlay velocità dei due giri veloci;
      B (basso) = vantaggio cumulato del protagonista (s): sopra lo zero = avanti.
    Il tratto di MASSIMA PENDENZA (dove il decimo nasce più in fretta) è ombreggiato
    e annotato. Aspetto preservato: le annotazioni non si deformano.

    serie: [{sigla, colore, punti:[(dist, speed)]}] (protagonista per primo)
    delta: [(dist, vantaggio_prot_sec)]   corners: [{label, dist}]
    slope: {d0, d1, txt} tratto di massima pendenza da ombreggiare (opz.)
    peak/dip: {dist, val, txt} punti notevoli sul pannello B (opz.)
    """
    W, H = 780, 470
    ml, mr, mt = 54, 18, 62
    h_a, gap, h_b = 196, 42, 100
    y_a0, y_a1 = mt, mt + h_a
    y_b0, y_b1 = y_a1 + gap, y_a1 + gap + h_b
    x0, x1 = ml, W - mr
    sx = Scala(0, dist_max, x0, x1)
    sv = Scala(v_range[0], v_range[1], y_a1, y_a0)
    dvals = [d for _, d in delta]
    dlo = min(dvals + [0.0]); dhi = max(dvals + [0.0])
    pad = (dhi - dlo) * 0.16 or 0.02
    sd = Scala(dlo - pad, dhi + pad, y_b1, y_b0)

    out = [f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" '
           f'font-family="{MONO}" class="art-svg">']
    out.append('<style>.art-svg text{fill:var(--dim)}.art-svg .lbl{fill:var(--txt)}'
               '.art-svg .grid{stroke:var(--line);stroke-width:1}</style>')
    if titolo:
        out.append(f'<text x="{x0}" y="18" class="lbl" font-size="14.5" '
                   f'font-family="{DISP}" letter-spacing="0.5">{esc(titolo)}</text>')
    if sub:
        out.append(f'<text x="{x0}" y="34" font-size="10.5">{esc(sub)}</text>')

    # --- tratto di massima pendenza (ombra su entrambi i pannelli) ---
    if slope is not None:
        xa, xb = sx(slope["d0"]), sx(slope["d1"])
        out.append(f'<rect x="{xa:.1f}" y="{y_a0}" width="{xb-xa:.1f}" height="{y_a1-y_a0}" '
                   f'fill="{col_prot}" opacity="0.10"/>')
        out.append(f'<rect x="{xa:.1f}" y="{y_b0}" width="{xb-xa:.1f}" height="{y_b1-y_b0}" '
                   f'fill="{col_prot}" opacity="0.10"/>')
        out.append(f'<text x="{(xa+xb)/2:.1f}" y="{mt-6}" font-size="10.5" text-anchor="middle" '
                   f'class="lbl" font-family="{DISP}" fill="{col_prot}">{esc(slope["txt"])}</text>')

    # --- pannello A: griglia velocità ---
    v = v_range[0]
    while v <= v_range[1]:
        y = sv(v)
        out.append(f'<line x1="{x0}" y1="{y:.1f}" x2="{x1}" y2="{y:.1f}" class="grid"/>')
        out.append(f'<text x="{x0-6}" y="{y+3:.1f}" font-size="9" text-anchor="end">{v}</text>')
        v += 50
    out.append(f'<text x="{x0-6}" y="{y_a0-6}" font-size="9" text-anchor="end" fill="var(--accent)">km/h</text>')

    # --- curve: tacche + numeri sull'asse fra i pannelli ---
    for c in corners:
        xc = sx(c["dist"])
        out.append(f'<line x1="{xc:.1f}" y1="{y_a1}" x2="{xc:.1f}" y2="{y_a1+4}" stroke="var(--line2)"/>')
        out.append(f'<text x="{xc:.1f}" y="{y_a1+14}" font-size="8" text-anchor="middle">{esc(c["label"])}</text>')

    # --- velocità: serie (protagonista pieno, rivale tratteggiato) ---
    for i, s in enumerate(serie):
        col = s.get("colore") or "var(--dim)"
        dash = ' stroke-dasharray="5 4"' if i else ''
        pts = [(sx(d), sv(max(v_range[0], min(v_range[1], v)))) for d, v in s["punti"]]
        out.append(f'<path d="{_path(pts)}" fill="none" stroke="{col}" stroke-width="2.1" '
                   f'stroke-linejoin="round" stroke-linecap="round"{dash}/>')
    lx = x1 - 4
    for s in reversed(serie):
        col = s.get("colore") or "var(--dim)"
        sig = str(s["sigla"])
        lx -= 11 * len(sig) + 8
        out.append(f'<text x="{lx+22}" y="{y_a0+13}" font-size="10.5" class="lbl" text-anchor="start">{esc(sig)}</text>')
        out.append(f'<rect x="{lx}" y="{y_a0+5}" width="16" height="3" rx="1.5" fill="{col}"/>')
        lx -= 12

    # --- pannello B: vantaggio cumulato ---
    yz = sd(0.0)
    trace = [(sx(d), sd(v)) for d, v in delta]
    if trace:
        area = f'M{trace[0][0]:.1f} {yz:.1f} ' + " ".join(f'L{x:.1f} {y:.1f}' for x, y in trace) + \
               f' L{trace[-1][0]:.1f} {yz:.1f} Z'
        out.append(f'<clipPath id="dcU"><rect x="{x0}" y="{y_b0}" width="{x1-x0}" height="{yz-y_b0:.1f}"/></clipPath>')
        out.append(f'<clipPath id="dcD"><rect x="{x0}" y="{yz:.1f}" width="{x1-x0}" height="{y_b1-yz:.1f}"/></clipPath>')
        out.append(f'<path d="{area}" fill="{col_prot}" opacity="0.16" clip-path="url(#dcU)"/>')
        out.append(f'<path d="{area}" fill="{col_riv}" opacity="0.16" clip-path="url(#dcD)"/>')
    out.append(f'<line x1="{x0}" y1="{yz:.1f}" x2="{x1}" y2="{yz:.1f}" stroke="var(--line2)" stroke-width="1"/>')
    for dv in (dlo, 0.0, dhi):
        y = sd(dv)
        out.append(f'<text x="{x0-6}" y="{y+3:.1f}" font-size="8.5" text-anchor="end">'
                   f'{("+%.2f"%dv).replace(".",",") if abs(dv)>1e-9 else "0"}</text>')
    out.append(f'<text x="{x0-6}" y="{y_b0-4}" font-size="8.5" text-anchor="end" fill="var(--accent)">'
               f'Δt (s)</text>')
    out.append(f'<path d="{_path(trace)}" fill="none" stroke="var(--txt)" stroke-width="1.8" '
               f'stroke-linejoin="round" stroke-linecap="round"/>')
    for an, colr in ((dip, col_riv), (peak, col_prot)):
        if not an:
            continue
        ax, ay = sx(an["dist"]), sd(an["val"])
        out.append(f'<circle cx="{ax:.1f}" cy="{ay:.1f}" r="3" fill="{colr}"/>')
        dy = -6 if an["val"] >= 0 else 12
        anc = "middle" if x0 + 60 < ax < x1 - 60 else ("start" if ax <= x0 + 60 else "end")
        out.append(f'<text x="{ax:.1f}" y="{ay+dy:.1f}" font-size="9" text-anchor="{anc}" '
                   f'class="lbl">{esc(an["txt"])}</text>')
    if trace:
        ex, ey = trace[-1]
        out.append(f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="4" fill="{col_prot}" '
                   f'stroke="var(--txt)" stroke-width="1"/>')
        if endpoint_txt:
            out.append(f'<text x="{ex-6:.1f}" y="{ey-6:.1f}" font-size="10.5" text-anchor="end" '
                       f'class="lbl" font-family="{DISP}">{esc(endpoint_txt)}</text>')
    for dm in range(0, int(dist_max) + 1, 500):
        x = sx(dm)
        out.append(f'<line x1="{x:.1f}" y1="{y_b1}" x2="{x:.1f}" y2="{y_b1+4}" stroke="var(--line2)"/>')
        lab = "traguardo" if dm == 0 else f"{dm}"
        anc = "start" if dm == 0 else "middle"
        out.append(f'<text x="{x:.1f}" y="{y_b1+15}" font-size="8.5" text-anchor="{anc}">{lab}</text>')
    out.append(f'<text x="{(x0+x1)/2:.0f}" y="{H-5}" font-size="9.5" text-anchor="middle">'
               f'distanza sul giro (m) — sopra = più veloce, sotto = chi è avanti sul cronometro</text>')
    out.append('</svg>')
    return "".join(out)


def boxplot(righe, *, titolo="", sub="", unita="s", ml=104,
            caption="mediana + IQR dei giri verdi puliti", x_label="", dec=2,
            fmt=None):
    """GRAFICO-EROE del passo-gara: un boxplot orizzontale per pilota, il piu'
    rapido in alto. Mostra la CONSISTENZA (dispersione), non solo la mediana.

    righe: [{sigla, colore, med, q1, q3, lo, hi, traffico(bool), nota}] gia'
      ordinata (mediana crescente). med/q1/q3/lo/hi in secondi:
        box   = intervallo interquartile (Q1-Q3) -> meta' centrale dei giri;
        linea = mediana (il passo rappresentativo);
        baffi = estensione (lo-hi, giri entro 1,5xIQR dai quartili).
      traffico=True marca il pilota il cui passo NON e' pulito (aria sporca):
      box tratteggiato a bassa opacita' + una tacca; la sua mediana e' una
      lettura "in scia", non il passo libero. nota = riga piccola sotto la sigla.
    fmt: funzione sec->str per l'etichetta numerica a destra (default: dec cifre).
    Aspetto preservato: nulla si deforma. x = tempo sul giro (s), crescente a dx.
    """
    import math
    fmt = fmt or (lambda s: f"{s:.{dec}f}".replace(".", ","))
    n = len(righe)
    rowh = 24
    W = 780
    mt, mb = 54, 46
    H = mt + n * rowh + mb
    x0 = ml
    x1 = W - 76
    los = [r["lo"] for r in righe]
    his = [r["hi"] for r in righe]
    vlo, vhi = min(los), max(his)
    pad = (vhi - vlo) * 0.06 or 0.5
    sx = Scala(vlo - pad, vhi + pad, x0, x1)

    out = [f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" '
           f'font-family="{MONO}" class="art-svg">']
    out.append('<style>.art-svg text{fill:var(--dim)}.art-svg .lbl{fill:var(--txt)}'
               '.art-svg .grid{stroke:var(--line);stroke-width:1}</style>')
    if titolo:
        out.append(f'<text x="{x0}" y="18" class="lbl" font-size="14" '
                   f'font-family="{DISP}" letter-spacing="0.5">{esc(titolo)}</text>')
    if sub:
        out.append(f'<text x="{W-16}" y="18" font-size="10.5" text-anchor="end">{esc(sub)}</text>')

    # griglia verticale: tacche a secondi interi
    y_top = mt - 6
    y_bot = H - mb
    t = math.ceil(vlo - pad)
    while t <= vhi + pad:
        x = sx(t)
        out.append(f'<line x1="{x:.1f}" y1="{y_top}" x2="{x:.1f}" y2="{y_bot}" class="grid"/>')
        out.append(f'<text x="{x:.1f}" y="{y_bot+13}" font-size="9" text-anchor="middle">{t}</text>')
        t += 1
    out.append(f'<text x="{x1}" y="{y_bot+28}" font-size="9.5" text-anchor="end">'
               f'{esc(x_label or f"tempo sul giro ({unita}) - piu’ a sinistra = piu’ veloce")}</text>')

    for i, r in enumerate(righe):
        y = mt + i * rowh
        yc = y + rowh / 2
        col = r.get("colore") or "var(--dim)"
        traf = bool(r.get("traffico"))
        xq1, xq3 = sx(r["q1"]), sx(r["q3"])
        xlo, xhi = sx(r["lo"]), sx(r["hi"])
        xmed = sx(r["med"])
        bh = rowh - 11
        # baffi
        out.append(f'<line x1="{xlo:.1f}" y1="{yc:.1f}" x2="{xq1:.1f}" y2="{yc:.1f}" '
                   f'stroke="{col}" stroke-width="1" opacity="0.6"/>')
        out.append(f'<line x1="{xq3:.1f}" y1="{yc:.1f}" x2="{xhi:.1f}" y2="{yc:.1f}" '
                   f'stroke="{col}" stroke-width="1" opacity="0.6"/>')
        for xx in (xlo, xhi):
            out.append(f'<line x1="{xx:.1f}" y1="{yc-3:.1f}" x2="{xx:.1f}" y2="{yc+3:.1f}" '
                       f'stroke="{col}" stroke-width="1" opacity="0.6"/>')
        # box IQR
        fillop = "0.15" if traf else "0.42"
        dash = ' stroke-dasharray="3 2"' if traf else ''
        out.append(f'<rect x="{xq1:.1f}" y="{y+5.5:.1f}" width="{max(0.6,xq3-xq1):.1f}" height="{bh}" '
                   f'rx="2" fill="{col}" opacity="{fillop}" stroke="{col}" stroke-width="1.2"{dash}/>')
        # mediana
        out.append(f'<line x1="{xmed:.1f}" y1="{y+4:.1f}" x2="{xmed:.1f}" y2="{y+rowh-4:.1f}" '
                   f'stroke="{col}" stroke-width="2.4"/>')
        # etichetta pilota a sinistra (con eventuale nota piccola sotto)
        tag = ("▲ " + esc(r["sigla"])) if traf else esc(r["sigla"])
        ytxt = yc + (0 if not r.get("nota") else -2)
        out.append(f'<text x="{x0-9}" y="{ytxt+3:.1f}" font-size="10.5" text-anchor="end" '
                   f'class="{"" if traf else "lbl"}" opacity="{0.8 if traf else 1}">{tag}</text>')
        if r.get("nota"):
            out.append(f'<text x="{x0-9}" y="{yc+11:.1f}" font-size="7" text-anchor="end" '
                       f'opacity="0.5">{esc(r["nota"])}</text>')
        # mediana numerica a destra
        out.append(f'<text x="{x1+6}" y="{yc+3:.1f}" font-size="9.5" '
                   f'class="{"" if traf else "lbl"}">{fmt(r["med"])}</text>')
    out.append(f'<text x="{x0}" y="{H-6}" font-size="9" text-anchor="start" opacity="0.85">'
               f'{esc(caption)}</text>')
    out.append('</svg>')
    return "".join(out)
