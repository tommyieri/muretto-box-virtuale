"""
stile.py — il CORRETTORE della redazione. Nessun LLM, solo aritmetica.

E' il terzo mestiere della redazione (dopo chi pianifica e chi scrive) e l'unico
che non discute: legge un articolo e restituisce un elenco di violazioni, ciascuna
con la regola di VOCE.md che infrange, il pezzo di testo incriminato e il perche'.

PERCHE' NON E' UN LLM. Tutto quello che sta qui dentro e' contabile: contare le
parole di una frase, accorgersi che una frase e' stampata due volte, vedere che c'e'
uno spazio prima di una virgola, verificare che un numero della prosa esista nei
fatti. Un modello linguistico fa queste cose peggio, piu' lentamente, in modo non
riproducibile e a pagamento. Il giudizio (la tesi regge? l'attacco funziona?) resta
altrove: qui si misura, non si valuta.

DUE LIVELLI, MAI UN PUNTEGGIO UNICO.
  - CANCELLO: le regole bloccanti. Binario, passa/non passa.
  - PROFILO: gli indicatori (ritmo, Gulpease, densita' numerica, MTLD...). Si
    guardano accanto al pezzo, non si sommano. Un `punteggio = 0,3*gulpease +
    0,2*CV + ...` e' esattamente la metrica che si ottimizza peggiorando il testo.

LE SOGLIE non sono scelte a occhio: vengono dai percentili misurati sulle 18 bozze
esistenti e stanno dichiarate in voce/lessico.json, non qui. Cambiarle e' un atto
editoriale, si fa la' con la ragione nel commit.

COSA SI MISURA. Solo la PROSA: il testo dentro <p> delle sezioni piu' il sommario.
Restano fuori didascalie, tabella di provenienza, fonti, SVG. Misurare il resto
produce artefatti (una tabella senza punteggiatura diventa una "frase" da 452
parole, e il ritmo dell'articolo risulta perfetto).

Uso:
  python3 ai_lab/redazione/stile.py --tutti          # tutti gli articoli pubblicati
  python3 ai_lab/redazione/stile.py --id <id>        # una bozza o un pubblicato
  python3 ai_lab/redazione/stile.py --testo file.txt # un testo qualsiasi
  python3 ai_lab/redazione/stile.py --profilo        # solo il profilo, senza cancello
"""
from __future__ import annotations
import os
import re
import json
import math
import html as _html
import unicodedata
from collections import Counter

_QUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(_QUI, "..", ".."))
VOCE = os.path.join(_QUI, "voce")
LESSICO = os.path.join(VOCE, "lessico.json")

BLOCCANTE = "bloccante"
AVVISO = "avviso"


# ---------------------------------------------------------------- lessico ----

_cache_lessico = None


def lessico():
    """Le liste controllabili, da voce/lessico.json. Una definizione, un posto."""
    global _cache_lessico
    if _cache_lessico is None:
        with open(LESSICO, encoding="utf-8") as f:
            _cache_lessico = json.load(f)
    return _cache_lessico


def soglia(nome):
    return lessico()["soglie"][nome]


# ------------------------------------------------------------ tokenizzazione ----

# numeri (anche 1:24,507 e 12.345,6) oppure parole (con apostrofo interno)
_RE_PAROLA = re.compile(r"[0-9]+(?:[.:,][0-9]+)*|[^\W\d_]+(?:['’][^\W\d_]+)*", re.UNICODE)
_RE_TAG = re.compile(r"<[^>]+>")


def piano(testo_html):
    """HTML -> testo piano, con i paragrafi separati.

    Due dettagli che sembrano pedanteria e non lo sono:

    · L'ORDINE. Prima si traducono i </p> in interruzioni, POI si tolgono i tag.
      Al contrario (bug storico di base._md) i paragrafi si fondono e nascono 41
      false 'frasi fuse'.

    · I TAG IN LINEA SPARISCONO, non diventano uno spazio. `<b>1:17,207</b>,` e'
      tipografia corretta; sostituire `</b>` con uno spazio produce `1:17,207 ,` e
      il correttore accusa la prosa di un difetto che ha creato lui. E' successo:
      la prima misura sul corpus dava «spazio prima della punteggiatura» in 9
      articoli su 12, ed erano tutti artefatti di questa riga. Un messaggio
      d'errore che afferma qualcosa sul mondo invece che su se' stesso e' un bug
      di verita'."""
    t = (testo_html or "").replace("</p>", "\n\n").replace("<br>", "\n").replace("<br/>", "\n")
    t = _RE_TAG.sub("", t)
    t = _html.unescape(t)
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def parole(t):
    return _RE_PAROLA.findall(t or "")


def frasi(t):
    """Spezza in frasi proteggendo i decimali e i tempi sul giro (1:24,507)."""
    t = re.sub(r"\s+", " ", t or "").strip()
    if not t:
        return []
    # i punti dentro un numero non chiudono la frase
    t = re.sub(r"(\d)\.(\d)", r"\1․\2", t)
    pezzi = re.split(r"(?<=[.!?…])[\"»'\)\]]*\s+", t)
    return [p.replace("․", ".").strip() for p in pezzi if re.search(r"\w", p)]


