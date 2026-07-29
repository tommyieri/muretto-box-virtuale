# PREREG — la partizione del cancello di accensione, da PARI/DISPARI a TEMPORALE

Branch `metodo/partizione-temporale`, 21/07/2026. Base: `main` = `fc7afb6` (post PR #75).

**Questo documento è committato PRIMA di aver guardato quale modello si accende con la
partizione nuova.** È la precauzione centrale: si sta cambiando un metodo pre-registrato
*dopo* aver visto i risultati che produceva. Senza il rito, questo è HARKing. Col rito, è
manutenzione di uno strumento rotto.

---

## 1. Il difetto — misurato, documentato, e già a referto

La partizione calibrazione/verifica del cancello usa gli **indici pari/dispari** sulle gare
ordinate: `cal, ver = gids[0::2], gids[1::2]`.

Aggiungendo o togliendo **un** Gran Premio, tutti gli indici scalano e la partizione **si
rovescia**. Misurato su `main` (diagnosi 989d3de, riconfermato qui):

| | |
|---|---|
| verifica con 10 gare | Austria, British, Cina, Miami, Spagna |
| verifica togliendo la 1ª gara | Belgian, Canada, Giappone, Monaco |
| **sovrapposizione** | **ZERO** |

Conseguenza misurata sul modello traffico: **5 gare su 10, tolte da sole, ribaltano
`ACCENDIBILE`** (Canada, Cina, Giappone, Miami, Monaco). Con tutte e 10 il confronto appaiato
contro il traffico-zero è **−0,057 s**; togliendone una qualunque diventa **positivo**.

> A ogni gara nuova il cancello si rimisura su un insieme **completamente diverso** e può
> cambiare risposta **per ragioni che non sono evidenza nuova** — solo perché il taglio è
> caduto diversamente.

**È la terza incarnazione della malattia-madre del progetto**: *il risultato dipende da come
tagli i dati, non da cosa dicono*. Le prime due sono ATT6 v2 (denominatori nati dalla
selezione dei casi) e il cancello-partizione del distruttore (elisione fra segni opposti).
Questa è la stessa malattia dentro il meccanismo che decide se un modello va live.

---

## 2. La partizione NUOVA, dichiarata prima di misurarla

**TEMPORALE, con soglia CONGELATA alla data.**

- Le gare del regime si ordinano per **data**.
- **Calibrazione = le gare più VECCHIE. Verifica = le più RECENTI.**
- Il taglio è una **data**, `T*`, non un conteggio e non una parità: `cal = {gare con data <
  T*}`, `ver = {gare con data ≥ T*}`.
- `T*` si fissa **una volta**, al momento dell'adozione della regola, e **non si muove più**
  per quel regime. Viene scritto nel file del modello insieme al verdetto.

**Perché questo verso**: è l'unico che corrisponde all'uso reale. Al via di domenica hai il
passato e devi applicare il modello alla gara che arriva. Calibrare sul futuro per giudicare
il passato è un esercizio che il prodotto non fa mai.

**Perché la soglia è una data e non un conteggio**: con un conteggio («le prime K»),
togliere una gara dalla calibrazione fa **migrare** una gara dalla verifica alla
calibrazione. Con una data congelata, aggiungere o togliere una gara **non sposta il taglio
di un millimetro**: le gare nuove entrano in **coda**, dentro la verifica, e l'insieme di
verifica di domani è **sovrainsieme** di quello di oggi. È esattamente la proprietà che il
pari/dispari viola.

### Come si sceglie `T*` (senza guardare i risultati)

`T*` = **la data della (K_min+1)-esima gara del regime**, con `K_min` derivato da vincoli
**già pre-registrati prima di oggi**, non scelti adesso:

- `scheletro.bootstrap_a_blocchi` (sotto sigillo) richiede **≥ 2 blocchi** per produrre un IC;
- l'aggregato di calibrazione è una **mediana cross-gara**: sotto 3 blocchi è degenere;
- `PREREG_degrado_2026.md §4` — committato il 21/07/2026, **prima** di questa sessione —
  richiede **≥ 4 gare distinte** nell'insieme di **verifica** perché il verdetto sia
  giudicabile.

⇒ **`K_min = 4`**: la calibrazione ha una mediana su 4 blocchi, e con 10 gare la verifica ne
riceve **6**, sopra il minimo di 4 già pre-registrato. Entrambi i lati soddisfano vincoli
scritti prima di oggi. Nessun parametro libero scelto sul risultato.

### Limite dichiarato di questa scelta

Con `T*` congelato, la **calibrazione non cresce**: a fine 2026 si calibrerà ancora sulle
prime 4 gare. È il prezzo della stabilità del taglio, e lo dichiaro adesso invece di
scoprirlo comodo dopo. Il successore naturale, quando il regime sarà ricco, è l'**origine
mobile** (per ogni gara `i`, calibra su tutte le gare `< i`): mantiene la proprietà di
sovrainsieme e fa crescere la calibrazione. **Non lo adotto oggi** perché cambia molto più
codice e questo giro deve restare piccolo e verificabile.

---

## 3. IL CRITERIO DI GIUDIZIO — questo è il cuore

> **La partizione nuova si giudica sulla sua STABILITÀ, NON sul fatto che accenda o spenga
> qualcosa.**

Lo dichiaro nel modo più esplicito possibile, perché è la sola cosa che separa questo lavoro
dal barare:

- **NON ci interessa se il traffico si accende con la partizione nuova.**
- **NON ci interessa se il degrado si accende con la partizione nuova.**
- Ci interessa **una cosa sola**: che il verdetto sia **stabile** quando il fondo cambia di
  una gara.

Se giudicassimo sull'accensione, staremmo **scegliendo il metro per il risultato**. Vietato.

### Le due condizioni di stabilità, dichiarate PRIMA

**S1 — nessun ribaltamento (categorica).** Nel leave-one-race-out, il numero di gare che
tolte da sole ribaltano `ACCENDIBILE` dev'essere **ZERO**.
Riferimento misurato del pari/dispari: **5 su 10**.
*Ragione*: la malattia è esattamente «il verdetto si ribalta per come tagli». Zero
ribaltamenti = guarita. Un solo ribaltamento = non guarita. Il criterio conta i
ribaltamenti **in entrambe le direzioni**: è indifferente a quale verdetto esca.

**S2 — escursione contenuta (quantitativa).** Nel leave-one-race-out, la massima escursione
della statistica appaiata dev'essere **≤ 50 % dell'ampiezza dell'IC95 a campione pieno**.
*Ragione*: l'ampiezza dell'IC95 è l'incertezza che il modello **già dichiara e accetta**. Se
togliere **un solo blocco** sposta la stima di più di metà di quell'intervallo, allora l'IC95
non sta descrivendo l'incertezza vera, e il verdetto è un artefatto del campione. La soglia è
ancorata a una grandezza che il modello produce da sé, non a un numero inventato.

**Servono ENTRAMBE.** Se S1 o S2 falliscono, **la partizione temporale NON viene adottata**:
resta `v1` (pari/dispari), il difetto resta a referto, e si riporta il fallimento. Un esito
negativo qui è un esito valido.

---

## 4. LA TRAPPOLA, dichiarata prima di cadere dentro

Col pari/dispari, il traffico a 10 gare è **peggio del non-fare-niente** (appaiato −0,057).

> **Se con la partizione temporale il traffico "batte" il non-fare-niente e diventa
> accendibile, la risposta corretta NON è accenderlo.** Ho cambiato il metro e il risultato è
> migliorato: è il pattern d'allarme numero uno del progetto.

In quel caso: **mi fermo, riporto il fatto, e la decisione va al tavolo umano.** Un modello
che si accende **solo dopo** che è stato cambiato il metodo va guardato in faccia, non acceso
in automatico.

Se resta spento: nessun problema, è l'esito atteso, e non è un argomento a favore né contro
la partizione — perché la partizione **non si giudica sull'accensione** (§3).

---

## 5. Versionare, non sovrascrivere

La regola vecchia **non si cancella**. Vive in `ai_lab/scienziato/partizione.py` come
**`v1_pari_dispari`**, con scritta accanto la ragione del pensionamento e la misura del
difetto. Serve a due cose:

1. i risultati **nati sotto v1** restano interpretabili — chi rilegge un vecchio
   `esito_*.json` sa quale regola li ha prodotti;
2. il confronto v1-contro-v2 di §3 è eseguibile da chiunque, non è una mia asserzione.

**Ogni verdetto porta la targhetta del metodo**: il json del modello scrive quale partizione
l'ha prodotto (`partizione: {versione, T*, n_cal, n_ver}`), esattamente come già porta quante
gare aveva sotto. Un cancello senza il nome della sua partizione non è confrontabile con un
altro.

---

## 6. Perimetro e vincoli

- Si tocca **il cancello di accensione dei modelli vivi** (`modello_traffico.py`,
  `modello_degrado.py`) e si crea **il punto condiviso** che oggi non esiste: lo split è
  duplicato in 14 posti, e i due cancelli lo copiano a mano.
- **NON si toccano gli script di studio** (`run_*.py`): i loro risultati sono già a referto
  sotto v1, e cambiarli sotto i piedi renderebbe irrileggibili i rapporti già scritti.
- **NON si toccano i null sigillati** — `scheletro.bootstrap_a_blocchi` e
  `scheletro.cosa_so_fare` restano intatti; `scheletro.fuori_campione` (che pure usa
  pari/dispari) **non è in perimetro**: è dello scheletro-studio, non del cancello.
- **NON si tocca il kernel**: il cancello non entra nel calcolo del motore, quindi il golden
  deve restare **449/449, 11 casi, 3/3, 3/3** — se si muove, ho sbagliato perimetro.
- Solo il fondo senza riverifica · blocchi = gare · ogni valore col suo generatore · se nasce
  un null nuovo **non lo auto-sigillo** · **il merge lo fa Tommi**.
