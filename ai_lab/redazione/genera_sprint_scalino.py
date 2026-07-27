"""
Lo scalino fra le due qualifiche — pezzo del SABATO nei weekend sprint (SQ + Q).

LA PREMESSA FISICA. In un weekend sprint si qualifica due volte: la Qualifica
Sprint il venerdi' e la Qualifica vera il sabato. Fra le due il parco chiuso e'
APERTO: le squadre possono rimettere le mani sull'assetto. Quindi il confronto fra
il miglior giro soft del venerdi' e quello del sabato, settore per settore, e' una
delle poche finestre in cui si vede una squadra CAMBIARE la macchina e si misura
quanto le e' valso. Se il parco chiuso fosse sigillato, questo pezzo non avrebbe
oggetto.

IL CANCELLO, E DUE MODI SBAGLIATI DI COSTRUIRLO.

Sbagliato n.1 — il 50%. La tentazione e' guardare se i due compagni di squadra si
muovono nella stessa direzione e confrontare quel numero col lancio della monetina.
I due compagni condividono l'EVENTO, e l'evento si sposta tutto insieme (pista che
gomma, temperatura che scende, tutti piu' veloci il sabato): con una pista che
migliora per tutti anche due piloti di squadre diverse "concordano". Il termine di
paragone giusto sono i NON-COMPAGNI DELLO STESSO EVENTO.

Sbagliato n.2 — la REGRESSIONE VERSO LA MEDIA, ed e' quello che per poco non ci ha
fatto pubblicare la classifica della Qualifica Sprint al contrario. Il delta Q-SQ
non e' indipendente dal livello in SQ: chi il venerdi' ha fatto un giro sopra la
propria media il sabato torna verso la media, e viceversa. Misurato:
    Spearman(tempo in SQ, delta Q-SQ) per pilota:  Miami -0,927 (n=10)  Cina -0,915
A Miami, a livello di squadra, Pearson(tempo SQ, "guadagno netto" col solo conto
mediana-di-campo) = +0,895 su 5 squadre, ordine perfettamente monotono. I compagni
di squadra CONDIVIDONO IL LIVELLO IN SQ: percio' concordano nel segno del delta anche
senza aver toccato un bullone, e il cancello si apriva su questo, non sull'assetto.

IL CANCELLO GIUSTO. Da ogni delta di settore si toglie la regressione lineare sul
tempo in SQ (una retta per settore, stimata sui piloti dell'evento): quel che resta
e' il RESIDUO, ripulito sia dallo spostamento di giornata (che finisce
nell'intercetta) sia dalla regressione verso la media (che finisce nella pendenza).
I segni si prendono LI'. E la p non e' piu' quella di Fisher: i 135 confronti nascono
da 10 piloti soli e ogni pilota entra in 9 coppie, quindi Fisher — che li tratta come
indipendenti — e' anti-conservativo di circa 4 volte (misurato: Miami 0,0043 contro
0,0184 di permutazione, sui segni grezzi). Il null giusto e' la PERMUTAZIONE delle
etichette di squadra fra i piloti, che rispetta la dipendenza.

MISURATO SUI QUATTRO SPRINT 2026, col cancello giusto (vedi CALIBRAZIONE):
    Miami           residui: compagni 60,0% vs 45,0%   p_perm=0,311   -> NON esce
    Canada          residui: compagni 50,0% vs 44,7%   p_perm=0,475   -> NON esce
    Cina            residui: compagni 41,7% vs 46,3%   p_perm=0,689   -> NON esce
    Gran Bretagna   residui: compagni 33,3% vs 50,0%   p_perm=0,968   -> NON esce
Col cancello sbagliato Miami usciva a p=0,004. Con quello giusto NON esce piu' nessuno
dei quattro: allo stato dei dati questo pezzo NON HA MAI PUBBLICATO, ed e' il verdetto
corretto. Il generatore resta in rotazione perche' il cancello si aprirebbe da solo se
un weekend mostrasse davvero un effetto di squadra.

E IL PLACEBO LO CONFERMA (vedi PLACEBO). Con squadre FINTE — piloti adiacenti nella
classifica SQ, di squadre diverse — il cancello vecchio si apriva in Cina (Fisher
p=0,033): un falso positivo su quattro, su squadre che non esistono. Col cancello nuovo
il placebo e' chiuso 4 volte su 4 (p minima 0,48).

COSA SI PUBBLICHEREBBE. Se il cancello si aprisse, i numeri pubblicati sono gli STESSI
residui su cui si e' deciso: mai il conto mediana-di-campo, che e' il numero
contaminato dalla regressione verso la media. Il totale di squadra e' la somma dei tre
settori residui (la scomposizione torna esatta); lo spostamento di giornata e la
pendenza della regressione si pubblicano a parte, dichiarati per quello che sono.

IL CAMPIONE, DICHIARATO. In Qualifica Sprint la soft esce solo nel segmento finale:
circa 10 piloti su 22 hanno un giro soft cronometrato (verificato: 10 su 22 in tutti
e quattro gli sprint). Il confronto e' quindi sulla punta della griglia, non sul
campo intero, e l'articolo lo dice.

LA CLASSIFICA SI LEGGE DAI GIRI, NON DAI RESULTS. In SQ ses.results ha la colonna
Position tutta vuota (verificato su tutti e quattro gli sprint 2026): chi si fida
dei results ottiene una classifica di NaN. E il miglior giro va preso PER PILOTA:
in Cina e in Canada i due giri piu' veloci della sessione sono dello STESSO pilota,
e chi prende "i primi due giri" mette un pilota contro se' stesso.

python3 UTENTE (fastf1 3.8.3). Solo lettura; bozza nell'area Lab. Mai demo/.
"""
from __future__ import annotations
import os
import sys
import json
import math
import datetime
import itertools
import statistics as st
from collections import defaultdict

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele     # noqa: E402
import sprint   # noqa: E402
import svg      # noqa: E402
import base     # noqa: E402

ID = "sprint-scalino"
REPO = base.REPO

# --- cancelli, fissati sui quattro sprint gia' corsi (vedi testata) -----------
P_MAX = 0.05        # p di PERMUTAZIONE: sopra, l'effetto di squadra non c'e'
MIN_COPPIE = 3      # coppie di compagni: sotto, il test non ha potenza
MIN_PILOTI = 8      # piloti con giro soft valido in ENTRAMBE le sessioni
MESCOLA = "SOFT"    # soft contro soft: il confronto non attraversa le mescole
N_PERM = 20000      # estrazioni del null di permutazione
SEME_PERM = 20260727  # seme fisso: la p pubblicata dev'essere riproducibile

