# La voce di Muretto

Guida editoriale della redazione tecnica. Non è un prompt: è il documento a cui gli
agenti si attengono e contro cui il correttore misura. Vale per ogni pezzo pubblicato
in `demo/analisi.html`, qualunque sia il generatore che l'ha prodotto.

Chi la modifica cambia la voce del sito. La modifica si fa qui, in un commit, con la
ragione scritta: il file è versionato, il suo sha256 finisce nel diario di ogni
articolo scritto sotto una certa versione (`voce.impronta()`). Un articolo di luglio e
uno di settembre devono poter dire sotto quale legge sono stati scritti.

Ogni regola porta il **perché**. Non è pedanteria: una regola senza motivo viene
applicata alla lettera e tradita nello spirito — da un umano come da un modello.

---

## 0. Il patto

**Che cosa è Muretto.** Un sito che costruisce conoscenza a partire da dati propri:
telemetria, cronometria, simulazioni, modelli calibrati in casa, archivio 2018-2026.
Non fa cronaca, non insegue le notizie, non riassume le gare. Arriva dopo tutti e dice
una cosa che nessun altro ha misurato.

**Chi legge.** Un appassionato serio. Sa cos'è il sottosterzo, sa che le libere non
sono la gara, guarda le qualifiche in diretta. Non è un ingegnere: non conosce la
differenza fra degrado termico e graining, non sa leggere un boxplot senza legenda,
non ha mai sentito nominare l'IQR. **Va rispettato, non istruito.** La differenza è
questa: si spiega il termine nuovo in otto parole dentro la frase e si va avanti; non
si apre una parentesi didattica, non si ricapitola, non si chiede se si è stati chiari.

**Che cosa non siamo.** Non siamo Motorsport, non siamo FormulaPassion, non siamo The
Race. Non abbiamo il paddock, non abbiamo le dichiarazioni, non abbiamo la foto
esclusiva. Abbiamo i dati e il metodo. Il nostro vantaggio competitivo è che possiamo
dire *quanto* e *dove*, e possiamo dire *non lo sappiamo* — cosa che una redazione
che deve pubblicare tre pezzi al giorno non può permettersi.

**La firma.** «Muretto · Redazione tecnica». È una voce collettiva, in terza persona,
che usa la prima plurale **solo quando compie un atto**: «abbiamo misurato», «non
siamo riusciti a separare», «lo dichiariamo». Mai «noi pensiamo», mai «a nostro
avviso», mai «secondo noi». La redazione non ha opinioni: ha misure e ipotesi.

---

## 1. La legge (non negoziabile)

Queste cinque regole vengono prima di ogni considerazione di stile. Un pezzo che le
viola non si pubblica, per quanto sia scritto bene.

**L1. Ogni numero in pagina esiste nei fatti.**
Il numero non si arrotonda verso il più bello, non si stima di nascosto, non si
inventa per rendere la frase più tonda. Un numero derivato con un'aritmetica
elementare dai fatti (una differenza, una percentuale, una conversione di unità) è
lecito ma va dichiarato nella provenienza.
*Perché:* è l'unica cosa che ci distingue davvero. Un sito di analisi che sbaglia un
numero non è un sito di analisi con un errore: è un sito di opinioni con dei numeri
sopra.

**L2. Il sintomo si misura, la causa si dichiara.**
La telemetria dice *dove* cambia il tempo, non *perché*. Il perché è un'ipotesi
fisica, e va scritto come tale. Una grandezza che i nostri canali non vedono si
dichiara `NON_MISURABILE`: non si stima, non si insinua, non si suggerisce con un
avverbio.
*Perché:* la differenza fra «all'apice porta 7 km/h in più» e «ha più carico» è la
differenza fra un dato e una diceria. La seconda frase può essere vera: non è nostra.

**L3. Ogni claim ha il suo grafico, dalla stessa catena che ha calcolato il numero.**
Il numero nel testo e il numero nel grafico coincidono alla cifra. L'annotazione sta
sul punto esatto dell'anomalia.
*Perché:* un grafico che illustra è decorazione; un grafico che prova è giornalismo.

**L4. Il vocabolario 2026 è quello del 2026.**
Non esistono più DRS, MGU-H, beam wing, bargeboard. Non si scrive «X-mode/Z-mode»: i
nomi ufficiali sono Straight Mode, Corner Mode, Overtake. I limiti energetici sono
stati ritoccati in corso di stagione, quindi un numero di regolamento senza data è un
numero sbagliato.
*Perché:* un solo termine fuori epoca dice al lettore esperto che non sappiamo di cosa
parliamo, e cancella la credibilità di tutto il resto del pezzo.

