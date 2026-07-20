# RUNBOOK — aggiungere una gara alla demo e metterla online

*Nato come "runbook Spa" (19/07/2026, ultima gara col processo a mano). Riscritto dopo il
Belgio: il passo "un comando solo" (`aggiorna_ui.py`) NON copre tutto, e f1db esce in
DUE tempi. Qui c'è la sequenza COMPLETA, con il Belgio come esempio. Vale per ogni gara.*

> **La regola d'oro (imparata col Belgio)**: `aggiorna_ui.py` copre calendario, classifiche,
> schede, pitstops, foto, pista — e basta. Race control, doppia vista ufficiale e griglia
> sono passi SEPARATI, e i loro generatori hanno la **lista gare scritta a mano dentro**:
> vanno estesi alla gara nuova ogni volta (finché non li si automatizza). E i dati f1db
> (standings, durate pit-lane, griglia) arrivano solo con la **release f1db post-gara**,
> che di norma NON esiste ancora la sera della gara → si lavora a **due passaggi**.

---

## Prima di iniziare (2 min)

- [ ] `cd ~/muretto && git checkout main && git pull` — albero pulito, main aggiornato
- [ ] Ambienti (SETUP_AMBIENTE.md): kernel/analisi → `.venv` · generatori FastF1/f1db
      (pista, race control, ufficiali) → `python3` utente (fastf1 NON è nel venv)
- [ ] Cache FastF1: `~/muretto_shared/ff1_cache/` presente

---

## PASSAGGIO 1 — la sera della gara (release f1db PRE-gara)

La gara entra, va online, e mostra tutto ciò che viene da **FastF1** (immediato). Ciò che
viene da **f1db** (standings, durate pit-lane, griglia) resta al round precedente: normale,
si chiude al Passaggio 2. Sostituisci `<Nome>` `<Cartella TI>` `<cid>` (es. Belgio /
"Belgian Grand Prix" / spa-francorchamps).

