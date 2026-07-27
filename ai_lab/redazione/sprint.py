"""
sprint.py — i mattoni di misura comuni ai pezzi del WEEKEND SPRINT.

Un weekend sprint non ha FP2 ne' FP3: le uniche sessioni con giri veri prima della
qualifica sono la Sprint Qualifying ("SQ") e la Sprint ("S"). I generatori del
venerdi'/sabato nascono da qui, e queste sono le regole di misura che condividono.

Perche' un modulo a parte (e non tre copie):
 - la classificazione di un giro in ARIA SPORCA o ARIA LIBERA (gap alla macchina
   davanti nell'ordine di quel giro) e' identica per tutti i pezzi;
 - l'ancoraggio di una curva e' delicato e va fatto UNA volta bene: la distanza di
   circuit_info deriva dalla mappa GPS, mentre la Distance della telemetria vettura
   e' integrata dalla velocita' e DERIVA (misurato: fino a ~20 m su un giro di
   Miami). Qui la curva si ancora GIRO PER GIRO passando dal GPS: si cerca il
   campione di posizione piu' vicino alle coordinate della curva, si legge il suo
   istante, e si torna sulla telemetria a quell'istante. Niente terzo percentile
   "cieco": su una pista con curve sopraelevate o kink velocissimi il percentile
   misura un rettilineo e lo chiama curva;
 - la distinzione fra CURVA VERA e KINK: a Miami le curve 9 e 10 di circuit_info
   si percorrono a 317 e 326 km/h (Vmax mediana 331) — li' la scia AUMENTA la
   minima invece di ridurla, perche' quello e' rettilineo, non appoggio. Si tengono
   solo le curve con apice sotto una quota della Vmax di sessione;
 - lo STIMATORE a effetti fissi (una costante per pilota + una tendenza lineare sul
   numero di giro) e' lo stesso in tutti i pezzi: assorbe il livello del pilota e
   quello che cambia lungo la sessione (benzina, evoluzione pista), e lascia sul
   trattamento solo il confronto ENTRO pilota.

python3 UTENTE (fastf1 3.8.3 + numpy). Solo lettura: non tocca demo/, data/, engine/.
"""
from __future__ import annotations
import os
import sys
import math
import statistics as st
from collections import defaultdict

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele    # noqa: E402
import curve   # noqa: E402

# --- parametri di misura condivisi (dichiarati in provenienza dagli articoli) ---
SCIA_S = 1.0        # s: entro questo gap dalla macchina davanti = aria sporca
LIBERA_S = 2.0      # s: oltre questo gap (o in testa) = aria libera
LIBERA_SEQ_S = 1.5  # s: soglia piu' larga per le SEQUENZE di passo (B3)
QUOTA_LENTA = 0.70  # apice < 0,70 x Vmax di sessione = curva vera (non kink)
DIST_MIN_CURVE = 60.0   # m: curve piu' vicine di cosi' si fondono (chicane)
FIN_INDIETRO = 25.0     # m: finestra dell'apice, prima del riferimento
FIN_AVANTI = 75.0       # m: ... e dopo (il riferimento marca l'INIZIO curva)


def e_sprint(ses) -> bool:
    """Vero se l'evento e' un weekend con la sprint (EventFormat FastF1)."""
    try:
        return "sprint" in str(ses.event["EventFormat"]).lower()
    except Exception:
        return False


def gap_davanti(laps):
    """{(DriverNumber, LapNumber): gap in s dalla macchina davanti | None se in testa}.

    Dentro uno stesso LapNumber l'ordine per tempo-sessione coincide con l'ordine
    di corsa: il gap e' la differenza col precedente. Stessa regola di
    genera_passo_reale.py (nessuna fonte esterna)."""
    per_giro = defaultdict(list)
    for _, lap in laps.iterrows():
        t = tele.secondi(lap["Time"])
        if t is None:
            continue
        per_giro[int(lap["LapNumber"])].append((t, lap["DriverNumber"]))
    out = {}
    for ln, arr in per_giro.items():
        arr.sort()
        for i, (t, num) in enumerate(arr):
            out[(num, ln)] = None if i == 0 else (t - arr[i - 1][0])
    return out


