# REPORT — il 2022 non è nel fondo: fermo su A e B, cablato tutto il resto

Branch `ai-lab/scienziato-fuel-2022` · 21/07/2026 · prereg scritto **prima che i dati
esistano**: [`ai_lab/scienziato/PREREG_2022.md`](ai_lab/scienziato/PREREG_2022.md)

---

## (1) Il 2022 **non è nel fondo**. Fermo, come da istruzione.

```
data/ti_archive/     ->  2023  2024  2025  2026        (nessun 2022)
data/ti_cache/       ->  solo gare 2026
find . -iname "*2022*"  ->  nessun file, in tutto il repo
grep 2022 ingest_*.py f1db_zip.py  ->  nessuno script lo prevede
gare nel fondo: {2023: 22, 2024: 24, 2025: 24, 2026: 10}
```

**Non l'ho ricostruito altrove.** Non ho toccato f1db, non ho scaricato nulla da
TracingInsights: l'istruzione era esplicita, e in ogni caso una fonte diversa per una sola
stagione romperebbe l'omogeneità della cronometria su cui poggia tutto il confronto.

Conseguenza: **l'uso A e l'uso B non sono eseguibili stanotte.** Nessun verdetto fresco,
nessun test cieco. Quello che segue è tutto ciò che si poteva fare *senza* quei dati — e
che rende il lavoro di domani a costo quasi zero.

### Che cosa serve, esattamente

Popolare `data/ti_archive/2022/<Nome> Grand Prix/Race.json` nello stesso formato colonnare
delle altre annate. Nient'altro: **il codice è già pronto ad accoglierlo** (§4).

---

## (2) Uso A — non eseguibile. Ma l'aritmetica di quanto sbloccherebbe è già fatta

Questa è aritmetica sul fondo, non una previsione:

| circuito | stagioni ora | col 2022 | sbloccato? |
|---|---|---|---|
| Australian · Canadian · Chinese · Dutch · Emilia Romagna · Miami · Monaco · Spanish · São Paulo | 2 | 3 | **sì — 9 celle** |
| Belgian · British | 1 | 2 | no, resterebbero indecidibili |

**9 celle su 11 diventerebbero giudicabili** — e sarebbero **prova vera**, perché il 2022
non ha ispirato il metro. In più, i 13 circuiti già giudicati passerebbero a 4 stagioni.

Condizione, non assunta ma da verificare sui dati: che quella gara 2022 esista e superi i
guardrail (asciutta, rango pieno). Due aspettative dichiarate come **non-fatti**: il GP di
Cina 2022 potrebbe non essersi corso, e Monaco 2022 potrebbe cadere sul filtro pioggia. Se
cadono, le celle sbloccate saranno meno di 9. Non provo a indovinare: **lo scoprirà la
pipeline leggendo il fondo**.

### Una trappola prevista e disinnescata in anticipo

Coi 2022, i 13 circuiti già giudicati arrivano a **k = 4 stagioni** — e per k = 4 **non
esiste una soglia congelata**: al giro scorso non era derivabile, c'erano solo 3 stagioni.
Rigiudicarli a k = 4 richiederebbe di derivare una soglia nuova **sui dati che deve
giudicare**: il righello che si misura da solo. Perciò è scritto nel prereg, prima di
avere i dati: **i 13 non si rigiudicano a k = 4 senza decisione del tavolo.** Il loro 2022
serve solo come controllo cieco.

---

## (3) Uso B — non eseguibile, ma il criterio è congelato adesso

Il test cieco su Austria e Bahrain è definito **ora**, prima di vedere un solo numero del
2022, e usa **solo costanti già congelate** — nessuna nuova soglia, nessun parametro a mano:

| esito | condizione su `d₂₀₂₂ = Δ_c,2022 − G₋c` |
|---|---|
| **CONFERMA** | stesso segno delle stagioni che l'hanno promosso **e** \|d₂₀₂₂\| ≥ **0,869** (la soglia congelata) |
| **CONFERMA PARZIALE** | stesso segno, \|d₂₀₂₂\| < 0,869 |
| **SMENTITA** | segno opposto |

Attese congelate: **Austria sotto** (le sue tre stagioni stanno a −1,17 dal globale),
**Bahrain sopra** (+1,01).

E la clausola che conta: **se il 2022 smentisce, non si corregge niente.** Le due letture —
"il 2022 non è la stessa macchina" oppure "il per-circuito era fragile" — non si
distinguono con questi dati. Si riporta la smentita e si aspetta il tavolo.

---

## (4) Fase C — la sorveglianza sa già del 2022, e scatterà da sola

