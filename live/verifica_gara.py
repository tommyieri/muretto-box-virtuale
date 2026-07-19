#!/usr/bin/env python
"""FASE 1B — verifica del motore replay sulla gara di Spa 2026 (solo stdlib).

KPI pre-registrati in FASE1B_PREREG.md (commit prima dei numeri):
  1. replay gara senza eccezioni, 4 tipi di evento, 22/22 auto
  2. classifica finale = arbitro pubblicato (ritirati inclusi);
     vincitore 44 giri, LapCount coerente; griglia pre-partenza
  3. pit stop vs arbitro (conteggio esatto >=95% piloti, giro +-1)
  4. GPS dei periodi InPit dentro il corridoio pit di FP2 (>=90%)
  5. timeline TrackStatus coerente con la cronaca pubblica

Arbitro: data/live_derived/gara_spa_2026_pubblicata.json (f1db non
disponibile; la tabella pit per-pilota NON era pubblicata la sera stessa:
per il KPI 3 sono congelati solo spot-check di cronaca — il confronto
completo e' rinviato al rilascio f1db, come dichiarato nel prereg).

Output: data/live_derived/kpi_fase1b.json + spa_2026_race_xy.svg
Uso:  .venv/bin/python live/verifica_gara.py
"""

import json
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from decoder import (  # noqa: E402
    StatisticheDecoder,
    StatoSessione,
    campioni_posizione,
    messaggi,
)
from replay import eventi_replay  # noqa: E402
from test_fase1 import _dato_grezzo  # noqa: E402
from verify_alignment import (  # noqa: E402
    IndiceGriglia,
    SOGLIA_PIT_DM,
    MIN_CAMPIONI_PERIODO,
    QUOTA_PUNTI_PERIODO,
    in_intervallo,
    ricampiona,
)

GARA = _dato_grezzo("2026-07-19_14-53-28.txt")
RADICE = Path(__file__).resolve().parent.parent
DERIVATI = RADICE / "data/live_derived"

RAGGIO_GRIGLIA_DM = 5000.0   # 500 m dal punto S/F per il check griglia
NEUTRALIZZAZIONI = {"SCDeployed", "SCEnding", "VSCDeployed", "VSCEnding",
                    "Red"}


# ------------------------------------------------------ passata A: KPI 1

def passata_replay():
    """Replay end-to-end con il motore vero (eventi_replay): KPI 1."""
    stats = StatisticheDecoder()
    conteggi = {}
    auto_frames = set()
    eccezione = None
    try:
        for e in eventi_replay([GARA], stats=stats):
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

def passata_misure():
    """Un passaggio su messaggi(): stato finale, pit, LapCount, TrackStatus,
    SessionStatus, campioni posizione."""
    stato = StatoSessione()
    campioni = {}            # auto -> [(t, x, y)]
    lapcount = []            # [(t, CurrentLap)]
    track_status = []        # [(t, Message)]
    session_status = []      # [(t, Status)]
    in_pit_da = {}           # auto -> (t, giri_completati_all_ingresso)
    intervalli = {}          # auto -> [{da, a, giri_ingresso}]
    ultimo_ts = None

    for topic, payload, ts in messaggi(GARA):
        if ts is not None:
            ultimo_ts = ts
        if topic == "Position.z":
            for c in campioni_posizione(payload):
                if c.t is not None:
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
                session_status.append((ts or ultimo_ts, stato.session_status))
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
    return stato, campioni, lapcount, track_status, session_status, intervalli


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

def scrivi_svg_gara(percorso, ref, on_track, pit, griglia):
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
        '<text x="20" y="30">Spa GARA 2026 — blu: riferimento 2025 | '
        'arancio: on-track (1/25) | verde: punti InPit | '
        'rosso: griglia pre-partenza</text></g>')
    righe.append("</svg>")
    Path(percorso).write_text("\n".join(righe), encoding="utf-8")


