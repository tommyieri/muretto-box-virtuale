# REPORT — la diretta passa al motore nuovo

*31/07/2026. `live.html` non risponde più con un motore diverso da `gara.html`.*

**In una riga:** il pannello del simulatore è ora anche quello della diretta, e la parità
fra le due strade è **misurata su una gara vera**: a parità di celle le risposte sono
**identiche campo per campo (0 differenze su 160)**; partendo dal flusso live registrato di
Spa 2026 la posizione di rientro coincide nel **95,5% dei casi**. Per arrivarci il Director
ha trovato **due difetti veri nel cavo live**, che erano lì da settimane.

---

## 1. Dove gira il motore, e perché lì

In diretta il pre-calcolo non esiste per definizione: la gara sta succedendo, e una risposta
su un giro non ancora percorso non è difficile — è impossibile. Le tre strade, pesate sui
fatti invece che sulle preferenze:

| | dove gira | costo | verdetto |
|---|---|---|---|
| il collettore calcola e spinge | server | è un servizio Python che questo repo **non collauda** | scritto alla cieca proprio nel pezzo che deve reggere durante il GP |
| funzione serverless | Vercel | Vercel serve `demo/` come radice → il motore va copiato in `demo/` **comunque**, più un giro di rete e un avvio a freddo | stesso trasporto, in più il ritardo nel momento peggiore |
| **il browser esegue il motore** ✅ | pagina | stesso trasporto | nessun giro di rete; la pagina risponde anche se l'API cade |

Il fatto che ha deciso: **il trasporto dentro `demo/` è inevitabile in due strade su tre**
(c'è `demo/vercel.json`, e le funzioni stanno in `demo/api/`). Quindi la domanda non era
«portare la fisica in `demo/` sì o no», ma «dove la si esegue».

**La regola 8 («la pagina non calcola») è derogata nella lettera, non nella ragione.** Ciò
che vuole impedire è E17 — *due* fisiche per due risposte adiacenti — e quel rischio non
dipende da dove il codice gira, ma dall'esistere di due sorgenti. Qui la sorgente resta una.

## 2. Cosa è stato costruito

- **`web/trasporta_motore.mjs`** — porta 12 moduli (103 KB) + `contesto_live.json` (38,5 KB
  di costanti) in `demo/vendor/simulatore/motore/`, come artefatti con manifest di hash.
  **Rifiuta** di trasportare un motore che in pagina non partirebbe (un solo
  `import … from 'node:fs'` in transitiva) e `--verifica` esce 1 sulla deriva. La CI lo esegue.
- **`scenario/risposta.mjs`** — il montaggio del record estratto da `genera_vista_gara.mjs`:
  ora **un modulo solo** produce la risposta per entrambe le strade. La parità diventa
  strutturale invece che una coincidenza da controllare a mano.
- **Il grafo di calcolo è stato reso caricabile in pagina**: i caricatori da disco
  (`caricaCostanti`, `caricaPrior`, `caricaDurate2026`, e `gare_2026`) sono usciti dai moduli
  di calcolo in `*_dati.mjs` / `gare_indice.mjs`. **Verificato a costo zero**: rigenerando
  Belgio, 20 piloti su 20 identici alla vista committata.
- **`banco/sentinelle/s26`** — cammina la chiusura degli import e fallisce se il motore
  smette di essere caricabile in pagina. Provata: sporcando `scenario/piano.mjs` esce 1.
- **`demo/ponte_live.mjs`** — traduce le celle del flusso nel contratto. **Non calcola**: se
  qui comparisse un coefficiente, sarebbe la seconda fisica che tutto questo serviva a non avere.
- **`demo/test_parita_live.mjs`** — il cancello, in CI.

## 3. Due difetti veri, trovati dal Director

Il guardiano ha rifiutato **tutte** le risposte in diretta. Non era un guardiano troppo
severo: aveva ragione due volte.

**a) Il cambio di leader spezzava il riferimento dei cumulati.** Il cum live si ricostruisce
come `riferimento + distacco`, e il riferimento avanzava sommando il giro di *chi è primo*.
Finché è sempre la stessa macchina, giusto; quando il primo **cambia** — a Spa al giro 21,
con le soste sotto Safety Car — il cumulato del nuovo leader non è quello del vecchio più il
proprio giro. **8,65 s di errore, identico per tutti e venti i piloti**, su 4 giri su 44.

Il pannello vecchio non poteva accorgersene, ed è scritto nella sua stessa intestazione: *un
termine comune a tutti si semplifica in ogni confronto fra piloti dello stesso giro.* Vero —
ma **falso per il motore nuovo**, e l'ho misurato invece di dedurlo: perturbando i cumulati
con un offset per-giro, **153 posizioni su 199 cambiano**.

| | prima | dopo |
|---|---|---|
| coppie oltre la tolleranza del Director (0,5 s) | 64/823 (7,8%) | **7/823 (0,9%)** |
| errore sul distacco vs ufficiale — mediana | 0,063 s | 0,064 s |
| errore sul distacco vs ufficiale — massimo | 0,180 s | 0,251 s |

Il massimo peggiora leggermente, e va detto: l'in-lap ha un cum costruito a parte che **si
appoggia** alla catena, quindi chiamare la correzione «invariante sui distacchi» sarebbe
comodo e falso. Resta dentro la soglia di 0,5 s del test del cavo.

