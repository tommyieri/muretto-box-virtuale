# PREREG — il rodaggio della gomma nuova: `w(età) = −c·exp(−età/τ)`

*Scritto il 01/08/2026, PRIMA di stimare `c` e `τ` e PRIMA di toccare `passo_v2.mjs`
(regola 3). L'unica cosa già guardata è la **linea di base del motore attuale**, che serve
a scrivere i numeri del cancello: è la misura dello stato pre-modifica, non del risultato.*

Voce 1 di `PIANO_CORREZIONE.md`. Il fenomeno che la motiva è misurato e sta a referto
(`REFERTO_confronto_motori.md`, §H): in aria libera i giri a età 2-8 dopo una sosta girano
**0,275 s/giro più veloci** di quanto il modello v2 preveda — IC95 [−0,415; −0,037],
n = 1.249, mediana negativa in 8 gare su 10 — mentre a età 9-20 il residuo è 0,000.

---

## 1 · La domanda

Il modello v2 dice che una gomma è tanto più lenta quanto più è vecchia, e basta:

```
t = base(pilota) + δ·(giro − 1) + ρ·età
```

I residui dicono che nei primi giri di vita la gomma è **più veloce** di così, e che
l'anomalia si esaurisce entro una decina di giri. La domanda è se aggiungere un termine di
rodaggio che decade

```
t = base(pilota) + δ·(giro − 1) + ρ·età − c·exp(−età/τ)        c ≥ 0, τ > 0
```

faccia **rispondere meglio il prodotto** — non se migliori l'aderenza ai dati, che per
costruzione migliora ogni volta che si aggiungono due parametri.

## 2 · Perché questa forma, e non un gradino

Un gradino costante post-sosta è **E01**, l'errore che produceva «fermati subito» nel 100%
dei casi: 718/718 sul vecchio motore. La forma esponenziale evita quel difetto per
costruzione — `w → 0` per età grande, quindi non c'è nessun vantaggio perpetuo e la `base`
conserva il suo significato di **passo su gomma matura**.

La scelta è a due parametri e non di più: `c` è quanto vale il rodaggio al primo giro, `τ`
è in quanti giri si spegne. Non si stimano curve per mescola (Fase 3, cancello fuori
campione) e non si aggiunge nessun cliff di fine vita.

## 3 · La regola 10 vale qui più che altrove

`w` va **sottratta misurando** in `stimaBasi` e **ri-aggiunta simulando** in `creaPasso`,
nella stessa modifica. Se si aggiungesse solo a `creaPasso`, la `base` misurata
continuerebbe ad assorbire il rodaggio e il termine verrebbe contato due volte: è
esattamente **E02**, il carburante sottratto e mai ri-aggiunto, che valeva −1,48 s/giro.

Corollario pre-dichiarato: con `c = 0` (o parametri assenti) le due funzioni devono dare
**esattamente** i numeri di oggi, bit a bit. È la prima sentinella.

## 4 · L'ottimo a una sosta non si sposta — e questo è il guardrail, non il rischio

Il piano avvisa che «con τ troppo grande il termine degenera in un vantaggio quasi-perpetuo
dopo la sosta, cioè E01». **Analiticamente non succede, e la ragione va scritta prima di
guardare i numeri**, non dopo.

Su `R` giri rimanenti, con età `a` al congelamento e sosta dopo `k` giri, il costo è

```
cost(k) = Σⱼ₌₁..ₖ [ρ(a+j) + w(a+j)] + Σⱼ₌₁..ᴿ⁻ᵏ [ρ·j + w(j)] + P + (termini in δ, indipendenti da k)
```

la cui differenza prima in `k` è

```
ρ·(2k + a − R) + w(a+k) − w(R−k)
```

Nel punto `k* = (R − a)/2` si ha `a + k = R − k`, quindi **`w(a+k) − w(R−k) = 0` per
qualunque `w`**: l'ottimo resta dove l'algebra del modello v2 lo mette. Non è una proprietà
dell'esponenziale, è una simmetria — l'ottimo è il punto in cui l'età al pit eguaglia l'età
alla bandiera.

