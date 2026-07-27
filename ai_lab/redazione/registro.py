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
    "genera_upgrade",
    "genera_upgrade_preview",
    # --- WEEKEND SPRINT ---------------------------------------------------------
    # Si accendono da soli SOLO nei weekend con la sprint: dichiarano sessioni "S"
    # (la Sprint) o "Q", e la prima cosa che fanno e' controllare l'EventFormat di
    # FastF1 — in un weekend normale ritornano None senza sollevare.
    # CABLAGGIO: auto_articoli.py::SESSIONI elenca [FIA, FP2, FP3, SQ, S, Q, R]. "SQ" e
    # "S" ci sono state aggiunte proprio per questi pezzi (e per genera_fp_rapporti, che
    # nel weekend sprint si aggancia a SQ): prima non avevano innesco automatico ed
    # erano scritti ma non consegnati.
    "genera_sprint_aria",      # sessione S — la scia: +km/h sul dritto, -km/h all'apice
    "genera_sprint_passo",     # sessione S — il passo su sequenze in aria libera
    # sessione Q — SQ vs Q, il parco chiuso aperto. IN ROTAZIONE MA COL CANCELLO
    # CHIUSO SU TUTTI E QUATTRO GLI SPRINT 2026: la concordanza dei compagni sul delta
    # grezzo era regressione verso la media (i compagni condividono il livello in SQ),
    # e con i segni presi sui residui + null di permutazione nessun evento passa
    # (Miami 0,004 -> 0,311). Resta perche' si riaprirebbe da solo su un effetto vero.
    "genera_sprint_scalino",
    # genera_linea_diversa: NON in rotazione — il GPS (~13-16 m) non risolve le
    # traiettorie su una pista larga ~11-13 m (differenza sotto il rumore stesso-pilota).
    # File tenuto (fail-safe, si auto-salta) come tentativo documentato: decisione PO.
    # genera_degrado_stint: NON in rotazione — NULL documentato (Ungheria 2026). Il
    # rumore di gara (~462 ms/giro RMSE) e' ~12x il segnale di degrado (~37 ms/giro):
    # pendenze per-stint inaffidabili; il pool per-mescola da' un ordine assurdo
    # (soft < hard = confondente benzina/fase, non gomma). File tenuto col CANCELLO
    # di robustezza che si auto-chiude: un GP con degrado pulito lo riaprirebbe.
]
