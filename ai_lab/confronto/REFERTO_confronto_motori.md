# REFERTO — il motore nuovo risponde meglio del vecchio?

*01/08/2026. Confronto pre-registrato su 274 soste vere delle 11 gare 2026.*

21 agenti: un banco condiviso, due collaudi che hanno cercato di romperlo (18 rilievi),
cinque metriche (M1 misurata due volte in modo indipendente), una verifica adversariale per
ognuna, cinque lenti di miglioria, una sintesi.

# CONFRONTO MOTORI — referto per il proprietario

## 1. IL VERDETTO

**Il motore nuovo risponde meglio, ma di poco e su una metrica sola: vince M1 (errore di posizione), pareggia M2/M3/M4 dove i cancelli non passano ma il metro non discrimina, e FALLISCE M5 — la banda che il sito pubblica come "copre l'88,5%" copre in realtà il 67,3%.**

Dove perde, detto subito:
- **M5 cade, e non è un pareggio**: 67,3% contro l'80% pre-registrato. È l'unico numero di questo confronto già stampato in produzione, su 10.131 pannelli, ed è falso.
- **Sotto Safety Car/VSC al congelamento il vecchio è davanti** (n=17, esatti 41,2% contro 35,3%): è l'unico ramo di fisica in cui il nuovo perde, ed è proprio quello in cui dichiara di essere migliore.
- **M3 come lo serve il sito è un fallimento di prodotto**: la curva del "quando" esce vuota nel 26,4% dei pannelli, e non per colpa della fisica ma della gomma che il sito le passa.
- **M2**: il nuovo sta dalla parte peggiore in 10 celle su 12. Il cancello non passa.
- Il margine di M1, tolto l'artefatto del denominatore, è di **5 casi su 223** e il suo intervallo di confidenza a blocchi=gare contiene lo zero.

