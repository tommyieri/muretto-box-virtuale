# PREREG — la ripartenza dopo la Safety Car (scritta prima di misurare)

*07/08/2026, notte. Contesto: il record con le neutralizzazioni vere lascia un residuo
nitido — Belgio +3 (= nullo) con 5 cambi simulati contro 9 reali: la compressione
congela l'ordine relativo, ma quello che rimescolò Spa non è la compressione. Ipotesi:
è la RIPARTENZA — il campo riparte impacchettato e chi ha gomme più fresche (chi pittò
sotto SC) passa chi non le ha, a vantaggi di passo che in regime di corsa non basterebbero
a superare la soglia misurata (0,61 s/giro).*

## Il meccanismo proposto

Nel kernel il tetto al movimento blocca il sorpasso sotto la soglia di passo misurata.
La soglia fu misurata su 5.498 occasioni **di corsa in regime**: la ripartenza è un
regime diverso (gap azzerati dalla compressione, gomme ad età molto diverse, frenata
in gruppo). Proposta: **sul solo giro di ripartenza** (il primo giro verde dopo una
finestra di campo) la soglia della coppia si abbassa di un Δ misurato. Ingresso di
LABORATORIO: viaggia solo con `neutralizzazioneVera` (in diretta le finestre future
non si conoscono, E14); in produzione non esiste.

## La misura (definita qui, prima di guardare)

Perimetro: le 11 gare 2026 dell'archivio (`garaNuova`), finestre da
`regimePerGiroDiCampo` (definizione unica). **Giro di ripartenza** = primo giro non in
finestra dopo un giro in finestra. **Occasione** = coppia adiacente nell'ordine di
inizio giro con gap ≤ 1,5 s, nessuno dei due in in-lap/out-lap su quel giro, entrambi
presenti a inizio e fine giro. **Sorpasso** = ordine invertito a fine giro.

Si misura: P(sorpasso | occasione) sui giri di ripartenza contro i giri verdi
ordinari (stessa definizione di occasione). Contorno descrittivo (non decide): l'età
gomma relativa di chi passa, nei due gruppi.

## La conversione, dichiarata

Un solo parametro nuovo: il rapporto di odds `OR = odds(ripartenza)/odds(verde)`.
La soglia si abbassa di **Δ = ln(OR) / pendenza**, con la pendenza GIÀ SIGILLATA della
legge di sorpasso (1,9826 per s/giro — ogni s/giro ×7,3 le odds). È un'assunzione di
forma (stessa logistica, intercetta spostata) e si dichiara come tale. Nessun parametro
è tarato sui casi del record.

## I cancelli (decidono, scritti prima)

- **R1 — non peggiorare nel complesso**: sul record dei 10 casi, la somma |errore|
  riclassificato non peggiora (≤ 8).
- **R2 — il movimento resta calibrato**: la somma su 10 casi di |cambi motore − cambi
  reali| non peggiora rispetto a senza-ripartenza.
- **R3 — placebo**: la stessa Δ applicata a FINTI giri di ripartenza (giri verdi
  ordinari scelti a caso, stesso numero per gara, seme 20260807) non deve produrre un
  miglioramento pari o superiore su R1+R2: se «più movimento ovunque» funziona quanto
  «movimento alla ripartenza», il meccanismo non è la ripartenza.
- **R0 — esistenza**: prima di tutto, OR > 1 con IC95 che non contiene 1 (bootstrap a
  blocchi per gara, 2.000 ripetizioni, seme 20260807). Se R0 fallisce, il capitolo si
  chiude NULL e il kernel non si tocca.

Esiti possibili dichiarati: R0 NULL → niente; R0 passa ma R1/R2/R3 no → a referto,
spento; tutti passano → ingresso di laboratorio acceso nel record e nella pagina.
