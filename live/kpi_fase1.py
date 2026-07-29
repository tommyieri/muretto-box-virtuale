#!/usr/bin/env python
"""Misura dei KPI 1-3 pre-registrati (FASE1_PREREG.md) — solo stdlib.

KPI 1 (decoder): % righe FP2 parsate; crash su FP1 troncata; auto presenti
        nei position_frame di FP2.
KPI 2 (replay): ordine dei best lap dallo stato a fine replay FP2 vs
        classifica ufficiale (data/live_derived/fp2_spa_2026_ufficiale.json);
        best lap al millesimo per >=18/20 auto.
KPI 3 (frequenza posizioni): frequenza effettiva mediana per auto (report).

Stampa il riepilogo e scrive data/live_derived/kpi_fase1.json.
Uso:  .venv/bin/python live/kpi_fase1.py
"""

import json
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from decoder import StatisticheDecoder, StatoSessione  # noqa: E402
from replay import eventi_replay  # noqa: E402
from test_fase1 import FP1_TRONCATA, FP2  # noqa: E402

RADICE = Path(__file__).resolve().parent.parent
DERIVATI = RADICE / "data/live_derived"


def secondi(tempo):
    """'1:43.123' -> 103.123; None/'' -> None."""
    if not tempo:
        return None
    try:
        if ":" in tempo:
            minuti, resto = tempo.split(":", 1)
            return int(minuti) * 60 + float(resto)
        return float(tempo)
    except ValueError:
        return None


def main() -> int:
    esito = {}

    # ---- replay completo FP2 con stato e statistiche condivisi
    stato = StatoSessione()
    stats = StatisticheDecoder()
    tempi_per_auto = {}   # auto -> [ts dei position_frame]
    for e in eventi_replay([FP2], stato=stato, stats=stats):
        if e["type"] == "position_frame":
            for auto in e["cars"]:
                tempi_per_auto.setdefault(auto, []).append(e["t"])

    # ---- KPI 1: decoder
    crash_fp1 = 0
    try:
        for _ in eventi_replay([FP1_TRONCATA]):
            pass
    except Exception as errore:
        crash_fp1 = 1
        esito["kpi1_errore_fp1"] = repr(errore)

    esito["kpi1"] = {
        "righe_fp2_totali": stats.righe_totali,
        "righe_fp2_ok": stats.righe_ok,
        "frazione_ok": round(stats.frazione_ok, 6),
        "crash_fp1": crash_fp1,
        "auto_nei_position_frame": len(tempi_per_auto),
        "gate": (stats.frazione_ok >= 0.99 and crash_fp1 == 0
                 and len(tempi_per_auto) >= 20),
    }

    # ---- KPI 3: frequenza posizioni (solo report, non gate)
    from inspect_recording import parse_timestamp
    freq = {}
    for auto, tempi in tempi_per_auto.items():
        if len(tempi) < 2:
            continue
        t0 = parse_timestamp(tempi[0])
        t1 = parse_timestamp(tempi[-1])
        durata = (t1 - t0).total_seconds()
        if durata > 0:
            freq[auto] = (len(tempi) - 1) / durata
    esito["kpi3"] = {
        "frequenza_mediana_hz": round(statistics.median(freq.values()), 3)
        if freq else None,
        "frequenza_min_hz": round(min(freq.values()), 3) if freq else None,
        "frequenza_max_hz": round(max(freq.values()), 3) if freq else None,
        "gate": None,  # dichiarato non-gate in prereg
    }

    # ---- KPI 2: best lap e ordine vs classifica ufficiale
    percorso_ufficiale = DERIVATI / "fp2_spa_2026_ufficiale.json"
    if not percorso_ufficiale.is_file():
        esito["kpi2"] = {"gate": None,
                         "nota": "classifica ufficiale non disponibile"}
    else:
        ufficiale = json.loads(percorso_ufficiale.read_text())["auto"]
        confronto = {}
        coincidenti = 0
        con_tempo = 0
        for auto, dati in ufficiale.items():
            ricostruito = secondi(stato.best_lap(auto))
            atteso = dati.get("best_lap_s")
            if atteso is None:
                atteso = dati.get("best_lap_giri_s")
            voce = {"sigla": dati.get("sigla"),
                    "pos_ufficiale": dati.get("pos"),
                    "best_ufficiale_s": atteso,
                    "best_replay_s": ricostruito}
            if atteso is not None and ricostruito is not None:
                con_tempo += 1
                voce["delta_ms"] = round((ricostruito - atteso) * 1000, 1)
                if abs(ricostruito - atteso) < 0.0005:
                    coincidenti += 1
            confronto[auto] = voce

        # ordine: auto con best replay, ordinate per tempo, vs ufficiale
        con_best = [(a, v["best_replay_s"]) for a, v in confronto.items()
                    if v["best_replay_s"] is not None]
        ordine_replay = [a for a, _ in sorted(con_best, key=lambda c: c[1])]
        # per le FP FastF1 lascia results.Position vuota: l'ordine ufficiale
        # si usa se presente, altrimenti si deriva dai best ufficiali
        # (stessa fonte-arbitro; per una FP la classifica E' l'ordine dei best)
        if all(v["pos_ufficiale"] is not None for v in confronto.values()):
            ordine_ufficiale = [a for a, v in sorted(
                confronto.items(), key=lambda c: c[1]["pos_ufficiale"])
                if a in ordine_replay]
            fonte_ordine = "results.Position"
        else:
            con_uff = [(a, v["best_ufficiale_s"])
                       for a, v in confronto.items()
                       if v["best_ufficiale_s"] is not None]
            ordine_ufficiale = [a for a, _ in
                                sorted(con_uff, key=lambda c: c[1])
                                if a in ordine_replay]
            fonte_ordine = "derivato dai best ufficiali"
        ordine_coincide = ordine_replay == ordine_ufficiale

        esito["kpi2"] = {
            "auto_ufficiali": len(ufficiale),
            "auto_con_tempo_confrontabile": con_tempo,
            "best_coincidenti_al_millesimo": coincidenti,
            "fonte_ordine_ufficiale": fonte_ordine,
            "ordine_replay": ordine_replay,
            "ordine_ufficiale": ordine_ufficiale,
            "ordine_coincide": ordine_coincide,
            "gate": ordine_coincide and coincidenti >= 18,
            "confronto": confronto,
        }

    DERIVATI.mkdir(parents=True, exist_ok=True)
    (DERIVATI / "kpi_fase1.json").write_text(
        json.dumps(esito, ensure_ascii=False, indent=1), encoding="utf-8")

    for kpi in ("kpi1", "kpi2", "kpi3"):
        v = esito.get(kpi, {})
        gate = v.get("gate")
        verdetto = ("GO" if gate else "NO-GO") if gate is not None \
            else "solo report"
        sintesi = {c: k for c, k in v.items() if c != "confronto"}
        print(f"{kpi}: {verdetto} — {sintesi}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
