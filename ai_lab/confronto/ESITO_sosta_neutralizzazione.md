# Esito — la sosta sotto neutralizzazione: **S1 ROSSO. Il mio meccanismo era sbagliato.**

**Data: 14/08/2026.** Esegue `PREREG_sosta_neutralizzazione.md`, sigillata a `54c911d` prima
di guardare un numero di esito. **Nessun file di produzione è stato toccato**: `promosso`
resta `false`.

---

## I cancelli

| | | fondo | col fattore misurato | esito |
|---|---|---|---|---|
| **S1** | l'eccesso di movimento in finestra si riduce | **+23** (145 contro 122) | **+32** (154 contro 122) | **ROSSO** |
| **S2** | gli arrivi non peggiorano | \|errore\| 1,6166 | **1,5960** · 15 migliora / 11 peggiora / 167 pari | **verde, e debole** |
| **S3** | il fattore tocca solo le soste in finestra | — | **153 su 153**, zero fuori finestra | **verde** |
| **S4** | niente regressioni | — | suite senza regressioni, 4 banchi verdi | **verde** |

## S1: rosso, e la prereg diceva cosa significa

La prereg scriveva, prima di misurare:

> *Se **aumenta**, il meccanismo che ho proposto nel referto — «la sosta costa troppo poco,
> quindi scavalca troppe auto» — **è sbagliato**, e va scritto così, non riformulato.*

È aumentato. **Il meccanismo era sbagliato**, e la sosta sotto neutralizzazione esce dai
candidati per riparare il movimento.

### Perché, misurato invece che raccontato

Ho forzato il fattore lungo una scala per vedere se il movimento è monotono nel prezzo:

| fattore della sosta in finestra | cambi del motore in finestra |
|---|---|
| 0,10 | 87 |
| 0,25 | 107 |
| 0,50 *(uniforme; produzione è SC 0,50 / VSC 0,65 → 145)* | 139 |
| **0,6227 — il misurato** | **154** |
| 0,75 | 158 |
| 1,00 *(prezzo pieno, come in verde)* | 167 |
| | **la realtà: 122** |

**Monotona crescente**: più la sosta costa, più il motore rimescola. Ovvio col senno di poi —
perdere più tempo ti fa scendere più in basso nell'ordine, e scendere più in basso significa
incrociare più auto. Il mio meccanismo aveva il segno rovesciato.

## La contraddizione che questo esito lascia in piedi, ed è il risultato vero

Mettendo insieme la scala qui sopra e il cronometro:

| | valore | da dove viene |
|---|---|---|
| il prezzo che riprodurrebbe il movimento vero (122) | **≈ 0,35** *(interpolando fra 0,25→107 e 0,50→139)* | questo banco |
| il prezzo che il **cronometro** misura | **0,6227** · IC95 [0,515 ; 0,727] | 147 gare asciutte, 3.911 soste, controllo in verde 1,011 |
| il prezzo **in produzione** | **0,50** | prior esterno, banda 0,40-0,60 |

**I due numeri stanno su lati opposti di quello in produzione**, e non possono avere ragione
entrambi. Il valore che gira oggi è a metà strada fra una misura fisica e un adattamento che
nessuno ha scelto: **il 0,50 sta assorbendo in silenzio un secondo errore del modello.**

## Una spiegazione che avevo pronta, e che ho falsificato prima di scriverla

Stavo per scrivere che sotto Safety Car la compressione impacchetta il campo troppo stretto,
e che in un campo denso qualunque perdita di tempo incrocia troppe auto. **È falso.** Misurato
il gap mediano fra auto adiacenti sui giri neutralizzati:

| | motore | vero | rapporto |
|---|---|---|---|
| **mediana su tutte le gare** | **4,46 s** | **3,00 s** | **1,48** |

Il campo del motore sotto neutralizzazione è **più largo** del vero, non più stretto. E la
mediana nasconde tutto: Monaco **5,39×**, Ungheria 2,37×, Giappone 1,60× da una parte; Miami
**0,44×**, Spagna 0,62×, Austria 0,69× dall'altra. Non c'è un verso unico.

Quindi il rimescolamento in eccesso **non viene dalla densità del campo**. Resta senza
spiegazione misurata, e lo lascio senza: la lettura che mi viene — che nella realtà chi si
ferma sotto SC esce in coda con gli altri che si sono fermati, e quindi conserva l'ordine
relativo, mentre il motore prezza ogni sosta contro il campo come se le altre non ci fossero
— **non l'ho misurata**, e dopo due meccanismi sbagliati di fila non ho intenzione di
scriverne un terzo come se fosse un risultato.

## S2, e perché non salva niente

Col fattore misurato gli arrivi migliorano appena: \|errore\| 1,6166 → **1,5960**, G2 87,6% →
88,1%, appaiato **15-11** su 26 discordanti (sopra la soglia dei 20, quindi non NULL). Ma
15 contro 11 è una monetina, e S2 non era il cancello che decideva.

Vale però come **evidenza da portare a N3** — il cancello che può promuovere il fattore
misurato, e che decide sul bias del passo a 3/5/10 giri. N3 non ha mai guardato gli arrivi:
adesso c'è un numero, ed è lievemente a favore. **Non promuovo niente qui**, come la prereg
vietava esplicitamente.

## S3: il mio conto era sbagliato, lo strumento no

Mi aspettavo che le soste col prezzo cambiato fossero **162** (tutte quelle in finestra) e ne
ho contate **153**. Le nove mancanti sono tutte a **Monaco, al giro 67, sotto bandiera
ROSSA**: il fattore RED vale **0** nel prior e la misura interna non ha un RED, quindi il
prezzo è zero in entrambi i bracci e non può cambiare. **Zero soste toccate fuori da una
finestra** — che era la cosa che, se fosse andata storta, avrebbe reso il rosso di S1 un
artefatto dello strumento.

## Dove lascia il filo

Tre tentativi in due giorni sullo stesso bersaglio — il movimento che il motore non riproduce
— e tre chiusure:

| | |
|---|---|
| il **tetto** al movimento | NULL: abbassarlo muove di più e non azzecca di più |
| il movimento **in finestra** | non è lì che manca: lì ne avanza |
| il **prezzo** della sosta in finestra | non è la causa dell'eccesso: alzarlo lo peggiora |

Quello che resta non è più un candidato con un numero: è una **contraddizione con un nome**.
Il prezzo che il cronometro misura (0,62) e quello che riprodurrebbe il movimento (0,35)
sono incompatibili, e il valore in produzione sta comodamente in mezzo senza che nessuno
l'abbia deciso. Chiunque riapra questo ramo dovrebbe partire da lì, e non da un terzo
meccanismo inventato al tavolo.

---

*Nessun parametro cambiato, nessun file di produzione toccato: `promosso` resta `false` e il
sigillo non si tocca. Suite senza regressioni, quattro banchi del sito verdi.*
