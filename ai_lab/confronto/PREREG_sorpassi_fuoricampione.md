# PREREG — IL FUORI CAMPIONE: 78 gare che non ho mai visto

**Scritta il 02/08/2026, PRIMA di misurare, e committata PRIMA che lo strumento
esista.** Autorizzata dal PO: *«sì, fai la prereg nuova con il fuori campione»*.

## Questo è il TERZO tentativo sulla stessa domanda, e va detto

1. **06/07/2026** — indice di difficoltà di sorpasso per circuito, fra stagioni.
   **NO-GO**, 2 gate su 4 (`data/SORPASSO_NOTA.txt`).
2. **02/08/2026 mattina** — la stessa metrica dentro la gara (`PREREG_sorpassi_intragara.md`).
   Cancello **S1 FALLITO** (ρ = +0,362 contro 0,40). Ma una verifica avversariale a
   cinque lenti ha confutato la conclusione: lo strumento aveva **50% di potenza alla
   propria soglia**, la soglia di ammissione buttava **il 58% degli episodi**, e il
   **giro 4** è un artefatto della metrica che finiva tutto in una metà sola.
3. **Questa.**

La regola della casa dice che un terzo tentativo si dichiara, non si fa di slancio.
È dichiarato.

## Perché il verdetto non può più stare sui dati di stamattina

Su quei dati **ho già visto tutto**: che a soglia ≥3 viene ρ = +0,459 (p < 0,0001),
che togliendo il giro 4 viene +0,714, che con `MIN_MEZZO` a 11 il cancello passa, che
il 2025 da solo fallisce. Qualunque cancello io scriva adesso su quel campione lo
scriverei sapendo come va a finire: sarebbe **E08 col vestito buono**.

Quindi le scelte si dichiarano qui, e il **verdetto si legge solo sul fuori campione**.
I numeri dentro campione si riporteranno per completezza e **non contano come prova**.

## Il fuori campione, e perché è vero

Tutta questa linea di lavoro legge `data/ti_archive/`, che contiene **2023-2026**.
Esiste un secondo archivio, `simulatore/data/fondo/`, che contiene **2018-2025** e che
`gen_difficolta_sorpasso.py` non ha **mai** aperto.

Le stagioni **2018, 2019, 2020, 2021, 2022** non sono mai state toccate da nessuna
misura di questo arco: **78 gare asciutte** dopo il dry-check (2018: 16 · 2019: 14 ·
2020: 14 · 2021: 17 · 2022: 17), contro le 59 già viste del 2023-2025.

Il tasso di scarto del dry-check è **uniforme fra le ere** (~20% ovunque: 5/21 nel
2018, 5/22 nel 2021, 4/24 nel 2025), quindi il fuori campione non nasce selezionato.
Sei gare 2019 hanno solo 3 colonne e sono **escluse per dato mancante**, non per esito.

## Il porting: nessuna seconda implementazione

I file del fondo sono lo **stesso JSON colonnare**, gzippato. Verificato: hanno tutte
e otto le colonne che servono (`lap`, `drv`, `sesT`, `pin`, `pout`, `life`,
`compound`, `status`).

Quindi il porting è **una scompattazione, non una riscrittura**: `per_pilota()`,
`genera_gara()`, `valuta()` ed `episodi()` girano **invariate**. Nessun secondo
proprietario di nessuna definizione (regola 1), nessuna porta per E12.

## Le scelte che decidono il verdetto, dichiarate adesso

Sono tre, e sono esattamente quelle che la verifica avversariale ha mostrato pesare
più del fenomeno. Per ciascuna, la ragione **non** è l'esito che produce.

**(1) Statistica: SPEARMAN. Invariata.**
So che Pearson (+0,487), l'arcoseno (+0,545) e la Pearson pesata (+0,576) passerebbero
tutte sullo stesso perimetro dove Spearman fallisce. **Proprio per questo non le uso.**
Cambiare stimatore dopo aver visto quale vince è la definizione del peccato. Spearman
è quella pre-registrata due volte e resta.

**(2) Ammissione: ≥ 3 episodi risolti per parte** (era ≥ 10).
Ragione, indipendente dall'esito: ≥10 era una soglia **mia**, scelta a occhio, e
scarta il **71% delle gare e il 58% degli episodi**. A ≥3 ne restano il 95%. Una
soglia di ammissione serve a escludere stime prive di senso, non a buttare il campione:
con 3 episodi una percentuale è grezza ma esiste, e il nullo di permutazione ne tiene
conto da solo.

