# Referto — il movimento in verde: **il deficit era mezzo mio**, e quel che resta è il duello

**Data: 15/08/2026.** Banco: `ai_lab/confronto/movimento_verde.mjs`. Descrittivo: nessun
cancello, nessun modello — quindi niente da validare, solo un'identità contabile. Nessun file
di produzione toccato.

Dopo **cinque ipotesi cadute in cinque giorni**, questo banco non ne propone nessuna: divide
il movimento verde in tre secchi che non si sovrappongono e guarda in quale il motore perde.
La divisione è scelta **prima** di vedere da che parte cade, e per una ragione: separa un ramo
**chiuso** (il duello, `PREREG_sorpassi.md`, fuori campione su 78 gare) da due **aperti** — il
ciclo di sosta, che è letteralmente ciò che il gioco chiede di simulare.

---

## 1 · La correzione, e viene prima perché riguarda un numero che ho ripetuto tre volte

Ho scritto in tre referti che **in verde il motore produce metà del movimento vero** (111
contro 224, resa 49,6%), e ci ho costruito sopra la frase «il deficit è tutto in verde».

**Quel 49,6% dipende da dove si mette il confine del tratto**, e la differenza è **un giro**:

| il tratto verde comincia… | vero | motore | resa |
|---|---|---|---|
| dal **primo giro verde** | 202 | **188** | **93,1%** |
| dal giro **prima** (l'ultimo neutralizzato) | 216 | **105** | **48,6%** |

La realtà cambia appena (202 → 216, come ci si aspetta allungando la finestra). **Il motore
crolla da 188 a 105.** Il 49,6% che ho pubblicato è la seconda definizione: una finestra che
**scavalca l'uscita dalla neutralizzazione**.

**In verde il motore riproduce il 93% del movimento netto e l'88% del rimescolamento, non il
50%.** Le due definizioni misurano cose diverse ed entrambe sono legittime; sbagliata era la
frase che ci ho messo sopra.

*Come l'ho trovato: due numeri miei non tornavano fra loro (188 qui, 111 nell'altro banco), e
invece di scegliere quello che mi piaceva li ho calcolati tutti e due nello stesso script. È
la terza volta in questa serie che un confronto fra due strumenti diversi produce un verso
sbagliato — la prima fu la perdita ai box su un giro invece che due.*

## 2 · Il giro di transizione, contato da solo

I 18 giri che separano le due definizioni (il primo verde dopo una neutralizzazione):

| | motore | vero | |
|---|---|---|---|
| cambi di rango su quei giri | 64 | 80 | il motore ne fa **0,80×** |
| per giro | 3,56 | 4,44 | |

**Il motore non si muove di meno, lì**: 0,80× è in linea col suo 0,88 complessivo. Eppure
includere quel giro gli dimezza il netto. La lettura diretta, e non ne aggiungo altre: **il
riordino che il motore fa all'uscita dalla neutralizzazione viene in gran parte disfatto dai
giri verdi che seguono**, mentre quello della realtà resta.

## 3 · I tre secchi

| | vero | motore | resa |
|---|---|---|---|
| il **suo** ciclo di sosta (±1 giro dalla sua sosta) | 329 | 312 | **94,8%** |
| il ciclo **altrui** | 760 | 703 | **92,5%** |
| **pista pura** (nessuna sosta entro ±1 giro) | 236 | 150 | **63,6%** |
| **totale** | **1.325** | **1.165** | **87,9%** |

E il movimento che manca — **160 cambi** — sta:

| | | |
|---|---|---|
| in **pista pura** | 86 | **53,8%** ← il duello, ramo chiuso |
| nel ciclo **altrui** | 57 | 35,6% |
| nel **suo** ciclo di sosta | 17 | 10,6% |

**Il motore riproduce il ciclo di sosta quasi perfettamente** — 95% sul proprio, 93% su quello
dei rivali. Il pezzo su cui il prodotto vive, l'undercut e l'overcut, **non è il problema**.

**Più di metà di ciò che manca è sorpasso in pista**, cioè esattamente la cosa che il progetto
ha deciso di non simulare e ha chiuso fuori campione su 78 gare, mancata per 0,0024.

## 4 · Che cosa cambia, messo insieme al resto

Il quadro dopo cinque giorni si semplifica parecchio, e in meglio:

| | |
|---|---|
| il motore in verde | **non** produce metà del movimento: ne produce l'88-93% |
| il ciclo di sosta | riprodotto al **93-95%** — il cuore del prodotto funziona |
| ciò che manca | **oltre metà è il duello**, un ramo chiuso con la sua misura |
| sotto neutralizzazione | il motore ne fa **troppo** (+19%), per 0,62 posizioni a sosta |

**Il «71,8% dello scarto è movimento che non avviene» resta vero** — è un'altra misura
(lo spostamento del soggetto dal congelamento alla bandiera, per caso) e non dipende da questi
confini. Ma la sua lettura cambia: quel movimento mancante non è una debolezza diffusa del
motore in verde, è concentrato in **ciò che il progetto ha scelto di non simulare**.

## 5 · Cosa non scrivo, e cosa scriverei dopo

**Non dico che il motore è a posto.** Un 88% di rimescolamento con un errore mediano di 1
posizione alla bandiera convive benissimo con un motore che mette le auto giuste nei posti
sbagliati: *quanti* cambi è una cosa, *quali* è un'altra, e questo banco misura solo i primi.

**Non riapro il duello.** È chiuso su 78 gare fuori campione e questo referto non porta niente
di nuovo su quel fronte — porta solo la notizia che è lì che sta il residuo.

**La cosa che misurerei dopo**, e non la faccio oggi perché merita una prereg sua: se il
motore mette le auto giuste nei posti giusti, cioè **quali** coppie si scambiano e non
soltanto quante. Tutti i banchi di questa serie contano `cambiDiPosizione`, che per costruzione
guarda *quanti*. È l'unica domanda grossa di questa area che nessuno ha ancora posto.

---

*Nessun parametro toccato. Suite senza regressioni.*