def paragrafi(t):
    return [p.strip() for p in re.split(r"\n\s*\n", t or "") if p.strip()]


def _norm(s):
    """minuscolo, senza accenti, senza punteggiatura: per i confronti lessicali."""
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9\s]", " ", s)


def token_norm(t):
    return [w for w in _norm(t).split() if w]


# --------------------------------------------------------------- indicatori ----

def gulpease(t):
    """Indice Gulpease (Lucisano-Piemontese 1988): 89 + (300*frasi - 10*lettere)/parole.
    LETTERE = alfanumerici, senza spazi NE' punteggiatura. textstat sbaglia proprio
    qui (conta la punteggiatura) e su questo corpus si perde fino a 3,5 punti su
    un'escursione totale di 10: la formula sta scritta a mano apposta."""
    P, F = len(parole(t)), len(frasi(t))
    if not P:
        return None
    L = sum(1 for c in t if c.isalnum())
    return 89 + (300 * F - 10 * L) / P


def ritmo(t):
    L = [len(parole(f)) for f in frasi(t)]
    if len(L) < 2:
        return None
    mu = sum(L) / len(L)
    sd = math.sqrt(sum((x - mu) ** 2 for x in L) / (len(L) - 1))
    corta = soglia("frase_corta_parole")
    return {
        "frasi": len(L), "media": round(mu, 1), "sd": round(sd, 1),
        "cv": round(sd / mu, 3) if mu else 0.0,
        "max": max(L), "min": min(L),
        "pct_corte": round(100 * sum(1 for x in L if x < corta) / len(L), 1),
        "pct_lunghe": round(100 * sum(1 for x in L if x > 35) / len(L), 1),
    }


def mtld(t, s=0.720):
    """Diversita' lessicale (McCarthy-Jarvis): l'unico indice che non dipende dalla
    lunghezza del testo. Sotto le 50 parole non ha senso e ritorna None."""
    w = token_norm(t)
    if len(w) < 50:
        return None

    def passo(seq):
        fatt, tipi, tok = 0.0, set(), 0
        for x in seq:
            tok += 1
            tipi.add(x)
            if len(tipi) / tok <= s:
                fatt += 1
                tipi, tok = set(), 0
        if tok:
            r = len(tipi) / tok
            fatt += (1 - r) / (1 - s) if r != 1 else 0
        return len(seq) / fatt if fatt else None

    a, b = passo(w), passo(w[::-1])
    return round((a + b) / 2, 1) if a and b else (a or b)


def ngrammi(t, n=None, minimo=2):
    n = n or soglia("ngramma_len")
    w = token_norm(t)
    g = Counter(tuple(w[i:i + n]) for i in range(len(w) - n + 1))
    return [(" ".join(k), v) for k, v in g.items() if v >= minimo]


def ripetizioni_massimali(t, n=None):
    """Le sequenze ripetute PIU' LUNGHE, non tutti i loro pezzi.

    Un periodo di 24 parole stampato due volte genera 20 n-grammi ripetuti: venti
    righe di rapporto per un difetto solo. Qui gli n-grammi che si sovrappongono
    vengono fusi nel tratto massimale, e il difetto torna a essere uno."""
    n = n or soglia("ngramma_len")
    w = token_norm(t)
    if len(w) < n:
        return []
    g = Counter(tuple(w[i:i + n]) for i in range(len(w) - n + 1))
    rip = {k for k, v in g.items() if v >= 2}
    fuori, i = [], 0
    while i <= len(w) - n:
        if tuple(w[i:i + n]) not in rip:
            i += 1
            continue
        j = i
        while j + 1 <= len(w) - n and tuple(w[j + 1:j + 1 + n]) in rip:
            j += 1
        span = " ".join(w[i:j + n])
        fuori.append(span)
        i = j + 1
    # ogni tratto una volta sola, con quante volte compare davvero
    piatto = " ".join(w)
    visti, out = set(), []
    for s in fuori:
        if s in visti:
            continue
        visti.add(s)
        # un tratto contenuto in un altro gia' segnalato non si ripete
        if any(s != a and s in a for a in visti if a != s):
            continue
        out.append((s, piatto.count(s)))
    return out


# ------------------------------------------------------------------ numeri ----

_RE_NUM_PROSA = re.compile(r"\d{1,2}:\d{2}[.,]\d{1,3}|\d+(?:\.\d{3})*(?:,\d+)?|\d+(?:\.\d+)?")


