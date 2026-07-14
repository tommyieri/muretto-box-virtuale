# REPORT — Sessione FF: pit-loss di Silverstone via FastF1

Pre-registrazione: **`PREREG_SESSIONE_FF.md`**, committata @ `5b9bc6a` **prima** di installare
FastF1 e prima di qualsiasi numero. Generatore committato: **`gen_pitloss_fastf1.py`**.
Dati: **`data/fastf1_silverstone_stops.csv`** (65 stop validi). Ambito: **solo Silverstone**.

```
FF0 FastF1 accessibile: SI
FF1 pit_lane_time misurato = 29.18 s (stabile fra stagioni: SI, drift 0,77 s) | f1db dice 29,12
FF2 settori affetti: SOLO S1-out  (NON S3-in/S1-out: l'ipotesi a priori e' FALSIFICATA)
FF3 pit_loss = 21.72 s, IC95 [20.80 - 24.88], larghezza 4.09 s, n stop 65, n BLOCCHI 4
FF5 VERDETTO: AMBIGUO  -> nessuna correzione. Silverstone resta 29,12.
```

**Niente e' stato corretto. Nessun file di produzione toccato. Golden verdi prima e dopo**
(`test_b.mjs` 449/449 PASS; `test_degrado_hook.mjs` PASS — invariati, questa sessione non tocca
codice di produzione). Nessun verdetto strategico: e' del PO.

---

## In una riga

FastF1 **conferma la diagnosi di G da una terza fonte indipendente** (il campo f1db e' la durata
dello stop: 29,18 misurato vs 29,12 nominale) e **il metodo per settori funziona fisicamente**
(tutti i vincoli FF4 passano, `track_time` = 7,97 s contro gli 8–9 s attesi). Ma con **4 sole
gare** l'IC95 resta **4,09 s**: meglio dei 6,8 s di oggi, **non abbastanza** per i 3,0 s che
autorizzavano la correzione. **AMBIGUO.**

---

## FF0 — Fattibilita': SI

