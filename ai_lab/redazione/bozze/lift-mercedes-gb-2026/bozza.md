# Il lift Mercedes prima del traguardo

*Telemetria · Qualifiche Gran Bretagna 2026 — Muretto · Redazione tecnica · 2026-07-24 · BOZZA*

> Sul giro lanciato a Silverstone entrambe le Mercedes staccano il piede dall'acceleratore poche decine di metri prima della linea. Nessun altro lo fa. Sul cronometro costa quasi nulla — ed è proprio questo il punto.

## Evidenza — Due auto, un gesto che nessun altro fa
La telemetria delle qualifiche del Gran Premio di Gran Bretagna mostra un gesto ripetuto e isolato: ANT e RUS, le due Mercedes, rilasciano l'acceleratore da pieno a chiuso nell'ultimo tratto del rettilineo del traguardo. Toccano il picco del rettilineo — 253 km/h ANT, 247 RUS — e da lì alzano il piede fino a tagliare la linea con il pedale a zero. Sul suo giro più veloce (1:28,111) ANT è ancora a pieno gas a 45 metri dalla linea, RUS a 51 metri: da lì il pedale va a zero.Non è un episodio isolato di un giro: ANT lo ripete in tutti e 6 i suoi giri lanciati, RUS in tutti e 5 i suoi giri lanciati. Gli altri venti piloti in pista — Ferrari, McLaren, Red Bull, Williams e tutto il resto dello schieramento — tagliano la linea con l'acceleratore ancora spalancato: su 85 giri lanciati misurati, zero lift.
*[figura] Ultimi 250 m del giro veloce. Il gas di LEC resta al 100% fino alla linea; quello di ANT è ancora pieno a 45 m e va a zero prima di tagliarla, e con esso cala la velocità. — fonte: FastF1 · car telemetry (Speed/Throttle), Qualifiche GB 2026*

## Causa — Non è il giro in corso: è la batteria per il prossimo
Il motivo non sta nel giro che si sta chiudendo, ma nel bilancio energetico dell'ibrido. L'unità di potenza recupera energia in due fasi — sotto frenata e in rilascio. Alzando il piede a qualche decina di metri dalla linea, la Mercedes trasforma per un istante la coda del rettilineo in una zona di recupero: il termico smette di spingere e parte dell'energia cinetica, che verrebbe altrimenti dissipata, rientra nella batteria.È una scelta di gestione del SOC (state of charge) in vista del giro successivo. La potenza elettrica in F1 è a budget di energia per giro: chi arriva a fine giro con più carica ha più deployment da spendere dove pesa di più — in uscita dalle curve lente, all'imbocco dei rettilinei. Il lift prima della linea è il modo di finanziare quel margine nel punto in cui costa meno.Quello che i nostri canali non vedono è la contropartita: lo stato di carica e il flusso dell'MGU-K non sono nella telemetria disponibile. Il recupero resta perciò una variabile latente — coerente con la fisica e con la sistematicità del gesto, ma non quantificabile in joule dai dati che abbiamo. Lo dichiariamo, invece di stimarlo di nascosto.
*[figura] Il punto di lift (45 m prima della linea) sul rettilineo del traguardo di Silverstone. — fonte: FastF1 · GPS position, tracciato del sito*

## Effetto — Quasi gratis sul cronometro, ed è per questo che conviene
Sul tempo del giro che si sta chiudendo il lift costa pochissimo, ed è esattamente ciò che lo rende conveniente. Il tratto interessato è la coda del rettilineo, dove il giro è ormai fatto: tenendo la velocità del picco fino alla linea, ANT e RUS recupererebbero appena qualche millesimo — sull'ordine del millesimo di secondo, dentro il rumore di un giro cronometrato.Il prezzo pagato in pista è tutto qui: qualche km/h in meno alla linea (3,0 km/h per ANT, 7,0 per RUS) e una manciata di millesimi che non spostano la posizione in griglia. In cambio, la batteria arriva al giro dopo con più margine. È un baratto quasi gratuito sul giro in corso per un vantaggio che si scarica altrove — la ragione per cui, per ora, conviene solo a chi ha scelto di gestire così l'energia: le due Mercedes.
*[figura] La velocità persa alla linea sul giro veloce isola le due Mercedes dal resto dello schieramento. — fonte: FastF1 · car telemetry, elaborazione redazione*

## Provenienza dei dati
- **ultimo campione a pieno gas (m prima della linea)**: 45 m (ANT), 51 m (RUS) — `MISURATO` (FastF1 car telemetry; limite superiore del punto di rilascio (car-data ~4 Hz))
- **ripetibilità del lift**: 6/6 (ANT), 5/5 (RUS), 0/85 (resto) — `MISURATO` (giri lanciati (IsAccurate + tempo ≤ 1,07× il giro veloce del pilota))
- **km/h persi alla linea**: 3,0 (ANT), 7,0 (RUS) — `MISURATO` (FastF1 car telemetry)
- **costo sul giro in corso**: ~0,001 s (ANT) … 0,005 s (RUS) — `STIMATO` (controfattuale: velocità del picco tenuta fino alla linea (minorante); dentro il rumore)
- **energia recuperata / SOC**: non quantificabile — `NON_MISURABILE` (canali ERS/batteria assenti dalla telemetria disponibile)