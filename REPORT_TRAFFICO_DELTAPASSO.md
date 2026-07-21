# REPORT — il traffico, primo ingresso: il DELTA-PASSO

Secondo giro dell'**agente autonomo a compito**. Branch
`ai-lab/autonomo-traffico-deltapasso` · 21/07/2026 · prereg scritto prima di misurare:
[`ai_lab/scienziato/PREREG_traffico_deltapasso.md`](ai_lab/scienziato/PREREG_traffico_deltapasso.md)
Generatore: `run_traffico.py` → `esito_traffico.json`

---

## (6) La frase onesta, per prima

> **Il delta-passo è la variabile giusta — ma non nel canale in cui stanotte mi era chiesto
> di montarlo.** Come termine *per giro* sopra il solo-gap non regge: peggiora fuori
> campione ed è per metà un artefatto, come il placebo ha dimostrato. Come governatore
> della **durata** dell'incontro il fondo lo conferma in modo netto e senza bisogno di
> nessun modello: chi ha un grande vantaggio di passo passa in **1 giro mediano**.
>
> Quindi: **niente candidato live stanotte.** E no, non serve la difficoltà-pista prima di
> poter dire qualcosa: serve il canale-durata, che è il mattone del prossimo giro.

---

## (1) Come ho costruito il delta-passo dinamico

**Accoppiamento chi-dietro-chi** (dal fondo): al giro L, fra le auto che hanno completato
L, ordino per `sesT`; l'auto davanti è la precedente. Fra chi ha fatto lo stesso numero di
giri, quell'ordine **è** l'ordine in pista. *Limite dichiarato*: i doppiati stanno su un
altro indice di giro e non entrano.

**Delta-passo**: `Δ(d,L) = passo_pulito(d,L) − passo_pulito(davanti,L)`, con ciascuna auto
alla **sua** mescola e alla **sua** età-gomma di quel giro. Negativo = chi segue è più
veloce.

Due proprietà che vengono gratis dalla costruzione, e che il progetto aveva già pagato per
imparare:
- **è dinamico**: l'età-gomma è dentro, quindi due auto pari a inizio stint hanno Δ grande a
  fine stint se una ha la gomma finita;
- **è pulito per costruzione**: essendo una differenza **allo stesso giro**, i termini di
  carburante ed evoluzione pista **si elidono esattamente**. Resta passo-pilota + mescola +
  degrado. Non ho dovuto fidarmi della correzione carburante: si cancella.

**Targhetta: 46 gare sotto, regime a effetto suolo, calcolato il 2026-07-21.**
22 105 incontri (giro verde, non in/out, con qualcuno entro 5 s).

---

## (4) La decisione SC/VSC — misurata, non assunta

**Passo 1, la finestra di recupero**, derivata dai dati con la regola scritta nel prereg
(«K = la prima fascia il cui IC95 contiene lo zero»):

| giri dopo la ripartenza | n | residuo mediano | IC95 | |
|---|---|---|---|---|
| 1 | 319 | **+1,055** | [+0,841 · +1,320] | contaminato |
| 2 | 345 | +0,388 | [+0,235 · +0,532] | contaminato |
| 3 | 318 | +0,150 | [+0,078 · +0,272] | contaminato |
| **4** | 312 | +0,016 | **[−0,047 · +0,111]** | **contiene zero** |
| 5 | 293 | +0,034 | [−0,068 · +0,128] | contiene zero |

⇒ **K = 3**: i primi tre giri dopo ogni ripartenza escono. *(Nota di processo: il codice
aveva K cablato a 1 e l'ho corretto per applicare la regola dichiarata, non il valore
comodo.)*

**Passo 2, il test dichiarato**: la penalità è la stessa in gara normale e post-restart? Non
l'ho assunto — ho stimato `c` (il coefficiente del delta-passo) **per gara**, separatamente
nei due insiemi, e confrontato sui blocchi:

| insieme | c mediano per gara | IC95 | gare |
|---|---|---|---|
| gara normale | **+0,229** | [+0,203 · +0,280] | 28 |
| post-restart | **+0,362** | [+0,228 · +0,425] | 21 |

**Gli IC95 si sovrappongono** ⇒ i giri post-restart sono traffico **vero** e li tengo.

**Il guadagno: da 18 gare a 46**, da 9 899 a 22 105 incontri. Il muro dei dati è caduto —
non buttando l'intera gara ma i soli giri neutralizzati più la finestra derivata.