def _val_prosa(s):
    """Numero come lo scrive un italiano -> float. '10.191' = diecimilacentonovantuno,
    '0,247' = zerovirgoladuecentoquarantasette, '1:24,507' = 84,507 s."""
    s = s.strip()
    m = re.fullmatch(r"(\d{1,2}):(\d{2})[.,](\d{1,3})", s)
    if m:
        return int(m.group(1)) * 60 + int(m.group(2)) + int(m.group(3)) / 10 ** len(m.group(3))
    if re.fullmatch(r"\d+(?:\.\d{3})+(?:,\d+)?", s):        # 10.191  /  10.191,5
        s = s.replace(".", "")
    s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def _decimali(s):
    m = re.search(r"[.,](\d+)$", s)
    return len(m.group(1)) if m else 0


def numeri_fatti(*oggetti):
    """Tutti i valori numerici presenti nei fatti/provenienza, come float. Il JSON
    usa il punto decimale, la prosa la virgola: la conversione avviene QUI, ed e' il
    motivo per cui la guardia storica rifiutava prose legittime (nei fatti 'rpm':
    10191.0, in pagina '10.191 giri/min': nessuna corrispondenza testuale)."""
    fuori = set()

    def scava(x):
        if isinstance(x, bool):
            return
        if isinstance(x, (int, float)):
            fuori.add(float(x))
        elif isinstance(x, str):
            # una stringa nei fatti puo' essere gia' formattata all'italiana
            # ("1:17,207", "10.191"): si leggono ENTRAMBE le convenzioni, perche'
            # la guardia deve smascherare i numeri inventati, non la punteggiatura.
            for m in _RE_NUM_PROSA.finditer(x):
                v = _val_prosa(m.group(0))
                if v is not None:
                    fuori.add(v)
            for m in re.finditer(r"-?\d+(?:\.\d+)?", x):
                try:
                    fuori.add(float(m.group(0)))
                except ValueError:
                    pass
        elif isinstance(x, dict):
            for v in x.values():
                scava(v)
        elif isinstance(x, (list, tuple)):
            for v in x:
                scava(v)

    for o in oggetti:
        scava(o)
    return fuori


def numeri_non_tracciabili(testo, ammessi):
    """I numeri della prosa che non si spiegano coi fatti.

    Un numero passa se: e' uguale a un fatto; e' un fatto arrotondato alla
    precisione con cui e' scritto; e' un anno; e' un intero piccolo (posizioni,
    curve, giri, conteggi: 'tutti e 6 i giri lanciati'); oppure e' la differenza,
    la somma o il rapporto percentuale di due fatti — cioe' un DERIVATO legittimo,
    che la guardia storica non ammetteva e che la prosa produce di continuo.

    Ritorna [(testo_del_numero, valore)] dei soli non spiegati."""
    amm = sorted(ammessi)
    ammset = set(round(a, 9) for a in amm)
    fuori = []
    for m in _RE_NUM_PROSA.finditer(testo or ""):
        s = m.group(0)
        v = _val_prosa(s)
        if v is None:
            continue
        d = _decimali(s)
        if round(v, 9) in ammset:
            continue
        if any(abs(round(a, d) - v) < 10 ** -(d + 6) for a in amm):     # arrotondamento
            continue
        if v == int(v):
            n = int(v)
            if 1900 <= n <= 2100:                                       # anno
                continue
            if 0 <= n <= 30:                                            # conteggio/posizione/curva
                continue
        if _derivabile(v, amm, d):
            continue
        fuori.append((s, v))
    return fuori


def _derivabile(v, amm, d):
    """v e' una differenza, una somma o una percentuale di due fatti?"""
    tol = 10 ** -(d + 6) if d else 0.5001
    for i, a in enumerate(amm):
        for b in amm[i:]:
            if abs(round(abs(a - b), d) - v) <= tol:
                return True
            if abs(round(a + b, d) - v) <= tol:
                return True
            if b and abs(round(100.0 * a / b, d) - v) <= tol:
                return True
            if a and abs(round(100.0 * b / a, d) - v) <= tol:
                return True
    return False


# --------------------------------------------------------------- violazioni ----

def _v(regola, gravita, messaggio, estratto="", dove=""):
    return {"regola": regola, "gravita": gravita, "messaggio": messaggio,
            "estratto": (estratto or "")[:180], "dove": dove}


def _re_lista(espressioni):
    """Una sola regex dalle espressioni del lessico, insensibile ad accenti e case."""
    pezzi = []
    for e in espressioni:
        base = re.escape(_norm(e)).replace(r"\ ", r"\s+")
        pezzi.append(base)
    return re.compile(r"\b(" + "|".join(pezzi) + r")\b")


# ------------------------------------------------------------------ estrai ----

def prosa_articolo(articolo):
    """(testo_intero, [(tag_sezione, testo)]) — solo prosa, senza didascalie."""
    sez = []
    for s in articolo.get("sezioni", []) or []:
        sez.append((s.get("tag") or s.get("titolo") or "?", piano(s.get("html"))))
    somm = piano(articolo.get("sommario"))
    tutto = "\n\n".join([somm] + [t for _, t in sez])
    return tutto, sez, somm


# ---------------------------------------------------------------- controlla ----