E una cosa che vale quanto il verdetto: **la pre-registrazione era sotto-specificata in 4 metriche su 5** (M1 non diceva su quale popolazione calcolare l'errore, M2 non dichiarava riferimento/grandezza/finestra, M3 giudicava contro una configurazione del vecchio in pensione dal 28/07, M4 aveva n=12 e p≥0,51). I cancelli sono stati onorati alla lettera, ma tre di essi non hanno deciso niente.

---

## 2. I NUMERI

| metrica | VECCHIO | NUOVO | cancello |
|---|---|---|---|
| **M1** posizione al rientro, lettura A (`pos` grezzo, n=223) | mediana 1,0 · esatti **31,8%** · media\|e\| 1,66 | mediana 1,0 · esatti **40,4%** · media\|e\| 1,28 | **PASSA** |
| **M1** lettura B2 (popolazione comune, n=223) | mediana 1,0 · esatti **43,0%** · media\|e\| 1,10 | mediana 1,0 · esatti **45,3%** · media\|e\| 1,03 | **PASSA** (margine 5 casi; IC95 [−0,9; +5,5] contiene lo zero) |
| **M2** \|bias\| distacco 3 giri (s/giro) | **0,002** | 0,051 | **FALLITO** |
| **M2** 5 giri | **0,007** | 0,057 | **FALLITO** |
| **M2** 10 giri | 0,082 | **0,040** | ok |
| **M3** minimo interno della curva | 0/235 (fantoccio `passo=null`) · **181/235 = 77,0%** (produzione, passo v2) | **35,8%** delle curve / 12,8% dei casi (convenzione del sito) · 68,1% con mescola legale | **FALLITO** come serve il sito |
| **M4** copertura | 235/274 (85,8%) | **260/274 (94,9%)** | — |
| **M4** accuratezza dei 12 casi persi | persi 33,3% / 50,0% esatti contro media 31,8% / 42,2% | — | **FALLITO** (i persi erano *migliori*, non peggiori) — ma n=12, p=0,51÷0,76: senza potenza |
| **M5** copertura della banda | non ha banda | **175/260 = 67,3%** (63,9% coi muti) | **FALLITO** (soglia 80%; dichiarato 88,5%) |

Perimetro: 274 soste vere ammesse su 459, 11 gare. Muti: vecchio 39, nuovo 14, entrambi 2 → 223 casi appaiati. Ogni cifra è stata riprodotta da una seconda misura indipendente che non importava il codice della prima.

---

## 3. LE SORPRESE

**1. Tre quarti del vantaggio del nuovo su M1 sono il denominatore, non la fisica.** I due motori classificano dentro campi diversi: al vecchio manca il passo di ~3 auto (ampiezza mediana 17 contro 20), quasi tutte davanti. Misura diretta: lo *stesso* motore vecchio ha bias +0,099 in lettura A e +1,009 in lettura B. La sua apparente imparzialità è la cancellazione fra due errori. Il saldo passa da +8,5 a +2,3 punti.

**2. Il motore nuovo ha corretto un difetto grave che non tocca la risposta.** Sul tempo assoluto il nuovo sbaglia −0,018 s/giro e il vecchio −1,955 (è il carburante sottratto misurando e mai ri-aggiunto simulando, già a catalogo). Un fattore 100. Ma sul **distacco** — la grandezza da cui dipende la posizione — la deriva è comune al campo e si cancella. Il prodotto risponde "dove rientri", non "a che ora".

**3. Il cancello M3 giudicava contro un fantoccio, e il vecchio vero vince.** Il "0 su 249" è misurato su una configurazione (`passo=null`) che il pannello ha abbandonato il 28/07: quelle curve sono *esattamente piatte* (ampiezza massima 1,8e-12 s), e l'argmin trasformava rumore di virgola mobile in un giro. Il vecchio in produzione fa 77,0% di minimi interni contro il 68,1% del nuovo. E allineando la convenzione del giro di sosta (i due motori intendono cose diverse con lo stesso intero, sfasate di un giro), il minimo coincide nell'85,2% dei casi e il vantaggio del nuovo cambia segno: 81,2% contro 79,4%.

**4. Il vecchio "in produzione" batteva il nuovo, ma con informazione dal futuro.** Non troncato, il vecchio fa 46,6% di esatti contro 43,9%. Tutto quel vantaggio si compra con **un solo giro**: legge `neutralized` al giro della sosta e assume 669 soste-rivali che al congelamento non sono conoscibili. 70 delle 84 neutralizzazioni cominciano *dopo* il congelamento. Il confronto troncato è quello onesto.

**5. Il +25 di copertura del nuovo è una gara sola, e sono celle che non sono soste.** 33 dei 37 casi guadagnati sono Monaco ai giri 65-68, dove 16 auto entrano in pit-lane *nello stesso giro* sotto bandiera rossa (status '451', un giro da 2129 s). Togliendo quelle firme il saldo di copertura passa da +25 a **+1**. A blocchi, il vecchio copre di più in 5 gare su 11.

**6. La copertura in più del nuovo è fatta delle sue risposte peggiori** (21,6% di esatti contro 40,4%, p=0,011), e il silenzio del nuovo cade dove il vecchio valeva meno (25,0% contro 46,6%, p=0,011). I due buchi sono complementari e strutturali: il nuovo pretende 8 giri verdi cumulati, il vecchio 3 giri verdi *nello stint corrente*.

**7. La banda non è stretta: è spostata.** Degli 85 casi fuori banda, 77 (90,6%) mancano dallo stesso lato — la posizione vera è *migliore* del bordo alto. Il file dichiara `bias_mediano = 0`, il misurato è +1. Una banda asimmetrica (−3, +0) coprirebbe l'83,3% con larghezza 3,89, cioè **più copertura e meno larghezza** dell'attuale ±2 simmetrico (78,5% con 4,76).

**8. Il divario 88,5% → 67,3% si scompone senza residuo** (+2,3 popolazione, +7,7 predittore, +6,9 contesto, +3,0 perimetro): la banda è calibrata attorno a un predittore che conosce il regime *della sosta*, mentre il prodotto conosce solo quello del *congelamento*. E il guasto è localizzato: dove il regime è già in pista la copertura è 80,0%; dove la SC esce al giro della sosta è 38,8%.

**9. La bandiera rossa non è mai onorata.** Il prior dichiara `RED = 0,0` e nessun ramo del codice ci arriva: `regimeAlCongelamento` cerca il '4' e non guarda mai il '5'. Sui 9 casi interessati la correzione porta gli esatti da 1/9 a 9/9 — sotto sospensione le auto incolonnano e l'ordine si conserva, quindi perdita zero è la risposta esatta.

**10. Il selettore mescola non è "inerte": è scollegato.** `gara.html` cerca `data-mesc`, il pannello nuovo emette `data-valore`. L'evento non arriva mai — non cambia nemmeno l'evidenziazione del bottone. E se lo si collegasse la posizione non si muoverebbe comunque: mescola diversa in 4.943 casi, posizione cambiata in **0**.

**11. La home e la pagina-gara nominano rivali diversi.** Stessa domanda (Belgio, LEC, giro 20): la hero dice P1 su 10 e "dietro PIA", la pagina dice P1 su 20 e "dietro VER". La hero non vede 10 vetture su 20 (Verstappen compreso) perché filtra su un passo legacy che al giro 20 manca a metà griglia. E usano due pit-loss diversi sulla stessa gara: 23,36 s contro 18,40 s.

**12. Un difetto di referto da correggere**: le p riportate su M1a (0,094 · 0,040 · 0,36 · 0,11) sono a una coda e non lo dicevano. A due code: 0,188 · 0,081 · 0,727 · 0,219. Il "p=0,040" della lettura B non è sotto 0,05.

---

## 4. IL PIANO

Ordinato per rapporto fra effetto misurato e costo. **[PO]** = decisione del proprietario, non scelta tecnica.

### A — Sigillare il fuori campione prima del 23 agosto **[PO, e scade]**
L'Olanda (round 12, Zandvoort, 23/08) è l'unica gara mai usata per costruire nulla. Ogni pezzo del nuovo è tarato sulle stesse 11 gare del banco. `autocalibra.py` ricalibra da solo dopo ogni gara: **se l'Olanda entra nella calibrazione prima della misura, il fuori campione si distrugge in silenzio.**
- **Cosa**: scrivere e sigillare oggi `ai_lab/confronto/PREREG_holdout_Olanda.md` (perimetro, motori, letture, cancelli con soglie numeriche scritte prima), e mettere in pausa la ricalibrazione o fotografare lo stato pre-gara.
- **File**: nuovo file di prereg + pausa su `autocalibra.py`.
- **Cancello**: prima di misurare, gli `sha256_vista` di `modello_v2.json` e `banda_rientro.json` devono essere quelli pre-Olanda. Se sono cambiati: NON GIUDICABILE, e si dice.
- **Costo**: quasi zero (la macchina esiste). Una gara non decide da sola — va scritto nel prereg che entra in una serie.

### B — Togliere l'88,5% dalla pagina **[PO]**
È un numero misurabilmente falso su 10.131 pannelli. La correzione della targhetta non cambia una sola previsione: cambia ciò che il sito promette.
- **Cosa**: sostituire `copertura_fuori_campione: 0.8852` con la cifra misurata col metro del prodotto, e spaccarla invece di mediarla: «l'80,0% quando il regime al giro della sosta è già quello che vedi adesso, il 38,8% quando la neutralizzazione esce dopo».
- **File**: `simulatore/data/modelli/banda_rientro.json` (targhetta, `circuiti_sotto_livello` — oggi indica Belgio e Spagna mentre i peggiori sono Canada 14,3%, Australia 26,3%, Cina 30,0%).
- **Numero**: 88,5% → 67,3%.
- **Cancello**: nessun numero stampato in pagina proviene da un file la cui targhetta non sia stata rimisurata con la convenzione del prodotto.
- **Da NON fare**: allargare la banda per far tornare il numero.
- **Decisione del proprietario**: è una promessa pubblica che scende di 21 punti.

### C — La mescola legale nella curva del "quando"
Il sito passa a `curvaDelQuando` la gomma che il pilota ha su; rimontarla lascia una sola slick alla bandiera e il Director boccia — correttamente — con REG01. Risultato: 2.678 pannelli su 10.131 (26,4%) mostrano «nessun giro candidato ha superato il Director».
- **Cosa**: passare la mescola scelta da `mescolePerSoste(1, slick già usate)` — regola già scritta nel repo — invece di `mescolaAlGiro`.
- **File**: `simulatore/scenario/risposta.mjs:76` (e :55 per coerenza), poi rigenerare la vista.
- **Numero**: curve piene 7.453 → 10.131 su 10.131; minimi interni 35,8% → 68,1%.
- **Cancello**: con la convenzione attuale la misura deve riprodurre la vista pubblicata (7.453/2.678); con la nuova, 0 vuote; **e "posizione cambiata" deve restare 0** (misurato: 0 su 4.943).
- **Caveat**: `mescolePerSoste` è una regola scelta, non una misura, e va dichiarata in pagina. E prima di *evidenziare* un giro come "il migliore" serve il punto I (rumore della curva).

### D — Onorare la bandiera rossa
`regimeAlCongelamento` cerca il '4' e non guarda mai il '5'. Il prior dichiara già `RED = 0,0` e `perditaBox` lo accetterebbe senza modifiche.
- **File**: `simulatore/scenario/costruttore.mjs:35`, `simulatore/provenienza/definizioni.mjs`.
- **Numero**: sui 9 casi interessati, esatti 1/9 → 9/9, banda 4/9 → 9/9; sul perimetro intero esatti 40,8% → 43,8%.
- **Cancello**: nessun caso oggi corretto deve peggiorare.
- **Caveat onesto**: tutti e 9 sono a Monaco, ed è probabile che quelle celle non siano soste di strategia. La correzione resta giusta di per sé (oggi il motore dà un numero sbagliato sotto sospensione), ma il guadagno sul banco è in parte guadagno su casi che forse vanno esclusi dal banco. **[PO: quelle celle restano nel perimetro?]**

### E — Abbassare `MIN_GIRI_BASE` da 8 a 4, e dichiarare il "non ancora"
La soglia nasce come criterio di *ammissione del banco* ed è migrata nel motore come costante muta, cablata in 5 punti. Come soglia di qualità non regge: base su 4-7 giri sbaglia 0,314 s/giro contro 0,386 delle basi su 8+, e per secchio l'errore non è ordinato dal numero di giri.
- **File**: `simulatore/scenario/costruttore.mjs:31`, poi `trasporta_motore.mjs` e `genera_vista_gara.mjs`. Separatamente: lasciare fermo `min_giri_base` in `simulatore/banco/prereg/` e ri-etichettarlo.
- **Numero**: base disponibile 89,8% → 98,7% (+1.012 caselle); congelamenti ai giri 5-7 da 0,0% (per costruzione) a 73-88%; soste vere 260/274 → 272/274.
- **Cancello, da scrivere PRIMA**: (a) la copertura sale; (b) gli esatti sulle 260 risposte preesistenti non calano di più di 2 punti; (c) lo scarto appaiato dell'errore di base fra 4-7 e 8+ ha IC95 che contiene lo zero. Oggi: +1.012 · −1,1 punti · verificato.
- **Rischio dichiarato**: non è additivo — il campo cresce in 15/260 casi e la posizione già pubblicata cambia in 7 (2 migliorano, 3 peggiorano). E la qualità delle risposte *nuove* non è certificata (n=12 con verità). 4 è un pavimento: sotto i 4 giri il degrado c'è ed è misurato.
- **Poi, non prima**: sostituire il pannello vuoto con «servono k giri verdi, ne hai j — la prima risposta è al giro N». Fatto al posto dell'abbassamento invece che dopo, è un cartello educato davanti a 1.012 caselle che potevano essere piene.

### F — La hero sul motore della pagina-gara
Home e pagina a un click di distanza si contraddicono su posizione, campo, rivale nominato e pit-loss.
- **File**: `gen_hero.mjs` (sostituire `evaluatePit` con `doveRientri`, contesto come `genera_vista_gara.mjs`), `demo/hero.mjs:128,445` (stampare il denominatore).
- **Numero**: da «P1 su 10 / P4, perdi 3» a «P1 su 20 / P6, perdi 5, dietro VER».
- **Vincolo**: "BOX ORA" deve diventare `giroPit = congelamento+1` (il nuovo rifiuta una sosta nel passato), che è poi la convenzione della pagina-gara.
- **Cancello**: `hero.json` e `demo/data/vista/Belgio/LEC.json` devono dare la stessa posizione, lo stesso `su_quanti` e lo stesso rivale davanti.
- **Da dichiarare**: il caso scelto è sotto SC, cioè il ramo dove il nuovo è più debole (n=17, il vecchio davanti). Passarci sopra è difendibile perché è il motore del resto del sito, non perché sia il ramo forte.

### G — Il pacchetto neutralizzazione (quattro voci, un solo cluster)
È dove **quattro metriche su cinque** puntano il dito, ed è l'unico posto dove il nuovo perde contro il vecchio. Va fatto insieme o non va fatto.
1. **Slegare il regime dalle soste**: `costruttore.mjs:128` (`const regime = soste.length ? … : null`) rende il meccanismo di neutralizzazione **inerte in proiezione pura**. Sotto regime il bias del nuovo è 1,964 s/giro contro 0,033 in verde: è il peggiore dei tre motori proprio dove ha l'unico meccanismo che gli altri non hanno. Controfattuale misurato (distacchi congelati per P giri): bias 1,068 → 0,699 (3g), 0,623 → 0,333 (5g), 0,303 → 0,055 (10g), migliora in 7 gare su 8. Sui congelamenti verdi il risultato è **bit-identico**.
2. **`PERSISTENZA_REGIME_GIRI` misurata e distinta**: vale 1 per entrambi i regimi e non ha targhetta. Misurato: dato SC al giro L, il regime è ancora in corso al 72% a L+2 e al 58% a L+3 (mediana 3 giri); dato VSC, al 41% a L+2 (mediana 1). La costante è **giusta per il VSC e sbagliata per la SC di un fattore 3**.
3. **Il fattore di neutralizzazione misurato in casa**: oggi è un prior esterno (SC 0,50, VSC 0,65) mai validato sul fondo, mentre la parte verde è già stata promossa su 26 GP. Misurato dai soli `cum_time`: SC 0,758, VSC 0,867 — **entrambi sopra la banda dichiarata**, cioè il motore sotto-addebita la sosta neutralizzata. Il controllo valida il metodo: in verde il fattore realizzato è 0,958. Il dato per misurarlo esiste ed è buttato via (`soste_fondo.json` scarta 1.597 soste non verdi).
4. **Le soste dei rivali sotto SC**: l'assunzione `stint !== 1` ferma 148 rivali e ne azzecca 25 (16,9%), e **a Monaco ne assume zero** mentre 360 rivali entrano davvero. Spegnendola: esatti 27,5% → 35,3% sui casi con regime, ma il bias medio *peggiora* (+1,16 → +1,37) — le due letture non concordano, quindi il cancello va scritto prima.
- **Cancello del pacchetto**: M2 ristretto ai congelamenti con regime (n=291/266/191), dichiarando prima se decide il bias o il \|err\|; **più una sentinella di non-danno sui congelamenti verdi che deve restare identica al bit**; poi M5 sui 180 casi con regime coincidente.
- **Da NON credere**: questo non risolve M5. Dei casi che sbagliano, 70 su 84 partono in verde e finiscono neutralizzati: lì il regime non è conoscibile e nessun fattore, per quanto ben misurato, li recupera. Va scritto, altrimenti si spende una misura buona e si dichiara chiusa una voragine che resta aperta.
- **Il tranello**: la regola ovvia («guarda il campo al giro L») recupera 36 casi e porta la banda dal 37,1% al 91,4%. **È futuro d'orologio**: delle celle di chi ha già chiuso il giro L prima di me, 0 su 265 sono neutralizzate; di chi lo chiude dopo, 402 su 713. La versione causale onesta (`cum_time <= il mio`) accende 9 casi, di cui 2 sbagliati. Va messo nella pre-registrazione che «indice di giro ≤ L» **non è** la definizione di informazione ammessa, o il prossimo che misura questa idea vedrà il +54 di copertura e la accenderà.

### H — Il rodaggio della gomma nuova: w(età) = −c·exp(−età/τ)
In aria libera i giri a età 2-8 dopo una sosta girano **0,275 s/giro più veloci** di quanto il modello preveda (IC95 [−0,415; −0,037], n=1.249, mediana negativa in 8/10 gare), mentre a età 9-20 il residuo è 0,000. È la regione che il prodotto usa di più: ogni domanda "se fermo adesso" proietta un pilota che riparte da età 1 contro rivali a età alta. Sette giri × 0,275 s ≈ 1,9 s, l'ordine di grandezza di una posizione — ed è coerente col bias di +0,96 posizioni del nuovo.
- **File**: `simulatore/engine/passo_v2.mjs` (`creaPasso` **e** `stimaBasi`: lo stesso w va sottratto misurando e ri-aggiunto simulando, nella stessa riga, o è il difetto del carburante daccapo), c e τ in `modello_v2.json` con targhetta.
- **Cancello, pre-registrato**: M1 in lettura B2 — mediana ≤ 1,0 ed esatti ≥ 45,3%, **più** una condizione sul segno: la quota "troppo indietro" deve scendere dal 49,8% e il bias medio da +0,96 verso 0. Leave-one-race-out su (c, τ).
- **Rischio**: con τ troppo grande il termine degenera in un vantaggio quasi-perpetuo dopo la sosta, cioè "fermati subito" nel 100% dei casi. Serve la sentinella analitica che l'ottimo a una sosta resti a (giri rimasti − età)/2.
- **Nota**: M2 è un giudice debole per questo termine (in una finestra senza soste tutte le età avanzano insieme e w si cancella nel distacco). Il giudice è M1.

### I — Il pavimento di rumore della curva del "quando"
Sulle viste pubblicate, 4.241 raccomandazioni (56,9% delle curve) hanno un minimo interno, e il guadagno promesso è sotto 1 s nel 29,0% dei casi e sotto 3,3 s nel 55,4% — mentre l'unico errore mai misurato di questo motore vale ~3,2 s cumulati a 10 giri, e la curva integra fino alla bandiera (58 giri). Il solo arrotondamento al millesimo sposta il giro raccomandato in 25 curve su 260.
- **Cosa**: nuovo banco che ricalcola la curva perturbando *dentro l'incertezza che il modello dichiara di sé* (rho e delta70 agli estremi dell'IC95, pit-loss agli estremi già stampati in targhetta, fattore SC/VSC nella banda, L±1), e riporta la dispersione del giro raccomandato.
- **Cancello, da scrivere prima**: il giro si pubblica come **giro secco** solo se sotto ogni perturbazione si sposta di ≤2 giri nell'≥80% dei casi e il guadagno supera la dispersione indotta; altrove si pubblica una **finestra**. **[PO: giro secco o finestra?]**
- **Sonda obbligatoria**: con perturbazione nulla il banco deve riprodurre i 4.241 minimi interni e la mediana 2,770 s. Se non li riproduce, non sta misurando il prodotto.
- **Perché conta**: il punto C moltiplica per 4 il numero di raccomandazioni pubblicate. Se sono rumore, le moltiplica lo stesso.

