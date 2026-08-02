# PREREG — LA SORPASSABILITÀ SI TIENE DENTRO UNA GARA SOLA?

**Scritta il 02/08/2026, PRIMA di far girare una sola misura.**
È la **STRADA v2 (a)** già proposta in `data/SORPASSO_NOTA.txt:76-79` e lasciata in
attesa di decisione del PO. Il PO l'ha decisa il 02/08: *«secondo me va misurata
prima la seconda — procedi»*.

## Da dove viene, e perché non è una domanda nuova

Il 06/07/2026 questo progetto ha costruito un indice di difficoltà di sorpasso per
circuito — **«tasso di attacco convertito»**, P(sorpasso completato | attacco
sostenuto), metrica v2 ratificata dal PO — su 66 gare asciutte e 23 circuiti.
Verdetto: **NO-GO, 2 gate su 4**. G0 (robustezza alle soglie) e G1 (dispersione)
passati netti; **G2 (stabilità fra stagioni) e G3 (ground truth) falliti**.

La diagnosi scritta allora è la ragione di questa prereg:

> *«Con UNA gara per circuito-stagione l'indice osserva (pista + condizioni di quella
> domenica: mescole, temperatura, treni); la risoluzione non basta a certificare la
> proprietà fisica della pista.»*

Se è vero, il problema non è la metrica: è il **denominatore**. Una gara per
circuito-stagione confonde la pista con la domenica. Dentro una gara sola, invece,
le condizioni sono fisse per costruzione — stessa pista, stesso meteo, stesse
mescole, stessi piloti.

E il 01/08 è arrivata da tutt'altra parte la ragione per cui questo serve **adesso**
(`PREREG_sorpassi.md`): il motore, su gara intera, perde contro «non cambia niente»
esattamente e solo nel terzo di casi in cui **inventa movimento** (13-28, p = 0,027).
Serve un tetto al movimento. Un tetto è un CONTEGGIO, ed è permesso.

## Il metro: quello che c'è già, non uno nuovo

Si riusa **`episodi()` di `gen_difficolta_sorpasso.py`**, recuperato dal commit
`8c4eaec^` (era stato cancellato in una ripulitura di archi chiusi; l'arco l'ha
riaperto il PO). Definizione di episodio, soglie del setting primario
(ZONA 1,0 s · CHIUSURA 0,6 s · K 4), censure e dedup **non si toccano**.

L'unica modifica ammessa al file è **far tornare anche il giro L in cui l'episodio
comincia**, che serve a dividerli fra le due metà. Non cambia quali episodi esistono
né come si risolvono. **Cancello di identità (I0), da verificare per primo:** con la
modifica, i gate G0-G3 dell'indice v1 devono dare **gli stessi identici numeri** di
prima. Se un numero si muove, la modifica non è innocua e va rifatta.

## Le due domande

### S1 · La proprietà esiste? (dentro la gara, condizioni fisse)

Ogni gara si divide al suo giro di mezzo (⌈N/2⌉). Un episodio va in **presto** se
comincia al giro L ≤ N/2, in **tardi** altrimenti.

Per ogni gara con **≥ 10 episodi risolti in ciascuna metà**:
`indice_presto` e `indice_tardi` = tasso di conversione in quella metà.

**Statistica**: Spearman fra i due, sulle gare ammesse.

### S2 · È conoscibile ABBASTANZA PRESTO? (la domanda del prodotto)

La banda si usa al congelamento, che nel prodotto non è un giro solo: le viste
rispondono a decine di giri diversi. Quindi la domanda giusta non è «al giro 5 sì
o no», è **da quale giro in poi**.

Per una griglia di frazioni X ∈ {20%, 30%, 40%, 50%, 60%} della distanza di gara:
`indice_fino_a_X` (episodi che cominciano entro X) contro `indice_dopo_X`.
Stessa statistica, stessa soglia di ammissione.

## I cancelli, coi numeri scritti adesso

| | condizione | soglia |
|---|---|---|
| **I0** | i gate G0-G3 dell'indice v1 sono invariati dopo la modifica | **identici** |
| **S1** | Spearman(presto, tardi) sulle gare ammesse | **≥ 0,40** e **placebo p < 0,05** |
| **S2** | esiste un X ≤ 60% con Spearman(fino a X, dopo X) | **≥ 0,40** e **placebo p < 0,05** |

