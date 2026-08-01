# La carta delle ere — quando 173 gare valgono 173, e quando valgono zero

*Scritta il 01/08/2026, PRIMA di costruire il motore per casi. È il documento che decide
quali dati una domanda può usare, e va scritto prima di guardare le risposte.*

## Perché esiste

Il motore per casi risponde contando: «in N situazioni come questa, M volte è finita così».
La forza è tutta nel numero di casi — e la tentazione è usarli tutti.

**Ma nel 2026 il regolamento è cambiato**, e per alcune domande le gare 2018-2025 sono un
altro sport. Mediarle dentro sarebbe il modo più elegante di sbagliare: tanti casi, un
numero stretto, un intervallo di confidenza rassicurante, e una risposta su un mondo che
non esiste più.

> Un caso di un'era diversa non è un caso in meno: è un caso **sbagliato**, e conta più di
> uno mancante perché sposta la risposta invece di allargarla.

## Cosa è cambiato nel 2026

| | prima (2018-2025) | 2026 |
|---|---|---|
| **sorpasso assistito** | DRS | **non esiste** — Manual Override Mode |
| **unità di potenza** | ibrido ~120 kW elettrico | ~50/50 termico-elettrico |
| **aerodinamica** | fissa | attiva (assetto basso/alto) |
| **gomme** | mescole 2018-2025 | mescole nuove |
| **mescole obbligatorie** | due su asciutto | due su asciutto (**invariato**) |

## La regola: ogni domanda dichiara di cosa ha bisogno

Non esiste «il fondo è valido» o «il fondo non è valido». Esiste **per questa domanda**.

| domanda | dipende da | il fondo vale? |
|---|---|---|
| **chi si ferma sotto SC** | decisione di muretto, pit-lane, regola delle due mescole | **sì** — nulla di ciò che la governa è cambiato |
| **quanto costa la sosta (pit-loss)** | geometria della pit-lane, limite di velocità | **sì** per circuito, invariato |
| **quanto durano SC e VSC** | procedura FIA | **sì** |
| **compressione dei distacchi sotto SC** | velocità della vettura di sicurezza | **sì**, ma il passo di riferimento cambia → da verificare |
| **quanti sorpassi dopo un restart** | **DRS** | **NO** — il fondo è un altro sport |
| **quanto rende un undercut** | riscaldamento gomma, degrado | **NO** — gomme diverse |
| **quanto rimescola una bandiera rossa** | regola sul cambio gomme a gara ferma | **da verificare** |

## E la regola non basta: la compatibilità si MISURA

Dichiarare «questa domanda non dipende dal DRS» è un'ipotesi, non un fatto. Per ogni
domanda il motore riporta **tre numeri, sempre**:

1. la risposta sul **fondo** (2018-2025);
2. la risposta sul **2026** da solo;
3. se le due sono **compatibili** — intervalli che si sovrappongono, blocchi = gare.

**Se non sono compatibili, vince il 2026 e il fondo diventa contesto**, con la differenza
scritta accanto. Se il 2026 ha troppo pochi casi per rispondere, si dice che non lo sa —
non si usa il fondo di nascosto.

## Cosa NON si fa, mai

- **Pesare le ere per «somiglianza»**: un peso è un parametro, e i parametri sono la strada
  da cui veniamo.
- **Correggere il fondo con un fattore 2026**: già provato altrove in questo repo, esito
  NULL, e comunque sarebbe di nuovo un numero da tarare.
- **Usare il fondo perché il 2026 ha pochi casi.** Se i casi non bastano, la risposta è
  «non lo so». È l'unica cosa che un motore per casi sa fare e un modello a parametri no.

---

## Prima misura — 01/08/2026: il confronto fra ere è CIECO, e questa è la notizia

Prima domanda passata dal motore per casi: *chi si ferma sotto Safety Car di campo*.

| | fondo 2018-2025 | 2026 | |
|---|---|---|---|
| tutti | **7,7%** (749/9.782, 105 gare) IC95 5,5-10,0% | **13,0%** (147/1.127, 10 gare) IC95 **3,4-25,9%** | +5,4 punti |
| gomme vecchie (≥15) | 12,9% (288/2.232, 72 gare) | **29,5%** (87/295, 8 gare) IC95 8,0-47,0% | **+16,6 punti** |
| gomme fresche (<15) | 6,1% (461/7.550, 103 gare) | 7,2% (60/832, 10 gare) | +1,1 punti |

Il verdetto formale è **compatibili** su tutte e tre. Ma il potere del confronto è
**CIECO**: con dieci gare l'IC del 2026 è così largo che contiene sia il valore del fondo
sia il suo doppio. «Compatibili» qui non vuol dire *sono uguali* — vuol dire **non riesco a
distinguere**, ed è una cosa diversa che va stampata accanto al verdetto o inganna.

E i tre punti-stima del 2026 stanno **tutti sopra** il fondo, con lo scarto più grosso
proprio dove il regolamento è cambiato di più: sulle gomme vecchie, +16,6 punti. Non è
stabilito, ma è la direzione che un occhio deve tenere.

### Cosa se ne fa il prodotto oggi

Si usa la risposta del **fondo** — è l'unica con un intervallo utilizzabile — **dichiarando
che il 2026 potrebbe stare al doppio e che non lo sappiamo**. Un parametro non avrebbe
potuto dire questa frase: avrebbe dato 7,7% e basta.

### Cosa serve perché smetta di essere cieco

Gare del 2026. Non un metodo migliore: **gare**. Il confronto diventa utile intorno alle
venticinque-trenta, cioè a stagione finita — oppure prima, se si ingeriscono le sessioni
che oggi scartiamo. È la prima volta che il repo può dire **quante ne servono** invece di
sperare che bastino.

