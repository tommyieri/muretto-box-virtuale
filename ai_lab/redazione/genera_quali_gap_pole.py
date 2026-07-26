"""
"gap-pole" TRACK-AGNOSTIC — «Dove hai perso dalla pole», per QUALSIASI Gran Premio.

Generalizzazione di genera_hun_quali_pole_2026.py: stessa misura verificata, ma
NIENTE literal di circuito/pilota/round.  Preso il pole-man e lo sfidante piu'
vicino sul cronometro (P2), spezza il distacco per SETTORE e per CURVA (minime
all'apice), con overlay Speed-vs-Distance e la traccia del VANTAGGIO cumulato:
mostra DOVE si perde e dove si guadagna il giro secco.

Tesi (generica, la stessa che regge in Ungheria come altrove): il margine finale
nasconde un percorso.  Uno dei due puo' essere piu' veloce in piu' settori e
perdere lo stesso la pole in un solo settore; oppure il margine si costruisce in
un settore preciso.  Il titolo/sommario si ADATTANO al segno dei dati.

Regole dure (rimisurate qui, non ricopiate):
 - pole-man e P2 SCELTI dai dati: giri veloci veri (pick_fastest per pilota),
   classifica per tempo sul giro; niente sigle cablate;
 - delta per settore: tempi di settore UFFICIALI (demo/data/quali_<GP>.json) se
   il file c'e' e contiene entrambi i piloti, altrimenti Sector1/2/3Time FastF1
   dei due giri veloci — la fonte e' dichiarata nella provenienza;
 - confine dei settori in METRI: Sector1/2SessionTime del giro-pole mappati su
   Distance della telemetria;
 - minime per curva: velocita' minima all'apice (finestra asimmetrica -25/+75 m,
   curve.py) sulle curve del circuito, sui due giri veloci; MEDIANA no, e' un
   singolo giro di qualifica — le curve-complesso (con lettera) o i divari
   estremi sono segnalati come misura poco affidabile (STIMATO);
 - vantaggio cumulato: fastf1.utils.delta_time (positivo = pole-man avanti);
 - CAVEAT quali != griglia: sempre presente; se demo/data/grids.json ha la
   griglia di questo GP e differisce dalla quali, i movimenti reali sono citati,
   altrimenti resta l'avvertenza generica (penalita' non ricavabili dal cronometro).

python3 UTENTE (fastf1).  Solo lettura; bozza in ai_lab/redazione/bozze/.  Mai demo/.
"""
from __future__ import annotations
import os
import sys
import json
import datetime
import statistics as st

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele   # noqa: E402
import curve  # noqa: E402
import svg    # noqa: E402
import base   # noqa: E402

DATA = os.path.join(base.REPO, "demo", "data")


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


def _downsample(punti, n=150):
    if len(punti) <= n:
        return punti
    step = len(punti) / n
    return [punti[int(i * step)] for i in range(n)]


def _sec(t):
    """'m:ss.mmm' o 'ss.mmm' -> secondi float."""
    t = str(t)
    if ":" in t:
        m, s = t.split(":")
        return int(m) * 60 + float(s)
    return float(t)


def _td(x):
    """timedelta/NaT -> secondi float o None."""
    try:
        if x != x:
            return None
    except Exception:
        pass
    try:
        return float(x.total_seconds())
    except Exception:
        return None


def _cal_entry(rnd):
    """Riga del calendario 2026 per il round FastF1 (nome IT, circuito, titolo)."""
    if rnd is None:
        return {}
    try:
        cal = json.load(open(os.path.join(DATA, "calendario_2026.json")))
        for g in cal.get("gare", []):
            if g.get("round") == rnd:
                return g
    except Exception:
        pass
    return {}


# nomi-sessione FastF1 -> italiano (mappa generica, non e' un literal di GP)
SES_IT = {"Qualifying": "Qualifica", "Sprint Qualifying": "Qualifica Sprint",
          "Sprint": "Sprint", "Race": "Gara"}


def _settori_ufficiali(nome, prot, rivale):
    """Tempi di settore da demo/data/quali_<nome>.json se disponibili per ENTRAMBI
    i piloti (fonte canonica dei delta). Ritorna (secProt, secRiv, best_flags, file)
    oppure None (-> si ripiega su FastF1)."""
    if not nome:
        return None
    p = os.path.join(DATA, f"quali_{nome}.json")
    if not os.path.exists(p):
        return None
    try:
        qj = json.load(open(p))
        pj = {x["sigla"]: x for x in qj.get("piloti", [])}
        if prot not in pj or rivale not in pj:
            return None
        sp, sr = pj[prot].get("sectors", []), pj[rivale].get("sectors", [])
        if len(sp) != 3 or len(sr) != 3:
            return None
        secP = [_sec(s["t"]) for s in sp]
        secR = [_sec(s["t"]) for s in sr]
        best = {prot: [s.get("best") for s in sp], rivale: [s.get("best") for s in sr]}
        return secP, secR, best, os.path.basename(p)
    except Exception:
        return None


