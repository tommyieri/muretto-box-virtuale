# EXP-0003 — protocollo sperimentale

| campo | valore |
|---|---|
| esperimento | `EXP-0003` |
| tipo | verifica_sistematica |
| fenomeno | `FEN-degrado-MEDIUM` (degrado) |
| creato | 2026-07-21 08:30:35 |
| versione motore | `sha256:d2bee2dca871` |
| sigillo prereg | `sha256:a5af4c2178f30568` |
| dossier di origine | `AUD-AUSTRA-20260721-01`, `AUD-BELGIO-20260721-01`, `AUD-GRANBR-20260721-01`, `AUD-MIAMI-20260721-01`, `AUD-MONACO-20260721-01`, `AUD-SPAGNA-20260721-01` |

> Questo è un **protocollo**, non una relazione. Non modifica nulla: né il kernel, né i
> coefficienti, né i CSV. Descrive un esperimento che qualcun altro potrà eseguire.

## Motivazione — perché nasce adesso

lo stesso fenomeno e' stato osservato in 4 circuiti indipendenti (Belgio, Gran Bretagna, Miami, Spagna), con segno concorde e effetto sopra il rumore locale in ciascuno, su 31 stint complessivi

**Non sarebbe nato con:** una sola gara: la soglia dichiarata e' >= 3 circuiti concordi e >= 20 stint. Un effetto grande su un solo circuito resta in-sample e non giustifica un esperimento

*Regola applicata:* `confidenza=alto AND circuiti>=3 AND stint>=20 AND effetto/rumore>1.0 in ogni osservazione utile`

*Evidenza:* 4 circuiti (Belgio, Gran Bretagna, Miami, Spagna), 31 stint, rapporti effetto/rumore [1.39, 1.59, 2.53, 6.7]

## Obiettivo

Verificare se il degrado su mescola MEDIUM e' sistematicamente SOTTOSTIMATO dal motore.

## Ipotesi nulla (H0)

Il modello e' corretto: il residuo fuel-corretto su MEDIUM e' centrato a zero e non dipende dall'eta' gomma (pendenza = 0).

```json
{
  "parametro": "pendenza_residuo_vs_eta_gomma",
  "valore_atteso": 0.0,
  "e_anche": {
    "parametro": "bias_residuo",
    "valore_atteso": 0.0
  }
}
```

## Ipotesi alternativa (H1)

Il modello sottostima: il residuo cresce con l'eta' gomma (pendenza mediana osservata +0.0954 s/giro) e il bias mediano e' +0.584 s/giro su 6 circuiti.

```json
{
  "parametro": "pendenza_residuo_vs_eta_gomma",
  "valore_osservato": 0.0954,
  "segno_atteso": "positivo"
}
```

## Dataset richiesto

- anni: [2026] · sessione: Race · condizioni: asciutto (dry)
- mescola: **MEDIUM** · stint di almeno **8 giri** puliti
- circuiti nel campione: Australia, Belgio, Gran Bretagna, Miami, Monaco, Spagna
- circuiti disponibili non ancora usati: Austria, Canada, Cina, Giappone
- igiene: F1-F6 pulisci() + F7 filtro_outlier(1.07), importati da test_identificabilita_degrado — gli stessi dell'Auditor
- esclusioni: giri neutralizzati (status SC/VSC); in-lap e out-lap; mescole non slick; giri con eta' gomma < 3
- spazio di confronto: fuel-corretto secondo engine.FUEL_COEFF: il kernel lavora a serbatoio vuoto e non re-inflaziona il carburante

Fonti risolte:

- `Australia` → `data/ti_cache/Australian.json`
- `Belgio` → `data/ti_archive/2026/Belgian Grand Prix/Race.json`
- `Gran Bretagna` → `data/ti_archive/2026/British Grand Prix/Race.json`
- `Miami` → `data/ti_cache/Miami.json`
- `Monaco` → `data/ti_cache/Monaco.json`
- `Spagna` → `data/ti_cache/Barcelona.json`

