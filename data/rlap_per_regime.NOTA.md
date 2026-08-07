# NOTA DI VALIDITÀ — `rlap_per_regime.csv`

> ⚠️ **VALIDITÀ PARZIALE.** SC_REGIME è validato: R_lap **1,614** aggregato, dentro il range fisico
> **[1,30–1,80]** su **8/9 circuiti**. **ECCEZIONI: Monaco SC_REGIME = 1,108**, FUORI dal range
> fisico pre-registrato — **non validato**. **VSC_REGIME (1,055 aggregato) NON è validato su nessun
> circuito**: fisicamente impossibile, la VSC non è compresa (vedi `REPORT_NEUTRALIZZAZIONE.md`,
> verdetto **FONTE ANCORA ROTTA**). **Nessun consumatore attuale. Non usare questi valori in
> produzione senza una verifica dedicata.**

## Precisazione: "non validato" ≠ "fuori range"

Da leggere prima di guardare il CSV, per non fraintendere la riga qui sopra.

Per-circuito, **6 dei 9** circuiti hanno VSC_REGIME dentro [1,20–1,50] (melbourne 1,257;
shanghai 1,355; miami 1,290; monaco 1,383; spielberg 1,221; silverstone 1,285). Fuori: montreal
**1,043** e catalunya 1,196; suzuka **non ha nemmeno un giro VSC_REGIME** (n=0).

Quei 6 valori **non sono comunque validati**. La validazione era un test pre-registrato *sulla
fonte* (conjunction SC∈[1,30-1,80] **E** VSC∈[1,20-1,50] su ≥6/9 circuiti): il test **è fallito**
(5/9). Un numero che cade dentro il range mentre la fonte che lo produce non è compresa è un numero
**non validato**, non un numero buono: la validità è conferita dal test che passa, non dal singolo
valore che sembra plausibile. L'aggregato VSC 1,055 — VSC solo ~5% più lenta del verde — dimostra
che il segnale `'6'` nel formato 2026 marca giri che **non rallentano come una VSC reale**; dove il
per-circuito "torna", non sappiamo dire se torna per la ragione giusta.

Stessa logica per SC: 8/9 dentro range **non** rende Monaco (1,108) recuperabile per interpolazione.

## Perché la nota è in un `.md` affiancato e non in testa al CSV

Il CSV è generato da `gen_neutralizzazione_v2.py` e letto via `csv.DictReader` (prima riga =
intestazione). Una riga di commento in testa diventerebbe l'intestazione e romperebbe qualunque
parser. La nota vive quindi accanto al file, con lo stesso stem — stessa convenzione di
`pit_loss_circuito_f1db.NOTA.md`.

## Provenienza

Sessione N, branch `neutralizzazione-verita` (PR #23, chiuso come superseded da PR #24, che ha
portato i deliverable in main). Metodo pre-registrato in `PREREG_SESSIONE_N.md` **prima** dei
numeri; verdetto e diagnosi in `REPORT_NEUTRALIZZAZIONE.md`. Vocabolario degli status:
`data/STATUS_VOCABOLARIO_NOTA.md`.

Confronto che spiega cosa era rotto: classificazione vecchia (json puro) R_lap = **1,11**; nuova
SC_REGIME = **1,614** (risanato dalla separazione deploy/restart); nuova VSC_REGIME = **1,055**
(**non** risanato). Per SC la classificazione *era* il problema; **per VSC no** — il debito VSC
resta aperto.

Rigenerabile: `python3 gen_neutralizzazione_v2.py`.

---

> **SECONDA VERIFICA (07/08/2026, `ai_lab/neutralizzazione/`).** La lettura DI CAMPO
> (`regimePerGiroDiCampo`, soglia >50% del campo — pre-registrata in
> `PREREG_vsc_di_campo.md`) **NON risana la VSC**: pooled 1,116, 0/7 circuiti nel range,
> e i giri '6' *solo locali* valgono 1,128 — indistinguibili dal campo. Il guasto non è
> la soglia ≥2-auto: il candidato rimasto è la **diluizione del giro parziale** (il
> fondo, 147 gare, dà 1,199 — a un soffio dal range). Il veto resta pieno; la strada
> futura dichiarata è una fonte a TEMPO (finestre deploy/ending del race control), non
> il simbolo '6'. Referto: `ai_lab/neutralizzazione/ESITO_vsc_di_campo.md`.

---

> **TERZA VERIFICA, FONTE A TEMPO (07/08/2026) — IL DEBITO È SPIEGATO.** Con le
> finestre al millisecondo del track_status (`ai_lab/neutralizzazione/`, prereg V2):
> R_lap dei giri PIENAMENTE coperti (f ≥ 0,9) = **1,323**, nel range fisico; monotonia
> perfetta sui bin di copertura (1,077 / 1,198 / 1,323). Le celle '6' hanno copertura
> mediana **0,533** e mai nulla: il simbolo proietta per-giro un fenomeno A TEMPO — il
> 1,055/1,116 era diluizione, non una fonte rotta. **Il veto si restringe al simbolo
> '6' per-giro; la VSC a tempo è utilizzabile con targhetta**
> (`frazioni_vsc_2026.json`). Referto: `ESITO_vsc_a_tempo.md`.
