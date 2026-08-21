#!/usr/bin/env python3
"""sonda_mestiere.py — la prova che conta: caricare DAVVERO una sessione.

E' la meta' pesante di `sonda_prontezza.py`, e sta in un file suo per una ragione che
non e' di ordine. La sonda delle fonti la chiama ogni macchina — compreso il runner
della CI — e per questo dentro ha solo libreria standard. Questa qui carica una
sessione vera, quindi FastF1 le serve: la chiama solo la macchina che pubblica
(`scheduling/prontezza_run.sh`, dalla crontab del VPS, il mercoledi'). Tenerle insieme
voleva dire dichiarare fastf1 anche all'ambiente del banco, cioe' pretendere su un
runner CI pulito una libreria che li' non serve — e `test_dipendenze.py` lo ha detto al
primo giro, com'e' giusto che sia.

    python3 sonda_mestiere.py        le fonti + la prova del mestiere
"""
from __future__ import annotations
import os
import sys
import json
import time
import tempfile

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)

from sonda_prontezza import (                                        # noqa: E402
    ROSSO, VERDE, GIALLO, _tinta, controlla_fonti, controlla_chiave, controlla_cache,
    _leggi_stato, _scrivi_stato,
)


def prova_il_mestiere():
    """LA PROVA CHE CONTA: caricare davvero una sessione, a cache FREDDA.

    Non guarda una configurazione: fa il lavoro. Se questa passa, questa macchina oggi
    puo' pubblicare una gara; se cade, non puo' — e non importa quanto sia ordinata la
    crontab. Cache in una cartella temporanea e buttata: una cache calda farebbe
    passare la prova anche a rete morta, che e' l'errore da cui nasce questa sonda.

    `telemetry=False` di proposito: prova il PERCORSO, non la banda. Il guasto che si
    cerca (rete, blocco, credenziali) cade sul primo scaricamento; scaricare 80 MB in
    piu' a ogni giro non aggiungerebbe una sola informazione."""
    try:
        import fastf1
    except ImportError:
        return (GIALLO, "fastf1 non installato in questo python: la prova del mestiere "
                        "non si puo' fare (la dipendenza la guarda test_dipendenze.py)",
                "mestiere")
    import logging
    import warnings
    warnings.filterwarnings("ignore")
    logging.getLogger("fastf1").setLevel(logging.CRITICAL)

    freddo = tempfile.mkdtemp(prefix="prontezza_")
    t0 = time.time()
    try:
        fastf1.Cache.enable_cache(freddo)
        cal = json.load(open(os.path.join(_QUI, "demo", "data", "calendario_2026.json")))
        gare = [g for g in cal.get("gare", []) if g.get("vincitore")]
        if not gare:
            return (GIALLO, "nessuna gara gia' corsa nel calendario: niente da provare",
                    "mestiere")
        g = gare[-1]                       # l'ultima gara CORSA: dati stabili, sempre li'
        s = fastf1.get_session(int(g["data"][:4]), g["round"], "R")
        s.load(telemetry=False, weather=False, messages=False)
        n = len(s.laps)
        if not n:
            return (ROSSO, f"{g['nome']}: sessione caricata ma SENZA giri — la fonte "
                           f"risponde e non porta dati", "mestiere")
        return (VERDE, f"prova del mestiere: {g['nome']} {g['data'][:4]}, {n} giri "
                       f"scaricati da zero in {time.time()-t0:.0f}s", "mestiere")
    except Exception as e:
        return (ROSSO, f"NON so fare il mio mestiere: {type(e).__name__}: {str(e)[:150]}. "
                       f"Questa macchina oggi non pubblicherebbe una gara.", "mestiere")
    finally:
        import shutil
        shutil.rmtree(freddo, ignore_errors=True)


def main():
    esiti = controlla_fonti() + [controlla_chiave()] + controlla_cache()
    esiti.append(prova_il_mestiere())
    rossi = [e for e in esiti if e[0] == ROSSO]

    # LO STATO E' LO STESSO della sonda leggera: le due non devono raccontare due storie.
    ora = {n: s for s, _, n in esiti}
    prima = _leggi_stato()
    cambiato = {n for n in ora if prima.get("voci", {}).get(n) != ora[n]}
    _scrivi_stato({"verdetto": ROSSO if rossi else VERDE, "voci": ora,
                   "quando": time.strftime("%Y-%m-%d %H:%M:%S")})

    for stato, riga, nome in esiti:
        marchio = " <-- CAMBIATO" if nome in cambiato and prima else ""
        print(f"{_tinta(stato)} {riga}{marchio}")
    print()
    if rossi:
        print(f"{_tinta(ROSSO)} QUESTA MACCHINA NON E' PRONTA: {len(rossi)} controlli rossi.")
        print("        Non e' una configurazione da sistemare con calma: e' il lavoro che")
        print("        non si puo' fare. Se e' venerdi', e' gia' tardi.")
        return 1
    print(f"{_tinta(VERDE)} pronta: {len(esiti)} controlli, prova del mestiere compresa.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
