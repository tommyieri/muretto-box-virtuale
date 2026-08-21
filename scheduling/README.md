# Scheduling — far girare `auto_gara.py` da solo

La pipeline e' completa: `python3 auto_gara.py --push` fa TUTTO end-to-end senza prompt
(scopre la gara nuova → pubblica gara+UI+race control+ufficiali → golden → commit → push →
Vercel), piu' la seconda ondata f1db (standings, pit-lane, griglie) appena esce la release.
Manca solo *chi* lo lancia a intervalli. Tre opzioni, per riproducibilita' decrescente.

## A) Mac (launchd) — consigliata: STESSO ambiente dei golden
Riproducibile (stesso pandas/numpy/fastf1 con cui sono verdi i golden), zero infra nuova.
Limite: gira solo quando il Mac e' acceso (a StartInterval, con recupero al risveglio).

```bash
cp scheduling/com.muretto.autogara.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.muretto.autogara.plist   # attiva (ogni 30 min)
tail -f ~/muretto/data/auto_gara.log                                # guarda cosa fa
launchctl unload ~/Library/LaunchAgents/com.muretto.autogara.plist  # ferma
```
Prerequisito: `git push` senza password (già così in questa sessione) e la cache FastF1 in
`~/muretto_shared/ff1_cache/`.

## B) VPS (cron) — **ATTIVO dal 20/07/2026** (scelta PO)
Il VPS (167.233.236.186) ospita gia' il collettore live: sempre online, cattura la gara
anche a Mac spento. Configurato e verificato:
- Node v22 (apt), venv dedicato `.venv-auto` con fastf1 3.8.3 / pandas 2.3.3 / numpy 2.5.1
  (separato dal `.venv-live` del collettore);
- allineamento verificato: `test_b.py` sul VPS da `max diff 4.26e-12 GOLDEN OK` (identico al
  Mac), golden JS 449/449 e 11/11, `gen_classifiche_ufficiali` byte-identico -> pace e
  FastF1 bit-riproducibili;
- git push via **deploy key SSH** (write), identita' `muretto-vps`;
- cron ogni 30 min, che invoca **`auto_run.sh`** (non il python direttamente):
```cron
PATH=/usr/local/bin:/usr/bin:/bin
*/30 * * * * /home/muretto/muretto/scheduling/auto_run.sh
```
Gestione: `ssh muretto@167.233.236.186` poi `crontab -l` (vedi) · `crontab -r` (ferma) ·
`tail -f ~/muretto/data/auto_gara.log` (guarda). Prima gara che lo esercita: Ungheria.

> **Dal 07/08/2026 la crontab e' VERSIONATA: la fonte e' `scheduling/vps.cron`, non questo
> blocco.** Si installa con `crontab ~/muretto/scheduling/vps.cron` e si verifica SUL VPS
> con `scheduling/verifica_crontab.sh` (esce 1 se la macchina diverge dal file). Questo
> blocco resta come racconto; se un giorno contraddice `vps.cron`, ha ragione il file —
> e la rettifica del 03/08 qui sopra e' il motivo per cui la prosa non fa piu' da fonte.

