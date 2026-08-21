#!/usr/bin/env bash
# SHEBANG: bash, non zsh — stessa lezione di auto_run.sh (uno shebang assente fa
# fallire lo script dalla crontab con exit 127 e un messaggio che parla
# dell'interprete, non dello script).
#
# Wrapper per la crontab del MAC: scalda la cache FastF1 del GP in corso e la spedisce
# al VPS. Gira SUL MAC perche' e' l'unica delle due macchine a cui il CDN di F1
# risponde: dal 21/08/2026 livetiming.formula1.com da' 403 all'indirizzo del VPS
# (blocco per indirizzo, non per user-agent — misurato affiancando le due macchine).
# Il perche' per esteso sta in scalda_cache.py; qui c'e' solo il come.
#
# E' UN PONTE, NON UNA RIPARAZIONE, e va detto anche qui: rimette il Mac nel percorso
# critico, cioe' la dipendenza che il trasloco del 10/08/2026 aveva tolto. Mac spento =
# quella sessione non esce. Il VPS lo dichiara nel suo log («estrazione fallita»), non
# lo nasconde, ma nessuno lo pubblica al posto suo.
#
# Attiva:   crontab -l | cat - scheduling/scalda_cache.cron | crontab -
# Guarda:   tail -f ~/muretto/data/scalda_cache.log
# Ferma:    crontab -e  e togli la riga
#
# PATH esplicito: cron parte con /usr/bin:/bin e NON troverebbe python3 di Homebrew,
# ne' git, ne' rsync di Homebrew se c'e'.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# IL CODICE LO PRENDE DA UN CHECKOUT SUO, e non e' pignoleria. Il checkout principale
# del Mac (~/muretto) e' un albero di LAVORO: al 21/08/2026 sta su un branch feature,
# 90 commit indietro, con file modificati — cioe' un posto dove questo script non
# esiste nemmeno. Un worktree dedicato su main si aggiorna da solo e non tocca il
# lavoro in corso. Il LOG invece resta in ~/muretto/data/, dove stanno gli altri:
# chi va a leggere i log non deve sapere che esiste un secondo checkout.
PONTE="${MURETTO_PONTE:-$HOME/muretto-ponte}"
LOG="$HOME/muretto/data/scalda_cache.log"
mkdir -p "$(dirname "$LOG")"

if [ ! -d "$PONTE/.git" ] && [ ! -f "$PONTE/.git" ]; then
  {
    echo "==== $(date '+%F %T') NON GIRO: manca il checkout del ponte ($PONTE)"
    echo "     si crea una volta sola, e non tocca il lavoro in ~/muretto:"
    echo "       git -C ~/muretto worktree add $PONTE main"
  } >> "$LOG"
  exit 1
fi
cd "$PONTE" || exit 1

# Lock con un nome suo: gli altri giri del Mac (auto_tele) sono indipendenti e uno non
# deve zittire l'altro. mkdir e non flock, che su macOS non c'e'.
LOCK="$HOME/muretto/data/.scalda_cache.lockdir"
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

# Aggiorna il ponte prima di girare. Qui il fast-forward DEVE passare: il worktree e'
# solo di lettura per noi, nessuno ci lavora dentro. Se non passa, e' successo qualcosa
# che va guardato — quindi si urla, ma si gira lo stesso: meglio vecchio che fermo,
# come nel resto della catena.
{
  echo "---- $(date '+%F %T') aggiornamento del ponte"
  git fetch origin --quiet || echo "     !! fetch fallito: rete o credenziali"
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    echo "     !! il ponte ha modifiche non committate: NON aggiorno. Non dovrebbe"
    echo "        succedere: qui dentro non ci lavora nessuno."
  elif git merge --ff-only origin/main --quiet; then
    echo "     aggiornato a $(git rev-parse --short HEAD)"
  else
    echo "     !! CODICE VECCHIO: fast-forward non possibile, giro con $(git rev-parse --short HEAD)"
    echo "        indietro di $(git rev-list --count HEAD..origin/main 2>/dev/null || echo '?') commit"
  fi
} >> "$LOG" 2>&1

# LA SORVEGLIANZA GIRA DOVE STA IL RISCHIO — s46, subito dopo l'aggiornamento, come
# negli altri wrapper. Il `git fetch` e' appena avvenuto: e' l'unico momento in cui la
# meta' (B) di s46 puo' confrontare questo checkout con un origin/main fresco senza
# andare in rete per conto suo.
#
# NON FERMA NIENTE, di proposito: questo wrapper prosegue anche col fast-forward
# fallito («meglio vecchio che fermo»), e sarebbe incoerente che la sentinella fosse
# piu' severa del guasto di cui e' solo il testimone. Qui s46 SCRIVE, non decide.
#
# I DUE MODI IN CUI PUO' TACERE sono rossi, non assenze — una guardia muta e' peggio di
# nessuna guardia, perche' si crede di essere sorvegliati.
{
  echo "---- $(date '+%F %T') freschezza del codice (s46)"
  S46="$PONTE/simulatore/banco/sentinelle/s46_codice_fresco.mjs"
  if [ ! -f "$S46" ]; then
    echo "     !! s46 ASSENTE da questo checkout: o e' stata tolta, o il codice qui e' piu'"
    echo "        vecchio della sentinella stessa. In entrambi i casi nessuno sta guardando."
  elif ! command -v node >/dev/null 2>&1; then
    echo "     !! s46 NON ESEGUIBILE: node non e' nel PATH di questo cron. La sorveglianza tace."
  elif node "$S46"; then
    echo "     codice fresco"
  else
    echo "     !! s46 ROSSA (dettaglio qui sopra). Si prosegue lo stesso, ma adesso e' scritto."
  fi
} >> "$LOG" 2>&1

# IL PYTHON SI SCEGLIE PROVANDOLO, non indovinandolo dal percorso (stessa regola di
# auto_articoli_run.sh). Qui basta fastf1: anthropic non serve, questo non scrive prosa.
PY=""
for _cand in "$HOME/muretto/.venv/bin/python" "$HOME/muretto/.venv-auto/bin/python" python3; do
  if command -v "$_cand" >/dev/null 2>&1 && "$_cand" -c 'import fastf1' 2>/dev/null; then
    PY="$_cand"; break
  fi
done
if [ -z "$PY" ]; then
  echo "$(date '+%F %T') NESSUN python con fastf1: non giro." >> "$LOG"
  exit 1
fi
unset _cand

echo "==== $(date '+%F %T') avvio scalda_cache (python: $PY) ====" >> "$LOG"
"$PY" scalda_cache.py >> "$LOG" 2>&1
echo "==== $(date '+%F %T') fine (exit $?) ====" >> "$LOG"
