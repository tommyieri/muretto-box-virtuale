# PIANO DI CORREZIONE — da cosa hanno trovato i 21 agenti

*01/08/2026. Ordinato per rapporto fra effetto misurato e costo. Ogni voce nasce da una
CIFRA, non da un'intuizione: dove il numero non c'è, è scritto che non c'è.*

Referto completo: `REFERTO_confronto_motori.md`. Pre-registrazioni: `PREREG_confronto_motori.md`
(il confronto) e `PREREG_holdout_Olanda.md` (il primo fuori campione vero).

---

## Il punto di partenza, in tre righe

Il motore nuovo **vince su M1 e basta**: esatti 45,3% contro 43,0% nella lettura più severa,
mediana dell'errore **pari**, margine di **5 casi su 223** con IC95 che contiene lo zero.
M2/M3/M4 hanno cancelli falliti ma metri che non discriminano. M5 era rotto e ora è a posto.

E il metro stesso era debole: **4 metriche su 5 sotto-specificate**. Tre cancelli non hanno
deciso niente. Questa è la cosa più importante che il confronto ha insegnato.

---

## FATTO in questo giro

| | cosa | effetto MISURATO |
|---|---|---|
| **B** | la banda smette di calibrarsi sul futuro e sul campo del motore | copertura sul metro del prodotto **67,3% → 81,2%**; in pagina non c'è più un 88,5% falso |
| **C** | la curva monta la mescola che il regolamento permette | curve piene **7.453 → 10.131** su 10.131; **0 posizioni cambiate** |
| **D** | la bandiera rossa arriva al prezzo della sosta (`RED = 0,0`, dichiarato e mai raggiunto) | esatti sui casi sotto rossa **4/25 → 12/25**; su tutti i casi **37,7% → 40,8%** |
| **F** | la hero gira sul motore della pagina-gara | stessa domanda → stessa risposta (P1 su 20, dietro ANT); «aspetta 3 giri» P4→**P6**, come la pagina |
| **K.1** | il selettore mescola diventa informazione | era **rotto E inerte**: la pagina ascoltava `data-mesc`, il pannello emette `data-valore` |
| **A** | sigillato il primo fuori campione vero | `PREREG_holdout_Olanda.md`, soglie assolute scritte il 01/08 per una gara del 23/08 |

**Correzione al piano degli agenti su A:** proponevano di mettere in pausa `autocalibra.py`.
Quel file **non esiste più** (tolto nella ripulitura) e i modelli del simulatore sono pinnati
in `data/MANIFEST.sha256`, verificato in CI. Il rischio non è automatico: è umano.

---

## APERTO, in ordine di priorità

### 1 · Il rodaggio della gomma nuova — `w(età) = −c·exp(−età/τ)`
**Perché, misurato:** in aria libera i giri a età 2-8 dopo una sosta girano **0,275 s/giro più
veloci** di quanto il modello preveda (IC95 [−0,415; −0,037], n = 1.249, mediana negativa in
8 gare su 10); a età 9-20 il residuo è 0,000. È la regione che il prodotto usa di più: ogni
«se fermo adesso» proietta un pilota che riparte da età 1 contro rivali a età alta. Sette giri
× 0,275 s ≈ **1,9 s**, l'ordine di grandezza di una posizione — ed è coerente col bias di
**+0,96 posizioni** del motore nuovo (mette il pilota più indietro del vero nel 49,8% dei casi
contro il 9,9% in cui lo mette più avanti).

**È anche la strada per D1**, che oggi è rosso: la banda sotto neutralizzazione non arriva
all'80% e **allargarla non è la risposta** — togliere il bias dalla previsione sì.

- **File:** `simulatore/engine/passo_v2.mjs` — `creaPasso` **e** `stimaBasi`. Lo stesso `w` va
  sottratto misurando e ri-aggiunto simulando, **nella stessa modifica**, o è il difetto del
  carburante daccapo (E02, −1,48 s/giro). `c` e `τ` in `modello_v2.json` con targhetta.
- **Cancello, da scrivere PRIMA:** M1 in lettura B2 — mediana ≤ 1,0 **ed** esatti ≥ 45,3%;
  **più** una condizione sul segno: la quota «troppo indietro» deve scendere dal 49,8% e il
  bias medio da +0,96 verso 0. Leave-one-race-out su (c, τ).
- **Rischio dichiarato:** con τ troppo grande il termine degenera in un vantaggio
  quasi-perpetuo dopo la sosta, cioè **E01**: «fermati subito» nel 100% dei casi. Serve la
  sentinella analitica che l'ottimo a una sosta resti a `(giri rimasti − età)/2`.
- **Nota:** M2 è un giudice debole qui (in una finestra senza soste tutte le età avanzano
  insieme e `w` si cancella nel distacco). **Il giudice è M1.**

