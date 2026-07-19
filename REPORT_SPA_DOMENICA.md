# REPORT SPA — domenica 19/07/2026 sera

**FASE 1: OK IN DEROGA (gara in demo, bypass una-tantum autorizzato dal PO; verifica
completa, sync browser inclusa) | GATE A: mediana 22,50 → NON GIUDICABILE (fuori banda di
+1,92 s) | GATE B: — (chiuso per decisione PO) | GATE C: —**

**Esito della serata: il Belgio è in demo per completezza dell'archivio, NON per giudicare
il pit-loss. Spa resta a 23,36 in entrambe le fonti; il candidato 18,58 aspetta la prossima
Spa. Golden verdi a ogni passaggio. Commit su questo branch; il merge è del PO.**

Checklist seguita: `SPA_DOMENICA.md` (identica su `att6-v2-taratura` e su questo branch).

---

## FASE 1 — INGESTIONE: gara entrata **SÌ, IN DEROGA** (secondo passaggio)

> Aggiornamento post-autorizzazione PO: bypass una-tantum del solo controllo pace-a-N//2
> (SC 17–21 a ridosso del punto di campionamento, copertura pace piena dal giro 24, dati
> validati da dry-check e completezza). **La soglia del guardrail NON è stata toccata**: il
> bypass è vissuto solo nel worktree per la durata di `prepara`+`pubblica`, poi
> `pipeline_gara.py` è stato ripristinato all'originale committato (nel commit è invariato).
> Checkpoint raggiunto e pulito: 44 giri, 22 piloti, ASCIUTTA, finestre sc=[[1,4]]
> vsc=[[17,21]], pit-loss 23,36 (travaso CSV→json ATTESO; l'eventuale 18,58 solo dopo un
> futuro ATT6), esiti 17 pieni / 2 doppiati (ALO, BOT) / 3 ritirati (PER, RUS, STR),
> neutralizzazioni esistenti INVARIATE. Golden pit 11/11 subito dopo la pubblicazione
> (nessun caso golden cade sul Belgio). Verifica post-ingestione e sync più sotto.

### Verifica post-ingestione (formato motore e demo)

- `demo/data/Belgio.json` (159 KB): chiavi top e campi per-auto **identici alle gare
  esistenti** (team, cum_time, lap_time, lap, stint, compound, tyre_age, in_lap, out_lap,
  neutralized); pace per i giri 1–44 (8 piloti al giro 22, 20 dal 24 — il profilo noto).
- manifest 9 → 10 gare; pitloss.json Belgio = **23,36 TIPICO**; esiti 22 piloti;
  registro aggiornato; 30 in_lap / 28 out_lap (i 2 senza out = ritiro ai box di PER).

### Verifica sync nel browser (prima gara ingerita dopo il fix di sincronizzazione)

Server locale su `demo/`, `gara.html?g=Belgio`, replay azionato e ispezionato ai giri
1 / 19 / 20–21 / 44:

| controllo | esito |
|---|---|
| contatore giri | ✓ 1→44 coerente; badge **SC** ai giri 1–4, **VSC** ai 17–21, "in corso" al 44 |
| banner neutralizzazione | ✓ SAFETY CAR (partenza) e VIRTUAL SAFETY CAR (17–21) accesi nelle finestre |
| timeline | ✓ banda SC a inizio gara, banda VSC a metà, tacche pit sui giri giusti |
| stato box | ✓ badge **BOX** in piazzola e **OUT** sull'out-lap, tempificati coi pit reali (ALO fine g.20; HAM/LEC/PIA/BEA/BOR/HAD/HUL ciclano BOX→OUT tra p≈21,1 e 21,7) |
| pit lane (durata sosta) | ✓ a contratto: etichetta "pit lane" derivata dalla semantica; per il Belgio la durata NON compare perché `pitstops_2026.json` (fonte f1db, release esterna) non ha ancora la gara — la UI non stima mai; compare "monta hard/…" dai dati gara |
| classifica live | ✓ gap numerici fuori neutralizzazione, ritiri esposti ("ritirato (giro 1/13/25)"), età gomme esatte (es. NOR 14 al g.44 = pit al 30), finale ANT · LEC +2,0 · VER +11,7 |
| console | ✓ nessun errore JS; soli 404 attesi della pista SVG ("pista in arrivo") |

### Passi a mano che restano aperti (dal report della pipeline)

griglia f1db per Belgio (grids.json), pista SVG (`gen_pista_svg.py`), pitstops/race-control/
ufficiali alla prossima release f1db (`aggiorna_ui.py`), ricalcoli motore non automatici.

---

## FASE 1 — primo passaggio (storico): gara entrata NO

### Golden baseline PRIMA (tutti verdi)

| test | esito |
|---|---|
| `python3 test_b.py` (venv) | 449/449, max diff 4.26e-12, GOLDEN OK |
| `node test_b.mjs` | 449/449 sotto 1e-9, PASS |
| `node test_pit.mjs` (da demo/) | 11/11 |
| `node test_degrado_hook.mjs` | PASS (banda-zero invariante) |
| `node check_banda_gancio.mjs` | PASS |
| `node test_f1db_checksum.mjs` | invariato (03a22c6e…) |

