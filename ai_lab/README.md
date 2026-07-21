# Muretto AI Lab (v1)

Un laboratorio di ricerca sopra un simulatore deterministico. Tre ricercatori:

| | ricercatore | compito | LLM |
|---|---|---|---|
| 1 | **Auditor Agent** | trova dove simulazione e realtà divergono, produce un **Research Dossier** | sì (solo per interpretare e scrivere) |
| 2 | **Knowledge Extractor** | legge ogni dossier e costruisce la **mappa della conoscenza** | **no, per costruzione** |
| 3 | **Experiment Designer** | trasforma un fenomeno maturo in un **protocollo eseguibile** | **no, per costruzione** |

Nessuno dei tre tocca il motore. Producono conoscenza e protocolli, non patch.

```
DATI  →  MODELLI  →  MOTORE  →  OUTPUT          ← il sistema (congelato)
                        ↑
                   sola lettura
                        │
   Auditor ──dossier──► Extractor ──mappa──► Designer ──protocollo──► [Experiment Runner]
                                                                       (non ancora costruito)
```

Il Designer chiude il salto che teneva fermo il laboratorio: **dall'osservazione
all'esperimento eseguibile**. Fino a lì il laboratorio osservava senza mai poter
migliorare il simulatore.

---

## Uso

```bash
# 1. l'Auditor produce un dossier per una gara storica
python3 ai_lab/run_auditor.py --list                    # gare disponibili
python3 ai_lab/run_auditor.py --race "Belgium 2026"     # dossier completo
python3 ai_lab/run_auditor.py --race Spa --no-llm       # solo numeri, niente Claude

# 2. il Knowledge Extractor trasforma TUTTI i dossier in conoscenza
python3 ai_lab/run_extractor.py                         # aggiorna la mappa
python3 ai_lab/run_extractor.py --mappa                 # stampa la mappa

# 3. l'Experiment Designer trasforma i fenomeni maturi in protocolli
python3 ai_lab/run_designer.py --dry-run                # chi nascerebbe, e chi no
python3 ai_lab/run_designer.py                          # genera i protocolli mancanti
python3 ai_lab/run_designer.py --stato                  # ciclo di vita
python3 ai_lab/run_designer.py --verifica               # sigilli anti-HARKing
python3 ai_lab/run_designer.py --approva EXP-0001 --attore "Tommi" --nota "..."
```

Il nome gara accetta italiano, inglese e circuito: `Belgio` / `Belgium 2026` / `Spa`.
Senza credenziali Claude l'Auditor funziona comunque, in modalità deterministica marcata
(vedi [CONFIG.md](CONFIG.md)). L'Extractor non ha mai bisogno di credenziali.

---

## Struttura

```
ai_lab/
├── README.md · CONFIG.md
├── run_auditor.py          CLI ricercatore 1
├── run_extractor.py        CLI ricercatore 2
├── auditor/
│   ├── tools.py            strato numerico — solo Python, mai LLM
│   ├── agent.py            orchestrazione, Claude, memoria dei dossier
│   └── prompt.md           chi è l'Auditor, le sue leggi, il formato del dossier
├── extractor/
│   └── extractor.py        estrazione deterministica — nessun LLM, per costruzione
├── reports/                <ID>.md  (versione umana)  +  <ID>.facts.json  (versione macchina)
├── memory/index.json       registro dei dossier: ID, data, gara, motore, stato
└── knowledge/              conoscenza.json + MAPPA.md  (rigenerati, incrementali)
```

---

## Ricercatore 1 — Auditor Agent

Confronta realtà e simulazione **dentro ogni stint** e classifica le differenze.

Il motore simula un **passo costante per stint**: `PaceModel` tiene fermo `pace_base` (il
giro fuel-corretto a serbatoio vuoto) e `AdvanceModel` lo somma a ogni giro. La realtà
invece degrada, incontra traffico e alleggerisce il serbatoio.

Confrontare i `cum_time` grezzi sarebbe **sbagliato**: il kernel lavora a serbatoio vuoto e
non re-inflaziona il carburante, quindi il residuo assoluto porterebbe ~2 s/giro di
carburante e coprirebbe ogni altro effetto. Il confronto avviene perciò nello **spazio
fuel-corretto del motore**:

```
residuo(giro) = tempo_osservato_fuel_corretto − pace_base(fissato al freeze dello stint)
```

Ogni stint riceve un **candidato** da regole deterministiche ([CONFIG.md](CONFIG.md)).
Quando degrado e traffico sono co-presenti — un'auto in treno rallenta esattamente come
rallenterebbe degradando — lo stint è marcato **`non_classificabile`**: dichiarare
l'ambiguità è più onesto che assegnare il primo candidato che supera la soglia.

**Output per dossier:** `<ID>.md` (per l'umano) e `<ID>.facts.json` (per la macchina,
congelato alla generazione). Il `.md` non viene mai modificato da nessuno.

