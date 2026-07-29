# PREREG — UNDERCUT v2: fisica-gomma + differenziale di passo-base

**RATIFICATO.** `--attore "Tommi"` (ratifica in chat, 2026-07-22). Decisioni del PO su
tutte e tre le domande aperte della bozza:

| domanda | decisione |
|---|---|
| (a) coefficiente del termine di passo | **fisso a 1**, sola fisica, nessun parametro stimato |
| (b) aggregazione di `α` | **centratura per-gara + mediana** sulle gare precedenti |
| (c) set fuori campione | **Belgio = 0 casi** (misurato, §4) → il prereg nasce **DORMIENTE** |

**Stato: SIGILLATO (v2) E DORMIENTE.** Il nucleo scientifico è versionato in §10: **blocco A**
(§1–§6, ratificato il 22/07) e **blocco B** (§11, GO-5, ratificato lo stesso giorno come
emendamento 1 — stringe, non ammorbidisce). Il blocco A è **byte-identico** fra v1 e v2.
Nessun numero della v2 è stato calcolato al momento del sigillo. **Nessun backtest è eseguibile** finché §6 non
apre il cancello: oggi `|D_new| = 0`. Ordine dei commit obbligatorio: questo file, da solo,
in un commit; qualunque misura nei commit successivi. Se una soglia GO viene ammorbidita
dopo aver visto i numeri, l'ordine dei commit deve smascherarlo (anti-HARKing, come
`data/UNDERCUT_NOTA.txt` e i PREREG esistenti).

## 0. Sommario per il PO (senza codice)

La v1 dell'undercut è NO-GO, e riprodotto: la sola fisica della gomma indovina i casi
scontati (gap piccolissimo o grande) ma sui difficili — dove sta il valore del muretto — fa
+1,2 punti, cioè rumore. La diagnosi della nota di chiusura dice perché: nei casi difficili
conta una cosa che il modello non guarda, **quanto la macchina di chi attacca è più veloce
di suo**. Una Mercedes che undercutta una Racing Bulls parte avvantaggiata a prescindere
dalla gomma; due macchine di pari passo no.

La v2 aggiunge solo questo: il **differenziale di passo-base** fra le due macchine, preso dal
livello per-pilota del modello del laboratorio (lo stesso oggetto che misura il degrado),
ricalcolato fresco — non dalla vecchia tabella `firme_pace`, che è un sottoprodotto scaduto.
Niente di fittato sugli esiti (zero tuning), coefficiente fissato dalla fisica a 1. Il
traffico al rientro resta il cap del motore (il nostro modello è già stato battuto — non si
riapre). La difficoltà-sorpasso non entra (anch'essa NO-GO, il suo CSV è orfano).

La regola dura: si giudica su gare nuove che il modello non ha mai visto — non rigirando gli
stessi 406 casi finché passano. E prima di credere a qualunque miglioramento, si tende la
trappola del placebo: se un differenziale di passo finto (mescolato a caso) indovina quanto
quello vero, allora il "miglioramento" era fabbricato.

**Il fatto che rende questo prereg dormiente.** La bozza dava per disponibile il Belgio come
prima gara fuori campione. Non lo è: il censimento del Belgio **è già stato fatto e
committato** (`f578841`) e dà **zero casi** — otto coppie candidate superano U2–U3, nessuna
sopravvive a U6, perché Spa è stata la gara più neutralizzata delle dieci (15,9% di giri).
Quindi `D_new = 0` oggi, l'Ungheria ne porterà ~2–3 difficili, e il cancello di §6 si apre
realisticamente in autunno. **L'esito atteso onesto non è NULL fra qualche giorno: è
"non giudicabile ancora" per settimane, e il documento serve a proteggere quel silenzio.**
Un vincitore trovato stanotte a forza sarebbe il segnale che qualcosa si è rotto.

<!-- NUCLEO-INIZIO -->
## 1. La domanda falsificabile

Aggiungere alla fisica-gomma il differenziale di passo-base A−B (coefficiente fissato a 1)
aumenta l'accuratezza **sui casi difficili** (gap0 in (1,0; 3,5] s) **fuori campione** (gare
2026 dalla 10ª in poi), rispetto **sia** alla v1 **sia** a un placebo, **senza peggiorare**
i casi facili?

**Ipotesi nulla che deve poter vincere**: no — il differenziale di passo non aggiunge nulla
di robusto sui difficili fuori campione; l'accuratezza resta indistinguibile da v1 e/o dal
placebo.

