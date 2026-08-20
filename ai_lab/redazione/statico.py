"""
statico.py — rende gli articoli VISIBILI a chi non esegue JavaScript.

Il problema che risolve.  demo/articolo.html e' un consumatore puro: il suo
<article id="art"> arriva VUOTO al browser e viene riempito da JS leggendo
demo/data/analisi/<id>.json.  Un crawler che non esegue JS (e la gran parte non
lo fa, o lo fa tardi e male) vede una pagina senza una parola.  In piu' nessuna
pagina del sito conteneva un solo <a href> verso un articolo: nulla era
RAGGIUNGIBILE, e senza raggiungibilita' non c'e' indicizzazione.

Cosa fa questo modulo.  Riproduce in Python la stessa resa del JS di
articolo.html e scrive una pagina vera per ogni articolo:

    demo/articolo/<id>.html        <- CANONICO, testo gia' nell'HTML
    demo/og/<id>.png               <- anteprima social 1200x630 (facoltativa)
    demo/sitemap.xml               <- dal manifest, solo 'pubblicato'
    demo/feed.xml                  <- RSS 2.0
    demo/robots.txt                <- gruppo valido + rimando alla sitemap
    demo/404.html                  <- pagina d'errore con la nav del sito
    demo/analisi.html              <- blocco di link fra due marcatori

Su hosting statico la query string NON puo' scegliere un file: percio' il
vecchio demo/articolo.html?id=... non puo' essere il canonico.  Resta come
compatibilita' (noindex + rimando JS), cosi' i link gia' condivisi non muoiono.

Tutto e' IDEMPOTENTE: rigenerare due volte riscrive gli stessi byte e il blocco
in analisi.html viene SOSTITUITO fra i marcatori, mai accodato.

Uso:
    python3 ai_lab/redazione/statico.py --tutto        # rigenera tutto
    python3 ai_lab/redazione/statico.py --articolo ID  # solo un articolo + indici
"""
from __future__ import annotations

import os
import re
import json
import html
import argparse
import datetime
import email.utils

_QUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(_QUI, "..", ".."))
DEMO = os.path.join(REPO, "demo")
ANALISI_DIR = os.path.join(DEMO, "data", "analisi")
MANIFEST = os.path.join(DEMO, "data", "analisi_articoli.json")
ART_DIR = os.path.join(DEMO, "articolo")
OG_DIR = os.path.join(DEMO, "og")
ANALISI_HTML = os.path.join(DEMO, "analisi.html")
# registro impronta->data delle pagine fisse. Sta FUORI da demo/ (non va servito) ma
# DENTRO il repo (git lo trasporta, l'mtime no). Vedi _lastmod_pagine.
LASTMOD = os.path.join(REPO, "data", "lastmod_pagine.json")

SITO = "https://murettobox.com"
NOME_SITO = "Muretto Box Virtuale"

MARCA_INIZIO = "<!-- ELENCO:INIZIO — generato da ai_lab/redazione/statico.py, non modificare a mano -->"
MARCA_FINE = "<!-- ELENCO:FINE -->"

# pagine fisse del sito: (file, titolo per il sitemap, priorita')
# IL SITO NUOVO (agosto 2026) HA SEI PAGINE, e questa e' la loro lista.
# Le vecchie pagine-sezione (statistiche-*, classifiche, forza, dati, quali, sprint,
# libere, tele) NON sono piu' raggiungibili dal menu e quindi non entrano piu' in
# sitemap: annunciare un indirizzo che il sito non linka piu' e' il modo classico di
# lasciare in giro pagine morte. I file restano su disco finche' qualcuno decide.
PAGINE_FISSE = [
    ("index.html", "1.0"),
    ("stagione.html", "0.9"),
    ("telemetria.html", "0.9"),
    ("campionato.html", "0.8"),
    ("analisi.html", "0.8"),
    # GLI STRUMENTI DI STAGIONE sono pagine vere, con contenuto vero e un dato che si
    # ricalcola a ogni gara: entrano in sitemap come le altre. Non stanno nella nav
    # perche' si raggiungono dagli Articoli, che e' la sezione a cui appartengono.
    ("forza.html", "0.7"),
    ("dati.html", "0.7"),
    # `whatif.html` e' rientrata il 18/08/2026 per decisione di Tommi. Ci era gia' stata per
    # un giorno, il 17/08, pubblicando numeri fabbricati (passo base 85,0 s di ripiego,
    # posizione di rientro sempre P1) sotto una targhetta che diceva «misurato»: spenta e
    # riscritta sul kernel vero lo stesso giorno, e riaccesa solo dopo. Adesso ha una
    # sentinella sua (demo/test_whatif.mjs, verifica 10 di sentinella.py) che controlla i
    # NUMERI e non solo l'esistenza — che era il buco per cui la prima versione era passata.
    ("whatif.html", "0.7"),
    ("live.html", "0.6"),
    # `feedback.html` non porta un artefatto, e a rigore la REGOLA DI STOP qui sotto
    # parla di quello. Entra lo stesso, e la ragione e' che quella regola difende da un
    # difetto preciso — annunciare un indirizzo VUOTO — che qui non c'e': la pagina e'
    # completa il giorno che nasce, non aspetta nessun generatore, e non ha una versione
    # «in attesa di dati». La priorita' e' l'ultima del sito perche' e' l'ultima cosa
    # che si va a cercare: e' una porta di servizio, non una sezione da leggere.
    ("feedback.html", "0.4"),
]
# REGOLA DI STOP, decisa il 04/08/2026: una pagina entra qui — e una voce entra nella
# sotto-barra della sezione — solo quando il suo artefatto esiste davvero. Altrimenti
# sitemap e feed pubblicherebbero un indirizzo vuoto, che e' il modo classico in cui questo
# lavoro non finisce: cinque pagine promesse, tre finite, due in sitemap e vuote.
# `statistiche-stagione.html` e' entrata con l'ondata 2, il 04/08/2026, quando gen_stat_gara.py
# ha scritto demo/data/stat/gara_2026.json. Prima non c'era, e non era in questo elenco.

# ------------------------------------------------------------- la nav, in un posto solo
#
# PERCHE' STA QUI. La nav era ripetuta A MANO in quindici file HTML, e i footer avevano
# gia' cinque elenchi diversi fra loro senza che nessuno l'avesse deciso. Nessun test la
# sorvegliava: una voce dimenticata sarebbe rimasta invisibile per sempre. Il meccanismo
# per scrivere la nav da un punto solo pero' esisteva GIA' qui — questo modulo scrive per
# intero l'intestazione di 404.html e dei dodici articoli — e quindi tredici file su
# ventotto erano gia' a sorgente unica. Erano i quindici restanti il problema.
#
# Cambiare una voce si fa in demo/muro.mjs::VOCI: e' li' che vive la nav vera, montata
# a runtime da guscio(). NAV qui sotto e' la COPIA DI CONTROLLO che demo/test_stat.mjs
# confronta con VOCI — se le due divergono, la sentinella diventa rossa.
#
# NIENTE MARCATORI, e non e' pigrizia: inserire <!-- NAV:INIZIO --> in quindici file e' un
# passaggio a mano che alla prima esecuzione puo' cancellare markup buono se finisce nel
# punto sbagliato. La struttura e' gia' regolare (un solo <nav> dentro <header class="topbar">,
# un solo <nav> dentro <footer>), quindi la si riconosce e la si sostituisce. La funzione
# e' idempotente: rilanciarla due volte non cambia niente la seconda.
NAV = [
    # COPIA DI CONTROLLO della costante VOCI in demo/muro.mjs, che e' la sorgente unica.
    # «Analisi» non e' una pagina: e' un cassetto con due sottovoci, e qui sta appiattito
    # come le vede l'utente. Sono due file apposta: se lo stampatore e il sorvegliante
    # fossero lo stesso, un errore si certificherebbe da solo.
    # IN INGLESE dal 19/08/2026: e' la lingua principale del sito, ed e' anche il nome
    # della chiave con cui muro.mjs cerca la traduzione della voce (`t('nav.season')`).
    ("Season", "stagione.html"),
    ("Live", "live.html"),
    ("Analysis>Articles", "analisi.html"),
    ("Analysis>Telemetry", "telemetria.html"),
    ("Championship", "campionato.html"),
]

