# PIANO DI CORREZIONE — da cosa hanno trovato i 21 agenti

*01/08/2026. Ordinato per rapporto fra effetto misurato e costo. Ogni voce nasce da una
CIFRA, non da un'intuizione: dove il numero non c'è, è scritto che non c'è.*

Referto completo: `REFERTO_confronto_motori.md`. Pre-registrazioni: `PREREG_confronto_motori.md`
(il confronto) e `PREREG_holdout_Olanda.md` (il primo fuori campione vero).

---

## Il punto di partenza, in tre righe

Il motore nuovo **vince su M1 e basta**: esatti 45,3% contro 43,0% nella lettura più severa,
mediana dell'errore **pari**, margine di **5 casi su 223** con IC95 che contiene lo zero.
M2/M3/M4 hanno cancelli falliti ma metri che non discriminano. M5 era rotto e ora è a posto.

E il metro stesso era debole: **4 metriche su 5 sotto-specificate**. Tre cancelli non hanno
deciso niente. Questa è la cosa più importante che il confronto ha insegnato.

---

## FATTO in questo giro

| | cosa | effetto MISURATO |
|---|---|---|
| **B** | la banda smette di calibrarsi sul futuro e sul campo del motore | copertura sul metro del prodotto **67,3% → 81,2%**; in pagina non c'è più un 88,5% falso |
| **C** | la curva monta la mescola che il regolamento permette | curve piene **7.453 → 10.131** su 10.131; **0 posizioni cambiate** |
| **D** | la bandiera rossa arriva al prezzo della sosta (`RED = 0,0`, dichiarato e mai raggiunto) | esatti sui casi sotto rossa **4/25 → 12/25**; su tutti i casi **37,7% → 40,8%** |
| **F** | la hero gira sul motore della pagina-gara | stessa domanda → stessa risposta (P1 su 20, dietro ANT); «aspetta 3 giri» P4→**P6**, come la pagina |
| **K.1** | il selettore mescola diventa informazione | era **rotto E inerte**: la pagina ascoltava `data-mesc`, il pannello emette `data-valore` |
| **A** | sigillato il primo fuori campione vero | `PREREG_holdout_Olanda.md`, soglie assolute scritte il 01/08 per una gara del 23/08 |
| **4** | `MIN_GIRI_BASE` da 8 a 4, e la soglia diventa dichiarata nel modello invece che cablata | risposte pre-calcolate **10.131 → 11.143** (+1.012, come previsto); soste vere con risposta 260 → **272 su 274**; esatti sulle risposte preesistenti −1,35 punti (limite 2). Referto: `PREREG_soglia_base.md` |
| **5** | la finestra al posto del giro secco, su tutte le curve pubblicate | 11.143 curve: la finestra copre in mediana il **63,6%** della curva, ed è di un giro solo nel 9,6%. Il giro raccomandato è insensibile all'incertezza del modello (**1 curva su 1.153**): a muoverlo è dove si chiede. Referto: `PREREG_finestra.md` e `PREREG_finestra_pubblicata.md` |
| **N4** | via l'assunzione `stint !== 1` sulle soste dei rivali sotto regime | misurato su 105 gare del fondo che lo stint **non separa** (8,3% · 8,4% · 6,1%); esatti sui casi con regime **44,4% → 55,6%**. Referto: `PREREG_soste_rivali.md` |
| **pit-loss** | mappata tutta la stagione, non solo le gare già corse | mancava **mezza stagione**: Singapore avrebbe usato 22,10 s invece di **27,91**, Italia 22,10 invece di 25,34. Guardie: `s31` e un controllo in `auto_gara.py` |
| **1** | il rodaggio della gomma nuova è in produzione (`c = 0,67 s`, `τ = 4,75 giri`) | M1 lettura B2 leave-one-race-out: esatti **45,29% → 46,64%**, troppo indietro **47,53% → 45,74%**, bias **+0,825 → +0,771**; giro raccomandato invariato in **1.505 curve su 1.505**. Referto: `ESITO_rodaggio.md` |

**Correzione al piano degli agenti su A:** proponevano di mettere in pausa `autocalibra.py`.
I modelli del simulatore sono pinnati in `data/MANIFEST.sha256`, verificato in CI, e nessuna
automazione li tocca: il rischio non è automatico, è umano.

> **Correzione alla correzione, 01/08:** avevo scritto che `autocalibra.py` «non esiste più».
> **Esiste**, in `ai_lab/scienziato/autocalibra.py`, ed è vivo — `gen_modelli_lab.py` lo
> chiama a ogni gara da `auto_gara.py`. La conclusione regge (non tocca i modelli del
> simulatore, solo `modello_traffico_2026` e `modello_degrado_2026`), ma la ragione che avevo
> dato era falsa. Verificato, non ricordato.

---

## ~~VOCE 0~~ · La dodicesima gara ora migliora tutto — **FATTA il 01/08**

