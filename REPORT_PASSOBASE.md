# REPORT — la caccia agli ±11,7 s del passo base

Primo giro dell'**agente autonomo a compito**. Branch `ai-lab/autonomo-passobase` ·
21/07/2026 · prereg scritto prima di testare le ipotesi:
[`ai_lab/scienziato/PREREG_passobase.md`](ai_lab/scienziato/PREREG_passobase.md)
Generatore: `run_passobase.py` → `esito_passobase.json`

**Targhetta di tutta la sessione: 18 gare pulite del regime a effetto suolo, calcolato il
2026-07-21.** Ogni numero qui sotto vale su quelle 18 gare e chiede di essere rifatto
quando diventano 30.

---

## (6) La frase onesta, per prima

> **Gli ±11,7 s non vengono dal passo base. Vengono dai giri in traffico.** Non ho una
> proposta di passo base migliore da portare, e non perché non ci abbia provato: ho piantato
> tre ipotesi sul livello e sono morte tutte e tre, una delle quali con un rimedio montato e
> misurato fuori campione.

Il passo base, sui giri dove è stimato, ricostruisce una gara intera con un errore mediano
assoluto di **0,09 s**. Il traffico, sugli stessi casi, ne mette **+8,17 s di mediana** con
una dispersione di ~22 s. Il pavimento non è storto: è che sopra ci passano macchine che il
modello non vede.

---

## (1) Le ipotesi che ho piantato, in ordine, e perché

Prima di piantare, ho **decomposto** l'errore per categoria di giro — descrittivo, non un
test — su 18 gare pulite e ~180 casi (pilota-gara):

| categoria | mediana | p16 · p84 | \|mediana\| | giri mediani |
|---|---|---|---|---|
| **aria libera (gap > 5 s)** | **0,00 s** | −0,22 · +0,50 | **0,09** | 18 |
| **traffico (gap < 5 s)** | **+8,17 s** | −0,03 · +21,72 | **9,56** | 36 |
| in/out-lap (pit-loss già tolto) | −0,10 s | −1,26 · +2,02 | 1,01 | 2 |
| non-verde | +0,28 s | −0,26 · +1,13 | 0,37 | 1 |

**Il caveat che rende questa tabella insufficiente**, e che ho scritto nel prereg prima di
usarla: il residuo in aria libera è ~0 **per costruzione** — α è stimato proprio lì, e i
residui OLS dentro le dummy di pilota sommano a zero. Quello 0,00 non prova niente. Da qui
le tre ipotesi, tutte costruite per cercare un difetto di livello **fuori** dai giri che lo
hanno stimato.

**H1 — il livello non è costante dentro la gara.** Prima perché è l'unica che spiegherebbe
un errore che *si accumula*: un livello sbagliato di un decimo costa 5 s su 50 giri, mentre
il rumore giro-per-giro si cancella. *Test*: α dalla prima metà dei giri liberi, misurato
sulla seconda. **VIVA**: |mediana| dello scarto **0,182 s/giro**, p16·p84 = −0,366 · +0,179
su 86 piloti-gara — più larga del rumore di campionamento delle due mediane.

**H2 — il livello è per-STINT, non per-gara.** Ogni set di gomme è un oggetto diverso.
*Test*: pari/dispari dentro lo stint per separare il rumore, poi dispersione fra stint dello
stesso pilota. **MORTA**: sd fra-stint **0,163** contro sd dentro-stint **0,195** — rapporto
**0,84**. I set di gomme non differiscono oltre il rumore.

**H3 — α su pochi giri liberi è rumoroso.** *Test*: |livello| per fasce di numero di giri
liberi. **MORTA**: bande piatte (0,063 · 0,071 · 0,061 · 0,062 s/giro da <10 a >40 giri),
correlazione −0,127 su 286 piloti-gara. Chi ha 5 giri liberi non ha un livello peggiore di
chi ne ha 50.

---

## (2) Internet — cosa ho trovato e come l'ho trattato

Cercato **prima** di piantare le ipotesi. Lo schema canonico in letteratura è esattamente il
nostro: *tempo sul giro = passo base + correzione carburante + correzione gomma + rumore*,
col passo base definito come il tempo teorico a serbatoio minimo su gomma nuova.

