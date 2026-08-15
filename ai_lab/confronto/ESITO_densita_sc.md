# Esito — la densità **non** spiega l'eccesso: P0 rosso, e il modello sbaglia di sette volte

**Data: 15/08/2026.** Esegue `PREREG_densita_sc.md`, sigillata a `b23c19d` prima di misurare
una sola sosta SC. Banco: `ai_lab/confronto/densita_sc.mjs`. Nessun file di produzione toccato.

---

## P0 — la validazione, che veniva prima di tutto

Il modello dice: chi perde Δt in un campo dove le auto distano `g` ne scavalca circa `Δt/g`.
Zero parametri liberi. Su 107 soste in finestra (SC + VSC):

| | previsto | osservato | ρ | **scarto medio** |
|---|---|---|---|---|
| **motore** | 3,342 | 1,495 | 0,604 | **2,030** |
| **vero** | **8,007** | **1,075** | 0,189 | **6,974** |

La soglia dichiarata era **0,6** — la dimensione dell'effetto che il modello doveva spiegare.
Gli scarti sono **3×** e **11×** quella soglia.

**Sul lato reale il modello sbaglia di sette volte**: prevede otto sorpassi e ne succede uno.

La prereg dice: *«P0 rosso → il modello non descrive la corsa e non se ne parla»*. Non se ne
parla.

## E tutto il resto cade con lui, come doveva

| | | esito |
|---|---|---|
| **P1** fuori campione, 46 soste SC su 4 gare | ρ **0,042** · IC95 **[−0,094 ; 0,422]** | contiene lo zero |
| **P2** magnitudine | previsto **−2,031** contro osservato **+0,152** | **segno sbagliato**, rapporto −13,3 |
| **P3** placebo | 95° percentile finte 0,151 · vera 0,042 | non lo batte |

Il modello non solo sbaglia la taglia: sotto SC prevede un eccesso **negativo** dove quello
osservato è positivo. E su VSC — il campione che aveva suggerito l'ipotesi — prevede **−6,65**
dove si osserva **+0,62**. **Neanche in campione funziona.**

## La quinta ipotesi, e la scrivo per l'ultima volta

| | spiegazione | esito |
|---|---|---|
| 12/08 | la sosta costa troppo poco, quindi scavalca troppe auto | segno rovesciato |
| 14/08 | la compressione impacchetta il campo troppo stretto | falsificata — *poi si è scoperto che la falsificazione era su Monaco, che non ha soste VSC* |
| 15/08 | la densità locale entro Δt dietro chi si ferma | strumento non validato (2,35 contro 1,07) |
| 15/08 | la copertura parziale della VSC | pendenza nulla e del segno sbagliato |
| 15/08 | **la densità del campo, Δt/g** | **strumento non validato (8,01 contro 1,07)** |

**Cinque ipotesi, cinque cadute.** Non ne propongo una sesta, e questa volta lo scrivo come
regola: chiunque riapra questo ramo deve portare un meccanismo che **passa una validazione
prima di essere raccontato**, non dopo.

## Ma il modo in cui cadono ha smesso di essere casuale, e questo sì che va scritto

Due strumenti diversi — il conteggio statico di ieri e il `Δt/g` di oggi — hanno fallito la
**stessa** validazione, nella **stessa** direzione: **prevedono troppi sorpassi.**

| | previsto | osservato |
|---|---|---|
| conteggio statico entro Δt (15/08, motore) | 2,35 | 1,07 |
| `Δt/g` (oggi, motore) | 3,34 | 1,50 |
| `Δt/g` (oggi, **realtà**) | **8,01** | **1,07** |

Entrambi poggiano sulla stessa immagine: **il campo come una scala ferma, e chi si ferma ci
scivola giù di tanti gradini quanto tempo ha perso.** Ed entrambi sbagliano per eccesso,
soprattutto sulla realtà — dove l'errore è di sette volte.

**La scala non è ferma.** Sotto neutralizzazione chi sta dietro si ferma a sua volta, il campo
si comprime, e i «gradini» si muovono insieme a chi ci cade. Non è una nuova ipotesi su B: è
la constatazione che due modelli costruiti sullo stesso presupposto lo hanno falsificato due
volte, e che il presupposto è quello da abbandonare — non i modelli.

**Questa è la cosa utile di oggi**, ed è più solida delle cinque ipotesi messe insieme perché
non è un'ipotesi: è il residuo di due falsificazioni indipendenti.

## Che cosa resta vero, dopo cinque giorni

Un fatto misurato e senza meccanismo:

- sotto **VSC** il motore lascia passare **1,90** auto attorno a chi si ferma contro **1,28**
  vere (25 soste contro 8, p = 0,0046, 6 gare su 7);
- l'eccesso è quasi tutto di auto che **non si sono fermate**, ed è concentrato in **quattro
  gare su sette**;
- sotto **SC** non esiste (9-8, p = 1,000);
- **non** dipende dal prezzo della sosta, **non** dalla copertura della finestra, e i due
  modelli di densità che avrebbero potuto spiegarlo **non descrivono la corsa**;
- e **non è un artefatto** della definizione sotto veto.

Vale **0,62 posizioni per sosta in finestra**, su un errore medio del motore di 1,617
posizioni alla bandiera. Non è il collo di bottiglia del prodotto — quello resta il movimento
in verde, il 71,8% dello scarto. È un difetto vero, piccolo, e adesso circoscritto con
precisione.

---

*Nessun parametro toccato, nessun file di produzione modificato. Suite senza regressioni.*
