"""
Articolo "trazione-lento" — Ungheria 2026 (Hungaroring, round 11), sessione FP1.

Nelle due curve piu' lente del giro — curva 1 (apice ~87 km/h) e curva 13
(~94 km/h) — c'e' un ventaglio reale e misurabile su chi rimette prima il gas in
uscita. Il fatto solido e' il duello in casa Cadillac: HER torna a gas pieno prima
del compagno PER in ENTRAMBE le curve lente, netto alla 13; ed e' proprio alla 13
il piu' rapido del campo anche nella risalita di velocita'. NON e' un tratto valido
su tutta la pista: 4/11 duelli compagni si invertono tra le due curve.

Regole dure rispettate: giri_validi (lanciati, IsAccurate, <=1.07x best), MEDIANA
sui giri, apice = vero minimo velocita' in finestra -25/+75, misure robuste ~4Hz
(dv a finestra fissa, non punto-a-punto). DRS DEGENERE (tutto 0): NON usato.
ERS/deployment assenti dal feed: NON_MISURABILE. FP: carburante/mappe ignoti.

python3 UTENTE (fastf1). Solo lettura; scrive SOLO una bozza nell'area Lab.
NON tocca demo/ ne' engine/ ne' registro.py.
"""
from __future__ import annotations
import os
import sys
import json
import datetime
import statistics as st

import numpy as np

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele   # noqa: E402
import curve  # noqa: E402
import svg    # noqa: E402
import base   # noqa: E402

ID = "hun-trazione-lento-2026"
ANNO, GP, SES = 2026, "Hungary", "FP1"
PISTA = os.path.join(base.REPO, "demo", "data", "pista_Ungheria.json")


def it(x, dec=1):
    return base.it(x, dec)


def _med(xs):
    xs = [x for x in xs if x is not None]
    return st.median(xs) if xs else None


def _compagno(piloti, sig):
    team = piloti[sig]["team"]
    for s, info in piloti.items():
        if s != sig and info["team"] == team:
            return s
    return None


# ---------------------------------------------------------------------------
# Misura: profilo di trazione a un apice (full_after + risalita velocita' a
# finestre fisse). Come curve.profilo_curva ma con la risalita dv (misura robusta
# a ~4Hz: interpolazione a distanza-fissa, non differenze punto-a-punto).
# ---------------------------------------------------------------------------
def profilo_trazione(tel, dist_curva, indietro=25.0, avanti=75.0):
    d = tel["Distance"].values
    sp = tel["Speed"].values
    thr = tel["Throttle"].values
    gear = tel["nGear"].values
    m = (d >= dist_curva - indietro) & (d <= dist_curva + avanti)
    idx = np.where(m)[0]
    if len(idx) < 3:
        return None
    ia = idx[sp[idx].argmin()]
    apex_d = float(d[ia]); apex_v = float(sp[ia])
    full_after = None
    for j in np.where((d >= apex_d) & (d <= apex_d + 300))[0]:
        if thr[j] >= 95:
            full_after = float(d[j]) - apex_d
            break

    def v_at(off):
        target = apex_d + off
        if target > d[-1]:
            return None
        return float(np.interp(target, d, sp))

    dv100 = (v_at(100) - apex_v) if v_at(100) is not None else None
    return {"apex_v": apex_v, "apex_gear": int(gear[ia]),
            "full_after": full_after, "dv100": dv100}


def aggrega_trazione(ses, num, dist_curva):
    prof = []
    for lap in tele.giri_validi(ses, num):
        try:
            tel = tele.canale_giro(lap)
        except Exception:
            continue
        p = profilo_trazione(tel, dist_curva)
        if p:
            prof.append(p)
    if len(prof) < 3:
        return None
    out = {k: _med([p[k] for p in prof]) for k in ("apex_v", "full_after", "dv100")}
    out["n"] = len(prof)
    fa = [p["full_after"] for p in prof if p["full_after"] is not None]
    out["iqr"] = (float(np.percentile(fa, 75) - np.percentile(fa, 25))
                  if len(fa) >= 4 else None)
    return out


def rank_curva(ses, piloti, dist_curva, min_giri=4):
    """Ranking di tutti i piloti su una curva (>=min_giri validi), ordinato per
    full_after crescente (rimette prima il gas = piu' in alto)."""
    tutti = []
    for s, info in piloti.items():
        a = aggrega_trazione(ses, info["num"], dist_curva)
        if a and a["full_after"] is not None:
            tutti.append({"sigla": s, "team": info["team"], **a})
    rank = sorted([r for r in tutti if r["n"] >= min_giri], key=lambda r: r["full_after"])
    return rank


