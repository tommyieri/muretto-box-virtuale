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
    ("live.html", "0.6"),
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
# Cambiare una voce adesso e' una riga qui piu' `python3 ai_lab/redazione/statico.py --nav`.
#
# NIENTE MARCATORI, e non e' pigrizia: inserire <!-- NAV:INIZIO --> in quindici file e' un
# passaggio a mano che alla prima esecuzione puo' cancellare markup buono se finisce nel
# punto sbagliato. La struttura e' gia' regolare (un solo <nav> dentro <header class="topbar">,
# un solo <nav> dentro <footer>), quindi la si riconosce e la si sostituisce. La funzione
# e' idempotente: rilanciarla due volte non cambia niente la seconda.
NAV = [
    ("Stagione", "stagione.html"),
    ("Live", "live.html"),
    ("Telemetria", "telemetria.html"),
    # La voce «E se?» e' VISSUTA UN GIORNO (07-08/08/2026): il PO ha deciso che la
    # simulazione non e' una pagina accanto alle gare, E' il modo in cui si guarda
    # una gara — il rigioca vive dentro gara.html (BOX ORA), la pagina separata no.
    ("Campionato", "campionato.html"),
]

# a quale voce di nav "appartiene" ogni pagina: decide chi porta class="on" e chi sparisce
# dal footer. Le pagine che non compaiono qui non sono in nessuna sezione (index, scheda,
# gara, weekend, 404...) e mostrano tutte e quattro le voci.
SEZIONE_DI = {
    "stagione.html": "stagione.html",
    "live.html": "live.html",
    "telemetria.html": "telemetria.html",
    "campionato.html": "campionato.html",
}


def blocco_nav(attiva=None, prefisso="", classe="nav", rientro="  ") -> str:
    """Il blocco <nav> dell'intestazione. `classe` resta quella trovata in pagina:
    analisi.html usa <nav class="site"> col suo CSS, ed e' un'eccezione a registro
    (demo/REGISTRO_SEZIONE.json, voce S4), non una deriva da correggere qui."""
    punto = '<span class="dot"></span>' if classe == "site" else '<span class="dot-live"></span>'
    righe = [f'{rientro}<nav class="{classe}" aria-label="Sezioni">']
    for etichetta, file in NAV:
        deco = punto if file == "live.html" else ""
        on = ' class="on"' if file == attiva else ""
        righe.append(f'{rientro}  <a href="{prefisso}{file}"{on}>{deco}{etichetta}</a>')
    righe.append(f"{rientro}</nav>")
    return "\n".join(righe)


def blocco_footer_voci(escludi=None, prefisso="", rientro="      ") -> str:
    """Le voci dentro il <nav> del footer: tutte quelle in cui NON sei gia'.

    Prima del 04/08/2026 questa regola era rispettata da sei pagine e violata da cinque
    (libere, quali, sprint, tele, weekend lasciavano fuori Live invece della propria
    sezione; dati e forza elencavano tutte e quattro in un ordine loro). Nessuna di quelle
    differenze era stata decisa: erano il residuo di copie successive. Qui la regola
    diventa una sola, e quelle cinque pagine riprendono la voce che avevano perso."""
    return "\n".join(f'{rientro}<a href="{prefisso}{f}">{e}</a>'
                     for e, f in NAV if f != escludi)


_RE_NAV = re.compile(r'([ \t]*)<nav class="(nav|site)" aria-label="Sezioni">[\s\S]*?</nav>')
# NON pretendere un a capo dopo <nav>. La prima versione di questa regex era
# `<nav>\n(...)` e falliva in silenzio su dati.html e forza.html, che hanno il footer
# tutto su una riga: quelle due pagine sono rimaste con la voce vecchia mentre le altre
# quattordici erano state timbrate, e nessun test se ne e' accorto perche' la sentinella
# guarda la nav dell'intestazione e non il footer. Ora si accetta l'una e l'altra forma,
# e si RESTITUISCE quella trovata: una pagina compatta resta compatta.
_RE_FOOT = re.compile(r'(<footer[^>]*>[\s\S]*?<nav>)([\s\S]*?)(</nav>)')


