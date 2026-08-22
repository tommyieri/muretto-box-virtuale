# Quattro secondi e mezzo fra primo e ultimo, e nessuno è separabile

*Sprint di Zandvoort · il passo in aria libera — Muretto · Redazione tecnica · 2026-08-22 · BOZZA*

> Tredici piloti hanno abbastanza giri liberi per essere misurati, e alla fine restano un blocco solo. Il motivo non è che vadano tutti uguale: è quanto è rumorosa una sprint di ventiquattro giri. Diciamo quanto grande avrebbe dovuto essere un divario, qui, per contare qualcosa.

## Che cosa cercavamo — Una sprint è il laboratorio più pulito che abbiamo
Norris chiude la sprint di Zandvoort davanti a tutti nel passo in aria libera, e il suo primato non sopravvive alla prima verifica seria. Una sprint dovrebbe essere il posto migliore dove misurare il ritmo vero di una vettura: una sola mescola per tutti, carburante identico per regolamento, ventiquattro giri filati. Poche variabili grosse da correggere.

Il filtro che applichiamo resta severo. Entrano nel conto soltanto le sequenze di almeno cinque giri consecutivi percorsi con la vettura davanti oltre 1,5 s, sulla mescola di campo: sotto quella distanza l’aria sporca toglie carico aerodinamico in curva e il tempo sul giro smette di appartenere al pilota che lo firma. Chi non mette insieme una sequenza così non viene misurato, per quanto veloce sia andato.

Restano tredici piloti su ventidue, nove squadre, 184 giri utili sui 456 puliti dell’intera sessione. Leclerc, Antonelli e Hülkenberg non compaiono affatto: nella loro sprint la pista davanti non si è mai liberata abbastanza a lungo. La copertura è questa, e conviene dichiararla prima dei risultati, perché una lista di tredici nomi su ventidue non è una fotografia del campo.


*[figura] La sequenza libera più lunga di ogni pilota. In evidenza chi supera i 5 giri ed entra nella misura. — fonte: FastF1 · laps Sprint Olanda 2026 — gap alla macchina davanti per giro*

## Che cosa abbiamo trovato — Una lista lunga quattro secondi e mezzo, e un gruppo solo
Da lontano la lista somiglia a una classifica. Norris in testa, Pérez in fondo, 4,398 s al giro fra i due, con tutti i valori riportati allo stesso punto della sprint perché il carburante che cala non falsi il confronto. Subito dietro Norris ci sono Russell a 0,192 s, Piastri a 0,454, Hamilton a 0,614. Il quinto è Verstappen, a 0,952 s.

Poi abbiamo provato a spezzare la lista in gruppi, e non si è spezzata. Il criterio confronta ogni pilota con quello immediatamente sopra di lui, e apre un gruppo nuovo solo quando il distacco fra i due supera l’incertezza di quella coppia. Misurarli tutti contro il primo sarebbe più comodo e darebbe esiti assurdi: separerebbe due piloti distanti 74 millesimi e terrebbe insieme una coppia a 242.

Il salto più largo fra due vicini è l’ultimo, quello che scivola verso Pérez: 0,728 s. Resta sotto la sua soglia, come tutti gli altri. Tredici piloti misurati, un gruppo solo: da Norris a Verstappen, e giù attraverso Bortoleto, Gasly, Ocon, Albon e Sainz, la catena dei vicini non si taglia in nessun punto.


*[figura] Distacchi in secondi al giro dal passo di NOR, tutti riportati al giro 15. In evidenza chi resta dentro la risoluzione della misura. — fonte: FastF1 · laps Sprint Olanda 2026 — sequenze in aria libera*

## Quanto doveva essere grande — Il metro è più largo di quello che deve misurare
La dispersione residua della stima, cioè di quanto un singolo giro si scosta da ciò che il modello prevede per quel pilota in quel momento della sprint, vale 1,560 s. Un giro solo di rumore copre quasi tutto lo spazio che separa Norris dal sesto della lista, Bortoleto, che sta a 1,589 s.

