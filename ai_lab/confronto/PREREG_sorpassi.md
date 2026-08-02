# PREREG — ATTACCARE I SORPASSI: prima capire se sono davvero loro

**Scritta il 02/08/2026, PRIMA di misurare.**
Direttiva del PO: *«attacchiamo i sorpassi e poi valutiamo come correggere tutto»*.

## Perché questa prereg comincia mettendo in dubbio la conclusione di ieri

`PREREG_gara_intera_2.md` ha concluso: il motore pareggia col modello nullo, la
fisica non deriva (bias +0,04 su 53 giri), quindi **il collo di bottiglia sono i
sorpassi**. Prima di costruire qualunque cosa su quella frase, va verificata,
perché ho poi trovato un fatto che la rende sospetta.

**In verde il costruttore non fa fermare nessun rivale.** `costruttore.mjs:271`:
`pits` contiene le soste del solo soggetto. Sotto neutralizzazione c'è una voce
per i rivali (N4), ma in verde no — e giustamente: al congelamento non si sa
quando si fermeranno gli altri, e attribuirglielo sarebbe E14.

La conseguenza però è strutturale. Se nessun rivale si ferma, e tutti degradano
con lo stesso ρ, **l'ordine fra i rivali si conserva quasi esattamente per 53
giri**. L'unico che si muove è il soggetto, dello scarto della sua sosta. Un
motore così **assomiglia al modello nullo per costruzione**, e il pareggio di
ieri potrebbe non dire niente sulla fisica né sui sorpassi.

C'è di peggio, ed è mio: ieri ho dato al soggetto le sue soste vere e **a nessun
altro le loro**. L'informazione dal futuro era asimmetrica, e l'asimmetria
spingeva esattamente verso il pareggio che ho poi interpretato come un risultato.

## Le due domande, in quest'ordine

### A · Quanto movimento manca? (censimento, nessuna soglia da superare)

Per ogni gara: `cambiDiPosizione` (la definizione del kernel, QUANTI non QUALI)
fra l'ordine al congelamento e l'ordine finale, calcolato due volte — sull'ordine
**vero** e su quello **previsto dal motore**.

`resa = cambi_motore / cambi_reali`. È un censimento: si riporta e basta.

### B · Con le soste vere di TUTTI, il motore batte il nullo?

Stessa misura di ieri, stessa metrica, stesso modello nullo, stesse soglie
G1–G4 di `PREREG_gara_intera.md §5` — **cambia un ingresso solo**: ogni pilota
riceve le SUE soste vere, non solo il soggetto. L'informazione dal futuro
diventa simmetrica.

Resta informazione dal futuro, e resta una misura della FISICA, non una
previsione. Il prodotto non può usarla: in diretta le soste dei rivali non si
conoscono. Serve a rispondere a una domanda diagnostica sola — *quando il motore
sa tutto quello che è successo tranne chi ha superato chi, quanto sbaglia?*

## La tabella delle letture, decisa adesso

| A (resa) | B (G4) | lettura |
|---|---|---|
| bassa | **fallito** | i sorpassi sono davvero il collo di bottiglia: la conclusione di ieri regge, e si passa alla Domanda B di `banco/prereg/PREREG_difesa_II.md` |
| bassa | **passato** | **la conclusione di ieri era sbagliata**: il deficit non erano i sorpassi, erano le soste dei rivali mancanti. Si corregge il referto e il lavoro si sposta su come il prodotto tratta i rivali in verde |
| alta | fallito | il motore muove abbastanza gente ma la muove male: non è un problema di quantità. Serve una terza domanda, non registrata qui |
| alta | passato | il pareggio di ieri era solo l'asimmetria dell'informazione, e non c'è nessun deficit di movimento da spiegare |

«Bassa» e «alta» si separano a **resa = 0,50**: sotto, il motore produce meno
della metà del movimento vero. La soglia è arbitraria e si dichiara tale — serve
solo a impedirmi di decidere il verso dopo aver visto il numero (E08).

## I paletti che non si toccano

- **Non si costruisce una probabilità di sorpasso**, né qui né dopo. La
  sentinella `s25_difesa` fa fallire la suite se un campo nomina chi supera chi,
  e resta com'è. L'unica grandezza di duello ammessa è un CONTEGGIO.
- **Non si introduce il DRS**: nel 2026 non esiste.
- **Le soste vere dei rivali non entrano nel prodotto.** È uno strumento di
  laboratorio, dichiarato tale, e l'ingresso nasce spento.
- **Nessun coefficiente si tocca** in base a questi numeri (ρ, δ₇₀, c, τ, prior).

---

# ESITO — misurato il 02/08/2026

`node ai_lab/confronto/gara_intera.mjs --tutto [--rivali]` · 193 casi, 11 gare.

