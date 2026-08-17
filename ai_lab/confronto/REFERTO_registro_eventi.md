# Referto — il registro degli eventi di movimento, e i quattro maggiori guardati con un metro

**Data: 17/08/2026.** Banco: `ai_lab/confronto/registro_eventi.mjs` → artefatto
`REGISTRO_eventi_movimento.json`. Descrittivo: **nessun meccanismo proposto**, nessun cancello,
nessun parametro, nessun file di produzione toccato.

Chiude la riga di metodo con cui si era fermato `REFERTO_62_righe.md` (15/08): *«smettere di
cercare una legge e cominciare a fare l'autopsia dei singoli episodi»*. Quel referto contava
gli episodi **a mano, in una tabella di prosa**. Qui diventano un artefatto con generatore.

---

## 1 · Perché ricontarli è servito a qualcosa

Il conteggio si riproduce, e nel riprodurlo è emerso che **la «quindicina» era una scelta di
definizione non dichiarata**.

| | eventi multipli | coppie distinte coperte |
|---|---|---|
| grappoli di giri contigui (**GAP = 5 giri**) | **19** | 47 (75,8 %) |
| tutte le coppie dello stesso (gara, pilota) | **31** | 52 (83,9 %) |

Belgio/HAD è il caso pulito: coppie ai giri **10-17** e una isolata al giro **31**. Come
grappolo è la rimonta da 8 coppie che il referto elencava; senza contiguità è un evento da 9.
**Non sono due misure in conflitto: sono due definizioni di episodio**, e ora GAP è un
parametro scritto con il suo valore e la sua ragione, invece di una decisione presa a occhio.

**Il numero che non dipende dalla scelta** — ed è il numero che conta — è la concentrazione:

> **I quattro eventi maggiori coprono 25 coppie distinte su 62, il 40,3 % del deficit.**
> Identico nei due modi di contare, e identico al referto del 15/08.

E i quattro maggiori sono gli stessi: **Belgio/HAD 8 · Monaco/RUS 7 · Belgio/BOR 5 ·
Gran Bretagna/ANT 5.**

## 2 · Il metro: due finestre, non una, e la seconda l'ho aggiunta perché la prima mentiva

