# REPORT — Sessione FF2: pit-loss di Silverstone 2018–2026, dry/wet

Pre-registrazione: **`PREREG_SESSIONE_FF2.md`**, committata @ `a144918` **prima di scaricare un
solo dato 2018–2022**. Generatore committato: **`gen_pitloss_fastf1_esteso.py`**. Dati:
**`data/fastf1_silverstone_stops_esteso.csv`** (142 stop), **`data/pitloss_silverstone_dry_wet.csv`**.
Ambito: **solo Silverstone**.

```
F2.0 classificazione: DRY [2018, 2019, 2020-BGP, 2020-70th, 2021, 2022, 2023, 2026]
                    | WET [2024] | MISTE [2025]
F2.2 stazionarietà: pit_lane_time per gara 28,41–29,53 s; escluse: [2021 (bandiera rossa,
                    dev. 8,64 s — non un cambio layout, vedi sotto)]
F2.4 pit_loss_dry = 20.80 s, IC95 [20.05 – 22.16], larghezza 2.11 s, n blocchi = 7 (102 stop)
F2.4 pit_loss_wet = 21.83 s (1 blocco, 40 stop — archiviato, non in produzione)
F2.5 VERDETTO: GO
```

**Il GO NON corregge nulla** (pre-registrato): autorizza una **sessione di attivazione dedicata**
con checkpoint PO e rigenerazione golden. **Silverstone resta 29,12 finché il PO non decide.**
Nessun file di produzione toccato; golden verdi prima e dopo (`test_b.mjs` 449/449,
`test_degrado_hook.mjs` PASS). Nessun verdetto strategico: è del PO.

---

## In una riga

Con 9 gare scaricate (2020 ne ha due), 8 classificate DRY a monte, 7 blocchi dry sopravvissuti ai
veti, il pit-loss asciutto di Silverstone è **20,80 s con IC95 [20,05 – 22,16]** — larghezza
**2,11 s ≤ 3,0** — e **tutti i vincoli fisici passano** (0/102 violazioni, `track_time` 7,95 s
contro ~8 attesi). Il GO è **robusto sotto ogni lettura alternativa** calcolata (vedi sensibilità).

---

## F2.1 — Scarico: 10 gare su 10 disponibili

Tutte le stagioni 2018–2026 sono in FastF1, identificate per **località** (non per nome evento):

| gara | evento | round | giri-pilota |
|---|---|---:|---:|
| 2018-BGP … 2026-BGP | British GP | vari | 815–1113 |
| **2020-BGP** | British GP | 4 | 897 |
| **2020-70th** | **70th Anniversary GP** | 5 | 1025 |

Il 2020 ha **DUE gare** a Silverstone → **due blocchi distinti**, come pre-registrato. Cache
locale gitignorata (57 MB, artefatto di download). Nessuna stagione assente.

## F2.0 — Classificazione DRY/WET: congelata prima dei pit-loss, e ha morso

Criteri incisi nel prereg: **A** = ≥20% giri-pilota su INTERMEDIATE/WET; **B** = ≥20% campioni
meteo con `Rainfall=True`; DRY/WET solo se **concordano**, altrimenti MISTA. Meteo disponibile
per **tutte e 10** le gare.

| gara | % giri inter/wet | % campioni pioggia | condizione |
|---|---:|---:|---|
| 2018, 2019, 2020-BGP, 2020-70th, 2021, 2023, 2026 | 0% | 0% | **DRY** |
| 2022 | 0% | 4% | **DRY** |
| 2024 | 24% | 35% | **WET** |
| **2025** | **74%** | **18%** | **MISTA** |

**Il caso 2025 è la dimostrazione che il criterio andava congelato a monte.** I due criteri
**discordano** (74% di giri su gomma da bagnato, ma pioggia su solo il 18% dei campioni: pioggia
breve, pista bagnata a lungo). Per la regola pre-registrata è **MISTA ⇒ esclusa da entrambi i
panieri**. Nessuna discrezione esercitata — e infatti il 2025 sarebbe poi risultato comunque non
misurabile in F2.3 (sotto): **due regole indipendenti, stessa conclusione**.