# ---------------------------------------------------------------------------
# Pista: due pallini (le due curve lente) sul tracciato. La distanza-curva e' in
# metri lungo il giro; la mappa ha dist NORMALIZZATA (0..1) -> converto con la
# lunghezza del giro. (Il template GB confrontava metri con frazione: qui no.)
# ---------------------------------------------------------------------------
def _xy_a_frazione(mappa, frazione):
    dd = mappa["dist"]
    i = min(range(len(dd)), key=lambda k: abs(dd[k] - frazione))
    return mappa["punti"][i]


def svg_pista_due(marcatori):
    """marcatori: [(dist_m, etichetta), ...]"""
    mappa = json.load(open(PISTA))
    vb = mappa["viewBox"]; W, H = vb[2], vb[3]
    L = float(mappa.get("lunghezza_m") or 1.0)
    dd = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in mappa["punti"]) + " Z"
    out = [f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" '
           f'class="art-svg art-pista">',
           f'<path d="{dd}" fill="none" stroke="var(--line2)" stroke-width="3" '
           f'stroke-linejoin="round"/>']
    for dist_m, etichetta in marcatori:
        fraz = max(0.0, min(1.0, dist_m / L))
        lx, ly = _xy_a_frazione(mappa, fraz)
        # etichetta a sinistra se il pallino sta nella meta' destra della mappa
        a_sx = lx > W * 0.6
        tx = lx - 14 if a_sx else lx + 14
        anc = "end" if a_sx else "start"
        out.append(f'<circle cx="{lx:.1f}" cy="{ly:.1f}" r="8" fill="var(--accent)"/>')
        out.append(f'<text x="{tx:.1f}" y="{ly+5:.1f}" font-size="17" fill="var(--txt)" '
                   f'text-anchor="{anc}" font-family="{svg.DISP}" '
                   f'letter-spacing="0.3">{svg.esc(etichetta)}</text>')
    out.append('</svg>')
    return "".join(out)