def controlla(articolo, facts=None, memoria=None):
    """Il controllo completo. Ritorna
       {"ok": bool, "violazioni": [...], "profilo": {...}}
    'ok' e' vero se non c'e' nessuna violazione BLOCCANTE. `memoria` (opzionale)
    e' l'oggetto di memoria.py: senza, i controlli fra-articoli si saltano."""
    L = lessico()
    testo, sezioni, sommario = prosa_articolo(articolo)
    corpo = "\n\n".join(t for _, t in sezioni)
    vs = []
    tutte_frasi = frasi(corpo)
    n_parole = len(parole(corpo))

    # --- 1. verita' dei numeri (L1) -----------------------------------------
    if facts is not None:
        amm = numeri_fatti(facts, articolo.get("provenienza"), articolo.get("fonti"))
        for tag, t in sezioni:
            for s, v in numeri_non_tracciabili(t, amm):
                vs.append(_v("L1", BLOCCANTE,
                             f"il numero {s} non e' nei fatti ne' derivabile da essi",
                             _contesto(t, s), tag))

    # --- 2. lessico vietato 2026 (L4) ---------------------------------------
    piano_norm = _norm(corpo)
    for reg in L["vietati_2026"]["termini"]:
        if re.search(reg["re"], corpo, re.I):
            m = re.search(reg["re"], corpo, re.I)
            vs.append(_v("L4", BLOCCANTE, reg["msg"], _contesto(corpo, m.group(0))))

    for reg in L["falsi_amici"]["coppie"]:
        m = re.search(reg["re"], corpo, re.I)
        if m:
            vs.append(_v("X2", AVVISO, reg["msg"], _contesto(corpo, m.group(0))))

    # --- 3. formule da testo generato (cap. 10) -----------------------------
    re_ia = _re_lista(L["formule_ia"]["espressioni"])
    for m in re_ia.finditer(piano_norm):
        vs.append(_v("D-IA", BLOCCANTE, f"formula da testo generato: «{m.group(1)}»",
                     _contesto_norm(corpo, m.start())))
    re_cli = _re_lista(L["cliche_f1"]["espressioni"])
    for m in re_cli.finditer(piano_norm):
        vs.append(_v("X3", BLOCCANTE, f"cliche' della stampa di settore: «{m.group(1)}»",
                     _contesto_norm(corpo, m.start())))

    # --- 4. tipografia ------------------------------------------------------
    vs += _tipografia(corpo)

    # --- 5. ripetizioni -----------------------------------------------------
    vs += _ripetizioni(corpo, sommario, memoria)

    # --- 6. ritmo e frase ---------------------------------------------------
    vs += _frasi_e_ritmo(tutte_frasi, sezioni)

    # --- 7. densita' numerica (N1, N2) --------------------------------------
    vs += _numeri_in_prosa(tutte_frasi, n_parole)

    # --- 8. attacco e chiusa (A, C) -----------------------------------------
    vs += _attacco(sezioni, memoria)
    vs += _chiusa(sezioni)

    # --- 9. struttura (F) ---------------------------------------------------
    vs += _struttura(articolo, sezioni, n_parole)

    # --- 10. tic sintattici -------------------------------------------------
    vs += _tic(corpo, tutte_frasi, piano_norm)

    profilo = {
        "parole": n_parole,
        "sezioni": len(sezioni),
        "gulpease": round(gulpease(corpo), 1) if gulpease(corpo) else None,
        "ritmo": ritmo(corpo),
        "mtld": mtld(corpo),
        "numeri_100": round(100 * len(_RE_NUM_PROSA.findall(corpo)) / max(1, n_parole), 1),
        "emdash": corpo.count("—"),
        "bloccanti": sum(1 for x in vs if x["gravita"] == BLOCCANTE),
        "avvisi": sum(1 for x in vs if x["gravita"] == AVVISO),
    }
    return {"ok": profilo["bloccanti"] == 0, "violazioni": vs, "profilo": profilo}


def _contesto(t, ago, largo=60):
    i = t.find(ago)
    if i < 0:
        return ago
    return ("…" if i > largo else "") + t[max(0, i - largo):i + len(ago) + largo].strip() + "…"


def _contesto_norm(t, pos_norm, largo=60):
    """Il testo normalizzato ha la stessa lunghezza dell'originale (le sostituzioni
    sono 1:1), quindi la posizione e' valida anche sull'originale."""
    return t[max(0, pos_norm - largo):pos_norm + largo].strip()


# ------------------------------------------------------------- sotto-regole ----

