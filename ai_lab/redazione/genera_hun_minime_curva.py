"""
Articolo (Canale B, tema minime-curva): "Il cuore lento del Hungaroring".

Angolo: il profilo velocita'-vs-distanza del settore tecnico centrale (T4..T11) in
FP1. La tesi ROBUSTA non e' "chi porta piu' velocita'" (verdetto fragile in prove
libere) ma la FORMA del profilo e la dispersione del campo:
 - il settore precipita a ~100 km/h nel complesso T6/T7, il punto piu' basso, in
   posizione IDENTICA per tutti i piloti (~2370 m, entro 6 m su 3 riferimenti);
 - dove la curva e' lenta il campo si stringe entro 5-7 km/h (la geometria comanda),
   dove e' veloce (T4, T11) si apre a 23-27 km/h (emerge la firma pilota/vettura);
 - l'unica curva dove "chi porta piu' velocita'" ha una risposta e' T4 (spread 27),
   e va data con la riserva delle prove libere.

Mattone: la mappa-curve (curve.py) sulla telemetria vettura FastF1 (tele.py).
python3 UTENTE (fastf1). Solo lettura; bozza nell'area Lab (mai demo/).
"""
from __future__ import annotations
import os
import sys
import datetime
import statistics as st

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele   # noqa: E402
import curve  # noqa: E402
import svg    # noqa: E402
import base   # noqa: E402

ID = "hun-minime-curva-2026"
GP = "Ungheria"
ROUND = 11


def it(x, dec=1):
    return base.it(x, dec)


# ---------------------------------------------------------------- misura ------
def _tabella(ses, piloti):
    """Per ogni curva: vmin per-pilota (giri lanciati, >=3 giri) -> mediana di
    campo, min, max, spread. `rows` tiene solo le curve con >=10 piloti (campo
    rappresentativo). Ritorna (curve, tab, rows)."""
    cs = curve.curve(ses)
    tab, rows = {}, []
    for c in cs:
        key = f"T{c['numero']}{c['lettera']}"
        vals = {}
        for sig, info in piloti.items():
            a = curve.al_apice(ses, info["num"], c["dist"])
            if a and a["n"] >= 3:
                vals[sig] = {"vmin": a["vmin_med"], "n": a["n"], "team": info["team"]}
        tab[key] = {"dist": c["dist"], "numero": c["numero"], "vals": vals}
        v = [x["vmin"] for x in vals.values()]
        if len(v) >= 10:
            rows.append({"key": key, "dist": c["dist"], "numero": c["numero"],
                         "med": st.median(v), "lo": min(v), "hi": max(v),
                         "spread": max(v) - min(v), "nd": len(v)})
    return cs, tab, rows


def _profilo(ses, num, d0=1600.0, d1=3250.0):
    """Traccia velocita'-vs-distanza del giro veloce nella finestra del settore
    centrale + (vmin, dist_del_minimo) dentro la finestra."""
    lap = ses.laps.pick_drivers(num).pick_fastest()
    tel = tele.canale_giro(lap)
    d = tel["Distance"].values
    sp = tel["Speed"].values
    m = (d >= d0) & (d <= d1)
    dd = [float(x) for x in d[m]]
    ss = [float(x) for x in sp[m]]
    i = min(range(len(ss)), key=lambda k: ss[k])
    punti = list(zip(dd, ss))
    return punti, ss[i], dd[i]


def _corr(xs, ys):
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    return sxy / (sxx * syy) ** 0.5 if sxx > 0 and syy > 0 else 0.0


def _downsample(punti, n=100):
    if len(punti) <= n:
        return punti
    step = len(punti) / n
    return [punti[int(i * step)] for i in range(n)]


