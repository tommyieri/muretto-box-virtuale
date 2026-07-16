# REPORT — CANCELLO COMBINAZIONE (quinto sguardo) e CHIUSURA D'ARCO

*Sessione 2026-07-16, branch claude/cancello-combinazione. Protocollo:
`PREREG_SESSIONE_COMBINAZIONE.md` (committata prima del calcolo, commit 7d7ec68).
Generatore: `gen_cancello_combinazione.py`; dettaglio: `data/CANCELLO_COMBINAZIONE_REPORT.txt`.*

## Esito (formato del mandato)

**CANCELLO: NULL — vittorie 14/27 (52%), IC95 [+0.0000, +0.0000], err mediano combo
0.0309 vs prior 0.0278**

Tutte e tre le condizioni congiunte cadono: vittorie sotto il 60%, differenza mediana
nulla (la regola riposa in 16 coppie su 27, e dove riposa non può vincere né perdere),
errore mediano **peggiore** del prior. La risposta alla domanda del protocollo è nel
numero più importante del report: **la regola scatta 11 volte, e scattando ha ragione
6/11 (55%) — una moneta.** Quando la gara contraddice con confidenza il prior, ha
ragione circa metà delle volte: l'IC95 cluster-robust del fit live è sovraconfidente
rispetto alle anomalie di prima metà (Cina 2026 e Baku 2025 scattano con IC
strettamente negativi contro bersagli positivi).

Nel dettaglio degli 11 scatti c'è il quadro completo: i 6 giusti guadagnano in media
~0.05 s/giro, i 5 sbagliati perdono in media ~0.08 — anche l'aritmetica interna dello
scatto è sfavorevole. La ripartizione 2026 (5/9, err mediano migliore) è l'unico
segnale tenue, ma è esattamente il tipo di marginale che la prereg ha dichiarato in
anticipo di non voler valorizzare al quinto sguardo.

## CHIUSURA D'ARCO (come dichiarata in prereg §4)

Cinque cancelli pre-registrati, cinque esiti onorati senza ritocchi:

| # | tentativo | esito |
|---|---|---|
| 1 | prior storico grezzo (K2 climatologia) | STOP 39.9% |
| 2 | live grezzo primi-15 | NON TESTABILE, direzione contraria |
| 3 | live de-confuso (pari giro) | NULL 3/9 (ma batte il grezzo 15/22) |
| 4 | adattamento LORO cross-gara | NULL, err peggiora |
| 5 | combinazione su scatto IC (questo) | NULL, scatto = moneta |

**Configurazione finale dell'arco degrado:**
- il **gancio v1.5 resta a banda-zero** in produzione (meccanismo validato, in attesa
  di acqua che ancora non esiste);
- la **climatologia** (`data/climatologia_degrado.csv`) resta archiviata come
  **contesto etichettato** — "Barcellona storicamente degrada 3× Monaco" — mai come
  input del motore;
- il **live de-confuso** resta archiviato come stimatore valido ma mai superiore
  (`gamma_finestra()` riusabile);
- **nessun sesto sguardo senza dati nuovi o fonte nuova**: le ricombinazioni degli
  stessi numeri sono esaurite — dichiarato qui e vincolante. Dati nuovi = le gare
  2026 che si accumulano (ogni gara aggiunge coppie a TUTTI i cancelli chiusi, che
  sono rieseguibili così come sono committati); fonte nuova = qualcosa che oggi non
  abbiamo (telemetrie, temperature per-stint sistematiche, dati Pirelli).

Il valore accumulato non è zero — è la mappa: sappiamo *perché* ciascuna strada non
funziona, con numeri committati e generatori rieseguibili. Nessun futuro noi ripartirà
da capo. Verdetto strategico, come sempre: PO.

## Numeri di contesto

- 27 coppie (9 del 2026, 18 del 2025), ricalcolate dalla catena de-confusa via import.
- Regola unica senza parametri (scatto su IC-esclusione); nessuna variante provata,
  come da prereg.
- Bootstrap blocchi-gara B=1000, seed 20260716.

## Golden (prima e dopo)

`test_b.py` 449/449 · `test_b.mjs` 449/449 · `demo/test_pit.mjs` 11/11 ·
`test_degrado_hook.mjs` banda-zero bit-identica — verdi; solo file nuovi.
Kernel, pit, gancio, produzione: non toccati.
