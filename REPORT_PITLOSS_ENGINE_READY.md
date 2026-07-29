# REPORT — Sessione FF4: pit-loss engine-ready (giro intero)

Pre-registrazione: **`PREREG_SESSIONE_FF4.md`** @ `71d1a0a`, committata **prima di qualsiasi
calcolo a giro intero**. Generatore: **`gen_pitloss_engine_ready.py`** (importa gli helper da
`gen_censimento_pitloss.py`: il metodo non può divergere). Dati:
**`data/pitloss_engine_ready.csv`**, **`data/engine_ready_stops.csv`** (591 stop).
**Nessuna attivazione, nessuna correzione, nessun file di produzione toccato.**

```
F4.0 SILVERSTONE: engine-ready = 20.22 vs 20,80 in produzione, |Δ| = 0.58 s -> CONFERMATO
F4.3 VERDETTI: silverstone [GIÀ CALIBRATO] | montreal [GO*] | spa [GO] | austin [GO]
F4.4 warm-in fuori dai settori: SIL −0.58 | MTL +0.75 | SPA −0.46 | COTA +0.42  (tutti ±0,8)
```

\* **Il GO di Montreal è di MISURA, non di attivazione: ATT6 lo respinge anche a 19,71**
(diagnostica sotto). Vedi "La contraddizione di Montreal".

Golden verdi prima e dopo (`test_b` 449/449, `test_pit` 11/11, degrado hook PASS).
Nessun verdetto strategico: è del PO.

---

## F4.0 — Il test bloccante: **il 20,80 in produzione è CONFERMATO**

