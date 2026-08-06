# Prereg — la safety car: canale economico, o opportunità non pianificabile?

**Data: 05/08/2026.** Scritta **prima** di aver calcolato un solo numero.

Esegue l'ultimo candidato rimasto da `ESITO_vita_vincolo.md`, dopo che quattro spiegazioni
del sotto-fermarsi sono cadute.

---

## 1 · L'ipotesi, e i suoi due canali

Il motore pianifica in un mondo dove **la safety car non esce mai**. Non ha nessuna
probabilità a priori: conosce i fattori di neutralizzazione (SC 0,50) ma solo **a cose
fatte**, quando la SC c'è già. In quel mondo fermarsi meno *è* corretto.

Ma «la SC spiega il sotto-fermarsi» sono **due affermazioni diverse**, e vanno separate o si
misura la cosa sbagliata:

| | canale | cosa direbbe |
|---|---|---|
| **A** | **economico** | sapendo che una SC *potrebbe* uscire, il pit-loss atteso scende e la forma chiusa vuole più soste |
| **B** | **opportunistico** | le soste in più non sono *pianificate*: succedono perché l'occasione è comparsa |

Se vale **A**, al motore manca un parametro e si può aggiungere. Se vale **B**, al motore
non manca niente: gli si sta chiedendo di prevedere una cosa che **per definizione** non si
prevede, e il sotto-fermarsi misurato è in parte la differenza fra **un piano** e **una
sequenza di reazioni**.

## 2 · Il canale A si chiude o si apre con l'aritmetica, e va fatto PRIMA

Una sosta sotto neutralizzazione costa `0,50 × P` (fattore sigillato). Se una frazione `q`
delle soste finisce sotto SC, il pit-loss **atteso** vale

```
P_eff = (1 − q)·P + q·0,5·P = P · (1 − q/2)
```

e nella forma chiusa `k* + 1 = (R+a)·√(ρ/2P_eff)`. Il caso **più favorevole possibile** è
`q = 1` — *ogni* sosta sotto safety car — che dà `P_eff = P/2`, cioè `k*+1` moltiplicato per
**√2 = 1,414**.

**Il cancello si scrive adesso:**

| | cancello | soglia |
|---|---|---|
| **SC0** | il canale economico può bastare | con `q = 1` (il limite irraggiungibile), `k*` deve arrivare a **≥ 2** in almeno una gara |

Se **nemmeno regalando ogni sosta alla safety car** la forma chiusa vuole due soste, il
canale A è **escluso dall'aritmetica**, esattamente come lo è stato il pit-loss — e non
serve costruire P(SC) per circuito e per giro, che è l'ingrediente che il progetto non ha.

## 3 · Il canale B si misura, e i dati ci sono già

`stintConclusi` porta lo **`status` del giro della sosta** dal 04/08. Quindi, per ogni sosta
vera del 2026, si sa se è avvenuta sotto **SC (`4`)**, **bandiera rossa (`5`)**, o in verde.

Si misura:

1. la quota di soste vere avvenute sotto neutralizzazione;
2. la stessa quota **ristretta alle soste oltre la prima** — perché la prima sosta è quella
   che il motore fa comunque (gliela impone il regolamento) e le altre sono quelle che
   **non fa**;
3. il conto delle soste che restano se si tolgono quelle sotto neutralizzazione: **quante
   ne mancherebbero ancora al motore?**

**Il punto 3 è il vero cancello di questa sessione:**

| | cancello | soglia |
|---|---|---|
| **SC1** | l'opportunismo spiega il sotto-fermarsi | tolte le soste sotto SC e rossa, il numero di soste vere deve scendere abbastanza da ridurre «troppo poche» da **114** a **≤ 90** |

Novanta è la stessa soglia usata per la vita come vincolo: **il difetto è lo stesso, il metro
resta lo stesso.**

## 4 · Il VSC NON entra, e la ragione è già scritta

Il segnale `6` è **dichiarato rotto**: `R_lap` del regime VSC vale 1,055 pooled, un'auto
sotto VSC non rallenta come dovrebbe, e c'è una direttiva che vieta di costruirci sopra.

Quindi si contano **solo SC (`4`) e rossa (`5`)**. La conseguenza è dichiarata e ha un verso
noto: **si sottostima** l'opportunismo, perché le soste sotto VSC restano contate come verdi.
Se SC1 passasse comunque, passerebbe **nonostante** una misura conservativa.

## 5 · Le regole di decisione

- **SC0 fallisce e SC1 fallisce** → la safety car non spiega il sotto-fermarsi in nessuno dei
  due modi. **Quinta strada chiusa**, e il difetto resta senza spiegazione disponibile: è il
  momento di dirlo e smettere di cercarla in questa direzione.
- **SC0 fallisce, SC1 passa** → il canale economico è escluso ma **l'opportunismo spiega**:
  al motore non manca un parametro, gli si sta chiedendo di prevedere l'imprevedibile. La
  conseguenza è sul **metro**, non sul motore: il banco delle decisioni va letto escludendo
  le soste sotto neutralizzazione, e la parte di errore che resta è quella vera.
- **SC0 passa** → esiste un `q` plausibile che sposta il piano: allora serve P(SC), ed è una
  sessione sua con la sua prereg.

## 6 · Cosa NON si fa

- Non si costruisce P(SC) per circuito e per giro **prima** di SC0: sarebbe spendere una
  sessione su un ingrediente che l'aritmetica potrebbe escludere in due righe.
- Non si tocca niente in produzione.
- Non si usa il VSC (§4).

---

**Sigillo.** Committata prima di aver calcolato un solo numero.
