# REPORT — Diagnosi di sincronizzazione della demo animata (pallini vs tabella vs contatore)

**Radice unica: SÌ** — variabile sbagliata: **l'indice di giro globale `floor(p)` / `round(p)`
(il giro del LEADER) usato come se fosse il giro corrente di ogni pilota**, aggravato da
un'ancora temporale sfalsata di un giro: a `p ∈ [L, L+1)` il tempo animato copre il giro
fisico **L+1** del leader, non L.

**Sintomo 1 (VER nei box, giro 17): sfasamento misurato = 6,4 s di animazione / 0,068 giri**
(secondo pit di VER, giro 38 sotto VSC: 15,4 s / 0,132 giri). Legge generale su tutti i 52
pit di Silverstone: sfasamento = distacco dal leader − 0,05·(durata in-lap del pilota),
correlazione col distacco r = 0,978.

**Sintomo 2 (LEC giro 51→52): il contatore scatta a frazione 0,500 del tracciato** (esatta).
Il traguardo fisico di LEC (inizio del giro 52) sta a p = 51,000.

**Riparazione: tocca SOLO il rendering** (`demo/gara.html` + un helper in `demo/timeline.mjs`)
— **rischio golden: nessuno** (11/11 verdi prima e dopo questa sessione; i casi golden fissano
`freezeLap` esplicitamente in `golden_pit_casi.json` e non passano dall'orologio della UI).

Sessione SOLO DIAGNOSI: nessun file di demo/kernel/motore/golden è stato modificato.
Strumento di misura: replica esatta della matematica della demo su
`demo/data/Gran Bretagna.json` (script in scratchpad, non committato).

---

## S0 — Mappa del flusso: dai dati ai pallini

### Da dove legge, cosa usa
- **`demo/data/{gara}.json`** — fetch in `loadGara` (`demo/gara.html:179`). Campi usati dal
  rendering: `n_laps`, `drivers`, e per giro/pilota `cum_time`, `in_lap`, `out_lap`,
  `compound`, `tyre_age`, `stint`, `team`. `pace` serve solo al motore (`evaluatePit`).
  **Semantica verificata sui dati**: `cum_time` al giro L = tempo di SESSIONE cumulato alla
  **fine** del giro L (giro 1 di VER = 3439,1 s: contiene l'offset di partenza della sessione;
  delta giro 2 − giro 1 = 94,919 = `lap_time` del giro 2).
- **`demo/data/pista_{gara}.json`** — tracciato GPS parametrizzato in distanza + pit-lane
  stilizzata con `frazione_ingresso` FE = 0,95 e `frazione_uscita` FX = 0,05
  (`demo/pista.mjs:12-21`).
- `pitstops_2026.json` (solo etichette di durata sosta), `neutralizzazione.json` (bande
  SC/VSC/RF della barra eventi), `esiti.json`, `grids.json`: contorno, non movimento.

### L'orologio dell'animazione
`makeClock` (`demo/timeline.mjs:9-34`): la posizione `p` è **un giro frazionario globale**.
A 1× il "giro L" dell'animazione dura `durFn(L)` secondi reali; `durFn` viene da
`computeDurations` (`demo/timeline.mjs:43-60`) = **delta di `cum_time` del leader tra L e
L+1**. Nota già qui l'off-by-one: `cum[L+1] − cum[L]` è la durata del giro fisico **L+1**,
ma viene etichettata `dur[L]`.

### La posizione del pallino a un istante t (`pistaFrame`, `demo/gara.html:244-268`)
1. `L = floor(p)`, `f = p − L`; **tempo reale globale** `T = leadCum[L] + f·(leadCum[L+1] − leadCum[L])`,
   dove `leadCum[k]` = min `cum_time` al giro k (il leader) — `demo/gara.html:246-249`.
2. Per **ogni pilota**: ricerca binaria sui SUOI `cum_time` (`cumPil[d]`) → primo giro con
   `cum > T` = giro fisico del pilota; frazione `fd = (T − fine_giro_prec) / durata_suo_giro`
   (`demo/gara.html:250-261`). **Questa parte è per-pilota e corretta.**
3. Stato box del pallino: `box = 'in'|'out'` dai flag `in_lap`/`out_lap` del **giro fisico
   del pilota** (`demo/gara.html:262-264`); `pista.mjs:91-96` lo traduce in transito
   pit-lane quando `fd ≥ 0,95` (in-lap, coda del giro) o `fd ≤ 0,05` (out-lap, testa).

### Il contatore giri (globale, per tutti)
`curLap = round(p)` (`demo/gara.html:425`) → `lapLabel`. Non esiste un contatore per-pilota:
il numero mostrato scatta a metà del giro-animazione (`p = L + 0,5`), per definizione di
`round`.

### La tabella ("nei box") — percorso di codice DIVERSO dal pallino
`classificaAt(L, f)` con `L = floor(p)` (`demo/gara.html:339-369`, chiamata da `frame`
a `:426`): l'**ordinamento** interpola i `cum_time` tra L e L+1 (`icum`, `:341-342` —
coerente col tempo T), ma **tutti gli stati** — `in_lap` (→ badge BOX in `paintRow`,
`:411`), `out_lap`, `compound`, `tyre_age`, "monta …" — sono letti da `byLap[L]`, cioè
dal **giro-indice del leader, uguale per tutti i piloti**. Il pallino invece legge gli
stessi flag ma al **giro fisico del pilota**. Due percorsi: tabella = `gara.html:364,411`;
pallino = `gara.html:262-264` + `pista.mjs:91-96`.

