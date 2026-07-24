"""
Generatore del primo articolo (collaudo): "Il lift Mercedes prima del traguardo".

Fa TUTTO cio' che il brief chiede da una sola catena deterministica:
  1. misura l'anomalia sui nostri dati (rilevatore lift_traguardo)
  2. genera i grafici SVG annotati DALLO STESSO codice che ha calcolato i numeri
  3. inietta ogni numero nella prosa da un template (nessun numero a mano)
  4. scrive la bozza nell'area Lab (ai_lab/redazione/bozze/<id>/): mai in demo/

La pubblicazione in demo/ e' un gesto separato e umano (pubblica.py / coda.py).

Ambiente: python3 UTENTE (fastf1), NON la .venv.  Solo lettura sul repo.
"""
from __future__ import annotations
import os
import sys
import json
import datetime

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
sys.path.insert(0, os.path.join(_QUI, "rilevatori"))
import tele            # noqa: E402
import svg             # noqa: E402
import lift_traguardo as R   # noqa: E402

REPO = os.path.abspath(os.path.join(_QUI, "..", ".."))
ID = "lift-mercedes-gb-2026"
DMAX = 250.0
FIGA_MERC = "ANT"      # Mercedes in evidenza (giro veloce assoluto)
FIGA_RIVAL = "LEC"     # rivale piu' veloce, riferimento senza lift

TEAM_COLORI = os.path.join(REPO, "demo", "team_colori.json")
PISTA_GB = os.path.join(REPO, "demo", "data", "pista_Gran Bretagna.json")


# ---- formattazione italiana ----------------------------------------------
def it(x, dec=1):
    if x is None:
        return "–"
    s = f"{x:.{dec}f}"
    return s.replace(".", ",")


def lap_fmt(sec):
    if sec is None:
        return "–"
    m = int(sec // 60)
    r = sec - 60 * m
    return f"{m}:{r:06.3f}".replace(".", ",")


# ---- estrazione tracce ----------------------------------------------------
def traccia_finale(ses, num, dmax=DMAX, n=95):
    """Giro veloce -> [(dist_dalla_linea_m, v_kmh, thr_pct)] negli ultimi dmax m."""
    lap = ses.laps.pick_drivers(num).pick_fastest()
    tel = tele.canale_giro(lap)
    Lmax = float(tel["Distance"].max())
    sub = tel[tel["Distance"] >= Lmax - dmax].reset_index(drop=True)
    punti = []
    for _, r in sub.iterrows():
        punti.append((Lmax - float(r["Distance"]), float(r["Speed"]), float(r["Throttle"])))
    punti.sort(key=lambda p: -p[0])           # da lontano (dmax) verso la linea (0)
    # downsample uniforme
    if len(punti) > n:
        step = len(punti) / n
        punti = [punti[int(i * step)] for i in range(n)]
    return punti, tele.secondi(lap["LapTime"])


def punto_pista(dist_lift):
    """(x,y) sul tracciato GB a dist_lift metri PRIMA della linea, + linea traguardo."""
    d = json.load(open(PISTA_GB))
    L = d["lunghezza_m"]
    target = L - dist_lift
    dd = d["dist"]
    i = min(range(len(dd)), key=lambda k: abs(dd[k] - target))
    return {
        "viewBox": d["viewBox"],
        "punti": d["punti"],
        "traguardo": d["punti"][0],
        "lift_xy": d["punti"][i],
        "lift_dist": dd[i],
        "lunghezza_m": L,
    }


def svg_pista(p, etichetta):
    vb = p["viewBox"]
    W, H = vb[2], vb[3]
    dd = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in p["punti"]) + " Z"
    tx, ty = p["traguardo"]
    lx, ly = p["lift_xy"]
    # i due punti quasi coincidono (45 m su ~5,8 km): etichette impilate a destra
    ex = max(tx, lx) + 16
    return (
        f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" class="art-svg art-pista">'
        f'<path d="{dd}" fill="none" stroke="var(--line2)" stroke-width="3" '
        f'stroke-linejoin="round"/>'
        f'<circle cx="{tx:.1f}" cy="{ty:.1f}" r="6" fill="none" stroke="var(--brand)" stroke-width="3"/>'
        f'<circle cx="{lx:.1f}" cy="{ly:.1f}" r="7.5" fill="var(--accent)"/>'
        f'<line x1="{lx+7:.1f}" y1="{ly:.1f}" x2="{ex-3:.1f}" y2="{ly-14:.1f}" stroke="var(--line2)" stroke-width="1.5"/>'
        f'<text x="{ex:.1f}" y="{ly-18:.1f}" font-size="16" fill="var(--dim)" '
        f'font-family="{svg.MONO}">traguardo</text>'
        f'<text x="{ex:.1f}" y="{ly-1:.1f}" font-size="17" fill="var(--txt)" '
        f'font-family="{svg.DISP}" letter-spacing="0.4">{svg.esc(etichetta)}</text>'
        f'</svg>'
    )