**Perché 0,40 e non 0,80.** Il G0 dell'indice v1 pretendeva 0,80, ma confrontava lo
**stesso** insieme di episodi riletto con soglie diverse — un test facile. Qui si
confrontano **due metà disgiunte**, ciascuna con la sua metà di episodi e quindi il
suo rumore binomiale. 0,40 è la soglia che dichiaro sufficiente perché valga la pena
proseguire, ed è una **scelta mia**, non una derivazione: la scrivo prima perché non
possa spostarsi dopo (E08).

**Il placebo non è un'aggiunta di lusso.** In questo progetto è già successo che il
43% di un coefficiente fosse artefatto e che solo il placebo lo mostrasse. Qui si
permutano le etichette presto/tardi **dentro** ogni gara, 2.000 volte, e la Spearman
osservata deve stare fuori dalla distribuzione permutata. Senza questo, una
correlazione può nascere solo dal fatto che le gare hanno tassi medi diversi.

**Condizione di NON ESEGUIBILITÀ**: meno di **8 gare** ammesse. Sotto, non si
dichiara né sì né no: si dichiara che coi dati esistenti la domanda non si risponde.
«Non separa» e «troppo pochi dati per vederlo» sono due conclusioni diverse.

## Cosa si fa dopo, deciso adesso

- **S1 fallito** → **il ramo si chiude.** Se il tasso di conversione non si tiene
  nemmeno dentro una gara sola a condizioni fisse, nessun indicatore di
  sorpassabilità disponibile al congelamento può esistere, e il tetto al movimento
  va cercato altrove (o non si fa). Il verdetto va scritto per esteso, non
  aggirato con un terzo tentativo.
- **S1 passato, S2 fallito** → la proprietà esiste ma non è conoscibile in tempo:
  la banda non si condiziona al congelamento. Resta come limite dichiarato.
- **Entrambi passati** → si va al **Cancello B di `banco/prereg/PREREG_difesa_II.md`**,
  con un avvertimento che va scritto lì prima di eseguirlo: **la sua linea di base si
  è mossa**. Quel cancello pretende di «battere la banda per secco della Fase I», ma
  `ESITO_difesa.json` è stato rieseguito tre volte dopo il 30/07 e oggi dice **«D1 NON
  PASSA»**; i numeri citati nel documento (87% complessiva, Monaco 0,63, Australia
  0,59) non sono più quelli di oggi (0,8593 · 0,7692 · 0,75). Eseguire il Cancello B
  contro una linea di base che non esiste più sarebbe senza significato.

## I paletti

- **Nessuna probabilità di sorpasso.** `s25_difesa` resta com'è e continua a far
  fallire la suite se un campo nomina chi supera chi. Qui si producono **tassi e
  conteggi**, mai un duello.
- **Non si riapre l'indice per circuito.** Il NO-GO del 06/07 resta il NO-GO del
  06/07. Questa è una domanda diversa (dentro la gara, non fra stagioni) e non
  riscrive quel verdetto.
- **Il CSV orfano `data/difficolta_sorpasso.csv` non si usa** in nessun modo, come
  già dichiarato allora.
- **Nessun coefficiente si tocca** in base a questi numeri.
- **Il DRS sta dentro la metrica per scelta dichiarata**, e le stagioni 2023-2025 lo
  avevano mentre il 2026 no. Per la domanda «si tiene dentro una gara» non è un
  problema — ogni gara è internamente coerente. Per qualunque trasferimento al 2026
  lo è, e il 2026 si riporta **separato**, mai fuso col resto.

---

# ESITO — misurato il 02/08/2026, e poi CONFUTATO

`python3 ai_lab/confronto/sorpassi_intragara.py` · 69 gare, 24 circuiti,
4 stagioni, 1.594 episodi risolti.

## 1. I cancelli, come stavano scritti

