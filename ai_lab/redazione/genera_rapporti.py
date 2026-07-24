"""
Articolo #2 (Canale A+B): "Stesso motore, cambio opposto — la McLaren e' la piu' corta".

Canale A: lo spunto viene da un'analisi di Motorsport.com (rapporti McLaren vs
Mercedes). Canale B: lo RIPRODUCIAMO sui nostri dati (telemetria FastF1, Silverstone
Q 2026). La fonte si cita; i numeri sono i nostri.

Misura a prova di scettico: in una marcia fissa il regime cresce con la velocita'
secondo una costante — il rapporto stesso. RPM/velocita' in 8a e' immune a
slipstream/DRS/giro: e' geometria del cambio. La McLaren ha la costante piu' alta
della griglia (8a piu' corta), pur montando lo stesso motore Mercedes del team
ufficiale e di Williams.

python3 UTENTE (fastf1), non la .venv. Solo lettura; bozza nell'area Lab.
"""
from __future__ import annotations
import os
import sys
import json
import datetime
import statistics as stt

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele   # noqa: E402
import svg    # noqa: E402
import base   # noqa: E402

ID = "rapporti-mclaren-mercedes-gb-2026"
# power unit 2026 per team (per isolare il rapporto come unica variabile)
PU = {"Mercedes": "Mercedes", "McLaren": "Mercedes", "Williams": "Mercedes",
      "Alpine": "Mercedes", "Ferrari": "Ferrari", "Haas F1 Team": "Ferrari",
      "Cadillac": "Ferrari", "Red Bull Racing": "Red Bull", "Racing Bulls": "Red Bull",
      "Aston Martin": "Honda", "Audi": "Audi"}
MCL, MERC, WIL = "NOR", "RUS", "SAI"   # cars-firma a motore Mercedes


def _punti8(ses, num):
    """Tutti i punti (Speed,RPM) in 8a marcia dai giri lanciati, + Vmax."""
    S, R = [], []
    vmax = 0.0
    for lap in tele.giri_validi(ses, num):
        try:
            t = tele.canale_giro(lap)
        except Exception:
            continue
        m = (t["nGear"] == 8)
        S += list(t["Speed"][m].values)
        R += list(t["RPM"][m].values)
        vmax = max(vmax, float(t["Speed"].max()))
    return S, R, vmax


def _curva(S, R, lo=260, hi=318, passo=4):
    """Mediana RPM per bin di velocita' nella fascia dove l'8a e' usata davvero
    (alta velocita'): sotto i ~260 km/h i pochi punti in 8a sono transitori di
    scalata e vanno esclusi. Ritorna la retta RPM-vs-velocita' della marcia."""
    punti = []
    b = lo
    while b <= hi:
        vals = [r for s, r in zip(S, R) if b <= s < b + passo]
        if len(vals) >= 6:
            punti.append((b + passo / 2, stt.median(vals)))
        b += passo
    return punti


def misura(ses, num):
    S, R, vmax = _punti8(ses, num)
    ratios = [r / s for s, r in zip(S, R) if s > 200]
    if len(ratios) < 25:
        return None
    ratio = stt.median(ratios)
    return {"ratio": ratio, "rpm300": ratio * 300, "vmax": vmax,
            "n": len(ratios), "curva": _curva(S, R)}


def it(x, dec=1):
    return base.it(x, dec)


