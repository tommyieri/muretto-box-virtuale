"""
Anteprima aggiornamenti — l'articolo del VENERDI', appena la FIA pubblica il
documento "Car Presentation Submissions" e PRIMA che le libere girino.

Che cosa dice e perche' cosi':
 - CHI ha portato aggiornamenti, QUANTI componenti, in che ZONA della vettura e con
   che INTENZIONE DICHIARATA (il campo "Primary reason" del documento: carico
   locale, condizionamento del flusso, raffreddamento, resistenza...);
 - CHI non ha portato NULLA: il "No updates submitted for this event" e' un NULL
   DICHIARATO dalla fonte, cioe' una notizia, non un buco nei dati;
 - il contesto stagionale: quante volte quella squadra ha aggiornato nei weekend
   PRECEDENTI, letto dai documenti FIA gia' in cache. Il documento di questa gara
   resta FUORI dal contesto: se ci stesse dentro, "ha aggiornato in 4 degli 11
   weekend letti finora" conterebbe anche il pacchetto di cui parla il titolo, e il
   numero confermerebbe se stesso.

UNA RIGA NON E' UN AGGIORNAMENTO — il difetto che questo pezzo ha rischiato di
pubblicare. Le squadre compilano il modulo in modi diversi: a Hungaroring Aston
Martin ha 16 righe ma 7 descrizioni distinte, e lo dice a lettere ("The front wing,
endplate and nose are a package", "All floor changes are developed as a package"),
mentre le altre nove squadre scrivono una descrizione per riga. Mettere "16" contro
"5" e' confrontare due stili di compilazione. Percio' qui si contano SEMPRE tutte e
due le cose — righe e aggiornamenti distinti (= righe della stessa squadra con la
STESSA descrizione, contate una volta) — e la classifica si ordina sui secondi. Non
e' una stima di grandezza: quella resta NON_MISURABILE.

DUE CONTEGGI, MAI UNO SOLO. Il documento distingue i motivi in famiglie e due di
queste NON sono la stessa cosa:
 - "Performance"      = SVILUPPO: la macchina cambia, e resta cambiata;
 - "Circuit specific" = CONFIGURAZIONE per quel tracciato (ala scarica, aperture di
   raffreddamento): a Monaco 2026 era il 29% dei pezzi, a Spa il 24%.
Sommarli darebbe un numero che non vuol dire niente. Restano separati ovunque, e la
famiglia si legge dalla cella: quando il prefisso manca NON esiste una quarta
famiglia della FIA, c'e' una cella incompleta. Si riprende la famiglia solo se lo
stesso motivo e' scritto per esteso ALTROVE NELLO STESSO documento
(fia_cp.riconcilia_famiglie), e la riassegnazione si dichiara nel pezzo.

I TRE NULL DELLA FONTE (dichiarati nel pezzo, MAI colmati):
 1. il documento non dice MAI su quale vettura o pilota va il pezzo (zero occorrenze
    di "car N" / "both cars" / "driver N" nei documenti 2026; "chassis" e "driver"
    da soli NON si cercano: la' sono nomi di componente, e la frase pubblicata non
    promette di averli cercati);
 2. non contiene NESSUN numero di prestazione: il CONTEGGIO dei pezzi non e' la
    grandezza dell'aggiornamento — una riga "Rear Wing" puo' essere un'ala nuova o
    un ritocco di flap;
 3. a volte il pezzo e' solo "available" / "optional": portato, non per forza
    montato. Le righe che lo dicono a lettere si contano e si dichiarano.

CANCELLI (se uno si chiude, l'articolo NON esce: si ritorna None, non si inventa):
 1. il documento della gara imminente non e' ancora pubblicato -> niente articolo;
 2. FRESCHEZZA: un documento pubblicato piu' di 7 giorni fa e' quello della gara
    scorsa (la pagina radice FIA resta ferma finche' non esce il nuovo) -> None;
 3. IDENTITA' (fia_cp.cancello_identita): anno e nome-gara sulla copertina;
 4. QUALITA' (fia_cp.cancello_qualita): squadre tutte presenti, numerazione
    contigua, nessuna tabella non letta. Meta' pacchetto non si pubblica;
 5. SOSTANZA: se non c'e' ne' un componente ne' un NULL dichiarato, non c'e' pezzo.

Il soggetto dell'articolo e' SEMPRE la gara che il documento dichiara (est['gp']),
non quella chiesta dal chiamante: cosi' un'anteprima non puo' finire sotto la gara
sbagliata. Il filtro sul nome (`atteso_gp`) si applica solo per le gare il cui nome
FIA e' ACCERTATO dai documenti 2026 gia' letti — T11 insegna che "Barcelona-Catalunya"
e "Spanish" sono due gare diverse, quindi i nomi non si indovinano.

python3 di SISTEMA (pdfplumber). Solo lettura; bozza nell'area Lab: non tocca demo/.
"""
from __future__ import annotations
import os
import sys
import glob
import json
import re
import datetime
from collections import Counter, defaultdict

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import fia_cp  # noqa: E402
import svg     # noqa: E402
import base    # noqa: E402

ID = "upgrade-preview"

# --- parametri dichiarati ----------------------------------------------------
FRESCHEZZA_GIORNI = 7      # oltre: il documento in cima e' quello della gara scorsa
MAX_PDF_CONTESTO = 40      # tetto di sicurezza sulla scansione della cache

# Colori: le chiavi di demo/team_colori.json non coincidono con i nomi canonici di
# fia_cp (che sono i nomi brevi della redazione). Alias espliciti, mai indovinati.
ALIAS_COLORI = {"Red Bull": "Red Bull Racing", "Haas": "Haas F1 Team"}

# Nomi FIA ACCERTATI sui documenti 2026 gia' letti: solo questi si usano come
# filtro `atteso_gp`. Per una gara non in tabella non si indovina il nome (T11):
# si prende l'evento in cima alla pagina FIA e lo si sottopone al cancello di
# freschezza e a quello di identita'.
GP_FIA = {
    "Australia": "Australian Grand Prix",
    "Cina": "Chinese Grand Prix",
    "Giappone": "Japanese Grand Prix",
    "Miami": "Miami Grand Prix",
    "Canada": "Canadian Grand Prix",
    "Monaco": "Monaco Grand Prix",
    "Spagna": "Barcelona-Catalunya Grand Prix",   # T11: NON "Spanish" (=Madrid)
    "Austria": "Austrian Grand Prix",
    "Gran Bretagna": "British Grand Prix",
    "Belgio": "Belgian Grand Prix",
    "Ungheria": "Hungarian Grand Prix",
}

# Traduzione di sola VISUALIZZAZIONE (nome FIA -> nome italiano). Non e' un filtro:
# se un titolo non e' in tabella si scrive il nome come lo scrive la FIA.
IT_DA_FIA = {fia_cp._chiave(v): k for k, v in GP_FIA.items()}
IT_DA_FIA.update({
    "dutch grand prix": "Olanda",
    "italian grand prix": "Italia",
    "azerbaijan grand prix": "Azerbaigian",
    "singapore grand prix": "Singapore",
    "united states grand prix": "Stati Uniti",
    "mexico city grand prix": "Messico",
    "sao paulo grand prix": "Brasile",
    "las vegas grand prix": "Las Vegas",
    "qatar grand prix": "Qatar",
    "abu dhabi grand prix": "Abu Dhabi",
    "bahrain grand prix": "Bahrain",
    "saudi arabian grand prix": "Arabia Saudita",
    "spanish grand prix": "Spagna (Madrid)",
})

# Circuito per la targhetta, quando il nome italiano e' noto. Assente = si tace.
CIRCUITI = {
    "Australia": "Albert Park", "Cina": "Shanghai", "Giappone": "Suzuka",
    "Miami": "Miami", "Canada": "Montreal", "Monaco": "Monaco",
    "Spagna": "Barcellona-Catalunya", "Austria": "Red Bull Ring",
    "Gran Bretagna": "Silverstone", "Belgio": "Spa-Francorchamps",
    "Ungheria": "Hungaroring", "Olanda": "Zandvoort", "Italia": "Monza",
}

# --- famiglie e intenzioni ---------------------------------------------------
FAM_IT = {
    "Performance": "sviluppo",
    "Circuit specific": "configurazione da circuito",
    "Reliability": "affidabilita'",
    fia_cp.FAMIGLIA_ALTRO: "motivo non classificato",
}
FAM_BREVE = {
    "Performance": "sviluppo",
    "Circuit specific": "circuito",
    "Reliability": "affidabilità",
    fia_cp.FAMIGLIA_ALTRO: "non classificato",
}

# "Primary reason" -> intenzione in italiano. Tabella COSTRUITA DAI DATI (tutti i
# sottotipi visti nei documenti 2026). Un sottotipo che non e' qui NON si traduce:
# resta la parola della fonte.
_INTENZIONI = {
    "local load": "carico locale",
    "flow conditioning": "condizionamento del flusso",
    "cooling range": "raffreddamento",
    "cooling": "raffreddamento",
    "brake cooling": "raffreddamento dei freni",
    "drag range": "resistenza (drag)",
    "drag reduction": "riduzione della resistenza",
    "balance range": "bilanciamento",
    "mechanical setup": "assetto meccanico",
    "correlation": "correlazione galleria-pista",
    "structural improvement": "irrobustimento strutturale",
}
# Motivi COMPOSTI ("Local Load and Cooling", "Rear flow delivery & cooling
# integration"): si assegnano alla PRIMA intenzione riconosciuta in quest'ordine,
# e il fatto che siano composti si dichiara. Un pezzo = una intenzione, cosi' la
# somma delle intenzioni torna sempre col numero dei pezzi.
_INTENZIONI_CONTIENE = (
    ("cooling", "raffreddamento"),
    ("drag", "resistenza (drag)"),
    ("local load", "carico locale"),
    ("flow", "condizionamento del flusso"),
    ("balance", "bilanciamento"),
    ("structural", "irrobustimento strutturale"),
)

