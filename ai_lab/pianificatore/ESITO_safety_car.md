# ESITO — la safety car: un cancello mal specificato, e due canali che non bastano

**Data: 05/08/2026.** Esegue `PREREG_safety_car.md`, sigillata prima dei numeri (commit
`943517e`). Dati: `ESITO_safety_car.json`. **Nessuna soglia toccata** — e proprio per questo
la prima cosa da scrivere è che una l'avevo scritta male.

---

## Il verdetto, e la sua riserva

| | cancello | esito letterale |
|---|---|---|
| **SC0** | il canale economico può bastare | **PASSA** — `k*` = 2,12 a Monaco, con `q = 1` |
| **SC1** | l'opportunismo spiega il sotto-fermarsi | **NON PASSA** — 114 → **106**, ne servivano ≤ 90 |

**SC0 passa alla lettera e non significa quello che sembra**, e la colpa è della sua
scrittura, non dei dati.

## 1 · Il cancello mal specificato, a referto

L'avevo costruito per **escludere**: *«se nemmeno regalando ogni sosta alla safety car la
forma chiusa vuole due soste, il canale è escluso dall'aritmetica»*. Per farlo l'ho messo al
limite `q = 1` — **ogni singola sosta sotto SC** — e l'ho chiamato nella prereg stessa «il
limite irraggiungibile».

**Ma non ho scritto cosa significhi un PASS.** E un pass al limite irraggiungibile non dice
«il canale funziona»: dice soltanto **«l'esclusione non riesce»**. Sono due cose diverse, e
la seconda è quasi priva di contenuto.

Peggio: il 2,12 di Monaco esce usando il pit-loss **più basso dell'intero archivio** (19,20 s,
che è di Silverstone), non quello di Monaco. Due generosità impilate.

È **E08** nella sua forma esatta — metrica mal specificata — e la regola dice di metterla a
referto e non riscriverla. Quindi SC0 resta **PASSA**, con questa riga attaccata.

## 2 · Il numero che la prereg non chiedeva, ma che i dati regalano

SC1 misura la cosa che serve per leggere SC0 sul serio: **quanto vale `q` davvero**.

> **112 soste su 435 sono avvenute sotto SC o bandiera rossa: `q` = 25,7 %.**

Con quella `q`, e non col limite:

| gara | giri | `k*` senza SC | `k*` con `q` misurata |
|---|---|---|---|
| Monaco | 78 | 1,21 | **1,37** |
| Austria | 71 | 1,01 | 1,15 |
| Spagna | 66 | 0,87 | 1,00 |
| Gran Bretagna | 52 | 0,47 | 0,58 |
| Belgio | 44 | 0,25 | 0,33 |

Il moltiplicatore su `(k*+1)` è `1/√(1−q/2)` = **1,071**: il canale economico vale **+7,1 %**,
e il `k*` più alto raggiungibile è **1,37** contro i 2 che servivano.

**In sostanza il canale economico è escluso quanto lo era il pit-loss.** Non lo scrivo come
esito di SC0 — SC0 è passato e resta passato — ma come misura nuova, che è l'unico modo
onesto di dirlo senza riscrivere un cancello dopo averlo visto.

## 3 · SC1: l'opportunismo c'è, ed è grosso, e non basta lo stesso

| | |
|---|---|
| soste sotto SC o rossa | **112 / 435 = 25,7 %** |
| **fra le soste oltre la prima** — quelle che il motore non fa | **84 / 214 = 39,3 %** |
| decisioni che chiederebbero ancora ≥ 2 soste **verdi** | **106** (erano 114) |

**Due soste su cinque, fra quelle in più, sono opportunistiche.** È un numero grande e dice
qualcosa di vero sul mestiere: buona parte delle soste che il motore «non prevede» non erano
prevedibili — sono comparse.

Ma togliere tutte le soste sotto SC e rossa dal conto sposta il sotto-fermarsi solo da **114
a 106**. Otto casi. **SC1 non passa**, e non ci va vicino.

La ragione è che le decisioni difficili sono quelle in cui servivano **tre, quattro, cinque**
soste: togliergliene una non le porta a una.

**E la misura è conservativa per costruzione**: il VSC non è contato — il segnale `6` è
dichiarato rotto, `R_lap` 1,055 — quindi le soste sotto VSC restano contate come verdi e
l'opportunismo vero è **più alto** del 25,7 % misurato. Se contarle facesse passare SC1, si
saprebbe solo dopo aver capito il VSC, che è un debito aperto e non di questa sessione.

## 4 · Il bilancio: cinque strade, cinque chiusure

| candidato | esito |
|---|---|
| l'**obiettivo** è il tempo e non la posizione | inerte al 97 % |
| il **ρ** è basso per selezione | caduto — è curvatura, placebo p = 0,39 |
| il **`P`** è troppo alto | caduto — servirebbe 1,8× più piccolo del minimo |
| la **vita** è penalità e non muro | lega ma non basta — 114 → 102 |
| la **safety car** | economico +7,1 % · opportunismo 114 → 106 |

Nessuna delle cinque spiega il sotto-fermarsi. Due di esse — la vita e la safety car —
**spostano qualcosa nel verso giusto** (102 e 106 contro 114) ma nessuna arriva ai 90.

E vale la pena notare che **non sono indipendenti**: una sosta sotto SC è spesso anche una
sosta anticipata rispetto alla vita della gomma. Sommarle non darebbe 114 − 12 − 8; darebbe
meno. Non l'ho misurato, e non lo stimo a occhio.

## 5 · La conclusione onesta, che è anche la raccomandazione

> **Il difetto è reale, è grosso — 114 decisioni su 167 — e cinque spiegazioni misurate non
> lo coprono. Smetterei di cercarne una sesta dentro il modello del tempo sul giro.**

Quello che resta, e che questa sessione ha reso visibile senza cercarlo, è che **la
scomposizione aveva già dato la risposta operativa**: col numero di soste *regalato*
l'errore scende da 7 a 5 giri, cioè al pavimento. Il motore sa **quando** fermarsi; non sa
**quante volte**. E le cinque strade dicono che quel «quante volte» non si ricava dalla
fisica che il motore ha.

**Non consiglio di costruire P(SC) per circuito e per giro.** L'aritmetica con la `q`
misurata dice che varrebbe il 7 %, e sarebbe una sessione intera contro un ingrediente che
il VSC rotto rende per metà inaffidabile.

## 6 · Cosa NON si conclude

- **Non** si conclude che la safety car non conti in strategia. Conta moltissimo — 39,3 % delle
  soste in più — ma **come opportunità, non come previsione**, e il prodotto la usa già così:
  a ogni congelamento il motore vede il regime che c'è.
- **Non** si tocca niente in produzione.
- **Non** si riapre nessuna delle cinque strade senza una **fonte nuova**, che è la regola
  di casa.
