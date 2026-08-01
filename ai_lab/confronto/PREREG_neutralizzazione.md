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

**N3 · il fattore, misurato in casa sul FONDO** (`esporta_compressione_fondo.mjs`,
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

---

# PREREG-2 — la compressione dei distacchi

*Scritto il 01/08/2026 DOPO l'esito parziale qui sopra e PRIMA di misurare la
compressione e prima di scrivere il codice. È una pre-registrazione nuova, non una
riscrittura della precedente: quella resta con il suo NULL (E08).*

## Cosa si è capito, e perché serve un documento nuovo

N1 come era formulato — «slegare il regime dalle soste» — è un **no-op misurato**: acceso e
spento danno lo stesso numero su tutte e 821 le righe con regime. Il regime non ha
consumatori fuori dalle soste, e il passo non sa cosa sia.

Il fenomeno vero è un altro: **sotto neutralizzazione i distacchi non evolvono come in
verde**. Il campo si compatta, e un modello che proietta passo verde durante una Safety Car
sbaglia il distacco di tutto ciò che la Safety Car ha compattato. È il difetto da
**1,964 s/giro contro 0,033 in verde**.

## La forma

Per ogni giro proiettato che cade **dentro la finestra di persistenza del regime osservato
al congelamento**, il distacco dal leader si contrae di un fattore dichiarato:

```
gap(L + k + 1) = gap(L + k) · κ(regime)        per k < persistenza(regime)
gap evolve dal passo                            per k ≥ persistenza(regime)
```

`κ = 1` è «nessuna compressione» e riproduce esattamente il motore di oggi — la sonda
obbligatoria. `κ = 0` è il campo perfettamente incolonnato.

**Perché moltiplicativo e non additivo:** sotto Safety Car chi è staccato di 20 s recupera
molto più di chi è staccato di 2 s, perché il limite è la velocità della vettura di
sicurezza, non un delta costante. Una contrazione additiva darebbe distacchi negativi sui
piccoli. Se la misura dicesse che la forma additiva descrive meglio i dati, si scrive che il
modello moltiplicativo era sbagliato e si ri-registra — non si aggiusta a posteriori.

## Come si misura κ, dichiarato prima

**Popolazione:** fondo, gare asciutte. Per ogni coppia (pilota, giro k → k+1) in cui:
- il pilota e il leader hanno `cum_time` a entrambi i giri;
- **nessuno dei due** è in in-lap o out-lap fra k e k+1 (una sosta non è compressione);
- lo `status` per-auto è presente su entrambi (E13: ignoto non è verde).

**Stima:** `κ = mediana( gap(k+1) / gap(k) )` per regime, sui giri con `gap(k) > 1,0 s` —
sotto il secondo il rapporto esplode per rumore di cronometraggio e non descrive niente.
Blocchi = gare (E11), bootstrap 2.000, seme 20260801.

**Il controllo che valida il metodo, e senza il quale i numeri non si guardano:** in
**verde** `κ` deve venire ≈ 1. Se non viene, il metro è rotto e i κ neutralizzati non
significano niente — è lo stesso controllo che ha validato il fattore di neutralizzazione
(1,011).

## Il cancello

**Identico a quello della PREREG-1**, e non è pigrizia: la metrica giusta non è cambiata,
è cambiata l'ipotesi su *cosa* la muove. Riusare il metro rende i due esiti confrontabili.

| | condizione |
|---|---|
| **C1** | `\|bias\|` scende su tutti e tre gli orizzonti (3, 5, 10 giri), sui congelamenti con regime |
| **C2** | `\|bias\|` scende in almeno 7 gare su 8 giudicabili (blocchi = gare) |
| **C3** | i congelamenti **verdi** restano identici AL BIT |
| **C4** | M5 sui casi con regime non cala di più di 2 punti |

**Sonda obbligatoria, in più:** con `κ = 1` il motore deve riprodurre **esattamente** i
numeri di oggi. Se non li riproduce, il termine non fa ciò che questo documento descrive e
l'esito è NULL comunque vada il resto.

## Cosa fa dichiarare NULL

- una fra C1–C4 non regge, o la sonda a `κ = 1` non riproduce il motore attuale;
- il controllo in verde non dà `κ ≈ 1` (fuori da 0,95-1,05): metro rotto;
- `κ` stimato per SC non è stabile fra gare — IC95 a blocchi che contiene 1, cioè
  «nessuna compressione» resta possibile;
- il termine richiede di conoscere il regime **oltre** la finestra di persistenza misurata:
  quello sarebbe prevedere una Safety Car futura (E14), e non si fa per nessun guadagno.

## Cosa NON dimostrerà

- **Non risolve M5.** Resta vero che 70 casi su 84 fuori banda partono in verde e finiscono
  neutralizzati: lì il regime non è conoscibile al congelamento.
- **N2 e N3 entrano nel pacchetto**, quindi un miglioramento non si può attribuire alla sola
  compressione. Le tre voci si misurano anche una per una, per il referto, ma **decide il
  pacchetto**.
- Il ramo Safety Car su M1 resta **n = 17**.

## κ misurato — 01/08/2026

| regime | κ | IC95 (blocchi = gare) | n | gare |
|---|---|---|---|---|
| VERDE (controllo) | **1,0312** | [1,0292; 1,0335] | 115.366 | 146 |
| **SC** | **0,6914** | [0,6141; 0,7720] | 3.597 | 71 |
| **VSC** | **0,9304** | [0,9007; 0,9523] | 1.511 | 51 |

**Il controllo regge:** in verde κ = 1,031, dentro la banda 0,95-1,05 dichiarata prima. Il
valore sopra 1 è reale e non un difetto del metro: in verde i distacchi **crescono**, ed è
il passo a produrlo.

**Entrambi gli IC95 escludono 1**: la compressione esiste. Forte sotto SC (−31% di distacco
per giro), mite sotto VSC (−7%).

**La dispersione va letta:** sotto SC p25-p75 è 0,36-1,01. In un quarto dei casi il
distacco **non si comprime affatto** — la mediana descrive il tipico, non il singolo.

Depositato in `pitloss_priors.json` come `compressione_distacchi_interna`, `promosso: false`.

## Il meccanismo, deciso e non ancora costruito

La compressione **non si implementa come interazione a runtime**: il kernel è
deliberatamente non interagente, e quella proprietà non si baratta. Ma la non-interazione
riguarda i **duelli** — chi passa chi — non un vincolo esterno imposto a tutto il campo
insieme, che è esattamente cosa è una Safety Car. Quindi il termine può entrare, dichiarato.

**Come:** il ciclo del kernel è per-pilota e poi per-giro; comprimere un distacco richiede
di guardare tutto il campo allo stesso giro, quindi la finestra neutralizzata va percorsa
**per giro**. Applicare invece uno spostamento costante calcolato dai soli gap al
congelamento sarebbe una contrazione «sopra» l'evoluzione del modello, non «al posto» —
e su una finestra di 2-3 giri con distacchi da 20 s la differenza vale qualche decimo, cioè
abbastanza da cambiare il verdetto di un cancello che si gioca sui centesimi.

**Non è stato costruito in questa sessione**, e non per mancanza di tempo: è una modifica al
pezzo più delicato del repo e merita di essere fatta all'inizio di una sessione, non alla
fine. Ciò che serve è tutto qui: la forma, il protocollo, κ misurato con il suo controllo,
il cancello (le stesse C1–C4) e la sonda obbligatoria a κ = 1.

## ESITO della PREREG-2 — 01/08/2026: **NULL**, e il perche' e' netto

Il termine e' costruito, misurato e **non passa**. Resta spento.

```
C1  |bias| scende su tutti e tre gli orizzonti          PASSA
      3 giri   +1,6213  ->  -0,7869
      5 giri   +0,7528  ->  -0,7004
     10 giri   +0,4418  ->  -0,3359
C2  |bias| scende in >= 7 gare su 8 giudicabili         FALLISCE (4 su 7)
C3  congelamenti verdi identici AL BIT                  PASSA (12.237 su 12.237)
C4  M5 sui casi con regime                              non misurata: il verdetto
                                                        era gia' deciso da C2
```

### Cosa dicono i numeri, oltre al verdetto

**Il fenomeno e' vero e grande.** Dove il bias era grosso, la compressione lo
demolisce: Giappone **1,9649 -> 0,3368**, Austria **0,9576 -> 0,1651**, Cina
1,0244 -> 0,3949. Non e' un effetto marginale.

**Ma un κ solo overcorregge.** Il segno del bias aggregato si **ribalta**, da +1,62 a
−0,79: il motore passa dal mettere i piloti troppo indietro al metterli troppo avanti.
E le tre gare che peggiorano sono esattamente quelle che partivano quasi giuste —
Belgio 0,1646 -> 1,2483, Canada 0,2915 -> 1,6377, Gran Bretagna 0,1715 -> 2,2867.

**Era prevedibile dalla dispersione, ed era gia' scritto:** sotto SC il κ misurato ha
p25-p75 **0,36-1,01**, con mediane per gara da −0,54 a +1,31. In un quarto dei casi il
distacco non si comprime affatto. Applicare la mediana a tutti significa comprimere
forte anche dove non succedeva niente.

### La strada che questo esito indica — e che NON si prende adesso

κ non e' una costante del regime: e' una distribuzione. La direzione sensata e'
condizionarlo a qualcosa di **noto al congelamento** — da quanti giri dura il regime,
oppure l'ampiezza del distacco stesso, dato che comprimere 20 s e comprimere 2 s non
sono lo stesso fenomeno fisico.

Ma quella e' **un'ipotesi nuova con una prereg nuova**. Ritoccare κ adesso, con le
tabelle sotto gli occhi, finche' C2 non passa, sarebbe E08 nella sua forma piu' comoda:
il termine passerebbe, e nessuno saprebbe piu' se e' vero.

### Cosa resta acceso, cosa resta spento

**Spento tutto**: `pacchetto_neutralizzazione` non esiste nel prior di produzione, e i
tre blocchi misurati (`fattori_neutralizzazione_interni`, `persistenza_regime_interna`,
`compressione_distacchi_interna`) hanno `promosso: false`.

**Resta in piedi il meccanismo**, e non e' poco: il kernel sa comprimere i distacchi, la
sentinella `s30` lo verifica in cinque modi con tre mutazioni provate, il ciclo per giro
e' scritto e i golden lo attraversano identici. Il giorno in cui κ avra' la forma giusta,
non c'e' niente da costruire.

### Due difetti miei, in questo giro

1. **Il banco chiamava `simulate` da se' e non passava `neutralizzazione`.** Il cancello
   ha misurato diligentemente un motore senza il termine che doveva giudicare, e ha
   detto «identico» — sembrando una scoperta. E' la forma esatta di E17, e mi e'
   capitata **mentre stavo correggendo la stessa cosa in `piano.mjs`**. Un secondo posto
   che chiama il kernel e' sempre un secondo posto che puo' dimenticare un pezzo.
2. **Avevo chiamato la vista con il nome di un file in quarantena.** `s07` l'ha preso
   subito: due file quasi omonimi, uno onesto e uno costruito dal futuro, sono un
   incidente che aspetta il prossimo lettore. Rinominato — e la sentinella vieta anche
   solo di NOMINARE quel materiale in un sorgente, il che ha reso interessante scrivere
   il commento che lo spiega.

---

# PREREG-3 — il distacco non va a zero, va a una coda

*Scritta il 01/08/2026 DOPO il NULL della PREREG-2 e PRIMA di misurare qualunque
variante nuova. Terzo documento, non una riscrittura del secondo: quello resta col suo
NULL (E08).*

## L'ipotesi, e perché nasce dal modo in cui il secondo è fallito

`gap(k+1) = gap(k)·κ` manda ogni distacco a **zero** se il regime dura abbastanza. Non è
quello che fa una Safety Car: le auto si incolonnano dietro di lei a una **distanza di
coda** — un secondo abbondante, quanto serve a non tamponarsi — e lì si fermano. Il
distacco non svanisce, **converge a un pavimento**.

Ed è esattamente la forma del fallimento misurato: la compressione ha demolito il bias
dove era grosso (Giappone 1,96 → 0,34) e l'ha **peggiorato dove era già quasi giusto**
(Belgio 0,16 → 1,25, Canada 0,29 → 1,64, Gran Bretagna 0,17 → 2,29). Un κ moltiplicativo
schiaccia i distacchi piccoli sotto il pavimento fisico, e i distacchi piccoli sono
proprio quelli delle gare che partivano bene.

**La forma nuova, a due parametri:**

```
gap(k+1) = g∞ + ( gap(k) − g∞ ) · κ
```

`g∞` è la distanza di coda a cui il campo converge; `κ` la velocità con cui ci arriva.
Con `g∞ = 0` si ricade nella PREREG-2, che è la prova che questa la contiene. Con `κ = 1`
il termine è spento — e resta la sonda obbligatoria.

**Perché questa e non «κ per fascia di distacco»:** una tabella per fascia descriverebbe
gli stessi dati con più parametri e nessuna fisica. Qui i due numeri hanno un significato
che si può contestare — «le auto in coda stanno a `g∞` secondi» è un'affermazione sul
mondo, non una curva.

## Come si stimano g∞ e κ, dichiarato prima di stimarli

**Popolazione:** identica alla PREREG-2, e non si tocca — fondo, gare asciutte, coppie
(pilota, giro k→k+1), né pilota né leader in in-lap o out-lap, `status` per-auto presente.
**Cade il filtro `gap > 1,0 s`**: serviva perché il rapporto esplodeva vicino allo zero, e
qui non si misura più un rapporto. Toglierlo è obbligatorio, non facoltativo: i distacchi
piccoli sono la regione che la PREREG-2 sbagliava, escluderli sarebbe misurare altrove.

**Stimatore, robusto e trasparente:** si divide `gap(k)` in **dieci fasce a numerosità
uguale**, si prende la **mediana di `gap(k+1)` dentro ogni fascia** contro la mediana di
`gap(k)`, e si fa una retta ai minimi quadrati sui dieci punti. Da lì `κ = pendenza` e
`g∞ = intercetta / (1 − κ)`. Le mediane per fascia reggono alle code; la retta sui dieci
punti è verificabile a occhio, cosa che una regressione su 3.597 punti non è.

**Incertezza:** bootstrap 2.000, blocchi = gare (E11), seme 20260801.

**Il controllo che valida il metro:** in **verde** la retta deve dare `κ ≈ 1` e
`intercetta ≈ 0` — i distacchi in verde evolvono dal passo, non convergono a niente. Se il
verde desse un pavimento, il metro starebbe misurando un artefatto del binning.

## Il cancello

**Le stesse C1–C4 della PREREG-1 e della PREREG-2.** Il metro non cambia fra le ipotesi, o
i tre esiti non sarebbero confrontabili.

| | condizione |
|---|---|
| **C1** | `\|bias\|` scende su tutti e tre gli orizzonti, sui congelamenti con regime |
| **C2** | `\|bias\|` scende in almeno 7 gare su 8 giudicabili (blocchi = gare) |
| **C3** | i congelamenti **verdi** restano identici AL BIT |
| **C4** | M5 sui casi con regime non cala di più di 2 punti |

**Più una condizione che questa volta va scritta**, perché è il modo esatto in cui la
PREREG-2 è morta:

| **C5** | nessuna gara giudicabile deve **peggiorare di più di 0,5 s/giro**. Un pacchetto che aggiusta la media rovinando tre gare non è una correzione: è uno scambio, e va visto come tale |

## Cosa fa dichiarare NULL

- una fra C1–C5 non regge, o la sonda a `κ = 1` non riproduce il motore attuale;
- il controllo in verde dà un pavimento `g∞` distinguibile da zero: metro rotto;
- `g∞` stimato è **negativo** — un distacco di coda negativo non esiste, e vorrebbe dire
  che la forma non descrive questi dati;
- l'IC95 di `κ` contiene 1, cioè «nessuna convergenza» resta possibile.

## Cosa NON dimostrerà

- **Non risolve M5**, e resta vero che 70 casi su 84 fuori banda partono in verde e
  finiscono neutralizzati.
- **Il ramo Safety Car su M1 resta n = 17.**
- Se passasse, sarebbe la **terza** ipotesi provata sullo stesso fenomeno con lo stesso
  metro. Tre tentativi sullo stesso campione consumano gradi di libertà: il risultato va
  letto come promettente, non come stabilito, e il fuori campione del 23 agosto conta
  doppio.

## ESITO della PREREG-3 — 01/08/2026: **NULL**, per una condizione che avevo scritto io

`g∞` viene **negativo** in entrambi i regimi — SC **−5,38 s** (IC95 [−38,77; +1,84]),
VSC **−10,51 s** — e la PREREG-3 dichiara: «`g∞` negativo vuol dire che la forma non
descrive questi dati». Un distacco di coda negativo non esiste. **NULL**, senza nemmeno
arrivare al cancello.

E l'IC di SC va da −38,8 a +1,8: il pavimento non è solo negativo, **non è identificato**.

### Le dieci fasce dicono perché — e correggono l'ipotesi

| gap(k) → gap(k+1) sotto SC | rapporto |
|---|---|
| 1,80 → 1,33 | 0,737 |
| 4,29 → 2,93 | 0,684 |
| 7,01 → 5,45 | 0,777 |
| 10,02 → 7,36 | 0,734 |
| 13,00 → 9,28 | 0,714 |
| 16,32 → 11,08 | 0,679 |
| 19,96 → 14,86 | 0,744 |
| 24,66 → 17,00 | 0,689 |
| 42,56 → 18,85 | 0,443 |
| 116,50 → 88,98 | 0,764 |

**Il rapporto è costante.** Otto fasce su dieci stanno fra 0,68 e 0,78, e — la cosa che
conta — **anche la fascia più piccola comprime**: 1,80 s diventa 1,33 s. Non c'è nessun
pavimento a cui il campo converge, nell'intervallo che i dati coprono.

**Quindi la forma moltiplicativa della PREREG-2 era GIUSTA**, e la mia ipotesi del
pavimento era sbagliata. Averla scritta prima di misurarla è l'unica ragione per cui
adesso lo so.

### Allora perché la PREREG-2 aveva fallito C2?

Non per la forma. **Per la finestra.** La compressione si applica per un numero di giri
*deterministico* — la persistenza misurata, 2 giri sotto SC — ma la persistenza è una
**distribuzione**: dato SC al giro L, il regime è ancora in corso al **57%** a L+2. Nel
restante **43% dei casi si comprime un campo che era già ripartito**, e si comprime del
28% a giro: è esattamente l'overcorrezione osservata, ed è più forte dove il bias era
piccolo perché lì non c'era niente da correggere.

Il difetto non è `κ`. È che una durata aleatoria viene trattata come una durata certa.

### La quarta ipotesi, che NON si prova adesso

La direzione che questi numeri indicano è comprimere **in attesa**: al giro L+k il regime
è ancora in corso con probabilità `p(k)` (misurata: 78% a L+1, 57% a L+2, 38% a L+3), e il
distacco atteso è `gap·[p(k)·κ + (1−p(k))·1]` invece di `gap·κ`. Nessun parametro nuovo —
`p(k)` è già misurato in questa stessa vista.

Ma è **la quarta ipotesi sullo stesso fenomeno con lo stesso metro e lo stesso campione**,
e va detto forte: a questo punto i gradi di libertà spesi sono tanti. Va scritta la sua
prereg, e soprattutto va deciso **se abbia ancora senso decidere in casa** o se questa
voce debba aspettare il fuori campione del 23 agosto. Quella è una domanda per il PO, non
per me.

---

# PREREG-4 — comprimere in ATTESA, non con certezza

*Scritta il 01/08/2026 PRIMA di implementare e misurare. Quarta ipotesi sullo stesso
fenomeno.*

## Prima di tutto: quanti tentativi sono, e cosa vuol dire

Questa è la **quarta** ipotesi sullo stesso fenomeno, con lo stesso metro, sullo stesso
campione di 11 gare. Va scritto in cima e non in fondo, perché è il fatto che più
condiziona come si legge l'esito.

**Il PO ha deciso di provarla** (01/08): serve qualcosa online prima di Zandvoort. La
decisione è legittima e sta scritta. Ma la conseguenza va scritta con la stessa forza:
**se questa passa, non è «stabilita» — è promettente.** Quattro tentativi consumano gradi
di libertà, e nessun cancello in casa può restituirli. Il fuori campione del 23 agosto non
è un di più: è l'unica cosa che potrà dire se questo termine è vero.

## L'ipotesi

La PREREG-2 ha fallito perché tratta una durata **aleatoria** come certa: comprime per 2
giri sotto SC, mentre a L+2 il regime è ancora in corso solo nel **57%** dei casi. Nel
restante 43% comprime del 28% a giro un campo che era già ripartito.

La correzione non ha parametri nuovi: si comprime **per quanto ci si aspetta**.

```
κ_eff(k) = p(k)·κ + (1 − p(k))·1        applicato al giro L+k
```

`p(k)` è la probabilità che il regime osservato al giro L sia **ancora in corso** a L+k, ed
è già misurata su questa stessa vista: sotto SC **0,777 · 0,572 · 0,384 · …**, sotto VSC
**0,518 · 0,187 · …**. `κ` è quello della PREREG-2, misurato e invariato.

Se il regime è in corso si comprime di `κ`; se è finito il distacco evolve dal passo
(`κ = 1`). `κ_eff` è la media delle due, pesata da quanto ci si crede.

**Non è un parametro in più: è un parametro in meno.** Sparisce la finestra `fino`, che era
una soglia scelta con una regola («finché ≥ 50%»). Qui non c'è nessuna soglia: la
compressione si spegne da sola man mano che `p(k)` scende.

**Regola dichiarata per l'orizzonte:** si applica finché `p(k) ≥ 0,05`, con un tetto di 8
giri — che è il limite entro cui `p(k)` è stata misurata. Oltre non si estrapola: sarebbe
inventare la coda di una distribuzione che non si è guardata.

## Il cancello

**Le stesse C1–C5**, e non si toccano: sono ciò che rende confrontabili quattro esiti.

| | condizione |
|---|---|
| **C1** | `\|bias\|` scende su tutti e tre gli orizzonti, sui congelamenti con regime |
| **C2** | `\|bias\|` scende in almeno 7 gare su 8 giudicabili (blocchi = gare) |
| **C3** | i congelamenti **verdi** restano identici AL BIT |
| **C4** | M5 sui casi con regime non cala di più di 2 punti |
| **C5** | nessuna gara giudicabile peggiora di più di **0,5 s/giro** |

**Sonda obbligatoria:** con `p(k) = 0` per ogni `k` — cioè «il regime è sempre già finito»
— il motore deve riprodurre **esattamente** i numeri di oggi. È la stessa sonda di κ = 1,
espressa nella grammatica nuova.

## Cosa fa dichiarare NULL

- una fra C1–C5 non regge, o la sonda non riproduce il motore attuale;
- il bias aggregato **cambia segno** su un orizzonte: sarebbe di nuovo overcorrezione, solo
  più piccola, e vorrebbe dire che la pesatura non basta;
- `κ_eff` esce dall'intervallo `[κ, 1]` per qualche `k`: sarebbe un errore di codice, non
  un'ipotesi sbagliata.

## Cosa NON dimostrerà, comunque vada

- Non risolve M5; i 70 casi su 84 che partono in verde e finiscono neutralizzati restano
  fuori portata dell'informazione ammessa.
- Il ramo Safety Car su M1 resta **n = 17**.
- **E soprattutto: non sarà fuori campione.** Vedi la prima sezione.

## ESITO della PREREG-4 — 01/08/2026: **NULL**, e l'errore è mio

```
C1  |bias| scende su tutti e tre gli orizzonti     FALLISCE (scende solo a 3 giri)
      3 giri  +1,6213 -> -1,2535    5 giri  +0,7528 -> -1,7292    10 giri  +0,4418 -> -1,2865
C2  scende in >= 7 gare su 8                       FALLISCE (1 su 7)
C3  congelamenti verdi identici AL BIT             PASSA
```

Peggiore della PREREG-2 su ogni riga. E non perché l'idea fosse sbagliata: **perché la
formula che ho pre-registrato è matematicamente sbagliata.**

### L'errore, per esteso

Avevo scritto `κ_eff(k) = p(k)·κ + (1 − p(k))`. È l'attesa del **rapporto di un singolo
giro**. Ma il distacco dopo `k` giri è il **prodotto** dei rapporti, e

```
E[ κ₁ · κ₂ · … · κₖ ]  ≠  E[κ₁] · E[κ₂] · … · E[κₖ]
```

quando gli eventi sono correlati — e qui lo sono al massimo grado possibile: **se la Safety
Car c'è al giro 3, c'era anche al 2**. La durata è una variabile sola, non `k` monete
indipendenti.

La conseguenza si vede nei numeri: moltiplicando otto κ_eff che tendono a 1 si continua a
comprimere (0,95 · 0,96 · 0,97 …) molto dopo che il regime è rientrato. La compressione
totale su 8 giri arriva a **0,42**, più forte dei 2 giri secchi della PREREG-2 (0,478) —
esattamente il contrario di quello che l'ipotesi voleva fare.

### La forma corretta, che esce dagli stessi numeri

Se il regime dura `D` giri, il distacco dopo `k` è `gap · κ^min(k,D)`. L'attesa è

```
E(k) = p(k)·κᵏ + Σ_{d<k} [ p(d) − p(d+1) ] · κᵈ        con p(0) = 1
```

e il rapporto da applicare al giro `k` è `κ_eff(k) = E(k) / E(k−1)`. Nessun parametro
nuovo: `p(k)` e `κ` sono gli stessi, già misurati. Quando `p → 0`, `E(k)` si ferma e
`κ_eff → 1` **esattamente**: la compressione smette invece di proseguire smorzata.

Compressione totale con la forma corretta: **~0,58**, contro 0,42 (mia, sbagliata) e 0,478
(PREREG-2). È *meno* compressione di tutte e due — che è la direzione in cui il difetto
misurato chiedeva di andare.

---

# PREREG-5 — la stessa ipotesi, con l'algebra giusta

*Scritta il 01/08/2026 subito dopo l'esito della PREREG-4 e PRIMA di misurare.*

**Questa non è un'ipotesi nuova: è la PREREG-4 con l'errore corretto.** La distinzione è
importante e non è un cavillo — ritoccare `κ` finché un cancello passa è pescare; correggere
`E[Πκ] ≠ ΠE[κ]` è riparare un conto sbagliato. Se il risultato migliorasse per una ragione
diversa da questa, si vedrebbe: la forma corretta comprime **meno** ovunque, in modo
prevedibile e verificabile prima di guardare il bias.

**Forma:** `κ_eff(k) = E(k)/E(k−1)` con `E(k)` come sopra.
**Parametri:** nessuno di nuovo — `κ` dalla PREREG-2, `p(k)` dalla stessa vista.
**Cancello:** le stesse **C1–C5**. Non si toccano.
**Sonde obbligatorie, entrambe verificabili senza guardare il bias:**
1. `κ_eff(k) ∈ [κ, 1]` per ogni `k` — fuori da lì è un errore di codice;
2. `κ_eff(k) → 1` quando `p(k) → 0`, e la compressione **cumulata** deve convergere a un
   valore finito invece di continuare a scendere.

**NULL se:** una fra C1–C5 non regge; una delle due sonde fallisce; oppure il bias cambia
segno su un orizzonte.

**E resta scritto:** è il **quinto** passaggio sullo stesso campione. Comunque vada, il
23 agosto conta più di tutto quello che c'è qui sopra.

## ESITO della PREREG-5 — 01/08/2026: **NULL**. E qui la voce si ferma.

```
C1  FALLISCE (scende solo a 3 giri)   3g +1,6213 -> -1,1972 · 5g +0,7528 -> -1,6480 · 10g +0,4418 -> -1,2129
C2  FALLISCE (1 gara su 7)
C3  PASSA (12.237/12.237)
```

Correggere l'algebra ha spostato i numeri di pochi centesimi. **L'errore matematico non
era la causa del fallimento** — era un errore vero, ed è giusto averlo corretto, ma la
voce non moriva di quello.

### I quattro tentativi, in fila

| ipotesi | forma | gare in cui il bias scende |
|---|---|---|
| PREREG-1 | slegare il regime dalle soste | **no-op**: 0 differenze su 821 righe |
| PREREG-2 | `gap·κ`, finestra 2 giri | **4 su 7** — la migliore |
| PREREG-3 | `g∞ + (gap−g∞)·κ` | NULL prima del cancello: `g∞` negativo |
| PREREG-4 | media dei rapporti (formula sbagliata) | 1 su 7 |
| PREREG-5 | attesa corretta `E(k)/E(k−1)` | 1 su 7 |

**Il segnale è coerente e va nella direzione opposta a ogni raffinamento:** la variante
migliore è quella che comprime **meno giri** (PREREG-2, due). Ogni versione che allunga la
finestra — anche smorzandola correttamente — peggiora.

**E tre gare peggiorano SEMPRE, in tutte le varianti:** Belgio (0,16), Canada (0,29), Gran
Bretagna (0,17). Sono quelle che partivano quasi giuste. Qualunque compressione le rovina,
e il bias aggregato cambia segno in ogni variante: il modello **sovracorregge di sistema**,
non per una scelta di finestra.

### Cosa dice questo, onestamente

La compressione è un fenomeno **reale e grande** — misurato su 71 gare, IC95 che esclude 1,
e dove il bias è grosso lo dimezza. Ma applicarla con un κ misurato sul fondo, uniforme per
regime, **sbaglia il bersaglio del prodotto** su questo campione. Quattro riformulazioni non
l'hanno spostato.

Continuare vorrebbe dire cercare la quinta forma finché una passa. A quel punto il cancello
non misurerebbe più niente — e sarebbe passato con il rumore di undici gare, tre settimane
prima dell'unica gara che potrebbe dire se è vero.

**La voce 2 si ferma qui.** Tutto spento in produzione. Il meccanismo resta costruito e
sentinellato: `κ` per giro nel kernel, `s30` con quattro mutazioni provate, i tre blocchi
misurati che si ri-stimano a ogni gara. Se dopo Zandvoort il fenomeno si vedrà anche fuori
campione, non ci sarà niente da costruire — solo da accendere.

---

# PREREG-6 — la popolazione, non i parametri

*Scritta il 01/08/2026 PRIMA di misurare qualunque cosa di questa ipotesi, e prima di
guardare quali gare soddisfano il criterio. È l'unica sequenza che la rende una prova.*

## L'ipotesi, e perché non è tuning

Tre gare peggiorano in **tutte e quattro** le varianti provate: Belgio (bias 0,16), Canada
(0,29), Gran Bretagna (0,17). Ritoccare κ finché smettono di peggiorare sarebbe pesca. Ma
c'è un'altra spiegazione possibile, di natura diversa: **che quei congelamenti non siano
neutralizzazioni del campo**.

`regimeDiCella` legge lo status **della singola auto**. Uno status `4` o `6` su una macchina
sola non è una Safety Car: può essere una gialla di settore, una bandiera locale, un
artefatto del feed. La compressione dei distacchi è un fenomeno del **campo intero** — il
campo si incolonna — e applicarla quando il campo non è neutralizzato è sbagliato per
costruzione, non per taratura.

**Se l'ipotesi è vera, non si cambia nessun parametro: si cambia dove il termine si
applica.**

## Il criterio, dichiarato adesso

> Un congelamento al giro `L` è una **neutralizzazione di campo** se **almeno il 50%** delle
> auto con una cella al giro `L` sono sotto regime.

**Perché 50% e non un altro numero:** una Safety Car vera neutralizza *tutti*. La
maggioranza assoluta è la soglia più generosa che si possa chiamare «campo» senza
inventare, e non è stata scelta guardando dove cadono le tre gare — questo documento è
scritto prima di misurarlo, ed è la ragione per cui esiste.

**Si applica in DUE posti, non uno:**
1. alla **stima di κ** sul fondo: le coppie entrano solo se il campo era neutralizzato;
2. all'**applicazione** nel costruttore: si comprime solo se al congelamento il campo lo è.

Misurare su una popolazione e predire su un'altra è la stessa famiglia di errore di E16.

## Il cancello

**Le stesse C1–C5.** Non si toccano, per la quinta volta.

Il termine è quello della **PREREG-2** — `gap·κ` sulla finestra di persistenza — che è
stata la variante migliore. Non si prova una forma nuova: si prova la **stessa forma su una
popolazione diversa**.

## Cosa fa dichiarare NULL

- una fra C1–C5 non regge;
- il criterio non separa: se ≥ 90% dei congelamenti con regime risultassero già «di campo»,
  l'ipotesi non ha niente da spiegare e va scritto che non l'aveva;
- κ ristretto al campo non è distinguibile da κ pieno (IC95 che si sovrappongono quasi del
  tutto) **e** il cancello continua a fallire: allora la restrizione non era il problema.

## La verifica che rende questa una prova, e non una storia

Dopo aver misurato, si guarda **se Belgio, Canada e Gran Bretagna sono davvero quelle con
la quota più bassa di campo neutralizzato**. Se lo sono, l'ipotesi ha predetto qualcosa che
non sapeva. **Se non lo sono, l'ipotesi è sbagliata anche se il cancello passasse**, e va
scritto — perché vorrebbe dire che il criterio ha aggiustato i numeri per una ragione
diversa da quella dichiarata.

## ESITO della PREREG-6 — 01/08/2026: **NULL per la lettera del cancello**, e il cancello è mal specificato

```
C1  |bias| scende su tutti e tre gli orizzonti          PASSA
      3 giri  +1,7903 -> -0,0208    5 giri  +0,9113 -> -0,2048    10 giri  +0,5783 -> -0,0549
C2  |bias| scende in >= 7 gare su 8                     FALLISCE (5 su 8)
C3  congelamenti verdi identici AL BIT                  PASSA (12.921 su 12.921)
C5  nessuna gara peggiora di oltre 0,5 s/giro           PASSA (nessuna peggiora affatto)
```

**Il bias aggregato va praticamente a zero** su tutti e tre gli orizzonti. Nessuna
riformulazione precedente c'era arrivata vicino: la migliore (PREREG-2) ribaltava il segno
a −0,79.

### Le tre gare che «falliscono» C2 hanno numeri IDENTICI

| gara | spento | acceso |
|---|---|---|
| Belgio | 0,1646 | 0,1646 |
| Canada | 0,2915 | 0,2915 |
| Gran Bretagna | 0,1715 | 0,1715 |

Non peggiorano: **il termine non si applica**, perché quei congelamenti non sono
neutralizzazioni di campo. C2 conta «scende» come *strettamente minore*, quindi una gara in
cui il termine si astiene correttamente risulta un fallimento.

**C2 è mal specificato**, ed è lo stesso difetto della condizione «sistematicamente» della
voce 4: mescola «il termine funziona dove agisce» con «il termine agisce ovunque». Un
termine che si astiene dove non deve applicarsi è un termine che funziona.

**Ma non lo riscrivo adesso.** Un cancello riscritto dopo averne visto l'esito non misura
più niente (E08), e questo è il quinto passaggio sullo stesso campione. Va a referto così
com'è: **NULL per la lettera**.

### La verifica dell'ipotesi: confermata a metà, e va detto

La PREREG-6 imponeva di controllare **dopo** se Belgio, Canada e Gran Bretagna fossero
davvero quelle con meno campo neutralizzato. Misurato, quota mediana del campo sotto regime:

| Canada | Spagna | Ungheria | Gran Bretagna | Austria | Australia | **Belgio** | Cina | Giappone | Miami | Monaco |
|---|---|---|---|---|---|---|---|---|---|---|
| 33,3% | 38,9% | 45,7% | 46,3% | 75,6% | 94,4% | **100%** | 100% | 100% | 100% | 100% |

**Canada e Gran Bretagna sì** — le due più basse, entrambe sotto soglia, previste prima di
guardare. **Belgio no: è al 100%.** L'ipotesi ha predetto due gare su tre, e la terza la
contraddice. Va scritto, perché la prereg diceva che se non fossero state quelle
l'ipotesi sarebbe sbagliata anche a cancello passato.

### Un risultato collaterale che vale da solo

κ ristretto alle neutralizzazioni di campo: **SC 0,691 → 0,697** (invariato), ma
**VSC 0,930 → 0,979** con n da 1.511 a 1.107. **Buona parte della «compressione VSC» era
artefatto di gialle locali**, non un fenomeno di campo. È una correzione al numero
depositato, indipendente da come finisce questa voce.

### Cosa serve per chiudere

Un **C2 scritto bene** — «il bias scende nelle gare in cui il termine si applica, e non
peggiora in nessuna» — pre-registrato e valutato **fuori campione a Zandvoort**. Non su
questi undici. Quello sì che sarebbe una prova.
