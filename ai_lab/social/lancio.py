#!/usr/bin/env python3
"""lancio.py — il kit per aprire bottega: biografia, foto profilo, primi tre post.

I PRIMI TRE POST NON SONO CONTENUTI DI FORMULA 1. Un profilo vuoto che pubblica
subito un'analisi tecnica lascia il visitatore senza sapere dove e' finito. I tre
qui sotto rispondono, in ordine, alle tre domande che si fa chi arriva: **cos'e'
questa cosa**, **cosa sa fare**, **posso vederlo funzionare**.

E' anche la correzione del 18/08: la prima versione della griglia apriva con
«fermarsi ai box a Spa costa 18,40 secondi». Vero, misurato, e sbagliato come
primo post — quello e' un fatto di Formula 1, e noi non vendiamo fatti di Formula
1: vendiamo un posto dove decidere tu.

    python3 -m ai_lab.social.lancio            # scrive le bozze e stampa la bio
"""
from __future__ import annotations
import os

from . import fatti as F
from . import genera
from .fatti import Fatto

QUI = os.path.dirname(os.path.abspath(__file__))

# --------------------------------------------------------------- la biografia
# 150 caratteri, che e' il limite vero di Instagram. Tre righe: cosa e', per chi,
# e l'invito. Niente emoji di bandierine: il prodotto non le userebbe.
BIO = {
    "nome": "Muretto · Box Virtuale",
    "categoria consigliata": "Sito web di sport / Software",
    "biografia": (
        "Il muretto box decide la strategia. Qui la decidi tu.\n"
        "Rivedi ogni gara giro per giro e sposta la sosta:\n"
        "il motore ti dice dove rientri. ↓"
    ),
    "link": "https://murettobox.com",
    "note": [
        # IL CONTEGGIO SI CALCOLA. Qui c'era scritto «e' 147» a mano, e ne erano
        # 137: lo stesso errore che il resto del progetto vieta ovunque, fatto
        # nel file che spiega come presentarsi.
        None,   # riempita da _note() con la misura vera
        "La freccia in fondo punta al link: e' l'unico ornamento e ha una funzione.",
        "Categoria professionale, non «Personaggio pubblico»: cambia i dati che "
        "Instagram ti mostra e sblocca le statistiche che ci servono.",
    ],
}


def _misura_bio():
    """La nota sul limite di Instagram, col numero contato adesso."""
    n = len(BIO["biografia"])
    BIO["note"][0] = (f"Sta nei 150 caratteri di Instagram: sono {n}, "
                      f"ne restano {150 - n}.")
    return BIO


ALTERNATIVE_BIO = [
    "Sei tu al muretto.\nRivedi la gara giro per giro, decidi quando fermarti\ne guarda dove rientri. ↓",
    "Formula 1, dal lato del muretto box.\nSposti la sosta, il motore risponde\ncon i rivali al loro passo vero. ↓",
]


# ------------------------------------------------------------- i tre post
def _post_cosa_e() -> Fatto:
    return Fatto(
        tipo="presentazione", gara="",
        titolo="Sei tu al muretto",
        provenienza="murettobox.com · stagione 2026, tutte le gare corse",
        dati={
            "occhiello": "murettobox.com",
            "titolo_righe": ["sei tu", "al muretto."],
            "accento_riga": 1, "accento": "rosso",
            "sottotitolo": "In ogni gara di Formula 1 c'è un momento in cui qualcuno "
                           "decide di fermarsi ai box. Di solito quel qualcuno non sei tu.",
            "voci": [
                {"titolo": "rivedi la gara", "testo": "Giro per giro, dall'inizio alla fine."},
                {"titolo": "sposta la sosta", "testo": "Fermalo quando vuoi tu, non quando si è fermato davvero."},
                {"titolo": "guarda dove rientri", "testo": "Coi rivali al loro passo vero, non inventato."},
            ],
            "chiusa": "murettobox.com",
            "alt": "Presentazione del Muretto Box Virtuale: rivedi la gara, sposta la sosta, "
                   "guarda dove rientri.",
        },
        forza=1.0)


def _post_cosa_sa_fare() -> Fatto:
    return Fatto(
        tipo="presentazione", gara="",
        titolo="Tutta la stagione 2026, dentro",
        provenienza="murettobox.com · dati di cronometraggio ufficiali, gara per gara",
        dati={
            "occhiello": "cosa c'è dentro",
            "titolo_righe": ["tutta la stagione", "2026. dentro."],
            "accento_riga": 1, "accento": "ciano",
            "sottotitolo": "Non un riassunto: la gara intera, con tutto quello che serve "
                           "per capirla.",
            "voci": [
                {"titolo": "ogni giro di ogni gara", "testo": "Posizioni vere, ricostruite dal cronometraggio."},
                {"titolo": "la telemetria", "testo": "Velocità, gas, freno e marce di qualunque giro."},
                {"titolo": "il campionato", "testo": "Classifiche, piloti e squadre, aggiornati."},
            ],
            "chiusa": "e si aggiorna da solo, a ogni gara",
            "alt": "Cosa contiene il Muretto Box Virtuale: ogni giro di ogni gara, la "
                   "telemetria, il campionato.",
        },
        forza=0.95)


def kit(dove: str | None = None) -> dict:
    """Genera le bozze del kit e torna il riepilogo."""
    _misura_bio()
    fatti = [_post_cosa_e(), _post_cosa_sa_fare()]
    # il terzo post e' il PRODOTTO AL LAVORO: la scelta, dai dati veri.
    gare = F.gare_disponibili()
    scelte = F.scelta_del_muretto(gare[-1]) if gare else []
    if not scelte:
        for g in reversed(gare[:-1]):
            scelte = F.scelta_del_muretto(g)
            if scelte:
                break
    if scelte:
        fatti.append(scelte[0])

    fuori = []
    for f in fatti:
        p = genera.genera_uno(f, forza_rifare=True)
        if p:
            fuori.append(p)
    return {"bio": BIO, "alternative": ALTERNATIVE_BIO, "post": fuori}


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.abspath(os.path.join(QUI, "..", "..")))
    r = kit()
    print("=" * 68)
    print("BIOGRAFIA")
    print("=" * 68)
    print(f"nome:       {r['bio']['nome']}")
    print(f"categoria:  {r['bio']['categoria consigliata']}")
    print(f"link:       {r['bio']['link']}")
    print("biografia:")
    for riga in r["bio"]["biografia"].split("\n"):
        print(f"   {riga}")

    for n in r["bio"]["note"]:
        print(f"   · {n}")
    print("\nalternative:")
    for a in r["alternative"]:
        print("   ---")
        for riga in a.split("\n"):
            print(f"   {riga}")
    print("\n" + "=" * 68)
    print(f"I PRIMI {len(r['post'])} POST")
    print("=" * 68)
    for p in r["post"]:
        print(f"\n  {p['id']}")
        print(f"  {p['prima_riga']}")
        print(f"  immagine: ai_lab/social/bozze/{p['id']}/{p['immagini'][0]}")
