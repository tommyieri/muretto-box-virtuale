#!/usr/bin/env python3
"""didascalia.py — il testo sotto il post, e le etichette.

LA VOCE. E' quella della redazione (`ai_lab/redazione/voce/`): un ingegnere di
pista che spiega a un appassionato serio. Niente clickbait, niente maiuscole
urlate, niente «SHOCK», niente emoji a raffica. Il tono e' asciutto perche' il
prodotto lo e': l'unica promessa che facciamo e' che i numeri sono misurati.

PERCHE' NON C'E' UN LLM QUI DENTRO (per ora). Un modello scriverebbe didascalie
piu' varie, e ogni tanto scriverebbe una frase che il dato non sostiene — e su
Instagram quella frase non si corregge, si ripubblica. I modelli qui sotto sono
scritti a mano una volta, riempiti con numeri che vengono dai `Fatto`, e non
possono affermare nulla che il fatto non contenga. `arricchisci()` esiste per
quando si vorra' far rifinire il testo dall'LLM: passa dal correttore della
redazione e NON puo' introdurre cifre nuove (`_cifre_coerenti`).

GLI HASHTAG. Trenta hashtag generici portano bot, non pubblico: l'insieme qui
sotto e' corto e specifico. Il posto giusto per farsi trovare oggi e' il testo
del post e le prime parole della didascalia, non la coda di cancelletti.
"""
from __future__ import annotations
import re

MARCHIO = "murettobox.com"

# Hashtag: pochi e pertinenti. I primi tre sono quelli su cui vogliamo essere
# trovati, gli altri danno contesto.
BASE = ["#formula1", "#f1", "#strategia"]
CODA = ["#muretto", "#f1italia", "#pitstop", "#telemetria", "#gpf1"]
PER_TIPO = {
    "sosta": ["#pitstop", "#strategia", "#undercut"],
    "compagni": ["#teammates", "#passogara"],
    "mescole": ["#pirelli", "#gomme", "#degrado"],
    "classifica": ["#mondiale", "#classifica"],
    "numero": ["#dati", "#analisi"],
}

CHIUSA = ("Su {marchio} rivedi la gara giro per giro e sposti tu la sosta: "
          "il motore ti dice dove rientri.")


def _hashtag(fatto) -> str:
    tag = BASE + PER_TIPO.get(fatto.tipo, []) + CODA
    visti, fuori = set(), []
    for t in tag:
        if t not in visti:
            visti.add(t)
            fuori.append(t)
    return " ".join(fuori[:9])


# I modelli. Uno per tipo, e la prima riga e' sempre il gancio: su Instagram si
# vedono due righe prima del «altro», e il resto lo legge solo chi ha gia' deciso.
MODELLI = {
    "sosta": (
        "{titolo}\n\n"
        "Prima della sosta era {pos_prima}°, otto giri dopo — a ciclo di soste chiuso — "
        "{pos_dopo}°. La gara era in regime verde per tutta la finestra, quindi non c'e' "
        "una Safety Car a spiegare il salto: c'e' una decisione.\n\n"
        "E tu, l'avresti fermato al giro {giro}?"
    ),
    "compagni": (
        "{titolo}\n\n"
        "Stessa macchina, stesso giorno, stessa pista. Il numero non e' il giro veloce ma "
        "il passo mediano sui giri puliti: quello che conta su una gara intera.\n\n"
        "{davanti} chiude {pos_davanti}°, {dietro} {pos_dietro}°."
    ),
    "mescole": (
        "{titolo}\n\n"
        "Non la durata dichiarata: quella osservata, contando l'eta' della gomma nel "
        "momento in cui ognuno ha cambiato set. Dentro ci sono solo i cambi in regime "
        "verde — sotto Safety Car ci si ferma perche' conviene, non perche' la gomma e' finita."
    ),
    "classifica": (
        "{titolo}\n\n"
        "La classifica aggiornata al round {round}."
    ),
    "numero": (
        "{titolo}\n\n"
        "E' un numero misurato, non una stima a occhio: sotto al post trovi da dove viene. "
        "E' anche uno dei numeri con cui il simulatore risponde quando gli chiedi cosa "
        "succede se ti fermi adesso."
    ),
}


def _campi(fatto) -> dict:
    c = dict(fatto.dati)
    c.setdefault("titolo", fatto.titolo)
    c["titolo"] = fatto.titolo
    c["gara"] = fatto.gara
    c["marchio"] = MARCHIO
    return c


def scrivi(fatto, con_chiusa: bool = True) -> str:
    """La didascalia completa: gancio, spiegazione, invito, hashtag."""
    modello = MODELLI.get(fatto.tipo)
    if not modello:
        corpo = fatto.titolo
    else:
        try:
            corpo = modello.format(**_campi(fatto))
        except KeyError as e:
            # meglio una didascalia povera che una con {pos_prima} stampato dentro
            corpo = fatto.titolo
            print(f"[social] didascalia {fatto.tipo}: manca il campo {e}, uso il titolo")
    pezzi = [corpo]
    if con_chiusa:
        pezzi.append(CHIUSA.format(marchio=MARCHIO))
    pezzi.append(_hashtag(fatto))
    return "\n\n".join(pezzi)


def prima_riga(testo: str) -> str:
    """Cio' che si vede prima del «...altro». E' l'unica riga che leggeranno
    quasi tutti: vale la pena guardarla da sola."""
    return testo.strip().split("\n")[0]


# ------------------------------------------------------- il cancello sulle cifre
_NUMERO = re.compile(r"\d+(?:[.,]\d+)?")
_HASHTAG = re.compile(r"#\w+")


def cifre(testo: str) -> set:
    """I numeri dentro un testo, ESCLUSI quelli degli hashtag.

    Senza questa esclusione il cancello segnalava «1» come cifra inventata a ogni
    singolo post, perche' lo leggeva dentro #formula1 e #f1. Un allarme che suona
    sempre e' un allarme spento: dopo tre volte non lo guarda piu' nessuno."""
    return set(_NUMERO.findall(_HASHTAG.sub(" ", testo or "")))


def cifre_coerenti(testo: str, fatto) -> tuple:
    """Nessuna cifra nella didascalia che non stia nel fatto o nel suo titolo.

    E' il cancello che rende sicuro, domani, far rifinire il testo da un modello:
    puo' cambiare le parole, non puo' inventare un numero. Torna (ok, intruse).
    """
    ammesse = cifre(fatto.titolo) | cifre(fatto.provenienza)
    for v in fatto.dati.values():
        if isinstance(v, (int, float)):
            ammesse |= {str(v), f"{v:.0f}", f"{v:.1f}".replace(".", ","),
                        f"{v:.2f}".replace(".", ",")}
        elif isinstance(v, str):
            ammesse |= cifre(v)
    intruse = {c for c in cifre(testo) if c not in ammesse}
    return (not intruse), sorted(intruse)


def arricchisci(testo: str, fatto) -> str:
    """Gancio per la rifinitura via LLM. Oggi non chiama nessun modello: esiste
    perche' il cancello (`cifre_coerenti`) sia gia' al suo posto il giorno in cui
    lo si accende, invece di essere aggiunto dopo il primo post sbagliato."""
    return testo


if __name__ == "__main__":
    import sys, os
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
    from ai_lab.social import fatti as F
    for gara in (sys.argv[1:] or ["Belgio"]):
        for f in F.raccogli(gara)[:3]:
            d = scrivi(f)
            ok, intruse = cifre_coerenti(d, f)
            print("=" * 70)
            print(d)
            print(f"\n[cifre coerenti: {ok}{'' if ok else ' — intruse: %s' % intruse}]")