> **Direttiva del PO, e ora è un meccanismo e non una frase.** Nel blocco laboratorio
> dell'ondata 1 di `auto_gara.py` entrano, in quest'ordine (e l'ordine è vincolante):
>
> 1. `fisica/stima_v2.py --data <oggi>` → `ρ` e `δ₇₀` dal fondo aggiornato;
> 2. `stima_rodaggio.mjs --scrivi` → `c` e `τ`, che si stimano **con** `ρ` e `δ₇₀` cablati;
> 3. `banco/scrivi_banda_rientro.mjs` → la banda, misurata sul motore risultante;
> 4. `provenienza/ripinna.mjs` → i due hash che sono cambiati;
> 5. `web/genera_vista_gara.mjs --sincronizza` → **solo** le viste fuori passo;
> 6. `web/trasporta_motore.mjs` → il motore nel browser, o diretta e replay divergono;
> 7. `cancello_rodaggio.mjs` → sorveglianza che **conta e non spegne**.
>
> **Le quattro trappole che ho trovato strada facendo, perché nessuna era ovvia:**
>
> - **`stima_v2.py` riscriveva il modello da zero con `scelto: None`.** Automatizzarlo
>   così avrebbe cancellato la decisione pre-registrata su δ₇₀ e tutto il blocco
>   rodaggio, e il costruttore rifiuta di partire senza `scelto`: **il sito sarebbe morto
>   la domenica notte, da solo**. Ora fonde: ciò che misura si sovrascrive, ciò che una
>   prereg ha deciso si conserva.
> - **Aveva la data cablata** (`"2026-07-29"`): avrebbe prodotto numeri nuovi con la data
>   vecchia, che è E22 alla lettera. Ora è `--data`.
> - **`genera_manifest.mjs` non si può mettere nel ciclo.** È dichiarato «atto deliberato,
>   mai in CI» e ha ragione: rigenera *ogni* riga, quindi benedirebbe in silenzio
>   qualunque cosa cambi sotto `data/`, archivio grezzo compreso. Da qui `ripinna.mjs`,
>   che aggiorna solo i file indicati e **si rifiuta di scrivere** se qualunque altro file
>   pinnato è cambiato.
> - **Un allarme che suona sempre non è un allarme.** Il conflitto fra δ₇₀ cablato (2,2) e
>   la stima libera (IC95 [2,74; 3,51]) è noto e deliberato: ora è marcato `noto: true` e
>   la sorveglianza griderebbe solo su un conflitto *nuovo*.
>
> **La sicurezza viene prima, ed è `s29`:** ogni vista porta un timbro coi coefficienti
> che l'hanno generata (ρ, δ₇₀, rodaggio con l'interruttore, sha256 di banda e pit-loss),
> e la sentinella diventa rossa se divergono da quelli cablati. Senza, automatizzare la
> ri-stima avrebbe reso le viste incoerenti col motore **in silenzio** — il generatore
> gira una gara alla volta. `--sincronizza` è la metà costruttiva della stessa idea:
> rigenera le tre gare che servono, non le undici che non servono.
>
> **Cosa resta fuori dal ciclo, deliberatamente:** i **cancelli**. Il dato si ri-stima a
> ogni gara, il verdetto di un KPI pre-registrato no. `attivo` del rodaggio non si tocca
> mai da script; `stima_rodaggio --scrivi` si rifiuta perfino di scrivere se scattano le
> condizioni di NULL della prereg (minimo sul bordo, `τ` instabile). E `replay_g5.mjs`
> resta fuori: è un esperimento chiuso, cambiargli la fisica sotto è E22.

<details><summary>Com'era la voce quando l'ho scritta (il debito, prima che fosse pagato)</summary>

## ⚠ VOCE 0 · La dodicesima gara oggi non migliora quasi niente **[direttiva del PO, 01/08]**

> «Adesso noi stiamo facendo tutto su 11 gare. La logica è che quando se ne aggiunge una
> nuova si deve aggiornare tutto e renderlo più preciso. **Questo vale per tutto il
> progetto.**»

**Sta prima di ogni altra voce perché le contiene tutte:** ogni numero misurato qui sotto —
e ogni numero che le voci aperte produrranno — vive sulle stesse 11 gare, e oggi ci resta.

**Misurato il 01/08 su `auto_gara.py`, `gen_modelli_lab.py` e `.github/workflows/banco.yml`:**

| artefatto | si ri-stima quando entra una gara? |
|---|---|
| `modello_traffico_2026.json` · `modello_degrado_2026.json` | **sì** — `gen_modelli_lab.py` → `autocalibra.py`, ondata 1 |
| vista della gara nuova | **sì** — `genera_vista_gara.mjs <nome>` |
| classifiche, race control, UI, arrivi, classifica-giro | **sì** |
| **`ρ` e `δ₇₀`** (`fisica/stima_v2.py`) | **NO** — zero riferimenti in tutto il repo |
| **`banda_rientro.json`** (`banco/scrivi_banda_rientro.mjs`) | **NO** |
| **`c`, `τ` del rodaggio** (`ai_lab/confronto/stima_rodaggio.mjs`) | **NO** |
| **viste delle altre 10 gare** | **NO** — il generatore è per-gara |

Le ultime quattro righe sono il debito. **E le prime tre e le ultime sono accoppiate:** il
giorno in cui `ρ`, `δ₇₀`, `c` o `τ` si ri-stimassero, le viste già pubblicate diventerebbero
incoerenti col motore **in silenzio** — nessuna sentinella confronta i coefficienti con cui
una vista è stata generata contro quelli cablati oggi.

