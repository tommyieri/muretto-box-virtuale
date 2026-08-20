# La Redazione tecnica

Redazione autonoma che produce articoli ingegneristici di F1 per la sezione
**Analisi** del sito (`demo/analisi.html`). Ogni articolo parte da un fatto tecnico
curioso o anomalo, e lo porta fino in fondo: che cosa abbiamo misurato, che cosa ne
inferiamo, che cosa cambia.

Non è cronaca e non è clickbait. È l'analisi che un ingegnere di pista farebbe,
scritta in modo che un appassionato serio la capisca.

## Le regole (non negoziabili)

1. **Ogni numero esce dai dati, mai a mano.** Un valore stimato e non misurato è
   dichiarato come tale (STIMATO) col suo metodo; una grandezza non identificabile
   dai dati si dichiara `NON_MISURABILE` — non si stima di nascosto.
2. **Ogni claim ha il suo grafico**, generato dalla *stessa* catena che ha calcolato
   il numero, con l'annotazione sul punto esatto dell'anomalia.
3. **Confine.** Gli agenti scrivono BOZZE nell'area Lab (`bozze/`). Portare un
   articolo in `demo/` è una transizione tracciata con `--attore`; portarlo *online*
   è un altro gesto ancora (merge su `main` = deploy Vercel).
   **Attenzione, il README ha mentito su questo punto fino al 3/8/2026:** dal
   25/07/2026 esiste una policy di **auto-pubblicazione** (`genera_weekend.py:143`
   chiama `coda.transizione(..., attore="auto")`), quindi il gate umano *non* è
   attraversato dalla catena del cron. Il cancello effettivo è
   `redazione.verifica()`. Chi progetta qui deve saperlo.
