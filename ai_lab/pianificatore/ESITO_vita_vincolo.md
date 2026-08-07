# ESITO — il muro c'è, vince dove tocca, e non basta

**Data: 05/08/2026.** Esegue `PREREG_vita_vincolo.md`, sigillata prima dei numeri (commit
`f183324`). Dati: `ESITO_vita_vincolo.json`. Nessuna soglia toccata.

**Taratura passata**: il braccio senza vincolo riproduce il motore di oggi **esattamente** —
errore mediano 7, «troppo poche» 114, «troppe» 0.

---

## Il verdetto

| | cancello | esito |
|---|---|---|
| **V1** | cambia davvero qualcosa | **PASSA** — 20 piani su 167, il **12,0 %** |
| **V2** | riduce il bias a senso unico | **NON PASSA** — 114 → **102**, ne servivano ≤ 90 |
| **V3** | non peggiora | **PASSA** — errore mediano 7, invariato |
| **V4** | raggiunge il pavimento | **NON PASSA** — 7 contro i 5 della tabella |
| **V5** | non fa danno | **PASSA** — zero violazioni del regolamento |

> **RIPORTATO, NON SPEDITO.** Il vincolo lega, ma non cura il bias a senso unico.

Il ramo resta in codice e **spento**: `pianoOttimo({vitaMassima})` con riserva `null`, il
predicato in un posto solo (`pianoFattibile`), sentinella **s40**.

## 1 · Dove tocca, ha ragione

È la riga che rende questo un NULL interessante invece che un NULL e basta:

> Sui **20 casi** in cui il vincolo cambia il piano, il confronto appaiato dà **15-5 a
> favore del vincolo**, p = **0,0414**.

Il meccanismo è giusto. Quando il muro dice «quella gomma non arriva fin lì», ha ragione tre
volte su quattro. Non è un vincolo che rompe: è un vincolo che **non arriva abbastanza**.

E il numero di soste si muove nel verso giusto — «troppo poche» da **114 a 102**, «troppe»
da 0 a **1** — solo di dodici casi su centoquattordici.

## 2 · Perché non arriva: era scritto nella prereg, ed è successo

La prereg §3 lo dichiarava prima di misurare:

> *«E va detto subito che il p90 potrebbe legare troppo poco. Le code sono lunghissime — una
> SOFT da 55 giri esiste — anche perché `SOFT/MEDIUM/HARD` sono etichette relative.»*

I numeri lo confermano. Il vincolo scelto per **non proibire ciò che i team hanno fatto**
(p90: SOFT 27,8 · MEDIUM 30,9 · HARD 34,0, che vieta il 10,1 % degli stint veri) è **molto
più largo** delle durate tipiche (SOFT 12 · MEDIUM 19 · HARD 22). Fra la mediana e il muro
ci sono quindici giri di spazio in cui il pianificatore continua a fare quello che faceva.

E la stretta successiva è preclusa: il p75 vieterebbe il **24,4 %** di ciò che è successo
davvero. **Un muro che proibisce un quarto della realtà non è un muro**, ed è escluso in §3
prima dei numeri — non dopo averlo provato.

> **Non esiste un muro compatibile con ciò che i team hanno davvero fatto che sia stretto
> abbastanza da spiegare il sotto-fermarsi.**

## 3 · Otto casi non avevano nessun piano fattibile

In **8 casi su 167** il vincolo rendeva infattibili tutti i `k`, e il motore ha **rilassato
il vincolo e lo ha dichiarato**, come la prereg §4 imponeva di fare. Un prodotto che non
risponde è peggio di un prodotto che risponde dicendo di aver allentato un vincolo.

Otto su centosessantasette è il 4,8 %: il vincolo non è un interruttore che spegne il
pianificatore. Ma la strada è quella, e se un giorno lo si stringesse quel numero è il primo
da guardare.

## 4 · Il bilancio: l'ultimo candidato è caduto anche lui

| candidato | esito |
|---|---|
| l'**obiettivo** è il tempo e non la posizione | **inerte al 97 %** — 5 casi su 167, tutti Monaco |
| il **ρ** è basso per selezione | **caduto** — il placebo dice curvatura, p = 0,39 |
| il **`P`** è troppo alto | **caduto** — servirebbe 1,8× più piccolo del minimo misurato |
| la **vita** è una penalità invece che un muro | **lega ma non basta** — 114 → 102 |

Quattro candidati, quattro misure, nessuno spiega il sotto-fermarsi. E il primo di loro —
la scomposizione — aveva già detto che **regalando al motore il numero di soste vero
l'errore scende da 7 a 5**, cioè al pavimento.

**Quindi il difetto è reale, è grosso, e nessuna delle spiegazioni disponibili lo copre.**
Questo è il punto onesto in cui la sessione si ferma: non con una cura, ma con quattro
strade chiuse e la loro misura, che è ciò che serve a non ricominciare da capo la prossima
volta.

## 5 · Cosa proverei io, e perché NON l'ho provato oggi

Il candidato che resta è quello che nessuna di queste quattro misure tocca: **la safety
car**. I team si fermano quando esce, e una sosta sotto neutralizzazione costa la metà — il
motore lo sa (`fattori_neutralizzazione` SC 0,50) ma solo **a cose fatte**, quando la SC c'è
già. Non ha **nessuna probabilità a priori** che una SC esca: pianifica in un mondo dove non
esce mai, e in quel mondo fermarsi meno è corretto.

Non l'ho aperto oggi perché ha un ingresso che il progetto **non ha**: la probabilità di SC
per circuito e per giro. Costruirla è una sessione sua, con la sua prereg — e con un ostacolo
noto in partenza, cioè che il **VSC è dichiarato rotto** (`R_lap` 1,055) e metà delle
neutralizzazioni passa di lì.

## 6 · Cosa NON si conclude

- **Non** si conclude che la vita della gomma non sia un muro nella realtà. Si conclude che
  **il muro misurabile dalle nostre osservazioni** — che sono decisioni, non rotture — è
  troppo largo per spostare il piano.
- **Non** si tocca niente in produzione: il vincolo nasce spento e resta spento.
