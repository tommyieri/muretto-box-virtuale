# Referto — le 62 coppie mancate: **non sono il duello**, ma non sono nemmeno un difetto mirato

**Data: 15/08/2026.** Banco: `ai_lab/confronto/coppie_mancate.mjs`. Risponde alla domanda che
`ESITO_quali_coppie.md` aveva lasciato, e la risponde **contando**. Descrittivo: nessun
cancello, nessun modello, nessun file di produzione toccato.

---

## La domanda

Delle 82 coppie che la realtà scambia fra congelamento e bandiera, il motore ne prende 20 e ne
manca **62**. Erano il **duello** — i sorpassi in pista, il ramo che il progetto ha chiuso
fuori campione su 78 gare — oppure no?

Se lo fossero, l'arco si chiude: il motore è conservativo perché ha *deciso* di non simulare i
sorpassi, e lo è nella misura giusta.

Per ogni coppia si è preso l'**ultimo** giro in cui il loro ordine relativo cambia nella
realtà — lo scambio che *resta* fino alla bandiera — e lo si è messo nei secchi di
`movimento_verde.mjs`, con la stessa identica definizione.

## La risposta: no

| secchio | **mancate** | prese |
|---|---|---|
| il **suo** ciclo di sosta | **37 (59,7%)** | 8 (40%) |
| ciclo altrui | 10 (16,1%) | 5 (25%) |
| **pista pura** — il duello | **12 (19,4%)** | 6 (30%) |
| neutralizzato | 3 (4,8%) | 1 (5%) |

**Solo 12 delle 62 coppie mancate sono sorpassi in pista.** Quasi il 60% cade nel **ciclo di
sosta** — undercut e overcut, esattamente ciò per cui il gioco esiste.

**L'arco non si chiude sul duello.** «Abbiamo deciso di non simulare i sorpassi» non spiega la
conservatività del motore: spiega un quinto di quello che manca.

## Ma il titolo che stavo per scrivere non regge, e lo dico

La tentazione era: *«il motore è peggio proprio dove il prodotto vive»*. I tassi di presa per
secchio la sostengono a occhio:

| | prese / totali | |
|---|---|---|
| suo ciclo di sosta | 8 / 45 | **17,8%** |
| ciclo altrui | 5 / 15 | 33,3% |
| pista pura | 6 / 18 | 33,3% |
| neutralizzato | 1 / 4 | 25,0% |

**E non regge a nessuno dei due controlli.** Fisher esatto fra «suo ciclo» e «pista pura»:
**p = 0,197**. A blocchi = gare (E11): **1 gara su 6** valutabili va in quella direzione.

Quindi la composizione delle mancate — 60% ciclo di sosta — **riflette soprattutto dove
avvengono gli scambi veri**: 45 delle 82 coppie scambiate stanno nel ciclo di sosta, 18 in
pista. Il motore ne manca di più lì perché lì ce ne sono di più.

## Che cosa resta, detto per bene

**Il motore prende circa una coppia su quattro (20 su 82), e la prende dappertutto nella
stessa proporzione.** Non è un difetto mirato su un meccanismo: è una **conservatività
uniforme**.

È una notizia scomoda perché toglie il bersaglio: non c'è una leva — non il duello, non il
prezzo della sosta, non il tetto, non la compressione — su cui agire per recuperare il grosso.
E si sposa con tutto il resto della settimana: cinque meccanismi cercati e caduti, un tetto
che muove di più senza azzeccare di più, e un motore che quando parla ha ragione più di una
volta su due (precisione 0,556) ma parla la metà delle volte che dovrebbe.

**Concentrazione:** Belgio 18, Giappone 12, Monaco 11 — 41 delle 62 mancate stanno in tre
gare. Il campione è quello dichiarato in `ESITO_quali_coppie.md` (piloti sul giro del
battistrada, 9,6 per gara), e vale qui la stessa avvertenza.

## Quello che questo referto NON autorizza

Non autorizza a dire che il ciclo di sosta è rotto: il tasso di presa lì non è distinguibile
da quello altrove, e ieri il rimescolamento nel ciclo di sosta era riprodotto al 93-95%. Le
due cose insieme dicono una cosa più precisa: **il motore produce la giusta quantità di
agitazione attorno alle soste, ma gli scambi che ne escono e che durano fino alla bandiera
sono in gran parte diversi da quelli veri.**

Quella frase è la sintesi più onesta di sei giorni, ed è anche il punto in cui mi fermo: non
propongo un meccanismo. Il prossimo passo, se ci sarà, deve partire dalle 62 righe — sono
nell'elenco di `coppie_mancate.mjs --json`, con gara, coppia, giro e secchio.

---

*Nessun parametro toccato. Suite senza regressioni.*