### Ruolo di in_lap / out_lap / pout / pin
`in_lap`/`out_lap` sono gli **unici** campi di stato box nei dati gara e pilotano sia il
badge BOX/OUT della tabella sia il transito in pit-lane del pallino (con ancore diverse,
come sopra). **`pin`/`pout` non esistono** in demo (nessuna occorrenza in gara.html,
pista.mjs, timeline.mjs, live.html). `live.html` è un mock statico: nessun pallino lì.

---

## S1 — Riproduzione dei due sintomi (Silverstone / "Gran Bretagna", 52 giri, vince LEC)

### Sintomo 1 — VER ai box (pit ai giri 17 e 38)

| pit | distacco dal leader | TABELLA accende BOX | PALLINO entra in pit-lane | sfasamento |
|---|---|---|---|---|
| giro 17 | 11,1 s | t_anim = 1508,0 s (p = 17,000) | t_anim = 1514,4 s (p = 17,068) | **+6,4 s / 0,068 giri** |
| giro 38 (VSC 37–39) | 20,1 s | t_anim = 3528,2 s (p = 38,000) | t_anim = 3543,6 s (p = 38,132) | **+15,4 s / 0,132 giri** |

In più, sul fronte di **spegnimento**: il pallino esce dalla pit-lane a p = 17,178, ma la
tabella tiene BOX acceso fino a p = 18,000 — **~0,82 giri di "BOX" con la macchina già in
pista** (e al giro dopo mostra OUT mentre il pilota è fisicamente già al giro successivo).

### Sintomo 2 — contatore giri di LEC, 51→52
Il contatore scatta a p = 51,5 (`round`). In quell'istante il pallino di LEC (leader) è al
giro fisico 52, **frazione 0,500 del tracciato** — esattamente a metà pista. LEC taglia
fisicamente il traguardo (inizio giro 52) a p = 51,000. **Sintomo confermato e quantificato.**

### Costante o crescente? Dipende dal distacco?
Misurato su **tutti i 52 pit** della gara (tabella completa nello script di misura):

- media sfasamento: 0,583 giri nei primi 25 giri, 0,925 giri dopo → **cresce durante la
  gara, ma NON è una deriva cumulativa dell'orologio**: cresce solo perché crescono i
  distacchi.
- correlazione sfasamento ↔ distacco dal leader: **r = 0,978**.
- il residuo (sfasamento reale − distacco) è la sola geometria dell'ingresso pit-lane, ed è
  **esatto al centesimo** su ogni caso verificato: −0,05·(durata in-lap del pilota) =
  VER −4,70 vs −4,70 · PIA −6,05 vs −6,05 · ALO −6,24 vs −6,24 · LEC −5,73 vs −5,73 ·
  ALB −4,75 vs −4,75.

