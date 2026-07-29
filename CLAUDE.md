# CLAUDE.md — MurettoBox, ricostruzione da zero
<!-- Questo file sta nella ROOT del nuovo repo. Claude Code lo legge automaticamente
     a ogni sessione. Ogni agente esecutore lo tratta come legge del progetto. -->

## Missione
Costruire il simulatore di strategia F1 di MurettoBox: l'utente congela la gara
(BOX NOW), sceglie quando e come fermarsi, il motore risponde con posizione di
rientro, curva del "quando conviene", degrado e incertezza dichiarata. Il tutto
sopra un'infrastruttura che si auto-verifica ogni notte contro le gare vere.

**"Da zero" significa: codice da zero. Dati e lezioni si EREDITANO.**
Il vecchio repo (`muretto-box-virtuale`) è l'archivio: si legge, non si copia —
con UNA eccezione: `data/` si importa con manifest di hash. Gli errori già
pagati là sono catalogati qui sotto (§Errori): non si ripagano.

## I 6 dipartimenti → cartelle
| dipartimento | cartella | responsabilità |
|---|---|---|
| 🗄️ Dati & Provenienza | `data/` + `provenienza/` | grezzo importato e pinnato, UNA definizione di verde, contratti dati, cross-check esterni |
| 📐 Physics Lab | `fisica/` (py, stima) + `engine/` (mjs, runtime) | modello del tempo sul giro; la stima produce JSON con targhetta, il kernel li consuma |
| 🧠 Strategy Lab | `scenario/` | costruttore di scenari UNICO, curva del quando, economia SC/VSC |
| 📊 Replay Lab | `banco/` | banchi, golden, sentinelle, corsa notturna; l'arbitro |
| 🛡️ Simulation Director | `scenario/director.mjs` | guardrail runtime sull'OUTPUT prima della pagina |
| 🖥️ UX & Product | `web/` | BOX NOW, targhette, bande, la mappa che non si spegne mai |

Distinzione costituzionale dei due guardiani: il **Director** valida l'output a
runtime (paradossi fisici); il **Banco** valida il codice ai cancelli (nessuna
modifica va online se peggiora i cancelli pre-registrati). Non si fondono.

## Le regole della casa (non negoziabili)
1. **Una definizione, un posto.** Verde, neutralizzato, mescola valida, età
   gomma: ognuna vive in UN modulo; chi la usa la importa, mai la ridefinisce.
   (Il vecchio repo ha pagato il 37% di divergenza replay/live per questo.)
2. **Targhetta obbligatoria.** Ogni numero mostrato o usato porta la sua
   natura: `misurato su questa gara` / `misurato sul fondo` / `modello
   dichiarato` / `prior esterno` — con data e, dove serve, banda.
3. **Prereg e cancelli.** Le metriche si scrivono PRIMA di guardare i numeri.
   Un cancello sbagliato si mette a referto e se ne pre-registra uno nuovo:
   non si riscrive dopo aver visto il risultato.
4. **Sentinelle che escono 1.** Un test che stampa FALLITO ed esce 0 è un
   ornamento. Ogni test dichiara nel commento cosa lo farebbe fallire.
5. **Invarianza al troncamento.** Ogni misura "al congelamento Lf" deve dare
   lo stesso risultato su byLap intero e su byLap troncato a Lf. È la
   definizione operativa di "non sbircia il futuro", e ha una sentinella.
6. **L'assenza è null.** Mai un valore plausibile al posto di un dato
   mancante: un pilota senza passo esce dalla simulazione con null esplicito,
   non resta congelato dentro un numero che sembra vero.
7. **Dati pinnati.** Ogni fonte esterna: commit SHA + hash atteso per file +
   fallimento rumoroso. `data/MANIFEST.sha256` è la verità; niente download
   da branch mutabili, niente validità "size > 1000".
8. **Il kernel esiste in UNA lingua** (JavaScript `.mjs`: è ciò che gira in
   produzione). La statistica in Python va benissimo, ma produce JSON con
   targhetta — non re-implementa mai la simulazione. (Il doppio kernel
   JS+Python del vecchio repo è costato audit di allineamento continui.)
9. **Push a fine sessione, sempre.** Nessun report di sessione senza commit
   sul remoto. (Quattro commit dell'arco precedente sono vissuti settimane su
   un solo laptop.)
10. **Stessa equazione per misura e predizione.** Ciò che si sottrae misurando
    (carburante, deriva) si ri-aggiunge simulando. Mai un passo "a serbatoio
    vuoto" dentro una simulazione a serbatoio pieno.

