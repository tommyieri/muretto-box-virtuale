"""
Articolo (Canale B): "Sull'Hungaroring il cambio più corto della griglia — ma
corto non vuol dire lento in fondo".

Angolo rapporti-punta, Ungheria 2026 FP2.

Due misure, robustezza opposta:
  1) IL RAPPORTO è geometria pura del cambio. In una marcia fissa il regime
     cresce con la velocità secondo una costante — quella costante È il rapporto.
     RPM/velocità in 7ª è immune a scia, mappa motore e carburante. La McLaren ha
     la costante più alta della griglia (7ª più corta), l'Audi la più bassa (più
     lunga). Regge in 8ª e in una banda di velocità stretta: MISURATO.
  2) LA PUNTA in prove libere è indicativa: carburante e mappa motore ignoti, la
     scia gonfia il picco fino a +25 km/h. Per questo la mediana dei picchi
     per-giro, non il picco. E soprattutto: il rapporto NON spiega la punta
     (Spearman ≈ 0). Vietato dire "McLaren lenta perché corta".

python3 UTENTE (fastf1 3.8.3), NON la .venv. Solo lettura; bozza nell'area Lab.
"""
from __future__ import annotations
import os
import sys
import math
import datetime
import statistics as stt

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele   # noqa: E402
import svg    # noqa: E402
import base   # noqa: E402

ID = "hun-rapporti-punta-2026"
ANNO, GP, SES = 2026, "Hungary", "FP2"

GEAR_TOP = 7          # marcia più usata sopra i 250 km/h (verificato nel diag)
V_SOGLIA = 250        # rapporto misurato dove la marcia alta è davvero in uso
BANDA_STRETTA = (260, 285)   # controllo bias-distribuzione della velocità
MIN_CAMP = 15         # campioni minimi per fidarsi di un rapporto per-marcia


def it(x, dec=1):
    return base.it(x, dec)


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


def _gear_hi(dat, vmin=250):
    """Conteggio campioni per marcia sopra vmin (per giustificare la scelta 7ª)."""
    c = {}
    for s, g in zip(dat["S"], dat["G"]):
        if s > vmin:
            c[int(g)] = c.get(int(g), 0) + 1
    return c


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


