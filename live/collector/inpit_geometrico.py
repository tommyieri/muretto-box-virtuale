#!/usr/bin/env python
"""Classificatore geometrico posizione -> in_pit (Fase 3, parte A).

Un'auto e' `in_pit` quando le ultime K posizioni CONSECUTIVE cadono entro
D dal corridoio pit del circuito (formato pitlane_spa.json); torna fuori
quando K posizioni consecutive cadono oltre D. L'isteresi e' proprio
questa simmetria a K campioni: un singolo campione ballerino ai bordi non
fa sfarfallare lo stato.

Parametri dichiarati (misurati sulla GARA di Spa 2026, replay SignalR,
corridoio pitlane_spa.json costruito da FP2 — vedi test_inpit_spa.py):
  - K = 3 campioni consecutivi (~0,8 s a 3,8 Hz);
  - D = 50 dm (5 m): i campioni dei periodi InPit del timing stanno entro
    0,9 m dal corridoio (p99; mediana 0,3 m), mentre il punto on-track
    PIU' VICINO di tutta la gara dista 12,6 m (p1: 12,6, p5: 19,7).
    D=5 m e' >5 volte il p99 dei punti pit e <40% del minimo on-track:
    margine ampio su entrambi i lati.

Uso nel collettore: quando il corridoio del circuito esiste, il campo
`in_pit` dei timing_update viene POPOLATO DA QUI (arricchisci_in_pit);
senza corridoio il campo resta assente — mai inventato. `v1/pit` di
OpenF1 resta registrato nel grezzo come arbitro a posteriori.

Solo stdlib; geometria riusata da verify_alignment (Fase 1).
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from verify_alignment import IndiceGriglia, ricampiona  # noqa: E402

K_CAMPIONI = 3
SOGLIA_DM = 50.0


class ClassificatoreInPit:
    """Stato in_pit per auto dalle posizioni, con isteresi a K campioni."""

    def __init__(self, corridoio_punti, soglia_dm=SOGLIA_DM, k=K_CAMPIONI):
        self.indice = IndiceGriglia(ricampiona(
            [tuple(p) for p in corridoio_punti]))
        self.soglia = soglia_dm
        self.k = k
        self._stato = {}      # auto -> bool (in_pit corrente)
        self._serie = {}      # auto -> conteggio consecutivi discordi

    @classmethod
    def da_file(cls, percorso, **kw):
        dati = json.loads(Path(percorso).read_text())
        return cls(dati["punti"], **kw)

    def stato(self, auto):
        return self._stato.get(str(auto), False)

    def aggiorna(self, auto, x, y):
        """Nuova posizione: ritorna il nuovo stato in_pit se e' CAMBIATO,
        altrimenti None."""
        auto = str(auto)
        dentro = self.indice.distanza(float(x), float(y)) <= self.soglia
        corrente = self._stato.get(auto, False)
        if dentro == corrente:
            self._serie[auto] = 0
            return None
        self._serie[auto] = self._serie.get(auto, 0) + 1
        if self._serie[auto] >= self.k:
            self._stato[auto] = dentro
            self._serie[auto] = 0
            return dentro
        return None


def arricchisci_in_pit(eventi, classificatore):
    """Stadio di pipeline: consuma eventi, aggiorna il classificatore sui
    position_frame e INTERCALA timing_update {"in_pit": ...} ai cambi di
    stato (t = t del frame che ha fatto scattare il cambio).

    Da usare SOLO quando il campo in_pit non arriva gia' dal feed
    (ingresso OpenF1); l'ingresso SignalR ha l'InPit del timing vero."""
    for evento in eventi:
        yield evento
        if evento["type"] != "position_frame":
            continue
        cambi = {}
        for auto, xy in evento["cars"].items():
            nuovo = classificatore.aggiorna(auto, xy["x"], xy["y"])
            if nuovo is not None:
                cambi[auto] = {"in_pit": nuovo}
        if cambi:
            yield {"type": "timing_update", "t": evento["t"],
                   "cars": cambi}
