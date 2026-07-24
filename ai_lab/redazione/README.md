# La Redazione tecnica

Redazione autonoma che produce articoli ingegneristici di F1 per la sezione
**Analisi** del sito (`demo/analisi.html`). Ogni articolo parte da un fatto
tecnico curioso o anomalo e lo spiega fino in fondo: **Evidenza** (il canale/dato,
col grafico nel punto esatto) → **Causa** (la fisica) → **Effetto** (quantificato
in km/h, secondi, millesimi).

Non è cronaca e non è clickbait. È l'analisi che un ingegnere di pista farebbe,
scritta in modo che un appassionato serio la capisca.

## Le regole (non negoziabili)

1. **Ogni numero esce dai dati, mai a mano.** Un valore stimato e non misurato è
   dichiarato come tale (STIMATO) col suo metodo; una grandezza non identificabile
   dai dati si dichiara `NON_MISURABILE` — non si stima di nascosto.
2. **Ogni claim ha il suo grafico**, generato dalla *stessa* catena che ha
   calcolato il numero, con l'annotazione sul punto esatto dell'anomalia.
3. **Confine sacro.** Gli agenti scrivono BOZZE nell'area Lab
   (`ai_lab/redazione/bozze/`). Portare un articolo in `demo/` è un gesto umano
   (`coda.py --approva --attore …`); portarlo *online* è un altro gesto ancora
   (merge su `main` = deploy Vercel). Niente si auto-pubblica.
