# Il motore contro il fondo — cambierebbero le risposte?

Branch `studio/motore`, base `main` = `bcd72e1`. **Nessuna modifica**: solo misure.
Generatori: `gen_backtest_motore.mjs`, `gen_motore_appaiato.mjs`, `gen_motore_identificazione.py`.

Il motore **non è stato toccato**: `simulate` accetta già `ZONE`, `STRENGTH`, `traffico` e
`degrado` come parametri, quindi ogni variante si ottiene **chiamandolo diversamente**.
`engine.py` resta `d2bee2dca871`, golden 449/449, sigillo INTEGRO.

---

## La risposta in tre strati

**1. I verdetti scientifici: NO, e si dimostra.** Il laboratorio **non importa mai** il motore —
verificato: in `ai_lab/scienziato/` compare solo dentro i commenti. Il NULL del traffico e quello
del degrado vivono interamente sulla ricostruzione dal fondo. **Nessun cambio al motore può
spostarli di un millimetro.**

**2. Le classifiche del prodotto: NO, misurato.** Ogni variante provata è indistinguibile dal
kernel o peggiore.

**3. I tempi assoluti: SÌ, tanto — e avevi ragione sul perché.** Il motore simula tutti
**−1,86 s/giro più veloci** del reale, e quel bias è tarato sull'era vecchia.

---

## Il banco di prova

Per ogni gara 2026, congelamento ogni 3 giri, orizzonti 5 e 10 giri: si simula in avanti e si
confronta il **tempo trascorso** previsto col reale. Il `cum_time` del demo è stato verificato
**bit-identico al `sesT` del fondo** (0,000000 di scarto su 5 067 confronti), quindi è un
backtest contro il fondo. Finestre solo **verdi**, senza soste.

L'errore si scompone in due, e la distinzione è tutto:

| | |
|---|---|
| **bias comune** | mediana fra i piloti — sposta tutti insieme, **non cambia le posizioni** |
| **errore relativo** | errore del pilota meno il bias — **l'unica parte che cambia una strategia** |

## Strato 2 — le classifiche: nessun cambio regge (confronto appaiato, 10 gare)

Confrontare IC95 marginali sovrapposti è l'errore classico: qui la differenza è **appaiata per
gara**.

| variante | Δ mediano (orizz. 10) | IC95 appaiato | esito |
|---|---|---|---|
| traffico **spento** | +0,096 | [0,019; 0,253] | **PEGGIORA** — il cap del kernel serve |
| traffico **del fondo** | +0,176 | [−0,011; 0,397] | indistinguibile (punto: peggio) |
| **degrado** del fondo | 0,000 | [−0,000; 0,048] | indistinguibile |
| carburante ri-aggiunto | 0,000 | [−0,000; 0,000] | indistinguibile *(atteso: è comune)* |
| **tutto il fondo insieme** | +0,182 | [0,023; 0,397] | **PEGGIORA** |

**Il cap grezzo del kernel batte il modello di traffico calibrato sul fondo.** Ed è coerente col
NULL che il laboratorio aveva già trovato per altra strada.

**Sweep dei due valori congelati** (`ZONE=1,5`, `STRENGTH=1,0`): il migliore della griglia
guadagna **0,005 s** a orizzonte 10 e **0,019 s** a orizzonte 5, con ottimi **incoerenti fra i
due orizzonti** (ZONE 2 vs ZONE 3). Superficie piatta: **ritarare non serve**.

Accuratezza reale del prodotto sulle distanze: **≈1,16 s a 5 giri, ≈2,18 s a 10 giri**.

## Strato 3 — il bias, e da dove viene

Bias osservato: **−9,318 s su 5 giri = −1,864 s/giro**. Due pezzi di fisica mancano:

1. **il carburante non viene ri-aggiunto**: `pace_base` sottrae il peso (passo a serbatoio
   vuoto) e `simulate` non lo ri-gonfia mai;
2. **la gomma è più vecchia della finestra in cui il passo è stato misurato**: `pace_base` è la
   mediana dello stint *fino a qui*, misurata su gomme **9,15 giri più giovani** di quelle che
   corrono i giri simulati.

Sommati: **−9,416 s** contro −9,318 osservati → **il 99 % del bias è spiegato**.

### Separarli davvero, invece di attribuirli a occhio