- **Cosa serve, in ordine:** (1) una sentinella che leghi ogni vista ai coefficienti che
  l'hanno prodotta e diventi rossa quando divergono — senza quella, automatizzare la
  ri-stima è *pericoloso*, non utile; (2) i tre stimatori dentro l'ondata post-gara, con
  `check=False` come tutto il blocco laboratorio; (3) la rigenerazione di **tutte** le viste
  quando un coefficiente si muove, non solo di quella nuova.
- **Cosa NON va automatizzato, e va scritto perché qualcuno ci proverà:** i **cancelli**. Si
  ri-stima il DATO a ogni gara; il VERDETTO di un KPI pre-registrato resta una decisione con
  prereg. È la regola che il blocco laboratorio di `auto_gara.py` già dichiara, e vale anche
  per `PREREG_rodaggio.md` e `PREREG_difesa.md`.
- **Il primo banco di prova è già fissato:** l'Olanda del **23/08** (`PREREG_holdout_Olanda.md`)
  è la dodicesima gara. Se arriva e il cuore del simulatore resta a 11, quel fuori campione
  si sarà speso per misurare un motore fermo.

</details>

> **Nota per l'Olanda, che nasce da questa voce e va letta prima del 23/08.** Adesso che il
> ciclo ri-stima da solo, la dodicesima gara **cambierà `ρ`, `δ₇₀`, `c`, `τ` e la banda
> prima** che qualcuno misuri l'holdout. `PREREG_holdout_Olanda.md` fissa soglie assolute
> scritte il 01/08 su un motore tarato su 11 gare: va deciso — **prima** del 23/08 — se
> l'holdout si misura col motore *pre*-Olanda (fuori campione vero, e allora la ri-stima va
> fatta *dopo* la misura) o col motore *post*-Olanda (che avrebbe visto la gara che sta
> giudicando, e non sarebbe più fuori campione). **È una decisione, e va presa da sveglio,
> non scoperta la domenica sera.**

---

## APERTO, in ordine di priorità

### ~~1 · Il rodaggio della gomma nuova~~ — **FATTO il 01/08**, referto in `ESITO_rodaggio.md`

*Resta scritto qui com'era, perché due sue previsioni si sono rivelate sbagliate e la
prossima persona deve poterle leggere accanto a ciò che è successo davvero.*

**Cosa è successo:** `c = 0,67 s`, `τ = 4,75 giri`, stimati in aria libera con `δ₇₀` e `ρ`
cablati. Cancello M1 lettura B2 leave-one-race-out: tutte e quattro le condizioni passano
(mediana 1,0 · esatti 46,64% · troppo indietro 45,74% · bias +0,7713). Margine piccolo:
10 casi meglio, 2 peggio, 211 identici su 223.

**Due cose che questo piano diceva e che non erano vere:**

1. **Il rischio E01 non esisteva.** «Con τ troppo grande il termine degenera in un vantaggio
   quasi-perpetuo, cioè fermati subito» è **falso per costruzione**: l'ottimo a una sosta
   cade dove l'età al pit eguaglia l'età alla bandiera (`a+k = R−k`), e lì
   `w(a+k) − w(R−k) = 0` **per qualunque `w` additiva sull'età**. La derivata seconda cresce
   da `2ρ` a `2ρ + (c/τ)[…]`: il minimo si stringe. Misurato sul prodotto: il giro
   raccomandato non cambia in **nessuna** delle 1.505 curve. `s12` ora lo prova anche con
   `τ = 200`.
2. **Il cancello mescolava due letture.** Nominava la lettura B2 ma citava `49,8%` e `+0,96`,
   che sono numeri della lettura A. Riscritto coi valori B2 (`47,53%` e `+0,8251`) misurati
   prima di qualunque modifica.

**Il prezzo, lasciato rosso e non nascosto:** `bias piatto` passa da 0,0041 a **0,1030**
contro una soglia pre-registrata di 0,1 — fallisce di tre millesimi. È la faccia opposta
della stessa proprietà che fa migliorare M1: la base ora è il passo su gomma matura, e in
una proiezione senza soste le età solo crescono. La soglia **non** è stata toccata (E08).

**E la risposta alla voce 3:** il rodaggio sposta D1 NEUTRA da 77,4% a **78,6%**. Non basta.

<details><summary>Il testo originale della voce, per confronto</summary>

**Perché, misurato:** in aria libera i giri a età 2-8 dopo una sosta girano **0,275 s/giro più
veloci** di quanto il modello preveda (IC95 [−0,415; −0,037], n = 1.249, mediana negativa in
8 gare su 10); a età 9-20 il residuo è 0,000. È la regione che il prodotto usa di più: ogni
«se fermo adesso» proietta un pilota che riparte da età 1 contro rivali a età alta. Sette giri
× 0,275 s ≈ **1,9 s**, l'ordine di grandezza di una posizione — ed è coerente col bias di
**+0,96 posizioni** del motore nuovo (mette il pilota più indietro del vero nel 49,8% dei casi
contro il 9,9% in cui lo mette più avanti).

