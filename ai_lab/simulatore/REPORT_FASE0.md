# REPORT — FASE 0 del simulatore

*28/07/2026. Pre-registrato in `PREREG_fase0.md`, scritto prima di guardare qualunque stima.*
*Regola dell'arco (PO): **non si eredita nessun artefatto derivato**, si ricostruisce dal grezzo.*

**In una riga:** il banco esiste, **G0 = 0,0 %** — il motore di oggi non ha mai una preferenza
interna su *quando* fermarsi — e il termine che gliela darebbe è stato **rimisurato dal grezzo
e regge** (ρ = 0,0389 s/giro, IC95 [0,0220 ; 0,0629]), mentre la **separazione fra mescole non
regge** (p = 0,209).

---

## 1. Cosa è stato costruito

| file | cosa fa |
|---|---|
| `censimento.py` | fotografa il grezzo 2026 e verifica il lettore contro i file |
| `PREREG_fase0.md` | perimetro, stimatore, soglie — scritti **prima** |
| `degrado.py` | ristima ρ e Φ dal grezzo, con bootstrap sui blocchi e nullo per permutazione |
| `verifica_derivati.py` | controlla che i derivati che il motore mangia siano fedeli al grezzo |
| `banco_quando.mjs` | **il banco**: per ogni sosta vera, la curva costo/giro-di-sosta, e G0 |
| `esito_*.json` | gli esiti, con targhetta e provenienza |

Nessuno di questi tocca la produzione. Il motore (`demo/gradino.mjs`, `demo/engine.mjs`) non
è stato modificato di una riga: il banco lo misura, non lo aggiusta.

---

## 2. Il grezzo — 11 gare, verificate

11 gare 2026, da `data/gare_registro.json` → `ti_cache` (8) e `ti_archive/2026` (3).
`lab/fondo.py` è stato riletto a mano, file per file: **11/11 identiche**, 12.733 righe.

**Le durate degli stint chiusi** — la scelta vera delle squadre, che è il bersaglio del
simulatore e il segnale d'allarme dell'adattamento live:

```
SOFT     n= 52    p25 11    mediana 14    p75 18    max 35
MEDIUM   n=176    p25 14    mediana 19    p75 23    max 41
HARD     n=104    p25 18    mediana 22    p75 26    max 42
```

**Questo ordine esce da solo, ed è netto.** Tienilo a mente per il §4: le mescole si
separano benissimo su *quanto le tengono*, e non si separano affatto su *quanto degradano*.

---

## 3. Il degrado, ricostruito dal grezzo

**Filtro verde più stretto di quello in uso.** `lab/fondo.py::verde` considera verde un giro
il cui `status` non contiene `4` (SC) o `6` (VSC) — ma l'alfabeto è `{1,2,4,5,6,7}` e il `5`
è la **bandiera rossa**. Qui verde = `status == '1'` esatto. Restano 8.192 giri verdi puri.

**Stimatore** (identificazione: alla sosta `life` si azzera e `lap` no):

```
t(d,L) = alpha_d + C_c + rho_c · life + Phi · L
```

### Il risultato

| | stima | IC95 (blocchi = gare) | |
|---|---|---|---|
| **ρ comune** | **0,0389** | **[0,0220 ; 0,0629]** | non contiene lo zero |
| ρ SOFT | 0,0335 | [0,0101 ; 0,0940] | non contiene lo zero |
| ρ MEDIUM | 0,0366 | [0,0180 ; 0,0662] | non contiene lo zero |
| ρ HARD | 0,0410 | [0,0249 ; 0,0679] | non contiene lo zero |
| ρ SOFT − ρ HARD | −0,0075 | [−0,0337 ; 0,0488] | **contiene lo zero** |
| Φ (deriva di gara) | −0,0448 | [−0,0526 ; −0,0389] | non contiene lo zero |

Nullo per permutazione delle etichette mescola, 2.000 ripetizioni: **p = 0,209**.

### Le soglie del prereg

