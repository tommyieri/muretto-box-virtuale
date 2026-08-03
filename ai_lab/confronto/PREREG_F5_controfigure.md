# Prereg — F5: le controfigure, e il primo bersaglio è il soffitto

**Data: 03/08/2026.** Scritta **prima** di eseguire una sola estrazione. Nessun numero di
controfigura esiste al momento della firma.

Esegue §F5 di `KPI_5_4_4.md`, firmata la mattina del 03/08:

> **F5 (condizione di ammissibilità di ogni regola).** Una regola vale solo se batte una
> **regola finta** che fermi gli stessi rivali lo stesso numero di volte, ma a giri scelti
> a caso.

---

## 1 · La mossa: si prova il SOFFITTO, non un candidato

La cosa ovvia sarebbe costruire una regola candidata e poi chiederle di battere il placebo.
Qui si fa il contrario, e la ragione è che rende l'esito **indipendente da quanto era buona
la regola scelta**.

Fra regola-identità (saldo −14) e regola-oracolo (+2) ci sono **16 punti**: è tutto ciò che
la famiglia «reazione dei rivali» può dare, perché nessuna regola vera batte chi conosce le
soste vere di tutti. Il banco avverte da sempre, in fondo al posizionamento, che *parte di
quel divario è solo il pit-loss che pagano i rivali, non la reazione indovinata* — ma
nessuno l'ha mai misurato.

> **Domanda di questa prereg: l'oracolo batte la propria controfigura?**
> Cioè: dei 16 punti, quanti vengono dal sapere **quando** si fermano gli altri, e quanti
> dal solo fatto che si fermino?

Il valore della mossa sta nel caso negativo: **se il soffitto non batte il caso, la
famiglia è chiusa qualunque regola le si metta dentro** — non serve costruirne nessuna, e
il tentativo non si spende. Se invece il soffitto batte il caso, allora esiste
informazione strategica da catturare, il divario residuo è quantificato, e **solo allora**
ha senso pre-registrare una regola candidata.

## 2 · Le due controfigure, definite prima

Una controfigura non è una regola: è una **trasformazione** del piano che la regola ha già
prodotto. Conserva tutto — quali rivali si fermano, **quante volte** ciascuno, con **quale
mescola** — e cambia **solo il giro**. `REFERTO_mirrorplay_degenere.md` aveva già stabilito
che i gradi di libertà da spegnere sono **due**, non uno, e qui si spengono entrambi:

**C-LIVELLO.** Gli stessi rivali si fermano lo stesso numero di volte, a giri estratti
**uniformemente** in `(freezeLap, giroFinale)`, senza ripetizioni, ordinati.
*Smaschera:* «conta solo che si fermino».

**C-POSIZIONE.** Gli stessi rivali si fermano lo stesso numero di volte, ai giri che la
regola produrrebbe **in un'altra gara**, riscalati proporzionalmente sulla lunghezza di
questa (`giro' = fl + (giro − fl_altra)·(span_qui / span_altra)`). L'altra gara è scelta da
uno **scorrimento ciclico** del calendario, diverso a ogni estrazione.
*Smaschera:* «conta solo che ci sia un giro plausibile, non quale».

C-POSIZIONE è **una barra più alta** di C-LIVELLO, ed è voluto: presta giri veri, non
rumore. Il riscalamento è dichiarato perché senza di esso una gara da 44 giri presterebbe a
una da 78 soste tutte nel primo terzo, e la controfigura perderebbe per un motivo
geometrico invece che informativo — che sarebbe truccare il placebo a proprio favore.

## 3 · La statistica, e su quale popolazione

**Statistica primaria: il saldo (vince − perde) alla bandiera contro il nullo, globale,
sui 193 casi.** È la grandezza in cui il divario di 16 punti è definito, ed è la grandezza
del posizionamento che il banco già stampa.

**Non** si usa il terzile alto come statistica primaria, e la ragione va scritta prima:
`REFERTO_famiglia_rivali_non_puo.md` ha stabilito che al terzile alto arrivano **2 punti su
16**, quindi un placebo misurato lì avrebbe potenza quasi nulla e passerebbe o fallirebbe
per rumore. I terzili si riportano come **secondari**, con gli strati congelati sulla
configurazione identità (che nessuna regola può muovere).

