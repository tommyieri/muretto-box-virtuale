# PREREG — Sessione FF2: "fastf1-pitloss-esteso"

**Committato PRIMA di scaricare un solo dato nuovo.** Al momento di questo commit le uniche
stagioni presenti nella cache FastF1 (`data/ff1_cache/`, gitignorata) sono **2023–2026**,
scaricate nella Sessione FF sotto la sua pre-registrazione (`PREREG_SESSIONE_FF.md`, branch
`fastf1-pitloss`, non mergiato). **Le stagioni 2018–2022 NON sono state scaricate, aperte né
ispezionate** prima di questo commit. Nessun pit-loss 2018–2022 esiste ancora.

Branch: `fastf1-pitloss-esteso` (da `main` @ 13e1820).

Vincoli di sessione (dal mandato): NON si tocca kernel, modulo pit, gancio degrado, golden, né
alcun file di produzione (`data/pit_loss_circuito_f1db.csv`, `data/sc_safety_car.csv`,
`data/neutralization_model_2026.csv`). Nessun modello. **Nessuna correzione, nemmeno con GO.**
Nessun merge. **AMBITO: SOLO SILVERSTONE.** Unica eccezione documentale, autorizzata dal mandato:
l'aggiornamento della nota semantica `data/pit_loss_circuito_f1db.NOTA.md` (F2.6), che è
documentazione, non un valore di produzione.

---

## Perché questa sessione esiste

La Sessione FF ha chiuso con **AMBIGUO** (IC95 = 4,09 s, banda 3,0–6,0): il metodo per settori è
fisicamente sano (FF4: 0/65 violazioni, `track_time` 7,97 s vs 8–9 attesi), ma **4 blocchi-gara
(3 utilizzabili) non bastano**. Il report FF proponeva la via d'uscita: **più blocchi
(2018–2026)** e **asciutto pre-registrato**. Questa sessione è quella pre-registrazione.

Le due leve che in FF erano **vietate** perché sarebbero state decise a valle dei numeri —
escludere il bagnato, aggiungere stagioni — qui vengono **incise a monte**, prima di vedere un
solo pit-loss 2018–2022. È esattamente la differenza fra una scorciatoia e un metodo.

## Decisione di dominio del PO (già presa, NON è una scelta di questa sessione)

> Il pit-loss **ASCIUTTO** e quello **BAGNATO** sono **due parametri fisici distinti**, non due
> campioni dello stesso parametro: sul bagnato il `track_time` cresce (la pista è lenta), il
> `pit_lane_time` resta a 80 km/h — stessa struttura di verde vs SC. Il parametro di produzione
> è quello **ASCIUTTO**. Il bagnato **si misura, si riporta e si archivia** separatamente: NON si
> butta, ma non ha soglie e non entra in produzione.

Conseguenza pre-registrata: il verdetto F2.5 si emette **solo su `pit_loss_dry`**.
`pit_loss_wet` è un deliverable descrittivo, senza soglie e senza verdetto.

---

## Metodo per fase

### F2.0 — Classificazione DRY/WET (definita QUI, prima di guardare qualsiasi pit-loss)

La condizione di gara si determina con un criterio **oggettivo che non guarda i tempi di pit**,
e si **congela prima** di calcolare qualsiasi pit-loss:

- **Criterio A (mescole)**: una gara è *wet-per-mescole* se **≥ 20%** dei giri-pilota sono su
  `INTERMEDIATE` o `WET`.
- **Criterio B (meteo)**: una gara è *wet-per-meteo* se `session.weather_data` è disponibile e
  **≥ 20%** dei campioni meteo ha `Rainfall = True`.
- **DRY** = entrambi i criteri dicono asciutto (A sotto soglia **e** B sotto soglia).
- **WET** = entrambi dicono bagnato.
- **MISTA** = i criteri discordano ⇒ esclusa da **entrambi** i panieri e dichiarata.
- Se `weather_data` non è disponibile per una stagione: si classifica col solo criterio A e lo si
  **dichiara** (la gara non può essere MISTA per discordanza, ma la degradazione del criterio va
  scritta in tabella).

La classificazione di **ogni** stagione viene riportata **prima** dei pit-loss e **non si tocca
dopo**. Riclassificare una gara dopo aver visto il suo pit-loss è la leva vietata n.1.

### F2.1 — Scarico 2018–2026

