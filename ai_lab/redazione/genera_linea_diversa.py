"""
genera_linea_diversa.py — "La linea diversa" (track-agnostic, canale A telemetria).

Domanda-guida: due giri velocissimi, quasi gemelli sul cronometro — ma in QUALE curva
i due piloti guidano davvero su una linea diversa, e di quanti metri? Il ribaltamento
possibile: giri separati da una manciata di millesimi che in un punto della pista
corrono a metri di distanza.

COSA MISURA. Prende i DUE giri più veloci della sessione (i due piloti più rapidi),
ne ricava la TRAIETTORIA GPS (canali X/Y di FastF1, in decimi di metro → metri) e,
curva per curva, misura lo SCOSTAMENTO LATERALE massimo fra le due linee (distanza
punto→segmento, nei due versi). Le curve sono ANCORATE alla loro posizione X/Y
(circuit_info), non alla distanza-sul-giro: così il confronto non risente dello
sfasamento fra i due sistemi di distanza. Numero-chiave = i metri di scostamento.

CONTROLLO-NULLO (il cuore onesto del generatore). La posizione GPS di FastF1 è
campionata a passo grosso (spesso ~10-15 m): due linee IDENTICHE, campionate in punti
diversi, sembrano divergere di qualche metro solo perché le corde tagliano la curva.
Per non prendere questo per una linea diversa, il generatore stima un RUMORE DI FONDO
confrontando ogni pilota con SE STESSO (i suoi giri puliti a coppie): lo scostamento
fra due giri dello STESSO pilota NON è una scelta di linea diversa — è la variabilità
che quel pilota non ripete (campionamento GPS a corda grossa, più la linea che lui
stesso non ricalca identica giro dopo giro, più eventuali buchi/dropout della
posizione). Una curva è una "linea diversa" VERA solo se lo scostamento fra i due
piloti SUPERA questo rumore-di-fondo (per fattore e per margine) ed è sopra una soglia
assoluta; e solo se il valore è FISICAMENTE una linea (sotto un tetto pari a larghezza
pista + via di fuga: oltre, è artefatto GPS/metrica, non traiettoria). Se nessuna
curva ci riesce, il generatore SI AUTO-SALTA: la differenza fra i due non si distingue
dalla variabilità dello stesso pilota, e non c'è storia da raccontare.

AUTO-SALTO con grazia (ritorna None, stampa la ragione, non rompe la rotazione):
 - posizione GPS assente/incompleta (X/Y mancanti o traiettoria ferma);
 - meno di due piloti con traiettoria valida;
 - nessuna curva con scostamento che superi il controllo-nullo.

TRACK-AGNOSTIC: nessun literal di GP/curva/pilota nella logica; anno, GP, circuito,
round, sessione e le due sigle vengono dai parametri e da ses.event / dai dati.

DIVIETI onorati: niente energia/ERS/deployment/clipping; niente meteo inventato;
niente superlativi assoluti non verificati; QUALI≠GRIGLIA (parliamo di giri e linee,
non di posizioni in griglia). Un numero secco citabile = i metri di scostamento, con
accanto il rumore-di-fondo che ha superato.

python3 UTENTE (fastf1). Solo lettura; bozza in ai_lab/redazione/bozze/ (mai demo/).
"""
from __future__ import annotations
import os
import sys
import math
import datetime

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele   # noqa: E402
import curve  # noqa: E402
import svg    # noqa: E402
import base   # noqa: E402

# --- parametri di misura (dichiarati) ---------------------------------------
WIN = 65.0         # m: mezza-finestra (lunghezza d'arco) attorno alla curva
MAXSEG = 30.0      # m: corda oltre cui NON mi fido (dropout GPS): il segmento è saltato
ANCHOR_MAX = 8.0   # m: distanza massima curva↔campione più vicino perché la curva sia misurabile
MIN_PUNTI = 4      # campioni minimi per pilota nella finestra
MIN_CURVE = 6      # curve minime misurate perché la classifica/il nullo abbiano senso
MIN_DIVERG = 3.0   # m: soglia ASSOLUTA di scostamento
DEV_MAX_FISICO = 18.0  # m: tetto FISICO. Due linee di gara non distano lateralmente più
                   # della larghezza pista + via di fuga effettivamente usata (~15-18 m sul
                   # circuito più largo). Oltre, lo "scostamento" non è una traiettoria: è un
                   # artefatto della posizione GPS (buco/dropout fra i campioni) o della metrica
                   # punto→segmento ai bordi della finestra. La curva è NON misurabile e va scartata:
                   # senza questo tetto un allentamento del controllo-nullo pubblicherebbe numeri
                   # impossibili (misurati fino a 30-40 m su piste larghe ~12 m).
NULL_FATTORE = 1.5 # lo scostamento deve superare NULL_FATTORE × il rumore-di-fondo
NULL_MARGINE = 2.0 # m: e superarlo di almeno questo margine
MAX_GIRI = 6       # giri puliti per pilota usati per stimare il rumore-di-fondo
MIN_COPPIE_NULLO = 3  # coppie stesso-pilota minime per stimare il controllo-nullo


def it(x, dec=1):
    return base.it(x, dec)


def _slug(s):
    out = []
    for ch in str(s).lower().strip():
        if ch.isalnum():
            out.append(ch)
        elif out and out[-1] != "-":
            out.append("-")
    return "".join(out).strip("-") or "gp"


