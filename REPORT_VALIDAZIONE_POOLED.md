# REPORT_VALIDAZIONE_POOLED — Sessione I (rimisura pulita, riferimento locale + pooling)

I0 circuiti con >=8 stop SC misurabili: 4/9 -> [ESEGUIBILE]
I1 vincolo fisico (rif. locale): [FALLISCE] — negativi non-fragili: Australia — fragili: Spagna
I2 predizione SC: err max = 44.39 s -> [SBAGLIATO] | vs ratio 0,42: [no]

Metodo/campione/soglie PRE-REGISTRATI in PREREG_SESSIONE_I.md (committato prima dei numeri).
Soglie invariate da H. Nessun file di produzione toccato; degrado mai predittore.

## I0 — Ingestione + pooling

pit_lane_time = mediana durata per-stop f1db (Jolpica), POOLED su 2023-2026 (<=60 s).
Stop e lap-times: ti_archive 2023-25 (TI grezzo, igiene validata) + 9 gare demo 2026.

| circuito | pit_lane_time | n durate | n verde (K5) | verde per stagione | n stop SC misur. |
|---|---|---|---|---|---|
| Australia | 18.15 | 164 | 42 | 2023:2 2024:31 2025:0 2026:9 | 7 |
| Austria | 21.63 | 180 | 135 | 2023:29 2024:42 2025:31 2026:33 | 1 |
| Canada | 24.03 | 189 | 79 | 2023:20 2024:20 2025:29 2026:10 | 19 |
| Cina | 22.97 | 83 | 52 | 2024:22 2025:24 2026:6 | 5 |
| Giappone | 23.70 | 128 | 93 | 2023:28 2024:34 2025:21 2026:10 | 13 |
| Gran Bretagna | 29.19 | 154 | 102 | 2023:10 2024:44 2025:27 2026:21 | 14 |
| Miami | 22.62 | 88 | 50 | 2023:18 2024:12 2025:1 2026:19 | 5 |
| Monaco | 24.40 | 145 | 86 | 2023:30 2024:7 2025:34 2026:15 | 6 |
| Spagna | 22.38 | 186 | 164 | 2023:42 2024:42 2025:40 2026:40 | 10 |

Circuiti con >=8 stop SC misurabili (pre-reg): **4/9** (Canada, Giappone, Gran Bretagna, Spagna). Soglia 4 -> **ESEGUIBILE**.

## I1 — Pit-loss verde, riferimento LOCALE (ultimi 5 giri verdi dello stesso stint)

`pit_loss_verde = (in+out) - 2*rif_locale - fuel`; rif_locale gia' a gomma vecchia come
l'in-lap -> il bias di degrado del metodo C e' ASSORBITO per costruzione (nessuna correzione
di degrado; filone degrado chiuso). track_time = pit_lane_time - pit_loss_verde.

| circuito | n | pit_lane | verde K5 | track K5 | track K3 | track K7 | fragile? | >=0? |
|---|---|---|---|---|---|---|---|---|
| Australia ⭐ | 42 | 18.2 | 20.7 | -2.6 | -2.2 | -2.6 | no | NO |
| Austria ⭐ | 135 | 21.6 | 20.7 | +1.0 | +1.2 | +0.8 | no | SI |
| Canada ⭐ | 79 | 24.0 | 20.9 | +3.1 | +3.6 | +3.3 | no | SI |
| Cina ⭐ | 52 | 23.0 | 22.2 | +0.7 | +0.8 | +0.6 | no | SI |
| Giappone ⭐ | 93 | 23.7 | 21.7 | +2.0 | +2.4 | +1.9 | no | SI |
| Gran Bretagna ⭐ | 102 | 29.2 | 21.1 | +8.1 | +7.9 | +8.2 | no | SI |
| Miami ⭐ | 50 | 22.6 | 19.3 | +3.3 | +3.4 | +3.1 | no | SI |
| Monaco ⭐ | 86 | 24.4 | 21.1 | +3.3 | +2.9 | +3.4 | no | SI |
| Spagna ⭐ | 164 | 22.4 | 22.2 | +0.1 | +0.4 | -0.1 | SI | SI |

⭐ = ben campionato (n>=15): il test I1 riguarda SOLO questi e SOLO i non-fragili. Testati: Australia, Austria, Canada, Cina, Giappone, Gran Bretagna, Miami, Monaco.
FRAGILI (segno track_time flippa su finestra 3/5/7): Spagna — esclusi, resteranno NON corretti.

**I1 FALLISCE: track_time negativo su Australia (ben campionati, non-fragili).** STOP: nessuna proposta, filone chiuso.

## I2 — R_lap dai lap times (pooled) e predizione SC

R_lap = mediana( giro_neutralizzato / mediana_verde_di_gara ) su tutte le stagioni, giri
STRETTAMENTE dentro finestra (no deployment/restart), campo intero. Normalizzazione per
mediana-verde di gara: rimuove la deriva di passo assoluto fra stagioni.

