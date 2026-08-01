# PREREG — il pacchetto neutralizzazione, quattro voci e un solo cancello

*Scritto il 01/08/2026, PRIMA di toccare `costruttore.mjs` e PRIMA di misurare qualunque
variante (regola 3). Voce 2 di `PIANO_CORREZIONE.md`.*

## Perché è un pacchetto e non quattro lavori

È l'unico ramo in cui il motore nuovo **perde** contro il vecchio (n = 17, esatti 35,3%
contro 41,2%), ed è dove **quattro metriche su cinque** puntano il dito. Le quattro voci
toccano lo stesso meccanismo da quattro lati: se si accendono una alla volta, ognuna viene
misurata mentre le altre tre sono ancora sbagliate, e il risultato non dice niente su
nessuna. Si fa insieme o non si fa.

## Le quattro voci, e cosa è già misurato di ciascuna

| | cosa | misurato (referto §G) |
|---|---|---|
| **N1** | il regime è legato alle soste: `costruttore.mjs:141` `const regime = soste.length ? … : null` lo rende **inerte in proiezione pura** | sotto regime il bias del nuovo è **1,964 s/giro** contro 0,033 in verde. Controfattuale: 1,068 → 0,699 (3 giri), 0,623 → 0,333 (5), 0,303 → 0,055 (10); migliora in **7 gare su 8**; sui congelamenti verdi il risultato è **bit-identico** |
| **N2** | `PERSISTENZA_REGIME_GIRI = 1` vale per entrambi i regimi e non ha targhetta | dato SC al giro L: ancora in corso al **72%** a L+2 e al **58%** a L+3 (mediana 3 giri). Dato VSC: **41%** a L+2 (mediana 1). **Giusta per il VSC, sbagliata per la SC di un fattore 3** |
| **N3** | il fattore di neutralizzazione è un prior esterno mai validato in casa (SC 0,50 · VSC 0,65) | misurato dai soli `cum_time`: **SC 0,758 · VSC 0,867**, entrambi **sopra** la banda dichiarata (SC 0,40-0,60 · VSC 0,60-0,70) → il motore **sotto-addebita** la sosta neutralizzata. Controllo che valida il metodo: in verde il fattore realizzato è **0,958** |
| **N4** | le soste dei rivali sotto SC: l'assunzione `stint !== 1` (`costruttore.mjs:177`) | ferma 148 rivali e ne azzecca **25 (16,9%)**; **a Monaco ne assume zero** mentre 360 rivali entrano davvero. Spegnendola: esatti 27,5% → 35,3% sui casi con regime, ma il bias medio **peggiora** (+1,16 → +1,37) |

**N4 è il motivo per cui questo documento esiste.** Le sue due letture non concordano, e
chi misurasse dopo potrebbe scegliere quella che gli fa comodo. Il metro va fissato adesso.

---

## Il cancello

### Metrica primaria: **M2 ristretto ai congelamenti con regime**, e decide il **BIAS**

Bias del passo — errore **con segno** sul distacco previsto a 3, 5 e 10 giri, in s/giro —
calcolato **solo** sui congelamenti in cui il regime è osservato al giro `Lf`
(informazione ≤ Lf, mai il regime al giro della sosta: quello è E14). Numerosità attese:
**n = 291 / 266 / 191**.

**Il cancello decide sul bias, non sull'errore assoluto, e la ragione si scrive prima:**
la diagnosi che motiva l'intero pacchetto *è* un bias — 1,964 s/giro sotto regime contro
0,033 in verde. Una correzione che non riducesse quel bias non avrebbe corretto il difetto
che dice di correggere, per quanto migliorasse altre letture. L'errore assoluto e gli
esatti si riportano **sempre**, e non possono salvare un bias che non scende.

**Il pacchetto passa se:**

