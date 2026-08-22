# 280 millesimi nel solo settore 2, e la pole cambia mano

*Qualifica del Gran Premio d’Olanda · Norris contro Russell — Muretto · Redazione tecnica · 2026-08-22 · BOZZA*

> Russell è davanti nel primo settore e nell’ultimo, ha il miglior primo settore della sessione e cinque km/h in più di velocità di punta. Poi arriva il tratto centrale del giro e in un chilometro e mezzo perde quasi tre decimi. Qui c’è dove li perde, curva per curva, e che cosa questo non basta a dire.

## Il confronto — Due giri che si contraddicono
Nel solo secondo settore Lando Norris toglie 0,280 s a George Russell. Il margine con cui poi si prende la pole vale poco più di un terzo di quella cifra. Tutto il resto del tracciato appartiene alla Mercedes.

Il cronometro chiude su 1:11,163 per Norris, poco più di un decimo davanti a Russell. I settori raccontano un’altra storia: il primo va a Russell per 0,156 s, il terzo di nuovo a lui, per un soffio. Due su tre al pilota che finisce secondo. E il suo primo settore è anche il migliore che la sessione abbia registrato, da chiunque, in qualunque giro.

Nel tratto iniziale del giro lanciato il vantaggio cumulato di Russell arriva a 0,211 s. Passa più veloce anche al rilevamento di velocità, 321 km/h contro 316; la velocità di punta però dipende da assetto, scia e rapporti, e dice poco sulla potenza. Il punto è un altro: da qualche parte, in mezzo, quel vantaggio si rovescia.


*[figura] Due giri a confronto in velocità (in alto); la differenza si legge nel pannello del vantaggio cumulato (in basso). RUS arriva a 0,211 s di vantaggio, poi nel settore 2 NOR ribalta e tocca il massimo di +0,21 s; alla linea restano 0,102 s per NOR. — fonte: FastF1 · Speed + fastf1.utils.delta_time; delta di settore da tempi di settore ufficiali (demo/data/quali_Olanda.json), Qualifica Olanda 2026*

## Dove si separano — Il tratto che decide
Il ribaltamento ha confini precisi. Il secondo settore comincia al 1.490° metro e finisce al 2.937°: poco meno di un chilometro e mezzo, senza rettilinei lunghi. Il vantaggio di Norris tocca il massimo poco prima dell’uscita da quel tratto, e da lì alla linea si assottiglia soltanto.

Il guadagno arriva dalla parte centrale delle curve, dove la vettura viaggia all’apice con più velocità. La differenza più grossa sta in curva sette: 256 km/h contro 247. In curva otto e in curva dieci lo stesso segno, in scala minore; nella nove i due si equivalgono. Fuori da quel tratto le distanze si invertono e restano di uno o due km/h, troppo poco perché un singolo giro le regga.

Alla linea il margine di pole vale 9,0 metri di luce, meno di due lunghezze di vettura. Nel solo settore centrale Norris ne guadagna quasi il triplo. Poi ne restituisce la maggior parte.


*[figura] Velocità all’apice curva per curva: barre a destra = NOR più veloce, a sinistra = RUS. Nel settore 2 NOR porta più velocità (T7 +9, T8 +8, T10 +6 km/h). Le curve-complesso (con lettera) sono una misura poco affidabile su un singolo giro. — fonte: FastF1 · velocità minima all’apice (finestra −25/+75 m), giri veloci, Qualifica Olanda 2026*

## Chi paga cosa — Il conto alla linea
Fra il primo settore e l’ultimo Russell si riprende 0,178 s, quasi due terzi di quanto aveva lasciato nel mezzo, e non basta: alla linea restano 0,102 s per Norris, e la pole cambia mano dentro un terzo di giro.

Che cosa renda la McLaren più salda all’apice in quel tratto, i nostri canali non lo dicono: carico aerodinamico, temperatura della gomma, mappe di erogazione non esistono nel feed telemetrico. Attribuire i nove km/h di curva sette alla vettura oppure alla mano che la guida sarebbe un’ipotesi travestita da misura.

Per il campionato non cambia nulla: Norris è quinto, a 91 punti dal vertice, Russell terzo. A Zandvoort, invece, cambia il punto della pista in cui va cercato il vantaggio. Il vantaggio della McLaren sul giro secco vive dentro un chilometro e mezzo di pista; chi lo cerca altrove trova la Mercedes davanti.


*[figura] La curva T7, nel settore decisivo: NOR (linea piena) tiene una velocità minima più alta di RUS (tratteggio) — 256 contro 247 km/h. — fonte: FastF1 · Speed/Throttle, giri veloci, Qualifica Olanda 2026*

## Provenienza dei dati
- **margine di pole (cronometro)**: NOR 1:11,163 · RUS 1:11,265 · 0,102 s — `MISURATO` (giri veloci veri (pick_fastest per pilota), classifica per tempo sul giro — FastF1)
- **delta per settore (pole − P2)**: S1 a RUS (0,156 s); S2 a NOR (0,280 s); S3 a RUS (0,022 s); il rivale recupera 0,178 s, il pole-man ne prende 0,280 nel solo settore 2 — `MISURATO` (tempi di settore ufficiali (demo/data/quali_Olanda.json); best FastF1 e file coincidono)
- **traccia del vantaggio cumulato lungo il giro**: RUS avanti fino a 0,211 s (a ~352 m); NOR fino a +0,21 s (a ~2567 m); alla linea +0,108 s — `MISURATO` (fastf1.utils.delta_time sui due giri veloci; endpoint coerente col margine)
- **confine dei settori in metri**: S1 fino a ~1490 m · S2 ~1490–2937 m · S3 fino a ~4219 m — `MISURATO` (Sector1/2SessionTime del giro-pole mappati su Distance della telemetria)
- **minime per curva (14 curve, giri veloci)**: nel settore 2 NOR più veloce in T7, T8, T10, T9; curva-chiave T7 +9 km/h — `MISURATO` (velocità minima all’apice (finestra −25/+75 m) sul giro veloce di ciascuno)
- **miglior settore assoluto di sessione**: RUS detiene il miglior S1; NOR il miglior S2 — `MISURATO` (min Sector1/2/3Time fra tutti i giri di tutti i piloti (FastF1))
- **velocità di punta e spazio-luce del margine**: vmax NOR 316 · RUS 321 km/h; 0,102 s a ~309 km/h ≈ 8,75 m — `STIMATO` (vmax dal canale Speed (MISURATO); spazio-luce = velocità × margine (prodotto, non misura diretta))
- **griglia di partenza (penalità)**: non ricavabile dal cronometro: per la griglia fa fede l’ufficiale — `NON_MISURABILE` (decisioni dei commissari — esterne alla telemetria; qui per non confondere quali e griglia)
- **carico aerodinamico, gomma, mappe motore**: senza canale nel feed: l’attribuzione car/pilota del carattere resta interpretazione — `NON_MISURABILE` (nessun canale di carico/temperatura/mescola/mappa nel feed telemetrico)