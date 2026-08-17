#!/usr/bin/env bash
# Wrapper per la crontab: pubblica gli ARTICOLI della redazione appena una sessione e'
# disponibile su FastF1. Gemello di auto_tele_run.sh (stessa robustezza: shebang bash,
# PATH esplicito, lockdir, aggiornamento ff-only del codice).
#
# DAL 10/08/2026 GIRA SUL VPS, non piu' sul Mac. Motivo: era l'ultimo pezzo della catena
# che dipendeva da una macchina che puo' essere spenta. Con la redazione si fermavano anche
# i due strumenti di stagione (forza_macchina.json e stagione_dati.json li ripubblica
# genera.py), quindi un weekend col Mac spento voleva dire niente articoli E due pagine
# ferme, senza che niente lo dicesse. Il VPS e' acceso per definizione: e' lui che pubblica.
#
# LO SPOSTAMENTO E' UN TRASLOCO, NON UNA COPIA. Lo stato (data/.auto_articoli_stato.json)
# e' gitignored, cioe' PER-MACCHINA: due macchine che girano insieme non si vedono, fanno
# la stessa sessione tutte e due e si scontrano sul push. La riga va tolta dalla crontab
# del Mac nello stesso momento in cui entra in quella del VPS.
#
# Attiva sul VPS: e' in scheduling/vps.cron (versionata). `crontab ~/muretto/scheduling/vps.cron`
# Guarda:   tail -f ~/muretto/data/auto_articoli.log
# Ferma:    crontab -e  e togli la riga
#
# PATH esplicito: cron parte con /usr/bin:/bin e NON troverebbe python di Homebrew ne' git.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
REPO="$HOME/muretto"
LOG="$REPO/data/auto_articoli.log"
cd "$REPO" || exit 1

# CHIAVE LLM: cron non sorgente nessun profilo, quindi ANTHROPIC_API_KEY non ci sarebbe e
# scrittore + verificatore-LLM si spegnerebbero (prosa a template, niente editor
# avversariale) IN SILENZIO — che e' il modo peggiore di perderli.
#
# (1) ~/.muretto_env, un file di sole variabili, fuori dal repo e fuori da git:
#   echo 'export ANTHROPIC_API_KEY="..."' > ~/.muretto_env && chmod 600 ~/.muretto_env
# E' la via del VPS — dove questo script gira per davvero dal 10/08/2026 — e scheduling/
# vps.cron la da' gia' per obbligatoria. E' l'unica su cui vale la pena costruire.
#
# (2) sotto resta il ripiego che pesca la riga da ~/.zshrc. Dal 15/08/2026 SUL MAC non trova
# piu' nulla: li' la chiave e' uscita dal profilo e sta in ~/.muretto_env (600), caricata a
# richiesta dalla funzione `chiave-on` e NON esportata di default. Il motivo non e' il file
# ma la variabile: una variabile esportata entra nell'ambiente di ogni processo figlio —
# npx/uvx di terze parti compresi — e nei dump d'ambiente degli agenti (Codex ne aveva
# catturate 4 copie in chiaro). SUL VPS non e' stato verificato: se li' la chiave fosse
# ancora in un profilo, la (2) la pescherebbe ancora. In ogni caso e' una rete, non una
# fonte: il giorno che ~/.muretto_env sparisse eviterebbe il silenzio, ma non contarci.
# Mai stampata nel log: sotto si scrive solo «attivo» o «ASSENTE».
if [ -z "${ANTHROPIC_API_KEY:-}" ] && [ -f "$HOME/.muretto_env" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.muretto_env"
fi
if [ -z "${ANTHROPIC_API_KEY:-}" ] && [ -f "$HOME/.zshrc" ]; then
  _kl="$(grep -m1 -E '^[[:space:]]*export[[:space:]]+ANTHROPIC_API_KEY=' "$HOME/.zshrc" 2>/dev/null)"
  if [ -n "$_kl" ]; then
    _kv="${_kl#*=}"                       # dopo il primo =
    _kv="${_kv%%[[:space:]]#*}"           # via un eventuale commento in coda
    _kv="${_kv%\"}"; _kv="${_kv#\"}"      # via virgolette doppie
    _kv="${_kv%\'}"; _kv="${_kv#\'}"      # o singole
    [ -n "$_kv" ] && export ANTHROPIC_API_KEY="$_kv"
  fi
  unset _kl _kv
fi

# IL PYTHON SI SCEGLIE PROVANDOLO, non indovinandolo dal percorso. Sul Mac la redazione
# gira col python3 di sistema (fastf1 e anthropic sono li'), sul VPS col .venv-auto: un
# percorso cablato avrebbe funzionato su una macchina e rotto l'altra, e il guasto sarebbe
# stato «prosa a template» invece di un errore. Qui si chiede a ciascun candidato se sa
# importare le due librerie che servono, e si prende il primo che risponde di si'.
PY=""
for _cand in "$REPO/.venv-auto/bin/python" "$REPO/.venv/bin/python" python3; do
  if command -v "$_cand" >/dev/null 2>&1 && "$_cand" -c 'import anthropic, fastf1' 2>/dev/null; then
    PY="$_cand"; break
  fi
done
if [ -z "$PY" ]; then
  echo "$(date '+%F %T') NESSUN python con anthropic+fastf1: non giro." >> "$LOG"
  echo "   provati: .venv-auto/bin/python, .venv/bin/python, python3" >> "$LOG"
  exit 1
fi
unset _cand

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

# LA SORVEGLIANZA GIRA DOVE STA IL RISCHIO — s46, subito dopo l'aggiornamento.
#
# Il `git fetch` e' appena avvenuto qui sopra: e' l'unico momento in cui la meta' (B) di s46
# puo' confrontare questo checkout con un origin/main fresco senza andare in rete per conto
# suo. Piu' tardi sarebbe una misura vecchia, prima non ci sarebbe nulla da misurare.
#
# NON FERMA NIENTE, di proposito. Questo wrapper prosegue anche quando il fast-forward
# fallisce («meglio vecchio che fermo», v. il ramo CODICE VECCHIO qui sopra): sarebbe
# incoerente che la sentinella — che di quel guasto e' solo il testimone — fosse piu' severa
# del guasto stesso. Qui s46 SCRIVE, non decide. Chi decide e' chi legge il log, o la CI.
#
# I DUE MODI IN CUI LA SORVEGLIANZA PUO' TACERE sono trattati come rossi, non come assenze,
# perche' una guardia muta e' peggio di nessuna guardia: si crede di essere sorvegliati.
#  - node fuori dal PATH del cron (il PATH qui e' esplicito, v. in cima);
#  - il file di s46 che manca, che vuol dire checkout piu' vecchio della sentinella stessa,
#    cioe' esattamente la condizione che si voleva sorvegliare.
{
  echo "---- $(date '+%F %T') freschezza del codice (s46)"
  S46="$REPO/simulatore/banco/sentinelle/s46_codice_fresco.mjs"
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


echo "==== $(date '+%F %T') avvio auto_articoli --push (python: $PY · LLM: $([ -n "${ANTHROPIC_API_KEY:-}" ] && echo attivo || echo ASSENTE)) ====" >> "$LOG"
"$PY" auto_articoli.py --push >> "$LOG" 2>&1
echo "==== $(date '+%F %T') fine (exit $?) ====" >> "$LOG"
