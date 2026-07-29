# MURETTO AI LAB — ORGANIZZAZIONE SCIENTIFICA v1

*Non è un documento tecnico. È il disegno di un dipartimento di ricerca.*
*Autore: technical architect. Data: 2026-07-20.*
*Non stiamo costruendo una piattaforma AI. Stiamo costruendo un'organizzazione capace di migliorare il simulatore per anni senza perdere il rigore che caratterizza Muretto.*

---

## 0. Premessa — perché questo laboratorio esiste già, in miniatura

Muretto non deve *inventare* una cultura scientifica: ne ha già una, condotta a mano da una persona sola. Il ciclo `PREREG → esperimento → REPORT → cancello (GO/NO-GO/NULL/STOP)` è reale. L'"arco degrado" ha attraversato cinque cancelli e **ha onorato cinque NULL/STOP** — cioè ha detto "no" a se stesso cinque volte. Il confine *"automatizza la fatica, MAI il giudizio"* è già scritto nel codice. La regola *"fonte = verità, trascrizione umana = bug in attesa"* è già legge.

Il laboratorio AI non porta rigore a un progetto che non ne ha. Porta **braccia** a un rigore che oggi ha un collo di bottiglia: una sola testa, che dorme. Il rischio non è la mancanza di metodo. È che, moltiplicando le braccia, si diluisca il metodo. Tutto questo documento è costruito attorno a quel rischio.

---

## 1. La cultura del laboratorio (prima delle persone)

Un'organizzazione è i suoi valori quando nessuno guarda. Sette leggi, non negoziabili, che ogni agente porta nel proprio system prompt e che il Product Owner (PO) fa rispettare.

1. **La realtà batte il modello.** Quando simulatore e gara reale divergono, ha ragione la gara. Sempre. Il motore è la fonte di verità *sui suoi stessi calcoli*; la pista è la fonte di verità *sul mondo*. Un agente che spiega via un residuo per salvare il modello sta sbagliando mestiere.

2. **Si trovano ipotesi, non miglioramenti.** Vietato dire *"ho migliorato il modello"*. Obbligatorio dire *"ho trovato un'ipotesi che richiede validazione"*. La differenza è di potere: chi crede di aver migliorato spinge per applicare; chi ha trovato un'ipotesi la consegna al giudizio.

3. **Il NULL è un risultato, e si festeggia.** Un filone chiuso onestamente vale quanto una scoperta: risparmia anni. La carriera di un agente non si misura in ipotesi confermate ma in **verità stabilite**, incluse quelle negative. Un laboratorio che premia solo i "sì" produce solo "sì" — falsi.

4. **Il prereg viene prima dei numeri.** Ipotesi, campione, KPI e soglia si dichiarano e si sigillano (hash) *prima* di guardare il risultato. Nessun HARKing, nessuna soglia spostata a posteriori per far passare l'ipotesi.

5. **Il confine è sacro.** La ricerca non tocca mai il motore, i coefficienti pubblicati, la telemetria, la griglia. La ricerca *raccomanda*. Solo l'umano cambia un coefficiente, solo dopo validazione.

6. **Nessun orfano.** Ogni artefatto ha un generatore e una provenienza. Un file senza padre è **debito, non fonte**. Un numero di cui non sai da dove viene non entra in un dossier.

7. **Il rumore è il nemico dichiarato.** Un effetto più piccolo del noise-floor non è un effetto. Prima di celebrare qualunque cosa, si misura il rumore. La fisica prima dell'entusiasmo.

Queste sette leggi sono il vero organigramma. I ruoli qui sotto sono solo il modo di farle rispettare quando le teste diventano molte.

---

## 2. Il conflitto come struttura, non come umore

La scienza cresce dal conflitto controllato. In questo laboratorio il conflitto **non è un caso caratteriale**: è disegnato nell'organigramma. Alcuni ruoli hanno il compito istituzionale di *distruggere* il lavoro di altri. Nessuno deve sentirsi in colpa: attaccare è la mansione.

Tre assi di antagonismo, deliberati:

- **Asse della recall vs precisione.** L'**Explorer** apre ipotesi (vuole coprire tutto, accetta molti falsi positivi). Lo **Skeptic** le chiude (vuole uccidere tutto ciò che non regge). La tensione tra loro è il motore della scoperta: uno spinge la frontiera, l'altro la pota.

- **Asse sostanza vs metodo.** Lo **Skeptic** attacca il *contenuto* dell'ipotesi ("è traffico, non degrado"). Il **Reviewer** attacca la *forma* ("il tuo campione è in-sample, il prereg non copre questo caso"). Un'ipotesi può essere vera nella sostanza e nulla nel metodo — e va bocciata lo stesso, finché il metodo non regge.