### J — L'errore alla bandiera contro `data/arrivi_2026.csv`
Quel file contiene la classifica finale vera di tutte le 241 coppie pilota-gara e ha **zero riferimenti** in tutto il repo. Nessuno l'ha mai usato. Intanto M1 misura a 2 giri dal congelamento e M2 si ferma a 10, mentre la curva integra fino a ~58. Fra i 10 giri misurati e la bandiera non c'è nessuna misura — e c'è motivo di aspettarsi che lì il confronto cambi (nell'ultimo terzo di gara il nuovo passa M2 su tutti e tre gli orizzonti, e il suo bias nasce dal leader, cioè dall'auto che alla bandiera definisce la classifica).
- **Vincolo da pre-registrare**: solo 114 delle 241 coppie hanno una cella al giro finale; la regola per doppiati (45) e ritirati (41) va fissata prima. Usare le soste reali di tutti è informazione dal futuro — legittima perché identica per i due motori, ma va etichettata a caratteri cubitali.
- **Costo**: grande. È l'unico modo di sapere se "vince il nuovo" vale oltre due giri.

### K — Igiene, nessun numero visibile ma protegge le prossime misure
- **`banco.mjs:450`**: `giro_di_rientro` è cablato a `caso.rientroLap` e non segue le opzioni — mente appena si varia l'orizzonte, cioè sul percorso di chi misura M2/M3.
- **Esporre la ri-classificazione sulla popolazione comune** come funzione del banco: oggi due misure indipendenti dello stesso M1 possono divergere di 6 punti senza che nessuna abbia sbagliato un conto.
- **Esporre `casiGenerici`**: chi misura la copertura oggi ricostruisce a mano oggetti-caso sintetici.
- **Escludere la neutralizzazione dalla finestra pulita** quando si misura la qualità della base: 502 finestre su 5.186 fabbricano tutta la coda (p90 da 4,600 a 0,839 s/giro nel secchio critico).
- **Chiudere E21 con una cifra**: la pendenza residua sul giro implica δ₇₀ = 3,08 su tutti i giri verdi e **2,43 in aria libera** (IC che contiene lo zero) — il conflitto 3,11 contro 2,2 è contaminazione da traffico, non evoluzione della pista. Non spostare il valore cablato: i dati non lo chiedono. Stessa cosa per ρ (0,0359 in aria libera, ma IC della correzione contiene lo zero → **non si tocca**).
- **Selettore mescola** **[PO]**: o si toglie il listener morto e i tre bottoni diventano un'etichetta di sola lettura, o si pre-calcola una curva per mescola (costo misurato: ~+118 ms per record, una gara da ~2 a 4-5 minuti). Correggere solo il selettore CSS è la peggiore delle tre: accenderebbe un comando che si illumina e non cambia niente.

### PARCHEGGIATA — il traffico come penalità sul passo
Il fenomeno è il più regolare trovato (residuo +0,576 s/giro sotto 0,5 s di gap, positivo in 11/11 gare, riguarda il 19,6% dei giri), **ma il controfattuale sul bersaglio è negativo**: leave-one-race-out il bias peggiora su tutti e tre gli orizzonti e il confronto appaiato è 53%. Il cancello M2 non passerebbe. Resta difendibile solo la de-contaminazione della *base* (il 17,3% dei casi ha la base sporca di oltre 0,25 s/giro), e solo con un cancello M1 pre-registrato — accettando che rompe deliberatamente la simmetria misura/predizione, cosa da dichiarare e non da nascondere in una riga di stimatore.

---

## 5. COSA RESTA IGNOTO

1. **Il fuori campione, cioè tutto.** `modello_v2.json`, `banda_rientro.json` e il pit-loss "realizzato" di GB e Miami sono tarati sulle stesse 11 gare del banco. Le prove di robustezza fatte (sensibilità dentro gli IC, leave-one-race-out) restano tutte dentro quelle 11 gare, e il leave-one-race-out è una prova debole per costruzione. **Nessun numero di questo confronto è mai stato prodotto fuori campione.** Prima occasione: 23 agosto.

2. **L'orizzonte che il prodotto usa davvero.** Misurato: 2 giri (M1) e 10 giri (M2). Usato: fino alla bandiera (~58 giri). Il verdetto "vince il nuovo" poggia su un margine di 5 casi su 223 misurato a due giri dal congelamento.

3. **Se le risposte guadagnate abbassando la soglia siano buone.** È certificata la *base* che le alimenta, non la risposta finale: sulle soste vere i casi marginali con verità sono 12-14, e nessuna delle differenze osservate lì è distinguibile dal caso.

4. **Il ramo Safety Car.** n=17 casi con regime al congelamento, e lì il vecchio è davanti. Indicativo, non concludente — ma è esattamente il ramo dove il nuovo dichiara di essere migliore, e dove il fattore di neutralizzazione (0,50/0,65) non è mai stato misurato in casa.

5. **I 70 casi su 209 che partono in verde e finiscono neutralizzati.** Al congelamento non sono conoscibili in alcun modo. Copertura della banda lì: 32,9% contro 84,2%. È un terzo del campione che nessun modello può vincere con l'informazione ammessa; si può misurarne frequenza (32,4%) e magnitudine (+3,54 s di pit-loss addebitato in più), non prevederli.

6. **Il rifiuto del Director.** Zero occorrenze nel perimetro e zero in tutta la vista pre-calcolata (0 su 11.290). Il ramo esiste nel codice, è nel cancello M4, e non è mai stato esercitato su dati veri.

7. **Monaco.** Entra nel confronto al 21% della sua taglia (10 casi appaiati su 47), perché il vecchio è muto in 35. Qualunque numero pooled di M1 è di fatto una statistica su 10 gare e mezza. E le sue celle sotto bandiera rossa sono ingressi in pit-lane sotto sospensione contati come soste di strategia: il perimetro pre-registrato le ammette, ma non è detto che il prodotto debba rispondere "dove rientri" mentre la gara è sospesa.

8. **Se il vecchio in produzione fosse davvero peggiore.** Sappiamo che il suo vantaggio (46,6% contro 43,9%) si compra con un solo giro di informazione dal futuro. Non sappiamo quanto valga un motore che quel giro non lo avesse — non esiste.

9. **Se il "giro migliore" sia un giro.** 4.241 raccomandazioni pubblicate, e nessuna misura del rumore della differenza fra due giri candidati. Il 55,4% promette meno dell'errore misurato a 10 giri, su un orizzonte sei volte più lungo.

---

## Allegato — le misure grezze

### M1a — vince NUOVO · cancello True · verifica regge: True

