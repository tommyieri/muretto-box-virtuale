# REPORT — FASE 2: l'età gomma, e l'audit del kernel

*28/07/2026. Autorizzazione del PO: **anche il kernel è in discussione**, si correggono gli
errori anche se spostano risultati già dati.*

**In una riga:** la sosta smette di essere uno sconto costante e torna a essere quello che è —
un **azzeramento dell'età gomma**. G0 passa da **0,0 % a 70,0 %**, spariscono tutte le 88 curve
piatte, e **tutti e 337 i casi** mettono il minimo dove l'ottimo analitico dice. La soglia
pre-registrata dell'80 % **non passa**, e il motivo è che **la metrica che ho scritto io era
mal specificata**.

---

## 1. L'audit del kernel — tre difetti, misurati

`engine/engine.py` letto riga per riga. Tre difetti in `pace_base`, tutti nel filtro «verde»:

| | difetto | dove |
|---|---|---|
| **D1** | `_neut(s) = ('4' in s) or ('6' in s)` — l'alfabeto è `{1,2,4,5,6,7}` e **`5` è bandiera rossa**, **`2` è gialla di settore**. Il kernel li conta **verdi**. | `engine.py:20` |
| **D2** | il filtro non guarda la **mescola**: un giro su intermedia entra nella mediana insieme agli slick | `engine.py:45` |
| **D3** | il filtro non esclude i **giri cancellati**: `CarObs` non porta nemmeno la colonna `del`, quindi il kernel non può saperlo | `engine.py:11-13` |

Il vocabolario che smentisce D1 è in repo da mesi: `data/STATUS_VOCABOLARIO_NOTA.md`.

### Quanto costano — misurato, non supposto

Su 10.875 giri che il kernel conta come verdi nel 2026:

```
421 giri (3,87 %)  bandiera GIALLA contata come verde
153 giri (1,41 %)  giri CANCELLATI contati come verdi
 30 giri (0,28 %)  mescola da BAGNATO nella mediana asciutta
  0 giri           bandiere rosse (il 2026 non ne ha)
```

Effetto sul passo, ricalcolando `pace_base` col filtro stretto (11.240 celle pilota-giro):

| | |
|---|---|
| scarto **mediano** | **0,0000 s** |
| celle spostate di **> 0,10 s** | **1.278 — 11,37 %** |
| celle spostate di **> 0,50 s** | 92 — 0,82 % |
| scarto **massimo** | **2,93 s** |

**Come si legge.** Il passo è una mediana: un giro sporco su venti non la sposta, e infatti lo
scarto tipico è zero. Il danno è **tutto nelle code**, e le code sono esattamente i casi in cui
il pilota ha pochi giri validi nello stint — cioè **subito dopo una sosta**, che è il momento
in cui il muretto guarda il pannello.

### Il fix, e perché non l'ho fatto qui

Il filtro corretto ha bisogno di `status` grezzo e di `del`. **`demo/data/<gara>.json` non li
esporta**: porta un `neutralized` booleano già calcolato con la regola sbagliata. Quindi:

- **D2 è già chiuso** nel mio codice: `passo.mjs` richiede `compound ∈ {SOFT, MEDIUM, HARD}`.
- **D1 e D3 non sono chiudibili a valle**: l'informazione non arriva. Vanno chiusi
  **nell'esportatore**, aggiungendo `status` e `del` al per-giro, e poi in `engine.py:20`.

È una **modifica di schema dei dati** più una rigenerazione delle 11 gare: va fatta, ed è la
prima voce della lista dopo questa fase. Insieme le sta il difetto già trovato in Fase 0 (il
letterale `"None"` non lavato, 25 celle in Ungheria): stessa causa, stesso posto.

---

## 2. Il cambio di forma

```
OGGI     dopo la sosta il pilota prende un GRADINO costante (-0,92 s/giro) per sempre
FASE 2   la sosta AZZERA l'eta gomma; il passo e base + delta*(giro-1) + rho*eta
```

Non è una taratura, è un cambio di forma, ed è tutta qui la differenza fra un esploratore e un
simulatore: con lo sconto costante anticipare è **sempre** meglio e la derivata non cambia mai
segno; con l'azzeramento anticipare accorcia il primo stint e allunga il secondo, e la somma
delle età vissute ha un minimo **in mezzo**.

**Un difetto mio, corretto strada facendo.** In `passo.mjs` l'età dopo la sosta era contata dal
**congelamento** invece che **dalla sosta**: la gomma nuova nasceva già vecchia di quanti giri
erano passati. Ora l'età è una variabile esplicita che si azzera al pit — non c'è più modo di
sbagliarla.

---

## 3. G0 — il risultato

337 soste vere, Monaco escluso, tre motori sulla stessa domanda:

| motore | curve piatte | al 1° giro | all'ultimo | **INTERNO** | **G0** |
|---|---|---|---|---|---|
| **A · oggi** | 88 | 247 | 2 | 0 | **0,0 %** |
| **B · Fase 1** (deriva) | 88 | 247 | 2 | 0 | **0,0 %** |
| **C · Fase 2** (età gomma) | **0** | 101 | 0 | **236** | **70,0 %** |