# QUI SOTTO C'ERA UN TIMBRATORE DI NAV, e non timbrava piu' niente.
# blocco_nav / blocco_footer_voci / stampa_nav_pagine riscrivevano il <nav> statico delle
# pagine di demo/ a partire da NAV. Quel <nav> non esiste piu': il guscio del sito lo monta
# a runtime (demo/muro.mjs::guscio), le pagine hanno <header class="barra"></header> vuoto,
# e le due regex non facevano match su 8 pagine su 8. `--nav` percio' non falliva: contava
# zero cambiamenti e stampava «erano gia' allineate», cioe' dava conferma di un lavoro
# che non aveva fatto. Un attrezzo che mente e' peggio di un attrezzo che manca.
# Restano NAV (copia di controllo per test_stat.mjs) e nient'altro.

# ---------------------------------------------------------------- utilita'

def esc(s) -> str:
    """Stesso escape del JS di articolo.html: & < > " (l'apostrofo no)."""
    return (str("" if s is None else s)
            .replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def _rosso() -> str:
    """Il rosso del marchio, LETTO da demo/muro.css.

    Qui era scritto a mano un rosso diverso da quello del sito: due tonalita' per
    lo stesso marchio, una nelle anteprime social e una ovunque altrove. Un
    valore ribattuto a mano diverge sempre — la sola domanda e' quando ce ne
    accorgiamo. Ora viene dalla stessa fonte del resto, col ripiego se il modulo
    non e' raggiungibile."""
    try:
        import sys, os
        sys.path.insert(0, os.path.abspath(os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "..", "..")))
        from ai_lab.social.marca import c
        return c("rosso")
    except Exception:
        return "#FF1E3C"


ROSSO_MARCHIO = _rosso()


def _ac(accent) -> str:
    if not accent:
        return ROSSO_MARCHIO
    return AC_MAP.get(accent, accent) if accent.startswith("var(") else accent


# I MESI NON C'ERANO. `data_it` li usava e nessuno li aveva mai definiti: il
# `except Exception` che sta qui sotto per i casi di data malformata si prendeva anche
# il NameError, e la funzione tornava la stringa grezza. Risultato: in fondo a ogni
# articolo e su ogni card il sito ha scritto «2026-07-26» dove voleva dire «26 luglio
# 2026», da sempre, senza che una riga di log lo dicesse. E' il difetto che questo repo
# descrive da solo in tre punti diversi — un fallimento muto — e si vede solo guardando
# la pagina. Trovato mentre si scriveva `data_en`, che e' la sua gemella.
MESI = ("gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
        "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre")


def data_it(d) -> str:
    """'2026-07-24' -> '24 luglio 2026' (come toLocaleDateString it-IT)."""
    try:
        y, m, g = (int(x) for x in str(d).split("-"))
        return f"{g} {MESI[m - 1]} {y}"
    except Exception:
        return str(d or "")


MESI_EN = ("January", "February", "March", "April", "May", "June",
           "July", "August", "September", "October", "November", "December")


def data_en(d) -> str:
    """'2026-07-24' -> '24 July 2026' (come toLocaleDateString en-GB). La forma e'
    quella britannica, giorno-mese-anno, la stessa che dataLoc() usa in pagina: due
    date scritte in due modi diversi sullo stesso sito sono due date, per chi legge."""
    try:
        y, m, g = (int(x) for x in str(d).split("-"))
        return f"{g} {MESI_EN[m - 1]} {y}"
    except Exception:
        return str(d or "")


def testo_piano(s) -> str:
    """Toglie i tag e normalizza gli spazi: serve per description/og/RSS, dove
    il markup non va mostrato."""
    t = re.sub(r"<[^>]+>", " ", str(s or ""))
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def tronca(s, n) -> str:
    """Taglia su confine di parola, senza spezzare le parole a meta'."""
    s = str(s or "").strip()
    if len(s) <= n:
        return s
    taglio = s[:n]
    sp = taglio.rfind(" ")
    if sp > n * 0.6:
        taglio = taglio[:sp]
    return taglio.rstrip(" ,;:.-—–") + "…"


def _scrivi(percorso, testo) -> bool:
    """Scrive solo se il contenuto cambia (cosi' 'due volte' non tocca i file)."""
    os.makedirs(os.path.dirname(percorso), exist_ok=True)
    if os.path.exists(percorso):
        with open(percorso, encoding="utf-8") as f:
            if f.read() == testo:
                return False
    with open(percorso, "w", encoding="utf-8") as f:
        f.write(testo)
    return True


# ---------------------------------------------------------------- lettura

def leggi_manifest():
    """Il manifest E' l'elenco: la cartella data/analisi/ contiene anche file
    che NON sono articoli (forza_macchina.json, stagione_dati.json)."""
    if not os.path.exists(MANIFEST):
        return []
    with open(MANIFEST, encoding="utf-8") as f:
        return json.load(f)


def allinea_manifest_lingua() -> bool:
    """La traduzione dell'articolo, riportata nell'indice.

    IL MANIFEST E' UNA PROIEZIONE, non una fonte: la verita' di un articolo sta in
    demo/data/analisi/<id>.json, e il manifest ne tiene le tre righe che servono a
    disegnare una card. Quando la traduzione entra nell'articolo — la scrive
    ai_lab/redazione/traduci.py, chiamata da coda.py alla pubblicazione — la card deve
    seguirla, altrimenti la home inglese annuncia in italiano un articolo che dentro e'
    inglese. Riallineare QUI, a ogni rigenerazione degli indici, vuol dire che vale
    anche per i dodici articoli tradotti dopo essere stati pubblicati: nessuno di loro
    ripassa da coda.py, e senza questa funzione resterebbero annunciati in italiano
    per sempre.

    Copia SOLO le tre voci della card, e solo se ci sono davvero. Il resto della
    traduzione — le sezioni, le didascalie dei grafici — non serve a una card e nel
    manifest sarebbe peso morto che qualcuno un giorno leggerebbe per sbaglio."""
    man = leggi_manifest()
    if not man:
        return False
    cambiato = False
    for voce in man:
        percorso = os.path.join(ANALISI_DIR, f"{voce.get('id')}.json")
        if not os.path.exists(percorso):
            continue
        with open(percorso, encoding="utf-8") as f:
            art = json.load(f)
        en = art.get("en") or {}
        nuovo = {k: en[k] for k in ("titolo", "occhiello", "sommario") if en.get(k)}
        vecchio = voce.get("en")
        if nuovo and vecchio != nuovo:
            voce["en"] = nuovo
            cambiato = True
        elif not nuovo and vecchio is not None:
            voce.pop("en", None)          # la traduzione e' sparita: l'indice lo dice
            cambiato = True
    if cambiato:
        with open(MANIFEST, "w", encoding="utf-8") as f:
            json.dump(man, f, ensure_ascii=False, indent=2)
    return cambiato


def pagina_articolo(id_) -> str:
    return os.path.join(ART_DIR, str(id_) + ".html")