Silverstone, sessione **gara (R)**, tutte le stagioni disponibili in FastF1 **2018–2026**.
Le gare si identificano dal calendario per **località Silverstone** (non per nome evento): nel
**2020** Silverstone ospitò **DUE gare** — *British GP* e *70th Anniversary GP*. Se entrambe sono
disponibili sono **DUE BLOCCHI DISTINTI** (stessa pista, gare diverse), e vanno dichiarate come
tali. Cache locale, **NON committata** (gitignorata). Si riporta quali stagioni sono disponibili
e quali no; le assenti si dichiarano assenti, non si sostituiscono.

**Unità di blocco: la GARA** (evento), non l'anno solare.

### F2.2 — Stazionarietà (VETO)

`pit_lane_time = PitOutTime − PitInTime`. **Attenzione (verificato in FF)**: i due campi stanno
su **righe diverse** — `PitInTime` sull'in-lap, `PitOutTime` sull'out-lap. Si accoppia l'in-lap
con l'out-lap **immediatamente successivo dello stesso pilota**. La sottrazione letterale sulla
stessa riga dà tutti NaN.

Si riporta il `pit_lane_time` **mediano per gara**.

- **VETO per-gara**: se una gara devia di **più di 2,0 s** dalla **mediana delle altre** ⇒
  **ESCLUSA dal pooling** (layout/pit lane cambiati) e dichiarata.
- **VETO globale**: se ne escono **più di 3** ⇒ **STOP, il pooling non è legittimo.**

### F2.3 — Pit-loss per settori (metodo di FF, invariato)

FF ha stabilito che a Silverstone è affetto **solo S1-out** (il pit-entry cade 5,79 s prima della
linea: l'auto taglia il traguardo dentro la pit lane; l'in-lap non perde nulla perché il taglio
di Vale/Club compensa gli 80 km/h). **NON lo si assume**: si **rideterminia per ogni gara** con
lo stesso metodo di FF2 — delta di ogni settore (in-lap e out-lap) contro la mediana dello stesso
settore nei giri verdi dello **stesso stint**; soglia di affezione **|delta mediano| ≥ 1,0 s**
(invariata da FF, non si sposta).

- Il pit-loss di ogni gara usa **l'insieme affetto di QUELLA gara**.
- Se in qualche gara l'insieme affetto **cambia** rispetto a quello modale ⇒ si dichiara: è un
  segnale di cambio layout/confini settore. Se una gara ha **> 2 settori affetti** ⇒ quella gara
  è **non misurabile col metodo per settori** e si esclude, dichiarandolo.
- `pit_loss` = somma dei delta sui **soli settori affetti** (insieme vuoto sull'in-lap ⇒
  contributo 0, come in FF). Riferimento out-lap: **giri 2–5 del nuovo stint** (mai il giro 1);
  il **warm-in resta dentro** la misura, per costruzione, come dichiarato in FF.
- **IsAccurate**: applicato **SOLO ai giri verdi di riferimento**, MAI agli in/out-lap (FastF1 li
  marca sempre `False` per definizione: il filtro letterale azzera il campione — verificato in FF).
- Esclusioni (invariate da FF): giri sotto SC/VSC/bandiera rossa (su in-lap o out-lap),
  primo/ultimo giro di gara, stint con **meno di 4 giri verdi** di riferimento, stop senza
  timestamp accoppiabile.
- **Riconciliazione aritmetica obbligatoria**: totale grezzo = usati + scarti, per categoria,
  deve tornare **esattamente**.

### F2.4 — I due parametri

- **`pit_loss_dry`**: solo gare **DRY** (F2.0) e non escluse da F2.2/F2.3. Mediana, IQR, **IC95
  bootstrap a blocchi CONTATI COME BLOCCHI**: si ricampionano le gare con reinserimento e si
  prende la **mediana delle mediane di gara** — **MAI pesata per numero di stop** (la lezione di
  FF: il pooled era stretto solo perché una gara pesava il 62%). 10.000 ricampionamenti, seed
  fissato nel generatore. n stop, n blocchi.
- **`pit_loss_wet`**: solo gare **WET**, stesse statistiche. **Riportato e archiviato**: nessuna
  soglia, nessun verdetto, non entra in produzione.
- Tabella per singola gara: condizione, mediana, n stop.

### F2.5 — Verdetto (soglie invariate, su `pit_loss_dry` SOLTANTO)

| condizione | verdetto |
|---|---|
| `n_blocchi_dry` **< 5** | **NON ESEGUIBILE** (non si abbassa a 4: FF ne aveva 4 ed era il problema) |
| IC95 ≤ 3,0 s | **GO** |
| 3,0 – 6,0 s | **AMBIGUO** |
| > 6,0 s | **NO definitivo** |

