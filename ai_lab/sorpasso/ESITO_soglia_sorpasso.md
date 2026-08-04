# ESITO — la soglia di sorpasso: il divario di passo conta, la geometria è solo Monaco

**Data: 04/08/2026.** Esegue `PREREG_soglia_sorpasso.md`, sigillata prima dei numeri.
Dati: `ESITO_cancelli_soglia.json`, `ESITO_aggancio_tetto.json`. Nessuna soglia toccata.

---

## Il verdetto

| | cancello | esito |
|---|---|---|
| **S1** | il divario di passo conta | **PASSA** — b = −1,983 · z = −21,8 · p < 0,0001 |
| **S2** | l'indice geometrico predice la soglia, fuori campione | **PASSA** (di poco) — 0,289 contro 0,301 |
| **S3** | placebo, 500 rimescolamenti dell'indice | **PASSA** (di poco) — R² 0,451 · p = 0,0459 |
| **S4** | **senza Monaco** | **NON PASSA** — R² 0,016 · p = 0,71 |

Ramo imposto dalla prereg §6: **DUE LIVELLI**. E il numero che ne esce è questo:

> **Ogni secondo al giro di vantaggio moltiplica per 7,3 le probabilità di passare entro
> cinque giri.** Perché il sorpasso diventi più probabile che no serve un vantaggio di
> **0,61 s/giro** su dieci piste su undici, e di **2,83 s/giro a Monaco.**

Misurato su **5.498 occasioni** vere di 64 gare asciutte del fondo 2018-2025.

## 1 · Il PO aveva ragione, ed è la prima metà del risultato

> «Una Mercedes dietro una Cadillac passa velocemente, una Aston Martin dietro la Cadillac
> no.»

S1 lo dice con z = −21,8: la sorpassabilità **non è una proprietà della pista da sola**.
Il divario di passo è di gran lunga l'ingrediente più forte, e non era mai stato misurato
in questo progetto — i tre tentativi precedenti trattavano la pista come se il traffico
fosse fatto di auto uguali.

E aveva ragione anche sull'altra metà:

> «A Monaco tre o quattro secondi più veloce e non passi.»

Misurato: a Monaco servono **2,83 s/giro**, contro 0,61 ovunque. Nelle 745 occasioni di
Monaco nel fondo il sorpasso avviene **9 volte** (1,2 %); nelle 122 del 2026, **una**.

## 2 · La geometria però non è una legge: è un nome per Monaco

S2 e S3 passano di misura (0,289 contro 0,301; p = 0,0459 su una soglia di 0,05).
**S4 spiega perché**: tolto Monaco, l'R² fra indice geometrico e soglia crolla da 0,451 a
**0,016**, con p = 0,71. La relazione è **interamente** il punto (indice 0,00; soglia
2,83).

È esattamente il fallimento che la prereg si aspettava e aveva scritto prima:

> *«Su undici punti un estremo così può portarsi dietro tutta la correlazione da solo, e
> una legge che esiste solo grazie a un punto non è una legge.»*

Quindi non si spedisce una legge continua. Si spedisce ciò che i dati sostengono: **Monaco
è diverso, gli altri no**. L'indice geometrico resta utile per una cosa sola, ed è quella
per cui era nato — **riconoscere una pista dove non si passa**, senza aver mai corso lì.

## 3 · Il DRS: l'attesa era sbagliata, e il numero lo dice

La prereg §7 dichiarava, prima dei numeri, che il livello misurato sul fondo sarebbe stato
**troppo permissivo** per il 2026, perché il fondo ha il DRS e il 2026 no (Manual Override
Mode). Si ancorava quindi il livello con **una** costante.

Misurato: la costante vale **+0,032 s/giro**, cioè **zero**. Il modello del fondo predice
la quota di sorpassi del 2026 (0,2332 previsto contro 0,2425 osservato) **senza bisogno di
essere spostato**.

> **Togliere il DRS non ha cambiato quanto vantaggio di passo serve per sorpassare.**

Non è quello che ci si aspettava, ed è scritto qui perché l'attesa era pre-registrata. La
lettura prudente è che l'effetto del DRS sia già dentro la variabilità che il modello non
distingue; quella meno prudente — che il Manual Override Mode compensi il DRS — questo dato
non la sostiene né la esclude.

## 4 · L'accensione, e cosa costa

Il tetto al movimento era **spento e chiuso NULL due volte** il 03/08, con soglie importate
da TUM. La differenza non è una taratura: è che la soglia adesso è **misurata sui nostri
dati**, e il numero è molto diverso da quello importato.

| | soglia usata | dieci piste su undici |
|---|---|---|
| tentativo 03/08 | TUM, uniforme | **2,025 s/giro** |
| oggi | misurata | **0,605 s/giro** |

