# ESITO — il tetto uniforme: F2 passa, ma passa diventando il nullo

**Data: 03/08/2026.** Esegue `PREREG_tetto_uniforme.md`, sigillata poche ore prima
(commit `00dc267`). Numeri: `ESITO_cancelli_tetto_uniforme.json`. Nessuna soglia toccata.

---

## Il verdetto in una riga

> **U1 passa, U3 passa, U2 fallisce.** Per la regola di decisione scritta nella prereg,
> **F2 è raggiunto e F3 è mancato**. Ma il modo in cui U1 passa non è quello che il KPI
> intendeva, e va scritto prima dei numeri di dettaglio.

## Prima di tutto: la taratura

Il braccio senza vincolo riproduce **esattamente** i numeri pubblicati — n = 193, terzile
alto 13-28, basso+medio 44-27 — quindi lo strumento è tarato e i suoi verdetti valgono.
Questa riga è anche **U5** (invarianza a vincolo spento).

## I numeri

Perimetro: **undici gare** (Miami rientra: senza parametro per circuito non serve il suo
file), configurazione oracolo, **strati congelati** sul braccio senza vincolo — i due
bracci si leggono sugli stessi 193 casi, appaiati 193/193, nessuno perso.

| | | senza vincolo | col vincolo uniforme |
|---|---|---|---|
| **terzile alto** (la ferita) | appaiato | 13-28 · p 0,0275 | **10-21 · p 0,0708** |
| | pari | 22 | **32** |
| | quota di vittorie fra i discordanti | 31,7 % | **32,3 %** |
| **basso+medio** (la parte sana) | appaiato | 44-27 · p 0,0568 | **31-28 · p 0,7948** |
| | pari | 59 | **71** |
| | quota di vittorie fra i discordanti | 62,0 % | **52,5 %** |
| **due giri** | appaiato col/senza | — | 5-13 · n 178 · p 0,0963 |
| **eccesso di movimento** (terzile alto) | | +1,84 | **−1,41** |

| | cancello | esito |
|---|---|---|
| **U1** | p ≥ 0,05 **e** saldo ≥ −15 | **PASSA** (0,0708 · −11) |
| **U2** | saldo ≥ +17 **e** p ≤ 0,0568 | **NON PASSA** (+3 · 0,7948) |
| **U3** | due giri non peggiore con p < 0,05 | **PASSA** (5-13, p 0,0963) |
| U4 | eccesso di movimento *(diagnostico)* | +1,84 → −1,41 |
| **U5** | invarianza a vincolo spento | **PASSA** (taratura 3/3) |

## Come U1 passa davvero, e perché conta più del fatto che passi

Il saldo del terzile alto migliora da −15 a −11. Sembra la ferita che si rimargina. Non lo è:

> **La quota di vittorie fra i casi discordanti è 31,7 % senza vincolo e 32,3 % col
> vincolo. Invariata.** Quello che cambia è il numero di **pareggi**: da 22 a 32.

Il motore non sbaglia meno. Sbaglia **uguale, più raramente**: il vincolo gli impedisce di
muovere le auto, e un motore che non muove le auto **coincide col nullo**, che è per
definizione «non cambia niente». Il diagnostico U4 lo conferma e va oltre: l'eccesso di
movimento passa da +1,84 a **−1,41**, cioè il motore da «ne inventa troppo» diventa «ne
produce troppo poco». Non si è centrato: ha attraversato il bersaglio.

E la stessa cosa, letta dall'altra parte, è **U2 che crolla**: nella popolazione sana la
quota di vittorie scende da 62,0 % a 52,5 %, cioè a una moneta. Lì il movimento che il
motore produceva era **giusto**, e il vincolo lo spegne insieme a quello sbagliato.

Un solo meccanismo spiega tutte e tre le righe: **il vincolo avvicina il motore al nullo,
ovunque.** Dove il motore era peggio del nullo, avvicinarsi sembra un miglioramento; dove
era meglio, è una perdita secca.

## Il difetto di F2, che questo esito rende visibile — e che NON si riscrive