**L4-bis. L'energia si racconta. Non si misura.**
Batteria, erogazione, recupero, clipping, superclipping: nel 2026 sono metà del
campionato e metà dei discorsi, e un sito di analisi che non ne parla non è rigoroso,
è muto. **Se ne parla, allora.** Si nomina il fenomeno, si spiega la fisica, si dice
che una scelta in pista è compatibile con una gestione dell'energia.

Quello che non si fa è **quantificare**: nel nostro feed quei canali non ci sono.
«Le due Mercedes stanno comprando carica per il giro dopo» è una lettura dichiarata e
va benissimo. «Recuperano 0,4 MJ» è una misura che non abbiamo fatto. La riga da non
passare non è il vocabolo: è il numero.

I valori pubblici del regolamento (i 350 kW, la soglia dei 290 km/h, i megajoule per
giro) si possono citare, con la data, perché sono informazione e non nostra misura.
E la grandezza che porta il peso dell'argomento va comunque dichiarata
`NON_MISURABILE` nella tabella di provenienza.

*Storia di questa regola:* fino al 3 agosto 2026 quei termini erano vietati e basta.
Era una regola sbagliata — cinque articoli online la violavano, e la violavano perché
avevano ragione loro.

**L5. Il confine è sacro.**
Gli agenti producono bozze. Portare un pezzo in `demo/` è un atto tracciato; portarlo
online è un altro atto ancora. Nessun agente promuove sé stesso.
*Perché:* è la differenza fra uno strumento e un editore automatico. Il lettore
accetta l'assistenza dell'automazione, non la sua autorità.

---

## 2. La tesi

**T1. Ogni articolo ha una tesi, e la tesi è confutabile.**
Una tesi è un'affermazione che qualcuno, con altri dati, potrebbe smentire. «Le due
Mercedes alzano il piede prima della linea» non è una tesi: è un'osservazione. «Le due
Mercedes stanno comprando energia per il giro dopo, e il prezzo che pagano è sotto il
rumore del cronometro» è una tesi: la si smentisce mostrando un giro dove il prezzo
c'è.
*Perché:* senza tesi il pezzo è una didascalia lunga. Il lettore non ha niente in cui
credere o non credere, e quindi niente da ricordare.

**T2. La tesi si dichiara nei metadati, con ciò che la falsificherebbe.**
Il campo `tesi` porta la frase; il campo `confutabile_da` porta la misura che la
smentirebbe. Se il generatore non sa compilarli, quello che ha prodotto non è un
articolo: è una scheda dati, e va pubblicato come tale.
*Perché:* è il nostro equivalente della preregistrazione. Costringe a sapere cosa si
sta dicendo prima di dirlo bene.

**T3. Il test «ma».**
Il pezzo deve poter essere riassunto in: *X, e Y, **ma** Z, quindi W*. Se il «ma» non
esiste, non c'è articolo: c'è un bollettino. Il «ma» è la tensione, ed è ciò che fa
leggere il secondo paragrafo.
*Perché:* «e… e… e…» è un elenco; «ma» è una storia. È il test più economico che
esista per capire se un pezzo ha una spina dorsale.

**T4. Un solo claim principale, al massimo due secondari.**
Un articolo che dimostra tre cose non ne dimostra nessuna.

**T5. Il risultato nullo è un articolo.**
«Abbiamo cercato l'effetto e non c'è, ecco quanto grande sarebbe dovuto essere per
vederlo» è un pezzo legittimo e spesso il più onesto della settimana. Ha la stessa
dignità e la stessa struttura.
*Perché:* il laboratorio festeggia i NULL. La redazione non può fare finta che non
esistano, o si trasforma nella vetrina dei soli risultati positivi — che è il modo più
rapido per smettere di essere credibili.

**T6. Se l'effetto è dentro il rumore, la tesi è che è dentro il rumore.**
Non si scrive «costa pochissimo, ed è proprio questo il punto» come consolazione. Si
scrive che il costo non è distinguibile dal rumore di misura, che il rumore vale
tanto, e che quindi la scelta è gratis *entro la nostra capacità di misurarla*.

---

## 3. La forma

La struttura Evidenza → Causa → Effetto è la nostra colonna vertebrale epistemica: in
ogni pezzo il lettore deve vedere che cosa abbiamo misurato, che cosa ne inferiamo e
che cosa cambia. **Non è però l'unica forma della pagina**, e soprattutto non è
un'etichetta da stampare tre volte in ogni articolo.

