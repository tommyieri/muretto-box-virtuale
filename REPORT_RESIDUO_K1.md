# REPORT_RESIDUO_K1 — E2: Test 1 a k=1 (carburante re-inflazionato, finestre pulite)

KPI del Test 1 INVARIATI (Sessione A). Uniche differenze: orizzonte SOLO k=1 (k=3,5 NON
sani, non eseguiti); residuo per-pilota CON carburante re-inflazionato (fuel_mass*3/70,
formula del kernel, applicata all'OUTPUT); finestre pulite (no neutralizzazione dentro, no
edge, no doppiaggio). Bootstrap a blocchi-gara (10000, seed=20260711); 9 blocchi e'
il limite basso (dichiarato). Nota: E=k+1=2 giri, il residuo e' cumulato su in+out-lap.

### controllo DENTRO pit-window (primario, conv. Sessione A)

| metrica | pit | no-pit |
|---|---|---|
| MAE (s, su 2 giri) | 3.080 | 1.130 |
| mediana con segno (s) | +0.085 | +0.560 |
| n | 130 | 1677 |

**Differenza MAE(pit) - MAE(no-pit) = +1.950 s** (IC95 bootstrap [+0.509, +4.659]).
Grandezza PRIMA del p-value: 1.950 s su 2 giri. IC95 esclude lo zero -> **ESISTE**.

### controllo TUTTO pulito (secondario)

| metrica | pit | no-pit |
|---|---|---|
| MAE (s, su 2 giri) | 3.080 | 1.242 |
| mediana con segno (s) | +0.085 | +0.539 |
| n | 130 | 4679 |

**Differenza MAE(pit) - MAE(no-pit) = +1.838 s** (IC95 bootstrap [+0.397, +4.489]).
Grandezza PRIMA del p-value: 1.838 s su 2 giri. IC95 esclude lo zero -> **ESISTE**.

## Verdetto E2 (pre-registrato, invariato)

**Execution Delta a k=1 = +1.950 s (IC95 [+0.509,+4.659]) -> ESISTE.** Si passa a E3 (decomposizione).

k=3 e k=5: NON eseguiti perche' la misura non e' sana lì (mediana/giro controllo 0.32 e 0.37 >
0.30, firma del degrado non modellato che a k=5 vale ~1.85 s cumulati, le stesse dimensioni
dell'Execution Delta cercato). Restrizione dichiarata PRIMA (ok del PO), non dopo il risultato.

Nessun verdetto strategico: e' del PO.

# REPORT E3 — Decomposizione del residuo pit a k=1 (leave-one-race-out)

Baseline climatologia (media globale, LORO): MAE = 3.226 s. Target = residuo pit-attribuibile (pit re-inflazionato - mediana controllo stesso pilota/gara).

LIMITE dichiarato: 9 gare = 9 circuiti distinti -> climatologia per-circuito ed effetti fissi circuito NON stimabili LORO (circuito held-out mai visto); climatologia = media globale; le variabili continue generalizzano. Potenza bassa (9 fold).

| variabile | MAE baseline | MAE modello | riduzione MAE | esito |
|---|---|---|---|---|
| pit-loss circuito (f1db) | 3.226 | 3.112 | +3.5% | NO-GO |
| traffico al rientro | 3.226 | 3.266 | -1.2% | NO-GO |
| warm-in prior (compound out) | 3.226 | 3.625 | -12.4% | NO-GO |
| delta passo-base (descrittore) | 3.226 | 3.290 | -2.0% | NO-GO |
| in-lap del rivale (NUOVA) | 3.226 | 3.235 | -0.3% | NO-GO |
| TUTTE insieme | 3.226 | 3.406 | -5.6% | NO-GO |

Effetti fissi circuito: NON eseguibili LORO (9 circuiti unici) — dichiarato, non un risultato.

## Verdetto E3 (soglie pre-registrate): riduzione MAE fuori campione (tutte le variabili) = -5.6% -> **NO-GO**

Interpretazione onesta: a k=1 il residuo pit e' dominato da un OFFSET PER-GARA che correla ~-0.76 col pit-loss nominale (il pit-loss del circuito e' miscalibrato in modo proporzionale a se stesso). Cio' che un modello 'spiega' e' in gran parte una RI-CALIBRAZIONE del pit-loss, non abilita' d'esecuzione per-stop. Con 9 circuiti unici la stima LORO e' a bassa potenza.

Nessun verdetto strategico: e' del PO.
