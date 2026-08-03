# REPORT_VALIDAZIONE_COMPONENTI — validazione del modello a due componenti (Sessione H)

H1 vincolo fisico dopo correzione bias: **FALLISCE** — circuiti ben campionati negativi: Spagna
H1 sensibilita' al degrado (0,03/0,044/0,06): **ROBUSTO** (verdetto invariato al variare del coefficiente)
H2 predizione SC: errore max = 5.69 s -> **SBAGLIATO**
H2 componenti vs ratio 0,42: **MEGLIO**

## H1 — Vincolo fisico 0 <= pit_loss <= pit_lane_time, e correzione del bias del metodo C

Bias del metodo C (noto, unidirezionale, gonfia il pit-loss verde): degrado dell'in-lap
(gomma vecchia) + warm-in dell'out-lap. degrado = (eta_inlap - eta_mediana_pilota)x0,044
(degrado AGGREGATO committato, usato SOLO come correzione di bias su una media, MAI per-stint
il filone degrado resta chiuso). warm-in da warmin_prior.csv (compound, giro_stint 0).

| circuito | n | pit_lane_time | pit_loss verde GREZZO | bias mediano | pit_loss CORRETTO | track_time | >=0? |
|---|---|---|---|---|---|---|---|
| Austria ⭐ | 33 | 21.6 | 21.9 | +0.46 | 21.4 | +0.2 | SI |
| Gran Bretagna ⭐ | 23 | 29.6 | 20.9 | +0.44 | 20.5 | +9.1 | SI |
| Miami ⭐ | 19 | 23.1 | 19.5 | +0.75 | 18.8 | +4.4 | SI |
| Monaco ⭐ | 19 | 23.8 | 22.0 | -0.14 | 22.1 | +1.7 | SI |
| Spagna ⭐ | 40 | 22.7 | 24.4 | +0.13 | 24.2 | -1.5 | NO |
| Australia (escluso, n=9) | 9 | 18.9 | 25.2 | +0.80 | 24.4 | -5.4 | NO |
| Canada | 16 | 25.4 | 27.3 | +0.48 | 26.9 | -1.4 | NO |
| Cina (escluso, n=6) | 6 | 23.4 | 32.6 | +1.00 | 31.6 | -8.2 | NO |
| Giappone | 14 | 24.3 | 23.9 | +0.28 | 23.7 | +0.6 | SI |

⭐ = ben campionato (n>=15), il test H1 riguarda SOLO questi. Cina (n=6) e Australia (n=9)
sono ESCLUSI dal test e resteranno NON CORRETTI nella proposta.

Sensibilita' al coefficiente di degrado (track_time dei ben campionati):
| circuito | coeff 0.03 | coeff 0.044 | coeff 0.06 |
|---|---|---|---|
| Gran Bretagna | +9.0 | +9.1 | +9.2 |
| Miami | +4.1 | +4.4 | +4.5 |
| Monaco | +1.6 | +1.7 | +2.0 |
| Spagna | -1.7 | -1.5 | -1.4 |
| Austria | +0.0 | +0.2 | +0.3 |

Verdetto H1 identico a 0,03/0,044/0,06: SI -> ROBUSTO.

**H1 FALLISCE: track_time negativo su Spagna (ben campionati) anche dopo la
correzione del bias.** Il modello a due componenti NON regge sui dati. STOP: nessuna
correzione, nessuna proposta. Il filone si chiude con il debito documentato e la sua causa
(G: il campo f1db e' la durata), ma la ricalibrazione a componenti non e' validata.

## H2 — R_lap dai lap times (fonte indipendente) e predizione dell'SC

| circuito | giro verde | giro SC | R_lap_SC | n giri SC | giro VSC | R_lap_VSC |
|---|---|---|---|---|---|---|
| Australia | 84.9 | — | — | 0 | 110.9 | 1.31 |
| Austria | 72.9 | — | — | 0 | 83.5 | 1.15 |
| Canada | 77.1 | — | — | 0 | 80.9 | 1.05 |
| Cina | 98.1 | 142.5 | 1.45 | 24 | — | — |
| Giappone | 95.3 | 146.9 | 1.54 | 79 | — | — |
| Gran Bretagna | 95.5 | 106.5 | 1.12 | 49 | 110.9 | 1.16 |
| Miami | 94.3 | 140.0 | 1.48 | 87 | — | — |
| Monaco | 78.8 | 87.3 | 1.11 | 86 | — | — |
| Spagna | 83.7 | — | — | 0 | 97.0 | 1.16 |

### H2b — Test di predizione (il cuore): pit_loss_SC = pit_lane_time - track_time_verde x R_lap_SC

| circuito | predetto (componenti) | predetto (ratio 0,42) | osservato (G) | err componenti | err ratio |
|---|---|---|---|---|---|
| Gran Bretagna | 19.4 | 8.6 | 14.7 (n=11) | 4.75 | 6.07 |
| Giappone | 23.3 | 9.9 | 17.6 (n=11) | 5.69 | 7.68 |

**SOLO 2 CIRCUITI TESTABILI (Gran Bretagna, Giappone): un PASSA e' un INDIZIO
FORTE, non una dimostrazione.** Non si arrotonda verso l'alto.
Verdetto H2: errore max componenti 5.69 s -> **SBAGLIATO**. Componenti vs ratio costante: il modello a componenti BATTE il ratio.

## Esito

**Nessuna proposta: H1 fallisce (track_time negativo); H2 SBAGLIATO.** Il filone si chiude. Il debito resta scritto
con la sua causa fisica (G): il file f1db e' la durata dello stop, non il pit-loss. La
ricalibrazione a due componenti non e' validata dai dati disponibili.

Nessun verdetto strategico: e' del PO. Nessun file di produzione toccato.