## Domanda A · la resa del movimento

| | cambi reali | cambi del motore | resa |
|---|---|---|---|
| soste del solo soggetto | 12,01 | 8,55 | **71,2%** |
| soste vere di TUTTI | 12,01 | 10,04 | **83,6%** |

**La mia ipotesi era sbagliata.** Avevo scritto che senza le soste dei rivali il
motore assomiglia al nullo *per costruzione*. Non è vero: anche così riordina 8,55
auto su 18. Il campo si rimescola da solo, perché i passi base e le età gomma
differiscono. La resa è **alta** in entrambi i regimi, ben sopra il 50% dichiarato.

Ma la media nasconde tutto. Per gara la resa va da **58% (Spagna)** a **180%
(Canada)**: in Canada la realtà cambia 3,5 posizioni in ~55 giri e il motore ne
cambia 6,3 — inventa quasi il doppio del movimento che c'è.

## Domanda B · con le soste vere di tutti, G4

| | valore | soglia | |
|---|---|---|---|
| G1 mediana \|errore\| | 1 | ≤ 3 | PASSA |
| G2 entro ±3 | 87,0% | ≥ 60% | PASSA |
| G3 bias medio | −0,05 | \|·\| ≤ 1,5 | PASSA |
| G4 batte il nullo | **1 vs 1** | strettamente meglio | **FALLITO** |

Dare a tutti le loro soste vere **migliora il motore** — media 1,73 → 1,63,
esatti 49 → 61, appaiato da 48-62 a **57-55** — ma non basta a vincere G4.
Test dei segni su tutti i casi: **p = 0,92**, pareggio pieno.

## La lettura, dalla tabella scritta prima: A alta + B fallito

> *«il motore muove abbastanza gente ma la muove male: non è un problema di
> quantità. Serve una terza domanda, non registrata qui»*

Ed è quello che si vede, con un dettaglio che la tabella non prevedeva: **il
difetto non è diffuso, è concentrato in un terzo dei casi.**

Terzili sull'eccesso di movimento (`cambi_motore − cambi_reali`):

| terzile | eccesso medio | \|errore\| motore | \|errore\| nullo | appaiato | segni |
|---|---|---|---|---|---|
| ne inventa MENO del vero | −5,4 | 1,71 | 1,88 | 20-13 | p = 0,296 |
| circa il giusto | −2,2 | **1,40** | 1,80 | 24-14 | p = 0,143 |
| ne inventa PIÙ del vero | +1,8 | 1,79 | **1,46** | **13-28** | **p = 0,027** |

Dove il motore **non** inventa movimento, batte il nullo: 44-27 sui primi due
terzili (p = 0,057). Dove ne inventa, **perde in modo significativo**.

Il pareggio complessivo di ieri non era un soffitto della fisica: era **la somma
di due popolazioni opposte** che si annullano.

## Il meccanismo, e perché non sorprende

Nel kernel **le auto possono attraversarsi** — è scritto nel kernel stesso, ed è
una scelta costituzionale del progetto: il duello non si simula. Finché il tempo
sul giro dice che A recupera 20 s su B, A passa. La realtà ha un vincolo che il
motore non ha, e nelle gare dove quel vincolo morde (Canada, Monaco) il motore
produce riordini che non possono avvenire.

Questo **non** chiede di costruire una probabilità di sorpasso, che resta vietata
(`s25_difesa` fa fallire la suite se un campo nomina chi supera chi). Chiede
qualcosa di diverso e permesso: **un tetto al movimento**, cioè un CONTEGGIO.

## Cosa NON si può ancora dire

Il terzile è costruito su `cambi_reali`, che al congelamento **non si conosce**:
è una diagnosi, non una funzione. Perché diventi prodotto serve un indicatore di
sorpassabilità disponibile al congelamento, ed è esattamente la Domanda B di
`banco/prereg/PREREG_difesa_II.md` — scritta il 30/07 e **mai eseguita**.

Con un rischio noto e da verificare per primo: nel filone traffico si era già
misurato che **la difficoltà di sorpasso storica non arriva al 2026**
(Spearman −0,024). Se l'indicatore dev'essere storico, quella misura dice che
questa strada è probabilmente chiusa. Se invece si misura **dentro la gara in
corso**, fino al congelamento, non è informazione dal futuro e la smentita
storica non la tocca. Sono due domande diverse e vanno separate prima di scrivere
altro codice.

## Cosa è cambiato in produzione: niente

`pianiRivali` nasce spento e la sentinella `s25_difesa` blocco (k) fa fallire la
suite se un percorso di `web/`, `demo/` o `scenario/` lo passa. La guardia è stata
provata: iniettando la stringa in `genera_vista_gara.mjs` diventa rossa (E09).
Suite 29/31, le due rosse dichiarate di sempre.
