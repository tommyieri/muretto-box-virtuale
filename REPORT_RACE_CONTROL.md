# REPORT — Race control, LIVELLO 1 (mostrare le penalità, non simularle)

**RC0 fonte scelta: FastF1 — copertura 9/9: SI**
**RC2 classifiche rettificate coincidenti con f1db: 5/9 → STOP** (arbitro corretto in corso
d'opera: la classifica ufficiale FIA via FastF1 results — il file `data/arrivi_2026.csv`
indicato nel prereg come "f1db" è ORFANO e dimostrabilmente pre-penalità, v. sotto)
**Caso Antonelli Silverstone: pista P9, +5s, rettificata P16, ufficiale P15 → NON COINCIDE**
(la penalità di ANT è catturata e applicata correttamente; la posizione residua dipende da
SAI, retrocesso dalla FIA per conteggio giri, non da una penalità — v. RC2)

Prereg: `PREREG_SESSIONE_RC.md` (committato prima dell'ingestione). Kernel, modulo pit,
golden, file consumati dal motore: NON toccati. Golden ✓ 11/11 prima e dopo.

---

## RC0 — Verifica delle fonti

| criterio | FastF1 `race_control_messages` | OpenF1 `/v1/race_control` |
|---|---|---|
| 9 gare demo 2026 | **9/9** (47–286 msg/gara) | 9/9 dove risponde, ma **HTTP 429** su burst |
| storico 2023-25 | ✓ (campioni 2023/24/25 tutti presenti) | ✓ dal 2023 (contenuti identici sul campione) |
| contenuto | = OpenF1 − 2÷4 msg `SessionStatus` | = FastF1 + `SessionStatus` |
| penalità parsabili | ✓ formato FIA fisso | ✓ stesso testo |
| buco Monaco 2026 | n/a | **race_control NON affetto** (gap max 12 min in gara; il buco ~50 min è della location) |
| operatività | cache locale progetto, riproducibile | rete, rate-limit, niente cache |

**Scelta: FastF1** (contenuto equivalente, infrastruttura già di progetto, cache congelata).
OpenF1 = conferma. Il probe è in scratchpad (non committato); i numeri sono nel prereg.

## RC1 — Ingestione (`gen_race_control.py` → `data/race_control_2026.csv`, 1664 messaggi)

| gara | msg | annunci penalità tempo | "PENALTY SERVED" | non parsabili |
|---|---|---|---|---|
| Australia | 167 | 0 | 0 | 2 (stop&go COL + served) |
| Cina | 86 | 1 (OCO 10s) | 1 | 0 |
| Giappone | 47 | 0 | 0 | 0 |
| Miami | 176 | 0 | 0 | 2 (drive-through BOT + served) |
| Canada | 286 | 5 | 4 | 2 (stop&go HAD + served) |
| Monaco | 265 | 8 | 2 | 6 (drive-through PER + served, +4) |
| Spagna | 178 | 0 | 0 | 0 |
| Austria | 211 | 1 (ALO 5s) | 1 | 0 |
| Gran Bretagna | 248 | 6 | 5 | 0 |

21 annunci di penalità di tempo, tutti parsati (pilota, secondi, motivo, giro). I 12 "non
parsabili" sono penalità NON di tempo (stop&go, drive-through): scontate in pista per
natura, dichiarate ed escluse dalla rettifica.

## RC2 — La classifica rettificata (la verifica che conta)

### Correzione dell'arbitro (deviazione dichiarata dal prereg)
`data/arrivi_2026.csv` non ha generatore nel repo (**fonte orfana**, il debito che la nota
di progetto ammonisce) e copre 7/9 gare (manca Austria e Gran Bretagna). Prova empirica che
è PRE-penalità: a Miami i tempi ufficiali FIA (FastF1 results) contengono aggiunte esatte
di +5,0 s (VER) e +20,0 s (LEC) assenti dall'orfano, che lì coincide con l'ordine di pista.
**Arbitro usato: FastF1 results** (classifica FIA, quantitativamente verificata: le
aggiunte ufficiali sono quanti esatti di penalità). Per trasparenza: R1 vs orfano = 6/7.

### Tabella (regola R1 pre-registrata; R2 = pit-dopo-annuncio, rivista post-hoc come diagnosi)

| gara | penalità applicate (R1) | coincide R1 | coincide R2 | note (attribuzione) |
|---|---|---|---|---|
| Australia | — | SI | SI | |
| Cina | — (OCO 10s scontata al pit) | SI | SI | |
| Giappone | — | SI | SI | |
| Miami | — | **NO** | NO | **VER+5s e LEC+20s ufficiali SENZA traccia race control** (documenti FIA post-gara) |
| Canada | BOR+5s | SI | SI | |
| Monaco | RUS+5, COL+5, GAS+5, STR+5, GAS+5, HUL+10 | **NO** | NO | **PER+10s ufficiale senza traccia RCM**; con R1 anche RUS/GAS/STR sono ri-aggiunte per errore (scontate al pit SENZA messaggio SERVED); con R2 l'unico errore resta PER |
| Spagna | — | **NO** | NO | riordino ufficiale tra doppiati (COL P8 pista → P10 FIA) senza traccia RCM; scambio LEC/ANT tra ritirati (convenzione d'ordinamento FIA) |
| Austria | ALO+5s | SI | SI | |
| Gran Bretagna | STR+5×3, ANT+5 | **NO** | NO | **SAI: 52 giri nei dati pista ma "Lapped" per la FIA** (conteggio giri demo↔FIA, non una penalità); con R2 le STR risultano scontate al pit del giro 46 e l'unico errore resta SAI |

**R1 (pre-registrata) vs ufficiale FIA: 5/9 → STOP** (soglie congelate: 9/9 GO, 7-8 GO
PARZIALE, <7 STOP). R2: 5/9, ma con composizione migliore (a Monaco e Silverstone l'unico
errore residuo è ESTERNO a race control).

### Caso PO — Antonelli, Silverstone
- **in pista: P9** (arrivo sotto SC, +3,1 s dal vincitore)
- **penalità: +5 s** (track limits, annunciata al giro 47; nessun pit dopo → post-gara;
  R1 e R2 concordi) — catturata e parsata da race control ✓
- **rettificata: P16 | ufficiale FIA: P15 → NON COINCIDE** di una posizione, e la causa
  NON è la penalità di ANT: è SAI, che i dati pista danno a pieni giri (P13) e la FIA
  classifica doppiato (P17). "Fuori dai punti" del PO: confermato (P15).

### Perché STOP (e cosa resta vero)
Race control è affidabile per gli ANNUNCI (21/21 parsati, tutti confermati dai quanti FIA
dove misurabili) ma NON basta a ricostruire la classifica ufficiale: (1) le penalità decise
nei documenti post-gara non vi transitano (Miami VER/LEC, Monaco PER); (2) il messaggio
"PENALTY SERVED" è incompleto (Monaco: 3 penalità scontate senza messaggio); (3) esistono
divergenze di conteggio giri demo↔FIA (SAI GB). Conseguenza per la UI: la vista "ufficiale"
deve venire da una FONTE di classifica (FastF1 results / f1db aggiornato), non dalla
rettifica automatica; race control alimenta feed e badge (annunci), non l'aritmetica finale.

## RC3 — Proposta UI (mockup, decisione del PO prima di toccare la demo pubblica)

Documento e prototipo statico: `MOCKUP_RACE_CONTROL_UI.md` + `mockup_race_control.html`
(HTML autonomo, NON collegato alla demo). In sintesi:
1. **Feed race control nella timeline**: i messaggi si agganciano alla barra eventi
   esistente (bande SC/VSC/rossa già in `demo/gara.html`); tacca gialla = bandiere,
   tacca §=penalità; click/hover = testo del messaggio al giro.
2. **Badge penalità in tabella**: "+5s" accanto al pilota DAL giro dell'annuncio (colonna
   `giro` del CSV); tooltip col motivo. Solo annunci: nessuna aritmetica.
3. **Classifica finale a doppia vista**: "in pista" (dati demo) | "ufficiale" (FIA results,
   fonte di classifica, non rettifica). Il caso Antonelli si legge in un colpo:
   P9 in pista → badge +5s → P15 ufficiale, fuori dai punti.

## RC4 — Cosa resta fuori (perimetro del LIVELLO 2, nessuna progettazione)

Il LIVELLO 2 (penalità DENTRO la simulazione) richiederebbe: (a) una semantica del
"quando" — una penalità scontata al pit interagisce col pit-loss (i +5 s si sommano alla
sosta ferma: il rientro cambia, e il modulo pit oggi congela i rivali al reale); (b) una
semantica del "se" — il controfattuale "se pitto al giro L" cambia se la penalità è già
stata scontata o pende ancora; (c) le penalità post-gara sono solo post-processing della
classifica finale e NON toccano la simulazione per-giro; (d) la fonte: come dimostrato in
RC2, race control NON è sufficiente (documenti FIA post-gara mancanti) — servirebbe una
fonte di decisioni stewards completa e con timestamp. Non fatto ora perché il kernel è
congelato, il modulo pit è chiuso a NO (nota di attivazione), e questa sessione è
pre-registrata come LIVELLO 1: mostrare, non simulare.

---
Golden: ✓ 11/11 prima e dopo (nessun file consumato dal motore toccato).
Riproducibilità: `python3 gen_race_control.py` (cache FastF1 di progetto) e
`python3 verifica_rc2.py` rigenerano ogni numero di questo report.