## 2. Il modello v2 (formula esatta, zero parametri fittati sugli esiti)

Estende `modello_undercut.mjs`. La v1 resta intatta e richiamabile (serve per il confronto
di non-regressione).

```
margine_v1 = Σ_{k=1..K} [ γB·(lifeB_Q − K + k) − γA·k ]  − warmin(comp_A)
margine_v2 = margine_v1  +  COEFF_PASSO · K · Δpasso
Δpasso     = α(B) − α(A)     # α = livello intrinseco per-pilota; >0 quando A è più veloce
COEFF_PASSO = 1.0            # FISSATO dalla fisica, NON stimato. Non è un iperparametro.
```

Previsione invariata: undercut riuscito previsto se `margine_v2 > gap0`. Guardrail di dominio
invariati (null fuori da gap0∈(0,5], K∈[1,4], γ mancante, SC/VSC, input non numerici).
`α` mancante per A o per B (pilota senza giri liberi per stimarlo, o nessuna gara precedente
nel prior temporale) → **null, mai 0**.

**Unità**: `α` è un livello in secondi; `α(B)−α(A)` è una differenza di passo in s/giro.
`K·Δpasso` è in secondi, stessa unità di `margine_v1` e di `gap0`. Per questo
`COEFF_PASSO = 1.0` è la scelta di sola fisica: il vantaggio di passo si somma per ciascuno
dei K giri di sovrapposizione, senza pesi liberi.

**Perché coefficiente fisso e non stimato** (decisione (a) del PO): stimarlo — anche solo
sullo storico — introduce un grado di libertà che, con 10 gare 2026, gonfia la confidenza e
rischia il transfer storico→2026 misurato spesso nullo (Spearman −0,024 sulla
difficoltà-sorpasso). Fissarlo a 1 ci copre. Se il termine vale, deve valere anche senza peso
libero. La stima del coefficiente è fuori da questo prereg (§8).

## 3. Da dove viene `Δpasso` (il livello intrinseco, tire-neutro)

**Fonte**: il livello per-pilota `α` del modello del laboratorio — `mod['alpha'][drv]`,
prodotto da `ai_lab/scienziato/degrado.py::stima` (lo STESSO modello che produce le pendenze
di degrado `rho`/`γ`). `α` è il passo-base fuel-corretto in aria libera; il degrado vive
separato in `rho`.

**Perché NON raddoppia la gomma**: `margine_v1` modella già il differenziale di stato-gomma
nei termini γ. `α` è la parte intrinseca (macchina/pilota), che nel modello del laboratorio è
tenuta distinta dal degrado (`rho`). Sommare `α` non ri-conta la gomma: aggiunge solo ciò che
γ non vede.

**Perché NON `data/firme_pace_2026.csv`**: è un sottoprodotto di `finalize_warmin.py`,
per-team, statica, senza generatore dedicato e non più aggiornata. Non è una tabella pace
mantenuta. `α` dal modello vivo è per-pilota, fresca, ricalibrabile a ogni gara (pattern
modelli-vivi, con targhetta).

### 3.1 Regola di aggregazione — decisione (b) del PO, dichiarata PRIMA

`α` **è stimato per gara** (`degrado.stima` lavora su un blocco = una gara), non su un
insieme. La regola, chiusa qui perché non diventi un grado di libertà a posteriori:

```
α_centrato(drv, gara) = α(drv, gara) − media_{d ∈ piloti di quella gara} α(d, gara)
α_prior(drv, R)       = mediana_{gare G < R} α_centrato(drv, G)
Δpasso                = α_prior(B, R) − α_prior(A, R)
```

- **La centratura per-gara** toglie l'offset di gara (carburante, pista, condizioni), che è
  comune a tutti i piloti di quella gara: senza di essa gli offset entrerebbero nel
  differenziale attraverso la mediana cross-gara.
- **La mediana** (non la media) fra le gare: coerente con l'aggregato di calibrazione del
  laboratorio e robusta al pilota che in una gara ha pochi giri liberi.
- **Invarianza dichiarata**: `α` è identificato solo a meno di uno shift additivo comune
  (condiviso con `delta_mescola`, il modello non ha intercetta separata). La *differenza*
  `α(B)−α(A)` **è invariante** a quello shift, e la centratura la lascia intatta. È la parte
  tecnicamente sana del disegno: `Δpasso` è identificato anche dove il livello assoluto non
  lo è.

