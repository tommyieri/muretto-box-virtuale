# PREREG — esperimento decisivo su δ (carburante)

**Scritta il 2026-07-29, PRIMA di eseguire l'esperimento e prima di guardare un
solo numero di esito.** Regola 3: le metriche si scrivono prima. Un cancello
sbagliato si mette a referto e se ne pre-registra uno nuovo; non si riscrive
dopo aver visto il risultato.

## Il conflitto ereditato (E21)

Due misure di δ — il carburante totale, in **secondi su 70 kg** — convivono da
mesi con intervalli di confidenza **disgiunti**:

| fonte | δ₇₀ | IC95 |
|---|---|---|
| storico / kernel pre-2026 | 3,111 | [2,926; 3,254] |
| 2026, implicato dal comportamento del motore | 2,468 | [1,693; 2,908] |

E21 dice che due misure in conflitto non si lasciano convivere e non si sceglie
in silenzio: si pre-registra un esperimento decisivo. Questo è quell'esperimento.

## Convenzione di δ (ereditata, non in discussione qui)

Il carburante a bordo al giro ℓ di una gara di N giri è `70 − (70/N)·(ℓ−1)` kg,
e pesa `δ₇₀/70` secondi al kg. Quindi nella forma di CLAUDE.md
`t = base + δ·(giro−1) + ρ·età` vale

    δ (s/giro) = − δ₇₀ / N_giri_gara

δ è **negativo**: la macchina si alleggerisce e va più forte. δ₇₀ è positivo.

## Domanda

Quale valore di δ₇₀ produce il bias più piccolo quando il kernel proietta gare
2026 vere?

## Banco

- **Solo 2026**: le 11 gare della baseline di ricostruzione
  (`banco/golden/ricostruzione_2026.json`). Nessun pooling con altre stagioni.
- **Congelamenti** Lf ∈ {20, 30}; **orizzonti** H ∈ {5, 10, 20}.
- Una terna (gara, Lf, H) entra se `Lf + H ≤ N_giri` di quella gara.
- Un orizzonte si giudica solo se lo alimentano **≥ 5 gare**; sotto quella
  soglia si riporta "insufficiente" e non si usa per decidere.

## Bracci (l'unica cosa che cambia è δ₇₀)

| braccio | δ₇₀ |
|---|---|
| **A** | 2,2 — fondo 2026 |
| **B** | 3,0 — il valore cablato nel vecchio kernel |
| **C** | stimato libero sul 2026, **leave-one-race-out**: per la gara *r* si usa il δ₇₀ stimato escludendo *r* |

ρ è **lo stesso in tutti e tre i bracci**: la stima del passo 1 di questa
sessione. Se ρ variasse per braccio, non staremmo misurando δ.

Il leave-one-race-out serve a togliere al braccio C il vantaggio di essere
stimato sugli stessi giri su cui viene giudicato.

## Come si predice (regola 10, contro E02 ed E20)

Al congelamento Lf, per ogni pilota:

1. **base** = mediana, sui giri verdi con ℓ ≤ Lf, di `t − δ·(ℓ−1) − ρ·età(ℓ)`.
   La base si misura togliendo GLI STESSI termini che la simulazione
   ri-aggiungerà: è la regola 10. Il vecchio motore prendeva la mediana grezza
   dello stint (gomma 9,15 giri più giovane dei giri simulati) e portava
   −0,403 s/giro di bias solo per questo; più −1,480 s/giro di carburante
   sottratto e mai ri-aggiunto (E02).
2. Si proietta con `engine/kernel.mjs` — nessuna sosta nella finestra, vedi
   sotto — e `pace = base + δ·(giro−1) + ρ·età`, con l'età che avanza di uno
   per giro.

Il passo del kernel è l'unica implementazione dell'equazione (regola 8): la
stima Python produce solo i coefficienti in JSON con targhetta.

## Chi entra nel campione

Una coppia (pilota, finestra) entra se **tutte** queste valgono:

- il pilota ha **≥ 8 giri verdi** con ℓ ≤ Lf (base stimabile);
- ha una cella al giro esattamente Lf con `cum_time` non nullo;
- **tutti** i giri della finestra (Lf, Lf+H] esistono e sono **verdi** secondo
  `provenienza/definizioni.mjs`.

L'ultima condizione esclude soste, neutralizzazioni e giri cancellati dalla
finestra: si misura l'errore del **tempo sul giro**, non il pit-loss né la
capacità di indovinare una Safety Car. Di conseguenza `pits` è vuoto: il
confronto non dipende da nessun prior di perdita ai box.

Una gara entra a un dato (Lf, H) se ha **≥ 5 piloti** ammessi.

## Metrica (dichiarata prima)

Per pilota: `residuo = (cum_predetto(Lf+H) − cum_reale(Lf+H)) / H`, in s/giro.
Segno negativo = il kernel predice **più veloce** del reale (il verso
dell'errore storico).

- `bias(gara, Lf, H)` = media dei residui dei piloti ammessi;
- `bias(H)` = **mediana fra le gare** dei `bias(gara, Lf, H)` — appaiata: i tre
  bracci vedono esattamente le stesse gare, gli stessi Lf, gli stessi piloti e
  gli stessi giri;
- la grandezza che ordina i bracci è **|bias(H)|**.

## Regola di decisione (dichiarata prima)

1. Vince il braccio con **|bias(H)| più piccolo in almeno 2 dei 3 orizzonti**
   giudicabili.
2. Se nessuno vince 2 orizzonti, vince quello col **max|bias(H)| più piccolo**
   sugli orizzonti giudicabili.
3. Se due bracci restano entro **0,02 s/giro** su tutti gli orizzonti,
   l'esperimento è dichiarato **non decisivo**: nessun δ viene cablato, il
   conflitto resta aperto a referto e si pre-registra un banco più potente.

Il vincitore va in `data/modelli/modello_v2.json`. **Il perdente resta a
referto con targhetta**, nel report dell'esperimento: non si cancella una
misura perché ha perso.

## Cancello di sanità del modello (dichiarato prima)

Indipendente dalla gara fra i bracci — è l'asticella del vecchio v2:

- **|bias(H)| ≤ 0,17 s/giro** a ogni orizzonte giudicabile;
- **piatto**: `max|bias(H)| − min|bias(H)| ≤ 0,10` s/giro fra gli orizzonti.

Se il vincitore non passa questo cancello, si dichiara il fallimento e si
riporta il numero vero: non si allarga l'asticella dopo averla vista (E08).

## Cosa renderebbe questo esperimento non informativo

- Meno di 5 gare per orizzonte (già coperto: si dichiara "insufficiente").
- Un ρ con IC che contiene lo zero al passo 1: allora la base e la proiezione
  poggiano su un degrado non identificato, e il confronto fra δ misura rumore.
  In quel caso l'esperimento si riporta come **non interpretabile**.