La derivata seconda passa da `2ρ` a `2ρ + (c/τ)·[e^{−(a+k)/τ} + e^{−(R−k)/τ}]`, che per
`c > 0` è **maggiore**: il minimo diventa più stretto, non più piatto.

Conseguenza operativa, dichiarata prima: **`s12_ottimo_analitico` deve restare verde senza
essere toccata**. Se si spostasse, il termine non sarebbe additivo sull'età come qui
scritto, e il difetto sarebbe nel codice — non nella forma. Nessuna soglia di `s12` va
allargata per far passare questo lavoro.

Ne segue anche una previsione, che vale come sonda: **il giro raccomandato dalla curva del
«quando» non deve cambiare quasi mai**. Ciò che il rodaggio cambia è la posizione prevista
al rientro a giro di sosta FISSO — dove io riparto da età 1 e i rivali sono a età alta — non
il punto in cui conviene fermarsi. Se il giro raccomandato si spostasse in molti casi,
c'è un errore di segno o di indicizzazione dell'età da qualche parte.

## 5 · Come si stimano `c` e `τ` — dichiarato prima di stimarli

**Popolazione.** Giri verdi utilizzabili (`passoUtilizzabile`, che già esclude in-lap,
out-lap, cancellati, non-slick e regimi) con `tyre_age` non nullo, **in aria libera**:
`gap all'auto davanti allo stesso indice di giro > 2,0 s`, oppure primo (nessuno davanti).
È la stessa definizione di `fisica_sonde.mjs:88`, e la ragione è misurata: sotto 0,5 s di
gap il residuo vale +0,576 s/giro, e chi esce dai box rientra spesso in mezzo al traffico.
Stimare la **forma** in aria libera evita di confondere il rodaggio con la scia.

**Asimmetria dichiarata:** `c` e `τ` si stimano in aria libera ma si applicano a tutti i
giri, esattamente come già si fa per `ρ` e `δ`. Non è una svista: la base di produzione si
misura su tutti i giri verdi, e cambiare quella è la voce PARCHEGGIATA del piano, non
questa.

**Stimatore.** Per ogni coppia `(c, τ)` della griglia:
1. `r0 = t − δ·(giro−1) − ρ·età` con `δ` e `ρ` **cablati, non ri-stimati**;
2. `base(gara, pilota) = mediana( r0 + c·exp(−età/τ) )` — la stessa mediana per blocco che
   fa `stimaBasi`, ricalcolata a ogni `(c, τ)`: senza questo il termine si confonde col
   livello del pilota;
3. residuo `e = r0 + c·exp(−età/τ) − base(gara, pilota)`;
4. perdita = **somma di |e|** su tutti i giri ammessi. L1 e non L2 perché la base è una
   mediana: la coppia stimatore/perdita deve essere una sola cosa.

**Griglia, dichiarata qui:** `c ∈ {0,00 … 1,50}` passo 0,01 · `τ ∈ {0,25 … 15,00}` passo
0,25. Se il minimo cade **sul bordo** della griglia, la forma non è identificata su questi
dati e l'esito è NULL: non si allarga la griglia dopo aver visto dove è finito.

**Incertezza:** bootstrap a blocchi = gare (E11), 2.000 ripetizioni, seme 20260801 — lo
stesso seme e la stessa funzione già usati da `fisica_residui.mjs` e `fisica_sonde.mjs`.

**Leave-one-race-out.** Per ogni gara `r`: `(c, τ)` si stima sulle **altre 10** e si
applica ai casi di `r`. I risultati delle 11 gare si mettono insieme, e **quella è la
lettura primaria del cancello**. La stima su tutte e 11 si riporta come lettura secondaria,
etichettata dentro campione.

## 6 · Il cancello

Metrica: **M1 in lettura B2** — errore di posizione al rientro sulle soste vere, previsione
e verità ri-classificate sulla terna comune `verità ∩ vecchio ∩ nuovo`. Stessi 223 casi
appaiati, stesso banco, stesso perimetro di `PREREG_confronto_motori.md`.

