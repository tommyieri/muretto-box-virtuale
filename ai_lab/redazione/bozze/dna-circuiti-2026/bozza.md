# Il DNA dei circuiti 2026: chi chiede motore e chi chiede carico

*Telemetria · 10 circuiti 2026 — Muretto · Redazione tecnica · 2026-07-26 · BOZZA*

> La percentuale di giro a tutto gas è la firma più pulita di un tracciato. Sui 10 circuiti con telemetria va dal 72% di Spa-Francorchamps — oltre due terzi di giro flat-out — al 50% di Barcelona, il più esigente. In mezzo, chi è veloce e flowing e chi è potente ma stop-and-go.

## Evidenza — Dal flat-out al labirinto
Per ogni gara abbiamo preso il giro più veloce e misurato la frazione di tracciato percorsa con l’acceleratore oltre il 95% — la percentuale a tutto gas. È il numero che gli ingegneri usano per dire, in una cifra, quanto un circuito chiede motore o carico. Non mescola potenza del motore né gomma — è solo gas contro distanza — anche se resta la firma del pilota più veloce di giornata. Per non appenderla a un giro solo, la prendiamo come mediana sui giri lanciati.Lo spettro 2026 è netto. In testa Spa-Francorchamps con il 72% del giro flat-out, e Montréal (71%): piste da motore. In fondo, Barcelona a 50% — meno di metà giro a tutto gas, il tracciato più esigente per l’ala. Un secondo numero, la velocità media in curva, separa i simili: Silverstone ha le curve più veloci (202 km/h di media, 8 curve veloci), mentre Miami Gardens è la più stop-and-go (121 km/h, 10 curve lente) pur restando flat-out a lungo.
*[figura] Percentuale di giro a tutto gas per circuito. In arancio le piste da motore, in ciano quelle da carico. — fonte: FastF1 · car telemetry, elaborazione redazione*

## Causa — Cosa chiede la pista decide come nasce la vettura del weekend
Un giro passato molto a tutto gas premia due cose: potenza del motore e bassa resistenza — si scarica l’ala, si allungano i rapporti, si cerca la velocità di punta. Un giro spezzato da tante curve premia l’opposto: carico aerodinamico e grip meccanico per portare velocità dove il gas è chiuso. È lo stesso compromesso carico-resistenza dell’altra nostra analisi, ma visto dal lato della pista: è il circuito a dire quanta ala montare.La velocità in curva aggiunge il dettaglio. Curve veloci (Silverstone) chiedono stabilità aerodinamica ad alta velocità; curve lente (Miami Gardens) chiedono trazione e agilità in uscita. Due piste con la stessa percentuale-gas possono quindi domandare vetture diverse — ed è per questo che il piano ha bisogno di due assi, non di uno.
*[figura] Il piano dei circuiti: a destra si gira di più a tutto gas (motore), in alto le curve sono più veloci. Evidenziati gli estremi. — fonte: FastF1 · car telemetry, elaborazione redazione*

## Effetto — Una mappa per leggere il resto della stagione
Tradotto: a Spa-Francorchamps e Montréal conta il motore e l’ala scarica; a Barcelona il carico; a Silverstone l’aerodinamica ad alta velocità; a Miami Gardens la trazione. È la griglia di lettura per tutto il resto — quando una squadra va forte qui e male là, spesso è scritto nel DNA del tracciato. Nota di perimetro: mancano i circuiti più estremi da carico (Monaco, Ungheria, Singapore) non ancora in archivio; la vera coda a bassa percentuale-gas sarebbe più lunga di così.

## Provenienza dei dati
- **percentuale a tutto gas (per circuito)**: Spa-Francorchamps 72% (max) · Barcelona 50% (min) · mediana 65% — `MISURATO` (frazione di distanza con throttle ≥95% sul giro veloce assoluto (FastF1))
- **velocità media in curva**: Silverstone 202 (max) · Miami Gardens 121 (min) km/h — `MISURATO` (mediana della velocità all’apice delle curve (circuit_info))
- **circuiti nel campione**: 10 (Monaco/Ungheria/Singapore assenti dalla cache) — `MISURATO` (archivio FastF1 in cache)
- **velocità di punta per circuito**: riportata ma non centrale — `STIMATO` (picco del giro veloce: può risentire della scia; la percentuale-gas non ne risente)