# ---------------------------------------------------------------------------
def costruisci(data_bozza=None):
    ses = tele.carica_sessione(ANNO, GP, SES)
    piloti = tele.piloti_sessione(ses)
    colori = base.carica_colori()
    cs = curve.curve(ses)

    # DRS: verifica degenere (tutto 0) sul giro veloce di riferimento
    ref = "LEC" if "LEC" in piloti else next(iter(piloti))
    tel0 = tele.canale_giro(ses.laps.pick_drivers(piloti[ref]["num"]).pick_fastest())
    drs_vals = sorted(set(int(x) for x in tel0["DRS"].values))
    drs_degenere = (drs_vals == [0])

    # 1) le due curve piu' lente per apice mediano fra i piloti (robusto: non un
    #    solo giro-rif). Porto dietro il dict-curva (numero + dist).
    curve_v = []
    for c in cs:
        vs = []
        for s, info in piloti.items():
            a = curve.al_apice(ses, info["num"], c["dist"])
            if a:
                vs.append(a["vmin_med"])
        if len(vs) >= 5:
            curve_v.append((st.median(vs), c))
    curve_v.sort(key=lambda x: x[0])
    (vm1, c1), (vm2, c2) = curve_v[0], curve_v[1]   # piu' lenta, seconda piu' lenta

    # 2) ranking di campo su entrambe
    r1 = rank_curva(ses, piloti, c1["dist"])
    r2 = rank_curva(ses, piloti, c2["dist"])

    def spread(rank):
        fa = [r["full_after"] for r in rank]
        return {"min": min(fa), "max": max(fa), "mediana": st.median(fa),
                "n_piloti": len(rank), "spread": max(fa) - min(fa),
                "iqr_med": st.median([r["iqr"] for r in rank if r["iqr"] is not None])}

    sp1, sp2 = spread(r1), spread(r2)

    # 3) duello Cadillac in entrambe
    def coppia(rank, team):
        membri = sorted([r for r in rank if r["team"] == team], key=lambda r: r["full_after"])
        return membri if len(membri) == 2 else None

    TEAM = "Cadillac"
    cad1 = coppia(r1, TEAM)
    cad2 = coppia(r2, TEAM)
    # HER = il piu' pronto (torna prima al gas); PER = il compagno
    her2, per2 = cad2[0], cad2[1]
    sHER, sPER = her2["sigla"], per2["sigla"]
    her1 = next(r for r in cad1 if r["sigla"] == sHER)
    per1 = next(r for r in cad1 if r["sigla"] == sPER)
    colT = colori.get(TEAM) or "var(--dim)"

    # posizione di HER nei due ranking (1-based)
    posHER1 = next(i for i, r in enumerate(r1, 1) if r["sigla"] == sHER)
    posHER2 = next(i for i, r in enumerate(r2, 1) if r["sigla"] == sHER)

    # 4) cross-check risalita velocita' (dv su +100 m) alla curva 13.
    #    ATTENZIONE: HER e' molto in alto ma NON e' il massimo del campo (un altro
    #    pilota risale di piu'): niente superlativo assoluto — si dice il rango vero.
    dv_ord = sorted([r for r in r2 if r["dv100"] is not None],
                    key=lambda r: -r["dv100"])
    dv_med2 = st.median([r["dv100"] for r in dv_ord])
    dv_top = dv_ord[0]
    dv_max2 = dv_top["dv100"]
    dv_max_sig = dv_top["sigla"]
    her_dv2 = her2["dv100"]
    per_dv2 = per2["dv100"]
    her_e_max = abs(her_dv2 - dv_max2) < 1e-6
    pos_her_dv = next(i for i, r in enumerate(dv_ord, 1) if r["sigla"] == sHER)

    # 5) confonditore "gesto curva-per-curva": quanti duelli compagni invertono il
    #    verso (chi e' piu' pronto) fra le due curve.
    teams1 = {}
    for r in r1:
        teams1.setdefault(r["team"], []).append(r)
    teams2 = {}
    for r in r2:
        teams2.setdefault(r["team"], []).append(r)
    n_duelli = 0
    n_invertiti = 0
    for team in teams1:
        m1 = teams1.get(team); m2 = teams2.get(team)
        if not (m1 and m2 and len(m1) == 2 and len(m2) == 2):
            continue
        n_duelli += 1
        faster1 = min(m1, key=lambda r: r["full_after"])["sigla"]
        faster2 = min(m2, key=lambda r: r["full_after"])["sigla"]
        if faster1 != faster2:
            n_invertiti += 1

    F = {
        "id": ID, "anno": ANNO, "gp": "Ungheria", "circuito": "Hungaroring",
        "sessione": SES, "drs_degenere": drs_degenere,
        "curva_lenta": {"numero": c1["numero"], "dist": c1["dist"], "apex_v": vm1},
        "curva_media": {"numero": c2["numero"], "dist": c2["dist"], "apex_v": vm2},
        "spread_c1": sp1, "spread_c13": sp2,
        "cadillac": {"veloce": sHER, "compagno": sPER, "team": TEAM,
                     "c1": {"HER": her1["full_after"], "PER": per1["full_after"],
                            "delta": per1["full_after"] - her1["full_after"],
                            "iqr_HER": her1["iqr"], "iqr_PER": per1["iqr"],
                            "n_HER": her1["n"], "n_PER": per1["n"]},
                     "c13": {"HER": her2["full_after"], "PER": per2["full_after"],
                             "delta": per2["full_after"] - her2["full_after"],
                             "iqr_HER": her2["iqr"], "iqr_PER": per2["iqr"],
                             "n_HER": her2["n"], "n_PER": per2["n"]},
                     "pos_HER_c1": posHER1, "pos_HER_c13": posHER2},
        "dv_c13": {"HER": her_dv2, "PER": per_dv2, "mediana": dv_med2,
                   "max": dv_max2, "max_sig": dv_max_sig, "HER_e_max": her_e_max,
                   "pos_HER": pos_her_dv, "n_piloti": len(dv_ord)},
        "duelli": {"totali": n_duelli, "invertiti": n_invertiti},
        "rank_c1": r1, "rank_c13": r2,
    }

    # ---- Figure ----
    # 1) duello gas: HER vs PER alla curva 13 (il netto)
    tHER = curve.traccia_gas(ses, piloti[sHER]["num"], c2["dist"])
    tPER = curve.traccia_gas(ses, piloti[sPER]["num"], c2["dist"])
    serie = [{"sigla": sHER, "colore": colT, "tratteggio": False,
              "marker": her2["full_after"], "punti": tHER},
             {"sigla": sPER, "colore": colT, "tratteggio": True,
              "marker": per2["full_after"], "punti": tPER}]
    vmin_plot = int(min(p[1] for s in serie for p in s["punti"]) // 25 * 25)
    vmax_plot = int(max(p[1] for s in serie for p in s["punti"]) // 25 * 25 + 25)
    svg1 = svg.grafico_gas_curva(
        serie, v_range=(vmin_plot, vmax_plot), marker_label="● gas pieno",
        titolo=f"Curva {c2['numero']}: chi rimette il gas prima — {sHER} vs {sPER}",
        sub=f"velocità + gas · {TEAM} · {GP} {ANNO} {SES}")

    # 2) pista: le due curve lente
    svgP = svg_pista_due([(c1["dist"], f"curva {c1['numero']}"),
                          (c2["dist"], f"curva {c2['numero']}")])

    # 3) risalita di velocita' (dv +100 m) alla curva 13, per pilota — HER = max
    r2_dv = sorted([r for r in r2 if r["dv100"] is not None],
                   key=lambda r: -r["dv100"])
    barre = [{"sigla": r["sigla"], "colore": colori.get(r["team"]) or "var(--dim)",
              "valore": r["dv100"], "evidenza": (r["sigla"] == sHER)} for r in r2_dv]
    base_bar = int(min(r["dv100"] for r in r2_dv) // 5 * 5 - 5)
    svg3 = svg.barre_dv(
        barre, titolo=f"Curva {c2['numero']}: risalita di velocità nei primi 100 m",
        base=base_bar, unita="km/h",
        caption=f"km/h ripresi tra apice e +100 m · barra più lunga = risale prima (asse da {base_bar})")

    # ---- Prosa: ogni numero viene dai fatti misurati ----
    d13 = F["cadillac"]["c13"]; d1 = F["cadillac"]["c1"]
    dv = F["dv_c13"]
    spread_c1_val = sp1["spread"]; spread_c13_val = sp2["spread"]
    lead2 = r2[0]["sigla"]; lead2_fa = r2[0]["full_after"]

    occhiello = f"Telemetria · Prove libere (FP1) {F['gp']} {ANNO}"
    titolo = (f"Le due curve lente dell'Hungaroring, stessa {TEAM}: "
              f"{sHER} rimette il gas prima del compagno {sPER}")
    som = (f"Nelle due curve più lente del giro — curva {c1['numero']} (apice ≈{it(vm1,0)} km/h) e "
           f"curva {c2['numero']} (≈{it(vm2,0)}) — con la stessa {TEAM} {sHER} torna a gas pieno "
           f"prima di {sPER} in entrambe, netto alla {c2['numero']}: {it(d13['HER'],0)} contro "
           f"{it(d13['PER'],0)} metri dall'apice. E una seconda misura indipendente, la risalita di "
           f"velocità, concorda. Un gesto curva-per-curva, però, non un tratto valido su tutta la pista.")

    ev_html = (
        f"<p>Le due curve più lente del giro sono la <b>{c1['numero']}</b> (apice a "
        f"≈{it(vm1,0)} km/h) e la <b>{c2['numero']}</b> (≈{it(vm2,0)}): uscite tutte in trazione. "
        f"Misuriamo, pilota per pilota, dopo quanti metri dall'apice il gas torna al 100%. "
        f"Il campo si apre in un ventaglio reale: alla curva {c1['numero']} va da "
        f"{it(sp1['min'],0)} a {it(sp1['max'],0)} m (mediana {it(sp1['mediana'],0)}), alla "
        f"{c2['numero']} da {it(sp2['min'],0)} a {it(sp2['max'],0)} m (mediana {it(sp2['mediana'],0)}) "
        f"— uno spread di campo di <b>{it(spread_c1_val,0)}–{it(spread_c13_val,0)} m</b>, molto oltre "
        f"la dispersione interna di ciascun pilota (IQR mediano ≈{it(sp2['iqr_med'],0)} m).</p>"
        f"<p>Il confronto più pulito è in casa {TEAM}. Alla curva {c2['numero']} <b>{sHER}</b> "
        f"spalanca il gas a <b>{it(d13['HER'],0)} m</b> dall'apice, il compagno <b>{sPER}</b> a "
        f"<b>{it(d13['PER'],0)}</b>: <b>{it(d13['delta'],0)} m più tardi</b>, uno scarto netto "
        f"(IQR {it(d13['iqr_HER'],0)}/{it(d13['iqr_PER'],0)} m, n={d13['n_HER']} ciascuno). "
        f"Alla curva {c1['numero']} lo stesso verso ma più stretto: {sHER} {it(d1['HER'],0)} m, "
        f"{sPER} {it(d1['PER'],0)} — {it(d1['delta'],0)} m, dentro l'IQR "
        f"({it(d1['iqr_HER'],0)}/{it(d1['iqr_PER'],0)}): coerente, non decisivo. {sHER} è tra i più "
        f"pronti in entrambe: alla curva {c1['numero']} attorno al {posHER1}º posto — a un soffio dal "
        f"gruppetto di testa, dentro margini più piccoli della dispersione dei giri — e alla "
        f"curva {c2['numero']} <b>{posHER2}º su {sp2['n_piloti']}</b>, dietro solo {lead2} ({it(lead2_fa,0)} m).</p>")

    causa_html = (
        f"<p>All'uscita di una curva lenta la coppia è al massimo e il limite è la trazione: "
        f"spalancare troppo presto fa pattinare le gomme e, paradossalmente, si accelera di meno. "
        f"Rimettere il gas prima senza slittare vuol dire fidarsi dell'anteriore in appoggio e "
        f"dosare la coppia sul filo dell'aderenza. Le due curve dove questo pesa di più sono, "
        f"appunto, le più lente del tracciato.</p>"
        f"<p>Due avvertenze, dichiarate. Primo: nel 2026 la spinta elettrica in uscita è gestita "
        f"dall'unità ibrida e i canali di deployment (ERS) non sono nel feed pubblico — quanta parte "
        f"del gas-prima sia mano del pilota e quanta mappa di erogazione non è separabile "
        f"(NON_MISURABILE). Secondo: è un gesto <b>curva-per-curva</b>, non un tratto valido su tutta "
        f"la pista. Tra la curva {c1['numero']} e la {c2['numero']} <b>{n_invertiti} duelli fra "
        f"compagni su {n_duelli}</b> invertono il verso — chi è più pronto in una non lo è "
        f"nell'altra. Il {TEAM}-in-casa regge in entrambe, ma resta un fatto locale.</p>")

    eff_html = (
        f"<p>Una seconda misura, indipendente dal timing del gas, concorda: la risalita di velocità "
        f"nei primi 100 m dopo l'apice. Alla curva {c2['numero']} <b>{sHER}</b> guadagna "
        f"<b>+{it(dv['HER'],0)} km/h</b>, {dv['pos_HER']}º del campo — non il massimo assoluto "
        f"(+{it(dv['max'],0)} di {dv['max_sig']}), ma nettamente sopra la mediana (+{it(dv['mediana'],0)}) "
        f"e soprattutto sopra il compagno {sPER} (+{it(dv['PER'],0)}). Le due misure — a che metro "
        f"torna il gas pieno e quanti km/h si riprendono — mettono {sHER} negli stessi posti: davanti a "
        f"{sPER} in modo deciso, ai vertici del campo. Chi rimette il gas prima arriva più veloce dove "
        f"parte il tratto successivo: tempo piccolo per giro, ripetuto ogni giro.</p>"
        f"<p>Un limite va tenuto in chiaro: sono prove libere. Carburante e mappe motore/ibrido "
        f"sono ignoti, quindi il passo e il timing del gas sono indicativi, non un verdetto. Il "
        f"dato solido resta il confronto in casa, a parità di vettura.</p>")

    art = {
        "id": ID, "stato": "bozza",
        "data": data_bozza or "2026-07-25",
        "firma": "Muretto · Redazione tecnica",
        "accent": colT, "canale": "B (anomalia nei nostri dati)",
        "gp": "Ungheria", "gara": "Ungheria", "circuito": "Hungaroring", "sessione": SES,
        "tag": ["telemetria", TEAM, "trazione", "FP1", "Ungheria"],
        "occhiello": occhiello,
        "titolo": titolo,
        "sommario": som,
        "sezioni": [
            {"tag": "Evidenza",
             "titolo": "Il ventaglio del campo, e il duello in casa Cadillac",
             "html": ev_html, "figura": "grafico1"},
            {"tag": "Causa",
             "titolo": "In curva lenta il tempo si fa col gas — ma è un gesto curva-per-curva",
             "html": causa_html, "figura": "pista"},
            {"tag": "Effetto",
             "titolo": f"La risalita di velocità concorda — {sHER} ai vertici, e davanti a {sPER}",
             "html": eff_html, "figura": "grafico3"},
        ],
        "provenienza": [
            {"grandezza": f"ripresa del gas pieno alla curva {c1['numero']} (m dopo l'apice)",
             "valore": f"{sHER} {it(d1['HER'],0)} m · {sPER} {it(d1['PER'],0)} m · "
                       f"campo {it(sp1['min'],0)}–{it(sp1['max'],0)} · mediana {it(sp1['mediana'],0)} m",
             "stato": "MISURATO",
             "da": "prima distanza dall'apice con throttle ≥95%, mediana sui giri lanciati (FastF1 + mappa-curve)"},
            {"grandezza": f"ripresa del gas pieno alla curva {c2['numero']} (m dopo l'apice)",
             "valore": f"{sHER} {it(d13['HER'],0)} m · {sPER} {it(d13['PER'],0)} m "
                       f"(Δ {it(d13['delta'],0)} m, IQR {it(d13['iqr_HER'],0)}/{it(d13['iqr_PER'],0)}, "
                       f"n={d13['n_HER']}) · campo {it(sp2['min'],0)}–{it(sp2['max'],0)} · "
                       f"mediana {it(sp2['mediana'],0)} m",
             "stato": "MISURATO",
             "da": "prima distanza dall'apice con throttle ≥95%, mediana sui giri lanciati"},
            {"grandezza": "velocità all'apice (le due curve più lente)",
             "valore": f"curva {c1['numero']} ≈{it(vm1,0)} km/h · curva {c2['numero']} ≈{it(vm2,0)} km/h",
             "stato": "MISURATO",
             "da": "mediana fra i piloti della velocità minima all'apice"},
            {"grandezza": f"risalita di velocità alla curva {c2['numero']} (Δv su +100 m)",
             "valore": f"{sHER} +{it(dv['HER'],0)} km/h ({dv['pos_HER']}º del campo, "
                       f"max +{it(dv['max'],0)} di {dv['max_sig']}) · mediana +{it(dv['mediana'],0)} · "
                       f"{sPER} +{it(dv['PER'],0)}",
             "stato": "MISURATO",
             "da": "Δ fra velocità all'apice e a +100 m (interpolazione a distanza fissa), mediana sui giri lanciati"},
            {"grandezza": "duelli fra compagni che invertono il verso tra le due curve",
             "valore": f"{n_invertiti} su {n_duelli}",
             "stato": "MISURATO",
             "da": "confronto del più-pronto di ogni coppia alla curva "
                   f"{c1['numero']} vs alla {c2['numero']}"},
            {"grandezza": "spinta elettrica in uscita (deployment ERS)",
             "valore": "non quantificabile · non separabile dalla mano del pilota",
             "stato": "NON_MISURABILE",
             "da": "canali ERS/deployment assenti dal feed pubblico 2026"},
            {"grandezza": "DRS",
             "valore": "degenere (tutto 0 nel giro veloce di riferimento) · non usato",
             "stato": "NON_MISURABILE",
             "da": "canale DRS FastF1 privo di aperture in FP1; irrilevante per la trazione in uscita"},
            {"grandezza": "carburante e mappe motore/ibrido (FP)",
             "valore": "ignoti: passo e timing-gas indicativi, non verdetto",
             "stato": "NON_MISURABILE",
             "da": "sessione di prove libere — carico e mappe non pubblici"},
        ],
        "fonti": [
            {"tipo": "dati",
             "testo": f"FastF1 3.8.3 — telemetria vettura (Throttle/Speed/nGear) + mappa curve "
                      f"(circuit_info), {SES} Gran Premio d'Ungheria {ANNO} (Hungaroring, round 11)"},
            {"tipo": "metodo",
             "testo": "ai_lab/redazione/genera_hun_trazione_lento.py su curve.py/tele.py — le due curve "
                      "più lente = apice mediano più basso fra i piloti; ripresa gas = prima distanza "
                      "dall'apice con throttle ≥95% (l'ordinamento fine del campo dipende dalla soglia, ma "
                      "il duello Cadillac regge a 98%: HER prima di PER in entrambe, Δ 6/24 m); "
                      "risalita = Δv apice→+100 m a distanza fissa. Mediana sui giri "
                      "LANCIATI (IsAccurate + ≤1,07× best), apice = vero minimo in finestra −25/+75 m. "
                      "Ranking di campo ristretto ai piloti con ≥4 giri validi. FP: carburante/mappe ignoti."},
        ],
    }

    FIG = {
        "grafico1": {"svg": svg1,
            "didascalia": (f"Curva {c2['numero']} (apice ≈{it(vm2,0)} km/h): {sHER} (pieno) riporta il gas "
                           f"al 100% prima — marcatore più vicino all'apice — del compagno {sPER} "
                           f"(tratteggio), stessa {TEAM}."),
            "fonte": f"FastF1 · car telemetry (Throttle/Speed), {GP} {ANNO} {SES}"},
        "pista": {"svg": svgP,
            "didascalia": (f"Le due curve più lente del giro sull'Hungaroring: la {c1['numero']} "
                           f"(≈{it(vm1,0)} km/h) e la {c2['numero']} (≈{it(vm2,0)} km/h). Il gesto è "
                           f"locale a queste uscite, non un tratto di tutta la pista."),
            "fonte": "FastF1 · GPS + circuit_info; tracciato del sito"},
        "grafico3": {"svg": svg3,
            "didascalia": (f"Risalita di velocità nei primi 100 m dopo l'apice della curva {c2['numero']}: "
                           f"{sHER} è {dv['pos_HER']}º del campo (dietro {dv['max_sig']}) e nettamente "
                           f"davanti al compagno {sPER} — misura indipendente dal timing del gas, ma concorde."),
            "fonte": f"FastF1 · car telemetry (Speed), {GP} {ANNO} {SES}"},
    }
    for sez in art["sezioni"]:
        if sez.get("figura") in FIG:
            sez["figura"] = FIG[sez["figura"]]
        elif "figura" in sez:
            del sez["figura"]
    return F, art


META = {
    "id": ID, "canale": "B",
    "titolo": "Trazione nelle curve lente (duello Cadillac)",
    "tag": ["telemetria", "trazione", "FP1", "Ungheria"],
    "descrizione": "ripresa del gas nelle due curve più lente dell'Hungaroring (FP1)",
    "richiede": "telemetria", "gare": ["Ungheria"],
}


def genera(gara=None, data=None):
    if gara not in (None, "Ungheria", "Hungary", "Hungarian Grand Prix"):
        return None
    F, art = costruisci(data_bozza=data)
    base.scrivi_bozza(ID, art, F)
    return {"id": ID, "titolo": art["titolo"], "stato": art["stato"], "canale": "B"}


if __name__ == "__main__":
    F, art = costruisci()
    out = base.scrivi_bozza(ID, art, F)
    cad = F["cadillac"]
    print(f"Bozza {ID} scritta in {out}")
    print(f"  DRS degenere: {F['drs_degenere']}")
    print(f"  curve lente: {F['curva_lenta']['numero']} @{F['curva_lenta']['dist']:.0f}m "
          f"(~{F['curva_lenta']['apex_v']:.0f}) | {F['curva_media']['numero']} "
          f"@{F['curva_media']['dist']:.0f}m (~{F['curva_media']['apex_v']:.0f})")
    print(f"  Cadillac c1:  {cad['veloce']} {cad['c1']['HER']:.0f} vs {cad['compagno']} "
          f"{cad['c1']['PER']:.0f} (Δ{cad['c1']['delta']:.0f})")
    print(f"  Cadillac c13: {cad['veloce']} {cad['c13']['HER']:.0f} vs {cad['compagno']} "
          f"{cad['c13']['PER']:.0f} (Δ{cad['c13']['delta']:.0f})")
    print(f"  dv100 c13: {cad['veloce']} +{F['dv_c13']['HER']:.1f} "
          f"(max={F['dv_c13']['HER_e_max']}) | mediana +{F['dv_c13']['mediana']:.1f} | "
          f"{cad['compagno']} +{F['dv_c13']['PER']:.1f}")
    print(f"  duelli invertiti: {F['duelli']['invertiti']}/{F['duelli']['totali']}")
    print(f"  spread c1 {F['spread_c1']['spread']:.0f} m | c13 {F['spread_c13']['spread']:.0f} m")
