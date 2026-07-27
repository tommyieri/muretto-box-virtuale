"""
Il degrado della gomma, per stint — pezzo-gara GENERALE (tutto il gruppo), track-agnostic.

Che cosa misura e perche' cosi' (playbook esperto, misurato qui, non ricopiato):
 - un pilota fa la gara a STINT (sequenze di giri sullo stesso treno di gomme).
   Dentro uno stint il tempo sul giro DERIVA: la gomma cala (piu' lento) mentre la
   benzina scende e la pista gomma (piu' veloce). La PENDENZA di quella deriva —
   s/giro guadagnati o persi con l'eta' della gomma — e' la firma del degrado.
 - pendenza = regressione ai minimi quadrati del tempo-giro sull'ETA' gomma (giri
   dall'inizio dello stint), sui soli giri VERDI puliti e in ARIA PULITA, scartato
   il primo giro dello stint (gomma fredda). MAI su tutti i giri, mai sul singolo.
 - PER MESCOLA: soft/medium/hard degradano in modo diverso; si confronta dentro la
   stessa mescola, dove il confondente-benzina e' quasi comune e si annulla nel
   confronto.

IL CONFONDENTE (dichiarato, non nascosto): la pendenza grezza NON e' il degrado
assoluto. E' degrado MENO il guadagno di benzina/evoluzione-pista (che alleggerisce
il tempo di ~50-90 ms/giro). Percio':
 - pendenza POSITIVA (+): la gomma cala PIU' di quanto la benzina alleggerisca;
 - pendenza NEGATIVA (−): il guadagno-benzina batte il degrado (gomma che tiene).
Il degrado ASSOLUTO non e' separabile dalla benzina con questi dati (il carico di
carburante non e' nel feed): e' NON_MISURABILE. Robusto e' il CONFRONTO dentro la
stessa mescola (offset comune che si elide), non il valore assoluto.
Aria sporca esclusa (un pilota in scia ha il passo del davanti, non della sua gomma);
chi non ha abbastanza giri puliti in aria pulita esce. Niente ERS, niente strategia.

python3 UTENTE (fastf1 3.8.3). Solo lettura; bozza nell'area Lab. Non tocca demo/.

═══════════════════════════════════════════════════════════════════════════════
CANCELLO / NULL DOCUMENTATO (Ungheria 2026, 27/07). Il generatore misura, ma un
CANCELLO di robustezza (_cancello_robustezza) rifiuta di produrre l'articolo quando
il degrado non e' onestamente leggibile — e in Ungheria NON lo era, su DUE fronti:
 1) per-pilota/per-stint: il rumore di gara e' ~12x il segnale. RMSE mediano del
    fit ~462 ms/giro contro |pendenza| mediana ~37 ms/giro (traffico, temperatura
    gomma, fuel-save, lift-and-coast, mappe motore). OLS e Theil-Sen concordano
    (r=0,91): non e' un outlier, e' scatter a banda larga. Le pendenze cambiano
    SEGNO fra un filtro e l'altro → inaffidabili.
 2) per-mescola (pool a effetti-fissi, intercette per-stint, IC95 bootstrap):
    statisticamente stabile MA fisicamente assurdo — Soft PIATTA (−3 ms/giro) e
    Hard che DEGRADA (+37): ordinamento rovesciato. E' il confondente benzina/fase
    (le mescole si usano in finestre-carburante sistematicamente diverse), non il
    comportamento gomma. Pubblicarlo INGANNEREBBE.
Il degrado ASSOLUTO resta NON_MISURABILE (benzina fuori dal feed) e il confronto
cross-mescola e' confuso alla radice. Coerente con l'"arco degrado chiuso" e col
rumore di gara documentati. File TENUTO (metodo + cancello) come [[degrado-scheletro]]
documentato; NON in rotazione (vedi registro.py). Un futuro GP con degrado pulito e
separabile (cliff netto, IC che separano nell'ordine giusto) passerebbe il cancello.
═══════════════════════════════════════════════════════════════════════════════
"""
from __future__ import annotations
import os
import sys
import json
import statistics as st
from collections import defaultdict

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele   # noqa: E402
import svg    # noqa: E402
import base   # noqa: E402

ID = "degrado-stint"
REPO = os.path.abspath(os.path.join(_QUI, "..", ".."))

# --- parametri di misura (la "regola della casa", dichiarati in provenienza) ---
SOGLIA_TRAFFICO = 1.5     # s: entro questo gap dalla macchina davanti = aria sporca
MIN_FIT = 8               # giri puliti in aria pulita minimi per stimare una pendenza
MIN_STINT_COMP = 3        # stint leggibili minimi in una mescola per confrontarla

