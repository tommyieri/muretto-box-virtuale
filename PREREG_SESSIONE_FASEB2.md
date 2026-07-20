# PREREG SESSIONE — FASE B (2a metà): calibrazione degli scenari

*Committata PRIMA dei numeri. Branch: claude/fase-b-copertura. Data: 2026-07-20.*
*Da PIANO_DEGRADO_LIVE.md. Segue Fase B 1a metà (magnitudine M1, REPORT_FASEB.md).*

## 0. La domanda (UNA, stretta)

Con la magnitudine corretta (M1), **i tre scenari mostrati nel pannello pit contengono
davvero il degrado osservato sui prossimi giri, alla copertura attesa?** È il cancello
di CALIBRAZIONE che precede l'accensione di `SCENARI_ATTIVI`: se la banda [ottimistico,
pessimistico] non contiene la realtà a un tasso onesto, gli scenari sono falsamente
sicuri e restano dormienti.

- Solo REPLAY sull'archivio 2026 (Monaco escluso). Nessun live, nessuna attivazione.
- **NON riapre il degrado-predizione** (arco chiuso): la banda è quella climatologica
  già TRASFERIBILE (K2 43.7%); qui si testa se, PROIETTATA IN AVANTI con M1, mantiene la
  copertura sull'orizzonte che serve al pit (prossimi giri), non sull'intero stint.
- La parola "previsto" non compare. Un NULL/sotto-copertura onesto è un esito ammesso:
  in quel caso gli scenari restano OFF e si scrive il perché.
- Kernel, modulo pit, gancio, produzione: non toccati.

## 1. Osservabile e finestra (riuso Fase B 1a metà)

Per un caso (pilota, stint, freeze L) con `pace_base` definita (window ≥3 giri verdi) e
mescola con banda climatologica INFORMATIVA per il circuito:

- `A₀` = mediana(life) del window pace_base (come M1); `pace_base` = dato vero della demo.
- **finestra in avanti** = i primi giri VERDI successivi al freeze nello STESSO stint
  (prima del pit reale), non neutralizzati, no in/out-lap, `lap ≤ N−1`, cap **K = 6**,
  **minimo 3** giri (sotto: finestra scartata — il cumulato sarebbe troppo rumoroso).
- residuo osservato cumulato: `obs_cum = Σ [tempo_fuel_corretto(A) − pace_base]` sulla
  finestra (3/70, riferimento locale).
- proiezione dei tre scenari (M1): per rate ∈ {q25, q50, q75} del CSV climatologia,
  `proj_cum(rate) = Σ rate·(A − A₀)` sulla finestra. Quindi
  `ott_cum = proj_cum(q25)`, `cen_cum = proj_cum(q50)`, `pess_cum = proj_cum(q75)`.
  (Bande con q25<0 ammesse: due lati, come da climatologia.)
- Igiene identica all'arco: verdi, slick, outlier 1.07×, Monaco escluso, gara-bagnata
  esclusa, SC/VSC fuori (degrado sospeso lì).

## 2. KPI (congelato ORA)

**COPERTURA** = frazione di finestre con `ott_cum ≤ obs_cum ≤ pess_cum`, pooled su tutte
le finestre testabili; IC95 **bootstrap a blocchi-gara** (B=1000, seed=20260720).

- **CALIBRATA** se COPERTURA ≥ **40%** (stessa soglia congelata di K2: "la banda
  contiene la realtà"). → il cancello di calibrazione è passato; gli scenari sono onesti;
  l'accensione (`SCENARI_ATTIVI`) resta decisione del PO.
- **SOTTO-COPERTURA** se < 40% → gli scenari non sono calibrati sull'orizzonte pit;
  restano dormienti; si riporta la direzione del miss e si rivede col PO.
- **NON TESTABILE** se finestre < **30** o gare < **4**.

Riportate anche (non decidono): copertura per compound e per circuito; direzione del
miss (obs sotto ottimistico = realtà meglio del best case, evoluzione-pista/rumore; obs
sopra pessimistico = peggio del worst case); posizione mediana di obs_cum nella banda.

## 3. Secondario (orienta, NON decide, NON riscatta)

**Banda aggiornata coi giri già corsi**: stimare la rate live = pendenza OLS di
`tempo_fuel_corretto` su `life` sui giri GIÀ CORSI dello stint (il window pace_base),
sostituirla al centrale e ri-centrare la banda (stessa semi-ampiezza q25/q75), poi
ricalcolare la copertura. Serve solo a vedere se aggiornare aiuta — l'arco chiuso
(de-confuso NULL, combinazione = moneta) dice di non aspettarselo. Non sposta il verdetto.

## 4. Se CALIBRATA / se SOTTO-COPERTURA

- CALIBRATA: cancello di calibrazione passato. Il PO può accendere `SCENARI_ATTIVI`
  (una riga). Poi Fase C (live + shadow-run). Nessuna banda modificata da questa sessione.
- SOTTO-COPERTURA: scenari restano OFF; la nota dice se serve allargare la banda
  (domanda nuova, prereg nuova) o se l'orizzonte pit è intrinsecamente più rumoroso
  dello stint intero. Nessun ritocco a numeri visti.

## 5. Output

- `PREREG_SESSIONE_FASEB2.md` (questo file, prima dei numeri)
- `gen_faseb2_copertura.py` (sola lettura su demo/data + CSV climatologia; scrive SOLO
  `data/faseb2_copertura.csv` + `data/FASEB2_COPERTURA_REPORT.txt`)
- `REPORT_FASEB2.md` con in testa:
  "CALIBRAZIONE: [CALIBRATA / SOTTO-COPERTURA / NON TESTABILE] — copertura X% (IC95),
  n finestre/gare" + per-compound/circuito + secondario.
- Golden verdi prima e dopo. Commit su claude/fase-b-copertura, niente merge. PO decide.