def giri_puliti(ses, scarta_primo=True):
    """{DriverNumber: [riga...]} dei giri utilizzabili, gia' filtrati.

    Un giro entra se: TrackStatus verde puro ("1"), non e' out-lap ne' in-lap, non
    e' cancellato, ha un LapTime valido. Di ogni stint si scarta il PRIMO giro
    (gomma fredda). Ogni riga porta: ln, sec, gap, mescola, stint, eta_gomma, lap.
    """
    laps = ses.laps
    gap = gap_davanti(laps)
    out = {}
    for num in ses.drivers:
        dl = laps.pick_drivers(num).sort_values("LapNumber")
        stints = defaultdict(list)
        for _, lap in dl.iterrows():
            if lap["PitOutTime"] == lap["PitOutTime"]:      # out-lap
                continue
            if lap["PitInTime"] == lap["PitInTime"]:        # in-lap
                continue
            if bool(lap.get("Deleted", False)):
                continue
            if str(lap["TrackStatus"]) != "1":              # solo verde puro
                continue
            s = tele.secondi(lap["LapTime"])
            if s is None:
                continue
            ln = int(lap["LapNumber"])
            eta = lap["TyreLife"]
            stints[int(lap["Stint"])].append({
                "ln": ln, "sec": s, "gap": gap.get((num, ln)),
                "mescola": str(lap["Compound"]), "stint": int(lap["Stint"]),
                "eta": float(eta) if eta == eta else None, "lap": lap,
            })
        righe = []
        for _stint, arr in stints.items():
            arr.sort(key=lambda r: r["ln"])
            righe += arr[1:] if scarta_primo else arr
        if righe:
            out[num] = sorted(righe, key=lambda r: r["ln"])
    return out


def mescola_modale(righe):
    """La mescola su cui il pilota ha fatto piu' giri puliti (la sua 'stessa gomma')."""
    comps = [r["mescola"] for r in righe]
    return max(set(comps), key=comps.count) if comps else None


def classe_aria(gap, scia_s=SCIA_S, libera_s=LIBERA_S):
    """1 = in scia, 0 = aria libera, None = zona grigia (si scarta).

    La fascia fra scia_s e libera_s viene ESCLUSA di proposito: e' il cuscinetto
    che rende netto il confronto (un giro a 1,4 s non e' ne' scia ne' aria pulita).
    """
    if gap is None or gap > libera_s:
        return 0
    if gap <= scia_s:
        return 1
    return None


# ---------------------------------------------------------------------------
# CURVE: quali sono vere curve, e dove cadono su OGNI giro (ancoraggio GPS)
# ---------------------------------------------------------------------------
def curve_vere(ses, quota=QUOTA_LENTA):
    """Le curve dove il carico aerodinamico conta davvero, + la diagnostica.

    Si campiona il giro veloce di ogni pilota, si misura l'apice a ogni curva di
    circuit_info e la Vmax; una curva e' VERA se la sua minima mediana sta sotto
    `quota` x Vmax mediana di sessione. Le altre sono kink di rettilineo: li' la
    scia fa GUADAGNARE velocita', e mescolarle alle curve vere annulla il segnale.

    Ritorna (curve_vere, scartate, vmax_mediana). Ogni voce: dict di curve.curve()
    piu' 'apice_med'.
    """
    cs = curve.curve(ses)
    if not cs:
        return [], [], None
    apici = defaultdict(list)
    vmaxs = []
    for num in ses.drivers:
        try:
            lap = ses.laps.pick_drivers(num).pick_fastest()
            tel = tele.canale_giro(lap)
        except Exception:
            continue
        d = tel["Distance"].values
        sp = tel["Speed"].values
        vmaxs.append(float(sp.max()))
        for c in cs:
            m = (d >= c["dist"] - FIN_INDIETRO) & (d <= c["dist"] + FIN_AVANTI)
            if m.sum() >= 3:
                apici[c["numero"]].append(float(sp[m].min()))
    if not vmaxs:
        return [], [], None
    vmax_med = st.median(vmaxs)
    vere, scart = [], []
    for c in cs:
        a = apici.get(c["numero"])
        if not a:
            continue
        c = dict(c, apice_med=st.median(a))
        (vere if c["apice_med"] < quota * vmax_med else scart).append(c)
    # fusione delle curve troppo vicine (chicane): tengo la piu' lenta
    vere.sort(key=lambda c: c["dist"])
    fuse = []
    for c in vere:
        if fuse and c["dist"] - fuse[-1]["dist"] < DIST_MIN_CURVE:
            if c["apice_med"] < fuse[-1]["apice_med"]:
                fuse[-1] = c
            continue
        fuse.append(c)
    return fuse, scart, vmax_med