## Riconciliazione aritmetica (obbligatoria): torna esatta

**375 stop grezzi = 142 validi + 13 senza timestamp + 21 primo/ultimo giro + 137 non-verde +
41 stint corto + 0 settori NaN.** Verificato dal generatore, che **esce con errore** se non torna.
Nota fisica sui 21 "primo/ultimo": 17 sono del 2022, dove la bandiera rossa al giro 1 (incidente
Zhou) mandò quasi tutto il gruppo ai box al primo giro — il filtro li esclude correttamente.

## F2.2 — Stazionarietà: 9/10 dentro 0,82 s; il veto ha escluso il 2021, per la ragione giusta

| gara | n | mediana `pit_lane_time` | dev. vs altre | esito |
|---|---:|---:|---:|---|
| 2018-BGP | 27 | 28,44 | 0,79 | ok |
| 2019-BGP | 27 | 28,64 | 0,59 | ok |
| 2020-BGP | 21 | 29,52 | 0,64 | ok |
| 2020-70th | 41 | 28,41 | 0,82 | ok |
| **2021-BGP** | 41 | **37,52** | **8,64** | **ESCLUSA** |
| 2022-BGP | 30 | 29,23 | 0,34 | ok |
| 2023-BGP | 24 | 28,76 | 0,47 | ok |
| 2024-BGP | 45 | 29,38 | 0,49 | ok |
| 2025-BGP | 35 | 28,88 | 0,34 | ok |
| 2026-BGP | 50 | 29,53 | 0,64 | ok |

Nove gare su dieci stanno in **28,41–29,53 s** su **nove stagioni**: il pit-lane time di
Silverstone è una costante fisica del layout, e il **29,18 della Sessione FF si estende
all'indietro fino al 2018**.

**Perché il 2021 devia — verificato, non ipotizzato**: `TrackStatus` dei primi giri = SC poi
**bandiera rossa** (incidente Verstappen/Hamilton al giro 1); sei auto risultano con
`pit_lane_time` **~2075 s** — sono rimaste **ferme ai box durante la sospensione**, e il
timestamp le conta. Non è un cambio di layout: è un artefatto da bandiera rossa che gonfia la
mediana di gara. Il veto pre-registrato non distingue le cause — **esclude e basta**, e così è
stato fatto (1 esclusa ≤ 3: il pooling resta legittimo). Costo: un blocco dry in meno.
**Ripescarlo filtrando gli stop da bandiera rossa sarebbe stata una leva non pre-registrata: non
fatto.** Restano comunque 7 blocchi ≥ 5.

## F2.3 — Settori affetti, rideterminati gara per gara: S1-out regge su nove stagioni

| gara | n | in-S1 | in-S2 | in-S3 | **out-S1** | out-S2 | out-S3 | insieme affetto |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 2018-BGP | 10 | 0,28 | −0,10 | −0,52 | **19,96** | −0,15 | −0,11 | S1-out |
| 2019-BGP | 15 | 0,00 | −0,17 | −0,45 | **20,58** | 0,30 | 0,03 | S1-out |
| 2020-BGP | 2 | −0,18 | 0,34 | −0,23 | **26,71** | **1,11** | 0,22 | S1-out, **S2-out** |
| 2020-70th | 36 | −0,03 | −0,16 | −0,67 | **20,05** | 0,03 | −0,10 | S1-out |
| 2022-BGP | 15 | −0,02 | −0,10 | −0,52 | **22,16** | 0,84 | 0,20 | S1-out |
| 2023-BGP | 7 | 0,12 | −0,17 | −0,64 | **20,84** | 0,10 | −0,07 | S1-out |
| 2024-BGP | 40 | 0,12 | 0,31 | **−1,61** | **23,20** | 0,50 | 0,08 | **S3-in**, S1-out |
| **2025-BGP** | 1 | −0,35 | −1,25 | −2,43 | 24,88 | 7,08 | 3,17 | **5 settori ⇒ NON MISURABILE, ESCLUSA** |
| 2026-BGP | 17 | −0,06 | −0,02 | −0,66 | **20,80** | 0,23 | −0,01 | S1-out |

