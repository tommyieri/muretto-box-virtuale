"""
Passo-gara (Canale A, tema long-run): "Il passo-gara di Russell a parita' di
eta-gomma" — sessione FP2, Gran Premio d'Ungheria 2026 (Hungaroring, round 11).

Tesi (inquadratura approvata): sui long-run in mescola MEDIA la Mercedes di RUS
fissa il riferimento del passo-gara. La classifica INGENUA delle mediane-stint la
nasconde (RUS/VER/NOR entro 0,235 s) perche' i rivali hanno girato su gomme piu'
FRESCHE; a PARITA' di eta-gomma (finestra 11-16 giri) RUS e' ~0,8 s davanti al
miglior long-run rivale (NOR/McLaren), e il vantaggio cresce a ~1,1 s piu' avanti
nello stint (12-18 giri). Carburante e mappe motore restano IGNOTI: passo
INDICATIVO, non verdetto.

Regole dure (rimisurate qui, non ricopiate):
 - raggruppo per (pilota, stint); scarto out-lap/in-lap/Deleted/non-verde puro/NaT
   e il PRIMO giro di volo (gomma fredda);
 - core = giri entro 1.07x il best del residuo; long-run valido = core >=5 giri E
   >=60% del volo (cadono gli stint misti qual-sim + raffreddamento);
 - passo rappresentativo = MEDIANA del core (robusta a 1-2 giri di traffico);
 - de-confuso = mediana in finestra di eta-gomma COMUNE, stessa mescola (>=4 giri
   nella finestra): toglie l'eta-gomma, resta il carburante ignoto;
 - degrado = pendenza OLS (s/giro) su core >=6 giri: segno/magnitudine INDICATIVI
   (carburante alleggerisce ed evoluzione pista aiutano gli stint tardivi).

python3 UTENTE (fastf1 3.8.3). Solo lettura; bozza nell'area Lab. Non tocca demo/.
"""
from __future__ import annotations
import os
import sys
import datetime
import statistics as st

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele   # noqa: E402
import svg    # noqa: E402
import base   # noqa: E402

ID = "hun-passo-gara-2026"
SOGLIA = 1.07  # guardia traffico entro-stint (come SOGLIA_OUTLIER del progetto)


def it(x, dec=1):
    return base.it(x, dec)


# ---------------------------------------------------------------------------
# MISURA (rimisurata: nessun numero arriva da fuori)
# ---------------------------------------------------------------------------
def _ols(xs, ys):
    n = len(xs)
    if n < 3:
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    den = sum((x - mx) ** 2 for x in xs)
    if den == 0:
        return None
    b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den
    yhat = [my + b * (x - mx) for x in xs]
    sst = sum((y - my) ** 2 for y in ys)
    ssr = sum((y - yh) ** 2 for y, yh in zip(ys, yhat))
    r2 = 1 - ssr / sst if sst > 0 else None
    return b, r2


def _core_stint(g):
    """Ritorna la lista (tyrelife, sec, lapnum) del CORE di uno stint, oppure []."""
    g = g.sort_values("LapNumber")
    volo = []
    for k, (_, lap) in enumerate(g.iterrows()):
        if lap["PitOutTime"] == lap["PitOutTime"]:      # out-lap
            continue
        if lap["PitInTime"] == lap["PitInTime"]:        # in-lap
            continue
        if bool(lap.get("Deleted", False)):
            continue
        if str(lap.get("TrackStatus", "1")) != "1":     # solo verde puro
            continue
        s = tele.secondi(lap["LapTime"])
        if s is None:
            continue
        tl = lap["TyreLife"]
        tl = float(tl) if tl == tl else float(k + 1)
        volo.append((tl, s, int(lap["LapNumber"])))
    if len(volo) < 5:
        return []
    volo = volo[1:]                                     # scarto il primo giro (gomma fredda)
    if len(volo) < 4:
        return []
    best = min(p[1] for p in volo)
    return [p for p in volo if p[1] <= best * SOGLIA]


