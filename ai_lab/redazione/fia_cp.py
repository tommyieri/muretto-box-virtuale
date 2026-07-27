"""fia_cp.py — il documento FIA "Car Presentation Submissions" dentro la redazione.

Ogni venerdi' di Gran Premio la FIA pubblica un PDF con, squadra per squadra, i
componenti aggiornati portati in pista: cosa e' cambiato, perche', e una descrizione.
E' l'unica fonte ufficiale sugli aggiornamenti tecnici, e arriva PRIMA delle FP1.

Questo modulo fa cinque cose, in quest'ordine, e ognuna puo' dire di no:
  1. scopri_documento(anno, atteso_gp=None) -> {url, slug, pubblicato_iso,
                          titolo_evento, doc} | None
  2. scarica(url) -> percorso in ~/muretto_shared/fia_cp/ | None
  3. cancello_identita(path, anno, atteso_gp) -> (ok, motivo)
  4. estrai(path) -> {gp, anno, squadre[], diagnostica}
  5. cancello_qualita(estratto) -> (ok, problemi[])

In piu', a richiesta del chiamante (mai automatica):
  riconcilia_famiglie(estratto) -> [riassegnazioni]   la famiglia che la CELLA non
  scrive, ripresa da un'altra riga dello STESSO documento con lo stesso sottotipo.
  Le famiglie della FIA restano tre: 'altro' vuol dire "cella incompleta", non
  "quarta famiglia".

Uso tipico dalla redazione:

    doc = fia_cp.scopri_documento(2026, atteso_gp='Hungarian Grand Prix')
    pdf = fia_cp.scarica(doc['url']) if doc else None
    ok, perche = fia_cp.cancello_identita(pdf, 2026, doc['titolo_evento'])
    est = fia_cp.estrai(pdf) if ok else None
    ok, problemi = fia_cp.cancello_qualita(est)
    # se non e' ok: NON si pubblica, e `problemi` dice esattamente perche'.

Nota sull'`atteso_gp`: e' il titolo dell'evento come lo scrive la FIA
("Barcelona-Catalunya Grand Prix", non "Spanish Grand Prix" — T11). Il modo
sicuro di ottenerlo e' passare a cancello_identita il `titolo_evento` che
scopri_documento ha appena letto dalla pagina radice.

FILOSOFIA. Il guasto tipico di questa fonte non e' l'eccezione: e' il dato che
sparisce in silenzio (una squadra persa, meta' delle righe di una squadra perse,
il PDF dell'anno scorso servito al posto di quello di oggi). Percio' qui NIENTE
viene indovinato: se una cosa non torna, il modulo lo dice e il chiamante NON
pubblica. Meglio un NULL dichiarato che un dato sbagliato. Nessuna funzione alza
eccezioni: si torna None, o uno stato di errore, o (False, motivo).

La `diagnostica` di estrai() e' la parte che si legge quando qualcosa non torna:
  pagine, pagine_continuazione   quante pagine, quante ereditate (T1)
  componenti_non_classificati    componenti fuori dalla tabella delle zone
  squadre_non_riconosciute       nomi squadra che non si e' saputo normalizzare
  righe_vuote                    righe numerate ma vuote NELLA FONTE (non perse)
  righe_senza_numero             righe VERE che la fonte non ha numerato (tenute)
  pagine_tabella_non_lette       pagine con una tabella dentro e nessun testo (T5)
  pagine_ignorate                OGNI pagina scartata, con il motivo per esteso
  note                           tutto il resto (pagine illeggibili, anomalie)

REGOLA DELLO SCARTO. Nessuna pagina e nessuna riga di tabella viene scartata in
silenzio: o diventa un dato, o compare in `pagine_ignorate` / `note` / una delle
liste qui sopra. Era proprio il silenzio il guasto: una riga senza numero e una
pagina senza testo sparivano dentro due `continue` muti, e siccome quel che
restava era numerato 1..N in modo contiguo, il cancello diceva OK.

LIMITE NOTO che resta. Una pagina di continuazione consegnata come UNICA bitmap,
senza nessuna griglia vettoriale, e' indistinguibile da una tavola fotografica
senza leggerne i pixel: verrebbe elencata in `pagine_ignorate` (quindi visibile a
chi legge la diagnostica) ma non bloccherebbe il cancello. Nel corpus 2026 non
esiste: tutte e 7 le continuazioni vere hanno la griglia disegnata, e tutte e 91
le tavole fotografiche non ce l'hanno.

TRAPPOLE NOTE (verificate sui documenti 2026, vedi commenti nel codice):
  T1  una squadra puo' occupare DUE pagine; la seconda non ha ne' intestazione ne' nome
  T2  il numero di colonne dell'estrazione grezza NON e' stabile (13, 7, 5): le colonne
      si trovano dalle coordinate x, mai da indici fissi
  T3  se una squadra sparisce dev'essere un errore RUMOROSO, non un silenzio
  T4  il trattino dei motivi e' a volte ASCII "-", a volte en-dash "–"
  T5  una squadra puo' consegnare la tabella come IMMAGINE (Williams, Australia):
      zero testo estraibile != nessun aggiornamento
  T6  una tabella puo' non avere bordi verticali (Mercedes, Australia)
  T7  "No updates submitted for this event" e' un NULL DICHIARATO (notizia vera),
      diverso dal parsing fallito (mai pubblicabile)
  T8  i nomi squadra cambiano fra gare: asterischi, punto finale, MAIUSCOLE
  T9  la URL /event/<Nome> serve il documento di un ALTRO anno con lo stesso numero
      di Doc: si segue SOLO l'href pubblicato nella pagina radice, e si verifica l'anno
  T10 la pagina "season" elenca solo le gare gia' disputate: inutile per la gara imminente
  T11 nel 2026 "Barcelona-Catalunya" e "Spanish" (=Madrid) sono DUE gare diverse
  T12 il CDN ha stale-if-error: l'elenco puo' essere vecchio di un'ora senza segnale

Uso da riga di comando (diagnostica, non pubblica nulla):
    python3 ai_lab/redazione/fia_cp.py --pdf /percorso/documento.pdf
    python3 ai_lab/redazione/fia_cp.py --scopri 2026
"""
import html
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime

# ---------------------------------------------------------------- costanti rete

# UNICA porta d'ingresso ammessa. La pagina e' server-rendered: curl nudo basta.
# NON usare /event/<Nome>: risponde 200 anche per gare di altri anni (T9).
URL_RADICE = ('https://www.fia.com/documents/championships/'
              'fia-formula-one-world-championship-14')
BASE_FIA = 'https://www.fia.com'

# robots.txt della FIA consente /documents/ e /system/files/ ma impone Crawl-delay: 10.
# Questo modulo fa AL MASSIMO due richieste per gara (elenco + PDF) e usa la cache:
# rispettare il ritardo e' responsabilita' del chiamante se cicla.
CRAWL_DELAY_S = 10
UA = 'muretto/1.0 (redazione tecnica F1; uso personale non commerciale)'
TIMEOUT_S = 45

# La cache sta FUORI dal repo, come f1db_zip.py.
CACHE_DIR = os.path.expanduser('~/muretto_shared/fia_cp')

TITOLO_DOCUMENTO = 'car presentation submissions'

# --------------------------------------------------------- normalizzazione testo

# T4: nel documento convivono il trattino ASCII e l'en-dash (167 vs 97 occorrenze).
# Un parser che cerca solo "-" perde il 37% dei motivi senza alzare un errore.
_TRATTINI = '‐‑‒–—―−'
_SPAZI = '       '


def _norm(s):
    """Testo confrontabile: trattini unificati, spazi unificati, spazi ridotti."""
    if not s:
        return ''
    for c in _TRATTINI:
        s = s.replace(c, '-')
    for c in _SPAZI:
        s = s.replace(c, ' ')
    s = s.replace('’', "'").replace('‘', "'")
    return re.sub(r'\s+', ' ', s).strip()


def _chiave(s):
    """Chiave di confronto insensibile a maiuscole, punteggiatura e spazi."""
    s = _norm(s).lower()
    s = re.sub(r'[^a-z0-9]+', ' ', s)
    return s.strip()


# ------------------------------------------------------------- nomi delle squadre

# T8. La chiave e' il nome ridotto a lettere/cifre (vedi _chiave); il valore e' il
# nome canonico che usa la redazione. Le varianti qui sotto sono TUTTE osservate
# negli 11 documenti 2026 (asterischi, punto finale, MAIUSCOLE, sponsor che cambiano).
_SQUADRE = {
    'mclaren': 'McLaren',
    'mclaren mastercard f1 team': 'McLaren',
    'mclaren f1 team': 'McLaren',
    'mercedes': 'Mercedes',
    'mercedes amg petronas f1 team': 'Mercedes',
    'mercedes amg petronas formula one team': 'Mercedes',
    'red bull': 'Red Bull',
    'red bull racing': 'Red Bull',
    'oracle red bull racing': 'Red Bull',
    'ferrari': 'Ferrari',
    'scuderia ferrari': 'Ferrari',
    'scuderia ferrari hp': 'Ferrari',
    'williams': 'Williams',
    'williams racing': 'Williams',
    'atlassian williams f1': 'Williams',
    'atlassian williams racing': 'Williams',
    'atlassian williams f1 team': 'Williams',
    'racing bulls': 'Racing Bulls',
    'visa cash app racing bulls': 'Racing Bulls',
    'visa cash app rb f1 team': 'Racing Bulls',
    'aston martin': 'Aston Martin',
    'aston martin aramco f1 team': 'Aston Martin',
    'aston martin aramco cognizant f1 team': 'Aston Martin',
    'haas': 'Haas',
    'haas f1 team': 'Haas',
    'tgr haas f1 team': 'Haas',
    'moneygram haas f1 team': 'Haas',
    'alpine': 'Alpine',
    'bwt alpine f1 team': 'Alpine',
    'audi': 'Audi',
    'audi f1 team': 'Audi',
    'audi revolut f1 team': 'Audi',
    'cadillac': 'Cadillac',
    'cadillac f1 team': 'Cadillac',
    'cadillac formula 1 team': 'Cadillac',
}

