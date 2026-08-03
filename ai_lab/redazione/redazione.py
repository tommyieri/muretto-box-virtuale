"""
redazione.py — l'orchestratore del sistema editoriale.

E' il posto dove i quattro mestieri si mettono in fila, ed espone due sole funzioni
verso il resto del repo:

    riscrivi(articolo, facts) -> articolo      (la catena di scrittura)
    verifica(articolo, facts) -> {ok, problemi} (il cancello di pubblicazione)

Sono esattamente le due cuciture che gia' esistevano — `base._riscrivi_con_llm` e
`redattore.verifica` — quindi i 29 generatori non cambiano di una riga e la catena
del cron resta quella. Il sistema editoriale si innesta, non si affianca.

LA CATENA

    facts.json (dai rilevatori: la verita', intoccata)
        |
        +-- dossier.costruisci ....... nomi, campionato, scala umana, memoria
        |                              (Python: nessun numero inventato)
        +-- agenti.pianifica ......... tesi confutabile, forma, peso, attacco,
        |                              chiusa, che cosa TACERE            [LLM 1]
        +-- agenti.scrivi ............ la prosa                           [LLM 2]
        +-- stile.controlla .......... il correttore, aritmetica pura     [0 LLM]
        |     |
        |     +-- se pulito: si esce QUI. Il cancello prima della revisione vale
        |     |   piu' di un altro giro di revisione: la letteratura e' concorde,
        |     |   e la revisione non richiesta e' un'occasione in piu' di rompere
        |     |   qualcosa che funzionava.
        |     +-- se sporco: agenti.rivedi con l'elenco dei rilievi       [LLM 2b]
        |         (revisione GUIDATA, non auto-critica: l'oracolo e' il correttore,
        |          che non e' un modello. Massimo due giri, poi ci si ferma.)
        +-- articolo, con la sua targhetta

    e al momento di pubblicare, separatamente:

    verifica = stile.controlla (di nuovo, sul definitivo)
             + agenti.censura  ....... modello DIVERSO, CIECO al piano   [LLM 3]

NIENTE SILENZIO. Se qualcosa va storto si torna al template — come prima, perche' la
redazione non deve mai fermare la gara — ma il motivo finisce in `articolo`
("scrittura": "template: ...") e nel diario. Il difetto piu' grave del sistema
precedente non era la qualita' della prosa: era che nessuno poteva sapere che la
prosa LLM non era mai stata prodotta.

Uso a mano:
  python3 ai_lab/redazione/redazione.py --id <bozza>            # riscrive e salva
  python3 ai_lab/redazione/redazione.py --id <bozza> --prova    # non salva niente
  python3 ai_lab/redazione/redazione.py --id <bozza> --verifica # solo il cancello
"""
from __future__ import annotations
import os
import re
import json
import copy
import datetime

import stile
import voce
import dossier as _dossier
import memoria as _memoria
import agenti

_QUI = os.path.dirname(os.path.abspath(__file__))
BOZZE = os.path.join(_QUI, "bozze")

# quanti giri di revisione guidata. Due: oltre, la letteratura misura peggioramenti,
# e comunque il correttore ha gia' detto tutto quello che sa dire.
GIRI_REVISIONE = 2

# tag HTML ammessi nella prosa (il front-end inietta l'html RAW: qui si chiude)
_RE_TAG_OK = re.compile(r"</?(p|b|i|em|strong)>", re.I)
_RE_TAG = re.compile(r"</?[a-zA-Z][^>]*>")


MANDATO = os.path.join(_QUI, "mandato.json")


def accesa():
    """Il cancello di accensione, e sta nel MANDATO — il documento del PO — non in
    una variabile d'ambiente.

    E' lo stesso pattern dei modelli vivi del laboratorio: un modello calibrato
    resta `ACCENDIBILE:false` e la decisione di accenderlo e' umana. Qui vale
    uguale: il sistema e' costruito, collaudato e agganciato, ma finche' `mandato
    .scrittura.attiva` e' falso i generatori continuano a consegnare la loro prosa
    a template — e lo dichiarano.

    L'ambiente puo' forzare l'accensione (MURETTO_REDAZIONE=1) per una prova a
    mano, mai per la produzione: il cron non esporta quella variabile."""
    if os.environ.get("MURETTO_REDAZIONE") == "1":
        return True
    try:
        with open(MANDATO, encoding="utf-8") as f:
            return bool(json.load(f).get("scrittura", {}).get("attiva"))
    except Exception:
        return False


