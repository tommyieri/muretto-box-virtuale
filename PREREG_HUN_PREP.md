# PREREG — Preparazione weekend Ungheria (branch hun-preparazione)

Data: 2026-07-20. Questo file e' committato PRIMA di eseguire fit e misure:
soglie e attesi qui sotto sono vincolanti e non si ritoccano a posteriori.

Contesto: GP d'Ungheria 24–26/07/2026 (FP1 ven 24/07 11:30 UTC, gara dom
26/07 13:00 UTC; `nome` demo = "Ungheria", da calendario_2026.json).
Base: main a 65ee305 (merge #54 → #55 kpi3-f1db → #56 fase3 verificati).

---

## P1 — Pre-costruzione pista Hungaroring da FastF1 2025

### Soglia di fit (scritta PRIMA di eseguire il fit)

**Residuo del fit raw → viewBox: p95 ≤ 3 m.** `gen_live_geo.py` viene
esteso per riportare, oltre al residuo medio gia' previsto, il residuo p95
(in unita' viewBox e in metri); il giudizio e' sul p95 in metri.

**Dichiarazione di circolarita'** (prima di misurare): la polilinea di
riferimento 2025 e `pista_Ungheria.json` derivano dalla STESSA sessione
FastF1 (gara 2025) con gli stessi criteri di giro pulito → e' probabile che
sia lo stesso giro e il fit e' quasi perfetto per costruzione. Il residuo
riportato misura solo ricampionamento/levigatura/arrotondamento, NON la
bonta' della pre-costruzione. Il test non circolare e' la verifica FP1 di
venerdi' (sotto). Nessuna pretesa di "copertura" oltre questo.

### Metodo (dichiarato prima)

1. **Pista del sito**: `gen_pista_svg.py` esteso con `--anno` (default
   2026, invariato) e `--ti`/`--cid` per una gara non ancora a registro.
   Il registro gare NON viene toccato: "Ungheria" vi entrera' solo con la
   gara vera (i consumatori del registro — neutralizzazione, calendario,
   pipeline — non devono vedere una gara senza dati).
   Comando: `--gara Ungheria --ti "Hungarian Grand Prix" --cid hungaroring
   --anno 2025 --sessione R`.
2. **Riferimento raw**: nuovo `live/estrai_precostruzione.py` (FastF1,
   python3 utente, stesso ruolo una-tantum di estrai_riferimenti.py):
   giro pulito della gara 2025 con i criteri IDENTICI a gen_pista_svg →
   `data/live_derived/ungheria_ref_track.json` (decimi di metro, grezzi).
3. **Corridoio pit**: stesso estrattore produce i campioni posizione nei
   periodi pit della gara 2025 (finestre `PitInTime`→`PitOutTime` dei laps
   FastF1, fonte dichiarata nel JSON) →
   `data/live_derived/ungheria_pit_samples.json`;
   `live/costruisci_corridoio.py` esteso ad accettare un file campioni
   `.json` come terza fonte, con i parametri VALIDATI di Fase 1 invariati
   (proiezione asse principale, mediana trasversale per bin di 5 m,
   MIN_PUNTI 200, cluster contiguo principale, scarti riportati) →
   `data/live_derived/pitlane_ungheria.json` + verifica visiva su SVG
   (obbligatoria da runbook) committata.
4. **Fit**: `gen_live_geo.py --gara Ungheria` → `demo/data/live_geo_Ungheria.json`
   con residuo medio E p95 riportati. Giudizio: p95 ≤ 3 m.
5. **Deploy**: asset committati sul branch e collaudo locale della pagina
   live (server statico su demo/). La produzione (Vercel pubblica da main)
   si aggiorna SOLO al merge, che e' del PO: nel report "deploy" = asset
   pronti e collaudati sul branch, dichiarato cosi'.

### Verifica FP1 di venerdi' 24/07 (regola per il runbook)

- FP1 = **SOLO verifica di allineamento** contro questa pre-costruzione:
  giro pulito FP1 2026 (criteri gen_pista_svg) confrontato con
  `ungheria_ref_track.json`; **soglia: p95 delle distanze punto→polilinea
  ≤ 3 m** (coordinate raw, metri). Strumento: `live/verifica_precostruzione.py`
  (nuovo, stdlib, entra nel runbook).
- Se fallisce: rigenerazione da FP1 col percorso documentato passo-passo
  nel runbook (obiettivo 30 minuti).
- **REGOLA STANDARD (entra nel runbook): il live pubblico parte da FP2,
  MAI da FP1.**

---

## P2 — Renderer demo vs live: attesi (scritti prima)

Mappa funzioni attesa dalla lettura del codice: `pista.mjs` condiviso
(nastro, pit-lane stilizzata, proiezione `vista()`); `live_mappa.mjs` =
**secondo renderer** dei marker (trasformazione `versoVb`, interpolazione
`posiziona`, playhead ritardato, staleness) con matematica propria e fonte
dati diversa (position_frame GPS vs replay posizionale su cum_time). Se
la mappa conferma "secondo renderer", si adattano i 5 casi del fix sync
del 14/07 (REPORT_SYNC_DIAGNOSI.md) e si eseguono sul replay della gara
di Spa.

**Strumento**: porta 1:1 della matematica di `live_mappa.mjs`
(versoVb/campione/posiziona/playhead/EMA ritmo/staleness) in un client WS
che consuma `collector.py --replay data/live_raw/2026-07-19_14-53-28.txt
--speed 10 --buffer 0 --attendi-primo-client` (precedente di metodo: la
diagnosi sync del 14/07 uso' una replica esatta della matematica della
demo). Identita' della registrazione (unica del 19/07, inizio 14:53 ≈ via
delle 15:00) confermata con inspect_recording PRIMA delle misure.
Corridoio: `data/live_derived/pitlane_spa.json`, banda ±20 m; distanze in
metri = raw/10. Fatti di gara noti (REPORT_SPA_DOMENICA): 44 giri, SC 1–4,
VSC 17–21 con raffica di 7 pit al giro 20, doppiati ALO/BOT, ritirati
RUS (g.1), PER (g.13, ai box), STR (g.25).

| Caso (origine 14/07) | Selezione deterministica | Atteso |
|---|---|---|
| C1 (VER pit g.17: stato-pit vs geometria) | primo `in_pit=true` FUORI dalle finestre di neutralizzazione (giri 1–4 e 17–21) di un pilota a pieni giri | sfasamento \|t_evento(in_pit on) − t_evento(primo campione entro 20 m dal corridoio)\| ≤ 10 s |
| C2 (LEC 51→52: ancora del tempo) | tutta la gara, tutte le auto | 0 frame con posizione oltre l'ultimo campione ricevuto o non finita; a flusso fermo il marker resta fermo (clamp del playhead attivo) |
| C3 (ALB doppiato) | primo pit di un doppiato (ALO o BOT) | sfasamento ≤ 10 s NONOSTANTE il distacco (nel bug demo lo sfasamento era ≈ distacco, centinaia di secondi per un doppiato) |
| C4 (LEC pit sotto SC) | un pit della raffica del giro 20 (finestra VSC 17–21) | sfasamento ≤ 10 s E track_status vigente all'istante del pit ∈ {Yellow, SCDeployed, SCEnding, VSCDeployed, VSCEnding} (badge FLAG di live.html coerente) |
| C5 (ALO all'arrivo / sparizione) | ogni ritirato: RUS, PER, STR | dopo l'ultimo campione dell'auto: marker grigio a +10 s parete, rimosso a +60 s parete (soglie pre-registrate in live_config.mjs); nessun movimento oltre l'ultimo campione |

Se un caso fallisce: riportare e FERMARSI — decide il PO (istruzione di
sessione). Se la mappa rivelasse invece un renderer condiviso: una riga
nel report e niente casi.

---

## P3 — estrai_gap.py: definizione e atteso (scritti prima)

- **Buco** = Δt > 10 s tra timestamp di ricezione di messaggi consecutivi,
  DENTRO la sessione attiva (dal primo all'ultimo messaggio con dati di
  posizione della registrazione). Per ogni buco: inizio, durata, e lo
  stato che il sito mostrava in quel momento, derivato dalle regole
  pre-registrate della pagina live (heartbeat 30 s → badge LIVE/NESSUNA
  SESSIONE; staleness marker 10 s grigio / 60 s rimosso).
- **Input**: JSONL OpenF1 del collettore E `.txt` SignalR (adattamento
  dichiarato PRIMA del collaudo: sul VPS non esiste NESSUN JSONL della
  gara di Spa — la cartella openf1/ e' vuota, creata alle 20:13 UTC del
  19/07, cioe' col deploy Fase 3 a gara finita. Il collaudo gira quindi
  sulla registrazione SignalR del Mac della gara).
- **Atteso su Spa: ~0 buchi** — e' il collaudo dello strumento, non una
  scoperta.

---

## Nota operativa emersa in P0 (fuori scope, per il PO)

`/status` risponde e il token OpenF1 si rinnova, ma l'ingresso MQTT e' in
loop di rifiuto (`Client identifier not valid`, 213 tentativi falliti)
dall'ultima connessione riuscita delle 21:02 UTC del 19/07. Da chiarire
prima di venerdi'; non si tocca in questa sessione (il collettore in
produzione non si modifica da qui).
