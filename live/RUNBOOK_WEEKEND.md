# RUNBOOK — weekend di GP (collettore + mappa live)

Comandi esatti, in ordine. Ruoli: **VPS** = collettore OpenF1 + WebSocket
(`ws.murettobox.com`), **Mac** = registrazione SignalR di backup +
generazione asset del circuito nuovo. Il replay e' l'ambiente di collaudo:
`?ws=ws://127.0.0.1:8765` sulla pagina live per provare in locale.

## Una tantum (prima del primo weekend)

- **DNS**: record `A ws.murettobox.com -> 167.233.236.186` (il wildcard
  attuale punta a Vercel: serve il record esplicito). Caddy ottiene il
  certificato da solo appena il DNS risolve; verifica:
  `curl -s https://ws.murettobox.com/status | python3 -m json.tool`

## Mercoledi/giovedi — controlli

```bash
# collettore vivo e token OpenF1 valido (rinnovo automatico):
curl -s https://ws.murettobox.com/status | python3 -m json.tool
#   -> connesso: true, openf1_token.valido: true

# log recenti:
ssh muretto@167.233.236.186 'journalctl -u muretto-live -n 30 --no-pager'

# corridoio pit del weekend: finche' il circuito nuovo non ha il suo,
# il collettore DEVE girare senza --pitlane (in_pit assente, mai inventato):
ssh muretto@167.233.236.186 'echo "PITLANE_ARGS=" > ~/.muretto-live.env && sudo systemctl restart muretto-live'
```

## Per OGNI sessione (FP1, FP2, FP3, Q, gara)

```bash
# Mac, ~10 min prima della sessione — backup SignalR (KPI 2 Fase 2):
cd ~/muretto && .venv/bin/python live/record_session.py

# client di test sul VPS via TLS (per KPI 3-4 Fase 2, almeno una sessione):
.venv/bin/python live/collector/client_test.py wss://ws.murettobox.com/ws \
    --out eventi_client_$(date +%Y%m%d_%H%M).jsonl
```

A fine sessione: Ctrl-C al registratore Mac; i file restano in
`data/live_raw/`.

## REGOLA STANDARD: il live pubblico parte da FP2, MAI da FP1

FP1 serve a VERIFICARE la pre-costruzione (o, se la verifica fallisce, a
rigenerare gli asset). La mappa live si mostra al pubblico solo con asset
verificati: **da FP2 in poi**. Nessuna eccezione.

## Prima del weekend — PRE-costruzione del circuito nuovo (Mac)

Gli asset si costruiscono DALL'ANNO PRECEDENTE, prima che il weekend
inizi (metodo e soglie in PREREG_HUN_PREP.md). Per l'**Ungheria e' GIA'
in repo**: `pista_Ungheria.json`, `live_geo_Ungheria.json`,
`pitlane_ungheria.json`, `ungheria_ref_track.json` +
`ungheria_precostruzione_xy.svg` (verifica visiva). Per un circuito
futuro:

```bash
cd ~/muretto

# 1. pista del sito dalla gara dell'anno precedente (python3 utente):
python3 gen_pista_svg.py --gara <NomeDemo> --ti "<Evento FastF1>" \
    --cid <cid> --anno <anno-1> --sessione R
#    (il registro NON si tocca: --ti/--cid servono proprio a questo)

# 2. riferimento raw + campioni pit dell'anno precedente:
python3 live/estrai_precostruzione.py --anno <anno-1> \
    --gara "<Evento FastF1>" --circuito <slug>

# 3. corridoio pit (parametri Fase 1) + VERIFICA VISIVA OBBLIGATORIA:
.venv/bin/python live/costruisci_corridoio.py \
    data/live_derived/<slug>_pit_samples.json --circuito <NomeDemo> \
    --out data/live_derived/pitlane_<slug>.json \
    --svg data/live_derived/<slug>_precostruzione_xy.svg \
    --ref data/live_derived/<slug>_ref_track.json
#    guardare l'SVG: lunghezza plausibile, corridoio parallelo interno,
#    cluster scartati = 0 (o spiegati)

# 4. fit raw -> viewBox; GIUDIZIO: residuo p95 <= 3 m (PREREG):
.venv/bin/python live/gen_live_geo.py --gara <NomeDemo> \
    --ref data/live_derived/<slug>_ref_track.json \
    --pitlane data/live_derived/pitlane_<slug>.json

# 5. commit + push. Il deploy pubblico (Vercel) avviene col merge su main.
```

## Venerdi', dopo FP1 — SOLO verifica di allineamento (p95 <= 3 m)

Appena FastF1 espone i dati FP1 (di norma poco dopo la sessione):

