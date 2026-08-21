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
La sentinella esegue 13 verifiche:
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
12. Sentinella Formazione (`test_formazioni.py`) — **chi guida che cosa, round per round**: l'invariante forte è che la formazione risolta al round di una gara già pubblicata coincida con le squadre scritte dentro i suoi file (1.172 attribuzioni su 55 sessioni)
13. Sentinella Lingua (`demo/test_lingua.mjs`) — le **due colonne** del dizionario, ogni chiave usata che esiste e ogni chiave dichiarata che è usata, l'inglese delle pagine uguale a quello del dizionario, il selettore montato dal guscio, e **nessun italiano di contrabbando** nei sorgenti vivi

> **Il buco che la verifica 13 chiude.** Un testo non è un numero e sbaglia in un modo
> tutto suo: in silenzio. Una chiave mai messa nel dizionario non fa cadere niente —
> `t()` restituisce la chiave e la pagina mostra `strat.quando_fermarsi` a un lettore
> vero. Un inglese cambiato nell'HTML e non nel dizionario non fa cadere niente: da quel
> giorno il sito dice due cose diverse a due lettori diversi. **Nessuno dei due è un
> errore di programma**, e nessuna delle dodici verifiche precedenti li poteva vedere.

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
- **`demo/data/teams.json` NON si modifica a mano**: dal 19/08/2026 è un derivato di `gen_formazioni.py` (base = `team_demo` degli standings f1db, deroghe dichiarate in `data/formazione_deroghe_2026.json`). Un cambio di sedile si scrive **nelle deroghe, con il round**, mai nella mappa piatta: la mappa non ha l'asse del tempo e correggerla riscrive anche le gare già corse al primo `gen_giri.py --forza`.
- **`live/` non si riattiva**: provato in campione e fuori — il feed parcheggia le auto su (−7447, −1830), che non è (0,0,0) e passa il filtro.
- **Nell'HTML non si scrive italiano**: dal 19/08/2026 la sorgente del sito è l'inglese. Un testo italiano scritto a mano in una pagina non lo tradurrà mai nessuno, perché nessuno sa che c'è — e la verifica 13 lo trova, con la frase in chiaro. Vale anche per i nomi delle variabili: **`t` è la funzione che traduce**, e una locale con quel nome la spegne in silenzio.
- **Non ricreare script scratch nella root** (`diag_*`, `patch_*`, `apply_patch.py`, `.bak2`): usa test formali o moduli dedicati.

---

## Decisioni APERTE — spettano al PO, non agli agenti
- **VETO McLAREN sul traffico live: APERTO.** L'aggancio è pronto e **spento** in `demo/engine.mjs`. Decide Tommi.
- **Scenari-degrado**: costruiti e calibrati, **OFF**. Accensione = PO.
- **Bozza «lift Mercedes»** nella redazione tecnica: in attesa di Tommi.
- **Monza (round 13): la formazione è APERTA.** La deroga d'Olanda ricade sul **solo round 12**. Se Hadjar non recupera, serve una **nuova voce dichiarata** in `data/formazione_deroghe_2026.json` con i round giusti: nessun automatismo la scrive, ed è giusto così.
- **Social / Instagram**: il cancello umano è **SEMPRE chiuso**, a differenza della redazione. Niente pubblicazione automatica.

---

## Stato del Repository & File Chiave
- **File Archiviati**: `data/pit_loss_circuito.csv` è stato spostato in `data/archivio/` (insieme a `sc_safety_car.csv`, `neutralization_model_2026.csv`, `telemetria_proto_*`). Nessun codice vivo li consuma.
- **File Scratch**: Tutti i vecchi script `diag_*`, `patch_*`, `apply_patch.py`, `.bak2` sono stati rimossi.
- **Riproducibilità**: `data/_warmin_raw_multiyear.pkl` è tracciato per consentire a `finalize_warmin.py` di riprodurre `data/warmin_prior.csv` in modo deterministico e offline.
- **CI/CD**: `sentinella.py` è integrato nel workflow GitHub Actions [`.github/workflows/banco.yml`](.github/workflows/banco.yml).
- **Un articolo non si traduce a mano.** Lo fa `ai_lab/redazione/traduci.py`, chiamato da `coda.py` alla pubblicazione, e la sua traduzione entra in pagina **solo** se porta gli stessi numeri dell'originale, uno per uno. Se la guardia boccia, l'articolo resta italiano e lo dichiara: è un esito, non un guasto. Ritradurre a mano un campo `en` nel JSON aggira il cancello — e la verifica 13 se ne accorge, perché la guardia la rifà su ciò che è committato.
- **La lingua sta in due file, e non si reimplementa**: `demo/lingua.mjs` (qual è la lingua attiva, come si cambia, `t()`/`tn()`, `applica()`) e `demo/dizionario.mjs` (le due colonne). Il **selettore** lo disegna `demo/muro.mjs::selettoreLingua`, perché è un pezzo del guscio e riusa la tendina che la barra ha già. Un testo nuovo in pagina nasce **in inglese con la sua chiave accanto**; l'italiano si aggiunge nella seconda colonna, mai nell'HTML.
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

