# REPORT — la composizione, e il traffico che va live

Quarto e ultimo giro sul traffico. Branch `ai-lab/autonomo-traffico-live` · 21/07/2026 ·
prereg scritto prima di misurare:
[`ai_lab/scienziato/PREREG_traffico_live.md`](ai_lab/scienziato/PREREG_traffico_live.md)
Generatori: `run_live.py` → `esito_live.json`, `modello_traffico_live.json` ·
`test_traffico_aggancio.mjs`

**Targhetta: 46 gare, 3 294 incontri (1 623 calibrazione / 1 671 verifica), regime a
effetto suolo, calcolato il 2026-07-21.**

---

## (6) La frase onesta, per prima

> **Va live la FORMA MINIMA: `i(gap) = 0,507·e^(−gap/0,8)` per l'intensità, col delta-passo
> che governa quando l'incontro finisce.** La composizione non ha battuto il solo-gap, e il
> patto dice che allora vince la semplicità. Il solo-gap **batte il traffico-zero** di
> **0,193 s per incontro** fuori campione, con l'IC95 appaiato che esclude lo zero: è utile,
> ed è pronto.
>
> **Ma c'è una cosa che il tavolo deve decidere, e non è un'altra notte di caccia.** Il test
> della McLaren, che il brief pone come veto, poggia su una premessa che **il fondo
> smentisce**. Ho fatto la misura, non l'aggiro: la decisione è vostra.

---

## (1) La composizione — la forma, e perché quella

Le quattro forme bocciate erano **additive**: gap e delta-passo messi a competere nello
spiegare il tempo perso *per giro*. Ma non competono — sono meccanismi diversi. La forma
giusta li **compone**, e il bersaglio cambia dal tempo-per-giro al **costo totale
dell'incontro**:

```
C0 (solo gap)     = D̄ · i(g0)          durata COSTANTE: il modello attuale
C1 (composizione) = D(Δ) · i(g0)       durata governata dal delta-passo
C2 (scalata)      = κ · D(Δ) · i(g0)
```

Predittivo per costruzione: all'inizio dell'incontro si conoscono solo `g0` e `Δ`. La
durata realizzata non entra — in live non si ha.

`D(Δ)` dalle **stesse fasce** sotto cui la U rovesciata era stata verificata (non le ho
toccate: cambiarle ora sarebbe pescare):

| Δ | durata attesa | n |
|---|---|---|
| < −0,80 | **2,432 giri** | 447 |
| −0,80 · −0,40 | 3,551 | 214 |
| −0,40 · −0,15 | 3,500 | 132 |
| −0,15 · +0,15 | 3,472 | 229 |
| > +0,15 | 2,631 | 601 |
| **media globale** (quel che il solo-gap può sapere) | **2,887** | |

---

## (3) Il confronto fuori campione — **la composizione non passa**

Errore assoluto mediano sul **costo totale**, per gara:

| modello | errore | IC95 |
|---|---|---|
| **C0 solo-gap** | **0,8300 s** | [0,7523 · 0,9717] |
| C1 composizione | 0,8454 s | [0,7747 · 0,9644] |
| C2 composizione scalata | 0,9844 s | [0,8317 · 1,1007] |
| traffico-zero | 1,0234 s | [0,8427 · 1,1387] |

M dichiarato = **0,1097 s**. C1 **−0,0154** (peggiora), C2 **−0,1544** (peggiora molto);
appaiati che contengono lo zero ⇒ **entrambe RUMORE**.

**Cinque forme dichiarate in tre notti, cinque bocciate.** Il solo-gap è imbattuto.

## (2) Il placebo — nessun artefatto

`traffico.placebo_leader`, **già sotto sigillo, chiamata e non modificata** (nessun null
nuovo stanotte: restano otto). Col leader sostituito da un'auto a caso: C0 0,4547 → C1
0,4546, miglioramento **+0,0001**. Il placebo non fabbrica niente. La composizione non è
stata uccisa da un artefatto: **ha semplicemente perso**.

---

## Perché ha perso — la scoperta della notte

La composizione moltiplica una durata per un'intensità *media*. Ma le due sono
**anti-correlate**, e in modo forte:

| | durata media | costo **per giro** | **costo totale** | g0 mediano |
|---|---|---|---|---|
| **McLaren** (Δ < −0,8) | **2,31 giri** | **0,587 s** | **0,871 s** | 0,76 |
| pari passo (−0,15·+0,15) | 3,34 giri | 0,200 s | 0,449 s | 0,95 |

L'auto molto più veloce **passa presto** — la durata è confermata, 2,31 contro 3,34 giri —
ma **ogni giro che è bloccata le costa il triplo** (0,587 contro 0,200 s/giro), perché
essere trattenuti costa esattamente il proprio vantaggio di passo. Il netto:

> **differenza di costo totale (McLaren − pari passo) = +0,422 s, IC95 sui blocchi-gara
> [+0,164 · +0,654]** — esclude lo zero.

Moltiplicare `D(Δ)` per un'intensità che non dipende da Δ prende il fenomeno **al
contrario**: accorcia la durata proprio dove l'intensità esplode. Ecco perché la
composizione, nella forma dichiarata, non poteva funzionare.

