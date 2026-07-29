# REPORT — il traffico 2026 e i modelli che si tengono vivi da soli

Branch `ai-lab/traffico-2026-live` · 21/07/2026 · pattern:
[`ai_lab/scienziato/PATTERN_MODELLI_VIVI.md`](ai_lab/scienziato/PATTERN_MODELLI_VIVI.md)
Generatore: `gen_modelli_lab.py` → `data/modello_traffico_2026.json`

**Targhetta: 10 gare 2026, 3 291 giri in traffico, 586 incontri, calcolato il 2026-07-21.**

---

## (5) La frase onesta, per prima

> **Il traffico 2026 è calibrato, agganciato e si aggiorna da solo — ma resta SPENTO, e a
> dirlo è il modello stesso.** Sulle 5 gare di verifica non batte il traffico-zero in modo
> distinguibile dal rumore: IC95 appaiato **[−0,283 · +0,157]**, che contiene lo zero. Il
> file live dice `ACCENDIBILE: false`.
>
> Non l'ho acceso lo stesso. Accendere un modello che non batte «non fare niente» sarebbe
> peggio che non averlo. **Ma la macchina che lo tiene vivo funziona**, ed è la parte che
> vale: alla prossima gara il modello si ricalibra da solo, aggiorna la targhetta e ricontrolla
> il proprio cancello di accensione. Quando se lo sarà guadagnato, lo dirà.

---

## (1) Il modello traffico 2026 — calibrato solo sul 2026

Nessun coefficiente ereditato: né `a`, né `λ`, né la durata per delta-passo. Il 2026 è un
regime a sé sul sorpasso (Spearman θ storico-2026 = −0,024).

```json
"coefficienti": {
  "a": 1.68908,  "lam": 0.5,  "kappa": 0.44273,
  "durata_per_fascia_delta": {
    "-99.0..-0.8": 2.299,  "-0.8..-0.4": 2.982,  "-0.4..-0.15": 3.218,
    "-0.15..0.15": 3.246,  "0.15..99.0": 2.624 },
  "durata_media": 2.706 }
```

**Gli intervalli sono larghi, e li lascio larghi**: `a` ∈ **[0,86 · 3,18]** con IC95
bootstrap **sui blocchi** (le 10 gare, non le osservazioni). Un fattore 3,7 di incertezza su
`a`. Con 10 gare è quello che c'è; gonfiare la confidenza sarebbe l'unica cosa davvero
sbagliata da fare.

**Su κ, devo essere trasparente**: la forma pura (κ=1) **sovrastima** — e in *entrambi* i
regimi (2026: 0,84 previsto contro 0,43 reale; storico: 1,01 contro 0,63). La causa è una
incoerenza fra stimatore e metrica: `a` esce dai minimi quadrati (una media) mentre il
modello è giudicato sull'errore assoluto **mediano**. κ è la mediana del rapporto
reale/previsto e riallinea le due cose. **Non è una forma nuova**: è la C2 già dichiarata e
testata la notte scorsa. Senza κ il modello 2026 è tre volte peggio del traffico-zero
(1,32 contro 0,74); con κ arriva a pari (0,74 contro 0,74).

### Il fatto di dominio che vale a prescindere dal modello

| | costo per giro dentro l'incontro | costo dell'incontro |
|---|---|---|
| **2026** | **0,261 s** | **0,429 s** |
| storico 2022-25 | 0,389 s | 0,633 s |

**Nel 2026 restare bloccati costa un terzo in meno.** È il push-to-pass a batteria misurato
dal fondo, non un'opinione — e sopravvive anche se il modello predittivo non è ancora
pronto.

### Le verifiche

| verifica | esito |
|---|---|
| **fuori campione** (5 gare cal / 5 ver) | modello **0,7355 s** IC95 [0,652 · 0,965] contro traffico-zero **0,7430 s** → guadagno **+0,0075 s**, appaiato **−0,057 IC95 [−0,283 · +0,157]** ⇒ **NON distinguibile dallo zero** |
| **test McLaren** | previsto Δ-grande **0,81 s** contro pari-passo **0,344 s** ⇒ **ORDINA GIUSTO** (reale: 0,452 contro 0,298 — stesso verso, magnitudine sovrastimata qui) |
| **placebo** (leader a caso, `placebo_leader` già sotto sigillo, non modificata) | separazione finta **+0,066 s** contro **+0,154 s** vera ⇒ il grosso della separazione non è artefatto |

**Nessun null nuovo stanotte**: restano otto, sigillo integro.

---

## (2) L'auto-aggiornamento — provato togliendo e rimettendo una gara

`gen_modelli_lab.py` è un generatore come gli altri del sito, agganciato alla sequenza
post-gara di `auto_gara.py` subito dopo `gen_classifiche_ufficiali.py`.