6. **Cantiere 6 (Formazione round-per-round)** — *nato il 19/08/2026 col primo cambio di sedile a stagione in corso.*
   - **L'ingresso.** Red Bull schiera **Lawson** al posto di **Hadjar** (infortunio al polso) per il **solo GP d'Olanda** (round 12, 23/08); **Tsunoda** rientra in **Racing Bulls** accanto a **Lindblad**. Annuncio stampa riportato dal PO: **non è una misura**, nessun artefatto del progetto lo contiene al 19/08.
   - **Che cosa era rotto, e non era il dato.** `demo/data/teams.json` era una mappa **piatta** sigla→squadra, scritta a mano una volta (commit `2921a69`) e **senza generatore** — `gen_stat_identita.py` la elencava per iscritto fra le fonti orfane. `gen_giri.py` la rileggeva **tale e quale per ogni sessione di ogni gara**: correggerla per la gara in arrivo sarebbe stato giusto al round 12 e **falso agli undici già corsi**. Il danno non si vede il giorno in cui lo fai — si vede al primo `gen_giri.py --forza`, mesi dopo, con Lawson pilota Red Bull a Budapest.
   - **La riparazione è l'asse del tempo.** `gen_formazioni.py` scrive `demo/data/formazioni_2026.json` (formazione **round per round** + provenienza con sha256 delle fonti) e ne deriva `demo/data/teams.json` come `per_round[round_corrente]`, **nella forma che i suoi due consumatori avevano già** (nessuna pagina è stata toccata). La **base** viene da `team_demo` degli standings f1db, non trascritta; le **deroghe** stanno in `data/formazione_deroghe_2026.json`, scritto a mano **e dichiarato tale** come `demo/team_colori.json`, ogni voce con data, fonte, motivo e **perimetro di round**.
   - **Mappa e schieramento non sono la stessa cosa.** `per_round` dice a che squadra **appartiene** una sigla; `schieramento_per_round` dice chi **scende in pista**. Hadjar al round 12 sta nella prima e non nella seconda: è **infortunato, non ceduto** — ed è anche ciò che rende la deroga innocua se recupera all'ultimo, perché la sua livrea resta giusta comunque.
   - **`gen_giri.py` chiede la formazione al round della sessione** e **dice** (stderr) quando una sigla in pista non è nella formazione: un rookie in FP1 o un sostituto non dichiarato non prende più il grigio di riserva in silenzio. `gen_formazioni.py` è agganciato in `auto_gara.py` **prima** di ogni `gen_giri.py` (4 punti) e dopo `gen_classifiche.py`.
   - **Un difetto vero trovato per strada, e riparato.** La vecchia `teams.json` diceva «Haas», `team_colori.json` è indicizzato «Haas F1 Team» e `gen_giri.py` fa `colori.get(team)` **senza alias**: **BEA e OCO hanno il grigio `#8A93A3` congelato dentro ogni file di `demo/data/giri/`** — la livrea sbagliata su una tabella che sembra a posto, esattamente il guasto che `gen_stat_identita.py` descrive nel suo frontespizio. Prendendo il canonico dagli standings il nome torna «Haas F1 Team» e il colore argento. **I file già scritti restano come sono** (sono output storico, non si ritoccano a mano): si correggono da soli al primo `gen_giri.py --forza`. In pagina l'effetto era nullo — `telemetria.html` usa `coloreDi()`, che l'alias ce l'ha.
   - **La sentinella è nata con lui** (verifica 12, `test_formazioni.py`): riproducibilità, livrea per ogni squadra di ogni round, **il passato non si muove**, perimetro delle deroghe dentro e fuori, `teams.json` derivato, ogni deroga tracciabile. Provata **al contrario**: estesa la deroga al round 11 va rossa nominando `ungheria__*:LAW`; un nome di squadra senza livrea fa uscire 1 il generatore **senza scrivere**.
   - **La deroga non si cancella dopo Zandvoort**: diventa il verbale di come sono stati attribuiti i dati di quel weekend. Toglierla rifarebbe risolvere Lawson in Racing Bulls all'Olanda, in disaccordo coi file pubblicati — e l'invariante storico se ne accorge.

