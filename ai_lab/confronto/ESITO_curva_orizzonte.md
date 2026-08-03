# ESITO — la curva dell'orizzonte, e perché NON dichiaro F1 raggiunto

**Data: 03/08/2026.** Esegue `PREREG_curva_orizzonte.md`. Numeri:
`ESITO_curva_orizzonte.json`. Sola lettura: nessun file sigillato toccato.

## La curva, tutti i punti

Controllo a 2 giri: il banco riproduce **235 casi, 36-12, p = 0,0007** — il numero già
tarato. La curva si può leggere.

**Motore contro il nullo** (la forma di F1):

| giri | n | vince-perde | pari | saldo | p |
|---|---|---|---|---|---|
| **2** | 272 | 161-69 | 42 | **+92** | 0,0000 |
| **3** | 271 | 146-72 | 53 | **+74** | 0,0000 |
| **4** | 271 | 136-80 | 55 | **+56** | 0,0002 |
| **5** | 270 | 129-83 | 58 | **+46** | 0,0019 |
| **6** | 264 | 119-88 | 57 | **+31** | **0,0368** |
| **8** | 254 | 102-86 | 66 | +16 | 0,2739 |
| **10** | 253 | 101-84 | 68 | +17 | 0,2394 |

**Letto così, il vantaggio decade in modo ordinato e perde significatività fra 6 e 8
giri** — e a 6 giri (p = 0,0368) cadrebbe esattamente sulla soglia che il KPI F1 chiede.

## Perché NON dichiaro F1 raggiunto

Due ragioni, e vanno lette insieme. Nessuna delle due è un dettaglio.

### 1. Il criterio di contaminazione che ho pre-registrato è degenere

La prereg §3 dice: marcare CONTAMINATO un punto se la mediana di **soste vere di rivali
nella finestra** è ≥ 1. Misurato: la mediana è **3 già a 2 giri** e sale a 11 a dieci giri.
Con venti auto in pista, «almeno una sosta di qualcuno nella finestra» è vero **sempre**.

Il criterio marca **tutti e sette i punti**, incluso quello di controllo dove il motore
funziona in modo dimostrato. Un criterio che non separa niente non è un criterio: **non ha
potere di discriminare**, ed è mio, scritto stamattina senza controllarne la scala. È la
stessa svista di T2 nel tetto — una soglia fissata senza guardare l'ordine di grandezza
della quantità che deve giudicare.

**Non lo riscrivo** (regola 3, E08). Conseguenza: **secondo la regola di lettura che ho
pre-registrato, la frontiera è indeterminata**, e non posso usare la curva per dichiarare
un KPI.

### 2. Il nullo non sa della sosta, il motore sì — ed è il grosso del vantaggio

**Verificato: in tutti e 274 i casi la sosta del soggetto cade dentro la finestra**, a ogni
orizzonte. Il modello nullo è «l'ordine al congelamento non cambia»: non sa che il pilota
è entrato ai box e ha perso ~20 secondi. Il motore lo sa, perché la sosta è nel piano che
gli viene dato.

Quindi una parte grande — plausibilmente dominante ai primi orizzonti — di quel **+92** non
misura la qualità della fisica: misura **il fatto di sapere che una sosta è avvenuta**.
Il decadimento della curva è allora in buona parte la diluizione di quel vantaggio noto,
non la frontiera della fisica del passo.

> Questo spiega anche perché il numero alla bandiera è così diverso (57-55): su
> cinquanta giri il vantaggio «so della sosta» si dissolve e resta la fisica, che col nullo
> pareggia.

**Un confronto onesto per F1 avrebbe bisogno di un nullo che sappia della sosta** — per
esempio l'ordine al congelamento con la perdita ai box applicata al soggetto. Quel nullo
non esiste nel progetto e non l'ho pre-registrato: costruirlo adesso e rifare la curva
sarebbe scegliere il metro dopo aver visto i dati.

## Cosa si scrive, allora

**F1 resta non giudicato.** Non «mancato» e non «raggiunto»: la misura che ho progettato
non lo può stabilire, per un difetto del disegno e non del motore.

Quello che la curva **stabilisce comunque**, e non è poco:

- il vantaggio del motore sul nullo **decade in modo ordinato e monotono** fra 2 e 8 giri,
  e perde significatività **fra 6 e 8** — un fatto che prima non era noto, visto che di
  questa curva esistevano due soli punti;
- il perimetro tiene bene (da 272 a 253 casi): il decadimento **non è un artefatto della
  popolazione che si assottiglia**;
- il controllo a 2 giri riproduce esattamente il 36-12: **il banco è tarato anche su questa
  metrica**, e la curva è riproducibile.

## Cosa servirebbe per giudicare F1 davvero

Una prereg nuova e datata, con **un nullo che conosce la sosta**. È una riga di codice —
l'ordine al congelamento con il pit-loss del circuito applicato al soggetto — ma è **un
metro nuovo**, e un metro si sceglie prima di guardare, mai dopo.

Prima di aprirla, però, va detto che il risultato più probabile è che la curva si abbassi
molto: se il grosso del +92 è «so della sosta», toglierlo lascia poco. Il che sarebbe **la
risposta a F1**, e vale la pena averla — ma è una domanda diversa da quella che questa
prereg ha misurato.

## Nota di metodo

Due criteri mal specificati in un giorno — T2 nel tetto, la contaminazione qui — hanno la
stessa forma: **una soglia scelta senza guardare l'ordine di grandezza della quantità che
deve giudicare**. Nessuno dei due ha cambiato un verdetto, perché entrambi i casi
fallivano anche nel merito, ma è una regolarità nei miei errori e va scritta dove la si
rilegge: **una soglia va provata su un caso noto prima di essere sigillata**, esattamente
come il banco unico si tara sui numeri già noti prima di giudicare una regola.
