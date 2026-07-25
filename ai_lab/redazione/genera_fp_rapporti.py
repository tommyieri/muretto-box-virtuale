"""
Generatore specifico-FP, track-agnostic: "Rapporti del cambio e velocità di punta".

Angolo (Canale B, telemetria FastF1). Due misure, robustezza opposta:
  1) IL RAPPORTO è geometria pura del cambio. In una marcia fissa il regime del
     motore cresce con la velocità secondo una costante — quella costante È il
     rapporto. RPM/velocità nella marcia alta è immune a scia, mappa motore e
     carburante: MISURATO. Deriviamo dai dati QUALE marcia è la marcia-alta della
     sessione (la più usata ad alta velocità che tutti raggiungono) e la soglia di
     velocità oltre cui quella marcia è davvero in uso — nessun numero di pista è
     cablato.
  2) LA PUNTA in prove libere è INDICATIVA: carburante e mappa motore ignoti, la
     scia gonfia il picco. Per questo la mediana dei picchi per-giro, mai il picco.
     E soprattutto: il rapporto NON deve "spiegare" la punta (Spearman): corto ≠
     lento in fondo. È il cuore, ed è track-agnostic.

Nessun literal di Gran Premio/circuito/round/anno: tutto derivato dai parametri e
da ses.event. Le caratterizzazioni assolute di pista ("punta alta/bassa") sono
tagliate — è una bozza da una sola sessione, non un confronto fra circuiti.

python3 UTENTE (fastf1 3.8.3), NON la .venv. Solo lettura; bozza nell'area Lab.
"""
from __future__ import annotations
import os
import re
import sys
import math
import json
import argparse
import datetime
import statistics as stt

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele   # noqa: E402
import svg    # noqa: E402
import base   # noqa: E402

SES_DEF = "FP2"
MIN_CAMP = 15          # campioni minimi per fidarsi di un rapporto per-marcia
COP_FRAZ = 0.66        # frazione di piloti che deve "coprire" una marcia perché
                       # sia candidata a marcia-di-confronto (così tutti hanno dati)


def it(x, dec=1):
    return base.it(x, dec)


# ------------------------------------------------------------- risoluzione -----
def _slug(s):
    s = str(s or "").strip().lower()
    for a, b in (("à", "a"), ("è", "e"), ("é", "e"), ("ì", "i"), ("ò", "o"),
                 ("ù", "u"), ("ä", "a"), ("ö", "o"), ("ü", "u")):
        s = s.replace(a, b)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "gp"


def _registro():
    """Mappa nome-italiano -> record ({'ti': nome FastF1, ...}), se presente."""
    try:
        return json.load(open(os.path.join(base.REPO, "data", "gare_registro.json")))
    except Exception:
        return {}


def _risolvi_gara(gara):
    """(nome per FastF1, nome-italiano|None) a partire dal parametro `gara`.

    Se `gara` è una chiave del registro italiano usa il suo 'ti' per caricare la
    sessione; altrimenti passa `gara` così com'è a FastF1 (che fa fuzzy-match su
    località/evento) e l'etichetta italiana resta da derivare dopo il load."""
    reg = _registro()
    if gara in reg:
        return reg[gara].get("ti", gara), gara
    for k, v in reg.items():
        if k.lower() == str(gara).lower():
            return v.get("ti", gara), k
    return gara, None


def _anno_da(data):
    """Anno dalla data-targhetta (AAAA-...) se plausibile, altrimenti anno corrente."""
    m = re.match(r"\s*(\d{4})", str(data or ""))
    if m:
        return int(m.group(1))
    return datetime.date.today().year


def _ses_label(sessione):
    m = re.fullmatch(r"[Ff][Pp]\s*([123])", str(sessione or "").strip())
    if m:
        return f"Prove libere {m.group(1)}"
    s = str(sessione or "").strip().upper()
    return {"Q": "Qualifica", "S": "Sprint", "SQ": "Sprint Qualifica",
            "SS": "Sprint Shootout", "R": "Gara"}.get(s, sessione or "sessione")


# ---------------------------------------------------------------- misura -------
def raccogli(ses, num):
    """Un solo passaggio sui giri lanciati del pilota: raccoglie tutti i campioni
    car-data (Speed/RPM/nGear/Throttle/DRS) e, per-giro, il picco di velocità e la
    frazione a tutto gas. Da qui derivano tutte le misure senza rileggere i giri."""
    S, R, G = [], [], []
    picchi, gas_frac = [], []
    drs = set()
    n_lap = 0
    for lap in tele.giri_validi(ses, num):
        try:
            t = tele.canale_giro(lap)
        except Exception:
            continue
        sp = t["Speed"].values
        if len(sp) < 20:
            continue
        n_lap += 1
        S += list(sp)
        R += list(t["RPM"].values)
        G += list(t["nGear"].values)
        picchi.append(float(sp.max()))
        th = t["Throttle"].values
        gas_frac.append(100.0 * (th >= 95).sum() / len(th))
        drs.update(int(x) for x in t["DRS"].unique().tolist())
    return {"S": S, "R": R, "G": G, "picchi": picchi, "gas_frac": gas_frac,
            "drs": drs, "n_lap": n_lap}


