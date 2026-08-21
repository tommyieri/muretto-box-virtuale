"""scalda_cache.py — il Mac scarica i dati F1, il VPS li pubblica.

PERCHE' ESISTE, e non e' una comodita'. Dal 21/08/2026 il CDN di F1 (CloudFront)
risponde **403 all'indirizzo del VPS** su livetiming.formula1.com: stabile su piu'
tentativi, indipendente dallo user-agent, mentre l'uscita generica del VPS funziona.
E' un blocco per indirizzo, di quelli che le reti da datacenter si prendono in blocco.
Misurato affiancando le due macchine sulla stessa URL nello stesso momento:

    Mac  (residenziale) -> HTTP 200
    VPS  (Hetzner)      -> HTTP 403

L'Ungheria il VPS l'aveva scaricata da solo (la sua cache si ferma al 26/07, 15:30):
il blocco e' arrivato dopo, e l'Olanda e' il primo weekend che lo incontra. Senza
questo ponte il VPS non pubblica NESSUNA sessione — non le libere, non la gara — e la
redazione non scrive niente che dipenda da FastF1.

COSA FA. Sul Mac, dove la rete passa, scalda la cache FastF1 del Gran Premio in corso
e la spedisce al VPS, che da li' in poi lavora **offline**: FastF1 legge i suoi
`.ff1pkl` e non tocca la rete. Provato prima di scriverlo — 693 giri e la telemetria
del giro veloce caricati dal VPS col 403 ancora attivo.

CHE COSA NON E'. Non e' la riparazione: e' un ponte. Rimette il Mac nel percorso
critico, cioe' esattamente la dipendenza che il trasloco del 10/08/2026 aveva tolto
(«un weekend col Mac spento = niente articoli e due pagine ferme, in silenzio»). Il
Mac spento adesso torna a costare una sessione. La riparazione vera e' far uscire il
VPS da quel blocco, o spostare chi scarica; questo tiene in piedi il weekend intanto.

    python3 scalda_cache.py                 # GP attivo: scalda e spedisce
    python3 scalda_cache.py --solo-locale   # scalda e basta (nessuna rete verso il VPS)
    python3 scalda_cache.py --gara Olanda --anno 2026
    python3 scalda_cache.py --dry-run       # dice che cosa farebbe

Log: data/scalda_cache.log (ci scrive il wrapper, non questo file).
"""
from __future__ import annotations
import os
import sys
import time
import json
import shlex
import argparse
import datetime
import subprocess

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
sys.path.insert(0, os.path.join(_QUI, "ai_lab", "redazione"))

# LE DUE LISTE NON SI RISCRIVONO A MANO. Quali sessioni esistono lo sa gen_giri.py, e
# qual e' il weekend attivo lo sa auto_articoli.py: sono gia' la sorgente per chi
# pubblica, e una seconda copia qui si disallineerebbe al primo cambio di calendario.
import gen_giri                                              # noqa: E402  (SESSIONI)
from auto_articoli import gp_attivo                          # noqa: E402

CALENDARIO = os.path.join(_QUI, "demo", "data", "calendario_2026.json")

# Dove sta la cache. SONO DUE, e il ponte serve tutt'e due invece di far finta che ne
# esista una: `gen_giri.py --cache` vale <repo>/data/ff1_cache (e auto_gara.py lo
# invoca senza passare l'opzione, quindi e' quella), mentre la redazione usa la cache
# condivisa (ai_lab/redazione/tele.py::CACHE). Unificarle e' una modifica al codice di
# chi pubblica, e non si fa a weekend cominciato.
CACHE_CONDIVISA = os.path.expanduser("~/muretto_shared/ff1_cache")
CACHE_REPO_REL = os.path.join("data", "ff1_cache")

VPS = os.environ.get("MURETTO_VPS", "muretto@167.233.236.186")
VPS_CONDIVISA = "muretto_shared/ff1_cache"                   # relativa alla home del VPS
VPS_REPO = "muretto/data/ff1_cache"

SSH = ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=15"]

# IL SUPERINSIEME DELLE OPZIONI, non quelle di un consumatore solo. FastF1 mette in
# cache per TIPO di dato: se un generatore chiede qualcosa che non c'e', va in rete —
# e in rete, dal VPS, c'e' il 403. Un dato mancante diventerebbe un fallimento, non un
# caricamento piu' lento. Qui dentro c'e' l'unione di cio' che chiedono gen_giri.py
# (telemetry, messages), ai_lab/redazione/tele.py (telemetry, laps) e i tre generatori
# del pit-loss (weather).
CARICA = dict(telemetry=True, laps=True, weather=True, messages=True)


def _calendario():
    try:
        return json.load(open(CALENDARIO)).get("gare", []) or []
    except Exception as e:
        print(f"calendario illeggibile ({type(e).__name__}): {e}", file=sys.stderr)
        return []


def _voce_gara(nome):
    for g in _calendario():
        if g.get("nome") == nome:
            return g
    return None


def _cartella_evento(cache, anno, rnd):
    """La cartella che FastF1 usa per QUELL'evento, chiesta a FastF1 e non indovinata.

    Il nome e' `<anno>/<data>_<Nome_Ufficiale>/`: comporlo a mano vorrebbe dire
    ricostruire il nome ufficiale del Gran Premio, che e' un dato della sorgente."""
    import fastf1
    fastf1.Cache.enable_cache(cache)
    ev = fastf1.get_event(anno, rnd)
    nome = str(ev["EventName"]).replace(" ", "_")
    data = ev["EventDate"].strftime("%Y-%m-%d")
    return os.path.join(str(anno), f"{data}_{nome}")


