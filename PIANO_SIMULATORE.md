# PIANO SIMULATORE — da esploratore pit a simulatore di strategia

**Decisione del PO, 28/07/2026: strada A.** Passo per mescola, degrado per mescola,
carburante, bagnato, e il **piano gomme fino alla bandiera**. Con un vincolo esplicito che
il PO ha messo per iscritto e che vale come regola di progetto:

> *«Non deve essere perfetto, sappiamo che non lo sarà mai. Abbiamo dati storici ma
> soprattutto dati live, dove il motore si deve costantemente adattare. Se i dati storici ci
> dicono che in quella pista la gomma non degrada ma in live i team stanno facendo massimo
> 10 giri su quella mescola, qualcosa non va e il modello si adatta.»*

Questo documento è il contratto. I cancelli qui sotto **non servono a bloccare la
pubblicazione**: servono a impedire che una cosa sbagliata venga mostrata *senza che si
sappia che è sbagliata*. Un numero incerto e dichiarato si pubblica. Un numero incerto e
travestito da misura, no.

---

## 0. LA PROMESSA NUOVA, E IL SUO PREZZO

**Oggi il prodotto promette:** «se fermo questo pilota adesso, dove rientra» — campo
congelato, orizzonte 6 giri, tutto misurato su questa gara.

**Da oggi promette:** «dato dove siamo, quale piano gomme conviene fino alla bandiera, e
quanto sono sicuro».

Il prezzo va scritto qui, in cima, perché è la cosa che cambia davvero:

| | prima | dopo |
|---|---|---|
| natura dei numeri | **misurati** su questa gara, o silenzio | **misurati dove si può, modellati dove serve — sempre etichettati** |
| orizzonte | 6 giri | fino alla bandiera |
| la mescola | non muove niente, ed è dichiarato | **muove il passo, il degrado e la durata dello stint** |
| il bagnato | rifiuto totale | regime proprio, con la sua incertezza |
| quando non so | taccio | **dico quanto non so, e mostro la banda** |

La regola della casa si aggiorna di conseguenza, e questa riga sostituisce «se un dato non
c'è, non lo mostriamo»:

> **Un modello dichiarato, con la sua incertezza e con un banco che possa bocciarlo, è
> meglio del silenzio. Quello che resta vietato è il numero senza targhetta.**

---

## 1. DA DOVE PARTIAMO — misurato il 28/07/2026

Tutto quello che segue è stato rimisurato oggi sul codice di produzione, non ripreso dai
report. I comandi sono in coda al documento (§10).

### 1.1 Il motore non sa rispondere a «quando»

`confrontaPit`, «mi fermo fra 1 giro» contro «mi fermo fra 8 giri», stesso giro finale,
11 gare demo:

```
718 confronti — conviene fermarsi SUBITO: 718 (100,0%)
                conviene ASPETTARE:         0 (0,0%)
                vantaggio mediano dell'anticipo: −8,2 s   (min −0,56  max −19,4)
```

**Non è un errore di taratura: è la forma del modello.** Dopo la sosta il pilota prende un
`gradino` costante (−0,92 s/giro a Spa) e la gomma vecchia non degrada mai in quel percorso
di calcolo. La derivata del tempo rispetto al giro di sosta è quindi una costante negativa:
anticipare è sempre meglio, di 0,92 s per giro d'anticipo. Non esiste un minimo interno,
quindi non esiste una domanda.

### 1.2 Quanto tace, e dove

Su 12.454 combinazioni (pilota, giro) delle 11 gare:

| | |
|---|---|
| nessuna risposta | **17,3 %** — di cui 72,4 % «servono 3 giri puliti», 22,7 % «appena uscito dai box», 4,9 % meteo |
| primi giri di ogni gara | **mai una risposta** fino al giro 3–7 (Spa: giro 7) |
| finestra pit di Spa (giri 18–23) | il campo valutabile scende a **6–8 piloti su 22** |
| risposta = «non cambia niente» | **26,6 %** |
| gap mostrato come numero vero | **45,7 %** (30,6 % «quasi appaiati», 23,6 % soppresso) |
| gruppo su cui si risponde | **13,1 piloti in media**, su 19,2 in pista |

Il motore si spegne proprio dove la gara si decide.

### 1.3 Su quanto poggia, oggi

`gen_backtest_strategia.mjs`: 459 soste reali trovate, 333 valutabili, e la riga che misura
davvero il modello — campo fermo, previsione non incollata al fondo o alla testa — è:

```
PULITA non saturata:  11 casi,  7/11 esatte
```

