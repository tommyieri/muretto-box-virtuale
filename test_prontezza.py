#!/usr/bin/env python3
"""test_prontezza.py — la guardia della guardia.

`sonda_prontezza.py` chiede se una macchina saprebbe fare il suo mestiere. Questa
sentinella chiede se QUALCUNO STA ANCORA FACENDO QUELLA DOMANDA — e non e' pignoleria:
in questo repo un aggancio tolto in un riordino e' gia' costato giorni di pubblicazioni
con codice vecchio, ed e' la ragione per cui s46 controlla di essere chiamata invece di
limitarsi a funzionare.

    python3 test_prontezza.py

COSA CONTROLLA
  A. ogni wrapper di cron che si aggiorna da solo CHIAMA la sonda
  B. la riga settimanale c'e', e la sonda che lancia prova a cache FREDDA
  C. ogni fonte DICHIARATA nella sonda compare davvero nel codice vivo
  D. ogni host che il codice vivo interroga e' DICHIARATO nella sonda
  E. lo stato per-macchina non e' tracciato da git

C e D sono le due meta' della stessa cosa e servono tutt'e due. Senza C la sonda puo'
sorvegliare una fonte che nessuno usa piu' — rumore che insegna a non leggerla. Senza D
si puo' aggiungere una dipendenza di rete che nessuno sorveglia, che e' esattamente come
e' nato il guasto del 21/08/2026: nessuno guardava livetiming.formula1.com perche'
nessuno aveva mai scritto da nessuna parte che il lavoro dipendeva da lui.

COSA NON CONTROLLA, E VA DETTO: non apre una rete. Non sa se oggi una fonte risponde —
quella e' la sonda, e la sonda gira SULLE MACCHINE, perche' la risposta e' diversa su
ognuna. Qui si controlla il meccanismo, non il mondo.
"""
from __future__ import annotations
import os
import re
import sys
import subprocess

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)

import sonda_prontezza                                             # noqa: E402

rosse = 0


def esito(ok, testo):
    global rosse
    if not ok:
        rosse += 1
    print(f"{'PASSA ' if ok else 'FALLITO'}  {testo}")


def leggi(*pezzi):
    try:
        return open(os.path.join(_QUI, *pezzi), encoding="utf-8").read()
    except OSError:
        return ""


# ============================================ A. i wrapper chiamano ancora la sonda
#
# I WRAPPER SI CALCOLANO, non si elencano: un elenco a mano invecchia al primo wrapper
# nuovo e allora dichiara una copertura che non ha. Il criterio e' lo stesso di s46 —
# «si aggiorna da solo» vuol dire che porta un `merge --ff-only`, cioe' che quella
# macchina esegue codice che cambia sotto i piedi.
SCHED = os.path.join(_QUI, "scheduling")
wrapper = []
if os.path.isdir(SCHED):
    for nome in sorted(os.listdir(SCHED)):
        if not nome.endswith("_run.sh"):
            continue
        testo = leggi("scheduling", nome)
        if "merge --ff-only" in testo:
            wrapper.append((nome, testo))

esito(len(wrapper) > 0,
      f"scheduling/ contiene wrapper che si aggiornano da soli ({len(wrapper)})")

MARCATORE = "prontezza delle fonti (sonda_prontezza)"
for nome, testo in wrapper:
    esito(MARCATORE in testo,
          f"scheduling/{nome}: chiama la sonda di prontezza (riga «{MARCATORE}») — "
          f"un wrapper che pubblica senza aver chiesto se le fonti rispondono è "
          f"esattamente lo stato del 21/08/2026")
    # E DEVE POTER DIRE CHE MANCA. Se un giorno il file della sonda sparisse dal
    # checkout, il wrapper deve gridarlo invece di saltare la riga in silenzio: una
    # guardia muta è peggio di nessuna guardia, perché si crede di essere sorvegliati.
    esito("sonda_prontezza ASSENTE" in testo,
          f"scheduling/{nome}: dichiara nel log se la sonda manca dal checkout")


# ==================================== B. la domanda settimanale, PRIMA del weekend
cron = leggi("scheduling", "vps.cron")
esito("prontezza_run.sh" in cron,
      "scheduling/vps.cron porta la riga settimanale di prontezza — è la metà che vale "
      "di più: i wrapper si accorgono del guasto quando è già in corso, questa mentre "
      "c'è ancora tempo per rimediare")
riga = next((r for r in cron.splitlines()
             if "prontezza_run.sh" in r and not r.lstrip().startswith("#")), "")
campi = riga.split()[:5]
ogni_giorno = len(campi) == 5 and campi[2] == "*" and campi[4] == "*"
esito(bool(riga) and not ogni_giorno,
      "la riga di prontezza NON gira ogni giorno: un guardiano che parla troppo viene "
      f"spento, e allora tace anche il giorno in cui aveva ragione ({' '.join(campi) or 'riga assente'})")
