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
