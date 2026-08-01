# PREREG — la finestra invece del giro secco

*Scritta il 01/08/2026 PRIMA di costruire il banco di perturbazione e prima di misurare
qualunque dispersione. Voce 5 di `PIANO_CORREZIONE.md`.*

## La decisione è già presa, e questo documento non la rimette in discussione

**Il PO ha deciso il 01/08: finestra sempre.** Il giro raccomandato non si pubblica più come
un numero secco, in nessun caso. Non c'è nessun cancello che decide fra secco e finestra:
quella domanda è chiusa.

Quello che resta da misurare è **quanto larga**. È una domanda diversa, e ha bisogno di un
metro suo.

## Perché adesso, e perché è più urgente di stamattina

Sulle viste pubblicate **4.241 raccomandazioni** (il 56,9% delle curve) hanno un minimo
interno, e il guadagno promesso è **sotto 1 s nel 29,0%** dei casi. Il solo arrotondamento
al millesimo sposta il giro raccomandato in **25 curve su 260**.

E oggi la soglia di base è scesa da 8 a 4: le risposte pre-calcolate sono passate da 10.131
a **11.143**. Se quelle raccomandazioni sono rumore, ne stiamo pubblicando mille in più.

## Come si misura la larghezza

Si ricalcola la curva del «quando» **perturbando dentro l'incertezza che il modello dichiara
di sé** — non dentro un'incertezza inventata per l'occasione. Ogni estremo viene da una
targhetta che esiste già:

| grandezza | perturbazione | da dove viene |
|---|---|---|
| `ρ` | estremi dell'IC95 | `modello_v2.json` |
| `δ₇₀` | estremi dell'IC95 | `modello_v2.json` |
| pit-loss | estremi già stampati in targhetta | `pitloss_priors.json` / misura interna |
| `L` | ±1 giro | il congelamento non è un istante esatto |

Per ogni curva si prende il giro raccomandato sotto **ogni** perturbazione, e la
**dispersione** di quei giri è la larghezza della finestra da pubblicare.

**Regola dichiarata:** la finestra è `[min, max]` dei giri raccomandati sotto le
perturbazioni. Non un intervallo di confidenza costruito a posteriori — l'inviluppo di ciò
che il modello dice di sé quando gli si crede fino in fondo ai suoi stessi estremi.

## La sonda obbligatoria, e cosa la fa fallire

> Con **perturbazione nulla** il banco deve riprodurre **esattamente** la curva che il
> prodotto pubblica oggi: gli stessi minimi interni, gli stessi giri raccomandati.

Se non li riproduce, non sta misurando il prodotto ma un modello somigliante, e ogni numero
che ne esce è aria. È la stessa sonda della PREREG-2 (κ = 1) e della voce 1
(rodaggio spento): un banco che non riproduce il punto di partenza non misura la distanza
da lì.

## Cosa si riporta

1. la **dispersione** del giro raccomandato: quanti giri largo, mediana e coda;
2. quante curve hanno una finestra di **un solo giro** — cioè dove il secco sarebbe stato
   onesto — e quante ne hanno più di cinque;
3. **quale perturbazione domina**: se il giro si muove soprattutto per `L±1`, la larghezza
   non viene dal modello ma dalla granularità della domanda, ed è una notizia diversa;
4. i casi in cui il minimo **sparisce** sotto perturbazione, cioè la curva non ha più un
   interno: lì non c'è nessuna finestra da pubblicare, e va detto invece che inventata.

## Cosa fa dichiarare NULL

- la sonda a perturbazione nulla non riproduce il prodotto;
- la finestra risulta **più larga dell'orizzonte utile** in oltre metà dei casi: vorrebbe
  dire che la curva non sa dire niente, e la risposta giusta non è una finestra enorme ma
  smettere di pubblicare quel numero;
- la dispersione è **zero ovunque**: il banco non sta perturbando niente, e (2) e (3)
  sarebbero teatro.

## Cosa NON dimostrerà

- Non dirà se il giro raccomandato è **giusto**: dirà quanto è **fermo** rispetto
  all'incertezza che il modello dichiara. Un modello sicuro di sé e sbagliato darebbe una
  finestra stretta.
- L'incertezza vera è più grande di quella dichiarata: qui dentro non c'è il rumore di gara
  (±11,7 s misurati), né il traffico, né la reazione dei rivali.
- Resta dentro campione come tutto il resto.

---

## ESITO — 01/08/2026: la finestra è STRETTA, e non per il motivo che ci si aspettava

**La sonda obbligatoria passa in modo esatto: 470 giri raccomandati su 470 identici a
quelli che stanno nelle viste pubblicate**, caso per caso. Il banco misura il prodotto, non
un modello somigliante.

### Quanto larga

Su **1.153 curve** (un congelamento ogni 6 giri, tutti i piloti, 11 gare), con nove
perturbazioni ciascuna:

| | |
|---|---|
| larghezza mediana della finestra | **1 giro** |
| p90 | 3 giri |
| massimo | 19 giri |
| curve con finestra di **un solo giro** | **640 (55,5%)** |
| curve oltre 5 giri | 77 (6,7%) |

**Il giro raccomandato è molto più fermo di quanto il piano temesse.** L'ipotesi era che
4.241 raccomandazioni fossero rumore; misurate contro l'incertezza che il modello dichiara
di sé, più della metà non si muovono affatto.

### E soprattutto: NON è il modello a muoverlo

| chi allarga la finestra | curve |
|---|---|
| l'incertezza del **modello** (ρ, δ₇₀, pit-loss agli estremi dei loro IC95) | **1 su 1.153** |
| il **congelamento** (L±1) | 513 su 1.153 |
| entrambi | 1 |
| nessuno dei due | 640 |

**Una curva su 1.153.** Portare ρ e δ₇₀ agli estremi del loro intervallo di confidenza, e il
pit-loss ai suoi, non sposta il giro raccomandato praticamente mai.

Non è una sorpresa se si guarda l'algebra: l'ottimo a una sosta cade dove l'età al pit
eguaglia l'età alla bandiera, e né la perdita ai box né δ entrano in quel punto — è la
stessa simmetria che la voce 1 aveva già dimostrato per il rodaggio, e che `s12` sorveglia.
**La curva del «quando» è molto più robusta della curva del «dove».**

Quello che la muove è **dove si chiede**: spostare il congelamento di un giro cambia il
giro raccomandato in 513 casi su 1.153. La finestra non nasce dall'ignoranza del modello,
nasce dal fatto che il congelamento non è un istante.

### Cosa vuol dire per la pagina

La decisione del PO — **finestra sempre** — resta giusta e ora ha un numero: nel 55,5% dei
casi la finestra è di un giro solo, e in pagina si leggerà come un giro solo. Nel 6,7% è
larga più di cinque giri, ed è lì che il secco avrebbe mentito.

Il guadagno mediano promesso dalla curva, a perturbazione nulla, è **2,390 s**.

### Cosa NON dice, e va ripetuto

Questa è **stabilità contro l'incertezza dichiarata**, non contro la verità. Il rumore di
gara (±11,7 s misurati), il traffico e la reazione dei rivali non sono qui dentro. Un
modello sicuro di sé e sbagliato darebbe esattamente questi numeri.
