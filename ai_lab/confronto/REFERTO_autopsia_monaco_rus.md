# Autopsia — Monaco/RUS al giro 72: **il pavimento che ho acceso io impedisce alla Safety Car di compattare il campo**

**Data: 15/08/2026.** Autopsia di un episodio singolo, il più grande dei quattro che valgono
il 40% delle coppie mancate: da solo vale l'11% del deficit. Non è una statistica — è un caso,
aperto fino in fondo. Nessun file di produzione toccato.

---

## L'evento

RUS a Monaco, soste vere ai giri 31 · 60 · 66 · 68 · **72**, arriva P14.

| giro | 68 | 69 | 70 | 71 | **72** | 73 → 76 |
|---|---|---|---|---|---|---|
| **vero** | 4 | 4 | 4 | **3** | **11** | 11 |
| **motore** | 4 | 4 | 4 | 4 | **4** | 4 |

Otto posizioni in un giro nella realtà. Zero nel motore.

## Non è il prezzo della sosta

Prima ipotesi ovvia, e cade subito: il motore **ha** quella sosta e gliela fa pagare per
intero.

```
   giro 31 · perdita 22,01 s · HARD        giro 68 · perdita 11,01 s · SOFT
   giro 60 · perdita 11,01 s · SOFT        giro 72 · perdita 22,01 s · SOFT   ← piena, in verde
   giro 66 · perdita 11,01 s · SOFT
```

E la perde davvero: al giro 72 RUS fa 98,4 s contro una mediana di campo di 78,2 → **20,1 s
persi**. Nella realtà ne perde **9,1**. Il motore gli addebita **il doppio** del vero, e
nonostante questo **non gli costa una posizione**.

## È il campo

Al giro 71, chi sta dietro a RUS:

| | RUS è | i primi dieci dietro di lui |
|---|---|---|
| **realtà** | **P3** | GAS **+1,6** · HAD +3,1 · PIA +3,8 · LAW +4,7 · LIN +5,4 · ALB +6,2 · HUL +6,4 · OCO +6,8 · COL +16,5 · SAI +66,6 |
| **motore** | P4 | GAS **+99,8** · PIA +104,4 · LAW +126,1 · SAI +176,9 · ALB +180,7 · … |

**Auto entro 22 secondi dietro: nove nella realtà, zero nel motore.**

Il primo inseguitore è a **1,6 s** nella realtà e a **99,8 s** nel motore: un fattore 60 su un
solo distacco. Con nove auto in sette secondi, una sosta costa otto posizioni. Con la più
vicina a cento secondi, non ne costa nessuna — qualunque prezzo le si dia.

## Perché: **il campo del motore non si compatta mai**

Larghezza del campo (ultimo − primo) a Monaco:

| giro | 57 | 62 | 66 | 68 | **70** | 71 | 78 |
|---|---|---|---|---|---|---|---|
| regime | verde | SC | SC | SC | **SC** | verde | verde |
| **vero** | 187,3 | 219,1 | 124,3 | 36,7 | **3,6** | 72,8 | 43,9 |
| **motore** | 230,0 | 239,9 | 239,7 | 246,3 | **240,5** | 243,8 | 266,9 |

La realtà passa da **187 secondi a 3,6** — un fattore cinquanta — perché è quello che fa una
Safety Car con in mezzo una bandiera rossa. Il motore resta a **240 e non si muove**.

## E la causa è la riparazione che ho acceso io tre giorni fa

Rieseguita la stessa gara col **pavimento spento**:

| giro | 62 | 66 | 68 | **70** | 78 |
|---|---|---|---|---|---|
| **vero** | 228,4 | 129,1 | 43,9 | **4,3** | 43,9 |
| motore **con** pavimento | 239,9 | 239,7 | 246,3 | **240,5** | 266,9 |
| motore **senza** pavimento | 118,3 | 63,8 | 70,5 | **34,2** | 60,7 |

Senza il pavimento il campo si compatta: 230 → **34 s**, sette volte più vicino al vero. Con
il pavimento non si compatta affatto.

**Il meccanismo è chiaro e prevedibile col senno di poi.** La compressione chiude i distacchi
facendo *andare più forte chi insegue* — la fisica rovesciata che avevo diagnosticato il
13/08. Il pavimento vieta i giri impossibili, e chiudere un distacco di duecento secondi
**richiede** giri impossibili. Quindi il vincolo, che è giusto, rende la compressione
**inerte** proprio dove servirebbe di più.

## Il conto onesto della mia riparazione

| | larghezza a Monaco, giro 70 | giri impossibili |
|---|---|---|
| realtà | 4,3 s | — |
| motore **senza** pavimento | 34,2 s (**8×**) | 1 |
| motore **con** pavimento | 240,5 s (**56×**) | 0 |

**Ho scambiato un errore da fattore 8 con uno da fattore 56, per togliere un giro
impossibile.** Su tutte e undici le gare il pavimento toglieva 5.815 giri impossibili e
portava i rifiuti del contro-fattuale dal 27% a zero — quei numeri restano veri. Ma il prezzo
non era stato misurato, **e la prereg aveva sei cancelli**: giri impossibili, invariante
locale, perimetro, rifiuti, arrivi, regressioni. **Nessuno guardava la larghezza del campo.**

Questo è il difetto della mia prereg, non della riparazione: i sei cancelli misuravano ciò che
la riparazione doveva togliere, e nessuno misurava ciò che poteva rompere.

## Quanto è generale

Larghezza del campo all'ultimo giro neutralizzato di ogni gara, motore / vero:

| dove la realtà **compatta** | | dove **non** compatta | |
|---|---|---|---|
| Monaco | **67,6×** | Austria | 0,9× |
| Gran Bretagna | **27,9×** | Belgio | 0,9× |
| Cina | **6,3×** | Canada | 0,9× |
| Giappone | **3,9×** | Spagna | 0,8× |
| Miami | **2,9×** | Ungheria | 1,1× |

**Cinque gare su undici hanno una neutralizzazione che stringe il campo sotto i 23 secondi, e
in tutte e cinque il motore fallisce** — da 3 a 68 volte. Dove la realtà non compatta, il
motore la segue bene.

Non è un difetto di Monaco: è un difetto che **si vede solo quando la Safety Car fa il suo
mestiere**. Il ruolo causale del pavimento l'ho verificato **su Monaco soltanto**; sulle altre
quattro il meccanismo è lo stesso ma non l'ho misurato.

## La conclusione, e non è un'ipotesi nuova

Non propongo un sesto meccanismo. Propongo quello che il progetto ha **già scritto due volte
e mai costruito**, e che questa autopsia è la prima prova concreta a sostenere —
`PREREG_compressione_pavimento.md` §5 e la seconda §5:

> *«farla pagare al **leader**, che è la lettura fisica giusta (sotto neutralizzazione il campo
> si compatta perché chi è davanti rallenta), al prezzo di muovere l'ancora di tutti i
> cumulati».*

**Con il leader che rallenta, un distacco di duecento secondi si chiude senza che nessuno
guidi un giro impossibile** — perché nessuno deve recuperare: è il primo che aspetta. È
l'unica forma che può passare insieme il pavimento *e* la compattazione, e le due cose
insieme sono esattamente ciò che nessuna delle due versioni provate fa.

**Non spengo il pavimento**: rimetterebbe 5.815 giri impossibili e il 27% di rifiuti. La
strada è la terza forma, con la sua prereg — e stavolta con un cancello sulla **larghezza del
campo**, che è il pezzo che sei cancelli non hanno visto.

---

*Nessun parametro toccato, nessun file di produzione modificato.*