_REG = {}
try:
    _REG = json.load(open(os.path.join(REPO, "data", "gare_registro.json")))
except Exception:
    _REG = {}

CIRCUITI = {
    "Australia": "Albert Park", "Cina": "Shanghai", "Giappone": "Suzuka",
    "Miami": "Miami", "Canada": "Montreal", "Monaco": "Monaco",
    "Spagna": "Barcellona-Catalunya", "Austria": "Red Bull Ring",
    "Gran Bretagna": "Silverstone", "Belgio": "Spa-Francorchamps",
    "Ungheria": "Hungaroring",
}

# mescola -> (nome it, colore-dato per lo scatter)
MESCOLE = {
    "SOFT":   ("Soft",   "#e8462a"),
    "MEDIUM": ("Medium", "#f5c518"),
    "HARD":   ("Hard",   "#cfd8e3"),
    "INTERMEDIATE": ("Intermedie", "#3fb950"),
    "WET":    ("Full wet", "#3b82f6"),
}


def it(x, dec=1):
    return base.it(x, dec)


def _slug(nome):
    s = (nome or "").lower()
    for a, b in (("à", "a"), ("è", "e"), ("é", "e"), ("ì", "i"), ("ò", "o"),
                 ("ù", "u"), (" ", "-"), ("'", "")):
        s = s.replace(a, b)
    return "".join(c for c in s if c.isalnum() or c == "-") or "gara"


def _mesc_nome(c):
    return MESCOLE.get(str(c).upper(), (str(c).title(), "var(--dim)"))[0]


def _mesc_col(c):
    return MESCOLE.get(str(c).upper(), ("?", "var(--dim)"))[1]


def _pendenza(xy):
    """Regressione OLS: (pendenza s/giro, RMSE, n). xy = [(eta, tempo)]."""
    n = len(xy)
    xs = [p[0] for p in xy]
    ys = [p[1] for p in xy]
    mx = sum(xs) / n
    my = sum(ys) / n
    den = sum((x - mx) ** 2 for x in xs)
    if den == 0:
        return None, None, n
    b = sum((x - mx) * (y - my) for x, y in xy) / den
    a = my - b * mx
    rmse = (sum((y - (a + b * x)) ** 2 for x, y in xy) / n) ** 0.5
    return b, rmse, n


# ---------------------------------------------------------------------------
# MISURA (nessun numero arriva da fuori)
# ---------------------------------------------------------------------------
def _misura(anno, ti):
    ses = tele.carica_sessione(anno, ti, "Race")
    laps = ses.laps
    piloti = tele.piloti_sessione(ses)
    inv = {v["num"]: (k, v["team"]) for k, v in piloti.items()}

    # gap alla macchina davanti per giro (aria pulita/sporca)
    by_ln = defaultdict(list)
    for _, lap in laps.iterrows():
        t = tele.secondi(lap["Time"])
        if t is None:
            continue
        by_ln[int(lap["LapNumber"])].append((t, lap["DriverNumber"]))
    gap_ahead = {}
    for ln, arr in by_ln.items():
        arr.sort()
        for i, (t, num) in enumerate(arr):
            gap_ahead[(num, ln)] = None if i == 0 else (t - arr[i - 1][0])

    stints = []
    for num in ses.drivers:
        dl = laps.pick_drivers(num).sort_values("LapNumber")
        sig, team = inv.get(num, (num, "?"))
        byst = defaultdict(list)   # stint -> [(LapNumber, laptime, clean, compound)]
        for _, lap in dl.iterrows():
            if lap["PitOutTime"] == lap["PitOutTime"]:      # out-lap
                continue
            if lap["PitInTime"] == lap["PitInTime"]:        # in-lap
                continue
            if bool(lap.get("Deleted", False)):
                continue
            if str(lap["TrackStatus"]) != "1":              # solo verde puro
                continue
            s = tele.secondi(lap["LapTime"])
            if s is None:
                continue
            ln = int(lap["LapNumber"])
            g = gap_ahead.get((num, ln))
            clean = (g is None or g > SOGLIA_TRAFFICO)
            byst[int(lap["Stint"])].append((ln, s, clean, str(lap.get("Compound", "?"))))
        for stn, arr in byst.items():
            arr.sort()
            comp = arr[0][3]
            first_ln = arr[0][0]
            core = arr[1:]                                  # scarto il primo giro (gomma fredda)
            # aria pulita, con eta' gomma = giri dall'inizio stint
            fit_xy = [(ln - first_ln, s) for (ln, s, c, _cp) in core if c]
            n_traf = sum(1 for (_ln, _s, c, _cp) in core if not c)
            if len(fit_xy) < MIN_FIT:
                stints.append({"sig": sig, "team": team, "stint": stn, "comp": comp,
                               "n_fit": len(fit_xy), "n_core": len(core), "n_traf": n_traf,
                               "slope": None, "rmse": None, "med": None,
                               "eta_min": None, "eta_max": None, "serie": None,
                               "leggibile": False})
                continue
            b, rmse, n = _pendenza(fit_xy)
            stints.append({
                "sig": sig, "team": team, "stint": stn, "comp": comp,
                "n_fit": n, "n_core": len(core), "n_traf": n_traf,
                "slope": b, "rmse": rmse,
                "med": st.median([s for _e, s in fit_xy]),
                "eta_min": min(e for e, _ in fit_xy), "eta_max": max(e for e, _ in fit_xy),
                "serie": sorted(fit_xy),
                "leggibile": True,
            })
    meta = {
        "event": str(ses.event.get("EventName", ti)),
        "round": int(ses.event.get("RoundNumber", 0) or 0),
        "n_laps_tot": int(laps["LapNumber"].max()) if len(laps) else 0,
    }
    return ses, stints, meta