def stampa_nav_pagine(files=None) -> list:
    """Riscrive nav e footer di ogni pagina in demo/ dalla costante NAV. Torna l'elenco
    dei file davvero cambiati (idempotente: la seconda esecuzione torna vuoto)."""
    cambiati = []
    elenco = files or sorted(f for f in os.listdir(DEMO) if f.endswith(".html"))
    for nome in elenco:
        percorso = os.path.join(DEMO, nome)
        testo = vecchio = open(percorso, encoding="utf-8").read()
        attiva = SEZIONE_DI.get(nome)
        prefisso = "/" if nome == "404.html" else ""

        def _nav(m):
            return blocco_nav(attiva, prefisso, classe=m.group(2), rientro=m.group(1))
        testo = _RE_NAV.sub(_nav, testo, count=1)

        def _foot(m):
            interno = m.group(2)
            if "\n" not in interno:                       # footer compatto (dati, forza)
                voci = "".join(f'<a href="{prefisso}{f}">{e}</a>'
                               for e, f in NAV if f != attiva)
                return m.group(1) + voci + m.group(3)
            rientro = re.match(r"[\n]*([ \t]*)", interno).group(1) or "      "
            return (m.group(1) + "\n" + blocco_footer_voci(attiva, prefisso, rientro)
                    + "\n" + rientro[:-2] + m.group(3))
        testo = _RE_FOOT.sub(_foot, testo, count=1)

        if testo != vecchio:
            open(percorso, "w", encoding="utf-8").write(testo)
            cambiati.append(nome)
    return cambiati

MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio",
        "agosto", "settembre", "ottobre", "novembre", "dicembre"]

# le stesse conversioni che fa analisi.html: l'accent puo' essere una var CSS
AC_MAP = {"var(--sc)": "#E8892B", "var(--brand)": "#E4002B", "var(--lead)": "#E0A400"}


# ---------------------------------------------------------------- utilita'

