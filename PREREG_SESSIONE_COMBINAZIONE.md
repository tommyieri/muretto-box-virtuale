# PREREG SESSIONE — CANCELLO COMBINAZIONE (quinto sguardo, dichiarato)

*Committata PRIMA del calcolo. Branch: claude/cancello-combinazione. Data: 2026-07-16.*

## 0. Onestà epistemica PRIMA di tutto

Questo è il **quinto sguardo** sullo stesso bersaglio, e va detto due volte:

1. **Gli input esistono già, committati** (`data/cancello_deconfuso.csv`: γ̂ live con
   IC95, prior, bersagli, per tutte le coppie 2026 e 2025). Questa sessione non stima
   nulla di nuovo: dichiara UNA regola di combinazione e la valuta su dati congelati.
   Il valore della prereg qui non è "non ho visto i dati" (parzialmente visti nei
   report precedenti): è che la regola è UNA, senza parametri liberi, scelta per
   motivazione a priori e non per resa — e che nessuna variante verrà provata dopo.
2. **Dopo cinque sguardi, un PASS marginale non vale niente.** Il KPI qui è il più
   severo dell'arco: tre condizioni congiunte. Un NULL chiude l'arco degrado alla
   configurazione onesta (gancio a banda-zero, climatologia come contesto etichettato)
   e la chiusura è un esito pienamente accettabile di questa sessione.

- Nessuna banda costruita, gancio non toccato, "previsto" assente, kernel/pit/golden/
  produzione intatti.

## 1. La domanda (UNA, stretta)

**Quando la gara contraddice con confidenza il prior, ha ragione la gara?**
Operativamente: la stima combinata — prior come base, sostituito dal γ̂ live de-confuso
SOLO quando il live esclude il prior dal proprio IC95 — batte il prior da solo?

## 2. La regola (UNA, senza parametri liberi)

Per ogni coppia (gara, mescola) del cancello de-confuso:

```
combo = live   se  prior < ic_lo(live)  oppure  prior > ic_hi(live)   [scatto]
combo = prior  altrimenti                                             [riposo]
```

Motivazione a priori: l'IC95 cluster-robust del fit FE è l'unica misura di confidenza
già validata disponibile; "il live esclude il prior" è la formalizzazione naturale di
"divergono oltre soglia" senza introdurre alcuna soglia arbitraria da tarare. NESSUNA
variante (scatto parziale, media, soglie assolute, guardie di segno) è ammessa in
questa sessione: o questa regola passa, o l'arco chiude.

## 3. Campione, bersaglio, KPI (congelati ORA)

- **Coppie**: tutte quelle di `cancello_deconfuso` (primario 2026 + secondario 2025,
  ricalcolate dalla stessa catena via import, non lette dal CSV). **Il primario è il
  POOLED 2026+2025** (blocchi = gare): la regola è agnostica all'anno per costruzione
  (scatta su divergenza misurata, non sul calendario) e il pooled dà la potenza che i
  9 casi 2026 da soli non hanno. Ripartizione 2026/2025 riportata per esteso.
- **Bersaglio**: identico al cancello de-confuso (ultimo terzo, mediana pendenze-stint,
  ≥3 stint) — la regola combina le stime di quel cancello contro il suo stesso metro.
- `err_prior = |bersaglio − prior|`, `err_combo = |bersaglio − combo|`; nelle coppie a
  riposo err_combo = err_prior per costruzione (pari = mezza vittoria: la regola paga
  il fatto di scattare raramente, ed è giusto così — deve guadagnare dove scatta senza
  perdere altrove).

**CANCELLO APERTO** solo se TUTTE E TRE (sul pooled):
- (a) vittorie combo ≥ **60%** (pari = 0.5);
- (b) mediana(err_prior − err_combo) > 0 con **IC95 bootstrap blocchi-gara**
  (B = 1000, seed = 20260716) interamente sopra lo 0;
- (c) errore mediano combo < errore mediano prior (uccide il "vince piccolo, perde
  grande" già visto nell'adattamento).

**NULL** se una qualsiasi cade. **NON TESTABILE** se coppie totali < **12** o scatti
< **5**. Diagnostica riportata comunque: quante volte scatta, e quante volte scattando
ha ragione (è la risposta alla domanda del §1 anche in caso di NULL).

## 4. Se NULL: chiusura d'arco (dichiarata ora)

Con un NULL qui l'arco degrado si chiude così, e il report lo scrive per esteso:
gancio v1.5 a banda-zero in produzione; climatologia archiviata come contesto
etichettato mai-input-del-motore; live de-confuso archiviato come "stimatore valido,
mai superiore"; NESSUN sesto sguardo senza dati nuovi (gare 2026 che si accumulano)
o una fonte nuova (non un'altra ricombinazione degli stessi numeri). Verdetto
strategico: PO.

## 5. Output

- `PREREG_SESSIONE_COMBINAZIONE.md` (questo file, prima del calcolo)
- `gen_cancello_combinazione.py` (sola lettura; scrive SOLO
  `data/cancello_combinazione.csv` + `data/CANCELLO_COMBINAZIONE_REPORT.txt`)
- `REPORT_CANCELLO_COMBINAZIONE.md` con in testa:
  "CANCELLO: [APERTO / NULL / NON TESTABILE] — vittorie X/Y (Z%), IC95 [a, b],
  err mediano combo vs prior" + scatti e ripartizione per anno.
- Golden verdi prima e dopo. Commit su claude/cancello-combinazione, niente merge.
