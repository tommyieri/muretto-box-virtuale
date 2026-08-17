# Report — riattivazione di `live/`: due prove, e `live/` NON è dichiarato pronto

**Data: 17/08/2026.** Il modulo `live/` è fermo dal 18/07: ultima registrazione utile il
26/07, Fase 1 e 1B chiuse a luglio, un mese di lavoro sul kernel nel mezzo. La direttiva era:
*«riattiva `live/` con una prova replay e una prova su sessione nuova **prima di dichiararlo
pronto**»*.

Le due prove sono state fatte. **La prima passa in pieno. La seconda no.** Quindi qui non c'è
una riattivazione: c'è un referto e tre difetti nominati, di cui **uno è del modulo**.

---

## 0 · Prima delle prove: il verificatore non c'era

`FASE1B_PREREG.md` dichiara fra i vincoli: *«Script di verifica **TRACCIATI**:
`live/verifica_gara.py`»*. Quel file **non era in `main`**. Il commit `8c4eaec`
(«ripulitura: via 136 file di archi chiusi», 20/07) lo ha cancellato **lasciando in repo il
suo prodotto**, `data/live_derived/kpi_fase1b.json`, che è tracciato.

Un artefatto tracciato senza generatore è la voce 9 del TODO, già censita e già pagata una
volta. Qui era peggio del solito: **il file cancellato era la prova che i KPI di Fase 1B sono
veri.** Senza di lui la domanda «`live/` funziona ancora?» non è nemmeno formulabile.

Ripristinato da `1236ff7` (byte identici alle copie sopravvissute nei worktree, md5
`1ad4ece4…`), con una sola differenza: **la gara non è più cablata in tre costanti**. Serviva
per la seconda prova, ed è il minimo cambiamento che la rende possibile.

**E non era il solo.** Cercando i suoi compagni ho trovato che quella ripulitura ha portato via
**altri tre script di `live/`** che i report di luglio citano come prova:

| file assente da `main` | cosa dimostrava | il suo prodotto |
|---|---|---|
| `live/verifica_kpi3_f1db.py` | il KPI 3 di Spa **chiuso GO** con f1db v2026.10.0 (22/22 piloti, giro ±1 28/28) | `kpi3_f1db.json` ✅ tracciato |
| `live/inpit_geometrico.py` | `in_pit` geometrico, K=3 · D=5 m, 30/30 col timing | — |
| `live/costruisci_corridoio.py` | i corridoi pit per-circuito | `pitlane_ungheria.json` ✅ tracciato |

Va detto per correttezza, perché cambia una frase di questo report: **il KPI 3 di Spa non è
rimasto rinviato.** Fu chiuso GO la sera stessa, quando f1db rilasciò la tabella pit — solo
che lo script che lo dimostra non è più in `main`, e il suo esito sopravvive come JSON orfano.
Nella tabella del §1 resta «rinviato» perché è ciò che dice il percorso di Fase 1B *oggi
eseguibile*; la chiusura è quell'altra misura, e non la si può più rifare da qui.

## 1 · Prova replay — GO, e riproduce luglio riga per riga

Registrazioni di Spa (in campione: sono quelle su cui i KPI furono pre-registrati).

