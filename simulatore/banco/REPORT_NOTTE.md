# REPORT NOTTE

Corsa del **2026-08-17T16:20:36.296Z** · confronto con la notte del **2026-08-08T15:02:46.871Z**.

## Esito: 🔴 REGRESSIONE

Motivi:

- sentinelle rotte: s15_banco_2026.mjs, s25_difesa.mjs, s36_report_notte_fresco.mjs
- cancello non passato — D1 la banda di rientro copre ed è minimale (leave-one-race-out) · 398 soste su 11 gare; falliti: PULITA, NEUTRA, PRODOTTO/NEUTRA
- cancello non passato — bias piatto entro 0.1 · 0.103028

## Suite

42/45 sentinelle verdi.

## Cancelli pre-registrati

| cancello | esito | dettaglio |
|---|---|---|
| G0″ quota di passaggio | 🟢 | 1 richiesto ≥ 1 (0 falliti) |
| M1 forma chiusa ⇔ ottimo esaustivo del kernel (casi ammessi) | 🟢 | 120/120 ammessi (24 al bordo, fuori cancello) |
| M1 la ricerca ristretta trova l'ottimo esaustivo | 🟢 | 144/144 |
| M1 il k della forma chiusa è il k che vince | 🟢 | 36/36 |
| M2 piano a una sosta identico allo scenario a una sosta | 🟢 | 60/60 |
| M3 ogni piano è approvato dal Director | 🟢 | 60/60 |
| M3 non è cieco: esistono piani OBBLIGATI a fermarsi | 🟢 | 33 obbligati, 33 con sosta (minimo 1) |
| M4 gli allarmi non cambiano il piano | 🟢 | 60/60 |
| D1 la banda di rientro copre ed è minimale (leave-one-race-out) | 🔴 | 398 soste su 11 gare; falliti: PULITA, NEUTRA, PRODOTTO/NEUTRA |
| D2 l'esito del contesto è coerente col numero di bande | 🟢 | contesto NON separa (p = 0.75262) → una banda per contesto di regime |
| D4 nessuna banda simmetrica nasconde un bias ≥ 1 posizione | 🟢 | asimmetrici e dichiarati tali: NEUTRA |
| bias: esiste almeno un orizzonte giudicabile | 🟢 | 2 orizzonti |
| bias &#124;H=5&#124; ≤ 0.17 | 🟢 | 0.123701 su 11 gare |
| bias &#124;H=10&#124; ≤ 0.17 | 🟢 | 0.020673 su 8 gare |
| bias piatto entro 0.1 | 🔴 | 0.103028 |
| rientro PULITA: mediana&#124;errore&#124; non peggiora di 0.25 | 🟢 | 0 contro linea 0 |
| rientro PULITA: quota entro ±1 non cala di 5 punti | 🟢 | 88.9% contro linea 88.9% |
| rientro SOSTE_RIVALI: mediana&#124;errore&#124; non peggiora di 0.25 | 🟢 | 0 contro linea 0 |
| rientro SOSTE_RIVALI: quota entro ±1 non cala di 5 punti | 🟢 | 75.2% contro linea 75.2% |
| rientro NEUTRA: mediana&#124;errore&#124; non peggiora di 0.25 | 🟢 | 1 contro linea 1 |
| rientro NEUTRA: quota entro ±1 non cala di 5 punti | 🟢 | 59.5% contro linea 59.5% |

## Misure

### Rientro sulle soste vere 2026, per secco

398 soste misurate, 61 scartate.

| secco | n | mediana &#124;errore&#124; | errore medio | entro ±1 | entro ±2 |
|---|---|---|---|---|---|
| PULITA | 36 | 0 | -0.5556 | 88.9% | 94.4% |
| SOSTE_RIVALI | 278 | 0 | +0.7086 | 75.2% | 87.4% |
| NEUTRA | 84 | 1 | +1.1429 | 59.5% | 77.4% |

Attesa di sanità dichiarata (`mediana|errore| PULITA <= mediana|errore| SOSTE_RIVALI`): **regge**.

Perdita ai box di ripiego (circuito non misurato dal prior): Giappone.

### G0″ — ottimo del banco contro forma chiusa

**799/799 = 100.00%** (interni 673, al bordo 126, esclusi 0).

G0′ è **ritirata** e resta a referto: 731/799 = 91.49% — bocciava la risposta corretta al bordo (E08).

### Bias sui tempi assoluti

| orizzonte | bias (s/giro) | gare | finestre | giudicabile |
|---|---|---|---|---|
| 5 | +0.123701 | 11 | 16 | sì |
| 10 | +0.020673 | 8 | 10 | sì |
| 20 | -0.208863 | 3 | 4 | **no** — non validato |

## Delta rispetto alla notte precedente

| voce | notte prima | stanotte | delta |
|---|---|---|---|
| rientro PULITA · mediana&#124;err&#124; | 0 | 0 | +0.0000 |
| rientro PULITA · entro ±1 | 88.9% | 88.9% | +0.0000 |
| rientro SOSTE_RIVALI · mediana&#124;err&#124; | 0 | 0 | +0.0000 |
| rientro SOSTE_RIVALI · entro ±1 | 75.2% | 75.2% | +0.0000 |
| rientro NEUTRA · mediana&#124;err&#124; | 1 | 1 | +0.0000 |
| rientro NEUTRA · entro ±1 | 59.5% | 59.5% | +0.0000 |
| G0″ quota di passaggio | 1 | 1 | +0.0000 |
| bias H=5 | 0.123701 | 0.123701 | +0.0000 |
| bias H=10 | 0.020673 | 0.020673 | +0.0000 |
| bias H=20 | -0.208863 | -0.208863 | +0.0000 |

---

Generato da `banco/notte.mjs`. Le soglie vengono da `banco/prereg/cancelli_banco.json`,
dichiarate in parole in `banco/prereg/PREREG_banco.md` e `banco/prereg/PREREG_G0_secondo.md`.
