"""
coda.py — la coda di revisione della redazione: il gate umano bozza->pubblicato.

Modella lo stesso confine del laboratorio (ai_lab/designer): l'agente produce
BOZZE; APPROVATO/RESPINTO sono atti UMANI con --attore obbligatorio, scritti in
uno storico append-only.  La pubblicazione (scrittura in demo/, l'unico posto
online) avviene SOLO su APPROVATO.

  bozza ──anteprima──► (visibile solo via link diretto, non nell'indice)
        └─approva(attore)─► approvato ─► pubblicato (compare in analisi.html)
        └─respingi(attore)─► respinto  (resta in bozze, col perche')

Uso:
  python3 ai_lab/redazione/coda.py --lista
  python3 ai_lab/redazione/coda.py --anteprima <id>
  python3 ai_lab/redazione/coda.py --approva <id> --attore "Tommi" [--nota "..."]
  python3 ai_lab/redazione/coda.py --respingi <id> --attore "Tommi" --nota "..."

NB: nessun comando qui fa 'git push'.  Portare online = merge su main, gesto tuo.
"""
from __future__ import annotations
import os
import sys
import json
import argparse
import datetime

_QUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(_QUI, "..", ".."))
BOZZE = os.path.join(_QUI, "bozze")
ANALISI_DIR = os.path.join(REPO, "demo", "data", "analisi")
MANIFEST = os.path.join(REPO, "demo", "data", "analisi_articoli.json")

TRANSIZIONI = {
    "bozza": {"approvato", "respinto"},
    "approvato": {"pubblicato", "respinto"},
    "respinto": {"bozza"},
    "pubblicato": {"respinto"},
}
ATTI_UMANI = {"approvato", "respinto"}


def _oggi():
    return datetime.date.today().isoformat()


def _leggi(id_):
    d = os.path.join(BOZZE, id_)
    art = json.load(open(os.path.join(d, "articolo.json")))
    st = json.load(open(os.path.join(d, "stato.json")))
    return d, art, st


def _card(art, pagina=True):
    return {
        "id": art["id"], "titolo": art["titolo"], "occhiello": art["occhiello"],
        "sommario": art["sommario"], "data": art["data"], "stato": art["stato"],
        "tag": art.get("tag", []), "circuito": art.get("circuito"),
        "sessione": art.get("sessione"), "accent": art.get("accent"),
        # raggruppamento per Gran Premio nell'indice: gp = nome del GP (es. "Ungheria"),
        # assente/None = articolo trasversale (piu' gare). round = ordina i GP.
        "gp": art.get("gp"), "round": art.get("round"),
        # LA PAGINA STATICA C'E'? Il pre-render e' fail-safe: puo' fallire e lasciare
        # l'articolo pubblicato ma senza demo/articolo/<id>.html. Il JS di analisi.html
        # non puo' guardare il disco, quindi glielo diciamo qui: con pagina=false la
        # card punta ad articolo.html?id=, che rende dal JSON e non da' 404. Assente =
        # true (le card scritte prima di questo campo hanno tutte la loro pagina).
        "pagina": bool(pagina),
        # LA TRADUZIONE VIAGGIA COL MANIFEST, non solo dentro la pagina-articolo.
        # index.html costruisce le sue tre «letture» da qui, e senza queste tre righe
        # la home inglese mostrerebbe titoli italiani che portano a un articolo
        # inglese: la traduzione ci sarebbe e non la vedrebbe nessuno.
        **({"en": {k: art["en"][k] for k in ("titolo", "occhiello", "sommario")
                   if art["en"].get(k)}} if art.get("en", {}).get("titolo") else {}),
    }


def _upsert_manifest(card):
    os.makedirs(ANALISI_DIR, exist_ok=True)
    man = []
    if os.path.exists(MANIFEST):
        man = json.load(open(MANIFEST))
    man = [m for m in man if m["id"] != card["id"]]
    man.append(card)
    man.sort(key=lambda m: (m["data"], m["id"]), reverse=True)
    json.dump(man, open(MANIFEST, "w"), ensure_ascii=False, indent=2)


def _statico():
    if _QUI not in sys.path:
        sys.path.insert(0, _QUI)
    import statico
    return statico


