# Prereg — la terza forma: **la compressione la paga il capofila**

**Data: 15/08/2026.** Sigillata **prima** di scrivere una riga del kernel e prima di
calcolare un solo esito. Il commit che la porta non tocca nessun file del motore.

---

## 0 · Da dove viene, e perché non è una sesta ipotesi

L'autopsia di Monaco/RUS (`REFERTO_autopsia_monaco_rus.md`, PR #171) ha misurato che il
**pavimento** che ho acceso il 14/08 — giusto, e che toglie 5.815 giri impossibili —
rende la compressione **inerte**: il campo del motore non si compatta più. A Monaco resta
largo 240 s dove la realtà scende a 3,6.

Il meccanismo è nella forma della consegna, non nella misura di κ:

> la seconda forma chiude i distacchi facendo andare **più forte chi insegue**. Chiudere
> 200 s **richiede** un giro impossibile. Il pavimento lo vieta, e la compressione muore.

La terza forma è già scritta due volte nelle prereg del progetto e mai costruita: **far
rallentare il capofila invece di far accelerare gli inseguitori.** Non è un'ipotesi nuova,
è la consegna fisicamente corretta della **stessa identica legge già misurata**.

## 1 · Cosa ho guardato PRIMA di scrivere la forma, e perché non è un cancello

Ho misurato sul fondo (`legge_compressione.mjs`, 147 gare asciutte) la legge **per fascia
di distacco**, perché la forma dipende da quale legge è vera. È una misura **descrittiva
sull'ingresso**: il dato che il progetto già usa, guardato da vicino. Non c'è nessun esito
da validare — l'intervento non esiste ancora — e i cancelli qui sotto riguardano tutti
l'**esito**, che sarà calcolato dopo questo sigillo.

| gap (s) | 1–3 | 3–5 | 5–10 | 10–20 | 20–40 | **40–80** | 80–160 | 160+ |
|---|---|---|---|---|---|---|---|---|
| κ sotto SC | 0,80 | 0,71 | 0,78 | 0,72 | 0,63 | **0,42** | 0,71 | 0,96 |
| **recupero mediano** | 0,4 s | 1,1 s | 1,6 s | 4,2 s | 10,1 s | **32,5 s** | 31,8 s | 9,6 s |
| n | 306 | 299 | 614 | 1.095 | 698 | 249 | 275 | 46 |

Due cose, e sono le due che servono:

1. **La legge moltiplicativa regge** su tutta la scala fino a 160 s — κ resta fra 0,42 e
   0,80, non c'è una fascia in cui la compressione sparisce. Applicare κ a tutti i
   distacchi è legittimo.
2. **Il recupero in secondi SATURA** intorno ai 30 s per giro invece di crescere col
   distacco. È la firma esatta del meccanismo: **nessuno recupera più di quanto il primo
   perde**, e quanto il primo perde è una quantità da tempo-sul-giro, non da distacco.

Il secondo punto dice che la terza forma ha bisogno di un limite superiore quanto la
seconda ne aveva bisogno di uno inferiore. Il pavimento e il soffitto sono **la stessa
regola**: la compressione non può produrre un giro che nessuno ha mai fatto.

## 2 · La forma, dichiarata per intero

**Non cambia niente della legge.** Stesso κ dal sigillo, stesso perimetro (chi è ai box
questo giro non si comprime; se il capofila è ai box la compressione salta), stesso
bersaglio: `gap(k+1) = gap(k) · κ`.

Cambia **l'ancora**, cioè chi paga.

Sia `Δ²ᵢ` il credito che la seconda forma assegna oggi a ogni auto `i` (per il capofila,
zero per costruzione). Allora:

```
scarto  = min( 0 , min over i di Δ²ᵢ )        ← il credito del maggior beneficiario
Δ³ᵢ     = Δ²ᵢ − scarto                        ← per ogni auto compressa
Δ³capofila = −scarto                          ← il capofila paga il massimo
Δ³ai box   = −scarto                          ← chi è ai box paga come tutti (vedi sotto)
```

