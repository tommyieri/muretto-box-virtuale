# PIANO — andare LIVE con traffico, degrado e undercut

*Redatto 22/07/2026. Mandato del PO: «in live il prima possibile, anche se non è perfetto,
anche se non è preciso. Ottobre non ci va bene.»*

*Ogni numero in questo documento è misurato sui dieci GP 2026 già in repo. Gli script delle
sonde sono in `scratchpad/sonda_*.py`; il riepilogo in `scratchpad/REPORT_SONDE.md`.*

---

## Stato al 22/07/2026, sera

**Fatto oggi** — tutto su branch, niente in produzione, tutte le guardie verdi
(`test_b.mjs` 449/449 · `test_pit.mjs` 11/11 · `test_gradino.mjs` · collettore 14/14):

| | cosa | dove |
|---|---|---|
| ✅ | **l'aritmetica dell'undercut**: orizzonte comune, simulazione dopo la sosta, gradino, soste come lista | `demo/gradino.mjs`, `demo/pitscenario.mjs` |
| ✅ | **la sentinella** che rende rosso il difetto storico se qualcuno lo reintroduce | `demo/test_gradino.mjs` |
| ✅ | **il pannello acceso**: pit-loss e gomma nuova misurati dalla gara, con provenienza e dominio dichiarati | `demo/gara.html` (`GRADINO_ATTIVO`) |
| ✅ | **le prove libere nel fondo**: 22 sessioni, schema identico alla gara | `ingest_ti2026.py` |
| ✅ | **il gancio degrado dei banchi**, che misurava zero esatto | `gen_*_motore.mjs` |
| ✅ | **la sveglia del token OpenF1** disallineata *(riparata, non deployata)* | `live/collector/` |
| ✅ | **le tre verifiche infrastrutturali** | §6-bis |

**Da fare, in ordine di urgenza:**

1. 🔴 **rinnovare il token F1TV — giovedì 23/07** (§6-bis). Senza, venerdì non si registra.
2. 🟡 deploy del fix collettore sul VPS *(decisione PO)*.
3. 🟡 sha256 su `demo/engine.mjs`: oggi la sentinella protegge il file sbagliato.
4. ⬜ il cavo live (§6, venerdì) e lo shadow-run (domenica).
5. ⬜ merge su `main` *(decisione PO: `demo/` è deployato su Vercel al push)*.

---

## §0. La diagnosi, in una frase

> Il progetto non è fermo perché i modelli hanno perso.
> È fermo perché **il motore non sa che fermarsi cambia qualcosa**, e per un anno si è
> misurata statisticamente una cosa che aritmeticamente non esisteva.

Verificato di persona, oggi, sul motore in produzione:

```
pitto al giro 12 -> A = 1102.000000000
pitto al giro 18 -> A = 1102.000000000
DIFFERENZA        = 0.000000000000 s      (anche col gancio degrado ACCESO)
```

`demo/pitscenario.mjs:36` calcola `steps = (pitLap − L) + 1`: la sosta cade **sull'ultimo
giro simulato**. Dopo il rientro non si simula nulla. E `demo/engine.mjs:69` somma
`pit.loss` e prosegue con **lo stesso passo**, su una gomma che **continua a invecchiare**.

Conseguenza: fermarsi è **solo perdita**. Il guadagno da gomma nuova vale zero binario.
L'undercut non è "incerto": è **impossibile per costruzione**. Lo stesso vale per traffico
al rientro, aria libera, overcut, perdita sui primi tre giri — i sei campi che oggi
escono `null` non sono "non ancora implementati", sono **non rappresentabili**.

### Il numero che manca

Misurato su **150 soste verdi / 682 giri post-sosta / 10 gare**:

| | valore |
|---|---|
| gradino di sosta **grezzo** | **−1,04 s/giro** (negativo in 93% delle soste) |
| gradino **netto** (depurato col campo che non si è fermato) | **−1,41 s/giro** (88%) |
| quanto ne modella il motore oggi | **0,00** |

Su due giri di overlap sono **~2,8 s** di undercut che il motore non può vedere.

### Perché il laboratorio non l'ha trovato

Perché ha cercato di **scomporlo** — carburante, mescola, età gomma, evoluzione pista —
e quelle quattro cose sono confuse fra loro. Nessuna, presa da sola, si stima bene:
il ρ del degrado cambia segno fra gare (Canada 24% di pendenze positive, Austria 98%).

Ma **aggregato si misura benissimo**, perché la sosta è una **discontinuità**: un
esperimento naturale. Il gradino netto letto per età della gomma buttata:

| età buttata | n | gradino |
|---|---|---|
| 0–8 giri | 8 | −0,30 |
| 8–14 | 40 | −1,16 |
| 14–20 | 33 | −1,58 |
| 20+ | 56 | −1,50 |

Monotono, fisico, pulito. **È la curva di degrado, letta al contrario dalla sosta** — la
stessa quantità che stimata *dentro* lo stint ha il segno che balla.

---

## §1. Il cancello sbagliato

Il criterio di accensione dei modelli vivi è:

> l'IC95 appaiato dell'errore di **ricostruzione del livello assoluto**, contro il
> modello-zero, su **blocchi = gare** e **fuori campione fra gare**, deve escludere lo zero.

È il criterio giusto per **la ricerca**. È il criterio sbagliato per **il prodotto**, e per
tre ragioni tecniche, non retoriche:

1. **Misura una grandezza che il prodotto non mostra.** Il prodotto non dice mai un tempo
   assoluto (`LIMITI_NOTI.md` lo vieta). Dice *dove rientri* e *quanto cambia se ti fermi
   adesso invece che fra cinque giri*: un **delta fra due controfattuali**.
2. **Boccia i modelli per un difetto che il prodotto non subisce.** Il bias di −1,86 s/giro
   del motore domina il cancello e **si cancella** nel delta.
3. **La numerosità.** Il cancello (B) del degrado ha **3 casi valutabili su 2 gare** contro
   i 30 su 4 richiesti — non ha perso, non ha **materiale**. Sulla stessa base di dati un
   bersaglio a delta genera 6.163 finestre e 34.707 coppie: **tre ordini di grandezza**.

E il criterio a delta **esiste già in repo, è già stato eseguito due volte, ha già
bocciato prima di promuovere** (Fase B: M0 respinto, M1 promosso, BIAS +0,42 → +0,05) ed è
la ragione per cui `SCENARI_ATTIVI = true`. Non è mai stato applicato né al ρ del
laboratorio né al traffico.

### Δ-gate — il cancello del prodotto

| | |
|---|---|
| **popolazione** | tutte le terne (gara, pilota, giro di congelamento) con `pace_base` definita |
| **bersaglio** | Δ osservato = tempo realmente trascorso sui *m* giri verdi successivi, meno `m·pace_base`. **Un fatto del fondo, non un controfattuale.** |
| **metrica** | BIAS del Δ previsto, e MAE contro il modello-zero, appaiati per gara, bootstrap a blocchi |
| **soglie** | **già congelate altrove**: \|BIAS\| ≤ 0,03 s/giro con IC che contiene zero; MAE < zero-model con IC che lo esclude; ≥30 casi su ≥4 gare |
| **falsificazione** | permutare l'età-gomma **dentro** la stessa gara: se il guadagno sopravvive è flessibilità, non fisica |