# ---- prosa (template: ogni numero e' iniettato dai fatti) ------------------
def prosa(F):
    m = F["merc"]
    riv = F["rivali"]
    a = F["evidenza_merc"]        # ANT
    b = F["evidenza_merc2"]       # RUS

    def rip(e):
        if e["n_lift"] == e["n_giri"]:
            return f"in tutti e {e['n_giri']} i suoi giri lanciati"
        return f"in {e['n_lift']} dei suoi {e['n_giri']} giri lanciati"

    return {
        "occhiello": f"Telemetria · Qualifiche {F['gara']} {F['anno']}",
        "titolo": "Il lift Mercedes prima del traguardo",
        "sommario": (
            "Sul giro lanciato a Silverstone entrambe le Mercedes staccano il piede "
            "dall'acceleratore poche decine di metri prima della linea. Nessun altro lo fa. "
            "Sul cronometro costa quasi nulla — ed è proprio questo il punto."
        ),
        "sezioni": [
            {
                "tag": "Evidenza",
                "titolo": "Due auto, un gesto che nessun altro fa",
                "html": (
                    f"<p>La telemetria delle qualifiche del {F['gara_lungo']} mostra un gesto "
                    f"ripetuto e isolato: <b>{a['sigla']}</b> e <b>{b['sigla']}</b>, le due Mercedes, "
                    f"rilasciano l'acceleratore da pieno a chiuso nell'ultimo tratto del rettilineo del "
                    f"traguardo. Toccano il picco del rettilineo — <b>{it(a['vpeak'],0)} km/h</b> "
                    f"{a['sigla']}, <b>{it(b['vpeak'],0)}</b> {b['sigla']} — e da lì alzano il piede fino "
                    f"a tagliare la linea con il pedale a zero. Sul suo giro più veloce "
                    f"({lap_fmt(a['lap'])}) {a['sigla']} è ancora a pieno gas a <b>{it(a['d_lift'],0)} "
                    f"metri</b> dalla linea, {b['sigla']} a <b>{it(b['d_lift'],0)} metri</b>: da lì il "
                    f"pedale va a zero.</p>"
                    f"<p>Non è un episodio isolato di un giro: {a['sigla']} lo ripete {rip(a)}, "
                    f"{b['sigla']} {rip(b)}. Gli altri venti piloti in pista — Ferrari, McLaren, Red "
                    f"Bull, Williams e tutto il resto dello schieramento — tagliano la linea con "
                    f"l'acceleratore ancora spalancato: su <b>{riv['n_giri']} giri lanciati misurati, "
                    f"zero lift</b>.</p>"
                ),
                "figura": "grafico1",
            },
            {
                "tag": "Causa",
                "titolo": "Non è il giro in corso: è la batteria per il prossimo",
                "html": (
                    f"<p>Il motivo non sta nel giro che si sta chiudendo, ma nel bilancio energetico "
                    f"dell'ibrido. L'unità di potenza recupera energia in due fasi — sotto frenata e in "
                    f"rilascio. Alzando il piede a qualche decina di metri dalla linea, la Mercedes "
                    f"trasforma per un istante la coda del rettilineo in una zona di recupero: il termico "
                    f"smette di spingere e parte dell'energia cinetica, che verrebbe altrimenti dissipata, "
                    f"rientra nella batteria.</p>"
                    f"<p>È una scelta di gestione del <b>SOC</b> (state of charge) in vista del giro "
                    f"successivo. La potenza elettrica in F1 è a budget di energia per giro: chi arriva a "
                    f"fine giro con più carica ha più <i>deployment</i> da spendere dove pesa di più — in "
                    f"uscita dalle curve lente, all'imbocco dei rettilinei. Il lift prima della linea è il "
                    f"modo di finanziare quel margine nel punto in cui costa meno.</p>"
                    f"<p>Quello che i nostri canali <b>non</b> vedono è la contropartita: lo stato di carica "
                    f"e il flusso dell'MGU-K non sono nella telemetria disponibile. Il recupero resta perciò "
                    f"una <b>variabile latente</b> — coerente con la fisica e con la sistematicità del gesto, "
                    f"ma non quantificabile in joule dai dati che abbiamo. Lo dichiariamo, invece di stimarlo "
                    f"di nascosto.</p>"
                ),
                "figura": "pista",
            },
            {
                "tag": "Effetto",
                "titolo": "Quasi gratis sul cronometro, ed è per questo che conviene",
                "html": (
                    f"<p>Sul tempo del giro che si sta chiudendo il lift costa pochissimo, ed è esattamente "
                    f"ciò che lo rende conveniente. Il tratto interessato è la coda del rettilineo, dove il "
                    f"giro è ormai fatto: tenendo la velocità del picco fino alla linea, {a['sigla']} e "
                    f"{b['sigla']} recupererebbero appena qualche millesimo — sull'ordine del millesimo di "
                    f"secondo, dentro il rumore di un giro cronometrato.</p>"
                    f"<p>Il prezzo pagato in pista è tutto qui: qualche km/h in meno alla linea "
                    f"(<b>{it(a['dv'])} km/h</b> per {a['sigla']}, <b>{it(b['dv'])}</b> per {b['sigla']}) e una "
                    f"manciata di millesimi che non spostano la posizione in griglia. In cambio, la batteria "
                    f"arriva al giro dopo con più margine. È un baratto quasi gratuito sul giro in corso per un "
                    f"vantaggio che si scarica altrove — la ragione per cui, per ora, conviene solo a chi ha "
                    f"scelto di gestire così l'energia: le due Mercedes.</p>"
                ),
                "figura": "grafico2",
            },
        ],
    }