I due si sommano nello stesso numero, ma hanno **forme diverse** lungo la gara (il carburante
scende col giro-gara, l'età-gomma sale nello stint e si azzera a ogni sosta). Regressione su
395 casi, 10 gare, **con intercetta** (senza, la colonna dell'età assorbe il livello e gonfia
il rho — misurato):

| grandezza | stima | IC95 a blocchi |
|---|---|---|
| **carburante** (s su 70 kg) | **2,468** | **[1,693 – 2,908]** |
| **rho degrado** (s/giro per giro) | **0,032** | [−0,025 – 0,078] |
| intercetta | −0,342 | [−1,042 – 0,243] → **contiene zero** |

**Placebo** (età-gomma rimescolata fra i casi, 400 estrazioni): rho finto mediano **−0,0002**,
IC95 [−0,013; +0,013], **0 % raggiunge il vero**. Il coefficiente è **forma, non livello**.

### I numeri tornano — e nessuno di questi riferimenti è entrato nella stima

| riferimento indipendente | valore | dentro l'IC95 del motore? |
|---|---|---|
| carburante **kernel `engine.py`** | 3,000 | **FUORI** |
| carburante **fondo 2022-25** (era vecchia) | 3,151 | **FUORI** |
| carburante **fondo 2026** | **2,194** | **DENTRO** |
| rho fondo 2026 SOFT / MEDIUM / HARD | 0,054 / 0,044 / 0,040 | **tutti DENTRO** |

> **Avevi ragione.** Il motore è tarato sull'era pre-2026, e il comportamento del motore stesso
> sui dati 2026 lo dice: il valore che serve è quello del fondo 2026, non quello cablato.

**Onestà sui limiti**: 10 gare, IC larghi, e l'esclusione del 3,000 avviene per **0,09 s**. È un
indizio forte e convergente, non una sentenza.

---

## Perché non se n'era mai accorto nessuno

Perché il bias è **comune a tutti i piloti**: il carburante dipende dal giro-gara, uguale per
tutti, e l'età-gomma è simile nel gruppo. Nel solo uso che il prodotto fa del motore — «se mi
fermo adesso, **dove** rientro» — un errore comune **si cancella**. Il motore sbaglia di quasi
due secondi al giro e continua a instradare bene.

Conta invece: (a) ogni **tempo assoluto** mostrato a un utente è ottimista di ~1,9 s/giro;
(b) se un giorno il motore dovesse rispondere «questa strategia batte quella vera» — la domanda
del laboratorio — il bias **dominerebbe** la risposta.

---

## Proposte (nessuna applicata — decidi tu)

**P1 · Ri-gonfiare il carburante dentro `simulate`, per giro simulato.** Toglie **1,48 s/giro**
di bias. **Non tocca le classifiche** (misurato: Δ 0,000). Cambia il kernel → il golden si rifà
una volta.

**P2 · Con P1, portare `FUEL_COEFF` a un valore per regime** (2,19 per il 2026 invece di 3,0).
Nota: diventa un coefficiente **vivo**, quindi il suo posto naturale non è cablato nel kernel ma
nel pattern dei modelli-vivi, con targhetta e ricalibrazione a ogni gara.

**P3 · Il difetto più insidioso — le semantiche di `age0` nell'aggancio degrado.** Il gancio fa
`p + rate·s`, cioè assume che `pace` sia stato misurato **all'età attuale**. Non è vero: è la
mediana dello stint, **9,15 giri più giovane**. Chi accendesse il degrado oggi applicherebbe
`rate·s` invece di `rate·(9,15 + s)` — cioè **il 40 % della correzione al primo giro simulato, e
mai il termine costante**. È esattamente il pezzo «degrado» del bias (−0,403 s/giro): il conto
chiude. **Da sistemare prima che qualcuno accenda quel gancio.**

**P4 · NON sostituire il cap del traffico con la legge del fondo** — misurato peggio (Δ +0,18,
IC esclude zero in combinazione).

**P5 · NON ritarare `ZONE`/`STRENGTH`** — superficie piatta, ottimi incoerenti fra orizzonti.

---

## La frase

> Cambiare il motore **non cambierebbe una sola conclusione scientifica** di oggi: il laboratorio
> non lo tocca, e si dimostra. **Non cambierebbe nemmeno le classifiche** che il prodotto produce:
> ogni variante provata è indistinguibile o peggiore, e i due valori congelati sono già
> all'ottimo. **Cambierebbe i tempi assoluti**, che oggi sono ottimisti di 1,86 s/giro — e lì
> avevi ragione tu: il 99 % di quell'errore è carburante non ri-aggiunto più gomma più vecchia
> del passo misurato, e quando li separo il carburante che ne esce (2,47 [1,69–2,91]) **contiene
> il valore 2026 ed esclude quello cablato nel kernel**.
>
> La cosa che rifarei per prima non è nessuna delle due: è **P3**, perché è un difetto silenzioso
> che scatterebbe il giorno in cui qualcuno accende il degrado credendo di averlo acceso davvero.
