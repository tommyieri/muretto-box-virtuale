# La partizione del cancello: da pari/dispari a temporale

Branch `metodo/partizione-temporale`, base `main` = `fc7afb6`.
Prereg: `ai_lab/scienziato/PREREG_partizione_temporale.md`, **committato in `ba64e5e` — prima
di aver guardato quale modello si accende sotto la regola nuova**.
Generatore: `gen_stabilita_partizione.py` → `data/stabilita_partizione.json`.

## In una riga

La partizione temporale **è stabile secondo i criteri dichiarati prima** (0 ribaltamenti
contro 5, escursione dimezzata), e **nessun modello si accende**: sia traffico sia degrado
restano spenti, e sotto il taglio nuovo sono **più lontani** dall'accendersi di prima. La
trappola dichiarata non è scattata.

---

## 1 · Il difetto, e perché era grave

`cal, ver = gids[0::2], gids[1::2]`. Togliendo un Gran Premio tutti gli indici scalano e la
partizione **si rovescia**: sovrapposizione fra il vecchio e il nuovo insieme di verifica
misurata a **ZERO**. Sul traffico, **5 gare su 10** tolte da sole ribaltavano `ACCENDIBILE`.

**Difetto secondario emerso implementando**: `sorted(gids)` ordina per **nome**. Il taglio
del 2026 era quindi *alfabetico* (Australia, Austria, Belgian, …), arbitrario anche rispetto
al tempo. Nessuno se n'era accorto perché «ordinate» sembrava voler dire «in ordine di gara».

È la **terza incarnazione della malattia-madre**: *il risultato dipende da come tagli i dati,
non da cosa dicono* — dopo ATT6 v2 e il cancello-partizione del distruttore, stavolta dentro
il meccanismo che decide se un modello va live.

## 2 · La regola nuova (dichiarata prima di misurarla)

**Temporale, con soglia congelata alla data.** `cal = {data < T*}`, `ver = {data ≥ T*}`;
`T*` fissata una volta per regime e mai più mossa. Per il 2026: **`T* = 2026-05-24`** (GP del
Canada, 5ª gara cronologica), da `K_min = 4` **derivato** da vincoli già pre-registrati prima
di oggi — non scelto adesso. Ordinamento **cronologico dal fondo**, non alfabetico.

Perché il verso: al via di domenica hai il passato e applichi alla gara che arriva. Perché una
**data** e non un conteggio: con un conteggio, togliere una gara farebbe *migrare* una gara da
verifica a calibrazione; con la data congelata il taglio non si muove, le gare nuove entrano
**in coda**, e la verifica di domani è **sovrainsieme** di quella di oggi.

## 3 · La stabilità — il criterio dichiarato, e i numeri

> Il prereg §3 dichiara che la partizione si giudica sulla **stabilità**, **non**
> sull'accensione. Giudicarla sull'accensione significherebbe scegliere il metro per il
> risultato.

**S1** (categorica): zero ribaltamenti di `ACCENDIBILE` nel leave-one-race-out.
**S2** (quantitativa): escursione massima ≤ 50 % dell'ampiezza dell'IC95 a campione pieno.

| modello | versione | S1 ribaltamenti | S2 escursione / soglia | esito |
|---|---|---|---|---|
| **traffico 2026** | v1 pari/dispari | **5 / 10** | 0,2071 / 0,2197 (94 %) | **S1 FALLITA** |
| **traffico 2026** | v2 temporale | **0 / 10** | 0,1064 / 0,3718 (29 %) | **entrambe superate** |
| **degrado 2026** | v1 pari/dispari | 0 / 10 | **49,46 / 40,08** | **S2 FALLITA** |
| **degrado 2026** | v2 temporale | 0 / 10 | 20,92 / 33,89 | **entrambe superate** |

**Ogni modello espone una faccia diversa della stessa malattia**: il traffico ribalta il
verdetto, il degrado no (è spento con margine, non c'è niente da ribaltare — S1 lì è
**ininformativa**) ma la sua statistica ballava oltre la soglia. v2 le supera entrambe su
entrambi.

**S2 non è un artefatto dell'IC più largo**: l'escursione cala anche in **valore assoluto** —
traffico 0,207 → 0,106; degrado 49,5 → 20,9. Circa la metà in tutti e due i casi.

## 4 · Chi si accende — con la trappola in mente

Il prereg §4 dichiarava: se il traffico passa da peggio-del-niente ad accendibile, **non
accenderlo**, portalo al tavolo. **Non è successo.**

