# PREREG 2 — la ripartenza sul FONDO (scritta dopo l'esito NULL del 2026, prima di misurare qui)

*07/08/2026, notte. R0 sul 2026 è NON PASSA a referto: OR 2,078 nel verso
dell'ipotesi, ma IC95 [0,919; 3,410] con sole 115 occasioni di ripartenza — il 2026
ha poche ripartenze, non poca fisica. Questo NON è un terzo tentativo sulla stessa
fonte: è la stessa domanda sulla fonte CANONICA delle leggi di sorpasso (il fondo
2018-2025, gare asciutte — lo stesso perimetro delle 5.498 occasioni della soglia),
con una proprietà in più: il parametro esce dal fondo, i cancelli R1-R3 girano sul
2026 — fuori campione per costruzione.*

## Cosa resta identico alla prereg 1 (e non si ritocca)

Definizioni di finestra, ripartenza, occasione (gap ≤ 1,5 s, niente in/out-lap,
adiacenti a inizio giro), sorpasso, conversione Δ = ln(OR)/pendenza sigillata,
seme 20260807, bootstrap a blocchi-gara 2.000.

## Cosa cambia, dichiarato

- Perimetro: fondo 2018-2025, **gare asciutte** (`garaAsciutta`, lo stesso filtro
  della legge di soglia). Il 2026 NON entra nella stima del parametro.
- R0′: OR > 1 con IC95 che esclude 1. Se fallisce anche qui, il capitolo è NULL su
  entrambe le fonti e si chiude — niente terza misura.

## I cancelli di applicazione (immutati dalla prereg 1)

R1 (somma |err| riclassificato ≤ 8 sul record), R2 (calibrazione del movimento non
peggiora), R3 (placebo: finti giri di ripartenza, stesso numero per gara, seme
20260807 — non deve rendere quanto i giri veri). Il Δ usato in R1-R3 è quello del
FONDO, non del 2026.