## Il modello del tempo sul giro (v2, punto di partenza)
```
t(pilota, giro) = base(pilota) + δ·(giro − 1) + ρ·età_gomma
la SOSTA azzera età_gomma (e monta il set nuovo)
```
- Niente sconti costanti perpetui post-sosta (il "gradino per sempre" produce
  "fermati subito" nel 100% dei casi: misurato 718/718 sul vecchio motore).
- Niente cliff di fine vita e niente curve per mescola AL GIORNO 1: nel 2026
  le mescole non separano il degrado (p = 0,209). La separazione per mescola
  è l'ipotesi della Fase 3 sul fondo, con cancello fuori campione.
- L'ottimo teorico a una sosta cade a `(giri rimasti − età)/2`: il banco lo
  usa come verifica analitica dei casi al bordo.

## I numeri che si ereditano (con targhetta)
| grandezza | valore | targhetta |
|---|---|---|
| ρ degrado comune 2026 | 0,0389 s/giro·giro · IC95 [0,0220; 0,0629] | misurato, fondo 2026, bootstrap 2.000, blocchi=gare |
| ρ per mescola | NON separano (SOFT−HARD p = 0,209) | misurato 2026 → ipotesi Fase 3 sul fondo |
| deriva δ | **CONFLITTO APERTO**: storico 3,111 [2,926; 3,254] vs 2026 implicato 2,468 [1,693; 2,908] su 70 kg | i due IC NON si sovrappongono → esperimento decisivo nel PROMPT 03, prima di cablare |
| mediane stint 2026 | SOFT 14 · MEDIUM 19 · HARD 22 giri | misurato — sono DECISIONI dei team, non fisica: in live sono ALLARMI, mai stime |
| bias bersaglio del kernel | ≤ −0,17 s/giro, piatto sugli orizzonti | riprodotto dal vecchio v2: è l'asticella minima |
| pit-loss per circuito | Miami 19,74 · Silverstone 20,95 · Austria 21,48 · Monaco 22,01 · Barcellona 23,83 · Spa 18,4 · Imola 28,1 · Singapore 27,9 · Qatar 27,7 · mediana era 22,1 | prior esterno misurato (2.106 stop 2022-26) — file `data/priors/pitloss_priors.json`; da promuovere a misura interna sul fondo |
| fattori neutralizzazione | pittando sotto SC si paga ~0,50 della perdita verde; sotto VSC ~0,65 | prior esterno con banda (SC 0,40-0,60 · VSC 0,60-0,70) |
| stazionario | tipico 2,5 s · pavimento fisico 1,8 s | prior esterno → Director |
| live, ricostruzione verde track-wide | 84,8% accordo · 65 falsi verdi · 34,1% celle passo oltre 0,10 s | misurato: LIMITE DICHIARATO del live finché non esistono bandiere per-auto |
| OpenF1 | storico 2023+ gratis; realtime a pagamento; `pit_duration` DEPRECATO → `lane_duration`+`stop_duration`; `segments` non in gara | verificato 29/07/2026 su openf1.org/docs |
| regole 2026 | obbligo 2 mescole slick su asciutto; il DRS non esiste più (Manual Override Mode) | regolamento — il Director le codifica |

