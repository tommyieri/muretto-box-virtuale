# PREREG — FASE MESCOLA: il degrado separa per mescola?

**Scritta il 2026-07-29, PRIMA di calcolare un solo contrasto SOFT−HARD.**
Regola 3. Ciò che è già stato guardato, e che si dichiara qui, sono soltanto
numerosità strutturali: 6.985 stint su 167 gare utilizzabili, e la tabella degli
stint per mescola per anno (che decide quali stagioni sono confrontabili). Nessun
numero di esito.

## La domanda, e perché non è già chiusa

CLAUDE.md dice che al giorno 1 le mescole **non** separano il degrado
(SOFT−HARD, p = 0,209 sul 2026) e che la separazione è «l'ipotesi della Fase 3
sul fondo, con cancello fuori campione». Questa è quella fase: 167 gare invece
di 11, e 33.574 giri SOFT.

## Unità e appaiamento

**Unità**: lo stint, con ≥ 5 giri di passo utilizzabile (verde, tempo presente,
età presente). Per ogni stint la pendenza OLS del tempo sul giro contro l'età
gomma (`data/viste/stint_fondo.json`, generata dal modulo che possiede la
definizione di verde).

**La pendenza è GREZZA, e va bene così.** Dentro uno stint l'età cresce di pari
passo col giro di gara, quindi la pendenza osservata è `ρ(mescola) + δ_giro`, con
`δ_giro = −δ₇₀/N`. Nel contrasto fra due stint della **stessa gara** δ_giro è
identico e **si cancella esattamente**: la differenza SOFT−HARD non dipende da δ
e non eredita l'incertezza della sua stima. È la ragione per cui l'appaiamento
entro pilota/gara è la scelta corretta, non una comodità.

**Appaiamento**: l'unità appaiata è la terna **(anno, gara, pilota)** che ha
almeno uno stint SOFT **e** almeno uno stint HARD. Dentro l'unità:

    Δ = media(pendenze SOFT) − media(pendenze HARD)

Pilota, vettura, circuito, meteo, legge del carburante e condizioni di gara sono
gli stessi dentro l'unità: si annullano per costruzione invece di essere
"controllati" da un modello.

**Nessun filtro su R².** Selezionare gli stint che si adattano bene è selezionare
sull'esito: uno stint con degrado forte e pulito entrerebbe, uno piatto e
rumoroso no, e la separazione comparirebbe da sola.

## Campione

- **2019–2025**. Il **2018 è ESCLUSO** e il motivo è strutturale, non di
  comodo: quella stagione usa la nomenclatura vecchia (SUPERSOFT, ULTRASOFT,
  HYPERSOFT) e ha **2 stint HARD in tutto** — il contrasto SOFT−HARD lì non
  esiste.
- **6 gare del 2019 escluse** perché il grezzo non porta le colonne di identità,
  stint, età e status: senza quelle non c'è uno stint da misurare. Sono
  dichiarate per nome nella vista.
- Una stagione entra nel giudizio con **≥ 20 unità appaiate**; sotto quella
  soglia si dichiara **insufficiente** e non fa cancello.

## Stimatore e incertezza

- **primario**: media di Δ sulle unità appaiate;
- **secondario riportato** (non decide): mediana di Δ, e media pesata per il
  numero di giri delle pendenze;
- **incertezza**: bootstrap 10.000 ripetizioni con **blocchi = gare** (E11 —
  mai pooling che ignori la struttura), IC95 percentile.

## Null per permutazione

Dentro un'unità appaiata, sotto l'ipotesi nulla di nessun effetto della mescola,
le etichette SOFT/HARD sono **scambiabili**: scambiarle inverte il segno di Δ.
Il null è quindi il **test dei segni per permutazione** — 10.000 assegnazioni
casuali di segno alle unità — e il p-value bilaterale è la frazione di
statistiche nulle con |media| ≥ |media osservata|.

Il permutation test è dichiarato PRIMA perché è la cosa che rende il p-value
interpretabile senza assumere normalità su pendenze rumorose.

## Leave-one-year-out

Per ogni stagione y ∈ {2019 … 2025}: stima su tutte le altre, e riporta la
stima della stagione y. Sette stime, tutte a referto: serve a vedere se
l'effetto è **stabile** o se vive in una stagione sola.

## CANCELLO (dichiarato prima)

Fuori campione = **2024 e 2025**. Dentro campione = **2019–2023**.

Il cancello **passa** se, per **entrambe** le stagioni fuori campione:

1. l'IC95 bootstrap della media di Δ **esclude lo zero**; e
2. il segno concorda con la stima dentro campione.

Non basta il p-value dentro campione, e non basta una stagione: due stagioni
fuori campione, entrambe.

**Attesa direzionale falsificabile**: Δ > 0, cioè la SOFT degrada più in fretta
della HARD. Se l'effetto risultasse significativo **col segno opposto**, il
cancello NON passa: sarebbe un segnale di confondimento (per esempio la SOFT
montata in finestre di gara sistematicamente diverse), non una misura di fisica
della gomma.

## Se il cancello non passa

La separazione per mescola **non entra nel modello**: ρ resta comune, la pagina
continua a dichiarare che la mescola scelta non cambia il degrado, e questo
esito resta a referto con i suoi numeri.

Il prompt indica come ripiego il «delta nominale Pirelli etichettato modello».
Lo si adotterà **solo con una fonte citabile** per quel numero: qui non se ne
inventa uno. Un numero inventato con targhetta `modello dichiarato` sarebbe
comunque un numero inventato, e la targhetta non lo redime.

## Cosa renderebbe l'esperimento non informativo

- Meno di 20 unità appaiate in una delle due stagioni fuori campione → cancello
  **non giudicabile**, a referto.
- Un effetto che dentro campione ha IC che contiene lo zero: allora il fuori
  campione non ha nulla da confermare, e si dichiara che la fase è chiusa in
  negativo senza pretendere di aver misurato una separazione.
