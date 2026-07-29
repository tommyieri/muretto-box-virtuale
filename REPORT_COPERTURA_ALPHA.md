# REPORT — copertura e scala del passo-base (cancello 6.0 di UNDERCUT v2)

22/07/2026. Esecuzione di **§9.3** di `PREREG_UNDERCUT_V2.md` (sigillato `ca71de6`, nucleo
`5791fbc6…`). Generatore: `copertura_alpha_undercut.py` → `data/copertura_alpha_undercut.json`.

**Nessun esito è stato letto.** Lo script cancella `riuscito` e `gap_fin` all'ingresso dei
casi: non è una promessa, è una cosa che il codice non può più fare. Nessun margine, nessuna
previsione, nessun confronto v1/v2 è stato calcolato. Il prereg resta **dormiente**.

## 1. Il cancello di fattibilità: superabile

| misura | valore |
|---|---|
| gare 2026 che il modello del laboratorio riesce a stimare | **10 su 10** |
| piloti visti almeno una volta | 22 (mediana 8 gare su 10 a testa) |
| copertura di `α_prior` sui 31 casi 2026 | **96,8%** (30/31) |
| copertura sui 21 casi **difficili** | **100%** (21/21) |
| soglia richiesta da §6.0 | ≥ 80% sui difficili nuovi |

L'unico caso scoperto è il singolo dell'**Australia**, prima gara del regime: nessuna gara
precedente, quindi nessun prior. È il comportamento voluto — null, mai zero.

La copertura misurata è **in campione** e quindi indicativa: il cancello si giudica sui
difficili **nuovi**. Ma dice la cosa che serve sapere oggi: la sorgente del passo non è il
collo di bottiglia. **Il collo di bottiglia resta uno solo: le gare.** `D_new = 0` (Belgio
zero casi), servono ~6 gare pulite.

Per l'Ungheria (26/07) `α_prior` è **già pronto per 22 piloti** sulle dieci gare 2026.

## 2. Il rango di α è credibile, la scala grezza no — e la statistica giusta lo spiega

`α_prior` ordina i piloti così (i primi cinque, poi gli ultimi tre):

```
ANT −1,884 · RUS −1,741 · LEC −1,610 · HAM −1,505 · VER −1,306   …
…   ALO +2,130 · BOT +2,574 · STR +2,941
```

È un ordine di merito plausibile: il segnale c'è. Ma lo **spread grezzo** fra il primo e
l'ultimo è **4,82 s/giro**, che non è una differenza di passo fisica — è α che assorbe i
giri lenti in aria libera dei piloti di coda (l'aria libera se la prendono anche staccati,
danneggiati o in gestione).

Fermarsi lì sarebbe stato un allarme sbagliato. **La statistica giusta non è "due piloti a
caso": le coppie dei casi sono due auto entro 5 s, quindi adiacenti come passo.** Sulle 30
coppie reali:

| | |
|---|---|
| `\|Δpasso\|` mediana | **0,349 s/giro** (media 0,425; max 1,117) |
| `\|K·Δpasso\|` mediana | **0,408 s** (max 2,900) |
| gap0 mediano | 2,67 s |

Il termine vale **~15% del gap tipico**: è una **correzione**, non un padrone. La fisica
della gomma resta al centro, che è la condizione perché la v2 sia ancora la v1 più qualcosa,
e non un modello diverso travestito.

## 3. Il fatto che ribalta la premessa (e apre un rischio non coperto)

**Chi attacca è il più veloce dei due in 8 casi su 30 (27%).** Nella grande maggioranza
degli undercut *tentati* chi attacca è **il più lento**: è l'auto bloccata dietro, quella che
ha motivo di fermarsi prima.

Questo **ribalta la premessa raccontata in §0** del prereg — la Mercedes che undercutta la
Racing Bulls. §0 è fuori dal nucleo sigillato: **la storia cade, la formula di §2 no.** Il
differenziale di passo resta un'informazione che γ non vede; cambia solo il verso in cui, di
solito, spinge.

E qui si apre un rischio che il prereg **non copriva**: con `Δpasso` quasi sempre negativo,
`K·Δpasso` sposta quasi sempre la previsione verso **"fallito"**, che è già la classe
maggioritaria al 67–68%. Un termine che spinge verso la maggioranza **alza l'accuratezza per
aritmetica, non per fisica**. E il placebo di §5 non lo intercetta: permutando le
etichette-pilota l'asimmetria del segno sparisce, la nulla torna simmetrica attorno a zero, e
il termine vero batterebbe quel placebo anche se il suo unico merito fosse cavalcare il tasso
di base. §5 difende dal segno *fabbricato*, non dallo spostamento *sistematico*.

**Proposta**: `§11` del prereg, **GO-5 — controllo a spostamento costante**. La v2 deve
battere anche una `v2_costante` in cui `Δpasso` è sostituito dalla sua mediana sui casi
(stesso segno, stessa magnitudine, zero informazione sulla coppia). Non è ratificata: serve
`--attore`. È una stretta, non un ammorbidimento, ed è scritta prima di qualunque esito —
l'ordine dei commit lo dimostra.

## 4. Cosa resta vietato

Tutto il resto. Niente `margine_v2`, niente backtest, niente "solo per curiosità" sui 31 casi
in campione. Il cancello 6.0 chiede `|D_new| ≥ 15` **e** copertura ≥ 80%: il secondo è a
posto, il primo è a zero. Si aspetta l'Ungheria (~2–3 difficili attesi) e le gare dopo.
