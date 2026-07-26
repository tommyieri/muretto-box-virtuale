"""
Generatore track-agnostic: "LA CURVA-SIMBOLO" — il ritratto della curva-icona del
circuito, per QUALSIASI Gran Premio, da una sessione con telemetria (Q/FP2/FP3).

Angolo (Canale B, telemetria FastF1). Due gesti:
  1) AUTO-SELEZIONE della curva-simbolo, con un criterio robusto e DICHIARATO: la
     staccata piu' dura del giro = massimo CALO DI VELOCITA' ingresso->apice, preso
     come MEDIANA DI SCHIERAMENTO sui giri veloci (non da un singolo giro di un
     singolo pilota: la scelta della curva non deve dipendere da chi guardi). E' il
     punto che disegna il carattere del tracciato.
  2) RITRATTO in quella curva, confrontando i piloti sulle tre fasi: punto di
     frenata (m prima dell'apice), velocita' minima all'apice, ritorno al gas
     pieno (m dopo l'apice). Ribaltamento tipico: all'apice il campo si RICOMPATTA
     (spread di pochi km/h) — la curva-simbolo non si vince li', si vince ai bordi.

Nessun literal di Gran Premio/circuito/round/pilota nella LOGICA: anno, GP,
circuito, round e sessione sono derivati dai parametri e da ses.event; la
curva-simbolo, il protagonista, il compagno e gli estremi di fase sono SCELTI dai
dati. La mappa-pista del grafico e' costruita dalla traccia GPS della sessione, non
da un file per-circuito.

Regole dure (dichiarate, non ricopiate da fuori):
 - giri veloci veri = tele.giri_validi (LapTime valido, IsAccurate, entro 1,07x il
   best del pilota): niente in/out mal-etichettati;
 - apice = vero minimo di velocita' nella finestra asimmetrica -25/+75 m attorno al
   riferimento circuit_info (curve.py);
 - misure per-pilota = MEDIANA sui giri lanciati (curve.aggrega), robusta al traffico;
 - selezione curva = mediana di schieramento del calo di velocita' (>=8 piloti);
 - contesto di campo = piloti con >=4 giri validi; PROTAGONISTA = >=5 giri (campione
   solido per la firma); chi e' piu' avanti su meno giri viene DETTO, non nascosto;
 - carico/temperatura di freni e gomma NON sono canali del feed: NON_MISURABILE.

python3 UTENTE (fastf1 3.8.3), NON la .venv. Solo lettura; bozza nell'area Lab.
Non tocca demo/ ne' engine/.
"""
from __future__ import annotations
import os
import re
import sys
import json
import argparse
import datetime
import statistics as st

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele   # noqa: E402
import curve  # noqa: E402
import svg    # noqa: E402
import base   # noqa: E402

SES_DEF = "Q"
MIN_PILOTI_CURVA = 8   # piloti minimi su una curva perche' la mediana-drop sia solida
MIN_CAMPO = 4          # giri validi minimi per entrare nel contesto di campo
MIN_FEAT = 5           # giri validi minimi per essere PROTAGONISTA (firma solida)
NOISE_M = 3.0          # margine (m) sotto cui due punti di frenata sono indistinti


def it(x, dec=1):
    return base.it(x, dec)


# ------------------------------------------------------------- risoluzione -----
def _slug(s):
    out = []
    for ch in str(s).lower().strip():
        if ch.isalnum():
            out.append(ch)
        elif out and out[-1] != "-":
            out.append("-")
    return "".join(out).strip("-") or "gp"


def _registro():
    """Mappa nome-italiano -> record ({'ti': nome FastF1, ...}), se presente."""
    try:
        return json.load(open(os.path.join(base.REPO, "data", "gare_registro.json")))
    except Exception:
        return {}


def _risolvi_gara(gara):
    """(nome per FastF1, nome-italiano|None) dal parametro `gara`."""
    reg = _registro()
    if gara in reg:
        return reg[gara].get("ti", gara), gara
    for k, v in reg.items():
        if k.lower() == str(gara).lower():
            return v.get("ti", gara), k
    return gara, None


def _anno_da(data):
    m = re.match(r"\s*(\d{4})", str(data or ""))
    return int(m.group(1)) if m else datetime.date.today().year


