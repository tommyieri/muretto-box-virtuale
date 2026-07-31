# PREREG — G5, il cancello causale del calibratore live

**Scritta il 2026-07-29, PRIMA di eseguire il calibratore su una sola gara e
prima di guardare qualunque numero di esito.** Regola 3.

## La domanda

Il moltiplicatore di degrado live — aggiornato usando SOLO i giri ≤ Lf — rende
la previsione del passo **sul resto della stessa gara** migliore del prior
statico (moltiplicatore = 1)?

È un cancello **causale**: il calibratore vede solo il passato del
congelamento, la verifica avviene solo sul futuro. Se il moltiplicatore non
batte il prior statico qui, non ha diritto di toccare i percorsi decisionali
live: resta esposto come diagnostica, con targhetta, finché un banco più
potente non lo promuove.

## Il moltiplicatore (definizione, fissata prima)

Per ogni stint con ≥ 4 giri utilizzabili (verdi, con tempo ed età) entro Lf:

- si corregge il carburante col δ del modello: `t_corr = t − deriva·(giro−1)`,
  `deriva = −δ₇₀/N` — lo STESSO δ del modello v2, non un'altra stima;
- pendenza OLS di `t_corr` su `età` → `b`, con `n` punti e `R²`;
- peso dello stint: `w = n·R²`.

Il moltiplicatore parte dal prior (1,0) e viene aggiornato per stint in ordine
cronologico (giro di fine stint) con EMA:
`m ← m + α_i·(b/ρ − m)`, `α_i = α·w/(w + K)`, con `α = 0,3` e `K = 60`
dichiarati. Clamp finale a **[0,3; 3,0]**, con flag `clampato` nel risultato.

**Regola del §4 ereditata**: la durata di uno stint è una DECISIONE dei team,
non una misura. Le mediane storiche (SOFT 14 · MEDIUM 19 · HARD 22) entrano
SOLO come allarme: se, con ≥ 3 stint chiusi di una mescola entro Lf, la mediana
osservata è ≤ 0,6 della storica, scatta `allarme_stint` — che ALZA il peso del
vivo (`α` da 0,3 a 0,5) e ALLARGA la banda (×1,5), dichiarandolo nel
risultato. MAI una stima di durata.

Se non esiste nessuno stint utilizzabile, il moltiplicatore è **null** con
motivo (regola 6): il consumatore usa il prior statico e lo dichiara.

## Banco

- Le 11 gare 2026 rigiocate dal grezzo pinnato, via il percorso LIVE
  (feed d'archivio → collettore → calibratore), status per-auto.
- Congelamenti **Lf ∈ {15, 25, 35}**.
- Una gara entra a un dato Lf se ha **≥ 30 giri bersaglio** (giri > Lf,
  verdi, con tempo ed età, di piloti con base stimabile su ≥ 8 giri ≤ Lf).
- Un congelamento è **giudicabile** con ≥ 5 gare.

## Bracci (appaiati: stessi giri bersaglio, stessa base per braccio)

| braccio | ρ effettivo |
|---|---|
| **STATICO** | ρ del modello (moltiplicatore 1) |
| **LIVE** | ρ · m(Lf), col moltiplicatore calibrato sui soli giri ≤ Lf |

Per OGNI braccio la base del pilota si stima con `stimaBasi` usando il ρ
effettivo di quel braccio (regola 10: si sottrae ciò che si ri-aggiunge; dare
al braccio live una base stimata col ρ statico gli imputerebbe un errore non
suo). La previsione usa `creaPasso` — l'unica implementazione dell'equazione.
Se il moltiplicatore è null, il braccio live usa 1 e il caso è marcato.

## Metrica (fissata prima)

Per (gara, Lf): **MAE** = media di `|t̂ − t|` sui giri bersaglio, in secondi.
`Δ(gara, Lf) = MAE_live − MAE_statico` (negativo = il live migliora).

Per congelamento: **mediana fra le gare di Δ**.

## Regola di decisione (fissata prima)

1. Il live **vince un congelamento** se la mediana di Δ è < 0.
2. **G5 passa** se il live vince **almeno 2 dei congelamenti giudicabili** (e
   i giudicabili sono almeno 2).
3. Se G5 non passa: il moltiplicatore NON entra nei percorsi decisionali;
   resta calcolato e mostrato come diagnostica con targhetta "non ha superato
   G5". L'esito resta a referto comunque — non si rigioca finché non cambia
   il calibratore, e in quel caso si ri-esegue TUTTO G5, non il pezzo comodo.

## Condizioni di invalidità (fissate prima)

- Meno di 2 congelamenti giudicabili → G5 **non eseguibile**, a referto.
- La sentinella di troncamento sul calibratore (registro di
  `banco/misure_congelamento.mjs`, sentinella s14) deve essere verde: un
  calibratore che sbircia oltre Lf renderebbe G5 un imbroglio, non un cancello.
