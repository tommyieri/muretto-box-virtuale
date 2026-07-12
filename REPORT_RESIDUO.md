# REPORT_RESIDUO — audit del residuo del motore sui pit reali

**Execution Delta = +0.56 s (k=1, IC95 [-1.26, +3.10]) -> NON ESISTE** (IC95 include zero per tutti i k; STOP al Test 1)
**Riduzione MAE fuori campione vs climatologia = N/D -> Test 2 NON eseguito (pre-registrato: solo se Test 1 passa)**

Metrica PRIMARIA per-pilota: residuo = cum reale a E - cum simulato a E (s), motore congelato chiamato dallo stato reale al freeze L=P-1 (pit all'in-lap P, endpoint E=P+k, pit-loss nominale creditata). Bootstrap a blocchi per gara, 10000 ricampionamenti, seed=20260711. Gare (blocchi): 9.

## Diagnostica appaiamento controllo (disinnesco falso positivo, rischio ii)

| k | freeze pit q10/50/90 | freeze ctrl q10/50/90 | MAE ctrl DENTRO pit-window | MAE ctrl FUORI | n dentro/fuori |
|---|---|---|---|---|---|
| 1 | 12/26/44 | 7/30/54 | 4.309 | 3.422 | 2226/3754 |
| 3 | 12/26/44 | 7/30/52 | 8.513 | 6.903 | 1888/3125 |
| 5 | 11/26/43 | 7/30/50 | 12.663 | 10.336 | 1599/2530 |

MAE controllo dentro vs fuori differisce >20% rel: **SI** -> controllo valido = **DENTRO la pit-window** (usato sotto).

## TEST 1 — Esistenza (metrica pre-registrata: MAE pit vs no-pit)

| k | MAE pit | MAE no-pit | diff MAE (s) | IC95 bootstrap | esito | n pit/ctrl |
|---|---|---|---|---|---|---|
| 1 | 4.865 | 4.309 | +0.556 | [-1.261, +3.097] | no (IC include 0) | 157/2226 |
| 3 | 6.581 | 8.513 | -1.933 | [-4.245, +1.525] | no (IC include 0) | 136/1888 |
| 5 | 8.455 | 12.663 | -4.208 | [-7.310, +0.688] | no (IC include 0) | 112/1599 |

### Distribuzione con SEGNO (mediana/IQR; + = reale piu' LENTO del motore)

| k | pit mean | pit mediana | pit IQR | no-pit mean | no-pit mediana | no-pit IQR | diff medie (s) | IC95 |
|---|---|---|---|---|---|---|---|---|
| 1 | +3.68 | +3.59 | [+0.90,+5.69] | +4.30 | +4.23 | [+3.19,+5.25] | -0.62 | [-3.14,+2.21] |
| 3 | +5.78 | +5.72 | [+2.92,+8.30] | +8.50 | +8.34 | [+6.14,+10.56] | -2.71 | [-5.59,+0.96] |
| 5 | +7.62 | +6.94 | [+3.88,+11.30] | +12.64 | +12.51 | [+8.96,+15.95] | -5.02 | [-8.56,+0.10] |

### Contaminazione di second'ordine (cambio del pilota davanti nella finestra)

| k | % pit con cambio-davanti | diff MAE escludendo i cambi | IC95 | esito |
|---|---|---|---|---|
| 1 | 81% | +0.806 | [-2.386, +5.208] | no |
| 3 | 74% | -1.545 | [-4.907, +3.481] | no |
| 5 | 67% | -4.462 | [-8.107, +1.508] | no |

## Lettura (interpretazione della misura, non re-litigazione del KPI)

- Entrambe le popolazioni hanno residuo con segno POSITIVO che cresce ~+2 s/giro: e' la
  deriva di BASE del kernel (pace piatta, non modella degrado/carburante), non un effetto-pit.
- Il residuo PIT e' MINORE del controllo (a k=5: mediana +6.9 vs +12.5): a gomme fresche
  post-pit il motore piatto sbaglia MENO. La diff con segno PUNTA negativa (k=5 ~-5s, IC95
  al limite dello zero) -> nessuna penalita' d'esecuzione positiva; se mai il contrario.
- Quindi NESSUN Execution Delta positivo: l'errore e' dominato dalla deriva degrado/
  carburante gia' nota come non modellabile, e i pit ne hanno di meno. STOP robusto.

## Limiti dichiarati

- 9 gare (blocchi bootstrap): potenza limitata, IC ampi (dichiarato).
- Contaminazione di second'ordine ALTA (67-81% di cambi del pilota davanti via TrafficModel);
  escludendoli il verdetto non cambia (resta no), ma il campione si assottiglia.
- Convenzione orizzonti dichiarata (freeze P-1, endpoint P+k, pit-loss nominale creditata).
- Controllo appaiato per fascia di giri (valido = DENTRO la pit-window). Metrica primaria
  per-pilota -> immune alla contaminazione del controllo via gap del rivale (rischio i).

## PASSO 4 — NON eseguito

Pre-registrato: la decomposizione si esegue SOLO se il Test 1 passa. Test 1 = STOP, quindi
nessun modello, nessuna decomposizione. `data/residuo_decomposizione.csv` non prodotto.
Nessun verdetto strategico: e' del PO.
