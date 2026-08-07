# Prereg — il pit-loss può spiegare il sotto-fermarsi?

**Data: 05/08/2026.** Scritta **prima** di aver calcolato un solo `P` richiesto.

Esegue la seconda delle due strade rimaste da `ESITO_rho_selezione.md`, dopo che la prima
— «il ρ è basso per selezione» — è caduta sul placebo.

---

## 1 · La domanda

`(k+1)* = (R+a)·√(ρ/2P)` ha **due** ingredienti. Finora se n'è guardato uno: il ρ. Ma un
`P` troppo **alto** produce esattamente lo stesso sotto-fermarsi di un ρ troppo basso — le
due grandezze entrano nella stessa radice, in versi opposti.

Il motore fa **troppo poche soste in 114 casi su 167 e troppe in zero**. Quindi:

> **quanto dovrebbe valere `P` perché il motore volesse le soste che i team fanno davvero?**

## 2 · Il conto, e perché va fatto PRIMA di misurare qualsiasi cosa

È aritmetica pura, non una stima: invertendo la forma chiusa,

```
P richiesto = ρ · (R + a)² / ( 2 · (k* + 1)² )
```

Si calcola, per ogni gara del 2026, il `P` che servirebbe perché `k*` valga **2** — il
numero di soste che la verità mostra più spesso dopo l'1 — usando i giri veri di quella
gara e il ρ sigillato.

**Non c'è niente da stimare.** Se il numero che esce è fuori dal mondo, la strada è chiusa
prima di spendere una sessione a misurare i componenti del pit-loss.

## 3 · Il metro: la distribuzione dei `P` che il progetto ha già misurato

Il pit-loss non è un'opinione: è **misurato su 26 Gran Premi** (`pitloss_interno.json`,
metodologia `(in-lap + out-lap) − 2 × mediana del passo pulito adiacente`, solo soste verdi
su gara asciutta), e va da **19,20 s** (70th Anniversary) a **28,16 s** (Emilia Romagna).

Quindi il confronto è con dati di casa, non con un'intuizione.

## 4 · Il cancello, con la soglia scritta adesso

| | cancello | soglia |
|---|---|---|
| **W0** | **il pit-loss può essere la causa** | il `P` richiesto per `k*` = 2 deve stare **dentro** l'intervallo dei `P` misurati, cioè **≥ 19,20 s**, in almeno **una gara su undici** |

**Se W0 fallisce**, il `P` richiesto è più piccolo del pit-loss più basso mai misurato su
qualunque circuito, e **il pit-loss è escluso come causa del sotto-fermarsi.** Non «è
improbabile»: è escluso dall'aritmetica, perché nessun valore fisicamente possibile di `P`
porta `k*` a 2.

**Se W0 passa** in qualche gara, allora un `P` sbagliato *potrebbe* spiegare almeno quelle,
e si passa a W1.

## 5 · W1 — il doppio conteggio, e si esegue SOLO se W0 passa

Il `P` misurato è `(in-lap + out-lap) − 2 × passo pulito`. Ma il modello applica **già** per
conto suo, sugli stessi due giri, il **rodaggio** (c = 0,67 s, τ = 4,75 giri, sulla gomma
nuova dell'out-lap) e il **degrado per età** (sull'in-lap). Se quegli effetti sono anche
dentro `P`, il motore li paga **due volte** — che è E20 nella sua forma esatta.

W1 misurerebbe quanto vale quella porzione. Soglia: **≥ 10 % di `P`** è un difetto da
mettere a referto anche se non spiega il sotto-fermarsi.

**Ma W1 non si esegue se W0 fallisce**, e la ragione va scritta prima: un doppio conteggio
da un secondo o due su ventidue non cambierebbe `k*` di niente, e misurarlo *dopo* aver
saputo che non conta sarebbe cercare un colpevole invece di una causa.

## 6 · Le regole di decisione

- **W0 fallisce** → **il pit-loss è escluso**, e con lui la seconda delle due strade. Restano
  la **forma** del degrado e le ipotesi non ancora formulate. Si riporta e si chiude.
- **W0 passa** → si esegue W1, e il suo esito decide se c'è un difetto da correggere.

In nessun ramo il pit-loss in produzione cambia dentro questa sessione.

---

**Sigillo.** Committata prima di aver calcolato un solo `P` richiesto.
