# REPORT — il metro a due condizioni, e la domanda piantata per il futuro

Branch `ai-lab/scienziato-fuel-metro2` · 21/07/2026 · prereg (scritto prima di toccare
qualunque cella): [`ai_lab/scienziato/PREREG_metro2.md`](ai_lab/scienziato/PREREG_metro2.md)
Generatori: `run_metro2.py` → `predizioni_congelate.json`, `sorveglianza_stato.json` ·
`sorveglianza.py` · `test_sorveglianza.py`

---

## (5) La frase, per prima

> **Sì: Austria e Bahrain sono promossi — e sono gli unici due. No: Las Vegas non regge.**

Il metro nuovo promuove **2 circuiti su 13**: Austria (D = 1,173 s, sempre *sotto* il
globale) e Bahrain (D = 1,010 s, sempre *sopra*). Sono esattamente i due che il metro
vecchio scartava e i due dove il test predittivo guadagnava di più: il difetto diagnosticato
era reale e il metro nuovo lo corregge.

**Las Vegas cade.** Passa la condizione (i) — 4,16 · 4,10 · 3,57, sempre sopra — ma la sua
distanza D = 0,707 s sta **sotto la soglia derivata di 0,869 s**. Era l'unico promosso dal
metro vecchio; col metro nuovo è un candidato mancato per 0,16 s. Anche Singapore, Messico
e Ungheria (gli altri tre "STABILI" di ieri) cadono tutti sulla condizione (ii): erano
stabili ma troppo vicini al globale per contare.

**Tutto questo però NON è prova**: il metro è stato ispirato da questi stessi 13 circuiti.
Sono predizioni congelate. La prova vera è differita — e §4 dice di quanto.

---

## (1) Il metro e la soglia derivata

**Due condizioni, entrambe necessarie**, riferite al globale *lasciando fuori il circuito
stesso* (`G₋c` = mediana del regime escluse le gare di c):

- **(i) SEGNO STABILE** — tutte le stagioni con `Δ_cy − G₋c` dello stesso segno.
- **(ii) DISTANZA NETTA** — `D_c = |Δ̄_c − G₋c| ≥ soglia`, con `Δ̄_c` media pesata
  inverso-varianza.

**La soglia non è stata scelta a mano.** Derivata dalla nulla per permutazione delle
etichette di circuito dentro ogni stagione (valore e SE viaggiano in coppia), 10 000
repliche, seed 20260721. Regola dichiarata prima: **la soglia è il valore di D per cui il
tasso di falsi positivi CONGIUNTO del metro — (i) ∧ (ii) — vale il 5 %.**

| k stagioni | soglia derivata | falsi positivi della sola (i) | mediana / q95 di D sotto la nulla |
|---|---|---|---|
| 2 | 1,265 s | 0,506 | 0,454 / 1,393 |
| **3** | **0,869 s** | **0,251** | 0,348 / 1,108 |

**Controllo interno**: il tasso di falsi positivi della sola condizione (i) misurato dalla
nulla è 0,251 per k = 3 e 0,506 per k = 2 — contro i valori analitici 2·(½)³ = 0,25 e
2·(½)² = 0,50. La macchina della nulla riproduce l'aritmetica: non ha errori grossolani.
E conferma che **(i) da sola sarebbe un colabrodo** (un circuito su quattro la passerebbe
per caso): è (ii), con la sua soglia derivata, a portare il metro al 5 %.

---

## (2) Predizioni congelate sui 13 già visti — **TARATE A POSTERIORI, NON PROVA**

| circuito | valori 2023-25 | lato | D | **metro NUOVO** | metro vecchio | cosa fallisce |
|---|---|---|---|---|---|---|
| **Austrian** | 2,20 · 1,79 · 2,06 | sotto | **1,173** | **PER-CIRCUITO VERO** | INSTABILE | — |
| **Bahrain** | 3,85 · 3,94 · 4,52 | sopra | **1,010** | **PER-CIRCUITO VERO** | INSTABILE | — |
| Las Vegas | 4,16 · 4,10 · 3,57 | sopra | 0,707 | NON PASSA | *STABILE* | (ii) distanza |
| Qatar | 4,07 · 3,63 · 3,12 | oscilla | 0,665 | NON PASSA | INSTABILE | (i) + (ii) |
| Japanese | 3,25 · 4,79 · 3,72 | sopra | 0,641 | NON PASSA | INSTABILE | (ii) distanza |
| Singapore | 3,11 · 2,54 · 2,89 | sotto | 0,602 | NON PASSA | *STABILE* | (ii) distanza |
| Italian | 1,84 · 3,18 · 2,88 | oscilla | 0,540 | NON PASSA | INSTABILE | (i) + (ii) |
| Mexico City | 2,74 · 2,78 · 2,92 | sotto | 0,343 | NON PASSA | *STABILE* | (ii) distanza |
| Saudi Arabian | 3,15 · 5,08 · 2,52 | oscilla | 0,330 | NON PASSA | INSTABILE | (i) + (ii) |
| Hungarian | 3,05 · 2,82 · 2,60 | sotto | 0,296 | NON PASSA | *STABILE* | (ii) distanza |
| United States | 3,32 · 3,58 · 2,72 | oscilla | 0,198 | NON PASSA | INSTABILE | (i) + (ii) |
| Azerbaijan | 4,01 · 3,66 · 2,97 | oscilla | 0,191 | NON PASSA | INSTABILE | (i) + (ii) |
| Abu Dhabi | 3,31 · 3,20 · 3,01 | oscilla | 0,051 | NON PASSA | INSTABILE | (i) + (ii) |

