# ESITO — F5 bis: contano i giri plausibili, non i giri veri

**Data: 03/08/2026.** Esegue `PREREG_F5_bis.md`, sigillata prima dei numeri (commit
`19f464d`). Dati: `ESITO_controfigure_f5_bis.json`. Nessuna soglia toccata.

---

## Il verdetto

**B0 (validità) PASSA**: i tre bracci fanno arrivare al motore **3639** soste esatte —
oracolo, C-LIVELLO, C-POSIZIONE. L'handicap dell'1,8 % non c'è più.

| | cancello | vero | finti: mediana · **p95** | esito |
|---|---|---|---|---|
| **B1** | l'oracolo batte **C-LIVELLO** (giri a caso) | **+2** | −5 · **+1** | **PASSA** |
| **B2** | l'oracolo batte **C-POSIZIONE** (giri veri di un'altra gara) | **+2** | −1 · **+6** | **NON PASSA** |
| B3 | quota del divario che sopravvive *(diagnostico)* | | livello **44 %** · posizione **19 %** | |

Per la regola di decisione scritta nella prereg §3 — *«B0 passa, B1 passa e B2 no → esito
misto: si riporta e non si apre nessuna prereg»*:

> **La famiglia resta chiusa. La cascata dell'undercut non si costruisce.** Tentativo
> **non speso**.

## Togliere l'handicap ha spostato ENTRAMBI i cancelli, e non la conclusione

| | prima (con l'1,8 % regalato al caso) | corretta (B0 passa) |
|---|---|---|
| C-LIVELLO | mediana −7 · p95 **+3** → **P1 fallisce** | mediana −5 · p95 **+1** → **B1 passa** |
| C-POSIZIONE | mediana −12 · p95 **−5** → **P2 passa** | mediana −1 · p95 **+6** → **B2 fallisce** |

**I due verdetti si sono scambiati.** Il primo esito aveva ragione a dubitare di sé:
il fallimento di P1 **era** un artefatto, come il referto sospettava — e lo era anche il
passaggio di P2, nell'altro verso. Rifare la misura era necessario, e la ragione per cui
si è rifatta è scritta in una pagina datata prima di conoscerne l'esito.

**Ciò che non si è mosso è la conclusione.** Era vero prima e resta vero adesso: la
famiglia non supera la condizione che F5 impone.

## Cosa dice il numero, con precisione

I due placebo chiedono due cose diverse, ed è per questo che ce ne sono due:

- **C-LIVELLO** mette i rivali a giri estratti a caso. L'oracolo lo batte: **sapere che ci
  si ferma «da qualche parte in mezzo alla gara» vale qualcosa** rispetto al puro rumore.
- **C-POSIZIONE** presta ai rivali i giri di sosta **veri di un'altra gara**. L'oracolo
  **non** lo batte.

> **Contano i giri plausibili, non i giri veri.** Sapere che in F1 ci si ferma «verso lì»
> basta; sapere che *quel* pilota si è fermato *a quel* giro, in *quella* gara, non
> aggiunge niente di misurabile.

Il diagnostico lo quantifica: dei **16 punti** di divario identità→oracolo, ne
sopravvivono **19 %** — cioè **3 punti** — quando il confronto è con giri veri presi
altrove. Gli altri tredici sono il fatto che i rivali si fermino, in un momento plausibile.

E la decomposizione per terzile è ancora più netta: **C-POSIZIONE riproduce l'oracolo
esattamente in due terzili su tre.**

| terzile (strati congelati su identità) | identità | **oracolo** | C-POSIZIONE (mediana) | C-LIVELLO (mediana) |
|---|---|---|---|---|
| ne inventa **meno** del vero | −4 | **+4** | **+4** *(identico)* | +5 *(meglio)* |
| circa il giusto | +8 | **+14** | +11 | +9 |
| ne inventa **più** del vero | −18 | **−16** | **−16** *(identico)* | −19 |

L'unico posto dove conoscere le soste vere aggiunge qualcosa è il terzile centrale, e vale
3 punti su 16.

## Una precisione che non va persa: quale barra è caduta

`KPI_5_4_4.md` §F5, alla lettera, chiede **una sola** controfigura: *«una regola finta che
fermi gli stessi rivali lo stesso numero di volte, ma a giri scelti a caso»*. Quella è
C-LIVELLO, ed è **B1: l'oracolo la batte.**

> **F5 come è firmato è soddisfatto.** A cadere è **C-POSIZIONE**, che è una barra più alta
> imposta da questa prereg a se stessa, seguendo la prescrizione già scritta in
> `REFERTO_mirrorplay_degenere.md`: *i gradi di libertà da spegnere sono due, non uno*.

Va detto così e non altrimenti, perché la differenza è reale: si sta chiudendo la famiglia
con un criterio **più severo** di quello firmato, e chi legge deve poterlo sapere. La
prereg imponeva entrambe le controfigure prima di vedere i numeri, e si onora — allentare
adesso a «una su due basta» sarebbe E08 nella sua forma più comoda.

## Cosa questo esito NON dice — §6(b), scritto prima

**L'oracolo non è un ottimizzatore**: dà ai rivali le soste **vere**, non quelle che
massimizzano questa metrica. La lettura corretta resta *«la strategia vera degli altri non
porta informazione utile a questa metrica»*, non *«nessuna regola batterebbe il caso»*.

Ma ora si può dire qualcosa di più stretto, e va detto perché rende la chiusura solida:
una regola candidata **produrrebbe giri plausibili**, non giri veri — e i giri plausibili
sono esattamente ciò che C-POSIZIONE già mette in campo, arrivando **al livello
dell'oracolo in due terzili su tre**. La candidata migliore immaginabile giocherebbe contro
un avversario che pareggia il proprio soffitto.

## Cosa resta

- **F5 è registrato come strumento esistente e applicato**, che è ciò che il KPI chiede.
  Vive in `regole.mjs` (le due controfigure) e `controfigure_f5.mjs` (i cancelli, B0
  compreso), ed è riusabile da qualunque regola futura.
- **B0 ha lavorato prima di produrre un numero**, ed è la parte di questa sessione che
  varrà più a lungo: ha trovato due modi diversi in cui la controfigura di posizione si
  indeboliva da sola — collisioni di giro dopo il riscalamento, e prestatori con meno
  soste di quante ne servissero. Senza B0 sarebbe stata una barra più bassa del dovuto, e
  nessuno lo avrebbe visto.
- **La produzione non cambia**: configurazione identità, rivali fermi.
- **La cascata dell'undercut resta non spesa.** Se un giorno la famiglia si riaprisse, si
  riapre da lì — e dovrà battere C-POSIZIONE, che oggi pareggia il soffitto.
