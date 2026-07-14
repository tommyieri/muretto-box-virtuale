# REPORT — Sessione FF3: censimento pit-loss dei circuiti 2026

Pre-registrazione: **`PREREG_SESSIONE_FF3.md`** @ `9f84b01`, committata **prima di scaricare un
solo dato di gara** (elenco circuiti, ordine di priorità, soglie e precedenza dei verdetti
inclusi). Generatore committato: **`gen_censimento_pitloss.py`**. Dati:
**`data/censimento_pitloss_2026.csv`** (tabella verdetti),
**`data/censimento_stops.csv`** (2.428 stop validi). **Nessuna correzione eseguita**: le attivazioni
sono sessioni dedicate, una per circuito, con checkpoint e ATT6.

```
GO: [montreal, austin, spa-francorchamps]  |  GIÀ CALIBRATI: 0  |  AMBIGUI: 0
NON ESEGUIBILI: 3 (miami, lusail, madrid)  |  NO: 0  |  METODO N/A: 0  |  DATI ROTTI: 15
```

**I tre GO (valore candidato, IC95, guadagno vs produzione, rapporto):**

| circuito | candidato | IC95 | larghezza | guadagno | rapporto | blocchi | stop | violazioni |
|---|---:|---|---:|---:|---:|---:|---:|---:|
| **spa-francorchamps** | **19,04** | [18,77 – 19,15] | 0,38 | **4,32** | **22,6×** | 6 | 134 | 0/134 |
| **austin** | **20,57** | [20,35 – 20,70] | 0,34 | **3,68** | **21,4×** | 7 | 175 | 0/175 |
| **montreal** | **18,96** | [18,45 – 19,12] | 0,66 | **5,41** | **16,3×** | 5 | 75 | 0/75 |

Golden verdi prima e dopo (`test_b` 449/449, `test_pit` 11/11 — questa sessione non tocca nulla
che li alimenti). Nessun verdetto strategico: è del PO.

---

## La tabella completa (ordinata per verdetto, poi per rapporto / track_time)

| circuito | lane misurato | produzione | pit_loss_dry | IC95 | largh. | blocchi | guadagno | rapporto | track_time | verdetto |
|---|---:|---:|---:|---|---:|---:|---:|---:|---:|---|
| spa-francorchamps | 23,15 | 23,36 | 19,04 | [18,77–19,15] | 0,38 | 6 | 4,32 | 22,6× | **4,11** | **GO** |
| austin | 24,21 | 24,25 | 20,57 | [20,35–20,70] | 0,34 | 7 | 3,68 | 21,4× | **3,64** | **GO** |
| montreal | 23,80 | 24,37 | 18,96 | [18,45–19,12] | 0,66 | 5 | 5,41 | 16,3× | **4,83** | **GO** |
| miami | 22,68 | 22,63 | 19,99 | — | — | **4** | — | — | 2,69 | NON ESEGUIBILE |
| lusail | 28,57 | 28,82 | 27,32 | — | — | **3** | — | — | 1,26 | NON ESEGUIBILE |
| madrid | — | assente | — | — | — | **0** | — | — | — | NON ESEGUIBILE |
| monaco | 24,28 | 24,80 | 20,17 | — | — | 4* | — | — | 4,11 | DATO ROTTO (3/90) |
| interlagos | 23,53 | 23,73 | 21,88 | — | — | 6 | — | — | 1,65 | DATO ROTTO (1/174) |
| hungaroring | 21,88 | 21,80 | 21,08 | — | — | 6 | — | — | 0,80 | DATO ROTTO |
| suzuka | 23,37 | 23,72 | 22,61 | — | — | 6 | — | — | 0,76 | DATO ROTTO |
| spielberg | 21,71 | 21,63 | 20,98 | — | — | 10 | — | — | 0,74 | DATO ROTTO (22/249) |
| marina-bay | 29,53 | 29,55 | 28,39 | — | — | 3 | — | — | 1,14 | DATO ROTTO |
| mexico-city | 22,64 | 22,69 | 22,55 | — | — | 7 | — | — | 0,09 | DATO ROTTO |
| las-vegas | 21,41 | 21,58 | 21,52 | — | — | 3 | — | — | −0,11 | DATO ROTTO |
| monza | 24,48 | 24,66 | 24,79 | — | — | 6 | — | — | **−0,31** | DATO ROTTO (68/97) |
| yas-marina | 21,93 | 22,01 | 22,40 | — | — | 8 | — | — | −0,47 | DATO ROTTO |
| catalunya | 22,33 | 22,38 | 22,98 | — | — | 8 | — | — | −0,65 | DATO ROTTO |
| baku | 20,58 | 20,72 | 21,50 | — | — | 7 | — | — | −0,92 | DATO ROTTO |
| shanghai | 23,00 | 22,97 | 24,31 | — | — | 5 | — | — | **−1,31** | DATO ROTTO (75/77) |
| zandvoort | 20,18 | 20,41 | 22,21 | — | — | 4 | — | — | −2,04 | DATO ROTTO |
| melbourne | 18,78 | 18,15 | 22,51 | — | — | 1 | — | — | **−3,72** | DATO ROTTO (7/7) |

