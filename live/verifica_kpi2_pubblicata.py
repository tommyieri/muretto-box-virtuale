#!/usr/bin/env python
"""Diagnostico ONE-OFF post-verdetto: replay FP2 vs classifica PUBBLICATA.

Il KPI 2 (NO-GO, arbitro = FastF1 results) NON viene toccato: questo script
verifica solo la spiegazione del NO-GO. La classifica pubblicata su
formula1.com esclude i giri cancellati per track limits; se l'ordine e i
tempi ricostruiti dal replay coincidono con quella, la causa del NO-GO e'
l'arbitro (che nelle FP include i giri cancellati), non il motore.

Input statico: data/live_derived/fp2_spa_2026_pubblicata.json (fonti e data
di recupero nel file). Output: stampa + diag_kpi2_pubblicata.json.

Uso:  .venv/bin/python live/verifica_kpi2_pubblicata.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from decoder import StatoSessione  # noqa: E402
from kpi_fase1 import secondi  # noqa: E402
from replay import eventi_replay  # noqa: E402
from test_fase1 import FP2  # noqa: E402

DERIVATI = Path(__file__).resolve().parent.parent / "data/live_derived"


def main() -> int:
    pubblicata = json.loads(
        (DERIVATI / "fp2_spa_2026_pubblicata.json").read_text())
    base = pubblicata["base_s"]

    stato = StatoSessione()
    for _ in eventi_replay([FP2], stato=stato):
        pass

    con_best = [(a, secondi(stato.best_lap(a)))
                for a in {v["auto"] for v in pubblicata["classifica"]}]
    con_best = [(a, t) for a, t in con_best if t is not None]
    ordine_replay = [a for a, _ in sorted(con_best, key=lambda c: c[1])]
    best_replay = dict(con_best)

    righe = []
    pos_ok = tempi_ok = 0
    for voce in pubblicata["classifica"]:
        auto = voce["auto"]
        atteso = round(base + voce["gap_s"], 3)
        ricostruito = best_replay.get(auto)
        pos_replay = (ordine_replay.index(auto) + 1
                      if auto in ordine_replay else None)
        stessa_pos = pos_replay == voce["pos"]
        stesso_tempo = (ricostruito is not None
                        and abs(ricostruito - atteso) < 0.0005)
        pos_ok += stessa_pos
        tempi_ok += stesso_tempo
        righe.append({"pos_pubblicata": voce["pos"], "auto": auto,
                      "sigla": voce["sigla"], "best_pubblicato_s": atteso,
                      "best_replay_s": ricostruito,
                      "pos_replay": pos_replay,
                      "pos_coincide": stessa_pos,
                      "tempo_coincide_al_millesimo": stesso_tempo})
        print(f"P{voce['pos']:>2} {voce['sigla']} #{auto:>3} "
              f"pubblicato {atteso:8.3f} replay "
              f"{ricostruito if ricostruito is not None else '   n/d'}"
              f"{'' if stessa_pos and stesso_tempo else '  <-- DIVERGE'}")

    n = len(pubblicata["classifica"])
    verdetto = ("motore corretto: replay identico alla classifica "
                "pubblicata — NO-GO formale confermato, causa = arbitro "
                "(FastF1 results include i giri cancellati nelle FP)"
                if pos_ok == n and tempi_ok == n else
                "DIVERGENZA REALE: il replay non riproduce la classifica "
                "pubblicata — problema nel motore, da indagare")
    esito = {"_nota": "diagnostico one-off, KPI 2 non modificato",
             "auto_totali": n, "posizioni_coincidenti": pos_ok,
             "tempi_coincidenti_al_millesimo": tempi_ok,
             "verdetto": verdetto, "confronto": righe}
    (DERIVATI / "diag_kpi2_pubblicata.json").write_text(
        json.dumps(esito, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nposizioni: {pos_ok}/{n}  tempi al millesimo: {tempi_ok}/{n}")
    print(verdetto)
    return 0 if pos_ok == n and tempi_ok == n else 1


if __name__ == "__main__":
    sys.exit(main())
