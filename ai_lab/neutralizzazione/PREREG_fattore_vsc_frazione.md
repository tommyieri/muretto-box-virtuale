# PREREG — il fattore VSC pesato per frazione (prima di misurare)

*07/08/2026, notte. Primo consumo della fonte a tempo validata da V2. Oggi il prezzo di
una sosta sotto VSC è BINARIO: fattore 0,65 (prior esterno, banda [0,60–0,70]) se il
giro della sosta è marcato VSC, 1 altrimenti. Ma la copertura è una frazione — e il
censimento di potenza (fatto prima di questa prereg, senza guardare esiti) dice che le
soste a copertura piena sono SEI su 88 in finestra: i muretti si tuffano appena la VSC
esce, quindi l'in-lap parte verde quasi per costruzione. Validare il fattore pieno è
NON GIUDICABILE per numeri; la domanda giusta è un'altra.*

## Il modello, a zero parametri liberi

    fattore_pesato(f) = 1 − (1 − 0,65) · f

con f = media della frazione VSC su in-lap e out-lap della sosta (dalla fonte a tempo).
L'àncora 0,65 è il prior di sempre, NON ri-stimato. Il concorrente è il comportamento
attuale del laboratorio: **binario** — 0,65 se l'in-lap è in finestra VSC, 1 altrimenti.

## La misura

- Perimetro: le soste 2026 con finestra VSC toccata (f > 0), senza contaminazione SC
  (f_sc = 0 su in e out), con in-lap e out-lap misurabili (guardia E13).
- Perdita realizzata = (tempo in-lap + tempo out-lap) − 2 · mediana verde dell'auto
  nella gara (la convenzione del prior). Riferimento verde di gara = mediana della
  perdita realizzata delle soste in verde pieno (f = 0, niente SC) della stessa gara.
- ratio osservato = perdita realizzata / riferimento verde di gara.

## Il cancello V3 (decide, scritto prima)

Sui casi in finestra, appaiato caso per caso:
**PASSA** se |ratio_oss − fattore_pesato(f)| ha (a) mediana MINORE di
|ratio_oss − binario| e (b) più vittorie che sconfitte nel conteggio appaiato.

Sanità non vincolante: mediane osservate monotone nei bin di copertura; il bin pieno
(n = 6) si riporta e non decide.

## Applicazione, se V3 passa

Ingresso di laboratorio `frazioniNeutralizzazione` ({drv: {giro: {f_vsc, f_sc}}}) nel
costruttore — famiglia s25 — che pesa il PREZZO delle soste (non la compressione);
sentinella s46 (spento è spento; f=1 ⇒ prior; f=0 ⇒ verde; malformato esplode);
cancello d'applicazione: il record dei 10 casi non peggiora (somma |err| ≤ 8).
Produzione intoccata: al congelamento la frazione futura non si conosce (E14).
Se V3 fallisce: il binario resta, a referto.