# NULL 3 della fonte: il pezzo puo' essere solo "portato", non montato.
_RE_OPZIONALE = re.compile(r"\b(available|optional|if required|when required)\b", re.I)

# NULL 1 della fonte: su QUALE vettura va il pezzo. Non si eredita come dogma: si
# RIMISURA su ogni documento, cercando ogni modo in cui la fonte potrebbe dirlo.
# Se un giorno la FIA cominciasse a dirlo, il pezzo se ne accorgerebbe da solo.
# Si cercano solo le formule con cui si INDICA una vettura, non le parole che sono
# nomi di pezzi: "chassis" e "driver" da soli compaiono come componenti ("meet the
# chassis", "driver cooling") e direbbero il falso.
_RE_VETTURA = re.compile(r"\b(cars?\s*(no\.?|number|#)?\s*\d|both\s+cars|either\s+car|"
                         r"each\s+car|one\s+car\s+only|driver\s*\d|race\s+numbers?)\b", re.I)


def it(x, dec=1):
    return base.it(x, dec)


def _slug(nome):
    s = (nome or "").lower()
    for a, b in (("à", "a"), ("è", "e"), ("é", "e"), ("ì", "i"), ("ò", "o"),
                 ("ù", "u"), (" ", "-"), ("'", "")):
        s = s.replace(a, b)
    return "".join(c for c in s if c.isalnum() or c == "-") or "gara"


def _lista_it(xs):
    xs = [x for x in xs if x]
    if not xs:
        return ""
    if len(xs) == 1:
        return xs[0]
    return ", ".join(xs[:-1]) + " e " + xs[-1]


def _pct(n, d):
    return 100.0 * n / d if d else 0.0


def _pezzi(n):
    return f"{n} pezzo" if n == 1 else f"{n} pezzi"


def _dei(n):
    """"dei 5" ma "degli 11": l'articolo segue il suono del numero, non la cifra."""
    return "degli" if n in (1, 8, 11) else "dei"


def _corto(s, n=34):
    """Etichetta accorciata per l'asse di una figura (il testo intero resta nei
    fatti). Serve perche' un "Primary reason" non tradotto puo' essere lungo una
    riga intera e uscire dal disegno."""
    s = fia_cp._norm(s)
    return s if len(s) <= n else s[:n - 1].rstrip() + "…"


def intenzione_it(famiglia, sottotipo):
    """"Local Load" -> "carico locale". Mai indovinata: se non e' in tabella resta
    la parola della FIA (e si vede, nel pezzo, che e' la sua)."""
    k = fia_cp._chiave(sottotipo or "")
    if not k:
        return "affidabilità" if famiglia == "Reliability" else "non dichiarata"
    if k in _INTENZIONI:
        return _INTENZIONI[k]
    for frammento, etichetta in _INTENZIONI_CONTIENE:
        if frammento in k:
            return etichetta
    return fia_cp._norm(sottotipo)


def _composto(sottotipo):
    k = fia_cp._chiave(sottotipo or "")
    return bool(k) and k not in _INTENZIONI and (" and " in k or "&" in (sottotipo or ""))


# --- una riga non e' un aggiornamento ----------------------------------------
# Il difetto piu' grosso che questo pezzo poteva avere: mettere in classifica il
# NUMERO DI RIGHE di squadre che compilano il modulo in modi diversi. Aston Martin
# spacchetta UN aggiornamento su piu' righe e lo scrive a lettere nella descrizione
# ("The front wing, endplate and nose are a package", "All floor changes are
# developed as a package"); le altre dieci squadre scrivono una descrizione per
# riga. "16 contro 5" confronta due stili di compilazione, non due pacchetti.
#
# LA MISURA, e il suo limite. Righe della STESSA squadra con la STESSA descrizione
# (identica dopo normalizzazione) = UN aggiornamento dichiarato. Non e' una stima
# della grandezza — quella resta NON_MISURABILE (NULL 2) — e non cattura i pacchetti
# che la fonte NON dichiara come tali: e' solo il conteggio piu' onesto disponibile,
# perche' usa quello che la squadra ha scritto di suo pugno. Una riga senza
# descrizione fa blocco da sola: senza testo non c'e' niente da unire.
def _blocchi(componenti):
    """[{descrizione, componenti[], n}] — un blocco per aggiornamento DICHIARATO."""
    ordine, per_chiave = [], {}
    for i, c in enumerate(componenti):
        testo = fia_cp._norm(c.get("descrizione") or "")
        k = fia_cp._chiave(testo) or ("__senza_descrizione__", i)
        if k not in per_chiave:
            per_chiave[k] = {"descrizione": testo, "componenti": []}
            ordine.append(k)
        per_chiave[k]["componenti"].append(c.get("componente"))
    return [{"descrizione": per_chiave[k]["descrizione"],
             "componenti": per_chiave[k]["componenti"],
             "n": len(per_chiave[k]["componenti"])} for k in ordine]


_STOP_IT = {"di", "dei", "del", "della", "delle", "la", "il", "lo", "le", "e", "a",
            "in", "su", "per", "da", "dal", "un", "una", "non", "con"}


def _parole(etichetta):
    return {p for p in re.split(r"[^a-zà-ù]+", (etichetta or "").lower())
            if p and p not in _STOP_IT and len(p) > 3}


def _intenzione_a_cavallo(intz_fam):
    """La prima coppia di intenzioni che condividono una parola ma stanno in famiglie
    diverse. Serve a impedire la scorciatoia "raffreddamento = configurazione": nello
    stesso documento «raffreddamento» puo' essere Circuit specific e «raffreddamento
    dei freni» Performance. Ritorna (a, fam_a, n_a, b, fam_b, n_b) o None."""
    voci = [(et, fam, n) for (et, fam), n in intz_fam.items()]
    voci.sort(key=lambda v: (-v[2], v[0]))
    for i, (a, fa, na) in enumerate(voci):
        for b, fb, nb in voci[i + 1:]:
            if fa != fb and (_parole(a) & _parole(b)):
                return a, fa, na, b, fb, nb
    return None


def _colore(team, colori):
    return colori.get(ALIAS_COLORI.get(team, team)) or colori.get(team) or "var(--dim)"


# ---------------------------------------------------------------------------
# CONTESTO STAGIONALE (dai documenti gia' in cache)
# ---------------------------------------------------------------------------
def _cartelle_contesto(extra=None):
    """Cartelle in cui cercare i documenti FIA gia' scaricati, senza duplicati."""
    fuori = []
    for c in ([extra] if extra else []) + [fia_cp.CACHE_DIR] + \
             (os.environ.get("MURETTO_FIA_CP_DIRS", "").split(os.pathsep)):
        c = (c or "").strip()
        if c and os.path.isdir(c) and c not in fuori:
            fuori.append(c)
    return fuori


def contesto_stagionale(anno, cartelle, escludi_gp=None):
    """Quante volte ogni squadra ha aggiornato nei documenti FIA dell'anno.

    Si leggono i PDF gia' in cache: nessuna richiesta di rete. Un documento di un
    altro anno viene scartato (l'anno si legge dalla copertina, non dal nome del
    file), e una gara letta due volte (nomi diversi, stesso GP) conta una volta
    sola. Le squadre in "parsing_fallito" non si contano ne' da una parte ne'
    dall'altra: si contano a parte, come letture incomplete DICHIARATE.

    `escludi_gp` TOGLIE una gara dal contesto, e serve sempre: il contesto di
    un'ANTEPRIMA deve essere quello che c'era PRIMA di questo weekend. Contando
    anche il documento che l'articolo sta commentando, "ha aggiornato in 4 degli 11
    weekend letti finora" comprende il pacchetto di cui parla il titolo: il numero
    si conferma da solo, ed e' circolare. Fuori il weekend corrente, resta "3 dei
    10 weekend precedenti", che e' quel che la frase promette al lettore.

    Ritorna {gare, squadre: {nome: {con, letti, componenti}}, incomplete,
    riconciliazioni}.
    """
    visti = set()
    gare = []
    per_squadra = defaultdict(lambda: {"con": 0, "letti": 0, "componenti": 0})
    incomplete = []
    riconciliate = 0
    k_escludi = fia_cp._chiave(escludi_gp or "") or None
    file_letti = 0
    for cartella in cartelle:
        for path in sorted(glob.glob(os.path.join(cartella, "*.pdf"))):
            if file_letti >= MAX_PDF_CONTESTO:
                break
            file_letti += 1
            try:
                est = fia_cp.estrai(path)
            except Exception:                      # una fonte non ferma il contesto
                continue
            if not est or est.get("anno") != anno or not est.get("squadre"):
                continue
            chiave = fia_cp._chiave(est.get("gp") or os.path.basename(path))
            if chiave in visti or (k_escludi and chiave == k_escludi):
                continue
            visti.add(chiave)
            # stessa regola dichiarata che si applica al documento in prima pagina:
            # la quota di configurazione dev'essere confrontabile fra le gare.
            riconciliate += len(fia_cp.riconcilia_famiglie(est))
            n_comp = sum(len(s["componenti"]) for s in est["squadre"])
            n_circ = sum(1 for s in est["squadre"] for c in s["componenti"]
                         if c["motivo_famiglia"] == "Circuit specific")
            gare.append({"gp": est.get("gp"), "file": os.path.basename(path),
                         "componenti": n_comp, "circuit_specific": n_circ,
                         "quota_circuito": _pct(n_circ, n_comp)})
            for s in est["squadre"]:
                nome = s.get("team_norm")
                if not nome:
                    continue
                if s["stato"] == "parsing_fallito":
                    incomplete.append(f"{nome} @ {est.get('gp')}")
                    continue
                per_squadra[nome]["letti"] += 1
                if s["stato"] == "aggiornamenti" and s["componenti"]:
                    per_squadra[nome]["con"] += 1
                    per_squadra[nome]["componenti"] += len(s["componenti"])
    return {"gare": gare, "squadre": dict(per_squadra), "incomplete": incomplete,
            "escluso": escludi_gp, "riconciliazioni": riconciliate}


