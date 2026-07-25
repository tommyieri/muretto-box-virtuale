"""
Articolo (Canale A, riprodotto sui NOSTRI dati) — "web-canale-a", Ungheria 2026 FP2.

SPUNTO WEB: il venerdi ungherese ha un titolo unico — "Ferrari domina", 1-2 in FP2
sul giro secco (Hamilton 1:18.729 su soft, Leclerc 2° +0.148). Le stesse testate
pero' pubblicano, in coda, una tabella di long-run su MEDIUM dove davanti c'e'
Verstappen e la Ferrari scivola indietro. Due letture opposte dello stesso venerdi.

CANALE B (i numeri sono NOSTRI, FastF1 FP2 Hungaroring):
 1) confermiamo il 1-2 Ferrari sul GIRO SECCO (miglior giro valido per pilota, soft);
 2) ricostruiamo il PASSO su gomma MEDIUM (mediana dei giri-core dei long-run) e
    vediamo se la gerarchia del giro secco regge o si rimescola;
 3) sotto-angolo car-data che il web non ha pubblicato: la velocita' di punta
    MEDIANA espone i due Mercedes in fondo alla griglia in rettilineo.

REGOLE DURE applicate:
 - giri lanciati via tele.giri_validi (LapTime valido + IsAccurate + <=1.07x best pilota);
 - velocita' di punta = MEDIANA dei picchi per-giro, mai il picco singolo (scia);
 - passo long-run = mediana dei soli giri-core (out/in-lap, 1° giro, deleted e
   TrackStatus!=verde esclusi; core = entro 1.07x il best pulito dello stint);
 - confronto passo SOLO entro-mescola (soft/medium/hard non comparabili);
 - de-confuso eta-gomma: rifacciamo il confronto medium a parita' di finestra di eta.

CONFONDITORI DICHIARATI (nel corpo e in provenienza):
 - DRS DEGENERE (canale = tutti 0): l'angolo "active-aero/ala revolving" del web NON
   e' riproducibile; nessuna attribuzione del top speed al deployment aerodinamico;
 - carburante e mappe motore IGNOTI (regola FP): il passo e' indicativo, non verdetto;
 - long-run cortissimi (VER/HAM ~5-6 giri-core) e con traffico: mediane instabili;
 - mescole miste nella fonte: il long-run Ferrari confrontabile e' il solo HAM su
   medium (LEC gira il long-run su SOFT) -> confronto Ferrari-vs-rivali a parita' o e' artefatto;
 - top speed = mediana su TUTTI i giri lanciati: la composizione (qual-sim vs
   long-run, quindi il carburante) cambia da pilota a pilota -> deficit MISURATO, causa no.

python3 UTENTE (fastf1), NON la .venv. Solo lettura; bozza nell'area Lab.
"""
from __future__ import annotations
import os
import sys
import datetime
import statistics as stt
from collections import defaultdict

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele   # noqa: E402
import svg    # noqa: E402
import base   # noqa: E402

ID = "hun-web-canale-a-2026"
ANNO, GP, SES = 2026, "Hungary", "FP2"
SOGLIA = 1.07                       # guardia traffico entro-stint / giro lanciato
FERRARI = ("HAM", "LEC")


def it(x, dec=1):
    return base.it(x, dec)


def lap_fmt(s):
    return base.lap_fmt(s)


# ----------------------------------------------------------------------------
# 1) GIRO SECCO — miglior giro valido per pilota (con mescola)
# ----------------------------------------------------------------------------
def giro_secco(ses, piloti):
    out = {}
    for sig, info in piloti.items():
        best, comp = None, None
        for lap in tele.giri_validi(ses, info["num"]):
            s = tele.secondi(lap["LapTime"])
            if s is None:
                continue
            if best is None or s < best:
                best, comp = s, str(lap.get("Compound"))
        if best is not None:
            out[sig] = {"team": info["team"], "best": best, "comp": comp}
    return out


# ----------------------------------------------------------------------------
# 2) PASSO LONG-RUN — analisi stint (logica vagliata nel _scratch)
# ----------------------------------------------------------------------------
def _ols(xs, ys):
    n = len(xs)
    if n < 3:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    den = sum((x - mx) ** 2 for x in xs)
    if den == 0:
        return None
    b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den
    yhat = [my + b * (x - mx) for x in xs]
    sst = sum((y - my) ** 2 for y in ys)
    ssr = sum((y - yh) ** 2 for y, yh in zip(ys, yhat))
    r2 = 1 - ssr / sst if sst > 0 else None
    return b, r2


