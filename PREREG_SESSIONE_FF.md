# PREREG — Sessione FF: "fastf1-pitloss"

**Committato PRIMA di qualsiasi calcolo.** Al momento di questo commit `fastf1` **non è
installato** (`ModuleNotFoundError`, verificato) e **nessun dato FastF1 è stato scaricato o
letto**. Le uniche letture precedenti a questo commit sono documenti già in repo
(`PITLOSS_NOTA_DI_CHIUSURA.md`, `data/pit_loss_circuito_f1db.NOTA.md`, `PREREG_SESSIONE_N.md` per
il formato) e un `ls`. Nessun numero nuovo è stato prodotto.

Branch: `fastf1-pitloss` (da `main` @ 13e1820).

Vincoli di sessione (dal mandato): NON si tocca kernel, modulo pit, gancio degrado, golden, né
alcun file di produzione (`data/pit_loss_circuito_f1db.csv`, `data/sc_safety_car.csv`,
`data/neutralization_model_2026.csv`). Nessun modello. **Nessuna correzione, nemmeno con GO.**
Nessun merge. **AMBITO: SOLO SILVERSTONE.**

---

## Perché questa sessione esiste

Il debito pit-loss è **chiuso a NO** dall'arco C→I (`PITLOSS_NOTA_DI_CHIUSURA.md`). La causa è
nota — `pit_loss_circuito_f1db.csv` contiene la **durata dello stop (pit-lane time)**, non il
pit-loss — ma nessun fix è mai stato calibrabile: gli strumenti C–I misuravano il pit-loss
**per differenza di tempi-giro**, e portavano dentro degrado, traffico, carburante e la varianza
del giro intero. IC ~6,8 s.

FastF1 offre una cosa che nessuna sessione precedente aveva: **i tempi per settore** e i
**timestamp di pit-in/pit-out**. Questo cambia la *fisica dello strumento*, non solo il campione:
- `pit_lane_time` diventa una **misura diretta** (differenza di due timestamp), non una stima;
- il pit-loss si misura sui **soli settori toccati dalla pit lane**, non sul giro intero → i
  settori non affetti (che sono rumore puro nei metodi C–I) escono dalla misura.

Questa è la ragione, dichiarata a priori, per cui l'IC *potrebbe* restringersi. **Non è una
promessa che si restringerà.** Se non si restringe, si chiude e basta: è il quarto strumento e
non c'è un quinto in coda.

## Ipotesi che questa sessione può falsificare, e come

1. *"Il campo f1db è la durata dello stop"* (Sessione G, provata via Jolpica). FF1 la mette alla
   prova con una **terza fonte indipendente** (FastF1, timestamp diretti). Se
   `pit_lane_time(FastF1) ≈ 29,1–29,6` ⇒ G confermato da tre fonti. Se ≠ ⇒ **la durata f1db è
   ANCORA un'altra grandezza** e va detto, senza cercare quale.
2. *"La pit lane tocca S3-in / S1-out"*. **Non assunta**: FF2 la deriva dai dati. È un'ipotesi
   falsificabile e il modo in cui fallisce è pre-registrato (>2 settori affetti ⇒ il metodo per
   settori non funziona a Silverstone).

---

## Campione

- **Circuito**: Silverstone e **nient'altro**. Layout invariato 2023–2026 → è il caso migliore
  per il vincolo di stabilità FF1. Un metodo che non regge qui non regge da nessuna parte.
- **Stagioni**: 2023, 2024, 2025, 2026 — **quelle effettivamente disponibili** via FastF1. Le
  stagioni assenti si dichiarano assenti; non si sostituiscono con altro.
- **Sessione**: solo la **gara** (R). Non FP, non qualifica.
- **Unità di analisi**: lo **stop** (una riga per stop in
  `data/fastf1_silverstone_stops.csv`).
- **Unità di incertezza**: il **BLOCCO-GARA** (stagione × gara). Il bootstrap ricampiona i
  **blocchi**, non gli stop: gli stop della stessa gara condividono meteo, gomme, SC, stato pista
  → non sono indipendenti. Con 4 stagioni ci sono **al più 4 blocchi**. Questo è dichiarato **ora**
  come il limite duro della sessione: **n_blocchi ≤ 4 è pochissimo**, e un IC a blocchi su 4
  blocchi è esso stesso rumoroso. Vedi criterio di fallimento 6.

## Filtri (pre-registrati)

