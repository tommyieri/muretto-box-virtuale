# Prereg di METODO — il numero di soste: pavimento, identificabilità, e la regola per smettere

**Data: 2026-08-17.** Scritta **prima** di eseguire una sola misura di questo arco. Non
accende niente, non stima niente, non spedisce niente: fissa **come si legge il risultato**
e **quando si smette**.

**Perché una prereg di metodo e non l'ennesima prereg di ipotesi.** Sul numero di soste il
progetto ha già speso sei esclusioni (`ESITO_una_sosta_e_robusta.md` §2) e le ha onorate
tutte. Il rischio adesso non è sbagliare un'altra ipotesi: è **non riconoscere che la
domanda non ha risposta con i dati che abbiamo**, e continuare a spendere. Questa prereg
esiste per rendere quel riconoscimento una *misura* invece di una stanchezza.

---

## 1 · Il fatto, e la riserva che era stata sfiorata

Fuori campione su 167 decisioni vere
(`ESITO_scomposizione_errore.json`, 05/08/2026):

| braccio | errore mediano sulla durata dello stint |
|---|---|
| **A** motore libero — il prodotto di oggi | **7 giri** |
| **B** motore col numero di soste VERO regalato | **5 giri** |
| **C** pavimento: `vita[mescola]`, tre numeri, leave-one-race-out | **5 giri** |

e la scelta di `k`: **53 azzeccati, 114 troppo poche, 0 troppe**.

La lettura del 05/08 si basava sulle **mediane**, e per quelle il ramo era «la scelta di
quante soste». Ma il confronto appaiato caso per caso dice **60-88 per il pavimento**
(p = 0,0261): *anche col numero di soste regalato, il motore non batte una tabella di tre
numeri.* L'ESITO lo ha scritto invece di nasconderlo (§4, «la riserva onesta»), e ha
registrato che il terzo esito previsto — *«se anche B resta peggio del pavimento, il problema
non è in nessuna delle due scelte»* — **era sfiorato e non è scattato per un pelo**.

> **Quella è la crepa da cui parte questa prereg.** Una regola di lettura sulla mediana ha
> lasciato passare un risultato appaiato significativo in direzione opposta. Non è colpa di
> chi l'ha scritta: è che la mediana e il test appaiato rispondono a domande diverse, e quale
> delle due decide va scelto **prima**. Qui si scegle prima.

## 2 · La domanda, in una riga

> **Il numero di soste è identificabile da ciò che il motore vede al congelamento, oppure il
> sotto-fermarsi è STRUTTURALE?**

«Strutturale» ha un significato operativo preciso, dichiarato qui e non negoziabile dopo:
*nessuna funzione dell'informazione disponibile a `Lf` ordina i casi per `k` vero meglio del
caso.* Se è così, non esiste taratura che lo aggiusti — e continuare a cercarla è spendere
contro un teorema, non contro un difetto.

## 3 · I quattro bracci, e il nuovo è il nullo

Tutti si leggono da **una sola esecuzione** di `pianoOttimo`, che già valuta ogni `k` da
`kMinimo` a 3 e li restituisce in `per_k` (nessuna stima nuova, nessun parametro toccato).

| | braccio | cos'è | perché c'è |
|---|---|---|---|
| **A** | libero | il piano che il motore sceglie | è il prodotto |
| **B** | `k` imposto | il piano al `k` vero, da `per_k` | oracolo **sul solo `k`**; non è un candidato alla produzione |
| **C** | pavimento | `vita[mescola]`, leave-one-race-out | il descrittivo che va battuto |
| **D** | **nullo su `k`** | **`k` costante = la moda del `k` vero, leave-one-race-out** | **nuovo**: se una costante ordina i casi come il motore, la scelta del motore non porta informazione |

**D è il braccio che mancava.** A/B/C confrontano *durate*; nessuno di loro chiede se la
**scelta di `k`** valga più di «metti sempre lo stesso numero». Senza D, un motore che
azzecca 53 casi su 167 sembra saperne qualcosa anche quando quei 53 sono esattamente i casi
in cui il `k` più frequente è 1.

**Leave-one-race-out su C e D**, per la ragione già a referto: la copertura in campione è
circolare, e una moda calcolata sulla gara che si sta giudicando non è un nullo, è un
oracolo travestito.

## 4 · Le metriche, fissate adesso

### 4.1 · Primaria: test dei segni APPAIATO (non la mediana)

Sull'errore per-caso della durata dello stint, sugli stessi casi misurabili
(`n_con_B = 152`; i 15 senza `k` vero e i 209 senza passo base al giro d'inizio restano
esclusi con lo stesso criterio del 05/08, **non si riapre il perimetro**):

- **P1 · B contro C** — test dei segni a due code, α = 0,05.
- **P2 · A contro D** — test dei segni a due code, α = 0,05.

**La mediana si riporta sempre e non decide mai.** È la lezione del §4 dell'ESITO precedente,
e questa riga è l'unico modo di non ripeterla.

