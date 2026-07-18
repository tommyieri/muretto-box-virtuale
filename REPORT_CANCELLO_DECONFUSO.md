# REPORT — CANCELLO DE-CONFUSO (gamma a pari giro vs prior climatologico)

*Sessione 2026-07-16, branch claude/cancello-deconfuso. Protocollo:
`PREREG_SESSIONE_DECONFUSO.md` (committata prima dei numeri, commit bade791).
Generatore: `gen_cancello_deconfuso.py`; dettaglio: `data/CANCELLO_DECONFUSO_REPORT.txt`.*

## Esito (formato del mandato)

**CANCELLO: NULL — vittorie 3/9 (33%), IC95 [−0.0494, +0.0613]**

Stavolta il primario è testabile (9 coppie ≥ 8). Contro il KPI congelato (vittorie
≥ 60% E IC95 interamente sopra lo 0) l'esito è **NULL**: la stima de-confusa non
batte il prior climatologico. Secondario 2025: 9/18 (50%), IC95 [−0.0185, +0.0147] —
un pareggio, coerente col primario.

## I tre fatti che il NULL contiene (letti senza forzarlo)

**1. La de-confusione FUNZIONA come stimatore.** Diagnostica sulle 22 coppie comuni
con lo strato 1: il de-confuso batte il grezzo **15/22**, e gli sbagli catastrofici
del grezzo spariscono (Australia 0.201→0.012, Canada 0.228→0.039, Baku 0.270→0.127).
L'errore mediano 2026 passa da 0.0795 (grezzo) a **0.0260 ≈ 0.0280 (prior)**. La
diagnosi dello strato 1 era giusta: era l'evoluzione-pista, e il modello a pari giro
la toglie davvero.

**2. Ma "buono quanto il prior" non è "meglio del prior"** — e il KPI chiedeva
meglio. A parità di errore mediano, le vittorie restano 3/9 perché dove il prior è
già buono (Monaco, Australia, Austria) il live perde di poco, e i suoi rari sbagli
grossi pesano (Cina 2026: γ̂ = −0.13 con IC [−0.21, −0.05] contro bersaglio +0.19 —
confidentemente sbagliato, da capire prima di qualunque uso).

**3. Il live vince esattamente dove il prior sbaglia di più.** Barcellona 2026 — la
gara peggiore del K2 climatologico (22.6%) — live err 0.016 vs prior 0.077 (HARD) e
0.031 vs 0.098 (MEDIUM). Canada (K2 12.5%): live 0.039 vs 0.082. Le due fonti
sbagliano in posti **diversi e quasi complementari**: il prior dove le gomme 2026
hanno cambiato il circuito, il live dove la prima metà di gara è anomala rispetto
alla coda.

## Cosa NON si conclude

- Non si conclude "il live è inutile": è dimostrato che, da solo, non batte il prior
  (KPI onorato). La complementarità osservata (fatto 3) suggerisce una domanda NUOVA
  — prior come base + live come correzione quando i due divergono oltre soglia — ma
  è un TERZO stimatore, con prereg nuova e col rischio dichiarato di star inseguendo
  il rumore dopo tre sguardi allo stesso bersaglio. Se si apre, servono soglie più
  severe o dati nuovi (le gare 2026 che arrivano). Decisione: PO.
- Nessuna banda live è stata costruita; il gancio v1.5 resta a banda-zero.

## Numeri di contesto

- Coppie perse 2026: live_non_id = 7 (guardrail ≥3 stint / ≥30 giri / rango in
  finestra), target<3 = 7, prior assente = 10.
- Stimatore: modello FE lin+log validato (base pilota-gara, evoluzione condivisa,
  SE cluster-robust), ristretto a `2 ≤ lap ≤ N/2`; unico passo nuovo il
  filtro-finestra. Bersaglio e H2H identici allo strato 1 (riuso via import).
- Bootstrap blocchi-gara B=1000, seed 20260716; guardia gara-bagnata invariata.

## Golden (prima e dopo)

`test_b.py` 449/449 · `test_b.mjs` 449/449 · `demo/test_pit.mjs` 11/11 ·
`test_degrado_hook.mjs` banda-zero bit-identica — verdi prima e dopo; solo file
nuovi. Kernel, pit, gancio, produzione: non toccati. Verdetto strategico: PO.