def _tipografia(t):
    vs = []
    regole = [
        ("N13", BLOCCANTE, r"[a-zà-ÿ0-9]\.[A-ZÀ-Ù]", "manca lo spazio dopo il punto (paragrafi fusi)"),
        ("N13", BLOCCANTE, r"\s+[,;:.!?](?:\s|$)", "spazio prima della punteggiatura"),
        ("N13", BLOCCANTE, r"\(\s+|\s+\)", "spazio dentro le parentesi"),
        ("N13", BLOCCANTE, r"(?<![\d:])\d+\.\d(?!\d\d)", "punto decimale: in italiano si usa la virgola"),
        ("N13", BLOCCANTE, r"[▲▼●■◆★]", "simbolo di legenda nella prosa: quello vive nel grafico"),
        ("N13", AVVISO, r"\.\.\.", "puntini di sospensione: usare il carattere …"),
        ("X1", AVVISO, r"\b\d+(km/h|kg|s|m|%)\b", "manca lo spazio fra numero e unita'"),
    ]
    for reg, grav, rx, msg in regole:
        for m in re.finditer(rx, t):
            vs.append(_v(reg, grav, msg, _contesto(t, m.group(0))))
            break                                     # una segnalazione per regola basta
    n_em = t.count("—")
    if n_em > soglia("emdash_per_articolo"):
        vs.append(_v("R3", BLOCCANTE,
                     f"{n_em} trattini lunghi: il massimo e' {soglia('emdash_per_articolo')}"))
    for f in frasi(t):
        if f.count("—") >= 2:
            vs.append(_v("R3", BLOCCANTE, "due trattini lunghi nella stessa frase", f))
            break
    if "'" in t and "’" in t:
        vs.append(_v("N13", BLOCCANTE, "apostrofi dritti e tipografici mescolati nello stesso testo"))
    if "«" in t and ('"' in t or "“" in t):
        vs.append(_v("N13", BLOCCANTE, "caporali e virgolette inglesi nello stesso testo"))
    return vs


def _ripetizioni(corpo, sommario, memoria):
    vs = []
    # frase identica due volte
    viste = {}
    for f in frasi(corpo):
        if len(parole(f)) < 7:
            continue
        k = " ".join(token_norm(f))
        if k in viste:
            vs.append(_v("11.3", BLOCCANTE, "la stessa frase compare due volte nell'articolo", f))
        viste[k] = True
    # tratti ripetuti dentro l'articolo (massimali: un difetto, una riga)
    tecn = set(token_norm(" ".join(lessico()["anglicismi"]["prestiti_ammessi"])))
    for g, n in ripetizioni_massimali(corpo):
        if set(g.split()) <= tecn:
            continue
        breve = g if len(g) < 110 else g[:100] + "…"
        vs.append(_v("11.3", BLOCCANTE, f"tratto ripetuto {n} volte: «{breve}»"))
    # sommario che riassume il corpo invece di promettere
    bs = set(_bigrammi(sommario))
    bc = set(_bigrammi(corpo))
    if bs:
        sov = len(bs & bc) / len(bs)
        if sov > soglia("sovrapposizione_sommario_max"):
            vs.append(_v("F4", AVVISO,
                         f"il sommario ripete il corpo al {sov:.0%} "
                         f"(massimo {soglia('sovrapposizione_sommario_max'):.0%}): "
                         f"il sommario promette, non riassume"))
    # gruppi di parole gia' pubblicati in un ALTRO articolo, fusi nei tratti
    # massimali come per le ripetizioni interne (un difetto, una riga)
    if memoria is not None:
        n = soglia("ngramma_len")
        w = token_norm(corpo)
        i, seg = 0, 0
        while i <= len(w) - n and seg < 5:
            g = " ".join(w[i:i + n])
            dove = memoria.gia_scritto(g)
            if not dove or set(g.split()) <= tecn:
                i += 1
                continue
            j = i
            while (j + 1 <= len(w) - n
                   and memoria.gia_scritto(" ".join(w[j + 1:j + 1 + n])) == dove):
                j += 1
            vs.append(_v("11.3", BLOCCANTE,
                         f"queste parole sono gia' uscite in «{dove}»: "
                         f"«{' '.join(w[i:j + n])}»"))
            seg += 1
            i = j + 1
    return vs


def _bigrammi(t):
    w = token_norm(t)
    return [(w[i], w[i + 1]) for i in range(len(w) - 1)]


def _frasi_e_ritmo(fr, sezioni):
    vs = []
    if not fr:
        return vs
    mx = soglia("frase_max_parole")
    for f in fr:
        if len(parole(f)) > mx:
            vs.append(_v("R1", BLOCCANTE, f"frase di {len(parole(f))} parole (massimo {mx})", f))
    r = ritmo("\n".join(fr))
    if r:
        if r["cv"] < soglia("cv_ritmo_min"):
            vs.append(_v("R1", AVVISO,
                         f"ritmo piatto: variabilita' delle frasi {r['cv']} "
                         f"(minimo {soglia('cv_ritmo_min')})"))
        if r["pct_corte"] < soglia("pct_frasi_corte_min"):
            vs.append(_v("R2", AVVISO,
                         f"solo il {r['pct_corte']}% delle frasi sta sotto le "
                         f"{soglia('frase_corta_parole')} parole "
                         f"(minimo {soglia('pct_frasi_corte_min')}%)"))
    # paragrafi
    for tag, t in sezioni:
        for p in paragrafi(t):
            nf, np_ = len(frasi(p)), len(parole(p))
            if nf > soglia("paragrafo_max_frasi") or np_ > soglia("paragrafo_max_parole"):
                vs.append(_v("F5", AVVISO,
                             f"paragrafo di {nf} frasi e {np_} parole "
                             f"(massimo {soglia('paragrafo_max_frasi')} e "
                             f"{soglia('paragrafo_max_parole')})", p, tag))
                break
    return vs