# La CALIBRAZIONE del cancello, misurata sui quattro sprint gia' corsi del 2026 e
# messa nei fatti (non solo nel commento): la prosa cita i controesempi pescandoli
# da qui, cosi' nessun numero in pagina e' un literal scritto a mano.
#   *_grezzo_*  = segni sul delta crudo, cancello VECCHIO e SBAGLIATO (contaminato
#                 dalla regressione verso la media). Tenuto perche' e' il numero che
#                 l'articolo deve saper spiegare, non nascondere.
#   *_res_*     = segni sui RESIDUI dopo aver tolto la retta sul tempo in SQ, e p di
#                 permutazione delle etichette di squadra. E' il cancello vero.
CALIBRAZIONE = [
    {"gara": "Miami", "compagni_pc": 86.7, "non_compagni_pc": 48.3, "p_fisher_grezzo": 0.0043,
     "res_compagni_pc": 60.0, "res_non_compagni_pc": 45.0, "p_perm": 0.3114,
     "spearman_sq_delta": -0.927, "esce": False},
    {"gara": "Canada", "compagni_pc": 91.7, "non_compagni_pc": 74.8, "p_fisher_grezzo": 0.1711,
     "res_compagni_pc": 50.0, "res_non_compagni_pc": 44.7, "p_perm": 0.4754,
     "spearman_sq_delta": -0.109, "esce": False},
    {"gara": "Gran Bretagna", "compagni_pc": 73.3, "non_compagni_pc": 70.0, "p_fisher_grezzo": 0.5263,
     "res_compagni_pc": 33.3, "res_non_compagni_pc": 50.0, "p_perm": 0.9677,
     "spearman_sq_delta": 0.333, "esce": False},
    {"gara": "Cina", "compagni_pc": 58.3, "non_compagni_pc": 54.5, "p_fisher_grezzo": 0.5220,
     "res_compagni_pc": 41.7, "res_non_compagni_pc": 46.3, "p_perm": 0.6891,
     "spearman_sq_delta": -0.915, "esce": False},
]

# IL PLACEBO, cioe' la prova che il cancello non si apre su squadre che non esistono.
# Si costruiscono squadre FINTE accoppiando piloti ADIACENTI nella classifica SQ (di
# squadre diverse) e si rifa' lo stesso test. Se il cancello misurasse solo "questi due
# hanno lo stesso livello in SQ", si aprirebbe anche qui — ed e' esattamente quello che
# faceva: col cancello vecchio la Cina dava compagni-finti 80,0% vs 51,7%, Fisher
# p=0,033, UN FALSO POSITIVO su quattro. Col cancello nuovo: 0 su 4.
PLACEBO = [
    {"gara": "Miami", "grezzo_fisher": 0.3706, "residui_perm": 0.9496},
    {"gara": "Canada", "grezzo_fisher": 0.7373, "residui_perm": 0.9313},
    {"gara": "Cina", "grezzo_fisher": 0.0329, "residui_perm": 0.4824},
    {"gara": "Gran Bretagna", "grezzo_fisher": 0.7411, "residui_perm": 0.5606},
]


def it(x, dec=1):
    return base.it(x, dec)


def _slug(s):
    out = []
    for ch in str(s).lower().strip():
        if ch.isalnum():
            out.append(ch)
        elif out and out[-1] != "-":
            out.append("-")
    return "".join(out).strip("-") or "gp"


def _reg():
    try:
        return json.load(open(os.path.join(REPO, "data", "gare_registro.json")))
    except Exception:
        return {}


def fisher_una_coda(a, b, c, d):
    """P(tabella almeno cosi' sbilanciata | margini fissi) — Fisher esatto, coda
    superiore. Tabella [[a,b],[c,d]] = (concordi, discordi) x (compagni, non).

    NON E' PIU' IL CANCELLO, ed e' importante dire perche': Fisher assume che i
    confronti siano indipendenti, e qui non lo sono — i 135 confronti nascono da 10
    piloti soli, ognuno dentro 9 coppie. Misurato sui quattro sprint 2026, la p di
    Fisher e' anti-conservativa di circa 4 volte rispetto al null di permutazione
    (Miami 0,0043 contro 0,0184). Resta calcolata e pubblicata come DIAGNOSTICA, per
    poter mostrare quanto vale l'errore; a decidere e' `p_permutazione`."""
    n = a + b + c + d
    if min(a + b, c + d, a + c, b + d) < 0 or n == 0:
        return None
    tot = 0.0
    for x in range(a, min(a + b, a + c) + 1):
        tot += (math.comb(a + b, x) * math.comb(c + d, a + c - x)) / math.comb(n, a + c)
    return tot


def _concordanza(comuni, segni, team_di):
    """(compagni_ok, compagni_no, altri_ok, altri_no) sui segni dati.
    Un "confronto" e' una coppia di piloti su un settore: 3 per coppia."""
    cc = cd = nc = nd = 0
    for a, b in itertools.combinations(comuni, 2):
        stessa = team_di[a] == team_di[b]
        for i in range(3):
            concorde = segni[a][i] == segni[b][i]
            if stessa:
                cc += 1 if concorde else 0
                cd += 0 if concorde else 1
            else:
                nc += 1 if concorde else 0
                nd += 0 if concorde else 1
    return cc, cd, nc, nd


def p_permutazione(comuni, segni, team_di, n=N_PERM, seme=SEME_PERM):
    """p a una coda dal null che rispetta la dipendenza: si rimescolano le ETICHETTE
    DI SQUADRA fra i piloti (dimensioni delle squadre invariate) e si guarda quante
    volte lo scarto compagni−non-compagni arriva almeno a quello osservato.

    Perche' questo e non Fisher: i confronti condividono i piloti, quindi non sono
    135 osservazioni indipendenti ma 10. Permutare le etichette lascia intatti sia i
    segni sia la struttura delle coppie, e distrugge SOLO cio' che il cancello vuole
    testare: l'appartenenza alla stessa squadra. Seme fisso -> p riproducibile."""
    import random
    cc, cd, nc, nd = _concordanza(comuni, segni, team_di)
    if (cc + cd) == 0 or (nc + nd) == 0:
        return None, None
    oss = cc / (cc + cd) - nc / (nc + nd)
    rng = random.Random(seme)
    etichette = [team_di[s] for s in comuni]
    almeno = 0
    for _ in range(n):
        rng.shuffle(etichette)
        tm = dict(zip(comuni, etichette))
        c2, d2, n2, q2 = _concordanza(comuni, segni, tm)
        if (c2 + d2) == 0 or (n2 + q2) == 0:
            continue
        if (c2 / (c2 + d2) - n2 / (n2 + q2)) >= oss - 1e-12:
            almeno += 1
    return almeno / n, oss