# ---------------------------------------------------------------------------
# LETTURA DELLA GARA CORRENTE
# ---------------------------------------------------------------------------
def _oggi(data_bozza):
    if data_bozza:
        try:
            return datetime.date.fromisoformat(str(data_bozza)[:10])
        except ValueError:
            pass
    return datetime.date.today()


def _fresco(pubblicato_iso, oggi):
    """(ok, giorni, motivo). Senza data di pubblicazione NON si giudica fresco:
    la pagina radice FIA resta ferma sulla gara scorsa finche' non esce il nuovo
    documento, quindi senza timestamp non c'e' modo di distinguere i due casi."""
    if not pubblicato_iso:
        return False, None, "documento senza data di pubblicazione: freschezza non verificabile"
    try:
        d = datetime.date.fromisoformat(str(pubblicato_iso)[:10])
    except ValueError:
        return False, None, f"data di pubblicazione illeggibile: {pubblicato_iso!r}"
    giorni = (oggi - d).days
    if giorni > FRESCHEZZA_GIORNI:
        return False, giorni, (f"documento pubblicato {giorni} giorni fa: e' quello di una "
                               f"gara gia' corsa, non l'anteprima di questa")
    return True, giorni, ""


def procura_documento(anno, gara=None, pdf=None, data_bozza=None, verbose=False,
                      pubblicato_iso=None):
    """Il PDF della gara imminente + la sua carta d'identita'. None se un cancello chiude.

    `pdf` = percorso locale: salta la scoperta, ma NON salta ne' il cancello di
    identita' ne' quello di qualita'. Se il chiamante sa anche QUANDO il documento e'
    stato pubblicato (`pubblicato_iso`), si rifa' pure il cancello di freschezza: un
    file passato di mano non deve poter aggirare la difesa contro il documento della
    gara scorsa. Senza quella data la freschezza resta non verificabile, e si dichiara.
    """
    note = []
    if pdf:
        if not os.path.exists(pdf):
            return None
        # Offline: il nome-gara atteso lo si prende dalla tabella se il chiamante ha
        # detto quale gara, altrimenti dalla copertina stessa del documento (che e'
        # comunque il confronto che cancello_identita fa sul testo).
        atteso = GP_FIA.get(gara or "")
        if not atteso:
            provvisorio = fia_cp.estrai(pdf)
            atteso = (provvisorio or {}).get("gp")
        if not atteso:
            return None
        ok, motivo = fia_cp.cancello_identita(pdf, anno, atteso)
        if not ok:
            if verbose:
                print(f"  cancello identita': NO — {motivo}")
            return None
        giorni = None
        if pubblicato_iso:
            ok_f, giorni, motivo_f = _fresco(pubblicato_iso, _oggi(data_bozza))
            if not ok_f:
                if verbose:
                    print(f"  cancello freschezza: NO — {motivo_f}")
                return None
            nota_f = f"freschezza verificata: pubblicato {giorni} giorni fa"
        else:
            nota_f = "cancello di freschezza non applicabile: data di pubblicazione ignota"
        return {"path": pdf, "url": None, "slug": os.path.basename(pdf),
                "pubblicato_iso": pubblicato_iso, "titolo_evento": atteso, "doc": None,
                "giorni": giorni,
                "origine": ("documento gia' passato ai cancelli dal chiamante"
                            if pubblicato_iso else "documento locale (collaudo)"),
                "note": [nota_f]}

    atteso = GP_FIA.get(gara or "")
    if gara and not atteso:
        note.append(f"nome FIA di «{gara}» non accertato: si prende l'evento in cima "
                    f"alla pagina FIA e si giudica dalla data (T11: i nomi non si indovinano)")
    doc = fia_cp.scopri_documento(anno, atteso_gp=atteso)
    if not doc:
        return None
    ok, giorni, motivo = _fresco(doc.get("pubblicato_iso"), _oggi(data_bozza))
    if not ok:
        if verbose:
            print(f"  cancello freschezza: NO — {motivo}")
        return None
    path = fia_cp.scarica(doc["url"])
    if not path:
        return None
    ok, motivo = fia_cp.cancello_identita(path, anno, doc["titolo_evento"])
    if not ok:
        if verbose:
            print(f"  cancello identita': NO — {motivo}")
        return None
    return {"path": path, "url": doc["url"], "slug": doc["slug"],
            "pubblicato_iso": doc["pubblicato_iso"], "titolo_evento": doc["titolo_evento"],
            "doc": doc.get("doc"), "giorni": giorni, "origine": "pagina FIA",
            "note": note}


# ---------------------------------------------------------------------------
# CONTEGGI (nessun numero arriva da fuori dal documento)
# ---------------------------------------------------------------------------
def _analizza(est):
    """Conteggi per squadra, per zona, per intenzione. Sviluppo e configurazione
    restano SEMPRE separati: non esiste in tutta questa funzione una somma dei due."""
    squadre = []
    zone = Counter()
    zone_team = defaultdict(Counter)
    intenzioni = Counter()          # (famiglia, intenzione) -> pezzi
    famiglie = Counter()
    opzionali = []
    vettura = []
    composti = 0
    n_blocchi_tot = 0
    spacchettano = []               # squadre in cui una descrizione copre piu' righe

    for s in est["squadre"]:
        nome = s.get("team_norm") or s.get("team")
        fam = Counter()
        zn = Counter()
        intz = Counter()
        for c in s["componenti"]:
            f = c["motivo_famiglia"]
            fam[f] += 1
            famiglie[f] += 1
            zone[c["zona"]] += 1
            zn[c["zona"]] += 1
            zone_team[c["zona"]][nome] += 1
            et = intenzione_it(f, c["motivo_sottotipo"])
            intenzioni[(f, et)] += 1
            intz[et] += 1
            if _composto(c["motivo_sottotipo"]):
                composti += 1
            testo = " ".join((c["componente"] or "", c["geometria"] or "",
                              c["descrizione"] or ""))
            if _RE_OPZIONALE.search(testo):
                opzionali.append({"team": nome, "componente": c["componente"],
                                  "estratto": (c["descrizione"] or "")[:160]})
            if _RE_VETTURA.search(testo):
                vettura.append({"team": nome, "componente": c["componente"],
                                "estratto": (c["descrizione"] or "")[:160]})
        blocchi = _blocchi(s["componenti"])
        multi = [b for b in blocchi if b["n"] > 1]
        n_blocchi_tot += len(blocchi)
        if multi:
            spacchettano.append({"team": nome, "righe": len(s["componenti"]),
                                 "blocchi": len(blocchi),
                                 "esempi": [{"descrizione": b["descrizione"],
                                             "righe": b["componenti"]} for b in multi]})
        squadre.append({
            "team": nome, "stato": s["stato"],
            "n": len(s["componenti"]),
            "blocchi": len(blocchi),
            "blocchi_multi": len(multi),
            "dettaglio_blocchi": [{"descrizione": b["descrizione"],
                                   "righe": b["componenti"], "n": b["n"]}
                                  for b in blocchi],
            "sviluppo": fam.get("Performance", 0),
            "circuito": fam.get("Circuit specific", 0),
            "affidabilita": fam.get("Reliability", 0),
            "altro": fam.get(fia_cp.FAMIGLIA_ALTRO, 0),
            "zone": [z for z, _ in zn.most_common()],
            "zona_top": zn.most_common(1)[0][0] if zn else None,
            "intenzione_top": intz.most_common(1)[0][0] if intz else None,
            "componenti": [{"componente": c["componente"], "zona": c["zona"],
                            "famiglia": c["motivo_famiglia"],
                            "motivo": c["motivo_sottotipo"],
                            "intenzione": intenzione_it(c["motivo_famiglia"],
                                                        c["motivo_sottotipo"])}
                           for c in s["componenti"]],
        })
    return {"squadre": squadre, "zone": zone, "zone_team": zone_team,
            "intenzioni": intenzioni, "famiglie": famiglie,
            "opzionali": opzionali, "vettura": vettura, "composti": composti,
            "blocchi": n_blocchi_tot, "spacchettano": spacchettano}