**2/13 col metro nuovo, 4/13 col vecchio — ma sono insiemi quasi disgiunti**: il vecchio
promuoveva Las Vegas, Singapore, Messico, Ungheria; il nuovo promuove Austria e Bahrain.
Un solo circuito non cambia giudizio in modo sostanziale, e **nessuno dei promossi di ieri
sopravvive**. I due metri non misurano la stessa cosa: il vecchio chiedeva *identità*, il
nuovo chiede *posizione*. Il tavolo ha scelto il secondo, e questo è il prezzo.

Nota su (ii): quattro circuiti cadono con D fra 0,60 e 0,71, cioè **poco sotto** la soglia
di 0,869. Non sono "lontani dal per-circuito": sono nella zona grigia. Una quarta stagione
potrebbe spostarli da una parte o dall'altra — che è esattamente ciò che la sorveglianza
esiste per registrare.

---

## (3) Celle giudicabili con dati freschi **ORA: ZERO**

E la ragione è più dura di quanto sembri.

Le 11 celle INDECIDIBILI aspettano una stagione mancante del regime **2023-25**, che è
**chiuso**. Le stagioni che mancano non arriveranno mai:

| circuito | ha | manca | perché è persa |
|---|---|---|---|
| Australian | 2023 · 2024 | 2025 | pioggia |
| Belgian | 2024 | 2023 · 2025 | pioggia · rango non pieno |
| British | 2023 | 2024 · 2025 | pioggia · pioggia |
| Canadian | 2023 · 2025 | 2024 | pioggia |
| Chinese | 2024 · 2025 | 2023 | GP non disputato |
| Dutch | 2024 · 2025 | 2023 | pioggia |
| Emilia Romagna | 2024 · 2025 | 2023 | GP non disputato (alluvione) |
| Miami | 2023 · 2024 | 2025 | pioggia |
| Monaco | 2024 · 2025 | 2023 | pioggia |
| Spanish | 2023 · 2025 | 2024 | pioggia |
| São Paulo | 2023 · 2025 | 2024 | pioggia |

**Dentro il loro regime, queste 11 celle non saranno mai giudicabili.** Non è una questione
di attesa: è un'assenza permanente.

E una cella 2026 **non può** fare da terza stagione (regimi mai mescolati, PREREG §4).
La tentazione c'era — il metro guarda la *posizione relativa al globale del proprio
regime*, quindi si potrebbe sostenere che la deviazione sia regime-invariante — e l'ho
**rifiutata prima di calcolarla**, perché è un'ipotesi non verificata e l'unica evidenza
disponibile la contraddice (Spearman 2023-25 vs 2026 = −0,055, sessione precedente).

**Lettura cross-regime, riportata come INDIZIO e mai come verdetto**: applicando il metro
come *se* la posizione fosse regime-invariante, **3 circuiti su 8** mantengono il segno
attraverso il confine (Canadian, Chinese, Spanish) — contro **~1/4 attesi per puro caso**.
Cioè: nessun segnale. Miami passa da −0,54/+0,14 a −2,19; Monaco da +5,56 a −0,91. Questo
indizio dice al tavolo che la scorciatoia cross-regime, oltre a essere vietata, **non
avrebbe nemmeno pagato**.

---

## (4) La pipeline di sorveglianza — cosa farà e quando scatterà

`sorveglianza.py` ricalcola la tabella **dal fondo**, la confronta con
`sorveglianza_stato.json` e **riporta solo le transizioni**: da <3 stagioni nello stesso
regime a 3. In quel momento applica il metro con la **soglia congelata** (0,869 s, non
ricalcolata sui dati nuovi) e dice se la predizione congelata reggeva.

Verifiche meccaniche committate (`test_sorveglianza.py`, tutte PASS):

```
PASS  IDEMPOTENZA              due esecuzioni senza dati nuovi -> nessun verdetto
PASS  SCATTA UNA VOLTA SOLA    cella da 2 a 3 stagioni -> un verdetto, non ripetuto
PASS  PREDIZIONI SOLA LETTURA  sha256 di predizioni_congelate.json invariato
```

Prova del meccanismo, simulando l'arrivo della stagione mancante dell'Austria:

```
  Austrian  (regime 2023-25)   era: indecidibile
    stagioni ['2023','2024','2025']  valori [2.196, 1.792, 2.061]
    lato sotto   D = 1.173  vs soglia congelata 0.869
    (i) segno stabile : True      (ii) distanza netta : True
    VERDETTO: PER-CIRCUITO VERO
    predizione congelata: PASSERA  ->  REGGE
```

Le celle già giudicabili stanotte sono marcate nello stato come **linea di base** (hanno
ispirato il metro): la sorveglianza non le spaccerà mai per verdetti freschi.

### Le predizioni congelate sulle celle indecidibili

| circuito | finora | segno | D parziale | **predizione** | base |
|---|---|---|---|---|---|
| Belgian | 4,11 | sopra | 0,971 | **PASSERÀ** | 1 stagione |
| Chinese | 4,27 · 3,88 | sopra | 0,879 | **PASSERÀ** | 2 stagioni |
| Canadian | 2,44 · 2,78 | sotto | 0,628 | non passerà | 2 stagioni |
| São Paulo | 2,96 · 2,11 | sotto | 0,619 | non passerà | 2 stagioni |
| Emilia Romagna | 2,00 · 3,40 | oscilla | 0,602 | non passerà | 2 stagioni |
| British | 2,58 | sotto | 0,586 | non passerà | 1 stagione |
| Monaco | 8,71 · 2,35 | oscilla | 4,785 | non passerà | 2 stagioni |
| Australian | 3,46 · 2,78 | oscilla | 0,271 | non passerà | 2 stagioni |
| Spanish | 3,36 · 3,61 | sopra | 0,282 | non passerà | 2 stagioni |
| Miami | 2,61 · 3,29 | oscilla | 0,181 | non passerà | 2 stagioni |
| Dutch | 2,68 · 3,55 | oscilla | 0,117 | non passerà | 2 stagioni |

*(Belgian e British poggiano su una sola stagione: sono impegni congelati, non previsioni
informative. Monaco ha D enorme ma segno oscillante — la falsifica (i), non (ii).)*

### Quando scatterà davvero

Poiché il regime 2023-25 è chiuso, **l'unica strada per un verdetto vero è il regime 2026**,
che deve accumulare 3 stagioni. Dieci circuiti hanno già la prima:

`Australia · Austria · Belgio · Gran Bretagna · Canada · Cina · Giappone · Miami · Monaco ·
Spagna` (2026 = 1ª stagione)

Servono 2027 e 2028 — e servono **asciutte**. **Primo verdetto onesto possibile: fine 2028.**
Il calendario, non il metodo, è il collo di bottiglia. La domanda però è piantata: la
sorveglianza gira idempotente e parlerà da sola quando i dati arriveranno.

### Una via per non aspettare due anni (proposta al tavolo, non eseguita)

Il 2022 è **lo stesso regime tecnico** del 2023-25 (effetto suolo, stesso pacchetto). Se il
tavolo dichiarasse il regime come "2022-25", ogni circuito guadagnerebbe una stagione: la
maggior parte degli 11 indecidibili diventerebbe giudicabile **subito**, e — cosa più
importante — quelle celle **non hanno ispirato il metro**, quindi sarebbero prova vera.
Non l'ho fatto: ridefinire un regime è una decisione del tavolo, non dell'agente, e
richiede di ingerire dati nuovi.

---

## Vincoli rispettati

Solo il fondo · blocchi indipendenti · soglia derivata dai dati e non fissata a mano ·
ogni valore col suo generatore committato · kernel di produzione intatto · nessuno
strumento statistico nuovo (permutazione delle etichette, media pesata, quantile della
nulla: tutti già dichiarati) · nessun push, nessuna PR, nessun merge.

---

## Appendice — un bug di riproducibilità trovato e corretto stanotte

Il controllo "il file committato coincide con l'output corrente del suo generatore?" ha
fallito: due esecuzioni consecutive di `run_scienziato.py` producevano `esito_fuel.json`
diversi. Causa: il null di permutazione derivava il seme da `hash(blocco['id'])`, e in
Python l'hash delle stringhe è **salato per processo** (`PYTHONHASHSEED`). Il null non era
riproducibile.

Corretto con `zlib.crc32` ([fenomeno_fuel.py:195](ai_lab/scienziato/fenomeno_fuel.py:195)).
**È una correzione di determinismo, non di metodo**: la procedura di permutazione è
identica, cambia solo come si deriva il seme — quindi non ricade sotto la regola "STOP alla
terza correzione statistica in corsa". I risultati non si spostano: p resta 0,0025 in
entrambi i regimi, Δ 2023-25 = +3,151 [2,919 · 3,396], Δ 2026 = +2,194 [1,654 · 3,424].
Verificato: due esecuzioni consecutive ora danno file identici, e tutti gli artefatti sono
stati rigenerati (soglia k=3 = 0,8686 s, promossi Austria e Bahrain: invariati).