def _numeri_in_prosa(fr, n_parole):
    vs = []
    for f in fr:
        n = len(_RE_NUM_PROSA.findall(f))
        if n > soglia("numeri_per_frase"):
            vs.append(_v("N2", BLOCCANTE,
                         f"{n} valori numerici in una frase (massimo "
                         f"{soglia('numeri_per_frase')}): questa informazione "
                         f"appartiene al grafico", f))
    tot = sum(len(_RE_NUM_PROSA.findall(f)) for f in fr)
    if tot < soglia("numeri_minimi_articolo"):
        vs.append(_v("N12", BLOCCANTE,
                     f"solo {tot} valori in cifre in tutto il pezzo (minimo "
                     f"{soglia('numeri_minimi_articolo')}): scrivere «dodici "
                     f"millesimi» ovunque e mai «0,012 s» e' raccontare di aver "
                     f"misurato, non misurare"))
    d = 100 * tot / max(1, n_parole)
    if d > soglia("numeri_per_100_parole"):
        vs.append(_v("N1", BLOCCANTE,
                     f"{d:.1f} numeri ogni 100 parole (massimo "
                     f"{soglia('numeri_per_100_parole')}): non e' prosa densa, "
                     f"e' una tabella con le congiunzioni"))
    # glossa ripetuta: lo stesso valore piu' di due volte
    c = Counter(m for f in fr for m in _RE_NUM_PROSA.findall(f))
    for val, n in c.items():
        if n > 2 and len(val) > 2:
            vs.append(_v("N5", BLOCCANTE,
                         f"il valore {val} compare {n} volte: la glossa si da' una volta sola"))
    return vs


def _attacco(sezioni, memoria):
    vs = []
    if not sezioni:
        return vs
    primo = sezioni[0][1]
    fr = frasi(primo)
    if not fr:
        return vs
    lede = fr[0]
    if len(parole(lede)) > soglia("lede_max_parole"):
        vs.append(_v("A2", AVVISO,
                     f"il lede ha {len(parole(lede))} parole (massimo "
                     f"{soglia('lede_max_parole')})", lede))
    n = _norm(lede).strip()
    for cattivo in lessico()["soggetti_vietati_incipit"]["lemmi"]:
        if n.startswith(_norm(cattivo)):
            vs.append(_v("A1", BLOCCANTE,
                         f"la prima frase ha come soggetto lo strumento («{cattivo}»): "
                         f"il soggetto e' un pilota, un momento, un luogo, un numero", lede))
            break
    if lede.rstrip().endswith("?"):
        vs.append(_v("A4", BLOCCANTE, "nessuna domanda in apertura", lede))
    if memoria is not None:
        simile = memoria.incipit_simile(lede)
        if simile:
            vs.append(_v("A6", BLOCCANTE,
                         f"questo attacco somiglia a quello di «{simile}»", lede))
    return vs


def _chiusa(sezioni):
    vs = []
    if not sezioni:
        return vs
    fr = frasi(sezioni[-1][1])
    if not fr:
        return vs
    ultima = fr[-1]
    n = _norm(ultima).strip()
    if re.match(r"^(e|non e|e la|e il|e una|e un)\b", n):
        vs.append(_v("C3", BLOCCANTE, "la chiusa comincia con la copula", ultima))
    if ultima.rstrip().endswith("?"):
        vs.append(_v("C6", BLOCCANTE, "nessun punto interrogativo come ultima frase", ultima))
    # frasi-sentenza: corte, senza numeri, al presente, astratte
    sent = [f for f in fr if len(parole(f)) < 12 and not _RE_NUM_PROSA.search(f)]
    if len(sent) > soglia("sentenza_max"):
        vs.append(_v("C4", AVVISO,
                     f"{len(sent)} frasi-sentenza nella sezione finale "
                     f"(massimo {soglia('sentenza_max')}): una e' un finale, "
                     f"tante sono un tic", " / ".join(sent[:3])))
    return vs


