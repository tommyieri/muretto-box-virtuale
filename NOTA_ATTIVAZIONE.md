# NOTA_ATTIVAZIONE — attivazione pit-loss / neutralizzazione (2026-07-14)

Branch `attivazione-pitloss-neutralizzazione` (da `main` @ `89d46e4`). **NON MERGIATA.**
Tag di rollback: **`pre-attivazione-2026-07-14`** (sul commit di partenza `89d46e4`).

Questa attivazione **non è ricerca**: applica risultati già dimostrati (Sessioni N e C-I). Nel
farlo, due verifiche bloccanti hanno cambiato lo scope. Sotto: cosa è cambiato, cosa **non** è stato
fatto e perché, come tornare indietro.

## Le due verifiche bloccanti (perché lo scope è più stretto del piano ATT0-ATT8)

**ATT0 — il ratio SC 0,42 non è consumato da nessuno.** Il ratio vive in `data/sc_safety_car.csv`
(colonna `pit_ratio_sc`, costante `0.42` su tutte le righe), **non** hardcoded nel codice. Grep su
tutto il codice: **zero consumatori**. Il modulo pit (`demo/pitscenario.mjs`) **non moltiplica per
0,42**: sotto SC/VSC usa lo stesso pit-loss verde e **sopprime i gap** a `null`. Quindi la premessa
di **ATT4** ("sostituire la moltiplicazione per 0,42") descriveva codice inesistente → **ATT4
saltato per decisione PO**: il modulo pit non si tocca.

**ATT3 — la correzione poggiava su un verdetto ritrattato.** ATT3 voleva correggere GB/Miami/Monaco
con la mediana dei metodi C/D/E/I. Ma la chiusura del debito C-I
(`PITLOSS_NOTA_DI_CHIUSURA.md`, Sessione I) ha esito **NO NETTO / nessun fix validato**, e ha
**ritrattato** il "GO PARZIALE su GB/Miami/Monaco" della Sessione D come **illusorio** (C e D sono
algebricamente lo stesso metodo; E = "giudice non valido"; IC95 GB ≈ 6,8 s). Applicare la mediana
avrebbe *ricalcolato un verdetto* e *riaperto un filone* — vietati dal mandato → **ATT3/ATT5/ATT6
sospesi per decisione PO**: nessun valore di pit-loss corretto.

## Cosa è cambiato (tutto additivo; produzione di calcolo intatta)

### ATT2 — neutralizzazione v2 + vocabolario status (Sessione N, dimostrata)
Generatore committato: **`gen_neutralizzazione_v2.py`** (da branch `neutralizzazione-verita`).
Legge SOLO i raw TracingInsights e scrive **tre CSV di analisi**:
- `data/status_vocabolario.csv` — **39 codici** status decodificati (deliverable principale).
- `data/neutralizzazione_due_livelli.csv` — evento per-gara (A) + impatto per-auto (B).
- `data/rlap_per_regime.csv` — R_lap per regime per circuito.

Documentazione permanente: **`data/STATUS_VOCABOLARIO_NOTA.md`**. Provenienza:
`REPORT_NEUTRALIZZAZIONE.md`, `PREREG_SESSIONE_N.md`.

**Il generatore NON scrive `demo/neutralizzazione.json`** (lo legge solo per confronto): il modulo
pit è del tutto intatto. Verificato: hash di `demo/neutralizzazione.json` **identico** prima/dopo;
golden pit **11/11** invariati (0/11 flip, come calcolato in Sessione N).

**Fix di determinismo** (richiesto da ATT8): il generatore ordinava il vocabolario per sola
frequenza → ordine delle righe a pari frequenza **non deterministico** (dipendeva da
`PYTHONHASHSEED`). Aggiunto tie-break sul codice: output ora **stabile su qualunque hash-seed**. Non
cambia i codici né i dati, solo l'ordine delle righe. È l'unica riga di codice modificata rispetto
alla versione di Sessione N.

### Nota semantica sul file pit-loss (senza correggere valori)
`data/pit_loss_circuito_f1db.NOTA.md` — documenta che il campo `pit_loss_s` è il **PIT-LANE TIME**
(durata dello stop), **non** il pit-loss (dimostrato Sessione G, Jolpica, 8/9 entro 1 s; Silverstone
reale ~20 s vs 29,12). Il valore **NON è corretto** (manca misura precisa). In `.md` affiancato e
non in testa al CSV perché una riga di commento romperebbe il `csv.DictReader` di `pipeline_gara.py`
e `gen_banda_degrado_validazione.py`.

### ATT7 — archivio orfani
`data/sc_safety_car.csv` e `data/neutralization_model_2026.csv` → **`data/archivio/`** (con
`git mv`, storia preservata) + `data/archivio/README.md`. Motivo: orfani (nessun generatore, nessun
consumatore — ri-verificato con grep, zero occorrenze). Spostamento inerte: golden 11/11 invariati.

## Golden — prima e dopo (kernel intatto)
| golden | baseline (ATT1) | dopo attivazione |
|---|---|---|
| `test_b.py` | 449/449 GOLDEN OK | 449/449 GOLDEN OK |
| `test_b.mjs` | 449/449 PASS | 449/449 PASS |
| `demo/test_pit.mjs` (da `demo/`) | 11/11 | 11/11 |
| `test_degrado_hook.mjs` | PASS | PASS |

Nessun golden cambia: coerente col fatto che **nessun input del modulo pit è stato toccato**. Non è
stata fatta alcuna rigenerazione di golden (ATT5 sospeso).

## Cosa NON è stato fatto (e resta per una sessione futura, con GO del PO)
- **ATT4**: nessuna lettura di `pit_loss_sc` dal modulo pit (nessun 0,42 da sostituire).
- **ATT3/ATT5/ATT6**: nessuna correzione di `pit_loss_verde`, nessun `pit_loss_circuito_v2.csv`,
  nessuna rigenerazione golden, nessun test Silverstone prima/adesso/realtà. Il debito pit-loss
  resta **chiuso a NO** come da C-I. Una futura correzione richiede una misura del pit-loss
  sufficientemente precisa (oggi assente) + checkpoint PO + rigenerazione golden.

I report di dettaglio dell'arco C→I (Sessioni C-I) restano sui branch
`claude/pitloss-due-componenti-283f8d` e `calibrazione-pitloss`; qui è portata solo la nota di
chiusura `PITLOSS_NOTA_DI_CHIUSURA.md`.

## Come tornare indietro
- **Tutto**: `git reset --hard pre-attivazione-2026-07-14` (o non mergiare il branch).
- **Solo gli orfani**: `git mv data/archivio/<file> data/<file>`.
- **Rigenerare i CSV di analisi**: `.venv/bin/python gen_neutralizzazione_v2.py` (deterministico).

Nessun verdetto strategico in questa nota: è del PO.
