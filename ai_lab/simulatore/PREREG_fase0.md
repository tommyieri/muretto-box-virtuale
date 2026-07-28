# PREREG — FASE 0 del simulatore

*Pre-registrato il 28/07/2026, prima di guardare qualunque stima.*
Piano di riferimento: `PIANO_SIMULATORE.md`. Decisione del PO: **strada A**, e
**non si eredita nessun artefatto derivato** — si ricostruisce dal grezzo.

---

## 0. Perché questa pre-registrazione esiste

In repo c'è già `data/modello_degrado_2026.json` con `rho_HARD 0,0512` eccetera. Il PO ha
posto un dubbio preciso e legittimo:

> *«può essere vecchio, non calibrato su 2026 (gomme e regole diverse). Può essere fatto su
> 8 gare 2026, adesso siamo a 11 (contando Monaco che è da escludere nei calcoli).»*

Quindi quel file **non entra da nessuna parte** in questo arco: né come valore di partenza,
né come controllo, né come tie-break. Verrà **confrontato alla fine**, come si confronta il
lavoro di un altro, e se i due numeri divergono la divergenza è un risultato, non un errore
da conciliare.

Stessa regola per: `demo/data/*.json` (derivati dal kernel), `data/*.csv` di laboratorio,
`engine/LIMITI_NOTI.md` (le sue cifre sono **voci**, non dati, finché non le rifaccio).

---

## 1. Le due domande, e cosa NON è

**D1 — Il degrado.** Quanto vale `ρ` (secondi al giro, per ogni giro di vita della gomma)
nel 2026, per mescola?

**D2 — La deriva di gara.** Quanto vale `Φ` (secondi al giro, per ogni giro di gara che
passa)?

`Φ` **non è "il carburante"** e non va chiamato così. È carburante ed evoluzione pista
**insieme**, perché hanno la stessa forma (entrambi fanno scendere i tempi col passare dei
giri) e questi dati non li separano. Per il simulatore va bene: serve l'effetto netto del
giro di gara sul tempo. Va chiamato col suo nome, ed è questo il motivo per cui il nome
qui non è `FUEL_COEFF`.

## 2. Perimetro — dichiarato adesso

**Gare.** Le 11 del 2026, lette da `data/gare_registro.json` → `data/ti_cache/*.json` e
`data/ti_archive/2026/*/Race.json`. Censite e verificate riga per riga da
`censimento.py` (11/11 identiche fra lettore di libreria e rilettura indipendente).

**Esclusioni, decise prima:**

| esclusione | livello | perché |
|---|---|---|
| **Monaco** | gara intera | decisione PO; e precedente di progetto (`CID_NO_DEGRADO`) |
| giri con `status != '1'` | giro | vedi §3 |
| `time` assente, `del = True` | giro | non è un tempo |
| `pin` o `pout` non nulli | giro | in-lap e out-lap non sono giri di passo |
| `compound` non in (SOFT, MEDIUM, HARD) | giro | il bagnato ha un regime suo (Fase 4) |
| giro 1 | giro | contiene la partenza, non è un giro di passo |

**Canada NON si esclude.** Ha 14 giri su intermedia su 1.212: si escludono **quei 14 giri**,
non le altre 1.198. Escludere la gara intera per l'1,2 % dei suoi giri sarebbe buttare dati
per comodità di codice.

## 3. Il filtro «verde», e perché è più stretto di quello in uso

`lab/fondo.py::verde` considera neutralizzato un giro il cui `status` contiene `4` (SC) o
`6` (VSC). Ma `data/STATUS_VOCABOLARIO_NOTA.md` dice che l'alfabeto è `{1,2,4,5,6,7}`, dove
`5` = **bandiera rossa** e `2` = **bandiera gialla di settore**. Con quel predicato una
bandiera rossa passa per verde.

Qui **verde = `status == '1'` esatto**: nessuna fase non-verde attraversata nel giro. È più
severo, costa giri, e per una stima di degrado è la scelta giusta — un giro dietro una
gialla non parla della gomma.

*Effetto collaterale voluto:* così non tocco affatto il debito VSC aperto
(`R_lap = 1,055`, «nessuno costruisca sulla neutralizzazione VSC»). Non classifico regimi:
tengo solo ciò che è verde puro.

## 4. Identificazione — dove sta l'informazione

Dentro **un solo stint**, `life` (età gomma) e `lap` (giro di gara) crescono insieme di 1:
sono perfettamente collineari, e nessuna stima può separarli. La separazione viene dal fatto
che **alla sosta `life` si azzera e `lap` no**.

