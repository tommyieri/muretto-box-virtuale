# Prereg — F5 bis: la stessa domanda, senza l'1,8 % di vantaggio regalato al caso

**Data: 03/08/2026.** Scritta **dopo** aver visto l'esito di `PREREG_F5_controfigure.md` e
**prima** di eseguire una sola estrazione della versione corretta. È il rimedio previsto
dalla regola 3: *un cancello sbagliato si mette a referto e se ne pre-registra uno nuovo,
non si riscrive*.

---

## 1 · Che cosa era sbagliato, e perché serve rifarla

`ESITO_controfigure_f5.md` registra **P1 NON PASSA per un punto** (oracolo +2, 95°
percentile dei finti +3) e registra anche il difetto che lo rende contestabile:

- le controfigure fanno arrivare al motore **3705** soste, l'oracolo **3639** — **66 in
  più, l'1,8 %**;
- la causa è strutturale: l'oracolo ha rivali fermi **prima** del congelamento, e quelle
  soste il costruttore le scarta; le controfigure ridistribuiscono **tutte** le soste
  dentro `(freezeLap, giroFinale)` e non ne perdono nessuna;
- la clausola di validità che avevo scritto era **a senso unico**: prevedeva solo il verso
  che avrebbe favorito la regola.

Il cancello è fallito per un punto mentre il caso giocava con l'1,8 % di soste in più. **Non
si può escludere che il fallimento sia un artefatto**, e un NULL che chiude una famiglia
intera non può poggiare su un dubbio del genere.

## 2 · L'unica cosa che cambia

> **La «forma» che la controfigura conserva si conta sulle soste che ARRIVANO al motore,
> non su quelle proposte.**

Cioè: per ogni rivale si conservano le soste con `giro > freezeLap` — le sole che il
costruttore accetta — e si ridistribuiscono solo quelle. Un rivale fermatosi al giro 3 e al
giro 30, con congelamento 5, dà **una** sosta alla controfigura, non due.

È la lettura letterale di F5 («fermi gli **stessi** rivali lo **stesso** numero di volte»)
applicata a ciò che il motore riceve invece che a ciò che la regola dichiara. Con questa
definizione, per costruzione, **proposte e arrivate coincidono nei due bracci**.

**Non cambia nient'altro:** stessa statistica (saldo alla bandiera contro il nullo, 193
casi), stesse due controfigure, **stesse 500 estrazioni**, **stessi semi** (20260803 e
20260804), **stessa soglia** — il 95° percentile. In particolare la soglia **non si tocca**:
se si toccasse, questa pagina sarebbe E08 travestito da correzione.

## 3 · I cancelli

| | cancello | soglia |
|---|---|---|
| **B1** | l'oracolo batte C-LIVELLO corretta | saldo vero **> 95° percentile** dei 500 finti |
| **B2** | l'oracolo batte C-POSIZIONE corretta | saldo vero **> 95° percentile** dei 500 finti |
| **B0** | *cancello di validità, obbligatorio* | soste **arrivate al motore** nei bracci finti = **3639**, quelle dell'oracolo. Se non coincidono, l'esito non è valido e non si legge |

**B0 viene prima.** Se non passa, B1 e B2 non si leggono: è la clausola che mancava alla
prima prereg, e questa volta è **bilaterale** — vale in entrambi i versi dello squilibrio.

### La regola di decisione, scritta prima

- **B0 fallisce** → l'esito non è valido. Si scrive e si ferma lì.
- **B0 passa e B1 fallisce** → il NULL della prima misura è **confermato senza il dubbio
  dell'artefatto**: la famiglia resta chiusa, e la cascata dell'undercut resta non spesa.
- **B0 passa e B1 e B2 passano** → il NULL della prima misura era **un artefatto**. Si
  scrive che lo era, e **solo allora** si apre la prereg della cascata dell'undercut, che
  dovrà battere le stesse due controfigure corrette.
- **B0 passa, B1 passa e B2 no** → esito misto: si riporta e **non** si apre nessuna
  prereg. Battere una controfigura su due non è la condizione che F5 impone.

## 4 · Cosa questa prereg non fa, e la sua onestà

- **Non riesegue niente di diverso dalla correzione.** Nessun parametro nuovo, nessuna
  statistica nuova, nessuna soglia nuova.
- **Non tocca la lettura per terzile**, che nell'esito precedente è la ragione vera della
  chiusura e che questa correzione **non può cambiare**: nel terzile basso — 8 punti di
  divario su 16 — la mediana del caso è **+5** contro il **+4** dell'oracolo, e togliere
  soste al caso può solo abbassare quel +5 di poco. Va detto adesso, prima dei numeri:
  **anche se B1 passasse, resterebbe vero che dove il divario è più grande il caso lo
  cattura tutto.** Un B1 passato riaprirebbe la famiglia, non la assolverebbe.
- **Non è un secondo tentativo di far passare la stessa cosa.** È lo stesso tentativo,
  misurato senza un handicap che avevo introdotto io.
