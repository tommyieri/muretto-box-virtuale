# PREREG — il metro a due condizioni, e la regola anti-bara

Scritto **prima** di toccare qualunque cella. Branch `ai-lab/scienziato-fuel-metro2`,
21/07/2026. Prosecuzione di `PREREG_percircuito.md` (commit 5863851), da cui eredita
fondo, filtri, stimatore per gara e tabella circuito × anno. Nessun numero è ereditato
come dato.

## 0. Perché un metro nuovo

Il metro vecchio (Q di Cochran: "il circuito è identico a sé stesso ogni anno") si è
rivelato **difettoso nella forma**, non nella severità: scarta Austria (2,20 · 1,79 · 2,06,
tutte e tre ~1 s sotto il globale) e Bahrain — cioè **i due circuiti dove sapere-il-circuito
aiuta di più** — perché le loro SE sono piccole e Q punisce la precisione. Q chiede
*identità*; la domanda vera è *posizione*.

Il difetto è stato diagnosticato e **non corretto in corsa**: portato al tavolo, approvato.
Questo prereg lo formalizza prima di guardare un solo verdetto.

## 1. Il metro — due condizioni, entrambe necessarie

Riferimento: **globale lasciando fuori il circuito stesso**. Per il circuito c,
`G₋c` = mediana dei valori di tutte le gare del regime **escluse quelle di c**. Così
nessun circuito è confrontato con un globale che contiene sé stesso.

Deviazione della cella: `d_cy = Δ_cy − G₋c`.

- **(i) SEGNO STABILE** — tutte le stagioni del circuito hanno `d_cy` dello **stesso
  segno**: sempre sopra il globale, o sempre sotto. Un circuito che ballonzola attorno al
  globale fallisce qui.
- **(ii) DISTANZA NETTA** — `D_c = |Δ̄_c − G₋c| ≥ soglia`, dove `Δ̄_c` è la media pesata
  inverso-varianza sulle stagioni. La **soglia non la fisso a mano**: §2.

**PER-CIRCUITO VERO** ⟺ (i) **e** (ii). Non basta una delle due.

Debolezza dichiarata di (i) da sola: con k = 3 stagioni, un circuito che sta *esattamente*
sul globale ha probabilità 2·(½)³ = **25 %** di risultare "sempre dallo stesso lato" per
puro caso. È il motivo per cui (ii) esiste, e il motivo per cui la soglia di (ii) va
calibrata sul tasso di falsi positivi **congiunto**, non su (ii) da sola.

## 2. La soglia di (ii), derivata dai dati — metodo dichiarato prima del numero

Stessa logica con cui fu derivata la tolleranza-partizione: **dalla distribuzione nulla,
non a occhio**.

**Nulla**: dentro ogni stagione si permutano le etichette di circuito fra le gare (lo
stesso schema di permutazione già dichiarato e usato in `PREREG_percircuito.md` §4 —
nessuno strumento nuovo). Ogni replica produce k circuiti-fantoccio con una gara per
stagione, sui quali si calcola **la stessa identica statistica** `D` e **la stessa
condizione (i)**. Valore e SE viaggiano **in coppia** nella permutazione.

**Regola di derivazione**: la soglia è il valore di `D` per cui il **tasso di falsi
positivi congiunto del metro — (i) ∧ (ii) — sotto la nulla vale il 5 %**. Cioè: fra tutti
i circuiti-fantoccio, quelli che passerebbero entrambe le condizioni devono essere il 5 %.

10 000 repliche, seed 20260721. La soglia si calcola **per k** (numero di stagioni), perché
un circuito con 4 stagioni ha una media più stretta di uno con 3. Si riportano k = 2, 3, 4;
si applica quella di k = 3.

## 3. LA REGOLA ANTI-BARA

Il metro nuovo è stato **ispirato** dai 13 circuiti con ≥3 stagioni già guardati. Giudicarli
con esso sarebbe tararlo e valutarlo sugli stessi dati.

- **Sui 13 già visti**: il metro produce **PREDIZIONI CONGELATE**, marcate
  *"tarate a posteriori — NON PROVA"*, committate ora in `predizioni_congelate.json`.
- **La prova vera** viene solo da celle che **non hanno ispirato il metro**: circuiti che
  raggiungono le 3 stagioni **dopo** questo commit. Il primo verdetto su una cella fresca
  è il test onesto, e lo emette la pipeline di sorveglianza (§5), non io stanotte.

## 4. Confine di regime — vincolo che sopravvive al metro nuovo

Il progetto vieta di mescolare 2023-25 e 2026: sono macchine diverse. Il metro **non**
rimuove il divieto. Una cella 2026 **non può** fare da terza stagione a un circuito 2023-25.

Tentazione dichiarata e rifiutata: siccome il metro guarda la *posizione relativa al
globale del proprio regime*, si potrebbe sostenere che la deviazione `d` sia
regime-invariante e quindi mescolabile. **Non lo assumo**, per due ragioni scritte qui
prima di usarle: (a) è un'ipotesi non verificata; (b) l'unica evidenza disponibile la
contraddice — Spearman fra la posizione 2023-25 e quella 2026 è risultato **−0,055**
(sessione precedente): l'ordinamento non sopravvive alla rottura regolamentare.

Conseguenza accettata: se nessuna cella è giudicabile con dati freschi **dentro un solo
regime**, la risposta corretta è "zero, la prova è differita" — e va bene.
Una lettura cross-regime può essere riportata **solo** come indizio esplicitamente marcato
*non-verdetto*, mai come primo verdetto vero.

## 5. La sorveglianza

`sorveglianza.py`: ricalcola la tabella dal fondo, la confronta con lo stato salvato,
e **riporta SOLO quando una cella cambia stato** (da INDECIDIBILE a giudicabile).
Idempotente: due esecuzioni senza dati nuovi non producono niente. Quando un circuito
raggiunge 3 stagioni **nello stesso regime**, applica il metro e dice se la **predizione
congelata reggeva**. Esce sempre 0: nessun exit-code decide, il verdetto va al tavolo.

Il file `predizioni_congelate.json` è **sola lettura** per la pipeline: non si riscrive mai,
altrimenti la predizione non sarebbe congelata.

## 6. Strumenti usati

Solo strumenti già dichiarati in sessioni precedenti: permutazione delle etichette di
circuito, media pesata inverso-varianza, quantile empirico di una nulla. **Nessuno nuovo.**
Se ne servisse uno, l'agente si ferma e lo porta al tavolo.

## 7. Cosa non si fa

Non si monta niente. Kernel di produzione intatto. Nessun push, nessuna PR, nessun merge.