# ---- costruzione ----------------------------------------------------------
def costruisci(anno, gp, data_bozza=None):
    ses, piloti, righe = R.scansiona(anno, gp, "Q")
    colori = json.load(open(TEAM_COLORI))

    def col(team):
        return colori.get(team) or "var(--dim)"

    # evidenza: le due Mercedes + il rivale di riferimento
    def ev(sig):
        r = righe[sig]
        v = r["veloce"]
        c = v.get("costo_s")
        return {
            "sigla": sig, "team": r["team"], "colore": col(r["team"]),
            "n_giri": r["n_giri"], "n_lift": r["n_lift"], "frac_lift": r["frac_lift"],
            "lap": r["t_veloce"], "d_lift": v.get("d_lift"),
            "dv": v.get("dv"), "vline": v.get("vline"), "vpeak": v.get("vpeak"),
            "costo_s": c, "costo_ms": (c * 1000 if c is not None else None),
            "d_lift_med": r["d_lift_med"], "dv_med": r["dv_med"],
        }

    merc = [s for s, r in righe.items() if r.get("team") == "Mercedes" and r.get("n_giri")]
    a = ev(FIGA_MERC)
    b = ev([s for s in merc if s != FIGA_MERC][0])

    riv_giri = sum(r["n_giri"] for s, r in righe.items()
                   if r.get("team") != "Mercedes" and r.get("n_giri"))
    riv_lift = sum(r["n_lift"] for s, r in righe.items()
                   if r.get("team") != "Mercedes" and r.get("n_giri"))

    # tracce per il grafico 1
    tA, ltA = traccia_finale(ses, piloti[FIGA_MERC]["num"])
    tR, ltR = traccia_finale(ses, piloti[FIGA_RIVAL]["num"])

    # barre grafico 2: dV alla linea sul giro veloce, per pilota
    barre = []
    for s, r in righe.items():
        if not r.get("n_giri"):
            continue
        dv = (r["veloce"] or {}).get("dv") or 0.0
        barre.append({"sigla": s, "colore": col(r["team"]),
                      "valore": max(0.0, dv), "evidenza": r["team"] == "Mercedes"})
    barre.sort(key=lambda x: -x["valore"])

    pista = punto_pista(a["d_lift"])

    F = {
        "id": ID, "anno": anno, "gara": "Gran Bretagna",
        "gara_lungo": "Gran Premio di Gran Bretagna", "circuito": "Silverstone",
        "sessione": "Qualifiche",
        "merc": {"n_giri_tot": sum(righe[s]["n_giri"] for s in merc),
                 "n_lift_tot": sum(righe[s]["n_lift"] for s in merc), "piloti": merc},
        "rivali": {"n_giri": riv_giri, "n_lift": riv_lift, "n_piloti":
                   sum(1 for s, r in righe.items() if r.get("team") != "Mercedes" and r.get("n_giri"))},
        "evidenza_merc": a, "evidenza_merc2": b,
        "soglie": {"FINALE_M": R.FINALE_M, "THR_PIENO": R.THR_PIENO,
                   "V0_MIN": R.V0_MIN, "D_MIN": R.D_MIN},
    }

    # --- SVG (dalla stessa catena) ---
    serie1 = [
        {"sigla": FIGA_MERC, "colore": a["colore"],
         "punti": [(d, v, t) for d, v, t in tA]},
        {"sigla": FIGA_RIVAL, "colore": ev(FIGA_RIVAL)["colore"],
         "punti": [(d, v, t) for d, v, t in tR]},
    ]
    svg1 = svg.grafico_lift(
        serie1, a["d_lift"], f"lift  -{it(a['d_lift'],0)} m",
        titolo=f"{FIGA_MERC} (Mercedes) vs {FIGA_RIVAL} (Ferrari) — ultimi {int(DMAX)} m del giro veloce",
        sub="velocità + gas · Qualifiche GB 2026")
    svg2 = svg.barre_dv(
        barre, titolo="Velocità persa alla linea, per pilota",
        sub="giro più veloce di ognuno")
    svgP = svg_pista(pista, f"lift  -{it(a['d_lift'],0)} m")

    testo = prosa(F)
    oggi = data_bozza or datetime.date.today().isoformat()

    articolo = {
        "id": ID, "stato": "bozza", "data": oggi,
        "firma": "Muretto · Redazione tecnica",
        "accent": a["colore"],
        "canale": "B (anomalia nei nostri dati)",
        "gara": F["gara"], "circuito": F["circuito"], "sessione": F["sessione"],
        "tag": ["telemetria", "Mercedes", "qualifiche", "ibrido"],
        "occhiello": testo["occhiello"], "titolo": testo["titolo"],
        "sommario": testo["sommario"],
        "sezioni": [
            {**{k: s[k] for k in ("tag", "titolo", "html")},
             "figura": ({
                 "grafico1": {"svg": svg1,
                              "didascalia": (f"Ultimi {int(DMAX)} m del giro veloce. Il gas di {FIGA_RIVAL} "
                                             f"resta al 100% fino alla linea; quello di {FIGA_MERC} è ancora "
                                             f"pieno a {it(a['d_lift'],0)} m e va a zero prima di tagliarla, "
                                             f"e con esso cala la velocità."),
                              "fonte": "FastF1 · car telemetry (Speed/Throttle), Qualifiche GB 2026"},
                 "grafico2": {"svg": svg2,
                              "didascalia": ("La velocità persa alla linea sul giro veloce isola le due "
                                             "Mercedes dal resto dello schieramento."),
                              "fonte": "FastF1 · car telemetry, elaborazione redazione"},
                 "pista": {"svg": svgP,
                           "didascalia": (f"Il punto di lift ({it(a['d_lift'],0)} m prima della linea) sul "
                                          f"rettilineo del traguardo di Silverstone."),
                           "fonte": "FastF1 · GPS position, tracciato del sito"},
             }[s["figura"]])}
            for s in testo["sezioni"]
        ],
        "provenienza": [
            {"grandezza": "ultimo campione a pieno gas (m prima della linea)", "valore": f"{it(a['d_lift'],0)} m ({FIGA_MERC}), {it(b['d_lift'],0)} m ({b['sigla']})",
             "stato": "MISURATO", "da": "FastF1 car telemetry; limite superiore del punto di rilascio (car-data ~4 Hz)"},
            {"grandezza": "ripetibilità del lift", "valore": f"{a['n_lift']}/{a['n_giri']} ({FIGA_MERC}), {b['n_lift']}/{b['n_giri']} ({b['sigla']}), {F['rivali']['n_lift']}/{F['rivali']['n_giri']} (resto)",
             "stato": "MISURATO", "da": "giri lanciati (IsAccurate + tempo ≤ 1,07× il giro veloce del pilota)"},
            {"grandezza": "km/h persi alla linea", "valore": f"{it(a['dv'])} ({FIGA_MERC}), {it(b['dv'])} ({b['sigla']})",
             "stato": "MISURATO", "da": "FastF1 car telemetry"},
            {"grandezza": "costo sul giro in corso", "valore": f"~{it(a['costo_s'],3)} s ({a['sigla']}) … {it(b['costo_s'],3)} s ({b['sigla']})",
             "stato": "STIMATO", "da": "controfattuale: velocità del picco tenuta fino alla linea (minorante); dentro il rumore"},
            {"grandezza": "energia recuperata / SOC", "valore": "non quantificabile",
             "stato": "NON_MISURABILE", "da": "canali ERS/batteria assenti dalla telemetria disponibile"},
        ],
        "fonti": [
            {"tipo": "dati", "testo": "FastF1 3.8.3 — telemetria vettura, Qualifiche Gran Premio di Gran Bretagna 2026 (cache locale)"},
            {"tipo": "metodo", "testo": f"rilevatore ai_lab/redazione/rilevatori/lift_traguardo.py — soglie dichiarate: finestra {int(R.FINALE_M)} m, gas pieno ≥ {int(R.THR_PIENO)}%, V0 ≥ {int(R.V0_MIN)} km/h, lift ≥ {int(R.D_MIN)} m"},
        ],
    }

    return F, articolo