**VINCOLI CON VETO** (bocciano a prescindere dall'IC):
- `0 ≤ pit_loss ≤ pit_lane_time` su **ogni stop** del paniere dry;
- `track_time = pit_lane_time − pit_loss_dry > 0` e dell'ordine di **~8 s** (il vincolo duro è
  `> 0`; lo scostamento da ~8 si riporta e si commenta, non si usa per aggiustare).

**Confronto obbligatorio**: si riporta anche cosa darebbe il bootstrap **POOLED** (pesato per
stop). Se le due letture divergono molto ⇒ i blocchi sono sbilanciati e lo si dichiara. **Il
verdetto resta quello NON pesato**, qualunque cosa dica il pooled.

**Anche con GO non si corregge nulla**: il GO autorizza una sessione di attivazione dedicata,
con checkpoint PO e rigenerazione golden.

### F2.6 — Aggiornamento nota semantica (guadagno da incassare, indipendente dal verdetto)

`data/pit_loss_circuito_f1db.NOTA.md` viene aggiornata: il campo è il **pit-lane time**,
confermato da **TRE fonti indipendenti** — f1db **29,12** / Jolpica **29,6** (Sessione G) /
FastF1 timing diretto **29,18** (Sessione FF; scarto 0,06 s). Non è più un'ipotesi: è chiuso.
Questo si fa **qualunque sia il verdetto F2.5**.

---

## Criteri di fallimento (dichiarati PRIMA)

1. **F2.1**: se le stagioni 2018–2022 non sono scaricabili ⇒ si riporta l'errore esatto; se i
   blocchi dry totali restano < 5 ⇒ **NON ESEGUIBILE**, si chiude.
2. **F2.2**: > 3 gare fuori stazionarietà ⇒ **STOP**, pooling non legittimo.
3. **F2.3**: gara con > 2 settori affetti ⇒ esclusa e dichiarata; se ciò porta i blocchi dry
   sotto 5 ⇒ **NON ESEGUIBILE**.
4. **F2.5 veto fisico**: una sola violazione `pit_loss < 0` o `pit_loss > pit_lane_time` nel
   paniere dry, o `track_time ≤ 0` ⇒ **bocciato a prescindere dall'IC**. Non si ripulisce il
   campione finché il veto passa.
5. **F2.5 IC > 6,0 s** ⇒ **NO definitivo**. Silverstone resta 29,12, il debito resta scritto.
6. Qualsiasi tocco a file di produzione ⇒ violazione del mandato (non deve accadere).

## Leve vietate (dichiarate PRIMA, per nome)

- **Riclassificare una gara** (DRY↔WET↔MISTA) dopo aver visto il suo pit-loss, o ritoccare le
  soglie del 20% di F2.0.
- Spostare la soglia di affezione F2.3 (1,0 s) dopo aver visto i delta.
- Adottare il bootstrap **POOLED** se desse un verdetto migliore: si riporta, non si adotta.
- Abbassare il minimo blocchi da 5 a 4 se i dry si fermassero a 4.
- Allargare la finestra di riferimento out-lap (2–5 → 2–8) se l'IC non si stringe.
- Ripescare una gara esclusa da F2.2/F2.3 perché "senza di lei i blocchi non bastano".
- Usare FP/qualifica per gonfiare il campione.

Se una di queste sembrasse giustificata a valle dei numeri, **non si fa**: si scrive nel report
che è sembrata giustificata e perché non è stata fatta.

## Output attesi

- `PREREG_SESSIONE_FF2.md` (questo file, **committato per primo**)
- `gen_pitloss_fastf1_esteso.py` — **generatore committato**
- `data/fastf1_silverstone_stops_esteso.csv` — uno stop per riga, con gara e condizione
- `data/pitloss_silverstone_dry_wet.csv` — i due parametri, con IC e n blocchi
- `REPORT_PITLOSS_FF2.md`, con **in cima**:
  - `F2.0 classificazione: DRY [gare] | WET [gare] | MISTE [gare]`
  - `F2.2 stazionarietà: pit_lane_time per gara, escluse: [...]`
  - `F2.4 pit_loss_dry = X.XX s, IC95 [a–b], larghezza L s, n blocchi = N`
  - `F2.4 pit_loss_wet = Y.YY s (archiviato, non in produzione)`
  - `F2.5 VERDETTO: [GO / AMBIGUO / NO / NON ESEGUIBILE]`
- `data/pit_loss_circuito_f1db.NOTA.md` aggiornata (F2.6)
- Golden verdi **prima e dopo**.

Se il verdetto è NO o NON ESEGUIBILE, si scrive senza attenuazioni. Silverstone resta a 29,12.
Nessun verdetto strategico: è del PO.