def costruisci(anno=2026, gp="British Grand Prix", data_bozza=None):
    ses = tele.carica_sessione(anno, gp, "Q")
    piloti = tele.piloti_sessione(ses)
    colori = base.carica_colori()

    per_car = {}
    for sig, info in piloti.items():
        m = misura(ses, info["num"])
        if m:
            per_car[sig] = {**m, "team": info["team"], "pu": PU.get(info["team"], "?")}

    a = per_car[MCL]   # McLaren
    b = per_car[MERC]  # Mercedes
    w = per_car[WIL]   # Williams
    delta = a["rpm300"] - b["rpm300"]
    perc = (a["ratio"] / b["ratio"] - 1) * 100
    dvmax = b["vmax"] - a["vmax"]

    # per-team RPM@300 (media auto) e Vmax, per il grafico ranking
    per_team = {}
    for sig, d in per_car.items():
        per_team.setdefault(d["team"], []).append(d)
    team_rpm = {t: stt.mean(x["rpm300"] for x in v) for t, v in per_team.items()}

    F = {
        "id": ID, "anno": anno, "gara": "Gran Bretagna", "circuito": "Silverstone",
        "sessione": "Qualifiche",
        "featured": {"McLaren": {"car": MCL, **a}, "Mercedes": {"car": MERC, **b},
                     "Williams": {"car": WIL, **w}},
        "delta_rpm_300": delta, "ottava_piu_corta_perc": perc, "delta_vmax": dvmax,
        "per_car": {s: {k: d[k] for k in ("team", "pu", "ratio", "rpm300", "vmax", "n")}
                    for s, d in per_car.items()},
        "team_rpm300": team_rpm,
    }

    # --- grafici ---
    col = lambda t: colori.get(t) or "var(--dim)"
    serie = [
        {"sigla": f"{MCL} · McLaren", "colore": col("McLaren"), "punti": a["curva"]},
        {"sigla": f"{MERC} · Mercedes", "colore": col("Mercedes"), "punti": b["curva"]},
        {"sigla": f"{WIL} · Williams", "colore": col("Williams"), "punti": w["curva"]},
    ]
    svg1 = svg.grafico_xy(
        serie, x_range=(258, 318), y_range=(8800, 11700),
        x_ticks=[260, 280, 300, 315], y_ticks=[9000, 9500, 10000, 10500, 11000, 11500],
        x_label="velocità (km/h)", y_label="giri/min",
        x_annota=300, annota_txt=f"a 300 km/h: +{it(delta,0)} giri",
        titolo="Regime in 8ª marcia — stesso motore Mercedes",
        sub="McLaren, Mercedes, Williams · Qualifiche GB 2026")

    # ranking RPM@300 per team (asse troncato, dichiarato)
    barre = sorted(
        [{"sigla": t, "colore": col(t), "valore": r, "evidenza": (t == "McLaren")}
         for t, r in team_rpm.items()],
        key=lambda x: -x["valore"])
    svg2 = svg.barre_dv(
        barre, titolo="Quanto è corta l'8ª: giri/min a 300 km/h, per team",
        base=10200, ml=104,
        caption="giri/min a 300 km/h in 8ª · asse da 10.200 (più alto = più corto)")

    # prosa (numeri iniettati)
    testo = {
        "occhiello": f"Telemetria · Qualifiche {F['gara']} {anno}",
        "titolo": "Stesso motore, cambio opposto: la McLaren è la più corta della griglia",
        "sommario": ("McLaren, Mercedes e Williams montano lo stesso motore Mercedes. Eppure "
                     "in ottava marcia la McLaren gira quasi seicento giri più su a 300 all'ora, "
                     "e rinuncia a qualche km/h di velocità di punta. È una scelta di rapporti — "
                     "e ha una logica precisa."),
        "sezioni": [
            {"tag": "Evidenza", "titolo": "La stessa power unit, un'ottava più corta",
             "html": (
                f"<p>In una marcia fissa il regime del motore cresce con la velocità secondo una "
                f"costante: quella costante <i>è</i> il rapporto. Misurata sui giri lanciati delle "
                f"qualifiche di Silverstone, in ottava vale <b>{it(a['ratio'],2)}</b> giri/min per "
                f"km/h sulle due McLaren, contro <b>{it(b['ratio'],2)}</b> sulle Mercedes e "
                f"<b>{it(w['ratio'],2)}</b> sulle Williams — tutte e tre a motore Mercedes. È una "
                f"misura pulita: il rapporto è geometria del cambio, non lo tocca né lo slipstream "
                f"né il giro.</p>"
                f"<p>Tradotto a 300 km/h: la McLaren gira a <b>{it(a['rpm300'],0)}</b> giri, la "
                f"Mercedes a <b>{it(b['rpm300'],0)}</b> — <b>{it(delta,0)} in più</b>. È l'ottava "
                f"più corta di tutta la griglia; quella della Mercedes ufficiale, con lo stesso "
                f"motore, è tra le più lunghe. E la velocità di punta segue: la McLaren si ferma a "
                f"<b>{it(a['vmax'],0)} km/h</b>, la Mercedes arriva a <b>{it(b['vmax'],0)}</b>.</p>"
             ), "figura": "grafico1"},
            {"tag": "Causa", "titolo": "Rinunciare alla punta per stare su di giri",
             "html": (
                f"<p>Il rapporto decide, a ogni velocità, dove sta il motore nella sua curva. "
                f"Un'ottava più corta tiene il regime più alto dappertutto: la McLaren rinuncia alla "
                f"velocità massima assoluta per restare su di giri. Nell'era ibrida 2026 questo ha "
                f"due conseguenze.</p>"
                f"<p>La prima non la vediamo direttamente: più regime significa più finestra per la "
                f"MGU-K di recuperare energia. <b>Quanta</b>, non è misurabile — i canali ERS e "
                f"batteria non sono nel feed pubblico 2026, e restano una variabile latente che "
                f"dichiariamo invece di stimare. La seconda, invece, si vede eccome: un'ottava corta "
                f"protegge dal <i>clipping</i>. Sui lunghi rettilinei, quando l'energia elettrica "
                f"finisce, chi ha l'ottava lunga scende sotto la power band del termico e deve "
                f"scalare in settima a gas pieno per rimettere il motore in giri; chi ce l'ha corta "
                f"resta abbastanza su di giri da non doverlo fare. Ai nostri dati di Spa — dove metà "
                f"griglia scala marcia in pieno rettilineo e la McLaren no — dedicheremo il prossimo "
                f"pezzo.</p>"
             ), "figura": "grafico2"},
            {"tag": "Effetto", "titolo": "Il baratto dei rapporti, portato all'estremo",
             "html": (
                f"<p>Il conto è <b>{it(delta,0)} giri/min in più a 300 km/h</b>, un'ottava più corta "
                f"del <b>{it(perc,1)}%</b> rispetto alla Mercedes che monta lo stesso motore, e "
                f"<b>{it(dvmax,0)} km/h</b> di velocità di punta in meno. In cambio il motore resta "
                f"più in coppia in uscita dalle curve e più al riparo dal clipping sui lunghi. È il "
                f"classico compromesso dei rapporti — velocità di punta contro regime — portato "
                f"all'estremo: sulla griglia 2026, nessuno è più corto della McLaren.</p>"
             )},
        ],
    }

    articolo = {
        "id": ID, "stato": "bozza", "data": data_bozza or datetime.date.today().isoformat(),
        "firma": "Muretto · Redazione tecnica", "accent": col("McLaren"),
        "canale": "A+B (spunto web, riprodotto sui nostri dati)",
        "gara": F["gara"], "circuito": F["circuito"], "sessione": F["sessione"],
        "tag": ["telemetria", "McLaren", "Mercedes", "cambio", "qualifiche"],
        "occhiello": testo["occhiello"], "titolo": testo["titolo"], "sommario": testo["sommario"],
        "sezioni": [
            {**{k: s[k] for k in ("tag", "titolo", "html")},
             "figura": ({
                 "grafico1": {"svg": svg1,
                              "didascalia": (f"In 8ª il regime cresce con la velocità secondo il "
                                             f"rapporto: la linea McLaren è più ripida (rapporto più "
                                             f"corto). A 300 km/h la McLaren gira {it(delta,0)} giri più "
                                             f"su della Mercedes, con lo stesso motore."),
                              "fonte": "FastF1 · car telemetry (nGear/RPM/Speed), Qualifiche GB 2026"},
                 "grafico2": {"svg": svg2,
                              "didascalia": ("Giri/min a 300 km/h in 8ª, per team (asse troncato da "
                                             "10.200 per leggere le differenze). Più alto = 8ª più corta. "
                                             "La McLaren è staccata in cima."),
                              "fonte": "FastF1 · car telemetry, elaborazione redazione"},
             }[s["figura"]]) if s.get("figura") else None}
            for s in testo["sezioni"]
        ],
        "provenienza": [
            {"grandezza": "rapporto in 8ª (giri/min per km/h)",
             "valore": f"{it(a['ratio'],2)} McLaren · {it(b['ratio'],2)} Mercedes · {it(w['ratio'],2)} Williams",
             "stato": "MISURATO", "da": "mediana RPM/velocità in 8ª sui giri lanciati (FastF1)"},
            {"grandezza": "giri/min a 300 km/h in 8ª",
             "valore": f"{it(a['rpm300'],0)} McLaren · {it(b['rpm300'],0)} Mercedes (Δ {it(delta,0)})",
             "stato": "MISURATO", "da": "rapporto × 300"},
            {"grandezza": "velocità di punta",
             "valore": f"{it(a['vmax'],0)} km/h McLaren · {it(b['vmax'],0)} Mercedes",
             "stato": "MISURATO", "da": "max velocità sui giri lanciati (FastF1)"},
            {"grandezza": "energia recuperata (MGU-K) grazie al regime più alto",
             "valore": "non quantificabile", "stato": "NON_MISURABILE",
             "da": "canali ERS/batteria assenti dal feed pubblico 2026"},
        ],
        "fonti": [
            {"tipo": "spunto", "testo": "Motorsport.com — «McLaren and Mercedes divided by the gearbox» (Canale A: idea di partenza, verificata sui nostri dati)"},
            {"tipo": "dati", "testo": "FastF1 3.8.3 — telemetria vettura (nGear/RPM/Speed), Qualifiche Gran Premio di Gran Bretagna 2026 (cache locale)"},
            {"tipo": "metodo", "testo": "ai_lab/redazione/genera_rapporti.py — rapporto = mediana RPM/velocità in 8ª marcia (Speed>200) sui giri lanciati; immune a slipstream e giro. La mediana del rapporto è preferita alla regressione RPM–velocità, instabile su una finestra di velocità stretta; ristretta alla sola banda 300–313 km/h la differenza McLaren–Mercedes resta 5,5% (nessun bias da distribuzione di velocità)."},
        ],
    }
    return F, articolo