def _retta(x, y):
    """OLS a una variabile: ritorna (intercetta, pendenza). Pendenza 0 se x e' piatto."""
    mx, my = st.mean(x), st.mean(y)
    den = sum((a - mx) ** 2 for a in x)
    b = (sum((a - mx) * (c - my) for a, c in zip(x, y)) / den) if den > 0 else 0.0
    return my - b * mx, b


def residui_dal_livello(D, comuni):
    """Toglie da ogni delta di settore la parte spiegata dal LIVELLO IN SQ.

    E' la correzione che salva questo pezzo dal pubblicare la classifica della
    Qualifica Sprint al contrario. Il delta Q−SQ e' fortemente anti-correlato col
    tempo in SQ (Spearman −0,93 a Miami): chi il venerdi' ha girato sopra la propria
    media torna verso la media il sabato, e siccome i due compagni CONDIVIDONO il
    livello in SQ, concordano nel segno anche senza aver toccato niente.

    Una retta per settore, stimata sui piloti dell'evento: l'intercetta si mangia lo
    spostamento di giornata (che era la vecchia mediana-di-campo) e la pendenza si
    mangia la regressione verso la media. Il residuo e' quel che resta.

    Ritorna (residui {sig: [3]}, pendenze [3], intercette [3]).
    """
    x = [D[s]["sq"]["tot"] for s in comuni]
    res = {s: [] for s in comuni}
    pend, inter = [], []
    for i in range(3):
        y = [D[s]["settori"][i] for s in comuni]
        a0, b = _retta(x, y)
        pend.append(b)
        inter.append(a0)
        for s in comuni:
            res[s].append(D[s]["settori"][i] - (a0 + b * D[s]["sq"]["tot"]))
    return res, pend, inter


def _spearman(x, y):
    """Spearman senza scipy (rango medio sui pari): serve a PUBBLICARE quanto vale
    la regressione verso la media, non solo a correggerla."""
    def rank(v):
        ordine = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        i = 0
        while i < len(ordine):
            j = i
            while j + 1 < len(ordine) and v[ordine[j + 1]] == v[ordine[i]]:
                j += 1
            media = (i + j) / 2.0 + 1.0
            for k in range(i, j + 1):
                r[ordine[k]] = media
            i = j + 1
        return r
    rx, ry = rank(x), rank(y)
    mx, my = st.mean(rx), st.mean(ry)
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = math.sqrt(sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry))
    return (num / den) if den > 0 else None


# ---------------------------------------------------------------------------
# MISURA
# ---------------------------------------------------------------------------
def _miglior_soft(ses):
    """{sigla: {tot, settori[3], team, giro}} — il MIGLIOR GIRO SOFT DI OGNI PILOTA.

    Per pilota, mai "i giri piu' veloci della sessione": in SQ i due giri piu'
    veloci in assoluto possono essere dello stesso pilota (verificato in Cina e in
    Canada), e chi confronta i primi due finisce per confrontare un pilota con se'
    stesso. Si scartano i giri cancellati e quelli senza i tre settori.
    """
    out = {}
    for sig, info in tele.piloti_sessione(ses).items():
        dl = ses.laps.pick_drivers(info["num"])
        dl = dl[(dl["Compound"] == MESCOLA) & dl["LapTime"].notna()]
        if not len(dl):
            continue
        dl = dl.sort_values("LapTime")
        for _, lap in dl.iterrows():
            if bool(lap.get("Deleted", False)):
                continue
            sett = [tele.secondi(lap[f"Sector{i}Time"]) for i in (1, 2, 3)]
            if any(x is None for x in sett):
                continue
            out[sig] = {"tot": tele.secondi(lap["LapTime"]), "settori": sett,
                        "team": info["team"], "giro": int(lap["LapNumber"])}
            break
    return out


def _ordine_dai_giri(ses):
    """La classifica della sessione letta DAI GIRI (miglior giro per pilota).

    In SQ ses.results ha Position/Time/Status vuoti (verificato su tutti e quattro
    gli sprint 2026): leggerla di li' da' una classifica di NaN.
    """
    r = []
    for sig, info in tele.piloti_sessione(ses).items():
        dl = ses.laps.pick_drivers(info["num"])
        dl = dl[dl["LapTime"].notna()]
        if not len(dl):
            continue
        r.append((tele.secondi(dl["LapTime"].min()), sig))
    r.sort()
    return [s for _t, s in r]


