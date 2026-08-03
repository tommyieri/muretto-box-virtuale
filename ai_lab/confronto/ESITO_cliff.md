# ESITO — il cliff: NULL onorato, e il muro non è dove pensavamo

**Data: 03/08/2026.** Esegue `PREREG_cliff_derivato.md`, sigillata poche ore prima.
Numeri: `ESITO_cancelli_cliff.json`. Nessuna soglia è stata toccata, nessun κ aggiunto.

## Il verdetto

**Nessuno dei tre κ passa i quattro cancelli.** L'arco del cliff si chiude.

| κ | C1 · Austria / Spagna | C2 · peggiore delle otto | C3 · due giri | C4 · bandiera | esito |
|---|---|---|---|---|---|
| **p25** 0,00050 | 22,5% / 0,0% ✗ | Monaco **45,8%** ✗ | 14-22 (p=0,24) ✓ | **+2** ✓ | NON PASSA |
| **mediana** 0,00110 | 27,0% / 17,7% ✗ | Monaco **53,2%** ✗ | 19-24 (p=0,54) ✓ | **−7** ✗ | NON PASSA |
| **p75** 0,00280 | **58,6% / 50,5%** ✓ | Monaco **60,4%** ✗ | 31-28 (p=0,79) ✓ | **−21** ✗ | NON PASSA |

Come previsto dalla prereg, i tre κ sono stati eseguiti e riportati tutti e tre: il
risultato è una banda, non una scelta.

## Cosa dicono i numeri, oltre al sì/no

**C1 e C2 sono in conflitto a OGNI κ, e già al più piccolo.** Questa è la scoperta, non il
fallimento. Guardate la prima riga: alla curvatura più bassa il motore propone due soste a
**Monaco nel 45,8% dei pannelli** — dove la fonte esterna ne prevedeva una — mentre in
Austria, dove ne servivano due, arriva al 22,5%. **Il termine produce più soste dove non
servono che dove servono, e lo fa prima ancora che il parametro conti.** Non esiste un κ
intermedio che tenga insieme i due cancelli: crescendo, entrambe le quote salgono insieme.

**Il motivo è strutturale, e vale oltre questa forma.** Un termine che dipende dalla sola
età della gomma entra nel costo del piano come `κ·(R+a)³`: **scala col cubo
dell'orizzonte**, quindi le gare lunghe prendono più soste per costruzione. Monaco ha 78
giri, l'Austria 71. Il modello non ha imparato *dove* servono due soste — ha imparato che
le gare lunghe ne vogliono di più, che è una cosa diversa e in buona parte falsa.

**Ciò che avrebbe distinto l'Austria da Monaco è quanto la gomma degrada su quel
circuito** — cioè esattamente la grandezza per-circuito che questo progetto ha dichiarato
NULL cinque volte e che la letteratura non pubblica. Il cliff fallisce per la stessa
ragione per cui era fallito il degrado per-circuito. Non è una coincidenza: è lo stesso
pezzo di informazione mancante, chiesto da un'altra angolazione.

**C3 tiene sempre.** La metrica a due giri non peggiora a nessun κ (p fra 0,24 e 0,79):
il termine non rompe la sola risposta che il motore dà bene. È l'unica buona notizia, ed è
coerente col fatto che a due giri l'età della gomma cambia poco.

**C4 si degrada in modo ordinato**: +2 → −7 → −21. Più curvatura, più il motore inventa
soste, più si allontana dal nullo alla bandiera. È la stessa popolazione «inventa
movimento» che perdeva 13-28, vista da un'altra parte.

## Il NULL, nella formula che la prereg impone

> **La forma di fine vita quadratica, coi parametri derivati dai `k_2_quad` pubblicati di
> TUMFTM secondo la regola dichiarata, non è sufficiente a far comparire una seconda sosta
> dove la fonte esterna se l'aspettava — senza farla comparire, di più, dove non serviva.**

Deficit residuo dopo il cliff, sui bersagli: al κ mediano l'Austria resta al 27,0% e la
Spagna al 17,7% dei pannelli, contro il >50% richiesto. Al p75 il bersaglio è raggiunto ma
al prezzo di Monaco al 60,4% e di un saldo alla bandiera di −21.

## La seconda forma NON si prova

La prereg concede un secondo tentativo con una forma diversa, dichiarandolo come tale.
**Non lo usiamo, ed è una scelta motivata, non una rinuncia**: qualunque forma funzione
della *sola età* ha lo stesso difetto strutturale — cambia la curva, non cambia il fatto
che si applica identica su tutti i circuiti. Spenderemmo un tentativo per ritrovare lo
stesso muro qualche decimale più in là. Il tentativo resta **non speso**, e chi tornerà su
questa strada lo troverà disponibile.

**Cosa servirebbe davvero**, scritto per chi verrà: un termine che sappia *distinguere i
circuiti*. Serve una fonte che pubblichi quanto degradano le gomme circuito per circuito —
non una forma più elaborata.

## Cosa resta acceso, e cosa no

- Il termine `q(η) = κ·η²` **resta nel codice, SPENTO** (`cliff` null). La sentinella
  `s33_cliff_spento` verifica su 2.760 coppie giro×età che spento sia **bit-identico**, che
  la regola 10 sia integra, e **misura quanto costerebbe romperla**.
- **Nessun modello con cliff è stato scritto su disco**: `modello_v2.json` non è stato
  toccato, e nessun file nuovo è stato sigillato. Ciò che gira in produzione è esattamente
  ciò che girava stamattina.
- Il numero utile da portarsi via: **la curvatura necessaria esisteva ed era alla portata
  della letteratura** (0,00126 richiesto contro una mediana pubblicata di 0,00110). Il muro
  non era la magnitudine. Era che una curvatura uniforme risponde alla domanda sbagliata.
