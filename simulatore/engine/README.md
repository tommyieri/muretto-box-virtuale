# 📐 Physics Lab — runtime (`engine/`, JavaScript `.mjs`)

Il kernel di simulazione: UNICA implementazione (regola 8), consuma i JSON con
targhetta prodotti da `fisica/`. Stessa equazione per misura e predizione
(regola 10, E02). L'assenza è null: un pilota senza passo esce con null
esplicito, mai con un numero plausibile (regola 6, E06).

`kernel.mjs`:
- `simulate({ state, pace, freezeLap, steps, pits })` → `{ cum, eta, ordine, ordineIniziale, esclusi }`, un giro alla volta. `cum[pilota]` è un numero **o null esplicito**, mai una somma parziale.
- `pace(pilota, giro, età) → secondi | null` arriva da fuori: il modello del tempo sul giro NON è nel kernel (PROMPT 03), così misura e predizione condividono l'equazione per costruzione.
- `pits: { pilota: [{ lap, perdita }] }` — la perdita è dichiarata da chi chiama, applicata intera sul giro della sosta (la stessa convenzione con cui il prior la misura: nessuna quota sull'out-lap, E20). La sosta azzera l'età, non regala gradini perpetui (E01).
- `statoAlCongelamento(righe, freezeLap)` — ponte dai record di Provenienza; legge solo il giro Lf, quindi è invariante al troncamento (regola 5, sentinella s11).
- **Niente cap del traffico**: due auto possono attraversarsi. Si riproduce QUANTI cambi di posizione (`cambiDiPosizione`), non QUALI (E16).

`passo_v2.mjs` — l'unica implementazione dell'equazione:
`t = base + δ·(giro−1) + ρ·età`, con `δ = −δ₇₀/N_giri`. `stimaBasi` misura la
base togliendo **gli stessi** termini che `creaPasso` ri-aggiunge: è la regola
10 scritta in due funzioni adiacenti, ed è ciò che rende impossibile ripetere i
due pezzi del bias vecchio (carburante mai ri-aggiunto −1,480 s/giro, E02;
base misurata su gomma più giovane dei giri simulati −0,403 s/giro).
Coefficienti da `data/modelli/modello_v2.json`, mai cablati qui.

Cancelli: `s09` (golden dichiarati), `s10` (guardie rumorose), `s11`
(invarianza al troncamento), `s12` (ottimo analitico a `(giri rimasti − età)/2`,
esatto e indipendente da pit-loss e δ), `s13` (targhetta del modello e δ
coerente con l'esperimento). Provati per mutazione: togliere l'azzeramento
dell'età, restituire un cum parziale, rimuovere la guardia E14, cablare una
penalità da traffico, non pagare la perdita, cablare un δ diverso da quello
deciso o mutilare la targhetta fanno fallire la sentinella che li sorveglia.
Senza l'azzeramento dell'età, in particolare, l'ottimo interno sparisce del
tutto: tutti i giri di sosta pareggiano (E01, in forma pura).

**Orizzonte validato: 5 e 10 giri.** A 20 giri il modello non è validato (bias
−0,29 s/giro su sole 3 gare): vedi `limiti_dichiarati` nel modello.
