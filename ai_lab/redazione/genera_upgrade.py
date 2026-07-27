"""
Sviluppo relativo — chi ha sviluppato meglio (o peggio) del gruppo, fra due blocchi
di gare. Articolo TRASVERSALE (gp=None), si riaggiorna a ogni gara.

PERCHE' NON PIU' "l'upgrade di X a Y ha funzionato?".  La versione precedente di
questo file prendeva UN candidato da un dossier di stampa cablato in costante e
misurava il prima-vs-dopo attorno alla sua gara-upgrade.  Quella domanda, sui dati
2026, non e' rispondibile:

  1. NON ESISTE UN "PRIMA SENZA UPGRADE.  Dal documento FIA "Car Presentation
     Submissions" si sa quante volte ogni squadra ha portato aggiornamenti nel 2026:
     Haas 11 gare su 11, Red Bull 10, Racing Bulls 10, Cadillac 10, McLaren 9,
     Ferrari 9, Mercedes 8, Williams 8, Audi 8, Alpine 7, Aston Martin 4.  Il blocco
     "prima" di qualunque split contiene gia' altri aggiornamenti: manca il
     controfattuale, e il confronto attribuisce a UN pacchetto l'effetto di tutti.
     E' esattamente il difetto dell'articolo "upgrade-red-bull-miami-2026", che usava
     Melbourne/Shanghai/Suzuka come "prima" mentre a Melbourne la Red Bull aveva gia'
     portato 3 componenti e a Suzuka 4.
  2. DOPO UNA GARA LA RISPOSTA ONESTA E' SEMPRE "NON SEPARABILE": un pacchetto, un
     weekend, un circuito.  Non c'e' ripetizione, quindi non c'e' misura.
  3. L'INDICE FORZA-MACCHINA E' UN PERCENTILE PER GARA, cioe' a somma zero: se
     migliorano tutti, non si muove nessuno.  Su una grandezza cosi' l'unica
     affermazione che regge e' RELATIVA.

LA DOMANDA NUOVA, che invece si puo' misurare: fra il blocco di gare A e il blocco B,
quali squadre si sono mosse rispetto al GRUPPO?  Multi-gara, ripetuta, e mai un
verdetto su un singolo pacchetto.

COME SI MISURA
  posizione relativa in qualifica, per squadra e per gara:
      rel = 100 * (potenziale - mediana del campo) / mediana del campo     [% di giro]
  negativa = piu' veloce della mediana dello schieramento.  E' normalizzata dentro la
  gara, quindi confrontabile fra circuiti; il riferimento e' la MEDIANA del campo, non
  il leader (col leader, un leader che scappa peggiora tutti gli altri per costruzione).
  Sviluppo relativo di una squadra = media(rel nel blocco B) - media(rel nel blocco A).
  Segno invertito nel testo: "guadagno" = terreno guadagnato sul gruppo.

  CANALE PRIMARIO = qualifica (potenziale).  Il passo gara e' CORROBORAZIONE, non
  prova: e' inquinato dal traffico (misurato altrove in casa: +8,17 s di mediana per
  gara) e nel 2026 manca per alcune squadre in alcune gare.

  FINESTRA: le gare disponibili tagliate a meta' (regola fissa, non scelta sui
  risultati).  Si sposta da sola a ogni gara nuova, quindi ogni affermazione viene
  ri-testata la settimana dopo.  --da/--a restringono il perimetro a mano.

I CANCELLI (se non passano, l'articolo NON esce: return None)
  - finestra minima: MIN_PRIMA gare nel blocco A e MIN_DOPO nel blocco B;
  - PERMUTAZIONE CORRETTA PER LA FAMIGLIA (max-T): si guardano 11 squadre in una
    volta, quindi il p per-squadra non basta (a p<0,05 su 11 test ci si aspetta ~0,55
    falsi positivi per sport).  Si permutano le etichette gara UNA volta sola e si
    prende il massimo |sviluppo| su TUTTE le squadre: p_famiglia = frazione delle
    permutazioni in cui quel massimo batte lo sviluppo osservato.  Controlla il tasso
    di errore d'insieme e tiene conto della correlazione fra squadre (rel e' quasi a
    somma zero: se una sale, qualcuna scende).
  - se NESSUNA squadra sta sotto ALFA, non c'e' articolo.
  - separazione di rango completa (ogni gara di B oltre ogni gara di A): riportata
    come rinforzo, mai pretesa; sul 2026 non ce l'ha nessuno, e si dice.

LO SFORZO DICHIARATO (fonte FIA, via fia_cp.py)
  Dal "Car Presentation Submissions" si contano i componenti portati da ogni squadra
  a ogni gara.  Si tengono SOLO i motivi "Performance": le voci "Circuit specific"
  non sono sviluppo, sono configurazione per quel tracciato (a Monaco valgono il 29%
  delle righe, a Spa il 24%) e sommarle sarebbe un errore di categoria.
  Peso: ESPOSIZIONE DIFFERENZIALE.  Un pezzo arrivato al round r e' rimasto sulla
  macchina per una frazione delle gare di B e una frazione delle gare di A; quello che
  puo' spostare un contrasto A-vs-B e' la DIFFERENZA fra le due frazioni.  Un pezzo
  del round 1 pesa 0 (c'era in tutte e due), uno arrivato subito dopo il taglio pesa 1,
  l'ultimo arrivato pesa poco.  E' il peso che il contrasto misura davvero, non una
  scelta di comodo.

TRE NULL DELLA FONTE FIA, dichiarati e mai colmati:
  N1 il documento non dice MAI su quale vettura o pilota va il pezzo (zero occorrenze
     di "car N" / "both cars" / "driver" / "chassis" nei documenti 2026);
  N2 non contiene nessun numero di prestazione: il CONTEGGIO dei pezzi NON e' la
     taglia dell'aggiornamento (un fondo nuovo e una staffa di scarico contano 1);
  N3 a volte il pezzo e' "available"/"optional": portato, non per forza montato.
  Percio' lo sforzo dichiarato e' un indicatore di ATTIVITA', non di prestazione, e la
  causa (quale pezzo ha prodotto cosa) resta NON_MISURABILE.

python3 UTENTE.  Solo lettura del repo; bozza nell'area Lab.  Non tocca demo/ ne'
engine/ (in demo ci scrive coda.py, dopo l'approvazione umana).
"""
from __future__ import annotations
import os
import re
import sys
import json
import math
import datetime
import itertools
import statistics as st

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import svg      # noqa: E402
import base     # noqa: E402
import fia_cp   # noqa: E402

REPO = os.path.abspath(os.path.join(_QUI, "..", ".."))
FORZA_JSON = os.path.join(REPO, "demo", "data", "analisi", "forza_macchina.json")
FORZA_STAGIONE = os.path.join(_QUI, "forza_stagione")   # potenziale/passo/gap in s
DATI_STAGIONE = os.path.join(_QUI, "dati_stagione")     # vmax/cornering km/h
CALENDARIO = os.path.join(REPO, "data", "calendario_2026.json")

ID_META = "upgrade"
ANNO = 2026

# --- CANCELLI (dichiarati) ---------------------------------------------------
MIN_PRIMA = 3          # gare minime nel blocco A
MIN_DOPO = 3           # gare minime nel blocco B
ALFA = 0.05            # soglia sul p CORRETTO PER LA FAMIGLIA (max-T su tutte le squadre)
CAP_PERM = 200000      # oltre questo numero di split si campiona invece di enumerare
SEME = 20260727        # seme fisso: la permutazione campionata dev'essere riproducibile
MIN_SQUADRE = 6        # sotto questo numero di squadre complete la famiglia non ha senso
MIN_GARE_FIA = 4       # meno documenti FIA leggibili di cosi' -> braccio sforzo assente

# La cache dei PDF FIA sta fuori dal repo (fia_cp.CACHE_DIR). Si puo' puntare altrove
# con MURETTO_FIA_CP o con --cp: serve ai collaudi e alle rigenerazioni offline.
CARTELLA_CP = os.environ.get("MURETTO_FIA_CP") or fia_cp.CACHE_DIR

# Nomi squadra: la fonte FIA e i nostri file di stagione non li scrivono uguali.
# Tabella esplicita, come in fia_cp: se un nome non e' qui non si indovina.
TEAM_FIA = {
    "McLaren": "McLaren", "Mercedes": "Mercedes", "Red Bull Racing": "Red Bull",
    "Ferrari": "Ferrari", "Williams": "Williams", "Racing Bulls": "Racing Bulls",
    "Aston Martin": "Aston Martin", "Haas F1 Team": "Haas", "Alpine": "Alpine",
    "Audi": "Audi", "Cadillac": "Cadillac",
}
CORTO = {"Red Bull Racing": "Red Bull", "Haas F1 Team": "Haas", "Aston Martin": "Aston Martin"}