def esc(s) -> str:
    """Stesso escape del JS di articolo.html: & < > " (l'apostrofo no)."""
    return (str("" if s is None else s)
            .replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def _ac(accent) -> str:
    if not accent:
        return "#E4002B"
    return AC_MAP.get(accent, accent) if accent.startswith("var(") else accent


def data_it(d) -> str:
    """'2026-07-24' -> '24 luglio 2026' (come toLocaleDateString it-IT)."""
    try:
        y, m, g = (int(x) for x in str(d).split("-"))
        return f"{g} {MESI[m - 1]} {y}"
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


def _sezione(s) -> str:
    return (f'<section class="art-sez">\n'
            f'    <div class="sez-tit"><span class="art-tag">{esc(s.get("tag"))}</span> '
            f'{esc(s.get("titolo"))}</div>\n'
            f'    <div class="art-prosa">{s.get("html") or ""}</div>\n'
            f'    {_figura(s.get("figura"))}\n'
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


def _corpo(art) -> str:
    """L'<article> completo: e' cio' che il JS costruiva a runtime."""
    ac = art.get("accent") or "var(--brand)"
    stato = ""
    if art.get("stato") and art["stato"] != "pubblicato":
        stato = f'<span class="art-bozza">{esc(art["stato"])}</span>'
    meta = " · ".join([x for x in (art.get("circuito"), art.get("sessione")) if x])
    tags = "".join(f'<span class="art-chip">{esc(t)}</span>' for t in (art.get("tag") or []))
    riga_meta = (f'<span class="art-dot">·</span><span>{esc(meta)}</span>' if meta else "")
    sezioni = "\n  ".join(_sezione(s) for s in (art.get("sezioni") or []))
    return (
        f'<header class="art-testa" style="--ac:{esc(ac)}">\n'
        f'    <div class="art-occhiello">{esc(art.get("occhiello"))}{stato}</div>\n'
        f'    <h1 class="art-titolo">{esc(art.get("titolo"))}</h1>\n'
        f'    <p class="art-sommario">{esc(art.get("sommario"))}</p>\n'
        f'    <div class="art-riga">\n'
        f'      <span class="art-firma">{esc(art.get("firma"))}</span>\n'
        f'      <time class="art-data" datetime="{esc(art.get("data"))}">'
        f'{esc(data_it(art.get("data")))}</time>\n'
        f'      {riga_meta}\n'
        f'    </div>\n'
        f'    <div class="art-tags">{tags}</div>\n'
        f'  </header>\n'
        f'  {sezioni}\n'
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
        "inLanguage": "it-IT",
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


def _testa(art) -> str:
    id_ = art["id"]
    titolo = testo_piano(art.get("titolo"))
    desc = _descrizione(art)
    url = url_articolo(id_)
    og_png = os.path.join(OG_DIR, id_ + ".png")
    robots = ("index, follow, max-image-preview:large"
              if art.get("stato") == "pubblicato" else "noindex, nofollow")
    t = [
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        f'<title>{esc(titolo)} — {NOME_SITO}</title>',
        f'<meta name="description" content="{esc(desc)}">',
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
        '<meta property="og:locale" content="it_IT">',
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
<html lang="it">
<head>
{_testa(art)}
<link rel="stylesheet" href="../muro.css?v=090826a">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 32 32%27%3E%3Crect width=%2732%27 height=%2732%27 rx=%277%27 fill=%27%23e80d2e%27/%3E%3Cpath d=%27M7 23V9h3.4L16 17l5.6-8H25v14h-3.5v-8.2L16.9 21h-1.8l-4.6-6.2V23z%27 fill=%27%23ffffff%27/%3E%3C/svg%3E">
<script type="application/ld+json">
{_jsonld(art)}
</script>
</head>
<body>
<header class="barra"></header>

<div class="wrap-scheda" style="padding-bottom:0">
  <a class="crumb" href="../analisi.html">&larr; Letture</a>
</div>

<article class="wrap-scheda art" id="art">
  {_corpo(art)}
</article>

<footer class="piede"><div class="piede-in"></div></footer>
<script type="module">
  import {{ guscio }} from '../muro.mjs?v=090826a';
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
        d.rounded_rectangle([64, 56, 120, 112], radius=13, fill="#E4002B")
        f_m = font(GRASSETTO, 34)
        d.text((92, 84), "M", font=f_m, fill="#FFFFFF", anchor="mm")
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
    righe = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for file, prio in PAGINE_FISSE:
        loc = f"{SITO}/" if file == "index.html" else f"{SITO}/{file}"
        righe += ["  <url>", f"    <loc>{esc(loc)}</loc>",
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
    """Stessa card che il JS di analisi.html costruisce, ma servita subito."""
    ac = _ac(a.get("accent"))
    meta = " · ".join([x for x in (a.get("circuito"), a.get("sessione"),
                                   data_it(a.get("data"))) if x])
    tags = "".join(f'<span class="chip">{esc(t)}</span>' for t in (a.get("tag") or [])[:3])
    return (f'<a class="card" href="articolo/{esc(a["id"])}.html" style="--ac:{ac}">'
            f'<div class="eyebrow">{esc(a.get("occhiello"))}</div>'
            f'<h3>{esc(testo_piano(a.get("titolo")))}</h3>'
            f'<p>{esc(testo_piano(a.get("sommario")))}</p>'
            f'<div class="foot"><span class="meta">{esc(meta)}</span>'
            f'<span class="go">Leggi →</span></div>'
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
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pagina non trovata — Muretto Box Virtuale</title>
<meta name="robots" content="noindex, follow">
<link rel="stylesheet" href="/muro.css?v=090826a">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 32 32%27%3E%3Crect width=%2732%27 height=%2732%27 rx=%277%27 fill=%27%23FF1E3C%27/%3E%3Cpath d=%27M7 23V9h3.4L16 17l5.6-8H25v14h-3.5v-8.2L16.9 21h-1.8l-4.6-6.2V23z%27 fill=%27%23ffffff%27/%3E%3C/svg%3E">
</head>
<body>
<header class="barra"></header>

<main class="scafo">
  <p class="occhiello">Errore 404</p>
  <h1 class="titolone">Questa pagina <em>non esiste</em></h1>
  <p class="sottotitolo">L'indirizzo che hai seguito non porta a nulla: forse un vecchio
     link, forse un refuso. Da qui si riparte.</p>
  <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:28px">
    <a class="btn btn-p" href="/stagione.html">Le gare</a>
    <a class="btn btn-s" href="/telemetria.html">Telemetria</a>
    <a class="btn btn-s" href="/campionato.html">Campionato</a>
    <a class="btn btn-f" href="/index.html">Home</a>
  </div>
</main>

<footer class="piede"><div class="piede-in"></div></footer>
<script type="module">
  import { guscio } from '/muro.mjs?v=090826a';
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
    elenco = aggiorna_elenco()       # PRIMO: se salta, non si e' annunciato niente
    return {"elenco": elenco, "robots": scrivi_robots(), "sitemap": scrivi_sitemap(),
            "feed": scrivi_feed(), "404": scrivi_404()}


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
    ap.add_argument("--nav", action="store_true",
                    help="ristampa nav e footer di tutte le pagine dalla costante NAV")
    ap.add_argument("--senza-og", action="store_true", help="salta le immagini social")
    a = ap.parse_args()
    og = not a.senza_og
    if a.nav:
        cambiati = stampa_nav_pagine()
        print(f"[statico] nav e footer ristampati: {len(cambiati)} pagine cambiate"
              + (f" ({', '.join(cambiati)})" if cambiati else " — erano gia' allineate"))
    elif a.tutto:
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
