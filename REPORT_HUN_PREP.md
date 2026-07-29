# REPORT — Preparazione weekend Ungheria (branch hun-preparazione)

**P0: merge [ok] | P1 pista: residuo fit p95 1,17 m (medio 0,64 m), deploy
[asset committati e collaudati sul branch; la produzione Vercel parte da
main: online al merge, che e' del PO] | P2 renderer: SECONDO RENDERER +
tabella 5 casi TUTTI PASSATI sul replay della gara di Spa | P3
estrai_gap: collaudato su Spa (0 buchi, atteso ~0)**

Golden verdi a inizio e fine sessione (449/449 Python, 449/449 JS ≤1e-9,
11/11 pit). PREREG committato PRIMA delle verifiche (3494811), con la
soglia di fit **p95 ≤ 3 m** scritta prima di eseguire il fit. NON
mergiato: il merge e' del PO.

---

## P0 — Stato repo

- **Merge verificati nell'ordine richiesto**: e482455 (PR #54,
  live-fase2) → 78ec20d (PR #55, live-kpi3-f1db) → 65ee305 (PR #56,
  live-fase3). Branch creato esattamente da main a 65ee305.
- **Golden verdi** (baseline): `test_b.py` 449/449 (max diff 4,26e-12),
  `test_b.mjs` 449/449 sotto 1e-9, `test_pit.mjs` 11/11.
  `ref_traffic_py.json` riscritto bit-identico (atteso).
- **`/status` del collettore raggiungibile**: risponde su
  `https://ws.murettobox.com/status`, token OpenF1 valido e rinnovato
  automaticamente, 33,6 GB liberi. `connesso: false` (nessuna sessione
  oggi).
- **⚠ Segnalazione per il PO (fuori scope, non toccata)**: l'ingresso
  MQTT OpenF1 e' in loop di rifiuto `Client identifier not valid`
  dall'ultima connessione riuscita delle 21:02 UTC del 19/07 (213
  tentativi al momento del controllo). Il token si rinnova regolarmente:
  il problema e' l'handshake MQTT, non l'OAuth. **Da chiarire prima di
  venerdi'**, altrimenti la mappa live del weekend resta senza feed.
- Scoperta collegata: sul VPS **non esiste alcun JSONL OpenF1 della gara
  di Spa** (la cartella `openf1/` e' stata creata alle 20:13 UTC del
  19/07, col deploy Fase 3 a gara finita). Conseguenza dichiarata nel
  PREREG per il collaudo P3 (sotto).

## P1 — Pre-costruzione pista Hungaroring (FastF1 2025)

Catena eseguita come da PREREG (metodo scritto prima):

| passo | esito |
|---|---|
| pista | `pista_Ungheria.json` da giro pulito gara 2025 (RUS, giro 45, 79,409 s), 500 punti, 4326 m, rot 40° — `gen_pista_svg --anno 2025 --ti/--cid` (registro NON toccato) |
| riferimento raw | `ungheria_ref_track.json` (298 punti, 4315 m) — stesso giro della pista: **circolarita' dichiarata nel PREREG** |
| corridoio pit | 2494 campioni da 29 finestre PitIn→PitOut 2025 (1 scartata senza uscita) → `pitlane_ungheria.json`: 75 punti, **374 m, 0 cluster scartati**; verifica visiva su `ungheria_precostruzione_xy.svg` (corridoio rettilineo parallelo interno al rettilineo del traguardo) |
| fit raw→viewBox | `live_geo_Ungheria.json`: scala 0,109646, **residuo medio 0,64 m, p95 1,17 m ≤ 3 m → soglia PREREG rispettata**. Nota onesta: fit quasi perfetto PER COSTRUZIONE (ref = stesso giro della pista); misura solo ricampionamento/levigatura. Il test vero e' il cancello FP1. |
| collaudo pagina | live.html locale seleziona gia' il GP d'Ungheria (FP1 ven 24/07) e disegna l'Hungaroring con pit-lane stilizzata e tacca del traguardo (canvas verificato); overlay corridoio si accende solo in sessione (per regola) |
| deploy | asset committati sul branch (e25dbab). La demo pubblica si aggiorna SOLO col push su main (Vercel): **online al merge, decisione PO**. Oggi la pagina live in produzione mostra "Mappa live non disponibile" per l'Ungheria finche' non si mergia. |