# Nome del GP come lo scrive la FIA -> slug del calendario di casa. Esplicita per la
# stessa ragione di fia_cp._SQUADRE: un GP non mappato e' un'anomalia da dichiarare,
# non da indovinare. T11: "Barcelona-Catalunya" e "Spanish" (=Madrid) sono DUE gare.
GP_FIA = {
    "australian": "australia", "chinese": "china", "japanese": "japan",
    "miami": "miami", "canadian": "canada", "monaco": "monaco",
    "barcelona catalunya": "barcelona-catalunya", "spanish": "spain",
    "austrian": "austria", "british": "great-britain", "belgian": "belgium",
    "hungarian": "hungary", "dutch": "netherlands", "italian": "italy",
    "azerbaijan": "azerbaijan", "singapore": "singapore",
    "united states": "united-states", "mexico city": "mexico", "mexican": "mexico",
    "sao paulo": "sao-paulo", "las vegas": "las-vegas", "qatar": "qatar",
    "abu dhabi": "abu-dhabi",
}

# La famiglia di motivi che conta come SVILUPPO. "Circuit specific" e' configurazione
# per il tracciato, "Reliability" e' rimedio a un guasto: nessuna delle due e' progresso.
FAMIGLIA_SVILUPPO = "Performance"


def it(x, dec=1):
    return base.it(x, dec)


def nm(t):
    return CORTO.get(t, t)


def _chiave(s):
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).replace(" grand prix", "").strip()


def _scala(ms):
    """Millesimi in parole: sotto il secondo restano millesimi, sopra diventano secondi."""
    if ms is None:
        return "–"
    return f"{it(ms / 1000.0, 2)} s" if abs(ms) >= 1000 else f"{abs(ms)} millesimi"


# ---------------------------------------------------------------------------
# CARICAMENTO DATI (solo lettura, nessun numero scritto a mano)
# ---------------------------------------------------------------------------
def _carica_forza():
    try:
        return json.load(open(FORZA_JSON))
    except Exception:
        return None


def _carica_dir(d):
    if not os.path.isdir(d):
        return []
    out = []
    for f in os.listdir(d):
        if f.endswith(".json"):
            try:
                out.append(json.load(open(os.path.join(d, f))))
            except Exception:
                pass
    return sorted(out, key=lambda g: g.get("round", 0))


def _calendario():
    """slug del GP -> round. Vuoto se il calendario non c'e' (il braccio FIA si spegne)."""
    try:
        cal = json.load(open(CALENDARIO))
    except Exception:
        return {}
    return {g["gp"]: g["round"] for g in cal.get("gare", []) if g.get("gp")}


# ---------------------------------------------------------------------------
# SERIE (riusate dalla versione precedente: stessa semantica, stesse fonti)
# ---------------------------------------------------------------------------
def _serie(gare, team, key):
    return [(g["round"], g["team"].get(team, {}).get(key)) for g in gare]


def _ba(coppie, up):
    """(round,val) -> (lista_prima, lista_dopo) rispetto al round di taglio (incluso in dopo)."""
    b = [v for r, v in coppie if v is not None and r < up]
    a = [v for r, v in coppie if v is not None and r >= up]
    return b, a


def _pct_leader_quali(g, team):
    """Distacco in qualifica come % dal miglior potenziale della gara (leader=0)."""
    vals = [x["potenziale"] for x in g["team"].values() if x.get("potenziale")]
    v = g["team"].get(team, {}).get("potenziale")
    if not vals or v is None:
        return None
    lead = min(vals)
    return 100.0 * (v - lead) / lead


def _pct_leader_passo(g, team):
    vals = [x["passo"] for x in g["team"].values() if x.get("passo")]
    v = g["team"].get(team, {}).get("passo")
    if not vals or v is None:
        return None
    lead = min(vals)
    return 100.0 * (v - lead) / lead


def _percentile_campo(g, team, key):
    """Percentile del team nel campo su un canale (50 = mediana schieramento)."""
    vals = [x[key] for x in g["team"].values() if x.get(key) is not None]
    v = g["team"].get(team, {}).get(key)
    if len(vals) < 3 or v is None:
        return None
    return 100.0 * sum(1 for x in vals if x < v) / len(vals)


def _rel_campo(g, team, key):
    """Posizione relativa: % di giro rispetto alla MEDIANA del campo in quella gara.

    Perche' la mediana e non il leader: col leader come riferimento, un leader che
    scappa peggiora per costruzione il "distacco" di tutti gli altri, e uno che
    rallenta li migliora tutti — il segnale del gruppo entra nel numero di ognuno.
    La mediana e' il centro dello schieramento e non si sposta per un solo estremo.
    """
    vals = [x[key] for x in g["team"].values() if x.get(key)]
    v = g["team"].get(team, {}).get(key)
    if len(vals) < 3 or not v:
        return None
    med = st.median(vals)
    if not med:
        return None
    return 100.0 * (v - med) / med


# ---------------------------------------------------------------------------
# ROBUSTEZZA di un segnale prima-vs-dopo (riusata): test di permutazione (esatto se
# lo split e' piccolo, altrimenti campionato) + separazione di rango completa.
# ---------------------------------------------------------------------------
def _robustezza(prima, dopo, direzione, cap=CAP_PERM):
    """direzione='giu' (dopo piu' basso = meglio, es. distacco) o 'su' (dopo piu'
    alto = meglio, es. indice). Ritorna dict {p, est, tot, sep, migliora}.
    Statistica = miglioramento della media (segnata secondo la direzione); p = frazione
    delle riassegnazioni di etichetta con miglioramento >= osservato (una coda)."""
    prima = [x for x in prima if x is not None]
    dopo = [x for x in dopo if x is not None]
    n, m = len(prima), len(dopo)
    if n == 0 or m == 0:
        return {"p": None, "est": 0, "tot": 0, "sep": False, "migliora": None}
    tutti = prima + dopo
    N = n + m
    seg = (lambda x: -x) if direzione == "giu" else (lambda x: x)
    stat = lambda pr, do: seg(st.mean(do) - st.mean(pr))
    oss = stat(prima, dopo)
    ncomb = math.comb(N, n)
    est = 0
    if ncomb <= cap:
        tot = ncomb
        for combo in itertools.combinations(range(N), n):
            cs = set(combo)
            pr = [tutti[i] for i in range(N) if i in cs]
            do = [tutti[i] for i in range(N) if i not in cs]
            if stat(pr, do) >= oss - 1e-9:
                est += 1
    else:
        import random
        rnd = random.Random(SEME)
        tot = cap
        idxs = list(range(N))
        for _ in range(cap):
            cs = set(rnd.sample(idxs, n))
            pr = [tutti[i] for i in range(N) if i in cs]
            do = [tutti[i] for i in range(N) if i not in cs]
            if stat(pr, do) >= oss - 1e-9:
                est += 1
    sep = (max(dopo) < min(prima)) if direzione == "giu" else (min(dopo) > max(prima))
    return {"p": round(est / tot, 3) if tot else None, "est": est, "tot": tot,
            "sep": sep, "migliora": oss > 0}


# ---------------------------------------------------------------------------
# RILEVATORE CIECO (riusato): scorre TUTTI i team e TUTTI gli split senza sapere
# nulla di aggiornamenti o di stampa. Qui serve a una domanda sola: lo split fisso
# (meta' stagione) e' anche quello che massimizza il movimento della squadra che
# passa il cancello? Se si', lo si dichiara — e' una coincidenza del calendario,
# non una scelta, ma va detta.
# ---------------------------------------------------------------------------
def _rileva(gare_s, key="potenziale"):
    """Per ogni squadra, lo split che massimizza |sviluppo relativo| e quanto vale."""
    teams = sorted({t for g in gare_s for t in g["team"]})
    rounds = [g["round"] for g in gare_s]
    out = []
    for t in teams:
        s = [(g["round"], _rel_campo(g, t, key)) for g in gare_s]
        best = None
        for k in range(MIN_PRIMA, len(s) - MIN_DOPO + 1):
            up_r = rounds[k]
            b, a = _ba(s, up_r)
            if len(b) < MIN_PRIMA or len(a) < MIN_DOPO:
                continue
            d = st.mean(a) - st.mean(b)          # <0 = terreno guadagnato sul gruppo
            sd = st.pstdev(a) if len(a) > 1 else 0.0
            if best is None or abs(d) > abs(best["sviluppo"]):
                best = {"round": up_r, "sviluppo": d, "sigma_dopo": sd}
        if best:
            out.append({"team": t, **best})
    out.sort(key=lambda x: -abs(x["sviluppo"]))
    return out