Inclusi solo giri con `IsAccurate = True`. Esclusi:
- giri sotto **SC/VSC** (`TrackStatus` ≠ verde) e sotto **bandiera rossa**;
- **primo e ultimo giro** di gara;
- **stint con meno di 4 giri verdi** (il riferimento mediano non starebbe in piedi);
- stop senza `PitInTime` **o** senza `PitOutTime` (drive-through, ritiri in pit lane, dati
  mancanti): si contano e si riportano come **scartati**, non si imputano.

---

## Metodo per fase

### FF0 — Fattibilità (BLOCCANTE)
Installare `fastf1`. Caricare la gara di Silverstone **2024** e verificare la presenza di:
`PitInTime`, `PitOutTime`, `Sector1Time`, `Sector2Time`, `Sector3Time`, `TrackStatus`,
`Compound`, `TyreLife`, `IsAccurate`. Verificare cache, rate limit, tempi di download.

**Se la sandbox blocca FastF1: STOP.** Si riporta *cosa esattamente* fallisce (rete, DNS, TLS,
403, timeout) e si **propone senza eseguire** come aggirarlo. **Non si improvvisano fonti
alternative**: una fonte diversa è un'altra sessione con un'altra pre-registrazione.

### FF1 — `pit_lane_time` misurato
Per ogni stop: `pit_lane_time = PitOutTime − PitInTime` (session time, misura diretta).
Riportare **mediana, IQR, n stop, PER STAGIONE**.

- **VINCOLO DI STABILITÀ**: layout invariato ⇒ deve essere stabile fra stagioni. Se la mediana
  varia di **più di 2,0 s** fra 2023 e 2026 ⇒ **STOP**: il campo non è quello che pensiamo, e lo
  si scrive. Non si cerca una spiegazione a posteriori (regolamento, pit-limiter, meteo) per
  salvarlo.
- **CONFRONTO OBBLIGATORIO** vs la durata Jolpica/f1db: **29,12** (produzione) e **29,6**
  (misurato in Sessione G). Coincidono ⇒ **G1 confermato da una terza fonte**. Non coincidono ⇒
  la durata f1db è **ancora un'altra grandezza**, e va detto.

### FF2 — Quali settori tocca la pit lane (DAI DATI)
**Non si assume S3-in / S1-out.** Per ogni **in-lap**: confrontare S1, S2, S3 con la **mediana
degli stessi settori nei giri verdi dello STESSO stint** (stessa gomma, stessa età) → quale
settore è anomalo. Idem per gli **out-lap**.

Output: tabella (settore, delta mediano, n). Il settore affetto emerge da solo.

- **Criterio di affezione (pre-registrato, per non sceglierlo dopo)**: un settore è "affetto" se
  il suo **delta mediano ≥ 1,0 s** in valore assoluto. La soglia è fissata ora.
- **Se risultano affetti più di due settori** (in-lap + out-lap contati insieme) ⇒ si dichiara:
  **il metodo per settori non funziona a Silverstone**, e FF3 non è interpretabile come misura
  pulita. Lo si scrive.