def _struttura(articolo, sezioni, n_parole):
    vs = []
    L = lessico()
    forma = articolo.get("forma")
    if forma and forma not in L["forme"]:
        vs.append(_v("F1", BLOCCANTE, f"forma non ammessa: «{forma}»"))
    peso = articolo.get("peso")
    if peso in L["pesi"]:
        lo, hi = L["pesi"][peso]
        if not (lo * 0.85 <= n_parole <= hi * 1.15):
            vs.append(_v("F3", AVVISO,
                         f"il pezzo e' dichiarato «{peso}» ({lo}-{hi} parole) "
                         f"ma ne ha {n_parole}"))
    if not articolo.get("tesi"):
        vs.append(_v("T2", AVVISO, "manca il campo `tesi`: senza tesi e' una scheda dati"))
    if not articolo.get("conseguenza"):
        vs.append(_v("C8", AVVISO,
                     "manca il campo `conseguenza`: ogni pezzo dice che cosa cambia "
                     "adesso, o dichiara che non cambia niente"))
    vietati = set(L["formule_ia"]["titoli_vietati"])
    for tag, _ in sezioni:
        if _norm(tag).strip() in vietati:
            vs.append(_v("F6", BLOCCANTE, f"sezione-formulario: «{tag}»"))
    for s in articolo.get("sezioni", []) or []:
        tit = s.get("titolo") or ""
        p = [w for w in tit.split()[1:] if w[:1].isupper() and w.upper() != w and len(w) > 3]
        if len(p) >= 2:
            vs.append(_v("F7", AVVISO, "titolo di sezione in Title Case", tit))
            break
    tit = articolo.get("titolo") or ""
    if ":" in tit and "—" in tit:
        vs.append(_v("F8", AVVISO, "il titolo ha sia i due punti sia il trattino lungo", tit))
    piccole = {"il", "la", "lo", "i", "gli", "le", "un", "una", "di", "da", "in",
               "e", "che", "non", "a", "al", "del", "della", "per", "con", "su", "e'"}
    tk = [w for w in token_norm(tit) if w not in piccole and len(w) > 2]
    rip = [w for w, n in Counter(tk).items() if n > 1]
    if rip:
        vs.append(_v("F8", AVVISO,
                     f"il titolo ripete «{rip[0]}»: in un titolo di dieci parole "
                     f"una ripetizione si vede", tit))
    return vs


def _tic(corpo, fr, piano_norm):
    vs = []
    L = lessico()
    # negazione correttiva
    neg = re.findall(r"\bnon (?:e|sono|si tratta di|significa)\b[^.;:]{0,60}[:,]\s*e\b|"
                     r"\bnon solo\b[^.]{0,60}\bma anche\b|"
                     r"\bnon \w+[^.]{0,50}, ma\b", piano_norm)
    if len(neg) > soglia("negazione_correttiva_max"):
        vs.append(_v("D-NEG", BLOCCANTE,
                     f"{len(neg)} negazioni correttive («non e' X: e' Y»): il massimo e' "
                     f"{soglia('negazione_correttiva_max')}. Finge profondita': le due "
                     f"proposizioni dicono la stessa cosa"))
    # incipit di frase con copula o negazione
    if fr:
        cop = sum(1 for f in fr if re.match(r"^(e|non)\b", _norm(f).strip()))
        pct = 100 * cop / len(fr)
        if pct > soglia("pct_incipit_copula_max"):
            vs.append(_v("R11", AVVISO,
                         f"il {pct:.0f}% delle frasi comincia con la copula o una negazione "
                         f"(massimo {soglia('pct_incipit_copula_max')}%): il testo argomenta "
                         f"per definizioni, non racconta"))
    # connettivi
    n_par = max(1, len(parole(corpo)))
    conn = sum(len(re.findall(r"\b" + _norm(c).replace(" ", r"\s+") + r"\b", piano_norm))
               for c in L["connettivi"]["lemmi"])
    d = 100 * conn / n_par
    if d > soglia("connettivi_per_100_parole"):
        vs.append(_v("R10", AVVISO,
                     f"{conn} connettivi espliciti in {n_par} parole ({d:.1f}%, massimo "
                     f"{soglia('connettivi_per_100_parole')}%): la sequenza si costruisce "
                     f"con l'ordine delle informazioni"))
    # aggettivi valutativi senza misura nella stessa frase
    for f in fr:
        nf = _norm(f)
        for a in L["aggettivi_valutativi"]["lemmi"]:
            if re.search(r"\b" + a + r"\b", nf) and not _RE_NUM_PROSA.search(f):
                vs.append(_v("X6", BLOCCANTE,
                             f"aggettivo valutativo senza misura nella frase: «{a}»", f))
                break
    # si impersonale
    for m in re.finditer(r"\bsi (osserva|puo notare|evince|nota|riscontra|constata|deduce)\b",
                         piano_norm):
        vs.append(_v("R8", BLOCCANTE,
                     f"impersonale su un nostro atto: «{m.group(0)}». "
                     f"Dire chi misura", _contesto_norm(corpo, m.start())))
        break
    # caveat inline ripetuti
    cav = len(re.findall(r"\b(non e un verdetto|restano ignoti|non lo stimiamo|"
                         r"di nascosto|non misurabile|non e misurabile|va preso con cautela|"
                         r"con le dovute cautele)\b", piano_norm))
    if cav > soglia("caveat_max"):
        vs.append(_v("O2", AVVISO,
                     f"{cav} caveat in linea (massimo {soglia('caveat_max')}): il resto "
                     f"sta nella tabella di provenienza, che e' il posto giusto"))
    # sigle contro nomi
    sigle = [s for s in re.findall(r"\b[A-Z]{3}\b", corpo)
             if s not in set(L["sigle_note"]["lemmi"])]
    nomi = re.findall(r"\b[A-Z][a-zà-ÿ]{3,}\b", corpo)
    if sigle and len(sigle) > soglia("sigle_su_nomi_max") * max(1, len(nomi)):
        vs.append(_v("N14", AVVISO,
                     f"{len(sigle)} sigle contro {len(nomi)} nomi propri: alla prima "
                     f"occorrenza si scrive il cognome per esteso"))
    # anglicismi con resa italiana
    for en, it in L["anglicismi"]["sostituzioni"].items():
        if re.search(r"\b" + re.escape(_norm(en)).replace(r"\ ", r"\s+") + r"\b", piano_norm):
            vs.append(_v("X7", AVVISO, f"«{en}» si dice «{it}»"))
    return vs