def _pre_render(art):
    """Scrive SOLO demo/articolo/<id>.html (+ anteprima social). Ritorna True/False.

    Separato dagli indici di proposito: il manifest deve sapere se la pagina c'e'
    PRIMA che gli indici si rigenerino, altrimenti la card di analisi.html punterebbe
    a un file che non esiste."""
    try:
        _statico().scrivi_articolo(art)
        return os.path.exists(os.path.join(REPO, "demo", "articolo", art["id"] + ".html"))
    except Exception as e:
        print(f"[coda] ATTENZIONE: pre-render statico fallito per {art.get('id')}: "
              f"{type(e).__name__}: {e}")
        return False


def _rigenera_indici(id_=None, pagina=True):
    """Elenco crawlabile + robots/sitemap/feed/404.

    Il JSON e' la verita'; l'HTML statico e' una resa. Percio' qui si e' FAIL-SAFE: se
    la rigenerazione inciampa, la pubblicazione del JSON NON fallisce. Ma il messaggio
    dice tutta la verita', non mezza: senza pagina statica il link della card e'
    <b>diverso</b> (articolo.html?id=), e sitemap/feed non annunciano l'articolo."""
    try:
        _statico().rigenera_indici()
        ok = True
    except Exception as e:
        print(f"[coda] ATTENZIONE: rigenerazione indici fallita: {type(e).__name__}: {e}")
        ok = False
    if not pagina:
        print(f"[coda] il JSON e' pubblicato lo stesso, e l'articolo RESTA LEGGIBILE: la "
              f"card di analisi.html punta ad articolo.html?id={id_}, che rende dal JSON.")
        print(f"[coda] ma la pagina /articolo/{id_}.html NON esiste, quindi l'articolo "
              f"NON e' in sitemap.xml ne' in feed.xml (per non annunciare un 404) e non "
              f"e' nel blocco crawlabile di analisi.html.")
        print("[coda] rimedio: python3 ai_lab/redazione/statico.py --tutto")
    elif not ok:
        print(f"[coda] la pagina /articolo/{id_}.html c'e', ma gli indici possono essere "
              f"indietro. Rimedio: python3 ai_lab/redazione/statico.py --tutto")
    return ok


def _ritira_statico(id_):
    """Un articolo respinto sparisce da TUTTO: pagina, anteprima social, JSON servito,
    sitemap/feed/elenco. Restare online anche solo con l'immagine sarebbe
    un'anteprima social orfana di un articolo respinto — e il JSON servito lo
    renderebbe ancora leggibile da articolo.html?id=.
    Stesso patto fail-safe del resto."""
    try:
        statico = _statico()
        for p in (os.path.join(REPO, "demo", "articolo", id_ + ".html"),
                  os.path.join(REPO, "demo", "og", id_ + ".png"),
                  os.path.join(ANALISI_DIR, id_ + ".json")):
            if os.path.exists(p):
                os.remove(p)
        statico.rigenera_indici()
        return True
    except Exception as e:
        print(f"[coda] ATTENZIONE: ritiro statico fallito per {id_}: "
              f"{type(e).__name__}: {e}")
        return False


def _traduci(art):
    """L'inglese dell'articolo, prima che la pagina si renda.

    QUI, E NON ALTROVE. L'ordine di _scrivi_demo e' pagina -> manifest -> indici, e
    tutt'e tre leggono `art`: se la traduzione arrivasse dopo, la pagina nascerebbe
    italiana e il manifest la registrerebbe cosi'. Rifarla al giro successivo non e'
    una consolazione — nessuno lancia un secondo giro.

    NON PUO' FAR CADERE UNA PUBBLICAZIONE. Un articolo tradotto e' meglio di un
    articolo non tradotto; un articolo non pubblicato e' peggio di tutti e due. Se il
    modello non c'e', se la rete cade, se la guardia sui numeri boccia la traduzione,
    si scrive perche' e si va avanti: la pagina esce in italiano e lo dichiara, che e'
    esattamente lo stato in cui il sito viveva ieri. Il silenzio no: quello e' il
    difetto per cui da luglio a oggi nessuno dei 18 articoli portava il campo
    `scrittura` e non c'era una riga di log che lo dicesse."""
    if _QUI not in sys.path:
        sys.path.insert(0, _QUI)
    try:
        import traduci
        percorso = os.path.join(ANALISI_DIR, art["id"] + ".json")
        esito = traduci.traduci_file(percorso)
        if esito == "fatto":
            art["en"] = json.load(open(percorso, encoding="utf-8")).get("en")
        elif esito == "gia-tradotto":
            art["en"] = json.load(open(percorso, encoding="utf-8")).get("en")
        else:
            print(f"[coda] traduzione non applicata a {art['id']}: {esito}", file=sys.stderr)
    except Exception as e:
        print(f"[coda] traduzione non applicata a {art['id']}: {type(e).__name__}: {e}",
              file=sys.stderr)


