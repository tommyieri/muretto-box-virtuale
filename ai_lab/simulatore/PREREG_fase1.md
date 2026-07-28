# PREREG — FASE 1: la deriva di gara

*Pre-registrato il 28/07/2026, prima di guardare qualunque stima di Fase 1.*
Piano: `PIANO_SIMULATORE.md` §3.1 e Fase 1. Esito di Fase 0: `REPORT_FASE0.md`.

**Regola nuova del PO (28/07/2026):** *«in passato, se qualcosa non andava bene, ci
bloccavamo. Adesso se qualcosa non è perfetto, mettiamo online — fatto nel miglior modo
possibile.»* Questa pre-registrazione la recepisce al §6: **Fase 1 si pubblica in ogni caso**,
e le soglie decidono *quale versione* si pubblica, non *se*.

---

## 0. Gli errori del passato che questa fase NON rifà

Il PO ha chiesto di usare quello che il progetto ha già imparato invece di ricamminare sugli
stessi rastrelli. Tre lezioni sono state trovate a referto e sono **vincolanti** qui:

### E1 — Il filtro dell'aria libera è obbligatorio, e in Fase 0 me lo sono perso

`REPORT_SCIENZIATO_FUEL.md` §B1.2, testuale:

> *«soprattutto **aria libera ≥ 2,0 s dall'auto davanti sullo stesso giro** — obbligatorio,
> non opzionale: il traffico **decresce lungo la gara** e imiterebbe il carburante.»*

In Fase 0 ho applicato solo un taglio unilaterale degli outlier dentro (pilota, stint). Toglie
i giri catastrofici, **non** la discesa sistematica del traffico lungo la gara. Il confronto è
schiacciante e va scritto:

| | Δ 2026 |
|---|---|
| loro, **con** filtro aria libera | **2,194 s** |
| loro, **senza** filtro traffico | 2,643 s |
| **mia Fase 0, senza filtro** | **2,574 s** |

Il mio numero di Fase 0 è il numero contaminato. **Φ = −0,0448 s/giro è superato da questa
fase** e non va più citato come stima della deriva.

### E2 — La deriva è una costante DI CIRCUITO, non di campionato

`REPORT_SCIENZIATO_FUEL.md` §F1: su 22 circuiti corsi in ≥ 2 stagioni, SD *dentro* lo stesso
circuito fra anni 0,49 s contro 0,73 s *fra* circuiti → **69 % della varianza spiegata dal
circuito**, e si ripete di anno in anno (Austria sempre ~2,0; Bahrain e Las Vegas sempre ~4,0).

Un Φ unico erediterebbe l'errore su ogni pista lontana dalla mediana. Questa fase stima
**Φ per circuito**. *(Il 69 % non viene ereditato: viene ri-misurato qui, §3.)*

### E3 — Δ non è «il carburante», ed è un limite SUPERIORE

`REPORT_SCIENZIATO_FUEL.md` §B1.1: dentro uno stint giro-gara ed età-gomma sono collineari;
la separazione viene dalla desincronizzazione fra stint. Ma l'evoluzione pista è anch'essa
lineare nel giro e ha lo **stesso segno**:

```
Δ̂ = Δ_carburante + Δ_evoluzione_pista (+ gestione: lift-and-coast, risparmio gomme)
```

Nessuna quantità di gare scioglie il nodo: servono dati **fuori dalla gara**. Quindi la
grandezza si chiama **deriva di gara**, mai `FUEL_COEFF`. *(Per il simulatore va benissimo:
serve l'effetto netto del giro di gara. Il nome sbagliato sarebbe l'unico danno.)*

### E4 — In repo convivono DUE costanti di carburante incoerenti

`REPORT_SCIENZIATO_FUEL.md` (A): `test_identificabilita_degrado.py` porta **2,1 s**, il
motore **3,0 s**. Fase 1 ne censisce tutte le occorrenze: pubblicare una terza costante senza
dire dove stanno le altre due sarebbe peggio che non toccare niente.

---

## 1. La domanda

**D1.** Quanto vale Δ (lo scivolamento totale del tempo sul giro dal giro 1 al giro N dovuto
al termine lineare nel giro-gara), **per circuito**, nel regime 2026?

**D2.** Il difetto vero del motore non è il valore: è che `pace_base` **sottrae** il
carburante e `simulate` non lo **ri-aggiunge** mai (`engine/LIMITI_NOTI.md` §1: −1,480 s/giro
su −1,86 totali). Un modello che sottrae e ri-aggiunge **la stessa quantità** è corretto per
costruzione, qualunque sia il valore. **Questo, e non il coefficiente, è il pezzo che si
pubblica.**

## 2. Perimetro e filtri — dichiarati adesso, e contati

Fondo: **2018-2025** (173 gare) + **2026** (11). Regimi tenuti **separati**: il 2026 è una
rottura regolamentare. *Se i due regimi si distinguano è una domanda, non un'assunzione (§5).*

| filtro | livello | provenienza |
|---|---|---|
| `status == '1'` esatto (verde puro) | giro | Fase 0 §3 — il `5` è bandiera rossa |
| `time` presente, `del` falso | giro | — |
| `pin`/`pout` nulli | giro | in/out-lap non sono giri di passo |
| compound in (SOFT, MEDIUM, HARD) | giro | il bagnato ha regime suo |
| `lap >= 2` | giro | il giro 1 contiene la partenza |
| **`life >= 3`** | giro | **eredità E1**: i primi giri sono warm-up, non passo |
| **outlier > 1,07 × mediana di stint** | giro | **eredità E1** |
| **aria libera >= 2,0 s dall'auto davanti** | giro | **eredità E1, obbligatorio** |
| `wR` vero (pioggia dichiarata) | giro | — |
| Monaco | gara, solo 2026 | decisione PO |

