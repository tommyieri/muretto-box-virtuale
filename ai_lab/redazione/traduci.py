"""
traduci.py — l'articolo in inglese, e la guardia che lo rende pubblicabile.

PERCHE' ESISTE, E PERCHE' NON E' «SOLO UNA TRADUZIONE».
Dal 19/08/2026 il sito ha due lingue e l'inglese e' la principale. L'interfaccia si
traduce con un dizionario scritto a mano; gli articoli no — sono prosa, uno diverso
dall'altro, e ne nasce uno nuovo a ogni weekend. O si traducono da soli o non si
traducono, e un sito inglese con dodici articoli italiani dentro e' un sito a meta'.

LA REGOLA DELLA CASA NON CAMBIA PERCHE' CAMBIA LA LINGUA. «Python calcola tutti i
numeri, la prosa non introduce un numero che non sia nei fatti» vale identica sulla
traduzione, e anzi qui si puo' chiedere di piu': la traduzione non deve solo evitare
numeri inventati, deve portare ESATTAMENTE gli stessi numeri dell'originale. Un
traduttore che scrive «two tenths» dove l'italiano diceva 0,247 non ha commesso un
errore di stile: ha cancellato una misura. Percio' il cancello di questo modulo e'
aritmetico e non discrezionale — si contano i numeri delle due prose e devono
coincidere, uno per uno.

IL FALLIMENTO NON PUBBLICA NIENTE, e si vede. Se la guardia boccia, l'articolo resta
italiano e la pagina lo dichiara come faceva prima (`.avviso-lingua`). Non esiste una
traduzione «quasi buona» pubblicata in silenzio: e' la stessa scelta della regola 6 —
l'assenza e' una risposta, un ripiego che assomiglia a una risposta non lo e'.

COSA NON TRADUCE, e non e' una dimenticanza:
  · i NUMERI, che copia;
  · le SIGLE dei piloti (NOR, LEC) e i nomi propri (Hungaroring, Silverstone);
  · i nomi delle SQUADRE, che sono nomi commerciali;
  · le targhette di provenienza e le note di metodo dentro i fatti: quelle non le
    legge il lettore, le legge chi verifica, e chi verifica legge l'originale.

    python3 ai_lab/redazione/traduci.py --tutti
    python3 ai_lab/redazione/traduci.py --articolo hun-quali-h2h-2026 [--forza]
"""
from __future__ import annotations
import os
import re
import json
import html as _html
import datetime

import stile

_QUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(_QUI, "..", ".."))
ANALISI = os.path.join(REPO, "demo", "data", "analisi")

MODELLO = os.environ.get("MURETTO_MODELLO_TRADUZIONE", "claude-opus-5")

# I tag ammessi nella prosa tradotta. Sono gli stessi che la redazione usa in
# italiano: se la traduzione ne introduce un altro non e' piu' una traduzione, e'
# markup nuovo che nessuno ha chiesto.
TAG_AMMESSI = {"p", "b", "i", "em", "strong", "br"}
_RE_TAG = re.compile(r"</?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>")


class ErroreTraduzione(RuntimeError):
    """La traduzione non e' pubblicabile. Porta sempre il perche': chi la cattura
    decide se ripiegare sull'italiano, ma deve poterlo scrivere nel diario."""


# ------------------------------------------------------------------ i numeri ----

_RE_NUM_EN = re.compile(r"\d{1,2}:\d{2}[.,]\d{1,3}|\d+(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?")


def _val_en(s):
    """Numero come lo scrive un inglese -> float. Speculare a stile._val_prosa:
    '10,191' = diecimilacentonovantuno, '0.851' = zerovirgolaottocentocinquantuno,
    '1:24.507' = 84,507 s. Le due convenzioni sono l'una l'inversa dell'altra, ed e'
    esattamente il motivo per cui questo confronto va fatto sui VALORI e non sui
    caratteri: «0,851» e «0.851» sono lo stesso numero scritto in due lingue, mentre
    «1,250» e «1.250» sono due numeri diversi a seconda di chi legge."""
    s = s.strip()
    m = re.fullmatch(r"(\d{1,2}):(\d{2})[.,](\d{1,3})", s)
    if m:
        return int(m.group(1)) * 60 + int(m.group(2)) + int(m.group(3)) / 10 ** len(m.group(3))
    if re.fullmatch(r"\d+(?:,\d{3})+(?:\.\d+)?", s):        # 10,191  /  10,191.5
        s = s.replace(",", "")
    try:
        return float(s)
    except ValueError:
        return None


