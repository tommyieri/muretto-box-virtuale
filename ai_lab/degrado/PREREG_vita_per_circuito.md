# Prereg — la vita della gomma dalla PISTA: otto stagioni invece di undici gare

**Data: 04/08/2026.** Scritta **prima** di aver misurato una sola durata sul fondo. Esegue
il lavoro n. 1 della direttiva del PO del 04/08: *«la vita della gomma va cercata sulla
pista, non sulla stagione»*.

Vale la deroga già firmata in `simulatore/DEROGA_prior_comportamentale.md`: ciò che si
stima resta un **prior comportamentale** — quanto i team tengono una gomma lì — non la
durata fisica del pneumatico. Questa prereg non allarga quella deroga, cambia solo da dove
viene il numero.

---

## 1 · La domanda, e il difetto che l'ha fatta nascere

In produzione la vita della gomma è `giri[mescola] × fattore_circuito[circuito]`. I `giri`
vengono dalle 427 decisioni del 2026; il **fattore** anche, e lì c'è il problema che il PO
ha nominato: le celle circuito × mescola del 2026 sono troppo magre — Canada e Miami hanno
**zero** stint hard conclusi da una sosta — quindi il fattore si stima su tutte le mescole
insieme, con 19–86 decisioni per circuito, ognuna contaminata da safety car, bandiere rosse
e occasioni. È un rattoppo, ed è dichiarato tale nella sua stessa targhetta.

**E c'è un secondo difetto, trovato scrivendo questa prereg e non ancora a referto: quel
fattore è una fonte orfana.** Nessuno script nel repo scrive
`simulatore/data/modelli/vita_mescola.json`: undici numeri esistono solo perché qualcuno li
ha scritti a mano seguendo una ricetta che vive in prosa dentro il file stesso. Il campo
`generato_da` dichiara `ai_lab/degrado/decisioni.mjs`, ma quel modulo **non calcola nessun
fattore e non scrive niente**. Per la regola già pagata dal progetto — *file senza
generatore = debito, non fonte* — il numero che oggi decide la vita della gomma su undici
circuiti non è riproducibile.

Quindi questo lavoro ha **due esiti separati**, e il secondo non dipende dai cancelli:

| | cosa | dipende dai cancelli? |
|---|---|---|
| **A** | sostituire il fattore 2026 con uno stimato sul fondo 2018-2025 | **sì** |
| **B** | dare un **generatore** al fattore — entrambe le ricette, quella 2026 e quella storica | **no**: si fa comunque |

B si fa comunque perché anche il nullo di questo esperimento (il fattore di oggi) deve
essere riproducibile per poter essere un nullo. Un nullo scritto a mano non è un metro.

## 2 · Cosa ho letto PRIMA di scrivere questa prereg

Dichiarato per intero, perché la differenza fra «prereg» e «racconto» è tutta qui.

**Ho letto**: l'elenco delle gare del fondo anno per anno (`data/fondo/2018…2025`); le
colonne disponibili in `Race.json.gz` (`compound`, `stint`, `life`, `status`, `pin`,
`pout`, `lap`, `drv`); la mappa dei nomi gara → nome canonico in
`simulatore/provenienza/importa_archivio.mjs`; il calendario 2026; il contenuto di
`vita_mescola.json`, cioè il parametro di oggi; e il fatto che nessuno lo genera.

**Non ho misurato**: nessuna durata di stint sul fondo, per nessun circuito, per nessun
anno. Il fattore storico non esiste ancora, né in forma grezza né normalizzata.

Il fattore 2026 lo conosco, ma è un **nullo** di questo esperimento, non il suo esito.

## 3 · Il perimetro, e le esclusioni decise ADESSO

Lo stesso perimetro della prereg madre, portato sul fondo:

> stint **conclusi da una sosta** (mai l'ultimo di ogni pilota: quello finisce con la
> bandiera e non è una decisione sulla gomma), mescola **slick**, gara **asciutta**,
> durata > 0.

«Asciutta» e «slick» **si importano** da `simulatore/provenienza/` — la definizione di gara
asciutta è già quella di `esporta_soste_fondo.mjs` (nessuna gomma da bagnato compare, per
nessuno) e le mescole da `vocabolario.mjs`. Regola 1: non se ne scrive una seconda.

### 3.1 · L'esclusione sotto neutralizzazione, e perché è più stretta di quanto sembri

Il PO ha nominato il tranello con precisione: *escludere gli stint chiusi sotto
neutralizzazione è la cosa giusta **se** si decide prima.* Si decide adesso.

