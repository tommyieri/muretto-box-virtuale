# Muretto Box Virtuale — Memory & Istruzioni Progetto

> **Questo file è la sorgente unica.** `AGENTS.md` è un rimando a questo documento, non una
> copia: si aggiorna QUI. Fino al 17/08/2026 erano due copie identiche mantenute a mano.

## Profilo & Principi
- **Tommi**: Product Owner del progetto **Muretto Box Virtuale** (simulatore di strategia F1, analisi tecnica, live timing). Non legge codice direttamente: pretende rigore, verità numerica e trasparenza.
- **La fonte dati è la verità**: I dati derivano SOLO da **f1db / FastF1 / TI / OpenF1**, MAI trascritti a mano. Ogni valore in produzione deve avere generatore committato e nota di metodo.
- **Pre-registrazione obbligatoria**: I criteri di successo e le soglie di stop si fissano PRIMA dei numeri e si onorano sempre (nessun aggiustamento post-hoc).
- **L'assenza è una risposta** (regola 6): un dato che manca è `null` e si dichiara. Non esiste un ripiego che inventi un valore plausibile — un `|| 85.0` in fondo a un'espressione è un numero inventato con l'aria di un default.
- **Il DATO vive, il VERDETTO no**: gli artefatti si rigenerano a ogni gara; i cancelli e le decisioni restano fuori dal ciclo automatico e li riapre solo il PO.
- **Comunicazione**: Rigorosamente in italiano.

---

## Sentinella & Validazione Obbligatoria
Prima di chiudere ogni sessione o proporre merge, eseguire SEMPRE il comando unificato di validazione:
```bash
python3 sentinella.py
```
La sentinella esegue 11 verifiche:
1. Golden Motore JS (`test_b.mjs`, 443/443 casi, diff < 1e-9)
2. Golden Modulo Pit (`demo/test_pit.mjs`, 33/33 casi)
3. Hook Degrado & Banda-Zero (`test_degrado_hook.mjs`)
4. Checksum f1db (`test_f1db_checksum.mjs`)
5. Guard Anti-Travaso Pit-Loss (`test_guard_travaso.py`)
6. Coerenza Doppia Fonte Pit-Loss (`demo/data/pitloss.json` vs `data/pit_loss_circuito_f1db.csv`)
7. Sentinella Statistiche & Web UI (`demo/test_stat.mjs`, 0 link 404, livree al 100%)
8. Sigilli Numerici del Simulatore (`simulatore/gen_numeri_ereditati.py --verifica`)
9. Sentinella Consumo Orfani e File Archiviati
10. Sentinella What-If (`demo/test_whatif.mjs`) — i **numeri** di una pagina, non la sua esistenza
11. Sentinella Feedback (`demo/test_feedback.mjs`) — il **contratto**, la **condotta** e le **promesse** della buca delle segnalazioni

> **Il buco che la verifica 10 chiude.** Fino al 17/08/2026 nessuna delle nove guardava un
> numero prodotto da una pagina: la verifica 7 (`demo/test_stat.mjs`) controlla che una pagina
> esista, sia linkata e legga solo `demo/data/`, e dichiara di sé che «non apre un browser».
> Una pagina poteva quindi essere 100% verde e pubblicare numeri fabbricati — ed è successo.
> **Quando nasce una pagina che produce numeri, la sua sentinella nasce con lei.**

---

## Gli interruttori del motore — cosa è ACCESO e cosa è SPENTO
Verificato il 17/08/2026 leggendo `demo/vendor/simulatore/motore/contesto_live.json`, che è il
contesto che il kernel riceve davvero. **Non fidarsi della memoria: questo file è l'arbitro.**

