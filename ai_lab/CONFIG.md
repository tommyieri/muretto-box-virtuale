# CONFIG — Muretto AI Lab / Auditor Agent

Tutte le scelte configurabili, in un posto solo. **Le soglie sono dichiarate qui e nel
codice, mai scelte a posteriori per far passare un'ipotesi.**

---

## 1. Credenziali Claude (per l'interpretazione)

L'agente funziona senza. Con le credenziali, l'LLM interpreta i numeri e scrive il
dossier; senza, il dossier esce in modalità deterministica marcata.

```bash
pip install anthropic          # unica dipendenza aggiuntiva del laboratorio
export ANTHROPIC_API_KEY=sk-ant-...
```

In alternativa, un profilo `ant auth login` viene raccolto automaticamente dall'SDK
(costruttore a zero argomenti). Nessuna chiave viene mai scritta nel repository.

**Modello di default:** `claude-opus-4-8` — il giudizio è il lavoro dell'Auditor, quindi
il modello più capace. Override:

```bash
python3 ai_lab/run_auditor.py --race Spa --model claude-sonnet-5
```

Parametri della chiamata (in `auditor/agent.py`):

| parametro | valore | perché |
|---|---|---|
| `max_tokens` | 16000 | un dossier completo senza rischio di troncamento |
| `thinking` | `{"type": "adaptive"}` | il ragionamento è il valore aggiunto qui |
| `output_config.effort` | `high` | lavoro sensibile al giudizio |

---

## 2. Soglie dell'analisi (`auditor/tools.py`)

| costante | valore | significato | provenienza |
|---|---|---|---|
| `N_FREEZE` | 3 | giri puliti iniziali che fissano la previsione del motore | minimo di `engine.pace_base` |
| `MIN_GIRI_STINT` | 8 | giri puliti minimi perché uno stint sia analizzabile | allineato a `MIN_USABLE` di `gen_replay_perdita_stint.py` |
| `SOGLIA_TRAFFICO` | 2.0 s | gap all'auto davanti sotto cui il giro è "in traffico" | = `SOGLIA_ARIA` di `gen_replay_perdita_stint.py` |
| `SOGLIA_DEGRADO` | 0.03 s/giro | pendenza residuo~età-gomma oltre cui si sospetta degrado | dichiarata qui |
| `FRAZ_TRAFFICO` | 0.50 | frazione di giri in traffico oltre cui si sospetta il traffico | dichiarata qui |
| `ETA_BASSA` | 6 giri | età gomma sotto cui il giro serve a misurare il rumore | finestra "centrale" nello spirito di `gen_replay_perdita_stint.py` |
| `SOGLIA_OUTLIER` | 1.07 | tempo ≤ 1.07 × mediana di stint | **importata**, non ridefinita |
| `SLICK` | SOFT/MEDIUM/HARD | mescole ammesse | **importata**, non ridefinita |
| `MAX_DIFFERENZE` | 25 | quante differenze passare all'LLM (le più grandi) | contenimento contesto |

### Noise floor

Non è una costante: è **misurato per gara**. Definizione dichiarata:

> scarto assoluto mediano dei residui per-giro con età gomma ≤ `ETA_BASSA`, dove il degrado
> è ancora minimo. Pavimento dichiarato 0.05 s.

Si misura dove l'effetto da giudicare è **assente**, così il metro non incorpora ciò che
deve servire a misurare. Il numero di giri usati è riportato in ogni dossier: quando è
piccolo, la stima è debole e va detto.

---

## 3. Regole di classificazione

Applicate in quest'ordine a ogni stint. Deterministiche, nessun LLM coinvolto.

| # | condizione | candidato |
|---|---|---|
| 1 | `|residuo mediano| ≤ rumore` **e** `|pendenza × giri| ≤ rumore` | `rumore` |
| 2 | `pendenza ≥ SOGLIA_DEGRADO` **e** `frazione traffico ≥ FRAZ_TRAFFICO` | `non_classificabile` (co-presenza) |
| 3 | `pendenza ≥ SOGLIA_DEGRADO` **e** effetto di coda > rumore | `degrado` |
| 4 | traffico prevalente **e** residuo in traffico − residuo in aria pulita > rumore | `traffico` |
| 5 | stint interamente in traffico | `traffico` |
| 6 | altrimenti | `non_classificabile` |

