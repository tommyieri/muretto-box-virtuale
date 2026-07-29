# PREREG — Sessione FF5: "pitloss-pergara" (il realizzato per la demo)

Branch: `ff5-pitloss-pergara` (da `main` @ 6d62cd8, che include i dati engine-ready FF4 e il
prereg ATT6 v2 con i 4 addendum).

**Dichiarazione di onestà, prima di tutto.** Questo prereg NON precede ogni numero: precede il
**run ufficiale** e ogni tocco a produzione e golden. Le **stime di scoping** esistono già — il
"quadro dei 9 circuiti" del 14/07/2026, calcolato in scratchpad **su mandato esplicito del PO**
("prendi quanti dati vuoi e dimmi come potrebbe tornare"), non committato. Questo prereg congela
metodo, soglie e criteri di fallimento **prima** che quei numeri diventino ufficiali e prima di
qualsiasi attivazione. Le stime note sono riportate in F5.1 proprio perché il lettore possa
verificare che le soglie non siano state disegnate attorno a loro dopo: **le soglie qui usate
(1,0 s / n≥5 / regola del caso sensibile) sono le stesse già in vigore nelle sessioni
precedenti** (GIÀ CALIBRATO di FF3/FF4; minimo casi di ATT6 v2 Addendum 2, qui riusato come
guardia di misura; Addendum 4).

Vincoli: NON si toccano kernel, `data/golden_testB.csv`, `demo/pitscenario.mjs`,
`pipeline_gara.py`, `data/pit_loss_circuito_f1db.csv` (in FF5 il CSV è **fuori ambito**: resta
il parametro tipico per lo staging). `demo/data/pitloss.json` e `demo/golden_pit.json` si
toccano **solo nella fase di attivazione, dopo il checkpoint PO**, mai prima. Nessun push,
nessun merge: decide il PO.

---

## La decisione di architettura che questa sessione implementa (dal quadro del 14/07, approvato dal PO)

Due consumatori, due grandezze, due fonti:

| consumatore | grandezza | fonte |
|---|---|---|
| **demo** (rigioca una gara specifica: "se pitti al giro X, dove rientri *in quella gara*") | pit-loss **REALIZZATO della gara** | `demo/data/pitloss.json`, per-gara — **questa sessione** |
| **staging di gare future** (`pipeline_gara.py`) | pit-loss **TIPICO del circuito** | `data/pit_loss_circuito_f1db.csv` — sessioni FF2/FF3/FF4, fuori ambito qui |

Evidenza che fonda la decisione (già committata o riportata al PO): il caso NOR L15 — realtà
P14; il motore predice P14 col realizzato (24,24) e P11 col tipico (18,96/19,71); la tabella dei
9 circuiti; la controprova a due metodi (settori vs giro intero concordi entro ±0,94 s sulle
gare 2026 confrontabili).

**Conseguenza dichiarata per ATT6 v2**: il gate di tipicità (Addendum 4) fu scritto per
giudicare un candidato *tipico* contro una gara che poteva essere atipica. Qui il candidato È il
realizzato della gara stessa: il confronto col grappolo **non decide nulla** e sarebbe perverso
(bloccherebbe proprio le gare atipiche, cioè quelle che più hanno bisogno della correzione —
Australia). In FF5 la tipicità si **stampa come informativa** (dice quanto la gara è anomala,
utile al lettore); **il gate che resta operativo è la regola dura del caso sensibile**
(Addendum 4, punto 3). Questo non modifica il prereg ATT6 v2 per il suo scopo originario
(giudicare candidati tipici, es. Spa): è la sua applicazione al caso "candidato = realizzato",
decisa qui, prima dei numeri ufficiali.

## F5.1 — Misura ufficiale (il generatore, non lo scratchpad)

