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

# ------------------------------------------------------------------ AGGIORNA IL CODICE
# Senza questo, lo scheduler gira PER SEMPRE col codice che aveva all'ultimo push riuscito:
# auto_gara.py fa fetch/rebase solo DENTRO commit_push, cioe' DOPO che il giro e' girato.
# Una correzione spinta oggi verrebbe eseguita solo dal giro successivo al primo che
# produce un commit.
#
# ff-only DI PROPOSITO, mai `reset --hard`: sul disco puo' esserci una gara pubblicata e
# non ancora committata (e' il guasto che registro_committato() e' fatto per riprendere).
# Un reset --hard la cancellerebbe — cioe' il rimedio distruggerebbe proprio il caso che
# vogliamo salvare. Se l'albero e' sporco o il fast-forward non e' possibile, si LOGGA e
# si gira col codice attuale: meglio vecchio che perso.
{
  echo "---- $(date '+%F %T') aggiornamento codice"
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "     albero sporco: NON aggiorno (probabile lavoro non committato da riprendere)"
  elif git fetch origin --quiet && git merge --ff-only origin/main --quiet; then
    echo "     aggiornato a $(git rev-parse --short HEAD)"
  else
    echo "     fast-forward non possibile: giro col codice attuale $(git rev-parse --short HEAD)"
  fi
} >> "$REPO/data/auto_gara.log" 2>&1

echo "==== $(date '+%F %T') avvio auto_gara --push ====" >> "$REPO/data/auto_gara.log"
python3 auto_gara.py --push >> "$REPO/data/auto_gara.log" 2>&1
echo "==== $(date '+%F %T') fine (exit $?) ====" >> "$REPO/data/auto_gara.log"
