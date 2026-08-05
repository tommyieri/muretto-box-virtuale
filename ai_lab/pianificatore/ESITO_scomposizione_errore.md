# ESITO — i sette giri sono la scelta di QUANTE soste, e il motore ne fa sempre troppo poche

**Data: 05/08/2026.** Esegue `PREREG_scomposizione_errore.md`, sigillata prima dei numeri
(commit `1669103`). Dati: `ESITO_scomposizione_errore.json`. Nessuna soglia toccata.

---

## Il verdetto

**Δ = mediana(A) − mediana(B) = 2,00 giri** — esattamente sulla soglia dei 2 giri scritta
nella prereg §5.

> **Il difetto è la SCELTA DI QUANTE SOSTE.** Regalando al motore il numero di soste vero, e
> lasciandogli scegliere il giro con la sua fisica, l'errore mediano passa da **7 a 5 giri**
> — cioè scende al livello del pavimento descrittivo.

| braccio | errore mediano | cos'è |
|---|---|---|
| **A · libero** | **7** | il prodotto di oggi |
| **B · `k` imposto** | **5** | stesso motore, numero di soste regalato |
| **C · pavimento** | **5** | la tabella di tre numeri |

Perimetro: **167 decisioni** misurabili (209 fuori, tutte per la ragione strutturale già a
referto: al giro 1 non ci sono giri verdi da cui ricavare un passo). B esiste su **152**: in
15 casi il `k` vero supera `kMax = 3`.

## 1 · La matrice di confusione è il risultato, più della mediana

righe: `k` del **motore** · colonne: `k` **vero**

| | 1 | 2 | 3 | 4 | 5 | tot |
|---|---|---|---|---|---|---|
| **0** | 42 | 10 | 6 | 5 | 1 | **64** |
| **1** | 52 | 28 | 13 | 4 | 2 | **99** |
| **2** | 0 | 1 | 0 | 3 | 0 | **4** |
| **3** | 0 | 0 | 0 | 0 | 0 | **0** |

> **Il motore non propone MAI più di due soste, e nella pratica quasi mai più di una: 163
> casi su 167 stanno nelle righe 0 e 1.** La verità arriva a cinque.
>
> **Ne fa troppo poche in 114 casi su 167. Troppe in ZERO.**

Azzecca il numero in **53 su 167**, il 31,7 %. Non è rumore simmetrico attorno al valore
giusto: è un bias **a senso unico**, e un bias a senso unico ha una causa a monte, non un
rumore da ridurre.

## 2 · La causa è aritmetica, e sta nel rapporto ρ/P

Il numero ottimo di soste ha forma chiusa, ed è nel motore da sempre:

```
(k+1)* = (R + a) · √( ρ / 2P )
```

Con il ρ sigillato (**0,030776 s/giro·giro**) e un pit-loss tipico di 22 s:

| giri rimasti + età | k* con P=20 s | P=22 s | P=25 s |
|---|---|---|---|
| 30 | −0,17 | −0,21 | −0,26 |
| 40 | 0,11 | 0,06 | −0,01 |
| 50 | 0,39 | 0,32 | 0,24 |
| 60 | 0,66 | 0,59 | 0,49 |
| 70 | 0,94 | 0,85 | 0,74 |

**Il k ottimo non arriva a 1 nemmeno su settanta giri.** Il motore propone una sosta solo
perché il regolamento gliela impone (le due mescole slick), non perché la sua fisica la
voglia. Perché ne volesse **due** servirebbe un ρ fra **2,6 e 14 volte** quello misurato, a
seconda della lunghezza:

| giri rimasti + età | ρ necessario per k* = 2 | quante volte quello misurato |
|---|---|---|
| 40 | 0,2475 | **8,0×** |
| 50 | 0,1584 | **5,1×** |
| 60 | 0,1100 | **3,6×** |
| 70 | 0,0808 | **2,6×** |

Non è una taratura da ritoccare: è un ordine di grandezza.

## 3 · E il ρ è dichiarato dal progetto stesso come un LIMITE INFERIORE

