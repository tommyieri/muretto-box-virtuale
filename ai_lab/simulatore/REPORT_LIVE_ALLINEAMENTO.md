# REPORT — l'allineamento del live: metà chiuso, metà misurato e dichiarato

*28/07/2026. Debito aperto da `REPORT_AUDIT_KERNEL.md` §7: «replay e diretta ora misurano il
passo in due modi diversi».*

**In una riga:** la **definizione** è unificata e il percorso archivio riproduce il kernel
**11.506 su 11.506**. Il percorso **diretta no**: il feed manda un `TrackStatus` di sessione,
non lo status per-auto, e ricostruirlo da lì lascia il **34 % delle celle di passo oltre 0,10 s**
dall'archivio. **Non dichiaro la diretta allineata.**

---

## 1. Il guasto, misurato prima di toccarlo

`live/pace_base_live.py` aveva la **sua copia** della definizione di «giro verde». Finché era
uguale a quella del kernel nessuno se ne accorgeva; l'audit ha corretto il kernel e le due si
sono separate. La validazione che il modulo già conteneva l'ha misurato subito:

```
PRIMA:  1288 / 2053 confronti (L, pilota) combaciano   ->  765 diversi (37%)
```

Il replay e la diretta rispondevano alla stessa domanda con **due numeri**. È esattamente il
guasto che `demo/muretto.mjs` era nato per impedire — *«due copie della stessa risposta è il
modo più sicuro di ritrovarsi con due numeri diversi e nessuno che sa quale credere»* —
ricomparso un piano più sotto: nella **misura** invece che nella risposta.

## 2. Cosa è chiuso

**La definizione sta in un posto solo**, `pace_base_live.verde()`, gemella di
`engine/engine.py::_verde`. Chi la usa porta i campi; il modulo non indovina.

```
DOPO:   11.506 / 11.506 confronti combaciano, su tutte e 11 le gare 2026
```

Le due fonti dicono la stessa cosa in modo diverso, ed è dichiarato nella firma:

| fonte | come dice «questo giro era verde» |
|---|---|
| **archivio** | `status` per-auto-per-giro, verde = `'1'` esatto |
| **diretta** | `giro_verde`, ricostruito dal collettore (§3) |

Chi non ha né l'uno né l'altro **non entra**: l'assenza di prova non è prova di verde. Stessa
regola per la mescola ignota — il kernel la rifiuta, e ora anche il live.

**`live/test_fase1.py` è stato aggiornato**: codificava la semantica vecchia (bastava «non
neutralizzato, no in/out-lap»), cioè proprio il difetto chiuso dall'audit. Un test che protegge
il comportamento sbagliato non è una guardia, è un lucchetto. Ora sorveglia anche i criteri
nuovi — gialla, giro cancellato, gomma da bagnato, mescola ignota — e il canale `giro_verde`
della diretta. **14/14 casi passati.**

## 3. Cosa NON è chiuso, e quanto vale

Il collettore ora ricostruisce `giro_verde`: un contatore avanza ogni volta che la pista smette
di essere `AllClear`; un giro è verde se il contatore non è avanzato mentre lo si percorreva.
Valori osservati sul feed: `AllClear`, `Yellow`, `SCDeployed`, `VSCDeployed`, `VSCEnding`.

**Misurato contro l'archivio** sulla gara d'Ungheria registrata il 26/07, 827 giri:

| | |
|---|---|
| accordo con lo status per-auto | **84,8 %** |
| **falsi verdi** (live dice verde, archivio no) | **65** — *il verso pericoloso* |
| scartati in più (live no, archivio sì) | 61 — il verso prudente |

E sul **passo**, che è la grandezza che il prodotto usa davvero:

| | |
|---|---|
| celle identiche | 32,7 % |
| scarto mediano | 0,0369 s |
| **oltre 0,10 s** | **34,1 %** |
| oltre 0,50 s | 69 |
| massimo | 2,404 s |

### Una mia affermazione sbagliata, corretta

Avevo scritto nel codice che la ricostruzione è *«CONSERVATIVA: scarta qualche giro pulito, non
ne ammette di sporchi — è il verso giusto in cui sbagliare»*. **La misura lo smentisce**: 65
falsi verdi contro 61 scarti in più. Sbaglia in tutti e due i versi, quasi in parti uguali.
Il commento è corretto in `live/decoder.py` e riporta i numeri invece della speranza.

### Perché non si chiude con una riga

`TrackStatus` è della **pista**, lo `status` dell'archivio è dell'**auto**. Una gialla di
settore locale non produce nessun TrackStatus track-wide: da qui non si vede. E chi ha già
superato il punto dell'incidente corre verde mentre la pista è gialla — è la stessa divergenza
già misurata in `REPORT_NEUTRALIZZAZIONE` (691 giri-auto, 1,7 %), che qui pesa molto di più
perché entra nel filtro invece che nella sola etichetta.

**Chiuderlo davvero richiede le bandiere di settore per-auto**: sapere in quale settore era
ciascuna macchina quando la gialla era esposta. È un'indagine a sé, con la sua
pre-registrazione, non una riga di codice.

## 4. Il verdetto, senza sconti

| | stato |
|---|---|
| definizione unica del giro verde | ✅ **chiusa** |
| percorso **archivio** allineato al kernel | ✅ **11.506/11.506** |
| test che sorveglia i criteri nuovi | ✅ 14/14 |
| percorso **diretta** allineato al replay | ❌ **no, e quanto no è misurato** |

Il campo `giro_verde` è **strettamente meglio** del filtro precedente: prende Safety Car,
Virtual Safety Car e bandiere rosse, cioè i regimi grossi, che prima passavano solo se
qualcuno aveva marcato `neutralized`. Va tenuto. Ma **non basta a dire che la diretta e il
replay misurano il passo allo stesso modo**, e dirlo sarebbe la bugia comoda di questo arco.

## 5. Conseguenza per la pubblicazione di Fase 1+2

Nessuna, e va detto perché è la domanda che ha aperto questo lavoro.

Il pannello (`demo/muretto.mjs`) è **già condiviso** fra replay e diretta: la *risposta* è la
stessa funzione. Quello che diverge è l'**ingresso** — il passo misurato dal feed. Fase 1 e
Fase 2 vivono nel pannello, quindi pubblicarle non allarga questa divergenza: la eredita, come
la eredita oggi.

**Il residuo va dichiarato in pagina quando il muretto in diretta debutta**, non prima: oggi il
pannello live non è ancora acceso in produzione (`COSA_DEVO_FARE_IO.md` §6: *«il pannello pit
resta sul replay»*).

---

### Riprodurre

```bash
python3 live/pace_base_live.py $(ls demo/data/*.json | grep -vE 'manifest|pitloss|calendario')
cd live && python3 test_fase1.py
```
