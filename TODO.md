# Muretto — debiti aperti (dati demo storica)

Regola: i dati vengono da f1db/TI, MAI trascritti a mano. Ogni griglia/pole va verificata con Tommi.

## Da chiudere
1. [in corso] Griglia + qualifica da f1db per tutte le 8 gare (rigenerate dalla fonte).
   - Monaco verificato: pole ANT, poi VER/HAM/LEC. OK.
   - Le altre 7: da riverificare pole con Tommi.
2. [aperto] Penalita' di tempo in gara (timePenalty da f1db race-results).
   - DISCREPANZA: Gasly Monaco +5s (memoria Tommi) vs f1db = None. Da chiarire.
3. [aperto] Austria assente in arrivi_2026.csv e classifica_giro_2026.csv.
   - Rigenerare esiti Austria (NP/RIT/doppiato) da f1db race-results.
4. [aperto] arrivi_2026.csv fermo a 7 gare, Australia 21 righe (manca PIA).
   - File accessorio vecchio: rigenerare da f1db.
5. [fatto-parziale] Piastri Australia (muro in ricognizione) e casi NP:
   - gestiti come categoria "in griglia ma zero dati" -> saltati al via, mostrati come non-partiti.
6. [in corso] Vista: nessuno sparisce mai dalla griglia.
   - in pista = riga normale; doppiato arrivato = "arrivato · N giri"; RIT = "ritirato (giro X)"; NP = "non partito".

## Principi
- La griglia non deve mai svuotarsi: all'ultimo giro si vedono tutti e 22.
- Il motore non fa sparire nessuno: porta tutti fino in fondo.
- Fonte = verita'. Trascrizione umana = bug in attesa (griglia Monaco sbagliata a mano, 02/07).
