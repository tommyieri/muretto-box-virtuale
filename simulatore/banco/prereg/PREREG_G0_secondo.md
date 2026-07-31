# PREREG — G0″ (e ritiro di G0′)

**Scritta il 2026-07-29, dopo aver eseguito G0′ e averne diagnosticato il
difetto.** Regola 3 ed E08: un cancello sbagliato si mette a referto e se ne
pre-registra uno nuovo — **non si riscrive quello vecchio dopo aver visto il
risultato**. Questo documento non tocca `PREREG_banco.md`: la specifica di G0′
resta lì esattamente com'era.

## Cosa ha detto G0′

Eseguita come pre-registrata sulle 11 gare 2026:

- **799 casi ammessi, 731 passati → 91,49%**, contro un cancello del 100%.
  **G0′ NON passa il proprio cancello.**
- 673 casi interni: **0 fallimenti**. La forma chiusa e lo sweep del kernel
  coincidono ovunque l'ottimo sia interno.
- 126 casi al bordo, di cui **68 falliti**.

## Il difetto: G0′ ha ripetuto E08 in forma più sottile

Tutti e 68 i fallimenti hanno la stessa firma, senza eccezioni:

- `argmin = [1]` — il motore dice "fermati al primo giro utile";
- `k* = (R − età)/2` fra **−12 e −2,5** — l'ottimo analitico cade **prima** del
  primo giro utile;
- **età > giri rimasti** in tutti e 68 — gomma più vecchia di quanto resta da
  correre.

Quando `k* ≤ 1`, "fermati al primo giro utile" **è** la risposta corretta, e
più `k*` sta sotto 1, più lo è. G0′ la conta come fallimento perché misura la
distanza `|k* − bordo|` in valore assoluto, con tolleranza 3: così boccia
proprio i casi in cui la risposta al bordo è meno ambigua.

È esattamente l'errore di G0 — "contava come fallimento la risposta corretta al
bordo" — sopravvissuto dentro la metrica scritta per ripararlo. La lezione
aggiornata di E08 è che la clausola di bordo va **a una coda**, non a due.

## G0″ — la specifica

Identica a G0′ tranne la clausola di bordo, che diventa **unilaterale**:

- `argmin` **interno** (`1 < argmin < R−1`): passa se coincide con `k*`, con la
  regola dei pari merito quando `R − età` è dispari. **Invariato.**
- `argmin` al **bordo basso** (`k = 1`): passa se `k* ≤ 1 + 3`.
  Nessun limite inferiore: un `k*` molto sotto 1 rende la risposta *più*
  corretta, non meno.
- `argmin` al **bordo alto** (`k = R−1`): passa se `k* ≥ (R−1) − 3`.
  Nessun limite superiore, per simmetria.

La tolleranza 3 resta quella già pre-registrata, e serve al solo caso per cui
era pensata: `k*` poco dentro il dominio mentre l'argmin discreto cade sul
bordo. Un difetto vero resta preso: `k* = 10` con `argmin = 1` fallisce ancora,
perché 10 > 4.

**Cancello: 100% dei casi ammessi.** È una proprietà di correttezza contro la
forma chiusa, non una soglia statistica.

## Onestà sul valore di questa prima esecuzione

G0″ è pre-registrata **sugli stessi dati che ne hanno motivato la scrittura**.
Il suo primo numero è quindi **descrittivo, non confermativo**: dice che la
regola nuova classifica correttamente i casi già visti, il che è quasi
tautologico. La prova confermativa è la **prossima gara 2026 non ancora nel
fondo**, su cui G0″ girerà senza che nessuno l'abbia guardata prima.

Fino ad allora, il numero da citare per G0″ porta questa targhetta:
**"misurato in campione, sugli stessi casi che hanno rivelato il difetto di
G0′"**.

## Stato di G0′

**RITIRATA.** Resta a referto con il suo 91,49% e la diagnosi qui sopra; non è
più un cancello, perché un cancello mal specificato che boccia risposte
corrette non sorveglia niente — segnala solo se stesso. Non viene cancellata:
il suo numero e il suo difetto sono parte della storia del banco (E21: una
misura non si cancella).
