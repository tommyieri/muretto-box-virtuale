# Pre-registrazione 3 — stessa definizione, arbitro completo

Scritta il 08/08/2026. `SOSTA_PREREG.md` e `SOSTA_PREREG2.md` restano com'erano.

## Cosa cambia e cosa NON cambia

**Non cambia la definizione.** D5 è identica a quella pre-registrata in `SOSTA_PREREG2.md`:

> Sosta al giro L per il pilota P ⟺ `compound[L+1] != compound[L]` **oppure**
> `tyre_age[L+1] < tyre_age[L]`, con entrambe le celle presenti; altrimenti **null**.

**Non cambiano le soglie**: 0,98 sull'unione, 0,95 come minimo per gara.

**Cambia l'arbitro**, e per un motivo dimostrato, non perché D5 stesse perdendo: f1db è
risultato **incompleto** sul 2026 — otto soste assenti, tutte e otto confermate da FastF1,
e per un pilota (Canada/BEA) l'elenco è vuoto benché l'auto sia passata ai box. Un metro con
dei buchi non può bocciare uno strumento.

## Il nuovo arbitro

**FastF1 `laps`: colonne `Compound` e `TyreLife`**, congelate in
`data/soste_fastf1_2026.json` da `gen_soste_fastf1.py` (così la sentinella gira in CI senza
rete).

È l'arbitro giusto per tre motivi:
1. **è indipendente dalla nostra fonte**: i dati gara del sito vengono da TracingInsights,
   questi dal feed FastF1. Due fornitori diversi che descrivono lo stesso pomeriggio;
2. **misura la stessa grandezza**: `TyreLife` e `Compound` dicono che set c'è sull'auto,
   che è esattamente ciò di cui parla la definizione — non «quanti pit stop», che era la
   domanda di f1db;
3. **è completo**: copre ogni giro di ogni pilota, non un elenco compilato a parte.

Sull'arbitro si applica **la stessa identica regola D5**. Non è un confronto fra una regola
e una lista: è la stessa domanda posta a due fornitori indipendenti.

## Cancello

Sull'unione delle 11 gare, D5-sul-nostro-dato contro D5-su-FastF1:

1. precisione ≥ 0,98 e richiamo ≥ 0,98;
2. nessuna singola gara sotto 0,95 su nessuna delle due;
3. nessun parametro per gara, nessuna eccezione scritta a mano.

Cosa lo fa fallire davvero: se la nostra catena TracingInsights avesse un difetto
sistematico su `compound`/`tyre_age` — per esempio il contatore che avanza senza cambio
gomma, o l'età che non riparte — i due fornitori divergerebbero e il cancello lo direbbe.
È anche, di fatto, una prova di integrità della nostra pipeline dati.

Se D5 non passa nemmeno qui, la vista stint **non si accende**.

---

## REFERTO (misurato 08/08/2026, `python3 test_sosta.py --arbitro`)

**D5 PROMOSSA.** Su 382 cambi gomma di riferimento, 11 gare:

| | valore | soglia |
|---|---|---|
| precisione | **1,0000** | ≥ 0,98 |
| richiamo | **1,0000** | ≥ 0,98 |
| peggiore gara | 1,000 | ≥ 0,95 |
| disaccordi | **0** | — |

Accordo esatto fra i due fornitori. Oltre a promuovere la definizione, il risultato dice
che la nostra catena TracingInsights → `demo/data/<Gara>.json` conserva `compound` e
`tyre_age` senza deformarli: se il contatore avanzasse dove non deve, o l'età non
ripartisse, i due si sarebbero separati.

### Limite dichiarato

Un accordo perfetto va guardato con sospetto. TracingInsights e FastF1 **non sono
indipendenti alla radice**: entrambi risalgono al feed di cronometraggio ufficiale. Quindi
questo cancello prova che **la nostra pipeline non deforma il dato**, non che il dato
originale sia vero. Per quest'ultima cosa non esiste, oggi, una terza fonte.

### Il cancello non basta come sentinella

Provato: cancellando la sosta di *Belgio/VER* (giro 17) dai nostri dati, il cancello
morbido resta **verde** — un disaccordo su 382 non intacca una soglia del 2%. La soglia
serviva a decidere se promuovere D5 senza sapere quanto avrebbe preso; ora si sa che
l'accordo è esatto, e ciò che va sorvegliato è quel valore. Per questo
`test_sosta.py --sentinella` esce 1 su **qualsiasi** disaccordo, ed è quella che gira in CI.
Verificato: col guasto iniettato esce 1, sul dato sano esce 0.

### Nota sui numeri, per chi leggerà

Tre conteggi diversi che dicono tre cose diverse, e non vanno confusi:
- **459** transiti in corsia (`in_lap`) — comprese le sfilate sotto SC e i rientri per rossa;
- **382** cambi gomma (D5) — la grandezza su cui si costruisce la vista stint;
- **364** pit stop di gara secondo f1db — che però ne perde otto, provate da FastF1.
