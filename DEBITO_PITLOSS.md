# DEBITO_PITLOSS — il pit-loss di produzione è un orfano, e la migrazione l'ha peggiorato

**Stato: DEBITO documentato, NON risolto** (la sostituzione è decisione del PO, con checkpoint).

## Le due fonti
| file | esempio Silverstone | provenienza | generatore committato? |
|---|---|---|---|
| `pit_loss_circuito.csv` (precedente, dalla Fase 0) | **25,4 s** | ignota (presente dal commit `ad0bf7d`) | **NO** |
| `pit_loss_circuito_f1db.csv` (attuale, usato dal modulo pit) | **29,12 s** | tabella ESTERNA f1db (colonna `n`=stop del loro campione) | **NO** |

Misura diretta (Sessione C, metodo fisico) e calibrazione per residuo (Sessione D, metodo
indipendente) concordano: il pit-loss reale a Silverstone è **~20 s**.

## I tre fatti
1. **Orfano in produzione.** Nessuno dei due file ha uno script committato che rigenera il campo
   `pit_loss_s`. `f1db` è ingerito da fuori; `pit_loss_circuito.csv` è lì dalla Fase 0 senza
   generatore. È l'input del modulo pit che gira davanti agli utenti: viola la regola 2 (nessun
   file senza generatore) proprio nel punto peggiore.
2. **La migrazione ha peggiorato l'input.** Il file precedente dava Silverstone 25,4 (Δ vs reale
   ~+4,5); l'attuale f1db dà 29,12 (Δ ~+8,2). Migrare a una fonte "più autorevole" (f1db) ha
   allontanato il valore dalla realtà. Regola 3 del progetto avverata: una fonte esterna comoda
   non è più vera di una misura.
3. **Semantica non verificabile.** Senza la fonte f1db non è determinabile se `pit_loss_s` sia la
   durata dello stop (tempo in pit-lane) o il pit-loss totale (perdita di posizione). I valori
   (18-30 s) sono nel range del pit-loss totale, ma la sovrastima sistematica sui circuiti
   ben campionati (GB, Miami, Monaco tutti troppo alti) è compatibile con una grandezza diversa
   o con una calibrazione di pista/stagione sbagliata.

## Cosa NON è stato fatto (e perché)
Non si è sostituito né corretto alcun file. La sostituzione di `pit_loss_circuito_f1db.csv`
tocca un input del **modulo pit congelato** e i suoi **11/11 golden** (`demo/golden_pit.json`),
che certificano il CODICE non il DATO: cambiando i valori attesi vanno **rigenerati con nota di
metodo**. È un checkpoint umano dedicato, reversibile — non una modifica di fine sessione.

## Raccomandazione (per il PO)
- Il campo pit-loss ha bisogno di un **generatore committato** che lo misuri dai dati per-giro
  (Sessione C/D forniscono due metodi; il calibrato-per-residuo è il più adatto perché definisce
  il parametro come "ciò che azzera l'errore del motore").
- Candidato di sostituzione a GO PARZIALE: **solo GB (29,12→19,7), Miami (22,6→19,7), Monaco
  (24,8→22,0)** — lato robusto, due metodi convergenti, valori plausibili. Gli altri restano al
  nominale finché una misura affidabile (piu' stop, o degrado risolto) non li tocca.
- Cina calibrato 34,3 s è fisicamente implausibile (n_test basso): NON proporre.
