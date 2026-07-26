#!/usr/bin/env bash
# Wrapper per la crontab del MAC: pubblica gli ARTICOLI della redazione appena una
# sessione e' disponibile su FastF1. Gemello di auto_tele_run.sh (stessa robustezza:
# shebang bash, PATH esplicito, lockdir, aggiornamento ff-only del codice).
#
# Attiva:   crontab -l | cat - scheduling/auto_articoli.cron | crontab -   (vedi README)
# Guarda:   tail -f ~/muretto/data/auto_articoli.log
# Ferma:    crontab -e  e togli la riga
#
# PATH esplicito: cron parte con /usr/bin:/bin e NON troverebbe python di Homebrew ne' git.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
REPO="$HOME/muretto"
LOG="$REPO/data/auto_articoli.log"
cd "$REPO" || exit 1

# La redazione usa il python3 di sistema (fastf1 + anthropic installati li'), NON il venv.
PY="python3"

# Lock con nome proprio (indipendente da auto_tele / auto_gara). mkdir, non flock (assente su macOS).
LOCK="$REPO/data/.auto_articoli.lockdir"
if ! mkdir "$LOCK" 2>/dev/null; then
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +120 2>/dev/null)" ]; then
    echo "$(date '+%F %T') lock vecchio (>2h): lo rimuovo e proseguo." >> "$LOG"
    rmdir "$LOCK" 2>/dev/null && mkdir "$LOCK" 2>/dev/null || exit 0
  else
    echo "$(date '+%F %T') gia' in esecuzione, salto." >> "$LOG"
    exit 0
  fi
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

# Aggiorna il codice prima di girare (ff-only, mai reset --hard; salta se albero sporco).
{
  echo "---- $(date '+%F %T') aggiornamento codice"
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    echo "     modifiche non committate: NON aggiorno"
  elif git fetch origin --quiet && git merge --ff-only origin/main --quiet; then
    echo "     aggiornato a $(git rev-parse --short HEAD)"
  else
    echo "     fast-forward non possibile: giro col codice attuale $(git rev-parse --short HEAD)"
  fi
} >> "$LOG" 2>&1

echo "==== $(date '+%F %T') avvio auto_articoli --push (python: $PY) ====" >> "$LOG"
"$PY" auto_articoli.py --push >> "$LOG" 2>&1
echo "==== $(date '+%F %T') fine (exit $?) ====" >> "$LOG"