---

## Ricercatore 2 — Knowledge Extractor

Legge ogni dossier e ne ricava conoscenza strutturata e **incrementale**:
fenomeni, ipotesi, componenti, variabili, circuiti, condizioni, confidenza, collegamenti.

### Perché non usa un LLM

Un LLM è precisamente lo strumento che, messo qui, **inventerebbe collegamenti plausibili
e non sostenuti**: è il suo modo caratteristico di fallire. L'Extractor è quindi 100%
Python deterministico — stessi dossier, stessa mappa, sempre, senza rete.

### Da dove prende i fatti

Dal sidecar `<ID>.facts.json`, mai dalla prosa. La prosa del dossier viene letta **solo**
per le ipotesi, e riportata **verbatim**: l'Extractor non le giudica e non ne deriva
confidenza.

### Il modello della conoscenza

| entità | grana | cos'è |
|---|---|---|
| **osservazione** | dossier × componente × mescola | un fatto misurato in una gara, con variabili, condizioni, supporto e forza |
| **fenomeno** | componente × mescola | l'entità canonica che attraversa le gare |
| **collegamento** | coppia di osservazioni | una **co-occorrenza misurata**, con l'evidenza numerica allegata |

Tipi di collegamento, tutti evidenziali: `ripetizione_altra_gara`, `divergenza`,
`non_replicato`, `stesso_circuito_rianalisi`. Nessuno è causale, nessuno nasce da
somiglianza testuale. Se due osservazioni vengono da versioni diverse del motore, il
collegamento porta l'avvertenza che **non sono confrontabili**.

### Come cresce la confidenza

Non per insistenza né per dimensione dell'effetto: per **replicazione su circuiti diversi**.

| livello | condizione |
|---|---|
| `nullo` | in nessuna gara l'effetto supera il rumore locale |
| `basso` | un solo circuito — è in-sample, non replicato |
| `medio` | ≥ 2 circuiti concordi e ≥ 5 stint |
| `alto` | ≥ 3 circuiti concordi, ≥ 2 osservazioni marcate |
| `contesa` | segni opposti fra circuiti — la mappa **registra e non media** |

Un effetto enorme su una sola gara resta `basso`. È la legge anti-circolarità del
laboratorio resa meccanica.

> **Cosa misura la confidenza:** quanto l'osservazione si **ripete**, non quanto la causa
> è capita. Un `non_classificabile` può essere `alto`: significa che il residuo ricompare
> ovunque, **non** che sappiamo perché. Il campo `natura` di ogni fenomeno lo dice.

### Incrementalità

La mappa si ricostruisce da tutti i dossier a ogni esecuzione: idempotente, nessun
duplicato. Aggiungere gare fa crescere la conoscenza da sola — nella prima prova reale,
`FEN-degrado-SOFT` è passato da `medio` ad `alto` semplicemente aggiungendo due gare.

---

## Ricercatore 3 — Experiment Designer

Non scrive relazioni: genera **protocolli scientifici eseguibili**. Un protocollo non è
una pagina bella, è un contratto che qualcun altro potrà eseguire.

```
ai_lab/research/experiments/EXP-0001/
├── protocol.md     il protocollo, per l'umano
├── prereg.json     il CONTRATTO MACCHINA, sigillato (per l'Experiment Runner)
├── status.json     stato corrente nel ciclo di vita
└── history.json    log append-only: chi, quando, perché
```

### Il cancello di nascita — la regola che conta

Un esperimento **non nasce perché un fenomeno è interessante**: nasce perché ha superato
soglie dichiarate prima. Ogni protocollo dichiara **perché nasce adesso** e **con cosa non
sarebbe nato**:

> *Nasce perché lo stesso fenomeno è stato osservato in 5 circuiti indipendenti
> (Australia, Belgio, Gran Bretagna, Miami, Spagna), con segno concorde e effetto sopra il
> rumore locale in ciascuno, su 79 stint complessivi.*
>
> *Non sarebbe nato con una sola gara: la soglia dichiarata è ≥ 3 circuiti concordi e
> ≥ 20 stint. Un effetto grande su un solo circuito resta in-sample.*

I fenomeni respinti sono registrati **col motivo**. È così che il laboratorio evita di
inseguire rumore: nella prima esecuzione reale sono nati 4 esperimenti e 7 fenomeni sono
stati deliberatamente non inseguiti — incluso uno a confidenza `alto` ma con soli 7 stint.

### Tre tipi di protocollo

| tipo | quando nasce | cosa chiede |
|---|---|---|
| `verifica_sistematica` | `degrado`/`traffico` a confidenza alta | il motore sottostima sistematicamente? |
| `identificazione_meccanismo` | `non_classificabile` riproducibile | *quale* variabile spiega il residuo? |
| `disambiguazione` | fenomeno `contesa` | perché il segno si inverte fra circuiti? |

