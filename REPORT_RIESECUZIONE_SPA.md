# REPORT — RIESECUZIONE POST-SPA DEI 5 CANCELLI DEGRADO (TODO voce 7)

*Sessione 2026-07-20, branch claude/riesecuzione-cancelli-spa. Spa 2026 (44 giri,
SC-dominata ma ASCIUTTA: quota INT/WET 0%, passa la guardia gara-bagnata; 41 stint
qualificati) è la 10a gara 2026 nel campione. KPI INTATTI: nessuna soglia, finestra o
definizione toccata — unica modifica ai generatori: l'aggiunta di Belgian 2026 alle
liste-gare. Ordine di esecuzione dichiarato: prima i 4 cancelli col baseline ancora
nella versione archiviata leave-2026-out (come da loro prereg), poi la climatologia.*

## Esiti (prima → dopo Spa)

| cancello | prima | dopo Spa |
|---|---|---|
| **K2 climatologia** | STOP 39.9% | **TRASFERIBILE 42.3%** (IC95 [30.8%, 52.9%]) |
| intra-gara | NON TESTABILE 2/7 | NON TESTABILE 2/7 (invariato) |
| de-confuso | NULL 3/9 | NULL 3/9 (invariato) |
| adattamento | NULL 8/14 (57%) | NULL 8/16 (50%, indebolito) |
| combinazione | NULL 14/27 | NULL 14/27 (invariato) |

**L'unico verdetto che cambia è K2.** Spa copre al 61.0% (41 stint, sopra il nominale
~50%): il pooled sale da 39.9% a 42.3% e supera la soglia congelata del 40%. La soglia
è stata onorata al ribasso il 16/07 (STOP a 39.9) e va onorata al rialzo oggi,
simmetricamente: **TRASFERIBILE**. I quattro cancelli live/adattamento restano chiusi:
Spa, corta e SC-dominata, non aggiunge coppie alle loro finestre (calibrazione
affamata dai giri SC; il de-confuso perde Spa per live_non_id/target<3) e
all'adattamento aggiunge due coppie che lo indeboliscono.

## Conseguenze sulla climatologia (percorso della sua prereg, ripreso)

- CSV rigenerato **con il 2026 dentro** (peso 1.0, `include_2026=True`), auto-verifica
  writer pulita. **K1: 48/61 informative** (era 42/61). Spa entra con le sue tre
  mescole (es. MEDIUM [+0.036, +0.095, +0.142], n=65).
- **K3: 1 VIOLAZIONE, elencata senza correzioni silenziose**: `SOFT@monaco` centrale
  **−0.3827** fuori da [−0.10, +0.35] — banda [−0.70, −0.38, −0.02], n=23, quota-2026
  90%. Diagnosi: è la coda-traffico di Monaco 2026 (gara già incisa come
  "coda-traffico" nell'arco pit-loss) che entra nella pendenza come falso
  "anti-degrado". La sanità fisica fa il suo mestiere: quella riga NON è usabile come
  banda; il suo trattamento (esclusione, cap, o filtro-traffico dedicato) è decisione
  PO, non applicata qui.
- **K4 meccanico: PASS anche con le bande nuove** — Austria VER fz30→pit34, ampiezza
  2.606 s, distinguibili+plausibili, **banda-zero bit-identica**.

## Lettura onesta (senza gonfiare né sgonfiare)

- Il sorpasso di soglia è di **2.3 punti su una gara sola** e l'IC95 [30.8%, 52.9%]
  resta largo. L'eterogeneità per-circuito NON è sparita: Barcellona 22.6%, Canada
  12.5%, Monaco 26.7% contro Suzuka 69% e Spa 61%. Il fatto strutturale dell'arco
  (le gomme 2026 spostano per-circuito) resta vero; con dieci gare il "pool" delle
  gare che trasferiscono pesa di più di quello delle gare che non trasferiscono.
- **TRASFERIBILE ≠ attivazione.** Il verdetto meccanico riapre il percorso della
  prereg climatologia (bande nel CSV, gancio alimentabile con tre scenari etichettati
  come scenari); l'attivazione in demo/produzione è verdetto strategico del PO, con
  la violazione K3 da sciogliere prima e con la fragilità qui sopra sul tavolo.
- Nota tecnica per riesecuzioni future dei cancelli: il CSV su disco ora include il
  2026; il loro baseline leave-2026-out resta ricostruibile (git f12e756, o
  rigenerabile filtrando `include_2026`). I 4 CSV dei cancelli committati qui sono
  stati scritti PRIMA della rigenerazione del CSV climatologia, come da loro prereg.

## ADDENDUM — Passo 0: Monaco fuori (ratifica PO 2026-07-20)

Decisione PO, motivazione dichiarata: **a Monaco il passo NON è governato dal degrado
ma dalla track-position** — chi sta davanti detta il ritmo (spesso frenando apposta),
quindi la pendenza-life misura traffico, non gomma. Regola incisa nel generatore
(`CID_NO_DEGRADO = ('monaco',)`): Monaco escluso da climatologia, K2, K3 e bande; lì il
gancio resta banda-zero **per sempre** e la strategia è dominio del modulo
pit/track-position. Tre segnali indipendenti già la indicavano: K2 Monaco 26.7% (la
peggiore), K3 `SOFT@monaco` −0.38 (coda-traffico), arco pit-loss (Monaco già inciso
"coda-traffico").

Effetto sulla climatologia (CSV rigenerato, prodotto, `include_2026=True`):
- stint qualificati 2950 → **2834** (75 stint Monaco rimossi); CSV 61 → **58 righe**.
- **K2: 42.3% → 43.7% TRASFERIBILE** (IC95 [32.2%, 55.6%]); rimuovere la gara peggiore
  rafforza il pooled, come atteso.
- **K3: 1 violazione → PASSA** (zero): la violazione era proprio `SOFT@monaco`.
- **K1: 46/58 informative**; **K4 meccanico: PASS** (Austria, banda-zero bit-identica).

Nota di scopo: i 4 CSV dei cancelli (chiusi, NULL) NON sono ri-eseguiti qui — leggerebbero
il CSV ora 2026-inclusivo e diventerebbero circolari. Restano archiviati col baseline
leave-2026-out. La regola Monaco vive comunque nei loro generatori (via import) per
qualunque rieseczione futura legittima, che dovrà ricostruire il baseline leave-2026-out.

## Golden (prima e dopo)

`test_b.py` 449/449 · `test_b.mjs` 449/449 · `demo/test_pit.mjs` 11/11 ·
`test_degrado_hook.mjs` banda-zero bit-identica · `check_banda_gancio.mjs` PASS.
Kernel, modulo pit, gancio, golden, produzione: non toccati.
