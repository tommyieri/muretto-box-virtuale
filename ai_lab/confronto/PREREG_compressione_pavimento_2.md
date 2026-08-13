# Prereg 2 — il pavimento sulla compressione, giudicato contro la realtà

**Data: 14/08/2026.** Successore di `PREREG_compressione_pavimento.md`, il cui esito
(`ESITO_compressione_pavimento.md`) è **NULL per C2** e resta a referto.

Questa versione è la **terza scrittura**, dopo che cinque revisori avversariali indipendenti
hanno attaccato le prime due (verdetto unanime: EMENDARE). Tutti gli emendamenti sono
**precedenti al sigillo** e tutti vanno verso il più severo o il più preciso. Quelli che
hanno cambiato la sostanza sono elencati al §7, con il nome del difetto che li ha causati:
se un domani qualcuno rileggerà questo documento, deve vedere anche gli errori che ci sono
stati dentro.

---

## 0 · Cosa si sa già, e perché non conta come prova

La forma proposta è **la stessa** del primo tentativo, non una nuova. Si sa già che porta i
giri impossibili a zero, che il pavimento morde su circa un quarto dei giri compressi e che
i rifiuti sul contro-fattuale crollano. **Questi numeri sono noti, e per questo qui non
valgono come prova**: rimisurarli conferma che la forma è quella di allora, non scopre nulla.

**E c'è una cosa in più da dire, che i revisori hanno avuto ragione a pretendere.** D1, D2 e
D3(a) **non possono fallire se l'implementazione è fedele al §3**: un `max()` che non lega è
un no-op esatto, e un vincolo che agisce solo dentro il ramo della compressione non può
toccare altro. Non sono lì per scoprire qualcosa: sono lì per **fermare un'implementazione
infedele** — in particolare la degenerazione «pavimento come valore fisso», che passerebbe
D2 e D4 senza riparare niente. Chiamarli «la novità» sarebbe stato falso.

**L'unico cancello con vero potere di bocciare una riparazione corretta è D5.**

## 1 · Perché C2 non si riscrive, e cosa lo sostituisce

C2 chiedeva che i giri VERDI non si muovessero di un bit. È uscito rosso — 230 tempi verdi
diversi su 8.296 — e la riparazione è stata annullata. Poi la diagnosi ha mostrato **perché**:
il **tetto al movimento** gira sui giri verdi ed è order-dependent, quindi un campo meno
compresso gli fa decidere sorpassi diversi. Spegnendolo, i tempi verdi diversi erano **zero
su 2.947**.

Un cancello sul MOVIMENTO non sa distinguere «la riparazione è uscita dal perimetro» da «una
seconda meccanica ha reagito». Non si allarga: **si cambia domanda**.

- Il **perimetro** si prova dove il vincolo non lega, e con un campione vero (D1).
- La **reazione del tetto** non si vieta: si misura contro la realtà, che non è
  order-dependent e non si può tarare (D5) — e si misura **anche col tetto spento**, per
  separare il costo del pavimento da quello della reazione. Era la promessa esplicita
  dell'esito precedente, e senza il secondo braccio non sarebbe stata mantenuta.

## 2 · Il fondo, misurato il 14/08 PRIMA della riparazione

`node ai_lab/confronto/pavimento_gara_intera.mjs` — le 11 gare, ogni coppia pilota-gara,
strategia vera del soggetto, soste vere dei rivali, **finestre SC/VSC/rossa VERE** e ritiri
veri (gli ingressi di laboratorio che `migliora_strategia.mjs` usa già).

Il banco è nuovo e va detto perché: senza `neutralizzazioneVera` la compressione si accende
solo se il campo è neutralizzato al giro di congelamento (5-15), cioè quasi mai — i numeri
pubblicati di `gara_intera.mjs` **non toccano questo difetto**. Qui è accesa in 193 casi
su 193.

