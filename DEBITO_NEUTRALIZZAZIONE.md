# DEBITO_NEUTRALIZZAZIONE — due fonti che discordano nel 2,3% dei giri

**Stato: DEBITO documentato, NON risolto in questa sessione** (come da protocollo A-ter/E4).

## Il fatto
Nel formato motore la neutralizzazione (SC/VSC) ha DUE codifiche che non sempre concordano:
- **flag per-auto `neutralized`** (nel formato demo, da `engine/engine.py` `ti_adapter`): un'auto
  e' neutralizzata al giro L se il suo `status` grezzo e' SC (`'4'`) o VSC (`'6'`). Per-auto,
  nessuna soglia.
- **`demo/neutralizzazione.json`** (da `gen_neutralizzazione.py`): un giro e' neutralizzato
  **per la gara** se **>=2 auto** hanno status SC/VSC (`SOGLIA=2`, esclude artefatti mono-auto);
  le finestre sono run massimali di giri consecutivi.

## Quanti casi, quali gare, chi dice cosa
Disaccordo per-giro (flag>0 su almeno un'auto vs giro dentro una finestra json), 9 gare demo:

| gara | giri | flag>0 | json>0 | disaccordo |
|---|---|---|---|---|
| Australia | 58 | 13 | 10 | 3 |
| Austria | 71 | 7 | 6 | 1 |
| Canada | 68 | 15 | 14 | 1 |
| Cina | 56 | 4 | 4 | 0 |
| Giappone | 53 | 7 | 7 | 0 |
| Gran Bretagna | 52 | 15 | 12 | 3 |
| Miami | 57 | 7 | 7 | 0 |
| Monaco | 78 | 14 | 14 | 0 |
| Spagna | 66 | 15 | 10 | 5 |
| **TOTALE** | **559** | | | **13 (2,3%)** |

In **tutti** i casi di disaccordo il **flag marca piu' giri del json** (flag ⊇ json). La causa
e' strutturale e in parte VOLUTA: la soglia `>=2 auto` del json scarta i giri in cui una sola
auto e' sotto neutralizzazione (mono-auto), che il flag per-auto invece marca.

## Provenienza (nessuna delle due e' orfana)
- `neutralizzazione.json`: generatore **committato** `gen_neutralizzazione.py` (legge i raw dal
  registro `data/gare_registro.json`; nota di metodo in `data/NEUTRALIZZAZIONE_NOTA.txt`).
- flag `neutralized`: prodotto dall'adapter del **kernel congelato** (`engine.py` `ti_adapter`)
  dallo `status` grezzo per-auto.

## Perche' non e' "un bug" ma va comunque riconciliato
Le due fonti rispondono a domande diverse: il flag = "QUESTA auto e' neutralizzata a questo
giro" (per-auto); il json = "la GARA e' sotto SC/VSC a questo giro" (per-gara, >=2 auto). Il
problema: **il modulo pit congelato `demo/pitscenario.mjs` usa SOLO il json** per sopprimere i
gap sotto neutralizzazione -> puo' NON sopprimere un pit in cui il pilota e' sotto una
neutralizzazione che coinvolge <2 auto (il flag lo vedrebbe). Sotto-copertura ~2%.

## Raccomandazione (per il PO, non eseguita qui)
1. **Fonte di verita' per l'esclusione/soppressione per-auto**: il flag `neutralized` (piu' fine),
   o l'UNIONE flag∪json (usata in questo audit, prudenziale).
2. **Fonte per le finestre di gara** (banner/timeline, durate): il json va bene, ma la soglia
   `>=2 auto` va DICHIARATA come scelta e le sue conseguenze (sotto-copertura mono-auto)
   documentate accanto al suo uso in `pitscenario.mjs`.
3. Riconciliare significa: o allineare il json alla copertura per-auto per gli usi di
   esclusione, o far leggere al modulo pit anche il flag per-auto. Decisione e implementazione
   al PO — e' un cambio che tocca il modulo pit (congelato), quindi fuori da questa sessione.

## Impatto su questa sessione
L'audit del residuo ha usato l'UNIONE (flag∪json) per escludere le finestre neutralizzate, quindi
e' gia' prudenziale rispetto a entrambe. Il disaccordo del 2,3% non cambia i verdetti E1/E2/E3
(le finestre in disaccordo sono escluse dall'unione). E' un warm-in che aspetta di succedere:
due fonti che dicono cose diverse, oggi innocue perche' unite, pericolose il giorno che qualcuno
ne usa una sola senza saperlo — come gia' fa il modulo pit.