def _misura(anno, gara):
    ses_sq = tele.carica_sessione(anno, gara, "SQ")
    if not sprint.e_sprint(ses_sq):
        return None
    ses_q = tele.carica_sessione(anno, gara, "Q")
    sq = _miglior_soft(ses_sq)
    q = _miglior_soft(ses_q)
    comuni = sorted(set(sq) & set(q))
    if len(comuni) < MIN_PILOTI:
        return None

    D = {}
    for s in comuni:
        D[s] = {"team": sq[s]["team"],
                "tot": q[s]["tot"] - sq[s]["tot"],
                "settori": [q[s]["settori"][i] - sq[s]["settori"][i] for i in range(3)],
                "sq": sq[s], "q": q[s]}

    team_di = {s: D[s]["team"] for s in comuni}
    coppie_comp = sum(1 for a, b in itertools.combinations(comuni, 2)
                      if team_di[a] == team_di[b])

    # --- la regressione verso la media, misurata e tolta ------------------------
    residui, pendenze, intercette = residui_dal_livello(D, comuni)
    sp_liv = _spearman([D[s]["sq"]["tot"] for s in comuni],
                       [D[s]["tot"] for s in comuni])

    # --- il cancello: concordanza compagni vs NON-compagni, SUI RESIDUI ---------
    segni_res = {s: [residui[s][i] > 0 for i in range(3)] for s in comuni}
    rc, rd, rn, rq = _concordanza(comuni, segni_res, team_di)
    p_perm, scarto = p_permutazione(comuni, segni_res, team_di)

    # --- lo stesso conto sui segni GREZZI: il cancello vecchio, tenuto come
    #     diagnostica per poter mostrare quanto valeva l'errore -------------------
    segni_gre = {s: [D[s]["settori"][i] > 0 for i in range(3)] for s in comuni}
    gc, gd, gn, gq = _concordanza(comuni, segni_gre, team_di)
    p_fisher_gre = fisher_una_coda(gc, gd, gn, gq)
    p_perm_gre, _ = p_permutazione(comuni, segni_gre, team_di)

    # --- lo spostamento di giornata, per settore (mediana del campo) ------------
    # NON e' piu' il numero che si pubblica: e' la vecchia correzione, quella che
    # lasciava dentro la regressione verso la media. Resta come diagnostica.
    med_sett = [st.median(D[s]["settori"][i] for s in comuni) for i in range(3)]

    per_team = defaultdict(list)
    for s in comuni:
        per_team[D[s]["team"]].append(s)

    squadre = []
    for team, sigs in per_team.items():
        rel = [st.mean(residui[s][i] for s in sigs) for i in range(3)]
        vecchio = [st.mean(D[s]["settori"][i] - med_sett[i] for s in sigs) for i in range(3)]
        squadre.append({"team": team, "piloti": sorted(sigs), "n": len(sigs),
                        "rel_settori": rel, "rel_tot": sum(rel),
                        "vecchio_settori": vecchio, "vecchio_tot": sum(vecchio),
                        "coppia": len(sigs) >= 2,
                        "sq_medio": st.mean(D[s]["sq"]["tot"] for s in sigs),
                        "grezzo_tot": st.mean(D[s]["tot"] for s in sigs)})
    squadre.sort(key=lambda t: t["rel_tot"])

    return {"ses_sq": ses_sq, "ses_q": ses_q, "D": D, "comuni": comuni,
            "sq": sq, "q": q, "med_sett": med_sett,
            "residui": residui, "pendenze": pendenze, "intercette": intercette,
            "spearman_livello": sp_liv,
            "squadre": squadre, "coppie_comp": coppie_comp,
            "conc": {"comp_ok": rc, "comp_no": rd, "nc_ok": rn, "nc_no": rq,
                     "p": p_perm, "scarto": scarto, "n_perm": N_PERM,
                     "fisher_sui_residui": fisher_una_coda(rc, rd, rn, rq)},
            "conc_grezza": {"comp_ok": gc, "comp_no": gd, "nc_ok": gn, "nc_no": gq,
                            "p_fisher": p_fisher_gre, "p_perm": p_perm_gre},
            "ordine_sq": _ordine_dai_giri(ses_sq),
            "n_piloti_sq": len(tele.piloti_sessione(ses_sq)),
            "n_soft_sq": len(sq), "n_soft_q": len(q)}


