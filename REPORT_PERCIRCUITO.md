# REPORT — il coefficiente-carburante è davvero PER-CIRCUITO, o lo sembra soltanto?

Branch `ai-lab/scienziato-fuel-percircuito` · 21/07/2026 · prereg (scritto prima dei numeri):
[`ai_lab/scienziato/PREREG_percircuito.md`](ai_lab/scienziato/PREREG_percircuito.md)
Generatore: `python3 ai_lab/scienziato/run_percircuito.py` →
`fuel_per_circuito_anno.csv`, `esito_percircuito.json`

Il 69 % della sessione precedente **non è stato ereditato**: la tabella è stata ricostruita
dal fondo qui, e messa alla prova con un metro diverso.

---

## (4) La frase onesta, prima di tutto il resto

> **Il per-circuito è una scoperta vera come FENOMENO, e un miraggio come TABELLA.**

Le due prove dicono cose diverse e nessuna delle due va nascosta:

- **Prova predittiva** (fuori campione, indipendente dal modello di errore): sapere su
  quale circuito si corre **migliora davvero** la previsione del coefficiente. Errore
  mediano 0,337 s contro 0,504 s del numero unico, in 25 celle su 39, con
  **p = 0,0025** contro le etichette di circuito rimescolate. Non è overfit: è segnale.
- **Prova di stabilità cella per cella** (il metro dichiarato): solo **4 circuiti su 13**
  passano. Nove ballano anno su anno oltre la loro incertezza intra-anno.

Tradotto: **esiste** una struttura per-circuito reale e ripetibile, ma **i singoli valori
non stanno abbastanza fermi** perché la maggior parte delle celle diventi un numero di
tabella. E dei 4 stabili, **uno solo** è anche nettamente diverso dal globale (Las Vegas).
Il conto che conta — "quanti sono STABILMENTE diversi" — fa **1**, non 13.

---

## (1) FASE 1 — la tabella circuito × anno

Ogni cella è una gara: stimatore invariato (OLS, effetti fissi di pilota, livelli di
compound, degrado per compound, coefficiente sul giro-gara), SE cluster-robust per
(pilota, stint) — blocchi indipendenti dentro la gara. **2026 = colonna informativa, mai
prova di stabilità** (una gara per circuito, nessuna ripetizione intra-regime).

**Ogni cella è un TETTO**, non un effetto-carburante puro: la cronometria di gara non
separa carburante ed evoluzione-pista (stesso segno, entrambi lineari nel giro).

