# PREREG — la finestra che va in pagina

*Scritta il 01/08/2026 PRIMA di implementarla. Esecuzione della decisione del PO
(«finestra sempre») dopo la misura di `PREREG_finestra.md`.*

## La strada ovvia è vietata, e va detto perché

La misura ha mostrato che il giro raccomandato si muove per `L±1` (513 curve su 1.153) e
quasi mai per l'incertezza del modello (**1 su 1.153**). La conclusione ovvia sarebbe:
costruire la finestra dai congelamenti adiacenti, che il generatore calcola comunque —
costo zero.

**È vietata.** Al congelamento `L`, in diretta, il giro `L+1` **non esiste**. Usarlo
metterebbe informazione dal futuro in un record pubblicato (E14) e renderebbe il replay
capace di una cosa che la diretta non può fare (E17). Un intervallo di incertezza non è
un'eccezione alla regola 5: è un numero come gli altri.

## Cosa si pubblica invece

La curva del «quando» è **già nel record**: per ogni giro candidato porta `delta_s`, quanto
si perde rispetto all'ottimo. La finestra sono **tutti i giri che il motore non sa
distinguere dall'ottimo**:

```
finestra = { giri con delta_s ≤ soglia(orizzonte) }
soglia(orizzonte) = 0,17 s/giro × (giro finale − congelamento)
```

**Da dove viene 0,17.** È il bias massimo che il modello dichiara di sé — la soglia del
cancello del banco, già in `cancelli_banco.json`, e il limite entro cui `δ₇₀` è stato
validato. Non è un numero scelto per l'occasione: è **l'errore che il motore ammette di
avere**, moltiplicato per quanto lontano sta proiettando.

Costo: **zero**. La curva c'è già, non si ricalcola niente.

## Cosa cambia in pagina

Il record porta `finestra: { da, a, soglia_s, n_giri }` accanto a `minimo`. Il giro
dell'ottimo resta — è l'ipotesi centrale — ma smette di essere **la** risposta.

**Quando la finestra è di un giro solo, si legge come un giro solo.** La misura dice che
succede spesso; non è un'eccezione al «finestra sempre», è il caso in cui la finestra è
stretta.

## Cosa fa dichiarare NULL

- la finestra risulta **larga quanto tutta la curva** in oltre metà dei casi: vorrebbe dire
  che su quell'orizzonte il motore non sa dire niente, e la risposta giusta non è una
  finestra enorme ma **smettere di pubblicare quel numero**;
- l'ottimo cade **fuori** dalla propria finestra: sarebbe un errore di codice;
- il peso delle viste cresce di oltre il 10%: quattro numeri per record non devono costare
  un download.

## Cosa NON dice

- **Non è un intervallo di confidenza.** È l'insieme dei giri che il motore non distingue
  dato l'errore che *dichiara di avere*. L'errore vero è più grande: il rumore di gara
  (±11,7 s misurati), il traffico e la reazione dei rivali non sono in nessuna di queste
  quantità.
- Una finestra stretta **non** vuol dire che il giro è giusto: vuol dire che il modello è
  sicuro. Un modello sicuro e sbagliato darebbe lo stesso numero.

---

## ESITO — 01/08/2026: la finestra si pubblica, ed è larga

Misurato su 647 curve del Belgio (una gara, tutti i piloti, tutti i congelamenti).

**Le tre condizioni di NULL sono tutte libere:**

| | misurato | limite |
|---|---|---|
| finestra = **tutta** la curva | **0,8%** dei casi | oltre il 50% |
| ottimo **fuori** dalla sua finestra | **0** | zero |
| crescita del peso delle viste | **+6,7%** | 10% |

**Ma il numero da guardare è un altro: la finestra copre il 68,8% della curva** (mediana;
p90 83,3%). In un caso su undici (9,1%) è di un giro solo.

### Cosa vuol dire, detto chiaro

Su un orizzonte tipico di trentacinque giri, l'errore che il motore **dichiara di avere** —
0,17 s/giro, la soglia del suo stesso cancello — vale quasi **sei secondi cumulati**. E
dentro sei secondi, sulla curva del «quando», ci stanno due terzi dei giri candidati.

Quindi: **il motore sa dire che fermarsi troppo presto o troppo tardi costa, ma nella parte
centrale non distingue.** Pubblicare «fermati al giro 22» come un numero secco diceva molto
più di quanto il modello sappia. Ora dice «intorno al 22, e onestamente fra il 10 e il 35 è
lo stesso», che è meno soddisfacente e più vero.

Era esattamente il sospetto della voce 5 del piano — «il pavimento di rumore della curva del
quando» — e la misura lo conferma con un numero invece che con un'impressione.

### Cosa NON è cambiato, e va detto

L'**ottimo resta pubblicato** ed è ancora l'ipotesi centrale: non è stato declassato, è stato
circondato dalla sua incertezza. E quella incertezza è **quella dichiarata dal modello**, che
è più piccola di quella vera: il rumore di gara (±11,7 s misurati), il traffico e la reazione
dei rivali restano fuori da questi sei secondi.

Una finestra stretta non vuol dire che il giro è giusto. Vuol dire che il modello è sicuro.