# Le 11 squadre attese nel 2026. Serve al cancello di qualita' (T3: una squadra che
# sparisce e' un ERRORE, non un silenzio).
SQUADRE_2026 = ('McLaren', 'Mercedes', 'Red Bull', 'Ferrari', 'Williams',
                'Racing Bulls', 'Aston Martin', 'Haas', 'Alpine', 'Audi', 'Cadillac')


def normalizza_squadra(grezzo):
    """Nome canonico della squadra, o None se non riconosciuto (T8).

    Non indovina: se il nome non e' in tabella ritorna None e il chiamante lo
    tratta come anomalia, invece di inventare una dodicesima squadra.
    """
    k = _chiave(grezzo)
    if not k:
        return None
    if k in _SQUADRE:
        return _SQUADRE[k]
    # Ricerca per sottostringa: copre sponsor nuovi ("Aston Martin Aramco Honda...").
    canditati = set()
    for chiave, nome in _SQUADRE.items():
        if chiave in k or k in chiave:
            canditati.add(nome)
    if len(canditati) == 1:
        return canditati.pop()
    # Ultima spiaggia: il cognome della squadra dentro la stringa.
    corti = {'mclaren': 'McLaren', 'mercedes': 'Mercedes', 'red bull': 'Red Bull',
             'ferrari': 'Ferrari', 'williams': 'Williams', 'racing bulls': 'Racing Bulls',
             'aston martin': 'Aston Martin', 'haas': 'Haas', 'alpine': 'Alpine',
             'audi': 'Audi', 'cadillac': 'Cadillac', 'sauber': 'Audi', 'rb': 'Racing Bulls'}
    trovati = {v for kk, v in corti.items() if re.search(r'(^| )%s( |$)' % kk, k)}
    if len(trovati) == 1:
        return trovati.pop()
    return None


# --------------------------------------------------------------- zone della vettura

# Tabella COMPONENTE -> ZONA canonica, costruita DAI DATI (tutte le voci "Updated
# component" degli 11 documenti 2026). Le varianti di maiuscole e spaziatura sono
# gia' assorbite da _chiave(). Un componente che non e' qui NON si indovina:
# zona = "non classificata" e finisce in diagnostica.
_ZONE = {
    # --- avantreno
    'front wing': 'Ala anteriore',
    'front wing endplate': 'Ala anteriore',
    'front wing flap': 'Ala anteriore',
    'front wing assembly': 'Ala anteriore',
    'nose': 'Muso',
    'nose front wing': 'Muso',
    'front corner': 'Avantreno / freni',
    'front brake duct': 'Avantreno / freni',
    'front brake ducts': 'Avantreno / freni',
    'front suspension': 'Sospensione anteriore',
    'front wheel': 'Avantreno / freni',
    'nose camera': 'Muso',
    # --- fondo e diffusore
    'floor': 'Fondo',
    'floor body': 'Fondo',
    'floor bodywork': 'Fondo',
    'floor board': 'Fondo',
    'floorboard': 'Fondo',
    'forward floorboard': 'Fondo',
    'floor bib': 'Fondo',
    'floor fences': 'Fondo',
    'floor fence': 'Fondo',
    'floor furniture': 'Fondo',
    'floor leading edge': 'Fondo',
    'floor corner': 'Fondo',
    'floor edge': 'Fondo',
    'floor edge wing': 'Fondo',
    'diffuser': 'Diffusore',
    'diffuser fence': 'Diffusore',
    'floor diffuser winglet': 'Diffusore',
    'floor edge diffuser': 'Diffusore',
    'floor edge and diffuser': 'Diffusore',
    # --- fiancate e carrozzeria
    'sidepod': 'Fiancate',
    'sidepods': 'Fiancate',
    'sidepod body': 'Fiancate',
    'sidepod inlet': 'Fiancate',
    'sidepod inlets': 'Fiancate',
    'sidepod coke': 'Fiancate',
    'coke engine cover': 'Cofano motore',
    'engine cover': 'Cofano motore',
    'engine cover coke': 'Cofano motore',
    'bodywork engine cover coke cooling exits': 'Cofano motore',
    'bodywork': 'Carrozzeria',
    'cooling louvres': 'Raffreddamento',
    'cooling louvre': 'Raffreddamento',
    'louvres': 'Raffreddamento',
    'cooling': 'Raffreddamento',
    'cooling exits': 'Raffreddamento',
    'halo': 'Abitacolo',
    'roll hoop': 'Abitacolo',
    'roll hoop leg fairings': 'Abitacolo',
    'mirrors': 'Abitacolo',
    'mirror': 'Abitacolo',
    'mirror stay': 'Abitacolo',
    'mirror assembly': 'Abitacolo',
    'cockpit': 'Abitacolo',
    'tail': 'Cofano motore',
    'rv tail': 'Cofano motore',
    'rear tail': 'Cofano motore',
    # --- scarico
    'exhaust': 'Scarico',
    'tailpipe': 'Scarico',
    'exhaust tailpipe': 'Scarico',
    'tailpipe bracket': 'Scarico',
    'exhaust tailpipe bracket': 'Scarico',
    # --- retrotreno
    'rear wing': 'Ala posteriore',
    'rear wing endplate': 'Ala posteriore',
    'rear wing endplates': 'Ala posteriore',
    'rear wing flap': 'Ala posteriore',
    'rear brace wing': 'Ala posteriore',
    'beam wing': 'Ala posteriore',
    'rear corner': 'Retrotreno / freni',
    'rear brake duct': 'Retrotreno / freni',
    'rear brake ducts': 'Retrotreno / freni',
    'rear suspension': 'Sospensione posteriore',
    'rear wheel': 'Retrotreno / freni',
    'rear impact structure': 'Retrotreno / freni',
    'ris fairings': 'Retrotreno / freni',
    'rear crash structure': 'Retrotreno / freni',
}

# Le zone canoniche, nell'ordine in cui si guarda una vettura da davanti a dietro.
ZONE = ('Ala anteriore', 'Muso', 'Avantreno / freni', 'Sospensione anteriore',
        'Fondo', 'Diffusore', 'Fiancate', 'Carrozzeria', 'Cofano motore',
        'Raffreddamento', 'Abitacolo', 'Scarico', 'Ala posteriore',
        'Retrotreno / freni', 'Sospensione posteriore')

ZONA_IGNOTA = 'non classificata'


def zona_di(componente):
    """Zona canonica della vettura per un "Updated component". Mai indovinata."""
    k = _chiave(componente)
    if not k:
        return ZONA_IGNOTA
    if k in _ZONE:
        return _ZONE[k]
    # "Rear Wing (upper flap)" / "Floor - edge" ecc.: si prova la parte prima di
    # una parentesi o di un trattino, ma solo se e' un nome gia' in tabella.
    for taglio in ('(', '-', '/', ','):
        if taglio in componente:
            k2 = _chiave(componente.split(taglio)[0])
            if k2 in _ZONE:
                return _ZONE[k2]
    return ZONA_IGNOTA


# ----------------------------------------------------------- famiglie dei motivi

# Le tre famiglie dichiarate dalla FIA. "Circuit specific" va SEMPRE tenuta separata
# dallo sviluppo vero: e' assetto per quel tracciato, non progresso della macchina.
FAMIGLIE = ('Performance', 'Circuit specific', 'Reliability')
_FAMIGLIE_CHIAVE = {_chiave(f): f for f in FAMIGLIE}
_FAMIGLIE_CHIAVE['circuit specific'] = 'Circuit specific'
_FAMIGLIE_CHIAVE['circuit'] = 'Circuit specific'
_FAMIGLIE_CHIAVE['reliability'] = 'Reliability'
_FAMIGLIE_CHIAVE['performance'] = 'Performance'
FAMIGLIA_ALTRO = 'altro'


def separa_motivo(grezzo):
    """"Performance – Local Load" -> ("Performance", "Local Load").

    Il trattino puo' essere ASCII o en-dash (T4) e la famiglia puo' non essere in
    prima posizione ("Bodywork - Performance - Rear flow delivery"). Se nessuna
    famiglia e' riconosciuta la famiglia e' "altro" e il motivo intero diventa
    sottotipo: nessuna invenzione.
    """
    testo = _norm(grezzo)
    if not testo:
        return FAMIGLIA_ALTRO, ''
    # Si taglia SOLO sul trattino fra spazi: "mid-body flow" e' una parola sola e
    # non va spezzata.
    pezzi = [p.strip() for p in re.split(r'\s+-+\s+', testo) if p.strip()]
    if len(pezzi) == 1:
        pezzi = [p.strip() for p in re.split(r'\s*-+\s*', testo) if p.strip()]
    for i, p in enumerate(pezzi):
        fam = _FAMIGLIE_CHIAVE.get(_chiave(p))
        if fam:
            resto = ' - '.join(pezzi[i + 1:]).strip()
            if not resto:
                resto = ' - '.join(pezzi[:i]).strip()
            return fam, resto.rstrip('.')
    return FAMIGLIA_ALTRO, testo


