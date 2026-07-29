# PREREG — il degrado, giudicato su "batte la strategia reale"

Scritto **prima** dei numeri. Branch `ai-lab/scienziato-degrado`, 21/07/2026.
Prosecuzione di `PREREG_2022.md` (commit e654dcf). Stessa ossatura del carburante,
fenomeno nuovo.

## 0. Il primo piano è FERMO sotto di me

Il carburante non si rimette in discussione. Entra come **input congelato**, dichiarato:

| regime | come entra |
|---|---|
| **2022-25** | per-circuito per i soli **PER-CIRCUITO VERI** del metro a due condizioni (Austria, Bahrain); **globale ricostruito** per tutti gli altri |
| **2026** | **numero unico globale**, perché con una gara per circuito il per-circuito non è calcolabile: nessuna ripetizione ⇒ nessuna stabilità. È «buono abbastanza» per standard dichiarato, **non** per-circuito. Migliorerà da sé quando il 2026 accumula gare. |

Forma: il carburante toglie `Δ_c · (N − L)/(N − 1)` secondi al giro L di una gara di N giri.
A giro 1 vale Δ, a giro N vale 0.

Se emergesse che il carburante sporca il degrado, **si dichiara e si porta al tavolo**:
non si riapre in corsa.

**Nota tecnica dichiarata in anticipo**: nel modello di §3 il degrado è identificato dalla
desincronizzazione fra stint, e un termine lineare nel giro-gara assorbe evoluzione pista
*e residuo di carburante*. Conseguenza attesa: **le pendenze di degrado saranno poco
sensibili alla scelta del carburante congelato**; il carburante pesa invece sui **totali**
del controfattuale, dove non c'è nessun termine che lo assorba. Lo verifico e lo riporto.

## 1. Il metro — batte la strategia reale, non l'errore di fit

Il degrado **non** si giudica sui centesimi di scarto sul passo. Si giudica sulla domanda
del prodotto:

> Dato un pilota in una gara storica, il modello sa trovare una strategia (giri di pit +
> mescole) che fa **meno tempo totale** di quello che quel pilota ha fatto davvero?

La verità è il **tempo reale dal fondo**. Vittoria = il controfattuale fa meno tempo.

### La trappola di questo metro, e come la chiudo

Un modello **sbilanciato verso il basso vince sempre**: qualunque strategia sembrerebbe
battere il reale. Perciò ogni caso passa **due cancelli**, non uno:

1. **Cancello di calibrazione** — simulando la strategia **che il pilota ha davvero fatto**,
   il modello deve riprodurre il suo tempo reale entro `tol`:
   `|sim(strategia reale) − tempo reale| ≤ tol`. Se non ci riesce, il caso **non è
   valutabile** e viene escluso (non è né vittoria né sconfitta).
2. **Cancello di margine** — la strategia ottima deve battere il reale **di più di `tol`**:
   `sim(ottima) < reale − tol`.

`tol` **non è a mano**: è il **68° percentile di |sim(reale) − reale|** misurato sulle sole
gare di **calibrazione**, e poi applicato alle gare di verifica. Derivato dai dati, e da
dati diversi da quelli su cui giudica.

### Solo aria libera (deciso da Tommi)

Il controfattuale si valuta **solo** dove il rientro della strategia candidata cade in aria
libera. I casi con rientro in traffico si **escludono** e si dichiarano *«differiti a
quando il traffico sarà verificato dal fondo»*. Il traffico non è ancora ricostruito: non
deve sporcare il verdetto sul degrado.

## 2. Le due definizioni derivate dai dati (non a occhio)

**Aria libera — soglia G\***, derivata così, evitando la circolarità:
il modello di §3 si stima **solo su giri con gap davanti > 5,0 s** (ultra-conservativo);
poi si calcolano i residui su **tutti** i giri puliti, si raggruppano per fascia di gap, e
`G*` è **la più piccola fascia il cui residuo mediano ha l'IC95 (bootstrap sui blocchi =
gare) che contiene lo zero**. Cioè: la distanza oltre la quale l'auto davanti non si vede
più nei tempi. Non è un modello di traffico: è una soglia di esclusione.

**Pit-loss**, ricostruito dal fondo: per ogni sosta reale, `(t_inlap + t_outlap) − (attesa
pulita ai due giri)`, con l'attesa presa dal modello. Mediana sulle soste della gara ⇒
pit-loss di quella gara. Nessun numero pit-loss ereditato dal progetto (sono tutti
retrocessi a ipotesi).

## 3. C1 — il modello più semplice

Per gara (blocco), sui giri puliti (verde puro, no in/out-lap, slick, gara asciutta, età ≥ 3,
outlier 1,07× mediana di stint).

