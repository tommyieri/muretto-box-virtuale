# Prereg — la vita della mescola: il degrado come budget di giri, non come pendenza

**Data: 04/08/2026.** Scritta **prima** di eseguire una sola misura del modello nuovo.
Esegue la deroga firmata in `simulatore/DEROGA_prior_comportamentale.md`.

Gli **ingressi** (le durate mediane per mescola) sono già stati letti e sono dichiarati qui
sotto: sono il parametro, non l'esito. L'**esito** — se il modello riproduca fuori campione
le durate scelte dai team — non è stato misurato.

---

## 1 · La forma, e perché non è il cliff che è già stato chiuso

Oggi: `t = base + δ·(giro−1) + ρ·età`. La mescola non compare, quindi non fa niente, quindi
l'ottimo di sosta è `(R−a)/2` **qualunque gomma tu monti**.

Proposta, un solo termine in più:

```
t = base + δ·(giro−1) + ρ·età + ρ·max(0, età − vita(mescola))
```

**Zero parametri liberi oltre `vita`.** Dentro la vita la fisica è quella di oggi, **bit per
bit**; oltre la vita ogni giro costa **il doppio** — sei oltre il punto in cui ogni squadra
al mondo ha deciso di staccare. Il fattore due non è tarato: è la scelta più semplice che
esista, dichiarata qui e non scelta dopo.

**Non è il cliff.** Il cliff è stato chiuso NULL il 03/08 con una diagnosi precisa: *«un
termine della sola età premia le gare lunghe invece delle gare dove servono due soste»* —
C1 e C2 in conflitto a ogni κ. Qui il termine **non è della sola età**: è di
`età − vita(mescola)`, cioè **relativo alla gomma montata**. Su una gara lunga con la hard
il termine resta zero fino al giro 22; su una gara corta con la soft morde dal giro 12. È
esattamente il difetto strutturale che aveva ucciso il cliff, e questa forma non ce l'ha.

## 2 · Il parametro, dichiarato prima

Natura **`PRIOR_COMPORTAMENTALE`**. Perimetro: stint 2026 **conclusi da una sosta** (esclusi
quelli che finiscono con la bandiera: non sono decisioni sulla gomma, è la gara che è
finita), mescola slick, durata > 0. **427 stint.**

| mescola | `vita` | n | interquartile |
|---|---|---|---|
| SOFT | **12** | 95 | 7 – 16 |
| MEDIUM | **19** | 202 | 14 – 24 |
| HARD | **22** | 130 | 18 – 26 |

**La mediana e non la media**, perché la coda è fatta di soste opportunistiche sotto regime
e di incidenti al primo giro (i minimi sono 1 giro): la mediana le assorbe, la media no.

**Perché globale e non per circuito.** Le celle circuito × mescola sono troppo magre: Canada
e Miami hanno **zero** stint hard conclusi, Cina e Gran Bretagna ne hanno **due** di soft.
Il per-circuito è una domanda successiva, con la sua prereg e il fondo alle spalle.

## 3 · Cosa si prevede, e con quale macchina

Per ogni stint osservato: dallo stato al suo inizio, si chiede al **pianificatore del
motore** — non a una formula scritta per l'occasione — quale durata sceglierebbe con quella
mescola. Si legge la durata scelta, si confronta con quella vera.

Usare il pianificatore e non una formula è la parte che rende il cancello non circolare:
**si sta giudicando la fisica, non la statistica descrittiva da cui `vita` è uscita.**

**Fuori campione**: leave-one-race-out. `vita` si ricalcola sulle **altre dieci gare**, la
previsione si legge sulla gara tenuta fuori. Nessuno stint contribuisce al parametro che lo
giudica.

## 4 · I due nulli, e vanno battuti **entrambi**

| | nullo | perché esiste |
|---|---|---|
| **N1** | **il motore di oggi** — stessa procedura, senza il termine di vita | non distingue le mescole: è il metro di «la mescola non serve» |
| **N2** | **il pavimento descrittivo** — prevedere direttamente `vita(mescola)`, senza fisica | impedisce la circolarità: se il modello non batte la sua stessa mediana, la fisica non aggiunge niente |

**Battere uno solo non basta.** È la congiunzione con cui è stato registrato F1, e per la
stessa ragione: i due nulli sbagliano in verso opposto — N1 ignora la mescola, N2 ignora
tutto il resto — e batterne uno solo sfrutterebbe la debolezza strutturale di quello.

## 5 · I cancelli, con le soglie scritte adesso

Metrica: **errore assoluto in giri** fra durata prevista e durata osservata, per stint.

| | cancello | soglia |
|---|---|---|
| **V1** | batte N1 | errore mediano **strettamente minore**, e test dei segni appaiato **p < 0,05** |
| **V2** | batte N2 | errore mediano **strettamente minore**, e test dei segni appaiato **p < 0,05** |
| **V3** | non rompe ciò che funziona | la risposta a **due giri** non peggiora in modo significativo (test dei segni appaiato, come U3/T4) |
| V4 | *diagnostico* | quante volte il piano propone **k ≥ 2** soste, contro le 0 su 11.142 pannelli di oggi |
| **V5** | invarianza | con `vita = null` i numeri sono **bit-identici** a oggi, verificato da una sentinella |

**V3 è il cancello che conta di più**, ed è la lezione del tetto al movimento: un
cambiamento che raddrizza una popolazione rompendo la risposta a due giri — l'unica che il
prodotto pubblica e l'unica validata fuori campione — non è un miglioramento, è uno scambio
in perdita.

### La regola di decisione, scritta prima

- **V1 e V2 e V3 passano** → il modello è ammesso, si registra, e l'accensione in produzione
  è una decisione del PO (separata).
- **V1 o V2 falliscono** → NULL. Si scrive che la vita della mescola, in questa forma, non
  riproduce le decisioni meglio dei nulli, e il selettore mescola **resta un display** con
  la ragione aggiornata.
- **V3 fallisce** → NULL **anche se V1 e V2 passano**, e si scrive che il prezzo cade sulla
  risposta validata.

## 6 · Le letture secondarie, dichiarate ora per non poterle scegliere dopo

- **verde soltanto**: le soste sotto SC/VSC sono opportunistiche, non decisioni sulla gomma.
  Si riporta la stessa misura escludendole. **Non è un cancello**: il perimetro primario
  resta tutti i 427, perché restringerlo dopo aver visto i numeri sarebbe scegliere il
  perimetro.
- **per mescola**: V1/V2 si riportano anche separatamente per SOFT, MEDIUM e HARD. Se il
  guadagno venisse da una sola mescola, va visto.

## 7 · Cosa questa prereg NON fa

- **Non tocca ρ, δ, la banda o il pit-loss.** Un solo termine nuovo, e dentro la vita il
  motore è bit-identico.
- **Non prova più di una forma.** Una sola, dichiarata al §1: niente molteplicità da
  correggere e niente «la migliore delle N». Se fallisce, una forma diversa è una prereg
  diversa, e la sua soglia si scrive senza aver visto questi numeri.
- **Non accende niente.** `vita = null` in produzione finché il PO non decide.
- **Non promette il per-circuito.** Quello è lo strato C, e ha bisogno del fondo.
