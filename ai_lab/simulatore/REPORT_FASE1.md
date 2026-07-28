# REPORT — FASE 1: la deriva di gara

*28/07/2026. Pre-registrato in `PREREG_fase1.md`. Regola dell'arco: niente derivati, si
ricostruisce dal grezzo. Regola nuova del PO: **non ci si blocca, si pubblica.***

**In una riga:** il modello simmetrico porta il bias sui tempi assoluti da **−2,19 a −0,54
s/giro** e **non muove nemmeno una posizione di rientro** (0 su 338). La soglia
pre-registrata (0,50) **non passa per 4 centesimi** — e il residuo che resta è stato
identificato: è il degrado della Fase 2. Con ρ acceso il bias va a **−0,17 s e diventa piatto**.

---

## 1. Gli errori del passato, e quello che ho rifatto io

Il PO ha chiesto di usare quello che il progetto ha già imparato. Ha funzionato, e ha
funzionato anche contro di me.

### E1 — il filtro dell'aria libera: avevo ragione a cercarlo, torto ad accusarlo

`REPORT_SCIENZIATO_FUEL.md` §B1.2 lo dichiara obbligatorio. Fase 0 non ce l'aveva. Ho
scritto che il numero di Fase 0 era «il numero contaminato dal traffico». **La decomposizione
dice che non è così**, e va corretto:

| configurazione (2026, stesse guardie) | Δ mediano |
|---|---|
| nessuno dei tre filtri | 3,290 |
| + `life >= 3` | 3,190 |
| + outlier 1,07× | 3,287 |
| + **aria libera 2,0 s** | **3,170** |

I tre filtri insieme valgono **0,12 s**, e l'aria libera da sola ~0,12. Non spiegano lo scarto
fra il 2,574 di Fase 0 e il 3,170 di qui.

**Lo scarto vero è l'aggregazione.** Fase 0 stimava un γ **pooled su tutte le gare** e poi lo
moltiplicava per la lunghezza mediana di gara. Fase 1 stima Δ **gara per gara** e poi ne
prende la mediana. La prima viola una regola che il progetto ha già scritto fra i suoi metodi
conservati — *«mai pooling fra gare; blocchi indipendenti = gare, non osservazioni»* — e la
seconda la rispetta. **Il Φ = −0,0448 di Fase 0 è superato e non va più citato.**

### E2 — la deriva è di circuito: **non lo riproduco**

`REPORT_SCIENZIATO_FUEL.md` §F1 dichiara il 69 % della varianza spiegata dal circuito
(SD fra 0,73, dentro 0,49). Sulla **loro stessa finestra** (2023-25):

| | loro | io |
|---|---|---|
| SD **fra** circuiti | 0,73 | **0,714** ✅ riprodotta |
| SD **dentro** circuito (fra anni) | 0,49 | **0,962** ❌ non riprodotta |
| quota spiegata dal circuito | 69 % | **35 %** |

La dispersione *fra* piste la riproduco quasi esattamente. La *stabilità* di una pista fra un
anno e l'altro no: la mia è quasi doppia. Il segnale per-circuito esiste ma è **molto più
debole** di quanto il progetto credesse. Non ho modo di sciogliere la divergenza senza il loro
percorso di codice, e non fingo di averlo: la riporto.

### E4 — le due costanti di carburante, censite

| valore | dove |
|---|---|
| **3,0 s / 70 kg** | `engine/engine.py:40` · `live/pace_base_live.py:16` · `demo/live_bylap.mjs:56` · `gen_faseb_magnitudine.py:32` · `gen_faseb2_copertura.py:24` · `gen_climatologia_degrado.py:44` · `ai_lab/scienziato/fenomeno_fuel.py:42` · `gen_motore_appaiato.mjs:198` (in linea) |
| **2,1 s** (0,03 s/kg × 70 kg) | `test_identificabilita_degrado.py:50` — il file lo dichiara da solo nel proprio docstring |

**E il 3,0 regge.** Δ misurato: storico **3,111**, 2026 **3,170**. Il coefficiente del kernel
non è il problema: **il problema è che non viene mai ri-aggiunto.**

### E5 — la pinv silenziosa, e l'ho fatta io in Fase 0

Fra i metodi conservati del progetto c'è *«guardrail di rango, mai `pinv` silenziosa»*. In
`degrado.py` (Fase 0) le tre dummy di livello sommano al vettore costante, che la
trasformazione within azzera: disegno a rango non pieno, e `np.linalg.lstsq` lo risolveva con
una pseudo-inversa **senza dire niente**.

Corretto (una mescola fa da riferimento) e verificato: **le stime di Fase 0 non si muovono di
una cifra** — ρ 0,0389, Φ −0,0448, identici. Lo spazio nullo toccava solo i livelli, non le
pendenze. Il difetto era nel codice, non nei numeri, ma la guardia adesso c'è ed è esplicita.

