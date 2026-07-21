# PREREG — il DEGRADO 2026, vivo

Scritto **prima** di qualunque numero di degrado del 2026. Branch `ai-lab/degrado-2026-live`,
21/07/2026. Prosecuzione di `PREREG_degrado.md` (commit a61e0a5), stesso fenomeno, **regime
nuovo** e obiettivo nuovo: non una misura da tavolo, ma un **modello vivo** agganciato al
pattern `PATTERN_MODELLI_VIVI.md`, che si ricalibra da solo e **resta spento finché non se
l'è guadagnata**.

---

## 0. Il muro che la sessione precedente ha lasciato in piedi, e cosa ne faccio

`esito_degrado.json` dice, per il 2026: `n_gare_utili: 0, misurabile: false`. Non perché
manchino i dati, ma per **una regola**: `degrado.neutralizzata()` butta fuori dal
controfattuale **l'intera gara** se anche **un solo giro** di un solo pilota è sotto SC/VSC
(status che contiene '4' o '6').

Censimento del fondo 2026 (generatore: `gen_degrado_2026.py --censimento`, eseguito **prima**
di questo prereg perché riguarda la *disponibilità dei dati*, non il fenomeno):

| | |
|---|---|
| gare 2026 nel fondo | **10** |
| gare bagnate (escluse a priori) | **0** |
| gare con almeno un giro neutralizzato | **10 su 10** |
| quota di giri neutralizzati, per gara | **dal 5,7 % al 15,9 %** |

**La regola costa il 100 % del regime per proteggersi dal ~10 % dei giri.** Nel 2022-25,
dove le gare pulite esistevano, era un lusso che ci si poteva permettere. Nel 2026 è un
divieto di misurare.

### La modifica, dichiarata QUI e non dopo aver visto i risultati

Sostituisco il **veto di gara** con la **contabilità a giri verdi**:

> Il confronto (reale contro simulato) si somma **solo sui giri verdi** del pilota — status
> '1' —, **identici sui due lati**. L'**età gomma avanza su tutti i giri** (la gomma invecchia
> anche dietro la safety car); solo il **conteggio del tempo** salta i giri neutralizzati.

Perché è lecito, e perché non è un ammorbidimento di comodo:

1. **Il cancello di calibrazione era già la vera protezione.** Se una gara contiene secondi
   che il degrado non può spiegare, `|sim(strategia reale) − reale|` esplode e il caso viene
   escluso da sé, come *non valutabile*. Il veto di gara era **ridondante** con un cancello
   più fine, non additivo.
2. **Il veto sporcava `tol`.** `tol` è il 68° percentile di `|sim(reale) − reale|` sulle gare
   di calibrazione: se tutte le gare contengono SC, `tol` si gonfia dei secondi di safety car
   e il cancello di margine (`> tol`) diventa arbitrario. Togliere i giri neutralizzati
   **stringe** `tol`, cioè rende il metro **più severo**, non più generoso.
3. **Lo sconto-pit sotto SC resta un effetto che il modello NON ha**, e resta un rischio a mio
   sfavore: chi si è fermato sotto SC ha pagato meno di quanto il modello gli addebita, quindi
   `sim(reale) > reale` e il caso cade nel cancello di calibrazione. Non lo nascondo: lo
   **conto** e lo riporto.

### E la verifica che può smentirmi (dichiarata prima)

La regola nuova non si adotta sulla fiducia. Sul **2022-25**, dove esistono gare pulite,
girano **entrambe le contabilità sullo stesso fondo**:

> **FALSIFICAZIONE F**: se la contabilità a giri verdi produce una `X` **sistematicamente più
> alta** di quella a veto-di-gara sulle stesse gare 2022-25 — differenza appaiata per gara con
> IC95 (bootstrap sui blocchi) che **esclude lo zero verso l'alto** — allora la regola nuova
> **gonfia le vittorie** ed è **respinta**: il 2026 torna non misurabile e lo dichiaro.

Se F non scatta, la regola è uno **strumento più fine**, non un rubinetto.

---

## 1. Il primo piano resta FERMO sotto di me

Il carburante entra **congelato**, come in `PREREG_degrado.md` §0: per il 2026 **numero unico
globale** (`carburante_fermo.delta('*', '2026')`), perché con una gara per circuito il
per-circuito non è calcolabile. Non lo ri-stimo, non lo ritocco.