**Formula chiusa dello sfasamento: `sfasamento(pilota) = distacco_dal_leader − 0,05·durata_in_lap`.**
È un **offset di ancoraggio pari al distacco corrente**, non una deriva: l'orologio comune è
confermato. Estremi: il leader (LEC, distacco 0) ha solo il residuo geometrico (−4,7/−5,7 s,
il pallino entra in pit-lane un attimo *prima* che la tabella dica BOX); ALB doppiato arriva
a **3,14 giri** di sfasamento (292,7 s al pit del giro 43).

---

## S2 — La radice

**I due sintomi hanno la stessa radice: SÌ.** Stesso asse rotto, letto male in due punti:

1. **La variabile sbagliata**: gli stati per-pilota (BOX/OUT, gomma, età gomma) e il
   contatore giri sono derivati dall'**indice di giro del leader** (`floor(p)` per la
   tabella, `round(p)` per il label) invece che dall'orologio del singolo pilota
   (i suoi `cum_time`). Il pallino è l'unico consumatore che fa la conversione giusta
   (p → T → giro fisico del pilota), quindi tabella e pallino divergono esattamente del
   distacco dal leader.
2. **L'ancora sfalsata di un giro** (colpisce anche il leader): `pistaFrame` mappa
   `p ∈ [L, L+1)` su `T ∈ [leadCum[L], leadCum[L+1]]`, che è il giro fisico **L+1** del
   leader — verificato sui dati: a p = 17,000 LEC è a frazione 0,000 del giro **18**, ma
   tabella e label leggono il giro 17. `computeDurations` è coerentemente sfalsata
   (`dur[L]` = durata del giro fisico L+1). Il `round()` del contatore *maschera* mezzo
   giro di questo ritardo — ed è per questo che lo scatto cade a metà pista invece che
   al traguardo. **Trappola per la riparazione**: il fix ingenuo `round → floor` NON
   basta — con l'ancora attuale il label resterebbe in ritardo di un giro intero
   (per tutto `p ∈ [51, 52)` LEC percorre fisicamente il giro 52).
3. Difetto collaterale documentato: `leadCum[0] = 0` (`demo/gara.html:202`) con `cum_time`
   ancorato al tempo-sessione (~3439 s di offset) rende le frazioni del giro 1 prive di
   senso (schiacciate a ~0,97–1,0); oggi non si vede quasi perché l'animazione parte
   di fatto a fine giro 1.

**Perché il motore NON ha il problema**: `evaluatePit` confronta i piloti a parità di
NUMERO di giro su `byLap` (sincronizzazione per giro: "fine del giro N" di ciascuno),
senza mai proiettare su un asse temporale comune. La proprietà si perde nella demo nel
momento in cui si introduce l'asse T continuo per animare i pallini ma si continua a
indicizzare stato-tabella e contatore col giro-indice del leader: le due viste raccontano
istanti diversi della gara, distanti quanto il distacco di ciascun pilota.

---

## S3 — Proposta di riparazione (NON eseguita)

### Riparazione minimale
Principio: **ogni pilota ha il suo orologio di giro, ancorato ai suoi `cum_time`; il
traguardo del suo giro N sta a `cum_time[N]`**. Un solo helper condiviso, due ancore
corrette:

1. **`demo/timeline.mjs` — `computeDurations`**: `dur[L] = leadCum[L] − leadCum[L−1]`
   (durata del giro fisico L). Il giro 1 non è derivabile dai dati (offset di sessione):
   `dur[1]` = mediana (fallback già esistente), dichiarato come passo d'animazione.
2. **`demo/gara.html` — ancora di `pistaFrame` (riga 247)**: `t0 = leadCum[L−1]`,
   `t1 = leadCum[L]` → `p ∈ [L, L+1)` = leader fisicamente nel giro L. Per il giro 1
   serve un `T_start` condiviso (`leadCum[0] = leadCum[1] − dur[1]` stimata): è solo il
   passo dell'animazione e l'istante di partenza — che è davvero comune a tutti — non
   un dato di gara inventato. Alternativa più conservativa: lasciare il giro 1 com'è oggi.
3. **`demo/gara.html:425`**: `curLap = floor(p)` — con la nuova ancora scatta al traguardo
   del leader, col valore giusto.