### 2 · Il pacchetto neutralizzazione — quattro voci, un solo cluster
**Perché:** è dove **quattro metriche su cinque** puntano il dito, ed è l'unico ramo in cui il
motore nuovo **perde** contro il vecchio (n = 17, esatti 35,3% contro 41,2%). Va fatto insieme
o non va fatto.

1. **Slegare il regime dalle soste.** `costruttore.mjs` ha
   `const regime = soste.length ? … : null`: il meccanismo di neutralizzazione è **inerte in
   proiezione pura**. Sotto regime il bias del nuovo è **1,964 s/giro** contro 0,033 in verde.
   Controfattuale misurato: bias 1,068 → 0,699 (3 giri), 0,623 → 0,333 (5), 0,303 → 0,055 (10),
   migliora in 7 gare su 8; sui congelamenti verdi il risultato è **bit-identico**.
2. **`PERSISTENZA_REGIME_GIRI` misurata e distinta.** Vale 1 per entrambi i regimi e non ha
   targhetta. Misurato: dato SC al giro L, il regime è ancora in corso al **72%** a L+2 e al
   58% a L+3 (mediana 3 giri); dato VSC, al 41% a L+2 (mediana 1). **È giusta per il VSC e
   sbagliata per la SC di un fattore 3.**
3. **Il fattore di neutralizzazione, misurato in casa.** Oggi è un prior esterno (SC 0,50,
   VSC 0,65) mai validato sul fondo, mentre la parte verde è già promossa su 26 GP. Misurato
   dai soli `cum_time`: **SC 0,758, VSC 0,867** — entrambi sopra la banda dichiarata, cioè il
   motore **sotto-addebita** la sosta neutralizzata. Il controllo valida il metodo: in verde il
   fattore realizzato è 0,958. Il dato esiste ed è buttato via (`soste_fondo.json` scarta 1.597
   soste non verdi).
4. **Le soste dei rivali sotto SC.** L'assunzione `stint !== 1` ferma 148 rivali e ne azzecca
   25 (**16,9%**), e **a Monaco ne assume zero** mentre 360 rivali entrano davvero.
   Spegnendola: esatti 27,5% → 35,3% sui casi con regime, ma il bias medio *peggiora*
   (+1,16 → +1,37). **Le due letture non concordano: il cancello va scritto prima.**

- **Cancello del pacchetto:** M2 ristretto ai congelamenti con regime (n = 291/266/191),
  dichiarando prima se decide il bias o l'errore assoluto; **più una sentinella di non-danno
  sui congelamenti verdi, che deve restare identica al bit**; poi M5 sui 180 casi con regime.
- **Da NON credere:** questo **non** risolve M5. Dei casi fuori banda, 70 su 84 partono in
  verde e finiscono neutralizzati: lì il regime non è conoscibile e nessun fattore li recupera.
- **Il tranello, da mettere nella prereg:** la regola ovvia («guarda il campo al giro L»)
  recupera 36 casi e porta la banda dal 37,1% al 91,4%. **È futuro d'orologio:** delle celle di
  chi ha già chiuso il giro L prima di me, **0 su 265** sono neutralizzate; di chi lo chiude
  dopo, **402 su 713**. La versione causale onesta (`cum_time <= il mio`) accende 9 casi, di cui
  2 sbagliati. Va scritto che «indice di giro ≤ L» **non è** la definizione di informazione
  ammessa, o il prossimo vedrà il +54 di copertura e lo accenderà.

### 3 · D1 sotto neutralizzazione: decidere, non aggiustare **[decisione del PO]**
Oggi **rosso**: 77,4% contro l'80% pre-registrato. Con l'informazione disponibile al
congelamento quel livello **non è raggiungibile**, e le due scorciatoie sono già state provate
e misurate:
- banda **asimmetrica a due gradi di libertà** (larghezza minima): **peggiora**, 77,4% → 58,3%
  fuori campione. Con 84 casi sovradatta. *Resta scritto in `banco/misure/difesa.mjs` perché il
  prossimo che legge D4 rosso avrà la stessa idea in cinque secondi.*
- banda **traslata del bias** (un grado): regge, ed è quella in produzione.

Le tre strade, tutte legittime: (a) ri-registrare il livello per NEUTRA sul misurato,
dichiarando che 0,8 non è attingibile; (b) non pubblicare banda sotto neutralizzazione;
(c) aspettare la voce 1, che è l'unica che può spostare il numero davvero.
**Ri-registrare adesso, dopo aver visto il risultato, sarebbe E08** — per questo la voce è
qui e non è stata eseguita.

