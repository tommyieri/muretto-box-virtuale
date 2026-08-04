# Prereg — la soglia di sorpasso: quanto devi essere più veloce, e dove

**Data: 04/08/2026.** Scritta **prima** di aver condizionato un solo esito sul divario di
passo. Esegue il lavoro n. 2 della direttiva del PO del 04/08.

> «L'indice per pista va bene, ma una Mercedes dietro una Cadillac passa velocemente, una
> Aston Martin dietro la Cadillac no.»

Cioè: la sorpassabilità non è una proprietà della pista **da sola**. È della **coppia**
(pista, differenza di passo). Questa prereg misura la seconda metà.

---

## 1 · La forma, e cosa deve produrre

Per ogni circuito una **soglia**:

> `X(pista)` = di quanti secondi al giro devi essere più veloce perché il sorpasso, da
> vicino, diventi più probabile che no.

E la soglia **non si stima libera per ogni pista**. Si stima da una legge a **due
parametri** sull'indice geometrico già sigillato (`indice_sorpasso.json`):

```
X(pista) = α + β · (1 − indice)
```

Due numeri per undici circuiti invece di undici. È la scelta che rende la cosa
**verificabile fuori campione** — si può togliere un circuito, stimare la legge sugli altri
dieci e predire il suo — e che le dà l'unica proprietà che serve al prodotto: **funziona su
una pista che non abbiamo mai corso**. Undici soglie libere non avrebbero né l'una né
l'altra, e sarebbero il fattore per circuito della vita gomma da capo (chiuso NULL stamattina
proprio perché ogni circuito aveva una gara sola).

## 2 · L'unità di misura: l'occasione, e le tre trappole chiuse prima

Un'**occasione** (`ai_lab/sorpasso/attacchi.mjs`, già scritto e dichiarato qui):

> al giro `g`, F è dietro L di **≤ 1,0 s**; nessuna delle due entra o esce dai box e
> nessuna è fuori dal verde di status per tutti i giri `[g, g+5]`; il passo di ciascuna è
> la mediana dei suoi giri verdi in `[g−4, g]`. **Esito**: a `g+5`, F è davanti.

Parametri dichiarati e non tarati: vicino **1,0 s**, orizzonte **5 giri**, finestra passo
**5 giri**, minimo **3 giri verdi**.

Le trappole, chiuse per costruzione:

1. **I cicli delle soste sembrano sorpassi.** È già costato: la prima verifica dell'indice
   geometrico, contando tutti gli scambi, dava correlazione **−0,364** perché il metro
   misurava le soste. Qui una coppia esce se una delle due tocca la corsia box nella
   finestra.
2. **Il carburante non si corregge, e non è una dimenticanza.** F e L corrono gli **stessi
   giri**: la deriva è identica e si cancella esattamente nella differenza dei passi.
3. **Il futuro non si guarda.** Il passo si misura solo su giri `≤ g` (regola 5). Il
   prodotto userà questa soglia a un congelamento: tararla su giri successivi sarebbe E14.

## 3 · Cosa ho già letto, e cosa no

**Letto** (è nella prereg perché è un ingresso, non un esito): il fondo dà **5.498
occasioni su 64 gare asciutte** negli 11 circuiti del 2026, e le quote grezze di passaggio
per pista sono

| | | | | | | | | | | |
|---|---|---|---|---|---|---|---|---|---|---|
| Spagna | Belgio | Giappone | Cina | Austria | Ungheria | Miami | Australia | GB | Canada | Monaco |
| 0,458 | 0,412 | 0,351 | 0,323 | 0,310 | 0,307 | 0,291 | 0,232 | 0,173 | 0,171 | **0,012** |

**Non misurato**: nessun esito condizionato al divario di passo. Non so se il divario conti,
né quanto valga la soglia, né se l'indice la predica.

**Un disaccordo è già visibile e va nominato adesso**, perché sarà la tentazione di dopo:
l'Ungheria ha indice **0,432** (secondo più basso) e quota grezza 0,307, cioè in mezzo al
gruppo; la Gran Bretagna ha indice 1,000 e quota 0,173. La quota grezza **non** è la soglia
— confonde la pista col fatto che lì le auto vicine siano più o meno appaiate — ed è
esattamente per questo che si misura `X` condizionando sul divario invece di correlare le
quote.

## 4 · Lo stimatore

**Stadio 1 — la soglia, per circuito.** Regressione logistica su tutte le occasioni:

```
P(passato) = σ( a_pista + b · δ )        δ = passo(F) − passo(L), in secondi al giro
```

**Una sola pendenza `b`** comune a tutte le piste, **un'intercetta per pista**. Da lì

```
X(pista) = − a_pista / b
```