> **G0 = 70,0 % · soglia 80 % · NON PASSA**

### Ma la metrica è mia, ed è sbagliata

I 101 casi al bordo non sono fallimenti. Verificato uno per uno contro l'ottimo analitico
`p* = (giri rimasti − età)/2`:

```
(R - eta)/2 <= 1  ->  76 casi
(R - eta)/2 <= 2  ->  96 casi
(R - eta)/2 <= 3  -> 101 casi     <- TUTTI
```

**Tutti e 101 cadono al bordo perché la risposta giusta è «fermati subito»**: quelle gomme sono
già troppo vecchie perché l'ottimo cada più avanti. Sommando: **337 su 337 mettono il minimo
dove l'ottimo analitico dice.**

G0 era stata scritta per catturare un difetto preciso — *il motore non ha una preferenza, ha
una monotonia* — e quel difetto lo cattura benissimo (A: 0 % e 88 curve piatte). Ma conta come
fallimento anche la **risposta corretta al bordo**, che è una cosa completamente diversa.

**Non dichiaro G0 passata.** Riscrivere la soglia dopo aver visto il numero è esattamente ciò
che la pre-registrazione impedisce, e vale anche quando ho ragione. Metto agli atti i due
numeri e la diagnosi, e la metrica giusta per il futuro:

> **G0′** = quota di casi in cui il minimo cade **dove l'ottimo analitico lo colloca** (interno
> quando dev'essere interno, al bordo quando la risposta è «fermati subito»). Misurata:
> **337/337 = 100 %**. Da pre-registrare *prima* della prossima fase, non applicare a questa.

---

## 4. Il controllo che non era previsto, e vale più del cancello

Il `gradino` che il prodotto misura oggi viene dalle **soste realmente avvenute in quella
gara**. ρ viene dalla **pendenza dentro gli stint di 10 gare**. Sono due misure indipendenti,
da due fenomeni diversi. Se il modello è giusto, il gradino deve valere circa `−ρ × età della
gomma tolta`:

| | |
|---|---|
| gradino **misurato** in gara (media) | **−1,108 s/giro** |
| **−ρ × età** della gomma tolta | **−0,804 s/giro** |
| scarto mediano | −0,303 s/giro |

Stesso segno, stesso ordine di grandezza, e la differenza ha un verso sensato: la sosta vera
porta anche altro (mescola diversa, warm-up, benzina che nel frattempo è scesa) che il solo
azzeramento dell'età non contiene. **Due strade indipendenti che arrivano vicine**: è il
sostegno più forte che questa fase abbia prodotto, e non era un cancello.

---

## 5. Cosa cambia per chi guarda

```
posizioni di rientro confrontate: 338
cambiate: 47  (13,9 %)   -   10 rientri MIGLIORI, 37 PEGGIORI, massimo 2 posizioni
```

**Questa volta il prodotto si muove davvero**, e la differenza con la Fase 1 è istruttiva: lì
il termine era comune a tutti i piloti e non poteva cambiare un ordine (0/338, quasi una
tautologia — corretto nel report di Fase 1). Qui ρ·età è **specifico del pilota**, perché le
gomme hanno età diverse, ed è per questo che morde.

Il verso è quello atteso: più rientri **peggiori** che migliori. Oggi il motore regala uno
sconto costante a chi si ferma; togliendolo, chi si ferma con gomme giovani non guadagna più
niente di gratuito.

**È un cambio di promessa e lo decide il PO, non il banco.** Un numero in pagina si muoverà.

---

## 6. Le tre correzioni a lavoro già consegnato

Il PO ha detto di correggere anche a costo di spostare risultati precedenti. Tre lo fanno:

1. **Il T6 di Fase 1 era gonfiato.** «Passa nel modo più forte possibile» era falso: il test
   non aveva quasi potere di fallire (dispersione di `base − pace` fra piloti: 0,033 s
   mediana). Corretto nel report di Fase 1.
2. **L'età dopo la sosta era contata dal congelamento** in `passo.mjs`. Corretto.
3. **G0 è mal specificata** (§3). Non riscritta retroattivamente; sostituta proposta.

E resta in piedi la correzione di Fase 1 su Fase 0 (il Φ poolato) e quella di Fase 0 su se
stessa (la pinv silenziosa).

---

## 7. Raccomandazione

1. **Chiudere i difetti del kernel** (§1): `status` e `del` nell'esportatore, `_neut` corretto,
   mescola nel filtro, letterale `"None"` lavato. È l'unica voce che non ha controindicazioni:
   nessuno difende un giro cancellato dentro una mediana.
2. **Pubblicare Fase 1 + Fase 2 insieme.** Fase 1 da sola è invisibile; insieme portano il bias
   sui tempi da −2,19 a −0,17 s/giro e danno al prodotto la domanda che la home page promette
   da sempre: **quando fermarsi**.
3. **Mettere in pagina il cambio**, non nasconderlo: il 13,9 % di posizioni che si muovono va
   dichiarato come è stato dichiarato il cap del traffico.

---

### Riprodurre

```bash
python3 ai_lab/simulatore/audit_kernel.py
node    ai_lab/simulatore/banco_fase2.mjs --json ai_lab/simulatore/esito_banco_fase2.json
```
