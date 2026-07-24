# Stowe, stessa Ferrari: LEC in 6ª dove HAM scala in 5ª

*Telemetria · Qualifiche Gran Bretagna 2026 — Muretto · Redazione tecnica · 2026-07-24 · BOZZA*

> In una curva veloce di Silverstone le due Ferrari passano l’apice a velocità vicina, ma con una marcia di differenza: LEC in 6ª, HAM in 5ª. E scalare non rende HAM più veloce — gli alza il regime. Non è un caso: è una scelta, e si ripete.

## Evidenza — Due Ferrari identiche, guidate in modo diverso
A Stowe — curva 15, l’apice si passa a circa 225 km/h in appoggio — la telemetria delle qualifiche mostra due Ferrari guidate in modo diverso. LEC passa l’apice in 6ª su tutti e 6 i suoi giri lanciati; HAM scala in 5ª in 4 dei 5.All’apice le due Ferrari passano a velocità vicina — 225 contro 220 km/h — e scalare non rende HAM più veloce: gli alza soltanto il regime, 1368 giri/min più su. La differenza è tutta nella marcia. Non è nemmeno un caso isolato del singolo circuito: su tutto lo schieramento i compagni di squadra scelgono marce diverse all’apice in 13 punti del giro.
*[figura] Attorno all’apice di Stowe: le tracce di velocità restano vicine, quelle della marcia si separano — LEC tiene la 6ª, HAM scala in 5ª. — fonte: FastF1 · car telemetry (nGear/Speed), Qualifiche GB 2026*

## Causa — In una curva veloce la marcia non fa velocità: fa il retrotreno
La scelta della marcia in una curva veloce non serve a fare velocità di percorrenza — quella la decidono aerodinamica e gomme — ma a decidere come si comporta il retrotreno all’uscita. In 6ª il motore gira più basso, vicino al regime di potenza, e ha poca coppia residua da scaricare a terra: la vettura è più stabile e prevedibile in appoggio. È la scelta di LEC.In 5ª il motore gira più su di giri, ha più coppia disponibile e fa ruotare di più la vettura all’uscita — più trazione e rotazione, al prezzo di un retrotreno più nervoso da gestire. È la scelta di HAM. È la stessa monoposto: cambia la mano del pilota. Il comportamento del retrotreno che ne segue lo interpretiamo dalla fisica; non è un canale che misuriamo.
*[figura] Stowe (curva 15) sul tracciato di Silverstone: la curva veloce dove i due Ferrari scelgono marce diverse. — fonte: FastF1 · GPS position + circuit_info, tracciato del sito*

## Effetto — A parità di velocità, mille e quattrocento giri di distanza
A velocità di percorrenza vicina, 1368 giri/min separano le due Ferrari: 6ª contro 5ª, stabilità contro rotazione. E scalare non compra velocità — HAM passa l’apice se mai un filo più piano. Non è un dettaglio di un solo punto: su tutta la griglia i compagni dissentono sulla marcia in 13 apici diversi. È la firma di due stili di guida che convivono nella stessa vettura.

## Provenienza dei dati
- **marcia all’apice**: LEC 6ª (tutti e 6), HAM 5ª (4 dei 5) — `MISURATO` (moda della marcia all’apice sui giri lanciati (FastF1 + mappa-curve circuit_info))
- **velocità all’apice**: 225 vs 220 km/h (HAM non più veloce scalando) — `MISURATO` (mediana della velocità minima all’apice sui giri lanciati)
- **giri/min all’apice**: Δ 1368 (più alti per HAM) — `MISURATO` (mediana RPM all’apice)
- **disaccordi di marcia tra compagni**: 1 (Ferrari), 13 sulla griglia — `MISURATO` (scansione di tutte le curve, tutti i team con 2 piloti)
- **comportamento del retrotreno (stabilità vs rotazione)**: interpretazione fisica — `NON_MISURABILE` (nessun canale di assetto/imbardata; è la lettura della scelta, non un dato)