def _scrivi_demo(art):
    """Copia l'articolo (col suo stato) in demo/data/analisi/, rende la pagina,
    aggiorna l'indice con l'esito della resa, e solo allora rigenera gli indici.

    L'ORDINE CONTA: pagina -> manifest (che registra se la pagina c'e') -> indici.
    Cosi' la card di analisi.html sa gia' dove puntare quando il JS la disegna."""
    os.makedirs(ANALISI_DIR, exist_ok=True)
    json.dump(art, open(os.path.join(ANALISI_DIR, art["id"] + ".json"), "w"),
              ensure_ascii=False, indent=2)
    _traduci(art)
    pagina = _pre_render(art)
    _upsert_manifest(_card(art, pagina=pagina))
    _rigenera_indici(art.get("id"), pagina=pagina)


def _salva_stato(d, art, st):
    json.dump(st, open(os.path.join(d, "stato.json"), "w"), ensure_ascii=False, indent=2)
    json.dump(art, open(os.path.join(d, "articolo.json"), "w"), ensure_ascii=False, indent=2)


def transizione(id_, nuovo, attore=None, nota=None):
    d, art, st = _leggi(id_)
    cur = st["stato"]
    if nuovo not in TRANSIZIONI.get(cur, set()):
        amm = ", ".join(sorted(TRANSIZIONI.get(cur, set()))) or "nessuna"
        sys.exit(f"[coda] transizione non ammessa {cur} -> {nuovo}. Ammesse: {amm}")
    if nuovo in ATTI_UMANI and not attore:
        sys.exit(f"[coda] '{nuovo}' e' un atto umano: --attore obbligatorio.")
    st["stato"] = nuovo
    art["stato"] = nuovo
    st.setdefault("storico", []).append(
        {"stato": nuovo, "attore": attore or "redazione", "quando": _oggi(), "nota": nota})
    if attore:
        st["attore"] = attore
    _salva_stato(d, art, st)
    # pubblicazione in demo/ solo da approvato in poi
    if nuovo in ("approvato", "pubblicato"):
        if nuovo == "approvato":
            # approvazione ratifica -> stato finale visibile = pubblicato
            st["stato"] = art["stato"] = "pubblicato"
            st["storico"].append({"stato": "pubblicato", "attore": attore,
                                   "quando": _oggi(), "nota": "pubblicato all'approvazione"})
            _salva_stato(d, art, st)
        _scrivi_demo(art)
    elif nuovo == "respinto":
        # ritira dall'indice se c'era
        if os.path.exists(MANIFEST):
            man = [m for m in json.load(open(MANIFEST)) if m["id"] != id_]
            json.dump(man, open(MANIFEST, "w"), ensure_ascii=False, indent=2)
        _ritira_statico(id_)
    return art["stato"]


def anteprima(id_):
    """Rende l'articolo visibile in-sito (via link diretto) SENZA pubblicarlo
    nell'indice: stato resta 'bozza'.  Serve alla revisione umana."""
    _, art, _ = _leggi(id_)
    _scrivi_demo(art)               # manifest lo segna 'bozza' -> l'indice lo salta
    print(f"[coda] anteprima pronta: demo/articolo/{id_}.html  (stato: {art['stato']}, "
          f"NON nell'indice pubblico, NON nella sitemap, marcata 'noindex')")