La **regola 2 viene prima della 3** deliberatamente: quando degrado e traffico sono
co-presenti la misura non li separa, e dichiarare l'ambiguità è più onesto che assegnare
il primo candidato che supera la soglia.

`pit_lane`, `warm_up`, `safety_car` e `dati_mancanti` non sono candidati di stint: i giri
relativi sono esclusi dai residui dai filtri F1/F2/F6 e riportati come **contesto di gara**.

---

## 4. Stati del dossier (`memory/index.json`)

| stato | chi lo assegna | significato |
|---|---|---|
| `aperto` | l'agente, alla nascita | ipotesi formulata, non verificata |
| `validato` | **solo un umano** | riprodotta indipendentemente e ratificata dal PO |
| `respinto` | **solo un umano** | non ha retto — resta in memoria, col perché |

L'agente scrive esclusivamente `aperto`. Non esiste percorso di codice che promuova un
dossier: è il confine tra ricerca e decisione.

---

## 5. Confine di sicurezza

L'Auditor scrive **unicamente** dentro `ai_lab/`. Non ha alcun percorso di scrittura verso
`engine/`, `demo/`, `data/`, e non esegue `git`. Il kernel è importato in sola lettura;
il suo hash finisce in ogni dossier.

---

## 6. Experiment Designer (`designer/designer.py`)

### Cancello di nascita — quando un fenomeno merita un esperimento

| costante | valore | significato |
|---|---|---|
| `MIN_CIRCUITI` | 3 | circuiti indipendenti concordi richiesti |
| `MIN_STINT` | 20 | supporto complessivo minimo (**più severo** della soglia della mappa) |
| `MIN_RAPPORTO_RUMORE` | 1.0 | l'effetto deve superare il rumore locale in ogni osservazione utile |
| `QUOTA_DOMINANZA` | 0.40 | oltre questa quota di stint, un circuito è dichiarato dominante (rischio) |
| `SOGLIA_TRAFFICO_CONF` | 0.30 | frazione traffico oltre cui il confondente è dichiarato |

Un fenomeno `contesa` nasce **a prescindere dal supporto**: un conflitto di segno fra
circuiti è di per sé una domanda scientifica.

`MIN_STINT` è deliberatamente più severo della soglia che la mappa usa per la confidenza
`alto`: la mappa registra ciò che vede, un esperimento costa lavoro. Nella prima
esecuzione reale questo ha respinto `FEN-degrado-SOFT` (confidenza `alto`, 3 circuiti, ma
soli 7 stint).

### Ciclo di vita

```
CREATO → APPROVATO → ESEGUITO → VALIDATO → GO | NO_GO
                  ↘ RESPINTO ↙
```

| transizione | chi |
|---|---|
| → `CREATO` | l'Experiment Designer (unica cosa che fa) |
| → `APPROVATO` / `RESPINTO` | **solo un umano**, con `--attore` obbligatorio |
| → `ESEGUITO` / `VALIDATO` | l'Experiment Runner (non ancora costruito) |
| → `GO` / `NO_GO` | esito della valutazione KPI, solo da `VALIDATO` |

Le transizioni non ammesse sono rifiutate con l'elenco di quelle possibili. Ogni passaggio
finisce in `history.json` con attore, momento e nota.

### Sigillo anti-HARKing

`prereg.json` porta `sigillo` = sha256 del nucleo scientifico (motivazione, ipotesi,
dataset, variabili, campione minimo, KPI, regole di decisione), calcolato alla creazione.

```bash
python3 ai_lab/run_designer.py --verifica          # exit 0 = integri, 1 = alterato
```

Ammorbidire una soglia GO dopo aver visto i numeri cambia l'hash e viene segnalato.