def attiva():
    """Il sistema editoriale puo' lavorare? Cancello del PO piu' credenziali."""
    return accesa() and agenti.disponibile()


# --------------------------------------------------------------- la catena ----

def riscrivi(articolo, facts=None, verboso=True):
    """Fatti + articolo-template -> articolo scritto dalla redazione.

    Non solleva mai: in caso di guasto ritorna l'articolo di partenza con la
    targhetta che dice perche'. Il chiamante (base.scrivi_bozza) non deve cambiare
    comportamento."""
    orig = articolo
    id_ = articolo.get("id") or ""
    try:
        if not accesa():
            return _targhetta(orig, "template: spento dal mandato "
                                    "(mandato.json::scrittura.attiva)")
        if not agenti.disponibile():
            return _targhetta(orig, "template: nessuna credenziale Anthropic")

        mem = _memoria.Memoria(escludi=[id_])
        dos = _dossier.costruisci(articolo, facts, mem)

        piano = agenti.pianifica(dos, mem.sintesi(), id_=id_)
        if verboso:
            print(f"   [piano] forma {piano['forma']} · peso {piano['peso']} · "
                  f"attacco {piano['attacco']} · chiusa {piano['chiusa']}")
            print(f"   [tesi]  {piano['tesi']}")

        sezioni = _pulisci(agenti.scrivi(dos, piano, id_=id_)["sezioni"])
        nuovo = _monta(articolo, piano, sezioni)

        esito = stile.controlla(nuovo, dos, mem)
        giri = 0
        while not esito["ok"] and giri < GIRI_REVISIONE:
            giri += 1
            if verboso:
                print(f"   [correttore] giro {giri}: "
                      f"{esito['profilo']['bloccanti']} bloccanti, "
                      f"{esito['profilo']['avvisi']} avvisi")
            rilievi = stile.per_agente(esito)
            sezioni = _pulisci(agenti.rivedi(dos, piano, sezioni, rilievi,
                                             id_=id_)["sezioni"])
            nuovo = _monta(articolo, piano, sezioni)
            esito = stile.controlla(nuovo, dos, mem)

        nuovo = _targhetta(nuovo, "llm" if giri == 0 else f"llm+revisione({giri})",
                           piano=piano, esito=esito)
        if verboso:
            print(f"   [correttore] finale: {stile.rapporto(esito, id_).splitlines()[0]}")
        if not esito["ok"]:
            # si tiene comunque: e' scritto meglio del template e i rilievi restanti
            # sono dichiarati nel pezzo. Il cancello vero e' verifica(), a valle.
            nuovo["rilievi_aperti"] = [f"[{v['regola']}] {v['messaggio']}"
                                       for v in esito["violazioni"]
                                       if v["gravita"] == stile.BLOCCANTE]
        return nuovo
    except agenti.ErroreAgente as e:
        if verboso:
            print(f"   [redazione] {e}")
        return _targhetta(orig, f"template: {e}")
    except Exception as e:                      # nessun guasto puo' fermare la gara
        if verboso:
            print(f"   [redazione] guasto imprevisto ({type(e).__name__}: {e})")
        return _targhetta(orig, f"template: guasto {type(e).__name__}: {e}")


# ------------------------------------------------------------- il cancello ----