| modello | appaiato v1 | appaiato v2 | ACCENDIBILE |
|---|---|---|---|
| traffico 2026 | −0,0567 | **−0,1962** | `false` sotto entrambe |
| degrado 2026 | −15,107 | **−30,364** | `false` sotto entrambe |

Sotto il taglio nuovo **entrambi peggiorano**: sono più lontani dall'accendersi di prima. È
l'esito più rassicurante possibile per l'onestà del cambio — ho cambiato il metro e il
risultato **non** è migliorato.

Il perché è comprensibile: il taglio temporale calibra sulle **4 gare più vecchie** e verifica
sulle **6 più recenti**. È più duro del pari/dispari, che mescolava inizio e fine stagione da
entrambe le parti e quindi lasciava filtrare informazione dal futuro nella calibrazione.

## 5 · Versionato, non sovrascritto

`ai_lab/scienziato/partizione.py` è il **punto condiviso che prima non esisteva** (la riga era
copiata a mano in 14 posti). Contiene:

- **`v1_pari_dispari`** — conservata, con scritta accanto la ragione del pensionamento e la
  misura del difetto. Serve a rileggere i risultati nati sotto di lei e a rendere il confronto
  v1-contro-v2 eseguibile da chiunque, invece che una mia asserzione;
- **`v2_temporale`** — attiva, con `T_STELLA` congelata in git.

**Ogni verdetto porta la targhetta del proprio metodo**: `cancello_accensione.partizione`
registra versione, `T*`, `K_min`, quante gare per lato. **I verdetti senza targhetta sono
tutti v1** — scritto nel `limite_onesto` del modello, perché nessuno confronti due numeri nati
sotto regole diverse.

## 6 · Un difetto trovato strada facendo, e riparato perché bloccava il cambio

`autocalibra.aggiorna` decideva «file invariato» guardando **solo** `(coefficienti,
gare_sotto)`. Un cambio **metodologico** del cancello lascia i coefficienti identici ⇒ il file
risultava invariato e **la modifica non arrivava mai all'artefatto**: il modello avrebbe
continuato a esibire un verdetto prodotto da una regola che non esisteva più. Verificato prima
di ripararlo (il run normale diceva «Idempotente» e non scriveva).

La chiave ora include **il metodo e il verdetto** (`ACCENDIBILE`, versione della partizione).
Dopo la riparazione un run normale torna a dire «invariato», come deve.

## 7 · Perimetro rispettato

- **Kernel non toccato**: `engine/engine.py` `d2bee2dca871`, commit `c6e7482`. Golden
  **449/449**, test_pit **11 casi** (185 valori, mismatch 0), agganci **3/3** e **3/3**.
- **Null sigillati non toccati**: sigillo **INTEGRO, 8 zone**, prima e dopo.
- **Il numero di placebo preservato verbatim** (0,155) nell'aggiornamento dell'artefatto: è
  zona-null sotto indagine e non riproducibile; ricalcolarlo avrebbe prodotto un'altra
  estrazione a caso. L'aggiornamento del json è **chirurgico** — coefficienti verificati
  identici prima di scrivere.
- **Script di studio non toccati**: `run_*.py` restano su v1. I loro risultati sono già a
  referto sotto quella regola, e cambiarla sotto i piedi renderebbe irrileggibili i rapporti
  già scritti.

## 8 · Cosa resta da fare (non in questo PR)

1. **`modello_degrado.py` deve adottare `partizione.py`.** Il degrado non è ancora su `main`
   (branch `ai-lab/degrado-2026-live`, nessun PR). I numeri della tabella §3 sono stati
   misurati su un worktree che combina quel branch con questa partizione; l'adozione è di
   **tre righe** e va fatta quando quel PR si apre:
   ```python
   import partizione as PZ
   date = PZ.date_dal_fondo({g: dati[g]['dati']['righe'] for g in gids})
   cal, ver, targhetta_partizione = PZ.taglio(gids, date, self.regime)
   ```
   `gen_stabilita_partizione.py` misura il degrado **da solo** appena il modulo è presente.
2. **Le altre 12 copie dello split** (`run_*.py`, `scheletro.fuori_campione`, `passobase.py`)
   restano su pari/dispari. Non è un difetto operativo — sono studi già a referto — ma è
   debito: chi ne rieseguirà uno dovrà decidere sotto quale regola vuole leggerlo.
3. **L'origine mobile** (per ogni gara `i`, calibra su tutte le `< i`) è il successore naturale
   quando il regime sarà ricco: mantiene la proprietà di sovrainsieme e fa **crescere** la
   calibrazione, che con `T*` congelata resta ferma a 4 gare. Dichiarato come limite nel
   prereg §2, non adottato oggi per tenere il giro piccolo.
