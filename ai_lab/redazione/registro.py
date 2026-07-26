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
    "genera_quali_gap_pole",
    "genera_curva_simbolo",
    "genera_passo_reale",
    "genera_recap_weekend",
    # genera_linea_diversa: NON in rotazione — il GPS (~13-16 m) non risolve le
    # traiettorie su una pista larga ~11-13 m (differenza sotto il rumore stesso-pilota).
    # File tenuto (fail-safe, si auto-salta) come tentativo documentato: decisione PO.
]