`gen_pitloss_pergara.py`, committato: per ognuna delle **9 gare demo** (le chiavi di
`pitloss.json`), misura il **pit-loss realizzato engine-ready** = mediana dei delta a giro
intero degli stop validi della gara 2026, con **metodo FF4 invariato e importato**
(`collect_whole_lap` da `gen_pitloss_engine_ready.py`, che a sua volta importa i filtri FF2/FF3:
verde su in/out-lap, IsAccurate sui soli riferimenti, riferimento out sui giri 2–5 del nuovo
stint, drive-through esclusi col rilevatore della gomma che invecchia, primo/ultimo giro
esclusi, stint corti esclusi, riconciliazione scarti esatta pena uscita con errore).

Output: `data/pitloss_realizzato_2026.csv` — per gara: realizzato, n stop validi, IQR
(diagnostica), condizione, tipico 2018–2025 del circuito (informativo), valore attuale in
produzione, delta.

**Controllo di riproducibilità (pre-registrato)**: le stime di scoping note sono
Australia 24,10 · Cina ~34,5 · Giappone 22,79 · Miami 20,11 · Canada 24,24 · Monaco 22,61 ·
Spagna 24,59 · Austria 21,98 · Gran Bretagna 20,43. Se un valore ufficiale differisce dalla
stima di **più di 0,2 s**, STOP e diagnosi prima di procedere: vorrebbe dire che generatore e
scratchpad non calcolano la stessa cosa.

## F5.2 — Classificazione per gara (soglie incise ORA)

Per ogni gara, nell'ordine (il primo che scatta vince):

1. **NON MISURABILE** — stop validi **< 5**. Il valore in produzione **resta invariato** e lo si
   dichiara. *(Dalle stime: Cina n=4 — con dentro due stop rotti da 37 e 47 s di corsia — e
   Giappone n=4. La soglia non si abbassa: Giappone resterebbe fuori anche se il suo delta
   stimato è solo 0,93.)*
2. **GIÀ CALIBRATA** — |produzione − realizzato| ≤ **1,0 s**. Non si tocca.
   *(Attese: Canada 0,13 · Gran Bretagna 0,37 · Austria 0,35.)*
3. **DA ATTIVARE** — |produzione − realizzato| > 1,0 s con n ≥ 5.
   *(Attese: Australia −5,95 · Miami +2,52 · Spagna −2,21 · Monaco +2,19.)*

Se i numeri ufficiali spostano una gara da una classe all'altra rispetto alle attese, **vince il
numero ufficiale** e la discrepanza si dichiara nel report.

## F5.3 — Golden: la tabella PRIMA di toccare

Gli 11 casi golden usano `pitloss[gara]`. Per ogni caso di una gara DA ATTIVARE si calcola,
**prima di modificare qualsiasi file**, la tabella `caso | vecchio atteso | nuovo atteso | delta`
(tutti i campi congelati: rientro_pos, gap, neutralizzazione). Casi potenzialmente toccati:
Monaco×3, Australia×1, Miami×1, Spagna×1 (6 su 11). I casi delle gare non attivate (Austria×2,
Cina×1, Giappone×1, Canada×1) **devono restare identici dopo la rigenerazione**: se cambiano, è
un bug ⇒ rollback. Nota: i 3 casi Monaco sono sotto SC con gap soppressi — è possibile che il
delta sia nullo come fu per il caso Canada; lo dirà la tabella, non lo si assume.

## F5.4 — ATT6 v2 su ogni gara DA ATTIVARE (prima del checkpoint)

`node demo/att6.mjs <circuito> 2026 <realizzato>` per ciascuna. Si legge:
- tipicità: **informativa** (vedi sopra);
- tabella completa; **regola dura**: un caso SENSIBILE che peggiora rispetto alla produzione
  attuale ⇒ quella gara **non si attiva** finché il caso non è guardato e spiegato per iscritto
  nel report. Nessuna eccezione, nemmeno se le altre gare passano.
- Attesa dichiarata (falsificabile): con candidato = realizzato i casi sensibili non peggiorano,
  e ad Australia (dove la produzione sbaglia di ~6 s) devono comparire miglioramenti. Se
  l'attesa è smentita, si scrive e quella gara si ferma.