**Filtri aggiuntivi del controfattuale, dichiarati qui prima dei numeri**: la gara entra
nel confronto solo se **nessun giro di nessun pilota è neutralizzato** (status che contiene
'4' o '6' — SC/VSC nella decodifica committata): sotto safety car il tempo reale contiene
secondi che nessun modello di degrado può spiegare, e il confronto sarebbe truccato in
partenza. Il pilota entra solo se ha **tutti i giri da 2 a N** con tempo valido (niente
ritiri, niente buchi). Entrambi i lati del confronto vivono sugli stessi giri.

```
t − carburante_congelato(L) = α_pilota + δ_mescola + β·(giro − ḡiro)
                              + Σ_c ρ_c · età · 1[mescola = c] + ε
```

`ρ_SOFT`, `ρ_MEDIUM`, `ρ_HARD` sono il degrado: secondi persi al giro per giro di vita
gomma. `β` assorbe evoluzione pista e residuo di carburante. Effetti fissi di **pilota**,
mai di stint (assorbirebbero l'identificazione). SE cluster-robust per (pilota, stint).
**Regimi separati, sempre**: 2022-25 e 2026 mai insieme.

**Aggancio nel kernel**: `demo/engine.mjs` riceve un parametro `degrado` **opzionale**.
Assente ⇒ comportamento **bit-identico** a oggi. Presente ⇒ il passo del pilota diventa
`p + rate·(età − età₀)` — forma incrementale, che **non ri-conta** il degrado già dentro
il passo base misurato. Il golden si rifà **una volta** attorno alla nuova forma: con
l'aggancio spento deve restare 449/449 e 11/11.

**Fuori campione**: le pendenze si stimano sulle gare di indice **pari** (ordine
cronologico), la X si misura sulle gare **dispari**. Mai la stessa gara nei due ruoli.

## 4. CRITERIO DI STOP — dichiarato PRIMA di misurare

Il degrado si ferma quando è **utile**, non quando è perfetto. È la lezione del carburante
(cinque giri di raffinamento su un mattone già dentro tolleranza).

> **ABBASTANZA CASI**: ≥ 30 casi valutabili in aria libera per regime, su ≥ 8 gare distinte.
> **ABBASTANZA NETTO**: il modello batte il reale in **≥ 60 %** dei casi valutabili **e** il
> margine mediano delle vittorie è **≥ 2 · tol**.

Se C1 soddisfa entrambe: **il degrado lineare è pronto per il tavolo e non lo spremo**.
C3 si esegue comunque perché è previsto, ma è dichiarato **informativo**, non necessario.
Se non le soddisfa, C3 è il tentativo di colmare il divario.

## 5. C2 — dove fallisce, e la prima ipotesi

Raggruppo i casi persi per **circuito · mescola · regime · lunghezza stint · temperatura
pista** (`wTT`, metadato della stessa fonte, solo per raggruppare).

**Prima ipotesi, portata dal carburante**: il degrado è **per-circuito**? Si applica il
metro a due condizioni **già validato** — (i) segno stabile rispetto al globale
leave-circuit-out, (ii) distanza netta — ma con la soglia **riderivata per questo
fenomeno**: il degrado ha un'altra dispersione, e la soglia del carburante (0,869 s) non
gli appartiene. Si deriva con la **stessa procedura sigillata** (`metro2.soglia_da_nulla`,
chiamata senza modificarla), al 5 % di falsi positivi congiunti.

## 6. C3 — un termine, uno solo

L'agente propone **un** termine aggiuntivo suggerito da C2, lo monta sull'aggancio, rifà il
golden, rimisura la X. `X_nuova` vs `X_vecchia`. Se migliora: candidato per il tavolo. Se
no: dichiarato e scartato. Nessun secondo tentativo in questa sessione.

## 7. Confondimenti, dichiarati prima di misurare

| con cosa | come lo isolo | che cosa resta |
|---|---|---|
| **carburante** | congelato sotto e sottratto; `β` assorbe il residuo lineare | il degrado è quasi insensibile alla scelta del carburante (lo verifico); resta la contaminazione nei **totali** del controfattuale |
| **traffico** | (a) il modello si stima **solo su giri in aria libera**; (b) un caso è ammesso solo se il **rientro di ogni sosta** della strategia ottima cade in aria libera, con `G*` derivata dai dati | i casi con rientro in traffico sono esclusi e **contati**: se ne restano pochi, è un fatto da sapere |
| **evoluzione pista** | assorbita da `β` insieme al residuo di carburante | non separabile: come per il carburante, resta dichiarata |

## 8. Vincoli

Solo il fondo · blocchi = gare · il permutation-null è **sotto sigillo** (`sigillo_null.py`):
lo chiamo, non lo tocco · ogni valore col suo generatore committato · l'agente porta la X,
**decidono gli umani** (regola d'ingaggio 90 %/70 %) · nessun push, PR, merge.