| | | esito |
|---|---|---|
| **S1** | la gomma degrada | **PASSA** |
| **S2** | le mescole degradano in modo diverso | **NON PASSA** (IC contiene lo zero, p = 0,209) |
| **S3** | l'ordine SOFT > MEDIUM > HARD esce da solo | **NON PASSA** (2 gare su 10) |
| **S4** | il carburante del kernel è sbagliato per il 2026 | **NON PASSA** (vedi §3.2) |

Condizioni di validità (§9 del prereg) tutte rispettate: giri verdi per mescola per gara
≥ 30 in mediana (SOFT 70, MEDIUM 290, HARD 444), piloti con ≥ 2 stint ≥ 10 (mediana 20,5).

**Sensibilità.** Senza il taglio del traffico ρ passa da 0,0389 a 0,0347: il segnale non
viene dai giri tolti.

### 3.1 Il dubbio del PO era fondato — ma non per il motivo che pensava

`data/modello_degrado_2026.json` dice `SOFT 0,0566 · MEDIUM 0,0571 · HARD 0,0512`.

- Non è calibrato su 8 gare: la sua diagnostica ne elenca **11**. Su questo la stima del PO
  era pessimistica.
- **Ma include Monaco**, che il PO ha chiesto di escludere.
- E soprattutto: i due lavori **non concordano**. I miei valori sono più bassi del 20–40 %,
  e l'ordine fra mescole è **rovesciato** (io HARD > MEDIUM > SOFT, lui MEDIUM > SOFT > HARD).
  Due ordini diversi, nessuno dei due significativo: è il sintomo classico del rumore.

**E c'è di più, scritto nel file stesso:**

```
ACCENDIBILE = false
A_predittivo: SUPERATO = false   guadagno mediano −22,9 s   IC95 [−57,4 ; +4,2]
B_prodotto  : SUPERATO = false   numerosita_sufficiente = false   (7 casi)
```

Quel modello **non aveva superato il proprio cancello di accensione**. Nel `PIANO_SIMULATORE.md`
l'avevo descritto come «già calibrato, già spento», lasciando intendere che fosse pronto e
solo da accendere. Non lo era. Il piano è corretto qui sotto (§7).

### 3.2 Φ non è «il carburante», e S4 va letto con attenzione

Φ = **−0,0448 s per giro di gara**, cioè **−2,574 s** sull'arco di una gara mediana (58 giri),
IC95 [−3,023 ; −2,239].

Il kernel usa `3,0 s su 70 kg`. Quel −3,000 **cade dentro** l'IC95 → S4 non passa, e va detto
così com'è: *questi dati non permettono di dichiarare sbagliato il coefficiente del kernel.*

Ma tre cose vanno messe accanto, e sono più importanti del verdetto binario:

1. **Φ non è il carburante da solo.** È carburante **ed evoluzione pista insieme** — hanno la
   stessa forma e questi dati non li separano. L'evoluzione pista spinge nella stessa
   direzione, quindi il **carburante da solo è più piccolo di 2,574 s**. Il kernel applica
   3,0 come se fosse tutto carburante: sta correggendo troppo.
2. Il problema vero del kernel **non è il valore, è che non lo ri-aggiunge mai**: `pace_base`
   sottrae il peso e `simulate` non lo ri-gonfia. Il segno del bias è quello, non la seconda
   cifra decimale.
3. Per il simulatore serve comunque **l'effetto netto del giro di gara**, che è Φ. Chiamarlo
   `FUEL_COEFF` sarebbe una bugia comoda: va chiamato **deriva di gara**.

---

## 4. Il difetto trovato nei derivati

I derivati che il motore mangia in produzione (`demo/data/<gara>.json`) sono stati confrontati
cella per cella col grezzo: **12.733 celle, contenuto identico** su `lap_time`, `compound`,
`tyre_age`, `in_lap`, `out_lap`, `neutralized`. Usarli per misurare il motore in produzione è
quindi sicuro, e adesso lo sappiamo invece di sperarlo.