def _dist_curve_del_giro(lap, tel, curve_l):
    """Distanza (nel sistema della telemetria di QUESTO giro) di ogni curva,
    ancorata al GPS: campione di posizione piu' vicino alle coordinate della curva
    -> suo istante -> campione di telemetria a quell'istante.

    Fallback (nessun dato di posizione): la distanza di circuit_info, che pero'
    puo' scostarsi di ~20 m per la deriva dell'integrazione.
    """
    import numpy as np
    d = tel["Distance"].values
    try:
        pos = lap.get_pos_data().reset_index(drop=True)
        px = pos["X"].values.astype(float)
        py = pos["Y"].values.astype(float)
        pt = pos["Time"].dt.total_seconds().values
        ct = tel["Time"].dt.total_seconds().values
        if len(px) < 20:
            raise ValueError("posizione troppo corta")
        out = []
        for c in curve_l:
            i = int(np.argmin((px - c["x"]) ** 2 + (py - c["y"]) ** 2))
            j = int(np.argmin(np.abs(ct - pt[i])))
            out.append(float(d[j]))
        return out, True
    except Exception:
        return [c["dist"] for c in curve_l], False


def apici_giro(lap, tel, curve_l):
    """Velocita' all'apice di ogni curva vera, su UN giro. Ritorna (lista, gps?).
    Una curva senza campioni a sufficienza da' None nella sua posizione."""
    d = tel["Distance"].values
    sp = tel["Speed"].values
    dist, gps = _dist_curve_del_giro(lap, tel, curve_l)
    out = []
    for dc in dist:
        m = (d >= dc - FIN_INDIETRO) & (d <= dc + FIN_AVANTI)
        out.append(float(sp[m].min()) if m.sum() >= 3 else None)
    return out, gps