Questa non è un'ipotesi nuova: sta scritta in `ESITO_degrado_dal_campo.md`, con la sua
ragione.

> *«Le età alte esistono solo per chi ha scelto di restare fuori, e spesso lo fa perché la
> sua gomma va bene. Il ρ che esce di qui è un limite inferiore, e lo è di più proprio dove
> la gomma viene tolta prima.»*

È **selezione**: si misura il degrado sulle gomme che sono rimaste in pista, cioè sulle
migliori. Il motore eredita quel ρ, e con un ρ troppo basso fermarsi costa sempre più di
quanto rende. **Da qui il bias a senso unico.**

I due fatti si incastrano, ed è la prima volta che vengono messi accanto:

| | |
|---|---|
| il ρ è un limite inferiore, per selezione | dichiarato, `ESITO_degrado_dal_campo.md` |
| il motore fa troppo poche soste in 114/167 e troppe in 0 | misurato qui |
| servirebbe un ρ da 2,6× a 8× per volerne due | aritmetica della forma chiusa |

## 4 · La riserva onesta: B pareggia col pavimento, non lo batte

Le mediane di B e C sono **entrambe 5**. Ma il confronto appaiato caso per caso dice
**60-88 per C** (p = 0,0261): **anche col numero di soste regalato, il motore non batte la
tabella di tre numeri** — la pareggia in mediana e perde sui segni.

La regola di lettura della prereg §5 si basa sulle mediane, e per quella il ramo è «la
scelta di quante soste». Ma il terzo esito che avevo scritto — *«se anche B resta peggio del
pavimento, il problema non è in nessuna delle due scelte»* — è **sfiorato**: non scatta per
un pelo, e va detto invece che nascosto dietro il ramo che ha vinto.

**Lettura onesta**: sistemare il `k` porta il motore *al livello* del pavimento, non sopra.
Chi si aspetta che curare il numero di soste renda il motore migliore di una tabella di tre
numeri, da questi dati non ha ragione di aspettarselo.

E un'altra cosa va detta perché è meccanica e non un merito: **«arrivi così» in B è 0,0 %
per costruzione** — il `k` vero è sempre ≥ 1, perché lo stint finisce con una sosta. Non è B
che ha imparato a fermarsi.

## 5 · Cosa NON dimostra questa diagnosi

- **Non** dimostra che il ρ sia sbagliato. Dimostra che *se* il ρ è basso per selezione — e
  il progetto dice che lo è — allora il bias osservato è quello che ci si aspetta. È
  coerenza, non prova.
- **Non** dice di alzare il ρ. Alzarlo a mano perché il piano venga più bello è tarare un
  parametro fisico su un esito di prodotto, cioè il modo più veloce di rompere tutto il
  resto (il passo, la banda, il rientro, la curva del quando).
- **Non** riapre il cliff, chiuso NULL il 03/08. Il cliff era un termine della sola età; qui
  si parla del **livello** di ρ, che è un'altra grandezza.

## 6 · Il ramo indicato, e cosa vorrebbe la sua prereg

Il lavoro va sul **numero di soste**, e la domanda precisa è:

> **esiste una stima di ρ non affetta da selezione?**

La forma naturale è un ρ corretto per la selezione — stimato su chi la gomma l'ha tolta,
non solo su chi è rimasto fuori — e il fondo 2018-2025 ha la numerosità per provarci
(3.743 stint nel perimetro asciutto, contro gli 11 della stagione 2026). L'architettura che
ha funzionato due volte ieri è la stessa: **forma dalla storia, livello ancorato al 2026.**

Il cancello ovvio, e va pre-registrato con le sue soglie prima di stimare: il ρ corretto
deve **ridurre il bias a senso unico** (i 114 «troppo poche» contro 0 «troppe») **senza
peggiorare** il passo, la banda di rientro e la risposta a due giri — che sono le cose che
il ρ tiene in piedi oggi.

**Nessuna conseguenza automatica da questo documento.** Qui si è misurato dove sta il
difetto; spostarlo è un'altra sessione, con la sua prereg.
