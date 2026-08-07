# ESITO — il pit-loss è escluso, e con lui la seconda delle due strade

**Data: 05/08/2026.** Esegue `PREREG_pitloss_causa.md`, sigillata prima dei numeri (commit
`f01a2a2`). Dati: `ESITO_pitloss_causa.json`. Nessuna soglia toccata.

**Taratura passata**: il `P` richiesto, rimesso dentro `kOttimoContinuo`, ridà `k* = 2` a
tutte le lunghezze provate. L'algebra è quella.

---

## Il verdetto

| | cancello | esito |
|---|---|---|
| **W0** | il pit-loss può essere la causa | **NON PASSA** — il `P` più generoso richiesto è **10,40 s**, il pit-loss più basso mai misurato è **19,20 s** |

> **Il pit-loss è ESCLUSO come causa del sotto-fermarsi.** Non «improbabile»: escluso
> dall'aritmetica. Nessun valore fisicamente possibile di `P` porta `k*` a 2.

W1 — il doppio conteggio del rodaggio e dell'età dentro `P` — **non si esegue**, per la
ragione scritta prima: un doppio conteggio da un secondo su venti non cambierebbe `k*` di
niente, e misurarlo dopo aver saputo che non conta sarebbe cercare un colpevole invece di
una causa.

## 1 · Il conto

Il `P` che servirebbe perché il motore volesse due soste, per ogni gara del 2026, **nel caso
più favorevole al pit-loss** (età zero e gara intera: più giri restano, più `k*` cresce,
più alto è il `P` che basterebbe):

| gara | giri | `P` richiesto | `P` in uso |
|---|---|---|---|
| Monaco | 78 | **10,40 s** | prior esterno |
| Austria | 71 | 8,62 s | 21,35 s |
| Ungheria | 70 | 8,38 s | 21,16 s |
| Canada | 68 | 7,91 s | 19,33 s |
| Spagna | 66 | 7,45 s | 22,83 s |
| Australia | 58 | 5,75 s | 21,65 s |
| Miami | 57 | 5,56 s | 20,50 s |
| Cina | 56 | 5,36 s | 23,32 s |
| Giappone | 53 | 4,80 s | prior esterno |
| Gran Bretagna | 52 | 4,62 s | 19,20 s |
| Belgio | 44 | 3,31 s | prior esterno |

Anche a Monaco — la gara più lunga del calendario demo, il caso migliore — servirebbe un
pit-loss **1,8 volte più piccolo** del più basso che il progetto abbia mai misurato su
qualunque circuito. A Spa servirebbero **3,31 s**, che è poco più del solo tempo da fermo
(prior 2,5 s) e non contempla nemmeno il transito in corsia.

## 2 · Un difetto trovato scrivendolo, e corretto

La prima esecuzione leggeva **tutti e trentaquattro** i circuiti del file e dava un minimo
di **18,45 s**. Ma il motore usa la misura interna solo sui **26 promossi dal cancello A**;
sugli altri resta il prior esterno. Il 18,45 veniva da un circuito **non promosso**, cioè da
un numero che il motore non adopera.

Corretto ai soli promossi: il minimo torna **19,197 s** (70th Anniversary), che è quello
dichiarato in `CLAUDE.md`. **L'esclusione ne esce più forte, non più debole** — ed è il verso
che rende la correzione obbligatoria e non facoltativa.

## 3 · Le due strade erano due, e sono finite entrambe

| strada | esito |
|---|---|
| il ρ è basso per **selezione** | **caduta** — il placebo dice curvatura, p = 0,39 |
| il `P` è troppo **alto** | **caduta** — servirebbe 1,8× più piccolo del minimo misurato |

**Nessuno dei due ingredienti della forma chiusa può spiegare il sotto-fermarsi.** E questo
sposta la conclusione dove non era mai stata messa:

> **Con la fisica misurata correttamente, `(k+1)* = (R+a)·√(ρ/2P)` dice davvero che una
> sosta è l'ottimo. Il motore non sbaglia il conto: fa esattamente quello che il conto
> impone.** Sono i team a fermarsi due, tre, quattro volte per ragioni che *minimizzare il
> tempo totale* non contiene.

Non è un difetto di taratura. È che l'obiettivo, in questa forma, non è quello che governa
la scelta vera — e la posizione, l'altra candidata ovvia, è già stata misurata **inerte al
97 %**.

## 4 · Cosa resta, e qual è il candidato con più dati dietro

Il candidato che il progetto ha già in casa, misurato, e che **non è mai stato usato come
vincolo**: la **vita della gomma**.

Il modello conosce SOFT 12, MEDIUM 19, HARD 22 giri — le durate che i team scelgono davvero —
e le applica come **penalità morbida**: oltre la vita ogni giro costa il doppio di ρ, cioè
**0,031 s in più**. Nella realtà quella soglia non è una penalità, è un **muro**: una soft
non fa quaranta giri, non «costa un secondo in più».

Trasformare la vita da penalità a vincolo è concreto, testabile, e usa un numero già
misurato invece di introdurne uno nuovo. **Con una riserva onesta da scrivere prima**: così
facendo il motore finirebbe per scegliere il numero di soste che la tabella di tre numeri
già suggerisce — cioè diventerebbe il **pavimento C**, che è quello che oggi lo batte. Non
sarebbe una fisica migliore: sarebbe smettere di essere peggio di una tabella. Va deciso se
è quello che si vuole, e va deciso **prima** di misurarlo.

## 5 · Cosa NON si conclude

- **Non** si conclude che il pit-loss in produzione sia giusto. Si conclude che **non è la
  causa del sotto-fermarsi**. Se avesse un doppio conteggio, resterebbe un difetto da
  correggere — semplicemente non questo.
- **Non** si conclude che la forma chiusa sia sbagliata. Si conclude che, coi parametri
  misurati, dà la risposta che deve dare.
- **Non** si tocca niente in produzione.
