#!/usr/bin/env python
"""Verifica coordinate e pit lane su FP2 Spa 2026 (KPI 4 e 5) — solo stdlib.

Input:
  - registrazione FP2 (data/live_raw/2026-07-17_16-53-20.txt)
  - polilinea di riferimento del sito: data/live_derived/spa_ref_track.json
    (giro pulito GP Belgio 2025, coordinate grezze FastF1 in decimi di metro,
    estratto una tantum con live/estrai_riferimenti.py)

Output in data/live_derived/:
  - spa_2026_fp2_xy.svg        nuvola X/Y FP2 (sottocampionata ~1/10) +
                               tracciato riferimento + punti pit, SVG stdlib
  - transform_spa.json         trasformazione fissa applicata (anche identita')
  - pitlane_spa.json           polilinea della pit lane (da punti InPit)
  - verifica_allineamento.json riepilogo numerico (KPI 4 e 5)

Definizioni dichiarate (prima di guardare i numeri):
  - punto on-track: campione valido fuori dagli intervalli InPit del pilota;
  - KPI 4: >=95% dei punti on-track entro 15 m dalla polilinea riferimento
    (dopo eventuale trasformazione fissa: traslazione/rotazione/scala unica);
  - periodo pit coerente (KPI 5): intervallo InPit con >=10 campioni GPS di
    cui >=80% entro 25 m dalla polilinea pit; periodi con <10 campioni =
    non verificabili, riportati a parte (a inizio sessione l'auto in garage
    ha (0,0,0), quindi zero campioni: e' il comportamento atteso).

Uso:  .venv/bin/python live/verify_alignment.py
"""

import json
import math
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from decoder import StatoSessione, campioni_posizione, messaggi  # noqa: E402
from test_fase1 import FP2  # noqa: E402

RADICE = Path(__file__).resolve().parent.parent
DERIVATI = RADICE / "data/live_derived"

SOGLIA_TRACCIATO_DM = 150.0   # 15 m
SOGLIA_PIT_DM = 250.0         # 25 m
MIN_CAMPIONI_PERIODO = 10
QUOTA_PUNTI_PERIODO = 0.8
PASSO_RICAMPIONE_DM = 20.0    # 2 m
SOTTOCAMPIONE_SVG = 10


# ------------------------------------------------------------ geometria

def ricampiona(punti, passo=PASSO_RICAMPIONE_DM):
    """Ricampiona una polilinea a passo costante (in dm)."""
    esito = [tuple(punti[0])]
    residuo = 0.0
    for (x0, y0), (x1, y1) in zip(punti, punti[1:]):
        seg = math.hypot(x1 - x0, y1 - y0)
        if seg == 0:
            continue
        d = passo - residuo
        while d <= seg:
            f = d / seg
            esito.append((x0 + f * (x1 - x0), y0 + f * (y1 - y0)))
            d += passo
        residuo = seg - (d - passo)
    return esito