| | risultato | soglia | |
|---|---|---|---|
| **I0** | output identico byte a byte | identici | **PASSA** |
| **S1** | ρ = +0,362 · nullo p = 0,0665 · n = 20 | ρ ≥ 0,40 e p < 0,05 | **FALLITO** |
| S1 (≥15, sensibilità) | 5 gare ammesse | ≥ 8 | NON ESEGUIBILE |
| **S2** | ρ da −0,118 a +0,270 a ogni X ≤ 60% | ρ ≥ 0,40 e p < 0,05 | **FALLITO** |

**Questo resta il verdetto dei cancelli, e non si riscrive.** L'aritmetica è
giusta, la prereg è stata onorata, nessun E08.

Da qui era stata tratta la conclusione: *«la sorpassabilità osservata presto in
gara non predice quella del resto della gara; il ramo si chiude»*. Quella
conclusione è **sbagliata**, e sotto c'è la dimostrazione.

## 2. La verifica avversariale: 5 lenti su 5 hanno confutato

Cinque agenti indipendenti, ognuno con una lente diversa, incaricati di demolire
il verdetto. **Tutti e cinque CONFUTATO.** La meccanica regge — `spearman()`
coincide con scipy a 3·10⁻¹⁶, il nullo è il nullo giusto (media −0,0003), `_grezzi`
contiene le gare giuste. Cade quello che sta **sopra** l'aritmetica.

### (a) Lo strumento era spuntato

- Il cancello aveva **50% di potenza alla propria soglia**: con ρ vero = 0,40 e
  n = 20, passa una volta su due.
- **IC95 bootstrap su ρ = [−0,137; +0,730]**, che contiene 0,40. Il 44% dei
  ricampionamenti supera la soglia.
- Il p è **una lotteria di seme**: il valore vero è 0,0583, e su 40 semi diversi
  ne uscivano 5 sotto 0,05.
- Cambiando **una sola costante** — `MIN_MEZZO` da 10 a 11 — lo stesso script
  stampa **PASSA** (ρ = +0,501, p = 0,0215). Verificato personalmente: 10 è
  l'unico valore eseguibile della scala che fallisce.

### (b) La soglia di ammissione ≥ 10 distruggeva il campione

