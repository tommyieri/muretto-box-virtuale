# Pre-registrazione — Protocollo ATT6 v2 con verdetto automatico (branch att6-v2-taratura)

Data: 16 luglio 2026. **Committato prima di qualsiasi numero.** Branch `att6-v2-taratura`,
nessun file di produzione toccato, nessuna attivazione. Il verdetto strategico resta del PO.

## Rapporto con PREREG_SESSIONE_ATT6_V2.md (su main)

Questo NON sostituisce la pre-registrazione del 14/07 (che nell'ADDENDUM 4 ha tolto il
verdetto automatico). È un **protocollo candidato**: qui viene definito, implementato
(`att6_v2.mjs`) e validato retroattivamente sui due casi storici. L'adozione — se e quando —
è una decisione del PO al checkpoint del merge. Se la validazione retroattiva viola anche
una sola attesa scritta sotto, il protocollo NON si adotta: la sorpresa è il risultato.

## Le due correzioni rispetto ad ATT6 v1

1. **Tipicità come gate** (corregge la lacuna Montreal: v1 giudicava un valore tipico
   contro una gara singola, anche anomala). Soglia: **2,0 s**.
2. **Selezione dei casi per sensibilità meccanica** (corregge la lacuna Silverstone/Montreal:
   v1 prendeva i primi 3 stop in ordine di giro, di cui tipicamente 2 insensibili — un solo
   caso decideva l'esito). Si selezionano i **5 stop più sensibili al parametro**, dove la
   sensibilità è misurata dal motore stesso, non dall'ordine cronologico.

E un terzo esito formale: **NON GIUDICABILE** (né PASSA né RESPINTO; il candidato aspetta).

## Il protocollo (implementato in att6_v2.mjs, exit code per verdetto)

Input: circuito, valore_vecchio, valore_nuovo, gara (demo 2026 o JSON storico FastF1
costruito con gli stessi adapter/pace del kernel, dove la demo manca).

**Passo 1 — TIPICITÀ.** Pit-loss mediano engine-ready della gara vs mediana del grappolo
storico 2018–2025 (dry) dello stesso circuito, dai generatori FF committati
(`data/pergara_stops.csv`, poi `data/engine_ready_stops.csv`) — stesso metodo per gara e
grappolo (ADDENDUM 1 del prereg 14/07, che resta valido).
Se |loss gara − mediana grappolo| > **2,0 s** → **NON GIUDICABILE (gara atipica)**, stop.

**Passo 2 — SENSIBILITÀ.** Stop validi = pit reali della gara demo, con esclusioni tutte
pre-verdetto: drive-through (tyre_age che non si azzera), stop con giro del pit in finestra
SC/VSC o flag `neutralized` del pilota al giro del pit, stop non simulabili secondo le
regole già in vigore nel modulo pit (nessun `pace` al freeze, ecc.).
Per ogni stop valido: `evaluatePit` con valore_vecchio e con valore_nuovo;
**sensibilità = |rientro_pos(vecchio) − rientro_pos(nuovo)|**.
Ordinamento deterministico: sensibilità decrescente, poi giro crescente, poi pilota
alfabetico. Si prendono i **top 5**.
Se gli stop con sensibilità ≥ 1 sono **< 3** → **NON GIUDICABILE PER INSENSIBILITÀ**, stop.

**Passo 3 — TABELLA.** Per i 5 casi selezionati: PRIMA (valore_vecchio) / ADESSO
(valore_nuovo) / REALE (rango a fine out-lap, soli dati reali); errore = |previsto − reale|;
esito per caso: MIGLIORATO (err scende) / PEGGIORATO (err sale) / INVARIATO.

**Passo 4 — VERDETTO.**
- ≥ 3 MIGLIORATI **e** 0 PEGGIORATI → **PASSA** (exit 0)
- ≥ 1 PEGGIORATO → **RESPINTO** (exit 1)
- gara atipica o banco insensibile → **NON GIUDICABILE** (exit 2)
- altrimenti → **NON CONCLUSIVO** (dichiarato, exit 3)

Errori d'uso/dati: exit 4. Lo script stampa tutto (tipicità, selezione, tabella, verdetto)
e scrive un JSON di report; non applica nulla.

## Validazione retroattiva — attese scritte PRIMA di eseguire

**T1 Silverstone 2026** (vecchio 29,12 = produzione pre-attivazione; nuovo 20,80 = valore
attivato): attesa **TIPICA → PASSA**. La tabella deve avere 5 casi (i 3 dell'ATT6 storica
più i nuovi entrati per sensibilità); nessun caso PEGGIORATO.

**T2 Montreal 2026** (vecchio 24,37 = produzione; nuovo 18,96 = candidato respinto da v1):
attesa **ATIPICA → NON GIUDICABILE** al Passo 1 (scarto già misurato ~4,5 s > 2,0 s).

Se un'attesa è violata: STOP, si riporta la violazione, il protocollo NON si adotta.
Se T2 conferma: si **annota** (non si riscrive) `NOTA_MONTREAL_NO_ATTIVAZIONE.md`:
il verdetto storico "respinto" diventa "gara non giudicabile" anche col protocollo v2
a verdetto automatico.

## T3 — Preparazione Spa (GP Belgio, 19/07/2026)

- Tipico di Spa e grappolo storico dai generatori FF committati (`engine_ready_stops.csv`:
  FF4 copre spa-francorchamps; dichiarare ampiezza del grappolo e stagioni dry usate).
- Intervallo di giudicabilità esplicito per la gara del 19: **[tipico − 2,0; tipico + 2,0]**.
- Dry-run end-to-end dello script su una gara storica di Spa (JSON costruito da FastF1 con
  gli stessi adapter e pace del kernel via `export_demo.export_gara(raw=...)`). Il dry-run
  valida la MECCANICA, non decide nulla: i valori vecchio/nuovo usati sono strumentali.
  Nota dichiarata: nel dry-run storico la gara appartiene al grappolo 2018–2025 (tipicità
  parzialmente in-sample); per la gara vera del 19/07 (stagione 2026) il problema non esiste.
- `SPA_DOMENICA.md`: checklist operativa per il 19 sera.

## Cosa questo commit NON fa

Nessun numero nuovo calcolato. Nessun file di produzione toccato (kernel, modulo pit,
gancio, golden, `demo/data/*`, `demo/att6.mjs` intatti). Nessuna attivazione, nessun merge.
