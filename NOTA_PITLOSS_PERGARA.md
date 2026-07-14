# NOTA — `demo/data/pitloss.json`: semantica per-gara (dal 14/07/2026, Sessione FF5)

## Cosa significa il valore, da FF5 in poi

`pitloss.json` è il pit-loss **per-gara** della demo. Il suo significato è cambiato con FF5:

- **prima**: valore travasato allo staging da `pit_loss_circuito_f1db.csv` (durata f1db, poi
  per Silverstone il tipico misurato) — una grandezza di *circuito* usata come se fosse della gara;
- **ora**: dove misurato e attivato, è il **pit-loss REALIZZATO di quella gara** (metodo
  engine-ready a giro intero, generatore `gen_pitloss_pergara.py`), cioè la grandezza che serve
  alla demo, che rigioca gare specifiche: "se pitti al giro X, dove rientri **in questa gara**".

Perché due grandezze (decisione PO dal quadro del 14/07): il **tipico del circuito** serve allo
staging delle gare future e vive nel CSV; il **realizzato della gara** serve al replay e vive
qui. La prova che le distingue: NOR L15 al Canada — reale P14; il motore predice P14 col
realizzato (24,24) e P11 col tipico (18,96/19,71).

## Stato dei valori (dopo il checkpoint FF5 del 14/07/2026)

| gara | valore | semantica |
|---|---:|---|
| **Miami** | **20,11** | **realizzato FF5, attivato al checkpoint** (era 22,63; ATT6: 6 migliorati sensibili, 0 peggiorati; golden PIA P14→P12) |
| Gran Bretagna | 20,80 | tipico attivato (PR #26); realizzato 20,43 ⇒ GIÀ CALIBRATA (Δ 0,37) |
| Canada | 24,37 | durata f1db; realizzato 24,24 ⇒ GIÀ CALIBRATA per coincidenza (Δ 0,13) |
| Austria | 21,63 | durata f1db; realizzato 21,98 ⇒ GIÀ CALIBRATA (Δ 0,35) |
| Australia | 18,15 | durata f1db; realizzato 24,10 **ma NON attivato**: gara SC-dominata (8/9 casi ATT6 sotto SC) e dispersa (IQR 10,17) — nessun valore unico la serve; il −5,95 resta documentato |
| Monaco | 24,80 | durata f1db; realizzato 22,61 **ma NON attivato**: la coda al rientro (proprietà permanente, FF3) rende il valore alto un cuscinetto empiricamente migliore (ATT6 3/3 peggiorati) |
| Spagna | 22,38 | durata f1db; realizzato 24,59 **ma NON attivato**: ai ranghi 4 peggiorati vs 1 migliorato (±1), nessuna evidenza a favore |
| Cina | 22,97 | durata f1db; gara 2026 NON MISURABILE (n=4, due stop rotti) |
| Giappone | 23,72 | durata f1db; gara 2026 NON MISURABILE (n=4; Δ stimato comunque 0,93) |

Le misure non attivate restano agli atti in `data/pitloss_realizzato_2026.csv`: non sono
sbagliate — sono giuste per una grandezza che il rango al rientro non premia in quelle gare.

## Il protocollo ricorrente per le gare future

1. **Allo staging** (`pipeline_gara.py`, invariato): la gara nuova riceve il **tipico** dal CSV.
2. **Dopo la gara**: si misura il realizzato (`gen_pitloss_pergara.py`, metodo FF4/FF5) e lo si
   porta al checkpoint col protocollo FF5 — riproducibilità, classi (n≥5; |Δ|>1,0), tabella
   golden PRIMA, ATT6 v2 con la regola del caso sensibile, checkpoint PO, attivazione col tag.
3. **Prima applicazione attesa: Spa**, dopo il GP del 19/07/2026.

Avvertenza di metodo, dichiarata in FF5 e non ancora risolta: ATT6 v2 conta anche i pit sotto
SC, dove il parametro verde non si applica (il modulo stesso sopprime i gap lì). Nelle gare
SC-dominate questo inquina il conteggio dei sensibili in entrambe le direzioni. Etichettare i
casi SC come non-informativi è un cambio di metodo: **da pre-registrare** prima di usarlo.

Rollback di FF5: `git checkout pre-attivazione-ff5-2026-07-14 -- demo/data/pitloss.json demo/golden_pit.json`