- **L'insieme modale è S1-out, identico dal 2018 al 2026**: la scoperta di FF (pit-entry prima
  della linea, in-lap che non perde nulla) non è una peculiarità di un'annata — è il layout.
- **Nessun cambio di layout rilevato**: le deviazioni dal modale sono due, entrambe spiegate
  dalla condizione e non dalla pista: **2020-BGP** aggiunge S2-out con un delta *marginale*
  (1,11, su **2 soli stop**); **2024** (WET) aggiunge S3-in negativo (−1,61): sull'acqua l'in-lap
  su gomma finita è *più lento* del riferimento — coerente con la fisica del bagnato, e tocca
  solo il paniere wet.
- **2025 ha 5 settori affetti su 6 ⇒ non misurabile col metodo per settori, esclusa** (regola
  pre-registrata). Gara di transizione asciutto/bagnato: il riferimento di stint non è
  stazionario. Era **già** fuori come MISTA da F2.0 — la doppia esclusione concorda.

## F2.4 — I due parametri

### `pit_loss_dry` — il parametro di produzione candidato

| | valore |
|---|---|
| **mediana (delle mediane di gara, mai pesata per stop)** | **20,80 s** |
| **IC95 bootstrap a blocchi (blocchi contati come blocchi)** | **[20,05 – 22,16]**, larghezza **2,11 s** |
| n blocchi / n stop | **7** / 102 |
| [solo confronto] IC95 POOLED (pesato per stop) | [20,08 – 21,47], larghezza 1,38 s |

Mediane di blocco: 2018 **19,96** · 2019 **20,58** · 2020-70th **20,05** · 2020-BGP **27,82** ·
2022 **22,16** · 2023 **20,84** · 2026 **20,80**.