**Correzione di specifica, dichiarata.** Il cancello scritto in `REFERTO…md` §H nomina la
lettura B2 ma cita come soglie del segno `49,8%` e `+0,96`, che sono numeri della **lettura
A**. Le due letture non sono confrontabili (le popolazioni differiscono), quindi la
condizione sul segno si scrive con i valori **B2 del motore attuale**, misurati oggi prima
di qualunque modifica con `metrica_M1b.mjs --json`:

> B2, motore nuovo, oggi: n = 223 · mediana |err| 1,0 · media |err| 1,031 · esatti 101
> (**45,29%**) · entro 1: 163 (73,09%) · bias mediano 0 · bias medio **+0,8251** ·
> troppo indietro 106 (**47,53%**) · troppo avanti 16 (7,17%) · max 6

Questa non è una riscrittura del cancello dopo aver visto il risultato (E08): il risultato
della modifica non esiste ancora. È la sostituzione di due numeri della lettura sbagliata
con i corrispondenti della lettura che il cancello stesso nomina. Il difetto originale
resta a referto.

**Il termine si accende solo se, in lettura primaria LORO, valgono TUTTE e quattro:**

| | condizione | soglia (motore attuale) |
|---|---|---|
| C1 | mediana \|err\| ≤ | 1,0 |
| C2 | quota esatti ≥ | 45,29% (101/223) |
| C3 | quota «troppo indietro» < | 47,53% (106/223) |
| C4 | \|bias medio\| < | 0,8251 |

C3 e C4 sono la condizione sul segno che il piano chiede: non basta sbagliare meno, deve
sbagliare **meno da un lato solo**. Un termine che migliorasse gli esatti spostando il bias
da +0,83 a −0,83 non passerebbe, ed è giusto così: sarebbe un'altra asimmetria, non una
correzione.

**Non-danno, oltre al cancello:** la suite del banco (`s01`…`s27`) deve restare verde, e in
particolare `s11`/`s14` (invarianza al troncamento) e `s12` (ottimo analitico) senza che
nessuna soglia venga toccata.

## 7 · Cosa fa dichiarare NULL

Tutte queste sono esiti, non incidenti. Si scrivono a referto, il termine resta **spento**
e i parametri restano nel modello con `attivo: false`:

- una qualunque fra C1–C4 non regge in lettura LORO;
- il minimo della perdita cade sul bordo della griglia;
- `τ` stimato varia di oltre un fattore 3 fra i LORO (la forma non è stabile fra gare);
- `s12` si sposta, oppure una sentinella del banco diventa rossa;
- il giro raccomandato dalla curva del «quando» cambia in più del 10% delle viste
  pubblicate (la §4 dice che non deve: se cambia, il codice non fa ciò che questa
  pre-registrazione descrive).

## 8 · Cosa NON dimostra, comunque vada

- **Resta dentro campione.** `ρ`, `δ₇₀`, la banda di rientro e ora anche `(c, τ)` vivono
  tutti sulle stesse 11 gare 2026. Il LORO è dentro quelle 11. Il primo fuori campione vero
  è il 23 agosto (`PREREG_holdout_Olanda.md`), e nessun risultato di qui è un fuori
  campione.
- **M2 non è il giudice**, ed è dichiarato in anticipo: in una finestra senza soste tutte le
  età avanzano insieme e `w` si cancella nel distacco. M2 si riporta come osservazione che
  non decide. Se M2 peggiorasse in modo grosso sarebbe una **sorpresa da spiegare**, non un
  criterio da invocare a posteriori.
- **Il ramo neutralizzato non si tocca.** È la voce 2 del piano e ha il suo cancello. Se
  M1 migliorasse solo lì, sarebbe un caso da guardare con sospetto, non un successo.
- Il fenomeno è misurato su 10 gare con mediana negativa; **due gare hanno segno
  contrario** e restano tali dopo l'accensione.

## 9 · Regola di condotta

Se il cancello non passa, si scrive che non passa e il termine resta spento — come per i
cinque cancelli dell'arco degrado. Un cancello mal specificato si mette a referto e se ne
pre-registra uno nuovo: non si riscrive dopo aver visto il risultato (E08).