**È anche la strada per D1**, che oggi è rosso: la banda sotto neutralizzazione non arriva
all'80% e **allargarla non è la risposta** — togliere il bias dalla previsione sì.

- **File:** `simulatore/engine/passo_v2.mjs` — `creaPasso` **e** `stimaBasi`. Lo stesso `w` va
  sottratto misurando e ri-aggiunto simulando, **nella stessa modifica**, o è il difetto del
  carburante daccapo (E02, −1,48 s/giro). `c` e `τ` in `modello_v2.json` con targhetta.
- **Cancello, da scrivere PRIMA:** M1 in lettura B2 — mediana ≤ 1,0 **ed** esatti ≥ 45,3%;
  **più** una condizione sul segno: la quota «troppo indietro» deve scendere dal 49,8% e il
  bias medio da +0,96 verso 0. Leave-one-race-out su (c, τ).
- **Rischio dichiarato:** con τ troppo grande il termine degenera in un vantaggio
  quasi-perpetuo dopo la sosta, cioè **E01**: «fermati subito» nel 100% dei casi. Serve la
  sentinella analitica che l'ottimo a una sosta resti a `(giri rimasti − età)/2`.
- **Nota:** M2 è un giudice debole qui (in una finestra senza soste tutte le età avanzano
  insieme e `w` si cancella nel distacco). **Il giudice è M1.**

</details>

### 2 · Il pacchetto neutralizzazione — **NULL il 01/08**, referto in `PREREG_neutralizzazione.md`

> **Due pre-registrazioni, due NULL, e in mezzo il fenomeno vero.**
>
> **PREREG-1 → NULL per no-op.** «Slegare il regime dalle soste» non fa niente: acceso e
> spento danno lo stesso numero su tutte e 821 le righe con regime. Il regime alimenta solo
> `perditaBox` e le soste dei rivali — entrambe legate alle soste — e il passo non sa cosa
> sia (zero occorrenze in `passo_v2.mjs` e `kernel.mjs`).
>
> **PREREG-2 → NULL per overcorrezione.** Il fenomeno vero è la **compressione dei
> distacchi**, misurata sul fondo: κ = **0,691** sotto SC (IC95 [0,614; 0,772], 71 gare) e
> **0,930** sotto VSC, col controllo in verde a 1,031 che valida il metro. È grande: dove il
> bias era grosso lo demolisce (Giappone 1,96 → 0,34, Austria 0,96 → 0,17). **Ma un κ solo
> overcorregge**: il segno del bias aggregato si ribalta da +1,62 a −0,79, e le tre gare che
> peggiorano sono quelle che partivano quasi giuste. C1 passa, **C2 fallisce (4 gare su 7)**.
>
> Era leggibile nella dispersione, ed era già scritto: sotto SC κ ha p25-p75 **0,36-1,01**.
> In un quarto dei casi il distacco non si comprime affatto.
>
> **Cosa resta costruito:** il kernel sa comprimere i distacchi (ciclo per giro, `s30` con
> tre mutazioni provate, golden identici a termine spento), e i tre blocchi misurati stanno
> nel prior con `promosso: false` e si ri-stimano a ogni gara. Il giorno in cui κ avrà la
> forma giusta — condizionato a qualcosa di noto al congelamento, con una prereg nuova — non
> c'è niente da costruire.

<details><summary>Il testo originale della voce</summary>

### 2 · Il pacchetto neutralizzazione — quattro voci, un solo cluster
**Perché:** è dove **quattro metriche su cinque** puntano il dito, ed è l'unico ramo in cui il
motore nuovo **perde** contro il vecchio (n = 17, esatti 35,3% contro 41,2%). Va fatto insieme
o non va fatto.

1. **Slegare il regime dalle soste.** `costruttore.mjs` ha
   `const regime = soste.length ? … : null`: il meccanismo di neutralizzazione è **inerte in
   proiezione pura**. Sotto regime il bias del nuovo è **1,964 s/giro** contro 0,033 in verde.
   Controfattuale misurato: bias 1,068 → 0,699 (3 giri), 0,623 → 0,333 (5), 0,303 → 0,055 (10),
   migliora in 7 gare su 8; sui congelamenti verdi il risultato è **bit-identico**.
2. **`PERSISTENZA_REGIME_GIRI` misurata e distinta.** Vale 1 per entrambi i regimi e non ha
   targhetta. Misurato: dato SC al giro L, il regime è ancora in corso al **72%** a L+2 e al
   58% a L+3 (mediana 3 giri); dato VSC, al 41% a L+2 (mediana 1). **È giusta per il VSC e
   sbagliata per la SC di un fattore 3.**
3. **Il fattore di neutralizzazione, misurato in casa.** Oggi è un prior esterno (SC 0,50,
   VSC 0,65) mai validato sul fondo, mentre la parte verde è già promossa su 26 GP. Misurato
   dai soli `cum_time`: **SC 0,758, VSC 0,867** — entrambi sopra la banda dichiarata, cioè il
   motore **sotto-addebita** la sosta neutralizzata. Il controllo valida il metodo: in verde il
   fattore realizzato è 0,958. Il dato esiste ed è buttato via (`soste_fondo.json` scarta 1.597
   soste non verdi).
