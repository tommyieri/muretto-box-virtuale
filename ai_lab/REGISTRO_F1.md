# Registrazione dell'esito di F1 — pagina nuova e datata

**Data: 03/08/2026.** Decisione del PO, presa dopo aver letto per intero la situazione e i
suoi asterischi.

Questa pagina **non modifica** `KPI_5_4_4.md`, firmata la mattina del 03/08: la regola di
casa vuole che una soglia firmata non si tocchi e che ogni cambiamento viva in un documento
proprio, datato (regola 3, catalogo E08). Qui si **registra un esito**, non si sposta una
barra.

---

## L'esito

> **F1 · RAGGIUNTO a 6 giri.**
> Strumento: la **congiunzione dei due nulli**. Margine sul nullo letterale **p = 0,0368**
> (sottile). Frontiera vera nell'intervallo **[6, 8)**.

Riferimenti: `ai_lab/confronto/ESITO_curva_orizzonte.md` ·
`ai_lab/confronto/ESITO_nullo_informato.md` · dati in `ESITO_curva_orizzonte.json` e
`ESITO_curva_nullo_informato.json`.

## Cosa è stato misurato

| giri | nullo letterale (ordine fermo) | nullo informato (+ pit-loss) | batte entrambi |
|---|---|---|---|
| 2 | 161-69 · p 0,0000 | 62-17 · p 0,0000 | sì |
| 3 | 146-72 · p 0,0000 | 92-17 · p 0,0000 | sì |
| 4 | 136-80 · p 0,0002 | 105-15 · p 0,0000 | sì |
| 5 | 129-83 · p 0,0019 | 114-17 · p 0,0000 | sì |
| **6** | **119-88 · p 0,0368** | **127-16 · p 0,0000** | **sì** |
| 8 | 102-86 · p 0,2739 | 150-9 · p 0,0000 | no |
| 10 | 101-84 · p 0,2394 | 158-14 · p 0,0000 | no |

Controllo a 2 giri riprodotto in entrambe le misure: **235 casi, 36-12, p = 0,0007**.

## Perché lo strumento è la congiunzione, e non il nullo letterale

F1 dice «batte il non-fare-niente», e il nullo letterale è quello. Da solo passerebbe, a 6
giri, con **p = 0,0368** — un margine che non varrebbe la pena difendere.

I due nulli **sbagliano in verso opposto**: quello letterale è pessimo subito dopo la sosta
ma diventa accidentalmente buono a lungo raggio, perché su gomme nuove il pilota recupera
la posizione; quello informato è ottimo subito e peggiora sempre, perché non lascia
recuperare nessuno. Un motore che ne battesse **uno solo** starebbe sfruttando la debolezza
strutturale di quello. La congiunzione è la lettura **più severa** disponibile, ed è la
ragione per cui questa registrazione è difendibile.

## I tre asterischi, dichiarati

**1 · La lettura della prima curva è bloccata da un mio criterio degenere.** La sua prereg
marcava CONTAMINATO ogni punto con almeno una sosta di rivali nella finestra: con venti auto
è vero sempre, e marca anche il punto di controllo dove il motore funziona in modo
dimostrato. Quel documento non si riscrive, quindi la prima curva **da sola** non conclude.

**2 · Il nullo informato è stato introdotto dopo aver visto la prima curva.** È stato
pre-registrato prima di essere misurato, con la previsione scritta — e **la previsione era
sbagliata**: mi aspettavo che il vantaggio crollasse, ed è cresciuto. Rende la barra più
alta, non più bassa. Ma la sequenza è quella, e va detta.

**3 · Il 6 è nella griglia perché F1 diceva 6.** La griglia misurata è 2, 3, 4, 5, 6, 8, 10:
**il 7 non c'è**. Quindi «la frontiera è esattamente 6» è in parte un artefatto di dove sono
stati piantati i paletti, e la frontiera vera sta in **[6, 8)**.

## Perché non esiste una versione senza asterischi

Rifare la misura con entrambi i nulli dichiarati in partenza e una griglia più fitta
sembra la strada pulita. **Non lo è**: una prereg è tale solo se scritta prima di conoscere
il risultato, e il risultato è noto. Scrivere adesso una pagina che dichiara lo strumento
sarebbe pre-registrare una misura già vista — la forma più elegante di barare.

E non cambierebbe i numeri: il calcolo è deterministico, gli stessi dati danno gli stessi
valori. Non c'è nessun problema di tentativi multipli. C'è solo che la pulizia procedurale
si è persa quando il primo criterio è risultato degenere, e non si ricompra a posteriori.

## La conseguenza pratica, che vale più della registrazione

**Il prodotto adesso sa cosa può promettere: circa sei giri.** Non due, come diceva la
diagnosi del 02/08, e non la bandiera.

E c'è un numero da correggere, trovato registrando questo esito:

> Il motore dichiara **`orizzonte_validato = 10`** — `Math.max(...)` di
> `delta_70.decisione.orizzonti_validati = [5, 10]` — e con esso marca «oltre il validato»
> solo il **13,8%** dei pannelli. Ma quel 10 viene dall'esperimento su **δ₇₀**, che è una
> domanda diversa: fin dove è validato il coefficiente del carburante, non fin dove è
> validata la risposta del motore.

Da oggi quel numero **sovra-dichiara**: a 8 e 10 giri il motore non batte più il nullo
letterale, quindi la sua risposta non è validata lì. La correzione **non si fa toccando
`modello_v2.json`** — è un file sigillato e l'holdout di Zandvoort dipende dai suoi hash.
Va fatta dove il numero viene *usato*, cioè nel costruttore, e siccome cambia ciò che la
pagina dichiara è **una decisione del PO**, non una riparazione da fare di nascosto.

## Cosa questa registrazione NON fa

- Non modifica `KPI_5_4_4.md` né alcuna soglia firmata.
- Non registra nessun altro KPI: **F2, F3, F4 e F5 restano aperti**, e F4 ha il suo
  problema di denominatore (due gare) tuttora non deciso.
- Non accende niente in produzione.