7. **Cantiere 7 (Il sito in due lingue, con l'inglese principale)** — *19/08/2026, su richiesta del PO.*
   - **La direzione, e cosa vuol dire davvero.** «La principale dev'essere l'inglese» non è
     una preferenza di resa: decide **dove vive il testo**. L'inglese sta scritto
     NELL'HTML e nella prima colonna di `demo/dizionario.mjs`; l'italiano sta **solo**
     nella seconda. È l'unico ordine in cui «principale» resta vero anche quando il
     JavaScript non gira — un motore di ricerca, un lettore senza script, la prima
     vernice della pagina prima che i moduli partano vedono l'inglese perché è quello che
     c'è scritto nel file. Se il dizionario sparisse resterebbe un sito inglese intero;
     se la sorgente fosse italiana, sparirebbe il sito.
   - **Le due colonne stanno sulla stessa riga**, e la forma è il controllo:
     `'chiave': ['English', 'Italiano']`. Un dizionario per lingua si disallinea alla
     terza modifica e nessuno se ne accorge finché qualcuno non legge quella lingua; qui
     il disallineamento **non è rappresentabile**. 568 voci.
   - **La lingua NON si indovina dal browser**, ed è una scelta contro-intuitiva presa
     apposta: con `navigator.language` un visitatore italiano non vedrebbe mai la lingua
     principale del sito, e «principale» diventerebbe una parola senza effetto. L'ordine è
     `?lang=` (un link condiviso porta la sua lingua) → la scelta ricordata → inglese.
     Tre gradini, nessuno dei quali indovina. `?lang=` vince **e resta**, altrimenti la
     seconda pagina tornerebbe inglese e la scelta sembrerebbe non aver funzionato.
   - **Cambiare lingua ricarica la pagina**, e non è pigrizia: metà di quello che si legge
     non sta nell'HTML — lo scrivono i moduli mentre girano, ed è la metà che porta i
     numeri. Riscrivere solo i nodi marcati lascerebbe una pagina mezza inglese con la
     parte vecchia proprio sui numeri. Lo stato che conta vive nell'indirizzo (`?g=`,
     `?d=`), quindi la ricarica torna dov'eri.
   - **Il separatore decimale è il numero, non la tipografia.** `nnum`/`delta` scrivevano
     sempre la virgola. In inglese «1,250» non è uno e due e mezzo: è milleduecento­
     cinquanta. Un pit-loss di «20,80 s» diventerebbe ventimila e ottocento letto da un
     inglese — lo stesso carattere, due ordini di grandezza. Con lui: date (`dataLoc`,
     che si chiamava `dataIt` finché il nome non è diventato falso), nomi di mescola, nomi
     dei Gran Premi, nomi delle sessioni.
   - **Dove sta il selettore, e perché lì.** In fondo alla barra, dopo le sezioni,
     separato da un filo: la nav elenca quello che il sito racconta, questa è
     un'impostazione di chi legge — e le impostazioni stanno all'estremità, che è anche
     l'angolo dove per abitudine si va a cercarle. Sta **anche nel piede**, perché chi
     scorre fino in fondo senza aver capito la pagina non deve risalire. Non entra dentro
     `<nav>`: non è una destinazione.
   - **Perché un bottone solo e non due sigle affiancate.** Il primo disegno era `EN | IT`:
     migliore su schermo largo, perché si vede tutto senza toccare niente. Su 375 px non
     ci sta, **misurato nel browser**: marchio 32 + menu 265 + coppia 60 + spazi = 401 px
     dentro una barra da 375, con IT tagliato a metà. La barra era già al limite (le voci
     scendono a 4 px di respiro) e le etichette inglesi sono più lunghe delle italiane —
     CHAMPIONSHIP contro CAMPIONATO, 265 px contro 254. Un bottone con mappamondo costa
     44 px e la tendina che apre dà alle due lingue righe da 44 px vere. Sotto i 600 px
     resta il solo mappamondo (38 px): **sotto i 44 canonici, e detto**.
   - **La scala della barra stretta ha tre gradini** (≤420, ≤380, ≤340) e toglie poco alla
     volta — prima il respiro fra le voci, poi il corpo, poi i margini della barra.
     Nessuno tocca la struttura della nav: le quattro sezioni restano quattro a ogni
     larghezza. La misura da rispettare è una sola e vale a ogni gradino: `.barra`
     `scrollWidth == clientWidth`, verificata da 320 a 1280 px.
   - **COSA NON È TRADOTTO, e non è una dimenticanza.** *(Gli articoli sono usciti da
     questo elenco il 21/08: vedi il Cantiere 8.)*
     1. **Le assunzioni e il verdetto del Simulation Director**: li scrive il **kernel**,
        che è congelato, e li scrive come DATO — frasi con dentro i numeri di quella gara.
        Riscriverle in inglese vorrebbe dire ricostruirle senza avere quei numeri, cioè
        inventare una dichiarazione al posto di quella vera, sulla pagina che era già stata
        spenta una volta per numeri fabbricati. Fuori dall'italiano si dichiara, una riga
        (`sim.avviso_kernel`).
     2. **I moduli orfani** (15: `muretto.mjs`, `grossi.mjs`, `glossario.mjs`,
        `pitscenario.mjs`, `pista.mjs`…): non li raggiunge nessuna pagina. Tradurre codice
        morto darebbe l'impressione di una copertura che non c'è. **La sentinella calcola
        la raggiungibilità invece di elencarla**: se uno tornasse vivo, entrerebbe da solo
        nel controllo, e da rosso.
   - **Difetti veri trovati per strada** (nessuno dei quali era la traduzione):
     `dati.html` e `forza.html` **non avevano `<html>`** — il browser lo inventa, ma allora
     la lingua del documento non sta scritta da nessuna parte; `t` era il nome di comodo
     per «team», «trend» e «tag» in sette punti, e una variabile locale con quel nome
     **spegne in silenzio** la funzione che traduce (`forza.html` cadeva a `t is not a
     function`); `.voce`/`.tendina` erano scritte come `.menu .voce`, quindi la tendina del
     selettore — che sta nella barra ma **fuori** dalla nav, apposta — restava un blocco
     statico largo 200 px; `muro.mjs` leggeva `window` al momento dell'import e ha fatto
     cadere la verifica 10 appena `ese.mjs` ha cominciato a importarlo (le sentinelle del
     banco girano headless).
   - **La sentinella è nata con lui** (verifica 13, `demo/test_lingua.mjs`), ed è stata
     **provata al contrario**: togli una chiave dal dizionario → rossa; cambia l'inglese
     di una pagina senza cambiare il dizionario → rossa, col nome della chiave; scrivi una
     frase italiana a mano in una pagina → rossa, con la frase. Ha già trovato da sola
     `giro ${L}` nell'intestazione della torre, che avevo visto solo a schermo.