```
PERIMETRO: 274 casi ammessi su 459 soste reali (escluse: 22 pit entro il giro 3 · 0 senza cum al congelamento · 0 senza giro di rientro · 23 senza cum al rientro · 140 doppiato al rientro).

MUTI (contati, non scartati): VECCHIO 39/274, tutti con motivo "pilota non in pista al giro scelto" (= manca pace[L][pilota]); NUOVO 14/274, tutti "nessuna posizione: il pilota non ha un passo base (regola 6)"; muti entrambi 2. CASI COMUNI = 223.

LETTURA A — |pos − posizioneVera|, i due campi che il banco consegna, sui 223 casi comuni:
  VECCHIO  mediana|e| 1.0 · media|e| 1.66 · esatti 31.8% (71/223) · entro1 59.2% (132) · entro2 75.3% · max|e| 9
  NUOVO    mediana|e| 1.0 · media|e| 1.28 · esatti 40.4% (90/223) · entro1 67.3% (150) · entro2 79.8% · max|e| 6
  testa a testa per caso: nuovo 64 · vecchio 49 · pari 110 (sign test p=0,094; casi non indipendenti dentro la gara)
  ciascuno su TUTTE le proprie risposte: vecchio n=235 esatti 31.9% (75) media|e| 1.64 · nuovo n=260 esatti 37.7% (98) media|e| 1.39

LETTURA B — le due previsioni e la verità ri-classificate sull'intersezione delle tre popolazioni, stessi 223 casi:
  VECCHIO  mediana|e| 1.0 · media|e| 1.10 · esatti 43.0% (96/223) · entro1 71.7% (160) · entro2 84.8% · max|e| 6
  NUOVO    mediana|e| 1.0 · media|e| 1.03 · esatti 45.3% (101/223) · entro1 73.1% (163) · entro2 86.5% · max|e| 6
  testa a testa per caso: nuovo 26 · vecchio 14 · pari 183 (p=0,040)

CANCELLO M1 (mediana ≤ E esatti ≥): PASSA in lettura A (mediana 1.0 = 1.0, esatti 40.4% > 31.8%) e PASSA in lettura B (mediana 1.0 = 1.0, esatti 45.3% > 43.0%). La mediana pareggia in entrambe: il cancello è deciso dagli esatti.

IL VECCHIO COM'ERA IN PRODUZIONE (passo v2 di demo/data/modello_passo_2026.json — delta 3.170, rho 0.03892 — gradino spento, stesso giro di risposta): A esatti 31.4% (70/223) media|e| 1.67 mediana 1.0 · B esatti 43.0% (96) media|e| 1.11. Il verdetto NON cambia: su M1 il passo v2 vale −0.4 punti in A e 0.0 in B.
Contesto non confrontabile (produzione alla lettera: byLap intero + orizzonte 5 + passo v2, risponde al giro pit+6): esatti 28.9% (68/235) media|e| 1.60 err.segno medio −1.14.

ERRORI CON SEGNO (positivo = il motore mette il pilota PIÙ INDIETRO del vero), 223 casi:
  A vecchio  media +0.099 · mediana 0 · sovrastima 37.2% · sottostima 30.9% · esatti 31.8%
             istogramma −9:1 −8:1 −7:1 −6:3 −5:5 −4:7 −3:7 −2:14 −1:30 0:71 +1:31 +2:22 +3:13 +4:8 +5:5 +6:3 +7:1
  A nuovo    media +0.960 · mediana 0 · sovrastima 49.8% · sottostima 9.9% · esatti 40.4%
             istogramma −4:1 −3:3 −2:5 −1:13 0:90 +1:47 +2:23 +3:21 +4:11 +5:4 +6:5
  B vecchio  media +1.009 · mediana +1 · sovrastima 53.8% · sottostima 3.1%
  B nuovo    media +0.825 · mediana 0 · sovrastima 47.5% · sottostima 7.2%

PER GARA (blocchi = gare; casi comuni · A: mediana|e| v→n, esatti v→n | B: mediana|e| v→n, esatti v→n):
  Australia     21 | 1.0→2.0  23.8%→23.8% | 1.0→2.0  28.6%→28.6%
  Austria       28 | 1.0→0.0  35.7%→53.6% | 0.0→0.0  53.6%→53.6%
  Belgio        18 | 2.0→1.0  11.1%→38.9% | 1.5→1.0  33.3%→44.4%
  Canada        10 | 2.5→2.0  20.0%→20.0% | 2.5→1.5  20.0%→20.0%
  Cina          11 | 3.0→3.0   9.1%→ 9.1% | 3.0→3.0  27.3%→27.3%
  Giappone      22 | 1.0→1.0  22.7%→18.2% | 1.0→1.0  18.2%→22.7%
  GranBretagna  28 | 1.0→1.0  46.4%→39.3% | 0.0→1.0  53.6%→46.4%
  Miami         16 | 1.0→0.0  31.3%→56.3% | 0.5→0.0  50.0%→56.3%
  Monaco        10 | 0.0→0.0  80.0%→70.0% | 0.0→0.0  70.0%→80.0%
  Spagna        29 | 1.0→1.0  31.0%→37.9% | 1.0→1.0  41.4%→41.4%
  Ungheria      30 | 1.0→0.0  36.7%→60.0% | 0.0→0.0  60.0%→66.7%
  mediana migliore per il nuovo — A 5/11 (pari 5, peggio 1: Australia) · B 3/11 (pari 6, peggio 2: Australia, Gran Bretagna)
  esatti migliori per il nuovo — A 5 vinte / 3 perse / 3 pari (p=0,36) · B 5 / 1 / 5 (p=0,11)
  media NON pesata delle quote-esatti per gara: A 31.6%→38.8% · B 41.4%→44.3%

LEAVE-ONE-RACE-OUT sul saldo esatti (nuovo − vecchio): lettura A da +6.2 a +10.8 punti, lettura B da +1.5 a +3.6 punti; il segno non si ribalta togliendo nessuna delle 11 gare.

DENOMINATORI: su(vecchio) ≠ su(verità) in 161/223, su(nuovo) ≠ su(verità) in 84/223, tutti e tre uguali in 40/223; ampiezza mediana del campo verità 20 · vecchio 17 · nuovo 20 · intersezione 17; su(vecchio) < su(verità) in 148/223 con scarto mediano −2.

COMPOSIZIONE: Monaco entra con 10 casi comuni su 47 ammessi (21%), perché il vecchio è muto in 35 (Monaco ha pace al congelamento in soli 12 casi su 47). Pesi nel pool: Ungheria 13.5% · Spagna 13.0% · Austria 12.6% · Gran Bretagna 12.6% · Giappone 9.9% · Australia 9.4% · Belgio 8.1% · Miami 7.2% · Cina 4.9% · Canada 4.5% · Monaco 4.5%.

ASIMMETRIE DI COPERTURA (materiale per M4): solo il vecchio risponde in 12 casi (mediana|e| 1, esatti 4); solo il nuovo in 37 (mediana|e| 2, esatti 8).

BIAS PER FASCIA (errore con segno, lettura A, vecchio→nuovo): P1–P5 n=105 +0.53→+0.78 (esatti 42%→48%) · P6–P10 n=65 +0.42→+1.46 (18%→28%) · P11–P15 n=39 −0.92→+0.62 (31%→38%) · P16–P25 n=14 −1.79→+0.93 (21%→50%). Verde al congelamento n=206 +0.15→+1.10 (32%→42%); SC/VSC al congelamento n=17 −0.47→−0.76 (29%→24%): è l'unico taglio in cui il vecchio resta davanti.
```

### M1b — vince NUOVO · cancello True · verifica regge: True

