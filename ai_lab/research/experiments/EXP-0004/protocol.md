# EXP-0004 — protocollo sperimentale

| campo | valore |
|---|---|
| esperimento | `EXP-0004` |
| tipo | disambiguazione |
| fenomeno | `FEN-non_classificabile-MEDIUM` (non_classificabile) |
| creato | 2026-07-21 08:30:35 |
| versione motore | `sha256:d2bee2dca871` |
| sigillo prereg | `sha256:3ef634d8ef89d334` |
| dossier di origine | `AUD-AUSTRA-20260721-01`, `AUD-BELGIO-20260721-01`, `AUD-GRANBR-20260721-01`, `AUD-MIAMI-20260721-01`, `AUD-MONACO-20260721-01`, `AUD-SPAGNA-20260721-01` |

> Questo è un **protocollo**, non una relazione. Non modifica nulla: né il kernel, né i
> coefficienti, né i CSV. Descrive un esperimento che qualcun altro potrà eseguire.

## Motivazione — perché nasce adesso

lo stesso fenomeno mostra segno OPPOSTO fra circuiti (Australia, Belgio, Gran Bretagna, Miami, Monaco, Spagna): il conflitto e' una domanda aperta, non un dettaglio da mediare

**Non sarebbe nato con:** osservazioni tutte concordi, che non pongono domande

*Regola applicata:* `confidenza = contesa (segni discordi sopra il rumore)`

## Obiettivo

Spiegare perche' il fenomeno su mescola MEDIUM cambia SEGNO fra circuiti.

## Ipotesi nulla (H0)

Il segno opposto e' rumore campionario: i circuiti non differiscono davvero.

```json
{
  "parametro": "differenza_fra_circuiti",
  "valore_atteso": 0.0
}
```

## Ipotesi alternativa (H1)

Il segno dipende da una caratteristica del circuito (difficolta' di sorpasso, lunghezza, neutralizzazioni) e non e' rumore.

```json
{
  "parametro": "differenza_fra_circuiti",
  "segno_atteso": "non nullo"
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
| `pilota` | controllo | TI: campo drv |
| `fase_gara` | controllo | numero giro / n_giri |
| `neutralizzazioni` | controllo | contesto gara: giri neutralizzati |

## Campione minimo

**46 stint** su almeno **3 circuiti**.

soglia dichiarata (20 stint, 3 circuiti) e comunque non inferiore al supporto gia' osservato (46). Non e' un calcolo di potenza: e' una soglia dichiarata prima.

*rapporto effetto/rumore osservato: Australia=2.74, Belgio=1.32, Gran Bretagna=1.93, Miami=2.58, Monaco=0.44, Spagna=7.55*

## KPI

| KPI | definizione | unità | obiettivo |
|---|---|---|---|
| **SEPARAZIONE_CIRCUITI** | differenza fra gruppi di circuiti, con intervallo di confidenza: attraversa lo zero oppure no | s/giro | stabilire se la differenza e' reale |
| **BIAS** | media del residuo fuel-corretto sul campione | s/giro | tendere a 0 |
| **RMSE** | radice dell'errore quadratico medio del residuo | s/giro | diminuire |
| **LOCO** | leave-one-circuit-out: si riadatta escludendo un circuito e si valuta su quello escluso, a rotazione | quota di circuiti in cui il guadagno regge | reggere fuori campione |
| **NON_REGRESSIONE** | RMSE sulle altre mescole, che non deve peggiorare | s/giro | invariato o migliore |

## Criterio GO

- `SEPARAZIONE_CIRCUITI` IC_non_attraversa_zero 0.95 — la differenza fra circuiti e' reale al 95%

**Tutte** le condizioni GO devono valere insieme.

## Criterio NO-GO

- `SEPARAZIONE_CIRCUITI` IC_attraversa_zero 0.95 — il segno opposto e' compatibile col rumore: il conflitto si chiude come artefatto

## Esito NULLO (né GO né NO-GO)

- campione sotto il minimo dichiarato

## Rischi

- **confondente traffico** — frazione di giri in traffico fino a 80% (Belgio): parte del residuo puo' essere aria sporca  
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
