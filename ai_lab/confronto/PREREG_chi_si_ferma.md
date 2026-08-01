# PREREG — chi si ferma sotto Safety Car

*Scritta il 01/08/2026 PRIMA di misurare. Primo fatto della «carta d'identità della
situazione»: non un numero che il motore calcola, ma un comportamento che il motore deve
sapere.*

## La domanda, e perché oggi ha una risposta sbagliata

Quando il motore proietta uno scenario sotto neutralizzazione deve indovinare **quali
rivali entrano ai box**. Non cambia i tempi — nel kernel le auto non interagiscono — ma
cambia le **posizioni**, che è tutto ciò che il prodotto risponde.

Oggi lo decide una riga: `if (c.stint !== 1) continue` — si assume che si fermi chi è
ancora al primo stint. Misurato: **azzecca 25 rivali su 148 (16,9%)**, e **a Monaco ne
prevede zero mentre 360 entrano davvero**.

Non è un parametro tarato male: è un'assunzione di fisica messa a rispondere a una domanda
che di fisica non è. **Chi si ferma sotto Safety Car è una decisione di muretto**, e le
decisioni si misurano guardando cosa la gente ha fatto, non deducendole.

## Cosa si misura, e su cosa

**Popolazione:** il **fondo**, gare asciutte — non le undici del banco. Per ogni auto e ogni
giro `L` in cui **il campo è neutralizzato** (criterio della PREREG-6: almeno metà delle
auto sotto regime), si guarda se quell'auto **entra ai box entro `L+2`**.

Due giri e non uno: sotto Safety Car la corsia si apre e la fila si forma, e chi decide al
giro `L` materialmente entra a `L+1` o `L+2`.

**Le variabili candidate — tutte note al congelamento, nessuna dal futuro:**

| variabile | perché potrebbe contare |
|---|---|
| **età della gomma** | chi ha gomme vecchie ha tutto da guadagnare, chi le ha nuove no |
| **ha già fatto una sosta** | il regolamento 2026 impone due mescole slick sull'asciutto: chi non si è mai fermato *deve* farlo |
| **circuito** | dove sorpassare è impossibile la sosta gratis vale il doppio |
| **posizione** | chi è nei punti rischia meno di chi insegue |
| **giro della gara** | a tre giri dalla fine non si ferma nessuno |

**Nessuna di queste è dichiarata vincente in anticipo.** Si misura quale separa, e si
scrive anche quali NON separano — che è metà del valore: il repo ha già pagato per
l'abitudine di tenere solo le variabili che tornano.

## Il metro: quanto vale una regola contro quella di oggi

Per ogni regola candidata si misura, sulle stesse identiche occasioni:

- **precisione**: fra quelli che dico che si fermano, quanti si fermano davvero;
- **richiamo**: fra quelli che si fermano davvero, quanti ne prendo;
- **e soprattutto il conto secco**: quante auto *muove* la regola, e quante ne azzecca.

La linea di base è dichiarata: `stint !== 1` fa **25 su 148**, cioè **16,9%**.

## Il cancello — su cosa si accende, non su cosa è bello

Una regola nuova sostituisce quella di oggi **solo se** passa:

| | condizione |
|---|---|
| **B1** | precisione **≥ 40%** sul fondo: meno di così è tirare a indovinare con più passaggi |
| **B2** | funziona su **almeno 8 gare** distinte, senza che una sola le porti il risultato (blocchi = gare, E11) |
| **B3** | a Monaco **non prevede zero**: è il caso che la regola di oggi sbaglia più clamorosamente, ed è l'unico circuito su cui una regola comportamentale deve dimostrare di aver capito qualcosa |
| **B4** | poi, **e solo poi**, M1 in lettura B2 sui casi con regime non peggiora |

**B4 arriva dopo, e va detto perché:** una regola può essere più giusta e non spostare le
posizioni, perché i rivali che sbaglia sono lontani. Sarebbe comunque un miglioramento
della verità, ma non del prodotto — e si scriverebbe così.

## Cosa fa dichiarare NULL

- nessuna variabile separa: la migliore regola resta sotto il 40% di precisione;
- separa solo grazie a una gara o a un circuito;
- separa sul fondo ma il 2026 si comporta in modo diverso — le gomme e il regolamento sono
  cambiati, e va controllato invece che sperato.