```
PERIMETRO 274 casi su 459 soste reali (escluse: pit<=3 22 · senza_cum_al_congelamento 0 · senza_giro_di_rientro 0 · senza_cum_al_rientro 23 · doppiato_al_rientro 140).
CONTROLLO INDIPENDENTE DELLA VERITA' (ricalcolata da me leggendo demo/data/<gara>.json, non dal campo del banco): 274/274 ricalcolati, 0 divergenze di posizione, 0 di ampiezza campo.
INTEGRITA': `pos` == rango nel proprio `ordine` in 235/235 (vecchio) e 260/260 (nuovo); `su` == lunghezza di `ordine` in 235/235 e 260/260. 0 incoerenze.

COPERTURA — rispondono entrambi 223 · solo vecchio 12 · solo nuovo 37 · muti tutti e due 2.
  MUTI VECCHIO 39/274 (14,2%), motivo unico «pilota non in pista al giro scelto»; coincidono esattamente con i 39 casi passoVecchioDisponibile=false.
  MUTI NUOVO   14/274 (5,1%), motivo unico «nessuna posizione: il pilota non ha un passo base (regola 6)».

═══ M1 SUI 223 CASI APPAIATI (pool sulle 11 gare) ═══
LETTURA A — |pos − posizioneVera|, i due campi come li consegna il banco (la lettura letterale della PREREG)
  VECCHIO n=223  mediana|err| 1.0  media|err| 1.66  esatti 71 (31.8%)  entro1 132 (59.2%)  entro2 75.3%  bias mediano 0.0  bias medio +0.10  max 9
  NUOVO   n=223  mediana|err| 1.0  media|err| 1.28  esatti 90 (40.4%)  entro1 150 (67.3%)  entro2 79.8%  bias mediano 0.0  bias medio +0.96  max 6
LETTURA B — previsione e verita' RI-CLASSIFICATE sulla popolazione comune motore∩verita'
  VECCHIO n=223  mediana|err| 1.0  media|err| 1.14  esatti 94 (42.2%)  entro1 157 (70.4%)  entro2 84.3%  bias mediano +1.0  bias medio +1.05  max 6
  NUOVO   n=223  mediana|err| 1.0  media|err| 1.13  esatti 98 (43.9%)  entro1 156 (70.0%)  entro2 84.3%  bias mediano  0.0  bias medio +0.88  max 6
LETTURA B2 — ri-classificate sulla terna comune verita'∩vecchio∩nuovo (il confronto piu' stretto)
  VECCHIO n=223  mediana|err| 1.0  media|err| 1.10  esatti 96 (43.0%)  entro1 160 (71.7%)  entro2 84.8%  bias mediano +1.0  bias medio +1.01  max 6
  NUOVO   n=223  mediana|err| 1.0  media|err| 1.03  esatti 101 (45.3%) entro1 163 (73.1%)  entro2 86.5%  bias mediano  0.0  bias medio +0.83  max 6

CANCELLO M1 (mediana_nuovo <= mediana_vecchio E esatti%_nuovo >= esatti%_vecchio):
  lettura A  mediana OK (1.0 = 1.0) · esatti OK (40.4% >= 31.8%) → IL NUOVO PASSA
  lettura B  mediana OK (1.0 = 1.0) · esatti OK (43.9% >= 42.2%) → IL NUOVO PASSA
  lettura B2 mediana OK (1.0 = 1.0) · esatti OK (45.3% >= 43.0%) → IL NUOVO PASSA
Il vecchio non vince in NESSUNA delle tre letture. Ma la mediana e' pari in tutte e tre: il cancello si decide interamente sulla quota di esatti.

TESTA A TESTA CASO PER CASO (|errore| piu' piccolo) + test dei segni binomiale esatto a due code
  lettura A  vince nuovo 64 · vince vecchio 49 · pari 110 (errore identico 102) → p = 0,1876
  lettura B  vince nuovo 28 · vince vecchio 29 · pari 166 (errore identico 164) → p = 1,0000
  lettura B2 vince nuovo 26 · vince vecchio 14 · pari 183 (errore identico 182) → p = 0,0807

BOOTSTRAP A BLOCCHI (le 11 GARE ricampionate con reimmissione, 10.000 giri, seme fisso 20260731)
  lettura A  Δmedia|err| (nuovo−vecchio) −0,377  IC95 [−0,616 ; −0,106] · nuovo migliore nel 99,7% dei ricampionamenti · Δesatti +8,52 punti IC95 [0,00 ; +16,20] · nuovo con piu' esatti nel 97,5%
  lettura B  Δmedia|err| −0,009  IC95 [−0,146 ; +0,097] · nuovo migliore nel 56,3% · Δesatti +1,79 punti IC95 [−1,52 ; +5,67] · nuovo con piu' esatti nell'82,3%
  lettura B2 Δmedia|err| −0,067  IC95 [−0,202 ; +0,043] · nuovo migliore nell'86,5% · Δesatti +2,24 punti IC95 [−0,93 ; +5,56] · nuovo con piu' esatti nell'89,0%
  Δmediana|err| = 0,00 con IC95 [−1,00 ; 0,00] in tutte e tre le letture.

LE POPOLAZIONI NON COINCIDONO (ecco perche' A e B divergono)
  ampiezza mediana del campo: verita' 20 · vecchio 17 · nuovo 20
  su(vecchio) != su(vero) in 161/223 (72,2%), scarto mediano −2 · su(nuovo) != su(vero) in 84/223 (37,7%), scarto mediano 0 · tutti e tre uguali 40/223 (17,9%)
  su mediano per gara (vecchio / nuovo / vero): Australia 19/18/19 · Austria 18/20/20 · Belgio 14/20/20 · Canada 17/19/18 · Cina 18/14/17 · Giappone 16/22/21 · Gran Bretagna 17,5/22/22 · Miami 18/18/18 · Monaco 15,5/18/18 · Spagna 16/21/20 · Ungheria 17,5/20,5/21

COPERTURA PIENA (ogni motore sul PROPRIO insieme di risposta, lettura A)
  VECCHIO n=235  mediana 1.0  media 1.64  esatti 75 (31.9%)  entro1 139 (59.1%)  bias medio +0.14  max 9
  NUOVO   n=260  mediana 1.0  media 1.39  esatti 98 (37.7%)  entro1 166 (63.8%)  bias medio +1.08  max 6

═══ RIPARTIZIONE PER GARA (blocchi = gare, nessuna media che le mescoli in silenzio) ═══
gara              casi  mutiV mutiN  app | A: medV medN esattiV% esattiN% | B: medV medN esattiV% esattiN%
Australia          21      0     0   21 |  1.0  2.0   23.8%   23.8% |  1.0  2.0   28.6%   28.6%
Austria            28      0     0   28 |  1.0  0.0   35.7%   53.6% |  0.0  0.0   53.6%   53.6%
Belgio             20      0     2   18 |  2.0  1.0   11.1%   38.9% |  2.0  1.0   33.3%   44.4%
Canada             11      0     1   10 |  2.5  2.0   20.0%   20.0% |  2.5  1.5   20.0%   20.0%
Cina               15      0     4   11 |  3.0  3.0    9.1%    9.1% |  3.0  3.0    9.1%   27.3%
Giappone           24      2     0   22 |  1.0  1.0   22.7%   18.2% |  1.0  1.0   18.2%   22.7%
Gran Bretagna      30      2     0   28 |  1.0  1.0   46.4%   39.3% |  0.0  1.0   53.6%   46.4%
Miami              18      0     2   16 |  1.0  0.0   31.3%   56.3% |  0.5  0.0   50.0%   56.3%
Monaco             47     35     4   10 |  0.0  0.0   80.0%   70.0% |  0.0  0.0   70.0%   70.0%
Spagna             29      0     0   29 |  1.0  1.0   31.0%   37.9% |  1.0  1.0   41.4%   37.9%
Ungheria           31      0     1   30 |  1.0  0.0   36.7%   60.0% |  0.0  0.0   60.0%   63.3%
  gare vinte (mediana piu' bassa) lettura A: nuovo 5 · vecchio 1 (Australia) · pari 5
  gare vinte (mediana piu' bassa) lettura B: nuovo 3 · vecchio 2 (Australia, Gran Bretagna) · pari 6
  MUTI per gara: Monaco 35 (vecchio) / 4 (nuovo) · Cina 0/4 · Belgio 0/2 · Miami 0/2 · Giappone 2/0 · Gran Bretagna 2/0 · Canada 0/1 · Ungheria 0/1.

═══ IL TAGLIO RICHIESTO: NEUTRALIZZAZIONE contro VERDE (sui 223 appaiati) ═══
regime al CONGELAMENTO (informazione <= L, quella che il nuovo usa e che il vecchio col byLap troncato non ha piu'):
  VERDE n=206 · A: vecchio mediana 1.0 media 1.69 esatti 32.0% bias +0.15 | nuovo mediana 1.0 media 1.29 esatti 41.7% bias +1.10
                B: vecchio mediana 1.0 media 1.18 esatti 42.2% bias +1.10 | nuovo mediana 1.0 media 1.15 esatti 44.7% bias +1.01
  SC n=7   · A: vecchio media 0.71 esatti 42.9% (3/7) bias −0.14 | nuovo media 1.14 esatti 28.6% (2/7) bias −0.29
             B: vecchio mediana 1.0 media 0.71 esatti 42.9% | nuovo mediana 0.0 media 0.57 esatti 57.1% (4/7) bias 0.00
  VSC n=10 · A: vecchio media 1.70 esatti 20.0% (2/10) bias −0.70 max 7 | nuovo media 1.30 esatti 20.0% (2/10) bias −1.10 max 3
             B: vecchio media 0.70 esatti 40.0% (4/10) bias +0.30 | nuovo media 1.30 esatti 20.0% (2/10) bias −1.10  ← QUI IL VECCHIO VINCE
  NEUTRALIZZATO QUALUNQUE n=17 · A: vecchio media 1.29 esatti 29.4% (5/17) | nuovo media 1.24 esatti 23.5% (4/17)
                                B: vecchio mediana 1.0 media 0.71 esatti 41.2% (7/17) entro1 88.2% | nuovo mediana 1.0 media 1.00 esatti 35.3% (6/17) entro1 76.5%
  → SOTTO REGIME CONOSCIUTO AL CONGELAMENTO IL CONFRONTO SI RIBALTA: il vecchio ha piu' esatti (41,2% contro 35,3%) e meno errore medio (0,71 contro 1,00) in lettura B. n=17, quindi indicativo e non concludente.

INCROCIO regime-al-congelamento contro regime-al-giro-della-sosta (il secondo e' FUTURO, usato solo come etichetta, mai passato ai motori):
  regime al congelamento SI' → sosta neutralizzata 14 · sosta in verde 3
  regime al congelamento NO  → sosta neutralizzata 70 · sosta in verde 136
  cioe' 70 delle 84 soste che finiscono sotto neutralizzazione NON erano annunciate al congelamento.
STRATIFICANDO SUL FUTURO (diagnostica): sosta in VERDE n=139 · A: vecchio mediana 1.0 media 1.25 esatti 38.8% | nuovo mediana 0.0 media 0.70 esatti 53.2% entro1 83.5%
                                        sosta NEUTRALIZZATA n=84 · A: vecchio mediana 2.0 media 2.33 esatti 20.2% entro1 41.7% bias +1.05 | nuovo mediana 2.0 media 2.25 esatti 19.0% entro1 40.5% bias +1.92
                                        (in lettura B: verde 52,5% contro 54,7% esatti; neutralizzato 25,0% contro 26,2%)

ISTOGRAMMA DEGLI ERRORI CON SEGNO, 223 appaiati (err<0 = previsto MIGLIORE del vero) — A:vecchio / A:nuovo | B:vecchio / B:nuovo
  −9: 1/0|0/0 · −8: 1/0|0/0 · −7: 1/0|0/0 · −6: 3/0|0/0 · −5: 5/0|0/0 · −4: 7/1|0/1 · −3: 7/3|1/2 · −2: 14/5|1/3 · −1: 30/13|5/12
   0: 71/90|94/98 · +1: 31/47|58/46 · +2: 22/23|30/29 · +3: 13/21|18/17 · +4: 8/11|10/7 · +5: 5/4|3/6 · +6: 3/5|3/2 · +7: 1/0|0/0
  Il vecchio ha 18 casi con errore <= −4 in lettura A e 0 in lettura B: quella coda sinistra e' interamente l'effetto del denominatore piu' piccolo (non puo' collocare il pilota a P20 quando ne classifica 17).
```

### M2 — vince PARI · cancello False · verifica regge: True