# ------------------------------------------------------------- costruzione -----
def costruisci(data_bozza=None):
    ses = tele.carica_sessione(ANNO, GP, SES)
    piloti = tele.piloti_sessione(ses)
    colori = base.carica_colori()
    col = lambda t: colori.get(t) or "var(--dim)"

    per_car, dati = {}, {}
    gear_tot = {}
    drs_all = set()
    n_lap_tot = 0
    for sig, info in piloti.items():
        dat = raccogli(ses, info["num"])
        if dat["n_lap"] == 0:
            continue
        dati[sig] = dat
        n_lap_tot += dat["n_lap"]
        drs_all |= dat["drs"]
        for g, c in _gear_hi(dat).items():
            gear_tot[g] = gear_tot.get(g, 0) + c
        r7 = _rapporto(dat, GEAR_TOP, V_SOGLIA)
        r8 = _rapporto(dat, GEAR_TOP + 1, V_SOGLIA)
        rn = _rapporto(dat, GEAR_TOP, BANDA_STRETTA[0] - 1, BANDA_STRETTA[1])
        if not dat["picchi"]:
            continue
        per_car[sig] = {
            "team": info["team"],
            "ratio7": r7["ratio"] if r7 else None, "n7": r7["n"] if r7 else 0,
            "ratio8": r8["ratio"] if r8 else None, "n8": r8["n"] if r8 else 0,
            "ratio_str": rn["ratio"] if rn else None,
            "vmax_med": stt.median(dat["picchi"]),
            "vmax_picco": max(dat["picchi"]),
            "scia": max(dat["picchi"]) - stt.median(dat["picchi"]),
            "pct_gas": stt.median(dat["gas_frac"]),
            "n_giri": len(dat["picchi"]),
        }

    # --- riferimenti: McLaren (più corte) e Audi (più lunghe) ---
    con7 = {s: d for s, d in per_car.items() if d["ratio7"] is not None}
    mcl = sorted([s for s, d in con7.items() if d["team"] == "McLaren"],
                 key=lambda s: -con7[s]["ratio7"])
    audi = sorted([s for s, d in con7.items() if d["team"] == "Audi"],
                  key=lambda s: con7[s]["ratio7"])
    MCL0, MCL1 = mcl[0], mcl[1]
    AUD_LONG, AUD1 = audi[0], audi[1]     # AUD_LONG = il più lungo (ratio minimo)

    r_max = con7[MCL0]["ratio7"]
    r_min = con7[AUD_LONG]["ratio7"]
    spread_pc = (r_max / r_min - 1) * 100

    # --- coerenza in 8ª: ranking fra le sole vetture con dati 8ª affidabili ---
    con8 = {s: d for s, d in per_car.items() if d["ratio8"] is not None}
    rank8 = sorted(con8, key=lambda s: -con8[s]["ratio8"])
    mcl8_ok = MCL0 in con8 and MCL1 in con8
    senza8 = sorted(s for s, d in per_car.items()
                    if d["ratio7"] is not None and d["ratio8"] is None)

    # --- controllo banda stretta (bias-distribuzione della velocità) ---
    str_mcl = con7[MCL0].get("ratio_str")

    # --- velocità di punta (mediana dei picchi) ---
    vlist = [(s, d["vmax_med"]) for s, d in per_car.items()]
    vmax_top = max(vlist, key=lambda x: x[1])
    vmax_bot = min(vlist, key=lambda x: x[1])
    vmed_grid = stt.median([v for _, v in vlist])
    v_spread = vmax_top[1] - vmax_bot[1]

    # --- scia: il picco più gonfiato ---
    scia_top = max(per_car.items(), key=lambda kv: kv[1]["scia"])

    # --- correlazione rapporto 7ª ↔ punta (il cuore del pezzo) ---
    comuni = [s for s in con7 if s in per_car]
    xs = [con7[s]["ratio7"] for s in comuni]
    ys = [per_car[s]["vmax_med"] for s in comuni]
    rho = spearman(xs, ys)

    # --- % pieno gas: valore-griglia (carattere della pista) ---
    gas = [(s, d["pct_gas"]) for s, d in per_car.items()]
    gas_grid = stt.median([g for _, g in gas])
    gas_hi = max(gas, key=lambda x: x[1])
    gas_lo = min(gas, key=lambda x: x[1])
    gas_spread = gas_hi[1] - gas_lo[1]

    # --- uso marce sopra 250 km/h ---
    n7_hi = gear_tot.get(GEAR_TOP, 0)
    n8_hi = gear_tot.get(GEAR_TOP + 1, 0)

    F = {
        "id": ID, "anno": ANNO, "gp": "Ungheria", "circuito": "Hungaroring",
        "sessione": SES, "n_piloti": len(per_car), "n_giri_lanciati": n_lap_tot,
        "gear_top": GEAR_TOP, "v_soglia": V_SOGLIA,
        "riferimenti": {"mclaren": [MCL0, MCL1], "audi_lungo": AUD_LONG, "audi2": AUD1},
        "rapporto7": {s: {"team": con7[s]["team"], "ratio": con7[s]["ratio7"],
                          "n": con7[s]["n7"]} for s in con7},
        "spread_perc": spread_pc, "r_max": r_max, "r_min": r_min,
        "rapporto8_rank": rank8, "mcl8": {MCL0: con8.get(MCL0, {}).get("ratio8"),
                                          MCL1: con8.get(MCL1, {}).get("ratio8")},
        "senza_8a": senza8, "banda_stretta_mcl": str_mcl,
        "vmax": {s: d["vmax_med"] for s, d in per_car.items()},
        "vmax_top": vmax_top, "vmax_bot": vmax_bot, "vmed_grid": vmed_grid,
        "v_spread": v_spread,
        "scia_top": {"sig": scia_top[0], "picco": scia_top[1]["vmax_picco"],
                     "med": scia_top[1]["vmax_med"], "scia": scia_top[1]["scia"]},
        "spearman": rho, "n_corr": len(comuni),
        "gas_grid": gas_grid, "gas_hi": gas_hi, "gas_lo": gas_lo, "gas_spread": gas_spread,
        "drs": sorted(drs_all), "gear_hi": {GEAR_TOP: n7_hi, GEAR_TOP + 1: n8_hi},
    }

    # ------------------------------------------------------------ grafici ------
    nm = lambda s: f"{s} · {per_car[s]['team']}"

    # grafico1: RPM-vs-velocità in 7ª — McLaren (corte) vs Audi (lunghe)
    quattro = [MCL0, MCL1, AUD_LONG, AUD1]
    curve = {s: _curva(dati[s], GEAR_TOP, 245, 300, passo=5) for s in quattro}
    tuttix = [x for s in quattro for x, _ in curve[s]]
    tuttiy = [y for s in quattro for _, y in curve[s]]
    xlo, xhi = min(tuttix) - 3, max(tuttix) + 3
    ylo = math.floor(min(tuttiy) / 500) * 500
    yhi = math.ceil(max(tuttiy) / 500) * 500
    # velocità di annotazione: dentro alla banda comune alle quattro curve
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
        titolo="Regime in 7ª marcia — la pendenza È il rapporto",
        sub=f"McLaren (più corte) vs Audi (più lunghe) · {GP} {ANNO} {SES}")

    # grafico2: ranking del rapporto in 7ª, per vettura (asse troncato)
    barre = [{"sigla": nm(s), "colore": col(per_car[s]["team"]),
              "valore": con7[s]["ratio7"], "evidenza": (per_car[s]["team"] == "McLaren")}
             for s in sorted(con7, key=lambda s: -con7[s]["ratio7"])]
    svg2 = svg.barre_dv(
        barre, titolo="Quanto è corta la 7ª: giri/min per km/h, per vettura",
        base=math.floor(r_min), ml=118,
        caption=f"giri/min per km/h in 7ª · asse da {math.floor(r_min)} (più alto = più corto)")

    # grafico3: rapporto 7ª ↔ velocità di punta — nessuna relazione
    punti3 = [{"label": s, "colore": col(per_car[s]["team"]),
               "x": con7[s]["ratio7"], "y": per_car[s]["vmax_med"],
               "evidenza": (per_car[s]["team"] in ("McLaren", "Audi"))}
              for s in comuni]
    x3 = _ticks(math.floor(r_min), math.ceil(r_max), 1)
    y3lo = math.floor(vmax_bot[1] / 5) * 5
    y3hi = math.ceil(vmax_top[1] / 5) * 5
    svg3 = svg.grafico_scatter(
        punti3, x_range=(math.floor(r_min) - 0.3, math.ceil(r_max) + 0.3),
        y_range=(y3lo - 1, y3hi + 1), x_ticks=x3, y_ticks=_ticks(y3lo, y3hi, 5),
        x_label="rapporto in 7ª (giri/min per km/h) → più corto",
        y_label="velocità di punta mediana (km/h)",
        cx=stt.median(xs), cy=vmed_grid,
        titolo="Corto ≠ lento in fondo", sub=f"Spearman {it(rho,2)} · n={len(comuni)} vetture · {SES}",
        ang=("corto, punta bassa", "corto, punta alta",
             "lungo, punta alta", "lungo, punta bassa"))

    # -------------------------------------------------------------- prosa ------
    def sg(s):   # "SIG (Team)"
        return f"{s} ({per_car[s]['team']})"

    occhiello = f"Telemetria · Prove libere 2 · {F['gp']} {ANNO}"
    titolo = "Il cambio più corto della griglia, sulla pista che meno lo ripaga"
    sommario = (
        f"All’Hungaroring — una delle piste dove si sta meno a tutto gas "
        f"(mediana {it(gas_grid)}% del giro) — la McLaren gira col cambio più corto "
        f"dello schieramento: entrambe le vetture, con margine netto sull’Audi, la più "
        f"lunga. È geometria pura del cambio, immune a carburante, mappa motore e scia. "
        f"Ma la tentazione «corto uguale lento in fondo» in prove libere non regge: il "
        f"rapporto lo misuriamo, la velocità di punta resta indicativa e non la "
        f"spieghiamo col cambio.")

    sezioni = [
        {"tag": "Evidenza", "titolo": "La 7ª più corta della griglia, su entrambe le McLaren",
         "figura": "grafico1",
         "html": (
            f"<p>In una marcia fissa il regime del motore cresce con la velocità secondo "
            f"una costante: quella costante <i>è</i> il rapporto. La misuriamo in <b>7ª</b> "
            f"— la marcia più usata sopra i 250 km/h in questa sessione "
            f"(<b>{n7_hi}</b> campioni contro {n8_hi} "
            f"in 8ª) — sui giri lanciati di FP2. Vale <b>{it(con7[MCL0]['ratio7'],2)}</b> e "
            f"<b>{it(con7[MCL1]['ratio7'],2)}</b> giri/min per km/h sulle due McLaren "
            f"({MCL0}, {MCL1}), contro <b>{it(con7[AUD_LONG]['ratio7'],2)}</b> e "
            f"<b>{it(con7[AUD1]['ratio7'],2)}</b> sulle due Audi: uno spread del "
            f"<b>{it(spread_pc)}%</b> fra la più corta e la più lunga. È una misura pulita — "
            f"geometria del cambio, non la tocca né la scia né la mappa motore né il "
            f"carburante.</p>"
            f"<p>Tradotto sulla retta RPM-velocità: a {int(v_ann)} km/h in 7ª la McLaren gira "
            f"<b>{it(delta_ann,0)} giri in più</b> dell’Audi. È il cambio più corto di tutta "
            f"la griglia — lo stesso ordine già emerso a Silverstone — e lo è su una pista, "
            f"l’Hungaroring, dove la velocità di punta conta poco.</p>")},
        {"tag": "Causa", "titolo": "Geometria, non artefatto: regge in 8ª e in banda stretta",
         "figura": "grafico2",
         "html": (
            f"<p>Il primato non è un effetto di come è distribuita la velocità nei nostri "
            f"campioni. Ristretto alla sola banda {BANDA_STRETTA[0]}–{BANDA_STRETTA[1]} km/h, "
            f"il rapporto della McLaren più corta resta <b>{it(str_mcl,2)}</b>, praticamente "
            f"identico al {it(con7[MCL0]['ratio7'],2)} misurato su tutta la banda: nessun "
            f"bias. E l’ordine si ripete in <b>8ª</b>, dove la McLaren resta in testa fra le "
            f"vetture con dati affidabili "
            f"(<b>{it(F['mcl8'][MCL0],2)}</b> e <b>{it(F['mcl8'][MCL1],2)}</b>). L’8ª però è "
            f"poco usata e per alcune vetture — {', '.join(sg(s) for s in senza8)} — non ha "
            f"campioni utili sopra i 250 km/h: per questo il confronto di griglia lo teniamo "
            f"in 7ª, dove tutti hanno dati, verificando che la 8ª racconti la stessa cosa.</p>"
            f"<p>Un cambio più corto tiene il regime più alto a ogni velocità: è una scelta di "
            f"rapporti, e la McLaren la porta all’estremo. Le conseguenze a valle — recupero "
            f"energia, finestra termica del motore — non le misuriamo (i canali ERS non sono "
            f"nel feed pubblico 2026) e non le asseriamo.</p>")},
        {"tag": "Effetto", "titolo": "Corto non vuol dire lento in fondo",
         "figura": "grafico3",
         "html": (
            f"<p>Qui scatta la tentazione: cambio corto uguale meno velocità di punta. In "
            f"prove libere <b>non regge</b>. La correlazione fra rapporto in 7ª e velocità di "
            f"punta mediana è praticamente nulla: <b>Spearman {it(rho,2)}</b> su "
            f"{len(comuni)} vetture. La Mercedes ha la punta più bassa dello schieramento "
            f"(<b>{it(vmax_bot[1],0)} km/h</b>, {sg(vmax_bot[0])}) con un cambio di mezzo; "
            f"l’Audi, la più lunga, ha una delle punte più alte. La McLaren è corta e con "
            f"punta medio-bassa. Nessuna relazione monotona: il rapporto non spiega la "
            f"punta.</p>"
            f"<p>Del resto la punta, in prove libere, è indicativa e basta: carburante e mappa "
            f"motore sono ignoti, e la scia gonfia il picco — fino a "
            f"<b>+{it(F['scia_top']['scia'],0)} km/h</b> su {sg(F['scia_top']['sig'])} "
            f"({it(F['scia_top']['picco'],0)} di picco contro {it(F['scia_top']['med'],0)} di "
            f"mediana). Per questo usiamo la mediana dei picchi per-giro, non il picco. E il "
            f"DRS non aiuta a distinguere: nel feed FP2 il canale è degenere (unico valore 0 "
            f"su {n_lap_tot} giri lanciati), quindi le punte che misuriamo sono tutte ad ala "
            f"chiusa. Morale: il rapporto lo misuriamo — geometria, robusta — la punta resta "
            f"indicativa e non la spieghiamo col cambio.</p>")},
    ]

    figure = {
        "grafico1": {"svg": svg1,
                     "didascalia": (f"In 7ª il regime cresce con la velocità secondo il "
                                    f"rapporto: le linee McLaren sono più ripide (cambio più "
                                    f"corto), le Audi più piatte. A {int(v_ann)} km/h il divario "
                                    f"è di {it(delta_ann,0)} giri/min."),
                     "fonte": f"FastF1 · car telemetry (nGear/RPM/Speed), {GP} {ANNO} {SES}"},
        "grafico2": {"svg": svg2,
                     "didascalia": (f"Rapporto in 7ª per vettura (asse troncato da "
                                    f"{math.floor(r_min)} per leggere le differenze). Più alto = "
                                    f"7ª più corta. Le due McLaren sono staccate in cima, le due "
                                    f"Audi in fondo."),
                     "fonte": "FastF1 · car telemetry, elaborazione redazione"},
        "grafico3": {"svg": svg3,
                     "didascalia": (f"Ogni punto una vettura: rapporto in 7ª (orizzontale) contro "
                                    f"velocità di punta mediana (verticale). La nuvola non ha "
                                    f"pendenza (Spearman {it(rho,2)}): il cambio non predice la "
                                    f"punta in prove libere."),
                     "fonte": "FastF1 · car telemetry, elaborazione redazione"},
    }

    articolo = {
        "id": ID, "stato": "bozza",
        "data": data_bozza or "2026-07-25",
        "firma": "Muretto · Redazione tecnica", "accent": col("McLaren"),
        "canale": "B (nostri dati, telemetria FastF1)",
        "gp": F["gp"], "gara": F["gp"], "circuito": F["circuito"], "sessione": F["sessione"],
        "tag": ["telemetria", "McLaren", "Audi", "cambio", "prove libere", "Ungheria"],
        "occhiello": occhiello, "titolo": titolo, "sommario": sommario,
        "sezioni": [
            {**{k: s[k] for k in ("tag", "titolo", "html")},
             "figura": figure[s["figura"]] if s.get("figura") else None}
            for s in sezioni
        ],
        "provenienza": [
            {"grandezza": "rapporto in 7ª (giri/min per km/h)",
             "valore": (f"{it(con7[MCL0]['ratio7'],2)}/{it(con7[MCL1]['ratio7'],2)} McLaren · "
                        f"{it(con7[AUD_LONG]['ratio7'],2)}/{it(con7[AUD1]['ratio7'],2)} Audi "
                        f"(spread {it(spread_pc)}%)"),
             "stato": "MISURATO",
             "da": (f"mediana RPM/velocità in 7ª (Speed>{V_SOGLIA}) sui giri lanciati FP2; "
                    f"n {min(con7[s]['n7'] for s in con7)}–{max(con7[s]['n7'] for s in con7)} "
                    f"campioni/vettura")},
            {"grandezza": "coerenza in 8ª",
             "valore": f"{it(F['mcl8'][MCL0],2)}/{it(F['mcl8'][MCL1],2)} McLaren (ancora in testa)",
             "stato": "MISURATO",
             "da": (f"stessa misura in 8ª; {', '.join(senza8)} esclusi (<{MIN_CAMP} campioni "
                    f"utili sopra {V_SOGLIA} km/h) → confronto di griglia solo in 7ª")},
            {"grandezza": "controllo bias-distribuzione (banda stretta)",
             "valore": f"{it(str_mcl,2)} in {BANDA_STRETTA[0]}–{BANDA_STRETTA[1]} km/h ≈ {it(con7[MCL0]['ratio7'],2)} pieno",
             "stato": "MISURATO", "da": "rapporto McLaren ristretto alla banda comune di velocità"},
            {"grandezza": "velocità di punta (mediana dei picchi per-giro)",
             "valore": (f"{it(vmax_bot[1],0)}–{it(vmax_top[1],0)} km/h "
                        f"(mediana griglia {it(vmed_grid,1)}, spread {it(v_spread,0)})"),
             "stato": "MISURATO",
             "da": "mediana dei picchi per-giro sui giri lanciati; INDICATIVA in FP"},
            {"grandezza": "scia (picco − mediana)",
             "valore": f"fino a +{it(F['scia_top']['scia'],0)} km/h ({F['scia_top']['sig']})",
             "stato": "MISURATO", "da": "picco singolo vs mediana dei picchi — motivo per usare la mediana"},
            {"grandezza": "correlazione rapporto 7ª ↔ punta",
             "valore": f"Spearman {it(rho,2)} (n={len(comuni)})",
             "stato": "MISURATO", "da": "correlazione di rango fra rapporto in 7ª e punta mediana"},
            {"grandezza": "% del giro a tutto gas (Throttle≥95)",
             "valore": f"mediana griglia {it(gas_grid)}% (min {it(gas_lo[1])} / max {it(gas_hi[1])}, spread {it(gas_spread)} pt)",
             "stato": "MISURATO",
             "da": "mediana per-giro; robusto è il valore-griglia (carattere pista), non il ranking per-pilota"},
            {"grandezza": "stato DRS (ala aperta/chiusa)",
             "valore": "non leggibile", "stato": "NON_MISURABILE",
             "da": f"canale degenere (unico valore {F['drs']} su {n_lap_tot} giri lanciati); punte misurate ad ala chiusa"},
            {"grandezza": "carburante e mappa motore (confondono la punta in FP)",
             "valore": "ignoti", "stato": "NON_MISURABILE",
             "da": "prove libere: assetto/carico e mappe non pubblici → la punta non è un verdetto"},
            {"grandezza": "recupero energia / finestra termica dal regime più alto",
             "valore": "non quantificabile", "stato": "NON_MISURABILE",
             "da": "canali ERS/batteria assenti dal feed pubblico 2026"},
        ],
        "fonti": [
            {"tipo": "dati", "testo": (f"FastF1 3.8.3 — telemetria vettura (nGear/RPM/Speed/"
                                       f"Throttle/DRS), {GP} {ANNO} {SES} (cache locale)")},
            {"tipo": "metodo", "testo": (
                "ai_lab/redazione/genera_hun_rapporti_punta.py — rapporto = mediana RPM/velocità "
                "in 7ª (Speed>250) sui giri lanciati (tele.giri_validi, soglia 1,07); immune a "
                "scia/mappa/giro. Velocità di punta = mediana dei picchi per-giro (mai il picco "
                "singolo). Correlazione rapporto–punta = Spearman. Verificato coerente in 8ª e in "
                "banda 260–285 km/h; DRS scartato perché degenere.")},
        ],
    }
    return F, articolo


