# Prereg — la prova alias LORO, rifatta su una quantità che può divergere

**Data: 03/08/2026.** Scritta **prima** di eseguire la nuova prova. Nessun numero della
versione nuova esiste al momento della firma. Decisione del PO nella stessa sessione:
*«rifalla su una quantità che diverge»*.

---

## 1 · Perché la prova vecchia è morta

`ROSSE_DICHIARATE.json` porta dal 02/08 due voci di `s25` con natura **difetto noto**:

> «sulla banda complessiva dentro e fuori campione DIVERGONO (0.8593 contro 0.8593): il
> leave-one-race-out non è un alias» — *È l'UNICA prova che il leave-one-race-out non sia un
> alias del dentro campione, e oggi è MORTA: i due numeri coincidono.*

La causa è nota e **benigna**: il leave-one-race-out dà la **stessa larghezza di banda su
ogni blocco**, e quando la banda è identica le due coperture si calcolano con lo stesso
intervallo sugli stessi casi — quindi vengono uguali per costruzione, non per caso.

Ma l'effetto non è benigno: **a venti giorni dal primo fuori campione vero, niente nella
suite prova più che la macchina del fuori campione faccia qualcosa di diverso da quella
dentro.** Se qualcuno un giorno scrivesse per errore `copertura_fuori = copertura_dentro`,
nessuna sentinella se ne accorgerebbe.

## 2 · La forma nuova, che il KPI aveva già scritto

`KPI_5_4_4.md` §I4 chiede *«la prova alias LORO viva (**una perturbazione la muove**)»*.
È la forma giusta, e va presa alla lettera: non si deve chiedere ai due numeri di
divergere **oggi** — su dati robusti coincidere è corretto — si deve chiedere che la
macchina **sappia** separarli quando i dati lo impongono.

> **La prova nuova è un esperimento, non un'osservazione: si perturba una gara e si
> pretende che il fuori campione se ne accorga più del dentro campione.**

Il meccanismo è quello che rende la prova non aggirabile: la banda leave-one-race-out di
una gara si calibra **sulle altre**, quindi è **cieca** a ciò che succede dentro quella
gara. La banda dentro campione, invece, vede tutto. Perturbando una gara sola, i due numeri
*devono* separarsi — e se non si separano, il fuori campione non sta guardando fuori.

## 3 · L'esperimento, senza scelte residue

**La gara perturbata**: quella con **più casi**, a parità di conteggio la prima in ordine
alfabetico. Scelta deterministica, fissata qui, non dopo aver visto quale dia il risultato
migliore.

**La perturbazione**: a tutti i casi di quella gara si somma **+4 posizioni** all'errore.
Quattro e non due perché la banda vera è di 2-3 posizioni: una perturbazione più piccola
della banda potrebbe restare coperta, e la prova misurerebbe la fortuna invece della
macchina. Quattro la porta fuori con margine, da un lato solo.

**Il confronto**: si ricalcola `calibraBanda` sul campione perturbato e si leggono
`copertura_dentro_campione` e `copertura_fuori_campione`, esattamente le due grandezze che
la prova vecchia confrontava. Nient'altro cambia: stessa funzione, stessi parametri
(`q`, `minGare`, `minCasi` dai cancelli).

## 4 · I cancelli, con le soglie scritte adesso

| | cancello | soglia |
|---|---|---|
| **L1** | dopo la perturbazione i due numeri **si separano** | `|dentro − fuori|` ≥ **0,05** |
| **L2** | ed è il **fuori campione** il più severo | `fuori < dentro` |
| **L3** | *controllo di potenza*: senza perturbazione la prova non è banale | i due numeri sui dati veri si riportano, e **coincidere non è un fallimento** |

**Perché 0,05.** La gara perturbata vale circa un undicesimo dei casi. Se il suo contributo
al fuori campione crolla — la banda cieca non la copre più — l'aggregato scende di circa
otto punti, mentre il dentro campione scende di meno perché la banda piena *vede* lo
spostamento e può allargarsi. Cinque punti sono una barra **conservativa** rispetto agli
otto attesi, e stanno molto sopra lo zero che un alias produrrebbe.

**L2 non è ridondante rispetto a L1**: L1 ammetterebbe anche una separazione nel verso
sbagliato, che significherebbe che la banda cieca copre *meglio* — cioè che il
leave-one-race-out non sta facendo quello che dice.

**L3 è dichiarato come non-cancello di proposito.** Pretendere che i due numeri divergano
anche sui dati veri sarebbe ripetere l'errore della prova vecchia: chiedere alla realtà di
essere meno robusta di quanto è.

## 5 · Cosa questa prova dimostra, e cosa no

**Dimostra**: che il codice del fuori campione non è un alias di quello dentro — che la
calibrazione leave-one-race-out esclude davvero la gara che valuta.

**NON dimostra**: che il numero fuori campione di oggi sia informativo. Su dati robusti i
due coincidono, e questa prova non lo cambia: dice che coincidono *perché i dati sono
robusti*, non *perché la macchina è finta*. La differenza è tutta lì, ed è quella che a
Zandvoort conterà.

## 6 · Cosa si fa delle due voci a registro

Se L1 e L2 passano, le **due** voci `s25` con natura «difetto noto» escono da
`ROSSE_DICHIARATE.json` — la seconda («e il fuori campione è il più severo dei due») è per
sua stessa ammissione una conseguenza diretta della prima, e la nuova L2 la sostituisce
nella forma che sa fallire.

Se falliscono, restano dove sono e si scrive che la macchina del fuori campione **è** un
alias — che sarebbe un guasto grosso, venti giorni prima del primo fuori campione vero, e
la ragione per cui questa prova va rifatta adesso e non dopo.