## 4 · Il cancello, con la soglia scritta adesso

**500 estrazioni** per ciascuna controfigura, semi dichiarati (`20260803` per C-LIVELLO,
`20260804` per C-POSIZIONE), generatore congruenziale riproducibile — nessun `Math.random`.

| | cancello | soglia |
|---|---|---|
| **P1** | l'oracolo batte C-LIVELLO | saldo vero **> 95° percentile** dei 500 saldi finti |
| **P2** | l'oracolo batte C-POSIZIONE | saldo vero **> 95° percentile** dei 500 saldi finti |
| P3 | quota del divario che resta dopo il placebo | *diagnostico*: (vero − mediana finti) / (vero − identità) |

Il 95° percentile è la stessa forma usata da T5 nel tetto al movimento: è un test a una
coda con α = 0,05, e la coerenza con il precedente di casa è deliberata.

**Perché 500 e non 200.** Una passata alla bandiera costa **0,6 s** misurati: 500
estrazioni per due controfigure sono circa dieci minuti. Il costo non è un vincolo, e un
percentile stimato su 500 punti è più stabile che su 200. Il numero è fissato **ora**, non
dopo aver visto quanto ballano i primi risultati.

### La regola di decisione, scritta prima

- **P1 e P2 passano** → esiste informazione strategica catturabile. Si dichiara la quota
  residua (P3) e **solo allora** si apre la prereg di una regola candidata, che dovrà
  battere le stesse due controfigure.
- **P1 o P2 falliscono** → il divario identità→oracolo è (in tutto o in parte)
  **aritmetica delle soste**, non reazione. La famiglia si chiude con quel numero, e
  **nessuna regola candidata viene costruita**: costruirla dopo aver saputo che il soffitto
  non regge sarebbe cercare un vincitore in una gara già dichiarata nulla.
- In entrambi i casi **F5 si registra come strumento esistente e applicato**, che è ciò che
  il KPI chiede: F5 non è una soglia da superare, è una condizione da imporre.

## 5 · Cosa questa prereg NON fa

- **Non prova nessuna regola candidata.** Nessuna esiste, e il mirror-play resta non speso.
- **Non tocca F2 né F3**, che `REFERTO_famiglia_rivali_non_puo.md` ha già dichiarato
  irraggiungibili da questa famiglia per ragioni strutturali, non sperimentali.
- **Non tocca il kernel né il costruttore.** Le controfigure vivono in
  `ai_lab/confronto/regole.mjs` e passano dalla stessa cucitura `pianiRivali` di tutte le
  altre — quindi sono soggette agli stessi scarti, il che è corretto: un placebo che non
  pagasse i filtri che la regola paga sarebbe più debole per un motivo che non c'entra col
  caso.
- **Non accende niente.** Qualunque esito, la produzione resta in configurazione identità.

## 6 · I due modi in cui questa misura potrebbe essere sbagliata, dichiarati prima

**(a) Le controfigure potrebbero farsi scartare più soste della regola.** Il costruttore
butta le soste con `giro ≤ freezeLap` e quelle con mescola non slick. Le controfigure
estraggono già dentro `(freezeLap, giroFinale)` e conservano le mescole, quindi non
dovrebbero perderne di più — ma **si misura e si riporta**: la sonda della cucitura stampa
soste proposte e soste arrivate al motore. Se le controfigure ne perdessero
sistematicamente di più, il confronto sarebbe truccato a favore della regola e l'esito
andrebbe letto come non valido.

**(b) L'oracolo non è un ottimizzatore.** Dà ai rivali le soste **vere**, non quelle che
massimizzano la metrica. Se non battesse le controfigure, la lettura corretta è «la
strategia vera degli altri non porta informazione utile a questa metrica», **non** «nessuna
regola potrebbe fare meglio del caso». La differenza è reale e va scritta nell'esito, non
lasciata al lettore.