| grandezza | stato | valore |
|---|---|---|
| Degrado ρ | ACCESO | 0,030776 s/giro · IC95 [0,0108; 0,0527] |
| Carburante δ₇₀ | ACCESO | 2,2 s su 70 kg (braccio A pre-registrato) |
| Vita mescola | ACCESA | SOFT 12 · MEDIUM 19 · HARD 22 giri |
| Vita mescola **per circuito** | **SPENTA** dal 04/08/2026 | placebo p=0,42, NULL su tutti i cancelli |
| Soglia di sorpasso | ACCESA | 0,6054 s/giro |
| Orizzonte validato della risposta | — | **6 giri** (non 10: `orizzonte_validato=10` sovra-dichiarava) |
| Tetto/cap del traffico nel modello di Fase 1 | SPENTO | `ZONE = 0` in `demo/passo.mjs`, com'è in produzione |

**DUE ρ CONVIVONO NEL REPO, ed è una trappola vera** (ci sono cascato riparando il What-If):
il **kernel** usa 0,030776 da `contesto_live.json`; il **modello simmetrico di Fase 1**
(`demo/passo.mjs`, `demo/golden_pit.json`) usa 0,038922 da `demo/data/modello_passo_2026.json`.
Non sono in conflitto: sono due modelli. La targhetta di una pagina deve citare il sigillo di
**chi ha fatto quel conto**, non uno scelto a mano.

---

## Rami CHIUSI — non riaprire senza dati o fonte NUOVI
Verdetti registrati, con la data. Ognuno è costato un ciclo intero: riaprirli senza un
ingresso nuovo è ripagare un conto già pagato.

- **Il circuito non è un predittore** — nove risultati indipendenti convergono. `cliff` e `tetto` chiusi NULL. Il guadagno viene dal pavimento uniforme, non dalla pista.
- **Il degrado non è per circuito** (0/8) **né per mescola** — sul 2026 le mescole non separano ρ: differenza −0,0075, IC95 che contiene lo zero, p(permutazione)=0,209.
- **Sorpassabilità intra-gara: CHIUSO.** Fuori campione su 78 gare: +0,3976 contro 0,40, mancato per 0,0024. L'associazione esiste (p=0,0003), la magnitudine no. **Nessun quarto tentativo.**
- **Traffico: la pista è NULL** — difficoltà-pista bocciata da placebo + stabilità + fuori campione; `M0 solo-gap` resta imbattuto.
- **Obiettivo del pianificatore: NULL** su tutte e tre le voci (traffico 8→7 giri, rivali comportamentali, obiettivo). La posizione al posto del tempo cambia 5 casi su 167, **tutti a Monaco**: NON spedito.
- **Terza forma (il capofila paga): SPENTA** — compatta il campo 3,5× meglio ma non muove il prodotto (p=0,72).
- **Il tetto non è sotto-tarato** — NULL su due strade: muovere di più non è muovere meglio.
- **Settori: NULL netto.** I microsettori **non esistono** nel grezzo: `ms1/ms2/ms3` sono codici di stato, non tempi.
- **Sotto-fermarsi: sei esclusioni.** «Una sosta» è robusta a ogni parametro (obiettivo, ρ, P, vita, SC, IC95 del ρ). La strada rimasta è **di prodotto** — mostrare `per_k` — non di modello.
- **Alla bandiera nessun motore batte il non-fare-niente.** «Vince il nuovo» regge a 2 giri (36-12, p=0,0007), ma sulla gara intera il motore e «non cambia niente» sono indistinguibili. È la ragione per cui il simulatore è **un gioco, non una previsione**, e va detto nelle pagine.
- **Undercut v2**: cancello 6.0 chiuso, prereg sigillato. **NO backtest.**
- **Mirror-play degenere**: `pianoOttimo` dà a TUTTI i rivali la stessa sosta — un grado di libertà per gara. Tentativo NON speso.

---

## Divieti operativi
- **La VSC è ANCORA ROTTA** (fattore 1,055): **nessuno ci costruisca sopra.** L'SC invece è risanata (1,11→1,61).
- **NON ricostruire la sentinella hash↔`?v=`**: Vercel serve `must-revalidate`, la deriva delle targhette è innocua e decorativa.
- **`f1-race-replay` è SENZA licenza** (all rights reserved): si legge come specifica, **non si copia**.
- **f1db NON è arbitro sulle soste** — perde 8 soste sul 2026. La definizione di sosta sta in **`demo/sosta.mjs`** ed è UNA: *cambio di set*, non transito in corsia (`in_lap` è un'altra cosa e resta un'altra cosa).
- **`data/difficolta_sorpasso.csv` è ORFANO e non fidato**: nessun generatore committato lo produce.
- **`live/` non si riattiva**: provato in campione e fuori — il feed parcheggia le auto su (−7447, −1830), che non è (0,0,0) e passa il filtro.
- **Non ricreare script scratch nella root** (`diag_*`, `patch_*`, `apply_patch.py`, `.bak2`): usa test formali o moduli dedicati.

