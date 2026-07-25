"""
Bozza "quali-pole" @ Hungaroring 2026 — Qualifiche (ROUND 11).

Angolo (ribaltamento): Hamilton è più veloce in DUE settori su tre — e la pole va
a Norris per DODICI millesimi. Il cronometro della qualifica si decide tutto nel
settore centrale (S2), il complesso lento T4→T11 dove la McLaren di Norris porta
più velocità minima; Hamilton recupera nel primo e nell'ultimo settore, ma i 0,209 s
guadagnati in S1+S3 non bastano contro i 0,221 s persi in S2. Saldo: 0,012 s.

Numero-chiave: 0,012 s (dodici millesimi).

CAVEAT OBBLIGATORI rispettati nel testo:
 - QUALI != GRIGLIA: sono i tempi della qualifica (la lotta per la pole). Sulla
   griglia Hamilton scala a P5 (−3 per impeding su Piastri alla curva 1) e Antonelli
   a P7 (−3 per non aver rallentato sotto le gialle). Norris resta P1.
 - niente energia/ERS/deployment/batteria (canali assenti nel 2026): mai citati.
 - H2H Norris–Hamilton è PULITO (il giro di Hamilton non è compromesso, a differenza
   di quello di Piastri, abortito per l'impeding di Hamilton alla curva 1). Il
   contesto di sessione (Hamilton davanti dopo i primi lanciati, non migliora; giro
   decisivo di Norris prima di due gialle tardive) è cronaca, dichiarato come tale.
 - i delta di settore sono i NOSTRI numeri (quali_Ungheria.json), non voci esterne.
 - sessione asciutta: nessun meteo inventato.

Misura dal grezzo FastF1 (giri veloci veri di NOR e HAM), overlay Speed vs Distance,
minime per curva sulle 16 curve, delta per settore dai tempi ufficiali; traccia del
vantaggio cumulato via fastf1.utils.delta_time. Grafici con svg.py.
python3 UTENTE (fastf1). Solo lettura; bozza in ai_lab/redazione/bozze/ (mai demo/).
"""
from __future__ import annotations
import os
import sys
import json
import datetime

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele   # noqa: E402
import curve  # noqa: E402
import svg    # noqa: E402
import base   # noqa: E402

ID = "hun-quali-pole-2026"
ANNO, GP, SES = 2026, "Hungary", "Q"
ROUND = 11
PROT, RIVALE = "NOR", "HAM"          # protagonista (pole) vs rivale (2º sul cronometro)
QUALI_JSON = os.path.join(base.REPO, "demo", "data", "quali_Ungheria.json")


def it(x, dec=1):
    return base.it(x, dec)


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


