# Referto — da dove viene la contraddizione fra 0,35 e 0,62: **due errori che si compensano**

**Data: 14/08/2026.** Banco: `ai_lab/confronto/conversione_sosta.mjs`. Chiude la domanda
lasciata aperta da `ESITO_sosta_neutralizzazione.md`. Descrittivo: nessun cancello, nessun
parametro toccato.

---

## La domanda, posta bene

I due numeri **non misurano la stessa cosa**, e questo è metà della risposta:

| | cos'è | da dove |
|---|---|---|
| **0,6227** | un **TEMPO**: la perdita realizzata da una sosta sotto SC rispetto al campo, in frazione della perdita verde | 147 gare, 3.911 soste, controllo in verde 1,011 |
| **≈ 0,35** | un **CONTEGGIO DI POSIZIONI** risolto all'indietro: il fattore che, dentro il motore, riprodurrebbe i 122 cambi veri | il banco del movimento, 11 gare |

Quindi il motore può sbagliare in **due punti diversi**, e questo banco li separa. Unità: la
singola **sosta** che cade in una finestra, non il caso e non la gara — **129 soste**.

Tre strade dichiarate prima di guardare: **A · il tempo** · **B · la conversione** (stesso
tempo, troppe posizioni) · **C · la dispersione** (una mediana dove la realtà ha una
distribuzione larga).

## A · IL TEMPO — vero, e quantificato

| | motore | vero | rapporto |
|---|---|---|---|
| **SC** (n=62) | 11,31 s | **15,46 s** | **0,731** |
| **VSC** (n=61) | 14,99 s | **18,42 s** | **0,814** |

**Il motore fa pagare troppo poco**: il 27% in meno sotto Safety Car, il 19% in meno sotto
VSC.

E il numero si chiude su sé stesso. Il motore applica 11,31 s al fattore 0,50, quindi la
perdita verde implicita è 22,61 s; la realtà ne costa 15,46, cioè un fattore di **0,6836**.
Sotto VSC: **0,7985**.

| | fattore implicato da questo banco | il fattore già misurato nel repo | |
|---|---|---|---|
| SC | **0,6836** | 0,6227 · IC95 [0,515 ; 0,727] | **dentro l'IC** |
| VSC | **0,7985** | 0,7188 · IC95 [0,634 ; 0,845] | **dentro l'IC** |

Due metodi diversi, due campioni diversi (11 gare contro 147), **stesso numero**. Il prior
esterno 0,50 / 0,65 è superato da entrambi.

## B · LA CONVERSIONE — vera anche lei, e tira dall'altra parte

Posizioni perse per **secondo** perso, sulle soste con una perdita leggibile (> 1 s):

| | motore | vero | |
|---|---|---|---|
| **VSC** | **0,0714 pos/s** | 0,0445 pos/s | il motore converte **1,6×** |
| **SC** | 0 | 0 | mediane entrambe nulle: non discrimina |

Sotto VSC il motore trasforma un secondo di ritardo in **una volta e mezza** le posizioni che
gli costa nella realtà. **Il perché non l'ho misurato** — dipende da quante auto stanno dentro
quella finestra di secondi attorno a chi si ferma — e dopo essermi già sbagliato due volte sui
meccanismi non ne propongo un terzo qui.

## C · LA DISPERSIONE — falsificata

La previsione era: il motore usa una mediana, quindi i suoi esiti sono **troppo concentrati**.
È il contrario. Deviazione standard delle **posizioni** perse:

| | motore | vero |
|---|---|---|
| SC | 1,52 | 1,30 |
| VSC | 1,89 | 1,54 |

Il motore è **più** disperso, non meno. C esce.

*(La deviazione standard dei **tempi** veri — 180-643 s — non è leggibile: è dominata da code
di ritiri e sospensioni. Si riporta e non si usa.)*

## La risposta: 0,50 non è una costante fisica, è un compensatore

I due errori **tirano in direzioni opposte sul movimento**:

- **A** fa pagare troppo poco → chi si ferma scende meno → **meno** cambi di posizione;
- **B** converte ogni secondo in troppe posizioni → **più** cambi.

Il valore che gira in produzione, **0,50**, sta sotto il fisico (0,62-0,68) di quel tanto che
serve a non far esplodere B. **Non è stato scelto per compensare** — è un prior esterno, ed è
lì da prima — ma è quello che di fatto fa.

Ed è la spiegazione esatta del rosso di ieri: alzare il prezzo alla misura fisica
(S1, 0,50 → 0,6227) **toglie la compensazione senza toccare B**, e il rimescolamento peggiora
da +23 a +32. Il motore stava sbagliando due volte, e le due si tenevano.

**Quindi la contraddizione fra 0,35 e 0,62 non è fra due misure**: è fra una misura fisica
(0,62-0,68, confermata due volte) e un numero che non è una misura di niente — lo 0,35 è
soltanto il prezzo che servirebbe a far quadrare il conto delle posizioni **lasciando B
rotto**.

## Che cosa cambia per il progetto

**Il fattore misurato non si può promuovere da solo.** N3 — il cancello che potrebbe
promuoverlo — decide sul bias del passo, e sul bias potrebbe pure passare; ma questo referto
dice che la promozione, presa isolata, **peggiora il movimento** e lo fa per una ragione nota.
Va scritto accanto a N3, perché N3 quella parte non la guarda.

**La riparazione onesta è doppia o niente**: il prezzo alla misura fisica **e** la conversione
tempo→posizioni. La seconda non ha ancora né una misura del meccanismo né una prereg, e non
la apro qui.

**Una cosa che questo referto NON dice**: che 0,62 sia il valore giusto da mettere in
produzione. Dice che è il valore giusto del *tempo*, misurato due volte in modo indipendente.
Cosa metterci finché B è rotto è una decisione, non una misura — e ha bisogno che qualcuno
scriva a chiare lettere che il numero in produzione sta facendo un secondo lavoro.

## Un errore mio, trovato perché contraddiceva il repo

La prima scrittura di questo banco misurava la perdita su **un giro solo**. Dava «il motore
addebita il doppio» (rapporto 1,94, e 3,90 sotto SC) — cioè il verso **opposto** a quello
appena riportato.

Era un difetto dello strumento: in questo progetto la perdita ai box è per convenzione
**(in-lap + out-lap) meno due giri di passo pulito**, e il kernel la applica intera sul giro
della sosta. Misurando un giro solo, il lato **vero** perdeva tutto l'out-lap.

**L'ho visto perché il numero contraddiceva una misura che il repo aveva già sulle stesse
gare**, non perché mi fosse sembrato strano. È il motivo per cui vale la pena tenere le
misure vecchie dove si possono incrociare: uno strumento nuovo che smentisce uno vecchio ha
l'onere della prova, e qui l'onere l'ha perso.

---

*Nessun parametro toccato, nessun file di produzione modificato. Suite senza regressioni.*
