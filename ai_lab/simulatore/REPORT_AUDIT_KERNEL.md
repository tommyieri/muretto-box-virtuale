# REPORT — l'audit del kernel, chiuso

*28/07/2026. Autorizzazione del PO: «anche il kernel è in discussione, se trovi errori li puoi
correggere». Questa è la prima modifica di questo arco che tocca la **produzione**.*

**In una riga:** quattro difetti chiusi nel kernel e nell'esportatore, più due soglie cablate
nei test che erano golden non dichiarati. **Nessuna decisione del prodotto si è mossa** — sui
22 casi golden posizione di rientro, gruppo, chi è davanti e dietro e neutralizzazione sono
**identici**; si sono spostati solo i gap in secondi, in 5 casi su 22.

---

## 1. Le impronte

| file | prima | dopo |
|---|---|---|
| `engine/engine.py` | `d2bee2dca871` | **`57fe44245314`** |
| `demo/engine.mjs` | `e84dbf2b08b1` | **`0bbdfde25023`** |

Il `d2bee2dca871` è il tripwire citato in `REPORT_MOTORE_2026.md` e
`REPORT_PARTIZIONE_TEMPORALE.md`. **È cambiato di proposito**, e questo documento è il motivo.

---

## 2. I quattro difetti chiusi

### K1 — `_neut` non conosceva la bandiera rossa  `engine.py:20`

```python
prima:  def _neut(s): return ('4' in s) or ('6' in s)
dopo:   def _neut(s): return ('4' in s) or ('5' in s) or ('6' in s)
```

L'alfabeto è `{1,2,4,5,6,7}` e sta in `data/STATUS_VOCABOLARIO_NOTA.md`: **5 = bandiera
rossa**, codice **committato**. Un giro di gara sospesa passava per verde.

**`2` (gialla) e `7` (VSC in chiusura) NON sono stati aggiunti**: il vocabolario li marca
«ipotesi FIA, non committata», e `neutralized` è un regime dichiarato, non un sospetto. Che
non siano *verdi* è un'affermazione diversa e più debole, e vive nel filtro del passo (K2).

*Effetto sul 2026: nessuno — non ci sono giri con `5`.* È una correzione per lo storico e per
il futuro, non per i dati di oggi.

### K2 — il filtro «verde» del passo ammetteva giri sporchi  `engine.py:41`

Il nuovo `_verde` vuole `status == '1'` esatto, mescola slick, giro non cancellato. Prima
entravano nella mediana del passo:

```
421 giri (3,87 %)  bandiera GIALLA
153 giri (1,41 %)  CANCELLATI dai commissari
 30 giri (0,28 %)  su gomma da BAGNATO
```

**Effetto misurato** su 11.240 celle pilota-giro: scarto mediano **0,0000 s** (la mediana è
robusta), ma **11,37 % delle celle si sposta di oltre 0,10 s**, 0,82 % di oltre 0,50 s, punta
di **2,93 s**. Il danno era tutto nelle code — cioè dove il pilota ha pochi giri validi nello
stint: **subito dopo una sosta**, che è quando si guarda il pannello.

**Prezzo, misurato prima di decidere**: la copertura del passo scende di **1,00 punto** (148
celle su 14.748 perdono il passo). Undici punti di celle migliori contro uno di silenzio in
più: si paga.

### K3 — `CarObs` non portava `status` né `del`  `engine.py:11`

K2 non era **chiudibile** senza questo: l'informazione non arrivava fino a `pace_base`. Due
campi additivi con default, e ora `demo/data/<gara>.json` li esporta entrambi — così anche i
consumatori a valle (`demo/`, `live/`, laboratorio) possono rifare un filtro corretto invece
di fidarsi di un booleano già digerito.

### K4 — il letterale `"None"` non lavato  `engine.py:22` (`ti_adapter`)

Il grezzo scrive la **stringa** `'None'` per i mancanti. `time`, `pin`, `pout`, `stint`, `life`
erano lavati; `compound` no — è una `str`, quindi `isinstance(...,str)` la lasciava passare.
Risultato: `compound = "None"` fino in pagina, 25 celle su Ungheria (PER, giri 22-46). Trovato
in Fase 0, chiuso qui. **Verificato: 0 celle residue.**

---

## 3. Il difetto che la correzione ha fatto emergere

Appena il filtro è stato stretto, `test_b.mjs` è esploso con errori di **480 secondi** — cinque
giri di gara fermi. Diagnosi: tre piloti (BEA, GAS, STR) hanno smesso di avere un passo, e

> **`simulate` non escludeva chi non ha un passo: lo lasciava congelato e lo restituiva
> comunque, col `cum_time` del giro di congelamento.** Un numero che sembra valido e non lo è.

I chiamanti di produzione si salvavano filtrando a monte (`evaluatePit` e `traiettoriaPit`
fanno `pace[d] != null`), ma il kernel restituiva una bugia a chi non filtrava — e il banco
non filtrava.

**Corretto in tutti e due i kernel**, JS e Python: chi non ha un passo esce con `null`. I
chiamanti che già controllavano `== null` non cambiano comportamento; chi non controllava
smette di ricevere un numero inventato. Dopo la correzione l'allineamento JS↔Python è
**esatto**: `max |JS − Python| = 0,00e+0` su 443 casi.

---

## 4. Le due soglie cablate — golden non dichiarati

Entrambi i test dell'allineamento contenevano, dentro la condizione di successo, il numero
**449**: quanti casi il Python riesce a valutare. Ma quello è un fatto **sui dati**, non
sull'allineamento. Corretto il filtro, i casi valutabili sono passati a 443 e i test
fallivano **con l'allineamento perfetto** (`0,00e+0` in JS, `3,55e-15` in Python).

