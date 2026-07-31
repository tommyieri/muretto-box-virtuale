# PREREG — FASE DIFESA DELLA POSIZIONE: quanto vale il numero che diciamo

**Scritta il 2026-07-30, PRIMA di calibrare una sola banda e prima di guardare
un solo errore condizionato al contesto.** Regola 3.

**Trasparenza su cosa è già stato guardato.** Prima di questa prereg è stato
eseguito un **censimento strutturale** — conteggi, non esiti: quante soste vere
esistono, in quante gare, e quanta compagnia si PREVEDE di trovare al rientro.
Non ha guardato l'errore di posizione, che è la grandezza su cui si gioca tutto
il resto. I numeri stanno qui sotto perché fissano le soglie.

## La domanda, e la domanda che NON si fa

Il vecchio repo ha misurato che **il duello non si simula**: si riproduce QUANTI
cambi di posizione avvengono, non QUALI. Il kernel lo dice in faccia — due auto
possono attraversarsi — e CLAUDE.md lo mette fra le cose da non costruire al
giorno 1.

Questa fase **non** costruisce una probabilità di sorpasso. Costruisce l'altra
cosa, quella onesta: **quanto vale il numero che il prodotto già dice**. Oggi la
pagina scrive «rientri P14» come se fosse un fatto. Non lo è: è il rango fra cum
previsti, in un motore dove nessuno si difende. La domanda pre-registrata è:

> di quanto può sbagliare quel P14, misurato sulle soste vere, e quella
> incertezza dipende da quanta compagnia si prevede di trovare al rientro?

Il prodotto della fase è una **banda dichiarata sulla posizione**, non un
duello. E nel 2026 il DRS non esiste (Manual Override Mode): nessun modello di
sorpasso, per nessuna via, entra in questo repo con questa fase.

## Misurato sul bersaglio, e su nient'altro (E16)

La calibrazione si fa **solo sulle soste realmente avvenute** nel 2026 —
`banco/misure/rientro.mjs`, che già le misura. Mai su finestre senza sosta: è
letteralmente E16, il cap del traffico tarato dove il fenomeno non c'era, e non
si ripaga. La misura del rientro NON si riscrive: questa fase la usa (regola 1).

## I secchi restano

`PULITA` · `SOSTE_RIVALI` · `NEUTRA` esistono perché una media fra loro
nasconderebbe che il prodotto sbaglia in modi diversi in situazioni diverse. La
banda si calibra **per secco**, dove il secco ha almeno **10 casi** (la stessa
soglia `min_casi_secco` già pre-registrata per il rientro). Sotto, il secco non
riceve una banda propria e il prodotto usa quella complessiva, dichiarandolo.

## Il censimento strutturale, già eseguito

398 soste misurabili su 11 gare — `PULITA` 35 · `SOSTE_RIVALI` 174 ·
`NEUTRA` 189. Compagnia PREVISTA al rientro (distanze fra cum previsti, quindi
note al congelamento — nessuna informazione dal futuro, E14):

| rivali entro | 0 | 1 | 2 | 3 | 4+ |
|---|---|---|---|---|---|
| 1 s | 323 | 63 | 9 | 3 | 0 |
| **2 s** | **261** | **100** | **28** | **7** | **2** |
| 3 s | 206 | 124 | 46 | 10 | 12 |
| 5 s | 158 | 104 | 79 | 34 | 23 |

Gap al rivale più vicino: mediana 3,24 s.

## Il contesto: come si definisce «rientro conteso»

