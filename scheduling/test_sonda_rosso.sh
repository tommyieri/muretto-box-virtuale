#!/usr/bin/env bash
# test_sonda_rosso.sh — IL RAMO ROSSO DELLA SONDA, FATTO SCATTARE APPOSTA.
#
#     scheduling/test_sonda_rosso.sh        esce 1 se un ramo non scatta come deve
#
# Il progetto lo ammetteva a registro: «il ramo ROSSO della sonda non e' mai
# scattato in produzione, quindi che segnali davvero e' provato solo in
# laboratorio» — e in laboratorio a mano, una volta. Questo collaudo lo prova a
# OGNI giro di CI: un sito finto locale serve versione.json rotte in tre modi
# diversi, e per ognuno la sonda DEVE uscire 1 con il messaggio del suo ramo.
# In coda, il caso verde: una versione.json sana deve uscire 0 — un collaudo
# che sa solo far fallire non distingue la sonda da `false`.
#
# COSA LO FA USCIRE 1:
#  (a) sito che non serve versione.json ma la sonda non lo dice (o esce 0);
#  (b) commit sconosciuto al repo ma la sonda non lo dice;
#  (d) sigillo null ma la sonda non lo dice;
#  (v) versione sana ma la sonda esce != 0 (falso allarme = guardiano spento).
set -uo pipefail

QUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SONDA="$QUI/sonda_deploy.sh"
PORTA="${PORTA_TEST_SONDA:-8321}"
DIR="$(mktemp -d)"
mkdir -p "$DIR/data"

python3 -m http.server "$PORTA" --directory "$DIR" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null; wait "$SERVER" 2>/dev/null; rm -rf "$DIR"' EXIT
# il server deve rispondere prima di giudicare la sonda
for _ in 1 2 3 4 5 6 7 8 9 10; do
  curl -fsS --max-time 2 "http://127.0.0.1:$PORTA/" >/dev/null 2>&1 && break
  sleep 0.3
done

ERRORI=0
caso() { # caso <nome> <exit_atteso> <frammento_atteso_nel_messaggio>
  local nome="$1" atteso="$2" frammento="$3"
  local uscita esito
  uscita="$("$SONDA" --sito "http://127.0.0.1:$PORTA" 2>&1)"; esito=$?
  if [[ "$esito" -ne "$atteso" ]]; then
    echo "test_sonda FALLITA — caso $nome: exit $esito invece di $atteso"
    printf '%s\n' "$uscita" | sed 's/^/       /'
    ERRORI=$((ERRORI + 1))
  elif [[ -n "$frammento" ]] && ! printf '%s' "$uscita" | grep -q "$frammento"; then
    echo "test_sonda FALLITA — caso $nome: manca il messaggio atteso «$frammento»"
    printf '%s\n' "$uscita" | sed 's/^/       /'
    ERRORI=$((ERRORI + 1))
  else
    echo "ok  caso $nome"
  fi
}

MAIN_SHA="$(git -C "$QUI/.." ls-remote origin main 2>/dev/null | awk '{print $1}')"
if [[ -z "$MAIN_SHA" ]]; then
  echo "test_sonda NON GIUDICABILE: non leggo origin/main (rete/credenziali) — esco 1, non 0: un collaudo muto non e' un collaudo"
  exit 1
fi

# (a) il sito non serve versione.json
rm -f "$DIR/data/versione.json"
caso "a-sito-senza-versione" 1 "non serve data/versione.json"

# (b) commit che il repo non conosce
printf '{"commit": "%s", "sigillo_finto": "c0ffee"}\n' "0000000000000000000000000000000000000000" > "$DIR/data/versione.json"
caso "b-commit-sconosciuto" 1 "non esiste in questo repo"

# (d) sigillo assente (null) su un commit vero
printf '{"commit": "%s", "sigillo_finto": null}\n' "$MAIN_SHA" > "$DIR/data/versione.json"
caso "d-sigillo-null" 1 "sigillo assente"

# (v) versione sana: la sonda deve stare zitta e uscire 0
printf '{"commit": "%s", "sigillo_finto": "c0ffee"}\n' "$MAIN_SHA" > "$DIR/data/versione.json"
caso "v-versione-sana" 0 "esattamente origin/main"

if [[ "$ERRORI" -eq 0 ]]; then
  echo "test_sonda: 4/4 rami provati (3 rossi scattano, il verde tace)"
  exit 0
fi
exit 1