def aggiorna(id_, attore=None, nota=None):
    """Ripubblica un articolo GIA' PUBBLICATO dopo che la bozza e' stata riscritta.

    Serve perche' la macchina a stati non ha un anello su se stessa: `pubblicato`
    puo' solo andare in `respinto`, e non esiste un modo di dire «lo stesso pezzo,
    scritto meglio». Ritirarlo e ripubblicarlo funzionerebbe, ma lascerebbe il
    sito senza quell'articolo per il tempo che passa in mezzo, e cancellerebbe la
    storia invece di allungarla.

    Una rettifica in chiaro, con la data e il perche', e' una regola della casa
    (VOCE.md O6). Qui la si fa: lo storico prende una riga in piu', l'articolo non
    esce mai dall'indice, e `--attore` resta obbligatorio perche' riscrivere un
    pezzo pubblicato e' un atto umano quanto pubblicarlo."""
    d, art, st = _leggi(id_)
    if art.get("stato") != "pubblicato":
        raise SystemExit(f"[coda] {id_} e' in stato '{art.get('stato')}': "
                         f"--aggiorna vale solo per un articolo gia' pubblicato "
                         f"(per gli altri: --approva)")
    if not attore:
        raise SystemExit("[coda] --attore obbligatorio: riscrivere un pezzo "
                         "pubblicato e' un atto umano")
    # NIENTE PERDITE SILENZIOSE. La bozza e la copia pubblicata possono divergere:
    # certi campi (gp, round) sono stati aggiunti a mano nel pubblicato e non
    # esistono nella bozza. Ripubblicare dalla bozza li cancellerebbe senza dire
    # niente, e il solo effetto visibile sarebbe un articolo finito nel gruppo
    # sbagliato dell'indice — successo davvero il 4/8/2026 su cinque articoli.
    # Quello che c'era e non c'e' piu' si riporta indietro, e si dice.
    pubb = os.path.join(ANALISI_DIR, id_ + ".json")
    if os.path.exists(pubb):
        try:
            vecchio = json.load(open(pubb))
        except Exception:
            vecchio = {}
        recuperati = [k for k, v in vecchio.items()
                      if v not in (None, "", [], {}) and art.get(k) in (None, "", [], {})
                      and k not in ("sezioni", "sommario", "titolo", "occhiello")]
        for k in recuperati:
            art[k] = vecchio[k]
        if recuperati:
            print(f"[coda] {id_}: campi presi dalla versione online e non presenti "
                  f"nella bozza: {', '.join(sorted(recuperati))}")
    st.setdefault("storico", []).append(
        {"stato": "pubblicato", "attore": attore, "quando": _oggi(),
         "nota": nota or "riscritto e ripubblicato"})
    st["attore"] = attore
    _salva_stato(d, art, st)
    _scrivi_demo(art)
    return art["stato"]


def lista():
    if not os.path.isdir(BOZZE):
        print("(nessuna bozza)")
        return
    for id_ in sorted(os.listdir(BOZZE)):
        p = os.path.join(BOZZE, id_, "stato.json")
        if not os.path.exists(p):
            continue
        st = json.load(open(p))
        print(f"  {st['stato']:11} {id_:32} attore={st.get('attore') or '-'}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--lista", action="store_true")
    ap.add_argument("--anteprima", metavar="ID")
    ap.add_argument("--approva", metavar="ID")
    ap.add_argument("--respingi", metavar="ID")
    ap.add_argument("--aggiorna", metavar="ID",
                    help="ripubblica un articolo gia' pubblicato dopo una riscrittura")
    ap.add_argument("--attore")
    ap.add_argument("--nota")
    a = ap.parse_args()
    if a.lista:
        lista()
    elif a.anteprima:
        anteprima(a.anteprima)
    elif a.approva:
        s = transizione(a.approva, "approvato", a.attore, a.nota)
        print(f"[coda] {a.approva} -> {s} (attore: {a.attore})")
    elif a.respingi:
        s = transizione(a.respingi, "respinto", a.attore, a.nota)
        print(f"[coda] {a.respingi} -> {s} (attore: {a.attore})")
    elif a.aggiorna:
        s = aggiorna(a.aggiorna, a.attore, a.nota)
        print(f"[coda] {a.aggiorna} ripubblicato (attore: {a.attore})")
    else:
        ap.print_help()
