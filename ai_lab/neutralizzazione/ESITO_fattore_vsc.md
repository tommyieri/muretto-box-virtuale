# ESITO — il fattore pesato: PASSA ALLA LETTERA, e la metrica è mal specificata (E08)

**Data: 07/08/2026, notte.** Esegue `PREREG_fattore_vsc_frazione.md`. Dati:
`ESITO_fattore_vsc.json`. **Il peso NON si accende.**

## L'esito letterale

V3 passa su entrambe le condizioni: mediana |err| pesato 1,150 < binario 1,269,
appaiato 73-11. **E non significa quello che sembra.**

## La metrica mal specificata, a referto (la stessa famiglia di SC0)

I ratio osservati stanno fra **1,5 e 2,6** — una sosta sotto VSC risulterebbe costare
il DOPPIO di una verde — e la sanità dichiarata è **invertita**: il ratio CRESCE con la
copertura (bassi 1,47 · alti 2,23 · pieni 2,63), il contrario esatto della famiglia del
modello (che scende da 1 verso 0,65).

Il difetto è del riferimento, e si vede a occhio una volta scritto: la perdita
realizzata è misurata **contro il passo verde** («in + out − 2·mediana verde»), ma
sotto VSC i giri sono lenti PER TUTTI (R_lap 1,32 sui pieni, appena validato da V2).
Il mio estimatore somma quindi al costo della sosta la lentezza del giro — che i
rivali in pista pagano uguale e che il kernel modella già con la compressione. Il
fattore 0,65 è una perdita **RELATIVA al campo rallentato**: misurarla contro il verde
è confrontare due grandezze diverse. Entrambi i modelli sbagliano di più di 1,0 interi;
«il pesato vince» solo perché, prezzando meno sconto sui parziali, sta più vicino a
numeri che nessuno dei due sta descrivendo.

Per E08 la metrica si mette a referto e non si riscrive dopo aver visto l'esito:
**V3 resta PASSA alla lettera, con questa riga attaccata, e non conferisce niente.**

## Cosa resta in piedi, e la strada giusta

- Il prezzo delle soste resta **binario col prior** (0,65, banda [0,60–0,70]),
  in laboratorio come sempre. Nessun consumo nuovo.
- Se si riapre, la prereg nuova deve misurare la perdita **relativa**: il confronto
  giusto è contro il campo NON fermato sugli stessi giri (delta di cumulato con chi
  non pitta, o riferimento = passo mediano del campo in quel giro) — cioè esattamente
  la grandezza che il prior esterno dichiarava di essere. Con la fonte a tempo già
  validata, l'ingrediente nuovo c'è; il metro va riscritto da zero, prima dei numeri.
- Il censimento di potenza resta un fatto utile: 6 soste piene su 88 in finestra —
  i muretti si tuffano appena la VSC esce, e qualunque metro futuro dovrà vivere
  soprattutto di coperture parziali.