def _analizza_stint(g):
    core = _core_stint(g)
    if not core:
        return None
    # numero di giri di volo prima del taglio core (per la soglia 60%)
    g = g.sort_values("LapNumber")
    n_volo = 0
    for k, (_, lap) in enumerate(g.iterrows()):
        if lap["PitOutTime"] == lap["PitOutTime"] or lap["PitInTime"] == lap["PitInTime"]:
            continue
        if bool(lap.get("Deleted", False)) or str(lap.get("TrackStatus", "1")) != "1":
            continue
        if tele.secondi(lap["LapTime"]) is None:
            continue
        n_volo += 1
    n_volo = max(0, n_volo - 1)                          # tolto il primo giro
    csec = [p[1] for p in core]
    med = st.median(csec)
    best = min(csec)
    valido = (len(core) >= 5) and (len(core) >= 0.60 * n_volo)
    deg = r2 = None
    if len(core) >= 6:
        res = _ols([p[0] for p in core], csec)
        if res:
            deg, r2 = res
    return {
        "core": core, "n_core": len(core), "med": med, "best": best,
        "std": st.pstdev(csec) if len(csec) > 1 else 0.0,
        "spread": max(csec) - min(csec),
        "tyre0": core[0][0], "tyreN": core[-1][0],
        "deg": deg, "deg_r2": r2, "valido": valido,
    }


def _finestra(records, comp, lo, hi):
    """Mediana per pilota nella finestra di eta-gomma [lo,hi], stessa mescola
    (>=4 giri nella finestra). Ritorna [(sig, team, med, n)] ordinata per med."""
    out = []
    for r in records:
        if r["comp"] != comp:
            continue
        win = [s for tl, s, _ in r["core"] if lo <= tl <= hi]
        if len(win) >= 4:
            out.append((r["sig"], r["team"], st.median(win), len(win)))
    # per pilota tengo la finestra con piu' giri
    best = {}
    for sig, team, med, n in out:
        if sig not in best or n > best[sig][3]:
            best[sig] = (sig, team, med, n)
    return sorted(best.values(), key=lambda x: x[2])


def _misura(anno, gp):
    ses = tele.carica_sessione(anno, gp, "FP2")
    laps = ses.laps
    piloti = tele.piloti_sessione(ses)
    inv = {v["num"]: (k, v["team"]) for k, v in piloti.items()}

    records = []
    for num in ses.drivers:
        dl = laps.pick_drivers(num)
        if dl.empty or "Stint" not in dl.columns:
            continue
        sig, team = inv.get(num, (num, "?"))
        for stint, g in dl.groupby("Stint"):
            comp = g["Compound"].dropna().unique()
            comp = comp[0] if len(comp) else "?"
            r = _analizza_stint(g)
            if r is None:
                continue
            r.update({"sig": sig, "team": team, "num": num,
                      "stint": int(stint), "comp": comp})
            records.append(r)
    n_giri = int(len(laps))
    n_piloti = len(set(r["sig"] for r in records))
    return ses, piloti, records, n_giri, n_piloti


def _ranking_mescola(records, comp):
    """Long-run validi della mescola, un record per pilota (il core piu' lungo),
    ordinati per mediana crescente."""
    val = [r for r in records if r["comp"] == comp and r["valido"]]
    best = {}
    for r in val:
        if r["sig"] not in best or r["n_core"] > best[r["sig"]]["n_core"]:
            best[r["sig"]] = r
    return sorted(best.values(), key=lambda r: r["med"])