**Conteso** = almeno un rivale entro **2 secondi** di cum PREVISTO al giro di
rientro. La soglia non è scelta sul conteggio che produce: 2 s è dell'ordine
dell'incertezza del modello stesso sull'orizzonte del rientro (il bias
dichiarato è ≤ 0,17 s/giro e l'orizzonte è di 2 giri), cioè la zona in cui
**l'ordine previsto non è risolvibile dal modello**. Sotto quella distanza,
dire chi è davanti è una precisione che il motore non ha.

La conclusione si riporta comunque su **1, 2, 3 e 5 s**: se cambia segno al
variare della soglia, è una proprietà della soglia e non del fenomeno, e va
detto.

## I cancelli

### D1 · La banda è calibrata, e non è imbottita

La banda è una semi-ampiezza **intera** `n`: «P14, fra P(14−n) e P(14+n)».
Si sceglie `n` come il **più piccolo intero** la cui copertura fuori campione
raggiunge il livello dichiarato `q = 0,80`.

**Validazione: leave-one-race-out**, 11 blocchi = 11 gare (E11). Per ogni gara:
`n` si calcola sulle altre dieci, la copertura si misura su quella tenuta fuori.

**CANCELLO D1**, per ogni secco sufficiente e per il complessivo:

1. la copertura fuori campione di `n` è **≥ 0,80**; **e**
2. la copertura di `n − 1` è **< 0,80** — cioè `n` è il più piccolo che basta.

La seconda condizione è il motivo per cui questo cancello non si passa
imbottendo: una banda di ±5 coprirebbe tutto e non direbbe niente.

**Perché non una copertura «fra 0,73 e 0,87».** La posizione è un intero: la
copertura salta a scatti (±1 può dare 0,78 e ±2 può dare 0,91, senza niente in
mezzo). Un cancello a intervallo sarebbe impossibile da passare **per una
risposta corretta**, che è E08 — una metrica che boccia chi ha ragione. La
condizione di minimalità dice la stessa cosa senza quel difetto.

### D2 · Il contesto separa, o no?

**Statistica**: differenza fra la mediana di `|errore|` dei rientri contesi e
quella dei rientri puliti.
**Nulla**: permutazione dell'etichetta «conteso» **dentro la gara**, 10.000
ripetizioni, blocchi = gare (E11).

**CANCELLO D2 — con la sua clausola direzionale**: il contesto separa se
`p < 0,05` **e** il segno è quello atteso, cioè **i rientri contesi sbagliano di
più**. Un effetto forte col segno all'incontrario — la previsione più
affidabile proprio dove c'è traffico — non è una scoperta: è un difetto della
misura o del modello, e va a referto come tale, non promosso a banda.

*(La clausola è esplicita perché nella Fase Mescola la sua assenza avrebbe
dichiarato PASSA su un effetto di segno sbagliato.)*

**Se D2 passa**: due bande, una per contesto, ciascuna col suo cancello D1.
**Se D2 non passa**: **una banda sola**, e il fatto che il contesto non separi
si scrive nell'esito e nel modulo. Non si tengono due bande «tanto per»: sarebbe
una distinzione senza differenza misurata.

### D3 · QUANTI, non QUALI — l'invariante costituzionale

**CANCELLO D3**: l'output della fase non contiene, in nessun punto, una
previsione su CHI supera CHI. Nessun campo nomina un rivale come sorpassato o
sorpassante; l'unica grandezza di duello ammessa è un CONTEGGIO
(`cambiDiPosizione`, che il kernel già espone). E in nessun file entra il DRS,
che nel 2026 non esiste.

Questo cancello si verifica sul CODICE e sull'OUTPUT, non sulle intenzioni.

### D4 · La banda non nasconde il bias

Una banda simmetrica attorno a una previsione storta copre bene e mente lo
stesso. **CANCELLO D4**: l'errore mediano con segno resta a referto per ogni
secco accanto alla banda, e se un secco ha un bias mediano `≥ 1` posizione la
banda di quel secco viene dichiarata **asimmetrica** e mostrata come tale, non
centrata su un numero che si sa spostato.

## Cosa NON si farà per far passare la fase

- **Non si calibrerà su finestre senza soste** per avere più casi (E16).
- **Non si allargherà la banda** finché la copertura torna: la condizione di
  minimalità di D1 esiste apposta.
- **Non si costruirà una probabilità di sorpasso**, né per pilota né per coppia,
  né «solo per diagnostica». Il duello non si simula.
- **Non si introdurrà il DRS**, che nel 2026 non esiste.
- **Non si introdurrà un cap del traffico nel kernel**: due auto continuano a
  potersi attraversare, e la banda è il modo onesto di dirlo.
- **Non si riscriverà `misure/rientro.mjs`** per far tornare i numeri: se quella
  misura è sbagliata, si corregge con la sua prereg, non dentro questa.

## Condizione di NON ESEGUIBILITÀ (dichiarata prima)

La fase richiede **≥ 8 gare** con almeno un caso (per un leave-one-race-out che
non sia un aneddoto) e un secco con **≥ 10 casi**. Il censimento dice 11 gare e
tre secchi sufficienti: la condizione si dà. Se in futuro non si desse, la fase
si dichiara non eseguibile e la pagina continua a NON mostrare una banda —
mai una banda inventata.
