# ESITO — la vita della gomma dalla pista: NULL, e il fattore che c'è già è peggio di così

**Data: 04/08/2026.** Esegue `PREREG_vita_per_circuito.md`, sigillata prima dei numeri
(commit `21bb291`). Dati: `ESITO_cancelli_per_circuito.json` e `fattore_storico.json`.
Nessuna soglia toccata.

---

## Il verdetto

| | cancello | esito |
|---|---|---|
| **C1** | batte «la pista non conta» (fattore = 1) | **NON PASSA** — errore mediano **5,20 giri contro 5,00**: è **peggio**, di 0,20 giri |
| **C2** | non peggio del fattore 2026 in produzione | **NON PASSA** — 5,20 contro **3,52**, segni 132-183, p = 0,0048 |
| **C3** | **placebo**: i fattori veri assegnati alle piste sbagliate | **NON PASSA** — p = 0,42: **83 rimescolamenti su 200** vanno bene quanto quello giusto |
| **C4** | non fare danno attraverso il pianificatore | passa, ma **degenere** (§5): i tre bracci danno tutti 6 giri |

Per la regola di decisione scritta nella prereg §8, e senza margini di lettura:

> **NULL.** La vita della gomma cercata sulla pista, in questa forma, non predice le durate
> del 2026 meglio del non avere nessun fattore. **E la stessa evidenza toglie la gamba anche
> al fattore che è in produzione adesso: la proposta al PO è SPEGNERE il fattore per
> circuito, non sostituirlo.**

Spegnerlo è una modifica alla produzione: si propone, non si fa.

Perimetro: **315 stint del 2026** (su 427: via 112 con la sosta sotto SC o bandiera rossa)
contro **3.743 stint del fondo 2018-2025**, su 147 gare asciutte, con 25 piste che ricevono
un fattore proprio.

## 1 · Perché è un NULL forte e non un «quasi»

C3 è il cancello che conta di più, ed è quello che risponde peggio. Rimescolare i fattori
storici fra i circuiti — dare a Monaco quello di Spa, a Miami quello di Budapest — funziona
**quanto assegnarli giusti** in 83 casi su 200. Il numero che descrive quella pista non
contiene informazione su quella pista.

È la **nona** volta che questo progetto arriva lì da una porta diversa, ed è la prima volta
che ci arriva con otto stagioni di fondo invece che con undici gare. La fonte nuova era la
sola condizione che rendeva legittimo riaprire il NULL: è stata usata, e la risposta non è
cambiata.

Va detto per intero, perché non è zero: le due stime **si somigliano un po'**. La
correlazione di rango fra il fattore 2026 e quello storico è **ρ = 0,51** su undici
circuiti — che con undici punti **non è significativa** (servirebbe 0,62) — e **due
circuiti cambiano proprio verso**: la Spagna è corta secondo il 2026 e lunga secondo la
storia, la Gran Bretagna il contrario. Un ordinamento che regge a metà e si ribalta su due
piste su undici non è una proprietà della pista: è quello che si vede quando due rumori
condividono un pezzo di segnale troppo piccolo per contare.

## 2 · La cosa più importante non è il NULL: è quanto è gonfio il fattore in produzione

C2 dice che il fattore 2026 vince, e vince nettamente: **3,52 giri di errore mediano contro
5,20**. Ma quel numero **ha già visto le durate che deve prevedere** — ed è impossibile che
non le abbia viste, per la ragione strutturale del §3. È un nullo **favorito**, e batterlo
sarebbe stato un risultato forte; non batterlo non dice quasi niente su chi ha ragione.

Quello che dice, e dice forte, è **quanto vale l'aggiustamento in campione**:

| | errore mediano | cos'è |
|---|---|---|
| fattore 2026, in campione | **3,52 giri** | ha visto queste durate |
| nessun fattore | **5,00 giri** | il pavimento |
| fattore storico, fuori campione | **5,20 giri** | otto stagioni che non hanno mai visto il 2026 |

