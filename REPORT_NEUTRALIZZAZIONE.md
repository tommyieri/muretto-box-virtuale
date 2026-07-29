# REPORT — Neutralizzazione: verità (sessione N)

Branch `neutralizzazione-verita`. PROPOSTA, non produzione. Metodo pre-registrato in
[`PREREG_SESSIONE_N.md`](PREREG_SESSIONE_N.md), committato PRIMA dei numeri (commit `1583d27`).
Nessun file di produzione toccato. Nessun modello. **Nessuna proposta prodotta** (vedi N4).

---

## Verdetto in cima (le righe obbligatorie)

- **N1 vocabolario status: 39 codici distinti, tutti decodificati? → SÌ.**
  (36 dei 39 contengono almeno un digit non committato `2`/`7`: decodificati per ipotesi FIA
  esplicita, non spacciata per verità committata. I 3 digit committati `4/5/6` + il baseline `1`
  coprono la semantica di neutralizzazione.)
- **N4 R_lap SC_REGIME: [1,108 – 1,58] per-circuito, pooled 1,614 → FONTE ANCORA ROTTA.**
  (conjunction SC∈[1,30-1,80] E VSC∈[1,20-1,50] soddisfatta su **5/9** circuiti; **4/9 fuori** ⇒
  soglia pre-registrata "≥4 fuori = ANCORA ROTTA".)
- **N4 confronto: classificazione vecchia = 1,11 (atteso ~1,12) ✓ | nuova SC_REGIME = 1,614,
  nuova VSC_REGIME = 1,055.**
  La riclassificazione **risana SC** (1,11 conflato → 1,614 fisico) ma **non risana VSC**
  (resta 1,055, non fisico). Per SC la classificazione ERA il problema; per VSC no: il segnale VSC
  stesso è inaffidabile.
- **Golden pit 11/11: prima = 11/11 (verificato, `node demo/test_pit.mjs`). Dopo (N2 come drop-in):
  0/11 casi cambiano ⇒ resterebbe 11/11.** Nessuna migrazione proposta (verdetto ANCORA ROTTA).

---

## N0 — Inventario delle fonti

| Fonte | Cos'è | Regola / soglia | Generatore committato | Chi la consuma | Verdetto |
|---|---|---|---|---|---|
| `demo/neutralizzazione.json` | finestre per-gara `{sc,vsc,rf,durata}` | giro L neutro se **≥2 auto** con `'4'`(SC)/`'6'`(VSC); finestra = run massimale; rf idem con `'5'` | `gen_neutralizzazione.py` ✓ | `demo/pitscenario.mjs` (soppressione gap C1), `pipeline_gara.py`, `pipeline_smoke_pit.mjs`, `gen_golden_pit.mjs` | fonte viva |
| flag `neutralized` per-auto | booleano per-auto-per-giro | `_neut(s) = ('4' in s) or ('6' in s)` — **nessuna soglia** | `engine/engine.py::_neut` + `export_demo.py` ✓ | `demo/pitscenario.mjs` (`giroNeutralizzato`), `engine.pace_base` (esclude i giri neutri dal passo-base), `conta_undercut.py`, `gen_difficolta_sorpasso.py` | fonte viva |
| campo `status` grezzo TracingInsights | stringa per-auto-per-giro, concatenazione stati within-lap | vocabolario in N1 | è il RAW (ti_archive/ti_cache) ✓ | tutto quanto sopra deriva da qui | fonte primaria |
| `data/neutralization_model_2026.csv` | vecchio modello finestre (7 gare) | ignota, non dichiarata | **nessuno** | **nessuno** (solo citato in `NEUTRALIZZAZIONE_NOTA.txt` come storia superata) | **ORFANO** |
| `data/sc_safety_car.csv` | prior aggregato per circuito (p_SC, p_VSC, periodi_medi, pit_ratio_sc) | ignota | **nessuno** | **nessuno** nel repo | **ORFANO** |

