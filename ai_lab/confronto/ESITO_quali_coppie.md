# Esito — il motore sa **anche quali**: φ = 0,305. Ma ne scambia meno della metà.

**Data: 15/08/2026.** Esegue `PREREG_quali_coppie.md`, sigillata a `d4b9b30` prima di
calcolare una sola tabella 2×2. Banco: `ai_lab/confronto/quali_coppie.mjs`. Nessun file di
produzione toccato.

**È la prima volta che il progetto misura *quali* invece di *quanti*.**

---

## I cancelli

575 coppie, 11 gare, dal congelamento alla bandiera.

| | la realtà la scambia | non la scambia |
|---|---|---|
| **il motore la scambia** | **20** | 16 |
| **non la scambia** | **62** | 477 |

| | | esito |
|---|---|---|
| **Q1** φ dell'associazione | **0,3052** · IC95 **[0,176 ; 0,410]** | **VERDE** — esclude lo zero |
| **Q2** motore finto (stesso numero, coppie a caso) | 95° percentile **0,100** · mediana −0,003 | **PULITO** — la vera lo batte di tre volte |
| **Q3** precisione · richiamo | **0,556** · **0,244** | riportato |

## Che cosa dice, in una riga

**Il motore non scambia coppie a caso.** Quando dice che due auto si scambiano, ha ragione
**più di una volta su due** (precisione 0,556) — contro un motore finto che, scambiando lo
stesso numero di coppie prese a sorte, ottiene φ ≈ 0.

Era la possibilità peggiore, ed è esclusa: se φ fosse stata zero, **ogni misura di «quanti»
fatta questa settimana avrebbe descritto una proprietà che il prodotto non usa.** Non è così.

## E che cosa dice l'altra metà del numero

**Il richiamo è 0,244**: delle **82** coppie che la realtà scambia, il motore ne prende **20**.
Ne scambia **36** in tutto contro 82.

| | |
|---|---|
| coppie scambiate dalla **realtà** | **82** |
| coppie scambiate dal **motore** | **36** (44%) |
| di queste, giuste | 20 |

**Il motore è conservativo e discretamente preciso**: sbaglia poco di ciò che dice, ma dice
meno della metà di quello che succede. È la stessa forma che tutta la settimana ha visto da
angolazioni diverse — muove poco — ma adesso è misurata sull'unità che interessa al
giocatore: **la coppia**.

E chiude una domanda che era aperta da martedì: il deficit non è «il motore agita il campo a
caso senza azzeccare nulla», è «**il motore fa meno scambi del vero, e quelli che fa sono in
buona parte quelli giusti**».

## Il limite del perimetro, e va detto forte

La misura tiene solo i piloti che hanno un cumulato **sia al congelamento sia al giro
finale**, in entrambe le versioni: cioè **i piloti sul giro del battistrada**. I doppiati
escono.

| gara | piloti | coppie |
|---|---|---|
| Giappone | 17 | 136 |
| Belgio · Gran Bretagna | 16 | 120 |
| Monaco | 12 | 66 |
| Miami | 10 | 45 |
| Cina · Ungheria | 7 | 21 |
| Australia · Austria | 6 | 15 |
| Spagna | 5 | 10 |
| **Canada** | **4** | **6** |

**106 piloti su 11 gare, 9,6 per gara.** Il totale è dominato da tre gare (Giappone, Belgio,
Gran Bretagna fanno 376 delle 575 coppie), e il Canada contribuisce sei coppie con **φ non
definita** (nessuno si scambia, né nel motore né nel vero). La Spagna è nella stessa
condizione.

L'IC95 è a **blocchi = gare** proprio per questo, e regge — ma va letto sapendo che due gare
non dicono nulla e tre pesano per due terzi. **Non è un difetto della misura: è ciò che resta
quando si pretende un confronto onesto sullo stesso campo**, ed è il prezzo di non voler
inventare una posizione per chi è stato doppiato.

## Che cosa NON cambia

- **Non si riapre il duello.** Questo esito misura una conseguenza della scelta di non
  simularlo, non la scelta.
- **Non si tocca niente nel motore.** La prereg non lo autorizzava e questo referto non lo
  propone.
- **Le misure di «quanti» di questa settimana restano valide**, e adesso hanno un contesto:
  descrivono una proprietà che il motore possiede **in modo correlato** con la realtà, non un
  numero staccato dal merito.

## La cosa che misurerei dopo

Non un'ipotesi: una **scomposizione**. Le 62 coppie che la realtà scambia e il motore no —
sono le stesse coppie del secchio «pista pura» del referto di ieri (il duello), oppure no?
Con 62 coppie e i giri in cui lo scambio avviene, si risponde **contando**, come oggi.

Se fossero il duello, l'arco si chiude: il motore è conservativo perché ha deciso di non
simulare i sorpassi, e lo è nella misura giusta. Se **non** lo fossero, c'è un pezzo di
movimento mancante che nessuna delle scelte dichiarate del progetto spiega — e quello sarebbe
nuovo.

---

*Nessun parametro toccato. Suite senza regressioni.*
