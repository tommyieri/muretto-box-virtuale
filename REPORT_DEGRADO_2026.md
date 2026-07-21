# Il degrado 2026 — RESTA SPENTO

Branch `ai-lab/degrado-2026-live`. Prereg: `ai_lab/scienziato/PREREG_degrado_2026.md`,
committato **prima** di qualunque numero (commit `dbc08b4`).
Generatori: `run_degrado_2026.py`, `modello_degrado.py`, `degrado_verde.py`, `degrado_metro.py`.

## In una riga

**Il degrado 2026 NON è accendibile e resta spento da solo.** Non perché manchino i dati, ma
perché nel 2026 **non esiste una pendenza comune da far viaggiare**: dentro ogni gara la stima
è precisa, fra le gare cambia segno. Alla prossima gara il modello si ricalibra da sé e
ritenta il proprio cancello, senza che nessuno debba ricordarsene.

---

## 0. Il muro della sessione precedente è caduto (ed era una regola, non un dato)

`esito_degrado.json` diceva: 2026 `n_gare_utili: 0, misurabile: false`. Il colpevole era il
**veto di gara**: `degrado.neutralizzata()` scartava l'intera gara per **un solo giro** sotto
SC/VSC.

| | |
|---|---|
| gare 2026 nel fondo | 10 (0 bagnate) |
| gare con almeno un giro neutralizzato | **10 su 10** |
| quota di giri neutralizzati per gara | **5,7 % – 15,9 %** |

Il veto costava il **100 % del regime** per proteggersi dal ~10 % dei giri. L'ho sostituito con
la **contabilità a giri verdi**: l'età gomma avanza su tutti i giri, il **tempo** si conta solo
sui verdi, identici sui due lati del confronto. Dichiarata nel prereg §0 **prima** dei numeri.

**Non l'ho chiesto sulla fiducia:**

- **Equivalenza**: a maschera piena la macchina nuova **ritrova** la vecchia — 19 confronti,
  **0 scostamenti** oltre 0,05 s. Dimostrata, non dichiarata.
- **Falsificazione F**: non scatta, **ma è VACUA e lo dico**. Dove il veto permetteva il
  confronto, i giri non verdi sono lo **0,73 %**: le due contabilità sono quasi lo stesso
  oggetto, e un pareggio non è una promozione.
- **Falsificazione F2**, aggiunta **dopo** aver visto F vacua — test **più severo**, non più
  permissivo: sulle 28 gare storiche **neutralizzate**, dove le contabilità divergono davvero.
  Non scatta (mediana appaiata +0,0000, IC95 [0; 0,333]).

---

## 1. Il pit-loss era rotto, e l'ho riparato PRIMA di giudicare

Il primo C1 dava `tol = 223,9 s` su ~50 giri verdi: **4,5 s al giro**. Un metro così non
giudica niente.

