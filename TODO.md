# Muretto — debiti aperti

**Ultima revisione: 17/08/2026.** *Questo file va datato a ogni passaggio.* Fino a oggi non lo
era, e le sue voci più recenti erano del **22/07**: ventisei giorni in cui il repo è passato dal
commit ~50 al 175 e il documento non se n'è accorto. La pagella del 13/08 lo ha detto — *«i
documenti di governo sono l'unica memoria esplicitamente stantia»* — e aveva ragione. Un TODO
senza data non si sa se è vuoto o abbandonato, e i due stati si somigliano troppo.

Regola: i dati vengono da f1db/TI, MAI trascritti a mano. Ogni griglia/pole va verificata con Tommi.

---

## Aperti al 17/08/2026 (verifica operativa Mac + VPS, riattivazione `live/`)

**A. 🟢 Chiave LLM: RUOTATA e allineata il 17/08.** Chiave nuova su entrambe le macchine
(stessa impronta, 108 char, permessi 600), valida (HTTP 200), diversa da tutte e tre le
precedenti. La redazione ha girato **un solo ciclo** senza scrittore-LLM (le 13:45, su 347
storici) e da 14:15 riporta `LLM: attivo`.

> **La trappola, che vale più della voce chiusa.** La rotazione era corretta *e non funzionava*:
> `~/.muretto_env` conteneva il **valore nudo**, senza `export ANTHROPIC_API_KEY=`. La chiave era
> giusta, ma nessun processo la caricava — `chiave-on` e `auto_articoli_run.sh` fanno
> `. ~/.muretto_env`, e sorgere un file che non definisce niente non definisce niente. Sintomo
> visibile: **una parola in una riga di log** (`LLM: ASSENTE`), e la redazione che scrive a
> template invece di fermarsi. Un `curl` con la variabile vuota dà **401**, cioè lo stesso
> codice di una chiave revocata: le due cause si distinguono solo controllando che la variabile
> arrivi. Riparato il formato senza toccare il valore (copia in `~/.muretto_env.bak-formato`).

