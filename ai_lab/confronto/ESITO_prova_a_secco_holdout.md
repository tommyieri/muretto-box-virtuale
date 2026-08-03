# ESITO — la prova a secco dell'holdout, e il guasto che ha trovato

**Data: 03/08/2026, venti giorni prima di Zandvoort.** Protocollo:
`PREREG_holdout_Olanda.md`. Strumento nuovo: `ai_lab/confronto/holdout.mjs`.

---

## 1 · Il primo guasto: lo strumento non esisteva

Al 03/08 **nessuno script del repo calcolava le metriche dell'holdout per UNA gara**, e
nessuno accettava un `--gara`. Il protocollo era scritto, i cancelli pre-registrati con le
loro soglie, il lucchetto contro la ri-stima automatica in piedi — ma lo strumento per
eseguire la misura sarebbe stato scritto **la domenica sera**, sotto la pressione della
gara appena finita, da qualcuno che non poteva più provarlo.

Adesso esiste, ed esegue il protocollo nell'ordine che la prereg impone: verifica dei
cinque hash del sigillo **prima** di misurare (regola 4), perimetro con la soglia dei 15
casi (regola 3), M1 in lettura B2, M5 col metro del prodotto, i cancelli H1…H5 con le
soglie copiate e non toccate, e l'avvertimento di H4 stampato d'ufficio invece che
ricordato.

## 2 · Il guasto vero: i cancelli falliscono anche in casa

La prova a secco su tutte e undici le gare **che i modelli hanno già visto** — quindi
in campione, dove il motore dovrebbe andare al meglio:

| gara | n | esatti nuovo | H1 | H2 | H3 | H4 | H5 |
|---|---|---|---|---|---|---|---|
| Australia | 21 | 33,3% | ✗ | ✗ | ok | ✗ | ok |
| Austria | 28 | 57,1% | ok | ok | ok | ok | ok |
| Belgio | 20 | 35,0% | ✗ | ok | ✗ | ok | ok |
| **Canada** | **11** | — | **NON GIUDICABILE — meno di 15 casi** | | | |
| Cina | 15 | 20,0% | ✗ | ✗ | ok | ✗ | ok |
| Giappone | 24 | 27,3% | ✗ | ok | ok | ok | ok |
| Gran Bretagna | 30 | 53,6% | ok | ok | ok | ok | ok |
| Miami | 18 | 55,6% | ok | ok | ok | ok | ok |
| Monaco | 47 | 66,7% | ok | ok | ok | ok | ok |
| Spagna | 29 | 41,4% | ok | ok | ✗ | ok | ok |
| Ungheria | 31 | 67,7% | ok | ok | ok | ok | ok |

> **H1 — il cancello principale — fallisce su 4 gare su 10 GIUDICABILI, in campione.**
> H3 su 2, H2 su 2, H4 su 2. E una gara su undici non è nemmeno giudicabile.

**Se il 23 agosto Zandvoort fallisse H1, non impareremmo niente**: lo stesso protocollo
fallisce a quel ritmo su gare che i modelli hanno visto. Un cancello che boccia il 40% dei
casi buoni non distingue il fuori campione dal caso.

## 3 · Perché succede, ed è aritmetica

Le soglie sono state scritte sull'**aggregato**: 45,3% di esatti su 223 casi. Vengono
applicate a **una gara sola**, dove i casi ammessi vanno da 15 a 47 (mediana 26).

Con n = 20, **un solo caso vale 5 punti percentuali** e l'errore standard della quota è
**±11,1 punti**. La soglia H1 sta 5 punti sotto il valore aggregato: è dentro il rumore.
La dispersione osservata lo conferma — da **20,0%** (Cina) a **67,7%** (Ungheria), con
mediana 47,5%.

Non è che il motore vada male su quelle quattro gare: è che **una gara sola non porta
abbastanza informazione** per una soglia assoluta fissata a quel livello.

## 4 · Cosa NON si fa

**Non si abbassa la soglia.** La prereg lo vieta (regola 5, E08) e avrebbe ragione anche se
non lo vietasse: abbassarla adesso che si è visto quante gare boccia sarebbe tararla sul
risultato.

**Non si allarga il perimetro** per portare Canada sopra i 15 casi.

## 5 · Cosa si può fare, e spetta al PO

Siamo a **venti giorni** dalla gara e Zandvoort non è ancora corsa: **pre-registrare adesso
un cancello nuovo è legittimo**, ed è esattamente la stessa logica per cui la prereg
dichiara che ri-firmare gli hash *prima* della gara è lecito e *dopo* non lo è.

La forma che raccomando — e che il KPI **Z1** già suggerisce con le sue parole, *«l'errore
sta ENTRO la banda misurata sul fondo»* — è **confrontare Zandvoort con la distribuzione
per-gara, non con una soglia assoluta**:

> **H1′ (proposta).** Gli esatti M1-B2 di Zandvoort non cadono **sotto il minimo** delle
> dieci gare giudicabili in campione (20,0%), e la loro posizione dentro quella
> distribuzione si riporta come percentile.

È più severo dove conta — chiede che il fuori campione non sia peggiore della **peggiore**
gara vista — e smette di punire la varianza di una gara sola. La distribuzione di
riferimento è già misurata e si può congelare oggi: `[20,0 · 27,3 · 33,3 · 35,0 · 41,4 ·
53,6 · 55,6 · 57,1 · 66,7 · 67,7]`.

**Non lo decido io**, per due ragioni: cambia un cancello pre-registrato, e i vecchi H1…H5
sono comunque già firmati. Le opzioni sono tre: lasciare tutto com'è sapendo che un
fallimento non sarà informativo; affiancare H1′ ai cancelli esistenti in una pagina nuova e
datata, riportando entrambi; oppure dichiarare in anticipo che l'esito di Zandvoort sarà
letto **solo** come «dentro o fuori la distribuzione in campione».

## 6 · Il rischio che resta comunque

**Zandvoort potrebbe non essere giudicabile.** Quattro gare su undici hanno n ≤ 20 e una ne
ha 11. Se la gara è dominata da neutralizzazioni — e Zandvoort ne ha spesso — i casi puri
crollano. La prereg dice già cosa fare (NON GIUDICABILE, si aspetta la gara dopo), ma vale
la pena saperlo prima: **c'è una probabilità concreta che il 23 agosto non produca un
verdetto**, e non sarebbe un guasto.

## 7 · Cosa la prova a secco NON ha potuto collaudare

- **La chiusura del sigillo**: `holdout.mjs` non porta `stato` a `chiuso` di proposito, ed è
  una decisione del PO. Quel passo resta non provato.
- **Il comportamento di `auto_gara.py` la domenica**: il lucchetto salta la ri-stima quando
  il sigillo è aperto e la gara è quella sigillata. È stato letto, non eseguito su una gara
  vera.
- **La misura sulla gara sigillata**: per costruzione, si può fare una volta sola.