La soglia importata era **più che tripla**. Un vincolo così stretto blocca sorpassi che
nella realtà avvengono, ed è la spiegazione più semplice del perché quel tentativo
danneggiava la risposta a due giri.

Con la soglia misurata, sugli stessi cancelli già firmati (U1/U2/U3):

| | senza vincolo | col vincolo |
|---|---|---|
| **movimento inventato** nel terzile alto | **+2,14** cambi per caso | **+0,24** |
| terzile alto (la ferita) | 14-28 · saldo −14 | 12-23 · saldo **−11** |
| strato sano | 45-28 · saldo +17 | 39-28 · saldo **+11** |
| **due giri** (la sola risposta validata) | — | **3-5 · n 178 · p 0,73** |

- **U1 PASSA** (p 0,0895, saldo −11) · **U3 PASSA** · **U2 NON PASSA**.
- Il tentativo del 03/08 sulla risposta a due giri dava 5-13, p 0,0963 — cioè **stava per
  romperla**. Oggi 3-5, p 0,73: **non la tocca**.

**È acceso.** La ragione è la prima riga della tabella: il motore inventava **due cambi di
posizione per caso** nel terzile dove ne inventa di più — auto che si attraversano, che per
un prodotto che mostra una gara è un difetto visibile e non un dettaglio statistico. Il
vincolo lo porta a 0,24, cioè a zero, senza pagare sulla risposta validata. Il tentativo
TUM invece **sovracorreggeva** (arrivava a −1,41: bloccava sorpassi veri).

### Il costo, dichiarato

Lo strato sano perde: saldo da **+17 a +11**. Sei casi passano da vittoria a pareggio —
non a sconfitta (le sconfitte restano 28). E la quota di vittorie fra i discordanti nel
terzile alto sale poco: 33,3 % → 34,3 %, con i pareggi da 21 a 28. **È la stessa forma del
«passa diventando il nullo» del 03/08**, e va detto: il guadagno alla bandiera è fatto in
gran parte di pareggi. Quello che non è fatto di pareggi è la fisica — il movimento
inventato — e quella è la ragione dell'accensione, non il saldo.

## 5 · Un guasto trovato per strada: le linee di base dei KPI sono stale

La taratura di questo banco è fallita al primo colpo: `KPI_5_4_4.md` pubblica terzile alto
**13-28** e strato sano **44-27**, ma il codice di oggi produce **14-28** e **45-28**.

La causa è nota, datata e voluta — `vita_mescola` accesa e `fattore_circuito` spento, **dopo**
che quei numeri erano stati pubblicati. Non è un metro storto: è un mondo che si è mosso, ed
è ciò che la regola «tutto si ri-aggiorna a ogni gara» prevede. Ma resta **E22 al livello
dei KPI**: il documento porta cifre che il codice non riproduce più.

La taratura è stata **ri-ancorata ai valori di oggi, con la causa scritta accanto**, e resta
attiva: se domani si spostano di nuovo senza che qualcuno lo sappia, il banco esce 1 come è
appena successo.

## 6 · Il cablaggio, e la lezione di stamattina applicata

Il tetto si risolve in **un posto solo** (`risolviTetto` in `scenario/costruttore.mjs`) con
tre casi espliciti, e il primo esiste per un motivo preciso:

```
contesto.tetto === false  ⇒  SPENTO ESPLICITAMENTE — serve a chi misura
contesto.tetto oggetto    ⇒  IMPOSTO da chi misura
altrimenti                ⇒  dal sigillo, per circuito
```

Senza il primo caso, il giorno dell'accensione **ogni banco A/B sarebbe diventato A/A in
silenzio** — che è esattamente il guasto trovato stamattina in `cancelli_vita.mjs` (E22,
V1 che usciva 0-0 con 167 pari). La sentinella **s38** prova la precedenza, ed è stata
verificata a fallire togliendo il caso `false`.

Un circuito che non compare nel sigillo prende la **soglia comune**, non 1 e non zero: dieci
piste su undici condividono la stessa soglia, quindi la comune **è** la stima per una pista
nuova. Vale per Zandvoort il 23/08.

## 7 · Cosa resta aperto

1. **U2 non passa**, e non è stato aggirato: il vincolo non migliora lo strato sano.
2. **Monaco è l'unico caso misurato di pista dove non si passa.** Se un giorno il calendario
   ne portasse un'altra (un cittadino stretto), l'indice geometrico è l'unico modo che
   abbiamo per riconoscerla **prima** di correrci — ma la soglia da darle sarebbe
   un'estrapolazione da un punto solo, e va detto.
3. La soglia è stimata con **una pendenza comune** a tutte le piste (prereg §4). Se le piste
   avessero pendenze diverse, `X` ne porterebbe l'errore. Non è stato misurato.
4. `ai_lab/KPI_5_4_4.md` **va rimisurato**: porta numeri che il codice non riproduce più.
