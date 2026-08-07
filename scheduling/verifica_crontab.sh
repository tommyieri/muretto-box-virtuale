#!/usr/bin/env bash
# verifica_crontab.sh — la crontab installata e' quella versionata?
#
#     scheduling/verifica_crontab.sh            esce 1 se crontab -l diverge da vps.cron
#
# Da lanciare SUL VPS. Confronta le righe ATTIVE (niente commenti, niente righe
# vuote) di `crontab -l` con quelle di scheduling/vps.cron. Qualunque differenza
# — riga in piu', in meno, o diversa — esce 1 e stampa il diff: o si installa il
# file versionato (`crontab scheduling/vps.cron`) o si versiona la modifica.
#
# COSA LO FA USCIRE 1: (a) crontab assente; (b) righe attive diverse dal file.
set -uo pipefail

QUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ATTIVE() { grep -v '^\s*#' "$1" | grep -v '^\s*$'; }

INSTALLATA="$(crontab -l 2>/dev/null)" || {
  printf '\033[31mROSSO\033[0m  nessuna crontab installata per %s\n' "$(whoami)"
  exit 1
}

DIFF="$(diff <(printf '%s\n' "$INSTALLATA" | grep -v '^\s*#' | grep -v '^\s*$') <(ATTIVE "$QUI/vps.cron"))" || {
  printf '\033[31mROSSO\033[0m  la crontab installata diverge da scheduling/vps.cron:\n%s\n' "$DIFF"
  echo "       o installi il file versionato:  crontab $QUI/vps.cron"
  echo "       o versioni la modifica dentro vps.cron — mai due verita'."
  exit 1
}
printf '\033[32mVERDE\033[0m  la crontab installata e\x27 esattamente scheduling/vps.cron\n'
exit 0
