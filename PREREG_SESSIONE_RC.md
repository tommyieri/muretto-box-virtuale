# PREREG — Sessione RC (race control, LIVELLO 1: mostrare, non simulare)

Committato PRIMA dell'ingestione (RC1). Perimetro: kernel, modulo pit, golden e ogni file
consumato dal motore NON si toccano. Output dati in `data/` (radice analisi), NON in
`demo/data/` (consumata dalla demo). Le penalità NON entrano nella simulazione.

## RC0 — fonte scelta: FastF1 (verifica eseguita prima di questo prereg, solo probe)

| criterio | FastF1 (`race_control_messages`) | OpenF1 (`/v1/race_control`) |
|---|---|---|
| copertura 9 gare demo 2026 | **9/9** (167/86/47/176/286/265/178/211/248 msg) | 9/9 dove risponde; **HTTP 429** su burst non autenticati (4 gare al primo giro di probe) |
| storico 2023-25 | ✓ (campione: Bahrain 23, Silverstone 24, Monaco 25) | ✓ 2023+ (campione: Bahrain 23 75 msg = FastF1+2; Monaco 25 198 = +2; il "non trovata" su Silverstone 24 è un artefatto del match per nome del probe, non un buco) |
| contenuto | identico a OpenF1 sul confrontato (delta = 2-4 msg `SessionStatus` in più su OpenF1) | idem |
| penalità parsabili | ✓ formato fisso FIA STEWARDS (v. sotto) | ✓ stesso testo |
| buco Monaco 2026 (~50 min, nota di progetto su location) | n/a (fonte diversa) | **race_control NON affetto**: gap max tra messaggi 12 min; il gap 120 min di Spagna è fuori finestra di gara (conteggi in gara allineati a FastF1, 179 vs 178) |
| operatività | **cache locale di progetto** (`~/muretto_shared/ff1_cache`), riproducibile, nessun rate limit | rete + 429, nessuna cache |

**Motivazione**: contenuto equivalente, ma FastF1 è già l'infrastruttura del progetto (protocollo
FF), ha cache locale congelabile e nessun rate limit. OpenF1 resta fonte di conferma.

## Formato messaggi penalità (osservato in RC0, regole congelate QUI)

- Annuncio: `FIA STEWARDS: <N> SECOND TIME PENALTY FOR CAR <num> (<SIGLA>) - <motivo>`
- Sconto in pista: identico con prefisso `PENALTY SERVED - `
- Penalità multiple stesso pilota = testi distinti (es. STR Silverstone: `TRACK LIMITS`,
  `... (5TH OFFENCE)`, `... (6TH OFFENCE)`) → il dedup è per testo-chiave, non per pilota.

### Regole pre-registrate (RC1 parsing)
1. Regex penalità tempo: `(\d+)\s*SECOND(?:S)?\s*TIME\s*PENALTY.*?CAR\s*(\d+)\s*\((\w+)\)`.
2. Entità penalità = annuncio; il messaggio `PENALTY SERVED` con lo stesso testo-chiave
   (testo senza prefisso `PENALTY SERVED - `) si AGGANCIA all'annuncio, non crea un'entità.
3. "Non parsabile" = messaggio contenente `PENALTY` che non matcha la regex (es. penalità
   di griglia, drive-through, deleted lap): conteggiato e riportato con esempi, NON ingerito
   come penalità di tempo.

### Regola pre-registrata (RC2): penalità già scontata in pista o no
Una penalità di tempo è **già nei tempi in pista** ⇔ esiste il messaggio `PENALTY SERVED`
agganciato **con `Lap` < ultimo giro del pilota** (sconto avvenuto a un pit durante la gara).
`PENALTY SERVED` assente, oppure loggato al giro finale/dopo la bandiera (es. STR Silverstone,
3× a 15:32, gara finita) = **aggiunta post-gara** → va sommata al tempo in pista nella
classifica rettificata. Limite dichiarato: una penalità genuinamente scontata a un pit
nell'ultimissimo giro del pilota verrebbe classificata male; nessun caso simile nel probe.

## RC2 — verifica e verdetto (congelati)
- Classifica in pista: da `demo/data/<gara>.json` (giri completati desc, poi cum_time finale asc).
- Rettificata: + penalità NON scontate (regola sopra), ri-ordinamento a pari giri.
- Ufficiale: `data/arrivi_2026.csv` (`pos_finale` f1db), già nel repo.
- **Verdetto pre-registrato: 9/9 coincidenti → GO | 7-8/9 → GO PARZIALE | <7/9 → STOP.**
- Caso PO (riportato esplicitamente): ANT Silverstone — pista, penalità, rettificata, ufficiale.

## Output previsti
`gen_race_control.py` (generatore committato) → `data/race_control_2026.csv`
(gara, giro, timestamp, categoria, pilota, bandiera, testo, penalita_secondi);
`verifica_rc2.py` (committato) → tabella 9 gare nel report; `REPORT_RACE_CONTROL.md`;
mockup UI (RC3) come documento + eventuale HTML statico NON collegato alla demo.
Golden verdi prima (✓ già verificato su main) e dopo. Nessun merge.