**La regola d'onestà da incidere subito.** Quando i coefficienti vengono dalla **gara in
corso**, il criterio è in-sample *per quella gara*. Va etichettato per quello che è: non
«me la sono guadagnata», ma **«so ricostruire questa gara»**. Per un prodotto live è
legittimo — non stiamo prevedendo una gara futura — ma va **detto**.

Le sonde di questo piano rispettano la versione causale: ogni stima usa **solo le soste già
avvenute prima** del caso che valuta.

---

## §2. I tre numeri vivi

Tutto ciò che serve si misura **dalla gara che sta correndo**. Niente FastF1 a runtime,
niente storico, niente coefficienti di stagione, nessun verdetto fra gare.

### 2.1 `pit_loss` — la perdita di oggi

`perdita = (t_inlap − passo_stint_che_chiude) + (t_outlap − passo_stint_che_apre)`
— la stessa definizione di `gen_pitloss_engine_ready.py:122`, ma dai **soli tempi sul giro**.

| gara | `realizzato` (FastF1) | sonda (soli tempi) | diff |
|---|---|---|---|
| Austria | 21,98 | 21,98 | **0,00** |
| Australia | 24,10 | 24,31 | +0,21 |
| Gran Bretagna | 20,43 | 20,71 | +0,28 |
| Spagna | 24,59 | 24,30 | −0,29 |
| Belgio | 22,50 | 22,04 | −0,46 |
| Miami | 20,11 | 19,61 | −0,50 |
| Giappone | 22,79 | 23,70 | +0,91 |
| Monaco | 22,61 | 21,60 | −1,01 |
| Canada | 24,24 | 25,26 | +1,02 |
| Cina | 34,51 | 30,59 | −3,92 |

**|diff| mediana 0,48 s** — sotto il pavimento di rumore. Contro il valore di *produzione*
la distanza è 1,11 s: **la misura dalla gara è più vicina al realizzato di quanto lo sia la
produzione**.

**Converge dal 3° stop**, tipicamente **giro 12–21**.

**Il pavimento**: dispersione residua dentro la stessa (gara, squadra) = **0,63 s** mediani,
p90 3,00 s. Sotto quella soglia raffinare non serve a niente. *Questo numero va scritto nel
prodotto*: è la promessa di precisione che possiamo mantenere.

### 2.2 `gradino_sosta` — quanto vale la gomma nuova oggi

Mediana di `passo_post − passo_pre` sulle soste **già avvenute** in questa gara.

Sostituendo il passo piatto con `passo + gradino_live`:

| | MAE | BIAS |
|---|---|---|
| motore di oggi | 1,129 | **+1,063** |
| **+ gradino live** | **0,550** | **+0,253** |

**Errore dimezzato, bias abbattuto del 76%, vince in 9 gare su 10** (perde solo a Monaco,
già dichiarato `CID_NO_DEGRADO`).

E per gara il numero dice qualcosa che il cliente capisce al primo colpo:

| gara | gradino netto | undercut a K=2 giri |
|---|---|---|
| Spagna | −2,03 | **4,07 s** |
| Austria / Gran Bretagna | −1,55 | 3,10 s |
| Belgio | −1,33 | 2,65 s |
| Monaco | −1,16 | 2,31 s |
| Giappone | −0,51 | 1,02 s |
| **Canada** | **+0,23** | **0,47 s → qui l'undercut non esiste, conta la track position** |

### 2.3 `sosta_squadra` — il termine per-pilota

Il pit-loss oggi è **uno scalare per gara, uguale per tutti**. Il termine variabile si
misura senza toccare la base:

```
loss_effettivo(pilota) = pit_loss[gara] + (sosta_squadra − sosta_mediana_gara)
```

Scomposizione (già misurata su 328 stop 2026 dalla cache FastF1 locale):

- **escursione fra circuiti**: 10,98 s
- **escursione fra squadre**: 1,88 s = **17%** del circuito
  — Mercedes −1,30 · Red Bull −1,22 · Ferrari −0,51 · … · McLaren +0,26 · Williams +0,57
- a Spa il termine vale da **−1,3 s (Mercedes) a +1,5 s (Haas)**: **1–2 posizioni al rientro**

**Attenzione, e va scritto:** entry + fermo + exit ricostruiscono il **transito in pit lane**,
**non** il pit-loss del motore (`pit_loss = transito − track_time + warm-in`; a Silverstone
`track_time` vale 8,53 s). Quindi **non si scompone il pit-loss: si scompone lo
scostamento.** La base resta quella di produzione; si aggiunge solo il termine differenziale.
È esattamente ciò che il PO vuole vedere (la differenza fra squadre), ed è l'unica forma
che non rompe niente.

**In diretta**: il transito si cronometra dal booleano `InPit`, già nello stream di eventi —
riproduce la durata ufficiale f1db su **28/28 stop di Spa** (mediana −0,021 s). Poi
`sosta ≈ transito − travel(circuito)`, MAE 0,59 s.

---

## §3. Traffico: il cap resta, ma sappiamo quando morde

Il modello di traffico del laboratorio **ha perso davvero** (appaiato −0,196 s contro il
traffico-zero; il placebo produce una separazione finta pari al **115%** di quella reale).
Non si aggira: **resta il cap del kernel**, che è il campione in carica.

Ma la domanda del prodotto è più stretta — *«esco dietro qualcuno: quanto mi costa?»* — e
lì il dato c'è, misurato sulle soste vere:

| gap dall'auto davanti al rientro | n | costo vs aria libera |
|---|---|---|
| < 0,5 s | 6 | **+0,70 s/giro** |
| 0,5–0,8 s | — | (compreso sopra) |
| **< 0,8 s (incollato)** | **11** | **+0,44 s/giro** |
| 0,8–1,5 s | 18 | −0,04 (nullo) |
| 1,5–3,0 s | 22 | −0,14 (nullo) |
| > 3 s | 101 | riferimento |

E quanto conta: **il 7% delle soste** esce entro 0,8 s, il 19% entro 1,5 s.

Due letture, entrambe utilizzabili subito:
1. **Il traffico al rientro è un effetto raro e tagliente**, non diffuso. Ecco perché un
   modello che lo spalma su tutti gli incontri perde.
2. **`ZONE = 1,5` del kernel è più largo della soglia misurata (~0,8 s).** Non è un bug —
   il cap non è tarabile e lo sweep è piatto — ma è un'informazione da mostrare: sopra
   0,8 s il prodotto deve **tacere**, non stimare.

*(n piccolo: 6–11 casi nelle fasce strette. Va dichiarato.)*

---

## §4. Undercut: mai un verdetto, sempre una quantità

Sui **71 casi veri** del 2026 (A si ferma, B davanti entro 6 s resta fuori 1–6 giri):

- **riuscita reale: 24%** (17/71)
- «dico sempre NO»: 76,1% di accuratezza
- gradino live (`|gradino|·K > gap0`): 78,9% — **+2,8 punti soltanto**

