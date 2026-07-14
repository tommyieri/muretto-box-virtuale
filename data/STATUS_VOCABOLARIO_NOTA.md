# STATUS_VOCABOLARIO — nota di metodo (documentazione permanente)

Portato in produzione dall'**attivazione** (branch `attivazione-pitloss-neutralizzazione`),
origine **Sessione N** (`REPORT_NEUTRALIZZAZIONE.md`, pre-registrata in `PREREG_SESSIONE_N.md`).
Deliverable committato: `data/status_vocabolario.csv`.

## Cos'è
Il vocabolario completo dei codici `status` grezzi di TracingInsights: **39 codici distinti** su
88.150 righe (ti_archive 2023-2025 + formato 2026). Prima di questa nota **non era scritto da
nessuna parte**: era conoscenza implicita nel metodo v1.

Un `status` di gara è la **concatenazione ordinata degli stati within-lap** attraversati dall'auto
in quel giro. Alfabeto atomico osservato = **{1, 2, 4, 5, 6, 7}** (il `3` dello standard FIA
TrackStatus è assente, coerente con quello standard).

| digit | significato | stato |
|---|---|---|
| `1` | VERDE (baseline) | convenzionale (implicito nel metodo v1) |
| `2` | GIALLO (bandiera settore) | **ipotesi FIA, non committata** |
| `4` | SC | **committato** (`gen_neutralizzazione.py`, `NEUTRALIZZAZIONE_NOTA.txt`) |
| `5` | RED (bandiera rossa) | **committato** |
| `6` | VSC deployed | **committato** |
| `7` | VSC ending | **ipotesi FIA, non committata** |

Esempi: `14` = VERDE→SC = deployment; `41` = SC→VERDE = restart; `671` = VSC risolta entro il
giro; `12` = bandiera gialla di settore (nessuna neutralizzazione formale); `64`/`1264` = SC e VSC
nello stesso giro = misto non classificabile.

## Classificazione a due livelli (Sessione N, N2)
Generatore: `gen_neutralizzazione_v2.py`. Output: `data/neutralizzazione_due_livelli.csv`.
- **(A) EVENTO per-gara**: regime per giro-di-gara (soglia ≥2 auto, identica al json v1).
- **(B) IMPATTO per-auto-per-giro**: regime del singolo dal suo status atomico.

Le due letture divergono su **691 giri-auto (1,7%)**: la gara è neutralizzata ma la singola auto
sta ancora correndo verde (ha già superato il punto dell'incidente o non l'ha raggiunto). È il
motivo per cui il modulo pit legge **entrambe** le fonti in OR
(`sotto_neutralizzazione = finestra_gara ∨ flag_per_auto`): nessuna delle due, da sola, è la verità.

## Validazione fisica R_lap (Sessione N, N4)
Generatore: stesso file. Output: `data/rlap_per_regime.csv` (R_lap per regime per circuito).
- **SC risanato dalla riclassificazione**: separando deploy/restart dal regime, SC_REGIME entra nel
  range fisico su 8/9 circuiti (pooled 1,614; era 1,11 conflato).
- **VSC ANCORA ROTTA**: VSC_REGIME pooled = **1,055**, non fisico (suzuka senza dati VSC; montreal
  1,043 impossibile). Il segnale `'6'` nel formato 2026 non rallenta come una VSC reale.

## Confini d'uso (leggere prima di costruirci sopra)
1. Questi tre CSV sono **analisi/documentazione**, non fonti di produzione. Il modulo pit
   (`demo/pitscenario.mjs`) continua a leggere **`demo/neutralizzazione.json`** prodotto da
   `gen_neutralizzazione.py` (v1, **non toccato**). L'attivazione ha verificato: golden pit 11/11
   identici prima e dopo l'import (0/11 flip, come calcolato in Sessione N).
2. **Nessuno costruisca sulla neutralizzazione VSC** finché VSC non è capita (R_lap 1,055). Il
   debito VSC resta aperto. Vedi memoria `neutralizzazione-verita`.
3. Determinismo: il generatore ordina il vocabolario per frequenza con tie-break sul codice →
   output **stabile** indipendente da `PYTHONHASHSEED` (fix di robustezza dell'attivazione; non
   cambia codici né dati, solo l'ordine delle righe a pari frequenza).
