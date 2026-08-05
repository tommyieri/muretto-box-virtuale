# ESITO — i settori contro il muro: NULL, e la risposta è definitiva con questa fonte

**Data: 04/08/2026.** Esegue `PREREG_settori.md`, sigillata prima dei numeri (`a3aea2b`).
Dati: `ESITO_settori.json`. Nessuna soglia toccata — una **riespressa**, e il perché è al §4.

---

## Il verdetto

| | cancello | esito |
|---|---|---|
| **M1** | un settore accorcia l'età di pareggio ad almeno il 68,5 % di quella del giro | **NON PASSA** — il migliore la accorcia del **9 %** |
| **M2** | placebo, 200 rimescolamenti delle mescole entro (gara, pilota) | **PASSA** — 0/200 · p = 0,005 |
| **M3** | il settore migliore è lo stesso sul fondo 2022-2025 | **PASSA** — settore 3 in entrambi |

> **NULL.** Alla risoluzione che abbiamo, il muro del rumore non cade. E la risposta al PO è
> **definitiva con questa fonte**: non è il modello, non è il settore — servirebbero tempi
> per **mini-settore**, che nel nostro grezzo **non esistono**.

## 1 · La misura, in una tabella

10.170 giri verdi delle 11 gare 2026, con tutti e tre i settori presenti. Stesso stimatore
del giro intero — effetti fissi `gara|pilota` e `gara|giro`, ρ per mescola sul residuo.

| | divario fra mescole (s/giro d'età) | rumore (s) | età di pareggio |
|---|---|---|---|
| **giro intero** | 0,01480 | 0,6963 | **47,0 giri** |
| settore 1 | 0,00327 | 0,3083 | 94,2 |
| settore 2 | 0,00426 | 0,3508 | 82,4 |
| **settore 3** | **0,00727** | 0,3116 | **42,8** |

Il meccanismo si legge riga per riga, ed è il contrario di quello che si sperava:

> **Il rumore per settore si dimezza (0,70 → circa 0,31), ma l'effetto cala di più.** Il
> rapporto segnale-rumore **peggiora** su due settori su tre.

## 2 · La cosa vera che si è imparata: metà dell'effetto sta nel settore 3

Il settore 3 porta **0,00727 dei 0,01480** del giro intero — cioè **il 49 % dell'effetto
mescola in un terzo di pista**. E non è rumore: il placebo lo conferma in modo netto
(**0 rimescolamenti su 200** raggiungono il divario vero, p = 0,005), e il fondo 2022-2025
sceglie **lo stesso settore** su 73.804 giri.

Quindi il degrado per mescola **è localizzato**, e sappiamo dove. Ma il settore 3 è ancora
un terzo di pista: dentro ci sono anche i tratti dove la gomma non fa differenza, e il loro
rumore viene incassato per intero. **È esattamente lì che servirebbe il mini-settore**: se
l'effetto vive in due curve, misurarle da sole taglierebbe il rumore senza tagliare il
segnale.

Con la risoluzione che abbiamo, il settore 3 migliora l'età di pareggio del **9 %**
(47,0 → 42,8). Serviva il 31,5 %.

## 3 · I microsettori non esistono, e questa è la risposta operativa

La direttiva diceva «i microsettori — che il progetto ha già toccato per la redazione
tecnica». **Verificato sul grezzo**: le colonne `ms1`, `ms2`, `ms3` non sono tempi. Sono
stringhe di codici di stato per mini-settore (`'7511111'`, `'11110111'`, `'111001'`), della
famiglia dei `SegmentsSector` di FastF1 — colori di segmento, non cronometri.

**Cosa servirebbe davvero**, scritto per chi riaprirà la domanda: i tempi per mini-settore
esistono nel timing ufficiale, ma non nella fonte che questo progetto ha pinnato. Finché non
entrano nel fondo con un manifest, questa domanda **non si riapre**: sarebbe il quarto
tentativo sulla stessa fonte, e la regola di casa lo vieta.

## 4 · La soglia riespressa, e il numero pubblicato che non si riproduce

`ESITO_degrado_dal_campo.md` pubblica divario **0,01578** e rumore **0,3457**, e da quel
rapporto i famosi **21,9 giri**. Rilanciando lo stimatore con lo stesso pooling:

- **il divario si riproduce**: 0,01480 — la differenza si spiega col perimetro (qui si
  tengono solo i giri con tutti e tre i settori);
- **il rumore no**. Provate cinque definizioni, nessuna arriva a 0,3457: sd del residuo dopo
  pilota, giro e i termini d'età = **0,736**; dopo pilota e giro soltanto = **0,778**;
  robusta su IQR = **0,473**; MAD scalata = **0,471**; mediana fra gare delle sd per gara =
  **0,658**.

**Il rumore pubblicato non è ricostruibile dal codice committato.** È la stessa famiglia
della fonte orfana trovata stamattina — un numero senza generatore — e va a referto invece
che aggirato.

Conseguenza dichiarata sul cancello. M1 era scritto come **soglia assoluta** (15 giri, su
una scala in cui il giro vale 21,9). Su una scala diversa quella soglia non significa più la
stessa cosa, quindi è stata riespressa nell'unica forma **invariante alla definizione del
rumore**, che era l'intento della prereg:

```
M1:  età_pareggio(settore) ≤ (15 / 21,9) × età_pareggio(giro intero)
```

Numeratore e denominatore usano **la stessa** definizione, quindi il cancello è lo stesso
esperimento — non uno più facile. Con la soglia assoluta originale (15 giri) M1 sarebbe
fallito **molto** più nettamente: il settore migliore dà 42,8.

## 5 · Cosa resta aperto

1. **Il rumore di `ESITO_degrado_dal_campo.md` va rimisurato** e il suo generatore
   committato, o il numero va tolto: oggi è affermato e non riproducibile.
2. La strada dei **mini-settori** resta l'unica che possa muovere il degrado, e non è
   percorribile finché quei tempi non entrano nel fondo pinnato.
3. Il fatto che il settore 3 porti metà dell'effetto è **un risultato nuovo e solido**
   (placebo 0/200, confermato su 73.804 giri del fondo): se un giorno servisse un indicatore
   di degrado a bassa latenza in diretta, si guarda lì, non al giro intero.