**Anti-leakage (temporale causale)**: per un caso nella gara R, `α_prior` usa **solo** le
gare 2026 precedenti a R — ciò che il muretto saprebbe il giorno di gara — riusando l'ordine
cronologico di `ai_lab/scienziato/partizione.py`. Mai la gara sotto giudizio nel suo stesso α.

### 3.2 Limiti dichiarati PRIMA (non scoperti dopo)

- **Deriva intra-gara (H1)**: il livello `α` non è costante dentro la gara — deriva di
  ~0,18 s/giro (`REPORT_PASSOBASE.md`, ipotesi H1 VIVA). Il differenziale ne eredita una
  parte; con l'undercut concentrato in pochi giri l'effetto è di secondo ordine, ma è
  dichiarato. Il raffinamento α-locale è stato **respinto** dal PO perché reintrodurrebbe il
  leakage (userebbe la gara sotto giudizio) e ridurrebbe la copertura.
- **Precedente sfavorevole, a referto**: sul **livello** α le ipotesi H1/H2/H3 di
  `PREREG_passobase.md` sono finite **tutte NULL**, e `run_passobase.py` avverte che il
  livello in aria libera è ~0 per costruzione. Non è un veto — lì la domanda era la
  ricostruzione del tempo di gara, qui è il differenziale fra due macchine, che è una domanda
  diversa — ma chi legge deve sapere che questo oggetto ha già mancato un bersaglio.
- **Copertura di `α`**: `stima()` restituisce α solo per i piloti con abbastanza giri in aria
  libera, e può escludere l'intera gara (`<MIN_GIRI`, "una sola mescola", "rango non pieno").
  Ogni caso senza α per A **o** per B è null per §2. La copertura è quindi un vincolo di
  fattibilità al pari del conteggio dei casi, e §6.0 la pre-registra come tale.

## 4. Dati, partizione, e conteggio fuori campione

**Definizione dei casi invariata** (U1–U7 di `conta_undercut.py`, già ratificata): non si
tocca, per non spostare il bersaglio. Dry-check per gara invariato (Canada resta esclusa:
partenza umida).

- **Fuori campione (decisivo)**: gare 2026 dalla 10ª in poi, una alla volta via
  `python3 conta_undercut.py --gara <nome>` → file separato
  `data/undercut_casi_gara_<nome>.json`.
  - **Belgio (gara 10): 0 casi — MISURATO, non previsto.** 8 coppie superano U2–U3, nessuna
    sopravvive a U6 (Spa 15,9% di giri neutralizzati, la quota più alta del 2026). Il Belgio
    è dentro e contribuisce **zero**.
  - **Ungheria (gara 11, 26/07)**: attesa, non ancora disponibile.
- **In campione 2026 (secondario, non decisivo)**: i 31 casi delle 8 gare, con `α` in
  leave-one-race-out. Contesto; non fa scattare un GO da solo.
- **Storico 2023–25 (contesto)**: invariato, con γ mediane e — coerenza — α storico
  leave-one-race-out. Grezzo, dichiarato, non vincolante.

**Ritmo di accumulo, dichiarato ora** (dai casi già censiti, nessun esito guardato):
2026 = 3,88 casi/gara e **2,62 difficili/gara** sulle gare non SC-dominate; il Belgio mostra
che una gara SC-dominata vale 0. Per `|D_new| ≥ 15` servono **~6 gare pulite** oltre alla
decima. Questo numero è scritto **prima** e non è una soglia: è il preventivo di attesa.

Il conteggio dei casi difficili di ogni gara nuova va pre-registrato **prima** del backtest:
appena una gara entra con `--gara`, si scrive quanti casi e quanti difficili porta, e si
committa, prima di guardare gli esiti.

## 5. Placebo obbligatorio (si tende la trappola PRIMA)

L'undercut è il fenomeno che fabbrica artefatti più facilmente: chi si ferma prima è spesso
già più veloce, quindi il "vantaggio" può essere del passo e non della gomma — è la malattia
McLaren. Aggiungere `Δpasso` come termine la modella; il placebo verifica che non ne fabbrichi
il segno.

- **Placebo**: `Δpasso` con le etichette-pilota permutate a caso fra i casi (il passo esiste
  ma è scollegato dalla coppia reale A–B). ≥ 1000 permutazioni → distribuzione nulla
  dell'accuratezza sui difficili.
- **Condizione dichiarata prima**: l'accuratezza reale sui difficili fuori campione deve
  stare **sopra il 95° percentile** della distribuzione placebo. Se ci sta dentro, il termine
  passo è rumore travestito → **NO-GO del termine**.