---

## 2. Δ, ricostruito

**Filtri, tutti contati** (200.785 giri grezzi → 75.457 usati): verde puro `status=='1'`,
in/out-lap, non-slick, giro 1, `life < 3`, pioggia, outlier 1,07×, **traffico sotto 2 s
(50.470 giri, il filtro più costoso)**, guardrail di rango.

**Due guardie, emendamento dichiarato.** La prima esecuzione dava Emilia Romagna **+33,19 s** e
Canada **+25,51 s**: non sono misure, sono fit rotti.

- **G-A** gara con qualunque giro su gomma da bagnato → fuori in blocco (il progetto lo faceva già).
- **G-B** fuori le gare la cui SE cluster-robusta di Δ supera 1,0 s. **Si scarta per precisione,
  non per valore**: scartare i Δ grossi sarebbe selezionare sull'esito, cioè tenere solo le gare
  che dicono quello che ci aspettiamo. 42 gare cadute (21 bagnate, 11 senza giri utili, 7 rango,
  3 SE). Del 2026 cade solo il Canada, ed è bagnato.

| | Δ mediano | IC95 (bootstrap sui blocchi) |
|---|---|---|
| storico 2018-2025 (132 gare) | **3,111** | [2,926 ; 3,254] |
| 2026 (9 gare, Monaco e Canada fuori) | **3,170** | [1,682 ; 3,903] |

### Le soglie

| | | esito |
|---|---|---|
| **T1** | il filtro aria libera cambia la risposta | **NON PASSA** — scarto 0,117 s, dentro il rumore |
| **T2** | la deriva è di circuito | **NON PASSA** su entrambe le finestre (vedi sotto) |
| **T4** | i due regimi si distinguono | **NON PASSA** — differenza −0,059, IC95 [−0,722 ; 1,322] |
| **T3** | Φ per circuito batte Φ unico fuori campione | **NON PASSA** — vince in 4 gare su 10 |

**T2 in dettaglio, perché è quello su cui ho quasi sbagliato.** Con la finestra
pre-registrata (2018-2025): quota 31 %, p = 0,100 → non passa. Ho emendato restringendo
all'era a effetto suolo (2022-2025), con motivazione fisica dichiarata *prima* del numero: un
cambio regolamentare cambia la macchina, quindi mettere otto stagioni di regolamenti diversi
dentro la varianza «fra anni dello stesso circuito» la gonfia con qualcosa che non è rumore di
circuito. Emendato: quota 43 %, **p = 0,0245**.

Ma il criterio pre-registrato era *SD fra > SD dentro* **e** *p < 0,05*. La p passa, **la
varianza no** (0,731 contro 0,836). **T2 non passa nemmeno emendato**, e lo scrivo così invece
di raccontare la metà che mi conviene.

Conseguenza operativa: **Φ unico di regime**, non per circuito. T3 lo conferma dal lato
predittivo (4/10).

---

## 3. Il modello simmetrico — il pezzo che vale

```
MISURA    base(d)          = mediana sui verdi di [ t - delta*(giro-1) - rho*(eta-eta0) ]
PREDICE   t_atteso(d,giro) = base(d) + delta*(giro-1) + rho*(eta-eta0)
```

Sottrazione e ri-aggiunta con **lo stesso** coefficiente. Un errore su δ si cancella al primo
ordine sul livello e resta solo sull'estrapolazione — ed è la ragione per cui questo si può
pubblicare con un δ imperfetto.

### T5 — il bias sui tempi assoluti

| orizzonte | OGGI bias | OGGI MAE | **NUOVO bias** | **NUOVO MAE** | n |
|---|---|---|---|---|---|
| 5 giri | −2,188 | 2,193 | **−0,460** | **0,683** | 6.979 |
| 10 giri | −2,150 | 2,156 | **−0,543** | **0,757** | 11.988 |
| 20 giri | −2,041 | 2,051 | **−0,661** | **0,862** | 17.748 |

**T5 NON PASSA**: la soglia era |bias| < 0,50 su *tutti* gli orizzonti, e a 10 e 20 giri siamo
a 0,54 e 0,66. MAE ridotto del **65 %**.

### Il residuo ha un nome

Il bias **cresce con l'orizzonte** (−0,46 → −0,54 → −0,66): la firma di un termine che si
accumula. Lo stesso modello col termine di età gomma acceso (ρ = 0,0389, da Fase 0):

| orizzonte | bias con ρ | MAE con ρ |
|---|---|---|
| 5 giri | **−0,169** | 0,582 |
| 10 giri | **−0,178** | 0,624 |
| 20 giri | **−0,176** | 0,678 |

