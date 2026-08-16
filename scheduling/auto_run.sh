#!/usr/bin/env bash
# SHEBANG: bash, non zsh. Sul VPS (Linux) zsh NON E' INSTALLATO, e uno script con
# `#!/bin/zsh` lanciato dalla crontab fallisce con exit 127 e il messaggio "No such file
# or directory" — che parla dell'INTERPRETE, non dello script, ed e' facilissimo leggerlo
# come "manca il file". Preso il 22/07/2026 provando lo script in un ambiente minimo
# (env -i) prima di puntarci la crontab: invocarlo come `sh auto_run.sh` funzionava e
# nascondeva il guasto, perche' bypassa lo shebang.
# bash c'e' su entrambe le macchine (/usr/bin/bash sul VPS, /bin/bash sul Mac) e regge
# i costrutti [[ ]] usati qui sotto.
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

# IL PYTHON GIUSTO, e non e' lo stesso sulle due macchine. Sul VPS la crontab invocava
# .venv-auto/bin/python DIRETTAMENTE, saltando questo script — e quindi saltando
# l'aggiornamento del codice qui sotto: la macchina girava per sempre con l'ultimo push
# riuscito. Per poterci puntare la crontab, questo script deve sapere quale python usare,
# altrimenti "python3" sul VPS non trova numpy e il ciclo muore in silenzio.
if [ -x "$REPO/.venv-auto/bin/python" ]; then
  PY="$REPO/.venv-auto/bin/python"
elif [ -x "$REPO/.venv/bin/python" ]; then
  PY="$REPO/.venv/bin/python"
else
  PY="python3"
fi

# Un solo giro alla volta (evita sovrapposizioni se un run e' lungo).
#
# IL LOCK HA UN NOME SUO, e non e' pignoleria: la crontab del VPS usava
# `flock -n .../.auto_gara.lock`, che crea quel percorso come FILE. Questo script fa
# `mkdir` sullo stesso percorso, e mkdir su un file esistente fallisce SEMPRE — quindi
# auto_run.sh, puntato a quella crontab, avrebbe risposto "gia' in esecuzione, salto" a
# ogni giro, per sempre, senza che nessun log gridasse. Preso in prova il 22/07/2026
# prima di cambiare la crontab; il file di flock e' del 20/07 ed era li' da allora.
LOCK="$REPO/data/.auto_run.lockdir"
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
} >> "$REPO/data/auto_gara.log" 2>&1

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
} >> "$REPO/data/auto_gara.log" 2>&1


echo "==== $(date '+%F %T') avvio auto_gara --push (python: $PY) ====" >> "$REPO/data/auto_gara.log"
"$PY" auto_gara.py --push >> "$REPO/data/auto_gara.log" 2>&1
ESITO=$?
echo "==== $(date '+%F %T') fine (exit $ESITO) ====" >> "$REPO/data/auto_gara.log"

# ------------------------------------------------- CIO' CHE E' ONLINE E' CIO' CHE E' SU MAIN?
# La sonda guarda la catena DA FUORI (curl al sito) e la confronta con origin/main. E' l'unico
# controllo che attraversa Mac -> push -> VPS -> push -> Vercel: senza, il guasto «la macchina
# che pubblica esegue un main vecchio» resta invisibile finche' qualcuno non entra in ssh.
#
# NON FATALE DI PROPOSITO, e il `|| true` non e' pigrizia: questo passo osserva, non pubblica.
# Se facesse fallire auto_run, un problema di rete verso il sito diventerebbe un giro di
# pubblicazione perso — cioe' la sonda causerebbe il danno che sorveglia. L'esito sta nel log.
if [ -x "$REPO/scheduling/sonda_deploy.sh" ]; then
  {
    echo "---- $(date '+%F %T') sonda deploy"
    "$REPO/scheduling/sonda_deploy.sh" 2>&1 | sed 's/^/     /'
  } >> "$REPO/data/auto_gara.log" 2>&1 || true
fi
exit $ESITO