Pendenza comune e non una per pista: con undici pendenze libere si tornerebbe a undici
modelli, e il punto è misurare *dove* si sposta la soglia, non *quanto ripida* è la
transizione. È una restrizione dichiarata, e la si può sbagliare: se le piste avessero
davvero pendenze diverse, `X` ne porterebbe l'errore. Il cancello S3 (placebo) e il
cancello S2 (fuori campione) restano validi comunque, perché entrambi giudicano la
**relazione con l'indice**, non la forma della logistica.

**Stadio 2 — la legge.** Minimi quadrati di `X(pista)` su `(1 − indice)`, due parametri.

## 5 · I cancelli, con le soglie scritte adesso

| | cancello | soglia |
|---|---|---|
| **S1** | **il divario di passo conta**: chi è più veloce passa di più, a parità di pista | `b < 0` con **p ≤ 0,01** (Wald) |
| **S2** | **l'indice predice la soglia, fuori campione**: leave-one-circuit-out, la legge stimata sugli altri dieci predice `X` dell'undicesimo | errore assoluto mediano **inferiore** a quello del nullo «X uguale per tutti = media delle altre dieci» |
| **S3** | **placebo**: 500 rimescolamenti dell'indice fra i circuiti | l'R² vero sta nel **5 % superiore** dei finti |
| **S4** | **non è solo Monaco**: S2 e S3 rifatti **senza Monaco** | entrambi passano ancora |

**S4 è il cancello che mi aspetto di fallire.** Monaco ha indice 0,00 e quota 0,012: su
undici punti un estremo così può portarsi dietro tutta la correlazione da solo, e una legge
che esiste solo grazie a un punto non è una legge — è un caso speciale scritto in forma
generale. Va saputo prima, non dopo.

## 6 · Le regole di decisione — e in tutte tranne una si spedisce qualcosa

Il prodotto deve andare online: qui non si decide *se* consegnare, si decide **cosa**.

- **S1 fallisce** → l'idea della coppia è morta: il divario di passo non predice il
  sorpasso. Non si spedisce niente e il tetto al movimento resta spento. *(È l'unico ramo
  che finisce a mani vuote, ed è giusto che esista: se fallisce, il resto sarebbe rumore
  vestito da modello.)*
- **S1 passa, S2 o S3 falliscono** → l'indice non predice la soglia. **Si spedisce lo
  stesso**, ma la soglia è **UNA SOLA, uguale per tutte le piste**, stimata dalla pendenza
  comune. Non è un ripiego: oggi il motore non ha *nessuna* soglia, e questo ramo è
  precisamente ciò che il vecchio placebo del tetto al movimento aveva già indicato — che
  il pezzo che funziona è il **pavimento uniforme**. Quel pezzo lì era rimasto scoperto
  perché «richiedeva una prereg sua»: questa è quella prereg.
- **S1, S2, S3 passano, S4 no** → si spedisce, ma **a due livelli e non come legge
  continua**: le piste senza zone di sorpasso (indice sotto 0,20) prendono la loro soglia,
  tutte le altre la soglia comune. La forma dichiara ciò che i dati sostengono.
- **Tutti passano** → si spedisce la **legge continua** a due parametri, e vale anche per
  Zandvoort e per ogni pista futura di cui si abbia la forma.

In ogni ramo che spedisce, l'aggancio al motore (`tetto al movimento`, oggi spento e
registrato NULL) si accende **con la sua sentinella** e con il cancello già noto: **non
deve rompere la risposta a due giri**, che è la sola risposta validata del prodotto. Se la
rompe, si spedisce il numero e non l'aggancio.

## 7 · Il limite che questa prereg non può chiudere, e va scritto

Il fondo 2018-2025 **ha il DRS**; il 2026 **non ce l'ha** (Manual Override Mode). Quindi il
**livello** di `X` misurato qui è quello di un'era con un aiuto al sorpasso che non esiste
più: la soglia vera del 2026 sarà **più alta**, non più bassa.

Si dichiara e si sceglie adesso, prima dei numeri: **la forma viene dalla storia, il
livello si ancora al 2026** — la stessa architettura usata stamattina per la vita della
gomma. Concretamente: `X` si trasla di una costante unica scelta perché la quota di
sorpassi prevista sulle 11 gare del 2026 uguagli quella osservata. **Una costante, non
undici.** Non è tarare la forma: è ammettere che il livello del 2018 non è il livello del
2026.

## 8 · Cosa NON si fa qui

- Non si simula il duello. Il progetto ha già misurato che *quali* auto si scambiano non si
  riproduce: si riproduce **quanti** scambi. `X` è un vincolo sul movimento, non una
  probabilità di sorpasso per coppia.
- Non si tocca l'obiettivo del pianificatore (lavoro n. 3): questo è il pezzo che gli
  servirà, e arriva prima apposta.
- Non si ri-tara l'indice geometrico. È sigillato, ed è un ingresso.

---

**Sigillo.** Committata prima di aver stimato la logistica.
