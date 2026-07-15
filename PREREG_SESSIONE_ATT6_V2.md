# Pre-registrazione — Taratura ATT6 v2

Data: 14 luglio 2026. Committata prima di qualsiasi numero nuovo. Vale per ogni attivazione futura di pit-loss, a partire da Spa (GP Belgio, 19/07/2026).

## Motivazione

ATT6 v1 (3 pit reali; soglia: 2/3 migliorati, 0 peggiorati) ha due lacune dimostrate:

1. Giudica un valore tipico contro una gara singola. Se la gara è anomala, boccia un valore corretto (Montreal 2026: loss gara 24,24 vs grappolo storico 19,71).
2. Tre casi di cui due tipicamente insensibili: un solo caso decide l'esito.

## Test 1 — Tipicità della gara demo

Grandezza: pit-loss mediano realizzato della gara demo (metodo per settori FastF1, stesso generatore del censimento FF3), confrontato con la mediana del grappolo storico 2018–2025 dello stesso circuito.

Regola: se |loss mediano della gara − mediana del grappolo| > 2,0 s → gara NON GIUDICABILE: né attivazione né rollback. Il valore candidato resta in attesa della prossima gara sul circuito.

Guardia strumentale: la stazionarietà dello strumento si verifica sul transito (pit-lane time), mai sul loss. Se il transito mediano della gara demo devia > 1,0 s dal grappolo storico dei transiti → il problema è nei dati/strumento, non nella gara: STOP e diagnosi; il Test 1 non si applica.

Nota di metodo: tipicità (sul loss) e stazionarietà (sul transito) sono due controlli su due grandezze diverse. Montreal 2026 = transito stabile + loss anomalo: gara atipica, strumento sano.

## Test 2 — Banco di sensibilità (minimo 5 casi)

Caso = pit stop reale della gara demo.

Caso SENSIBILE = al giro di rientro reale esistono almeno 2 auto entro ±5,0 s dal tempo cumulativo reale del pilota che rientra (rientro in gruppo compatto: ±5 s cambiano la posizione).

Selezione: deterministica, dai soli dati reali della gara (timing FastF1/TracingInsights), calcolabile PRIMA di eseguire il motore col valore candidato. È vietato selezionare o scartare casi dopo aver visto l'output del motore.

Si usano TUTTI i casi sensibili della gara (nessun sottoinsieme). Se i casi sensibili sono < 5 → gara NON GIUDICABILE per banco insufficiente.

Esclusioni: drive-through (rilevatore: `TyreLife` NON si azzera); piloti senza `pace[L]` valida secondo le regole già in vigore nel modulo pit.

## Verdetto

Per ogni caso sensibile: errore = |posizione prevista al rientro − posizione reale al rientro|, calcolato col valore in produzione (PRIMA) e col valore candidato (ADESSO). Caso migliorato / peggiorato / invariato.

PASS se: migliorati ≥ 3 E peggiorati = 0, oppure migliorati ≥ 3 × peggiorati (criterio di grandezza 3×).

Altrimenti NO-GO. Nessuna rilettura post-hoc. Una gara NON GIUDICABILE non è né PASS né NO-GO: il candidato resta in attesa.

## Riclassificazione retroattiva — Montreal 2026

Applicando il Test 1 ai numeri già misurati: |24,24 − 19,71| = 4,53 s > 2,0 s → gara NON GIUDICABILE (transito verificato stazionario nella diagnosi originale).

Il verdetto del rollback Montreal è riclassificato da "valore respinto" a "gara non giudicabile". La produzione NON cambia: Montreal resta 24,37. Il candidato 18,96 resta in attesa della prossima gara a Montreal. Report annotato: `NOTA_MONTREAL_NO_ATTIVAZIONE.md`.

## Dove vivono i documenti (14/07/2026)

Questo prereg è committato su `main`: governa ogni attivazione futura di pit-loss, a partire da Spa.

Il report che registra il rollback Montreal — `NOTA_MONTREAL_NO_ATTIVAZIONE.md`, che porta in testa l'annotazione di riclassificazione — vive solo sul branch `attivazione-montreal`, non su `main`. Il merge di quel branch è una decisione aperta, separata da questa pre-registrazione.

Conseguenza: chi legge `main` trova la regola, ma non il caso Montreal che l'ha generata. Debito registrato, non risolto qui.

[aggiornamento 16/07/2026: superato — la nota Montreal e' su main dal merge 27021a5; il debito qui dichiarato e' chiuso]

## Cosa questo commit NON fa

Nessun numero nuovo calcolato. Nessun valore di produzione toccato. Nessuna attivazione. Spa sarà giudicata solo nell'ordine: `aggiorna` → Test 1 (con guardia) → Test 2 → verdetto.

## ADDENDUM 1 — Metodo di misura del Test 1 (14/07/2026, prima di qualsiasi numero)

Cosa cambia: il Test 1 NON usa il metodo per settori del censimento FF3. Usa il metodo engine-ready (giro intero), applicato sia alla gara demo sia al grappolo storico 2018–2025.

Perché (due ragioni indipendenti):