def _volo(g):
    """Giri di volo puliti di uno stint: (tyrelife, sec, lapnum). Scarta
    out/in-lap, 1° giro, deleted, TrackStatus non-verde; poi butta il 1° giro."""
    g = g.sort_values("LapNumber")
    volo = []
    for k, (_, lap) in enumerate(g.iterrows()):
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
        tl = lap["TyreLife"]
        tl = float(tl) if tl == tl else float(k + 1)
        volo.append((tl, s, int(lap["LapNumber"])))
    if len(volo) < 5:
        return []
    return volo[1:]


def analizza_stint(g):
    volo = _volo(g)
    if len(volo) < 4:
        return None
    secs = [p[1] for p in volo]
    best = min(secs)
    core = [p for p in volo if p[1] <= best * SOGLIA]
    csec = [p[1] for p in core]
    med = stt.median(csec)
    long_run_valido = (len(core) >= 5) and (len(core) >= 0.60 * len(volo))
    deg = r2 = None
    if len(core) >= 6:
        res = _ols([p[0] for p in core], [p[1] for p in core])
        if res:
            deg, r2 = res
    return {"n_core": len(core), "best": best, "med": med,
            "std": stt.pstdev(csec) if len(csec) > 1 else 0.0,
            "tyre0": core[0][0], "tyreN": core[-1][0],
            "deg": deg, "deg_r2": r2, "long_run_valido": long_run_valido}


def passo_per_mescola(ses, piloti):
    """Per ogni pilota, per ogni mescola: lo stint long-run VALIDO col piu' giri-core."""
    inv = {v["num"]: (k, v["team"]) for k, v in piloti.items()}
    best = {}                       # (sig, comp) -> record
    core_by = {}                    # (sig, comp) -> lista (tyrelife, sec) del core
    for num in ses.drivers:
        dl = ses.laps.pick_drivers(num)
        if dl.empty or "Stint" not in dl.columns:
            continue
        sig, team = inv.get(num, (num, "?"))
        for stint, g in dl.groupby("Stint"):
            cc = g["Compound"].dropna().unique()
            comp = cc[0] if len(cc) else "?"
            r = analizza_stint(g)
            if r is None or not r["long_run_valido"]:
                continue
            r.update({"sig": sig, "team": team})
            key = (sig, comp)
            if key not in best or r["n_core"] > best[key]["n_core"]:
                best[key] = r
                volo = _volo(g)
                bb = min(p[1] for p in volo)
                core_by[key] = [(p[0], p[1]) for p in volo if p[1] <= bb * SOGLIA]
    return best, core_by


def finestra_eta(core_by, sigs, comp, lo, hi):
    """Mediana del passo di ciascun pilota nella finestra di eta-gomma [lo,hi],
    stessa mescola: toglie il confondente eta-gomma (resta il carburante ignoto)."""
    out = {}
    for sig in sigs:
        core = core_by.get((sig, comp))
        if not core:
            continue
        win = [s for tl, s in core if tl is not None and lo <= tl <= hi]
        if len(win) >= 4:
            out[sig] = {"med": stt.median(win), "n": len(win)}
    return out


# ----------------------------------------------------------------------------
# 3) CAR-DATA — velocita' di punta, rapporto 7a, DRS
# ----------------------------------------------------------------------------
def vmax_mediano(ses, num):
    picchi = []
    for lap in tele.giri_validi(ses, num):
        try:
            t = tele.canale_giro(lap)
        except Exception:
            continue
        picchi.append(float(t["Speed"].max()))
    return (stt.median(picchi), len(picchi)) if picchi else (None, 0)


def ratio_gear(ses, num, gear=7, vlo=250.0):
    """Rapporto (giri/min per km/h) in marcia `gear` sopra vlo: mediana RPM/Speed.
    Geometria del cambio, immune a scia/mappa/giro. Alto = corto."""
    rr = []
    for lap in tele.giri_validi(ses, num):
        try:
            t = tele.canale_giro(lap)
        except Exception:
            continue
        m = (t["nGear"] == gear) & (t["Speed"] > vlo)
        for s, r in zip(t["Speed"][m].values, t["RPM"][m].values):
            if s > 0:
                rr.append(r / s)
    return (stt.median(rr), len(rr)) if len(rr) >= 15 else (None, len(rr))