def _numeri(testo, lingua):
    """I numeri di una prosa, come valori, in ordine di apparizione.

    In ORDINE e non come insieme: due frasi che dicono gli stessi numeri in ordine
    diverso raccontano due cose diverse («Antonelli mette 281 millesimi a Russell»
    contro «Russell ne mette 281 a Antonelli»). L'ordine non prova che la frase sia
    giusta, ma un ordine che cambia e' un segnale che vale la pena guardare."""
    piano = stile.piano(testo or "")
    reg = stile._RE_NUM_PROSA if lingua == "it" else _RE_NUM_EN
    val = stile._val_prosa if lingua == "it" else _val_en
    fuori = []
    for m in reg.finditer(piano):
        v = val(m.group(0))
        if v is not None:
            fuori.append(round(v, 6))
    return fuori


def _tag_di(testo):
    return {m.group(1).lower() for m in _RE_TAG.finditer(testo or "")}


# ------------------------------------------------------------------ la guardia ----

def guardia(it_art, en_art):
    """I motivi per cui questa traduzione NON si pubblica. Lista vuota = si pubblica.

    Sono controlli aritmetici e strutturali, zero modelli: chi giudica una traduzione
    con un altro modello scopre di avere due opinioni, non una verifica."""
    problemi = []

    sez_it = it_art.get("sezioni") or []
    sez_en = en_art.get("sezioni") or []
    if len(sez_it) != len(sez_en):
        problemi.append(f"sezioni: {len(sez_it)} in italiano, {len(sez_en)} in inglese")
        return problemi                       # senza corrispondenza non si confronta altro

    coppie = [("titolo", it_art.get("titolo"), en_art.get("titolo")),
              ("occhiello", it_art.get("occhiello"), en_art.get("occhiello")),
              ("sommario", it_art.get("sommario"), en_art.get("sommario"))]
    for i, (a, b) in enumerate(zip(sez_it, sez_en), 1):
        coppie.append((f"sezione {i} · tag", a.get("tag"), b.get("tag")))
        coppie.append((f"sezione {i} · titolo", a.get("titolo"), b.get("titolo")))
        coppie.append((f"sezione {i} · testo", a.get("html"), b.get("html")))

    for dove, testo_it, testo_en in coppie:
        if (testo_it or "").strip() and not (testo_en or "").strip():
            problemi.append(f"{dove}: l'inglese e' vuoto")
            continue
        n_it, n_en = _numeri(testo_it, "it"), _numeri(testo_en, "en")
        if n_it != n_en:
            problemi.append(f"{dove}: i numeri non coincidono — "
                            f"italiano {n_it}, inglese {n_en}")
        fuori = _tag_di(testo_en) - TAG_AMMESSI
        if fuori:
            problemi.append(f"{dove}: tag non ammessi nella prosa tradotta: {sorted(fuori)}")

    # LE ETICHETTE DEI GRAFICI non portano numeri da confrontare (i numeri dei grafici
    # li disegna Python, non il traduttore): qui basta che non ne AGGIUNGANO. Una
    # cifra comparsa in un'etichetta tradotta e' un numero entrato in pagina da una
    # porta che non ha guardie.
    for it_lab, en_lab in (en_art.get("etichette") or {}).items():
        if _numeri(en_lab, "en") != _numeri(it_lab, "it"):
            problemi.append(f"etichetta «{it_lab[:40]}»: i numeri non coincidono con «{en_lab[:40]}»")
    return problemi


# ------------------------------------------------------------------ le etichette ----

_RE_TEXT_SVG = re.compile(r"<text\b([^>]*)>([^<]*)</text>")
# Che cosa vale la pena tradurre in un grafico: una didascalia, non una sigla. Le
# sigle dei piloti, i numeri e i nomi propri sono gia' gli stessi in tutte le lingue,
# e mandarli al modello e' solo un'occasione in piu' di sbagliare.
_RE_DA_TRADURRE = re.compile(r"[a-zà-ù]{3,}")


def etichette_svg(art):
    """Le didascalie dei grafici dell'articolo, senza doppioni e in ordine."""
    viste, fuori = set(), []
    for s in art.get("sezioni") or []:
        svg = (s.get("figura") or {}).get("svg") or ""
        for m in _RE_TEXT_SVG.finditer(svg):
            t = _html.unescape(m.group(2)).strip()
            if not t or t in viste:
                continue
            if not _RE_DA_TRADURRE.search(t):
                continue                       # sigle, numeri, nomi: restano
            viste.add(t)
            fuori.append(t)
    return fuori


# ------------------------------------------------------------------ il mestiere ----

