# PREREG — il coefficiente-carburante è davvero PER-CIRCUITO, o lo sembra soltanto?

Scritto **prima** di guardare i numeri. Branch `ai-lab/scienziato-fuel-percircuito`,
21/07/2026. Prosecuzione di `PREREG_scienziato_fuel.md` (commit 7bad082), da cui eredita
il fondo ammesso, i filtri F1-F9 e lo stimatore per gara. **Nessun numero della sessione
precedente entra come dato**: il 69 % di varianza spiegata dal circuito viene ricostruito
qui dal fondo, non citato.

## 0. Il metro — dichiarato prima di tutto

> **Un per-circuito è VERO se è STABILE NEL TEMPO, non se spiega tanta varianza.**

Dare un parametro per pista alza la varianza spiegata **sempre**, per costruzione: più
manopole, più R². L'R² **non è prova di niente** e non verrà usato come criterio. Il
giudice è la **ripetibilità inter-annuale**: se una pista tiene lo stesso valore per tre
stagioni è fisica; se balla ogni anno è overfit.

Il numero che conta non è "quanti circuiti sono diversi dalla media" — è facile e quasi
garantito — ma **"quanti sono STABILMENTE diversi"**.

## 1. La cella

Una cella = un (circuito, anno) = una gara. Il valore della cella è Δ_cy, lo stimatore
per gara già dichiarato e già usato: OLS di `time` su effetti fissi di pilota, livelli di
compound, pendenza di degrado per compound e coefficiente sul giro-gara; Δ = −γ·(N−1);
SE cluster-robust per (pilota, stint), cioè **su blocchi indipendenti dentro la gara**.
Nessun cambiamento allo stimatore.

Anni 2023/2024/2025 = la prova. **Il 2026 entra come colonna informativa e NON come prova
di stabilità**: una gara per circuito, nessuna ripetizione intra-regime.

Normalizzazione dei nomi (dichiarata): `Australian`≡`Australia`, `Austrian`≡`Austria`,
`Canadian`≡`Canada`, `Chinese`≡`Cina`, `Japanese`≡`Giappone`, `Spanish`≡`Spagna`. Il
tracciato di Miami/Las Vegas/Qatar/Jeddah non cambia nel periodo; dove un tracciato
cambiasse davvero, la cella andrebbe separata — non è il caso qui.

## 2. Il limite ereditato, ripetuto: ogni cella è un TETTO

Δ = carburante **+ evoluzione pista + gestione**: la cronometria di gara non li separa
(stesso segno, entrambi lineari nel giro). Quindi la tabella per-circuito che esce è una
**tabella di tetti per-circuito**, non di effetti-carburante puri.

**Il confondimento è lo stesso ovunque?** Domanda dichiarata come parte dell'indagine, non
assunta. Diagnostico dichiarato (D1): rifitto ogni gara aggiungendo un termine **giro²**.
Il carburante è esattamente lineare nel giro; l'evoluzione pista **satura** (la gommatura
va veloce all'inizio e poi si appiattisce). Una curvatura grande = più contaminazione da
evoluzione dentro il termine lineare. Il coefficiente su giro², mediato sugli anni, è un
**indicatore per circuito** della contaminazione. È un diagnostico: **non modifica nessuna
stima**.

## 3. FASE 2 — i tre bucket. Criteri numerici, scritti prima

Per ogni circuito con ≥3 anni:

**Porta di potenza (INDECIDIBILE), valutata per prima.**
INDECIDIBILE se meno di 3 anni, **oppure** se la semi-ampiezza media dell'IC95 intra-anno
è ≥ 1,0 s. Motivo: su una grandezza di scala ~3 s, una cella con intervallo ±1 s o più non
può né confermare né smentire la stabilità; dichiararla "stabile" sarebbe barare con la
mancanza di potenza.

**Test di stabilità: Q di Cochran.**
w_y = 1/SE_cy², Δ̄_w = Σw·Δ / Σw, **Q = Σ w_y (Δ_cy − Δ̄_w)²**. Sotto l'ipotesi "stesso
valore vero ogni anno", Q ~ χ² con k−1 gradi di libertà.
- **STABILE**: Q ≤ χ²₀.₉₅(k−1) — la variazione anno-su-anno sta dentro l'incertezza intra-anno.
- **INSTABILE**: Q > χ²₀.₉₅(k−1).

