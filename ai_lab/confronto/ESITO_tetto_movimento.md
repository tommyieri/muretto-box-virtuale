# ESITO — il tetto al movimento: NULL, ma il pezzo che funziona è identificato

**Data: 03/08/2026.** Esegue `PREREG_tetto_movimento.md`, sigillata poche ore prima.
Numeri: `ESITO_cancelli_tetto.json`. Nessuna soglia toccata.

## Il verdetto

**NULL.** Due cancelli su quattro obbligatori falliscono, e il placebo dice che il
guadagno del terzo non viene da dove pensavamo.

| | cancello | senza tetto | col tetto | esito |
|---|---|---|---|---|
| **T1** | terzile alto (la ferita) | **−15** (10-25) | **+4** (21-17) | ✓ PASSA (serviva ≥ −9) |
| **T2** | basso+medio (la parte sana) | **+11** (38-27) | **−3** (25-28) | ✗ NON PASSA |
| **T3** | eccesso di movimento | **2,04** | **0,32** | si riduce *(diagnostico)* |
| **T4** | due giri (n=217) | — | **16-33, p = 0,0213** | ✗ NON PASSA |
| **T5** | placebo, 200 permutazioni | finti: mediana +2, p95 **+8** | vero **+4** | ✗ NON PASSA |

## Le tre cose che questo esito insegna

**1. Il vincolo fa esattamente ciò per cui esiste.** L'eccesso di movimento — quanti
sorpassi il motore inventa oltre quelli veri — **crolla da 2,04 a 0,32**. Il motore
comincia a produrre quasi esattamente il movimento che la pista consente, e la
popolazione che perdeva contro il non-fare-niente si raddrizza di **19 punti**. Il
meccanismo non è sbagliato: la diagnosi del referto gara-intera era giusta.

**2. Ma il guadagno NON viene dalla pista.** È il risultato del placebo, ed è netto: il
tetto vero dà **+4**; duecento tetti **finti**, con le stesse soglie mescolate a caso fra
i circuiti, danno mediana **+2** e 95° percentile **+8**. Il valore vero sta **dentro** la
distribuzione del caso, sotto il suo 95° percentile.

> **Le soglie per circuito non contribuiscono niente di misurabile.** A produrre il
> guadagno è il *pavimento* — le auto non si attraversano più — non il fatto che a Monaco
> passare sia più difficile che a Suzuka.

Ed è la formula che la prereg aveva già previsto per questo caso: *«il vincolo utile è un
pavimento uniforme, non una soglia per pista»*.

**3. Il prezzo cade dove fa più male.** Frenare il movimento aiuta dove il motore ne
inventava troppo e danneggia dove non ne inventava: la popolazione sana passa da +11 a −3.
E soprattutto **la metrica a due giri peggiora in modo significativo** (16-33, p = 0,0213)
— cioè il vincolo rompe **la sola risposta che il motore dà bene**, quella validata a ±2
posizioni. Complessivamente alla bandiera il saldo passa da −4 a +1: quasi nulla, pagato
con un danno certo sulla risposta che il prodotto pubblica.

## Il NULL, nella formula che la prereg impone

> **Il vincolo di duello importato da TUMFTM, coi suoi parametri pubblicati, riduce il
> movimento inventato dal motore là dove ne inventa troppo — ma il guadagno non dipende dal
> circuito, e il costo cade sulla popolazione sana e sulla risposta validata a due giri.**

## La convergenza che vale più dei due NULL

Oggi due rami sono stati chiusi, e hanno **lo stesso punto di rottura**:

- il **cliff** ha fallito perché serviva sapere quanto degradano le gomme *su quel
  circuito*, e quel numero non esiste in nessuna fonte;
- il **tetto** ha fallito il placebo perché la soglia *di quel circuito*, che nella fonte
  esiste ed è pubblicata, **non porta informazione misurabile** sui nostri casi.

Due volte in un giorno, l'informazione per-circuito è risultata o **non disponibile** o
**inerte**. Sommato ai cinque NULL dell'arco del degrado (per-circuito, 0/8) e al NULL
della difficoltà-pista come intensità del traffico, questo progetto ha ora **otto risultati
indipendenti** che dicono la stessa cosa: *ai suoi dati e alla sua scala, il circuito non è
un predittore utilizzabile.* Non è un fallimento ripetuto: è una regolarità, ed è la cosa
più solida imparata oggi.

## Cosa resta, e cosa NON si prova

Il pezzo che funziona è **identificato e separato**: il pavimento uniforme (`min_t_dist`,
0,50 s, costante su tutti e 121 i file della fonte) è ciò che produce il guadagno; la
soglia per circuito è inerte. Un vincolo di solo-pavimento **è una domanda diversa** da
quella che questa prereg ha giudicato, e richiederebbe la sua — non si prova adesso
riusando questi numeri, che sarebbe scegliere l'ipotesi dopo aver visto i dati (E08).

**Resta però il problema che T4 ha misurato**: qualunque vincolo che frena il movimento
danneggia la risposta a due giri. Un solo-pavimento più leggero potrebbe ridurre il danno,
ma è un'ipotesi, e va pre-registrata prima di guardarla.

## Cosa resta acceso, e cosa no

- Il vincolo **resta nel codice, SPENTO** (`tetto` null nel contesto). La produzione non
  lo vede: nessun percorso di `web/` o `demo/` lo mette nel contesto.
- `s34_tetto_movimento` verifica che spento sia **bit-identico** (cum e ordine), che il
  pavimento tenga, che chi ha il passo passi e chi non ce l'ha no, che sotto
  neutralizzazione non tocchi niente, e che quattro parametri malformati esplodano.
- **Due difetti miei sono stati intercettati dai guardiani di casa prima di produrre un
  numero pubblicato**: s34 ha bocciato un vincolo anti-sorpasso che fabbricava sorpassi
  (ordine letto a fine giro invece che a inizio); il **Director** ha bocciato un cumulato
  che non corrispondeva alla somma dei tempi sul giro, uccidendo 183 casi su 223 — senza
  quella correzione T4 girava su 40 casi e «passava» per sopravvivenza.

## Nota — un cancello mal specificato, a referto

La soglia di **T2 (≥ +13)** è stata scritta assumendo come riferimento il 44-27 misurato
su **undici** gare (saldo +17). Il perimetro corretto ne esclude Miami — che nella fonte
non esiste — e lì il riferimento è **+11**: la soglia era quindi **sopra il proprio
riferimento**, e chiedeva al tetto di *migliorare* la popolazione sana invece di non
danneggiarla.

**Non la riscrivo** (regola 3, E08). Nel merito non cambia l'esito: il danno misurato è
reale e grande (+11 → −3), quindi T2 fallisce anche nell'intenzione con cui era stato
scritto. Ma la svista va scritta, perché la prossima soglia si scriva sul perimetro giusto.

---

## Nota aggiunta il 03/08 — la linea di base di F3 non è significativa

Rileggendo `ESITO_banco_regole.json` per preparare il passo successivo: la linea di base
del KPI **F3** — il 44-27 dei due terzili bassi — ha **p = 0,0568**. Non è significativa.

Va scritto adesso e non quando servirà come scusa: **chiunque proponga una regola potrà
«non peggiorare» un riferimento che non era significativo**, e chiamarlo un successo.
F3 come è firmato resta valido (non si riscrive), ma il suo superamento va letto sapendo
che la barra è appoggiata su un risultato al limite della soglia.
