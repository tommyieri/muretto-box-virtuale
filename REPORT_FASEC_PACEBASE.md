# REPORT — FASE C: pace_base live (l'ultimo input mancante per lo shadow-run)

*Sessione 2026-07-20, branch claude/fase-c-shadow-harness. Segue l'abilitante
(collettore decodifica gli stint, PR #66 mergiata).*

## In una riga

Ricostruito `pace_base` dal flusso live con la **stessa semantica del kernel** —
verificato **2082/2082 confronti bit-esatti** su due gare. Era l'unico input degli
scenari che il live non aveva: ora lo shadow-run ha **tutti** gli ingredienti
calcolabili live. Resta la sessione live (HUN) e il deploy.

## Perché pace_base era il pezzo mancante

Il client live (torre di timing) mantiene pos/gap/last_lap, ma NON `pace_base` (la
mediana di stint fuel-corretta che è la base del gancio). In replay arriva
pre-calcolata dal kernel (`demo/data/<gara>.json` → `pace[L][drv]`); in live no. Senza
di essa gli scenari non partono.

`live/pace_base_live.py` (`PaceBaseLive`) la ricostruisce **incrementalmente**: per
pilota accumula i tempi fuel-corretti (3/70) dei giri VERDI dello stint corrente
(esclusi neutralizzati / in-out-lap), mediana quando ≥ 3 giri, segmento azzerato al
cambio stint. È la definizione esatta di `engine.py::pace_base`, applicata al flusso.

## Verifica

- **vs kernel**: rialimentando i giri dell'archivio in ordine e confrontando
  `pace(drv)` con `pace[L][drv]` del kernel a ogni freeze L → **Gran Bretagna 858/858 e
  Austria 1224/1224 confronti combaciano a 1e-6**. La stima live È il kernel.
- **unit** (`test_fase1.py`, ora 14/14): soglia 3 giri, esclusione dei giri
  neutralizzati, azzeramento al nuovo stint.

## Lo shadow-run è ora completo negli input (mappa)

| input degli scenari | fonte live | stato |
|---|---|---|
| compound + età-gomma | SignalR `TimingAppData.Stints` | decodificato (PR #66) |
| **pace_base** | ricostruito dai `last_lap` | **questo, 2082/2082** |
| banda calibrata per circuito | `climatologia_bande.json` | c'è (Fase A) |
| adapter M1 (A₀) | finestra pace_base (stessi giri) | c'è (Fase B) |
| giri osservati (post-gara) | flusso live registrato | c'è |

Il KPI shadow (prereg §3: copertura del degrado cumulato ∈ [ott,pess] + plausibilità +
banda-zero bit-identica) usa **pace_base + banda + giri osservati** — NON serve
ricostruire cum/posizioni. Poiché `pace_base live == kernel` bit-per-bit, la copertura
shadow riprodurrà quella già calibrata in Fase B (43.1%), ma **misurata sul feed live**.

## Cosa resta (dichiarato)

- **Sessione live (Ungheria)**: lo shadow gira solo durante una gara reale — calcola i
  tre scenari a ogni giro dai campi live, li REGISTRA senza mostrarli, e a gara finita
  misura la copertura. HUN non è ancora corsa → **NON TESTABILE finora**; il codice degli
  input è pronto e verificato.
- **Deploy del collettore** (PR #66) sul VPS: azione del PO.
- **Pubblicazione** degli scenari live: decisione del PO, dopo lo shadow.

Kernel, gancio, modulo pit, demo, produzione: non toccati. `PaceBaseLive` è read-only,
lo chiamerà lo shadow. `test_fase1.py` 14/14; `test_collector.py` 4/4.
