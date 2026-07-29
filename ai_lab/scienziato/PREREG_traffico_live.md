# PREREG — la composizione: intensità × durata. E il patto che chiude.

Quarto giro dell'**agente autonomo**. Branch `ai-lab/autonomo-traffico-live`, 21/07/2026.
Scritto **prima** di misurare. **Ultima notte sul traffico prima del live.**

## 0. Perché quattro forme sono state bocciate

Le quattro forme provate (M1, M2 col delta-passo; Mp, Mfull con la pista) erano tutte
**additive**: termini che *competono* col gap nello spiegare il tempo perso **per giro**.
Hanno perso tutte.

Ma gap e delta-passo non competono: sono **due meccanismi diversi**.

- il **gap** dice **quanto** perdi ogni giro che sei attaccato → *intensità*;
- il **delta-passo** dice **per quanti giri** ci resti prima di passare → *durata*.

Sommarli è la forma sbagliata. Vanno **composti**. Nessuna delle quattro forme bocciate era
questa, e il bersaglio del confronto era sbagliato di conseguenza: l'errore *per giro* non
può vedere la durata.

## 1. Il bersaglio cambia: il COSTO TOTALE dell'incontro

**Incontro**: giri consecutivi con gap ≤ 1,5 s dallo **stesso** leader — la stessa
definizione sotto la quale la U rovesciata è stata verificata la notte scorsa. Non la
cambio: cambiarla ora sarebbe pescare.

**Costo totale** `C = Σ r` sui giri dell'incontro, con `r = tempo osservato − passo pulito`.
È quello che il traffico infliggé davvero: due incontri con la stessa intensità per giro ma
durata diversa costano diverso, **e il solo-gap non lo sa**.

**Predittivo per costruzione**: all'inizio di un incontro si conoscono solo `g0` (il gap al
primo giro) e `Δ` (il delta-passo). Entrambi i modelli usano solo quelli. Nessuno dei due
vede la durata realizzata: sarebbe barare, e in live non la si ha.

## 2. Le forme, dichiarate ora

`i(g) = a·e^(−g/λ)` — l'intensità per giro, **imbattuta su due notti**, parametri globali
dalla calibrazione.
`D(Δ)` — la durata attesa, funzione a gradini sulle **stesse fasce di Δ** già dichiarate e
validate la notte scorsa, stimata sulle gare di calibrazione (media, non mediana: il costo
è additivo, e la media è il funzionale giusto per una somma).

| | forma | che cosa incarna |
|---|---|---|
| **C0 — solo gap** | `D̄ · i(g0)` | intensità dal gap, **durata costante** (la media globale): è il modello attuale, che la durata non la sa |
| **C1 — composizione** | `D(Δ) · i(g0)` | intensità dal gap **integrata sulla durata governata dal delta-passo** |
| **C2 — composizione scalata** | `κ · D(Δ) · i(g0)` | come C1, con un fattore di scala unico stimato in calibrazione |

**Tre forme, non una di più.** La barra si applica a ciascuna. Qualunque forma vinca
in-sample ma non fuori campione è **dichiarata rumore**.

## 3. Il placebo, obbligatorio (e senza null nuovi)

Il rischio è quello che mi ha salvato la prima notte: `C = Σ r` contiene `−n·passo(chi
segue)` e `Δ` contiene `+passo(chi segue)`. **Un errore di stima del passo entra nei due
con segno opposto e fabbrica il segno cercato.**

**Placebo**: `traffico.placebo_leader` — **già sotto sigillo**, chiamata e non modificata.
Sostituisce il leader con un'auto a caso dello stesso giro: `Δ` diventa sbagliato, il passo
di chi segue resta lo stesso. Se la composizione vince anche col leader finto, **è
artefatto e la scoperta è annullata**.

**Nessun null nuovo stanotte**: gli otto sigilli restano otto.

## 4. La barra, derivata dai dati prima di misurare

Fuori campione: gare di indice pari = calibrazione, dispari = verifica.
Metrica: **errore assoluto mediano sul costo totale**, per gara (blocco), aggregato con
`scheletro.bootstrap_a_blocchi` (**sigillata, chiamata e non modificata**).

> Una forma sopravvive solo se il **miglioramento della mediana per gara sulle gare di
> verifica** supera **M = semi-ampiezza dell'IC95 bootstrap-a-blocchi di C0** sulle stesse
> gare, **e** l'IC95 del miglioramento appaiato per gara esclude lo zero.

## 5. IL PATTO — vincolante, dichiarato ora

**Comunque vada, stanotte si chiude e un traffico va live.** Due esiti, entrambi montabili:

- **se C1 (o C2) batte C0 con margine netto** → va live la **composizione**: gap per
  l'intensità, delta-passo per la durata;
- **se non lo batte** → la risposta è che il traffico **È** solo-gap per l'intensità, e va
  live la **forma minima**: `i(g)` per giro, col delta-passo che governa **quando
  l'incontro finisce**. La semplicità vince e va live lo stesso.

**Non è ammesso l'esito «serve un'altra notte».**

## 6. La validazione per il live (barra «utile», non «perfetto»)

Qualunque forma vada live deve superare:

1. **batte il traffico-zero** (il modello che ignora il traffico, `C = 0`) sul costo totale,
   fuori campione;
2. **il test della McLaren**: auto molto più veloce dietro una lenta (`Δ < −0,8`) →
   il modello deve predire **costo basso**. Se lo rompe, **non va live** nemmeno con una X
   buona;
3. **targhetta su ogni coefficiente**;
4. **cieco 2026 dichiarato**: Spearman(θ storico, θ 2026) = −0,024 — il 2026 sul sorpasso è
   scorrelato dal passato. Il modello live **nasce sul regime storico**; il 2026 si rafforza
   con l'uso.

## 7. Il limite onesto, che va nella documentazione del modello live

**Si calcola solo contro il campo reale.** Le altre auto non rallentano perché sei lì, non
si difendono, non cambiano strategia. Il modello dice *«Leclerc diverso dentro la gara che È
successa»*, non *«la gara che SAREBBE successa»*. Ora che qualcuno lo userà davvero, questo
sta scritto **dentro il modello**, non solo in un report.

## 8. Vincoli

Solo il fondo · blocchi = incontri/gare · aggancio nel kernel **opzionale e spento di
default**, golden bit-identico dove non deve cambiare · nessun null nuovo · targhetta su
ogni numero · nessun push, PR, merge: il go-live lo decide Tommi.