**Ma:** 25 celle di `demo/data/Ungheria.json` portano la **stringa `"None"`** come compound —
PER, giri 22–46, tutto il suo secondo stint. Il grezzo scrive `"None"` per i mancanti;
`lab/fondo.py` la lava, l'esportatore della demo **no**.

- **Il motore è salvo**: il filtro verde vuole `SOFT|MEDIUM|HARD`, quindi quelle celle escono
  da `pace` e dal `gradino`.
- **La pagina no**: per quel pilota la mescola mostrata è sbagliata.
- Da chiudere **alla fonte**, nell'esportatore. È il debito n.1 uscito dalla Fase 0.

---

## 5. Il banco, e G0

Per ogni sosta **realmente avvenuta** (337 casi, Monaco escluso), si congela al giro
precedente e si valuta il costo di fermarsi a **ogni giro possibile fino alla bandiera**. La
risposta è una curva; il KPI è **dove cade il minimo**.

Due ingredienti del pannello non possono spostare l'argmin, e vanno dichiarati perché
altrimenti sembrano dimenticati: **il pit-loss è lo stesso per ogni giro candidato**, e **la
deriva dipende dal passo, non dal giro di sosta**. Aggiungono la stessa costante a tutta la
curva. Quello che resta a determinare la forma **è il modello**.

### Curva A — il motore di oggi

```
curva PIATTA (nessuna preferenza) : 88  (26,1 %)   gradino non ancora misurabile
casi con una preferenza vera      : 249
   minimo al PRIMO giro utile : 247  (99,2 %)
   minimo all ULTIMO          :   2  ( 0,8 %)
   minimo INTERNO             :   0  ( 0,0 %)
```

> ### G0 = 0,0 % — soglia dichiarata ≥ 80 % — **NON PASSA**

Due precisazioni oneste:

- **Su 88 casi il motore non ha proprio nessuna preferenza**: la curva è piatta a 0,000 s
  perché il `gradino` non è ancora misurabile (servono 3 soste). In un primo giro di conteggi
  li avevo contati come «minimo interno» e G0 usciva 6,2 %: un pareggio non è un ottimo, e
  contarlo tale regalava al motore una preferenza che non ha. La versione finale li separa.
- Nel `PIANO_SIMULATORE.md` avevo scritto «atteso 0 % su 718 confronti», misurato con
  `confrontaPit` a orizzonte fisso. Il banco lo conferma a orizzonte pieno, su una
  popolazione diversa (le soste vere) e con una meccanica diversa: **0,0 %**.

### Curva B — la prova che lo strumento non è rotto

Stessa identica meccanica, ma senza `gradino` e con al suo posto il termine di **età gomma**
misurato al §3 (ρ = 0,0389):

```
minimo INTERNO       : 252  (74,8 %)
minimo al PRIMO giro :  85  — e sono i casi in cui la gomma è GIA' troppo vecchia
                              (età mediana 25 giri, 17 giri rimasti, (R−a₀)/2 = −3)
```

Cioè: **252 ottimi interni + 85 «fermati subito» corretti = 337 su 337.** Lo strumento vede i
minimi interni quando ci sono. Lo 0,0 % della curva A è una proprietà **del motore**, non del
banco. Ed era il punto di questa fase.

**Nessuna curva B è piatta**: 0 casi su 337 sotto 1 s di ampiezza fra meglio e peggio. Quando
il minimo c'è, vale una decisione.

### Descrittivo — il modello contro la squadra vera

Minimo della curva B meno il giro scelto davvero dal muretto:

```
p10 0    p25 0    mediana +5    p75 +14    p90 +19   (giri)
```

Il modello di sola età si fermerebbe **più tardi** delle squadre, con una coda lunga. È
atteso e va scritto: non ha ancora **cliff di fine vita**, non ha **track position**, non ha
**traffico al rientro**, e non sa che una gomma può finire prima di quanto convenga
aritmeticamente. Non è un fallimento della Fase 0 — è la lista della spesa delle Fasi 2 e 5.

---

## 6. Cosa dice questa fase, in chiaro

