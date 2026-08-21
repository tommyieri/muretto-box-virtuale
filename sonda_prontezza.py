#!/usr/bin/env python3
"""sonda_prontezza.py — questa macchina, oggi, saprebbe fare il suo mestiere?

IL BUCO CHE CHIUDE, e l'ho scavato io il 21/08/2026. Mi era stato chiesto di verificare
che le automazioni fossero attive, e ho risposto di si': crontab installata, wrapper che
girano, log freschi, chiave LLM presente, `verifica_crontab.sh` VERDE. Tutto vero. E
tutto inutile, perche' il VPS quel giorno **non poteva scaricare i dati della gara**: il
CDN di F1 gli rispondeva 403 per indirizzo. Nel log c'era scritto «Olanda FP1: estrazione
fallita» e l'ho letto come attesa di FastF1. Non lo era: FastF1 li aveva.

    Avevo verificato che la macchina GIRASSE, non che sapesse fare il LAVORO.

Sono due domande diverse e nessuno faceva la seconda. La prima la fanno gia' in tanti —
`verifica_crontab.sh` (la riga c'e'?), `s46_codice_fresco` (il codice e' fresco?),
`test_dipendenze.py --ambiente` (le librerie ci sono?), `sonda_deploy.sh` (l'online e'
main?). Sono tutte sulla CONFIGURAZIONE. Questa sonda e' sulla CAPACITA': prende le fonti
da cui il lavoro dipende e le interroga davvero.

Perche' conta il momento. Il blocco del CDN e' arrivato durante la pausa estiva, fra il
26/07 e il 21/08. Con questa sonda accesa lo avremmo saputo il giorno dopo, a bocce ferme,
con tre settimane per rimediare; senza, lo abbiamo scoperto a FP1 in corso. **Il valore
non e' accorgersene: e' accorgersene PRIMA che serva.**

    python3 sonda_prontezza.py              le fonti rispondono? (~2 s, nessun download)
    python3 sonda_prontezza.py --silenzioso  una riga sola se non e' cambiato niente
    python3 sonda_mestiere.py               + prova il lavoro vero, a cache FREDDA

DUE FILE, E IL CONFINE E' VERO. Qui dentro c'e' solo libreria standard, apposta: questa
sonda la chiama OGNI macchina, compreso il runner della CI, che fastf1 non ce l'ha e non
deve averlo. La prova del mestiere invece carica una sessione vera, quindi fastf1 le
serve — e vive in `sonda_mestiere.py`, che lo chiama solo la macchina che pubblica
(`scheduling/prontezza_run.sh`, dalla crontab del VPS). Non e' una divisione estetica:
tenerle insieme faceva dichiarare fastf1 all'ambiente del banco, cioe' pretendere su un
runner CI pulito una libreria che li' non serve a niente — e `test_dipendenze.py` lo ha
detto subito, com'e' giusto.

ESCE 1 SE C'E' UN ROSSO. I wrapper la chiamano e scrivono nel log; non ferma niente, come
s46 — qui la sonda SCRIVE, chi decide e' chi legge.

PERCHE' «A CACHE FREDDA», e non e' un dettaglio. Con la cache calda il VPS avrebbe
caricato la sessione anche col 403 attivo — e infatti e' esattamente cosi' che funziona
il ponte del Mac. Una prova che passa grazie alla cache non dice niente sulla rete: e' la
versione automatica dell'errore che ho fatto io. Percio' `--mestiere` usa una cartella
temporanea e la butta.

PERCHE' PARLA POCO, ANCHE QUANDO E' ROSSA. Una sonda che urla a ogni giro viene spenta —
lo dice gia' sonda_deploy.sh di se stessa, ed era diventato il suo caso. Qui il verdetto
si ricorda in data/.prontezza_stato.json (per-macchina, gitignored) e il blocco lungo esce
solo quando CAMBIA qualcosa. Un rosso che dura — come il 403 sul VPS, finche' nessuno lo
risolve — resta visibile su UNA riga, con da quanto dura e che cosa e' rosso. Non e'
indulgenza: una notizia vecchia ripetuta a voce alta ogni mezz'ora smette di essere
letta, e allora non si legge nemmeno quella nuova.
"""
from __future__ import annotations
import os
import sys
import json
import time
import socket
import argparse
import urllib.error
import urllib.request

_QUI = os.path.dirname(os.path.abspath(__file__))
STATO = os.path.join(_QUI, "data", ".prontezza_stato.json")

ROSSO, VERDE, GIALLO = "ROSSO", "VERDE", "SOSPESO"
_COL = {ROSSO: "\033[31m", VERDE: "\033[32m", GIALLO: "\033[33m"}


