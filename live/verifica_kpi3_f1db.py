#!/usr/bin/env python
"""Chiusura della riserva del KPI 3 di FASE 1B: pit stop vs arbitro f1db.

Il KPI 3 (FASE1B_PREREG: conteggio stop esatto per >=95% dei piloti, giro
d'ingresso entro +-1) era RINVIATO perche' l'arbitro primario dichiarato
(f1db) non aveva ancora Spa 2026. Con il rilascio v2026.10.0 (2026-07-19,
congelato in data/live_derived/gara_spa_2026_f1db_pitstops.json) il
verdetto va emesso. Il KPI non viene toccato.

Ricostruzione replay: stessa passata e stessa convenzione di
verifica_gara.py (giro = NumberOfLaps all'ingresso + 1; ingresso senza
uscita = non conteggiato). COMPLETAMENTO di misura dichiarato (gia'
annotato come limite in REPORT_FASE1B): per gli ingressi sotto la SC dei
giri 1-2, quando NumberOfLaps non e' ancora nello stato, il giro e'
attribuito dal LapCount del leader al momento dell'ingresso (fallback
documentato, tolleranza +-1 del KPI invariata).

Output: data/live_derived/kpi3_f1db.json + verdetto a stampa.
Uso:  .venv/bin/python live/verifica_kpi3_f1db.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from verifica_gara import (  # noqa: E402
    finestra_gara,
    lap_al_tempo,
    passata_misure,
)

DERIVATI = Path(__file__).resolve().parent.parent / "data/live_derived"


def stop_replay():
    """Stop per auto dal raw di gara (convenzione di verifica_gara +
    fallback LapCount per i giri 1-2)."""
    (_stato, _campioni, lapcount, _track, session_status,
     intervalli) = passata_misure()
    t_start, t_fine = finestra_gara(session_status)
    per_auto = {}
    for auto, coppie in intervalli.items():
        for iv in coppie:
            if not (t_start and iv["da"] and iv["da"] > t_start
                    and iv["a"] is not None
                    and (t_fine is None or iv["da"] < t_fine)):
                continue
            if isinstance(iv["giri_ingresso"], int):
                giro = iv["giri_ingresso"] + 1
                origine = "NumberOfLaps+1"
            else:
                giro = lap_al_tempo(lapcount, iv["da"], t_start)
                origine = "fallback LapCount leader"
            per_auto.setdefault(auto, []).append(
                {"giro": giro, "origine": origine})
    return per_auto


def main() -> int:
    arbitro = json.loads(
        (DERIVATI / "gara_spa_2026_f1db_pitstops.json").read_text())
    f1db = {}
    for s in arbitro["stop"]:
        f1db.setdefault(s["auto"], []).append(s["giro"])
    replay = stop_replay()

    auto_tutte = sorted(set(f1db) | set(replay), key=int)
    confronto = []
    conteggio_ok = 0
    stop_totali = stop_giro_ok = 0
    for auto in auto_tutte:
        giri_f1db = sorted(f1db.get(auto, []))
        voci = sorted(replay.get(auto, []),
                      key=lambda v: (v["giro"] is None, v["giro"]))
        stesso_conteggio = len(giri_f1db) == len(voci)
        conteggio_ok += stesso_conteggio
        dettaglio = []
        if stesso_conteggio:
            for atteso, voce in zip(giri_f1db, voci):
                stop_totali += 1
                entro = (voce["giro"] is not None
                         and abs(voce["giro"] - atteso) <= 1)
                stop_giro_ok += entro
                dettaglio.append({"giro_f1db": atteso, **voce,
                                  "entro_1": entro})
        confronto.append({"auto": auto, "stop_f1db": len(giri_f1db),
                          "stop_replay": len(voci),
                          "conteggio_esatto": stesso_conteggio,
                          "stop": dettaglio})
        print(f"#{auto:>3}  f1db {len(giri_f1db)} {giri_f1db}  "
              f"replay {len(voci)} {[v['giro'] for v in voci]}  "
              f"{'OK' if stesso_conteggio else '<-- CONTEGGIO DIVERSO'}")

    # RUS (#63): 0 stop in entrambi -> conteggio esatto anche per lui;
    # i piloti senza stop da nessuna parte non compaiono in auto_tutte,
    # quindi il denominatore giusto e' la classifica (22 piloti).
    classifica = json.loads(
        (DERIVATI / "gara_spa_2026_pubblicata.json").read_text())
    tutte22 = [v["auto"] for v in classifica["classifica"]]
    senza_stop_ovunque = [a for a in tutte22 if a not in auto_tutte]
    conteggio_ok += len(senza_stop_ovunque)

    quota_conteggio = conteggio_ok / len(tutte22)
    gate = quota_conteggio >= 0.95 and stop_giro_ok == stop_totali
    esito = {
        "_nota": "chiusura riserva KPI 3 FASE1B (arbitro f1db v2026.10.0)",
        "piloti_totali": len(tutte22),
        "piloti_conteggio_esatto": conteggio_ok,
        "quota_conteggio": round(quota_conteggio, 4),
        "senza_stop_in_entrambi": senza_stop_ovunque,
        "stop_confrontati": stop_totali,
        "stop_giro_entro_1": stop_giro_ok,
        "gate": gate,
        "confronto": confronto,
    }
    (DERIVATI / "kpi3_f1db.json").write_text(
        json.dumps(esito, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nconteggio esatto: {conteggio_ok}/{len(tutte22)} piloti "
          f"({100 * quota_conteggio:.1f}%, soglia 95%)")
    print(f"giro entro +-1: {stop_giro_ok}/{stop_totali} stop")
    print(f"KPI 3: {'GO' if gate else 'NO-GO'}")
    return 0 if gate else 1


if __name__ == "__main__":
    sys.exit(main())