```
GRIGLIA: 261 congelamenti (L da 5, passo 2, L+10 ≤ nGiri) · 11.303 coppie (congelamento, pilota, orizzonte) — 3g 3.845 · 5g 3.800 · 10g 3.658. Copertura incondizionata su 5.030 coppie: vecchio-banco 4.320 (85,9%) · vecchio-pannello 4.339 (86,3%) · nuovo 4.375 (87,0%).

LETTURA PRINCIPALE — finestra pulita (nessuna sosta di pilota o leader in (L, L+H]), popolazione COMUNE. bias mediano / bias medio / |err| mediano, s/giro:
 3g n=2330  banco  0,021 / 0,048 / 0,382 · pannello  0,002 / 0,022 / 0,376 · NUOVO  0,051 / 0,111 / 0,393
 5g n=1997  banco  0,008 / 0,016 / 0,350 · pannello −0,007 / −0,006 / 0,347 · NUOVO  0,057 / 0,080 / 0,368
10g n=1268  banco −0,069 / −0,193 / 0,330 · pannello −0,082 / −0,209 / 0,332 · NUOVO −0,040 / −0,136 / 0,322

LETTURA SEVERA — griglia intera (soste comprese), popolazione comune. bias mediano / |err| mediano:
 3g n=3348  banco 0,066 / 0,635 · pannello 0,054 / 0,631 · NUOVO 0,103 / 0,648
 5g n=3311  banco 0,073 / 0,656 · pannello 0,056 / 0,646 · NUOVO 0,113 / 0,671
10g n=3193  banco 0,088 / 0,723 · pannello 0,078 / 0,691 · NUOVO 0,120 / 0,690

IL CANCELLO («|bias| ≤ vecchio su tutti e tre gli orizzonti»): NON PASSA in tutte e 4 le combinazioni (2 letture × 2 vecchi). Finestra pulita vs pannello: 3g 0,051 vs 0,002 FALLITO · 5g 0,057 vs 0,007 FALLITO · 10g 0,040 vs 0,082 ok. Griglia intera vs pannello: 0,103 vs 0,054 · 0,113 vs 0,056 · 0,120 vs 0,078, tutti e tre FALLITI. Il nuovo sta dalla parte peggiore in 10 celle su 12.

MA IL METRO NON DISCRIMINA — bootstrap a blocchi = GARE (11 blocchi, 2.000 ricampionamenti), IC95 del bias mediano (finestra pulita):
 3g banco [−0,081; 0,137] · pannello [−0,099; 0,092] · nuovo [−0,082; 0,176]
 5g banco [−0,112; 0,133] · pannello [−0,136; 0,092] · nuovo [−0,088; 0,192]
10g banco [−0,154; 0,016] · pannello [−0,200; 0,018] · nuovo [−0,159; 0,057]
IC95 dello SCARTO APPAIATO |bias(nuovo)|−|bias(vecchio)| — TUTTI E SEI CONTENGONO LO ZERO:
 3g vs banco +0,030 [−0,048; 0,079] · vs pannello +0,049 [−0,067; 0,096]
 5g vs banco +0,049 [−0,067; 0,093] · vs pannello +0,050 [−0,092; 0,120]
10g vs banco −0,029 [−0,092; 0,075] · vs pannello −0,042 [−0,117; 0,083]
APPAIATO coppia per coppia (chi è più vicino alla verità sullo stesso caso): nuovo vince 50,0% e 49,2% (3g), 50,4% e 50,0% (5g), 51,9% e 50,0% (10g). Mediana Δ|err| fra −0,006 e +0,003 s/giro.
CANCELLO GARA PER GARA, gare vinte dal nuovo: 4/11 e 5/11 (3g) · 5/11 e 5/11 (5g) · 5/11 e 7/11 (10g).

VERDE vs NEUTRALIZZATO — regime AL CONGELAMENTO (≤L), finestra pulita, bias mediano banco/pannello/nuovo:
 VERDE   3g n=2220  0,004 / −0,016 / 0,033  (|err| 0,366 / 0,367 / 0,376)
 VERDE   5g n=1897 −0,006 / −0,023 / 0,038
 VERDE  10g n=1214 −0,080 / −0,089 / −0,055  (|err| 0,324 / 0,329 / 0,315)
 NEUTRO  3g n=110   1,924 / 1,797 / 1,964  ← 480 volte il verde
 NEUTRO  5g n=100   1,007 / 0,865 / 1,019
 NEUTRO 10g n=54    0,357 / 0,326 / 0,492
Neutralizzazione DENTRO la finestra (futuro, solo per classificare): VERDE 3g n=2135 0,002/−0,019/0,034 · NEUTRO 3g n=195 0,611/0,503/0,696 con |err| mediano 1,928/1,803/1,944.

IL CONTAMINANTE, misurato — solo finestre con una sosta dentro: 3g n=1018 |err| mediano 5,690 / 5,520 / 5,769 s/giro (15× la finestra pulita); 10g n=1925 1,187 / 1,111 / 1,224.

CONTROLLO C1 — errore sul TEMPO ASSOLUTO invece che sul distacco (finestra pulita, popolazione comune), bias mediano (|err| mediano):
 3g banco −1,955 (1,956) · pannello −0,194 (0,427) · NUOVO −0,018 (0,428)
 5g banco −1,929 (1,930) · pannello −0,253 (0,453) · NUOVO −0,016 (0,435)
10g banco −1,797 (1,800) · pannello −0,295 (0,529) · NUOVO −0,036 (0,495)
CONTROLLO C2 — distanza fra i due vecchi sul distacco, mediana |err_banco − err_pannello|: 0,098 / 0,097 / 0,091. Nuovo↔pannello: 0,151 / 0,157 / 0,176.
CONTROLLO C3 — riferimento = MEDIA del campo invece del leader: bias 3g 0,044 / 0,044 / 0,040 (nuovo MIGLIORE) · 5g 0,019 / 0,025 / 0,027 · 10g 0,020 / 0,028 / 0,038; |err| 10g 0,319 / 0,307 / 0,277 (nuovo migliore). Il verdetto si ribalta col riferimento.
STABILITÀ (--passo=1: 519 congelamenti, 22.791 coppie): 3g 0,018 / 0,002 / 0,044 · 5g 0,001 / −0,017 / 0,040 · 10g −0,056 / −0,065 / −0,026. Stesso esito del cancello.

PER GARA, bias mediano 3g (banco / pannello / nuovo): Australia 0,099/0,055/−0,042 · Austria 0,151/0,120/0,228 · Belgio 0,119/0,164/0,145 · Canada 0,500/0,384/0,521 · Cina −0,103/−0,135/−0,095 · Giappone −0,028/0,002/−0,203 · Gran Bretagna 0,007/−0,051/0,054 · Miami −0,082/−0,087/−0,013 · Monaco −0,358/−0,418/−0,226 · Spagna −0,020/−0,036/0,117 · Ungheria 0,217/0,159/0,254 · MEDIANA fra gare 0,007/0,002/0,054. A 10 giri la mediana fra gare è −0,066/−0,078/+0,027.
PER GARA, |err| mediano 3g: MEDIANA fra gare 0,322/0,321/0,386; a 10g 0,294/0,262/0,284.
```

### M3 — vince PARI · cancello False · verifica regge: True

```
SCRIPT: /Users/tommi/muretto/.claude/worktrees/friendly-pasteur-df1363/ai_lab/confronto/M3_il_quando.mjs
COMANDO: node ai_lab/confronto/M3_il_quando.mjs
274 soste vere, 11 gare. Giro finale comune H = nGiri (la bandiera), candidati giroPit da L+1 a H−1, identici per i due motori. PIATTA = ampiezza (max−min) ≤ 0,01 s, contata a parte.

1 · CONTO PRINCIPALE (curve/casi · piatte · INTERNI · primo giro utile · ultimo)
  VECCHIO passo=null (banco/gen_hero)   235/274 · piatte 112 (47,7%) · INTERNI   0 (0,0%) · primo 123 (52,3%) · ultimo 0
  VECCHIO passo=v2 (PANNELLO prod.)     235/274 · piatte   0 ( 0,0%) · INTERNI 181 (77,0%) · primo  54 (23,0%) · ultimo 0
  NUOVO mescola AL CONGELAMENTO (sito)   95/274 · piatte   0 ( 0,0%) · INTERNI  34 (35,8%) · primo  61 (64,2%) · ultimo 0
  NUOVO mescola LEGALE (regola repo)    260/274 · piatte   0 ( 0,0%) · INTERNI 177 (68,1%) · primo  83 (31,9%) · ultimo 0
  ampiezza mediana della curva: 2,862 / 30,515 / 13,713 / 20,004 s
  profondità mediana del minimo interno: n/d / 3,892 / 0,693 / 2,770 s
  MUTI: vecchio 39 × «pilota non in pista al giro scelto» (entrambe le configurazioni)
        nuovo A 165 × REG01 FATAL «gara asciutta completata con meno di due mescole slick» + 14 × regola 6 (nessun passo base)
        nuovo B 14 × regola 6 (verificato: direttore.approved=true e respinti=0 in 14/14 — NON è un rifiuto)

2 · SENZA IL FILTRO DELLA PIATTEZZA (argmin nudo, come stampa collaudo_motori f3)
  VECCHIO passo=null 235 · interni 37 (15,7%) · primo 198 (84,3%)   ← tutti e 37 rumore
  VECCHIO passo=v2   235 · interni 181 (77,0%) · primo 54 (23,0%)
  NUOVO A             95 · interni 34 (35,8%) · primo 61 (64,2%)
  NUOVO B            260 · interni 177 (68,1%) · primo 83 (31,9%)
  ampiezza delle 112 curve PIATTE del vecchio passo=null: massima 1,819e-12 s · mediana 0,000e+0 s
  ampiezza delle 123 NON piatte dello stesso motore: mediana 21,420 s

3 · A DUE A DUE (INTERNI, sui casi in cui quella coppia risponde)
  prereg LETTERALE — vecchio passo=null vs NUOVO legale, n=223:   0 (0,0%)  vs  174 (78,0%)
     scarto del giro del minimo: mediana 3 giri · stesso giro in 45 (20,2%)
  ONESTO — vecchio passo=v2 (produzione) vs NUOVO legale, n=223: 169 (75,8%) vs 174 (78,0%)
     scarto del giro del minimo: mediana 1 giro · stesso giro in 64 (28,7%)
  vecchio passo=v2 vs NUOVO come lo serve il sito, n=60:          29 (48,3%) vs  31 (51,7%)
     scarto del giro del minimo: mediana 0 · stesso giro in 37 (61,7%)
  popolazione comune a tutti e quattro, n=60: 0 (0,0%) · 29 (48,3%) · 31 (51,7%) · 31 (51,7%)

3-bis · BUCHI E RITARDO DEL MINIMO
  curve con buchi (candidati non valutati): vecchio null 0 · vecchio v2 0 · nuovo A 2 (2,1%) · nuovo B 14 (5,4%)
  primo punto della curva ≠ L+1: 0 · 0 · 2 · 14
  ritardo mediano del minimo dal congelamento: 1 · 7 · 1 · 5 giri

4 · PER GARA (interni/curve — vecchio null | vecchio v2 | nuovo A | nuovo B)
  Australia      0/21 | 18/21 |  1/3  | 19/21
  Austria        0/28 | 24/28 |  5/9  | 24/28
  Belgio         0/20 | 19/20 |  3/3  | 17/18
  Canada         0/11 |  5/11 |  1/2  |  5/10
  Cina           0/15 | 12/15 | muto  |  8/11
  Giappone       0/22 | 21/22 |  2/3  | 23/24
  Gran Bretagna  0/28 | 11/28 |  3/15 | 13/30
  Miami          0/18 | 10/18 |  1/1  |  9/16
  Monaco         0/12 |  7/12 |  0/36 |  5/43
  Spagna         0/29 | 29/29 | 10/10 | 29/29
  Ungheria       0/31 | 25/31 |  8/13 | 25/30

5 · SENSIBILITÀ H = min(nGiri, L+15) invece della bandiera
  vecchio null 0/235 (0,0%) · vecchio v2 21/235 (8,9%) · nuovo A 26/257 (10,1%) · nuovo B 26/260 (10,0%)
  (con H corto i muti del nuovo A crollano da 179 a 17: REG01 scatta solo se lo scenario ARRIVA alla bandiera)

6 · CONTROPROVA SUL PRODOTTO VERO (demo/data/vista/, motore nuovo convenzione A, tutti i piloti/giri)
  11.290 record · senza_risposta 1.159 · rifiutati dal Director 0
  con pannello ma CURVA VUOTA 2.678 = 26,4% di chi ha un pannello
  con curva 7.453 → piatte 0 · INTERNI 4.241 (56,9%) · primo 3.212 (43,1%) · ultimo 0

7 · CONTROLLI
  C1 scorciatoia sugli argomenti del vecchio = strada lunga (ingressiVecchio a ogni candidato): SÌ, identici
  troncamento di byLap (produzione lo passa INTERO): la classificazione cambia in 0/235 casi (0,0%)
```