| circuito | 2023 | 2024 | 2025 | 2026 *(info)* | curv. giro² |
|---|---|---|---|---|---|
| Abu Dhabi | +3,31 [3,15·3,47] | +3,20 [3,12·3,29] | +3,01 [2,86·3,16] | | +1,4e−4 |
| Australian | +3,46 [2,83·4,08] | +2,78 [2,52·3,04] | | +1,71 [1,21·2,21] | +2,7e−4 |
| **Austrian** | +2,20 [2,06·2,34] | +1,79 [1,64·1,94] | +2,06 [1,89·2,23] | +2,34 [2,08·2,59] | −0,1e−4 |
| Azerbaijan | +4,01 [3,52·4,49] | +3,66 [3,13·4,19] | +2,97 [2,67·3,26] | | +4,2e−4 |
| **Bahrain** | +3,85 [3,36·4,33] | +3,94 [3,71·4,16] | +4,52 [4,24·4,81] | | +4,8e−4 |
| Belgian | | +4,11 [3,75·4,46] | | +2,02 [1,03·3,02] | −1,7e−4 |
| British | +2,58 [2,27·2,89] | | | +3,01 [2,69·3,33] | +7,6e−4 |
| Canadian | +2,44 [2,25·2,64] | | +2,78 [2,50·3,06] | +2,05 [1,70·2,39] | +0,4e−4 |
| Chinese | | +4,27 [3,67·4,87] | +3,88 [3,48·4,28] | +3,42 [3,06·3,78] | +4,5e−4 |
| Dutch | | +2,68 [2,39·2,97] | +3,55 [3,35·3,75] | | −2,0e−4 |
| Emilia Romagna | | +2,00 [1,68·2,32] | +3,40 [3,00·3,79] | | −5,8e−4 |
| Hungarian | +3,05 [2,80·3,30] | +2,82 [2,59·3,05] | +2,60 [2,08·3,13] | | +1,9e−4 |
| Italian | +1,84 [1,66·2,02] | +3,18 [2,95·3,41] | +2,88 [2,75·3,01] | | +0,6e−4 |
| Japanese | +3,25 [2,95·3,56] | +4,79 [4,46·5,12] | +3,72 [3,62·3,81] | +4,39 [3,47·5,32] | −3,5e−4 |
| **Las Vegas** | +4,16 [3,41·4,92] | +4,10 [3,66·4,54] | +3,57 [3,23·3,92] | | −0,3e−4 |
| Mexico City | +2,74 [2,40·3,08] | +2,78 [2,56·3,00] | +2,92 [2,75·3,09] | | −0,9e−4 |
| Miami | +2,61 [2,40·2,83] | +3,29 [3,09·3,49] | | +0,00 [−1,30·1,31] | +2,1e−4 |
| Monaco | | +8,71 [8,34·9,08] | +2,35 [1,36·3,33] | +1,29 [−0,02·2,60] | −0,7e−4 |
| Qatar | +4,07 [3,71·4,42] | +3,63 [2,68·4,59] | +3,12 [2,54·3,70] | | +1,3e−3 |
| Saudi Arabian | +3,15 [1,95·4,35] | +5,08 [3,81·6,35] | +2,52 [2,10·2,95] | | +2,9e−4 |
| Singapore | +3,11 [2,38·3,83] | +2,54 [2,37·2,72] | +2,89 [2,15·3,62] | | +2,3e−4 |
| Spanish | +3,36 [3,15·3,57] | | +3,61 [3,14·4,07] | +3,91 [3,70·4,13] | −0,2e−4 |
| São Paulo | +2,96 [2,74·3,18] | | +2,11 [1,88·2,35] | | −1,6e−4 |
| United States | +3,32 [3,08·3,57] | +3,58 [3,26·3,90] | +2,72 [2,59·2,85] | | +0,3e−4 |

*(Monaco 2024 = +8,71 s: gara di pura gestione dopo la ripartenza da bandiera rossa. È il
promemoria vivente che la cella è un tetto, non una misura di carburante.)*

### Il confondimento è lo stesso per ogni circuito? **No — ma non spiega la tabella**

Diagnostico D1 dichiarato nel prereg: il carburante è *esattamente* lineare nel giro,
l'evoluzione-pista **satura**; quindi un termine giro² grande = più contaminazione da
evoluzione dentro il termine lineare. La curvatura **varia di un fattore ~3 fra circuiti**,
da −5,8e−4 (Imola) a +1,3e−3 (Qatar), e i valori più alti stanno dove ce li aspetteremmo
a occhio: Qatar, Bahrain, Cina, Baku, Jeddah — piste desertiche/cittadine, sporche e
verdi. **Il confondimento NON è uniforme: dichiarato.**

Ma — e questo conta — **la curvatura non ordina i Δ**: Spearman(curvatura, Δ medio) =
**+0,10** sui 24 circuiti. Las Vegas ha Δ alto e curvatura ~0; il Giappone ha Δ alto e
curvatura *negativa*. Quindi la spiegazione "i circuiti con Δ alto sono semplicemente
quelli che si gommano di più" **non regge** come spiegazione generale. Non è esclusa per
Bahrain e Qatar, dove alto Δ e alta curvatura coincidono.

---

## (2) FASE 2 — i tre bucket

**Criterio numerico, dichiarato prima**: porta di potenza per prima (INDECIDIBILE se < 3
anni o semi-ampiezza IC95 media ≥ 1,0 s); poi **Q di Cochran** con w = 1/SE², contro
χ²₀,₉₅(k−1) = 5,991 per k = 3. τ = oscillazione anno-su-anno in secondi (DerSimonian-Laird).

### STABILE — 4

| circuito | valori | Q vs 5,99 | τ | media pesata |
|---|---|---|---|---|
| Mexico City | 2,74 · 2,78 · 2,92 | 1,43 | 0,00 s | +2,849 [2,72·2,97] |
| Singapore | 3,11 · 2,54 · 2,89 | 2,83 | 0,18 s | +2,590 [2,43·2,75] |
| Hungarian | 3,05 · 2,82 · 2,60 | 2,98 | 0,11 s | +2,896 [2,73·3,06] |
| **Las Vegas** | 4,16 · 4,10 · 3,57 | 4,29 | 0,26 s | **+3,819 [3,56·4,07]** |