> **Si esclude uno stint se il suo giro di rientro ai box — l'in-lap, cioè il giro della
> decisione — porta nello `status` il codice `4` (Safety Car) o `5` (bandiera rossa).**

E si decide adesso anche cosa **non** si usa:

> **Il VSC (`6`, `7`) NON entra nella regola di esclusione.**

Non è una svista ed è la parte meno comoda di questa prereg. Il progetto ha già misurato
che quel segnale è rotto: `R_lap` del regime VSC vale **1,055** pooled — un'auto sotto VSC
non rallenta come dovrebbe — e ne è uscita una direttiva scritta, *«nessuno costruisca
sulla neutralizzazione VSC finché VSC non è capita»*. Costruirci un'esclusione sarebbe
costruirci sopra: si butterebbero stint buoni sulla parola di un sensore che sappiamo
mentire, e il perimetro dipenderebbe da un difetto noto.

**Conseguenza dichiarata, non nascosta**: nel perimetro restano le soste opportunistiche
sotto VSC. È una contaminazione **residua e nota**, nella stessa direzione su tutte le
piste (accorcia gli stint), e va scritta nell'esito accanto al numero. Se un giorno il VSC
verrà capito, questa è la prima cosa da rifare.

### 3.2 · Le piste che sono la stessa pista, e quella che non lo è

Decise adesso, prima di contare uno stint. Otto anni di calendari hanno nomi che cambiano
mentre l'asfalto resta, e un nome che cambia mentre l'asfalto cambia:

| gara del fondo | conta per | perché |
|---|---|---|
| `Styrian Grand Prix` (2020, 2021) | **Austria** | stesso Red Bull Ring, nome diverso per il secondo weekend |
| `70th Anniversary Grand Prix` (2020) | **Gran Bretagna** | stesso Silverstone |
| `Spanish Grand Prix` (2018-2025) | **Spagna** | Barcellona-Catalunya, che è il circuito del round 7 del 2026 |
| `Dutch Grand Prix` (2021-2025) | **Olanda (Zandvoort)** | — |
| `Sakhir Grand Prix` (2020) | **nessuno** | è il layout **outer** del Bahrain: un'altra pista, non un secondo Bahrain |

Il Bahrain non è nel perimetro del 2026 demo, ma la riga resta: è la regola che dice che si
mappa **la pista**, non il nome.

### 3.3 · Le stagioni, tutte e otto

Il PO ha chiesto *«gli ultimi otto anni»* e sono 2018-2025, per intero. **Non** si taglia
al 2022 (il passaggio ai cerchi da 18 pollici), perché tagliare dopo aver visto quanto
cambia sarebbe scegliere il perimetro — l'errore che questa prereg esiste per impedire. La
divisione 2018-2021 / 2022-2025 si misura lo stesso e si **riporta** (§8): è una robustezza
dichiarata, non un interruttore.

## 4 · Lo stimatore, e come si adatta al 2026

Il fattore è per definizione una **forma relativa**: quanto quella pista si discosta dalla
media della sua stagione. Le durate assolute del 2018 non sono confrontabili con quelle del
2026 — altre gomme, altro regolamento, altre lunghezze di gara — e la normalizzazione entro
stagione è ciò che rende trasferibile la sola cosa che può esserlo.

Per ogni stagione `y` e circuito `c` del fondo, sul perimetro di §3:

```
m(y,c)  = mediana delle durate degli stint di quel circuito, quell'anno
L(y)    = mediana su tutti i circuiti di m(y,·)            ← il livello della stagione
r(y,c)  = m(y,c) / L(y)                                    ← la forma, adimensionale
grezzo(c) = mediana su y di r(y,c)
```

**La mediana e non la media**, per la stessa ragione della prereg madre: le code sono fatte
di soste opportunistiche e incidenti al primo giro.

**Soglie di esistenza, decise adesso.** Un circuito-anno produce `m(y,c)` solo con almeno
**10** stint conclusi da una sosta; un circuito riceve un fattore proprio solo se ha almeno
**3** circuiti-anno validi. Sotto, **fattore = 1** — la vita globale, senza inventare un
adattamento che non è stato misurato (regola 6, la stessa scelta già scritta per i circuiti
ignoti). Dieci perché sotto quella soglia una singola giornata storta muove la mediana;
tre perché una mediana su due anni è due anni, non una storia.

### L'adattamento al 2026, in una riga e con zero parametri liberi