**A-bis. 🟡 Resta da decidere DOVE tenere il segreto, ed è la lezione vera.** La difesa «non la
esporto» **non ha tenuto**: la chiave precedente è finita in chiaro in una trascrizione d'agente
il 17/08 alle 03:04 perché un agente ha letto i dotfile. Non serve che sia esportata, basta che
sia leggibile nella home — e `600` protegge dagli altri utenti, non dagli agenti che girano coi
permessi di Tommi. Le due strade sensate: **keychain** (l'agente deve chiedere, e si vede) o
**chiave solo sul VPS**, dove non girano agenti. La revoca della vecchia si verifica **solo in
console** (stato + ultimo utilizzo): non l'ho provata da qui, e non ho ripescato il valore
vecchio dalle trascrizioni per rigiocarlo — maneggiarlo di nuovo lo riesporrebbe.
I valori vecchi **restano su disco** in due trascrizioni (Codex 14/08 e 17/08): una volta
revocati sono inerti, ma sono lì.

**B. 🟡 `live/` non è riattivabile: il modulo prende per buona una coordinata di parcheggio.**
Il 90,5 % dei campioni GPS nei periodi pit dell'Ungheria sta sulla costante `(-7447, -1830)`,
che non è `(0,0,0)` e quindi passa il filtro. Serve una **prereg** sul secondo sentinella di
posizione, col vincolo di non peggiorare il KPI 4 di Spa (oggi 98,97 %). Referto completo e
altri quattro punti aperti in [`live/REPORT_RIATTIVAZIONE.md`](live/REPORT_RIATTIVAZIONE.md).

**C. 🟡 `demo/data/schede_2026.json` pubblica il numero di gara sbagliato per NOR.**
`gen_schede.py:144` usa `permanentNumber` (4); nel 2026 Norris corre col **1** — grezzo TI e
`DriverList` del feed d'accordo su 22 auto su 22. È un numero **pubblicato sul sito**. Il fix è
alla fonte (numero di gara dal grezzo, non permanentNumber) e ri-deriva `schede_2026.json`:
è una ri-derivazione deliberata, si versiona e si dichiara.

**D. 🟡 `inspect_recording.py` dice «nessun gap» su una registrazione che perde nove giri.**
Guarda un file alla volta, e il buco sta **fra** le due parti. Va misurato il gap fra parti
consecutive.

**E. 🟡 `data/live_raw/` è gitignorata: le registrazioni vivono su UNA macchina.** Stessa
esposizione del pickle del warm-in (voce 10). Le prove di `REPORT_RIATTIVAZIONE.md` non sono
riproducibili altrove.

**F. 🟢 Cinque artefatti orfani in `data/live_derived/`** — tracciati, senza generatore in
`main`: `ungheria_ref_track.json`, `pitlane_ungheria.json`, `ungheria_pit_samples.json`,
`ungheria_precostruzione_xy.svg`, `kpi3_f1db.json`. I generatori dei primi quattro
(`costruisci_corridoio.py`, `verifica_precostruzione.py`) esistono in worktree **mai mergiati**.
È la voce 9, ancora aperta su un'altra cartella.

### Chiusi il 17/08/2026

- **`auto_run.sh` non si aggiornava più da sé dal 10/08.** Usava `git status --porcelain` nudo,
  che conta i file non tracciati: sul VPS bastava `data/auto_articoli.log` (comparso col
  trasloco della redazione) per mandarlo nel ramo «albero sporco» a ogni giro. **343 giri, 7
  giorni, zero aggiornamenti** — e nessun sintomo, perché il checkout restava fresco per merito
  di `auto_articoli_run.sh`, che usa la forma giusta. Un wrapper faceva il lavoro dell'altro.
  Allineato ai due gemelli, e **s46 adesso sorveglia anche questo ramo** (asserzione con prova
  di fallimento).
- **`live/verifica_gara.py` era un artefatto orfano al contrario**: cancellato da `8c4eaec`
  mentre il suo prodotto (`kpi_fase1b.json`) restava tracciato, e il prereg di Fase 1B lo
  dichiara tracciato. Ripristinato da `1236ff7` e parametrizzato per gara.

## Da chiudere (voci storiche, fino al 22/07/2026)
1. [in corso] Griglia + qualifica da f1db per tutte le 8 gare (rigenerate dalla fonte).
   - Monaco verificato: pole ANT, poi VER/HAM/LEC. OK.
   - Le altre 7: da riverificare pole con Tommi.
2. [aperto] Penalita' di tempo in gara (timePenalty da f1db race-results).
   - DISCREPANZA: Gasly Monaco +5s (memoria Tommi) vs f1db = None. Da chiarire.
3. [chiuso 22/07] Austria assente in arrivi_2026.csv e classifica_giro_2026.csv.
   - Chiuso alla radice: i due file erano ORFANI (nessun generatore). Ora hanno
     gen_arrivi.py e gen_classifica_giro.py, con perimetro derivato da
     data/gare_registro.json e guardia che riproduce cella per cella le 7 gare
     congelate. Entrambi rigenerati a 10 gare (Austria, Gran Bretagna, Belgio incluse).
4. [chiuso 22/07] arrivi_2026.csv fermo a 7 gare, Australia 21 righe (manca PIA).
   - Le 7 gare: chiuse dal generatore (v. punto 3), ora 10.
   - Le 21 righe NON erano un bug del file: PIA non ha nessun giro nel grezzo di
     Australia (muro in ricognizione, punto 5) e il grezzo e' la fonte. Il generatore
     scrive una riga per pilota PRESENTE nei dati di pista, mai una riga inventata.
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

9. [chiuso 22/07] Fonti orfane per-gara: censite tutte e cinque, nessuna resta debito.
   - RICOSTRUITE (generatore + guardia, perimetro dal registro, ora 10 gare):
     data/classifica_giro_2026.csv -> gen_classifica_giro.py
     data/arrivi_2026.csv          -> gen_arrivi.py
   - CANCELLATE con l'OK del PO, perche' NON ricostruibili dal grezzo in repo: il
     per-giro delle PROVE LIBERE non esiste da nessuna parte (data/ti_archive e
     data/ti_cache contengono solo Race.json e Sprint.json, mai una Practice), e
     ingest_ti2026.py scarica solo Race+Sprint. gen_libere_ti.py legge le libere
     dalla rete ma ne pubblica solo il timesheet del giro veloce, non i giri:
     data/long_run_fp_2026.csv     (277/343 righe = Practice 1/2/3)
     data/team_profile_2026.csv    (73/77 righe con fonte FP, e nessun lettore)
     data/tyre_observations_2026.csv (1630/8824 righe FP, e nessun lettore)
   - Per riavere questi tre servirebbe prima ingerire le sessioni Practice nel
     ti_archive: e' una fonte nuova, non una rigenerazione. Nessun numero e' stato
     stimato al posto del dato mancante.
   - [SBLOCCATO 22/07] Le Practice CI SONO, e sono sempre state online. `ingest_ti2026.py`
     scaricava solo Race+Sprint; ora scarica anche 'Practice 1/2/3'. In repo: 22 sessioni,
     3,5 MB, schema IDENTICO a Race.json (39 colonne, zero differenze - verificato campo
     per campo su Belgio). Sui weekend sprint esiste solo la FP1: l'elenco SPRINT nello
     script viene da data/calendario_2026.json, non e' indovinato.
     ATTENZIONE, il difetto era nostro e va ricordato: l'URL non codificava il nome della
     sessione, e 'Practice 1' ha uno spazio. Ogni tentativo falliva e lo script stampava
     "assente online" - cioe' diceva CHE IL DATO NON C'ERA quando non c'era la richiesta.
     La riga che diceva "non esiste da nessuna parte" era vera solo del nostro codice.
   - I tre CSV cancellati sono ora RICOSTRUIBILI (i loro generatori no: vanno riscritti).
     Ricade qui anche il punto 10: `val2026` cablato in finalize_warmin.py:6 nacque su
     `tyre_observations`, cancellato "perche' non ricostruibile". Adesso lo e'.
   - LIMITE che resta, e non lo tocca l'ingestione: i giri delle libere sono SPORCHI
     (carburante ignoto, run interrotti, push e long-run mescolati). Descrivono il
     venerdi; NON stimano il degrado - quel rigetto e' gia' a referto.

10. [debito dichiarato 22/07] warm-in: sorgente ora committata, resta un pezzo cablato.
    - `data/warmin_prior.csv` alimenta `warminA`, cioe' un ingrediente della baseline
      SIGILLATA dell'undercut (`margine_v1`). Era l'unico artefatto che nessuno sapeva
      piu' rifare: generatore senza fonte, `.pkl` gitignorato e presente su UNA sola
      macchina. Bastava perdere quel file per perdere il numero.
    - FATTO: `data/_warmin_raw_multiyear.pkl` (56 KB) e' uscito dal .gitignore ed e'
      committato. Verificato che `python3 finalize_warmin.py` riproduca warmin_prior.csv
      BIT-IDENTICO e SENZA RETE. Il warm-in smette di essere "congelato per forza".
    - RESTA APERTO, e non e' urgente: (a) il pickle stesso nasce da `ingest_warmin.py` /
      `ingest_2025.py`, che vanno in rete — la catena e' riproducibile ma non dal grezzo
      in repo; (b) i valori 2026 sono CABLATI in `finalize_warmin.py:6`
      (`val2026 = {...}`, ricostruiti a suo tempo su `tyre_observations`, file oggi
      cancellato perche' non ricostruibile). Rifare quei sei numeri da una fonte viva e'
      il lavoro vero, da fare con calma.

11. [rinviato per decisione del PO] `TODAY` cablato in `gen_censimento_pitloss.py:30`.
    - `TODAY = datetime.date(2026, 7, 14)` ed `events_for` scarta le gare con data >=
      TODAY: senza rimedio nessuna gara futura entrerebbe MAI nel pit-loss.
    - Oggi e' neutralizzato A RUNTIME da `gen_pitloss_pergara.py` (frontiera = data
      odierna, stampata a ogni esecuzione); il file FF3 non e' toccato.
    - Cambiarlo alla fonte sposterebbe il perimetro di artefatti FF3/FF4 gia' a referto
      (`censimento_pitloss_2026.csv`, `censimento_stops.csv`): e' una RI-DERIVAZIONE
      DELIBERATA — si ri-deriva e si versiona, dichiarandolo — non manutenzione.
      Da fare quando si riapre di proposito lo studio pit-loss, non prima.

## Principi
- La griglia non deve mai svuotarsi: all'ultimo giro si vedono tutti e 22.
- Il motore non fa sparire nessuno: porta tutti fino in fondo.
- Fonte = verita'. Trascrizione umana = bug in attesa (griglia Monaco sbagliata a mano, 02/07).