4. **`demo/gara.html` — `classificaAt`/`frame`**: estrarre la ricerca binaria di
   `pistaFrame` in un helper unico `giroDi(pilota, T) → {giroFisico, fd, box}`; la riga
   della tabella legge `in_lap`/`out_lap` (→ BOX/OUT), `compound`, `tyre_age`, "monta …"
   da `byLap[giroFisico][d]`; il pallino prende `box` **dallo stesso helper**. Un solo
   percorso di codice per tabella e pallino. L'ordinamento resta su `icum` (già coerente
   col tempo T). Granularità del badge BOX da decidere e dichiarare: raccomando
   BOX = transito pit-lane (stessi bordi del pallino), OUT = resto dell'out-lap.
5. **`demo/pista.mjs`: invariato.**

Nota di consapevolezza: `curLap` alimenta anche `updatePit` (freeze dell'esplorazione pit,
`gara.html:529-534`); col passaggio round→floor il giro congelato può differire di 1 a
parità di posizione del cursore. È semantica UI, non motore — ma va dichiarato nella
sessione di riparazione.

### Impatto
**Solo rendering della demo**: `demo/gara.html` e `demo/timeline.mjs` (helper puri della
UI). Dati e formati: invariati. Kernel, `engine.mjs`, `pitscenario.mjs`, generatori,
golden: **non toccati** → **nessun rischio per motore e golden**. I golden (`test_pit.mjs`)
usano `freezeLap` espliciti da `golden_pit_casi.json` e non attraversano l'orologio UI.

### Casi di verifica per la sessione di riparazione (attesi scritti PRIMA)
1. **VER pit giro 17** (sintomo PO): la tabella accende BOX nello stesso istante in cui il
   pallino entra in pit-lane (oggi +6,4 s) e lo spegne all'uscita (oggi ~0,82 giri dopo).
2. **LEC giro 51→52** (sintomo PO): il contatore scatta quando il pallino di LEC taglia il
   traguardo — frazione 0,00, non 0,50.
3. **Doppiato — ALB, pit al giro 35 (distacco 245 s)**: BOX allineato al SUO transito in
   pit-lane (oggi sfasato di 2,43 giri). Il pallino continua a sparire al suo ultimo giro
   noto (43), invariato.
4. **Pit sotto SC — LEC al giro 48 (SC 46–52)**: leader, sfasamento atteso ≈ 0 (oggi −5,7 s
   di sola geometria); verificare che banner di fase e bande SC sulla barra eventi restino
   coerenti con la nuova ancora (le bande sono indicizzate per giro).
5. **Ultimo a pari giro / doppiato all'arrivo — ALO (51 giri)**: a contatore "52" oggi il suo
   pallino è al giro fisico 51, frazione 0,347; dopo il fix riga "arrivato · 51 giri",
   contatore e pallino devono raccontare la stessa storia.

### Rischio di regressione visiva (cose che sembreranno "diverse" anche se più giuste)
- **Il contatore anticipa di ~mezzo giro** rispetto alla memoria visiva (scatto al traguardo,
  non a metà pista); bande SC/VSC e tacche pit sulla barra eventi sembreranno "spostate".
- **I BOX in tabella si scaglionano**: nella raffica di pit dei giri 46–48 le righe non si
  accendono più tutte insieme allo scatto di `floor(p)` ma ciascuna al suo istante — più
  giusto, ma pare "meno ordinato". Con la granularità-pallino il badge BOX dura ~0,1 giri
  invece di ~1 giro pieno.
- **Le durate slittano di un giro**: ai confini SC/VSC l'animazione rallenta/accelera un
  giro prima di oggi (ora al giro giusto).
- **Giro 1**: con `T_start` stimato i pallini partono dalla linea invece di comparire già
  a fine giro 1; senza stima, comportamento odierno invariato.

---

## Golden
- **Prima della diagnosi**: `node demo/test_pit.mjs` → ✓ 11/11 casi combaciano col golden.
- **Dopo la diagnosi**: ✓ 11/11 (nessun file di codice o dati toccato in questa sessione;
  unico file nuovo: questo report).

Nessun verdetto strategico: la decisione su se/quando riparare è del PO.

---

# RIPARAZIONE ESEGUITA (su decisione PO, sessione successiva alla diagnosi)

