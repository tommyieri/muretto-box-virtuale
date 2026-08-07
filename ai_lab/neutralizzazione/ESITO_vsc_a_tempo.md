# ESITO — la VSC a tempo PASSA: il debito storico è spiegato, il veto si restringe

**Data: 07/08/2026.** Esegue `PREREG_vsc_a_tempo.md`, scritta prima dei numeri.
Fonte nuova: `track_status` FastF1 (finestre al millisecondo, stesso orologio dei
confini di giro), estratta da `estrai_frazioni_vsc.py` → `frazioni_vsc_2026.json`
(cross-check race control: finestre = deployed su 11 gare su 11). Metro: lo STESSO
stimatore di V1 (`misura_vsc_a_tempo.mjs`). Dati: `ESITO_vsc_a_tempo.json`.

## Il verdetto

**V2 PASSA**, su entrambe le condizioni pre-registrate:

| bin (frazione di giro sotto VSC) | n | R_lap |
|---|---|---|
| **PIENI** (f ≥ 0,9) | 82 | **1,323** — dentro [1,20–1,50] ✓ |
| ALTI (0,5–0,9) | 129 | 1,198 |
| BASSI (0–0,5) | 197 | 1,077 |

Monotonia: 1,077 < 1,198 < 1,323 ✓. **La VSC vera rallenta il giro del ~32%** —
fisica sana, come la SC.

## Il debito storico, spiegato

Le celle che l'archivio marca **'6' hanno una copertura VSC mediana del 53%**
(n 380), e NESSUNA cella '6' ha frazione zero: il simbolo non sbaglia MAI la
presenza — sbaglia la QUANTITÀ, perché proietta su un giro intero un fenomeno a
tempo. Il pooled 1,055 della Sessione N e il 1,116 di V1 erano la miscela: metà
giri quasi-verdi che diluiscono i pieni. Non era la fonte a essere rotta: era la
LETTURA per-giro di una grandezza a tempo.

## Cosa cambia (e cosa no)

- **Il veto si RESTRINGE**: «nessuno costruisca sul simbolo '6' per-giro» resta in
  vigore. La **VSC a tempo è utilizzabile con targhetta**: finestre e frazioni
  vivono in `frazioni_vsc_2026.json` (rigenerabile dalla cache di progetto).
- **Niente si accende qui**: ogni consumo — un fattore di neutralizzazione VSC
  pesato per frazione, le finestre vere del laboratorio, il prior del pit-loss —
  è una decisione separata con la sua prereg. Questo referto conferisce la
  VALIDITÀ della fonte, non un uso.
- Monaco/Suzuka e il fondo storico restano fuori perimetro: la fonte a tempo è
  stata validata sulle 11 gare 2026; estenderla al fondo è un'estrazione nuova
  (fattibile: la cache 2018-2025 c'è) con lo stesso metro già scritto.