**Diagnosi dal fondo**: i residui per giro sono sani (−0,16 / +0,10 s, **in aria libera come in
traffico** — il traffico non c'entra). Il buco era tutto nel **pit-loss**, che
`degrado.pit_loss()` mediava su **tutte** le soste. Una sosta fatta **sotto safety car** vale,
in cronometro, 32-96 s invece di ~20-25 — e sotto SC ci si ferma **tutti insieme**: in metà
delle gare 2026 le soste neutralizzate sono la **maggioranza**, così la mediana era contaminata.

| gara | pit-loss da TUTTE le soste | dalle sole soste VERDI |
|---|---|---|
| Australia | **51,84** | 24,95 |
| Canada | **57,28** | 25,14 |
| Cina | **73,70** | 26,84 |
| Monaco | **64,29** | 21,78 |
| Miami | 19,53 | 19,53 |

**Corroborazione esterna, come controllo e non come input** (il prereg vieta di ereditare
numeri di pit-loss): la mia ricostruzione da sole soste verdi dà **Miami 19,53** e
**Silverstone 20,97**; i valori che il progetto ha in produzione da **FastF1** — fonte
completamente diversa — sono **20,11** e **20,80**. Due strade indipendenti, stessa risposta a
mezzo secondo. `tol` scende **223,9 → 55,3 s**.

**Non ho toccato nessuna soglia di giudizio.** Ho riparato lo strumento, non spostato il
traguardo: `X ≥ 60 %`, `margine ≥ 2·tol`, IC95 che esclude lo zero sono rimasti identici. Il
primo giro di numeri è scritto nel prereg (§7-ter), non cancellato.

---

## 2. C1 — il modello lineare 2026

Calibrato **solo sul 2026**. 10 gare: 5 di calibrazione (pari), 5 di verifica (dispari).
**Più severo della sessione precedente**: lì il ρ della gara era stimato *sulla gara stessa*
(dentro campione per l'oggetto sotto esame). Qui il ρ **viaggia** dalle sole gare di
calibrazione — al via di domenica dev'essere già noto. α, β, δ restano per-gara (parametri di
disturbo: «SOFT» a Monaco non è la stessa gomma fisica che a Silverstone).

**Pendenze (s/giro per giro di vita gomma), mediana cross-gara, IC95 su blocchi = gare:**

| mescola | ρ (calibrazione) | IC95 | gare sotto |
|---|---|---|---|
| SOFT | +0,0209 | **[−0,0233; +0,2393]** | 4 |
| MEDIUM | +0,0011 | **[−0,0141; +0,0948]** | 4 |
| HARD | +0,0395 | [+0,0096; +0,0877] | 4 |

Gli intervalli sono **larghi e li riporto larghi**: due su tre contengono lo zero.

**Controllo di sanità SOFT > MEDIUM > HARD: NON esce.** Sulle 5 gare di calibrazione l'ordine è
`HARD > SOFT > MEDIUM`. (Sulle 10 gare intere l'ordine *esce* — 0,0541 / 0,0441 / 0,0398 — ma
il fatto che dipenda da quale metà si guarda **è il sintomo**, non la sua smentita.)

**La X batte-il-reale, fuori campione: 6,2 %** (1 vittoria su 16 casi valutabili, 3 gare) —
sotto la numerosità minima dichiarata (30 casi, 4 gare) ⇒ **NON GIUDICABILE**.

**Cancello (A), contro il degrado-zero RISTIMATO** (non un fantoccio: rifatto senza le colonne
dell'età, così α/β/δ assorbono quello che possono — emendamento §7-bis, **contro** il mio
interesse):

| gara | errore modello | errore non-fare-niente | guadagno |
|---|---|---|---|
| Austria | 44,52 s | 21,08 s | **−23,44** |
| British | 4,35 s | 26,96 s | +22,61 |
| Cina | 12,73 s | 16,21 s | +3,48 |
| Miami | 19,39 s | 4,29 s | **−15,11** |
| Spagna | 65,13 s | 7,58 s | **−57,56** |

Guadagno mediano **−15,1 s**, IC95 **[−57,6; +22,6]**. È una **moneta**: 2 gare il modello,
3 gare il non-fare-niente. **NON superato.**

---

## 3. C2 — dove fallisce: NON è il cliff

Il prereg §5 aveva piantato una predizione falsificabile: *se è il cliff, il residuo deve
crescere con l'età gomma nella coda*.

| età gomma | 3-9 | 10-14 | 15-19 | 20-24 | 25-29 | 30+ |
|---|---|---|---|---|---|---|
| residuo mediano (s) | +0,04 | +0,31 | +0,03 | +0,01 | **−0,12** | −0,03 |

**Piatto. La predizione del cliff è FALSIFICATA**: nei dati 2026 il crollo di fine vita non si
vede, e C3 non ha bersaglio.

**Il difetto vero è un altro**, e questa è la scoperta della sessione:

- **dentro** la gara ρ è **preciso**: ρ/SE = 3-13 in **8 gare su 10**;
- **fra** le gare il **segno flippa**: SOFT 2 negative su 5, MEDIUM 2 su 9, HARD 1 su 9;
  escursione **0,12-0,26 s/giro** contro mediane di 0,02-0,04.

Precisione dentro **+** instabilità fuori **=** ogni gara sta misurando **con cura una cosa
diversa**. Non è rumore: è confondimento. Nel 2026 **non c'è una pendenza comune da far
viaggiare**, ed è per questo che il ρ viaggiante peggiora Austria, Miami e Spagna.

La prova più brutale la dà l'auto-aggiornamento stesso: **togliere una gara su dieci muove
ρ_MEDIUM del 41,5 %**.

---

## 4. C3 — soglia + rampa: DICHIARATO E SCARTATO

Declassato a **informativo** (C2 aveva già tolto il bersaglio), ma con il freno intatto.
Ginocchio `k* = 12` scelto **solo** sulle gare di calibrazione.

| prova | esito |
|---|---|
| guadagno di ricostruzione fuori campione | **−2,125 s** (peggiora), IC95 [−10,29; +0,71] |
| **PLACEBO — ginocchio finto** | **35 %** dei ginocchi a caso fa **almeno quanto** quello vero |
| X_nuova vs X_vecchia | **3,9 % contro 6,2 %** (scende) |
| margine dichiarato prima (IC95 appaiato) | [−0,125; 0] — **non esclude lo zero** |

**Tre bocciature concordi. Scartato.** Nessun secondo tentativo mascherato da variante.
Il placebo ha fatto esattamente il lavoro per cui era stato teso **prima** di guardare: il
guadagno del termine in più era **flessibilità**, non fisica.

> Il placebo del ginocchio finto è un **NULL NUOVO** e **non l'ho auto-sigillato**: se il tavolo
> lo vuole permanente, lo sigilla Tommi al merge con `--attore`.

---

## 5. L'aggancio ai modelli vivi

Una riga nel REGISTRO, come previsto dal pattern:

```python
REGISTRO = [
    ModelloTraffico('2026', uscita='data/modello_traffico_2026.json'),
    ModelloDegrado('2026',  uscita='data/modello_degrado_2026.json'),   # <- questa
]
```

**Auto-aggiornamento provato** togliendo e rimettendo una gara:

```
1. rieseguo senza dati nuovi   -> file invariato (10 gare). IDEMPOTENTE.
2. tolgo "2026 Miami"          -> ricalibrato 10 -> 9 gare
                                  rho_MEDIUM +0,01830 | rho_HARD +0,01140
                                  movimento massimo 41,5% -> BALLA ANCORA: regime povero
3. la rimetto                  -> ricalibrato 9 -> 10 gare, movimento esattamente opposto
```

Il **cancello di accensione sta dentro il modello** e scrive nel json:

```
"ACCENDIBILE": false
  A_predittivo: SUPERATO false — guadagno mediano -15,107 s, IC95 [-57,556; +22,609]
  B_prodotto:   SUPERATO false — 16 casi su 3 gare (ne servono 30 su 4), X = 6,25 %
```

Il **limite onesto è scritto DENTRO** `data/modello_degrado_2026.json`, e viaggia col numero:
regime 2026 soltanto · 10 gare sotto, intervalli larghi · cieco su pioggia e giri neutralizzati
· **il degrado non è per-circuito** (già falsificato, 0 su 8) · **niente cliff** (montato e
scartato) · controllo di sanità SOFT>MEDIUM>HARD fallito · **segno instabile fra gare** ·
**spento da solo**.

**Golden dopo l'aggancio**: `test_b` **449/449**, `test_pit` OK, `test_degrado_hook` PASS,
sigillo **INTEGRO** (sha256 invariato), sorveglianza PASS. `demo/engine.mjs` ed `engine/engine.py`
**non sono stati toccati**: l'aggancio `degrado` era già predisposto e resta **spento**.

---

## 6. FERMO — una zona-null da guardare, che NON ho toccato

Durante la prova dell'auto-aggiornamento il file del modello **traffico** ha cambiato i propri
numeri di placebo pur girando sulle **stesse 10 gare** (`separazione_finta` 0,155 → −0,050).

`traffico.placebo_leader` **è sotto sigillo** ed è seminata (`seed=20260721`), ma pesca i
candidati da un **set**: l'ordine di iterazione di un set di stringhe cambia da processo a
processo. Misurato su Miami:

```
PYTHONHASHSEED=1  costo mediano placebo = 0,0744  (n = 126)
PYTHONHASHSEED=2  costo mediano placebo = 0,0999  (n = 135)
PYTHONHASHSEED=3  costo mediano placebo = 0,0744  (n = 132)
```

**Il numero di placebo registrato nel modello traffico non è riproducibile.**

**Mi sono fermato qui e non ho corretto niente**, come impone la regola: toccare un null —
*anche solo per determinismo* — richiede autorizzazione umana, e non esiste l'auto-giudizio
«è solo determinismo». **Decide Tommi.**

Nota collaterale, non-null: `gen_modelli_lab.py --senza-gara` applica l'esclusione a **tutti**
i modelli del REGISTRO e ne **riscrive i file**. Una *prova* scrive artefatti veri; ora che i
modelli sono due si vede. Ho ripristinato `data/modello_traffico_2026.json` allo stato
committato.

---

## 7. La frase

> **Il degrado 2026 resta SPENTO.** Non ha superato né il cancello predittivo (contro il
> non-fare-niente è una moneta: −15,1 s, IC95 [−57,6; +22,6]) né quello di prodotto (16 casi
> dove ne servono 30). Il cliff è stato cercato, montato e **scartato**: nei dati 2026 non c'è.
> Il vero ostacolo non è la forma del degrado ma **l'instabilità del segno fra gare**: dentro la
> gara la pendenza è precisa, fra le gare cambia verso, e togliere una sola gara su dieci la
> muove del 41,5 %.
>
> **Alla prossima gara** `auto_gara.py` eseguirà `gen_modelli_lab.py`, il modello si
> ricalibrerà **da solo**, aggiornerà la targhetta (11 gare sotto), registrerà di quanto si sono
> mossi i coefficienti e **ritenterà il proprio cancello**. Se lo supera, lo dirà scrivendo
> `ACCENDIBILE: true`. **Accendere resta un gesto umano.** Il mio consiglio: non aspettarsi che
> lo superi finché il segno continua a flippare — la cosa da guardare, gara dopo gara, non è la
> X, è **`stabilita_segno_fra_gare` nel json**. Quando `n_negative` andrà a zero per tutte e tre
> le mescole, allora varrà la pena riguardare la X.
