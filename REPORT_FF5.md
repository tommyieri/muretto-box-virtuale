# REPORT — Sessione FF5: pit-loss realizzato per-gara (fino al checkpoint)

Pre-registrazione: **`PREREG_SESSIONE_FF5.md`** @ `e000124`. Generatore:
**`gen_pitloss_pergara.py`**. Dati: **`data/pitloss_realizzato_2026.csv`**,
**`data/pergara_stops.csv`** (1.256 stop, 9 circuiti). Strumento: **`demo/att6.mjs`** @
`2f297df`. **Nessun file di produzione toccato. Golden intatti. F5.5 NON eseguita: questo
report si ferma al CHECKPOINT PO, come pre-registrato.**

```
F5.1 riproducibilità: 9/9 gare entro 0,2 s dalle stime dichiarate (pena uscita con errore)
F5.2 classi: DA ATTIVARE [Australia, Miami, Monaco, Spagna] | GIÀ CALIBRATE [Canada, GB,
     Austria] | NON MISURABILI [Cina, Giappone] — identica all'attesa del prereg
F5.3 golden: cambiano 3 casi su 11 (Monaco-HAM solo gap ±2,19; Australia-VER P7→P8;
     Miami-PIA P14→P12); gli altri 8 devono restare identici
F5.4 ATT6: Miami PULITA (6 migliorati sensibili, 0 peggiorati) | Australia, Monaco,
     Spagna: ATTESA SMENTITA — casi sensibili peggiorati, spiegati sotto, gare FERME
CHECKPOINT PO (14/07/2026): APPROVATA SOLO MIAMI — F5.5 eseguita: 22,63 -> 20,11,
     golden rigenerato (solo Miami-PIA cambiato, identico alla tabella F5.3), suite verde
```

## F5.1–F5.2 — La misura ufficiale

| gara | cond. | n | realizzato | IQR | tipico 18–25 | produzione | Δ | classe |
|---|---|---:|---:|---:|---:|---:|---:|---|
| Australia | DRY | 7 | 24,10 | **10,17** | 21,75 | 18,15 | −5,95 | DA ATTIVARE |
| Cina | DRY | 4 | 34,51 | 16,77 | 24,04 | 22,97 | −11,54 | **NON MISURABILE** |
| Giappone | DRY | 4 | 22,79 | 0,84 | 23,00 | 23,72 | +0,93 | **NON MISURABILE** |
| Miami | DRY | 18 | 20,11 | **0,98** | 19,68 | 22,63 | +2,52 | DA ATTIVARE |
| Canada | DRY | 5 | 24,24 | 4,26 | 19,70 | 24,37 | +0,13 | GIÀ CALIBRATA |
| Monaco | DRY | 14 | 22,61 | 3,44 | 20,74 | 24,80 | +2,19 | DA ATTIVARE |
| Spagna | DRY | 35 | 24,59 | 1,93 | 22,93 | 22,38 | −2,21 | DA ATTIVARE |
| Austria | DRY | 30 | 21,98 | 0,76 | 21,19 | 21,63 | −0,35 | GIÀ CALIBRATA |
| Gran Bretagna | DRY | 17 | 20,43 | 3,41 | 20,00 | 20,80 | +0,37 | GIÀ CALIBRATA |

Riproducibilità contro le stime di scoping: passata su tutte e nove (tolleranza 0,2 s,
verificata dal generatore che esce con errore). Riconciliazione scarti esatta per gara.

## F5.4 — ATT6: l'attesa pre-registrata è SMENTITA su 3 gare su 4, e il prereg impone di scriverlo

L'attesa era: *"con candidato = realizzato i casi sensibili non peggiorano, e ad Australia
devono comparire miglioramenti"*. Esito:

| gara | tipicità (informativa) | sensibili migliorati/peggiorati/invariati | esito |
|---|---|---|---|
| **Miami** | 0,43 | **6 / 0 / 3** | **NESSUN PEGGIORAMENTO SENSIBILE** |
| Australia | 2,35 (atipica) | 0 / **9** / 2 | ATTENZIONE — ferma |
| Monaco | 1,87 | 0 / **3** / 0 | ATTENZIONE — ferma |
| Spagna | 1,66 | 1 / **4** / 18 | ATTENZIONE — ferma |

### Le spiegazioni, caso per caso (verificate sui dati, non ipotizzate)

