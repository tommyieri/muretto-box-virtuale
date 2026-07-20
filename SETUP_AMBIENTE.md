# SETUP AMBIENTE — dove vivono le cose (per non doverlo ricordare dalle chat)

Fattuale, aggiornato al 15/07/2026 (consolidamento pre-Spa, Blocco A).

## Checkout e regola dei branch
- Checkout principale: `~/muretto`. **Sta su `main`, sempre.**
- Il lavoro si fa su branch; il merge è il checkpoint. Nessun lavoro diretto su `main`.

## Ambiente Python (sono DUE, verificato il 15/07/2026)
- venv: `~/muretto/.venv` (pandas 3.0.3) — per kernel, test_b.py e generatori di analisi
  (es. `.venv/bin/python gen_neutralizzazione_v2.py`).
- `python3` utente (pandas 2.3.3, **fastf1 3.8.3**) — per i generatori FastF1 (FF2/FF3/FF4 e
  per-gara): **fastf1 NON è nel venv**, quei generatori si lanciano con `python3`.

## Cache FastF1
- Sede: `~/muretto_shared/ff1_cache/` — **fuori dal repo e da ogni worktree** (sopravvive a qualunque pulizia git).
- Gitignorata, ~928 MB (1.177 file). Ricrearla da zero costa **40–90 min di download** (stima FF3.0).
- I generatori la abilitano in `gen_pitloss_fastf1_esteso.py` (FF2) e `gen_censimento_pitloss.py` (FF3);
  FF4 (`gen_pitloss_engine_ready.py`) e il per-gara FF5 la ereditano via import.

## Test di sorveglianza (ordine e directory)
1. `python3 test_b.py` — dalla root (golden Python 449/449; richiede venv/pandas e ti_cache).
2. `node test_b.mjs` — dalla root (golden JS 449/449, sotto 1e-9).
3. `node test_pit.mjs` — **da dentro `demo/`** (golden pit 11/11).
4. `node test_degrado_hook.mjs` — dalla root (gancio v1.5: banda-zero bit-identica).
   NB: dalla Fase A il gancio vive in `demo/degrado_hook.mjs` (servibile dal browser); i
   test root lo importano da `./demo/degrado_hook.mjs`. Logica invariata (golden lo prova).
5. `node check_banda_gancio.mjs` — dalla root (banda scelta = input valido per il gancio).
6. `node test_f1db_checksum.mjs` — dalla root (il CSV f1db, orfano ma consumato dallo staging,
   è invariato; se cambia deliberatamente: aggiornare il checksum nel test e motivare nel commit).

## Avvertenza
- `test_b.py` **riscrive `data/ref_traffic_py.json` a ogni run** (è il riferimento del golden JS):
  un worktree sporco dopo test_b.py è atteso, non un errore. Diffare prima di committare.