def _ses_label(sessione):
    m = re.fullmatch(r"[Ff][Pp]\s*([123])", str(sessione or "").strip())
    if m:
        return f"Prove libere {m.group(1)}"
    s = str(sessione or "").strip().upper()
    return {"Q": "Qualifiche", "S": "Sprint", "SQ": "Sprint Qualifica",
            "SS": "Sprint Shootout", "R": "Gara"}.get(s, sessione or "sessione")


def _ses_breve(sessione):
    s = str(sessione or "").strip().upper()
    return {"Q": "Qualifiche"}.get(s, str(sessione or "").strip().upper() or "sessione")


def _compagno(piloti, sig):
    team = piloti[sig]["team"]
    for s, info in piloti.items():
        if s != sig and info["team"] == team:
            return s
    return None


# --------------------------------------------------------------- selezione -----
def _seleziona_curva(ses, piloti, cs):
    """La curva-simbolo = massimo calo di velocita' ingresso->apice, come MEDIANA
    di schieramento sui giri veloci. Ritorna (indice, corner, med_drop, med_ving,
    med_apex, n_piloti) oppure None. La scelta non dipende da un singolo pilota:
    ogni curva e' valutata sul giro veloce di ogni pilota e mediata."""
    drop = [[] for _ in cs]
    ving = [[] for _ in cs]
    apex = [[] for _ in cs]
    for info in piloti.values():
        try:
            lap = ses.laps.pick_drivers(info["num"]).pick_fastest()
            tel = tele.canale_giro(lap)
        except Exception:
            continue
        for i, c in enumerate(cs):
            p = curve.profilo_curva(tel, c["dist"])
            if p and p["v_ing"] and p["apex_v"]:
                drop[i].append(p["v_ing"] - p["apex_v"])
                ving[i].append(p["v_ing"])
                apex[i].append(p["apex_v"])
    best = None
    for i, c in enumerate(cs):
        if len(drop[i]) < MIN_PILOTI_CURVA:
            continue
        md = st.median(drop[i])
        rec = (i, c, md, st.median(ving[i]), st.median(apex[i]), len(drop[i]))
        if best is None or md > best[2]:
            best = rec
    return best


# ------------------------------------------------------------ mappa-pista -------
def _svg_pista(ses, corner, etichetta):
    """Traccia GPS della sessione (giro veloce) con la curva-simbolo marcata.
    Costruita dai dati, senza file per-circuito. Aspetto preservato."""
    try:
        pos = ses.laps.pick_fastest().get_pos_data()
        xs = [float(x) for x in pos["X"].values]
        ys = [float(y) for y in pos["Y"].values]
        pts = [(x, y) for x, y in zip(xs, ys) if x == x and y == y]
    except Exception:
        pts = []
    if len(pts) < 20:
        return None
    minx = min(p[0] for p in pts); maxx = max(p[0] for p in pts)
    miny = min(p[1] for p in pts); maxy = max(p[1] for p in pts)
    span = max(maxx - minx, maxy - miny) or 1.0
    pad = span * 0.06
    W = (maxx - minx) + 2 * pad
    H = (maxy - miny) + 2 * pad

    def X(x): return (x - minx) + pad
    def Y(y): return (maxy - y) + pad          # flip: GPS Y su, SVG Y giu'

    sw = span / 190.0
    d = "M" + " L".join(f"{X(x):.1f} {Y(y):.1f}" for x, y in pts) + " Z"
    lx, ly = X(corner["x"]), Y(corner["y"])
    r = span / 55.0
    fs = span / 26.0
    anc = "end" if lx > minx + (maxx - minx) * 0.7 else "start"
    dx = -(r + sw * 2) if anc == "end" else (r + sw * 2)
    return (f'<svg viewBox="0 0 {W:.0f} {H:.0f}" xmlns="http://www.w3.org/2000/svg" '
            f'class="art-svg art-pista" font-family="{svg.DISP}">'
            f'<path d="{d}" fill="none" stroke="var(--line2)" stroke-width="{sw:.1f}" '
            f'stroke-linejoin="round" stroke-linecap="round"/>'
            f'<circle cx="{lx:.1f}" cy="{ly:.1f}" r="{r:.1f}" fill="var(--accent)"/>'
            f'<text x="{lx+dx:.1f}" y="{ly+fs*0.35:.1f}" font-size="{fs:.0f}" '
            f'fill="var(--txt)" text-anchor="{anc}" letter-spacing="0.3">'
            f'{svg.esc(etichetta)}</text></svg>')