Il **modulo pit** (`demo/pitscenario.mjs`) usa **entrambe** le fonti vive in OR:
`sotto_neutralizzazione = finestra_json_attiva || flag_per_auto_del_pilota`. Coerente con la
distinzione a due livelli di N2 (una copre l'evento di gara, l'altra l'impatto sul singolo).

I due CSV sono **orfani dichiarati**: nessun generatore, nessun consumatore. Debito, non fonte
(coerente con [[fonte-orfana-e-copertura-circolare]]).

## N1 — Vocabolario degli status (DELIVERABLE PRINCIPALE)

`data/status_vocabolario.csv` — **39 codici distinti** su 88.150 righe (ti_archive 2023-25 + formato
2026). Alfabeto atomico osservato = **{1,2,4,5,6,7}**: il `3` dello standard FIA TrackStatus è
assente, coerente con quello standard.

Decodifica atomica:

| digit | significato | stato committato | evidenza |
|---|---|---|---|
| `1` | VERDE (baseline) | convenzionale (implicito nel metodo v1) | 79.373 righe, dominante |
| `2` | GIALLO (bandiera settore) | **ipotesi FIA, non committata** | standard FIA; mai neutralizzazione formale |
| `4` | SC | **committato** (`gen_neutralizzazione.py`, NOTA) | deploy(…→4)=882 ≈ restart(4→…1)=861, simmetrico |
| `5` | RED (bandiera rossa) | **committato** (NOTA) | mai standalone (sempre concatenato), 184 righe |
| `6` | VSC deployed | **committato** | 1.599 righe |
| `7` | VSC ending | **ipotesi FIA, non committata** | co-occorre con `6` nel 90% dei casi (696/770) |

Un codice composto è la **sequenza ordinata degli stati within-lap** attraversati dall'auto in quel
giro. Esempi decodificati (tutti nel CSV):
- `'14'` = VERDE→SC = **deployment** (giro iniziato in verde, finito sotto SC)
- `'41'` = SC→VERDE = **restart**
- `'671'` = VSC→VSC_END→VERDE = VSC completa risolta entro il giro
- `'12'` = VERDE→GIALLO = bandiera gialla di settore, **nessuna** neutralizzazione formale
- `'45'`,`'451'`,`'1254'` = contengono `5` = bandiera rossa nel giro (laptime non valido)
- `'64'`,`'1264'`,`'16724'` = SC e VSC nello stesso giro = **MISTO non classificabile**

Nessun codice resta senza riga. Questo vocabolario **non era scritto da nessuna parte prima**.

## N2 — Classificazione a due livelli

Generatore committato: `gen_neutralizzazione_v2.py`. Output `data/neutralizzazione_due_livelli.csv`
(finestre evento per circuito/stagione).

- **(A) EVENTO per-gara**: regime per giro-di-gara, con DEPLOY/RESTART separati dal REGIME.
  Regimi: `VERDE / SC_DEPLOY / SC_REGIME / SC_RESTART / VSC_DEPLOY / VSC_REGIME / VSC_RESTART /
  RED / MISTO_NON_CLASSIFICABILE`. Soglia ≥2 auto, identica al json (confrontabilità).
- **(B) IMPATTO per-auto-per-giro**: regime del singolo dal suo status atomico, deploy/restart dal
  suo run individuale.

**Matrice di contingenza (A)×(B)** — base regime, per-auto-per-giro, 9 circuiti tutte le stagioni
(39.448 concordi, **691 discordi = 1,7%**):

```
   A\B    MISTO    RED     SC   VERDE    VSC
 MISTO       37      0      0       0      0
   RED        0    105     29       4      0
    SC        0      0   2196     131      0     <- 131 auto in VERDE mentre la gara è in SC
 VERDE        0      0      2   36059     14
   VSC        2      0      0     509   1051     <- 509 auto in VERDE mentre la gara è in VSC
```

La divergenza è **reale e sistematica**: 640 giri-auto (131 SC + 509 VSC) in cui la gara è
neutralizzata (livello A) ma la singola auto sta correndo verde (livello B) — ha già superato il
punto dell'incidente o non l'ha ancora raggiunto. È la ragione per cui il modulo pit legge
**entrambe** le fonti: nessuna delle due, da sola, è "la verità".

## N3 — Riconciliazione json vs flag (uno per uno)

Sulle 9 gare demo, a granularità **race-lap** (l'unità della riconciliazione): **10 giri-di-gara
discordanti** su 82 giri neutralizzati (**12,2%**), tutti dello stesso tipo:

| gara | giro | n_auto_flag | codici | json | flag | chi ha ragione (N2) |
|---|---|---|---|---|---|---|
| Australia | 16 | 1 | `126` | no | sì | **json**: auto isolata tra finestre reali (11-14, 18-20, 32-34) |
| Australia | 17 | 1 | `126` | no | sì | **json**: idem, artefatto mono-auto |
| Australia | 22 | 1 | `167` | no | sì | **json**: isolata, nessun corroborante |
| Canada | 28 | 1 | `126` | no | sì | **json**: coda adiacente alla finestra 29-32 |
| Spagna | 35 | 1 | `1267` | no | sì | **json**: artefatto citato testualmente nella NOTA |
| Spagna | 38 | 1 | `126` | no | sì | **json**: mono-auto |
| Spagna | 51 | 1 | `126` | no | sì | **json**: micro-sequenza di 1 sola auto (51-53)… |
| Spagna | 52 | 1 | `6` | no | sì | **json**: …VSC coerente ma non corroborata da altre auto |
| Spagna | 53 | 1 | `671` | no | sì | **json**: …→ artefatto del transponder di ALB, non evento di gara |
| Austria | 50 | 1 | `167` | no | sì | **json**: isolata, adiacente alla finestra 51-53 |

**Zero** casi del tipo opposto (json=sì ma 0 auto flaggate): la finestra json non si estende MAI
oltre un giro realmente neutro. Tutte e 10 le discordanze sono **una singola auto sotto soglia**.

**Conclusione sulla soglia `≥2 auto`: è GIUSTA a livello evento.** Ogni discordanza è un flag
mono-auto isolato o adiacente a una finestra reale — un artefatto di timing per-auto, non una
neutralizzazione di gara che la soglia avrebbe perso. Il flag per-auto **senza soglia** inietterebbe
10 falsi positivi di gara (Spagna 35/51-53 sono i casi-scuola della NOTA). *Ma* il flag per-auto
resta corretto **al proprio livello** (impatto sul singolo pit, N2-B): non sono fonti in
competizione, sono i due livelli di N2. La discordanza vista qui (tutta "flag=sì, json=no") è il
volto FALSO-POSITIVO del flag, complementare ai 509+131 falsi-negativi di N2 (auto verde in gara
neutra). Entrambe le fonti sbagliano ai bordi; serve il vocabolario per pulirle.

> Nota onestà: il mandato citava "13 giri (2,3%)". La mia riconciliazione, sulle 9 gare del registro
> attuale e sul json committato corrente, trova **10 giri-di-gara (12,2% dei neutri)**. La cifra 13/2,3%
> proveniva da un set di gare / json precedente e non è stata riprodotta: riporto il numero misurato,
> non quello atteso.
> [risolto 15/07/2026: la fonte del 13/559 e' PITLOSS_NOTA_DI_CHIUSURA_ARCO_AI_ORIGINALE.md, sez. A2 - documento ritrovato e committato]

## N4 — Test di validazione fisica (il giudice)

`data/rlap_per_regime.csv`. `R_lap[regime] = mediana(laptime regime)/mediana(laptime VERDE)`, per
circuito, pooled su tutte le stagioni; esclusi deploy/restart e RED; esclusi in/out lap e nulli.

| circuito | VERDE n | SC_REGIME (n) | VSC_REGIME (n) | conjunction |
|---|---|---|---|---|
| melbourne | 2954 | **1,58** (167) | **1,257** (76) | ✓ dentro |
| shanghai | 2626 | **1,434** (135) | **1,355** (15) | ✓ dentro |
| suzuka | 3444 | 1,542 (111) | — (0) | ✗ VSC assente |
| miami | 3750 | **1,455** (132) | **1,29** (27) | ✓ dentro |
| montreal | 4302 | 1,474 (146) | **1,043** (107) | ✗ VSC implausibile |
| monaco | 5067 | **1,108** (86) | 1,383 (36) | ✗ SC troppo basso |
| catalunya | 4441 | 1,466 (61) | **1,196** (85) | ✗ VSC 0,004 sotto soglia |
| spielberg | 4580 | **1,533** (16) | **1,221** (55) | ✓ dentro |
| silverstone | 2973 | **1,529** (227) | **1,285** (102) | ✓ dentro |

**Conjunction SC∈[1,30-1,80] E VSC∈[1,20-1,50]: 5/9 circuiti. → 4/9 FUORI.**

Soglia pre-registrata: ≥6/9 = SANA; ≥4 fuori = ANCORA ROTTA; 3 fuori = AMBIGUO.
**4 circuiti fuori ⇒ FONTE ANCORA ROTTA.**

Diagnosi onesta dei 4 fuori (non modifica il verdetto pre-registrato, lo spiega):
- **SC è quasi sano ovunque**: 8/9 circuiti hanno SC_REGIME ∈ range (solo monaco 1,108 fuori —
  green Monaco già lentissimo, il delta SC si comprime).
- **Il problema è VSC**: suzuka **non ha neppure giri VSC_REGIME** (n=0, buco dati); montreal
  VSC=**1,043** (fisicamente impossibile: VSC ~4% più lento del verde); catalunya 1,196 (a un
  soffio). VSC è il regime rotto.

**Confronto obbligatorio (stessi demo 2026, unica variabile = classificazione):**

| classificazione | R_lap | interpretazione |
|---|---|---|
| **VECCHIA** (json puro, SC+VSC insieme, no split deploy/restart) | **1,111** | ≈ 1,12 atteso ✓ riprodotto |
| NUOVA SC_REGIME | **1,614** | portato **nel range fisico** |
| NUOVA VSC_REGIME | **1,055** | **resta fuori**, non fisico |
| NUOVA VSC_DEPLOY / VSC_RESTART | 0,987 / 0,995 | ≈ verde: i giri VSC 2026 non rallentano |

**Cosa era rotto:** per SC, era la classificazione (conflare deploy+restart+auto-verdi col regime
schiacciava 1,614 → 1,11). Separandoli, SC diventa fisico. **Per VSC la classificazione NON era il
problema:** anche isolando il solo regime, VSC 2026 resta ~1,05. Il segnale `'6'` nel formato 2026
marca giri che **non rallentano come una VSC vera** — è qui il debito residuo, e va detto senza
attenuazioni.

## N5 — Impatto sul sistema (mappatura, nessuna modifica)

Consumatori (N0): `pitscenario.mjs` (soppressione gap C1), `modello_undercut.mjs` (fuori dominio),
`engine.pace_base` (esclude giri neutri), `conta_undercut.py`, `gen_difficolta_sorpasso.py`.

**Golden pit 11/11 — prima e dopo.** Regime N2 al giro del pit di ogni caso golden:

| caso | pit | json_win | v1 sotto | A evento@pit | B impatto@pit | cambia? |
|---|---|---|---|---|---|---|
| Monaco:LEC:pit60 | 60 | sì | sì | SC_REGIME | SC_DEPLOY | no |
| Monaco:SAI:pit62 | 62 | sì | sì | SC_REGIME | SC_REGIME | no |
| Monaco:HAM:pit55 | 55 | no | no | VERDE | VERDE | no |
| Austria:VER:pit25 | 25 | sì | sì | VSC_REGIME | VSC_DEPLOY | no |
| Austria:VER:pit34 | 34 | no | no | VERDE | VERDE | no |
| Australia:VER:pit33 | 33 | sì | sì | VSC_REGIME | VERDE | no |
| Cina:HAM:pit34 | 34 | no | no | VERDE | VERDE | no |
| Giappone:VER:pit23 | 23 | sì | sì | SC_REGIME | SC_REGIME | no |
| Miami:PIA:pit10 | 10 | sì | sì | SC_REGIME | SC_REGIME | no |
| Canada:VER:pit43 | 43 | sì | sì | **VSC_DEPLOY** | VERDE | no* |
| Spagna:HAM:pit62 | 62 | sì | sì | VSC_REGIME | VERDE | no |

**0/11 casi cambiano** adottando N2 come drop-in (regola binaria = evento ∪ impatto, stessa soglia
2, stessa detection `4/6`). Δ valore atteso = 0 per tutti ⇒ golden resterebbe **11/11**.

\* Unico punto di sensibilità: **Canada:VER:pit43** cade su un giro **VSC_DEPLOY**. Cambierebbe solo
sotto una policy ipotetica "sopprimi solo REGIME (non deploy/restart)", che **non è proposta** (il
verdetto blocca ogni proposta). Sotto la regola drop-in resta soppresso, invariato.

## N6 — Proposta

**NON PRODOTTA.** N4 = FONTE ANCORA ROTTA (4/9 circuiti fuori range, VSC_REGIME pooled 1,055).
La condizione pre-registrata per `PROPOSTA_NEUTRALIZZAZIONE.md` (N4 = FONTE SANA) non è soddisfatta.

## Conclusione senza attenuazioni

La neutralizzazione **non è ancora una fonte sana**. Abbiamo però imparato due cose committate:

1. **Il vocabolario degli status esiste ora** (`data/status_vocabolario.csv`, 39 codici, tutti
   decodificati) — vale la sessione da solo.
2. **La classificazione ERA parte del problema per SC** (1,11 → 1,614, dentro il range fisico su
   8/9 circuiti separando deploy/restart), **ma NON per VSC**: il segnale `'6'` nel formato 2026 non
   rallenta come una VSC reale (regime pooled 1,055; suzuka senza dati VSC; montreal 1,043).

Finché VSC non è capita, **nessuno deve costruire sulla neutralizzazione VSC**. Il debito resta
aperto. Il verdetto strategico è del PO; questo report non lo dà.

### File prodotti
- `PREREG_SESSIONE_N.md` (committato per primo)
- `gen_neutralizzazione_v2.py` (generatore committato)
- `data/status_vocabolario.csv`, `data/neutralizzazione_due_livelli.csv`, `data/rlap_per_regime.csv`
- questo `REPORT_NEUTRALIZZAZIONE.md`
- Nessun `PROPOSTA_NEUTRALIZZAZIONE.md` (verdetto ANCORA ROTTA).