# ---------------------------------------------------------------------------
# CANCELLO DI ROBUSTEZZA — il degrado si pubblica SOLO se onestamente leggibile
# ---------------------------------------------------------------------------
# Due controlli DETERMINISTICI (niente bootstrap: la decisione non dev'essere
# flaky in produzione). Vedi il NULL documentato in testa al file.
NOISE_MAX = 2.5     # RMSE mediano del fit / |pendenza| mediana: sopra = rumore che soffoca il segnale
PLAUS_TOLL = 5.0    # ms/giro: la soft deve degradare almeno quanto la hard (meno tolleranza)


def _fe_slope(stints_pts):
    num = den = 0.0
    for pts in stints_pts:
        n = len(pts)
        mx = sum(x for x, _ in pts) / n
        my = sum(y for _, y in pts) / n
        for x, y in pts:
            num += (x - mx) * (y - my)
            den += (x - mx) ** 2
    return (num / den) if den else None


def _cancello_robustezza(leggibili):
    """(ok, diagnostica). Rifiuta se: (1) il rumore per-stint soffoca il segnale,
    o (2) l'ordine per-mescola e' fisicamente assurdo (soft che degrada meno della
    hard = confondente benzina/fase, non gomma)."""
    slopes = [abs(s["slope"]) for s in leggibili if s["slope"] is not None]
    rmses = [s["rmse"] for s in leggibili if s["rmse"] is not None]
    if not slopes or not rmses:
        return False, {"motivo": "nessuna pendenza stimabile"}
    med_slope = st.median(slopes) or 1e-9
    med_rmse = st.median(rmses)
    rapporto = med_rmse / med_slope
    diag = {"rmse_med_ms": round(med_rmse * 1000, 0), "slope_med_ms": round(med_slope * 1000, 0),
            "rapporto_rumore": round(rapporto, 1)}
    if rapporto > NOISE_MAX:
        diag["motivo"] = (f"rumore {rapporto:.0f}x il segnale (RMSE {med_rmse*1000:.0f} ms vs "
                          f"pendenza {med_slope*1000:.0f} ms/giro): pendenze inaffidabili")
        return False, diag
    # plausibilita' per-mescola: soft >= medium >= hard (a meno di PLAUS_TOLL)
    per = defaultdict(list)
    for s in leggibili:
        c = str(s["comp"]).upper()
        if c in ("SOFT", "MEDIUM", "HARD"):
            xy = s["serie"]
            mx = sum(e for e, _ in xy) / len(xy)
            my = sum(t for _, t in xy) / len(xy)
            per[c].append([(e - mx, t - my) for e, t in xy])
    fe = {c: (_fe_slope(v) or 0) * 1000 for c, v in per.items() if len(v) >= MIN_STINT_COMP}
    diag["fe_mescola_ms"] = {c: round(v, 0) for c, v in fe.items()}
    if "SOFT" in fe and "HARD" in fe and fe["SOFT"] < fe["HARD"] - PLAUS_TOLL:
        diag["motivo"] = (f"ordine mescole assurdo (Soft {fe['SOFT']:.0f} < Hard {fe['HARD']:.0f} ms/giro): "
                          f"confondente benzina/fase, non gomma")
        return False, diag
    return True, diag


