# PREREG — i due usi del 2022, scritti PRIMA che i dati esistano

Branch `ai-lab/scienziato-fuel-2022`, 21/07/2026. Prosecuzione di `PREREG_metro2.md`
(commit 8d2d567).

**Stato al momento della scrittura: il 2022 NON è nel fondo.** `data/ti_archive/` contiene
2023, 2024, 2025, 2026 e nient'altro; nessun file del repo nomina il 2022; nessuno
script di ingestione lo prevede. Questo prereg è quindi scritto **alla cieca in senso
forte**: nessun numero del 2022 è stato visto da nessuno mentre lo si scriveva. Quando i
dati arriveranno, il test sarà cieco per costruzione, non per promessa.

## 0. La chiamata di dominio

Tommi ha stabilito che il **2022 è la stessa era regolamentare a effetto suolo** del
2023-25, utilizzabile ai fini carburante/passo. Il regime tecnico si chiama ora
**"2022-25"**, cablato in un punto solo (`fondo.py: REGIME_SUOLO`, `ANNI_SUOLO`). Il
confine col 2026 resta invalicabile.

## 1. USO A — dati freschi per le celle indecidibili

Col 2022, una cella con 2 stagioni ne avrà 3 e diventerà giudicabile. Si applica il metro
**già congelato** al commit 8d2d567:

- (i) **segno stabile** rispetto a `G₋c` (globale del regime, escluso il circuito stesso);
- (ii) **distanza netta**: `D_c ≥ 0,869 s` — la **soglia congelata per k = 3**.

> **La soglia NON si rideriva.** Riderivarla includendo il 2022 significherebbe tarare il
> righello sui dati che deve misurare. Se emergesse la tentazione — per esempio "ora con
> quattro stagioni la nulla è diversa" — **l'agente si ferma e la porta al tavolo**:
> cambiare la soglia è decisione umana, mai automatica.

**Trappola prevista e dichiarata ora**: i 13 circuiti già giudicati passeranno a **4**
stagioni, e per k = 4 **non esiste** una soglia congelata (al giro scorso non era
derivabile: c'erano solo 3 stagioni). Quindi **non si rigiudicano i 13 a k = 4**. Serve
una decisione del tavolo. Il loro 2022 si usa solo come controllo cieco (§2).

## 2. USO B — il test cieco su Austria e Bahrain

Austria e Bahrain sono stati promossi **senza vedere il 2022**. Il 2022 è il loro controllo
indipendente. Criterio, dichiarato ora, che usa **solo numeri già congelati** (nessuna
costante nuova, nessuna soglia nuova):

Sia `d₂₀₂₂ = Δ_c,2022 − G₋c`, con `G₋c` calcolato sul regime.

| esito | condizione |
|---|---|
| **CONFERMA** | `d₂₀₂₂` ha lo **stesso segno** delle stagioni che l'hanno promosso **e** `\|d₂₀₂₂\| ≥ 0,869` (la soglia congelata) |
| **CONFERMA PARZIALE** | stesso segno, ma `\|d₂₀₂₂\| < 0,869` |
| **SMENTITA** | segno **opposto** |

Attese congelate: **Austria sotto** (le sue tre stagioni stanno a −1,17 dal globale),
**Bahrain sopra** (+1,01).

**Se il 2022 smentisce, NON si corregge niente.** Le due letture possibili — "il 2022 non
è la stessa macchina" oppure "il per-circuito era fragile" — non si distinguono con questi
dati, e scegliere fra loro è decisione del tavolo. L'agente riporta la smentita e si ferma.

## 3. Che cosa sbloccherebbe il 2022 (aritmetica sul fondo, non previsione)

Delle 11 celle indecidibili, **9 hanno esattamente 2 stagioni**: una gara 2022 le porta a
3 e le rende giudicabili. Due (**Belgio** e **Gran Bretagna**) ne hanno una sola e
resterebbero indecidibili anche col 2022.

Condizione: che quella gara 2022 **esista** e **superi i guardrail** (asciutta, rango
pieno, potenza minima). Non lo assumo: lo scoprirà la pipeline leggendo il fondo. Due
aspettative da verificare — **non fatti del fondo**, marcate come tali: il GP di Cina 2022
potrebbe non essersi corso, e Monaco 2022 potrebbe cadere sul filtro pioggia. Se cadono,
le celle sbloccate saranno meno di 9.

## 4. Regola-stop affinata — cablata, non solo dichiarata

> **Il permutation-null è ZONA A CONTATTO UMANO OBBLIGATO.** Qualunque modifica ad esso —
> anche di puro determinismo: seme, ordinamento, tipo di hash — si ferma e si dichiara
> prima, e la autorizza il tavolo. **Niente più auto-giudizio "questa è determinismo, non
> metodo": quella distinzione non la fa l'agente.**

È successo tre volte. Da qui in avanti la regola non è affidata alla disciplina
dell'agente: è **cablata** in `sigillo_null.py`. Il sigillo è lo sha256 del *sorgente*
delle funzioni del null; ogni generatore lo verifica prima di produrre un numero e, se è
rotto, **non produce numeri**. Copertura dichiarata: `FenomenoFuel.null`,
`scheletro.cosa_so_fare` (contiene l'aggregazione del null), `scheletro.bootstrap_a_blocchi`,
`percircuito.null_etichette`, `percircuito.leave_one_year_out`, `metro2.soglia_da_nulla`.
Verificato da `test_sigillo_null.py`.

Il sigillo non è un giudice: non uccide ipotesi e non decide nulla. Impedisce solo che una
modifica al null passi inosservata.

## 5. Congelamento delle predizioni

`predizioni_congelate.json` e `sorveglianza_stato.json` **non si riscrivono**: i generatori
si rifiutano di sovrascriverli senza `--rigenera --attore`. Una predizione che si riscrive
non è congelata, e il test cieco non varrebbe più niente. Lo sha256 del file congelato è
registrato nello stato.

## 6. Cosa non si fa

Non si ricostruisce il 2022 da altre fonti. Non si monta niente. Kernel di produzione
intatto. Nessun push, nessuna PR, nessun merge.