wrapper_sett = leggi("scheduling", "prontezza_run.sh")
lanciata = re.findall(r"\b(sonda_[a-z_]+\.py)", wrapper_sett)
esito(bool(lanciata),
      "scheduling/prontezza_run.sh lancia una sonda — senza, la riga settimanale "
      "verifica una configurazione invece del lavoro, che è l'errore da cui nasce "
      "tutto questo")
# E LA PROVA DEVE RESTARE A CACHE FREDDA. È l'unica riga che la rende una prova: con la
# cache calda passerebbe anche a rete morta — sul VPS passa così ogni giorno, grazie al
# ponte del Mac. Toglierla non romperebbe niente, e la sonda direbbe «pronta» a una
# macchina che non lo è: cioè la versione automatica dell'errore del 21/08/2026.
for nome_sonda in lanciata:
    esito("mkdtemp" in leggi(nome_sonda),
          f"{nome_sonda} prova a CACHE FREDDA (cartella temporanea) — con la cache calda "
          f"la prova passa anche a rete morta, e allora non prova niente")


# ======================== C/D. la tabella delle fonti e il codice vivo si somigliano
#
# «Codice vivo» qui vuol dire: i sorgenti del repo, esclusi archivio, cache, prove e
# questa sonda stessa (altrimenti la tabella confermerebbe se stessa).
ESCLUSI = (".git", "node_modules", ".venv", "archivio", "prove", "bozze", "ff1_cache")
sorgenti = []
for radice, cartelle, file in os.walk(_QUI):
    cartelle[:] = [c for c in cartelle if not any(x in c for x in ESCLUSI)
                   and not c.startswith(".")]
    for f in file:
        if not f.endswith((".py", ".mjs", ".sh")):
            continue
        if f in ("sonda_prontezza.py", "test_prontezza.py"):
            continue
        sorgenti.append(os.path.join(radice, f))
testo_vivo = "\n".join(leggi(os.path.relpath(p, _QUI)) for p in sorgenti)

for f in sonda_prontezza.FONTI:
    esito(f["chiave"] in testo_vivo,
          f"la fonte «{f['nome']}» è usata da qualcuno nel codice vivo — se non lo è "
          f"più, va tolta dalla sonda: sorvegliare una fonte morta è rumore, e il "
          f"rumore insegna a non leggere gli allarmi")

# I DUE HOST CHE NON SONO FONTI DI DATI, e vanno detti invece che dimenticati:
# murettobox.com è il NOSTRO sito (lo guarda già sonda_deploy.sh, con una domanda
# diversa: «l'online è main?»), e i due host dei font sono del browser, non della
# catena — se cadono si vede una pagina più brutta, non un dato mancante.
NON_FONTI = {"murettobox.com", "fonts.googleapis.com", "fonts.gstatic.com",
             "schema.org", "www.w3.org", "graph.facebook.com", "www.wikidata.org",
             "raw.githubusercontent.com", "github.com", "vercel.com", "api.ipify.org",
             "api.anthropic.com", "www.gstatic.com", "api.jolpi.ca"}

# E OGNI FONTE DEVE DIRE SE FERMA O DEGRADA. Senza questo campo il valore di default
# sarebbe «ferma», e prima o poi qualcuno dichiarerebbe come bloccante una dipendenza
# che non lo e': un rosso che non ferma niente e' rumore, e il rumore spegne gli
# allarmi veri — e' la stessa ragione per cui l'avviso di analisi.html si accende
# solo quando e' vero.
for f in sonda_prontezza.FONTI:
    esito(isinstance(f.get("bloccante"), bool),
          f"la fonte «{f['nome']}» dichiara se il suo guasto FERMA il weekend o lo "
          f"degrada soltanto")
dichiarate = {f["chiave"] for f in sonda_prontezza.FONTI}
trovati = set(re.findall(r"https://([a-zA-Z0-9._-]+)", testo_vivo))
# I finti (test) e i sottodomini di esempio non contano: portano «finto» o «esempio».
sconosciuti = sorted(h for h in trovati
                     if h not in dichiarate and h not in NON_FONTI
                     and "finto" not in h and "esempio" not in h
                     and "upstash" not in h and "localhost" not in h)
esito(not sconosciuti,
      "ogni host interrogato dal codice vivo è dichiarato nella sonda (o messo fra i "
      "non-fonti, con la ragione scritta)"
      + (f"\n           non dichiarati: {', '.join(sconosciuti)}" if sconosciuti else ""))


# =========================================== E. lo stato per-macchina non è tracciato
def _tracciato(percorso):
    r = subprocess.run(["git", "ls-files", "--error-unmatch", percorso],
                       cwd=_QUI, capture_output=True)
    return r.returncode == 0


esito(not _tracciato("data/.prontezza_stato.json"),
      "lo stato della sonda NON è tracciato da git: è per-macchina, e committarlo "
      "farebbe raccontare a una macchina lo stato di un'altra")

print()
if rosse:
    print(f"sentinella prontezza: {rosse} ROSSE")
    raise SystemExit(1)
print("sentinella prontezza: tutto verde — la domanda si fa ancora, si fa prima del "
      "weekend, e la tabella delle fonti non è una seconda verità.")