**Il per-circuito del degrado NON si cerca.** È già stato falsificato (0 circuiti veri su 8,
commit a61e0a5) e la memoria del progetto lo registra. Cercarlo di nuovo sarebbe rifare una
domanda già chiusa. In C2 il circuito compare **solo come raggruppamento diagnostico**, per
vedere *dove* si fallisce — mai come parametro da stimare.

---

## 2. C1 — il modello più semplice, calibrato SOLO sul 2026

Forma identica a `PREREG_degrado.md` §3, stimata **dentro il solo regime 2026**:

```
t − carburante_congelato(L) = α_pilota + δ_mescola + β·(giro − ḡiro)
                              + Σ_c ρ_c · età · 1[mescola = c] + ε
```

- `ρ_SOFT`, `ρ_MEDIUM`, `ρ_HARD` = il degrado, s/giro per giro di vita gomma.
- Stima **per gara** (blocco), poi aggregata con la **mediana cross-gara**; intervalli con
  `scheletro.bootstrap_a_blocchi` (**sotto sigillo**: la chiamo, non la tocco), blocchi = gare.
- Aria libera per la stima: `gap > 5,0 s` (ultra-conservativo, come il prereg madre).
- SE cluster-robust per (pilota, stint). Effetti fissi di pilota, mai di stint.
- **Nessun coefficiente ereditato da altri regimi.** Il 2026 è una rottura regolamentare.

**Controllo di sanità (check, NON vincolo):** l'ordinamento `ρ_SOFT > ρ_MEDIUM > ρ_HARD` deve
uscire **da solo** dai dati. Non lo impongo con nessun vincolo di segno o di ordine. Se non
esce, lo riporto come tale — è informazione sul regime, non un fallimento da correggere.

**Intervalli larghi si riportano larghi.** 10 gare sono 10 gare: nessuna cifra decimale verrà
difesa oltre quello che l'IC95 sostiene.

### Che cosa VIAGGIA fra le gare, e che cosa no — più severo del prereg madre

La sessione precedente misurava la X usando, su ogni gara, **il ρ stimato su quella stessa
gara**: fuori campione per `tol`, **dentro campione per ρ**. Un modello *vivo* non può
permetterselo — al via di domenica il ρ dev'essere già noto. Quindi:

| parametro | viaggia? | perché |
|---|---|---|
| **ρ_c** (degrado) | **SÌ**, aggregato dalle sole gare di **calibrazione** | è l'oggetto sotto esame, ed è **proprietà della mescola, non della pista** (per-circuito già falsificato, 0 su 8) |
| **δ_c** (offset mescola) | **NO**, per-gara | «SOFT» a Monaco non è la stessa gomma fisica che a Silverstone: l'assegnazione delle mescole cambia a ogni evento |
| **α_pilota**, **β** | **NO**, per-gara | passo del pilota ed evoluzione pista di *quella* domenica: parametri di disturbo, non trasferibili |

È un test **più severo** di quello della sessione precedente, non più permissivo. Il degrado-zero
del cancello (A) riceve **esattamente gli stessi** α, β, δ: cambia solo ρ. Il confronto è appaiato
sul parametro sotto esame e su nient'altro.

---

## 3. Il metro — batte la strategia reale

Invariato rispetto al prereg madre (§1), salvo la contabilità a giri verdi di §0:

> Il modello sa trovare una strategia (giri di pit + mescole) che fa **meno tempo** di quello
> che il pilota ha fatto davvero, sugli **stessi giri verdi**?

Due cancelli, non uno:

1. **Calibrazione**: `|sim(strategia reale) − reale| ≤ tol`, altrimenti il caso **non è
   valutabile** (né vittoria né sconfitta) e viene **contato fra gli esclusi**.
2. **Margine**: vittoria solo se `sim(ottima) < reale − tol`.

`tol` = **68° percentile di `|sim(reale) − reale|` sulle sole gare di calibrazione**, applicato
alle gare di verifica. Derivato dai dati, e da dati diversi da quelli su cui giudica.

**Aria libera al rientro**: un caso è ammesso solo se il rientro di **ogni** sosta della
strategia ottima cade oltre `G*`. I casi con rientro in traffico si **escludono e si contano**
(differiti, come da prereg madre). `G*` = 1,5 s, **ereditata come costante dichiarata** da
`esito_degrado.json` (derivata sullo storico con la procedura sigillata): non la riderivo sul
2026, e questo è un **limite dichiarato**, non una misura nuova.