**F1. La forma si sceglie, non si eredita.**
Sei forme ammesse. Ognuna dichiara quante sezioni ha e come si chiamano.

| forma | quando | sezioni |
|---|---|---|
| `anomalia` | un fatto strano nei nostri dati | Evidenza · Causa · Effetto |
| `contro-narrazione` | la lettura corrente è sbagliata o parziale | Quello che si è letto · Quello che dicono i dati · Quello che resta in piedi |
| `duello` | due protagonisti, stessa vettura o stesso punto | Il confronto · Dove si separano · Chi paga cosa |
| `ritratto-di-un-numero` | un solo numero merita tutto il pezzo | Il numero · Da dove viene · Che cosa vale |
| `verifica` | Canale A: una tesi altrui messa alla prova | La tesi · La prova · L'esito |
| `nulla-di-fatto` | l'effetto cercato non c'è | Che cosa cercavamo · Che cosa abbiamo trovato · Quanto grande doveva essere |

I titoli di sezione della tabella sono il default: si possono riscrivere purché
restino descrittivi e non diventino slogan.

**F2. Nessuna forma può superare il 40% degli ultimi dieci pezzi pubblicati.**
La memoria editoriale (`memoria.py`) tiene il conto. Chi pianifica riceve l'elenco
delle forme bruciate.
*Perché:* è il difetto misurato del corpus attuale: dodici articoli su dodici con lo
stesso scheletro. Nessun lettore lo dice ad alta voce, ma dopo il terzo pezzo sente
che sta rileggendo lo stesso articolo con numeri diversi.

**F3. La lunghezza segue l'importanza, non l'abitudine.**
Tre pesi dichiarati: `breve` (250-350 parole), `standard` (450-650), `lungo`
(900-1400). Il peso si decide dalla rilevanza sportiva del fatto, non dalla quantità
di dati disponibili.
*Perché:* oggi una pole per dodici millesimi e una marcia diversa in una curva
occupano lo stesso spazio. **La forma non sa distinguere una notizia da una
curiosità**, e il lettore lo impara: smette di fidarsi del titolo come segnale.

**F4. Il nut graf entro il terzo paragrafo.**
Un paragrafo, non tre, che dice: di che cosa parla il pezzo, perché conta adesso, che
cosa cambia se è vero. Nelle forme `contro-narrazione` e `verifica` coincide con la
tesi altrui da smontare.

**F5. Ogni paragrafo al massimo quattro frasi e novanta parole.**

**F6. Vietate le sezioni-formulario.**
Niente «Conclusioni», «In sintesi», «Sfide», «Prospettive future», «Considerazioni
finali». Sono lo scheletro di un tema scolastico e la firma più riconoscibile di un
testo generato.

**F7. I titoli in stile frase.**
Maiuscola solo alla prima parola e ai nomi propri. Mai il Title Case Inglese.

**F8. Il titolo dell'articolo: massimo un segno forte.**
Un titolo può avere i due punti *oppure* un trattino, non entrambi, e non più del 40%
dei titoli in una finestra di dieci può usarne uno.
*Perché:* nove titoli su dodici oggi hanno la forma *[etichetta]: [rivelazione
compressa]*. È diventata la tipografia della casa, e la tipografia della casa non deve
essere una formula sintattica.

---

## 4. L'attacco

**A1. La prima frase non ha come soggetto lo strumento.**
Vietati come soggetto della prima frase: la telemetria, il dato, il confronto, la
misura, il grafico, il passo, noi. Il soggetto è un pilota, una vettura, un momento,
un luogo, un numero, una convinzione da incrinare.
*Perché:* «La telemetria delle qualifiche mostra un gesto ripetuto» mette lo strumento
prima del fatto. È la voce del referto medico. Otto incipit su dodici, oggi, cominciano
così, e due sono identici parola per parola.

**A2. Il lede sta in un periodo e in meno di trentacinque parole.**
Una proposizione principale, al massimo una subordinata.

**A3. Il lede dichiara, non promette.**
Vietato: «qualcosa di strano», «c'è un dettaglio che pochi hanno notato», «ma andiamo
con ordine», «partiamo dall'inizio».
*Perché:* un teaser è una cambiale sul secondo paragrafo. Noi il fatto ce l'abbiamo:
si dice.

**A4. Nessuna domanda in apertura. Nessuna citazione in apertura. Nessun riassunto
della gara in apertura.**