Il vantaggio di 1,48 giri del fattore in produzione **non sopravvive a una stima
indipendente**. E c'è un secondo indizio, indipendente dal primo: il fattore 2026 è **una
volta e mezza più disperso** di quello storico (deviazione standard 0,226 contro 0,153;
estremi 0,526-1,395 contro 0,741-1,187). Otto stagioni di dati dicono che le piste
differiscono **meno** di quanto undici gare abbiano stimato. Undici gare, una per circuito,
non possono distinguere «questa pista consuma» da «quel giorno è andata così».

## 3 · Il difetto della prereg, a referto: C2 chiedeva una cosa impossibile

La prereg §5 scriveva che il fattore 2026 si sarebbe ricalcolato **leave-one-race-out**. Non
esiste, e non per un errore di codice:

> **Nel 2026 ogni circuito compare esattamente una volta. Togliere la gara toglie il
> circuito.**

La prima esecuzione lo ha fatto davvero: il fattore leave-one-race-out di Monaco era
`undefined`, quindi 1, quindi N2 — e N1 e N2 uscivano **identici in ogni riga**. Due nulli
che sembravano due ed erano uno. Il difetto è stato trovato dalla tabella per circuito, non
da un test: le due colonne combaciavano cifra per cifra.

Messo a referto invece che aggiustato in silenzio (regola 3). N1 è stato riportato **in
campione**, con l'etichetta attaccata al numero.

**La conseguenza è più grande del cancello**, e vale la pena scriverla da sola:

> **Il fattore per circuito in produzione non può essere validato fuori campione con nessuna
> procedura, finché il 2026 è l'unica fonte.** Non è che nessuno ci ha provato: non si può.
> Undici circuiti, una gara ciascuno. Il fattore storico invece si può — fondo e 2026 sono
> disgiunti per costruzione — ed è per questo che questo esperimento poteva esistere.

## 4 · Il fattore era anche una fonte orfana, e adesso non lo è più

Trovato scrivendo la prereg, e sistemato a prescindere dai cancelli: **nessuno script
scriveva `simulatore/data/modelli/vita_mescola.json`**. Gli undici numeri esistevano perché
qualcuno li aveva scritti a mano seguendo una ricetta che viveva in prosa dentro il file, e
il campo `generato_da` dichiarava `decisioni.mjs`, che non calcola nessun fattore e non
scrive niente.

`ai_lab/degrado/fattore_circuito.mjs` è il generatore. La ricetta descritta dalla prosa —
*mediana delle durate del circuito diviso mediana di tutte* — **riproduce i numeri in
produzione a tutte e tre le cifre, su tutti e undici i circuiti** (mediana globale: 19
giri). Quindi la prosa era esatta, e adesso è anche eseguibile: `--verifica` esce 1 sulla
deriva.

Questo esito **non dipende dai cancelli**: il fattore di oggi è il nullo dell'esperimento, e
un nullo scritto a mano non è un metro.

## 5 · C4 passa, e il modo in cui passa dice un'altra cosa

Attraverso il pianificatore i tre bracci danno **lo stesso identico errore mediano: 6 giri**.
Storico, fattore di oggi, nessun fattore: indistinguibili. Ci passano solo **103 delle 315
decisioni** (178 non misurabili: al giro d'inizio del primo stint il motore non ha giri
verdi da cui ricavare un passo).

E il conto è stampato accanto all'esito, perché un cancello di non-fare-danno che passa
«perché non si muove niente» va distinto da un termometro rotto:

> i tre bracci producono una risposta **diversa** in **6 casi su 103** (storico contro
> nessun fattore) e in **9 su 103** (fattore di oggi contro nessun fattore).

Quindi il collegamento esiste — non è inerte come lo era il selettore mescola prima del
04/08 — ma **muove il 6-9 % delle risposte**, e non abbastanza da spostare una mediana. Non
è un risultato sul fattore: è l'ennesima misura del **lavoro n. 3**. Un parametro, in quel
percorso, non arriva a destinazione.

## 5-bis · Un guasto trovato per strada: il cancello della prereg madre si era spento da solo

Rilanciando `cancelli_vita.mjs` per il braccio C4 è venuto fuori che **non riproduceva più
il proprio esito**: V1 usciva **0-0 con 167 pari** invece di 35-8, ed errore mediano 7 contro
7 invece di 8 contro 11.