### FF3 — Il pit-loss per settori (LA MISURA)
`pit_loss` = somma dei delta sui **SOLI settori affetti** identificati in FF2:
- `delta_inlap = S_affetto(in-lap) − mediana S_affetto nei giri verdi dello stesso stint`
- `delta_outlap = S_affetto(out-lap) − mediana S_affetto nei giri verdi dello stint successivo`,
  usando i **giri 2–5 del nuovo stint**, NON il giro 1 (che è l'out-lap stesso).
- `pit_loss = delta_inlap + delta_outlap`

**Dichiarazione semantica**: il riferimento out-lap è su **gomma nuova**, quindi il **warm-in
resta DENTRO la misura**. È **parte del pit-loss** per costruzione, ed è una **scelta dichiarata**,
non un residuo dimenticato: chi rifà lo stop paga anche il warm-in. Chiunque confronti questo
numero con una stima che esclude il warm-in sta confrontando due grandezze diverse.

Riportare: **mediana, IQR, IC95 BOOTSTRAP A BLOCCHI-GARA** (10.000 ricampionamenti, si
ricampionano i **BLOCCHI** con reinserimento, non gli stop), **n stop, n blocchi**.

**CONFRONTO OBBLIGATORIO**: accanto, le stime dei metodi vecchi — **C 20,90 / D 19,71 / E 20,93**
— e il nominale in produzione **29,12**.

### FF4 — Vincoli fisici (VETO sul KPI)
- `0 ≤ pit_loss ≤ pit_lane_time`. **Se violato: la misura è rotta ⇒ STOP.** Nessun salvataggio.
- `track_time = pit_lane_time − pit_loss` deve essere **> 0** e fisicamente sensato: a Silverstone
  atteso **~8–9 s** (il "guadagno geometrico" della pit lane dritta contro il tratto Vale/Club).
  Il vincolo duro è `> 0`; lo scostamento da 8–9 s si **riporta e si commenta**, non viene usato
  per aggiustare la misura.

### FF5 — VERDETTO (soglie pre-registrate, NON negoziabili)
Larghezza dell'**IC95 sul pit-loss** di Silverstone:

| larghezza IC95 | verdetto |
|---|---|
| **≤ 3,0 s** | **GO** — la correzione è autorizzata (guadagno 8,7 / incertezza 1,5 = 5,8×) |
| **3,0 – 6,0 s** | **AMBIGUO** — nessuna correzione |
| **> 6,0 s** | **NO** — non abbiamo migliorato nulla (oggi l'IC è 6,8 s). **Si chiude.** |

**NON si corregge nulla in questa sessione, nemmeno con GO.** Il GO autorizza **una sessione di
attivazione dedicata**, con checkpoint PO e rigenerazione golden. Il GO è un permesso di
istruttoria, non una correzione.

---

## Criteri di fallimento (dichiarati PRIMA)

1. **FF0 fallisce** (FastF1 non accessibile) ⇒ STOP. Si riporta l'errore esatto e si propone
   **senza eseguire**. Nessuna fonte alternativa improvvisata.
2. **FF1 instabile** (|mediana 2023 − mediana 2026| > 2,0 s) ⇒ STOP. Il campo non è quello che
   pensiamo.
3. **FF2 > 2 settori affetti** ⇒ il metodo per settori non funziona a Silverstone; lo si dichiara.
4. **FF4 vincolo fisico violato** (`pit_loss < 0`, `pit_loss > pit_lane_time`, o `track_time ≤ 0`)
   ⇒ la misura è rotta, STOP. **Non** si ripulisce il campione finché il vincolo passa: è la leva
   vietata (stessa che in Sessione I si è dichiarato di NON usare su Australia).
5. **FF5 IC > 6,0 s** ⇒ NO. Silverstone resta 29,12, il debito resta scritto.
6. **Blocchi insufficienti**: se i blocchi-gara utilizzabili sono **< 3**, l'IC a blocchi **non è
   stimabile** e il verdetto è **NO per non-stimabilità** — non "GO perché l'IC sugli stop è
   stretto". Un IC stretto ottenuto ricampionando gli **stop** invece dei blocchi sarebbe un
   **falso GO**, ed è esattamente l'errore che ha già bruciato la Sessione I2. Se accade, si
   riporta anche l'IC-sugli-stop **etichettato come non valido**, per mostrare quanto sarebbe
   stato ingannevole.
7. Qualsiasi tocco a file di produzione ⇒ violazione del mandato (non deve accadere).

## Leve vietate (dichiarate PRIMA, per nome)

- Escludere Silverstone-bagnato *dopo* aver visto che l'esclusione stringe l'IC.
- Spostare la soglia di affezione FF2 (1,0 s) dopo aver visto i delta.
- Passare da bootstrap a blocchi a bootstrap sugli stop perché "i blocchi sono pochi".
- Usare i giri 2–5 e poi allargare a 2–8 se l'IC non si stringe.
- Cambiare il set di stagioni dopo aver visto i per-stagione.

Se una di queste sembrasse giustificata a valle dei numeri, **non si fa**: si scrive nel report
che è sembrata giustificata e perché non è stata fatta.

## Output attesi

- `PREREG_SESSIONE_FF.md` (questo file, **committato per primo**)
- `gen_pitloss_fastf1.py` — **generatore committato** (nessun file orfano: è una regola del repo)
- `data/fastf1_silverstone_stops.csv` — uno stop per riga: `stagione, pilota, giro,
  pit_lane_time, delta_inlap, delta_outlap, pit_loss`
- `REPORT_PITLOSS_FASTF1.md`, con **in cima**:
  - `FF0 FastF1 accessibile: [SI / NO]`
  - `FF1 pit_lane_time misurato = X.XX s (stabile fra stagioni: [SI/NO]) | f1db dice 29,12`
  - `FF2 settori affetti: [S3-in, S1-out / altro]`
  - `FF3 pit_loss = X.XX s, IC95 [a – b], larghezza L s, n stop, n BLOCCHI`
  - `FF5 VERDETTO: [GO / AMBIGUO / NO]`
- Golden verdi **prima e dopo**.

Nessun verdetto strategico: è del PO.
