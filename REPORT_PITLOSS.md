# REPORT_PITLOSS — il pit-loss nominale coincide col reale? (misura pura)

Verdetto: **MISCALIBRATO** — circuiti fuori soglia (|Δ|>1,0 s): 7/9
Forma dell'errore: **nessuna legge pulita (errore per-circuito ~1.7s; tendenza compressione corr -0.70)** (corr Δ-nominale = -0.70; additivo Δ≈+0.24s |res|=3.04s; con intercetta reale≈+31.1-0.30×nominale |res|=1.67s)

Soglie PRE-REGISTRATE: CALIBRATO |Δ|<=1,0 su tutti; MISCALIBRATO |Δ|>1,0 su >=3; AMBIGUO 1-2 fuori. Calibrazione IN-SAMPLE legittima (parametro per-circuito, nessuna predizione fuori campione: E3 resta NO-GO).

## C1 — Metodo (dichiarato prima dei risultati)

pit_loss_reale = (in-lap + out-lap) - (rif(P)+rif(P+1)); rif = passo verde del pilota
fuel-corretto (mediana giri verdi di [lap_time - fuel_mass·3/70]) riportato al carburante
del giro. L'OUT-LAP INCLUDE il warm-in gomma: dichiarato, NON corretto (e' cio' che si
vuole vedere). Penalita'/problemi tecnici non nel formato dati -> non escludibili (limite).

## C2 — Esclusioni (dichiarate)

Escluse e contate (unione fonti neutralizzazione flag∪json, come A-ter): neutralizzato=161, edge=6, doppio=19, no_out=15, no_time=0, ref_scarso=0.

## C3 — Confronto per circuito (ordinato per |Δ|)

| gara | cid | n stop | reale (mediana) | IQR | nominale f1db | Δ = reale-nominale |
|---|---|---|---|---|---|---|
| Cina | shanghai | 6 ⚠ | 32.62 | [28.07,39.5] | 22.97 | +9.65 |
| Gran Bretagna | silverstone | 23 | 20.9 | [19.9,26.13] | 29.12 | -8.22 |
| Australia | melbourne | 9 | 25.17 | [21.61,29.05] | 18.15 | +7.02 |
| Miami | miami | 19 | 19.51 | [18.05,19.74] | 22.63 | -3.12 |
| Canada | montreal | 16 | 27.33 | [23.99,32.8] | 24.37 | +2.96 |
| Monaco | monaco | 19 | 22.0 | [20.34,24.53] | 24.8 | -2.80 |
| Spagna | catalunya | 40 | 24.37 | [22.88,25.26] | 22.38 | +1.99 |
| Giappone | suzuka | 10 | 23.32 | [22.51,24.01] | 23.72 | -0.40 |
| Austria | spielberg | 33 | 21.87 | [21.0,22.29] | 21.63 | +0.24 |

⚠ = sotto 8 stop validi (mediana poco affidabile).

## C4 — Struttura dell'errore

- Δ correla col nominale: r = **-0.70** (riproduce il -0,76 di A-ter: alto nominale -> Δ negativo = compressione).
- Additivo (Δ≈cost +0.24s): |res| 3.04s. Con intercetta (reale≈+31.1-0.30×nominale, pendenza b=-0.30<1 = nominale sovra-disperso): |res| 1.67s. -> **nessuna legge pulita (errore per-circuito ~1.7s; tendenza compressione corr -0.70)**. I residui ~3s dicono che nessuna legge pulita descrive i dati: l'errore e' in
  gran parte PER-CIRCUITO, non una scala unica.
- LATO ROBUSTO (circuiti con n>=15 stop, immuni al limite del metodo): Gran Bretagna Δ-8.2, Miami Δ-3.1, Canada Δ+3.0, Monaco Δ-2.8, Spagna Δ+2.0, Austria Δ+0.2. Di questi 5/6 fuori soglia -> il verdetto MISCALIBRATO regge
  anche escludendo i Δ positivi a piccolo campione (Cina n=6, Australia n=9): possibile
  artefatto di metodo (in-lap su gomma vecchia gonfia il Δ positivo).
- Gran Bretagna (nominale 29,12): misura diretta = **20.9 s** (Δ -8.22), n=23, IQR [19.9,26.13] (anche il 75° pctile < nominale). E' l'outlier che A-ter suggeriva, confermato da due metodi indipendenti.
- Provenienza f1db: `pit_loss_circuito_f1db.csv` e' una tabella ESTERNA ingerita (colonna
  `n`=stop nel campione f1db), usata da `pipeline_gara.py`/modulo pit. NESSUNO script
  committato la calcola -> non c'e' trasformazione verificabile. Esiste un SECONDO file
  committato `pit_loss_circuito.csv` con valori sistematicamente PIU' BASSI (es. Silverstone
  25,4 vs 29,12): i due discordano (debito P1). Non e' determinabile da quale campo f1db
  esca il valore ne' se sia durata-stop vs pit-loss-totale senza la fonte esterna; ma la
  misura diretta mostra che il valore f1db in produzione NON coincide con la perdita reale.

## C5 — Anomalia warm-in (da A-ter, diagnosi non correzione)

warmin_prior.csv (giro_stint 0 = out-lap): SOFT +0.091, MEDIUM +0.333, HARD -0.162 s.
- SEGNO: SOFT/MEDIUM positivi, HARD negativo (-0,162). Il valore HARD negativo NON e'
  fisicamente sospetto: e' il valore MISURATO dal progetto (warmin_prior.csv, HARD ~-0,12/
  -0,20 s), coerente col fatto che la gomma dura scalda diversamente. Correzione al commento
  precedente: non c'e' anomalia di segno da spiegare.
- DOPPIO CONTEGGIO: il warm-in e' GIA' dentro l'out-lap reale, quindi gia' dentro il
  pit_loss_reale (C1) e dentro il residuo pit di A-ter. In E3 aggiungere warmin_prior come
  FEATURE lo conta una seconda volta -> peggiora la
  predizione del 12,4%. Non e' un prior rotto: e' una variabile ridondante rispetto a un
  segnale gia' presente nel target. Diagnosi, non correzione.

Nessun verdetto strategico (sostituire il file, ricalibrare): e' del PO. NON si sostituisce
pit_loss_circuito_f1db.csv in questa sessione.
