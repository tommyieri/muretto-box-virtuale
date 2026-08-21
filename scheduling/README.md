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

### Il CDN di F1 blocca il VPS — 21/08/2026, e cambia chi scarica

**Misurato, non dedotto.** Stessa URL, stesso momento, due macchine:

| macchina | indirizzo | esito |
|---|---|---|
| Mac | 45.66.16.143 (residenziale) | HTTP **200** |
| VPS | 167.233.236.186 (Hetzner) | HTTP **403** |

`https://livetiming.formula1.com/static/2026/Index.json`, tre tentativi di fila, TLS a
posto, edge CloudFront 65.9.130.101, corpo «The request could not be satisfied». Lo
user-agent non c'entra: 403 anche con quello di un browser e con `FastF1/3.8.3`.
L'uscita generica del VPS funziona (GitHub 200): e' un blocco **per indirizzo**, di
quelli che le reti da datacenter si prendono in blocco.

**Quando e' cominciato.** La cache FastF1 del VPS si ferma a
`2026-07-26_Hungarian_Grand_Prix` (26/07, 15:30): l'Ungheria l'aveva scaricata da
solo. Nel log delle gare il primo `estrazione fallita` in assoluto e' «Olanda FP1».
Fra le due date c'e' la pausa estiva, quindi **l'Olanda e' il primo weekend che lo
incontra**, e lo incontra su tutto: niente sessioni, niente gara, e nella redazione
solo cio' che non passa da FastF1 (l'anteprima FIA, che legge un PDF).

**Il ponte, e cos'e' che NON e'.** `scalda_cache.py` + `scheduling/scalda_cache_run.sh`
girano SUL MAC a :05 e :35: scaldano la cache del GP in corso e la spediscono al VPS,
che da li' lavora offline. Provato prima di scriverlo, col 403 ancora attivo: il VPS ha
caricato le FP1 d'Olanda dalla sola cache (693 giri, 22 piloti, telemetria del giro
veloce) e `gen_giri.py` ne ha scritto `olanda__fp1` — 22 piloti, 693 giri, 1,06 MB.

Costi e vincoli, per iscritto:
- **~46 MB a sessione** in cache, ~7,5 MB sul filo (rsync comprime 6×), ~10 s.
- **Il Mac deve essere acceso.** E' esattamente la dipendenza che il trasloco del
  10/08 aveva tolto: Mac spento = quella sessione non esce. Il VPS lo dichiara nel suo
  log, non lo nasconde — ma nessuno pubblica al posto suo.
- **Serve un checkout a parte** (`~/muretto-ponte`, worktree su `main`): il checkout di
  lavoro del Mac sta su un branch feature e non contiene questo codice.
- **Due cache, e il ponte le serve tutt'e due**: `gen_giri.py` legge
  `<repo>/data/ff1_cache` (auto_gara lo invoca senza `--cache`), la redazione legge
  `~/muretto_shared/ff1_cache`. Unificarle e' una modifica al codice di chi pubblica e
  non si fa a weekend cominciato.
- **Si scalda col SUPERINSIEME delle opzioni** (`telemetry`, `laps`, `weather`,
  `messages`): FastF1 mette in cache per tipo di dato, e un tipo che manca manda il VPS
  in rete, cioe' nel 403. I tre generatori del pit-loss chiedono `weather=True`: senza,
  sarebbero caduti proprio loro.

**Resta aperto, ed e' la domanda vera:** questo e' un ponte. La riparazione e' far
uscire il VPS dal blocco, o spostare stabilmente chi scarica. Decide il PO.

### Le dipendenze NON si sono trasferite col trasloco — 21/08/2026

Il 10/08 la redazione e' passata dal Mac al VPS. E' passato il *codice*: non le
librerie che qualcuno, mesi prima, aveva installato a mano sul Mac. **Non esiste un
file di requirements in questo repo**, quindi non c'era niente da confrontare e
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

**Cosa resta aperto:** finche' le dipendenze vivono a mano su ogni macchina, il
prossimo `import` nuovo si scoprira' allo stesso modo — a weekend cominciato. Un
`requirements` dichiarato e' l'unica cosa che lo trasformerebbe in un errore di
installazione invece che in un articolo mancato.

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