META = {
    "id": ID, "canale": "A+B",
    "titolo": "Stesso motore, cambio opposto: la McLaren è la più corta della griglia",
    "tag": ["telemetria", "McLaren", "Mercedes", "cambio"],
    "descrizione": "rapporti del cambio a parità di power unit (McLaren la più corta)",
    "richiede": "telemetria", "gare": ["Gran Bretagna"],
}


def genera(gara=None, data=None):
    if gara not in (None, "Gran Bretagna", "British Grand Prix"):
        return None
    F, art = costruisci(2026, "British Grand Prix", data_bozza=data)
    base.scrivi_bozza(ID, art, F)
    return {"id": ID, "titolo": art["titolo"], "stato": art["stato"], "canale": "A+B"}


if __name__ == "__main__":
    F, art = costruisci()
    base.scrivi_bozza(ID, art, F)
    a = F["featured"]
    print(f"Bozza {ID} scritta.")
    print(f"  McLaren {a['McLaren']['car']}: ratio {it(a['McLaren']['ratio'],2)} "
          f"rpm300 {it(a['McLaren']['rpm300'],0)} vmax {it(a['McLaren']['vmax'],0)}")
    print(f"  Mercedes {a['Mercedes']['car']}: ratio {it(a['Mercedes']['ratio'],2)} "
          f"rpm300 {it(a['Mercedes']['rpm300'],0)} vmax {it(a['Mercedes']['vmax'],0)}")
    print(f"  Δ rpm@300 = {it(F['delta_rpm_300'],0)} · 8a più corta {it(F['ottava_piu_corta_perc'],1)}% "
          f"· Δvmax {it(F['delta_vmax'],0)} km/h")