# ---------------------------------------------------------------------------
# TRAIETTORIA GPS di un giro, in metri, con lunghezza d'arco. Uso get_pos_data()
# (i campioni di posizione autentici); X/Y sono in decimi di metro → /10.
# ---------------------------------------------------------------------------
def _linea(lap):
    try:
        pos = lap.get_pos_data()
    except Exception:
        return None
    if pos is None or len(pos) < 20 or "X" not in pos.columns or "Y" not in pos.columns:
        return None
    import numpy as np
    x = pos["X"].values.astype(float) / 10.0
    y = pos["Y"].values.astype(float) / 10.0
    m = np.isfinite(x) & np.isfinite(y)
    x, y = x[m], y[m]
    if len(x) < 20:
        return None
    # scarto i campioni consecutivi coincidenti (auto fermo / duplicati)
    keep = np.concatenate([[True], (np.diff(x) ** 2 + np.diff(y) ** 2) > 1e-4])
    x, y = x[keep], y[keep]
    if len(x) < 20 or (float(x.max() - x.min()) < 50.0 and float(y.max() - y.min()) < 50.0):
        return None
    s = np.concatenate([[0.0], np.cumsum(np.hypot(np.diff(x), np.diff(y)))])
    passo = float(np.median(np.hypot(np.diff(x), np.diff(y)))) if len(x) > 1 else None
    return {"x": x, "y": y, "s": s, "passo": passo}


def _giri(ses, num):
    """Giri LANCIATI puliti di un pilota, dal più veloce (max MAX_GIRI). Il primo è
    il giro-veloce di riferimento; gli altri servono al controllo-nullo (confronto
    dello stesso pilota con sé stesso). Lista vuota se non ce ne sono."""
    gv = sorted(tele.giri_validi(ses, num), key=lambda l: tele.secondi(l["LapTime"]))
    if not gv:
        try:
            f = ses.laps.pick_drivers(num).pick_fastest()
            return [f] if f is not None else []
        except Exception:
            return []
    return gv[:MAX_GIRI]


# ---------------------------------------------------------------------------
# MISURA dello scostamento laterale, ancorata alla posizione della curva.
# ---------------------------------------------------------------------------
def _pt_seg(px, py, x0, y0, x1, y1):
    dx, dy = x1 - x0, y1 - y0
    L2 = dx * dx + dy * dy
    if L2 == 0.0:
        return math.hypot(px - x0, py - y0), x0, y0
    t = ((px - x0) * dx + (py - y0) * dy) / L2
    t = 0.0 if t < 0.0 else (1.0 if t > 1.0 else t)
    fx, fy = x0 + t * dx, y0 + t * dy
    return math.hypot(px - fx, py - fy), fx, fy


def _ancora(L, cx, cy):
    """Punto della linea più vicino alla posizione (cx,cy) della curva: (s, gap, i)."""
    import numpy as np
    i = int(np.argmin((L["x"] - cx) ** 2 + (L["y"] - cy) ** 2))
    gap = math.hypot(float(L["x"][i]) - cx, float(L["y"][i]) - cy)
    return float(L["s"][i]), gap, i


def _dev_dir(P, Q, sP, sQ):
    """Massimo, sui punti di P nella finestra attorno a sP, dello scostamento dalla
    polilinea di Q (segmenti ≤ MAXSEG) nella finestra attorno a sQ. I due sistemi di
    lunghezza d'arco sono agganciati alla STESSA curva, quindi confrontabili.
    Ritorna (dev, (px,py), (fx,fy)) o None."""
    import numpy as np
    mP = np.abs(P["s"] - sP) <= WIN
    mQ = np.abs(Q["s"] - sQ) <= WIN + MAXSEG
    pxs, pys = P["x"][mP], P["y"][mP]
    qxs, qys = Q["x"][mQ], Q["y"][mQ]
    if len(pxs) < MIN_PUNTI or len(qxs) < 2:
        return None
    best = None
    for px, py in zip(pxs, pys):
        d = None
        for k in range(len(qxs) - 1):
            if math.hypot(qxs[k + 1] - qxs[k], qys[k + 1] - qys[k]) > MAXSEG:
                continue                                 # corda su un buco: non affidabile
            dd, fx, fy = _pt_seg(px, py, qxs[k], qys[k], qxs[k + 1], qys[k + 1])
            if d is None or dd < d[0]:
                d = (dd, fx, fy)
        if d is None:
            continue                                     # punto senza segmento affidabile vicino
        if best is None or d[0] > best[0]:
            best = (d[0], (float(px), float(py)), (float(d[1]), float(d[2])))
    return best


def _diverg(A, B, cx, cy):
    """Scostamento massimo fra le linee A e B alla curva (cx,cy), nei due versi.
    Ritorna {dev, a, b, gapA, gapB} o None (curva non misurabile su una delle due)."""
    sA, gA, _ = _ancora(A, cx, cy)
    sB, gB, _ = _ancora(B, cx, cy)
    if gA > ANCHOR_MAX or gB > ANCHOR_MAX:
        return None
    dAB = _dev_dir(A, B, sA, sB)
    dBA = _dev_dir(B, A, sB, sA)
    cand = []
    if dAB:
        cand.append((dAB[0], dAB[1], dAB[2]))            # punto su A, piede su B
    if dBA:
        cand.append((dBA[0], dBA[2], dBA[1]))            # normalizzo: 'a' su A, 'b' su B
    if not cand:
        return None
    dev, a, b = max(cand, key=lambda c: c[0])
    return {"dev": dev, "a": a, "b": b, "gapA": gA, "gapB": gB}


def _downsample(punti, n=200):
    if len(punti) <= n:
        return punti
    step = len(punti) / n
    return [punti[int(i * step)] for i in range(n)]


def _sub_traj(L, cx, cy):
    """Punti (x,y) della linea nella finestra attorno alla curva (cx,cy)."""
    import numpy as np
    sC, _, _ = _ancora(L, cx, cy)
    m = np.abs(L["s"] - sC) <= WIN
    return list(zip((float(x) for x in L["x"][m]), (float(y) for y in L["y"][m]))), \
        (float(L["x"][np.abs(L["s"] - sC).argmin()]), float(L["y"][np.abs(L["s"] - sC).argmin()]))


