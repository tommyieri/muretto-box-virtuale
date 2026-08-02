# PREREG — VOCE 6: «vince il nuovo» regge fino alla bandiera?

**Scritta il 02/08/2026, PRIMA di misurare, e committata PRIMA che lo strumento
esista.** Ultima voce aperta di `PIANO_CORREZIONE.md`.

## La domanda, e perché non è accademica

Il verdetto in vigore — «vince il nuovo» — è **una metrica sola (M1), letta a due
giri dal congelamento**. M2 si ferma a 10. **La pagina pubblica fino alla bandiera,
a ~58 giri.** Fra i 10 misurati e la bandiera non c'è nessuna misura, e il prodotto
vive proprio lì.

Se il nuovo vince a due giri e perde alla bandiera, non è il banco a essere
sbagliato: è la pagina.

## Prima cosa: i numeri del piano sono scaduti, e si correggono qui

Il piano dice «il verdetto poggia su 5 casi su 223». **Non è più vero.** Rieseguito
il 02/08, dopo la voce 4 (`MIN_GIRI_BASE` 8→4, che ha portato i muti del nuovo da 14
a 2):

| | referto | oggi |
|---|---|---|
| casi appaiati | 223 | **235** |
| M1 lettura terna comune, esatti | 96 vs 101 | **100 vs 107** |
| margine | 5 casi | **7 casi** |
| test dei segni appaiato | — | **35-13, p = 0,0021** |
| bootstrap Δesatti (blocchi = gare) | — | **+2,98 pt, IC95 [0,00; +5,50]**, nuovo migliore nel 97,4% |
| M5 | FALLITO 67,3% | **PASSA 83,1%** |
| M4 | FALLITO su n=12 | **vuoto**: zero casi persi, cancello non calcolabile |

È E22 in atto (numeri pubblicati e mai rimisurati dopo un fix), e va corretto nel
piano insieme a questa misura.

## Il vincolo che decide la forma dell'esperimento

**Il motore vecchio sa fare UNA SOSTA SOLA.** `evaluatePit` prende un `pitLap`
scalare e costruisce `pits` da sé (`demo/pitscenario.mjs:154`); non esiste un
ingresso per un piano. Sui 193 piloti classificati, **114 (59%) hanno fatto da 2 a 7
soste**.

E non si aggira aprendo una porta nuova: nel percorso che il banco usa
(`passo = null`) **una seconda sosta non azzera l'età gomma** — `fermi` è un Set e
chi si è fermato ci resta (`demo/gradino.mjs:153`). Un vecchio esteso al multi-sosta
misurerebbe **un motore che nessuno spedisce**, con una fisica sbagliata. Sarebbe una
risposta peggiore del non rispondere.

→ **Il perimetro sono i piloti a UNA SOSTA.** Dichiarato, contato nel referto, e
dichiarato anche il 59% che resta fuori. Non è il perimetro che volevo: è quello che
esiste senza fabbricare niente.

## Le condizioni, dichiarate

**Congelamento adattivo e IDENTICO per i due motori**: il primo giro ≥ 5 in cui
**entrambi** hanno un passo base. Serve perché il passo del vecchio è per-stint (≥3
giri verdi dello stint corrente) e crolla dopo le soste: a Lf=15 in Australia ha 8
piloti contro i 20 del nuovo. Se i due scivolano su giri diversi il confronto non è
più appaiato **e nessuno se ne accorgerebbe**, perché entrambi rispondono `ok`.

**Il vecchio in configurazione di PRODUZIONE**: `passo = v2`, come lo accende il
pannello (`demo/muretto.mjs:285-291`), non `passo = null` come fa il banco. Su ~55
giri proiettati un passo piatto senza carburante né degrado non è il motore vecchio:
è nessun motore. Si riporta **anche** la variante `passo = null`, perché è quella su
cui M1 ha dato il verdetto in vigore, ma la **primaria è la produzione**.

