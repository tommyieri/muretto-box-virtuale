# A Zandvoort nessuno porta un pezzo pensato per Zandvoort

*Documento FIA · Car Presentation Submissions, Gran Premio d’Olanda — Muretto · Redazione tecnica · 2026-08-21 · BOZZA*

> Sei squadre su undici depositano aggiornamenti, e nessuna dichiara un solo componente di configurazione per il circuito più tortuoso del calendario. Il pacchetto più largo è di Alpine, otto pezzi, ma il conteggio delle righe non misura quello che sembra misurare. Dove finisce il documento e dove comincia l’ipotesi, detto prima di usarlo.

## Quello che si è letto — Il tracciato che dovrebbe chiedere pezzi suoi
Le due sopraelevate di Zandvoort, e una sequenza di curve quasi tutte attaccate l’una all’altra, fanno del tracciato olandese un caso a parte: carico alto, pochissimo rettilineo, un assetto che altrove non serve. Un circuito così dovrebbe chiedere pezzi suoi. Il modulo che le squadre hanno depositato alla FIA venerdì mattina, poche ore prima delle libere, racconta un’altra cosa.

Undici squadre compilano, sei portano qualcosa, cinque scrivono che per questo evento non hanno depositato nulla: Williams, Racing Bulls, Haas, Audi e Cadillac. Le righe complessive sono 23. Quelle classificate come configurazione per il circuito sono 0 su 23. La casella resta vuota per tutte e sei le squadre che aggiornano, comprese quelle che riempiono mezza pagina.


*[figura] Ogni squadra ha la riga col suo nome — la barra a destra sono i pezzi dichiarati come sviluppo («Performance») — e, dove ce ne sono, una seconda riga «· circuito» a sinistra con quelli di configurazione («Circuit specific»); l'ordine è quello della barra di sviluppo. Sono righe del documento: una descrizione condivisa può coprirne più d'una. La nota a destra dice in quanti weekend 2026 <b>precedenti</b> quella squadra aveva aggiornato (questo escluso). — fonte: FIA · Car Presentation Submissions, Dutch Grand Prix 2026 (pubblicato 2026-08-21)*

## Quello che dicono i dati — Ventidue righe di sviluppo e una di affidabilità
Le righe depositate sono 23; gli aggiornamenti distinti sono 19. Ferrari ne firma cinque e le copre con tre descrizioni soltanto, perché corpo del fondo, tavola e bordo lavorano insieme e la fonte lo dichiara; Aston Martin si comporta allo stesso modo. Alpine invece spacchetta: il suo pacchetto è il più largo del weekend, e resta il più largo anche dopo la scrematura.

Il numero, però, misura pure il modo di compilare il modulo. Chi scrive una riga per ogni codice pezzo sembra portare più materiale di chi ne scrive una per l’intero blocco. La differenza sta nella cancelleria.

Sulle famiglie il documento non lascia margini: 22 righe dichiarate come sviluppo, una sola per affidabilità. Dentro lo sviluppo l’intenzione dichiarata è aumentare il carico in una zona precisa 18 volte, migliorare la qualità del flusso quattro. Il caso limite lo firma Aston Martin, con un flap che allarga la finestra di bilanciamento ottenibile regolando l’ala anteriore: la definizione stessa di un intervento d’assetto. Anche quella riga sta fra gli sviluppi.


