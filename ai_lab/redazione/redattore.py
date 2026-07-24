"""
redattore.py — lo scrittore LLM della redazione (scaffold).

Stessa filosofia dell'Auditor (ai_lab/auditor/agent.py): **Python calcola tutti i
numeri, l'LLM scrive soltanto**. Il redattore riceve i FATTI gia' misurati e ne
ricava la prosa (Evidenza/Causa/Effetto) con la voce della redazione. Non puo'
introdurre un numero che non sia nei fatti: una guardia lo verifica dopo la
scrittura e, se un numero non e' tracciabile, la scrittura viene RIFIUTATA.

Oggi il collaudo usa prose a TEMPLATE (numeri iniettati): deterministico, zero
rischio. Questo scaffold e' il passo verso la scrittura autonoma quando ci sara'
una chiave: `ANTHROPIC_API_KEY` (o profilo `ant auth login`) e il pacchetto
`anthropic` nel venv. Finche' non c'e', `disponibile()` e' False e i generatori
restano sul loro template.

Config allineata all'Auditor: modello claude-opus-4-8, max_tokens 16000,
thinking adaptive, effort high.
"""
from __future__ import annotations
import os
import re

MODELLO = "claude-opus-4-8"

SYSTEM = """Sei il redattore tecnico di "Muretto — Box Virtuale", un sito di analisi \
ingegneristica di Formula 1. Scrivi per esperti e appassionati seri, ma spieghi in \
modo semplice.

Le tue leggi, non violabili:
1. Ogni numero che scrivi DEVE essere tra i FATTI che ti vengono dati. Non inventi, \
non arrotondi verso il piu' bello, non stimi di nascosto. Se un numero non c'e' nei \
fatti, non lo scrivi.
2. Struttura fissa: Evidenza (cosa mostra il canale/dato) -> Causa (la fisica/mecc.) \
-> Effetto (quantificato). Titolo sull'anomalia tecnica, mai clickbait.
3. Prosa tecnica fluida in italiano, terminologia rigorosa (clipping, power band, \
trail braking, drag, deployment, harvesting, compliance sospensiva...). Niente emoji, \
niente elenchi da slide, niente linguaggio da social.
4. Le grandezze stimate si dichiarano come tali; quelle non identificabili dai dati \
si dichiarano non misurabili (variabile latente) - non le si stima di nascosto.
5. Per il Canale A la fonte si cita sempre; non copi mai testo altrui.

Ricevi: i FATTI (numeri con stato MISURATO/STIMATO/NON_MISURABILE e provenienza) e \
un breve. Restituisci SOLO le sezioni in JSON: [{tag, titolo, html}], con html in \
paragrafi <p>...</p>."""


def disponibile():
    """True se si puo' scrivere con l'LLM (pacchetto + credenziali)."""
    try:
        import anthropic  # noqa: F401
    except Exception:
        return False
    if os.environ.get("ANTHROPIC_API_KEY"):
        return True
    # profilo 'ant auth login' raccolto dall'SDK a zero-arg: proviamo a costruirlo
    try:
        import anthropic
        anthropic.Anthropic()
        return True
    except Exception:
        return False


def _numeri(s):
    return set(re.findall(r"-?\d+(?:[.,]\d+)?", re.sub("<[^>]+>", " ", s or "")))


def guardia_numeri(html, ammessi):
    """Ritorna i numeri presenti nella prosa che NON sono tra quelli ammessi
    (l'insieme dei numeri dei fatti). Vuoto = prosa tracciabile."""
    amm = set(str(a).replace(".", ",") for a in ammessi) | set(str(a) for a in ammessi)
    fuori = []
    for n in _numeri(html):
        if n in amm or n.replace(",", ".") in amm:
            continue
        fuori.append(n)
    return fuori


def scrivi_prosa(fatti, breve, numeri_ammessi):
    """Scrive le sezioni con l'LLM. Ritorna la lista [{tag,titolo,html}] oppure
    None se l'LLM non e' disponibile o la guardia dei numeri non passa.
    Il chiamante, se riceve None, usa la propria prosa a template."""
    if not disponibile():
        return None
    import json
    import anthropic
    client = anthropic.Anthropic()
    contenuto = ("FATTI:\n" + json.dumps(fatti, ensure_ascii=False, indent=2) +
                 "\n\nBREVE:\n" + breve +
                 "\n\nRestituisci SOLO il JSON [{tag,titolo,html}].")
    kwargs = dict(model=MODELLO, max_tokens=16000,
                  system=SYSTEM, messages=[{"role": "user", "content": contenuto}])
    try:
        kwargs["thinking"] = {"type": "adaptive"}
        kwargs["output_config"] = {"effort": "high"}
        msg = client.messages.create(**kwargs)
    except TypeError:
        kwargs.pop("thinking", None)
        kwargs.pop("output_config", None)
        msg = client.messages.create(**kwargs)
    testo = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    m = re.search(r"\[.*\]", testo, re.S)
    if not m:
        return None
    try:
        sez = json.loads(m.group(0))
    except Exception:
        return None
    # guardia: nessun numero fuori dai fatti, in nessuna sezione
    for s in sez:
        fuori = guardia_numeri(s.get("html", ""), numeri_ammessi)
        if fuori:
            # scrittura rifiutata: numeri non tracciabili -> il chiamante usa il template
            return None
    return sez