**byLap TRONCATO a Lf per entrambi.** Col byLap intero il vecchio riapre E15 (il
gradino legge fino a L+5) e, con orizzonte lungo, accende `sotto_neutralizzazione`
in 212 casi su 235 invece di 0. Troncato, il futuro che legge è **zero**.

**Nessuna sosta dei rivali, per nessuno dei due.** Il vecchio non può riceverle
(`pianiRivali` non esiste nella sua firma); darle solo al nuovo misurerebbe
l'informazione, non i motori. Il piano immaginava di darle a entrambi: non si può,
e si dichiara.

**Orizzonte calcolato a mano**: `nGiri − pitLap − 1`. `evaluatePit` **non ha freno**
— con orizzonte 200 su una gara da 58 giri simula fino al giro 210 e risponde `ok`
(verificato). E se `pitLap` non è un numero, `steps` diventa `NaN`, il ciclo non gira
mai e restituisce **`ok: true` con l'ordine al congelamento spacciato per
previsione**. Lo strumento deve rifiutarsi rumorosamente in entrambi i casi.

## Il metro

Stesso della M1, spostato alla bandiera. `errore = posizione prevista al giro finale
− posizione finale vera`, dove:

- **verità** = ordine dei classificati per `pos_finale` da `data/arrivi_2026.csv`
  (fonte indipendente dal byLap che i motori leggono);
- **ri-classificazione sulla TERNA COMUNE** verità ∩ vecchio ∩ nuovo, con
  `riclassifica()` di `banco.mjs` — **la funzione, non una copia**. (Oggi M1a, M1b,
  M4 e M5 se la riscrivono in casa: i numeri coincidono, ma la regola 1 è chiusa a
  metà, e questa misura non aggiunge una sesta copia.)

Nota di nomenclatura, perché nel repo le lettere confondono: ciò che M1a chiama
«lettura B» è la terna comune, che M1b chiama «B2». Qui la lettura si nomina con la
**definizione**, mai con la lettera.

## Il verdetto è a TRE ESITI, non un cancello passa/non passa

La domanda è «regge il verdetto», e «indistinguibile» è una risposta vera quanto le
altre due. Statistica: **test dei segni appaiato** sui casi discordanti, più
bootstrap a blocchi = gare (10.000 giri, seme fisso) sulla differenza di esatti.

| esito | condizione | conseguenza, decisa adesso |
|---|---|---|
| **REGGE** | il nuovo ha più esatti e il test dei segni dà **p < 0,05** a suo favore | il verdetto vale anche alla bandiera: si scrive nel referto e la pagina è coperta |
| **SI ROVESCIA** | il vecchio ha più esatti con **p < 0,05** | **il verdetto in vigore non vale dove il prodotto lo usa.** Va scritto in cima al referto e al piano, e la decisione su cosa spedire torna al PO |
| **INDISTINGUIBILE** | nessuno dei due, oppure IC95 che contiene lo zero | il verdetto «vince il nuovo» **resta vero solo a due giri**, e si dichiara che oltre non è stato dimostrato. Nessuna delle due pagine è giustificata dai dati |

**NON ESEGUIBILITÀ**: meno di **30 casi appaiati**. Sotto, si dichiara che coi dati
esistenti la domanda non si risponde.

## Le asimmetrie che NON si chiudono, e vanno lette coi risultati

Restano, e sono la ragione per cui questo confronta **i due motori come sono
spediti**, non due modelli ideali:

1. **Pit-loss diverso**, fino a **5,04 s** sulla stessa gara (Canada: nuovo 19,327 ·
   vecchio 24,37; Belgio 18,40 · 23,36). I due leggono prior diversi.
2. **Il passo del vecchio è a serbatoio vuoto** e `simulate` non lo ri-aggiunge
   (E02, regola 10). Su 2 giri si cancellava nel distacco; su ~55 no.
