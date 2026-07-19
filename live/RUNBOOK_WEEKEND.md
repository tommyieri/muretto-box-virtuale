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

## Tra FP1 e FP2 — asset del circuito nuovo (es. Ungheria)

Tutti i passi sul Mac, poi commit + deploy.

```bash
cd ~/muretto

# 1. pista del sito dalla telemetria FP1 (python3 utente, FastF1):
python3 gen_pista_svg.py --gara Ungheria --sessione FP1

# 2. polilinea di riferimento raw del circuito (per il fit del viewBox):
#    adattare live/estrai_riferimenti.py al circuito (anno 2025, gara, R)
#    oppure usare la FP1 stessa come riferimento — output atteso:
#    data/live_derived/ungheria_ref_track.json
python3 live/estrai_riferimenti.py   # (adattato: vedi nota in coda)

# 3. corridoio pit dalla registrazione Mac di FP1 (metodo Fase 1):
.venv/bin/python live/costruisci_corridoio.py data/live_raw/<FP1>.txt \
    --circuito Ungheria --out data/live_derived/pitlane_ungheria.json
#    VERIFICA VISIVA OBBLIGATORIA (lunghezza plausibile, cluster scartati)

# 4. fit raw -> viewBox per la mappa live:
.venv/bin/python live/gen_live_geo.py --gara Ungheria \
    --ref data/live_derived/ungheria_ref_track.json \
    --pitlane data/live_derived/pitlane_ungheria.json
#    controllare residuo_medio_vb (~1-2 = ok)

# 5. collaudo locale contro il replay della FP1 registrata:
.venv/bin/python live/collector/collector.py --replay data/live_raw/<FP1>.txt \
    --speed 10 --buffer 0 &
( cd demo && python3 -m http.server 8901 & )
open "http://localhost:8901/live.html?ws=ws://127.0.0.1:8765"

# 6. commit + push + deploy:
git add demo/data/pista_Ungheria.json demo/data/live_geo_Ungheria.json \
    data/live_derived/pitlane_ungheria.json data/live_derived/ungheria_ref_track.json
git commit -m "live/: asset circuito Ungheria (pista FP1, corridoio, viewBox)"
git push
ssh muretto@167.233.236.186 'sh muretto/live/collector/deploy.sh'

# 7. attivare l'in_pit geometrico sul server:
ssh muretto@167.233.236.186 'echo "PITLANE_ARGS=--pitlane data/live_derived/pitlane_ungheria.json" > ~/.muretto-live.env && sudo systemctl restart muretto-live'
```

Nota al passo 2: `estrai_riferimenti.py` e' nato per Spa (Belgio 2025);
per un altro circuito va copiato/parametrizzato (anno/gara). In
alternativa rapida il fit puo' usare come riferimento il giro pulito
della FP1 2026 appena estratto da `gen_pista_svg` (stessa fonte del
viewBox: fit quasi perfetto per costruzione, ma va DICHIARATO nel commit).

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