| | condizione |
|---|---|
| **C1** | `\|bias\|` scende su **tutti e tre** gli orizzonti (3, 5, 10 giri) |
| **C2** | il segno del miglioramento regge per gara: `\|bias\|` scende in **almeno 7 gare su 8** giudicabili (blocchi = gare, E11) |
| **C3** | **non-danno sui congelamenti verdi: identico AL BIT.** Non «entro tolleranza» — identico. Il pacchetto tocca il ramo neutralizzato e non ha nessun diritto di spostare un numero in verde |
| **C4** | M5, copertura della banda sui **180 casi con regime coincidente**, non cala di più di 2 punti |

C3 è la più importante e la più facile da rompere: N1 slega il regime dalle soste, e una
svista lì cambia anche gli scenari senza regime.

### Cosa si riporta e NON decide

- **M1** in lettura B2 sui casi con regime al congelamento (n = 17). Indicativo, non
  concludente, ed è già scritto nel referto che lì il vecchio è davanti. Un n = 17 non
  promuove e non boccia.
- **Esatti** sui casi con regime (la lettura con cui N4 «vince»).
- **Le quattro voci una per una**, oltre che insieme: servono a capire *chi* ha fatto cosa,
  e a lasciare a referto quelle che da sole peggiorano. Ma **il cancello lo decide il
  pacchetto**, non la somma dei pezzi.

### Cosa fa dichiarare NULL

- C1, C2, C3 o C4 non reggono;
- il fattore misurato in casa (N3) non si riesce a stimare con blocchi = gare su almeno
  5 gare per regime: allora resta il prior esterno, e si scrive che resta;
- `PERSISTENZA` misurata per SC risulta instabile fra gare di un fattore > 3.

---

## Quattro cose da NON credere, scritte prima che qualcuno le speri

1. **Questo non risolve M5.** Dei casi fuori banda, **70 su 84 partono in verde e finiscono
   neutralizzati**: lì il regime non è conoscibile al congelamento e nessun fattore, per
   quanto ben misurato, li recupera. Se dopo il pacchetto M5 restasse rosso, non sarà una
   sorpresa e non sarà un fallimento del pacchetto.
2. **N3 non è un permesso per andare oltre la banda del prior.** Il misurato (SC 0,758,
   VSC 0,867) sta **sopra** la banda dichiarata: sostituirlo significa dichiarare che il
   prior esterno è superato, con targhetta, non allargare la banda per farcelo entrare.
3. **N2 non autorizza a estrapolare il regime.** Portare la persistenza della SC da 1 a 3
   giri resta *informazione al congelamento* solo perché il 72%/58% è misurato sul fondo,
   non perché si sappia qualcosa di questa gara. Va a targhetta come prior misurato, e il
   giro in cui si smette di estrapolare va dichiarato in `assunzioni`.
4. **Il ramo Safety Car resta n = 17 su M1.** Nessun numero di questo pacchetto rende
   concludente quel confronto.

## Il tranello, per iscritto, perché il prossimo lo troverà

La regola ovvia — «guarda il campo al giro L per sapere se c'è un regime» — recupera 36
casi e porta la banda dal 37,1% al **91,4%**. **È futuro d'orologio.** Delle celle di chi ha
già chiuso il giro L *prima* di me, **0 su 265** sono neutralizzate; di chi lo chiude
*dopo*, **402 su 713**. Un indice di giro non è un istante.

> **`indice di giro ≤ L` NON è la definizione di informazione ammessa.** L'unica versione
> causalmente onesta è `cum_time ≤ il mio`, che accende **9 casi, di cui 2 sbagliati**.

Chiunque riapra questa voce vedrà quel +54 di copertura entro cinque minuti. Sta scritto
qui che è falso.

## Regola di condotta

Un cancello mal specificato si mette a referto e se ne pre-registra uno nuovo: non si
riscrive dopo aver visto il risultato (E08). Se il pacchetto non passa, resta spento e si
scrive che non passa — come i cinque cancelli dell'arco degrado e come sarebbe successo al
rodaggio se M1 non avesse retto.

---

# ESITO PARZIALE — 01/08/2026

**Il cancello NON passa, e il motivo è più interessante del verdetto.**

## Quello che è stato misurato, e che resta