- **Sigillo**: il generatore del null è zona a contatto umano obbligato
  (`ai_lab/scienziato/sigillo_null.py`). L'agente **non se lo auto-sigilla** e non tocca
  semi, hash o ordinamenti senza `--attore`: quando il placebo verrà scritto, va portato sotto
  sigillo dal tavolo. Se il campione fuori campione è troppo piccolo per 1000 permutazioni
  sensate, il placebo gira sul 2026 leave-one-race-out ed è marcato **indicativo**, non
  decisivo.

## 6. KPI e regole GO / NO-GO / NULL — dichiarate PRIMA

Baseline onesto invariato: "predici sempre fallito" (≈67–68%; 2 undercut su 3 falliscono).
Sia `D_new` l'insieme dei casi **difficili** (gap0∈(1,0;3,5]) delle gare fuori campione.

**6.0 — Cancello di fattibilità (si valuta per primo, prima di scrivere codice di modello).**
Il backtest è eseguibile solo se entrambe le condizioni valgono:
- `|D_new| ≥ 15`, **e**
- **copertura α ≥ 80%** su `D_new`: cioè in almeno l'80% dei casi difficili nuovi esiste
  `α_prior` per **entrambi** A e B. Sotto quella soglia il modello sarebbe giudicato su un
  sottoinsieme selezionato dai piloti che corrono in aria libera — un campione che non
  rappresenta il fenomeno. I casi senza α restano null e **contano nel denominatore della
  copertura**, mai come previsioni sbagliate né come previsioni giuste.

Finché 6.0 non è soddisfatto: **NULL — non giudicabile ancora**, si accumula e si rigiudica.
NULL non è un fallimento: è il metodo che regge. Nessun backtest, nessuna versione del
modello v2 valutata sugli esiti, nemmeno "per curiosità".

**Quando 6.0 è soddisfatto**, verdetto per tutte le condizioni insieme:

1. **GO-1** (fuori campione, decisivo): accuratezza v2 su `D_new` ≥ maggioranza(`D_new`) + 8 punti.
2. **GO-2** (batte il placebo): accuratezza v2 su `D_new` sopra il 95° percentile del placebo (§5).
3. **GO-3** (batte la v1): accuratezza v2 su `D_new` **>** accuratezza v1 sugli stessi casi
   (il differenziale di passo deve aggiungere, non pareggiare).
4. **GO-4** (LOCO, anti-overfit): leave-one-circuit-out — il guadagno v2 regge su ≥ 2
   circuiti su 3 tenuti fuori.
5. **NON-REGRESSIONE**: accuratezza v2 sui facili ≥ accuratezza v1 sui facili − 2 punti, e
   accuratezza totale v2 ≥ v1.

- **GO** solo se 1–5 tutte vere. **NO-GO** se una decisiva (1, 2, 3 o 4) fallisce con 6.0 soddisfatto.
- **Vincere solo sui facili = NO-GO travestito**, esattamente come in v1. Dichiarato qui
  perché non possa essere riscoperto "a sorpresa" dopo.
- Anche con GO: i quattro campi (undercut, overcut, delta_strategia, aria_libera) restano
  NULL in produzione finché il PO non li accende. Questo prereg produce una **proposta**, non
  un'accensione.
<!-- NUCLEO-FINE -->

## 7. Vincoli costituzionali (checklist)

- **Kernel non toccato.** La v2 vive in `modello_undercut.mjs` + backtest; `engine/engine.py`
  resta bit-identico, golden `test_b` 449/449, `test_pit`, gancio degrado verdi. Se un golden
  diventa rosso, ci si ferma.
- **Traffico = cap del kernel.** Il rientro che tocca traffico usa il cap del motore, non un
  modello nostro (già misurato peggio: +0,176 appaiato, orizzonte 10). Non si riapre.
- **Difficoltà-sorpasso esclusa.** NO-GO; `data/difficolta_sorpasso.csv` è orfano e non
  fidato — non si usa in alcun modo.
- **Pit-loss si elide** (lo pagano entrambi) → il debito P1 non tocca questo modello.
- **Ogni test nuovo protegge, non cementa**: dopo averlo scritto, si rimette il codice
  v1/rotto e si rilancia — se il test non diventa rosso, non testa niente, si riscrive.
- **Nessun push/PR/merge senza autorizzazione del PO.** Questo prereg è ricerca, non produzione.

## 8. Cosa NON è in questo prereg

