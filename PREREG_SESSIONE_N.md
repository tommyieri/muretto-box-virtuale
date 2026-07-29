# PREREG — Sessione N: "neutralizzazione-verita"

**Committato PRIMA di qualsiasi calcolo di analisi.** Git prova metodo-prima-dei-risultati:
questo file entra nella storia prima di `gen_neutralizzazione_v2.py`, dei CSV di output e del
REPORT. Le uniche letture dati precedenti a questo commit sono state ispezioni di *formato*
(chiavi dei JSON, tipo dei campi) e due `Counter` di `status` su Australia/Gran Bretagna per
capire che il vocabolario ha codici non documentati (`2`, `7`): NON è l'enumerazione N1, NON è
nessuna metrica N2–N5.

Vincoli di sessione (dal mandato): NON si tocca kernel, modulo pit, gancio degrado, golden,
`neutralizzazione.json`, `sc_safety_car.csv`, `neutralization_model_2026.csv`, né alcun file di
produzione. Nessun modello. Nessuna sostituzione: si produce una **PROPOSTA**. Nessun merge.

Branch: `neutralizzazione-verita` (da `main` @ 89d46e4).

---

## Obiettivo

Capire se la neutralizzazione (SC/VSC/RF) nel repo è una fonte *sana* — cioè se una
classificazione corretta dei regimi produce rapporti tempo-giro fisicamente plausibili — oppure
se è ancora rotta. Il deliverable che vale la sessione da solo è il **vocabolario degli status**
(N1), oggi scritto da nessuna parte.

## Fonti dati (campione)

- **Archivio storico** `data/ti_archive/{2023,2024,2025,2026}/<GP>/Race.json` — formato dict di
  liste colonnari; campo `status` per-riga (= per-auto-per-giro), stringa.
- **Cache demo 2026** `data/ti_cache/*.json` — 8 gare (Australia, Cina, Giappone, Miami, Canada,
  Monaco, Barcelona, Austria), stesso schema colonnare.
- **Registro** `data/gare_registro.json` — 9 gare demo (le 8 sopra + Gran Bretagna via
  ti_archive/2026). I circuiti (`cid`) del registro sono i **9 circuiti** del test N4.
- **Fonti derivate esistenti**: `demo/neutralizzazione.json` (finestre per-gara),
  flag per-auto `neutralized` = `engine._neut(status)` = (`'4' in s`) or (`'6' in s`).
  Orfani candidati: `data/sc_safety_car.csv`, `data/neutralization_model_2026.csv`.

## Regola committata di decodifica (da NON reinventare)

Da `gen_neutralizzazione.py` e `NEUTRALIZZAZIONE_NOTA.txt`, **committato**:
`'4'` = SC, `'6'` = VSC, `'5'` = bandiera rossa. `_neut` considera neutralizzato un giro-auto se
lo status contiene `'4'` o `'6'`. Tutto il resto (`'1'`, `'2'`, `'7'`, e le concatenazioni) NON
ha decodifica committata: in N1 va documentato ciò che è committato e va **dichiarato esplicito**
ciò che è ipotesi non committata (marcato come tale, non spacciato per verità).

---

## Metodo per fase

### N0 — Inventario fonti
Per ogni fonte: generatore committato? chi la consuma (grep nel repo)? Il modulo pit quale usa?
Fonte senza generatore ⇒ **orfano dichiarato**.

### N1 — Vocabolario status (DELIVERABLE PRINCIPALE)
Enumerare TUTTI i valori distinti di `status` in ti_archive (2023–25) e nel formato 2026
(ti_cache + ti_archive/2026), con **frequenze assolute**. Decodificare ogni codice atomico e ogni
codice composto (concatenazione di stati within-lap) col significato fisico. Output:
`data/status_vocabolario.csv`. Ogni codice o è decodificato-committato o è marcato
`ipotesi_non_committata`.

### N2 — Classificazione a due livelli
- **(A) EVENTO per-gara**: finestre [giro_inizio, giro_fine] per SC e VSC separatamente, con
  deploy/restart marcati SEPARATAMENTE dal regime. Regimi:
  `VERDE / SC_DEPLOY / SC_REGIME / SC_RESTART / VSC_DEPLOY / VSC_REGIME / VSC_RESTART / RED /
  MISTO_NON_CLASSIFICABILE`.
- **(B) IMPATTO per-auto-per-giro**: ogni giro-auto riceve il suo regime, che PUÒ differire da (A).
Riportare matrice di contingenza (A)×(B), e (A)/(B) × fonti esistenti (json, flag).
Output: `data/neutralizzazione_due_livelli.csv`.

**Regole di derivazione pre-registrate (per non aggiustarle a posteriori):**
- deploy = primo giro di una finestra neutralizzata (transizione verde→neutro); restart = ultimo
  giro della finestra (transizione neutro→verde). Regime = i giri interni.