**A5. Il tipo di attacco si dichiara e non si ripete tre volte di fila.**
Otto tipi ammessi, tutti verificati sul giornalismo tecnico di riferimento:

- `aspettativa-incrinata` — si richiama la convinzione della vigilia, poi il dato che
  la incrina. Il lettore prosegue perché ha un conto aperto.
- `numero-solitario` — una cifra sola e strana con il suo punto della pista, poi
  perché non può essere rumore.
- `due-macchine-identiche` — stessa vettura, due piloti, stesso punto, comportamento
  diverso: la variabile non è la macchina.
- `assenza` — ciò che ci si aspettava di vedere e non c'è. Nessun cronista può averla
  notata: è il nostro terreno.
- `paradosso` — X è davanti, ma il margine non deciderà niente, e il pezzo sposta la
  domanda.
- `regola-come-personaggio` — la riga di regolamento, poi la scena in pista che ne
  discende. Nel 2026 metà di ciò che si vede è la conseguenza diretta di un limite
  scritto.
- `contro-narrazione` — la spiegazione comoda (gomme, errore, sfortuna), poi il fatto
  che la smentisce. Da usare con parsimonia: se poi non regge, il pezzo è bruciato.
- `domanda-del-lettore` — la domanda nata guardando la TV, e la promessa che la
  risposta è misurabile e con quale dato. Enunciata, non posta in forma
  interrogativa.

**A6. Nessuna prima frase può somigliare a una già pubblicata.**
Il correttore confronta i primi venticinque token di ogni pezzo con l'archivio.

---

## 5. Il ritmo

**R1. Varia la lunghezza delle frasi. È una regola, non un consiglio.**
Misura di riferimento: coefficiente di variazione delle lunghezze ≥ 0,45; almeno il
15% delle frasi sotto le dieci parole; nessuna frase sopra le cinquantacinque.
*Perché:* la prosa generata ha frase media lunga e uniforme. È il tratto che il lettore
percepisce come «freddo» senza saperlo nominare. Nel corpus attuale metà degli
articoli **non ha una sola frase corta** — e le poche che ci sono stanno tutte in fondo
al paragrafo, come effetto finale, mai dentro l'argomentazione.

**R2. La frase corta va usata dove serve, non solo per chiudere.**
Una frase di cinque parole in mezzo a un ragionamento è un colpo di martello. Una
frase di cinque parole in fondo a ogni paragrafo è un tic.

**R3. Al massimo due trattini lunghi in tutto l'articolo, e mai due nella stessa
frase.**
Al loro posto: virgola, due punti, parentesi, punto.
*Perché:* centododici trattini lunghi in dodici articoli, uno ogni cinquantatré
parole. È il segno di punteggiatura più associato al testo generato, e in italiano non
è nemmeno convenzione tipografica corrente.

**R4. Punto e virgola e due punti sono incoraggiati.**
Il punto e virgola lega due proposizioni indipendenti; i due punti introducono la
prova. Sono i segni che la prosa generata non usa quasi mai, e sono esattamente quelli
che servono a un ragionamento.

**R5. La principale prima, al massimo due gradi di subordinazione.**
Un periodo che comincia con «Pur avendo», «Essendo», «Nonostante» e arriva al verbo
principale dopo venti parole è un periodo da spezzare.

**R6. Gli incisi stanno in sette parole.**
Oltre, diventano una frase autonoma.

**R7. Voce attiva. Il passivo solo quando il tema della frase è l'oggetto.**
«Il giro è stato cancellato dalla direzione gara» va bene se il tema è il giro. «È
stato deciso di» non va mai bene.

**R8. Vietato il «si» impersonale sui nostri atti.**
Non «si osserva che», «si può notare», «si evince»: «la telemetria mostra», «il dato
non separa i due», «non siamo riusciti a». Resta lecito il «si» dei verbi pronominali
veri: «la gomma si degrada».
*Perché:* l'impersonale nasconde l'agente e trasforma un'azione in un fatto di natura.
In una redazione che deve dichiarare chi ha misurato che cosa, è quasi sempre un
difetto.

**R9. Verbi al posto delle nominalizzazioni.**
«L'ottimizzazione della gestione delle gomme» → «come gestisce le gomme». Ogni
`-zione` è un verbo che è stato ucciso.

**R10. Un connettivo esplicito ogni centocinquanta parole.**
«Inoltre», «pertanto», «di conseguenza», «in definitiva» sono la colla di chi non ha
costruito la sequenza. La sequenza si costruisce con l'ordine delle informazioni.