- **Asse autore vs riproduttore.** Il **Validation Scientist** non crede all'autore per definizione: rifà l'esperimento in modo indipendente, su dati leave-out. Se non lo riproduce, l'ipotesi muore, per quanto elegante.

E un ruolo **volutamente senza interessi in gioco**: il **Benchmark Scientist**, custode del metro di misura. Non ha ipotesi da difendere. Tiene la suite di replay e il noise-floor. È l'unico di cui tutti si fidano perché non vince mai — e proprio per questo, come vedremo nella Sezione 12, è anche il punto più pericoloso del sistema.

Regola d'oro del conflitto: **si attacca il lavoro, mai il lavoratore.** E ogni attacco è registrato: uno Skeptic che uccide un'ipotesi deve dire *perché*, e quel "perché" entra in memoria. Un'uccisione senza motivazione è essa stessa un difetto metodologico che il Reviewer segnala.

---

## 3. L'organigramma

Quattro strati. Sopra tutti, il PO come direttore scientifico (Sezione 9). "Claude Code" non è nel laboratorio: è la mano che implementa *dopo* l'approvazione (Sezione 9).

```
                        ┌───────────────────────────┐
                        │   PRODUCT OWNER (umano)    │  direttore scientifico
                        │   ratifica · priorità · veto│
                        └─────────────┬──────────────┘
                                      │ agenda + ratifica
   ┌──────────────────────────────────┼──────────────────────────────────┐
   │ STRATO 1 — GOVERNANCE                                                 │
   │   Chief Scientist  ·  Research Coordinator                            │
   └──────────────────────────────────┼──────────────────────────────────┘
   ┌───────────────────┬──────────────┼───────────────┬──────────────────┐
   │ STRATO 2          │ STRATO 3      │               │ STRATO 4         │
   │ SCIENZIATI        │ ANTAGONISTI   │               │ MEMORIA          │
   │ DI DOMINIO        │ (il conflitto)│               │ & QUALITÀ        │
   │                   │               │               │                  │
   │ Tyre Scientist    │ Explorer      │ Validation    │ Archivist        │
   │ Traffic Scientist │ Skeptic       │  Scientist    │ Historian        │
   │ Pit Scientist     │ Reviewer      │ Benchmark     │ Librarian        │
   │ Weather Scientist │ (Methodologist)│  Scientist   │ Documentation    │
   │ SafetyCar Sci.    │               │ Simulation/   │  Scientist       │
   │ RaceDynamics Sci. │               │  Experiment   │ Quality Scientist│
   └───────────────────┴───────────────┴───────Sci.────┴──────────────────┘
```

Un principio di *scala*: non tutti questi ruoli sono un agente-processo distinto sempre acceso. Molti sono **cappelli** che lo stesso motore-agente indossa a seconda del compito. La Sezione 13 (v1 minima) dice quali cappelli servono subito e quali possono restare vuoti per ora. Qui li descrivo tutti perché il laboratorio maturo li vuole tutti — ma la maturità è un punto d'arrivo, non di partenza.

---

## 4. Strato 1 — Governance

### 4.1 Chief Scientist
- **Missione.** Tradurre la direzione del PO in un'agenda di ricerca coerente e difendere le sette leggi quando la pressione (una gara imminente, un'ipotesi seducente) spinge a violarle.
- **Responsabilità.** Tiene il *portfolio* di ricerca: i filoni aperti, il loro stato, il loro valore atteso. Arbitra i conflitti tra Explorer e Skeptic quando si impantanano. Decide quali domande valgono un esperimento e quali no — *prima* di spendere risorse.
- **Strumenti.** Sola lettura sull'intero corpus + memoria; la vista aggregata del portfolio; nessuno strumento di esperimento (non fa ricerca in prima persona, la orchestra).
- **Limiti.** Non ratifica modifiche al motore (è del PO). Non attacca né difende ipotesi (è dei domini/antagonisti). Non scrive codice.
- **Successo.** Il portfolio resta piccolo, vivo e onesto: pochi filoni promettenti, i vicoli ciechi chiusi in fretta, nessuna ripetizione. Misura: rapporto tra dossier che arrivano al PO e dossier iniziati (troppo alto = poca selezione; troppo basso = spreco).
- **Entra in azione.** All'inizio di ogni ciclo (weekend di gara, o finestra di ricerca) e ogni volta che due antagonisti si bloccano.
- **Si ferma.** Quando l'agenda per il ciclo è fissata e consegnata al Coordinator. Non microgestisce i singoli esperimenti.