- finestra SC per-gara = run massimale di giri con ≥2 auto aventi `'4'`; idem VSC con `'6'`
  (stessa soglia del json committato, per confrontabilità). Tipo in caso di sovrapposizione SC/VSC
  nella stessa finestra ⇒ MISTO_NON_CLASSIFICABILE.
- Impatto per-auto (B): il regime del giro-auto è dettato dal suo status atomico prevalente al giro
  (`'4'`→SC, `'6'`→VSC, `'5'`→RED, altrimenti VERDE); deploy/restart per-auto = il primo/ultimo
  giro-auto neutralizzato del suo run individuale.

### N3 — Riconciliazione json vs flag
Prendere UNO PER UNO i giri su cui `neutralizzazione.json` (finestra di gara) e il flag per-auto
`neutralized` discordano, sulle 9 gare demo. Per ciascuno: gara, giro, auto, status grezzo, json,
flag, e quale ha ragione secondo N2. Conclusione motivata sulla soglia `>=2 auto`.

### N4 — Test di validazione fisica (IL GIUDICE)
Per ciascuno dei **9 circuiti** del registro, pooled su tutte le stagioni disponibili in
ti_archive, per ogni regime N2:
`R_lap[regime] = mediana(tempo_giro nel regime) / mediana(tempo_giro VERDE)`, usando i giri di
TUTTO il campo. Escludere deploy/restart (misti) e giri RED. Riportare n giri per cella.
Output: `data/rlap_per_regime.csv`.

**VERDETTO PRE-REGISTRATO:**
- SC_REGIME R_lap ∈ **[1,30 – 1,80]** *e* VSC_REGIME R_lap ∈ **[1,20 – 1,50]** su **≥6/9 circuiti**
  ⇒ **FONTE SANA**
- fuori range su **≥4 circuiti** ⇒ **FONTE ANCORA ROTTA** — nessuna proposta, si chiude, il debito
  resta aperto, nessuno costruisce sulla neutralizzazione.
- **3 circuiti** fuori ⇒ **AMBIGUO** — nessuna proposta.
- (2 fuori è coperto da "≥6/9 dentro" ⇒ SANA; il caso 3-fuori è esplicitamente AMBIGUO.)

**CONFRONTO OBBLIGATORIO:** ricalcolare R_lap con la classificazione VECCHIA (json puro: un giro è
"neutralizzato" se cade in una finestra `sc`∪`vsc` del json, senza separare deploy/restart).
Atteso ~**1,12**. Se la nuova classificazione porta il valore nel range fisico ⇒ sappiamo cosa era
rotto (la classificazione). Se dà ancora ~1,12 ⇒ la classificazione NON era il problema: si dice
chiaramente.

### N5 — Impatto sistema (mappatura, NON modifica)
Per ogni consumatore N0 (modulo pit, soppressione gap C1, undercut): quanti casi cambierebbero
adottando N2, e quali dei golden pit 11/11 cambierebbero valore atteso, **e di quanto** (calcolato).
NON modificare nulla.

### N6 — Proposta (SOLO se N4 = FONTE SANA)
`PROPOSTA_NEUTRALIZZAZIONE.md`: fonte unica a due livelli con generatore committato; vocabolario;
consumatori da migrare in ordine con impatto golden calcolato; procedura di rollback; cosa NON
garantisce.

---

## Criteri di fallimento (dichiarati)

1. **N1 incompleto**: se anche un solo codice status resta senza riga nel vocabolario ⇒ il
   deliverable principale è FALLITO e va detto in cima al report ("tutti decodificati? NO").
2. **N4 ANCORA ROTTA** (≥4 circuiti fuori range) ⇒ **nessuna proposta**, N6 non prodotto, debito
   resta aperto. Lo si scrive senza attenuazioni.
3. **N4 AMBIGUO** (3 circuiti fuori) ⇒ nessuna proposta.
4. **N4 confronto**: se la classificazione nuova NON sposta il valore vecchio (~1,12) dentro il
   range, si dichiara che la classificazione non era il problema.
5. Qualsiasi tocco a file di produzione ⇒ violazione del mandato (non deve accadere).

## Output attesi

- `PREREG_SESSIONE_N.md` (questo file, committato per primo)
- `gen_neutralizzazione_v2.py` — generatore committato
- `data/status_vocabolario.csv` (N1)
- `data/neutralizzazione_due_livelli.csv`, `data/rlap_per_regime.csv`
- `REPORT_NEUTRALIZZAZIONE.md` con in cima le tre righe di verdetto
- `PROPOSTA_NEUTRALIZZAZIONE.md` solo se N4 = FONTE SANA

Nessun verdetto strategico: è del PO.
