#!/usr/bin/env python
"""FASE 1B — verifica del motore replay su una GARA registrata (solo stdlib).

KPI pre-registrati in FASE1B_PREREG.md (commit prima dei numeri):
  1. replay gara senza eccezioni, 4 tipi di evento, 22/22 auto
  2. classifica finale = arbitro (ritirati inclusi); giri del vincitore e
     LapCount coerenti; griglia pre-partenza
  3. pit stop vs arbitro (conteggio esatto >=95% piloti, giro +-1)
  4. GPS dei periodi InPit dentro il corridoio pit del circuito (>=90%)
  5. timeline TrackStatus coerente con la cronaca delle neutralizzazioni

STORIA DI QUESTO FILE, perche' spieghi perche' oggi ha un parametro.
Nato il 19/07/2026 per la gara di Spa, con la registrazione, l'arbitro e il
circuito CABLATI in tre costanti. Il 20/07 il commit di ripulitura «via 136
file di archi chiusi» lo ha CANCELLATO, lasciando in repo il suo prodotto
(`data/live_derived/kpi_fase1b.json`) e la riga del prereg che lo dichiara
tracciato: un artefatto senza generatore, cioe' esattamente la categoria di
debito che il progetto ha gia' censito una volta (TODO voce 9). Ripristinato
qui dal commit 1236ff7, byte per byte nella sostanza, con UNA differenza: la
gara non e' piu' cablata. Non e' un abbellimento — e' la condizione per poter
rifare la prova su una gara che il modulo non ha mai visto, che e' l'unico modo
onesto di dire «live/ e' pronto» dopo un mese di fermo.

  --gara spa        la gara di Fase 1B: riproduce i numeri del 19/07
  --gara ungheria   fuori campione: circuito diverso, registrazione in DUE
                    parti, arbitro generato dagli artefatti del repo

L'ARBITRO. Per Spa e' il congelamento a mano della sera stessa
(`gara_spa_2026_pubblicata.json`): f1db era fermo a un rilascio pre-Spa e la
tabella pit per-pilota non era pubblicata, per questo il KPI 3 la' e' RINVIATO
e non fallito. Per l'Ungheria l'arbitro lo genera
`live/arbitro_da_registro.py` da arrivi_2026.csv + race_control_2026.csv +
schede_2026.json: nessuna di quelle fonti passa dalla registrazione live, e
questa volta le soste per-pilota CI SONO — il KPI 3 diventa misurabile.

Uso:
    .venv/bin/python live/verifica_gara.py --gara spa
    .venv/bin/python live/verifica_gara.py --gara ungheria
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from decoder import (  # noqa: E402
    StatisticheDecoder,
    StatoSessione,
    campioni_posizione,
    messaggi,
)
from replay import eventi_replay, ordina_parti  # noqa: E402
from test_fase1 import _dato_grezzo  # noqa: E402
from verify_alignment import (  # noqa: E402
    IndiceGriglia,
    SOGLIA_PIT_DM,
    MIN_CAMPIONI_PERIODO,
    QUOTA_PUNTI_PERIODO,
    in_intervallo,
    ricampiona,
)

RADICE = Path(__file__).resolve().parent.parent
DERIVATI = RADICE / "data/live_derived"

RAGGIO_GRIGLIA_DM = 5000.0   # 500 m dal punto S/F per il check griglia
QUOTA_CONTEGGIO_SOSTE = 0.95  # KPI 3: conteggio esatto per >=95% dei piloti
TOLLERANZA_GIRO = 1           # KPI 3: giro d'ingresso entro +-1

# LE GARE DICHIARATE. Ogni voce dice da dove viene ogni ingrediente: e' la
# targhetta della prova, non una comodita' di configurazione.
GARE = {
    "spa": {
        "titolo": "Spa GARA 2026",
        "registrazioni": ["2026-07-19_14-53-28.txt"],
        "arbitro": "gara_spa_2026_pubblicata.json",
        "pitlane": "pitlane_spa.json",
        "riferimento": "spa_ref_track.json",
        "svg": "spa_2026_race_xy.svg",
        "out": "kpi_fase1b.json",
        "nota_arbitro": "congelato a mano il 19/07 da formula1.com + cronaca "
                        "motorsport.com; pit per-pilota NON pubblicati quella "
                        "sera -> KPI 3 con soli spot-check, verdetto RINVIATO",
    },
    "ungheria": {
        "titolo": "Ungheria GARA 2026",
        # DUE parti: il collettore e' stato rilanciato a gara in corso. Il
        # replay le ordina e deduplica l'overlap: qui la prova esercita anche
        # quel percorso, che a Spa (file unico) non era mai stato toccato su
        # dati veri.
        "registrazioni": ["GARA_2026-07-26_12-41-16.txt",
                          "GARA_2026-07-26_13-34-59.txt"],
        "arbitro": "gara_ungheria_arbitro.json",
        "pitlane": "pitlane_ungheria.json",
        "riferimento": "ungheria_ref_track.json",
        "svg": "ungheria_2026_race_xy.svg",
        "out": "kpi_fase1b_ungheria.json",
        "nota_arbitro": "generato da live/arbitro_da_registro.py sugli "
                        "artefatti del repo; soste per-pilota PRESENTI -> "
                        "KPI 3 misurabile per la prima volta",
    },
}


# ------------------------------------------------------ passata A: KPI 1

def passata_replay(percorsi):
    """Replay end-to-end con il motore vero (eventi_replay): KPI 1."""
    stats = StatisticheDecoder()
    conteggi = {}
    auto_frames = set()
    eccezione = None
    try:
        for e in eventi_replay(percorsi, stats=stats):
            conteggi[e["type"]] = conteggi.get(e["type"], 0) + 1
            if e["type"] == "position_frame":
                auto_frames.update(e["cars"])
    except Exception as errore:  # mai atteso: il decoder non deve crashare
        eccezione = repr(errore)
    return {
        "eccezione": eccezione,
        "eventi": conteggi,
        "auto_nei_position_frame": len(auto_frames),
        "righe_totali": stats.righe_totali,
        "righe_ok": stats.righe_ok,
        "frazione_ok": round(stats.frazione_ok, 6),
    }


# ------------------------------------------------- passata B: misure fini

def passata_misure(percorsi):
    """Un passaggio su messaggi(): stato finale, pit, LapCount, TrackStatus,
    SessionStatus, campioni posizione.

    Con piu' parti i file si leggono nell'ordine cronologico di
    `ordina_parti` (lo stesso del replay) e i campioni posizione si
    deduplicano su (auto, t): nell'overlap della riconnessione lo stesso
    istante arriva due volte, e contarlo due volte gonfierebbe le quote del
    KPI 4 senza aggiungere informazione."""
    stato = StatoSessione()
    campioni = {}            # auto -> [(t, x, y)]
    visti = set()            # (auto, t) gia' accodati
    lapcount = []            # [(t, CurrentLap)]
    track_status = []        # [(t, Message)]
    session_status = []      # [(t, Status)]
    in_pit_da = {}           # auto -> (t, giri_completati_all_ingresso)
    intervalli = {}          # auto -> [{da, a, giri_ingresso}]
    ultimo_ts = None
    doppioni = 0

    for percorso in ordina_parti(percorsi):
        for topic, payload, ts in messaggi(percorso):
            if ts is not None:
                ultimo_ts = ts
            if topic == "Position.z":
                for c in campioni_posizione(payload):
                    if c.t is None:
                        continue
                    chiave = (c.auto, c.t)
                    if chiave in visti:
                        doppioni += 1
                        continue
                    visti.add(chiave)
                    campioni.setdefault(c.auto, []).append(
                        (c.t, float(c.x), float(c.y)))
                continue
            if topic == "LapCount":
                corrente = payload.get("CurrentLap")
                if corrente is not None:
                    lapcount.append((ts or ultimo_ts, int(corrente)))
                continue
            if topic == "TrackStatus":
                prima = stato.track_status
                stato.aggiorna(topic, payload, ts)
                if stato.track_status != prima:
                    track_status.append((ts or ultimo_ts, stato.track_status))
                continue
            if topic == "SessionStatus":
                prima = stato.session_status
                stato.aggiorna(topic, payload, ts)
                if stato.session_status != prima:
                    session_status.append(
                        (ts or ultimo_ts, stato.session_status))
                continue
            if topic == "TimingData":
                prima = {a: stato.vista_pilota(a)["in_pit"]
                         for a in payload.get("Lines", {})}
                stato.aggiorna(topic, payload, ts)
                for auto in prima:
                    dopo = stato.vista_pilota(auto)["in_pit"]
                    if dopo and not prima[auto] and auto not in in_pit_da:
                        in_pit_da[auto] = (ts or ultimo_ts,
                                           stato.numero_giri(auto))
                    elif prima[auto] and not dopo and auto in in_pit_da:
                        t0, giri = in_pit_da.pop(auto)
                        intervalli.setdefault(auto, []).append(
                            {"da": t0, "a": ts or ultimo_ts,
                             "giri_ingresso": giri})
                continue
            stato.aggiorna(topic, payload, ts)

    for auto, (t0, giri) in in_pit_da.items():   # aperti a fine file
        intervalli.setdefault(auto, []).append(
            {"da": t0, "a": None, "giri_ingresso": giri})
    for serie in campioni.values():
        serie.sort(key=lambda c: c[0])
    return (stato, campioni, lapcount, track_status, session_status,
            intervalli, doppioni)


def lap_al_tempo(lapcount, t, t_start=None):
    """CurrentLap del leader al tempo t.

    Le voci senza timestamp (snapshot iniziale) vengono saltate. Dopo il via
    e prima del primo LapCount live il giro corrente e' quello dello
    snapshot (il via avviene nel giro 1): senza questo fallback un evento
    del giro 1 (es. SC alla partenza) resterebbe senza giro."""
    if t is None:
        return None
    corrente = None
    snapshot = None
    for t_lc, giro in lapcount:
        if t_lc is None:
            snapshot = giro
            continue
        if t_lc <= t:
            corrente = giro
        else:
            break
    if corrente is None and t_start is not None and t >= t_start:
        corrente = snapshot if snapshot is not None else 1
    return corrente


def finestra_gara(session_status):
    """(t_started, t_finished) dalla timeline SessionStatus."""
    t_start = t_fine = None
    for t, s in session_status:
        if s == "Started" and t_start is None:
            t_start = t
        if s in ("Finished", "Finalised") and t_fine is None and t_start:
            t_fine = t
    return t_start, t_fine


# ------------------------------------------------------------------ svg

def scrivi_svg_gara(percorso, titolo, ref, on_track, pit, griglia):
    tutti = ref + on_track + pit + griglia
    xs = [p[0] for p in tutti]
    ys = [p[1] for p in tutti]
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)
    margine, sc = 200.0, 0.1

    def tx(x):
        return round((x - x0 + margine) * sc, 1)

    def ty(y):
        return round((y1 - y + margine) * sc, 1)

    larg = round((x1 - x0 + 2 * margine) * sc, 1)
    alt = round((y1 - y0 + 2 * margine) * sc, 1)
    righe = [
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {larg} {alt}" width="{larg}" height="{alt}">',
        f'<rect width="{larg}" height="{alt}" fill="#101418"/>',
        '<g fill="none" stroke="#4a90d9" stroke-width="2">',
        '<path d="M ' + ' L '.join(
            f"{tx(x)} {ty(y)}" for x, y in ref) + ' Z"/>',
        "</g>", '<g fill="#e8a33d">']
    righe += [f'<circle cx="{tx(x)}" cy="{ty(y)}" r="1.2"/>'
              for x, y in on_track]
    righe.append('</g><g fill="#4fbf6b">')
    righe += [f'<circle cx="{tx(x)}" cy="{ty(y)}" r="1.2"/>' for x, y in pit]
    righe.append('</g><g fill="#e05555">')
    righe += [f'<circle cx="{tx(x)}" cy="{ty(y)}" r="4"/>' for x, y in griglia]
    righe.append('</g>')
    righe.append(
        '<g font-family="monospace" font-size="20" fill="#ddd">'
        f'<text x="20" y="30">{titolo} — blu: riferimento 2025 | '
        'arancio: on-track (1/25) | verde: punti InPit | '
        'rosso: griglia pre-partenza</text></g>')
    righe.append("</svg>")
    Path(percorso).write_text("\n".join(righe), encoding="utf-8")


# ------------------------------------------------------------- KPI 3

def misura_soste(intervalli, t_start, t_fine, arbitro):
    """KPI 3 — soste dal replay contro l'arbitro.

    Convenzione osservata (documentata, non aggiustata): giro dello stop =
    NumberOfLaps all'ingresso + 1 (il pilota pitta nel giro che sta
    percorrendo). Stop = intervallo InPit con ingresso in [Started, Finished]
    e USCITA entro fine gara (ingresso senza uscita = ritiro o parco chiuso,
    non uno stop).

    Il gate esiste solo se l'arbitro porta le soste per-pilota
    (`soste_per_auto`). Con il solo `pit_spot_check` di Spa il verdetto resta
    RINVIATO come nel prereg: mancava l'arbitro, non il dato."""
    stop_per_auto = {}
    for auto, coppie in intervalli.items():
        stops = []
        for iv in coppie:
            if (t_start and iv["da"] and iv["da"] > t_start
                    and iv["a"] is not None
                    and (t_fine is None or iv["da"] < t_fine)):
                giro = (iv["giri_ingresso"] + 1
                        if isinstance(iv["giri_ingresso"], int) else None)
                stops.append({"giro": giro, "da": str(iv["da"]),
                              "a": str(iv["a"])})
        stop_per_auto[auto] = sorted(
            stops, key=lambda s: (s["giro"] is None, s["giro"]))

    esito = {
        "convenzione": "giro stop = NumberOfLaps a ingresso pit + 1; "
                       "ingresso senza uscita = non conteggiato",
        "stop_per_auto": {a: stop_per_auto[a]
                          for a in sorted(stop_per_auto, key=int)},
    }

    # --- ramo Spa: solo spot-check di cronaca, nessun gate
    if "soste_per_auto" not in arbitro:
        spot = []
        for atteso in arbitro.get("pit_spot_check", []):
            stops = stop_per_auto.get(atteso["auto"], [])
            giri = [s["giro"] for s in stops if s["giro"] is not None]
            vicino = (min(giri, key=lambda g: abs(g - atteso["giro"]))
                      if giri else None)
            spot.append({**atteso, "giri_replay": giri,
                         "match_entro_1": (vicino is not None and
                                           abs(vicino - atteso["giro"]) <= 1)})
        esito.update({
            "spot_check_cronaca": spot,
            "gate": None,
            "nota": "arbitro per-pilota NON pubblicato la sera stessa "
                    "(pit-stop-summary formula1.com vuoto): verdetto "
                    "RINVIATO al rilascio f1db; spot-check di cronaca sopra",
        })
        return esito

    # --- ramo con arbitro completo: conteggio + giro, per-pilota
    #
    # I RITIRATI NON ENTRANO NEL DENOMINATORE, e va detto perche': l'arbitro
    # elenca le soste di TUTTA la gara del pilota, il replay solo quelle
    # dentro la finestra registrata; per chi si ritira la finestra e' troncata
    # dall'evento, non dalla registrazione. Confrontarli sarebbe misurare il
    # ritiro, non il replay. Restano riportati a parte, mai nascosti.
    confronto, esclusi = [], []
    for auto, atteso in arbitro["soste_per_auto"].items():
        riga_classifica = next((v for v in arbitro["classifica"]
                                if v["auto"] == auto), {})
        giri_replay = [s["giro"] for s in stop_per_auto.get(auto, [])
                       if s["giro"] is not None]
        giri_arbitro = atteso["giri"]
        voce = {
            "auto": auto, "sigla": atteso["sigla"],
            "giri_arbitro": giri_arbitro, "giri_replay": giri_replay,
            "conteggio_esatto": len(giri_replay) == len(giri_arbitro),
            "stato": riga_classifica.get("stato"),
        }
        if len(giri_replay) == len(giri_arbitro):
            voce["scarti_giro"] = [r - a for r, a in
                                   zip(giri_replay, giri_arbitro)]
            voce["giri_entro_tolleranza"] = all(
                abs(d) <= TOLLERANZA_GIRO for d in voce["scarti_giro"])
        else:
            voce["scarti_giro"] = None
            voce["giri_entro_tolleranza"] = False
        (esclusi if riga_classifica.get("stato") == "ritirato"
         else confronto).append(voce)

    n = len(confronto)
    esatti = sum(1 for v in confronto if v["conteggio_esatto"])
    entro = sum(1 for v in confronto if v["giri_entro_tolleranza"])
    quota_conteggio = esatti / n if n else None
    esito.update({
        "confronto_per_auto": sorted(confronto, key=lambda v: int(v["auto"])),
        "ritirati_esclusi_dal_gate": sorted(esclusi,
                                            key=lambda v: int(v["auto"])),
        "piloti_nel_gate": n,
        "conteggio_esatto": esatti,
        "quota_conteggio_esatto": (round(quota_conteggio, 4)
                                   if quota_conteggio is not None else None),
        "giri_entro_tolleranza": entro,
        "disaccordi_dell_arbitro": arbitro.get("disaccordi_n_soste", []),
        "gate": (quota_conteggio is not None
                 and quota_conteggio >= QUOTA_CONTEGGIO_SOSTE
                 and entro == n),
    })
    return esito