Implementata la riparazione minimale di S3, con due scoperte in corso d'opera. File
toccati: `demo/gara.html`, `demo/timeline.mjs`, `demo/pista.mjs` (solo rendering).
Dati, formati, kernel, motore, generatori: **intatti**. Golden ✓ 11/11 prima e dopo.

## Cosa è cambiato
1. **`timeline.mjs` — `computeDurations`**: `dur[L]` = durata del giro FISICO L, come
   delta del **minimo** `cum_time` tra fine giro L−1 e fine giro L (stessa ancora di
   `tempoReale`: vedi scoperta A). `dur[1]` = mediana (il giro 1 non è nei dati:
   `cum_time` è tempo-sessione), dichiarata passo d'animazione.
2. **`timeline.mjs` — `bands`**: geometria a INTERVALLI sull'asse 0 = partenza,
   100 = traguardo (`(p−1)/n`): il giro L occupa `[(L−1)/n, L/n]`; il cursore sta dentro
   la banda esattamente nei giri in cui il banner di fase è acceso (verificato).
3. **`gara.html` — ancora**: `tempoReale(p)` con `p ∈ [L, L+1)` = leader nel giro L
   (`t0 = leadCum[L−1]`); fine gara a `p = n+1` (`clock.reset(n_laps+1)`); `leadCum[0]`
   = partenza stimata (`leadCum[1] − dur[1]`), istante comune a tutti per definizione.
