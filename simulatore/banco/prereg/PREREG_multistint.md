# PREREG — FASE MULTI-STINT: il piano gomme fino alla bandiera

**Scritta il 2026-07-30, PRIMA di scrivere l'ottimizzatore e prima di guardare
un solo piano proposto.** Regola 3.

## La domanda

Fino a oggi il prodotto risponde a *una* domanda: «se mi fermo al giro G, dove
rientro, e quando conviene fermarmi». Una sosta sola, decisa una volta.
La Fase Multi-Stint chiede: **il piano gomme fino alla bandiera** — quante
soste, a che giro, con quale mescola — e fa dello **stint un oggetto**, non un
intervallo implicito fra due numeri.

## I due "stint" NON sono la stessa cosa, e non si confondono

Esistono già degli stint nel repo, e sono di un'altra natura. La distinzione va
scritta prima, perché confonderle sarebbe E12 in un posto nuovo:

| | chi lo possiede | cos'è |
|---|---|---|
| **stint OSSERVATO** | `provenienza/` (`cella.stint`, `data/viste/stint_fondo.json`) | un fatto: il numero di stint che il grezzo riporta su una cella, e i 6.985 stint del fondo con la loro pendenza |
| **stint PIANIFICATO** | `scenario/piano.mjs` (nuovo) | una **proposta**: un tratto di gara che non è ancora successo |

Il secondo porta obbligatoriamente `da_dati: false`. Un oggetto che descrive il
futuro non deve poter essere scambiato per una misura (regola 2).

**Forma dello stint pianificato** (unica in tutto il repo):

```
{ indice, giro_inizio, giro_fine, giri, mescola, eta_iniziale, eta_finale, da_dati: false }
```

**Forma del piano**: `{ soste: [{ giro, mescola, perdita }], stint: [...], k }`,
con `stint` DERIVATO dalle soste — mai i due elenchi mantenuti in parallelo, o
prima o poi divergono.

## Dove vive il codice, e cosa NON diventa

`scenario/piano.mjs` possiede **la forma** (stint, piano) e **la ricerca** (quale
piano è il migliore). Non possiede fisica: per valutare un piano chiama
`costruisciScenario`, che resta l'**unico** costruttore di scenari (E17). Se
`piano.mjs` sommasse un tempo per conto suo, sarebbero di nuovo due fisiche per
due risposte adiacenti, che è esattamente l'errore che il costruttore unico è
stato scritto per impedire.

`costruisciScenario` accetta da oggi un **piano**. La coppia `{giroPit, mescola}`
resta come zucchero sintattico e viene **convertita in un piano a una sosta alla
frontiera**: non sopravvive come percorso parallelo (E20 — quando un modello ne
sostituisce un altro, i pezzi vecchi si spengono INSIEME). Il cancello M2 esiste
per provarlo.

## La forma chiusa, derivata prima di misurare

Nel modello v2 il tempo sul giro è `base(pilota) + δ_giro·(giro−1) + ρ·età`. I
primi due termini dipendono dal GIRO, non dal piano: sono identici per ogni
piano sullo stesso orizzonte e **si cancellano nel confronto**. Ciò che il piano
cambia è solo `ρ·Σ età` più le perdite ai box.

Con `R` giri rimanenti dal congelamento, età `a` al congelamento, `k` soste di
perdita `P` ciascuna, e stint di lunghezze `L_1 … L_{k+1}`:

```
costo(piano) = ρ·[ a·L_1 + Σ_i L_i(L_i+1)/2 ] + k·P
```

Minimizzando a `k` fissato con `Σ L_i = R`:

```
L_i = (R + a)/(k+1)   per i ≥ 2        L_1 = (R + a)/(k+1) − a
giro della i-esima sosta (relativo a Lf):   m_i = i·(R + a)/(k + 1) − a
costo*(k) = ρ·[ (R + a)²/(2(k+1)) − a²/2 + R/2 ] + k·P
numero ottimo di soste:   (k + 1)* = (R + a)·√( ρ / (2P) )
```

Per `k = 1` questo dà `m_1 = (R − a)/2`: **è esattamente l'ottimo analitico già
in vigore** (CLAUDE.md, e la metrica G0″). La forma chiusa multi-sosta non è una
nuova ipotesi, è la stessa generalizzata — e il fatto che si riduca a quella
nota è la prima cosa che il banco verifica.

## I cancelli

### M1 · La ricerca riproduce l'ottimo esaustivo del kernel

Sul **banco analitico** (sintetico, dove le ipotesi del modello valgono
esattamente: passo lineare, nessun traffico, perdita uguale a ogni sosta) e per
`k = 0, 1, 2, 3`, si confrontano **tre calcoli diversi della stessa cosa**:

1. l'**enumerazione esaustiva** di tutti i piani interi, valutati col kernel VERO;
2. la **forma chiusa** qui sopra, arrotondata agli interi;
3. il piano restituito dall'**ottimizzatore** del prodotto.

Non è tautologico: il kernel lavora in giri discreti, con l'orizzonte troncato
alla bandiera e la perdita applicata intera sul giro della sosta; la forma chiusa
è continua e non sa niente di tutto questo.

**CANCELLO M1: 100% dei casi ammessi**, dove un caso è ammesso se l'ottimo
continuo cade dentro l'intervallo dei giri di sosta possibili.