| | fondo |
|---|---|
| casi utilizzabili · saltati | **193** · 48, tutti «non classificato (RIT/NP)» dal CSV arrivi |
| giri compressi | **18.443** |
| **giri sotto il pavimento** | **5.815**, tutti dentro una finestra |
| giri di durata negativa | **24** (tutti a Monaco) |
| casi respinti dal Director | **0 su 193** — e va spiegato, vedi sotto |
| **piloti senza traccia** | **302** — il censimento è cieco lì, vedi sotto |
| G1 mediana \|errore\| | **1** |
| G2 quota entro ±3 posizioni | **87,6%** |
| G3 bias medio con segno | **−0,041** |
| G4 mediana \|errore\| del nullo | **1** (il motore **non** batte il nullo: pari) |
| \|errore\| medio del motore | **1,648** |
| movimento motore / reale | 9,35 / 12,01 |

| gara | sotto / compressi | | margine minimo al pavimento |
|---|---|---|---|
| Gran Bretagna | 1.526 / 3.258 | 46,8% | −70,297 s |
| Monaco | 1.421 / 2.923 | 48,6% | −99,621 s |
| Giappone | 1.220 / 2.520 | 48,4% | −26,531 s |
| Spagna | 680 / 1.479 | 46,0% | −2,233 s |
| Miami | 378 / 1.962 | 19,3% | −9,876 s |
| Cina | 293 / 923 | 31,7% | −13,804 s |
| Austria | 180 / 1.240 | 14,5% | −1,784 s |
| Ungheria | 95 / 760 | 12,5% | −0,658 s |
| Canada | 22 / 606 | 3,6% | −1,492 s |
| **Australia** | **0 / 2.048** | **0,0%** | **+1,863 s** |
| **Belgio** | **0 / 724** | **0,0%** | **+2,477 s** |

**Chi rifiuta questi giri, e chi no — detto con precisione.** Nel banco qui sopra il Director
**non** ne respinge nemmeno uno, e non è una contraddizione: FIS01 controlla solo i giri
**verdi** (`verde(dopo)` in `director.mjs`), e lì i giri compressi portano lo status vero
della gara, che verde non è. Dove il Director li rifiuta davvero è il percorso del
**contro-fattuale** (`stato_contro.mjs` → `rispostaLive`), in cui il giro eredita lo status
per-auto del giro vero: e lì lo status per-auto può essere `1` anche dentro una finestra
di campo, perché la finestra è una definizione **di campo** e lo status è **per auto**.
Verificato il 14/08: **17 rifiuti su 17 sono FIS01**, testualmente «giro verde sotto il
pavimento del circuito».

Quindi la frase «il kernel emette ciò che il suo stesso Director rifiuta» è vera **su un
percorso solo**. Ma il fatto che regge tutto non dipende da chi controlla: **un giro
percorso più in fretta del giro più veloce che qualcuno abbia fatto in quella gara non
esiste**, e a Monaco quei giri durano meno di zero secondi.

**Dove il censimento è cieco.** 302 tracce di pilota sono nulle (Canada 89, Monaco 81,
Belgio 36): chi esce a metà proiezione perde tutta la traccia, compresi i giri già percorsi.
Lo «zero» di D2 è quindi uno **zero visto**, e 36 di quelle cecità cadono dentro il campione
di controllo di D1. Il numero è nel referto del banco e va riportato in ogni esito: se
crescesse, i cancelli starebbero guardando meno gara senza accorgersene.

## 3 · La forma

```js
let delta = (capofila.c + g·κ) − m.c;                    // come oggi
if (pavimento !== null && delta < 0) {                   // il vincolo
  const minimo = pavimento − m.ultimoGiro.lap_time;
  if (delta < minimo) delta = Math.min(0, minimo);
}
```

Tre precisazioni che i revisori hanno avuto ragione a pretendere, e che non erano nel primo
tentativo:

1. **Il vincolo agisce solo su un delta negativo.** Un delta positivo è compressione che sta
   facendo *perdere* tempo, e lì il pavimento non ha voce. Il `Math.min(0, …)` chiude l'altro
   verso: se un giro fosse già sotto il pavimento **prima** della compressione, il vincolo
   annulla il regalo ma non aggiunge tempo che nessuno ha perso. «Non si inventa» vale in
   entrambe le direzioni.
