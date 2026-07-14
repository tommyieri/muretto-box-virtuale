# NOTA SEMANTICA — `pit_loss_circuito_f1db.csv`

> ⚠️ **ATTENZIONE: questo file contiene il PIT-LANE TIME (durata dello stop), non il pit-loss —
> con UNA eccezione: la riga `silverstone`.**
> La semantica durata-non-loss è **confermata da TRE fonti indipendenti** (a Silverstone):
> f1db **29,12** (il valore storico di questo file) / Jolpica **29,6** (Sessione G, durate
> per-stop) / **FastF1 timing diretto 29,18** (Sessione FF, `PitOutTime − PitInTime` su 154 stop
> 2023–2026; scarto vs f1db **0,06 s**). **Non è più un'ipotesi: è chiuso.**
> **La riga `silverstone` è stata CORRETTA (29,12 → 20,80)** nell'attivazione del 2026-07-14
> (branch `attivazione-silverstone`): è ora il **pit-loss asciutto misurato** (FF2, GO, IC95
> [20,05–22,16], generatore `gen_pitloss_fastf1_esteso.py`) — l'**unica riga con semantica
> pit-loss**. Tutte le altre righe restano **durate f1db, non corrette**. Vedi
> **`NOTA_SILVERSTONE.md`** (attivazione + ATT6 + rollback), **`REPORT_PITLOSS_FF2.md`**
> (misura) e **`PITLOSS_NOTA_DI_CHIUSURA.md`** (arco C→I).

## Perché la nota è in un `.md` affiancato e non in testa al CSV
Il CSV è letto via `csv.DictReader` (prima riga = intestazione) da `pipeline_gara.py` e
`gen_banda_degrado_validazione.py`. Una riga di commento in testa al file diventerebbe
l'intestazione e romperebbe entrambi i consumatori. La nota vive quindi accanto al file, con lo
stesso nome-base, così chi apre il CSV la trova.

## Stato di verità (arco C→I chiuso a NO; semantica chiusa in FF/FF2)
- Il campo `pit_loss_s` è la **durata dello stop** (pit-lane time), non il pit-loss di gara.
  Causa fisica certa (Sessione G), **confermata da terza fonte indipendente** (FastF1, Sessione
  FF: 29,18 misurato dai timestamp vs 29,12 del file). Questa domanda **non è più aperta**.
- La ri-taratura a due componenti `pit_loss = pit_lane_time − track_time` era **giusta in
  principio ma NON calibrabile** coi metodi dell'arco C→I (Sessioni H e I: NO NETTO). La misura
  che ha sbloccato Silverstone è arrivata per **un'altra via** (FF/FF2: settori + timestamp
  FastF1) — e ha confermato a posteriori il quadro a due componenti (`track_time` ≈ 7,95 s).
- **Silverstone è l'unica riga sostituita** (29,12 → 20,80, attivazione 2026-07-14, ATT6 2/3
  migliorati, golden invariati — vedi `NOTA_SILVERSTONE.md`). **Per tutti gli altri circuiti
  nessuna sostituzione è giustificata**: il metodo FF2 esiste, ma ogni circuito richiede la sua
  misura pre-registrata e il suo GO. Nessuna generalizzazione automatica.
- Anche il ratio SC `0,42` in `sc_safety_car.csv` è dato **orfano/non consumato** (vedi
  `data/archivio/README.md`): il modulo pit non lo usa. Resta documentato, non corretto.

Ogni correzione futura di un ALTRO circuito segue lo stesso protocollo di Silverstone: misura
pre-registrata (FF2 come modello), GO sulle soglie, sessione di attivazione dedicata con
checkpoint PO, ATT6 contro la realtà, golden verificati.
