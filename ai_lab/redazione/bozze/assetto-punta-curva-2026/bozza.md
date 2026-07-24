# La mappa dell’assetto 2026: chi corre carico e chi scarico

*Telemetria · 9 gare 2026 — Muretto · Redazione tecnica · 2026-07-24 · BOZZA*

> Incrociando velocità di punta e velocità in curva su 9 gare — con la punta ripulita dalla scia — si legge come ogni team ha risolto il compromesso carico-resistenza. In cima, vicine, Ferrari e Red Bull; ai lati chi carica l’ala e chi corre scarico.

## Evidenza — Nove gare, un piano solo
Per ogni gara con telemetria in archivio abbiamo misurato, per team, la velocità di punta — la mediana sui giri, non il picco singolo, per non farci ingannare da un traino — e la velocità mediana all’apice delle curve, e le abbiamo trasformate in percentili rispetto ai rivali su quel circuito. La media colloca ogni squadra sul piano rettilineo–curva.Il compromesso si legge a occhio. La McLaren è la più caricata: 72° percentile in curva ma 44° sul dritto. All’opposto la Haas corre scarica: 69° sul dritto, appena 37° in curva. In cima al combinato, vicine, la Ferrari (57·69) e la Red Bull (63·61) — forti da entrambe le parti. In fondo, indietro un po’ ovunque, la Aston (17·41).Chi sia davvero la prima è però un testa a testa: togliendo una gara qualsiasi, in cima si alternano Ferrari e Red Bull. Il vertice dipende dal circuito, non è un distacco netto — e per questo la mappa conta più della classifica.
*[figura] Ogni team sul piano rettilineo–curva (9 gare, percentili). In alto a destra chi è forte ovunque; in basso a destra le scelte scariche; a sinistra chi resta indietro. Evidenziate le due in testa al combinato (Ferrari e Red Bull). — fonte: FastF1 · car telemetry, elaborazione redazione*

## Causa — Fare carico costa resistenza — e non è solo aerodinamica
Ogni vettura vive sullo stesso compromesso: più ala significa più carico in curva ma più resistenza sul dritto. Chi sta in alto a destra genera più carico per unità di resistenza; chi scende in basso a destra ha scelto la velocità di punta. È la scelta d’assetto che separa la McLaren carica dalla Haas scarica.Due confonditori vanno dichiarati, non nascosti. La velocità di punta non è solo resistenza: ci mette dentro la potenza del motore. La velocità in curva non è solo carico: ci mette grip meccanico e gomma. Perciò questa è una firma di assetto — come ogni team bilancia dritto e curva — non una misura di efficienza aerodinamica pura, che dai nostri canali non è isolabile. Un pezzetto di controllo sul motore: fra i team a motore Mercedes (Alpine, McLaren, Mercedes, Williams) il dritto non è una questione di cavalli, ed è lì che la scelta d’assetto si legge più pulita.
*[figura] Combinato = media dei percentili rettilineo e curva. 50 è la media dello schieramento; è un ordine di forza-in-entrambi, non una misura di efficienza aerodinamica. — fonte: FastF1 · car telemetry, elaborazione redazione*

## Effetto — Undici modi di risolvere lo stesso problema
La fotografia del 2026 non è una classifica di valore: è una mappa di scelte. La McLaren carica l’ala e comanda in curva, pagandola sul dritto; la Haas fa l’opposto; Ferrari e Red Bull riescono a stare forti da entrambe le parti; la Aston deve ancora trovare la sua strada. Lo stesso compromesso carico-resistenza, risolto in undici modi diversi.

## Provenienza dei dati
- **posizione sul piano (percentile rettilineo · curva)**: McLaren 44·72 (carica) · Haas 69·37 (scarica) · Ferrari 57·69 — `MISURATO` (vmax (mediana sui giri) e velocità mediana all’apice (curve <235 km/h), percentile per-gara, media su ≤9 gare)
- **vertice del combinato (robustezza)**: testa a testa Ferrari e Red Bull — #1 cambia togliendo una gara (leave-one-out: 6/9 vs 3) — `MISURATO` (leave-one-out sulle 9 gare)
- **efficienza aerodinamica pura (L/D)**: non isolabile — `NON_MISURABILE` (la punta include la potenza PU e la curva il grip meccanico)