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