Valori critici usati (tabella fissa, df 1-5): 3,841 · 5,991 · 7,815 · 9,488 · 11,070.

Si riporta anche **τ** (DerSimonian-Laird): τ² = max(0, (Q−df)/(Σw − Σw²/Σw)). τ è
l'oscillazione anno-su-anno **in secondi**, più leggibile di un p-value, e va letta
sempre accanto al bucket.

**Distorsione nota, dichiarata in anticipo.** La SE cluster-robust cattura il rumore di
campionamento fra piloti e stint, ma **non** gli shock comuni a tutta la gara (fase di
safety car, meteo che cambia dentro l'asciutto, gestione collettiva). Quindi SE_cy
**sottostima** l'incertezza vera della cella, Q rifiuta troppo, e il test è **sbilanciato
verso INSTABILE**. Conseguenza accettata: il bucket STABILE è **conservativo** — quello che
sopravvive è forte. Sensibilità dichiarata: si ripete tutto con SE gonfiate ×1,5 e ×2 e si
riporta come si spostano i bucket.

## 4. La prova decisiva: predizione fuori campione (S2)

Il test Q dipende dal modello di SE. La prova che **non** ne dipende è predittiva.

**Leave-one-year-out.** Per ogni cella (c, y) con il circuito osservato in ≥3 anni:
- previsione PER-CIRCUITO = media delle altre annate **dello stesso circuito**;
- previsione GLOBALE = mediana di tutte le altre gare **degli altri anni** (il numero
  unico, ricostruito senza mai vedere la cella da prevedere).
Metrica: **errore assoluto mediano** sulle celle tenute fuori. Se il per-circuito non
batte il globale, il per-circuito non porta informazione: è un miraggio.

**Null di permutazione sulla stessa metrica (S2b).** Si rimescolano le etichette di
circuito **dentro ogni anno** e si rifà identica la leave-one-year-out, 2000 volte. Se il
guadagno vero del per-circuito non esce dalla distribuzione delle etichette rimescolate,
la ripetibilità è un artefatto. p = frazione di permutazioni con guadagno ≥ osservato.

Questa coppia (S2 + S2b) è la **prova primaria**. Il Q-test è descrittivo e serve a dire
*quali* circuiti, non *se*. Dove i due disaccordano, si riportano entrambi.

## 5. FASE 3 — che cosa costa la costante (informazione, non azione)

Per i soli circuiti **STABILE**: media pesata inverso-varianza sugli anni, il suo IC95, e
lo scarto dal numero unico globale del kernel (Δ_kernel = 3,0·(N−1)/N ≈ 2,95 s) e dal
globale **ricostruito** (mediana cross-gara del regime). Si prepara la tabella su branch
con la sua incertezza. **Non si monta niente nel kernel.** La regola d'ingaggio
(90 %/70 %) la applicano gli umani leggendo la stabilità.

## 6. Colonna 2026 (S3, informativa)

Correlazione di rango di Spearman fra la media 2023-25 per circuito e il valore 2026 dello
stesso circuito. Se l'ordinamento sopravvive alla rottura regolamentare è un indizio forte
che si tratta di geometria della pista; se non sopravvive, non prova nulla in nessuna
direzione (regime diverso). Informativa, mai vincolante.

## 7. Regola sugli strumenti

Tutti gli strumenti statistici di questa sessione sono elencati qui sopra — Q di Cochran,
τ DerSimonian-Laird, porta di potenza, leave-one-year-out, permutazione delle etichette di
circuito, Spearman, diagnostico giro². **Se durante l'esecuzione servisse un attrezzo non
elencato, o la correzione di uno di questi, l'agente si FERMA e lo porta al tavolo: non lo
applica in corsa.**

## 8. Cosa non si fa

Non si monta niente. Kernel di produzione intatto. Nessun push, nessuna PR, nessun merge.
