# Prereg — il tetto al movimento è sotto-tarato?

**Data: 14/08/2026.** Scritta e sigillata **prima** di eseguire un solo λ diverso da 1.

Nasce dal `REFERTO_provenienza_errori.md` del 14/08: il **71,8%** dello scarto fra motore e
gare vere sta in casi in cui il motore **muove meno** del vero, e il 39,1% in casi in cui non
muove affatto un pilota che la realtà sposta di 2,18 posizioni. Il tetto al movimento è
l'unico parametro del progetto che governa direttamente quel numero.

---

## 0 · Il confine con le preregistrazioni già sigillate, e perché questa non lo viola

`PREREG_tetto_movimento.md` §6 dice: *«non autorizza a stimare né a ricentrare
`t_gap_overtake` sui nostri dati»*. Va rispettato, e va anche detto che **quella prereg
governava un altro oggetto**: le soglie importate da TUMFTM, che sono uscite **NULL** il
03/08 (il guadagno non veniva dal circuito, e il costo cadeva sulla popolazione sana).

La soglia che gira in produzione oggi viene da `PREREG_soglia_sorpasso.md` ed è **misurata
sul nostro fondo**: 0,6054 s/giro ovunque, 2,8337 a Monaco. Quella prereg (§7) dichiara una
cosa che qui è decisiva: **il livello è già stato ancorato al 2026** traslando la forma di
una costante scelta perché *«la quota di sorpassi prevista sulle 11 gare del 2026 uguagli
quella osservata»*.

Ed è esattamente da lì che nasce la domanda: **se il livello è già ancorato alla quota di
sorpassi osservata, perché alla bandiera il motore produce 8,3 cambi di posizione contro i
12,0 veri?** O l'ancoraggio non si trasferisce alla proiezione a gara intera, o il movimento
che manca viene da un'altra parte.

**Questa prereg non ri-tara niente.** Misura se il valore in produzione è coerente con la
proiezione a gara intera, **fuori campione**, e il suo esito è un referto. Cambiare il numero
in produzione richiederebbe un'altra prereg, e non è autorizzato qui (§6).

## 1 · Il fondo, misurato il 14/08 PRIMA di questa prereg