**Caveat che devo dire**: la sovrapposizione è **marginale** (0,280 contro 0,228). Il punto
di forza è che il post-restart popola proprio le celle rare — auto veloce dietro auto lenta
— che in gara normale non esistono perché il sorpasso avviene subito. Se un giorno i due
insiemi si separassero con più gare, questa scelta va rifatta: **targhetta 46 gare,
21/07/2026.**

---

## (2) Il test dell'esempio-guida — **confermato dal fondo**

Quanti giri consecutivi un pilota resta entro 1,5 s **dallo stesso** leader, per fascia di
delta-passo. Nessun modello: solo cronometria.

| delta-passo | n incontri | giri mediani | IC95 | giri medi |
|---|---|---|---|---|
| **< −0,80** (molto più veloce) | 918 | **1,00** | [1,00 · 1,00] | **2,31** |
| −0,80 · −0,40 | 416 | 2,00 | [2,00 · 2,00] | 3,44 |
| **−0,40 · −0,15** (poco più veloce) | 283 | 2,00 | [2,00 · 3,00] | **3,91** |
| −0,15 · +0,15 (pari) | 433 | 2,00 | [2,00 · 2,00] | 3,34 |
| > +0,15 (più lento) | 1 244 | 1,00 | [1,00 · 1,00] | 2,59 |

**L'esempio-guida è confermato**: chi ha più di 0,8 s di vantaggio di passo resta dietro
**un giro mediano** — passa e se ne va. Ed emerge una **U rovesciata** che nessuno mi aveva
descritto e che è la fisica esatta dell'essere intrappolati: gli incontri più lunghi (3,91
giri medi) non sono quelli fra auto pari, ma quelli in cui chi segue è **appena** più veloce
— abbastanza per stare attaccato, non abbastanza per passare. Chi è più lento sparisce
subito (2,59), chi è molto più veloce pure (2,31).

Il modello a solo-gap non può produrre niente di tutto questo: per lui questi cinque casi
sono identici.

---

## (3) Le forme proposte — **entrambe rumore**

`r = tempo osservato − passo pulito`, sui giri con gap < 5 s. Fit su 23 gare di
calibrazione, misura su 23 di verifica (mai le stesse).

| | forma | parametri | errore ass. mediano per gara (verifica) | IC95 |
|---|---|---|---|---|
| **M0** | `a·e^(−gap/λ)` | a=0,99 λ=1,0 | **0,3883 s** | [0,3544 · 0,4224] |
| M1 | `a·e^(−gap/λ) + c·max(0,−Δ)` | a=0,51 λ=0,8 **c=0,540** | 0,4158 s | [0,3462 · 0,4337] |
| M2 | `max(a·e^(−gap/λ), c·max(0,−Δ))` | a=0,70 λ=0,5 c=0,75 | 0,4167 s | [0,3583 · 0,4306] |

**Barra dichiarata prima**: M = semi-ampiezza IC95 di M0 = **0,0340 s**, e l'IC95 del
miglioramento appaiato deve escludere lo zero.

- **M1**: miglioramento **−0,0275 s** (cioè peggiora) → non supera M; appaiato +0,0032,
  IC95 [−0,0109 · +0,0115] **contiene lo zero** ⇒ **RUMORE**.
- **M2**: miglioramento **−0,0284 s** → non supera M; appaiato −0,0107, IC95
  [−0,0256 · −0,0010] esclude lo zero **dal lato sbagliato**: è un peggioramento
  confermato ⇒ **RUMORE**.

Due forme dichiarate, due bocciate. Nessuna terza forma tentata: la regola anti-pesca era
«al massimo due», e l'ho rispettata.

### Il placebo — e perché è la cosa più importante della notte

Avevo dichiarato il confondimento **prima** di misurare: `r` contiene `−passo(d)` e `Δ`
contiene `+passo(d)`, quindi un errore di stima del passo di chi segue crea correlazione
negativa spuria — **esattamente il segno che cercavo**.

Placebo: stesso pilota, **leader sostituito con un'auto a caso dello stesso giro**.

```
c stimato col leader VERO   : +0,540
c stimato col leader A CASO : +0,233     <- il 43% del coefficiente e' artefatto
miglioramento M1 su M0, vero    : -0,0275 s
miglioramento M1 su M0, placebo : -0,0392 s
```

