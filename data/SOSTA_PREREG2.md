# Pre-registrazione 2 — «sosta» = CAMBIO GOMMA

Scritta il 08/08/2026 dopo il referto di `SOSTA_PREREG.md`, che è rimasto com'era (regola 3:
un cancello sbagliato si mette a referto, non si riscrive). Il primo tentativo aveva eletto
arbitro f1db per una grandezza che f1db non misura.

## Cosa ha insegnato il primo giro

f1db `races-pit-stops` conta i **pit stop di gara**. La vista stint ha bisogno di sapere
**quando sono cambiate le gomme**. Sulle dieci gare senza bandiera rossa le due domande
danno la stessa risposta; a Monaco no, perché a gara sospesa quasi tutto lo schieramento ha
montato gomme nuove e quei cambi — correttamente — non sono pit stop.

Non si sceglie l'arbitro dopo aver visto chi vince. Si dichiara che **la grandezza del
prodotto è il cambio gomma**, e si usa f1db per quello che è: la verità sui pit stop di
gara, cioè su tutto ciò che sta **fuori** dalla bandiera rossa.

## Definizione candidata (una sola, D5)

> C'è una **sosta** al giro L per il pilota P quando fra L e L+1 P monta un set diverso:
>
> `compound[L+1] != compound[L]`  **oppure**  `tyre_age[L+1] < tyre_age[L]`
>
> con entrambe le celle presenti. Se una delle due manca, la risposta è **null**, non
> «nessuna sosta» (regola 6).

Le due condizioni coprono i due modi in cui si vede un set nuovo, e servono entrambe:
la mescola da sola non vede un cambio SOFT→SOFT, l'età da sola non vede un set nuovo della
stessa età (Belgio/BEA g1) né un set **usato** più vecchio (Canada/SAI g2: età 2 → 9).

`in_lap` NON entra nella definizione: resta il **transito in corsia**, che è un'altra cosa e
serve al pallino sulla mappa. Due concetti, due nomi, due usi.

## Cancello (scritto prima di misurare D5)

Sull'unione delle 11 gare, separando i giri **dentro** una finestra `rf` di
`demo/neutralizzazione.json` da quelli **fuori**:

1. **FUORI dalla bandiera rossa**, contro f1db: precisione ≥ 0,98 e richiamo ≥ 0,98, e
   nessuna singola gara sotto 0,95 su nessuna delle due.
2. **DENTRO la bandiera rossa**, i casi in più rispetto a f1db devono essere **tutti**
   spiegati dalla bandiera rossa: cioè ≥ 0,95 di essi deve cadere in una finestra `rf`.
   Se fossero sparsi altrove, la spiegazione sarebbe una scusa e non una causa.
3. Nessun parametro tarato per gara, nessuna eccezione scritta a mano per Monaco.

Il §2 è la parte che può davvero far fallire: se i «predetti in più» non fossero concentrati
nelle finestre `rf`, la storia raccontata nel referto precedente sarebbe falsa.

Se D5 non passa, la vista stint **non si accende** e si mette a referto che il dato non
regge.

## Dove vivrà

Un modulo solo, in `.mjs` (regola 8), importato da chi la usa: vista stint, tacche pit
della timeline, `sosteVereDa()` di `demo/ese.mjs`, e gli aggregatori che oggi raggruppano
sul contatore grezzo.

---

## REFERTO (misurato 08/08/2026, `python3 test_sosta.py --d5`)

**D5 BOCCIATA su entrambe le condizioni.**

- §1 fuori dalla bandiera rossa: precisione 0,978, richiamo 0,984 — **sotto** 0,98 la prima,
  e la peggiore gara è Canada 0,909 di precisione, sotto il minimo di 0,95.
- §2: dei 24 casi in più rispetto a f1db, solo **16 cadono in una finestra rossa** (67%,
  soglia 95%). Otto stanno fuori, e la spiegazione «è la bandiera rossa» non li copre.

Il §2 era scritto apposta per poter smentire la storia raccontata nel primo referto, e in
parte l'ha smentita. Gli otto casi vanno guardati uno per uno, non aggirati.

### Gli otto: f1db non li ha, e ha torto

Tutti e otto hanno `in_lap` e `out_lap` veri e un set inequivocabilmente nuovo — per
esempio *Canada/SAI g30* (MEDIUM età **36** → MEDIUM età **1**) e *Ungheria/ANT g53*
(HARD 31 → HARD 1). Nessuno di essi è un errore di allineamento: in f1db **non esiste alcuna
sosta a un giro adiacente**, e per *Canada/BEA* f1db non elenca **nessuna sosta in tutta la
gara**, benché l'auto sia passata ai box.

Giudicati da un terzo arbitro indipendente da entrambi — `PitInTime`/`PitOutTime` di FastF1,
che vengono dal feed di cronometraggio e non da f1db né da noi — risultano
**confermati 8 su 8**.

Quindi f1db, per il 2026, **è incompleto**. Non è un arbitro utilizzabile.

### I sei «mancati»: la definizione ha ragione

Nella direzione opposta, i casi che f1db elenca e D5 non predice sono in gran parte **soste
senza cambio gomma** (*Australia/BOT g12*: HARD età 12 → HARD età 13; *Gran Bretagna/ANT
g43*: MEDIUM 8 → MEDIUM 9): l'auto è passata ai box e ha rimontato lo stesso set. Sono pit
stop veri e **non** sono cambi gomma: D5 li esclude correttamente, perché la grandezza del
prodotto è il cambio gomma. Due casi (*Ungheria/PER* g21 e g46) hanno `compound: null` e
restano null (regola 6).

### Conseguenza

Il cancello è fallito per un difetto dell'**arbitro**, non della definizione: f1db è
incompleto (8 soste mancanti, provate da FastF1) e misura i pit stop di gara, non i cambi
gomma. **D5 non si tocca** — non si modifica una definizione perché sta perdendo contro un
metro rotto.

Si ri-corre lo **stesso cancello, con le stesse soglie**, contro un arbitro completo e
indipendente: `data/SOSTA_PREREG3.md`.
