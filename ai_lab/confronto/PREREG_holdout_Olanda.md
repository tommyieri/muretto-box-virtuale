# PREREG — il primo fuori campione vero: Zandvoort, 23/08/2026

*Scritto il 01/08/2026, tre settimane PRIMA della gara. È l'unico modo in cui questo
documento vale qualcosa.*

## Perché esiste

Il confronto fra i due motori (`REFERTO_confronto_motori.md`) ha stabilito che il nuovo
vince M1 per **5 casi su 223** e che il suo intervallo di confidenza a blocchi contiene lo
zero. Ma il limite che pesa di più non è il margine: è che **ogni pezzo del motore nuovo è
tarato sulle stesse 11 gare su cui è stato misurato**. `modello_v2.json`, `banda_rientro.json`
e il pit-loss «realizzato» di Gran Bretagna e Miami vengono da lì. Il leave-one-race-out
resta dentro quelle 11 gare: è una prova debole per costruzione.

**Nessun numero di quel confronto è mai stato prodotto fuori campione.** L'Olanda è la prima
gara che nessun modello ha mai visto. Si può bruciare una volta sola.

## Lo stato sigillato (verificato oggi, non promesso)

Al momento della firma i modelli sono questi, e sono **pinnati** in `data/MANIFEST.sha256`
(`node provenienza/verifica_manifest.mjs` in CI li controlla a ogni push):

```
banda_rientro.json  6f5394c3f478aab97ea5b7b097fe653bde12baf296307d89dd5067fa38f5343c
modello_v2.json     2bc7141eea2b53c9c2933fed1ed7a46b687be7e5b50b51778469e5038b24b8d3
```

**Il rischio che il ciclo post-gara li ricalibri da solo NON esiste** — verificato:
`auto_gara.py` chiama solo `web/genera_vista_gara.mjs`, che *legge* i modelli e non li
scrive; gli unici script che li scrivono (`banco/scrivi_banda_rientro.mjs`,
`banco/scrivi_esito_multistint.mjs`, `banco/replay_*.mjs`) sono manuali. `autocalibra.py`,
citato in una nota vecchia, non esiste più nel repo.

**Il rischio che resta è umano**: qualcuno rilancia uno di quegli script dopo il 23/08 e
l'Olanda entra nella calibrazione. Il sigillo è quindi una consegna, non un lucchetto:
*fino a misura avvenuta, quei due file non si rigenerano.*

## Cosa si misura, e con quale metro

Le **stesse cinque metriche** del confronto, con lo stesso banco
(`ai_lab/confronto/banco.mjs`), sulle sole soste vere dell'Olanda. Le letture sono già
fissate e non si scelgono dopo:

- **M1** in **lettura B2** (previsione e verità ri-classificate sulla terna comune). È la
  lettura più severa ed è quella che toglie l'artefatto del denominatore, che nel confronto
  valeva tre quarti del vantaggio apparente del nuovo.
- **M5** con il metro del prodotto: banda dichiarata al congelamento contro posizione vera
  al rientro.
- M2 (3/5/10 giri), M3 (minimi interni, giro finale comune), M4 (copertura e valore dei
  casi persi) come da `PREREG_confronto_motori.md`.

## I cancelli, con le soglie scritte adesso

| | cancello | dove sta oggi (in campione) |
|---|---|---|
| **H1** | esatti M1-B2 del nuovo ≥ **40,0%** | 45,3% |
| **H2** | mediana \|errore\| M1-B2 del nuovo ≤ **1,0** | 1,0 |
| **H3** | il nuovo ≥ il vecchio sugli esatti M1-B2 | +2,3 punti |
| **H4** | copertura della banda ≥ **67,3%** — cioè *almeno quanto ha misurato in campione*, non l'88,5% dichiarato | 67,3% |
| **H5** | copertura (casi con risposta) ≥ **90%** | 94,9% |

**H1, H2, H4 sono soglie assolute**: se una cade, il motore fuori campione è peggio di come
si è misurato in casa, e va detto senza attenuanti. **H3 è relativo**: se cade, il vecchio
regge meglio il fuori campione, ed è la notizia più importante che questa gara possa dare.

## Le regole che impediscono di barare dopo

1. **Una gara sola non decide.** Zandvoort è la prima di una serie: ogni gara del 2026 che
   resta entra come nuovo fuori campione, e il verdetto si aggiorna. Un cancello superato
   qui non promuove niente; un cancello caduto qui non condanna niente. Serve la serie.
2. **Nessun taglio scelto dopo.** Le uniche partizioni ammesse sono quelle già usate nel
   confronto: per gara, verde/neutralizzato al congelamento, fascia di posizione. Qualunque
   altro taglio è esplorativo e va etichettato come tale.
3. **Il perimetro è quello di `PREREG_confronto_motori.md`**, esclusioni comprese. Se
   l'Olanda avesse pochi casi ammessi (< 15), l'esito è **NON GIUDICABILE** e si aspetta la
   gara dopo: non si allarga il perimetro per avere numeri.
4. **Prima di misurare** si verifica che i due sha256 qui sopra siano ancora quelli. Se sono
   cambiati, l'esito è **NON GIUDICABILE** e si dichiara perché.
5. Un cancello che risultasse mal specificato si mette a referto e se ne pre-registra uno
   nuovo — non si riscrive dopo aver visto il risultato (E08). Il confronto appena chiuso ha
   avuto **4 metriche su 5 sotto-specificate**: questa è la lezione che questo documento
   prova a non ripetere.

## Cosa questa gara NON dirà

- Non dirà se il motore è **giusto**: dirà se sbaglia fuori campione quanto sbaglia in casa.
- Non dirà niente sul ramo Safety Car se a Zandvoort non ci sono neutralizzazioni al
  congelamento (in campione erano 17 casi su 223: già lì non concludenti).
- Non dirà niente sull'orizzonte lungo: M1 misura a due giri dal congelamento, mentre il
  pannello pubblica una curva che integra fino alla bandiera.