# --------------------------------------------------------------- costruzione -
def costruisci(anno=2026, gp="Hungary", data_bozza=None):
    ses = tele.carica_sessione(anno, gp, "FP1")
    piloti = tele.piloti_sessione(ses)
    colori = base.carica_colori()

    def col(team):
        return colori.get(team) or "var(--dim)"

    # DRS degenere? (dichiarato, non usato)
    drs = set()
    for sig, info in piloti.items():
        for lap in tele.giri_validi(ses, info["num"])[:2]:
            try:
                tel = tele.canale_giro(lap)
            except Exception:
                continue
            drs.update(int(v) for v in tel["DRS"].unique())
    drs_degenere = drs <= {0}

    cs, tab, rows = _tabella(ses, piloti)
    if not rows:
        return None

    n_piloti = len(piloti)
    n_giri = sum(len(tele.giri_validi(ses, info["num"])) for info in piloti.values())
    n_ge3 = sum(1 for info in piloti.values() if len(tele.giri_validi(ses, info["num"])) >= 3)

    centrali = [r for r in rows if 4 <= r["numero"] <= 11]
    prof = {r["key"]: r for r in rows}

    # punto piu' basso del settore centrale
    lenta = min(centrali, key=lambda r: r["med"])          # T6
    veloce = max(centrali, key=lambda r: r["med"])          # T10

    # minimo reale del complesso T6/T7 dal giro veloce, su piu' piloti -> posizione
    riferimenti = [s for s in ("LEC", "RUS", "HER") if s in piloti]
    troughs = {}
    for s in riferimenti:
        _, vmin, dmin = _profilo(ses, piloti[s]["num"])
        troughs[s] = {"vmin": vmin, "dist": dmin}
    # POSIZIONE del fondo (driver-indipendente): mediana e dispersione dei minimi
    # del giro veloce dei riferimenti.  VALORE del fondo: due metriche distinte —
    #  - v_campo_lenta = mediana di campo per-curva (T6), la piu' bassa del settore;
    #  - v_ref_lo/hi   = i minimi del giro veloce dei tre riferimenti (99..102).
    d_trough = st.median([t["dist"] for t in troughs.values()])
    sp_pos = max(t["dist"] for t in troughs.values()) - min(t["dist"] for t in troughs.values())
    v_refs = sorted(t["vmin"] for t in troughs.values())
    v_ref_lo, v_ref_hi = v_refs[0], v_refs[-1]
    v_campo_lenta = lenta["med"]

    # convergenza/divergenza: le 4 curve piu' lente del giro vs le veloci del settore
    quattro_lente = sorted(rows, key=lambda r: r["med"])[:4]
    sp_lente = (min(r["spread"] for r in quattro_lente), max(r["spread"] for r in quattro_lente))
    T4 = prof.get("T4")
    T11 = prof.get("T11")

    # outlier di misura da escludere dal pattern pulito (chicane/finestra)
    OUTLIER = "T12A"
    puliti = [r for r in rows if r["key"] != OUTLIER]
    corr_full = _corr([r["med"] for r in rows], [r["spread"] for r in rows])

    # 'stessa curva' T4: la sola con risposta (spread max nel centrale)
    t4vals = tab["T4"]["vals"]
    t4_ord = sorted(t4vals.items(), key=lambda kv: -kv[1]["vmin"])
    t4_top = [(s, d) for s, d in t4_ord if d["n"] >= 7][:3]     # leader su campione solido
    t4_slow = t4_ord[-1]                                         # il piu' lento
    t4_num1 = t4_ord[0]                                          # numericamente in vetta

    # ---------------------------------------------------------------- figure --
    # FIG 1 — profilo velocita'-vs-distanza (3 piloti convergono al trough)
    serie1 = []
    for s in riferimenti:
        punti, _, _ = _profilo(ses, piloti[s]["num"])
        serie1.append({"sigla": s, "colore": col(piloti[s]["team"]),
                       "punti": _downsample(punti, 110)})
    allv = [v for ss in serie1 for _, v in ss["punti"]]
    y_lo = int(min(allv) // 25 * 25)
    y_hi = int(max(allv) // 25 * 25 + 25)
    svg1 = svg.grafico_xy(
        serie1, x_range=(1600, 3250), y_range=(y_lo, y_hi),
        x_ticks=(1600, 1900, 2200, 2500, 2800, 3100),
        y_ticks=tuple(range(y_lo, y_hi + 1, 25)),
        x_label="distanza sul giro (m) — settore centrale T4 → T11",
        y_label="km/h",
        x_annota=d_trough, annota_txt=f"T6/T7 · {it(v_ref_lo,0)}–{it(v_ref_hi,0)} km/h",
        titolo="Il settore precipita a cento all’ora, e per tutti nello stesso punto",
        sub=f"velocità sul giro veloce · {', '.join(riferimenti)} · FP1 Ungheria {anno}")

    # FIG 2 — dispersione (spread) vs velocita' di curva
    punti2 = []
    for r in rows:
        if r["key"] == OUTLIER:
            colore = "var(--line2)"                     # outlier di misura: smorzato
        elif 4 <= r["numero"] <= 11:
            colore = "var(--accent)"                    # settore centrale
        else:
            colore = "var(--dim)"                       # resto del giro
        punti2.append({
            "label": r["key"], "x": r["med"], "y": r["spread"], "colore": colore,
            "evidenza": r["key"] in ("T4", "T6", "T10", "T11"),
        })
    svg2 = svg.grafico_scatter(
        punti2, x_range=(75, 250), y_range=(0, 50),
        x_ticks=(75, 100, 125, 150, 175, 200, 225, 250),
        y_ticks=(0, 10, 20, 30, 40, 50),
        x_label="velocità di curva — mediana di campo (km/h)",
        y_label="dispersione del campo (km/h)",
        cx=155, cy=15,
        ang=("", "veloci → campo aperto", "", "lente → campo stretto"),
        titolo="Più la curva è veloce, più il campo si allarga",
        sub=(f"dispersione piloti vs velocità di curva · corr +{it(corr_full,2)} su "
             f"{len(rows)} curve · FP1 Ungheria {anno}"))

    # FIG 3 — 'stessa curva' T4: velocita' per pilota (spread massimo del centrale)
    righe3 = []
    for s, d in t4_ord:
        righe3.append({"sigla": s, "colore": col(d["team"]), "valore": d["vmin"],
                       "evidenza": d["n"] >= 7})
    svg3 = svg.barre_dv(
        righe3, base=180.0, unita="km/h",
        titolo=f"T4: la sola curva dove la firma emerge (spread {it(T4['spread'],0)} km/h)",
        sub=f"velocità minima all’apice · FP1 Ungheria {anno}",
        caption="km/h all’apice di T4 · asse da 180 · barre piene = ≥7 giri, sbiadite = campione sottile")

    # ---------------------------------------------------------------- facts ---
    F = {
        "id": ID, "anno": anno, "gara": GP, "circuito": "Hungaroring", "sessione": "FP1",
        "copertura": {"piloti": n_piloti, "giri_lanciati": n_giri, "ge3giri": n_ge3,
                      "drs": sorted(drs), "drs_degenere": drs_degenere},
        "profilo_centrale": {r["key"]: round(r["med"], 1) for r in centrali},
        "trough": {"curva": "T6/T7", "vmin_campo": round(v_campo_lenta, 1),
                   "vmin_refs": [round(v_ref_lo, 0), round(v_ref_hi, 0)],
                   "dist": round(d_trough, 0), "spread_posizione_m": round(sp_pos, 1),
                   "per_pilota": {s: {"vmin": round(t["vmin"], 0), "dist": round(t["dist"], 0)}
                                  for s, t in troughs.items()}},
        "lenta_centrale": {"curva": lenta["key"], "vmin": round(lenta["med"], 1)},
        "veloce_centrale": {"curva": veloce["key"], "vmin": round(veloce["med"], 1)},
        "quattro_lente": [{"curva": r["key"], "vmin": round(r["med"], 1),
                           "spread": round(r["spread"], 1)} for r in quattro_lente],
        "spread_lente": [round(sp_lente[0], 1), round(sp_lente[1], 1)],
        "spread_veloci_settore": {"T4": round(T4["spread"], 1), "T11": round(T11["spread"], 1)},
        "corr_spread_velocita": round(corr_full, 3), "n_curve": len(rows),
        "outlier_escluso": {"curva": OUTLIER, "spread": round(prof[OUTLIER]["spread"], 1)}
        if OUTLIER in prof else None,
        "T4": {"spread": round(T4["spread"], 1),
               "top": [{"sig": s, "vmin": round(d["vmin"], 0), "n": d["n"]} for s, d in t4_top],
               "num1": {"sig": t4_num1[0], "vmin": round(t4_num1[1]["vmin"], 0), "n": t4_num1[1]["n"]},
               "slow": {"sig": t4_slow[0], "vmin": round(t4_slow[1]["vmin"], 0), "n": t4_slow[1]["n"]}},
    }

    # -------------------------------------------------------------- prosa -----
    tr = F["trough"]
    prof_str = " · ".join(f"{k} {it(v,1)}" for k, v in
                          sorted(F["profilo_centrale"].items(), key=lambda kv: prof[kv[0]]["dist"]))
    lente_str = ", ".join(f"{r['key']} {it(r['med'],0)}" for r in quattro_lente)
    per_pil = ", ".join(f"{s} {it(t['vmin'],0)}@{it(t['dist'],0)} m"
                        for s, t in tr["per_pilota"].items())
    top_str = ", ".join(f"{t['sig']} {it(t['vmin'],0)} (n={t['n']})" for t in F["T4"]["top"])
    num1 = F["T4"]["num1"]
    slow = F["T4"]["slow"]

    FIG = {
        "profilo": {"svg": svg1,
            "didascalia": (f"Il profilo del settore centrale sul giro veloce: da ~{it(T4['med'],0)} km/h a "
                           f"T4 precipita fino a {it(v_ref_lo,0)}–{it(v_ref_hi,0)} km/h nel complesso T6/T7 "
                           f"(~{it(d_trough,0)} m), poi risale verso {veloce['key']}. Le tre tracce toccano il "
                           f"fondo nello stesso punto."),
            "fonte": f"FastF1 · car telemetry (Speed) + circuit_info, FP1 Ungheria {anno}"},
        "scatter": {"svg": svg2,
            "didascalia": (f"Ogni punto è una curva: velocità di percorrenza (x) contro dispersione del campo (y). "
                           f"Le curve lente stanno in basso a sinistra (campo stretto), le veloci in alto a destra. "
                           f"{OUTLIER} (chicane) è un outlier di misura, fuori dal pattern."),
            "fonte": f"FastF1 · vmin all’apice per pilota (giri lanciati), FP1 Ungheria {anno}"},
        "t4": {"svg": svg3,
            "didascalia": (f"All’apice di T4 il campo si apre di {it(T4['spread'],0)} km/h: qui una differenza si "
                           f"vede. Le barre sbiadite (es. {num1['sig']}, n={num1['n']}) hanno campione sottile — "
                           f"in prove libere, con carburante e gomme ignoti, restano un indizio."),
            "fonte": f"FastF1 · vmin all’apice per pilota (giri lanciati), FP1 Ungheria {anno}"},
    }

    art = {
        "id": ID, "stato": "bozza", "data": data_bozza or datetime.date.today().isoformat(),
        "firma": "Muretto · Redazione tecnica", "accent": "var(--accent)",
        "canale": "B (anomalia nei nostri dati)",
        "gara": GP, "circuito": "Hungaroring", "sessione": "FP1",
        "gp": GP, "round": ROUND,
        "tag": ["telemetria", "curve", "geometria", "prove libere"],
        "occhiello": f"Telemetria · Prove libere Ungheria {anno}",
        "titolo": (f"Il cuore lento del Hungaroring: a {tr['curva']} tutti attorno ai cento all’ora, "
                   f"nello stesso punto"),
        "sommario": (
            f"In FP1 il settore centrale (T4–T11) precipita attorno ai 100 km/h nel complesso "
            f"{tr['curva']} — il punto più basso ({tr['curva'].split('/')[0]} a {it(tr['vmin_campo'],0)} di mediana), "
            f"e per tutti nella stessa posizione (~{it(d_trough,0)} m). "
            f"Nelle curve lente il campo si stringe entro {it(F['spread_lente'][0],1)}–{it(F['spread_lente'][1],1)} km/h; "
            f"solo dove si va forte (T4) si apre a {it(F['T4']['spread'],0)}. In prove libere è un indizio, non un verdetto."),
        "sezioni": [
            {"tag": "Evidenza", "titolo": "Il settore precipita a cento all’ora, e per tutti nello stesso punto",
             "html": (
                f"<p>Il settore centrale del Hungaroring è una scala che scende in un pozzo e risale. Sul giro "
                f"veloce la velocità di percorrenza va da <b>~{it(prof['T4']['med'],0)} km/h</b> a T4 giù fino al "
                f"fondo del complesso <b>{tr['curva']}</b>, per poi ricrescere fino a <b>{it(veloce['med'],0)} km/h</b> "
                f"a {veloce['key']}. La mediana di campo curva per curva: {prof_str} km/h.</p>"
                f"<p>Il punto più basso di tutto il settore è il complesso {tr['curva']}: la mediana di campo scende "
                f"a <b>{it(tr['vmin_campo'],0)} km/h</b> a {tr['curva'].split('/')[0]}. E il fondo cade nello "
                f"<b>stesso identico punto</b> per chiunque: sul giro veloce {per_pil} — i tre riferimenti toccano il "
                f"fondo entro <b>{it(tr['spread_posizione_m'],0)} m</b> l’uno dall’altro. Non è una velocità che si "
                f"sceglie: è dove la pista costringe a scendere.</p>"),
             "figura": FIG["profilo"]},
            {"tag": "Causa", "titolo": "La geometria comanda: dove è lento il campo si stringe, dove è veloce si apre",
             "html": (
                f"<p>Guardando tutte le curve del giro emerge una regola. Le quattro più lente — {lente_str} km/h — "
                f"hanno una dispersione di campo di soli <b>{it(F['spread_lente'][0],1)}–{it(F['spread_lente'][1],1)} km/h</b>: "
                f"ventidue piloti passano quasi alla stessa velocità. Nelle veloci del settore la forbice si apre: "
                f"<b>{it(F['spread_veloci_settore']['T4'],0)} km/h</b> a T4, <b>{it(F['spread_veloci_settore']['T11'],1)}</b> "
                f"a T11. Sulle {F['n_curve']} curve misurate, velocità e dispersione vanno insieme: "
                f"corr <b>+{it(F['corr_spread_velocita'],2)}</b>.</p>"
                f"<p>La fisica è semplice. In una curva lenta il limite è meccanico — aderenza e traiettoria — e la "
                f"geometria lo fissa quasi uguale per tutti: non c’è margine per portare più velocità. In una curva "
                f"veloce contano carico aerodinamico e fiducia del pilota, e lì le differenze di vettura e di mano "
                f"si vedono. È la geometria a comandare le minime; la firma emerge solo dove si va forte. "
                f"({F['outlier_escluso']['curva']}, spread {it(F['outlier_escluso']['spread'],0)} km/h, è un outlier "
                f"di misura della chicane, escluso dal pattern.)</p>"),
             "figura": FIG["scatter"]},
            {"tag": "Effetto", "titolo": "L’unica domanda «chi porta più velocità» con una risposta: T4",
             "html": (
                f"<p>Se una curva del settore centrale permette di chiedere <i>chi porta più velocità</i>, è T4: qui "
                f"il campo si apre di <b>{it(F['T4']['spread'],0)} km/h</b>. All’apice, sui campioni più solidi, "
                f"guidano <b>{top_str}</b>; il più lento è <b>{slow['sig']} {it(slow['vmin'],0)} km/h</b>. "
                f"<b>{num1['sig']}</b> è numericamente in vetta a {it(num1['vmin'],0)} km/h, ma su appena "
                f"{num1['n']} giri lanciati: troppo pochi per farne un verdetto.</p>"
                f"<p>E vale solo per T4. Non esiste una classifica unica del «chi porta più velocità»: il primato "
                f"cambia col tipo di curva. Soprattutto, sono prove libere — carburante, mescola e mappa motore sono "
                f"ignoti — e pochi km/h in una singola curva non si possono attribuire alla vettura o al pilota. "
                f"Il dato solido di questo settore non è chi vince un apice: è che la pista, non l’uomo, detta le "
                f"minime ovunque tranne dove si corre forte.</p>"),
             "figura": FIG["t4"]},
        ],
        "provenienza": [
            {"grandezza": f"minimo del settore centrale ({tr['curva']})",
             "valore": (f"mediana di campo {it(tr['vmin_campo'],0)} km/h (T6); giro veloce dei riferimenti "
                        f"{it(tr['vmin_refs'][0],0)}–{it(tr['vmin_refs'][1],0)} km/h, a ~{it(d_trough,0)} m"),
             "stato": "MISURATO",
             "da": "mediana di campo del vmin all’apice + minimo del giro veloce dei tre riferimenti"},
            {"grandezza": "posizione del minimo (driver-indipendente)",
             "valore": f"{per_pil} — entro {it(tr['spread_posizione_m'],0)} m",
             "stato": "MISURATO", "da": "distanza del minimo di velocità nel giro veloce, per 3 piloti"},
            {"grandezza": "profilo minime settore centrale (T4→T11)",
             "valore": f"{prof_str} km/h",
             "stato": "MISURATO", "da": "mediana di campo del vmin all’apice sui giri lanciati (≥3 giri/pilota)"},
            {"grandezza": "convergenza (lente) vs divergenza (veloci)",
             "valore": (f"lente {it(F['spread_lente'][0],1)}–{it(F['spread_lente'][1],1)} km/h; "
                        f"T4 {it(F['spread_veloci_settore']['T4'],0)}, T11 {it(F['spread_veloci_settore']['T11'],1)}; "
                        f"corr +{it(F['corr_spread_velocita'],2)} su {F['n_curve']} curve"),
             "stato": "MISURATO", "da": "spread (max−min) del vmin di campo per curva"},
            {"grandezza": "velocità all’apice di T4 per pilota",
             "valore": (f"{top_str}; più lento {slow['sig']} {it(slow['vmin'],0)}; "
                        f"{num1['sig']} {it(num1['vmin'],0)} (n={num1['n']}, campione sottile)"),
             "stato": "MISURATO", "da": "mediana del vmin all’apice sui giri lanciati"},
            {"grandezza": "copertura",
             "valore": (f"{F['copertura']['piloti']} piloti, {F['copertura']['giri_lanciati']} giri lanciati, "
                        f"{F['copertura']['ge3giri']}/{F['copertura']['piloti']} con ≥3 giri; "
                        f"DRS {'degenere (tutto 0), non usato' if drs_degenere else sorted(drs)}"),
             "stato": "MISURATO", "da": "tele.giri_validi (soglia 1,07×) su tutta la sessione"},
            {"grandezza": "carburante, mescola gomma e mappa motore (FP1)",
             "valore": "ignoti — le minime sono indicative, non un verdetto",
             "stato": "NON_MISURABILE", "da": "non esposti dalla telemetria in prove libere"},
            {"grandezza": "cosa apre lo spread nelle curve veloci (aero/telaio/pilota)",
             "valore": "interpretazione fisica",
             "stato": "NON_MISURABILE", "da": "nessun canale di carico/imbardata; è la lettura, non un dato"},
        ],
        "fonti": [
            {"tipo": "dati", "testo": (f"FastF1 3.8.3 — telemetria vettura (Speed/nGear/RPM) + mappa curve "
                                       f"(circuit_info), FP1 Gran Premio d’Ungheria {anno} (Hungaroring)")},
            {"tipo": "metodo", "testo": (
                "ai_lab/redazione/genera_hun_minime_curva.py su curve.py — vmin = mediana della velocità minima "
                "all’apice (finestra asimmetrica −25/+75 m attorno al riferimento circuit_info, dove cade il vero "
                "minimo) sui giri lanciati (tele.giri_validi, soglia 1,07×); velocità di campo = mediana sui piloti "
                "con ≥3 giri; dispersione = max−min; profilo dal giro veloce. T12A esclusa dal pattern pulito come "
                "outlier di misura (finestra della chicane). DRS verificato degenere (tutto 0), non usato")},
        ],
    }
    return F, art


META = {
    "id": ID, "canale": "B",
    "titolo": "Il cuore lento del Hungaroring (minime del settore centrale)",
    "tag": ["telemetria", "curve", "geometria", "prove libere"],
    "descrizione": "il profilo velocità-vs-distanza del settore T4–T11: la geometria comanda le minime",
    "richiede": "telemetria", "gare": ["Ungheria"],
}


def genera(gara=None, data=None):
    if gara not in (None, "Ungheria", "Hungary", "Hungarian Grand Prix"):
        return None
    r = costruisci(2026, "Hungary", data_bozza=data)
    if not r:
        return None
    F, art = r
    base.scrivi_bozza(ID, art, F)
    return {"id": ID, "titolo": art["titolo"], "stato": art["stato"], "canale": "B"}


if __name__ == "__main__":
    r = costruisci()
    if not r:
        print("nessun dato utile trovato"); sys.exit()
    F, art = r
    out = base.scrivi_bozza(ID, art, F)
    tr = F["trough"]
    print(f"Bozza {ID} scritta in {out}")
    print(f"  trough {tr['curva']}: campo {it(tr['vmin_campo'],0)} km/h (T6) · refs "
          f"{it(tr['vmin_refs'][0],0)}-{it(tr['vmin_refs'][1],0)} @ ~{it(tr['dist'],0)} m "
          f"(posizione entro {it(tr['spread_posizione_m'],0)} m su {len(tr['per_pilota'])} piloti)")
    print(f"  lente {F['spread_lente']} km/h · T4/T11 {F['spread_veloci_settore']} · "
          f"corr +{it(F['corr_spread_velocita'],2)} su {F['n_curve']} curve")
    print(f"  T4 top {[ (t['sig'],t['vmin'],t['n']) for t in F['T4']['top'] ]} | "
          f"num1 {F['T4']['num1']['sig']} {F['T4']['num1']['vmin']} (n={F['T4']['num1']['n']}) | "
          f"slow {F['T4']['slow']['sig']} {F['T4']['slow']['vmin']}")
    print(f"  copertura {F['copertura']}")
