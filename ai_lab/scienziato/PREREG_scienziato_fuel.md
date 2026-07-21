# PREREG — lo Scienziato sul 1° piano: la correzione carburante

Scritto **prima** di guardare i numeri. Branch `ai-lab/scienziato-fuel`, 21/07/2026.

## 0. Che cosa si ricostruisce

L'effetto-carburante: la macchina si alleggerisce di giro in giro e va più veloce **anche
a gomma costante**. Nel kernel di produzione vive come

```python
FUEL_COEFF = 3.0/70.0                                  # engine/engine.py:40
tempo_corretto = tempo - max(0, 70 - (70/N)*(giro-1)) * FUEL_COEFF
```

I due parametri (70 kg, 3/70 s/kg) compaiono **solo come prodotto**. La grandezza
identificabile è una sola:

> **Δ = lo scivolamento totale del tempo sul giro dal giro 1 al giro N dovuto al
> carburante, in secondi.** Il kernel afferma Δ_kernel = 3,0·(N−1)/N ≈ **3,0 s**,
> uguale per ogni circuito. Per giro: γ_kernel = −3,0/N s/giro.

È questo che va ritrovato dal fondo, non "0,03 s/kg".

## 1. Fondo ammesso (nient'altro)

`time`, `sesT` (cronometria), `pin`/`pout` (pit reali), `pos`, `status` nella sola
decodifica committata (`'1'` = verde). **Metadati della stessa fonte** ammessi con
dichiarazione esplicita e solo per *livelli*, mai per il coefficiente: `compound`,
`del`, `wR` (pioggia). L'età-gomma è **ricostruita dai pit** (fondo) e la ricostruzione
viene confrontata col campo `life` come controllo.

Vietato: `FUEL_COEFF`, `pace_base`, bande di degrado, pit-loss, cap del traffico,
qualunque CSV derivato in `data/`.

## 2. Il problema di identificazione, dichiarato prima

Dentro **uno stint** il giro-gara e l'età-gomma crescono insieme: la pendenza osservata è
`ρ − γ_fuel`, e i due termini non si separano. Nessun effetto fisso di stint può salvarla.

L'identificazione arriva **fra stint**: stint diversi partono a giri diversi, quindi
`giro` ed `età` si desincronizzano. Con effetti fissi di **pilota** (mai di stint) e
livelli di compound, il coefficiente sul giro-gara è identificato dalla desincronizzazione
cross-stint.

**Confondimento residuo, dichiarato in anticipo e non risolvibile dalla sola cronometria
di gara**: l'evoluzione della pista (gommatura) è anch'essa una funzione del giro-gara e
ha lo **stesso segno** del carburante. Quindi la grandezza stimata è

```
γ̂ = γ_fuel + γ_evoluzione          (entrambi negativi)
Δ̂ = -γ̂·(N-1)   è un LIMITE SUPERIORE sul carburante, non una sua misura pura.
```

Questo non è un difetto scoperto dopo: è la conclusione dell'analisi di identificabilità,
scritta qui prima di eseguire. Il confronto col kernel va letto di conseguenza (§5).

## 3. Filtri (dichiarati, contati per gara)

| | filtro | motivo |
|---|---|---|
| F1 | `status == '1'` | solo verde puro: la decodifica committata, la più conservativa |
| F2 | `pin` e `pout` nulli | via in-lap e out-lap |
| F3 | `del == False` | giro cancellato dalla direzione gara |
| F4 | `time`, `lap`, `stint` numerici | |
| F5 | `lap >= 2` | via la partenza da fermo |
| F6 | età-gomma ricostruita `>= 3` | via out-lap e warm-in |
| F7 | `compound` slick | (metadato) via bagnato/intermedia |
| F8 | outlier: `time <= 1.07 × mediana(pilota,stint)` | soglia **conservata come metodo** dal progetto |
| F9 | **aria libera**: gap all'auto davanti sullo stesso giro `>= 2,0 s` (o nessuno davanti) | il traffico **decresce lungo la gara** e imiterebbe il carburante: filtro obbligatorio, non opzionale |
| G1 | gara scartata se un solo giro ha `wR == True` | pioggia |
| G2 | gara scartata se `corr(giro, età) > 0,95` nel campione | senza desincronizzazione non è identificata |
| G3 | gara scartata se il rango della design matrix < numero colonne | mai `pinv` silenziosa |
| G4 | gara scartata se < 150 giri validi o < 8 piloti o < 2 compound | potenza minima |

## 4. Stimatore (per gara — la gara è il BLOCCO)

```
time = α_pilota + δ_compound + γ·(giro − ḡiro) + Σ_c ρ_c · età · 1[compound=c] + ε
```

OLS, errori standard **cluster-robust** per (pilota, stint) con correzione small-sample.
Mai pooling fra gare: si stima **una γ per gara**, poi si aggrega sui blocchi.

Aggregazione per regime (**2023-25 e 2026 sempre separati**, mai a cavallo del confine
regolamentare): mediana cross-gara di Δ̂, IC95 per **bootstrap a blocchi** (ricampiona le
*gare*, 5000 repliche, percentili 2,5/97,5).

**Null di permutazione**: dentro ogni gara si permutano a caso gli *offset di stint*
(offset = giro − età, costante dentro lo stint) fra gli stint, tenendo ferme le età. Sotto
il null la desincronizzazione è finta e γ deve essere ≈ 0. 200 permutazioni per gara;
p = frazione di repliche del null con |Δ| ≥ |Δ̂| osservato.

**Out-of-sample**: gare ordinate per data; indici pari = calibrazione, dispari = verifica.
Δ̄ stimato sulla sola calibrazione, poi misurato l'errore assoluto mediano sulle gare di
verifica, confrontato con l'errore del valore del kernel. La stima non ha mai visto le
gare su cui è misurata.

**Robustezze dichiarate**: soglia aria libera 1,0 / 2,0 / 3,0 s; età da `life` invece che
ricostruita; senza livelli di compound; con età² .

## 5. Il cancello umano (B2) — regola scritta prima

Confronto per regime fra Δ̂ (IC95 sui blocchi) e Δ_kernel = 3,0·(N−1)/N.

- **UGUALE** ⟺ Δ_kernel cade **dentro** l'IC95 di Δ̂ del regime.
  Allora lo scheletro ha ritrovato il mattone dal fondo → si procede a B3.
- **DIVERSO** ⟺ Δ_kernel cade **fuori** dall'IC95.
  Allora **si ferma**: nessun numero nuovo viene montato, nessuna correzione proposta.
  Si porta al tavolo umano: vecchio, nuovo, intervalli, e **quali gare** divergono.

Asimmetria dichiarata in anticipo, conseguenza del §2: poiché Δ̂ è un **limite superiore**,
un Δ̂ **sotto** il kernel è la direzione informativa (il kernel starebbe correggendo più di
tutto lo scivolamento disponibile, evoluzione pista inclusa). Un Δ̂ sopra il kernel è
compatibile sia con un kernel giusto sia con un kernel basso: dice meno.

## 6. Cosa NON si fa in questa sessione

Non si monta niente. Il kernel di produzione non si tocca. Nessun push, nessuna PR.