def riconcilia_famiglie(estratto):
    """Rimette la famiglia alle righe in cui la CELLA non la scrive. Ritorna la lista
    delle riassegnazioni (vuota se non ce n'e' nessuna); modifica l'estratto sul posto.

    PERCHE'. `separa_motivo` legge la famiglia dal prefisso della cella "Primary
    reason". Quando il prefisso manca la famiglia esce FAMIGLIA_ALTRO — che vuol dire
    "la cella non lo dice", NON "esiste una quarta famiglia della FIA". Le famiglie
    dichiarate dalla FIA restano tre (FAMIGLIE) e nessuna riga puo' stare fuori da
    tutte: e' la compilazione a essere incompleta, non la tassonomia.

    LA REGOLA, e i suoi limiti. Si riassegna SOLO quando lo STESSO sottotipo compare
    ALTROVE NELLO STESSO DOCUMENTO con una famiglia scritta, e con UNA SOLA famiglia.
    Nessuna somiglianza, nessun sinonimo, nessuna euristica sul significato: o la
    fonte lo ha gia' scritto a lettere in quella pagina, o la riga resta 'altro' e si
    dichiara. Esempio 2026 (Ungheria): Mercedes / Coke-Engine Cover ha 'Cooling Range'
    nudo, mentre McLaren e Racing Bulls scrivono 'Circuit specific - Cooling Range'
    nello stesso PDF: stessa ragione, prefisso mancante in una cella sola.
    Controesempio dello stesso corpus (Barcellona): Red Bull / 'Local load and flow
    conditioning.' non compare da nessun'altra parte -> NON si tocca.

    La riga riassegnata resta tracciabile: `motivo_famiglia_origine` vale 'cella' per
    default e 'riconciliata' per queste, e `motivo_famiglia_cella` conserva quel che
    c'era scritto. Chi pubblica un numero che dipende da questa regola deve dirlo.

    Non e' chiamata da estrai(): estrai riporta la fonte com'e'. Questa e' una lettura
    in piu', esplicita, che il chiamante decide di fare e di dichiarare.
    """
    if not estratto or not estratto.get('squadre'):
        return []
    righe = [c for s in estratto['squadre'] for c in s.get('componenti') or []]
    for c in righe:
        c.setdefault('motivo_famiglia_origine', 'cella')
        c.setdefault('motivo_famiglia_cella', c.get('motivo_famiglia'))
    testimoni = {}
    for c in righe:
        if c.get('motivo_famiglia') in FAMIGLIE and c.get('motivo_famiglia_origine') == 'cella':
            testimoni.setdefault(_chiave(c.get('motivo_sottotipo')), set()).add(
                c['motivo_famiglia'])
    fatte = []
    for s in estratto['squadre']:
        for c in s.get('componenti') or []:
            if c.get('motivo_famiglia') != FAMIGLIA_ALTRO:
                continue
            k = _chiave(c.get('motivo_sottotipo'))
            viste = testimoni.get(k) or set()
            if len(viste) != 1:
                continue                    # muta o ambigua: non si indovina
            fam = next(iter(viste))
            c['motivo_famiglia'] = fam
            c['motivo_famiglia_origine'] = 'riconciliata'
            fatte.append({'team': s.get('team_norm') or s.get('team'),
                          'componente': c.get('componente'),
                          'sottotipo': c.get('motivo_sottotipo'),
                          'famiglia': fam,
                          'testimoni': sum(
                              1 for x in righe
                              if _chiave(x.get('motivo_sottotipo')) == k
                              and x.get('motivo_famiglia_origine') == 'cella')})
    return fatte


# ================================================================ 1. SCOPERTA