3. **Il campo del vecchio resta congelato**: nessun rivale si ferma, nessun
   meccanismo di neutralizzazione (troncato). Il nuovo ha entrambi.
4. **Popolazione fissa al congelamento** per il vecchio: nessun ritiro, nessun
   doppiaggio. La ri-classificazione sulla terna comune assorbe la differenza di
   denominatore, non quella di fisica.
5. **Circolarità in campione da entrambe le parti**: `modello_v2` e la banda sono
   tarati sulle stesse 11 gare. Vale per tutto questo confronto, e il primo fuori
   campione vero resta il **23 agosto**.

## Cosa NON si fa

- **Non si estende il motore vecchio** al multi-sosta. Un motore che nessuno spedisce
  non è il motore vecchio.
- **Non si toccano coefficienti** in base a questi numeri.
- **Non si sposta la soglia** dopo aver visto l'esito, e non si cambia statistica.
- **Non si usa `--rivali`** su un solo motore.

---

# ESITO — misurato il 02/08/2026, e riscritto dopo la verifica avversariale

`node ai_lab/confronto/voce6_bandiera.mjs` · 79 casi appaiati (piloti a una sosta).

## 1. Il risultato, coi cancelli scritti prima

| braccio | esatti nuovo | esatti vecchio | appaiato | segni | IC95 Δesatti | esito |
|---|---|---|---|---|---|---|
| **primario** — vecchio nell'**ultima configurazione spedita** (passo=v2) | 23/79 | 22/79 | 16 · 15 · 48 pari | 1,0000 | [−6,60; +12,50] | **INDISTINGUIBILE** |
| **secondario** — passo piatto e gradino assente | 23/79 | 18/79 | 37 · 18 · 24 pari | 0,0145 | [−8,86; +19,15] | **INDISTINGUIBILE** |

## 2. LA MISURA CHE MANCAVA, ed è la più severa