**N3 · il fattore, misurato in casa sul FONDO** (`esporta_neutralizzazione_fondo.mjs`,
147 gare asciutte, 3.911 soste). Il controllo che valida il metodo regge: le soste in
verde danno **1,011** con IC95 [0,990; 1,030].

| | prior esterno | referto §G3 (11 gare 2026) | **fondo (50 e 45 gare)** |
|---|---|---|---|
| SC | 0,50 (banda 0,40-0,60) | 0,758 | **0,623** IC95 [0,515; 0,727] |
| VSC | 0,65 (banda 0,60-0,70) | 0,867 | **0,719** IC95 [0,634; 0,845] |

**Correzione al referto:** «entrambi ben sopra la banda dichiarata» era un artefatto
delle sole 11 gare. Sul campione vero stanno appena sopra il bordo.

**E la dispersione è la notizia vera:** sotto SC il fattore ha p25-p75 **0,21-1,05**, e le
mediane *per gara* vanno da **−0,54 a +1,31**. Un fattore negativo significa che fermarsi
sotto SC ha fatto **guadagnare** tempo sul campo. Un singolo numero per «SC» descrive male
il fenomeno, e va detto prima di sostituirlo a un altro singolo numero.

**N2 · la persistenza, misurata sul fondo** (8.095 osservazioni SC, 2.697 VSC), con la
regola dichiarata prima: si estrapola finché il regime è ancora in corso in almeno metà dei
casi.

| | costante attuale | referto §G2 (11 gare) | **fondo** |
|---|---|---|---|
| SC | 1 | «sbagliata di un fattore 3» → 3 | **2** (57% a L+2, 38% a L+3) |
| VSC | 1 | 1 | **1** — già giusta |

Entrambe le misure sono depositate in `pitloss_priors.json` con `promosso: false`: i numeri
ci sono, non toccano nessuna risposta.

## Perché il cancello non passa: N1 è un no-op

**Acceso e spento danno lo stesso identico numero su tutte e 821 le righe con regime**, su
tutti e tre gli orizzonti e tutte e sette le gare giudicabili.

Non è un difetto del banco. In **proiezione pura** il regime non ha nessun consumatore:

- nel costruttore `regime` alimenta solo `perditaBox` (la perdita ai box) e le soste assunte
  ai rivali — **entrambe legate alle soste**, che in proiezione pura non ci sono;
- il passo non sa cosa sia un regime: **zero occorrenze** di `regime` in
  `engine/passo_v2.mjs` e `engine/kernel.mjs`.

Quindi «slegare il regime dalle soste» rende il regime **disponibile**, e nient'altro.

**Il controfattuale del referto misurava un'altra cosa.** «Distacchi congelati per P giri:
bias 1,068 → 0,699 (3 giri)» non è l'effetto di slegare il regime: è l'effetto di
**congelare i distacchi**, cioè di una fisica — sotto neutralizzazione il campo si compatta
e i distacchi smettono di evolvere — che **non esiste in nessun modulo del repo**.

## Cosa diventa la voce 2

La voce va riscritta, e non è un dettaglio di formulazione:

> **N1 non è «slegare il regime dalle soste». È «insegnare al motore che sotto
> neutralizzazione i distacchi non evolvono come in verde».**

È un termine nuovo nella fisica, non un `if` spostato, e ha bisogno di due cose che oggi non
ha: **la misura di quanto i distacchi si comprimono davvero** sotto SC e sotto VSC (il dato
c'è — `fisica_residui.mjs` §7 misura già `d(gap)` per regime) e un **cancello suo**, perché
tocca il passo e non il prezzo della sosta.

Finché quella misura non c'è, N2 e N3 restano depositati e non promossi: promuoverli da soli
significherebbe cambiare il prezzo della sosta senza toccare il difetto da 1,964 s/giro, e
il cancello del pacchetto — pre-registrato sul bias — direbbe giustamente di no.

**Il pacchetto resta SPENTO** (`pacchetto_neutralizzazione` assente dal prior, quindi
inerte), e `C3` è verde: i 12.237 congelamenti in verde sono **identici al bit**.