## Variabili

| variabile | ruolo | fonte |
|---|---|---|
| `compound` | condizione | TI: campo compound |
| `tyre_age` | regressore | TI: campo life |
| `fuel_corrected_pace` | risposta | calcolata con engine.FUEL_COEFF, come in engine.pace_base |
| `aria_pulita` | stratificazione | gap all'auto davanti > 2.0 s (stessa soglia di gen_replay_perdita_stint) |
| `traffico` | confondente | gap all'auto davanti < 2.0 s |
| `circuito` | blocco per LOCO | gara |

## Campione minimo

**31 stint** su almeno **3 circuiti**.

soglia dichiarata (20 stint, 3 circuiti) e comunque non inferiore al supporto gia' osservato (31). Non e' un calcolo di potenza: e' una soglia dichiarata prima.

*rapporto effetto/rumore osservato: Australia=0.63, Belgio=1.39, Gran Bretagna=2.53, Miami=1.59, Monaco=0.73, Spagna=6.7*

## KPI

| KPI | definizione | unità | obiettivo |
|---|---|---|---|
| **BIAS** | media del residuo fuel-corretto sul campione | s/giro | tendere a 0 |
| **RMSE** | radice dell'errore quadratico medio del residuo | s/giro | diminuire |
| **LOCO** | leave-one-circuit-out: si riadatta escludendo un circuito e si valuta su quello escluso, a rotazione | quota di circuiti in cui il guadagno regge | reggere fuori campione |
| **NON_REGRESSIONE** | RMSE sulle altre mescole, che non deve peggiorare | s/giro | invariato o migliore |

## Criterio GO

- `BIAS` riduzione_assoluta >= 0.5 — |bias| almeno dimezzato
- `RMSE` < RMSE_pre — l'errore complessivo migliora
- `LOCO` >= 0.67 — il guadagno regge su almeno 2 circuiti su 3 tenuti fuori
- `NON_REGRESSIONE` peggioramento <= 0.05 — nessuna altra mescola peggiora oltre il 5%

**Tutte** le condizioni GO devono valere insieme.

## Criterio NO-GO

- `RMSE` >= RMSE_pre — nessun miglioramento
- `LOCO` < 0.67 — il guadagno esiste solo in campione: overfitting

## Esito NULLO (né GO né NO-GO)

- campione sotto il minimo dichiarato: esito NON GIUDICABILE, non NO-GO

## Rischi

- **residuo non spiegato sulla stessa mescola** — su MEDIUM esiste anche FEN-non_classificabile-MEDIUM (+0.554 s/giro, confidenza contesa): parte dell'effetto qui attribuito potrebbe essere quello  
  *mitigazione:* riportare i due gruppi separatamente, non sommarli
- **neutralizzazioni in gara** — tutte le gare del campione contengono giri neutralizzati  
  *mitigazione:* i giri neutralizzati sono gia' esclusi dal filtro F1: verificare che l'esclusione regga anche nel Runner
- **overfitting** — qualunque parametro aggiunto migliora il fit in campione  
  *mitigazione:* il KPI decisivo e' leave-one-circuit-out, non l'RMSE in campione
- **circolarita' in-sample** — le gare del campione sono le stesse che alimentano i coefficienti del progetto  
  *mitigazione:* nessuna conclusione senza il passaggio LOCO

## Vincoli

- l'esperimento NON modifica il kernel: qualunque adattamento e' fuori dal motore
- nessun coefficiente in produzione cambia senza ratifica umana
- esito NULLO ammesso: campione insufficiente non e' NO-GO
- il prereg e' sigillato: ipotesi e soglie non si toccano dopo i numeri

## Ciclo di vita

```
CREATO → APPROVATO → ESEGUITO → VALIDATO → GO | NO_GO
```

Questo protocollo nasce **CREATO**. L'approvazione è un atto umano: il Designer non si auto-approva. L'esecuzione spetta all'Experiment Runner.
