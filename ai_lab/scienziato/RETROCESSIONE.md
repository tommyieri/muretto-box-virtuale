# Registro della retrocessione — cosa il laboratorio NON può più trattare come dato

Rifondazione del 21/07/2026. Registro autorevole: quando un file del laboratorio cita
questo documento, sta dichiarando che uno dei suoi ingressi è **ipotesi**, non fondazione.

## Il FONDO (unica terra ferma, non richiede riverifica)

- tempi sul giro **grezzi** (`time`), cronometria cumulata (`sesT`, `lST`)
- **pit reali**: giro e timestamp di ingresso/uscita (`pin`, `pout`)
- **posizioni** (`pos`)
- **status bandiera** (`status`) — nella sola decodifica *committata* (`'1'` = verde)
- la cronometria pura di **TracingInsights** e **f1db**

Tutto il resto si ricostruisce dal fondo. Nessuna scorciatoia attraverso un numero già
"validato".

## Retrocessi da FONDAZIONE a IPOTESI

| numero | dove vive | perché retrocesso |
|---|---|---|
| `FUEL_COEFF = 3/70` s/kg su 70 kg (⇒ 3,0 s a serbatoio pieno) | `engine/engine.py:40`, duplicato in `live/pace_base_live.py:16` | mai ricostruito dal fondo; ogni residuo del laboratorio ci vive dentro |
| `FUEL_SKG=0.03 · FUEL_KG=70` (⇒ 2,1 s) | `test_identificabilita_degrado.py:44` | **seconda costante, incoerente con la prima** |
| cap del traffico `ZONE=1.5, STRENGTH=1.0` e il "+27%" | `engine/engine.py` (TrafficModel), `ai_lab/distruttore/patogeni.py`, `calibrazione.py` | baseline di ogni confronto del Distruttore |
| pit-loss per-circuito (Silverstone 20,80; Miami 20,11; tipico 29,12) | `data/pit_loss_circuito*.csv`, `demo/data/pitloss.json`, `patogeni.py` | usato come **"noto-vero"** che tara la specificità del giudice |
| passo-base fuel-corretto `pace_base` | `engine/engine.py:41`, ovunque nell'Auditor | 2° piano: dipende dal 1° (fuel) non verificato |
| bande di degrado, climatologia, scenari | `data/climatologia_degrado.csv`, `data/banda_degrado_scelta.json` | 3° piano |
| dossier e mappa della conoscenza | `ai_lab/reports/`, `ai_lab/knowledge/conoscenza.json` | **condizionati** allo spazio fuel-corretto: non falsi, da rileggere dopo la verifica |

Il kernel di **produzione** non viene toccato: quei numeri restano nel prodotto. Cambia
soltanto il loro statuto **dentro il laboratorio**.

## Conservato come METODO (mai come risultato)

Filtri dichiarati e contati · guardrail di rango (mai `pinv` silenziosa) · SE
cluster-robust · **blocchi indipendenti** (gara/stint, non osservazioni) · bootstrap a
blocchi · permutation null · replica out-of-sample · preregistrazione sigillata prima dei
numeri · ogni valore col suo generatore committato · spazio di misura **fuel-neutro**
quando il coefficiente non è verificato.

## Stato dei piani

```
fondo (cronometria)  →  1° piano FUEL  →  2° piano PASSO PULITO  →  3° piano DEGRADO
      VERIFICATO         in verifica          non aperto              non aperto
```
