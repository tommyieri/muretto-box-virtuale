#!/usr/bin/env bash
# prontezza_run.sh — LA DOMANDA VA FATTA PRIMA CHE SERVA.
#
# I wrapper di cron chiamano gia' la sonda a ogni giro, in modo silenzioso: e' la rete
# di sicurezza. Questa riga e' l'altra meta', e vale piu' di quella — gira il MERCOLEDI',
# a bocce ferme, con la PROVA DEL MESTIERE accesa: scarica davvero una sessione, a cache
# fredda, e dice se questa macchina saprebbe pubblicare una gara.
#
# PERCHE' IL MERCOLEDI'. Il blocco del CDN e' arrivato nella pausa estiva, fra il 26/07 e
# il 21/08/2026, e lo abbiamo scoperto con le FP1 in pista. Tre settimane di preavviso
# erano li' e non le ha raccolte nessuno, perche' nessuno faceva la domanda. Accorgersene
# non basta: bisogna accorgersene quando c'e' ancora tempo per rimediare.
#
# Log: ~/muretto/data/prontezza.log — ed e' un log CORTO di proposito, uno stato a
# settimana: si apre e si legge tutto, che e' l'unico modo perche' venga aperto.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
REPO="$HOME/muretto"
LOG="$REPO/data/prontezza.log"
cd "$REPO" || exit 1

PY=""
for _cand in "$REPO/.venv-auto/bin/python" "$REPO/.venv/bin/python" python3; do
  if command -v "$_cand" >/dev/null 2>&1 && "$_cand" -c 'import fastf1' 2>/dev/null; then
    PY="$_cand"; break
  fi
done
# SENZA FASTF1 SI GIRA LO STESSO, senza la prova del mestiere: meta' risposta e' meglio
# di nessuna, e la meta' che resta (le fonti rispondono?) e' quella che ha trovato il 403.
[ -z "$PY" ] && PY="python3"

{
  echo "======== $(date '+%F %T') prontezza settimanale (python: $PY)"
  "$PY" sonda_prontezza.py --mestiere
  echo "         esito: $?"
} >> "$LOG" 2>&1