# ---------------------------------------------------------------------------
# PERMUTAZIONE MAX-T sulla FAMIGLIA delle squadre.
# ---------------------------------------------------------------------------
def _maxT(matrice, k, cap=CAP_PERM):
    """p corretto per la famiglia, per ogni squadra.

    `matrice`: {team: [valori in ordine di round]} — stessa lunghezza, nessun None.
    `k`: quante gare nel blocco A (le prime k dell'ordine dato).

    Si permutano le ETICHETTE DI GARA una volta sola per replica e si prende il
    massimo |sviluppo| su tutte le squadre: e' il classico max-T. Due proprieta' che
    servono qui: (a) controlla il tasso di errore d'insieme mentre si guardano 11
    squadre in un colpo; (b) la permutazione e' comune, quindi la dipendenza fra
    squadre (rel e' quasi a somma zero) e' conservata invece di essere ignorata.

    Ritorna (per_squadra, tot, esatto) con per_squadra = {team: {sviluppo, sep,
    p_famiglia, p_grezzo}}.
    """
    teams = sorted(matrice)
    if not teams:
        return {}, 0, True
    n = len(matrice[teams[0]])
    oss = {}
    for t in teams:
        v = matrice[t]
        pr, do = v[:k], v[k:]
        oss[t] = {"sviluppo": st.mean(do) - st.mean(pr),
                  "sep": (max(do) < min(pr)) or (min(do) > max(pr))}
    ncomb = math.comb(n, k)
    esatto = ncomb <= cap
    if esatto:
        splits = itertools.combinations(range(n), k)
        tot = ncomb
    else:
        import random
        rnd = random.Random(SEME)
        idxs = list(range(n))
        splits = (tuple(rnd.sample(idxs, k)) for _ in range(cap))
        tot = cap
    conta_fam = {t: 0 for t in teams}
    conta_gre = {t: 0 for t in teams}
    for combo in splits:
        cs = set(combo)
        stat = {}
        massimo = 0.0
        for t in teams:
            v = matrice[t]
            pr = [v[i] for i in range(n) if i in cs]
            do = [v[i] for i in range(n) if i not in cs]
            s = abs(st.mean(do) - st.mean(pr))
            stat[t] = s
            if s > massimo:
                massimo = s
        for t in teams:
            if massimo >= abs(oss[t]["sviluppo"]) - 1e-9:
                conta_fam[t] += 1
            if stat[t] >= abs(oss[t]["sviluppo"]) - 1e-9:
                conta_gre[t] += 1
    fuori = {}
    for t in teams:
        fuori[t] = {**oss[t],
                    "p_famiglia": conta_fam[t] / tot,
                    "p_grezzo": conta_gre[t] / tot}
    return fuori, tot, esatto


# ---------------------------------------------------------------------------
# SFORZO DICHIARATO dalla fonte FIA (fia_cp) — braccio opzionale.
# ---------------------------------------------------------------------------
def _leggi_cp(cartella, anno, cal):
    """Legge la cache dei "Car Presentation Submissions" e ritorna (per_round, diag).

    per_round: {round: {squadra_fia: {famiglia: n}}}
    Ogni documento passa DUE cancelli di fia_cp prima di contare qualcosa:
      - cancello_identita, chiuso sul GP che il PDF stesso dichiara in copertina
        (nome file dell'anno + copertina che nomina anno e gara: e' la difesa T9);
      - cancello_qualita, che blocca i documenti da cui si e' persa una riga.
    Un documento scartato NON diventa uno zero: diventa una gara ESCLUSA e dichiarata.
    Zero componenti si conta solo quando la fonte dice "No updates submitted".
    """
    diag = {"letti": [], "esclusi": [], "non_mappati": [], "cartella": cartella}
    per_round = {}
    if not cartella or not os.path.isdir(cartella):
        diag["esclusi"].append(f"cartella assente: {cartella}")
        return per_round, diag
    for f in sorted(os.listdir(cartella)):
        if not f.lower().endswith(".pdf") or not f.startswith(f"{anno}_"):
            continue
        path = os.path.join(cartella, f)
        est = fia_cp.estrai(path)
        if not est or est.get("anno") != anno or not est.get("gp"):
            diag["esclusi"].append(f"{f}: copertina non leggibile o anno diverso")
            continue
        # L'identita' si chiude sul GP che il documento stesso dichiara: cosi' il
        # cancello controlla davvero (con atteso_gp vuoto sarebbe un no-op).
        ok_id, motivo = fia_cp.cancello_identita(path, anno, est["gp"])
        if not ok_id:
            diag["esclusi"].append(f"{est['gp']}: identita' respinta ({motivo})")
            continue
        slug = GP_FIA.get(_chiave(est["gp"]))
        r = cal.get(slug) if slug else None
        if r is None:
            diag["non_mappati"].append(est["gp"])
            continue
        ok_q, problemi = fia_cp.cancello_qualita(est)
        if not ok_q:
            diag["esclusi"].append(f"round {r} ({est['gp']}): {problemi[0]}")
            continue
        conte = {}
        for s in est["squadre"]:
            if not s.get("team_norm"):
                continue
            fam = {}
            for c in s["componenti"]:
                fam[c["motivo_famiglia"]] = fam.get(c["motivo_famiglia"], 0) + 1
            conte[s["team_norm"]] = fam
        per_round[r] = conte
        diag["letti"].append({"round": r, "gp": est["gp"],
                              "componenti": sum(sum(v.values()) for v in conte.values())})
    diag["letti"].sort(key=lambda x: x["round"])
    return per_round, diag


def _peso_differenziale(r, rounds_prima, rounds_dopo):
    """Quanto un pezzo arrivato al round r pesa su un contrasto A-vs-B.

    E' la differenza fra la frazione delle gare di B che quel pezzo ha vissuto e la
    frazione delle gare di A: 0 per un pezzo del primo round (c'era in entrambi i
    blocchi, non puo' spiegare una differenza), 1 per un pezzo arrivato appena dopo
    il taglio, poco per l'ultimo arrivato — che ha corso una gara sola del blocco B.
    """
    q_dopo = sum(1 for x in rounds_dopo if x >= r) / len(rounds_dopo)
    q_prima = sum(1 for x in rounds_prima if x >= r) / len(rounds_prima)
    return q_dopo - q_prima


def _sforzo(per_round, rounds_prima, rounds_dopo, famiglia=FAMIGLIA_SVILUPPO,
            pesato=True, solo_dopo=False):
    """Sforzo dichiarato per squadra (nome FIA). Vedi _peso_differenziale."""
    fuori = {}
    for t in fia_cp.SQUADRE_2026:
        s = 0.0
        for r, conte in per_round.items():
            if solo_dopo and r < rounds_dopo[0]:
                continue
            n = conte.get(t, {}).get(famiglia, 0)
            s += n * (_peso_differenziale(r, rounds_prima, rounds_dopo) if pesato else 1.0)
        fuori[t] = round(s, 3)
    return fuori


# ---------------------------------------------------------------------------
# CORRELAZIONE DI RANGO fra sforzo dichiarato e sviluppo misurato (11 punti).
# ---------------------------------------------------------------------------
def _ranghi(xs):
    ordine = sorted(range(len(xs)), key=lambda i: xs[i])
    r = [0.0] * len(xs)
    i = 0
    while i < len(ordine):
        j = i
        while j + 1 < len(ordine) and xs[ordine[j + 1]] == xs[ordine[i]]:
            j += 1
        medio = (i + j) / 2.0 + 1
        for q in range(i, j + 1):
            r[ordine[q]] = medio
        i = j + 1
    return r


def _spearman(xs, ys, cap=CAP_PERM):
    """(rho, p) con p da permutazione (esatta se n! <= cap, altrimenti campionata).

    Con 11 squadre la potenza e' minima: serve |rho| ~0,6 per arrivare a p<0,05.
    Un rho non significativo qui NON dice "nessuna relazione", dice "non risolvibile
    con 11 punti" — e va scritto cosi'.
    """
    n = len(xs)
    if n < 4:
        return None, None
    rx, ry = _ranghi(xs), _ranghi(ys)
    mx, my = st.mean(rx), st.mean(ry)
    den = (sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry)) ** 0.5
    if not den:
        return None, None
    rho = sum((a - mx) * (b - my) for a, b in zip(rx, ry)) / den
    if math.factorial(n) <= cap:
        perms = itertools.permutations(range(n))
        tot = math.factorial(n)
    else:
        import random
        rnd = random.Random(SEME)
        base_i = list(range(n))

        def gen():
            for _ in range(cap):
                rnd.shuffle(base_i)
                yield tuple(base_i)
        perms = gen()
        tot = cap
    est = 0
    dx = sum((a - mx) ** 2 for a in rx) ** 0.5
    for p in perms:
        r2 = [ry[i] for i in p]
        m2 = st.mean(r2)
        d2 = sum((b - m2) ** 2 for b in r2) ** 0.5
        if not d2:
            continue
        v = sum((a - mx) * (b - m2) for a, b in zip(rx, r2)) / (dx * d2)
        if abs(v) >= abs(rho) - 1e-12:
            est += 1
    return rho, est / tot


