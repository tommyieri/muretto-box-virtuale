# Esito — la terza forma compatta il campo **3,5 volte meglio**, e il prodotto non se ne accorge

**Data: 15/08/2026.** Esegue `PREREG_terza_forma.md`, sigillata a `a6a5e1f` prima di
scrivere una riga del kernel. Banco: `ai_lab/confronto/terza_forma.mjs`.
**La terza forma resta SPENTA**: i numeri di produzione sono bit-identici a stamattina.

---

## I sei cancelli

| | | esito |
|---|---|---|
| **T1a** larghezza del campo dove la realtà compatta | sotto 2,0 in **2 su 5** (ne servivano 3) · **meglio della seconda in 5 su 5** · guadagno mediano **3,47×** | **ROSSO** |
| **T1b** e dove non compatta | oltre 1,5 in **0 su 6** | **VERDE** |
| **T2** i giri impossibili non tornano | 0 sotto il pavimento · 0 negativi · **clamp pavimento = 0** | **VERDE** |
| **T3** e non ne nascono dall'altra parte | 570 sopra il soffitto, **di cui nuovi 0** · sui soli giri compressi **0 → 0** · il soffitto lega 427/13.415 (**3,2%**) | **ROSSO** (cancello mal scritto, vedi §3) |
| **T4** il prodotto | 17-14 a favore della terza, **p = 0,72** · mediana 1 = 1 · media 1,617 → 1,570 | **non-inferiore, NON superiore** |
| **T5** il placebo | vero 3,56× (distanza da 1: **1,27**) contro finte mediana 8,97× (5° percentile della distanza: **2,03**) | **PULITO** |

## 1 · La larghezza del campo: il meccanismo funziona

Larghezza (ultimo − primo) all'ultimo giro neutralizzato di ogni gara:

| gara | L* | vero | **seconda forma** | **terza forma** |
|---|---|---|---|---|
| **Monaco** | 70 | 3,6 | 240,5 (**67,6×**) | 34,2 (**9,6×**) |
| **Gran Bretagna** | 52 | 8,1 | 158,9 (**19,6×**) | 32,6 (**4,0×**) |
| **Cina** | 13 | 6,7 | 41,7 (6,3×) | 23,7 (3,6×) |
| **Giappone** | 27 | 22,7 | 88,0 (3,9×) | 25,6 (**1,1×**) |
| **Miami** | 11 | 8,8 | 26,0 (3,0×) | 7,4 (**0,9×**) |
| Ungheria · Belgio · Austria · Canada · Spagna | | | 1,07 · 0,94 · 0,92 · 0,91 · 0,77 | 1,07 · 0,94 · 0,91 · 0,91 · 0,74 |
| Australia | 34 | 1.263,7 | 0,10× | 0,10× |

**Cinque su cinque migliorano, due arrivano a destinazione.** Monaco passa da un errore di
fattore 68 a uno di fattore 10; la Gran Bretagna da 20 a 4. Il campo del motore, che non si
compattava mai, adesso si compatta.

**E non compatta dove non deve** (T1b): sulle sei gare in cui la realtà non stringe il
campo, il rapporto non si muove di un centesimo oltre 1,5. Era il rischio speculare —
senza il pavimento a fermarla, la compressione geometrica poteva stringere il campo dove
non c'era niente da stringere — e non si è materializzato.

**T1a resta ROSSO** perché la soglia dichiarata era «sotto 2,0 in almeno 3 su 5» e ne sono
uscite 2. Non la sposto. Un miglioramento di 3,47× che manca la soglia è un miglioramento
che manca la soglia.

## 2 · Il placebo dice che è merito del **dove**

La stessa identica terza forma applicata a giri **verdi** scelti a caso, in numero uguale
ai neutralizzati veri di ogni gara (200 estrazioni, seme 20260815), porta il rapporto a una
mediana di **8,97×** contro il **3,56×** vero. In distanza logaritmica da 1: **1,27** contro
un 5° percentile delle finte di **2,03**.

Aggiungere la stessa quantità di tempo nel posto sbagliato **peggiora**. L'effetto è
«compattare sotto Safety Car», non «aggiungere tempo».

## 3 · T3 è rosso per colpa mia, e resta scritto

Il soffitto è il giro più lento percorso **sotto neutralizzazione**, e il kernel lo applica
**solo lì**. Il cancello l'ho scritto su **tutta la gara**: conta quindi anche gli in-lap in
verde. I 570 giri «sopra il soffitto» sono tutti **in-lap in Ungheria** — 86 s di passo
verde più 20 di sosta contro un soffitto di 106,9 — e sono **identici nelle due forme**
(nuovi: **zero**).

