# REPORT — CANCELLO ADATTAMENTO (struttura dalla storia, taratura dal 2026)

*Sessione 2026-07-16, branch claude/cancello-adattamento. Protocollo:
`PREREG_SESSIONE_ADATTAMENTO.md` (committata prima dei numeri, commit 9fcc3fb).
Generatore: `gen_cancello_adattamento.py`; dettaglio: `data/CANCELLO_ADATTAMENTO_REPORT.txt`.*

## Esito (formato del mandato)

**CANCELLO: NULL — M1 vittorie 8/14 (57%), IC95 [−0.0201, +0.0125]**

Primario testabile (14 coppie LORO su 8 gare). L'offset globale tarato sulle altre
gare 2026 **non batte il prior grezzo**: vittorie sotto soglia (57% < 60%), IC95
attraversa lo zero e — il dato più severo — **l'errore mediano peggiora** (M1 0.0409
vs M0 0.0335): M1 vince di poco dove il prior era già vicino, e perde in grande dove
il prior sbagliava davvero. I secondari non salvano nulla e non riscattano: M2
(offset per mescola) come M1; M3 (Theil–Sen) pareggia il prior (0.0333 vs 0.0335) —
una ricalibrazione monotona ben fatta riproduce il prior, non lo migliora.

## Il fatto strutturale (vale più del 57%)

Lo spostamento 2026 **non è un livello globale recuperabile dalle altre gare**: è
circuito-specifico e a volte cambia il segno. Le coppie che dominano l'errore lo
dicono da sole:

- Australia MEDIUM: bersaglio **−0.043** contro prior **+0.069** (segno opposto);
- Canada MEDIUM: bersaglio **−0.002** contro prior **+0.100**;
- Monaco MEDIUM: bersaglio **+0.055** contro prior **−0.028** (segno opposto, verso
  l'altro lato);
- Barcellona (tutte e tre le mescole): bersaglio +0.12/+0.17/+0.24 contro prior
  0.06–0.09 — servirebbe un offset +0.06/+0.15, la taratura globale ne dà +0.023.

Nessuna correzione di livello o di scala imparata *dalle altre* gare può sistemare
errori che vanno in direzioni diverse gara per gara. **È la stessa firma di K2**
(Suzuka trasferisce, Barcellona no) vista dal lato opposto: coerente, quindi
credibile — e chiude questa strada.

## Dove siamo dopo quattro cancelli (la mappa, non un verdetto)

| tentativo | esito | cosa ha stabilito |
|---|---|---|
| prior storico grezzo (K2) | STOP 39.9% | il passato non trasferisce tal quale |
| live grezzo primi-15 | direzione contraria | l'evoluzione-pista confonde la finestra precoce |
| live de-confuso (pari giro) | NULL 3/9, ma 15/22 sul grezzo | lo stimatore è valido; **vince dove il prior sbaglia** |
| adattamento LORO (questo) | NULL 8/14, err peggiora | lo spostamento non si impara dalle ALTRE gare |

La convergenza è netta: **la correzione per-circuito esiste ma la rivela solo la gara
stessa** — ed è esattamente il segnale che il de-confuso cattura (Barcellona err
0.016 vs 0.077; Canada 0.039 vs 0.082). L'unico candidato rimasto in piedi è la
**combinazione**: prior come base pre-gara, correzione live de-confusa quando i due
divergono oltre soglia, dentro la gara. Sarebbe il quinto sguardo: se si apre, va
pre-registrato con la soglia di divergenza dichiarata prima e con l'onestà di dire
che dopo cinque sguardi un PASS marginale varrebbe poco — servirebbe un PASS netto.
Decisione: PO.

## Numeri di contesto

- Bersaglio = mediana pendenze-stint di gara intera (stessa misura del prior:
  fuel-corretto 3/70, riferimento locale, plateau life≥3, igiene invariata).
- Coppie perse: target<3 = 3, prior_assente = 9, taratura<6 = 0.
- LORO: la gara di verifica non vede mai i propri dati; bootstrap blocchi-gara
  B=1000, seed 20260716. Nessuna banda costruita; gancio a banda-zero.

## Golden (prima e dopo)

`test_b.py` 449/449 · `test_b.mjs` 449/449 · `demo/test_pit.mjs` 11/11 ·
`test_degrado_hook.mjs` banda-zero bit-identica — verdi; solo file nuovi.
Kernel, pit, gancio, produzione: non toccati. Verdetto strategico: PO.