```
test_b.mjs   prima:  ok = rows.length === 449 && maxDiff < 1e-9
             dopo :  ok = rows.length === ref.length && maxDiff < 1e-9
test_b.py    prima:  ok1 = len(R1)==449 and d1.max()<1e-6
             dopo :  ok1 = len(R1)>0 and d1.max()<1e-6
```

Ora l'attesa si legge dal riferimento: *«JS riproduce ogni caso che il Python ha prodotto»*. Il
numero non è più scritto da nessuna parte, quindi non può più scadere.

### Una terza soglia che ho lasciato rossa, di proposito

`test_b.py` ha anche `ok2 = med < 2.10`, e adesso la mediana è **2,176**. Non l'ho toccata.

È un **marcatore della migrazione da Colab**, non un criterio di correttezza — il messaggio di
successo dice *«MIGRAZIONE FATTA: engine fuori da Colab riproduce golden a precisione-float e
+27 %»*. E soprattutto: cambiare una terza soglia dopo averne cambiate due sarebbe **tarare i
test sul mio risultato**.

Il motore **non è peggiorato**, e l'ho misurato sulla stessa popolazione:

```
casi migliorati 213 / peggiorati 227 su 443
variazione MEDIANA APPAIATA  +0,0000 s   IC95 [-0,0000 ; +0,0000]
```

Le variazioni sono **simmetriche attorno a zero**. La mediana della *distribuzione* si sposta
(2,219 → 2,362) perché in una popolazione densa bastano pochi casi che si riordinano; la
mediana della *differenza appaiata* — che è la domanda giusta — non si muove.

`test_b.py` **non è nel ciclo automatico** (`auto_gara.py` esegue `test_b.mjs`, `test_pit.mjs`,
`test_live_bylap.mjs`), quindi lasciarlo rosso non blocca niente. **Resta sul tavolo del PO.**

---

## 5. Cosa è cambiato per chi guarda — misurato

### Sui 22 casi golden del pannello

| campo | cambiati |
|---|---|
| `rientro_pos` · `su_totale` · `davanti_ho` · `dietro_esco` | **0 su 22** |
| `sotto_neutralizzazione` · `giro_neutralizzato` · `ok` | **0 su 22** |
| `gap_ahead` · `gap_behind` | 5 su 22 |

**Nessuna decisione si è mossa. Solo la precisione dei distacchi.** È l'esito che ci si augura
da una correzione di correttezza: la struttura della risposta è stabile, i numeri sono più veri.

### Sui banchi del simulatore, rilanciati sul passo corretto

| | prima dell'audit | dopo |
|---|---|---|
| soste rigiocate | 337 | 335 |
| G0 · motore di oggi | 0,0 % | **0,0 %** |
| G0 · Fase 2 (età gomma) | 70,0 % | **69,9 %** |
| T5 · bias Fase 1 (10 giri) | −0,543 | **−0,543** |
| T5 · bias Fase 1 + ρ (10 giri) | −0,178 | **−0,178** |
| posizioni mosse da Fase 2 | 13,9 % | **12,8 %** |
| gradino misurato vs −ρ·età | −1,108 / −0,804 | **−1,105 / −0,809** |

Nessuna conclusione delle Fasi 0, 1 e 2 cambia.

---

## 6. La suite, dopo

```
test_b.mjs           PASSA   (443/443, allineamento sotto 1e-9)
test_pit.mjs         PASSA   (22/22, golden ri-congelato)
test_live_bylap.mjs  PASSA
test_gradino.mjs     PASSA      test_ghostplay.mjs   PASSA
test_traiettoria.mjs PASSA      test_playhead.mjs    PASSA
test_live_timing.mjs PASSA
test_b.py            ROSSO   (solo la soglia 2,10 della migrazione — §4)
```

**I golden ri-congelati sono stati salvati prima**, in
`ai_lab/simulatore/golden_pre_audit/`: `golden_testB.csv`, `ref_traffic_py.json`,
`golden_pit.json`. Il cambiamento resta ispezionabile riga per riga, e reversibile.

---

## 7. Cosa NON è stato fatto

- **`live/pace_base_live.py` non è allineato.** Ha la sua copia della definizione di passo e
  riceve dal collettore un `neutralized` già digerito, senza `status` né `compound`: il filtro
  corretto lì richiede di far passare più campi dal collettore. **Il replay e la diretta ora
  misurano il passo in due modi diversi**, ed è un debito dichiarato, non una svista.
- **Le costanti di carburante non sono state unificate** (8 file col 3,0/70, uno col 2,1).
  Censite in `REPORT_FASE1.md` §E4; toccarle sposta artefatti già a referto.
- **`neutralizzazione.json` non è stato rigenerato**: lo produce `gen_neutralizzazione.py`, che
  ha la sua logica e il suo perimetro. Fuori da questo intervento.
- **Il `2` e il `7` restano fuori da `neutralized`** (§K1): sono ipotesi non committate.

---

### Riprodurre

```bash
python3 -c "import sys,json,os; sys.path.insert(0,'engine'); sys.path.insert(0,'.'); \
  import pandas as pd; from export_demo import export_gara; \
  reg=json.load(open('data/gare_registro.json')); \
  [json.dump(export_gara(k, raw=pd.DataFrame(json.load(open(v['raw'])))), \
   open(f'demo/data/{k}.json','w'), separators=(',',':')) for k,v in reg.items()]"
python3 ai_lab/simulatore/verifica_derivati.py     # 0 difformi, 0 letterali "None"
node test_b.mjs && cd demo && node test_pit.mjs && node test_live_bylap.mjs
```