**Ottimo ESATTO, non euristico.** Con la contabilità a giri verdi il costo di uno stint dipende
anche da *dove* inizia, non solo da quanto è lungo. Resta esatto con le somme prefisse
sui giri verdi:
`costo(c, inizio s, lunghezza n) = δ_c·V(s,n) + ρ_c·[ Σ_{L verde ∈ [s,s+n)} (L−s+1) ]`,
entrambe O(1) da due cumulate. Nessuna euristica, nessuna ricerca approssimata.

### Due dettagli di contabilità, fissati QUI perché sono entrambi sfruttabili

**(a) Il pit-loss si conta SEMPRE, su entrambi i lati.** `k · pit_loss` per una strategia a `k`
soste, che i giri della sosta siano verdi o no. Se contassi la sosta solo quando l'in-lap è
verde, l'ottimizzatore imparerebbe a **nascondere le soste sotto la safety car** per non pagare
il pit-loss: vincerebbe per un artefatto della contabilità, non per fisica. Contandolo sempre,
la simmetria è esatta e il trucco è impossibile. Il prezzo lo pago io: chi si è fermato
davvero sotto SC ha speso **meno** di `pit_loss`, quindi `sim(reale) > reale` e il caso finisce
fra gli **esclusi** del cancello di calibrazione. È la direzione giusta in cui sbagliare.

**(b) La traiettoria per il controllo di aria libera al rientro usa TUTTI i giri**, anche i
neutralizzati, dove la previsione è dichiaratamente sbagliata. Serve solo a **schermare** i
casi con rientro in traffico — non entra nel punteggio. Limite dichiarato: sotto SC il gruppo
si compatta e i miei gap previsti risultano troppo larghi, quindi **escludo di meno** di quanto
dovrei. Contato e riportato.

**Fuori campione, sempre.** Gare 2026 ordinate per data: **indici pari = calibrazione**,
**dispari = verifica**. `ρ`, `tol` e (in C3) la soglia del cliff si stimano **solo** sulle
gare di calibrazione. La `X` si misura **solo** sulle gare di verifica. Mai la stessa gara nei
due ruoli.

---

## 4. CRITERIO DI STOP e CANCELLO DI ACCENSIONE — dichiarati PRIMA

**Numerosità** (adattata al regime, e la adatto *qui*, non dopo): ≥ **30 casi valutabili**
nell'insieme di **verifica**, su ≥ **4 gare distinte** (il 2026 ha 10 gare: la metà sono 5, e
pretendere «≥ 8 gare distinte» dal prereg madre sull'insieme di verifica sarebbe impossibile
per costruzione). Sotto questa soglia: **NON GIUDICABILE**, e si dice così.

Il modello si propone al live **solo se supera entrambe** le condizioni, su **gare di
verifica**:

- **(A) PREDITTIVA — batte il non-fare-niente.** Il «non fare niente» del degrado è il
  **degrado-zero**: `ρ_c = 0` per ogni mescola (le gomme non calano). Condizione: l'errore di
  ricostruzione `|sim(strategia reale) − reale|`, mediano per gara, dev'essere **minore** col
  modello che col degrado-zero, e la **differenza appaiata per gara** dev'essere IC95
  (`bootstrap_a_blocchi`, blocchi = gare) che **esclude lo zero**.
- **(B) PRODOTTO — abbastanza netto.** `X ≥ 60 %` dei casi valutabili **e** margine mediano
  delle vittorie `≥ 2·tol`. Soglie **identiche** al prereg madre §4: non le tocco, così non
  posso essere accusato di averle cucite addosso al risultato.

Finché non le soddisfa, il json del modello scrive `ACCENDIBILE: false` e **il modello resta
spento da solo**. L'accensione è **umana** (firma Tommi). Io riporto, non accendo.

---

## 5. C2 — dove fallisce

I casi **persi** e i casi **esclusi dal cancello di calibrazione** si raggruppano per:
**mescola · lunghezza dello stint · età gomma raggiunta · temperatura pista (`wTT`, solo per
raggruppare) · circuito** (diagnostico, §1).