`pip install fastf1 --break-system-packages` → **fastf1 3.8.3**. Nessun blocco di rete, nessun
rate limit incontrato. Gara Silverstone 2024 caricata in **4,7 s**; cache in `data/ff1_cache`
(27 MB per 4 stagioni, **gitignorata**: e' un artefatto di download, non una fonte). Tutti e nove
i campi richiesti presenti e popolati:

| campo | presente | non-null (2024) |
|---|---|---|
| `PitInTime` / `PitOutTime` | si | 46 / 46 |
| `Sector1Time` / `Sector2Time` / `Sector3Time` | si | 941 / 960 / 960 |
| `TrackStatus` / `Compound` / `TyreLife` / `IsAccurate` | si | 960 |

Stagioni scaricate: **2023, 2024, 2025, 2026** (British GP: round 10 / 12 / 12 / 9). Tutte e
quattro disponibili.

### Due trappole strutturali trovate in FF0 (entrambe avrebbero rotto la misura in silenzio)

1. **`PitInTime` e `PitOutTime` NON stanno sulla stessa riga.** `PitInTime` sta sull'in-lap,
   `PitOutTime` sull'out-lap: le righe con **entrambi** non-null sono **zero**. La formula del
   mandato presa alla lettera (stessa riga) avrebbe prodotto **tutti NaN**. Implementato
   accoppiando l'in-lap con il giro immediatamente successivo.
2. **Ogni giro di pit ha `IsAccurate = False`** (46/46 in-lap e 46/46 out-lap in 2024): in FastF1
   e' *per definizione* — la accuracy-check esclude i giri di pit. Applicare il filtro
   `IsAccurate=True` **agli in/out-lap**, come dice il mandato alla lettera, **azzererebbe il
   campione**. Il filtro e' quindi applicato ai **giri di RIFERIMENTO** (i verdi dello stint), che
   e' l'unica lettura che lascia esistere una misura. **Lo si dichiara qui invece di farlo di
   nascosto**: e' una deviazione-di-necessita' dalla lettera del mandato.

---

## FF1 — `pit_lane_time` misurato: 29,18 s — **G1 CONFERMATO DA UNA TERZA FONTE**

`pit_lane_time = PitOutTime(out-lap) − PitInTime(in-lap)`, misura diretta su **154 stop**
(inclusi quelli in regime neutralizzato: FF1 non filtra).

| stagione | n | mediana | IQR |
|---:|---:|---:|---|
| 2023 | 24 | **28,76** | [28,49 – 29,25] |
| 2024 | 45 | **29,38** | [29,05 – 29,97] |
| 2025 | 35 | **28,88** | [28,65 – 29,45] |
| 2026 | 50 | **29,53** | [28,83 – 31,97] |
| **tutte** | **154** | **29,18** | |

**Vincolo di stabilita': PASSA.** |mediana 2023 − mediana 2026| = **0,77 s** contro la soglia
pre-registrata di 2,0 s. Il layout e' invariato e il campo si comporta di conseguenza.

**Confronto obbligatorio — il risultato piu' solido della sessione:**

| fonte | valore | metodo |
|---|---:|---|
| **FastF1** (questa sessione) | **29,18** | timestamp pit-in/pit-out, misura diretta |
| **f1db / produzione** | **29,12** | campo `pit_loss_s` di `pit_loss_circuito_f1db.csv` |
| **Jolpica** (Sessione G) | **29,6** | durata per-stop |

Coincidono: **29,18 vs 29,12 = 0,06 s di scarto**. La Sessione G aveva stabilito che il campo
f1db e' la **durata dello stop**, non il pit-loss, usando Jolpica. FastF1 e' una **terza fonte,
indipendente da entrambe** (timing ufficiale, non un aggregatore), e cade sullo stesso numero.

> **G1 e' confermato. Il campo `pit_loss_s` di `pit_loss_circuito_f1db.csv` E' il pit-lane time.**
> Non e' "ancora un'altra grandezza": e' esattamente la grandezza che G aveva identificato.

Questo chiude una delle due domande aperte del debito. **La causa non e' piu' in discussione; il
fix si', ed e' il resto di questo report.**

---

## FF2 — Quali settori tocca la pit lane: **SOLO S1-out**. L'ipotesi a priori e' falsificata.

Delta mediano di ogni settore contro la mediana dello **stesso settore nei giri verdi dello stesso
stint**. Soglia di affezione **|delta| ≥ 1,0 s**, fissata nel prereg **prima** di vedere i numeri.

| settore | delta mediano | n | affetto |
|---|---:|---:|:--:|
| S1-in | +0,007 | 65 | no |
| S2-in | −0,017 | 65 | no |
| **S3-in** | **−0,732** | 65 | **no** (sotto soglia) |
| **S1-out** | **+21,723** | 65 | **SI** |
| S2-out | +0,346 | 65 | no |
| S3-out | −0,022 | 65 | no |

**Settori affetti: 1 (`S1-out`).** Non due. Il mandato pre-registrava il caso ">2 settori affetti"
(⇒ il metodo non funziona); il caso osservato e' l'opposto: **l'in-lap non contribuisce nulla di
misurabile**, e S3-in e' addirittura **negativo** (l'in-lap e' piu' *veloce* del riferimento).

### Perche' — verificato sul cronometro di sessione, non ipotizzato

Caso VER 2026, giro 17→18 (gara asciutta, nessuna neutralizzazione):

| | valore |
|---|---:|
| fine giro 17 (crossing S/F) | `Time` = 4955,17 |
| **`PitInTime`** (riga giro 17) | **4949,38** → **5,79 s PRIMA della linea** |
| **`PitOutTime`** (riga giro 18) | **4978,10** → cade **dentro** S1-out |
| `pit_lane_time` | 28,72 s |
| S3 del giro 17 (in-lap) | **25,55** vs verde ~25,9 → **normale** |
| S1 del giro 18 (out-lap) | **50,24** vs verde ~29,9 → **+20,3** |