### INSTABILE — 9

| circuito | valori | Q | τ |
|---|---|---|---|
| Abu Dhabi | 3,31 · 3,20 · 3,01 | 7,59 | 0,11 s |
| Qatar | 4,07 · 3,63 · 3,12 | 7,67 | 0,50 s |
| Bahrain | 3,85 · 3,94 · 4,52 | 11,43 | 0,34 s |
| Saudi Arabian | 3,15 · 5,08 · 2,52 | 14,29 | 1,19 s |
| Azerbaijan | 4,01 · 3,66 · 2,97 | 14,73 | 0,55 s |
| Austrian | 2,20 · 1,79 · 2,06 | 15,55 | 0,20 s |
| United States | 3,33 · 3,58 · 2,72 | 35,37 | 0,47 s |
| Japanese | 3,26 · 4,79 · 3,72 | 49,39 | 0,59 s |
| Italian | 1,84 · 3,18 · 2,88 | 110,36 | 0,66 s |

### INDECIDIBILE — 11
Australian, Belgian, British, Canadian, Chinese, Dutch, Emilia Romagna, Miami, Monaco,
Spanish, São Paulo — **tutti per meno di 3 anni**, nessuno per intervallo troppo largo.
Il calendario, non la statistica, è il limite qui.

### Sensibilità dichiarata: i bucket dipendono molto dalla SE

