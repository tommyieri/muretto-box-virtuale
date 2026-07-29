# PREREG — la caccia agli ±11,7 s del passo base

Primo giro dell'**agente autonomo a compito**. Branch `ai-lab/autonomo-passobase`,
21/07/2026. Scritto **prima** di testare le ipotesi.

Premessa costituzionale accettata: **niente nel motore è fermo**. Il fondo è l'unica cosa
che non si discute; passo base, carburante, degrado e kernel sono la migliore ipotesi
corrente, e il mandato è dimostrarli sbagliati.

## 0. La diagnosi che apre la caccia (descrittiva, non un test)

Prima di piantare qualcosa ho decomposto l'errore di ricostruzione per **categoria di
giro**, su 181 casi (pilota-gara) di 18 gare pulite del regime a effetto suolo. Il residuo
`reale − previsto`, sommato sull'intera gara, si spacca così (mediana per caso, s):

| categoria | mediana | p16 · p84 | giri mediani |
|---|---|---|---|
| **aria libera (gap > 5 s)** | **0,00** | −0,22 · +0,50 | 18 |
| **traffico (gap < 5 s)** | **+8,00** | −0,03 · +21,72 | 28 |
| in/out-lap (già tolto il pit-loss) | −0,10 | −1,26 · +2,02 | 2 |
| non-verde | 0,00 | 0,00 · +0,28 | 0 |

**Caveat che invalida la lettura ingenua**: il livello in aria libera è ~0 **per
costruzione** — α è stimato proprio su quei giri, e i residui OLS dentro le dummy di
pilota sommano a zero. Quel 0,00 **non è una prova** che il passo base sia giusto: è la
tautologia del fit sul proprio training set.

Perciò la caccia di stanotte non è "il passo base è già perfetto", ma: **il passo base
regge fuori dai giri su cui è stato stimato?**

## 1. Le ipotesi, in ordine, e perché

**H1 — il livello NON è costante dentro la gara.** Il modello dà a ogni pilota **un solo**
α per gara. Se il livello deriva (adattamento del pilota, evoluzione del bilanciamento,
fasi di gestione, qualità del set di gomme), un α unico sbaglia sistematicamente le due
metà della gara in direzioni opposte, e l'errore di livello si accumula per ~55 giri.
È la prima perché è la sola che spiegherebbe un errore di **livello** (che si accumula),
mentre il rumore giro-per-giro si cancella.
*Test*: α stimato sui giri in aria libera della **prima metà** della gara, misurato sui
giri in aria libera della **seconda metà** (mai gli stessi giri). Se lo scarto è
sistematico e non centrato in zero, H1 è viva.

**H2 — il livello è per-STINT, non per-gara.** Ogni set di gomme è un oggetto diverso
(costruzione, pressioni, giri di qualifica già fatti). *Test*: α per (pilota, stint)
stimato su metà dei giri liberi dello stint, misurato sull'altra metà.

**H3 — α stimato su pochi giri liberi è rumoroso.** Chi passa la gara in traffico ha un α
poggiato su pochissimi giri. *Test*: correlazione fra numero di giri liberi e |errore|,
e guadagno di uno stimatore a **pooling parziale** verso il livello di squadra.

Se tutte e tre muoiono, il NULL motivato è l'esito, e la conclusione sarà che gli ±11,7 s
**non vengono dal passo base**.

## 2. Il metro, e come si vince

Metrica invariata dal degrado: `E = |sim(strategia reale) − tempo reale|` per (gara,
pilota), su gare pulite (nessun giro sotto SC/VSC), regimi **mai impilati**.

Due letture, entrambe riportate:
- **p68 di E** sui casi — è il numero da confrontare con l'**11,73 s** di ieri;
- **mediana per gara**, aggregata sui **BLOCCHI** con `scheletro.bootstrap_a_blocchi`
  (funzione **sigillata, chiamata e non modificata**) → mediana + IC95.

**Fuori campione**: gare di indice pari = calibrazione, dispari = verifica (stessa regola
dichiarata nelle sessioni precedenti). Un termine nuovo si giudica **solo** sulle gare di
verifica.

## 3. La barra del "netto oltre il rumore", derivata dai dati PRIMA di misurare

> Un passo base nuovo sopravvive solo se il **miglioramento della mediana per gara sulle
> gare di verifica** supera **M**, dove **M = la semi-ampiezza dell'IC95 bootstrap-a-blocchi
> della metrica vecchia sulle stesse gare di verifica**.

Cioè: il miglioramento deve essere più grande dell'incertezza della cosa che migliora.
Derivato dai dati, non scelto a occhio. In più, l'IC95 bootstrap del **miglioramento
appaiato** per gara deve **escludere lo zero**.

**Regola anti-pesca dichiarata**: provo **al massimo 3 termini** (H1, H2, H3). La barra si
applica a ciascuno **indipendentemente**, senza sconti. Qualunque termine che vinca
in-sample ma non regga out-of-sample è **dichiarato rumore**, non vittoria — e lo riporto
comunque, perché il conto dei tentativi è parte della prova.

## 4. Internet: suggerisce la caccia, il fondo decide la preda

Cercato prima di piantare. Trovato lo schema canonico *base + fuel + tyre + rumore*
(vedi REPORT: arXiv 2512.00640 stato-spazio per il degrado, arXiv 2607.06495 motore Monte
Carlo calibrato, arXiv 2512.21570 strategie apprese, e blog di settore). **Nessun numero
adottato**: quei lavori dicono *cosa provare*, e il pezzo che ho preso come suggerimento è
l'idea di stato-spazio con **livello latente che si resetta al pit** — che è esattamente
la mia H2. Vince solo se batte il reale sui nostri dati, fuori campione.

## 5. Targhetta obbligatoria

Ogni numero prodotto porta **quante gare aveva sotto e quando è stato calcolato**. Un
numero su 18 gare chiede di essere rifatto a 30. Non accumulo verità: produco la migliore
risposta corrente con la sua scadenza.

## 6. Vincoli

Solo il fondo · blocchi = gare · il permutation-null è **sotto sigillo**: se un'indagine
richiedesse di modificarlo, **mi fermo e lo dichiaro nell'output** · kernel di produzione
non montato: si misura su un aggancio e il golden resta verde · nessun push, PR, merge.
