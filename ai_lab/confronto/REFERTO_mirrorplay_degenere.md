# Referto — il mirror-play è degenere: non esiste come regola di reazione

**Data: 03/08/2026.** Scritto **prima** di pre-registrare l'esperimento e prima di
produrre un numero d'esito. Nessuna misura di prestazione è stata eseguita: l'esperimento
resta **non speso**.

---

## L'idea, e perché sembrava buona

Il mirror-play era la candidata più economica della famiglia «reazione dei rivali»:

> la reazione del rivale = **la raccomandazione che il motore stesso darebbe seduto dal
> lato del rivale**. Zero parametri nuovi, deterministico, e il banco unico era già stato
> costruito in Fase 1 apposta per giudicarla.

## Cosa si è scoperto guardando i PIANI, non gli esiti

Prima di misurare qualunque prestazione si sono guardati i piani che la regola produce. Al
congelamento tipico (Lf = 5, che copre 144 casi su 193), `pianoOttimo` dà a **tutti i
rivali la stessa identica sosta**:

| gara | rivali con piano | giri di sosta **distinti** |
|---|---|---|
| Australia | 20 | **1** (giro 29 per tutti e venti) |
| Austria | 18 | **1** (giro 36 per tutti e diciotto) |
| Ungheria | 22 | 2 (35 / 34) |

*(verificato due volte, in modo indipendente)*

**È la forma chiusa che lo impone**, non un caso: `m₁ = (R − a)/2` con `a` identico per
chiunque sia partito al giro 1 e `R` uguale per tutti. Il motore non ha nulla, al
congelamento, che distingua un rivale dall'altro ai fini del *quando* fermarsi.

## Le tre conseguenze, in ordine di gravità

**1 · Non è una regola per rivale.** Ha **un solo grado di libertà per gara**: il giro
comune L\*(gara). Chiamarla «mirror-play» in una prereg sarebbe **già una conclusione non
misurata** — il nome afferma una capacità (il motore modella il singolo avversario) che i
piani mostrano non esserci.

**2 · L'ordine fra i rivali si conserva esattamente come nell'identità.** Stesso giro,
stesso pit-loss: il campo si muove solo *rispetto al soggetto*. Qualunque effetto sarebbe
uno spostamento comune, mai una ri-classifica fra avversari.

**3 · Sul conteggio delle soste è più lontana dal vero dell'oracolo**: **0,98** soste per
rivale contro **1,97** reali. Non può quindi essere presentata come «l'oracolo senza
l'informazione dal futuro»: è un'altra cosa, e peggiore su ciò che si può confrontare.

## E due difetti di implementazione che l'avrebbero resa *sbagliata*, non solo debole

**(a) I piani si costruiscono al congelamento sbagliato.** `metricaBandiera` chiama
`regola.pianiRivali(g)` **una volta per gara**, mentre `corri` scende il congelamento da 5
a 15 **per caso**. Piani costruiti a Lf = 5 e caso che congela a 9 ⇒ le soste con
`giro ≤ freezeLap` vengono **scartate in silenzio** dal costruttore. Il Belgio, che a
Lf = 5 non produce alcun piano mentre i suoi casi congelano a 9 e 10, sarebbe girato
**interamente come regola-identità con l'etichetta mirror-play**.

Una misura così non è circolare: è **sbagliata, e in modo invisibile**.

**(b) N4 può cancellare la reazione senza che si veda.** Se il prior
`soste_rivali_sotto_regime` tornasse da `nessuna` a `stint1`, il ramo N4 del costruttore
sovrascriverebbe `pits[drv]` **dopo** il ramo `pianiRivali`, azzerando la reazione proprio
sotto SC e VSC. Una misura riletta dopo quel cambio direbbe una cosa diversa senza che
nessuno se ne accorga (E20).

## La decisione

**L'esperimento non si esegue e non si pre-registra sotto quel nome.** Non è una rinuncia
per prudenza: è che la cosa da misurare **non è quella che il nome dice**. Misurarla
adesso avrebbe prodotto un numero vero attribuito a una capacità inesistente — che è il
modo più elegante di sbagliare, e il più difficile da smontare dopo.

Il tentativo resta **non speso**.

## Cosa resterebbe misurabile, e cosa costerebbe

Esiste una domanda legittima dentro questa, ed è più piccola:

> «Fissare per ogni gara **un giro comune di sosta**, calcolato dal motore al congelamento,
> avvicina la proiezione al vero più di un giro a caso e più del giro di un'altra gara?»

È una domanda sulla F1, non sul motore, e per essere onesta richiede — **prima** di
qualunque numero:

1. **riparare la cucitura**: l'interfaccia delle regole deve diventare
   `pianiRivali(gara, freezeLap)`, e il banco va **ri-tarato** (con la regola-identità i
   numeri devono restare bit-identici: 235 → 36-12-187, p = 0,0007; 193 → 20-13, 24-14,
   13-28). Se non lo sono, non si misura niente;
2. **congelare N4** nella prereg, con l'hash del prior;
3. **due placebo, entrambi da battere** (il KPI F5 ne chiede uno, ma qui i gradi di libertà
   da spegnere sono due): uno di *livello* — gli stessi rivali si fermano lo stesso numero
   di volte, a giri casuali — e uno di *posizione* — il giro giusto, ma preso da un'altra
   gara. Il primo smaschera «conta solo che si fermino», il secondo «conta solo che ci sia
   un giro buono, non quale».

**Non apro quella prereg adesso**: è una domanda nuova, con un nome diverso, e va decisa
sapendo che non è la reazione dei rivali.

## Cosa questo referto NON dice

- Non dice che la reazione dei rivali sia una strada chiusa: dice che **questa** sua
  incarnazione non esiste. La causa n. 1 del tetto della fisica resta aperta.
- Non dice niente su F1: `evaluatePit` e `rispostaNuovo` non accettano `pianiRivali`, quindi
  la metrica a due giri — l'unica in cui il motore è davvero validato — non avrebbe potuto
  giudicare questa regola in nessun caso.
