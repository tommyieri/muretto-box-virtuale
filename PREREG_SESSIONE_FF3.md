# PREREG — Sessione FF3: "fastf1-censimento-pitloss"

**Committato PRIMA di scaricare un solo dato di gara nuovo.** Le uniche letture precedenti a
questo commit: file già in repo (CSV di produzione, report FF2) e **il calendario FastF1**
(lettura autorizzata dal mandato: serve per l'elenco qui sotto). Nessuna sessione di gara nuova
è stata scaricata: in cache esistono solo le 10 gare di Silverstone (Sessioni FF/FF2, sotto i
loro prereg). Nessun pit-loss di altri circuiti esiste ancora.

Branch: `fastf1-censimento-pitloss` (da `main` @ 34e827c, che include l'attivazione Silverstone).

Vincoli (dal mandato): NON si tocca kernel, modulo pit, gancio degrado, golden, né alcun file di
produzione. **Nessuna correzione**: questa sessione produce la **TABELLA DEI VERDETTI**; le
attivazioni vengono dopo, una per una, con checkpoint. Nessun merge.

**Metodo = FF2, invariato** (`PREREG_SESSIONE_FF2.md`). Uniche estensioni pre-registrate qui:
ciclo sui circuiti, verdetti GIÀ CALIBRATO / METODO NON APPLICABILE / DATO ROTTO, e la condizione
di rapporto ≥ 3× sul GO.

---

## L'elenco dei circuiti (dal calendario 2026, letto ORA — con una correzione al mandato)

**Il calendario 2026 ha 22 gare, non 24.** Lo si dichiara invece di forzare il numero: il
censimento copre **i 22 circuiti del calendario reale**, di cui **Silverstone escluso** (già
attivato a 20,80) → **21 circuiti da misurare**. Due fatti dichiarati subito:

1. **Madrid (round 14) è NUOVO nel 2026**: nessuna stagione passata, **assente dal CSV di
   produzione** (`pipeline_gara.py` userebbe il fallback 22,0). Verdetto atteso: NON ESEGUIBILE
   con data.
2. **Alla data di sessione (2026-07-14) il 2026 è disputato fino al round 9**: per i circuiti
   dal round 10 in poi la stagione 2026 non esiste ancora e non è un blocco.

| # | round 2026 | località | cid (f1db) | produzione (s) |
|---|---|---|---|---|
| 1 | 1 | Melbourne | `melbourne` | 18,15 |
| 2 | 2 | Shanghai | `shanghai` | 22,97 |
| 3 | 3 | Suzuka | `suzuka` | 23,72 |
| 4 | 4 | Miami Gardens | `miami` | 22,63 |
| 5 | 5 | Montréal | `montreal` | 24,37 |
| 6 | 6 | Monte Carlo | `monaco` | 24,80 |
| 7 | 7 | Barcelona | `catalunya` | 22,38 |
| 8 | 8 | Spielberg | `spielberg` | 21,63 |
| — | 9 | Silverstone | `silverstone` | 20,80 — **ESCLUSO (già attivato)** |
| 9 | 10 | Spa-Francorchamps | `spa-francorchamps` | 23,36 |
| 10 | 11 | Budapest | `hungaroring` | 21,80 |
| 11 | 12 | Zandvoort | `zandvoort` | 20,41 |
| 12 | 13 | Monza | `monza` | 24,66 |
| 13 | 14 | Madrid | **assente** | — (fallback 22,0, dichiarato) |
| 14 | 15 | Baku | `baku` | 20,72 |
| 15 | 16 | Marina Bay | `marina-bay` | 29,55 |
| 16 | 17 | Austin | `austin` | 24,25 |
| 17 | 18 | Mexico City | `mexico-city` | 22,69 |
| 18 | 19 | São Paulo | `interlagos` | 23,73 |
| 19 | 20 | Las Vegas | `las-vegas` | 21,58 |
| 20 | 21 | Lusail | `lusail` | 28,82 |
| 21 | 22 | Yas Marina | `yas-marina` | 22,01 |

(I cid `bahrain`, `jeddah`, `imola` esistono in produzione ma **non sono nel calendario 2026**:
fuori censimento, dichiarato.)

## FF3.1 — Ordine di priorità (inciso ORA)

Regola del mandato: prima i circuiti **con stima dall'arco C–I** (per guadagno atteso
`|produzione − stima|` decrescente), poi gli altri per **pit_lane_time nominale decrescente**
(pit lane lunga → guadagno probabile). Le uniche stime C–I disponibili in main sono le tre citate
dal mandato (i report C–I per-circuito non sono in repo): Miami ~19,5 / Monaco ~22,0 /
Austria ~21,6.

**Gruppo A (con stima C–I)**: 1. **miami** (|22,63−19,5| = 3,13) · 2. **monaco** (2,80) ·
3. **spielberg** (0,03).
**Gruppo B (per produzione decrescente)**: 4. marina-bay (29,55) · 5. lusail (28,82) ·
6. monza (24,66) · 7. montreal (24,37) · 8. austin (24,25) · 9. interlagos (23,73) ·
10. suzuka (23,72) · 11. spa-francorchamps (23,36) · 12. shanghai (22,97) ·
13. mexico-city (22,69) · 14. catalunya (22,38) · 15. yas-marina (22,01) ·
16. hungaroring (21,80) · 17. las-vegas (21,58) · 18. baku (20,72) · 19. zandvoort (20,41) ·
20. melbourne (18,15) · 21. madrid (—).

Lo scarico segue quest'ordine: se la sessione si interrompe, i più promettenti sono già fatti.

## FF3.0 — Budget dichiarato

Stagioni per circuito: 2018–2026 dove l'evento esiste (2026 solo round ≤ 9). Stima: **~150
sessioni gara nuove** (COVID toglie 2020–21 a Melbourne/Montréal/Marina Bay/Suzuka/ecc.; Miami
esiste dal 2022, Las Vegas dal 2023, Zandvoort dal 2021, Lusail 2021+2023–25; **Spielberg 2020 ha
DUE gare** — Austrian + Styrian GP — due blocchi distinti, come Silverstone 2020). Dalla cache
FF2 (~5,7 MB/gara): **~0,9 GB di cache**, NON committata (già gitignorata). Primo scarico stimato
**40–90 min** (rete permettendo); rieseguire dalla cache: minuti. Errori per singola
(stagione, circuito) gestiti senza far crollare il resto: **gara mancante = blocco in meno,
dichiarato**.

## FF3.2 — Metodo per circuito (= FF2, con le regole di composizione qui incise)

Per ogni circuito, invariato da FF2: (a) classificazione DRY/WET/MISTA **prima** di ogni
pit-loss (mescole ≥20% inter/wet + Rainfall ≥20%; discordanza → MISTA esclusa; meteo assente →
solo criterio A, dichiarato); (b) `pit_lane_time = PitOut(out-lap) − PitIn(in-lap)`, righe
diverse accoppiate per pilota; (c) stazionarietà: gara che devia > 2,0 s dalla mediana delle
altre → esclusa e dichiarata; (d) settori affetti ridedotti per gara, soglia 1,0 s; gara con
> 2 settori affetti → esclusa come non misurabile; (e) `pit_loss_dry` = mediana delle mediane di
gara, IC95 bootstrap a blocchi **contati come blocchi** (10.000, seed fisso), IsAccurate SOLO sui
riferimenti, esclusi SC/VSC/red/primo/ultimo/stint < 4 verdi, **riconciliazione scarti esatta
pena uscita con errore**; (f) vincoli fisici col veto; (g) `pit_loss_wet` archiviato dove esiste.

**Regole di composizione nuove (pre-registrate ora):**
- **Cambio layout**: se le gare escluse dalla stazionarietà formano un **prefisso temporale**
  (tutte le stagioni fino a un anno X), si annota "layout attuale da X+1"; contano solo le
  stagioni del layout attuale. Se le esclusioni sono > 3 e NON formano un prefisso → il campo
  non è stazionario senza spiegazione → **DATO ROTTO**.
- **METODO NON APPLICABILE**: se **più del 50%** delle gare dry altrimenti valide del circuito
  ha > 2 settori affetti. (Esclusioni sporadiche restano esclusioni per-gara, come in FF2.)

## FF3.3 — Verdetto per circuito (precedenza incisa ORA, non negoziabile)

`guadagno = produzione − pit_loss_dry` · `rapporto = |guadagno| / (larghezza_IC95 / 2)`

Ordine di valutazione (il primo che scatta vince):
1. **DATO ROTTO** — veto fisico sul paniere dry (`pit_loss < 0` o `> pit_lane_time` su ≥1 stop,
   `track_time ≤ 0`), o stazionarietà non spiegabile (sopra).
2. **METODO NON APPLICABILE** — regola > 50% sopra.
3. **NON ESEGUIBILE** — blocchi dry **< 5** (non si abbassa; per ciascuno si riporta **quanti
   blocchi mancano e da quale anno il layout attuale è stabile**: un debito con una data).
4. **GIÀ CALIBRATO** — |guadagno| ≤ **1,0 s** *e* larghezza ≤ 6,0 (con larghezza > 6,0 la misura
   è fallita e non può certificare nulla → NO).
5. **GO** — larghezza ≤ **3,0 s** *e* rapporto ≥ **3,0×**. Se il rapporto è 2,9× il verdetto è
   AMBIGUO: **non si arrotonda.**
6. **AMBIGUO** — larghezza ≤ 3,0 con rapporto < 3,0; oppure larghezza in (3,0 – 6,0].
7. **NO** — larghezza > 6,0.

Per Madrid e ogni circuito senza valore in produzione: guadagno calcolato contro il **fallback
22,0** di `pipeline_gara.py`, marcato "produzione assente".

## FF3.4 — Coerenza con l'arco C–I (sanità, non correzione)

- Miami ~19,5 / Monaco ~22,0 / Austria ~21,6 vs `pit_loss_dry` misurato: convergenza (≤ 2 s) →
  conferma incrociata annotata; divergenza > 2 s → **segnalata**: uno dei due metodi ha un
  problema su quel circuito, da capire PRIMA di qualsiasi attivazione lì.
- **Australia (verifica attesa, dichiarata)**: l'arco C–I trovò `pit_loss_verde (~20–23) >
  pit_lane_time (~18)` — incoerente. Se la stazionarietà taglia il pre-2022 (layout Melbourne
  rifatto) e il `pit_loss_dry` post-taglio rispetta `≤ pit_lane_time`, l'incoerenza è **risolta
  e si scrive** (chiude una domanda aperta). Se non la risolve → Australia resta **DATO ROTTO**.

## Criteri di fallimento e leve vietate

1. Gara non scaricabile → blocco in meno, dichiarato; il circuito prosegue con ciò che ha.
2. Circuito sotto 5 blocchi → NON ESEGUIBILE, **la soglia non si abbassa**.
3. Riconciliazione scarti non esatta → il generatore **esce con errore** (niente tabella).
4. Vietato (per nome): riclassificare DRY/WET dopo i pit-loss; spostare le soglie (20%, 2,0 s,
   1,0 s, 5 blocchi, 3,0 s, 3,0×, 1,0 s del GIÀ CALIBRATO); passare al bootstrap pooled;
   ripescare gare escluse; usare FP/qualifica; arrotondare il rapporto; cambiare l'ordine di
   priorità a valle dei primi risultati.
5. Nessuna correzione in questa sessione, **nemmeno per i GO**: ogni attivazione è una sessione
   dedicata con checkpoint e ATT6, come Silverstone.

## Output attesi

- `PREREG_SESSIONE_FF3.md` (questo file, committato per primo)
- `gen_censimento_pitloss.py` — generatore committato, riesegue tutto dalla cache
- `data/censimento_pitloss_2026.csv` — la tabella dei verdetti
- `data/censimento_stops.csv` — uno stop per riga
- `REPORT_CENSIMENTO_PITLOSS.md` con in cima il riepilogo GO/GIÀ CALIBRATI/AMBIGUI/NON
  ESEGUIBILI/NO/METODO N/A/DATI ROTTI e, per ogni GO: valore candidato, IC, guadagno, rapporto
- Golden verdi prima e dopo.

Nessun verdetto strategico: è del PO.