4. **Le soste dei rivali sotto SC.** L'assunzione `stint !== 1` ferma 148 rivali e ne azzecca
   25 (**16,9%**), e **a Monaco ne assume zero** mentre 360 rivali entrano davvero.
   Spegnendola: esatti 27,5% → 35,3% sui casi con regime, ma il bias medio *peggiora*
   (+1,16 → +1,37). **Le due letture non concordano: il cancello va scritto prima.**

- **Cancello del pacchetto:** M2 ristretto ai congelamenti con regime (n = 291/266/191),
  dichiarando prima se decide il bias o l'errore assoluto; **più una sentinella di non-danno
  sui congelamenti verdi, che deve restare identica al bit**; poi M5 sui 180 casi con regime.
- **Da NON credere:** questo **non** risolve M5. Dei casi fuori banda, 70 su 84 partono in
  verde e finiscono neutralizzati: lì il regime non è conoscibile e nessun fattore li recupera.
- **Il tranello, da mettere nella prereg:** la regola ovvia («guarda il campo al giro L»)
  recupera 36 casi e porta la banda dal 37,1% al 91,4%. **È futuro d'orologio:** delle celle di
  chi ha già chiuso il giro L prima di me, **0 su 265** sono neutralizzate; di chi lo chiude
  dopo, **402 su 713**. La versione causale onesta (`cum_time <= il mio`) accende 9 casi, di cui
  2 sbagliati. Va scritto che «indice di giro ≤ L» **non è** la definizione di informazione
  ammessa, o il prossimo vedrà il +54 di copertura e lo accenderà.

</details>

### ~~3 · D1 sotto neutralizzazione~~ — **DECISA il 01/08**, e non con (a) né con (b)

> **Il PO ha delegato la scelta.** Prima di decidere sono andato a vedere cosa la pagina
> dice **oggi**, e la risposta ha cambiato la domanda: il record pubblica già
> `livello: 0.8` **accanto a** `copertura: 0.7857`, con la targhetta «copre il 78,6% fuori
> campione». Non si stava pubblicando niente di falso.
>
> Il difetto era un altro, e più sottile: **i due numeri stavano affiancati e toccava al
> lettore accorgersi che non coincidono.**
>
> **Quindi né (a) né (b).** Non si ri-registra il livello — sarebbe riscrivere un cancello
> dopo averne visto l'esito (E08), e il piano stesso lo diceva. Non si smette di pubblicare
> la banda — toglierebbe informazione proprio dove la decisione è più difficile. Il record
> ora porta `livello_raggiunto: false` e un avviso che dice *perché*: che quel livello non è
> attingibile con l'informazione al congelamento, che allargare la banda **peggiora**
> (77,4% → 58,3% fuori campione), e che togliere il bias dalla previsione ha reso **+1,2
> punti** e non è bastato.
>
> **`D1` resta rosso**, ed è giusto così: è la registrazione onesta del fatto che il modello
> non arriva dove speravamo. Un cancello rosso che dice la verità vale più di un cancello
> verde riscritto.

<details><summary>Il testo originale della voce</summary>

### 3 · D1 sotto neutralizzazione: decidere, non aggiustare **[decisione del PO]**

> **01/08 — il PO ha scelto (c), aspettare la voce 1. La voce 1 è stata fatta e la
> risposta è: non basta.** Col rodaggio acceso e la banda ricalibrata, D1 NEUTRA passa
> da **77,4% a 78,6%** fuori campione (VERDE da 87,9% a 88,2%, complessiva da 85,4% a
> 85,9%). La soglia pre-registrata è 80% e resta rossa.
>
> **Restano (a) e (b).** L'unico candidato ancora in piedi che potrebbe spostarla davvero
> è il **pacchetto neutralizzazione della voce 2** — e va detto che anche lì il referto
> avverte già: dei casi fuori banda, 70 su 84 partono in verde e finiscono neutralizzati,
> e lì nessun fattore li recupera con l'informazione ammessa. Se anche la voce 2 non
> bastasse, (a) e (b) non sono un ripiego: sono la risposta.

Oggi **rosso**: 77,4% contro l'80% pre-registrato. Con l'informazione disponibile al
congelamento quel livello **non è raggiungibile**, e le due scorciatoie sono già state provate
e misurate:
- banda **asimmetrica a due gradi di libertà** (larghezza minima): **peggiora**, 77,4% → 58,3%
  fuori campione. Con 84 casi sovradatta. *Resta scritto in `banco/misure/difesa.mjs` perché il
  prossimo che legge D4 rosso avrà la stessa idea in cinque secondi.*
- banda **traslata del bias** (un grado): regge, ed è quella in produzione.

Le tre strade, tutte legittime: (a) ri-registrare il livello per NEUTRA sul misurato,
dichiarando che 0,8 non è attingibile; (b) non pubblicare banda sotto neutralizzazione;
(c) aspettare la voce 1, che è l'unica che può spostare il numero davvero.
**Ri-registrare adesso, dopo aver visto il risultato, sarebbe E08** — per questo la voce è
qui e non è stata eseguita.

</details>