**Il regime è cablato in un punto solo.** `fondo.py`:

```python
REGIME_SUOLO = '2022-25'
ANNI_SUOLO = (2022, 2023, 2024, 2025)
def regime(anno): ...
```

`elenco_blocchi()` scandisce le cartelle di `data/ti_archive/`: **il giorno in cui compare
`2022/`, le sue gare entrano nel regime da sole**, senza toccare una riga di codice. I
runner non contengono più la stringa `'2023-25'` come valore: usano la costante.

**Verificato che il cambio di nome non muove un solo numero** (stesse gare, stessa
partizione): Δ regime = +3,151 s IC95 [2,919 · 3,396] su 59 gare, LOYO per-circuito 0,337
contro globale 0,504, guadagno +0,167. Identici a prima.

**Migrata la linea di base** della sorveglianza (`Circuito|2023-25` → `Circuito|2022-25`)
perché il solo cambio di etichetta **non generasse transizioni spurie**: verificato,
`sorveglianza.py` continua a dire *«nessun cambiamento di stato»*, e le 13 celle di
partenza restano marcate come linea di base.

**Congelati per davvero, non per promessa**: `run_metro2.py` ora **si rifiuta** di
sovrascrivere `predizioni_congelate.json` e `sorveglianza_stato.json`; per farlo servono
`--rigenera --attore`. Lo sha256 del file congelato (`45d6f6e666152963`) è registrato nello
stato. Verificato che il file non è cambiato in tutta la sessione.

---

## La regola-stop non è più affidata alla mia disciplina: è cablata

> Il permutation-null è **zona a contatto umano obbligato**. Qualunque modifica — anche di
> puro determinismo — si ferma e la autorizza il tavolo. **Quella distinzione non la fa
> l'agente.**

`sigillo_null.py` sigilla lo **sha256 del sorgente** delle sei funzioni del null:

```
fenomeno_fuel.FenomenoFuel.null       aef09fded5059d86   il null di permutazione degli offset di stint
scheletro.cosa_so_fare                fcc82408c6308919   aggrega il null sulla stessa statistica dell'osservato
scheletro.bootstrap_a_blocchi         2d8f31f76783abaa   ricampionamento a blocchi: stesso genere di strumento
percircuito.null_etichette            7e57220e934ffcaa   null con le etichette di circuito rimescolate
percircuito.leave_one_year_out        6ee2112cefaf4f22   chiamata DENTRO il null: modificarla lo cambia
metro2.soglia_da_nulla                ff0bdcea5a97ed4a   deriva la soglia del metro dalla nulla
```

Ogni generatore lo verifica **prima di produrre un numero**; se è rotto, **non produce
numeri** e stampa la richiesta di autorizzazione. `cosa_so_fare` è sigillata intera anche
se contiene altro: un'edizione non correlata romperà il sigillo, ed è voluto — costringe a
guardare.

Non è un giudice: non uccide ipotesi, esce sempre 0. Impedisce solo che una modifica al
null passi inosservata.

`test_sigillo_null.py` — 4 verifiche, tutte PASS:

```
PASS  INTEGRO                col sigillo depositato la verifica passa
PASS  SCATTA                 alterato il sorgente del null, lo rompe e NOMINA la funzione
PASS  BLOCCA IL GENERATORE   col sigillo rotto, sorveglianza.py non produce numeri
PASS  SIGILLO NON RISCRITTO  sha256 invariato
```

`test_sorveglianza.py` continua a passare (idempotenza · scatta una volta sola · predizioni
sola lettura).

---

## (5) La frase onesta

> **Il 2022 non ha né rafforzato né indebolito il per-circuito: non c'è.** La domanda
> resta aperta esattamente com'era, ma il costo di risponderla è ora quasi zero — i
> criteri sono congelati, la pipeline è pronta, e il verdetto arriverà da sé.

Con una nota che vale più di un risultato mancato: **questo è il primo giro in cui il test
è cieco per costruzione e non per disciplina.** Il prereg è stato scritto quando i dati non
esistevano in nessuna forma; il criterio del test cieco è definito con soli numeri già
congelati; i file delle predizioni si rifiutano di essere riscritti; e la regola che ho
violato tre volte non dipende più dal mio giudizio, ma da un sigillo che ferma i
generatori.

**La prossima mossa è di Tommi**: popolare `data/ti_archive/2022/`. Poi bastano

```bash
python3 ai_lab/scienziato/sorveglianza.py     # emette i verdetti freschi, uno per cella
```

e il test cieco si giudica da solo.
