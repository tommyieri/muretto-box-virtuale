# REPORT — il traffico, secondo ingresso: l'INTENSITÀ e la difficoltà-pista

Terzo giro dell'**agente autonomo a compito**. Branch `ai-lab/autonomo-traffico-pista` ·
21/07/2026 · prereg scritto prima di misurare:
[`ai_lab/scienziato/PREREG_traffico_pista.md`](ai_lab/scienziato/PREREG_traffico_pista.md)
Generatore: `run_pista.py` → `esito_pista.json`

**Targhetta: 46 gare, 22 piste, regime a effetto suolo, calcolato il 2026-07-21.**

---

## (6) La frase onesta, per prima

> **No: il traffico non è ancora utilizzabile live. Manca un pezzo, e non è quello che
> pensavamo.** La difficoltà-pista come moltiplicatore dell'intensità **non regge**: fallisce
> il placebo dichiarato, è **instabile fra stagioni** esattamente come l'indice v1 che il
> progetto aveva già bocciato, e fuori campione **peggiora** invece di migliorare. Tre
> verifiche indipendenti, tre bocciature concordi.
>
> Il pezzo che manca non è un terzo ingresso: è che **l'intensità per giro, misurata così,
> non ha una firma di pista che sopravviva al rumore**. La durata (delta-passo) resta l'unico
> canale del traffico che il fondo conferma.

---

## (0) Una correzione alla premessa, prima dei numeri

Il brief descrive `data/difficolta_sorpasso.csv` come «pre-validato». **Il repo dice il
contrario, per iscritto**, in `data/SORPASSO_NOTA.txt`:

> *«Il vecchio data/difficolta_sorpasso.csv (orfano, senza generatore) resta NON fidato e
> non è stato usato in alcun modo.»*

E il suo successore — l'indice v1, con generatore committato — ebbe **VERDETTO NO-GO**:
**G2 (stabilità cross-stagione) FAIL**, con inversioni radicali (Suzuka 86 % → 17 %, Miami
64/23/75, Baku 18 → 54), e G3 (ground truth) FAIL. La sua tabella è marcata *«RECORD DELLA
MISURA, non dato cablabile»*.

Ho quindi processato **due** imputati, non uno. E ho registrato **una distinzione che
cambia il senso del confronto**: l'indice v1 misura la *convertibilità dell'attacco*
— `P(sorpasso | attacco sostenuto)` — cioè il canale **durata**. Io stanotte misuro
l'**intensità**. Sono grandezze diverse; l'ho dichiarato nel prereg **prima** di guardare i
numeri, per non poterlo usare dopo come vittoria.

---

## (1) Il CSV messo alla prova, cella per cella

Spearman(`difficolta_0_1`, θ dal fondo) = **0,229** su 22 celle: quasi nessuna relazione.

| esito | quante | esempi |
|---|---|---|
| **CSV confermato** | 8 | Monaco (1,00 → θ 3,99) · Hungarian (0,74 → 2,85) · Qatar (0,62 → 2,60) · São Paulo (0,48 → −0,43) |
| **CSV corretto dal fondo** | 4 | **Austria** (CSV 0,65 "difficile" → θ **0,58**, fra le più facili) · **Monza** (0,59 → 0,61) · **Canada** (0,57 → **−0,33**) · **Austin** (0,34 "facile" → θ **2,12**, fra le più difficili) |
| **dato insufficiente** | 10 | IC95 di θ che attraversa la mediana |

Le quattro correzioni sono coerenti fra loro e col dominio: il CSV è costruito su
*sorpassi-per-giro*, che misura **quanto si sorpassa**, non **quanto costa restare
bloccati**. Austin ha molti sorpassi *e* code costose; l'Austria ne ha pochi ma si passa
subito. Sono due cose diverse, e il CSV le confonde.

**Ma nessuna di queste celle è promuovibile**, per il motivo del §2.

---

## (2) Come ho isolato la pista — e il placebo che la boccia

Modello dichiarato: `r = θ_pista · a·e^(−gap/λ) + b_pista + c·max(0,−Δ)`, con `a`, `λ`, `c`
globali dalla calibrazione. **`b_pista` è la difesa contro l'artefatto gemello** di quello
che mi ha salvato la notte scorsa: assorbe la distorsione del modello di passo su quella
pista, così **θ è identificato dalla FORMA (quanto il residuo sale mentre il gap si
stringe), non dal LIVELLO**.