1. FF3 è cieco per costruzione in un test di tipicità. FF3 è un censimento: scarta le osservazioni rumorose (regola ">2 settori affetti") per stimare un valore tipico robusto. Il Test 1 deve misurare la gara com'è, rumore incluso — è il rumore il segnale di atipicità. FF3 ha escluso proprio Montreal 2026, la gara che il Test 1 doveva dichiarare non giudicabile. Un test di tipicità che scarta le gare atipiche non può funzionare.
2. Gara e grappolo devono essere misurati con lo stesso metodo. I due metodi divergono di 0,58 s a Silverstone (20,80 settori / 20,22 engine-ready). Un loss engine-ready confrontato con una mediana per-settori introdurrebbe un bias sistematico di ~0,6 s dentro una soglia di 2,0 s.

L'engine-ready misura inoltre la grandezza che il motore consuma (secondi di giro).

Cosa NON cambia: soglie (tipicità 2,0 s; guardia transito 1,0 s), definizione di caso sensibile (≥2 auto entro ±5,0 s), minimo 5 casi, regola di verdetto (migliorati >= 3 E peggiorati == 0, oppure migliorati >= 3 × peggiorati), esclusione dei drive-through.

Stato al momento dell'addendum: nessun numero nuovo calcolato. La riclassificazione di Montreal (24,24 vs 19,71, scarto 4,53 s) era già engine-ready e resta valida: l'addendum la rende riproducibile, non la modifica.

## ADDENDUM 2 — Terzo esito possibile: banco insufficiente (14/07/2026, prima di qualsiasi numero)

Una gara con <5 casi sensibili è `NON GIUDICABILE (banco insufficiente)`: né PASS né NO-GO.

Se ciò accade su Silverstone in fase di validazione dello strumento, vale, dichiarato in anticipo:

* la soglia dei 5 casi non si abbassa per far passare Silverstone;
* Silverstone non si rollbacca: l'errore corretto (8,32 s) supera l'incertezza tra metodi (~0,6 s) di ~14×, ben oltre il criterio di grandezza 3×;
* lo strumento resta non validato in positivo e serve una seconda gara di validazione. In assenza di questa, nessuna attivazione a Spa: si rimanda.

## ADDENDUM 3 — Metrica di errore: diagnosi chiusa (14/07/2026)

Verificato su 6 casi (3 Montreal + 3 Silverstone): motore e realtà usano campi di cardinalità diversa (il motore esclude i piloti senza `pace[L]`), ma i piloti esclusi erano in tutti e 6 i casi dietro al pilota che rientra. Cambia il denominatore, mai il rango: gli errori non cambiano. Nessuna correzione necessaria.

Cautela residua: gli esclusi sono tipicamente piloti appena usciti dai box, quindi tipicamente dietro — non necessariamente. Lo strumento v2 stampa sempre entrambi i denominatori e segnala se un pilota escluso risulta davanti al pilota che rientra. Segnalazione, non blocco.

## ADDENDUM 4 — Forma finale, semplificata (14/07/2026). Sostituisce l'apparato dei Test 1/2.

Principio: la decisione di attivare una correzione la prende il criterio di grandezza (guadagno atteso > 3× incertezza della correzione), legge di progetto. ATT6 è uno smoke test con checkpoint umano al merge: serve ad accorgersi del catastrofico, non a ri-decidere il merito. Un KPI di precisione non blocca una decisione di grandezza.

ATT6 v2 finale — un solo script, tre output, decisione umana al merge:

1. Tipicità (unico gate automatico): |loss mediano engine-ready della gara demo − mediana engine-ready del grappolo 2018–2025 dello stesso circuito| ≤ 2,0 s → gara GIUDICABILE. Altrimenti NON GIUDICABILE: né attivazione né rollback, il candidato aspetta la prossima gara.
2. Tabella completa: tutti i pit reali della gara (drive-through esclusi: tyre_age che non si azzera), colonne caso | sensibile? | PRIMA | ADESSO | REALE | esito. Sensibile = ≥2 auto entro ±5,0 s al rientro reale, calcolato dai soli dati reali. Nessun numero minimo di casi: quanti sono, sono.
3. Una regola dura: se un caso SENSIBILE peggiora, l'attivazione non è automatica: quel caso va guardato e spiegato prima di attivare (principio: mai un consiglio peggiore di quello che l'utente avrebbe da solo). Tutto il resto è informativo.

Cosa decade rispetto agli Addendum 1–3: la guardia strumentale sul transito come gate (il Δtransito si stampa come riga informativa); il minimo di 5 casi e l'esito "banco insufficiente"; il verdetto automatico PASS/NO-GO; l'obbligo di validazione positiva dello strumento; ogni piano di contingenza. Resta valido dall'Addendum 1 il metodo engine-ready per gara e grappolo; dall'Addendum 3 la diagnosi della metrica (chiusa) e la segnalazione se un pilota escluso dal field del motore risulta davanti.

Riclassificazione Montreal: invariata (scarto ~4,5 s > 2,0 s → NON GIUDICABILE). Differenze al centesimo nella definizione del grappolo sono dichiarate irrilevanti: sotto il decimo di secondo non si discute.

Questo addendum chiude la taratura. Il prereg non si tocca più prima di Spa.