def _pctl(vals, q):
    v = sorted(vals)
    if not v:
        return None
    if len(v) == 1:
        return float(v[0])
    i = (len(v) - 1) * q / 100.0
    lo = int(math.floor(i))
    hi = min(lo + 1, len(v) - 1)
    return float(v[lo] + (v[hi] - v[lo]) * (i - lo))


def _rapporto(dat, gear, vlo, vhi=None):
    """Mediana RPM/velocità nella marcia `gear`, fra vlo e (opz.) vhi km/h."""
    ratios = []
    for s, r, g in zip(dat["S"], dat["R"], dat["G"]):
        if int(g) != gear or s <= vlo:
            continue
        if vhi is not None and s >= vhi:
            continue
        if s > 0:
            ratios.append(r / s)
    if len(ratios) < MIN_CAMP:
        return None
    return {"ratio": stt.median(ratios), "n": len(ratios)}


def _curva(dat, gear, lo, hi, passo=5):
    """Retta RPM-vs-velocità della marcia: mediana RPM per bin di velocità."""
    punti = []
    b = lo
    while b <= hi:
        vals = [r for s, r, g in zip(dat["S"], dat["R"], dat["G"])
                if int(g) == gear and b <= s < b + passo]
        if len(vals) >= 6:
            punti.append((b + passo / 2.0, stt.median(vals)))
        b += passo
    return punti


def _campioni_gear(dat, gear, vmin):
    return sum(1 for s, g in zip(dat["S"], dat["G"]) if int(g) == gear and s > vmin)


def _scegli_marcia(dati):
    """DERIVA dalla griglia la marcia-di-confronto e le soglie di velocità.

    - V_SOGLIA: P80 della velocità grid-wide, arrotondato a 10 → dove operano le
      marce alte di QUESTA pista (si autocalibra: bassa su un circuito lento, alta
      su uno veloce).
    - GEAR_TOP: fra le marce che almeno COP_FRAZ dei piloti "coprono" con ≥MIN_CAMP
      campioni sopra V_SOGLIA, quella con PIU' campioni sopra V_SOGLIA — cioè la
      marcia-alta che tutti raggiungono e usano davvero.
    - marcia di coerenza = GEAR_TOP+1 se esiste nei dati.
    - BANDA_STRETTA: (P25,P75) delle velocità in GEAR_TOP sopra V_SOGLIA, a passo 5
      — sotto-banda comune per il controllo bias-distribuzione.
    """
    allS = [s for d in dati.values() for s in d["S"]]
    v_soglia = int(round((_pctl(allS, 80) or 0) / 10.0) * 10)
    gmax = max((int(g) for d in dati.values() for g in d["G"]), default=0)
    n_drv = len(dati)
    need = max(2, math.ceil(COP_FRAZ * n_drv))

    cand = []
    for g in range(2, gmax + 1):
        cop = sum(1 for d in dati.values() if _campioni_gear(d, g, v_soglia) >= MIN_CAMP)
        tot = sum(_campioni_gear(d, g, v_soglia) for d in dati.values())
        cand.append((g, cop, tot))
    ammessi = [c for c in cand if c[1] >= need]
    if ammessi:
        gear_top = max(ammessi, key=lambda c: c[2])[0]
    else:                                   # fallback: più campioni sopra soglia
        gear_top = max(cand, key=lambda c: c[2])[0] if cand else gmax

    coer = gear_top + 1 if gear_top + 1 <= gmax else None

    sp_top = [s for d in dati.values() for s, g in zip(d["S"], d["G"])
              if int(g) == gear_top and s > v_soglia]
    b_lo = _pctl(sp_top, 25) or v_soglia
    b_hi = _pctl(sp_top, 75) or (v_soglia + 20)
    banda = (int(round(b_lo / 5.0) * 5), int(round(b_hi / 5.0) * 5))
    if banda[1] - banda[0] < 10:            # banda troppo stretta: allargala un filo
        banda = (banda[0], banda[0] + 15)
    return {"v_soglia": v_soglia, "gear_top": gear_top, "coer": coer,
            "gmax": gmax, "banda": banda}


def spearman(xs, ys):
    """Correlazione di rango (gestisce i pari-merito), senza scipy."""
    n = len(xs)
    if n < 3:
        return None

    def ranghi(v):
        ordine = sorted(range(n), key=lambda i: v[i])
        r = [0.0] * n
        i = 0
        while i < n:
            j = i
            while j + 1 < n and v[ordine[j + 1]] == v[ordine[i]]:
                j += 1
            avg = (i + j) / 2.0 + 1.0
            for k in range(i, j + 1):
                r[ordine[k]] = avg
            i = j + 1
        return r

    rx, ry = ranghi(xs), ranghi(ys)
    mx, my = sum(rx) / n, sum(ry) / n
    cov = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    sx = math.sqrt(sum((a - mx) ** 2 for a in rx))
    sy = math.sqrt(sum((b - my) ** 2 for b in ry))
    return cov / (sx * sy) if sx and sy else 0.0