Quindi:
- servono piloti con **≥ 2 stint** nella stessa gara;
- si stima **dentro la gara**, con **effetti fissi per pilota** (α_d): ogni pilota fa da
  controllo di se stesso, e la differenza fra macchine esce dal conto.

Modello, per gara:

```
t(d, L) = α_d  +  Σ_c C_c·1[mescola=c]  +  Σ_c ρ_c · life · 1[mescola=c]  +  Φ · L  +  ε
```

## 5. Il traffico, che è il rumore che conta

Misure già a referto nel progetto: il traffico vale **+8,17 s di mediana su 36 giri per
gara**. È rumore **a una coda sola** (il traffico ti rallenta, non ti accelera): una media
non centrata lo assorbe come se fosse degrado.

Rimedio dichiarato ora: dentro ogni **(pilota, stint)** si scartano i giri più lenti di
`mediana + 1,5·(p75 − p25)`. Taglio **unilaterale**, su una popolazione dove la coda lenta è
spuria per costruzione. Si riporta sempre **quanti giri sono stati tolti**.

## 6. Incertezza e nullo

**IC95: bootstrap sui BLOCCHI = le gare**, 2.000 ripetizioni. Non sulle osservazioni: i
giri dentro una gara non sono indipendenti, e un bootstrap sulle righe darebbe intervalli
falsamente stretti. È la convenzione già in uso nel progetto.

**Nullo per permutazione:** si rimescolano le **etichette di mescola** fra gli stint dentro
lo stesso (gara, pilota), 2.000 volte, e si guarda quanto spesso la separazione osservata
fra mescole viene eguagliata dal caso. Rimescolare dentro il pilota conserva la macchina e
il momento della gara: cambia solo quale gomma si chiamava come.

## 7. Le soglie — scritte adesso, non dopo

| # | affermazione | si può dire se e solo se |
|---|---|---|
| **S1** | «la gomma degrada» | ρ **comune** (senza distinguere mescola) ha IC95 che **non contiene lo zero** |
| **S2** | «le mescole degradano in modo diverso» | IC95 di (ρ_SOFT − ρ_HARD) **non contiene lo zero** **e** p del nullo per permutazione **< 0,05** |
| **S3** | «l'ordine è SOFT > MEDIUM > HARD» | l'ordine esce **da solo** in ≥ 7 gare su 10 |
| **S4** | «Φ del kernel è sbagliato per il 2026» | il valore del kernel (3,0 s su 70 kg) cade **fuori** dall'IC95 di Φ ricostruito |

Se **S1 passa e S2 no**: si accende un ρ **comune** e si dichiara che la mescola non
separa il degrado — che è comunque un salto rispetto a oggi (degrado zero), ed è già
abbastanza per far nascere l'ottimo interno di `PIANO_SIMULATORE.md §2`.

Se **S1 non passa**: il degrado non si accende, e la Fase 2 va rifatta con un'altra
identificazione (per esempio dalle sole soste, come il `gradino`).

## 8. Il banco del «quando» (G0)

Indipendente dalle stime sopra, e va costruito comunque.

Per ogni **sosta realmente avvenuta**, con il motore **di oggi, non toccato**: si congela al
giro precedente, si valuta il costo di fermarsi a ogni giro plausibile fino a fine gara, e si
guarda **dove cade il minimo**.

> **G0** — quota di casi in cui il minimo è **interno** (né il primo né l'ultimo giro
> disponibile). **Soglia dichiarata: ≥ 80 %.**

Attesa a motore invariato: **0 %** — misurato il 28/07 su 718 confronti con `confrontaPit`.
Il banco serve a rendere quel numero riproducibile e a farlo salire nelle fasi successive.

Si riporta anche, senza soglia perché è descrittivo: la distanza fra il minimo del motore e
il giro **scelto davvero** dalla squadra.

## 9. Cosa renderebbe nullo questo lavoro

Scritto adesso, così non si può negoziare dopo:

- se dopo il taglio del traffico restano **< 30 giri verdi per mescola per gara** in
  mediana, la stima per-mescola non è sostenibile e si riporta solo il ρ comune;
- se i piloti con ≥ 2 stint sono **< 10 per gara** in mediana, la gara non identifica e
  esce dal pool (dichiarata, non silenziosa);
- se il bootstrap sui blocchi dà IC che coprono **entrambi i segni** per tutte e tre le
  mescole, si dichiara **NULL** e non si accende niente.