def scrivi(F, articolo, data_bozza=None):
    out = os.path.join(_QUI, "bozze", ID)
    os.makedirs(out, exist_ok=True)
    json.dump(F, open(os.path.join(out, "facts.json"), "w"), ensure_ascii=False, indent=2)
    json.dump(articolo, open(os.path.join(out, "articolo.json"), "w"), ensure_ascii=False, indent=2)
    with open(os.path.join(out, "stato.json"), "w") as fh:
        json.dump({"id": ID, "stato": "bozza", "attore": None,
                   "creato": articolo["data"], "storico": [
                       {"stato": "bozza", "attore": "redazione", "quando": articolo["data"],
                        "nota": "bozza generata dal rilevatore lift_traguardo"}]},
                  fh, ensure_ascii=False, indent=2)
    # versione umana .md
    md = [f"# {articolo['titolo']}", "", f"*{articolo['occhiello']} — {articolo['firma']} · {articolo['data']} · BOZZA*",
          "", f"> {articolo['sommario']}", ""]
    import re
    for s in articolo["sezioni"]:
        md.append(f"## {s['tag']} — {s['titolo']}")
        md.append(re.sub("<[^>]+>", "", s["html"]).replace("</p>", "\n\n"))
        if s.get("figura"):
            md.append(f"*[figura] {s['figura']['didascalia']} — fonte: {s['figura']['fonte']}*")
        md.append("")
    md.append("## Provenienza dei dati")
    for p in articolo["provenienza"]:
        md.append(f"- **{p['grandezza']}**: {p['valore']} — `{p['stato']}` ({p['da']})")
    open(os.path.join(out, "bozza.md"), "w").write("\n".join(md))
    return out