θ va da **+5,08** (Suzuka) e **+3,99** (Monaco) a **−0,33** (Canada) e **−0,43** (Interlagos).
A occhio è una classifica che un uomo di corse firmerebbe.

**Il placebo dichiarato la boccia**:

```
sd dei theta fra piste, vera        : 1,2724
sd sotto etichette-pista permutate  : mediana 1,2483   q95 1,6897   (400 repliche)
                                    -> p = 0,459   ARTEFATTO, dentro il rumore
```

Raggruppare le gare **a caso** produce la stessa dispersione di raggrupparle per pista vera.

### Un difetto del mio stesso placebo — dichiarato, NON corretto

Guardando i numeri già calcolati (aritmetica descrittiva, **non un test nuovo**):

```
sd osservata dei theta          : 1,2724
sd implicata dalle SE di stima  : 0,4389
```

Le due letture sono **incompatibili**: se il rumore di stima valesse 0,44, una dispersione
di 1,27 sarebbe enorme — eppure la permutazione la riproduce. La ragione, credo, è che
**permutando le etichette si creano piste-fantoccio eterogenee** (mescolano Monaco e Monza),
il modello a un solo `b` non le descrive, il residuo si gonfia e con lui la varianza di `θ`:
**il null viene inflazionato proprio dall'effetto che deve testare.**

> **Non l'ho corretto.** È un null, e la regola è assoluta: **ci si ferma e si dichiara**.
> Lo porto al tavolo come difetto identificato del placebo-pista.
>
> **E non cambia il verdetto**: le altre due verifiche (§3 stabilità, §4 fuori campione)
> non dipendono dal placebo e bocciano comunque. Il difetto è una nota di metodo per il
> futuro, non un "forse avevo ragione".

> ⚠️ **NULL NUOVO da sigillare**: `pista.permuta_piste`. I sigilli sono sette; questo è
> l'ottavo e **non l'ho auto-sigillato** (serve `--attore`). Non ho toccato nessuna delle
> sette esistenti.

---

## (3) La trappola che uccise il v1: θ è instabile fra stagioni

Il v1 morì sulla stabilità. Avevo dichiarato nel prereg che avrei testato la stessa cosa,
per non ripetere l'errore. Su 16 piste con ≥2 stagioni stimabili:

| pista | θ per stagione | sd fra stagioni |
|---|---|---|
| **Monaco** | 2024: +0,02 · 2025: **+7,16** | **3,571** |
| **Japanese** | 2023: +0,97 · 2024: **+6,90** · 2025: +1,36 | **2,707** |
| Qatar | 2023: +1,70 · 2025: +4,95 | 1,629 |
| Hungarian | +1,76 · +2,59 · +3,78 | 0,827 |
| Mexico City | +0,63 · +0,71 · +0,50 | 0,087 |
| Azerbaijan | +1,55 · +1,57 | 0,009 |

**sd inter-stagione mediana 0,505 contro se intra-stagione mediana 0,330 → rapporto 1,53
⇒ INSTABILE.** Monaco passa da 0,02 a 7,16 fra due stagioni; il Giappone da 0,97 a 6,90 e
ritorno. **È lo stesso identico modo di morire dell'indice v1** (Suzuka 86 → 17, Miami
64/23/75) — su una grandezza *diversa*, con un metodo *diverso*. Due strade indipendenti
arrivano allo stesso muro: la firma di pista sul traffico, con questi dati, non sta ferma.

---

## (4) I modelli fuori campione — tutti rumore

23 gare di calibrazione, 23 di verifica. Errore assoluto mediano per gara:

| modello | errore | IC95 |
|---|---|---|
| **M0 solo gap** | **0,3579 s** | [0,3463 · 0,4086] |
| M1 + delta-passo | 0,4158 s | [0,3462 · 0,4337] |
| Mp + pista | 0,3875 s | [0,3463 · 0,4097] |
| Mfull pista + delta | 0,3853 s | [0,3462 · 0,4592] |

Contro **M0** (M dichiarato 0,0312 s): Mp **−0,0297** e Mfull **−0,0274** — entrambi
*peggiorano*, nessuno supera M, appaiati che contengono lo zero ⇒ **RUMORE**.
Contro **M1** (M dichiarato 0,0438 s): Mp +0,0283 e Mfull +0,0306 — recuperano il terreno
perso da M1 ma non superano M ⇒ **RUMORE**.