**Il placebo riproduce buona parte dell'effetto.** Quasi metà del coefficiente del
delta-passo non è fisica del traffico: è l'errore di stima del passo di chi segue che si
riflette in entrambe le variabili. Senza questo test avrei potuto raccontare un `c = 0,54`
"fisicamente sensato" e sbagliato per metà.

> ⚠️ **AVVISO AL TAVOLO — null nuovo, da sigillare.** `traffico.placebo_leader` è una
> funzione di ricampionamento **nuova**. Non ho modificato nessuna delle sei funzioni
> sigillate (per la barra ho chiamato `scheletro.bootstrap_a_blocchi` invariata), e **non
> ho sigillato la nuova da solo**: il sigillo richiede `--attore`. È esattamente il genere
> di codice che la regola vuole far guardare a un umano. Comando pronto:
> `python3 ai_lab/scienziato/sigillo_null.py --sigilla --attore "Tommi" --nota "..."`
> dopo aver aggiunto `traffico.placebo_leader` a `ZONE`.

---

## (5) I NULL motivati, internet, e il limite onesto

### I NULL

| cosa | esito | perché |
|---|---|---|
| **M1 additiva** (`aero + c·vantaggio`) | RUMORE | peggiora fuori campione, appaiato contiene lo zero |
| **M2 il massimo** (fisica «vai al ritmo di chi ti precede») | RUMORE | peggioramento **confermato** (IC95 esclude lo zero dal lato sbagliato) |
| il coefficiente `c` come misura fisica | **per il 43% artefatto** | il placebo col leader a caso lo riproduce quasi a metà |

Il motivo di fondo, che è il risultato della notte: **il delta-passo non agisce sul quanto
perdi per giro, agisce su quanti giri resti lì.** La metrica per-giro che mi ero dato è
dominata dalla massa degli incontri a Δ piccolo, dove il delta-passo non ha niente da dire.

### Internet

Cercato prima di costruire. La letteratura di settore quantifica il *wake*: una monoposto
che segue a 1 s perde ~35 % di carico, a 0,5 s fino al 47 %
([the-race.com](https://www.the-race.com/formula-1/exclusive-new-data-f1-aero-losses-ruining-close-racing/),
[f1chronicle.com](https://f1chronicle.com/what-is-dirty-air-in-f1/)), e la differenza fra
una gara con 80 sorpassi e una con 20 sta in **meno di 0,7 s** di perdita in aria sporca
([themotorsportmetrics.com](https://themotorsportmetrics.com/f1-overtaking-statistics/)).

Come l'ho trattata: **solo come conferma di ordine di grandezza, mai come numero**. Il
nostro `a` misurato dal fondo vale **0,99 s** a gap zero con λ = 1,0 s — cioè ~0,6 s a 0,5 s
di gap: **lo stesso ordine di grandezza della letteratura, ricostruito indipendentemente**.
Il suggerimento che ho preso e verificato è l'idea che *«il vantaggio di passo esiste ma
viene consumato dal wake prima della fase di sorpasso»*
([thef1db.com](https://thef1db.com/blog/f1-dirty-air-clean-air-explained)) — ed è coerente
con quello che ho trovato: il vantaggio di passo **non** riduce la perdita per giro; si
scarica sulla durata.

Nessun numero adottato da nessuna fonte.

### Il limite onesto

**Il traffico si calcola solo contro il campo reale, non contro un campo che reagisce.** Nel
controfattuale «Leclerc rientra al 18» il resto del gruppo resta congelato alla realtà: le
altre auto non rallentano perché Leclerc è lì, non si difendono, non cambiano strategia. È
la natura dichiarata del muretto — routing di **una** macchina sola. Il modello dice
*«Leclerc diverso dentro la gara che È successa»*, non *«la gara che SAREBBE successa»*.
Ogni numero di traffico va letto dentro questo confine.

---

## Un ingresso solo — rispettato

Difficoltà-di-sorpasso della pista e durata dell'incontro **non sono state montate**, anche
quando la durata è diventata la spiegazione più ovvia del fallimento di M1/M2. Se avessi
aggiunto la durata, il traffico sarebbe migliorato e non avrei saputo di chi era il merito.
**Il canale-durata è il fronte dichiarato per il giro dopo**, con la sua tabella già misurata
qui sopra (la U rovesciata) come punto di partenza.

## Stato del kernel

Non toccato in questa sessione. `test_b` 449/449 · `test_pit` 11/11 ·
`test_degrado_aggancio` 3/3 · sigillo del null **INTEGRO** · sorveglianza 3/3.

Nessun push, nessuna PR, nessun merge.
