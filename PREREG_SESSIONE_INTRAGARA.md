# PREREG SESSIONE — CANCELLO INTRA-GARA (strato 1)

*Committata PRIMA di qualsiasi numero. Branch: claude/cancello-intragara. Data: 2026-07-16.*

## 0. La domanda (UNA, stretta)

**Nella stessa gara, il degrado marginale misurato nei primi 15 giri predice il degrado
marginale dell'ultimo terzo della gara meglio del prior storico (climatologia
archiviata)?**

Contesto: la climatologia (K2 STOP 39.9%, `REPORT_CLIMATOLOGIA.md`) ha misurato che il
passato non trasferisce al 2026 in modo circuito-uniforme. L'ipotesi candidata — incisa
in `data/BANDA_STATICA_APPRENDIMENTO_NOTA.md` §8 e mai misurata — è che la gara stessa
si predica meglio di qualunque archivio. Questo è il cancello: se nemmeno la gara
predice sé stessa, l'FP non salverà e lo strato 1 muore qui, a costo minimo.

- Solo dati intra-gara. **Nessuna FP** (fuel ignoto, programmi diversi: fuori scope).
- Questa sessione NON costruisce la banda live, NON tocca il gancio, NON attiva nulla:
  misura solo se il segnale esiste. La banda live è la sessione successiva, SOLO se il
  cancello apre.
- La parola "previsto" non compare in nessun artefatto: si confrontano due STIME
  (finestra iniziale vs prior archiviato) contro una MISURA (ultimo terzo), a gara
  finita, in replay.
- Kernel, modulo pit, gancio, golden, produzione: non toccati.

## 1. Fonti e campione

- **Primario (decide): le 9 gare 2026** (`data/ti_cache/*.json` + British da archivio)
  — il regime rilevante (gomme nuove, più piccole).
- **Secondario (non decide, replica di potenza): le gare 2025** dell'archivio TI, con
  prior costruito su 2023+2024 (pesi 2:1, stessa struttura leave-anno-fuori).
- Baseline da battere: `data/climatologia_degrado.csv` (versione archiviata
  leave-2026-out), colonna `banda_centrale_med`, SOLO righe INFORMATIVA — è ciò che la
  piattaforma userebbe davvero. Per il secondario 2025 il prior 2023-24 è ricalcolato
  con la stessa catena del generatore climatologia (stessa igiene, stessi quantili).
- Guardia gara-bagnata: identica alla climatologia (quota giri INT/WET > 5% → gara
  esclusa). Stesse trappole FastF1 non rilevanti (fonte TI).

## 2. Definizioni operative (identiche alla climatologia, finestre nuove)

Misura per stint = pendenza OLS del tempo **fuel-corretto (3/70)** su `life`, plateau
`life ≥ 3`, riferimento LOCALE allo stint. Igiene: verdi, no in/out-lap, slick,
`2 ≤ lap ≤ N−1`, outlier 1.07× mediana stint, ≥ 3 giri di plateau con ≥ 2 valori di
life distinti **dentro la finestra**.

- **Finestra di calibrazione ("primi 15"):** giri `2 ≤ lap ≤ 15`. Uno stint contribuisce
  con i suoi soli giri in finestra.
- **Finestra bersaglio ("ultimo terzo"):** giri `ceil(2N/3) ≤ lap ≤ N−1`.
- Uno stint lungo che attraversa entrambe le finestre contribuisce a entrambe con giri
  DISGIUNTI (è esattamente ciò che accadrebbe live; dichiarato).
- **Stima live** di (gara, mescola) = mediana delle pendenze-stint in calibrazione.
- **Misura bersaglio** di (gara, mescola) = mediana delle pendenze-stint nell'ultimo terzo.
- **Coppia testabile**: (gara, mescola) con ≥ 3 stint misurabili in calibrazione E ≥ 3
  nell'ultimo terzo E prior climatologico INFORMATIVA disponibile per (mescola, cid).
  Le coppie perse per ciascuna delle tre condizioni sono conteggiate e riportate.

## 3. KPI (congelato ORA)

Per ogni coppia testabile: `err_live = |bersaglio − stima_live|`,
`err_prior = |bersaglio − prior_centrale|`. Vittoria live se `err_live < err_prior`
(pareggio a 4 decimali = mezza vittoria).

**CANCELLO APERTO** (sul solo primario 2026) se ENTRAMBE:
- (a) vittorie live ≥ **60%** delle coppie testabili;
- (b) mediana di (`err_prior − err_live`) > 0 con **IC95 bootstrap a blocchi-gara**
  (B = 1000, seed = 20260716) che **non attraversa lo 0**.

**NULL** se una delle due cade. **NON TESTABILE** (nessun verdetto, dichiarato) se le
coppie testabili 2026 sono < **8**. Il secondario 2025 è riportato per esteso ma NON
decide: serve a leggere il primario (potenza, direzione), mai a ribaltarlo.

Nessuna soglia viene ritoccata dopo aver visto i numeri. Un NULL onesto chiude lo
strato 1 e si incide il perché.

## 4. Output

- `PREREG_SESSIONE_INTRAGARA.md` (questo file, prima dei numeri)
- `gen_cancello_intragara.py` (generatore committato, sola lettura; scrive SOLO
  `data/cancello_intragara.csv` + `data/CANCELLO_INTRAGARA_REPORT.txt`)
- `REPORT_CANCELLO_INTRAGARA.md` con in testa:
  "CANCELLO: [APERTO / NULL / NON TESTABILE] — vittorie X/Y (Z%), IC95 mediana
  differenza [a, b]" e il secondario 2025 per esteso.
- Golden verdi prima e dopo (449/449 py+js, 11/11 pit, hook banda-zero).
  Commit su claude/cancello-intragara, niente merge. Verdetto strategico: PO.
