# Prereg — il ρ e la selezione: chi è ancora in pista al giro trenta

**Data: 05/08/2026.** Scritta **prima** di aver stimato un solo ρ su una finestra d'età.

Esegue il ramo indicato da `ai_lab/pianificatore/ESITO_scomposizione_errore.md`.

---

## 1 · La domanda, e da dove viene

Il motore fa **troppo poche soste in 114 casi su 167 e troppe in zero**. La causa è
aritmetica: con `(k+1)* = (R+a)·√(ρ/2P)`, il ρ sigillato (0,030776) e un pit-loss di 22 s,
il numero ottimo di soste **non arriva a 1 nemmeno su settanta giri**.

E il ρ è dichiarato **limite inferiore** dal progetto stesso, con la sua ragione:

> *«Le età alte esistono solo per chi ha scelto di restare fuori, e spesso lo fa perché la
> sua gomma va bene.»* — `ESITO_degrado_dal_campo.md`

Quindi: **il ρ è basso perché lo misuriamo sui sopravvissuti?** E se sì, di quanto.

## 2 · Come si misura una selezione senza avere i non-sopravvissuti

Non si può osservare la gomma che è stata tolta. Si può però osservare **quanto il ρ cambia
man mano che si ammettono età più alte**, cioè man mano che il campione diventa più
selezionato.

**La scala.** Lo stesso stimatore già in casa (`degradoDi`, effetti fissi `gara|pilota` e
`gara|giro`, un solo ρ comune), su finestre d'età annidate:

```
A ∈ { 10, 15, 20, 25, 30, ∞ }        si stima ρ(A) sulle osservazioni con età ≤ A
```

**Sotto selezione, ρ(A) DECRESCE al crescere di A**: aggiungendo età alte si aggiungono
sopravvissuti, cioè gomme buone, cioè pendenze basse.

**Il rodaggio esce da tutte le finestre.** Le età 0-4 sono contaminate dal termine di
rodaggio (c = 0,67 s, τ = 4,75 giri) che il modello ha già: **ogni finestra parte da età 5**,
così il confronto fra finestre non è confuso da quanta scaldata contiene ciascuna. Deciso
adesso, non dopo.

## 3 · Il confondente, dichiarato prima: selezione o CURVATURA?

Una scala decrescente ha **due** spiegazioni, e vanno separate o non si conclude niente:

1. **selezione** — a età alta restano le gomme buone;
2. **curvatura** — il degrado è genuinamente concavo, la pendenza cala con l'età anche senza
   nessuna selezione.

La scala da sola **non le distingue**. Il placebo sì, ed è per questo che è il pezzo
centrale di questa prereg e non un ornamento.

### Il placebo: la censura mescolata

Ogni stint ha una lunghezza osservata `L`. Si **permutano le `L` fra gli stint della stessa
gara** (E11: mai fra gare) e si tronca ogni stint alla lunghezza che gli è capitata. Il
campione risultante ha **la stessa distribuzione di lunghezze**, ma la lunghezza di ciascuno
non ha più niente a che fare con come stava andando la sua gomma: **la selezione è rotta, la
curvatura è intatta.**

Quindi:

- se la scala vera decresce **e** le scale finte decrescono uguale → è **curvatura**, non
  selezione;
- se la scala vera decresce **più** delle finte → è **selezione**.

**Un limite del placebo, dichiarato**: si può solo accorciare, mai allungare. Se a uno stint
capita una `L` più lunga della sua, resta com'è. Questo rende il placebo *più simile* ai dati
veri, cioè **conservativo**: se la scala vera si distingue lo stesso, la conclusione è più
forte, non più debole. Il numero di stint lasciati intatti si riporta.

**500 permutazioni**, seme dichiarato `20260805`.

## 4 · Il perimetro

Le stesse osservazioni di `campo.mjs::osservazioni` — giri verdi utilizzabili, slick, età
presente — sulle **11 gare del 2026**, che è dove vive il ρ in produzione. Il fondo
2018-2025 **non entra qui**: cambierebbe due cose insieme (la selezione e l'era), e questa
prereg ne isola una. Se la selezione esiste, portarla sul fondo è la domanda successiva.

## 5 · I cancelli, con le soglie scritte adesso

| | cancello | soglia |
|---|---|---|
| **R1** | **la selezione esiste** | `ρ(≤10) / ρ(∞) ≥ 1,25` **e** placebo **p ≤ 0,05** |
| **R2** | **basta per il prodotto** | col ρ corretto nel motore: «troppo poche» da 114 a **≤ 90**, e «troppe» resta **≤ 20** |
| **R3** | **non fa danno** | bias del kernel, banda di rientro e risposta a due giri non peggiorano oltre le rosse già dichiarate |

**R1 e R2 sono due domande diverse e vanno tenute separate.** R1 è scientifica: la selezione
c'è? R2 è di prodotto: è abbastanza grande da spostare il piano? La scomposizione dice che
per volere due soste servirebbe un ρ **da 2,6 a 8 volte** quello di oggi — quindi **R2 è
molto probabile che fallisca anche se R1 passa**, ed è scritto qui prima di saperlo.

**R3 non è negoziabile.** Il ρ oggi tiene in piedi il passo, la banda di rientro e la
risposta a due giri: un ρ che migliora il piano e rompe quelle tre non è un miglioramento,
è uno scambio non richiesto.

## 6 · Le regole di decisione

- **R1 fallisce** → **la selezione non c'è, o è curvatura.** Il ρ basso è reale e il
  sotto-fermarsi ha un'altra causa. È il risultato più informativo dei tre, perché toglie
  di mezzo l'unica spiegazione che il progetto aveva.
- **R1 passa, R2 fallisce** → la selezione è **reale ma piccola**. Si riporta il numero, si
  **dichiara** che non basta a spostare il piano, e non si tocca la produzione. Il ρ
  corretto resta un dato, non un parametro.
- **R1 e R2 passano, R3 fallisce** → non si accende: lo scambio non è richiesto.
- **Tutti passano** → si **propone al PO** la sostituzione del ρ, con la sua targhetta.

In nessun ramo il ρ in produzione cambia dentro questa sessione.

## 7 · Cosa NON si fa

- Non si alza il ρ a mano perché il piano venga più bello: sarebbe tarare un parametro
  fisico su un esito di prodotto.
- Non si riapre il **cliff** (NULL il 03/08): quello era un termine della **sola età**, qui
  si parla del **livello** di ρ. Sono due grandezze diverse e la distinzione va tenuta.
- Non si tocca `kMax`, la forma chiusa, il pit-loss, il rodaggio.
- Non si stima nulla sul fondo: un'era diversa è un'altra domanda (§4).

---

**Sigillo.** Committata prima di aver stimato un solo ρ su una finestra.