```
fattore_storico(c) = grezzo(c) / K
```

dove `K` è la media di `grezzo(c)` sugli **undici circuiti del 2026**, pesata sul numero di
decisioni 2026 di ciascuno.

Cosa fa questa divisione, detto senza formule: **il livello resta del 2026, la forma viene
dalla storia.** `giri[mescola]` — SOFT 12, MEDIUM 19, HARD 22 — continua a venire dalle
decisioni del 2026, che sono le uniche che hanno visto il regolamento nuovo; la storia dice
soltanto *quali piste consumano più delle altre*, e per costruzione non sposta la media.

È questo il punto in cui l'adattamento poteva diventare una scorciatoia, e la scorciatoia è
esclusa qui: **non** si stima nessun offset e nessuna scala sul 2026. Il progetto ha già
provato quella strada su un'altra domanda e l'ha registrata NULL — «offset/scala loro dalle
altre gare 2026 peggiora il prior, con cambi di segno per circuito». Un adattamento affine
imparato sul 2026 non è in questa prereg, e se un giorno servirà avrà la sua.

## 5 · La macchina del giudizio, e perché NON è il pianificatore

La prereg madre giudicava col **pianificatore del motore**, per non essere circolare, e
aveva ragione: là il parametro veniva dagli stessi stint su cui veniva letto.

**Qui la circolarità non c'è.** Il fattore storico si stima su 2018-2025 e si giudica sul
2026: gli insiemi sono disgiunti per costruzione, non per una procedura. Passare comunque
dal pianificatore avrebbe un costo preciso, e il progetto lo ha appena misurato: il
pianificatore minimizza il tempo totale di gara coi rivali fermi, senza traffico e senza
posizione in pista, sbaglia la durata di uno stint di **11 giri** in mediana e dice «arrivi
così» in **99 casi su 167**. È il lavoro n. 3 del PO, ed è aperto. Far passare di lì un
parametro per giudicarlo significa misurare soprattutto quel difetto.

Quindi, dichiarato adesso:

- **Cancello primario — descrittivo.** Per ogni stint 2026 nel perimetro: durata prevista =
  `giri[mescola] × fattore(circuito)`, errore = `|previsto − osservato|` in giri.
- **Riportato ma NON decisivo — attraverso il pianificatore.** Gli stessi tre bracci dentro
  `cancelli_vita.mjs`, così l'effetto sul prodotto si vede invece di restare implicito.

**I tre bracci differiscono per una sola cosa: `fattore_circuito`.** `giri[mescola]` è
identico in tutti e tre e si calcola sempre **leave-one-race-out** sul 2026, come già fa
`vitaDa(D, gara)`. Il fattore 2026 (il nullo N1) si ricalcola **anch'esso**
leave-one-race-out con la sua ricetta; il fattore storico non ne ha bisogno, perché il 2026
non lo ha mai toccato.

## 6 · I nulli

| | nullo | perché esiste |
|---|---|---|
| **N1** | il **fattore di oggi**, ricalcolato leave-one-race-out dal 2026 | è ciò che si vuole sostituire: senza batterlo non c'è ragione di cambiare |
| **N2** | **fattore = 1** per tutti — la pista non conta | se la storia non batte «il circuito non è un predittore», non c'è niente da mettere in produzione |

**N2 non è una formalità, ed è onesto dirlo prima.** Su questo progetto *«il circuito non è
un predittore»* è già la conclusione convergente di otto risultati indipendenti, e il
placebo di uno di quelli disse che il guadagno veniva dal pavimento uniforme, non dalla
pista. Questa domanda è legittima **solo** perché la fonte è nuova — otto stagioni al posto
di undici gare — che è esattamente la condizione che il progetto si è dato per riaprire un
NULL. La direzione dell'attesa, però, è quella: **N2 è il cancello che ci si aspetta di non
passare**, e il risultato più probabile di questa sessione è un NULL.

## 7 · I cancelli, con le soglie scritte adesso

Metrica: **errore assoluto in giri**, per stint, sul perimetro di §3. Confronti **appaiati**
(stesso stint, tre previsioni).

| | cancello | soglia, decisa adesso |
|---|---|---|
| **C1** | il fattore storico batte **N2** (nessun fattore) | mediana dell'errore **inferiore di almeno 0,5 giri** **E** test dei segni appaiato **p ≤ 0,05** |
| **C2** | il fattore storico non è peggio di **N1** (il fattore 2026) | mediana dell'errore **≤** quella di N1 |
| **C3** | **placebo**: 200 rimescolamenti dei fattori fra i circuiti | il guadagno vero su N2 sta nel **5 % superiore** della distribuzione dei guadagni finti |
| **C4** | **non fare danno** attraverso il pianificatore | l'errore mediano dei tre bracci in `cancelli_vita.mjs` non peggiora di più di **0,5 giri** rispetto al fattore in produzione |

