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

## B) VPS (cron) — sempre acceso
Il VPS (167.233.236.186) ospita gia' il collettore live: e' sempre online, quindi cattura
la gara anche a Mac spento. Richiede: clonare il repo, un venv con `fastf1 pandas numpy`
allineati al Mac, Node per i golden, la cache FastF1, e credenziali git push.
```cron
*/30 * * * *  cd /home/muretto/muretto && /home/muretto/.venv/bin/python auto_gara.py --push >> data/auto_gara.log 2>&1
```
Da valutare: allineare le versioni al Mac perche' il passo-base (pace) resti bit-compatibile
coi golden.

## C) GitHub Actions (cron) — sempre acceso, zero macchine tue
Gira sui runner GitHub, push col token integrato. Nessun Mac/VPS da tenere su.
Caveat: ambiente diverso dal Mac → il pace potrebbe differire a livello di float (i golden
JS hanno tolleranza 1e-9, ma la generazione dati non e' garantita bit-identica). Accettabile
con la filosofia "pubblica e correggi", ma da sapere.

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