Per ogni evento si sceglie un'**ancora** — il fatto che potrebbe spiegarlo: la **sosta propria**
del pilota, altrimenti la **neutralizzazione**, altrimenti il giro mediano delle coppie (ordine
dichiarato in testa al generatore, ancora obbligata dentro la finestra dell'evento). Attorno
all'ancora si misura lo spostamento di posizione, vero e del motore, e il **deficit** = vero −
motore (positivo = il motore muove **meno**).

Poi ho guardato la prima riga e ho visto che il metro era mal puntato: **su Belgio/HAD il
deficit all'ancora è −4**, cioè il motore muoverebbe *più* del vero. È aritmeticamente giusto e
sostanzialmente falso: le coppie di HAD stanno ai giri 10-17, la sua sosta è al **20**, quindi
la finestra ±3 attorno all'ancora fotografa il **crollo dopo la sosta** e si perde la rimonta
che ha generato le coppie.

Da qui la seconda finestra, sull'**evento intero**. I due segni opposti sulla stessa riga non
sono un difetto del registro: sono l'informazione.

## 3 · I quattro maggiori

Segni: **S** = sosta propria · **N** = neutralizzato · **n** = soste altrui.

### Monaco · RUS — 7 coppie, giro 72 · soste vere [31, 60, 66, 68, **72**]

| giro | 69 | 70 | 71 | **72** | 73 | 74 | 75 |
|---|---|---|---|---|---|---|---|
| **vero** | 4 | 4 | 3 | **11** | 11 | 11 | 11 |
| **motore** | 4 | 4 | 4 | **4** | 4 | 4 | 4 |
| | N | N | · | **S** | · | · | · |

**Deficit +7, tutto prima dell'ancora, in un giro solo.** Una sosta al giro 72 nella realtà
costa otto posizioni; nel motore non costa niente. È l'11 % del deficit totale in una singola
auto, e la SC è rientrata due giri prima.

### Belgio · HAD — 8 coppie, giri 10-17 · soste vere [1, 2, **20**]

| giro | 9 | 10 | 12 | 14 | 15 | 17 | 18 | 19 | **20** | 22 |
|---|---|---|---|---|---|---|---|---|---|---|
| **vero** | 15 | 14 | 13 | 11 | 8 | 7 | 7 | 7 | 7 | 7 |
| **motore** | · | 15 | 15 | 14 | 12 | 11 | 10 | 12 | **15** | 15 |
| | · | · | n | n | n | n | N | n | **S** | · |

**Evento intero: vero −8 · motore null** (il motore non ha posizione al giro 7: assenza
dichiarata, non zero). **All'ancora: deficit −4**, cioè il motore si muove di quattro
posizioni — *nella direzione sbagliata*. Il vero è settimo e resta settimo; il motore risale
fino al decimo e alla propria sosta **ricade quindicesimo**.

### Belgio · BOR — 5 coppie, giri 14-17 · soste vere [**20**]

| giro | 11 | 13 | 14 | 15 | 16 | 17 | 19 | **20** | 22 |
|---|---|---|---|---|---|---|---|---|---|
| **vero** | 11 | 11 | 10 | 10 | 9 | 8 | 8 | 8 | 8 |
| **motore** | 11 | 11 | 10 | 8 | 7 | 7 | 7 | **11** | 11 |
| | · | · | n | n | n | n | n | **S** | · |

Stessa forma di HAD: il motore **arriva più avanti del vero** (settimo contro ottavo) e alla
propria sosta perde quattro posizioni che la realtà non perde.

### Gran Bretagna · ANT — 5 coppie, giri 42-44 · soste vere [35, 41, **43**]

| giro | 39 | 40 | 41 | 42 | **43** | 44 | 45 | 47 |
|---|---|---|---|---|---|---|---|---|
| **vero** | 2 | 2 | 2 | 5 | 6 | 9 | 9 | 9 |
| **motore** | 3 | 3 | 3 | 3 | 6 | 6 | 6 | 5 |
| | · | n | S | · | **S** | · | · | N |

**Evento intero: deficit +5** (vero 7, motore 2), scomposto **+1 prima** dell'ancora e **+3
dopo**. Il motore la discesa la fa, e **si ferma a metà**: sesto contro nono.

## 4 · Cosa dice il registro, e dove mi fermo

Quello che è **misurato** è la struttura, e sono tre cose:

1. la concentrazione (**4 eventi = 40,3 % del deficit**) si riproduce e non dipende dalla
   definizione di episodio;
2. in tutti e quattro l'ancora è la **sosta propria**, e in tutti e quattro il deficit
   dell'evento intero e quello dell'ancora **hanno segni o magnitudini diverse**: il momento in
   cui il motore divarica non coincide con il momento in cui si ferma;
3. due dei quattro (**HAD, BOR**) hanno deficit **negativo** all'ancora — il motore muove più
   del vero, verso il basso, alla propria sosta. Gli altri due (**RUS, ANT**) hanno deficit
   positivo: il motore non muove abbastanza.

**Non sono lo stesso difetto, e questo è il risultato.** Chi cercasse una legge unica dovrebbe
spiegare con lo stesso meccanismo un motore che alla sosta perde troppo (HAD, BOR) e uno che
alla sosta non perde niente (RUS). È coerente con la ragione per cui cinque leggi sono cadute:
non c'è un fenomeno diffuso, e ora si vede che non c'è nemmeno **un** fenomeno.

## 5 · Quello che questo referto NON autorizza

- **Non propone il sesto meccanismo.** Quattro eventi su undici gare non sono una statistica, e
  la distinzione del §4 potrebbe essere rumore di campionamento: qui non è stata testata.
- **Non dice che il costo della sosta è mal tarato.** Il pit-loss per circuito è a referto come
  NULLO sulla provenienza dell'errore (`provenienza-errori`), e due eventi su quattro vanno
  nella direzione opposta a quella tesi.
- **Non riapre il duello**: 12 delle 62 coppie sono pista pura, ed è già a verbale.
- **Non tocca il prodotto.** Il registro serve a scegliere *dove guardare*, e la prossima cosa
  che si scrive su questi quattro episodi deve essere una **prereg**, non un'altra lettura.

---

*Suite senza regressioni (43/45 verdi, 4 rosse dichiarate). Nessun parametro toccato.*