def verifica(articolo, facts=None, verboso=True):
    """Il controllo pre-pubblicazione. {"ok": bool, "problemi": [str]}.

    Due strati, e sono asimmetrici di proposito:
      · il CORRETTORE (deterministico) e' sempre attendibile e blocca;
      · il CENSORE (LLM, modello diverso, cieco al piano) puo' solo AGGIUNGERE
        problemi. Se non e' disponibile o sbaglia, restano i controlli di legno:
        non si produce mai un falso 'passa' per un guasto.

    Attenzione al verso: un falso positivo del censore blocca la pubblicazione, un
    suo guasto la lascia passare. E' la scelta giusta finche' il gate finale resta
    umano, e va rivista se un giorno non lo fosse."""
    problemi = []
    try:
        mem = _memoria.Memoria(escludi=[articolo.get("id") or ""])
        dos = _dossier.costruisci(articolo, facts or {}, mem)
    except Exception:
        mem, dos = None, (facts or {})

    minori = []
    try:
        blocca = set(stile.lessico()["cancello_pubblicazione"]["regole"])
        if not accesa():
            # A SISTEMA SPENTO NON SI CAMBIA CHI VA ONLINE. I generatori consegnano
            # la loro prosa a template, che non e' stata scritta sotto questa voce
            # e violerebbe regole nate dopo di lei: applicargliele bloccherebbe una
            # gara intera di articoli senza che nessuno l'abbia deciso. Restano i
            # controlli storici (termini fuori epoca) piu' la guardia dei numeri;
            # tutto il resto viene REGISTRATO come minore, cosi' si vede che cosa
            # succederebbe ad accensione avvenuta.
            blocca &= {"L1", "L4"}
        e = stile.controlla(articolo, dos, mem)
        for v in e["violazioni"]:
            if v["gravita"] != stile.BLOCCANTE:
                continue
            riga = f"correttore [{v['regola']}]: {v['messaggio']}"
            (problemi if v["regola"] in blocca else minori).append(riga)
        if minori and verboso:
            print(f"   [correttore] {len(minori)} difetti di forma, non tengono "
                  f"offline il pezzo: {minori[0]}")
    except Exception as ex:
        problemi.append(f"correttore in errore ({type(ex).__name__}: {ex})")

    if agenti.disponibile():
        try:
            out = agenti.censura(articolo.get("sezioni") or [], dos,
                                 id_=articolo.get("id") or "")
            for p in out.get("problemi", []):
                if p.get("gravita") == "segnala":
                    continue
                problemi.append(f"censore [{p['tipo']}]: {p['perche']} — «{p['citazione'][:90]}»")
        except agenti.ErroreAgente as ex:
            if verboso:
                print(f"   [censore] non disponibile: {ex}")
        except Exception as ex:
            if verboso:
                print(f"   [censore] errore ({type(ex).__name__}: {ex})")
    return {"ok": not problemi, "problemi": problemi, "minori": minori}


# ------------------------------------------------------------------ montaggio ----

def tipografia(h):
    """La punteggiatura si aggiusta a mano, non si chiede a un modello.

    Uno spazio prima di una virgola e' un difetto meccanico: nasce dai valori
    iniettati (`<b>1:17,207</b> ,`) e ricompare a ogni generazione. Chiedere a un
    LLM di toglierlo costa una chiamata, non e' affidabile e ogni riscrittura e'
    un'occasione di rompere qualcos'altro. Tre righe di regex lo chiudono per
    sempre. Vale per tutta la famiglia: spazi dentro le parentesi, puntini di
    sospensione, apostrofi misti."""
    h = re.sub(r"\s+([,.;:!?%])", r"\1", h)
    h = re.sub(r"\(\s+", "(", h)
    h = re.sub(r"\s+\)", ")", h)
    h = h.replace("...", "…")
    h = h.replace("'", "’")            # l'italiano usa l'apostrofo tipografico
    h = re.sub(r"\s+", " ", h)
    return h.strip()


def _pulisci(sezioni):
    """La prosa che torna dal modello: solo <p>, <b>, <i>. Il front-end inietta
    l'HTML senza filtrarlo (in due renderer diversi, JS e Python): il filtro sta
    qui, una volta sola."""
    fuori = []
    for s in sezioni or []:
        h = s.get("html") or ""
        h = _RE_TAG.sub(lambda m: m.group(0) if _RE_TAG_OK.fullmatch(m.group(0)) else "", h)
        h = tipografia(h)
        if "<p>" not in h:
            h = "<p>" + h + "</p>"
        tag = tipografia((s.get("tag") or "")).strip()
        if tag and tag[0].islower():        # l'etichetta e' stampata: va maiuscola
            tag = tag[0].upper() + tag[1:]
        fuori.append({"tag": tag,
                      "titolo": (s.get("titolo") or "").strip(),
                      "html": h})
    return fuori