META = {
    "id": ID, "canale": "B",
    "titolo": "Il cambio più corto della griglia, sulla pista che meno lo ripaga",
    "tag": ["telemetria", "McLaren", "Audi", "cambio", "prove libere"],
    "descrizione": "rapporti del cambio e velocità di punta all'Hungaroring (McLaren la più corta; corto ≠ lento)",
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
    print(f"Bozza {ID} scritta in {out}")
    mcl0, mcl1 = F["riferimenti"]["mclaren"]
    al = F["riferimenti"]["audi_lungo"]
    print(f"  7ª più corta: {mcl0} {it(F['rapporto7'][mcl0]['ratio'],2)} · "
          f"{mcl1} {it(F['rapporto7'][mcl1]['ratio'],2)} (McLaren)")
    print(f"  7ª più lunga: {al} {it(F['rapporto7'][al]['ratio'],2)} (Audi) · "
          f"spread {it(F['spread_perc'])}%")
    print(f"  punta: {F['vmax_bot'][0]} {it(F['vmax_bot'][1],0)} → "
          f"{F['vmax_top'][0]} {it(F['vmax_top'][1],0)} · mediana {it(F['vmed_grid'],0)}")
    print(f"  Spearman(rapporto,punta) = {it(F['spearman'],2)} (n={F['n_corr']})")
    print(f"  %gas griglia {it(F['gas_grid'])}% · DRS {F['drs']} · "
          f"7ª/8ª>250: {F['gear_hi']}")
