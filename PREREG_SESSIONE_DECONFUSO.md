# PREREG SESSIONE — CANCELLO DE-CONFUSO (differenza tra mescole a pari giro)

*Committata PRIMA di qualsiasi numero. Branch: claude/cancello-deconfuso. Data: 2026-07-16.*

## 0. La domanda (UNA, stretta) e perché è NUOVA

**Una stima live DE-CONFUSA del degrado — γ per mescola dal modello congiunto a pari
giro, con evoluzione-pista CONDIVISA tra le mescole — stimata sulla prima metà di gara,
predice il degrado marginale dell'ultimo terzo meglio del prior climatologico?**

Il cancello intra-gara (NON TESTABILE, direzione contraria — `REPORT_CANCELLO_INTRAGARA.md`)
ha mostrato che la pendenza GREZZA dei primi 15 giri misura degrado−evoluzione, con
l'evoluzione front-loaded che domina. Questa è la riformulazione de-confusa già indicata
lì come domanda nuova: **non un ridisegno di quel test** (stimatore diverso, finestra
diversa, dichiarati qui prima dei numeri), e il suo esito non riabilita né aggrava
quello — risponde alla propria domanda.

Terzo sguardo sullo stesso bersaglio (dopo climatologia e strato 1): lo si dichiara,
ed è il motivo per cui il KPI esige ANCHE l'IC95 interamente sopra lo zero, non solo
la quota di vittorie.

- Solo dati intra-gara; nessuna FP; nessuna banda live costruita; il gancio non si
  tocca e resta a banda-zero. "Previsto" non compare in alcun artefatto.
- Kernel, modulo pit, golden, produzione: non toccati.

## 1. Lo stimatore live (riuso, non reinvenzione)

γ̂_c per mescola dal **modello FE già validato** (Fase 2.1-bis, adottato lin+log):
`t_fc = α(pilota) + δ_compound + β_lin·(giro−media) + β_log·ln(giro) + γ_c·life`,
base per (pilota, gara), SE cluster-robust per (pilota, stint) — **ristretto ai giri
della finestra di calibrazione**. È il confronto "a pari giro" formalizzato:
l'evoluzione f(giro) è condivisa tra le mescole e quindi si cancella dal confronto;
il differenziale-pari-giro puro ne fu la controprova concordante (DEGRADO_NOTA).
Catena importata da `test_identificabilita_degrado` / `test_forma_fgiro` (una sola
definizione di filtri, guardrail, forma): l'unico passo nuovo è il filtro-finestra
sui giri, applicato tra F7 e `prepara`.

- Guardrail IMPORTATI, applicati DENTRO la finestra: compound identificabile se
  ≥ 3 stint e ≥ 30 giri; controllo di rango esplicito. Compound non identificabile
  → coppia persa, conteggiata come `live_non_id` (nessun ripiego sul grezzo).
- Nota fuel dichiarata: il fit FE usa la sua convenzione (0.03 s/kg × 70, lineare nel
  giro) — assorbita da f(giro), irrilevante per γ (già inciso in DEGRADO_NOTA §fuel).

## 2. Finestre (dichiarate ORA, con motivazione a priori)

- **Calibrazione: giri `2 ≤ lap ≤ floor(N/2)`** (prima metà). Motivo strutturale: il
  confronto a pari giro si identifica con gli stint SFALSATI, che nascono coi primi
  pit (~giro 12-25); la finestra 2-15 dello strato 1 lo affama per costruzione (l'arco
  pari-giro 2026 misurò zero coppie SOFT/MEDIUM proprio per questo). Utilità live: la
  decisione che il gancio serve è il pit di metà gara — la stima chiude PRIMA.
- **Bersaglio: giri `ceil(2N/3) ≤ lap ≤ N−1`** (ultimo terzo), identico ai cancelli
  precedenti: mediana per (gara, mescola) delle pendenze-stint sul plateau
  (fuel-corretto 3/70, riferimento locale, life ≥ 3, ≥ 3 stint) — riuso da
  `gen_cancello_intragara`. Buffer stima→bersaglio ≥ N/6 giri per costruzione.
- Igiene identica ai cancelli precedenti (verdi, no in/out, slick, 2 ≤ lap ≤ N−1,
  outlier 1.07×, guardia gara-bagnata quota INT/WET > 5%).

## 3. Campione, baseline, KPI (congelati ORA)

- **Primario (decide): 9 gare 2026.** Secondario (non decide, orienta): gare 2025 con
  prior 2023-24 (pesi 2:1), stessa catena della climatologia.
- **Baseline: `data/climatologia_degrado.csv`** (archiviato leave-2026-out), colonna
  `banda_centrale_med`, solo righe INFORMATIVA.
- **Coppia testabile**: (gara, mescola) con γ̂_c identificabile in calibrazione E
  bersaglio misurabile (≥3 stint) E prior INFORMATIVA. Perse conteggiate per causa
  (`live_non_id`, `target<3`, `prior_assente`, `gara_bagnata`).
- `err_live = |bersaglio − γ̂_c|`, `err_prior = |bersaglio − prior_centrale|`;
  vittoria live se `err_live < err_prior` (pari a 4 decimali = mezza vittoria).
- **CANCELLO APERTO** se ENTRAMBE (solo primario 2026): (a) vittorie ≥ **60%**;
  (b) mediana(err_prior − err_live) > 0 con **IC95 bootstrap blocchi-gara**
  (B=1000, seed=20260716) interamente sopra lo 0. **NULL** se una cade.
  **NON TESTABILE** se coppie < **8**. Nessuna soglia si ritocca a numeri visti.
- **Diagnostica (non decide)**: sulle coppie sovrapposte con `data/cancello_intragara.csv`,
  confronto err de-confuso vs err grezzo dello strato 1 — dice se la de-confusione
  aiuta, anche a cancello chiuso.

## 4. Output

- `PREREG_SESSIONE_DECONFUSO.md` (questo file, prima dei numeri)
- `gen_cancello_deconfuso.py` (sola lettura; scrive SOLO `data/cancello_deconfuso.csv`
  + `data/CANCELLO_DECONFUSO_REPORT.txt`)
- `REPORT_CANCELLO_DECONFUSO.md` con in testa:
  "CANCELLO: [APERTO / NULL / NON TESTABILE] — vittorie X/Y (Z%), IC95 [a, b]"
  + secondario e diagnostica per esteso.
- Golden verdi prima e dopo (449/449 py+js, 11/11 pit, hook banda-zero).
  Commit su claude/cancello-deconfuso, niente merge. Verdetto strategico: PO.
