# REPORT — l'aggancio del sito al motore nuovo

*31/07/2026. `demo/gara.html` non calcola più: legge risposte pre-calcolate dal simulatore.*

**In una riga:** la pagina-gara mostra ora il pannello del simulatore nuovo — con la **banda
sulla posizione**, la **curva del quando** e il **piano gomme fino alla bandiera** — su
**10.131 risposte** pre-calcolate. L'invariante animazione-pannello tiene **559 su 559**
sulla gara di prova, e nessun numero esce senza targhetta.

---

## 1. Il vincolo, e le tre strade

La regola del simulatore è netta: la sentinella `s20(f)` fa fallire la suite se *«un modulo
del browser importa il kernel, il modello o i coefficienti»*. La ragione è scritta nel suo
`web/README.md`: una seconda implementazione della fisica dentro l'interfaccia sarebbe
**E17 nel posto peggiore, perché la pagina è ciò che l'utente crede**.

Il sito però calcolava nel browser. Tre strade, misurate invece che annusate:

| | interattività | offline | architettura |
|---|---|---|---|
| la pagina importa il motore | piena | sì | **contro** la regola, e `s20` non copre `demo/` |
| funzione serverless | piena | **no** | rispettata |
| **pre-calcolo** ✅ | piena | **sì** | rispettata |

Numeri che hanno deciso: uno scenario costa **108 ms** (rientro 4, curva 59, piano 45) e
pesa **4,5 KB**; un pilota per tutta la gara sta in **13 KB gzippati**; una gara si genera in
33–199 s. La strada serverless avrebbe barattato il funzionamento offline del replay per due
minuti di build: **non è un buon cambio.**

## 2. Cosa è stato costruito

**`simulatore/web/genera_vista_gara.mjs`** — per ogni gara, ogni pilota, ogni giro di
congelamento: `doveRientri` + `curvaDelQuando` + `pianoOttimo`, tutti passando dal Director.
**10.131 risposte su 11 gare.**

- Il **fantasma** dell'animazione viaggia in un file a parte (`<pilota>.fantasma.json`): è un
  terzo del peso e serve solo a chi preme «Guarda la sosta».
- **Non** si riscrivono i `cum_time` di tutti: sono già in `demo/data/<gara>.json`, che è ciò
  da cui il sito disegna la pista. Una seconda copia della stessa verità è l'errore di casa.
- La **mappa dei nomi** (`Gran Bretagna` → `GranBretagna`) sta nel manifest, non in un `if`
  dentro la pagina: E24 del catalogo è proprio lo spazio nel nome che spezza i glob.

**`simulatore/web/trasporta_formattatori.mjs`** — Vercel serve `demo/` come radice e non vede
`simulatore/`. I quattro formattatori (`targhette`, `pannello`, `curva`, `render`) e il CSS
vengono copiati in `demo/vendor/simulatore/` **come artefatti generati**, con manifest di
hash. `--verifica` esce 1 se qualcuno modifica la copia invece dell'originale, o se
l'originale cambia senza ri-trasportare. **La CI lo esegue.**

Due guardie dentro il trasporto:
- un formattatore che importasse da `engine/`, `scenario/`, `provenienza/` o `fisica/`
  **non viene trasportato**: porterebbe fisica nel browser;
- il CSS viene **scopato sotto `#pitKv`**. Il foglio del simulatore ha regole su `body`, `*`
  e `:root` e due classi in comune col sito (`pista`, `spenta`): servirlo tale quale avrebbe
  fatto ridipingere la pagina al pannello. Verificato dopo l'innesto: il fondo pagina resta
  quello del sito.

**`demo/gara.html`** — `updatePit` non chiama più `pannelloMuretto`: prende il record del
giro dalla vista del pilota e lo passa a `pannello` e `curva`. La risposta in volo viene
scartata se nel frattempo l'utente ha cambiato pilota o giro — altrimenti si mostrerebbe un
numero scaduto.

**`auto_gara.py`** — il ciclo post-gara ora chiama il generatore della vista. Senza, il
pannello resterebbe muto proprio sulla gara appena pubblicata: la pagina non calcola, quindi
se il pre-calcolo non gira non c'è risposta.

## 3. Cosa vede l'utente, che prima non c'era

```
BOX NOW
Belgio · NOR · congelato al giro 34 di 44
Rientri P6   (fra P5 e P7)
Piano gomme fino alla bandiera
Quando conviene fermarsi — il minimo cade al giro 37.
                           Fermarsi al primo giro utile costa 0,1 s
Assunzioni dichiarate
```

**Ogni numero è un bottone**: al tocco si apre la sua targhetta con natura, data, n e banda.
La banda di rientro dichiara da sola cosa **non** è: *«NON è una probabilità di sorpasso. Il
duello non si simula… e nel 2026 il DRS non esiste»*.

La **curva del quando** è la domanda che il pannello vecchio non sapeva porre: sul motore
precedente il minimo cadeva al primo giro utile in **249 casi su 249**.

## 4. Verifiche

| | |
|---|---|
| componenti su tutta la gara di Belgio | **1.118 alberi validi, 0 errori**, 18.373 numeri tutti con targhetta |
| invariante animazione ↔ pannello | **559/559** — l'animazione non contraddice il numero |
| suite del simulatore | 25/25 sentinelle |
| test del sito | `test_pit`, `test_live_bylap`, `test_ghostplay`, `test_traiettoria` verdi |
| pagine del sito | 8/8 a 200; il fondo pagina non è cambiato (CSS scopato) |
| trasporto | verifica che morde: modificata una copia → esce 1 |

## 5. Limiti dichiarati

- **La curva non c'è a tutti i giri.** Su Belgio/NOR esiste ai giri 31–41 e non prima: il
  motore si rifiuta di disegnarla dove l'orizzonte non è validato. È il motore che tace, non
  l'innesto che perde pezzi — ed è il comportamento giusto.
- **`live.html` NON è passato al motore nuovo**, e ora la sua intestazione lo dice. In diretta
  una risposta pre-calcolata non esiste per definizione: il live resta su `demo/muretto.mjs`,
  che calcola nel browser. **Replay e diretta rispondono con due motori diversi**, ed è una
  divergenza dichiarata finché il live non avrà la sua strada.
- **Il kernel vecchio è ancora vivo**: `auto_gara → pipeline_gara → export_demo →
  engine/engine.py` produce `demo/data/<gara>.json`, che il sito legge per pista, torre e
  timeline. Diventerà cancellabile solo quando anche quella produzione passerà al nuovo.

## 6. Due errori miei, in questo giro

- **Il parsing degli argomenti**: con `--dove` assente, `iDove + 1` vale 0 e scartava il primo
  posizionale — ho chiesto una gara e ne ha girate undici. **Stessa specie del bug `--json`
  di due giorni fa**: averlo già fatto una volta non è bastato.
- **Ho modificato il generatore a job avviato**: Node aveva caricato il modulo vecchio e le
  prime gare sono uscite senza lo split del fantasma. Rigenerate tutte da capo, invece di
  committare metà vista in un formato e metà nell'altro.

---

### Riprodurre

```bash
cd simulatore
node web/genera_vista_gara.mjs            # tutte le gare (~15 min)
node web/trasporta_formattatori.mjs       # i formattatori nel sito
node web/trasporta_formattatori.mjs --verifica
node banco/run_suite.mjs
```
