# ESITO — la perdita relativa: il metro è SANO, il pesato NON PASSA, il prior è confermato

**Data: 07/08/2026, notte fonda.** Esegue `PREREG_perdita_relativa.md` (sanità
vincolante PRIMA del confronto — la lezione di V3, cablata). Dati:
`ESITO_perdita_relativa.json`. Metro: `misura_perdita_relativa.mjs`.

## V4b — il metro è sano (tutta verde)

- Riferimenti verdi per gara: **20,9–34,9 s** — l'ordine del pit-loss, come deve;
- ratio mediano in finestra **0,896** ∈ (0, 1,2] — sotto regime si paga meno o
  uguale, mai sistematicamente più: il difetto di V3 è sparito col riferimento
  giusto;
- pieni (0,634) < bassi (0,815) ✓.

**Il metro relativo funziona, ed è riusabile**: perdita = Δcum del fermato meno la
mediana dei non-fermati sullo stesso intervallo. La lentezza del giro si annulla
per costruzione.

## Il regalo: il prior confermato internamente

Sui **5 casi a copertura piena** (f ≥ 0,9) il fattore misurato è **0,634** — dentro
la banda del prior esterno **[0,60–0,70]** che il motore usa da sempre. È la prima
conferma INTERNA di quel numero, su un n dichiaratamente piccolo: non promuove
niente, ma da oggi il prior non è più solo esterno.

## V4a — il pesato NON PASSA

Mediana |err|: pesato **0,302** contro binario **0,279**; appaiato 45-33 (vince nei
conteggi, perde in mediana: il cancello chiedeva ENTRAMBI). La causa si vede nei
bin: **alti (copertura 50–90%) = 1,144** — più caro del verde — contro bassi 0,815
e pieni 0,634. La forma lineare nella frazione non descrive il mezzo: a copertura
parziale contano cose che f da sola non porta (quando cade la finestra dentro la
sosta, cosa fanno i rivali nello stesso momento — sotto VSC si pitta in massa).

## Verdetto e confini

- **Il prezzo delle soste resta BINARIO col prior** (0,65, banda [0,60–0,70]).
- La famiglia si ferma qui, come da prereg: niente terza forma sulla stessa fonte
  senza un'idea nuova SUL METRO — e l'idea nuova, se verrà, dovrà spiegare il
  bin di mezzo, non aggiustare la retta.
- Restano acquisiti: il metro relativo (sano, riusabile), la conferma interna del
  prior sui pieni, e il fatto di potenza (i muretti si tuffano appena la VSC esce:
  6 pieni su 88 — qualunque modello futuro vive di coperture parziali).