**Alla bandiera nessuno dei due motori batte il non-fare-niente.** Il modello nullo
(«l'ordine al congelamento non cambia più»), ri-classificato sulla stessa terna:

| | esatti | appaiato contro il nullo |
|---|---|---|
| **nullo** | **24/79** | — |
| nuovo | 23/79 | vince 23, **perde 29** |
| vecchio spedito | 22/79 | vince 24, **perde 28** |
| vecchio passo piatto | 18/79 | vince 19, **perde 39** |

A ~51 giri proiettati **la metrica non ha risoluzione**. Il confronto fra motori a
quell'orizzonte non decide niente, **in nessuna configurazione** — è E16, un ottimo
misurato dove il fenomeno non c'è. È la stessa conclusione a cui era arrivata
`PREREG_gara_intera_2.md` per un'altra strada, e questa è la seconda conferma.

## 3. Cinque cose che avevo scritto male, tutte a referto

**(a) Un difetto dello strumento contro la mia stessa prereg.** La tabella dei tre
esiti dice INDISTINGUIBILE anche quando *«l'IC95 contiene lo zero»*. La funzione
`esito()` decideva col **solo test dei segni** e non guardava mai l'IC che aveva
appena calcolato: stampava **REGGE** dove la prereg dice INDISTINGUIBILE. Corretto,
e il secondario è passato da REGGE a INDISTINGUIBILE. Uno strumento che esegue una
prereg diversa da quella dichiarata è peggio di uno che non la esegue.

**(b) «Produzione» era falso di due giorni.** Dal 31/07 **nessuna pagina chiama più
`evaluatePit`** (verificato da me: `gara.html:3`, `live.html:96`/`409` e
`live_bylap.mjs:3` sono **commenti** scaduti, non import). Il motore vecchio non gira
più da nessuna parte. La configurazione misurata resta quella giusta — è **l'ultima
mai spedita** — ma chiamarla «produzione» oggi è E22, e l'etichetta è stata cambiata.

**(c) Il nesso causale che avevo scritto NON è dimostrato, ed è smentito.** Avevo
scritto: *«tutto il margine sparisce quando il vecchio gira come gira davvero in
produzione»*. De-confondendo configurazione e orizzonte, **all'orizzonte del verdetto
(2 giri)**, rimisurato da me su 235 casi:

- passo=v2 e passo=null danno **lo stesso errore in 228/235 casi (97,0%)**;
- il nuovo batte il vecchio **spedito** 36-12, **p = 0,0007**;
- il nuovo batte il vecchio del banco 35-13, p = 0,0021.

**Il verdetto in vigore non è stato ottenuto contro un fantoccio: regge contro
entrambe le configurazioni, e regge meglio contro quella spedita.** La mia frase era
sbagliata. Quello che cambia alla bandiera non è la configurazione — è che a
quell'orizzonte nessuno batte il nullo.

**(d) Il braccio secondario non è la configurazione di M1.** Il congelamento adattivo
cade al giro 5 in 65 casi su 79, quando nessuna sosta è ancora avvenuta: `misura()`
torna `n_gradino = 0` e il gradino è **null in 79 casi su 79**, mentre nella
configurazione di M1 (congelamento = pitLap−1) è presente in **160 su 274**. È una
**terza configurazione**, che nessuno ha mai misurato e nessuno spedisce, in cui la
sosta è **pura perdita**: bias **+1,570 posizioni** contro −0,076 del nuovo, e
peggiore del nullo in 59 casi su 79.

**(e) Il perimetro è cieco su un regime.** I 79 non coprono **4 gare su 11**
(Austria, Gran Bretagna, Monaco, Spagna) — esattamente le gare a più soste — e
l'Ungheria ne dà 2. I blocchi del bootstrap sono **7, non 11**. Dentro i 79 il taglio
«alto degrado» ha n = 2: **su quel regime il verdetto non è mai stato misurato.**
Allargando il perimetro in due modi indipendenti che non toccano il motore vecchio
(stesso piano a una sosta per entrambi su tutti i classificati, 179 casi su 11 gare;
e troncamento al giro prima della seconda sosta, 100 casi) **il quadro si riproduce
identico**.

## 4. La risposta alla VOCE 6

**«Vince il nuovo» regge al suo orizzonte, e alla bandiera la domanda non è
rispondibile.**

- **A 2 giri** — l'orizzonte a cui la pagina pubblica la posizione di rientro — il
  verdetto **regge**, contro entrambe le configurazioni del vecchio, e più
  nettamente contro quella spedita (36-12, p = 0,0007). Il timore del piano, che il
  verdetto poggiasse su un motore azzoppato, **è infondato**.
- **Alla bandiera** il confronto **non decide**, perché nessuno dei due motori batte
  «non cambia niente». Non è che i motori siano uguali: è che **a quell'orizzonte la
  metrica non distingue nulla**, nemmeno un motore da nessun motore.

Ciò che resta scoperto non è la posizione — è la **curva del «quando»**, che integra
fino alla bandiera. Quella è territorio di M3, già misurata: vecchio spedito 77,0% di
minimi interni contro 66,2% del nuovo con la mescola legale.

## 5. Un filone, da pre-registrare e NON da usare adesso

Col perimetro allargato, nelle gare ad **alto degrado**, in configurazione spedita il
nuovo vince **18-7 (p = 0,043)**. È un taglio **scelto dopo aver visto i numeri**, e
il leave-one-race-out se lo mangia. Se il vantaggio del nuovo esiste è lì che va
cercato, ma serve una prereg che fissi **prima** il taglio, la correzione per
molteplicità e il fuori campione — il primo vero resta il **23 agosto**.

## 6. Cosa NON è stato toccato

Nessun coefficiente, nessuna soglia, nessun file di produzione. Lo strumento è stato
corretto in due punti (la clausola dell'IC, che era un difetto contro la prereg
stessa; e il modello nullo, che mancava), entrambi **prima** di scrivere questo
referto.