def _best_holder_ff1(ses, piloti):
    """Detentore del miglior tempo ASSOLUTO di ciascun settore nella sessione
    (fra tutti i giri di tutti i piloti). Lista [sigla|None x3]. Best-effort."""
    inv = {str(v["num"]): k for k, v in piloti.items()}
    out = [None, None, None]
    for i, col in enumerate(("Sector1Time", "Sector2Time", "Sector3Time")):
        try:
            s = ses.laps[col].dt.total_seconds()
            idx = s.idxmin()
            num = str(ses.laps.loc[idx, "DriverNumber"])
            out[i] = inv.get(num)
        except Exception:
            out[i] = None
    return out


def _grid_caveat(nome, ordine_quali):
    """Confronto quali vs griglia se demo/data/grids.json ha questo GP.
    Ritorna dict {presente, testo, movimenti, pole_resta} o {presente:False}."""
    if not nome:
        return {"presente": False}
    try:
        grids = json.load(open(os.path.join(DATA, "grids.json")))
    except Exception:
        return {"presente": False}
    grid = grids.get(nome)
    if not grid or len(grid) < 2:
        return {"presente": False}
    gpos = {sig: i + 1 for i, sig in enumerate(grid)}
    mov = []
    for qp, sig in enumerate(ordine_quali, start=1):
        gp = gpos.get(sig)
        if gp is not None and gp != qp:
            mov.append((sig, qp, gp))
    pole_sig = ordine_quali[0]
    pole_resta = gpos.get(pole_sig) == 1
    return {"presente": True, "movimenti": mov, "pole_resta": pole_resta,
            "grid": grid, "gpos": gpos}


