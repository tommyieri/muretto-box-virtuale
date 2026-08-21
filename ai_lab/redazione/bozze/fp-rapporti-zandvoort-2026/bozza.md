# Il cambio più corto della griglia, e perché non racconta la velocità di punta

*Telemetria · Qualifica Sprint · Dutch Grand Prix 2026 — Muretto · Redazione tecnica · 2026-08-21 · BOZZA*

> Sui giri lanciati di Qualifica Sprint a Zandvoort la 7ª marcia — la marcia-alta più usata della sessione, ricavata dai dati — misura il rapporto del cambio: il più corto è di NOR (McLaren), il più lungo di BOR (Audi), uno spread del 14,0%. È geometria pura, immune a carburante, mappa motore e scia. Ma la tentazione «corto uguale lento in fondo» non regge: il rapporto lo misuriamo, la velocità di punta in qualifica sprint resta indicativa e non la spieghiamo col cambio (Spearman 0,03).

## Evidenza — La 7ª più corta della griglia
In una marcia fissa il regime del motore cresce con la velocità secondo una costante: quella costante è il rapporto. La misuriamo in 7ª — la marcia più usata sopra i 280 km/h in questa sessione (1933 campioni contro 1745 in 8ª), la stessa che tutte le vetture raggiungono — sui giri lanciati (74 in totale). Vale 41,82 giri/min per km/h su NOR (McLaren), il valore più alto della griglia, contro 36,68 su BOR (Audi), il più basso: uno spread del 14,0% fra la più corta e la più lunga. È una misura pulita — geometria del cambio, non la tocca né la scia né la mappa motore né il carburante.

Tradotto sulla retta RPM-velocità: a 280 km/h in 7ª la vettura più corta gira 1441 giri in più della più lunga. La soglia di 280 km/h e la scelta della 7ª non sono cablate: le deriviamo dalla distribuzione di velocità e marce della sessione.


*[figura] In 7ª il regime cresce con la velocità secondo il rapporto: le linee più corte sono più ripide, le più lunghe più piatte. A 280 km/h il divario è di 1441 giri/min. — fonte: FastF1 · car telemetry (nGear/RPM/Speed), Dutch Grand Prix 2026 SQ*

## Causa — Geometria, non artefatto: regge in banda stretta e in 8ª
Il primato non è un effetto di come è distribuita la velocità nei nostri campioni. Ristretto alla sola banda 285–295 km/h, il rapporto della vettura più corta resta –, praticamente identico al 41,82 misurato su tutta la banda: nessun bias di distribuzione.

E l’ordine si ripete in 8ª: NOR (McLaren) resta 2ª (36,44 giri/min per km/h) fra le vetture con dati affidabili. La 8ª però è meno usata e per alcune — ALO (Aston Martin), BOR (Audi), HUL (Audi) — non ha campioni utili sopra i 280 km/h: per questo il confronto di griglia lo teniamo in 7ª, dove tutti hanno dati, verificando che la marcia superiore racconti la stessa cosa.

Un cambio più corto tiene il regime più alto a ogni velocità: è una scelta di rapporti, e questa vettura la porta all’estremo. Che cosa comporti più a valle, sul propulsore e sulle sue temperature, qui non si misura e non si asserisce: nel feed pubblico quei canali non ci sono.


*[figura] Rapporto in 7ª per vettura (asse troncato da 36 per leggere le differenze). Più alto = marcia più corta. — fonte: FastF1 · car telemetry, elaborazione redazione*

## Effetto — Corto non vuol dire lento in fondo
Qui scatta la tentazione: cambio corto uguale meno velocità di punta. In qualifica sprint non regge. La correlazione fra rapporto in 7ª e velocità di punta mediana è praticamente nulla: Spearman 0,03 su 21 vetture. La punta più bassa dello schieramento è di ALO (Aston Martin) (294 km/h), la più alta di COL (Alpine) (327); la vettura più corta e quella più lunga non stanno agli estremi della punta. Nessuna relazione monotona: il rapporto non spiega la velocità di fondo.

Del resto la punta, in qualifica sprint, va presa per quello che è: i giri lanciati sono tutti a benzina bassa e motore in spinta, quindi il carburante non confonde — ma la scia sì, e gonfia il picco — fino a +6 km/h su ANT (Mercedes) (328 di picco contro 322 di mediana). Per questo usiamo la mediana dei picchi per-giro, non il picco. E il DRS non aiuta a distinguere: nel feed di questa sessione il canale è degenere (unico valore [0] su 74 giri lanciati), quindi le punte che misuriamo sono tutte ad ala chiusa. A titolo di contesto della sessione, la griglia sta a tutto gas per una mediana del 50,1% del giro. Morale: il rapporto lo misuriamo — geometria, robusta — la punta resta indicativa e non la spieghiamo col cambio.


*[figura] Ogni punto una vettura: rapporto in 7ª (orizzontale) contro velocità di punta mediana (verticale). La nuvola non ha pendenza (Spearman 0,03): il cambio non predice la punta in qualifica sprint. — fonte: FastF1 · car telemetry, elaborazione redazione*

## Provenienza dei dati
- **rapporto in 7ª (giri/min per km/h)**: 41,82 NOR (McLaren) · 36,68 BOR (Audi) · spread 14,0% — `MISURATO` (mediana RPM/velocità in 7ª (Speed>280) sui giri lanciati SQ; n 28–206 campioni/vettura)
- **marcia-alta e soglia di velocità (derivate)**: 7ª sopra 280 km/h; coerenza in 8ª — `MISURATO` (V_SOGLIA = P80 della velocità grid-wide arrotondato a 10; GEAR_TOP = la marcia con più campioni sopra V_SOGLIA fra quelle coperte da ≥66% dei piloti (≥15 campioni))
- **controllo bias-distribuzione (banda stretta)**: – in 285–295 km/h ≈ 41,82 pieno — `MISURATO` (rapporto della vettura più corta ristretto alla banda comune di velocità)
- **velocità di punta (mediana dei picchi per-giro)**: 294–327 km/h (mediana griglia 316,2, spread 33) — `MISURATO` (mediana dei picchi per-giro sui giri lanciati; INDICATIVA in qualifica sprint)
- **scia (picco − mediana)**: fino a +6 km/h (ANT) — `MISURATO` (picco singolo vs mediana dei picchi — motivo per usare la mediana)
- **correlazione rapporto 7ª ↔ punta**: Spearman 0,03 (n=21, p=0,904, non regge la soglia 0,05) — `MISURATO` (correlazione di rango fra rapporto e punta mediana; p a due code dalla t di Student. La tesi «corto ≠ lento in fondo» vale solo quando NON regge: quando regge, il pezzo lo dice e cambia titolo)
- **% del giro a tutto gas (Throttle≥95)**: mediana griglia 50,1% (min 43,4 / max 54,2, spread 10,7 pt) — `MISURATO` (mediana per-giro; robusto è il valore-griglia, non il ranking per-pilota)
- **stato DRS (ala aperta/chiusa)**: non leggibile — `NON_MISURABILE` (canale degenere (unico valore [0] su 74 giri lanciati); punte misurate ad ala chiusa)
- **carburante e mappa motore (qualifica sprint: confondono la punta)**: benzina bassa per tutti; mappe non pubbliche — `STIMATO` (qualifica sprint: il carico di carburante è basso per tutti (giro secco), le mappe restano non pubbliche → la punta è confrontabile ma non è un verdetto)
- **effetti del regime più alto sul propulsore (temperature, consumi)**: non quantificabile — `NON_MISURABILE` (i canali relativi non sono nel feed pubblico)