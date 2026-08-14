# Referto — il movimento dentro le neutralizzazioni: **non è lì che manca. Lì ne avanza.**

**Data: 14/08/2026.** Banco: `ai_lab/confronto/movimento_neutralizzazione.mjs`.
Chiude la direzione che `ESITO_tetto_sottotarato.md` indicava come «l'unico pezzo che il
tetto non copre». La chiude in NEGATIVO, ed è la cosa più utile che potesse fare.

Unità: la **gara**, non il caso — in questo banco i casi di una stessa gara sono la stessa
gara con un soggetto diverso, e contarne 193 sarebbe pseudo-replica. Undici unità, perimetro
= i giri che il motore proietta (da freeze+1 alla bandiera), regime = la definizione **di
campo** già usata dal costruttore.

---

## Prima della misura: cosa la compressione può fare, provato nel kernel

Sotto neutralizzazione il motore non applica il tetto al movimento
(`if (tetto !== null && !comprime)`): comanda la compressione,

```
m.c_dopo = capofila.c_dopo + gap_prima · κ
```

che è una moltiplicazione per un numero **positivo**, quindi **conserva l'ordine
esattamente**. Verificato eseguendo il kernel su quattro auto con passi da 89 a 94 s:

| | ordine dopo 8 giri |
|---|---|
| in **verde** | `D > B > A > C` — completamente rimescolato |
| **compressi** | `A > B > C > D` — identico al congelamento |

**Sotto neutralizzazione il motore non può produrre un sorpasso.** Le sole cose che spostano
qualcuno lì dentro sono le **soste** (escluse dalla compressione per contratto) e i ritiri.

Il conto lo conferma sui dati: dei **145** cambi che il motore produce in finestra,
**145 su 145** cadono in tratti dove qualcuno si è fermato. Zero altrove.

## La misura

| gara | giri V/N | cambi **veri** V/N | cambi **motore** V/N |
|---|---|---|---|
| Australia | 46/7 | 30/32 | 31/36 |
| Austria | 62/4 | 17/7 | 7/12 |
| Belgio | 33/2 | 35/**8** | 6/**30** |
| Canada | 60/3 | 10/2 | 2/2 |
| Cina | 47/4 | 9/13 | 8/12 |
| Giappone | 42/6 | 27/14 | 13/18 |
| Gran Bretagna | 37/9 | 34/8 | 21/14 |
| Miami | 46/6 | 7/**11** | 10/**0** |
| Monaco | 60/13 | **17**/7 | **0**/7 |
| Spagna | 56/5 | 17/6 | 7/7 |
| Ungheria | 63/2 | 21/14 | 6/7 |

| | verde | neutralizzazione |
|---|---|---|
| giri | 552 | **61** (10,0% del percorso) |
| cambi **veri** | 224 | **122** (**35,3%** di tutto il movimento) |
| cambi **motore** | 111 | 145 |
| **resa** | **49,6%** | **118,9%** |

## Le tre cose che dice

**1 · Le neutralizzazioni sono dove la gara succede davvero.** Sono il **10% dei giri** e
producono il **35,3% di tutti i cambi di posizione**: il movimento è tre volte e mezzo più
denso lì dentro. Non è una sorpresa per chi guarda le gare — è la sorpresa di vederlo
misurato su questo campione.

**2 · E il motore non è in deficit lì: è in eccesso.** Resa **118,9%** contro il **49,6%**
del verde. **Tutto il movimento che manca è in verde**, e nelle finestre semmai ne avanza.

Questo chiude la direzione che avevo indicato ieri. Avevo scritto: *«se qualcosa va provato
dopo, è il pezzo che il tetto non copre»*. La risposta è **no**: lì non c'è niente da
recuperare, perché il motore già produce più movimento della realtà.

**3 · Il punto cieco strutturale esiste ed è minuscolo.** I tratti neutralizzati in cui
**nessuno si ferma** sono **4 giri** su 61; la realtà ci produce **2** cambi e il motore
**0** — non per un difetto, per costruzione. Il fatto che sia così piccolo non è un caso: le
finestre di Safety Car sono esattamente il momento in cui tutti si fermano.

## Il caso limite, e il filo che lascia

**Belgio**: due finestre di **un giro sola** (18 e 20), dentro cui cadono **15 delle 28
soste** della gara. Lì il motore rimescola **30** posizioni contro le **8** vere.
**Miami** è lo specchio: finestra di 6 giri con solo **2 soste** dentro, e il motore fa
**0** cambi contro **11** veri.

Il meccanismo plausibile — **non misurato, e lo dico invece di lasciarlo intendere** — è che
sotto Safety Car il campo è compattato dalla compressione e la sosta costa la frazione
dichiarata della perdita verde (SC 0,50 · VSC 0,65): in un campo stretto a pochi secondi,
una sosta che costa metà scavalca molte più auto di quante ne scavalchi davvero, dove chi
esce dai box trova una coda.

**Non lo trasformo in una prereg adesso.** Prima va detto che questo è un eccesso di
movimento, e il progetto ha già misurato tre volte che **dove il motore inventa movimento,
sbaglia** (referto gara-intera 13-28; `ESITO_tetto_movimento.md`; e il 6,4% di massa
d'errore dei casi «movimento inventato» in `REFERTO_provenienza_errori.md`, che perdono
15-0 contro il modello nullo). Un eccesso del 19% in finestra è nella stessa famiglia, ed è
il primo candidato con un numero attaccato.

## Che cosa resta, messo in fila

Tre misure di questi due giorni convergono, e vale la pena leggerle insieme:

| | |
|---|---|
| `REFERTO_provenienza_errori` | il **71,8%** dello scarto è movimento che **non avviene** |
| `ESITO_tetto_sottotarato` | **NULL**: abbassare la soglia muove di più e non azzecca di più |
| questo referto | il movimento che manca è **tutto in verde**; in finestra ne avanza il 19% |

Il collo di bottiglia non è quanto movimento il motore permette — è che **non sa chi deve
passare**, e il duello è un ramo già chiuso fuori campione su 78 gare. Il candidato che
resta con un numero attaccato non è più il movimento: è la **sosta sotto neutralizzazione**,
cioè la sola sorgente di movimento che il motore ha lì dentro, e che oggi ne produce più del
vero.

---

*Nessun parametro toccato, nessun codice di produzione modificato: questo referto aggiunge
solo un banco di laboratorio. Suite senza regressioni, quattro banchi del sito verdi.*