**Ipotesi portata dal dominio, dichiarata prima di guardare:** è il **CLIFF** — il crollo non
lineare a fine vita — che il lineare manca? **Predizione falsificabile**: se è il cliff, i
fallimenti e i residui positivi devono **concentrarsi sugli stint lunghi / sulle età gomma
alte**, e il residuo mediano del modello lineare dev'essere **crescente con l'età** nella coda.
Se invece i residui sono piatti in età, **il cliff non c'è nei dati 2026** e lo dico — e C3 non
ha un bersaglio.

---

## 6. C3 — UN termine, uno solo, con il freno dichiarato prima

Se e solo se C2 indica il cliff: **soglia + rampa**, la forma più povera che rappresenta un
crollo a fine vita:

```
degrado(c, età) = ρ_c · età + γ_c · max(0, età − k_c)
```

`k_c` (il ginocchio) **derivato dai dati**, per griglia, **solo sulle gare di calibrazione**.

**Margine dichiarato PRIMA**: C3 batte C1 solo se, sulle **gare di verifica**, la differenza
**appaiata per gara** di `X` (C3 − C1) ha IC95 (`bootstrap_a_blocchi`) che **esclude lo zero
verso l'alto**. Un `X` più alto senza questo requisito **non basta**: con 5 gare di verifica
una differenza di qualche punto è rumore, e lo so già adesso.

**PLACEBO OBBLIGATORIO** (la trappola si tende **prima** di guardare il risultato): il termine
di cliff aggiunge **flessibilità**, e la flessibilità da sola migliora il fit. Perciò il ginocchio
vero si confronta con un **ginocchio finto**: `k` estratto **a caso** nello stesso intervallo di
età, con la stessa procedura e lo stesso numero di gradi di libertà, ripetuto molte volte.

> Se il ginocchio finto guadagna **quanto** quello vero, il guadagno è **artefatto di
> flessibilità** e C3 è **respinto**, qualunque cosa dica `X`.

Se C3 non supera margine **e** placebo: **dichiarato e scartato.** Nessun secondo tentativo
mascherato da «variante», nessuna riapertura in questa sessione.

---

## 7. Confondimenti, dichiarati prima di misurare

| con cosa | come lo isolo | che cosa resta |
|---|---|---|
| **carburante** | congelato sotto e sottratto; `β` assorbe il residuo lineare | `ρ` poco sensibile alla scelta del carburante; resta la contaminazione nei **totali** |
| **traffico** | stima solo su `gap > 5 s`; caso ammesso solo se ogni rientro cade oltre `G*` | i casi con rientro in traffico sono esclusi e **contati** |
| **evoluzione pista** | assorbita da `β` | non separabile: dichiarata |
| **SC/VSC** | contabilità a giri verdi (§0) + cancello di calibrazione | lo **sconto-pit sotto SC** resta un effetto assente dal modello, **a mio sfavore**, contato |

---

## 7-bis. EMENDAMENTO — il degrado-zero si RISTIMA (dichiarato prima dei numeri)

Aggiunto dopo il commit del prereg (dbc08b4) e **prima di eseguire qualunque misura**, perché
scrivendo il codice mi sono accorto che la versione di §4A costruiva un **fantoccio**.

§4A diceva: degrado-zero = «`ρ_c = 0`, tutto il resto identico», cioè lo stesso fit con le `ρ`
azzerate a mano. Ma un modello a cui si spegne un termine **dopo** averlo stimato è più debole
di un modello che non l'ha mai avuto: `α`, `β` e `δ` sono rimasti tarati *sapendo* che c'era il
degrado, e non possono assorbirne il livello medio. Batterlo sarebbe stato facile e non
avrebbe voluto dire niente.

**Correzione**: il degrado-zero si **ristima da capo** sugli stessi giri, con la stessa
procedura, **senza le colonne dell'età** — così `α`, `β` e `δ` assorbono tutto quello che
possono. È il vero «non fare niente»: chi non modella il degrado non lascia un buco, ci mette
dentro una costante.

Il cambiamento va **contro** il modello sotto esame: alza l'asticella del cancello (A). Lo
dichiaro qui, con la sua data e la sua ragione, invece di scoprirlo comodo a valle.

---

## 7-ter. EMENDAMENTO — il pit-loss si ricostruisce dalle SOLE soste verdi

Aggiunto **dopo** aver visto il primo giro di numeri di C1. Lo dichiaro come tale, con la sua
data, la sua ragione e la sua prova: è esattamente il momento in cui si bara, e voglio che sia
ispezionabile.