8. **Cantiere 8 (Gli articoli si traducono da soli)** — *21/08/2026, su richiesta del PO.*
   - **La direttiva, e la mia obiezione superata.** Avevo lasciato i dodici articoli in
     italiano dichiarando perché: sono analisi scritte a mano, e tradurle a macchina
     vorrebbe dire pubblicare come nostro un testo che nessuno ha verificato. Tommi ha
     ripetuto la richiesta — «gli articoli devono aggiornarsi automaticamente per la
     lingua» — e ha ragione lui su un punto che pesa più della mia obiezione: un sito
     inglese con dodici articoli italiani dentro è un sito a metà, e il problema non si
     risolve aspettando. **L'obiezione però non si butta: diventa il cancello.**
   - **La regola della casa non cambia perché cambia la lingua.** «La prosa non introduce
     un numero che non sia nei fatti» vale identica sulla traduzione, e anzi qui si può
     chiedere di più: la traduzione deve portare **esattamente gli stessi numeri
     dell'originale, nello stesso ordine**. Un traduttore che scrive «two tenths» dove
     l'italiano diceva 0,247 non ha fatto un errore di stile: ha cancellato una misura.
     `ai_lab/redazione/traduci.py` conta i numeri delle due prose e li confronta uno per
     uno — zero modelli, solo aritmetica: chi giudica una traduzione con un altro modello
     scopre di avere due opinioni, non una verifica.
   - **Il fallimento non pubblica niente, e si vede.** Se la guardia boccia, l'articolo
     resta italiano e la pagina lo dichiara (`.avviso-lingua`). Non esiste una traduzione
     «quasi buona» pubblicata in silenzio. **È già successo, al primo giro**: su
     `compagni-marce-stowe-gb-2026` il modello ha scritto «corner 15» dove l'italiano
     diceva «la curva quindici» — un numero comparso dal nulla, bocciato, e la regola
     mancante («la forma di ogni numero si conserva com'è: una cifra resta cifra, una
     parola resta parola») è finita nel prompt. In questa redazione le **cifre sono le
     misure** e le **parole sono tutto il resto**: cambiare la forma o fa comparire una
     misura che nessuno ha misurato, o ne fa sparire una che qualcuno ha misurato.
   - **Il corpo dell'articolo è l'unico posto del sito dove l'italiano è l'originale.**
     Ovunque altrove l'inglese è la sorgente; qui è una traduzione, e si dichiara sopra il
     titolo. Le due prose stanno **tutt'e due nel DOM**, ognuna col suo `lang`: l'originale
     resta leggibile e indicizzabile, la traduzione si presenta per quello che è. Costa
     ~2 kB — il testo di un articolo pesa 2 kB, i suoi grafici da 5 a 48.
   - **Del grafico si traducono le didascalie, non le curve.** I `<text>` con una
     traduzione vengono sdoppiati (`art-lingua`), il disegno resta uno solo: duplicare
     l'SVG avrebbe raddoppiato la pagina più pesante (63 kB) per cinque righe di testo.
     I 777 `<text>` di questi SVG non contengono altri tag — verificato — e per questo
     una regex basta dove servirebbe un parser.
   - **La testa segue l'inglese, il corpo mette avanti l'originale**, e sono due decisioni
     diverse perché rispondono a due domande diverse: «in che lingua è scritto questo
     file» (lo leggono i crawler e le anteprime social, che il nostro JS non lo eseguono) e
     «che cosa faccio vedere per primo a chi legge». Titolo e descrizione seguono la lingua
     con `data-i18n` e un blocco di voci che **la pagina si porta addosso**
     (`lingua.mjs::aggiungi`): le parole di un articolo non appartengono al dizionario del
     sito, e farle crescere lì dentro di dodici voci a settimana sarebbe un file comune che
     nessuno può più leggere.
   - **Un file, due lettori.** `demo/dizionario.mjs` lo legge il browser e lo legge Python
     (`statico.py::voci_dizionario`), perché le card e le pillole dei temi sono
     pre-renderizzate. L'alternativa era una seconda tabella, e due tabelle della stessa
     cosa si disallineano sempre. La sentinella controlla che i due lettori vedano **lo
     stesso numero di voci**.
   - **È agganciato alla catena**: `coda.py::_scrivi_demo` traduce **prima** di rendere la
     pagina (l'ordine è pagina → manifest → indici, e tutt'e tre leggono lo stesso oggetto:
     una traduzione che arrivasse dopo nascerebbe già in ritardo). Non può far cadere una
     pubblicazione: se il modello manca o la guardia boccia, si scrive perché e si va
     avanti in italiano. `statico.py::allinea_manifest_lingua` riallinea l'indice a ogni
     rigenerazione, così vale anche per i dodici articoli tradotti **dopo** essere stati
     pubblicati — nessuno di loro ripassa da `coda.py`.
   - **L'avviso compare solo quando è vero.** Su `analisi.html` non è più una riga fissa:
     lo accende lo script se in elenco c'è almeno un articolo senza traduzione. Un avviso
     falso è peggio di nessun avviso — insegna a non leggerli.
   - **Un difetto vecchio trovato per strada**: `data_it()` usava una costante `MESI` che
     **non è mai esistita**, e il suo `except Exception` (messo per le date malformate) si
     prendeva anche il `NameError`. Da sempre, in fondo a ogni articolo e su ogni card, il
     sito ha scritto «2026-07-26» dove voleva dire «26 luglio 2026», senza una riga di log.
     È il fallimento muto che questo repo descrive da solo in tre punti diversi, e si vede
     solo guardando la pagina. Trovato mentre nasceva la sua gemella `data_en()`.
   - **La sentinella (verifica 13) è cresciuta con lui**: rifà la guardia sui numeri su
     ciò che è **committato** — quindi copre anche la mano che apre il JSON e corregge una
     cifra a occhio — controlla che ogni pagina dichiari quale delle due è, e che il
     manifest non resti indietro rispetto all'articolo. Provata al contrario su un numero
     cambiato e su un manifest fermo: rossa in tutt'e due i casi.

