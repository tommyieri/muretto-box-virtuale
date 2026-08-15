# Referto — il meccanismo dietro B: **osservato, solo VSC, e poggiato su una definizione sotto veto**

**Data: 15/08/2026.** Banco: `ai_lab/confronto/geometria_sosta.mjs`. Cerca il meccanismo che
`REFERTO_conversione_sosta.md` aveva lasciato senza: perché il motore converte un secondo di
ritardo in più posizioni della realtà. Descrittivo, nessun cancello, nessun parametro toccato.

---

## Lo strumento che ho costruito, e che **ha fallito la sua stessa validazione**

L'identità di partenza sembrava quasi una tautologia: chi perde Δt secondi scende di tante
posizioni quante sono le auto **entro Δt dietro di lui**. Quindi «posizioni per secondo» non
sarebbe un parametro del modello ma una proprietà della **geometria** del campo.

Su quella base avevo costruito una decomposizione pulita, con il controfattuale in mezzo:

| | auto entro Δt dietro |
|---|---|
| (1) campo **motore**, Δt **motore** | 2,346 |
| (2) campo **motore**, Δt **vero** ← controfattuale | 2,710 |
| (3) campo **vero**, Δt **vero** | 2,327 |
| effetto **TEMPO** (1)−(2) | **−0,364** |
| effetto **GEOMETRIA** (2)−(3) | **+0,383** |

Numeri che raccontavano benissimo la compensazione trovata ieri: i due errori si annullano a
**+0,019** sulla singola sosta.

**E sono da buttare.** La validazione che avevo messo nello stesso banco — il conteggio deve
predire le posizioni **davvero** perse — non regge:

| | modello | osservato | scarto medio \|modello − osservato\| |
|---|---|---|---|
| motore | 2,346 | **1,065** | **1,299** |
| vero | 2,327 | **0,720** | **1,626** |

Lo scarto del modello è **tre volte più grande dell'effetto che pretendeva di misurare**
(0,383). La ragione è ovvia una volta vista: **il campo non sta fermo mentre uno è ai box.**
Gli altri avanzano, alcuni si fermano a loro volta, e un conteggio su una fotografia al giro
L−1 non descrive cosa succede in due giri.

La decomposizione qui sopra è aritmetica su una grandezza che non descrive la corsa. **Non è
il meccanismo di B**, ed è il terzo meccanismo mio che cade in tre giorni. Resta scritto
perché la prossima persona non lo ricostruisca.

## Quello che invece è **osservato**, senza nessun modello

Chi era dietro al giro L−1 ed è davanti al giro L+1. Nient'altro.

| | chi scavalca chi si ferma | di cui **già ai box** | **rimasti in pista** |
|---|---|---|---|
| **VSC** (n=61) | motore **1,902** · vero **1,279** | 0,197 · 0,164 | **1,705 · 1,115** |
| **SC** (n=46) | motore 0,957 · vero 0,804 | 0,304 · 0,196 | 0,652 · 0,609 |

**B esiste, è concentrato sotto VSC, e l'eccesso è quasi tutto di auto che non si sono
fermate**: +0,59 su +0,62 di scarto totale. Non è un artefatto di contabilità sulla coda dei
box — quelli che erano ai box pesano 0,03.

E regge al confronto appaiato, sosta per sosta:

| | il motore ne fa di più | di meno | pari | p (test dei segni) | gare concordi |
|---|---|---|---|---|---|
| **VSC** | **25** | 8 | 28 | **0,0046** | **6 su 7** |
| **SC** | 9 | 8 | 29 | 1,000 | 2 su 4 |

**Sotto SC non c'è niente.** Sotto VSC c'è, ed è solido anche a blocchi = gare (E11).

E c'è un dettaglio che rende il fatto più stretto, non più largo: sotto VSC il motore fa
pagare **meno** tempo del vero (14,99 s contro 18,42) e ciò nonostante **lascia passare più
auto**. Le due cose tirano in direzioni opposte, quindi non è «è solo il tempo».

## Il caveat che conta più del risultato

**Tutto questo è misurato su `regimePerGiroDiCampo`**, che classifica un giro come VSC quando
più della metà del campo porta il simbolo `'6'` **su quel giro** (`definizioni.mjs:125-147`,
via `regimeDiCella`).

Il progetto ha messo un **veto esplicito** su quella lettura il 07/08 (PR #127):

> *«mai costruire sul simbolo `'6'` per-giro; la VSC A TEMPO è validata»* — le celle `'6'`
> hanno **copertura mediana 53%** e mai nulla: *«presenza giusta, quantità sbagliata»*.

Un giro che io chiamo VSC è, in mediana, **VSC per poco più di metà**. E il motore ci applica
la compressione e il fattore della sosta **per intero**.

**Questo non invalida l'osservazione — la rende una candidata a spiegarsi da sola.** Se il
motore tratta come interamente neutralizzato un giro che lo è al 53%, il campo che costruisce
su quei giri ha una forma sbagliata, ed è esattamente il tipo di errore che farebbe passare
troppe auto attorno a chi si ferma. Sarebbe anche il motivo per cui **sotto SC non succede**:
lì la copertura non ha questo problema.

**Ma non l'ho misurato**, e non ho intenzione di scriverlo come se l'avessi fatto. È la quarta
spiegazione plausibile in tre giorni, e le prime tre erano sbagliate.

## Dove lascia il filo

1. **B è reale, è solo VSC, ed è quantificato**: il motore lascia passare 1,90 auto contro
   1,28, con l'eccesso tutto su chi non si è fermato (p = 0,0046, 6 gare su 7).
2. **Il meccanismo resta non misurato**, e lo strumento naturale — la densità locale — è stato
   provato e ha fallito la propria validazione.
3. **La strada che questo referto indica non è un'altra ipotesi: è rifare la misura sulla VSC
   A TEMPO** (`ai_lab/neutralizzazione/frazioni_vsc_2026.json`, finestre in millisecondi, già
   validata dal progetto), invece che sul simbolo per-giro che è sotto veto. Il progetto
   dichiara che ogni consumo di quella fonte **richiede la sua prereg**, e questo è un consumo.

Finché non è fatto, **il numero di B non va usato per tarare niente**: descrive un fenomeno
vero misurato con un righello che il progetto ha già dichiarato storto.

---

*Nessun parametro toccato, nessun file di produzione modificato. Suite senza regressioni.*