**(3) Il GIRO 4 è escluso.**
Ragione, dimostrabile dalla **costruzione della metrica** e senza guardare nessun
risultato: il giro 4 è il **primo giro ammissibile** (E3 pretende L ≥ 4) **ed è
l'unico giro in cui nessuna coppia può trovarsi nel raffreddamento di 5 giri del
dedup**, perché prima non esistono episodi. Raccoglie quindi tutte le coppie in una
volta sola: **98 episodi su 1.594 su un giro solo**, densità 1,42/gara contro 0,38 dal
giro 10 (×3,8), e conversione **32,7% contro 58,7%** (z = −5,62). Non è lo stesso
fenomeno degli altri giri, ed è un difetto del **contatore**, non della pista.
Escluderlo significa misurare `L ≥ 5`.

**Le soglie NON si toccano**: ρ ≥ 0,40 e nullo p < 0,05, identiche al secondo
tentativo. Nullo = si rimescola **quale `tardi` sta con quale `presto`** (quello
corretto, non la specifica sbagliata del secondo tentativo).

## I cancelli

| | condizione | soglia |
|---|---|---|
| **F0** | il porting riproduce l'archivio già usato, sulle 59 gare in comune 2023-2025 | **≥ 95% di gare con lista di episodi identica**, e ρ dalle due strade entro **0,02** |
| **F1** | fuori campione 2018-2022: Spearman(presto, tardi), taglio a ⌈N/2⌉ | **ρ ≥ 0,40** e **nullo p < 0,05** |
| **F2** | fuori campione: X = 50% e X = 60% | **ρ ≥ 0,40** e **nullo p < 0,05** |

**F0 viene per primo e ha diritto di veto.** Se il porting non riproduce l'archivio
noto, tutto ciò che viene dopo misura la scompattazione, non il fenomeno, e non si
conclude niente.

Si riporteranno anche X = 20%, 30%, 40% fuori campione. **Previsione dichiarata
adesso: falliranno** — dentro campione X ≤ 40% fallisce in ogni variante provata. Se
invece passassero, sarebbe un risultato che questa prereg non si aspetta, e andrà
scritto come tale.

**NON ESEGUIBILITÀ**: meno di **8 gare** ammesse in F1, oppure F0 fallito.

## Cosa succede dopo, deciso adesso

- **F0 fallito** → non si conclude niente. Si ripara il porting o si dichiara che il
  fuori campione non è raggiungibile con questi dati.
- **F1 passato** → la proprietà è stabilita su **78 gare mai viste**. Si va al
  **Cancello B di `banco/prereg/PREREG_difesa_II.md`**, riscrivendone prima la linea
  di base: quel documento pretende di «battere la banda per secco della Fase I», ma
  `ESITO_difesa.json` oggi dice **«D1 NON PASSA»** e i suoi numeri (87% complessiva,
  Monaco 0,63, Australia 0,59) non sono più quelli di oggi (0,8593 · 0,7692 · 0,75).
- **F1 fallito** → **il ramo si chiude, e questa volta per davvero.** Un fallimento su
  78 gare mai viste, con le scelte dichiarate prima, non è uno strumento spuntato: è
  una risposta. **Nessun quarto tentativo su questa metrica.**
- **F1 passato ma F2 fallito** → la proprietà esiste ma non arriva in tempo nemmeno a
  metà gara: la banda non si condiziona, e resta come limite dichiarato.

## I limiti, dichiarati prima

- **Il DRS c'è in tutte e cinque le stagioni del fuori campione**, e nel 2026 non
  esiste. F1 prova il **meccanismo**, non il trasferimento al 2026. Chiudere quel
  passaggio è una domanda separata che questa prereg non apre.
- **Il 2018 ha mescole che non esistono più** (ULTRASOFT, SUPERSOFT, HYPERSOFT). La
  metrica non filtra per mescola, quindi non è un ostacolo, ma va saputo.
- **Il 2020 è la stagione COVID**, con circuiti ripetuti e calendario anomalo. L'unità
  qui è la **gara**, non il circuito, quindi non distorce — ma si riporterà anche il
  risultato senza 2020, come sensibilità dichiarata prima.

## I paletti, invariati

- **Nessuna probabilità di sorpasso.** `s25_difesa` resta e continua a far fallire la
  suite se un campo nomina chi supera chi.
- **Non si riapre il NO-GO del 06/07** sull'indice per circuito.
- **Il CSV orfano `data/difficolta_sorpasso.csv` non si usa.**
- **Nessun coefficiente si tocca** in base a questi numeri.

---

# ESITO — misurato il 02/08/2026

`python3 ai_lab/confronto/sorpassi_fuoricampione.py`

## F0 · il porting — PASSA, ed è esatto

Sulle 59 gare che i due archivi hanno in comune:

| | gz (`simulatore/data/fondo`) | ti_archive |
|---|---|---|
| episodi risolti | **1.379** | **1.379** |
| conversioni | **771** | **771** |
| ρ | **+0,507** (n = 55) | **+0,507** (n = 55) |