# ---------------------------------------------------------------------------
# MISURA
# ---------------------------------------------------------------------------
def _misura(cartella_cp=None, da=None, a=None, anno=ANNO):
    """Tutti i numeri dell'articolo. Ritorna il dizionario dei fatti, o None se i
    cancelli non passano (finestra troppo corta, campo troppo piccolo, nessuna
    squadra che si separa dal gruppo)."""
    gare = _carica_dir(FORZA_STAGIONE)
    if da is not None:
        gare = [g for g in gare if g["round"] >= da]
    if a is not None:
        gare = [g for g in gare if g["round"] <= a]
    if len(gare) < MIN_PRIMA + MIN_DOPO:
        return None

    n = len(gare)
    k = n // 2                                  # regola fissa: taglio a meta'
    if k < MIN_PRIMA or n - k < MIN_DOPO:
        return None
    rounds = [g["round"] for g in gare]
    r_prima, r_dopo = rounds[:k], rounds[k:]
    circ = {g["round"]: g.get("circuito") for g in gare}

    teams = sorted({t for g in gare for t in g["team"]})
    matrice, incomplete = {}, []
    for t in teams:
        serie = [_rel_campo(g, t, "potenziale") for g in gare]
        if any(v is None for v in serie):
            incomplete.append(t)                # squadra con buchi: fuori dalla famiglia
            continue
        matrice[t] = serie
    if len(matrice) < MIN_SQUADRE:
        return None

    per_squadra, tot_perm, esatto = _maxT(matrice, k)
    if not per_squadra:
        return None

    # CANCELLO: almeno una squadra si separa dal gruppo, col p corretto per la famiglia.
    passanti = [t for t, d in per_squadra.items() if d["p_famiglia"] <= ALFA]
    if not passanti:
        return None

    # ordine di lettura: dal maggior guadagno alla maggior perdita
    classifica = sorted(per_squadra.items(), key=lambda kv: kv[1]["sviluppo"])

    # corroborazione sul passo gara (canale secondario, spesso incompleto)
    passo = {}
    for t in teams:
        serie = [_rel_campo(g, t, "passo") for g in gare]
        pr = [v for v in serie[:k] if v is not None]
        do = [v for v in serie[k:] if v is not None]
        if len(pr) >= 2 and len(do) >= 2:
            passo[t] = {"sviluppo": st.mean(do) - st.mean(pr),
                        "n_prima": len(pr), "n_dopo": len(do)}

    # --- braccio FIA: lo sforzo dichiarato ---------------------------------
    cal = _calendario()
    per_round, diag_cp = _leggi_cp(cartella_cp or CARTELLA_CP, anno, cal)
    sf = sf_grezzo = None
    rho = p_rho = rho_alt = p_rho_alt = None
    coppie = []
    if len(per_round) >= MIN_GARE_FIA and cal:
        sf = _sforzo(per_round, r_prima, r_dopo)
        sf_grezzo = _sforzo(per_round, r_prima, r_dopo, pesato=False, solo_dopo=True)
        noti = [t for t in matrice if TEAM_FIA.get(t) in sf]
        xs = [sf[TEAM_FIA[t]] for t in noti]
        ys = [-per_squadra[t]["sviluppo"] for t in noti]      # >0 = terreno guadagnato
        rho, p_rho = _spearman(xs, ys)
        rho_alt, p_rho_alt = _spearman([sf_grezzo[TEAM_FIA[t]] for t in noti], ys)
        coppie = [{"team": t, "sforzo": sf[TEAM_FIA[t]],
                   "sforzo_grezzo": sf_grezzo[TEAM_FIA[t]],
                   "guadagno": -per_squadra[t]["sviluppo"]} for t in noti]
        coppie.sort(key=lambda c: -c["sforzo"])

    # famiglie dei motivi lette (per dire quanto pesa il "Circuit specific" escluso)
    fam_tot = {}
    for conte in per_round.values():
        for fam in conte.values():
            for nome, v in fam.items():
                fam_tot[nome] = fam_tot.get(nome, 0) + v

    # il rilevatore cieco: lo split fisso e' anche quello massimo per chi passa?
    cieco = {r["team"]: r for r in _rileva(gare)}

    # GIRO-TIPO: la mediana, sulle gare della finestra, del tempo mediano di
    # riferimento in qualifica. Non entra in nessun conto — serve solo a dare una
    # scala leggibile a una grandezza normalizzata ("1% di giro" non dice niente a
    # nessuno, "otto decimi" si'). Le piste sono diverse: e' un metro nominale.
    mediane = []
    for g in gare:
        vals = [x["potenziale"] for x in g["team"].values() if x.get("potenziale")]
        if vals:
            mediane.append(st.median(vals))
    giro_tipo = st.median(mediane) if mediane else None

    protagonista = min(per_squadra.items(), key=lambda kv: kv[1]["p_famiglia"])[0]
    d_prot = per_squadra[protagonista]
    guadagna = d_prot["sviluppo"] < 0

    F = {
        "anno": anno,
        "n_gare": n, "n_prima": k, "n_dopo": n - k,
        "rounds": rounds, "rounds_prima": r_prima, "rounds_dopo": r_dopo,
        "gare_prima": [circ[r] for r in r_prima],
        "gare_dopo": [circ[r] for r in r_dopo],
        "circuiti": circ,
        "n_squadre": len(matrice), "squadre_incomplete": incomplete,
        "alfa": ALFA, "perm_tot": tot_perm, "perm_esatta": esatto,
        "giro_tipo": round(giro_tipo, 3) if giro_tipo else None,
        "classifica": [
            {"team": t, "sviluppo": round(d["sviluppo"], 3),
             "guadagno": round(-d["sviluppo"], 3),
             "guadagno_ms": (round(-d["sviluppo"] / 100.0 * giro_tipo * 1000)
                             if giro_tipo else None),
             "p_famiglia": round(d["p_famiglia"], 4),
             "p_grezzo": round(d["p_grezzo"], 4), "sep": d["sep"],
             "passa": d["p_famiglia"] <= ALFA,
             "sforzo": (sf or {}).get(TEAM_FIA.get(t, ""), None),
             "serie": [round(v, 3) for v in matrice[t]]}
            for t, d in classifica],
        "n_passanti": len(passanti), "passanti": sorted(passanti),
        "con_separazione": sorted(t for t, d in per_squadra.items() if d["sep"]),
        # protagonista = la squadra col p di famiglia piu' basso
        "prot": protagonista, "prot_corto": nm(protagonista),
        "prot_sviluppo": round(d_prot["sviluppo"], 3),
        "prot_guadagno": round(-d_prot["sviluppo"], 3),
        "prot_verso": "guadagnato" if guadagna else "perso",
        "prot_p_famiglia": round(d_prot["p_famiglia"], 4),
        "prot_p_grezzo": round(d_prot["p_grezzo"], 4),
        "prot_sep": d_prot["sep"],
        "prot_ms": (round(abs(d_prot["sviluppo"]) / 100.0 * giro_tipo * 1000)
                    if giro_tipo else None),
        "prot_serie": [(r, round(v, 3)) for r, v in zip(rounds, matrice[protagonista])],
        "prot_rel_prima": round(st.mean(matrice[protagonista][:k]), 3),
        "prot_rel_dopo": round(st.mean(matrice[protagonista][k:]), 3),
        "prot_ultima": round(matrice[protagonista][-1], 3),
        "prot_ultima_gara": circ[rounds[-1]],
        "prot_passo": (round(passo[protagonista]["sviluppo"], 3)
                       if protagonista in passo else None),
        "prot_passo_n": (f"{passo[protagonista]['n_prima']}+{passo[protagonista]['n_dopo']}"
                         if protagonista in passo else None),
        "prot_cieco_round": cieco.get(protagonista, {}).get("round"),
        "prot_cieco_max": (round(cieco[protagonista]["sviluppo"], 3)
                           if protagonista in cieco else None),
        "taglio_round": r_dopo[0],
        # --- braccio FIA ---
        "cp_letti": diag_cp["letti"], "cp_esclusi": diag_cp["esclusi"],
        "cp_non_mappati": diag_cp["non_mappati"], "cp_cartella": diag_cp["cartella"],
        "cp_n": len(per_round),
        "sforzo": sf, "sforzo_grezzo": sf_grezzo, "coppie": coppie,
        "fam_tot": fam_tot,
        "fam_sviluppo": fam_tot.get(FAMIGLIA_SVILUPPO, 0),
        "fam_circuito": fam_tot.get("Circuit specific", 0),
        "rho": round(rho, 3) if rho is not None else None,
        "rho_p": round(p_rho, 4) if p_rho is not None else None,
        "rho_alt": round(rho_alt, 3) if rho_alt is not None else None,
        "rho_alt_p": round(p_rho_alt, 4) if p_rho_alt is not None else None,
        "rho_regge": (p_rho is not None and p_rho <= ALFA),
        "rho_regge_alt": (p_rho_alt is not None and p_rho_alt <= ALFA),
    }
    # La squadra che meglio mostra quanto costa la correzione: p grezzo sotto soglia
    # (da sola sembrerebbe un caso) ma p di famiglia sopra (fra undici, non lo e').
    candidati = [c for c in F["classifica"]
                 if c["p_grezzo"] <= ALFA and c["p_famiglia"] > ALFA]
    if candidati:
        F["esempio_scarto"] = min(candidati, key=lambda c: c["p_grezzo"])

    if F["sforzo"]:
        ordinati = sorted(F["sforzo"].items(), key=lambda kv: -kv[1])
        F["sforzo_max"] = ordinati[0]
        F["sforzo_min"] = ordinati[-1]
        F["prot_sforzo"] = F["sforzo"].get(TEAM_FIA.get(protagonista, ""))
        F["prot_sforzo_rango"] = 1 + [t for t, _ in ordinati].index(TEAM_FIA[protagonista])
    return F