class IndiceGriglia:
    """Indice spaziale a celle per distanza approssimata punto-polilinea.

    La polilinea e' ricampionata a passo fitto: la distanza dal punto
    ricampionato piu' vicino approssima la distanza dalla polilinea con
    errore <= passo/2 (1 m con passo 2 m), trascurabile vs soglie 15/25 m.
    """

    def __init__(self, punti, cella=200.0):
        self.cella = cella
        self.celle = {}
        for x, y in punti:
            self.celle.setdefault(
                (int(x // cella), int(y // cella)), []).append((x, y))

    def distanza(self, x, y, massimo=3000.0):
        cx, cy = int(x // self.cella), int(y // self.cella)
        migliore = None
        raggio_max = int(massimo // self.cella) + 1
        for raggio in range(raggio_max + 1):
            for gx in range(cx - raggio, cx + raggio + 1):
                for gy in range(cy - raggio, cy + raggio + 1):
                    if max(abs(gx - cx), abs(gy - cy)) != raggio:
                        continue
                    for px, py in self.celle.get((gx, gy), ()):
                        d = math.hypot(px - x, py - y)
                        if migliore is None or d < migliore:
                            migliore = d
            # anello successivo inutile se gia' trovato entro raggio corrente
            if migliore is not None and migliore <= (raggio * self.cella):
                break
        return migliore if migliore is not None else massimo


def applica(trasf, x, y):
    """Applica {rotazione_deg, scala, traslazione:[tx,ty]} a un punto."""
    a = math.radians(trasf["rotazione_deg"])
    s = trasf["scala"]
    xr = s * (x * math.cos(a) - y * math.sin(a)) + trasf["traslazione"][0]
    yr = s * (x * math.sin(a) + y * math.cos(a)) + trasf["traslazione"][1]
    return xr, yr


IDENTITA = {"rotazione_deg": 0.0, "scala": 1.0, "traslazione": [0.0, 0.0]}


def stima_trasformazione(campione, indice, centro_ref):
    """Stima una similitudine (rotazione/scala/traslazione unica) grezza:
    ricerca a griglia della rotazione con ri-centraggio dei baricentri.
    Usata SOLO se l'identita' fallisce il KPI; parametri riportati sempre."""
    cx = statistics.fmean(x for x, y in campione)
    cy = statistics.fmean(y for x, y in campione)
    rx, ry = centro_ref
    migliore = (None, IDENTITA)
    for decimi_grado in range(0, 3600, 5):   # passo 0.5 gradi
        angolo = decimi_grado / 10.0
        a = math.radians(angolo)
        tx = rx - (cx * math.cos(a) - cy * math.sin(a))
        ty = ry - (cx * math.sin(a) + cy * math.cos(a))
        trasf = {"rotazione_deg": angolo, "scala": 1.0,
                 "traslazione": [tx, ty]}
        dists = [indice.distanza(*applica(trasf, x, y))
                 for x, y in campione[::7]]
        mediana = statistics.median(dists)
        if migliore[0] is None or mediana < migliore[0]:
            migliore = (mediana, trasf)
    return migliore[1]


# ------------------------------------------------------------ lettura FP2

def leggi_fp2(path):
    """Un solo passaggio sul file: campioni posizione + intervalli InPit.

    Gli intervalli usano i timestamp di busta dei TimingData (jitter ai bordi
    dell'ordine del secondo: accettato e dichiarato)."""
    stato = StatoSessione()
    campioni = []                  # (t, auto, x, y)
    in_pit_da = {}                 # auto -> ts ingresso pit corrente
    intervalli = {}                # auto -> [(t0, t1|None)]
    ultimo_ts = None
    for topic, payload, ts in messaggi(path):
        if ts is not None:
            ultimo_ts = ts
        if topic == "Position.z":
            for c in campioni_posizione(payload):
                if c.t is not None:
                    campioni.append((c.t, c.auto, float(c.x), float(c.y)))
            continue
        if topic == "TimingData":
            prima = {a: stato.vista_pilota(a)["in_pit"]
                     for a in payload.get("Lines", {})}
            stato.aggiorna(topic, payload, ts)
            for auto in prima:
                dopo = stato.vista_pilota(auto)["in_pit"]
                if dopo and not prima[auto] and auto not in in_pit_da:
                    in_pit_da[auto] = ts or ultimo_ts
                elif prima[auto] and not dopo and auto in in_pit_da:
                    intervalli.setdefault(auto, []).append(
                        (in_pit_da.pop(auto), ts or ultimo_ts))
            continue
        stato.aggiorna(topic, payload, ts)
    for auto, t0 in in_pit_da.items():   # pit aperto a fine file
        intervalli.setdefault(auto, []).append((t0, None))
    return campioni, intervalli


def in_intervallo(t, coppie):
    for t0, t1 in coppie:
        if t0 is not None and t >= t0 and (t1 is None or t <= t1):
            return True
    return False


# ------------------------------------------------------------ pit lane

def polilinea_pit(punti_pit):
    """Polilinea del corridoio pit: proiezione sull'asse principale (PCA
    2x2 a mano), mediana trasversale per bin longitudinale di 5 m.

    I bin popolati vengono raggruppati per contiguita' lungo l'asse: la
    polilinea e' il gruppo con piu' punti (il corridoio vero); gli altri
    gruppi (es. un'auto ferma in pista marcata InPit dal timing) vengono
    RESTITUITI come scarti da riportare, mai inclusi in silenzio.
    Ritorna (polilinea, scarti)."""
    n = len(punti_pit)
    mx = statistics.fmean(p[0] for p in punti_pit)
    my = statistics.fmean(p[1] for p in punti_pit)
    sxx = sum((x - mx) ** 2 for x, y in punti_pit) / n
    syy = sum((y - my) ** 2 for x, y in punti_pit) / n
    sxy = sum((x - mx) * (y - my) for x, y in punti_pit) / n
    # autovettore principale della covarianza 2x2
    theta = 0.5 * math.atan2(2 * sxy, sxx - syy)
    ux, uy = math.cos(theta), math.sin(theta)
    bins = {}
    for x, y in punti_pit:
        lungo = (x - mx) * ux + (y - my) * uy
        trasv = -(x - mx) * uy + (y - my) * ux
        bins.setdefault(int(lungo // 50.0), []).append((lungo, trasv))
    popolati = [k for k in sorted(bins) if len(bins[k]) >= 5]
    gruppi = []
    for k in popolati:
        if gruppi and k - gruppi[-1][-1] <= 2:
            gruppi[-1].append(k)
        else:
            gruppi.append([k])
    if not gruppi:
        return [], []
    gruppi.sort(key=lambda g: sum(len(bins[k]) for k in g), reverse=True)
    corridoio, scartati = gruppi[0], gruppi[1:]
    polilinea = []
    for chiave in sorted(corridoio):
        gruppo = bins[chiave]
        lungo = statistics.median(p[0] for p in gruppo)
        trasv = statistics.median(p[1] for p in gruppo)
        polilinea.append((mx + lungo * ux - trasv * uy,
                          my + lungo * uy + trasv * ux))
    scarti = [{"lungo_asse_m": round((g[-1] - g[0] + 1) * 5.0, 1),
               "punti": sum(len(bins[k]) for k in g)} for g in scartati]
    return polilinea, scarti


# ------------------------------------------------------------ svg

def scrivi_svg(percorso, ref, on_track, pit, pit_poly):
    """SVG a mano: riferimento (linea), nuvola FP2 (punti), pit (punti)."""
    tutti = ref + on_track + pit
    xs = [p[0] for p in tutti]
    ys = [p[1] for p in tutti]
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)
    margine = 200.0
    sc = 0.1  # dm -> unita' svg (metri)

    def tx(x):
        return round((x - x0 + margine) * sc, 1)

    def ty(y):
        return round((y1 - y + margine) * sc, 1)  # y invertita per lo schermo

    larg = round((x1 - x0 + 2 * margine) * sc, 1)
    alt = round((y1 - y0 + 2 * margine) * sc, 1)
    righe = [
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {larg} {alt}" width="{larg}" height="{alt}">',
        f'<rect width="{larg}" height="{alt}" fill="#101418"/>',
        '<g fill="none" stroke="#4a90d9" stroke-width="2">',
        '<path d="M ' + ' L '.join(
            f"{tx(x)} {ty(y)}" for x, y in ref) + ' Z"/>',
        "</g>",
        '<g fill="#e8a33d">',
    ]
    for x, y in on_track:
        righe.append(f'<circle cx="{tx(x)}" cy="{ty(y)}" r="1.2"/>')
    righe.append('</g>')
    righe.append('<g fill="#4fbf6b">')
    for x, y in pit:
        righe.append(f'<circle cx="{tx(x)}" cy="{ty(y)}" r="1.2"/>')
    righe.append('</g>')
    if pit_poly:
        righe.append('<g fill="none" stroke="#4fbf6b" stroke-width="1.5" '
                     'stroke-dasharray="6 4"><path d="M ' + ' L '.join(
                         f"{tx(x)} {ty(y)}" for x, y in pit_poly) + '"/></g>')
    righe.append(
        '<g font-family="monospace" font-size="20" fill="#ddd">'
        f'<text x="20" y="30">Spa FP2 2026 — blu: riferimento 2025 | '
        f'arancio: FP2 on-track (1/{SOTTOCAMPIONE_SVG}) | '
        'verde: punti InPit + corridoio</text></g>')
    righe.append("</svg>")
    Path(percorso).write_text("\n".join(righe), encoding="utf-8")


# ------------------------------------------------------------ main

def main() -> int:
    ref_path = DERIVATI / "spa_ref_track.json"
    if not ref_path.is_file():
        print("manca spa_ref_track.json: lanciare prima "
              "python3 live/estrai_riferimenti.py", file=sys.stderr)
        return 1
    ref = json.loads(ref_path.read_text())
    ref_punti = [tuple(p) for p in ref["punti"]]
    ref_fitto = ricampiona(ref_punti)
    indice = IndiceGriglia(ref_fitto)
    centro_ref = (statistics.fmean(p[0] for p in ref_fitto),
                  statistics.fmean(p[1] for p in ref_fitto))

    campioni, intervalli = leggi_fp2(FP2)
    on_track, pit = [], []
    for t, auto, x, y in campioni:
        (pit if in_intervallo(t, intervalli.get(auto, ())) else
         on_track).append((x, y))

    # ---- KPI 4: identita' prima, trasformazione stimata solo se fallisce
    def frazione_entro(punti, trasf):
        entro = 0
        for x, y in punti:
            if trasf is not IDENTITA:
                x, y = applica(trasf, x, y)
            if indice.distanza(x, y) <= SOGLIA_TRACCIATO_DM:
                entro += 1
        return entro / len(punti) if punti else 0.0

    trasf = IDENTITA
    frazione = frazione_entro(on_track, trasf)
    stimata = False
    if frazione < 0.95:
        trasf = stima_trasformazione(on_track[::50], indice, centro_ref)
        stimata = True
        frazione = frazione_entro(on_track, trasf)

    (DERIVATI / "transform_spa.json").write_text(json.dumps({
        "_nota": "trasformazione fissa circuito Spa: coordinate live 2026 -> "
                 "riferimento sito (giro 2025). Stimata solo se l'identita' "
                 "fallisce il KPI 4.",
        "stimata": stimata, **trasf}, indent=1), encoding="utf-8")

    # ---- pit lane e KPI 5
    pit_trasf = [applica(trasf, x, y) for x, y in pit] \
        if stimata else list(pit)
    corridoio, cluster_scartati = (polilinea_pit(pit_trasf)
                                   if len(pit_trasf) >= 50 else ([], []))
    if corridoio:
        (DERIVATI / "pitlane_spa.json").write_text(json.dumps({
            "_nota": "polilinea pit lane Spa da punti InPit FP2 2026 "
                     "(coordinate riferimento sito, decimi di metro); "
                     "mediana trasversale per bin di 5 m sull'asse "
                     "principale del corridoio; cluster InPit fuori dal "
                     "corridoio contiguo principale scartati e riportati",
            "circuito": "Spa-Francorchamps",
            "punti": [[round(x, 1), round(y, 1)] for x, y in corridoio],
            "cluster_scartati": cluster_scartati,
        }, indent=1), encoding="utf-8")
    indice_pit = IndiceGriglia(ricampiona(corridoio)) if corridoio else None

    per_car_ts = {}
    for t, auto, x, y in campioni:
        per_car_ts.setdefault(auto, []).append((t, x, y))
    periodi = {"totali": 0, "senza_dati_gps": 0, "coerenti": 0,
               "divergenti": []}
    for auto, coppie in intervalli.items():
        serie = per_car_ts.get(auto, [])
        for t0, t1 in coppie:
            periodi["totali"] += 1
            punti = [(x, y) for t, x, y in serie
                     if in_intervallo(t, [(t0, t1)])]
            if len(punti) < MIN_CAMPIONI_PERIODO:
                periodi["senza_dati_gps"] += 1
                continue
            if indice_pit is None:
                continue
            dentro = sum(
                1 for x, y in punti
                if indice_pit.distanza(*(applica(trasf, x, y) if stimata
                                         else (x, y))) <= SOGLIA_PIT_DM)
            if dentro / len(punti) >= QUOTA_PUNTI_PERIODO:
                periodi["coerenti"] += 1
            else:
                periodi["divergenti"].append({
                    "auto": auto, "da": str(t0), "a": str(t1),
                    "campioni": len(punti),
                    "quota_in_corridoio": round(dentro / len(punti), 3)})

    verificabili = periodi["totali"] - periodi["senza_dati_gps"]
    coerenza = periodi["coerenti"] / verificabili if verificabili else None

    # ---- svg
    on_track_svg = [applica(trasf, x, y) for x, y in
                    on_track[::SOTTOCAMPIONE_SVG]] \
        if stimata else on_track[::SOTTOCAMPIONE_SVG]
    pit_svg = pit_trasf[::SOTTOCAMPIONE_SVG]
    scrivi_svg(DERIVATI / "spa_2026_fp2_xy.svg",
               list(ref_punti), on_track_svg, pit_svg, corridoio)

    riepilogo = {
        "campioni_totali_validi": len(campioni),
        "punti_on_track": len(on_track),
        "punti_pit": len(pit),
        "kpi4": {"trasformazione": {**trasf, "stimata": stimata},
                 "frazione_entro_15m": round(frazione, 4),
                 "gate": frazione >= 0.95},
        "kpi5": {"cluster_inpit_scartati_dal_corridoio": cluster_scartati,
                 "periodi_pit_totali": periodi["totali"],
                 "periodi_senza_dati_gps": periodi["senza_dati_gps"],
                 "periodi_verificabili": verificabili,
                 "periodi_coerenti": periodi["coerenti"],
                 "coerenza": round(coerenza, 4) if coerenza is not None
                 else None,
                 "gate": coerenza is not None and coerenza >= 0.90,
                 "divergenti": periodi["divergenti"]},
    }
    (DERIVATI / "verifica_allineamento.json").write_text(
        json.dumps(riepilogo, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({c: v for c, v in riepilogo.items()},
                     ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