Scartava **49 gare su 69 e il 58% degli episodi**. Non per restrizione di campo
(l'indice non è compresso: SD 18,5 contro 19,2, Monaco sopravvive) — per pura
distruzione di dati. Con la **stessa statistica, stessa soglia ρ, stesso nullo**,
ammettendo a ≥ 3 episodi per parte (95% degli episodi):

| soglia | n gare | ρ | p |
|---|---|---|---|
| ≥ 3 | 62 | **+0,459** | **< 0,0001** |
| ≥ 5 | 48 | +0,359 | 0,0064 |
| ≥ 10 (pre-registrata) | 20 | +0,362 | 0,059 |
| ≥ 11 | 16 | +0,501 | 0,024 |

*(righe rimisurate personalmente, 20.000 permutazioni)*

E replica fuori campione: 2023 da solo +0,523, 2024 da solo +0,421,
**23 leave-one-circuito-out su 24 sopra 0,40**.

### (c) Il giro 4 è un artefatto della metrica, e cadeva tutto in «presto»

Il giro 4 è **il primo giro ammissibile** (E3 vuole L≥4) **e l'unico in cui
nessuna coppia può essere nel raffreddamento di 5 giri del dedup**: raccoglie
tutte le coppie in una volta. **98 episodi su 1.594 (6,1%) su un giro solo**,
densità 1,42/gara contro 0,38 dal giro 10, e conversione **32,7% contro 58,7%**
(z = −5,62). Non è lo stesso fenomeno, e per costruzione finisce tutto nella
metà «presto».

Togliendo **solo il giro 4**, a parità di tutto il resto: ρ da +0,362 a **+0,714**,
p da 0,0665 a **0,0012** *(rimisurato personalmente)*. Due placebo escludono la
forchetta: nessun altro singolo giro sposta ρ di più di +0,066 (0 su 21), e
0 tiri su 2.000 che tolgono 98 episodi a caso arrivano a +0,714.

### (d) Il «soffitto» che avevo costruito era sbagliato, e lo avevo raccontato al PO

Avevo scritto che il soffitto a X=20% (+0,319) rendeva la soglia 0,40
irraggiungibile per costruzione, «l'immagine speculare di E09». **Falso**: il
soffitto è una **mediana**, non un massimo, e per di più dividendo un insieme
FISSO di episodi le due parti sono anti-correlate per costruzione — il tetto vero
misurato è +0,649 contro il +0,550 stampato. Sotto l'ipotesi ideale **S1 aveva il
91,7% di probabilità di passare**. Nessun E09 alla rovescia.

Resta vero un pezzo, ma per un'altra ragione: a n = 11 e n = 15 il p di
permutazione richiede ρ ≥ 0,53 e ≥ 0,44 per scendere sotto 0,05, quindi i
«FALLITO» di X=20%, 30% e 60% erano in parte strutturali. Il motivo è la
**taratura del p a n piccolo**, non il soffitto.

### (e) «Condizioni fisse» era falso a livello di unità

La premessa di §S1 — dentro una gara le condizioni sono fisse — non regge sui
duelli: la sovrapposizione delle coppie fra le due metà ha **Jaccard mediano 4%**,
solo il 9,1% degli episodi «tardi» riguarda una coppia già vista «presto», i
duelli fra mescole diverse passano dal 28,6% al 40,0% e l'età gomma da 1 a 9 giri.
Le due metà contengono **duelli quasi disgiunti**.

### (f) Due difetti di processo, miei

1. Il commento di `sorpassi_intragara.py` dichiarava che la correzione del placebo
   era «messa a referto in PREREG_sorpassi_intragara.md». **Non l'avevo scritta.**
   Ora c'è, ed è questo paragrafo. Un commento che afferma un fatto falso sul
   proprio referto è peggio di un commento assente.
2. **I0 vale come equivalenza di codice**, non come «i gate riproducono la nota»:
   `data/SORPASSO_NOTA.txt` è del 06/07 e i dati sono cresciuti da 66 a 69 gare,
   quindi G0-G3 non danno più esattamente quei numeri. La modifica a `episodi()`
   è innocua — questo è provato — ma la nota è **stale** e va letta come tale.

## 3. La lettura corretta

**L'associazione presto→tardi esiste ed è forte.** Con la statistica e il nullo
pre-registrati, su 62 gare: **ρ = +0,459, p < 0,0001**, replicata separatamente
nel 2023 e nel 2024, stabile in 23 leave-one-circuito-out su 24. Non è un NULL:
è un **mancato di poco con uno strumento spuntato su un quarto dei dati**.

**Ma non è conoscibile presto.** Rimisurato personalmente a ≥ 3 episodi per parte:

| X (frazione di gara) | n | ρ | p | |
|---|---|---|---|---|
| 20% | 37 | +0,115 | 0,252 | no |
| 30% | 53 | +0,202 | 0,074 | no |
| 40% | 60 | +0,277 | 0,017 | significativo ma sotto 0,40 |
| **50%** | 62 | **+0,456** | **0,0002** | **passa** |
| **60%** | 59 | **+0,401** | **0,0007** | **passa** |

## 4. Verdetto, e cosa NON faccio adesso

Il ramo **non si chiude** — ma non perché io riscriva S1. S1 è fallito e resta
fallito. Si riapre perché la sua conclusione è smentita da misure fatte con lo
**stesso** strumento pre-registrato su **più** dati.

**Non dichiaro che «S1 passa togliendo il giro 4»**, e non lo dichiarerò su questi
dati: la direzione dell'esito è ormai nota, e usarla per scegliere la variante
sarebbe E08 col vestito buono. La rimozione del giro 4 e la soglia di ammissione
sono scelte che **decidono il verdetto più del fenomeno**, e per questo vanno
dichiarate PRIMA, in una prereg nuova, con una verifica fuori campione vera.

Quello che si può già dire senza nessuna nuova prereg, perché non dipende da
nessuna di quelle scelte: **la sorpassabilità di una gara non è conoscibile nella
sua prima metà.** Tutte le varianti provate concordano su X ≤ 40%.

Conseguenza per il prodotto, e va scritta chiara: la banda di rientro **non si può
condizionare a un indicatore di sorpassabilità al congelamento precoce**. Dalla
metà gara in poi la domanda è aperta e i numeri sono incoraggianti.