**La prova, eseguita:**

```
1. IDEMPOTENZA          -> "nessun dato nuovo: file invariato (10 gare). Idempotente."
2. tolgo il Belgio      -> "ricalibrato: 0 -> 9 gare sotto"
3. ARRIVA il Belgio     -> "ricalibrato: 9 -> 10 gare sotto"
                           kappa                        -0.01688
                           durata_per_fascia -0.8..-0.4 -0.07300
                           durata_media                 -0.01200
                           lam                          +0.00000
                           movimento massimo 3.7% -> SI STA STABILIZZANDO
4. rieseguo             -> "nessun modello cambiato"
```

Il modello **si è aggiornato da solo** all'arrivo della gara, ha registrato di quanto si
sono mossi i coefficienti e ha dato il suo giudizio. Il 3,7 % è il numero che conta: se
fosse stato il 40 %, il generatore avrebbe stampato *«balla ancora: regime povero, non
fidarsi della cifra decimale»* — perché un modello che oscilla deve **vedersi**, non sparire
sotto una media che sembra ferma.

---

## (3) Il pattern generale — il prossimo modello si aggancia con una riga

Documentato in [`PATTERN_MODELLI_VIVI.md`](ai_lab/scienziato/PATTERN_MODELLI_VIVI.md).
Quattro parti, sempre le stesse: **un modulo che sa calibrare · una riga nel registro · un
file di coefficienti · un interruttore umano**.

`ai_lab/scienziato/autocalibra.py` non sa niente di traffico. Dato un oggetto con
`nome / regime / uscita / calibra()`, fa il resto **uguale per ogni modello**: targhetta,
storico dei movimenti col giudizio di stabilità, idempotenza, e nessuna decisione.

Per agganciare il degrado domani:

```python
REGISTRO = [
    ModelloTraffico('2026', uscita='data/modello_traffico_2026.json'),
    ModelloDegrado('2026',  uscita='data/modello_degrado_2026.json'),   # <- una riga
]
```

Tre regole che il pattern impone: **il regime fa parte dell'identità** (mai medie a cavallo
di una rottura regolamentare); **la targhetta viaggia col numero**; **il cancello di
accensione sta dentro il modello** — così un modello resta spento **da solo** finché non se
l'è guadagnato, senza che nessuno debba ricordarsene.

E rispetta il confine dichiarato da `pipeline_gara.py` (*«non ricalcola mai coefficienti
motore»*): quello che scrive sono coefficienti **del laboratorio**; l'accensione è un gesto
separato e umano.

---

## (4) Golden e limite onesto

L'aggancio in `demo/engine.mjs` è quello preparato ieri, **spento di default**:

```js
traffico = null        -> BIT-IDENTICO: resta il cap ZONE/STRENGTH (fallback per i
                          regimi e le gare senza modello)
traffico = { a, lam }  -> al posto del cap: eff[d] += a * exp(-gap/lam)
```

```
node test_b.mjs                 => PASS 449/449 sotto 1e-9
node demo/test_pit.mjs          => PASS 11/11
node test_degrado_aggancio.mjs  => PASS 3/3
node test_traffico_aggancio.mjs => PASS 3/3
sigillo del null                => INTEGRO (otto zone)
test_sorveglianza               => 3/3
```

**Il golden non si è mosso**, perché il modello non è stato acceso. Quando lo si accenderà,
il golden **cambierà** — è previsto ed è il momento di rifarlo attorno alla nuova forma.

### Il limite onesto, scritto DENTRO `data/modello_traffico_2026.json`

Quattro voci nel campo `limite_onesto`, che viaggiano col numero:

1. **CAMPO REALE** — si calcola solo contro il campo com'era. Le altre auto non rallentano
   perché sei lì, non si difendono, non cambiano strategia. Dice *«Leclerc diverso dentro la
   gara che È successa»*, non *«quella che SAREBBE successa»*.
2. **REGIME 2026 SOLTANTO** — nessun coefficiente ereditato; 10 gare sotto; si rinforza a
   ogni Gran Premio (vedi `storico`).
3. **CIECO** su pioggia (gare escluse) e sui primi 3 giri dopo ogni ripartenza.
4. **CONSERVATIVO** sul delta-passo grande: ordina giusto, sbaglia la magnitudine.

---

## Che cosa succede alla prossima gara

`auto_gara.py` la pubblica → `gen_modelli_lab.py` parte da solo → il modello si ricalibra su
11 gare, scrive la nuova targhetta, registra di quanto si sono mossi i coefficienti e
**ricontrolla il proprio cancello di accensione**. Se l'IC95 appaiato contro il
traffico-zero smetterà di contenere lo zero, il file dirà `ACCENDIBILE: true` — e a quel
punto la decisione è di Tommi, non del modello.

Nessun push, nessuna PR, nessun merge.
