# NOTA_PISTE — tracciati e pallini della pagina-gara

## Metodo
`gen_pista_svg.py` (python3 utente, fastf1 — NON venv; cache `~/muretto_shared/ff1_cache/`)
produce `demo/data/pista_<gara>.json` per ogni gara del registro: la polilinea del circuito
ricavata da **UN giro pulito di telemetria GPS FastF1**, ricampionata uniforme in distanza
(500 punti + levigatura circolare, deterministica: stesso input → stesso output, verificato
con hash su doppia generazione), orientata come la **mappa ufficiale F1** (rotazione
`circuit_info` MultiViewer, gradi registrati nel JSON) e normalizzata nel viewBox; `dist[i]` =
frazione di giro cumulata (0 = start/finish, senso di marcia).

La UI (`demo/pista.mjs` + `demo/gara.html`) muove i pallini come **replay posizionale dei
tempi-giro reali**: al tempo T (interpolato sui cum_time del leader) ogni pilota è nel suo giro
k con frazione (T − fine giro k−1)/(durata giro k), tradotta in un punto del nastro. NON è una
simulazione; **dentro il giro** la posizione è interpolata assumendo velocità uniforme
(frazione di tempo ≈ frazione di distanza) — approssimazione dichiarata anche in pagina.
Pit-lane non modellata: durante l'in-lap il pallino resta sul nastro. **Legge del replay**:
esplorazione pit attiva → pallini spenti (`setSpento`), riaccesi alla chiusura.

## Criterio del giro (dichiarato nel generatore)
Tra i giri di gara con LapTime valido (preferendo `IsAccurate`), in ordine di tempo crescente,
il primo che passa i controlli: ≥100 campioni GPS, nessun buco >1,5 s, anello chiuso ≤60 m,
lunghezza 3–8 km. A Silverstone converge sullo **stesso giro del vecchio prototipo OpenF1**
(ANT, giro 37, 91.777 s): metodo confermato da due fonti indipendenti.

## Limiti
- Gara senza telemetria GPS utilizzabile → nessun file, il placeholder resta ("pista in
  arrivo"): **mai piste disegnate a mano**. Oggi: 9/9 generate (anche Monaco 2026 — il buco
  dati OpenF1 non affligge il giro scelto via FastF1).
- La geometria è la **linea percorsa** in quel giro (non la centerline): lunghezze ~1% corte.
- Il vecchio prototipo (`telemetria_proto.html` + JSON orfano da 2,1 MB) è archiviato via ATT7
  in `data/archivio/` (vedi il README lì).

## Rigenerare
- Tutte le gare: `python3 gen_pista_svg.py`
- Flusso post-gara — dopo `aggiorna` di una gara nuova: `python3 gen_pista_svg.py --gara <nome>`
  (es. Spa: `python3 gen_pista_svg.py --gara Belgio` una volta nel registro). Primo run di una
  gara: scarica i position-data (~20–60 s con rete buona; la cache li conserva).
