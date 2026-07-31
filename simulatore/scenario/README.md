# 🧠 Strategy Lab (`scenario/`)

Costruttore di scenari UNICO (E17: mai due fisiche per due risposte adiacenti),
curva del quando, economia SC/VSC. Nei percorsi a congelamento entra solo
informazione ≤ Lf (E14, regola 5).

## `costruttore.mjs` — una fisica, due risposte

`costruisciScenario({ gara, freezeLap, pilota, giroPit, mescola })` produce
l'ingresso completo del kernel. **`doveRientri` e `curvaDelQuando` lo chiamano
entrambe**: `s17` verifica che generino letteralmente le stesse soste, così le
due risposte non possono contraddirsi come `confrontaPit`/`evaluatePit` nel
vecchio repo.

- **Perdita ai box dal regime**: verde → prior del circuito; SC → ×0,50;
  VSC → ×0,65. Sempre con targhetta, e il fattore è dichiarato come **banda**
  (SC 0,40-0,60 · VSC 0,60-0,70), non come punto.
- **Soste assunte dei rivali** sotto neutralizzazione: chi è ancora al primo
  stint si ferma allo stesso giro. È un'ASSUNZIONE, esce nel risultato col
  conteggio, e non cambia i *tempi* (nel kernel le auto non interagiscono) —
  cambia le *posizioni*.
- **Il regime non si estrapola**: oltre un giro dal congelamento la sosta è
  valutata in verde, perché il regime futuro è informazione che al
  congelamento non esiste (E14).
- **Orizzonte legato al modello** (E20): il giro finale è la fine della gara e
  il modello dichiara fin dove è validato (10 giri); proiettare oltre è messo a
  referto fra le assunzioni, non lasciato implicito in una costante.
- **Ogni risposta passa dal Director**. Se lo respinge, la risposta è `null` —
  mai un numero (regola 6).

### La curva del quando

`[{ giroPit, delta_s, banda }]` — `delta_s` è quanto si perde rispetto al
migliore, quindi il minimo vale 0, al medesimo giro finale per tutti i
candidati. La banda esiste **solo dove i coefficienti sono prior**: se tutti i
candidati sono in verde non c'è banda, e non per pigrizia — la perdita ai box è
la stessa per ogni candidato e **si cancella nella differenza**. `s17` lo
verifica raddoppiando la perdita e pretendendo che la curva non cambi forma.

Sulla gara di riferimento (Ungheria, congelamento 30, ALB) il minimo della
curva cade al **giro 48**, che è esattamente l'ottimo misurato dal banco G0″.

## 🛡️ `director.mjs` — il guardiano del runtime

Valida l'OUTPUT di ogni simulazione **prima della pagina**. Distinto dal Banco,
che valida il codice ai cancelli: il Banco non vede la simulazione dell'utente,
il Director non conosce i golden. Non si fondono.

`validaSimulazione(simulazione, costanti)` → `{ approved, violazioni, riepilogo }`.
Nessuna violazione **FATAL** → `approved`. Ogni violazione porta
`{ codice, severita, giro, atteso, ottenuto, pilota, messaggio }`.

| famiglia | codici |
|---|---|
| fisici | `FIS01` giro verde sotto il pavimento · `FIS02` stazionario sotto 1,8 s · `FIS03` stazionario anomalo *(sospetto)* · `FIS04` perdita pit sotto il clean-stop · `FIS05` somma settori ≠ tempo giro · `FIS06` età non avanza di 1 nello stint · `FIS07` lo stint non avanza alla sosta |
| geometrici | `GEO01` sequenza giri con buchi/duplicati · `GEO02` cumulato ≠ somma dei tempi |
| regolamentari 2026 | `REG01` meno di due mescole slick a fine gara asciutta · `REG02` durata oltre il limite · `REG03` sosta neutralizzata prezzata come verde |

**Nessuna costante è cablata** (verificato da `s16`): pavimenti misurati in
`data/modelli/pavimenti_2026.json`, politiche di guardia dichiarate in
`data/priors/director_limiti.json`, pit-loss e stazionario dal prior esterno.
Le definizioni di verde e neutralizzazione arrivano da `provenienza/`: il
guardiano non può approvare con un metro diverso da quello con cui il motore ha
calcolato (E12).

### Tre regole che i dati hanno corretto

Misurate sulle 11 gare 2026 **prima** di scriverle, non dopo (E13):

- **l'età NON riparte da 1 dopo la sosta**: 330 casi su 435 sì, gli altri fino a
  66 (set già usati nelle libere). L'invariante vero è che lo *stint* avanza
  (435/435) e che dentro lo stint l'età cresce di esattamente 1 (12.013/12.013).
- **il limite di 2 ore** sul tempo-sessione boccerebbe Monaco 2026 (144 minuti),
  che è regolare: c'era bandiera rossa. Si verifica solo senza rossa; con rossa
  vale la finestra di 3 ore.
- **le due mescole** valgono per chi *completa*: chi si ritira al giro 5 con una
  mescola non è squalificato. Applicarla a tutti fa respingere le gare vere —
  provato per mutazione.
