# Prereg — il motore sa **quali** auto si scambiano, o solo quante?

**Data: 15/08/2026.** Sigillata **prima** di misurare una sola coppia.

Tutti i banchi di questa settimana contano `cambiDiPosizione`, che per costruzione misura
**quanti** cambi avvengono, non **quali**. È una scelta vecchia e dichiarata del progetto —
*«si riproduce QUANTI cambi, non QUALI»* (`kernel.mjs`, e `PREREG_sorpassi.md` che ha chiuso
il duello fuori campione su 78 gare).

Ma da quella scelta discende una cosa che **nessuno ha mai misurato**: un motore che azzecca
il numero di scambi e sbaglia sistematicamente le coppie darebbe esattamente i numeri che ho
pubblicato questa settimana — resa 88-93% in verde, ciclo di sosta al 93-95% — e sarebbe
comunque inutile per il giocatore, che non chiede *quanti* si scambiano ma *chi* passa chi.

Questa prereg misura quella cosa. **Non propone nessuna riparazione** e non autorizza niente.

---

## 1 · L'unità: la **coppia**, non il cambio

Per ogni gara, per ogni coppia non ordinata di piloti {A, B} del campo comune, si guarda se
il loro ordine relativo **è cambiato** fra il giro di congelamento e la bandiera:

| | la realtà la scambia | non la scambia |
|---|---|---|
| **il motore la scambia** | a | b |
| **non la scambia** | c | d |

`a + b + c + d` = tutte le coppie. È una tabella 2×2 per gara, e si somma a blocchi.

**Perché la coppia e non il cambio**: perché «quali» è una domanda sulle coppie. E perché una
coppia è definita senza ambiguità e senza modello — o l'ordine è cambiato, o non lo è.

**Perché dal congelamento alla bandiera**: è esattamente ciò che il referto finale del gioco
mostra al giocatore, ed è la risposta che il prodotto pubblica.

## 2 · I cancelli, dichiarati prima

**Q1 — il motore sa QUALI, ed è l'unico che decide.** L'associazione fra «il motore la
scambia» e «la realtà la scambia», misurata come **φ** (coefficiente di correlazione della
tabella 2×2), deve essere **positiva** con IC95 (bootstrap a **blocchi = gare**, 2.000
ripetizioni, seme 20260815) che **non contiene lo zero**.

> φ = 0 significa: il motore scambia coppie **scorrelate** da quelle che si scambiano
> davvero. Con la stessa quantità di movimento e le coppie sbagliate, tutti i numeri di
> «quanti» restano quelli che ho pubblicato.

**Q2 — il placebo, che è il vero metro.** Un motore **finto** che scambia lo **stesso numero
esatto** di coppie del motore vero, ma **scelte a caso** fra quelle disponibili (200
estrazioni, seme 20260815, dentro ogni gara). La φ vera deve stare **fuori dal 95° percentile**
delle finte.

> Questo separa le due cose che contano: azzeccare **quante** (il finto lo fa per
> costruzione) e azzeccare **quali** (solo il vero può).

**Q3 — riportato, non un cancello.** La tabella 2×2 grezza, per gara e in totale, e la quota
di coppie scambiate dal motore che la realtà scambia davvero (la «precisione») accanto alla
quota di coppie scambiate dalla realtà che il motore prende (il «richiamo»). Servono a dire
di che **tipo** è l'errore, non a decidere.

## 3 · Che cosa vorrà dire l'esito

- **Q1 verde e Q2 pulito** → il motore sa **anche** quali, non solo quante. Sarebbe una buona
  notizia mai verificata prima, e andrebbe scritta con la sua magnitudine: una φ di 0,2 e una
  di 0,7 sono due mondi diversi.
- **Q1 rosso, o Q2 sporco** → **il motore riproduce la quantità di movimento e non le
  coppie.** È il risultato più importante di tutta la settimana se esce così, perché
  significa che ogni misura di «quanti» — comprese le mie di ieri e l'altro ieri — descrive
  una proprietà che il prodotto non usa. E cambierebbe la lettura di tutto l'arco: non «il
  motore muove poco», ma «il motore muove le auto sbagliate».
- **Q1 verde ma φ minuscola** → si dichiara il numero e si dice che è piccolo, senza
  raccontarlo come una vittoria.

## 4 · Cosa NON si fa, qualunque sia l'esito

- **Non si riapre il duello.** È chiuso fuori campione su 78 gare e questa prereg non porta
  dati nuovi su quel fronte: misura una conseguenza della scelta, non la scelta.
- **Non si cambia niente nel motore**, né si propone una riparazione: un esito rosso è un
  referto, e la riparazione avrebbe la sua prereg e i suoi cancelli.
- **Non si cambia l'unità dopo aver visto i numeri**: è la coppia, dal congelamento alla
  bandiera, sul campo comune. Se φ uscisse rossa non si va a cercare una finestra più corta
  dove esce verde.
- **Non si esclude nessuna gara.** Le undici sono le undici.

---

*Sigillo: committata prima di calcolare una sola tabella 2×2. Nessun file di produzione
cambia.*