**Il sintomo.** Il primo C1 ha prodotto `tol = 223,9 s` su una gara da ~50 giri verdi: **~4,5 s
al giro**. Un metro così largo non giudica niente. Lo scarto era **positivo** (+0,79 s/giro):
il modello prevedeva i piloti **più lenti** di com'erano andati.

**La diagnosi, dal fondo.** I residui per giro sono sani — mediana `reale − previsto` fra
−0,16 e +0,10 s, **in aria libera come in traffico**. Il traffico non c'entra. Il buco è tutto
nel **pit-loss**, che `degrado.pit_loss()` ricostruisce come mediana su **tutte** le soste:

| gara 2026 | soste verdi | soste sotto SC/VSC | pit-loss da TUTTE | da sole VERDI | da sole NEUTRALIZZATE |
|---|---|---|---|---|---|
| Australia | 10 | 22 | **51,84** | 24,95 | 54,55 |
| Canada | 8 | 17 | **57,28** | 25,14 | 62,26 |
| Cina | 3 | 12 | **73,70** | 26,84 | 75,68 |
| Giappone | 4 | 12 | **61,82** | 23,39 | 71,68 |
| Monaco | 19 | 67 | **64,29** | 21,78 | 70,11 |
| Miami | 16 | 1 | 19,53 | 19,53 | 96,45 |
| British | 18 | 10 | 25,97 | 20,97 | 32,45 |

Una sosta fatta **sotto safety car** costa, in cronometro, i secondi del regime neutralizzato:
ricostruita come «perdita al pit» vale 32-96 s invece di ~20-25. E sotto SC ci si ferma
**tutti insieme**: in metà delle gare 2026 le soste neutralizzate sono la **maggioranza**, così
la *mediana* — che avrebbe dovuto proteggere — è contaminata. Il pit-loss gonfiato entrava in
`sim` come `k · pit_loss` e produceva da solo i 4,5 s/giro.

**La correzione.** Il pit-loss si ricostruisce dalle **sole soste con in-lap e out-lap
entrambi verdi**. Non è una regola nuova: è la **stessa** di §0 — *il tempo si conta solo sui
giri verdi* — applicata a una grandezza che è essa stessa un tempo misurato dal fondo. Non
averla applicata lì era una svista, non una scelta.

**Perché non è un ammorbidimento di comodo:**

1. **Non è un criterio, è una misura.** Non ho toccato nessuna soglia di giudizio: `X ≥ 60 %`,
   `margine ≥ 2·tol`, IC95 che esclude lo zero restano **identici**. Ho riparato lo strumento,
   non spostato il traguardo.
2. **La prova è interna al fondo e indipendente dal risultato.** La separazione verdi/
   neutralizzate (19,5-26,8 s contro 32-96 s) si vede **senza guardare la X**.
3. **Corroborazione esterna, come CONTROLLO e non come input** (il prereg madre §2 vieta di
   ereditare numeri di pit-loss): la mia ricostruzione da sole soste verdi dà **Miami 19,53** e
   **Silverstone 20,97**; i valori che il progetto ha in produzione, derivati da **FastF1** —
   fonte completamente diversa — sono **20,11** e **20,80**. Due strade indipendenti, stessa
   risposta a mezzo secondo. Nessuno di questi numeri entra nel calcolo.
4. **Colpisce entrambi i lati.** Il pit-loss è lo stesso per il modello e per il degrado-zero,
   e lo stesso per C1 e per C3: non inclina nessun confronto appaiato.

**Conseguenza procedurale**: tutto ciò che era stato calcolato prima (F, F2, C1) si **rifà da
capo** col pit-loss corretto, e il rapporto riporta **prima e dopo**. Il primo giro di numeri
non si cancella: si mostra.

---

## 8. Vincoli

Solo il fondo senza riverifica · blocchi = gare, mai osservazioni · ogni valore col suo
generatore committato · il permutation-null e `bootstrap_a_blocchi` sono **sotto sigillo**: li
**chiamo**, non li tocco; se nasce un null nuovo **non lo auto-sigillo** (serve `--attore`, lo
sigilla Tommi al merge) · kernel di produzione non toccato oltre l'aggancio `degrado` **già
predisposto** in `demo/engine.mjs` · il golden resta verde dove il modello è spento ·
**nessun push, PR, merge**: li fa Tommi · l'agente porta la X, **decidono gli umani**.