Undici casi. Non è un rimprovero: è la ragione per cui la Fase 0 di questo piano è un banco
nuovo e non una funzionalità.

---

## 2. IL MODELLO BERSAGLIO

Un solo tempo sul giro, scritto una volta e usato ovunque (replay, live, ricerca del piano):

```
t(pilota, giro) =  base(pilota)                     passo intrinseco, a serbatoio vuoto,
                                                    gomma nuova, mescola di riferimento
                 + Φ · carburante(giro)             §3.1
                 + C(mescola)                       §3.2   ← oggi = 0
                 + ρ(mescola, circuito) · età       §3.3   ← oggi = 0
                 + W(regime, stato pista)           §3.4   ← oggi = rifiuto
                 + traffico(gap davanti)            esistente, calibrato, spento di default
```

La sosta **non è un gradino**: è un `età := 0` più `pit_loss`. È tutta qui la differenza fra
un esploratore e un simulatore.

### Perché questo fa nascere la domanda «quando»

Con l'età esplicita, il tempo totale da qui alla bandiera per una sosta al giro `L+p` è

```
ρ · [ Σ(a₀+k, k=1..p)  +  Σ(j, j=1..R−p) ]  +  pit_loss
```

il cui minimo cade a **p\* = (R − a₀)/2**: un ottimo **interno**, che dipende dall'età della
gomma che hai adesso. Verificato numericamente con ρ = 0,0512 (HARD, il coefficiente che
abbiamo già in casa) e pit-loss 23,36 s:

```
giri rimasti 24, gomma di 20 giri  ->  ottimo a +2 giri   (subito 38,57 s | ottimo 38,52 s)
giri rimasti 24, gomma di  5 giri  ->  ottimo a +9 giri   (subito 37,80 s | ottimo 34,11 s)
giri rimasti 34, gomma di 12 giri  ->  ottimo a +11 giri  (subito 52,75 s | ottimo 47,63 s)
```

E la divisione del lavoro fra i due parametri è netta, il che rende il modello leggibile
invece che magico:

- **ρ decide QUANDO** fermarsi (dove cade il minimo).
- **pit_loss contro ρ decide QUANTE volte** fermarsi.

---

## 3. I QUATTRO INGREDIENTI — e quanto è già in casa

Buona notizia: tre dei quattro esistono già in repo, misurati, con intervallo di confidenza,
e **spenti**. Non sono spenti perché sbagliati: sono spenti perché sono stati giudicati su un
bersaglio diverso da quello del prodotto.

### 3.1 Carburante — il debito più grosso, e il più facile

`engine/LIMITI_NOTI.md` lo dice già senza sconti: il motore simula **−1,86 s/giro più veloce
del vero**, di cui **−1,480 s/giro è carburante mai ri-aggiunto** (`pace_base` è a serbatoio
vuoto e `simulate` non lo ri-gonfia mai) e −0,403 s/giro è la gomma più vecchia del passo
misurato.

E la riga che conta per noi, sempre da lì:

> «*questa strategia batte quella vera?*» → **NO** — il bias dominerebbe la risposta.

Cioè: **l'uso che il PO ha appena scelto è esattamente quello che il documento dei limiti
marca come inaffidabile.** Quindi il carburante non è la Fase 3, è la Fase 1. Senza, tutto
il resto si costruisce su 1,9 s/giro di errore sistematico.

Lo stato dei numeri:

| | s su 70 kg | dentro l'IC95 implicito [1,693 – 2,908]? |
|---|---|---|
| kernel `engine.py` (`3.0/70.0`) | 3,000 | **fuori** |
| fondo 2022–25 (era vecchia) | 3,151 | **fuori** |
| **fondo 2026** | **2,194** | **dentro** |

Da fare: **P1** (ri-gonfiare il carburante dentro il simulatore) e **P2** (`FUEL_COEFF` per
regime, non costante cablata). `LIMITI_NOTI.md §6` li ha già scritti come non-fatti, e per P2
suggerisce già da solo la casa giusta: *«il suo posto naturale non è cablato nel kernel ma nel
pattern dei modelli-vivi, con targhetta e ricalibrazione a ogni gara»*. È esattamente quello
che chiede il PO.

### 3.2 Passo per mescola — l'unica cosa mai misurata

`grossi.mjs` spegne la mescola su un NULL a p = 0,24–0,58, misurato su 10 gare 2026. Ma quel
NULL riguarda **tre grandezze derivate** (gradino alla sosta, warm-up, pendenza), non il
livello. E il codice stesso dichiara il buco:

> *«NULL NON VUOL DIRE ZERO: l'esperimento è cieco sotto 0,81 s/giro sul gradino fra SOFT e
> HARD»*