def scalda(anno, rnd, gara, solo=None):
    """Scalda la cache locale. Ritorna (fatte, assenti): due liste di sigle.

    UNA SESSIONE CHE NON C'E' NON E' UN GUASTO: al venerdi' la gara non esiste ancora.
    Si dichiara e si va avanti — al giro dopo ci riprova, come fa il resto della catena.
    """
    import fastf1
    import logging
    import warnings
    warnings.filterwarnings("ignore")
    logging.getLogger("fastf1").setLevel(logging.ERROR)
    fastf1.Cache.enable_cache(CACHE_CONDIVISA)

    fatte, assenti = [], []
    for sess_ff, nome in gen_giri.SESSIONI:
        if solo and sess_ff not in solo and nome not in solo:
            continue
        t0 = time.time()
        try:
            s = fastf1.get_session(anno, rnd, sess_ff)
            s.load(**CARICA)
            n = len(s.laps)
        except Exception as e:
            assenti.append(sess_ff)
            print(f"  · {gara} {sess_ff}: non ancora disponibile ({type(e).__name__})")
            continue
        if not n:
            assenti.append(sess_ff)
            print(f"  · {gara} {sess_ff}: caricata ma senza giri — non la conto")
            continue
        fatte.append(sess_ff)
        print(f"  ✓ {gara} {sess_ff}: {n} giri, {s.laps['Driver'].nunique()} piloti, "
              f"{time.time() - t0:.0f}s")
    return fatte, assenti


def _misura(percorso):
    tot = 0
    for radice, _, file in os.walk(percorso):
        for f in file:
            try:
                tot += os.path.getsize(os.path.join(radice, f))
            except OSError:
                pass
    return tot


def spedisci(sotto, dry_run=False):
    """rsync della cartella dell'evento verso il VPS, nelle DUE cache.

    Il secondo passo e' una copia LOCALE sul VPS (stessa macchina, stesso filesystem):
    spedire due volte gli stessi 46 MB a sessione sarebbe pagare due volte la parte
    cara. `-a` conserva i tempi, che e' come FastF1 decide se un file e' buono."""
    sorgente = os.path.join(CACHE_CONDIVISA, sotto) + os.sep
    if not os.path.isdir(sorgente):
        print(f"  niente da spedire: {sorgente} non esiste")
        return False
    peso = _misura(sorgente)
    dest = f"{VPS}:{VPS_CONDIVISA}/{sotto}/"
    rsync = ["rsync", "-az", "--stats", "-e", " ".join(shlex.quote(x) for x in SSH),
             sorgente, dest]
    if dry_run:
        print(f"  [dry-run] {peso/1e6:.1f} MB -> {dest}")
        print(f"  [dry-run] poi, sul VPS: {VPS_CONDIVISA}/{sotto} -> {VPS_REPO}/{sotto}")
        return True

    t0 = time.time()
    r = subprocess.run(rsync, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"  !! rsync fallito (codice {r.returncode}): {r.stderr.strip()[:300]}")
        return False
    sul_filo = ""
    for riga in r.stdout.splitlines():
        if riga.startswith("Total sent:"):
            sul_filo = riga.split(":", 1)[1].strip()
    print(f"  spediti {peso/1e6:.1f} MB ({sul_filo} sul filo) in {time.time()-t0:.0f}s")

    # La seconda cache, quella che gen_giri.py legge davvero quando auto_gara lo chiama.
    remoto = (f"mkdir -p ~/{VPS_REPO}/{sotto} && "
              f"rsync -a ~/{VPS_CONDIVISA}/{sotto}/ ~/{VPS_REPO}/{sotto}/")
    r2 = subprocess.run(SSH + [VPS, remoto], capture_output=True, text=True)
    if r2.returncode != 0:
        print(f"  !! copia nella cache di gen_giri fallita: {r2.stderr.strip()[:300]}")
        return False
    print(f"  copiata anche in ~/{VPS_REPO}/{sotto} (gen_giri.py legge quella)")
    return True


def main():
    ap = argparse.ArgumentParser(
        description="Scalda la cache FastF1 sul Mac e la spedisce al VPS (che e' bloccato dal CDN)")
    ap.add_argument("--gara", default=None, help="forza il GP; default = weekend attivo")
    ap.add_argument("--anno", type=int, default=datetime.date.today().year)
    ap.add_argument("--sessione", default=None,
                    help="una sola sessione (FP1, SQ, S, Q, R o il nome lungo)")
    ap.add_argument("--solo-locale", action="store_true",
                    help="scalda e basta: non spedisce niente al VPS")
    ap.add_argument("--dry-run", action="store_true", help="dice solo cosa farebbe")
    a = ap.parse_args()

    gara = a.gara or gp_attivo()
    if not gara:
        print("nessun GP del weekend in corso (calendario): esco.")
        return 0
    voce = _voce_gara(gara)
    if not voce or not voce.get("round"):
        print(f"«{gara}» non e' nel calendario {a.anno} o non ha un round: esco.")
        return 1
    rnd = voce["round"]
    print(f"GP in corso: {gara} (round {rnd}, {voce.get('circuito')})")

    solo = {a.sessione, (a.sessione or "").upper()} if a.sessione else None
    fatte, assenti = scalda(a.anno, rnd, gara, solo=solo)
    print(f"scaldate: {fatte or '-'} · non ancora disponibili: {assenti or '-'}")
    if not fatte:
        print("niente di nuovo da spedire: ritento al prossimo giro.")
        return 0
    if a.solo_locale:
        print("--solo-locale: mi fermo qui.")
        return 0

    try:
        sotto = _cartella_evento(CACHE_CONDIVISA, a.anno, rnd)
    except Exception as e:
        print(f"!! non so quale cartella ha usato FastF1 ({type(e).__name__}: {e}): "
              "non spedisco niente alla cieca.")
        return 1
    spedisci(sotto, dry_run=a.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
