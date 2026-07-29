#!/bin/sh
# Deploy del collettore sul VPS: git pull + restart. Niente automazioni
# fragili: questo script E' il deploy, lanciato a mano via ssh:
#   ssh muretto@167.233.236.186 'sh muretto/live/collector/deploy.sh'
set -eu
cd "$(dirname "$0")/../.."

# --- Guard di branch e working tree (prima di qualsiasi git pull) ---
# deploy.sh assume il checkout su main: dopo il merge di un branch di
# lavoro il VPS resta sul branch vecchio e 'git pull' muore con un
# messaggio incomprensibile sotto 'set -eu'. Meglio fermarsi chiari.
branch="$(git branch --show-current)"
if [ "$branch" != "main" ]; then
    echo "ERRORE: deploy.sh attende il checkout su 'main', trovato '$branch'. Esegui 'git checkout main' sul VPS, poi rilancia." >&2
    exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
    echo "ERRORE: working tree sporco sul VPS" >&2
    exit 1
fi

echo "== git pull =="
git pull --ff-only
echo "== dipendenze =="
.venv-live/bin/pip install -q -r live/collector/requirements.txt
echo "== restart =="
sudo systemctl restart muretto-live
sleep 2
systemctl is-active muretto-live
echo "== status =="
curl -s http://127.0.0.1:8766/status || true
echo
echo "== HEAD deployato =="
git rev-parse HEAD
