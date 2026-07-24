# Village: HAM è il più tardivo della griglia sui freni

*Telemetria · Qualifiche Gran Bretagna 2026 — Muretto · Redazione tecnica · 2026-07-24 · BOZZA*

> In una delle staccate più dure di Silverstone HAM attacca i freni più tardi di chiunque sulla griglia: a 100 metri dall’apice, 14 in meno del primo inseguitore, 18 sotto la mediana. Il più tardivo di tutti.

## Evidenza — L’ultimo a togliere il piede dal gas
Village è la staccata più dura del giro: si arriva a 275 km/h e si scende a 110 all’apice. La telemetria delle qualifiche misura, per ogni pilota, dove attacca i freni — la distanza dall’apice a cui inizia a frenare. HAM è il più tardivo di tutti: 100 metri dall’apice, contro una mediana di schieramento di 118 e i 140 m del più prudente (GAS).Il primo a inseguirlo è il compagno LEC, stessa vettura, a 114 metri — 14 più presto in mediana. Su singoli giri i due si sovrappongono: il fatto netto non è il duello in casa, è che HAM è il più tardivo dell’intero schieramento.
*[figura] Attorno a Village: HAM (pieno) tiene il gas più a lungo e attacca i freni più tardi (marcatore più vicino all’apice) del compagno LEC (tratteggio). — fonte: FastF1 · car telemetry (Brake/Speed), Qualifiche GB 2026*

## Causa — Frenare tardi vuol dire portare velocità più a fondo
Lo spazio di frenata cresce col quadrato della velocità: ritardare la staccata significa arrivare più veloci più a fondo e poi frenare più forte, in meno spazio. È il modo classico di guadagnare tempo in ingresso — HAM tiene il gas qualche metro in più e affida il resto alla frenata.In teoria costa margine: frenare tardi lascia meno spazio all’errore e chiede di più a freni e gomma anteriore. Ma quanto, non lo vediamo — temperatura e carico dei freni non sono canali nel feed, e lo diciamo invece di stimarlo. E una cautela onesta: misuriamo questa staccata, e su questa HAM è il più tardivo; non la promuoviamo a “stile” del pilota senza misurarlo su altre frenate.
*[figura] Village (curva 3) sul tracciato di Silverstone: la staccata più dura del giro. — fonte: FastF1 · GPS + circuit_info, tracciato del sito*

## Effetto — Metri, non decimi — ma sono i metri giusti
Il divario è concreto: 18 metri più tardi della mediana dello schieramento, 14 metri più tardi del proprio compagno con la stessa macchina. In una staccata da 275 km/h quei metri sono il confine tra un ingresso pulito e uno al limite: è lì che HAM cerca il tempo, e lo cerca dove fa più male sbagliare.

## Provenienza dei dati
- **punto di frenata (m prima dell’apice)**: HAM 100 m · LEC 114 m · mediana 118 m — `MISURATO` (prima attivazione del canale Brake in avvicinamento all’apice, mediana sui giri lanciati (FastF1 + mappa-curve))
- **velocità della staccata**: 275 → 110 km/h — `MISURATO` (massima in avvicinamento e minima all’apice)
- **usura/temperatura di freni e gomma**: non quantificabile — `NON_MISURABILE` (nessun canale di temperatura o carico freni nel feed)