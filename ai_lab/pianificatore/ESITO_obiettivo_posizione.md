# ESITO — l'obiettivo del pianificatore: inerte ovunque tranne dove doveva esserlo

**Data: 04/08/2026.** Esegue `PREREG_obiettivo_posizione.md`, sigillata prima dei numeri
(commit `0185315`). Dati: `ESITO_cancelli_obiettivo.json`. Nessuna soglia toccata.

---

## Il verdetto

| | cancello | esito |
|---|---|---|
| **P1** | non peggiora la durata prevista | **PASSA** — 7 giri contro 7 |
| **P2** | «arrivi così» cala di almeno 5 punti | **NON PASSA** — sale di 2,4 (38,3 % → 40,7 %) |
| **P3** | non perde in modo significativo | **PASSA** — 4-1, p = 0,375 |
| **P4** | i due obiettivi scelgono diverso in almeno il 10 % | **NON PASSA** — **5 su 167, il 3,0 %** |

Guardie: **zero** violazioni del regolamento, **zero** casi con popolazione diversa fra i
bracci.

Per la regola di decisione scritta nella prereg §5:

> **NON SI SPEDISCE.** Con questo tetto e questi rivali la posizione alla bandiera **non
> distingue i piani**. Il codice resta, spento e bit-identico.

## 1 · Ma i cinque casi non sono sparsi: sono tutti a Monaco

Questa è la parte che vale, e non era prevista con questa nitidezza:

| gara | n | scelte diverse |
|---|---|---|
| **Monaco** | 63 | **5** |
| Spagna | 27 | 0 |
| Ungheria | 23 | 0 |
| Austria | 21 | 0 |
| Australia | 13 | 0 |
| Canada | 8 | 0 |
| Giappone | 7 | 0 |
| Miami | 3 | 0 |
| Belgio · Cina | 1 · 1 | 0 |

**Cinque su cinque a Monaco, zero altrove.** E non è un caso: Monaco è l'**unica** pista in
cui la soglia di sorpasso misurata è alta — **2,83 s/giro contro 0,61 ovunque**. Dove passare
costa poco, la posizione alla bandiera è quasi una funzione monotòna del tempo, e i due
obiettivi coincidono per costruzione. Dove passare è quasi impossibile, si separano.

È esattamente il meccanismo che la prereg §1 aveva scritto come *premessa* — «col tetto
acceso posizione e tempo diventano due grandezze diverse» — e il dato dice che è vero **su
una pista su undici**.

## 2 · Cosa sceglie l'uno e cosa sceglie l'altro, nei cinque casi

| pilota | durata vera | obiettivo TEMPO | obiettivo POSIZIONE |
|---|---|---|---|
| HAD | 34 | **1** (P7) | 17 (P4) |
| HAD | 36 | **1** (P4) | 11 (P3) |
| HUL | 53 | **2** (P12) | 4 (P11) |
| RUS | 10 | **1** (P7) | 17 (P5) |
| PIA | 11 | 10 (P7) | 29 (P6) |

L'obiettivo di oggi, a Monaco, dice **«fermati al giro 1»** in quattro casi su cinque. Non è
una preferenza discutibile: è una patologia. E l'obiettivo nuovo la toglie in tutti e
quattro, guadagnando anche una o due posizioni previste.

Vince 4 volte su 5 (l'eccezione è PIA, 29 contro una durata vera di 11). Cinque casi non
sono una prova di niente — **il test dei segni dà p = 0,375** — ma sono un indizio con un
meccanismo dietro, che è più di quanto avesse la maggior parte dei rami chiusi qui.

## 3 · Perché NON rifaccio il cancello su Monaco solo

Sarebbe la mossa ovvia, e sarebbe sbagliata: **scegliere il perimetro dopo aver visto dove
sta il segnale.** È la stessa cosa che ho rifiutato stamattina sulla vita per circuito, dove
la robustezza «solo era 18 pollici» era l'unica che batteva il pavimento e l'ho lasciata
lì. Rifarlo qui sarebbe applicare la regola quando conviene.

**La condizione per riaprire è scritta adesso, e non dipende da me**: serve **più di una
pista con soglia di sorpasso alta**. Oggi ce n'è una su undici. Se il 2026 ne porterà altre —
Singapore e Zandvoort sono le candidate naturali, e nessuna delle due ha ancora una soglia
misurata perché non sono nel perimetro demo — la domanda torna legittima con dati nuovi, che
è l'unica porta che questo progetto lascia aperta.

## 4 · La conseguenza sul difetto del PO, che è la cosa che conta

La direttiva diceva: *«l'obiettivo del pianificatore è il difetto più grosso che ho
trovato»*, con tre voci. Oggi tutte e tre hanno un numero:

| voce | esito |
|---|---|
| **il traffico** | **CHIUSA** — errore 8 → 7 giri, «arrivi così» 73 → 64 |
| **i rivali fermi** | **misurata e NULL** — vincono i segni 46-26, non spostano la mediana |
| **l'obiettivo è il tempo** | **inerte al 97 %** — e al 3 % restante è tutto Monaco |

> **Il difetto più grosso, misurato, vale 5 decisioni su 167.** L'errore da 11 giri l'ha
> curato il traffico, non l'obiettivo.

Non è la risposta che la diagnosi si aspettava, ed è il motivo per cui valeva la pena
misurarla invece di crederci. La diagnosi era ragionevole — i team *davvero* si fermano per
coprire — ma il pezzo che mancava al motore non era l'obiettivo: era il traffico, ed è
dentro.

## 5 · Cosa resta in codice

`pianoOttimo` prende `obiettivo` come ingresso dichiarato, con valore di riserva `'tempo'`:
finché nessuno lo passa, il file si comporta **bit per bit** come prima. Il comparatore vive
in un posto solo (`meglioDi`), e la sentinella `s39` verifica che spento sia spento — provata
a fallire invertendo il confronto.

Resta perché il costo è zero e perché la condizione di riapertura è precisa: il giorno che
esistono due piste difficili, il braccio è già lì e non va riscritto.

## 6 · Cosa NON si conclude

- **Non** si conclude che la posizione in pista sia irrilevante per la strategia. Si conclude
  che, **con i rivali fermi**, non distingue i piani — e i rivali che reagiscono sono un ramo
  chiuso dal suo soffitto, non da un tentativo mancato.
- **Non** si conclude niente sul tetto al movimento, che è un ingresso di questa misura e non
  il suo oggetto.
- Resta aperta, e non è di questa prereg, la patologia che i cinque casi hanno illuminato:
  **a Monaco l'obiettivo del tempo dice «fermati al giro 1»**. Con l'obiettivo nuovo sparisce,
  ma con quello vecchio — cioè in produzione — c'è. Va guardata da sola.