Il pit-entry a Silverstone e' **5,79 s prima della linea del traguardo**: la macchina **taglia la
linea gia' dentro la pit lane**, quindi `pit_lane_time` **scavalca il confine di giro** (5,79 s
nel giro 17 + 22,93 s nel giro 18). Eppure **l'S3 dell'in-lap resta normale**, perche' la pit lane
dritta **salta il tratto Vale/Club** e il guadagno geometrico **compensa** il limite a 80 km/h.

E' esattamente il "**guadagno geometrico della pit lane dritta contro il tratto Vale/Club**"
previsto dal mandato in FF4 — qui **misurato**, e ricompare come `track_time` = 7,97 s (sotto).

> **Non assumere S3-in/S1-out ha pagato.** L'ipotesi a priori era sbagliata a Silverstone: chi
> avesse sommato S3-in "perche' e' li' che si entra ai box" avrebbe sottratto ~0,7 s di
> push-lap scambiandolo per pit-loss.

### Come e' stata applicata la formula (dichiarato, non nascosto)

Il prereg dice: *"pit_loss = somma dei delta sui **SOLI settori affetti**"*, e si aspettava **un**
settore-in e **un** settore-out. L'insieme affetto dell'in-lap e' **vuoto** ⇒ la somma su
un insieme vuoto e' **0**: `delta_inlap = 0` **per misura**, non per assunzione, e
`pit_loss = delta_outlap`. E' la lettura **letterale** della regola.

**La soglia (1,0 s) NON e' stata spostata** per catturare S3-in: era una leva esplicitamente
vietata nel prereg. Per trasparenza, la **sensibilita'**: includendo anche S3-in (sotto soglia) la
mediana sarebbe **21,54** invece di 21,72 — **0,18 s**, irrilevante per il verdetto. La riporto
perche' il lettore possa giudicare, **non** perche' sia il numero da usare.

---

## FF3 — La misura: pit_loss = 21,72 s, IC95 larghezza **4,09 s**

**160 stop grezzi** → 5 senza timestamp utilizzabile e 1 su primo/ultimo giro esclusi a monte →
**154 stop con `pit_lane_time`** (la base di FF1) → **65 stop validi** per FF3. Scarti, tutti
pre-registrati: **61 in regime non-verde** (SC/VSC/rossa) e **28 stint troppo corti** (<4 giri
verdi di riferimento). Somma di controllo: 5 + 1 + 61 + 28 + 65 = **160**.

| | valore |
|---|---:|
| **pit_loss mediana** | **21,72 s** |
| IQR | [20,59 – 24,23] |
| n stop | 65 |
| **n BLOCCHI** | **4** |

### L'incertezza dipende da come si contano i blocchi — e le due letture cavalcano la soglia

Il prereg impone il **bootstrap a blocchi-gara** ("conta i BLOCCHI, non gli stop") ma **non
disambigua** fra due implementazioni, entrambe fedeli alla lettera:

| stima | IC95 | larghezza | verdetto |
|---|---|---:|---|
| blocchi **POOLED** (ricampiona i blocchi, poi mediana del pool) | [20,80 – 23,23] | **2,43** | GO |
| blocchi **NON pesati** (ogni gara pesa 1: mediana delle mediane) | [20,80 – 24,88] | **4,09** | **AMBIGUO** ← adottato |
| *[NON VALIDO]* ricampionando gli **STOP** | [20,84 – 23,64] | 2,80 | *(mostrato per confronto)* |

**Perche' e' stato adottato il conservativo — tre ragioni, nessuna delle quali e' "preferisco il NO":**

1. **Una pre-registrazione che non decide non puo' autorizzare a posteriori il ramo piu' comodo.**
   Le due letture straddleano la soglia (2,43 → GO; 4,09 → AMBIGUO). Scegliere la prima *dopo*
   aver visto che da' GO e' esattamente il pattern che il prereg elenca fra le leve vietate.
