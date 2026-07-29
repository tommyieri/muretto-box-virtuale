# REPORT — FASE C: shadow-run degli scenari nel live (fattibilità + protocollo)

*Sessione 2026-07-20, branch claude/fase-c-shadow. Protocollo:
`PREREG_SESSIONE_FASEC.md` (committata prima dei numeri, commit af85cee).*

## In una riga

**Il blocco di Fase C NON è l'MQTT rotto.** Gli input degli scenari (compound +
età-gomma live) arrivano dal feed **SignalR ufficiale** che già registriamo —
dimostrato: decodificati dalla registrazione British, **21/21 piloti** combaciano con
l'archivio. Il lavoro residuo è decodificare gli stint dentro il collettore (produzione,
PO) e poi lo shadow-run durante l'Ungheria. Protocollo shadow pre-registrato.

## La correzione del piano (emersa in ricognizione)

Il PIANO indicava come dipendenza "MQTT OpenF1 rotto dal 19/07". La ricognizione la
smentisce come blocco per il degrado:

- il feed **SignalR** (topic `TimingAppData`) porta `Stints[].Compound` e `TotalLaps`
  (vita-gomma) per pilota, e il collettore lo **registra già** (è nella lista topic:
  collector.py). NON dipende dall'OpenF1 MQTT.
- l'ingress OpenF1 (il ramo MQTT rotto) non sottoscrive nemmeno gli stint (topic:
  location/intervals/laps/position/pit/… — nessun `stints`). Quindi l'MQTT non sarebbe
  comunque stato la fonte del degrado.
- il vero gap: il collettore **non decodifica** `TimingAppData.Stints` in
  `(compound, tyre_age)` per il client (la torre live ha pos/gap/settori, non la gomma).

## La prova di fattibilità (read-only, NON produzione)

`live/prototipo_stint_signalr.py` legge una registrazione grezza già presente
(`data/live_raw/`, British 2026-07-05 rigiocato il 07-16), decodifica gli stint per
pilota e incrocia la sequenza di compound con l'archivio (`demo/data/Gran Bretagna.json`).

**Esito: 21/21 piloti verificabili OK** (1 senza riferimento in archivio). Esempi:
VER MEDIUM(17)→HARD(21)→MEDIUM(8), HAM MEDIUM→HARD→SOFT, tutti combacianti. Le
età-gomma (TotalLaps per stint) sono coerenti con le lunghezze di stint reali.

**Conclusione: compound + età-gomma live sono estraibili dal feed che già abbiamo.** Il
prototipo gestisce sia lo snapshot (Stints come lista) sia i diff incrementali (dict
idx→parziale) — la stessa logica che servirà live, dove lo stint corrente cresce giro
per giro (l'ultimo stint decodificato dà la vita-gomma corrente).

Caveat onesto: la registrazione è un REPLAY di gara completa; l'invariante da mantenere
live è che il decoder aggiorni per-stint incrementalmente (già così nel prototipo).

## Cosa resta (dichiarato, non fatto qui)

1. **Abilitante (produzione, PO)**: portare la decodifica stint dentro il collettore e
   far arrivare `(compound, tyre_age)` al client live — è una modifica al collettore di
   produzione (deploy.sh, decisione/riavvio del PO). Questa sessione ne prova solo la
   fattibilità, senza toccarlo.
2. **Shadow-run (Ungheria, live)**: col dato che fluisce, calcolare i tre scenari in
   diretta, **registrarli senza mostrarli**, e a gara finita misurare copertura +
   plausibilità + banda-zero bit-identica (KPI congelato in prereg §3: GO se copertura
   live ≥ 40% E banda-zero bit-identica E zero scenari sotto SC/VSC). **NON TESTABILE**
   finché non c'è la sessione live: HUN non è ancora corsa.
3. La pubblicazione live degli scenari resta **decisione del PO**, dopo lo shadow.

## Golden (prima e dopo)

test_b.py 449/449 · test_b.mjs 449/449 · demo/test_pit.mjs 11/11 · test_degrado_hook
banda-zero bit-identica · verifica_k4_clim PASS. Questa sessione aggiunge solo file
nuovi (prereg, prototipo read-only, report): kernel, gancio, modulo pit, collettore di
produzione, demo: non toccati.