def _monta(articolo, piano, sezioni):
    """Il pezzo nuovo, con le FIGURE del template al loro posto.

    Le figure non si toccano mai: sono generate dalla stessa catena che ha calcolato
    i numeri (regola L3) e un articolo senza il suo grafico non e' un articolo. Il
    piano puo' spostarle, non inventarne."""
    n = copy.deepcopy(articolo)
    figure = [s.get("figura") for s in (articolo.get("sezioni") or [])
              if isinstance(s.get("figura"), dict)]
    per_tag = {}
    for s in articolo.get("sezioni") or []:
        if isinstance(s.get("figura"), dict):
            per_tag.setdefault(s.get("tag"), []).append(s["figura"])

    piano_sez = {s.get("tag"): s for s in (piano.get("sezioni") or [])}
    usate = []
    nuove = []
    for s in sezioni:
        d = {"tag": s["tag"], "titolo": s["titolo"], "html": s["html"]}
        ps = piano_sez.get(s["tag"]) or {}
        chiave = ps.get("figura")
        fig = None
        if chiave and per_tag.get(chiave):
            for f in per_tag[chiave]:
                if id(f) not in usate:
                    fig = f
                    break
        if fig is None:
            for f in figure:
                if id(f) not in usate:
                    fig = f
                    break
        if fig is not None:
            usate.append(id(fig))
            d["figura"] = fig
        nuove.append(d)
    # Le figure avanzate vanno alle sezioni che non ne hanno; quelle che restano si
    # SCARTANO, dichiarandolo. Un pezzo piu' corto del template ha meno claim, e un
    # grafico senza il suo claim e' decorazione — che e' esattamente cio' che la
    # regola L3 vieta. Inventare una sezione vuota per ospitarlo sarebbe peggio.
    avanzate = [f for f in figure if id(f) not in usate]
    for d in nuove:
        if "figura" not in d and avanzate:
            d["figura"] = avanzate.pop(0)
    if avanzate:
        n["figure_scartate"] = [f.get("didascalia", "")[:120] for f in avanzate]
    n["sezioni"] = nuove

    for campo in ("titolo", "occhiello", "sommario"):
        v = tipografia(piano.get(campo) or "").strip()
        if v:
            n[campo] = v
    for campo in ("tesi", "confutabile_da", "conseguenza", "forma", "peso",
                  "attacco", "chiusa"):
        if piano.get(campo):
            n[campo] = piano[campo]
    if piano.get("taciuti"):
        n["taciuti"] = piano["taciuti"]
    return n


def _targhetta(articolo, scrittura, piano=None, esito=None):
    """La targhetta della scrittura: che cosa e' successo, sotto quale voce, con
    che profilo. Un numero senza targhetta non esiste; una prosa nemmeno."""
    a = dict(articolo)
    a["scrittura"] = scrittura
    a["voce"] = voce.impronta()
    if esito is not None:
        a["qualita"] = esito["profilo"]
    return a


# --------------------------------------------------------------------- CLI ----

def _carica(id_):
    d = os.path.join(BOZZE, id_)
    art = json.load(open(os.path.join(d, "articolo.json"), encoding="utf-8"))
    fp = os.path.join(d, "facts.json")
    facts = json.load(open(fp, encoding="utf-8")) if os.path.exists(fp) else {}
    return d, art, facts


def main():
    import argparse
    ap = argparse.ArgumentParser(description="La catena editoriale su una bozza")
    ap.add_argument("--id", required=True)
    ap.add_argument("--prova", action="store_true", help="non salva niente su disco")
    ap.add_argument("--verifica", action="store_true", help="solo il cancello")
    ap.add_argument("--fuori", help="dove scrivere l'articolo prodotto (json)")
    a = ap.parse_args()

    d, art, facts = _carica(a.id)
    if a.verifica:
        e = verifica(art, facts)
        print(f"{a.id}: {'PASSA' if e['ok'] else 'NON PASSA'}")
        for p in e["problemi"]:
            print("  !!", p)
        return 0 if e["ok"] else 1

    print(f"== {a.id} · voce {voce.impronta()} · "
          f"{'PROVA' if a.prova else 'SCRITTURA'} ==")
    nuovo = riscrivi(art, facts)
    print(f"   [targhetta] scrittura = {nuovo.get('scrittura')}")
    dove = a.fuori or (None if a.prova else os.path.join(d, "articolo.json"))
    if dove:
        json.dump(nuovo, open(dove, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2)
        print(f"   scritto: {dove}")
    else:
        for s in nuovo.get("sezioni", []):
            print(f"\n--- [{s.get('tag')}] {s.get('titolo')}")
            print(stile.piano(s.get("html")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