| circuito | R_lap_SC | R_lap_VSC | pit_loss_SC oss [IC95 blocchi-gara] | n stop SC (blocchi) |
|---|---|---|---|---|
| Australia | 1.45 | 1.27 | -12.3 [IC non stimabile: 2 blocchi] | 7 (2) |
| Austria | 1.54 | 1.22 | -9.3 [IC non stimabile: 1 blocco] | 1 (1) |
| Canada | 1.32 | 1.05 | 15.7 [IC non stimabile: 1 blocco] | 19 (1) |
| Cina | 1.40 | 1.32 | 22.5 [IC non stimabile: 2 blocchi] | 5 (2) |
| Giappone | 1.55 | — | 17.6 [13.0,17.6] (2 blocchi) | 13 (2) |
| Gran Bretagna | 1.47 | 1.24 | 11.1 [-0.9,14.7] (3 blocchi) | 14 (3) |
| Miami | 1.44 | 1.30 | 2.4 [IC non stimabile: 2 blocchi] | 5 (2) |
| Monaco | 1.11 | 1.41 | 29.9 [IC non stimabile: 1 blocco] | 6 (1) |
| Spagna | 1.47 | 1.16 | -22.2 [IC non stimabile: 1 blocco] | 10 (1) |

**Nota di onesta' (blocchi):** il pooling NON ha prodotto blocchi-gara indipendenti. Gli
stop SC misurabili di ogni circuito vengono da 1-2 gare sole (eventi SC rari e concentrati):
l'IC a blocchi-gara e' quindi NON STIMABILE dove c'e' un solo blocco, e altrove larghissimo.
E' la stessa diagnosi di H ("osservato SC inutilizzabile come metro"), CONFERMATA con piu'
dati, non superata. Diversi osservati sono contaminati dal DEPLOYMENT (mass-stop sotto SC:
i pittanti prendono un in-lap veloce prima che il gruppo si compatti, la mediana-campo e'
gonfiata dai giri di schieramento) -> valori perfino NEGATIVI (Spagna -22: 1 gara, 1 evento).

### I2b — Predizione: pit_loss_SC = pit_lane_time - track_time_verde x R_lap_SC

| circuito | pred (componenti) | pred (ratio 0,42) | osservato [IC95 (blocchi)] | err comp | err ratio |
|---|---|---|---|---|---|
| Canada | 19.9 | 8.8 | 15.7 [IC non stimabile: 1 blocco] | 4.20 | 6.90 |
| Giappone | 20.5 | 9.1 | 17.6 [13.0,17.6] (2 blocchi) | 2.91 | 8.52 |
| Gran Bretagna | 17.3 | 8.9 | 11.1 [-0.9,14.7] (3 blocchi) | 6.21 | 2.23 |
| Spagna | 22.2 | 9.3 | -22.2 [IC non stimabile: 1 blocco] | 44.39 | 31.55 |

Verdetto I2: err max componenti 44.39 s -> **SBAGLIATO**. Componenti vs ratio 0,42: il ratio NON e' battuto -> il modello non serve.
Robustezza: anche ESCLUDENDO Spagna (osservato -22, artefatto deployment/1 blocco), err max = 6.21 s -> **SBAGLIATO** (GB 6.2s con IC osservato che attraversa lo zero). Il verdetto I2 non dipende dall'artefatto Spagna.

## Diagnostica data-quality (dichiarata) — la misura pooled non e' pulita come sperato

Il pooling multi-stagione, oltre a NON dare blocchi SC indipendenti, introduce contaminazioni
che la sola analisi 2026 di H non aveva. Le riporto e mostro che il NO NON dipende da esse:

- **Regimi pit-lane eterogenei fra stagioni** (durate mediane per stagione):
  - Australia: 2023=19.0  2024=18.0  2025=16.2  2026=18.9  (pooling mescola regimi diversi).
  - Canada: 2023=24.1  2024=24.8  2025=18.3  2026=25.4  (pooling mescola regimi diversi).
  - Monaco: 2023=25.8  2024=24.2  2025=24.3  2026=23.8  (pooling mescola regimi diversi).
- **Gare bagnate/bandiera-rossa nel verde storico**: es. Monaco 2023 dà un verde locale
  abnorme (~51 s, pioggia tardiva); la mediana pooled lo assorbe (Monaco resta +3,3) ma il
  dato di quella stagione e' sporco.
- **Australia (il fallimento di I1) e' ROBUSTO e NON un artefatto di pooling**: il track_time
  e' negativo in OGNI stagione asciutta con la SUA durata (2023 −1,5; 2024 −2,0; 2026 −4,1):
  a Melbourne `pit_loss_verde (~20-23) > pit_lane_time (~18)`, impossibile se entrambe le
  misure fossero coerenti (track_time non puo' essere < 0). Le due fonti (durata Jolpica vs
  pit-loss verde ricostruito) sono INCOERENTI su Melbourne, e il modello a due componenti non
  puo' rappresentarlo. Pulire le durate bagnate SPINGEREBBE Australia verso il PASS: non lo
  facciamo (sarebbe la leva anti-inganno vietata). Il NO regge sul dato asciutto.

## Esito

**Nessuna proposta: I1 fallisce (track_time negativo non-fragile); I2 SBAGLIATO; componenti non batte il ratio 0,42.** Il filone si chiude senza attenuazioni. Il debito
resta scritto con la sua causa fisica (G: il campo f1db e' la durata). Nessun verdetto
strategico: e' del PO. Nessun file di produzione toccato.
