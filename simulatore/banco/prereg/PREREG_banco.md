# PREREG — il banco (metriche, secchi, cancelli)

**Scritta il 2026-07-29, PRIMA di eseguire una sola misura di questo banco.**
Regola 3: le metriche si scrivono prima di guardare i numeri. E08 in persona:
una metrica mal specificata si mette a referto e se ne pre-registra una nuova —
non si aggiusta dopo aver visto l'esito.

I numeri-soglia di questo documento vivono anche in
`banco/prereg/cancelli_banco.json`, che è la copia che gli script leggono: le
attese non stanno cablate nel codice dei test (E07). La sentinella `s15`
verifica che le due copie dicano la stessa cosa.

---

## Principio comune: si misura sul bersaglio del prodotto (E16)

Il vecchio repo ha tarato il cap del traffico su finestre **senza soste** —
dove il fenomeno che voleva descrivere non c'era — e sul bersaglio vero
peggiorava. Qui:

- l'accuratezza del rientro si misura **sulle soste vere**, non su finestre
  scelte perché comode;
- i risultati si dividono in **secchi** invece di essere mediati: una media
  sopra un secco dove il fenomeno è assente nasconde proprio il caso che conta.

Un'assenza non è una risposta: un secco con pochi casi si dichiara
**insufficiente** e non entra nei cancelli.

---

## Metrica 1 — accuratezza del rientro, per secchi

**Popolazione**: TUTTE le soste vere delle 11 gare 2026 (`in_lap` vero nel
grezzo pinnato), una misura per sosta.

**Procedura** per una sosta del pilota *d* al giro *L*:

1. congelamento a `Lf = L − 1` (l'ultimo giro prima dell'ingresso);
2. base di ogni pilota da `stimaBasi` sui soli giri ≤ Lf (regola 5);
3. si proietta con il kernel per 2 giri (l'in-lap *L* e l'out-lap *L+1*),
   dando a *d* la sosta al giro *L* con la perdita del circuito, e ai rivali
   **nessuna sosta**;
4. **posizione di rientro prevista** = rango del cum previsto di *d* al giro
   *L+1* fra i piloti confrontabili;
5. **posizione di rientro reale** = rango del cum reale di *d* al giro *L+1*
   fra gli stessi piloti;