| | 17-19/07 | oggi | |
|---|---|---|---|
| KPI 1 decoder FP2 | 24.476/24.476 · 22 auto | **identico** | GO |
| KPI 2 ordine FP2 | best 20/22, ordine no | **identico** | NO-GO *(già a referto: l'arbitro FP include i giri cancellati, il feed li revoca)* |
| KPI 3 frequenza | mediana 3,825 Hz | **identico** (3,821–3,826) | report |
| KPI 4 allineamento | 97,7 % entro 15 m, identità | **identico** | GO |
| KPI 5 GPS↔InPit | 98,97 % (96/97) | **identico** | GO |
| **Fase 1B gara** | 4 GO + KPI 3 rinviato | **4 GO + KPI 3 rinviato** · 70.223/70.223 righe | GO |

**Nessuna regressione in un mese**, e in senso letterale: rigenerati con il codice di oggi,
`kpi_fase1.json`, `verifica_allineamento.json`, `pitlane_spa.json`, `transform_spa.json`,
`spa_2026_fp2_xy.svg` e `spa_2026_race_xy.svg` sono **bit-identici** a quelli committati a
luglio (`git diff` vuoto su tutti e sei). L'unico file che cambia è `kpi_fase1b.json`, e le tre
differenze sono spiegate e nessuna è un difetto:

- `auto_nei_position_frame` **23 → 22**: il trasponder 242 (safety car) non è più in `cars` ma
  in `extra_cars`. È la politica dichiarata in `FASE2_PREREG` (`replay.py:103-105`), non una
  perdita;
- `eventi`: due tipi **nuovi** (`driver_list`, `lap_count`) e `timing_update` 23.423 → 51.457,
  perché lo stato emette anche compound e età gomma (Fase C). `position_frame` è **identico**
  (22.513): il cuore del decoder non si è mosso;
- `kpi3.stop_per_auto`: stesso insieme di giri, ordinato.

## 2 · Prova su sessione nuova — 2 GO, 3 NO-GO

Fuori campione: **gara d'Ungheria del 26/07**, mai misurata, **circuito diverso**,
registrazione in **due parti** (percorso multi-file mai esercitato su dati veri: a Spa il file
era unico).

Arbitro **generato**, non trascritto: `live/arbitro_da_registro.py` costruisce classifica,
soste per-pilota e cronaca delle neutralizzazioni da `arrivi_2026.csv`,
`race_control_2026.csv` e dal grezzo TI. Nessuna fonte passa dalla registrazione: il replay
non può avere ragione per costruzione. **Controprova del generatore**: sul Belgio riproduce la
cronaca congelata a mano il 19/07 (SC giro 1-4, VSC 18, VSC 20-21) — le stesse tre finestre.

| KPI | verdetto | |
|---|---|---|
| 1 replay end-to-end | **GO** | 79.483/79.483 righe, 0 eccezioni, 22/22 auto, 4 tipi di evento, due parti unite senza un doppione |
| 2 classifica finale | **NO-GO** | vedi §2.1 |
| 3 pit stop | **NO-GO** | 17/19 esatti (0,8947 · soglia 0,95) — vedi §2.1 |
| 4 GPS↔corridoio pit | **NO-GO** | 2/45 (0,0444) — vedi §2.2, **e questo è del modulo** |
| 5 neutralizzazioni | **GO** | la VSC dei giri 56-57 trovata, zero falsi positivi |

**Il KPI 3 è misurato per la prima volta.** A Spa era RINVIATO per assenza dell'arbitro; con
le soste per-pilota disponibili ha finalmente un gate, e lo manca di **un pilota su
diciannove**.

### 2.1 · Due NO-GO sono della REGISTRAZIONE, e si dimostra

Le due parti coprono 12:41→13:31 e 13:35→14:33. `inspect_recording.py` dice «nessun gap > 10 s»
su entrambe — **perché guarda un file alla volta, e il buco è FRA i due file**.

Ricostruendo il `LapCount`, i giri **mai presenti** nella registrazione sono:

> **21, 22, 23** (il buco di 3 min 33 s) e **65, 66, 67, 68, 69, 70** (la coda troncata).

Da qui, in modo verificabile:

- **KPI 2**: il vincitore chiude a **63 giri** e il `LapCount` a **64**, contro i 70
  dell'arbitro. La classifica alla fine della registrazione **non è** la classifica finale, e
  non può esserlo. I primi **otto** dell'ordine coincidono; divergono le posizioni 9 e 10.
- **KPI 3**: le due sole soste mancate sono **LAW al giro 21** e **LIN al giro 20** — cioè
  **dentro i giri che la registrazione non ha**. Tutte le altre 17 combaciano, e sui giri
  l'errore è 0 tranne un +1 (ANT). Il replay **perde esattamente ciò che la registrazione
  perde, e nient'altro.**

Restano NO-GO: un gate mancato è un NO-GO documentato, non un rinvio deciso dopo aver visto i
numeri (§3 delle regole di casa). Ma la causa è nominata.

### 2.2 · Il terzo NO-GO è del MODULO: una seconda sentinella di «posizione assente»

Il KPI 4 non manca di poco: **42 dei 43 periodi divergenti hanno quota 0,000** nel corridoio.
Non è una taratura, è un altro fenomeno.

> **Il 90,5 % dei campioni GPS nei periodi InPit (3.802 su 4.201) sta su una sola coordinata
> costante: `(-7447, -1830)`. La usano 21 auto su 22, e compare altre 1.732 volte anche
> FUORI dai periodi pit.**

Il decoder scarta `(0,0,0)` come posizione non valida — è un KPI di Fase 1, testato. **Questa
costante non è zero, quindi passa come posizione buona.** Il corridoio pit vero (dal 2025) sta
a **300 m** di distanza: da lì lo 0,000.

Le coordinate del riferimento e della registrazione sono nello stesso sistema
(x[-6085,4550] contro x[-7447,4570]): **non è un problema di trasformazione.** È una seconda
sentinella di «segnale assente» che il modulo non conosce, e appartiene alla stessa famiglia
già a referto come *«il feed ripete le coordinate — 76,9 % Ungheria»*.

**Perché non l'ho aggiunta al filtro adesso.** «Posizione valida» è una definizione, e per la
Regola 1 vive in **un** modulo; cambiarla dopo aver visto quale numero produce è precisamente
la mossa vietata (`E08`). Va pre-registrata: quale costante, come si riconosce senza cablarla
per circuito, e cosa succede al KPI 4 di Spa (che oggi è GO a 98,97 % e non deve peggiorare).

## 3 · Verdetto

> **`live/` NON è dichiarato pronto.**
>
> **È stabilito, fuori campione:** il decoder e il motore replay reggono su un circuito nuovo,
> su una gara e su una registrazione in due parti (KPI 1), e la ricostruzione dei regimi
> neutralizzati regge (KPI 5). In campione, tutti i KPI di luglio si riproducono.
>
> **Non è stabilito:** la posizione sulla mappa, perché il modulo prende per buona una
> coordinata di parcheggio.

E una prova che **non si può fare oggi**: il collettore contro il feed vero. Non c'è sessione
live — il GP d'Olanda è il **23/08**, prove dal **21/08**. Quella prova è la sola che esercita
`record_session.py` e la riconnessione, e va fatta là.

## 4 · Cosa resta aperto, nominato

1. **PREREG del secondo sentinella di posizione** (`(-7447,-1830)` e la sua famiglia), con
   vincolo di non peggiorare il KPI 4 di Spa. **È il blocco alla riattivazione.**
2. **Sentinella sul buco FRA le parti.** `inspect_recording.py` guarda un file alla volta e ha
   dichiarato «nessun gap» su una registrazione che perde nove giri. Il gap fra parti
   consecutive va misurato e stampato.
3. **`data/live_raw/` è gitignorata**: le registrazioni vivono su **una** macchina, il Mac.
   È la stessa esposizione del pickle del warm-in (TODO voce 10), e le prove di questo report
   non sono riproducibili altrove.
4. **Cinque artefatti orfani** in `data/live_derived/`, tracciati e senza generatore in `main`:
   `ungheria_ref_track.json`, `pitlane_ungheria.json`, `ungheria_pit_samples.json`,
   `ungheria_precostruzione_xy.svg`, `kpi3_f1db.json`. `kpi_fase1b.json` **non è più orfano**:
   il suo generatore è tornato. Gli altri quattro aspettano i loro — tre esistono in worktree
   non mergiati (`costruisci_corridoio.py`, `verifica_precostruzione.py`,
   `verifica_kpi3_f1db.py`), e insieme a `inpit_geometrico.py` sono il conto completo di ciò che
   la ripulitura del 20/07 ha portato via (§0). **Ripescarli è un lavoro di mezz'ora e va
   fatto prima del prossimo weekend**, non perché servano a girare, ma perché senza di loro
   quattro numeri del sito e dei report non sono più verificabili da nessuno.
5. **`demo/data/schede_2026.json` pubblica il numero sbagliato per NOR**: `gen_schede.py:144`
   usa `permanentNumber` (4), ma nel 2026 Norris corre col **1** — così dicono il grezzo TI e
   la `DriverList` del feed, d'accordo su 22 auto su 22. Trovato di rimbalzo: con la mappa
   sbagliata il KPI 2 confrontava un ordine la cui prima auto non esiste nel feed, e il KPI 3
   dava «zero soste» a chi ne aveva fatte tre. **È un numero pubblicato sul sito.**

## Come si rifanno le prove

```bash
.venv/bin/python live/kpi_fase1.py                     # KPI 1-3 su FP2 Spa
.venv/bin/python live/verify_alignment.py              # KPI 4-5 su FP2 Spa
.venv/bin/python live/verifica_gara.py --gara spa      # Fase 1B, in campione
.venv/bin/python live/arbitro_da_registro.py --gara Ungheria
.venv/bin/python live/verifica_gara.py --gara ungheria # fuori campione
```

Servono le registrazioni in `data/live_raw/` (punto 3): senza, gli ultimi due escono con
codice 2 e dicono quali file mancano, invece di misurare il vuoto.