1. **Il banco c'è e funziona.** G0 è riproducibile con un comando ed è falsificabile.
2. **Il motore di oggi non risponde alla domanda del prodotto.** 0 su 249.
3. **Il termine che gli mancava esiste nei dati 2026 ed è solido** (S1).
4. **La mescola non separa il degrado nel 2026** (S2, S3). Va cercata sul fondo 2018-2025,
   come previsto dal piano — con la consapevolezza in più che il 2026 da solo è cieco.
5. **La mescola separa benissimo la DURATA** (SOFT 14, MEDIUM 19, HARD 22 giri di mediana).
   Che le squadre trattino le tre gomme in modo nettamente diverso è un fatto misurato; che
   le pendenze non lo mostrino è un limite del nostro stimatore, non una prova di uguaglianza.
6. **Il vecchio coefficiente non era utilizzabile** e lo dichiarava da solo.

### Una tensione da non nascondere

S1 passa (ρ ≠ 0), ma il cancello del vecchio modello — *«ridurre l'errore di ricostruzione dei
tempi»* — era fallito. Le due cose convivono, e la ragione è la stessa lezione già scritta in
`engine/LIMITI_NOTI.md §4` a proposito del cap del traffico:

> ρ · età vale pochi decimi su uno stint. Il rumore di gara è ±11,7 s. Sui **tempi**, ρ non
> si vedrà mai. Sulla **decisione**, ρ è tutto: è l'unico termine che sposta il minimo.

**Conseguenza operativa per la Fase 2:** il cancello di accensione del degrado non deve essere
«ricostruisce meglio i tempi» — quel bersaglio è fuori portata e bocciarlo su quello è un
errore di misura, non di modello. Deve essere **«fa cadere il minimo dove poi la gara ha dato
ragione»**. Il banco costruito qui è esattamente lo strumento per giudicarlo.

---

## 7. Correzioni al PIANO_SIMULATORE.md

| dove | cosa cambia |
|---|---|
| §3.3 | i coefficienti citati erano il modello vecchio, **non accendibile per sua stessa dichiarazione**. Sostituiti con i miei, ricostruiti dal grezzo. |
| §3.3 | «già calibrato, già spento» era **fuorviante**: era spento perché il suo cancello era fallito, non solo per il bersaglio sbagliato. |
| Fase 2 (G2) | il cancello va riformulato: non «non peggiora l'errore sul rientro» ma **«G0 sale sopra l'80 % e il minimo cade dove la gara dà ragione»**. |
| Fase 3 | il 2026 da solo è cieco sulla separazione fra mescole (p = 0,209): la Fase 3 sul fondo 2018-2025 non è un raffinamento, è **l'unica strada**. |
| nuovo | debito: il letterale `"None"` nell'esportatore della demo. |

---

## 8. Cosa NON è stato fatto

- **Non ho toccato il motore.** Nessuna riga di `demo/` è cambiata.
- **Non ho stimato il degrado sul fondo 2018-2025.** È Fase 3, e serve un prereg suo.
- **Non ho stimato niente sul bagnato.** È Fase 4.
- **Non ho toccato `data/modello_degrado_2026.json`.** Resta dov'è, con il suo
  `ACCENDIBILE = false`. Sostituirlo è una decisione di produzione, non di laboratorio.
- **Il banco valuta UNA sosta.** Il piano gomme multi-sosta è Fase 6: la meccanica c'è già
  (`simulaConSoste` accetta un array), ma serve lo `stint` come oggetto.

---

### Riprodurre tutto

```bash
python3 ai_lab/simulatore/censimento.py --json ai_lab/simulatore/esito_censimento.json
python3 ai_lab/simulatore/degrado.py --boot 2000 --perm 2000 --json ai_lab/simulatore/esito_degrado.json
python3 ai_lab/simulatore/verifica_derivati.py
node    ai_lab/simulatore/banco_quando.mjs --json ai_lab/simulatore/esito_banco.json
```

Seed fisso (20260728), nessuna rete, nessun derivato letto dagli stimatori.