Il pezzo che ho **usato come suggerimento** è l'impostazione **stato-spazio** di
[arXiv 2512.00640](https://arxiv.org/abs/2512.00640) — *A State-Space Approach to Modeling
Tire Degradation in Formula 1 Racing* — dove il passo è un **livello latente che si resetta
al pit stop**. Quel "si resetta al pit" è precisamente la mia **H2**: se il livello è uno
stato che riparte a ogni sosta, allora deve variare fra stint più di quanto vari dentro uno
stint. **L'ho verificata sul nostro fondo e sui nostri dati non regge** (rapporto 0,84).
Nessun numero adottato da nessuna fonte.

Altre fonti consultate, non usate per numeri:
[arXiv 2607.06495](https://arxiv.org/pdf/2607.06495) (motore Monte Carlo calibrato per
briefing di strategia), [arXiv 2512.21570](https://arxiv.org/pdf/2512.21570) (strategie
apprese), [keberz.com](https://www.keberz.com/post/race-strategies-in-formula-1)
(ottimizzazione pre-gara), [Python in Plain English](https://python.plainenglish.io/python-for-formula-1-a-step-by-step-tire-degradation-analysis-aaf1174039a4)
(regressione lineare tempo-vs-vita gomma). Tutte confermano la *forma* che già usiamo; il
"cliff" per-circuito e per-mescola oltre un'età-nodo è il suggerimento che resta sul tavolo
per una prossima caccia.

---

## (3) Il termine proposto — montato, misurato, **dichiarato rumore**

H1 era l'unica viva, quindi ho montato il suo rimedio naturale: **una deriva del livello per
PILOTA** (β_pilota nel giro-gara, al posto del β comune). Nota tecnica: con β per pilota il
β comune diventa **ridondante** — la sua colonna è la somma esatta di quelle per pilota — e
va spento, altrimenti il rango cade.

**Barra dichiarata prima di misurare**: il miglioramento della mediana per gara sulle gare
di verifica deve superare **M** = semi-ampiezza dell'IC95 bootstrap-a-blocchi della metrica
vecchia sulle stesse gare (`scheletro.bootstrap_a_blocchi`, funzione **sigillata, chiamata e
non modificata**), **e** l'IC95 del miglioramento appaiato deve escludere lo zero.

| | vecchio | NUOVO (β per pilota) | M dichiarato | esito |
|---|---|---|---|---|
| **calibrazione** (4 gare) | p68 **10,14 s** · mediana/gara 7,41 | p68 **20,24 s** · mediana/gara 11,62 | 1,99 | **peggiora** |
| **verifica, fuori campione** (3 gare) | p68 26,12 s · mediana/gara 16,83 | p68 24,72 s · mediana/gara 11,08 | 10,96 | miglioramento +5,75 → **non supera M** |

Miglioramento appaiato per gara in verifica: **−0,199 s, IC95 [−3,384 · +1,192] → contiene
lo zero.**

E il colpo definitivo, che non è nemmeno statistico: **il termine è stimabile solo su 7 gare
su 18.** I giri in aria libera sono pochi (mediana 18 per pilota-gara) e una pendenza per
pilota li mangia tutti: su 11 gare su 18 la design matrix perde il rango. Un termine che non
si può stimare su tre gare su cinque non è un candidato, qualunque cosa dica il resto.

> **Verdetto: RUMORE, non vittoria.** Dichiarato tale come previsto dal prereg.

E una nota di onestà sulla potenza: il confronto fuori campione poggia su **3 gare**. Anche
se il segno fosse stato favorevole, con 3 blocchi non avrei potuto chiamarlo un risultato.

---

## (4) I NULL motivati — cosa non ha funzionato e perché

| ipotesi | esito | perché |
|---|---|---|
| **H2** livello per-stint (suggerita dallo stato-spazio in letteratura) | **MORTA** | dispersione fra stint (0,163) **minore** del rumore dentro lo stint (0,195): non c'è niente da modellare |
| **H3** α rumoroso con pochi giri liberi | **MORTA** | il livello è piatto su tutte le fasce (0,061–0,071 s/giro): il numero di giri liberi non è il problema |
| **H1** deriva del livello | **viva in diagnosi, morta come rimedio** | lo scarto fra metà gara è reale, ma non è una **struttura predicibile**: il rimedio peggiora in calibrazione, non supera M in verifica, e non è stimabile su 11 gare su 18 |

Tre tentativi, tre morti. È il conto che rende credibile il quarto risultato: **non ho pescato
finché qualcosa vinceva.** La regola anti-pesca dichiarata era «al massimo 3 termini, barra
piena per ciascuno, e ogni vincitore in-sample che non regge fuori è rumore». L'ho rispettata,
e il conto dei tentativi è parte della prova.

---

## (5) Targhette e stato del golden

Ogni numero di questa sessione: **18 gare sotto** (regime a effetto suolo, gare pulite senza
SC/VSC), **calcolato il 2026-07-21**. Il confronto del rimedio: **7 gare** (4 calibrazione,
3 verifica) — targhetta che da sola dice quanto è riapribile.

**Il passo base non è stato toccato in produzione.** Ho aggiunto un'opzione `beta_per_pilota`
al modello di laboratorio (`degrado.py`), spenta di default. Il kernel:

```
node test_b.mjs               => PASS 449/449 sotto 1e-9
node demo/test_pit.mjs        => PASS 11/11
node test_degrado_aggancio.mjs => PASS 3/3 (spento bit-identico)
sigillo del null              => INTEGRO
test_sorveglianza             => 3/3
```

Il permutation-null **non è stato toccato**: nessuna indagine di stanotte lo ha richiesto, e
non ho scritto null nuovi (per la barra ho usato `bootstrap_a_blocchi` sigillata,
invariata).

---

## Che cosa serve adesso

Il prossimo pavimento non è il passo base: **è il traffico**. E la materia prima è già
misurata, dal fondo, in questa e nella sessione precedente:

```
gap 0,0-0,5 s  ->  +0,58 s/giro        36 giri per gara sotto i 5 s di gap
gap 0,5-1,0 s  ->  +0,27 s/giro        +8,17 s di mediana per caso
gap 1,0-1,5 s  ->  +0,14 s/giro        dispersione ~22 s
gap 1,5-2,0 s  ->  +0,08 s/giro
```

Una curva monotona, con blocchi indipendenti sotto, pronta per diventare l'ipotesi della
prossima notte. Tre cose che servono e che stanotte non avevo:

1. **più gare pulite**: 18 sono poche, e la verifica ne ha viste 3. Il filtro
   no-neutralizzazione è brutale (39 gare su 70 hanno SC/VSC, e il 2026 è cieco: 10 su 10).
   Serve una decisione del tavolo su come trattare le gare con safety car.
2. **una definizione di traffico che regga fuori campione**, non solo la curva descrittiva.
3. **il 2026**, che a questo metro oggi non esiste.

Nessun push, nessuna PR, nessun merge. Kernel di produzione intatto.