2. **L'IC pooled non e' un IC valido per questa domanda.** Le mediane per stagione sono
   **20,84 / 23,20 / 24,88 / 20,80**: lo **spread osservato fra gare e' 4,09 s**, cioe' *piu'
   largo dell'intervallo pooled stesso* (2,43). L'IC pooled **non contiene** la mediana osservata
   del 2025 (24,88). Un intervallo che **esclude un valore realmente osservato** della grandezza
   di cui dovrebbe descrivere la variabilita' non e' una dichiarazione di incertezza credibile.
3. **La sua strettezza e' un artefatto di squilibrio, non un segnale di accordo.** Il 2024 pesa
   **40 stop su 65 (62%)**: poolando, la mediana e' dominata da **una sola gara** in ogni
   ricampionamento. E' precisamente il difetto che "conta i BLOCCHI, non gli stop" doveva
   impedire — reintrodotto dal pooling.

Se l'estimando e' *"il pit-loss di una **nuova** gara a Silverstone"* — che e' l'uso che il
modello ne farebbe — l'estimatore corretto e' quello **non pesato**. Con 4 gare non si sa dire di
meglio che "**fra 20,8 e 24,9**".

### Il campione, per stagione — e perche' 4 blocchi sono 4 blocchi solo sulla carta

| stagione | mediana | n | % campione | note |
|---:|---:|---:|---:|---|
| 2023 | **20,84** | 7 | 11% | asciutta |
| 2024 | **23,20** | 40 | **62%** | **21/40 stop su gomma da bagnato** |
| 2025 | **24,88** | **1** | 2% | gara bagnata/caotica: 19 stop persi per non-verde, 15 per stint corto |
| 2026 | **20,80** | 17 | 26% | asciutta |

Il **2025 contribuisce UNO stop**: come blocco esiste nominalmente, ma non porta informazione.
I blocchi realmente utilizzabili sono **tre**, appena sopra la soglia di non-stimabilita' del
prereg (criterio 6: <3 ⇒ NO). Il prereg aveva gia' dichiarato che *"n_blocchi ≤ 4 e' pochissimo"*:
lo era, e lo e' rimasto.

### Confronto obbligatorio con i metodi vecchi

| metodo | pit_loss |
|---|---:|
| **FF (FastF1, per settori)** | **21,72** (asciutto-solo, diagnostico: 20,80) |
| C (calibrazione fisica) | 20,90 |
| D (residuo, k=1) | 19,71 |
| E (gap) | 20,93 |
| **nominale in produzione** | **29,12** |

Tutti e quattro i metodi indipendenti stanno fra **19,7 e 21,7**; la produzione dice **29,12**.
Il **divario di ~8,4 s resta**, ed e' coerente con `track_time` ≈ 8 s. **La direzione dell'errore
in produzione non e' in dubbio; e' la sua *taglia* che non e' abbastanza ferma.**

### Bagnato: dichiarato, NON escluso

| | n | mediana |
|---|---:|---:|
| slick in in-lap | 43 | **20,80** |
| gomma da bagnato in in-lap | 22 | **24,18** |

Il bagnato sposta la misura di **+3,4 s**, e pesa per il 34% del campione. In una gara che si
asciuga il riferimento mediano di stint e' **non stazionario** (la pista migliora dentro lo
stint), quindi i delta del 2024/2025 sono **strutturalmente sporchi**.