```bash
python3 live/verifica_precostruzione.py --anno 2026 \
    --gara "Hungarian Grand Prix" --sessione FP1 \
    --ref data/live_derived/ungheria_ref_track.json
```

- **GO** (p95 ≤ 3 m): gli asset pre-costruiti restano cosi' come sono;
  committare il JSON di verifica e basta.
- **NO-GO**: rigenerazione da FP1 (sezione sotto), da chiudere PRIMA
  di FP2.

## Se la verifica FP1 fallisce — rigenerazione da FP1 (obiettivo: 30 min)

Stessi strumenti della pre-costruzione, sessione FP1 2026 al posto della
gara dell'anno prima. La cache FastF1 e' gia' calda dopo la verifica.

```bash
cd ~/muretto

# 1. (~5 min) pista dalla FP1:
python3 gen_pista_svg.py --gara Ungheria --ti "Hungarian Grand Prix" \
    --cid hungaroring --sessione FP1

# 2. (~5 min) riferimento + campioni pit dalla FP1:
python3 live/estrai_precostruzione.py --anno 2026 \
    --gara "Hungarian Grand Prix" --circuito ungheria --sessione FP1

# 3. (~3 min) corridoio: dai campioni FP1 se >= 200, ALTRIMENTI dalla
#    registrazione Mac di FP1 (metodo Fase 1, InPit del timing);
#    se entrambi scarsi, resta il corridoio dell'anno prima (DICHIARARLO):
.venv/bin/python live/costruisci_corridoio.py \
    data/live_derived/ungheria_pit_samples.json --circuito Ungheria \
    --out data/live_derived/pitlane_ungheria.json \
    --svg data/live_derived/ungheria_precostruzione_xy.svg \
    --ref data/live_derived/ungheria_ref_track.json
#    (fallback registrazione Mac: stesso comando con data/live_raw/<FP1>.txt)
#    VERIFICA VISIVA OBBLIGATORIA sull'SVG

# 4. (~2 min) fit raw -> viewBox; giudizio p95 <= 3 m:
.venv/bin/python live/gen_live_geo.py --gara Ungheria \
    --ref data/live_derived/ungheria_ref_track.json \
    --pitlane data/live_derived/pitlane_ungheria.json

# 5. (~5 min) collaudo locale contro il replay della FP1 registrata:
.venv/bin/python live/collector/collector.py --replay data/live_raw/<FP1>.txt \
    --speed 10 --buffer 0 &
( cd demo && python3 -m http.server 8901 & )
open "http://localhost:8901/live.html?ws=ws://127.0.0.1:8765"

# 6. (~5 min) commit + push + merge (PO) + deploy collettore:
git add demo/data/pista_Ungheria.json demo/data/live_geo_Ungheria.json \
    data/live_derived/pitlane_ungheria.json \
    data/live_derived/ungheria_ref_track.json \
    data/live_derived/ungheria_pit_samples.json \
    data/live_derived/ungheria_precostruzione_xy.svg
git commit -m "live/: asset Ungheria rigenerati da FP1 (verifica p95 fallita)"
git push
ssh muretto@167.233.236.186 'sh muretto/live/collector/deploy.sh'
```

## Attivazione dell'in_pit geometrico sul server (prima di FP2)

Col corridoio del weekend in repo e deployato sul VPS:

```bash
ssh muretto@167.233.236.186 'echo "PITLANE_ARGS=--pitlane data/live_derived/pitlane_ungheria.json" > ~/.muretto-live.env && sudo systemctl restart muretto-live'
```

## Dopo il weekend — validazione Fase 2 (KPI in FASE2_PREREG addendum)

```bash
# recupero registrazioni server:
scp muretto@167.233.236.186:muretto/data/live_raw/openf1/\*.jsonl data/live_raw/openf1/

# KPI 2 (completezza vs SignalR Mac), KPI 3 (latenza), KPI 4 (coerenza),
# KPI 5 (allineamento coordinate OpenF1): script di verifica da scrivere
# sui dati del weekend -> verdetti in live/REPORT_FASE2.md
```

## Guasti noti e reazioni

- `openf1_token.valido: false` → controllare `~/.openf1.env` sul server
  (600, utente muretto) e i log: `journalctl -u muretto-live | grep -i openf1`.
- Banner "NESSUNA SESSIONE IN CORSO" durante una sessione → guardare
  `/status` (`eta_ultimo_messaggio_s`): se cresce, e' il feed OpenF1
  (buchi tipo Monaco: KPI 2 li misura), non il sito.
- Certificato scaduto/assente → `systemctl status caddy` sul VPS; Caddy
  rinnova da solo, serve solo che 80/443 restino aperte.
- Il collettore non si tocca durante le sessioni: riconnessioni e backoff
  sono da progetto (KPI 1); si interviene solo a sessione finita.
