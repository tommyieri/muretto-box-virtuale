# Curva 1: OCO attacca i freni 18 metri più tardi del compagno

*Telemetria · Libere 1 Ungheria 2026 — Muretto · Redazione tecnica · 2026-07-25 · BOZZA*

> Alla staccata più dura dell’Hungaroring — curva 1, da 323 a 93 km/h, circa 230 km/h di calo — OCO inizia a frenare a 138 metri dall’apice contro i 156 del compagno HIR, la stessa Haas: 18 metri più tardi. Stessa velocità d’ingresso e d’apice, ma la frenata è compressa in meno spazio — quindi più forte.

## Evidenza — Stessa Haas, diciotto metri di differenza
Curva 1 è la staccata più dura del giro: si arriva a 323 km/h e si scende a 93 all’apice, circa 230 km/h lasciati in una frenata. La telemetria delle libere misura, giro per giro, dove ogni pilota attacca i freni — la distanza dall’apice alla quale il pedale va giù.Il confronto pulito è in casa Haas, stessa vettura: OCO inizia a frenare a 138 metri dall’apice, il compagno HIR a 156 metri — OCO stacca 18 metri più tardi (mediana su 6 e 6 giri lanciati). Non è un caso isolato: 4 dei 6 giri di OCO cadono sotto la staccata più tardiva di HIR (149 m), il suo giro migliore da questo lato.
*[figura] Attorno a curva 1: OCO (pieno) tiene il gas più a lungo e attacca i freni più tardi (marcatore più vicino all’apice) del compagno HIR (tratteggio), stessa Haas. — fonte: FastF1 · car telemetry (Brake/Speed/Throttle), Libere 1 Ungheria 2026*

## Causa — Stessa velocità, meno spazio: la frenata è più forte
I due arrivano quasi identici: OCO entra a 314 km/h e passa l’apice a 88, HIR a 312 e 87. Stessa velocità in ingresso, stessa velocità in curva: l’unica cosa che cambia è lo spazio in cui OCO porta a termine la frenata, 18 metri più corto. A parità di velocità da smaltire, meno spazio vuol dire una decelerazione più alta — la stimiamo (fisica v²/2d, non misura diretta) attorno a 25,4 m/s² per OCO contro 22,3 per HIR.Nel contesto dello schieramento OCO risulta il più tardivo di tutti, ma è un primato fragile e lo diciamo: sul secondo (FOR) il margine è appena 1,8 m e i singoli giri si sovrappongono. Il fatto solido non è il record di griglia — è il divario col proprio compagno, che condivide la macchina.
*[figura] Punto di frenata a curva 1 per ogni pilota: OCO e HIR evidenziati. OCO è il più tardivo della griglia, ma sul 2º il margine è di appena 1,8 m — il primato assoluto è fragile; il divario col compagno no. — fonte: FastF1 · car telemetry (Brake) + circuit_info, Libere 1 Ungheria 2026*

## Effetto — Metri, non decimi — e con le cautele delle libere
Diciotto metri più tardi del compagno, con la stessa vettura, sono un dato concreto in ingresso di curva 1. Ma sono libere, e vanno lette come tali: il carburante di HIR è ignoto e un run più pesante gonfierebbe il divario — è mitigato dalla velocità d’ingresso quasi identica (314 contro 312 km/h), non azzerato. Mappe motore e compound/età gomma per-giro non sono noti, il campione è piccolo (6 e 6 giri) e la varianza giro-per-giro di OCO è alta (sd 16,7 m, da 119 a 163).Ciò che non vediamo lo dichiariamo: temperatura e usura di freni e gomma non hanno canali nel feed, e la decelerazione è stimata, non misurata. Su curva 1, con queste cautele, OCO frena più tardi del compagno — e lo fa dove sbagliare costa di più.

## Provenienza dei dati
- **punto di frenata a curva 1 (m prima dell’apice)**: OCO 137,5 m · HIR 155,7 m · mediana schieramento 151,7 m — `MISURATO` (prima attivazione del canale Brake in [apice−220, apice+40] m, apice = min velocità in [−25,+75] m; mediana sui giri lanciati (FastF1 + mappa-curve))
- **velocità della staccata (ingresso → apice)**: OCO 314 → 88 km/h · HIR 312 → 87 km/h — `MISURATO` (massima in avvicinamento e minima nella finestra d’apice, mediana sui giri lanciati)
- **decelerazione media in frenata**: OCO 25,4 · HIR 22,3 m/s² — `STIMATO` (fisica v²/2d da velocità d’ingresso, velocità d’apice e spazio di frenata (canali a ~4 Hz), non misura diretta)
- **robustezza del duello col compagno**: 4/6 giri OCO sotto il minimo di HIR (149 m); OCO sd 16,7 m, range 119–163 — `MISURATO` (punto di frenata giro-per-giro sui giri lanciati dei due piloti)
- **primato assoluto di griglia**: OCO 1º ma +1,75 m sul 2º (FOR); singoli giri sovrapposti — FRAGILE — `MISURATO` (ranking di schieramento sui giri lanciati; dichiarato fragile, non usato come tesi)
- **DRS**: degenere (unico valore [0]) — escluso dalla misura — `MISURATO` (canale DRS della telemetria vettura, verificato costante a 0 in FP1)
- **carburante, mappe motore, compound/età gomma per-giro**: ignoti in prove libere — `NON_MISURABILE` (non esposti dal feed in sessione libera; possono spostare il punto di frenata)
- **usura/temperatura di freni e gomma**: non quantificabile — `NON_MISURABILE` (nessun canale di temperatura o carico freni nel feed)