**Escluderlo qui sarebbe la leva vietata** ("escludere il bagnato *dopo* aver visto che stringe
l'IC", prereg). **Non e' stato fatto.** Lo dichiaro apertamente: **escludere il bagnato darebbe
mediana 20,80 con le due stagioni asciutte in accordo a 0,04 s (20,84 / 20,80) e probabilmente un
IC dentro la soglia di GO.** E' esattamente per questo che **non si fa a posteriori**: sarebbe la
scorciatoia piu' comoda e non provata di questa sessione. Va **pre-registrata** e rifatta da capo.

---

## FF4 — Vincoli fisici: **TUTTI PASSANO**

| vincolo | esito |
|---|---|
| `pit_loss ≥ 0` | **0/65 violazioni** |
| `pit_loss ≤ pit_lane_time` | **0/65 violazioni** |
| `track_time = pit_lane_time − pit_loss > 0` | **0/65 violazioni** |
| `track_time` fisicamente sensato (atteso ~8–9 s) | **mediana 7,97 s** |

**Questo e' il risultato che nessuna sessione precedente aveva ottenuto.** In Sessione I il
vincolo fisico **saltava** (`track_time < 0` in ogni stagione asciutta a Melbourne: le due fonti
erano incoerenti). Qui le due fonti — timestamp diretti e delta per settore — sono **coerenti su
tutti e 65 gli stop**, e il `track_time` cade **dentro** la finestra 8–9 s prevista dalla
geometria **prima** di vedere il dato (7,97 vs 8–9 attesi).

Il metodo **non e' rotto**. E' solo **poco alimentato**: 4 gare.

---

## FF5 — VERDETTO: **AMBIGUO** ⇒ nessuna correzione

Larghezza IC95 adottata = **4,09 s**, dentro la banda pre-registrata **3,0–6,0 s ⇒ AMBIGUO**.

| larghezza | verdetto | esito |
|---|---|---|
| ≤ 3,0 s | GO | — |
| **3,0–6,0 s** | **AMBIGUO** | ← **siamo qui (4,09)** |
| > 6,0 s | NO, si chiude | — |

**Conseguenza operativa, senza attenuazioni:**
- **Nessuna correzione.** Silverstone resta **29,12**. Il ratio SC **0,42** resta.
- **Nessuna sessione di attivazione autorizzata**: l'AMBIGUO non da' il permesso che dava il GO.
- **Il debito resta scritto** — ma **cambia di natura**, vedi sotto.

### Abbiamo migliorato qualcosa? Si', misurabilmente. Abbastanza? No.

| | IC95 |
|---|---:|
| stato precedente (produzione, arco C→I) | **~6,8 s** |
| questa sessione (per settori, 4 gare) | **4,09 s** |
| soglia per autorizzare la correzione | **3,0 s** |

Il metodo per settori **ha fatto quello che prometteva**: togliendo dalla misura i settori non
toccati dalla pit lane, l'incertezza scende da **6,8 → 4,09 s**. Non e' rumore di fondo che si e'
mosso: e' il pit-loss misurato su **una frazione di giro** invece che sul giro intero, con tutti i
vincoli fisici che ora passano. **Ma il vincolo che morde non e' piu' lo strumento: e' il numero
di gare.** Con 4 blocchi (3 utilizzabili) di cui il piu' grande e' bagnato, non si arriva a 3,0 s.

---

## Cosa questa sessione ha cambiato nello stato di verita' del debito

**Guadagnato (fatti nuovi, non opinioni):**
1. **G1 confermato da una terza fonte indipendente** (29,18 vs 29,12): il campo f1db **e'** il
   pit-lane time. Questa domanda **e' chiusa**.
2. **Il metodo per settori e' fisicamente sano a Silverstone**: 0/65 violazioni dei vincoli,
   `track_time` = 7,97 s contro 8–9 attesi a priori. E' la **prima volta** che i vincoli fisici
   passano (in Sessione I saltavano).
3. **La geometria della pit lane di Silverstone e' misurata**: pit-entry **5,79 s prima della
   linea**, `pit_lane_time` **scavalca il confine di giro**, l'in-lap **non perde nulla** perche'
   il taglio di Vale/Club compensa gli 80 km/h. **L'ipotesi S3-in/S1-out era sbagliata.**
4. **Quattro metodi indipendenti convergono su 19,7–21,7** contro i 29,12 di produzione.

**NON guadagnato:**
5. **Nessun fix.** L'IC (4,09 s) non arriva a 3,0 s. **Silverstone resta 29,12.**
6. Il vincolo non e' piu' lo strumento ma il **campione**: 4 gare, 3 utilizzabili, la maggiore
   bagnata.

**Il debito resta aperto, ma non e' piu' lo stesso debito.** Prima di oggi era *"non sappiamo
misurare il pit-loss"*. Ora e' *"sappiamo misurarlo, e la misura e' fisicamente coerente; non
abbiamo abbastanza gare per stringerla"*. E' un debito **diverso e piu' piccolo** — e ha per la
prima volta una via d'uscita nominabile.

---

## Cosa NON e' stato fatto, pur sembrando giustificato (leve vietate, dichiarate)

Il prereg elenca le leve vietate **per nome, prima dei numeri**. Tutte e cinque sono rimaste
chiuse, e due sarebbero state **davvero tentanti**:

1. **Escludere il bagnato.** Darebbe mediana 20,80, due stagioni asciutte in accordo a **0,04 s**,
   e verosimilmente un **GO**. **Non fatto**: e' la leva vietata n.1, e il fatto che porti al GO e'
   precisamente la ragione per cui non puo' essere decisa a valle.
2. **Adottare l'IC pooled** (2,43 s ⇒ GO). **Non fatto**: vedi FF3, il prereg non disambiguava e
   l'IC pooled non contiene nemmeno tutte le mediane osservate.
3. Spostare la soglia FF2 da 1,0 s per catturare S3-in — **non fatto** (impatto: 0,18 s).
4. Passare al bootstrap sugli stop perche' "i blocchi sono pochi" — **non fatto** (mostrato in
   tabella ed **etichettato NON VALIDO**).