Le proprietà, che sono il punto:

- **`Δ³ᵢ ≥ 0` sempre.** Nessun giro si accorcia. I giri impossibili non tornano **per
  costruzione**, non per un vincolo che li taglia.
- **I distacchi si comprimono esattamente di κ**, identici alla seconda forma senza
  pavimento. È la stessa legge, consegnata dall'altro lato.
- **Il capofila paga di più, l'ultimo non paga niente.** È la fisica: sotto Safety Car il
  campo si compatta perché il primo rallenta.
- **I giri neutralizzati si allungano.** Il motore oggi gira ogni giro a passo verde, anche
  sotto Safety Car: la terza forma li rallenta, cioè si muove nel verso della realtà. **Non
  è un modello del passo neutralizzato e non va descritto come tale.**

**Chi è ai box paga come tutti, ed è una scelta dichiarata.** Il fattore di
neutralizzazione con cui il motore sconta una sosta sotto regime è misurato **rispetto al
campo** (`esporta_compressione_fondo.mjs`: perdita realizzata meno la mediana di chi non si
ferma). È una quantità **relativa**: rallentare tutti della stessa quantità la lascia
esatta. Escludere chi è ai box gli regalerebbe decine di secondi sopra allo sconto che ha
già — un doppio conteggio della famiglia E20.

## 3 · Il soffitto, gemello del pavimento

Nuovo file generato, `data/modelli/soffitti_2026.json`, prodotto da
`provenienza/genera_soffitti.mjs` **con lo stesso protocollo del pavimento**: dal grezzo
pinnato, attraverso l'unica definizione di regime (`provenienza/definizioni.mjs`), il
**giro più lento realmente percorso sotto neutralizzazione di campo** su quel circuito —
esclusi in-lap, out-lap e i giri di bandiera rossa (che contengono la sospensione e non
sono un giro).

La guardia nel kernel è il pavimento allo specchio, riga per riga:

- agisce **solo su un `Δ³` positivo** (un delta negativo non è tempo aggiunto);
- `Math.max(0, massimo)` — se il giro fosse già oltre il soffitto **prima**, il vincolo
  annulla l'aggiunta ma non toglie tempo che qualcuno ha perso;
- **il residuo resta nel distacco**: non si sposta e non si spalma. Al giro dopo c'è più
  distacco da comprimere.

Un circuito senza neutralizzazioni misurate **non ha soffitto** (`null`, non un valore di
ripiego — regola 6), esattamente come per il pavimento.

## 4 · I cancelli, dichiarati prima

Popolazione: le **11 gare 2026** del banco, tutti i piloti giocabili, con neutralizzazioni
vere, ritiri veri e piani rivali veri — lo stesso ingresso di laboratorio di tutta la serie.

### T1 · La larghezza del campo — **il cancello che i sei non avevano**

Per ogni gara, `L*` = ultimo giro che `regimePerGiroDiCampo` marca neutralizzato. La
larghezza `W(L)` è `max(cum) − min(cum)` fra le auto attive **sia** nel motore **sia** nella
realtà a quel giro.

Le gare si dividono con un criterio definito **sui soli dati veri**, quindi non spostabile
dopo: la realtà **compatta** se `W_vero(L₀−1) / W_vero(L*) ≥ 3`, con `L₀` primo giro della
finestra. Dall'autopsia sono **cinque**: Monaco · Gran Bretagna · Cina · Giappone · Miami.
Le altre sei non compattano.

| | |
|---|---|
| **T1a** · dove la realtà compatta | il rapporto `W_motore(L*) / W_vero(L*)` deve scendere **sotto 2,0 in almeno 3 gare su 5**, e in **tutte e 5** deve essere **strettamente migliore** della seconda forma (che fa 67,6 · 27,9 · 6,3 · 3,9 · 2,9 — cioè 0 su 5) |
| **T1b** · dove la realtà NON compatta | lo stesso rapporto **non deve superare 1,5** in nessuna delle sei. È il rischio speculare, ed è reale: senza il pavimento a fermarla, la compressione geometrica può **stringere il campo dove non c'era niente da stringere** |