Il numero che rispondeva alla domanda vera è la sotto-conta sui soli giri compressi:
**0 nella seconda forma, 0 nella terza**. Il cancello resta com'è scritto e a referto —
non si riscrive dopo averne visto l'esito (regola 3) — ma il difetto è nella mia
specifica, non nella forma. È la famiglia E08, ed è la seconda volta questa settimana.

**Il soffitto lega nel 3,2% delle coppie compresse**, sotto la soglia del 20% oltre la quale
il risultato si sarebbe dichiarato trattenuto dalla propria guardia. Il guadagno di T1 è
della forma, non del vincolo.

## 4 · T2: l'aritmetica regge

**Zero** giri sotto il pavimento, **zero** negativi, e il contatore del pavimento è a
**zero**: nella terza forma il vincolo non lega mai perché non c'è niente da difendere —
ogni delta è ≥ 0 per costruzione. È la proprietà che rende questa forma diversa in natura
dalla precedente, e adesso è misurata su 193 casi e sorvegliata da s30.

## 5 · T4: il prodotto non si muove, ed è il risultato che decide

| | nullo | seconda forma | terza forma |
|---|---|---|---|
| errore mediano | 1 | 1 | 1 |
| errore medio | | 1,617 | **1,570** |
| bias segnato | | −0,021 | −0,047 |

Test dei segni appaiato sui 193 casi: **17 a 14** per la terza, **p = 0,72**. L'IC95 della
differenza mediana a blocchi = gare è **[0 ; 0]**.

**La terza forma cambia l'arrivo in 33 casi su 193.** In un caso su sei, e quando lo cambia
è un lancio di moneta.

Perché così poco, ed è la lettura onesta: **la compressione è una moltiplicazione positiva
dei distacchi, quindi conserva l'ordine in tutte e due le forme.** Stringere il campo non
sposta nessuno di per sé — prepara soltanto il terreno perché lo faccia quel che viene
dopo. Evidentemente quel che viene dopo, nel motore, non lo fa: i giri verdi che seguono
riaprono i distacchi prima che le soste possano contare.

Questo si aggancia esattamente al referto del 15/08 sulle 62 coppie mancate: il motore sa
**quali** auto si scambiano (φ = 0,305) ma ne fa 36 su 82, e le mancate sono concentrate in
una quindicina di **eventi**. La larghezza del campo era una delle condizioni di quegli
eventi — ma è una condizione **necessaria e non sufficiente**.

## 6 · Verdetto

**La terza forma resta spenta.** T4 dà la non-inferiorità e non la superiorità, e la prereg
dichiarava che senza superiorità non si accende niente.

Cosa resta acceso comunque, perché è codice e dati e non un verdetto:

- il **soffitto** (`data/modelli/soffitti_2026.json` + `provenienza/genera_soffitti.mjs`),
  misurato col protocollo del pavimento, pinnato nel manifest;
- l'opzione `forma: 'leader'` nel kernel, **spenta di default** e sorvegliata da s30 con
  cinque prove nuove — fra cui T6, che verifica che sia ancora la **stessa legge**
  (gli stessi gap alla settima cifra) e non un modello diverso;
- `legge_compressione.mjs`, la legge per fascia di distacco sul fondo.

## 7 · Cosa NON scrivo

**Non dico che la terza forma è sbagliata.** Fa quello per cui è stata costruita — il campo
si compatta, il placebo dice che è merito del posto giusto, e non produce un solo giro
impossibile in nessuna delle due direzioni. Dice però una cosa scomoda sull'autopsia di
ieri: **la larghezza del campo non era la causa del deficit di movimento**, o non da sola.
Avevo scritto che era «il pezzo che sei cancelli non hanno visto», ed era vero; ma vederlo
e ripararlo non basta.

**Non riapro il duello.** **Non spengo il pavimento.** **Non sposto T1a a 3,5×** per farlo
diventare verde.

**Cosa misurerei dopo**, e non lo faccio oggi: se il campo compattato **si riapre**, cioè
quanto durano quei 34 secondi di Monaco nei giri verdi che seguono. Se si riaprono in tre
giri, la terza forma è un fotogramma e non uno stato, e il bersaglio è la fisica del verde
dopo la ripartenza. Si risponde con la traccia che questo banco già produce.

---

*Sei cancelli misurati su sei, due rossi dichiarati e non spostati. Nessun parametro di
produzione toccato. Suite senza regressioni.*