### 4 · `MIN_GIRI_BASE` da 8 a 4, e dichiarare il «non ancora»
**Perché:** la soglia nasce come criterio di **ammissione del banco** ed è migrata nel motore
come costante muta, cablata in 5 punti. Come soglia di qualità non regge: una base su 4-7 giri
sbaglia **0,314 s/giro** contro **0,386** delle basi su 8+ giri, e per secchio l'errore non è
ordinato dal numero di giri.
- **Effetto misurato:** base disponibile 89,8% → 98,7% (**+1.012 caselle**); congelamenti ai
  giri 5-7 da 0,0% (per costruzione) a 73-88%; soste vere 260/274 → 272/274.
- **File:** `simulatore/scenario/costruttore.mjs`, poi `trasporta_motore.mjs` e
  `genera_vista_gara.mjs`. A parte: lasciare fermo `min_giri_base` in `banco/prereg/` e
  ri-etichettarlo — è un criterio del banco, non del motore.
- **Cancello, da scrivere PRIMA:** (a) la copertura sale; (b) gli esatti sulle 260 risposte
  preesistenti non calano di più di 2 punti; (c) lo scarto appaiato dell'errore di base fra
  4-7 e 8+ ha IC95 che contiene lo zero. *Oggi: +1.012 · −1,1 punti · verificato.*
- **Rischio:** non è additivo — il campo cresce in 15 casi su 260 e la posizione già pubblicata
  cambia in 7 (2 migliorano, 3 peggiorano). E la qualità delle risposte **nuove** non è
  certificata (n = 12 con verità). **4 è un pavimento:** sotto i 4 giri il degrado c'è ed è
  misurato.
- **Poi, non prima:** sostituire il pannello muto con «servono k giri verdi, ne hai j — la
  prima risposta è al giro N». Farlo *al posto* dell'abbassamento è un cartello educato davanti
  a 1.012 caselle che potevano essere piene.

### 5 · Il pavimento di rumore della curva del «quando»
**Perché:** sulle viste pubblicate **4.241 raccomandazioni** (56,9% delle curve) hanno un
minimo interno, e il guadagno promesso è **sotto 1 s nel 29,0%** dei casi e sotto 3,3 s nel
55,4% — mentre l'unico errore mai misurato di questo motore vale ~3,2 s cumulati a 10 giri, e
la curva integra fino alla bandiera (58 giri). Il solo arrotondamento al millesimo sposta il
giro raccomandato in **25 curve su 260**.
- **Cosa:** un banco che ricalcola la curva perturbando **dentro l'incertezza che il modello
  dichiara di sé** (ρ e δ₇₀ agli estremi dell'IC95, pit-loss agli estremi già stampati in
  targhetta, fattore SC/VSC nella banda, L±1) e riporta la dispersione del giro raccomandato.
- **Cancello, da scrivere prima:** il giro si pubblica come **giro secco** solo se sotto ogni
  perturbazione si sposta di ≤ 2 giri nell'≥ 80% dei casi; altrove si pubblica una **finestra**.
  **[decisione del PO: giro secco o finestra?]**
- **Sonda obbligatoria:** con perturbazione nulla il banco deve riprodurre i 4.241 minimi
  interni e la mediana di 2,770 s. Se non li riproduce, non sta misurando il prodotto.
- **Perché adesso:** la voce C (già fatta) ha **moltiplicato per quattro** le curve pubblicate.
  Se sono rumore, le ha moltiplicate lo stesso.

### 6 · L'errore alla bandiera, contro `data/arrivi_2026.csv`
**Perché:** quel file contiene la classifica finale vera di tutte le 241 coppie pilota-gara e
ha **zero riferimenti in tutto il repo**. Nessuno l'ha mai usato. Intanto M1 misura a **2 giri**
dal congelamento e M2 si ferma a 10, mentre la curva integra fino a ~58: **fra i 10 giri
misurati e la bandiera non c'è nessuna misura.** E c'è motivo di aspettarsi che lì il confronto
cambi — nell'ultimo terzo di gara il nuovo passa M2 su tutti e tre gli orizzonti.
- **Da pre-registrare:** solo 114 delle 241 coppie hanno una cella al giro finale; la regola per
  doppiati (45) e ritirati (41) va fissata prima. Usare le soste reali di tutti è informazione
  dal futuro — legittima perché identica per i due motori, ma va etichettata a caratteri cubitali.
- **Costo: grande.** È l'unico modo di sapere se «vince il nuovo» vale oltre due giri.

### 7 · Igiene del banco — nessun numero visibile, ma protegge le prossime misure
- **`ai_lab/confronto/banco.mjs`:** `giro_di_rientro` è cablato a `caso.rientroLap` e non segue
  le opzioni — **mente** appena si varia l'orizzonte, cioè sul percorso di chi misura M2/M3.
- **Esporre la ri-classificazione sulla popolazione comune** come funzione del banco: oggi due
  misure indipendenti dello stesso M1 possono divergere di 6 punti senza che nessuna sbagli.