Banco: `ai_lab/confronto/pavimento_gara_intera.mjs`, 193 casi pilota-gara, gara intera con le
finestre SC/VSC vere, col pavimento sulla compressione acceso (#155).

| | |
|---|---|
| \|errore\| medio, tetto in produzione (λ=1) | **1,617** |
| \|errore\| medio, tetto **spento** | **1,560** |
| cambi di posizione: reali / motore | **12,0 / 8,3** |

E il tetto **come meccanismo**, misurato con contatori dentro il ramo (strumentazione
additiva, numeri bit-identici):

| | |
|---|---|
| coppie adiacenti esaminate | 156.400 |
| di cui entro `minGap` (0,5 s) | **23.769** (15,2%) |
| sorpasso concesso | 4.030 (**17,0%** dei contatti) |
| chi insegue **resta dietro** | **19.739** (**83,0%** dei contatti) |
| a chi resta dietro manca, in mediana | **0,355 s/giro** |
| bloccati a cui manca **≤ 0,3 s** | **8.447** = **42,8%** dei bloccati |

**Il tetto è un vincolo attivo e quasi-marginale**: blocca 102 volte per caso, e in
quattro casi su dieci per meno di tre decimi. Se fosse un vincolo che quasi non si esegue,
questa prereg sarebbe inutile e lo direi qui: non lo è.

## 2 · La forma: **un parametro solo**, e non è un valore nuovo

Non si stima una soglia per circuito, non si cambia la forma. Si moltiplica la soglia
sigillata per un fattore unico **λ**:

```
soglia(gara) = λ · soglia_sigillata(gara)      λ = 1 è la produzione
```

Un fattore solo su tutte le piste: la geometria misurata (Monaco 4,7 volte le altre) resta
**intatta**, e λ dice soltanto se il *livello* è alto o basso. λ < 1 = si passa più
facilmente = più movimento.

**Griglia dichiarata adesso**, e non se ne aggiungono altri valori dopo:

```
λ ∈ {0 · 0,25 · 0,5 · 0,75 · 1 · 1,25 · 1,5 · 2 · 3}       più il tetto SPENTO come riferimento
```

λ = 0 non è «tetto spento»: il pavimento `minGap` e i costi di duello restano, cambia solo
che ogni vantaggio di passo basta a passare (`vantaggio > 0`).

**Il perimetro del tetto, dichiarato perché non si scopra dopo.** Il tetto gira **solo sui
giri verdi**: `if (tetto !== null && !comprime)` in `kernel.mjs`. Dentro le finestre SC/VSC
la spaziatura la detta la compressione, e λ non tocca **niente** di quei 18.443 giri
compressi. Quindi λ può governare al massimo il movimento che avviene in verde: se l'esito
fosse NULL, questa è la prima cosa da guardare prima di concludere che il movimento manca
per colpa d'altro.

## 3 · I cancelli, dichiarati prima

**E1 — FUORI CAMPIONE, ed è l'unico che decide.** Leave-one-race-out: per ognuna delle 11
gare, si sceglie il λ che minimizza \|errore\| medio **sulle altre dieci**, e lo si applica
alla gara tenuta fuori. Il predittore così ottenuto si confronta con λ=1 **caso per caso**
sui 193 appaiati.

- **passa** se i casi che peggiorano **non superano** quelli che migliorano;
- **è NULL, non verde**, se le coppie discordanti sono **meno di 20** (stessa regola della
  prereg del pavimento: su errori interi la maggioranza dei casi sarà pari, e un 3-3 non
  prova niente);
- la popolazione deve restare **193 casi e 48 saltati**: se cambia, l'appaiamento non è più
  appaiato e l'esito è NULL.

**Tre cose si riportano insieme all'esito, e sono dichiarate qui perché non si possa
scegliere dopo quale raccontare:**

1. **La curva intera** \|errore\|(λ) su tutti e nove i valori. Se è **piatta** — se lo
   scarto fra il λ migliore e il peggiore (escluso il degenere λ=0) è più piccolo
   dell'incertezza della media — allora il minimo è rumore e **E1 non è leggibile**, anche
   se il conto appaiato dovesse uscire a favore. L'incertezza è un bootstrap a **blocchi =
   gare** (2.000 ripetizioni, seme 20260814), che è la regola della casa (E11).
2. **Gli undici λ scelti**, uno per gara. Se sono tutti uguali, il LOO è quasi in campione e
   il suo ottimismo è piccolo ma la sua indipendenza è debole: va detto. Se sono sparsi, il
   parametro non è stabile fra le gare, e quello è di per sé un esito.
3. **Il λ ottimo IN CAMPIONE**, accanto a quello fuori campione. La distanza fra i due è
   quanto la griglia si stava adattando al rumore, e va stampata soprattutto se è grande.

**E2 — il movimento si avvicina.** Col predittore LOO, \|cambi_motore − cambi_reali\| medio
deve **ridursi** rispetto a λ=1 (oggi il motore fa 8,3 contro 12,0). È diagnostico dello
stesso fenomeno di E1: se E1 passasse ed E2 no, il guadagno non verrebbe dal movimento e
andrebbe spiegato prima di crederci.

**E3 — non si rompe la risposta validata, ed è un veto.** La metrica a **due giri**
(`dueGiri()` in `cancelli_tetto.mjs`, la risposta che il prodotto pubblica e l'unica validata
a ±2 posizioni) non deve peggiorare: appaiato contro λ=1, **p ≥ 0,05**.

> **E3 rosso = NULL, qualunque cosa dicano E1 ed E2.** È il cancello che il tetto TUM aveva
> già fallito il 03/08 (16-33, p = 0,0213), ed è il motivo per cui quell'esito fu NULL. Non
> si spende due volte lo stesso prezzo fingendo di non ricordarselo.

**E4 — il placebo sulla PROCEDURA.** Non su un altro parametro: `costoDuello` **non è
inerte** — aggiunge tempo a chi è in contatto, quindi muove i cumulati e quindi il
movimento. Usarlo come placebo sarebbe misurare un secondo effetto vero e chiamarlo caso.

Il placebo giusto è sull'**assegnazione**: si prendono gli undici λ scelti dal LOO e si
**rimescolano fra le gare** (200 permutazioni, seme dichiarato 20260814), poi si rifà il
confronto appaiato. Se l'assegnazione vera non batte il **95° percentile** delle permutate,
allora scegliere il λ *per quella gara* non aggiunge nulla — e quel che resta è al massimo
un λ globale diverso da 1, che è una **claim diversa** e va scritta come tale, non spacciata
per l'esito di E1.

## 4 · Che cosa vorrà dire l'esito

- **E1 verde, E2 verde, E3 verde, E4 pulito** → il livello del tetto **non è coerente** con
  la proiezione a gara intera, e la direzione è misurata fuori campione. Si scrive il
  referto e si apre una prereg per decidere cosa farne. **Qui non si accende niente.**
- **E1 rosso** → il tetto **non è sotto-tarato**: il valore misurato regge, e il movimento
  che manca viene da un'altra parte. È il risultato più utile dei due, perché chiude una
  strada invece di aprirne una.
- **E1 verde ma E3 rosso** → si guadagna alla bandiera e si paga sulla risposta pubblicata:
  **NULL**, e si scrive che il tetto è il prezzo che il prodotto paga per la risposta a due
  giri. Non si sceglie la bandiera contro il pannello senza che lo decida il PO.
- **E1 verde ma E4 sporco** → il guadagno è della procedura, non del parametro: NULL.
- **E1 NULL per campione** → si dichiara che il banco non ha potuto decidere.

## 5 · Cosa NON si fa, qualunque sia l'esito

- **Non si accende niente in produzione.** Nessun λ diverso da 1 finisce nel sigillo con
  questa prereg.
- **Non si stima una soglia per circuito**: il ramo è chiuso NULL dal 03/08 e la geometria
  resta quella misurata.
- **Non si allarga la griglia** dopo aver visto la curva, e non si aggiunge un λ intermedio
  «per curiosità» attorno al minimo: sarebbe scegliere dopo.
- **Non si tocca `minGap`, `costoDuello`, `costoSubito`** se non come placebo dichiarato.
- **Non si spegne il tetto** come conclusione: «spento» è un riferimento di misura, e la sua
  accensione ha una prereg sua.

---

*Sigillo: committata prima di eseguire un solo λ ≠ 1. Il commit che la introduce contiene la
strumentazione (contatori del tetto, additivi e verificati inerti) e il banco, e non cambia
un numero.*
