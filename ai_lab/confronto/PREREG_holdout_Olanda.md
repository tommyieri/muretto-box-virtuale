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
banda_rientro.json  689e5d8472c1c3aa8e1512d3221cc264c9403c8f7b5ec6524dbbc1cbb2daabb3
modello_v2.json     e87a0c6eeb9e36697d996637e042168a9130b6cf41f594761e50227f07e8d114   ⟵ SCADUTO, vedi sotto
```

> **⚠ RI-FIRMATO IL 02/08/2026, VENTUNO GIORNI PRIMA DELLA GARA — e questa volta il
> controllo l'ha fatto un programma, non la buona memoria.**
>
> Applicando la **regola 4** di questo documento *prima* della gara invece che il giorno
> della gara, `modello_v2.json` **era già cambiato**: da `e87a0c6e…` a `4058e490…`. Due
> commit del 01/08, entrambi successivi alla ri-firma di quel giorno:
> `bfada38` (voce 4 del piano: `min_giri_base` da 8 a 4) e `0952a2d` (E21 chiuso).
>
> **Così com'era, il 23 agosto l'esito sarebbe stato NON GIUDICABILE** — il primo fuori
> campione vero del progetto annullato per contabilità invece che per scienza. Le due
> modifiche sono legittime, sono del 01/08, e l'Olanda resta una gara che nessuno di
> questi numeri ha mai visto.
>
> Gli hash vivono ora in `SIGILLO_holdout.json` in forma **leggibile da un programma**, e
> la sentinella **`s32_sigillo_holdout`** li verifica a ogni giro della suite: dal 02/08 un
> file sigillato che cambia rende la suite rossa **lo stesso giorno**, quando ri-firmare è
> ancora legittimo — non la domenica, quando non lo è più.
>
> Sigillati anche **`pitloss_interno.json`** (è il file che dà a Zandvoort il suo pit-loss:
> 22,382 s, promosso dal cancello A su 85 soste verdi 2021-2025, e **non era sorvegliato da
> nessuno**), `pitloss_priors.json` e `compressione_e_fattori_fondo.json`.

> **RI-FIRMATO il 01/08/2026, poche ore dopo la prima firma, e va detto perché.** Gli hash
> originali (`6f5394c3…` e `2bc7141e…`) sono stati firmati la mattina; nel pomeriggio la
> **voce 1 del piano** ha acceso il rodaggio della gomma nuova e ricalibrato la banda sul
> motore risultante, quindi entrambi i file sono cambiati. **Ri-firmare PRIMA della gara è
> legittimo ed è l'opposto di ri-tarare dopo:** l'Olanda resta una gara che nessuno di
> questi numeri ha mai visto. Ri-firmarli dopo il 23/08 sarebbe la fine dell'holdout, e
> nessuna spiegazione lo renderebbe accettabile.

> **⚠ CORREZIONE, 01/08 — la frase qui sotto era vera quando l'ho scritta e l'ho resa falsa
> io stesso lo stesso giorno.** Il paragrafo diceva che «il rischio che il ciclo post-gara
> li ricalibri da solo NON esiste». Dalla **voce 0** del piano, `auto_gara.py` ri-stima
> `ρ`, `δ₇₀`, `c`, `τ` e la banda a ogni gara nuova — quindi la domenica sera di Zandvoort
> quel rischio sarebbe stato *certezza*, e l'holdout si sarebbe bruciato da solo, in
> silenzio, prima che qualcuno lo misurasse.
>
> **Ora c'è un lucchetto, non una promessa:** `ai_lab/confronto/SIGILLO_holdout.json`.
> Finché è `aperto` e la gara pubblicata è quella sigillata, `auto_gara.py` **salta** il
> blocco di ri-stima del cuore e lo grida nel log; il resto dell'ondata prosegue normale.
> Si chiude misurando l'holdout coi modelli pre-gara e portando `stato` a `chiuso`: dal
> giro dopo la ri-stima riparte da sola e l'Olanda entra nella calibrazione, che è
> esattamente quello che deve succedere — ma **dopo** aver dato il suo verdetto.
>
> Correzione minore nella stessa frase: `autocalibra.py` **non è stato tolto**, vive in
> `ai_lab/scienziato/` ed è chiamato a ogni gara da `gen_modelli_lab.py`. Non tocca i
> modelli del simulatore (solo traffico e degrado del lab), quindi la conclusione reggeva —
> ma la ragione che avevo dato era falsa.

**Il rischio che resta è umano**, e non è cambiato: qualcuno rilancia a mano uno di quegli
script dopo il 23/08, o porta il sigillo a `chiuso` senza aver misurato niente. Contro
l'automazione ora c'è un lucchetto; contro una persona decisa, no.
*Fino a misura avvenuta, quei due file non si rigenerano.*

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
| **H4** | copertura della banda ≥ **67,3%** — cioè *almeno quanto ha misurato in campione*, non l'88,5% dichiarato | 67,3% ⟵ **il riferimento si è mosso: oggi in campione è 83,1%** |
| **H5** | copertura (casi con risposta) ≥ **90%** | 94,9% |

**H1, H2, H4 sono soglie assolute**: se una cade, il motore fuori campione è peggio di come
si è misurato in casa, e va detto senza attenuanti. **H3 è relativo**: se cade, il vecchio
regge meglio il fuori campione, ed è la notizia più importante che questa gara possa dare.

> **⚠ IL RIFERIMENTO DI H4 È SCADUTO, e la soglia NON si tocca.** H4 fu scritta perché
> valesse «almeno quanto in campione», e in campione M5 valeva 67,3%. Oggi M5 vale
> **83,1%** (rimisurato il 02/08). La soglia resta **67,3%**, perché è pre-registrata e
> spostarla dopo aver visto muovere il riferimento sarebbe E08 — ma va letta sapendo che
> **superarla oggi è un'affermazione più debole di quella che H4 voleva fare**. Se il 23
> agosto H4 passa a 70%, il motore fuori campione sarà *peggio* di come si misura in casa,
> pur avendo superato il cancello. Questo va scritto nel referto, non dedotto.

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