**Cancello FP1 (nuovo, nel runbook)**: `live/verifica_precostruzione.py`
— giro pulito FP1 2026 vs riferimento pre-costruito, **soglia p95 ≤ 3 m**
(pre-registrata). Collaudato due volte:
- circolare (Ungheria 2025 R vs se stessa): p95 0,23 m — meccanica ok;
- **prova generale cross-anno su Spa** (FP2 2026 vs riferimento 2025):
  **GO, p95 0,67 m** (media 0,28 m, max 8,24 m su 409 campioni) — la
  soglia di 3 m e' realistica per il cancello di venerdi'.

**Runbook aggiornato** (live/RUNBOOK_WEEKEND.md): pre-costruzione prima
del weekend (fatta per l'Ungheria), venerdi' FP1 = **SOLO verifica di
allineamento** (p95 ≤ 3 m), percorso di **rigenerazione da FP1
passo-passo con tempi (obiettivo 30 minuti)** se la verifica fallisce, e
la regola standard scritta in testa:
**IL LIVE PUBBLICO PARTE DA FP2, MAI DA FP1.**

## P2 — Renderer demo vs live: SECONDO RENDERER

Mappa delle funzioni (demo `gara.html`+`pista.mjs` vs live
`live.html`+`live_mappa.mjs`):

- **Condiviso**: `pista.mjs` — nastro del tracciato, pit-lane
  stilizzata, tacca start/finish, proiezione `vista()` (il live la
  rilegge a ogni frame).
- **Secondo renderer** (`live_mappa.mjs`, matematica propria, fonte dati
  diversa): trasformazione `versoVb` (da `live_geo_*.json`), buffer
  campioni per auto, interpolazione `posiziona`, playhead ritardato con
  stima EMA del ritmo, staleness 10/60 s, disegno corridoio e anello
  in_pit. La demo anima da `cum_time` (replay posizionale), il live da
  `position_frame` GPS: nessun codice di animazione in comune.

Quindi, come da istruzione, i **5 casi del fix sync del 14/07** sono
stati adattati al live (attesi pre-registrati in PREREG_HUN_PREP.md) ed
eseguiti sul **replay della gara di Spa** via
`collector.py --replay data/live_raw/2026-07-19_14-53-28.txt --speed 10
--buffer 0 --attendi-primo-client` (identita' della registrazione
verificata con inspect_recording: 12:53→14:34 UTC, 44 LapCount, 0 righe
illeggibili). Strumento: porta 1:1 della matematica di `live_mappa.mjs`
(45.954 eventi catturati dal WS, replica offline su 16.295 frame da
50 ms; script in scratchpad, non committato — stesso precedente della
diagnosi del 14/07). Corridoio: `pitlane_spa.json`, banda ±20 m;
sfasamento = t_evento(in_pit on) − t_evento(primo campione nel
corridoio).

| caso (origine 14/07) | selezione | atteso | misurato | esito |
|---|---|---|---|---|
| C1 stato-pit vs geometria (VER g.17) | primo pit con pista AllClear, pilota a pieni giri → **GAS 13:32:55** | \|sfas.\| ≤ 10 s | **−0,06 s** | **PASS** |
| C2 ancora del tempo (LEC 51→52) | tutta la gara, tutte le auto | 0 estrapolazioni oltre l'ultimo campione, valori finiti | 29.919 clamp del playhead ingaggiati, **0 violazioni**, marker fermi a flusso fermo | **PASS** |
| C3 doppiato (ALB) | primo pit di un doppiato → **ALO 13:43:29** | ≤ 10 s NONOSTANTE il distacco | **−2,84 s** (nel bug demo sarebbe stato ≈ distacco, minuti per un doppiato) | **PASS** |
| C4 pit sotto neutralizzazione (LEC sotto SC) | raffica giro 20 sotto VSC (8 transizioni in 180 s) → **LEC 13:44:12** (e ALO −2,84 / HAM −3,53 / PIA −1,13) | ≤ 10 s e track_status ∈ {Yellow/SC/VSC} | **−2,70 s**, status **VSCDeployed** (badge FLAG coerente) | **PASS** |
| C5 staleness / sparizione (ALO all'arrivo) | ritirati RUS, PER, STR | grigio a +10 s parete, rimosso a +60 s, nessun movimento oltre l'ultimo campione | grigio **+10,0 s**, rimosso **+60,0 s**, movimento 0 (per tutti e tre) | **PASS** |

Sfasamenti sistematicamente piccoli e **negativi** (la geometria entra
nella banda del corridoio ~1–3 s prima che l'InPit del timing scatti):
coerente e indipendente dal distacco — la proprieta' che il fix del
14/07 ripristinava in demo vale nel live per costruzione (stato e
posizione sono entrambi per-auto, nessun orologio del leader).

**Scoperta in corso d'opera (fatto del feed, non del renderer)**: le
auto ritirate CONTINUANO a trasmettere posizione dal box fino a fine
sessione (ultimo campione di RUS/PER/STR = 14:32:20, fine flusso): i
loro marker restano visibili parcheggiati in pit e ingrigiscono solo a
feed finito. Comportamento conforme alle regole pre-registrate; da
sapere per non scambiarlo per un bug durante il weekend.

## P3 — estrai_gap.py: collaudato su Spa

`live/estrai_gap.py` (nuovo, stdlib): buchi > 10 s tra messaggi
consecutivi dentro la sessione attiva (definizioni pre-registrate), con
lo stato che il sito mostrava (10 s marker grigi / 30 s badge NESSUNA
SESSIONE / 60 s marker rimossi). Legge i JSONL OpenF1 del collettore e
i `.txt` SignalR — **adattamento dichiarato nel PREREG**: nessun JSONL
della gara di Spa esiste (P0), quindi il collaudo e' girato sulla
registrazione SignalR del Mac.

- **Collaudo gara di Spa**: sessione attiva 12:53:27→14:32:20 UTC,
  70.205 messaggi, **nessun buco > 10 s** (atteso ~0: e' il collaudo
  dello strumento, non una scoperta). Report in
  `data/live_derived/gap_gara_spa.json`.
- Percorso JSONL coperto da test sintetico (`live/test_estrai_gap.py`,
  2/2): buco artificiale di 45 s riconosciuto e classificato, buco fuori
  sessione attiva ignorato.

## Golden e commit

Golden a fine sessione: `test_b.py` 449/449 · `test_b.mjs` 449/449
(≤1e-9) · `test_pit.mjs` 11/11 — tutti verdi, `ref_traffic_py.json`
bit-identico.

Commit su hun-preparazione (in ordine): 3494811 (PREREG), e25dbab (P1),
e2b1345 (P3), questo report. **NON mergiato.**

## Per il PO — decisioni aperte

1. **Merge del branch** → mette online pista+viewBox Ungheria (oggi la
   pagina live pubblica mostra "mappa non disponibile" per l'Ungheria) e
   rende deployabile il corridoio sul VPS.
2. **MQTT OpenF1 rotto da sabato sera** (`Client identifier not valid`):
   senza fix, venerdi' la mappa live resta vuota. Da indagare sul VPS /
   con OpenF1 prima del weekend.
3. Dopo FP1 di venerdi': cancello `verifica_precostruzione` (p95 ≤ 3 m)
   e, solo se fallisce, rigenerazione 30 min da runbook. Live pubblico
   da FP2.