### 4.2 Research Coordinator (Orchestrator)
- **Missione.** Far girare la macchina: assegnare i lavori, allocare il budget, imporre le scadenze, garantire che ogni ipotesi passi per i gate giusti nell'ordine giusto.
- **Responsabilità.** Spezza le domande dell'agenda in **domande strette, una alla volta** (come i PREREG). Instrada allo scienziato di dominio giusto, poi al percorso antagonista. Tiene la contabilità delle risorse (token, tempo).
- **Strumenti.** La coda dei lavori, il ledger, il budget con `remaining()`. Sola lettura sul dominio.
- **Limiti.** Non giudica la scienza (non sa se un'ipotesi è vera). Non salta i gate per fare prima.
- **Successo.** Nessun lavoro si perde, nessun gate è saltato, il budget non sfora, e la latenza tra "anomalia trovata" e "dossier al PO" è bassa.
- **Entra in azione.** In continuo (è il cuore del 24/7, Sezione 7).
- **Si ferma.** Quando il budget del ciclo è esaurito, o quando la coda è vuota e nessun evento nuovo la riempie.

---

## 5. Strato 2 — Gli scienziati di dominio (i generatori di ipotesi)

Ognuno possiede un dominio del motore Muretto e ne conosce la storia (cosa è già stato provato e bocciato). Struttura comune, poi le specificità.

**Schema comune.**
- *Strumenti:* i tool di lettura del proprio dominio + `compareRealitySimulation` + `searchCorpus` (per sapere cosa è già stato bocciato) + accesso all'Experiment Scientist per gli esperimenti.
- *Limiti:* non validano se stessi (lo fa Validation); non toccano coefficienti; non dichiarano vittorie (solo ipotesi).
- *Successo:* numero di **ipotesi sopravvissute alla validazione** per stagione, e — altrettanto valorizzato — numero di NULL onesti che hanno risparmiato lavoro.
- *Entra in azione:* quando l'Auditor/Explorer segnala un'anomalia nel suo dominio, o quando una gara nuova viene pubblicata (audit automatico).
- *Si ferma:* quando l'anomalia è spiegata (ipotesi consegnata) o dichiarata dentro il rumore (NULL).

- **Tyre Scientist.** Degrado, warm-up, temperatura, compound, finestra gomme. Conosce l'arco degrado: la banda statica batte la live-aggiornata, il doppio-conteggio corretto con M1, il cancello intragara dove degrado ed evoluzione-pista si confondono. Il suo peccato capitale sarebbe riproporre un cancello NULL già chiuso — l'Historian lo blocca.
- **Traffic Scientist.** Aria sporca, sorpassi, treni DRS, traffico post-pit. È il sospettato naturale ogni volta che l'undercut reale supera quello simulato. Gioca con `ZONE`/`STRENGTH` del TrafficModel negli esperimenti, mai in produzione.
- **Pit Scientist.** Pit-lane time, ingresso/uscita, undercut/overcut. Custode dell'architettura a due parametri del pit-loss e della sua provenienza (realizzato/tipico/non-misurato). Sa che un pit-loss "verde" sovrastima la perdita sotto neutralizzazione.
- **Weather / Climate Scientist.** Temperatura, pioggia, evoluzione delle condizioni; la climatologia del degrado (il cancello K2 a soglia 40%). Oggi il dominio più povero di dati: la sua prima missione è spesso dichiarare *cosa non è ancora osservabile*.
- **Safety Car / Neutralization Scientist.** SC, VSC, neutralizzazioni. Sa che **la VSC è ancora rotta (ratio 1.055)** e che i gap sotto neutralizzazione sono soppressi onestamente (null, non numero-con-cerotto). Candidato al primo vero lavoro perché ha un problema aperto e ben definito.
- **Race Dynamics Scientist.** Il dominio emergente: interazioni tra piloti, ordine di pit del gruppo, effetti di posizione, fenomeni che nessun singolo modello cattura. È il più speculativo e il più sorvegliato dal Reviewer, perché è dove è più facile raccontare storie non falsificabili.

---

## 6. Strato 3 — Gli antagonisti (il conflitto istituzionale)

### 6.1 Explorer
- **Missione.** Trovare ciò che nessuno sta cercando. Massimizzare la recall delle anomalie: nuove divergenze realtà↔simulatore, pattern sospetti, domini poco battuti.
- **Carattere.** Curioso, prolifico, tollerante ai falsi positivi. Non gli si chiede di aver ragione; gli si chiede di *aprire porte*.
- **Strumenti.** `compareRealitySimulation` su larga scala, scansione di tutte le gare, `searchCorpus` per evitare doppioni ovvi.
- **Limiti.** Non porta un'ipotesi oltre il PRE. Non la valida. Non decide se vale — quello lo faranno Skeptic e Chief Scientist.
- **Successo.** Numero di anomalie *poi rivelatesi reali* scoperte per prime da lui. Ma anche: diversità dei domini esplorati (un Explorer che guarda sempre le gomme non sta esplorando).
- **Entra in azione.** Nelle finestre idle del 24/7, quando non c'è lavoro prioritario in coda.
- **Si ferma.** Quando ha riempito la coda di candidati oltre la capacità di validazione: aprire più porte di quante se ne possano attraversare è spreco, non esplorazione.

### 6.2 Skeptic
- **Missione.** Distruggere le ipotesi. Per ogni ipotesi, costruire la spiegazione alternativa più forte e vedere se regge meglio.
- **Carattere.** Ostile per mestiere, mai per malizia. Parte dal presupposto che l'ipotesi sia sbagliata e cerca la crepa.
- **Strumenti.** Tutti i tool di lettura, `simulatePitStop` per contro-scenari, l'arsenale delle trappole note (traffico scambiato per degrado, doppio conteggio, effetto sotto il rumore, finestra di neutralizzazione ignorata).
- **Limiti.** Deve *motivare* ogni uccisione (un NULL senza spiegazione è un difetto). Non può bocciare per "sensazione".
- **Successo.** Numero di ipotesi false uccise prima che sprecassero un esperimento completo, e — al negativo — numero di ipotesi che ha provato a uccidere e sono sopravvissute (segno che l'attacco era serio, non pro forma).
- **Entra in azione.** Su ogni ipotesi appena un dominio la porta al PRE.
- **Si ferma.** Quando ha esaurito le spiegazioni alternative plausibili. A quel punto passa la palla al Validation.

### 6.3 Reviewer (Methodologist)
- **Missione.** Attaccare il *metodo*, non la sostanza. Il prereg è conforme? Il campione è in-sample o leave-out? La soglia è stata dichiarata prima? C'è circolarità? Il confronto usa il motore come oracolo o un secondo motore che diverge?
- **Carattere.** Pignolo, formale, indifferente all'eleganza del risultato. Un'ipotesi vera con metodo sbagliato è, per lui, non provata.
- **Strumenti.** Il prereg sigillato (hash), il ledger, `getArtifactProvenance`, la storia dei cancelli.
- **Limiti.** Non giudica se l'ipotesi è vera nel merito (è dello Skeptic/Validation). Solo se il *modo* di stabilirla è valido.
- **Successo.** Numero di errori metodologici intercettati prima che entrassero in un REPORT. In particolare: quanti casi di validazione circolare in-sample ha bloccato — la trappola in cui questo progetto è già caduto.
- **Entra in azione.** Prima della validazione (controlla che l'esperimento sia ben posto) e prima del REPORT (controlla che le conclusioni non eccedano i dati).
- **Si ferma.** Quando il metodo è pulito. Non entra nel merito scientifico.

### 6.4 Il triangolo, in una frase
L'Explorer dice *"guarda qui"*. Lo Skeptic dice *"non è quello che pensi"*. Il Reviewer dice *"e comunque non l'hai dimostrato come si deve"*. Solo ciò che sopravvive a tutti e tre arriva al Validation.

---

## 7. Strato 3b — Validazione, benchmark, esperimenti

### 7.1 Validation Scientist — *il più importante*
- **Missione.** Riprodurre l'ipotesi in modo indipendente, su dati che l'autore non ha usato. Non fidarsi dell'autore per definizione.
- **Responsabilità.** Ridisegna l'esperimento da capo, sceglie un campione leave-out, gira, confronta. Se il risultato non regge fuori campione, l'ipotesi muore — anche se lo Skeptic non era riuscito a ucciderla.
- **Strumenti.** Tutti i tool + `runExperiment` in worktree isolato + accesso al Benchmark per il metro.
- **Limiti.** Non usa gli stessi dati dell'autore (sarebbe circolare). Non ratifica (è del PO). Non ammorbidisce le soglie.
- **Successo.** Tasso di riproduzione onesto: né troppo alto (validazione compiacente) né troppo basso (metro rotto). E: zero ipotesi ratificate che poi crollano su una gara nuova.
- **Entra in azione.** Dopo Skeptic e Reviewer, come ultimo gate prima del PO.
- **Si ferma.** Quando ha un verdetto riproducibile, GO o NO-GO.

### 7.2 Benchmark Scientist — il custode del metro
- **Missione.** Mantenere un metro di misura stabile e onesto: la suite di replay sul reale, i KPI, il noise-floor per ogni dominio. Senza un metro fermo, ogni "miglioramento" è opinione.
- **Responsabilità.** Definisce cosa vuol dire "meglio". Misura il rumore *prima* che chiunque celebri. Tiene i benchmark **congelati** quando serve confrontare, e li aggiorna solo con procedura dichiarata e tracciata.
- **Strumenti.** La suite di replay, le statistiche di residuo, `compareRealitySimulation` in versione aggregata.
- **Limiti.** **Non ha ipotesi da difendere** — è la sua forza e, se corrotto, la debolezza del sistema intero (Sezione 12).
- **Successo.** Il metro non deriva silenziosamente. Ogni cambiamento del benchmark è visibile, motivato, e non coincide mai con l'interesse di un'ipotesi in corso.
- **Entra in azione.** Ogni volta che si parla di "meglio/peggio" e all'inizio di ogni filone (per fissare il noise-floor).
- **Si ferma.** Mai del tutto: è infrastruttura. Ma non partecipa ai giudizi di merito.

### 7.3 Simulation / Experiment Scientist
- **Missione.** Costruire esperimenti corretti e isolati. È l'ingegnere di laboratorio: prepara la provetta, non decide cosa ci va dentro.
- **Responsabilità.** Traduce un PRE in un run deterministico riproducibile (worktree dedicato, seed nullo perché il motore è deterministico, log nel ledger). Garantisce che l'esperimento misuri ciò che il prereg dichiara.
- **Strumenti.** `runExperiment`, `simulatePitStop`, `runDegradationScenarios`, worktree.
- **Limiti.** Non interpreta i risultati (è dei domini/antagonisti). Non tocca la produzione.
- **Successo.** Zero esperimenti non riproducibili; zero contaminazioni dell'albero principale.
- **Entra in azione.** Su richiesta di un dominio o del Validation.
- **Si ferma.** Quando l'esperimento gira e il risultato è nel ledger.

---

## 8. Strato 4 — Memoria e qualità

### 8.1 Archivist
- **Missione.** Registrare tutto, in modo immutabile. È la coscienza storica: nulla di ciò che accade nel laboratorio va perduto.
- **Strumenti.** Il ledger (append-only), git come audit log.
- **Limiti.** Non interpreta, non cancella, non riscrive la storia. Solo registra.
- **Successo.** Ogni dossier, verdetto e decisione è ritrovabile con provenienza completa. Zero buchi.
- **Si ferma.** Mai: registra in continuo, in background.

### 8.2 Historian — l'anti-ripetizione
- **Missione.** Impedire che il laboratorio rifaccia ciò che ha già fatto. Prima che un'ipotesi parta, dire: *"questo l'abbiamo già provato, ecco il verdetto e il perché"*.
- **Strumenti.** `searchCorpus`, il grafo delle ipotesi correlate, i cancelli passati.
- **Limiti.** Segnala, non veta da solo: un filone chiuso *può* riaprirsi, ma **solo con dati o fonte nuovi** (la regola "sesto sguardo solo con dati/fonte nuovi" già in uso). L'Historian fa rispettare quella condizione.
- **Successo.** Numero di ripetizioni evitate. E — sottile ma cruciale (Sezione 12) — numero di *falsi NULL* riaperti correttamente quando arrivano dati nuovi. Un Historian troppo zelante fossilizza gli errori passati in dogma.
- **Entra in azione.** All'apertura di ogni ipotesi.

### 8.3 Librarian
- **Missione.** Rendere la memoria interrogabile: indicizzare, collegare, curare, deduplicare. È l'infrastruttura del ricordo.
- **Strumenti.** L'indice (grep → vettoriale quando serve), il manifest dei dossier.
- **Limiti.** Non giudica il contenuto, lo organizza.
- **Successo.** Un agente trova in una query ciò che gli serve, senza rileggere tutto.

### 8.4 Documentation Scientist
- **Missione.** Tradurre i numeri in dossier che un umano può giudicare in cinque minuti. La conoscenza che il PO non riesce a leggere non esiste.
- **Strumenti.** I dossier grezzi, il formato PRE/POST.
- **Limiti.** Non aggiunge conclusioni non supportate dai dati; non abbellisce un NULL in un forse.
- **Successo.** Il PO ratifica o boccia *senza dover rifare l'analisi*. Tempo di revisione del PO per dossier: basso.

### 8.5 Quality Scientist
- **Missione.** Sorvegliare l'igiene: nessun artefatto orfano, provenienza sempre presente, coerenza tra motore (`engine.py`) e specchio (`engine.mjs`).
- **Strumenti.** `getArtifactProvenance`, i checksum motore↔specchio, i test di coerenza.
- **Limiti.** Non fa ricerca; fa manutenzione della verità.
- **Successo.** Zero orfani in circolazione, zero divergenze motore↔specchio non segnalate.

---

## 9. Chi decide cosa — la matrice delle responsabilità

Quattro attori, quattro giurisdizioni nette. Confonderle è il modo più veloce di perdere il rigore.

| Attore | Decide su | NON decide su |
|---|---|---|
| **Il MOTORE** | I *fatti* deterministici: "dato questo stato, cosa succede". È l'oracolo. | Nulla d'altro: non ha opinioni, non ha priorità. |
| **Gli AGENTI** | Quali domande porsi, come progettare gli esperimenti, quali ipotesi sopravvivono internamente. Producono conoscenza e *raccomandano*. | La verità scientifica finale; qualunque modifica alla produzione. |
| **Il PRODUCT OWNER** | La *verità scientifica*: quale ipotesi vale, quale coefficiente cambiare, quali priorità di ricerca, il veto su tutto. È il direttore scientifico. | I fatti (li dà il motore); il codice riga per riga (lo scrive Claude Code). |
| **CLAUDE CODE** | *Come* implementare una modifica **già approvata** dal PO: scrivere il generatore, ricalibrare, testare. La mano. | *Se* una modifica va fatta (è del PO); *cosa* è vero (è della ricerca + motore). |

Il flusso di potere è a senso unico e con un solo varco umano:

```
ricerca (agenti) → raccomanda un dossier → PO ratifica → Claude Code implementa → Benchmark verifica → produzione
                                              ▲
                              UNICO punto in cui una verità
                              diventa una modifica al motore
```

Gli agenti non attraversano mai quel varco. È esattamente il confine di `pipeline_gara.py` — *"automatizza la fatica, MAI il giudizio"* — esteso a tutto il laboratorio.

---

## 10. Il ciclo di vita di una scoperta

Dal nulla alla produzione, con un proprietario a ogni gate.

| # | Fase | Chi | Cosa accade |
|---|---|---|---|
| 1 | **Nascita** | Explorer / Scienziato di dominio | Un'anomalia realtà↔simulatore o una domanda nuova. Ancora nessun numero difeso. |
| 2 | **Filtro storico** | Historian | "Già provato?" Se sì con verdetto e senza dati nuovi → si ferma qui. |
| 3 | **Prereg** | Dominio + Reviewer | Ipotesi, campione, KPI, soglia, rischi noti. Sigillati (hash) *prima* dei numeri. |
| 4 | **Prima critica** | Skeptic | Costruisce la spiegazione alternativa più forte. Se vince lei → NULL motivato. |
| 5 | **Controllo del metodo** | Reviewer | In-sample? Circolare? Soglia dichiarata? Se no → si torna al prereg. |
| 6 | **Esperimento** | Experiment Scientist | Run deterministico in worktree isolato. Numeri nel ledger. |
| 7 | **Metro** | Benchmark Scientist | L'effetto supera il noise-floor? Altrimenti → NULL. |
| 8 | **Validazione indipendente** | Validation Scientist | Riproduzione leave-out. Se non regge → NO-GO. |
| 9 | **Dossier** | Documentation Scientist | PRE + POST leggibili, verdetto, rischi, test necessario prima di applicare. |
| 10 | **Ratifica** | **Product Owner** | GO/NO-GO umano. Unico varco verso la produzione. |
| 11 | **Implementazione** | **Claude Code** | Scrive il generatore/coefficiente approvato, ricalibra, testa. |
| 12 | **Verifica post-modifica** | Benchmark + Quality | La modifica fa ciò che il dossier prometteva? Nessun orfano, motore↔specchio coerenti. |
| 13 | **Archiviazione** | Archivist + Librarian | Tutto in memoria, collegato, indicizzato. La prossima ipotesi lo troverà. |

Un dossier può morire a **qualunque** gate. Morire non è fallire: un NULL al gate 4 o 7 è conoscenza archiviata che risparmia il futuro.

---

## 11. Ricerca continua — il laboratorio che lavora mentre il PO dorme

Il valore del laboratorio è che non si ferma. Ma "non fermarsi" senza disciplina è solo bruciare risorse. Quattro meccanismi.

### 11.1 Come sceglie su cosa lavorare (il portfolio)
Il Chief Scientist tiene un *portfolio* di filoni, ognuno con un **valore-di-informazione atteso**:
```
priorità ≈ (dimensione del gap realtà↔simulatore)  ×  (trattabilità con i dati esistenti)
           ÷  (costo atteso)   ×   (1 se non già provato, 0 se chiuso senza dati nuovi)
```
Si lavora prima sull'anomalia più grande, spiegabile con ciò che abbiamo, che non abbiamo già chiuso. La VSC rotta (1.055) è un esempio da cima alla lista: gap grande, dominio definito, dati presenti.

### 11.2 Come evita di sprecare risorse
- **Budget hard per ciclo.** Il Coordinator si ferma quando il budget è esaurito. Nessun loop infinito.
- **Modelli proporzionati.** Giudizio (Skeptic, Validation, Reviewer) su modelli forti; lavori meccanici (indicizzazione, estrazione) su modelli piccoli.
- **Una domanda stretta alla volta.** Costa poco e produce dossier revisionabili; una fan-out enorme costa molto e produce rumore.

### 11.3 Come evita di ripetere
L'Historian al gate 2 blocca ogni ipotesi già chiusa senza dati nuovi. La memoria non è un archivio passivo: è un *filtro attivo* all'ingresso.

### 11.4 Come interrompe i filoni senza prospettive (la regola di terminazione)
Un filone che accumula **K NULL consecutivi** viene *congelato*: non si riapre finché non arriva una **fonte o un dato nuovo**. È la regola già viva nel progetto ("sesto sguardo solo con dati/fonte nuovi"), promossa a legge organizzativa. Congelare non è cancellare: il filone resta in memoria, pronto a risvegliarsi quando cambia il mondo (gomme nuove, circuito nuovo, telemetria nuova).

### 11.5 Il ritmo
Il laboratorio è **event-driven** più che sempre-attivo: una gara pubblicata scatena un audit automatico; una finestra idle attiva l'Explorer. Non gira a vuoto 24/7 per il gusto di girare — si accende sugli eventi e sui filoni, e riferisce al PO a cadenza umana sostenibile (una revisione per weekend di gara).

---

## 12. La memoria scientifica come sistema immunitario

La memoria non serve a ricordare i successi. Serve a **non ripetere gli errori**. Contiene, per ogni ipotesi mai toccata: il prereg, l'esperimento, il verdetto, e soprattutto **il perché** di ogni NULL/STOP.

Struttura funzionale (non tecnica):
- **Strato dei fatti registrati** (Archivist): immutabile, append-only. Cosa è successo.
- **Strato dei collegamenti** (Historian + Librarian): questa ipotesi supera/contraddice/ripete quella. Perché.
- **Strato del giudizio** (dossier ratificati): cosa il PO ha deciso, e su quali basi.

Due proprietà che la rendono un sistema immunitario e non un cimitero:
1. **Riconosce l'antigene.** Quando un'ipotesi somiglia a una già bocciata, l'Historian la intercetta *prima* dell'esperimento.
2. **Sa dimenticare quando deve.** Un filone congelato si riapre se arrivano dati nuovi. Una memoria che non dimentica mai fossilizza i propri errori — vedi il rischio finale.

---

## 13. Versione minima v1 — cosa introdurre subito

L'organizzazione matura ha ~18 ruoli. Implementarli tutti subito sarebbe tradire la settima legge (il rumore è il nemico): partiremmo con più struttura di quanta scienza c'è da fare. La v1 è **cinque cappelli**, tutti indossabili da pochi agenti-processo, che chiudono il ciclo minimo completo.

| Ruolo v1 | Perché è indispensabile subito | Copre anche (cappelli) |
|---|---|---|
| **Research Coordinator** | Senza qualcuno che instrada e tiene il budget, non c'è 24/7. | Chief Scientist (agenda) |
| **Auditor/Explorer** (un ruolo solo, in v1) | Trova le anomalie: senza input, il laboratorio non ha lavoro. | Scienziati di dominio (all'inizio uno generalista) |
| **Skeptic** | Il primo filtro anti-illusione. Senza di lui il laboratorio produce falsi positivi eleganti. | Reviewer (metodo, in v1 fuso) |
| **Validation Scientist** | Il gate che impedisce falsi miglioramenti. Il più importante, mai opzionale. | Benchmark (il metro, in v1 gestito qui) |
| **Archivist/Historian** (un ruolo solo) | Registra e impedisce ripetizioni fin dal primo giorno, altrimenti la memoria nasce già bucata. | Librarian, Documentation (in v1 minimale) |

Il ciclo minimo che questi cinque chiudono: *anomalia (Auditor) → critica (Skeptic) → riproduzione (Validation) → dossier al PO → memoria (Archivist)*. È esattamente la M1 del documento di architettura: riprodurre una scoperta già nota e verificata, senza toccare nulla.

**Cosa si rimanda esplicitamente al futuro** (e perché è sicuro rimandarlo):
- *Scienziati di dominio separati* (Tyre, Traffic, Pit, Weather, SafetyCar, RaceDynamics): si scorporano dall'Auditor generalista quando un dominio genera abbastanza lavoro da meritare uno specialista. Non prima.
- *Benchmark Scientist autonomo*: finché la suite di replay è piccola, la tiene il Validation. Diventa ruolo a sé quando "cosa vuol dire meglio" richiede una custodia dedicata.
- *Documentation e Librarian dedicati*: quando il PO comincia a faticare a leggere i dossier o a ritrovarli.
- *Chief Scientist autonomo*: quando i filoni aperti sono troppi perché il Coordinator li gestisca da solo.
- *Quality Scientist*: quando gli artefatti orfani diventano un problema ricorrente e non un caso.

La regola di crescita: **si aggiunge un ruolo quando il dolore della sua assenza è misurabile**, mai per completezza dell'organigramma. Il laboratorio cresce come cresce la scienza che deve fare — non più in fretta.

---

## 14. La domanda obbligatoria

> *"Se questo laboratorio lavorasse da solo per cinque anni, quale sarebbe il rischio più grande?"*

Non è che gli agenti rompano il motore — quello lo previene il confine. Non è il costo — quello lo prevede il budget. Il rischio più grande è **scientifico**, ed è questo:

**Il laboratorio perde lentamente il contatto con la realtà, mascherandolo da rigore.**

Ecco il meccanismo, passo dopo passo, perché è subdolo proprio in quanto graduale:

1. Ogni ipotesi si valida su ciò che il laboratorio *ha già* — il suo corpus di gare, i suoi benchmark, la sua memoria. Anno dopo anno, la ricerca deriva verso le ipotesi che è *facile* confermare con quel materiale. Non perché siano vere, ma perché sono comode. È la **circolarità in-sample**, la trappola in cui questo progetto è già caduto una volta — ma promossa dalla scala di un errore occasionale a *tendenza sistemica dell'organizzazione*.

2. Il metro co-evolve con i modelli. Il Benchmark Scientist, custode del metro, è l'unico senza ipotesi da difendere — la sua forza. Ma se il benchmark si aggiorna anche solo un po' nella direzione di ciò che i modelli sanno già fare, "meglio" smette di significare "più vicino alla pista" e comincia a significare "più coerente con noi stessi". **Il righello inizia a misurare se stesso.** È la legge di Goodhart applicata a un intero dipartimento: quando la metrica diventa l'obiettivo, smette di essere una buona metrica.

3. La memoria, che doveva impedire di ripetere gli errori, ne fossilizza alcuni. Un'ipotesi bocciata *ingiustamente* una volta — un falso NULL — viene evitata per sempre, perché "l'Historian dice che l'abbiamo provata". Il laboratorio eredita i propri sbagli passati come dogmi. La stessa memoria che protegge diventa un paraocchi.

4. Il risultato, dopo cinque anni: un laboratorio *internamente* impeccabile — prereg perfetti, validazioni pulite, conflitto vivace, dossier eleganti — che ha smesso di imparare qualcosa di nuovo *dalla pista*. Coerenza interna scambiata per verità esterna. Il rigore, che doveva essere il legame con la realtà, è diventato il rito che ne maschera la perdita.

**Perché è il rischio più grande e non uno dei tanti:** tutti gli altri rischi fanno rumore quando si avverano (il motore si rompe, il costo esplode, un test fallisce). Questo è *silenzioso*. Il laboratorio che si autoconvince sta benissimo — anzi, sembra al suo apice. Se ne accorge solo il mondo esterno, e solo su una cosa: le gare *nuove*, quelle che il laboratorio non ha mai visto.

**L'unico antidoto è organizzativo, non tecnico**, ed è la prima delle sette leggi elevata a rito permanente: la verità del laboratorio si misura **solo** su ciò che non ha ancora visto. Ogni scoperta, per contare, deve reggere sulla prossima gara reale, non sul corpus passato. Il Benchmark Scientist va tenuto **strutturalmente cieco** rispetto alle ipotesi in corso. E il PO — l'unico umano nel loop — ha un compito che nessun agente può avere: **portare dentro il laboratorio la realtà che il laboratorio, da solo, tenderebbe a dimenticare.** È per questo che il direttore scientifico resta umano. Non per prudenza. Perché è l'unica finestra che dà sulla pista.

---

*Fine. Il laboratorio non serve a costruire un'AI. Serve a fare in modo che, tra cinque anni, Muretto sappia di più sulla Formula 1 di quanto sappia oggi — e che sappia, con la stessa onestà, cosa ancora non sa.*