> **RETTIFICA del 03/08/2026.** Fino a oggi questo blocco mostrava la riga VECCHIA, quella
> che invocava `.venv-auto/bin/python auto_gara.py --push` dentro un `flock`. Quella riga
> saltava `auto_run.sh`, cioe' saltava l'aggiornamento del codice — ed e' il guasto per cui
> `auto_run.sh` era stato scritto. La crontab sul VPS **e' gia' quella giusta**, verificata
> con `crontab -l` il 03/08; era il documento a essere rimasto indietro.
>
> Non e' un dettaglio di forma: il 03/08 questo README e' stato letto come stato del mondo
> e ha prodotto una diagnosi di rischio sbagliata nella premessa (E22 applicato a
> un'affermazione invece che a un numero). **Lo stato di una macchina si legge sulla
> macchina.** Le due verifiche che contano davvero — perche' guardano il comportamento e
> non la configurazione — sono qui sotto.

### Verificare che lo scheduler faccia il suo mestiere

Che la riga esista non prova che funzioni. Queste due lo provano:

```bash
ssh muretto@167.233.236.186 'cd ~/muretto && git rev-parse --short HEAD && git fetch -q origin && git rev-list --count HEAD..origin/main'
```
Il secondo numero e' quanti commit il VPS ha di ritardo su `origin/main`. Deve essere **0**
entro mezz'ora da un push: se resta > 0 per ore, l'aggiornamento del codice non sta girando.

```bash
ssh muretto@167.233.236.186 'grep -c "aggiornato a" ~/muretto/data/auto_gara.log; tail -25 ~/muretto/data/auto_gara.log'
```
Nel log devono comparire le righe `aggiornato a <sha>` (le scrive `auto_run.sh`, non
`auto_gara.py`: se non ci sono, la crontab non sta passando da li') e, in coda a ogni giro,
il blocco `sonda deploy` con i suoi due VERDE.

### Le dipendenze NON si sono trasferite col trasloco — 21/08/2026

Il 10/08 la redazione e' passata dal Mac al VPS. E' passato il *codice*: non le
librerie che qualcuno, mesi prima, aveva installato a mano sul Mac. **Non esisteva un
file di requirements in questo repo** — non ne e' esistito uno fino al 21/08, v. la
chiusura in fondo a questa sezione — quindi non c'era niente da confrontare e
nessuno se n'e' accorto.

Il conto e' arrivato al primo weekend che lo esercitava. `ai_lab/redazione/fia_cp.py`
apre il PDF FIA con `pdfplumber`; sul Mac c'era (0.11.10, nel python di sistema), in
`.venv-auto` no. L'import e' dentro `_apri_pdf()` **apposta** — «se manca, stato, non
crash» — quindi il canale non e' esploso: si e' chiuso, dicendolo, sei volte di fila:

    FIA: CANCELLO IDENTITA' CHIUSO — dipendenza assente: pdfplumber. NON pubblico

Il documento d'Olanda era gia' in cache dalle 08:15; a mancare era solo chi lo
aprisse. Installato `pdfplumber` 0.11.10 in `.venv-auto` il 21/08/2026 — la stessa
versione del Mac, perche' due macchine che stampano lo stesso articolo devono leggere
il PDF con lo stesso lettore.

**CHIUSO IL 21/08/2026, e non con un file solo.** Un `requirements` dichiarato
trasforma il prossimo import nuovo in un errore d'installazione invece che in un
articolo mancato — ma solo se qualcuno lo confronta con qualcosa. I guasti sono
due e stanno in posti diversi, quindi i controlli sono due:

  - **nel repo** — `test_dipendenze.py`, verifica **14** della sentinella. Cammina
    sul grafo dei moduli Python raggiungibili dai LANCIATORI (questa crontab,
    l'unit del collettore, la crontab del Mac, il workflow della CI) e pretende
    che ogni libreria importata dal codice vivo abbia una riga dichiarata, e che
    ogni riga dichiarata sia importata da qualcuno. Prende l'`import pdfplumber`
    il giorno che si scrive. L'elenco dei moduli vivi si **calcola** — come in
    `demo/test_lingua.mjs` — perche' un elenco a mano invecchia al primo
    generatore nuovo e allora dichiara una copertura che non ha.

  - **sulla macchina** — `test_dipendenze.py --ambiente <nome>`, lanciato da
    `auto_run.sh` e `auto_articoli_run.sh` col **loro** `$PY`, subito dopo s46.
    Confronta il file col python che sta per girare. E' l'unico dei due che
    poteva vedere il 10 agosto: il repo era identico sulle due macchine, a essere
    diverso era l'ambiente. Non ferma niente — scrive, come s46.

I tre ambienti sono dichiarati in `test_dipendenze.py::AMBIENTI` e pinnati alle
versioni **in produzione oggi**, lette con `pip freeze` sulle macchine:
`requirements-auto.txt` (52 righe, `.venv-auto`), `live/collector/requirements.txt`
(10, `.venv-live`, prima con vincoli larghi tipo `websockets>=12`),
`requirements-banco.txt` (17, il python3 di sistema del Mac e della CI). Verdi al
primo giro su tutt'e tre: `52/52`, `10/10`, `17/17`.

**Le versioni non si aggiornano per far passare un controllo.** Le quattro
numeriche — `fastf1`, `numpy`, `pandas`, `scipy` — sono quelle su cui riposa
l'affermazione di riproducibilita' bit-a-bit qui sopra, e la verifica 14 esce 1 se
una di loro porta due versioni diverse in due file. Il resto puo' divergere e
diverge: `anthropic` e' 0.121.0 sul VPS e 0.120.0 sul Mac, ed e' scritto in
`requirements-banco.txt` invece che nascosto — chi pubblica gli articoli e' il VPS.

**Quello che il conto ha fatto vedere per strada.** `auto_run.sh` sceglie il python
**per percorso** (`.venv-auto` → `.venv` → `python3`). Sul Mac non c'e' `.venv-auto`
ma c'e' `.venv`, che porta **pandas 3.0.3 e numpy 2.5.0** (la venv del kernel,
congelata a suo tempo per `live/`, v. `live/requirements.txt`): se il launchd del Mac
tornasse attivo, quella macchina pubblicherebbe una gara con un pandas diverso da
quello del VPS. Oggi non e' attivo — `launchctl list` non porta nessun
`com.muretto.*`, verificato il 21/08 — e da oggi il controllo di cui sopra lo
scrive nel log invece di lasciarlo scoprire ai numeri. `auto_tele_run.sh` sceglie
allo stesso modo, ma la sua catena (`auto_tele.py` → `gen_tele.py` → `decoder.py`)
non importa **niente** di terze parti: li' il controllo risponderebbe a una domanda
che nessuno fa, e infatti non c'e'.

## C) GitHub Actions (cron) — sempre acceso, zero macchine tue
Gira sui runner GitHub, push col token integrato. Nessun Mac/VPS da tenere su.
Caveat: ambiente diverso dal Mac → il pace potrebbe differire a livello di float (i golden
JS hanno tolleranza 1e-9, ma la generazione dati non e' garantita bit-identica). Accettabile
con la filosofia "pubblica e correggi", ma da sapere.

## La telemetria: `auto_tele.py`, e perche' gira sul MAC (non sul VPS)

`auto_gara.py` pubblica tempi e settori da TracingInsights. La **telemetria**
(velocita'/gas/freno del giro veloce) nasce invece dalle REGISTRAZIONI del
collettore, che `live/weekend_scheduler.py` salva in `~/muretto/data/live_raw/`
**sul Mac**: il VPS quei file non li ha. Per questo fino al 25/07/2026 esisteva
solo `tele_Belgio_gara.json`.

`auto_tele.py` chiude la catena: legge le registrazioni, ricava GP+sessione dal
nome del file e dal calendario, salta quelle gia' nel `tele_manifest.json`,
chiama `gen_tele.py` e committa. Idempotente.

```bash
python3 auto_tele.py --dry-run     # cosa farebbe
python3 auto_tele.py --push        # genera, committa, pubblica
```

Per farlo girare da solo durante il weekend (ogni 30 min, come auto_gara sul VPS):

```cron
*/30 * * * * cd ~/muretto && /usr/bin/python3 auto_tele.py --push >> ~/muretto/data/auto_tele.log 2>&1
```

Note: fra piu' registrazioni della stessa sessione tiene la **piu' grossa** (il
registratore riprova e lascia tronconi); sotto 1 MB e' considerata un troncone e
scartata; una sessione che fallisce non ferma le altre.

## Frequenza
30 min cattura una gara finita in fretta. Le HEAD di scoperta e il check release f1db sono
leggeri: un giro a vuoto (nessuna gara nuova) costa due richieste HTTP. Il grosso del lavoro
parte solo quando c'e' davvero una gara nuova o una release f1db nuova.

## Sicurezza del meccanismo
- Guardrail = bandiere (mai bloccano): una gara bagnata/anomala entra lo stesso, con la
  bandiera in `demo/data/bandiere.json` per la correzione a valle.
- L'UNICO stop e' il golden (regressione motore/pit): se fallisce, niente commit/push — non
  arriva in produzione.
- Un lock (`data/.auto_gara.lock`) evita due giri sovrapposti.
- Le gare gia' pubblicate non vengono ritoccate (registro dup); la neutralizzazione delle
  gare esistenti e' congelata per costruzione.


## Come si verifica che la macchina si aggiorni da sola

Non basta lanciare lo script: va lanciato NELL'AMBIENTE DI CRON, che e' spoglio.

    ssh muretto@... 'env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=/home/muretto \
        /home/muretto/muretto/scheduling/auto_run.sh; echo exit=$?'

Due guasti sono stati trovati solo cosi', il 22/07/2026, e nessuno dei due si
vedeva lanciando `sh auto_run.sh` a mano:

  - shebang `#!/bin/zsh` e zsh non installato sul VPS -> exit 127 con "No such
    file or directory", che parla dell'interprete e si legge come "manca il file";
  - il lock: la crontab usava `flock` (che crea un FILE) sullo stesso percorso su
    cui lo script fa `mkdir` -> "gia' in esecuzione, salto", per sempre.

E per provare che l'aggiornamento funziona davvero, si torna indietro di un
commit e si guarda se il giro dopo risale — ATTENZIONE a scegliere un commit in
cui lo script stesso e' sano, altrimenti si testa la propria rottura.