def pubblicati(avvisa=True):
    """Gli articoli che si possono ANNUNCIARE: stato 'pubblicato' E pagina su disco.

    Perche' la seconda condizione. Il manifest dice cosa e' stato pubblicato; la
    sitemap, il feed e l'elenco dicono cosa ESISTE. Non sono la stessa cosa: il
    pre-render e' fail-safe (coda.py pubblica il JSON anche se la resa HTML inciampa),
    e senza questo controllo la prima pubblicazione riuscita SUCCESSIVA ricostruiva gli
    indici dal manifest e ci infilava l'URL di un articolo rimasto senza pagina. Con
    `git add -A` quel 404 finiva online, dichiarato a Google nella sitemap e servito
    come item morto nell'RSS.

    La regola: meglio assente che rotto. L'articolo resta 'pubblicato' nel manifest (il
    JSON e' la verita' e articolo.html?id= lo rende lo stesso), ma nessun indice lo
    annuncia finche' la pagina non c'e'. `statico.py --tutto` la ricrea e lo rimette.
    """
    man = [m for m in leggi_manifest() if m.get("stato") == "pubblicato"]
    vivi = [m for m in man if os.path.exists(pagina_articolo(m["id"]))]
    if avvisa and len(vivi) != len(man):
        mancanti = [m["id"] for m in man if not os.path.exists(pagina_articolo(m["id"]))]
        print(f"[statico] ATTENZIONE: {len(mancanti)} articoli 'pubblicato' SENZA pagina "
              f"in demo/articolo/ — tenuti fuori da sitemap/feed/elenco per non "
              f"annunciare un 404: {', '.join(mancanti)}")
        print("[statico] rimedio: python3 ai_lab/redazione/statico.py --tutto")
    vivi.sort(key=lambda m: (str(m.get("data") or ""), m["id"]), reverse=True)
    return vivi


def leggi_articolo(id_):
    p = os.path.join(ANALISI_DIR, id_ + ".json")
    if not os.path.exists(p):
        return None
    with open(p, encoding="utf-8") as f:
        return json.load(f)


_MOD_SVG = []          # cache a un elemento: svg.py si carica una volta sola


def _titola(svg_str, didascalia):
    """Applica svg.titola() agli SVG gia' scritti nei JSON (che sono nati prima
    dell'accessibilita').  Fail-safe: se il modulo non c'e', l'SVG passa com'e'."""
    try:
        if not _MOD_SVG:
            import importlib.util
            spec = importlib.util.spec_from_file_location(
                "_redazione_svg", os.path.join(_QUI, "svg.py"))
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            _MOD_SVG.append(mod)
        return _MOD_SVG[0].titola(svg_str, didascalia)
    except Exception:
        return svg_str


# ------------------------------------------------- resa del corpo articolo
# Traduzione 1:1 delle funzioni figura()/sezione()/provenienza() di
# demo/articolo.html: stessa struttura, stesse classi, stesso escape.

def _figura(f) -> str:
    if not f:
        return ""
    svg = _titola(f.get("svg") or "", f.get("didascalia"))
    # La riga «Fonte: ...» sotto ogni grafico non si rende piu' (decisione di Tommi,
    # 4/8/2026, stessa ragione della tabella di provenienza qui sotto). `fonte` resta
    # nel JSON dell'articolo: e' sparita la resa, non la tracciabilita'.
    return (f'<figure class="art-fig">\n'
            f'    <div class="art-svg-wrap">{svg}</div>\n'
            f'    <figcaption><span class="cap">{esc(f.get("didascalia"))}</span></figcaption>\n'
            f'  </figure>')


# ===================================================================== due lingue
#
# L'ARTICOLO E' L'UNICO POSTO DEL SITO DOVE L'ITALIANO E' L'ORIGINALE.
# Ovunque altrove l'inglese e' la sorgente e l'italiano vive nel dizionario. Qui e' il
# contrario, e non per distrazione: questi testi li scrive la redazione in italiano, e
# la loro versione inglese e' una TRADUZIONE — prodotta da ai_lab/redazione/traduci.py e
# accettata solo dopo che una guardia aritmetica ha verificato che porta esattamente gli
# stessi numeri. Le due prose stanno tutt'e due nella pagina, ognuna col suo `lang`:
# l'originale resta leggibile e indicizzabile, la traduzione si dichiara per quello che
# e'. Il CSS (muro.css, .art-lingua) mostra quella che serve.
#
# Se la traduzione manca — perche' la guardia l'ha bocciata, perche' l'articolo e'
# appena nato, perche' non c'era la chiave del modello — non succede niente di grave:
# resta l'italiano, e la pagina lo DICHIARA come faceva prima. Un ripiego che si vede.

DIZIONARIO = os.path.join(DEMO, "dizionario.mjs")
_RE_VOCE = re.compile(
    r"^\s*'((?:[^'\\]|\\.)+)':\s*\n?\s*\[\s*(?:'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\")\s*,",
    re.M)


def voci_dizionario():
    """Il dizionario del sito, letto da Python.

    DUE LETTORI PER UN FILE SOLO, ed e' voluto: il dizionario e' demo/dizionario.mjs
    perche' li' lo legge il browser, ma le card degli articoli e le pillole dei filtri
    le pre-renderizza questo modulo, che gira in Python. L'alternativa era una seconda
    tabella — una JSON per Python, una JS per il browser — e due tabelle della stessa
    cosa si disallineano sempre, di solito il giorno in cui nessuno guarda.
    Si legge solo la PRIMA colonna (l'inglese): l'italiano e' gia' quello scritto nel
    dato, ed e' quello che si mostra quando una riga non c'e'.
    demo/test_lingua.mjs controlla che questo lettore e il browser vedano lo stesso
    numero di voci: se la forma del file cambia, uno dei due si accorge subito."""
    try:
        with open(DIZIONARIO, encoding="utf-8") as f:
            testo = f.read()
    except OSError:
        return {}
    fuori = {}
    for m in _RE_VOCE.finditer(testo):
        chiave = m.group(1).replace("\\'", "'")
        en = (m.group(2) if m.group(2) is not None else m.group(3) or "")
        fuori[chiave] = en.replace("\\'", "'")
    return fuori


_VOCI = None


def _in_inglese(prefisso, valore, ripiego=None):
    """Il valore in inglese, se il dizionario lo conosce. Altrimenti il valore com'e':
    un tema nuovo non deve far comparire una chiave grezza in pagina.

    `ripiego` e' un secondo prefisso da provare: i temi degli articoli comprendono i
    nomi dei Gran Premi («Ungheria»), che il dizionario ha gia' sotto `gp.` perche' li
    usano il calendario e la pagina-gara. Ripeterli sotto `art.tag.` vorrebbe dire
    tenere due volte la stessa traduzione, e vederle divergere il giorno che se ne
    corregge una."""
    global _VOCI
    if _VOCI is None:
        _VOCI = voci_dizionario()
    return (_VOCI.get(f"{prefisso}{valore}")
            or (_VOCI.get(f"{ripiego}{valore}") if ripiego else None)
            or valore)


def _en(art):
    """La traduzione, se c'e' ed e' completa. Mai un mezzo articolo."""
    en = art.get("en") or {}
    if not en.get("titolo") or len(en.get("sezioni") or []) != len(art.get("sezioni") or []):
        return None
    return en


def _due(it_txt, en_txt, tag="span", classe="", grezzo=False) -> str:
    """Lo stesso pezzo di testo nelle due lingue, uno accanto all'altro.

    Con `grezzo` il contenuto e' gia' HTML (la prosa); senza, si sfugge (i titoli).
    Quando l'inglese non c'e' resta solo l'italiano, senza marcatore di lingua: una
    pagina con un solo testo non ha niente da scegliere."""
    rendi = (lambda x: x or "") if grezzo else (lambda x: esc(x))
    # lo spazio DOPO la classe non e' cosmetico: senza, «art-prosa» e «art-lingua» si
    # saldano in un nome solo che nessuna regola CSS conosce, e le due lingue restano
    # tutt'e due in pagina. Trovato a schermo, non nel diff.
    cl = (classe + " ") if classe else ""
    if en_txt is None:
        return f'<{tag} class="{classe}">{rendi(it_txt)}</{tag}>' if classe else rendi(it_txt)
    return (f'<{tag} class="{cl}art-lingua" lang="it">{rendi(it_txt)}</{tag}>'
            f'<{tag} class="{cl}art-lingua" lang="en">{rendi(en_txt)}</{tag}>')


_RE_TEXT_SVG = re.compile(r"<text\b([^>]*)>([^<]*)</text>")