### M4 — vince PARI · cancello False · verifica regge: True

```
(a) TAVOLA DEI MUTI — 274 soste vere
entrambi rispondono 223 (81.4%) · solo il VECCHIO 12 (4.4%) · solo il NUOVO 37 (13.5%) · nessuno 2 (0.7%)
copertura VECCHIO 235/274 (85.8%) · copertura NUOVO 260/274 (94.9%) · saldo +25
perche' tacciono: VECCHIO 39x "pilota non in pista al giro scelto" (= manca il pace) · NUOVO 14x "il pilota non ha un passo base (regola 6)"

PER GARA (blocchi, E11) — casi / entrambi / soloV / soloN / nessuno / cop.V / cop.N
Australia      21  21  0   0  0  100.0%  100.0%
Austria        28  28  0   0  0  100.0%  100.0%
Belgio         20  18  2   0  0  100.0%   90.0%
Canada         11  10  1   0  0  100.0%   90.9%
Cina           15  11  4   0  0  100.0%   73.3%
Giappone       24  22  0   2  0   91.7%  100.0%
Gran Bretagna  30  28  0   2  0   93.3%  100.0%
Miami          18  16  2   0  0  100.0%   88.9%
Monaco         47  10  2  33  2   25.5%   91.5%
Spagna         29  29  0   0  0  100.0%  100.0%
Ungheria       31  30  1   0  0  100.0%   96.8%
=> a blocchi il VECCHIO copre di piu' in 5 gare, il NUOVO in 3, pari in 3. Il +25 aggregato e' UNA gara (Monaco, +31 netto).

(b) I 12 CASI PERSI ERANO BUONI? — errore del VECCHIO
LETTURA A (|pos - posizioneVera|):
  tutti i casi in cui risponde  n=235  mediana 1  media 1.64  esatti 75 (31.9%)  entro1 139 (59.1%)
  casi TENUTI                   n=223  mediana 1  media 1.66  esatti 71 (31.8%)  entro1 132 (59.2%)
  casi PERSI                    n= 12  mediana 1  media 1.33  esatti  4 (33.3%)  entro1   7 (58.3%)
  D persi-tenuti: mediana 0 · media -0.33 · quota esatti +1.5 punti · permutazione mediane p=1.0000, quota esatti p=1.0000
LETTURA B (popolazione comune motore n verita'):
  tutti  n=235  mediana 1    media 1.14  esatti 100 (42.6%)  entro1 164 (69.8%)
  TENUTI n=223  mediana 1    media 1.14  esatti  94 (42.2%)  entro1 157 (70.4%)
  PERSI  n= 12  mediana 0.5  media 1.17  esatti   6 (50.0%)  entro1   7 (58.3%)
  D persi-tenuti: mediana -0.5 · media +0.02 · quota esatti +7.8 punti · permutazione mediane p=0.5073, quota esatti p=0.7625
=> il cancello M4 chiede che i persi siano PEGGIORI della media del vecchio. NON lo sono (pari in A, leggermente MIGLIORI in B). CANCELLO NON SUPERATO — ma con n=12 e p>=0.51 il segno non e' distinguibile dal caso: sui soli casi persi M4 e' priva di potenza.

(c) LO SPECCHIO — errore del NUOVO sui 37 casi in cui il vecchio tace
LETTURA A: tutti n=260 mediana 1 media 1.39 esatti 98 (37.7%) | TENUTI n=223 mediana 1 media 1.28 esatti 90 (40.4%) | GUADAGNATI n=37 mediana 2 media 2.03 esatti 8 (21.6%) entro1 16 (43.2%)
  D: mediana +1 · media +0.74 · quota esatti -18.7 punti · p mediane 0.0776, p quota esatti 0.0427
LETTURA B: tutti n=260 mediana 1 media 1.26 esatti 106 (40.8%) | TENUTI n=223 mediana 1 media 1.13 esatti 98 (43.9%) | GUADAGNATI n=37 mediana 2 media 2.03 esatti 8 (21.6%)
  D: mediana +1 · media +0.89 · quota esatti -22.3 punti · p mediane 0.1221, p quota esatti 0.0108
=> la copertura in piu' del nuovo NON e' gratis: sono le sue risposte peggiori.

(b2) LA REGIONE DEL SILENZIO — accuratezza per fascia di giro della sosta (soste vere)
fascia  casi  ris.V  ris.N | VECCHIO mediana|esatti (A) | VECCHIO (B) | NUOVO (B)
 4-8      5     3      0   | 1 | 33.3% (n=3)  | 0 | 66.7% (n=3)  | n/d (mai risponde)
 9-13    41    41     34   | 2 | 22.0% (n=41) | 2 | 22.0% (n=41) | 2 | 23.5% (n=34)
14-20    67    67     65   | 2 | 22.4% (n=67) | 1 | 32.8% (n=67) | 1 | 36.9% (n=65)
21-30    60    58     60   | 1 | 29.3% (n=58) | 1 | 44.8% (n=58) | 1 | 43.3% (n=60)
31-45    44    42     44   | 1 | 47.6% (n=42) | 0 | 61.9% (n=42) | 0 | 61.4% (n=44)
46-99    57    24     57   | 0 | 54.2% (n=24) | 0 | 62.5% (n=24) | 1 | 36.8% (n=57)
VECCHIO, sosta <=13 (regione muta del nuovo) contro sosta >13:
  A: <=13 n=44 mediana 1.5 media 2.05 esatti 10 (22.7%) entro1 22 (50.0%) | >13 n=191 mediana 1 media 1.55 esatti 65 (34.0%) entro1 117 (61.3%) · D quota esatti -11.3 punti · p mediane 0.1179, p quota esatti 0.1570
  B: <=13 n=44 mediana 1.5 media 1.91 esatti 11 (25.0%) entro1 22 (50.0%) | >13 n=191 mediana 1 media 0.97 esatti 89 (46.6%) entro1 142 (74.3%) · D quota esatti -21.6 punti · p mediane 0.1783, p quota esatti 0.0106
=> il nuovo tace ESATTAMENTE dove il vecchio vale meno (25.0% contro 46.6% di esatti, p=0.0106). Non pero' dove vale zero: li' il vecchio prende comunque il 50% entro una posizione.

(d) DOVE STANNO
CASI PERSI (n=12): giro sosta min 6 · mediana 9 · max 15 · frazione di gara mediana 0.16 · fasce 1-10: 9, 11-20: 3, 21+: 0 · per gara Cina 4, Belgio 2, Miami 2, Monaco 2, Canada 1, Ungheria 1 · neutralized al congelamento 1/12 (8.3%) · passo del vecchio presente 12/12
  elenco: Belgio|PER|12, Belgio|SAI|14, Canada|NOR|15, Cina|LAW|9, Cina|SAI|9, Cina|VER|9, Cina|HAD|10, Miami|BOT|6, Miami|VER|6, Monaco|OCO|9, Monaco|PER|9, Ungheria|STR|8
CASI GUADAGNATI (n=37): giro sosta min 23 · mediana 67 · max 72 · frazione 0.86 · fasce 41-99: 35 · per gara Monaco 33, Giappone 2, Gran Bretagna 2 · neutralized 34/37 (91.9%), regime SC 34 / verde 3 · senza passo del vecchio 37/37
MUTI DA ENTRAMBI (n=2): Monaco|PER|4, Monaco|STR|4
RIFERIMENTO (tutti i 274): fasce 1-10: 19, 11-20: 94, 21-30: 60, 31-40: 33, 41-99: 68 · mediana 23 · neutralized 52/274 (19.0%)

(e) CAMPIONE LARGO — 11.980 congelamenti generici (ogni pilota in pista, ogni giro L, sosta a L+1)
risponde il VECCHIO 10.196 (85.1%) · il NUOVO 10.315 (86.1%) · saldo +119 · solo il vecchio 1.328 · solo il nuovo 1.447
tace il NUOVO: 1.639x "non ha un passo base" + 26x "mescola non nota o non slick" · tace il VECCHIO: 1.784x "non in pista al giro scelto"
copertura per fascia di giro della sosta (domande / vecchio / nuovo / soloV / soloN):
 1-5     464   266 (57.3%)      0 (0.0%)   266    0
 6-10   1138  1065 (93.6%)    209 (18.4%)  856    0
11-15   1120   987 (88.1%)    908 (81.1%)  177   98
16-20   1095   918 (83.8%)   1080 (98.6%)   12  174
21-30   2150  1746 (81.2%)   2142 (99.6%)    0  396
31-40   2082  1833 (88.0%)   2072 (99.5%)    0  239
41-99   3931  3381 (86.0%)   3904 (99.3%)   17  540
giro per giro: sosta al giro 4 vecchio 40.9% / nuovo 0.0% · 5: 73.7% / 0.0% · 6: 86.1% / 0.0% · 7: 87.7% / 0.0% · 8: 96.9% / 0.0% · 9: 98.7% / 30.1% · 10: 98.7% / 62.4% · 12: 92.0% / 77.8% · 14: 83.4% / 86.1% · 16: 77.4% / 95.5% · 17: 85.9% / 98.2%
=> 1.299 dei 1.328 casi persi (97.8%) hanno la sosta entro il giro 15; 1.122 (84.5%) entro il giro 10.
per gara (saldo / soloV / di cui sosta<=15 / soloN): Australia +7 / 102 / 100.0% / 109 · Austria +36 / 102 / 100.0% / 138 · Belgio -44 / 128 / 100.0% / 84 · Canada -35 / 124 / 96.8% / 89 · Cina -30 / 94 / 100.0% / 64 · Giappone +59 / 110 / 100.0% / 169 · Gran Bretagna +48 / 114 / 100.0% / 162 · Miami -160 / 219 / 96.3% / 59 · Monaco +170 / 100 / 100.0% / 270 · Spagna +41 / 125 / 86.4% / 166 · Ungheria +27 / 110 / 100.0% / 137

LA CAUSA, LETTA NEL CODICE (non dedotta):
NUOVO — simulatore/scenario/costruttore.mjs:31 `const MIN_GIRI_BASE = 8;` usato a :171 con `stimaBasi(osservazioniVerdi(...), { finoA: freezeLap, minGiri: MIN_GIRI_BASE })`; simulatore/engine/passo_v2.mjs:67 `basi[drv] = valori.length >= minGiri ? mediana(valori) : null`. Servono 8 giri VERDI cumulati dall'inizio gara: prima e' muto per costruzione.
VECCHIO — simulatore/provenienza/esporta_demo_gara.mjs:110 `if (v.length < 3) return null;` su :106 `if (c.stint !== cur.stint) continue`. Servono 3 giri verdi NELLO STINT CORRENTE: si azzera a ogni sosta e sotto neutralizzazione lunga.
Verificato su Monaco: al giro 65 sono neutralizzati 17/17 piloti e demo/data/Monaco.json ha `pace` per 4 piloti soli ai giri 63-71 (11 al giro 60) -> di li' i 33 "guadagni" del nuovo.
```

