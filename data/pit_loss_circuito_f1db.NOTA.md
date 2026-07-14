# NOTA SEMANTICA — `pit_loss_circuito_f1db.csv`

> ⚠️ **ATTENZIONE: questo file contiene il PIT-LANE TIME (durata dello stop), non il pit-loss.**
> **Confermato da TRE fonti indipendenti** (a Silverstone): f1db **29,12** (questo file) /
> Jolpica **29,6** (Sessione G, durate per-stop) / **FastF1 timing diretto 29,18**
> (Sessione FF, `PitOutTime − PitInTime` su 154 stop 2023–2026; scarto vs f1db **0,06 s**).
> **Non è più un'ipotesi: è chiuso.** A **Silverstone** il pit-loss reale è **~20,8 s** contro i
> **29,12** qui riportati. Il valore **NON è stato corretto**. Vedi
> **`PITLOSS_NOTA_DI_CHIUSURA.md`** (arco C→I) e **`REPORT_PITLOSS_FF2.md`** (Sessioni FF/FF2,
> misura per settori via FastF1).

## Perché la nota è in un `.md` affiancato e non in testa al CSV
Il CSV è letto via `csv.DictReader` (prima riga = intestazione) da `pipeline_gara.py` e
`gen_banda_degrado_validazione.py`. Una riga di commento in testa al file diventerebbe
l'intestazione e romperebbe entrambi i consumatori. La nota vive quindi accanto al file, con lo
stesso nome-base, così chi apre il CSV la trova.

## Stato di verità (arco C→I chiuso a NO; semantica chiusa in FF/FF2)
- Il campo `pit_loss_s` è la **durata dello stop** (pit-lane time), non il pit-loss di gara.
  Causa fisica certa (Sessione G), **confermata da terza fonte indipendente** (FastF1, Sessione
  FF: 29,18 misurato dai timestamp vs 29,12 del file). Questa domanda **non è più aperta**.
- La ri-taratura a due componenti `pit_loss = pit_lane_time − track_time` è **giusta in principio
  ma NON calibrabile** con i dati disponibili (Sessioni H e I: NO NETTO).
- **Nessuna sostituzione di valore è giustificata da evidenza indipendente valida.** Il file resta
  invariato; documentare un errore noto non richiede di saperlo correggere.
- Anche il ratio SC `0,42` in `sc_safety_car.csv` è dato **orfano/non consumato** (vedi
  `data/archivio/README.md`): il modulo pit non lo usa. I due errori storici (durata↔loss e il
  ratio) restano documentati, non corretti.

Ogni correzione futura del valore tocca il modulo pit congelato e i suoi golden 11/11 → richiede una
sessione dedicata con checkpoint PO e rigenerazione golden.