2. **Il pavimento non è un parametro nuovo ma è un'interfaccia nuova.** Il numero è quello
   con cui il Director già rifiuta (`pavimenti_2026.json` meno `margine_pavimento_s`), ma il
   kernel oggi non ce l'ha e non ha da dove prenderlo. Viaggia dentro il **pacchetto
   neutralizzazione** — `{ perGiro, pavimento }` — costruito dal costruttore, che è l'unico
   proprietario (regola 1). Nessun nuovo argomento di `simulate()`.
3. **Spento è spento.** `pavimento` assente o `null` ⇒ il ramo non esiste e i numeri sono
   identici al bit, esattamente come `neutralizzazione: null` lo è già oggi. È una sonda
   obbligatoria (D6), della stessa famiglia che s30 sorveglia.

Il perimetro è quello della compressione, **non uno più stretto**: chi entra ai box in quel
giro è già escluso, il capofila è già escluso, un **out-lap non lo è** — il kernel non sa
cosa sia un out-lap, e il primo tentativo scriveva il contrario per distrazione.

Il recupero non consumato resta nel distacco: non si sposta, non si spalma. Non si tocca κ,
né il tetto, né il margine del Director.

## 4 · I cancelli, dichiarati prima

**D1 — il perimetro, dove il vincolo non lega.** Su **Australia e Belgio** (35 casi, 2.772
giri compressi, margine minimo +1,863 s e +2,477 s: nessun rischio che un bit di virgola
mobile faccia scattare il vincolo) l'impronta sha256 di **tutti** i tempi sul giro e i
cumulati di **tutti** i piloti, e con essa l'ordine d'arrivo, deve restare **identica**.
L'artefatto esiste già oggi ed è `perCaso[*].impronta` nel `--json` del banco: non lo si
sceglie dopo. Il tetto è dentro l'impronta, ed è il punto — vedendo lo stesso campo deve
decidere gli stessi sorpassi. **Una sola differenza: STOP.**

**D2 — nessun giro impossibile.** Su tutte e 11: **zero** giri sotto il pavimento (fondo
5.815) e **zero** di durata negativa (fondo 24), sulle tracce viste.

**D3 — la compressione resta compressione.** Il conto di quante volte il vincolo lega non si
deduce dall'esito (dopo la riparazione i giri sotto il pavimento sono zero **per
definizione**, e leggere lì il tasso di morso darebbe 0% a qualunque implementazione): lo
espone il **kernel**, con un contatore delle attivazioni del clamp restituito da `simulate()`.

- **(a) — cancello.** Sui giri compressi in cui il contatore dice che il clamp **non** ha
  legato, il rapporto deve essere esattamente quello di oggi: `gap_dopo = gap_prima · κ`
  entro **1e-9**, col distacco misurato contro l'auto che era capofila **prima** di avanzare,
  escludendo il capofila e chi entra ai box. Verificato sul fondo prima di scriverlo: **473
  su 473 esatti, scarto massimo 0**. Non è una tolleranza scelta: è un'identità algebrica
  del codice di oggi, e deve sopravvivere.
- **(b) — MISURA, non cancello.** Il tasso di attivazione del clamp si riporta e basta.
  **Non gli metto una soglia, e dico perché**: il fondo è al **31,5%** (5.815/18.443), quindi
  qualunque soglia la scriverei sapendo già da che parte sta il numero — è la definizione di
  cancello tarato, ed è il §6. **Previsione dichiarata adesso, falsificabile**: il tasso
  **salirà**, non scenderà. Il primo tentativo lo misurò salire (22,1% → 25,1%), e il
  meccanismo lo spiega: il recupero non consumato **resta nel distacco**, quindi al giro dopo
  c'è più distacco da comprimere e il vincolo lega di più. La motivazione opposta, scritta
  nelle prime due versioni di questa prereg, era sbagliata. Se il tasso salisse **oltre il
  50%** — cioè se il vincolo legasse più spesso di quanto non leghi — la lettura dichiarata
  è che **κ non è consegnabile in un giro su questi distacchi**, e quello è un risultato sul
  modello che va a referto: non si tara il pavimento per farlo sparire.