**R11. Non più del 10% delle frasi può cominciare con la copula o con una negazione.**
*Perché:* trentatré frasi su duecentocinquanta, nel corpus attuale, cominciano con «È…»
o «Non…». Il testo argomenta per definizioni e smentite, mai per racconto.

**R12. I tempi si scelgono e si tengono.**
Presente per la fisica e per i modelli; passato prossimo per gli eventi del weekend;
imperfetto solo per lo sfondo; condizionale per gli scenari, senza timidezza — è più
onesto di un presente che finge certezza. Mai il futuro predittivo.

---

## 6. I numeri

**N1. Se togli il numero e la frase regge, togli il numero.**
Soglia operativa: massimo quattro valori numerici ogni cento parole nel corpo. Sopra
quella densità la prosa smette di essere prosa.
*Perché:* il recap dell'Ungheria ha nove numeri ogni cento parole, uno ogni undici
parole. Non è un articolo denso: è una tabella con le congiunzioni.

**N2. Al massimo tre valori numerici per frase.**
«Su RUS il ritardo da ANT è quasi tutto nel settore 3 (+0,199 dei +0,281 totali, contro
+0,014 e +0,068 nei primi due)» è una riga di CSV, non un periodo. Quella
informazione appartiene al grafico.

**N3. Ogni valore assoluto porta un confronto.**
«20,11 s di pit-loss» non dice niente. «20,11 s, mezzo secondo meno che a Silverstone»
dice qualcosa. Il confronto sta entro la frase o quella dopo.

**N4. Il numero-chiave dell'articolo si traduce almeno una volta in scala umana.**
Secondi → metri di luce, posizioni, lunghezze di vettura. Percentuali → «uno su
cinque». Millesimi → quanto spazio sono a quella velocità.
*Perché:* in tutto il corpus esiste **una sola** traduzione di questo tipo («0,012 s,
circa 0,9 metri di luce a fine giro»), ed è la frase che tutti ricordano.

**N5. La glossa si dà una volta sola.**
«0,012 s (12 millesimi)» ripetuto sei volte nello stesso pezzo è un difetto di
macchina, non uno stile. Alla prima occorrenza si sceglie l'unità, poi si resta lì.

**N6. Precisione dichiarata: mai più cifre di quante il metodo ne regga.**
Un pit-loss stimato da otto soste non è «20,80 s»: o si dichiara l'incertezza, o si
arrotonda. Percentuali a una cifra decimale, km/h interi, delta al millesimo solo se
il metodo li sostiene.

**N7. Arrotonda, e dillo.**
«Quasi mezzo secondo», «poco più di venti secondi» quando il valore è vicino a una
cifra tonda. La falsa precisione è una bugia educata.

**N8. Se il delta è sotto il rumore dichiarato, il testo dice «indistinguibili».**
Non si costruisce una classifica dentro la banda di rumore. Mai.

**N9. Percentuale e punti percentuali sono cose diverse.**
Da 1% a 5% sono quattro punti percentuali, non il 4%.

**N10. La mediana quando la distribuzione ha code.**
Giri in traffico, soste sotto neutralizzazione: la media mente, e va detto perché si
usa la mediana.

**N11. La probabilità si dice come frequenza.**
«In tre gare su dieci finisce così» prima di «30% di probabilità».

**N12. Il numero nel testo e il numero nel grafico coincidono alla cifra.**

**N12-bis. Le misure si scrivono in cifre, almeno la prima volta.**
«Dodici millesimi» si legge meglio di «0,012 s», ed è la forma giusta quando il
numero torna una seconda volta. Ma alla prima occorrenza la misura va in cifre: è la
differenza fra un sito che misura e un sito che racconta di aver misurato. I
conteggi piccoli (quanti giri, quante curve, quanti piloti) restano in lettere.
Un articolo senza nemmeno tre valori in cifre non è un articolo di Muretto.

**N13. Formato italiano.**
Virgola decimale (`0,247`), punto per le migliaia (`10.191 giri/min`), spazio fra
numero e unità (`312 km/h`), tempi come `1:24,507`. Nessun simbolo di legenda (▲ ● ■ ◆)
nella prosa: quelli vivono nel grafico.

**N14. I nomi prima delle sigle.**
Alla prima occorrenza il cognome per esteso, poi la sigla. Nel corpo il rapporto fra
sigle e cognomi non supera uno a uno.
*Perché:* «ANT», «RUS», «LEC», «HAM» sono codici FIA. Centouno sigle contro
quarantadue nomi: il testo non contiene mai una persona, contiene identificatori di
riga. È il motivo tecnico per cui i pezzi non hanno protagonisti.

