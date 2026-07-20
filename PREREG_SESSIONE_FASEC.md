# PREREG SESSIONE — FASE C: shadow-run degli scenari nel live

*Committata PRIMA dei numeri. Branch: claude/fase-c-shadow. Data: 2026-07-20.*
*Da PIANO_DEGRADO_LIVE.md. Segue Fase B (magnitudine M1 + calibrazione 43.1%) e
l'accensione degli scenari nella demo.*

## 0. Correzione del piano (emersa in ricognizione, dichiarata subito)

Il PIANO indicava come dipendenza di Fase C "MQTT OpenF1 rotto dal 19/07". **La
ricognizione la smentisce come blocco per il degrado**: gli input che servono agli
scenari — **compound + età-gomma per pilota, live** — arrivano dal feed **SignalR
ufficiale** (topic `TimingAppData`, campo `Stints[].Compound` e `TotalLaps`), che il
collettore GIÀ registra e che NON dipende dall'OpenF1 MQTT (rotto per un rifiuto
lato-server, ticket a parte — e comunque l'ingress OpenF1 non sottoscrive nemmeno gli
stint). Verificato su registrazione reale (British 2026-07-05, in `data/live_raw/`):
TimingAppData porta gli stint con compound e vita-gomma.

Il vero gap è che il collettore **non decodifica** oggi `TimingAppData.Stints` in
`(compound, tyre_age)` per il client. Fase C quindi = (a) decodificare gli stint dal
SignalR, (b) far girare gli scenari in SHADOW durante una sessione live, (c) confronto
post-gara. La (a) tocca il collettore (produzione) → decisione/deploy del PO; questa
sessione ne prova la FATTIBILITÀ su registrazione, senza toccare la produzione.

## 1. La domanda (UNA, stretta)

**Gli scenari di degrado, calcolati IN DIRETTA durante una sessione live (input
compound/età-gomma dal SignalR, banda M1 già calibrata), sono coerenti col reale a
gara finita — senza pubblicare nulla?** È lo shadow-run: si calcola e si REGISTRA, non
si mostra. Il go/no-go alla pubblicazione live è del PO, dopo aver visto lo shadow.

- Nessuna pubblicazione live in questa fase. La demo (replay) resta l'unico posto dove
  gli scenari si vedono. Produzione live: invariata finché il PO non ratifica.
- "Previsto" non compare. Kernel, gancio, modulo pit: non toccati (il gancio è CHIAMATO,
  con l'adapter M1 già validato).

## 2. Fattibilità (questa sessione, read-only, NON produzione)

Prototipo `live/prototipo_stint_signalr.py`: legge una registrazione SignalR grezza,
decodifica `TimingAppData.Stints` in una timeline per-pilota `(giro → compound,
tyre_age)`, e la **verifica incrociata** contro la struttura stint nota della stessa
gara (`demo/data/Gran Bretagna.json`, fonte archivio). Esito atteso: le sequenze di
compound e i giri-pit coincidono → la fonte SignalR è sufficiente per alimentare gli
scenari live. È una prova di fattibilità, non un KPI: nessuna soglia, nessuna banda.

## 3. Lo shadow-run (protocollo per la prossima sessione live — Ungheria)

Quando il collettore decodifica gli stint (lavoro abilitante, PO), durante una sessione
live di gara:
- a ogni aggiornamento, per il pilota selezionato si calcolano i tre scenari (gancio +
  adapter M1 + banda calibrata del circuito), con gli STESSI interruttori di sicurezza
  della demo (niente bande/circuito non informativo/Monaco → base; sotto SC/VSC → base);
- gli scenari si **REGISTRANO** con timestamp e stato-gara (mai mostrati);
- **a gara finita** si confronta, in replay sulla registrazione stessa:
  - copertura (obs cumulato nei giri successivi ∈ [ott, pess]) — atteso ~ la 43.1%
    della calibrazione, ma **misurato live**;
  - plausibilità (ordine ott ≤ centrale ≤ pess, ampiezza ≤ 25% pit-loss);
  - **banda-zero bit-identica** al kernel anche live (invariante non negoziabile).

**KPI congelato ORA (shadow, decide il GO alla pubblicazione, proposta al PO):** GO se
copertura live ≥ **40%** E banda-zero bit-identica E zero scenari sotto SC/VSC. NO
altrimenti; in ogni caso il verdetto di pubblicazione è del PO. **NON TESTABILE** finché
non c'è una sessione live con stint decodificati.

## 4. Output di questa sessione

- `PREREG_SESSIONE_FASEC.md` (questo file, prima dei numeri)
- `live/prototipo_stint_signalr.py` (read-only sulla registrazione; non tocca il
  collettore) + verifica incrociata stampata
- `REPORT_FASEC.md` con: la correzione del piano (MQTT non è il blocco), l'esito della
  fattibilità (stint decodificabili SÌ/NO, cross-check), e il lavoro abilitante residuo
  (decodifica stint nel collettore = produzione, PO) + lo shadow-run pronto per HUN.
- Golden verdi. Commit su claude/fase-c-shadow, niente merge. Verdetto strategico: PO.