---

## Decisioni APERTE — spettano al PO, non agli agenti
- **VETO McLAREN sul traffico live: APERTO.** L'aggancio è pronto e **spento** in `demo/engine.mjs`. Decide Tommi.
- **Scenari-degrado**: costruiti e calibrati, **OFF**. Accensione = PO.
- **Bozza «lift Mercedes»** nella redazione tecnica: in attesa di Tommi.
- **Social / Instagram**: il cancello umano è **SEMPRE chiuso**, a differenza della redazione. Niente pubblicazione automatica.

---

## Stato del Repository & File Chiave
- **File Archiviati**: `data/pit_loss_circuito.csv` è stato spostato in `data/archivio/` (insieme a `sc_safety_car.csv`, `neutralization_model_2026.csv`, `telemetria_proto_*`). Nessun codice vivo li consuma.
- **File Scratch**: Tutti i vecchi script `diag_*`, `patch_*`, `apply_patch.py`, `.bak2` sono stati rimossi.
- **Riproducibilità**: `data/_warmin_raw_multiyear.pkl` è tracciato per consentire a `finalize_warmin.py` di riprodurre `data/warmin_prior.csv` in modo deterministico e offline.
- **CI/CD**: `sentinella.py` è integrato nel workflow GitHub Actions [`.github/workflows/banco.yml`](.github/workflows/banco.yml).
- **Moduli a sorgente unica** — non reimplementarli a mano: `demo/sosta.mjs` (che cos'è una sosta), `demo/passo.mjs` (il modello simmetrico del tempo sul giro), `demo/ese.mjs` (ponte al kernel: `preparaGara`, `congelamentoPer`, `rigioca`), `demo/ese_vista.mjs` (`eseguiRigioca`, i due bracci), `demo/classifica.mjs`, `demo/orologio.mjs`, `demo/muro.mjs` (guscio, `dati()`, identità).
- **Quando cerchi perché qualcosa non si aggiorna, cerca il CHIAMANTE, non il generatore**: i generatori orfani esistono e sono già costati un ciclo.

---

## Avanzamenti Recenti (Cantieri Completati)
1. **Cantiere 1 (UX Sezione Analisi & Articoli Correlati)**:
   - `demo/analisi.html`: Nuova barra filtri a due livelli (Gara + Team & Tema) con pillole attive e conteggio dinamico.
   - `ai_lab/redazione/statico.py`: Generatore automatico della sezione `<section class="art-correlati">` in calce a ciascun articolo pre-renderizzato.
   - `demo/muro.css`: Stili responsive dark mode per `.art-correlati`, `.art-correlati-grid`, `.art-correlato-card`, e `.filtri-wrap`.
2. **Cantiere 2 (Rilevatori Telemetrici)**:
   - `ai_lab/redazione/genera_hun_frenata_trail.py`: Rilevatore telemetrico di staccata e trail-braking in ingresso curva, con fatti JSON e grafico SVG a barre.
   - `ai_lab/redazione/registro.py`: Registrato tra i generatori ufficiali e validato con `python3 ai_lab/redazione/test_redazione.py` (22/22 PASS).
3. **Cantiere 3 (Simulatore What-If)** — *spento e riscritto il 17/08/2026, **acceso da Tommi il 18/08/2026**.*
   - **Che cos'era andato storto.** Leggeva l'archivio come `gara[PILOTA][giro]`, mentre la forma vera è `laps[giro].cars[PILOTA]`: il menù dei piloti elencava i campi del file, nessun giro verde superava il filtro e il passo base cadeva sul ripiego `|| 85.0` (il giro vero a Ungheria è ~88,6 s), la posizione di rientro era sempre P1, la «sosta reale» era `metà dei giri`. Il degrado era un `0.0308` **battuto a mano** — arrotondamento del sigillo del kernel, quindi non un valore inventato ma una copia manuale, cioè la cosa esatta per cui esiste `simulatore/gen_numeri_ereditati.py`. Sotto quei numeri la targhetta diceva «misurato».
   - **La riparazione è di proprietà, non di aritmetica.** `demo/whatif.mjs` non calcola più un tempo sul giro: prepara gli ingressi e chiama il kernel vero (`ese.mjs` → `ese_vista.mjs::eseguiRigioca`), e rende quello che il motore risponde — verdetto del Simulation Director e assunzioni dichiarate compresi. **Nessuna costante di fisica vive in quel file**, e la targhetta legge il `contesto` che il kernel ha ricevuto.
   - **Il confronto è sim contro sim.** Due bracci dello stesso motore (la tua sosta contro la strategia vera), non simulato contro reale: altrimenti il numero somma l'errore del modello all'effetto della scelta e i due pezzi non si separano.
   - **Invariante sotto banco** (`demo/test_whatif.mjs`, verifica 10): sposta la sosta dove già era, con la mescola vera, e il delta deve essere 0 al miliardesimo. Verde su 6 casi in 4 gare.
   - **Stato: ACCESA** il 18/08/2026 per decisione di Tommi — in `PAGINE_FISSE`, in sitemap e nella sezione strumenti di `analisi.html`. Le voci W1/W2 del registro sono state **saldate**, non cancellate. Convive con il BOX ORA di `gara.html`/`live.html`, che resta il posto in cui la simulazione è dentro la gara; questa è la vista da tavolo, sulle gare già corse.

4. **Rete Multi-Agente di Audit & Innovazione (Antigravity IDE)** — *attiva dal 18/08/2026*:
   - Costruita l'architettura a 4 ruoli specializzati in `ai_lab/squadra/`:
     - `audit_simulatore.py`: Agente Inquisitore (stress testing, non-negatività, rientri box su 11 GP).
     - `audit_dati.py`: Agente Notaio (integrità fonti f1db, coerenza pit-loss, isolamento archivio).
     - `audit_web.py`: Agente Collaudatore (ispezione 11 pagine web, 0 broken link, guscio e sitemap).
     - `audit_squadra.py`: Orchestratore multi-agente che produce il report unificato per priorità (P0/P1/P2).
     - `agente_live_browser.mjs`: Collaudo live headless Chromium da browser reale su `https://murettobox.com`.
   - **Campagna di Super-Benchmark (2.175 simulazioni scientifiche)** completata con zero crash numerici.
   - **Diagnosi Telemetrica del Delta (What-If)**: integrata la spiegazione fisica lap-by-lap del delta tempo a schermo (anticipo/posticipo sosta, usura residua stint, finestre Safety Car/VSC e strategia multi-sosta reale).
   - Sentinella di validazione globale: **100% VERDE** — 10/10 allora; la verifica 11 e' nata il 18/08 con la sezione feedback.

5. **Cantiere 5 (Sezione Feedback)** — *nata il 18/08/2026, in vista del passaggio live.*
   - **A che serve.** Il sito sta per andare online e nessuno di noi lo usera' come lo usera'
     un estraneo: un difetto che il lettore vede e non puo' dire e' un difetto che per noi non
     esiste. `demo/feedback.html` + `demo/feedback.mjs` sono la porta di servizio, linkata dal
     **piede di ogni pagina** (`muro.mjs::guscio`) con `?da=<pagina>`, che e' l'unico pezzo di
     contesto raccoglibile senza chiederlo, piu' un **richiamo in fondo alla home**. La voce NON
     entra nella barra in alto: quella e' il sommario di cosa il sito racconta, e questa non e'
     una sezione da leggere.
   - **Il richiamo in home non porta un `h2.sezione-t`**, e non e' una scelta di stile: lo
     script di `index.html` cancella `.sezione-t:last-of-type` quando non ci sono articoli, per
     non lasciare un titolo senza elenco. Un titolo di sezione messo li' sotto diventerebbe lui
     l'ultimo e sparirebbe al posto di «Articoli». Il titolo sta dentro la piastra.
   - **Dove atterrano.** `demo/api/feedback.js`, seconda funzione serverless del progetto, sullo
     **stesso Upstash Redis** di `contatore.js` (verificato attivo in produzione il 18/08). Si
     leggono con `python3 leggi_feedback.py` (`--tutte`, `--fatto <id>`).
   - **DA FARE PRIMA CHE SERVA: impostare `FEEDBACK_CHIAVE`** fra le variabili d'ambiente del
     progetto su Vercel, e la stessa in `~/.muretto_env`. Senza, la scrittura funziona e **la
     lettura risponde 503**: la buca raccoglie e nessuno la apre.
   - **La privacy non e' una promessa, e' un controllo.** Qui entra testo scritto da una persona
     e puo' entrare un'email: la pagina mostra in chiaro l'elenco esatto dei campi che partono,
     costruito dallo stesso oggetto che finisce nella fetch (non puo' divergere); l'IP non e' mai
     a riposo (impronta `sha256(chiave+ip)` con scadenza a un'ora, solo per il tetto anti-robot);
     la lettura e' chiusa a chiave. `demo/test_feedback.mjs` fa girare l'endpoint contro un finto
     Upstash e **cerca gli IP di prova in tutto cio' che resta scritto**.
   - **L'unico punto muto del sistema, e il suo strumento.** L'esca anti-robot (`campo_x`,
     fuori schermo) e' l'unica cosa che puo' scartare una persona vera senza che lei lo sappia:
     chi ci finisce vede una ricevuta normale — e deve vederla, perche' un id diverso
     insegnerebbe al robot a riconoscersi. Percio' ogni scatto si **conta** (`muretto:fb:esca`)
     e `leggi_feedback.py` lo mostra in testa: se quel numero cresce come i totali, l'esca va
     tolta. Un filtro silenzioso senza un contatore e' un difetto che non si scopre mai.
   - **Il fallimento si dice.** Se l'invio non riesce, la pagina dichiara «Non e' arrivata» e
     restituisce il testo: un modulo che ringrazia comunque manda via la persona convinta di
     aver segnalato, e il difetto resta. E' la regola 6 applicata a un modulo.
   - **Riallineato per strada un difetto preesistente**: i due modelli di
     `ai_lab/redazione/statico.py` (404 e articoli) portavano ancora il marchio vecchio — uno
     col rosso `#e80d2e` di prima del 17/08. Il commit sul marchio aveva aggiornato le pagine
     scritte a mano e non i generatori: al primo `--indici` il 404 tornava indietro in silenzio.
     Corretta la sorgente e rigenerati i 12 articoli (`--tutto --senza-og`): una riga a file.
   - **Due difetti veri trovati guardando la pagina, non leggendola**: `.vuoto` e' gia' una
     classe di `muro.css` (riquadro di stato vuoto, padding 34px) e la riga senza valore
     ereditava 68 px — le regole di pagina ora portano il prefisso `fb-`; e il blocco della
     trasparenza si ridisegna anche al `resize`, altrimenti bastava girare il telefono perche'
     dichiarasse una misura e ne partisse un'altra.

---

## Co-working tra Agenti (Claude Code / Antigravity IDE)
- Il codice e Git sono l'unico punto di verità condiviso.
- **Questo file è la sorgente; `AGENTS.md` ci rimanda.** A ogni avanzamento significativo o modifica strutturale si aggiorna QUI, e basta: non esiste più una seconda copia da tenere in pari.
- **Un verdetto senza data non è un verdetto.** Quando aggiungi una riga ai rami chiusi o agli interruttori, scrivi *quando* e *su che cosa* è stata misurata: le sezioni sopra si leggono anche fra sei mesi, e uno stato «acceso» senza data invecchia in silenzio.