# ---------------------------------------------------------------------------
# STIMATORE a effetti fissi
# ---------------------------------------------------------------------------
def effetti_fissi(righe, y, trattamento="scia", tempo="ln", min_righe=12, min_piloti=3):
    """OLS con una costante per PILOTA + tendenza lineare sul numero di giro +
    il trattamento (0/1). Ritorna {coef, se, t, se_cluster, t_cluster, n, n_piloti,
    trend, dof} o None.

    QUALE t SI PUBBLICA: `t_cluster`. Il SE classico assume che i giri siano
    indipendenti, e non lo sono: i giri di uno stesso pilota arrivano a BLOCCHI
    consecutivi dentro o fuori dalla scia (chi insegue insegue per cinque giri di
    fila, non a giri alterni), quindi dentro un pilota i residui sono correlati e il
    SE classico e' troppo piccolo. Misurato sui quattro sprint 2026, il t si sgonfia
    di circa un quarto (Vmax Miami 8,91 -> 7,07; Cina 5,54 -> 3,93). Il SE
    cluster-robusto raggruppa per pilota, con la correzione a piccoli campioni
    G/(G-1) x (n-1)/dof — necessaria qui, dove i gruppi sono 8-12 e non 8000.

    Perche' cosi': il confronto grezzo fra giri in scia e giri liberi mette insieme
    piloti diversi (chi sta in scia e' sistematicamente un altro pilota) e momenti
    diversi della sessione (i giri in scia cadono prima). Le costanti per pilota
    tolgono il primo effetto, la tendenza lineare il secondo. Resta il confronto
    ENTRO pilota, a parita' di momento.

    Entrano solo i piloti che hanno ENTRAMBE le condizioni: chi non le ha non porta
    informazione al confronto (e con effetti fissi il suo contributo e' nullo).
    """
    import numpy as np
    dati = [r for r in righe if r.get(y) is not None and r.get(trattamento) is not None]
    sigle = sorted({r["sig"] for r in dati})
    ok = [s for s in sigle
          if any(r["sig"] == s and r[trattamento] == 1 for r in dati)
          and any(r["sig"] == s and r[trattamento] == 0 for r in dati)]
    dati = [r for r in dati if r["sig"] in ok]
    if len(dati) < min_righe or len(ok) < min_piloti:
        return None
    idx = {s: i for i, s in enumerate(ok)}
    k = len(ok) + 2
    X = np.zeros((len(dati), k))
    Y = np.zeros(len(dati))
    for i, r in enumerate(dati):
        X[i, idx[r["sig"]]] = 1.0
        X[i, len(ok)] = float(r[tempo])
        X[i, len(ok) + 1] = float(r[trattamento])
        Y[i] = float(r[y])
    beta, *_ = np.linalg.lstsq(X, Y, rcond=None)
    res = Y - X @ beta
    dof = len(dati) - int(np.linalg.matrix_rank(X))
    if dof <= 1:
        return None
    j = len(ok) + 1
    pane = np.linalg.pinv(X.T @ X)          # (X'X)^-1, il "pane" del sandwich
    cov = (float(res @ res) / dof) * pane
    se = float(math.sqrt(max(cov[j, j], 0.0)))
    coef = float(beta[j])
    # --- SE cluster-robusto per pilota (sandwich CR1) --------------------------
    se_cl = None
    if len(ok) > 1:
        carne = np.zeros((k, k))
        for s in ok:
            msk = np.array([r["sig"] == s for r in dati])
            v = X[msk].T @ res[msk]
            carne += np.outer(v, v)
        corr = (len(ok) / (len(ok) - 1.0)) * ((len(dati) - 1.0) / max(dof, 1))
        V = pane @ carne @ pane * corr
        se_cl = float(math.sqrt(max(V[j, j], 0.0)))
    return {"coef": coef, "se": se, "t": (coef / se if se > 0 else None),
            "se_cluster": se_cl,
            "t_cluster": (coef / se_cl if se_cl and se_cl > 0 else None),
            "n": len(dati), "n_piloti": len(ok), "piloti": ok,
            "trend": float(beta[len(ok)]), "dof": dof}


def delta_per_pilota(righe, y, trend, trattamento="scia", tempo="ln"):
    """Differenza ENTRO pilota (trattato − non trattato) dopo aver tolto la
    tendenza comune sul numero di giro. La media pesata di queste differenze e' il
    coefficiente a effetti fissi: la figura e la stima raccontano la stessa cosa."""
    per = defaultdict(lambda: {0: [], 1: []})
    for r in righe:
        if r.get(y) is None or r.get(trattamento) is None:
            continue
        per[r["sig"]][r[trattamento]].append(r[y] - trend * float(r[tempo]))
    out = {}
    for sig, d in per.items():
        if d[0] and d[1]:
            out[sig] = {"delta": st.mean(d[1]) - st.mean(d[0]),
                        "n_scia": len(d[1]), "n_libera": len(d[0])}
    return out


def sequenze_libere(righe, soglia_s=LIBERA_SEQ_S):
    """Le sequenze di giri CONSECUTIVI (LapNumber contiguo, stesso stint) passati
    tutti in aria libera. La regola di casa: mai giri sparsi — un passo si legge su
    una sequenza, non su giri raccolti qua e la' fra un traffico e l'altro."""
    seqs = []
    per_stint = defaultdict(list)
    for r in righe:
        per_stint[r["stint"]].append(r)
    for _stint, arr in per_stint.items():
        arr.sort(key=lambda r: r["ln"])
        cur = []
        for r in arr:
            libero = (r["gap"] is None or r["gap"] > soglia_s)
            if libero and (not cur or r["ln"] == cur[-1]["ln"] + 1):
                cur.append(r)
            elif libero:
                if cur:
                    seqs.append(cur)
                cur = [r]
            else:
                if cur:
                    seqs.append(cur)
                cur = []
        if cur:
            seqs.append(cur)
    return seqs


def seq_minima(n_giri):
    """Lunghezza minima di una sequenza perche' sia un passo e non un assaggio:
    un quarto della distanza della sprint, mai sotto 4 giri. Scala da sola con
    sprint di 17 (Silverstone) o 23 giri (Montreal)."""
    return max(4, int(math.ceil(0.25 * n_giri)))