**L'accuratezza è la metrica sbagliata** su un problema sbilanciato 76/24. Quella giusta è
la calibrazione:

| il modello dice | n | riuscite reali |
|---|---|---|
| **RIESCE** | 14 | **57,1%** |
| FALLISCE | 57 | 15,8% |

**Lift 3,6× sul tasso di base.** Per un supporto alla decisione questo è informazione vera.

E il `gap0` da solo è già un discriminante onesto, da mostrare così com'è:

| gap0 | n | riuscite |
|---|---|---|
| 0–1 s | 7 | **71%** |
| 1–2 s | 9 | 11% |
| 2–3 s | 18 | 33% |
| 3–4,5 s | 19 | 26% |
| **4,5–6 s** | 17 | **0%** |

**Regola di prodotto**: il pannello non dice mai *«l'undercut riesce»*. Dice il **margine**,
il **gap**, e il **tasso storico a quel gap**. Il PREREG v2 resta sigillato e intatto: non
stiamo dando il verdetto binario che protegge.

---

## §5. Che aspetto ha il prodotto

> **se fermo LEC ADESSO (giro 23)**
> rientra **P8** fra i 17 a pari giro · *84% entro ±1 a questo orizzonte*
> davanti **LIN +4,6 s** · dietro **HAM −1,2 s** · *±1,6 s a 5 giri*
> pit-loss **22,4 s** · *misurato oggi su 6 soste* (tipico circuito: 21,1)
> la gomma nuova oggi vale **1,3 s/giro** · *misurato su 6 soste*
> **undercut su RUS** (2,7 s davanti): margine **2,6 s su 2 giri** →
>   *storicamente da 2–3 s riesce 1 volta su 3*
> ⚠️ **esci in coda a 3 auto entro 1,5 s**

Ogni riga porta la sua **provenienza** e la sua **banda**. Nessuna riga dice «conviene».

Il vocabolario del «non lo so» esiste già in casa e va riusato tale e quale: gap `null`
sotto SC/VSC, `ok:false` con motivo, scenari invece di previsioni, `[0,0,0]` per la mescola
senza banda.

---

## §6. Il calendario — l'Ungheria è fra due giorni

**FP1 venerdì 24/07 11:30 UTC · gara domenica 26/07 13:00 UTC.**

### Mercoledì–giovedì — l'aritmetica (zero rischio di produzione)

| # | cosa | dove | stato |
|---|---|---|---|
| A1 | **orizzonte comune** — due risposte del pannello finalmente sottraibili | `pitscenario.mjs::confrontaPit` | ✅ **fatto** |
| A2 | **simulare K giri dopo la sosta** (`orizzonte`, default 0 = inerte) | `pitscenario.mjs::evaluatePit` | ✅ **fatto** |
| A3 | **gradino di sosta** in un adapter fuori dal kernel | nuovo `demo/gradino.mjs` | ✅ **fatto** |
| A4 | **test-placebo** — la sentinella | nuovo `demo/test_gradino.mjs` | ✅ **fatto** |
| A5 | **`pit_loss` e `gradino` live** dai soli tempi sul giro | `demo/gradino.mjs::misura` | ✅ **fatto** |
| A6 | aggancio nel pannello, dietro `GRADINO_ATTIVO` | `demo/gara.html` | ✅ **fatto** (acceso su decisione PO 22/07) |

**Guardie verdi dopo le modifiche**: `test_b.mjs` 449/449 · `demo/test_pit.mjs` 11/11 ·
`demo/test_gradino.mjs` tutti i controlli. Il kernel (`demo/engine.mjs`) **non è stato
toccato**; `simulaConSoste(gradino=null)` è verificato **bit-identico** a `simulate(steps)`.

Cosa dice la sentinella, sui dati veri (Belgio, congelamento al giro 18, **solo le 5 soste
già avvenute**): perdita **20,20 s**, gradino **−0,919 s/giro**; fermarsi al 19 invece che al
24 vale **−4,59 s** al giro 29 (= gradino × 5 giri, contabilità chiusa).
E a gradino spento il confronto **dichiara di essere vuoto** invece di restituire uno zero
che sembrerebbe un risultato.

Il kernel non si tocca. I ganci restano **opt-in**: i golden restano bit-identici.
Banco di prova: **il replay di Spa** (61 MB di registrazione SignalR, `--speed 10` rigioca
una gara in 10 minuti). Nessuna domenica da aspettare.

**A4 è il test più importante del piano**: oggi è *rosso* (dà 0) e diventa verde solo
quando il meccanismo esiste. È la sentinella che impedisce di rifare l'errore dell'anno.

### Mercoledì, PRIMA di tutto — le tre verifiche ✅ FATTE 22/07

#### 🔴 1. Il token F1TV è SCADUTO — e senza, venerdì non si registra

```
SubscriptionStatus : active
SubscribedProduct  : F1 TV Access Monthly
emesso             : 2026-07-16T13:22 UTC
scade              : 2026-07-20T13:22 UTC   ← SCADUTO da 2 giorni
```

L'abbonamento **c'è ed è attivo**; è il **token in cache** a essere scaduto, e dura
**esattamente 4 giorni**. Il file `~/Library/Application Support/fastf1/f1auth.json` porta
la data del **19/07 14:53** — l'istante in cui è partita la registrazione di Spa. Ha
funzionato perché il token era ancora vivo; venerdì non lo è più.

Da FastF1 **v3.7.0** il client live usa endpoint nuovi che **non ammettono più accesso non
autenticato**, e il collettore, a token scaduto, **si connette non autenticato** — cioè con
dati parziali e un warning che nessuno sta guardando.

> **Azione, e la deve fare una persona** (è un login, non lo fa Claude):
> rinnovare il token **giovedì 23/07 o dopo**, non prima. Un token preso mercoledì scade
> **domenica ~10:36 UTC, due ore e mezza prima del via**. Preso giovedì copre tutto il
> weekend. Comando: `python3 -c "from fastf1.internals.f1auth import get_auth_token; get_auth_token()"`
> — apre `https://f1login.fastf1.dev?port=N` nel browser.
>
> **E va messo nel runbook**: `live/RUNBOOK_WEEKEND.md` cita il token OpenF1 e **non**
> questo. È il punto singolo di rottura più silenzioso di tutta la catena.

#### 🟡 2. Il collettore restava connesso con un token scaduto — corretto

`/status` del VPS, oggi: `connesso: true` **e** `openf1_token.valido: false` da 36 minuti.

Non erano le credenziali: **due sveglie disallineate**. La riconnessione proattiva era
legata all'uptime della *connessione* (3000 s), mentre `token()` considera fresco il token
fino a 3300 s di età del *token*. Poiché la connessione è sempre più giovane del token, la
sveglia suonava **sempre** prima della soglia di rinnovo: ci si riconnetteva col vecchio
token e poi si restava connessi con un token scaduto fino alla sveglia dopo.

Di per sé non fa cadere la connessione — ma **`/status` mostra rosso**, ed è esattamente il
segnale che il runbook (riga 239) dice di trattare come credenziali rotte. Un falso allarme
in mezzo a una gara è peggio di nessun allarme.