Prerequisito dichiarato: `demo/att6.mjs` (scritto il 14/07, funzionante, smoke su Montreal e
Silverstone già riportato al PO) viene **committato all'inizio di FF5**, prima del run F5.1,
insieme ai due JSON di smoke. Lo smoke Silverstone con esito "PRIMA = ADESSO" è spiegato: la
produzione lì è già il valore attivato — sotto FF5 non è un'anomalia, è una GIÀ CALIBRATA.

## CHECKPOINT PO (obbligatorio, tra F5.4 e F5.5)

Il PO legge: tabella F5.2, tabella golden F5.3, i quattro ATT6 F5.4. Decide **quali** gare
attivare (anche un sottoinsieme). Senza checkpoint esplicito, F5.5 non parte.

## F5.5 — Attivazione (solo dopo il checkpoint, solo gare approvate)

1. Tag di rollback `pre-attivazione-ff5-2026-07-14` prima di ogni modifica.
2. `demo/data/pitloss.json`: aggiornate le sole gare approvate, ai valori realizzati
   (2 decimali). **`pit_loss_circuito_f1db.csv` NON si tocca.**
3. Rigenerazione golden (`demo/gen_golden_pit.mjs`), verifica contro la tabella F5.3: i delta
   osservati devono combaciare con quelli pre-calcolati, i casi non-target identici.
4. Suite completa: `test_b.mjs` **449/449 invariato** (se cambia, si è toccato il kernel ⇒
   rollback), `demo/test_pit.mjs` 11/11 sul golden nuovo, `test_degrado_hook.mjs`,
   `check_banda_gancio.mjs`.
5. Nota semantica: `pitloss.json` cambia significato — da "valore f1db travasato allo staging" a
   "pit-loss realizzato della gara (engine-ready), aggiornato post-gara". La nota dichiara anche
   il **protocollo per le gare future**: allo staging una gara nuova riceve il tipico dal CSV
   (pipeline invariata); **dopo** la gara si misura il realizzato e lo si attiva con questo
   stesso protocollo (F5.1→F5.5). Prima applicazione attesa: **Spa, dopo il 19/07/2026**.

## Leve vietate (per nome)

- Abbassare n≥5 per ripescare Cina o Giappone; spostare la soglia 1,0 s.
- Usare il gate di tipicità per bloccare o sbloccare un'attivazione (è informativo in FF5).
- Escludere stop "rotti" per rendere misurabile una gara (Cina resta fuori anche se
  scartando i suoi due stop lenti diventerebbe misurabile: sarebbe la leva).
- Attivare una gara con un caso sensibile peggiorato senza spiegazione scritta.
- Ritoccare i valori realizzati (arrotondamenti oltre i 2 decimali, "aggiustamenti").
- Toccare CSV f1db, kernel, pipeline, o attivare senza checkpoint.

## Criteri di fallimento

1. Riproducibilità F5.1 violata (>0,2 s da una stima) ⇒ STOP e diagnosi.
2. Riconciliazione scarti non esatta ⇒ il generatore esce con errore.
3. Golden non-target cambiato, o delta diverso dalla tabella F5.3 ⇒ rollback totale al tag.
4. `test_b` ≠ 449/449 ⇒ rollback totale.
5. Caso sensibile peggiorato non spiegato ⇒ quella gara non si attiva (le altre possono).

## Output attesi

- `PREREG_SESSIONE_FF5.md` (questo file, committato per primo)
- `demo/att6.mjs` + `data/att6_*.json` (smoke già eseguiti, committati come prerequisito)
- `gen_pitloss_pergara.py` — generatore committato
- `data/pitloss_realizzato_2026.csv`
- Tabella golden F5.3 nel report, **prima** delle modifiche
- `REPORT_FF5.md` con in cima: la classificazione delle 9 gare, i 4 ATT6, l'esito del checkpoint
- Dopo il checkpoint: `pitloss.json` aggiornato, golden rigenerati, suite verde, nota semantica

Nessun verdetto strategico: è del PO — che in questa sessione ha un checkpoint esplicito.