### 4.2 · Identificabilità: τ di Kendall con nullo per permutazione DENTRO la gara

Fra `k_motore` e `k_vero` sui 152 casi:

- **I1 · τ osservato** vs distribuzione nulla da **2.000 permutazioni di `k_motore`
  ENTRO ciascuna gara** (blocchi = gare, come ogni altra cosa in questo repo: permutare fra
  gare mescolerebbe circuiti e distanze e produrrebbe un nullo troppo facile da battere).
- Gate: **τ osservato fuori dal 95° percentile del nullo** = `k` porta informazione.
  Dentro = non ne porta.

**Perché τ e non l'accuratezza.** Il motore sbaglia **in una sola direzione** (0 casi di
troppe soste): un predittore monodirezionale può avere accuratezza alta o bassa per puro
effetto della sua distorsione, e l'accuratezza non separa «è distorto» da «è cieco». τ
guarda l'**ordinamento**: chiede se, distorsione a parte, il motore mette in fila i casi da
poche a molte soste. È esattamente la distinzione fra un difetto di taratura e un difetto
di identificabilità.

### 4.3 · Secondarie, solo a referto

Matrice di confusione `k_motore × k_vero`; frazione di casi in cui `per_k` mette il `k` vero
al **secondo** posto per costo (se il vero `k` è quasi sempre secondo, il prodotto ha
qualcosa da mostrare anche senza saper scegliere); ampiezza del divario di costo fra il `k`
scelto e il `k` vero, in secondi.

## 5 · La regola di stop, esplicita, con i tre esiti possibili

Si legge **in quest'ordine**, e la prima riga che si applica chiude la lettura.

| # | condizione | verdetto | cosa si fa |
|---|---|---|---|
| **S1** | **P1 non passa** (B non batte C) **e I1 non passa** (τ dentro il nullo) | **STRUTTURALE — ARCO CHIUSO** | **Si smette.** Nessun settimo tentativo, nessuna ri-taratura, nessuna nuova prereg su `k`. La strada resta di **PRODOTTO**: mostrare `per_k` e lasciare la scelta di `k` a chi guarda. Diventa la risposta **per esclusione**, non per preferenza. |
| **S2** | **P1 non passa** ma **I1 passa** | difetto nel **confronto fra i `k`** | **Un solo** tentativo, pre-registrato a parte, su forma chiusa e pit-loss. Se anche quello manca il pavimento: si applica S1 senza ulteriore discussione. |
| **S3** | **P1 passa** (B batte C) | la scelta di `k` **vale** | l'arco si riapre: curare `k` porta il motore sopra il descrittivo, e il lavoro ha un bersaglio. |

**Esito atteso, dichiarato prima per non poterselo rivendere dopo:** il 05/08 il confronto
appaiato dava già 60-88 per il pavimento, quindi **P1 è atteso NON passare**. La cosa che
questa prereg misura per la prima volta è **I1**. Se I1 non passa, siamo in **S1** e si
smette: e quel «si smette» è il risultato, non una rinuncia.

## 6 · Cosa NON si fa, qualunque cosa dicano i numeri

- **Non si alza ρ** perché il piano venga più bello: sarebbe tarare un parametro fisico su un
  esito di prodotto, e romperebbe passo, banda, rientro e curva del quando (`E20`).
- **Non si allargano le soglie.** α = 0,05, 2.000 permutazioni, perimetro 152 casi: sono
  scritti qui sopra e valgono così. (Direttiva PO 01/08.)
- **Non si cambia la metrica primaria dopo aver visto il risultato.** Se P1/I1 sono mal
  specificate, si mette a referto e si pre-registra di nuovo: è `E08`, ed è già stato pagato.
- **Non si riapre il perimetro** dei casi esclusi per far salire una `n`.
- **Non si accende niente** in questa prereg: `SCENARI_ATTIVI`, `per_k` in pagina e ogni
  altra visibilità restano decisioni del PO, separate da questa misura.

## 7 · Vincoli di esecuzione

- Braccio D e le due metriche in **un solo script tracciato**,
  `ai_lab/pianificatore/identificabilita_k.mjs`, che scrive
  `ai_lab/pianificatore/ESITO_numero_soste_metodo.json` con targhetta (prereg, commit, data,
  natura = DIAGNOSI) — mai un `diag_*` gitignorato, mai un artefatto senza generatore
  (è la voce 9 del TODO, e in questa stessa sessione ne ho appena ripescata un'altra:
  `live/verifica_gara.py`).
- Verdetto braccio per braccio in `ESITO_numero_soste_metodo.md`, con la riga di §5 che è
  scattata **citata per numero**.
- Nessun import nuovo, nessuna dipendenza nuova, kernel non toccato (Regola 8).

---

> **Questa prereg è committata prima di qualunque numero.** Se un giorno il suo ESITO
> contiene una soglia diversa da quelle di §4, o una regola di stop diversa da §5, ha
> ragione questo file.