def _tinta(stato):
    if not sys.stdout.isatty():
        return f"{stato:<7}"
    return f"{_COL[stato]}{stato}\033[0m" + " " * max(1, 8 - len(stato))


# ============================================================== LE FONTI DICHIARATE
#
# Ognuna porta CHI la usa e COSA SI FERMA senza: una sonda che dice «403» e basta
# lascia la diagnosi a chi legge, ed e' il momento in cui si legge peggio (weekend
# cominciato, di fretta). Il campo `chiave` e' una stringa che DEVE comparire nel
# codice vivo: ci si appoggia test_prontezza.py per accorgersi se un giorno questa
# tabella e il repo raccontassero due cose diverse — il difetto delle seconde verita',
# che qui dentro e' gia' costato sei volte.
FONTI = [
    {
        "nome": "livetiming.formula1.com",
        "url": "https://livetiming.formula1.com/static/2026/Index.json",
        "chiave": "livetiming.formula1.com",
        "usata_da": "FastF1 — giri, telemetria, race control: tutta la gara",
        "senza": "nessuna sessione pubblicabile, e in redazione solo cio' che non passa "
                 "da FastF1",
        "bloccante": True,
    },
    {
        "nome": "api.openf1.org",
        "url": "https://api.openf1.org/v1/sessions?session_key=latest",
        "chiave": "api.openf1.org",
        "usata_da": "collettore live (MQTT) e API di riserva",
        "senza": "niente live timing in diretta",
        "bloccante": True,
    },
    {
        "nome": "www.fia.com",
        "url": "https://www.fia.com/documents",
        "chiave": "www.fia.com",
        "usata_da": "ai_lab/redazione/fia_cp.py — i documenti FIA",
        "senza": "niente anteprima del weekend (Car Presentation Submissions)",
        "bloccante": True,
    },
    {
        "nome": "api.github.com",
        "url": "https://api.github.com/repos/f1db/f1db/releases/latest",
        "chiave": "api.github.com",
        "usata_da": "f1db_zip.py — classifiche, pit-lane, griglie",
        "senza": "la seconda ondata post-gara non arriva",
        "bloccante": True,
    },
    {
        # DICHIARATA ANCHE SE NON FERMA NIENTE, ed e' il punto del campo `bloccante`.
        # gen_foto.py va in rete e auto_gara.py lo sa gia' («un singolo intoppo di rete
        # su gen_foto avrebbe congelato...»): un rosso qui direbbe «fermi tutti» per una
        # foto che non si aggiorna, e un allarme che esagera si smette di leggerlo.
        # Tacere pero' sarebbe peggio: diventerebbe una dipendenza di rete che nessuno
        # sorveglia, cioe' esattamente com'era livetiming prima del 21/08/2026.
        "nome": "commons.wikimedia.org",
        "url": "https://commons.wikimedia.org/w/api.php?action=query&format=json&meta=siteinfo",
        "chiave": "commons.wikimedia.org",
        "usata_da": "gen_foto.py — i ritratti dei piloti",
        "senza": "le foto non si aggiornano; la gara esce lo stesso",
        "bloccante": False,
    },
]

# La chiave LLM non si stampa MAI, nemmeno mascherata: si dice solo se c'e'. Il nome
# della variabile e' l'unica cosa che compare.
CHIAVE_LLM = "ANTHROPIC_API_KEY"