**Australia — 8 dei 9 peggioramenti sono pit sotto Safety Car.** I giri 11–19 della gara demo
sono neutralizzati (17–19 auto su 20): lì il pit-loss reale è molto più piccolo del verde — è
il motivo per cui il modulo pit **sopprime i gap sotto SC** ("il pit-loss verde sovrastima la
perdita reale", commento nel modulo stesso). Qualunque aumento del parametro verde "peggiora"
i casi SC, qualunque riduzione li "migliora": **sono non informativi per il parametro verde**.
Lo specchio è Miami: i suoi pit L10–11 sotto SC migliorano col candidato *più basso* — stesso
meccanismo, segno opposto. L'unico caso verde sensibile di Australia (VER L41) peggiora 1→2
perché il suo stop personale fu **20,81 contro la mediana 24,10** (−3,3 s): con **IQR 10,17 su
7 stop**, ad Australia nessun valore unico serve bene i singoli casi. **Il −5,95 di errore in
produzione resta vero sulla mediana verde, ma attivare 24,10 peggiorerebbe i consigli sui pit
realmente avvenuti in quella gara (dominata dalla SC).**

**Monaco — 3 su 3 peggioramenti su pit verdi, ed è il Monaco già noto.** I tre stop personali
(RUS 21,08 / ALB 19,65 / SAI 19,74) sono tutti **sotto** la mediana 22,61, eppure la produzione
più alta (24,80) predice meglio i ranghi reali: al rientro c'è la **coda nel traffico**, che il
delta del singolo stop non prezza ma la posizione a fine out-lap sì. È esattamente la proprietà
che il PO ha dichiarato **permanente e non separabile** in FF3. Il 24,80 in produzione funziona
da cuscinetto-traffico empirico. La mediana realizzata è la misura più "giusta" della grandezza
sbagliata per Monaco.

**Spagna — il caso marginale.** 4 sensibili peggiorati contro 1 migliorato, **tutti di ±1
posizione**, con 18 invariati. La misura è la più solida delle quattro (n=35, IQR 1,93): il
24,59 È il loss di quella gara. Ma al livello dei ranghi l'evidenza non mostra miglioramento
(PIA e SAI avevano stop personali ≈ mediana e peggiorano comunque di 1: soglie di rango, non
dispersione). Nessuna spiegazione pulita a favore dell'attivazione.

### La lezione (da portare nel metodo, non da applicare ora)

ATT6 v2 include **tutti** i pit reali, anche quelli sotto SC — dove il parametro verde non si
applica per costruzione. Nelle gare SC-dominate (Australia, e in parte Miami) i casi SC dominano
il conteggio dei sensibili (il campo compattato rende tutto "sensibile"). Una futura revisione
potrebbe **etichettare i casi SC come non-informativi per il parametro verde** — ma è un cambio
di metodo: va pre-registrato, non applicato a valle di questi numeri. Qui i conteggi restano
quelli della regola incisa.

## Raccomandazione per il CHECKPOINT (la decisione è del PO)

- **Miami: ATTIVARE 20,11.** Tutto allineato: tipicità 0,43, misura strettissima (IQR 0,98 su
  18 stop), 6 miglioramenti sensibili su pit verdi, 0 peggioramenti, golden noto (PIA P14→P12).
- **Australia, Monaco, Spagna: NON attivare ora.** La regola dura è scattata e le spiegazioni
  non giocano a favore: Australia è SC-dominata e dispersa (nessun valore unico la serve),
  Monaco è il traffico permanente, Spagna non mostra miglioramento ai ranghi. Le misure restano
  agli atti (`pitloss_realizzato_2026.csv`): non sono sbagliate — sono giuste per una grandezza
  che il rango al rientro non premia in quelle tre gare.
- Cina e Giappone: NON MISURABILI (n=4, la soglia non si abbassa). Canada, Gran Bretagna,
  Austria: GIÀ CALIBRATE, non si toccano.

Se il PO approva Miami: F5.5 = tag di rollback → `pitloss.json` "Miami": 22.63 → 20.11 →
rigenerazione golden con verifica contro la tabella F5.3 (solo il caso Miami-PIA deve cambiare,
P14→P12) → suite completa → nota semantica col protocollo ricorrente (prossima applicazione:
Spa, dopo il 19/07).

## Indice
- `PREREG_SESSIONE_FF5.md` (@ `e000124`) · `gen_pitloss_pergara.py` · `demo/att6.mjs` (@ `2f297df`)
- `data/pitloss_realizzato_2026.csv` · `data/pergara_stops.csv` · `data/att6_{melbourne,miami,monaco,catalunya}_2026.json`
- Il quadro che ha motivato la sessione: riportato al PO il 14/07 (scoping, scratchpad)
