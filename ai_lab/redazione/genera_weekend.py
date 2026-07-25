#!/usr/bin/env python3
"""
genera_weekend.py — L'INNESCO della redazione dai dati delle libere.

Dopo FP1/FP2 questo script individua il Gran Premio del weekend IN CORSO, sceglie
la sessione di prove libere piu' recente disponibile e lancia i SOLI generatori
specifici-FP (via genera.genera_tutti con --sessione): produce BOZZE track-agnostic
per qualunque GP, senza toccare demo/ ne' pubblicare nulla.

COME INDIVIDUA IL GP. Riusa la logica di live/weekend_scheduler.py::sessioni_future:
il weekend in corso e' quello che contiene la sessione piu' vicina a ora. Da li'
prende il nome (italiano) del GP. Con --gara si forza a mano.

QUALE SESSIONE. Prova FP2, poi FP1 (la piu' recente prima). Si ferma alla prima che
produce bozze. Con --sessione si forza una singola sessione.

BEST-EFFORT. Se FastF1 non ha ancora pubblicato la sessione (ritardo tipico), i
generatori si auto-saltano dentro genera_tutti e qui non si rompe niente: lo script
e' ri-eseguibile a mano piu' tardi. In modalita' sessione genera_tutti NON aggiorna
il cruscotto (e' un giro di libere, non un giro post-gara).

USO:
  python3 ai_lab/redazione/genera_weekend.py                 # weekend in corso, FP2->FP1
  python3 ai_lab/redazione/genera_weekend.py --sessione FP2  # solo FP2
  python3 ai_lab/redazione/genera_weekend.py --gara Ungheria # forza il GP
"""
from __future__ import annotations
import os
import sys
import argparse

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
sys.path.insert(0, os.path.join(_QUI, "rilevatori"))

import base    # noqa: E402  (per base.REPO)
import genera  # noqa: E402

# prove libere in ordine di preferenza: la piu' recente prima
FP_ORDINE = ["FP2", "FP1"]


def gp_weekend_in_corso():
    """Nome (italiano) del GP del weekend IN CORSO — quello con la sessione piu'
    vicina a ora — riusando live/weekend_scheduler.py::sessioni_future. Best-effort:
    se lo scheduler non e' importabile o il calendario non ha sessioni future,
    ritorna None e il chiamante deve passare --gara."""
    live = os.path.join(base.REPO, "live")
    if live not in sys.path:
        sys.path.insert(0, live)
    try:
        import weekend_scheduler as ws
    except Exception as e:
        print(f"  [weekend] scheduler non importabile ({e}); serve --gara")
        return None
    try:
        ss = ws.sessioni_future()      # [(label, inizio_utc, nome_gp), ...] del solo weekend in corso
    except Exception as e:
        print(f"  [weekend] calendario non leggibile ({e}); serve --gara")
        return None
    if not ss:
        print("  [weekend] nessuna sessione futura in calendario")
        return None
    return ss[0][2] or None


def genera_per_gp(gara, sessioni, data=None):
    """Prova le sessioni in ordine; alla prima che produce bozze si ferma.
    Ritorna (sessione_usata, prodotti) oppure (None, []) se nessuna ha prodotto."""
    for ses in sessioni:
        print(f"\n== tentativo sessione {ses} ({gara}) ==")
        try:
            prodotti, saltati = genera.genera_tutti(gara=gara, data=data, sessione=ses)
        except Exception as e:
            # genera_tutti isola gia' i singoli generatori; qui si arriva solo per
            # un guasto dell'orchestratore stesso. Best-effort: si prova la prossima.
            print(f"  [weekend] {ses}: giro fallito ({e}) — provo la prossima")
            continue
        if prodotti:
            return ses, prodotti
        print(f"  {ses}: nessuna bozza (sessione non ancora disponibile o dati insufficienti)")
    return None, []


def main():
    ap = argparse.ArgumentParser(
        description="Innesco redazione dai dati FP del weekend in corso (bozze, mai pubblicazione)")
    ap.add_argument("--gara", default=None,
                    help="forza il GP (nome italiano del registro o nome/localita' FastF1); "
                         "default = weekend in corso dal calendario")
    ap.add_argument("--sessione", default=None,
                    help="FP1/FP2: forza una singola sessione; default = prova FP2 poi FP1")
    ap.add_argument("--data", default=None, help="AAAA-MM-GG per la targhetta della bozza")
    a = ap.parse_args()

    gara = a.gara or gp_weekend_in_corso()
    if not gara:
        print("nessun GP individuato (calendario senza sessioni future e nessun --gara): esco.")
        return 1

    sessioni = [a.sessione] if a.sessione else list(FP_ORDINE)
    print(f"Innesco redazione FP · GP {gara} · sessioni da provare: {', '.join(sessioni)}")

    ses, prodotti = genera_per_gp(gara, sessioni, data=a.data)
    if prodotti:
        print(f"\nFP {ses} · {gara}: {len(prodotti)} bozze prodotte:")
        for r in prodotti:
            print(f"   {r['id']} — {r['titolo']} ({r['stato']})")
        print("Rivedi con:  python3 ai_lab/redazione/coda.py --lista")
    else:
        # best-effort: nessuna bozza NON e' un errore (FP non ancora pubblicata,
        # oppure dati insufficienti). Si rilancia a mano piu' tardi.
        print(f"\nnessuna bozza prodotta per {gara} "
              f"(prove libere non ancora disponibili?): ri-eseguibile piu' tardi.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