### 4 · `MIN_GIRI_BASE` da 8 a 4, e dichiarare il «non ancora»
**Perché:** la soglia nasce come criterio di **ammissione del banco** ed è migrata nel motore
come costante muta, cablata in 5 punti. Come soglia di qualità non regge: una base su 4-7 giri
sbaglia **0,314 s/giro** contro **0,386** delle basi su 8+ giri, e per secchio l'errore non è
ordinato dal numero di giri.
- **Effetto misurato:** base disponibile 89,8% → 98,7% (**+1.012 caselle**); congelamenti ai
  giri 5-7 da 0,0% (per costruzione) a 73-88%; soste vere 260/274 → 272/274.
- **File:** `simulatore/scenario/costruttore.mjs`, poi `trasporta_motore.mjs` e
  `genera_vista_gara.mjs`. A parte: lasciare fermo `min_giri_base` in `banco/prereg/` e
  ri-etichettarlo — è un criterio del banco, non del motore.
- **Cancello, da scrivere PRIMA:** (a) la copertura sale; (b) gli esatti sulle 260 risposte
  preesistenti non calano di più di 2 punti; (c) lo scarto appaiato dell'errore di base fra
  4-7 e 8+ ha IC95 che contiene lo zero. *Oggi: +1.012 · −1,1 punti · verificato.*
- **Rischio:** non è additivo — il campo cresce in 15 casi su 260 e la posizione già pubblicata
  cambia in 7 (2 migliorano, 3 peggiorano). E la qualità delle risposte **nuove** non è
  certificata (n = 12 con verità). **4 è un pavimento:** sotto i 4 giri il degrado c'è ed è
  misurato.
- **Poi, non prima:** sostituire il pannello muto con «servono k giri verdi, ne hai j — la
  prima risposta è al giro N». Farlo *al posto* dell'abbassamento è un cartello educato davanti
  a 1.012 caselle che potevano essere piene.

### 5 · Il pavimento di rumore della curva del «quando»
**Perché:** sulle viste pubblicate **4.241 raccomandazioni** (56,9% delle curve) hanno un
minimo interno, e il guadagno promesso è **sotto 1 s nel 29,0%** dei casi e sotto 3,3 s nel
55,4% — mentre l'unico errore mai misurato di questo motore vale ~3,2 s cumulati a 10 giri, e
la curva integra fino alla bandiera (58 giri). Il solo arrotondamento al millesimo sposta il
giro raccomandato in **25 curve su 260**.
- **Cosa:** un banco che ricalcola la curva perturbando **dentro l'incertezza che il modello
  dichiara di sé** (ρ e δ₇₀ agli estremi dell'IC95, pit-loss agli estremi già stampati in
  targhetta, fattore SC/VSC nella banda, L±1) e riporta la dispersione del giro raccomandato.
- **DECISIONE DEL PO, 01/08: finestra sempre.** Il giro raccomandato non si pubblica più come
  giro secco: si pubblica un intervallo, in ogni caso, senza cancello condizionale. Coerente
  col fatto che il 29,0% delle raccomandazioni promette meno di 1 s e che il solo
  arrotondamento al millesimo sposta il giro in 25 curve su 260. Il banco di perturbazione
  serve ancora — non più per **decidere** fra secco e finestra, ma per dire **quanto larga**
  deve essere la finestra, e la sonda obbligatoria a perturbazione nulla resta obbligatoria.
- ~~**Cancello, da scrivere prima:** il giro si pubblica come **giro secco** solo se sotto ogni
  perturbazione si sposta di ≤ 2 giri nell'≥ 80% dei casi; altrove si pubblica una
  **finestra**.~~ *Superato dalla decisione qui sopra.*
- **Sonda obbligatoria:** con perturbazione nulla il banco deve riprodurre i 4.241 minimi
  interni e la mediana di 2,770 s. Se non li riproduce, non sta misurando il prodotto.
- **Perché adesso:** la voce C (già fatta) ha **moltiplicato per quattro** le curve pubblicate.
  Se sono rumore, le ha moltiplicate lo stesso.
- **Materiale già pronto dalla voce 1:** `sonda_curva_rodaggio.mjs` ricalcola la curva sotto
  due modelli e confronta l'argmin su 1.505 curve vere in ~5 minuti. È lo scheletro del banco
  di perturbazione — cambia solo *cosa* si perturba. E porta già un numero utile: **il
  rodaggio, che sposta il passo di mezzo secondo al giro dopo la sosta, non sposta il giro
  raccomandato nemmeno una volta.** Se il giro è rumore, non è rumore del passo.

### 6 · L'errore alla bandiera, contro `data/arrivi_2026.csv`
**Perché:** quel file contiene la classifica finale vera di tutte le 241 coppie pilota-gara e
ha **zero riferimenti in tutto il repo**. Nessuno l'ha mai usato. Intanto M1 misura a **2 giri**
dal congelamento e M2 si ferma a 10, mentre la curva integra fino a ~58: **fra i 10 giri
misurati e la bandiera non c'è nessuna misura.** E c'è motivo di aspettarsi che lì il confronto
cambi — nell'ultimo terzo di gara il nuovo passa M2 su tutti e tre gli orizzonti.
- **Da pre-registrare:** solo 114 delle 241 coppie hanno una cella al giro finale; la regola per
  doppiati (45) e ritirati (41) va fissata prima. Usare le soste reali di tutti è informazione
  dal futuro — legittima perché identica per i due motori, ma va etichettata a caratteri cubitali.