def mescola_di_campo(puliti):
    """La mescola su cui ha girato la MAGGIORANZA dei giri puliti della sessione.

    Diversa da mescola_modale (che e' per-pilota): un confronto di PASSO fra piloti
    non puo' attraversare le mescole — soft e medium non sono la stessa gara — e la
    scelta di quale tenere non puo' dipendere dal pilota, altrimenti si confrontano
    mele con pere pilota per pilota. Ritorna (mescola, giri_su_quella, giri_totali).
    """
    cnt = defaultdict(int)
    for _num, rr in puliti.items():
        for r in rr:
            cnt[r["mescola"]] += 1
    if not cnt:
        return None, 0, 0
    m = max(cnt, key=lambda k: cnt[k])
    return m, cnt[m], sum(cnt.values())


def livelli_pilota(righe, y="sec", tempo="ln", lref=None):
    """Il LIVELLO di passo di ogni pilota, a parita' di momento della sprint.

    Stesso impianto di effetti_fissi, ma qui non c'e' un trattamento: interessano
    proprio le costanti per pilota. Modello: tempo_giro = alfa_pilota + beta x giro.
    La tendenza beta e' UNICA per tutti e assorbe cio' che si muove lungo la sprint
    (benzina che cala, gomma che invecchia, pista che gomma); le alfa restano i
    livelli, confrontabili anche fra piloti le cui sequenze cadono in momenti
    diversi. Senza questa correzione, chi ha girato libero a fine sprint sembrerebbe
    piu' veloce solo perche' aveva meno benzina.

    Ritorna dict con:
      livelli   {sig: {"livello", "se", "n", "ln_min", "ln_max"}} al giro `lref`
      trend     s/giro (+ = si rallenta), trend_se
      sigma     deviazione residua per singolo giro (il rumore di gara)
      risoluzione  il distacco piu' piccolo che questi dati sanno separare al 95%
                   (1,96 x sqrt(2) x SE mediano): sotto quella soglia due piloti
                   NON sono ordinabili, e l'articolo deve dirlo invece di fingere
                   una classifica al millesimo.
    """
    import numpy as np
    dati = [r for r in righe if r.get(y) is not None]
    sigle = sorted({r["sig"] for r in dati})
    if len(sigle) < 2 or len(dati) < len(sigle) + 3:
        return None
    idx = {s: i for i, s in enumerate(sigle)}
    k = len(sigle) + 1
    X = np.zeros((len(dati), k))
    Y = np.zeros(len(dati))
    for i, r in enumerate(dati):
        X[i, idx[r["sig"]]] = 1.0
        X[i, len(sigle)] = float(r[tempo])
        Y[i] = float(r[y])
    beta, *_ = np.linalg.lstsq(X, Y, rcond=None)
    res = Y - X @ beta
    dof = len(dati) - int(np.linalg.matrix_rank(X))
    if dof <= 1:
        return None
    s2 = float(res @ res) / dof
    cov = s2 * np.linalg.pinv(X.T @ X)
    if lref is None:
        lref = float(st.median([float(r[tempo]) for r in dati]))
    j = len(sigle)
    livelli = {}
    for s in sigle:
        i = idx[s]
        var = cov[i, i] + lref * lref * cov[j, j] + 2.0 * lref * cov[i, j]
        rr = [r for r in dati if r["sig"] == s]
        livelli[s] = {"livello": float(beta[i] + beta[j] * lref),
                      "se": float(math.sqrt(max(var, 0.0))),
                      "n": len(rr),
                      "ln_min": min(int(r[tempo]) for r in rr),
                      "ln_max": max(int(r[tempo]) for r in rr)}
    se_med = st.median([v["se"] for v in livelli.values()])
    return {"livelli": livelli, "trend": float(beta[j]),
            "trend_se": float(math.sqrt(max(cov[j, j], 0.0))),
            "sigma": float(math.sqrt(s2)), "dof": dof, "lref": lref,
            "n": len(dati), "n_piloti": len(sigle),
            "risoluzione": 1.96 * math.sqrt(2.0) * se_med}


