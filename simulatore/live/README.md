# 📡 Live (`live/`)

## `collettore.mjs` — dal feed al contratto cella

Mappa i record del feed nella cella unica di `provenienza/`. **La definizione di
verde si importa, non si riscrive** (E12: il 37% di divergenza replay/live del
vecchio repo nacque esattamente qui) — in questo file la parola "verde" non
compare se non nei commenti.

**Il limite è nel codice, non solo nei commenti** (E13). In gara lo stato pista è
**track-wide**: non esistono bandiere per-auto. La ricostruzione del verde da
stato track-wide è stata MISURATA nel vecchio repo, non dichiarata:

| grandezza | valore |
|---|---|
| accordo | 84,8% |
| falsi verdi | 65 |
| celle di passo oltre 0,10 s | 34,1% |

`raccogliCelle(feed, { fonteStatus })` restituisce `limite` = `LIMITE_TRACK_WIDE`
in modalità `track_wide` e `null` in `per_auto` (che è il dato d'archivio). Ogni
numero derivato da celle track-wide porta la **banda allargata del fattore
(1 + 0,341)** — il calibratore lo fa, e `s19` lo pretende. La sentinella verifica
anche che su una gara con status non uniformi il track-wide produca conteggi
**diversi** dal per-auto: il limite deve esistere nel comportamento, non solo
nella documentazione.

**Note API (verificate 29/07/2026):** `pit_duration` è DEPRECATO → il feed deve
portare `lane_duration` + `stop_duration`, e un feed che porta ancora il campo
vecchio viene **rifiutato rumorosamente** (rompersi oggi, non in silenzio
domani); `segments` di settore non esistono in gara; lo storico 2023+ è gratuito,
il realtime è a pagamento.

## `feed_archivio.mjs` — l'harness di replay

Il feed che il vivo *avrebbe* emesso, ricostruito dal grezzo pinnato. `finoA`
tronca **alla fonte**: il `giro_fine` di uno stint aperto è l'ultimo giro
osservato, non quello che lo stint raggiungerà (E14). `s18` verifica che il feed
troncato a Lf sia identico al feed intero tagliato a posteriori.

## `calibrazione.mjs` — il moltiplicatore di degrado

`m = pendenza osservata (giri verdi ≤ Lf, fuel-corrected col δ del modello) /
pendenza attesa da ρ`, EMA dal prior, pesi per stint `n·R²`, clamp **[0,3; 3,0]**
col flag `clampato`. Senza stint utilizzabili il moltiplicatore è **null** col
motivo, non un numero plausibile (regola 6).

**Le regole del §4, ereditate.** La durata di uno stint è una **DECISIONE** dei
team, non una misura. Le mediane storiche (SOFT 14 · MEDIUM 19 · HARD 22) entrano
solo come **allarme**: stint chiusi molto più corti dello storico ALZANO il peso
del vivo (α 0,3 → 0,5) e ALLARGANO la banda (×1,5), **dichiarandolo nel
risultato**. Mai una stima di durata.

## ⚠️ Stato: il moltiplicatore è DIAGNOSTICA, non decisione

**G5 non è passato.** Il cancello causale pre-registrato
(`banco/prereg/PREREG_G5.md`) chiedeva che il moltiplicatore calibrato sui soli
giri ≤ Lf battesse il prior statico sul resto della stessa gara. Esito
(`banco/prereg/ESITO_G5.json`): mediana ΔMAE **+0,023 / +0,003 / +0,025** s ai
congelamenti 15/25/35 — il live **perde** a tutti e tre, 0 su 3.

Come dichiarato nella prereg, il moltiplicatore **non entra nei percorsi
decisionali**: resta calcolato ed esposto come diagnostica. Non è una promessa —
`s19` scandisce `scenario/` ed `engine/` e fa fallire la suite se qualcuno
importa `calibraDegrado` mentre l'esito è negativo.