9. **Cantiere 9 (I trasversali escono dalla gara di qualcun altro)** — *21/08/2026, su segnalazione del PO.*
   - **Il difetto, e perché il codice non poteva vederlo.** `dna-circuiti-2026` e
     `assetto-punta-curva-2026` misurano dieci gare e nel manifest hanno già `gp: null`.
     Ma l'elenco di `analisi.html` era **uno solo, ordinato per data**: datati 26/07 stavano
     fra i cinque pezzi d'Ungheria e si leggevano come pezzi d'Ungheria. Nessuna pillola
     poteva smentirlo — `fuoriGp` richiede `!!suoGp`, quindi una carta senza Gran Premio
     **non la nasconde nessun filtro**: era sempre in pagina, sempre sotto l'intestazione
     di qualcun altro. Il dato era giusto; a sbagliare era il posto in cui la pagina lo metteva.
   - **È lo stesso guasto degli STRUMENTI DI STAGIONE**, che in cima a questa pagina lo
     avevano già pagato e già dichiarato («sepolti in fondo a un elenco ordinato per data
     sarebbero spariti»). La cura è la stessa: una sezione che dice cosa sono, «Vale tutto
     l'anno» / *Valid all year*, scritta da `statico.py::blocco_elenco`.
   - **Il posto lo decide il DATO, non un elenco di id.** Il criterio è `gp` assente: il
     prossimo articolo trasversale ci finisce da solo il giorno che nasce, e nessuno deve
     ricordarsi di aggiungerlo. Una lista scritta a mano sarebbe stata la tredicesima
     seconda-verità di questo repo.
   - **Un'intestazione senza elenco sotto sembra un guasto**: il filtro per Gran Premio non
     tocca la sezione, ma quello per TEMA sì, e «qualifiche» la svuota. Titolo e occhiello
     seguono le loro carte. Verificato sul `display` calcolato, non sull'attributo `hidden`.