- **Escludere la neutralizzazione dalla finestra pulita** quando si misura la qualità della
  base: 502 finestre su 5.186 fabbricano tutta la coda (p90 da 4,600 a 0,839 s/giro).
- **Chiudere E21 con una cifra:** la pendenza residua sul giro implica δ₇₀ = 3,08 su tutti i
  giri verdi e **2,43 in aria libera** (IC che contiene lo zero) — il conflitto 3,11 contro 2,2
  è **contaminazione da traffico, non evoluzione della pista**. *Non spostare il valore cablato:
  i dati non lo chiedono.* Stessa cosa per ρ (0,0359 in aria libera, IC della correzione
  contiene lo zero → **non si tocca**).
- **Ri-baselinare le linee di regressione di `s15`** (87,4% / 67,7% / 94,3%): sono state
  misurate col metro vecchio, quello che leggeva il futuro. Confrontare la misura onesta con una
  baseline disonesta non significa niente — **e si fa con una prereg nuova, non con un edit.**

### PARCHEGGIATA · il traffico come penalità sul passo
Il fenomeno è il più regolare trovato (residuo **+0,576 s/giro** sotto 0,5 s di gap, positivo
in 11 gare su 11, riguarda il 19,6% dei giri), **ma il controfattuale sul bersaglio è
negativo**: leave-one-race-out il bias peggiora su tutti e tre gli orizzonti e il confronto
appaiato è 53%. Il cancello M2 non passerebbe. Resta difendibile solo la de-contaminazione
della **base** (il 17,3% dei casi ha la base sporca di oltre 0,25 s/giro), e solo con un
cancello M1 pre-registrato — accettando che rompe deliberatamente la simmetria
misura/predizione, cosa da dichiarare e non da nascondere in una riga di stimatore.

---

## Difetti MIEI, in questo giro, a referto

1. **Ho rotto la generazione delle viste** con la correzione della bandiera rossa: per `RED`
   non esiste una banda di neutralizzazione dichiarata, e `curvaDelQuando` la leggeva senza
   guardia. La generazione è morta a Monaco lasciando **8 gare nuove e 3 vecchie** — e a
   prenderlo è stata `s27`, la sentinella che avevo scritto due giorni prima per il bug del
   manifest. Corretto: dove il regime non ha una banda dichiarata la banda **non si disegna** e
   la nota dice perché (per la rossa il fattore è 0 per dichiarazione, non per stima).
2. **Il mio primo tentativo di verificare M3 era storto:** confrontavo i costi a fine finestre
   di lunghezza diversa, e una finestra più lunga è sempre più cara — quindi «vinceva» sempre il
   primo giro. Si misura a **giro finale comune**. Rifatto, l'agente aveva ragione e io no.
3. **Ho misurato la copertura della banda con tre convenzioni diverse** (46,6% · 73,9% · 81,2%)
   prima di accorgermi che il denominatore *era* il problema. Il numero pubblicato è quello
   dello script validato, con la convenzione dichiarata.

---

## Cosa resta ignoto — e non si chiude lavorando di più

1. **Il fuori campione, cioè tutto.** `modello_v2.json`, `banda_rientro.json` e il pit-loss
   «realizzato» di Gran Bretagna e Miami sono tarati sulle stesse 11 gare del banco. Il
   leave-one-race-out resta dentro quelle 11. **Nessun numero di questo confronto è mai stato
   prodotto fuori campione.** Prima occasione: **23 agosto**.
2. **L'orizzonte che il prodotto usa davvero.** Misurato: 2 giri (M1) e 10 (M2). Pubblicato:
   fino alla bandiera (~58). Il verdetto «vince il nuovo» poggia su 5 casi su 223 a due giri.
3. **Il ramo Safety Car:** n = 17, e lì il vecchio è davanti. Indicativo, non concludente.
4. **I 70 casi su 209 che partono in verde e finiscono neutralizzati.** Copertura della banda
   lì: 32,9% contro 84,2%. Un terzo del campione che nessun modello può vincere con
   l'informazione ammessa.
5. **Il rifiuto del Director:** zero occorrenze in tutta la vista (0 su 11.290). Il ramo esiste,
   è nel cancello M4, e non è mai stato esercitato su dati veri.
6. **Monaco** entra nel confronto al 21% della sua taglia (10 casi su 47), perché il vecchio è
   muto in 35. Qualunque numero pooled è una statistica su dieci gare e mezza.
7. **Se il vecchio in produzione fosse davvero peggiore.** Il suo vantaggio apparente (46,6%
   contro 43,9%) **si compra con un solo giro di informazione dal futuro**: legge `neutralized`
   al giro della sosta e assume 669 soste-rivali non conoscibili al congelamento. Non sappiamo
   quanto varrebbe un motore che quel giro non lo avesse — non esiste.