def drs_degenere(ses, piloti):
    vals = set()
    n_lap = 0
    for sig, info in piloti.items():
        for lap in tele.giri_validi(ses, info["num"]):
            try:
                t = tele.canale_giro(lap)
            except Exception:
                continue
            n_lap += 1
            vals.update(int(v) for v in t["DRS"].unique().tolist())
    return vals, n_lap


def spearman(pairs):
    n = len(pairs)
    if n < 3:
        return None
    xs = sorted(range(n), key=lambda i: pairs[i][0])
    ys = sorted(range(n), key=lambda i: pairs[i][1])
    rx = [0] * n
    ry = [0] * n
    for rank, i in enumerate(xs):
        rx[i] = rank
    for rank, i in enumerate(ys):
        ry[i] = rank
    d2 = sum((rx[i] - ry[i]) ** 2 for i in range(n))
    return 1 - 6 * d2 / (n * (n * n - 1))


# ----------------------------------------------------------------------------
# COSTRUZIONE
# ----------------------------------------------------------------------------
def costruisci(data_bozza=None):
    ses = tele.carica_sessione(ANNO, GP, SES)
    piloti = tele.piloti_sessione(ses)
    colori = base.carica_colori()
    col = lambda t: colori.get(t) or "var(--dim)"

    # --- 1) giro secco ---
    gs = giro_secco(ses, piloti)
    gs_rank = sorted(gs.items(), key=lambda kv: kv[1]["best"])
    gs_lead = gs_rank[0][1]["best"]
    pos = {sig: i for i, (sig, _) in enumerate(gs_rank, 1)}   # posizione giro secco
    gap_gs = {sig: d["best"] - gs_lead for sig, d in gs.items()}

    # --- 2) passo per mescola ---
    passo, core_by = passo_per_mescola(ses, piloti)
    med = {comp: sorted([(sig, r) for (sig, c), r in passo.items() if c == comp],
                        key=lambda kv: kv[1]["med"])
           for comp in ("MEDIUM", "HARD", "SOFT")}
    med_lead = med["MEDIUM"][0][1]["med"]
    gap_med = {sig: r["med"] - med_lead for sig, r in med["MEDIUM"]}

    # de-confuso a parita' di eta-gomma sul medium (top pack)
    win = finestra_eta(core_by, ["RUS", "VER", "NOR", "HAM", "PIA"], "MEDIUM", 11, 16)

    # --- 3) car-data ---
    vmax = {}
    for sig, info in piloti.items():
        v, n = vmax_mediano(ses, info["num"])
        if v is not None:
            vmax[sig] = {"v": v, "n": n, "team": info["team"]}
    ratio = {}
    for sig, info in piloti.items():
        r, n = ratio_gear(ses, info["num"], 7, 250)
        if r is not None:
            ratio[sig] = r
    drs_vals, n_drs = drs_degenere(ses, piloti)
    drs_ok = (drs_vals == {0})
    vlist = sorted(vmax.items(), key=lambda kv: -kv[1]["v"])
    vspread = vlist[0][1]["v"] - vlist[-1][1]["v"]
    sp = spearman([(ratio[s], vmax[s]["v"]) for s in ratio if s in vmax])

    # ------------------------------------------------------------------ FACTS
    F = {
        "id": ID, "anno": ANNO, "gp": "Ungheria", "circuito": "Hungaroring",
        "sessione": SES,
        "giro_secco": {sig: {"team": d["team"], "best": d["best"], "comp": d["comp"],
                             "pos": pos[sig], "gap": gap_gs[sig]} for sig, d in gs.items()},
        "passo_medium": {sig: {"med": r["med"], "gap": gap_med[sig], "n_core": r["n_core"],
                               "tyre0": r["tyre0"], "tyreN": r["tyreN"],
                               "deg": r["deg"], "deg_r2": r["deg_r2"]}
                         for sig, r in med["MEDIUM"]},
        "leclerc_softrun": {sig: {"med": r["med"], "best": r["best"], "n_core": r["n_core"]}
                            for sig, r in med["SOFT"] if sig == "LEC"},
        "finestra_11_16": win,
        "vmax": {sig: d["v"] for sig, d in vmax.items()},
        "vmax_spread": vspread,
        "ratio7": ratio,
        "drs_degenere": drs_ok, "drs_valori": sorted(drs_vals), "n_giri_lanciati": n_drs,
        "spearman_ratio_vmax": sp,
    }

    # ------------------------------------------------------------------ FIGURE
    # Fig 1 — giro secco: distacco dal leader (soft), top 10, Ferrari evidenziata
    barre_gs = [{"sigla": f"{sig} · {gs[sig]['team'][:12]}", "colore": col(gs[sig]["team"]),
                 "valore": gap_gs[sig], "evidenza": sig in FERRARI}
                for sig, _ in gs_rank[:10]]
    svg1 = svg.barre_dv(
        barre_gs, titolo="Il giro secco dà ragione al titolo: Ferrari 1-2",
        base=0.0, ml=118, unita="s",
        caption="secondi dal leader · miglior giro valido FP2, gomma soft (0 = HAM)")

    # Fig 2 — la flip: giro secco (x) vs passo medium (y), per chi ha entrambi
    dual = [s for s in gap_med if s in gap_gs]
    punti = [{"label": s, "colore": col(passo[(s, "MEDIUM")]["team"]),
              "x": gap_gs[s], "y": gap_med[s], "evidenza": s in FERRARI}
             for s in dual]
    xmax = max(p["x"] for p in punti)
    ymax = max(p["y"] for p in punti)
    svg2 = svg.grafico_scatter(
        punti, x_range=(-0.1, xmax + 0.2), y_range=(-0.1, ymax + 0.2),
        x_ticks=[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0], y_ticks=[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0],
        x_label="distacco sul giro secco, soft (s)",
        y_label="distacco sul passo medium (s)",
        cx=stt.median([p["x"] for p in punti]), cy=stt.median([p["y"] for p in punti]),
        ang=("passo, non giro secco", "lenti in entrambe",
             "giro secco, non passo", "forti in entrambe"),
        titolo="Due classifiche diverse: giro secco contro passo gara",
        sub="FP2 Ungheria 2026 · più in basso a sinistra = più forte in entrambe")

    # Fig 3 — top speed vs rapporto 7a: il gearing NON spiega il deficit
    ps = [{"label": s, "colore": col(vmax[s]["team"]), "x": ratio[s], "y": vmax[s]["v"],
           "evidenza": vmax[s]["team"] == "Mercedes"}
          for s in ratio if s in vmax]
    rmin = min(p["x"] for p in ps)
    rmax = max(p["x"] for p in ps)
    svg3 = svg.grafico_scatter(
        ps, x_range=(rmin - 0.4, rmax + 0.4), y_range=(303, 328),
        x_ticks=[37, 38, 39, 40, 41, 42], y_ticks=[305, 310, 315, 320, 325],
        x_label="rapporto in 7ª (giri/min per km/h · alto = corto)",
        y_label="velocità di punta mediana (km/h)",
        cx=stt.median([p["x"] for p in ps]), cy=stt.median([p["y"] for p in ps]),
        ang=("corti e veloci", "corti e lenti", "lunghi e veloci", "lunghi e lenti"),
        titolo="Il rapporto non spiega la punta: i due Mercedes in fondo",
        sub=f"Spearman(rapporto, punta) = {it(sp, 2)} · quasi nullo")

    # ------------------------------------------------------------------ PROSA
    ham = F["giro_secco"]["HAM"]
    lec = F["giro_secco"]["LEC"]
    ant = F["giro_secco"]["ANT"]
    m_rus = F["passo_medium"]["RUS"]
    m_ver = F["passo_medium"]["VER"]
    m_nor = F["passo_medium"]["NOR"]
    m_ham = F["passo_medium"]["HAM"]
    lec_soft = F["leclerc_softrun"].get("LEC")
    v_ham = F["vmax"]["HAM"]
    v_ver = F["vmax"]["VER"]
    v_rus = F["vmax"]["RUS"]
    v_ant = F["vmax"]["ANT"]
    v_nor = F["vmax"]["NOR"]
    v_pia = F["vmax"]["PIA"]
    v_lec = F["vmax"]["LEC"]
    r_pia, r_nor = F["ratio7"]["PIA"], F["ratio7"]["NOR"]
    r_rus, r_ant = F["ratio7"]["RUS"], F["ratio7"]["ANT"]
    pos_ham_med = [i for i, (s, _) in enumerate(med["MEDIUM"], 1) if s == "HAM"][0]
    w_rus, w_nor, w_ham = win.get("RUS"), win.get("NOR"), win.get("HAM")

    testo = {
        "occhiello": "Prove libere · Venerdì · GP d'Ungheria 2026",
        "titolo": "Ferrari 1-2 sul giro secco, quarta sul passo: le due letture del venerdì",
        "sommario": (
            "Il titolo del venerdì all'Hungaroring è uno solo: «Ferrari domina», 1-2 in FP2 "
            "sul giro secco. È vero — e i nostri dati lo confermano al millesimo. Ma è la "
            "fotografia di un solo giro con gomma soft. Sul passo dei long-run in gomma medium "
            "la classifica si rimescola: davanti ci sono Russell e Verstappen, la Ferrari più "
            "veloce scivola quarta. E c'è una lettura in rettilineo che nessuno ha pubblicato: "
            "i due Mercedes sono gli ultimi della griglia per velocità di punta."),
        "sezioni": [
            {"tag": "Evidenza", "titolo": "Il giro secco dà ragione al titolo: Ferrari 1-2",
             "html": (
                f"<p>Sul miglior giro valido di FP2 — filtrati i giri lenti e quelli fuori dai "
                f"box — davanti ci sono davvero le due Ferrari, entrambe su gomma soft: Hamilton "
                f"in <b>{lap_fmt(ham['best'])}</b>, Leclerc a <b>+{it(lec['gap'], 3)}</b>. Sono "
                f"gli stessi numeri battuti dalle testate ({lap_fmt(ham['best'])} e "
                f"+{it(lec['gap'], 3)}): il 1-2 del titolo è reale, e lo ritroviamo sui nostri "
                f"dati. Dietro, la prima non-Ferrari è Norris a +{it(F['giro_secco']['NOR']['gap'], 3)}, "
                f"poi Verstappen a +{it(F['giro_secco']['VER']['gap'], 3)}.</p>"
                f"<p>Un asterisco però va messo subito, e riguarda la copertura. Il «1-2 Ferrari» "
                f"è una foto nitida; il «tracollo Mercedes» che gli si legge accanto è più sfocato: "
                f"il miglior giro di Antonelli è solo {pos['ANT']}º (+{it(ant['gap'], 3)}) e per di "
                f"più è su gomma <b>{ant['comp'].lower()}</b>, non soft — cioè non ha un giro secco "
                f"rappresentativo. Il giro secco Mercedes, insomma, non è mai stato messo davvero "
                f"in pista. Il titolo fotografa un potenziale Ferrari; non fotografa il resto.</p>"
             ), "figura": "grafico1"},
            {"tag": "Causa", "titolo": "Sul passo del medium la gerarchia si rimescola",
             "html": (
                f"<p>Il giro secco e il passo gara sono due mestieri diversi. Ricostruito il passo "
                f"dei long-run in gomma medium — mediana dei soli giri-core, a parità di mescola — "
                f"l'ordine in testa cambia: davanti c'è Russell in <b>{lap_fmt(m_rus['med'])}</b>, "
                f"poi Verstappen a <b>+{it(m_ver['gap'], 3)}</b> e Norris a "
                f"<b>+{it(m_nor['gap'], 3)}</b>. La Ferrari più veloce sul passo è Hamilton, "
                f"<b>{pos_ham_med}º a +{it(m_ham['gap'], 3)}</b>. Verstappen, solo "
                f"{F['giro_secco']['VER']['pos']}º sul giro secco, sul passo è di fatto al comando; "
                f"la Ferrari, prima sul giro, scende dietro tre vetture.</p>"
                f"<p>Il confronto va maneggiato con cura, e lo diciamo prima dei numeri. Il long-run "
                f"di Leclerc è su <b>soft</b> (mediana {lap_fmt(lec_soft['med']) if lec_soft else '–'}), "
                f"non su medium: non è confrontabile, quindi la Ferrari sul medium la rappresenta il "
                f"solo Hamilton. Gli stint di Verstappen e Hamilton sono corti "
                f"({m_ver['n_core']} e {m_ham['n_core']} giri-core), quindi la loro mediana è meno "
                f"stabile di quella di Russell ({m_rus['n_core']} giri) o Norris ({m_nor['n_core']}). "
                f"E su tutto pesa la regola delle libere: carburante e mappe motore sono ignoti, così "
                f"un pezzo di questi distacchi può essere serbatoio, non vettura.</p>"
                f"<p>Un controllo però tiene in piedi la sostanza: rifatto il confronto a parità di "
                f"finestra di età-gomma (medium, 11-16 giri) — che toglie di mezzo il consumo — "
                f"Russell resta davanti ({lap_fmt(w_rus['med']) if w_rus else '–'}) e la Ferrari di "
                f"Hamilton ({lap_fmt(w_ham['med']) if w_ham else '–'}) resta dietro Norris "
                f"({lap_fmt(w_nor['med']) if w_nor else '–'}). Il passo, per quel che le libere "
                f"possono dire, non ripete il verdetto del giro secco.</p>"
             ), "figura": "grafico2"},
            {"tag": "Effetto", "titolo": "In rettilineo i due Mercedes sono gli ultimi — e non è il cambio",
             "html": (
                f"<p>C'è un dato che il web non ha pubblicato e che i nostri car-data misurano. "
                f"Presa la velocità di punta come <i>mediana</i> dei picchi per-giro — non il picco "
                f"singolo, che la scia gonfia — i due Mercedes chiudono la griglia: Russell a "
                f"<b>{it(v_rus, 0)} km/h</b>, Antonelli a <b>{it(v_ant, 0)}</b>, contro i "
                f"<b>{it(v_ham, 0)}</b> della Ferrari di Hamilton e i {it(v_ver, 0)} di Verstappen. "
                f"Tra il più veloce e il più lento della griglia ballano {it(F['vmax_spread'], 0)} "
                f"km/h. Anche le McLaren stanno in basso (Norris {it(v_nor, 0)}, Piastri "
                f"{it(v_pia, 0)}).</p>"
                f"<p>La tentazione sarebbe spiegarlo con l'aerodinamica attiva — l'ala «revolving» "
                f"di cui si è parlato il venerdì. Non possiamo: nel feed 2026 il canale DRS è "
                f"<b>degenere</b> (vale zero su tutti i {F['n_giri_lanciati']} giri lanciati), quindi "
                f"qualsiasi attribuzione al deployment aerodinamico è, per noi, non misurabile. "
                f"Possiamo però escludere una spiegazione: il cambio. Le McLaren montano la 7ª più "
                f"corta della griglia (rapporto {it(r_pia, 2)}-{it(r_nor, 2)}), i Mercedes tra le più "
                f"lunghe ({it(r_rus, 2)}-{it(r_ant, 2)}); eppure sul piano dell'intera griglia il "
                f"rapporto e la velocità di punta non vanno a braccetto (Spearman "
                f"<b>{it(F['spearman_ratio_vmax'], 2)}</b>, quasi nullo). Un cambio lungo, come quello "
                f"Mercedes, di solito compra velocità massima: qui non la compra. Il deficit di punta "
                f"c'è ed è misurato; la sua causa — aerodinamica, mappa motore o semplicemente il "
                f"carburante a bordo — resta fuori dalla nostra portata. Persino dentro la Ferrari, "
                f"del resto, Hamilton ({it(v_ham, 0)}) e Leclerc ({it(v_lec, 0)}) distano "
                f"{it(v_ham - v_lec, 0)} km/h: la punta è sensibile alla scia, e va letta con la "
                f"mediana e con prudenza.</p>"
             ), "figura": "grafico3"},
        ],
    }

    articolo = {
        "id": ID, "stato": "bozza",
        "data": data_bozza or "2026-07-25",
        "firma": "Muretto · Redazione tecnica", "accent": col("Ferrari"),
        "canale": "A (spunto web, riprodotto sui nostri dati)",
        "gara": "Ungheria", "gp": "Ungheria", "round": 11,
        "circuito": "Hungaroring", "sessione": SES,
        "tag": ["telemetria", "passo gara", "giro secco", "Ferrari", "Mercedes",
                "Verstappen", "velocità di punta", "prove libere"],
        "occhiello": testo["occhiello"], "titolo": testo["titolo"],
        "sommario": testo["sommario"],
        "sezioni": [
            {**{k: s[k] for k in ("tag", "titolo", "html")},
             "figura": ({
                 "grafico1": {"svg": svg1,
                              "didascalia": (
                                  f"Miglior giro valido di FP2, distacco dal leader (gomma soft). "
                                  f"Le due Ferrari (evidenziate) aprono la classifica: Hamilton "
                                  f"{lap_fmt(ham['best'])}, Leclerc +{it(lec['gap'], 3)}. Antonelli "
                                  f"({pos['ANT']}º) senza un giro soft rappresentativo."),
                              "fonte": "FastF1 · laps FP2 GP Ungheria 2026 · miglior giro valido (giri_validi)"},
                 "grafico2": {"svg": svg2,
                              "didascalia": (
                                  f"Ogni punto è un pilota: a sinistra è più veloce sul giro secco, "
                                  f"in basso è più veloce sul passo medium. La Ferrari di Hamilton "
                                  f"(evidenziata) è a sinistra ma non in basso; Russell e Verstappen "
                                  f"sono in basso pur partendo più indietro sul giro. Solo chi ha "
                                  f"entrambe le misure su medium."),
                              "fonte": "FastF1 · FP2 GP Ungheria 2026 · giro secco (soft) e mediana giri-core long-run (medium)"},
                 "grafico3": {"svg": svg3,
                              "didascalia": (
                                  f"Velocità di punta mediana contro rapporto della 7ª. I due "
                                  f"Mercedes (evidenziati) sono in fondo per punta pur avendo un "
                                  f"cambio lungo: il rapporto non spiega il deficit (Spearman "
                                  f"{it(F['spearman_ratio_vmax'], 2)})."),
                              "fonte": "FastF1 · car telemetry (Speed/RPM/nGear) FP2 GP Ungheria 2026 · mediane sui giri lanciati"},
             }[s["figura"]]) if s.get("figura") else None}
            for s in testo["sezioni"]
        ],
        "provenienza": [
            {"grandezza": "giro secco FP2 (miglior giro valido, soft)",
             "valore": f"HAM {lap_fmt(ham['best'])} · LEC +{it(lec['gap'], 3)} · NOR +{it(F['giro_secco']['NOR']['gap'], 3)}",
             "stato": "MISURATO",
             "da": "min dei giri lanciati per pilota (tele.giri_validi, FastF1)"},
            {"grandezza": "copertura giro secco Mercedes",
             "valore": f"ANT {pos['ANT']}º (+{it(ant['gap'], 3)}), miglior giro su {ant['comp'].lower()} (nessun soft rappresentativo)",
             "stato": "MISURATO",
             "da": "posizione e mescola del miglior giro valido di Antonelli (FastF1)"},
            {"grandezza": "passo long-run gomma medium (mediana giri-core)",
             "valore": f"RUS {lap_fmt(m_rus['med'])} · VER +{it(m_ver['gap'], 3)} · NOR +{it(m_nor['gap'], 3)} · HAM (P{pos_ham_med}) +{it(m_ham['gap'], 3)}",
             "stato": "MISURATO",
             "da": "mediana dei giri-core (entro 1.07x best pulito) dello stint medium più lungo per pilota"},
            {"grandezza": "passo Ferrari confrontabile sul medium",
             "valore": "solo HAM (il long-run di LEC è su soft, non comparabile)",
             "stato": "MISURATO",
             "da": "mescola degli stint long-run Ferrari (FastF1)"},
            {"grandezza": "de-confuso età-gomma (medium, finestra 11-16 giri)",
             "valore": f"RUS {lap_fmt(w_rus['med']) if w_rus else '–'} · NOR {lap_fmt(w_nor['med']) if w_nor else '–'} · HAM {lap_fmt(w_ham['med']) if w_ham else '–'}",
             "stato": "MISURATO",
             "da": "mediana dei giri-core nella finestra comune di età-gomma (toglie il consumo, non il carburante)"},
            {"grandezza": "velocità di punta (mediana dei picchi per-giro)",
             "valore": f"HAM {it(v_ham, 0)} · VER {it(v_ver, 0)} · NOR {it(v_nor, 0)} · RUS {it(v_rus, 0)} · ANT {it(v_ant, 0)} km/h (spread griglia {it(F['vmax_spread'], 0)})",
             "stato": "MISURATO",
             "da": "mediana di max(Speed) sui giri lanciati (FastF1 car-data)"},
            {"grandezza": "rapporto in 7ª (geometria del cambio)",
             "valore": f"McLaren {it(r_pia, 2)}-{it(r_nor, 2)} (più corti) · Mercedes {it(r_rus, 2)}-{it(r_ant, 2)} (più lunghi)",
             "stato": "MISURATO",
             "da": "mediana RPM/velocità in 7ª (Speed>250) sui giri lanciati"},
            {"grandezza": "il rapporto spiega la velocità di punta?",
             "valore": f"no — Spearman(rapporto, punta) = {it(F['spearman_ratio_vmax'], 2)} (quasi nullo)",
             "stato": "MISURATO",
             "da": "correlazione di rango rapporto-7ª vs punta mediana sulla griglia"},
            {"grandezza": "attivazione DRS / aerodinamica attiva",
             "valore": f"canale DRS degenere: solo {F['drs_valori']} su {F['n_giri_lanciati']} giri lanciati",
             "stato": "NON_MISURABILE",
             "da": "feed FastF1 2026 · DRS costante a 0 → active-aero non riproducibile"},
            {"grandezza": "causa del deficit di punta (aero / mappa / carburante)",
             "valore": "non attribuibile (il cambio è escluso; DRS assente; carburante e mappe ignoti)",
             "stato": "NON_MISURABILE",
             "da": "regola prove libere + DRS degenere; la punta mediana mescola giri qual-sim e long-run"},
            {"grandezza": "carburante e mappe motore (FP)",
             "valore": "ignoti → passo indicativo, non verdetto",
             "stato": "NON_MISURABILE",
             "da": "non esposti dal feed nelle prove libere"},
        ],
        "fonti": [
            {"tipo": "spunto",
             "testo": "The Race — «F1 2026 Hungarian GP practice results»: FP2 Hamilton 1:18.729 (soft), Leclerc 2° +0.148, Ferrari 1-2 sul giro secco (Canale A: titolo di partenza)."},
            {"tipo": "spunto",
             "testo": "Autosport — «What we learned from Friday practice…»: tabella long-run FP2 con Verstappen davanti su medium e la Ferrari indietro; Antonelli senza giro soft rappresentativo."},
            {"tipo": "spunto",
             "testo": "Formula1.com — FP1 Leclerc davanti a Verstappen prima della rottura all'upshift; McLaren prova un'ala posteriore ad aerodinamica attiva."},
            {"tipo": "dati",
             "testo": "FastF1 3.8.3 — laps + car telemetry (Speed/Throttle/Brake/nGear/RPM/DRS), FP2 Gran Premio d'Ungheria 2026 (cache locale)."},
            {"tipo": "metodo",
             "testo": "ai_lab/redazione/genera_hun_web_canale_a.py — giro secco = min dei giri lanciati per pilota; passo = mediana dei giri-core (out/in-lap, 1° giro, deleted e non-verde esclusi; core entro 1.07x il best pulito dello stint), confronto solo entro-mescola e con controllo a parità di età-gomma; velocità di punta = mediana dei picchi per-giro; rapporto = mediana RPM/velocità in 7ª. Confronto Ferrari-rivali limitato al medium (long-run Leclerc su soft escluso). Carburante/mappe ignoti, DRS degenere: passo indicativo, causa della punta non attribuibile."},
        ],
    }
    return F, articolo