**D4 — il contro-fattuale interrogabile.** I rifiuti di `rispostaLive` sullo stato
contro-fattuale scendono **sotto il 5%**. Fondo rimisurato il 14/08: **17/64 = 26,6%**
(Ungheria/LEC 3/17 · Spagna/VER 8/16 · Miami/NOR 0/13 · Austria/HAM 6/18), e la causa è
verificata, non supposta: **17 su 17 sono FIS01**. È il cancello di PRODOTTO.

**D5 — ci si avvicina alla realtà, non ci si allontana.** Sui **193 casi appaiati**,
confrontati caso per caso sulla stessa chiave (gara/pilota).

- **(a) — il cancello vero.** I casi in cui \|errore\| **peggiora** non devono superare
  quelli in cui **migliora**. Due clausole che i revisori hanno avuto ragione a pretendere,
  perché senza di loro un non-risultato passava per vittoria:
  - **se le coppie discordanti sono meno di 20, l'esito è NULL, non verde.** Su errori interi
    la maggioranza dei casi sarà pari, e «3 migliora / 3 peggiora / 187 pari» non è una prova
    di niente. Il numero è dichiarato adesso, prima di vederlo.
  - **la popolazione deve restare la stessa**: 193 casi e 48 saltati, tutti per «non
    classificato». Se cambia, il confronto appaiato non è più appaiato e l'esito è NULL.
  Si riporta anche il p del test dei segni, che **non è un cancello**.
- **(b) — pavimento di sicurezza, non prova.** I tre limiti già pubblicati in
  `PREREG_gara_intera_2.md` — G1 ≤ 3 · G2 ≥ 60% · \|G3\| ≤ 1,5 — devono continuare a passare.
  Hanno un margine enorme sul fondo e quindi **non hanno vero potere di bocciare**: li scrivo
  per onestà del confronto, non per severità. Il quarto limite pubblicato lì, **G4 («batte
  strettamente il nullo»), oggi è già FALLITO** (1 contro 1) e non lo uso come cancello: sarebbe
  chiedere alla riparazione di guarire un difetto che non è suo. Ometterlo in silenzio, come
  facevano le prime due versioni, sarebbe stato peggio.
- **(c) — il secondo braccio, col TETTO SPENTO.** Lo stesso confronto appaiato girato con
  `tetto: null` in entrambi i bracci. Non è un cancello: è ciò che separa il costo del
  **pavimento** da quello della **reazione del tetto**, e senza di esso un D5(a) rosso non
  saprebbe dire di chi è la colpa — che è esattamente il buco del 13/08. Le due letture sono
  dichiarate qui: se col tetto spento migliora e col tetto acceso peggiora, il problema è il
  tetto e la prereg successiva è sua; se peggiora in entrambi, il problema è il pavimento.

**D6 — niente regressioni, e la sonda dello spento.** `banco/run_suite.mjs` con esattamente
le rosse dichiarate (oggi 42 PASSA; rosse note: s15 ×2, s25 ×2); i quattro banchi del sito
verdi; una sonda nuova in s30 che verifica «pavimento assente ⇒ bit-identico».
**Sui golden**: cambieranno, ed è atteso. Il criterio di rigenerazione **non** è l'identità
al bit fuori dalle finestre — sarebbe C2 rimesso dalla finestra, visto che il tetto gira
proprio lì — ma questi due: le gare di D1 non si muovono, e il diff si allega all'esito
perché sia leggibile invece che accettato.

## 5 · Che cosa vorrà dire l'esito

- **D1..D6 verdi** → si accende: kernel, trasporto al motore vendorizzato, viste rigenerate.
  Il pannello può passare a rispondere sulla gara del giocatore.
- **D1, D2 o D3(a) rossi** → l'implementazione non è quella del §3: si rilegge il codice. Non
  sono verdetti sul mondo, e un verde lì non è una scoperta (§0).
- **D5(a) rosso** → la riparazione allontana la simulazione dalla realtà: si annulla. Il
  braccio (c) dice se la colpa è del pavimento o della reazione del tetto, e la prereg
  successiva va di conseguenza.
- **D5(a) NULL** (meno di 20 discordanti, o popolazione cambiata) → non si accende
  **e non si racconta come un successo**: si dichiara che il banco non ha potuto decidere, e
  si dice cosa servirebbe.