4. **`gara.html` — helper unico `giroDi(d, T)`**: la ricerca binaria sui `cum_time` del
   pilota, estratta da `pistaFrame`, ora alimenta **sia** i pallini **sia** gli stati di
   riga della tabella (BOX/OUT, gomma, età, "monta …"). BOX = transito in pit-lane con le
   STESSE soglie del pallino (esposte da `pista.mjs` come `pitFrazioni`); OUT = resto
   dell'out-lap. Contatore: `curLap = floor(p)` — scatta al traguardo del leader.
   Ordinamento: invariato nel principio (sincronizzato per giro, come il motore), finestra
   spostata su [fine L−1 → fine L] per coerenza con l'ancora; `buildStrat` usa
   `classificaAt(n_laps, 1)` (ordine d'arrivo = fine ultimo giro).

## Scoperte in corso d'opera (oltre la proposta)
- **A. `computeDurations` divergeva dall'ancora ai cambi di leadership**: usava il delta
  dello STESSO pilota leader del giro prima; su Silverstone la somma delle durate sfora
  di 23,3 s il tempo reale del battistrada. Corretto con il min-min: ora il telescopio è
  esatto (5135,1 = 5135,1) e l'orologio dell'animazione è proporzionale al tempo reale su
  ogni giro.
- **B. Parità alla partenza**: `grids.json` non copre Gran Bretagna e, con l'ancora nuova,
  a p=1 tutti i cumulati interpolati partono uguali → l'ordinamento cadeva sull'alfabetico.
  Aggiunto tiebreak sul `cum_time` di fine giro corrente (al via = proxy dell'ordine reale).
- **C. ALO parte dalla pit-lane** (`out_lap=true` al giro 1 nei dati): ora al via il suo
  pallino esce dalla pit-lane e la riga mostra BOX — replay fedele che prima era invisibile
  perché il giro 1 non veniva animato.

## Verifica (casi pre-registrati, script di misura sulla NUOVA matematica + browser)
1. **VER pit giro 17**: BOX tabella e ingresso pallino in pit-lane allo stesso p=18,068
   (sfasamento 0,00 s; era 6,4 s); BOX si spegne all'uscita (p=18,178; prima restava
   acceso ~0,82 giri). Confermato anche a schermo: badge BOX + "pit lane: 28,7s" +
   pallino sul nastro pit nello stesso frame, gomma nuova (età 1) al giro dopo.
2. **LEC 51→52**: contatore scatta a p=52,000 = frazione 0,000 del tracciato (era 0,500).
   A schermo: label 51 a p=51,98, label 52 a p=52,02.
3. **ALB doppiato, pit giro 35**: allineato (0,01 s; era 292,7 s = 2,43 giri); pallino
   sparisce al suo ultimo giro noto (43).
4. **LEC pit giro 48 sotto SC**: allineato (era −5,7 s); fase SC corretta; cursore dentro
   la banda SC per tutti i giri della finestra.
5. **ALO doppiato all'arrivo**: alla bandiera è al SUO giro 51 (fraz. 0,958), riga in coda
   "arrivato · 51 giri". Convenzione dichiarata: esce dalla classifica a p=52 (non ha un
   giro 52 in cui essere classificato), mentre il pallino continua fino al suo ultimo giro.
   Regressione su TUTTI i 52 pit della gara: sfasamento massimo 0,0005 giri (= passo di
   scansione del test).
   Fine gara a schermo: LEC–RUS–HAM–NOR–HAD–LAW–LIN–BOR–ANT–COL = ordine d'arrivo dei dati.

## Nota per il PO (semantica UI, non motore)
`curLap` (che alimenta anche il freeze dell'esplorazione pit) ora è il giro IN CORSO del
leader (`floor(p)`), non più `round(p)`: a parità di posizione del cursore il giro di
congelamento può differire di 1 rispetto a prima. I golden non passano di lì (freezeLap
esplicito nei casi) e restano verdi.

---

# BUG 2 — freeze dell'esplorazione pit (trovato dai tre scenari del PO, riparato)

**La verifica richiesta dal PO ha confermato la divergenza**: dopo il fix di sincronia,
l'esplorazione pit passava al motore un giro **nel futuro** dello schermo congelato.
Causa: la semantica del motore è `freezeLap = L` ⇒ stato reale a FINE giro L
(`pitscenario.mjs:32-33`); con la vecchia ancora, a p=`curLap` lo schermo mostrava
proprio fine giro `curLap` → coerente. Con l'ancora nuova, a p=`curLap` lo schermo
mostra fine giro `curLap−1`, ma `updatePit` passava ancora `L=curLap` (e il click faceva
`round`, che può saltare anche al giro dopo quello guardato).

## I tre scenari (stesso punto del cursore; motore chiamato davvero)
| Scenario | PRIMA: L → risposta | DOPO (bug): L → risposta | Utente crede (fine giro) | FIX-2: L → risposta | Coincide? |
|---|---|---|---|---|---|
| S1 LEC, leader metà gara (48%) | 25 → **P2/12** | **26 → NON VALUTABILE** (LEC ha pittato al 25: niente pace-base al 26) | 24 | 24 → **P2/11**, davanti ANT, dietro NOR | **SÌ** |
| S2 ALB, doppiato (70%) | 37 → non valutabile | 37 → non valutabile | 36 | 36 → non valutabile (limite dichiarato del motore: pit al 35, pace-base assente) | **SÌ** |
| S2b ALB, doppiato tra i suoi pit (57,5%) | 30 → P1/1 aria pulita | 31 → P1/1 | 29 | 29 → **P1/1 aria pulita** (a pari giro è solo) | **SÌ** |
| S3 VER, subito dopo il SUO pit (33,1%) | 18 → non valutabile | 18 → non valutabile | 17 | 17 → **P7/21**, davanti NOR, dietro LAW [gap n/d: neutralizzazione] | **SÌ** |

Nota S3: la coerenza col visibile rende VALUTABILE un caso che era morto anche PRIMA del
fix di sincronia (freeze sull'out-lap = pilota senza pace-base). Nota S2/S2b: per un
doppiato "pit al giro P" resta sull'asse dei SUOI giri e il confronto è "tra i piloti a
pari giro" — semantica per-giro del kernel, identica in tutte le versioni, non toccata.

## Riparazione (solo `demo/gara.html`, tre punti)
1. Click sulla riga: `curLap = floor(clock.position)` (non `round`) — si congela il giro
   che l'utente sta GUARDANDO; il seek porta al suo inizio = fine giro `curLap−1`.
2. `updatePit`: `freezeLap = max(1, curLap−1)` — lo STESSO stato della tabella congelata.
3. Slider: `min = max(2, curLap)` — si può pittare già al giro in corso (in-lap =
   `curLap`), come al muretto; al giro 1 il freeze è clampato a 1 (dichiarato).

Verificato anche a schermo: cursore al 48%, "Giro 25", click su LEC → slider da 25,
"Rientro P2 tra i 11 a pari giro". Motore e golden intatti: ✓ 11/11 prima e dopo.
