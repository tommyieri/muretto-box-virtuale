#!/bin/zsh
# Wrapper per lo scheduler (launchd/cron): lancia l'orchestratore che pubblica le gare
# nuove DA SOLO. launchd parte con un PATH minimo -> qui lo fissiamo esplicitamente.
#
# Enable (launchd, Mac):
#   cp scheduling/com.muretto.autogara.plist ~/Library/LaunchAgents/
#   launchctl load ~/Library/LaunchAgents/com.muretto.autogara.plist
# Disable:
#   launchctl unload ~/Library/LaunchAgents/com.muretto.autogara.plist
# Log:  tail -f ~/muretto/data/auto_gara.log

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
REPO="$HOME/muretto"
cd "$REPO" || exit 1

# Un solo giro alla volta (evita sovrapposizioni se un run e' lungo):
LOCK="$REPO/data/.auto_gara.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "$(date '+%F %T') gia' in esecuzione, salto." >> "$REPO/data/auto_gara.log"
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

echo "==== $(date '+%F %T') avvio auto_gara --push ====" >> "$REPO/data/auto_gara.log"
python3 auto_gara.py --push >> "$REPO/data/auto_gara.log" 2>&1
echo "==== $(date '+%F %T') fine (exit $?) ====" >> "$REPO/data/auto_gara.log"