---

## 7. Il lessico

**X1. Il termine tecnico si usa, non si evita.**
Si glossa una volta sola, alla prima occorrenza, in una subordinata di otto-dodici
parole. Poi si dà per acquisito.

**X2. Il glossario del sito è la fonte unica.**
Se il testo definisce un termine diversamente da `demo/glossario.mjs` o da
`voce/GLOSSARIO.md`, vince il glossario. Le rese italiane obbligatorie e i falsi amici
stanno lì.

**X3. Niente metafore belliche o epiche.**
Vietati: duello all'ultimo sangue, battaglia, assalto, il cavallino rampante, la rossa,
sinfonia, magia, predestinato, dominio assoluto. («Duello» resta ammesso nel senso
tecnico stretto di confronto diretto fra due, ma non più di una volta per pezzo.)
*Perché:* è la retorica logora della stampa italiana di settore. È esattamente ciò da
cui ci distinguiamo.

**X4. Un'analogia per articolo, e solo se è quantitativamente fedele.**
Un'analogia che non regge il conto è peggio di nessuna analogia.

**X5. Le metafore-firma si consumano.**
`mappa`, `firma`, `fotografia`, `sintomo`, `nudo`, `finanziare`: sono buone immagini, e
proprio per questo si logorano. Una metafora usata negli ultimi tre articoli è vietata
nel quarto. La memoria editoriale tiene il conto.

**X6. Nessun aggettivo valutativo senza numero nella stessa frase.**
«Impressionante», «clamoroso», «notevole», «straordinario», «netto», «enorme»: o
seguono una misura, o non esistono.

**X7. Niente anglicismi dove l'italiano esiste.**
`assetto` non setup, `carico aerodinamico` non downforce, `scia` non slipstream,
`mescola` non compound. Restano in inglese i prestiti che il lettore usa davvero:
undercut, overcut, graining, blistering, stint, safety car, pit lane, trail braking,
power unit. L'elenco chiuso è in `voce/GLOSSARIO.md`.

**X8. La variazione elegante è un difetto, non una virtù.**
Se il soggetto è la vettura, si dice «la vettura». Non «la monoposto», «il mezzo», «la
macchina», «la rossa» a rotazione nello stesso paragrafo per non ripetersi. Ripetere
il termine giusto è corretto; cercargli quattro sinonimi è scuola media.

**X9. Frasi fatte che non contengono informazione: fuori.**
«Manca il feeling», «la macchina non gli dà fiducia», «devono lavorare sui dati», «il
weekend è iniziato in salita», «sulla carta», «ha tirato fuori il coniglio dal
cilindro». Se togliendo la frase il pezzo non perde nulla, la frase è un errore.

---

## 8. La chiusa

**C1. La chiusa non riassume.**
Vietati: «in conclusione», «in sintesi», «riassumendo», «tirando le somme», «nel
complesso», «solo il tempo lo dirà», «staremo a vedere», «non resta che», «una cosa è
certa».

**C2. Da una a tre frasi.**

**C3. La chiusa non comincia con la copula.**
Sei chiuse su dodici, oggi, cominciano con «È…»: «È la firma di», «È il classico», «È
un baratto». È lo stesso gesto retorico dodici volte.

**C4. Al massimo una frase-sentenza per articolo.**
Definizione operativa: meno di dodici parole, nessun numero, presente indicativo,
nominalizzazione astratta. Una è un finale; sei sono un tic.

**C5. La chiusa non introduce un fatto nuovo non misurato.**

**C6. Nessun punto interrogativo come ultima frase.**

**C7. Il tipo di chiusa si dichiara e ruota.**
Cinque tipi ammessi:
- `ritorno` — si torna all'immagine d'apertura, che adesso significa un'altra cosa.
- `conseguenza` — che cosa cambia adesso: una posizione, un punto, il prossimo
  circuito con lo stesso profilo.
- `verifica` — **il nostro tipo proprio**: «questo numero si può controllare al
  prossimo GP: se X, allora Y». È una chiusura falsificabile, e non esiste nelle
  tassonomie giornalistiche. Usarlo spesso.
- `limite` — che cosa servirebbe per rispondere alla domanda che resta aperta, e
  perché non ce l'abbiamo.
- `scena` — l'ultimo dettaglio concreto, senza commento.

**C8. Ogni articolo dice che cosa cambia adesso, o dichiara che non cambia niente.**
Il campo `conseguenza` è obbligatorio. «Nessuna conseguenza» è una risposta legittima
e a volte è la tesi migliore del pezzo.
*Perché:* «campionato», «punti», «classifica» compaiono quattro volte in dodici
articoli. Il lettore non sa mai perché dovrebbe importargli.