**Corretto** (`ingress_openf1.py`): la sveglia ora è legata alla scadenza vera
(`TokenOpenF1.scade_entro`), con test di regressione (`test_openf1.py`, 14/14).
⚠️ **Il deploy sul VPS è una decisione separata**: qui è solo committato sul branch.

#### 🟢 3. Il ban MQTT era già disinnescato — meglio di come pensavo

Il rischio ban (>10 disconnessioni in 60 s → 10 minuti di buio, visti come
`rc=5 not authorised`, indistinguibile da credenziali sbagliate) **era già gestito, e con
misura**: `reconnect_on_failure=False` (i retry interni di paho sono spenti), backoff
5→60 s, tetto duro **5 CONNECT/60 s** = metà della soglia OpenF1, più un backoff dedicato
di **300 s** sui rifiuti del broker. Il commento in `ingress_openf1.py:50` riporta la
misura del 21/07: coi retry di paho attivi, **una sola caduta produceva 15 CONNECT/minuto**,
da soli oltre soglia.

E la ricerca esterna scioglie il mistero del 20/07 («ore di rifiuti con OAuth sano»):
non eravamo noi. Era il **broker OpenF1**, riparato da br-g il **21/07 alle 09:14 UTC**
(issue #452). *La memoria di progetto che dice «MQTT rotto dal 19/07» è da aggiornare.*

#### Bonus: le chiavi di sessione dell'Ungheria ci sono già

`FP1 11335 · FP2 11336 · FP3 11337 · Quali 11338 · Gara 11342`, e
`/v1/stints` risponde **200 con `compound` non nullo su 51/51** record (la issue #429 non
si riproduce). Resta da verificare **solo a sessione aperta** se il piano copre il *realtime*.

### ✅ Le prove libere sono nel fondo — e non erano mai mancate (fatto 22/07)

**22 sessioni, 3,5 MB, schema IDENTICO alla gara: 39 colonne, zero differenze**, verificato
campo per campo su Belgio.

Ma il pezzo che conta è *perché* mancavano. Il TODO diceva «il per-giro delle prove libere
**non esiste da nessuna parte**». Era vero **solo del nostro codice**:

```python
# prima
.../{urllib.parse.quote(gara)}/{sess}/session_laptimes.json
#                              ^^^^^^  "Practice 1" ha uno spazio -> URL rotto
```

Il nome della sessione non veniva codificato. Ogni richiesta falliva, e lo script stampava
`assente online`. **Diceva che il dato non c'era, quando non c'era la richiesta.**

> **Lezione da tenere, perché costa poco e vale molto**: un messaggio di assenza che non
> distingue *«la fonte non ce l'ha»* da *«non gliel'ho chiesta bene»* diventa, dopo qualche
> mese, una riga di TODO che dichiara impossibile una cosa facile. Ogni `assente` dovrebbe
> portarsi dietro il codice HTTP che l'ha prodotto.

Altre due correzioni nello stesso file: aggiunte **Belgio e Ungheria** all'elenco gare
(mancavano), e i **weekend sprint** — dove esiste solo la FP1 — presi da
`data/calendario_2026.json`, non indovinati.

**Effetto collaterale grosso**: i tre CSV cancellati «perché non ricostruibili dal grezzo»
ora lo sono. Fra questi `tyre_observations`, che è la fonte da cui nacquero i sei numeri del
**warm-in cablati a mano** in `finalize_warmin.py:6` — il debito 10 del TODO.

*Limite che resta: i giri delle libere sono SPORCHI (carburante ignoto, run interrotti,
push e long-run mescolati). Descrivono il venerdì, NON stimano il degrado.*

### Ancora da fare, giovedì

- **sha256 di `demo/engine.mjs`** accanto a quello di `engine.py`. Oggi la sentinella
  protegge il file che **non** gira in produzione: il 21/07 il JS è stato modificato e il
  commit ha potuto dichiarare «Sigillo INTEGRO» in perfetta buona fede.
- **rinnovare il token F1TV** (§6-bis). È l'unica cosa che, se salta, fa saltare il weekend.

### Venerdì (FP1/FP2) — il cavo

- **una riga di verifica**: `curl 'api.openf1.org/v1/stints?session_key=latest'` a sessione
  aperta → risposta sì/no sul realtime. Blocca o sblocca tutto il ramo OpenF1.
- **adattatore live → `{byLap, pace}`**: `pace_base_live.py` è già **bit-identico al kernel
  (2082/2082)**. Manca solo il chiamante.
- **tre innesti da una riga**: giro corrente in `vista_pilota`; gap **numerico** conservato
  invece che formattato in stringa; `compound`/`tyre_age` nei campi della torre.
- **stint_poller** in un thread da 45 s → mescola ed età gomma anche sul ramo OpenF1.

### Domenica (gara) — shadow-run

Tutto calcolato in diretta, **scritto su file, non pubblicato**. È il Gate C già pianificato.
Costa poco e produce l'unica prova che serve.

### Lunedì — il confronto, e la decisione del PO

Osservato contro shadow. Se regge, si pubblica **con le etichette**.

---

## §6-bis. Il rinnovo del token F1TV — istruzioni operative

**Quando: giovedì 23/07, in qualunque momento. Non prima.**
Il token dura 96 ore esatte. Uno preso mercoledì mattina muore **domenica a metà gara**.
Finestra utile: da **mercoledì 17:00** a **venerdì 13:30** (ora italiana).

1. Terminale sul Mac (Cmd+Spazio → `Terminale`).
2. Incolla e invio:
   ```bash
   python3 -c "from fastf1.internals.f1auth import get_auth_token; get_auth_token()"
   ```
3. Stampa `Subscription token is invalid. Please re-authenticate.` — **è giusto**, è il
   vecchio che viene buttato. Poi stampa un URL `https://f1login.fastf1.dev?port=NNNNN`
   (il numero cambia ogni volta).
4. Copia quell'URL nel browser, accedi con l'account **F1 TV Access**.
   ⚠️ **Non chiudere il Terminale**: sta aspettando.
5. Il Terminale scrive `Sign-in successful.`
6. Verifica:
   ```bash
   python3 -c "from fastf1.internals.f1auth import print_auth_status; print_auth_status()"
   ```
   La scadenza deve essere **lunedì 27/07**. Se cade prima di domenica 26 alle 15:00 UTC,
   hai rinnovato troppo presto: rifallo il giorno dopo.

**Solo sul Mac.** Sul VPS `get_auth_token()` aspetta un browser che non esiste e resta
appeso per sempre — è esattamente perché il collettore non lo usa.

| sintomo | rimedio |
|---|---|
| `No module named fastf1` | usa `/opt/homebrew/bin/python3` al posto di `python3` |
| resta fermo senza stampare | `Ctrl+C` e ricomincia dal punto 2 |
| `requires an active F1TV subscription` | l'abbonamento non risulta attivo: da guardare su F1 TV |

**Va messo nel runbook.** `live/RUNBOOK_WEEKEND.md` cita il token OpenF1 e non questo:
è il punto singolo di rottura più silenzioso della catena, e torna **ogni 4 giorni**.

---

## §7. Il censimento completo — grossi, medi, fini

*Ogni voce col suo stato AGGIORNATO al 22/07/2026 e con dove finisce in questo piano.*

### Il principio che le tiene insieme

> **In live abbiamo dati veri: la calibrazione deve stare quasi tutta sulla gara in corso.**
> E il venerdì di libere ci dà già il passo di quel weekend, perché ogni gara ha il suo.

La lettura di dominio del PO — Mercedes davanti, Cadillac e Aston Martin in difficoltà — è
**confermata dal fondo**, non solo plausibile. Scarto mediano dal migliore di ogni gara
(mediana dei giri verdi, il circuito si elide perché il confronto è dentro la gara):

| squadra | scarto | | squadra | scarto |
|---|---|---|---|---|
| **Mercedes** | **riferimento** | | Racing Bulls | +1,85 |
| Ferrari | +0,25 | | Audi | +1,90 |
| Red Bull | +0,59 | | Haas | +2,19 |
| McLaren | +0,61 | | Williams | +2,48 |
| Alpine | +1,69 | | **Cadillac** | **+3,54** |
| | | | **Aston Martin** | **+4,35** |

*Onestà sul numero: è il passo **come corso**, non il potenziale — chi sta in fondo gira
più spesso nel traffico e doppiato, e questo gonfia la coda. L'ordine però è netto e
stabile su 10 gare, ed è esattamente quello che serve al prodotto: un prior di squadra da
correggere col venerdì e poi con la gara stessa.*

**Conseguenza architetturale**: il prior di squadra non va cablato. Va **ricalcolato a ogni
gara** e **corretto dal venerdì** appena le FP arrivano — che da oggi arrivano (§6).

---

## §7A. I GROSSI — decidono la gara

### 1. Pit-loss scomposto — entry · fermo · exit
Non un numero per circuito ma tre pezzi che si muovono in modo indipendente: una squadra
lenta ai box non cambia l'entry del circuito.

**Stato: era il candidato più pesante aperto. Adesso è quasi tutto misurato.**

- **Il livello** si misura dalla gara stessa: `(in-lap − passo prima) + (out-lap − passo dopo)`.
  Riproduce il `realizzato` FastF1 a **0,48 s mediani** su 10/10 gare, contro gli **1,11 s**
  della tabella di produzione. Converge dal **3° stop** (giro 12–21). → §2.1, in produzione
  nel pannello dal 22/07.
- **La scomposizione** è già misurata su **328 stop** dalla cache FastF1 locale:
  travel (entry+exit) stabile dentro la gara (IQR 0,35–0,72 s) e fra stagioni (0,6–1,5 s);
  fermo per squadra da **2,16 s (Mercedes) a 3,42 s (Cadillac)**.
- **In diretta** il transito si cronometra dal booleano `InPit` già nello stream:
  riproduce la durata ufficiale f1db su **28/28 stop di Spa** (mediana −0,021 s).
  Poi `fermo ≈ transito − travel(circuito)`, MAE 0,59 s.
- ⚠️ **Trappola da non ignorare**: entry+fermo+exit ricostruiscono il **transito in pit
  lane**, NON il pit-loss del motore (`pit-loss = transito − track_time + warm-in`; a
  Silverstone `track_time` vale 8,53 s). **Non si scompone il pit-loss: si scompone lo
  scostamento.** Base invariata, si aggiunge solo `(fermo_squadra − fermo_mediano_gara)`.
  A Spa vale da **−1,3 s (Mercedes) a +1,5 s (Haas)** = 1–2 posizioni al rientro.
- **E c'è la spiegazione strutturale di Montreal e Spa**: TUMFTM misura ripartizioni
  opposte per circuito (Monza inlap 2,75 / outlap 17,84; Monaco inlap 14,08 / outlap 2,35).
  Un circuito dove la perdita sta nell'inlap si comporta **all'opposto sotto SC** di uno
  dove sta nell'outlap. Uno scalare non può catturarlo: ecco perché «non entravano mai da soli».
- **Manca**: il generatore `gen_pitloss_scomposto.py` agganciato ad `auto_gara.py`, e il
  termine per-pilota nel motore. *Nessuno dei due tocca il valore di produzione.*
- **Bonus 2026 pubblico**: Hungaroring ~21 s, Spa 18,4, Monaco 19,5, Silverstone 20.
  ⚠️ Sono **transiti**, non perdite nette: non confrontabili alla cieca coi nostri.

### 2. Degrado — quanto la gomma perde per giro
Proprietà della mescola, non della pista (già falsificato: 0 circuiti veri su 8).
Cliff falsificato sui dati 2026: il residuo per età è piatto. Il difetto vero è che
**il segno flippa fra le gare**.

**Stato: spento — e la ricerca esterna dice che nel 2026 è quasi irrilevante.**

- Spread fra mescole 2026: **0,008 s/giro**, contro 0,041 nel 2025 e 0,053 nel 2022.
  Gerarchia **ribaltata**: la HARD degrada più della SOFT. Su 25 giri la differenza fra
  mescole vale **~0,2 s** contro un pit-loss di ~20 s.
- **I cinque NULL non sono un fallimento di metodo**: misuravano con cura una cosa che
  nel 2026 è quasi assente. Il segno che flippa è la firma di un segnale sotto il rumore.
- **Conferma incrociata**: la mia sonda ordina le gare per misurabilità (Austria 98% di
  pendenze positive … Canada 24%) nello **stesso ordine** della misura pubblica
  indipendente (Austria 0,097 … Canada −0,005 s/giro).
- **Il degrado si legge meglio dalla sosta che dallo stint**: il gradino netto per età della
  gomma buttata è monotono e fisico (−0,30 a 0–8 giri → −1,58 a 14–20). La sosta è una
  **discontinuità**, cioè un esperimento naturale; dentro lo stint degrado, carburante ed
  evoluzione sono confusi. → §0.
- **Debito chiuso il 22/07**: i banchi passavano `{rate, age0:0}`, campo che il motore non
  legge → misuravano **zero esatto**. Riparato. Il verdetto «indistinguibile» **regge, ma
  ora è guadagnato**: Δ +0,047 [−0,159, +0,136] a 5 giri, −0,046 [−0,152, +0,323] a 10.
  Segni opposti, IC che contengono lo zero.
- **Resta acceso** ciò che era già acceso: i tre **scenari a banda** nel pannello.

### 3. Traffico al rientro — chi hai davanti e quanto è dura passarlo
Due meccanismi: **durata** dell'incontro (governata dal delta-passo) e **intensità** per
giro (governata dal gap).

**Stato: il cap grezzo del kernel resta il campione in carica — ma ora sappiamo quando morde.**

- Il modello vivo 2026 **perde davvero**: appaiato −0,196 s contro il traffico-zero, e il
  placebo produce una separazione finta pari al **115%** di quella reale. Non si aggira.
- **Misurato sulle soste vere**, il costo del traffico al rientro è **raro e tagliente**:

  | gap dall'auto davanti | n | costo vs aria libera |
  |---|---|---|
  | < 0,5 s | 6 | **+0,70 s/giro** |
  | < 0,8 s | 11 | **+0,44 s/giro** |
  | 0,8–1,5 s | 18 | −0,04 (nullo) |
  | 1,5–3,0 s | 22 | −0,14 (nullo) |

  Solo il **7% delle soste** esce entro 0,8 s. **Ecco perché un modello che spalma il
  traffico su tutti gli incontri perde**: la maggior parte degli «incontri» non costa nulla.
- `ZONE = 1,5` del kernel è **più largo della soglia misurata (~0,8 s)**. Non è un bug (il
  cap non è tarabile, lo sweep è piatto) ma è un'informazione: sopra 0,8 s il prodotto deve
  **tacere**, non stimare. *n piccolo: 6–11 casi, va dichiarato.*
- ⚠️ **Il cap è un incollaggio PIENO** (`STRENGTH=1,0`): chi resta bloccato paga *ogni giro*
  l'intero differenziale e **non sorpassa mai**. Nel test 4b lo stesso undercut riesce in
  aria libera (−1,20 s) e fallisce se rientri in coda (+10,70 s). Va detto al cliente.
- **Contesto 2026 gratis**: 120 sorpassi a Melbourne contro 45 nel 2025 (+167%), e restare
  bloccati costa **un terzo in meno** che nello storico. Contenuto vero, zero modelli accesi.

### 4. Undercut / overcut — il cuore della domanda
**Stato: da NO-GO dormiente a MECCANISMO VIVO (22/07). Il verdetto binario resta chiuso.**

- **La diagnosi vera non era statistica**: il motore non simulava **nemmeno un giro dopo la
  sosta** e non resettava la gomma. Fermarsi al giro 12 o al 18 dava lo **stesso identico
  numero** (0,000000000000 s). L'undercut non era incerto: era **impossibile per costruzione**.
- **Costruito**: orizzonte comune (due risposte finalmente sottraibili), simulazione dopo la
  sosta, gradino di sosta, e `pits` come **lista** — perché la risposta del rivale *è*
  l'undercut. Kernel non toccato, golden bit-identici.
- **La sentinella** `demo/test_gradino.mjs`: due mondi identici → 0 esatto; giri diversi →
  ≠ 0. Era rossa e ora è verde, ed **esce 1** (a differenza dei due test-gancio esistenti,
  che stampano FALLITO e poi escono 0).
- **Sui 71 casi veri del 2026**: riuscita reale **24%**. Il gradino live porta l'accuratezza
  da 76,1% a 78,9% — **+2,8 punti, poco**. Ma la calibrazione è informativa: quando dice
  RIESCE succede nel **57,1%** contro un 15,8% quando dice FALLISCE → **lift 3,6×**.
- **Regola di prodotto**: mai un verdetto. Il pannello dice la **quantità** («serve che
  resti fuori 2 giri»), il **gap**, e il **tasso storico a quel gap** — con il dominio
  dichiarato (gap ≤ 6 s, K ≤ 6): fuori di lì **dice che è fuori dominio**, non calcola.
- Il **PREREG v2 resta sigillato e intatto**: non stiamo dando la previsione binaria che protegge.

### 5. Warm-up gomma — quanto dell'undercut sopravvive alla gomma fredda
**Stato: assorbito nel gradino, e i sei numeri cablati sono finalmente ricostruibili.**

- Il prior storico (SOFT/MEDIUM ~+0,2–0,4 s al primo giro lanciato, HARD leggermente
  negativo) **non è mai stato validato sul 2026**, e il 46% del suo peso sono **letterali
  cablati** in `finalize_warmin.py:6`.
- **Non serve più stimarlo a parte per l'undercut**: il `gradino di sosta` è misurato
  *dopo* l'out-lap, quindi il warm-up è già dentro il numero aggregato — e la contabilità
  del pit-loss (che include l'eccesso dell'out-lap) non lo conta due volte.
- **Sbloccato oggi**: `tyre_observations`, la fonte da cui nacquero quei sei numeri, era
  stata cancellata «perché non ricostruibile». Con le FP nel fondo **lo è**.
- Uso legittimo: correzione di secondo ordine dentro il margine. Illegittimo: presentarlo
  come misura 2026.

---

## §7B. I MEDI — decimi che sommano

### Delta-passo
Non un fenomeno a sé: è **l'ingresso che governa la durata** di ogni incontro di traffico.
La **U rovesciata** — i più intrappolati non sono le auto pari né le lente, ma quelle
**appena più veloci** — è cronometria pura su 46 gare.
**Stato: verificato, validato dall'occhio di dominio. Resta contesto mostrabile**, non entra
nel calcolo (il modello che lo usava non sopravvive al placebo).

### Evoluzione pista
La pista si gomma e diventa più veloce; chi si ferma prima gira su pista meno evoluta.
Si **confonde col carburante** (stesso segno, stessa forma lineare nel giro): per questo il
coefficiente carburante che abbiamo è **un tetto, non una misura pura**.
**Stato: risolta senza modellarla.** Il gradino netto si depura **col campo** — i piloti che
non si sono fermati nella stessa finestra hanno vissuto la stessa pista e lo stesso
carburante. Nessun coefficiente da stimare.

### Peso carburante dinamico
Al giro 18 la macchina è più pesante che al 22: **lo stint nuovo parte più lento**, e questo
entra dritto nel calcolo dell'undercut.
**Stato: il primo piano su cui poggia tutto, e costa molto meno del previsto.**
Il doc dà P1 (ri-aggiungere il carburante) per costoso. **Misurato: non lo è.** Il golden
`test_b.mjs` si muove di **4,55e-12** (tolleranza 1e-9) e `golden_pit` **non cambia una
posizione**. Il banco rigenerato lo conferma cifra per cifra: le varianti F e G hanno errore
relativo **identico** ad A (1,1589 e 2,1846) mentre il bias crolla da −8,64 a −2,10.
Serve solo passare `n_laps` a `simulate`.
⚠️ E il coefficiente è tarato sull'era pre-2026: `3,0/70` contro **2,194** del fondo 2026 e
**1,9–2,4** implicati dal regolamento (70 kg × 0,027–0,034 s/kg). Tre fonti indipendenti.

### Delta termico gomma/asfalto
La stessa mescola degrada diversamente a 40 °C o a 25 °C. **Candidato numero uno** a
spiegare il flip di segno: probabilmente non è rumore, è una variabile che non guardiamo.
**Stato: il dato C'È GIÀ e non l'ha mai caricato nessuno.** `wTT` (temperatura asfalto) è
nel grezzo di **ogni giro di ogni gara**; escursione 2026 da **18,3 a 51,1 °C** fra gare, e
2–6 °C **dentro** ogni gara. `fondo.py:81` non lo carica nemmeno.
È letteralmente una delle «fonti nuove» che la chiusura d'arco ammette — quindi **non è un
sesto sguardo sugli stessi numeri**.
**Primo passo, un pomeriggio**: nuvola descrittiva pendenza-life contro wTT per mescola,
senza p-value e senza chiamarlo modello. Se il flip si allinea alla temperatura **si vede a
occhio**; se non si vede, la domanda si chiude in mezza giornata invece che in una sessione.

### Fasi neutralizzate (SC e VSC)
Enormi e discontinue: una SC dopo la tua sosta regala il pit-loss quasi gratis a chi non si
era fermato. **Caso a sé, non rumore da filtrare.**
**Stato: la soppressione onesta è già in produzione** (gap → `null`, nomi e ordine restano,
flag esplicito). Le finestre reali per-gara esistono.
**Novità dalla ricerca**: il moltiplicatore SC è finalmente **misurato e concorde su due
circuiti indipendenti** — Monaco 12,5/19,5 = **0,64**, Spa 11/18,5 = **0,59**. Sostituisce
il ratio **0,42 orfano** del repo. E le probabilità 2026 sono pubbliche per circuito:
Silverstone 78% SC, Melbourne 75%, Suzuka 50%, Spa 50%, Monaco 43% VSC + 29% SC.
→ **Funzione che nessun prodotto pubblico offre**: *«fermarti ora costa 20 s; aspettare 5
giri ha il 50% di probabilità di farlo costare 12,5»*. L'opzione SC come **valore**.
⚠️ Il VSC del repo è ancora rotto (1,055): non costruirci sopra finché non è risanato.

---

## §7C. I FINI — contano quando il resto è già giusto

| voce | stato e destino |
|---|---|
| **Degrado da spinta** | uno stint gestito dura più di uno spinto, e un modello di sola-vita-gomma non lo vede. **Fuori perimetro dichiarato.** Nel 2026, con lo spread mescole a 0,008 s/giro, è sotto il rumore di tutto il resto. Il `gradino` lo assorbe implicitamente (chi ha tirato butta una gomma più consumata → gradino più grande) |
| **Traffico dei doppiati** | perdite reali ma sporadiche e difficili da attribuire. **Già mitigato**: il pannello ragiona solo fra piloti a **pari giro** (`stessoGiroReale`), e l'undercut su un doppiato non viene nemmeno proposto |
| **Meteo** | di secondo ordine per la sosta, **tranne quando piove — e allora domina tutto**. ⚠️ Il fondo 2026 ha **zero giri bagnati su 11.302**: la variabile non è identificabile. Regola: sul bagnato il sistema deve dire **«fuori perimetro»**, mai estrapolare. Lo storico 2023-25 ha gare bagnate ma è **altro regolamento**: utilizzabile solo etichettato, mai mescolato |
| **Track limits e penalità** | reali ma raramente decisivi per la scelta del giro di sosta. **Già a posto**: race control livello 1 le **mostra** (feed + badge + doppia vista) e non le fa entrare nella simulazione né nei gap. È la scelta giusta e non va cambiata |

---

## §8. Debiti che questo piano scopre e non nasconde

1. ✅ **CHIUSO 22/07 — `{rate, age0:0}` era un campo morto.** `demo/engine.mjs:48` pretende
   `eta`/`eta0` ed è *sicuro per assenza*: le varianti "degrado" dei due banchi misuravano
   **zero esatto** (verificato: `0.000000000 s` con `age0`, `5.373 s` con la forma giusta).
   Il verdetto depositato era **il kernel confrontato con sé stesso**.
   Riparato usando `eta0PaceBase` **esportata** da `demo/pitbande.mjs` — una formula sola,
   non una copia. Artefatti rigenerati (i precedenti sono nello scratchpad).
   **Il verdetto regge, ma ora è guadagnato**: Δ +0,047 [−0,159; +0,136] a 5 giri,
   −0,046 [−0,152; +0,323] a 10. Segni opposti, IC che contengono lo zero: rumore, come
   dev'essere con uno spread mescole di 0,008 s/giro.
2. **`demo/engine.mjs` non ha sentinella** (vedi giovedì).
3. **`test_degrado_aggancio.mjs` e `test_traffico_aggancio.mjs` escono sempre 0**: stampano
   FALLITO e non fermano niente. Una riga per file.
4. **La copertura 43,1% degli scenari è in-sample** (le bande includono gli stint 2026 che
   poi verificano). Il numero fuori campione più vicino è K2 = 43,7%. Vanno riportati
   **affiancati**.
5. **Il warm-in**: 6 numeri, il 46% del peso è letterali cablati in `finalize_warmin.py:6`,
   mai validati fuori campione. Uso legittimo: correzione di secondo ordine dentro il
   margine. Uso illegittimo: presentarlo come misura 2026.
6. **`live.html` promette «col simulatore pit attivo mentre la gara succede»** e non ce l'ha.
   È l'unica riga del sito che viola la regola della casa. Va cambiata oggi, prima di tutto
   il resto.
7. 🆕 **Il token F1TV scade ogni 4 giorni e non è nel runbook** (§6-bis). Scaduto il
   20/07; il collettore, a token morto, **si connette non autenticato** — dati parziali con
   un warning che nessuno guarda. È il punto di rottura più silenzioso della catena.
8. 🆕 **`assente online` non distingue «la fonte non ce l'ha» da «non gliel'ho chiesta
   bene».** È il difetto che ha tenuto le prove libere fuori dal fondo per mesi, con una
   riga di TODO che le dichiarava irrecuperabili. Ogni messaggio di assenza dovrebbe
   portarsi dietro il codice HTTP che l'ha prodotto.
9. 🆕 **La sveglia del token OpenF1 era disallineata** (riparata, non ancora deployata):
   riconnessione a 3000 s di *connessione* contro rinnovo a 3300 s di *token* → si restava
   connessi con un token scaduto, e `/status` mostrava un rosso che il runbook dice di
   trattare come credenziali rotte. **Il deploy sul VPS è una decisione separata.**

---

## §8-bis. Che cosa dice il mondo fuori (e che cosa ci ribalta)

Ricerca esterna, 22/07. Tre conferme forti e **una priorità ribaltata**.

### Conferma 1 — la forma è lineare, e basta

`TUMFTM/race-simulation` implementa quattro forme (lin, quad, cubic, ln) e **tutti i piloti
in tutti i file parametri usano `lin`**: `t = k0 + k1·età`, con `k1` fra 0,010 e 0,088 s/giro.
Lo stesso in arXiv 2512.00640 (state-space bayesiano su FastF1): HARD 0,054 s/giro
[0,004–0,133], MEDIUM 0,060 [0,009–0,120]. **Nessuna fonte pubblica usa un cliff.**
Il rigetto del cliff già a referto nel repo è allineato allo stato dell'arte.

### Conferma 2 — la sonda del degrado combacia con la misura pubblica

Degrado 2026 misurato su 9 GP asciutti, per circuito:
**Austria 0,097 · Miami 0,060 · Monaco 0,050 · GB 0,044 · Giappone 0,042 · Australia 0,030
· Cina 0,022 · Canada −0,005** (l'evoluzione pista domina).

La mia Sonda C, indipendente, ordina le stesse gare per quota di pendenze positive:
**Austria 98% · GB 96% · Belgio 85% · Spagna 78% · Miami 61% · Giappone 57% · Australia 52%
· Monaco 41% · Cina 34% · Canada 24%.** Stesso ordine agli estremi, Canada ultimo in
entrambe. **Conferma esterna indipendente.**

### Conferma 3 — il carburante 2026

Regolamento: **70 kg** (da 110). Sensibilità massa TUMFTM 0,027–0,034 s/kg → **1,9–2,4 s**.
Il `FUEL_COEFF = 3,0/70` del kernel è pre-2026; il fondo 2026 dice **2,194**. Terza fonte
indipendente che dice la stessa cosa. **P1/P2 non sono un capriccio.**

### ⚠️ La priorità ribaltata — nel 2026 il degrado quasi non c'è

| stagione | spread del degrado **fra mescole** |
|---|---|
| 2022 | 0,053 s/giro |
| 2023 | 0,011 |
| 2024 | 0,043 |
| 2025 | 0,041 |
| **2026** | **0,008** |

E la **gerarchia è ribaltata: la HARD degrada più della SOFT** (SOFT 0,063 · MEDIUM 0,065 ·
HARD 0,071). Su 25 giri la differenza fra mescole vale **~0,2 s** contro un pit-loss di ~20 s.

**Lettura**: i cinque cancelli e i cinque NULL sul degrado non sono un fallimento di metodo.
Stavano misurando con enorme cura una cosa che **nel 2026 è quasi assente**. Il segno che
flippa fra gare è esattamente ciò che si osserva quando il segnale è più piccolo del rumore.

**Conseguenza sul piano**: nel 2026 l'undercut è governato da **pit-loss + out-lap +
traffico**, non dal degrado. Il `gradino di sosta` misurato (−1,4 s/giro) è quindi
prevalentemente **carburante bruciato + gomma fresca (non de-gradata)**, non differenza di
mescola — ed è un'altra ragione per **misurarlo aggregato invece di scomporlo**.

### Il pezzo che spiega Montreal e Spa

TUMFTM scompone il pit-loss in **inlap + fermo + outlap**, ciascuno con variante
verde/FCY/SC. E la ripartizione **cambia radicalmente per circuito**:

| circuito | inlap | outlap | fermo |
|---|---|---|---|
| Monza | 2,75 | **17,84** | 1,9 + squadra |
| Yas Marina | 1,55 | **18,05** | idem |
| **Monte Carlo** | **14,08** | 2,35 | idem |

Un circuito dove la perdita sta quasi tutta nell'**inlap** si comporta in modo **opposto**
sotto SC rispetto a uno dove sta nell'**outlap**. **Uno scalare non può catturarlo** — ed è
la spiegazione strutturale del perché Montreal e Spa «non entravano mai da soli».

Il termine per-squadra pubblico: base 1,9 s + addendo 0,434 (Mercedes) – 1,374 s.
Tempi fermo 2026 (DHL, migliore per gara): **2,00–2,30 s**; deficit medio a Suzuka con
Ferrari a zero: Mercedes +0,183 · McLaren +0,520 · Alpine +0,963 · Red Bull +1,034.

### Il moltiplicatore SC, finalmente misurato

| circuito | pit-loss verde | sotto SC/VSC | rapporto |
|---|---|---|---|
| Monaco | 19,5 | 12,5 | **0,64** |
| Spa | 18,5 | ~11 | **0,59** |

Due circuiti indipendenti che concordano su **~0,6**. Il repo ha un ratio **0,42 orfano**:
questo lo sostituisce con qualcosa di verificabile.
E le probabilità di neutralizzazione 2026 sono pubblicate per circuito:
**Silverstone 78% SC · Melbourne 75% · Suzuka 50% · Spa 50% · Monaco 43% VSC + 29% SC.**

→ **Funzione di prodotto che nessuno offre**: *«fermarti ora costa 20 s; aspettare 5 giri ha
il 50% di probabilità di costarne 12,5»*. L'opzione SC come **valore**, non come rumore.

### ⚠️⚠️ Rischio infrastrutturale non registrato nel repo

1. **FastF1 v3.7.0 (27/11/2025): il client live richiede un abbonamento F1TV.**
   «the livetiming client now uses a new endpoint and protocol»; i nuovi endpoint **non
   consentono più accesso non autenticato**. Confermato indipendentemente da `undercut-f1`:
   *«Since the 2025 Dutch GP, the F1 Live Timing feed no longer freely publishes some of the
   data»*. **Questo mette in dubbio anche il piano B del relay dal Mac.**
2. **OpenF1 live NON è gratuito.** Community = solo storico. **Sponsor 9,90 €/mese** = live
   REST + MQTT + WebSocket, latenza dichiarata ~3 s. *(Le credenziali in `~/.openf1.env`
   suggeriscono che il piano ci sia già: da confermare.)*
3. **Trappola operativa MQTT**: max 10 connessioni; **più di 10 disconnessioni in 60 s →
   ban automatico di 10 minuti**, che il client vede come `rc=5 not authorised` — cioè
   **indistinguibile da credenziali sbagliate**. Rimedio: backoff esponenziale da 1 s con
   tetto 30–60 s e jitter.
4. **MQTT: la rottura del 19/07 è REALE ma già RISOLTA il 21/07 alle 09:14 UTC**
   (issue br-g/openf1 #452). *La memoria di progetto va aggiornata.*
5. **OpenF1 issue #429: l'endpoint `/stints` è INCOMPLETO** — 27 record su 70 attesi,
   `compound` null. Riguarda direttamente `stint_poller`.

### Benchmark esterni contro cui tararsi

- **undercut a Spa: 71% di successo su 5 stagioni** — l'unico KPI pubblico di undercut.
  *(Popolazione diversa dalla mia 24%: la mia conta ogni caso in cui A si ferma e B entro
  6 s resta fuori, la loro presumibilmente i tentativi strategici veri. Va confrontata con
  cura, non citata a vanvera.)*
- **AWS F1 Insights «Pit Strategy Battle»**: gap previsto dopo che entrambi si sono fermati
  + **percentuale** di riuscita, inferenza < 500 ms. È il termine di paragone del prodotto.
- **2026: 120 sorpassi a Melbourne contro 45 nel 2025 (+167%)** — conferma esterna che il
  costo del traffico è crollato, esattamente come dice la nota interna («1/3 in meno»).

### Pit-loss 2026 pubblico — ma attenzione alla definizione

Spa 18,4 · Monaco 19,5 · Silverstone 20 · Melbourne 21 · Austria 21 · **Hungaroring 21** ·
Suzuka 23.

**Non sono confrontabili alla cieca con i nostri.** Quelli pubblici sono in larga parte il
**transito in pit lane**; i nostri (e la mia sonda) sono la **perdita netta contro un giro
normale**. Coerenza: Spa transito 23,15 − `track_time` 4,57 = **18,58**, che combacia col
pubblico 18,4. Le due grandezze **vanno tenute separate e etichettate**, mai mescolate.

---

## §9. Il principio, per quando questo piano invecchierà

> **Il muretto non prevede la Formula 1. Tiene la contabilità della gara che sta correndo,
> e lascia al cliente esplorare i controfattuali dallo stato attuale.**

Da qui discende tutto: perché il gradino si misura invece di scomporlo, perché il cancello
è sul delta e non sul livello, perché il pit-loss parte dal tipico e si stringe a ogni
sosta, e perché ogni riga del pannello porta con sé da dove viene e quanto vale la sua
banda.