6. `errore = prevista − reale` (positivo = il motore lo mette più indietro di
   com'è andata).

Ai rivali non si dice nulla delle loro soste **di proposito**: è la domanda del
prodotto ("se mi fermo ORA, dove esco?"), e il secco SOSTE_RIVALI serve
esattamente a misurare quanto costa quella ignoranza.

**Perdita ai box**: dal prior esterno `data/priors/pitloss_priors.json`
(targhetta: prior esterno, 2.106 stop 2022-26), per circuito; dove il circuito
non è misurato si usa il `_fallback` (mediana d'era 22,1 s) e la gara viene
**marcata come fallback** nel report. Sotto neutralizzazione la perdita è
moltiplicata per il fattore dichiarato (SC 0,50 · VSC 0,65), che è un prior con
banda (SC 0,40-0,60 · VSC 0,60-0,70), non un numero misurato qui.

**Secchi** (mutuamente esclusivi, valutati in quest'ordine):

| secco | definizione |
|---|---|
| **NEUTRA** | il giro *L* o il giro *L+1* di *d* è in regime neutralizzato (`status` contiene 4 o 6) |
| **SOSTE_RIVALI** | non NEUTRA, e almeno un altro pilota confrontabile ha `in_lap` vero ai giri *L−1*, *L* o *L+1* |
| **PULITA** | né l'uno né l'altro |

**Ammissione**: *d* ha ≥ 8 giri con passo utilizzabile ≤ Lf, una cella a Lf con
`cum_time` e `tyre_age` non nulli, e celle a *L* e *L+1* con `cum_time` non
nullo. I piloti confrontabili sono quelli con `cum_time` non nullo sia a Lf sia
a *L+1*. Servono ≥ 5 piloti confrontabili, altrimenti la sosta è scartata (e
contata fra gli scarti, con il motivo).

**Grandezze riportate per secco**: n, mediana di |errore|, media dell'errore
con segno, quota entro ±1 e entro ±2 posizioni.

**Cancello**: questa esecuzione **stabilisce la linea di base** — è la prima
volta che questa misura esiste, e inventare adesso una soglia assoluta
sarebbe un numero senza fondamento. Da qui in poi il cancello è la
**non-regressione** rispetto alla linea registrata:

- la mediana di |errore| di un secco non peggiora di più di **0,25 posizioni**;
- la quota entro ±1 non cala di più di **5 punti percentuali**.

Un secco con **meno di 10 casi** è dichiarato insufficiente e non fa cancello.

**Attesa di sanità falsificabile** (dichiarata ora, non è un cancello):
`mediana|errore| PULITA ≤ mediana|errore| SOSTE_RIVALI`. Se uscisse il
contrario, il modello sbaglierebbe di più dove il disturbo è assente, e sarebbe
un segnale che l'errore non viene da dove crediamo.

---

## Metrica 2 — G0′ (la scritta giusta)

**Perché esiste il primo**. G0 contava come **fallimento** la risposta corretta
al bordo: quando l'ottimo cade prima del primo giro in cui ci si può fermare,
"fermati subito" È la risposta giusta, e la vecchia metrica la puniva (E08).
G0 resta a referto come metrica ritirata; questa è la nuova pre-registrazione,
non una correzione retroattiva della vecchia.

**Popolazione**: stati reali delle gare 2026 — per ogni gara, congelamenti
`Lf ∈ {10, 20, 30, 40}`, ogni pilota ammesso (base stimabile su ≥ 8 giri, cella
a Lf con `cum_time` e `tyre_age` non nulli), con `R = N_giri − Lf ≥ 4` giri
rimanenti.

**Procedura**: si sweepa il giro di sosta `k = 1 … R−1` col kernel vero (una
sola sosta, perdita del circuito) e si prende `argmin` del cum finale =
**minimo del banco**. L'**ottimo analitico** è `k* = (R − età)/2`.

**Un caso PASSA se**:

- `argmin` è **interno** (`1 < argmin < R−1`) **e** coincide con l'ottimo
  analitico — con la regola dei pari merito: se `R − età` è **dispari**, `k*` è
  a metà fra due interi e **entrambi** sono corretti;

  **oppure**

- `argmin` è **al bordo** e l'ottimo analitico è **≤ 3 giri** dal bordo
  corrispondente (dal primo giro utile `k = 1`, o dall'ultimo `k = R−1`). Al
  bordo la risposta corretta non è un fallimento: se `k* ≤ 1 + 3`, "fermati al
  primo giro utile" è la risposta giusta e va contata come tale.

**Esclusioni dichiarate**: un pilota senza base esce con null e **non entra**
nel conteggio (regola 6) — viene contato fra gli esclusi, con il motivo.

**Cancello**: **100% dei casi ammessi passa.** Non è una soglia statistica: è
una proprietà di correttezza dell'implementazione contro la forma chiusa. Se
non è 100%, si riporta il numero vero e i casi che falliscono, uno per uno.

---

## Metrica 3 — bias sui tempi assoluti, per orizzonte

Stessa misura del banco di δ (`banco/misure/bias.mjs`, l'unica
implementazione), sulle stesse regole di campione della
`PREREG_delta.md`: finestre tutte verdi, congelamenti {20, 30}, orizzonti
{5, 10, 20}, `bias(H)` = mediana fra le gare del bias medio di gara, in s/giro.

**Cancelli** (ereditati, non inventati qui — è l'asticella del vecchio v2):

- `|bias(H)| ≤ 0,17` s/giro a ogni orizzonte **giudicabile** (≥ 5 gare);
- **piattezza**: `max|bias| − min|bias| ≤ 0,10` s/giro fra gli orizzonti
  giudicabili.

Gli orizzonti non giudicabili si riportano col loro numero e la marcatura
"NON validato": si dichiarano, non si nascondono e non si usano.

---

## Sentinella di troncamento (regola 5, E15)

Non è una metrica: è una condizione di validità di **tutte** le metriche qui
sopra. Ogni misura che dichiara di essere "al congelamento Lf" deve dare lo
stesso risultato su byLap intero e su byLap troncato a Lf. È la definizione
operativa di "non sbircia il futuro", e nel vecchio repo questa classe di test
ha beccato una fuga reale: la misura del gradino a congelamento leggeva fino a
6 giri dopo Lf (E15).

Le misure a congelamento del repo stanno in un registro esplicito
(`banco/misure_congelamento.mjs`). La sentinella le esegue tutte su dati interi
e troncati e pretende **identità**. Il registro non è decorativo: `s14` rifiuta
la suite se in `engine/` o `scenario/` esiste una funzione esportata con un
parametro di congelamento (`freezeLap`, `finoA`) che **non** è nel registro.

Il lato "verità" delle metriche legge il futuro per costruzione (è il reale con
cui ci si confronta): la regola vincola il lato **previsione**.

---

## Corsa notturna

`banco/notte.mjs` rilancia suite + tutte le misure, scrive
`banco/REPORT_NOTTE.md` con il confronto rispetto alla notte precedente
(`banco/storico_notti.json`) ed **esce 1 su regressione**.

**Regressione** è, esattamente:

1. una sentinella della suite che fallisce; oppure
2. un cancello pre-registrato che era passato e ora non passa; oppure
3. una metrica che peggiora oltre la tolleranza di non-regressione dichiarata
   qui sopra (rientro), o oltre `0,02` s/giro sul bias.

Il primo giro senza storico **non è una regressione**: registra la linea di
base e lo dichiara nel report.
