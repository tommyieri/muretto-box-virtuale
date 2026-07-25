"""
Passo-gara track-agnostic (specifico-FP): "Il passo-gara sui long-run, de-confuso
dall'eta-gomma" — per QUALSIASI Gran Premio, da una sessione di prove libere.

Generalizzazione di genera_hun_passo_gara.py: stessa misura verificata (mediana
del core dei long-run, de-confuso a parita' di eta-gomma), ma NIENTE literal di
circuito. Anno, GP, circuito, round e sessione sono derivati dai parametri e da
ses.event della sessione caricata; mescola-guida, pilota-riferimento, avversario e
finestra di eta-gomma comune sono SCELTI dai dati, non cablati.

Tesi (generica, la stessa che regge in Ungheria come altrove): la classifica
INGENUA delle mediane-stint confonde passi presi su eta-gomma diverse (chi ha
girato su gomme piu' fresche sembra piu' vicino). A PARITA' di eta-gomma, in una
finestra comune scelta dai dati, emerge il vero riferimento del passo-gara e il
distacco dal miglior avversario. Carburante e mappe motore restano IGNOTI: passo
INDICATIVO, non verdetto.

Regole dure (rimisurate qui, non ricopiate; identiche alla versione verificata):
 - raggruppo per (pilota, stint); scarto out-lap/in-lap/Deleted/non-verde puro/NaT
   e il PRIMO giro di volo (gomma fredda);
 - core = giri entro 1.07x il best del residuo; long-run valido = core >=5 giri E
   >=60% del volo (cadono gli stint misti qual-sim + raffreddamento);
 - passo rappresentativo = MEDIANA del core (robusta a 1-2 giri di traffico);
 - de-confuso = mediana in finestra di eta-gomma COMUNE, stessa mescola (>=4 giri
   nella finestra): toglie l'eta-gomma, resta il carburante ignoto;
 - degrado = pendenza OLS (s/giro) su core >=6 giri: segno/magnitudine INDICATIVI.

python3 UTENTE (fastf1). Solo lettura; bozza nell'area Lab. Non tocca demo/.
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

SOGLIA = 1.07  # guardia traffico entro-stint (come SOGLIA_OUTLIER del progetto)
LARGHEZZA = 6  # ampiezza (giri) della finestra di eta-gomma comune
MIN_GIRI = 4   # giri minimi nella finestra perche' il passo sia rappresentativo
FUEL_SKG = 0.03  # sensibilita' al carburante: PRIOR generico di F1, NON per-circuito

MESCOLA_IT = {"SOFT": "morbida", "MEDIUM": "media", "HARD": "dura",
              "INTERMEDIATE": "intermedia", "WET": "da bagnato"}
# preferenza a parita' di piloti: la piu' rappresentativa del passo-gara
ORDINE_MESCOLA = {"MEDIUM": 3, "HARD": 2, "SOFT": 1}


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
# MISURA (rimisurata: nessun numero arriva da fuori) — verbatim dalla versione
# verificata, salvo il parametro sessione.
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


def _misura(anno, gp, sessione):
    ses = tele.carica_sessione(anno, gp, sessione)
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


def _scegli_mescola(records):
    """Mescola-guida = quella con piu' piloti dal long-run VALIDO (a parita',
    la piu' rappresentativa del passo-gara: media > dura > morbida)."""
    per = {}
    for r in records:
        if r["valido"]:
            per.setdefault(r["comp"], set()).add(r["sig"])
    if not per:
        return None
    return max(per.items(),
               key=lambda kv: (len(kv[1]), ORDINE_MESCOLA.get(kv[0], 0)))[0]


def _ranking_mescola(records, comp):
    """Long-run validi della mescola, un record per pilota (il core piu' lungo),
    ordinati per mediana crescente."""
    val = [r for r in records if r["comp"] == comp and r["valido"]]
    best = {}
    for r in val:
        if r["sig"] not in best or r["n_core"] > best[r["sig"]]["n_core"]:
            best[r["sig"]] = r
    return sorted(best.values(), key=lambda r: r["med"])


