# NOTA_SILVERSTONE — attivazione pit-loss Silverstone: 29,12 → 20,80

Sessione di attivazione a **ambito strettissimo**: cambia **UN SOLO valore** — il pit-loss di
Silverstone/Gran Bretagna. Nessun altro circuito. Nessuna riga di codice. Nessun nuovo file
consumato dal motore. Branch `attivazione-silverstone`; tag di rollback
**`pre-attivazione-silverstone-2026-07-14`** inciso prima di ogni modifica. **Non mergiato: il
merge è del PO dopo aver letto la tabella ATT6 qui sotto.**

## Il valore, e da dove viene

**20,80 s** è il **pit-loss ASCIUTTO** di Silverstone: mediana delle mediane di 7 blocchi-gara
2018–2026 (102 stop), **IC95 [20,05 – 22,16]**, misurato per settori da FastF1 con generatore
committato **`gen_pitloss_fastf1_esteso.py`** (Sessione FF2, prereg `a144918`, verdetto **GO**
con larghezza IC 2,11 s ≤ 3,0). Vedi `REPORT_PITLOSS_FF2.md`.

**Limite dichiarato — il motore usa un valore unico:** su gara **bagnata** il 20,80 **sottostima
di ~1 s** (wet misurato **21,83**, ma su **1 solo blocco** — 2024 — archiviato in
`data/pitloss_silverstone_dry_wet.csv`, senza soglie, non in produzione). L'**errore precedente**
era di **+8,32 s in ogni condizione**: il 29,12 non era un pit-loss ma il **pit-lane time**
(durata dello stop), confermato da tre fonti indipendenti (f1db 29,12 / Jolpica 29,6 / FastF1
29,18 — vedi `data/pit_loss_circuito_f1db.NOTA.md`).

## Le due fonti cambiate (coerentemente — sono collegate)

| file | prima | dopo | chi lo legge |
|---|---|---|---|
| `demo/data/pitloss.json` → `"Gran Bretagna"` | 29.12 | **20.80** | motore demo (test_pit, degrado hook, banda gancio, golden gen) |
| `data/pit_loss_circuito_f1db.csv` → riga `silverstone` | `29.12,103` | **`20.80,102`** | `pipeline_gara.py` (staging gare nuove), `gen_banda_degrado_validazione.py` |

`pipeline_gara.py` travasa dal CSV al json quando pubblica una gara: cambiare solo il json
sarebbe stato riassorbito dal 29,12 alla prossima ripubblicazione. La colonna `n` (103 → 102) è
il numero di stop del campione che sostiene il valore (102 stop dry FF2 al posto dei 103 stop
f1db); **non è consumata da nessun codice** (si leggono solo `cid` e `pit_loss_s`), aggiornata
per coerenza documentale. **Ogni altra riga del CSV resta pit-lane time f1db, non corretto**: la
riga silverstone è ora l'unica con semantica pit-loss misurato — segnalato anche nella NOTA
semantica a fianco del CSV.

## ATT6 — il motore contro la realtà (eseguito PRIMA del commit)

Tre pit **reali** della gara demo Gran Bretagna (2026). Selezione **dichiarata a priori** (niente
cherry-picking): i primi 3 stop verdi validi del campione FF2 2026, ordinati per (giro, pilota),
un solo stop per pilota; freeze = giro pit − 2. Script: `att6_silverstone.mjs` (committato,
riproducibile; legge, non scrive). "REALE" = posizione a fine **out-lap** (giro pit+1, rango per
`cum_time` reale): è il pari-semantica del `rientro_pos` del motore, che applica l'intera perdita
al giro del pit.

| caso | PRIMA (29,12) | ADESSO (20,80) | REALE | esito |
|---|---|---|---|---|
| HUL, pit giro 17 (freeze 15) | P19/21 | **P18/21** | **P18**/22 | **MIGLIORATO** (err 1 → 0) |
| VER, pit giro 17 (freeze 15) | P10/21 | **P7/21** | **P7**/22 | **MIGLIORATO** (err 3 → 0) |
| STR, pit giro 18 (freeze 16) | P21/21 | P21/21 | P21/22 | INVARIATO (err 0 → 0) |

**Migliorati 2/3, peggiorati 0/3 ⇒ ATT6 PASSA** (soglia del mandato: ≥ 2/3 più vicini alla
realtà, pena rollback). I due casi migliorati vanno **entrambi a errore zero**; il terzo era già
esatto (ultimo del suo gruppo: insensibile a 8 s in più o in meno) ed è rimasto esatto.
Nota sul denominatore (21 vs 22): l'insieme del motore esclude le auto non simulabili al freeze
(chi ha appena pittato non ha pace-base); il conteggio reale a fine out-lap le include. Le
posizioni confrontate sono ranghi nello stesso ordine di pista: il confronto regge.

## Golden — calcolato PRIMA, verificato DOPO

Calcolo a monte dei casi che avrebbero cambiato valore atteso: **gli 11 casi golden non
includono Gran Bretagna** (Monaco×3, Austria×2, Australia, Cina, Giappone, Miami, Canada,
Spagna). La tabella caso/vecchio/nuovo/delta è quindi **vuota per costruzione**: nessun golden da
rigenerare, e **qualunque** variazione nei golden sarebbe stata un bug (⇒ rollback).

Verificato dopo il cambio:

| test | esito |
|---|---|
| `demo/test_pit.mjs` (golden pit, altri circuiti) | **11/11 identici, NESSUNA rigenerazione** |
| `test_b.mjs` (kernel) | **449/449 invariato** (sotto 1e-9) |
| `test_degrado_hook.mjs` | PASS |
| `check_banda_gancio.mjs` | PASS |

## Rollback documentato

```
git checkout pre-attivazione-silverstone-2026-07-14 -- demo/data/pitloss.json data/pit_loss_circuito_f1db.csv
```
oppure, per l'intero stato: `git reset --hard pre-attivazione-silverstone-2026-07-14` (sul
branch). Le condizioni che l'avrebbero imposto — ATT6 < 2/3, un golden non-GB cambiato, test_b
diverso da 449/449 — **non si sono verificate**.

## Cosa questo cambio NON fa

- Non tocca il ratio SC 0,42 (orfano, non consumato — vedi `data/archivio/README.md`).
- Non corregge gli altri 20 circuiti del CSV: restano pit-lane time f1db, con lo stesso errore
  strutturale che a Silverstone valeva +8,32 s. Il metodo per correggerli esiste (FF2), ma ogni
  circuito richiede la sua misura e il suo GO: **nessuna generalizzazione automatica**.
- Non introduce il pit-loss bagnato nel motore: valore unico, limite dichiarato sopra.