10. **Verifica delle automazioni per il weekend d'Olanda (round 12)** — *21/08/2026, FP1 in corso.*
   - **Attive e provate sulla macchina, non sul documento**: `auto_run.sh` (gare, ogni 30 min)
     e `auto_articoli_run.sh` (redazione, :15/:45) girano sul VPS, `verifica_crontab.sh` è
     VERDE, il checkout è a 0 commit da `origin/main`, la chiave LLM è attiva e il collettore
     live (`muretto-live.service`) sta registrando. `gen_formazioni.py` risolve il round 12
     con la deroga Hadjar→Lawson dichiarata.
   - **Zandvoort è un weekend SPRINT** (FP1 · SQ · S · Q · R): niente FP2/FP3, e **FP1 è
     escluso di proposito** dalla redazione. Il venerdì l'unico innesco prima della Sprint
     Quali è la pseudo-sessione FIA — cioè il documento «Car Presentation Submissions».
   - **Il trasloco del 10/08 non aveva portato le dipendenze**: `pdfplumber` mancava in
     `.venv-auto` e il cancello identità FIA si chiudeva, dichiarandolo, a ogni giro. Il PDF
     era in cache dalle 08:15: a mancare era solo chi lo aprisse. Installato il 21/08 (0.11.10,
     la stessa versione del Mac). **Non esiste un file di requirements**: il prossimo `import`
     nuovo si scoprirà allo stesso modo, a weekend cominciato. Il verbale sta in
     [`scheduling/README.md`](scheduling/README.md).
   - **Il Mac è indietro di 90 commit** su un branch di lavoro con l'albero sporco: `auto_tele`
     gira, ma `s46` è ROSSA da 42 ore e il fast-forward non passerà da solo. Riguarda la
     telemetria per sessione, non gare né articoli — quelli stanno sul VPS.

---

## Co-working tra Agenti (Claude Code / Antigravity IDE)
- Il codice e Git sono l'unico punto di verità condiviso.
- **Questo file è la sorgente; `AGENTS.md` ci rimanda.** A ogni avanzamento significativo o modifica strutturale si aggiorna QUI, e basta: non esiste più una seconda copia da tenere in pari.
- **Un verdetto senza data non è un verdetto.** Quando aggiungi una riga ai rami chiusi o agli interruttori, scrivi *quando* e *su che cosa* è stata misurata: le sezioni sopra si leggono anche fra sei mesi, e uno stato «acceso» senza data invecchia in silenzio.

