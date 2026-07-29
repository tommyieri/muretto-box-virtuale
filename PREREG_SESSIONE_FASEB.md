# PREREG SESSIONE — FASE B: la magnitudine corretta della proiezione di degrado

*Committata PRIMA dei numeri. Branch: claude/fase-b-magnitudine. Data: 2026-07-20.*
*Da PIANO_DEGRADO_LIVE.md, dopo la scoperta di Fase A (REPORT_FASE_A.md).*

## 0. La domanda (UNA, stretta) e cosa NON è

Fase A ha trovato che il gancio congelato somma `rate·(età_gomma−1)` — il degrado
ASSOLUTO-DA-NUOVO — sopra `pace_base`, che è la **mediana di stint** (già degradata):
doppio conteggio. Domanda di Fase B:

**Qual è l'incremento di degrado da aggiungere a `pace_base` per proiettare il passo
sui prossimi giri, tale che la proiezione riproduca il passo OSSERVATO (senza bias),
meglio della forma attuale del gancio?**

- **NON è una riapertura del degrado-predizione** (arco chiuso, resta chiuso): la BANDA
  è quella climatologica già TRASFERIBILE (K2 43.7%). Qui si valida solo COME la si
  applica — questione di magnitudine meccanica, non di prevedibilità.
- **NON tocca il gancio** (congelato, K4-validato): le correzioni candidate sono tutte
  realizzabili come ADAPTER al call-site (§3), lasciando il gancio byte-identico e il
  golden banda-zero bit-identico.
- Solo REPLAY sull'archivio 2026 (Monaco escluso). Nessun live, nessuna attivazione.
  La parola "previsto" non compare. Un NULL onesto è un esito ammesso.

## 1. La diagnosi da confermare (empirica, non decide)

`pace_base` (engine.py) = mediana fuel-corretta (3/70) dei giri del **segmento di stint
corrente** fino al freeze (verdi, non neutralizzati, no in/out-lap, ≥3 giri). Se il tempo
fuel-corretto è ~lineare in `life`, la mediana corrisponde a **`A₀` = mediana(life) del
segmento**. Da riportare (descrittivo): distribuzione di `A₀` sui casi, e la
sovrastima implicata del gancio attuale `rate·(A₀−1)`. Non decide: orienta la lettura.

## 2. Osservabile e igiene

Per un caso (pilota, stint, freeze L) con `pace_base` definita e mescola con banda
climatologica INFORMATIVA per il circuito:

- **residuo osservato al giro futuro** di età A (A = life a quel giro):
  `res_oss(A) = tempo_fuel_corretto(A) − pace_base`  (entrambi 3/70, riferimento locale).
  È esattamente ciò che la penalità di degrado deve riprodurre.
- **orizzonte**: i primi **K = 6** giri VERDI successivi al freeze, nello **stesso stint**
  (prima del pit reale del pilota), non neutralizzati, no in/out-lap, `lap ≤ N−1`.
- Igiene identica all'arco: verdi status=='1', slick, outlier 1.07× mediana stint,
  Monaco escluso (CID_NO_DEGRADO), gara-bagnata esclusa (quota INT/WET>5%). SC/VSC: i
  giri neutralizzati escono (il degrado è sospeso lì, come da mandato).
- `rate` = `banda_centrale_med` del CSV climatologia per (mescola, circuito). Casi senza
  banda informativa: esclusi (conteggiati).

## 3. Modelli candidati (incremento di degrado su `pace_base`, all'età A)

Tutti realizzabili SENZA toccare il gancio: la penalità del gancio al passo s è
`rate·max(0, tyreAge0 + s − 1)`. Passando un `tyreAge0'` reinterpretato si ottiene la
forma voluta (adapter dichiarato, dimostrato qui):

- **M0 — gancio attuale (BASELINE DA BATTERE)**: `+ rate·(A − 1)`.
  (`tyreAge0' = tyreAge0`, invariato.) Atteso: **bias positivo** (doppio conteggio).
- **M1 — incremento dal riferimento di pace_base**: `+ rate·(A − A₀)`,
  `A₀ = mediana(life)` del segmento pace_base. Adapter: `tyreAge0' = tyreAge0 − A₀ + 1`.
  Fisicamente corretto se `pace_base ≈` passo all'età `A₀` e il degrado è lineare.
- **M2 — incremento dall'età corrente**: `+ rate·(A − A_cur)` (0 al freeze),
  `A_cur` = età al freeze. Adapter: `tyreAge0' = 1`. Ancora al passo CORRENTE (assume
  `pace_base` = passo attuale, non media): atteso **bias negativo** (sottostima, perché
  il passo attuale è già sotto pace_base).

A banda-zero (rate=0) tutti danno penalità 0: **golden banda-zero resta bit-identico**
per ogni modello (verifica dovuta).

## 4. KPI (congelato ORA — decide M1/M2 vs M0)

Su tutte le coppie (caso, giro-futuro) testabili, `err_M = res_predetto_M − res_oss`.
Blocchi = gare 2026; bootstrap B=1000, seed=20260720.

- **BIAS(M)** = mediana(err_M) [segno]. È il rivelatore del doppio conteggio.
- **MAE(M)** = mediana(|err_M|) [dispersione].

Un modello correttivo **Mx ∈ {M1, M2} è ADOTTATO** se TUTTE:
- (a) `|BIAS(Mx)|` < `|BIAS(M0)|` con **IC95 bootstrap di BIAS non sovrapposti** tra Mx e M0;
- (b) `MAE(Mx) ≤ MAE(M0)` (non peggiora la dispersione);
- (c) `BIAS(Mx)` **quasi-nullo**: IC95 include 0, oppure `|BIAS(Mx)| ≤ 0.03` s/giro.

Se **entrambi** M1 e M2 qualificano → si adotta quello con `|BIAS|` minore (pareggio:
MAE minore). Se **nessuno** qualifica → **NULL**: la correzione candidata non è
supportata dal replay (o la banda-lineare non proietta bene); gli scenari restano
dormienti e si riapre il disegno col PO.

**NON TESTABILE** se le coppie testabili < **30** o le gare con casi < **4**.

Nessuna soglia si ritocca a numeri visti.

## 5. Se un modello vince (dichiarato ora, per non decidere dopo)

La correzione entra come **adapter al call-site** (`pitbande.mjs` / demo), NON nel gancio:
si passa `tyreAge0'` secondo §3. Il gancio resta congelato e byte-identico; il golden
banda-zero resta bit-identico. L'accensione degli scenari (`SCENARI_ATTIVI`) resta
decisione del PO, ora con la magnitudine validata. Poi si affronta la seconda metà di
Fase B originale (copertura-rolling della banda aggiornata coi giri già corsi) come
domanda successiva con prereg propria — solo se questa magnitudine passa.

## 6. Output

- `PREREG_SESSIONE_FASEB.md` (questo file, prima dei numeri)
- `gen_faseb_magnitudine.py` (sola lettura su archivio 2026 + CSV climatologia; scrive
  SOLO `data/faseb_magnitudine.csv` + `data/FASEB_MAGNITUDINE_REPORT.txt`)
- `REPORT_FASEB.md` con in testa:
  "MAGNITUDINE: [M1 / M2 / M0-resta / NULL / NON TESTABILE] — BIAS M0 vs Mx (IC95), MAE,
  n coppie/gare" + la conferma diagnosi (A₀, sovrastima implicata).
- Golden verdi prima e dopo (449/449 py+js, 11/11 pit, hook banda-zero, K4).
  Commit su claude/fase-b-magnitudine, niente merge. Verdetto strategico: PO.