# --------------------------------------------------------------- costruzione ---
def costruisci(gara, sessione=None, data_bozza=None):
    if gara is None:
        raise ValueError("serve il Gran Premio (gara) da caricare")
    sessione = sessione or SES_DEF
    anno = _anno_da(data_bozza)
    ff1_name, gp_it = _risolvi_gara(gara)

    ses = tele.carica_sessione(anno, ff1_name, sessione)
    piloti = tele.piloti_sessione(ses)
    colori = base.carica_colori()
    cs = curve.curve(ses)

    # identita' della sessione, derivata da ses.event
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
        pass
    ev_name = str(_ev("EventName") or gara)
    country = str(_ev("Country") or ev_name)
    location = str(_ev("Location") or country)
    try:
        rnd = int(ev["RoundNumber"])
    except Exception:
        rnd = None
    reg = _registro()
    gp_disp = gp_it or next((k for k, v in reg.items() if v.get("ti") == ev_name), None) or ev_name
    circuito = location
    slug = _slug(location or gp_disp)
    ses_lab = _ses_label(sessione)
    ID = f"curva-simbolo-{slug}-{anno}"

    # 1) curva-simbolo
    sel = _seleziona_curva(ses, piloti, cs)
    if not sel:
        return None
    _, cv, med_drop, med_ving, med_apex, n_sel = sel
    nc = f"curva {cv['numero']}{cv['lettera']}".strip()

    # 2) ritratto di campo alla curva-simbolo (mediana per pilota)
    campo = []
    for s, info in piloti.items():
        a = curve.aggrega(ses, info["num"], cv["dist"])
        if not a or a["apex_v"] is None:
            continue
        campo.append({"sig": s, "team": info["team"],
                      "brake_on": a["brake_on"], "apex_v": a["apex_v"],
                      "full_after": a["full_after"], "n": a["n"]})
    robusti = [r for r in campo if r["n"] >= MIN_CAMPO]
    con_frenata = [r for r in robusti if r["brake_on"] is not None]
    if len(con_frenata) < 4:
        return None

    # spread all'apice (il "livellatore"): sul campo robusto
    apex_vals = [r["apex_v"] for r in robusti]
    apex_lo, apex_hi = min(apex_vals), max(apex_vals)
    spread_apex = apex_hi - apex_lo

    # PROTAGONISTA = il piu' tardivo sui freni con campione solido (>=MIN_FEAT)
    solidi = sorted([r for r in con_frenata if r["n"] >= MIN_FEAT],
                    key=lambda r: r["brake_on"])
    if not solidi:
        return None
    proto = solidi[0]
    sF = proto["sig"]; teamF = proto["team"]
    colF = colori.get(teamF) or "var(--dim)"
    margine2 = (solidi[1]["brake_on"] - proto["brake_on"]) if len(solidi) > 1 else None
    piu_tardivo = margine2 is None or margine2 >= NOISE_M

    # chi figura piu' avanti ma su meno giri (onesta', non lo nascondo)
    thin = sorted([r for r in con_frenata if r["brake_on"] < proto["brake_on"]
                   and r["n"] < MIN_FEAT], key=lambda r: r["brake_on"])
    thin_txt = ""
    if thin:
        sg = " e ".join(r["sig"] for r in thin)
        ng = "–".join(str(x) for x in sorted({r["n"] for r in thin}))
        thin_txt = (f"{sg} {'staccano' if len(thin) > 1 else 'stacca'} ancora un filo "
                    f"più tardi, ma su appena {ng} giri, fuori dal campione solido")

    # compagno (stessa vettura) per il contrasto dell'eroe
    comp = _compagno(piloti, sF)
    rc = next((r for r in con_frenata if r["sig"] == comp), None)
    dv_comp = (rc["brake_on"] - proto["brake_on"]) if rc else None

    # gli estremi delle altre due fasi (ritratto a tre fasi)
    apex_best = max(robusti, key=lambda r: r["apex_v"])          # piu' veloce all'apice
    con_gas = [r for r in robusti if r["full_after"] is not None]
    gas_first = min(con_gas, key=lambda r: r["full_after"]) if con_gas else None
    med_brake = st.median(r["brake_on"] for r in con_frenata)
    med_gas = st.median(r["full_after"] for r in con_gas) if con_gas else None
    proto_apex_rank = 1 + sum(1 for r in robusti if r["apex_v"] > proto["apex_v"])

    F = {
        "id": ID, "anno": anno, "gp": gp_disp, "circuito": circuito, "round": rnd,
        "sessione": ses_lab, "ff1": ff1_name,
        "curva": {"numero": cv["numero"], "lettera": cv["lettera"], "nome": nc,
                  "dist": cv["dist"], "n_piloti_sel": n_sel},
        "calo": {"v_ing": med_ving, "apex": med_apex, "drop": med_drop},
        "apex_spread": {"lo": apex_lo, "hi": apex_hi, "spread": spread_apex},
        "proto": proto, "piu_tardivo": piu_tardivo, "margine2": margine2,
        "compagno": rc, "dv_compagno": dv_comp, "thin": thin_txt,
        "apex_best": apex_best, "gas_first": gas_first,
        "med_brake": med_brake, "med_gas": med_gas,
        "proto_apex_rank": proto_apex_rank, "n_campo": len(robusti),
    }

    # ------------------------------------------------------------------ FIGURE
    sub_ctx = f"{_ses_breve(sessione)} {gp_disp} {anno}"

    # HERO: la singola curva — protagonista vs compagno (velocita' + gas, marker frenata)
    serie = [{"sigla": sF, "colore": colF, "tratteggio": False,
              "marker": -proto["brake_on"],
              "punti": curve.traccia_gas(ses, piloti[sF]["num"], cv["dist"])}]
    if rc and comp:
        serie.append({"sigla": comp, "colore": colF, "tratteggio": True,
                      "marker": -rc["brake_on"],
                      "punti": curve.traccia_gas(ses, piloti[comp]["num"], cv["dist"])})
    serie = [s for s in serie if s["punti"]]
    if not serie:
        return None                    # niente traccia per l'eroe: si salta, non si stampa un grafico vuoto
    allv = [p[1] for s in serie for p in s["punti"]]
    v_range = (int(min(allv) // 25 * 25), int(max(allv) // 25 * 25 + 25))
    svg_hero = svg.grafico_gas_curva(
        serie, v_range=v_range, marker_label="● inizio frenata",
        titolo=f"{nc}: la staccata-simbolo — {sF}" + (f" vs {comp}" if rc and comp else ""),
        sub=f"velocità + gas attorno all’apice · {sub_ctx}")

    # SCATTER: il ritratto di campo su due fasi (frenata vs trazione), rispetto alla mediana
    pts = []
    for r in con_gas:
        if r["brake_on"] is None:
            continue
        pts.append({"label": r["sig"], "colore": colori.get(r["team"]) or "var(--dim)",
                    "x": med_brake - r["brake_on"],       # destra = frena piu' tardi
                    "y": med_gas - r["full_after"],        # alto  = gas prima
                    "evidenza": r["sig"] == sF})
    mx = max((abs(p["x"]) for p in pts), default=10.0)
    my = max((abs(p["y"]) for p in pts), default=10.0)
    mx = (int(mx // 5) + 1) * 5
    my = (int(my // 5) + 1) * 5
    svg_scatter = svg.grafico_scatter(
        pts, x_range=(-mx, mx), y_range=(-my, my),
        x_ticks=(-mx, -mx // 2, 0, mx // 2, mx),
        y_ticks=(-my, -my // 2, 0, my // 2, my),
        x_label="frenata rispetto alla mediana (m) — a destra = frena più tardi",
        y_label="ritorno al gas vs mediana (m) — in alto = gas prima",
        cx=0, cy=0,
        ang=("tardi sui freni · cauto in uscita", "attacca: tardi sui freni · gas prima",
             "gas prima · frenata prudente", "prudenti su entrambi"),
        titolo=f"{nc}: chi attacca la curva-simbolo",
        sub=f"punto di frenata e ritorno al gas, scarto dalla mediana · {sub_ctx}")

    svg_pista = _svg_pista(ses, cv, nc)

    # ------------------------------------------------------------------ PROSA
    rnd_txt = f" · round {rnd}" if rnd else ""
    prima_txt = ("il più tardivo dello schieramento" if piu_tardivo
                 else "tra i più tardivi dello schieramento")
    apex_pos_txt = ("la più alta del campo" if proto_apex_rank == 1
                    else f"{proto_apex_rank}ª più alta del campo")

    som = (f"È la staccata più dura del giro: si arriva a {it(med_ving,0)} km/h e "
           f"si scende a {it(med_apex,0)} all’apice — {it(med_drop,0)} km/h "
           f"buttati via in poche decine di metri. All’apice, però, il campo si "
           f"ricompatta in {it(spread_apex,0)} km/h: la curva-simbolo non si vince "
           f"lì, si vince ai bordi. E in ingresso {sF} è {prima_txt}"
           + (f", {it(dv_comp,0)} metri più tardi del compagno {comp} con la stessa "
              f"vettura." if rc and comp and dv_comp is not None else "."))

    ev_html = (
        f"<p>Ogni circuito ha la sua curva-firma. Qui la scegliamo dai dati, con un "
        f"criterio solo: la staccata più dura, quella con il massimo <b>calo di "
        f"velocità</b> dall’ingresso all’apice, presa come mediana di schieramento sui "
        f"giri veloci. È <b>{nc}</b>: si entra a circa <b>{it(med_ving,0)} km/h</b> e si "
        f"passa l’apice a <b>{it(med_apex,0)}</b>, un tuffo di <b>{it(med_drop,0)} km/h</b>.</p>"
        f"<p>Il ribaltamento è proprio all’apice: tra i {F['n_campo']} piloti col campione "
        f"più solido, la velocità minima sta in appena <b>{it(spread_apex,0)} km/h</b> "
        f"({apex_lo:.0f}–{apex_hi:.0f}). In mezzo alla curva sono quasi tutti insieme. "
        f"Le differenze vivono ai bordi — nel punto di frenata e nel ritorno al gas. In "
        f"frenata <b>{sF}</b> è {prima_txt}: attacca i freni a <b>{it(proto['brake_on'],0)} "
        f"metri</b> dall’apice, contro una mediana di {it(med_brake,0)}"
        + (f", ed è {apex_pos_txt} pure all’apice: entra tardi e non regala velocità"
           if proto_apex_rank <= 3 else "") + "."
        + (f" Il compagno {comp}, stessa macchina, stacca a "
           f"<b>{it(rc['brake_on'],0)}</b> — <b>{it(dv_comp,0)} metri</b> prima."
           if rc and comp and dv_comp is not None else "")
        + (f" ({thin_txt}.)" if thin_txt else ""))

    gas_txt = ""
    if gas_first and med_gas is not None:
        gas_txt = (f"All’uscita comanda un altro: <b>{gas_first['sig']}</b> torna a gas "
                   f"pieno per primo, a <b>{it(gas_first['full_after'],0)} metri</b> "
                   f"dall’apice (mediana {it(med_gas,0)}). ")

    causa_html = (
        f"<p>Una staccata così è fatta di tre gesti distinti, e quasi nessuno li vince "
        f"tutti. In <b>ingresso</b> ritardare la frenata vuol dire portare velocità più a "
        f"fondo — spazio di frenata che cresce col quadrato della velocità, meno margine "
        f"all’errore: è la fase dei più coraggiosi. All’<b>apice</b>, invece, comandano "
        f"aerodinamica e aderenza, uguali per tutti a parità di vettura: ecco perché il "
        f"campo si ricompatta in pochi km/h. In <b>uscita</b> torna a decidere il piede — "
        f"chi rimette il gas prima senza pattinare guadagna sull’allungo successivo.</p>"
        f"<p>{gas_txt}È la firma della curva-simbolo: {sF} la prende d’ingresso, "
        f"{gas_first['sig'] if gas_first else 'altri'} in uscita, e in mezzo sono tutti "
        f"vicini. Quel che <i>non</i> vediamo lo diciamo: temperatura e carico di freni e "
        f"gomma non sono canali del feed, quindi il costo di frenare così tardi lo "
        f"leggiamo dalla fisica, non lo misuriamo.</p>")

    eff_html = (
        f"<p>Il conto è tutto ai bordi. All’apice separano appena <b>{it(spread_apex,0)} "
        f"km/h</b> il più veloce dal più lento del campo solido: in mezzo alla "
        f"curva-simbolo non si fa la differenza. La si fa nei metri — {sF} che stacca "
        + (f"<b>{it(dv_comp,0)} metri</b> più tardi del proprio compagno, stessa macchina"
           if rc and comp and dv_comp is not None
           else f"tra i più tardivi dello schieramento")
        + f", o chi rimette il gas prima all’uscita. Pochi metri per giro, ripetuti ogni "
        f"giro: è lì, non all’apice, che la curva-icona del circuito assegna il tempo.</p>")

    figure = {
        "hero": {"svg": svg_hero,
                 "didascalia": (f"Attorno all’apice di {nc}: la velocità crolla di "
                                f"{it(med_drop,0)} km/h e {sF} (pieno) attacca i freni più "
                                f"tardi" + (f" del compagno {comp} (tratteggio)" if rc and comp else "")
                                + " — marcatore più vicino all’apice."),
                 "fonte": f"FastF1 · car telemetry (Speed/Throttle/Brake), {sub_ctx}"},
        "scatter": {"svg": svg_scatter,
                    "didascalia": (f"Ogni pilota nella curva-simbolo, rispetto alla mediana: "
                                   f"a destra chi frena più tardi, in alto chi rimette il gas "
                                   f"prima. In alto a destra chi attacca la curva su entrambe le "
                                   f"fasi; {sF} evidenziato."),
                    "fonte": f"FastF1 · car telemetry + circuit_info, {sub_ctx}"},
    }
    if svg_pista:
        figure["pista"] = {"svg": svg_pista,
                           "didascalia": (f"{nc} sul tracciato di {circuito}, dalla traccia GPS "
                                          f"della sessione: la staccata più dura del giro."),
                           "fonte": f"FastF1 · GPS position + circuit_info, {sub_ctx}"}

    art = {
        "id": ID, "stato": "bozza", "data": data_bozza or datetime.date.today().isoformat(),
        "firma": "Muretto · Redazione tecnica", "accent": colF,
        "canale": "B (anomalia nei nostri dati)",
        "gara": gp_disp, "circuito": circuito, "sessione": ses_lab,
        "tag": ["telemetria", teamF, "curva-simbolo", "guida"],
        "occhiello": f"Telemetria · {ses_lab} {gp_disp} {anno}{rnd_txt}",
        "titolo": f"La staccata-simbolo di {circuito}: chi osa di più a {nc}?",
        "sommario": som,
        "sezioni": [
            {"tag": "Evidenza", "titolo": "L’apice livella, i bordi separano",
             "html": ev_html, "figura": "hero"},
            {"tag": "Causa", "titolo": "Tre gesti, e quasi nessuno li vince tutti",
             "html": causa_html, "figura": "scatter"},
            {"tag": "Effetto", "titolo": "Metri, non km/h",
             "html": eff_html, "figura": "pista" if svg_pista else None},
        ],
        "provenienza": [
            {"grandezza": "calo di velocità della staccata (ingresso→apice)",
             "valore": f"{it(med_ving,0)} → {it(med_apex,0)} km/h (Δ {it(med_drop,0)})",
             "stato": "MISURATO",
             "da": "mediana di schieramento sui giri veloci, finestra apice −25/+75 m (FastF1 + circuit_info)"},
            {"grandezza": "velocità minima all’apice (spread di campo)",
             "valore": f"{apex_lo:.0f}–{apex_hi:.0f} km/h (Δ {it(spread_apex,0)}) su {F['n_campo']} piloti",
             "stato": "MISURATO", "da": "mediana della minima all’apice sui giri lanciati, campo ≥4 giri"},
            {"grandezza": "punto di frenata (m prima dell’apice)",
             "valore": f"{sF} {it(proto['brake_on'],0)} m · "
                       + (f"{comp} {it(rc['brake_on'],0)} m · " if rc and comp else "")
                       + f"mediana {it(med_brake,0)} m",
             "stato": "MISURATO", "da": "prima attivazione Brake in avvicinamento all’apice, mediana sui giri lanciati"},
            {"grandezza": "ritorno al gas pieno (m dopo l’apice)",
             "valore": (f"{gas_first['sig']} {it(gas_first['full_after'],0)} m (primo) · mediana {it(med_gas,0)} m"
                        if gas_first and med_gas is not None else "non disponibile"),
             "stato": "MISURATO" if gas_first else "NON_MISURABILE",
             "da": "prima distanza dall’apice con throttle ≥95%, mediana sui giri lanciati"},
            {"grandezza": "carico/temperatura di freni e gomma", "valore": "non quantificabile",
             "stato": "NON_MISURABILE", "da": "nessun canale di temperatura o carico freni nel feed"},
        ],
        "fonti": [
            {"tipo": "dati", "testo": f"FastF1 3.8.3 — telemetria vettura (Speed/Throttle/Brake) + "
             f"GPS position + mappa curve (circuit_info), {ses_lab} {ev_name} {anno}"},
            {"tipo": "metodo", "testo": "ai_lab/redazione/genera_curva_simbolo.py su curve.py — "
             "curva-simbolo = massimo calo di velocità ingresso→apice, MEDIANA di schieramento sui "
             "giri veloci (≥8 piloti): la scelta non dipende da un singolo giro. Misure per-pilota = "
             "mediana sui giri lanciati (finestra apice −25/+75 m); contesto di campo ai piloti con "
             "≥4 giri validi, protagonista con ≥5. Chi stacca più tardi su meno giri viene dichiarato, "
             "non nascosto"},
        ],
    }
    # sostituisci i riferimenti-figura coi blocchi (o rimuovi se assenti)
    for sez in art["sezioni"]:
        f = sez.get("figura")
        if f in figure:
            sez["figura"] = figure[f]
        elif "figura" in sez:
            del sez["figura"]
    return F, art


META = {
    "id": "curva-simbolo", "canale": "B",
    "titolo": "La curva-simbolo del circuito (ritratto a tre fasi)",
    "tag": ["telemetria", "curva-simbolo", "guida"],
    "descrizione": "la staccata-icona del circuito e come i piloti la attaccano — per qualsiasi GP",
    "richiede": "telemetria", "gare": ["*"], "sessioni": ["Q"],  # affiancata alla quali (evita sovraccarico FP)
}


def genera(gara=None, data=None, sessione=None):
    if sessione is None:
        sessione = SES_DEF
    if gara is None:
        return None            # track-agnostic, ma serve sapere QUALE Gran Premio
    try:
        r = costruisci(gara, sessione, data_bozza=data)
    except Exception as e:
        print(f"  [curva-simbolo] {gara} {sessione}: giro fallito ({e}) — salto.")
        return None
    if not r:
        return None
    F, art = r
    base.scrivi_bozza(art["id"], art, F)
    return {"id": art["id"], "titolo": art["titolo"], "stato": art["stato"],
            "canale": META["canale"]}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="La curva-simbolo, track-agnostic, da una sessione con telemetria")
    ap.add_argument("--gara", required=True,
                    help="GP accettato da FastF1 (nome inglese/località/round), es. 'Hungary'")
    ap.add_argument("--sessione", default=SES_DEF, help="Q/FP2/FP3 (default Q)")
    ap.add_argument("--data", default=None, help="AAAA-MM-GG per la targhetta della bozza")
    a = ap.parse_args()
    r = costruisci(a.gara, a.sessione, data_bozza=a.data)
    if not r:
        print("curva-simbolo non determinabile / campione insufficiente"); sys.exit(1)
    F, art = r
    out = base.scrivi_bozza(art["id"], art, F)
    c = F["curva"]; p = F["proto"]; cal = F["calo"]
    print(f"Bozza {art['id']} scritta in {out}")
    print(f"  {F['sessione']} {F['gp']} {F['anno']} (round {F['round']}, {F['circuito']})")
    print(f"  curva-simbolo {c['nome']} (dist {c['dist']:.0f} m, {c['n_piloti_sel']} piloti): "
          f"calo {it(cal['v_ing'],0)}→{it(cal['apex'],0)} = Δ{it(cal['drop'],0)} km/h")
    print(f"  apice spread {it(F['apex_spread']['spread'],0)} km/h "
          f"({F['apex_spread']['lo']:.0f}–{F['apex_spread']['hi']:.0f})")
    print(f"  protagonista {p['sig']} frenata {it(p['brake_on'],0)}m (n={p['n']}) "
          f"| più tardivo={F['piu_tardivo']} | compagno Δ{it(F['dv_compagno'],0) if F['dv_compagno'] is not None else None}m")
