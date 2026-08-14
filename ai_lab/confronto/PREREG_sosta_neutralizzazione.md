# Prereg — la sosta sotto neutralizzazione: se costa quello che costa davvero, il motore smette di rimescolare troppo?

**Data: 14/08/2026.** Sigillata **prima** di guardare un solo numero di esito.

Chiude il filo lasciato da `REFERTO_movimento_neutralizzazione.md`: dentro le finestre SC/VSC
il motore produce **145** cambi di posizione contro i **122** veri (resa **118,9%**), e
**tutti e 145** vengono dalle soste — perché la compressione conserva l'ordine esattamente e
non può produrre un sorpasso. La sosta neutralizzata è **l'unica sorgente di movimento che il
motore ha lì dentro**.

---

## 0 · Quello che NON sto per misurare, perché è già misurato

Il fattore di neutralizzazione della sosta **esiste già misurato in casa**, e non è mio:
`prior.fattori_neutralizzazione_interni`, prodotto da `esporta_compressione_fondo.mjs` su
**147 gare asciutte e 3.911 soste**, con un controllo che valida il metodo.

| | prior in produzione | misurato in casa | banda dichiarata del prior |
|---|---|---|---|
| **SC** | **0,50** | **0,6227** · IC95 [0,515 ; 0,727] · n=288 su 50 gare | 0,40 – 0,60 |
| **VSC** | **0,65** | **0,7188** · IC95 [0,634 ; 0,845] · n=206 su 45 gare | 0,60 – 0,70 |
| *controllo, soste in verde* | *1,00 per definizione* | ***1,0108*** · *IC95 [0,990 ; 1,030] · n=3.312* | — |

Il controllo in verde a 1,011 è il pezzo che rende credibile il resto: **il metodo, applicato
dove la risposta è nota, la trova.**

Entrambi i misurati stanno **sopra** la banda del prior: **il motore sotto-addebita la sosta
neutralizzata**. È esattamente il verso che serve a spiegare il rimescolamento in eccesso, e
non l'ho scelto io — è nel repo da prima, con `promosso: false`.

**Questa prereg non stima niente e non promuove niente.** `promosso` resta `false`: la
promozione è il cancello **N3 di `PREREG_neutralizzazione.md`**, che decide sul **bias del
passo a 3/5/10 giri** ed è un'altra domanda, con un altro metro, già sigillata.

Io misuro una cosa che N3 non guarda: **cosa succede al MOVIMENTO e agli ARRIVI se la sosta
neutralizzata costa quello che le misure dicono che costa.** Se l'esito fosse favorevole,
non autorizza a promuovere: autorizza a portare a N3 un'evidenza che N3 non aveva.

## 1 · Il fondo, misurato prima

| | |
|---|---|
| cambi in finestra, **veri** | **122** |
| cambi in finestra, **motore** | **145** — eccesso **+23**, resa 118,9% |
| cambi in verde, veri / motore | 224 / 111 (resa 49,6%) |
| \|errore\| medio alla bandiera, 193 casi | **1,6166** |

Casi limite già noti: **Belgio** 30 contro 8 (due finestre di un giro con dentro 15 delle 28
soste), **Miami** 0 contro 11 (finestra di 6 giri con 2 sole soste).

## 2 · La leva, e la prova che è attaccata — fatta PRIMA del sigillo

`fattoriInterni` in `bandiera.mjs`: promuove il fattore misurato **solo per la misura**,
clonando il contesto. È lo stesso interruttore che `pitloss.mjs::fattoreDi` legge da
`promosso`.

**Verificato prima di sigillare, ed è l'unica cosa che ho guardato:**

- spento ≡ default: **bit-identico** (stessa perdita, stessa posizione prevista);
- acceso: l'impronta della traccia **cambia** su Monaco, Belgio e Miami.

È la sonda obbligatoria contro E22 — un override inerte darebbe A/A in silenzio e un
cancello verde senza potere di fallire. Non ho guardato né errore né movimento.

## 3 · I cancelli, dichiarati prima

**S1 — il movimento in finestra si avvicina al vero.** Col fattore misurato, l'eccesso in
finestra (\|motore − vero\|, oggi **+23**) deve **ridursi in valore assoluto**.

> Se **aumenta**, il meccanismo che ho proposto nel referto — «la sosta costa troppo poco,
> quindi scavalca troppe auto» — **è sbagliato**, e va scritto così, non riformulato. Far
> pagare di più una sosta e vedere *più* rimescolamento significherebbe che il rimescolamento
> non viene dal prezzo.

**S2 — gli arrivi non peggiorano.** Sui **193 casi appaiati**, i casi in cui \|errore\|
peggiora non superano quelli in cui migliora; **almeno 20 coppie discordanti**, altrimenti
NULL e non verde; la popolazione resta **193 casi e 48 saltati**.

**S3 — il fattore tocca solo le soste in finestra.** Il numero di soste il cui prezzo cambia
deve essere **esattamente** il numero di soste che cadono dentro una finestra. Non è un
cancello sull'inerzia dei giri verdi — quello sarebbe impassabile per costruzione, come C2 il
13/08, perché un prezzo diverso a metà gara sposta tutto quello che viene dopo. È un cancello
sullo **strumento**: se le soste toccate fossero di più o di meno, la leva starebbe facendo
qualcos'altro.

**S4 — niente regressioni.** `run_suite.mjs` con esattamente le rosse dichiarate; i quattro
banchi del sito verdi. **Nessun file di produzione cambia** in questo lavoro: `promosso`
resta `false` e il sigillo non si tocca, quindi S4 dovrebbe passare per costruzione — e se
non passasse vorrebbe dire che ho toccato qualcosa che credevo di non toccare.

## 4 · Che cosa vorrà dire l'esito

- **S1 verde e S2 verde** → il prezzo della sosta neutralizzata spiega una parte del
  rimescolamento in eccesso, e correggerlo non costa agli arrivi. Si scrive il referto e lo
  si porta a **N3**, che resta l'unico cancello che può promuovere. **Non si promuove qui.**
- **S1 verde ma S2 rosso** → il movimento si sistema e gli arrivi peggiorano. È il caso più
  interessante e il più scomodo: vorrebbe dire che il motore oggi sbaglia *due* volte e le
  due si compensano. Si scrive, non si accende niente.
- **S1 rosso** → il prezzo non è la causa del rimescolamento. Il mio meccanismo era sbagliato
  e la sosta sotto neutralizzazione esce dai candidati.
- **S2 NULL per campione** → il banco non ha potuto decidere sugli arrivi; S1 resta leggibile
  da solo, perché è un conto diretto e non un confronto appaiato.

## 5 · Cosa NON si fa, qualunque sia l'esito

- **Non si promuove `fattori_neutralizzazione_interni`**: la promozione è N3 e ha il suo
  metro (il bias a 3/5/10 giri). Un esito favorevole qui è un'evidenza da portargli, non un
  permesso.
- **Non si tara il fattore.** Si usa la mediana misurata così com'è. Nessuna griglia, nessun
  ottimo: sarebbe la stessa storia del tetto, e lì è finita NULL.
- **Non si tocca la banda del prior** per farci entrare il misurato: il §2 di
  `PREREG_neutralizzazione.md` lo dice già («sostituirlo significa dichiarare che il prior
  esterno è superato, con targhetta, non allargare la banda»).
- **Non si tocca κ, né il pavimento, né il tetto.**

---

*Sigillo: committata prima di misurare S1 e S2. Il commit contiene la leva di laboratorio e
la prova che è attaccata, e non cambia nessun file di produzione: `promosso` resta `false`.*