Mezzo giro, e non un decimo, perché il prodotto arrotonda a giri interi: sotto quella
soglia il cancello premierebbe una differenza che l'utente non può vedere.

**C3 è il cancello che conta di più**, e va letto come è scritto: se rimescolare i fattori
fra i circuiti funziona quasi come assegnarli giusti, allora il guadagno viene
dall'*esistere* di una dispersione, non dalla pista — che è precisamente ciò che il placebo
aveva già trovato la volta scorsa.

## 8 · Le regole di decisione, inclusi gli STOP

Scritte adesso, e si eseguono anche se il numero dispiace.

- **C1 fallisce** → **NULL**, e il fattore storico non entra. In più, la stessa evidenza
  toglie la gamba anche al fattore 2026: la **proposta al PO** è spegnere il fattore per
  circuito, non sostituirlo. Spegnerlo è una modifica alla produzione, quindi **si propone,
  non si fa**.
- **C1 passa, C3 fallisce** → **NULL**. Il guadagno non è la pista. Non si cerca una terza
  forma nella stessa sessione.
- **C1 e C3 passano, C2 fallisce** → il fattore storico è meglio di niente ma peggio del
  rattoppo: si **riporta e non si promuove**.
- **C1, C2, C3 passano, C4 fallisce** → non si promuove: il parametro migliore attraverso
  un obiettivo rotto peggiora il prodotto, ed è il lavoro n. 3 che va fatto prima.
- **Tutti passano** → si propone al PO la sostituzione di `fattore_circuito`, e **Zandvoort
  riceve il suo fattore** dalle cinque edizioni 2021-2025 invece del fattore 1 di default,
  in tempo per il 23/08.

Nessuna soglia si tocca dopo aver visto i numeri. Un cancello sbagliato si mette a referto
e se ne pre-registra un altro (regola 3).

## 9 · Le robustezze: si misurano, si riportano, non decidono

1. **Ere delle gomme**: lo stesso fattore su 2018-2021 e su 2022-2025 separatamente.
2. **Stabilità per anno**: la dispersione di `r(y,c)` fra le stagioni, circuito per
   circuito. È anche l'unico modo onesto che ho per accorgermi di una riasfaltatura o di un
   cambio di layout senza andarmi a curare a mano una lista di fatti esterni: un circuito
   che è cambiato lo dice diventando instabile.
3. **Esclusione più larga**: in-lap **o giro precedente** sotto `4`/`5`, invece del solo
   in-lap.
4. **Il perimetro intero**: gli stessi tre bracci sulle 427 decisioni senza l'esclusione di
   §3.1, per continuità con la prereg madre.

Nessuna delle quattro può cambiare l'esito dei cancelli. Se una di esse ribaltasse il
quadro, è materiale per una **prereg nuova**, non per questa.

## 10 · Cosa NON si fa in questa sessione

- Non si tocca il pianificatore (lavoro n. 3).
- Non si aggancia l'indice di sorpasso (lavoro n. 2).
- Non si guardano i microsettori (lavoro n. 4).
- Non si stima nessun adattamento affine sul 2026 (§4).
- Non si accende niente in produzione: l'accensione è del PO, come lo è stata per
  `vita_mescola`.

## 11 · Il prodotto della sessione

1. `simulatore/provenienza/esporta_durate_fondo.mjs` — un record per stint concluso da una
   sosta sul fondo 2018-2025, con la sua durata, la mescola, il circuito canonico e il
   motivo di ogni esclusione, **contata**.
2. `ai_lab/degrado/fattore_circuito.mjs` — il **generatore**, entrambe le ricette (2026 e
   storica). Da qui esce anche il fattore di oggi, che smette così di essere orfano.
3. `ai_lab/degrado/cancelli_per_circuito.mjs` — i quattro cancelli, che non decidono niente:
   eseguono ciò che sta scritto qui.
4. `ai_lab/degrado/ESITO_vita_per_circuito.md` + il suo JSON.

---

**Sigillo.** Questo documento è committato **prima** che una sola durata del fondo venga
misurata. Il commit che lo introduce non contiene nessuno dei quattro file di §11.