5. **Aggiungere stagioni** (FastF1 ha Silverstone dal 2018: ~5 blocchi in piu') dopo aver visto
   che 4 blocchi non bastano — **non fatto**: e' la leva vietata n.5. Va **pre-registrato**.

---

## Proposta per il PO (proposta, non esecuzione — la decisione e' sua)

L'AMBIGUO **non autorizza** una sessione di attivazione. Ma il collo di bottiglia e' ora
**nominabile e attaccabile**, cosa che nell'arco C→I non era mai stata vera. Se il PO volesse
riaprire, la sessione da pre-registrare **prima** dei numeri sarebbe:

- **Piu' blocchi**: Silverstone **2018–2026** via FastF1 (~9 gare invece di 4). E' il singolo
  cambiamento con piu' resa: l'IC non pesato scala ~1/√n_blocchi ⇒ 4,09 · √(4/9) ≈ **2,7 s**,
  che **passerebbe** la soglia di 3,0. **Da pre-registrare, non da assumere.**
- **Asciutto pre-registrato**: dichiarare *prima* che il campione e' "gare asciutte", con la
  definizione di asciutto **incisa prima** di guardare (es. nessun `Compound` INTERMEDIATE/WET
  nella gara), e accettarne l'esito qualunque sia.
- **Attenzione**: entrambe restringono l'IC **anche se il metodo fosse sbagliato**. Vanno
  accompagnate da un test che possa **fallire** — es. il vincolo FF4 su ogni stagione nuova, e la
  **stabilita' di `pit_lane_time`** (che qui e' passata a 0,77 s su 4 stagioni).

Se il PO non riapre: **va bene cosi'**. Silverstone resta 29,12, il debito resta scritto, e questa
sessione ha comunque **chiuso G1 con una terza fonte** e **mostrato che il metodo per settori
regge i vincoli fisici**. Non e' un fix; e' il primo strumento dell'arco che non si rompe in mano.

---

## Indice
- `PREREG_SESSIONE_FF.md` — pre-registrazione, committata **prima** dei numeri (`5b9bc6a`)
- `gen_pitloss_fastf1.py` — generatore committato (nessun orfano)
- `data/fastf1_silverstone_stops.csv` — 65 stop validi, una riga per stop
- `PITLOSS_NOTA_DI_CHIUSURA.md` — l'arco C→I, invariato da questa sessione
- `data/pit_loss_circuito_f1db.NOTA.md` — nota semantica, **confermata** da FF1