def _svg_due_lingue(svg: str, etichette: dict) -> str:
    """Le DIDASCALIE del grafico nelle due lingue, il DISEGNO una volta sola.

    Un grafico di questo sito e' 5-48 kB di percorsi e poche centinaia di byte di
    parole: duplicarlo intero per tradurre un titolo d'asse avrebbe raddoppiato la
    pagina piu' pesante (63 kB) per guadagnare cinque righe di testo. Qui si sdoppiano
    i soli <text> che hanno una traduzione — le sigle dei piloti e i numeri non ce
    l'hanno, e restano dove sono, una volta sola, uguali in tutte le lingue.

    I <text> di questi SVG non contengono altri tag (777 su 777, verificato): per
    questo una regex basta e non serve un parser."""
    if not svg or not etichette:
        return svg or ""

    def sdoppia(m):
        attr, dentro = m.group(1), m.group(2)
        chiave = html.unescape(dentro).strip()
        en = etichette.get(chiave)
        if not en:
            return m.group(0)
        def con_classe(a, lingua):
            marcata = re.sub(r'class="([^"]*)"', lambda c: f'class="{c.group(1)} art-lingua"', a)
            if marcata == a:
                marcata = a + ' class="art-lingua"'
            return f'<text{marcata} lang="{lingua}">'
        return (con_classe(attr, "it") + dentro + "</text>"
                + con_classe(attr, "en") + esc(en) + "</text>")

    return _RE_TEXT_SVG.sub(sdoppia, svg)


def _sezione(s, en=None, etichette=None) -> str:
    tag_en = (en or {}).get("tag")
    fig = s.get("figura")
    if fig and etichette:
        fig = dict(fig, svg=_svg_due_lingue(fig.get("svg") or "", etichette))
    return (f'<section class="art-sez">\n'
            f'    <div class="sez-tit">'
            f'<span class="art-tag">{_due(s.get("tag"), tag_en)}</span> '
            f'{_due(s.get("titolo"), (en or {}).get("titolo") if en else None)}</div>\n'
            f'    {_due(s.get("html"), (en or {}).get("html") if en else None, tag="div", classe="art-prosa", grezzo=True)}\n'
            f'    {_figura(fig)}\n'
            f'  </section>')


def _provenienza(art) -> str:
    """NON SI RENDE PIU' (decisione di Tommi, 4/8/2026).

    La tabella «Dati · Provenienza dei numeri» chiudeva ogni articolo con dieci
    righe di metodo. Restava in fondo a un pezzo di quattrocento parole, e da
    lettore ci arrivavi dopo la chiusa: la coda pesava quanto il corpo.

    Il DATO NON SI TOCCA. `provenienza[]` e `fonti[]` restano in articolo.json,
    restano validati (`base.STATI`), restano l'insieme su cui la guardia dei
    numeri decide che cosa la prosa puo' scrivere, e restano leggibili a chi apre
    il JSON. E' sparita la resa in pagina, non la tracciabilita': un numero senza
    provenienza continua a non poter esistere.

    Il patto di trasparenza si sposta cosi' dentro la prosa, dov'era gia' scritto
    che dovesse stare (VOCE.md O1: il caveat sta nel corpo, non in fondo).

    La funzione resta al suo posto, vuota, per due ragioni: e' la gemella di
    quella JS in demo/articolo.html (le due rese devono restare allineate, ed e'
    piu' facile vederlo se hanno gli stessi nomi), e riaccenderla e' cancellare
    una riga."""
    return ""


def _correlati_html(art) -> str:
    """Genera la sezione 'Approfondimenti correlati' in calce all'articolo."""
    id_corr = art.get("id")
    gp_corr = art.get("gp")
    tags_corr = set(art.get("tag") or [])
    
    tutti = [a for a in pubblicati(avvisa=False) if a.get("id") != id_corr]
    if not tutti:
        return ""
        
    def punteggio(a):
        score = 0
        if gp_corr and a.get("gp") == gp_corr:
            score += 4
        if a.get("circuito") and a.get("circuito") == art.get("circuito"):
            score += 2
        inter = tags_corr.intersection(set(a.get("tag") or []))
        score += len(inter)
        return score

    ordinati = sorted(tutti, key=punteggio, reverse=True)
    scelti = [a for a in ordinati if punteggio(a) > 0][:2]
    if not scelti:
        scelti = tutti[:2]  # fallback sui piu recenti
        
    cards = []
    for a in scelti:
        ac = a.get("accent") or "var(--brand)"
        meta = " · ".join([x for x in (a.get("circuito"), a.get("sessione")) if x])
        cards.append(
            f'<a class="art-correlato-card" href="{esc(a["id"])}.html" style="--ac:{esc(ac)}">'
            f'<div class="eyebrow">{esc(a.get("occhiello"))}</div>'
            f'<h4>{esc(testo_piano(a.get("titolo")))}</h4>'
            f'<div class="foot"><span class="meta">{esc(meta)}</span><span class="go">Leggi →</span></div>'
            f'</a>'
        )
        
    return (
        f'<section class="art-correlati">\n'
        f'    <div class="sez-tit"><span class="art-tag">Approfondimenti</span> Altri fatti del weekend</div>\n'
        f'    <div class="art-correlati-grid">\n      ' + "\n      ".join(cards) + '\n    </div>\n'
        f'  </section>'
    )


def _lang_articolo(art) -> str:
    """`lang` sull'<article>, e solo quando dice qualcosa di vero.

    Senza traduzione l'articolo E' italiano dentro una pagina inglese, e va detto:
    un lettore di schermo cambia voce, un motore di ricerca sa che quel blocco non e'
    nella lingua del documento. Con la traduzione, invece, l'articolo contiene tutt'e
    due le lingue e ogni pezzo porta gia' il suo `lang`: metterne uno anche qui sopra
    vorrebbe dire dichiarare italiano anche il testo inglese che ci sta dentro."""
    return "" if _en(art) else ' lang="it"'


def _blocco_voci(art) -> str:
    voci = voci_articolo(art)
    if not voci:
        return ""
    # `</` neutralizzato: una chiusura di tag dentro il JSON romperebbe il blocco,
    # esattamente come nel json-ld qui sopra.
    corpo = json.dumps(voci, ensure_ascii=False).replace("</", "<\\/")
    return f'<script type="application/json" id="voci-articolo">{corpo}</script>'


def _avviso_lingua(art) -> str:
    """La riga che dichiara in che lingua e' quello che stai per leggere.

    Ha due forme perche' ci sono due situazioni diverse, e confonderle sarebbe una
    bugia comoda: un articolo SENZA traduzione e' italiano e basta — chi arriva dal
    sito inglese deve saperlo prima di scorrere; un articolo CON la traduzione non ha
    piu' niente da avvisare qui, perche' la nota di provenienza sta sopra il titolo,
    dove si legge insieme al pezzo. In italiano non compare mai: quello e' l'originale,
    e non c'e' niente da dichiarare a chi lo legge nella lingua in cui e' stato scritto."""
    if _en(art):
        return ""
    return ('<p class="avviso-lingua" lang="en">This article is available in Italian only.</p>')