# ------------------------------------------------------------------ main

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--gara", default="spa", choices=sorted(GARE),
                    help="gara dichiarata in GARE (default: spa)")
    args = ap.parse_args()
    cfg = GARE[args.gara]

    percorsi = [_dato_grezzo(n) for n in cfg["registrazioni"]]
    mancanti = [p for p in percorsi if not Path(p).exists()]
    if mancanti:
        print("registrazioni assenti da questo disco (data/live_raw/ e' "
              "gitignorata: vivono sul Mac che le ha catturate):")
        for p in mancanti:
            print("   ", p)
        return 2

    arbitro = json.loads((DERIVATI / cfg["arbitro"]).read_text(
        encoding="utf-8"))
    pitlane = json.loads((DERIVATI / cfg["pitlane"]).read_text(
        encoding="utf-8"))
    ref = json.loads((DERIVATI / cfg["riferimento"]).read_text(
        encoding="utf-8"))
    ref_punti = [tuple(p) for p in ref["punti"]]
    esito = {"gara": args.gara,
             "registrazioni": cfg["registrazioni"],
             "arbitro": {"file": cfg["arbitro"], "nota": cfg["nota_arbitro"]}}

    # ---------------- KPI 1: replay end-to-end
    k1 = passata_replay(percorsi)
    tipi_ok = all(k1["eventi"].get(t, 0) > 0 for t in
                  ("position_frame", "timing_update", "track_status",
                   "session_status"))
    k1["gate"] = (k1["eccezione"] is None and tipi_ok
                  and k1["auto_nei_position_frame"] >= 22)
    esito["kpi1"] = k1

    # ---------------- passata misure
    (stato, campioni, lapcount, track_status, session_status,
     intervalli, doppioni) = passata_misure(percorsi)
    t_start, t_fine = finestra_gara(session_status)
    esito["campioni_duplicati_scartati"] = doppioni

    # ---------------- KPI 2: classifica finale + giri + griglia
    ordine_arbitro = [v["auto"] for v in arbitro["classifica"]]
    finali = []
    for auto in ordine_arbitro:
        v = stato.vista_pilota(auto)
        finali.append((auto, v["pos"]))
    ordine_replay = [a for a, p in sorted(
        finali, key=lambda c: (c[1] is None, c[1]))]
    ordine_coincide = ordine_replay == ordine_arbitro

    giri_vincitore = stato.numero_giri(ordine_arbitro[0])
    lap_finale = lapcount[-1][1] if lapcount else None

    # griglia: ultimo frame (qui: campioni per t) prima di Started
    per_tempo = {}
    for auto, serie in campioni.items():
        for t, x, y in serie:
            if t_start is not None and t <= t_start:
                per_tempo.setdefault(t, []).append((auto, x, y))
    t_griglia = None
    for t in sorted(per_tempo, reverse=True):
        if len(per_tempo[t]) >= 20:
            t_griglia = t
            break
    punto_sf = ref_punti[0]
    griglia_xy = [(x, y) for _a, x, y in per_tempo.get(t_griglia, [])]
    vicine = sum(1 for x, y in griglia_xy
                 if ((x - punto_sf[0]) ** 2 + (y - punto_sf[1]) ** 2) ** 0.5
                 <= RAGGIO_GRIGLIA_DM)
    griglia_ok = t_griglia is not None and vicine >= 20

    esito["kpi2"] = {
        "ordine_replay": ordine_replay,
        "ordine_arbitro": ordine_arbitro,
        "posizioni_finali_replay": {a: p for a, p in finali},
        "ordine_coincide": ordine_coincide,
        "giri_vincitore": giri_vincitore,
        "lapcount_finale": lap_finale,
        "griglia": {"t": str(t_griglia), "auto_nel_frame": len(griglia_xy),
                    "entro_500m_da_sf": vicine, "ok": griglia_ok},
        "gate": (ordine_coincide and giri_vincitore == arbitro["giri_totali"]
                 and lap_finale == arbitro["giri_totali"] and griglia_ok),
    }

    # ---------------- KPI 3: pit stop
    esito["kpi3"] = misura_soste(intervalli, t_start, t_fine, arbitro)

    # ---------------- KPI 4: GPS dei periodi InPit nel corridoio pit
    corridoio = [tuple(p) for p in pitlane["punti"]]
    indice_pit = IndiceGriglia(ricampiona(corridoio))
    periodi = {"totali": 0, "senza_dati_gps": 0, "coerenti": 0,
               "divergenti": []}
    for auto, coppie in intervalli.items():
        serie = campioni.get(auto, [])
        for iv in coppie:
            if not (t_start and iv["da"] and iv["da"] > t_start):
                continue   # solo periodi di gara (griglia/pre-gara esclusi)
            periodi["totali"] += 1
            punti = [(x, y) for t, x, y in serie
                     if in_intervallo(t, [(iv["da"], iv["a"])])]
            if len(punti) < MIN_CAMPIONI_PERIODO:
                periodi["senza_dati_gps"] += 1
                continue
            dentro = sum(1 for x, y in punti
                         if indice_pit.distanza(x, y) <= SOGLIA_PIT_DM)
            if dentro / len(punti) >= QUOTA_PUNTI_PERIODO:
                periodi["coerenti"] += 1
            else:
                periodi["divergenti"].append({
                    "auto": auto, "da": str(iv["da"]), "a": str(iv["a"]),
                    "campioni": len(punti),
                    "quota_in_corridoio": round(dentro / len(punti), 3)})
    verificabili = periodi["totali"] - periodi["senza_dati_gps"]
    coerenza = periodi["coerenti"] / verificabili if verificabili else None
    esito["kpi4"] = {**periodi, "periodi_verificabili": verificabili,
                     "coerenza": round(coerenza, 4)
                     if coerenza is not None else None,
                     "gate": coerenza is not None and coerenza >= 0.90}

    # ---------------- KPI 5: timeline TrackStatus vs cronaca
    timeline = [{"t": str(t), "status": s,
                 "giro": lap_al_tempo(lapcount, t, t_start)}
                for t, s in track_status]
    # periodi di neutralizzazione: da *Deployed/Red fino al ritorno AllClear
    periodi_neutro = []
    aperto = None
    for t, s in track_status:
        giro = lap_al_tempo(lapcount, t, t_start)
        if s in ("SCDeployed", "VSCDeployed", "Red") and aperto is None:
            aperto = {"tipo": {"SCDeployed": "SC", "VSCDeployed": "VSC",
                               "Red": "Red"}[s],
                      "da": t, "giro_da": giro}
        elif aperto is not None and s in ("SCDeployed", "VSCDeployed", "Red"):
            aperto["tipo"] += "->" + {"SCDeployed": "SC",
                                      "VSCDeployed": "VSC", "Red": "Red"}[s]
        elif s == "AllClear" and aperto is not None:
            aperto.update({"a": t, "giro_a": giro})
            periodi_neutro.append(aperto)
            aperto = None
    if aperto is not None:
        aperto.update({"a": None, "giro_a": None})
        periodi_neutro.append(aperto)

    # periodi pre-gara (prima del primo LapCount: giro non attribuibile)
    # esclusi dal confronto con la cronaca ma riportati
    in_gara = [p for p in periodi_neutro if p["giro_da"] is not None]
    pre_gara = [p for p in periodi_neutro if p["giro_da"] is None]
    confronto_cronaca = []
    for c in arbitro["neutralizzazioni_cronaca"]:
        coperto = any(
            c["tipo"] in p["tipo"]
            and p["giro_da"] <= c["giro_inizio"]
            and (p["giro_a"] is None or p["giro_a"] >= c["giro_inizio"])
            for p in in_gara)
        confronto_cronaca.append({**c, "coperto_dal_replay": coperto})
    non_in_cronaca = [
        p for p in in_gara
        if not any(c["tipo"] in p["tipo"]
                   and p["giro_da"] <= c["giro_inizio"]
                   and (p["giro_a"] is None
                        or p["giro_a"] >= c["giro_inizio"])
                   for c in arbitro["neutralizzazioni_cronaca"])]
    esito["kpi5"] = {
        "granularita": arbitro["granularita"],
        "timeline_replay": timeline,
        "periodi_neutralizzazione": [
            {**p, "da": str(p["da"]), "a": str(p.get("a"))}
            for p in periodi_neutro],
        "cronaca_coperta": confronto_cronaca,
        "periodi_pre_gara": [
            {**p, "da": str(p["da"]), "a": str(p.get("a"))} for p in pre_gara],
        "periodi_replay_non_in_cronaca": [
            {**p, "da": str(p["da"]), "a": str(p.get("a"))}
            for p in non_in_cronaca],
        "gate": (all(c["coperto_dal_replay"] for c in confronto_cronaca)
                 and not non_in_cronaca),
    }

    # ---------------- svg
    on_track, pit_xy = [], []
    for auto, serie in campioni.items():
        coppie = intervalli.get(auto, [])
        finestre = [(iv["da"], iv["a"]) for iv in coppie]
        for t, x, y in serie:
            (pit_xy if in_intervallo(t, finestre) else on_track).append((x, y))
    scrivi_svg_gara(DERIVATI / cfg["svg"], cfg["titolo"], list(ref_punti),
                    on_track[::25], pit_xy[::10], griglia_xy)

    (DERIVATI / cfg["out"]).write_text(
        json.dumps(esito, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"=== {cfg['titolo']} — arbitro: {cfg['arbitro']}")
    for kpi in ("kpi1", "kpi2", "kpi3", "kpi4", "kpi5"):
        v = esito[kpi]
        gate = v.get("gate")
        verdetto = ("GO" if gate else "NO-GO") if gate is not None \
            else "RINVIATO (arbitro assente)"
        print(f"{kpi}: {verdetto}")
    print(f"\nsessione: start={t_start} fine={t_fine} "
          f"lap finale={lapcount[-1] if lapcount else None}")
    print(f"righe: {esito['kpi1']['righe_ok']}/{esito['kpi1']['righe_totali']}"
          f" · campioni duplicati scartati: {doppioni}")
    print(f"esito -> data/live_derived/{cfg['out']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