### A. La gara entra nella demo ⏱
1. `python3 pipeline_gara.py scopri` — la gara nuova deve comparire
2. `python3 pipeline_gara.py aggiorna "<Nome>" "<Cartella TI>" <cid>`
   — guardrail automatici (dry-check: se **bagnata** SI FERMA → decisione umana esplicita).
   **CHECKPOINT 1**: leggi riepilogo + report, controlla esiti a occhio, scrivi `pubblica`.
   - Il pit-loss nel json riceve il **tipico dal CSV** (es. Spa 23,36): è ATTESO.
   - Se un guardrail dà un **falso positivo** noto (es. pace-a-N//2 con SC a metà gara):
     NON toccare la soglia; serve deroga esplicita del PO, motivata nel commit.

### B. UI, il comando (parziale) ⏱
3. `python3 aggiorna_ui.py --gara "<Nome>"`  → calendario+orari, classifiche, schede,
   pitstops, foto, **pista** (con corridoio pit). Idempotente: in dubbio rilancialo.
   - Al Passaggio 1 classifiche/schede/pitstops si **rigenerano ma restano al round
     precedente** (release f1db pre-gara): giusto così. La UI dichiara "aggiornato al GP di
     …" (classifiche.html) — la nota si sposta da sola al Passaggio 2.

### C. Race control (FastF1) — passo SEPARATO, lista gare a mano
4. Aggiungi la gara alla lista `GARE` in **`gen_race_control.py`** e a `EVENTI` in
   **`gen_classifiche_ufficiali.py`** (una riga ciascuno, es. `('Belgio','Belgian Grand Prix')`).
5. `python3 gen_race_control.py` → `python3 gen_rc_feed.py`
   (feed timeline + badge penalità di tempo). Verifica: la gara compare con le sue tacche.
6. `python3 gen_classifiche_ufficiali.py` → `ufficiali_2026.json` (doppia vista
   "in pista | ufficiale"). RC2 (`verifica_rc2.py`) è diagnostica, non tocca la demo.

### D. Golden + online ⏱
7. Golden: `node test_b.mjs` · `cd demo && node test_pit.mjs` · `node test_degrado_hook.mjs`
   · `node test_f1db_checksum.mjs` (+ `.venv/bin/python test_b.py` se hai toccato il kernel).
8. `git add/commit/push` su main → Vercel. **CHECKPOINT 2**: apri
   `muretto-box-virtuale.vercel.app`, verifica in PRODUZIONE (non solo in locale):
   stagione (gara corsa col vincitore, hero sulla prossima), pagina-gara (pista, replay
   giro coi pit di massa, badge SC/VSC, doppia vista), classifiche.
   - Cache: i JSON dati sono fetchati **senza `?v=`** (il bump `BUILD` copre solo i `.mjs`).
     Un browser può servire un JSON vecchio dopo il deploy → in caso, forza la
     rivalidazione. Su Vercel gli header rivalidano; se il PO vuole `?v=` anche sui dati è
     una modifica UI a parte.

---

## PASSAGGIO 2 — quando esce la release f1db POST-gara

f1db pubblica la release col round nuovo qualche ora/giorno dopo (es. Belgio round 10 →
`v2026.10.0`). Chiude standings, durate pit-lane e griglia.

1. **Verifica PRIMA di pinnare** che la release abbia davvero la gara: scarica lo zip e
   controlla che esistano righe per il `raceId` della gara in
   `f1db-races-starting-grid-positions.csv`, `-pit-stops.csv`, `-race-results.csv`,
   `-driver-standings.csv`. Solo se ci sono →
2. Aggiorna `RELEASE` in **`f1db_zip.py`** (es. `v2026.9.1` → `v2026.10.0`).
3. `python3 aggiorna_ui.py --gara "<Nome>"` → ora classifiche al round nuovo, `pitstops`
   con le durate della gara (→ "pit lane: X s" in pagina), schede aggiornate.
   - `pista_<Nome>.json` può cambiare il solo metadato `sorgente.sessione` ('Race'↔'R'):
     **geometria bit-identica = innocuo**.
4. **Griglia** (`grids.json`) — a mano ma verificata: estrai l'ordine da f1db per il
   `raceId` e **incrocialo con FastF1** (`session.results` GridPosition). Deve fare
   **22/22**; occhio a GridPosition=0 (partenza dai box). Aggiungi la voce a `grids.json`
   nello stile per-riga. Verifica: al **via esatto** (giro 1, p=1) l'ordine = griglia,
   con la POLE giusta. (I giri successivi mostrano l'ordine di marcia, non la griglia.)
5. **Raccolta undercut** (gare 10+): `python3 conta_undercut.py --gara "<Nome>"` → file
   per-gara separato, storico intatto. Richiede che la gara passi il dry-check COMPLETA
   (soglia `max_lap >= 40` in `drycheck_2026.py`, allineata al guardrail della pipeline;
   una gara "corta" ma piena — Spa 44 — passa). Esito **0 casi è legittimo** (U6 esclude i
   percorsi che toccano SC/VSC).
6. Golden + `git add/commit/push` → Vercel → verifica in produzione le NOVITÀ del passaggio:
   classifiche al round nuovo, "pit lane: X s" sui pit, giro-1 in ordine griglia.

---

## Cosa `aggiorna_ui.py` NON fa (da fare a mano, ogni gara)

- **race control / ufficiali** (passi C4–C6): lista gare hardcoded nei due generatori.
- **griglia** `grids.json` (Passaggio 2, punto 4): estrazione f1db + cross-check FastF1.
- **griglia di partenza in pista**: senza griglia il giro 1 è ordinato sui tempi reali.
- ricalcoli motore (degrado, warm-in, profili), metodo pit-loss, telemetria: fuori scopo,
  sempre a mano, elencati sotto "DA FARE A MANO" nel report della pipeline.

*Candidati ad automazione (attriti ricorrenti): la lista gare dei due generatori RC/uffic.
dovrebbe derivare dal registro, non essere a mano; e un check che avvisi quando esce la
release f1db col round nuovo eviterebbe di ricordarsi il Passaggio 2.*

---

## FASE B — pit-loss realizzato e attivazione (opzionale, protocollo suo)

Solo se si vuole rivedere il pit-loss del circuito col realizzato della gara. Resta un
percorso a sé (prereg FF5 + protocollo Silverstone), con verdetto e merge del PO.

7. Misura: `python3 gen_pitloss_pergara.py` (python3 utente)
8. Classificazione (prereg FF5): n≥5 e |realizzato − tipico| > 1,0 s → DA ATTIVARE
9. Se DA ATTIVARE: `node demo/att6.mjs <cid> 2026 <realizzato>` — tre righe di sintesi:
   - NON GIUDICABILE → il circuito resta al tipico, il candidato aspetta. Fine.
   - Caso sensibile PEGGIORATO → non si attiva finché non è spiegato.
   - Nessun peggioramento sensibile → attivazione possibile.
10. Attivazione (protocollo Silverstone): tag rollback → golden-delta PRIMA →
    `pitloss.json` (solo il circuito) + `pitloss_meta.json` (tipico→realizzato) →
    `gen_golden_pit.mjs` (da `demo/`) → suite completa (test_b · test_pit · hook · banda ·
    checksum f1db · test_guard) → NOTA + branch + PR.
11. **CHECKPOINT 3 — il merge. È del PO.**

---

## Se qualcosa non torna

Fermarsi e scrivere la sorpresa è sempre un esito accettabile. Non attivare = il circuito
resta al tipico, il candidato non scade. Rollback = reset al tag. Le soglie fisse non si
toccano a gara in corso: se una dà un falso positivo su una gara-limite (Spa: guardrail
N//2, `>= TODAY` dei generatori FF, drycheck ≥ giri), serve deroga PO motivata nel commit.
