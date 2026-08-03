# PREREG_SESSIONE_I — pre-registrazione (incisa PRIMA dei numeri)

Branch `pitloss-due-componenti` (continuato su `claude/pitloss-due-componenti-283f8d`, che
ha mergiato la lineage G+H). **NON mergiare a main. Nessun modello nuovo. Nessuna sostituzione.**
Questo file e' committato PRIMA di eseguire `gen_pitloss_pooled.py`: il metodo, il campione e le
soglie sotto NON si toccano dopo aver visto i risultati. Soglie di verdetto **invariate da H**.

## Perche' e' una domanda nuova (non ri-litigazione di H)
H ha bocciato con NO, ma le due bocciature erano difetti di MISURA:
- **H1** (Spagna track_time −1,5): pit-loss verde gonfiato dal riferimento a **mediana-di-gara**
  (metodo C). Rimedio: riferimento **LOCALE** (ultimi giri verdi dello stesso stint prima del pit),
  gia' a gomma vecchia come l'in-lap → il bias di degrado e' **assorbito per costruzione**.
- **H2** (predizione SC): 9 gare 2026 danno solo 2 circuiti SC testabili. Rimedio: **pooling
  multi-stagione** (2023-2026).
Rimisurare pulito e su campione adeguato e' una calibrazione in-sample di un parametro esistente,
non un ri-tentativo sugli stessi dati.

## Metodo e campione — DICHIARATI PRIMA DEI NUMERI

**I0 — Ingestione + pooling (viene prima).**
- Durate per-stop f1db (Jolpica, come `gen_pitstop_durate.py` di G) per **tutte** le stagioni
  disponibili dei 9 circuiti (2023-2026), mappate per stagione via schedule → round.
  `pit_lane_time[c]` = mediana durata **pooled** (escludi > 60 s). Cache committata,
  writer deterministico (dati storici fissi → md5 stabile).
- Pooling stop: `ti_archive/{2023,2024,2025}` (TI grezzo, igiene gia' validata
  `pulisci`/`filtro_outlier`/aria-pulita) + 9 gare demo 2026 (`demo/data`, `demo/neutralizzazione.json`).
- Riporta n stop verdi e SC per circuito e stagione.

**I1 — Pit-loss verde, riferimento LOCALE (pre-registrato).**
`pit_loss_verde = (in + out) − 2·rif_locale − fuel`; `rif_locale` = mediana degli ultimi **5**
giri verdi dello **stesso stint** prima dell'in-lap, fuel-corretta con la formula del kernel
**3/70** (`fuel(lap,N) = max(0, 70 − 70/N·(lap−1))·3/70`). Se lo stint ha < 5 giri verdi usa i
disponibili (min 3); se < 3, **escludi lo stop e contalo**. **NESSUNA correzione di degrado
aggiuntiva** (assorbita dal riferimento locale — dichiarato). Il filone degrado resta chiuso.
`track_time = pit_lane_time − pit_loss_verde`.
- **Sensibilita' finestra 3/5/7** (test di FRAGILITA', non leva): se il segno di `track_time` di
  un circuito n ≥ 15 flippa fra 3/5/7 → **FRAGILE**, escluso come i piccoli campioni.
- **Spagna e' dichiarato debole ADESSO** (atteso fragile): se col campione grande e la
  sensibilita'-finestra resta ≈ 0 col segno che balla, va lasciato al nominale, non forzato dentro.

**I2 — R_lap dai lap times (pooled) + predizione SC.**
`R_lap_SC[c] = mediana giro SC / mediana giro verde`, dal campo, pooled (SC e VSC separati; giri
di deployment/restart esclusi: solo giri **strettamente** dentro la finestra). Osservato SC =
metodo campo-mediano dentro-finestra (come G), pooled, con **IC bootstrap a blocchi-(gara)**.
`pit_loss_SC_pred = pit_lane_time − track_time_verde · R_lap_SC`. Confronto con osservato **e**
con `0,42 · pit_loss_verde`.

## KPI PRE-REGISTRATI (soglie INVARIATE da H)
- **I0** — Eseguibilita'. Almeno **4** circuiti con **≥ 8** stop SC misurabili (pooled). Se meno →
  H2 non eseguibile: riporta H1 e chiudi. **Non abbassare l'8.**
- **I1** — Vincolo fisico (rif. locale, circuiti n_pooled ≥ 15):
  - **PASSA**: `track_time = pit_lane_time − pit_loss_verde ≥ 0` su TUTTI (non-fragili), e
    monotonicamente sensati.
  - **FALLISCE**: anche uno solo negativo (e non-FRAGILE) → **STOP**, nessuna proposta, chiudi.
  - I **FRAGILI** e i piccoli campioni sono esclusi e resteranno **NON corretti**.
- **I2** — Predizione SC (circuiti con SC misurabile, pooled):
  - **VALIDATO** ≤ 2,0 s su tutti · **SBAGLIATO** > 4,0 s anche su uno → STOP · **AMBIGUO** 2–4 →
    nessuna proposta.
  - Confronto obbligatorio col ratio 0,42: se il modello a componenti non lo batte, non serve.
- **I3** — Proposta solo se I1 PASSA **e** I2 VALIDATO. Altrimenti: **NO netto, si chiude.**

## Vincoli
- Non toccare kernel, modulo pit, gancio degrado, golden, e nessun file di produzione
  (`pit_loss_circuito_f1db.csv`, `sc_safety_car.csv`, `neutralization_model_2026.csv`).
  Si produce una **PROPOSTA**, non una sostituzione.
- Generatore committato. Golden verdi prima e dopo. Degrado usato solo come nota di assorbimento
  del bias, mai come predittore.

## Output attesi
`gen_pitloss_pooled.py` (committato), `data/pitloss_pooled_circuito.csv`, `data/rlap_pooled.csv`,
`REPORT_VALIDAZIONE_POOLED.md`. Se I1 fallisce o I2 non valida: scritto senza attenuazioni,
niente proposta, filone chiuso. Nessun verdetto strategico: e' del PO.

## Nota anti-inganno
Il rischio e' "sappiamo gia' che col riferimento locale H1 passa". Per questo metodo locale,
finestra (5), pooling e soglie sono fissati QUI, prima di rigirare; la sensibilita'-finestra e'
un test di fragilita', non una leva; Spagna e' nominato debole adesso. Se I2 resta SBAGLIATO su
un osservato ormai pulito, e' un NO definitivo: il modello e' giusto in principio ma non
calibrabile coi dati disponibili, e il debito si chiude li'.
