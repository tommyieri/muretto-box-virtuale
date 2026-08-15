# Referto — le 61 righe, guardate una per una: **due correzioni a me stesso**

**Data: 15/08/2026.** Non è una misura nuova: è l'esame dei dati che
`ESITO_vsc_copertura.md` invitava a guardare (*«chi riapre parta dai dati e non dalle mie
ipotesi»*). Esplorativo per costruzione, e per questo **non propone nessuna spiegazione**:
propone due correzioni e un esperimento da pre-registrare.

---

## 1 · Il fenomeno non è diffuso: è di **quattro gare su sette**

| gara | soste | eccesso medio |
|---|---|---|
| Austria | 4 | **+1,50** |
| Spagna | 3 | **+1,33** |
| Australia | 23 | **+0,91** |
| Belgio | 9 | **+0,89** |
| Canada | 11 | **0,00** |
| Gran Bretagna | 6 | **0,00** |
| Ungheria | 5 | **−0,20** |

Non è una media di 0,62 spalmata su tutte: è **positiva in quattro gare e nulla o negativa
nelle altre tre**. Una media che nasconde una separazione così netta andava aperta prima.

## 2 · Dove non succede, non succede **a nessuno dei due**

**11 righe su 61 hanno zero passanti sia nel motore sia nella realtà — e nove sono il
Canada.** Guardando i gap fra auto adiacenti sui giri VSC, il Canada ha **11,08 s (motore) e
14,83 s (vero)**: una sosta che costa ~13 s non può scavalcare più di un'auto, né lì né nella
simulazione.

**Il fenomeno ha bisogno di un campo stretto per esistere.** Non è una proprietà del motore
che si manifesta ovunque: è una proprietà che si manifesta dove c'è spazio per manifestarsi.

## 3 · E dove succede, il campo del motore è più **stretto** del vero

Gap mediano fra auto adiacenti, **sui soli giri VSC** (non su tutti i neutralizzati):

| gara | motore / vero | rapporto | eccesso |
|---|---|---|---|
| Spagna | 9,55 / 15,43 | **0,62** | +1,33 |
| Austria | 3,63 / 5,27 | **0,69** | +1,50 |
| Australia | 3,68 / 4,69 | **0,79** | +0,91 |
| Belgio | 2,67 / 3,29 | **0,81** | +0,89 |
| Canada | 11,08 / 14,83 | 0,75 | **0,00** ← gap troppo grandi |
| Gran Bretagna | 6,28 / 5,87 | **1,07** | 0,00 |
| Ungheria | 14,00 / 5,92 | **2,37** | −0,20 |

Spearman fra rapporto ed eccesso: **−0,75** su 7 gare. Dove il motore stringe il campo,
l'eccesso c'è; dove lo allarga (Ungheria) è negativo; dove è pari (Gran Bretagna) è zero. E il
Canada mostra che il rapporto conta **solo se i gap sono abbastanza piccoli** perché qualcuno
possa passare.

## 4 · Prima correzione: **la falsificazione del 14/08 era fatta sulla popolazione sbagliata**

Il 14/08 avevo scritto, nel referto sulla conversione:

> *«Stavo per scrivere che la compressione impacchetta il campo troppo stretto. È falso: il gap
> mediano fra auto adiacenti sui giri neutralizzati è 4,46 s nel motore contro 3,00 s nel vero
> — il campo del motore è 1,48× più largo.»*

Quel numero è la mediana su **tutti** i giri neutralizzati di **tutte e undici** le gare, ed è
dominata da **Monaco (5,39×)** e **Ungheria (2,37×)**. Ma Monaco **non ha una sola sosta VSC**
in questo campione, e l'Ungheria è proprio la gara dove l'eccesso è **negativo**.

**Ristretto ai giri che portano il fenomeno, il motore è più stretto in cinque gare su sette.**

Ho falsificato un'ipotesi con una statistica calcolata dove il fenomeno non c'è. È **E16** del
catalogo di casa, alla lettera: *«un ottimo misurato dove il fenomeno non c'era»*. La
falsificazione **non regge**, e la spiegazione della densità torna in vita — il che non
significa che sia vera.

## 5 · Seconda correzione: il «+0,46 a copertura piena» è **una sola lap**

Ieri ho chiuso l'esito scrivendo che il meccanismo era *«falsificato dal suo caso migliore»*,
perché sulle 13 soste a VSC piena l'eccesso restava +0,46. Aperte le righe:

| | eccesso |
|---|---|
| Australia giro 12 (ALB +3 · ANT +2 · BOT +1 · RUS 0) | **+6** |
| **tutte le altre nove soste piene** | **esattamente 0** |

**Il +0,46 è interamente quattro soste di un giro di una gara.** Il verdetto di ieri non
cambia — V1 era rosso per la pendenza nulla e i terzili non monotoni, indipendentemente da
questo — ma quella frase poggiava su quattro righe, e va detto.

## 6 · Cosa NON scrivo

**Non dichiaro che la densità spiega B.** Sarebbe la quinta ipotesi in cinque giorni, e per di
più costruita **post-hoc sulle stesse 61 righe che dovrebbe spiegare**: esattamente il modo in
cui un pattern trovato guardando diventa un risultato che non replica.

Quello che è successo è un'altra cosa, ed è più utile: **una falsificazione precedente si è
rivelata mal fatta**, e l'ipotesi che aveva chiuso è tornata in gioco senza essere stata
provata.

## 7 · L'esperimento da pre-registrare, su dati che non ho guardato

Se la densità governa, allora deve valere anche **dove B non c'è**: sotto **SC** l'eccesso è
nullo (9-8, p = 1,000), e la previsione è che lì il rapporto motore/vero sui giri SC sia
**≈ 1 oppure i gap troppo larghi**. È una previsione secca su un campione che questo referto
non ha toccato — le soste SC — e va scritta prima di guardarla.

Il secondo campione disponibile, e più grande, è il **fondo 2018-2025**: la memoria del
progetto dice che è estraibile con lo stesso metro della VSC a tempo.

---

*Nessuna misura nuova, nessun parametro toccato, nessun file di produzione modificato. Le 61
righe si rileggono con `node ai_lab/confronto/vsc_copertura.mjs --json`.*
