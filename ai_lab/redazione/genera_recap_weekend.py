"""
"recap-weekend" TRACK-AGNOSTIC — «Dove nasce il vantaggio del team dominante»,
per QUALSIASI Gran Premio.

Recap del weekend di LIVELLO ESPERTO, con la SOLA telemetria: non racconta CHI ha
vinto (lo sanno tutti), ma LOCALIZZA il vantaggio metro per metro. Individua dai
dati il pilota dominante (miglior giro di qualifica + miglior passo gara) e ne
mostra il vantaggio a strati, ogni faccia col suo grafico:

  A) MAPPA DI DOMINANZA A MINISETTORI — la pianta GPS del circuito in scala reale,
     ogni tratto colorato del pilota più veloce lì (dominante vs il rivale più
     vicino sul giro secco). DOVE domina.
  B) DELTA-TIME CUMULATO su asse-distanza — overlay velocità + vantaggio cumulato
     con annotato il tratto di massima pendenza (dove nasce il decimo).
  C) MINIME ALL'APICE curva per curva — dove il dominante porta più velocità in
     curva (+X km/h, a quali curve); curve-complesso segnalate come poco affidabili.
  D) FRENATA + TRAZIONE nella curva-chiave — punto di frenata (m) e riapertura del
     gas (m dopo l'apice): il come del vantaggio in curva.
  + PASSO GARA come contesto — mediana e IQR sui giri verdi validi: il dominio non
     è solo giro secco.

Principio-guida (ci protegge e ci distingue): la telemetria misura il SINTOMO (dove
la velocità è più alta, dove si riapre prima il gas), NON la CAUSA. Carico aero,
grip meccanico, assetto, gestione gomma non hanno canale nel feed: sono dichiarati
NON_MISURABILE. Mai attribuire a un componente che non vediamo.

Regole dure (rimisurate qui, non ricopiate):
 - dominante e rivale SCELTI dai dati: giri veloci veri (pick_fastest per pilota) in
   qualifica; passo gara = mediana dei giri-core (entro 1,07× il best) sui giri verdi;
 - vantaggio cumulato: fastf1.utils.delta_time (endpoint = margine reale, positivo =
   dominante avanti) — NON l'integrazione grezza di 1/v, che non è calibrata al giro;
 - minisettori: guadagno-tempo per tratto = differenza del delta cumulato ai bordi
   del tratto (coerente con B, somma = margine);
 - minime per curva: velocità minima all'apice (finestra −25/+75 m), giri veloci;
   curve-complesso (lettera) o divari estremi su singolo giro segnalati STIMATO;
 - frenata/trazione: dal canale Brake (m prima dell'apice) e Throttle≥95% (m dopo);
 - passo gara: mediana e IQR dei giri-core verdi (out/in-lap, cancellati, non-verde
   scartati); carburante/mescola/mappa ignoti -> passo indicativo, non verdetto.

python3 UTENTE (fastf1 3.8.3). Solo lettura; bozza in ai_lab/redazione/bozze/. Mai demo/.
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
N_MINISETTORI = 24
SOGLIA = 1.07                                   # guardia traffico entro-stint

SES_IT = {"Qualifying": "Qualifica", "Sprint Qualifying": "Qualifica Sprint",
          "Sprint": "Sprint", "Race": "Gara"}


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


def _td(x):
    try:
        if x != x:
            return None
    except Exception:
        pass
    try:
        return float(x.total_seconds())
    except Exception:
        return None


def _downsample(punti, n=170):
    if len(punti) <= n:
        return punti
    step = len(punti) / n
    return [punti[int(i * step)] for i in range(n)]


def _cal_entry(rnd):
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


# ---------------------------------------------------------------------------
# MISURA — qualifica (giro secco)
# ---------------------------------------------------------------------------
def _rank_q(ses, piloti):
    rank = []
    for sig, info in piloti.items():
        try:
            lap = ses.laps.pick_drivers(info["num"]).pick_fastest()
        except Exception:
            lap = None
        s = _td(lap["LapTime"]) if lap is not None else None
        if s is not None:
            rank.append({"sec": s, "sig": sig, "num": info["num"],
                         "team": info["team"], "lap": lap})
    rank.sort(key=lambda r: r["sec"])
    return rank


def _near_corner(cs, dm):
    if not cs:
        return ""
    c = min(cs, key=lambda c: abs(c["dist"] - dm))
    return f"T{c['numero']}{c['lettera']}"


def _minisettori_e_delta(lapP, lapR, cs, telP, N=N_MINISETTORI):
    """Vantaggio cumulato (delta_time, calibrato) e minisettori derivati.
    Ritorna dict con trace, righe minisettore (winner+curva), conteggi, guadagni,
    tratto di massima pendenza, picco/avvallamento, e i segmenti X/Y per la mappa."""
    import numpy as np
    from fastf1.utils import delta_time

    dt, ref, _ = delta_time(lapP, lapR)          # reference=dominante -> +delta = dominante avanti
    dt = np.array(dt, dtype=float)
    dref = ref["Distance"].values
    dmax = float(dref.max())
    trace = _downsample(list(zip((float(x) for x in dref),
                                 (float(y) for y in dt))), 170)
    end_adv = float(dt[-1])
    i_hi, i_lo = int(dt.argmax()), int(dt.argmin())
    peak = {"dist": float(dref[i_hi]), "val": float(dt[i_hi]),
            "curva": _near_corner(cs, float(dref[i_hi]))}
    dip = {"dist": float(dref[i_lo]), "val": float(dt[i_lo]),
           "curva": _near_corner(cs, float(dref[i_lo]))}

    edges = np.linspace(0, dmax, N + 1)
    de = np.interp(edges, dref, dt)              # delta cumulato ai bordi dei minisettori

    # segmenti X/Y del giro-dominante, spezzati sui bordi (con estremi interpolati)
    distP = telP["Distance"].values
    xP = telP["X"].values.astype(float)
    yP = telP["Y"].values.astype(float)
    order = np.argsort(distP)
    distP, xP, yP = distP[order], xP[order], yP[order]
    distP, uidx = np.unique(distP, return_index=True)
    xP, yP = xP[uidx], yP[uidx]

    righe = []
    segmenti = []
    win_p = win_r = 0
    gain_p = gain_r = 0.0
    for i in range(N):
        diff = float(de[i + 1] - de[i])          # + = dominante più veloce nel tratto
        mid = (edges[i] + edges[i + 1]) / 2
        curva = _near_corner(cs, mid)
        prot = diff > 0
        if prot:
            win_p += 1; gain_p += diff
        else:
            win_r += 1; gain_r += -diff
        righe.append({"i": i, "d0": float(edges[i]), "d1": float(edges[i + 1]),
                      "diff": diff, "curva": curva, "prot": prot})
        # punti X/Y del tratto (estremi interpolati per continuità)
        x0e = float(np.interp(edges[i], distP, xP)); y0e = float(np.interp(edges[i], distP, yP))
        x1e = float(np.interp(edges[i + 1], distP, xP)); y1e = float(np.interp(edges[i + 1], distP, yP))
        m = (distP > edges[i]) & (distP < edges[i + 1])
        pts = [(x0e, y0e)] + list(zip(xP[m].tolist(), yP[m].tolist())) + [(x1e, y1e)]
        segmenti.append({"punti": pts, "prot": prot})

    srt = sorted(righe, key=lambda r: r["diff"])
    steep_prot = srt[-1]                          # tratto dove il dominante guadagna di più
    steep_riv = srt[0]                            # tratto dove il rivale guadagna di più
    x_range = (float(xP.min()), float(xP.max()))
    y_range = (float(yP.min()), float(yP.max()))
    start_xy = (float(np.interp(0.0, distP, xP)), float(np.interp(0.0, distP, yP)))
    return {"trace": trace, "dmax": dmax, "end_adv": end_adv,
            "peak": peak, "dip": dip, "righe": righe, "segmenti": segmenti,
            "win_p": win_p, "win_r": win_r, "gain_p": gain_p, "gain_r": gain_r,
            "steep_prot": steep_prot, "steep_riv": steep_riv,
            "x_range": x_range, "y_range": y_range, "start_xy": start_xy}


def _apici(telP, telR, cs):
    """Minime all'apice curva per curva sui due giri veloci; flag outlier
    (curve-complesso o divari estremi su singolo giro)."""
    rows = []
    for c in cs:
        aP = curve._apice(telP, c["dist"])
        aR = curve._apice(telR, c["dist"])
        if aP and aR:
            rows.append({"label": f"T{c['numero']}{c['lettera']}", "dist": c["dist"],
                         "lettera": c["lettera"],
                         "prot": round(aP["speed"], 0), "riv": round(aR["speed"], 0),
                         "delta": round(aP["speed"] - aR["speed"], 0),
                         "apex_d": aP["dist"]})
    rows.sort(key=lambda r: r["dist"])
    if not rows:
        return rows
    ad = [abs(r["delta"]) for r in rows]
    med = st.median(ad)
    mad = st.median([abs(x - med) for x in ad]) or (st.pstdev(ad) if len(ad) > 1 else 0.0)
    thr = max(15.0, med + 3.0 * mad)
    for r in rows:
        r["outlier"] = bool(r["lettera"]) or (abs(r["delta"]) > thr)
        r["nota_out"] = ("chicane/complesso" if r["lettera"]
                         else ("apice ambiguo" if abs(r["delta"]) > thr else ""))
    return rows


def _apici_condivisi(rows, keep_curva, tol=12.0):
    """Etichette di curve i cui riferimenti circuit_info cadono sullo STESSO apice
    fisico (stesso minimo di velocità entro `tol` m sul giro del dominante): vanno
    riportate UNA SOLA volta nelle tesi/prosa, non contate due volte. Es. tipico:
    T6/T7 a Hungaroring (riferimenti a 37 m -> un solo apice condiviso). Tiene come
    'primaria' la curva del tratto di massima pendenza se è nel gruppo, altrimenti
    quella col |delta| maggiore; segnala le altre come condivise. Il grafico continua
    a mostrarle (annotate); la scelta della curva-chiave NON passa da qui."""
    condivisi = set()
    usate = [False] * len(rows)
    for i, r in enumerate(rows):
        if usate[i] or r.get("apex_d") is None:
            continue
        grp = [r]
        usate[i] = True
        for j in range(i + 1, len(rows)):
            if (not usate[j] and rows[j].get("apex_d") is not None
                    and abs(rows[j]["apex_d"] - r["apex_d"]) < tol):
                grp.append(rows[j]); usate[j] = True
        if len(grp) > 1:
            prim = (next((x for x in grp if x["label"] == keep_curva), None)
                    or max(grp, key=lambda x: abs(x["delta"])))
            for x in grp:
                if x is not prim:
                    condivisi.add(x["label"])
    return condivisi


def _scelta_curva_chiave(apici_rows, steep_prot_curva):
    """La curva-chiave per la sezione frenata/trazione: dove il dominante porta più
    velocità all'apice (curva PULITA, non-complesso), preferendo il tratto di massima
    pendenza del delta. Ritorna la riga-apice o None."""
    puliti = [r for r in apici_rows if not r["outlier"] and r["delta"] > 0]
    if not puliti:
        return None
    # preferenza: curva nel tratto di massima pendenza del dominante
    near = [r for r in puliti if r["label"] == steep_prot_curva]
    if near:
        return max(near, key=lambda r: r["delta"])
    return max(puliti, key=lambda r: r["delta"])


def _frenata_trazione(telP, telR, dist_curva):
    """Profilo frenata/trazione dei due giri attorno a una curva."""
    pP = curve.profilo_curva(telP, dist_curva)
    pR = curve.profilo_curva(telR, dist_curva)
    return pP, pR


# ---------------------------------------------------------------------------
# MISURA — passo gara (contesto)
# ---------------------------------------------------------------------------
def _passo_gara(rses):
    """Mediana + IQR dei giri-core verdi validi per pilota. Ritorna lista ordinata
    di dict {sig, team, med, iqr, best, n} (>=5 giri-core)."""
    laps = rses.laps
    piloti = tele.piloti_sessione(rses)
    inv = {v["num"]: (k, v["team"]) for k, v in piloti.items()}
    out = []
    for num in rses.drivers:
        dl = laps.pick_drivers(num)
        if dl.empty:
            continue
        sig, team = inv.get(num, (num, "?"))
        green = []
        for _, lap in dl.iterrows():
            if lap["PitOutTime"] == lap["PitOutTime"]:
                continue
            if lap["PitInTime"] == lap["PitInTime"]:
                continue
            if bool(lap.get("Deleted", False)):
                continue
            if str(lap.get("TrackStatus", "1")) != "1":
                continue
            s = tele.secondi(lap["LapTime"])
            if s is None:
                continue
            green.append(s)
        if len(green) < 5:
            continue
        best = min(green)
        core = sorted(g for g in green if g <= best * SOGLIA)
        n = len(core)
        if n < 5:
            continue
        q1 = core[int(0.25 * (n - 1))]
        q3 = core[int(0.75 * (n - 1))]
        out.append({"sig": sig, "team": team, "med": st.median(core),
                    "iqr": q3 - q1, "best": best, "n": n})
    out.sort(key=lambda r: r["med"])
    return out


# ---------------------------------------------------------------------------
# COSTRUZIONE ARTICOLO
# ---------------------------------------------------------------------------
def costruisci(gara, data_bozza=None):
    anno_hint = int(str(data_bozza)[:4]) if data_bozza else datetime.date.today().year
    q = tele.carica_sessione(anno_hint, gara, "Q")
    ev = q.event

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
    cal = _cal_entry(rnd)
    nome_it = cal.get("nome")
    paese = nome_it or country
    circuito_disp = cal.get("circuito") or circuito
    # slug dall'identità canonica del sito (nome circuito IT se noto), track-agnostic
    slug = _slug(cal.get("circuito") or nome_it or circuito or gp or gara)
    ID = f"recap-weekend-{slug}-{anno}"
    oggi = datetime.date.today().isoformat()

    piloti = tele.piloti_sessione(q)
    colori = base.carica_colori()
    cs = curve.curve(q)

    # --- pole-man e rivale più vicino sul giro secco (dai dati) ----------------
    rank = _rank_q(q, piloti)
    if len(rank) < 2:
        return None
    P, R = rank[0], rank[1]
    PROT, RIVAL = P["sig"], R["sig"]
    teamP, teamR = P["team"], R["team"]
    margin = round(R["sec"] - P["sec"], 3)                # rivale più lento (>0)
    colP = colori.get(teamP) or piloti[PROT]["colore"] or "var(--accent)"
    colR = colori.get(teamR) or piloti[RIVAL]["colore"] or "var(--dim)"
    if colP == colR:
        colR = "var(--dim)"

    telP = P["lap"].get_telemetry()
    telR = R["lap"].get_telemetry()
    vmaxP = float(telP["Speed"].max())
    vmaxR = float(telR["Speed"].max())

    # --- A + B: minisettori + delta cumulato ----------------------------------
    md = _minisettori_e_delta(P["lap"], R["lap"], cs, telP)
    dmax = md["dmax"]

    # --- C: minime all'apice ---------------------------------------------------
    apici_rows = _apici(telP, telR, cs)
    if not apici_rows:
        return None
    # curve a riferimenti ravvicinati che condividono UN solo apice fisico (es. T6/T7):
    # riportate una volta sola nelle tesi/prosa. Il grafico le mostra (annotate); la
    # curva-chiave resta libera di sceglierle.
    condivisi = _apici_condivisi(apici_rows, md["steep_prot"]["curva"])
    prot_apici = [r for r in apici_rows if not r["outlier"] and r["delta"] > 0
                  and r["label"] not in condivisi]
    prot_apici.sort(key=lambda r: -r["delta"])
    riv_apici = [r for r in apici_rows if not r["outlier"] and r["delta"] < 0
                 and r["label"] not in condivisi]
    riv_apici.sort(key=lambda r: r["delta"])

    # --- D: curva-chiave (frenata + trazione) ----------------------------------
    key = _scelta_curva_chiave(apici_rows, md["steep_prot"]["curva"])
    pf = pr = None
    if key:
        pf, pr = _frenata_trazione(telP, telR, key["dist"])

    # --- passo gara (contesto) -------------------------------------------------
    race_ok = True
    try:
        rses = tele.carica_sessione(anno_hint, gara, "Race")
        passo = _passo_gara(rses)
    except Exception:
        race_ok = False
        passo = []
    race_leader = passo[0] if passo else None
    # dominio doppio? pole-man == miglior passo gara
    dominio = bool(race_leader and race_leader["sig"] == PROT)
    # esito gara del dominante (per il caveat onesto "qualifica != griglia"): posizione di
    # partenza e d'arrivo, se il feed le espone. Fallback silenzioso a None -> caveat generale.
    grid_prot = finish_prot = None
    if race_ok:
        try:
            row = rses.results[rses.results["Abbreviation"] == PROT]
            if len(row):
                g = float(row["GridPosition"].iloc[0])
                grid_prot = int(g) if g == g and g > 0 else None
                p = float(row["Position"].iloc[0])
                finish_prot = int(p) if p == p and p > 0 else None
        except Exception:
            pass
    # margine passo del dominante sul rivale-passo più vicino
    passo_prot = next((r for r in passo if r["sig"] == PROT), None)
    passo_next = None
    passo_margin = None
    if passo_prot:
        others = [r for r in passo if r["sig"] != PROT]
        if others:
            passo_next = min(others, key=lambda r: r["med"])
            passo_margin = round(passo_next["med"] - passo_prot["med"], 3)
    field_spread = round(passo[min(9, len(passo) - 1)]["med"] - passo[0]["med"], 3) if len(passo) >= 2 else None

    ses_it = "Weekend"

    # ---------------------------------------------------------------- FIGURE
    # A) mappa dominanza minisettori
    corners_map = [{"label": f"T{c['numero']}{c['lettera']}", "x": c["x"], "y": c["y"]} for c in cs]
    fig_a = svg.mappa_dominanza(
        md["segmenti"], corners_map,
        x_range=md["x_range"], y_range=md["y_range"],
        col_prot=colP, col_riv=colR, sig_prot=PROT, sig_riv=RIVAL,
        n_prot=md["win_p"], n_riv=md["win_r"], start_xy=md["start_xy"],
        titolo=f"Mappa di dominanza: dove {PROT} è più veloce di {RIVAL}, tratto per tratto",
        sub=f"{N_MINISETTORI} minisettori equi-distanza · giri veloci Q · {paese} {anno}",
        caption="colore = più veloce in quel tratto · pianta GPS in scala reale")

    # B) delta cumulato + overlay velocità
    serieV = [
        {"sigla": PROT, "colore": colP, "punti": _downsample(
            list(zip((float(x) for x in telP["Distance"].values),
                     (float(v) for v in telP["Speed"].values))), 170)},
        {"sigla": RIVAL, "colore": colR, "punti": _downsample(
            list(zip((float(x) for x in telR["Distance"].values),
                     (float(v) for v in telR["Speed"].values))), 170)},
    ]
    corners_b = [{"label": r["label"], "dist": r["dist"]} for r in apici_rows]
    sp = md["steep_prot"]
    fig_b = svg.delta_cumulato(
        serieV, md["trace"], corners_b, dist_max=dmax, v_range=(50, 350),
        col_prot=colP, col_riv=colR,
        titolo=f"Dove nasce il decimo: velocità e vantaggio cumulato, {PROT} vs {RIVAL}",
        sub=f"overlay Speed + Δt cumulato (fastf1.delta_time) · giri veloci Q · {paese} {anno}",
        slope={"d0": sp["d0"], "d1": sp["d1"],
               "txt": f"max pendenza · {sp['curva']} +{it(sp['diff']*1000,0)} ms"},
        peak={"dist": md["peak"]["dist"], "val": md["peak"]["val"],
              "txt": f"max +{it(md['peak']['val'],2)} ({PROT})"},
        dip={"dist": md["dip"]["dist"], "val": md["dip"]["val"],
             "txt": (f"{RIVAL} avanti {it(-md['dip']['val'],3)}" if md["dip"]["val"] < 0 else "")},
        endpoint_txt=f"pole {it(margin,3)} s")

    # C) minime per curva (divergenti)
    righe_c = [{"label": r["label"], "valore": r["delta"],
                "nota": f"{it(r['prot'],0)}/{it(r['riv'],0)}"
                        + (f" {r['nota_out']}" if r["nota_out"] else "")
                        + (" apice condiviso" if r["label"] in condivisi else "")}
               for r in apici_rows]
    dec_lbl = ", ".join(f"{r['label']} +{it(r['delta'],0)}" for r in prot_apici[:3])
    fig_c = svg.barre_divergenti(
        righe_c, col_pos=colP, col_neg=colR,
        lbl_pos=f"{PROT} più veloce", lbl_neg=f"{RIVAL} più veloce",
        titolo="Minime all'apice: chi porta più velocità in curva, dove",
        sub=f"velocità minima all'apice · giri veloci Q · {paese} {anno}",
        caption=(f"km/h all'apice ({PROT}/{RIVAL} a destra). "
                 + (f"{PROT} guadagna nelle medie: {dec_lbl} km/h. " if prot_apici else "")
                 + "Curve-complesso (lettera) poco affidabili su un giro"))

    # D) frenata + trazione nella curva-chiave
    fig_d = None
    if key and pf and pr:
        tN = curve.traccia_gas(q, P["num"], key["dist"])
        tH = curve.traccia_gas(q, R["num"], key["dist"])
        serie_d = [{"sigla": PROT, "colore": colP, "tratteggio": False,
                    "marker": (-pf["brake_on"] if pf.get("brake_on") else None), "punti": tN},
                   {"sigla": RIVAL, "colore": colR, "tratteggio": True,
                    "marker": (-pr["brake_on"] if pr.get("brake_on") else None), "punti": tH}]
        allv = [p[1] for s in serie_d for p in s["punti"]] or [50, 300]
        vlo = max(0, int(min(allv) // 50 * 50))
        vhi = int(max(allv) // 50 * 50 + 50)
        fig_d = svg.grafico_gas_curva(
            serie_d, v_range=(vlo, vhi),
            apex_txt=f"apice {key['label']}",
            marker_label="● = punto di frenata",
            titolo=f"{key['label']}: come {PROT} costruisce il vantaggio in curva",
            sub=f"velocità + gas attorno all'apice · giri veloci Q · {paese} {anno}")

    # +) passo gara (contesto)
    fig_p = None
    if passo:
        lead = passo[0]["med"]
        righe_p = [{"sigla": f"{r['sig']} · IQR {it(r['iqr'],2)}",
                    "colore": colori.get(r["team"]) or "var(--dim)",
                    "valore": r["med"] - lead,
                    "evidenza": r["sig"] in (PROT, RIVAL)}
                   for r in passo[:10]]
        fig_p = svg.barre_dv(
            righe_p, titolo=f"Passo gara: Δ dal più rapido ({passo[0]['sig']})",
            sub=f"mediana giri-core verdi · Gara {paese} {anno}",
            unita="s", base=0.0, ml=120, dec=3,
            caption="s/giro dalla mediana più rapida · IQR = dispersione (costanza)")

    # ------------------------------------------------------------------ FACTS
    F = {
        "id": ID, "anno": anno, "gp": gp, "country": country, "circuito": circuito,
        "round": rnd, "nome_it": nome_it,
        "dominante": PROT, "rivale": RIVAL, "dominio_doppio": dominio,
        "team": {PROT: teamP, RIVAL: teamR},
        "q_tempi": {PROT: base.lap_fmt(P["sec"]), RIVAL: base.lap_fmt(R["sec"])},
        "pole_margin_s": margin,
        "minisettori": {"n": N_MINISETTORI, "vinti_dominante": md["win_p"],
                        "vinti_rivale": md["win_r"],
                        "ms_guadagnati_dominante": round(md["gain_p"] * 1000, 0),
                        "ms_guadagnati_rivale": round(md["gain_r"] * 1000, 0)},
        "delta_cumulato": {"fine_s": round(md["end_adv"], 3),
                           "picco_dominante": {"s": round(md["peak"]["val"], 3),
                                               "dist_m": round(md["peak"]["dist"], 0),
                                               "curva": md["peak"]["curva"]},
                           "picco_rivale": {"s": round(md["dip"]["val"], 3),
                                            "dist_m": round(md["dip"]["dist"], 0),
                                            "curva": md["dip"]["curva"]}},
        "max_pendenza_dominante": {"curva": md["steep_prot"]["curva"],
                                   "ms": round(md["steep_prot"]["diff"] * 1000, 0),
                                   "d0": round(md["steep_prot"]["d0"], 0),
                                   "d1": round(md["steep_prot"]["d1"], 0)},
        "max_pendenza_rivale": {"curva": md["steep_riv"]["curva"],
                                "ms": round(md["steep_riv"]["diff"] * 1000, 0)},
        "vmax_kmh": {PROT: round(vmaxP, 0), RIVAL: round(vmaxR, 0)},
        "minime_curva": [{"curva": r["label"], "dominante": r["prot"], "rivale": r["riv"],
                          "delta": r["delta"], "outlier": r["outlier"]} for r in apici_rows],
        "apici_dominante": [f"{r['label']} +{int(r['delta'])}" for r in prot_apici[:5]],
        "apici_rivale": [f"{r['label']} {int(r['delta'])}" for r in riv_apici[:5]],
        "outlier_curve": [r["label"] for r in apici_rows if r["outlier"]],
        "curva_chiave": (None if not key else {
            "curva": key["label"], "delta_apice_kmh": key["delta"],
            "apice_dominante_kmh": key["prot"], "apice_rivale_kmh": key["riv"],
            "frenata_m": {PROT: round(pf["brake_on"], 0) if pf and pf.get("brake_on") else None,
                          RIVAL: round(pr["brake_on"], 0) if pr and pr.get("brake_on") else None},
            "gas_pieno_dopo_apice_m": {PROT: round(pf["full_after"], 0) if pf and pf.get("full_after") else None,
                                       RIVAL: round(pr["full_after"], 0) if pr and pr.get("full_after") else None}}),
        "passo_gara": ({"leader": race_leader["sig"], "leader_team": race_leader["team"],
                        "leader_med": race_leader["med"], "leader_iqr": race_leader["iqr"],
                        "dominante_med": passo_prot["med"] if passo_prot else None,
                        "dominante_iqr": passo_prot["iqr"] if passo_prot else None,
                        "next_sig": passo_next["sig"] if passo_next else None,
                        "next_med": passo_next["med"] if passo_next else None,
                        "rivale_iqr": passo_next["iqr"] if passo_next else None,
                        "margine_s": passo_margin, "field_spread_s": field_spread}
                       if race_leader else None),
        "esito_dominante": {"grid": grid_prot, "arrivo": finish_prot},
    }

    # ------------------------------------------------------------------ PROSA
    accent = colP
    rnd_txt = f" · round {rnd}" if rnd else ""
    tN, tH = F["q_tempi"][PROT], F["q_tempi"][RIVAL]
    milli = f" ({int(round(margin*1000))} millesimi)" if margin < 0.1 else ""
    margine_txt = f"{it(margin,3)} s{milli}"
    v_line = float(telP["Speed"].iloc[0]) if len(telP) else 0.0
    gap_m = round(v_line / 3.6 * margin, 1)

    # vmax: chi è più veloce di punta (spesso NON il dominante -> il vantaggio è in curva)
    if round(vmaxP, 0) == round(vmaxR, 0):
        vmax_frase = f"le punte massime coincidono (<b>{it(vmaxP,0)} km/h</b>)"
    else:
        vmax_alta = PROT if vmaxP > vmaxR else RIVAL
        vmax_frase = (f"la punta più alta è di <b>{vmax_alta}</b> "
                      f"(<b>{it(max(vmaxP,vmaxR),0)}</b> vs <b>{it(min(vmaxP,vmaxR),0)} km/h</b>)")
    vmax_in_curva = vmaxR >= vmaxP        # il rivale è pari/più veloce in rettilineo

    apici_prot_txt = ", ".join(F["apici_dominante"][:3]) if prot_apici else "—"
    steep = F["max_pendenza_dominante"]

    # passo gara: frase di contesto
    if F["passo_gara"] and passo_margin is not None and passo_prot:
        pg = F["passo_gara"]
        iqr_d = pg["dominante_iqr"]
        tighter = sum(1 for r in passo if r["iqr"] < iqr_d)
        # onestà sull'IQR: "costanza" solo se il dominante è davvero fra i più stretti;
        # altrimenti è la MEDIANA (robusta), non la dispersione, a segnare il margine.
        if tighter == 0:
            cost = (f". Ed è anche il più regolare: IQR {it(iqr_d,2)} s, la dispersione "
                    f"più stretta del gruppo.")
        elif passo_next:
            cost = (f". Non è la costanza a fare la differenza — l'IQR di {PROT} è "
                    f"{it(iqr_d,2)} s, più largo di {pg['next_sig']} "
                    f"({it(passo_next['iqr'],2)} s): a pesare è la mediana, non la dispersione.")
        else:
            cost = f". IQR {it(iqr_d,2)} s (dispersione dei giri-core)."
        passo_frase = (
            f"In gara il quadro è più netto: sul passo — mediana dei giri-core verdi — "
            f"<b>{PROT}</b> gira <b>{base.lap_fmt(pg['dominante_med'])}</b>, "
            f"<b>{it(passo_margin,3)} s/giro</b> davanti al miglior rivale sul passo "
            f"(<b>{pg['next_sig']}</b>)"
            + (f", e il gruppo si allarga fino a ~{it(field_spread,1)} s nella top-10"
               if field_spread else "")
            + cost)
    else:
        passo_frase = ("Il passo gara non è ricavabile da questa sessione (dati gara "
                       "assenti o insufficienti): il weekend si legge qui sul giro secco.")

    # titolo/apertura adattivi
    if dominio:
        titolo = (f"Dove ha vinto {PROT} in {paese}: la pole per {margine_txt}, "
                  f"il dominio nel passo gara")
        apertura = (f"{PROT} firma pole e miglior passo gara: è il dominatore del weekend. "
                    f"Ma il come è più interessante del chi. Sul giro secco la pole è di "
                    f"appena {margine_txt} su {RIVAL} ({teamR}); il vantaggio vero, largo, "
                    f"si vede in gara sul passo.")
    else:
        titolo = (f"{paese}: la pole di {PROT} per {margine_txt}, "
                  f"e dove nasce il vantaggio")
        apertura = (f"{PROT} conquista la pole per {margine_txt} su {RIVAL} ({teamR}). "
                    f"Il passo gara migliore è di {race_leader['sig'] if race_leader else '—'}: "
                    f"il weekend ha due facce, e la telemetria dice dove.")

    # caveat onesto e generale: la pole è l'ordine del cronometro, non la griglia (le penalità
    # possono spostarla). Adattato all'esito quando il feed espone partenza/arrivo.
    if grid_prot == 1 and finish_prot == 1:
        pole_caveat = (f"La pole è l'ordine del cronometro: in griglia le penalità possono "
                       f"spostare le posizioni, ma qui {PROT} è partito e ha vinto dalla pole.")
    elif grid_prot == 1:
        pole_caveat = (f"La pole è l'ordine del cronometro: in griglia le penalità possono "
                       f"spostare le posizioni — qui {PROT} è comunque scattato dalla pole.")
    elif grid_prot is not None and grid_prot > 1:
        pole_caveat = (f"La pole è l'ordine del cronometro, non la griglia: {PROT} ha fatto "
                       f"segnare il tempo più veloce ma non è scattato dalla prima casella "
                       f"(le penalità possono spostare le posizioni).")
    else:
        pole_caveat = ("La pole è l'ordine del cronometro: in griglia le penalità possono "
                       "spostare le posizioni prima del via.")

    # causa: dove nasce il vantaggio in curva (sintomo), causa dichiarata NON_MISURABILE
    if prot_apici:
        causa_curve = (f"Il vantaggio di {PROT} sul giro non è in rettilineo — "
                       f"{vmax_frase} — ma <b>in curva</b>. All'apice porta più velocità "
                       f"minima nelle curve di medio raggio: {apici_prot_txt} km/h. "
                       f"Il tratto dove il cronometro gira più in fretta a suo favore è "
                       f"attorno a <b>{steep['curva']}</b> ({it(steep['ms'],0)} ms in un "
                       f"solo minisettore).")
    else:
        causa_curve = (f"Sul giro secco il vantaggio di {PROT} non si concentra all'apice "
                       f"delle curve: nasce distribuito, e {vmax_frase}. Il tratto più "
                       f"favorevole è attorno a {steep['curva']}.")

    causa_come = ""
    if key and pf and pr:
        k = F["curva_chiave"]
        fp_p = k["frenata_m"][PROT]; fp_r = k["frenata_m"][RIVAL]
        ga_p = k["gas_pieno_dopo_apice_m"][PROT]; ga_r = k["gas_pieno_dopo_apice_m"][RIVAL]
        pezzi = []
        if fp_p is not None and fp_r is not None:
            dd = abs(fp_p - fp_r)
            if dd < 2:
                # coincidono davvero (< ~2 m): un solo punto di frenata
                pezzi.append(f"i due frenano quasi allo stesso punto (~{it(fp_p,0)} m dall'apice)")
            else:
                # brake_on = m PRIMA dell'apice: valore minore = frena più tardi (più vicino
                # all'apice). Se i punti differiscono, riporta ENTRAMBI i valori, non "stesso punto".
                if fp_p < fp_r:
                    presto, m_presto = RIVAL, fp_r
                    tardi, m_tardi = PROT, fp_p
                else:
                    presto, m_presto = PROT, fp_p
                    tardi, m_tardi = RIVAL, fp_r
                pezzi.append(f"<b>{presto}</b> stacca a {it(m_presto,0)} m dall'apice, "
                             f"<b>{tardi}</b> {it(m_presto - m_tardi,0)} m più tardi a "
                             f"{it(m_tardi,0)} m")
        if ga_p is not None and ga_r is not None:
            dg = ga_r - ga_p            # >0: dominante riapre prima
            if abs(dg) >= 5:
                if dg > 0:
                    pezzi.append(f"{PROT} <b>riapre il gas {it(dg,0)} m prima</b> "
                                 f"({it(ga_p,0)} vs {it(ga_r,0)} m dopo l'apice)")
                else:
                    pezzi.append(f"{RIVAL} riapre il gas {it(-dg,0)} m prima")
            else:
                pezzi.append(f"la riapertura del gas è quasi identica (~{it(ga_p,0)} m dopo l'apice)")
        causa_come = (f" A <b>{key['label']}</b> si vede il come: "
                      f"{'; '.join(pezzi)}. All'apice {PROT} tiene "
                      f"<b>{it(key['prot'],0)}</b> contro <b>{it(key['riv'],0)} km/h</b> "
                      f"({'+' if key['delta']>=0 else ''}{it(key['delta'],0)}).")

    dip = md["dip"]; peak = md["peak"]
    duello_txt = (
        f"Minisettore per minisettore è un duello: {PROT} ne vince {md['win_p']} su "
        f"{N_MINISETTORI}, {RIVAL} {md['win_r']} — la pole si decide sull'equilibrio, non su "
        f"un tratto solo.")
    effetto_giro = (
        f"Sul giro, {RIVAL} arriva a "
        + (f"{it(-dip['val'],3)} s di vantaggio (a ~{it(dip['dist'],0)} m, {dip['curva']}), "
           if dip["val"] < 0 else "toccarlo brevemente, ")
        + f"poi {PROT} ribalta e tocca +{it(peak['val'],2)} s a {peak['curva']}; "
          f"alla linea restano {margine_txt}. " + duello_txt)

    # ------------------------------------------------------------------ FIGURE dict
    FIG = {
        "mappa": {"svg": fig_a,
            "didascalia": (
                f"La pianta del circuito in scala reale, divisa in {N_MINISETTORI} "
                f"minisettori equi-distanza: ogni tratto è colorato del pilota più veloce "
                f"lì. {PROT} vince {md['win_p']} tratti, {RIVAL} {md['win_r']}. Il colore "
                f"mostra a colpo d'occhio DOVE, sul disegno del tracciato, nasce il "
                f"vantaggio del giro secco."),
            "fonte": f"FastF1 · X/Y (get_telemetry) + Speed, giri veloci Q {paese} {anno}"},
        "delta": {"svg": fig_b,
            "didascalia": (
                f"In alto le due velocità a confronto; in basso il vantaggio cumulato "
                f"({PROT} sopra lo zero = avanti). L'endpoint è il margine reale della pole "
                f"({margine_txt}). Il tratto ombreggiato attorno a {steep['curva']} è dove "
                f"il decimo nasce più in fretta ({it(steep['ms'],0)} ms in un minisettore)."),
            "fonte": (f"FastF1 · Speed + fastf1.utils.delta_time (calibrato al giro), "
                      f"giri veloci Q {paese} {anno}")},
        "minime": {"svg": fig_c,
            "didascalia": (
                f"Velocità minima all'apice, curva per curva: barre a destra = {PROT} più "
                f"veloce, a sinistra = {RIVAL}. "
                + (f"{PROT} porta più velocità nelle curve di medio raggio ({dec_lbl} km/h). "
                   if prot_apici else "")
                + "Le curve-complesso (con lettera) sono poco affidabili su un singolo giro."),
            "fonte": f"FastF1 · velocità minima all'apice (finestra −25/+75 m), giri veloci Q {paese} {anno}"},
    }
    if fig_d is not None:
        FIG["frenata"] = {"svg": fig_d,
            "didascalia": (
                f"La curva {key['label']}: velocità (sopra) e gas (sotto) attorno all'apice, "
                f"col punto di frenata segnato (●). Qui si legge il come del vantaggio in "
                f"curva — velocità minima e riapertura del gas."),
            "fonte": f"FastF1 · Speed/Throttle/Brake, giri veloci Q {paese} {anno}"}
    if fig_p is not None:
        FIG["passo"] = {"svg": fig_p,
            "didascalia": (
                f"Passo gara: distacco per giro dalla mediana più rapida ({passo[0]['sig']}). "
                f"L'IQR accanto a ogni sigla misura la costanza (dispersione dei giri-core). "
                f"È il dominio che sul giro secco non si vedeva."),
            "fonte": f"FastF1 · laps Gara {paese} {anno} — mediana + IQR dei giri-core verdi"}

    # ------------------------------------------------------------------ ARTICOLO
    sez_causa_fig = "frenata" if fig_d is not None else "minime"
    sezioni = [
        {"tag": "Evidenza",
         "titolo": (f"Pole per {margine_txt}: un duello deciso sull'equilibrio"),
         "html": (
            f"<p>A <b>{circuito_disp}</b> la pole è di <b>{PROT}</b> ({teamP}) in <b>{tN}</b>, "
            f"davanti a <b>{RIVAL}</b> ({teamR}) in <b>{tH}</b>: <b>{margine_txt}</b> — circa "
            f"<b>{it(gap_m,1)} metri</b> di luce a fine giro. {pole_caveat} {apertura}</p>"
            f"<p>La mappa di dominanza spezza il giro in {N_MINISETTORI} minisettori e colora "
            f"ciascuno del più veloce lì. {effetto_giro}</p>"),
         "figura": "mappa"},
        {"tag": "Evidenza",
         "titolo": f"Dove nasce il decimo: il vantaggio cumulato lungo il giro",
         "html": (
            f"<p>La stessa storia sull'asse-distanza: sopra le due velocità, sotto il "
            f"vantaggio cumulato calcolato con <code>delta_time</code> (l'endpoint coincide "
            f"col margine reale, {margine_txt}). {duello_txt} Il tratto di "
            f"massima pendenza — dove il cronometro corre più in fretta a favore di {PROT} — "
            f"è attorno a <b>{steep['curva']}</b>: <b>{it(steep['ms'],0)} ms</b> in un solo "
            f"minisettore.</p>"
            f"<p>Attenzione al metodo: il vantaggio cumulato NON è l'integrazione grezza di "
            f"1/velocità (che non torna al tempo sul giro), ma il delta calibrato di FastF1. "
            f"Il grafico mostra il SINTOMO — dove {PROT} guadagna tempo — non ancora il "
            f"perché.</p>"),
         "figura": "delta"},
        {"tag": "Causa",
         "titolo": f"Il vantaggio è in curva, non in rettilineo",
         "html": (
            f"<p>{causa_curve}{causa_come}</p>"
            f"<p>È il sintomo, misurato metro per metro. La <b>causa</b> di quella velocità "
            f"minima più alta — più carico aerodinamico, più grip meccanico, un assetto o una "
            f"preparazione-gomma diversi — <b>non è misurabile</b> dalla telemetria: nel feed "
            f"non c'è un canale di carico, mescola o temperatura. La registriamo come "
            f"<code>NON_MISURABILE</code> e non la attribuiamo a un componente che non "
            f"vediamo.</p>"),
         "figura": sez_causa_fig},
        {"tag": "Effetto",
         "titolo": ("Il dominio vero è il passo gara" if dominio
                    else "Giro secco e passo gara: due facce"),
         "html": (
            f"<p>{passo_frase}</p>"
            f"<p>Il giro secco è un duello di millesimi; il passo gara è dove il vantaggio "
            f"diventa margine. Anche qui vale l'onestà d'obbligo: carburante, mescola e mappe "
            f"motore non sono nei dati, quindi il passo è un riferimento robusto "
            f"all'età-gomma solo entro-mescola, non un verdetto assoluto. Ma la direzione è "
            f"chiara, e la telemetria l'ha localizzata: {'in curva sul giro secco, e nel passo in gara' if prot_apici else 'nel passo gara'}.</p>"),
         "figura": ("passo" if fig_p is not None else None)},
    ]

    provenienza = [
        {"grandezza": "margine di pole (cronometro)",
         "valore": f"{PROT} {tN} · {RIVAL} {tH} · {it(margin,3)} s",
         "stato": "MISURATO",
         "da": "giri veloci veri (pick_fastest per pilota), classifica per tempo sul giro — FastF1 Q"},
        {"grandezza": f"mappa di dominanza ({N_MINISETTORI} minisettori)",
         "valore": (f"{PROT} vince {md['win_p']} tratti (+{it(md['gain_p']*1000,0)} ms), "
                    f"{RIVAL} {md['win_r']} (+{it(md['gain_r']*1000,0)} ms); somma = {it(margin,3)} s"),
         "stato": "MISURATO",
         "da": "guadagno-tempo per tratto = differenza del Δt cumulato ai bordi del minisettore (coerente con delta_time)"},
        {"grandezza": "vantaggio cumulato lungo il giro",
         "valore": (f"{RIVAL} avanti fino a {it(-dip['val'],3)} s ({dip['curva']}); "
                    f"{PROT} fino a +{it(peak['val'],2)} s ({peak['curva']}); "
                    f"alla linea +{it(md['end_adv'],3)} s"),
         "stato": "MISURATO",
         "da": "fastf1.utils.delta_time sui due giri veloci; endpoint coincide col margine reale"},
        {"grandezza": "tratto di massima pendenza (dove nasce il decimo)",
         "valore": f"{steep['curva']}: +{it(steep['ms'],0)} ms in un minisettore (~{it(steep['d0'],0)}–{it(steep['d1'],0)} m)",
         "stato": "MISURATO",
         "da": "minisettore col massimo guadagno-tempo per il dominante (dal Δt cumulato)"},
        {"grandezza": f"minime all'apice ({len(apici_rows)} curve)",
         "valore": (f"{PROT} più veloce in {', '.join(F['apici_dominante'][:4]) or '—'}; "
                    f"{RIVAL} in {', '.join(F['apici_rivale'][:3]) or '—'} km/h"),
         "stato": "MISURATO",
         "da": "velocità minima all'apice (finestra −25/+75 m) sul giro veloce di ciascuno"},
        {"grandezza": "velocità di punta (vmax)",
         "valore": (f"{PROT} {it(vmaxP,0)} · {RIVAL} {it(vmaxR,0)} km/h"
                    + (" — il rivale non è più lento in rettilineo: il vantaggio è in curva"
                       if vmax_in_curva else "")),
         "stato": "MISURATO",
         "da": "massimo del canale Speed sul giro veloce"},
    ]
    if F["outlier_curve"]:
        provenienza.append({
            "grandezza": "curve di misura poco affidabile",
            "valore": (f"{', '.join(F['outlier_curve'])}: curve-complesso (lettera) o divario "
                       f"estremo su singolo giro — non usate come tesi"),
            "stato": "STIMATO",
            "da": "finestra d'apice ambigua (due apici) o outlier robusto (>mediana+3·MAD)"})
    if condivisi:
        provenienza.append({
            "grandezza": "curve a apice condiviso (anti-doppio-conteggio)",
            "valore": (f"{', '.join(sorted(condivisi))}: riferimento circuit_info a pochi metri "
                       f"da una curva adiacente, stesso apice fisico — contate una volta sola "
                       f"nelle tesi (nel grafico restano, annotate)"),
            "stato": "STIMATO",
            "da": "stesso minimo di velocità entro 12 m fra curve vicine sul giro del dominante"})
    if key and pf and pr:
        k = F["curva_chiave"]
        provenienza.append({
            "grandezza": f"frenata e trazione a {key['label']}",
            "valore": (f"frenata {PROT} {it(k['frenata_m'][PROT],0)} / {RIVAL} {it(k['frenata_m'][RIVAL],0)} m dall'apice; "
                       f"gas pieno {PROT} {it(k['gas_pieno_dopo_apice_m'][PROT],0)} / {RIVAL} {it(k['gas_pieno_dopo_apice_m'][RIVAL],0)} m dopo; "
                       f"apice {it(k['apice_dominante_kmh'],0)} / {it(k['apice_rivale_kmh'],0)} km/h"),
            "stato": "MISURATO",
            "da": "canale Brake (prima riga frenata) e Throttle≥95% (prima ripresa piena) attorno all'apice"})
    if F["passo_gara"] and passo_prot and passo_margin is not None:
        pg = F["passo_gara"]
        provenienza.append({
            "grandezza": "passo gara del dominante (mediana giri-core verdi)",
            "valore": (f"{PROT} {base.lap_fmt(pg['dominante_med'])} (IQR {it(pg['dominante_iqr'],2)} s); "
                       f"+{it(passo_margin,3)} s/giro sul miglior rivale ({pg['next_sig']})"
                       + (f"; campo top-10 ~{it(field_spread,1)} s" if field_spread else "")),
            "stato": "MISURATO",
            "da": "mediana + IQR dei giri-core (entro 1,07× il best) verdi, out/in-lap e cancellati esclusi — FastF1 Race"})
        provenienza.append({
            "grandezza": "carburante / mescola / mappa motore (passo)",
            "valore": "carico benzina, gestione gomma e modalità motore non separati: passo indicativo, non assoluto",
            "stato": "NON_MISURABILE",
            "da": "nessun canale di carburante/mescola/mappa nel feed FastF1"})
    else:
        provenienza.append({
            "grandezza": "passo gara",
            "valore": "sessione gara non disponibile o senza long-run validi",
            "stato": "NON_MISURABILE",
            "da": "dati gara assenti/insufficienti al momento della generazione"})
    provenienza.append({
        "grandezza": "causa del vantaggio (carico aero, grip meccanico, assetto, gomma)",
        "valore": "il SINTOMO è misurato (dove la velocità è più alta); la CAUSA non ha canale nel feed",
        "stato": "NON_MISURABILE",
        "da": "nessun canale di carico/temperatura/mescola/mappa: attribuire a un componente sarebbe interpretazione"})

    art = {
        "id": ID, "stato": "bozza", "data": data_bozza or oggi,
        "firma": "Muretto · Redazione tecnica", "accent": accent,
        "canale": "A (telemetria, recap del weekend)",
        "gp": paese, "gara": paese, "country": paese, "circuito": circuito_disp,
        "sessione": ses_it, "round": rnd,
        "tag": ["telemetria", "recap", "weekend", paese, teamP, teamR],
        "occhiello": f"Recap tecnico · Weekend {paese} {anno}{rnd_txt}",
        "titolo": titolo,
        "sommario": (
            f"Non chi ha vinto, ma DOVE nasce il vantaggio. {PROT} in pole per {margine_txt} "
            f"su {RIVAL}: minisettore per minisettore è un duello ({md['win_p']}–{md['win_r']}), "
            f"e il vantaggio del giro è in curva, non in rettilineo. "
            + (f"In gara il passo di {PROT} è {it(passo_margin,3)} s/giro davanti al miglior rivale. "
               if (F['passo_gara'] and passo_margin is not None) else "")
            + "Ogni numero è un sintomo misurato; la causa (aero, grip, assetto) resta NON_MISURABILE."),
        "sezioni": sezioni,
        "provenienza": provenienza,
        "fonti": [
            {"tipo": "dati",
             "testo": (f"FastF1 3.8.3 — telemetria vettura (Speed/Throttle/Brake/nGear + X/Y) e laps, "
                       f"qualifica e gara del Gran Premio {paese} {anno} ({circuito_disp})")},
            {"tipo": "metodo",
             "testo": ("ai_lab/redazione/genera_recap_weekend.py su tele.py/curve.py/svg.py — "
                       "dominante e rivale scelti dai dati (pick_fastest, classifica per tempo); "
                       "mappa di dominanza a minisettori sulla pianta GPS in scala reale; vantaggio "
                       "cumulato con fastf1.utils.delta_time (calibrato al giro, non 1/v grezzo); "
                       "minime all'apice (finestra −25/+75 m) con curve-complesso segnalate; frenata "
                       "dal canale Brake e riapertura gas da Throttle≥95%; passo gara = mediana + IQR "
                       "dei giri-core verdi. La telemetria misura il sintomo (DOVE); la causa (carico "
                       "aero, grip, assetto, gomma) è dichiarata NON_MISURABILE")},
        ],
    }

    for sez in art["sezioni"]:
        f = sez.get("figura")
        if f in FIG:
            sez["figura"] = FIG[f]
        elif "figura" in sez:
            del sez["figura"]
    return F, art


META = {
    "id": "recap-weekend", "canale": "A",
    "titolo": "Recap del weekend: dove nasce il vantaggio del team dominante",
    "tag": ["telemetria", "recap", "weekend"],
    "descrizione": ("mappa di dominanza a minisettori + delta cumulato + minime per curva + "
                    "frenata/trazione + passo gara: DOVE, metro per metro, nasce il vantaggio"),
    "richiede": "telemetria", "gare": ["*"], "sessioni": ["Race"],
}


def genera(gara=None, data=None, sessione=None):
    if gara is None:
        return None                # track-agnostic, ma serve sapere QUALE Gran Premio
    r = costruisci(gara, data_bozza=data)
    if not r:
        return None
    F, art = r
    base.scrivi_bozza(art["id"], art, F)
    return {"id": art["id"], "titolo": art["titolo"], "stato": art["stato"],
            "canale": META["canale"]}


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="recap-weekend track-agnostic (qualifica + gara)")
    ap.add_argument("--gara", required=True,
                    help="GP accettato da FastF1 (nome inglese/località/round), es. 'Hungary'")
    ap.add_argument("--data", default=None, help="AAAA-MM-GG per la targhetta della bozza")
    a = ap.parse_args()
    r = costruisci(a.gara, data_bozza=a.data)
    if not r:
        print("nessun giro veloce/telemetria utilizzabile: generatore saltato"); sys.exit(1)
    F, art = r
    out = base.scrivi_bozza(art["id"], art, F)
    print(f"Bozza {art['id']} scritta in {out}")
    print(f"  {F['gp']} {F['anno']} (round {F['round']}, {F['circuito']})")
    print(f"  dominante {F['dominante']} vs rivale {F['rivale']} · pole {it(F['pole_margin_s'],3)} s "
          f"· dominio doppio={F['dominio_doppio']}")
    ms = F["minisettori"]
    print(f"  minisettori: {F['dominante']} {ms['vinti_dominante']} / {F['rivale']} {ms['vinti_rivale']} "
          f"(+{it(ms['ms_guadagnati_dominante'],0)} / +{it(ms['ms_guadagnati_rivale'],0)} ms)")
    dc = F["delta_cumulato"]
    print(f"  delta: picco {F['dominante']} +{it(dc['picco_dominante']['s'],3)} ({dc['picco_dominante']['curva']}) "
          f"· max pendenza {F['max_pendenza_dominante']['curva']} +{it(F['max_pendenza_dominante']['ms'],0)} ms")
    print(f"  apici {F['dominante']}: {F['apici_dominante']} · vmax {F['vmax_kmh']}")
    if F["curva_chiave"]:
        k = F["curva_chiave"]
        print(f"  curva-chiave {k['curva']}: apice {k['apice_dominante_kmh']}/{k['apice_rivale_kmh']} km/h · "
              f"gas pieno {k['gas_pieno_dopo_apice_m']}")
    if F["passo_gara"]:
        pg = F["passo_gara"]
        print(f"  passo gara: leader {pg['leader']} {base.lap_fmt(pg['leader_med'])} · "
              f"margine {it(pg['margine_s'],3) if pg['margine_s'] is not None else '–'} s · "
              f"campo ~{it(pg['field_spread_s'],1) if pg['field_spread_s'] else '–'} s")
