# ESITO — i rivali non fermi: NULL, ma il difetto ora ha un nome solo

**Data: 04/08/2026.** Esegue `PREREG_rivali_comportamentali.md`, sigillata prima dei numeri.
Dati: `ESITO_cancelli_rivali.json`. Nessuna soglia toccata.

---

## Il verdetto

Taratura verde: il braccio «rivali fermi» riproduce il motore di oggi esattamente
(errore mediano **7**, «arrivi così» **64/167**, n **167**).

| | rivali fermi (oggi) | rivali attesi | a caso (placebo) |
|---|---|---|---|
| errore mediano | 7 | **7** | 7 |
| «arrivi così» | 64/167 | **68/167** | 70/167 |

| | cancello | esito |
|---|---|---|
| **R1** | errore mediano ≤ 6 con p ≤ 0,05 | **NON PASSA** — resta 7, pur vincendo 46-26 (p = 0,0245) |
| **R2** | «arrivi così» sotto 45/167 | **NON PASSA** — peggiora, 64 → 68 |
| **R4** | placebo: i rivali a caso non devono funzionare uguale | **PASSA** — a caso 39-32, attesi 46-26 |

> **NULL.** Per la regola scritta nella prereg §5: *«R1 e R2 non passano → il difetto resta
> aperto sul terzo pezzo: l'obiettivo è ancora il **tempo**, non la **posizione**.»*

## 1 · Cosa è successo davvero, ed è più interessante del NULL

Il segno vince: **46-26 con p = 0,0245**. Dare ai rivali una sosta plausibile migliora la
previsione **caso per caso**, in modo statisticamente netto. E il placebo lo conferma: con
le soste sorteggiate nella stessa finestra il vantaggio scende a **39-32**, quindi **conta
il *quando*, non solo che si fermino**.

Ma la **mediana non si muove** (7 → 7) e i «non fermarti mai» **aumentano** (64 → 68).

La lettura è questa: i rivali in movimento spostano molti casi di **poco** — abbastanza da
vincere il conteggio dei segni, non abbastanza da spostare la mediana. E dove spostano il
piano lo spostano nella direzione sbagliata: con i rivali che si fermano, restare fuori
diventa *relativamente* più conveniente, perché il pilota guadagna posizioni gratis mentre
gli altri sono ai box. **Il motore, che ottimizza il TEMPO, non vede che quelle posizioni le
riperderà**: le riperderà al proprio pit-stop, e riperderle costa solo se la posizione conta.

Cioè: aver tolto la finzione «rivali fermi» ha reso **visibile** la finzione che resta.

## 2 · Il difetto ora ha un nome solo, e non è più un elenco

La diagnosi originale del PO era una lista di tre:

> «minimizza il tempo totale di gara, **con i rivali fermi**, **senza traffico** e **senza
> posizione in pista**»

Al 04/08, dopo oggi:

| | stato |
|---|---|
| senza traffico | **chiuso** — il tetto al movimento è acceso, con soglia misurata su 5.498 occasioni. Errore mediano 8 → 7, «arrivi così» 73 → 64 |
| rivali fermi | **misurato e NULL** — il meccanismo esiste, funziona, vince i segni, ma non sposta il prodotto |
| senza posizione | **aperto, ed è l'unico rimasto** |

I due pezzi caduti erano necessari perché il terzo sia **misurabile**: senza tetto le auto si
attraversano e la posizione finale coincide col tempo, quindi cambiare obiettivo sarebbe
stato inerte; con i rivali fermi la classifica alla bandiera è una finzione. Adesso non lo
sono più.

## 3 · Cosa resta costruito, e dichiarato spento

- `simulatore/scenario/rivali.mjs` — le soste **attese** dei rivali, dedotte da mescola ed
  età al congelamento. **Registrata in `banco/misure_congelamento.mjs`** e provata invariante
  al troncamento da **s14**: non sbircia oltre `Lf`.
- `pianoOttimo` e `valutaPiano` inoltrano il piano dei rivali fino al costruttore. **Prima
  non lo facevano affatto** — il parametro esisteva solo su `costruisciScenario` e nessuno
  glielo passava, quindi il pianificatore ottimizzava contro venti auto ferme anche al banco.
- **Nessun percorso di produzione lo usa.** È costruito e dormiente, e va scritto perché un
  meccanismo vivo che nessuno chiama è il modo in cui il progetto ha già perso gli scenari
  della PR #64 per un mese.

### Il nome è diverso apposta

Il parametro nuovo si chiama **`sosteAtteseRivali`**, non `pianiRivali`. Non è cosmesi: la
sentinella **s25** vieta `pianiRivali` in **ogni** percorso di produzione, perché quel nome
significa *le soste vere*, cioè informazione dal futuro (E14). Quel divieto **resta intatto**
— non è stato allargato per far passare questo lavoro, che sarebbe il modo classico di
rompere un controllo. Le due fonti hanno due nomi, e il costruttore dichiara due assunzioni
diverse: `SOSTE_VERE_DEI_RIVALI` e `SOSTE_ATTESE_DEI_RIVALI`.

## 4 · Il passo successivo, già scritto

L'obiettivo di `valutaPiano` è `risultato.cum[pilota]`: **il proprio tempo alla bandiera**.
La proposta naturale è la **posizione** alla bandiera, col tempo come spareggio — e adesso
ha senso, perché il tetto rende la posizione appiccicosa e i rivali attesi rendono la
classifica non finta.

Vuole la sua prereg, e due cose vanno decise **prima**: (a) se la posizione si legge sulla
popolazione intera o sui soli rivali con un passo stimabile; (b) quale cancello la protegge,
perché un obiettivo che massimizza la posizione può volere piani che perdono tempo, e la
risposta a due giri — la sola validata — non deve pagarlo.
