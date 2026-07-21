# FASE A — Pulizia e retrocessione (rifondazione del laboratorio)

Data: 2026-07-21 · branch `ai-lab/scienziato-fuel`

Premessa che governa questo censimento: **niente è consolidato**. Il FONDO (deciso da
Tommi) è l'unica terra ferma:

> tempi sul giro grezzi, pit reali (giro + timestamp), posizioni, status bandiera —
> la cronometria pura di TracingInsights e f1db.

Tutto ciò che sta sopra (fuel-correzione, degrado, traffico/+27%, cap, pit-loss) è
**ipotesi**, non fondazione. Questo documento elenca, file per file, cosa è stato
**eliminato**, cosa **retrocesso** e cosa **conservato come metodo** — prima di eseguire.

---

## A.1 — DA ELIMINARE: il giudice automatico con autorità di uccidere

Criterio di classificazione applicato: *l'exit-code decide se un'IPOTESI vive o muore*
(→ giudice, da eliminare) oppure *decide se il CODICE si comporta come specificato /
se i DATI sono integri* (→ test o guardrail, si conserva).

Censimento completo di `sys.exit` / `process.exit` / `KILLED` nel repo:

| file | cosa decide l'exit-code | classe | azione |
|---|---|---|---|
| `ai_lab/distruttore/distruttore.py` | **verdetto `KILLED`/`SURVIVES` su una rivendicazione scientifica**, per veto congiuntivo | **GIUDICE** | **eliminata l'autorità**: il verdetto diventa `proposta` (`FALSIFICA_PROPOSTA` / `NON_FALSIFICATA`), campo `decisione` = rinviata al tavolo umano |
| `ai_lab/distruttore/run_distruttore.py` | `exit 1` se il collaudo del giudice non è sensibile/specifico | **GIUDICE** | **eliminata l'autorità**: `exit 0` sempre; il collaudo stampa una proposta, non una sentenza |
| `ai_lab/distruttore/test_riparazione_cancello.py` | comportamento del cancello di partizione (codice) | test di codice | conservato |
| `test_b.mjs`, `test_pit.mjs`, `test_degrado_hook.mjs`, `check_banda_gancio.mjs`, `verifica_k4_clim.mjs`, `test_guard_travaso.py`, `test_f1db_checksum.mjs`, `pipeline_smoke_pit.mjs` | comportamento meccanico del codice / golden bit-identici (dichiarano essi stessi "nessun numero di dominio") | test di codice | conservati |
| `gen_censimento_pitloss.py`, `gen_pitloss_pergara.py`, `gen_pitstops.py`, `gen_mappa_gare.py`, `gen_schede.py`, `gen_tele.py`, `auto_gara.py` | integrità/riconciliazione dei dati prima di pubblicare | guardrail dati | conservati |
| `att6_silverstone.mjs` | criterio ATT6 v1 — **già dichiarato SUPERATO nel file**, resta come generatore | superato | conservato com'è (non è più un cancello vivo) |

Risultato: **l'unico giudice automatico con autorità finale nel laboratorio era il
Distruttore**. Gli altri exit-code sono test di codice o guardrail di integrità e restano.

---

## A.2 — DA RETROCEDERE: dove il laboratorio si appoggia a un numero NON-FONDO

Nessun numero del kernel di **produzione** viene cancellato (quello resta: è il prodotto
attuale). Cambia lo **statuto** dentro il laboratorio: da dato a ipotesi da riverificare.
Registro autorevole: [`ai_lab/scienziato/RETROCESSIONE.md`](ai_lab/scienziato/RETROCESSIONE.md).