Nota attesa: `test_b.py` ha riscritto `data/ref_traffic_py.json` **bit-identico** (worktree pulito).

### Esecuzione `aggiorna "Belgio" "Belgian Grand Prix" spa-francorchamps`

- Download OK: `data/ti_archive/2026/Belgian Grand Prix/Race.json` (227 KB, valido).
- **Guardrail 2 (dry-check): PASSATO** — gara asciutta.
- **Guardrail 1 (completezza): PASSATO** — 22 piloti, 44 giri, 17 piloti sull'ultimo giro.
- **Guardrail 3 (sanità): BLOCCO** — `tabella pace scarsa a metà gara (8 piloti)` (minimo 10).
  La pipeline è uscita PRIMA del checkpoint pre-pubblicazione: niente staging, demo/ intatta,
  nessun file di produzione toccato.

### Diagnosi del blocco (dati sani, guardrail campiona nel punto sbagliato)

Il guardrail valuta la tabella pace **esattamente a N//2 = giro 22**. La gara ha avuto una
neutralizzazione ai giri **17–21** (status con codice 6; vocabolario corrente: VSC/SC) con
**pit di massa**: 7 pit al giro 20, più 2+2+2+2+1 nei giri 15–19. Al giro 22, quattordici
piloti hanno lo stint corrente aperto da 1–4 giri → meno di 3 giri validi (regola del kernel
congelato) → pace assente. Conteggio pace per giro attorno alla soglia:

| giro | piloti con pace |
|---|---|
| 20 | 10 |
| 21 | 6 |
| 22 | **8 ← N//2, qui campiona il guardrail** |
| 23 | 12 |
| 24–30 | 20 |

Dal giro 24 la pace copre 20/20 piloti in gara: **i dati sono completi e sani**; il blocco è
un artefatto del campionamento puntuale a N//2 un giro dopo il restart. Non ho scavalcato:
per costruzione della pipeline "guardrail fallito → NON pubblicabile in automatico, serve
decisione umana", e la regola di domenica vieta di ricalibrare soglie a gara in corso.

**Decisione PO (arrivata)**: ingestione in deroga autorizzata, bypass una-tantum con
motivazione nel commit, soglia intatta. Eseguita — vedi il secondo passaggio in testa.

### Condizioni gara osservate (Spa è Spa: stavolta NON ha piovuto)

- **ASCIUTTA**: compound solo slick (HARD 558, MEDIUM 231, SOFT 83 giri); dry-check passato.
  Il confronto col tipico DRY 18,58 è quindi legittimo.
- Gara **SC-pesante**: SC in partenza giri 1–4 (codice 4; RUS ritirato al giro 1) e
  neutralizzazione giri 17–21 (codice 6) con la maggior parte dei pit dentro la finestra.
- **Conteggi**: 22 piloti, 44 giri, 30 eventi pin nel raw (inclusi i 5 pit al giro 1 sotto SC
  e i pit multipli di PER). Ritiri: RUS (giro 1), PER (giro 13, si ferma ai box), STR (giro 25).
  ALO ultimo giro 42, BOT 43 (doppiati). 17 piloti classificati a pieni giri.

### Anomalie di ingestione (da riportare)

1. **Il blocco sanità stesso** (sopra): primo caso reale in cui il campionamento a N//2
   incrocia un restart; il guardrail non distingue "dati corrotti" da "SC prima di metà gara".
2. **SPA_DOMENICA.md punto 2 sovrastima FF5**: dice che `gen_pitloss_pergara.py` "aggiunge le
   righe 2026 di Spa" a `pergara_stops.csv`, ma la lista `DEMO` del generatore committato ha 9
   circuiti e **Spa non c'è** (identico su `att6-v2-taratura`). Le righe Spa (storico 2018–2025,
   160 stop) vivono in `data/engine_ready_stops.csv` (FF4, che copre spa-francorchamps e
   SEASONS fino al 2026): per il GATE A la via "generatori committati" è **rieseguire FF4**,
   ed è quella usata. `demo/att6.mjs` ha il fallback esplicito su `engine_ready_stops.csv`.
3. Nessun'altra anomalia: download, dry-check e completezza puliti; golden invariati.

---

## GATE A — TIPICITÀ: mediana **22,50 s** → **NON GIUDICABILE**. STOP.

### Come è stato calcolato (provenienza)

1. Riesecuzione integrale di FF4 committato (`python3 gen_pitloss_engine_ready.py`):
   test bloccante Silverstone CONFERMATO (20,22 vs prod 20,80, |Δ|=0,58 ≤ 1,5) e CSV
   rigenerati **bit-identici ai committati** — riproducibilità verificata.
