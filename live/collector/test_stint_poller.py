#!/usr/bin/env python
"""Test del poller REST degli stint OpenF1 (senza rete: fetch iniettato).

Uso:  python3 live/collector/test_stint_poller.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from stint_poller import (  # noqa: E402
    StintPoller,
    eta_gomma,
    evento_timing_update,
    stato_da_stints,
    stint_corrente,
)

_esiti = []


def caso(nome):
    def deco(fn):
        _esiti.append((nome, fn))
        return fn
    return deco


def _stint(num, n, ls, le, comp, a0=0):
    return {"driver_number": num, "stint_number": n, "lap_start": ls,
            "lap_end": le, "compound": comp, "tyre_age_at_start": a0}


@caso("eta' gomma: formula CALIBRATA a0+(giro-lap_start)+1 (98% vs archivio)")
def test_eta_calibrata():
    s = _stint(16, 1, 21, 44, "HARD", a0=0)
    # al primo giro dello stint la gomma ha 1 giro (il giro in corso)
    assert eta_gomma(s, 21) == 1, eta_gomma(s, 21)
    assert eta_gomma(s, 22) == 2
    assert eta_gomma(s, 44) == 24
    # gomma usata: l'eta' di partenza si somma
    assert eta_gomma(_stint(1, 3, 10, 20, "MEDIUM", a0=6), 10) == 7
    # campi mancanti -> None, mai un numero inventato
    assert eta_gomma({"lap_start": 5}, 7) is None
    assert eta_gomma(s, None) is None


@caso("stint corrente: quello che contiene il giro, altrimenti stint_number max")
def test_stint_corrente():
    a, b = _stint(4, 1, 1, 20, "MEDIUM"), _stint(4, 2, 21, 40, "HARD")
    assert stint_corrente([a, b], giro=10)["compound"] == "MEDIUM"
    assert stint_corrente([a, b], giro=30)["compound"] == "HARD"
    assert stint_corrente([a, b])["compound"] == "HARD"      # senza giro: l'ultimo
    assert stint_corrente([]) is None


@caso("stato: compound ignoto -> None (mai inventato); pilota senza stint assente")
def test_stato_onesto():
    righe = [_stint(4, 1, 1, 10, "MEDIUM"), _stint(9, 1, 1, 10, "TEST")]
    st = stato_da_stints(righe, giro_per_pilota={"4": 5, "9": 5})
    assert st["4"]["compound"] == "MEDIUM" and st["4"]["tyre_age"] == 5, st
    assert st["9"]["compound"] is None, st           # compound fuori vocabolario
    assert "99" not in st                            # pilota senza dati: assente


@caso("poller: emette SOLO i campi cambiati (convenzione timing_update)")
def test_diff():
    seq = [[_stint(4, 1, 1, 3, "MEDIUM")],          # 1o giro
           [_stint(4, 1, 1, 4, "MEDIUM")],          # eta' cresce, compound uguale
           [_stint(4, 1, 1, 4, "MEDIUM")]]          # nulla cambia
    it = iter(seq)
    p = StintPoller(fetch=lambda: next(it))
    d1 = p.aggiorna()
    assert d1["4"] == {"compound": "MEDIUM", "tyre_age": 3}, d1
    d2 = p.aggiorna()
    assert d2 == {"4": {"tyre_age": 4}}, d2          # solo l'eta'
    d3 = p.aggiorna()
    assert d3 == {}, d3                              # nessun cambio -> nessun evento


@caso("poller: errore di rete -> nessun evento, nessuna eccezione")
def test_errore_rete():
    p = StintPoller(fetch=lambda: None)              # scarica() ritorna None su errore
    assert p.aggiorna() == {}
    assert evento_timing_update({}) is None
    assert evento_timing_update({"4": {"tyre_age": 3}}, t="2026-07-26T13:00:00Z") == {
        "type": "timing_update", "cars": {"4": {"tyre_age": 3}},
        "t": "2026-07-26T13:00:00Z"}


def main():
    ok = 0
    for nome, fn in _esiti:
        try:
            fn()
        except AssertionError as e:
            print(f"FAIL {nome}: {e}")
        else:
            ok += 1
            print(f"OK   {nome}")
    print(f"\n{ok}/{len(_esiti)} casi passati")
    return 0 if ok == len(_esiti) else 1


if __name__ == "__main__":
    raise SystemExit(main())