- La **stima** del coefficiente di passo (fisso a 1 qui). Una v3 potrà stimarlo solo sullo
  storico, pre-registrata a parte, valutata di nuovo fuori campione.
- Il fattore (b), **traffico/difficoltà-sorpasso al rientro**: NO-GO misurato, escluso.
- `delta_strategia` (bloccato da P1 pit-loss) e `aria_libera`: restano NULL, fuori scope.
- L'**accensione in produzione** di qualunque campo: decisione separata del PO.
- Il **raffinamento α-locale** alla finestra dell'undercut: respinto in ratifica (leakage).

## 9. Esecuzione — cosa è lecito fare, e in quale ordine

**Oggi (prereg dormiente), solo questo:**

1. **Ratifica e sigillo**: questo file, in un commit **da solo**, con l'impronta di §10.
2. **Censimento fuori campione già fatto**: Belgio = 0 casi (§4), a referto.
3. **Misura di copertura α** sulle gare 2026: quanti piloti ricevono `α` per gara, e quale
   sarebbe la copertura di `α_prior` sui casi esistenti. **È una misura di fattibilità: non
   guarda il campo `riuscito` di nessun caso.** Va in un commit successivo a questo.

**Quando (e solo quando) §6.0 è soddisfatto:**

4. Costruire `α_prior` causale (§3.1) con `degrado.stima` sulle sole gare precedenti a R.
5. Estendere `modello_undercut.mjs` col termine `K·Δpasso` (COEFF 1.0), v1 preservata.
6. Placebo (§5), portato sotto sigillo dal tavolo. Backtest su `D_new` + secondari.
   Verdetto GO/NO-GO/NULL (§6).
7. `REPORT_UNDERCUT_V2.md` con **la caccia**, non solo l'esito: cosa piantato, i NULL
   motivati, il placebo, i breakdown per gara e per circuito (LOCO).

## 10. Sigillo del nucleo scientifico — VERSIONATO

Il nucleo non è un blocco solo: è una **lista di blocchi sigillati**, ciascuno con la sua
impronta e la sua data. Così una stretta successiva non cancella il sigillo precedente — che
resta verificabile da chiunque rilegga i verdetti nati sotto di esso — e non può nemmeno
riscriverlo di nascosto.

| versione | blocchi | data | atto |
|---|---|---|---|
| **v1** | A (§1–§6) | 2026-07-22 | ratifica iniziale, `--attore "Tommi"` |
| **v2** (corrente) | A (§1–§6) + B (§11, GO-5) | 2026-07-22 | emendamento 1 ratificato, `--attore "Tommi"` — **stringe**, non ammorbidisce |

```
BLOCCO_A_SHA256 = 5791fbc6c317c2333573bd077864a93351c5a11fda5ceee63437b65230187916
BLOCCO_B_SHA256 = 85b4c083e34a93fbe2755380dc643d7ae5ce91faa68959e7b68a7d2e4b816053
```

**Il blocco A non è cambiato di un byte fra v1 e v2**: la sua impronta è la stessa di ieri,
e questo è il punto — GO-5 si aggiunge, non riscrive. Ricalcolabili da chiunque, senza
strumenti nuovi (i marcatori sono ancorati a inizio riga, così i comandi non rimatchano se
stessi e questa sezione resta fuori da entrambi i blocchi):

```bash
awk '/^<!-- NUCLEO-INIZIO -->$/{f=1;next} /^<!-- NUCLEO-FINE -->$/{f=0} f' PREREG_UNDERCUT_V2.md | shasum -a 256
```

```bash
awk '/^<!-- NUCLEO2-INIZIO -->$/{f=1;next} /^<!-- NUCLEO2-FINE -->$/{f=0} f' PREREG_UNDERCUT_V2.md | shasum -a 256
```

Se un'impronta non corrisponde, quel blocco è stato toccato dopo la ratifica: il documento
non protegge più niente e il verdetto che ne discende va considerato non valido.

## 11. EMENDAMENTO 1 — RATIFICATO (`--attore "Tommi"`, 2026-07-22)

**Il blocco A (§1–§6) non è toccato: la sua impronta è identica a quella di v1.** Questo
emendamento è il **blocco B** del sigillo versionato (§10) e non ammorbidisce niente —
**stringe**. È stato proposto e ratificato il 22/07/2026, dopo la sola misura di fattibilità
(§9.3) e **prima che qualunque esito sia stato guardato**: l'ordine dei commit lo dimostra.