_ISTRUZIONI = """Sei il traduttore della redazione tecnica del Muretto Box Virtuale.
Traduci dall'italiano all'inglese britannico articoli di analisi tecnica di Formula 1.

CHE COSA STAI TRADUCENDO. Non e' cronaca e non e' clickbait: e' l'analisi che un
ingegnere di pista farebbe, scritta perche' un appassionato serio la capisca. Il
registro e' sobrio, diretto, senza superlativi e senza entusiasmo di maniera. Se
l'italiano dice «e' lento», l'inglese dice «is slow», non «is dramatically slow».

LE REGOLE, IN ORDINE DI IMPORTANZA.

1. I NUMERI SI COPIANO, NON SI RIFORMULANO. Ogni cifra dell'originale deve comparire
   nella traduzione, nello stesso ordine, con lo stesso valore. Non trasformare una
   cifra in parole («0,247» non diventa «a quarter of a second»), non arrotondare,
   non aggiungere numeri che l'italiano non ha. Cambia SOLO la punteggiatura del
   numero, alla maniera inglese: la virgola decimale diventa punto (0,247 -> 0.247),
   il punto delle migliaia diventa virgola (10.191 -> 10,191), i tempi sul giro
   passano da 1:24,507 a 1:24.507.

1-bis. LA FORMA DI OGNI NUMERO SI CONSERVA COM'E'. Una cifra resta una cifra, una
   parola resta una parola, e la scelta non e' tua: e' gia' stata fatta nell'originale.
   «la curva quindici» -> «corner fifteen» (non «corner 15»); «curva 15» -> «turn 15»
   (non «turn fifteen»); «duecento all'ora» -> «two hundred an hour». Non e' pedanteria
   tipografica: in questa redazione le CIFRE sono le misure e le PAROLE sono tutto il
   resto, ed e' cosi' che un lettore distingue a colpo d'occhio un dato da un contorno.
   Cambiare la forma o fa comparire una misura che nessuno ha misurato, o ne fa sparire
   una che qualcuno ha misurato.

2. NON SI TRADUCONO: le sigle dei piloti (NOR, LEC, VER), i nomi dei circuiti
   (Hungaroring, Silverstone, Monza), i nomi delle squadre (Red Bull Racing, Racing
   Bulls, Haas F1 Team), i nomi delle curve (Village, Stowe, The Loop), le sigle
   tecniche (DRS, SC, VSC, FP1, Q3, S1).

3. IL LESSICO DELLA FORMULA 1 E' QUELLO INGLESE VERO, non una traduzione parola per
   parola: giro secco = one-lap pace o qualifying pace; passo gara = race pace;
   mescola = compound; gomma morbida/media/dura = soft/medium/hard; sosta = pit stop;
   pit-loss resta pit-loss; degrado = degradation; scia = tow o dirty air secondo il
   senso; aria sporca = dirty air; staccata = braking point; trazione = traction;
   rapporti (del cambio) = gear ratios; regime = engine speed o revs; punta =
   top speed; velocità in curva = cornering speed; giro lanciato = flying lap;
   giro di rientro/uscita = in-lap/out-lap; neutralizzazione = neutralisation;
   bandiera verde = green flag; giri verdi = green laps.

4. IL MARKUP SI CONSERVA. La prosa arriva con <p>, <b>, <i>: la traduzione deve avere
   gli stessi tag, nello stesso ruolo (se l'italiano mette in grassetto una misura,
   il grassetto va sulla stessa misura). Non aggiungere tag che l'originale non ha.

5. IL `tag` DI SEZIONE E' UN'ETICHETTA, E SI TRADUCE. E' la parola o le due parole
   che compaiono in una pillola sopra il titolo della sezione («Il confronto», «Dove si
   separano»): sono testo che il lettore vede, non un identificatore. Restano corte
   quanto l'originale — occupano una pillola, non una riga.

6. UNA FRASE PER UNA FRASE. Non accorpare, non spezzare, non riordinare i paragrafi,
   non aggiungere spiegazioni che l'italiano non da'. Se l'italiano e' ellittico,
   l'inglese resta ellittico.

Traduci anche le DIDASCALIE DEI GRAFICI che ti vengono date: sono etichette di assi,
titoli di figura e annotazioni. Sono corte e devono restare corte — occupano lo stesso
spazio sul disegno."""

SCHEMA = {
    "type": "object",
    "properties": {
        "titolo": {"type": "string"},
        "occhiello": {"type": "string"},
        "sommario": {"type": "string"},
        "sezioni": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"tag": {"type": "string"},
                               "titolo": {"type": "string"},
                               "html": {"type": "string"}},
                "required": ["tag", "titolo", "html"],
                "additionalProperties": False,
            },
        },
        "etichette": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"it": {"type": "string"}, "en": {"type": "string"}},
                "required": ["it", "en"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["titolo", "occhiello", "sommario", "sezioni", "etichette"],
    "additionalProperties": False,
}