def costruisci(gara, sessione="Q", data_bozza=None):
    import numpy as np
    from fastf1.utils import delta_time

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
    ses_it = SES_IT.get(ses_nome, ses_nome)
    cal = _cal_entry(rnd)
    nome_it = cal.get("nome")                          # nome IT del GP (chiave dei file *_<nome>.json)
    paese = nome_it or country                         # etichetta pubblica del GP (IT se nota)
    circuito_disp = cal.get("circuito") or circuito    # nome tracciato dal calendario, altrimenti Location
    slug = _slug(circuito if _ev("Location") else (gp or gara))
    ID = f"quali-gap-pole-{slug}-{anno}"
    oggi = datetime.date.today().isoformat()

    piloti = tele.piloti_sessione(ses)
    colori = base.carica_colori()

    # --- pole-man e P2 sul cronometro, SCELTI dai dati -------------------------
    rank = []
    for sig, info in piloti.items():
        try:
            lap = ses.laps.pick_drivers(info["num"]).pick_fastest()
        except Exception:
            lap = None
        s = _td(lap["LapTime"]) if lap is not None else None
        if s is not None:
            rank.append((s, sig, info["num"], lap))
    rank.sort(key=lambda r: r[0])
    if len(rank) < 2:
        return None            # servono almeno due giri veloci
    (tP, PROT, numP, lapN), (tR, RIVALE, numR, lapH) = rank[0], rank[1]
    ordine_quali = [r[1] for r in rank]

    colN = colori.get(piloti[PROT]["team"]) or piloti[PROT]["colore"] or "var(--accent)"
    colH = colori.get(piloti[RIVALE]["team"]) or piloti[RIVALE]["colore"] or "var(--dim)"
    if colN == colH:                    # stessa squadra: distingui il rivale
        colH = "var(--dim)"

    # --- delta per settore: JSON ufficiale se c'e', altrimenti FastF1 ----------
    off = _settori_ufficiali(nome_it, PROT, RIVALE)
    if off:
        secN, secH, best_flag, sett_file = off
        sett_fonte = f"tempi di settore ufficiali (demo/data/{sett_file})"
        sett_stato_da = f"tempi di settore ufficiali (demo/data/{sett_file}); best FastF1 e file coincidono"
    else:
        secN = [_td(lapN[f"Sector{i}Time"]) for i in (1, 2, 3)]
        secH = [_td(lapH[f"Sector{i}Time"]) for i in (1, 2, 3)]
        if any(v is None for v in secN + secH):
            return None        # senza settori non c'e' spacchettamento
        best_flag = None
        sett_fonte = "tempi di settore FastF1 (giri veloci di pole-man e P2)"
        sett_stato_da = "Sector1/2/3Time dei due giri veloci (FastF1)"

    dS = [round(secN[i] - secH[i], 3) for i in range(3)]      # pole − P2 per settore
    margin = round(tR - tP, 3)                                # P2 piu' lento (>0)
    vince_sett = [RIVALE if d > 0 else PROT for d in dS]      # chi e' piu' veloce
    k_rivale = sum(1 for d in dS if d > 0)                    # settori del rivale
    decisivo = min(range(3), key=lambda i: dS[i])            # settore piu' pole-favorevole
    recupero = round(sum(d for d in dS if d > 0), 3)          # quanto recupera il rivale
    guadagno_dec = round(-dS[decisivo], 3)                    # margine preso nel decisivo
    reversal = k_rivale >= 2                                  # il rivale piu' veloce in maggioranza

    best_holder = _best_holder_ff1(ses, piloti)
    rivale_best_sett = [i + 1 for i in range(3) if best_holder[i] == RIVALE]

    # --- telemetria dei due giri veloci ---------------------------------------
    telN = tele.canale_giro(lapN)
    telH = tele.canale_giro(lapH)
    dist_max = float(min(telN["Distance"].max(), telH["Distance"].max()))
    vmaxN = float(telN["Speed"].max())
    vmaxH = float(telH["Speed"].max())
    v_lineN = float(telN["Speed"].iloc[0])                    # velocita' in transito sulla linea
    gap_m = v_lineN / 3.6 * margin                            # spazio-luce del margine (stima)

    # --- confine dei settori in METRI (dal giro-pole) -------------------------
    sessN = telN["SessionTime"].dt.total_seconds().values
    distN = telN["Distance"].values
    d_s1 = float(np.interp(_td(lapN["Sector1SessionTime"]), sessN, distN))
    d_s2 = float(np.interp(_td(lapN["Sector2SessionTime"]), sessN, distN))

    # --- minime per curva (giro veloce di ciascuno) ---------------------------
    cs = curve.curve(ses)
    corner_rows = []
    for c in cs:
        lab = f"T{c['numero']}{c['lettera']}"
        aN = curve._apice(telN, c["dist"])
        aH = curve._apice(telH, c["dist"])
        if aN and aH:
            corner_rows.append({
                "label": lab, "dist": c["dist"], "numero": c["numero"],
                "lettera": c["lettera"],
                "prot": round(aN["speed"], 0), "riv": round(aH["speed"], 0),
                "delta": round(aN["speed"] - aH["speed"], 0),
                "sett": 1 if c["dist"] < d_s1 else (2 if c["dist"] < d_s2 else 3),
            })
    corner_rows.sort(key=lambda r: r["dist"])
    if not corner_rows:
        return None

    # outlier di misura: curve-complesso (con lettera) o divari estremi su un
    # singolo giro (robusto: mediana + 3·MAD, con un pavimento assoluto)
    ad = [abs(r["delta"]) for r in corner_rows]
    med = st.median(ad)
    mad = st.median([abs(x - med) for x in ad]) or (st.pstdev(ad) if len(ad) > 1 else 0.0)
    thr = max(15.0, med + 3.0 * mad)
    for r in corner_rows:
        r["outlier"] = bool(r["lettera"]) or (abs(r["delta"]) > thr)
        r["nota_out"] = ("chicane/complesso" if r["lettera"]
                         else ("apice ambiguo" if abs(r["delta"]) > thr else ""))

    puliti = [r for r in corner_rows if not r["outlier"]]
    dec_all = [r for r in corner_rows if r["sett"] == decisivo + 1 and not r["outlier"]]
    dec_gain = [r for r in dec_all if r["delta"] > 0]        # dove il pole-man porta piu' velocita'
    dec_gain.sort(key=lambda r: -r["delta"])

    # curva-zoom (figura 3): dove nel settore decisivo il pole-man porta piu'
    # velocita'; in mancanza, la piu' rappresentativa disponibile
    if dec_gain:
        zoom = dec_gain[0]
    elif dec_all:
        zoom = max(dec_all, key=lambda r: r["delta"])
    elif puliti:
        zoom = max(puliti, key=lambda r: abs(r["delta"]))
    else:
        zoom = max(corner_rows, key=lambda r: abs(r["delta"]))
    zoom_pos = zoom["delta"] > 0

    # --- traccia del vantaggio cumulato (positivo = pole-man avanti) ----------
    try:
        dt, ref, _ = delta_time(lapN, lapH)
        dt = np.array(dt, dtype=float)
        dref = ref["Distance"].values
    except Exception:
        return None
    trace = _downsample(list(zip((float(x) for x in dref),
                                 (float(y) for y in dt))), 150)
    end_adv = round(float(np.interp(dist_max, dref, dt)), 3)
    i_lo, i_hi = int(dt.argmin()), int(dt.argmax())
    dip = {"dist": float(dref[i_lo]), "val": float(dt[i_lo])}     # max vantaggio rivale
    peak = {"dist": float(dref[i_hi]), "val": float(dt[i_hi])}    # max vantaggio pole-man

    # --- caveat quali != griglia ---------------------------------------------
    grid = _grid_caveat(nome_it, ordine_quali)

    # =================== FIGURA-EROE: dove si e' deciso il giro =================
    serieV = [
        {"sigla": PROT, "colore": colN, "punti": _downsample(
            list(zip((float(x) for x in telN["Distance"].values),
                     (float(v) for v in telN["Speed"].values))), 150)},
        {"sigla": RIVALE, "colore": colH, "punti": _downsample(
            list(zip((float(x) for x in telH["Distance"].values),
                     (float(v) for v in telH["Speed"].values))), 150)},
    ]
    settori = []
    bordi = [(0.0, d_s1), (d_s1, d_s2), (d_s2, dist_max)]
    for i, (d0, d1) in enumerate(bordi):
        w = vince_sett[i]
        settori.append({"d0": d0, "d1": d1,
                        "colore": colN if w == PROT else colH,
                        "testo": f"S{i+1} · {w} {it(abs(dS[i]),3)}"})
    corners = [{"label": r["label"], "dist": r["dist"]} for r in corner_rows]
    svg1 = svg.grafico_pole(
        serieV, trace, corners, settori, dist_max=dist_max, v_range=(50, 350),
        titolo=f"Dove si è deciso il giro: il settore {decisivo+1} fa la differenza",
        sub=f"velocità dei due giri veloci + vantaggio cumulato · {ses_it} {paese} {anno}",
        endpoint_txt=f"pole {PROT} {it(margin,3)} s",
        picco={"dist": peak["dist"], "val": peak["val"],
               "txt": f"max +{it(peak['val'],2)} ({PROT})"},
        avvallamento={"dist": dip["dist"], "val": dip["val"],
                      "txt": f"{RIVALE} avanti {it(-dip['val'],3)}"})

    # =================== FIGURA 2: minime per curva ============================
    righe2 = [{"label": r["label"], "valore": r["delta"],
               "nota": f"{it(r['prot'],0)}/{it(r['riv'],0)}"
                       + (f" {r['nota_out']}" if r["nota_out"] else "")}
              for r in corner_rows]
    dec_lbl = ", ".join(f"{r['label']} +{it(r['delta'],0)}" for r in dec_gain[:3])
    cap2 = (f"km/h all’apice ({PROT}/{RIVALE} a destra). "
            + (f"Nel settore {decisivo+1} {PROT} porta più velocità nelle curve lente "
               f"({dec_lbl})" if dec_gain else
               f"Nel settore {decisivo+1} il vantaggio di {PROT} non nasce all’apice")
            + ". Le curve-complesso (lettera) sono poco affidabili su un giro")
    svg2 = svg.barre_divergenti(
        righe2, col_pos=colN, col_neg=colH,
        lbl_pos=f"{PROT} più veloce", lbl_neg=f"{RIVALE} più veloce",
        titolo="Minime per curva: chi porta più velocità, dove",
        sub=f"velocità all’apice · giri veloci · {ses_it} {paese} {anno}",
        caption=cap2)

    # =================== FIGURA 3: la curva-chiave (Speed + gas) ===============
    tN3 = curve.traccia_gas(ses, numP, zoom["dist"])
    tH3 = curve.traccia_gas(ses, numR, zoom["dist"])
    serie3 = [{"sigla": PROT, "colore": colN, "tratteggio": False, "marker": None, "punti": tN3},
              {"sigla": RIVALE, "colore": colH, "tratteggio": True, "marker": None, "punti": tH3}]
    allv3 = [p[1] for s in serie3 for p in s["punti"]] or [50, 300]
    v3lo = max(0, int(min(allv3) // 50 * 50))
    v3hi = int(max(allv3) // 50 * 50 + 50)
    svg3 = svg.grafico_gas_curva(
        serie3, v_range=(v3lo, v3hi),
        apex_txt=f"apice {zoom['label']} (settore {decisivo+1})",
        titolo=(f"{zoom['label']}: dove {PROT} porta più velocità" if zoom_pos
                else f"{zoom['label']}: il confronto all’apice nel settore {decisivo+1}"),
        sub=f"velocità + gas attorno all’apice · giri veloci · {ses_it} {paese} {anno}")

    # ================================ FACTS ====================================
    F = {
        "id": ID, "anno": anno, "gp": gp, "country": country, "circuito": circuito,
        "round": rnd, "sessione": ses_nome, "nome_it": nome_it,
        "pole": PROT, "p2": RIVALE,
        "team": {PROT: piloti[PROT]["team"], RIVALE: piloti[RIVALE]["team"]},
        "tempi": {PROT: base.lap_fmt(tP), RIVALE: base.lap_fmt(tR)},
        "pole_margin_s": margin,
        "settori_s": {PROT: [round(x, 3) for x in secN], RIVALE: [round(x, 3) for x in secH]},
        "delta_settore_pole_meno_p2": dS,
        "vincitore_settore": vince_sett,
        "settori_rivale": k_rivale, "reversal": reversal,
        "settore_decisivo": decisivo + 1, "guadagno_decisivo_s": guadagno_dec,
        "recupero_rivale_s": recupero,
        "best_settore_holder": best_holder, "rivale_best_settori": rivale_best_sett,
        "settori_fonte": "ufficiale" if off else "fastf1",
        "confine_settori_m": {"S1_fine": round(d_s1, 0), "S2_fine": round(d_s2, 0),
                              "giro": round(dist_max, 0)},
        "vmax_kmh": {PROT: round(vmaxN, 0), RIVALE: round(vmaxH, 0)},
        "v_linea_pole_kmh": round(v_lineN, 0), "gap_luce_m": round(gap_m, 2),
        "traccia_vantaggio": {"fine_s": end_adv,
                              "max_pole": {"dist_m": round(peak["dist"], 0), "val_s": round(peak["val"], 3)},
                              "max_p2": {"dist_m": round(dip["dist"], 0), "val_s": round(dip["val"], 3)}},
        "minime_curva": [{"curva": r["label"], "pole": r["prot"], "p2": r["riv"],
                          "delta_pole_meno_p2": r["delta"], "settore": r["sett"],
                          "outlier": r["outlier"]} for r in corner_rows],
        "curve_decisivo_a_pole": [r["label"] for r in dec_gain],
        "curva_zoom": {"curva": zoom["label"], "delta": zoom["delta"],
                       "pole": zoom["prot"], "p2": zoom["riv"]},
        "outlier_curve": [r["label"] for r in corner_rows if r["outlier"]],
        "n_curve": len(corner_rows),
        "griglia_nota": grid.get("presente", False),
    }

    # ================================ PROSA ====================================
    tN, tH = base.lap_fmt(tP), base.lap_fmt(tR)
    milli = f" ({int(round(margin*1000))} millesimi)" if margin < 0.1 else ""
    margine_txt = f"{it(margin,3)} s{milli}"
    accent = colN
    rnd_txt = f" · round {rnd}" if rnd else ""

    # punta massima: chi la firma va LETTO dai dati (non è detto sia il rivale)
    if round(vmaxN, 0) == round(vmaxH, 0):
        vmax_frase = f"le due punte massime coincidono (<b>{it(vmaxN,0)} km/h</b>)"
    else:
        vmax_alta = PROT if vmaxN > vmaxH else RIVALE
        vmax_frase = (f"la punta massima più alta la firma <b>{vmax_alta}</b> "
                      f"(<b>{it(max(vmaxN,vmaxH),0)}</b> contro "
                      f"<b>{it(min(vmaxN,vmaxH),0)} km/h</b>)")

    # sintesi settori per la prosa
    sett_frasi = []
    for i in range(3):
        w = vince_sett[i]
        sett_frasi.append(f"S{i+1} a {w} ({it(abs(dS[i]),3)} s)")
    sett_riepilogo = "; ".join(sett_frasi)

    if reversal:
        titolo = (f"{RIVALE} più veloce in {k_rivale} settori su tre. "
                  f"E la pole va a {PROT} per {margine_txt}")
        apertura = (f"In {k_rivale} settori su tre comanda {RIVALE}, che mette insieme "
                    f"{it(recupero,3)} s. Il conto lo chiude il settore {decisivo+1}: lì "
                    f"{PROT} è più rapido di {it(guadagno_dec,3)} s e si riprende tutto, "
                    f"con {margine_txt} d’avanzo.")
    else:
        titolo = (f"Dove {PROT} ha fatto la pole: {margine_txt}, "
                  f"quasi tutti nel settore {decisivo+1}")
        apertura = (f"{PROT} costruisce il margine soprattutto nel settore {decisivo+1} "
                    f"({it(guadagno_dec,3)} s su {RIVALE})"
                    + (f", mentre {RIVALE} recupera qualcosa altrove ({it(recupero,3)} s)"
                       if recupero > 0.005 else "") + ".")

    # causa: dove nasce il vantaggio nel settore decisivo
    if dec_gain:
        causa_curve = (f"Apice per apice, nel settore {decisivo+1} {PROT} porta più "
                       f"velocità minima nelle curve lente: {dec_lbl} km/h. La curva "
                       f"<b>{zoom['label']}</b> è l’emblema — {PROT} vi tiene circa "
                       f"<b>{it(abs(zoom['delta']),0)} km/h</b> in più.")
    else:
        causa_curve = (f"Nel settore {decisivo+1} il vantaggio di {PROT} non si legge "
                       f"all’apice delle curve (dove i due si equivalgono o {RIVALE} "
                       f"risponde): nasce piuttosto in trazione e sui tratti veloci del "
                       f"settore. La curva <b>{zoom['label']}</b> mostra il confronto da vicino.")

    # effetto: caveat quali != griglia (specifico se abbiamo la griglia)
    if grid.get("presente"):
        gpos = grid["gpos"]
        pezzi = []
        pole_g = gpos.get(PROT)
        riv_g = gpos.get(RIVALE)
        if pole_g and pole_g != 1:
            pezzi.append(f"{PROT}, primo sul cronometro, scatterà da P{pole_g}")
        elif grid["pole_resta"]:
            pezzi.append(f"{PROT} tiene la pole (P1)")
        if riv_g and riv_g != 2:
            pezzi.append(f"{RIVALE}, secondo sul giro secco, partirà da P{riv_g}")
        altri = [(s, qp, gp) for (s, qp, gp) in grid["movimenti"]
                 if s not in (PROT, RIVALE)][:2]
        for s, qp, gp2 in altri:
            pezzi.append(f"{s} da P{qp} (quali) a P{gp2}")
        caveat = ("Questi sono i tempi della <b>qualifica</b>, non la griglia: "
                  + ("; ".join(pezzi) if pezzi else "l’ordine di partenza coincide")
                  + ". Le penalità (impeding, bandiere, cambio-componenti) spostano "
                    "la griglia e non sono ricavabili dal cronometro.")
    else:
        caveat = ("Un avvertimento che cambia la lettura della domenica: questi sono i "
                  "tempi della <b>qualifica</b> — la lotta per la pole al cronometro — "
                  "<b>non la griglia di partenza</b>. Eventuali penalità (impeding, "
                  "bandiere gialle non rispettate, cambio-componenti) possono spostare "
                  "i piloti sulla griglia, e non sono ricavabili dalla telemetria: per "
                  "l’ordine di partenza fa fede la griglia ufficiale.")

    frase_best = ""
    if len(rivale_best_sett) >= 1:
        frase_best = (f" Non è un caso isolato del solo giro-pole: {RIVALE} firma il "
                      f"miglior tempo assoluto di sessione in "
                      f"{len(rivale_best_sett)} settore/i "
                      f"({', '.join('S'+str(x) for x in rivale_best_sett)}).")

    FIG = {
        "eroe": {"svg": svg1,
            "didascalia": (
                f"Due giri a confronto in velocità (in alto); la differenza si legge nel "
                f"pannello del vantaggio cumulato (in basso). {RIVALE} arriva a "
                f"{it(-dip['val'],3)} s di vantaggio, poi nel settore {decisivo+1} {PROT} "
                f"ribalta e tocca il massimo di +{it(peak['val'],2)} s; alla linea restano "
                f"{margine_txt} per {PROT}."),
            "fonte": (f"FastF1 · Speed + fastf1.utils.delta_time; delta di settore da "
                      f"{sett_fonte}, {ses_it} {paese} {anno}")},
        "minime": {"svg": svg2,
            "didascalia": (
                f"Velocità all’apice curva per curva: barre a destra = {PROT} più veloce, "
                f"a sinistra = {RIVALE}. "
                + (f"Nel settore {decisivo+1} {PROT} porta più velocità ({dec_lbl} km/h). "
                   if dec_gain else
                   f"Nel settore {decisivo+1} il divario all’apice non è a favore di {PROT}. ")
                + "Le curve-complesso (con lettera) sono una misura poco affidabile su un "
                  "singolo giro."),
            "fonte": f"FastF1 · velocità minima all’apice (finestra −25/+75 m), giri veloci, {ses_it} {paese} {anno}"},
        "zoom": {"svg": svg3,
            "didascalia": (
                f"La curva {zoom['label']}, nel settore decisivo: "
                + (f"{PROT} (linea piena) tiene una velocità minima più alta di {RIVALE} "
                   f"(tratteggio) — {it(zoom['prot'],0)} contro {it(zoom['riv'],0)} km/h."
                   if zoom_pos else
                   f"i due si confrontano all’apice ({it(zoom['prot'],0)} contro "
                   f"{it(zoom['riv'],0)} km/h per {PROT}/{RIVALE}).")),
            "fonte": f"FastF1 · Speed/Throttle, giri veloci, {ses_it} {paese} {anno}"},
    }

    art = {
        "id": ID, "stato": "bozza", "data": data_bozza or oggi,
        "firma": "Muretto · Redazione tecnica", "accent": accent,
        "canale": "A (telemetria, giro di qualifica)",
        "gp": paese, "gara": paese, "country": paese, "circuito": circuito_disp,
        "sessione": ses_it, "round": rnd,
        "tag": ["telemetria", "qualifica", "pole", paese,
                piloti[PROT]["team"], piloti[RIVALE]["team"]],
        "occhiello": f"Telemetria · {ses_it} {paese} {anno}{rnd_txt}",
        "titolo": titolo,
        "sommario": (
            f"{PROT} {tN}, {RIVALE} {tH}: {margine_txt}. Spacchettando i tre settori "
            f"({sett_riepilogo}). {apertura} Attenzione: sono i tempi della qualifica, "
            f"non la griglia — le penalità la cambiano."),
        "sezioni": [
            {"tag": "Evidenza",
             "titolo": (f"{margine_txt}, e i settori raccontano un ribaltamento"
                        if reversal else
                        f"{margine_txt}: dove nasce il margine"),
             "html": (
                f"<p>A <b>{circuito_disp}</b> la pole è di <b>{PROT}</b> in <b>{tN}</b>, "
                f"davanti a <b>{RIVALE}</b> in <b>{tH}</b>: <b>{margine_txt}</b>. Alla "
                f"velocità con cui si transita sul traguardo (~{it(v_lineN,0)} km/h) sono "
                f"circa <b>{it(gap_m,1)} metri</b> di luce.</p>"
                f"<p>Ma il margine finale nasce da un percorso. Spacchettando i tre settori "
                f"({sett_fonte}): {sett_riepilogo}. {apertura} Il pannello del vantaggio "
                f"cumulato lo mostra a colpo d’occhio: {RIVALE} avanti fino a "
                f"{it(-dip['val'],3)} s, poi la curva s’impenna nel settore {decisivo+1} e "
                f"chiude sopra la linea dello zero.{frase_best}</p>"),
             "figura": "eroe"},
            {"tag": "Causa",
             "titolo": f"Il settore {decisivo+1} è dove si costruisce il giro",
             "html": (
                f"<p>Perché proprio il settore {decisivo+1}? {causa_curve}</p>"
                f"<p>Sui tratti veloci il conto cambia: {vmax_frase}. Due macchine con "
                f"due indoli; questo tracciato, com’è fatto, premia quella di <b>{PROT}</b> "
                f"— di {margine_txt}.</p>"),
             "figura": "minime"},
            {"tag": "Effetto",
             "titolo": "È il cronometro, non la griglia",
             "html": (
                f"<p>{caveat}</p>"
                f"<p>Il confronto {PROT}–{RIVALE} sul cronometro resta la fotografia più "
                f"pulita del giro secco: {margine_txt}, un solo settore a decidere. Il "
                f"grafico qui sotto isola la curva-chiave — <b>{zoom['label']}</b>, nel "
                f"settore {decisivo+1} — dove, in una manciata di metri, ha preso forma il "
                f"distacco. Sul cronometro. Sulla griglia, l’ordine può essere un altro.</p>"),
             "figura": "zoom"},
        ],
        "provenienza": [
            {"grandezza": "margine di pole (cronometro)",
             "valore": f"{PROT} {tN} · {RIVALE} {tH} · {it(margin,3)} s",
             "stato": "MISURATO",
             "da": "giri veloci veri (pick_fastest per pilota), classifica per tempo sul giro — FastF1"},
            {"grandezza": "delta per settore (pole − P2)",
             "valore": (f"{sett_riepilogo}; il rivale recupera {it(recupero,3)} s, il "
                        f"pole-man ne prende {it(guadagno_dec,3)} nel solo settore {decisivo+1}"),
             "stato": "MISURATO", "da": sett_stato_da},
            {"grandezza": "traccia del vantaggio cumulato lungo il giro",
             "valore": (f"{RIVALE} avanti fino a {it(-dip['val'],3)} s (a ~{it(dip['dist'],0)} m); "
                        f"{PROT} fino a +{it(peak['val'],2)} s (a ~{it(peak['dist'],0)} m); "
                        f"alla linea +{it(end_adv,3)} s"),
             "stato": "MISURATO",
             "da": "fastf1.utils.delta_time sui due giri veloci; endpoint coerente col margine"},
            {"grandezza": "confine dei settori in metri",
             "valore": f"S1 fino a ~{it(d_s1,0)} m · S2 ~{it(d_s1,0)}–{it(d_s2,0)} m · S3 fino a ~{it(dist_max,0)} m",
             "stato": "MISURATO",
             "da": "Sector1/2SessionTime del giro-pole mappati su Distance della telemetria"},
            {"grandezza": f"minime per curva ({len(corner_rows)} curve, giri veloci)",
             "valore": (f"nel settore {decisivo+1} {PROT} più veloce in "
                        f"{', '.join(F['curve_decisivo_a_pole']) or '—'}; "
                        f"curva-chiave {zoom['label']} "
                        f"{('+' if zoom['delta'] >= 0 else '−') + it(abs(zoom['delta']),0)} km/h"),
             "stato": "MISURATO",
             "da": "velocità minima all’apice (finestra −25/+75 m) sul giro veloce di ciascuno"},
        ] + ([
            {"grandezza": "curve di misura poco affidabile",
             "valore": (f"{', '.join(F['outlier_curve'])}: curve-complesso (lettera) o "
                        f"divario estremo su singolo giro — non usate come tesi"),
             "stato": "STIMATO",
             "da": "finestra d’apice ambigua (due apici) o outlier robusto (>mediana+3·MAD)"},
        ] if F["outlier_curve"] else []) + ([
            {"grandezza": "miglior settore assoluto di sessione",
             "valore": (f"{RIVALE} detiene il miglior {', '.join('S'+str(x) for x in rivale_best_sett)}"
                        + (f"; {PROT} il miglior S{F['settore_decisivo']}"
                           if best_holder[decisivo] == PROT else "")),
             "stato": "MISURATO",
             "da": "min Sector1/2/3Time fra tutti i giri di tutti i piloti (FastF1)"},
        ] if rivale_best_sett else []) + [
            {"grandezza": "velocità di punta e spazio-luce del margine",
             "valore": (f"vmax {PROT} {it(vmaxN,0)} · {RIVALE} {it(vmaxH,0)} km/h; "
                        f"{it(margin,3)} s a ~{it(v_lineN,0)} km/h ≈ {it(gap_m,2)} m"),
             "stato": "STIMATO",
             "da": "vmax dal canale Speed (MISURATO); spazio-luce = velocità × margine (prodotto, non misura diretta)"},
            {"grandezza": "griglia di partenza (penalità)",
             "valore": ("confrontata con la griglia ufficiale (demo/data/grids.json)"
                        if grid.get("presente") else
                        "non ricavabile dal cronometro: per la griglia fa fede l’ufficiale"),
             "stato": "MISURATO" if grid.get("presente") else "NON_MISURABILE",
             "da": ("griglia ufficiale del GP (file grids.json)" if grid.get("presente")
                    else "decisioni dei commissari — esterne alla telemetria; qui per non confondere quali e griglia")},
            {"grandezza": "carico aerodinamico, gomma, mappe motore",
             "valore": "senza canale nel feed: l’attribuzione car/pilota del carattere resta interpretazione",
             "stato": "NON_MISURABILE",
             "da": "nessun canale di carico/temperatura/mescola/mappa nel feed telemetrico"},
        ],
        "fonti": [
            {"tipo": "dati",
             "testo": (f"FastF1 — telemetria vettura (Speed/Throttle/nGear) + circuit_info, "
                       f"{ses_it} {paese} {anno} ({circuito_disp}); delta di settore da {sett_fonte}")},
            {"tipo": "metodo",
             "testo": ("ai_lab/redazione/genera_quali_gap_pole.py su tele.py/curve.py/svg.py — "
                       "pole-man e P2 scelti dai dati (pick_fastest, classifica per tempo); overlay "
                       "Speed-vs-Distance dei due giri veloci; vantaggio cumulato con "
                       "fastf1.utils.delta_time; delta di settore dai tempi ufficiali se presenti, "
                       "altrimenti Sector1/2/3Time FastF1; minime per curva = velocità minima "
                       "all’apice (finestra −25/+75 m); curve-complesso e outlier robusti segnalati; "
                       "quali≠griglia dichiarato (specifico se la griglia è nota, altrimenti generico)")},
        ],
    }

    for sez in art["sezioni"]:
        if sez.get("figura") in FIG:
            sez["figura"] = FIG[sez["figura"]]
        elif "figura" in sez:
            del sez["figura"]
    return F, art


META = {
    "id": "quali-gap-pole", "canale": "A",
    "titolo": "Dove hai perso dalla pole: il giro secco spacchettato per settore e per curva",
    "tag": ["telemetria", "qualifica", "pole"],
    "descrizione": ("overlay Speed-vs-Distance + vantaggio cumulato + minime per curva: "
                    "dove pole-man e P2 guadagnano/perdono il giro — per qualsiasi GP"),
    "richiede": "telemetria", "gare": ["*"], "sessioni": ["Q"],
}


def genera(gara=None, data=None, sessione=None):
    if sessione is None:
        sessione = "Q"
    if gara is None:
        return None            # track-agnostic, ma serve sapere QUALE Gran Premio
    r = costruisci(gara, sessione, data_bozza=data)
    if not r:
        return None
    F, art = r
    base.scrivi_bozza(art["id"], art, F)
    return {"id": art["id"], "titolo": art["titolo"], "stato": art["stato"],
            "canale": META["canale"]}


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="gap-pole track-agnostic da una sessione di qualifica")
    ap.add_argument("--gara", required=True,
                    help="GP accettato da FastF1 (nome inglese/località/round), es. 'Hungary'")
    ap.add_argument("--sessione", default="Q", help="sessione qualifica (default Q)")
    ap.add_argument("--data", default=None, help="AAAA-MM-GG per la targhetta della bozza")
    a = ap.parse_args()
    r = costruisci(a.gara, a.sessione, data_bozza=a.data)
    if not r:
        print("nessun giro veloce/settore utilizzabile: generatore saltato"); sys.exit(1)
    F, art = r
    out = base.scrivi_bozza(art["id"], art, F)
    dS = F["delta_settore_pole_meno_p2"]
    print(f"Bozza {art['id']} scritta in {out}")
    print(f"  {F['sessione']} {F['gp']} {F['anno']} (round {F['round']}, {F['circuito']})")
    print(f"  pole {F['pole']} {F['tempi'][F['pole']]} vs {F['p2']} {F['tempi'][F['p2']]} = {it(F['pole_margin_s'],3)} s"
          f" · fonte settori: {F['settori_fonte']}")
    print(f"  settori pole−P2: S1 {it(dS[0],3)} · S2 {it(dS[1],3)} · S3 {it(dS[2],3)}"
          f" · vincitori {F['vincitore_settore']} · decisivo S{F['settore_decisivo']} (reversal={F['reversal']})")
    print(f"  traccia: {F['p2']} max {it(F['traccia_vantaggio']['max_p2']['val_s'],3)} · "
          f"{F['pole']} max +{it(F['traccia_vantaggio']['max_pole']['val_s'],2)} · fine +{it(F['traccia_vantaggio']['fine_s'],3)}")
    print(f"  curve decisivo a {F['pole']}: {F['curve_decisivo_a_pole']} · zoom {F['curva_zoom']['curva']} "
          f"{F['curva_zoom']['delta']:+} km/h · outlier {F['outlier_curve']}")
    print(f"  vmax {F['pole']} {F['vmax_kmh'][F['pole']]} {F['p2']} {F['vmax_kmh'][F['p2']]} · "
          f"margine ≈ {it(F['gap_luce_m'],2)} m · {F['n_curve']} curve · griglia nota={F['griglia_nota']}")