Avevo dichiarato in anticipo che la SE cluster-robust ignora gli **shock comuni di gara**
(safety car, meteo dentro l'asciutto, gestione collettiva), quindi sottostima l'incertezza
della cella e sbilancia il test verso INSTABILE. Confermato:

| | STABILE | INSTABILE | INDECIDIBILE |
|---|---|---|---|
| SE ×1,0 | 4 | 9 | 11 |
| SE ×1,5 | 7 | 5 | 12 |
| SE ×2,0 | 6 | 3 | 15 |

**Non uso questa sensibilità per promuovere nessuno**: il criterio è quello dichiarato
(SE ×1,0). La riporto perché il tavolo deve sapere che il confine STABILE/INSTABILE qui è
fragile, e che è fragile **nella direzione che rende il verdetto più severo, non più
generoso**.

### Un'osservazione che NON è un test

Guardando la tabella: Austria sta a 2,20 · 1,79 · 2,06 — **tutte e tre le annate ~0,9 s
sotto il globale**, eppure è INSTABILE, perché le sue SE sono minuscole (0,07-0,09) e i
tre valori differiscono *fra loro*. Stesso schema per Bahrain (tutte e tre sopra) e
Japanese. Cioè: **INSTABILE non vuol dire "uguale al globale"** — vuol dire "non identico
a sé stesso". Un criterio del tipo "stabilmente dallo stesso lato del globale" sarebbe
diverso e forse più utile, ma **sarebbe uno strumento nuovo: non lo applico in corsa.**
Lo porto al tavolo come proposta per un prereg successivo.

---

## FASE 2b — la prova che non dipende dal modello di errore

Leave-one-year-out su 39 celle / 13 circuiti. Previsione per-circuito = media delle *altre*
annate dello stesso circuito (2 punti). Previsione globale = mediana di *tutte* le altre
gare degli altri anni (decine di punti). La cella tenuta fuori non è mai vista.

```
errore mediano PER-CIRCUITO : 0,337 s
errore mediano GLOBALE      : 0,504 s
guadagno                    : +0,167 s   (il per-circuito vince in 25/39 celle)
null con etichette di circuito rimescolate (2000 repliche):
    guadagno mediano -0,152 · q95 +0,035  ->  p = 0,0025
```

Il per-circuito batte il globale **pur avendo 2 soli punti contro decine**, e il guadagno
è fuori dalla distribuzione delle etichette rimescolate. Dove nasce il guadagno:

| circuito | vince | err. per-circuito | err. globale |
|---|---|---|---|
| Austrian | 3/3 | 0,224 | 1,135 |
| Bahrain | 3/3 | 0,421 | 0,951 |
| Las Vegas | 2/3 | 0,371 | 0,794 |
| Mexico City | 3/3 | 0,106 | 0,338 |
| Hungarian | 2/3 | 0,223 | 0,326 |
| … | | | |
| United States | 1/3 | 0,489 | 0,415 |
| Japanese | 2/3 | 0,872 | 0,770 |
| Italian | 2/3 | 0,791 | 0,604 |
| Saudi Arabian | 0/3 | 1,495 | 0,921 |

**Il paradosso da portare al tavolo**: i due circuiti dove il per-circuito guadagna di più
— Austria e Bahrain, 3/3 celle vinte, errore dimezzato o meglio — sono classificati
**INSTABILE**. Non è una contraddizione: sono circuiti *molto lontani* dal globale (quindi
il globale sbaglia sempre, e saperlo aiuta) ma *non costanti a sé stessi* (quindi Q li
respinge, tanto più che le loro SE sono piccole). Precisione alta ⇒ Q rifiuta più
facilmente. È esattamente la distorsione dichiarata nel prereg §3.

---

## (3) FASE 3 — quanto costa la costante, per i soli STABILE

Numero unico del kernel: 3,0·(N−1)/N ≈ **2,946 s**. Globale ricostruito dal fondo 2023-25:
**+3,151 s**.

| circuito | per-circuito verificato | vs kernel | vs globale ricostruito |
|---|---|---|---|
| **Las Vegas** | **+3,819 [3,56·4,07]** | **+0,873** | **+0,668** |
| Singapore | +2,590 [2,43·2,75] | −0,356 | −0,561 |
| Mexico City | +2,849 [2,72·2,97] | −0,097 | −0,302 |
| Hungarian | +2,896 [2,73·3,06] | −0,050 | −0,255 |

**Dove il globale sbaglia di più fra i verificati: Las Vegas, +0,87 s** — quasi un terzo in
più del numero unico, con un IC95 che non sfiora il kernel. È l'unico candidato forte:
STABILE *e* nettamente diverso. Singapore è stabile e diverso di −0,36 s, un candidato
secondario. Messico e Ungheria sono stabili ma **praticamente uguali al kernel**: non
cambierebbero nulla.

Fuori dai verificati — e quindi **non promuovibili**, ma da tenere d'occhio — gli scarti
più grossi dal globale sono Austria (−0,93 s) e Bahrain (+1,18 s): sono i due che pagherebbero
di più la costante, ed è dove il test predittivo guadagna di più. Sono INSTABILE: **non si
toccano.**

## S3 — la colonna 2026 (informativa, mai vincolante)

Spearman fra media 2023-25 e valore 2026 sui 10 circuiti in comune: **−0,055**.
L'ordinamento per-circuito **non sopravvive** alla rottura regolamentare. Due letture non
distinguibili con questi dati: (a) le celle 2026 sono singolarmente rumorose — Miami
[−1,30·1,31] e Monaco [−0,02·2,60] non portano informazione; (b) il 2026 ha davvero
riordinato le piste. Non decido: è la ragione per cui il 2026 era dichiarato informativo.
Chi volesse usare oggi una tabella per-circuito 2023-25 sul 2026 lo farebbe **senza alcun
sostegno da questi numeri**.

---

## Che cosa va al tavolo

1. **Il fenomeno per-circuito è reale** (predittivo, fuori campione, p = 0,0025). Non è
   l'R², è ripetibilità misurata su celle mai viste.
2. **La tabella per-circuito non è pronta**: 4 stabili su 13, e un solo circuito
   (Las Vegas) è stabile *e* nettamente diverso dal globale. Regola d'ingaggio agli umani.
3. **Il collo di bottiglia è il calendario, non il metodo**: 11 circuiti su 24 sono
   INDECIDIBILI solo perché hanno meno di 3 stagioni utili. Ogni stagione in più ne
   promuove qualcuno a giudicabile.
4. **Una proposta di strumento nuovo** — "stabilmente dallo stesso lato del globale" invece
   di "identico a sé stesso" — che **non ho applicato**, perché sarebbe la terza correzione
   statistica in corsa. Decide il tavolo se preregistrarla.

Kernel di produzione non toccato. Nessun numero montato. Nessun push, nessuna PR.
