# Il motore — LIMITI NOTI

Misurati contro il fondo il 21/07/2026 su tutte e dieci le gare 2026.
Generatori: `gen_backtest_motore.mjs`, `gen_motore_appaiato.mjs`, `gen_motore_identificazione.py`.
Rapporto completo: `REPORT_MOTORE_2026.md`.

> **Perché questo file esiste invece di un commento dentro `engine.py`.** Il content-hash di
> `engine/engine.py` (`d2bee2dca871`) è il tripwire che il progetto usa per accorgersi se il
> kernel si muove. Aggiungerci un commento lo cambierebbe, bruciando la sentinella per sempre.
> I limiti stanno qui accanto; il kernel resta bit-identico.

---

## 1. IL LIMITE PRINCIPALE — i tempi assoluti sono ottimisti di ~1,9 s al giro

Il motore simula ogni pilota **−1,86 s/giro più veloce** di come va davvero
(−9,318 s su una finestra di 5 giri).

**Non usare i tempi assoluti del motore come previsione di un tempo sul giro o di un tempo di
gara.** Sono sistematicamente troppo bassi.

### Da che cosa è fatto (99 % spiegato, due pezzi)

| pezzo | quanto | perché |
|---|---|---|
| **carburante mai ri-aggiunto** | −1,480 s/giro | `pace_base` sottrae il peso → il passo è a **serbatoio vuoto**; `simulate` non lo ri-gonfia mai |
| **gomma più vecchia del passo misurato** | −0,403 s/giro | `pace_base` è la **mediana dello stint fino a qui**: misurata su gomme **9,15 giri più giovani** di quelle che corrono i giri simulati |
| somma | **−9,416 s** su 5 giri | contro **−9,318** osservati → **99 %** |

## 2. Il carburante del kernel è tarato sull'era PRE-2026

`FUEL_COEFF = 3.0/70.0` → **3,000 s** su 70 kg.

Separando i due pezzi del bias (hanno forme diverse lungo la gara: il carburante scende col
giro-gara, l'età-gomma sale nello stint e si azzera a ogni sosta), su 395 casi e 10 gare, con
intercetta e placebo:

| grandezza implicata dal comportamento del motore | stima | IC95 (blocchi = gare) |
|---|---|---|
| carburante totale (s su 70 kg) | **2,468** | **[1,693 – 2,908]** |
| rho degrado (s/giro per giro) | 0,032 | [−0,025 – 0,078] |
| intercetta | −0,342 | [−1,042 – 0,243] → contiene zero |

Confronto con riferimenti **indipendenti**, nessuno dei quali è entrato nella stima:

| | valore | dentro l'IC95? |
|---|---|---|
| **kernel `engine.py`** | 3,000 | **FUORI** |
| fondo **2022-25** (era vecchia) | 3,151 | **FUORI** |
| fondo **2026** | **2,194** | **DENTRO** |
| rho fondo 2026 SOFT/MEDIUM/HARD | 0,054 / 0,044 / 0,040 | **tutti DENTRO** |

**Onestà sui limiti**: 10 gare, intervalli larghi, e il 3,000 è escluso per **0,09 s**. È un
indizio forte e convergente, **non una sentenza**.

## 3. Perché il prodotto funziona lo stesso — e dove invece NON funziona

Il bias è **comune a tutti i piloti** (il carburante dipende dal giro-gara, uguale per tutti;
l'età-gomma è simile nel gruppo). Nell'unico uso che il prodotto fa del motore — *«se mi fermo
adesso, **dove** rientro»* — un errore comune **si cancella**.

| uso | affidabile? |
|---|---|
| **posizione di rientro, distacchi, ordine** | **SÌ** — è ciò per cui il motore è usato |
| tempo sul giro assoluto mostrato a un utente | **NO** — ottimista di ~1,9 s/giro |
| tempo di gara / tempo totale previsto | **NO** — l'errore si accumula |
| «questa strategia batte quella vera?» | **NO** — il bias dominerebbe la risposta |

**Accuratezza reale sulle distanze** (la parte che conta), misurata su finestre verdi senza
soste: **≈1,16 s a 5 giri**, **≈2,18 s a 10 giri**.

## 4. Il traffico: il cap grezzo NON è battuto

Confronto **appaiato per gara**, orizzonte 10 giri (Δ > 0 = peggio del kernel):

| variante | Δ mediano | IC95 appaiato | esito |
|---|---|---|---|
| traffico **spento** | +0,096 | [0,019; 0,253] | **peggiora** → il cap serve |
| traffico **calibrato sul fondo** | +0,176 | [−0,011; 0,397] | indistinguibile (punto: peggio) |
| tutto il fondo insieme | +0,182 | [0,023; 0,397] | **peggiora** |

**`ZONE = 1.5` e `STRENGTH = 1.0` sono già all'ottimo pratico**: lo sweep guadagna 0,005 s a
orizzonte 10 e 0,019 s a orizzonte 5, con ottimi **incoerenti fra i due orizzonti**. Superficie
piatta: **ritararli non serve**.

## 5. Il degrado: il motore non ne ha

`AdvanceModel` incrementa `tyre_age` ma **non lo usa mai**: il motore assume **degrado zero**.
Aggiungere il degrado misurato dal fondo **non migliora le distanze** (Δ appaiato 0,000): le tre
pendenze 2026 sono troppo vicine fra loro per separare i piloti.

Il gancio opzionale `degrado` esiste in `demo/engine.mjs` ed è **spento**. Dal 21/07/2026 legge
davvero l'età di riferimento (`{ rate, eta, eta0 }`); **prima era una trappola** — prometteva
`rate*(eta−eta0)` e faceva `rate*s`.

## 6. Che cosa NON è stato fatto, e perché è scritto qui

**P1 (ri-gonfiare il carburante dentro `simulate`) e P2 (`FUEL_COEFF` per regime) NON sono
implementati.** Toglierebbero ~1,48 s/giro di bias e non toccherebbero le classifiche
(misurato: Δ appaiato 0,000), ma cambiano il kernel e vanno decisi al tavolo.

Finché non lo sono, **questo documento è la garanzia che nessuno usi i tempi assoluti credendoli
giusti.**

Nota per quando si farà P2: un `FUEL_COEFF` per regime è un **coefficiente vivo**, non una
costante. Il suo posto naturale non è cablato nel kernel ma nel pattern dei modelli-vivi, con
targhetta e ricalibrazione a ogni gara — come già fanno traffico e degrado.

## 7. Che cosa questi limiti NON toccano

I verdetti del laboratorio. `ai_lab/scienziato/` **non importa mai** il motore (verificato: vi
compare solo nei commenti): il NULL del traffico e quello del degrado vivono interamente sulla
ricostruzione dal fondo. **Nessun cambio al motore può spostarli.**