---

## Seconda misura — 01/08/2026: cosa succede DAVVERO a chi si ferma

`esiti_reali.mjs`. Nessun passo, nessun kernel, nessun Director: **4.283 soste vere** nel
fondo e **371** nel 2026, con la posizione reale dieci giri dopo.
Negativo = ha guadagnato posizioni.

| situazione | fondo 2018-2025 | 2026 |
|---|---|---|
| **tutte** | mediana **+1** · guadagna 15,1% · perde **61,9%** | mediana +0 · guadagna 24,0% · perde 45,6% |
| **in verde** | mediana **+2** · guadagna 8,6% · perde **69,8%** | mediana +1 · guadagna 9,1% · perde 58,9% |
| **sotto neutralizzazione** | mediana **0** · guadagna **37,3%** · perde 35,0% | mediana 0 · guadagna **45,4%** · perde 26,3% |
| ultimo terzo di gara | mediana +1 · guadagna 18,0% | mediana 0 · guadagna **47,9%** |

### Tre cose che il motore a parametri non aveva mai detto

**1 · Fermarsi in verde fa perdere posizioni, quasi sempre.** Mediana +2, e si perde nel
**69,8%** dei casi contro l'8,6% che guadagna. Ovvio a posteriori — a dieci giri sei ancora
dietro a chi non si è fermato — ma è la prima volta che il repo lo **misura**, e cambia il
modo di leggere ogni «dove rientri».

**2 · Sotto neutralizzazione è un altro gioco.** Da 70% di perdite si passa a **37% guadagna
contro 35% perde**: quasi un lancio di moneta. È il valore della sosta sotto Safety Car
quantificato direttamente, senza passare da nessun fattore da tarare.

**3 · Il 2026 è sistematicamente diverso, in tutti e sette i tagli.** Si perde meno e si
resta fermi di più (30,5% contro 23,0% di posizioni invariate). È esattamente ciò che ci si
aspetta **togliendo il DRS**: le posizioni diventano appiccicose. Nell'ultimo terzo di gara
lo scarto è enorme — guadagna il 47,9% contro il 18,0%.

Nessuna di queste tre viene dal passo. Vengono dai **duelli e dalle reazioni dei rivali**,
cioè le due cose che il kernel dichiara di non simulare.

### Cosa manca perché diventi una risposta del prodotto

Questi sono **tassi di base**: dicono cosa succede tipicamente, non cosa succede a *te*.
Il passo successivo è il recupero per somiglianza — «le venti situazioni più simili alla
tua, e come sono finite» — che è la stessa macchina con una query addosso.

### Il limite, dichiarato

Il 2026 ha da 71 a 219 casi per taglio, su undici gare. **Nessun singolo taglio è
concludente.** Ciò che vale è che la direzione è la stessa in **tutti e sette**, e questo
un taglio solo non lo direbbe.

---

## Terza misura — 01/08/2026: la carta aveva fatto due previsioni. Una regge, una no.

`domande.mjs`. Stesso schema: fondo, 2026, compatibilità e **potere** del confronto.

| domanda | fondo 2018-2025 | 2026 | verdetto |
|---|---|---|---|
| **dopo un restart** cambia posizione nei 3 giri? | **36,6%** (2.196 casi, 95 gare) | 39,7% (277, 11 gare) | **compatibili**, potere **utile** |
| **undercut** riuscito, quando si ferma anche il rivale | **30,7%** (2.459 casi, 146 gare) | **20,6%** (218, 11 gare) | **DIVERGONO**, potere **utile** |
| **bandiera rossa**: cambia posizione? | 76,1% (130 casi, 7 gare) | **non lo so** (15 casi) | non giudicabile |

### La previsione smentita: il restart

La carta diceva «per i sorpassi il fondo **non** vale, nel 2026 il DRS non esiste». Misurato:
36,6% contro 39,7%, **compatibili e con potere utile** — cioè il confronto *avrebbe potuto*
vedere una differenza, e non l'ha vista.

**Togliere il DRS non ha cambiato quanto si rimescola dopo un restart**, almeno non
abbastanza da vedersi. Il fondo può rispondere a questa domanda, contro quello che avevo
scritto.

### La previsione confermata: l'undercut

Qui i due mondi **divergono davvero**: 30,7% contro **20,6%**, dieci punti di meno, con IC
che non si sovrappongono. **Nel 2026 l'undercut rende un terzo in meno.**

Per questa domanda il fondo è **contesto, non evidenza** — esattamente come la carta
dichiarava. E adesso non è più un'ipotesi sul regolamento: è una misura.

### Il difetto che ho corretto prima di pubblicare

La prima definizione di undercut guardava la posizione **cinque giri dopo la mia sosta**, e
dava il 3,4%. Ovvio: lì io avevo pagato la perdita ai box e il rivale no. Non misurava
l'undercut — misurava «ho già scontato la sosta mentre lui deve ancora farla».

Il vantaggio dell'undercut esiste solo **quando anche lui è rientrato**. Corretta la
definizione (tre giri dopo la sosta del rivale, entrambi su gomme nuove), il numero passa da
3,4% a 30,7% — e il verdetto sulle ere si ribalta da «compatibili» a «divergono».

**Una definizione sbagliata non dà un numero sbagliato: dà un numero che risponde a
un'altra domanda**, e sembra a posto.

### E la bandiera rossa dice «non lo so»

Quindici casi nel 2026, contro i trenta della soglia. Il motore **si rifiuta di rispondere**,
ed è la ragione per cui è stato costruito: un parametro avrebbe dato un numero comunque.