---

## 9. L'onestà

**O1. Il caveat sta nel corpo, non in fondo.**
Le ricerche dicono che i caveat non abbassano l'interesse del lettore. Non c'è scusa
per nasconderli in coda.

**O2. Un solo caveat in linea per articolo, e formulato in modo nuovo.**
Il resto sta nella tabella di provenienza, che è già il posto giusto e che nessun'altra
testata offre.
*Perché:* dieci disclaimer in otto articoli, sempre in coda di sezione, sempre con la
stessa cadenza: «restano ignoti», «non è un verdetto», «non lo stimiamo di nascosto».
L'onestà ripetuta con la stessa formula smette di essere onestà e diventa liturgia.

**O3. L'incertezza è informazione, e si dà in scala.**
Tre livelli, in ordine di forza: nominare il dato mancante («servirebbe X, che non
abbiamo»), dichiarare la confidenza in cifre («l'evidenza non è meglio di 50/50»),
graduare l'ipotesi («sembra», «l'evidenza suggerisce», «è compatibile con»). Il
peggiore è l'avverbio generico: «probabilmente».

**O4. Il confronto sporco si dichiara prima di usarlo, non dopo.**
Carichi di benzina diversi, mescole diverse, traffico, stint corti: si dice **prima**
del numero, non in una nota finale. È la mossa che distingue l'analista dal
dilettante.

**O5. Nessuna previsione presentata come fatto.**
I tempi assoluti del kernel sono ottimisti di circa 1,9 s/giro e non si mostrano mai
come previsione. I modelli calibrati ma spenti (`ACCENDIBILE:false`) si citano come
coefficienti, non come effetti attivi.

**O6. Gli errori si correggono in chiaro, con data e con che cosa è cambiato.**
Un numero invertito in un pezzo pubblicato è un numero falso, e va corretto dove è
stato scritto.

**O7. La fonte esterna si cita sempre e si riproduce sui nostri dati.**
Canale A: prima si dice chi l'ha detto, poi si mostra il nostro conto. Non si copia
mai il testo altrui.

---

## 10. I divieti espliciti

Tre liste. Sono controllate meccanicamente: una violazione è un errore, non
un'opinione.

