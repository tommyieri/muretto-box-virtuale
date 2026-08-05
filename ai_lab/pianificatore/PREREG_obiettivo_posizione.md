# Prereg — l'obiettivo del pianificatore: la posizione, non il tempo

**Data: 04/08/2026.** Scritta **prima** di aver valutato un solo piano col nuovo obiettivo.
È l'ultima voce rimasta del «difetto più grosso» della direttiva del PO.

---

## 1 · Il difetto, e perché solo adesso è aggredibile

`pianoOttimo` sceglie il piano che **minimizza il proprio cumulato alla bandiera**. I team
non fanno questo: si fermano per coprire un avversario, per non uscire nel traffico, per
proteggere una posizione. Misurato: il motore sbaglia la durata di uno stint di **11 giri**
in mediana e dice «arrivi così» in **99 casi su 167**.

Le altre due voci del difetto sono state chiuse oggi:

- **il traffico** è dentro (errore 8 → 7 giri, «arrivi così» 73 → 64);
- **i rivali si muovono**: `sosteAtteseRivali` viaggia fino a `valutaPiano`, prima non
  arrivava e il pianificatore ottimizzava contro venti auto ferme.

E c'è una terza cosa, che non è mia ma cambia tutto: **il tetto al movimento è acceso**.
Fino a stamattina due auto potevano attraversarsi, quindi *la posizione alla bandiera era
una funzione quasi monotòna del tempo* — cambiare obiettivo sarebbe stato in gran parte
inerte, e un cancello su una cosa inerte non è un cancello. Da oggi il sorpasso costa una
soglia di passo misurata, quindi **posizione e tempo sono davvero due grandezze diverse**.

Questa prereg esiste adesso e non prima per quella ragione, e va scritta perché è anche il
suo rischio: se il tetto sbaglia, l'obiettivo nuovo eredita l'errore.

## 2 · La forma, e i due parametri liberi che NON introduce

```
piano* = argmin ( posizione_alla_bandiera , cumulato_alla_bandiera )
```

Ordine **lessicografico**: prima la posizione, e **a parità di posizione** il tempo. Non una
somma pesata.

La somma pesata avrebbe voluto un cambio in secondi-per-posizione, cioè **un parametro
libero tarato da noi** su undici gare — la stessa forma del fattore per circuito che oggi ho
dovuto spegnere. Il lessicografico ne ha **zero**: non c'è niente da tarare, e il tempo
resta esattamente l'obiettivo di oggi ovunque la posizione non distingua.

**La posizione è il rango** del pilota in `simulate().ordine`, che è già la lista ordinata
per cumulato con i null esclusi (regola 6). Chi non ha passo non è «dietro»: non c'è.

**Il rischio di popolazione, dichiarato adesso.** Col tetto acceso il nostro piano può
toccare il cumulato di un rivale (costo del duello), quindi in linea di principio la
popolazione classificata può cambiare fra due piani, e due ranghi su popolazioni diverse non
si confrontano. Si misura: `P4` conta le volte in cui la popolazione differisce fra i piani
confrontati. Se succede, il numero si dichiara — non si nasconde dentro una media.

## 3 · Il banco e il nullo

**Banco**: le decisioni di sosta vere del 2026, la stessa macchina di
`PREREG_vita_mescola.md`. Per ogni stint concluso da una sosta si chiede al pianificatore
quale durata sceglierebbe dallo stato al suo inizio, e si confronta con quella vera.

**N1 — il nullo — è l'obiettivo di oggi**: stesso identico codice, stesso traffico, stessi
rivali, stesso tetto, e la scelta fatta sul **solo** cumulato. Gli unici bit diversi fra i
due bracci sono il comparatore.

**Fuori campione**: non serve leave-one-out, perché **non si stima niente**. Non c'è un
parametro che possa aver visto i dati: c'è un ordinamento diverso fra piani già calcolati.
È la prima volta in questo arco che il fuori campione non è un problema, e vale la pena
dirlo invece di darlo per scontato.

## 4 · I cancelli, con le soglie scritte adesso

| | cancello | soglia |
|---|---|---|
| **P1** | non peggiora la durata prevista | errore mediano in giri **≤** quello di N1 |
| **P2** | riduce «arrivi così» | la quota di piani senza sosta **cala di almeno 5 punti** |
| **P3** | non perde sui casi appaiati | test dei segni: se perde, **p ≥ 0,05** (perdere in modo significativo è una bocciatura) |
| **P4** | **i due obiettivi scelgono davvero diverso** | in almeno il **10 %** delle decisioni il piano scelto differisce |

**P4 è il cancello che protegge dal verde vuoto.** Se i due obiettivi scegliessero quasi
sempre lo stesso piano, P1 e P3 passerebbero per costruzione e il cambiamento sarebbe un
ornamento. Oggi ho già trovato due volte questa forma — `cancelli_vita.mjs` che confrontava
il modello con se stesso, e C4 della vita per circuito che passava perché non si muoveva
niente. La terza la voglio vedere prima, non dopo.

**Guardia, non cancello**: le violazioni del Director non aumentano, e il vincolo delle due
mescole slick continua a valere in ogni piano scelto. Se una delle due salta, non si spedisce
comunque — è un difetto, non un compromesso.

## 5 · Le regole di decisione

- **P4 fallisce** → l'obiettivo è inerte: **non si spedisce**, e si dichiara che con questo
  tetto e questi rivali la posizione non distingue i piani. Non è un fallimento del prodotto:
  è la scoperta che il difetto era già chiuso dalle altre due voci.
- **P1 o P3 falliscono** → **non si spedisce**. La posizione costa più di quanto rende.
- **P2 fallisce, P1/P3/P4 passano** → si spedisce lo stesso e **si dichiara**: l'obiettivo
  nuovo non è quello che cura «arrivi così», ma non fa danno e sceglie meglio.
- **Tutti passano** → si accende, e diventa l'obiettivo del prodotto.

## 6 · Cosa NON si fa

- Non si tocca il tetto al movimento né la soglia: sono ingressi sigillati oggi.
- Non si tocca la reazione dei rivali: è chiusa dal suo soffitto, e riaprirla nella stessa
  forma è vietato dalla regola di casa.
- Non si introduce nessun peso, nessuna probabilità di sorpasso per coppia, nessun
  parametro. Se il lessicografico non basta, la risposta è una prereg nuova, non un peso.

---

**Sigillo.** Committata prima di aver valutato un solo piano col comparatore nuovo.
