# Stesso motore, cambio opposto: la McLaren è la più corta della griglia

*Telemetria · Qualifiche Gran Bretagna 2026 — Muretto · Redazione tecnica · 2026-07-24 · BOZZA*

> McLaren, Mercedes e Williams montano lo stesso motore Mercedes. Eppure in ottava marcia la McLaren gira quasi seicento giri più su a 300 all'ora, e rinuncia a qualche km/h di velocità di punta. È una scelta di rapporti — e ha una logica precisa.

## Evidenza — La stessa power unit, un'ottava più corta
In una marcia fissa il regime del motore cresce con la velocità secondo una costante: quella costante è il rapporto. Misurata sui giri lanciati delle qualifiche di Silverstone, in ottava vale 36,40 giri/min per km/h sulle due McLaren, contro 34,46 sulle Mercedes e 34,44 sulle Williams — tutte e tre a motore Mercedes. È una misura pulita: il rapporto è geometria del cambio, non lo tocca né lo slipstream né il giro.Tradotto a 300 km/h: la McLaren gira a 10920 giri, la Mercedes a 10337 — 583 in più. È l'ottava più corta di tutta la griglia; quella della Mercedes ufficiale, con lo stesso motore, è tra le più lunghe. E la velocità di punta segue: la McLaren si ferma a 313 km/h, la Mercedes arriva a 319.
*[figura] In 8ª il regime cresce con la velocità secondo il rapporto: la linea McLaren è più ripida (rapporto più corto). A 300 km/h la McLaren gira 583 giri più su della Mercedes, con lo stesso motore. — fonte: FastF1 · car telemetry (nGear/RPM/Speed), Qualifiche GB 2026*

## Causa — Rinunciare alla punta per stare su di giri
Il rapporto decide, a ogni velocità, dove sta il motore nella sua curva. Un'ottava più corta tiene il regime più alto dappertutto: la McLaren rinuncia alla velocità massima assoluta per restare su di giri. Nell'era ibrida 2026 questo ha due conseguenze.La prima non la vediamo direttamente: più regime significa più finestra per la MGU-K di recuperare energia. Quanta, non è misurabile — i canali ERS e batteria non sono nel feed pubblico 2026, e restano una variabile latente che dichiariamo invece di stimare. La seconda, invece, si vede eccome: un'ottava corta protegge dal clipping. Sui lunghi rettilinei, quando l'energia elettrica finisce, chi ha l'ottava lunga scende sotto la power band del termico e deve scalare in settima a gas pieno per rimettere il motore in giri; chi ce l'ha corta resta abbastanza su di giri da non doverlo fare. Ai nostri dati di Spa — dove metà griglia scala marcia in pieno rettilineo e la McLaren no — dedicheremo il prossimo pezzo.
*[figura] Giri/min a 300 km/h in 8ª, per team (asse troncato da 10.200 per leggere le differenze). Più alto = 8ª più corta. La McLaren è staccata in cima. — fonte: FastF1 · car telemetry, elaborazione redazione*

## Effetto — Il baratto dei rapporti, portato all'estremo
Il conto è 583 giri/min in più a 300 km/h, un'ottava più corta del 5,6% rispetto alla Mercedes che monta lo stesso motore, e 6 km/h di velocità di punta in meno. In cambio il motore resta più in coppia in uscita dalle curve e più al riparo dal clipping sui lunghi. È il classico compromesso dei rapporti — velocità di punta contro regime — portato all'estremo: sulla griglia 2026, nessuno è più corto della McLaren.

## Provenienza dei dati
- **rapporto in 8ª (giri/min per km/h)**: 36,40 McLaren · 34,46 Mercedes · 34,44 Williams — `MISURATO` (mediana RPM/velocità in 8ª sui giri lanciati (FastF1))
- **giri/min a 300 km/h in 8ª**: 10920 McLaren · 10337 Mercedes (Δ 583) — `MISURATO` (rapporto × 300)
- **velocità di punta**: 313 km/h McLaren · 319 Mercedes — `MISURATO` (max velocità sui giri lanciati (FastF1))
- **energia recuperata (MGU-K) grazie al regime più alto**: non quantificabile — `NON_MISURABILE` (canali ERS/batteria assenti dal feed pubblico 2026)