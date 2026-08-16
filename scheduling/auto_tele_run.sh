#!/usr/bin/env bash
# SHEBANG: bash, non zsh — stessa lezione di auto_run.sh (uno shebang assente sulla
# macchina fa fallire lo script dalla crontab con exit 127 e un messaggio che parla
# dell'interprete, non dello script).
#
# Wrapper per la crontab del MAC: pubblica la TELEMETRIA delle sessioni appena
# registrate. Gira SUL MAC e non sul VPS perche' le registrazioni del collettore
# (~/muretto/data/live_raw/) stanno qui: il VPS quei file non li ha.
#
# Attiva:   crontab -l | cat - scheduling/auto_tele.cron | crontab -   (vedi README)
# Guarda:   tail -f ~/muretto/data/auto_tele.log
# Ferma:    crontab -e  e togli la riga
#
# PATH esplicito: cron parte con /usr/bin:/bin e NON troverebbe il python di Homebrew
# (/opt/homebrew/bin/python3) ne' `git`.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
REPO="$HOME/muretto"
LOG="$REPO/data/auto_tele.log"
cd "$REPO" || exit 1

if [ -x "$REPO/.venv-auto/bin/python" ]; then
  PY="$REPO/.venv-auto/bin/python"
elif [ -x "$REPO/.venv/bin/python" ]; then
  PY="$REPO/.venv/bin/python"
else
  PY="python3"
fi

# Lock CON UN NOME SUO (non condiviso con auto_run.sh: i due giri sono indipendenti e
# uno non deve zittire l'altro). mkdir e non flock: su macOS flock non esiste.
LOCK="$REPO/data/.auto_tele.lockdir"
if ! mkdir "$LOCK" 2>/dev/null; then
  # lock piu' vecchio di 2 ore = avanzo di un giro morto: lo tolgo invece di restare
  # muto per sempre (e' il guasto "gia' in esecuzione, salto" che non gridava).
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +120 2>/dev/null)" ]; then
    echo "$(date '+%F %T') lock vecchio (>2h): lo rimuovo e proseguo." >> "$LOG"
    rmdir "$LOCK" 2>/dev/null && mkdir "$LOCK" 2>/dev/null || exit 0
  else
    echo "$(date '+%F %T') gia' in esecuzione, salto." >> "$LOG"
    exit 0
  fi
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

# AGGIORNA IL CODICE prima di girare. Senza, la macchina resta per sempre sull'ultimo
# codice scaricato a mano: una correzione a auto_tele.py non arriverebbe mai.
# ff-only DI PROPOSITO, mai `reset --hard`: sul disco puo' esserci lavoro non committato.
# Albero sporco o fast-forward impossibile (es. un commit locale non ancora pushato) ->
# si logga e si gira col codice attuale: meglio vecchio che perso.
{
  echo "---- $(date '+%F %T') aggiornamento codice"
  # --untracked-files=no DI PROPOSITO: nel checkout del Mac ci sono sempre appunti e file
  # di lavoro NON tracciati (CLAUDE.md, TASKS.md, cache...). Contandoli, l'albero
  # risultava "sporco" a ogni giro e l'aggiornamento non sarebbe MAI partito. Qui deve
  # fermarci solo il lavoro vero non committato sui file tracciati.
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    echo "     modifiche non committate: NON aggiorno"
  elif git fetch origin --quiet && git merge --ff-only origin/main --quiet; then
    echo "     aggiornato a $(git rev-parse --short HEAD)"
  else
    # CODICE VECCHIO — marcatore cercato da banco/sentinelle/s46_codice_fresco.mjs.
    # UN FAST-FORWARD FALLITO NON E' UNA NOTA. E' il modo in cui questa macchina continua a
    # pubblicare con codice di ieri senza che nessuno lo sappia: lo script prosegue lo stesso,
    # di proposito (meglio vecchio che fermo), quindi l'unica traccia e' questa riga. Fino al
    # 15/08/2026 diceva «giro col codice attuale» e sembrava informativa: il Mac ha girato
    # cosi' per giorni, 33 commit indietro, perche' 28 file non tracciati sotto .agents/
    # collidevano con gli stessi percorsi diventati tracciati a monte. Adesso urla e conta.
    echo "     !! CODICE VECCHIO: fast-forward NON possibile, giro con $(git rev-parse --short HEAD)"
    echo "        indietro di $(git rev-list --count HEAD..origin/main 2>/dev/null || echo '?') commit su origin/main"
    echo "        cause tipiche: file non tracciati che collidono con file diventati tracciati a monte,"
    echo "        oppure un commit locale mai pushato. Non si risolve da solo."
  fi
} >> "$LOG" 2>&1

echo "==== $(date '+%F %T') avvio auto_tele --push (python: $PY) ====" >> "$LOG"
"$PY" auto_tele.py --push >> "$LOG" 2>&1
echo "==== $(date '+%F %T') fine (exit $?) ====" >> "$LOG"