### T2 · I giri impossibili non tornano

Su tutti i casi giocabili: **zero** giri sotto il pavimento del circuito e **zero** giri di
durata negativa. Il contatore `clampPavimento` deve valere **zero** — se il pavimento lega
anche una sola volta, la mia aritmetica dello scarto è sbagliata e va detto.

### T3 · E non ne nascono dall'altra parte

**Zero** giri sopra il soffitto del circuito. Si riporta inoltre **quante volte il soffitto
lega**: se legasse spesso, la terza forma sarebbe trattenuta dalla propria guardia e il
guadagno di T1 sarebbe merito del vincolo, non della forma. Sopra il **20% dei giri
compressi** il risultato si dichiara **trattenuto dal soffitto** e non si promuove.

### T4 · Il prodotto — **è questo che decide**

Errore di posizione alla bandiera contro la gara vera, sugli **stessi casi** per le due
forme (chi è saltato in una è saltato in entrambe). Test dei segni appaiato, IC95 bootstrap
a **blocchi = gare**, 2.000 ripetizioni, seme **20260815**.

| | |
|---|---|
| **non-inferiorità** (per il referto) | l'errore mediano non aumenta **e** il test dei segni non favorisce la seconda forma a p < 0,05 |
| **superiorità** (per accendere in produzione) | il test dei segni favorisce la terza forma a **p < 0,05** |

Sotto la non-inferiorità la terza forma **resta spenta**, il referto dice perché, e nessuno
ci costruisce sopra.

### T5 · Il placebo

La stessa identica terza forma applicata a giri **VERDI** scelti a caso, in numero uguale
ai neutralizzati veri di quella gara — 200 estrazioni, seme **20260815**, dentro ogni gara.
Tiene costante *quanto* tempo si aggiunge e muove solo *dove*. Il guadagno vero su T1a e su
T4 deve stare **fuori dal 95° percentile** delle finte. Se il placebo riproduce il
guadagno, l'effetto è «aggiungere tempo», non «compattare sotto Safety Car».

### T6 · È ancora la stessa legge

Invariante locale, sui giri compressi: `gap_dopo = gap_prima · κ` entro `1e-9`, per ogni
auta compressa e ogni giro compresso, **con la terza forma accesa**. È il cancello che
impedisce di aver riscritto la legge credendo di aver cambiato solo la consegna. È la
stessa forma locale che ha validato il pavimento (D3), e vale come sentinella.

## 5 · Cosa NON si fa, qualunque sia l'esito

- **Non si tocca κ**, né il perimetro, né la soglia di campo del 50%.
- **Non si spegne il pavimento.** Resta esattamente dov'è: con la terza forma non deve
  legare mai, e T2 lo verifica. Toglierlo rimetterebbe 5.815 giri impossibili.
- **Non si riapre il duello.**
- **Non si accende niente in produzione** senza la superiorità di T4. La terza forma nasce
  come opzione di laboratorio (`forma: 'leader'`), default invariato, numeri di produzione
  **bit-identici** a oggi finché un cancello non dice altro.
- **Non si sposta un cancello dopo averne visto l'esito.** T1b e T3 sono i due modi in cui
  questa forma può fallire in modo interessante: se falliscono si scrivono.

## 6 · Il limite che si dichiara adesso, non dopo

Il motore **non ha un modello del passo neutralizzato**: sotto Safety Car ogni giro è a
passo verde. La terza forma allunga quei giri come effetto della compressione, non perché
sappia quanto si va piano dietro la vettura di sicurezza. La bandiera **rossa** è
compressa col κ della Safety Car (`perGiroDaVera`, RED → SC): è un'approssimazione
dichiarata da prima e questa prereg non la migliora — a Monaco è probabilmente il motivo
per cui T1a resterà lontano dal vero anche riuscendo.

---

*Sigillo: committata prima di scrivere una riga del kernel e prima di calcolare un solo
esito. Nessun file del motore cambia in questo commit.*