# ---------------------------------------------------------------------------
# COSTRUZIONE
# ---------------------------------------------------------------------------
def costruisci(anno, gara, data_bozza=None):
    m = _misura(anno, gara)
    if not m:
        return None
    C = m["conc"]
    # CANCELLO: senza un effetto di SQUADRA distinguibile (a) dallo spostamento di
    # giornata e (b) dalla regressione verso la media non c'e' articolo. Tre requisiti
    # insieme: i compagni devono concordare PIU' dei non-compagni dello stesso evento,
    # la concordanza va presa sui RESIDUI del livello in SQ, e la p dev'essere quella
    # di PERMUTAZIONE (Fisher qui e' anti-conservativo di ~4x: i confronti non sono
    # indipendenti). Con questi tre nessuno dei quattro sprint 2026 passa — ed e' il
    # verdetto corretto, non un guasto.
    if m["coppie_comp"] < MIN_COPPIE:
        return None
    if C["p"] is None or C["p"] >= P_MAX:
        return None
    if C["comp_ok"] + C["comp_no"] == 0 or C["nc_ok"] + C["nc_no"] == 0:
        return None

    D = m["D"]
    squadre = m["squadre"]
    con_coppia = [t for t in squadre if t["coppia"]]
    if len(con_coppia) < MIN_COPPIE:
        return None

    colori = base.carica_colori()
    reg = _reg()
    ev = m["ses_q"].event
    circuito = str(ev["Location"]) if "Location" in ev else gara
    gp_it = next((k for k, v in reg.items() if v.get("ti") == str(ev["EventName"])), None) or gara
    try:
        rnd = int(ev["RoundNumber"])
    except Exception:
        rnd = None
    slug = _slug(circuito)

    def col(team):
        return colori.get(team) or "var(--dim)"

    # il controesempio: l'evento dove i compagni concordavano di piu' SUL GREZZO e il
    # cancello si e' chiuso lo stesso (perche' concordava anche il resto del campo, o
    # perche' quella concordanza era regressione verso la media)
    contro = max((c for c in CALIBRAZIONE if not c["esce"]), key=lambda c: c["compagni_pc"])
    G = m["conc_grezza"]
    quota_comp = 100.0 * C["comp_ok"] / (C["comp_ok"] + C["comp_no"])
    quota_nc = 100.0 * C["nc_ok"] / (C["nc_ok"] + C["nc_no"])
    quota_comp_gre = 100.0 * G["comp_ok"] / (G["comp_ok"] + G["comp_no"])
    quota_nc_gre = 100.0 * G["nc_ok"] / (G["nc_ok"] + G["nc_no"])
    giornata = sum(m["med_sett"])
    avanti = squadre[0]
    indietro = squadre[-1]
    accent = col(avanti["team"])
    sett_nomi = ["S1", "S2", "S3"]
    # il settore dove lo scalino e' piu' largo fra la squadra migliore e la peggiore
    i_max = max(range(3), key=lambda i: abs(indietro["rel_settori"][i] - avanti["rel_settori"][i]))

    # --- FIGURE ---------------------------------------------------------------
    fig_a = svg.barre_divergenti(
        [{"label": t["team"], "valore": -t["rel_tot"],
          "nota": f"{'+'.join(t['piloti'])}"} for t in squadre],
        col_pos=accent, col_neg="var(--dim)",
        lbl_pos="guadagna più del campo", lbl_neg="guadagna meno del campo",
        titolo="Lo scalino fra le due qualifiche, squadra per squadra",
        sub=f"{gp_it} {anno} · miglior giro soft, Qualifica − Qualifica Sprint",
        unita="s",
        caption=("secondi guadagnati sul giro fra venerdì e sabato AL NETTO dello "
                 "spostamento di giornata (mediana del campo, settore per settore). "
                 "A destra chi ha migliorato più degli altri"))

    fig_b = svg.barre_divergenti(
        [{"label": f"{t['team']} {sett_nomi[i]}", "valore": -t["rel_settori"][i],
          "nota": f"{it(abs(t['rel_settori'][i]),3)} s"}
         for t in squadre for i in range(3)],
        col_pos=accent, col_neg="var(--dim)",
        lbl_pos="guadagna", lbl_neg="perde",
        titolo="Dove cade lo scalino: i tre settori, squadra per squadra",
        sub=f"{gp_it} {anno} · al netto dello spostamento di giornata",
        unita="s",
        caption=("stesso conto della figura precedente, spacchettato nei tre settori: "
                 "il totale di ogni squadra è la somma esatta delle sue tre righe"))

    fig_c = svg.barre_divergenti(
        [{"label": s, "valore": -D[s]["tot"], "nota": D[s]["team"]}
         for s in sorted(m["comuni"], key=lambda x: D[x]["tot"])],
        col_pos="var(--dim)", col_neg="var(--dim)",
        lbl_pos="più veloce il sabato", lbl_neg="più veloce il venerdì",
        titolo="Il numero GREZZO, che da solo non dice niente",
        sub=f"{gp_it} {anno} · differenza cruda fra i due migliori giri soft",
        unita="s",
        caption=("differenza non corretta fra il miglior giro soft del sabato e quello "
                 "del venerdì: si muovono quasi tutti insieme, ed è esattamente il "
                 "motivo per cui il confronto va fatto fra compagni e non-compagni"))

    # --- FACTS ----------------------------------------------------------------
    F = {
        "id": ID, "anno": anno, "gara": gp_it, "circuito": circuito, "round": rnd,
        "sessioni": ["SQ", "Q"], "mescola": MESCOLA,
        "parametri": {"p_max": P_MAX, "min_coppie": MIN_COPPIE, "min_piloti": MIN_PILOTI},
        "campione": {
            "piloti_confrontati": len(m["comuni"]),
            "piloti_in_sessione": m["n_piloti_sq"],
            "con_soft_in_sq": m["n_soft_sq"], "con_soft_in_q": m["n_soft_q"],
            "coppie_di_compagni": m["coppie_comp"],
            "squadre": len(squadre),
            "ordine_sq_dai_giri": m["ordine_sq"][:10],
        },
        "calibrazione_del_cancello": CALIBRAZIONE,
        "placebo_squadre_finte": PLACEBO,
        "cancello": {
            "su_cosa": "segni dei RESIDUI dopo aver tolto la retta sul tempo in SQ",
            "concordanza_compagni": quota_comp,
            "concordanza_non_compagni": quota_nc,
            "compagni": [C["comp_ok"], C["comp_ok"] + C["comp_no"]],
            "non_compagni": [C["nc_ok"], C["nc_ok"] + C["nc_no"]],
            "scarto": C["scarto"],
            "p_permutazione": C["p"], "estrazioni": C["n_perm"], "soglia": P_MAX,
            "fisher_sui_residui_diagnostico": C["fisher_sui_residui"],
        },
        "cancello_grezzo_scartato": {
            "perche": ("segni sul delta crudo: contaminati dalla regressione verso la "
                       "media, perche' i compagni condividono il livello in SQ"),
            "concordanza_compagni": quota_comp_gre,
            "concordanza_non_compagni": quota_nc_gre,
            "p_fisher": G["p_fisher"], "p_permutazione": G["p_perm"],
        },
        "regressione_verso_la_media": {
            "spearman_sq_vs_delta": m["spearman_livello"],
            "pendenza_per_settore": m["pendenze"],
            "intercetta_per_settore": m["intercette"],
            "cosa_e": ("chi in SQ ha girato sopra la propria media torna verso la media "
                       "in Q: non e' assetto, ed e' condiviso dai compagni di squadra"),
        },
        "spostamento_di_giornata": {
            "per_settore": m["med_sett"], "totale": giornata,
            "cosa_e": "evoluzione pista, temperatura, condizioni — non assetto",
            "nota": ("diagnostica: la correzione pubblicata NON e' questa mediana ma la "
                     "retta sul tempo in SQ, che la contiene nell'intercetta"),
        },
        "squadre": [
            {"team": t["team"], "piloti": t["piloti"], "n_piloti": t["n"],
             "guadagno_netto_s": -t["rel_tot"],
             "per_settore_s": [-x for x in t["rel_settori"]],
             "vecchio_conto_mediana_s": -t["vecchio_tot"],
             "tempo_sq_medio_s": t["sq_medio"],
             "grezzo_s": -t["grezzo_tot"]} for t in squadre],
        "per_pilota": [
            {"sig": s, "team": D[s]["team"], "grezzo_s": -D[s]["tot"],
             "settori_grezzi_s": [-x for x in D[s]["settori"]],
             "giro_sq": D[s]["sq"]["giro"], "giro_q": D[s]["q"]["giro"],
             "tempo_sq": base.lap_fmt(D[s]["sq"]["tot"]),
             "tempo_q": base.lap_fmt(D[s]["q"]["tot"])}
            for s in sorted(m["comuni"], key=lambda x: D[x]["tot"])],
    }

    # --- PROSA ----------------------------------------------------------------
    verso_giornata = "più veloce" if giornata < 0 else "più lenta"
    art = {
        "id": ID, "slug": slug, "stato": "bozza",
        "data": data_bozza or datetime.date.today().isoformat(),
        "firma": "Muretto · Redazione tecnica", "accent": accent,
        "canale": "A (qualifiche, weekend sprint)",
        "gp": gp_it, "gara": gp_it, "circuito": circuito,
        "sessione": "Qualifica Sprint + Qualifica", "round": rnd,
        "tag": ["sprint", "qualifica", "assetto", "parco chiuso", circuito],
        "occhiello": f"Weekend sprint · {gp_it} {anno}",
        "titolo": (f"Lo scalino fra le due qualifiche a {circuito}: "
                   f"{avanti['team']} trova {it(-avanti['rel_tot'],3)} s, "
                   f"{indietro['team']} ne perde {it(indietro['rel_tot'],3)}"),
        "sommario": (
            f"Fra la Qualifica Sprint del venerdì e la Qualifica del sabato il parco chiuso è "
            f"aperto: le squadre possono cambiare assetto, ed è una delle poche finestre in cui "
            f"si vede una macchina cambiare e si misura quanto è valso. Confrontando il miglior "
            f"giro soft di ciascuno nelle due sessioni — {len(m['comuni'])} piloti su "
            f"{m['n_piloti_sq']}, gli unici con la soft in entrambe — <b>{avanti['team']}</b> "
            f"guadagna {it(-avanti['rel_tot'],3)} s più del campo e <b>{indietro['team']}</b> ne "
            f"lascia {it(indietro['rel_tot'],3)}. Il conto è al netto dello spostamento di "
            f"giornata ({it(abs(giornata),3)} s di pista {verso_giornata}) <b>e</b> della "
            f"regressione verso la media — chi il venerdì gira sopra la propria media il sabato ci "
            f"torna, e i compagni condividono quel livello. Sui residui di quella correzione i "
            f"compagni di squadra si muovono insieme nel <b>{it(quota_comp,1)}%</b> dei settori "
            f"contro il {it(quota_nc,1)}% dei non-compagni, e il null di permutazione delle "
            f"etichette di squadra dà p={it(C['p'],3)}."),
        "sezioni": [
            {"tag": "Evidenza",
             "titolo": f"Chi ha trovato la macchina, e chi l'ha persa",
             "html": (
                f"<p>Il parco chiuso, fra la sprint e la qualifica, si apre. Non è un dettaglio "
                f"burocratico: è il permesso di rimettere le mani sull'assetto dopo aver visto "
                f"la macchina girare in condizioni di gara. Quello che si misura qui è quanto "
                f"quel permesso è valso, squadra per squadra, sul miglior giro soft.</p>"
                f"<p><b>{avanti['team']}</b> ({' e '.join(avanti['piloti'])}) è la squadra che "
                f"guadagna di più rispetto al campo: <b>{it(-avanti['rel_tot'],3)} s</b> sul giro. "
                f"All'altro capo <b>{indietro['team']}</b> ({' e '.join(indietro['piloti'])}) "
                f"lascia <b>{it(indietro['rel_tot'],3)} s</b>. Attenzione a cosa vuol dire "
                f"«rispetto al campo»: il sabato la pista era {verso_giornata} di "
                f"{it(abs(giornata),3)} s per tutti, e quella parte non è di nessuno — è "
                f"evoluzione, temperatura, gomma sull'asfalto. È tolta da ogni numero qui "
                f"sopra.</p>"),
             "figura": {"svg": fig_a,
                "didascalia": (f"Guadagno netto fra venerdì e sabato, squadra per squadra, dopo "
                               f"aver tolto lo spostamento di giornata. A destra chi ha trovato "
                               f"di più."),
                "fonte": f"FastF1 · laps SQ e Q {gp_it} {anno} — miglior giro soft per pilota"}},

            {"tag": "Causa",
             "titolo": "Il cancello che tiene fuori quasi tutti gli sprint",
             "html": (
                f"<p>Ci sono due modi ovvi di controllare se questo confronto ha senso, e sono "
                f"sbagliati tutti e due. Il primo è guardare se i due compagni si muovono nella "
                f"stessa direzione e confrontarlo col 50% della monetina: sbagliato perché i due "
                f"compagni condividono l'evento, e l'evento si sposta tutto insieme — con una "
                f"pista che migliora per tutti anche due piloti di squadre diverse «concordano». "
                f"Il paragone giusto sono i <b>non-compagni dello stesso evento</b>.</p>"
                f"<p>Il secondo errore è più insidioso, e per poco non ci ha fatto pubblicare la "
                f"classifica della Qualifica Sprint al contrario. Il delta fra le due sessioni "
                f"<b>non è indipendente da com'era andato il venerdì</b>: chi in Qualifica Sprint "
                f"ha girato sopra la propria media il sabato torna verso la media, e viceversa. "
                f"Qui vale Spearman <b>{it(m['spearman_livello'],3)}</b> fra il tempo in SQ e il "
                f"delta. Siccome i due compagni condividono anche il livello in SQ, «concordano» "
                f"nel segno senza aver toccato un bullone: sui segni grezzi il cancello darebbe "
                f"{it(quota_comp_gre,1)}% contro {it(quota_nc_gre,1)}% e sembrerebbe aperto, ma "
                f"starebbe misurando la regressione verso la media.</p>"
                f"<p>Perciò da ogni delta di settore si toglie la retta sul tempo in SQ — "
                f"l'intercetta si prende lo spostamento di giornata, la pendenza la regressione "
                f"verso la media — e i segni si prendono sui <b>residui</b>. Lì i compagni "
                f"concordano in <b>{C['comp_ok']} settori su {C['comp_ok'] + C['comp_no']}</b> "
                f"({it(quota_comp,1)}%) contro {C['nc_ok']} su {C['nc_ok'] + C['nc_no']} "
                f"({it(quota_nc,1)}%) dei non-compagni. E la p non è quella di Fisher, che qui "
                f"tratterebbe come indipendenti {C['comp_ok'] + C['comp_no'] + C['nc_ok'] + C['nc_no']} "
                f"confronti nati da {len(m['comuni'])} piloti soli: è quella di "
                f"<b>permutazione delle etichette di squadra</b>, "
                f"{format(C['n_perm'], ',d').replace(',', '.')} estrazioni, "
                f"<b>p={it(C['p'],3)}</b>. In un altro sprint del 2026 i compagni concordavano nel "
                f"{it(contro['compagni_pc'],1)}% dei settori sul grezzo, più che qui: sui residui "
                f"scendevano al {it(contro['res_compagni_pc'],1)}% e l'articolo non è uscito "
                f"(p={it(contro['p_perm'],3)}).</p>"),
             "figura": {"svg": fig_c,
                "didascalia": ("La differenza cruda fra i due migliori giri soft, pilota per "
                               "pilota: quasi tutti si muovono nello stesso verso, ed è per "
                               "questo che il numero grezzo da solo non dimostra niente."),
                "fonte": f"FastF1 · laps SQ e Q {gp_it} {anno} — differenza non corretta"}},

            {"tag": "Effetto",
             "titolo": f"Dove cade lo scalino: {sett_nomi[i_max]}",
             "html": (
                f"<p>Spacchettato nei tre settori, lo scalino non è distribuito: fra "
                f"{avanti['team']} e {indietro['team']} la forbice più larga cade in "
                f"<b>{sett_nomi[i_max]}</b>, dove corrono "
                f"{it(abs(indietro['rel_settori'][i_max] - avanti['rel_settori'][i_max]),3)} s. "
                f"Il totale di ogni squadra è la somma esatta dei suoi tre settori: il conto è "
                f"fatto settore per settore proprio perché torni.</p>"
                f"<p>Tre limiti, dichiarati. Il primo è il campione: in Qualifica Sprint la soft "
                f"esce solo nel segmento finale, e i piloti con un giro soft cronometrato sono "
                f"<b>{m['n_soft_sq']} su {m['n_piloti_sq']}</b> — questa è la punta della "
                f"griglia, non il campo intero, e di squadre ne restano {len(squadre)}. Il "
                f"secondo è la <b>regressione verso la media</b>: i numeri qui sopra sono residui "
                f"di una retta stimata su {len(m['comuni'])} punti, e una retta stimata su dieci "
                f"punti è essa stessa rumorosa — se una squadra fosse davvero sistematicamente "
                f"lenta il venerdì, parte del suo movimento finirebbe nella retta e verrebbe "
                f"tolta insieme all'artefatto. La correzione è conservativa per costruzione: "
                f"sbaglia togliendo troppo, non troppo poco. Il terzo è più profondo: "
                f"<b>non sappiamo cosa abbiano cambiato</b>. Il parco "
                f"chiuso aperto rende l'assetto la spiegazione naturale, ma dal cronometro non si "
                f"legge un'ala, un'altezza da terra o una scelta di gomme diversa nel giro di "
                f"lancio. Misuriamo che una squadra si è spostata rispetto alle altre; il perché "
                f"resta il loro.</p>"),
             "figura": {"svg": fig_b,
                "didascalia": ("Lo stesso guadagno netto, spacchettato nei tre settori: il "
                               "totale di ogni squadra è la somma delle sue tre righe."),
                "fonte": f"FastF1 · laps SQ e Q {gp_it} {anno} — settori del miglior giro soft"}},
        ],
        "provenienza": [
            {"grandezza": "parco chiuso aperto fra Sprint e Qualifica",
             "valore": "premessa del pezzo",
             "stato": "PRIOR",
             "da": ("regolamento sportivo del formato sprint: fra la Sprint e la Qualifica le "
                    "squadre possono modificare l'assetto — non è una misura, è la condizione "
                    "che rende sensato il confronto")},
            {"grandezza": "guadagno netto della squadra migliore",
             "valore": f"{avanti['team']} {it(-avanti['rel_tot'],3)} s ({' e '.join(avanti['piloti'])})",
             "stato": "MISURATO",
             "da": ("miglior giro SOFT per pilota in SQ e in Q; differenza per settore, RESIDUO "
                    "della retta di quel settore sul tempo in SQ (l'intercetta toglie lo "
                    "spostamento di giornata, la pendenza la regressione verso la media), media "
                    "dei piloti della squadra; totale = somma dei tre settori")},
            {"grandezza": "guadagno netto della squadra peggiore (negativo = perso)",
             "valore": f"{indietro['team']} {it(-indietro['rel_tot'],3)} s ({' e '.join(indietro['piloti'])})",
             "stato": "MISURATO", "da": "stesso conto"},
            {"grandezza": "cancello: concordanza compagni vs non-compagni (sui residui)",
             "valore": (f"{C['comp_ok']}/{C['comp_ok'] + C['comp_no']} ({it(quota_comp,1)}%) "
                        f"contro {C['nc_ok']}/{C['nc_ok'] + C['nc_no']} ({it(quota_nc,1)}%), "
                        f"p di permutazione = {it(C['p'],4)} su "
                        f"{format(C['n_perm'], ',d').replace(',', '.')} estrazioni"),
             "stato": "MISURATO",
             "da": ("concordanza di segno del RESIDUO per settore (delta meno la retta sul tempo "
                    f"in SQ), su tutte le coppie di piloti dell'evento ({m['coppie_comp']} coppie "
                    "di compagni). Null: permutazione delle etichette di squadra fra i piloti — "
                    "l'unico che rispetta la dipendenza, perche' i confronti condividono i piloti")},
            {"grandezza": "quanto valeva il cancello sbagliato (diagnostica)",
             "valore": (f"segni grezzi: {it(quota_comp_gre,1)}% contro {it(quota_nc_gre,1)}%, "
                        f"Fisher p={it(G['p_fisher'],4)} ma permutazione p={it(G['p_perm'],4)}"),
             "stato": "MISURATO",
             "da": ("stesso conto sui delta NON corretti e con Fisher: e' il numero che avremmo "
                    "pubblicato. Fisher e' anti-conservativo perche' assume indipendenti confronti "
                    "che nascono dagli stessi piloti; i segni grezzi sono contaminati dalla "
                    "regressione verso la media. Entrambi gli errori spingono nella stessa "
                    "direzione: far uscire l'articolo")},
            {"grandezza": "regressione verso la media (il confondente principale)",
             "valore": (f"Spearman(tempo in SQ, delta Q−SQ) = {it(m['spearman_livello'],3)} su "
                        f"{len(m['comuni'])} piloti; pendenze per settore "
                        f"{[round(x, 3) for x in m['pendenze']]}"),
             "stato": "MISURATO",
             "da": ("chi in SQ gira sopra la propria media torna verso la media in Q. I compagni "
                    "condividono il livello in SQ: senza toglierla, la loro «concordanza» e' "
                    "questa, non l'assetto")},
            {"grandezza": "spostamento di giornata",
             "valore": (f"{it(giornata,3)} s sul giro "
                        f"(S1 {it(m['med_sett'][0],3)}, S2 {it(m['med_sett'][1],3)}, "
                        f"S3 {it(m['med_sett'][2],3)})"),
             "stato": "MISURATO",
             "da": ("mediana del campo per settore fra Q e SQ: evoluzione pista, temperatura e "
                    "condizioni, non merito di nessuno. È DIAGNOSTICA: la correzione applicata ai "
                    "numeri pubblicati non è questa mediana ma la retta sul tempo in SQ, che la "
                    "contiene nell'intercetta e in più toglie la regressione verso la media")},
            {"grandezza": "campione",
             "valore": (f"{len(m['comuni'])} piloti su {m['n_piloti_sq']}, {len(squadre)} squadre, "
                        f"{m['coppie_comp']} coppie di compagni"),
             "stato": "MISURATO",
             "da": ("solo chi ha un giro SOFT valido, non cancellato e con i tre settori in "
                    "ENTRAMBE le sessioni: in SQ la soft esce solo nel segmento finale")},
            {"grandezza": "che cosa la squadra abbia cambiato",
             "valore": "non osservabile",
             "stato": "NON_MISURABILE",
             "da": ("dal cronometro non si leggono ala, altezza da terra o scelte del giro di "
                    "lancio: si misura lo spostamento, non la sua causa")},
            {"grandezza": "classifica della Qualifica Sprint",
             "valore": "letta dai giri, non da ses.results",
             "stato": "MISURATO",
             "da": ("in SQ la colonna Position di ses.results è vuota (verificato sui quattro "
                    "sprint 2026): la classifica viene dal miglior giro PER PILOTA")},
            {"grandezza": "canale DRS",
             "valore": "nullo su tutte le sessioni 2026",
             "stato": "NON_MISURABILE",
             "da": ("nessuna differenza qui misurata è attribuibile all'ala mobile: il canale "
                    "non distingue nulla")},
        ],
        "fonti": [
            {"tipo": "dati", "testo": (f"FastF1 3.8.3 — laps di Sprint Qualifying e Qualifying, "
                                       f"{gp_it} {anno} (cache locale)")},
            {"tipo": "metodo", "testo": ("ai_lab/redazione/genera_sprint_scalino.py — miglior "
                                         "giro soft per pilota, delta per settore reso RESIDUO "
                                         "della retta sul tempo in SQ, cancello su concordanza "
                                         "compagni vs non-compagni con null di permutazione delle "
                                         "etichette di squadra")},
        ],
    }
    return F, art


