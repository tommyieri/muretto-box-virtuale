#!/usr/bin/env bash
# sonda_deploy.sh — CIO' CHE E' ONLINE E' CIO' CHE E' SU MAIN?
#
#     scheduling/sonda_deploy.sh                 esce 1 se il sito non e' il main
#     scheduling/sonda_deploy.sh --sito <url>    contro un altro sito (staging, locale)
#
# IL BUCO CHE CHIUDE. Ogni pezzo della catena si verifica da solo — il banco verifica il
# motore, la CI verifica le copie, auto_run verifica il lock — ma NESSUN controllo la
# attraversa tutta: Mac -> push -> VPS (ff-only) -> push -> Vercel. Per questo il guasto
# «la macchina che pubblica esegue un main vecchio» e' rimasto invisibile fino al
# 02/08/2026, quando si e' scoperto entrando in ssh a mano: non apparteneva a nessun
# guardiano, perche' nessun guardiano guardava da fuori.
#
# COME. Il sito porta addosso demo/data/versione.json (scritto da aggiorna_ui.py) con il
# commit da cui e' stato costruito e l'impronta dei sigilli del motore. La sonda chiede
# quel file AL SITO (curl, non al disco) e lo confronta con `git ls-remote origin main`.
# I due punti di vista sono indipendenti: uno e' cio' che il mondo vede, l'altro e' cio'
# che il repo dice. Se divergono, qualcosa in mezzo non ha pubblicato.
#
# COSA LA FA USCIRE 1:
#  (a) il sito non risponde, o non serve versione.json (deploy rotto, o mai pubblicato);
#  (b) il commit del sito non e' quello di origin/main, e NON ne e' un antenato
#      (cioe' il sito ha roba che il main non ha: qualcuno ha pubblicato di lato);
#  (c) il sito e' indietro di piu' di GRAZIA_COMMIT commit rispetto a main;
#  (d) un sigillo del motore e' assente (null) nella versione pubblicata.
#
# COSA NON LA FA USCIRE 1: essere indietro di pochi commit. Vercel builda in un minuto ma
# un push arriva quando arriva: un allarme a ogni commit sarebbe rumore, e un guardiano
# che urla sempre viene spento. La grazia e' esplicita e si vede.
set -uo pipefail

SITO="https://murettobox.com"
GRAZIA_COMMIT=25
while [[ $# -gt 0 ]]; do
  case "$1" in
    --sito) SITO="$2"; shift 2 ;;
    --grazia) GRAZIA_COMMIT="$2"; shift 2 ;;
    *) echo "argomento sconosciuto: $1" >&2; exit 2 ;;
  esac
done

QUI="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$QUI" || exit 2

rosso() { printf '\033[31mROSSO\033[0m  %s\n' "$1"; }
verde() { printf '\033[32mVERDE\033[0m  %s\n' "$1"; }

# ---------------------------------------------------------------- (a) il sito risponde
VERS="$(curl -fsS --max-time 20 "$SITO/data/versione.json" 2>/dev/null)" || {
  rosso "il sito non serve data/versione.json ($SITO) — deploy rotto, o versione.json mai pubblicato"
  exit 1
}
ONLINE="$(printf '%s' "$VERS" | sed -n 's/.*"commit": *"\([0-9a-f]*\)".*/\1/p' | head -1)"
[[ -n "$ONLINE" ]] || { rosso "versione.json senza campo commit: $VERS"; exit 1; }

ATTESO="$(git ls-remote origin main 2>/dev/null | awk '{print $1}')"
[[ -n "$ATTESO" ]] || { rosso "non riesco a leggere origin/main (rete? credenziali?)"; exit 1; }

echo "sito   $SITO -> ${ONLINE:0:7}"
echo "main   origin/main -> ${ATTESO:0:7}"

# ------------------------------------------------------- (b) e (c) quanto e' indietro
if [[ "$ONLINE" == "$ATTESO" ]]; then
  verde "il sito e' esattamente origin/main"
else
  git fetch origin --quiet 2>/dev/null || true
  if ! git cat-file -e "$ONLINE^{commit}" 2>/dev/null; then
    rosso "il commit online (${ONLINE:0:7}) non esiste in questo repo: il sito e' stato costruito da un albero che non conosciamo"
    exit 1
  fi
  if ! git merge-base --is-ancestor "$ONLINE" "$ATTESO" 2>/dev/null; then
    rosso "il commit online (${ONLINE:0:7}) NON e' un antenato di origin/main: qualcosa e' stato pubblicato di lato"
    exit 1
  fi
  DIETRO="$(git rev-list --count "$ONLINE..$ATTESO" 2>/dev/null || echo '?')"
  if [[ "$DIETRO" == "?" ]] || (( DIETRO > GRAZIA_COMMIT )); then
    rosso "il sito e' indietro di $DIETRO commit su origin/main (grazia: $GRAZIA_COMMIT) — la macchina che pubblica non sta eseguendo il main"
    exit 1
  fi
  verde "il sito e' indietro di $DIETRO commit, entro la grazia di $GRAZIA_COMMIT"
fi

# ------------------------------------------------------------- (d) i sigilli ci sono
if printf '%s' "$VERS" | grep -q ': *null'; then
  rosso "versione.json pubblicata con un sigillo assente (null): il sito e' online senza un file che il motore usa"
  printf '%s\n' "$VERS" | grep ': *null'
  exit 1
fi
verde "i sigilli del motore sono presenti nella versione pubblicata"
exit 0