F2 chiede che la popolazione ferita «smetta di essere peggiore del nullo», operativamente
**p ≥ 0,05 e segno non peggiorato**. Ma:

> **Il nullo stesso soddisfa F2 alla perfezione.** Un motore che coincidesse col nullo
> avrebbe zero discordanti, p = 1 e saldo 0: p ≥ 0,05 ✓, segno non peggiorato ✓.

F2, da solo, è quindi un KPI che **premia lo spegnersi**. Non è una scusa per non
registrarlo — è firmato, e una soglia firmata non si allarga né si stringe dopo aver visto i
risultati (regola 3, E08). Si registra l'esito **e** si registra il difetto, come si è fatto
per il criterio di contaminazione della curva dell'orizzonte e per la soglia mal specificata
di T2.

Va anche detto cosa **regge**: **F3 è esattamente la guardia contro questa degenerazione**,
e infatti l'ha intercettata. La coppia F2+F3 fa il suo lavoro; è F2 da solo a non farlo.
Chiunque legga «F2 raggiunto» senza F3 accanto sta leggendo metà del risultato.

## U3 passa, ma passa per mancanza di potenza — e va detto

Sui 178 casi appaiati a due giri ci sono **160 pareggi e 18 discordanti**: 5-13, p = 0,0963.
La direzione è **avversa** (il vincolo peggiora la risposta due volte e mezzo più spesso di
quanto la migliori); a non essere raggiunta è la significatività.

U3 è un cancello che **la scarsa potenza rende più facile da passare**, ed è lo specchio del
ragionamento scritto per F4: là si è detto che la scarsa potenza non protegge da un
fallimento netto, qui va detto che **non trasforma un danno probabile in un'assoluzione**.
Il confronto con la variante per circuito resta però informativo: 16-33 con p = 0,0213
diventa 5-13 con p = 0,0963. **Il danno alla risposta a due giri si riduce molto** quando si
toglie il parametro inerte. Questo pezzo dell'ipotesi era giusto.

## Il NULL, nella formula che la prereg impone (§8)

> **Il pezzo che riduce il movimento inventato non è separabile dal suo costo.** Frenare le
> auto avvicina il motore al nullo dappertutto: raddrizza cosmeticamente la popolazione che
> inventava movimento — senza migliorare di un punto la quota di risposte giuste — e
> distrugge quella che il movimento lo produceva bene, portandola a una moneta. Vale anche
> dopo aver tolto il parametro per circuito, l'unico sospettato di essere arbitrario.

È il **nono** risultato indipendente della stessa famiglia, e chiude il tetto al movimento
**come strada**, non come parametrizzazione: non resta un parametro da provare, resta il
fatto che un freno al movimento non distingue il movimento giusto da quello sbagliato.

## Cosa resta acceso, e cosa no

- Il vincolo resta nel codice **SPENTO** (`tetto: null` nel contesto). Nessun percorso di
  `web/` o `demo/` lo mette nel contesto, e questo esito non chiede di accenderlo: la
  configurazione che raggiunge F2 è la stessa che fallisce F3, quindi **non è spedibile**.
- La variante «più leggera» (costi di duello azzerati) **non si prova**, come la prereg §6
  aveva già scritto: azzerare un parametro non è importarlo. E ora c'è una ragione in più
  per non provarla — il meccanismo del danno non è la sua *intensità*, è che il freno non
  sa distinguere: un freno più leggero frena meno di tutto, non meno del solo sbagliato.
- Il limite di §5 vale: **nessun placebo nuovo**, quindi questo esito può dire «non
  danneggia» o «danneggia», mai «il meccanismo è reale».

## Cosa questo esito NON dice

- **Non dice che la fisica del duello sia sbagliata.** Dice che, con questi dati e questa
  metrica, un freno uniforme non separa il movimento giusto da quello inventato.
- **Non dice niente sulla reazione dei rivali**, che è una causa diversa e resta aperta:
  lì il motore non frena il movimento, ne aggiunge di credibile.
