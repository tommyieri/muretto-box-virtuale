# REPORT PUBBLICAZIONE BELGIO — 19/07/2026 sera

**P0 merge: già fatto (PR #52 → main `8a9f58e`, merge del PO ore 16:55Z) | P1 UI: calendario,
pista Spa, pitstops-meta; classifiche/schede ferme a GB (release f1db pre-Belgio, dichiarato
a layout) | gap dichiarati: durate pit lane, griglia, standings post-Belgio → prossima release
f1db | P3 deploy: OK (commit `90879f3`, Vercel success) | verifica in produzione: OK
(stagione, pagina Belgio con replay g.21, classifiche — dettagli in P3)**

Sessione di sola pubblicazione: nessun motore, nessun valore, nessuna analisi.
Spa resta **23,36** (GATE B chiuso).

---

## P0 — Stato del repo

- **Merge: già fatto dal PO** — PR #52 MERGED alle 16:55Z, merge commit `8a9f58e`.
  Verificato su main: `demo/data/Belgio.json` presente, manifest a **10 gare**.
- **Golden su main: verdi** — test_b.py 449/449 (4.26e-12), test_b.mjs 449/449,
  test_pit 11/11, test_degrado_hook PASS.
- **Meccanismo Vercel accertato PRIMA di pushare**: nessun `vercel.json` nel repo → config
  lato dashboard; il deploy parte dal **push su `main`** (documentato in
  `COME_AGGIUNGERE_UNA_GARA.txt` passo 4 e `runbook_spa.md` passo 5: "git push → Vercel fa
  il resto"). Root del progetto = `demo/` (la serverless `demo/api/contatore.js` risponde a
  `/api/contatore` e le pagine stanno a `/gara.html` ecc. — confermato in produzione).
  Sito statico, nessun build step.

## P1 — Generatori UI (`aggiorna_ui.py --gara Belgio`)

Tutti i passi OK; eseguito **tre volte: 2° e 3° giro bit-identici su tutti e 7 gli
artefatti → idempotente** (confronto `cmp` byte-per-byte).

| passo | esito |
|---|---|
| calendario | round 10 → `gara_demo: Belgio`, vincitore **ANT / Mercedes**; prossima gara senza vincitore = **GP d'Ungheria** |
| classifiche | rigenerate INVARIATE: standings f1db **fermi al round 9 (GB)** — la release post-Belgio non esiste ancora; **mai calcolate a mano**. La dichiarazione visibile c'è già a layout: classifiche.html mostra "aggiornato al **GP di Gran Bretagna** · 5 luglio" |
| schede | idem (fonte standings f1db, invariate) |
| pitstops | dati invariati (9 gare, niente durate Belgio — f1db pre-gara); cambia solo il campo `aggiornato_al` → "GP del Belgio" (deriva dal calendario demo, non dalla copertura f1db: piccola etichetta fuorviante nel JSON, **non mostrata in UI** — solo classifiche.html rende un `aggiornato_al`) |
| foto | no-op (22 già presenti) |
| pista | **`pista_Belgio.json` NUOVO**: il generatore usa la **telemetria GPS FastF1** (giro più veloce pulito: NOR giro 44, 108,89 s, 435 campioni, 6.947,6 m), non un circuitLayoutId f1db; **corridoio pit sintetico generato** (stilizzato, 60 punti, ingresso frazione 0,95 / uscita 0,05) |

**Nota hero/countdown**: la selezione in `stagione.html` è **per data** (`data >= oggi`,
badge "oggi" previsto a layout): stasera la hero mostra ancora "GP del Belgio — oggi" e
passa **da sola** all'Ungheria a mezzanotte. Il dato calendario sottostante è già corretto
(Belgio corsa col vincitore; prima gara futura = Ungheria). Non ho toccato la UI: se il PO
preferisce una hero winner-aware la sera stessa della gara, è una modifica di layout da
decidere a parte.

## P2 — Verifica locale completa (server su main, browser)

| controllo | esito |
|---|---|
| calendario/stagione | ✓ R10 Belgio "ANT VINCITORE" nella griglia stagione; campionato P1 ANT 179 (pre-Belgio, dichiarato); hero su Belgio-oggi (nota sopra) |
| pagina Belgio — header | ✓ "19 luglio 2026 · 44 giri · asciutta · **vince ANT** · pit-loss 23,36 TIPICO" |
| pista con pallini | ✓ tracciato Spa da GPS, 20 pallini con sigle; al giro 21 HAD e BOR (badge BOX) transitano sul corridoio pit stilizzato |
| replay spot check | ✓ giro 20–21: badge VSC + banner, BOX/OUT tempificati (ALO g.20; HAM/LEC/PIA/BEA/BOR/HAD/HUL g.21), "monta hard"; SC g.1–4; finale **ANT · LEC +2,0 · VER +11,7** |
| strategie | ✓ 22/22 piloti in strip con colori mescola (medium/hard/soft, SAI partito soft; RUS/PER barre corte da ritiro) |
| esplorazione pit | ✓ "SE NOR PITTA ADESSO", rivali congelati, slider, **pit-loss +23,4 s** (= 23,36), rientro P5/10 a pari giro, avviso "pit in finestra VSC (17–21): il pit-loss verde sovrastima", gap n/d sotto neutralizzazione, legge del replay (pallini spenti) |
| gap noti | ✓ nessun "pit lane: X s" per il Belgio (f1db pre-gara, la UI non stima mai) |
| console | ✓ pulita (con la pista presente spariti anche i 404 attesi di ieri) |

## P3 — Deploy

- Commit `90879f3` su main (calendario ×2, pitstops-meta, pista_Belgio.json) + push.
- **Deploy Vercel: SUCCESS** (seguito via GitHub Deployments fino allo stato `success`;
  nessun build step, sito statico da `demo/`).
- **Verifica in produzione** su `muretto-box-virtuale.vercel.app` (contenuto fresco al primo
  colpo, nessun problema di cache):
  - `stagione.html`: R10 Belgio "**ANT VINCITORE**", R11 Ungheria "IN CALENDARIO",
    campionato P1 ANT 179 (pre-Belgio, come dichiarato); hero su "GP del Belgio — oggi"
    (comportamento a layout, passa all'Ungheria a mezzanotte — nota in P1);
  - `gara.html?g=Belgio`: header "vince ANT · pit-loss 23,36 TIPICO", **pista Spa
    disegnata**, replay al giro 21 con banner VIRTUAL SAFETY CAR e badge BOX/OUT identici
    al locale (ALO:OUT, BOR:BOX, HAD:BOX, HAM/LEC/PIA:OUT), finale **ANT · LEC +2,0 ·
    VER +11,7**, nessun "pit lane: X s" (gap atteso);
  - `classifiche.html`: nota visibile "**aggiornato al GP di Gran Bretagna · 5 luglio**".

## Secondo giro — checklist runbook completata (richiesta PO: "aggiorna tutto")

Ricontrollata la checklist di progetto (`runbook_spa.md` FASE A + `COME_AGGIUNGERE_UNA_GARA.txt`):
al primo giro mancavano i passi fuori da `aggiorna_ui.py`. Eseguiti ora:

| voce | esito |
|---|---|
| race control (FastF1) | ✓ Belgio aggiunto a `GARE` in gen_race_control.py → CSV rigenerato → `gen_rc_feed.py`: **feed 20 tacche, badge HAM +5s** (giro 9, causing a collision); verificato in pagina (tacche + badge + tooltip) |
| classifiche ufficiali (FastF1) | ✓ Belgio aggiunto a `EVENTI` in gen_classifiche_ufficiali.py → `ufficiali_2026.json`: 22 classificati, vince ANT; **doppia vista attiva** con badge penalità nella riga HAM |
| griglia (runbook passo 4) | ✓ **Gran Bretagna** (coda arretrata dal 5/07): estratta da f1db v2026.9.1 e **verificata incrociata con FastF1 (22/22 match)** → grids.json 8→9 gare; giro 1 GB ora in ordine griglia. **Belgio: NON possibile** — la release f1db più recente è v2026.9.1 (6/07, pre-Belgio); si aggiunge con la prossima release |
| undercut (runbook passo 6) | ✓ **SBLOCCATO con ok PO e eseguito**: soglia COMPLETA di `drycheck_2026.py` portata 50→40 (allineata al guardrail completezza della pipeline; motivazione nel criterio dichiarato e nel commit). Impatto misurato prima/dopo: nel censimento cambia SOLO Belgian Race (INCOMPLETA→OK, 13/14 utilizzabili; Canada resta BAGNATA). Raccolta: **0 casi undercut validi, 8 rivali-entro-soglia di riferimento** → `data/undercut_casi_gara_Belgio.json` (storico e 2026 NON toccati). Esito vuoto LEGITTIMO, non un buco: U6 esclude percorsi che toccano SC/VSC, e a Spa i pit verdi 12–16 hanno la finestra di risposta dentro la VSC 17–21, mentre i tardivi (25–32) sono stop isolati |
| idempotenza | ✓ gen_race_control + gen_rc_feed + gen_classifiche_ufficiali rieseguiti: output bit-identici |
| classifiche/statistiche f1db | invariate per costruzione: release f1db più recente = v2026.9.1 pre-Belgio (verificato su GitHub releases); standings restano a GB con nota a layout |

Nota cache locale emersa (utile anche per capire la produzione): i JSON dati sono fetchati
senza `?v=` (il bump `BUILD` copre solo i moduli .mjs) → il browser può servire dalla cache
euristica un JSON vecchio dopo un aggiornamento. In locale risolto con revalidation; su
Vercel gli header fanno rivalidare, ma è un punto da tenere d'occhio (eventuale `?v=` anche
sui dati = decisione UI del PO).

## Terzo giro — release f1db post-Belgio (v2026.10.0, uscita 19/07 ore 18:47Z)

Chiuse tutte le code che aspettavano la release f1db con dentro il Belgio. Pin aggiornato
in `f1db_zip.py` (v2026.9.1 → **v2026.10.0**, raceId Belgio 1159 round 10; verificato PRIMA
del pin che contenesse griglia/pit-stop/risultati/standings del Belgio).

| voce | esito |
|---|---|
| standings campionato | ✓ `aggiorna_ui.py --gara Belgio` → classifiche al **round 10**: ANT 204 (era 179, +25 dalla vittoria), HAM sale P2 159, RUS P3 154, LEC 126, NOR 103. Nota UI "aggiornato al" ora punta a **GP del Belgio** |
| durate pit lane | ✓ `pitstops_2026.json` ora include Belgio (28 stop, transito pit-lane ~22–25 s, coerente col tipico 23,36; es. ANT 23,09 g.18) → in pagina compare "pit lane: X s" |
| schede pilota | ✓ statistiche al round 10 (ANT: 10 gare, 6 vittorie, ultima "Belgium 2026-07-19") |
| **griglia Belgio** (runbook passo 4) | ✓ estratta da f1db v2026.10.0 e **verificata incrociata con FastF1 (22/22 match, nessuna partenza dai box)** → grids.json 9→10 gare; giro 1 Belgio ora in ordine griglia (ANT, VER, RUS, LEC, HAM…) |
| pista_Belgio.json | cambia SOLO il metadato `sorgente.sessione: 'Race'→'R'`; geometria (500 punti, dist, viewBox, lunghezza, corridoio pit) **bit-identica** — innocuo |
| idempotenza | ✓ `aggiorna_ui.py` rieseguito: classifiche/pitstops/schede/calendario bit-identici |
| golden | ✓ test_b.py 449/449 (4.26e-12), test_b.mjs 449/449, test_pit 11/11, hook PASS, checksum f1db invariato |

Restano da rigenerare al passaggio di release **solo** se f1db aggiornerà i documenti FIA
post-gara del Belgio in una release successiva (penalità post-gara oltre l'annuncio RC): al
momento race control e ufficiali sono già completi dalla fonte FastF1.

## Chiusura

- **Golden verdi** a ogni passaggio; motore mai toccato.
- Nessun verdetto strategico: Spa 23,36, candidato 18,58 in attesa della prossima Spa.
- Il Belgio è ora **completo** in demo: dati gara, pista, griglia, pit-lane durate,
  race control, doppia vista ufficiale, standings al round 10.