La causa, e non era nel modello. Quel file scriveva la vita dentro `modello.vita_mescola`;
il costruttore legge `contesto.vitaMescola ?? modello.vita_mescola`. Quando il commit che ha
**acceso** la mescola in produzione (`916bc94`) ha cominciato a mettere `vitaMescola` nel
contesto — **dopo** che il cancello aveva già prodotto il suo esito (`2036df0`) —
quell'override è diventato inerte: entrambi i bracci ricevevano la vita di produzione, e il
cancello confrontava **il modello con se stesso**. Verde, e muto.

È **E22** nella sua forma pura: un numero pubblicato, e il fix che lo ha invalidato arrivato
dopo, in silenzio. Con una aggravante rispetto agli altri E22 del catalogo: qui il guasto
rendeva il cancello **incapace di fallire**, che è il difetto della regola 4.

Sistemato, e la prova che la correzione è quella giusta è che i numeri **tornano quelli a
referto**: V1 35-8, errore mediano 8 contro 11, V2 48-107. **`ESITO_vita_mescola.md` resta
valido**, e la decisione del PO che ci si appoggia pure.

La sentinella `s37` ha un caso in più, e prova esattamente la precedenza fra le due sorgenti
del parametro — verificato che **esce 1** se la si inverte. Il guasto non stava nel passo,
che s37 copriva già: stava in chi vince fra contesto e modello, che nessuno guardava.

## 6 · Le robustezze dichiarate (non decidono, e infatti non hanno deciso)

| robustezza | errore mediano |
|---|---|
| era 13 pollici (2018-2021) | 5,00 |
| era 18 pollici (2022-2025) | **4,68** |
| esclusione più larga (in-lap **o** giro prima sotto SC/rossa) | 5,18 |
| perimetro intero, 427 stint senza l'esclusione | STORICO 5,70 · N1 3,86 · N2 5,00 |

La riga interessante è la seconda: **restringere all'era delle gomme attuali migliora**
(4,68 contro 5,00 di N2 — il solo caso in cui la storia batte il pavimento). La prereg §9
dice che questo si riporta e non decide, e così resta: è una lettura scelta **dopo** aver
visto quattro numeri, e promuoverla sarebbe scegliere il perimetro. Se qualcuno vuole
seguirla, è una **prereg nuova** — con la sua soglia e il suo placebo, che è esattamente
quello che ha ucciso questa.

## 7 · Zandvoort, che era la ragione pratica di tutto questo

La storia gliene darebbe uno: **1,184**, da quattro edizioni (2021, 2022, 2024, 2025 — la
Dutch 2023 è bagnata ed esce dal perimetro). Il 23 agosto Zandvoort correrà con **fattore
1**, come già previsto per i circuiti ignoti.

La differenza rispetto a ieri non è il numero: è che oggi quel fattore 1 è una **decisione
misurata** invece di un valore di riserva. Il fattore storico esiste, è stato calcolato, e i
cancelli dicono di non usarlo.

## 8 · Cosa NON si conclude da qui

- **Non** si conclude che la vita della gomma non dipenda dalla pista in senso fisico. Si
  conclude che, misurata come *quanto i team ce la tengono*, la differenza fra piste non
  sopravvive a un placebo.
- **Non** si conclude niente sul termine `vita_mescola` in sé: i `giri` per mescola (SOFT
  12, MEDIUM 19, HARD 22) non sono stati toccati da questo esperimento. Qui si è giudicato
  solo il **fattore**.
- **Non** si è tentata la strada dell'offset/scala imparato sul 2026: era esclusa per nome
  dalla prereg, e resta esclusa.

## 9 · Cosa resta aperto, in ordine

1. **La proposta al PO**: spegnere `fattore_circuito` (metterlo a 1 per tutti, o toglierlo).
   È una modifica alla produzione e non si fa senza firma.
2. **Il lavoro n. 3** — l'obiettivo del pianificatore — che §5 ha misurato ancora una volta:
   finché un parametro non arriva a destinazione, migliorarlo non cambia il prodotto.
3. Il **debito VSC** resta la contaminazione dichiarata di questo perimetro: le soste
   opportunistiche sotto VSC sono dentro, e ci restano finché quel segnale non è capito.
