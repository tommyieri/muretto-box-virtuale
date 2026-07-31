# PREREG — FASE DIFESA II: una statistica con risoluzione, e il circuito

**Scritta il 2026-07-30, dopo l'esito della Fase Difesa I e PRIMA di eseguire
una sola delle due misure qui dichiarate.** Regola 3.

**La Fase I non si riscrive.** Il suo esito resta quello che è: D1 passa (banda
±1 in verde, ±2 sotto regime, calibrate e minimali fuori campione), D2 non
separa, D4 tutte le bande simmetriche. Questa è una fase NUOVA con cancelli
nuovi, non una correzione retroattiva della precedente (E08 è stato pagato una
volta per una metrica mal specificata e una seconda per la sua correzione).

## Domanda A · Il contesto separa davvero, o la statistica non lo vedrebbe?

**Cosa è andato storto in D2.** La statistica pre-registrata era la differenza
fra le **mediane** di `|errore|` fra rientri contesi e puliti. Su una grandezza
INTERA le cui mediane valgono 0 e 1, quella differenza vale **esattamente 1 a
tutte e quattro le soglie** (1, 2, 3, 5 s) e il p-value che ne esce
(0,27–0,35) è dominato dalla discretezza, non dai dati. Non è un risultato
negativo: è una misura **senza risoluzione**. Un test che non potrebbe
distinguere un effetto vero da nessun effetto non ha bocciato l'ipotesi — non
l'ha esaminata.

**Statistica di Fase II**, dichiarata prima: la **differenza fra le quote di
errore entro ±1 posizione** fra contesi e puliti. È una proporzione, non un
intero: cambia di poco quando i dati cambiano di poco, che è esattamente ciò che
la differenza di mediane non fa.

**Nulla**: la stessa della Fase I — permutazione dell'etichetta «conteso»
DENTRO la gara, 10.000 ripetizioni, blocchi = gare (E11). Il disegno non era il
problema.

**CANCELLO A**, con la sua clausola direzionale: il contesto separa se
`p < 0,05` **e** i contesi hanno una quota entro ±1 **più bassa** (sbagliano di
più). Un effetto significativo col segno all'incontrario va a referto come
difetto, non promosso a banda.

**Potenza dichiarata prima.** Con 137 contesi e 261 puliti, una differenza di
quota di 10 punti percentuali è la più piccola che questo campione può
distinguere in modo affidabile. **Se il cancello non passa, l'esito deve
riportare la differenza osservata e dire se cade sotto quei 10 punti**: «non
separa» e «troppo piccolo per vederlo con questi numeri» sono due conclusioni
diverse, e la Fase I non poteva distinguerle.

## Domanda B · La banda dovrebbe dipendere dal circuito?

**Cosa ha misurato la Fase I.** La banda complessiva copre l'87% fuori campione
ma crolla a Monaco (0,63) e in Australia (0,59). I secchi assorbono quasi tutto
— NEUTRA all'86% contro il 97% di PULITA e SOSTE_RIVALI — ma dentro NEUTRA
resta un residuo di circuito: Monaco al 70%.

**Perché la Fase I non ha aggiunto una banda per circuito.** Non era
pre-registrata, e con 14–78 casi per gara sarebbe stato rumore promosso a
parametro. Resta come limite dichiarato.

**Ipotesi di Fase II**: l'eccesso di errore non è del circuito in quanto tale,
ma di **quanto è difficile sorpassare** su quel circuito — e quella difficoltà
si misura, senza modellare il duello, come il numero di cambi di posizione
osservati per giro in verde (`cambiDiPosizione` sull'ordine reale, che il kernel
già espone: QUANTI, non QUALI).

**CANCELLO B**: la banda condizionata a quell'indicatore deve
1. passare **D1 come in Fase I** — copertura fuori campione ≥ 0,80 e minimalità
   — su ogni gruppo che ha almeno 10 casi; **e**
2. **battere** la banda per secco della Fase I sulla copertura fuori campione,
   **a parità di ampiezza media**. Senza la seconda condizione basterebbe
   allargare la banda dove copre poco, che è imbottire con più passaggi.

**Se il cancello non passa**, la banda resta quella per secco della Fase I e il
limite di circuito resta dichiarato. Non si spedisce una banda per circuito che
non batte quella che c'è.

## Cosa NON si farà, in questa fase come nella prima

- **Non si costruirà una probabilità di sorpasso**, nemmeno partendo
  dall'indicatore di sorpassabilità: quello conta QUANTI cambi avvengono su un
  circuito, e resta un conteggio aggregato. Chi supera chi non si prevede.
- **Non si introdurrà il DRS**: nel 2026 non esiste.
- **Non si calibrerà su finestre senza soste** (E16).
- **Non si riscriverà la Fase I** per farla tornare con questi numeri.

## Condizione di NON ESEGUIBILITÀ

La Domanda B richiede almeno **due gruppi** di sorpassabilità con ≥ 10 casi
ciascuno e ≥ 8 gare complessive. Sotto, si dichiara non eseguibile e la banda
per secco resta quella in vigore.