# ---------------------------------------------------------------------------
# GRAFICI
# ---------------------------------------------------------------------------
def _grafico_classifica(F):
    """GRAFICO-EROE: chi ha guadagnato e chi ha perso terreno sul gruppo, in % di giro.
    Barre divergenti da uno zero che e' il gruppo stesso: a destra chi si e' avvicinato
    al centro dello schieramento piu' della media, a sinistra chi e' scivolato."""
    righe = []
    for c in F["classifica"]:
        # Il valore della barra e' in MILLESIMI su un giro-tipo: la grandezza vera e'
        # normalizzata (% di giro) e su una barra si leggerebbe "+0" per tutti.
        nota = f"{it(c['guadagno'], 2)}% · p {it(c['p_famiglia'], 3)}"
        if c["passa"]:
            nota += " ★"
        righe.append({"label": nm(c["team"]),
                      "valore": c["guadagno_ms"] if c["guadagno_ms"] is not None
                      else c["guadagno"], "nota": nota})
    return svg.barre_divergenti(
        righe, col_pos="#3fb2e8", col_neg="#e8613a",
        lbl_pos="terreno guadagnato sul gruppo", lbl_neg="terreno perso", ml=92,
        titolo=f"Chi si e' mosso rispetto al gruppo, {F['anno']}",
        sub=f"round {F['rounds_prima'][0]}–{F['rounds_prima'][-1]} vs "
            f"{F['rounds_dopo'][0]}–{F['rounds_dopo'][-1]}",
        unita="millesimi",
        caption=(f"qualifica, distanza dalla MEDIANA del campo · millesimi su un giro-tipo "
                 f"di {it(F['giro_tipo'], 1)} s · ★ = regge il conto su {F['n_squadre']} "
                 f"squadre"))


def _grafico_prot(F):
    """La serie del protagonista gara per gara, contro lo zero (= mediana del campo).
    Si vede se il movimento e' un gradino o una deriva, e dove sta l'ultima gara."""
    pr = [(r, v) for r, v in F["prot_serie"]]
    rmin, rmax = pr[0][0], pr[-1][0]
    vals = [v for _, v in pr]
    lo = min(0.0, min(vals)) - 0.4
    hi = max(0.0, max(vals)) + 0.4
    # Tre serie e non quattro: la mediana del campo e' gia' lo zero dell'asse, e una
    # legenda in piu' non ci sta in larghezza.
    serie = [
        {"sigla": F["prot_corto"], "colore": F["prot_colore"], "punti": pr},
        {"sigla": "media blocco A", "colore": "var(--dim)",
         "punti": [(rmin, F["prot_rel_prima"]),
                   (F["taglio_round"] - 0.001, F["prot_rel_prima"])]},
        # Non var(--accent): sui team verdi la media si confonderebbe con la squadra.
        {"sigla": "media blocco B", "colore": "var(--txt)",
         "punti": [(F["taglio_round"], F["prot_rel_dopo"]), (rmax, F["prot_rel_dopo"])]},
    ]
    passo = 0.5 if (hi - lo) < 4 else 1.0
    ticks = []
    v = math.ceil(lo / passo) * passo          # mai un tick fuori dall'asse
    while v <= hi:
        ticks.append(round(v, 1))
        v += passo
    return svg.grafico_xy(
        serie, x_range=(rmin, rmax), y_range=(lo, hi),
        x_ticks=[r for r, _ in pr], y_ticks=ticks,
        x_label=f"round del mondiale {F['anno']} (numero di gara)",
        y_label="% di giro",
        x_annota=F["taglio_round"], annota_txt=f"taglio: round {F['taglio_round']}",
        titolo=f"{F['prot_corto']} contro il centro dello schieramento, gara per gara",
        sub=f"blocco A {it(F['prot_rel_prima'], 2)}% → blocco B {it(F['prot_rel_dopo'], 2)}% · "
            f"zero = mediana del campo · sopra lo zero = piu' lento")


def _grafico_sforzo(F, colori):
    """Sforzo dichiarato (FIA) contro sviluppo misurato: 11 punti, una squadra ciascuno.
    E' il confronto onesto fra quello che le squadre HANNO PORTATO e quello che si vede
    nel cronometro. Non e' una prova di causa: il conteggio dei pezzi non e' la taglia."""
    punti = [{"label": nm(c["team"]), "colore": colori.get(c["team"]) or "var(--dim)",
              "x": c["sforzo"], "y": c["guadagno"],
              "evidenza": c["team"] == F["prot"]} for c in F["coppie"]]
    xs = [p["x"] for p in punti]
    ys = [p["y"] for p in punti]
    passo_x = 5 if max(xs) <= 30 else 10
    xhi = int(math.ceil((max(xs) + 1) / passo_x) * passo_x)
    ylo = math.floor(min(ys) * 2) / 2 - 0.3
    yhi = math.ceil(max(ys) * 2) / 2 + 0.3
    xt = list(range(0, xhi + 1, passo_x))
    yt = []
    v = ylo
    while v <= yhi + 1e-9:
        yt.append(round(v, 1))
        v += 0.5
    return svg.grafico_scatter(
        punti, x_range=(0, xhi), y_range=(ylo, yhi), x_ticks=xt, y_ticks=yt,
        cx=round(st.median(xs), 1), cy=0,
        x_label="componenti «Performance» portati, pesati per la finestra (→ piu' sforzo)",
        y_label="terreno guadagnato sul gruppo (% di giro)",
        titolo="Chi ha portato di piu' ha guadagnato di piu'?",
        sub=f"{len(punti)} squadre · rho di Spearman {it(F['rho'], 2)} "
            f"(p {it(F['rho_p'], 3)}) · fonte pezzi: FIA Car Presentation Submissions",
        ang=("molti pezzi, terreno perso", "molti pezzi, terreno guadagnato",
             "pochi pezzi, terreno guadagnato", "pochi pezzi, terreno perso"))


# ---------------------------------------------------------------------------
# COSTRUZIONE ARTICOLO
# ---------------------------------------------------------------------------
def costruisci(data_bozza=None, cartella_cp=None, da=None, a=None, anno=ANNO):
    F = _misura(cartella_cp=cartella_cp, da=da, a=a, anno=anno)
    if not F:
        return None
    colori = base.carica_colori()
    F["prot_colore"] = colori.get(F["prot"]) or "var(--dim)"
    return _componi(F, colori, data_bozza)


