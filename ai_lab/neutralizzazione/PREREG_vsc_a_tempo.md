# PREREG V2 — la VSC A TEMPO: la frazione di giro coperta (prima di misurare)

*07/08/2026, sera. V1 (lettura di campo) è NON PASSA a referto: pooled 1,116, e la
diagnosi ha escluso la località (locali 1,128 ≈ campo) lasciando UN candidato — la
diluizione del giro parziale. Questa è la fonte diversa promessa nel referto: le
finestre A TEMPO, non il simbolo per-giro.*

## La fonte nuova, e perché è davvero diversa

`track_status` di FastF1 (cache di progetto): cambi di stato pista con orario DI
SESSIONE al millisecondo — VSCDeployed (6), VSCEnding (7), AllClear — sullo stesso
orologio dei confini di giro (`LapStartTime`/`Time` per pilota). Il simbolo '6'
dell'archivio è una proiezione PER GIRO di queste finestre: qui si misura la cosa
vera, la FRAZIONE f(auto, giro) del giro passata sotto VSC. Cross-check dichiarato:
i messaggi race control (VSC DEPLOYED/ENDING, con giro) devono concordare col
track_status sul numero di finestre per gara.

**Finestra VSC** = [VSCDeployed, primo stato verde successivo) — la coda «Ending»
conta come VSC, coerente con la scelta già MISURATA del live (Ending = regime pieno,
870 celle su 871 identiche al dato ufficiale, ponte_live.mjs).

## La misura

- Estrattore (Python, fonte nuova e basta): per le 11 gare 2026, f_vsc(auto, giro) =
  sovrapposizione(finestra giro, finestre VSC) / durata giro. Artefatto JSON con
  targhetta. Niente R_lap qui: la statistica non rifà mai il metro.
- Metro (Node): LO STESSO stimatore di V1 — R_lap = lap_time / mediana verde
  dell'auto nella gara, niente in/out-lap, guardia E13 — con le celle divise per
  frazione: PIENI (f ≥ 0,9), PARZIALI ALTI (0,5 ≤ f < 0,9), PARZIALI BASSI
  (0 < f < 0,5).

## Il cancello V2 (decide, scritto prima)

**PASSA** se sulle 11 gare 2026:
1. R_lap dei giri PIENI, pooled, ∈ **[1,20–1,50]** (lo stesso range fisico di sempre);
2. la MONOTONIA regge: R_lap(bassi) < R_lap(alti) < R_lap(pieni), sulle mediane.

Diagnosi attesa non vincolante: la mediana di f fra le celle marcate '6' spiega il
1,116 di V1 come miscela pieni/parziali.

## Gli esiti dichiarati

- **PASSA** → il veto si RESTRINGE: «nessuno costruisca sul simbolo '6' per-giro»
  resta; la **VSC a tempo è utilizzabile con targhetta** (finestre + frazioni come
  artefatto). Ogni consumo (motore, neutralizzazioneVera con frazioni, prior) è una
  decisione SEPARATA con la sua prereg.
- **FALLISCE** → la VSC non è capita nemmeno a tempo: veto pieno, capitolo chiuso
  anche su questa fonte, e nessuna terza fonte si insegue senza un'idea nuova.