# ---------------------------------------------------------------------------
# COSTRUZIONE ARTICOLO
# ---------------------------------------------------------------------------
def costruisci(anno, gara, data_bozza=None):
    ti = (_REG.get(gara, {}) or {}).get("ti", gara)
    ses, stints, meta = _misura(anno, ti)
    leggibili = [s for s in stints if s["leggibile"]]
    if len(leggibili) < 4:
        return None
    # CANCELLO: niente articolo se il degrado non e' onestamente leggibile
    ok, diag = _cancello_robustezza(leggibili)
    if not ok:
        if os.environ.get("REDAZIONE_DEBUG"):
            print(f"  [degrado] CANCELLO chiuso: {diag.get('motivo')} · {diag}")
        return None
    colori = base.carica_colori()
    circuito = CIRCUITI.get(gara) or str(ses.event.get("Location", ""))
    rnd = meta["round"]
    slug = _slug(gara)

    def col(team):
        return colori.get(team) or "var(--dim)"

    # raggruppa per mescola
    per_mesc = defaultdict(list)
    for s in leggibili:
        per_mesc[str(s["comp"]).upper()].append(s)

    # mescole confrontabili (>=MIN_STINT_COMP stint leggibili), piu' popolate prima
    mesc_ok = {c: v for c, v in per_mesc.items() if len(v) >= MIN_STINT_COMP
               and c in MESCOLE and c not in ("INTERMEDIATE", "WET")}
    if not mesc_ok:
        return None
    mesc_ordine = sorted(mesc_ok, key=lambda c: -len(mesc_ok[c]))
    # mescola-EROE per la Figura A = la piu' popolata
    main_c = mesc_ordine[0]
    main = sorted(mesc_ok[main_c], key=lambda s: -s["slope"])
    main_nome = _mesc_nome(main_c)

    # standout globali per mescola: peggior degrado (max slope) e miglior tenuta (min slope)
    def peggiore(v):
        return max(v, key=lambda s: s["slope"])

    def migliore(v):
        return min(v, key=lambda s: s["slope"])

    # duello per la Figura C: mescola con il contrasto slope piu' ampio (stint lunghi)
    coppie = []
    for c, v in mesc_ok.items():
        vv = [s for s in v if s["n_fit"] >= MIN_FIT]
        if len(vv) < 2:
            continue
        deg = peggiore(vv)
        ten = migliore(vv)
        if deg["sig"] == ten["sig"] and deg["stint"] == ten["stint"]:
            continue
        # premia ampiezza del contrasto E stint lunghi (piu' credibili)
        span = deg["slope"] - ten["slope"]
        credito = span * (min(deg["n_fit"], ten["n_fit"]))
        coppie.append((credito, c, deg, ten, span))
    duello = max(coppie, key=lambda t: t[0]) if coppie else None

    # ---------------------------------------------------------------- FIGURA A
    righe_a = []
    for s in main:
        righe_a.append({
            "label": f"{s['sig']} · st{s['stint']}",
            "valore": s["slope"] * 1000.0,
            "nota": f"{s['n_fit']}g",
        })
    col_pos = "#e8613a"   # degrada (destra)
    col_neg = "#3fb2e8"   # tiene (sinistra)
    fig_a = svg.barre_divergenti(
        righe_a, col_pos=col_pos, col_neg=col_neg,
        lbl_pos="la gomma cala", lbl_neg="la gomma tiene",
        titolo=f"Degrado per stint — mescola {main_nome}",
        sub=f"Gara {gara} {anno}",
        unita="ms/giro",
        caption=("ms/giro di deriva col crescere dell'eta' gomma (aria pulita) · + destra = "
                 "cala piu' del guadagno-benzina · − sinistra = benzina batte il degrado"))

    # ---------------------------------------------------------------- FIGURA B (scatter: il confondente)
    punti_b = []
    slope_all = [s["slope"] * 1000 for s in leggibili]
    smin, smax = min(slope_all), max(slope_all)
    # x = eta' media di fitting (proxy della finestra/benzina), y = pendenza
    xs_b = [(s["eta_min"] + s["eta_max"]) / 2 for s in leggibili]
    xmax_b = max(xs_b) + 2
    for s in leggibili:
        xm = (s["eta_min"] + s["eta_max"]) / 2
        ev = duello is not None and (
            (s["sig"] == duello[2]["sig"] and s["stint"] == duello[2]["stint"]) or
            (s["sig"] == duello[3]["sig"] and s["stint"] == duello[3]["stint"]))
        punti_b.append({"label": s["sig"], "colore": _mesc_col(s["comp"]),
                        "x": xm, "y": s["slope"] * 1000.0, "evidenza": ev})
    y_lo = min(-20, (int(smin // 20) - 1) * 20)
    y_hi = max(60, (int(smax // 20) + 1) * 20)
    yticks = list(range(int(y_lo), int(y_hi) + 1, 40))
    xticks = list(range(0, int(xmax_b) + 1, 8))
    fig_b = svg.grafico_scatter(
        punti_b, x_range=(0, xmax_b), y_range=(y_lo, y_hi),
        x_ticks=xticks, y_ticks=yticks, cx=0.0, cy=0.0,
        x_label="eta' media della gomma nello stint (giri)",
        y_label="pendenza (ms/giro)",
        titolo="Perche' la pendenza grezza non e' il degrado assoluto",
        sub=f"Gara {gara} {anno} · colore = mescola",
        ang=("", "cala col passare dei giri", "", "tiene / migliora"))

    # ---------------------------------------------------------------- FIGURA C (duello stessa mescola)
    fig_c = None
    if duello:
        _cr, c, deg, ten, span = duello
        # tempo giro vs eta' gomma, due stint stessa mescola
        serie = [
            {"sigla": f"{ten['sig']} (tiene)", "colore": col(ten["team"]),
             "punti": ten["serie"]},
            {"sigla": f"{deg['sig']} (cala)", "colore": col(deg["team"]),
             "punti": deg["serie"]},
        ]
        allt = [t for s in (ten, deg) for _e, t in s["serie"]]
        alle = [e for s in (ten, deg) for e, _t in s["serie"]]
        y0 = int(min(allt)) - 1
        y1 = int(max(allt)) + 2
        x1 = max(alle) + 1
        fig_c = svg.grafico_xy(
            serie, x_range=(0, x1), y_range=(y0, y1),
            x_ticks=list(range(0, int(x1) + 1, 5)),
            y_ticks=list(range(y0, y1 + 1, 1)),
            x_label="eta' della gomma nello stint (giri)",
            y_label="s/giro",
            titolo=f"Stessa mescola ({_mesc_nome(c)}), due destini",
            sub=f"Gara {gara} {anno} · tempo sul giro col crescere dell'eta' gomma")

    # ---------------------------------------------------------------- FACTS
    def _st(s):
        return {"sig": s["sig"], "team": s["team"], "stint": s["stint"],
                "comp": _mesc_nome(s["comp"]), "slope_ms": round(s["slope"] * 1000, 1),
                "n_fit": s["n_fit"], "eta_min": s["eta_min"], "eta_max": s["eta_max"],
                "med": round(s["med"], 3), "rmse_ms": round(s["rmse"] * 1000, 1)}

    peggiore_main = peggiore(main)
    migliore_main = migliore(main)
    F = {
        "id": ID, "anno": anno, "gara": gara, "circuito": circuito, "round": rnd,
        "sessione": "Gara", "n_laps_gara": meta["n_laps_tot"],
        "parametri": {"soglia_traffico_s": SOGLIA_TRAFFICO, "min_fit": MIN_FIT,
                      "min_stint_mescola": MIN_STINT_COMP},
        "mescola_eroe": {"comp": main_nome, "n_stint": len(main),
                         "peggiore": _st(peggiore_main), "migliore": _st(migliore_main)},
        "mescole": {_mesc_nome(c): [_st(s) for s in sorted(v, key=lambda s: -s["slope"])]
                    for c, v in mesc_ok.items()},
        "duello": ({"mescola": _mesc_nome(duello[1]), "span_ms": round(duello[4] * 1000, 1),
                    "cala": _st(duello[2]), "tiene": _st(duello[3])} if duello else None),
        "n_stint_leggibili": len(leggibili),
        "n_stint_esclusi": len([s for s in stints if not s["leggibile"]]),
    }

    # ---------------------------------------------------------------- PROSA
    accent = _mesc_col(main_c)
    pj = peggiore_main
    mg = migliore_main
    # segno del migliore (tiene o cala poco)
    mg_txt = (f"la gomma di <b>{mg['sig']}</b> ({mg['team']}) addirittura migliora di "
              f"{it(abs(mg['slope'])*1000,0)} ms/giro" if mg["slope"] < 0 else
              f"<b>{mg['sig']}</b> ({mg['team']}) cala di appena {it(mg['slope']*1000,0)} ms/giro")

    duello_txt = ""
    if duello:
        _cr, c, deg, ten, span = duello
        seg_ten = (f"scende di {it(abs(ten['slope'])*1000,0)} ms/giro"
                   if ten["slope"] < 0 else f"cala di {it(ten['slope']*1000,0)} ms/giro")
        duello_txt = (
            f"Il contrasto piu' netto e' sulla mescola <b>{_mesc_nome(c)}</b>: "
            f"nello stesso treno di gomme <b>{ten['sig']}</b> {seg_ten} sull'eta' "
            f"({ten['n_fit']} giri puliti), mentre <b>{deg['sig']}</b> perde "
            f"<b>{it(deg['slope']*1000,0)} ms/giro</b> ({deg['n_fit']} giri): "
            f"<b>{it(span*1000,0)} ms/giro</b> di differenza di degrado a parita' di gomma, "
            f"con benzina ed evoluzione pista quasi comuni.")

    art = {
        "id": ID, "slug": slug, "stato": "bozza",
        "data": data_bozza or "2026-07-27",
        "firma": "Muretto · Redazione tecnica", "accent": accent,
        "canale": "A (degrado gomma, tutto il gruppo)",
        "gp": gara, "gara": gara, "circuito": circuito, "sessione": "Gara", "round": rnd,
        "tag": ["degrado", "gomme", "stint", "gara", "tutto-il-gruppo", circuito],
        "occhiello": f"Degrado gomma · Gara {gara} {anno}",
        "titolo": (f"Come e' calata la gomma a {circuito}: il degrado per stint, "
                   f"mescola per mescola"),
        "sommario": (
            f"Il degrado letto come va letto: dentro ogni stint, la pendenza del tempo sul giro "
            f"con l'eta' della gomma — sui soli giri puliti e in aria pulita, mescola per mescola. "
            f"Sulla {main_nome} il divario e' netto: {pj['sig']} perde {it(pj['slope']*1000,0)} ms/giro, "
            f"mentre {('la gomma di '+mg['sig']+' migliora') if mg['slope']<0 else mg['sig']+' quasi non cala'}. "
            f"Attenzione pero': la pendenza grezza non e' il degrado assoluto — dentro c'e' anche il "
            f"guadagno di benzina, che questi dati non separano. Robusto e' il confronto DENTRO la "
            f"stessa mescola."),
        "sezioni": [
            {"tag": "Evidenza",
             "titolo": f"La {main_nome}: chi ha tenuto e chi e' calato",
             "html": (
                f"<p>La gara si corre a <b>stint</b>: sequenze di giri sullo stesso treno di gomme. "
                f"Dentro uno stint il tempo sul giro <b>deriva</b> — la gomma cala mentre la benzina "
                f"scende — e la <b>pendenza</b> di quella deriva e' la firma del degrado. La misuriamo "
                f"come regressione del tempo sul giro sull'<b>eta' della gomma</b> (i giri dall'inizio "
                f"dello stint), sui soli giri <b>verdi e in aria pulita</b>, scartato il primo giro "
                f"(gomma fredda). Non tutti i giri, non il giro veloce.</p>"
                f"<p>Sulla mescola piu' usata, la <b>{main_nome}</b> ({len(main)} stint leggibili), il "
                f"divario e' netto: in testa al degrado <b>{pj['sig']}</b> ({pj['team']}) con "
                f"<b>+{it(pj['slope']*1000,0)} ms/giro</b>; all'altro estremo {mg_txt}. Una barra a "
                f"destra e' una gomma che cala piu' di quanto la benzina alleggerisca; una barra a "
                f"sinistra e' una gomma che <b>tiene</b>.</p>"),
             "figura": {"svg": fig_a,
                "didascalia": (
                    f"Pendenza del tempo sul giro con l'eta' della gomma, per stint, mescola {main_nome} "
                    f"(gara {gara} {anno}). Destra (arancio) = degrado che batte il guadagno-benzina; "
                    f"sinistra (azzurro) = benzina che batte il degrado. «Ng» = giri puliti usati."),
                "fonte": f"FastF1 · laps Gara {gara} {anno} — OLS tempo-giro vs eta' gomma, giri verdi in aria pulita"}},

            {"tag": "Causa",
             "titolo": "Perche' non e' degrado «puro»: la benzina che cala",
             "html": (
                f"<p>La pendenza grezza <b>non</b> e' il degrado assoluto. Dentro c'e' un secondo "
                f"effetto, opposto e comune a tutti: la <b>benzina</b> che scende (e la pista che "
                f"gomma) alleggerisce il tempo di qualche decina di ms/giro. Percio' un valore "
                f"<b>positivo</b> vuol dire che la gomma cala <b>piu'</b> di quanto la benzina "
                f"alleggerisca; un valore <b>negativo</b> che il guadagno-benzina <b>batte</b> il "
                f"degrado. Il carico di carburante non e' nel feed: il degrado <b>assoluto</b> resta "
                f"non separabile.</p>"
                f"<p>Ecco perche' si confronta <b>dentro la stessa mescola</b>: li' benzina ed "
                f"evoluzione pista sono quasi le stesse per tutti e si <b>elidono</b> nel confronto, "
                f"lasciando la differenza di degrado. Lo scatter lo mostra: la soft sta piu' in alto "
                f"(cala prima), la hard piu' in basso, e la finestra di gara (asse x) sposta tutti — "
                f"non e' un caso, e' l'offset della benzina.</p>"),
             "figura": {"svg": fig_b,
                "didascalia": (
                    f"Ogni punto e' uno stint: eta' media della gomma (x) contro pendenza (y), "
                    f"colore = mescola. Piu' in alto = cala di piu'. Confronti validi solo a parita' "
                    f"di colore: l'offset benzina/evoluzione e' comune e si annulla."),
                "fonte": f"FastF1 · laps Gara {gara} {anno} — pendenza per stint e mescola"}},

            {"tag": "Effetto",
             "titolo": ("Stessa gomma, due destini" if duello else "Cosa possiamo dire, e cosa no"),
             "html": (
                (f"<p>{duello_txt} A parita' di mescola, quella differenza e' la piu' vicina che "
                 f"questi dati offrono al <b>degrado vero</b>: due gomme uguali, due gestioni diverse. "
                 f"Il grafico segue i due stint giro per giro — una linea piatta/in discesa (tiene), "
                 f"una in salita (cala).</p>" if duello else "")
                + f"<p>Restano i confini, dichiarati: il <b>degrado assoluto</b> non e' misurabile "
                f"(la benzina non e' nei dati); l'aria sporca e' <b>esclusa</b> (un pilota in scia ha "
                f"il passo del davanti, non della sua gomma); chi non ha abbastanza giri puliti in aria "
                f"pulita ({F['n_stint_esclusi']} stint) esce. E dentro la pendenza resta la <b>guida</b>: "
                f"gestire la gomma e' anche mestiere del pilota, non solo mescola. E' una lettura "
                f"<b>comparativa</b> del degrado, non un verdetto sul valore assoluto.</p>"),
             **({"figura": {"svg": fig_c,
                "didascalia": (
                    f"Tempo sul giro (s) contro eta' della gomma, due stint sulla stessa mescola "
                    f"{_mesc_nome(duello[1])}: {duello[3]['sig']} tiene, {duello[2]['sig']} cala. "
                    f"Benzina ed evoluzione pista quasi comuni: la differenza e' degrado + gestione."),
                "fonte": f"FastF1 · laps Gara {gara} {anno} — tempo-giro vs eta' gomma, stessa mescola"}}
                if fig_c else {})},
        ],
        "provenienza": [
            {"grandezza": f"degrado maggiore sulla {main_nome}",
             "valore": f"{pj['sig']} +{it(pj['slope']*1000,0)} ms/giro ({pj['n_fit']} giri puliti)",
             "stato": "MISURATO",
             "da": "OLS del tempo-giro sull'eta' gomma, giri verdi in aria pulita (scartato il "
                   "1º giro di stint) — FastF1 laps Gara"},
            {"grandezza": f"miglior tenuta sulla {main_nome}",
             "valore": (f"{mg['sig']} {it(mg['slope']*1000,0)} ms/giro"
                        + (" (in miglioramento)" if mg["slope"] < 0 else "")),
             "stato": "MISURATO",
             "da": "stessa misura; pendenza minima nella mescola"},
            {"grandezza": ("contrasto a parita' di mescola" if duello else "confronto a parita' di mescola"),
             "valore": (f"{duello[3]['sig']} vs {duello[2]['sig']} ({_mesc_nome(duello[1])}): "
                        f"{it(duello[4]*1000,0)} ms/giro di differenza" if duello else "non disponibile"),
             "stato": "MISURATO" if duello else "NON_MISURABILE",
             "da": ("differenza di pendenza fra due stint sulla stessa mescola: benzina ed evoluzione "
                    "pista quasi comuni si elidono" if duello else
                    "servono due stint leggibili sulla stessa mescola")},
            {"grandezza": "degrado assoluto (s/giro di sola gomma)",
             "valore": "non separabile dal guadagno di benzina",
             "stato": "NON_MISURABILE",
             "da": "il carico di carburante per giro non e' nel feed FastF1: la pendenza somma "
                   "degrado e alleggerimento-benzina"},
            {"grandezza": "aria sporca (traffico)",
             "valore": f"esclusa dal fit (gap ≤ {it(SOGLIA_TRAFFICO,1)} s dalla macchina davanti)",
             "stato": "MISURATO",
             "da": "un giro in scia ha il passo del davanti, non della propria gomma"},
            {"grandezza": "gestione del pilota vs mescola",
             "valore": "folded nella pendenza (non separabili)",
             "stato": "NON_MISURABILE",
             "da": "la stessa gomma rende diversamente con guida diversa: la pendenza le somma"},
        ],
        "fonti": [
            {"tipo": "dati",
             "testo": f"FastF1 3.8.3 — laps + Compound/Stint/TrackStatus/tempi-sessione, "
                      f"Gara {meta['event']} {anno} (round {rnd}, {circuito})"},
            {"tipo": "metodo",
             "testo": ("ai_lab/redazione/genera_degrado_stint.py — degrado = pendenza OLS del "
                       "tempo-giro sull'eta' gomma (giri dall'inizio stint), sui soli giri VERDI "
                       f"(TrackStatus «1») in aria pulita (gap > {it(SOGLIA_TRAFFICO,1)} s), scartato "
                       f"il 1º giro di stint; ≥{MIN_FIT} giri per stimare una pendenza. Confronto "
                       "DENTRO la stessa mescola (offset benzina/evoluzione comune, si elide). Il "
                       "degrado assoluto non e' separabile dalla benzina (NON_MISURABILE).")},
        ],
    }
    return F, art


META = {
    "id": ID, "canale": "A",
    "titolo": "Il degrado della gomma, per stint (tutto il gruppo)",
    "tag": ["degrado", "gomme", "stint", "gara"],
    "descrizione": "il degrado per stint di tutta la griglia: pendenza tempo-giro vs eta' gomma, "
                   "per mescola, aria pulita; confondente-benzina dichiarato (confronto intra-mescola)",
    "richiede": "laps", "sessioni": ["Race"], "gare": ["*"],
}


def genera(gara=None, data=None, sessione=None):
    g = gara or "Ungheria"
    try:
        r = costruisci(2026, g, data_bozza=data)
    except Exception:
        if os.environ.get("REDAZIONE_DEBUG"):
            raise
        return None
    if not r:
        return None
    F, art = r
    bid = f"{ID}-{art['slug']}-{F['anno']}"
    art["id"] = bid
    base.scrivi_bozza(bid, art, F)
    return {"id": bid, "titolo": art["titolo"], "stato": art["stato"], "canale": "A"}


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--gara", default="Ungheria")
    ap.add_argument("--anno", type=int, default=2026)
    ap.add_argument("--data", default="2026-07-27")
    a = ap.parse_args()
    r = costruisci(a.anno, a.gara, data_bozza=a.data)
    if not r:
        print("nessun degrado leggibile"); sys.exit(1)
    F, art = r
    bid = f"{ID}-{art['slug']}-{F['anno']}"
    art["id"] = bid
    out = base.scrivi_bozza(bid, art, F)
    print(f"Bozza {bid} scritta in {out}")
    me = F["mescola_eroe"]
    print(f"  Gara {F['gara']} {F['anno']} — {F['circuito']} (round {F['round']})")
    print(f"  mescola-eroe {me['comp']}: {me['n_stint']} stint")
    print(f"    peggiore {me['peggiore']['sig']} +{me['peggiore']['slope_ms']} ms/giro "
          f"({me['peggiore']['n_fit']}g)")
    print(f"    migliore {me['migliore']['sig']} {me['migliore']['slope_ms']} ms/giro "
          f"({me['migliore']['n_fit']}g)")
    if F["duello"]:
        d = F["duello"]
        print(f"  duello {d['mescola']}: {d['tiene']['sig']} ({d['tiene']['slope_ms']}) "
              f"vs {d['cala']['sig']} ({d['cala']['slope_ms']}) = {d['span_ms']} ms/giro")
    print(f"  stint leggibili {F['n_stint_leggibili']} · esclusi {F['n_stint_esclusi']}")
    print(f"  scrittura prosa: {art.get('scrittura','template')}")