def _corpo(art) -> str:
    """L'<article> completo: e' cio' che il JS costruiva a runtime."""
    ac = art.get("accent") or "var(--brand)"
    stato = ""
    if art.get("stato") and art["stato"] != "pubblicato":
        stato = f'<span class="art-bozza">{esc(art["stato"])}</span>'
    # IL CIRCUITO NON SI TRADUCE (e' un nome proprio), LA SESSIONE SI'. Sono due
    # parole nella stessa riga e hanno due nature diverse: «Hungaroring» e' lo stesso
    # in tutte le lingue, «Qualifiche» no.
    meta_it = " · ".join([x for x in (art.get("circuito"), art.get("sessione")) if x])
    meta_en = " · ".join([x for x in (art.get("circuito"),
                                      _in_inglese("art.sess.", art.get("sessione") or "")) if x])
    tags = "".join(f'<span class="art-chip">'
                   f'{_due(t, _in_inglese("art.tag.", t, "gp.") if _en(art) else None)}</span>'
                   for t in (art.get("tag") or []))
    riga_meta = (f'<span class="art-dot">·</span><span>'
                 f'{_due(meta_it, meta_en if _en(art) else None)}</span>' if meta_it else "")
    en = _en(art)
    lab = (en or {}).get("etichette") or {}
    sez_en = (en or {}).get("sezioni") or []
    sezioni = "\n  ".join(
        _sezione(s, sez_en[i] if en and i < len(sez_en) else None, lab)
        for i, s in enumerate(art.get("sezioni") or []))
    correlati = _correlati_html(art)
    # LA NOTA DI PROVENIENZA DELLA TRADUZIONE sta in inglese e basta: in italiano non
    # c'e' niente da dichiarare, quello e' l'originale. E' la stessa regola dei numeri
    # applicata alle parole — chi legge deve sapere da dove viene quello che legge.
    nota_tr = ('<p class="art-tradotto art-lingua" lang="en">Translated from the Italian '
               'original by the newsroom, with every number checked against it.</p>\n    '
               if en else '')
    return (
        f'<header class="art-testa" style="--ac:{esc(ac)}">\n'
        f'    {nota_tr}'
        f'    <div class="art-occhiello">'
        f'{_due(art.get("occhiello"), (en or {}).get("occhiello") if en else None)}{stato}</div>\n'
        f'    <h1 class="art-titolo">'
        f'{_due(art.get("titolo"), (en or {}).get("titolo") if en else None)}</h1>\n'
        f'    <p class="art-sommario">'
        f'{_due(art.get("sommario"), (en or {}).get("sommario") if en else None)}</p>\n'
        f'    <div class="art-riga">\n'
        f'      <span class="art-firma">{esc(art.get("firma"))}</span>\n'
        f'      <time class="art-data" datetime="{esc(art.get("data"))}">'
        f'{_due(data_it(art.get("data")), data_en(art.get("data")) if en else None)}</time>\n'
        f'      {riga_meta}\n'
        f'    </div>\n'
        f'    <div class="art-tags">{tags}</div>\n'
        f'  </header>\n'
        f'  {sezioni}\n'
        f'  {correlati}\n'
        f'  {_provenienza(art)}')



# ------------------------------------------------------------------ testa

def _descrizione(art) -> str:
    return tronca(testo_piano(art.get("sommario")), 155)


def url_articolo(id_) -> str:
    return f"{SITO}/articolo/{id_}.html"


def _jsonld(art) -> str:
    firma = art.get("firma") or NOME_SITO
    d = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": tronca(testo_piano(art.get("titolo")), 110),
        "description": _descrizione(art),
        "datePublished": art.get("data"),
        "dateModified": art.get("data"),
        # LE DUE LINGUE, quando ci sono davvero. La pagina porta l'originale italiano
        # e la sua traduzione: dichiararne una sola sarebbe falso in un verso o
        # nell'altro. Senza traduzione resta it-IT, che e' cio' che il file contiene.
        "inLanguage": ["it-IT", "en-GB"] if _en(art) else "it-IT",
        "mainEntityOfPage": {"@type": "WebPage", "@id": url_articolo(art["id"])},
        "author": {"@type": "Organization", "name": firma},
        "publisher": {"@type": "Organization", "name": NOME_SITO,
                      "url": SITO},
    }
    if art.get("tag"):
        d["keywords"] = ", ".join(str(t) for t in art["tag"])
    if os.path.exists(os.path.join(OG_DIR, art["id"] + ".png")):
        d["image"] = [f"{SITO}/og/{art['id']}.png"]
    # </script> dentro il JSON romperebbe il blocco: lo neutralizziamo
    return json.dumps(d, ensure_ascii=False, indent=2).replace("</", "<\\/")


def voci_articolo(art) -> dict:
    """Le due colonne che appartengono a QUESTO articolo e a nessun'altra pagina.

    Titolo e descrizione vivono nella testa del documento, dove non si puo' mettere
    lo stesso pezzo due volte come si fa nel corpo: un `<title>` e' uno solo. Quindi
    seguono la strada del resto del sito — inglese scritto nel file, italiano nel
    dizionario — con la differenza che il dizionario, qui, se lo porta la pagina
    (demo/lingua.mjs::aggiungi). Senza traduzione non c'e' niente da aggiungere: il
    file resta italiano e nessuna chiave lo promette diverso."""
    en = _en(art)
    if not en:
        return {}
    return {
        "art.titolo": [f"{testo_piano(en['titolo'])} — {NOME_SITO}",
                       f"{testo_piano(art.get('titolo'))} — {NOME_SITO}"],
        "art.desc": [tronca(testo_piano(en.get("sommario")), 155), _descrizione(art)],
    }


def _testa(art) -> str:
    id_ = art["id"]
    en = _en(art)
    # NELLA TESTA COMANDA L'INGLESE, perche' e' la lingua principale del sito e perche'
    # e' quello che leggono i crawler e le anteprime social, che il nostro JavaScript
    # non lo eseguono. Il CORPO invece resta con l'originale italiano davanti: sono due
    # decisioni diverse perche' rispondono a due domande diverse — «in che lingua e'
    # scritto questo file» e «che cosa faccio vedere per primo a chi legge».
    titolo = testo_piano((en or art).get("titolo"))
    desc = tronca(testo_piano(en["sommario"]), 155) if en else _descrizione(art)
    url = url_articolo(id_)
    og_png = os.path.join(OG_DIR, id_ + ".png")
    robots = ("index, follow, max-image-preview:large"
              if art.get("stato") == "pubblicato" else "noindex, nofollow")
    t = [
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        (f'<title data-i18n="art.titolo">{esc(titolo)} — {NOME_SITO}</title>' if en
         else f'<title>{esc(titolo)} — {NOME_SITO}</title>'),
        (f'<meta name="description" data-i18n-attr="content:art.desc" content="{esc(desc)}">' if en
         else f'<meta name="description" content="{esc(desc)}">'),
        f'<meta name="robots" content="{robots}">',
        f'<link rel="canonical" href="{esc(url)}">',
        f'<meta name="author" content="{esc(art.get("firma") or NOME_SITO)}">',
        '<link rel="alternate" type="application/rss+xml" '
        f'title="{NOME_SITO} — Analisi" href="{SITO}/feed.xml">',
        '',
        '<meta property="og:type" content="article">',
        f'<meta property="og:title" content="{esc(titolo)}">',
        f'<meta property="og:description" content="{esc(desc)}">',
        f'<meta property="og:url" content="{esc(url)}">',
        f'<meta property="og:site_name" content="{NOME_SITO}">',
        # LA TARGHETTA DESCRIVE IL FILE, non il sito che lo contiene. Senza
        # traduzione questa pagina e' italiana e lo dice; con la traduzione dentro e'
        # una pagina che porta tutt'e due le lingue, e la principale e' quella del
        # titolo e della descrizione qui sopra.
        ('<meta property="og:locale" content="en_GB">\n'
         '<meta property="og:locale:alternate" content="it_IT">') if en
        else '<meta property="og:locale" content="it_IT">',
        f'<meta property="article:published_time" content="{esc(art.get("data"))}">',
    ]
    for tag in (art.get("tag") or []):
        t.append(f'<meta property="article:tag" content="{esc(tag)}">')
    if art.get("sessione"):
        t.append(f'<meta property="article:section" content="{esc(art["sessione"])}">')
    if os.path.exists(og_png):
        t += [f'<meta property="og:image" content="{SITO}/og/{id_}.png">',
              '<meta property="og:image:width" content="1200">',
              '<meta property="og:image:height" content="630">',
              f'<meta property="og:image:alt" content="{esc(tronca(titolo, 110))}">',
              '<meta name="twitter:card" content="summary_large_image">',
              f'<meta name="twitter:image" content="{SITO}/og/{id_}.png">']
    else:
        t.append('<meta name="twitter:card" content="summary">')
    t += [f'<meta name="twitter:title" content="{esc(titolo)}">',
          f'<meta name="twitter:description" content="{esc(desc)}">']
    return "\n".join(t)