**Guardrail di rango (eredità E1):** una mescola entra nel disegno solo con **≥ 3 stint e
≥ 30 giri** in quella gara; altrimenti i suoi giri escono **esplicitamente e contati**. Serve
a non far collassare la colonna livello sulla colonna età quando un compound ha pochi giri.

**Aria libera, come si calcola:** al giro L si ordinano per `sesT` i piloti che hanno
completato L; il gap dall'auto davanti è la differenza dei `sesT`. È il gap sulla linea del
traguardo, non nel punto peggiore del giro: dichiarato, e conservativo nel verso giusto (un
gap ≥ 2 s al traguardo può essere stato < 2 s in curva, quindi qualche giro sporco resta).

## 3. Stimatore

Per gara, la gara è il blocco:

```
time = alpha_pilota + C_c + rho_c · life + gamma · lap        (OLS)
Delta = -gamma · (N - 1)                                       (positivo = i giri accelerano)
```

Effetti fissi di **pilota**, mai di stint (uno stint FE assorbirebbe la desincronizzazione da
cui viene l'identificazione).

**Per-circuito.** Nel 2026 c'è **una sola gara per circuito**: circuito e gara coincidono, e da
solo il 2026 non può separare l'effetto-pista dal rumore di gara. Quindi:

```
Phi_circuito = w · Delta_2026(quel circuito) + (1 - w) · prior_storico(quel circuito)
w = n_2026 / (n_2026 + k)        k derivato dalla decomposizione della varianza, non scelto
```

dove `prior_storico(circuito)` è la media delle stagioni 2018-2025 su quel circuito, e `k`
esce dal rapporto fra varianza *dentro* circuito (fra anni) e *fra* circuiti — **ri-misurato
qui, non ereditato dal 69 % del report precedente**.

Circuiti senza storico → si ricade sulla mediana del regime 2026, **dichiarato in targhetta**.
Alias di nome dichiarato: **`Barcelona Grand Prix` (2026) = `Spanish Grand Prix` (storico)** —
stesso circuito, nome cambiato. È l'unica delle 11 senza corrispondenza diretta.

## 4. Il modello simmetrico (D2)

```
misura:   passo(d) = mediana su giri verdi di [ t - Phi_norm(lap) - rho·(life - life0) ]
simula:   t_hat(d, lap, life) = passo(d) + Phi_norm(lap) + rho·(life - life0)
```

con `Phi_norm(lap) = Phi_giro · (lap - lap_rif)`. Sottrazione e ri-aggiunta usano **lo stesso
Φ**: un errore sul coefficiente si cancella al primo ordine sul livello e resta solo
sull'estrapolazione. È il motivo per cui questa parte si pubblica anche con Φ imperfetto.

**ρ resta spento in Fase 1** (`rho = 0`): è la Fase 2 e ha il suo cancello. Il modulo lo
prevede già per non doverlo riscrivere.

## 5. Le soglie — scritte adesso

| # | affermazione | si può dire se e solo se |
|---|---|---|
| **T1** | «il filtro aria libera cambia la risposta» | \|Δ con filtro − Δ senza\| supera l'IC95 bootstrap del Δ filtrato |
| **T2** | «la deriva è di circuito» | SD fra circuiti > SD dentro circuito fra anni, con p < 0,05 per permutazione delle etichette-circuito |
| **T3** | «Φ per circuito batte Φ unico» | in **leave-one-race-out**, MAE sul tempo sul giro previsto più basso in ≥ 2/3 delle gare |
| **T4** | «i due regimi si distinguono» | IC95 della differenza 2018-25 − 2026 **non** contiene lo zero |
| **T5** | «il modello simmetrico riduce il bias» | \|bias\| sui tempi assoluti da ~1,9 s/giro a **< 0,5 s/giro** su finestre verdi |
| **T6** | «e non rompe le posizioni» | la posizione di rientro cambia in **< 5 %** dei 337 casi del banco di Fase 0 |

## 6. Cosa si pubblica, e in quale caso — deciso PRIMA

Recepimento della regola del PO. **Fase 1 va online comunque**; le soglie scelgono la versione:

| esito | cosa va online |
|---|---|
| T5 **e** T6 passano, T3 passa | modello simmetrico con **Φ per circuito** |
| T5 **e** T6 passano, T3 no | modello simmetrico con **Φ unico di regime** — comunque meglio dell'asimmetria |
| T5 passa, **T6 no** | modello simmetrico **dietro interruttore spento**, e in report il perché: cambiare le posizioni è un cambio di promessa, e lo decide il PO, non il banco |
| T5 **no** | non si pubblica il modello, si pubblica il **report del perché** e il banco resta |

In nessuno di questi casi il lavoro si ferma senza produrre qualcosa di visibile.

## 7. Cosa renderebbe nullo questo lavoro

- se dopo il filtro aria libera restano **< 1.000 giri** nel regime 2026, la stima 2026 non è
  sostenibile e Φ 2026 si prende dal prior storico, dichiarandolo;
- se il guardrail di rango scarta **> 1/3 delle gare**, il disegno è sbagliato e va rifatto;
- se Δ per circuito ha IC che attraversano lo zero su **> metà** dei circuiti, il per-circuito
  non si pubblica (si ricade su T3 = no).