def _finestra(val, comp, lo, hi, min_giri=MIN_GIRI):
    """Mediana per pilota nella finestra di eta-gomma [lo,hi], stessa mescola
    (>=min_giri giri nella finestra). Ritorna [(sig, team, med, n)] per med."""
    out = {}
    for r in val:
        if r["comp"] != comp:
            continue
        w = [s for tl, s, _ in r["core"] if lo <= tl <= hi]
        if len(w) >= min_giri:
            m, n = st.median(w), len(w)
            if r["sig"] not in out or n > out[r["sig"]][3]:
                out[r["sig"]] = (r["sig"], r["team"], m, n)
    return sorted(out.values(), key=lambda x: x[2])


def _scegli_finestra(val, comp, larghezza=LARGHEZZA, min_giri=MIN_GIRI):
    """Finestra di eta-gomma comune scelta dai dati: massimizza il numero di
    piloti con >=min_giri giri (poi il totale dei giri, poi la piu' precoce).
    Serve >=2 piloti per un confronto. Ritorna ((lo,hi), [(sig,team,med,n)])."""
    ages = sorted({int(tl) for r in val if r["comp"] == comp
                   for tl, _, _ in r["core"]})
    if not ages:
        return None
    best = None
    for a in range(ages[0], ages[-1] + 1):
        lo, hi = a, a + larghezza - 1
        win = _finestra(val, comp, lo, hi, min_giri)
        if len(win) < 2:
            continue
        key = (len(win), sum(x[3] for x in win), -a)
        if best is None or key > best[0]:
            best = (key, (lo, hi), win)
    return (best[1], best[2]) if best else None


def _finestra_avanti(val, comp, sigL, sigR, lo_a, larghezza=LARGHEZZA, min_giri=MIN_GIRI):
    """La finestra piu' AVANTI nello stint (dopo lo_a) in cui sia sigL sia sigR
    hanno >=min_giri giri: serve a leggere se il margine tiene/cresce."""
    ages = sorted({int(tl) for r in val if r["comp"] == comp
                   for tl, _, _ in r["core"]})
    if not ages:
        return None
    best = None
    for a in range(lo_a + 1, ages[-1] + 1):
        lo, hi = a, a + larghezza - 1
        win = _finestra(val, comp, lo, hi, min_giri)
        d = {x[0]: x for x in win}
        if sigL in d and sigR in d:
            best = (lo, hi, win)   # tengo la piu' avanti
    return best


