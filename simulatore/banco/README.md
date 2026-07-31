# 📊 Replay Lab (`banco/`)

Banchi, golden, sentinelle, corsa notturna: l'arbitro. Nessuna modifica va
online se peggiora i cancelli pre-registrati (regola 3). Ogni sentinella esce 1
quando fallisce (regola 4) e dichiara nel commento cosa la farebbe fallire
(E09). Le attese viaggiano COI golden (E07).

- `run_suite.mjs` — esegue tutte le sentinelle in `sentinelle/`; esce 1 al primo fallimento
- `sentinelle/` — una sentinella per file, `sNN_nome.mjs`
- `prereg/` — le metriche scritte PRIMA dei numeri, e i loro esiti
- `misure/` — le misure del banco: `rientro`, `g0`, `bias`, `pitloss`
- `misura_tutto.mjs` — le esegue tutte (l'unica implementazione: golden, sentinella e notturna la condividono)
- `misure_congelamento.mjs` — il registro di tutto ciò che si calcola "al congelamento", sorvegliato da `s14`
- `notte.mjs` (`npm run notte`) — la corsa notturna: suite + misure, `REPORT_NOTTE.md` col delta rispetto alla notte prima, esce 1 su regressione

## Le metriche in vigore

| metrica | dove | cancello |
|---|---|---|
| rientro per secchi (PULITA / SOSTE_RIVALI / NEUTRA), su tutte le soste vere 2026 | `misure/rientro.mjs` | non-regressione dalla linea di base |
| G0″ — ottimo del banco contro forma chiusa | `misure/g0.mjs` | 100% dei casi ammessi |
| bias sui tempi assoluti per orizzonte | `misure/bias.mjs` | ≤ 0,17 s/giro, piatto entro 0,10 |

**G0′ è RITIRATA** (`prereg/PREREG_G0_secondo.md`): con la clausola di bordo a
due code bocciava la risposta corretta al bordo — 68 casi su 799, tutti con
l'ottimo analitico prima del primo giro utile. È E08 ripetuto dentro la metrica
scritta per ripararlo. Il suo 91,49% resta a referto: una misura sbagliata si
mette a referto, non si cancella.

## Fase Bagnato: NON ESEGUIBILE su questo fondo (2026-07-29)

`prereg/PREREG_bagnato.md` → `prereg/ESITO_bagnato.json`, sorvegliato da `s23`.

Il fondo ha **20 gare bagnate e 10.098 giri** su gomma da bagnato, ma il
crossover — il fenomeno che il cancello chiede di riprodurre — è osservabile in
**1 gara**: serve che le due famiglie girino *pulite in contemporanea*, e la
transizione avviene ai box, quindi i giri di cambio sono in-lap/out-lap (esclusi)
e spesso sotto Safety Car (esclusa). La prereg chiedeva ≥ 8 gare giudicabili.

La conclusione non dipende dalla soglia: nemmeno il criterio più permissivo
della tabella di sensibilità (mediana su un pilota solo) arriva a 8 — il massimo
è 5. Il **selettore Wet resta spento**, col motivo preso dall'esito e non da una
frase cablata in pagina.

Le grandezze descrittive (la gomma da bagnato gira il **+10,7%…+24,1%** sopra il
riferimento asciutto della gara) restano nell'esito come **diagnostica
etichettata** e NON in `data/modelli/`: un file lì dentro verrebbe prima o poi
consumato come modello, e questa fase non ne ha prodotto uno.

`fisica/stima_bagnato.py` **fallisce rumorosamente** se un giorno il fondo
rendesse la fase eseguibile: il modello va scritto allora, non improvvisato ora.

## Fase Multi-Stint: PASSA (2026-07-30)

`prereg/PREREG_multistint.md` → `prereg/ESITO_multistint.json`, sorvegliato da
`s24`. Le misure stanno in `misure/multistint.mjs` ed entrano nella notturna:
i cancelli sono passati da 11 a 18.

| cancello | domanda | esito |
|---|---|---|
| **M1** | la ricerca e la forma chiusa descrivono lo stesso oggetto del kernel? | forma chiusa **120/120** ammessi · ricerca ristretta **144/144** · k ottimo **36/36** |
| **M2** | il piano a una sosta *è* lo scenario a una sosta? | **60/60**, identità esatta |
| **M3** | il piano rispetta il regolamento 2026? | **59/59** approvati, **32** obbligati a fermarsi (non cieco) |
| **M4** | le durate di stint 2026 sono allarmi o vincoli? | **59/59** piani identici a allarmi spenti |

**La forma chiusa multi-sosta si riduce a quella nota.** Con `k = 1` dà
`(R − età)/2`, l'ottimo analitico già in vigore e già sorvegliato da G0″: la
generalizzazione non è una seconda fisica del «quando fermarsi», è la stessa.

**Il difetto che M3 ha trovato.** Alla prima esecuzione il Director approvava
**9 piani a zero soste** per piloti che al congelamento avevano usato una sola
mescola slick — nove squalifiche proposte come strategia. Passavano perché
`strategia_dichiarata` era legata a «ha almeno una sosta», e un piano a zero
soste risultava «strategia non dichiarata»: REG01 veniva saltata esattamente
dove serviva. Corretti due punti — la strategia di chi fa la domanda è dichiarata
sempre, anche quando è «non fermarsi più», e la ricerca tratta le due mescole
come **vincolo** (k ≥ 1), non come preferenza.

**Il limite, dichiarato dalla fase stessa.** `(k+1)* = (R+a)·√(ρ/2P)`: con
ρ = 0,0308 e una perdita di 18-28 s, su gara intera viene `k* ≈ 0,5`. Il modello
propone **sistematicamente troppo poche soste**, perché il degrado è lineare e
non c'è cliff — ed è proprio il cliff che in gara giustifica la sosta in più. Il
limite viaggia **col piano fino in pagina**, non in una nota a piè di README.

## Fase Difesa della Posizione: D1 PASSA · D2 NON SEPARA (2026-07-30)

`prereg/PREREG_difesa.md` → `prereg/ESITO_difesa.json` +
`data/modelli/banda_rientro.json`, sorvegliati da `s25`.

**La fase non ha costruito una probabilità di sorpasso.** Il vecchio repo ha
misurato che il duello non si simula, e questa è la fase che più di ogni altra
poteva riaprire la questione. Ha risposto con l'altra cosa, quella onesta:
**quanto vale il «rientri P14»** che la pagina scriveva come se fosse un fatto.

| | esito |
|---|---|
| **D1** la banda copre ed è minimale, leave-one-race-out | **PASSA** — verde **±1** (88,5% fuori campione), sotto regime **±2** (85,7%) |
| **D2** i rientri contesi sbagliano di più? | **NON separa** (p = 0,290 alla soglia dichiarata di 2 s; 0,277–0,348 su 1/2/3/5 s) → **una banda sola** |
| **D3** l'output dice mai CHI supera CHI? | mai — verificato sul codice e sull'output; nessun DRS, che nel 2026 non esiste |
| **D4** la banda nasconde un bias? | no: bias mediano 0 in entrambi i contesti, bande simmetriche |

**Il contesto che il prodotto può davvero usare.** La prereg dava per scontato
che «il prodotto usa il secco della domanda». Non è vero in verde: distinguere
`PULITA` da `SOSTE_RIVALI` richiede di sapere se i rivali si fermeranno, che al
congelamento è informazione dal futuro (E14) — ed è l'ignoranza che il secco
`SOSTE_RIVALI` esiste per misurare. Quindi in verde la banda è calibrata
sull'**unione** dei due secchi (209 casi): copre entrambi i casi in cui potremmo
essere, e non promette una precisione che dipende da un dato che non abbiamo.

**Il difetto della statistica di D2, dimostrato dall'interno.** La differenza fra
le *mediane* di `|errore|` è quasi priva di risoluzione su una grandezza intera
con mediane 0 e 1: la differenza osservata è esattamente 1 a tutte e quattro le
soglie. Quanto sia grave si vede costruendo il caso peggiore — due masse
puntiformi (contesi tutti a 0, puliti tutti a 5, un effetto che non potrebbe
essere più forte) danno **p = 0,90**, perché la mediana di un gruppo misto scatta
fra 0 e 5 e la distribuzione permutata vale ±5 quasi sempre. Con una dispersione
su cui la mediana possa muoversi, la stessa prova dà **p = 0,0005**. La metrica
non è cieca in generale: è cieca sui dati che ha davanti. Non si riscrive dopo
aver visto il risultato (regola 3) — resta a referto, e
`prereg/PREREG_difesa_II.md` pre-registra una statistica con risoluzione.

**Un generatore misurato, non assunto.** Il p-value di D2 è stato rimisurato dopo
una correzione: il primo generatore pseudo-casuale era un LCG classico scritto in
aritmetica JS, dove il prodotto supera 2⁵³ e i bit bassi — quelli che l'AND a 31
bit conserva — si perdono nel float. Non era degenere (il mescolamento spostava
~10 etichette su 20) ma era misurabilmente **non uniforme**: χ² = 170 sui decili
di 200.000 estrazioni, contro una soglia al 5% di 16,92. Sostituito con
mulberry32 (`Math.imul`, esatto a 32 bit): χ² = 3,91. Entrambi i valori restano a
referto (E22): p = 0,29527 col generatore storto, **p = 0,29007** con quello
corretto. La conclusione non cambia — non era vicina alla soglia — ma il numero
pubblicato è quello rimisurato.

**Il limite dichiarato.** La banda complessiva copre l'87% ma crolla a Monaco
(0,63) e in Australia (0,59) — le due gare dominate dal secco NEUTRA. Dove non si
sorpassa, le posizioni reali sono più appiccicate di quanto un motore in cui le
auto si attraversano possa prevedere. I circuiti sotto il livello viaggiano NEL
modello e arrivano in pagina come avviso; **non** si è aggiunta una banda per
circuito, che con 14-78 casi per gara sarebbe rumore promosso a parametro.
