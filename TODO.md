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

7. [fatto 20/07] Riesecuzione dei 5 cancelli degrado dopo Spa (voce introdotta da PR #50,
   qui chiusa direttamente — vedi REPORT_RIESECUZIONE_SPA.md).
   - K2 climatologia: 39.9% -> 42.3% = TRASFERIBILE (soglia congelata onorata nei due versi).
   - I 4 cancelli live/adattamento: invariati (NULL / NON TESTABILE).
   - RISOLTO in Passo 0: violazione K3 SOFT@monaco sciolta escludendo Monaco.

8. [in corso] Degrado nel simulatore live — vedi PIANO_DEGRADO_LIVE.md.
   - [fatto] Passo 0: Monaco fuori (CID_NO_DEGRADO). K2 42.3->43.7%, K3 -> PASSA.
   - [fatto 20/07] Fase A: MECCANISMO scenari nel pannello pit (gancio in demo/, pitbande.mjs,
     bande JSON). Gate PASS sul meccanismo. VISIBILITA' DORMIENTE (SCENARI_ATTIVI=false):
     la riesecuzione ha trovato un DOPPIO CONTEGGIO del degrado nel gancio (rate*(eta-1)
     sopra pace_base gia' degradata, ~0.5-0.7s). Vedi REPORT_FASE_A.md.
   - [fatto 20/07] Fase B magnitudine: M1 VINCE (BIAS gancio +0.42 -> +0.05, MAE 0.57->0.35,
     34.7k coppie/9 gare). Doppio conteggio confermato e CORRETTO via adapter M1 in
     pitbande.mjs (rate*(A-A0), gancio non toccato, banda-zero bit-identica). Vedi REPORT_FASEB.md.
     Scenari ancora OFF: blocco tecnico rimosso, accensione SCENARI_ATTIVI = decisione PO.
   - [fatto 20/07] Fase B 2a meta' (calibrazione): CALIBRATA, copertura 43.1% (>=40%, IC
     38.5-47.0). Miss simmetrico. Secondario: ricentrare sulla rate LIVE crolla al 22%
     (-21pt) -> banda statica meglio della live-aggiornata (conferma arco chiuso). Vedi
     REPORT_FASEB2.md. Blocco tecnico alla visibilita' SCIOLTO su tutti i fronti;
     accensione SCENARI_ATTIVI = solo decisione PO.
   - [in corso 20/07] Fase C: shadow-run live. CORREZIONE PIANO: l'MQTT rotto NON e' il
     blocco del degrado — compound+eta-gomma arrivano dal SignalR (TimingAppData.Stints),
     che gia' registriamo. FATTIBILITA' PROVATA: prototipo decodifica gli stint dalla
     registrazione British, 21/21 piloti combaciano con l'archivio. Vedi REPORT_FASEC.md.
     RESTA: (a) decodifica stint nel collettore = produzione, PO; (b) shadow-run durante
     HUN (calcola+registra, non pubblica; KPI in PREREG_SESSIONE_FASEC.md); (c) pubblicaz. = PO.
   - [accensione demo fatta 20/07: SCENARI_ATTIVI=true, PR #64 mergiata]

## Principi
- La griglia non deve mai svuotarsi: all'ultimo giro si vedono tutti e 22.
- Il motore non fa sparire nessuno: porta tutti fino in fondo.
- Fonte = verita'. Trascrizione umana = bug in attesa (griglia Monaco sbagliata a mano, 02/07).
