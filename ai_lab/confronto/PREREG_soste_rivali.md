# PREREG — togliere l'assunzione sulle soste dei rivali

*Scritta il 01/08/2026 PRIMA di misurare la variante. Scorpora la voce **N4** dal pacchetto
neutralizzazione, che resta NULL.*

## Perché adesso, e perché da sola

`costruttore.mjs` assume che sotto neutralizzazione **i rivali ancora al primo stint si
fermino** (`if (c.stint !== 1) continue`). La voce N4 era dentro il pacchetto perché non si
sapeva quale lettura credere: spegnendola gli **esatti salgono** (27,5% → 35,3% sui casi con
regime) ma il **bias medio peggiora** (+1,16 → +1,37). Due letture in conflitto, e il
pacchetto aveva dichiarato che decideva il bias.

**Adesso c'è un fatto nuovo, e viene da fuori quelle undici gare.** Misurato su
**105 gare del fondo**, 9.782 occasioni sotto neutralizzazione di campo
(`PREREG_chi_si_ferma.md`):

- si ferma il **7,7%** delle auto: novantadue volte su cento non si ferma nessuno;
- e lo **stint non separa**: 8,3% al primo, 8,4% al secondo, 6,1% dal terzo.

**La variabile su cui l'assunzione si regge non ha potere predittivo.** Non è una regola
imprecisa da tarare: è un criterio che non distingue niente, e che muove circa il 60% del
campo per catturare un fenomeno che riguarda l'8%.

Questo scioglie il conflitto senza scegliere la lettura comoda: il pacchetto resta NULL per
i suoi motivi, questa voce ha il suo.

## Cosa cambia

Una riga: sotto neutralizzazione non si assume **nessuna sosta altrui**. Un rivale che non
ha dichiarato un piano non ne ha uno.

## Il cancello — qui decide M1, e la ragione va scritta prima

Il pacchetto neutralizzazione aveva dichiarato che decideva il **bias (M2)**, perché conteneva
termini che toccano il **passo**. **Questa voce non tocca il passo.** Il referto lo dice da
sempre: «non cambia i TEMPI (nel kernel le auto non interagiscono), cambia le POSIZIONI».

Un'assunzione che sposta solo le posizioni si giudica sulle posizioni. **Decide M1**, in
lettura B2, e M2 si riporta senza decidere.

| | condizione |
|---|---|
| **R1** | M1 lettura B2 sui casi con **regime al congelamento**: gli esatti **non calano** |
| **R2** | M1 lettura B2 su **tutti** i 223 casi appaiati: gli esatti non calano di più di **1 punto** |
| **R3** | i casi **senza regime** al congelamento restano identici **AL BIT** — l'assunzione vive solo sotto neutralizzazione e non ha nessun diritto di toccare il resto |
| **R4** | la **copertura** non cala: nessun caso perde la risposta |

**M2 si riporta e non decide**, ed è dichiarato adesso, non dopo aver visto se conferma. Se
il bias peggiorasse, si scrive che peggiora e si spiega che l'assunzione non agisce sul
passo — non si cambia il giudice.

## Cosa fa dichiarare NULL

- una fra R1–R4 non regge;
- la suite del banco perde una sentinella oggi verde;
- gli esatti **salgono** solo grazie a una gara sola (blocchi = gare, E11: si guarda la
  ripartizione, non solo il totale).

## Cosa NON dimostra

- **Non dice che nessuno si ferma mai.** Dice che il 7,7% si ferma e che non sappiamo
  distinguerlo. La Safety Car al giro giusto per chi ha gomme vecchie resta il caso in cui
  il motore sbaglia — e continuerà a sbagliarlo, ora per omissione invece che per invenzione.
- Il tasso del 7,7% viene dal fondo **2018-2025**. Le gomme e il regolamento 2026 sono
  cambiati, e sul 2026 le occasioni sono troppo poche per ricontrollarlo.
- Il ramo Safety Car su M1 resta **n = 17** nel confronto fra motori.
