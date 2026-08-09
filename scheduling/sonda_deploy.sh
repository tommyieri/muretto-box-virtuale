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
# COME — E PERCHE' NON PIU' COL CONTA-COMMIT (rifatta il 10/08/2026).
#
# La sonda chiedeva al sito demo/data/versione.json e contava di quanti commit il suo campo
# `commit` fosse indietro rispetto a origin/main. Ma quel campo NON dice «da che commit e'
# stato costruito il sito»: dice «a che commit stava il repo l'ultima volta che e' girato
# aggiorna_ui.py», cioe' l'ultima gara. Fra una gara e l'altra il conteggio cresce di un
# commit per commit senza che niente sia rotto — il 09/08/2026 era a 95 con grazia 25, cioe'
# rosso da settimane per costruzione, e la sonda lo spiegava da sola in sei righe di scuse.
# Un guardiano che urla sempre viene spento: lo dice questo file poco piu' sotto, ed era
# diventato il suo stesso caso.
#
# Adesso la domanda e' quella che il sito puo' davvero rispondere. Non «da che commit sei
# nato» ma «i byte che servi sono quelli di main?»: la sonda prende il file di demo/ che
# main ha cambiato piu' di recente, se lo fa dare DAL SITO e ne confronta lo sha256 con
# `git show origin/main:<file>`. E' una misura sull'oggetto servito, non sull'eta' di un
# file di dati, e non ha bisogno che nessuno rigeneri niente per tornare verde.
#
# COSA LA FA USCIRE 1:
#  (a) il sito non risponde, o non serve versione.json (deploy rotto, o mai pubblicato);
#  (b) il commit dichiarato non esiste nel repo, o NON e' un antenato di origin/main
#      (cioe' il sito ha roba che il main non ha: qualcuno ha pubblicato di lato);
#  (c) il file pubblicato piu' recente NON coincide, byte per byte, con quello di main;
#  (c-bis) il sito non serve NESSUNO dei file che main dichiara pubblicati;
#  (d) un sigillo del motore e' assente (null) nella versione pubblicata.
#
# COSA NON LA FA USCIRE 1: un cambiamento appena spinto. Vercel builda in un minuto ma un
# push arriva quando arriva: se l'ultimo commit che tocca demo/ ha meno di GRAZIA_MINUTI la
# sonda lo dice e NON giudica. La grazia adesso e' in MINUTI, perche' la causa vera di una
# divergenza legittima e' il tempo di build — non un numero di commit.
set -uo pipefail

SITO="https://murettobox.com"
GRAZIA_MINUTI=10
QUALE_FILE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --sito) SITO="$2"; shift 2 ;;
    --grazia-minuti) GRAZIA_MINUTI="$2"; shift 2 ;;
    # per il collaudo: stampa i file che la sonda userebbe, e basta. Cosi'
    # test_sonda_rosso.sh non deve ri-scrivere questa scelta (e divergere).
    --quale-file) QUALE_FILE=1; shift ;;
    *) echo "argomento sconosciuto: $1" >&2; exit 2 ;;
  esac
done

QUI="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$QUI" || exit 2

rosso() { printf '\033[31mROSSO\033[0m  %s\n' "$1"; }
verde() { printf '\033[32mVERDE\033[0m  %s\n' "$1"; }
giallo() { printf '\033[33mSOSPESO\033[0m  %s\n' "$1"; }

# L'IMPRONTA CON L'ATTREZZO CHE C'E'. Il VPS e' Linux (sha256sum), il Mac no (shasum -a
# 256). Dare per scontato l'uno avrebbe reso la sonda muta proprio sulla macchina che
# pubblica — e una sonda muta e' indistinguibile da una sonda verde.
if command -v sha256sum >/dev/null 2>&1; then
  impronta() { sha256sum | awk '{print $1}'; }
elif command -v shasum >/dev/null 2>&1; then
  impronta() { shasum -a 256 | awk '{print $1}'; }
else
  rosso "non trovo ne' sha256sum ne' shasum: non posso confrontare i byte"
  exit 1
fi

# ORIGIN/MAIN DEVE ESISTERE QUI, e non e' scontato. Il riferimento locale origin/main puo'
# mancare del tutto (clone di CI, che prende un ref solo) o essere di giorni prima. Serve
# un fetch ESPLICITO del ramo, con la sua refspec, e con la storia che serve a candidati().
#   - repo normale: fetch pieno del solo ramo main, niente sorprese;
#   - repo shallow (la CI): si APPROFONDISCE a 60 commit. Il --depth NON si puo' dare a un
#     repo normale, perche' lo renderebbe shallow — cioe' il controllo mutilerebbe il repo
#     della macchina che pubblica. Per questo si guarda prima com'e' fatto.
aggiorna_main() {
  if [[ "$(git rev-parse --is-shallow-repository 2>/dev/null)" == "true" ]]; then
    git fetch origin --depth=60 '+refs/heads/main:refs/remotes/origin/main' --quiet 2>/dev/null || true
  else
    git fetch origin '+refs/heads/main:refs/remotes/origin/main' --quiet 2>/dev/null || true
  fi
}