# ---------------------------------------------------------------------------
# COSTRUZIONE ARTICOLO
# ---------------------------------------------------------------------------
def costruisci(anno, gara=None, pdf=None, data_bozza=None, cartella_contesto=None,
               verbose=False, pubblicato_iso=None):
    doc = procura_documento(anno, gara=gara, pdf=pdf, data_bozza=data_bozza,
                            verbose=verbose, pubblicato_iso=pubblicato_iso)
    if not doc:
        return None

    est = fia_cp.estrai(doc["path"])
    ok, problemi = fia_cp.cancello_qualita(est)
    if not ok:
        if verbose:
            print("  cancello qualita': NO")
            for p in problemi:
                print(f"    - {p}")
        return None

    # La famiglia che la CELLA non scrive non e' una quarta famiglia della FIA: e'
    # un prefisso mancante. Si riprende SOLO da un'altra riga dello stesso documento
    # con lo stesso motivo, e la riassegnazione si dichiara nel pezzo (vedi ric_txt).
    riconciliate = fia_cp.riconcilia_famiglie(est)

    A = _analizza(est)
    n_comp = sum(s["n"] for s in A["squadre"])
    n_null = [s["team"] for s in A["squadre"] if s["stato"] == "nessuno_dichiarato"]
    if not n_comp and not n_null:
        return None                     # CANCELLO 5: non c'e' pezzo senza sostanza

    # nomi: il soggetto e' SEMPRE la gara dichiarata dal documento
    gp_fia = est.get("gp") or doc["titolo_evento"]
    gara_it = IT_DA_FIA.get(fia_cp._chiave(gp_fia), fia_cp._norm(gp_fia))
    circuito = CIRCUITI.get(gara_it)
    dove = circuito or gara_it
    slug = _slug(gara_it)

    colori = base.carica_colori()
    # CONTESTO = i weekend PRECEDENTI. Questo documento resta fuori: e' il soggetto
    # dell'articolo, non una conferma di se stesso.
    ctx = contesto_stagionale(anno, _cartelle_contesto(
        cartella_contesto or os.path.dirname(os.path.abspath(doc["path"]))),
        escludi_gp=gp_fia)
    ctx_squadre = ctx["squadre"]
    n_gare_ctx = len(ctx["gare"])

    def contesto(nome):
        """(con, letti) per la squadra: in quanti weekend PRECEDENTI ha aggiornato."""
        d = ctx_squadre.get(nome)
        if not d or not d["letti"]:
            return None, None
        return d["con"], d["letti"]

    # --- ordinamenti e protagonisti (tutti MISURATI sul documento) -------------
    # Si ordina per AGGIORNAMENTI DICHIARATI (blocchi), non per righe: le righe
    # misurano lo stile di compilazione. Le righe restano come secondo criterio e
    # si stampano sempre accanto ai blocchi, cosi' il lettore vede la differenza.
    con_agg = [s for s in A["squadre"] if s["n"] > 0]
    ordinate = sorted(A["squadre"],
                      key=lambda s: (-s["blocchi"], -s["n"], -s["sviluppo"], s["team"]))
    if not ordinate:
        return None
    top = ordinate[0] if ordinate[0]["n"] > 0 else None
    secondo = ordinate[1] if len(ordinate) > 1 and ordinate[1]["n"] > 0 else None
    # Un primato si dichiara solo se e' STRETTO sul conteggio che conta (i blocchi).
    primato = bool(top) and (secondo is None or secondo["blocchi"] < top["blocchi"])
    pari_merito = ([s["team"] for s in ordinate
                    if top and s["blocchi"] == top["blocchi"] and s["n"] > 0]
                   if top and not primato else [])
    n_sviluppo = A["famiglie"].get("Performance", 0)
    n_circuito = A["famiglie"].get("Circuit specific", 0)
    n_affid = A["famiglie"].get("Reliability", 0)
    n_altro = A["famiglie"].get(fia_cp.FAMIGLIA_ALTRO, 0)
    quota_circ = _pct(n_circuito, n_comp)

    zone_ord = A["zone"].most_common()
    zona_top, zona_top_n = (zone_ord[0] if zone_ord else (None, 0))
    intz_ord = A["intenzioni"].most_common()
    intz_top = intz_ord[0] if intz_ord else None

    accent = _colore(top["team"], colori) if top else "var(--accent)"

    # quota-configurazione delle altre gare: contesto MISURATO, non aneddoto
    quote_altre = sorted(
        [g for g in ctx["gare"] if fia_cp._chiave(g["gp"] or "") != fia_cp._chiave(gp_fia)],
        key=lambda g: -g["quota_circuito"])
    quota_max = quote_altre[0] if quote_altre else None

    # ---------------------------------------------------------------- FIGURA A
    # Sviluppo a destra, configurazione a sinistra: le due colonne non si toccano
    # mai. Le famiglie diverse da queste due restano fuori, DICHIARATE e nominate
    # una per una (mai una didascalia che nomina una famiglia con zero pezzi).
    #
    # OGNI squadra ha la riga col nome nudo, anche quando i pezzi di sviluppo sono
    # zero: prima Williams — 2 pezzi, entrambi Circuit specific — esisteva solo come
    # "Williams · circuito" e chi cercava la sua riga non la trovava. E l'ordine e'
    # quello della barra disegnata (pezzi di sviluppo), non il totale delle righe:
    # altrimenti le barre non sono monotone e la figura sembra sbagliata.
    per_figura = sorted(A["squadre"], key=lambda s: (-s["sviluppo"], -s["circuito"],
                                                     s["team"]))
    righe_a = []
    for s in per_figura:
        con, letti = contesto(s["team"])
        nota_ctx = (f"{con}/{letti} weekend prec." if con is not None else "")
        nota = nota_ctx if s["n"] else ("nessun aggiornamento dichiarato"
                                        + (f" · {nota_ctx}" if nota_ctx else ""))
        righe_a.append({"label": _corto(s["team"], 24), "valore": s["sviluppo"],
                        "nota": nota})
        if s["circuito"]:
            righe_a.append({"label": _corto(f"{s['team']} · circuito", 24),
                            "valore": -s["circuito"], "nota": ""})
    fuori_fig = n_affid + n_altro
    fuori_nomi = _lista_it([f"{n} {FAM_IT[f]}" for f, n in
                            (("Reliability", n_affid), (fia_cp.FAMIGLIA_ALTRO, n_altro))
                            if n])
    den_diverso = sorted({letti for letti in
                          (contesto(s["team"])[1] for s in A["squadre"])
                          if letti is not None})
    fig_a = svg.barre_divergenti(
        righe_a, col_pos="var(--accent)", col_neg="var(--dim)",
        lbl_pos="SVILUPPO (Performance)", lbl_neg="CONFIGURAZIONE (Circuit specific)",
        titolo=f"Chi porta cosa a {dove}: pezzi dichiarati alla FIA, per squadra",
        sub=f"{gara_it} {anno} · documento FIA", ml=170,
        caption=("righe del documento, non grandezza né numero di aggiornamenti"
                 + (f" · fuori figura: {fuori_nomi}" if fuori_fig else "")
                 + (" · denominatore delle note non uguale per tutte: vedi provenienza"
                    if len(den_diverso) > 1 else "")))

    # ---------------------------------------------------------------- FIGURA B
    righe_b = []
    for z, k in zone_ord:
        dominante = A["zone_team"][z].most_common(1)[0][0]
        righe_b.append({"sigla": _corto(z, 24), "colore": _colore(dominante, colori),
                        "valore": float(k), "evidenza": (z == zona_top)})
    fig_b = svg.barre_dv(
        righe_b, titolo=f"Dove si concentra il lavoro: zone della vettura toccate a {dove}",
        sub=f"{gara_it} {anno} · {n_comp} pezzi", unita="pezzi", base=0.0, ml=158, dec=0,
        caption="colore = squadra con più pezzi in quella zona; qui sviluppo e configurazione "
                "sono sommati (separati sopra)")

    # ---------------------------------------------------------------- FIGURA C
    righe_c = []
    for (fam, etichetta), k in intz_ord:
        col = "var(--accent)" if fam == "Performance" else "var(--dim)"
        righe_c.append({"sigla": _corto(f"{etichetta} · {FAM_BREVE.get(fam, fam)}", 40),
                        "colore": col, "valore": float(k),
                        "evidenza": fam == "Performance"})
    # le famiglie citate in didascalia sono SOLO quelle che hanno almeno un pezzo
    altre_fam = _lista_it([FAM_IT.get(f, f) for f in
                           ("Circuit specific", "Reliability", fia_cp.FAMIGLIA_ALTRO)
                           if A["famiglie"].get(f)])
    fig_c = svg.barre_dv(
        righe_c, titolo="Con che intenzione: il «Primary reason» dichiarato",
        sub=f"{gara_it} {anno}", unita="pezzi", base=0.0, ml=268, dec=0,
        caption="intenzione DICHIARATA dal team, non un effetto: nel documento non c'è un solo "
                "numero di prestazione")

    # ------------------------------------------------------------------ FACTS
    F = {
        "id": ID, "anno": anno, "gara": gara_it, "gp_fia": gp_fia,
        "circuito": circuito, "sessione": "FIA (venerdì, prima delle libere)",
        "documento": {"slug": doc["slug"], "url": doc["url"],
                      "pubblicato": doc["pubblicato_iso"], "doc": doc["doc"],
                      "origine": doc["origine"], "giorni_dalla_pubblicazione": doc["giorni"],
                      "note": doc["note"]},
        "totali": {"squadre_lette": len(A["squadre"]),
                   "squadre_con_aggiornamenti": len(con_agg),
                   "squadre_senza_nulla": n_null,
                   "componenti": n_comp,
                   "aggiornamenti_distinti": A["blocchi"],
                   "sviluppo": n_sviluppo, "circuit_specific": n_circuito,
                   "affidabilita": n_affid, "famiglia_non_scritta_in_cella": n_altro,
                   "quota_configurazione_pct": quota_circ},
        "righe_vs_aggiornamenti": {
            "regola": "righe della stessa squadra con descrizione identica = un "
                      "aggiornamento dichiarato (la fonte scrive «are a package»)",
            "righe": n_comp, "aggiornamenti": A["blocchi"],
            "squadre_che_spacchettano": A["spacchettano"]},
        "famiglia_riconciliata": [
            {"team": r["team"], "componente": r["componente"],
             "motivo_cella": r["sottotipo"], "famiglia_assegnata": r["famiglia"],
             "righe_testimoni_nello_stesso_documento": r["testimoni"]}
            for r in riconciliate],
        "pacchetto_piu_grande": ({"team": top["team"], "n": top["n"],
                                  "aggiornamenti_distinti": top["blocchi"],
                                  "primato_stretto": primato,
                                  "pari_merito": pari_merito,
                                  "sviluppo": top["sviluppo"], "circuito": top["circuito"],
                                  "zone": top["zone"],
                                  "intenzione_top": top["intenzione_top"]} if top else None),
        "per_squadra": [{**{k: s[k] for k in ("team", "stato", "n", "blocchi",
                                              "blocchi_multi", "dettaglio_blocchi",
                                              "sviluppo", "circuito",
                                              "affidabilita", "altro", "zona_top",
                                              "intenzione_top", "zone")},
                         "weekend_con_aggiornamenti": contesto(s["team"])[0],
                         "weekend_letti": contesto(s["team"])[1],
                         "componenti": s["componenti"]}
                        for s in ordinate],
        "zone": [{"zona": z, "n": k,
                  "squadra_dominante": A["zone_team"][z].most_common(1)[0][0]}
                 for z, k in zone_ord],
        "intenzioni": [{"famiglia": f, "intenzione": e, "n": k} for (f, e), k in intz_ord],
        "contesto_stagione": {"gare_lette": n_gare_ctx,
                              "perimetro": "weekend PRECEDENTI: il documento di questa "
                                           "gara e' escluso (niente circolarita')",
                              "gara_esclusa": gp_fia,
                              "denominatore_comune": n_gare_ctx,
                              "gare": ctx["gare"],
                              "squadre": ctx_squadre,
                              "letture_incomplete": ctx["incomplete"]},
        "null_fonte": {
            "vettura_o_pilota": {
                "righe_che_la_nominano": len(A["vettura"]),
                "elenco": A["vettura"],
                "cercato": "car N, both cars, either/each car, one car only, "
                           "driver N, race number",
                "non_cercato": "chassis/telaio e «driver» da soli: nel documento "
                               "compaiono come nomi di componente, quindi conterebbero "
                               "il falso. Il conteggio NON copre la parola «telaio»."},
            "grandezza": "nessun numero di prestazione nel documento",
            "montato_o_solo_disponibile": {
                "righe_che_lo_dicono": len(A["opzionali"]),
                "elenco": A["opzionali"]},
        },
        "diagnostica_fonte": est.get("diagnostica", {}),
        "motivi_composti": A["composti"],
    }

    # ------------------------------------------------------------------ PROSA
    data_pub = (doc["pubblicato_iso"] or "")[:10]
    n_squadre = len(A["squadre"])
    n_con = len(con_agg)
    null_txt = _lista_it(n_null)
    top_con, top_letti = contesto(top["team"]) if top else (None, None)

    # Il contesto stagionale del protagonista, con due paletti.
    # (1) PERIMETRO: sono i weekend PRECEDENTI — questo documento e' escluso a monte
    #     (contesto_stagionale(escludi_gp=...)), altrimenti "ha aggiornato in 4 degli
    #     11 weekend letti finora" conterebbe il pacchetto di cui parla il titolo.
    # (2) DENOMINATORI DIVERSI: una squadra puo' avere meno weekend leggibili delle
    #     altre (Williams a Melbourne consegno' la tabella come immagine). Un tasso
    #     su 9 e uno su 10 non si mettono nella stessa classifica come se niente
    #     fosse: il primato si dichiara solo se regge anche nel caso PIU' SFAVOREVOLE
    #     — ai weekend non leggibili del protagonista si attribuisce un aggiornamento,
    #     a quelli delle altre nessuno, tutti sullo stesso denominatore N. Se cosi'
    #     non regge, si tace: la frase "aggiorna meno spesso di tutte" non e' un
    #     dettaglio, e' un primato.
    ctx_top = ""
    if top and top_con is not None and top_letti >= 3:
        N = n_gare_ctx
        raro_txt = ""
        conf = {n: d for n, d in ctx_squadre.items() if d["letti"] >= 3}
        if N >= 3 and len(conf) >= 5 and top["team"] in conf:
            mio = conf[top["team"]]
            mio_max = (mio["con"] + (N - mio["letti"])) / N        # il piu' generoso
            altrui_min = min(d["con"] / N for n, d in conf.items()
                             if n != top["team"])                  # il piu' avaro
            if mio_max < altrui_min:
                raro_txt = " — ed è la squadra che aggiorna <b>meno spesso</b> di tutte"
        ctx_top = (f"{top['team']} ha portato aggiornamenti in <b>{top_con} {_dei(top_letti)} "
                   f"{top_letti} weekend {anno} precedenti</b> — questo escluso"
                   f"{raro_txt}.")

    zona_txt = ""
    if zona_top:
        zona_txt = (f"La zona più toccata è <b>{zona_top.lower()}</b> "
                    f"({zona_top_n} pezzi su {n_comp})")
        if len(zone_ord) > 1:
            z2, k2 = zone_ord[1]
            zona_txt += f", davanti a {z2.lower()} ({k2})"
        zona_txt += "."

    intz_txt = ""
    if intz_top:
        (fam0, et0), k0 = intz_top
        intz_txt = (f"L'intenzione più dichiarata è <b>«{et0}»</b> ({k0} pezzi, famiglia "
                    f"{FAM_IT.get(fam0, fam0)})")
        if len(intz_ord) > 1:
            (fam1, et1), k1 = intz_ord[1]
            intz_txt += f"; poi «{et1}» ({k1}, {FAM_IT.get(fam1, fam1)})"
        intz_txt += "."

    # DIFETTO 6 — nessuna glossa fisica sulle famiglie: nei dati stessi la stessa
    # parola cade in famiglie diverse (a Hungaroring «raffreddamento» e' configurazione
    # ma «raffreddamento dei freni» e' dichiarato Performance, ed e' un condotto freni,
    # non un'ala scarica). Quel che si scrive e' misurato sul documento, non dedotto.
    intz_fam = Counter()
    for (fam, et), k in A["intenzioni"].items():
        intz_fam[(et, fam)] += k
    a_cavallo = _intenzione_a_cavallo(intz_fam)
    if a_cavallo:
        a, fa, na, b, fb, nb = a_cavallo
        cavallo_txt = (f"in questo documento «{a}» sta nella famiglia "
                       f"{FAM_IT.get(fa, fa)} ({na} {'riga' if na == 1 else 'righe'}) "
                       f"mentre «{b}» sta in {FAM_IT.get(fb, fb)} "
                       f"({nb} {'riga' if nb == 1 else 'righe'}), "
                       f"cioè la stessa parola cade in due famiglie diverse e non esiste "
                       f"una parola chiave che decida da sola se un pezzo è sviluppo o "
                       f"configurazione.")
    else:
        cavallo_txt = ("l'intenzione è quel che la squadra ha scritto in quella riga, "
                       "e la famiglia sta nella stessa cella — nessuna parola chiave "
                       "decide da sola se un pezzo è sviluppo o configurazione.")

    quota_txt = ""
    if quota_max:
        quota_txt = (f" Per confronto, nei {n_gare_ctx} documenti {anno} <b>precedenti</b> "
                     f"(questo weekend non conta nel confronto) la punta è "
                     f"{quota_max['gp']} con il {it(quota_max['quota_circuito'], 0)}% "
                     f"di configurazione.")

    # Le famiglie diverse da sviluppo/configurazione non si nascondono. E NON si
    # chiamano piu' "un motivo che non rientra nelle famiglie della FIA": le famiglie
    # della FIA sono tre e nessuna riga sta fuori da tutte. Quel che succede e' che la
    # CELLA non riporta il prefisso — e quando lo stesso motivo e' scritto per esteso
    # altrove nello stesso documento, la famiglia si riprende da li' e si dichiara.
    altre_famiglie = [(FAM_IT["Reliability"], n_affid),
                      ("famiglia non scritta nella cella", n_altro)]
    presenti = [(etichetta, n) for etichetta, n in altre_famiglie if n]
    if presenti:
        coda_famiglie = (" " + ("Resta" if sum(n for _, n in presenti) == 1 else "Restano")
                         + " " + _lista_it([f"{_pezzi(n)} di {etichetta}"
                                            if etichetta == FAM_IT["Reliability"]
                                            else f"{_pezzi(n)} con la {etichetta}"
                                            for etichetta, n in presenti]) + ".")
        if n_altro:
            coda_famiglie += (" Le famiglie dichiarate dalla FIA restano tre: qui manca "
                              "il prefisso in una cella, non esiste una quarta categoria.")
    else:
        coda_famiglie = ""

    # la riconciliazione, se c'e' stata, si dice dove cambia il numero
    ric_txt = ""
    if riconciliate:
        e = riconciliate[0]
        n_ric = len(riconciliate)
        verso_circ = sum(1 for r in riconciliate if r["famiglia"] == "Circuit specific")
        ric_txt = (f" In {n_ric} {'riga' if n_ric == 1 else 'righe'} la cella del motivo "
                   f"non riportava la famiglia («{e['sottotipo']}» nudo, {e['team']} / "
                   f"{e['componente']}): l'abbiamo ripresa da {e['testimoni']} righe dello "
                   f"<b>stesso</b> documento che scrivono lo stesso motivo per esteso "
                   f"(«{e['famiglia']} – {e['sottotipo']}»)."
                   + (f" Senza questa lettura la configurazione qui sarebbe "
                      f"{n_circuito - verso_circ} invece di {n_circuito}."
                      if verso_circ else ""))

    n_opz = len(A["opzionali"])
    opz_txt = ("nessuna riga usa parole come «available» o «optional»"
               if not n_opz else
               f"<b>{n_opz}</b> righe su {n_comp} dicono a lettere «available» o «optional»")

    # NULL 1 rimisurato su QUESTO documento, non ereditato. La frase dice ESATTAMENTE
    # quel che il conteggio ha cercato: le formule con cui si indica una vettura o un
    # pilota. "Telaio"/"chassis" NON e' fra queste (nel documento e' un nome di
    # componente, cercarlo direbbe il falso), quindi la frase non lo nomina.
    n_vett = len(A["vettura"])
    vett_txt = (f"In questo documento <b>nessuna</b> delle {n_comp} righe usa una delle "
                f"formule con cui si indica una vettura o un pilota («car 1», «both cars», "
                f"«each car», «one car only», «driver 2», «race number»)."
                if not n_vett else
                f"In questo documento {n_vett} righe su {n_comp} nominano una vettura o un "
                f"pilota dentro la descrizione, ma un campo per dirlo non esiste: per tutte le "
                f"altre resta ignoto.")

    # DIFETTO 1 — il conteggio delle righe non e' il conteggio dei pacchetti.
    # Si dice dove il lettore legge la classifica, con l'esempio preso dalla fonte.
    righe_txt = ""
    if A["spacchettano"]:
        chi = max(A["spacchettano"], key=lambda x: x["righe"] - x["blocchi"])
        campioni = sorted(chi["esempi"], key=lambda b: -len(b["righe"]))[:2]
        prove = _lista_it([f"«{_corto(b['descrizione'], 62)}» copre {len(b['righe'])} righe "
                           f"({_lista_it(b['righe'])})" for b in campioni])
        uguali = [s["team"] for s in A["squadre"]
                  if s["n"] > 0 and s["blocchi"] == s["n"]]
        righe_txt = (
            f"<p><b>Una riga non è un aggiornamento.</b> Le squadre compilano lo stesso "
            f"modulo in modi diversi: {chi['team']} spacchetta un singolo aggiornamento su "
            f"più righe, e lo scrive nella descrizione — {prove} — mentre {len(uguali)} "
            f"squadre su {n_con} scrivono una descrizione per riga. Contando come <b>uno</b> "
            f"gli aggiornamenti che condividono la stessa descrizione, le {n_comp} righe del "
            f"documento diventano <b>{A['blocchi']} aggiornamenti distinti</b>, e le "
            f"{chi['righe']} di {chi['team']} diventano <b>{chi['blocchi']}</b>. "
            + (f"Il confronto «{top['n']} contro {secondo['n']}» non è fra grandezze "
               f"omogenee; «{top['blocchi']} contro {secondo['blocchi']}» lo è di più, ma "
               f"resta un conteggio di quel che è stato compilato, non una misura di quanto "
               f"vale."
               if top and secondo else
               "Resta comunque un conteggio di quel che è stato compilato, non una misura "
               "di quanto vale.")
            + "</p>")

    # "16" da solo non si scrive mai piu': righe E aggiornamenti distinti, insieme.
    top_riga = ""
    if top:
        top_riga = (f"{top['n']} righe" if top["blocchi"] == top["n"]
                    else f"{top['n']} righe = {top['blocchi']} aggiornamenti distinti")

    if len(n_null) == 1:
        null_frase = (f"<b>{null_txt}</b> non porta nulla: «No updates submitted for this event»")
    elif n_null:
        null_frase = (f"<b>{null_txt}</b> non portano nulla: «No updates submitted for this event»")
    else:
        null_frase = "nessuna squadra dichiara di presentarsi senza aggiornamenti"

    art = {
        "id": ID, "slug": slug, "stato": "bozza",
        "data": data_bozza or data_pub or datetime.date.today().isoformat(),
        "firma": "Muretto · Redazione tecnica", "accent": accent,
        "canale": "A (anteprima aggiornamenti, documento FIA)",
        "gp": gara_it, "gara": gara_it, "circuito": circuito or gara_it,
        "sessione": "Anteprima", "round": None,
        "tag": ["aggiornamenti", "anteprima", "documento-fia", "tecnica", dove],
        "occhiello": (f"Anteprima aggiornamenti · {gara_it} {anno}"
                      + (f" · documento FIA del {data_pub}" if data_pub else "")),
        "titolo": (f"Cosa aspettarsi dalle novità a {dove}: {n_sviluppo} pezzi di sviluppo "
                   f"e {n_circuito} di configurazione"
                   + ((f", il pacchetto più largo è {top['team']} ({top_riga})"
                       if primato else
                       f", pacchetto più largo a pari merito ({_lista_it(pari_merito)}, "
                       f"{top_riga})") if top else "")),
        "sommario": (
            f"Il venerdì la FIA pubblica l'elenco degli aggiornamenti portati in pista, squadra "
            f"per squadra, prima che una sola macchina giri. A {dove} sono <b>{n_comp} righe</b> "
            f"da <b>{n_con} squadre su {n_squadre}</b>: {n_sviluppo} dichiarate come sviluppo "
            f"(«Performance») e {n_circuito} come configurazione per questo tracciato "
            f"(«Circuit specific»), due cose diverse che non vanno sommate"
            + (f" (le altre {n_affid + n_altro}: "
               f"{_lista_it([f'{n} di ' + e if e == FAM_IT['Reliability'] else f'{n} con la ' + e for e, n in presenti])})"
               if presenti else "") + ". "
            + (f"Il pacchetto più largo è di <b>{top['team']}</b>: {top_riga}"
               + (f" — perché la stessa descrizione copre più righe, mentre le altre "
                  f"squadre ne scrivono una per riga. "
                  if top["blocchi"] < top["n"] else ". ")
               if top else "")
            + f"{null_frase}. "
            f"Attenzione a cosa NON c'è: il documento non dice mai su quale vettura va il pezzo, "
            f"non contiene un solo numero di prestazione, e il conteggio delle righe non è né la "
            f"grandezza dell'aggiornamento né il numero di aggiornamenti."),
        "sezioni": [
            {"tag": "Evidenza",
             "titolo": (f"{n_con} squadre su {n_squadre} portano qualcosa"
                        + ((f", {top['team']} ne dichiara {top['n']}"
                            + (f" ({top['blocchi']} aggiornamenti distinti)"
                               if top['blocchi'] < top['n'] else ""))
                           if top else "")),
             "html": (
                f"<p>Il documento è la <b>Car Presentation Submissions</b>: ogni squadra elenca "
                f"alla FIA i componenti aggiornati che porta a questo Gran Premio, con il motivo "
                f"principale e una descrizione. Esce il venerdì, <b>prima</b> delle libere, ed è "
                f"l'unica fonte ufficiale su cosa è cambiato sulle macchine. A {dove} le righe "
                f"sono <b>{n_comp}</b>, distribuite su <b>{n_con}</b> delle <b>{n_squadre}</b> "
                f"squadre.</p>"
                f"<p>Le righe vanno lette in <b>due conteggi separati</b>: "
                f"<b>{n_sviluppo}</b> pezzi hanno come motivo «Performance», cioè sviluppo che "
                f"resta sulla macchina; <b>{n_circuito}</b> hanno «Circuit specific», cioè "
                f"configurazione per le richieste di questa pista — ala più o meno carica, "
                f"aperture di raffreddamento — che alla gara dopo può tornare indietro. "
                f"Sommarli darebbe un numero senza significato.{coda_famiglie}{ric_txt}</p>"
                + (f"<p>Il pacchetto più largo è di <b>{top['team']}</b>: {top_riga}"
                   + (f" ({top['sviluppo']} di sviluppo, {top['circuito']} di configurazione)"
                      if top['circuito'] else "")
                   + (f", sparse su {len(top['zone'])} zone della vettura" if len(top['zone']) > 1
                      else "")
                   + ". " + ctx_top
                   + (f" Dietro, {secondo['team']} con {secondo['n']} righe"
                      + (f" ({secondo['blocchi']} aggiornamenti distinti)"
                         if secondo["blocchi"] < secondo["n"] else "") + "."
                      if secondo else "")
                   + "</p>" if top else "")
                + righe_txt
                + f"<p>E c'è la notizia opposta, che è una notizia vera perché la fonte la "
                f"<b>dichiara</b> invece di tacere: {null_frase}. Non è un buco nei dati: è una "
                f"squadra che a questo Gran Premio si presenta con la macchina di prima.</p>"),
             "figura": {"svg": fig_a,
                        "didascalia": (
                            f"Ogni squadra ha la riga col suo nome — la barra a destra sono i "
                            f"pezzi dichiarati come sviluppo («Performance») — e, dove ce ne "
                            f"sono, una seconda riga «· circuito» a sinistra con quelli di "
                            f"configurazione («Circuit specific»); l'ordine è quello della "
                            f"barra di sviluppo. Sono righe del documento: una descrizione "
                            f"condivisa può coprirne più d'una. La nota a destra dice in quanti "
                            f"weekend {anno} <b>precedenti</b> quella squadra aveva aggiornato "
                            f"(questo escluso)."
                            + (f" Denominatori diversi dove la fonte non era leggibile: "
                               f"{_lista_it(ctx['incomplete'])}." if ctx["incomplete"] else "")),
                        "fonte": f"FIA · Car Presentation Submissions, {gp_fia} {anno}"
                                 + (f" (pubblicato {data_pub})" if data_pub else "")}},

            {"tag": "Causa",
             "titolo": (f"Dove hanno lavorato: {zona_top.lower()} in testa" if zona_top
                        else "Dove hanno lavorato"),
             "html": (
                f"<p>Ogni riga del documento nomina il componente aggiornato, e i componenti si "
                f"raggruppano in zone della vettura. {zona_txt} Questo dice <b>dove</b> le "
                f"squadre hanno concentrato il lavoro per questo weekend, che è già "
                f"un'informazione: una zona affollata è una zona in cui più squadre pensano ci "
                f"sia ancora qualcosa da prendere, o in cui questa pista chiede una scelta "
                f"diversa dal solito.</p>"
                f"<p>La quota di configurazione dice quanto di questo movimento è "
                f"<b>adattamento al tracciato</b> e non progresso: qui è il "
                f"<b>{it(quota_circ, 0)}%</b> dei pezzi ({n_circuito} su {n_comp}).{quota_txt} "
                f"Più la quota è alta, meno il documento parla di macchine che cambiano e più di "
                f"macchine che si vestono per il circuito.</p>"),
             "figura": {"svg": fig_b,
                        "didascalia": (
                            f"Pezzi per zona della vettura a {dove}. Il colore è quello della "
                            f"squadra che ha messo più pezzi in quella zona. Qui sviluppo e "
                            f"configurazione sono sommati: la separazione sta nella figura "
                            f"precedente."),
                        "fonte": f"FIA · Car Presentation Submissions, {gp_fia} {anno} — "
                                 f"campo «Updated component», zone canoniche della redazione"}},

            {"tag": "Effetto",
             "titolo": "Con che intenzione — e le tre cose che il documento non dice",
             "html": (
                f"<p>Accanto a ogni componente la FIA registra il <b>«Primary reason»</b>: "
                f"l'intenzione dichiarata dalla squadra. {intz_txt} È la parte più utile "
                f"dell'anteprima, perché dice <b>con che intenzione</b> le squadre sono "
                f"arrivate qui. Va letta riga per riga, però: {cavallo_txt} E resta "
                f"un'intenzione — il documento <b>non promette</b> che funzionerà, e non dice "
                f"di quanto.</p>"
                f"<p>Le tre cose che questa fonte non dice, e che nessuno può dedurre dal "
                f"documento:</p>"
                f"<p><b>1. Su quale vettura.</b> Il documento non nomina mai il pilota né il "
                f"numero di macchina: non c'è modo di sapere se il pezzo va su entrambe le "
                f"vetture o su una sola. {vett_txt}<br>"
                f"<b>2. Quanto vale — e quanti sono.</b> Non c'è un solo numero di prestazione. "
                f"Il conteggio delle righe <b>non è</b> la grandezza dell'aggiornamento: una "
                f"riga «Rear Wing» può essere un'ala completamente nuova o un ritocco al bordo "
                f"del flap, e nel documento occupano lo stesso spazio. E non è nemmeno il "
                f"<b>numero</b> di aggiornamenti: più righe possono essere un pacchetto solo "
                f"(qui {n_comp} righe valgono {A['blocchi']} descrizioni distinte), e squadre "
                f"diverse spezzano il pacchetto in modo diverso. "
                + (f"Un pacchetto da {top['n']} righe non vale per forza più di uno da tre."
                   if top else "") + "<br>"
                f"<b>3. Se lo monteranno.</b> A volte il pezzo è portato ma non per forza "
                f"montato: qui {opz_txt}. Il resto lo dirà la pista, non questo foglio.</p>"
                f"<p>Per questo l'anteprima si ferma qui: dice <b>chi</b>, <b>quanti</b>, "
                f"<b>dove</b> e <b>con che intenzione</b>. Se quei pezzi abbiano funzionato è una "
                f"domanda diversa, che si può solo misurare dopo — con i tempi, non con un "
                f"elenco.</p>"),
             "figura": {"svg": fig_c,
                        "didascalia": (
                            "Il «Primary reason» dichiarato dalle squadre, tradotto e contato "
                            "riga per riga. In pieno le intenzioni della famiglia sviluppo"
                            + (f", in trasparenza quelle delle altre famiglie presenti in "
                               f"questo documento ({altre_fam})" if altre_fam else "")
                            + ". È una dichiarazione d'intenti, non una misura di effetto."),
                        "fonte": f"FIA · Car Presentation Submissions, {gp_fia} {anno} — "
                                 f"campo «Primary reason»"}},
        ],
        "provenienza": [
            {"grandezza": "pezzi dichiarati alla FIA",
             "valore": f"{n_comp} righe da {n_con} squadre su {n_squadre}",
             "stato": "MISURATO",
             "da": f"documento FIA «Car Presentation Submissions» {gp_fia} {anno}"
                   f"{' — ' + doc['slug'] if doc['slug'] else ''}; lettura e cancelli di "
                   f"identità/qualità in ai_lab/redazione/fia_cp.py"},
            {"grandezza": "sviluppo vs configurazione da circuito",
             "valore": (f"{n_sviluppo} «Performance» · {n_circuito} «Circuit specific» "
                        f"({it(quota_circ, 0)}% del totale)"
                        + (f" · {n_affid} affidabilità" if n_affid else "")
                        + (f" · {n_altro} con la famiglia non scritta nella cella"
                           if n_altro else "")),
             "stato": "MISURATO",
             "da": ("campo «Primary reason», famiglie dichiarate dalla FIA — tenute separate: "
                    "la configurazione è assetto per questo tracciato, non progresso. Le "
                    "famiglie della FIA sono TRE: una cella senza prefisso non è una quarta "
                    "famiglia"
                    + (f"; {len(riconciliate)} "
                       f"{'riga riassegnata' if len(riconciliate) == 1 else 'righe riassegnate'}"
                       f" dallo stesso documento "
                       f"(" + "; ".join(f"{r['team']}/{r['componente']}: «{r['sottotipo']}» "
                                        f"→ {r['famiglia']}, {r['testimoni']} righe testimoni"
                                        for r in riconciliate) + ")"
                       if riconciliate else ""))},
            {"grandezza": "pacchetto più largo",
             "valore": ((f"{top['team']}, {top['n']} righe = {top['blocchi']} aggiornamenti "
                         f"distinti ({top['sviluppo']} sviluppo, {top['circuito']} "
                         f"configurazione)") if top else "nessuno"),
             "stato": "MISURATO",
             "da": ("righe della sua tabella, e aggiornamenti distinti = righe con la STESSA "
                    "descrizione contate una volta (la fonte scrive «are a package»). Non è "
                    "una misura di grandezza (vedi sotto): squadre diverse spezzano lo stesso "
                    "pacchetto in un numero diverso di righe"
                    + ("; primato stretto sugli aggiornamenti distinti"
                       if primato else f"; pari merito con {_lista_it(pari_merito)}"))},
            {"grandezza": "righe contro aggiornamenti distinti",
             "valore": (f"{n_comp} righe = {A['blocchi']} descrizioni distinte; "
                        + (", ".join(f"{x['team']} {x['righe']}→{x['blocchi']}"
                                     for x in A["spacchettano"])
                           or "nessuna squadra spacchetta")),
             "stato": "MISURATO",
             "da": "conteggio delle descrizioni identiche dentro la stessa squadra; non "
                   "cattura i pacchetti che la fonte NON dichiara tali, quindi è un limite "
                   "inferiore allo spacchettamento, mai una stima di valore"},
            {"grandezza": "squadre senza aggiornamenti",
             "valore": (null_txt + " («No updates submitted for this event»)") if n_null
                       else "nessuna",
             "stato": "MISURATO",
             "da": "NULL dichiarato dalla fonte, distinto dal parsing fallito: è una notizia, "
                   "non un dato mancante"},
            {"grandezza": "frequenza di aggiornamento in stagione",
             "valore": (", ".join(
                 f"{n} {ctx_squadre[n]['con']}/{ctx_squadre[n]['letti']}"
                 for n in sorted(ctx_squadre,
                                 key=lambda x: -ctx_squadre[x]['con'])) or "non disponibile"),
             "stato": "MISURATO",
             "da": f"{n_gare_ctx} documenti FIA {anno} PRECEDENTI, riletti con lo stesso "
                   f"estrattore — il documento di {gp_fia} è ESCLUSO dal contesto: contarlo "
                   f"significherebbe confermare col weekend che l'articolo commenta"
                   + (f"; denominatore più basso dove la fonte non era leggibile: "
                      f"{_lista_it(ctx['incomplete'])} — perciò i tassi non stanno tutti "
                      f"sulla stessa base, e ogni primato è verificato sul caso più "
                      f"sfavorevole (denominatore comune {n_gare_ctx})"
                      if ctx["incomplete"] else "")},
            {"grandezza": "zona più toccata",
             "valore": (f"{zona_top} — {zona_top_n} pezzi su {n_comp}" if zona_top
                        else "non determinata"),
             "stato": "MISURATO",
             "da": "campo «Updated component» mappato sulle 15 zone canoniche; i componenti "
                   "fuori tabella restano dichiarati in diagnostica, mai indovinati"},
            {"grandezza": "intenzione dichiarata più frequente",
             "valore": (f"«{intz_top[0][1]}» — {intz_top[1]} pezzi" if intz_top else "nessuna"),
             "stato": "MISURATO",
             "da": "campo «Primary reason»: è quel che la squadra DICHIARA di cercare, non un "
                   "effetto osservato"
                   + (f"; {A['composti']} motivi composti contati sulla prima intenzione"
                      if A["composti"] else "")},
            {"grandezza": "su quale vettura / pilota va il pezzo",
             "valore": (f"nessuna delle {n_comp} righe lo nomina" if not n_vett
                        else f"solo {n_vett} righe su {n_comp} lo accennano nella descrizione"),
             "stato": "NON_MISURABILE",
             "da": "cercate in questo documento le formule «car N», «both cars», «each car», "
                   "«one car only», «driver N», «race number»: la fonte non ha un campo per "
                   "dirlo, quindi una macchina sola o entrambe è indistinguibile. NON sono "
                   "cercati «chassis»/telaio né «driver» da soli: nel documento compaiono "
                   "come nomi di componente, quindi il conteggio non copre quella parola"},
            {"grandezza": "grandezza dell'aggiornamento (quanto vale)",
             "valore": "nessun numero di prestazione nel documento",
             "stato": "NON_MISURABILE",
             "da": "il conteggio delle righe non è la magnitudine: una riga può essere un pezzo "
                   "nuovo o un ritocco, e occupano lo stesso spazio. Non è nemmeno il numero "
                   "di aggiornamenti: vedi «righe contro aggiornamenti distinti»"},
            {"grandezza": "se il pezzo verrà davvero montato",
             "valore": (f"{n_opz} righe su {n_comp} lo dichiarano «available»/«optional»"
                        if n_opz else "nessuna riga lo dichiara opzionale"),
             "stato": "NON_MISURABILE",
             "da": "un componente «portato» può restare nel camion: il documento non registra "
                   "cosa finisce sulla macchina"},
        ],
        "fonti": [
            {"tipo": "dati",
             "testo": (f"FIA — «Car Presentation Submissions», {gp_fia} {anno}"
                       + (f", pubblicato {data_pub}" if data_pub else "")
                       + (f" · {doc['slug']}" if doc["slug"] else "")
                       + (f" · {doc['url']}" if doc["url"] else "")
                       + f" · fonte {doc['origine']}")},
            {"tipo": "metodo",
             "testo": ("ai_lab/redazione/genera_upgrade_preview.py + fia_cp.py — scoperta dalla "
                       "sola pagina radice FIA, cancelli di freschezza (≤"
                       f"{FRESCHEZZA_GIORNI} giorni), identità (anno + nome gara sulla "
                       "copertina) e qualità (tutte le squadre presenti, numerazione contigua, "
                       "nessuna tabella non letta). Conteggi separati per famiglia di motivo: "
                       "«Performance» (sviluppo) e «Circuit specific» (configurazione) non "
                       "vengono mai sommati; una cella senza prefisso di famiglia viene "
                       "riconciliata solo dallo stesso documento, mai indovinata. Le righe "
                       "con descrizione identica dentro la stessa squadra contano come UN "
                       "aggiornamento dichiarato, perché lo stile di compilazione cambia da "
                       f"squadra a squadra. Contesto stagionale riletto dai {n_gare_ctx} "
                       f"documenti FIA {anno} PRECEDENTI, questo weekend escluso.")},
        ],
    }
    return F, art