def rendi_html(art) -> str:
    """La pagina completa di un articolo, testo compreso.  Il JS di
    articolo.html non serve piu': qui c'e' gia' tutto."""
    return f"""<!DOCTYPE html>
<!--
  PAGINA PRE-RENDERIZZATA (ai_lab/redazione/statico.py).  NON modificare a mano:
  la sorgente e' demo/data/analisi/{art['id']}.json e questo file si rigenera da
  solo quando l'articolo viene pubblicato (coda.py::_scrivi_demo).
-->
<html lang="en">
<head>
{_testa(art)}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&amp;family=Barlow:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500;700&amp;display=swap">
<link rel="stylesheet" href="../muro.css?v=190826f">
<link rel="apple-touch-icon" href="/assets/marchio/icona-180.png">
<link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%20width%3D%2232%22%20height%3D%2232%22%20role%3D%22img%22%20aria-label%3D%22Muretto%20Box%20Virtuale%22%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%20rx%3D%2222%22%20fill%3D%22%23FF1E3C%22%2F%3E%3Cpath%20d%3D%22M20%2064L20%2018L31.5%2018L50%2042L68.5%2018L80%2018L80%2064L69.5%2064L69.5%2034L54%2055L46%2055L30.5%2034L30.5%2064Z%22%20fill%3D%22%23FFFFFF%22%2F%3E%3Cpath%20d%3D%22M12%2073L88%2073L88%2084L12%2084Z%22%20fill%3D%22%23FFFFFF%22%2F%3E%3C%2Fsvg%3E">
<script type="application/ld+json">
{_jsonld(art)}
</script>
{_blocco_voci(art)}
</head>
<body>
<header class="barra"></header>

<div class="wrap-scheda" style="padding-bottom:0">
  <a class="crumb" href="../analisi.html">&larr; <span data-i18n="nav.articles">Articles</span></a>
  {_avviso_lingua(art)}
</div>

<article class="wrap-scheda art" id="art"{_lang_articolo(art)}>
  {_corpo(art)}
</article>

<footer class="piede"><div class="piede-in"></div></footer>
<script type="module">
  import {{ guscio, aggiungi }} from '../muro.mjs?v=190826f';
  // LE VOCI DELL'ARTICOLO PRIMA DEL GUSCIO: e' il guscio a chiamare applica(), e
  // applica() traduce con quello che il dizionario ha in quel momento. Consegnarle
  // dopo vorrebbe dire consegnarle a cose fatte.
  const _voci = document.getElementById('voci-articolo');
  if (_voci) {{ try {{ aggiungi(JSON.parse(_voci.textContent)); }} catch (e) {{ console.warn('voci articolo:', e); }} }}
  guscio('analisi.html');
</script>
</body>
</html>
"""


# ------------------------------------------------------------ og image PIL