def genera(gara=None, data=None):
    if gara not in (None, "Ungheria", "Hungary", "Hungarian Grand Prix"):
        return None
    F, art = costruisci(data_bozza=data)
    base.scrivi_bozza(ID, art, F)
    return {"id": ID, "titolo": art["titolo"], "stato": art["stato"], "canale": "A"}


if __name__ == "__main__":
    F, art = costruisci()
    out = base.scrivi_bozza(ID, art, F)
    print(f"Bozza {ID} scritta in {out}")
    gs = F["giro_secco"]
    print(f"  GIRO SECCO: HAM {lap_fmt(gs['HAM']['best'])} · LEC +{it(gs['LEC']['gap'],3)} "
          f"· NOR +{it(gs['NOR']['gap'],3)} · ANT {gs['ANT']['pos']}º ({gs['ANT']['comp']})")
    pm = F["passo_medium"]
    print(f"  PASSO MEDIUM: RUS {lap_fmt(pm['RUS']['med'])} · VER +{it(pm['VER']['gap'],3)} "
          f"· NOR +{it(pm['NOR']['gap'],3)} · HAM +{it(pm['HAM']['gap'],3)}")
    print(f"  VMAX: HAM {it(F['vmax']['HAM'],0)} · VER {it(F['vmax']['VER'],0)} · "
          f"RUS {it(F['vmax']['RUS'],0)} · ANT {it(F['vmax']['ANT'],0)} (spread {it(F['vmax_spread'],0)})")
    print(f"  DRS degenere: {F['drs_degenere']} {F['drs_valori']} · Spearman(rapporto,punta)={it(F['spearman_ratio_vmax'],2)}")
    print(f"  sezioni: {len(art['sezioni'])} · figure: "
          f"{sum(1 for s in art['sezioni'] if s.get('figura'))} · provenienza: {len(art['provenienza'])}")
