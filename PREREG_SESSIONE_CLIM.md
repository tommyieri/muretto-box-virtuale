# PREREG SESSIONE — CLIMATOLOGIA DEL DEGRADO (statistica descrittiva)

*Committata PRIMA di qualsiasi numero. Branch: climatologia-degrado. Data: 2026-07-16.*

## 0. Che cosa è e che cosa NON è

Statistica **descrittiva**: la distribuzione di ciò che il degrado marginale **È STATO**,
per (mescola, circuito), pesata verso il 2026, per alimentare il gancio v1.5 con tre
scenari **etichettati come scenari** (ottimistico / centrale / pessimistico).

- **NON è una riapertura del degrado-predizione** (chiuso con NULL robusto, resta chiuso:
  nessun γ=f(circuito,compound) come parametro fisico universale, nessuna stabilità
  cross-anno rivendicata).
- La parola **"previsto" non compare mai** in nessun artefatto di questa sessione.
- Nessun verdetto strategico: è del PO. Se K2 dà STOP o K4 dà scenari indistinguibili,
  si scrive senza attenuazioni, il gancio resta a banda-zero e la climatologia si
  archivia con la sua nota.
- Kernel, modulo pit, gancio degrado (viene CHIAMATO, mai modificato), golden e file di
  produzione: **non toccati**.

## 1. Fonti dichiarate

1. **Archivio TI 2023–2025** — `data/ti_archive/{2023,2024,2025}/<GP>/Race.json`
   (24 gare/anno, campi drv/lap/time/life/stint/compound/status/pin/pout/sesT).
2. **TI 2026** — `data/ti_cache/*.json` (8 gare) + `data/ti_archive/2026/British Grand
   Prix/Race.json` = 9 gare 2026. Canada 2026 Race: partenza su pista umida (drycheck);
   entra SOLO per i giri slick/verdi sopravvissuti all'igiene — il bagnato è regime
   separato e non si mescola mai.
3. **FastF1 2018–2022 dalla cache locale** (`~/muretto_shared/ff1_cache`, nessun
   download nuovo pianificato; rate limit 500/h rispettato usando solo la cache) —
   **solo fase esplorativa** (forma, per-era). NON entra nella climatologia prodotto:
   era regolamentare diversa (gomme 13" fino al 2021; vetture 2022–25 diverse dalle
   2026 con gomme più piccole).
4. **FastF1 2023–2026 dalla cache** — esplorazione settori/incroci dove serve.
5. NON si usa `data/stint_gold_2023_2026.csv` né `long_run_fp` (fonti orfane = debito,
   non fonte). NON si usano numeri del documento terzi.

Trappole FastF1 note e gestite in esplorazione: PitIn/PitOut su righe diverse,
IsAccurate=False sui pit lap, drive-through = TyreLife che non si azzera, rate limit.

## 2. Schema dei pesi di recenza (dichiarato ORA, non ritoccato dopo)

Peso per stagione, dimezzamento per anno di distanza dal 2026:

| stagione | peso |
|---|---|
| 2026 | 1.0 |
| 2025 | 0.5 |
| 2024 | 0.25 |
| 2023 | 0.125 |
| ≤2022 | 0 (solo esplorazione, mai nel CSV) |