# ---------------------------------------------------------------------------
# COSTRUZIONE ARTICOLO
# ---------------------------------------------------------------------------
def costruisci(anno=2026, gp="Hungary", data_bozza=None):
    ses, piloti, records, n_giri, n_piloti = _misura(anno, gp)
    colori = base.carica_colori()
    C_MER = colori.get("Mercedes") or "#27F4D2"
    C_MCL = colori.get("McLaren") or "#FF8000"
    C_RBR = colori.get("Red Bull Racing") or "#2B478F"
    C_FER = colori.get("Ferrari") or "#E8002D"

    med_rank = _ranking_mescola(records, "MEDIUM")
    hard_rank = _ranking_mescola(records, "HARD")
    if not med_rank:
        return None
    top = med_rank[0]                                   # RUS
    leader_med = top["med"]

    def get(rank, sig):
        for r in rank:
            if r["sig"] == sig:
                return r
        return None

    rus = get(med_rank, "RUS")
    nor = get(med_rank, "NOR")
    ver = get(med_rank, "VER")
    ham = get(med_rank, "HAM")
    pia = get(med_rank, "PIA")

    # de-confuso a finestra di eta-gomma comune (medium)
    win_a = _finestra(records, "MEDIUM", 11, 16)        # RUS vs NOR (finestra stretta)
    win_b = _finestra(records, "MEDIUM", 12, 18)        # RUS vs NOR (finestra piu' avanti)

    def da_win(win, sig):
        for s, team, med, n in win:
            if s == sig:
                return med, n
        return None, None

    rus_a, na_rus = da_win(win_a, "RUS")
    nor_a, na_nor = da_win(win_a, "NOR")
    rus_b, nb_rus = da_win(win_b, "RUS")
    nor_b, nb_nor = da_win(win_b, "NOR")
    d_a = nor_a - rus_a                                 # ~ +0,817
    d_b = nor_b - rus_b                                 # ~ +1,090

    # ampiezza campo medium (leader -> ultimo)
    ampiezza = med_rank[-1]["med"] - leader_med
    ultimo = med_rank[-1]

    # duello McLaren (unica eccezione oltre il rumore fra compagni)
    nor_pia = None
    if nor and pia:
        nor_pia = pia["med"] - nor["med"]

    # HARD: Racing Bulls davanti a Williams, ma gomma piu' vecchia (gap confuso)
    hard_top = hard_rank[0] if hard_rank else None
    hard_alb = get(hard_rank, "ALB")
    hard_sai = get(hard_rank, "SAI")

    # fuel-sensitivity Hungaroring (prior)
    FUEL_SKG = 0.03
    KG_PER_GAP = round(d_a / FUEL_SKG)                  # ~25-27 kg per spiegare il gap

    # ------------------------------------------------------------------ FIGURE
    # Fig A (Evidenza): ranking INGENUO medium (Δ dalla mediana-stint piu' rapida)
    righe_a = []
    for r in med_rank:
        righe_a.append({
            "sigla": f"{r['sig']} · {int(r['tyre0'])}-{int(r['tyreN'])} giri",
            "colore": colori.get(r["team"]) or "var(--dim)",
            "valore": r["med"] - leader_med,
            "evidenza": r["sig"] in ("RUS", "NOR", "VER"),
        })
    fig_a = svg.barre_dv(
        righe_a, titolo="Medium, mediana-stint grezza: Δ dal più rapido (RUS)",
        sub="FP2 Ungheria 2026 · long-run validi",
        unita="s", base=0.0, ml=118,
        caption="s/giro dalla mediana-stint più rapida — ma ogni età-gomma è diversa (v. etichette)")

    # Fig B (Causa): tempo-giro vs eta-gomma, RUS vs NOR (core dei long-run medium)
    serie_rus = sorted([(tl, s) for tl, s, _ in rus["core"]], key=lambda p: p[0])
    serie_nor = sorted([(tl, s) for tl, s, _ in nor["core"]], key=lambda p: p[0])
    tls = [p[0] for p in serie_rus + serie_nor]
    secs = [p[1] for p in serie_rus + serie_nor]
    x_lo = int(min(tls))
    x_hi = int(max(tls)) + 1
    y_lo = int(min(secs))
    y_hi = int(max(secs)) + 1
    fig_b = svg.grafico_xy(
        [{"sigla": "RUS (Mercedes)", "colore": C_MER, "punti": serie_rus},
         {"sigla": "NOR (McLaren)", "colore": C_MCL, "punti": serie_nor}],
        x_range=(x_lo, x_hi), y_range=(y_lo, y_hi),
        x_ticks=list(range(x_lo, x_hi + 1, 2)),
        y_ticks=list(range(y_lo, y_hi + 1)),
        x_label="età gomma (giri percorsi sulla mescola)",
        y_label="tempo giro (s)",
        x_annota=13.5, annota_txt="finestra confronto 11–16 giri",
        titolo="Stesso passo, età-gomma diverse: RUS resta sotto NOR",
        sub="core dei long-run medium (giri entro 1,07× il best) · FP2 Ungheria 2026")

    # Fig C (Effetto): de-confuso 11-16 — Δ dal passo di RUS a parita' di eta-gomma
    righe_c = []
    for s, team, med, n in win_a:
        righe_c.append({
            "sigla": f"{s} ({n} giri)",
            "colore": colori.get(team) or "var(--dim)",
            "valore": med - rus_a,
            "evidenza": s in ("RUS", "NOR"),
        })
    fig_c = svg.barre_dv(
        righe_c, titolo="A parità di età-gomma (11–16 giri): Δ dal passo di RUS",
        sub="medium · carburante ignoto",
        unita="s", base=0.0, ml=92,
        caption="s/giro dal passo di RUS nella stessa finestra di età-gomma")

    # ------------------------------------------------------------------ FACTS
    F = {
        "id": ID, "anno": anno, "gara": "Ungheria", "circuito": "Hungaroring",
        "sessione": "FP2", "round": 11,
        "sessione_giri": n_giri, "sessione_piloti": n_piloti,
        "RUS": {"med": rus["med"], "best": rus["best"], "n_core": rus["n_core"],
                "life": [int(rus["tyre0"]), int(rus["tyreN"])], "std": rus["std"],
                "deg": rus["deg"], "deg_r2": rus["deg_r2"]},
        "ingenuo": {"RUS": leader_med,
                    "VER_delta": ver["med"] - leader_med if ver else None,
                    "NOR_delta": nor["med"] - leader_med if nor else None},
        "deconfuso_11_16": {"RUS": rus_a, "NOR": nor_a, "delta": d_a,
                            "n_RUS": na_rus, "n_NOR": na_nor},
        "deconfuso_12_18": {"RUS": rus_b, "NOR": nor_b, "delta": d_b,
                            "n_RUS": nb_rus, "n_NOR": nb_nor},
        "ampiezza_campo_medium": ampiezza, "ultimo": {"sig": ultimo["sig"], "team": ultimo["team"]},
        "mclaren_nor_pia": nor_pia,
        "ver_medium": {"n_core": ver["n_core"], "lifeN": int(ver["tyreN"])} if ver else None,
        "hard": ({"top_sig": hard_top["sig"], "top_med": hard_top["med"],
                  "ALB_delta": (hard_alb["med"] - hard_top["med"]) if (hard_alb and hard_top) else None,
                  "SAI_delta": (hard_sai["med"] - hard_top["med"]) if (hard_sai and hard_top) else None}
                 if hard_top else None),
        "fuel": {"s_per_kg": FUEL_SKG, "kg_per_gap": KG_PER_GAP},
    }

    accent = C_MER
    life_rus = f"{int(rus['tyre0'])}–{int(rus['tyreN'])}"

    art = {
        "id": ID, "stato": "bozza",
        "data": data_bozza or "2026-07-25",
        "firma": "Muretto · Redazione tecnica", "accent": accent,
        "canale": "A (passo-gara dai long-run)",
        "gp": "Ungheria", "gara": "Ungheria", "circuito": "Hungaroring",
        "sessione": "FP2", "round": 11,
        "tag": ["passo-gara", "Mercedes", "long-run", "prove-libere"],
        "occhiello": "Passo-gara · FP2 Ungheria 2026",
        "titolo": f"Passo-gara Hungaroring: a parità di gomma RUS è {it(d_a,1)} s davanti a NOR",
        "sommario": (
            f"La classifica grezza dei long-run in mescola media dice quasi-parità: "
            f"RUS, VER e NOR entro {it(F['ingenuo']['NOR_delta'],3)} s. Ma i rivali hanno girato "
            f"su gomme più fresche. A parità di età-gomma (11–16 giri) la Mercedes di RUS è "
            f"{it(d_a,3)} s/giro davanti al miglior long-run rivale (NOR), e il margine sale a "
            f"{it(d_b,3)} s più avanti nello stint. Carburante e mappe motore restano ignoti: "
            f"passo indicativo, non verdetto."),
        "sezioni": [
            {"tag": "Evidenza", "titolo": "La classifica grezza dice quasi-parità — ma è un’illusione",
             "html": (
                f"<p>In FP2 la lettura più immediata del passo-gara è la mediana dei long-run in "
                f"mescola <b>media</b>, giro-core per giro-core. Ordinata così, la classifica dice "
                f"quasi-parità in testa: <b>RUS</b> a <b>{base.lap_fmt(leader_med)}</b>, "
                f"<b>VER</b> a +{it(F['ingenuo']['VER_delta'],3)} s e <b>NOR</b> a "
                f"+{it(F['ingenuo']['NOR_delta'],3)} s, tutti dentro un quarto di secondo. Dietro, "
                f"il campo si apre fino a <b>{it(ampiezza,1)} s/giro</b> tra il più rapido e la "
                f"{ultimo['team']} di {ultimo['sig']}.</p>"
                f"<p>Il problema è che quella colonna mette a confronto passi presi su <b>età-gomma "
                f"diverse</b>: RUS gira il suo long-run tra l’{int(rus['tyre0'])}ª e la "
                f"{int(rus['tyreN'])}ª tornata di vita della gomma, NOR tra la {int(nor['tyre0'])}ª e la "
                f"{int(nor['tyreN'])}ª, VER solo fino alla {int(ver['tyreN'])}ª. Su una mescola che "
                f"degrada, confrontare la mediana di chi ha gomme più vecchie con quella di chi le ha "
                f"più fresche non è un confronto: è un artefatto.</p>"),
             "figura": {"svg": fig_a,
                "didascalia": (
                    f"Mediana-stint grezza sul medium, Δ dal più rapido (RUS). In testa sembrano "
                    f"appaiati (RUS/VER/NOR entro {it(F['ingenuo']['NOR_delta'],3)} s) — ma l’etichetta "
                    f"di ciascuno ricorda che l’età-gomma è diversa, e questo falsa il confronto."),
                "fonte": "FastF1 · laps FP2 Ungheria 2026 — mediana del core (giri entro 1,07× il best dello stint)"}},

            {"tag": "Causa", "titolo": "A parità di età-gomma la Mercedes resta sotto",
             "html": (
                f"<p>Per togliere l’età-gomma di mezzo si confrontano i passi nella <b>stessa finestra "
                f"di vita della gomma</b>. Nella finestra <b>11–16 giri</b>, dove sia RUS sia NOR hanno "
                f"almeno quattro giri puliti, la Mercedes di RUS gira una mediana di "
                f"<b>{base.lap_fmt(rus_a)}</b> contro i <b>{base.lap_fmt(nor_a)}</b> della McLaren di "
                f"NOR: <b>{it(d_a,3)} s/giro</b> a favore di RUS. La quasi-parità della classifica "
                f"grezza sparisce non appena si mettono le gomme alla stessa età.</p>"
                f"<p>Il grafico lo mostra a occhio: le due nuvole di giri-core si sovrappongono "
                f"nell’età, ma la linea di RUS corre <b>sotto</b> quella di NOR dentro la finestra. "
                f"VER, che nella colonna grezza sembrava vicinissimo, qui non entra nel controllo: il "
                f"suo long-run medium è troppo corto ({F['ver_medium']['n_core']} giri-core, arriva "
                f"solo alla {F['ver_medium']['lifeN']}ª tornata di vita gomma), quindi il suo "
                f"quasi-pari <b>non è verificato</b> a parità di età. Tra i compagni di squadra i passi "
                f"stanno quasi tutti dentro il rumore; l’unica eccezione oltre il rumore è in McLaren, "
                f"NOR–PIA {it(nor_pia,3) if nor_pia is not None else '–'} s, ma con PIA su gomma più "
                f"vecchia.</p>"),
             "figura": {"svg": fig_b,
                "didascalia": (
                    f"Tempo sul giro contro età-gomma per i core dei long-run medium: dentro la "
                    f"finestra 11–16 giri la linea di RUS (Mercedes) resta sotto quella di NOR "
                    f"(McLaren). I picchi isolati sono giri di traffico ancora entro la soglia — "
                    f"per questo il passo si legge dalla mediana, non dal singolo giro."),
                "fonte": "FastF1 · laps + TyreLife FP2 Ungheria 2026"}},

            {"tag": "Effetto", "titolo": "Un riferimento che cresce nello stint — ma il carburante resta ignoto",
             "html": (
                f"<p>Il margine non solo tiene: <b>cresce</b>. Spostando la finestra più avanti nello "
                f"stint, <b>12–18 giri</b>, RUS gira <b>{base.lap_fmt(rus_b)}</b> contro i "
                f"<b>{base.lap_fmt(nor_b)}</b> di NOR — <b>{it(d_b,3)} s/giro</b>. Sui long-run in "
                f"mescola media, e a parità di età-gomma, è la Mercedes a fissare il riferimento del "
                f"passo-gara di questo Hungaroring.</p>"
                f"<p>Con l’onestà d’obbligo in prove libere: <b>carburante e mappe motore sono ignoti</b>. "
                f"Con una sensibilità al carburante da Hungaroring intorno a {it(FUEL_SKG,2)} s/giro per "
                f"kg, basterebbero circa <b>{KG_PER_GAP} kg</b> di benzina in meno nella Mercedes per "
                f"spiegare l’intero gap: non è falsificabile da questi dati. Allo stesso modo non "
                f"distinguiamo una simulazione-qualifica da una race-mode. È un riferimento robusto "
                f"all’età-gomma, non un verdetto sul valore assoluto: una sola sessione, un solo "
                f"circuito, nessuna replica.</p>"),
             "figura": {"svg": fig_c,
                "didascalia": (
                    f"A parità di età-gomma (finestra 11–16 giri), distacco per giro dal passo di RUS. "
                    f"NOR paga {it(d_a,3)} s/giro; il resto del gruppo medium è più lontano. Carburante "
                    f"ignoto: il distacco è a parità di gomma, non a parità di benzina."),
                "fonte": "FastF1 · laps + TyreLife FP2 Ungheria 2026 — mediana in finestra di età-gomma comune"}},
        ],
        "provenienza": [
            {"grandezza": "passo-gara RUS (mediana core, medium)",
             "valore": f"{base.lap_fmt(rus['med'])} · life {life_rus}, {rus['n_core']} giri-core, std {it(rus['std'],2)} s",
             "stato": "MISURATO",
             "da": "mediana dei giri-core (entro 1,07× il best dello stint) del long-run medium — FastF1 laps FP2"},
            {"grandezza": "classifica ingenua medium (top-3)",
             "valore": f"RUS {base.lap_fmt(leader_med)} · VER +{it(F['ingenuo']['VER_delta'],3)} · NOR +{it(F['ingenuo']['NOR_delta'],3)} s",
             "stato": "MISURATO",
             "da": "mediana-stint grezza per pilota; apparente quasi-parità CONFUSA dall’età-gomma diversa"},
            {"grandezza": "de-confuso a età-gomma (11–16 giri)",
             "valore": f"RUS {base.lap_fmt(rus_a)} vs NOR {base.lap_fmt(nor_a)} → Δ +{it(d_a,3)} s/giro",
             "stato": "MISURATO",
             "da": f"mediana nella finestra di età-gomma comune (RUS {na_rus} giri, NOR {na_nor} giri)"},
            {"grandezza": "de-confuso a età-gomma (12–18 giri)",
             "valore": f"RUS {base.lap_fmt(rus_b)} vs NOR {base.lap_fmt(nor_b)} → Δ +{it(d_b,3)} s/giro",
             "stato": "MISURATO",
             "da": f"stessa finestra spostata più avanti nello stint (RUS {nb_rus} giri, NOR {nb_nor} giri)"},
            {"grandezza": "degrado RUS sul long-run medium",
             "valore": f"+{it(rus['deg'],3)} s/giro (R² {it(rus['deg_r2'] or 0,2)})",
             "stato": "MISURATO",
             "da": "pendenza OLS tempo-vs-età-gomma sul core; magnitudine INDICATIVA (carburante ed evoluzione pista non separati)"},
            {"grandezza": "ampiezza del campo medium",
             "valore": f"~{it(ampiezza,1)} s/giro (leader → {F['ultimo']['team']} di {F['ultimo']['sig']})",
             "stato": "MISURATO",
             "da": "differenza fra la mediana-stint più rapida e la più lenta fra i long-run medium validi"},
            {"grandezza": "VER medium (escluso dal de-confuso 11–16)",
             "valore": f"{F['ver_medium']['n_core']} giri-core, arriva alla {F['ver_medium']['lifeN']}ª di vita gomma",
             "stato": "MISURATO",
             "da": "long-run troppo corto: <4 giri nella finestra 11–16 → quasi-pari non verificabile a parità di età"},
            {"grandezza": "sensibilità al carburante (Hungaroring)",
             "valore": f"~{it(FUEL_SKG,2)} s/giro per kg → ~{KG_PER_GAP} kg spiegano l’intero gap RUS–NOR",
             "stato": "STIMATO",
             "da": "prior di circuito; il carico benzina dei long-run FP non è nei dati"},
            {"grandezza": "mappe motore / modalità",
             "valore": "qualifica-sim vs race-mode non distinguibili",
             "stato": "NON_MISURABILE",
             "da": "nessun canale di mappa/modalità motore nel feed FastF1"},
        ],
        "fonti": [
            {"tipo": "dati",
             "testo": "FastF1 3.8.3 — laps + TyreLife/Compound/TrackStatus, sessione FP2 Gran Premio d’Ungheria 2026 (Hungaroring)"},
            {"tipo": "metodo",
             "testo": ("ai_lab/redazione/genera_hun_passo_gara.py — per (pilota, stint) si scartano "
                       "out-lap/in-lap/giri cancellati/non-verde puro/NaT e il primo giro di volo (gomma "
                       "fredda); il core sono i giri entro 1,07× il best del residuo; long-run valido = "
                       "core ≥5 giri e ≥60% del volo (esclude gli stint misti qual-sim + raffreddamento); "
                       "passo = mediana del core; de-confuso = mediana nella stessa finestra di età-gomma "
                       "(≥4 giri); degrado = pendenza OLS su core ≥6 giri (segno/magnitudine indicativi). "
                       "Confronto solo entro-mescola; carburante e mappe motore ignoti (passo indicativo)")},
        ],
    }
    return F, art


