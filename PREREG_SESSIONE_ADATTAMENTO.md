# PREREG SESSIONE — CANCELLO ADATTAMENTO (la storia dà la forma, il 2026 la taratura)

*Committata PRIMA di qualsiasi numero. Branch: claude/cancello-adattamento. Data: 2026-07-16.*

## 0. La domanda (UNA, stretta) e perché è NUOVA

**Un adattamento della climatologia storica — struttura dal 2023-25, taratura dalle
gare 2026 già corse — stima il degrado marginale di una gara 2026 MAI VISTA meglio del
prior storico grezzo?**

Motivazione dai tre esiti precedenti (tutti incisi): il prior grezzo non trasferisce
(K2 STOP 39.9%, spostamento circuito-specifico ma non casuale); il live grezzo è
confuso dall'evoluzione (direzione contraria); il live de-confuso pareggia ma non
batte (NULL 3/9). L'ipotesi qui: **la storia sbaglia il livello, non la struttura** —
e il livello lo tarano le 9 gare 2026 già in archivio. Nessuna attesa di gare nuove:
il test set vergine è il **leave-one-race-out** sulle 9 (taro su 8, verifico sulla
nona, ruoto: la gara di verifica non vede mai i propri dati in taratura).

**Quarto sguardo sullo stesso bersaglio, dichiarato.** Mitigazioni congelate: (a) UNA
sola ipotesi primaria (M1, il modello più povero: 1 parametro); (b) i modelli più
ricchi sono SECONDARI (orientano, non decidono, non riscattano); (c) validazione
solo fuori-campione (LORO); (d) soglie identiche ai cancelli precedenti.

- Nessuna banda costruita, gancio non toccato (resta banda-zero), "previsto" assente.
- Kernel, modulo pit, golden, produzione: non toccati.

## 1. Bersaglio, baseline, coppie

- **Bersaglio** (per (gara 2026, mescola)): mediana delle pendenze-stint di TUTTA la
  gara — la stessa identica misura della climatologia (fuel-corretto 3/70,
  riferimento locale, plateau life ≥ 3, igiene invariata, guardia bagnato invariata),
  riuso via import da `gen_climatologia_degrado.raccogli()`. Diversa dall'ultimo-terzo
  dei cancelli live, e dichiarata: l'adattamento è PRE-gara e il prodotto è la banda
  di gara intera — bersaglio e prior condividono così la stessa definizione.
- **Baseline M0**: `data/climatologia_degrado.csv` (leave-2026-out), colonna
  `banda_centrale_med`, solo righe INFORMATIVA. Il suo errore contro QUESTO bersaglio
  è ricalcolato qui (lo 0.028 dei cancelli live era contro l'ultimo-terzo: non
  confrontabile e non riusato).
- **Coppia testabile**: (gara 2026, mescola) con ≥ 3 stint qualificati 2026 E prior
  INFORMATIVA per (mescola, cid). Perse conteggiate (`target<3`, `prior_assente`).

## 2. La scala di adattamento (congelata, dal più povero al più ricco)

In LORO (gara di verifica esclusa dalla taratura; taratura = coppie delle altre 8):

- **M1 — offset globale (1 parametro, PRIMARIO)**:
  `stima = prior + δ`, con `δ = mediana su taratura di (bersaglio − prior)`.
- **M2 — offset per mescola (secondario)**: `δ_c` mediana per compound sulla
  taratura; se il compound non ha coppie in taratura, ripiego dichiarato su δ globale.
- **M3 — ricalibrazione lineare robusta (secondario)**: `stima = a + b·prior` con
  b = pendenza di Theil–Sen sulle coppie di taratura e a = mediana(bersaglio − b·prior).
  (È il quantile-mapping onesto per questo n: monotono, 2 parametri, niente code.)

Taratura valida se le coppie di taratura sono ≥ 6; sotto, la coppia di verifica è
persa (`taratura<6`, conteggiata).

## 3. KPI (congelato ORA — decide SOLO M1 vs M0)

Per ogni coppia LORO: `err_M0 = |bersaglio − prior|`, `err_M1 = |bersaglio − stima_M1|`;
vittoria M1 se `err_M1 < err_M0` (pari a 4 decimali = mezza).

**CANCELLO APERTO** se ENTRAMBE: (a) vittorie M1 ≥ **60%**; (b) mediana(err_M0 −
err_M1) > 0 con **IC95 bootstrap a blocchi-gara** (B = 1000, seed = 20260716)
interamente sopra lo 0. **NULL** se una cade. **NON TESTABILE** se coppie < **8**.

**Secondari (riportati per esteso, NON decidono e NON riscattano un NULL di M1)**:
M2 e M3 contro M0 e contro M1, stesse metriche. Servono SOLO a orientare l'eventuale
prereg successiva. Nessuna soglia si ritocca a numeri visti.

## 4. Output

- `PREREG_SESSIONE_ADATTAMENTO.md` (questo file, prima dei numeri)
- `gen_cancello_adattamento.py` (sola lettura; scrive SOLO
  `data/cancello_adattamento.csv` + `data/CANCELLO_ADATTAMENTO_REPORT.txt`)
- `REPORT_CANCELLO_ADATTAMENTO.md` con in testa:
  "CANCELLO: [APERTO / NULL / NON TESTABILE] — M1 vittorie X/Y (Z%), IC95 [a, b]"
  + secondari M2/M3 per esteso.
- Golden verdi prima e dopo (449/449 py+js, 11/11 pit, hook banda-zero).
  Commit su claude/cancello-adattamento, niente merge. Verdetto strategico: PO.
