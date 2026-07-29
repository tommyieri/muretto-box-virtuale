#!/usr/bin/env python
"""Test di estrai_gap.py su fixture sintetiche (stile test_inspect.py):
un JSONL OpenF1 con un buco artificiale di 45 s dentro la sessione
attiva e un buco FUORI (prima del primo v1/location, che NON deve
contare), piu' la classificazione dello stato del sito per durata."""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from estrai_gap import analizza, stato_sito  # noqa: E402


def riga(t, topic, payload):
    return json.dumps({"t": t, "topic": topic, "payload": payload})


class TestEstraiGap(unittest.TestCase):
    def test_buco_in_sessione_attiva(self):
        righe = [
            # prima della sessione attiva: buco di 200 s che NON conta
            riga("2026-07-19T12:00:00.000+00:00", "v1/sessions", {}),
            riga("2026-07-19T12:03:20.000+00:00", "v1/location",
                 {"x": 1, "y": 2, "driver_number": 1,
                  "date": "2026-07-19T12:03:20+00:00"}),
            riga("2026-07-19T12:03:25.000+00:00", "v1/intervals", {}),
            # buco di 45 s dentro la sessione attiva
            riga("2026-07-19T12:04:10.000+00:00", "v1/location",
                 {"x": 3, "y": 4, "driver_number": 1,
                  "date": "2026-07-19T12:04:10+00:00"}),
            riga("2026-07-19T12:04:12.000+00:00", "v1/location",
                 {"x": 5, "y": 6, "driver_number": 1,
                  "date": "2026-07-19T12:04:12+00:00"}),
        ]
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl",
                                         delete=False) as f:
            f.write("\n".join(righe) + "\n")
            percorso = Path(f.name)
        try:
            esito = analizza(percorso, soglia_s=10.0)
        finally:
            percorso.unlink()
        self.assertEqual(len(esito["buchi"]), 1)
        b = esito["buchi"][0]
        self.assertEqual(b["durata_s"], 45.0)
        self.assertIn("marker grigi", b["sito"])
        self.assertIn("NESSUNA SESSIONE", b["sito"])
        self.assertNotIn("rimossi", b["sito"])

    def test_stato_sito_per_durata(self):
        self.assertNotIn("NESSUNA SESSIONE", stato_sito(15))
        self.assertIn("NESSUNA SESSIONE", stato_sito(45))
        self.assertIn("rimossi", stato_sito(90))


if __name__ == "__main__":
    unittest.main()