META = {
    "id": ID, "canale": "A",
    "titolo": "Lo scalino fra le due qualifiche (SQ vs Q, weekend sprint)",
    "tag": ["sprint", "qualifica", "assetto", "parco chiuso"],
    "descrizione": ("quanto è valso il parco chiuso aperto: delta soft-vs-soft per settore fra "
                    "Qualifica Sprint e Qualifica, al netto dello spostamento di giornata"),
    # "Q": il pezzo nasce quando esiste ANCHE la qualifica del sabato — prima non è
    # calcolabile. Si auto-salta da solo se l'evento non è un weekend sprint.
    "richiede": "laps", "gare": ["*"], "sessioni": ["Q"],
}


def genera(gara=None, data=None, sessione=None):
    if gara is None:
        return None
    anno = int(str(data)[:4]) if data else datetime.date.today().year
    try:
        r = costruisci(anno, gara, data_bozza=data)
    except Exception as e:
        print(f"  [sprint-scalino] {gara}: {e} — salto.")
        return None
    if not r:
        return None
    F, art = r
    bid = f"{ID}-{art['slug']}-{F['anno']}"
    art["id"] = bid
    base.scrivi_bozza(bid, art, F)
    return {"id": bid, "titolo": art["titolo"], "stato": art["stato"], "canale": "A"}


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--gara", required=True)
    ap.add_argument("--anno", type=int, default=2026)
    ap.add_argument("--data", default=None)
    ap.add_argument("--solo-misura", action="store_true")
    ap.add_argument("--diagnostica", action="store_true",
                    help="stampa il cancello anche quando è CHIUSO (per il collaudo)")
    a = ap.parse_args()
    if a.diagnostica:
        m = _misura(a.anno, a.gara)
        if not m:
            print(f"{a.gara}: non è un weekend sprint, o campione insufficiente")
            sys.exit(1)
        C, G = m["conc"], m["conc_grezza"]
        tot_c = C["comp_ok"] + C["comp_no"]
        tot_n = C["nc_ok"] + C["nc_no"]
        gt_c = G["comp_ok"] + G["comp_no"]
        gt_n = G["nc_ok"] + G["nc_no"]
        print(f"{a.gara}: soft SQ {m['n_soft_sq']}/{m['n_piloti_sq']} · confrontati "
              f"{len(m['comuni'])} · coppie compagni {m['coppie_comp']}")
        print(f"  regressione verso la media: Spearman(SQ, delta) = "
              f"{m['spearman_livello']:+.3f} · pendenze per settore "
              f"{[round(x,3) for x in m['pendenze']]}")
        print(f"  [SCARTATO] segni GREZZI: compagni {G['comp_ok']}/{gt_c} = "
              f"{100*G['comp_ok']/gt_c:.1f}% · non-compagni {G['nc_ok']}/{gt_n} = "
              f"{100*G['nc_ok']/gt_n:.1f}% · Fisher p={G['p_fisher']:.4f} · "
              f"permutazione p={G['p_perm']:.4f}")
        print(f"  [CANCELLO] segni sui RESIDUI: compagni {C['comp_ok']}/{tot_c} = "
              f"{100*C['comp_ok']/tot_c:.1f}% · non-compagni {C['nc_ok']}/{tot_n} = "
              f"{100*C['nc_ok']/tot_n:.1f}% · permutazione p={C['p']:.4f} "
              f"(Fisher sarebbe {C['fisher_sui_residui']:.4f}) → "
              f"{'APERTO' if C['p'] < P_MAX else 'CHIUSO'} (soglia {P_MAX})")
        print(f"  spostamento di giornata per settore (diagnostica): "
              f"{[round(x,3) for x in m['med_sett']]} (tot {sum(m['med_sett']):.3f})")
        for t in m["squadre"]:
            print(f"    {t['team'][:18]:18} residuo {-t['rel_tot']:+.3f} s  "
                  f"(vecchio conto mediana {-t['vecchio_tot']:+.3f})  "
                  f"SQ medio {t['sq_medio']:.3f}  ({'+'.join(t['piloti'])})")
        sys.exit(0)
    r = costruisci(a.anno, a.gara, data_bozza=a.data)
    if not r:
        print(f"{a.gara}: cancello chiuso o evento senza sprint — nessuna bozza")
        sys.exit(1)
    F, art = r
    bid = f"{ID}-{art['slug']}-{F['anno']}"
    art["id"] = bid
    print(f"TITOLO: {art['titolo']}")
    print(f"  campione: {F['campione']['piloti_confrontati']}/"
          f"{F['campione']['piloti_in_sessione']} piloti, {F['campione']['squadre']} squadre, "
          f"{F['campione']['coppie_di_compagni']} coppie di compagni")
    print(f"  cancello: compagni {it(F['cancello']['concordanza_compagni'],1)}% vs "
          f"non-compagni {it(F['cancello']['concordanza_non_compagni'],1)}% · "
          f"p={F['cancello']['fisher_p']:.4f}")
    print(f"  spostamento di giornata: {it(F['spostamento_di_giornata']['totale'],3)} s")
    for t in F["squadre"]:
        print(f"    {t['team'][:18]:18} {t['guadagno_netto_s']:+.3f} s "
              f"({', '.join(t['piloti'])})")
    if not a.solo_misura:
        out = base.scrivi_bozza(bid, art, F)
        print(f"  Bozza {bid} scritta in {out} (prosa {art.get('scrittura','template')})")