def _http(url, timeout=20):
    """(codice, nota). Nessuna eccezione esce di qui: un errore e' uno stato."""
    req = urllib.request.Request(url, headers={"User-Agent": "muretto-sonda-prontezza"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, f"{time.time() - t0:.1f}s"
    except urllib.error.HTTPError as e:
        return e.code, f"{time.time() - t0:.1f}s"
    except (urllib.error.URLError, socket.timeout, OSError) as e:
        motivo = getattr(e, "reason", e)
        return None, f"irraggiungibile ({type(motivo).__name__}: {str(motivo)[:60]})"


def controlla_fonti():
    esiti = []
    for f in FONTI:
        codice, nota = _http(f["url"])
        if codice is None:
            stato = ROSSO if f.get("bloccante", True) else GIALLO
            riga = f"{f['nome']} — {nota}. Senza: {f['senza']}"
        elif 200 <= codice < 400:
            stato = VERDE
            riga = f"{f['nome']} — HTTP {codice} in {nota}"
        else:
            stato = ROSSO if f.get("bloccante", True) else GIALLO
            riga = (f"{f['nome']} — HTTP {codice}. "
                    f"La usa: {f['usata_da']}. Senza: {f['senza']}")
        esiti.append((stato, riga, f["nome"]))
    return esiti


def controlla_chiave():
    if os.environ.get(CHIAVE_LLM):
        return (VERDE, f"{CHIAVE_LLM} presente nell'ambiente", "chiave")
    # NON e' un rosso: molti lanci legittimi non ce l'hanno (un giro a mano, la CI).
    # E' giallo perche' il guasto vero — cron senza chiave — lo vede il wrapper, che la
    # carica lui da ~/.muretto_env e scrive «LLM: ASSENTE» nel suo log.
    return (GIALLO, f"{CHIAVE_LLM} non nell'ambiente di questo lancio (i wrapper la "
                    f"caricano da ~/.muretto_env: e' li' che va guardata)", "chiave")


def controlla_cache():
    """Le cache devono esistere ED essere scrivibili. Una cache di sola lettura fa
    riscaricare tutto a ogni giro, in silenzio: piu' lento, mai rotto, mai notato."""
    esiti = []
    for etichetta, percorso in (
        ("cache condivisa", os.path.expanduser("~/muretto_shared/ff1_cache")),
        ("cache di gen_giri", os.path.join(_QUI, "data", "ff1_cache")),
    ):
        if not os.path.isdir(percorso):
            esiti.append((GIALLO, f"{etichetta}: non esiste ancora ({percorso})", etichetta))
            continue
        if not os.access(percorso, os.W_OK):
            esiti.append((ROSSO, f"{etichetta}: NON scrivibile ({percorso})", etichetta))
            continue
        libero = None
        try:
            st = os.statvfs(percorso)
            libero = st.f_bavail * st.f_frsize / 1e9
        except OSError:
            pass
        if libero is not None and libero < 2.0:
            esiti.append((ROSSO, f"{etichetta}: solo {libero:.1f} GB liberi — una gara "
                                 f"con telemetria ne chiede ~0,3", etichetta))
        else:
            spazio = f", {libero:.0f} GB liberi" if libero is not None else ""
            esiti.append((VERDE, f"{etichetta}: scrivibile{spazio}", etichetta))
    return esiti


def _leggi_stato():
    try:
        return json.load(open(STATO))
    except Exception:
        return {}


def _scrivi_stato(d):
    try:
        os.makedirs(os.path.dirname(STATO), exist_ok=True)
        json.dump(d, open(STATO, "w"), indent=1, sort_keys=True)
    except OSError:
        pass                                # non poter ricordare non e' un guasto da urlare


def main():
    ap = argparse.ArgumentParser(
        description="Questa macchina saprebbe fare il suo mestiere? (fonti + prova vera)")
    ap.add_argument("--silenzioso", action="store_true",
                    help="una riga sola quando il verdetto non e' cambiato")
    a = ap.parse_args()

    esiti = controlla_fonti() + [controlla_chiave()] + controlla_cache()

    rossi = [e for e in esiti if e[0] == ROSSO]
    verdetto = ROSSO if rossi else VERDE
    ora = {n: s for s, _, n in esiti}
    prima = _leggi_stato()
    cambiato = {n for n in ora if prima.get("voci", {}).get(n) != ora[n]}
    adesso = time.strftime("%Y-%m-%d %H:%M:%S")
    dal = adesso if (prima.get("verdetto") != verdetto or cambiato) else prima.get("dal", adesso)
    _scrivi_stato({"verdetto": verdetto, "voci": ora, "quando": adesso, "dal": dal})

    # SI PARLA SOLO SE C'E' QUALCOSA DA DIRE. Verde stabile = una riga; un cambio, o un
    # rosso, o un lancio a mano = tutto il quadro. Un guardiano che urla sempre viene
    # spento, e allora tace anche il giorno in cui aveva ragione.
    if a.silenzioso and not cambiato:
        nomi = ", ".join(n for s_, _, n in esiti if s_ == ROSSO)
        da = prima.get("dal") or "poco"
        print(f"{_tinta(verdetto)} prontezza: invariata da {da} ({len(esiti)} controlli"
              + (f", rossi: {nomi}" if nomi else ", nessun rosso") + ")")
        return 0

    for stato, riga, nome in esiti:
        marchio = " <-- CAMBIATO" if nome in cambiato and prima else ""
        print(f"{_tinta(stato)} {riga}{marchio}")

    if rossi:
        print()
        print(f"{_tinta(ROSSO)} QUESTA MACCHINA NON E' PRONTA: {len(rossi)} controlli rossi.")
        print("        Non e' una configurazione da sistemare con calma: e' il lavoro che")
        print("        non si puo' fare. Se e' venerdi', e' gia' tardi.")
        return 1
    print()
    print(f"{_tinta(VERDE)} pronta: {len(esiti)} controlli, nessun rosso "
          f"(la prova del mestiere la fa sonda_mestiere.py)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