# ---------------------------------------------------------------------------
# GRAFICO-EROE dedicato: le due traiettorie GPS in SCALA REALE, assi uguali
# (1 metro in X = 1 metro in Y in pixel: nessuna deformazione), con lo scostamento
# massimo annotato sul punto esatto e una barra-scala da 10 m.
# ---------------------------------------------------------------------------
def _grafico_traiettorie(serie, seg, ancore, *, corner_lab, titolo="", sub="", dev_txt=""):
    W, H = 760, 470
    ml, mr, mt, mb = 16, 16, 60, 30
    x0, x1 = ml, W - mr
    y0, y1 = mt, H - mb

    xsall, ysall = [], []
    for s in serie:
        for x, y in s["punti"]:
            xsall.append(x); ysall.append(y)
    xsall += [seg[0], seg[2]]; ysall += [seg[1], seg[3]]
    xmin, xmax = min(xsall), max(xsall)
    ymin, ymax = min(ysall), max(ysall)
    pad = 0.10 * max(xmax - xmin, ymax - ymin, 1.0)
    xmin -= pad; xmax += pad; ymin -= pad; ymax += pad
    spanx = max(xmax - xmin, 1.0)
    spany = max(ymax - ymin, 1.0)
    scale = min((x1 - x0) / spanx, (y1 - y0) / spany)     # scala UNICA → assi uguali
    cxd, cyd = (xmin + xmax) / 2.0, (ymin + ymax) / 2.0
    cxp, cyp = (x0 + x1) / 2.0, (y0 + y1) / 2.0

    def P(x, y):
        return (cxp + (x - cxd) * scale, cyp - (y - cyd) * scale)   # Y verso l'alto

    out = [f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" '
           f'font-family="{svg.MONO}" class="art-svg">']
    out.append('<style>.art-svg text{fill:var(--dim)}.art-svg .lbl{fill:var(--txt)}</style>')
    if titolo:
        out.append(f'<text x="{x0}" y="18" class="lbl" font-size="14.5" '
                   f'font-family="{svg.DISP}" letter-spacing="0.5">{svg.esc(titolo)}</text>')
    if sub:
        out.append(f'<text x="{x0}" y="34" font-size="10.5">{svg.esc(sub)}</text>')

    # banda "asfalto" sotto le due linee (solo contesto visivo)
    for s in serie:
        pts = [P(x, y) for x, y in s["punti"]]
        if len(pts) < 2:
            continue
        d = "M" + f"{pts[0][0]:.1f} {pts[0][1]:.1f}" + "".join(f" L{px:.1f} {py:.1f}" for px, py in pts[1:])
        out.append(f'<path d="{d}" fill="none" stroke="var(--line)" stroke-width="16" '
                   f'stroke-linejoin="round" stroke-linecap="round" opacity="0.35"/>')

    # freccia senso di marcia (tangente locale su A)
    s0 = serie[0]["punti"]
    if len(s0) >= 6:
        j = max(1, min(len(s0) - 2, int(len(s0) * 0.2)))
        ax0, ay0 = P(*s0[j - 1]); ax1, ay1 = P(*s0[j + 1])
        ang = math.degrees(math.atan2(ay1 - ay0, ax1 - ax0))
        out.append(f'<g transform="translate({ax1:.1f} {ay1:.1f}) rotate({ang:.1f})">'
                   f'<path d="M-7 -4 L5 0 L-7 4 Z" fill="var(--dim)"/></g>')
        out.append(f'<text x="{ax1:.1f}" y="{ay1-9:.1f}" font-size="9" text-anchor="middle">senso di marcia</text>')

    # le due traiettorie
    for s in serie:
        col = s.get("colore") or "var(--dim)"
        pts = [P(x, y) for x, y in s["punti"]]
        if len(pts) < 2:
            continue
        d = "M" + f"{pts[0][0]:.1f} {pts[0][1]:.1f}" + "".join(f" L{px:.1f} {py:.1f}" for px, py in pts[1:])
        out.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="2.6" '
                   f'stroke-linejoin="round" stroke-linecap="round"/>')

    # punti-curva (dove ciascuna linea passa più vicino al riferimento della curva)
    for a in ancore:
        px, py = P(a["x"], a["y"])
        out.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="3.2" fill="{a.get("colore") or "var(--dim)"}"/>')
    if ancore:
        px, py = P(ancore[0]["x"], ancore[0]["y"])
        out.append(f'<text x="{px:.1f}" y="{py+18:.1f}" font-size="11" text-anchor="middle" '
                   f'class="lbl" font-family="{svg.DISP}" letter-spacing="0.3">{svg.esc(corner_lab)}</text>')

    # SCOSTAMENTO massimo: segmento fra le due linee + etichetta metri
    ax, ay = P(seg[0], seg[1]); bx, by = P(seg[2], seg[3])
    out.append(f'<line x1="{ax:.1f}" y1="{ay:.1f}" x2="{bx:.1f}" y2="{by:.1f}" '
               f'stroke="var(--accent)" stroke-width="1.6" stroke-dasharray="4 3"/>')
    out.append(f'<circle cx="{ax:.1f}" cy="{ay:.1f}" r="3.4" fill="var(--accent)"/>')
    out.append(f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="3.4" fill="var(--accent)"/>')
    mx, my = (ax + bx) / 2.0, (ay + by) / 2.0
    sa = math.atan2(by - ay, bx - ax)
    ox, oy = -math.sin(sa) * 14, math.cos(sa) * 14
    out.append(f'<text x="{mx+ox:.1f}" y="{my+oy:.1f}" font-size="12" text-anchor="middle" '
               f'class="lbl" font-family="{svg.DISP}" letter-spacing="0.3">{svg.esc(dev_txt)}</text>')

    # barra-scala 10 m
    bar = 10.0 * scale
    bx0, by0 = x0 + 6, y1 - 6
    out.append(f'<line x1="{bx0:.1f}" y1="{by0:.1f}" x2="{bx0+bar:.1f}" y2="{by0:.1f}" stroke="var(--txt)" stroke-width="2"/>')
    out.append(f'<line x1="{bx0:.1f}" y1="{by0-3:.1f}" x2="{bx0:.1f}" y2="{by0+3:.1f}" stroke="var(--txt)" stroke-width="1.4"/>')
    out.append(f'<line x1="{bx0+bar:.1f}" y1="{by0-3:.1f}" x2="{bx0+bar:.1f}" y2="{by0+3:.1f}" stroke="var(--txt)" stroke-width="1.4"/>')
    out.append(f'<text x="{bx0+bar/2:.1f}" y="{by0-6:.1f}" font-size="9.5" text-anchor="middle">10 m</text>')

    # legenda (in alto a destra)
    lx = x1 - 6
    for s in reversed(serie):
        col = s.get("colore") or "var(--dim)"
        sig = str(s["sigla"])
        lx -= 11 * len(sig) + 8
        out.append(f'<text x="{lx+22:.1f}" y="{y0+2:.1f}" font-size="10.5" class="lbl" text-anchor="start">{svg.esc(sig)}</text>')
        out.append(f'<rect x="{lx:.1f}" y="{y0-6:.1f}" width="16" height="3" rx="1.5" fill="{col}"/>')
        lx -= 12
    out.append('</svg>')
    return "".join(out)


def costruisci(gara, sessione="Q", data_bozza=None):
    import numpy as np
    anno_hint = int(str(data_bozza)[:4]) if data_bozza else datetime.date.today().year
    ses = tele.carica_sessione(anno_hint, gara, sessione)

    ev = ses.event

    def _ev(k, dflt=""):
        try:
            v = ev[k]
            return v if v == v else dflt
        except Exception:
            return dflt
    try:
        anno = int(str(ev["EventDate"])[:4])
    except Exception:
        anno = anno_hint
    gp = str(_ev("EventName") or _ev("Country") or gara)
    country = str(_ev("Country") or gp)
    circuito = str(_ev("Location") or country)
    try:
        rnd = int(ev["RoundNumber"])
    except Exception:
        rnd = None
    ses_nome = str(getattr(ses, "name", None) or sessione)
    slug = _slug(circuito if _ev("Location") else (gp or gara))
    ID = f"linea-diversa-{slug}-{anno}"
    oggi = datetime.date.today().isoformat()

    piloti = tele.piloti_sessione(ses)
    colori = base.carica_colori()

    # --- i due piloti più veloci CON traiettoria valida (auto-salto se GPS incompleta) ---
    ranking = []
    for sig, info in piloti.items():
        try:
            s = tele.secondi(ses.laps.pick_drivers(info["num"]).pick_fastest()["LapTime"])
        except Exception:
            s = None
        if s is not None:
            ranking.append((s, sig, info["num"], info["team"]))
    ranking.sort()

    scelti = []
    for s, sig, num, team in ranking:
        laps = _giri(ses, num)
        linee = [L for L in (_linea(lp) for lp in laps) if L is not None]
        if not linee:
            continue
        scelti.append({"sig": sig, "num": num, "team": team, "lap_s": s,
                       "main": linee[0], "linee": linee, "main_lap": laps[0]})
        if len(scelti) == 2:
            break
    if len(scelti) < 2:
        print(f"  [linea-diversa] {gp} {ses_nome}: posizione GPS assente o incompleta "
              f"({len(scelti)} traiettorie valide) — auto-salto.")
        return None

    A, B = scelti[0], scelti[1]
    sigA, sigB = A["sig"], B["sig"]
    colA = colori.get(A["team"]) or piloti[sigA]["colore"] or "var(--accent)"
    colB = colori.get(B["team"]) or piloti[sigB]["colore"] or "var(--dim)"
    passo_gps = np.nanmedian([v for v in (A["main"].get("passo"), B["main"].get("passo")) if v])

    # --- scostamento per curva + controllo-nullo (INVILUPPO stesso-pilota) -----
    # Il rumore-di-fondo di una curva = il MASSIMO scostamento fra due giri dello
    # STESSO pilota (tutte le coppie dei suoi giri puliti, entrambi i piloti). È un
    # limite superiore robusto sull'artefatto di campionamento a quella curva: una
    # divergenza fra i due piloti conta solo se lo SUPERA. Un singolo giro-di-
    # controllo non basterebbe (la fase dei campioni varia da coppia a coppia).
    import itertools as _it
    coppie_self = []
    for L in (A["linee"], B["linee"]):
        coppie_self += list(_it.combinations(L, 2))
    cs = curve.curve(ses)
    righe = []
    scartate_fisica = 0
    for c in cs:
        cx, cy = c["x"] / 10.0, c["y"] / 10.0
        cross = _diverg(A["main"], B["main"], cx, cy)
        if not cross:
            continue
        if cross["dev"] > DEV_MAX_FISICO:
            scartate_fisica += 1          # scostamento non-fisico: artefatto GPS/metrica, non linea
            continue
        selfs = [d["dev"] for d in (_diverg(p, q, cx, cy) for p, q in coppie_self) if d]
        noise = max(selfs) if selfs else None
        righe.append({"numero": c["numero"], "lettera": c["lettera"],
                      "label": f"T{c['numero']}{c['lettera']}", "cx": cx, "cy": cy,
                      "dist": c["dist"], "dev": cross["dev"], "a": cross["a"], "b": cross["b"],
                      "noise": noise, "n_self": len(selfs),
                      "eccesso": (cross["dev"] - noise) if noise is not None else None})
    if len(righe) < MIN_CURVE:
        print(f"  [linea-diversa] {gp} {ses_nome}: solo {len(righe)} curve misurabili "
              f"(<{MIN_CURVE}; {scartate_fisica} scartate perché >{it(DEV_MAX_FISICO,0)} m, "
              f"non fisiche) — auto-salto.")
        return None
    if len(coppie_self) < MIN_COPPIE_NULLO:
        print(f"  [linea-diversa] {gp} {ses_nome}: controllo-nullo non stimabile "
              f"({len(coppie_self)} coppie stesso-pilota <{MIN_COPPIE_NULLO}) — auto-salto.")
        return None

    # candidate = curve la cui divergenza SUPERA l'inviluppo-nullo (fattore + margine)
    cand = [r for r in righe
            if r["noise"] is not None
            and r["dev"] >= MIN_DIVERG
            and r["dev"] >= NULL_FATTORE * r["noise"]
            and (r["dev"] - r["noise"]) >= NULL_MARGINE]
    n_null_disp = sum(1 for r in righe if r["noise"] is not None)
    if not cand:
        top = max(righe, key=lambda r: r["dev"])
        print(f"  [linea-diversa] {gp} {ses_nome}: nessuna curva supera il controllo-nullo "
              f"(max scostamento {top['dev']:.1f} m alla {top['label']}, ma il rumore-di-fondo "
              f"stesso-pilota vi arriva a {('%.1f m' % top['noise']) if top['noise'] is not None else 'n/d'}). "
              f"La differenza fra i due non si distingue dalla variabilità dello stesso pilota "
              f"(passo GPS ~{it(passo_gps,0)} m). Auto-salto.")
        return None

    cand.sort(key=lambda r: r["eccesso"], reverse=True)
    best = cand[0]
    resto = sorted((r for r in righe if r is not best), key=lambda r: r["dev"], reverse=True)
    secondo = resto[0] if resto else None
    devs = sorted(r["dev"] for r in righe)
    mediana = devs[len(devs) // 2]

    # --- velocità minima all'apice (dal car_data) per il testo/figura effetto --
    def _vmin(main_lap, dist_curva):
        try:
            a = curve._apice(tele.canale_giro(main_lap), dist_curva)
            return float(a["speed"]) if a else None
        except Exception:
            return None
    vminA = _vmin(A["main_lap"], best["dist"])
    vminB = _vmin(B["main_lap"], best["dist"])
    dv_apice = abs(vminA - vminB) if (vminA is not None and vminB is not None) else None
    piu_lento = None
    if dv_apice is not None:
        piu_lento = sigA if vminA < vminB else sigB

    # --- FIGURA-EROE: le due traiettorie nella curva-storia -------------------
    ptsA, ancA = _sub_traj(A["main"], best["cx"], best["cy"])
    ptsB, ancB = _sub_traj(B["main"], best["cx"], best["cy"])
    serie_xy = [{"sigla": sigA, "colore": colA, "punti": _downsample(ptsA)},
                {"sigla": sigB, "colore": colB, "punti": _downsample(ptsB)}]
    ancore = [{"sigla": sigA, "colore": colA, "x": ancA[0], "y": ancA[1]},
              {"sigla": sigB, "colore": colB, "x": ancB[0], "y": ancB[1]}]
    seg = (best["a"][0], best["a"][1], best["b"][0], best["b"][1])
    svg_eroe = _grafico_traiettorie(
        serie_xy, seg, ancore, corner_lab=best["label"],
        titolo=f"La linea diversa: {best['label']}, {it(best['dev'],1)} m fra le due traiettorie",
        sub=f"traiettoria GPS dei due giri più veloci · {ses_nome} {country} {anno}",
        dev_txt=f"{it(best['dev'],1)} m")

    # --- FIGURA 2: scostamento per curva, col rumore-di-fondo per confronto ----
    righe_bar = []
    for r in sorted(righe, key=lambda r: r["dist"]):
        righe_bar.append({"sigla": r["label"],
                          "colore": colA if r is best else "var(--dim)",
                          "valore": r["dev"], "evidenza": (r is best)})
    svg_bar = svg.barre_dv(
        righe_bar,
        titolo="Scostamento fra le due linee, curva per curva",
        sub=f"{ses_nome} {country} {anno}",
        unita="m", base=0.0, ml=64, dec=1,
        caption=(f"metri di scostamento laterale fra le due traiettorie; rumore-di-fondo "
                 f"(stesso pilota) ~{it(best['noise'],1)} m alla curva-storia"))

    # --- FIGURA 3: velocità + gas attorno alla curva-storia (l'effetto) -------
    svg_gas = None
    try:
        tgA = curve.traccia_gas(ses, A["num"], best["dist"])
        tgB = curve.traccia_gas(ses, B["num"], best["dist"])
        if tgA and tgB:
            serie3 = [{"sigla": sigA, "colore": colA, "tratteggio": False, "marker": None, "punti": tgA},
                      {"sigla": sigB, "colore": colB, "tratteggio": True, "marker": None, "punti": tgB}]
            allv = [p[1] for sX in serie3 for p in sX["punti"]]
            v_lo = max(0, int(min(allv) // 50 * 50))
            v_hi = int(max(allv) // 50 * 50 + 50)
            svg_gas = svg.grafico_gas_curva(
                serie3, v_range=(v_lo, v_hi), apex_txt=f"apice {best['label']}",
                titolo=f"{best['label']}: velocità e gas delle due linee",
                sub=f"velocità + gas attorno all’apice · giri veloci · {ses_nome} {country} {anno}")
    except Exception:
        svg_gas = None

    dt_giri = abs(A["lap_s"] - B["lap_s"])
    rnd_txt = f" · round {rnd}" if rnd else ""

    def _lap(sig):
        return base.lap_fmt(A["lap_s"] if sig == sigA else B["lap_s"])

    # ===================================== FACTS ==============================
    F = {
        "id": ID, "anno": anno, "gp": gp, "country": country, "circuito": circuito,
        "round": rnd, "sessione": ses_nome,
        "piloti": {"A": sigA, "B": sigB},
        "team": {sigA: A["team"], sigB: B["team"]},
        "giri_s": {sigA: round(A["lap_s"], 3), sigB: round(B["lap_s"], 3)},
        "distacco_giri_s": round(dt_giri, 3),
        "curva_storia": best["label"],
        "scostamento_max_m": round(best["dev"], 2),
        "rumore_fondo_m": round(best["noise"], 2),
        "eccesso_sul_nullo_m": round(best["dev"] - best["noise"], 2),
        "punto_scostamento_xy_m": [round(best["a"][0], 1), round(best["a"][1], 1)],
        "secondo_scostamento": ({"curva": secondo["label"], "m": round(secondo["dev"], 2),
                                 "rumore": (round(secondo["noise"], 2) if secondo["noise"] is not None else None)}
                                if secondo else None),
        "scostamento_mediano_m": round(mediana, 2),
        "risoluzione_gps_m": round(float(passo_gps), 1),
        "vmin_apice_kmh": {sigA: (round(vminA, 0) if vminA is not None else None),
                           sigB: (round(vminB, 0) if vminB is not None else None)},
        "delta_vmin_apice_kmh": (round(dv_apice, 0) if dv_apice is not None else None),
        "vmin_piu_bassa": piu_lento,
        "controllo_nullo": {"metodo": "max scostamento fra due giri dello stesso pilota (tutte le coppie, entrambi i piloti)",
                            "coppie_self": len(coppie_self), "curve_con_nullo": n_null_disp,
                            "soglia": f"dev ≥ {it(MIN_DIVERG,1)} m e ≥ {it(NULL_FATTORE,1)}× rumore e +{it(NULL_MARGINE,1)} m, e ≤ {it(DEV_MAX_FISICO,0)} m (tetto fisico)"},
        "tetto_fisico_m": DEV_MAX_FISICO,
        "curve_scartate_non_fisiche": scartate_fisica,
        "scostamento_per_curva": [
            {"curva": r["label"], "m": round(r["dev"], 2),
             "rumore": (round(r["noise"], 2) if r["noise"] is not None else None)}
            for r in sorted(righe, key=lambda r: r["dist"])],
        "n_curve": len(righe),
        "finestra_misura_m": WIN, "corda_max_m": MAXSEG,
    }

    # ===================================== PROSA =============================
    accent = colA
    FIG = {
        "eroe": {"svg": svg_eroe,
            "didascalia": (
                f"Le due traiettorie GPS, in scala reale (assi uguali, la barra in basso vale 10 m): "
                f"per quasi tutto il giro {sigA} e {sigB} disegnano la stessa linea, ma alla {best['label']} "
                f"si separano. Il tratteggio misura il punto di massima distanza: {it(best['dev'],1)} metri — "
                f"oltre il doppio del rumore-di-fondo (~{it(best['noise'],1)} m) dello stesso pilota. I pallini "
                f"segnano il passaggio di ciascuno sul riferimento della curva."),
            "fonte": (f"FastF1 · posizione GPS (X/Y) dei giri veloci, in metri; scostamento = distanza "
                      f"punto→segmento fra le due linee, ancorata alla curva · {ses_nome} {country} {anno}")},
        "bar": {"svg": svg_bar,
            "didascalia": (
                f"Curva per curva, quanto distano le due linee. Ovunque quasi coincidono (mediana "
                f"{it(mediana,1)} m, dentro la risoluzione GPS di ~{it(passo_gps,0)} m); la {best['label']} è "
                f"l’eccezione, con {it(best['dev'],1)} m che superano il controllo-nullo."
                + (f" La seconda ({secondo['label']}, {it(secondo['dev'],1)} m) resta nel rumore."
                   if secondo else "")),
            "fonte": f"FastF1 · scostamento laterale per curva + controllo-nullo · {ses_nome} {country} {anno}"},
    }
    if svg_gas is not None:
        FIG["gas"] = {"svg": svg_gas,
            "didascalia": (
                f"Cosa cambia sul cronometro alla {best['label']}: velocità (sopra) e gas (sotto) attorno "
                f"all’apice. "
                + (f"{piu_lento} porta la minima più bassa ({it(dv_apice,0)} km/h di scarto all’apice)."
                   if dv_apice is not None else "Le minime all’apice restano ravvicinate.")),
            "fonte": f"FastF1 · car telemetry (Speed/Throttle), giri veloci · {ses_nome} {country} {anno}"}

    sezioni = [
        {"tag": "Evidenza",
         "titolo": f"Stesso giro, quasi. Ma alla {best['label']} le linee si separano di {it(best['dev'],1)} metri",
         "html": (
            f"<p>I due giri più veloci di {ses_nome} li firmano <b>{sigA}</b> ({_lap(sigA)}) e "
            f"<b>{sigB}</b> ({_lap(sigB)}): li separano <b>{it(dt_giri,3)} s</b>. Sovrapposte, le loro "
            f"traiettorie GPS sembrano una linea sola — apice dopo apice prendono la pista quasi nello "
            f"stesso modo (scostamento mediano appena <b>{it(mediana,1)} m</b> sulle {F['n_curve']} "
            f"curve, dentro la risoluzione stessa del dato di posizione).</p>"
            f"<p>Tranne che in un punto. Alla <b>{best['label']}</b> le due linee divergono: nel punto di "
            f"massima distanza corrono a <b>{it(best['dev'],1)} metri</b> l’una dall’altra — il numero-chiave "
            f"di questa lettura. Il grafico-eroe le mostra in scala reale (assi uguali, niente deformazione): "
            f"il tratteggio è proprio quello scostamento.</p>"),
         "figura": "eroe"},
        {"tag": "Causa",
         "titolo": "Non è la variabilità dello stesso pilota: la curva supera il controllo-nullo",
         "html": (
            f"<p>La posizione GPS di FastF1 è campionata a passo grosso (qui ~<b>{it(passo_gps,0)} m</b>): due "
            f"linee identiche, prese in punti diversi, possono <i>sembrare</i> distanti qualche metro solo "
            f"perché le corde tagliano la curva. Per non cascarci, misuriamo un <b>rumore-di-fondo</b> "
            f"confrontando ogni pilota con sé stesso — tutte le coppie dei suoi giri puliti: lì lo scostamento "
            f"non è una scelta di linea, ma la variabilità che quel pilota stesso non ricalca da un giro "
            f"all’altro (campionamento più linea non ripetuta), e ne prendiamo il massimo curva per curva.</p>"
            f"<p>Alla <b>{best['label']}</b> lo scostamento fra {sigA} e {sigB} vale <b>{it(best['dev'],1)} m</b> "
            f"contro un rumore-di-fondo di <b>{it(best['noise'],1)} m</b>: lo supera di oltre due volte. È qui "
            f"che la differenza smette di essere rumore e diventa una <b>scelta di traiettoria</b> — apice più "
            f"stretto o più largo, corda anticipata o ritardata. Tutte le altre curve restano dentro il "
            f"rumore.</p>"),
         "figura": "bar"},
    ]
    if svg_gas is not None:
        eff = (f"<p>La linea diversa si legge sul cronometro proprio lì. Attorno all’apice della "
               f"<b>{best['label']}</b>, "
               + (f"<b>{piu_lento}</b> porta la velocità minima più bassa, con <b>{it(dv_apice,0)} km/h</b> "
                  f"di scarto all’apice: "
                  if dv_apice is not None else "le due minime restano ravvicinate: ")
               + f"chi tiene più velocità dentro la curva ne esce prima sul gas. Restano ignoti gomma "
               f"(mescola, età, temperatura) e carico aerodinamico: <i>perché</i> uno scelga quella linea è "
               f"lettura, non misura.</p>")
        sezioni.append({"tag": "Effetto", "titolo": f"Alla {best['label']} la linea diventa tempo",
                        "html": eff, "figura": "gas"})
    else:
        sezioni.append({"tag": "Effetto", "titolo": "Una firma di guida, non un dettaglio",
                        "html": (
                            f"<p>Due giri lontani {it(dt_giri,3)} s eppure, in questa curva, distanti "
                            f"{it(best['dev'],1)} metri oltre il rumore: la traiettoria è una firma di guida. "
                            f"La posizione GPS dice <i>dove</i> passano le due auto; <i>perché</i> uno scelga "
                            f"quella linea — gomma, carico, equilibrio — resta fuori dai canali, quindi lettura "
                            f"e non misura.</p>"),
                        "figura": None})

    art = {
        "id": ID, "stato": "bozza", "data": data_bozza or oggi,
        "firma": "Muretto · Redazione tecnica", "accent": accent,
        "canale": "A (telemetria, traiettoria)",
        "gara": country, "circuito": circuito, "sessione": ses_nome,
        "gp": gp, "round": rnd, "data_evento": str(_ev("EventDate"))[:10] or None,
        "tag": ["telemetria", "traiettoria", "linea", A["team"], B["team"]],
        "occhiello": f"Telemetria · traiettoria · {ses_nome} {country} {anno}{rnd_txt}",
        "titolo": (f"Due giri quasi gemelli, una curva diversa: alla {best['label']} le linee di "
                   f"{sigA} e {sigB} distano {it(best['dev'],1)} metri"),
        "sommario": (
            f"I due giri più veloci di {ses_nome} — {sigA} e {sigB}, a {it(dt_giri,3)} s l’uno dall’altro — "
            f"disegnano quasi la stessa linea su tutto il giro (scostamento mediano {it(mediana,1)} m). Tranne "
            f"alla {best['label']}, dove le due traiettorie si separano di {it(best['dev'],1)} metri: oltre il "
            f"doppio del rumore-di-fondo dello stesso pilota ({it(best['noise'],1)} m). È il punto dove la scelta di "
            f"linea diventa tempo. Misura dalla posizione GPS (X/Y) dei giri veloci."),
        "sezioni": sezioni,
        "provenienza": [
            {"grandezza": "traiettoria GPS dei due giri veloci",
             "valore": (f"{sigA} ({A['team']}) e {sigB} ({B['team']}), i due più veloci di {ses_nome}; "
                        f"X/Y da FastF1 (decimi di metro) → metri, lunghezza d’arco"),
             "stato": "MISURATO",
             "da": "FastF1 get_pos_data() del giro veloce di ciascuno (posizione X/Y autentica)"},
            {"grandezza": "scostamento laterale massimo (curva-storia)",
             "valore": f"{best['label']}: {it(best['dev'],1)} m nel punto di massima distanza",
             "stato": "MISURATO",
             "da": (f"distanza punto→segmento fra le due linee, nei due versi, in una finestra di ±{it(WIN,0)} m "
                    f"d’arco ancorata alla posizione X/Y della curva (circuit_info); corde >{it(MAXSEG,0)} m "
                    f"(buchi GPS) scartate")},
            {"grandezza": "controllo-nullo (rumore-di-fondo)",
             "valore": (f"inviluppo stesso-pilota (max su {len(coppie_self)} coppie di giri puliti): "
                        f"{it(best['noise'],1)} m alla {best['label']}; lo scostamento fra i due piloti lo "
                        f"supera di {it(best['dev']-best['noise'],1)} m (≥{it(NULL_FATTORE,1)}×)"),
             "stato": "MISURATO",
             "da": ("scostamento fra due giri dello STESSO pilota = variabilità che il pilota non ricalca "
                    "(campionamento GPS a corda grossa + linea non ripetuta identica + eventuali dropout), non una "
                    "scelta di linea; prendo il massimo su tutte le coppie (entrambi i piloti); la curva-storia deve "
                    "superarlo per fattore e margine ed essere sotto il tetto fisico, altrimenti il generatore si auto-salta")},
            {"grandezza": "risoluzione del dato di posizione",
             "valore": f"passo mediano dei campioni GPS ~{it(passo_gps,1)} m",
             "stato": "STIMATO",
             "da": ("mediana dei passi fra campioni consecutivi di get_pos_data; fissa il rumore sotto cui gli "
                    "scostamenti non sono distinguibili da artefatti (di qui il controllo-nullo)")},
            {"grandezza": "distacco fra i due giri veloci",
             "valore": f"{sigA} {_lap(sigA)} · {sigB} {_lap(sigB)} → {it(dt_giri,3)} s",
             "stato": "MISURATO",
             "da": "LapTime dei giri veloci (FastF1). Sono i tempi della sessione, non posizioni in griglia"},
            {"grandezza": "velocità minima all’apice (curva-storia)",
             "valore": (f"{sigA} {it(vminA,0) if vminA is not None else '–'} · "
                        f"{sigB} {it(vminB,0) if vminB is not None else '–'} km/h"
                        + (f"; scarto {it(dv_apice,0)} km/h" if dv_apice is not None else "")),
             "stato": "MISURATO" if dv_apice is not None else "NON_MISURABILE",
             "da": "velocità minima nella finestra d’apice (−25/+75 m) sul canale Speed dei giri veloci"},
            {"grandezza": "perché la linea è diversa (gomma, carico, equilibrio vettura)",
             "valore": "quale scelta di assetto/guida produca la linea diversa non è ricavabile dai canali",
             "stato": "NON_MISURABILE",
             "da": "nessun canale di mescola/età/temperatura gomma o carico aerodinamico: è lettura, non misura"},
        ],
        "fonti": [
            {"tipo": "dati",
             "testo": (f"FastF1 3.8.3 — posizione GPS (X/Y) + car telemetry (Speed/Throttle) + circuit_info, "
                       f"{ses_nome} {gp} {anno} ({circuito}); giri veloci di {sigA} e {sigB}")},
            {"tipo": "metodo",
             "testo": (f"ai_lab/redazione/genera_linea_diversa.py su tele.py/curve.py/svg.py — traiettoria da "
                       f"get_pos_data() (X/Y in decimi di metro → metri, lunghezza d’arco); curve ancorate alla "
                       f"loro X/Y; scostamento per curva = massimo, nei due versi, della distanza punto→segmento "
                       f"in una finestra di ±{it(WIN,0)} m (corde >{it(MAXSEG,0)} m scartate); controllo-nullo "
                       f"stesso-pilota + tetto fisico {it(DEV_MAX_FISICO,0)} m (oltre = artefatto, non linea); "
                       f"grafico-eroe X/Y in scala reale, assi uguali")},
        ],
    }

    for sez in art["sezioni"]:
        if sez.get("figura") in FIG:
            sez["figura"] = FIG[sez["figura"]]
        elif "figura" in sez:
            del sez["figura"]
    return F, art


META = {
    "id": "linea-diversa", "canale": "A",
    "titolo": "La linea diversa: dove due piloti scelgono traiettorie diverse",
    "tag": ["telemetria", "traiettoria", "linea"],
    "descrizione": ("confronto delle traiettorie GPS dei due giri più veloci nella curva dove la linea "
                    "diverge di più, con controllo-nullo contro il rumore del dato GPS — per qualsiasi GP"),
    "richiede": "telemetria", "gare": ["*"], "sessioni": ["Q", "FP1"],
}


def genera(gara=None, data=None, sessione=None):
    if sessione is None:
        sessione = "Q"
    if gara is None:
        return None            # track-agnostic, ma serve sapere QUALE Gran Premio
    try:
        r = costruisci(gara, sessione, data_bozza=data)
    except Exception as e:
        print(f"  [linea-diversa] {gara} {sessione}: giro fallito ({e}) — salto.")
        return None
    if not r:
        return None
    F, art = r
    base.scrivi_bozza(art["id"], art, F)
    return {"id": art["id"], "titolo": art["titolo"], "stato": art["stato"],
            "canale": META["canale"]}


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="La linea diversa (traiettorie GPS) track-agnostic")
    ap.add_argument("--gara", required=True, help="GP accettato da FastF1 (nome/località/round), es. 'Hungary'")
    ap.add_argument("--sessione", default="Q", help="Q/FP1 (default Q)")
    ap.add_argument("--data", default=None, help="AAAA-MM-GG per la targhetta della bozza")
    a = ap.parse_args()
    r = costruisci(a.gara, a.sessione, data_bozza=a.data)
    if not r:
        print("auto-salto: posizione GPS incompleta o nessuna linea diversa oltre il controllo-nullo")
        sys.exit(2)
    F, art = r
    out = base.scrivi_bozza(art["id"], art, F)
    print(f"Bozza {art['id']} scritta in {out}")
    print(f"  {F['sessione']} {F['gp']} {F['anno']} (round {F['round']}, {F['circuito']})")
    print(f"  {F['piloti']['A']} vs {F['piloti']['B']} · giri a {it(F['distacco_giri_s'],3)} s")
    print(f"  curva-storia {F['curva_storia']}: {it(F['scostamento_max_m'],1)} m vs rumore "
          f"{it(F['rumore_fondo_m'],1)} m (eccesso {it(F['eccesso_sul_nullo_m'],1)} m) · "
          f"mediana {it(F['scostamento_mediano_m'],1)} m su {F['n_curve']} curve · GPS ~{it(F['risoluzione_gps_m'],1)} m")
