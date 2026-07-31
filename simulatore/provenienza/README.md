# 🗄️ Dati & Provenienza (`data/` + `provenienza/`)

Grezzo importato e pinnato, UNA definizione di verde, contratti dati,
cross-check esterni. Le definizioni derivate (`verde`, `neutralized`) si
calcolano QUI, mai altrove (regola 1, E12); `status` e `del` grezzi viaggiano
fino in fondo (E04).

Il modulo delle definizioni:
- `contratto.mjs` — la cella per giro, shape unica `{ lap_time, cum_time, stint, compound, tyre_age, in_lap, out_lap, status, del }`; `status`/`del` grezzi fino in fondo (E04), nessun derivato congelato nella cella (E12)
- `vocabolario.mjs` — alfabeto status `{1,2,4,5,6,7}`, mescole, lavaggio dei letterali d'assenza alla frontiera (E05); status composti letti come INSIEME di simboli (E03)
- `definizioni.mjs` — **l'unico proprietario** di `verde` / `regimeNeutralizzato` / `passoUtilizzabile` (regola 1, E12); chi le usa le importa (sentinella s06)
- `adattatore.mjs` — dal grezzo colonnare al contratto cella; identità `{drv, lap}` fuori dalla cella; fallimento rumoroso su colonne mancanti o valori fuori vocabolario
- `ricostruisci_2026.mjs` — baseline: conteggi celle/verdi/neutralizzate per gara 2026 → `banco/golden/ricostruzione_2026.json` con hash (sentinella s08)

Strumenti dell'import pinnato:
- `importa_archivio.mjs` — l'unica porta d'ingresso dal vecchio repo (fonte pretesa allo SHA pinnato)
- `genera_manifest.mjs` — rigenera `data/MANIFEST.sha256` (atto deliberato, mai in CI)
- `verifica_manifest.mjs` — verifica ogni file di `data/` contro il manifest; esce 1 su corruzione/mancanza/intruso (regola 7, E18)
- `genera_inventario.mjs` — rigenera `data/INVENTARIO.md` dai file reali; `--check` confronta e esce 1 su divergenza (E24)

LIMITE DICHIARATO (E13): lo `status` per-auto dell'archivio è una proiezione di
bandiere track-wide/di settore — misurato sul grezzo 2026: 18,4% dei giri con
status non uniforme fra i piloti. Informazione per-auto reale, non bandiera
per-auto certificata.

## Pit-loss: la misura interna ha promosso il prior a cross-check

`pitloss.mjs` risponde con **una fonte sola per circuito**, mai un valore misto:

- **misura interna** (`data/modelli/pitloss_interno.json`) dove il Gran Premio
  ha superato il cancello A di `PREREG_pitloss.md` — 26 GP su 34, e 8 delle 11
  gare 2026;
- **prior esterno** dove non l'ha superato (Belgio e Monaco per la robustezza
  alla finestra) o dove nessuna delle due fonti misura il circuito (Giappone,
  che resta col ripiego d'era).

La targhetta cambia con la fonte: `misurato sul fondo 2018-2025: mediana di N
soste verdi su asciutto` contro `prior esterno`. Un numero misurato che
continuasse a dirsi prior sarebbe una targhetta che mente, e `s22` lo blocca.

**Il Director chiede la perdita a questo modulo**, non al prior: se validasse
con una fonte mentre il motore prezza con un'altra sarebbe E12 nel posto
peggiore. Anche quello è sorvegliato da `s22`, che l'ha già trovato una volta.

## Stint 2026: DECISIONI, non fisica

`esporta_stint_2026.mjs` → `data/viste/stint_2026.json`. Serve solo agli
**allarmi** (`scenario/allarmi.mjs`): «questo piano propone uno stint più lungo
di quasi tutto ciò che si è visto nel 2026». Come **vincolo** è vietato dalla
prereg (`PREREG_multistint.md`, cancello M4), e `s24` lo verifica sui sorgenti
oltre che sul comportamento.

Solo stint **chiusi da una sosta** (quello finale termina con la bandiera, non
con una decisione) e lunghi almeno **4 giri**. La soglia riconcilia un
conflitto: senza filtro la SOFT dava mediana 8 contro i 14 ereditati da
CLAUDE.md, perché 34 stint SOFT su 103 durano meno di 4 giri e sono incidenti
(foratura, danno, ripartenza dopo la rossa), non scelte. Con il filtro:
**13 · 19 · 22** contro **14 · 19 · 22**. Era un conflitto di estimando, non di
misura, ed entrambe le versioni restano nella vista (E21).

## `gap_previsti_s`: la compagnia PREVISTA al rientro

`misure/rientro.mjs` esporta per ogni sosta le distanze fra cum **previsti** dai
rivali al giro di rientro. Sono note al congelamento — sono previsioni, non
osservazioni — quindi non violano E14. Viaggiano **grezze e senza soglie**: la
soglia di «rientro conteso» la fissa la prereg che la usa
(`PREREG_difesa.md`: 2 s), non la misura che produce il dato.