**Il fatto che la fa nascere** (generatore: `copertura_alpha_undercut.py`, misure in
`data/copertura_alpha_undercut.json`): sulle coppie A–B reali dei 31 casi 2026, chi attacca è
il **più lento** dei due in **22 casi su 30** (73%). Meccanicamente ovvio a posteriori —
l'auto bloccata dietro è quella che ha motivo di fermarsi prima — ma **ribalta la premessa
narrativa di §0** (la macchina più veloce che undercutta la più lenta). §0 non è nel nucleo:
la storia cade, la formula di §2 resta in piedi.

**Il rischio che apre.** Con `Δpasso` quasi sempre negativo, il termine `K·Δpasso` abbassa
quasi sempre il margine, cioè **sposta la previsione verso "fallito"** — che è già la classe
maggioritaria al 67–68%. Un termine che spinge verso la maggioranza **alza l'accuratezza per
pura aritmetica**, senza aggiungere fisica.

**Perché il placebo di §5 non basta contro questo.** Il placebo permuta le etichette-pilota:
distrugge l'asimmetria sistematica del segno, e la distribuzione nulla di `Δpasso` torna
quasi simmetrica attorno a zero. Il termine vero batterebbe quel placebo **anche se il suo
unico contributo fosse cavalcare il tasso di base**. §5 difende dal segno *fabbricato*, non
dallo spostamento *sistematico*.

<!-- NUCLEO2-INIZIO -->
### GO-5 — controllo a spostamento costante (condizione decisiva, si aggiunge alle 1–5 di §6)

**Il controllo.** Si costruisce `v2_costante`, identica alla v2 ma con `Δpasso` sostituito da
una **costante** `Δ̄` — stesso segno, stessa magnitudine tipica, **zero informazione sulla
coppia specifica**. La v2 deve superare `v2_costante` sui difficili fuori campione. Se non la
supera, il guadagno è tasso di base travestito e il termine è **NO-GO**, anche se GO-1…GO-4
passassero.

**(i) L'insieme su cui si calcola `Δ̄`, dichiarato ora.** `Δ̄` è la **mediana di `Δpasso`
calcolata esattamente sui casi che vengono giudicati**: i difficili fuori campione
(gap0 ∈ (1,0; 3,5]) delle gare 10+ **che hanno `α_prior` per entrambi i piloti**, cioè
l'insieme `D_new` valutato, né uno di più né uno di meno. Non i 31 casi in campione, non i
casi facili, non i casi scartati per α mancante. `Δ̄` è **uno scalare unico** per l'intera
valutazione, non una costante per gara né per circuito. Usa lo stesso `α_prior` causale di
§3.1. Se la valutazione viene ripetuta più avanti con più gare, `Δ̄` si **ricalcola** sul
nuovo `D_new`: è una regola, non una scelta libera al momento del verdetto. Il controllo ha
così esattamente lo stesso vantaggio informativo del modello, tolta la sola cosa in esame —
l'informazione sulla coppia — altrimenti sarebbe un avversario storpiato.

**(ii) Pavimento di rumore — battere non basta, deve battere OLTRE il rumore.** Con `D_new`
piccolo, "v2 fa un caso in più di `v2_costante`" non è un risultato: è il lancio di una
moneta. Il confronto è **appaiato** (gli stessi casi, due modelli), quindi si giudica sui
**casi discordi**: `n₊` = casi in cui v2 indovina e `v2_costante` sbaglia, `n₋` = il
contrario. Perché GO-5 sia superata servono **entrambe**:
> - `n₊ + n₋ ≥ 5` — sotto i 5 discordi nessun esito può raggiungere la soglia sotto, e
>   dichiararlo prima evita di scoprirlo dopo;
> - test binomiale esatto a una coda su `n₊` contro `n₊ + n₋` con p = 0,5 (McNemar esatto),
>   **p ≤ 0,05**.
>
> Lo stesso pavimento si applica al confronto **GO-3** (v2 contro v1) per tutta la durata di
> validità di questo blocco: il blocco A resta byte-identico e la sua soglia non si tocca —
> qui si **aggiunge** una condizione, e aggiungere una condizione può solo rendere più
> difficile passare, mai più facile. Se GO-3 passava per un caso di scarto, adesso non passa
> più: è voluto.

**(iii) Nessuna delle tre regole qui sopra si tocca senza `--attore` e senza una nuova
versione del sigillo (§10).** Se una soglia di questo blocco venisse ammorbidita dopo aver
visto i numeri, la tabella delle versioni e l'ordine dei commit devono smascherarlo.
<!-- NUCLEO2-FINE -->