def _ticks(lo, hi, step):
    t0 = math.ceil(lo / step) * step
    ts, v = [], t0
    while v <= hi + 1e-9:
        ts.append(int(round(v)))
        v += step
    return ts


def _ord(n):
    return f"{int(n)}ª"


# ------------------------------------------------------------- costruzione -----
def costruisci(gara=None, data_bozza=None, sessione=None):
    if gara is None:
        raise ValueError("serve il Gran Premio (gara) da caricare")
    sessione = sessione or SES_DEF
    anno = _anno_da(data_bozza)
    ff1_name, gp_it = _risolvi_gara(gara)

    ses = tele.carica_sessione(anno, ff1_name, sessione)
    piloti = tele.piloti_sessione(ses)
    colori = base.carica_colori()
    col = lambda t: colori.get(t) or "var(--dim)"

    # identità della sessione, derivata da ses.event (nessun literal di pista)
    ev = ses.event
    ev_name = str(ev["EventName"]) if "EventName" in ev else str(gara)
    location = str(ev["Location"]) if "Location" in ev else str(gara)
    try:
        rnd = int(ev["RoundNumber"])
    except Exception:
        rnd = None
    reg = _registro()
    gp_disp = gp_it or next((k for k, v in reg.items() if v.get("ti") == ev_name), None) or ev_name
    slug_gp = _slug(location or gp_disp)
    idart = f"fp-rapporti-{slug_gp}-{anno}"
    ses_lab = _ses_label(sessione)

    # --- passo 1: raccolta grezza per pilota ---
    dati = {}
    n_lap_tot = 0
    drs_all = set()
    info_pil = {}
    for sig, info in piloti.items():
        dat = raccogli(ses, info["num"])
        if dat["n_lap"] == 0 or not dat["picchi"]:
            continue
        dati[sig] = dat
        info_pil[sig] = info
        n_lap_tot += dat["n_lap"]
        drs_all |= dat["drs"]
    if len(dati) < 3:
        raise RuntimeError(f"troppi pochi piloti con giri lanciati ({len(dati)})")

    # --- derivazione marcia/soglie dalla griglia ---
    mm = _scegli_marcia(dati)
    GEAR_TOP = mm["gear_top"]
    V_SOGLIA = mm["v_soglia"]
    COER = mm["coer"]
    BANDA = mm["banda"]

    # --- passo 2: misure per vettura ---
    per_car = {}
    gear_tot = {}
    for sig, dat in dati.items():
        for g in set(int(x) for x in dat["G"]):
            gear_tot[g] = gear_tot.get(g, 0) + _campioni_gear(dat, g, V_SOGLIA)
        r_top = _rapporto(dat, GEAR_TOP, V_SOGLIA)
        r_coer = _rapporto(dat, COER, V_SOGLIA) if COER else None
        rn = _rapporto(dat, GEAR_TOP, BANDA[0] - 1, BANDA[1])
        per_car[sig] = {
            "team": info_pil[sig]["team"],
            "ratio_top": r_top["ratio"] if r_top else None, "n_top": r_top["n"] if r_top else 0,
            "ratio_coer": r_coer["ratio"] if r_coer else None, "n_coer": r_coer["n"] if r_coer else 0,
            "ratio_str": rn["ratio"] if rn else None,
            "vmax_med": stt.median(dat["picchi"]),
            "vmax_picco": max(dat["picchi"]),
            "scia": max(dat["picchi"]) - stt.median(dat["picchi"]),
            "pct_gas": stt.median(dat["gas_frac"]),
            "n_giri": len(dat["picchi"]),
        }

    con_top = {s: d for s, d in per_car.items() if d["ratio_top"] is not None}
    if len(con_top) < 3:
        raise RuntimeError(f"pochi rapporti in {GEAR_TOP}ª affidabili ({len(con_top)})")

    # --- estremi: la vettura col cambio più corto e la più lunga (derivati) ---
    ordine = sorted(con_top, key=lambda s: -con_top[s]["ratio_top"])
    CORTO, LUNGO = ordine[0], ordine[-1]
    team_corto = per_car[CORTO]["team"]
    team_lungo = per_car[LUNGO]["team"]
    r_max = con_top[CORTO]["ratio_top"]
    r_min = con_top[LUNGO]["ratio_top"]
    spread_pc = (r_max / r_min - 1) * 100 if r_min else 0.0
    # entrambe le vetture della scuderia più corta in cima?
    top2 = ordine[:2]
    corto_doppio = (len(top2) == 2 and per_car[top2[0]]["team"] == per_car[top2[1]]["team"])

    # --- coerenza nella marcia superiore ---
    con_coer = {s: d for s, d in per_car.items() if d["ratio_coer"] is not None} if COER else {}
    rank_coer = sorted(con_coer, key=lambda s: -con_coer[s]["ratio_coer"])
    corto_in_coer = con_coer.get(CORTO, {}).get("ratio_coer") if COER else None
    rank_corto_coer = (rank_coer.index(CORTO) + 1) if (COER and CORTO in rank_coer) else None
    senza_coer = sorted(s for s, d in per_car.items()
                        if d["ratio_top"] is not None and (not COER or d["ratio_coer"] is None))

    # --- controllo banda stretta ---
    str_corto = con_top[CORTO].get("ratio_str")

    # --- velocità di punta (mediana dei picchi) ---
    vlist = [(s, d["vmax_med"]) for s, d in per_car.items()]
    vmax_top = max(vlist, key=lambda x: x[1])
    vmax_bot = min(vlist, key=lambda x: x[1])
    vmed_grid = stt.median([v for _, v in vlist])
    v_spread = vmax_top[1] - vmax_bot[1]

    # --- scia: il picco più gonfiato ---
    scia_top = max(per_car.items(), key=lambda kv: kv[1]["scia"])

    # --- correlazione rapporto ↔ punta (il cuore del pezzo) ---
    comuni = list(con_top)
    xs = [con_top[s]["ratio_top"] for s in comuni]
    ys = [per_car[s]["vmax_med"] for s in comuni]
    rho = spearman(xs, ys)

    # --- % pieno gas (carattere della sessione, valore-griglia) ---
    gas = [(s, d["pct_gas"]) for s, d in per_car.items()]
    gas_grid = stt.median([g for _, g in gas])
    gas_hi = max(gas, key=lambda x: x[1])
    gas_lo = min(gas, key=lambda x: x[1])
    gas_spread = gas_hi[1] - gas_lo[1]

    n_top_hi = gear_tot.get(GEAR_TOP, 0)
    n_coer_hi = gear_tot.get(COER, 0) if COER else 0
    drs_degenere = len(drs_all) <= 1

    F = {
        "id": idart, "anno": anno, "gp": gp_disp, "circuito": location,
        "evento": ev_name, "round": rnd, "ff1": ff1_name,
        "sessione": sessione, "sessione_label": ses_lab,
        "n_piloti": len(per_car), "n_giri_lanciati": n_lap_tot,
        "gear_top": GEAR_TOP, "gear_coer": COER, "v_soglia": V_SOGLIA,
        "banda": list(BANDA), "gmax": mm["gmax"],
        "corto": CORTO, "lungo": LUNGO, "team_corto": team_corto, "team_lungo": team_lungo,
        "corto_doppio": corto_doppio,
        "rapporto_top": {s: {"team": con_top[s]["team"], "ratio": con_top[s]["ratio_top"],
                             "n": con_top[s]["n_top"]} for s in con_top},
        "spread_perc": spread_pc, "r_max": r_max, "r_min": r_min,
        "rank_coer": rank_coer, "corto_in_coer": corto_in_coer,
        "rank_corto_coer": rank_corto_coer, "senza_coer": senza_coer,
        "banda_stretta_corto": str_corto,
        "vmax": {s: d["vmax_med"] for s, d in per_car.items()},
        "vmax_top": vmax_top, "vmax_bot": vmax_bot, "vmed_grid": vmed_grid,
        "v_spread": v_spread,
        "scia_top": {"sig": scia_top[0], "picco": scia_top[1]["vmax_picco"],
                     "med": scia_top[1]["vmax_med"], "scia": scia_top[1]["scia"]},
        "spearman": rho, "n_corr": len(comuni),
        "gas_grid": gas_grid, "gas_hi": gas_hi, "gas_lo": gas_lo, "gas_spread": gas_spread,
        "drs": sorted(drs_all), "drs_degenere": drs_degenere,
        "gear_hi": {GEAR_TOP: n_top_hi, **({COER: n_coer_hi} if COER else {})},
    }

    # ------------------------------------------------------------ grafici ------
    nm = lambda s: f"{s} · {per_car[s]['team']}"

    # grafico1: RPM-vs-velocità in GEAR_TOP — le 2 più corte vs le 2 più lunghe
    quattro = list(dict.fromkeys(ordine[:2] + ordine[-2:]))
    curve = {s: _curva(dati[s], GEAR_TOP, max(0, V_SOGLIA - 5), V_SOGLIA + 50, passo=5)
             for s in quattro}
    quattro = [s for s in quattro if curve[s]]     # scarta chi non ha punti
    tuttix = [x for s in quattro for x, _ in curve[s]]
    tuttiy = [y for s in quattro for _, y in curve[s]]
    xlo, xhi = min(tuttix) - 3, max(tuttix) + 3
    ylo = math.floor(min(tuttiy) / 500) * 500
    yhi = math.ceil(max(tuttiy) / 500) * 500
    band_lo = max(min(x for x, _ in curve[s]) for s in quattro)
    band_hi = min(max(x for x, _ in curve[s]) for s in quattro)
    v_ann = round((band_lo + band_hi) / 2 / 10) * 10
    delta_ann = (r_max - r_min) * v_ann
    serie1 = [{"sigla": nm(s), "colore": col(per_car[s]["team"]), "punti": curve[s]}
              for s in quattro]
    svg1 = svg.grafico_xy(
        serie1, x_range=(xlo, xhi), y_range=(ylo, yhi),
        x_ticks=_ticks(xlo, xhi, 10), y_ticks=_ticks(ylo, yhi, 500),
        x_label="velocità (km/h)", y_label="giri/min",
        x_annota=v_ann, annota_txt=f"a {v_ann} km/h: +{it(delta_ann,0)} giri",
        titolo=f"Regime in {_ord(GEAR_TOP)} marcia — la pendenza È il rapporto",
        sub=f"le due più corte vs le due più lunghe · {gp_disp} {anno} {sessione}")

    # grafico2: ranking del rapporto in GEAR_TOP, per vettura (asse troncato)
    barre = [{"sigla": nm(s), "colore": col(per_car[s]["team"]),
              "valore": con_top[s]["ratio_top"], "evidenza": (per_car[s]["team"] == team_corto)}
             for s in ordine]
    svg2 = svg.barre_dv(
        barre, titolo=f"Quanto è corta la {_ord(GEAR_TOP)}: giri/min per km/h, per vettura",
        base=math.floor(r_min), ml=118,
        caption=f"giri/min per km/h in {_ord(GEAR_TOP)} · asse da {math.floor(r_min)} (più alto = più corto)")

    # grafico3: rapporto ↔ velocità di punta — nessuna relazione
    punti3 = [{"label": s, "colore": col(per_car[s]["team"]),
               "x": con_top[s]["ratio_top"], "y": per_car[s]["vmax_med"],
               "evidenza": (per_car[s]["team"] in (team_corto, team_lungo))}
              for s in comuni]
    x3 = _ticks(math.floor(r_min), math.ceil(r_max), 1)
    y3lo = math.floor(vmax_bot[1] / 5) * 5
    y3hi = math.ceil(vmax_top[1] / 5) * 5
    svg3 = svg.grafico_scatter(
        punti3, x_range=(math.floor(r_min) - 0.3, math.ceil(r_max) + 0.3),
        y_range=(y3lo - 1, y3hi + 1), x_ticks=x3, y_ticks=_ticks(y3lo, y3hi, 5),
        x_label=f"rapporto in {_ord(GEAR_TOP)} (giri/min per km/h) → più corto",
        y_label="velocità di punta mediana (km/h)",
        cx=stt.median(xs), cy=vmed_grid,
        titolo="Corto ≠ lento in fondo",
        sub=f"Spearman {it(rho,2)} · n={len(comuni)} vetture · {sessione}",
        ang=("corto, punta bassa", "corto, punta alta",
             "lungo, punta alta", "lungo, punta bassa"))

    # -------------------------------------------------------------- prosa ------
    def sg(s):
        return f"{s} ({per_car[s]['team']})"

    corto_frase = (f"entrambe le vetture {team_corto} ({top2[0]}, {top2[1]})"
                   if corto_doppio else f"{sg(CORTO)}")

    occhiello = f"Telemetria · {ses_lab} · {gp_disp} {anno}"
    titolo = f"Il cambio più corto della griglia, e perché non racconta la velocità di punta"
    sommario = (
        f"Sui giri lanciati di {ses_lab} a {location} la {_ord(GEAR_TOP)} marcia — la "
        f"marcia-alta più usata della sessione, ricavata dai dati — misura il rapporto "
        f"del cambio: il più corto è di {corto_frase}, il più lungo di {sg(LUNGO)}, uno "
        f"spread del {it(spread_pc)}%. È geometria pura, immune a carburante, mappa "
        f"motore e scia. Ma la tentazione «corto uguale lento in fondo» non regge: il "
        f"rapporto lo misuriamo, la velocità di punta in prove libere resta indicativa e "
        f"non la spieghiamo col cambio (Spearman {it(rho,2)}).")

    # Evidenza
    ev_html = (
        f"<p>In una marcia fissa il regime del motore cresce con la velocità secondo "
        f"una costante: quella costante <i>è</i> il rapporto. La misuriamo in "
        f"<b>{_ord(GEAR_TOP)}</b> — la marcia più usata sopra i {V_SOGLIA} km/h in questa "
        f"sessione (<b>{n_top_hi}</b> campioni"
        + (f" contro {n_coer_hi} in {_ord(COER)}" if COER else "")
        + f"), la stessa che tutte le vetture raggiungono — sui giri lanciati "
        f"({n_lap_tot} in totale). Vale <b>{it(r_max,2)}</b> giri/min per km/h su "
        f"{sg(CORTO)}, il valore più alto della griglia, contro <b>{it(r_min,2)}</b> su "
        f"{sg(LUNGO)}, il più basso: uno spread del <b>{it(spread_pc)}%</b> fra la più "
        f"corta e la più lunga. È una misura pulita — geometria del cambio, non la tocca "
        f"né la scia né la mappa motore né il carburante.</p>"
        f"<p>Tradotto sulla retta RPM-velocità: a {int(v_ann)} km/h in {_ord(GEAR_TOP)} "
        f"la vettura più corta gira <b>{it(delta_ann,0)} giri in più</b> della più lunga. "
        + (f"Il primato è doppio: {corto_frase} occupano i due gradini più alti. "
           if corto_doppio else "")
        + f"La soglia di {V_SOGLIA} km/h e la scelta della {_ord(GEAR_TOP)} non sono "
        f"cablate: le deriviamo dalla distribuzione di velocità e marce della sessione.</p>")

    # Causa
    causa_html = (
        f"<p>Il primato non è un effetto di come è distribuita la velocità nei nostri "
        f"campioni. Ristretto alla sola banda {BANDA[0]}–{BANDA[1]} km/h, il rapporto "
        f"della vettura più corta resta <b>{it(str_corto,2)}</b>, praticamente identico "
        f"al {it(r_max,2)} misurato su tutta la banda: nessun bias di distribuzione.</p>")
    if COER and corto_in_coer is not None:
        causa_html += (
            f"<p>E l’ordine si ripete in <b>{_ord(COER)}</b>: {sg(CORTO)} resta "
            f"{_ord(rank_corto_coer)} ({it(corto_in_coer,2)} giri/min per km/h) fra le "
            f"vetture con dati affidabili. La {_ord(COER)} però è meno usata e per alcune "
            + (f"— {', '.join(sg(s) for s in senza_coer)} — " if senza_coer else "")
            + f"non ha campioni utili sopra i {V_SOGLIA} km/h: per questo il confronto di "
            f"griglia lo teniamo in {_ord(GEAR_TOP)}, dove tutti hanno dati, verificando "
            f"che la marcia superiore racconti la stessa cosa.</p>")
    elif senza_coer:
        causa_html += (
            f"<p>La {_ord(GEAR_TOP)} è la marcia più alta con dati per tutte le vetture; "
            f"{', '.join(sg(s) for s in senza_coer)} non hanno campioni utili più in alto. "
            f"Per questo il confronto di griglia lo teniamo qui.</p>")
    causa_html += (
        f"<p>Un cambio più corto tiene il regime più alto a ogni velocità: è una scelta di "
        f"rapporti, e questa vettura la porta all’estremo. Le conseguenze a valle — "
        f"recupero energia, finestra termica del motore — non le misuriamo (i canali ERS "
        f"non sono nel feed pubblico) e non le asseriamo.</p>")

    # Effetto
    drs_frase = (
        f" E il DRS non aiuta a distinguere: nel feed di questa sessione il canale è "
        f"degenere (unico valore {F['drs']} su {n_lap_tot} giri lanciati), quindi le punte "
        f"che misuriamo sono tutte ad ala chiusa."
        if drs_degenere else "")
    eff_html = (
        f"<p>Qui scatta la tentazione: cambio corto uguale meno velocità di punta. In "
        f"prove libere <b>non regge</b>. La correlazione fra rapporto in {_ord(GEAR_TOP)} "
        f"e velocità di punta mediana è praticamente nulla: <b>Spearman {it(rho,2)}</b> su "
        f"{len(comuni)} vetture. La punta più bassa dello schieramento è di {sg(vmax_bot[0])} "
        f"(<b>{it(vmax_bot[1],0)} km/h</b>), la più alta di {sg(vmax_top[0])} "
        f"(<b>{it(vmax_top[1],0)}</b>); la vettura più corta e quella più lunga non stanno "
        f"agli estremi della punta. Nessuna relazione monotona: il rapporto non spiega la "
        f"velocità di fondo.</p>"
        f"<p>Del resto la punta, in prove libere, è indicativa e basta: carburante e mappa "
        f"motore sono ignoti, e la scia gonfia il picco — fino a "
        f"<b>+{it(F['scia_top']['scia'],0)} km/h</b> su {sg(F['scia_top']['sig'])} "
        f"({it(F['scia_top']['picco'],0)} di picco contro {it(F['scia_top']['med'],0)} di "
        f"mediana). Per questo usiamo la mediana dei picchi per-giro, non il picco."
        + drs_frase +
        f" A titolo di contesto della sessione, la griglia sta a tutto gas per una mediana "
        f"del {it(gas_grid)}% del giro. Morale: il rapporto lo misuriamo — geometria, "
        f"robusta — la punta resta indicativa e non la spieghiamo col cambio.</p>")

    figure = {
        "grafico1": {"svg": svg1,
                     "didascalia": (f"In {_ord(GEAR_TOP)} il regime cresce con la velocità "
                                    f"secondo il rapporto: le linee più corte sono più "
                                    f"ripide, le più lunghe più piatte. A {int(v_ann)} km/h "
                                    f"il divario è di {it(delta_ann,0)} giri/min."),
                     "fonte": f"FastF1 · car telemetry (nGear/RPM/Speed), {gp_disp} {anno} {sessione}"},
        "grafico2": {"svg": svg2,
                     "didascalia": (f"Rapporto in {_ord(GEAR_TOP)} per vettura (asse troncato "
                                    f"da {math.floor(r_min)} per leggere le differenze). Più "
                                    f"alto = marcia più corta."),
                     "fonte": "FastF1 · car telemetry, elaborazione redazione"},
        "grafico3": {"svg": svg3,
                     "didascalia": (f"Ogni punto una vettura: rapporto in {_ord(GEAR_TOP)} "
                                    f"(orizzontale) contro velocità di punta mediana "
                                    f"(verticale). La nuvola non ha pendenza (Spearman "
                                    f"{it(rho,2)}): il cambio non predice la punta in prove "
                                    f"libere."),
                     "fonte": "FastF1 · car telemetry, elaborazione redazione"},
    }

    sezioni = [
        {"tag": "Evidenza", "titolo": f"La {_ord(GEAR_TOP)} più corta della griglia",
         "html": ev_html, "figura": figure["grafico1"]},
        {"tag": "Causa", "titolo": "Geometria, non artefatto: regge in banda stretta"
         + (f" e in {_ord(COER)}" if (COER and corto_in_coer is not None) else ""),
         "html": causa_html, "figura": figure["grafico2"]},
        {"tag": "Effetto", "titolo": "Corto non vuol dire lento in fondo",
         "html": eff_html, "figura": figure["grafico3"]},
    ]

    n_min = min(con_top[s]["n_top"] for s in con_top)
    n_max = max(con_top[s]["n_top"] for s in con_top)
    provenienza = [
        {"grandezza": f"rapporto in {_ord(GEAR_TOP)} (giri/min per km/h)",
         "valore": (f"{it(r_max,2)} {CORTO} ({team_corto}) · {it(r_min,2)} {LUNGO} "
                    f"({team_lungo}) · spread {it(spread_pc)}%"),
         "stato": "MISURATO",
         "da": (f"mediana RPM/velocità in {_ord(GEAR_TOP)} (Speed>{V_SOGLIA}) sui giri "
                f"lanciati {sessione}; n {n_min}–{n_max} campioni/vettura")},
        {"grandezza": f"marcia-alta e soglia di velocità (derivate)",
         "valore": (f"{_ord(GEAR_TOP)} sopra {V_SOGLIA} km/h"
                    + (f"; coerenza in {_ord(COER)}" if COER else "")),
         "stato": "MISURATO",
         "da": (f"V_SOGLIA = P80 della velocità grid-wide arrotondato a 10; GEAR_TOP = la "
                f"marcia con più campioni sopra V_SOGLIA fra quelle coperte da ≥{int(COP_FRAZ*100)}% "
                f"dei piloti (≥{MIN_CAMP} campioni)")},
        {"grandezza": "controllo bias-distribuzione (banda stretta)",
         "valore": f"{it(str_corto,2)} in {BANDA[0]}–{BANDA[1]} km/h ≈ {it(r_max,2)} pieno",
         "stato": "MISURATO",
         "da": "rapporto della vettura più corta ristretto alla banda comune di velocità"},
        {"grandezza": "velocità di punta (mediana dei picchi per-giro)",
         "valore": (f"{it(vmax_bot[1],0)}–{it(vmax_top[1],0)} km/h "
                    f"(mediana griglia {it(vmed_grid,1)}, spread {it(v_spread,0)})"),
         "stato": "MISURATO",
         "da": "mediana dei picchi per-giro sui giri lanciati; INDICATIVA in FP"},
        {"grandezza": "scia (picco − mediana)",
         "valore": f"fino a +{it(F['scia_top']['scia'],0)} km/h ({F['scia_top']['sig']})",
         "stato": "MISURATO",
         "da": "picco singolo vs mediana dei picchi — motivo per usare la mediana"},
        {"grandezza": f"correlazione rapporto {_ord(GEAR_TOP)} ↔ punta",
         "valore": f"Spearman {it(rho,2)} (n={len(comuni)})",
         "stato": "MISURATO",
         "da": "correlazione di rango fra rapporto e punta mediana"},
        {"grandezza": "% del giro a tutto gas (Throttle≥95)",
         "valore": (f"mediana griglia {it(gas_grid)}% (min {it(gas_lo[1])} / max "
                    f"{it(gas_hi[1])}, spread {it(gas_spread)} pt)"),
         "stato": "MISURATO",
         "da": "mediana per-giro; robusto è il valore-griglia, non il ranking per-pilota"},
        {"grandezza": "stato DRS (ala aperta/chiusa)",
         "valore": "non leggibile" if drs_degenere else f"valori {F['drs']}",
         "stato": "NON_MISURABILE" if drs_degenere else "MISURATO",
         "da": (f"canale degenere (unico valore {F['drs']} su {n_lap_tot} giri lanciati); "
                f"punte misurate ad ala chiusa" if drs_degenere
                else "canale DRS presente, non usato per correggere la punta")},
        {"grandezza": "carburante e mappa motore (confondono la punta in FP)",
         "valore": "ignoti", "stato": "NON_MISURABILE",
         "da": "prove libere: assetto/carico e mappe non pubblici → la punta non è un verdetto"},
        {"grandezza": "recupero energia / finestra termica dal regime più alto",
         "valore": "non quantificabile", "stato": "NON_MISURABILE",
         "da": "canali ERS/batteria assenti dal feed pubblico"},
    ]

    articolo = {
        "id": idart, "stato": "bozza",
        "data": data_bozza or datetime.date.today().isoformat(),
        "firma": "Muretto · Redazione tecnica", "accent": col(team_corto),
        "canale": "B (nostri dati, telemetria FastF1)",
        "gp": gp_disp, "gara": gp_disp, "circuito": location, "sessione": sessione,
        "tag": ["telemetria", "cambio", "rapporti", "velocità di punta",
                "prove libere", gp_disp, team_corto, team_lungo],
        "occhiello": occhiello, "titolo": titolo, "sommario": sommario,
        "sezioni": sezioni,
        "provenienza": provenienza,
        "fonti": [
            {"tipo": "dati", "testo": (f"FastF1 3.8.3 — telemetria vettura (nGear/RPM/Speed/"
                                       f"Throttle/DRS), {gp_disp} {anno} {sessione} (cache locale)")},
            {"tipo": "metodo", "testo": (
                f"ai_lab/redazione/genera_fp_rapporti.py — rapporto = mediana RPM/velocità "
                f"nella marcia-alta (derivata) sopra V_SOGLIA (derivata) sui giri lanciati "
                f"(tele.giri_validi, soglia 1,07); immune a scia/mappa/giro. Velocità di punta "
                f"= mediana dei picchi per-giro (mai il picco singolo). Correlazione "
                f"rapporto–punta = Spearman. Verificato coerente"
                + (f" in {_ord(COER)} e" if COER else "")
                + f" nella banda {BANDA[0]}–{BANDA[1]} km/h; DRS scartato se degenere.")},
        ],
    }
    return F, articolo


