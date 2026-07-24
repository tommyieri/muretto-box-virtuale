"""
scout.py — Canale A (scouting web).

Lo scout cerca sul web spunti tecnici (stampa specializzata, analisi telemetriche,
forum tecnici) e li deposita nella coda spunti (ai_lab/redazione/spunti/). Uno
spunto NON diventa articolo per traduzione: si RIPRODUCE sui nostri dati (stessa
macchina del Canale B) e la fonte si cita sempre. Se i nostri dati smentiscono la
fonte, la smentita e' l'articolo.

Lo scout gira come agente (LLM con WebSearch/WebFetch); questo modulo tiene il
prompt e legge/scrive la coda. La riproduzione e il taglio finale restano
deterministici e umani (revisione).

VINCOLO 2026 (accertato): il feed pubblico non espone piu' ERS/batteria,
active-aero e DRS. I fenomeni energetici si INFERISCONO dalle tracce
Speed/Throttle/nGear/RPM/GPS: l'inferenza va dichiarata (variabile latente).
"""
from __future__ import annotations
import os
import json
import glob

_QUI = os.path.dirname(os.path.abspath(__file__))
SPUNTI = os.path.join(_QUI, "spunti")

PROMPT = """Sei lo SCOUT (Canale A) della redazione tecnica di F1 "Muretto". Cerchi \
sul web spunti per articoli di INGEGNERIA 2026 - NON cronaca, NON gossip. Un fatto \
tecnico controintuitivo -> spiegazione fisica -> quantificazione.

MANDATO (deciso da Tommi, vedi mandato.json). Cerca SOLO in questi temi, in ordine di \
priorita':
 1. Tecnica di guida (velocita minima in curva, gas in uscita/trazione, delta fra \
    compagni per punto-pista, marce e cambiate in curva).
 2. Assetto & frenata (trazione in uscita, zona di frenata/trail-braking, impronta \
    d'assetto scarico vs carico).
 2. Energia & clipping (super-clipping, lift-and-coast, cambiate al servizio del recupero).
 3. Aerodinamica trim & efficienza (carico per gara/circuito, mappa punta-vs-curva).
 3. DNA circuito & confronti (caratterizzazione pista, anno-su-anno, quali vs passo gara).
NON cercare: gomme/degrado, strategia, data-journalism (fuori mandato).

POLITICA solo-SI: proponi solo spunti che i NOSTRI canali permettono DAVVERO \
(Speed/Throttle/Brake/nGear/RPM/GPS + cronometraggio/settori/stint/pit-loss). \
ERS/DRS/active-aero NON sono nel feed 2026: se uno spunto li richiede, scartalo o \
marcalo come non-fattibile - niente inferenze nascoste.

Per ogni spunto: titolo tecnico, cosa/causa, FONTE (URL+testata, obbligatoria), come \
riprodurlo sui nostri dati, forza 1-5. Preferisci fonti tecniche; non copiare testo."""


def carica_spunti():
    """Tutti gli spunti in coda (Canale A), da tutti i file spunti/*.json."""
    out = []
    for p in sorted(glob.glob(os.path.join(SPUNTI, "*.json"))):
        try:
            d = json.load(open(p))
            for s in d.get("spunti", []):
                s["_file"] = os.path.basename(p)
                out.append(s)
        except Exception:
            continue
    return out


if __name__ == "__main__":
    for s in sorted(carica_spunti(), key=lambda x: -x.get("forza", 0)):
        print(f"  [{s.get('forza','?')}/5] {s.get('id','?'):26} {s.get('titolo','')}")
