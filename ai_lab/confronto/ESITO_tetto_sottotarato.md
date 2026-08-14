# Esito — il tetto al movimento è sotto-tarato? **NULL, e per due strade indipendenti**

**Data: 14/08/2026.** Esegue `PREREG_tetto_sottotarato.md`, sigillata a `45e8045` prima di
eseguire un solo λ ≠ 1. Banco: `ai_lab/confronto/tetto_lambda.mjs`. **Niente è stato acceso**,
e la prereg non lo autorizzava.

---

## La curva

193 casi, gara intera con le finestre vere. Cambi di posizione **reali: 12,01 per caso**.

| λ | \|errore\| | \|movimento − vero\| | cambi del motore |
|---|---|---|---|
| 0 | 1,5699 | 3,404 | 10,43 |
| 0,25 | 1,5492 | 3,440 | 10,36 |
| 0,5 | 1,5544 | 3,244 | 10,35 |
| **0,75** | **1,5389** | **3,181** | 9,12 |
| **1 — produzione** | **1,6166** | **3,870** | **8,25** |
| 1,25 | 1,6114 | 3,974 | 8,16 |
| 1,5 | 1,6269 | 3,710 | 8,59 |
| 2 | 1,6684 | 3,907 | 8,56 |
| 3 | 1,6580 | 3,798 | 8,64 |
| *tetto spento* | *1,5596* | *3,005* | *10,63* |

A prima vista sembra un caso chiuso: **ogni λ ≤ 0,75 batte la produzione**, il movimento si
avvicina al vero, e abbassare la soglia va nella direzione che il referto sulla provenienza
indicava. Non regge, e le ragioni erano scritte prima.

## Perché è NULL

**1 · Il controllo sulla curva piatta, dichiarato prima, dice che il minimo è rumore.**
Lo scarto fra il λ migliore e il peggiore (esclusi i degeneri) è **0,1295**; l'incertezza
della media, bootstrap a blocchi = gare come impone E11, è **0,1867**. La prereg dice:
*«se lo scarto è più piccolo dell'incertezza, il minimo è rumore e E1 non è leggibile,
anche se il conto appaiato dovesse uscire a favore»*. Lo scarto è più piccolo.

**2 · Il placebo sull'assegnazione è sporco, e nella direzione peggiore.** Gli undici λ
scelti fuori campione, rimescolati a caso fra le gare (200 permutazioni, seme 20260814):

| | saldo migliora − peggiora |
|---|---|
| assegnazione **vera** | **+3** |
| mediana delle 200 finte | **+13** |
| 95° percentile delle finte | **+17** |

L'assegnazione vera non solo non batte il 95° percentile: **fa peggio della mediana del
caso**. Scegliere il λ *per quella gara* non aggiunge niente — toglie.

**E il meccanismo si legge.** I λ scelti fuori campione sono `0,75` per nove gare su undici,
`0,5` per il Giappone e **`0,25` per l'Ungheria**. Il LOO dà a ogni gara il λ preferito
**dalle altre dieci**: l'Ungheria prende 0,25 proprio perché è lei a tirare l'ottimo verso
0,75. Cioè **l'ottimo è trascinato da singole gare**, ed è esattamente l'instabilità che un
leave-one-out serve a smascherare. Ha funzionato.

**3 · Il conto appaiato, comunque, è una monetina.** E1: **25 migliora · 22 peggiora · 146
pari** (47 discordanti, sopra la soglia dei 20 dichiarata). Alla lettera «peggiora non supera
migliora» passa — ma 25 contro 22 non è un risultato, e la prereg aveva già stabilito che il
p non è un cancello proprio per non farne uno spettacolo.

**E2 invece migliora davvero**: \|movimento − vero\| da **3,870 a 3,389**. Il parametro fa
quello che dice — muove di più — ma quel movimento in più **non si traduce in arrivi più
giusti** in modo distinguibile dal caso.

## Il verdetto, nella formula che la prereg impone

> **Il livello del tetto al movimento non è dimostrabilmente sotto-tarato.** Abbassarlo
> aumenta il movimento e sposta l'errore nella direzione giusta, ma il guadagno non
> sopravvive né al controllo sulla piattezza della curva né al placebo sull'assegnazione, e
> l'ottimo apparente è trascinato da singole gare.

Per il §4 della prereg è il ramo **«E1 rosso → il tetto non è sotto-tarato: il valore
misurato regge, e il movimento che manca viene da un'altra parte»** — e lì è scritto anche
perché è il risultato più utile dei due: **chiude una strada invece di aprirne una.**

## Quattro cose da mettere a referto, e una è contro di me

**(a) Il mio controllo sulla piattezza era severo, e va detto adesso.** L'incertezza che ho
dichiarato è quella del **livello** della media (0,1867), non quella della **differenza
appaiata**, che è molto più piccola. Misurata per il referto: λ=0,75 contro λ=1 dà
**−0,0777 con IC95 [−0,164 ; 0,000]** — cioè un intervallo che **tocca lo zero** con
l'estremo superiore. Anche col metro più favorevole l'effetto è al limite.

**Non uso questo numero per ribaltare il verdetto**, e questo è il punto: sarebbe scegliere
il metro dopo aver visto l'esito. Il controllo che decide è quello scritto prima. Ma il
successore deve usare l'incertezza appaiata, ed è un difetto della mia prereg, non del
mondo.

**(b) E3 non è stato misurato, e non poteva cambiare niente.** La metrica a due giri era un
**veto su un E1 che passa**: E1 non passa. E un veto può solo peggiorare un verdetto, mai
migliorarlo — quindi non misurarlo non lusinga l'esito. Resta il fatto storico che è il
cancello su cui il tetto TUM morì il 03/08 (16-33, p = 0,0213).

**(c) Il tetto governa solo i giri VERDI**, come la prereg dichiarava al §2: dentro le
finestre SC/VSC comanda la compressione, e λ non tocca nessuno dei 18.443 giri compressi.
Il movimento che manca ha quindi almeno una parte fuori dalla portata di questo parametro.

**(d) Il tetto resta un vincolo attivo e quasi-marginale**, il che rende il NULL più
interessante: blocca **19.739 volte** (83% dei contatti, 102 per caso) e al **42,8%** dei
bloccati manca meno di 0,3 s/giro. Sbloccarli si può, e infatti il movimento sale — ma gli
arrivi non migliorano in modo leggibile. **Muovere di più non è muovere meglio**: il kernel
non sa *chi* deve passare, solo *quanti* passaggi stanno in un giro, e allentare il vincolo
distribuisce quei passaggi a caso fra le coppie in contatto.

## Che cosa resta aperto

Il referto sulla provenienza diceva che il 71,8% dello scarto è movimento che non avviene.
Questo esito dice che **non si recupera abbassando la soglia**. Le due cose insieme
restringono il campo: il problema non è *quanto* movimento il vincolo permette, ma **quale**
— e «quale auto passa quale» è il duello, che il progetto ha già misurato di non saper
riprodurre (`PREREG_sorpassi.md`, chiuso fuori campione su 78 gare, mancato per 0,0024).

Non apro un terzo tentativo su quel ramo con questo esito in mano. Se qualcosa va provato
dopo, è il pezzo che il tetto **non** copre: il movimento dentro le neutralizzazioni, dove
comanda la compressione e dove il pavimento è appena stato acceso.

---

*Nessun parametro è stato cambiato. `run_suite.mjs` senza regressioni, i quattro banchi del
sito verdi. La strumentazione aggiunta al kernel (contatori del tetto) è additiva e
verificata inerte: spento resta bit-identico.*