**b) L'età gomma stava ferma a giri alterni.** Il feed non manda l'età a ogni passaggio: la
cella leggeva `8 → 10 → 10 → 12`. Non è estetica — l'età è il termine che moltiplica il
degrado (`ρ·età`), quindi un'età ferma è un tempo sul giro sbagliato. Ora si ancora alla
**prima** età vista nello stint e si conta da lì (l'offset del feed, che è il motivo per cui
non ce la si calcola da soli, resta dentro l'ancora).

| | prima | dopo |
|---|---|---|
| coppie in cui l'età non avanza di 1 | 18/822 (2,2%) | **0/822 (0%)** |
| età identiche a quella ufficiale | 836/871 (96,0%) | **845/871 (97,0%)** |

Meglio su entrambi i fronti: non è un compromesso col guardiano, è un dato più giusto.

## 4. Cosa il live NON sa, misurato

Nessuno dei due si corregge: si dichiarano, e **il pannello li scrive sotto la risposta**.

- **Lo stato pista è track-wide.** In gara non esistono bandiere per-auto: 84,8% di accordo,
  65 falsi verdi, 34,1% delle celle di passo oltre 0,10 s (misura ereditata).
- **Il feed non revoca i giri cancellati.** `del: null` farebbe fallire il filtro verde
  apposta, quindi in diretta si dichiara `false`. **Quanto costa, misurato ora sulle 11 gare
  2026**: 162 giri cancellati su 12.733 celle; ignorarli fa entrare nel verde 138 giri di
  troppo, cioè **l'1,34% dei verdi** — un ordine di grandezza sotto il limite precedente.
- **7 cumulati su 823 restano incoerenti** (giri 2–3, quasi tutti out-lap sotto SC: la catena
  del riferimento deve agganciarsi, e l'errore sul distacco vale 5,3 s al giro 2 contro 0,25 s
  dal giro 3). Non si tengono — darebbero al motore un numero che sappiamo sbagliato — e non
  si buttano — un buco nella sequenza dei giri è peggio. Si dichiara ignoto **il solo campo
  che non regge**, con la soglia **importata dal Director**, non riscritta qui.

## 5. La parità, misurata

Flusso vero di Spa 2026 → `live_bylap` → ponte → motore, contro la vista pre-calcolata.

| | |
|---|---|
| risposte prodotte in diretta | **111/116** |
| posizione di rientro identica | **106/111 (95,5%)** — le 5 diverse, tutte di **un solo posto** |
| giro consigliato dalla curva | **mediana 0 giri** di scarto su 89 curve, massimo 2 |
| pit-loss | mediana \|Δ\| **0,000 s** su 111 casi |
| **a parità di celle**, risposta identica campo per campo | **0 differenze su 160** |

L'ultima riga è quella che conta: lo scarto del 4,5% è **la somma dei due limiti dichiarati**,
non due motori diversi. Il test pretende anche che i casi contengano davvero una risposta
(112/160 con posizione): due silenzi sono uguali e non provano niente.

## 6. Cosa perde la diretta, e cosa no

**Il selettore mescola non è più agganciato — e non è una perdita.** Misurato sul pannello
vecchio, su Spa: cambiando mescola la risposta cambiava in **0 casi su 24**. Il motivo sta nel
modello: nel 2026 le mescole **non separano il degrado** (SOFT−HARD p = 0,209). Il bottone era
vivo e rispondeva sempre la stessa cosa, che è peggio di un bottone spento. Resta **visibile**
(mostra su che gomma si sta) e tornerà a decidere con la **Fase 3**.

**Cosa la diretta guadagna:** la banda sulla posizione, la **curva del quando** (che il
pannello vecchio non sapeva porre: sul motore precedente il minimo cadeva al primo giro utile
in 249 casi su 249), il **piano gomme fino alla bandiera**, il Director, e ogni numero con la
sua targhetta.

## 7. Verifiche

| | |
|---|---|
| suite del simulatore | **26/26** (s26 nuova, provata rompendola) |
| trasporti | motore e formattatori verificati; provata la morsa su una copia modificata |
| test del sito | `test_pit`, `test_gradino`, `test_ghostplay`, `test_traiettoria`, `test_live_bylap`, `test_live_timing`, `test_b` — tutti verdi |
| parità live/replay | verde, in CI |
| in pagina | `live.html?demo=Belgio`: pannello, curva, limiti e «Guarda la sosta» funzionanti, **0 errori in console**; `gara.html`: pannello invariato, fondo pagina non ridipinto |

## 8. Resta aperto

- **Il pannello vecchio non è più mostrato da nessuna pagina**, ma `demo/muretto.mjs` non è
  cancellabile: `demo/test_live_bylap.mjs` lo usa ancora come sonda del cavo, e
  `demo/engine.mjs` regge tuttora timeline, hero e generatori di `gara.html`. Il ritiro è un
  giro a sé — E20 dice che i pezzi vecchi si spengono **insieme**, non a metà.
- **Fase 3** (delta per mescola sul fondo, col suo cancello fuori campione): è ciò che
  riaccende il selettore, ed è la richiesta originale del PO («metti la soft e va più veloce
  della dura»).
- La parità è misurata **su una gara sola** (Spa, l'unico flusso registrato che esiste). Una
  seconda registrazione la renderebbe più solida.

---

### Riprodurre

```bash
cd simulatore && node banco/run_suite.mjs && node web/trasporta_motore.mjs --verifica
```

```bash
node demo/test_parita_live.mjs
```