- **Costo: grande.** È l'unico modo di sapere se «vince il nuovo» vale oltre due giri.

### ~~7 · Igiene del banco~~ — **CINQUE VOCI SU CINQUE FATTE il 01/08**

> - **`giro_di_rientro` non mente più.** Era cablato a `caso.rientroLap`: con orizzonte 5
>   diceva 10 invece di 15, proprio sul percorso di chi misura M2 e M3.
> - **La ri-classificazione è una funzione del banco** (`riclassifica`). Prima ogni misura
>   se la riscriveva in casa e due agenti potevano riportare due numeri diversi dello stesso
>   M1 senza che nessuno avesse torto. Verificata: A 42,98% · B 45,11% · B2 45,53%.
> - **La finestra pulita esclude anche le neutralizzazioni.** Sotto Safety Car il distacco
>   non evolve dal passo — si comprime del 30% a giro — quindi lì non si misura l'errore
>   della base. Misurato oggi: **672 finestre** su 5.186, e toglierle porta il p90 da
>   **1,656 a 1,185 s/giro** (mediana 0,413 → 0,371). *Il piano citava 502 finestre e un p90
>   da 4,600 a 0,839: quelle erano su un secchio specifico e col motore di allora — la
>   direzione è la stessa, i numeri no, e vale il misurato di oggi.*
> - **E21 chiuso con una cifra**, e la cifra dice di non toccare niente: δ₇₀ implicato 3,08
>   su tutti i giri verdi e **2,43 in aria libera**. Il conflitto era **contaminazione da
>   traffico**, non evoluzione della pista. `δ₇₀` resta 2,2.
> - **`s15` ri-baselinata** con una prereg sua (`banco/prereg/PREREG_ribaseline.md`): i
>   fallimenti passano da sei a tre, e i tre che restano sono tutti già dichiarati.

<details><summary>Il testo originale della voce</summary>

### 7 · Igiene del banco — nessun numero visibile, ma protegge le prossime misure

> **Due voci di questa lista sono state chiuse dalla voce 1, perché le serviva.** Non
> erano gentilezze: senza, il rodaggio non era misurabile.
>
> - **FATTO — il banco misurava un motore che non esiste.** `misure/rientro.mjs`,
>   `misure/bias.mjs`, `misure/g0.mjs` e `misure_congelamento.mjs` chiamano
>   `creaPasso`/`stimaBasi` da soli, senza passare dal costruttore: col rodaggio acceso in
>   produzione avrebbero continuato a misurare il passo **senza**. È E12 nella sua forma
>   silenziosa, e per un'ora è successo davvero — `s25` dava numeri identici al bit prima e
>   dopo l'accensione, ed è così che l'ho scoperto. Chiuso facendo viaggiare `rodaggio`
>   insieme a `ρ` e `δ₇₀` in `misura_tutto.mjs`, e stampato nella targhetta del riassunto.
>   **`replay_g5.mjs` è stato lasciato fuori apposta:** è un esperimento chiuso con esito
>   pre-registrato, e cambiargli la fisica sotto ne riscriverebbe il risultato (E22). Va
>   rifatto con una prereg sua.
> - **FATTO — il modello si può sostituire senza toccare il disco.** `contestoNuovo` e
>   `rispostaNuovo` accettano un modello alternativo, che non finisce mai in cache. Serviva
>   a valutare 11 varianti leave-one-race-out; serve a chiunque debba misurare una variante
>   senza scrivere su `data/`.
>
> **Una voce nuova, scoperta qui:** `banco.mjs` consegna i casi col nome di SITO
> («Gran Bretagna») mentre i modelli indicizzano col nome del SIMULATORE
> («GranBretagna»). C'è già `garaSimDi` che traduce, ma niente lo impone: chi scrive una
> misura nuova indicizza col campo che ha in mano e scopre l'errore solo se una gara manca.
> È E24 che aspetta il prossimo. Costerebbe poco farlo dichiarare dal banco.

- **`ai_lab/confronto/banco.mjs`:** `giro_di_rientro` è cablato a `caso.rientroLap` e non segue
  le opzioni — **mente** appena si varia l'orizzonte, cioè sul percorso di chi misura M2/M3.
- **Esporre la ri-classificazione sulla popolazione comune** come funzione del banco: oggi due
  misure indipendenti dello stesso M1 possono divergere di 6 punti senza che nessuna sbagli.
- **Escludere la neutralizzazione dalla finestra pulita** quando si misura la qualità della
  base: 502 finestre su 5.186 fabbricano tutta la coda (p90 da 4,600 a 0,839 s/giro).
- **Chiudere E21 con una cifra:** la pendenza residua sul giro implica δ₇₀ = 3,08 su tutti i
  giri verdi e **2,43 in aria libera** (IC che contiene lo zero) — il conflitto 3,11 contro 2,2
  è **contaminazione da traffico, non evoluzione della pista**. *Non spostare il valore cablato:
  i dati non lo chiedono.* Stessa cosa per ρ (0,0359 in aria libera, IC della correzione
  contiene lo zero → **non si tocca**).