### KPI e decisione, in forma eseguibile

`BIAS`, `RMSE`, **`LOCO`** (leave-one-circuit-out) e `NON_REGRESSIONE`. Le regole GO/NO-GO
sono dati, non prosa — il Runner potrà valutarle senza interpretare:

```json
{"kpi": "LOCO", "operatore": ">=", "soglia": 0.67,
 "nota": "il guadagno regge su almeno 2 circuiti su 3 tenuti fuori"}
```

Il KPI decisivo è **LOCO**, non l'RMSE in campione: è l'unica difesa contro l'overfitting
e contro la circolarità in-sample che resta il limite aperto del laboratorio. Esiste anche
un esito **NULLO** (campione insufficiente = *non giudicabile*, **non** NO-GO).

### Rischi calcolati, non boilerplate

I rischi vengono dai dati: circuito dominante (col nome e la quota), confondente traffico,
neutralizzazioni, e — dalla mappa — la **co-presenza di un residuo non spiegato sulla
stessa mescola**, che avverte quando parte dell'effetto attribuito potrebbe essere altro.

### Ciclo di vita e sigillo

```
CREATO → APPROVATO → ESEGUITO → VALIDATO → GO | NO_GO
```

Il Designer crea e basta: nasce `CREATO` e **non si auto-approva**. Approvare e respingere
sono atti umani e richiedono `--attore`, che resta scritto in `history.json`. Eseguire e
validare spettano all'Experiment Runner. Le transizioni illegali sono rifiutate.

`prereg.json` è **sigillato** con un hash del contenuto scientifico calcolato prima di
qualunque esecuzione. Se dopo i numeri qualcuno ammorbidisce una soglia o ritocca
un'ipotesi, `--verifica` lo rileva ed esce con codice 1. È la difesa anti-HARKing.

---

## Riuso: nessuna logica duplicata

Duplicare logica è un errore architetturale. Il laboratorio **importa** ciò che esiste:

| Da dove | Cosa |
|---|---|
| `engine/engine.py` | `ti_adapter`, `pace_base`, `FUEL_COEFF`, `FILES`/`FOLDER` |
| `test_identificabilita_degrado.py` | `carica`, `pulisci` (F1–F6), `filtro_outlier` (F7), `SLICK`, `SOGLIA_OUTLIER` |
| `gen_replay_perdita_stint.py` | la soglia aria pulita 2.0 s, stesso valore e significato |
| `auditor/tools.py` | l'Extractor riusa l'helper di distribuzione, non lo riscrive |

Il motore non è mai reimplementato: è chiamato.

---

## Memoria e stati

Ogni dossier è registrato in `memory/index.json` con **ID, data, gara, versione motore
(hash di `engine.py`), dataset e stato**. L'hash del motore è ciò che rende la memoria
utile nel tempo: se il kernel cambia, si sa quale versione ogni dossier aveva auditato, e
l'Extractor segnala che le osservazioni non sono più confrontabili.

| stato | chi lo assegna | significato |
|---|---|---|
| `aperto` | l'agente, alla nascita | ipotesi formulata, non verificata |
| `validato` | **solo un umano** | riprodotta indipendentemente e ratificata dal PO |
| `respinto` | **solo un umano** | non ha retto — resta in memoria, col perché |

Un dossier respinto **non si cancella**: è ciò che impedisce di rifare lo stesso errore.

---

## Le leggi del laboratorio

1. La realtà batte il modello.
2. Si trovano **ipotesi**, non miglioramenti. Mai «ho migliorato»; sempre «questa ipotesi
   richiede validazione».
3. Il confine è sacro: nessuna proposta di modifica al kernel. Decide il Product Owner.
4. Il rumore è il nemico dichiarato: un effetto sotto il noise floor **non è un effetto**.
5. Nessun numero inventato: l'aritmetica è di Python.
6. Il NULL è un risultato.
7. Nessuna relazione non sostenuta dai dati: un collegamento è una co-occorrenza misurata.

---

## Limiti dichiarati (leggerli prima di usare la mappa)

- Il motore non modella il pit-stop: il confronto resta **dentro** lo stint.
- Degrado ed evoluzione pista non sono separabili da questa misura.
- Su circuiti a basso sorpasso il passo può scendere per gestione o treno DRS: la
  pendenza da sola non prova il degrado.
- La replicazione della mappa è **fra circuiti**, non fuori campione: le gare usate sono
  le stesse che alimentano i coefficienti del progetto. Il rischio di circolarità
  in-sample resta aperto e va sciolto con un test leave-out.
- Un fenomeno `non_classificabile` resta tale: l'Extractor non scioglie ambiguità che la
  misura non ha sciolto.
- La classificazione propone un **candidato**, non stabilisce una causa.
