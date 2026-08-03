# PREREG — il nullo che conosce la sosta

**Scritta e sigillata il 03/08/2026**, prima di produrre un solo numero.

Riferimenti: `ESITO_curva_orizzonte.md` (perché serve) · KPI **F1** firmato il 03/08 ·
banco unico `banco_regole.mjs` (tarato 8/8).

---

## 1 · Il difetto che questa prereg esiste per riparare

La curva dell'orizzonte ha misurato il motore contro il nullo «l'ordine al congelamento non
cambia», su una griglia da 2 a 10 giri. Ha trovato un vantaggio grande che decade in modo
ordinato e perde significatività fra 6 e 8 giri.

**Ma il confronto è viziato, e verificato**: in **tutti e 274 i casi** la sosta del soggetto
cade dentro la finestra. Il nullo non sa che il pilota è entrato ai box e ha perso una
ventina di secondi; il motore lo sa, perché la sosta è nel piano che riceve. Quindi una
parte grande di quel vantaggio non misura la fisica — misura **il sapere che una sosta è
avvenuta**.

## 2 · Cosa cambia, e la dichiarazione che va fatta ADESSO

Il nullo nuovo è: **l'ordine al congelamento, con la perdita ai box applicata al soggetto**.
Sa che il pilota si è fermato e quanto gli è costato; **non sa nient'altro** — niente
degrado, niente carburante, niente evoluzione dei rivali, niente neutralizzazione.

> **Questo NON è una ri-misura di F1, ed è la riga più importante di questa pagina.**
> Il KPI firmato dice «batte il **non-fare-niente**», e il nullo letterale del
> non-fare-niente è quello vecchio. Cambiare il nullo cambia la domanda.

E la cambia in **una domanda più difficile**, non più facile: si toglie al motore un
vantaggio che aveva e non si toglie niente al nullo. Va detto proprio perché è più severa:
rendere una barra più alta dopo aver visto i numeri è comunque cambiare la barra, e lo si
fa alla luce del sole o non lo si fa.

**Cosa questa prereg NON fa**: non riscrive F1, non lo dichiara mancato, non lo dichiara
raggiunto. Produce la misura che permetterebbe di giudicarlo **in modo che voglia dire
qualcosa**. Se il PO deciderà che questo è lo strumento di F1, servirà **una pagina nuova e
datata** che lo dica — mai una modifica a quella firmata il 03/08 (regola 3, E08).

## 3 · La perdita ai box: la STESSA che usa il motore

Il nullo riceve **la perdita che il costruttore ha usato in quello scenario**
(`scenario.perdita`), non un valore ricalcolato altrove.

Non è pignoleria: se il nullo usasse un pit-loss diverso, la differenza fra i due
misurerebbe *anche* lo scarto fra due pit-loss, e nessuno saprebbe quanta parte del
risultato viene da lì. Con lo stesso numero, **tutto ciò che resta della differenza è ciò
che il motore modella in più**.

## 4 · Griglia, verità, popolazione — invariate

Identiche alla curva precedente, così i due risultati sono confrontabili riga per riga:

- **griglia**: 2, 3, 4, 5, 6, 8, 10 giri;
- **verità**: rango per `cum_time` al giro `Lf + h` nel byLap pinnato, ri-classificato
  sulla terna comune motore ∩ nullo ∩ verità;
- **popolazione**: i casi del banco, con il perimetro dichiarato a ogni `h`;
- **test**: dei segni bilaterale sui discordanti;
- **controllo**: a `h = 2` il banco deve riprodurre il **36-12 su 235** già tarato. Se non
  lo riproduce, non si legge niente e ci si ferma.

## 5 · Nessun criterio di contaminazione — e perché

La curva precedente ne aveva uno (mediana di soste-rivali nella finestra ≥ 1) e **si è
rivelato degenere**: con venti auto in pista marcava tutti i punti, compreso quello di
controllo dove il motore funziona in modo dimostrato.

**Qui non ne metto un altro.** Inventare una seconda soglia dopo aver visto che la prima
non separava sarebbe tararla sui dati. Il conteggio delle soste-rivali si riporta come
**covariata descrittiva** accanto a ogni punto, e il limite resta scritto in parole: oltre
~4 giri la differenza misura anche la non-conoscenza della strategia altrui, e chi legge
la curva lo deve sapere. Una covariata dichiarata vale più di una soglia che non separa.

## 6 · Cosa si scrive, nei tre casi

- **Il motore batte il nullo informato a ≥ 6 giri (p < 0,05)**: la sua fisica aggiunge
  qualcosa oltre l'aritmetica della sosta, fino a lì. È il caso in cui F1, se il PO adotta
  questo strumento, ha un bersaglio raggiunto in modo che significa qualcosa.
- **Lo batte solo ai primi orizzonti (2-4 giri)**: la frontiera vera è più corta di quella
  apparente, e il prodotto deve dirlo prima del 23 agosto.
- **Non lo batte a nessun orizzonte**: il vantaggio misurato dalla curva precedente era
  **tutto** «so della sosta», e la fisica del motore non aggiunge niente di misurabile
  oltre quell'aritmetica. È il risultato più duro possibile, ed è quello che va scritto per
  primo se esce, senza attenuanti.

In tutti e tre i casi: **tutti i punti pubblicati**, il confronto affiancato al vecchio
nullo riga per riga, e nessuna soglia toccata.

## 7 · Cosa questa prereg NON autorizza

- Non autorizza a modificare F1 né alcun KPI firmato.
- Non autorizza a scegliere l'orizzonte che dà il risultato migliore.
- Non autorizza a cambiare il nullo una terza volta se questo dà un risultato sgradito:
  se serve un nullo ancora diverso, è **una domanda nuova con la sua pagina**.
- È di **sola lettura**: nessun file sigillato, nessun modello, nessuna accensione.