def soglia_coppia(se_a, se_b, z=1.96):
    """Il distacco che separa al 95% PROPRIO QUELLA coppia: z x sqrt(se_a^2+se_b^2).

    Perche' non una soglia unica. I SE per pilota variano di un fattore 2-3 dentro
    lo stesso evento (misurato: Miami 0,084-0,147 s; Canada 0,131-0,250; Gran
    Bretagna 0,240-0,405). Una soglia sola — il SE mediano — e' troppo stretta per le
    coppie rumorose e troppo larga per quelle precise: a Silverstone dichiarava
    separabili VER e LAW (distacco 0,822 contro una risoluzione di 0,820, margine 2
    millesimi) mentre la soglia della LORO coppia e' 0,923, cioe' NON sono separabili.
    """
    return z * math.sqrt(se_a * se_a + se_b * se_b)


def gruppi_separabili(ordinati, se_di=None, risoluzione=None, z=1.96):
    """Spezza una classifica ordinata (lista di (sig, livello)) nei GRUPPI che i dati
    sanno davvero separare.

    DUE CORREZIONI rispetto alla versione ingenua, e servono tutte e due perche' la
    prosa dica il vero.

    1) Il confronto e' col PRECEDENTE, non col capogruppo. Confrontando col capogruppo
       si aprivano gruppi nuovi fra piloti vicinissimi: a Miami ANT (0,242) e VER
       (0,316) finivano in gruppi DIVERSI a 74 millesimi l'uno dall'altro, mentre
       NOR->ANT, a 242 millesimi, stavano nello STESSO gruppo. L'articolo dice che
       dentro un gruppo l'ordine non e' informazione — il che implica che FRA gruppi
       lo sia. Col confronto al capogruppo ai confini non lo era.

    2) La soglia e' della COPPIA, non del campo (vedi soglia_coppia).

    Con queste due, i confini dei gruppi sono coppie DAVVERO separabili al 95%, e
    l'implicazione della prosa regge. Il prezzo, dichiarato: un gruppo puo' essere piu'
    largo della soglia della sua coppia estrema (catena di vicini non separabili). E'
    l'affermazione onesta — di nessuna coppia consecutiva dentro il gruppo si e'
    dimostrata la separazione — e non si pubblica un ordine che i dati non reggono.

    se_di: {sig: se}. Se manca, si ricade sulla vecchia soglia unica `risoluzione`
    (tenuta solo per non rompere chi chiamasse la funzione senza SE).
    Ritorna (gruppi, confini): confini = [{"da","a","distacco","soglia"}] per ogni
    salto di gruppo, cosi' l'articolo puo' PUBBLICARE il margine con cui separa.
    """
    gruppi, confini = [], []
    prec = None
    for sig, liv in ordinati:
        if prec is None:
            gruppi.append([(sig, liv)])
            prec = (sig, liv)
            continue
        d = liv - prec[1]
        if se_di:
            s = soglia_coppia(se_di[sig], se_di[prec[0]], z=z)
        else:
            s = risoluzione if risoluzione is not None else 0.0
        if d > s:
            confini.append({"da": prec[0], "a": sig, "distacco": d, "soglia": s})
            gruppi.append([(sig, liv)])
        else:
            gruppi[-1].append((sig, liv))
        prec = (sig, liv)
    return gruppi, confini


def canale_drs_nullo(ses, campione=8):
    """(quota di campioni con DRS != 0, campioni esaminati) sui giri veloci.

    Nel feed 2026 il canale DRS vale 0 su tutti i giri di tutte le sessioni:
    verificato, e va DICHIARATO in ogni pezzo che parla di velocita', perche'
    significa che nessuna differenza di velocita' e' attribuibile al DRS — ne' in
    un senso ne' nell'altro. Se un giorno il canale tornasse vivo, questa funzione
    lo direbbe e i generatori si fermerebbero invece di attribuire alla scia un
    guadagno che e' di un'ala mobile."""
    tot = nz = 0
    for num in list(ses.drivers)[:campione]:
        try:
            lap = ses.laps.pick_drivers(num).pick_fastest()
            tel = tele.canale_giro(lap)
        except Exception:
            continue
        if "DRS" not in tel:
            continue
        tot += len(tel)
        nz += int((tel["DRS"] != 0).sum())
    return (nz / tot if tot else None), tot