**Piatto.** Il pezzo che cresceva era esattamente il degrado. Insieme, deriva e degrado
portano il bias da −2,19 a −0,17 (**−92 %**) e la MAE da 2,19 a 0,58 (**−73 %**).

### T6 — le posizioni

```
casi confrontati: 338
posizione di rientro cambiata: 0  (0,0%)
```

**T6 PASSA.** Ma va letto per quello che è, e la prima stesura di questo report lo aveva
gonfiato («passa nel modo più forte possibile»). **Corretto il 28/07/2026 dopo la Fase 2:**

> **T6 non aveva quasi nessun potere di fallire.** Il termine di deriva `δ·(giro−1)` è
> **identico per tutti i piloti** allo stesso giro: aggiunge la stessa quantità a ogni
> `cum_time` e quindi **non può** cambiare un ordine. L'unica cosa che può muoverlo è la
> differenza fra il vecchio `pace` e il nuovo `base` — misurata: **0,033 s di dispersione
> mediana fra piloti** (max 0,103 s). Su un orizzonte di sei giri sono ~0,2 s, ben sotto ciò
> che ribalta una posizione di rientro.
>
> Quindi T6 = 0/338 dice **«la Fase 1 non tocca l'ordine per costruzione»**, non «il modello
> nuovo è stato verificato sicuro». È comunque il fatto che serve per pubblicare senza
> rischio, ma non è una validazione.

Il contrasto con la Fase 2 lo rende evidente: lì il termine ρ·età è **specifico del pilota**
(le gomme hanno età diverse), e infatti le posizioni cambiano nel **13,9 %** dei casi.

---

## 4. La decisione — e perché non la prendo da solo

La tabella del `PREREG_fase1.md` §6 dice, per T5 fallito: *«non si pubblica il modello, si
pubblica il report del perché»*.

Sono qui, e la tabella dice no. **Non riscrivo la soglia dopo aver visto il risultato**: è
esattamente ciò che la pre-registrazione esiste per impedire, e 0,50 era arbitraria tanto
quanto lo sarebbe 0,70 scelta adesso.

Ma il caso vero non è quello che la tabella immaginava, e i tre fatti vanno messi in fila:

1. **T5 manca di 4 centesimi** su 2 orizzonti su 3, dopo aver tolto il 75 % del bias.
2. **Il residuo non è ignoto**: è il degrado, misurato, e con ρ acceso T5 passerebbe largamente.
3. **T6 = 0 su 338**: pubblicare non cambia **niente** di ciò che un utente vede.

Il punto 3 taglia la questione in due, e va detto chiaro: **pubblicare la Fase 1 da sola è
invisibile.** Il pannello mostra posizioni e distacchi, non tempi sul giro assoluti. Fase 1 non
è una funzionalità, è **infrastruttura**: diventa visibile con la Fase 2, dove i tempi assoluti
entrano nel piano gomme.

**Raccomandazione al PO** — la decisione è sua, il banco non decide:

> Pubblicare **Fase 1 e Fase 2 insieme**. Fase 1 da sola è a rischio zero e a beneficio
> invisibile; con la Fase 2 diventa visibile, e insieme superano T5 con margine. La Fase 2 è
> ora un passo corto: il coefficiente c'è (Fase 0), il banco che la giudica c'è (G0), e questo
> report mostra che il pezzo che manca è esattamente quello.

Se invece la preferenza è pubblicare subito, il modo è pronto e inerte: `passo.mjs` non tocca
il kernel, e T6 garantisce che nessuna risposta in pagina si muova.

---

## 5. Cosa NON è stato fatto

- **Non ho toccato la produzione.** Nessuna riga di `demo/` o `engine/` è cambiata.
- **Non ho unificato le costanti di carburante.** Censite (§E4), non toccate: sono in 8 file e
  alcune stanno dentro artefatti già a referto. È una ri-derivazione deliberata, da fare quando
  si riapre quel cassetto.
- **Non ho sciolto il nodo fuel/evoluzione pista.** Non si scioglie dai tempi di gara (E3).
  La strada c'è ed è nuova: le **prove libere** sono in repo dal 22/07 (22 sessioni), e lì la
  pista evolve mentre il carico di carburante no. È il primo posto dove guardare quando servirà.
- **Non ho stimato Δ per circuito in produzione**: T2 e T3 dicono di no, e li ho onorati.

---

### Riprodurre

```bash
python3 ai_lab/simulatore/deriva.py --boot 2000 --perm 2000 --json ai_lab/simulatore/esito_deriva.json
node    ai_lab/simulatore/banco_fase1.mjs --json ai_lab/simulatore/esito_banco_fase1.json
```