Da quel rumore discende l’incertezza su ciascun livello, e non è uguale per tutti: va da 0,334 s per chi ha girato libero quasi tutta la sprint a 0,710 s per chi ha appena la sequenza minima. Per questo la soglia si calcola coppia per coppia; a seconda di chi si confronta vale fra 0,947 e 1,714 s.

Perché un divario si vedesse doveva superare i 0,952 s che passano fra Norris e Verstappen. Nessuna coppia vicina, nella lista, arriva a tanto.

Un limite pesa più di tutti gli altri, e va detto per intero. Su gomme che nessuno cambia, l’età del pneumatico cresce insieme al numero del giro: dentro le sequenze passa da dieci a ventotto giri, e nessuna aritmetica separa i due effetti. La tendenza che correggiamo, 0,127 s al giro, è quindi una sola per tutti, ed è una scelta di metodo, non una misura del degrado di ciascuno.

Per rispondere davvero servirebbero sequenze in aria libera molto più lunghe di queste, e la gara di domenica sullo stesso tracciato le produrrà. Fino ad allora, chi arriva a Monza raccontando che a Zandvoort una vettura aveva il passo migliore sta leggendo il rumore.


*[figura] I giri veri di ogni sequenza, senza nessuna correzione, nell'ordine della stima corretta. — fonte: FastF1 · laps Sprint Olanda 2026 — tempi grezzi delle sequenze*

## Provenienza dei dati
- **passo migliore della sprint**: NOR — 1:15,920 al giro 15 — `MISURATO` (livello a effetti fissi di pilota con tendenza comune sul numero di giro, su 6 giri consecutivi in aria libera (giri 19–24, gomma medium))
- **distacchi pubblicati**: da 0,192 a 4,398 s al giro — `MISURATO` (differenze fra i livelli, tutte riportate al giro 15: non sono medie di tempi sul giro)
- **soglia di separazione (coppia per coppia)**: 0,947–1,714 s fra piloti consecutivi; incertezza per pilota ±0,334–±0,710 s — `MISURATO` (1,96·√(SE²+SE²) della COPPIA. Non un'unica risoluzione: i SE per pilota variano di un fattore 2-3 dentro lo stesso evento, e una soglia sola sarebbe troppo stretta per le coppie rumorose e troppo larga per quelle precise)
- **risoluzione tipica (solo contesto)**: 1,123 s al giro — `MISURATO` (1,96·√2·SE mediano, dal rumore residuo 1,560 s per giro su 184 giri (170 gradi di libertà). È l'ordine di grandezza del problema, NON il criterio: i gruppi si formano coppia per coppia)
- **criterio dei gruppi**: 1 gruppi; confine più stretto nessuno — `MISURATO` (un gruppo nuovo si apre solo se il distacco dal pilota PRECEDENTE supera la soglia di quella coppia (non dal capogruppo: col capogruppo si separavano piloti a 74 millesimi mentre altri a 242 restavano insieme). Un gruppo può essere più largo della soglia: significa catena di vicini non separabili, ed è l'affermazione che i dati reggono)
- **copertura del campione**: 13 piloti su 22, 9 squadre, 184 giri — `MISURATO` (solo chi ha almeno 5 giri CONSECUTIVI con il davanti oltre 1,5 s, sulla mescola di campo; cancello: almeno 8 piloti e 5 squadre, altrimenti l'articolo non esce)
- **tendenza lungo la sprint (benzina + pista + usura media)**: 0,127 s al giro (±0,022) — `MISURATO` (coefficiente unico del numero di giro nella stessa stima)
- **degrado per pilota**: non stimato — `NON_MISURABILE` (da uno stint solo le pendenze per-stint sono inaffidabili (rumore di gara molto maggiore del segnale): la tendenza qui è UNA per tutti, per scelta)
- **età della gomma dentro le sequenze**: da 10 a 28 giri — `NON_MISURABILE` (in una sprint con una sosta sola l'età gomma e il numero di giro si muovono insieme: non separabili, si dichiarano)
- **carico di carburante al via**: non nel feed — `NON_MISURABILE` (uguale per tutti per regolamento nella sprint, ma non verificabile dai dati)
- **canale DRS**: nullo su tutte le sessioni 2026 — `NON_MISURABILE` (nessun distacco qui misurato è attribuibile all'ala mobile: il canale non distingue nulla)