def costruisci(data_bozza=None):
    import numpy as np
    from fastf1.utils import delta_time

    # --- settori UFFICIALI dal nostro file (fonte canonica dei delta di settore) ---
    qj = json.load(open(QUALI_JSON))
    pj = {p["sigla"]: p for p in qj["piloti"]}
    secN = [_sec(s["t"]) for s in pj[PROT]["sectors"]]
    secH = [_sec(s["t"]) for s in pj[RIVALE]["sectors"]]
    dS = [round(secN[i] - secH[i], 3) for i in range(3)]     # NOR − HAM per settore
    best_flag = {  # bandiere "best assoluto" del nostro file (o = overall best)
        PROT: [s.get("best") for s in pj[PROT]["sectors"]],
        RIVALE: [s.get("best") for s in pj[RIVALE]["sectors"]],
    }
    bestN, bestH = _sec(pj[PROT]["best"]), _sec(pj[RIVALE]["best"])
    pole_margin = round(bestH - bestN, 3)                    # 0,012 (HAM più lento)
    recupero = round(dS[0] + dS[2], 3)                       # quanto HAM recupera in S1+S3

    # --- sessione FastF1 (grezzo): giri veloci veri ---
    ses = tele.carica_sessione(ANNO, GP, SES)
    piloti = tele.piloti_sessione(ses)
    colori = base.carica_colori()
    colN = colori.get(piloti[PROT]["team"]) or piloti[PROT]["colore"] or "var(--accent)"
    colH = colori.get(piloti[RIVALE]["team"]) or piloti[RIVALE]["colore"] or "var(--dim)"

    lapN = ses.laps.pick_drivers(piloti[PROT]["num"]).pick_fastest()
    lapH = ses.laps.pick_drivers(piloti[RIVALE]["num"]).pick_fastest()
    telN = tele.canale_giro(lapN)
    telH = tele.canale_giro(lapH)
    dist_max = float(min(telN["Distance"].max(), telH["Distance"].max()))
    vmaxN = float(telN["Speed"].max())
    vmaxH = float(telH["Speed"].max())
    v_lineN = float(telN["Speed"].iloc[0])                   # velocità in transito sulla linea
    gap_m = v_lineN / 3.6 * pole_margin                      # spazio-luce dei 12 ms (stima)

    # --- confine dei settori in METRI (dal giro veloce del protagonista) ---
    sessN = telN["SessionTime"].dt.total_seconds().values
    distN = telN["Distance"].values
    t0 = lapN["LapStartTime"].total_seconds()
    d_s1 = float(np.interp(lapN["Sector1SessionTime"].total_seconds(), sessN, distN))
    d_s2 = float(np.interp(lapN["Sector2SessionTime"].total_seconds(), sessN, distN))

    # --- minime per curva sulle 16 curve (giro veloce di ciascuno) ---
    cs = curve.curve(ses)
    corner_rows = []
    for c in cs:
        lab = f"T{c['numero']}{c['lettera']}"
        aN = curve._apice(telN, c["dist"])
        aH = curve._apice(telH, c["dist"])
        if aN and aH:
            corner_rows.append({
                "label": lab, "dist": c["dist"], "numero": c["numero"],
                "nor": round(aN["speed"], 0), "ham": round(aH["speed"], 0),
                "delta": round(aN["speed"] - aH["speed"], 0),
                "sett": 1 if c["dist"] < d_s1 else (2 if c["dist"] < d_s2 else 3),
            })
    corner_rows.sort(key=lambda r: r["dist"])
    OUTLIER = "T12A"                                          # finestra chicane: singolo giro poco affidabile
    s2_gain = [r for r in corner_rows if r["sett"] == 2 and r["delta"] > 0]
    s2_best = max(s2_gain, key=lambda r: r["delta"]) if s2_gain else None
    s2_curve = [r for r in corner_rows if r["sett"] == 2]

    # --- traccia del vantaggio cumulato (fastf1: positivo = NOR avanti) ---
    dt, ref, _ = delta_time(lapN, lapH)
    dt = np.array(dt, dtype=float)
    dref = ref["Distance"].values
    trace = _downsample(list(zip((float(x) for x in dref), (float(y) for y in dt))), 150)
    end_adv = round(float(np.interp(dist_max, dref, dt)), 3)  # ~ +0,012
    i_lo = int(dt.argmin()); i_hi = int(dt.argmax())
    dip = {"dist": float(dref[i_lo]), "val": float(dt[i_lo])}     # max vantaggio HAM (S1)
    peak = {"dist": float(dref[i_hi]), "val": float(dt[i_hi])}    # max vantaggio NOR (fine S2)

    # ===================== FIGURA-EROE: dove si è vinta la pole =====================
    serieV = [
        {"sigla": PROT, "colore": colN, "punti": _downsample(
            list(zip((float(x) for x in telN["Distance"].values),
                     (float(v) for v in telN["Speed"].values))), 150)},
        {"sigla": RIVALE, "colore": colH, "punti": _downsample(
            list(zip((float(x) for x in telH["Distance"].values),
                     (float(v) for v in telH["Speed"].values))), 150)},
    ]
    settori = [
        {"d0": 0.0, "d1": d_s1, "colore": colH,
         "testo": f"S1 · {RIVALE} {it(dS[0],3)}"},
        {"d0": d_s1, "d1": d_s2, "colore": colN,
         "testo": f"S2 · {PROT} {it(-dS[1],3)}"},
        {"d0": d_s2, "d1": dist_max, "colore": colH,
         "testo": f"S3 · {RIVALE} {it(dS[2],3)}"},
    ]
    corners = [{"label": r["label"], "dist": r["dist"]} for r in corner_rows]
    svg1 = svg.grafico_pole(
        serieV, trace, corners, settori, dist_max=dist_max, v_range=(50, 350),
        titolo="Dove si è vinta la pole: tutto nel settore 2",
        sub=f"velocità dei due giri veloci + vantaggio cumulato · Qualifica Ungheria {ANNO}",
        endpoint_txt=f"pole {PROT} {it(pole_margin,3)} s",
        picco={"dist": peak["dist"], "val": peak["val"],
               "txt": f"max {it(peak['val'],2)} (fine S2)"},
        avvallamento={"dist": dip["dist"], "val": dip["val"],
                      "txt": f"{RIVALE} avanti {it(dip['val'],3)} (S1)"})

    # ===================== FIGURA 2: minime per curva (dove si guadagna velocità) ==
    righe2 = [{"label": r["label"], "valore": r["delta"],
               "nota": f"{it(r['nor'],0)}/{it(r['ham'],0)}"
                       + (" chicane" if r["label"] == OUTLIER else "")}
              for r in corner_rows]
    svg2 = svg.barre_divergenti(
        righe2, col_pos=colN, col_neg=colH,
        lbl_pos=f"{PROT} più veloce", lbl_neg=f"{RIVALE} più veloce",
        titolo="Minime per curva: chi porta più velocità, dove",
        sub=f"velocità all’apice · giri veloci · Qualifica Ungheria {ANNO}",
        caption=("km/h all’apice (NOR/HAM a destra). Le curve lente del settore 2 (T6/T7 +7) "
                 "sono dove Norris fa la pole; T12A è finestra-chicane, poco affidabile su un giro"))

    # ===================== FIGURA 3: T6/T7, la curva della pole (Speed + gas) ======
    # il complesso lento dove NOR costruisce il vantaggio: overlay velocità + gas
    c67 = next(c for c in cs if c["numero"] == 6)
    tN67 = curve.traccia_gas(ses, piloti[PROT]["num"], c67["dist"])
    tH67 = curve.traccia_gas(ses, piloti[RIVALE]["num"], c67["dist"])
    serie3 = [{"sigla": PROT, "colore": colN, "tratteggio": False, "marker": None, "punti": tN67},
              {"sigla": RIVALE, "colore": colH, "tratteggio": True, "marker": None, "punti": tH67}]
    allv3 = [p[1] for s in serie3 for p in s["punti"]]
    v3lo = max(0, int(min(allv3) // 50 * 50))
    v3hi = int(max(allv3) // 50 * 50 + 50)
    svg3 = svg.grafico_gas_curva(
        serie3, v_range=(v3lo, v3hi),
        apex_txt="apice T6/T7 (complesso lento, cuore del settore 2)",
        titolo=f"T6/T7: il complesso lento dove {PROT} porta più velocità",
        sub=f"velocità + gas attorno all’apice · giri veloci · Qualifica Ungheria {ANNO}")

    # ===================================== FACTS ==================================
    F = {
        "id": ID, "anno": ANNO, "gara": "Ungheria", "circuito": "Hungaroring",
        "sessione": "Qualifiche", "round": ROUND,
        "protagonista": PROT, "rivale": RIVALE,
        "team": {PROT: piloti[PROT]["team"], RIVALE: piloti[RIVALE]["team"]},
        "tempi": {PROT: pj[PROT]["best"], RIVALE: pj[RIVALE]["best"]},
        "pole_margin_s": pole_margin,
        "settori_s": {PROT: [round(x, 3) for x in secN], RIVALE: [round(x, 3) for x in secH]},
        "delta_settore_nor_meno_ham": dS,       # +=HAM più veloce, −=NOR più veloce
        "vincitore_settore": ["HAM" if d > 0 else "NOR" for d in dS],
        "best_flag": best_flag,
        "recupero_ham_s1_s3_s": recupero,
        "perdita_ham_s2_s": round(-dS[1], 3),
        "confine_settori_m": {"S1_fine": round(d_s1, 0), "S2_fine": round(d_s2, 0),
                              "giro": round(dist_max, 0)},
        "vmax_kmh": {PROT: round(vmaxN, 0), RIVALE: round(vmaxH, 0)},
        "v_linea_nor_kmh": round(v_lineN, 0), "gap_luce_m": round(gap_m, 2),
        "traccia_vantaggio": {"fine_s": end_adv,
                              "max_nor": {"dist_m": round(peak["dist"], 0), "val_s": round(peak["val"], 3)},
                              "max_ham": {"dist_m": round(dip["dist"], 0), "val_s": round(dip["val"], 3)}},
        "minime_curva": [{"curva": r["label"], "nor": r["nor"], "ham": r["ham"],
                          "delta_nor_meno_ham": r["delta"], "settore": r["sett"]}
                         for r in corner_rows],
        "s2_curve_a_nor": [r["label"] for r in s2_gain],
        "s2_best": {"curva": s2_best["label"], "delta": s2_best["delta"]} if s2_best else None,
        "outlier_misura": OUTLIER,
        "n_curve": len(corner_rows),
    }

    # ===================================== PROSA ==================================
    tN, tH = pj[PROT]["best"], pj[RIVALE]["best"]
    s2_lista = ", ".join(f"{r['label']} +{it(r['delta'],0)}" for r in s2_gain)
    accent = colN

    FIG = {
        "eroe": {"svg": svg1,
            "didascalia": (
                f"Due giri quasi gemelli in velocità (in alto): la differenza si legge nel pannello del "
                f"vantaggio cumulato (in basso). {RIVALE} scava fino a {it(-dip['val'],3)} s nel settore 1; "
                f"nel settore 2 {PROT} ribalta tutto e arriva a +{it(peak['val'],2)} s a fine complesso lento; "
                f"nel settore 3 {RIVALE} rimonta, ma resta {it(pole_margin,3)} s corto. Il saldo, sulla linea, "
                f"è la pole di {PROT}."),
            "fonte": (f"FastF1 · car telemetry (Speed) + fastf1.utils.delta_time; delta di settore dai tempi "
                      f"ufficiali (quali_Ungheria.json), Qualifica Ungheria {ANNO}")},
        "minime": {"svg": svg2,
            "didascalia": (
                f"Velocità all’apice curva per curva: barre a destra = {PROT} più veloce, a sinistra = "
                f"{RIVALE} più veloce. Nel settore 2 {PROT} porta più velocità nelle curve lente "
                f"({s2_lista} km/h); {RIVALE} risponde in fondo al giro. T12A (chicane) è una finestra di misura "
                f"poco affidabile su un singolo giro."),
            "fonte": f"FastF1 · velocità minima all’apice (finestra −25/+75 m), giri veloci, Qualifica Ungheria {ANNO}"},
        "t67": {"svg": svg3,
            "didascalia": (
                f"Il complesso lento T6/T7, cuore del settore 2: {PROT} (linea piena) tiene una velocità minima "
                f"più alta di {RIVALE} (tratteggio). È qui, dove la McLaren ruota meglio, che nascono i "
                f"{it(-dS[1],3)} s del settore centrale."),
            "fonte": f"FastF1 · car telemetry (Speed/Throttle), giri veloci, Qualifica Ungheria {ANNO}"},
    }

    art = {
        "id": ID, "stato": "bozza", "data": data_bozza or "2026-07-26",
        "firma": "Muretto · Redazione tecnica", "accent": accent,
        "canale": "A (telemetria, giro di qualifica)",
        "gara": "Ungheria", "circuito": "Hungaroring", "sessione": "Qualifiche",
        "gp": "Ungheria", "round": ROUND, "data_evento": "2026-07-25",
        "tag": ["telemetria", "qualifica", "pole", piloti[PROT]["team"], piloti[RIVALE]["team"]],
        "occhiello": f"Telemetria · Qualifica Ungheria {ANNO}",
        "titolo": (f"Hamilton più veloce in due settori su tre. E la pole va a Norris per "
                   f"dodici millesimi"),
        "sommario": (
            f"Norris {tN}, Hamilton {tH}: {it(pole_margin,3)} secondi. Ma il cronometro racconta un "
            f"ribaltamento — Hamilton è più veloce nel primo settore ({it(dS[0],3)} s) e nel terzo "
            f"({it(dS[2],3)} s), e recupera in tutto {it(recupero,3)} s. Norris se li riprende, e di più, "
            f"nel solo settore centrale: {it(-dS[1],3)} s nel complesso lento T4→T11, il settore 2 più veloce "
            f"di tutta la sessione. Attenzione: sono i tempi della qualifica, non la griglia — per un impeding "
            f"su Piastri alla curva 1 Hamilton scatterà da P5."),
        "sezioni": [
            {"tag": "Evidenza", "titolo": "Dodici millesimi, e due settori vanno all’altro",
             "html": (
                f"<p>La pole dell’Hungaroring è di <b>{PROT}</b> in <b>{tN}</b>, davanti a <b>{RIVALE}</b> in "
                f"<b>{tH}</b>: <b>{it(pole_margin,3)} secondi</b>, dodici millesimi. Alla velocità con cui si "
                f"transita sul traguardo (~{it(F['v_linea_nor_kmh'],0)} km/h) sono circa "
                f"<b>{it(gap_m,1)} metri</b> di luce — una frazione della lunghezza di una vettura.</p>"
                f"<p>Ma il margine finale nasconde un ribaltamento. Spacchettando i tre settori (tempi ufficiali): "
                f"nel <b>settore 1</b> è più veloce {RIVALE} di <b>{it(dS[0],3)} s</b>; nel <b>settore 3</b> "
                f"di nuovo {RIVALE}, di <b>{it(dS[2],3)} s</b>. In due settori su tre comanda {RIVALE}, che "
                f"mette insieme <b>{it(recupero,3)} s</b> di vantaggio. Il conto però lo chiude il <b>settore 2</b>: "
                f"lì {PROT} è più rapido di <b>{it(-dS[1],3)} s</b> — il miglior settore 2 di tutta la qualifica — "
                f"e si riprende tutto, con dodici millesimi d’avanzo. Il pannello del vantaggio cumulato lo mostra "
                f"a colpo d’occhio: {RIVALE} davanti fino a metà giro, poi la curva s’impenna nel settore centrale "
                f"e non torna più sotto la linea dello zero.</p>"),
             "figura": "eroe"},
            {"tag": "Causa", "titolo": "Il settore 2 è il complesso lento: lì la McLaren porta più velocità",
             "html": (
                f"<p>Perché proprio il settore 2? Perché è il cuore lento del giro: il complesso <b>T4→T11</b>, "
                f"un susseguirsi di curve di media e bassa velocità dove non conta la potenza in fondo al rettilineo "
                f"ma quanta velocità minima si riesce a portare dentro la curva. E lì, apice per apice, la McLaren "
                f"di {PROT} porta di più: nelle curve lente del settore guadagna <b>{s2_lista} km/h</b> "
                f"sull’apice. Il complesso <b>T6/T7</b> è l’emblema — {PROT} vi tiene circa "
                f"<b>{it(F['s2_best']['delta'],0)} km/h</b> in più di velocità minima.</p>"
                f"<p>Il quadro si ribalta dove il giro torna veloce. Nel settore 1 e nel 3 — rettilinei, trazione "
                f"in uscita, la velocità di punta — risponde {RIVALE}, che segna anche la punta massima più alta "
                f"(<b>{it(vmaxH,0)}</b> contro <b>{it(vmaxN,0)} km/h</b>). Due macchine con due indoli: una che "
                f"brilla nel lento e tortuoso, l’altra nel veloce. Il Hungaroring, fatto in gran parte di curve "
                f"lente, premia la prima — di dodici millesimi.</p>"),
             "figura": "minime"},
            {"tag": "Effetto", "titolo": "È il cronometro, non la griglia: Hamilton parte quinto",
             "html": (
                f"<p>Un avvertimento che cambia la lettura della domenica: questi sono i tempi della "
                f"<b>qualifica</b> — la lotta per la pole al cronometro — <b>non la griglia di partenza</b>. "
                f"{RIVALE}, secondo sul giro secco, è stato penalizzato di tre posizioni per un <i>impeding</i> "
                f"(intralcio) su Piastri alla curva 1 e scatterà da <b>P5</b>; Antonelli, quarto sul cronometro, "
                f"perde tre posizioni per non aver rallentato sotto le bandiere gialle e partirà da <b>P7</b>. "
                f"{PROT} resta in pole, P1.</p>"
                f"<p>Il confronto {PROT}–{RIVALE} sul cronometro è però pulito: entrambi hanno completato il loro "
                f"giro migliore senza traffico né errori (a differenza di Piastri, il cui giro è stato abortito "
                f"proprio dall’intralcio alla curva 1: non una collisione, un giro perso). Per la cronaca — e la "
                f"diamo come cronaca, non come nostro dato — {RIVALE} era davanti dopo i primi lanciati del Q3 e non "
                f"ha migliorato; {PROT} ha trovato il tempo prima di due gialle tardive. Dice {PROT}: «very happy to "
                f"be back on top. A tough, tough Quali» (dichiarazione a F1.com).</p>"
                f"<p>Dodici millesimi, un solo settore: una pole così stretta si spiega tutta nel cuore lento "
                f"dell’Hungaroring. Il grafico qui sotto isola quella curva — il complesso <b>T6/T7</b>, dove "
                f"{PROT} porta qualche km/h di velocità minima in più: è lì, in una manciata di metri, che hanno "
                f"preso forma i dodici millesimi. Sul cronometro. Sulla griglia, la prima fila non sarà "
                f"{PROT}–{RIVALE}.</p>"),
             "figura": "t67"},
        ],
        "provenienza": [
            {"grandezza": "margine di pole (cronometro)",
             "valore": f"{PROT} {tN} · {RIVALE} {tH} · {it(pole_margin,3)} s",
             "stato": "MISURATO",
             "da": "tempi ufficiali della qualifica (demo/data/quali_Ungheria.json); best FastF1 identici"},
            {"grandezza": "delta per settore (NOR − HAM)",
             "valore": (f"S1 {it(dS[0],3)} (HAM) · S2 {it(dS[1],3)} (NOR) · S3 {it(dS[2],3)} (HAM); "
                        f"HAM recupera {it(recupero,3)} in S1+S3, NOR ne prende {it(-dS[1],3)} nel solo S2"),
             "stato": "MISURATO",
             "da": "tempi di settore ufficiali (quali_Ungheria.json); S2 di NOR e S1/S3 di HAM sono i migliori assoluti della sessione"},
            {"grandezza": "traccia del vantaggio cumulato lungo il giro",
             "valore": (f"HAM avanti fino a {it(-dip['val'],3)} s (a ~{it(dip['dist'],0)} m, S1); "
                        f"NOR fino a +{it(peak['val'],2)} s (a ~{it(peak['dist'],0)} m, fine S2); "
                        f"alla linea +{it(end_adv,3)} s"),
             "stato": "MISURATO",
             "da": "fastf1.utils.delta_time sui due giri veloci (interpolazione tempo-su-distanza); endpoint coerente col margine ufficiale"},
            {"grandezza": "confine dei settori in metri",
             "valore": f"S1 fino a ~{it(d_s1,0)} m · S2 ~{it(d_s1,0)}–{it(d_s2,0)} m · S3 fino a ~{it(dist_max,0)} m",
             "stato": "MISURATO",
             "da": "Sector1/2SessionTime del giro veloce di NOR mappati su Distance della telemetria"},
            {"grandezza": "minime per curva (16 curve, giri veloci)",
             "valore": (f"nel settore 2 NOR più veloce in {', '.join(F['s2_curve_a_nor'])}; "
                        f"T6/T7 +{it(F['s2_best']['delta'],0)} km/h a NOR; HAM risponde in S3"),
             "stato": "MISURATO",
             "da": "velocità minima all’apice (finestra −25/+75 m attorno al riferimento circuit_info) sul giro veloce di ciascuno"},
            {"grandezza": f"minima a {OUTLIER} (chicane)",
             "valore": "differenza ampia ma su singolo giro nella finestra della chicane: poco affidabile, non usata come tesi",
             "stato": "STIMATO",
             "da": "finestra d’apice ambigua alla chicane; segnalata come outlier di misura (come nell’analisi FP1)"},
            {"grandezza": "velocità di punta e spazio-luce dei 12 ms",
             "valore": (f"vmax NOR {it(vmaxN,0)} · HAM {it(vmaxH,0)} km/h; "
                        f"{it(pole_margin,3)} s a ~{it(v_lineN,0)} km/h ≈ {it(gap_m,2)} m"),
             "stato": "STIMATO",
             "da": "vmax dal canale Speed (MISURATO); spazio-luce = velocità in transito × margine (prodotto, non misura diretta)"},
            {"grandezza": "griglia di partenza (penalità)",
             "valore": "HAM −3 (impeding su Piastri, T1) → P5; ANT −3 (gialle) → P7; NOR resta P1",
             "stato": "NON_MISURABILE",
             "da": "decisioni dei commissari di gara — cronaca esterna, non ricavabile dalla telemetria; qui per non confondere quali e griglia"},
            {"grandezza": "carico aerodinamico, gomma (mescola/età/temperatura), mappe motore",
             "valore": "senza canale nel feed: l’attribuzione car/pilota del divario di carattere resta interpretazione",
             "stato": "NON_MISURABILE",
             "da": "nessun canale di carico, temperatura o mescola nella telemetria; è la lettura fisica, non una misura"},
        ],
        "fonti": [
            {"tipo": "dati",
             "testo": (f"FastF1 3.8.3 — telemetria vettura (Speed/Throttle/Brake/nGear/RPM) + circuit_info, "
                       f"Qualifica Gran Premio d’Ungheria {ANNO} (Hungaroring); tempi di settore ufficiali da "
                       f"demo/data/quali_Ungheria.json (best FastF1 e file coincidono: NOR {tN}, HAM {tH})")},
            {"tipo": "metodo",
             "testo": (f"ai_lab/redazione/genera_hun_quali_pole_2026.py su tele.py/curve.py/svg.py — overlay "
                       f"Speed-vs-Distance dei giri veloci di NOR e HAM; vantaggio cumulato con "
                       f"fastf1.utils.delta_time; delta di settore dai tempi ufficiali; minime per curva = "
                       f"velocità minima all’apice (finestra −25/+75 m) sulle 16 curve; T12A segnalata come "
                       f"outlier di misura della chicane. Confronto pulito (nessun giro compromesso); "
                       f"quali≠griglia dichiarato")},
            {"tipo": "cronaca",
             "testo": ("Contesto di sessione (Hamilton davanti dopo i primi lanciati del Q3, poi non migliora; "
                       "giro decisivo di Norris prima di due gialle tardive) e dichiarazione di Norris: fonte "
                       "F1.com — riportati come cronaca, non come misura della redazione")},
        ],
    }

    for sez in art["sezioni"]:
        if sez.get("figura") in FIG:
            sez["figura"] = FIG[sez["figura"]]
        elif "figura" in sez:
            del sez["figura"]
    return F, art


def genera(gara=None, data=None):
    if gara not in (None, "Ungheria", "Hungary", "Hungarian Grand Prix"):
        return None
    F, art = costruisci(data_bozza=data)
    base.scrivi_bozza(ID, art, F)
    return {"id": ID, "titolo": art["titolo"], "stato": art["stato"], "canale": "A"}


META = {
    "id": ID, "canale": "A",
    "titolo": "Dove si è vinta la pole all’Hungaroring (Norris–Hamilton, 12 millesimi)",
    "tag": ["telemetria", "qualifica", "pole"],
    "descrizione": "overlay Speed-vs-Distance + vantaggio cumulato + minime per curva: la pole si decide nel settore 2",
    "richiede": "telemetria", "gare": ["Ungheria"],
}


if __name__ == "__main__":
    F, art = costruisci()
    out = base.scrivi_bozza(ID, art, F)
    dS = F["delta_settore_nor_meno_ham"]
    print(f"Bozza {ID} scritta in {out}")
    print(f"  pole {F['protagonista']} {F['tempi'][F['protagonista']]} vs "
          f"{F['rivale']} {F['tempi'][F['rivale']]} = {it(F['pole_margin_s'],3)} s")
    print(f"  settori NOR−HAM: S1 {it(dS[0],3)} (HAM) · S2 {it(dS[1],3)} (NOR) · S3 {it(dS[2],3)} (HAM)")
    print(f"  HAM recupera {it(F['recupero_ham_s1_s3_s'],3)} in S1+S3; NOR prende {it(F['perdita_ham_s2_s'],3)} nel S2")
    print(f"  traccia: HAM max {it(F['traccia_vantaggio']['max_ham']['val_s'],3)} @"
          f"{it(F['traccia_vantaggio']['max_ham']['dist_m'],0)}m · "
          f"NOR max +{it(F['traccia_vantaggio']['max_nor']['val_s'],2)} @"
          f"{it(F['traccia_vantaggio']['max_nor']['dist_m'],0)}m · fine +{it(F['traccia_vantaggio']['fine_s'],3)}")
    print(f"  S2 curve a NOR: {F['s2_curve_a_nor']} · T6/7 best +{F['s2_best']['delta']} km/h")
    print(f"  vmax NOR {F['vmax_kmh']['NOR']} HAM {F['vmax_kmh']['HAM']} · 12ms ≈ {it(F['gap_luce_m'],2)} m")
    print(f"  {F['n_curve']} curve misurate")