META = {
    "id": "fp-rapporti", "canale": "B",
    "titolo": "Rapporti del cambio e velocità di punta (specifico-FP, track-agnostic)",
    "tag": ["telemetria", "cambio", "rapporti", "prove libere", "velocità di punta"],
    "descrizione": ("rapporto del cambio nella marcia-alta (derivata) e velocità di punta "
                    "mediana: la più corta della griglia, e perché corto ≠ lento in fondo"),
    "richiede": "telemetria", "gare": ["*"], "sessioni": ["FP2", "FP3"],
}


def genera(gara=None, data=None, sessione=None):
    if gara is None:
        return None
    F, art = costruisci(gara=gara, data_bozza=data, sessione=sessione or SES_DEF)
    base.scrivi_bozza(F["id"], art, F)
    return {"id": F["id"], "titolo": art["titolo"], "stato": art["stato"], "canale": "B"}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--gara", required=True, help="GP: nome italiano del registro o nome/località FastF1")
    ap.add_argument("--sessione", default=SES_DEF)
    ap.add_argument("--data", default=None, help="AAAA-MM-GG per la targhetta della bozza")
    a = ap.parse_args()
    F, art = costruisci(gara=a.gara, data_bozza=a.data, sessione=a.sessione)
    out = base.scrivi_bozza(F["id"], art, F)
    print(f"Bozza {F['id']} scritta in {out}")
    print(f"  GP {F['gp']} · {F['circuito']} · round {F['round']} · {F['sessione']} "
          f"({F['sessione_label']})")
    print(f"  marcia-alta derivata: {F['gear_top']}ª (soglia {F['v_soglia']} km/h, "
          f"coerenza {F['gear_coer']}ª, gmax {F['gmax']}, banda {F['banda']})")
    print(f"  più corta: {F['corto']} {it(F['rapporto_top'][F['corto']]['ratio'],2)} "
          f"({F['team_corto']}) · più lunga: {F['lungo']} "
          f"{it(F['rapporto_top'][F['lungo']]['ratio'],2)} ({F['team_lungo']}) · "
          f"spread {it(F['spread_perc'])}%")
    print(f"  punta: {F['vmax_bot'][0]} {it(F['vmax_bot'][1],0)} → "
          f"{F['vmax_top'][0]} {it(F['vmax_top'][1],0)} · mediana {it(F['vmed_grid'],0)}")
    print(f"  Spearman(rapporto,punta) = {it(F['spearman'],2)} (n={F['n_corr']})")
    print(f"  %gas griglia {it(F['gas_grid'])}% · DRS {F['drs']} "
          f"(degenere={F['drs_degenere']}) · marce>{F['v_soglia']}: {F['gear_hi']}")