# ---------------------------------------------------------------------------
# COSTRUZIONE ARTICOLO (track-agnostic)
# ---------------------------------------------------------------------------
def costruisci(gara, sessione="FP2", data_bozza=None):
    anno_hint = int(str(data_bozza)[:4]) if data_bozza else datetime.date.today().year
    ses, piloti, records, n_giri, n_piloti = _misura(anno_hint, gara, sessione)

    ev = ses.event

    def _ev(k, dflt=""):
        try:
            v = ev[k]
            return v if v == v else dflt   # NaN -> default
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
    # slug per-EVENTO (Location): unico anche quando un Paese ospita piu' GP
    # (es. Miami/Austin/Las Vegas = tutti Country 'United States'). Allineato a
    # genera_fp_rapporti.py per raggruppare gli articoli-FP dello stesso weekend.
    slug = _slug(circuito if _ev("Location") else (gp or gara))
    ID = f"fp-passo-{slug}-{anno}"
    oggi = datetime.date.today().isoformat()

    colori = base.carica_colori()

    # --- mescola-guida e classifica ingenua -------------------------------
    comp = _scegli_mescola(records)
    if not comp:
        return None
    comp_it = MESCOLA_IT.get(comp, comp.lower())
    med_rank = _ranking_mescola(records, comp)
    if not med_rank:
        return None
    top = med_rank[0]
    leader_med = top["med"]
    lookup = {r["sig"]: r for r in med_rank}

    # --- de-confuso a eta-gomma comune (finestra scelta dai dati) ---------
    val = [r for r in records if r["valido"]]
    sc = _scegli_finestra(val, comp)
    if not sc:
        # senza una finestra comune la tesi (parita' di eta-gomma) non e'
        # verificabile: niente bozza, il generatore viene saltato con grazia.
        return None
    (lo_a, hi_a), win_a = sc
    dl = win_a[0]                     # riferimento a parita' di eta-gomma
    dr = win_a[1]                     # miglior avversario nella stessa finestra
    sig_L, team_L, leader_a, na_L = dl
    sig_R, team_R, rival_a, na_R = dr
    d_a = rival_a - leader_a
    recL = lookup.get(sig_L)
    recR = lookup.get(sig_R)
    if recL is None or recR is None:
        return None
    col_L = colori.get(team_L) or "var(--dim)"
    col_R = colori.get(team_R) or "var(--dim)"

    # finestra piu' avanti nello stint (facoltativa)
    fb = _finestra_avanti(val, comp, sig_L, sig_R, lo_a)
    d_b = leader_b = rival_b = nb_L = nb_R = None
    lo_b = hi_b = None
    if fb:
        lo_b, hi_b, win_b = fb
        db = {x[0]: x for x in win_b}
        leader_b, rival_b = db[sig_L][2], db[sig_R][2]
        nb_L, nb_R = db[sig_L][3], db[sig_R][3]
        d_b = rival_b - leader_b

    # ampiezza del campo nella mescola
    ampiezza = med_rank[-1]["med"] - leader_med
    ultimo = med_rank[-1]

    # top-3 ingenui non verificabili a parita' di eta (assenti dalla finestra A)
    sig_in_a = {x[0] for x in win_a}
    top3 = med_rank[:3]
    non_verif = [r for r in top3 if r["sig"] not in sig_in_a and r["sig"] != sig_L]

    # scarto massimo fra compagni nella mescola (colore derivato, non cablato)
    stds = [r["std"] for r in med_rank if r["std"] > 0]
    noise = st.median(stds) if stds else 0.0
    byteam = {}
    for r in med_rank:
        byteam.setdefault(r["team"], []).append(r)
    duel = None
    for team, rs in byteam.items():
        if len(rs) >= 2:
            fast = min(rs, key=lambda r: r["med"])
            slow = max(rs, key=lambda r: r["med"])
            gap = slow["med"] - fast["med"]
            if duel is None or gap > duel["gap"]:
                duel = {"team": team, "gap": gap, "fast": fast["sig"], "slow": slow["sig"]}
    duel_forte = bool(duel and noise > 0 and duel["gap"] > 2 * noise)

    # carburante: PRIOR generico (non per-circuito)
    KG_PER_GAP = round(d_a / FUEL_SKG) if FUEL_SKG else None

    # spread in testa (per il tono: quasi-parita' o distacchi contenuti)
    n_top = min(3, len(med_rank))
    spread_top = med_rank[n_top - 1]["med"] - leader_med
    parita_txt = "quasi-parità" if spread_top < 0.25 else "distacchi contenuti"

    stesso = (sig_L == top["sig"])

    # ------------------------------------------------------------------ FIGURE
    # Fig A (Evidenza): ranking INGENUO (Δ dalla mediana-stint piu' rapida)
    righe_a = []
    for r in med_rank:
        righe_a.append({
            "sigla": f"{r['sig']} · {int(r['tyre0'])}-{int(r['tyreN'])} giri",
            "colore": colori.get(r["team"]) or "var(--dim)",
            "valore": r["med"] - leader_med,
            "evidenza": r["sig"] in {t["sig"] for t in top3},
        })
    fig_a = svg.barre_dv(
        righe_a,
        titolo=f"Mescola {comp_it}, mediana-stint grezza: Δ dal più rapido ({top['sig']})",
        sub=f"{ses_nome} {country} {anno} · long-run validi",
        unita="s", base=0.0, ml=118,
        caption="s/giro dalla mediana-stint più rapida — ma ogni età-gomma è diversa (v. etichette)")

    # Fig B (Causa): tempo-giro vs eta-gomma, riferimento vs avversario
    serie_L = sorted([(tl, s) for tl, s, _ in recL["core"]], key=lambda p: p[0])
    serie_R = sorted([(tl, s) for tl, s, _ in recR["core"]], key=lambda p: p[0])
    tls = [p[0] for p in serie_L + serie_R]
    secs = [p[1] for p in serie_L + serie_R]
    x_lo, x_hi = int(min(tls)), int(max(tls)) + 1
    y_lo, y_hi = int(min(secs)), int(max(secs)) + 1
    fig_b = svg.grafico_xy(
        [{"sigla": f"{sig_L} ({team_L})", "colore": col_L, "punti": serie_L},
         {"sigla": f"{sig_R} ({team_R})", "colore": col_R, "punti": serie_R}],
        x_range=(x_lo, x_hi), y_range=(y_lo, y_hi),
        x_ticks=list(range(x_lo, x_hi + 1, 2)),
        y_ticks=list(range(y_lo, y_hi + 1)),
        x_label="età gomma (giri percorsi sulla mescola)",
        y_label="tempo giro (s)",
        x_annota=(lo_a + hi_a) / 2, annota_txt=f"finestra confronto {lo_a}–{hi_a} giri",
        titolo=f"Stesso passo, età-gomma diverse: {sig_L} resta sotto {sig_R}",
        sub=f"core dei long-run {comp_it} (giri entro 1,07× il best) · {ses_nome} {country} {anno}")

    # Fig C (Effetto): de-confuso finestra A — Δ dal passo del riferimento
    righe_c = []
    for s, team, med, n in win_a:
        righe_c.append({
            "sigla": f"{s} ({n} giri)",
            "colore": colori.get(team) or "var(--dim)",
            "valore": med - leader_a,
            "evidenza": s in (sig_L, sig_R),
        })
    fig_c = svg.barre_dv(
        righe_c,
        titolo=f"A parità di età-gomma ({lo_a}–{hi_a} giri): Δ dal passo di {sig_L}",
        sub=f"mescola {comp_it} · carburante ignoto",
        unita="s", base=0.0, ml=92,
        caption=f"s/giro dal passo di {sig_L} nella stessa finestra di età-gomma")

    # ------------------------------------------------------------------ FACTS
    F = {
        "id": ID, "anno": anno, "gp": gp, "country": country,
        "circuito": circuito, "round": rnd, "sessione": ses_nome,
        "sessione_giri": n_giri, "sessione_piloti": n_piloti,
        "mescola": comp,
        "riferimento": {
            "sig": sig_L, "team": team_L, "med": recL["med"], "best": recL["best"],
            "n_core": recL["n_core"], "life": [int(recL["tyre0"]), int(recL["tyreN"])],
            "std": recL["std"], "deg": recL["deg"], "deg_r2": recL["deg_r2"]},
        "ingenuo_top": [{"sig": r["sig"], "delta": r["med"] - leader_med,
                         "life": [int(r["tyre0"]), int(r["tyreN"])]} for r in top3],
        "naive_leader": top["sig"], "naive_leader_med": leader_med,
        "deconfuso_A": {"finestra": [lo_a, hi_a], "leader": sig_L, "rival": sig_R,
                        "leader_med": leader_a, "rival_med": rival_a, "delta": d_a,
                        "n_leader": na_L, "n_rival": na_R},
        "deconfuso_B": ({"finestra": [lo_b, hi_b], "leader_med": leader_b,
                         "rival_med": rival_b, "delta": d_b,
                         "n_leader": nb_L, "n_rival": nb_R} if fb else None),
        "ampiezza_campo": ampiezza,
        "ultimo": {"sig": ultimo["sig"], "team": ultimo["team"]},
        "non_verificabili": [{"sig": r["sig"], "n_core": r["n_core"],
                              "lifeN": int(r["tyreN"])} for r in non_verif],
        "duello_compagni": (duel and {"team": duel["team"], "gap": duel["gap"],
                                      "fast": duel["fast"], "slow": duel["slow"],
                                      "oltre_rumore": duel_forte}) or None,
        "fuel": {"s_per_kg": FUEL_SKG, "kg_per_gap": KG_PER_GAP, "prior": "F1 generico"},
    }

    # ------------------------------------------------------------------ PROSA
    life_L = f"{int(recL['tyre0'])}–{int(recL['tyreN'])}"

    def _verbo_margine(dopo, prima):
        if dopo > prima + 0.05:
            return "sale a"
        if dopo < prima - 0.05:
            return "si riduce a"
        return "resta a"
    verbo_b = _verbo_margine(d_b, d_a) if (fb and d_b is not None) else ""
    clausola_b = (f", e più avanti nello stint {verbo_b} {it(d_b, 3)} s/giro"
                  if (fb and d_b is not None) else "")
    # frase adattiva sul confronto ingenuo vs de-confuso
    if stesso:
        frase_svolta = (f"La {parita_txt} della classifica grezza si scioglie non "
                        f"appena si mettono le gomme alla stessa età: {sig_L} resta davanti.")
    else:
        frase_svolta = (f"A parità di età-gomma il riferimento non è più {top['sig']} "
                        f"della classifica grezza, ma {sig_L}.")

    tot_top = ", ".join(
        f"{r['sig']} {'+' + it(r['med'] - leader_med, 3) if r['med'] > leader_med else base.lap_fmt(r['med'])} s"
        if r["sig"] != top["sig"] else f"{r['sig']} {base.lap_fmt(r['med'])}"
        for r in top3)

    # frase compagni (solo se lo scarto supera ~2x il rumore tipico)
    frase_compagni = ""
    if duel_forte:
        frase_compagni = (f" Tra i compagni di squadra i passi stanno quasi tutti "
                          f"dentro il rumore; lo scarto più marcato è in {duel['team']}, "
                          f"{duel['fast']}–{duel['slow']} {it(duel['gap'], 3)} s.")

    # frase non-verificabili
    frase_nv = ""
    if non_verif:
        nv0 = non_verif[0]
        frase_nv = (f" Attenzione: {nv0['sig']}, vicino nella colonna grezza, qui non "
                    f"entra nel controllo — il suo long-run {comp_it} è troppo corto "
                    f"({nv0['n_core']} giri-core, arriva solo alla {int(nv0['tyreN'])}ª tornata di "
                    f"vita gomma), quindi il suo passo <b>non è verificato</b> a parità di età.")

    deg_txt = (f"+{it(recL['deg'], 3)} s/giro (R² {it(recL['deg_r2'] or 0, 2)})"
               if recL["deg"] is not None else "non calcolato (core < 6 giri)")

    rnd_txt = f" · round {rnd}" if rnd else ""

    art = {
        "id": ID, "stato": "bozza",
        "data": data_bozza or oggi,
        "firma": "Muretto · Redazione tecnica", "accent": col_L,
        "canale": "B (passo-gara dai long-run, specifico-FP)",
        "gp": gp, "gara": gp, "country": country, "circuito": circuito,
        "sessione": ses_nome, "round": rnd,
        "tag": ["passo-gara", "long-run", "prove-libere", country],
        "occhiello": f"Passo-gara · {ses_nome} {country} {anno}{rnd_txt}",
        "titolo": f"Passo-gara {circuito}: a parità di gomma {sig_L} è {it(d_a, 1)} s davanti a {sig_R}",
        "sommario": (
            f"La classifica grezza dei long-run in mescola {comp_it} dice {parita_txt}: "
            f"in testa {n_top} piloti entro {it(spread_top, 3)} s. Ma hanno girato su età-gomma "
            f"diverse. A parità di età (finestra {lo_a}–{hi_a} giri) il riferimento del passo-gara "
            f"è {sig_L}, {it(d_a, 3)} s/giro davanti al miglior long-run rivale ({sig_R}){clausola_b}. "
            f"Carburante e mappe motore restano ignoti: passo indicativo, non verdetto."),
        "sezioni": [
            {"tag": "Evidenza", "titolo": "La classifica grezza inganna: età-gomma diverse a confronto",
             "html": (
                f"<p>In {ses_nome} la lettura più immediata del passo-gara è la mediana dei "
                f"long-run in mescola <b>{comp_it}</b>, giro-core per giro-core. Ordinata così, in "
                f"testa si legge {parita_txt}: {tot_top}, tutti entro {it(spread_top, 3)} s. Dietro, "
                f"il campo si apre fino a <b>{it(ampiezza, 1)} s/giro</b> tra il più rapido e la "
                f"{ultimo['team']} di {ultimo['sig']}.</p>"
                f"<p>Il problema è che quella colonna mette a confronto passi presi su <b>età-gomma "
                f"diverse</b>: {top['sig']} gira il suo long-run tra l’{int(top['tyre0'])}ª e la "
                f"{int(top['tyreN'])}ª tornata di vita della gomma, e i rivali su finestre diverse "
                f"(v. etichette). Su una mescola che degrada, confrontare la mediana di chi ha gomme "
                f"più vecchie con quella di chi le ha più fresche non è un confronto: è un "
                f"artefatto.</p>"),
             "figura": {"svg": fig_a,
                "didascalia": (
                    f"Mediana-stint grezza sulla mescola {comp_it}, Δ dal più rapido ({top['sig']}). "
                    f"In testa sembrano vicini (entro {it(spread_top, 3)} s) — ma l’etichetta di "
                    f"ciascuno ricorda che l’età-gomma è diversa, e questo falsa il confronto."),
                "fonte": f"FastF1 · laps {ses_nome} {country} {anno} — mediana del core (giri entro 1,07× il best dello stint)"}},

            {"tag": "Causa", "titolo": "A parità di età-gomma emerge il vero riferimento",
             "html": (
                f"<p>Per togliere l’età-gomma di mezzo si confrontano i passi nella <b>stessa finestra "
                f"di vita della gomma</b>, scelta dai dati come quella con più piloti puliti. Nella "
                f"finestra <b>{lo_a}–{hi_a} giri</b>, dove sia {sig_L} sia {sig_R} hanno almeno quattro "
                f"giri puliti, {sig_L} gira una mediana di <b>{base.lap_fmt(leader_a)}</b> contro i "
                f"<b>{base.lap_fmt(rival_a)}</b> di {sig_R}: <b>{it(d_a, 3)} s/giro</b> a favore di "
                f"{sig_L}. {frase_svolta}</p>"
                f"<p>Il grafico lo mostra a occhio: le due nuvole di giri-core si sovrappongono "
                f"nell’età, ma la linea di {sig_L} corre <b>sotto</b> quella di {sig_R} dentro la "
                f"finestra.{frase_nv}{frase_compagni}</p>"),
             "figura": {"svg": fig_b,
                "didascalia": (
                    f"Tempo sul giro contro età-gomma per i core dei long-run {comp_it}: dentro la "
                    f"finestra {lo_a}–{hi_a} giri la linea di {sig_L} ({team_L}) resta sotto quella di "
                    f"{sig_R} ({team_R}). I picchi isolati sono giri di traffico ancora entro la soglia "
                    f"— per questo il passo si legge dalla mediana, non dal singolo giro."),
                "fonte": f"FastF1 · laps + TyreLife {ses_nome} {country} {anno}"}},

            {"tag": "Effetto", "titolo": "Un riferimento robusto all’età-gomma — ma il carburante resta ignoto",
             "html": (
                (f"<p>Spostando la finestra più avanti nello stint, <b>{lo_b}–{hi_b} giri</b>, "
                 f"il margine {verbo_b} <b>{it(d_b, 3)} s/giro</b>: {sig_L} gira "
                 f"<b>{base.lap_fmt(leader_b)}</b> contro i <b>{base.lap_fmt(rival_b)}</b> di "
                 f"{sig_R}. "
                 if (fb and d_b is not None) else
                 f"<p>Nella finestra comune di età-gomma, ")
                + f"Sui long-run in mescola {comp_it}, e a parità di età-gomma, è {sig_L} a fissare il "
                f"riferimento del passo-gara di questa sessione.</p>"
                f"<p>Con l’onestà d’obbligo in prove libere: <b>carburante e mappe motore sono "
                f"ignoti</b>. Con una sensibilità al carburante tipica in F1 intorno a "
                f"{it(FUEL_SKG, 2)} s/giro per kg (prior generico, non separato per circuito), "
                f"basterebbero circa <b>{KG_PER_GAP} kg</b> di benzina in meno per spiegare l’intero "
                f"gap {sig_L}–{sig_R}: non è falsificabile da questi dati. Allo stesso modo non "
                f"distinguiamo una simulazione-qualifica da una race-mode. È un riferimento robusto "
                f"all’età-gomma, non un verdetto sul valore assoluto: una sola sessione, un solo "
                f"circuito, nessuna replica.</p>"),
             "figura": {"svg": fig_c,
                "didascalia": (
                    f"A parità di età-gomma (finestra {lo_a}–{hi_a} giri), distacco per giro dal passo "
                    f"di {sig_L}. {sig_R} paga {it(d_a, 3)} s/giro; il resto del gruppo {comp_it} è più "
                    f"lontano. Carburante ignoto: il distacco è a parità di gomma, non di benzina."),
                "fonte": f"FastF1 · laps + TyreLife {ses_nome} {country} {anno} — mediana in finestra di età-gomma comune"}},
        ],
        "provenienza": [
            {"grandezza": f"passo-gara {sig_L} (mediana core, {comp_it})",
             "valore": f"{base.lap_fmt(recL['med'])} · life {life_L}, {recL['n_core']} giri-core, std {it(recL['std'], 2)} s",
             "stato": "MISURATO",
             "da": f"mediana dei giri-core (entro 1,07× il best dello stint) del long-run {comp_it} — FastF1 laps {ses_nome}"},
            {"grandezza": f"classifica ingenua {comp_it} (top-{n_top})",
             "valore": tot_top,
             "stato": "MISURATO",
             "da": "mediana-stint grezza per pilota; l’apparente vicinanza è CONFUSA dall’età-gomma diversa"},
            {"grandezza": f"de-confuso a età-gomma ({lo_a}–{hi_a} giri)",
             "valore": f"{sig_L} {base.lap_fmt(leader_a)} vs {sig_R} {base.lap_fmt(rival_a)} → Δ +{it(d_a, 3)} s/giro",
             "stato": "MISURATO",
             "da": f"mediana nella finestra di età-gomma comune, scelta dai dati ({sig_L} {na_L} giri, {sig_R} {na_R} giri)"},
        ] + ([
            {"grandezza": f"de-confuso a età-gomma ({lo_b}–{hi_b} giri)",
             "valore": f"{sig_L} {base.lap_fmt(leader_b)} vs {sig_R} {base.lap_fmt(rival_b)} → Δ +{it(d_b, 3)} s/giro",
             "stato": "MISURATO",
             "da": f"stessa coppia, finestra spostata più avanti nello stint ({sig_L} {nb_L} giri, {sig_R} {nb_R} giri)"},
        ] if fb else []) + [
            {"grandezza": f"degrado {sig_L} sul long-run {comp_it}",
             "valore": deg_txt,
             "stato": "MISURATO" if recL["deg"] is not None else "NON_MISURABILE",
             "da": "pendenza OLS tempo-vs-età-gomma sul core; magnitudine INDICATIVA (carburante ed evoluzione pista non separati)"},
            {"grandezza": f"ampiezza del campo {comp_it}",
             "valore": f"~{it(ampiezza, 1)} s/giro (leader → {ultimo['team']} di {ultimo['sig']})",
             "stato": "MISURATO",
             "da": "differenza fra la mediana-stint più rapida e la più lenta fra i long-run validi"},
        ] + ([
            {"grandezza": f"top-3 ingenuo non verificabile a parità di età",
             "valore": ", ".join(f"{r['sig']} ({r['n_core']} core, fino alla {int(r['tyreN'])}ª)" for r in non_verif),
             "stato": "MISURATO",
             "da": f"long-run troppo corto: <{MIN_GIRI} giri nella finestra {lo_a}–{hi_a} → quasi-pari non verificabile a parità di età"},
        ] if non_verif else []) + ([
            {"grandezza": f"scarto massimo fra compagni ({comp_it})",
             "valore": f"{duel['team']}: {duel['fast']}–{duel['slow']} {it(duel['gap'], 3)} s"
                       + (" (oltre il rumore)" if duel_forte else " (entro il rumore)"),
             "stato": "MISURATO",
             "da": f"max differenza di mediana-stint fra compagni; rumore tipico ~{it(2 * noise, 2)} s (2× la std mediana)"},
        ] if duel else []) + [
            {"grandezza": "sensibilità al carburante",
             "valore": f"~{it(FUEL_SKG, 2)} s/giro per kg → ~{KG_PER_GAP} kg spiegano l’intero gap {sig_L}–{sig_R}",
             "stato": "PRIOR",
             "da": "prior generico di F1 (non separato per circuito); il carico benzina dei long-run FP non è nei dati"},
            {"grandezza": "mappe motore / modalità",
             "valore": "qualifica-sim vs race-mode non distinguibili",
             "stato": "NON_MISURABILE",
             "da": "nessun canale di mappa/modalità motore nel feed FastF1"},
        ],
        "fonti": [
            {"tipo": "dati",
             "testo": f"FastF1 — laps + TyreLife/Compound/TrackStatus, sessione {ses_nome} {gp} {anno} ({circuito})"},
            {"tipo": "metodo",
             "testo": ("ai_lab/redazione/genera_fp_passo.py — per (pilota, stint) si scartano "
                       "out-lap/in-lap/giri cancellati/non-verde puro/NaT e il primo giro di volo (gomma "
                       "fredda); il core sono i giri entro 1,07× il best del residuo; long-run valido = "
                       "core ≥5 giri e ≥60% del volo (esclude gli stint misti qual-sim + raffreddamento); "
                       "passo = mediana del core; mescola-guida, riferimento e avversario scelti dai dati; "
                       "de-confuso = mediana nella stessa finestra di età-gomma (larghezza 6 giri, ≥4 giri), "
                       "scelta dai dati; degrado = pendenza OLS su core ≥6 giri (segno/magnitudine "
                       "indicativi). Confronto solo entro-mescola; carburante e mappe motore ignoti")},
        ],
    }
    return F, art