def _get(url, binario=False):
    """GET con User-Agent esplicito e timeout. Ritorna bytes/str o None. Mai eccezioni."""
    req = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Accept': '*/*',
        # T12: il CDN ha stale-if-error=3600 e puo' servire un elenco vecchio senza
        # dirlo. Non possiamo impedirlo, ma almeno non chiediamo noi una copia vecchia.
        'Cache-Control': 'no-cache',
    })
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:
            dati = r.read()
    except (urllib.error.URLError, urllib.error.HTTPError, OSError, ValueError) as e:
        print(f'fia_cp: richiesta fallita {url}: {e}', file=sys.stderr)
        return None
    if binario:
        return dati
    return dati.decode('utf-8', errors='replace')


_RE_EVENTO = re.compile(r'<div class="event-title[^"]*">\s*(.*?)\s*</div>', re.S)
_RE_RIGA = re.compile(
    r'<li class="document-row[^"]*">\s*<a href="([^"]+)"'      # href del PDF
    r'(.*?)</a>', re.S)
_RE_TITOLO = re.compile(r'<div class="title">\s*(.*?)\s*</div>', re.S)
_RE_DATA = re.compile(r'class="date-display-single">\s*([0-9.]+\s+[0-9:]+)\s*<')

# Il sito scrive "CET" tutto l'anno anche quando e' CEST. L'unica lettura corretta
# e' "ora locale di Parigi": chi prende "CET" alla lettera sbaglia di un'ora d'estate.
_TZ_ELENCO = 'Europe/Paris'


def _fuso_parigi():
    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo(_TZ_ELENCO)
    except Exception:
        return None


def _iso_pubblicazione(grezzo):
    """'24.07.26 12:54' (ora di Parigi) -> ISO con offset reale. None se illeggibile."""
    m = re.match(r'\s*(\d{2})\.(\d{2})\.(\d{2,4})\s+(\d{1,2}):(\d{2})', grezzo or '')
    if not m:
        return None
    gg, mm, aa, hh, mi = m.groups()
    anno = int(aa)
    anno = anno + 2000 if anno < 100 else anno
    try:
        naive = datetime(anno, int(mm), int(gg), int(hh), int(mi))
    except ValueError:
        return None
    tz = _fuso_parigi()
    if tz is None:
        # Senza tzdata non si indovina l'offset: si dichiara l'ora locale nuda.
        return naive.isoformat()
    return naive.replace(tzinfo=tz).isoformat()


def scopri_documento(anno, atteso_gp=None, html_testo=None):
    """Trova il PDF "Car Presentation Submissions" della gara IMMINENTE.

    Interroga SOLO la pagina radice del campionato, dove l'evento in corso e' il
    primo elencato ed e' l'unico espanso. NON costruisce mai lo slug del file e NON
    usa mai /event/<Nome> (T9: quella URL serve documenti di altri anni).

    Ritorna {url, slug, pubblicato_iso, titolo_evento, doc} oppure None.
    `atteso_gp` (es. "Hungarian Grand Prix") e' un filtro opzionale: se non combacia
    col titolo dell'evento la scoperta fallisce invece di consegnare la gara sbagliata.
    `html_testo` serve solo ai collaudi offline.
    """
    pagina = html_testo if html_testo is not None else _get(URL_RADICE)
    if not pagina:
        return None

    m_evt = _RE_EVENTO.search(pagina)
    if not m_evt:
        # Senza il blocco evento non si sa a quale gara appartengono le righe.
        # Prima si proseguiva lo stesso con titolo_evento='': la prima riga
        # "Car Presentation" della pagina, di qualunque gara, veniva restituita
        # e — con atteso_gp assente — accettata. Si rifiuta e basta.
        print('fia_cp: nessun blocco "event-title" nella pagina radice: markup '
              'cambiato, non si indovina a quale gara appartengono le righe',
              file=sys.stderr)
        return None
    titolo_evento = _norm(html.unescape(m_evt.group(1)))
    if not titolo_evento:
        print('fia_cp: blocco evento senza titolo', file=sys.stderr)
        return None

    if atteso_gp and _chiave(atteso_gp) != _chiave(titolo_evento):
        print(f'fia_cp: evento in cima "{titolo_evento}" != atteso "{atteso_gp}"',
              file=sys.stderr)
        return None

    # T10: la pagina "season" elenca solo le gare gia' disputate; qui invece l'evento
    # in cima e' quello in corso. Ci si ferma al primo blocco evento.
    # ATTENZIONE: la pagina vera ha UN SOLO blocco "event-title", quindi la ricerca
    # del successivo torna -1. Prima, in quel caso, si ripiegava su TUTTA la pagina,
    # comprese le righe che stanno PRIMA del blocco: una riga "Car Presentation" di
    # un'altra gara veniva accettata e accoppiata a questo titolo e — peggio — al
    # timestamp sbagliato, che e' il dato su cui si calcola il T-meno.
    fine = pagina.find('<div class="event-title', m_evt.end())
    blocco = pagina[m_evt.end():fine if fine > 0 else len(pagina)]

    for m in _RE_RIGA.finditer(blocco):
        href, corpo = m.group(1), m.group(2)
        m_tit = _RE_TITOLO.search(corpo)
        titolo = _norm(html.unescape(m_tit.group(1))) if m_tit else ''
        if TITOLO_DOCUMENTO not in titolo.lower():
            continue
        if not href.lower().endswith('.pdf'):
            continue
        url = href if href.startswith('http') else BASE_FIA + href
        slug = url.rsplit('/', 1)[-1]
        # T9, primo sbarramento: il nome del file deve iniziare con l'anno chiesto.
        if not slug.startswith(f'{anno}_'):
            print(f'fia_cp: scartato {slug}: non e\' del {anno}', file=sys.stderr)
            continue
        m_data = _RE_DATA.search(corpo)
        # Il numero di documento NON e' fisso (Doc 9 / 13 / 14): si registra, non si usa.
        m_doc = re.match(r'Doc\s*(\d+)', titolo)
        return {
            'url': url,
            'slug': slug,
            'pubblicato_iso': _iso_pubblicazione(m_data.group(1)) if m_data else None,
            'titolo_evento': titolo_evento,
            'doc': int(m_doc.group(1)) if m_doc else None,
        }
    print('fia_cp: nessuna riga "Car Presentation Submissions" nell\'evento in cima',
          file=sys.stderr)
    return None


# ================================================================= 2. SCARICO

def _pdf_intero(dati):
    """(ok, motivo) per un blocco di byte che dovrebbe essere un PDF.

    Non basta il magic: T12 (stale-if-error del CDN) puo' servire un oggetto
    TRONCATO con un Content-Length coerente. Un PDF troncato ha il magic e la
    dimensione giusta ma non ha piu' il marcatore di fine file, e a quel punto si
    infila in cache e ci resta per sempre. Si controllano magic, lunghezza e coda.
    """
    if not dati:
        return False, 'risposta vuota'
    if len(dati) < 10000:
        return False, f'troppo corto ({len(dati)} byte)'
    if not dati.startswith(b'%PDF'):
        return False, 'non comincia con %PDF'
    if b'%%EOF' not in dati[-2048:]:
        return False, 'manca %%EOF in coda: file troncato'
    return True, ''


def _cache_valida(dest):
    """La copia gia' in cache e' ancora un PDF intero? (era: "e' grande?")."""
    try:
        if not os.path.exists(dest) or os.path.getsize(dest) <= 10000:
            return False
        with open(dest, 'rb') as f:
            testa = f.read(5)
            f.seek(max(0, os.path.getsize(dest) - 2048))
            coda = f.read()
    except OSError:
        return False
    return testa.startswith(b'%PDF') and b'%%EOF' in coda


def scarica(url, cartella=CACHE_DIR, rispetta_crawl_delay=True, forza=False):
    """Scarica il PDF in cache (fuori dal repo). Se c'e' gia' ed e' INTERO, non riscarica.

    Ritorna il percorso locale o None. Il file viene scritto prima come .tmp e poi
    rinominato: una cache non finisce mai a meta'. Prima di una richiesta VERA si
    aspetta il Crawl-delay dichiarato dal robots.txt della FIA (la richiesta
    precedente e' quasi sempre quella dell'elenco); su cache non si aspetta.

    `forza=True` riscarica anche se la copia in cache e' valida: la FIA ritira e
    rinumera documenti (T12), e senza questo non c'era modo di rinfrescare.

    La copia in cache non e' piu' giudicata dalla sola dimensione: un oggetto
    troncato ma grande superava il controllo, si insediava in cache e da li' in
    poi ogni giro tornava lo stesso file rotto, senza via di recupero automatica.
    """
    if not url:
        return None
    slug = url.rsplit('/', 1)[-1]
    if not slug.lower().endswith('.pdf'):
        print(f'fia_cp: url non e\' un pdf: {url}', file=sys.stderr)
        return None
    dest = os.path.join(cartella, slug)
    if not forza and _cache_valida(dest):
        return dest
    if os.path.exists(dest):
        print(f'fia_cp: copia in cache {"scartata" if not forza else "rinfrescata"}'
              f': {dest}', file=sys.stderr)
    try:
        os.makedirs(cartella, exist_ok=True)
    except OSError as e:
        print(f'fia_cp: cache non creabile {cartella}: {e}', file=sys.stderr)
        return None
    if rispetta_crawl_delay:
        import time
        time.sleep(CRAWL_DELAY_S)
    dati = _get(url, binario=True)
    ok, motivo = _pdf_intero(dati)
    if not ok:
        print(f'fia_cp: scarico rifiutato ({motivo}): {url}', file=sys.stderr)
        return None
    try:
        with open(dest + '.tmp', 'wb') as f:
            f.write(dati)
        # Ultimo controllo prima di far entrare il file in cache: che si APRA.
        # Magic e lunghezza non bastano — un PDF puo' avere entrambi ed essere
        # illeggibile. Se pdfplumber non c'e', si accettano i controlli sui byte.
        pdf, err = _apri_pdf(dest + '.tmp')
        if pdf is None and err and not err.startswith('dipendenza assente'):
            os.remove(dest + '.tmp')
            print(f'fia_cp: scaricato ma illeggibile, non messo in cache: {err}',
                  file=sys.stderr)
            return None
        if pdf is not None:
            try:
                pdf.close()
            except Exception:
                pass
        os.replace(dest + '.tmp', dest)
    except OSError as e:
        print(f'fia_cp: scrittura cache fallita: {e}', file=sys.stderr)
        return None
    return dest


# ============================================================ 3. CANCELLO IDENTITA'

def _apri_pdf(path):
    """(pdf, errore). pdfplumber e' importato QUI: se manca, stato, non crash."""
    try:
        import pdfplumber
    except ImportError:
        return None, 'dipendenza assente: pdfplumber'
    try:
        return pdfplumber.open(path), None
    except Exception as e:                                   # PDF rotto/troncato
        return None, f'PDF illeggibile: {e}'


def _copertina(pdf):
    """Testo della prima pagina (verticale) del documento."""
    try:
        return _norm(pdf.pages[0].extract_text() or '')
    except Exception:
        return ''


def _gp_utilizzabile(atteso_gp):
    """(ok, motivo): `atteso_gp` e' abbastanza specifico da essere un controllo?

    Il confronto sulla copertina e' per contenimento, quindi '', None o
    'Grand Prix' passerebbero su QUALUNQUE documento: il cancello sul nome della
    gara diventerebbe un no-op proprio quando serve. Serve un nome di gara vero
    (T11: "Barcelona-Catalunya" e "Spanish"=Madrid sono due gare diverse).
    """
    k = _chiave(atteso_gp or '')
    if not k:
        return False, 'atteso_gp assente: senza il nome della gara il cancello non controlla nulla'
    proprio = re.sub(r'\b(grand|prix|gp|grande|premio)\b', ' ', k).strip()
    if len(proprio) < 3:
        return False, (f'atteso_gp "{atteso_gp}" e\' generico: combacia con '
                       f'qualunque Gran Premio')
    return True, ''


def cancello_identita(path, anno, atteso_gp):
    """(ok, motivo). E' la difesa contro T9: dati di un altro anno o di un'altra gara.

    Rifiuta se: `atteso_gp` manca o e' generico; il nome del file non inizia con
    l'anno; la copertina non nomina l'anno; la copertina non nomina il GP atteso.
    In dubbio RIFIUTA.

    `atteso_gp` e' OBBLIGATORIO. Prima un valore vuoto disattivava in silenzio il
    controllo sulla gara, e si componeva col difetto di scopri_documento: markup
    cambiato -> titolo_evento='' -> cancello cieco -> passava il documento di
    un'altra gara. Due guardie che cadevano insieme.
    """
    ok_gp, perche = _gp_utilizzabile(atteso_gp)
    if not ok_gp:
        return False, perche
    if not path or not os.path.exists(path):
        return False, 'file assente'
    nome = os.path.basename(path)
    if not nome.startswith(f'{anno}_'):
        return False, f'il nome del file non inizia con {anno}: {nome}'

    pdf, err = _apri_pdf(path)
    if pdf is None:
        return False, err
    try:
        cop = _copertina(pdf)
    finally:
        try:
            pdf.close()
        except Exception:
            pass

    if not cop:
        return False, 'copertina senza testo: identita\' non verificabile'
    if str(anno) not in cop:
        return False, f'la copertina non nomina l\'anno {anno}'
    if 'car presentation' not in cop.lower():
        return False, 'la copertina non e\' un Car Presentation Submissions'
    # T11: "Barcelona-Catalunya" e "Spanish" (=Madrid) sono DUE gare diverse;
    # il confronto e' sul nome intero, mai su una parola sola.
    if _chiave(atteso_gp) not in _chiave(cop):
        return False, f'la copertina non nomina "{atteso_gp}"'
    return True, 'identita\' verificata'


# ================================================================= 4. ESTRAZIONE

# --- geometria: righe di parole -------------------------------------------------

def _linee(parole, tol=2.6):
    """Parole raggruppate in righe di testo per coordinata verticale."""
    fuori = []
    for w in sorted(parole, key=lambda w: (w['top'], w['x0'])):
        if fuori and abs(w['top'] - fuori[-1][0]['top']) <= tol:
            fuori[-1].append(w)
        else:
            fuori.append([w])
    return [sorted(l, key=lambda w: w['x0']) for l in fuori]


_ANCORE = (('componente', 'updated'), ('motivo', 'primary'),
           ('geometria', 'geometric'), ('descrizione', 'brief'))
COLONNE = ('numero', 'componente', 'motivo', 'geometria', 'descrizione')


def _centri_intestazione(righe):
    """Centri x delle 4 intestazioni, dalla riga che le contiene tutte in ordine.

    T2: gli indici di colonna dell'estrazione grezza NON sono stabili (13, 7, 5
    colonne a seconda della squadra). Le intestazioni sono CENTRATE nella loro
    cella, quindi il loro centro x individua la colonna in modo indipendente
    dalla geometria sporca.
    """
    for i0 in range(len(righe)):
        # Le quattro intestazioni non stanno sempre sulla stessa riga: in Giappone
        # "Geometric differences..." va a capo da sola. Si cercano dentro un blocco
        # di poche righe vicine, non su una riga sola.
        blocco = [L for L in righe[i0:i0 + 3]
                  if L[0]['top'] - righe[i0][0]['top'] < 32]
        trovate = {}
        for L in blocco:
            for j, w in enumerate(L):
                t = w['text'].lower()
                for nome, pref in _ANCORE:
                    if nome not in trovate and t.startswith(pref):
                        trovate[nome] = (id(L), L, j)
        if len(trovate) < 4:
            continue
        centri = {}
        for nome, (idL, L, j) in trovate.items():
            # L'intestazione e' CENTRATA nella sua cella: il centro del suo blocco di
            # parole individua la colonna. Il blocco finisce dove lo spazio si allarga
            # (fra colonne il salto e' >10pt, fra parole ~3pt) o dove inizia un'altra
            # intestazione sulla stessa riga.
            altri = {jj for (idM, M, jj) in trovate.values() if idM == idL} - {j}
            fine = j
            while (fine + 1 < len(L) and (fine + 1) not in altri
                   and L[fine + 1]['x0'] - L[fine]['x1'] <= 10):
                fine += 1
            centri[nome] = (L[j]['x0'] + L[fine]['x1']) / 2.0
        c = [centri[n] for n, _ in _ANCORE]
        if c != sorted(c) or len(set(c)) < 4:
            continue
        righe_int = [L for (idL, L, j) in trovate.values()]
        return (c,
                min(L[0]['top'] for L in righe_int),
                max(max(w['bottom'] for w in L) for L in righe_int))
    return None, None, None


def _gruppi(valori, tol=2.0):
    valori = sorted(valori)
    fuori = []
    for v in valori:
        if not fuori or v - fuori[-1][-1] > tol:
            fuori.append([v])
        else:
            fuori[-1].append(v)
    return [sum(g) / len(g) for g in fuori]


def _bordi_x(pg):
    """Confini verticali VERI della tabella.

    Discriminante: un confine di colonna compare sia come lato SINISTRO di una
    cella sia come lato DESTRO della cella precedente. I riquadri decorativi di
    riga-di-testo (rientrati dentro la cella) compaiono solo da un lato: cosi'
    si scartano senza inventare soglie.
    """
    W, H = pg.width, pg.height
    sx, dx = [], []
    for r in pg.rects:
        if (r['x1'] - r['x0']) > W * 0.97 and (r['bottom'] - r['top']) > H * 0.9:
            continue                                    # sfondo pagina
        sx.append(r['x0'])
        dx.append(r['x1'])
    if not sx:
        return [], [], []
    gsx, gdx = _gruppi(sx), _gruppi(dx)
    interni = [a for a in gsx if any(abs(a - b) <= 2.5 for b in gdx)]
    return interni, gsx, gdx


def _colonne_pagina(pg, centri):
    """Sei confini x (numero|componente|motivo|geometria|descrizione) da centri+bordi."""
    interni, gsx, gdx = _bordi_x(pg)
    conf = []
    for a, b in zip(centri, centri[1:]):
        medio = (a + b) / 2.0
        cand = [x for x in interni if a + 3 < x < b - 3]
        conf.append(min(cand, key=lambda x: abs(x - medio)) if cand else medio)
    # Le intestazioni sono centrate: il lato mancante si ricava per simmetria e poi
    # si aggancia al bordo vero piu' vicino, se c'e'.
    sinistro = 2 * centri[0] - conf[0]
    destro = 2 * centri[3] - conf[2]
    cand_sx = [x for x in gsx if abs(x - sinistro) < 14 and x < conf[0]]
    if cand_sx:
        sinistro = min(cand_sx, key=lambda x: abs(x - sinistro))
    cand_dx = [x for x in gdx if abs(x - destro) < 14 and x > conf[2]]
    if cand_dx:
        destro = min(cand_dx, key=lambda x: abs(x - destro))
    # La colonna del numero sta a sinistra: parte dal margine della tabella.
    numero_sx = min([x for x in gsx if x < sinistro - 2] or [max(0.0, sinistro - 40)])
    return [numero_sx, sinistro] + conf + [destro]


def _confini_y(pg, bordi, y_min):
    """Per ogni colonna, i confini orizzontali delle SUE celle.

    Si accettano solo i rettangoli agganciati alla griglia di colonna (bordi e
    sfondi di cella); i riquadri di riga-di-testo, rientrati, restano fuori.
    Colonne diverse hanno confini diversi: e' cosi' che si riconoscono le celle
    unite (una descrizione che vale per piu' componenti).
    """
    per_colonna = [[] for _ in bordi[:-1]]
    for r in pg.rects:
        i = j = None
        for k, b in enumerate(bordi):
            if abs(r['x0'] - b) <= 3.0:
                i = k
            if abs(r['x1'] - b) <= 3.0:
                j = k
        if i is None or j is None or j <= i:
            continue
        if r['bottom'] < y_min - 2:
            continue
        for c in range(i, j):
            per_colonna[c].append(r['top'])
            per_colonna[c].append(r['bottom'])
    return [_gruppi(v, 1.6) for v in per_colonna]


def _testo_in(parole, x0, x1, y0, y1):
    """Testo delle parole il cui centro cade nel riquadro, riga per riga."""
    dentro = [w for w in parole
              if x0 - 1 <= (w['x0'] + w['x1']) / 2 <= x1 + 1
              and y0 - 0.5 <= (w['top'] + w['bottom']) / 2 <= y1 + 0.5]
    if not dentro:
        return ''
    return _norm(' '.join(' '.join(w['text'] for w in L) for L in _linee(dentro)))


def _righe_da_testo(parole, bordi, y_min):
    """Ripiego quando la tabella non ha nessuna griglia disegnata.

    Le righe si deducono dai numeri progressivi nella prima colonna. Le celle unite
    non sono piu' riconoscibili: chi usa il risultato lo sa dalla diagnostica.
    """
    numeri = []
    for w in parole:
        if w['top'] < y_min - 2:
            continue
        cx = (w['x0'] + w['x1']) / 2
        if bordi[0] - 1 <= cx <= bordi[1] + 1 and re.fullmatch(r'\d{1,2}', w['text']):
            numeri.append(w)
    numeri.sort(key=lambda w: w['top'])
    if not numeri:
        return []
    confini = [max(y_min, numeri[0]['top'] - 3)]
    for a, b in zip(numeri, numeri[1:]):
        confini.append((a['bottom'] + b['top']) / 2.0)
    confini.append(max(w['bottom'] for w in parole) + 4)
    return list(zip(confini, confini[1:]))


def _cella(confini_col, y0, y1):
    """Riquadro verticale della cella di quella colonna che contiene la riga.

    Se la colonna ha meno confini delle righe, la cella e' UNITA: il suo testo
    vale per tutte le righe che copre (T1/tabelle a celle unite).
    """
    if not confini_col or len(confini_col) < 2:
        return y0, y1
    mezzo = (y0 + y1) / 2.0
    for a, b in zip(confini_col, confini_col[1:]):
        if a - 0.5 <= mezzo <= b + 0.5:
            return a, b
    return y0, y1


def _pagina_muta(pg):
    """Classifica una pagina da cui non si estrae UNA SOLA parola.

    Prima della correzione questa pagina veniva scartata in silenzio ('vuota'), ed
    era il buco piu' pericoloso del modulo: una continuazione consegnata come
    bitmap faceva sparire meta' dei componenti di una squadra lasciando la
    diagnostica pulita e il cancello verde.

    Il discriminante e' cosa c'e' DISEGNATO, ed e' netto sui documenti 2026:
      - tavola fotografica (91 casi): 0 bordi interni di colonna, 0 rettangoli;
      - continuazione vera   (7 casi): 6 bordi interni, da 80 a 243 rettangoli.
    Una griglia disegnata senza una parola dentro e' una tabella che non si sa
    leggere, mai una fotografia.

    Ritorna 'tabella_muta' (guasto, blocca) o 'tavola_fotografica' (scarto
    benigno, ma comunque DICHIARATO in diagnostica: mai piu' silenzio).
    """
    W, H = pg.width, pg.height
    try:
        interni, _, _ = _bordi_x(pg)
    except Exception:
        interni = []
    riquadri = [r for r in pg.rects
                if not ((r['x1'] - r['x0']) > W * 0.97
                        and (r['bottom'] - r['top']) > H * 0.9)]
    if len(interni) >= 3 or len(riquadri) >= 20:
        return {'tipo': 'tabella_muta', 'squadra_grezza': None, 'righe': [],
                'note': [f'griglia tabellare disegnata ({len(interni)} confini di '
                         f'colonna, {len(riquadri)} riquadri) ma nessun testo '
                         f'estraibile: tabella consegnata come immagine (T5+T1)']}
    try:
        area = sum((im['x1'] - im['x0']) * (im['bottom'] - im['top'])
                   for im in pg.images) / float(W * H)
    except Exception:
        area = 0.0
    return {'tipo': 'tavola_fotografica', 'squadra_grezza': None, 'righe': [],
            'note': [f'nessun testo estraibile, nessuna griglia: tavola '
                     f'fotografica presunta ({len(pg.images)} immagini, '
                     f'{area * 100:.0f}% della pagina)']}


def _pagina_squadra(pg):
    """Legge UNA pagina. Ritorna un dizionario con quel che ha capito.

    {'tipo': 'intestata'|'continuazione'|'nessuno_dichiarato'|'immagine'
             |'tabella_muta'|'tavola_fotografica'|'illeggibile',
     'squadra_grezza', 'righe': [...], 'note': [...]}
    """
    nota = []
    try:
        parole = pg.extract_words(x_tolerance=1.5, y_tolerance=2.5)
    except Exception as e:
        return {'tipo': 'illeggibile', 'squadra_grezza': None, 'righe': [],
                'note': [f'parole non estraibili: {e}']}
    testo = _norm(' '.join(w['text'] for w in parole))
    righe_testo = _linee(parole)
    centri, y_int, y_fine = _centri_intestazione(righe_testo)

    # Una pagina APRE una squadra se e solo se comincia col titolo "Car Presentation
    # – <GP>": vale per tutte le 121 sezioni-squadra del 2026, comprese quelle
    # senza aggiornamenti e quella consegnata come immagine. Senza questa regola il
    # piede di pagina di una continuazione ("3 Atlassian Williams F1 Team © 2026...")
    # verrebbe scambiato per il nome di una squadra nuova.
    prima = _norm(' '.join(w['text'] for w in righe_testo[0])) if righe_testo else ''
    apre = prima.lower().startswith('car presentation')

    # Nome squadra: la riga fra il titolo e l'intestazione della tabella.
    squadra_grezza = None
    if apre:
        for L in righe_testo[1:4]:
            t = _norm(' '.join(w['text'] for w in L))
            if not t or '©' in t or 'rights reserved' in t.lower():
                continue
            if y_int is not None and L[0]['top'] >= y_int - 1:
                break
            squadra_grezza = t
            break

    # T7: NULL DICHIARATO. E' una notizia vera ("questa squadra non porta nulla"),
    # non un guasto. Va distinto dal parsing fallito, che non si pubblica mai.
    # La formula NON e' fissa: "No updates submitted for this event." (la piu'
    # comune), ma anche "No Updates" e "No updates.". Si accetta solo se e' TUTTO
    # quel che resta della pagina: una frase simile dentro una tabella non conta.
    if apre and centri is None:
        resto = _norm(testo)
        for pezzo in (prima, squadra_grezza or ''):
            if pezzo and resto.lower().startswith(pezzo.lower()):
                resto = resto[len(pezzo):].strip()
        if len(resto) < 90 and re.match(r'(?i)^no\s+updates?\b', resto):
            return {'tipo': 'nessuno_dichiarato', 'squadra_grezza': squadra_grezza,
                    'righe': [], 'note': [f'dichiarato: "{resto}"']}

    if centri is None or not apre:
        if apre:
            # T5: squadra dichiarata, ma tabella non leggibile come testo (a Melbourne
            # Williams l'ha consegnata come BITMAP). Zero testo estraibile NON vuol
            # dire zero aggiornamenti: e' un guasto, e come tale non si pubblica.
            quale = ('tabella consegnata come immagine' if pg.images and len(testo) < 200
                     else 'intestazione della tabella non riconosciuta')
            return {'tipo': 'immagine', 'squadra_grezza': squadra_grezza,
                    'righe': [], 'note': [quale]}
        if not testo:
            # T5 APPLICATA A T1 — il guasto peggiore, e prima passava muto.
            # Una pagina SENZA una parola leggibile non e' automaticamente una
            # tavola fotografica: puo' essere la seconda pagina di una squadra
            # consegnata come bitmap, e allora meta' dei componenti sparisce
            # mentre la numerazione letta resta contigua (1..N) e il cancello
            # dice OK. Qui si guarda cosa c'e' DISEGNATO sulla pagina.
            #
            # Misurato sugli 11 documenti 2026, il discriminante e' netto:
            #   - 91 tavole fotografiche: 0 bordi interni di colonna, 0 rettangoli;
            #   - 7 pagine di continuazione vere: 6 bordi interni, 80..243 rettangoli.
            # Una griglia tabellare disegnata senza una parola dentro e' quindi
            # una tabella che non si e' saputa leggere, mai una fotografia.
            return _pagina_muta(pg)
        # T1: pagina di continuazione, senza intestazione e senza nome squadra.
        return {'tipo': 'continuazione', 'squadra_grezza': None, 'righe': None,
                'note': nota, 'testo': testo}

    bordi = _colonne_pagina(pg, centri)
    righe, vuote, cieche = _leggi_griglia(pg, parole, bordi, y_fine + 1, nota)
    if cieche:
        nota.append(f'{cieche} righe disegnate dalla griglia ma senza testo '
                    f'leggibile: tabella parzialmente in immagine (T5)')
    return {'tipo': 'intestata', 'squadra_grezza': squadra_grezza,
            'righe': righe, 'bordi': bordi, 'note': nota, 'vuote': vuote,
            'cieche': cieche}


def _e_intestazione(celle):
    """La banda e' la riga di intestazione della tabella, non un componente."""
    return (_norm(celle.get('componente', '')).lower().startswith('updated')
            or _norm(celle.get('motivo', '')).lower().startswith('primary')
            or _norm(celle.get('geometria', '')).lower().startswith('geometric'))


def _riga_con_sostanza(celle):
    """La banda contiene un componente VERO: un nome piu' almeno un altro campo.

    Serve a distinguere una riga che la fonte ha lasciato senza numero (dato vero,
    da tenere) da una banda di servizio o da un artefatto della griglia (da
    scartare). Un solo campo pieno non basta: potrebbe essere la coda di una cella
    unita che sborda.
    """
    comp = _norm(celle.get('componente', ''))
    altri = [_norm(celle.get(k, '')) for k in ('motivo', 'geometria', 'descrizione')]
    return bool(comp) and any(altri)


def _leggi_griglia(pg, parole, bordi, y_min, nota):
    """(righe, numeri_vuoti, bande_cieche) di una pagina, date le colonne.

    `bande_cieche` sono le righe che la GRIGLIA DISEGNA ma di cui non si legge una
    sola parola: sono il sintomo di una tabella il cui testo e' in bitmap (T5), e
    finora sparivano dentro un `continue` muto insieme all'intestazione.

    Regola generale di questa funzione, dopo la correzione: una banda si scarta
    SOLO se si sa dire cos'e'. Tutto il resto o diventa una riga, o diventa rumore
    dichiarato. Non esiste piu' lo scarto silenzioso.
    """
    confini = _confini_y(pg, bordi, y_min)
    grid = confini[0] if len(confini[0]) >= 3 else max(confini, key=len)
    da_griglia = len(grid) >= 3
    if da_griglia:
        bande = [(a, b) for a, b in zip(grid, grid[1:]) if b - a > 4 and b > y_min - 4]
    else:
        nota.append('griglia assente: righe dedotte dal testo, celle unite non viste')
        bande = _righe_da_testo(parole, bordi, y_min)
        confini = [[] for _ in bordi[:-1]]

    fuori, vuote, cieche, lette = [], [], [], []
    for k, (y0, y1) in enumerate(bande):
        n = _testo_in(parole, bordi[0], bordi[1], y0, y1)
        celle = {}
        for c, nome in enumerate(COLONNE[1:], start=1):
            ca, cb = _cella(confini[c], y0, y1)
            celle[nome] = _testo_in(parole, bordi[c], bordi[c + 1], ca, cb)
        if not re.fullmatch(r'\d{1,2}', n or ''):
            # Il campo numero non e' una cifra. Sono QUATTRO casi diversi, e prima
            # della correzione finivano tutti nello stesso `continue` muto.
            if _e_intestazione(celle):
                continue                                  # riga di intestazione
            if not any(celle.values()):
                # Banda disegnata e completamente muta: o e' un residuo della
                # griglia, o e' una riga il cui testo non e' estraibile (T5).
                # Si registra la POSIZIONE: qui sotto contano solo le mute che
                # stanno IN MEZZO alle righe lette.
                cieche.append(k)
                continue
            if not _riga_con_sostanza(celle):
                # Qualcosa c'e' ma non basta a chiamarlo componente: non si
                # inventa una riga, pero' non si tace nemmeno.
                nota.append('banda senza numero a y=%.0f, contenuto parziale: %r'
                            % (y0, {k: v[:40] for k, v in celle.items() if v}))
                continue
            # RIGA VERA CHE LA FONTE HA LASCIATO SENZA NUMERO (Red Bull, Austria
            # 2026, "Floor Board"). Il dato c'e' tutto: buttarlo sarebbe la
            # perdita silenziosa che questo modulo esiste per impedire. Si tiene
            # con n=None e si dichiara in diagnostica.
            fuori.append({'n': None, **celle})
            lette.append(k)
            continue
        lette.append(k)
        if not any(celle.values()):
            # Riga numerata e completamente vuota nella FONTE (Red Bull a Barcellona
            # ne consegna due). Non e' un componente e non e' un guasto: si scarta,
            # ma si dichiara, perche' altrimenti i conteggi non tornerebbero mai.
            vuote.append(int(n))
            continue
        fuori.append({'n': int(n), **celle})

    # Una banda muta PRIMA della prima riga o DOPO l'ultima e' quasi sempre un
    # riquadro di chiusura del template: misurato sul 2026, 2 casi su 121 sezioni
    # (Miami, Red Bull p7 e Ferrari p9), entrambi innocui. Una banda muta IN MEZZO
    # a righe lette no: li' c'e' una riga il cui testo non si estrae. E se non si e'
    # letta NESSUNA riga, tutte le bande mute contano: e' la tabella in bitmap.
    if lette:
        cieche = [k for k in cieche if lette[0] < k < lette[-1]]
    return fuori, vuote, len(cieche)


def estrai(path):
    """Legge il PDF e ritorna la struttura per squadra. Non alza mai eccezioni.

    {gp, anno, squadre: [{team, team_norm, stato, componenti: [...]}], diagnostica}
    stato: "aggiornamenti" | "nessuno_dichiarato" | "parsing_fallito"
    """
    esito = {'gp': None, 'anno': None, 'squadre': [],
             'diagnostica': {'file': os.path.basename(path or ''), 'pagine': 0,
                             'pagine_continuazione': 0, 'componenti_non_classificati': [],
                             'squadre_non_riconosciute': [], 'righe_vuote': [],
                             'righe_senza_numero': [], 'pagine_tabella_non_lette': [],
                             'pagine_ignorate': [], 'pagine_scartate': [],
                             'note': []}}
    pdf, err = _apri_pdf(path)
    if pdf is None:
        esito['diagnostica']['note'].append(err)
        return esito
    try:
        cop = _copertina(pdf)
        m = re.search(r'(20\d\d)\s+(.+?GRAND PRIX)', cop, re.I)
        if m:
            esito['anno'] = int(m.group(1))
            esito['gp'] = _norm(m.group(2)).title()
        esito['diagnostica']['pagine'] = len(pdf.pages)

        squadre = []
        for i, pg in enumerate(pdf.pages[1:], start=2):
            try:
                letta = _pagina_squadra(pg)
            except Exception as e:                      # una pagina non ferma il resto
                esito['diagnostica']['note'].append(f'pagina {i}: {e}')
                continue
            tipo = letta['tipo']
            if tipo == 'tavola_fotografica':
                # Scarto benigno, ma DICHIARATO: e' l'asimmetria che rendeva
                # invisibile la continuazione senza testo (la stessa pagina con
                # una riga di piede finiva almeno in pagine_ignorate).
                esito['diagnostica']['pagine_ignorate'].append(
                    f'{i}: {letta["note"][0]}')
                esito['diagnostica']['pagine_scartate'].append(i)
                continue
            if tipo == 'tabella_muta':
                # C'e' una tabella disegnata e non la si sa leggere. Se seguiva una
                # squadra, quella squadra e' incompleta: parsing fallito, e il
                # cancello la blocca. Non si pubblica meta' di un pacchetto.
                motivo = letta['note'][0]
                esito['diagnostica']['pagine_tabella_non_lette'].append(i)
                esito['diagnostica']['note'].append(f'pagina {i}: {motivo}')
                if squadre:
                    squadre[-1]['stato'] = 'parsing_fallito'
                    squadre[-1]['note'].append(f'pagina {i}: {motivo}')
                continue
            if tipo in ('intestata', 'nessuno_dichiarato', 'immagine'):
                grezzo = letta['squadra_grezza'] or ''
                norm = normalizza_squadra(grezzo)
                if norm is None and grezzo:
                    esito['diagnostica']['squadre_non_riconosciute'].append(grezzo)
                stato = {'intestata': 'aggiornamenti',
                         'nessuno_dichiarato': 'nessuno_dichiarato',
                         'immagine': 'parsing_fallito'}[tipo]
                squadre.append({'team': grezzo, 'team_norm': norm, 'stato': stato,
                                'pagine': [i], 'righe': list(letta['righe'] or []),
                                'note': list(letta['note']),
                                'vuote': list(letta.get('vuote') or []),
                                'cieche': letta.get('cieche') or 0,
                                '_bordi': letta.get('bordi')})
                continue
            if tipo == 'illeggibile':
                esito['diagnostica']['note'].append(f'pagina {i}: {letta["note"]}')
                continue
            # T1: continuazione. Eredita la squadra precedente e RIUSA le sue colonne:
            # e' qui che un parser una-pagina-una-squadra perde meta' delle righe.
            if not squadre:
                esito['diagnostica']['note'].append(
                    f'pagina {i}: continuazione senza squadra precedente')
                continue
            prec = squadre[-1]
            agg, anomalia, cieche = _continuazione(pg, prec)
            if cieche:
                prec['cieche'] = prec.get('cieche', 0) + cieche
                prec['note'].append(
                    f'pagina {i}: {cieche} righe disegnate ma senza testo (T5)')
            if agg:
                prec['righe'].extend(agg)
                prec['pagine'].append(i)
                esito['diagnostica']['pagine_continuazione'] += 1
            elif anomalia is None:
                esito['diagnostica']['pagine_ignorate'].append(
                    f'{i}: tavola fotografica col solo piede di pagina '
                    f'{(letta.get("testo") or "")[:60]!r}')
                esito['diagnostica']['pagine_scartate'].append(i)
            else:
                # Pagina con del testo che non si e' saputo leggere: potrebbe essere
                # una continuazione persa. Non si tace: la squadra diventa dubbia.
                prec['stato'] = 'parsing_fallito'
                prec['note'].append(f'pagina {i}: {anomalia}')
                esito['diagnostica']['note'].append(f'pagina {i}: {anomalia}')
    finally:
        try:
            pdf.close()
        except Exception:
            pass

    for s in squadre:
        comp = []
        for r in s['righe']:
            fam, sotto = separa_motivo(r['motivo'])
            zona = zona_di(r['componente'])
            if zona == ZONA_IGNOTA and r['componente']:
                esito['diagnostica']['componenti_non_classificati'].append(
                    f"{s['team_norm'] or s['team']}: {r['componente']}")
            comp.append({'n': r['n'], 'componente': _norm(r['componente']),
                         'zona': zona, 'motivo_famiglia': fam,
                         'motivo_sottotipo': sotto,
                         'geometria': _norm(r['geometria']),
                         'descrizione': _norm(r['descrizione'])})
        if s['vuote']:
            nota = (f'righe numerate ma vuote nella fonte: {sorted(s["vuote"])}')
            s['note'].append(nota)
            esito['diagnostica']['righe_vuote'].append(
                f"{s['team_norm'] or s['team']}: {sorted(s['vuote'])}")
        # Righe che la fonte ha lasciato senza numero progressivo: si pubblicano
        # (il dato c'e'), ma si dichiarano, perche' rompono la sola quadratura
        # che il modulo aveva — la numerazione contigua.
        senza_n = [c['componente'] for c in comp if c['n'] is None]
        if senza_n:
            s['note'].append(f'righe senza numero nella fonte: {senza_n}')
            esito['diagnostica']['righe_senza_numero'].append(
                f"{s['team_norm'] or s['team']}: {senza_n}")
        if s.get('cieche') and s['stato'] == 'aggiornamenti':
            # Righe disegnate dalla griglia di cui non si legge una parola: la
            # tabella e' in parte un'immagine, quindi il pacchetto e' incompleto.
            s['stato'] = 'parsing_fallito'
        if s['stato'] == 'aggiornamenti' and not comp and not s['vuote']:
            # Intestazione trovata ma nessuna riga letta: e' un guasto, non uno zero.
            s['stato'] = 'parsing_fallito'
            s['note'].append('tabella riconosciuta ma nessuna riga estratta')
        esito['squadre'].append({
            'team': s['team'], 'team_norm': s['team_norm'], 'stato': s['stato'],
            'pagine': s['pagine'], 'componenti': comp, 'note': s['note'],
            'righe_vuote': sorted(s['vuote']),
            'righe_senza_numero': len(senza_n),
        })
    return esito


def _continuazione(pg, precedente):
    """(righe, anomalia, bande_cieche) per una pagina che continua la squadra (T1).

    Le righe si accettano SOLO se la numerazione riprende esattamente da dove si
    era fermata la pagina prima: e' l'unico modo di distinguere una continuazione
    vera dal piede di pagina di una tavola fotografica ("3 Atlassian Williams F1
    Team (c) 2026...", che a Miami vale un componente fantasma).

    `bande_cieche` porta fuori il caso misto: piede di pagina leggibile ma tabella
    in bitmap. La pagina ha del testo, quindi non passa da _pagina_muta, e senza
    questo conteggio tornerebbe a essere una perdita silenziosa.
    """
    try:
        parole = pg.extract_words(x_tolerance=1.5, y_tolerance=2.5)
    except Exception as e:
        return [], f'parole non estraibili: {e}', 0
    testo = _norm(' '.join(w['text'] for w in parole))
    # Una tavola fotografica porta al massimo il piede di pagina (una riga) o
    # qualche carattere di scarto. Tutto il resto e' roba che va spiegata, non
    # ignorata: e' li' che si nasconde la continuazione persa (T1).
    foto = len(_linee(parole)) <= 1 or len(testo) < 40

    bordi = precedente.get('_bordi')
    if not bordi:
        # Le pagine di continuazione ripetono la stessa griglia della pagina che
        # apre la squadra: se quella non l'aveva, si ricava dai bordi disegnati.
        bordi = _griglia_da_bordi(pg)
    if not bordi:
        return [], (None if foto else 'continuazione senza griglia leggibile'), 0

    # Le bande mute contate qui valgono anche se la pagina "sembra" una foto: una
    # tavola fotografica non ha una griglia disegnata, quindi bande mute IN MEZZO
    # a righe lette vogliono dire tabella in bitmap, non fotografia.
    righe, vuote, cieche = _leggi_griglia(pg, parole, bordi, 0.0, [])
    if not righe:
        return [], (None if foto else 'continuazione senza righe leggibili'), cieche

    numerate = sorted([r['n'] for r in righe if r['n'] is not None] + list(vuote))
    if not numerate:
        # Solo righe senza numero: non si sa dove si agganciano. Meglio nulla che
        # una riga appesa alla squadra sbagliata.
        return [], (None if foto else 'continuazione con righe tutte senza numero'), cieche
    ultimo = max([r['n'] for r in precedente['righe'] if r['n'] is not None]
                 + list(precedente['vuote']), default=0)
    if numerate != list(range(ultimo + 1, ultimo + 1 + len(numerate))):
        if foto:
            return [], None, cieche              # piede di pagina di una tavola foto
        return [], (f'continuazione scartata: numerazione {numerate} non riprende '
                    f'da {ultimo + 1}'), cieche
    precedente['vuote'].extend(vuote)
    return righe, None, cieche


def _griglia_da_bordi(pg):
    """Sei confini x da una pagina senza intestazione: fra i bordi disegnati si
    tiene la partizione in 5 colonne che massimizza la colonna piu' stretta."""
    interni, gsx, gdx = _bordi_x(pg)
    if len(interni) < 3:
        return None
    tutti = sorted(set([min(gsx)] + list(interni) + [max(gdx)]))
    if len(tutti) < 6 or len(tutti) > 16:
        # Meno di 6 confini: non e' una tabella a 5 colonne. Piu' di 16: la pagina
        # e' troppo disordinata perche' una scelta sia difendibile — meglio nulla.
        return None
    # Le 5 colonne sono le piu' larghe: si tiene la partizione a 6 confini che
    # massimizza la larghezza minima (le colonne vere sono tutte "grosse").
    import itertools
    migliore, punteggio = None, -1.0
    for combo in itertools.combinations(tutti[1:-1], 4):
        b = [tutti[0]] + list(combo) + [tutti[-1]]
        larg = [y - x for x, y in zip(b, b[1:])]
        if min(larg) < 15:
            continue
        p = min(larg)
        if p > punteggio:
            migliore, punteggio = b, p
    return migliore


# ============================================================ 5. CANCELLO QUALITA'

def cancello_qualita(estratto, squadre_attese=SQUADRE_2026):
    """(ok, problemi). Se non passa, il chiamante NON pubblica.

    Quadratura: nessuna anomalia in diagnostica; tutte le squadre attese presenti
    e riconosciute; nessuna in "parsing_fallito"; numerazione righe contigua 1..N
    per squadra; motivi riconosciuti in proporzione al numero di righe.

    Il controllo di contiguita' vede i buchi IN MEZZO (1,2,4 -> manca il 3) ma per
    costruzione NON puo' vedere una perdita in CODA: se si perdono le righe 9..16
    resta 1..8, che e' contiguo. E una pagina di continuazione persa produce
    sempre e solo una perdita di coda. Percio' la difesa contro quel caso non sta
    qui: sta in estrai(), che classifica OGNI pagina e trasforma una tabella non
    letta in parsing_fallito. Questa funzione la raccoglie leggendo la diagnostica
    — cosa che prima non faceva affatto, ed era il buco che armava tutto il resto.
    """
    problemi = []
    if not estratto or not estratto.get('squadre'):
        return False, ['nessuna squadra estratta']

    # Il cancello guarda ANCHE la diagnostica. Prima non la guardava affatto: una
    # pagina con una tabella dentro poteva restare non letta e il cancello diceva
    # OK lo stesso, perche' guardava solo le squadre che era riuscito a costruire.
    diag = estratto.get('diagnostica') or {}
    for p in diag.get('pagine_tabella_non_lette') or []:
        problemi.append(f'pagina {p}: contiene una tabella che non si e\' saputa '
                        f'leggere (T5 su una continuazione): righe perse in coda')
    for n in diag.get('note') or []:
        problemi.append(f'diagnostica: {n}')

    # Perdita di CODA: la difesa che mancava. Il documento e' regolare — a ogni
    # squadra corrisponde UNA pagina di tavole fotografiche — e sui documenti 2026
    # (231 pagine, 94 scartate) non esistono DUE pagine scartate di fila, mai.
    # Se ne compaiono due attaccate, una delle due stava al posto di qualcosa: e'
    # esattamente la forma che assume una continuazione consegnata come immagine
    # senza griglia, cioe' l'unico modo rimasto di perdere righe in silenzio.
    # Puo' anche essere una squadra con due tavole fotografiche: in quel caso si
    # guarda la diagnostica e si decide a mano. Meglio fermarsi che pubblicare
    # meta' di un pacchetto aggiornamenti.
    scartate = sorted(diag.get('pagine_scartate') or [])
    attaccate = [(a, b) for a, b in zip(scartate, scartate[1:]) if b == a + 1]
    for a, b in attaccate:
        problemi.append(
            f'pagine {a} e {b} scartate di fila: nel 2026 non succede mai (0 casi '
            f'su 94 pagine scartate). O una squadra ha due tavole fotografiche, o '
            f'una pagina di continuazione e\' stata consegnata come immagine e le '
            f'sue righe sono perse in coda senza rompere la numerazione (T1+T5)')

    viste = {}
    for s in estratto['squadre']:
        nome = s.get('team_norm')
        if not nome:
            problemi.append(f'squadra non riconosciuta: "{s.get("team")}" (T8)')
            continue
        if nome in viste:
            problemi.append(f'{nome}: compare due volte (pagine {s.get("pagine")})')
        viste[nome] = s

    # T3: una squadra che sparisce dev'essere un errore RUMOROSO.
    for atteso in squadre_attese:
        if atteso not in viste:
            problemi.append(f'{atteso}: squadra assente dall\'estratto (T3)')

    n_righe = 0
    for nome, s in viste.items():
        if s['stato'] == 'parsing_fallito':
            problemi.append(f'{nome}: parsing fallito ({"; ".join(s.get("note") or []) or "senza dettaglio"})')
            continue
        if s['stato'] == 'nessuno_dichiarato':
            if s['componenti']:
                problemi.append(f'{nome}: dichiara "nessun aggiornamento" ma ha righe')
            continue
        numeri = ([c['n'] for c in s['componenti'] if c['n'] is not None]
                  + list(s.get('righe_vuote') or []))
        numeri.sort()
        n_righe += len(s['componenti'])
        if numeri != list(range(1, len(numeri) + 1)):
            # T1: e' esattamente il sintomo della pagina di continuazione persa.
            # Puo' anche essere un buco della FONTE (Aston Martin in Australia salta
            # il 6): il modulo non sa distinguere i due casi, quindi blocca e lo dice.
            mancanti = [k for k in range(1, (max(numeri) if numeri else 0) + 1)
                        if k not in numeri]
            problemi.append(
                f'{nome}: numerazione non contigua, mancano {mancanti} '
                f'(lette {len(numeri)} righe, l\'ultima e\' la {max(numeri)}): '
                f'o la fonte salta un numero, o si e\' persa una pagina (T1)')
        vuoti = [c['n'] for c in s['componenti'] if not c['componente']]
        if vuoti:
            problemi.append(f'{nome}: componente vuoto alle righe {vuoti}')
        ignote = [c['n'] for c in s['componenti'] if c['zona'] == ZONA_IGNOTA]
        if len(ignote) > max(1, len(numeri) // 2):
            problemi.append(f'{nome}: {len(ignote)}/{len(numeri)} componenti fuori tabella zone')
        senza_motivo = [c['n'] for c in s['componenti']
                        if c['motivo_famiglia'] == FAMIGLIA_ALTRO and not c['motivo_sottotipo']]
        if senza_motivo:
            problemi.append(f'{nome}: motivo assente alle righe {senza_motivo}')

    # I motivi riconosciuti devono seguire il numero di righe: se quasi nessuno e'
    # di una famiglia nota, l'estrazione ha preso la colonna sbagliata (T2).
    noti = sum(1 for s in viste.values() for c in s['componenti']
               if c['motivo_famiglia'] in FAMIGLIE)
    if n_righe and noti < n_righe * 0.8:
        problemi.append(f'motivi riconosciuti {noti}/{n_righe}: colonna motivo sospetta (T2)')

    return (not problemi), problemi


# ================================================================== diagnostica

def _cli(argv):
    import argparse
    ap = argparse.ArgumentParser(description='Diagnostica fia_cp (non pubblica nulla)')
    ap.add_argument('--pdf', help='PDF locale da leggere')
    ap.add_argument('--scopri', type=int, metavar='ANNO',
                    help='interroga la pagina radice FIA e stampa il documento trovato')
    ap.add_argument('--gp', help='GP atteso (per --scopri e per il cancello identita)')
    ap.add_argument('--json', action='store_true', help='stampa l\'estratto in JSON')
    a = ap.parse_args(argv)

    if a.scopri:
        doc = scopri_documento(a.scopri, a.gp)
        print(json.dumps(doc, ensure_ascii=False, indent=2))
        return 0 if doc else 1
    if not a.pdf:
        ap.print_help()
        return 2

    if a.gp:
        anno = int(os.path.basename(a.pdf)[:4]) if os.path.basename(a.pdf)[:4].isdigit() else 0
        ok, motivo = cancello_identita(a.pdf, anno, a.gp)
        print(f'identita: {"OK" if ok else "NO"} — {motivo}')
        if not ok:
            return 1
    est = estrai(a.pdf)
    if a.json:
        print(json.dumps(est, ensure_ascii=False, indent=2))
        return 0
    print(f'{est["gp"]} {est["anno"]} — {len(est["squadre"])} squadre')
    for s in est['squadre']:
        print(f'  {(s["team_norm"] or s["team"]):15s} {s["stato"]:20s} '
              f'{len(s["componenti"]):2d} componenti  pagine={s["pagine"]}')
    d = est['diagnostica']
    print(f'diagnostica: {d["pagine"]} pagine, {d["pagine_continuazione"]} continuazioni, '
          f'{len(d["pagine_scartate"])} pagine scartate {d["pagine_scartate"]}')
    for etichetta in ('righe_senza_numero', 'righe_vuote', 'pagine_tabella_non_lette',
                      'squadre_non_riconosciute', 'componenti_non_classificati', 'note'):
        if d.get(etichetta):
            print(f'  {etichetta}: {d[etichetta]}')
    ok, problemi = cancello_qualita(est)
    print(f'qualita: {"OK" if ok else "NO"}')
    for p in problemi:
        print('  - ' + p)
    return 0


if __name__ == '__main__':
    sys.exit(_cli(sys.argv[1:]))