def genera_og(art) -> bool:
    """Anteprima social 1200x630.  Facoltativa per costruzione: se PIL manca o
    inciampa non si rompe niente, semplicemente l'articolo va senza immagine."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except Exception:
        return False
    try:
        def font(nomi, dim):
            for n in nomi:
                try:
                    return ImageFont.truetype(n, dim)
                except Exception:
                    continue
            return ImageFont.load_default()

        GRASSETTO = ["/System/Library/Fonts/Supplemental/Arial Bold.ttf",
                     "/Library/Fonts/Arial Bold.ttf", "/System/Library/Fonts/Helvetica.ttc"]
        NORMALE = ["/System/Library/Fonts/Supplemental/Arial.ttf",
                   "/Library/Fonts/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"]

        W, H = 1200, 630
        ac = _ac(art.get("accent"))
        img = Image.new("RGB", (W, H), "#0A0B0E")
        d = ImageDraw.Draw(img)
        # fascia accento in alto e barra rossa del marchio
        d.rectangle([0, 0, W, 8], fill=ac)
        # marchio
        # IL SEGNO viene da ai_lab/social/marchio.py: unica geometria, la stessa
        # della favicon del sito e della foto profilo. Se non e' importabile si
        # ripiega sulla vecchia M, perche' un'anteprima brutta batte un articolo
        # che non si genera.
        try:
            from ai_lab.social import marchio as _mk
            _seg = _mk.png(56, fondo=ROSSO_MARCHIO, margine=.10)
            img.paste(_seg, (64, 56), _seg)
        except Exception:
            d.rounded_rectangle([64, 56, 120, 112], radius=13, fill=ROSSO_MARCHIO)
            d.text((92, 84), "M", font=font(GRASSETTO, 34), fill="#FFFFFF", anchor="mm")
        f_marca = font(GRASSETTO, 26)
        d.text((136, 72), "MURETTO", font=f_marca, fill="#FFFFFF")
        f_sub = font(NORMALE, 15)
        d.text((137, 104), "BOX VIRTUALE", font=f_sub, fill="#868E9F")

        # occhiello
        f_occ = font(GRASSETTO, 22)
        occ = tronca(testo_piano(art.get("occhiello")), 70).upper()
        d.text((64, 190), occ, font=f_occ, fill=ac)

        # titolo, a capo su misura
        f_tit = font(GRASSETTO, 56)
        parole = testo_piano(art.get("titolo")).split()
        righe, cur = [], ""
        for p in parole:
            prova = (cur + " " + p).strip()
            if d.textlength(prova, font=f_tit) > W - 128 and cur:
                righe.append(cur)
                cur = p
            else:
                cur = prova
        if cur:
            righe.append(cur)
        if len(righe) > 5:
            righe = righe[:5]
            righe[-1] = tronca(righe[-1], max(4, len(righe[-1]) - 2))
        y = 240
        for r in righe:
            d.text((64, y), r, font=f_tit, fill="#EEF1F6")
            y += 68

        # piede: firma e data
        f_pie = font(NORMALE, 22)
        pie = " · ".join([x for x in (art.get("firma"), data_it(art.get("data")),
                                      art.get("circuito")) if x])
        d.text((64, H - 66), tronca(pie, 90), font=f_pie, fill="#868E9F")
        d.rectangle([0, H - 10, W, H], fill="#282C35")

        os.makedirs(OG_DIR, exist_ok=True)
        img.save(os.path.join(OG_DIR, art["id"] + ".png"), "PNG", optimize=True)
        return True
    except Exception:
        return False


# ------------------------------------------------------------ indici globali

def scrivi_robots() -> bool:
    # "Allow: /" da solo NON e' un gruppo valido: serve User-agent + una regola.
    testo = ("User-agent: *\n"
             "Disallow:\n"
             "\n"
             f"Sitemap: {SITO}/sitemap.xml\n")
    return _scrivi(os.path.join(DEMO, "robots.txt"), testo)


def _impronta(percorso) -> str:
    """SHA-256 del contenuto: e' l'unica cosa che dice davvero se una pagina e'
    cambiata."""
    import hashlib
    try:
        with open(percorso, "rb") as f:
            return hashlib.sha256(f.read()).hexdigest()
    except Exception:
        return ""


def _lastmod_pagine(files) -> dict:
    """{file: data ISO} per le pagine fisse, dal CONTENUTO e non dall'mtime.

    Il problema dell'mtime: git non lo trasporta. In un worktree fresco tutti i file
    hanno la data del checkout, e la sitemap dichiarava a Google date di modifica che
    erano date di copia — verificato: `cp -R` dell'albero spostava ogni <lastmod> a
    oggi senza che una riga fosse cambiata.

    Qui invece si tiene un registro impronta->data in data/lastmod_pagine.json (fuori
    da demo/, quindi non servito, ma dentro il repo, quindi TRASPORTATO da git): la
    data cambia se e solo se cambia il contenuto. Idempotente per costruzione — una
    seconda passata trova le stesse impronte e non tocca niente.
    """
    stato = {}
    if os.path.exists(LASTMOD):
        try:
            with open(LASTMOD, encoding="utf-8") as f:
                stato = json.load(f)
        except Exception:
            stato = {}
    oggi = datetime.date.today().isoformat()
    out, cambiato = {}, False
    for file in files:
        imp = _impronta(os.path.join(DEMO, file))
        vecchio = stato.get(file) or {}
        if imp and vecchio.get("sha") == imp and vecchio.get("data"):
            out[file] = vecchio["data"]
        else:
            out[file] = oggi
            stato[file] = {"sha": imp, "data": oggi}
            cambiato = True
    if cambiato:
        os.makedirs(os.path.dirname(LASTMOD), exist_ok=True)
        with open(LASTMOD, "w", encoding="utf-8") as f:
            json.dump(stato, f, ensure_ascii=False, indent=2, sort_keys=True)
    return out


def scrivi_sitemap() -> bool:
    arts = pubblicati(avvisa=False)
    # NB: si chiama DOPO aggiorna_elenco() (vedi rigenera_indici), altrimenti l'impronta
    # letta per analisi.html sarebbe quella di prima del nuovo articolo e il lastmod
    # resterebbe sempre una generazione indietro.
    lastmod = _lastmod_pagine([f for f, _p in PAGINE_FISSE])
    # LE DUE LINGUE SI DICHIARANO NELLA SITEMAP, e non e' decorazione: senza
    # `xhtml:link` un motore di ricerca vede due indirizzi (`/stagione.html` e
    # `/stagione.html?lang=it`) e non sa che sono la stessa pagina in due lingue —
    # li tratta come contenuto duplicato, e sceglie lui quale mostrare a chi.
    # Vale per le PAGINE FISSE, che hanno le due lingue davvero; gli ARTICOLI no:
    # il loro testo esiste in italiano soltanto, e annunciare un inglese che non c'e'
    # sarebbe una promessa falsa detta a una macchina.
    righe = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
             '        xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for file, prio in PAGINE_FISSE:
        loc = f"{SITO}/" if file == "index.html" else f"{SITO}/{file}"
        loc_it = f"{loc}{'&' if '?' in loc else '?'}lang=it"
        righe += ["  <url>", f"    <loc>{esc(loc)}</loc>",
                  f'    <xhtml:link rel="alternate" hreflang="en" href="{esc(loc)}"/>',
                  f'    <xhtml:link rel="alternate" hreflang="it" href="{esc(loc_it)}"/>',
                  f'    <xhtml:link rel="alternate" hreflang="x-default" href="{esc(loc)}"/>',
                  f"    <lastmod>{lastmod[file]}</lastmod>",
                  f"    <priority>{prio}</priority>", "  </url>"]
    for a in arts:
        righe += ["  <url>", f"    <loc>{esc(url_articolo(a['id']))}</loc>",
                  f"    <lastmod>{esc(a.get('data') or '')}</lastmod>",
                  "    <changefreq>monthly</changefreq>",
                  "    <priority>0.8</priority>", "  </url>"]
    righe.append("</urlset>")
    return _scrivi(os.path.join(DEMO, "sitemap.xml"), "\n".join(righe) + "\n")


def _rfc822(d) -> str:
    try:
        y, m, g = (int(x) for x in str(d).split("-"))
        dt = datetime.datetime(y, m, g, 12, 0, 0, tzinfo=datetime.timezone.utc)
    except Exception:
        dt = datetime.datetime.now(datetime.timezone.utc)
    return email.utils.format_datetime(dt)


def scrivi_feed() -> bool:
    arts = pubblicati(avvisa=False)
    ultimo = _rfc822(arts[0]["data"]) if arts else _rfc822(None)
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
           "<channel>",
           f"  <title>{NOME_SITO} — Analisi</title>",
           f"  <link>{SITO}/analisi.html</link>",
           "  <description>Redazione tecnica: telemetria, passo gara, strategia. "
           "Ogni numero con la sua provenienza.</description>",
           "  <language>it-IT</language>",
           f"  <lastBuildDate>{ultimo}</lastBuildDate>",
           f'  <atom:link href="{SITO}/feed.xml" rel="self" type="application/rss+xml"/>']
    for a in arts:
        out += ["  <item>",
                f"    <title>{esc(testo_piano(a.get('titolo')))}</title>",
                f"    <link>{esc(url_articolo(a['id']))}</link>",
                f"    <guid isPermaLink=\"true\">{esc(url_articolo(a['id']))}</guid>",
                f"    <pubDate>{_rfc822(a.get('data'))}</pubDate>",
                f"    <description>{esc(testo_piano(a.get('sommario')))}</description>"]
        for t in (a.get("tag") or []):
            out.append(f"    <category>{esc(t)}</category>")
        out.append("  </item>")
    out += ["</channel>", "</rss>"]
    return _scrivi(os.path.join(DEMO, "feed.xml"), "\n".join(out) + "\n")


def _card_html(a) -> str:
    """Stessa card che il JS di analisi.html costruisce, ma servita subito.

    NELLE DUE LINGUE quando l'articolo ce l'ha. La card e' il primo posto in cui un
    lettore inglese incontra l'articolo: se resta italiana qui, la traduzione dentro
    non la trova nessuno. `data-gp` e `data-tags` NON si traducono — sono i valori su
    cui il filtro confronta, e un filtro che confronta parole tradotte non trova piu'
    niente (la stessa trappola delle pillole di telemetria.html, gia' pagata)."""
    ac = a.get("accent") or "var(--brand)"
    en = a.get("en") or None
    meta_it = " · ".join([x for x in (a.get("circuito"), a.get("sessione"),
                                      data_it(a.get("data"))) if x])
    meta_en = " · ".join([x for x in (a.get("circuito"),
                                      _in_inglese("art.sess.", a.get("sessione") or ""),
                                      data_en(a.get("data"))) if x])
    tags = "".join(f'<span class="chip">'
                   f'{_due(t, _in_inglese("art.tag.", t, "gp.") if en else None)}</span>'
                   for t in (a.get("tag") or [])[:3])
    gp = esc(a.get("gp") or "")
    tag_list = esc(",".join(a.get("tag") or []))
    return (f'<a class="card" href="articolo/{esc(a["id"])}.html" style="--ac:{ac}" '
            f'data-gp="{gp}" data-tags="{tag_list}">'
            f'<div class="eyebrow">'
            f'{_due(a.get("occhiello"), (en or {}).get("occhiello") if en else None)}</div>'
            f'<h3>{_due(testo_piano(a.get("titolo")), testo_piano(en["titolo"]) if en else None)}</h3>'
            f'<p>{_due(testo_piano(a.get("sommario")), testo_piano(en["sommario"]) if en else None)}</p>'
            f'<div class="foot"><span class="meta">'
            f'{_due(meta_it, meta_en if en else None)}</span>'
            f'<span class="go" data-i18n="analisi.leggi">Read →</span></div>'
            f'<div class="chips">{tags}</div></a>')



def blocco_elenco() -> str:
    """Il contenuto INIZIALE di #grid: link veri, che il JS poi sostituisce.
    Non in <noscript>, cosi' vale anche per chi ha JS lento o rotto."""
    arts = pubblicati(avvisa=False)
    if not arts:
        return MARCA_INIZIO + "\n" + MARCA_FINE
    return (MARCA_INIZIO + '\n        <div class="grid">\n          '
            + "\n          ".join(_card_html(a) for a in arts)
            + "\n        </div>\n        " + MARCA_FINE)


def aggiorna_elenco() -> bool:
    """Sostituisce (mai accoda) il blocco fra i marcatori in analisi.html."""
    with open(ANALISI_HTML, encoding="utf-8") as f:
        testo = f.read()
    i = testo.find(MARCA_INIZIO)
    j = testo.find(MARCA_FINE)
    if i < 0 or j < 0:
        raise RuntimeError(
            "marcatori ELENCO:INIZIO/FINE assenti da demo/analisi.html: "
            "l'elenco crawlabile non puo' essere rigenerato")
    nuovo = testo[:i] + blocco_elenco() + testo[j + len(MARCA_FINE):]
    return _scrivi(ANALISI_HTML, nuovo)


def scrivi_404() -> bool:
    testo = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title data-i18n="meta.e404.titolo">Page not found — Muretto Box Virtuale</title>
<meta name="robots" content="noindex, follow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&amp;family=Barlow:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500;700&amp;display=swap">
<link rel="stylesheet" href="/muro.css?v=190826f">
<link rel="apple-touch-icon" href="/assets/marchio/icona-180.png">
<link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%20width%3D%2232%22%20height%3D%2232%22%20role%3D%22img%22%20aria-label%3D%22Muretto%20Box%20Virtuale%22%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%20rx%3D%2222%22%20fill%3D%22%23FF1E3C%22%2F%3E%3Cpath%20d%3D%22M20%2064L20%2018L31.5%2018L50%2042L68.5%2018L80%2018L80%2064L69.5%2064L69.5%2034L54%2055L46%2055L30.5%2034L30.5%2064Z%22%20fill%3D%22%23FFFFFF%22%2F%3E%3Cpath%20d%3D%22M12%2073L88%2073L88%2084L12%2084Z%22%20fill%3D%22%23FFFFFF%22%2F%3E%3C%2Fsvg%3E">
</head>
<body>
<header class="barra"></header>

<main class="scafo">
  <p class="occhiello" data-i18n="e404.occhiello">Error 404</p>
  <h1 class="titolone" data-i18n-html="e404.titolo">This page <em>does not exist</em></h1>
  <p class="sottotitolo" data-i18n="e404.sottotitolo">The address you followed leads nowhere: maybe an old
     link, maybe a typo. You can start again from here.</p>
  <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:28px">
    <a class="btn btn-p" href="/stagione.html" data-i18n="e404.le_gare">The races</a>
    <a class="btn btn-s" href="/telemetria.html" data-i18n="nav.telemetry">Telemetry</a>
    <a class="btn btn-s" href="/campionato.html" data-i18n="nav.championship">Championship</a>
    <a class="btn btn-f" href="/index.html" data-i18n="e404.home">Home</a>
  </div>
</main>

<footer class="piede"><div class="piede-in"></div></footer>
<script type="module">
  import { guscio } from '/muro.mjs?v=190826f';
  guscio(null);
</script>
</body>
</html>
"""
    return _scrivi(os.path.join(DEMO, "404.html"), testo)


# ------------------------------------------------------------------ regia

def scrivi_articolo(art, con_og=True) -> str:
    """Scrive demo/articolo/<id>.html (e la sua anteprima social)."""
    if con_og:
        genera_og(art)          # prima: la testa cita l'immagine solo se esiste
    percorso = os.path.join(ART_DIR, art["id"] + ".html")
    _scrivi(percorso, rendi_html(art))
    return percorso


def rigenera_indici() -> dict:
    """elenco crawlabile in analisi.html + robots + sitemap + feed + 404.

    L'ORDINE NON E' CASUALE, e prima era sbagliato in due modi.

    1) L'ELENCO VA PER PRIMO. Scriveva per ultimo: se aggiorna_elenco sollevava (bastava
       che i marcatori sparissero da analisi.html), l'articolo restava ANNUNCIATO in
       sitemap e feed ma senza un link nell'indice — uno stato che il messaggio di
       coda.py non descrive. Con l'elenco per primo, un guasto li' ferma tutto PRIMA di
       annunciare qualcosa: si resta allo stato precedente, che e' coerente.
    2) La sitemap legge l'impronta di analisi.html per il suo <lastmod>: se analisi.html
       viene riscritta DOPO, la sitemap registra l'impronta vecchia e la convergenza
       richiede due passate. Con l'elenco per primo, una passata basta.

    Anche `pubblicati()` fa la sua parte: chiama una volta con l'avviso acceso, cosi' un
    articolo senza pagina viene detto UNA volta e non quattro.
    """
    pubblicati(avvisa=True)          # la diagnostica, una volta sola
    lingua = allinea_manifest_lingua()   # PRIMA dell'elenco: le card si disegnano da qui
    elenco = aggiorna_elenco()       # PRIMO fra gli annunci: se salta, non si e' annunciato niente
    return {"elenco": elenco, "lingua": lingua, "robots": scrivi_robots(),
            "sitemap": scrivi_sitemap(), "feed": scrivi_feed(), "404": scrivi_404()}


def pota_orfani(ids_vivi) -> list:
    """Cancella da demo/articolo/ (e da demo/og/) le pagine che nel manifest non ci
    sono piu'.

    Perche' serve. La potatura avveniva SOLO nel ramo 'respinto' di coda.py: un
    articolo tolto dal manifest per qualunque altra via (id rinominato, manifest
    ricostruito, riga cancellata a mano) lasciava una pagina online a tempo
    indeterminato — raggiungibile, indicizzabile, e senza piu' nessuno che la
    aggiorni. `--tutto` ora ripassa la cartella e la riallinea al manifest.
    """
    vivi = set(str(i) for i in ids_vivi)
    tolti = []
    if not os.path.isdir(ART_DIR):
        return tolti
    for nome in sorted(os.listdir(ART_DIR)):
        if not nome.endswith(".html"):
            continue
        id_ = nome[:-5]
        if id_ in vivi:
            continue
        os.remove(os.path.join(ART_DIR, nome))
        png = os.path.join(OG_DIR, id_ + ".png")
        if os.path.exists(png):
            os.remove(png)
        tolti.append(id_)
    return tolti


def rigenera_tutto(con_og=True) -> dict:
    fatti, saltati = [], []
    man = leggi_manifest()
    for m in man:
        art = leggi_articolo(m["id"])
        if art is None:
            saltati.append(m["id"])
            continue
        scrivi_articolo(art, con_og=con_og)
        fatti.append(m["id"])
    # potatura DOPO la scrittura: cosi' "vivo" = nel manifest, e un articolo del
    # manifest il cui JSON manca non viene cancellato per sbaglio (e' 'saltato').
    tolti = pota_orfani([m["id"] for m in man])
    esito = {"articoli": fatti, "saltati": saltati, "potati": tolti}
    esito.update(rigenera_indici())
    return esito


def aggiorna_per(art, con_og=True) -> dict:
    """Il gancio che usa coda.py: un articolo + tutti gli indici."""
    scrivi_articolo(art, con_og=con_og)
    return rigenera_indici()


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="pre-render degli articoli + indici SEO")
    ap.add_argument("--tutto", action="store_true", help="rigenera ogni articolo e gli indici")
    ap.add_argument("--articolo", metavar="ID", help="rigenera un solo articolo + indici")
    ap.add_argument("--indici", action="store_true", help="solo robots/sitemap/feed/404/elenco")
    ap.add_argument("--senza-og", action="store_true", help="salta le immagini social")
    a = ap.parse_args()
    og = not a.senza_og
    if a.tutto:
        e = rigenera_tutto(con_og=og)
        print(f"[statico] {len(e['articoli'])} articoli resi in demo/articolo/")
        if e["saltati"]:
            print(f"[statico] saltati (JSON assente): {', '.join(e['saltati'])}")
        if e["potati"]:
            print(f"[statico] potate {len(e['potati'])} pagine orfane (non piu' nel "
                  f"manifest): {', '.join(e['potati'])}")
        print(f"[statico] indici: sitemap/feed/robots/404/elenco aggiornati "
              f"({sum(1 for k in ('robots','sitemap','feed','404','elenco') if e[k])} modificati)")
    elif a.articolo:
        art = leggi_articolo(a.articolo)
        if art is None:
            raise SystemExit(f"[statico] articolo non trovato: {a.articolo}")
        aggiorna_per(art, con_og=og)
        print(f"[statico] {a.articolo} -> demo/articolo/{a.articolo}.html (+ indici)")
    elif a.indici:
        rigenera_indici()
        print("[statico] indici aggiornati")
    else:
        ap.print_help()