*[figura] Il «Primary reason» dichiarato dalle squadre, tradotto e contato riga per riga. In pieno le intenzioni della famiglia sviluppo, in trasparenza quelle delle altre famiglie presenti in questo documento (affidabilita'). È una dichiarazione d'intenti, non una misura di effetto. — fonte: FIA · Car Presentation Submissions, Dutch Grand Prix 2026 — campo «Primary reason»*

## Quello che resta in piedi — Dove finisce il documento
La famiglia la scelgono le squadre, e nessuno la verifica: se una scuderia decide di chiamare sviluppo un’ala tagliata per l’occasione, il modulo la registra come sviluppo e la cosa finisce lì. Restano fuori altre due cose. Il documento non dice se il pezzo finirà davvero sulla vettura, e una sola riga su 23 si dichiara come opzione disponibile; non dice nemmeno su quale delle due macchine andrà, perché un campo per scriverlo non esiste.

Le zone toccate parlano la stessa lingua. Il fondo raccoglie 7 pezzi, poi vengono diffusore, retrotreno e le due ali con tre ciascuno: sono i posti che pagano a Monza come a Budapest, non angoli scelti per due curve inclinate. Quanto valga tutto questo il documento non lo dice, e non lo diciamo noi: una riga può essere un fondo nuovo o un ritocco di pochi millimetri, e sul foglio occupano lo stesso spazio.

Del 2026 abbiamo riletto zero documenti FIA precedenti a questo, quindi non sappiamo ancora se la casella vuota sia una particolarità olandese. Il controllo è già fissato: se al prossimo Gran Premio qualche squadra dichiara un componente come configurazione da circuito, allora lo zero di oggi è una scelta tecnica. Se resta vuota anche lì, quella casella quest’anno non serve a leggere niente.


*[figura] Pezzi per zona della vettura a Zandvoort. Il colore è quello della squadra che ha messo più pezzi in quella zona. Qui sviluppo e configurazione sono sommati: la separazione sta nella figura precedente. — fonte: FIA · Car Presentation Submissions, Dutch Grand Prix 2026 — campo «Updated component», zone canoniche della redazione*

## Provenienza dei dati
- **pezzi dichiarati alla FIA**: 23 righe da 6 squadre su 11 — `MISURATO` (documento FIA «Car Presentation Submissions» Dutch Grand Prix 2026 — 2026_dutch_grand_prix_-_car_presentation_submissions.pdf; lettura e cancelli di identità/qualità in ai_lab/redazione/fia_cp.py)
- **sviluppo vs configurazione da circuito**: 22 «Performance» · 0 «Circuit specific» (0% del totale) · 1 affidabilità — `MISURATO` (campo «Primary reason», famiglie dichiarate dalla FIA — tenute separate: la configurazione è assetto per questo tracciato, non progresso. Le famiglie della FIA sono TRE: una cella senza prefisso non è una quarta famiglia)
- **pacchetto più largo**: Alpine, 8 righe = 8 aggiornamenti distinti (8 sviluppo, 0 configurazione) — `MISURATO` (righe della sua tabella, e aggiornamenti distinti = righe con la STESSA descrizione contate una volta (la fonte scrive «are a package»). Non è una misura di grandezza (vedi sotto): squadre diverse spezzano lo stesso pacchetto in un numero diverso di righe; primato stretto sugli aggiornamenti distinti)
- **righe contro aggiornamenti distinti**: 23 righe = 19 descrizioni distinte; Ferrari 5→3, Aston Martin 5→3 — `MISURATO` (conteggio delle descrizioni identiche dentro la stessa squadra; non cattura i pacchetti che la fonte NON dichiara tali, quindi è un limite inferiore allo spacchettamento, mai una stima di valore)
- **squadre senza aggiornamenti**: Williams, Racing Bulls, Haas, Audi e Cadillac («No updates submitted for this event») — `MISURATO` (NULL dichiarato dalla fonte, distinto dal parsing fallito: è una notizia, non un dato mancante)
- **frequenza di aggiornamento in stagione**: non disponibile — `MISURATO` (0 documenti FIA 2026 PRECEDENTI, riletti con lo stesso estrattore — il documento di Dutch Grand Prix è ESCLUSO dal contesto: contarlo significherebbe confermare col weekend che l'articolo commenta)
- **zona più toccata**: Fondo — 7 pezzi su 23 — `MISURATO` (campo «Updated component» mappato sulle 15 zone canoniche; i componenti fuori tabella restano dichiarati in diagnostica, mai indovinati)
- **intenzione dichiarata più frequente**: «carico locale» — 18 pezzi — `MISURATO` (campo «Primary reason»: è quel che la squadra DICHIARA di cercare, non un effetto osservato)
- **su quale vettura / pilota va il pezzo**: nessuna delle 23 righe lo nomina — `NON_MISURABILE` (cercate in questo documento le formule «car N», «both cars», «each car», «one car only», «driver N», «race number»: la fonte non ha un campo per dirlo, quindi una macchina sola o entrambe è indistinguibile. NON sono cercati «chassis»/telaio né «driver» da soli: nel documento compaiono come nomi di componente, quindi il conteggio non copre quella parola)
- **grandezza dell'aggiornamento (quanto vale)**: nessun numero di prestazione nel documento — `NON_MISURABILE` (il conteggio delle righe non è la magnitudine: una riga può essere un pezzo nuovo o un ritocco, e occupano lo stesso spazio. Non è nemmeno il numero di aggiornamenti: vedi «righe contro aggiornamenti distinti»)
- **se il pezzo verrà davvero montato**: 1 righe su 23 lo dichiarano «available»/«optional» — `NON_MISURABILE` (un componente «portato» può restare nel camion: il documento non registra cosa finisce sulla macchina)