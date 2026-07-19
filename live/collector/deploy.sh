#!/bin/sh
# Deploy del collettore sul VPS: git pull + restart. Niente automazioni
# fragili: questo script E' il deploy, lanciato a mano via ssh:
#   ssh muretto@167.233.236.186 'sh muretto/live/collector/deploy.sh'
set -eu
cd "$(dirname "$0")/../.."
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
