# Referto — le 62 righe: **non sono 62 errori, sono una quindicina di eventi**

**Data: 15/08/2026.** Esame riga per riga delle 62 coppie che la realtà scambia e il motore
no (`coppie_mancate.mjs --json`). Esplorativo: **non propone nessun meccanismo** — sarebbe il
sesto in sei giorni. Nessun file di produzione toccato.

---

## 1 · La struttura che l'aggregato nascondeva

Le 62 coppie **non sono 62 fallimenti indipendenti**. Sono in gran parte lo stesso pilota che
si sposta di più posti in due o tre giri, e ogni suo spostamento genera tante coppie quante
sono le auto che scavalca.

| evento (gara · pilota) | coppie | giri |
|---|---|---|
| **Belgio · HAD** | **8** | 10-17 |
| **Monaco · RUS** | **7** | **72** (un giro solo) |
| **Belgio · BOR** | **5** | 14-17 |
| **Gran Bretagna · ANT** | **5** | 42-44 |
| Giappone · ANT · LIN | 3 + 3 | 17-21 |
| …altri undici da 2 | 22 | |

**39 coppie su 62 (63%)** hanno almeno un estremo dentro un evento multiplo, e i **quattro
eventi più grossi da soli valgono 25 coppie — il 40% di tutto il deficit**.

**Monaco/RUS al giro 72 vale sette coppie: l'11% del deficit totale è un'auto sola, in un
giro solo.**

## 2 · I tre eventi più grossi, guardati da vicino

Sono **esempi, non misure**: li ho scelti perché sono i più grandi, e tre casi non fanno una
statistica. Ma dicono di che *tipo* di cosa si tratta.

**Monaco · RUS** — soste vere ai giri 31, 60, 66, 68, **72**; arriva P14.

| giro | 68 | 69 | 70 | 71 | **72** | 73 | 74 | 75 | 76 |
|---|---|---|---|---|---|---|---|---|---|
| **vero** | 4 | 4 | 4 | **3** | **11** | 11 | 11 | 11 | 11 |
| **motore** | 4 | 4 | 4 | 4 | **4** | 4 | 4 | 4 | 4 |

*(SC ai giri 68-70.)* Nella realtà una sosta al giro 72 gli costa **otto posizioni** in un
giro. Nel motore **non gliene costa nessuna**: resta quarto fino alla bandiera.

**Belgio · HAD** — soste vere ai giri **1, 2**, 20; arriva P6. Una doppia sosta al primo e
secondo giro, poi la rimonta:

| giro | 8 | 10 | 12 | 14 | 15 | 17 | 19 | 20 |
|---|---|---|---|---|---|---|---|---|
| **vero** | 15 | 14 | 13 | 11 | **8** | **7** | 7 | 7 |
| **motore** | — | 15 | 15 | 14 | 12 | 11 | 12 | **15** |

Il motore la rimonta la comincia, la fa a metà, **e poi la perde**: torna quindicesimo al
giro 20 mentre il vero è settimo.

**Gran Bretagna · ANT** — soste vere ai giri 35, 41, 43; arriva P10. Real 2 → 6 → 7 → **10**
fra i giri 41 e 44; motore 3 → 4 → 7 → **7**. Il motore lo fa scendere, ma **si ferma a metà
strada**.

## 3 · Che cosa cambia rispetto a ieri

Ieri ho concluso: *«conservatività uniforme… non c'è una leva su cui agire»*. Il **tasso**
resta quello — una coppia su quattro, senza differenze significative fra secchi — ma la
**forma** no.

**Il deficit non è spalmato su 62 piccoli fallimenti: è concentrato in una quindicina di
episodi**, e i più grossi sono singole auto che nella realtà fanno un balzo di 8 posizioni e
nel motore ne fanno zero o metà.

È una correzione al mio stesso quadro, ed è nella direzione che conta: **una quindicina di
episodi si possono guardare uno per uno**, 62 fallimenti diffusi no.

E chiarisce anche perché tutti i miei meccanismi sono caduti: **cercavo una legge che
governasse un fenomeno diffuso, e il fenomeno non è diffuso.** Un modello medio non può
spiegare una distribuzione dominata da una manciata di eventi grandi.

## 4 · Cosa NON scrivo

Non dico che il motore «sbaglia sui balzi grandi» come se fosse una legge: sono quattro
eventi su undici gare, e i tre che ho aperto potrebbero avere tre cause diverse — RUS ha una
sosta tardiva in un campo che il motore tiene molto più largo del vero, HAD una rimonta dopo
una doppia sosta al giro 1-2, ANT una gara a tre soste. **Non ho misurato niente di tutto
questo**, e dopo cinque ipotesi cadute non ne aggiungo una sesta guardando tre grafici.

Quello che è misurato è la **struttura**: 63% dentro eventi multipli, 40% in quattro eventi.

## 5 · Quello che farei dopo, ed è un cambio di metodo più che di bersaglio

Smettere di cercare **una legge** e cominciare a fare **l'autopsia dei singoli episodi**: i
quattro grandi, uno per uno, fino a capire cosa succede in ognuno. Non produrrà un parametro
da tarare, ma finora le leggi cercate al tavolo sono cadute tutte e cinque, e gli episodi
sono lì, contati e nominati.

Il primo della lista è **Monaco/RUS al giro 72**: una sosta che nella realtà costa otto
posizioni e nel motore zero, con la Safety Car appena rientrata. Da sola vale l'11% del
deficit.

---

*Nessuna misura nuova oltre al conteggio degli eventi, nessun parametro toccato. Suite senza
regressioni.*