# I FILE PUBBLICATI CHE MAIN HA CAMBIATO PIU' DI RECENTE, dal piu' fresco.
#   - solo estensioni che il sito serve davvero (niente sorgenti di collaudo);
#   - fuori da _ritirate/, che sta nel repo ma non e' il sito;
#   - fuori da data/versione.json, che e' proprio il file confuso da cui veniamo.
# Se ne restituisce piu' d'uno perche' il piu' fresco puo' essere stato cancellato subito
# dopo, o non essere servito: si scende finche' uno risponde.
candidati() {
  git log --format='' --name-only -n 60 origin/main -- demo/ 2>/dev/null \
    | grep -E '\.(html|css|mjs|js|json|png|svg|webp|txt|xml|ico)$' \
    | grep -v '^demo/_ritirate/' \
    | grep -v '^demo/data/versione\.json$' \
    | awk '!visto[$0]++' \
    | head -12
}

if [[ "$QUALE_FILE" == "1" ]]; then
  aggiorna_main
  candidati | while read -r f; do
    git cat-file -e "origin/main:$f" 2>/dev/null && echo "$f"
  done
  exit 0
fi

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
  # NON e' un verdetto: e' l'eta' dell'ultimo passaggio di aggiorna_ui.py, e cresce da sola
  # fra una gara e l'altra. Si stampa perche' e' un'informazione utile, non perche' giudica.
  echo "       versione.json e' di $DIETRO commit fa — e' l'ultima gara, non l'ultimo deploy."
fi

# ------------------------------------------- (c) i BYTE serviti sono quelli di main?
# L'AGGIORNAMENTO VA FATTO QUI, non solo nel ramo di sopra: se il sito e' esattamente al
# commit di main la sonda non entrava in quel ramo, e origin/main poteva essere di giorni
# prima — cioe' avrebbe confrontato i byte con un main che non e' quello.
aggiorna_main
if ! git rev-parse --verify --quiet origin/main >/dev/null; then
  rosso "non ho un riferimento locale a origin/main: non posso confrontare i byte serviti"
  echo "       (un controllo che non sa rispondere esce 1: muto non e' verde)"
  exit 1
fi
# QUESTA e' la domanda. Sopra si guarda una targhetta che il sito si porta addosso; qui si
# guarda l'oggetto. Il file scelto e' quello che main ha cambiato piu' di recente: se il
# sito serve quei byte, tutto cio' che e' stato pubblicato e' arrivato.
FRESCO_TS="$(git log -1 --format=%ct origin/main -- demo/ 2>/dev/null || echo 0)"
ORA="$(date -u +%s)"
if (( FRESCO_TS > 0 )) && (( ORA - FRESCO_TS < GRAZIA_MINUTI * 60 )); then
  giallo "l'ultimo cambiamento a demo/ ha $(( (ORA - FRESCO_TS) / 60 )) minuti: dentro la grazia di $GRAZIA_MINUTI, non giudico il deploy"
else
  VUOTO="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  CONFRONTATO=""
  while read -r rel; do
    [[ -n "$rel" ]] || continue
    git cat-file -e "origin/main:$rel" 2>/dev/null || continue        # cancellato dopo
    URL="$SITO/${rel#demo/}"
    SERVITO="$(curl -fsS --max-time 20 "$URL" 2>/dev/null | impronta)"
    [[ -n "$SERVITO" && "$SERVITO" != "$VUOTO" ]] || continue         # non servito: il prossimo
    ATTESO_H="$(git show "origin/main:$rel" 2>/dev/null | impronta)"
    CONFRONTATO="$rel"
    if [[ "$SERVITO" == "$ATTESO_H" ]]; then
      verde "i byte pubblicati sono quelli di main (provato su ${rel#demo/})"
    else
      rosso "il sito NON serve i byte di main per ${rel#demo/}"
      echo "       atteso  ${ATTESO_H:0:16}   git show origin/main:$rel"
      echo "       servito ${SERVITO:0:16}   $URL"
      echo "       QUESTO si' e' la catena: Mac -> push -> VPS (ff-only) -> push -> Vercel."
      echo "       Si guarda il log del VPS (righe «aggiornato a») e l'ultimo deploy su Vercel."
      exit 1
    fi
    break
  done < <(candidati)
  if [[ -z "$CONFRONTATO" ]]; then
    rosso "il sito non serve nessuno dei file che main dichiara pubblicati: non ho su cosa giudicare"
    exit 1
  fi
fi

# ------------------------------------------------------------- (d) i sigilli ci sono
if printf '%s' "$VERS" | grep -q ': *null'; then
  rosso "versione.json pubblicata con un sigillo assente (null): il sito e' online senza un file che il motore usa"
  printf '%s\n' "$VERS" | grep ': *null'
  exit 1
fi
verde "i sigilli del motore sono presenti nella versione pubblicata"
exit 0