| | valore |
|---|---:|
| engine-ready (giro intero, dry) | **20,22 s** |
| in produzione (attivato PR #26, da FF2 per settori) | **20,80 s** |
| **\|Δ\|** | **0,58 s** |
| soglia pre-registrata | 1,5 s |
| **esito** | **CONFERMATO** |

Il 20,80 regge a un metodo **indipendente da quello che l'ha prodotto**: FF2 sommava i settori
affetti, FF4 prende il giro intero. Otto blocchi dry, 122 stop. **L'attivazione di Silverstone
non va rollbackata**, e si è potuto procedere sugli altri tre (regola pre-registrata rispettata).

Dettaglio: `track_time` 8,53 s (coerente con gli 8–9 attesi dalla geometria), 0/122 stop con
pit-loss ≤ 0. Il paniere ha **8 blocchi contro i 7 di FF2** perché il **filtro drive-through di
FF3** recupera il **2021**: FF2 lo escluse per stazionarietà (mediana transito 37,52 s), ma
quelle erano le sei auto **ferme in corsia durante la bandiera rossa**, che ora vengono
riconosciute come non-stop. Un blocco in più, guadagnato da un fix, non da una soglia spostata.

---

## F4.4 — La scoperta: **la diagnosi "limite inferiore" è FALSIFICATA**

Il prereg imponeva: *"Attesa: differenza ~0 a Silverstone, positiva e grande a Montreal. **Se
l'attesa è smentita, si scrive**: vorrebbe dire che la diagnosi del fallimento ATT6 era
sbagliata."*

**L'attesa è smentita. La diagnosi era sbagliata, e la scrivo.**

| circuito | FF3 (settori) | FF4 (giro intero) | differenza = warm-in fuori dai settori |
|---|---:|---:|---:|
| silverstone | 20,80 | 20,22 | **−0,58** |
| montreal | 18,96 | 19,71 | **+0,75** |
| spa-francorchamps | 19,04 | 18,58 | **−0,46** |
| austin | 20,57 | 20,99 | **+0,42** |

**I due metodi concordano entro ±0,8 s su tutti e quattro i circuiti**, e la differenza cambia
pure di segno. Il "warm-in fuori dai settori affetti" che avrebbe dovuto spiegare il fallimento
ATT6 di Montreal **vale 0,75 s**, non i ~4 s che avevo postulato.

### Dove avevo sbagliato, esattamente

`NOTA_MONTREAL_NO_ATTIVAZIONE.md` sostiene: *"gli out-lap reali perdono +8,9 / +8,7 / +6,0 s sul
giro intero contro il verde mediano — distribuiti su S2 e S3, non solo su S1"*. Quel confronto
usava come riferimento **la mediana verde di TUTTA la gara** (77,10 s). Ma quei tre stop sono ai
giri 9–15, **a serbatoio pieno**: i giri verdi di quel momento sono strutturalmente più lenti
della mediana di gara, che include i giri leggeri di fine corsa. **Il +8,9 era gonfiato dal
carburante, non dal warm-in.**

FF2/FF4 usano il **riferimento locale allo stint** — che il carburante lo assorbe per
costruzione — e dicono +0,75. **La diagnostica su 3 stop con riferimento sbagliato ha prodotto
una spiegazione sbagliata di un fallimento vero.** È lo stesso errore che l'arco C→I aveva già
pagato con il residuo non re-inflazionato (`REPORT_RESIDUO.md`, verdetto invalidato): **un
riferimento non-locale porta dentro il carburante**. L'avevo in memoria e l'ho rifatto.

**Conseguenza**: la nota Montreal va letta con la causa **#2 cassata**. La causa **#1 regge** — ed
è ora quantificata (sotto).

### Controprova di validità: gli IC si sono allargati, come pre-registrato

| circuito | larghezza IC95 FF3 (settori) | larghezza IC95 FF4 (giro intero) |
|---|---:|---:|
| silverstone | 2,11 (FF2) | **3,43** |
| montreal | 0,66 | **2,99** |
| spa | 0,38 | **0,92** |
| austin | 0,34 | **0,78** |

Il prereg diceva: *"gli IC di FF4 saranno più larghi... se fossero più stretti sarebbe un
campanello, non una vittoria"*. Sono **tutti più larghi**: il giro intero porta dentro il rumore
del giro completo. L'attesa metodologica ha tenuto, e questo dà fiducia che la misura faccia
quello che dice.

---

## La contraddizione di Montreal — e la sua spiegazione

**ATT6, diagnostica (nessuna attivazione), con i tre candidati:**

| caso | REALE | 24,37 (produzione) | 18,96 (FF3) | **19,71 (FF4)** |
|---|---|---|---|---|
| BOT pit 9 | P21 | P21 ✓ | P21 ✓ | P21 ✓ |
| STR pit 14 | P19 | P19 ✓ | P19 ✓ | P19 ✓ |
| **NOR pit 15** | **P14** | **P14 ✓** | P11 ✗ | **P11 ✗** |

**FF4 non salva Montreal**: a 19,71 ATT6 fallirebbe esattamente come a 18,96. Il metodo
engine-ready misura meglio la grandezza, ma **non chiude il divario con la realtà** su quel caso.

### Perché — verificato sui dati, non ipotizzato

**Lo stop di NOR non è tipico: è atipico di +7,3 s.**

| Montreal, blocchi dry | mediana pit-loss | n stop | mediana transito |
|---|---:|---:|---:|
| 2018 | 18,44 | 18 | 23,75 |
| 2019 | 19,71 | 11 | 23,86 |
| 2022 | 19,65 | 7 | 23,86 |
| 2023 | 19,70 | 11 | 24,16 |
| 2025 | 19,83 | 28 | 23,62 |
| **2026** | **24,24** | **5** | **25,09** |

Il 2026 — **che è la gara demo su cui gira ATT6** — sta **+4,5 s sopra** il grappolo 2018–2025
(che sta in **1,4 s**). E i suoi 5 stop validi sono **sbilanciati verso gli stop lenti**:

| pilota | transito | pit_loss |
|---|---:|---:|
| HUL | 30,95 | 26,99 |
| **NOR** | **28,85** | **27,02** |
| OCO | 24,83 | 24,24 |
| PER | 25,09 | 22,73 |
| STR | 24,25 | 19,60 |

**Il pit-loss reale di NOR quel giorno è stato 27,02**, contro un tipico Montreal di 19,7. ATT6
ha premiato il 24,37 perché è **più vicino a 27 che a 19**, non perché il parametro valga 24.
**Il parametro corretto è stato punito per non riprodurre un evento atipico.**

### La regola che unifica Silverstone e Montreal (e che spiega tutto l'arco)

**ATT6 passa quando la gara demo è tipica, fallisce quando è atipica.**

| circuito | tipico (FF4) | la gara demo (2026) | scarto | esito ATT6 |
|---|---:|---:|---:|---|
| **silverstone** | 20,22 | **20,43** | **+0,2** | **PASSATA** (2/3) |
| **montreal** | 19,71 | **24,24** | **+4,5** | **FALLITA** (0/3) |

Non è una coincidenza: **Silverstone ha funzionato perché la sua gara demo era tipica.** Non
perché il metodo per settori fosse giusto lì e sbagliato altrove — i due metodi concordano
ovunque (F4.4).

---

## Due lacune di metodo, trovate e dichiarate (non risolte qui)

1. **La stazionarietà si controlla sul TRANSITO, mai sul PIT-LOSS.** FF2/FF3/FF4 escludono le
   gare il cui `pit_lane_time` devia > 2,0 s. A Montreal il transito è stazionario (23,6–25,1:
   il 2026 devia di 1,2, sotto soglia ⇒ **incluso**) mentre il **pit-loss** salta di **+4,5**.
   Il veto non poteva vederlo perché guarda la grandezza sbagliata. *(Aggiungere un veto di
   stazionarietà sul pit-loss è un cambio di metodo: va pre-registrato, non fatto qui.)*
2. **ATT6 testa contro UNA gara — quella demo — con 3 stop, di cui tipicamente 2 insensibili**
   (ultimi del gruppo: a Silverstone STR, a Montreal BOT e STR). **Un solo caso decide**, e se
   quel caso è un outlier decide male. Non è un difetto fatale — ATT6 ha comunque impedito
   un'attivazione su una gara che il modello a valore-unico non rappresenta — ma **la soglia
   "2 su 3" è fragile per costruzione.**

**Nessuna delle due è stata usata per ribaltare un verdetto**: la bocciatura ATT6 di Montreal
**resta in piedi**, e Montreal **non si attiva**.

---

## La tabella completa

| circuito | transito | produzione | **engine-ready** | IC95 | largh. | blocchi | stop | guadagno | rapporto | track_time | verdetto |
|---|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---|
| **silverstone** | 28,75 | **20,80** | **20,22** | [19,05–22,48] | 3,43 | 8 | 122 | 0,58 | 0,3× | 8,53 | **GIÀ CALIBRATO** |
| **spa-francorchamps** | 23,15 | 23,36 | **18,58** | [18,18–19,10] | 0,92 | 6 | 134 | 4,78 | **10,4×** | 4,57 | **GO** |
| **austin** | 24,21 | 24,25 | **20,99** | [20,57–21,36] | 0,78 | 7 | 175 | 3,26 | **8,3×** | 3,22 | **GO** |
| **montreal** | 23,85 | 24,37 | **19,71** | [19,04–22,03] | 2,99 | 6 | 80 | 4,66 | **3,1×** | 4,14 | **GO\*** |

**Note oneste sulla tabella:**
- **Silverstone**: la larghezza **3,43 supera i 3,0** del GO. Se fosse una misura nuova sarebbe
  **AMBIGUO**, non GO. È **GIÀ CALIBRATO** perché la precedenza pre-registrata mette
  |guadagno| ≤ 1,0 prima della larghezza — e il senso è quello giusto: **non serve un IC stretto
  per dire "il valore che c'è va bene"**, serve per cambiarlo. Il 20,80 non viene toccato.
- **Montreal**: GO **al pelo su entrambe le soglie** (larghezza 2,99 ≤ 3,0; rapporto 3,1 ≥ 3,0).
  Non ho arrotondato in nessuna direzione. Ed è GO **grazie** all'anomalia del 2026, che allarga
  l'IC ma alza la mediana. **Un GO così sottile, in contraddizione con ATT6, non è un mandato ad
  attivare.**
- **Veto caduto, diagnostica riportata** (come pre-registrato): stop con
  `pit_loss > pit_lane_time` = SIL 1/122, SPA 3/134, COTA 7/175, MTL 0/80. Stop con
  `pit_loss ≤ 0`: **0 ovunque** ⇒ il veto rimasto non scatta da nessuna parte.
- **Paniere wet** (archiviato, nessuna soglia, non in produzione): SIL 26,75 · MTL 23,78 ·
  SPA 27,49 — **1 blocco ciascuno**, nessun IC. Austin non ha gare wet.
- Riconciliazione scarti **esatta** su tutti e quattro (il generatore esce con errore altrimenti):
  SIL 375 = 163 validi + scarti · MTL 274 = 98 · SPA 238 = 160 · COTA 227 = 175.
- La regola FF3 ">2 settori affetti" non si applica (pre-registrato) ⇒ **Canada 2024/2026 e Spa
  2025 rientrano** nel campione. È il motivo per cui Montreal ha 6 blocchi qui contro i 5 di FF3.

---

## Cosa questa sessione ha stabilito

**Guadagnato:**
1. **Il 20,80 di Silverstone è confermato da un secondo metodo indipendente** (Δ 0,58 ≤ 1,5).
   L'unico valore pit-loss in produzione regge.
2. **Il metodo per settori NON era un limite inferiore**: concorda col giro intero entro ±0,8 s
   su 4 circuiti. FF2/FF3 misuravano già la grandezza giusta. **Il censimento non va rifatto.**
3. **Il fallimento ATT6 di Montreal è spiegato**: la gara demo 2026 è atipica (+4,5 s) e il caso
   discriminante (NOR) è uno stop da 27,02 contro un tipico di 19,7.
4. **Una mia diagnosi precedente è stata falsificata e corretta** (riferimento non-locale →
   contaminazione da carburante), con la nota Montreal da leggere con la causa #2 cassata.

**NON guadagnato:**
5. **Nessuna attivazione**, per nessuno dei tre GO. Montreal è in contraddizione aperta con ATT6;
   **Spa e Austin non hanno gara demo**, quindi ATT6 lì **non è eseguibile** — e FF4 ha appena
   mostrato che senza ATT6 non si sa se la gara di riferimento sia tipica.
6. Le due lacune di metodo (stazionarietà del pit-loss, fragilità di ATT6) restano **aperte e
   scritte**.

## Proposta per il PO (proposta, non esecuzione)

- **Spa 2026 si corre il 19 luglio** (5 giorni): quando la gara entra in demo, l'ATT6 di Spa
  diventa eseguibile. Il candidato 18,58 (rapporto 10,4×, 6 blocchi coerenti fra loro entro 1,2 s)
  è il più solido dei tre.
- **Prima di quell'ATT6**, varrebbe la pena pre-registrare le due correzioni di metodo che questa
  sessione ha reso visibili: (a) **veto di stazionarietà sul pit-loss**, non solo sul transito;
  (b) **ATT6 su più casi discriminanti**, con gli stop atipici *dichiarati* invece che scoperti a
  posteriori. Entrambe cambiano il metodo ⇒ prereg, non improvvisazione.
- **Montreal**: prima di riproporlo, capire se il +4,5 del 2026 è un regime nuovo (n=5,
  sbilanciato verso stop lenti — sospetto **piccolo campione**) o un fatto. Serve il 2027.

## Indice
- `PREREG_SESSIONE_FF4.md` (@ `71d1a0a`, prima dei numeri) · `gen_pitloss_engine_ready.py`
- `data/pitloss_engine_ready.csv` · `data/engine_ready_stops.csv`
- `NOTA_MONTREAL_NO_ATTIVAZIONE.md` — **causa #2 falsificata da questo report**
- `REPORT_CENSIMENTO_PITLOSS.md` (FF3) · `REPORT_PITLOSS_FF2.md` (FF2) · `NOTA_SILVERSTONE.md`