### M5 — vince PARI · cancello False · verifica regge: True

```
CANCELLO M5: CADE. Copertura complessiva 175/260 = 67,3% (contro l'80% pre-registrato e l'88,5% dichiarato in banda_rientro.json). Contando i 14 muti come non coperti (la prereg dice che il silenzio è un esito): 175/274 = 63,9%.

PERIMETRO: 274 soste ammesse su 459 trovate (escluse: pit≤3 22, senza cum al rientro 23, doppiato al rientro 140). Il nuovo risponde 260/274, muto 14 (tutti «nessuna posizione: il pilota non ha un passo base», regola 6). Banda presente in 260/260 delle risposte, mai null.

PER GARA (banda del nuovo, 260 casi — blocchi = gare, nessuna media nascosta):
Australia 7/21 33,3% · Austria 22/28 78,6% · Belgio 11/18 61,1% · Canada 4/10 40,0% · Cina 3/11 27,3% · Giappone 15/24 62,5% · Gran Bretagna 22/30 73,3% · Miami 14/16 87,5% · Monaco 30/43 69,8% · Spagna 19/29 65,5% · Ungheria 28/30 93,3%.
Mediana delle 11 quote 65,5% · gare sotto l'80%: 9 su 11.

PER GARA, I DUE MOTORI SUGLI STESSI CASI (223 dove rispondono entrambi; NUOVO banda del modello vs VECCHIO con una banda ±1 che non possiede):
Australia 7/21 33,3% vs 11/21 52,4% · Austria 22/28 78,6% vs 18/28 64,3% · Belgio 11/18 61,1% vs 5/18 27,8% · Canada 4/10 40,0% vs 3/10 30,0% · Cina 3/11 27,3% vs 2/11 18,2% · Giappone 13/22 59,1% vs 11/22 50,0% · Gran Bretagna 21/28 75,0% vs 20/28 71,4% · Miami 14/16 87,5% vs 9/16 56,3% · Monaco 10/10 100% vs 10/10 100% · Spagna 19/29 65,5% vs 17/29 58,6% · Ungheria 28/30 93,3% vs 22/30 73,3%. (A Monaco il vecchio risponde solo su 10 delle 43 soste.)

SOTTO/FUORI NEUTRALIZZAZIONE:
contesto banda VERDE 140/209 = 67,0% (dichiarato 88,5%: −21,5 punti) · contesto NEUTRA 35/51 = 68,6% (dichiarato 85,7%: −17,1 punti).
regime al congelamento: verde 140/209 67,0% · SC 27/41 65,9% · VSC 8/10 80,0%.
Diagnostica col futuro (il prodotto non lo sa al congelamento): banda VERDE con sosta poi in verde 117/139 = 84,2%; banda VERDE con sosta poi NEUTRALIZZATA 23/70 = 32,9%; NEUTRA con sosta neutralizzata 34/48 = 70,8%.

LA BANDA È QUASI SEMPRE 1 — SÌ: semi_ampiezza prende solo due valori, letti da tabella e non calcolati sul caso: ±1 in 209 casi (80,4%), ±2 in 51 (19,6%). Larghezza effettiva media 3,22 posizioni su un campo medio di 19,3 auto = 16,7% dello schieramento. Copertura per larghezza: 2 posizioni 13/19 68,4% · 3 posizioni 134/200 67,0% · 4 posizioni 3/5 60,0% · 5 posizioni 25/36 69,4% — la larghezza non compra copertura. 55 bande (21,2%) sono tagliate dal bordo del campo e coprono il 61,8% contro il 68,8% delle 205 non tagliate.

MERITO DELLA BANDA O DEL MOTORE (stessi 223 casi con risposta doppia):
NUOVO punto secco 37,7% (98/260) · NUOVO con banda del modello 152/223 68,2% · NUOVO ±1 costante 150/223 67,3% · NUOVO ±2 176/223 78,9% · VECCHIO punto secco 71/223 31,8% · VECCHIO ±1 128/223 57,4% · VECCHIO ±2 163/223 73,1% · baseline INERTE (resti dov'eri al congelamento) ±1 115/260 44,2%.
Riclassificando previsioni e verità sulla POPOLAZIONE COMUNE (il denominatore fuori dal conto: su_nuovo ≠ su_vero in 93/260 casi): NUOVO banda 158/223 70,9% · NUOVO ±1 156/223 70,0% · VECCHIO ±1 157/223 70,4% · NUOVO ±2 188/223 84,3% · VECCHIO ±2 188/223 84,3% (insiemi non identici: 183 coperti da entrambi, 5 solo dal nuovo, 5 solo dal vecchio, 30 da nessuno). Il vantaggio grezzo del nuovo (+10,8 punti) scende a +0,5 punti sulla popolazione comune.

CALIBRATA O SOLO LARGA — né l'una né l'altra: è STRETTA e MAL CENTRATA.
VERDE (n=209): ±0 41,1% (larg. 1,00) · ±1 67,0% (2,91) · ±2 78,5% (4,76) · ±3 89,0% (6,51) · ±4 94,7% (8,21).
NEUTRA (n=51): ±0 23,5% (1,00) · ±1 51,0% (2,80) · ±2 68,6% (4,51) · ±3 82,4% (6,04) · ±4 92,2% (7,31).
|errore| del punto: mediana 1, p80 3, p90 4, max 6 (grezzo); mediana 1, p80 2, p90 3 (popolazione comune).
BIAS CON SEGNO (previsto − vero; positivo = il nuovo mette il pilota troppo indietro): mediana +1, media +1,08 su tutti; VERDE mediana +1 media +1,07; NEUTRA mediana +1 media +1,12; sosta poi in verde mediana 0 media +0,35; sosta poi neutralizzata mediana +2 media +1,96. Il file dichiara bias_mediano_posizioni = 0.
Degli 85 casi fuori banda, 77 sono per pessimismo (la posizione vera è MIGLIORE del bordo alto) e solo 8 per ottimismo. Distanza dal bordo: 1→31, 2→30, 3→15, 4→4, 5→5.
BANDA ASIMMETRICA minima che raggiunge l'80%: VERDE (−3, +0) → 83,3% con larghezza media 3,89 (meno larga dell'attuale ±2 simmetrico, che si ferma al 78,5% con 4,76); NEUTRA (−5, +0) → 82,4% con larghezza 5,20 (contro ±3 simmetrico, 82,4% con 6,04).

CONTROFATTUALE SULLA CONVENZIONE DEL CONTESTO: assegnando VERDE/NEUTRA col regime alla sosta e al rientro (come fa il banco che ha prodotto l'88,5%) invece che al congelamento (come fa il prodotto), il contesto cambia in 80/260 casi e la copertura sale a 185/260 = 71,2% con larghezza media 3,75. La convenzione vale quindi 3,8 punti: i restanti ~17 punti di divario con l'88,5% non sono la convenzione.

DA DICHIARARE: banda_rientro.json è calibrato sulle stesse 11 gare 2026 usate qui — la misura è in-sample e la copertura vera fuori campione può solo essere peggiore. Il perimetro esclude 140 soste per doppiaggio al rientro (46 delle quali doppiate PER EFFETTO della sosta), cioè proprio i casi in cui fermarsi costa di più.
```