Il peso si applica allo stint (unità di misura), tramite la stagione della sua gara.
I quantili della banda sono **quantili pesati** (interpolazione lineare sulla funzione
di ripartizione dei pesi cumulati normalizzati). `peso_recenza_effettivo` nel CSV =
somma dei pesi degli stint della combinazione / n_stint (quanto la banda è "spostata
verso il 2026").

**Anti-circolarità per K2**: il test di coerenza 2026 usa bande costruite **senza il
2026** (stessi rapporti di peso 2025:2024:2023 = 4:2:1). Solo se K2 = TRASFERIBILE il
CSV finale include gli stint 2026 con peso 1.0. Se K2 = STOP, il CSV si archivia
(leave-2026-out) con nota e il gancio resta a banda-zero.

## 3. Definizione operativa di "degrado marginale"

Per ogni **stint qualificato** (igiene al §4):

1. tempo fuel-corretto con la **convenzione del kernel (3/70)**:
   `t_fc = time − max(0, 70 − (70/N)·(lap−1)) · (3/70)` con N = giri di gara.
   Il riferimento è **LOCALE allo stint** (mai il passo di gara intera: errore che ha
   già invalidato due analisi in questo repo).
2. **degrado marginale dello stint** = pendenza OLS di `t_fc` su `life` (s/giro)
   calcolata sulla **finestra di plateau** dello stint: giri con
   `life ≥ L_PLATEAU_MIN` e, se un cliff emerge dall'esplorazione, prima del cliff.
   - `L_PLATEAU_MIN` parte dalla convenzione esistente (life ≥ 3, warm-in escluso) e
     può essere rivisto SOLO in fase esplorativa, PRIMA di generare il CSV, con la
     scelta documentata nel report. Dopo la generazione non si ritocca.
   - Il fuel-corretto locale lascia dentro l'evoluzione pista: bias verso il basso,
     DICHIARATO (stessa natura conservativa della misura replay già archiviata).
3. La banda per (mescola, circuito) = **q25 / mediana / q75 pesati** dei degradi
   marginali degli stint. Min=q25, centrale=mediana, max=q75. Banda a due lati:
   nessun pavimento a 0 (l'errore della banda statica unilaterale è inciso in
   `data/BANDA_STATICA_APPRENDIMENTO_NOTA.md` e non si ripete).

Circuiti = i `circuitId` del calendario 2026 (22). Madrid (madring) è nuovo: nessuna
storia → riga assente o NON-INFORMATIVA, dichiarata nel report.

## 4. Igiene (non negoziabile, anche in esplorazione)

- solo giri verdi (`status == '1'`; SC/VSC/rossa fuori);
- no in-lap / out-lap (pin/pout valorizzati fuori); no drive-through;
- no primo giro E no ultimo giro di gara (`2 ≤ lap ≤ N−1`);
- solo slick; bagnato = regime separato, mai mescolato;
- outlier per stint: `time ≤ 1.07 × mediana stint` (filtro F7 esistente, riusato);
- **stint qualificato: ≥ 5 giri verdi usabili dopo tutti i filtri** (e ≥ 3 punti
  sul plateau per la pendenza OLS, altrimenti lo stint non misura);
- blocchi = gare in ogni bootstrap (seed dichiarato: 20260716, B = 1000).

## 5. I 4 KPI (copiati dal mandato, operativizzati ORA)

**K1 — informatività** *(dal mandato: "flag INFORMATIVA/NON-INFORMATIVA secondo K1")*
Una combinazione (mescola, circuito) è **INFORMATIVA** se e solo se:
- (a) `n_stint ≥ 10` e `n_gare ≥ 2`, e
- (b) la banda condizionata dice più della globale: `IQR_cond < IQR_glob` **oppure**
  `|mediana_cond − mediana_glob| > IQR_glob / 4`, dove "glob" = distribuzione pesata
  di TUTTI gli stint qualificati (tutte le mescole e i circuiti insieme).
In testa al report: "K1: combinazioni informative N/M (elenco)". M = combinazioni
(mescola, circuito 2026) con almeno 1 stint qualificato.

**K2 — coerenza 2026** *(dal mandato: "K2 coerenza 2026: X% dentro banda →
TRASFERIBILE/STOP")*
Bande leave-2026-out (§2). Per ogni stint 2026 qualificato la cui combinazione ha una
banda leave-2026-out INFORMATIVA per K1(a) (n_stint≥10, n_gare≥2): dentro-banda se
`q25 ≤ marginale ≤ q75`. Copertura nominale di un IQR ≈ 50%.
- **Soglia (congelata): copertura pooled ≥ 40% → TRASFERIBILE; < 40% → STOP.**
- IC della copertura via bootstrap a blocchi-gara (B=1000, seed 20260716), riportato.
- Riportata anche per compound e per gara; la soglia decide sul pooled.

**K3 — sanità fisica** *(dal mandato: "K3 sanità: PASSA/violazioni elencate")*
Sul CSV finale, per ogni riga INFORMATIVA:
- (a) banda ordinata e finita: `min ≤ centrale ≤ max`, nessun NaN;
- (b) magnitudine plausibile: `centrale ∈ [−0.10, +0.35]` s/giro e `max ≤ 0.60` s/giro
  (inviluppo delle misure descrittive già archiviate: mediane storiche ~0.03–0.09,
  code alte Barcellona ~0.2);
- (c) utilità vs pit-loss: larghezza cumulata su 5 giri `(max−min)·5 ≤ 25%` del
  pit-loss del circuito (`data/pit_loss_circuito_f1db.csv`, soglia già congelata
  nell'arco banda-statica);
- (d) coerenza d'uso: `n_stint` e `n_gare` della riga coerenti coi conteggi sorgente.
PASSA solo se zero violazioni; altrimenti elenco per esteso.

**K4 — test end-to-end sul gancio** *(dal mandato: "K4 gancio: scenari
DISTINGUIBILI+PLAUSIBILI/NO — golden banda-zero BIT-IDENTICO/NO")*
Su UNA gara demo: **Austria, caso golden VER freeze 30 → pit 34** (pit a metà di 71
giri, regime verde). Il gancio v1.5 (`degrado_hook.mjs::treScenari`) viene CHIAMATO,
mai modificato, con le bande per-compound di Spielberg dal CSV.
- Riportati: rientro (posizione) e gap per ciascuno dei tre scenari.
- **DISTINGUIBILI** se l'ampiezza `pess − ott` sul cum del pilota a fine orizzonte è
  ≥ 0.5 s (risoluzione strategica minima) oppure cambia il rientro tra scenari.
- **PLAUSIBILI** se l'ampiezza è ≤ 25% del pit-loss di gara e l'ordine
  pess ≥ centrale ≥ ott regge su tutti i piloti.
- **Golden banda-zero**: `test_degrado_hook.mjs` deve restare bit-identico
  (max |kernel − gancio| = 0), prima e dopo.

## 6. Fase esplorativa (libera, documentata, vincolata solo dall'igiene)

Domande: lineare? warm-in/plateau/cliff? per-team? per-era-Pirelli (2018–22 vs 23–25 vs
26)? settori vs giri? Si segue ciò che i dati mostrano; ogni vicolo cieco = una riga
nel report, e avanti. Gli esiti esplorativi possono fissare `L_PLATEAU_MIN` e
l'eventuale struttura warm-in/cliff riportata nel CSV — PRIMA di generare i numeri
finali, mai dopo.

## 7. Output della sessione

- `PREREG_SESSIONE_CLIM.md` (questo file, committato prima dei numeri)
- `gen_climatologia_degrado.py` (generatore committato)
- `data/climatologia_degrado.csv` — per (mescola, circuito): min=q25, centrale=mediana,
  max=q75 del degrado marginale sul plateau + eventuale struttura warm-in/cliff emersa,
  n_stint, n_gare, peso-recenza effettivo, flag INFORMATIVA/NON-INFORMATIVA (K1)
- `REPORT_CLIMATOLOGIA.md` con in testa K1/K2/K3/K4 nel formato del mandato e la
  sezione "vicoli ciechi esplorati"
- verifica K4 come script committato che CHIAMA il gancio
- golden verdi prima e dopo (449/449, 11/11, hook). Commit su climatologia-degrado,
  **niente merge**.