| file | numero non-fondo usato come vero | uso | statuto nuovo |
|---|---|---|---|
| `ai_lab/auditor/tools.py:149` `_fuel_corretto` | `FUEL_COEFF = 3/70` s/kg su 70 kg (importato dal motore) | **tutto** il residuo dell'Auditor vive nello spazio fuel-corretto | IPOTESI — ogni residuo, ogni classificazione (degrado/traffico/rumore) è condizionata a un coefficiente non verificato |
| `ai_lab/auditor/tools.py:205` | `engine.pace_base` (che contiene la stessa correzione) | previsione del motore al freeze | IPOTESI |
| `ai_lab/auditor/tools.py:47` `SOGLIA_TRAFFICO=2.0` | soglia di "aria pulita" | filtro | **METODO** (è una definizione geometrica sul fondo: gap da `sesT`), si conserva |
| `ai_lab/designer/designer.py:357` | protocollo che prescrive `fuel_corrected_pace` "calcolata con engine.FUEL_COEFF" come **variabile risposta** | ogni esperimento generato eredita il coefficiente | IPOTESI — i protocolli generati sono condizionati |
| `ai_lab/distruttore/distruttore.py` (spazio di misura) | traffico misurato sul **gap** fra due auto: dichiarato fuel-NEUTRO perché il termine carburante si elide | misura | **CORRETTO come argomento**, ma vale solo se la correzione è *comune alle due auto*: resta valido, si conserva come metodo |
| `ai_lab/distruttore/patogeni.py:70-71` | `pitLoss 29.12 → 20.80` usato come **"noto-vero"** di calibrazione del giudice | il giudice è tarato su un numero non-fondo | IPOTESI — la specificità del Distruttore è condizionata a un pit-loss non riverificato |
| `ai_lab/distruttore/patogeni.py:31`, `calibrazione.py:39` | `ZONE=1.5, STRENGTH=1.0` (il cap del traffico) come "valori di produzione" | baseline di ogni confronto | IPOTESI |
| `test_identificabilita_degrado.py:44` | `FUEL_SKG=0.03`, `FUEL_KG=70` — **seconda costante**, diversa da quella del motore (0.0429 s/kg) | pre-correzione della risposta | IPOTESI + **incoerenza interna dichiarata** (due coefficienti fuel diversi nel repo) |
| `live/pace_base_live.py:16` | `FUEL_COEFF = 3/70` duplicato dal kernel | passo live | **PRODUZIONE** — non toccato; elencato perché il lab non deve leggerlo come dato |
| `ai_lab/knowledge/conoscenza.json`, `ai_lab/reports/AUD-*.md` | dossier e mappa costruiti nello spazio fuel-corretto | conoscenza accumulata | IPOTESI — la mappa è *condizionata*, non falsa: va riletta dopo la verifica del 1° piano |

Branch investigatori (non presenti in questo albero, censiti via `git diff main...`):

| branch | file | statuto |
|---|---|---|
| `ai-lab/traffic-investigator` | `ai_lab/traffic_investigator/investigatore.py` (+235) e `esito_indagine.json` (1611 righe) | **codice di scandaglio riusabile**; ogni misura passa da `distruttore.misura_traffico` → confronto basato su kernel fuel-corretto ⇒ **da riverificare** |
| `ai-lab/tyre-investigator` | solo `PREREG_tyre_investigator.md` (nessun codice) | preregistrazione, nessun numero da retrocedere |

---

## A.3 — DA CONSERVARE COME METODO (non come risultato)

Si tiene il **come**, non l'output numerico. Riusato nello scheletro-scienziato:

| origine | metodo conservato |
|---|---|
| `test_identificabilita_degrado.py` | filtri dichiarati e **contati** (F1 status verde, F2 no in/out-lap, F4 numerici, F5 giro≥2, F6 vita≥3, F7 outlier 1.07×mediana-stint); guardrail di **rango** della design matrix (mai `pinv` silenziosa); SE **cluster-robust** per (pilota, stint); mai pooling fra gare |
| `ai_lab/distruttore/distruttore.py` | **bootstrap a blocchi** (blocco = gara/caso, non osservazione); **permutation null**; replica **out-of-sample**; veti dichiarati *prima* dei numeri; sigillo anti-HARKing sul prereg |
| `gen_replay_perdita_stint.py` / `auditor/tools.py` | `SOGLIA_ARIA = 2.0 s` come definizione di aria libera, calcolata dal **fondo** (`sesT`) |
| `ai_lab/distruttore/distruttore.py` | scelta di uno **spazio di misura fuel-neutro** quando il coefficiente non è verificato (differenze fra auto sullo stesso giro, ranghi) |
| tutto il progetto | preregistrazione scritta prima dell'esecuzione; ogni valore ha il suo **generatore committato** |

Nessun numero prodotto da questi metodi entra nel nuovo lavoro come acquisito.

---

## A.4 — Cosa NON è stato toccato

- `engine/engine.py` (kernel di produzione), `demo/`, `live/`, la pipeline di pubblicazione.
- I CSV/JSON già committati in `data/`: restano, con statuto retrocesso nel registro.