- **D3(b) sopra il 50%** → κ non si consegna in un giro su questi distacchi. È un risultato
  sul modello e va a referto insieme all'esito, qualunque esso sia. Candidata già dichiarata
  qui per non sceglierla dopo: far pagare la compressione al **leader**, che è la lettura
  fisica giusta (il campo si compatta perché chi è davanti rallenta), al prezzo di muovere
  l'ancora di tutti i cumulati.
- **D4 rosso con D2 verde** → i rifiuti hanno un'altra causa oltre a FIS01: si misura quale
  prima di toccare il pannello.

## 6 · Cosa NON si farà, qualunque sia l'esito

Non si tara il pavimento, non si tocca κ, non si allarga il margine di 1,5 s del Director,
non si sopprime il rifiuto lato pannello, e **non si spegne il tetto al movimento per far
passare un cancello** — il braccio (c) è una lente diagnostica, non una configurazione di
produzione. Nessun cancello si riscrive dopo averne visto l'esito: se uno è mal specificato,
l'esito è NULL e l'errore è mio, come il 13/08.

## 7 · Gli emendamenti pre-sigillo, e i difetti che li hanno causati

Elencati perché un documento che nasconde le proprie correzioni non è una preregistrazione.

1. **Il banco cercava il pavimento col nome del sito** («Gran Bretagna») invece che del
   motore («GranBretagna»), e in assenza restituiva `null` **in silenzio**. La Gran Bretagna
   risultava con zero giri sotto il pavimento, ci finiva dentro come **gara di controllo di
   D1** — cioè il 54% del campione del cancello di perimetro era un artefatto — e il
   censimento diceva 4.289 invece di 5.815. Adesso l'assenza esplode (regola 7). *Trovato da
   me con la sonda del margine, e indipendentemente da quattro revisori su cinque.*
2. **D3 chiedeva l'identità al bit sui giri compressi non morsi: impassabile per costruzione**,
   della stessa famiglia di C2 — un morso alza `m.c`, e ogni giro compresso successivo eredita
   il distacco spostato. Sostituito con l'invariante **locale** `gap_dopo = gap_prima · κ`.
3. **La soglia «< 30%» bocciava il fondo** (31,5%) ed era sorretta da una motivazione
   **rovesciata** (che il vincolo avrebbe ridotto i morsi). D3(b) non è più un cancello: è una
   misura con una previsione dichiarata, e la previsione è quella opposta.
4. **D5(a) faceva passare un pareggio e un campione minuscolo.** Aggiunte la soglia dei 20
   discordanti e la clausola sulla popolazione.
5. **D5(b) era decorativo e ometteva G4**, l'unico dei quattro limiti pubblicati che il motore
   già fallisce. Ora è dichiarato tale, e G4 è scritto.
6. **Mancava il braccio col tetto spento**, che l'esito precedente aveva promesso come
   requisito del successore. Aggiunto come D5(c).
7. **D6 rimetteva C2 dalla finestra** chiedendo golden bit-identici fuori dalle finestre.
   Il criterio è cambiato.
8. **Il §3 prometteva cose che il codice smentiva**: che l'out-lap fosse escluso (non lo è),
   che il pavimento non fosse un'interfaccia nuova (lo è), e non diceva che il vincolo poteva
   **aggiungere** tempo con delta positivo. Tutte e tre riparate nella forma.
9. **Il §2 taceva le 302 tracce cieche e i 0 rifiuti del Director**, cioè i due limiti veri
   del banco. Ora sono nella tabella, con la spiegazione di chi rifiuta cosa.

---

*Sigillo: questa prereg è committata **prima** di riapplicare la riparazione. Il commit che
la introduce non contiene modifiche a `simulatore/engine/kernel.mjs` né a
`simulatore/scenario/costruttore.mjs`, e **contiene gli strumenti di misura**
(`pavimento_gara_intera.mjs`, la strumentazione additiva di `bandiera.mjs`): sono stati
scritti da chi propone la riparazione, e il difetto n.1 di questo elenco era proprio lì.
Ogni modifica successiva a quegli strumenti invalida la misura e va dichiarata.*