META = {
    "id": "fp-passo", "canale": "B",
    "titolo": "Passo-gara dai long-run, de-confuso dall’età-gomma (specifico-FP)",
    "tag": ["passo-gara", "long-run", "prove-libere"],
    "descrizione": "il riferimento del passo-gara sui long-run, de-confuso dall’età-gomma — per qualsiasi GP",
    "richiede": "telemetria", "gare": ["*"], "sessioni": ["FP1", "FP2"],
}


def genera(gara=None, data=None, sessione=None):
    if sessione is None:
        sessione = "FP2"
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
    ap = argparse.ArgumentParser(description="Passo-gara track-agnostic da una sessione FP")
    ap.add_argument("--gara", required=True,
                    help="GP accettato da FastF1 (nome inglese/località/round), es. 'Hungary'")
    ap.add_argument("--sessione", default="FP2", help="FP1/FP2 (default FP2)")
    ap.add_argument("--data", default=None, help="AAAA-MM-GG per la targhetta della bozza")
    a = ap.parse_args()
    r = costruisci(a.gara, a.sessione, data_bozza=a.data)
    if not r:
        print("nessuna finestra di età-gomma comune / long-run valido"); sys.exit(1)
    F, art = r
    out = base.scrivi_bozza(art["id"], art, F)
    dA = F["deconfuso_A"]
    print(f"Bozza {art['id']} scritta in {out}")
    print(f"  {F['sessione']} {F['gp']} {F['anno']} (round {F['round']}, {F['circuito']}): "
          f"{F['sessione_giri']} giri, {F['sessione_piloti']} piloti · mescola {F['mescola']}")
    print(f"  ingenuo leader {F['naive_leader']} {base.lap_fmt(F['naive_leader_med'])}")
    print(f"  de-confuso {dA['finestra'][0]}-{dA['finestra'][1]}: {dA['leader']} "
          f"{base.lap_fmt(dA['leader_med'])} vs {dA['rival']} {base.lap_fmt(dA['rival_med'])} "
          f"-> Δ +{it(dA['delta'], 3)}")
    if F["deconfuso_B"]:
        dB = F["deconfuso_B"]
        print(f"  de-confuso {dB['finestra'][0]}-{dB['finestra'][1]}: Δ +{it(dB['delta'], 3)}")
    print(f"  ampiezza campo ~{it(F['ampiezza_campo'], 1)} s")
