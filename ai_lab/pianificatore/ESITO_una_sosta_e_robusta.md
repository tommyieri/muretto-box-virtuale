# ESITO — «una sosta» è robusta a ogni parametro che il modello ha

**Data: 05/08/2026.** Chiude l'arco aperto da `ESITO_scomposizione_errore.md`. Aritmetica
sulla forma chiusa, nessuna stima nuova, nessuna accensione.

---

## 1 · La sesta esclusione, e questa era l'ultima porta

Le prime cinque sono a referto. La sesta è quella che nessuno aveva provato: **non "il ρ è
sbagliato", ma "quanto ρ servirebbe, restando dentro l'incertezza che il progetto ha già
dichiarato"**.

Il ρ del motore è **0,030776**, con IC95 sigillato **[0,0108 ; 0,0527]**. Lo stimatore del
campo, indipendente, sulla stessa stagione dà **0,04167** — dentro la banda, e fu letto come
*conferma*. Nessuno aveva notato che **il motore sta al 48 % della propria banda**, cioè
sotto la metà, e che il numero di soste dipende da dove ci si mette dentro.

`k* = (R+a)·√(ρ/2P) − 1`, con P = 22 s:

| giri rimasti | ρ del motore | ρ del campo | **estremo alto dell'IC95** | ρ del campo su età ≤ 20 |
|---|---|---|---|---|
| 52 (Gran Bretagna) | 0,38 | 0,60 | **0,80** | 0,98 |
| 66 (Spagna) | 0,75 | 1,03 | **1,28** | 1,51 |
| 78 (Monaco) | 1,06 | 1,40 | **1,70** | 1,96 |

> **Nemmeno all'estremo superiore del proprio IC95 la forma chiusa arriva a due soste.**
> Il massimo è 1,70, a Monaco, con il ρ più alto che il progetto si conceda.

L'unica colonna che sfiora il 2 è l'ultima — il ρ misurato sulle sole età ≤ 20 — ma quella
**non è un ρ globale**: è la pendenza di un tratto di una curva che oggi sappiamo essere
**concava** (`ESITO_rho_selezione.md`). Usarla per uno stint lungo sarebbe applicare la
pendenza iniziale a tutta la corsa. Non è un'opzione, è un errore con un nome.

## 2 · Il quadro completo: sei esclusioni, un solo verdetto

| # | candidato | esito |
|---|---|---|
| 1 | l'**obiettivo** è il tempo e non la posizione | inerte al 97 % (5 casi su 167, tutti Monaco) |
| 2 | il **ρ** è basso per **selezione** | è **curvatura** — placebo p = 0,39 |
| 3 | il **`P`** è troppo alto | servirebbe **1,8× più piccolo** del minimo mai misurato |
| 4 | la **vita** è penalità e non muro | lega ma non basta — 114 → 102 |
| 5 | la **safety car** | +7,1 % economico · 114 → 106 opportunistico |
| 6 | il **ρ** sta nel punto sbagliato della sua banda | **1,70 al massimo**, contro i 2 richiesti |

> **Nessun valore di ρ dentro il suo IC95, nessun `P` dentro l'intervallo misurato, nessun
> obiettivo, nessun vincolo di vita e nessuna probabilità di safety car porta la forma chiusa
> a due soste. L'ottimo a una sosta è ROBUSTO a ogni parametro che il modello possiede.**

Non è un difetto di taratura, e a questo punto non è nemmeno un difetto: è ciò che
*minimizzare il tempo totale di gara* comporta, con la fisica che abbiamo misurato.

## 3 · Cosa fare, e non è un'altra misura

Il motore sa fare bene una cosa e male un'altra, e ora sappiamo quali:

- **sa QUANDO fermarsi**: col numero di soste regalato l'errore mediano scende da 7 a 5 giri,
  cioè al pavimento della tabella di tre numeri;
- **non sa QUANTE VOLTE**, e sei misure dicono che quel numero non si ricava dalla fisica che
  ha.

Il prodotto oggi presenta **un piano solo**, come se il motore avesse scelto. La conclusione
onesta è che su quella scelta il motore non ha titolo — mentre sul **costo di ciascuna
alternativa** ce l'ha eccome, e lo calcola già: `pianoOttimo` restituisce `per_k` con il
costo di 0, 1, 2, 3 soste per ogni congelamento.

> **Quel campo è calcolato a ogni pannello e non è mai stato mostrato.** Il censimento KPI
> P1 lo aveva già trovato orfano — *«le alternative 0/1/2/3 soste mai mostrate»* — e allora
> sembrava una svista di interfaccia. Dopo sei esclusioni è un'altra cosa: è **esattamente
> l'informazione che il motore possiede e che l'utente non riceve.**

**La raccomandazione è di prodotto, non di laboratorio**: mostrare il costo per numero di
soste invece di un unico piano. Non richiede nessuna misura nuova, nessun parametro, nessuna
accensione: i numeri sono già lì. E toglie al motore una decisione che sei misure dicono che
non può prendere, lasciandogli quella che sa prendere.

## 4 · Cosa NON si conclude

- **Non** si conclude che il ρ del motore vada alzato. Si conclude che **anche alzandolo
  fino al suo estremo dichiarato non basterebbe**, quindi la domanda «quale ρ» non è la
  domanda giusta.
- **Non** si conclude che la forma chiusa sia sbagliata: dà la risposta che i suoi ingredienti
  impongono.
- **Non** si tocca niente in produzione. Questa sessione non ha acceso nulla — sei diagnosi,
  due rami spenti con la loro sentinella (s39, s40), zero cambi al motore.
