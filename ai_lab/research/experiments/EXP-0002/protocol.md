# EXP-0002 — protocollo sperimentale

| campo | valore |
|---|---|
| esperimento | `EXP-0002` |
| tipo | identificazione_meccanismo |
| fenomeno | `FEN-non_classificabile-HARD` (non_classificabile) |
| creato | 2026-07-21 08:30:35 |
| versione motore | `sha256:d2bee2dca871` |
| sigillo prereg | `sha256:1b2aef0ed986d5b8` |
| dossier di origine | `AUD-AUSTRA-20260721-01`, `AUD-BELGIO-20260721-01`, `AUD-GRANBR-20260721-01`, `AUD-MIAMI-20260721-01`, `AUD-MONACO-20260721-01`, `AUD-SPAGNA-20260721-01` |

> Questo è un **protocollo**, non una relazione. Non modifica nulla: né il kernel, né i
> coefficienti, né i CSV. Descrive un esperimento che qualcun altro potrà eseguire.

## Motivazione — perché nasce adesso

lo stesso fenomeno e' stato osservato in 6 circuiti indipendenti (Australia, Belgio, Gran Bretagna, Miami, Monaco, Spagna), con segno concorde e effetto sopra il rumore locale in ciascuno, su 36 stint complessivi

**Non sarebbe nato con:** una sola gara: la soglia dichiarata e' >= 3 circuiti concordi e >= 20 stint. Un effetto grande su un solo circuito resta in-sample e non giustifica un esperimento

*Regola applicata:* `confidenza=alto AND circuiti>=3 AND stint>=20 AND effetto/rumore>1.0 in ogni osservazione utile`

*Evidenza:* 6 circuiti (Australia, Belgio, Gran Bretagna, Miami, Monaco, Spagna), 36 stint, rapporti effetto/rumore [1.87, 1.87, 2.17, 2.66, 4.72, 6.53]

## Obiettivo

Identificare quale meccanismo genera il residuo non spiegato su mescola HARD, oggi riproducibile ma senza causa attribuita.

## Ipotesi nulla (H0)

Il residuo non spiegato e' rumore: non si concentra su nessuna variabile misurata.

```json
{
  "parametro": "associazione_residuo_variabili",
  "valore_atteso": 0.0
}
```

## Ipotesi alternativa (H1)

Il residuo (+0.905 s/giro) si concentra su almeno una variabile misurata (eta' gomma, traffico, circuito, pilota, fase di gara).

```json
{
  "parametro": "associazione_residuo_variabili",
  "segno_atteso": "non nullo"
}
```

## Dataset richiesto

- anni: [2026] · sessione: Race · condizioni: asciutto (dry)
- mescola: **HARD** · stint di almeno **8 giri** puliti
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
| `pilota` | controllo | TI: campo drv |
| `fase_gara` | controllo | numero giro / n_giri |
| `neutralizzazioni` | controllo | contesto gara: giri neutralizzati |

## Campione minimo

**36 stint** su almeno **3 circuiti**.

soglia dichiarata (20 stint, 3 circuiti) e comunque non inferiore al supporto gia' osservato (36). Non e' un calcolo di potenza: e' una soglia dichiarata prima.

*rapporto effetto/rumore osservato: Australia=1.87, Belgio=2.66, Gran Bretagna=2.17, Miami=4.72, Monaco=1.87, Spagna=6.53*

## KPI

| KPI | definizione | unità | obiettivo |
|---|---|---|---|
| **QUOTA_SPIEGATA** | quota di varianza del residuo spiegata dalle variabili misurate | frazione | massimizzare |
| **BIAS** | media del residuo fuel-corretto sul campione | s/giro | tendere a 0 |
| **RMSE** | radice dell'errore quadratico medio del residuo | s/giro | diminuire |
| **LOCO** | leave-one-circuit-out: si riadatta escludendo un circuito e si valuta su quello escluso, a rotazione | quota di circuiti in cui il guadagno regge | reggere fuori campione |
| **NON_REGRESSIONE** | RMSE sulle altre mescole, che non deve peggiorare | s/giro | invariato o migliore |

## Criterio GO

- `QUOTA_SPIEGATA` >= 0.3 — almeno il 30% del residuo attribuito a una variabile misurata
- `LOCO` >= 0.67 — l'associazione regge su almeno 2 circuiti su 3

**Tutte** le condizioni GO devono valere insieme.

## Criterio NO-GO

- `QUOTA_SPIEGATA` < 0.3 — il residuo resta non attribuibile: il fenomeno torna in mappa come non_classificabile, con questo esperimento allegato

## Esito NULLO (né GO né NO-GO)

- campione sotto il minimo dichiarato

## Rischi

- **confondente traffico** — frazione di giri in traffico fino a 71% (Belgio): parte del residuo puo' essere aria sporca  
  *mitigazione:* stratificare per aria pulita/traffico e riportare i due gruppi
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