2. **Però FF4 non ha incluso Spa 2026**: `events_for` (FF3, committato) esclude gare con
   `EventDate >= TODAY` — e il GP del Belgio è **oggi** (2026-07-19, round 10). Condizione
   al contorno mai incontrata prima: il protocollo post-gara era sempre girato nei giorni
   successivi. Il generatore includerà Spa 2026 da domani, senza alcuna modifica.
3. La mediana è quindi calcolata in scratchpad **importando le funzioni committate**
   (`collect_whole_lap` da FF4, `classify` da FF3, cache condivisa): metodo engine-ready
   identico, zero modifiche ai generatori, zero scritture nei CSV committati.
   Riconciliazione esatta: 30 grezzi = 8 validi + 22 scarti.

### Il numero

| grandezza | valore |
|---|---|
| **mediana pit-loss gara (engine-ready, dry)** | **22,50 s** |
| banda di giudicabilità (tipico 18,58 ± 2,0) | [16,58 – 20,58] |
| fuori banda di | **+1,92 s** (sopra il bordo superiore) |
| scarto dal tipico 18,58 | +3,92 s (> soglia 2,0 anche per ATT6) |
| stop validi | **8** su 30 grezzi |
| pit lane time mediano | 24,42 s (grappolo storico: 23,15 — nessun cambio layout) |

Esclusi (riconciliati): **13 non_verde** (pit sotto SC/VSC — la finestra giri 17–21 in cui ha
pittato mezza griglia), **5 primo_ultimo** (i 5 pit al giro 1 sotto la SC di partenza),
2 no_timestamp, 2 stint_corto. Drive-through: 0. Meteo: **DRY** (frac_rain 0,0; compound 100%
slick) — la pioggia NON è la causa.

### Causa apparente dell'atipicità (non ha piovuto: è la forma della gara)

Gli 8 stop validi in dettaglio: LAW 18,47 · OCO 19,88 · GAS 20,28 · COL 20,72 (giri 14–16,
in banda o quasi) — poi BOT 24,28 · NOR 24,46 (lane 28,29) · ALO 27,99 · SAI 32,26 (lane
34,90). Due gare in una: i pochi stop verdi "normali" sono tipici, ma la coda è fatta di
stop individualmente lenti (servizio lento/coda in piazzola, si vede dai lane time) e con le
neutralizzazioni che hanno assorbito 18 stop su 30, il campione residuo è piccolo (n=8) e
la mediana cade proprio sul gradino tra i due gruppi (22,50 = media tra 20,72 e 24,28).
Gara SC-dominata, stesso profilo che a suo tempo fermò l'Australia.

### Verdetto da protocollo

**NON GIUDICABILE → STOP.** Né attivazione né rollback: Spa resta a **23,36**, il candidato
18,58 (che resta valido: grappolo 6 blocchi dry 18,09–19,25, IC95 [18,18–19,10]) aspetta la
prossima Spa. FINE della checklist per stasera.

---

## GATE B — ATT6 v1: — (chiuso per decisione PO)

GATE A = NON GIUDICABILE → per protocollo il GATE B non si apre. Confermato dal PO
all'autorizzazione della deroga: **la gara è dentro per completezza dell'archivio e per la
demo, non per giudicare il pit-loss.** (Ora che `demo/data/Belgio.json` esiste la tabella
sarebbe tecnicamente calcolabile: non è stata calcolata, e ogni futuro sguardo su Spa
ripartirebbe comunque dalla tipicità della gara che verrà.)

---

## GATE C — MICRO-ATTIVAZIONE: —

Non raggiunto (richiede GATE B + ok esplicito del PO). Spa resta a **23,36** in entrambe le
fonti (`demo/data/pitloss.json`, `data/pit_loss_circuito_f1db.csv` — checksum verificato).

---

## Golden a fine sessione (suite completa, dopo la pubblicazione)

`test_b.py` 449/449 (max diff 4.26e-12) · `test_b.mjs` 449/449 · `test_pit.mjs` 11/11
(nessun caso golden sul Belgio) · `test_degrado_hook` PASS · `check_banda_gancio` PASS ·
`test_f1db_checksum` invariato. `ref_traffic_py.json` riscritto bit-identico.
`pipeline_gara.py` nel commit = originale (bypass mai committato).

## Decisioni che restano al PO

1. **Merge di questo branch** (l'ingestione in deroga è committata qui, non mergiata).
2. **Guardrail sanità**: ticket per renderlo robusto alle SC a metà gara
   (es. campionare il miglior giro in una finestra attorno a N//2)? Da prereg.
3. **SPA_DOMENICA.md punto 2**: FF5 non copre Spa (lista DEMO a 9 circuiti) — la checklist
   per la prossima Spa va corretta (la fonte è FF4/`engine_ready_stops.csv`).
4. **`events_for` e il giorno-zero**: il filtro `>= TODAY` rende i generatori FF ciechi alla
   gara del giorno stesso. Rieseguendo FF4 da domani, Spa 2026 entra nel CSV senza modifiche.
5. **Passi a mano post-ingestione**: griglia f1db, pista SVG, pitstops/race-control alla
   prossima release f1db.
