"""
voce.py — la guida editoriale come oggetto: caricata, impronta calcolata, servita.

La guida vive in tre file dentro voce/: VOCE.md (la legge in prosa), GLOSSARIO.md
(la terminologia e il 2026) e lessico.json (le liste che il correttore applica).
Questo modulo li mette insieme, li serve a chi scrive e calcola l'impronta sha256 di
quello che ha servito.

PERCHE' L'IMPRONTA. Un articolo di luglio e uno di settembre devono poter dire sotto
quale legge sono stati scritti. L'impronta finisce nel diario di ogni chiamata: se
fra sei mesi la voce cambia e un pezzo vecchio sembra fuori norma, si sa perche'.
E' lo stesso principio del sigillo del laboratorio, applicato allo stile.

PERCHE' I PROMPT STANNO IN GIT E NON NELLA CONSOLE. La Console non versiona i prompt
in modo raggiungibile da uno script — il Workbench legacy, che aveva prompt salvati,
variabili ed eval, chiude il 17 agosto 2026, e l'Admin API non espone nessun
endpoint di prompt. Ma soprattutto: il prompt caching richiede che il prefisso sia
identico byte per byte, e l'unico posto dove un byte non cambia da solo e' un file
committato.

UNA NOTA DI FORMA che vale piu' di quanto sembri: la guida e' scritta in PROSA, con
poche liste. La documentazione di prompting lo dice esplicitamente — «match your
prompt style to the desired output»: se la legge e' scritta a elenchi puntati, gli
articoli escono a elenchi puntati.
"""
from __future__ import annotations
import os
import json
import hashlib

_QUI = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(_QUI, "voce")

GUIDA = os.path.join(DIR, "VOCE.md")
GLOSSARIO = os.path.join(DIR, "GLOSSARIO.md")
LESSICO = os.path.join(DIR, "lessico.json")

_cache = {}


def _leggi(p):
    if p not in _cache:
        with open(p, encoding="utf-8") as f:
            _cache[p] = f.read()
    return _cache[p]


def guida():
    return _leggi(GUIDA)


def glossario():
    return _leggi(GLOSSARIO)


def lessico():
    return json.loads(_leggi(LESSICO))


def divieti():
    """Le liste chiuse, rese in prosa compatta: e' cio' che un modello applica
    meglio di una tabella JSON, e sta nello stesso blocco cacheato."""
    L = lessico()
    def riga(titolo, voci):
        return f"{titolo}: " + " · ".join(voci) + "."
    return "\n\n".join([
        "## Liste chiuse (la forma controllata a macchina sta in voce/lessico.json)",
        riga("Formule da testo generato, vietate", L["formule_ia"]["espressioni"]),
        riga("Cliche' della stampa di settore, vietati", L["cliche_f1"]["espressioni"]),
        riga("Aggettivi ammessi solo con una misura nella stessa frase",
             L["aggettivi_valutativi"]["lemmi"]),
        riga("Titoli di sezione vietati", L["formule_ia"]["titoli_vietati"]),
        riga("Soggetti vietati per la prima frase",
             L["soggetti_vietati_incipit"]["lemmi"]),
        riga("Prestiti inglesi ammessi (tutti gli altri si dicono in italiano)",
             L["anglicismi"]["prestiti_ammessi"]),
        "Anglicismi con resa italiana obbligatoria: " + " · ".join(
            f"{k} = {v}" for k, v in L["anglicismi"]["sostituzioni"].items()) + ".",
    ])


def testo_completo():
    """Il blocco di system che riceve chi scrive: legge, glossario, liste. E' il
    prefisso cacheato, quindi non deve contenere NIENTE di variabile — niente date,
    niente id, niente contatori: un solo carattere che cambia e la cache salta."""
    return "\n\n---\n\n".join([guida(), glossario(), divieti()])


def impronta():
    """sha256 (primi 12) del testo servito. Cambia se cambia la voce."""
    return hashlib.sha256(testo_completo().encode("utf-8")).hexdigest()[:12]


def peso_token():
    """Stima grossolana dei token del blocco: serve solo a sapere se sta sopra la
    soglia minima di cache (512 token su Opus 5, 4.096 su Haiku 4.5)."""
    return len(testo_completo()) // 4


if __name__ == "__main__":
    t = testo_completo()
    print(f"voce: {len(t)} caratteri · ~{peso_token()} token · impronta {impronta()}")
    print(f"  {GUIDA}: {len(guida())} car.")
    print(f"  {GLOSSARIO}: {len(glossario())} car.")
    print(f"  {LESSICO}: {len(json.dumps(lessico()))} car. -> {len(divieti())} car. resi")