## Cosa NON dimostrerà

- **Non prevede la strategia di nessuno.** Dice cosa fa *tipicamente* chi si trova in quello
  stato, non cosa farà questo muretto oggi.
- Non tocca i **tempi**, solo le posizioni: nel kernel le auto non interagiscono.
- Il campione per team è sottile e per team×circuito è aria: se la variabile vincente fosse
  il team, servirebbe un documento suo e molta più prudenza.

---

## ESITO — 01/08/2026: **NULL su B1**, e il motivo è il risultato

9.782 occasioni su **105 gare** del fondo (auto × giro sotto neutralizzazione di campo).

### Il fatto che cambia la domanda

> **Sotto neutralizzazione di campo, entra ai box il 7,7% delle auto.**

Novantadue volte su cento **non si ferma nessuno**. La domanda «chi si ferma» aveva una
premessa sbagliata: non è una selezione fra tanti, è un'eccezione.

### Nessuna regola arriva al 40%: **B1 FALLISCE**

| variabile | separa? | da → a |
|---|---|---|
| **età gomma** | **sì**, monotona | 4,2% (0-4 giri) → **15,5%** (30+) |
| età dentro lo stint 1 | **sì**, la più forte | 5,2% (0-9) → **18,5%** (20+) |
| posizione | poco | 9,1% (P1-P5) → 6,8% (P11+) |
| frazione di gara | poco | 6,4% → 9,2% |
| **stint** | **NO** | 8,3% · 8,4% · 6,1% |

La cella migliore che si riesce a costruire — primo stint, gomme oltre i 20 giri — arriva
al **18,5%**. Il cancello chiedeva **40%**, e nessuna combinazione ci si avvicina. **NULL.**

### Ma la variabile che il motore usa oggi è **l'unica che non separa**

`stint !== 1` divide il mondo in 8,3% contro 8,4%. **Non è una regola imprecisa: non è una
regola.** Sta muovendo circa il 60% del campo per catturare un fenomeno che riguarda l'8%,
e lo fa su un criterio che non ha nessun potere predittivo.

L'età della gomma ce l'ha — quadruplica il tasso — ma nemmeno lei basta a superare
il 40%.

### E Monaco dice il contrario di quello che il referto sospettava

`REFERTO §G4` diceva: «a Monaco ne assume zero mentre 360 rivali entrano davvero».
Misurato sul fondo, sotto neutralizzazione **di campo**, a Monaco entra ai box lo
**0%** (n = 110, 3 gare). I 360 sono soste avvenute *da qualche parte* nella finestra di
proiezione, non entro due giri da una Safety Car di campo.

**Assumere zero rivali a Monaco è la cosa giusta**, non lo sbaglio che sembrava. **B3
cade**, ma cade perché la premessa era sbagliata, non perché la regola nuova fallisca.

### Cosa se ne fa il prodotto, adesso

Il cancello dice NULL: **nessuna regola comportamentale sostituisce quella di oggi**. Ma la
misura dà una risposta quantitativa alla domanda che la voce N4 aveva lasciata aperta con
due letture in conflitto:

> Assumere che **nessun rivale** si fermi sbaglia il **7,7%** delle volte. La regola di
> oggi ne muove il 60% del campo per prenderne l'8%, su un criterio che non separa.

Non è una vittoria di una regola nuova: è la **misura del costo di quella vecchia**, ed è
il numero che mancava per decidere N4 senza scegliere fra due letture che si
contraddicevano.

### Cosa questo NON dice

- **Non dice quando** succede quel 7,7%: la Safety Car al giro giusto per chi ha gomme
  vecchie è esattamente il caso in cui il muretto si gioca la gara, e lì il motore continuerà
  a sbagliare.
- Il fondo è 2018-2025; le gomme e il regolamento 2026 sono cambiati, e questo non è stato
  ricontrollato sul 2026 (dove le occasioni sono troppo poche per farlo).
- Un tasso base dell'8% rende **qualunque** regola difficile: per battere «nessuno» servirebbe
  una precisione che nessuna variabile disponibile al congelamento offre.