META = {
    "id": ID, "canale": "A",
    "titolo": "Anteprima aggiornamenti (documento FIA del venerdì)",
    "tag": ["aggiornamenti", "anteprima", "documento-fia"],
    "descrizione": "chi porta aggiornamenti a questo GP, quanti pezzi, in che zona e con che "
                   "intenzione dichiarata; sviluppo e configurazione da circuito separati, "
                   "e i tre NULL della fonte dichiarati",
    "richiede": "documento FIA",
    "sessioni": ["FIA"], "gare": ["*"],
}


def genera(gara=None, data=None, sessione=None):
    """Mai un'eccezione fuori di qui: se non è applicabile ritorna None.

    Se chi ci ha innescati ha gia' scoperto, scaricato e passato ai cancelli un
    documento (auto_articoli._passo_fia lo fa, e lo dichiara in MURETTO_FIA_PDF /
    MURETTO_FIA_GP / MURETTO_FIA_ANNO), si legge ESATTAMENTE quel file. Prima si
    ripartiva dalla pagina radice per conto proprio: una seconda richiesta di rete,
    e soprattutto nessuna garanzia di stare leggendo lo stesso documento che aveva
    passato i cancelli — se la FIA riemette fra i due giri, l'articolo esce da un
    file che nessuno ha controllato. I cancelli di identita' e qualita' si rifanno
    comunque qui dentro: fidarsi del chiamante e non ricontrollare sarebbe l'altro
    modo di sbagliare.
    """
    pdf = os.environ.get("MURETTO_FIA_PDF") or None
    if pdf and not os.path.exists(pdf):
        pdf = None
    anno = 2026
    try:
        anno = int(os.environ.get("MURETTO_FIA_ANNO") or anno)
    except ValueError:
        pass
    try:
        r = costruisci(anno, gara=gara, pdf=pdf, data_bozza=data,
                       pubblicato_iso=os.environ.get("MURETTO_FIA_PUBBLICATO") or None)
    except Exception:
        if os.environ.get("REDAZIONE_DEBUG"):
            raise
        return None
    if not r:
        return None
    F, art = r
    bid = f"{ID}-{art['slug']}-{F['anno']}"
    art["id"] = bid       # id track-specifico: un'anteprima non sovrascrive l'altra
    base.scrivi_bozza(bid, art, F)
    return {"id": bid, "titolo": art["titolo"], "stato": art["stato"], "canale": "A"}


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(
        description="Anteprima aggiornamenti dal documento FIA del venerdì")
    ap.add_argument("--anno", type=int, default=2026)
    ap.add_argument("--gara", default=None,
                    help="nome italiano (es. Ungheria): usato come filtro solo se il nome FIA "
                         "è accertato")
    ap.add_argument("--pdf", default=None, help="documento locale (collaudo offline)")
    ap.add_argument("--cache", default=None,
                    help="cartella con i documenti FIA per il contesto stagionale")
    ap.add_argument("--data", default=None, help="AAAA-MM-GG per la targhetta della bozza")
    ap.add_argument("--json", action="store_true", help="stampa i fatti in JSON")
    a = ap.parse_args()

    r = costruisci(a.anno, gara=a.gara, pdf=a.pdf, data_bozza=a.data,
                   cartella_contesto=a.cache, verbose=True)
    if not r:
        print("nessun articolo: documento assente o cancello chiuso")
        sys.exit(1)
    F, art = r
    if a.json:
        print(json.dumps(F, ensure_ascii=False, indent=2))
        sys.exit(0)
    bid = f"{ID}-{art['slug']}-{F['anno']}"
    art["id"] = bid
    out = base.scrivi_bozza(bid, art, F)
    T = F["totali"]
    print(f"Bozza {bid} scritta in {out}")
    print(f"  TITOLO   {art['titolo']}")
    print(f"  gara     {F['gara']} ({F['gp_fia']}) {F['anno']} — {F['circuito'] or '—'}")
    print(f"  fonte    {F['documento']['slug']} · pubblicato {F['documento']['pubblicato']} "
          f"· {F['documento']['origine']}")
    print(f"  righe    {T['componenti']} da {T['squadre_con_aggiornamenti']}/"
          f"{T['squadre_lette']} squadre — sviluppo {T['sviluppo']}, configurazione "
          f"{T['circuit_specific']} ({it(T['quota_configurazione_pct'],0)}%), "
          f"affidabilità {T['affidabilita']}, famiglia non scritta in cella "
          f"{T['famiglia_non_scritta_in_cella']}")
    R = F["righe_vs_aggiornamenti"]
    print(f"  aggiorn. {R['righe']} righe = {R['aggiornamenti']} aggiornamenti distinti"
          + ("; spacchettano: " + ", ".join(f"{x['team']} {x['righe']}→{x['blocchi']}"
                                            for x in R["squadre_che_spacchettano"])
             if R["squadre_che_spacchettano"] else "; nessuna squadra spacchetta"))
    if F["famiglia_riconciliata"]:
        for r in F["famiglia_riconciliata"]:
            print(f"  riconc.  {r['team']}/{r['componente']}: «{r['motivo_cella']}» → "
                  f"{r['famiglia_assegnata']} ({r['righe_testimoni_nello_stesso_documento']} "
                  f"righe testimoni nello stesso documento)")
    if F["pacchetto_piu_grande"]:
        p = F["pacchetto_piu_grande"]
        print(f"  piu' big {p['team']} {p['n']} righe = {p['aggiornamenti_distinti']} "
              f"aggiornamenti ({p['sviluppo']} sviluppo / {p['circuito']} circuito) — "
              f"primato stretto: {p['primato_stretto']} — zone {p['zone']}")
    print(f"  NULL     senza aggiornamenti: {T['squadre_senza_nulla'] or 'nessuna'}")
    print(f"  zone     {[(z['zona'], z['n']) for z in F['zone'][:5]]}")
    print(f"  intenz.  {[(i['intenzione'], i['famiglia'], i['n']) for i in F['intenzioni'][:5]]}")
    freq = ", ".join(f"{k} {v['con']}/{v['letti']}"
                     for k, v in F["contesto_stagione"]["squadre"].items())
    print(f"  stagione {F['contesto_stagione']['gare_lette']} documenti PRECEDENTI "
          f"(escluso {F['contesto_stagione']['gara_esclusa']}) · {freq}")
    print(f"  opzion.  {F['null_fonte']['montato_o_solo_disponibile']['righe_che_lo_dicono']} "
          f"righe «available/optional»")
    print(f"  scrittura prosa: {art.get('scrittura','template')}")