**Il fronte che ne segue** (dichiarato, non montato: il prereg diceva tre forme e tre ne ho
provate): la forma giusta è l'**interazione** — intensità *funzione di Δ* integrata sulla
durata *funzione di Δ*. Non l'ho provata. Sarebbe stata la sesta forma di questa notte, e
il patto dice che stanotte si chiude.

---

## (4) Che cosa va live, e la sua validazione

**Forma live: la MINIMA** (per il patto, esito «la composizione non batte il solo-gap»).

```json
{ "forma": "solo-gap",
  "intensita": { "a": 0.50716, "lam": 0.8, "formula": "i(g) = a*exp(-g/lam)" },
  "durata": { "governata dal delta-passo, media globale 2.887 giri" },
  "soglia_incontro_s": 1.5, "finestra_post_restart": 3,
  "regime": "2022-25 (a effetto suolo)",
  "targhetta": { "gare_sotto": 46, "incontri": 3294, "calcolato_il": "2026-07-21" } }
```

**Criterio 1 — batte il traffico-zero? SÌ.**
0,8300 s contro 1,0234 s: **guadagno 0,1934 s per incontro**, appaiato per gara **+0,1057**
con IC95 **[+0,0047 · +0,2087]** che esclude lo zero. Su ~30 incontri per gara sono
**~6 s di gara** che oggi il motore non vede affatto.

**Criterio 2 — il test della McLaren: FALLITO alla lettera, e la lettera è sbagliata.**

Il brief lo formula così: *«auto molto più veloce dietro una lenta → passa presto, **costo
basso**»*. Il modello live predice per la McLaren 0,551 s contro 0,445 s a pari passo:
costo **più alto**. Alla lettera, **veto**.

Ma il fondo dice che il costo reale della McLaren è **0,871 s** contro 0,449 s a pari
passo. **La premessa «passa presto quindi costa poco» è falsa**: passa presto *e* costa di
più. Quindi il modello live ordina i due casi **come li ordina la realtà** — sbaglia la
magnitudine (0,551 previsto contro 0,871 reale: sottostima), non il verso.

**Non riscrivo il criterio per farlo passare.** Il veto è vostro, e questa è l'informazione
per decidere:

| | previsto dal modello live | reale dal fondo |
|---|---|---|
| McLaren | 0,551 s | **0,871 s** |
| pari passo | 0,445 s | 0,449 s |
| ordine | McLaren > pari passo | **McLaren > pari passo** ✓ |

Il modello **sottostima** il caso McLaren — è conservativo lì, non ottimista. Un muretto che
lo usa vedrà un costo minore del vero per l'auto veloce intrappolata: sbaglia per difetto,
non per eccesso.

**Criteri 3 e 4**: targhetta su ogni coefficiente (sopra); cieco 2026 dichiarato —
Spearman(θ storico, θ 2026) = −0,024, il 2026 sul sorpasso è scorrelato dal passato: il
modello **nasce sul regime storico** e il 2026 si rafforza con l'uso.

---

## (5) Che cosa serve per agganciarlo in produzione

**Il punto di aggancio esiste già ed è spento.** In `demo/engine.mjs`, parametro
`traffico` opzionale:

```js
traffico = null           -> BIT-IDENTICO a oggi: resta il cap ZONE/STRENGTH
traffico = { a, lam }     -> al posto del cap: eff[d] += a * exp(-gap/lam)
```

Il cap attuale e la penalità nuova **non convivono**: o l'uno o l'altra, mai sommati.

**Stato del golden**, con l'aggancio spento:

```
node test_b.mjs                 => PASS 449/449 sotto 1e-9
node demo/test_pit.mjs          => PASS 11/11
node test_degrado_aggancio.mjs  => PASS 3/3
node test_traffico_aggancio.mjs => PASS 3/3
    SPENTO = BIT-IDENTICO (resta il cap di oggi)
    a=0 = simulazione senza traffico
    a>0 = nessuno va piu veloce del senza-traffico
```

**Per il go-live servono tre gesti, tutti umani**: passare `traffico: {a: 0.50716, lam: 0.8}`
al posto del cap; rifare il golden **attorno alla nuova forma** (cambierà, ed è previsto: è
un modello di traffico diverso); e la firma sul veto McLaren qui sopra.

### Il limite onesto — scritto DENTRO il modello

`modello_traffico_live.json` porta questo campo, non solo il report:

> *«Si calcola SOLO contro il campo reale: le altre auto non rallentano perché sei lì, non
> si difendono, non cambiano strategia. Dice "Leclerc diverso dentro la gara che È
> successa", non "la gara che SAREBBE successa".»*

Ora che qualcuno lo userà davvero, il limite viaggia col numero.

---

## (6) Che cosa NON sa fare, domattina

1. **Il 2026.** Scorrelato dal passato sul sorpasso (−0,024). Il modello nasce storico; sul
   2026 è un'ipotesi che si rafforza con l'uso, non una misura.
2. **Il campo reattivo.** Nessuna auto reagisce a Leclerc. È la natura del muretto, non un
   bug da chiudere.
3. **Il caso McLaren in magnitudine.** Lo ordina bene, lo sottostima (0,551 contro 0,871).
   La cura è l'interazione intensità×Δ — misurata come fronte, non montata.
4. **Le gare bagnate e la finestra post-restart**: pioggia esclusa, primi 3 giri dopo ogni
   ripartenza esclusi. Il modello non parla lì.

Nessun push, nessuna PR, nessun merge: il go-live lo decide Tommi.