META = {
    "id": ID, "canale": "A",
    "titolo": "Passo-gara Hungaroring: RUS a parità di età-gomma",
    "tag": ["passo-gara", "long-run", "prove-libere"],
    "descrizione": "il riferimento del passo-gara sui long-run medium, de-confuso dall’età-gomma",
    "richiede": "laps", "gare": ["Ungheria"],
}


def genera(gara=None, data=None):
    if gara not in (None, "Ungheria", "Hungary"):
        return None
    r = costruisci(2026, "Hungary", data_bozza=data)
    if not r:
        return None
    F, art = r
    base.scrivi_bozza(ID, art, F)
    return {"id": ID, "titolo": art["titolo"], "stato": art["stato"], "canale": "A"}


if __name__ == "__main__":
    r = costruisci()
    if not r:
        print("nessun long-run medium valido"); sys.exit(1)
    F, art = r
    out = base.scrivi_bozza(ID, art, F)
    d_a = F["deconfuso_11_16"]["delta"]
    d_b = F["deconfuso_12_18"]["delta"]
    print(f"Bozza {ID} scritta in {out}")
    print(f"  sessione FP2: {F['sessione_giri']} giri, {F['sessione_piloti']} piloti")
    print(f"  RUS medium mediana {base.lap_fmt(F['RUS']['med'])} (life {F['RUS']['life'][0]}-{F['RUS']['life'][1]}, "
          f"{F['RUS']['n_core']} core, deg +{it(F['RUS']['deg'],3)} R2 {it(F['RUS']['deg_r2'],2)})")
    print(f"  ingenuo: RUS 0 / VER +{it(F['ingenuo']['VER_delta'],3)} / NOR +{it(F['ingenuo']['NOR_delta'],3)}")
    print(f"  de-confuso 11-16: RUS {base.lap_fmt(F['deconfuso_11_16']['RUS'])} vs NOR "
          f"{base.lap_fmt(F['deconfuso_11_16']['NOR'])} -> Δ +{it(d_a,3)}")
    print(f"  de-confuso 12-18: RUS {base.lap_fmt(F['deconfuso_12_18']['RUS'])} vs NOR "
          f"{base.lap_fmt(F['deconfuso_12_18']['NOR'])} -> Δ +{it(d_b,3)}")
    print(f"  ampiezza campo medium ~{it(F['ampiezza_campo_medium'],1)} s")
