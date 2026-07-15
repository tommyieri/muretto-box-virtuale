# data/archivio — file orfani ritirati dall'attivazione

File spostati qui dall'**attivazione** (branch `attivazione-pitloss-neutralizzazione`, 2026-07-14).
Motivo dello spostamento: **orfani** — nessun generatore committato e **nessun consumatore** nel
codice. Confermato da grep su `*.py *.mjs *.js *.ts *.html` (zero occorrenze) e dall'inventario
fonti della Sessione N (`REPORT_NEUTRALIZZAZIONE.md`, N0). Non cancellati: conservati come storia.

Lo spostamento è **inerte**: i golden del modulo pit restano 11/11 (nessuno li leggeva). Per
ripristinarli: `git mv data/archivio/<file> data/<file>` (o rollback al tag `pre-attivazione-2026-07-14`).

## `sc_safety_car.csv`
- **Cos'è**: prior aggregato per circuito — `gara, gare, p_SC, p_VSC, periodi_medi, pit_ratio_sc`.
- **Da dove veniva**: aggregato storico di probabilità SC/VSC per tracciato; generatore non presente
  nel repo.
- **Il ratio `pit_ratio_sc`**: colonna **costante `0.42`** su tutte le 24 righe (identica per ogni
  circuito — non una stima per-tracciato). Era il presunto "ratio SC 0,42" del pit-loss.
- **Perché non usato**: **nessun codice lo legge.** Il modulo pit (`demo/pitscenario.mjs`) **non
  moltiplica per 0,42**: sotto SC/VSC usa lo stesso pit-loss verde e **sopprime i gap** a `null`. Il
  ratio 0,42 è dato morto. Vedi `data/pit_loss_circuito_f1db.NOTA.md` e `PITLOSS_NOTA_DI_CHIUSURA.md`.

## `neutralization_model_2026.csv`
- **Cos'è**: vecchio modello di finestre di neutralizzazione per 7 gare 2026
  (`gara, giri, n_sc, n_vsc, ...`, finestre SC/VSC).
- **Da dove veniva**: modello finestre precedente, citato in `data/NEUTRALIZZAZIONE_NOTA.txt` come
  **storia superata**. Definizione e generatore ignoti/assenti.
- **Perché non usato**: superato da `demo/neutralizzazione.json` (generatore `gen_neutralizzazione.py`,
  soglia ≥2 auto). Nessun consumatore nel codice. La classificazione corrente e la sua evoluzione a
  due livelli vivono in `data/neutralizzazione_due_livelli.csv` (`gen_neutralizzazione_v2.py`).

## `telemetria_proto.html` + `telemetria_proto_data.json` (ATT7, 2026-07-15, branch `ui-v2-pista`)
- **Cos'erano**: il prototipo isolato Fase-3 della vista pallini (replay OpenF1 /location,
  Silverstone 2026, ~2 Hz, 2,1 MB) e la sua pagina. Il JSON era **orfano** — committato senza
  generatore (debito dichiarato dall'audit) — e la pagina era il suo unico consumatore.
- **Perché archiviati**: superati da `gen_pista_svg.py` (generatore committato, FastF1) +
  `demo/data/pista_<gara>.json` per TUTTE le 9 gare; la pagina-gara (`demo/gara.html` +
  `demo/pista.mjs`) ora usa solo i file generati. Grep su `demo/`: zero riferimenti residui.
- **Prova di equivalenza**: il generatore, con criterio indipendente (giro valido più veloce con
  telemetria pulita) e fonte diversa (FastF1 vs OpenF1), converge sullo **stesso giro** del
  prototipo (ANT, giro 37, 91.777 s). Vedi `NOTA_PISTE.md`.
- Spostamento **inerte** per la demo pubblica (il prototipo non ne faceva parte). Storia
  preservata via `git mv`; per riesumare: `git mv data/archivio/telemetria_proto* demo/`.
