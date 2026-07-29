# REPORT — Validazione retroattiva del protocollo ATT6 v2 (branch att6-v2-taratura)

Data: 16/07/2026. Prereg: `PREREG_ATT6_V2.md` (committato PRIMA dei numeri, d8e7f90).
Strumento: `att6_v2.mjs`. Nessun file di produzione toccato. Golden verdi prima e dopo
(test_pit 11/11, test_b 449/449).

```
T1 Silverstone: TIPICA  -> RESPINTO         — attesa rispettata: NO
T2 Montreal:    ATIPICA -> NON GIUDICABILE  — attesa rispettata: SI
T3 Spa: tipico 18.58, gara del 19 giudicabile se mediana in [16.58, 20.58]
```

**ESITO DELLA VALIDAZIONE: il protocollo v2 a verdetto automatico NON si adotta.**
L'attesa T1 (TIPICA → PASSA) è violata. Per la regola scritta nel prereg — "se un'attesa
è violata: FERMATI, riporta, NON adottare il protocollo. La sorpresa è il risultato" —
questo report è il risultato. La decisione su come procedere è del PO.

## T1 Silverstone 2026 (vecchio 29,12 → nuovo 20,80)

Tipicità: loss gara 20,43 vs grappolo 20,00 (7 blocchi 2018–2025 dry) → scarto 0,43 s →
**TIPICA**, come atteso. Poi però:

Stop validi 19 (esclusi pre-verdetto: 27 SC/VSC + 1 drive-through); stop con
sensibilità ≥ 1: 7. Tabella dei top 5 per sensibilità meccanica:

| caso | sens | PRIMA (29,12) | ADESSO (20,80) | REALE | esito | err |
|---|---|---|---|---|---|---|
| VER L17 | 3 | P10/21 | P7/21 | P7/22 | MIGLIORATO | 3→0 |
| GAS L23 | 2 | P14/16 | P12/16 | P14/22 | **PEGGIORATO** | 0→2 |
| NOR L28 | 2 | P6/12 | P4/12 | P7/22 | **PEGGIORATO** | 1→3 |
| HUL L17 | 1 | P19/21 | P18/21 | P18/22 | MIGLIORATO | 1→0 |
| HAD L19 | 1 | P10/21 | P9/21 | P9/22 | MIGLIORATO | 1→0 |

Migliorati 3, peggiorati 2 → **RESPINTO** (exit 1). Attesa TIPICA → PASSA: **VIOLATA**.
I 3 casi dell'ATT6 storica (VER L17, HUL L17, HAD L19) restano MIGLIORATO; a peggiorare
sono i due casi nuovi entrati per sensibilità.

### Diagnosi della violazione (misurata, non ipotizzata)

Entrambi i PEGGIORATO portano la segnalazione dell'Addendum 3: piloti esclusi dal field
del motore (senza `pace` al freeze) ma DAVANTI al pilota nel reale — GAS L23: HAD, SAI;
NOR L28: LEC, RUS, HAM. La metrica pre-registrata confronta il rango previsto (field del
motore: 16 e 12 auto) col rango reale (field pieno: 22 auto). Ricalcolando il rango reale
RISTRETTO al field del motore (stessi denominatori, script in sessione):

| caso | reale pieno | reale ristretto | err (metrica prereg) | err (denominatori uguali) |
|---|---|---|---|---|
| GAS L23 | P14/22 | P12/17 | 0→2 PEGGIORATO | 2→0 **MIGLIORATO** |
| NOR L28 | P7/22 | P4/17 | 1→3 PEGGIORATO | 2→0 **MIGLIORATO** |

Con denominatori coerenti l'esito sarebbe 5/5 MIGLIORATO → PASSA. La violazione non dice
che il valore 20,80 è cattivo (la produzione non è in discussione): dice che **la metrica
del protocollo v2 è rotta proprio sui casi che il protocollo v2 seleziona**. Il perché è
strutturale: la selezione per sensibilità meccanica pesca gli stop in piena finestra pit,
dove molti piloti hanno appena pittato e non hanno `pace` al freeze → il field del motore
è più povero e gli esclusi NON sono più "tipicamente dietro" (la cautela dell'Addendum 3,
verificata su 6 casi a selezione cronologica, non si trasferisce alla selezione per
sensibilità). ATT6 v1 non lo vedeva per costruzione, non per merito.

Nessuna correzione applicata qui: cambiare la metrica dopo aver visto i numeri sarebbe
esattamente il post-hoc che il prereg vieta. Se si vorrà un v3 (rango reale ristretto al
field del motore), servirà un nuovo prereg — decisione PO.

## T2 Montreal 2026 (vecchio 24,37 → nuovo 18,96)

Tipicità: loss gara 24,24 vs grappolo 19,70 (5 blocchi dry) → scarto 4,54 s > 2,0 s →
**ATIPICA → NON GIUDICABILE** (exit 2), senza toccare il banco. Attesa: **RISPETTATA**
(4,54 vs il 4,53 storico: centesimo da arrotondamento, dichiarato irrilevante nel prereg
del 14/07).

La riclassificazione della nota Montreal NON viene annotata qui: era condizionata
all'adozione del protocollo, che T1 ha bocciato. La riclassificazione già in testa a
`NOTA_MONTREAL_NO_ATTIVAZIONE.md` (prereg 14/07, su main) resta valida e sufficiente.

## T3 Spa (GP Belgio, 19/07)

Dai generatori FF committati (`data/engine_ready_stops.csv`, FF4, metodo giro intero):

- Grappolo storico: **6 blocchi dry 2018–2024** (2018-r13 18,26 n=15; 2019-r13 19,25 n=20;
  2020-r7 18,09 n=5; 2022-r14 18,95 n=35; 2023-r12 18,49 n=28; 2024-r14 18,68 n=31).
  2025 escluso: WET. Ampiezza del grappolo: 18,09–19,25 (1,16 s — stretto).
- **Tipico Spa = 18,58 s** (mediana dei blocchi).
- Intervallo di giudicabilità per la gara del 19: **[16,58; 20,58]** (tipico ± 2,0).
  Il gate di tipicità è identico nel protocollo vigente (`demo/att6.mjs`) e nel v2:
  questi numeri valgono domenica comunque.
- Riferimenti staging: f1db 23,36 (`pit_loss_circuito_f1db.csv`) — 4,8 s sopra il tipico
  FF4, stessa forbice metodologica già vista sugli altri circuiti.

**Dry-run end-to-end su una gara storica di Spa: NON eseguito.** Era la prova di meccanica
di uno strumento che la validazione retroattiva ha appena bocciato; eseguirlo dopo il
FERMATI sarebbe stato lavoro sul protocollo non adottato. Se il PO decide per un v3, il
dry-run va rifatto sul v3 (la strada è pronta: `export_demo.export_gara(raw=...)` accetta
un DataFrame FastF1 negli stessi adapter del kernel, e `att6_v2.mjs` ha già `--race-json`).

## Cosa resta in piedi per domenica

Il protocollo in vigore resta quello di `PREREG_SESSIONE_ATT6_V2.md` su main (ADDENDUM 4:
`demo/att6.mjs`, gate di tipicità + tabella informativa + checkpoint umano al merge).
La checklist operativa per il 19 sera è in `SPA_DOMENICA.md`, ancorata al protocollo
vigente, con i numeri di T3.

## Artefatti

- `att6_v2.mjs` (strumento, committato e rieseguibile)
- `data/att6v2_silverstone_2026.json`, `data/att6v2_montreal_2026.json` (report macchina)
- exit code osservati: T1 = 1 (RESPINTO), T2 = 2 (NON GIUDICABILE)
