# Esito 2 — il pavimento sulla compressione: **sei cancelli su sei. ACCESA**

**Data: 14/08/2026.** Misura dei cancelli di `PREREG_compressione_pavimento_2.md`, eseguita
dopo il sigillo (`5f07f3e`, che non tocca né `kernel.mjs` né `costruttore.mjs`).

**D6 è uscito rosso alla prima misura**, e non per la compressione: il banco del sito ha
trovato un difetto della SCENA che il difetto riparato teneva nascosto. È stato riparato con
la scelta del PO (14/08: «anima la ripartenza»), e il cancello è tornato verde **sul merito**,
senza toccarlo. Il racconto sta più sotto, perché è la parte che vale.

---

## I cancelli

| | | fondo | dopo | esito |
|---|---|---|---|---|
| **D1** | perimetro: identità al bit dove il vincolo non lega | — | **35/35 impronte identiche** | **VERDE** |
| **D2** | nessun giro impossibile | 5.815 sotto il pavimento · 24 negativi | **0 · 0** | **VERDE** |
| **D3(a)** | l'invariante locale della compressione | 473/473 esatti (sonda) | **193/193 casi concordi** | **VERDE** |
| **D3(b)** | tasso di morso *(misura, non cancello)* | **31,5%** | **34,5%** | previsione **confermata** |
| **D4** | rifiuti sul contro-fattuale | **26,6%** (17/64) | **0%** (0/64) | **VERDE** |
| **D5(a)** | confronto appaiato contro la realtà | — | **20 migliora · 16 peggiora · 157 pari** | **VERDE** |
| **D5(b)** | i tre limiti pubblicati | G1 1 · G2 87,6% · G3 −0,041 | **1 · 87,6% · −0,021** | **VERDE** |
| **D6** | niente regressioni | 4 banchi verdi | **62/62 · suite 42 PASSA** | **VERDE** (dopo la riparazione della scena) |

## Che cosa fa il pavimento

I **5.815 giri più veloci del giro più veloce della gara** spariscono tutti, e con loro i
**24 giri di durata negativa** di Monaco. Il contro-fattuale passa da **un rifiuto ogni
quattro** a **zero**: il pannello, dal lato del motore, saprebbe rispondere sulla gara del
giocatore a ogni giro. E la simulazione, giudicata contro la gara vera su 193 casi
appaiati, si **avvicina**: errore medio 1,648 → 1,617, bias −0,041 → −0,021.

**Il secondo braccio, col tetto al movimento spento** (D5(c)): 15 migliora · 10 peggiora,
errore medio 1,637 → **1,560**, G2 87,6% → 89,1%. Il pavimento migliora **da solo**, e col
tetto acceso migliora **di meno**: la reazione del tetto si mangia una parte del guadagno,
ma non ne rovescia il segno. È la risposta alla domanda che il 13/08 non si poteva porre.

## Quello che questi numeri NON dicono, e va detto per primo

**Il confronto appaiato non è statisticamente distinguibile dal caso.** 20 contro 16 su 36
discordanti dà **p = 0,62** (col tetto spento, 15 contro 10 su 25, **p = 0,42**). La prereg
dichiarava in anticipo che il p non è un cancello, ed è giusto così — ma chi legge deve
sapere che la direzione è favorevole e la magnitudine no. **La soglia dei 20 discordanti,
dichiarata prima, è rispettata** (36 e 25), quindi l'esito non è NULL: è verde e debole.

**Il campione di D1 è metà di quello che ho scritto.** Il Belgio, 19 dei 35 casi, ha
**zero esecuzioni** della compressione: le sue uniche finestre oltre il congelamento sono i
giri 18 e 20, e in tutti e 19 i casi il capofila è ai box, quindi il kernel salta l'intero
campo. Il margine «+2,477 s» che avevo scritto è calcolato su giri **mai compressi**. Il
perimetro è provato dalla sola **Australia: 16 casi, 1.568 esecuzioni, zero morsi, zero bit
cambiati**. È ancora un campione vero, ma è la metà — ed è la stessa famiglia dell'errore
che la prereg dichiarava di voler evitare, in formato ridotto. *Trovato da un revisore
avversariale, verificato da me.*

**D1, D2 e D3(a) non potevano fallire** se l'implementazione era fedele: la prereg lo dice
al §0 e resta vero. Il loro verde non è una scoperta — è la prova che l'implementazione è
quella descritta, in particolare che non è la degenerazione «pavimento come valore fisso».

**Il censimento è cieco su 302 tracce di pilota.** Rimisurato con lo strumento omogeneo (il
contatore dentro il ramo, che vede anche chi poi esce): sul fondo dà **5.815**, identico al
censimento. La cecità, qui, non nasconde niente — ma il numero va riportato a ogni giro.

**D3(b): la previsione regge, e la sua verifica è stata rifatta.** Avevo predetto, sigillata,
che il tasso di morso sarebbe **salito**. Un revisore ha obiettato che confrontavo due
strumenti diversi (il censimento sulle tracce prima, il contatore nel ramo dopo), e che sul
metro omogeneo il tasso sarebbe stato piatto. **Ho rimisurato il fondo col contatore nel
ramo** — il vincolo che conta senza agire — e il fondo dà **5.815 (31,5%)**, esattamente il
censimento. Quindi il confronto è omogeneo e il tasso **sale davvero**: 31,5% → 34,5%. Sotto
il 50% dichiarato: κ resta consegnabile in un giro. *L'obiezione era giusta come metodo e
sbagliata nel numero: il 6.384 proposto non si riproduce.*