4. **Canale A** (scouting web) cita sempre la fonte e **riproduce** il tema sui
   nostri dati. **Canale B** (caccia all'anomalia nei nostri dati) misura prima e
   scrive dopo.

## La catena

```
rilevatore ──► fatti + grafici SVG ──► prosa (template a numeri iniettati) ──► bozza
 (misura)        (facts.json + svg)      (Evidenza/Causa/Effetto)              (Lab)
                                                                                 │
                    verifica avversariale ◄──────────────────────────────────────┘
                    (ogni numero tracciabile? la tesi regge alla refutazione?)
                                                                                 │
                         coda di revisione (Tommi) ──approva──► demo/ ──merge──► online
```

Il principio è quello del laboratorio (`ai_lab/`): **Python calcola tutti i
numeri, la prosa non introduce un numero che non sia nei fatti.** Nel collaudo la
prosa è un *template* in cui ogni valore è iniettato da `facts.json`: è impossibile
che un numero in pagina diverga dal dato.

## I file

| file | ruolo |
|---|---|
| `tele.py` | il caricatore di telemetria vettura FastF1 che mancava al repo (`get_car_data().add_distance()`): il "mattone" per l'Evidenza telemetrica |
| `svg.py` | grafici SVG **con aspetto preservato** (a differenza di weekend.html) così le annotazioni non si deformano: `grafico_lift`, `grafico_xy`, `grafico_curva`, `barre_dv`; tema scuro via `var(--…)`, colori team |
| `curve.py` | la **mappa-curve GPS** (da FastF1 `circuit_info`): misura un canale al punto-firma (apice) su più giri. Il mattone che rende economici i temi telemetrici (Tecnica, Assetto) |
| `multigara.py` | l'**estrattore multi-gara**: feature per-gara (vmax + cornering per team) con cache in `dati_stagione/`. Il mattone per i temi aero (A) e DNA circuito (X), che vivono sul confronto fra gare |
| `base.py` | fondamenta comuni: formattazione italiana, gli STATI ammessi per un numero, `scrivi_bozza` |
| `registro.py` | l'elenco dei generatori registrati (aggiungere un articolo = aggiungere una riga) |
| `genera.py` | **l'orchestratore**: scorre i generatori, ognuno ISOLATO (un fallimento non ferma gli altri); è il passo agganciato ad `auto_gara.py` |
| `genera_lift_traguardo.py` | Articolo 1 (Canale B): il lift Mercedes prima del traguardo |
| `genera_rapporti.py` | Articolo 2 (Canale A+B): rapporti del cambio McLaren vs Mercedes (stesso motore) |
| `genera_stowe.py` | Articolo 3 (Canale B, tema T3): dove due compagni scelgono marce diverse all'apice (usa `curve.py`) |
| `genera_frenata.py` | Articolo 4 (Canale B, tema M2): chi frena più tardi alla staccata più dura |
| `genera_trazione.py` | Articolo 5 (Canale B, tema T2): chi rimette il gas per primo alla curva più lenta |
| `genera_efficienza.py` | Articolo 6 (Canale A+B, tema A2, MULTI-GARA): la mappa dell'assetto (punta vs curva) su tutta la stagione |
| `genera_dna.py` | Articolo 7 (Canale B, tema X1, MULTI-GARA): il DNA dei circuiti (% a tutto gas = motore vs carico) |
| `mandato.json` | il **mandato editoriale**: cosa scriviamo (temi attivi/esclusi, politica solo-SÌ). Deciso da Tommi dal menu editoriale |
| `rilevatori/lift_traguardo.py` | misura del lift su tutti i giri lanciati (soglie dichiarate in testa) |
| `redattore.py` | lo **scrittore LLM** (scaffold): fatti → prosa, con guardia sui numeri e fallback a template. Spento finché non c'è una chiave |
| `scout.py` | **Canale A**: il prompt dello scout web e la lettura della coda spunti |
| `spunti/*.json` | la **coda spunti**: `scout_2026.json` (Canale A, con fonti) e `caccia_2026.json` (Canale B, già misurati) |
| `coda.py` | la coda di revisione: gate umano `bozza → approvato → pubblicato` (atti umani con `--attore`, storico append-only) |
| `bozze/<id>/` | `facts.json` (macchina), `articolo.json` (corpo pubblicabile), `bozza.md` (umano), `stato.json` |

## Uso (collaudo: "Il lift Mercedes prima del traguardo")

```bash
# 1. genera la bozza dai dati (python3 UTENTE: fastf1 non è nella .venv)
python3 ai_lab/redazione/genera_lift_traguardo.py

# 2. mettila in anteprima nel sito (stato 'bozza': visibile solo via link diretto)
python3 ai_lab/redazione/coda.py --anteprima lift-mercedes-gb-2026
#    -> demo/articolo.html?id=lift-mercedes-gb-2026
#    -> vista revisore: demo/analisi.html?bozze=1

# 3. Tommi rivede e approva (compare nell'indice pubblico; NON fa push)
python3 ai_lab/redazione/coda.py --approva lift-mercedes-gb-2026 --attore "Tommi" \
        --nota "ok, pubblica"
# oppure respinge:
python3 ai_lab/redazione/coda.py --respingi lift-mercedes-gb-2026 --attore "Tommi" \
        --nota "..."

python3 ai_lab/redazione/coda.py --lista        # stato di tutte le bozze
```

Per **vedere** l'anteprima serve un server statico su `demo/`:
`python3 -m http.server 8099 --directory demo` (o il preview `muretto-demo`).

## Front-end

- `demo/articolo.html?id=<id>` — pagina articolo dedicata (consumatore puro di
  `demo/data/analisi/<id>.json`); clona lo scheletro di `scheda.html`.
- `demo/analisi.html` — indice della redazione (card da
  `demo/data/analisi_articoli.json`). Default: solo `pubblicato`.
  `?bozze=1` = vista revisore (mostra anche le bozze, marcate).
- Stile in `demo/stile.css` (blocco `REDAZIONE TECNICA`), tema scuro, colori team
  da `demo/team_colori.json`.

## Ambiente e trappole

- **Due Python.** I generatori FastF1 (telemetria) vanno con `python3` di sistema
  (fastf1 3.8.3); la `.venv` del kernel non ha fastf1. Vedi `SETUP_AMBIENTE.md`.
- **Cache FastF1** fuori dal repo: `~/muretto_shared/ff1_cache`. I canali auto
  (Speed/Throttle/…) esistono per un sottoinsieme di sessioni; una gara nuova
  richiede un download a freddo dal Mac (IP residenziale, rate-limit ~500/h).
- **Non toccare** `engine/` (kernel congelato), i golden, i file di produzione:
  la redazione aggiunge, non modifica.
- **Verità del motore.** I tempi assoluti del kernel sono ottimisti di ~1,9 s/giro:
  un articolo non li mostra mai come previsione. I modelli degrado/traffico sono
  calibrati ma spenti (`ACCENDIBILE:false`): citabili come coefficienti, non come
  effetti attivi.

## Come nascono gli articoli (i due canali)

- **Canale B — caccia nei nostri dati**: rilevatori che misurano un'anomalia
  prima di scrivere una riga. La coda `spunti/caccia_2026.json` è alimentata da un
  fan-out di cacciatori paralleli; ogni spunto è già misurato e diventa articolo
  passando dal generatore + verifica.
- **Canale A — scouting web** (`scout.py`): cerca spunti sulla stampa tecnica,
  cita la fonte, e li **riproduce** sui nostri dati. Coda `spunti/scout_2026.json`.
  L'articolo 2 (rapporti) nasce così: idea da Motorsport.com, numeri nostri.

## A regime — cosa è già cablato

- **Orchestratore**: `python3 ai_lab/redazione/genera.py --gara <nome>` produce le
  bozze di tutti i rilevatori applicabili. Ogni rilevatore gira isolato: quelli
  telemetrici si auto-saltano se `fastf1` non c'è (es. VPS) o la sessione non è in
  cache — **la redazione non ferma mai la gara**.
- **Aggancio post-gara**: `genera.py` è chiamato dentro il blocco LABORATORIO di
  `auto_gara.py` (`check=False`, prima di `gen_targhetta_lab.py`). A ogni GP le
  bozze si generano da sole nella coda di revisione. La **pubblicazione resta il
  gesto umano** (`coda.py --approva`).
- **Scrittura LLM** (`redattore.py`): oggi la prosa è un template deterministico
  (numeri iniettati, zero rischio). Per la scrittura autonoma serve
  `ANTHROPIC_API_KEY` (o `ant auth login`) e il pacchetto `anthropic` nel venv;
  la guardia rifiuta qualunque prosa con un numero non presente nei fatti.
- **Verifica avversariale**: prima della coda, un controllo indipendente ri-misura
  il dato grezzo per provare a smentire la tesi e controlla che ogni numero della
  prosa sia tracciabile ai fatti. È lo stadio che ha corretto entrambi i primi
  articoli.

### Verso i 6–7 a weekend
Il collo di bottiglia non è più l'infrastruttura ma la **generalità dei
rilevatori**: oggi i due generatori sono tarati su Silverstone. Il passo
successivo è renderli per-circuito (fira dove il fenomeno esiste, tace altrove) e
convertire gli spunti in coda (`spunti/`) in generatori. Ogni nuovo articolo =
un file `genera_*.py` + una riga in `registro.py`.