def _componi(F, colori, data_bozza=None):
    ID = f"sviluppo-relativo-{F['anno']}"
    prot = F["prot_corto"]
    A = f"round {F['rounds_prima'][0]}–{F['rounds_prima'][-1]}"
    B = f"round {F['rounds_dopo'][0]}–{F['rounds_dopo'][-1]}"
    verso = F["prot_verso"]
    quanto = it(abs(F["prot_sviluppo"]), 2)
    migliori = [c for c in F["classifica"] if c["guadagno"] > 0][:3]
    peggiori = [c for c in F["classifica"] if c["guadagno"] < 0][-3:]

    def elenco(cs):
        return ", ".join(f"{nm(c['team'])} {it(c['guadagno'], 2)}%" for c in cs)

    # --- Evidenza 1: la classifica dello sviluppo relativo ------------------
    ev1 = (
        f"<p>La domanda non e' “l'aggiornamento di questa squadra ha funzionato”: e' "
        f"<b>chi si e' mosso rispetto al gruppo</b>. Per ogni gara misuriamo dove sta "
        f"ciascuna squadra in qualifica rispetto alla <b>mediana dello schieramento</b>, "
        f"in percentuale di giro — cosi' il numero e' confrontabile fra circuiti diversi "
        f"e non dipende da quanto e' scappato il primo. Poi confrontiamo due blocchi di "
        f"gare: <b>{A}</b> ({F['n_prima']} gare) contro <b>{B}</b> ({F['n_dopo']} gare), "
        f"tagliando a meta' le {F['n_gare']} gare disponibili.</p>"
        f"<p>Chi ha guadagnato terreno: {elenco(migliori)}. Chi lo ha perso: "
        f"{elenco(peggiori)}. Sono numeri piccoli perche' sono <b>relativi</b>: se in "
        f"quelle gare hanno migliorato tutti allo stesso modo, qui non si muove nessuno. "
        f"E' il limite della grandezza, ed e' voluto — il progresso assoluto dello "
        f"schieramento con questi dati non e' separabile dall'evoluzione della pista, "
        f"delle gomme e del carburante.</p>"
    )
    ev1 += (
        f"<p>Guardando {F['n_squadre']} squadre insieme, qualcosa di vistoso salta fuori "
        f"per caso: e' quasi certo. Percio' il conto non e' squadra per squadra. Si "
        f"rimescolano le etichette delle gare fra i due blocchi "
        f"({'tutte le ' if F['perm_esatta'] else ''}{F['perm_tot']} "
        f"{'divisioni possibili' if F['perm_esatta'] else 'divisioni estratte'}) e ogni "
        f"volta si prende il <b>movimento piu' grande dell'intero gruppo</b>: una squadra "
        f"conta come separata solo se batte quel massimo. "
        + (f"Ne resta <b>una</b>: {prot}."
           if F["n_passanti"] == 1 else
           f"Ne restano <b>{F['n_passanti']}</b>: {', '.join(nm(t) for t in F['passanti'])}.")
        + f" {prot} ha {verso} <b>{quanto}% di giro</b> sul gruppo, con "
          f"p {it(F['prot_p_famiglia'], 3)}."
        + (f" Per dare una scala a un numero normalizzato: su un giro-tipo di "
           f"{it(F['giro_tipo'], 1)} s — la mediana dei tempi di riferimento della "
           f"finestra — {quanto}% sono circa <b>{_scala(F['prot_ms'])}</b>. E' un metro "
           f"nominale, serve solo a capire l'ordine di grandezza: le piste sono diverse."
           if F.get("prot_ms") else "")
        + "</p>"
    )
    if F.get("esempio_scarto"):
        e = F["esempio_scarto"]
        ev1 += (
            f"<p>Quanto pesa quella correzione si vede bene su {nm(e['team'])}: presa da "
            f"sola avrebbe p {it(e['p_grezzo'], 3)}, cioe' sembrerebbe un caso solido; "
            f"messa in fila con le altre {F['n_squadre'] - 1} sale a "
            f"{it(e['p_famiglia'], 3)}. Non e' un cavillo: e' la differenza fra “questa "
            f"squadra si e' mossa” e “fra undici squadre, una si e' mossa tanto cosi'”, e "
            f"la seconda succede quasi sempre anche quando non e' successo niente.</p>"
        )
    if not F["con_separazione"]:
        ev1 += (
            f"<p>Un limite da mettere subito: <b>nessuna squadra</b>, nemmeno {prot}, ha "
            f"la separazione di rango completa — cioe' non esiste una squadra le cui gare "
            f"del blocco B stiano <i>tutte</i> oltre <i>tutte</i> quelle del blocco A. "
            f"Quello che si misura e' uno spostamento della media, non un gradino netto. "
            f"Con {F['n_prima']} e {F['n_dopo']} gare per blocco e' quanto i dati "
            f"consentono di dire.</p>"
        )

    # --- Evidenza 2: il protagonista gara per gara --------------------------
    ev2 = (
        f"<p>Vista gara per gara, la storia di {prot} e' questa: "
        f"<b>{it(F['prot_rel_prima'], 2)}%</b> di media dalla mediana del campo nel blocco "
        f"A, <b>{it(F['prot_rel_dopo'], 2)}%</b> nel blocco B. Nell'ultima gara letta "
        f"({F['prot_ultima_gara']}) il valore e' <b>{it(F['prot_ultima'], 2)}%</b>.</p>"
    )
    if F["prot_passo"] is not None:
        concorde = (F["prot_passo"] * F["prot_sviluppo"]) > 0
        gp_passo = -F["prot_passo"]
        ev2 += (
            f"<p>Il passo gara, tenuto come corroborazione e non come prova, "
            + (f"dice la stessa cosa: {it(abs(gp_passo), 2)}% di terreno "
               f"{'guadagnato' if gp_passo > 0 else 'perso'} sul gruppo"
               if concorde else
               f"<b>non conferma</b>: va nella direzione opposta "
               f"({it(abs(gp_passo), 2)}% di terreno "
               f"{'guadagnato' if gp_passo > 0 else 'perso'})")
            + f" su {F['prot_passo_n']} gare utilizzabili. Lo teniamo un gradino sotto "
              f"perche' il passo di una gara e' inquinato dal traffico — una macchina "
              f"bloccata dietro un'altra non ha un passo leggibile — e nel 2026 manca del "
              f"tutto per qualche squadra in qualche gara. "
            + ("Il disaccordo fra i due canali e' un limite dichiarato, non una nota a "
               "pie' di pagina: il movimento che misuriamo si vede sul giro secco e non "
               "sul ritmo di gara."
               if not concorde else
               "Due canali diversi che si muovono insieme sono un indizio in piu'.")
            + "</p>"
        )
    if F["prot_cieco_round"] is not None:
        coincide = F["prot_cieco_round"] == F["taglio_round"]
        ev2 += (
            f"<p>Il taglio a meta' stagione non l'abbiamo scelto guardando i risultati: e' "
            f"una regola fissa, e si sposta da sola a ogni gara nuova. Va detto pero' che "
            + (f"<b>coincide</b> con il punto in cui il movimento di {prot} e' massimo "
               f"({it(abs(F['prot_cieco_max']), 2)}%): una coincidenza del calendario, che "
               f"rende questo numero il piu' generoso possibile per {prot}. La prossima "
               f"gara spostera' il taglio e rifara' il conto."
               if coincide else
               f"il punto di massimo movimento di {prot} sarebbe il round "
               f"{F['prot_cieco_round']} ({it(abs(F['prot_cieco_max']), 2)}%), non il "
               f"nostro: il taglio fisso non e' quello che favorisce la squadra.")
            + "</p>"
        )

    # --- Evidenza 3: lo sforzo dichiarato (FIA) -----------------------------
    ev3 = None
    if F.get("coppie"):
        sm, sM = F["sforzo_min"], F["sforzo_max"]
        letti = ", ".join(str(x["round"]) for x in F["cp_letti"])
        ev3 = (
            f"<p>Fin qui il cronometro. C'e' pero' una seconda fonte, indipendente e "
            f"ufficiale: il documento FIA <i>Car Presentation Submissions</i>, pubblicato "
            f"il venerdi' di ogni Gran Premio, che elenca squadra per squadra i componenti "
            f"aggiornati portati in pista. Da li' si conta lo <b>sforzo dichiarato</b>. "
            f"Abbiamo letto {F['cp_n']} documenti {F['anno']} (round {letti}), per un "
            f"totale di {sum(F['fam_tot'].values())} componenti.</p>"
            f"<p>Due precisazioni prima dei numeri. Primo: contano solo le voci con motivo "
            f"<b>“Performance”</b> ({F['fam_sviluppo']} su {sum(F['fam_tot'].values())}); "
            f"le {F['fam_circuito']} voci <b>“Circuit specific”</b> restano fuori, perche' "
            f"sono configurazione per quel tracciato — ala scarica a Monza, carico a "
            f"Monaco — e non sviluppo della macchina. Secondo: un pezzo portato all'ultima "
            f"gara della finestra non puo' spiegare la media della finestra, quindi ogni "
            f"componente pesa per quante gare del blocco B lo hanno avuto addosso <i>in "
            f"piu'</i> rispetto al blocco A. Cosi' pesato, il piu' attivo e' "
            f"<b>{nm(sM[0])}</b> ({it(sM[1], 1)}), il meno attivo <b>{nm(sm[0])}</b> "
            f"({it(sm[1], 1)}).</p>"
        )
        if F.get("prot_sforzo") is not None:
            ev3 += (
                f"<p>E {prot}? E' <b>{F['prot_sforzo_rango']}ª su "
                f"{len(F['sforzo'])}</b> per sforzo dichiarato ({it(F['prot_sforzo'], 1)}): "
                f"il conto del cronometro e quello dei pezzi raccontano la stessa cosa.</p>"
            )
        ev3 += (
            f"<p>Sull'intero gruppo la relazione fra sforzo dichiarato e terreno guadagnato "
            f"c'e' e ha il segno che ci si aspetta (rho di Spearman "
            f"<b>{it(F['rho'], 2)}</b>, p {it(F['rho_p'], 3)}), ma non e' un risultato su "
            f"cui appoggiarsi: <b>e' fragile</b>. Le squadre sono "
            f"{len(F['coppie'])} — con cosi' pochi punti serve un legame quasi perfetto per "
            f"uscire dal caso — e contando i pezzi in un altro modo altrettanto "
            f"difendibile (numero grezzo di componenti portati nel blocco B, senza pesarli) "
            f"il legame scende a rho {it(F['rho_alt'], 2)} con p {it(F['rho_alt_p'], 3)}"
            + (", cioe' sparisce" if not F["rho_regge_alt"] else "") +
            f". Lo registriamo come indicazione, non come misura: chi porta piu' pezzi "
            f"<i>tende</i> a guadagnare terreno, ma i nostri dati non lo stabiliscono.</p>"
        )

    # --- Causa --------------------------------------------------------------
    causa = (
        f"<p>Quello che sta sopra e' un <b>effetto</b>, non una causa. Il documento FIA "
        f"dice quali componenti sono arrivati e perche' (in categoria), e il cronometro "
        f"dice dove sta la macchina rispetto al gruppo. Fra le due cose non c'e' un ponte "
        f"che si possa attraversare con questi dati, e i motivi sono tre, tutti nella "
        f"fonte.</p>"
        f"<p>Primo: il documento <b>non dice mai su quale vettura</b> vada il pezzo — non "
        f"compare nemmeno una volta un riferimento al numero di macchina o al pilota. "
        f"Secondo: non contiene <b>nessun numero di prestazione</b>, quindi il conteggio "
        f"dei pezzi non e' la taglia dell'aggiornamento: un fondo nuovo e una staffa di "
        f"scarico contano uno a testa. Terzo: alcune voci sono dichiarate "
        f"“disponibili” o “opzionali”, cioe' <b>portate ma non per forza montate</b>.</p>"
        f"<p>Aggiungiamo il difetto piu' grosso, che non e' della fonte ma della domanda "
        f"vecchia: le squadre aggiornano <b>quasi ogni gara</b>. Non esiste un blocco di "
        f"gare “senza aggiornamenti” da usare come termine di paragone. Percio' qui non "
        f"si dira' mai che un singolo pacchetto ha funzionato: si dira' solo se, fra due "
        f"blocchi di gare, una squadra si e' mossa rispetto alle altre. Attribuire quel "
        f"movimento a un pezzo — o distinguerlo da un cambio di assetto, da una pista che "
        f"si adatta meglio alla macchina o da un pilota in forma — resta fuori portata.</p>"
    )

    # --- Effetto ------------------------------------------------------------
    eff = (
        f"<p><b>Cosa possiamo dire.</b> Fra {A} e {B}, "
        + (f"una sola squadra si stacca dal gruppo in modo che regga al conto corretto: "
           f"{prot}, che ha {verso} {quanto}% di giro."
           if F["n_passanti"] == 1 else
           f"{F['n_passanti']} squadre si staccano dal gruppo: "
           f"{', '.join(nm(t) for t in F['passanti'])}.")
        + f" Tutte le altre stanno dentro il rumore: i loro spostamenti sono compatibili "
          f"con un rimescolamento casuale delle gare.</p>"
        f"<p><b>Cosa non possiamo dire.</b> Nulla su un singolo aggiornamento, di nessuna "
        f"squadra. Nulla sul progresso assoluto: la grandezza e' relativa, e se migliorano "
        f"tutti resta ferma. E nulla sul perche': la causa e' fuori dai nostri canali.</p>"
        f"<p>Questo pezzo non e' un verdetto, e' un <b>tracciato</b>: si riscrive dopo ogni "
        f"gara, il taglio si sposta, e le squadre che oggi stanno dentro il rumore possono "
        f"uscirne — o {prot} puo' rientrarci. Il modo giusto di leggerlo e' guardare come "
        f"cambia, non quanto vale oggi.</p>"
    )

    sommario = (
        f"Le squadre di Formula 1 aggiornano la macchina quasi ogni gara, quindi non "
        f"esiste un “prima senza aggiornamenti” con cui confrontarsi: chiedere se un "
        f"singolo pacchetto ha funzionato e' una domanda senza risposta. Quella che una "
        f"risposta ce l'ha e' un'altra: fra {A} e {B}, chi si e' mosso rispetto al gruppo? "
        + (f"Una squadra sola esce dal rumore quando si tiene conto che stiamo guardando "
           f"{F['n_squadre']} squadre insieme: {prot}, che ha {verso} {quanto}% di giro "
           f"sulla mediana dello schieramento."
           if F["n_passanti"] == 1 else
           f"{F['n_passanti']} squadre escono dal rumore: "
           f"{', '.join(nm(t) for t in F['passanti'])}.")
        + (f" Accanto al cronometro mettiamo lo sforzo dichiarato alla FIA — i componenti "
           f"aggiornati che ogni squadra ha davvero portato — e la domanda scomoda: chi ha "
           f"portato di piu' ha guadagnato di piu'? Un po' si', ma il legame e' troppo "
           f"fragile per chiamarlo misura." if F.get("coppie") else "")
    )

    sezioni = [
        {"tag": "Evidenza", "titolo": "Chi si e' mosso rispetto al gruppo", "html": ev1,
         "figura": "classifica"},
        {"tag": "Evidenza", "titolo": f"{prot}, gara per gara", "html": ev2,
         "figura": "prot"},
    ]
    if ev3:
        sezioni.append({"tag": "Evidenza",
                        "titolo": "Quanti pezzi ha portato davvero ognuno",
                        "html": ev3, "figura": "sforzo"})
    sezioni.append({"tag": "Causa", "titolo": "Perche' non diremo mai “questo pezzo ha "
                                             "funzionato”", "html": causa})
    sezioni.append({"tag": "Effetto", "titolo": "Cosa resta in mano", "html": eff})

    prov = [
        {"grandezza": "sviluppo relativo in qualifica, per squadra (blocco A → blocco B)",
         "valore": "; ".join(f"{nm(c['team'])} {it(c['guadagno'], 2)}%"
                             for c in F["classifica"]),
         "stato": "MISURATO",
         "da": "forza_stagione/*.json — potenziale = miglior giro di qualifica per squadra; "
               "posizione relativa = % dalla MEDIANA del campo di quella gara; sviluppo = "
               "media(blocco B) − media(blocco A)"},
        {"grandezza": f"cancello statistico (p corretto per la famiglia di {F['n_squadre']} squadre)",
         "valore": (f"{F['prot_corto']} p {it(F['prot_p_famiglia'], 3)} (grezzo "
                    f"{it(F['prot_p_grezzo'], 3)}) · soglia {it(F['alfa'], 2)} · "
                    f"{F['perm_tot']} divisioni "
                    f"{'enumerate tutte' if F['perm_esatta'] else 'estratte'} · "
                    f"squadre che passano: {F['n_passanti']}"),
         "stato": "MISURATO",
         "da": "permutazione max-T: si rimescolano le etichette gara una volta per replica "
               "e si prende il massimo |sviluppo| su tutte le squadre (controlla il tasso "
               "d'errore d'insieme e conserva la dipendenza fra squadre)"},
        {"grandezza": "separazione di rango completa (ogni gara di B oltre ogni gara di A)",
         "valore": (", ".join(nm(t) for t in F["con_separazione"])
                    if F["con_separazione"] else "nessuna squadra"),
         "stato": "MISURATO",
         "da": "confronto min/max fra i due blocchi, squadra per squadra"},
    ]
    if F.get("coppie"):
        prov.append(
            {"grandezza": "sforzo dichiarato: componenti «Performance» pesati per la finestra",
             "valore": "; ".join(f"{nm(t)} {it(v, 1)}" for t, v in
                                 sorted(F["sforzo"].items(), key=lambda kv: -kv[1])),
             "stato": "MISURATO",
             "da": f"FIA Car Presentation Submissions, {F['cp_n']} documenti {F['anno']} letti "
                   f"con ai_lab/redazione/fia_cp.py (cancello identita' + cancello qualita'); "
                   f"escluse le {F['fam_circuito']} voci «Circuit specific»; peso = "
                   f"esposizione differenziale del pezzo fra i due blocchi"})
        prov.append(
            {"grandezza": "legame fra sforzo dichiarato e terreno guadagnato",
             "valore": (f"rho di Spearman {it(F['rho'], 2)} (p {it(F['rho_p'], 3)}, "
                        f"permutazione) su {len(F['coppie'])} squadre; conteggio grezzo "
                        f"alternativo: rho {it(F['rho_alt'], 2)} (p {it(F['rho_alt_p'], 3)}) "
                        f"— la relazione NON regge al cambio di conteggio"),
             "stato": "MISURATO",
             "da": "correlazione di rango fra le due colonne + test di permutazione; "
                   "11 squadre = potenza minima, il risultato e' un'indicazione"})
    if F.get("cp_esclusi"):
        prov.append(
            {"grandezza": "documenti FIA esclusi dal conteggio",
             "valore": "; ".join(F["cp_esclusi"]),
             "stato": "NON_MISURABILE",
             "da": "fia_cp.cancello_qualita / cancello_identita: un documento da cui si e' "
                   "persa una riga non diventa uno zero, diventa una gara esclusa"})
    prov += [
        {"grandezza": "su quale vettura e quale pilota va ogni componente",
         "valore": "la fonte non lo dice mai (zero riferimenti a vettura o pilota nei "
                   f"documenti {F['anno']})",
         "stato": "NON_MISURABILE", "da": "FIA Car Presentation Submissions"},
        {"grandezza": "taglia in prestazione di un aggiornamento",
         "valore": "la fonte non contiene numeri di prestazione: il CONTEGGIO dei pezzi "
                   "non e' la grandezza dell'upgrade, e alcune voci sono solo "
                   "«available»/«optional» (portate, non per forza montate)",
         "stato": "NON_MISURABILE", "da": "FIA Car Presentation Submissions"},
        {"grandezza": "causa del movimento di una squadra (quale pezzo, o se e' un pezzo)",
         "valore": "non identificabile: le squadre aggiornano quasi ogni gara, quindi manca "
                   "il termine di paragone senza aggiornamenti; assetto, evoluzione della "
                   "pista e forma dei piloti non si separano dal contributo dei componenti",
         "stato": "NON_MISURABILE",
         "da": "nessun canale isola il singolo pezzo — vedi la sezione Causa"},
    ]
    if F["prot_passo"] is not None:
        prov.insert(3, {
            "grandezza": f"corroborazione sul passo gara ({F['prot_corto']})",
            "valore": f"{it(-F['prot_passo'], 2)}% di terreno sul gruppo "
                      f"({F['prot_passo_n']} gare utilizzabili)",
            "stato": "MISURATO",
            "da": "forza_stagione/*.json (passo = mediana in aria pulita), stessa posizione "
                  "relativa alla mediana del campo · CANALE SECONDARIO: il passo di gara e' "
                  "inquinato dal traffico e nel 2026 manca per alcune squadre"})

    art = {
        "id": ID, "stato": "bozza",
        "data": data_bozza or datetime.date.today().isoformat(),
        "firma": "Muretto · Redazione tecnica", "accent": F["prot_colore"],
        "canale": "B (anomalia nei nostri dati) + fonte ufficiale FIA",
        # articolo TRASVERSALE: gp/round assenti -> finisce in "Valgono tutta la stagione"
        "gp": None, "round": None,
        "gara": f"Stagione {F['anno']}", "circuito": f"{F['n_gare']} gare",
        "sessione": "Gara",
        "tag": ["sviluppo", "aggiornamenti", "multi-gara", "qualifica", "FIA"],
        "occhiello": f"Sviluppo relativo {F['anno']} · {A} vs {B}",
        "titolo": "Chi ha sviluppato meglio del gruppo (e perche' non chiediamo se "
                  "«l'upgrade ha funzionato»)",
        "sommario": sommario,
        "sezioni": sezioni,
        "provenienza": prov,
        "fonti": ([
            {"tipo": "fonte ufficiale",
             "testo": f"FIA — «Car Presentation Submissions», {F['cp_n']} documenti "
                      f"{F['anno']} (elenco per squadra dei componenti aggiornati, "
                      f"pubblicato il venerdi' di gara). Letti con "
                      f"ai_lab/redazione/fia_cp.py."}]
            if F["cp_n"] else []) + [
            {"tipo": "dati",
             "testo": f"FastF1 3.8.3 — qualifica e gara di {F['n_gare']} GP {F['anno']}; "
                      f"potenziale = miglior giro di qualifica (squadra = migliore dei due "
                      f"piloti), passo = mediana dei giri in aria pulita"},
            {"tipo": "metodo",
             "testo": "ai_lab/redazione/genera_upgrade.py — posizione relativa alla mediana "
                      "del campo per gara; due blocchi di gare tagliati a meta' per regola "
                      "fissa; permutazione max-T sull'intera famiglia di squadre; "
                      "correlazione di rango con lo sforzo dichiarato alla FIA"},
        ],
    }

    FIG = {
        "classifica": {
            "svg": _grafico_classifica(F),
            "didascalia": (
                f"Quanto ha guadagnato o perso ogni squadra rispetto alla mediana dello "
                f"schieramento in qualifica, fra {A} e {B}. La barra e' in millesimi su un "
                f"giro-tipo di {it(F['giro_tipo'], 1)} s (metro nominale, per dare la "
                f"scala); il valore esatto, in percentuale di giro, e' a destra insieme al "
                f"p. Lo zero e' il gruppo: chi non si muove non e' fermo, e' fermo "
                f"<i>rispetto agli altri</i>. La stella marca l'unica squadra che regge il "
                f"conto corretto per le {F['n_squadre']} squadre guardate insieme."),
            "fonte": "forza_stagione (FastF1) + FIA Car Presentation Submissions, "
                     "elaborazione redazione"},
        "prot": {
            "svg": _grafico_prot(F),
            "didascalia": (
                f"{prot} contro il centro dello schieramento, round per round: sopra lo zero "
                f"= piu' lento della mediana del campo. La verticale marca il taglio fra i "
                f"due blocchi; le linee piatte sono le due medie. Si vede se il movimento e' "
                f"un gradino o una deriva — e dove sta l'ultima gara."),
            "fonte": "forza_stagione (FastF1), elaborazione redazione"},
    }
    if F.get("coppie"):
        FIG["sforzo"] = {
            "svg": _grafico_sforzo(F, colori),
            "didascalia": (
                f"Ogni punto e' una squadra: in orizzontale i componenti «Performance» "
                f"dichiarati alla FIA (pesati per quante gare del blocco B li hanno avuti "
                f"addosso in piu' rispetto al blocco A), in verticale il terreno guadagnato "
                f"sul gruppo. La pendenza c'e' ({it(F['rho'], 2)} di rho), ma con "
                f"{len(F['coppie'])} punti e un conteggio che si puo' fare in piu' modi non "
                f"e' una misura: e' un'indicazione."),
            "fonte": "FIA Car Presentation Submissions + forza_stagione (FastF1), "
                     "elaborazione redazione"}
    for sez in art["sezioni"]:
        if sez.get("figura") in FIG:
            sez["figura"] = FIG[sez["figura"]]
        elif "figura" in sez:
            del sez["figura"]

    F["id"] = ID
    return F, art