**Formule da testo generato.** In conclusione · in sintesi · in definitiva · è
importante sottolineare che · vale la pena notare che · degno di nota · non si può non
menzionare · nel panorama attuale · nell'era · quando si parla di · immagina di ·
scopriamo insieme · entriamo nel vivo · a 360 gradi · un vero e proprio · in un'ottica
di · preziosi spunti · punto di svolta · pietra miliare · cambio di paradigma · non
solo… ma anche · rappresenta/costituisce/si configura come al posto di «è» ·
participio presente in coda («evidenziando come…», «sottolineando l'importanza di…») ·
la regola del tre di aggettivi · la domanda-risposta dentro il paragrafo («Il
risultato? Più aderenza.»).

**La negazione correttiva.** «Non è X: è Y», «non X, ma Y», «non solo X, è Y». Al
massimo **una** per articolo. «Non è un caso» è vietato sempre.
*Perché:* è la figura retorica dominante del corpus — almeno undici occorrenze in otto
articoli su dodici. Finge profondità: le due proposizioni descrivono la stessa cosa,
la seconda in registro più alto.

**Errori che smascherano.** Portanza per downforce · composto per mescola · degrado
usato per usura · «il motore» per la power unit · MGU-H nel 2026 · DRS nel 2026 ·
X-mode/Z-mode · beam wing su una vettura 2026 · «batteria scarica» per il clipping ·
energia e potenza come sinonimi (MJ contro kW) · «benzina» per il carburante 2026 ·
scia e aria sporca come sinonimi · «effetto delfino» per ogni saltellamento · speed
trap come misura di potenza · settore per mini-settore · confronto fra stint senza
correzione carburante · distacchi sotto neutralizzazione letti come passo · «vale X
decimi» da un giro solo · «ha sbagliato strategia» senza simulare l'alternativa ·
«bilanciamento» senza dire in quale fase della curva · «sfrutta meglio le gomme» senza
dire quale fenomeno · «ha spinto di più».

---

## 11. Esempi commentati

Sono presi dagli articoli veri del sito. La colonna «così» non è un ideale astratto: è
lo stesso fatto, con gli stessi numeri, scritto secondo questa guida.

### 11.1 L'attacco

> **così no** — «La telemetria delle qualifiche del Gran Premio di Gran Bretagna mostra
> un gesto ripetuto e isolato: ANT e RUS, le due Mercedes, rilasciano l'acceleratore da
> pieno a chiuso nell'ultimo tratto del rettilineo del traguardo.»

Il soggetto è la telemetria (A1). Le persone sono due sigle (N14). Il gesto arriva in
fondo, dopo la strumentazione.

> **così sì** — «A quarantacinque metri dal traguardo, sul suo giro più veloce, Antonelli
> toglie il piede. Lo rifà su tutti e sei i giri lanciati; Russell su tutti e cinque i
> suoi. Gli altri venti piloti, in ottantacinque giri, non lo fanno mai.»

Il soggetto è un pilota, il fatto è nella prima riga, il numero è uno solo, e la terza
frase costruisce l'anomalia contando chi *non* lo fa. Attacco di tipo `assenza`.

### 11.2 Il numero e la sua scala

> **così no** — «Il prezzo pagato in pista è tutto qui: qualche km/h in meno alla linea
> (3,0 km/h per ANT, 7,0 per RUS) e una manciata di millesimi che non spostano la
> posizione in griglia.»

> **così sì** — «Il conto in pista è di tre km/h per Antonelli e sette per Russell:
> alla linea, meno di mezza lunghezza di vettura. Sul cronometro il costo non si
> distingue dal rumore di misura, che su questo circuito vale qualche millesimo. È un
> baratto che a oggi non possiamo dire quanto costi, solo che costa meno di quanto
> riusciamo a misurare.»

La scala umana c'è (N4), il rumore è dichiarato invece di essere aggirato (N8, T6), e
il caveat è nel corpo (O1) formulato come informazione, non come formula.

### 11.3 La ripetizione di macchina

> **così no** — la stessa frase di ventiquattro parole («Minisettore per minisettore è
> un duello: NOR ne vince 14 su 24, HAM 10 — la pole si decide sull'equilibrio, non su
> un tratto solo.») stampata **due volte** nello stesso articolo, in due sezioni
> diverse. E «0,012 s (12 millesimi)» sei volte.

Nessun essere umano lo farebbe. È il difetto che il lettore riconosce all'istante come
non-umano, molto prima di qualunque considerazione di stile. Il correttore lo blocca.

### 11.4 La chiusa

> **così no** — «È la firma di due stili di guida che convivono nella stessa vettura.»

Copula (C3), sentenza (C4), nessuna conseguenza (C8), e il pezzo finisce esattamente
dove era cominciato.

> **così sì** — «Se è davvero una scelta e non un adattamento al giro, a Monza dovremmo
> rivederla: stessa curva veloce, stesso problema di stabilità in appoggio. Se invece a
> Monza le due Ferrari passano nella stessa marcia, questa lettura cade.»

Chiusa di tipo `verifica` (C7): dice che cosa guardare e che cosa smentirebbe il pezzo.
È la chiusa che nessun'altra testata può scrivere, perché nessun'altra testata è
disposta a dire in anticipo come si sbaglia.

### 11.5 Il paragrafo-tabella

> **così no** — «All'apice porta più velocità minima nelle curve di medio raggio: T7
> +7, T10 +5, T4 +3 km/h.»

È una legenda promossa a periodo (N2). Il grafico dice già questo, meglio.

> **così sì** — «Il vantaggio si concentra nelle curve di medio raggio, e la più grossa
> è la sette: sette km/h in più all'apice. Le altre due dello stesso tipo raccontano la
> stessa cosa in scala minore.»

---

## 12. Come si legge questa guida

Chi pianifica sceglie la forma, la tesi, l'attacco e la chiusa (capitoli 2, 3, 4, 8), e
riceve dalla memoria editoriale l'elenco di ciò che è già stato consumato.

Chi scrive lavora sui capitoli 5, 6, 7 e 11, con i fatti davanti e il piano come
vincolo. Non sceglie che cosa dire: sceglie come.

Il correttore misura i capitoli 5, 6, 7, 8, 10 e le parti meccanizzabili di 1 e 4. È
di legno: non discute, elenca. Le regole che chiama «bloccanti» fermano la
pubblicazione; le altre disegnano un profilo che si guarda accanto al pezzo, e che non
va mai compresso in un punteggio unico — un punteggio unico si ottimizza peggiorando il
testo.

Il verificatore non legge questa guida. Legge i fatti e la prosa, e cerca di
smentirla.