**Il modello attuale a solo-gap resta imbattuto.** Due notti, quattro forme nuove
dichiarate, quattro bocciate.

---

## (5) Il 2026 — nessun trapianto, e il cieco confermato

Non ho trapiantato niente. Stimato dal poco 2026 disponibile (10 gare, 9 piste con θ):

```
globali 2026 : a=0,920  lam=0,5  c=0,435
globali storico: a=0,507  lam=0,8  c=0,540
```

La penalità aerodinamica del 2026 è **più intensa ma più corta** (a più alto, λ più basso):
morde di più a ruota e svanisce prima. Coerente con l'Overtake Mode a batteria, spendibile
ovunque invece che in zone fisse — ma su 10 gare è un indizio, non una misura.

**Spearman(θ storico, θ 2026) su 8 piste = −0,024.** L'ordinamento storico **non arriva** al
2026: Suzuka passa da +5,08 a +0,065, Monaco da +3,99 a +6,51. È esattamente ciò che il
briefing di regime prevedeva — e ora è **misurato**, non assunto.

> **Il 2026 sul sorpasso resta cieco**, e non per povertà di dati soltanto: anche col
> triplo delle gare, un θ instabile nel regime vecchio non diventerebbe stabile nel nuovo.

---

## Internet — suggerimento e conferma, mai numeri

Il 2026 sostituisce il DRS con **Overtake Mode / Manual Override**: potenza extra entro 1 s
dall'auto davanti, **spendibile ovunque** e non legata a zone, con simulazioni FIA che la
danno efficace ma «hard-earned», senza la facilità *drive-by* del DRS
([RACER](https://racer.com/2025/12/17/drs-out-overtake-and-boost-in-the-new-terminology-for-f1-s-2026-cars),
[ESPN](https://www.espn.com/f1/story/_/id/47333501/formula-1-f1-new-terminology-explained-overtake-mode-boost-drs-how-affects-2026-racing-drivers-regulations-rules),
[corp.formula1.com](https://corp.formula1.com/f1-2026-regulations-terminology-update/)).

**Come l'ho usato**: come conferma che gli indici pubblici di difficoltà-sorpasso sono
**tutti DRS-era** e non valgono per il 2026 — il che rende la mia misura Spearman −0,024 un
risultato atteso, non un'anomalia. Sul lato descrittivo, Monaco «impossibile da sorpassare»
([Kym Illman](https://www.kymillman.com/blog/why-overtaking-is-nearly-impossible-at-the-monaco-grand-prix/))
è coerente col θ di Monaco più alto in entrambi i regimi. **Nessun numero adottato.**

---

## I NULL motivati

| cosa | esito | perché |
|---|---|---|
| difficoltà-pista come moltiplicatore dell'intensità | **ARTEFATTO** (test dichiarato) | dispersione dentro il null per permutazione, p = 0,459 |
| la stessa, letta come stabilità | **INSTABILE** | sd inter-stagione 1,53× l'errore intra; Monaco 0,02→7,16 |
| Mp (pista) e Mfull (pista+delta) | **RUMORE** | peggiorano M0 fuori campione, appaiati con lo zero dentro |
| il CSV orfano come base | **inutilizzabile** | Spearman 0,229; e comunque poggia su un θ instabile |
| transfer storico → 2026 | **non fatto, e ora misurato come inutile** | Spearman −0,024 |

## Il limite onesto, riscritto

**Il traffico si calcola solo contro il campo reale, non contro un campo che reagisce.** Le
altre auto non rallentano perché sei lì, non si difendono, non cambiano strategia, non
rifanno la loro sosta. Il modello dice *«Leclerc diverso dentro la gara che È successa»*,
non *«la gara che SAREBBE successa»*. Ogni numero di traffico va letto dentro questo
confine — e questo vale anche per i θ che ho misurato e bocciato stanotte.

## Due ingressi, il primo non toccato

Il delta-passo è rimasto com'era. L'aggancio della pista non l'ha rotto (M1 e Mfull hanno lo
stesso `c` globale). **Non ho aggiunto nessun terzo pezzo** per far tornare i conti.

## Stato del kernel

Non toccato. `test_b` 449/449 · `test_pit` 11/11 · `test_degrado_aggancio` 3/3 · sigillo del
null **INTEGRO** · sorveglianza 3/3. Nessun push, nessuna PR, nessun merge.