\* Monaco ha 4 blocchi ma è DATO ROTTO prima del conteggio: la precedenza dei verdetti è quella
pre-registrata. `pit_loss_dry` per i non-GO è la mediana descrittiva, senza IC: nessun uso.

---

## Le due scoperte strutturali (valgono più dei singoli verdetti)

### 1. Il campo f1db è il pit-lane time OVUNQUE — la semantica è chiusa su scala globale

Su **20 circuiti misurati**, |produzione − lane misurato| ha **mediana 0,15 s, massimo 0,63 s**
(melbourne). Quello che G/FF avevano dimostrato per Silverstone (3 fonti) vale per l'intero file:
**`pit_loss_circuito_f1db.csv` contiene durate di transito, non pit-loss, riga per riga.** La
domanda semantica non ha più residui.

### 2. I circuiti si dividono in due famiglie, e il veto fisico distingue solo la prima

`track_time = lane − loss` misura il **guadagno geometrico** della pit lane al netto del warm-in
(che sta DENTRO la misura per costruzione, dichiarato fin da FF: "chi rifà lo stop paga anche il
warm-in").

- **Famiglia A — guadagno geometrico grande** (track_time ≳ 2,5 s): silverstone 7,95 ·
  montreal 4,83 · monaco 4,11 · spa 4,11 · austin 3,64 · miami 2,69. Qui la produzione
  **sovrastima il pit-loss di 3,7–8,3 s** e la correzione rende. I tre GO stanno tutti qui; gli
  altri tre della famiglia sono fermi solo da blocchi (miami) o violazioni da traffico (monaco).
- **Famiglia B — guadagno geometrico ≈ 0** (track_time da +1,6 a −3,7): tutti gli altri. Qui il
  warm-in eguaglia o supera il guadagno della corsia ⇒ la misura per settori (loss+warm-in)
  raggiunge o supera il lane time ⇒ **il veto per-stop `pit_loss ≤ pit_lane_time` scatta
  strutturalmente**, non per dati sporchi. Shanghai 75/77, monza 68/97, zandvoort 113/114:
  quando la violazione è la regola, non è l'outlier a essere rotto — **è il vincolo a non essere
  universale**. Era invisibile a Silverstone (8 s di margine); il censimento l'ha reso visibile.

**Conseguenza onesta, in due direzioni:**
1. I 15 DATO ROTTO **restano DATO ROTTO** (regola pre-registrata, nessuna eccezione a valle).
   Misurarli richiede un metodo che **separi il warm-in** dal transito — sessione futura, con
   prereg suo.
2. Ma per la famiglia B c'è una notizia buona non cercata: siccome lì `loss+warm-in ≈ lane time`,
   **il valore in produzione (lane time) è numericamente vicino al pit-loss effettivo** — l'errore
   pratico è ≲ 1–2 s, non gli 8 di Silverstone. Il debito grande stava (quasi) tutto nella
   famiglia A, e la famiglia A è quella che il metodo sa misurare.

---

## FF3.4 — Coerenza con l'arco C–I: TUTTE E TRE convergono, e Australia è spiegata

| circuito | stima C–I | misurato FF3 | scarto | esito |
|---|---:|---:|---:|---|
| miami | ~19,5 | 19,99 | 0,49 | **CONVERGE** |
| monaco | ~22,0 | 20,17 | 1,83 | **CONVERGE** (≤ 2 s, al limite) |
| spielberg (austria) | ~21,6 | 20,98 | 0,62 | **CONVERGE** |

Due metodi indipendenti (delta tempo-giro C–I vs settori FastF1) cadono negli stessi punti:
**conferma incrociata** dove l'arco aveva stime. Nessuna divergenza > 2 s.

**Australia — la verifica attesa, con l'esito dichiarato:** l'incoerenza C–I
(`pit_loss > pit_lane_time`) **NON si risolve** col taglio di layout: nel 2026 (unico blocco
utilizzabile) loss 22,51 > lane 18,78, violazioni **7/7** ⇒ per il criterio pre-registrato
**Australia resta DATO ROTTO**. Però ora l'incoerenza è **spiegata, non misteriosa**: Melbourne
ha la pit lane più corta e veloce del calendario (18,8 s) → guadagno geometrico minimo, e il
warm-in lo supera di ~3,7 s. **Le due fonti C–I erano entrambe giuste; era il vincolo
`pit_loss ≤ lane` a essere un modello sbagliato per quel circuito.** La domanda aperta dall'arco
C–I si chiude come spiegazione, anche se il circuito resta non misurabile con questo metodo.
Nota di trasparenza: la stazionarietà su Melbourne è distorta dalla gara 2023 (tre bandiere
rosse: mediana transiti **875 s** — auto ferme in corsia durante le sospensioni), che ha fatto
tagliare anche 2022/2024; il cambio layout reale è il **2022**, non il 2025 stampato in tabella.
Il verdetto non cambia: anche coi blocchi 2022–2026 il veto scatterebbe (loss > lane su tutti).

## NON ESEGUIBILI — debiti con una data

| circuito | blocchi dry | layout stabile dal | misurabile |
|---|---:|---|---|
| miami | 4 (manca 1) | 2023 (pit lane riconfigurata: lane 19,50 → 22,5) | **dopo il GP Miami 2027** |
| lusail | 3 (mancano 2) | 2023 (il 2021 devia: lane diversa) | **dopo il GP Qatar 2027** (2026 corre a novembre) |
| madrid | 0 (mancano 5) | circuito nuovo, prima gara 2026-09-13 | **dopo il GP 2030** |

## Note di metodo e di scarico (dichiarate)

- **Drive-through**: scoperto che hanno ENTRAMBI i timestamp (BOT Miami 2026: transito 17,0 s,
  Stint 3→4 ma TyreLife 9→10 sulla stessa mescola). L'esclusione era intento del prereg FF ma con
  meccanismo sbagliato; rilevatore corretto = **gomma che continua a invecchiare** attraverso il
  transito. **Verifica retroattiva: nessuno dei 10 drive-through di Silverstone 2018–2026 era nei
  102 stop di FF2 ⇒ il 20,80 attivato resta valido.**
- **Rate limit FastF1 (500 chiamate/h)**: il primo run si è fermato a 7 circuiti; completato con
  retry automatici dalla cache (3 run totali). Cache finale ~1,3 GB, gitignorata.
- **Monza 2018 non caricabile** (DataNotLoadedError persistente su 3 tentativi): blocco in meno,
  dichiarato. Monza ha comunque 6 blocchi.
- **Paniere WET**: esiste solo a zandvoort (22,7 s, 1 blocco) — archiviato in tabella, nessuna
  soglia, non in produzione. Le altre gare bagnate sono MISTA (criteri discordanti) o senza stop
  validi: la classificazione congelata a monte ha morso spesso, com'era previsto.
- **Riconciliazione scarti**: esatta su ogni circuito (il generatore esce con errore altrimenti).
- **4.876 stop grezzi** processati su **137 gare caricate** (9 stagioni, 21 circuiti);
  **2.428 stop validi** nel CSV dopo i filtri pre-registrati. Tutto rieseguibile dalla cache con
  `python3 gen_censimento_pitloss.py`.

## Cosa autorizza questa tabella — e cosa NO

I tre **GO** (spa 19,04 / austin 20,57 / montreal 18,96) **autorizzano tre sessioni di
attivazione dedicate**, una per circuito, ciascuna con: tag di rollback, ATT6 su pit reali (≥2/3
più vicini alla realtà pena rollback), golden calcolati prima e verificati dopo — il protocollo
di Silverstone. **Niente attivazione cumulativa**: tre valori = tre sessioni = tre ATT6.

Tutto il resto resta com'è: i 15 DATO ROTTO tengono i valori di produzione (che nella famiglia B
sono numericamente vicini al vero, vedi sopra), i NON ESEGUIBILI hanno una data. Il debito
pit-loss non è più un mistero da 24 circuiti: è **3 correzioni pronte, 3 attese con scadenza,
15 note fisiche precise**.

## Indice
- `PREREG_SESSIONE_FF3.md` — pre-registrazione (@ `9f84b01`, prima dei dati)
- `gen_censimento_pitloss.py` — generatore (@ `030756c`, col fix drive-through)
- `data/censimento_pitloss_2026.csv` · `data/censimento_stops.csv`
- `REPORT_PITLOSS_FF2.md` — il metodo; `NOTA_SILVERSTONE.md` — il protocollo di attivazione
