# REPORT_PITLOSS_GAP — terzo metodo ortogonale (pilota-cronometro)

Controllo a vuoto: 1.62 s -> **GIUDICE NON VALIDO** (soglia mediana |valore| <= 0,5 s su coppie SENZA pit; n=6978)
GB / Miami / Monaco: **verdetto NON EMESSO** — il giudice ha fallito il proprio test di
validita' (E2), quindi i confronti E3 sotto sono INDICATIVI, non certificabili.

**STOP (E2 pre-registrato).** Il controllo a vuoto e' 1.62 s, non ~0: applicato
a due piloti che NON pittano, il metodo gap restituisce gia' ~1,6 s solo per la DISPERSIONE
DI PASSO fra piloti (~0,8 s/giro reale x 2 giri). Questo rumore proprio sta alla stessa scala
della soglia di conferma (1,5 s): il gap NON puo' giudicare a quella precisione. NON si
ritocca il metodo per farlo passare (sarebbe tuning post-hoc). Conseguenza: NON abbiamo una
conferma ortogonale. Restiamo con UN solo metodo (C/D, che sono lo stesso). La sostituzione
NON e' giustificata da evidenza indipendente. I numeri E3 concordano (vedi sotto) -- indizio,
non prova.
IQR mediano fra riferimenti = 3.64 s > 2 s: conferma che il metodo gap e' troppo rumoroso.

## E1/E2 — Metodo e validazione del giudice

- Dispersione fra riferimenti (IQR mediano per stop): 3.64 s (<=2 s richiesto: FALLITO).
- Controllo a vuoto (stessa formula su coppie senza pit): mediana |valore| = 1.62 s (NON ~0, giudice corrotto).
- Stop con < 4 riferimenti validi, scartati: 1.

## E3 — Confronto dei tre metodi (gap = giudice; C/D = imputato)

| circuito | n stop | pit_loss_gap (IQR) | calibrato D | reale C | nominale f1db | |gap−D| | verdetto |
|---|---|---|---|---|---|---|---|
| Gran Bretagna ⭐ | 18 | 20.93 [19.7,27.4] | 19.71 | 20.90 | 29.12 | 1.22 | confermato (indic.) |
| Miami ⭐ | 19 | 20.85 [17.4,22.4] | 19.65 | 19.51 | 22.63 | 1.20 | confermato (indic.) |
| Monaco ⭐ | 19 | 22.08 [18.2,22.9] | 22.02 | 22.00 | 24.8 | 0.06 | confermato (indic.) |
| Australia | 8 | 26.05 [19.1,33.5] | 25.05 | 25.17 | 18.15 | 1.00 | confermato (indic.) |
| Austria | 33 | 21.87 [19.5,23.0] | 20.91 | 21.87 | 21.63 | 0.96 | confermato (indic.) |
| Canada | 16 | 27.66 [25.2,30.0] | 24.99 | 27.33 | 24.37 | 2.67 | ambiguo (indic.) |
| Cina | 6 | 34.87 [28.4,40.7] | 34.27 | 32.62 | 22.97 | 0.60 | confermato (indic.) |
| Giappone | 14 | 24.47 [22.3,41.2] | 23.48 | 23.32 | 23.72 | 0.99 | confermato (indic.) |
| Spagna | 40 | 24.13 [21.6,25.6] | 21.60 | 24.37 | 22.38 | 2.53 | ambiguo (indic.) |

⭐ = lato robusto (i tre che la Sessione D proponeva di sostituire).

**Verdetti NON emessi: il giudice ha fallito E2.** I |gap−D| sono mostrati come INDIZIO:
sui tre robusti sono piccoli (GB 1,2; Miami 1,2; Monaco 0,06 s), il che e' coerente col fatto
che il gap-per-circuito medi via parte del rumore di passo -- ma NON e' una conferma valida,
perche' il rumore proprio del giudice (1,6 s) e' dell'ordine di quelle differenze. Non si
dichiara CONFERMATO nessun circuito. La sostituzione resta priva di conferma indipendente.

## E4 — La misura mancante della Sessione D (MAE sui SOLI 3 robusti)

- MAE residuo pit k=1 sul TEST dei soli GB/Miami/Monaco: nominale 5.682 -> calibrato 2.839 s, riduzione **50%** (IC95 bootstrap [16%, 70%]).
  E' la metrica giusta per una decisione che riguarda solo 3 circuiti (l'aggregato su 9 della
  Sessione D, 22%, era diluito dai circuiti dove la calibrazione peggiora).
- Termometro del rumore: applicando una correzione quasi nulla a circuiti ben campionati,
    Austria (correzione ~-0.72s): MAE 1.04 -> 1.37 (PEGGIORA di +0.32s).
    Spagna (correzione ~-0.78s): MAE 1.83 -> 2.32 (PEGGIORA di +0.49s).
  Se una correzione ~0 peggiora n=33/n=40, la mediana-su-FIT porta rumore: cautela anche sui
  tre grandi (ma li' la correzione ~-3..-9s domina il rumore).

## E5 — Cross-check esterno f1db (durata stop)

NON eseguibile con i dati in repo: `pit_loss_circuito_f1db.csv` contiene solo il pit_loss
aggregato per circuito (pit_loss_s, n), NON il campo durata-stop per-stop (lap+duration). Il
cross-check semantico durata-pit-lane vs pit-loss-totale richiede la fonte f1db per-stop, non
presente. Dichiarato non eseguibile, non bloccante.

Nessun verdetto strategico (sostituire i file, rigenerare i golden): e' del PO.