**Clausola di bordo, UNILATERALE.** Quando l'ottimo continuo cade *prima* del
primo giro in cui ci si può fermare, «fermati subito» è la risposta giusta e
non deve contare come fallimento; simmetrico all'altro estremo. È la stessa
clausola di G0″, e si RIUSA — non se ne scrive una seconda: E08 è stato pagato
una volta scrivendo una metrica che bocciava la risposta corretta al bordo, e
una seconda volta scrivendone la correzione con lo stesso difetto.

**Pareggi.** Quando la forma chiusa cade a metà fra due interi, entrambi sono
ottimi ed entrambi passano — come già in G0″.

### M2 · Non-regressione a una sosta

Su **tutti** i congelamenti del banco sulle 11 gare 2026, la risposta a una
sosta calcolata attraverso il nuovo percorso a piano deve dare **lo stesso
identico numero** (cum, posizione, curva) di quella calcolata oggi.

**CANCELLO M2: identità esatta, 100% dei casi.** Non «differenza piccola»: un
piano a una sosta *è* lo scenario a una sosta, e qualunque scostamento
significherebbe che i due percorsi sono rimasti due.

### M3 · Il piano rispetta il regolamento 2026

Un piano fino alla bandiera è la prima risposta del prodotto su cui la regola
delle due mescole slick è **verificabile davvero** (prima l'orizzonte finiva un
giro dopo la sosta e la regola non era decidibile).

**CANCELLO M3**: sulle 11 gare 2026, ogni piano proposto è **approvato dal
Director**, REG01 compreso — 100%. E il controllo non deve essere cieco: deve
esistere almeno **1 caso** in cui il pilota al congelamento ha usato una sola
mescola slick e il piano è quindi OBBLIGATO a contenere una sosta. Se non ne
esiste nemmeno uno, M3 non ha provato niente e si dichiara non eseguito.

### M4 · Le mediane di stint sono un ALLARME, non un vincolo

Le mediane 2026 (SOFT 14 · MEDIUM 19 · HARD 22 giri) sono **DECISIONI dei
team, non fisica** — CLAUDE.md lo dice, e in live sono ALLARMI, mai stime. Un
ottimizzatore che le usasse come vincolo starebbe riproducendo la strategia
altrui e chiamandola ottimo.

**CANCELLO M4**: il piano proposto è **identico** con e senza il modulo degli
allarmi. Se spegnere gli allarmi cambiasse un piano, sarebbero vincoli.
Gli allarmi restano nell'output, etichettati come allarmi.

## Cosa NON si farà per far passare la fase

- **Non si taglierà il numero di soste con un massimo arbitrario.** Se la
  forma chiusa dice 3, il prodotto dice 3 e dichiara perché. Un tetto cablato
  nasconderebbe che il modello non ha un cliff invece di risolverlo.
- **Non si introdurrà un ρ per mescola** per rendere il piano più interessante:
  la Fase Mescola ha chiuso in negativo e vale il suo esito.
- **Non si introdurrà un cliff di fine vita**, né una lunghezza massima di
  stint: non sono misurati, e §Cosa NON costruire al giorno 1 li esclude.
- **Non si introdurrà un cap del traffico** per giustificare più soste (E16).
- **Non si scriverà un secondo valutatore** dentro `piano.mjs` "per fare in
  fretta" la ricerca. La ricerca costa: si restringe lo spazio dichiarandolo,
  non si duplica la fisica (E17).

## Il limite che questa fase dichiara da sé

Il modello non ha cliff, non ha traffico e non ha degrado per mescola. Il piano
che ne esce è **l'ottimo di questo modello**, non l'ottimo della gara vera: dove
la realtà punisce uno stint lungo più di quanto faccia una retta, il piano
sbaglierà nella stessa direzione ogni volta. Questo va scritto nella pagina
accanto al piano, non in una nota a piè di pagina di un README.

## Condizione di fallimento (dichiarata prima)

Se M1 non passa, la fase **non spedisce**: significherebbe che la ricerca e la
forma chiusa non descrivono lo stesso oggetto, e non si sa quale delle due
creda. Se M2 non passa, il piano non sostituisce nulla: resterebbero due
percorsi, che è l'errore che questa fase deve chiudere. In entrambi i casi
l'esito va a referto e il piano NON compare in pagina.

---

## Addendum del 2026-07-30 — la copertura del banco (NON una soglia)

Aggiunto **dopo** la prereg e **prima** di guardare gli esiti: la griglia su cui
M1 gira. Non è un cancello e non ne cambia nessuno — i quattro cancelli restano
quelli sopra, invariati. Sta scritta qui perché una soglia della macchina senza
la sua riga in parole è un numero che nessuno può contestare (E07), e perché la
copertura di un banco va dichiarata come tutto il resto.

- giri rimanenti `R` ∈ {12, 20, 30, 40}
- età al congelamento `a` ∈ {0, 5, 12}
- perdita ai box `P` ∈ {18,4 · 22,1 · 28,1} s (Spa, la mediana d'era, Imola)
- soste `k` da 0 a **3**
- M2, M3 e M4 girano ai congelamenti **15 e 30**, sui primi **3** piloti in
  ordine alfabetico di ogni gara, con almeno **8** giri rimanenti.

Con un cancello al **100%** una griglia più larga può solo rendere la prova più
dura, mai più facile: allargarla resta possibile, restringerla dopo aver visto
i numeri no.
