# Pre-registrazione — UNA definizione di «sosta»

Scritta il 08/08/2026 **prima** di misurare le alternative (regola 3). Il confronto sta in
`test_sosta.py`; i risultati vanno nel referto in coda a questo file, senza riscrivere le
soglie qui sopra.

## Perché serve

Nel repo convivono tre segnali che vengono usati come se fossero «la sosta», e non lo sono:

- `in_lap` — si accende su **ogni** transito in corsia box, comprese le sfilate sotto
  Safety Car e i rientri per bandiera rossa;
- il contatore `stint` — avanza su quei transiti anche quando non si monta niente;
- `pitstops_2026.json` (f1db) — l'elenco degli stop veri, ma **arriva in ritardo**: è
  aggiornato al GP d'Ungheria e una gara nuova resta scoperta finché f1db non pubblica.

Il caso limite già visto (Monaco/LIN, giri 56-72): `in_lap` si accende **4 volte**, il
contatore `stint` avanza **4 volte** (1→5), e un set nuovo viene montato **una volta sola**
(giro 67, MEDIUM età 67 → SOFT età 1). Una vista costruita sul contatore disegnerebbe
cinque stint dove ce ne sono due.

## Le due cose da NON confondere (e che d'ora in poi hanno due nomi)

| concetto | domanda a cui risponde | uso legittimo |
|---|---|---|
| **transito in corsia** | l'auto è passata dalla pit lane? | animazione del pallino in corsia, badge BOX |
| **sosta** | è stato montato un SET NUOVO? | vista stint, conteggio soste, strategia |

Il transito resta `in_lap`: è giusto così, ed è ciò che serve al pallino. La sosta è un
concetto diverso e finora non esisteva in nessun modulo.

## Le candidate

Per ogni (gara, pilota), l'insieme dei giri con sosta secondo:

- **D1 — contatore**: `stint[L+1] > stint[L]`
- **D2 — transito**: `in_lap[L]`
- **D3 — età che riparte**: `tyre_age[L+1] < tyre_age[L]` (un set nuovo parte da un'età
  minore di quello che smonta)
- **D4 — transito E età che riparte**: `in_lap[L] && tyre_age[L+1] < tyre_age[L]`

## Verità a terra

`demo/data/pitstops_2026.json` → `gare[gara][sigla][].giro`, cioè f1db `races-pit-stops`.
Scelta perché è la fonte ufficiale ed è **già verificata** contro il nostro dato:
`gen_pitstops.py` dichiara «giro f1db == nostro in_lap, verificato 292/292 sugli stessi
stop». Copre tutte e 11 le gare.

Limite dichiarato: f1db è la verità **per le gare passate**, non è disponibile in tempo
reale. Per questo la definizione promossa **non deve dipendere da f1db a runtime** — f1db
serve a sceglierla e a sorvegliarla, non a calcolarla.

## Cancello (scritto prima dei numeri)

La definizione promossa è quella che, sull'unione delle 11 gare:

1. ha **precisione ≥ 0,98** e **richiamo ≥ 0,98** contro f1db;
2. non peggiora sotto **0,95** su **nessuna singola gara** (nessuna definizione che funziona
   in media e crolla a Monaco);
3. non ha parametri da tarare per gara.

Se nessuna passa, non si promuove niente e la vista stint **non si accende**: si mette a
referto che il dato non regge, com'è già scritto in `demo/index.html` righe 144-155.
Se ne passa più d'una, vince quella con meno casi discordanti; a parità, la più semplice.

## Dove vivrà

In **un** modulo, importato da chi la usa e mai ridefinito (regola 1). I consumatori noti
oggi: la vista stint (`buildStrat`, orfana), le tacche pit della timeline eventi
(`gara.html`), `sosteVereDa()` in `demo/ese.mjs` che alimenta il BOX ORA, e i due
aggregatori `esporta_stint_2026.mjs` / `gen_stat_gara.py` che oggi raggruppano sul contatore
grezzo.

---

## REFERTO (misurato 08/08/2026 da `test_sosta.py`, 11 gare)

| definizione | precisione | richiamo | peggiore gara | esito |
|---|---|---|---|---|
| D1 contatore `stint` | 0,837 | 1,000 | Monaco 0,326 (prec.) | bocciata |
| D2 `in_lap` | 0,793 | 1,000 | Monaco 0,315 (prec.) | bocciata |
| D3 età che riparte | 0,935 | 0,942 | Monaco 0,595 (prec.) | bocciata |
| D4 transito E età | 0,935 | 0,942 | Monaco 0,595 (prec.) | bocciata |

**Nessuna candidata passa il cancello come pre-registrato.** Ma i 45 disaccordi di D3 non
sono rumore: si dividono in due famiglie, e ognuna dice una cosa precisa.

**(a) Soste vere che D3 non vede — l'età non basta.** Le sfugge quando il set nuovo ha la
stessa età di quello smontato o una maggiore:
- *Belgio/BEA giro 1*: MEDIUM età 1 → HARD età 1. L'età non scende (1 non è < 1), ma la
  **mescola cambia**: è una sosta vera, e f1db la registra.
- *Canada/SAI giro 2*: INTERMEDIATE età 2 → MEDIUM età **9**. Hanno montato un set **usato**,
  quindi l'età SALE. Di nuovo, solo la mescola lo rivela.
→ la condizione «età che riparte» va unita a «mescola cambiata».

**(b) Cambi gomma veri che f1db NON conta — la verità a terra risponde a un'altra domanda.**
Quasi tutti i casi «predetta ma non in f1db» sono a **Monaco, giri 66-68**, cioè dentro la
bandiera rossa (`rf = [[67, 68]]`). Esempio *Monaco/PER*: al giro 68 monta SOFT età 1 dopo
una SOFT età 7 — un set nuovo, inequivocabile. f1db non lo elenca perché **non è un pit stop
di gara**: è un cambio gomma a gara sospesa.

Quindi f1db risponde a «quanti pit stop di gara ha fatto questo pilota», mentre la vista
stint ha bisogno di «quando sono cambiate le gomme». Sulle gare senza bandiera rossa le due
domande hanno la stessa risposta; a Monaco no, e **lì f1db non è l'arbitro giusto** — non
perché sbagli, ma perché sta rispondendo ad altro.

Il cancello è quindi **mal specificato alla radice**: ha eletto arbitro una fonte che misura
un'altra grandezza (E08 — una metrica che conta come fallimento la risposta corretta). Come
prescrive la regola 3, resta a referto così com'è e se ne pre-registra uno nuovo:
**`data/SOSTA_PREREG2.md`**. Le soglie qui sopra non si toccano.