# ------------------------------------------------------------------ main

def main() -> int:
    arbitro = json.loads(
        (DERIVATI / "gara_spa_2026_pubblicata.json").read_text())
    pitlane = json.loads((DERIVATI / "pitlane_spa.json").read_text())
    ref = json.loads((DERIVATI / "spa_ref_track.json").read_text())
    ref_punti = [tuple(p) for p in ref["punti"]]
    esito = {}

    # ---------------- KPI 1: replay end-to-end
    k1 = passata_replay()
    tipi_ok = all(k1["eventi"].get(t, 0) > 0 for t in
                  ("position_frame", "timing_update", "track_status",
                   "session_status"))
    k1["gate"] = (k1["eccezione"] is None and tipi_ok
                  and k1["auto_nei_position_frame"] >= 22)
    esito["kpi1"] = k1

    # ---------------- passata misure
    (stato, campioni, lapcount, track_status, session_status,
     intervalli) = passata_misure()
    t_start, t_fine = finestra_gara(session_status)

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

    # ---------------- KPI 3: pit stop (conteggio+giro) vs arbitro disponibile
    # Convenzione osservata (documentata, non aggiustata): giro dello stop =
    # NumberOfLaps all'ingresso + 1 (il pilota pitta nel giro che sta
    # percorrendo). Stop = intervallo InPit con ingresso in [Started,
    # Finished] e USCITA entro fine gara (ingresso senza uscita = ritiro o
    # parco chiuso, non uno stop).
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
        stop_per_auto[auto] = stops

    spot = []
    for atteso in arbitro.get("pit_spot_check", []):
        stops = stop_per_auto.get(atteso["auto"], [])
        giri = [s["giro"] for s in stops if s["giro"] is not None]
        vicino = min(giri, key=lambda g: abs(g - atteso["giro"])) \
            if giri else None
        spot.append({**atteso,
                     "giri_replay": giri,
                     "match_entro_1": (vicino is not None
                                       and abs(vicino - atteso["giro"]) <= 1)})
    esito["kpi3"] = {
        "convenzione": "giro stop = NumberOfLaps a ingresso pit + 1; "
                       "ingresso senza uscita = non conteggiato",
        "stop_per_auto": {a: stop_per_auto[a]
                          for a in sorted(stop_per_auto, key=int)},
        "spot_check_cronaca": spot,
        "gate": None,
        "nota": "arbitro per-pilota NON pubblicato la sera stessa "
                "(pit-stop-summary formula1.com vuoto): verdetto RINVIATO "
                "al rilascio f1db; spot-check di cronaca sopra",
    }

    # ---------------- KPI 4: GPS dei periodi InPit nel corridoio FP2
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
            {**p, "da": str(p["da"]), "a": str(p["a"])}
            for p in periodi_neutro],
        "cronaca_coperta": confronto_cronaca,
        "periodi_pre_gara": [
            {**p, "da": str(p["da"]), "a": str(p["a"])} for p in pre_gara],
        "periodi_replay_non_in_cronaca": [
            {**p, "da": str(p["da"]), "a": str(p["a"])}
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
    scrivi_svg_gara(DERIVATI / "spa_2026_race_xy.svg", list(ref_punti),
                    on_track[::25], pit_xy[::10], griglia_xy)

    (DERIVATI / "kpi_fase1b.json").write_text(
        json.dumps(esito, ensure_ascii=False, indent=1), encoding="utf-8")

    for kpi in ("kpi1", "kpi2", "kpi3", "kpi4", "kpi5"):
        v = esito[kpi]
        gate = v.get("gate")
        verdetto = ("GO" if gate else "NO-GO") if gate is not None \
            else "RINVIATO (arbitro assente)"
        print(f"{kpi}: {verdetto}")
    print(f"\nsessione: start={t_start} fine={t_fine} "
          f"lap finale={lapcount[-1] if lapcount else None}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
