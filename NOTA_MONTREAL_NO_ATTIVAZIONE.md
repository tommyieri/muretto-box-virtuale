# NOTA_MONTREAL — attivazione RESPINTA da ATT6 (Montreal resta 24,37)

Sessione di attivazione per Montreal (candidato censimento FF3: **18,96**, IC95 [18,45–19,12],
rapporto 16,3×). Branch `attivazione-montreal`, tag `pre-attivazione-montreal-2026-07-14`.
**Esito: ATT6 FALLITA (0/3 migliorati, 1 peggiorato) ⇒ nessuna attivazione.** Nessun file
toccato: ATT6 gira PRIMA delle modifiche, quindi il rollback è a costo zero —
`demo/data/pitloss.json` ("Canada": 24.37) e `data/pit_loss_circuito_f1db.csv`
(montreal,24.37,136) **sono rimasti intatti**.

## Verifiche preliminari (tutte passate — il fallimento non è qui)

- **Drive-through**: 53 trovati a Montreal 2018–2026 (quasi tutti transiti sotto SC di fine gara
  2025), **nessuno nel campione valido** del censimento. Il 18,96 è pulito.
- **Golden**: l'unico caso su Canada (`Canada:VER:fz41:pit43`) è **sotto neutralizzazione** e il
  rientro non cambia col nuovo valore (P5/8 identico, gap già null): la tabella pre-calcolata
  vecchio/nuovo/delta è **tutta zeri** — nessuna rigenerazione sarebbe servita. 11/11 verdi.
- **Denominatori ATT6**: verificato che il rango reale calcolato DENTRO l'insieme simulabile del
  motore coincide con quello su tutti (l'unica auto extra, PIA, è dietro): il fallimento **non è
  un artefatto di confronto**.

## ATT6 — la tabella (selezione dichiarata a priori*)

| caso | PRIMA (24,37) | ADESSO (18,96) | REALE | esito |
|---|---|---|---|---|
| BOT, pit giro 9 | P21/21 | P21/21 | P21/21 | INVARIATO (err 0→0) |
| STR, pit giro 14 | P19/19 | P19/19 | P19/20 | INVARIATO (err 0→0) |
| **NOR, pit giro 15** | **P14/18** | P11/18 | **P14/20** | **PEGGIORATO (err 0→3)** |

**Migliorati 0/3 ⇒ sotto la soglia 2/3 ⇒ rollback** (criterio del mandato, non negoziabile).
Script committato e rieseguibile: `att6_montreal.mjs`.

\* primi 3 stop verdi validi del Canada 2026 per (giro, pilota), un solo stop per pilota, con un
adattamento dichiarato rispetto a Silverstone: **pit ≥ giro 5** (i pit al giro 2 erano danni del
via e il freeze = pit−2 non esisterebbe).

## Perché fallisce — due cause verificate sul cronometro, non ipotizzate

1. **Il caso sensibile è uno stop LENTO.** BOT e STR rientrano ultimi del loro gruppo
   (insensibili a ±5 s, come STR a Silverstone). L'unico caso che discrimina è NOR — e il suo
   stop reale è durato **28,85 s di corsia contro la mediana di gara 23,8**: quel giorno NOR ha
   perso ~24 s per un pit lento di 5 s, non perché il parametro valga 24. Sfortuna del campione?
   In parte. Ma c'è di più:
2. **A Montreal il warm-in si spalma su TUTTO l'out-lap, e il parametro per settori non lo vede.**
   Gli out-lap reali dei tre casi perdono **+8,9 / +8,7 / +6,0 s sul giro intero** contro il
   verde mediano — distribuiti su S2 e S3, non solo su S1. Il metodo per settori somma **solo i
   settori sopra soglia** (a Montreal: in_S3 + out_S1): il warm-in residuo sotto-soglia resta
   fuori dal 18,96, ma dentro la realtà che ATT6 misura a fine out-lap. Non è un caso che il
   censimento avesse **escluso proprio Canada 2026 per ">2 settori affetti"**: la gara demo è
   una gara in cui il metodo per settori dichiara se stesso non applicabile.

## La lezione (vale più dell'attivazione mancata)

**Il `pit_loss_dry` per settori è un LIMITE INFERIORE del pit-loss rilevante per il motore**, non
sempre il valore da mettergli dentro. Il motore applica `pitLoss` come costo totale del pittare
(FF: "il warm-in resta dentro: chi rifà lo stop paga anche il warm-in") — quindi il parametro
giusto include TUTTO il warm-in. A **Silverstone** coincidevano (warm-in concentrato in S1-out,
che era il settore affetto: ATT6 passò 2/3 con due errori azzerati). A **Montreal** no: il
warm-in sotto-soglia sugli altri settori (~2–4 s) sta tra 18,96 e la realtà.

**Il GO del censimento era un permesso di istruttoria; ATT6 è il giudice — e ha detto no.**
Funziona esattamente come deve: senza ATT6, il 18,96 sarebbe andato in produzione e il motore
avrebbe sistematicamente sovrastimato i rientri (P11 predetto vs P14 reale).

## Conseguenze operative

- **Montreal resta 24,37** (che a fine out-lap, coi suoi ~4,8 s di guadagno geometrico eroso dal
  warm-in distribuito, è in pratica meno sbagliato di quanto il censimento suggerisse).
- **Austin e Spa: NON attivare senza ATT6.** Non hanno gara demo (nessuna chiave in
  `pitloss.json`, nessun caso golden): ATT6 non è eseguibile oggi. La lezione di Montreal dice
  che il trasferimento censimento→motore **non è automatico** — proprio ciò che ATT6 verifica.
  Restano GO di censimento, ma l'attivazione aspetta che quelle gare esistano in demo
  (Spa 2026 si corre il 19 luglio: la finestra si apre presto).
- **Candidato per una misura futura**: pit-loss "engine-ready" = delta sul GIRO INTERO
  (out-lap completo vs verde, non per settori) — cattura tutto il warm-in per costruzione. È un
  metodo diverso da FF2: va pre-registrato, non improvvisato qui.

Nessun verdetto strategico: è del PO.