**Sei blocchi su sette stanno in 1,1 s** (19,96–22,16 escluso l'outlier): la grandezza è
stazionaria su nove stagioni. Le due letture del bootstrap (2,11 vs 1,38) divergono meno che in
FF ma divergono: i blocchi restano sbilanciati (2020-70th pesa 36/102 = 35%). **Il verdetto è
sul NON pesato**, come inciso nel prereg.

**Il blocco anomalo, dichiarato**: 2020-BGP ha **2 soli stop** (ALB e GRO, entrambi stop *lenti*
reali: lane time 33,3/33,8 contro la mediana di gara 29,52) e mediana 27,82. Ha passato **tutti**
i filtri pre-registrati ⇒ **resta dentro**. Sensibilità (diagnostica, nessuna adottata):

| lettura | larghezza IC95 | verdetto implicato |
|---|---:|---|
| **pre-registrata (7 blocchi, insiemi per-gara)** | **2,11** | **GO** ← adottata |
| senza 2020-BGP (6 blocchi) | 1,50 | GO |
| 2020-BGP con solo S1-out | 2,11 | GO |
| POOLED | 1,38 | GO |

**Il GO non pende da nessuna di queste scelte**: ogni lettura calcolata sta sotto 3,0. Questa è
la differenza rispetto a FF, dove le letture cavalcavano la soglia (2,43 GO / 4,09 AMBIGUO) e si
dovette adottare il conservativo.

### `pit_loss_wet` — misurato, riportato, archiviato (decisione di dominio del PO)

| | valore |
|---|---|
| mediana | **21,83 s** |
| n blocchi / n stop | **1** (2024) / 40 |
| IC95 | **non stimabile** (1 blocco) |

**Nessuna soglia, nessun verdetto, non entra in produzione.** Con un solo blocco wet è un numero
descrittivo, non un parametro: sta in `data/pitloss_silverstone_dry_wet.csv` per il giorno in cui
i blocchi wet saranno più d'uno. Nota fisica: 21,83 > 20,80 è il verso atteso dalla decisione di
dominio (sul bagnato il `track_time` cresce → il pit-loss cresce), ma **1,0 s da un blocco solo
non prova niente** e non viene usato per niente.

## F2.5 — Verdetto: **GO**

| controllo | soglia | osservato | esito |
|---|---|---|---|
| blocchi dry | ≥ 5 | **7** | passa |
| `pit_loss < 0` | 0 stop | **0**/102 | passa |
| `pit_loss > pit_lane_time` | 0 stop | **0**/102 | passa |
| `track_time > 0`, ~8 s | — | **7,95 s** (28,75 − 20,80) | passa |
| **larghezza IC95** | **≤ 3,0 s** | **2,11 s** | **GO** |

Percorso dell'incertezza attraverso l'arco: produzione ~6,8 s (C→I) → **4,09 s** (FF, 4 blocchi)
→ **2,11 s** (FF2, 7 blocchi). La previsione di FF (4,09·√(4/9) ≈ 2,7) è stata persino battuta,
perché il paniere dry pre-registrato ha tolto la varianza bagnata invece di diluirla.

### Cosa autorizza il GO — e cosa NO (pre-registrato)

Il GO **autorizza soltanto** una **sessione di attivazione dedicata**, con checkpoint PO,
sostituzione del valore Silverstone nel file di produzione e **rigenerazione golden**. In questa
sessione **nulla è stato corretto**: `pit_loss_circuito_f1db.csv` è intatto (29,12), il ratio SC
0,42 è intatto, i golden sono verdi e invariati.

Il valore candidato per l'attivazione è **20,80 s** (IC95 [20,05 – 22,16]). Correzione implicata
a Silverstone: **−8,32 s per stop** rispetto al 29,12 in produzione. Guadagno/incertezza:
8,32 / (2,11/2) ≈ **7,9×**.

**Il debito P1 pit-loss ha, per la prima volta dall'apertura, una misura che passa le sue stesse
soglie.** La decisione di attivare è del PO.

## F2.6 — Nota semantica aggiornata (guadagno incassato, indipendente dal verdetto)

`data/pit_loss_circuito_f1db.NOTA.md` ora dice: il campo è il **pit-lane time**, confermato da
**TRE fonti indipendenti** — f1db **29,12** / Jolpica **29,6** / FastF1 timing diretto **29,18**
(scarto 0,06 s). **Non è più un'ipotesi: è chiuso.** (E questa sessione lo estende: la costanza
28,41–29,53 su nove stagioni è un quarto puntello.)

## Leve vietate: stato

Nessuna esercitata. In particolare: il 2025 **non** è stato riclassificato dopo aver visto che il
suo (unico) pit-loss era 24,88; il 2021 **non** è stato ripescato filtrando la bandiera rossa
(sarebbe un blocco in più, ma la regola non lo prevedeva); il POOLED (1,38 s) è riportato e
**non** adottato; la soglia di affezione è rimasta 1,0 s; nessuna FP/qualifica nel campione.

## Indice
- `PREREG_SESSIONE_FF2.md` — pre-registrazione, committata **prima dei dati** (`a144918`)
- `gen_pitloss_fastf1_esteso.py` — generatore committato
- `data/fastf1_silverstone_stops_esteso.csv` — 142 stop, con gara e condizione
- `data/pitloss_silverstone_dry_wet.csv` — i due parametri
- `data/pit_loss_circuito_f1db.NOTA.md` — aggiornata (F2.6)
- Sessione FF (branch `fastf1-pitloss`, non mergiato): metodo per settori, trappole FastF1,
  lezione del bootstrap
- `PITLOSS_NOTA_DI_CHIUSURA.md` — l'arco C→I, invariato
