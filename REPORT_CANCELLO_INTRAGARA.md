# REPORT — CANCELLO INTRA-GARA (strato 1)

*Sessione 2026-07-16, branch claude/cancello-intragara. Protocollo:
`PREREG_SESSIONE_INTRAGARA.md` (committata prima dei numeri, commit 18f78f1).
Generatore: `gen_cancello_intragara.py`; dettaglio: `data/CANCELLO_INTRAGARA_REPORT.txt`.*

## Esito (formato del mandato)

**CANCELLO: NON TESTABILE — vittorie 2/7 (29%), IC95 mediana differenza
[−0.1683, +0.0176]**

Il primario 2026 ha prodotto **7 coppie testabili contro la soglia congelata di 8**:
per regola pre-registrata, nessun verdetto. Ma il quadro va detto per intero, senza
attenuazioni:

- sulle 7 coppie 2026, la stima live vince **2 volte su 7** (28.6%);
- il **secondario 2025** (16 coppie, non decide ma orienta): live vince **6/16**
  (37.5%), errore mediano live **0.0474** contro prior **0.0269** s/giro — il prior
  climatologico è **quasi due volte più accurato** della finestra iniziale;
- IC95 della differenza: 2026 [−0.168, +0.018], 2025 [−0.065, +0.008] — entrambi
  pendono dal lato del prior.

**Direzione dell'evidenza: contraria allo strato 1 così formulato.** Se le 9 coppie
mancanti del 2026 arrivassero domani, dovrebbero vincere quasi tutte per aprire il
cancello: improbabile alla luce di entrambi i rami.

## Perché la finestra iniziale sbaglia (diagnosi, non scusa)

Gli errori grossi della stima live sono quasi tutti **negativi e grandi**: Australia
HARD −0.147, Canada MEDIUM −0.210, Baku 2025 HARD −0.262, Qatar 2025 MEDIUM −0.100 —
contro bersagli positivi. Nei primi 15 giri la pendenza misurata NON è degrado: è
**degrado meno evoluzione-pista**, e l'evoluzione è front-loaded (già misurato
nell'arco f(giro): il lin+log fu adottato proprio perché l'evoluzione dei primi giri
contamina le pendenze). A serbatoio pieno e pista che gomma, la coda dello stint
iniziale sembra "non degradare" o addirittura migliorare. Il confondente non è rumore:
è struttura, e una finestra breve e precoce non può separarlo da sola.

Nota simmetrica e onesta: il bersaglio "ultimo terzo" spesso poggia su 3-5 stint
(mediane rumorose), quindi parte dell'errore è del bersaglio, non della stima. Ma
colpisce entrambi i contendenti allo stesso modo: il confronto testa-a-testa resta
leggibile, e il prior lo vince.

## Cosa NON si fa adesso

- **Non si allarga la finestra a 20-25 giri "per vedere se migliora"**: sarebbe
  ridisegnare il test dopo i numeri. Se si riprova, è una domanda NUOVA con prereg
  nuova.
- **Non si conclude "il live non serve"**: è dimostrato solo che la pendenza grezza
  dei primi 15 giri, senza correzione dell'evoluzione, non batte il prior. Una
  formulazione de-confusa (es. differenza di pendenze tra mescole a pari giro, che
  cancella l'evoluzione condivisa; o stima congiunta con f(giro) lin+log) è la
  candidata naturale — domanda nuova, cancello nuovo, con questo risultato come
  baseline aggiuntivo.

## Numeri di contesto

- Coppie perse 2026: calib<3 = 11, target<3 = 7, prior assente = 10 (su un universo
  di 24 combinazioni osservate) — la scarsità è strutturale: nei primi 15 giri
  corrono quasi solo le mescole di partenza, nell'ultimo terzo quelle di arrivo.
- Secondario 2025: 3 gare fuori per guardia-bagnato, 24 coppie senza prior 2023-24
  informativo.
- Igiene e misura identiche alla climatologia (riuso via import, una sola definizione
  dei filtri): fuel-corretto 3/70, riferimento locale, plateau life≥3, blocchi=gare
  nel bootstrap (B=1000, seed 20260716).

## Golden (prima e dopo)

`test_b.py` 449/449 · `test_b.mjs` 449/449 · `demo/test_pit.mjs` 11/11 ·
`test_degrado_hook.mjs` banda-zero bit-identica — verdi prima e dopo; la sessione
aggiunge solo file nuovi (generatore, CSV, report). Kernel, pit, gancio, produzione:
non toccati. Il gancio resta a banda-zero. Verdetto strategico: PO.