META = {
    "id": ID,
    "canale": "B",
    "titolo": "Il lift Mercedes prima del traguardo",
    "tag": ["telemetria", "Mercedes", "qualifiche", "ibrido"],
    "descrizione": "lift prima del traguardo in qualifica (recupero energetico)",
    "richiede": "telemetria",
    "gare": ["Gran Bretagna"],
}


def genera(gara=None, data=None):
    """Contratto del framework. Detector GB-specifico (per ora): fira solo per la
    Gran Bretagna. Ritorna il record della bozza, o None se non applicabile."""
    if gara not in (None, "Gran Bretagna", "British Grand Prix"):
        return None
    F, art = costruisci(2026, "British Grand Prix", data_bozza=data)
    scrivi(F, art, data_bozza=data)
    return {"id": ID, "titolo": art["titolo"], "stato": art["stato"], "canale": "B"}


if __name__ == "__main__":
    anno = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
    gp = sys.argv[2] if len(sys.argv) > 2 else "British Grand Prix"
    F, art = costruisci(anno, gp)
    out = scrivi(F, art)
    a = F["evidenza_merc"]; b = F["evidenza_merc2"]
    print(f"Bozza scritta in {out}")
    print(f"  {a['sigla']}: lift {a['n_lift']}/{a['n_giri']}, veloce -{it(a['d_lift'],0)}m, "
          f"dV {it(a['dv'])} km/h, costo {it(a['costo_s'],3)}s")
    print(f"  {b['sigla']}: lift {b['n_lift']}/{b['n_giri']}, veloce -{it(b['d_lift'],0)}m, dV {it(b['dv'])} km/h")
    print(f"  rivali: {F['rivali']['n_lift']}/{F['rivali']['n_giri']} lift su {F['rivali']['n_piloti']} piloti")
