# PITLOSS_NOTA_DI_CHIUSURA — chiusura del debito P1 (pit-loss)

Chiusura definitiva del filone pit-loss dopo l'arco di sessioni C→D→E→F→G→H→I. Nessun verdetto
strategico: quello è del PO. Questa nota mette in fila **cosa si è misurato, cosa era sbagliato
nella misura, e cosa resta vero** — così il debito non viene ri-litigato da zero.

## Esito in una riga
Il campo di `data/pit_loss_circuito_f1db.csv` **è la DURATA dello stop (pit-lane time), non il
pit-loss** (Sessione G, causa fisica certa). La ri-taratura a due componenti
`pit_loss = pit_lane_time − track_time` è **giusta in principio ma NON calibrabile** con i dati
disponibili (Sessioni H e I). Nessun fix validato → **Gran Bretagna resta 29,12; il ratio SC 0,42
resta**. Ogni correzione futura tocca il modulo pit congelato e i suoi golden 11/11 → sessione
dedicata con checkpoint PO e rigenerazione golden.

## Perché due verdetti storici sono stati ANNOTATI come non validi (nulla cancellato)
- **REPORT_RESIDUO.md** — "Execution Delta NON ESISTE": **VERDETTO INVALIDATO**. La metrica-residuo
  era dominata dal termine **carburante non re-inflazionato** (il kernel gira a serbatoio vuoto e
  `simulate` non re-inflaziona → il residuo assoluto porta ~2 s/giro di carburante). La misura non
  era sana e non poteva pesare sul pit-loss. Debug in **REPORT_RESIDUO_DEBUG.md**.
- **REPORT_PITLOSS_GAP.md** — "GIUDICE NON VALIDO" (metodo gap): **VERDETTO EMESSO CON KPI ERRATO**.
  Validava lo strumento col **valore assoluto** del controllo-a-vuoto (`|valore| ≤ 0,5`), che è la
  cosa sbagliata da guardare: uno strumento va validato misurandone il **bias con segno** (placebo
  strutturato), non il rumore. Ri-fatto correttamente in **REPORT_GIUDICE.md, Sessione F** (che a
  sua volta STOP per risoluzione insufficiente F0 + sensibilità ai riferimenti F2 — non per il KPI).

Le annotazioni sono banner in testa ai due file: **il contenuto originale è preservato integralmente**.

## L'arco, per sessione
- **C** (calibrazione-pitloss): misura fisica del pit-loss dai giri → f1db MISCALIBRATO vs reale
  (|Δ|>1 s su 7/9; GB nominale 29,12 vs reale ~20,9).
- **D** (residuo, k=1): GO PARZIALE su GB/Miami/Monaco — **ma C e D sono algebricamente lo STESSO
  metodo** (differiscono solo per la stima del passo di riferimento): la "convergenza" era illusoria.
- **E** (gap, pilota-cronometro): terzo metodo ortogonale → GIUDICE NON VALIDO. *Vedi annotazione:
  KPI errato; ri-esaminato in F.*
- **F** (giudice, placebo strutturato): KPI corretto (bias con segno) → **F1 bias +0,57 s
  correggibile, ma F0 risoluzione insufficiente (SE 1,4–2,0 s > 1,0) e F2 sensibilità ai
  riferimenti (spread 4–5 s)** → verdetto non emesso. Lo strumento non è abbastanza fermo.
- **G** (pitloss-due-componenti): **causa fisica trovata** — durate per-stop f1db (Jolpica) ⇒ il
  campo è la DURATA (|nominale−durata|≤1 s su 8/9). `pit_loss = pit_lane_time − track_time`
  (track_time varia per geometria: GB +8,7 s). Spiega con UN meccanismo la sovra-dispersione e la
  correlazione −0,76 che C–F non chiudevano. Calibrazione SC non misurabile (solo 2 circuiti).
- **H**: validazione a 3 test pre-registrati del modello a due componenti → **NO**. H1 (vincolo
  fisico dopo correzione bias metodo-C) fallisce su Spagna; H2 (predizione SC da R_lap
  indipendente) SBAGLIATO. Due fonti indipendenti non riproducono l'osservato.
- **I** (questa chiusura): rimisura con le due leve che *avrebbero dovuto* sanare H, **pre-registrate
  prima dei numeri** (PREREG_SESSIONE_I.md): riferimento **LOCALE** al verde (assorbe il bias di
  degrado per costruzione) + **POOLING** 2023-2026. Esito **NO NETTO**, e non per inganno:
  - **I1 FALLISCE** — il riferimento locale non salva il vincolo fisico, sposta il fallimento da
    Spagna (che diventa **FRAGILE ≈0**, come dichiarato debole a priori) ad **AUSTRALIA**:
    `track_time < 0` robusto in **ogni stagione asciutta** (2023 −1,5; 2024 −2,0; 2026 −4,1). A
    Melbourne `pit_loss_verde (~20-23) > pit_lane_time (~18)` → **le due fonti sono incoerenti**,
    il modello a due componenti non lo rappresenta.
  - **I2 SBAGLIATO** — il pooling **non produce blocchi-gara indipendenti** (eventi SC rari e
    concentrati: 1–2 gare per circuito → IC a blocchi non stimabile; osservato deployment-
    contaminato, Spagna −22 = mass-stop sotto SC in una sola gara). Errore componenti >4 s anche
    escludendo l'artefatto. L'osservato SC resta **"inutilizzabile come metro"** (H confermato con
    più dati). Dettaglio e diagnostica data-quality in **REPORT_VALIDAZIONE_POOLED.md**.
  - **Non-inganno dichiarato**: pulire le durate bagnate (Australia/Canada 2025) spingerebbe
    Australia *verso* il PASS → **non fatto** (sarebbe la leva vietata). Il NO regge sul dato asciutto.

## Cosa resta vero (stato di verità del debito)
1. **Causa nota, fix assente.** Il file usa il pit-lane time come pit-loss; nessuna sostituzione è
   giustificata da evidenza indipendente valida.
2. **Produzione intatta.** GB 29,12; ratio SC 0,42 (i due errori si compensano nel netto). Nessun
   file di produzione toccato in nessuna sessione (`pit_loss_circuito_f1db.csv`, `sc_safety_car.csv`,
   `neutralization_model_2026.csv`). Golden 11/11 verdi.
3. **Entrambi i file pit-loss sono orfani** (senza generatore committato): sostituirli tocca il
   modulo pit congelato + golden → decisione PO, sessione dedicata con rigenerazione golden.
4. **Due lezioni di metodo** (valide oltre il pit-loss):
   - due metodi che concordano non confermano se sono **lo stesso metodo travestito** (C=D):
     chiedersi "da quali direzioni DIVERSE potrebbero sbagliare".
   - validare uno strumento = misurarne il **BIAS con segno** (placebo strutturato), **non il
     valore assoluto** né il rumore (l'errore di E, corretto in F).

## Indice dei documenti (tutti conservati)
- `REPORT_VALIDAZIONE_POOLED.md` — Sessione I (questa chiusura), con diagnostica data-quality.
- `PREREG_SESSIONE_I.md` — pre-registrazione incisa prima dei numeri.
- `REPORT_VALIDAZIONE_COMPONENTI.md` — Sessione H.
- `REPORT_PITLOSS_COMPONENTI.md` — Sessione G (causa fisica).
- `REPORT_PITLOSS_GAP.md` — Sessione E *(annotato: KPI errato)* · `REPORT_GIUDICE.md` — Sessione F.
- `REPORT_RESIDUO.md` — audit residuo *(annotato: invalidato)* · `REPORT_RESIDUO_DEBUG.md` — causa.