def traduci(art, id_=""):
    """L'articolo in inglese. Alza ErroreTraduzione se il modello non c'e', se
    risponde male, o se la guardia boccia — mai un ripiego muto."""
    import agenti

    sezioni = [{"tag": s.get("tag", ""), "titolo": s.get("titolo", ""),
                "html": s.get("html", "")} for s in (art.get("sezioni") or [])]
    lab = etichette_svg(art)
    utente = (
        "<articolo>\n"
        + json.dumps({"titolo": art.get("titolo", ""),
                      "occhiello": art.get("occhiello", ""),
                      "sommario": art.get("sommario", ""),
                      "sezioni": sezioni}, ensure_ascii=False, indent=1)
        + "\n</articolo>\n\n<didascalie>\n"
        + json.dumps(lab, ensure_ascii=False, indent=1)
        + "\n</didascalie>\n\n"
        "Traduci in inglese britannico. Le sezioni restano nello stesso ordine e nello "
        "stesso numero, e di ognuna traduci anche il `tag`. Rendi ogni didascalia con "
        "il suo testo italiano in `it` e la traduzione in `en`."
    )
    risposta = agenti.chiama("traduttore", [{"type": "text", "text": _ISTRUZIONI}],
                             utente, MODELLO, SCHEMA, max_tokens=16000,
                             id_=id_ or art.get("id", ""))

    en = {"titolo": risposta.get("titolo", ""),
          "occhiello": risposta.get("occhiello", ""),
          "sommario": risposta.get("sommario", ""),
          "sezioni": risposta.get("sezioni") or [],
          "etichette": {x["it"]: x["en"] for x in (risposta.get("etichette") or [])
                        if x.get("it") and x.get("en")}}

    problemi = guardia(art, en)
    if problemi:
        raise ErroreTraduzione("la traduzione non passa la guardia:\n  - "
                               + "\n  - ".join(problemi))
    en["motore"] = {"modello": MODELLO,
                    "quando": datetime.datetime.now().isoformat(timespec="seconds"),
                    "guardia": "numeri identici all'originale, uno per uno"}
    return en


# ------------------------------------------------------------------ il ciclo ----

def traduci_file(percorso, forza=False):
    """Traduce l'articolo su disco e ci scrive dentro il campo `en`.
    Torna 'fatto' | 'gia-tradotto' | un messaggio di guasto."""
    with open(percorso, encoding="utf-8") as f:
        art = json.load(f)
    if not art.get("sezioni"):
        return "senza-sezioni"
    # LA TRADUZIONE SEGUE L'ORIGINALE, e l'impronta e' come lo sa. Un articolo
    # ri-generato (un numero corretto, una frase riscritta) porta un'impronta nuova e
    # va ritradotto; uno intatto no, e non si ripaga la stessa chiamata a ogni gara.
    impronta = _impronta(art)
    if not forza and (art.get("en") or {}).get("impronta") == impronta:
        return "gia-tradotto"
    try:
        en = traduci(art, id_=art.get("id", ""))
    except Exception as e:
        return f"guasto: {e}"
    en["impronta"] = impronta
    art["en"] = en
    with open(percorso, "w", encoding="utf-8") as f:
        json.dump(art, f, ensure_ascii=False, indent=1)
        f.write("\n")
    return "fatto"


def _impronta(art):
    import hashlib
    corpo = json.dumps({"t": art.get("titolo"), "o": art.get("occhiello"),
                        "s": art.get("sommario"),
                        "z": [(s.get("titolo"), s.get("html")) for s in art.get("sezioni") or []],
                        "e": etichette_svg(art)}, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(corpo.encode("utf-8")).hexdigest()[:16]


def main():
    import argparse
    p = argparse.ArgumentParser(description="l'articolo in inglese, con la guardia sui numeri")
    p.add_argument("--tutti", action="store_true", help="tutti gli articoli pubblicati")
    p.add_argument("--articolo", metavar="ID", help="un articolo solo")
    p.add_argument("--forza", action="store_true", help="ritraduci anche se l'impronta coincide")
    a = p.parse_args()

    if a.articolo:
        file = [os.path.join(ANALISI, f"{a.articolo}.json")]
    elif a.tutti:
        file = sorted(os.path.join(ANALISI, f) for f in os.listdir(ANALISI)
                      if f.endswith(".json"))
    else:
        p.error("serve --tutti o --articolo ID")

    guasti = 0
    for percorso in file:
        nome = os.path.basename(percorso)[:-5]
        esito = traduci_file(percorso, forza=a.forza)
        if esito.startswith("guasto"):
            guasti += 1
        if esito != "senza-sezioni":
            print(f"[traduci] {nome}: {esito}")
    print(f"[traduci] {len(file)} file, {guasti} guasti")
    raise SystemExit(1 if guasti else 0)


if __name__ == "__main__":
    main()