# ---------------------------------------------------------------- rapporto ----

def rapporto(esito, id_=""):
    """Il risultato in forma leggibile da un umano (e da un log del cron)."""
    p = esito["profilo"]
    r = ritmo_txt(p.get("ritmo"))
    testa = (f"{id_ or '(articolo)'}: {'PASSA' if esito['ok'] else 'NON PASSA'} — "
             f"{p['bloccanti']} bloccanti, {p['avvisi']} avvisi")
    corpo = [f"  profilo: {p['parole']} parole · Gulpease {p['gulpease']} · "
             f"MTLD {p['mtld']} · {p['numeri_100']} numeri/100par · {r}"]
    for v in esito["violazioni"]:
        segno = "!!" if v["gravita"] == BLOCCANTE else " ~"
        corpo.append(f"  {segno} [{v['regola']}] {v['messaggio']}")
        if v["estratto"]:
            corpo.append(f"        «{v['estratto']}»")
    return "\n".join([testa] + corpo)


def ritmo_txt(r):
    if not r:
        return "ritmo n/d"
    return (f"frasi {r['frasi']} · media {r['media']} · cv {r['cv']} · "
            f"corte {r['pct_corte']}% · max {r['max']}")


def per_agente(esito, massimo=14):
    """Le violazioni come le riceve chi deve correggere: prosa, non JSON. La
    ricerca su pipeline multi-agente e' netta — i DATI vanno passati in JSON, le
    CRITICHE in testo semplice: passare le critiche in JSON degrada la resa."""
    righe = []
    for v in esito["violazioni"][:massimo]:
        r = f"- [{v['regola']}] {v['messaggio']}"
        if v["estratto"]:
            r += f'\n  Nel testo: "{v["estratto"]}"'
        righe.append(r)
    return "\n".join(righe)


# --------------------------------------------------------------------- CLI ----

def _carica(id_):
    for p in (os.path.join(_QUI, "bozze", id_, "articolo.json"),
              os.path.join(REPO, "demo", "data", "analisi", f"{id_}.json")):
        if os.path.exists(p):
            art = json.load(open(p, encoding="utf-8"))
            fp = os.path.join(os.path.dirname(p), "facts.json")
            facts = json.load(open(fp, encoding="utf-8")) if os.path.exists(fp) else None
            return art, facts
    raise SystemExit(f"articolo non trovato: {id_}")


def main():
    import argparse
    ap = argparse.ArgumentParser(description="Il correttore della redazione (nessun LLM)")
    ap.add_argument("--id", help="id di una bozza o di un pubblicato")
    ap.add_argument("--tutti", action="store_true", help="tutti i pubblicati")
    ap.add_argument("--bozze", action="store_true", help="tutte le bozze")
    ap.add_argument("--memoria", action="store_true", help="attiva i controlli fra-articoli")
    a = ap.parse_args()

    mem = None
    if a.memoria:
        import memoria as _m
        mem = _m.Memoria()

    ids = []
    if a.id:
        ids = [a.id]
    elif a.bozze:
        b = os.path.join(_QUI, "bozze")
        ids = sorted(d for d in os.listdir(b) if os.path.isdir(os.path.join(b, d)))
    else:
        d = os.path.join(REPO, "demo", "data", "analisi")
        ids = sorted(f[:-5] for f in os.listdir(d)
                     if f.endswith(".json") and f not in
                     ("forza_macchina.json", "stagione_dati.json"))
    tot_b = 0
    for i in ids:
        try:
            art, facts = _carica(i)
        except SystemExit as e:
            print(e)
            continue
        if mem is not None:
            mem.escludi(i)
        e = controlla(art, facts, mem)
        tot_b += e["profilo"]["bloccanti"]
        print(rapporto(e, i))
        print()
    print(f"== {len(ids)} articoli · {tot_b} violazioni bloccanti totali ==")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