META = {
    "id": ID_META, "canale": "B + fonte ufficiale FIA",
    "titolo": "Sviluppo relativo: chi ha sviluppato meglio (o peggio) del gruppo",
    "tag": ["sviluppo", "aggiornamenti", "multi-gara", "FIA"],
    "descrizione": "fra due blocchi di gare, quali squadre si sono mosse rispetto al "
                   "gruppo; accanto, i componenti che ognuna ha davvero portato secondo "
                   "il documento FIA. Mai un verdetto su un singolo pacchetto: la causa "
                   "resta NON_MISURABILE",
    "richiede": "forza_stagione multi-gara (+ cache FIA Car Presentation Submissions)",
    # NON ['*']: matcherebbe anche il giro post-gara. L'articolo e' trasversale e si
    # riaggiorna dopo ogni gara, quindi resta in rotazione sulla sessione di gara.
    "gare": ["*"], "sessioni": ["Race"],
}


def genera(gara=None, data=None, sessione=None):
    """Ritorna None (senza sollevare) quando i cancelli non passano: la redazione non
    deve mai fermarsi per un articolo che non c'e'."""
    try:
        r = costruisci(data_bozza=data)
    except Exception as e:                      # nessun generatore puo' far cadere il giro
        print(f"genera_upgrade: rinuncio ({e})", file=sys.stderr)
        return None
    if not r:
        return None
    F, art = r
    base.scrivi_bozza(F["id"], art, F)
    return {"id": F["id"], "titolo": art["titolo"], "stato": art["stato"],
            "canale": art["canale"]}


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(
        description="Sviluppo relativo: chi si e' mosso rispetto al gruppo fra due "
                    "blocchi di gare")
    ap.add_argument("--data", default=None,
                    help="data della bozza (ISO, es. 2026-07-27); default = oggi. "
                         "Usare per NON stampare la data all'orologio d'ambiente.")
    ap.add_argument("--cp", default=None,
                    help=f"cartella con i PDF FIA Car Presentation (default: {CARTELLA_CP})")
    ap.add_argument("--da", type=int, default=None, help="primo round del perimetro")
    ap.add_argument("--a", type=int, default=None, help="ultimo round del perimetro")
    ap.add_argument("--dry", action="store_true", help="non scrivere la bozza")
    args = ap.parse_args()

    r = costruisci(data_bozza=args.data, cartella_cp=args.cp, da=args.da, a=args.a)
    if not r:
        print("NULL: nessuna squadra si separa dal gruppo (o finestra troppo corta). "
              "Nessun articolo.")
        sys.exit()
    F, art = r
    if not args.dry:
        base.scrivi_bozza(F["id"], art, F)
        print(f"Bozza {F['id']} scritta (data {art['data']}).")
    print(f"  finestra: blocco A round {F['rounds_prima']} | blocco B round {F['rounds_dopo']}")
    print(f"  permutazione: {F['perm_tot']} divisioni "
          f"({'esatta' if F['perm_esatta'] else 'campionata'}), soglia {F['alfa']}")
    print(f"  {'squadra':16} {'sviluppo':>9} {'guadagno':>9} {'p_fam':>7} {'p_grez':>7} "
          f"{'sep':>5} {'sforzo':>7}")
    for c in F["classifica"]:
        sforzo = "-" if c["sforzo"] is None else f"{c['sforzo']:.1f}"
        print(f"  {nm(c['team']):16} {c['sviluppo']:+9.3f} {c['guadagno']:+9.3f} "
              f"{c['p_famiglia']:7.4f} {c['p_grezzo']:7.4f} {str(c['sep']):>5} "
              f"{sforzo:>7}" + ("   <-- passa" if c["passa"] else ""))
    print(f"  passano il cancello: {F['n_passanti']} ({', '.join(nm(t) for t in F['passanti'])})")
    print(f"  separazione di rango: {F['con_separazione'] or 'nessuna squadra'}")
    if F.get("coppie"):
        print(f"  FIA: {F['cp_n']} documenti letti, componenti per famiglia {F['fam_tot']}")
        if F["cp_esclusi"]:
            print(f"       esclusi: {F['cp_esclusi']}")
        print(f"  sforzo vs guadagno: rho {F['rho']} (p {F['rho_p']}) | "
              f"conteggio grezzo rho {F['rho_alt']} (p {F['rho_alt_p']})")
    else:
        print("  FIA: braccio sforzo ASSENTE (cache non trovata o troppo corta)")