## D6: il difetto che ne nascondeva un altro

`test_boxora` fallisce **un controllo su 62**: «sotto bandiera rossa i pallini stanno fermi».
Il fotogramma che sfugge è a **p = 69,002** — il **primo dopo** la rossa, non dentro — e il
pallino di LEC salta **679 m** in un fotogramma.

La causa, misurata: la scena ha **due tempi che non parlano fra loro**. L'orologio assegna
al giro di rossa una durata fissa di 5 s, letta dalla gara **vera** (`computeDurations` su
`race.byLap`), mentre i pallini vivono sui cumulati **simulati**, dove la sospensione non
esiste affatto: i giri 67 e 68 di LEC durano 71,98 s e 76,69 s, non 5. La scena tiene i
pallini fermi durante la rossa — ed è giusto, sotto rossa le auto sono ferme — ma alla
ripartenza tutto lo scarto si presenta in un fotogramma solo.

**Il banco era verde grazie al difetto che ho appena riparato**: i giri di durata negativa
di Monaco stanno esattamente lì, e spostavano il salto sotto la soglia dei 200 m. Riparata
la fisica, il difetto della scena è venuto a galla. Era coperto da un altro difetto.

Ho provato una riparazione — togliere la sospensione anche ai cumulati dei pallini — e
**l'ho tolta**: era sbagliata. Nel contro-fattuale la sospensione non c'è, quindi quel codice
sottraeva tempo inesistente, in quantità diversa per ogni pilota, e i pallini finivano per
sfrecciare su tre fotogrammi invece che su uno. Un rattoppo che peggiora si toglie, non si
tiene perché il numero scende.

**La scelta era di prodotto, e l'ha fatta il PO** (14/08). Tre strade: un orologio solo, che
però toglie alla scena il «a 1x un giro dura quello che è durato» scelto il 10/08; far correre
il contro-fattuale sotto rossa, che rimette la contraddizione chiusa il 13/08 (il banner dice
«gara sospesa» sopra le auto che si muovono); oppure **animare la ripartenza**. È stata scelta
la terza.

Il recupero si spalma su **0,15 di giro del battistrada** (`RIPRESA_P` in `ghostplay.mjs`) —
in `p` e non in millisecondi, così non dipende dal frame-rate né dalla velocità scelta, come
tutto il resto della scena. A 40x fa circa quattro decimi di secondo: si legge come un
movimento, non come un salto. La forma è `vero − scarto₀·(1−u)`, che garantisce che il
pallino non torni mai indietro — `vero` avanza e lo scarto si chiude, quindi la somma cresce
sempre.

**E va detto cos'è**: una TRANSIZIONE, non una misura. Durante quei decimi di secondo la
posizione del pallino non è dove l'auto era. È il modo in cui la scena torna a dirlo senza
uno scatto, ed è scritto nel codice accanto alla riga che lo fa.

## Dove sta tutto adesso

Ramo `claude/compressione-riparata`. Kernel riparato, trasporto al motore vendorizzato
(verificato: 12 moduli identici all'originale), i banchi di misura, la scena riparata e
questo referto.

- `run_suite.mjs`: **42 PASSA**, nessuna regressione (le sole rosse sono le due di s15 e le
  due di s25, dichiarate in `ROSSE_DICHIARATE.json`).
- `test_boxora` **62/62**, `test_ese`, `test_ghostplay`, `test_parita_live` verdi.
- **s30 ha due sonde nuove** sul pavimento: che spento sia spento (assente ≡ null ≡ un valore
  che nessuno tocca ⇒ bit-identico), che acceso su tutto **annulli la compressione invece di
  aggiungere tempo** — è il `Math.min(0, …)`, la metà della forma che si dimentica per prima —
  e che un valore malformato o negativo esploda invece di passare in silenzio.
- Il pin di `test_boxora` sezione (k) passa da «può solo scendere da 4» a **zero**: un cancello
  che accetta ancora quattro giri impossibili non sorveglia più niente.

**Perché valeva la pena**: è ciò che separa il pannello di oggi — che risponde sulla gara vera
anche quando il giocatore l'ha cancellata — dal pannello che risponde alla **sua**.

## Due errori miei, elencati perché restino

1. **Il campione del Belgio in D1 è vuoto** (zero esecuzioni della compressione), e l'avevo
   presentato come metà del campione di perimetro con tanto di margine in secondi. Il margine
   era calcolato su giri che il ramo non tocca mai.
2. **La prereg scrive che il braccio (c) gira con `tetto: null`.** È il refuso opposto:
   `tetto: null` è il **default** e lascia il tetto **acceso**; lo spegnimento è
   `tetto: false`, che è ciò che il banco usa davvero (`--tetto-spento`). Il codice è giusto,
   il testo no — e preso alla lettera avrebbe reso il secondo braccio un A/A.

Nessuno dei due cambia un esito. Restano scritti perché un referto che elenca solo gli errori
degli altri non è un referto.