- **Ri-baselinare le linee di regressione di `s15`** (87,4% / 67,7% / 94,3%): sono state
  misurate col metro vecchio, quello che leggeva il futuro. Confrontare la misura onesta con una
  baseline disonesta non significa niente — **e si fa con una prereg nuova, non con un edit.**

</details>

### PARCHEGGIATA · il traffico come penalità sul passo
Il fenomeno è il più regolare trovato (residuo **+0,576 s/giro** sotto 0,5 s di gap, positivo
in 11 gare su 11, riguarda il 19,6% dei giri), **ma il controfattuale sul bersaglio è
negativo**: leave-one-race-out il bias peggiora su tutti e tre gli orizzonti e il confronto
appaiato è 53%. Il cancello M2 non passerebbe. Resta difendibile solo la de-contaminazione
della **base** (il 17,3% dei casi ha la base sporca di oltre 0,25 s/giro), e solo con un
cancello M1 pre-registrato — accettando che rompe deliberatamente la simmetria
misura/predizione, cosa da dichiarare e non da nascondere in una riga di stimatore.

---

## Difetti MIEI, in questo giro, a referto

1. **Ho rotto la generazione delle viste** con la correzione della bandiera rossa: per `RED`
   non esiste una banda di neutralizzazione dichiarata, e `curvaDelQuando` la leggeva senza
   guardia. La generazione è morta a Monaco lasciando **8 gare nuove e 3 vecchie** — e a
   prenderlo è stata `s27`, la sentinella che avevo scritto due giorni prima per il bug del
   manifest. Corretto: dove il regime non ha una banda dichiarata la banda **non si disegna** e
   la nota dice perché (per la rossa il fattore è 0 per dichiarazione, non per stima).
2. **Il mio primo tentativo di verificare M3 era storto:** confrontavo i costi a fine finestre
   di lunghezza diversa, e una finestra più lunga è sempre più cara — quindi «vinceva» sempre il
   primo giro. Si misura a **giro finale comune**. Rifatto, l'agente aveva ragione e io no.
3. **Ho misurato la copertura della banda con tre convenzioni diverse** (46,6% · 73,9% · 81,2%)
   prima di accorgermi che il denominatore *era* il problema. Il numero pubblicato è quello
   dello script validato, con la convenzione dichiarata.
4. **Nella voce 1 ho scritto una clausola di non-danno impossibile:** «la suite del banco
   (s01…s27) deve restare verde», quando `s15` e `s25` erano **già rosse** quando l'ho scritta.
   Una condizione insoddisfacibile dal primo minuto non è una tutela: è una riga che si può
   interpretare come fa comodo il giorno in cui qualcosa si rompe. Andava scritta come
   «nessuna asserzione oggi verde diventa rossa» — che è la cosa che intendevo, ed è la cosa
   che poi è successa (`bias piatto`, di tre millesimi). Il difetto è mio e resta qui: la
   regressione l'ho portata comunque al PO invece di risolverla con la clausola in mano.
5. **La mia prima asserzione sulla magnitudine in `s28` era sbagliata:** avevo scritto che
   cablare `w` da un lato solo sbaglia «di un ordine `c`». No: la base assorbe la **mediana**
   di `w` sulle età osservate, quindi il difetto è un offset costante di 0,074 s, non 0,67.
   La sentinella lo pretende ora al miliardesimo, invece che con una soglia comoda.

---

## Cosa resta ignoto — e non si chiude lavorando di più

1. **Il fuori campione, cioè tutto.** `modello_v2.json`, `banda_rientro.json` e il pit-loss
   «realizzato» di Gran Bretagna e Miami sono tarati sulle stesse 11 gare del banco. Il
   leave-one-race-out resta dentro quelle 11. **Nessun numero di questo confronto è mai stato
   prodotto fuori campione.** Prima occasione: **23 agosto**.
2. **L'orizzonte che il prodotto usa davvero.** Misurato: 2 giri (M1) e 10 (M2). Pubblicato:
   fino alla bandiera (~58). Il verdetto «vince il nuovo» poggia su 5 casi su 223 a due giri.
3. **Il ramo Safety Car:** n = 17, e lì il vecchio è davanti. Indicativo, non concludente.
4. **I 70 casi su 209 che partono in verde e finiscono neutralizzati.** Copertura della banda
   lì: 32,9% contro 84,2%. Un terzo del campione che nessun modello può vincere con
   l'informazione ammessa.
5. **Il rifiuto del Director:** zero occorrenze in tutta la vista (0 su 11.290). Il ramo esiste,
   è nel cancello M4, e non è mai stato esercitato su dati veri.
6. **Monaco** entra nel confronto al 21% della sua taglia (10 casi su 47), perché il vecchio è
   muto in 35. Qualunque numero pooled è una statistica su dieci gare e mezza.
7. **Se il vecchio in produzione fosse davvero peggiore.** Il suo vantaggio apparente (46,6%
   contro 43,9%) **si compra con un solo giro di informazione dal futuro**: legge `neutralized`
   al giro della sosta e assume 669 soste-rivali non conoscibili al congelamento. Non sappiamo
   quanto varrebbe un motore che quel giro non lo avesse — non esiste.