Scarto sugli episodi **0**, scarto su ρ **0,0000**. Il porting non è «abbastanza
vicino»: è **identico**. Le funzioni ratificate hanno girato invariate, come
dichiarato.

## F1 · il verdetto fuori campione — **FALLITO per 0,0024**

**78 gare asciutte del 2018-2022, mai aperte da questa linea di lavoro.**
Scartate 6 mutilate (2019, tre colonne) e 19 non asciutte dal dry-check ratificato.

> **ρ = +0,3976 · nullo p = 0,0003 · n = 70 gare ammesse**
> soglia **ρ ≥ 0,40** → **FALLITO**, mancato di **0,0024**.

IC95 bootstrap (20.000 ricampionamenti): **[+0,193; +0,569]**.
- **99,99%** dei ricampionamenti sopra lo zero;
- **48,2%** sopra la soglia 0,40.

Sensibilità e scomposizioni **dichiarate prima**:

| | n | ρ | p | |
|---|---|---|---|---|
| senza 2020 (dichiarata in prereg) | 58 | +0,467 | 0,0001 | passa |
| solo 2018 | 14 | +0,220 | 0,228 | no |
| solo 2019 | 13 | +0,810 | 0,0004 | passa |
| solo 2020 | 12 | +0,137 | 0,335 | no |
| solo 2021 | 14 | +0,145 | 0,311 | no |
| solo 2022 | 17 | +0,530 | 0,015 | passa |

## F2 · la domanda del prodotto, fuori campione

| X | n | ρ | p | | previsione della prereg |
|---|---|---|---|---|---|
| 20% | 56 | +0,300 | 0,014 | no | prevista fallita ✓ |
| 30% | 66 | +0,306 | 0,005 | no | prevista fallita ✓ |
| 40% | 71 | +0,359 | 0,0015 | no | prevista fallita ✓ |
| 50% | 71 | +0,399 | 0,0002 | no (per 0,001) | — |
| **60%** | 68 | **+0,436** | **0,0003** | **passa** | — |

Le tre previsioni dichiarate prima si sono avverate.

*Dentro campione, per completezza e senza valore di prova: 2023-2025 dà +0,507.*

## Verdetto

**F1 è fallito. Il ramo si chiude, come pre-registrato. Nessun quarto tentativo
su questa metrica.**

E va detto con precisione che cosa è fallito, perché due frasi vere qui non sono
la stessa frase:

1. **L'associazione presto→tardi ESISTE, fuori campione, oltre ogni dubbio
   ragionevole.** p = 0,0003 su 78 gare mai viste; il 99,99% dei ricampionamenti
   sta sopra lo zero. L'ipotesi «non c'è nessuna relazione» è **respinta**.
2. **La sua MAGNITUDINE non è certificata sopra 0,40.** Il punto stimato è +0,3976
   e l'IC95 contiene la soglia: sopra o sotto è quasi un lancio di moneta (48,2%).

Il cancello chiedeva la seconda, e la seconda non c'è. Che manchi per 0,0024 non
lo rende meno fallito: una soglia che si allarga davanti al risultato non è una
soglia, ed è la ragione per cui l'avevo scritta prima e committata prima dello
strumento (commit `7a5f423`).

## Che cosa resta in mano, di solido

- Il 2020 (stagione COVID) è la stagione che tira giù la stima: senza, +0,467.
  Era una sensibilità **dichiarata prima**, quindi è informazione onesta — ma
  **non è il verdetto**, e non la uso come tale.
- Il tre stagioni su cinque in cui la stima è debole (2018, 2020, 2021) contro le
  due in cui è forte (2019 +0,810, 2022 +0,530) dicono che la proprietà, se c'è,
  **non è costante fra le ere**. È lo stesso difetto che aveva affossato l'indice
  per circuito il 06/07 (G2, stabilità fra stagioni), ricomparso a un altro livello.
- **La sorpassabilità non è conoscibile presto**: X ≤ 40% fallisce dentro e fuori
  campione, con la previsione dichiarata in anticipo. Questo è il risultato più
  solido dell'intero arco, ed è quello che serve al prodotto: **la banda di rientro
  non si può condizionare a un indicatore di sorpassabilità al congelamento.**

## Cosa NON faccio

Non riapro con una quarta variante, non cambio statistica, non sposto la soglia,
non promuovo la sensibilità «senza 2020» a verdetto. La prereg lo vieta e ha
ragione a vietarlo.

Se il PO decide di riaprire sapendo tutto questo — che l'associazione è reale ma la
magnitudine è indeterminata attorno alla barra — quella è una **decisione sua, presa
alla luce del sole**, e va scritta come tale. Non è una cosa che posso concedermi io
leggendo un numero mancato per due millesimi.
