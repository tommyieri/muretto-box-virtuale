# Referto — da dove viene lo scarto fra il motore e le gare vere

**Data: 14/08/2026.** Domanda del PO: non «quanto sbaglia il motore», ma **quali sono le
fonti dello scarto, in ordine di quanto pesano**.

Campione: **193 casi pilota-gara** sulle 11 gare del 2026, ognuno una gara INTERA simulata
dal congelamento (giro 5-15), col pilota che riceve la SUA strategia vera, i rivali le LORO
soste vere, le finestre SC/VSC **vere** e i ritiri veri. Banco:
`ai_lab/confronto/pavimento_gara_intera.mjs`, col pavimento sulla compressione acceso (#155).

Il fondo da spiegare: **\|errore\| medio 1,617 posizioni**, massa totale **312 posizioni**.
Il modello nullo («finisce dove stava al congelamento») fa **1,715**: il motore lo batte di
**19 posizioni in tutto, 0,098 per caso**. Tutto quello che segue va letto contro quel
margine — è piccolo, ed è il metro giusto.

Sei ipotesi misurate in parallelo e indipendentemente, poi attaccate da un secondo giro di
refutazione. **I numeri qui sotto li ho rifatti io** prima di scriverli: quelli che non si
riproducevano non sono in questo documento.

---

## 1 · La fonte vera: **il motore non fa succedere abbastanza gara**

La decomposizione che spiega tutto sta nel movimento **del soggetto**: il motore lo sposta
dalla posizione che aveva al congelamento, e la realtà lo sposta?

| | casi | massa \|errore\| | quota | contro il nullo |
|---|---|---|---|---|
| **movimento MANCATO** — la realtà lo sposta, il motore no | **56** | **122** | **39,1%** | 0 (pareggio esatto) |
| lo muovono entrambi | 84 | 170 | 54,5% | **+39** (vince 50, perde 27) |
| movimento INVENTATO — il motore lo sposta, la realtà no | 15 | 20 | 6,4% | **−20** (perde 15 su 15) |
| fermo, e giusto | 38 | 0 | 0,0% | 0 |

**Nei 56 casi di movimento mancato la realtà sposta il pilota di 2,18 posizioni in media e
il motore lo lascia esattamente dov'era.** Lì il motore *è* il modello nullo, bit per bit:
non sbaglia la previsione, non la fa proprio.

Allargando a «muove, ma meno del vero»: **93 casi su 193 (48%) e 224 posizioni di massa —
il 71,8%**. Nella direzione opposta (muove più del vero) ci sono 34 casi e il 20,5%.

**Il conto netto del motore è tutto qui**: +39 dove muove insieme alla realtà, −20 dove
inventa. Fa +19, che è esattamente l'intero margine sul nullo. Il motore non ha un problema
di precisione: ha un problema di **ampiezza**. Il campo si muove di 12,0 cambi di posizione
per caso, il motore ne produce 8,3.

**È una fonte con un colpevole noto e dichiarato.** Il kernel non simula i duelli — due auto
si attraversano, si riproduce QUANTI cambi, non QUALI — e il tetto al movimento *limita*
ulteriormente i sorpassi. Sono due scelte pre-registrate, entrambe giuste sui loro cancelli.
Il referto dice che il prezzo di quelle scelte è il 71,8% dello scarto residuo.

## 2 · Quello che si è cercato e **non** si è trovato

Vale quanto il resto, perché sono i posti dove non conviene lavorare.

**La neutralizzazione: NULLA.** Vale 0,083 posizioni (5,1%), e col tetto acceso 0,047 (2,9%)
con l'IC95 che contiene lo zero. Il tetto di quanto potrebbe ancora nascondersi lì è
**+0,037 posizioni, il 2,3%**: qualunque altra riparazione di κ, della compressione o del
pavimento non può restituire più di quello. Detto altrimenti: **il lavoro di ieri sul
pavimento ha preso quasi tutto quello che c'era da prendere da questa parte.**

**Il pit-loss e le soste: NULLA.** 0,02 posizioni (1,3%). Anche sbagliando la perdita ai box
di **10 secondi per tutti** lo scarto si muove di 0,51 posizioni, e in 6 gare su 11 di zero.
Le gare con molte soste sono difficili per il motore *e per il nullo allo stesso modo*: il
pezzo che il motore aggiunge di suo è −0,025 posizioni per sosta, cioè niente.

**Il circuito: NULLA, per la decima volta.** La dispersione grezza fra gare è 0,636 posizioni
(Canada 1,00 · Spagna 3,18), ma togliendo quello che fa **anche il nullo** scende a **0,263**
e l'ordine si rimescola: la Gran Bretagna ha lo scarto grezzo secondo più basso e il miglior
guadagno sul nullo (−0,58), la Spagna il peggiore grezzo e un guadagno praticamente nullo
(+0,12). Le gare differiscono per **quanto la corsa rimescola le posizioni**, non per quanto
il motore le sbaglia. Il progetto lo aveva già misurato nove volte; questa è la decima, e non
ho ragioni per dire che stavolta è diverso.

**L'orizzonte: DEBOLE, e non come lo si racconta.** Come *differenziatore fra casi* pesa al
massimo 0,209 posizioni (12,9%) con IC95 che contiene lo zero. Il costo dell'orizzonte esiste,
ma è un **livello già speso**, non una pendenza: il vantaggio sul nullo passa da 119-88 a sei
giri (il numero pubblicato) a 50-42 alla bandiera — il motore consegna tutto il suo margine
prima del giro 8, e allungare da 8 a 73 giri non gli toglie altro. Proiettare più a lungo non
peggiora: semplicemente non aggiunge.

## 3 · Una fonte che va nella direzione opposta: il campo mutilato

**95 casi su 193 (49,2%) sono giudicati su un campo più piccolo di quello della loro gara**
— campo medio 16,72 auto contro 17,68 — perché la classifica comune fra motore, nullo e
verità esclude chi non è arrivato.

Su un campo più corto ci sono meno posizioni da sbagliare. Correggendo in proporzione, il
\|errore\| medio passa da **1,617 a 1,714**: lo scarto vero è **~6% più grande** di quello
che il banco stampa. Non è una fonte d'errore — è una fonte di **ottimismo**, e va scritta
accanto a ogni numero di questo referto.

## 4 · Quanto resta senza spiegazione

Sommando le fonti che reggono, in posizioni sul \|errore\| medio di 1,617:

| | posizioni | quota |
|---|---|---|
| movimento (mancato + inventato + troppo poco) | ~1,16 | **71,8%** |
| orizzonte (limite superiore, IC contiene lo zero) | ≤ 0,21 | ≤ 12,9% |
| neutralizzazione | 0,05 | 2,9% |
| pit-loss e soste | 0,02 | 1,3% |
| circuito | ~0,06 | 3,7% |
| **non spiegato** | **~0,12** | **~7%** |

Il residuo è piccolo, e questa è la notizia: **non c'è una fonte nascosta.** Lo scarto è
quasi tutto in una cosa sola, ed è quella che il progetto ha deliberatamente scelto di non
simulare.

## 5 · La cosa che misurerei dopo, una sola

**Se il tetto al movimento sia sotto-tarato**, con una prereg sua.

La ragione: il motore produce 8,3 cambi di posizione contro i 12,0 veri, e il 39,1% della
massa d'errore sta in casi dove non muove **affatto** un pilota che la realtà sposta di due
posizioni. Il tetto è l'unico parametro del progetto che governa direttamente quel numero, è
già acceso, è già pre-registrato, e la misura del pavimento di ieri ha dato un indizio
diretto: **col tetto spento il motore migliora di più** (errore medio 1,560 contro 1,617).

**Non è una proposta di spegnerlo** — quel braccio è una lente diagnostica, e la prereg del
tetto ha i suoi cancelli. È la proposta di chiedersi se la soglia di sorpasso, misurata su
5.498 occasioni, sia quella giusta **alla bandiera** e non solo a due giri.

E una cosa che NON farei: continuare a lavorare sulla neutralizzazione. Il soffitto misurato
è il 2,3% dello scarto. È finita.

---

## Come sono stati giocati i banchi, e cosa si è visto in pagina

Le 11 gare sono state giocate fino alla bandiera nel browser, due soste ciascuna, col
pannello interrogato a campione dopo ogni sosta. **Nessun errore JavaScript, nessun pannello
muto** fuori dall'ultimo giro (dove il silenzio è corretto e dichiarato), e la risposta
arriva sempre dalla gara del giocatore dopo il primo BOX ORA.

Tre difetti di prodotto trovati giocando, tutti riparati:

1. **Il tasto BOX ORA mentiva.** Per un pilota senza risposte diceva «troppo tardi perché una
   sosta abbia una risposta» — **al giro 20 di 78**. I tre casi (troppo presto / troppo tardi
   / nessuna risposta per questo pilota) erano collassati in due.
2. **Chi non è partito non lo diceva.** Verstappen a Monaco non ha preso il via: il pannello
   taceva a ogni giro senza spiegare perché, e la riga in fondo invitava a premere un tasto
   spento. Adesso lo dice, e l'invito sparisce. *Nota: il selettore piloti lo marcava già
   («non parte»), quindi un umano non ci sarebbe cascato — ci è cascato il giocatore
   automatico, ed è il motivo per cui vale la pena farlo giocare da una macchina.*
3. **Il referto non diceva chi si era ritirato.** Leclerc a Monaco è classificato P17 dopo un
   ritiro al giro 65; la casella «nella gara vera» scriveva P17 accanto a un motore che con
   le **stesse soste** lo porta P1. Sedici posizioni che sembrano un errore del motore e sono
   un guasto — la differenza più vistosa che il gioco mostri, e l'unica di cui non dichiarava
   la provenienza. Adesso c'è scritto «ritirato al giro 65».

Il terzo è, in piccolo, lo stesso tema di tutto il referto: **una differenza senza la sua
provenienza si legge come un errore.**