Il **delta di passo fra mescole a pari carburante, pari età, pari pilota** non è mai stato
stimato. Ed è quello che il PO chiede («la soft entra più veloce della dura»). La base per
farlo è in repo e non è piccola:

```
data/fondo/ — 173 gare 2018-2025
  HARD 68.739 giri · MEDIUM 64.461 · SOFT 33.574 · (+ SUPERSOFT/ULTRASOFT/HYPERSOFT 11.239)
```

Il confronto grezzo è avvelenato (la SOFT si monta al 67 % della gara, la HARD al 44 %:
si confonde la gomma col momento). L'identificazione va cercata dove le due mescole
**coesistono**: stessa gara, stessa finestra di giri, compagni di squadra su mescole diverse,
e stint adiacenti dello stesso pilota.

### 3.3 Degrado per mescola — rimisurato dal grezzo in Fase 0

> **Aggiornato 28/07/2026 dopo la Fase 0.** Questa sezione citava
> `data/modello_degrado_2026.json` («già calibrato, già spento»). Era **fuorviante**: quel
> file dichiara da solo `ACCENDIBILE = false` — il suo cancello di accensione era fallito
> (guadagno mediano −22,9 s, IC95 che contiene lo zero). Non era pronto e da accendere: non
> era utilizzabile. I numeri qui sotto sono **ricostruiti dal grezzo**, 10 gare, Monaco
> escluso, pre-registrati in `ai_lab/simulatore/PREREG_fase0.md` e riportati in
> `ai_lab/simulatore/REPORT_FASE0.md`.

```
rho comune   0,0389   IC95 [0,0220 ; 0,0629]    <- non contiene lo zero
rho SOFT     0,0335   IC95 [0,0101 ; 0,0940]
rho MEDIUM   0,0366   IC95 [0,0180 ; 0,0662]
rho HARD     0,0410   IC95 [0,0249 ; 0,0679]
rho SOFT - rho HARD  = -0,0075   IC95 [-0,0337 ; 0,0488]   p(permutazione) = 0,209
ordine SOFT>MEDIUM>HARD spontaneo: 2 gare su 10
```

Due letture, tutte e due vere:

1. **La differenza fra mescole non si separa** (l'IC della differenza contiene lo zero, il
   nullo non si rifiuta, l'ordine non esce).
2. **Il degrado medio c'è ed è solido**: ρ ≈ 0,039 s/giro per giro di vita gomma, e l'IC
   esclude lo zero per tutte e tre le mescole prese singolarmente.

**E un terzo fatto, che il vecchio lavoro non guardava**: le mescole si separano benissimo
su **quanto le tengono** — durata mediana degli stint chiusi SOFT 14, MEDIUM 19, HARD 22
giri. Che le squadre le trattino in modo diverso è misurato. Che le pendenze non lo mostrino
è un limite dello stimatore, non una prova di uguaglianza.

`LIMITI_NOTI.md §5` conclude che aggiungerlo «non migliora le distanze». È vero, ed è
irrilevante per noi: le distanze *fra piloti* non migliorano perché **degradano tutti uguale**.
Ma la strategia non vive sulla differenza fra piloti, vive sul **livello assoluto**: è il
termine che fa nascere l'ottimo interno di §2. È la stessa lezione di metodo che il progetto
ha già imparato sul cap del traffico e scritto in `LIMITI_NOTI.md §4`:

> *«un ottimo misurato su una popolazione in cui il fenomeno non c'è non è un ottimo. È
> un'assenza scambiata per una risposta.»*

**Quindi: si accende il degrado medio subito (Fase 2), e la separazione per mescola resta una
domanda aperta da vincere sul fondo storico (Fase 3), non un prerequisito.**

### 3.4 Bagnato — mai tentato

Oggi `grossi.mjs::meteo` rifiuta tutto sul bagnato. La nota di progetto dice «il 2026 ha 14
giri su intermedia, non abbiamo materiale»: vero per il 2026, **falso per il fondo**.

```
20 gare con giri su gomma da bagnato · INTERMEDIATE 9.365 giri · WET 733 giri
```

Il bersaglio non è «quanto va piano l'intermedia»: è il **crossover**, cioè il giro in cui
conviene cambiare regime. È osservabile direttamente in quelle 20 gare, ed è la cosa che il
PO ha chiesto («se metti l'intermedia quando è asciutto deve andare molto più lento»).

---

## 4. L'ADATTAMENTO VIVO — il pezzo che il PO ha chiesto

Questo è il cuore del piano, non un accessorio. E c'è una ragione tecnica per cui è il cuore,
non solo una preferenza del PO: **il 2026 ha cambiato le gomme**. Il fondo storico 2018–2025
è un prior, non una verità; e i coefficienti per-circuito del vecchio regime si spostano. Un
simulatore che si fidasse dello storico sarebbe sbagliato nel modo peggiore: sbagliato con
sicurezza.

### 4.1 Le due sorgenti, e come si pesano

Per ogni coefficiente vivo (ρ per mescola, Φ carburante, C mescola, W bagnato):

```
stima(t) = w(t) · VIVO(giri visti finora in questa sessione)
         + (1 − w(t)) · PRIOR(fondo, per circuito e mescola, pesato sul recente)

w(t) = n_vivo / (n_vivo + k)        k = forza del prior, dalla dispersione del fondo
```

Nessuna magia: è uno shrinkage, con `k` **derivato** dalla varianza fra gare del fondo e non
scelto a mano. Con pochi giri comanda lo storico; con la gara in corso comanda la gara.

**Vincolo di causalità, non negoziabile:** il vivo si calcola **solo sui giri già completati**.
Vale in replay come in diretta. È la stessa disciplina che il progetto applica già al
`gradino` (`gradino.mjs`: solo le soste già avvenute prima del congelamento).

### 4.2 L'allarme di incoerenza — il caso che il PO ha descritto

*«Lo storico dice che qui la gomma non degrada, ma i team stanno facendo massimo 10 giri su
quella mescola.»*

Va gestito, e va gestito **onestamente**, perché la durata di uno stint è una **decisione**,
non una misura — `grossi.mjs` lo sa già e lo scrive: *«è la durata SCELTA dalle squadre, non
quella POSSIBILE»*. Uno stint corto può essere degrado, ma anche una Safety Car, un
undercut, o un piano a due soste deciso al sabato.

Quindi la durata degli stint **non entra come stima**. Entra come **allarme**, in tre passi:

1. **Attesa.** Dal prior si deriva la finestra di durata plausibile per quella mescola su
   quel circuito (il giro oltre cui il degrado accumulato supera il pit-loss).
2. **Confronto.** Si guarda la durata degli stint **già chiusi** in questa sessione, escludendo
   quelli chiusi sotto neutralizzazione o al primo giro (non sono decisioni di degrado).
3. **Reazione**, e sono tre cose diverse che non vanno confuse:
   - il peso `w` del vivo **sale** (il prior ha perso credibilità su questo circuito);
   - la **banda d'incertezza si allarga** invece di restringersi;
   - in pagina compare la riga, in chiaro: *«lo storico diceva 18 giri su questa mescola, oggi
     nessuno supera i 10: sto dando più peso a quello che vedo»*.

Il punto 3 è la parte che rende il meccanismo un prodotto e non un trucco: **chi guarda deve
vedere il modello cambiare idea, e perché.** Un modello che si adatta di nascosto è peggio di
uno rigido.

### 4.3 Dove vive

Nel pattern che esiste già: `gen_modelli_lab.py` + `ai_lab/scienziato/autocalibra.py`, con
targhetta (N gare, data, di quanto si è mosso) e cancello d'accensione umano. La novità è la
**seconda scala temporale**: oggi i modelli si ricalibrano *dopo* ogni gara, da domani devono
farlo anche *dentro* la gara. Stessa forma, stessa targhetta, stesso registro — orizzonte
diverso.

---

## 5. I RIVALI — smettere di estrapolarli quando li conosciamo

Cambio architetturale che costa poco e vale molto.

Oggi, anche in replay, i rivali vengono **estrapolati** da una `pace` mediana congelata. Ma in
replay noi **abbiamo i loro tempi veri per tutta la gara**: sono in `byLap[*].cum_time`. E
l'assunzione del prodotto è già che la mia scelta non li tocca (*«il motore riproduce quanti
cambi di posizione avvengono, non quali»*).

Quindi, in replay: **i rivali sono i loro tempi reali, giro per giro, fino alla bandiera.**
Nessun modello, nessun errore che si accumula, e la simulazione può arrivare in fondo senza
diventare finzione. Si modella **solo la macchina instradata** — che è, alla lettera, la
promessa scritta in testa a `muretto.mjs`.

In diretta i rivali vanno estrapolati per forza: lì valgono gli stessi ingredienti di §2, e lì
l'incertezza va mostrata. **Le due modalità vanno dichiarate in pagina**, perché la qualità
della risposta è diversa e chi guarda ha diritto di saperlo.

---

## 6. IL PIANO GOMME FINO ALLA BANDIERA

### 6.1 Cosa si cerca

Uno **stint** è `(mescola, giro d'ingresso)`. Un **piano** è una sequenza di stint dal giro
corrente alla bandiera. Si cerca il piano che minimizza il tempo alla bandiera, e si
restituisce la **posizione** che ne consegue.

Vincoli, tutti già codificati o osservabili, nessuno da inventare:

- **due mescole obbligatorie** in gara asciutta (`grossi.mjs::regolaDueMescole` — verificato
  100 % dove vale);
- se piove, il vincolo cade;
- i set disponibili in garage **non sono nel feed** — limite noto, va detto e non aggirato.

### 6.2 Costo di calcolo

Con `simulaConSoste` (che accetta già un array di soste) e ~40 giri residui:

| | combinazioni | fattibile nel browser |
|---|---|---|
| 1 sosta | 40 giri × 3 mescole = **120** | banalmente |
| 2 soste | ~780 coppie × 9 = **~7.000** | sì, con potatura |
| 3 soste | ~10⁵ | solo con potatura (monotonia in §2) |

Il minimo è convesso nel giro di sosta (§2), quindi la ricerca si pota bene. Nessun bisogno di
forza bruta.

### 6.3 Cosa si mostra — e qui muore il muro di testo

Il pannello di oggi è un quaderno di laboratorio: ~1.900 caratteri, 15 blocchi, 8 avvertenze,
e il bottone `BOX` sta 500 px sotto la piega. La hero, che il PO ha indicato come bersaglio,
dice la stessa cosa in **una riga**.

Struttura nuova, tre livelli, e nessuna informazione va persa — cambia solo l'ordine:

1. **Il verdetto.** Una riga: *«fermati al giro 27 con la MEDIUM → finisci P4»*, con la banda:
   *«P3–P6»*.
2. **La curva del quando.** Asse giri, asse secondi persi, il minimo evidenziato, la banda
   d'incertezza intorno. **È il grafico che oggi manca del tutto**, ed è quello che rende
   visibile la parola «quando».
3. **Il perché**, a scomparsa: pit-loss e provenienza, ρ e da dove viene, carburante, le
   avvertenze, l'allarme di incoerenza di §4.2. Tutto quello che c'è oggi, un dito più in giù.

E la scena, che oggi contraddice il prodotto:

- la mappa **non si spegne più** quando esplori: il fantasma va **sopra** il replay reale,
  non al posto suo;
- la torre non perde 14 piloti su 22 (conseguenza diretta di §5 e §7 Fase 6);
- la sosta si **vede** anche nel replay reale: pit-lane vera per circuito (i GPS ci sono già;
  oggi è una corsia stilizzata identica per tutti gli 11 tracciati, con ingresso/uscita
  cablati a 0,95/0,05) e **auto ferma** durante lo stop, invece di un'auto che rallenta.

---

## 7. LE FASI, CON I CANCELLI

Ogni fase ha un cancello **falsificabile**. Un cancello che non passa non blocca il prodotto:
degrada l'ingrediente a «dichiarato» e lo mostra con la sua banda. Quello che non è ammesso è
passare oltre in silenzio.

### Fase 0 — Il banco della domanda giusta ✅ **FATTA il 28/07/2026**

Costruito in `ai_lab/simulatore/`: per ogni sosta reale, **la curva completa** del costo in
funzione del giro di sosta, fino alla bandiera.

> **Cancello G0.** Il motore deve produrre un ottimo **interno** (né il primo né l'ultimo giro
> disponibile). Soglia: ≥ 80 %.
>
> **Misurato: G0 = 0,0 %** — 0 ottimi interni su 249 soste in cui il motore ha una preferenza;
> 247 su 249 al primo giro utile. Le altre 88 soste hanno la curva **piatta a 0,000 s**: lì il
> motore non ha proprio nessuna preferenza (`gradino` non ancora misurabile).
>
> **Lo strumento è validato:** la stessa meccanica, col termine di età gomma misurato dal
> grezzo, trova 252 ottimi interni + 85 «fermati subito» corretti = **337 su 337**. Lo 0,0 %
> è una proprietà del motore, non del banco.

Report completo: `ai_lab/simulatore/REPORT_FASE0.md`. Pre-registrazione:
`ai_lab/simulatore/PREREG_fase0.md`.

**Fase 0 ha anche prodotto**, come sottoprodotti non previsti:
- il **ρ ricostruito dal grezzo** (§3.3), che sblocca la Fase 2;
- la **verifica che i derivati sono fedeli al grezzo** (12.733 celle), che rende lecito
  misurare il motore sui suoi input di produzione;
- un **difetto in produzione**: il letterale `"None"` non lavato in
  `demo/data/Ungheria.json` (25 celle, PER giri 22-46). Il motore è salvo, la pagina no.

### Fase 1 — La deriva di gara ✅ **FATTA il 28/07/2026** (pubblicazione da decidere)

Modello **simmetrico**: si sottrae e si ri-aggiunge la stessa quantità. Report completo:
`ai_lab/simulatore/REPORT_FASE1.md`.

> **Cancello G1 / T5.** Bias sui tempi assoluti **da −2,19 a −0,54 s/giro**, MAE **da 2,19 a
> 0,76** (−65 %). Soglia 0,50 → **NON PASSA per 4 centesimi** a 10 e 20 giri.
>
> **T6 (le posizioni): PASSA in modo netto — 0 su 338.** Il modello è più vero sui tempi e
> identico su ciò che il prodotto mostra.
>
> **Il residuo ha un nome:** cresce con l'orizzonte (−0,46 → −0,54 → −0,66), che è la firma di
> un termine che si accumula. Con ρ acceso (Fase 2) il bias diventa **−0,17 e piatto**.
> Deriva + degrado insieme: bias **−92 %**, MAE **−73 %**.

**Quanto vale Δ:** storico 2018-2025 **3,111 s** [2,926 ; 3,254], 2026 **3,170 s**. Il 3,0 del
kernel **regge**: il problema non era il valore, era che non veniva mai ri-aggiunto.

**Φ per circuito: NO.** T2 (la deriva è di circuito) e T3 (batte il Φ unico fuori campione)
non passano — 4 gare su 10. Va online un **Φ unico di regime**.

**Correzioni a Fase 0 uscite da qui**, entrambe scritte nel report:
- il Φ di Fase 0 (−0,0448) **poolava fra gare**, contro una regola già scritta del progetto:
  superato dal Δ per-gara;
- `degrado.py` aveva un disegno a rango non pieno risolto da una **pinv silenziosa**; corretto,
  e verificato che ρ e Φ **non si muovono di una cifra**.

> **Raccomandazione**: pubblicare **Fase 1 e Fase 2 insieme**. Fase 1 da sola è a rischio zero
> (T6 = 0) ma **invisibile** — il pannello mostra posizioni, non tempi assoluti. È
> infrastruttura, e diventa una funzionalità con la Fase 2.

### Fase 2 — Degrado medio: l'età-gomma ✅ **FATTA il 28/07/2026** (pubblicazione da decidere)

Report: `ai_lab/simulatore/REPORT_FASE2.md`. La sosta smette di essere uno **sconto costante** e
torna a essere un **azzeramento dell'età**.

> **G0: da 0,0 % a 70,0 %**, e spariscono tutte le 88 curve piatte. Soglia 80 % → **non passa**.
> Ma i 101 casi al bordo sono **tutti analiticamente corretti** («fermati subito», gomma già
> troppo vecchia): **337 su 337** mettono il minimo dove l'ottimo teorico lo colloca. **La
> metrica G0 era mal specificata** — conta come fallimento la risposta giusta al bordo. Non è
> stata riscritta retroattivamente; la sostituta (G0′) è proposta nel report.
>
> **Controllo indipendente, non previsto e più forte del cancello:** il `gradino` misurato
> dalle soste vere (−1,108 s/giro) contro `−ρ × età` della gomma tolta (−0,804). Due misure da
> fenomeni diversi che arrivano vicine.
>
> **Le posizioni si muovono: 13,9 %** (47 su 338, max 2 posizioni, 37 peggiori e 10 migliori).
> A differenza della Fase 1 qui il termine è **specifico del pilota**, quindi morde davvero.
> **È un cambio di promessa: lo decide il PO.**

**AUDIT DEL KERNEL — ✅ CHIUSO il 28/07/2026.** Prima modifica di questo arco che tocca la
**produzione**. Report: `ai_lab/simulatore/REPORT_AUDIT_KERNEL.md`.

> Quattro difetti chiusi (`_neut` senza bandiera rossa · filtro del passo che ammetteva
> gialle, cancellati e bagnato · `CarObs` senza `status`/`del` · letterale `"None"` non
> lavato), più un quinto emerso dalla correzione stessa: **`simulate` non escludeva chi non ha
> un passo, lo lasciava congelato e lo restituiva comunque** — nel banco valeva 480 s di
> errore. E due **soglie cablate** nei test (`449`) che erano golden non dichiarati.
>
> **Impronte cambiate di proposito**: `engine/engine.py` `d2bee2dca871` → **`57fe44245314`**,
> `demo/engine.mjs` `e84dbf2b08b1` → **`0bbdfde25023`**.
>
> **Nessuna decisione del prodotto si è mossa**: sui 22 casi golden posizione di rientro,
> gruppo, davanti/dietro e neutralizzazione **identici**; solo i gap in secondi cambiano, in 5
> casi. Suite verde (8 test su 9; `test_b.py` resta rosso su una soglia della migrazione da
> Colab, lasciata intatta di proposito e spiegata nel report).
>
> Nessuna conclusione di Fase 0/1/2 cambia: G0 0,0 % → 69,9 % con l'età gomma, bias Fase 1+ρ
> −0,178, posizioni mosse dalla Fase 2 12,8 %.

**Il difetto originario, per memoria** — tre difetti in `pace_base`, misurati:
`_neut` conta **verdi** le bandiere gialle e rosse (`engine.py:20`), il filtro non guarda la
**mescola**, e non esclude i **giri cancellati** (`CarObs` non porta nemmeno `del`). Costo:
**11,4 % delle celle di passo si sposta di oltre 0,10 s**, massimo 2,93 s — tutto nelle code,
cioè proprio subito dopo una sosta. **D1 e D3 non sono chiudibili a valle**: l'esportatore non
porta `status` né `del`. Vanno chiusi lì, insieme al letterale `"None"` di Fase 0.

### Fase 2 — il cancello com'era scritto

Sostituire il `gradino` costante con `età := 0` + ρ·età. ρ dal modello vivo esistente
(`data/modello_degrado_2026.json`), pesato secondo §4.

> **Cancello G2** *(riformulato dopo la Fase 0).* G0 passa da **0,0 %** a ≥ 80 % di ottimi
> interni **e** il minimo cade dove la gara ha poi dato ragione (banco `banco_quando.mjs`).
>
> **Cosa NON deve essere il cancello, e perché.** Il vecchio modello era stato bocciato su
> «riduce l'errore di ricostruzione dei tempi». Quel bersaglio è fuori portata per
> costruzione: ρ·età vale pochi decimi su uno stint, il rumore di gara è ±11,7 s. Sui *tempi*
> ρ non si vedrà mai; sulla *decisione* ρ è tutto, perché è l'unico termine che sposta il
> minimo. Bocciare il degrado sui tempi è un errore di misura, non di modello — la stessa
> lezione del cap del traffico in `engine/LIMITI_NOTI.md §4`.

### Fase 3 — Passo e degrado **per mescola**, dal fondo

173 gare, identificazione dove le mescole coesistono (compagni di squadra, stint adiacenti,
stessa finestra di giri), nullo per permutazione delle etichette, validazione leave-one-year-out.

> **Fase 0 ha già chiuso una porta:** sul **2026 da solo** la separazione fra mescole **non
> esiste** (ΔSOFT−HARD = −0,0075, IC95 [−0,0337 ; 0,0488], p = 0,209, ordine spontaneo 2 gare
> su 10). Il fondo 2018-2025 non è quindi un raffinamento della Fase 3: è **l'unica strada
> rimasta** per far muovere la mescola sui tempi.
>
> **Cancello G3.** ΔSOFT–HARD sul passo con IC95 che **non contiene lo zero**, e segno stabile
> su ≥ 2 stagioni fuori campione. Se NULL: si usa il delta nominale Pirelli **etichettato
> come modello, non come misura**, e la pagina lo dice. In nessun caso la mescola torna a
> non fare niente: il PO ha deciso che il selettore deve muovere i numeri, e se i dati non lo
> sostengono si dichiara la fonte.

### Fase 4 — Bagnato

Regime intermedia/wet dal fondo (9.365 + 733 giri, 20 gare), con lo stato-pista come
variabile.

> **Cancello G4.** Riprodurre il **giro di crossover** reale (quando le squadre hanno cambiato
> regime) entro ±3 giri in ≥ 60 % delle 20 gare bagnate. Sotto soglia: il bagnato resta
> mostrato ma marcato «indicativo», e il rifiuto totale di oggi sparisce comunque.

### Fase 5 — Adattamento vivo *(il cuore, §4)*

Shrinkage prior↔vivo, allarme di incoerenza sulle durate, riga in chiaro quando il modello
cambia idea.

> **Cancello G5** — *causale, nessuno sbircia avanti.* Il modello aggiornato **solo sui giri
> già visti** deve battere il prior statico sul **resto della stessa gara**, in leave-one-race-out
> su tutte le gare del fondo. Metrica: MAE sul tempo di stint previsto. Soglia: vittoria in
> ≥ 7 gare su 10 del 2026 **e** IC95 del Δ appaiato che non contiene lo zero.
>
> **G5-bis** — l'allarme di incoerenza deve accendersi sui casi veri in cui le durate hanno
> smentito lo storico, e **non** accendersi sulle gare dominate da Safety Car. Falsi positivi
> ≤ 20 %.

### Fase 6 — Motore multi-stint e copertura

`stint` come oggetto di prima classe; rivali reali in replay (§5); e **smettere di tacere**:
passo-base di ripiego dichiarato per i primi giri e per chi è appena uscito dai box.

> **Cancello G6.** Copertura da **82,7 % a ≥ 97 %** delle coppie (pilota, giro), e il campo
> valutabile nella finestra pit non scende mai sotto il 70 % dei piloti in pista. Ogni
> risposta di ripiego è etichettata come tale.

### Fase 7 — La faccia (§6.3) e la scena

Verdetto in una riga, curva del quando, dettagli a scomparsa; mappa che non si spegne, sosta
ferma nel replay, pit-lane vera per circuito, velocità 20×/50× e «salta al prossimo evento».

> **Cancello G7.** Un utente che non conosce il progetto capisce, entro 10 secondi dal primo
> tocco: (a) quando conviene fermarsi, (b) con che gomma, (c) dove finisce. Si prova su
> persone vere, non si dichiara a tavolino.

---

## 8. COSA CONTINUIAMO A NON PROMETTERE

Va scritto adesso, perché è la parte che si dimentica quando il prodotto comincia a
funzionare:

- **I duelli non sono simulati.** Il motore riproduce *quanti* cambi di posizione avvengono,
  non *quali* (cap del traffico spento, decisione PO 22/07, misurata).
- **I set in garage non sono nel feed.** Il piano può proporre una gomma che non c'è.
- **I rivali non reagiscono.** In replay non serve (§5); in diretta è un limite vero e va
  mostrato come banda.
- **Il 2026 ha gomme nuove.** Il prior storico è un prior. È il motivo per cui la Fase 5
  esiste.
- **Le posizioni sono più affidabili dei tempi.** Anche dopo la Fase 1: l'errore comune si
  cancella sulle posizioni, non sui tempi assoluti.

---

## 9. RISCHI

| rischio | perché fa paura | cosa lo tiene a bada |
|---|---|---|
| **il degrado per mescola resta NULL** anche sul fondo | il selettore mescola tornerebbe decorativo, contro la decisione del PO | G3 prevede già la ricaduta: delta nominale etichettato, mai «niente» |
| **l'adattamento vivo insegue il rumore** | un modello che cambia idea a ogni giro è peggio di uno rigido | `k` derivato dalla varianza, non scelto; G5 causale; la banda si allarga invece di stringersi |
| **la durata degli stint viene scambiata per degrado** | è una decisione, non una misura | non entra mai nella stima, solo nell'allarme (§4.2) |
| **si rompe il golden** toccando il carburante | è il tripwire del kernel | G1 impone Δ ≈ 0 sulle posizioni e spiegazione riga per riga; il kernel `engine.py` resta bit-identico, si lavora nel simulatore |
| **il prodotto diventa più bello e più falso** | è il rischio vero della strada A | ogni numero ha targhetta e banda; §8 sta in pagina, non solo qui |

---

## 10. IL PRIMO PASSO

**Fase 0 + Fase 1, insieme.** Il banco e il carburante.

Motivo: senza il banco nessuna decisione è verificabile, e senza il carburante ogni misura
successiva è presa su un motore che va 1,9 s/giro più veloce del vero. Sono anche le due fasi
a rischio più basso: il banco non tocca la produzione, il carburante ha già la misura, la
formula e il documento dei limiti che lo aspetta.

Subito dopo, **Fase 2**: è quella che, da sola, trasforma «fermati subito, sempre» in una
domanda vera — e il coefficiente è già in casa, calibrato e spento.

---

### Comandi delle misure citate

```bash
node gen_backtest_strategia.mjs          # 459 soste, 11 casi puri non saturati
node gen_backtest_motore.mjs             # errore del kernel su finestre verdi
python3 gen_modelli_lab.py --verifica    # ricalibrazione dei modelli vivi + targhetta
```

Le sonde usate per §1.1–1.2 (copertura, degenerazione del «quando», ampiezza del gruppo a pari
giro) sono da riscrivere come test permanenti dentro la Fase 0: oggi sono script temporanei, e
uno script temporaneo che produce un numero citato in un piano è un debito, non una misura.