4. **Canale A** (scouting web) cita sempre la fonte e **riproduce** il tema sui
   nostri dati. **Canale B** (caccia all'anomalia nei nostri dati) misura prima e
   scrive dopo.

## Le due lingue

Dal 21/08/2026 ogni articolo esce anche in inglese, e la traduzione la fa la catena, non
una mano. `traduci.py` prende la prosa italiana e ne rende una inglese; **entra in pagina
solo se porta esattamente gli stessi numeri dell'originale, nello stesso ordine** — il
confronto è aritmetico, zero modelli. Se boccia, l'articolo resta italiano e la pagina lo
dichiara: la regola 1 vale anche sulle parole tradotte, e una traduzione «quasi buona»
pubblicata in silenzio sarebbe il modo più elegante di cancellare una misura.

La forma dei numeri si conserva com'è: una cifra resta cifra, una parola resta parola. In
questa redazione le **cifre sono le misure** e le **parole sono tutto il resto**, ed è così
che un lettore distingue a colpo d'occhio un dato da un contorno.

    python3 ai_lab/redazione/traduci.py --tutti
    python3 ai_lab/redazione/traduci.py --articolo <id> [--forza]

`coda.py` la chiama da solo alla pubblicazione. La sorveglia `demo/test_lingua.mjs`
(verifica 13 di `sentinella.py`), che la guardia sui numeri la rifà su ciò che è
committato.

## La catena

```
rilevatore ──► fatti + grafici SVG ──► DOSSIER ──► piano ──► prosa ──► correttore
 (misura)       (facts.json + svg)    (Python)    (LLM 1)   (LLM 2)   (0 LLM)
                                                                          │
                          ┌───────────────────────────────────────────────┘
                          │  pulito? si esce.  sporco? revisione guidata (max 2 giri)
                          ▼
                       bozza (Lab) ──► verifica: correttore + censore cieco (LLM 3)
                                                                          │
                          coda di revisione ──approva──► demo/ ──merge──► online
```

Il principio del laboratorio resta: **Python calcola tutti i numeri, la prosa non
introduce un numero che non sia nei fatti.** Quello che è cambiato il 3/8/2026 è che
la prosa non è più un template: è scritta, e il controllo su di essa è aritmetico.

### Che cosa il lettore vede, e che cosa resta nel dato

La tabella «Provenienza dei numeri» **non si stampa più** in fondo agli articoli
(4/8/2026): chiudeva ogni pezzo con dieci righe di metodo, e da lettore ci arrivavi
dopo la chiusa. Il dato non si tocca — `provenienza[]` e `fonti[]` restano nel JSON,
restano validati contro `base.STATI`, restano l'insieme su cui la guardia dei numeri
decide che cosa la prosa può scrivere. È sparita la resa, non la tracciabilità, e il
limite che conta adesso va detto **nel corpo** (VOCE.md O1 e O2).

Le due funzioni che la rendevano restano al loro posto, vuote e gemelle
(`statico.py::_provenienza` e la `provenienza()` di `demo/articolo.html`):
riaccenderla è cancellare una riga, in due file che devono cambiare insieme.

## I file

### Il sistema editoriale

| file | ruolo |
|---|---|
| `voce/VOCE.md` | **la guida editoriale**: la legge in prosa, ~90 regole con il perché di ciascuna. Non è un prompt: è il documento a cui gli agenti si attengono e contro cui il correttore misura |
| `voce/GLOSSARIO.md` | terminologia italiano/inglese, falsi amici, il regolamento 2026, come argomenta chi sa |
| `voce/lessico.json` | **fonte unica** delle liste controllabili a macchina (vietati 2026, formule da testo generato, cliché, forme, attacchi, chiuse, soglie). Una definizione, un posto |
| `voce.py` | carica la guida, la serve ai prompt e ne calcola l'**impronta** sha256, che finisce nel diario di ogni articolo |
| `dossier.py` | fatti → dossier: nomi al posto delle sigle, classifica, scala umana, prossima gara, memoria del GP. Tutto calcolato da Python |
| `agenti.py` | i tre mestieri che parlano col modello: **caposervizio** (pianifica), **firma** (scrive e rivede), **censore** (verifica, su un modello diverso e cieco al piano) |
| `stile.py` | **il correttore**: ~40 controlli, zero LLM, zero dipendenze. Cancello binario + profilo, mai un punteggio unico |
| `memoria.py` | la memoria editoriale: quali forme, attacchi, chiuse e giri di frase sono già stati usati. È il vincolo che impedisce venti articoli uguali |
| `redazione.py` | l'orchestratore, e le due sole funzioni verso il resto del repo: `riscrivi()` e `verifica()` |
| `test_redazione.py` | le sentinelle (20), tutte a freddo: nessuna chiama l'API. Girano in CI |
| `diario/<id>.jsonl` | che cosa ha fatto ogni chiamata: modello, token, cache, secondi, esito, impronta della voce |
| `redattore.py` | **superato**, tenuto come raccordo per i due call-site storici. In testa c'è scritto perché il vecchio scrittore non ha mai prodotto una riga |

### La produzione dei fatti (invariata)

| file | ruolo |
|---|---|
| `tele.py` | il caricatore di telemetria vettura FastF1 (`get_car_data().add_distance()`) |
| `svg.py` | i grafici con aspetto preservato, tema scuro, colori team |
| `curve.py` | la mappa-curve GPS: misura un canale al punto-firma su più giri |
| `multigara.py` | l'estrattore multi-gara con cache in `dati_stagione/` |
| `base.py` | fondamenta comuni, gli STATI ammessi per un numero, `scrivi_bozza` |
| `registro.py` | l'elenco dei generatori (aggiungere un articolo = aggiungere una riga) |
| `genera.py` | l'orchestratore dei generatori, ognuno ISOLATO |
| `genera_*.py` | i 29 generatori: misurano, disegnano, e producono l'articolo-template |
| `mandato.json` | il mandato editoriale: cosa scriviamo. Deciso dal PO |
| `coda.py` | la coda di revisione: `bozza → approvato → pubblicato`, storico append-only |
| `statico.py` | il pre-render: pagina, og, sitemap, feed, indice crawlabile |

## Uso

```bash
# il correttore, su tutto il pubblicato (nessuna chiave, nessuna rete)
python3 ai_lab/redazione/stile.py --tutti
python3 ai_lab/redazione/stile.py --id lift-mercedes-gb-2026 --memoria

# la memoria editoriale: che cosa abbiamo già fatto
python3 ai_lab/redazione/memoria.py

# la catena completa su una bozza (serve la chiave)
python3 ai_lab/redazione/redazione.py --id <id> --prova     # non salva niente
python3 ai_lab/redazione/redazione.py --id <id>             # riscrive la bozza
python3 ai_lab/redazione/redazione.py --id <id> --verifica  # solo il cancello

# le sentinelle
python3 ai_lab/redazione/test_redazione.py
```

## Che cosa blocca che cosa

Non tutte le violazioni pesano uguale, e la distinzione è dichiarata in
`voce/lessico.json` sotto `cancello_pubblicazione`:

- **Bugie** — un numero non tracciabile, un termine fuori epoca, una formula da
  testo generato, un cliché, un superlativo senza misura, una frase ripetuta
  identica: tengono il pezzo **offline**.
- **Difetti di forma** — una frase troppo lunga, quattro numeri in un periodo, tre
  trattini: fanno fallire il **giro di revisione**, così chi scrive li corregge, ma
  non meritano di trattenere offline un articolo vero.

## Il cancello di accensione

**Il sistema nasce spento.** `mandato.json::scrittura.attiva` è `false`: i generatori
consegnano la loro prosa a template esattamente come prima, e ogni articolo lo
dichiara (`"scrittura": "template: spento dal mandato"`). È lo stesso pattern dei
modelli vivi del laboratorio — un modello calibrato resta `ACCENDIBILE:false` e la
decisione di accenderlo è del PO, non del codice.

Per provarlo senza accenderlo: `MURETTO_REDAZIONE=1 python3 …/redazione.py --id <id>
--prova`. Il cron non esporta quella variabile, quindi non può accendersi da solo.

Ad accensione avvenuta, `acceso_da` e `acceso_il` vanno compilati: una sentinella
esce 1 se il sistema risulta acceso senza che nessuno abbia messo la firma.

## Il costo, misurato

Un articolo costa **tre chiamate** quando esce pulito, **cinque** nel caso peggiore
(due giri di revisione più il censore). Misurato su una bozza vera il 3/8/2026:
`claude-opus-5`, dai 15 ai 105 secondi a chiamata, 20.374 token di guida scritti in
cache **una volta** e riletti a un decimo del prezzo da tutte le chiamate successive.
La finestra utile è ampia: il cron gira ogni 30 minuti e il lock scade a 120.

## Ambiente e trappole

- **Due Python.** I generatori FastF1 (telemetria) vanno con `python3` di sistema
  (fastf1 3.8.3 + anthropic); la `.venv` non ha fastf1 — e in questo worktree non
  esiste affatto, nonostante `SETUP_AMBIENTE.md` la dichiari.
- **La chiave sta su una macchina sola**: il cron del Mac
  (`scheduling/auto_articoli_run.sh` la estrae da `~/.zshrc`). Sul VPS `anthropic`
  non è installato, quindi la catena VPS produce bozze a template — e adesso lo
  **dichiara**, nel campo `scrittura`.
- **Cache FastF1** fuori dal repo: `~/muretto_shared/ff1_cache`. Sul VPS è quasi
  vuota: i generatori telemetrici si auto-saltano.
- **Non toccare** `engine/` (kernel congelato), i golden, i file di produzione: la
  redazione aggiunge, non modifica.
- **Verità del motore.** I tempi assoluti del kernel sono ottimisti di ~1,9 s/giro:
  un articolo non li mostra mai come previsione. I modelli degrado/traffico sono
  calibrati ma spenti (`ACCENDIBILE:false`): citabili come coefficienti, non come
  effetti attivi.

## Come si cambia la voce

Si modifica `voce/VOCE.md` (o `lessico.json`) in un commit, con la ragione scritta.
L'impronta cambia, e da quel momento ogni articolo nuovo porta l'impronta nuova nel
suo diario: un pezzo di luglio e uno di settembre possono sempre dire sotto quale
legge sono stati scritti.

**Le soglie non si allargano per far passare un articolo.** Se un pezzo buono viene
bocciato, o la soglia era sbagliata (e allora si cambia con la ragione, per tutti) o
il pezzo non era buono. La sentinella `il correttore ha il potere di bocciare il
corpus esistente` esce 1 se qualcuno allarga le soglie finché tutto passa.
