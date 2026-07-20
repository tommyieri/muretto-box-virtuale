# PIANO — DEGRADO NEL SIMULATORE LIVE

*Redatto 2026-07-20 (PO + Claude). La missione è un simulatore IN LIVE: se dico a
Leclerc "pitta ADESSO", lui lo fa — quindi va calcolato tutto ciò che è simulabile
mentre Leclerc è in gara per davvero. Vantaggio strutturale: Leclerc è in pista,
quindi passo/gomma/età-gomma attuali sono DATI, non stime.*

## Punto della situazione (cosa è misurato, non opinione)

- **Tubo validato**: gancio v1.5 (tre scenari coerenti end-to-end, banda-zero
  bit-identica, K4 passato). Modulo pit in produzione. Sezione live del sito: su.
- **Acqua (bande) con etichetta**: dopo Spa K2 = TRASFERIBILE; con Monaco fuori
  (Passo 0) **K2 = 43.7%** e **K3 PASSA** pulito. Le bande climatologiche per
  (mescola, circuito) sono un prior legittimo SE presentate come scenari.
- **Lezione dei 5 cancelli**: misurare il degrado della gara in corso si può
  (de-confuso valido, batte il grezzo 15/22); *sostituire* il prior con la misura live
  NO (scatto = moneta). Il live **corregge** dove il prior sbaglia forte
  (Barcellona, Canada), non lo rimpiazza.
- **Riformulazione-chiave (PO)**: in live non si predice. Il kernel già incorpora
  passo/gomma reali (pace_base al freeze). Il degrado aggiunge alla simulazione
  "pitta ora vs allunga 5 giri" SOLO il rate dei prossimi 3-5 giri — lì serve la banda.

## Passo 0 — Monaco fuori ✓ FATTO (questa PR)

Circuito a degrado non-misurabile (track-position). `CID_NO_DEGRADO` dichiarato;
climatologia/K2/K3/bande lo escludono; gancio banda-zero per sempre a Monaco.
Effetto: K2 42.3→43.7%, K3 → PASSA. Golden verdi.

## Fase A — scenari dal prior, in DEMO (fattibile ora, prima dell'Ungheria)

Alimentare il gancio con le bande climatologiche della prossima gara (Hungaroring:
righe informative MEDIUM/HARD) e portare i tre scenari nel pannello pit della demo,
**etichettati come scenari** (mai "previsto"). Interruttore di sicurezza: bande assenti
(SOFT scarso, gara bagnata, Madrid, Monaco) → scenario unico, onesto.
- **Gate A**: K4 su Ungheria (distinguibili+plausibili) + verifica UI (le etichette non
  suggeriscono certezza) + golden banda-zero bit-identico.

## Fase B — la banda che si aggiorna in gara (domanda NUOVA, KPI NUOVO)

NON "live batte prior" (già NULL). Domanda: **"la banda prior, aggiornata coi giri già
corsi della gara, mantiene la copertura sui 5 giri SUCCESSIVI senza allargarsi troppo?"**
Orizzonte prossimi-5-giri (non ultimo-terzo): domanda genuinamente nuova. Usa il
de-confuso per ciò che sa fare (correggere, non sostituire). Testabile in **REPLAY**
sulle 10 gare 2026 (Monaco escluso) PRIMA di toccare il live.
- **Gate B**: prereg dedicata, copertura rolling ≥ soglia congelata, IC a blocchi-gara.
  NULL onesto ammesso.

## Fase C — innesto nel live del sito

Dipendenze concrete:
- compound + età-gomma in tempo reale (⚠ MQTT OpenF1 rotto dal 19/07 — serve fix o
  fallback polling; vedi [[hun-preparazione]]);
- pit detection (c'è);
- SC/VSC live che SPEGNE il degrado (regola già incisa: sotto neutralizzazione la
  penalità si spegne).
- **Gate C**: **shadow-run sull'Ungheria** — scenari calcolati in diretta ma NON
  pubblicati; confronto post-gara osservato-vs-scenari. Se regge → pubblicazione alla
  gara dopo, con etichette.

## Sequenza e principio

Passo 0 (fatto) → Fase A prima di HUN → shadow C durante HUN → cancello B post-HUN
(11ª gara nel campione). Ogni fase col suo gate; ogni NULL onorato; **attivazioni
sempre del PO**. Il vantaggio strutturale (la gara ci regala a ogni giro il dato che
prima indovinavamo) è il cuore di B/C: il sistema INCASSA il dato — banda che si
stringe — invece di predirlo.
