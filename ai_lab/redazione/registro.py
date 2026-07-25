"""
registro.py — i generatori di articoli registrati.

Ogni generatore e' un modulo dentro ai_lab/redazione/ che espone:
  META = {"id", "canale", "titolo", "tag", "richiede", "gare"}
  genera(gara=None, data=None) -> record {"id","titolo","stato","canale"} | None

`genera.py` li scorre tutti dopo una gara e produce le bozze. Aggiungere un
articolo = aggiungere una riga qui. Nessuno pubblica: producono solo bozze.
"""

GENERATORI = [
    "genera_lift_traguardo",
    "genera_rapporti",
    "genera_stowe",
    "genera_frenata",
    "genera_trazione",
    "genera_efficienza",
    "genera_dna",
    "genera_fp_passo",
    "genera_fp_rapporti",
]
