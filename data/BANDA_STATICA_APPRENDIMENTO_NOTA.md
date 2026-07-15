# NOTA APPRENDIMENTO — Banda statica degrado: NON-VALIDATO fuori campione

*Da committare accanto a `data/BANDA_DEGRADO_VALIDAZIONE_REPORT.txt`. Chiude l'arco "banda
statica come prior" e instrada v2. Come sempre: incidere il PERCHÉ, per non ri-percorrere.*

## 1. Cosa abbiamo testato
La banda di degrado del gancio v1.5 poteva nascere da un **prior storico statico**? Costruita
la banda `[0, max]` sui percentili della perdita marginale degrado-isolata **solo 2023-2024**,
e validata **fuori campione sul 2025** tenuto da parte. Soglie congelate PRIMA dei numeri:
copertura ≥70% fuori campione + utilità (larghezza 5 giri ≤25% del pit-loss di circuito).
Entrambe dovevano reggere.

Banda scelta (s/giro, compound-agnostica, da 2023-24): min **0.000** (pavimento imposto),
centrale **0.045** (mediana), max **0.326** (90° pctile).

## 2. Esito: NON-VALIDATO
- **Copertura 2025 = 56.9%** vs ≥70% → **FAIL** (SOFT 52.1%, MEDIUM 58.5%, HARD 56.6%).
- **Utilità = PASS** su tutti i 24 circuiti (rapporto mediano 0.070, peggiore 0.090 a
  Melbourne, vs ≤0.25).
- Esito meccanico: **NON-VALIDATO** (copertura cade, utilità regge). Onorato senza toccare le
  soglie dopo aver visto i numeri.

## 3. Il fatto strutturale (vale più del 56.9%)
**Il 38.1% degli stint 2023-24 ha degrado marginale isolato NEGATIVO** — in coda non sono più
lenti del centro, a volte più veloci (evoluzione pista, raffreddamento, gestione). Non è
rumore: è reale e diffuso. Conseguenze:
- Il **pavimento a 0** (imposto come "operativamente obbligatorio") forfeita quel 38% per
  costruzione → **qualsiasi** banda `[0, max]` ha un tetto di copertura ~62% in-sample e ~63%
  sul 2025, **anche con max = +∞**. Il 70% non era severo: era **irraggiungibile in linea di
  principio** con quella forma di banda.
- Lo **sweep p70→p100** lo dimostra: `util≤0.25` regge fino a p99, ma `cov_2025` satura a
  63.2% e non tocca mai il 70%. **Nessun `max` concilia le due soglie.** Non c'era una
  taratura "quasi giusta" da inseguire — ed è ciò che ha reso impossibile l'autoinganno di
  continuare a limare il bordo.
- Il buco fuori campione è **dal basso**: il 36.6% del 2025 sfonda sotto il floor, solo il
  6.5% dalla coda alta.

## 4. Errore di disegno riconosciuto (di chi ha scritto la spec, non dell'esecuzione)
La forma `[0, max]` è **a un lato** contro una distribuzione **a due lati**. La giustificazione
"degrado negativo non ha senso fisico" regge come fisica (la gomma non ringiovanisce) ma
**sbaglia operativamente**: il gancio non modella il degrado in astratto, modella l'**effetto
netto sul passo di restare in pista**, e quell'effetto misurato è negativo il 38% delle volte.

## 5. Cosa è dimostrato e cosa NO (distinzione epistemica, non sfumatura)
- **DIMOSTRATO:** un prior storico statico unilaterale `[0,max]` **non generalizza** in
  copertura al 2025, e per struttura non può raggiungere il 70% su questa distribuzione.
- **NON dimostrato:** che un modello **guidato dal weekend** generalizzi meglio. È l'ipotesi
  più plausibile — il buco è dal lato che solo il weekend può informare — ma **manca la
  misura**.
- Formulazione corretta da portare avanti: *"Il fallimento del prior statico rende il modello
  guidato dal weekend il **candidato principale** per la v2"* — non "la prova che serve il
  weekend". La differenza è la stessa disciplina che distingue una correlazione da una causa.

## 6. Cosa NON faremo
- **Non ritentare subito una banda statica a due lati** `[min<0, max]` come "correzione" di
  questo test: risponderebbe a una domanda DIVERSA. Se un giorno la si prova, è un
  **esperimento nuovo con KPI nuovo pre-registrato**, non un aggiustamento retroattivo di
  questo. (Caveat di dominio se la si prova: una banda che scende sotto zero dice all'utente
  "allungare potrebbe farti guadagnare passo" — vero a volte, ma come prior statico su una
  gara ignota è un messaggio che invita a restare fuori senza base.)
- **Non buttare 6 predittori insieme** contro il degrado in v2 (FP2, FP3, temperatura,
  abrasività, compound, fuel-corrected…): con tanti segnali e un degrado di coda rumoroso,
  qualcosa correla per caso. Un predittore alla volta, ognuno deve battere il baseline storico
  per entrare — lo stesso cancello che tenne i termini soft fuori dal kernel.

## 7. Cosa è comunque solido dopo questo arco
Il **meccanismo** regge: il gancio v1.5 gira coerente con la banda scelta (tre scenari
ordinati, banda-zero bit-identica), e l'utilità larghezza-vs-pit-loss passa netta ovunque.
Non manca il tubo — manca **l'acqua giusta da metterci**: un prior che il singolo weekend
informa. Ed è lì che va v2.

## 8. Prossimo passo (scoping, non ancora build)
Domanda stretta, un solo segnale: **il degrado di coda osservato nei primi ~15 giri di gara
predice il degrado di coda della parte finale della stessa gara, meglio del prior storico
archiviato?** Solo dati intra-gara, **nessuna FP ancora** (fuel ignoto, programmi diversi,
evoluzione pista feroce — "oro solo se isoli il long-run, veleno se preso grezzo"). Se nemmeno
il segnale della gara stessa predice la gara stessa, l'FP non salverà, e lo sapremmo a costo
minimo. Se predice, l'FP entra come **secondo strato con KPI nuovo**. Baseline da battere = il
prior statico appena archiviato, non il vuoto. Anche v2 può dare un NULL onesto.