## Contratti dati
**Vocabolario `status` (per-auto, dall'archivio):** alfabeto `{1,2,4,5,6,7}` —
`2` = gialla, `4` = Safety Car, `5` = bandiera rossa, `6` = VSC (2 e 7 come
regime: ipotesi non committata). Due livelli DISTINTI:
- **regime neutralizzato** (per la logica di gara): contiene `4` o `6`;
- **filtro verde del passo** (per le mediane): nessuno di `2,4,5,6`, giro non
  cancellato (`del`), mescola slick valida (il letterale `"None"` si lava alla
  frontiera), non in-lap, non out-lap.

**Cella per giro (shape unica in tutto il repo):**
`{ lap_time, cum_time, stint, compound, tyre_age, in_lap, out_lap, status, del }`
— `status` e `del` GREZZI viaggiano fino in fondo: le definizioni derivate
(`verde`, `neutralized`) si calcolano nel modulo Provenienza, mai altrove.

## §Errori — il catalogo di ciò che è già stato pagato
Ogni errore: dove è successo → la regola che lo impedisce. Prima di scrivere
codice in un'area, rileggere le voci pertinenti.

- **E01 · Gradino costante per sempre** → "fermati subito" nel 100% dei casi.
  → La sosta azzera l'età; mai vantaggi perpetui. (Regola modello v2.)
- **E02 · Carburante sottratto e mai ri-aggiunto** → −1,48 s/giro di bias.
  → Regola 10: stessa equazione per misura e predizione.
- **E03 · `_neut` cieco a rossa (5) e gialla (2); filtro passo che ammetteva
  gialli/cancellati/bagnati** → 11,4% celle spostate, code = post-sosta.
  → Il vocabolario è legge; il filtro verde è UNO, testato sui casi limite.
- **E04 · Il contratto dati non portava `status`/`del`** → il fix era
  impossibile a valle. → I campi grezzi viaggiano fino in fondo.
- **E05 · `"None"` stringa come mescola** arrivata in pagina. → Lavaggio dei
  letterali alla frontiera, con test.
- **E06 · `simulate` restituiva un cum inventato a chi non aveva passo**
  (errori da 480 s, scoperti solo stringendo il filtro). → Regola 6.
- **E07 · Golden non dichiarati**: `449` cablato, `Math.floor(i/2)`, soglie
  numeriche nelle condizioni di successo. → Le attese viaggiano COI golden.
- **E08 · Metrica G0 mal specificata** (contava come fallimento la risposta
  corretta al bordo). → Prereg della metrica; correzioni solo via nuova prereg.
- **E09 · Test quasi-tautologico** (T6: non aveva potere di fallire). →
  Regola 4: ogni test dichiara cosa lo farebbe fallire.
- **E10 · pinv silenziosa** su disegno a rango non pieno. → Guardie esplicite
  di rango/condizionamento in ogni stimatore.
- **E11 · Pooling fra gare** (contro la regola già scritta). → Blocchi = gare,
  sempre.
- **E12 · Due definizioni di "verde"** → 37% di divergenza replay/live.
  → Regola 1. La più importante di tutte.
- **E13 · TrackStatus di pista spacciato per status per-auto**, con claim
  "conservativa" poi smentito (65 falsi verdi). → Misurare la ricostruzione
  PRIMA di dichiararne il verso; il limite (34,1%) si scrive nel modulo.
- **E14 · La tabella-neutralizzazione veniva dal futuro** (costruita a gara
  finita, usata come se fosse live). → Nei percorsi a congelamento entra solo
  informazione ≤ Lf.
- **E15 · Fuga dal futuro nella finestra post-sosta** (la misura del gradino a
  congelamento leggeva fino a 6 giri dopo). → Regola 5: sentinella di
  invarianza al troncamento per OGNI misura a congelamento.
- **E16 · Un "ottimo" misurato dove il fenomeno non c'era** (cap traffico
  tarato su finestre senza soste). → Misurare sul bersaglio del prodotto;
  un'assenza non è una risposta.
- **E17 · Due fisiche per due risposte adiacenti** (`confrontaPit` senza
  SC/deriva, `evaluatePit` con). → UN costruttore di scenari condiviso.
- **E18 · Loader non pinnato** (branch `main` mutabile, validità = size>1000:
  cache avvelenabile per sempre). → Regola 7.
- **E19 · Due interpreti sullo stesso kernel** (pyc 3.10 e 3.14 dalla stessa
  sorgente). → Ambiente pinnato; meglio: Regola 8, kernel monolingua.
- **E20 · Doppi conteggi al cambio modello** (gradino+deriva; orizzonte legato
  al parametro vecchio; undercut calcolato su un altro numero). → Quando un
  modello ne sostituisce un altro, i pezzi vecchi si spengono INSIEME.
- **E21 · Due misure in conflitto lasciate convivere** (δ: IC disgiunti fra
  due documenti). → Un esperimento decisivo pre-registrato, non una scelta
  silenziosa.
- **E22 · Numeri pubblicati e mai rimisurati dopo un fix** (MAE dell'header
  ottenuti col difetto). → Targhetta con data e condizioni; rimisura o
  etichetta "pre-fix".
- **E23 · Lavoro vissuto solo in locale** (4 commit non pushati per
  settimane; la cartella "vera" era pre-audit). → Regola 9.
- **E24 · Inventario dati incoerente** (8 gare lato Python, 10 nei test JS;
  "Gran Bretagna" con lo spazio che spezza i glob). → Inventario unico
  testato; nomi file senza spazi.

## Cosa NON costruire al giorno 1
- Curve di degrado per mescola (→ Fase 3, cancello fuori campione).
- Modello bagnato (→ fase dedicata: 9.365 giri intermedia + 733 wet, cancello
  = riprodurre il crossover sulle 20 gare bagnate). Selettore Wet: visibile ma
  spento, con targhetta.
- Probabilità di sorpasso/difesa al rientro (il vecchio repo ha misurato che
  il duello non si simula: si riproduce QUANTI cambi, non QUALI). Fase futura
  con propria prereg. E nel 2026 non esiste il DRS: Manual Override Mode.
- Qualsiasi seconda implementazione del kernel.

## Definizione di fatto (Definition of Done, per ogni sessione)
Sentinelle del cancello scritte PRIMA del codice → codice → suite verde →
numeri con targhetta nel report di sessione → commit → **push** → report breve
(cosa è cambiato, cosa è stato misurato, cosa resta aperto).
