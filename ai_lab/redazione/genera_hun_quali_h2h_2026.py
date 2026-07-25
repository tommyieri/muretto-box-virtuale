"""
Articolo (Canale B): "H2H tra compagni in qualifica — il cronometro dice
Antonelli, la griglia dice Russell".

Tema: il duello interno più pulito che esista in una monoposto — lo stesso mezzo,
due piloti. Sul GIRO SECCO delle qualifiche d'Ungheria (Hungaroring, round 11,
2026) misuriamo il distacco fra ogni coppia di compagni: il miglior giro di
ciascun pilota nella sessione Q (FastF1 pick_fastest), gap = più lento − più
veloce. In evidenza il rookie Antonelli che mette +0,281 su Russell (Mercedes) e
Norris che mette +0,477 su Piastri (McLaren).

Onestà obbligatoria:
  1) QUALI ≠ GRIGLIA. I nostri numeri sono il CRONOMETRO della qualifica. Sulla
     griglia di gara Hamilton scala da P2 a P5 (−3, impeding su Piastri alla
     curva 1) e Antonelli da P4 a P7 (−3, mancato rallentamento sotto le gialle):
     così Antonelli, che ha battuto Russell sul cronometro, scatterà DIETRO di lui
     (P7 contro P6). Ogni sezione lo dichiara.
  2) Confonditori dichiarati — letti bene. pick_fastest prende il MIGLIOR giro,
     che è un giro PULITO: i settori-distacco (RUS in S3, PIA fra S1 e S3) sono
     passo vero, non artefatti (sul giro di riferimento l'S3 di RUS è il suo più
     veloce della sessione, l'S1 di PIA il suo migliore). Il confonditore vero sta
     nel giro FINALE che i due più lenti non hanno sfruttato: l'ultimo lanciato di
     Russell è a +1,8 s dal suo riferimento (perdita d'acqua, auto fermata) e
     Piastri non mette a referto un tempo valido nell'ultimo run (impeding di
     Hamilton alla curva 1 — un intralcio, NON una collisione). Su pista in
     evoluzione — dove ANT e NOR hanno migliorato fino all'ultimo giro — il margine
     misurato può sovrastimare il divario di passo puro.
  3) Il gap Antonelli–Russell "0,035 s" che gira su motorsport.com è incoerente
     con la Q3 e NON viene usato: valgono i nostri numeri (+0,281).
  4) Niente energia/ERS/deployment: canali assenti nel 2026, pura speculazione.
  5) Sessione asciutta, nessuna bandiera rossa: nessun meteo inventato.

python3 UTENTE (fastf1 3.8.3), NON la .venv. Solo lettura; bozza nell'area Lab.
"""
from __future__ import annotations
import os
import sys
import statistics as stt   # noqa: F401  (coerenza con gli altri generatori)

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele   # noqa: E402
import svg    # noqa: E402
import base   # noqa: E402

ID = "hun-quali-h2h-2026"
ANNO, GP, SES = 2026, "Hungary", "Q"
GP_IT, CIRC, ROUND = "Ungheria", "Hungaroring", 11
DATA_DEFAULT = "2026-07-26"

# Coppie in evidenza (identificate per NOME-TEAM da FastF1, non per sigla cablata)
TEAM_MERC = "Mercedes"   # ANT batte RUS — leva: il rookie italiano sul compagno
TEAM_MCL = "McLaren"     # NOR batte PIA

# Griglia post-penalità: FATTO UFFICIALE (commissari), non una nostra misura.
# Qualifica: NOR P1, HAM P2, LEC P3, ANT P4, PIA P5, VER P6, RUS P7.
# Penalità −3 a HAM (impeding Piastri, curva 1) e −3 ad ANT (mancato rallentamento
# sotto le gialle): HAM → P5, ANT → P7, RUS risale a P6. → ANT dietro RUS.
GRIGLIA = {
    "HAM": {"quali": 2, "grid": 5, "motivo": "impeding su Piastri alla curva 1"},
    "ANT": {"quali": 4, "grid": 7, "motivo": "mancato rallentamento sotto le gialle"},
    "RUS": {"quali": 7, "grid": 6, "motivo": "nessuna penalità (risale)"},
}

# Citazione VERIFICATA (F1.com) — unica dichiarazione attribuita nel pezzo.
CIT_NOR = ("I'm very, very happy - very happy to be back on top. A tough, tough Quali.")


def it(x, dec=1):
    return base.it(x, dec)


def mil(g):
    """Gap in secondi -> stringa in millesimi interi (es. 0.281 -> '281')."""
    return str(int(round(g * 1000)))


# ------------------------------------------------------------------ misura -----
def best_laps(ses, piloti):
    """Miglior giro di sessione di ogni pilota (giro secco), coi suoi settori.
    Fonte: FastF1 pick_fastest sui giri del pilota. Ritorna sigla -> dict."""
    out = {}
    for sig, info in piloti.items():
        try:
            fl = ses.laps.pick_drivers(info["num"]).pick_fastest()
        except Exception:
            fl = None
        if fl is None or fl["LapTime"] != fl["LapTime"]:
            continue
        lap = tele.secondi(fl["LapTime"])
        if lap is None:
            continue
        try:
            lapn = int(fl["LapNumber"]) if fl["LapNumber"] == fl["LapNumber"] else None
        except Exception:
            lapn = None
        out[sig] = {
            "team": info["team"], "num": info["num"], "lap": lap, "lap_n": lapn,
            "s1": tele.secondi(fl["Sector1Time"]),
            "s2": tele.secondi(fl["Sector2Time"]),
            "s3": tele.secondi(fl["Sector3Time"]),
        }
    return out


def run_finale(ses, num, best_lapn, best_time):
    """Stato del giro FINALE del pilota rispetto al suo giro veloce.

    Il giro secco (pick_fastest) prende il miglior giro della sessione, che NON è
    per forza l'ultimo tentativo: se l'ultimo run è compromesso, il riferimento
    resta un giro precedente e l'evento esterno NON gonfia il tempo misurato.
    Questo distingue chi ha migliorato fino all'ultimo da chi è stato privato del
    run finale (il vero confonditore).

    Ritorna dict:
      best_finale: il giro veloce è l'ultimo lanciato ACCURATO completato.
      delta_finale: se ne ha completato uno più tardi e più lento, di quanto (s).
      tentativo_dopo: è rientrato in pista dopo il best senza completare un
                      lanciato valido (run finale abortito/senza tempo).
    """
    dl = ses.laps.pick_drivers(num)
    comp = []          # (lapn, time) giri lanciati accurati completati
    max_run = best_lapn
    for _, l in dl.iterrows():
        ln = l["LapNumber"]
        if ln != ln:
            continue
        ln = int(ln)
        max_run = max(max_run, ln)
        lt = tele.secondi(l["LapTime"])
        if bool(l.get("IsAccurate", False)) and lt is not None and lt < best_time * 1.12:
            comp.append((ln, lt))
    last_comp = max(comp, key=lambda x: x[0]) if comp else (best_lapn, best_time)
    best_finale = (last_comp[0] == best_lapn)
    delta_finale = None if best_finale else (last_comp[1] - best_time)
    return {"best_finale": best_finale, "delta_finale": delta_finale,
            "tentativo_dopo": max_run > last_comp[0]}


def sett_pb(ses, num, chiave, valore):
    """True se il tempo `valore` nel settore `chiave` ('s1'|'s2'|'s3') è il
    migliore del pilota nella sessione (giro pulito): serve a dire, in modo
    verificabile, che il settore-distacco è misurato su un giro NON sporcato."""
    col = {"s1": "Sector1Time", "s2": "Sector2Time", "s3": "Sector3Time"}[chiave]
    dl = ses.laps.pick_drivers(num)
    vals = [tele.secondi(l[col]) for _, l in dl.iterrows()
            if bool(l.get("IsAccurate", False)) and tele.secondi(l[col]) is not None]
    if not vals or valore is None:
        return False
    return abs(valore - min(vals)) < 1e-6


def coppie(best):
    """Tutte le coppie di compagni con due giri validi: {team, fast, slow, gap,
    t_fast, t_slow, ds1, ds2, ds3}. gap = più lento − più veloce (>0)."""
    byteam = {}
    for sig, d in best.items():
        byteam.setdefault(d["team"], []).append(sig)
    out = []
    for team, sigs in byteam.items():
        val = [s for s in sigs if best[s]["lap"] is not None]
        if len(val) != 2:
            continue
        val.sort(key=lambda s: best[s]["lap"])
        f, s = val
        bf, bs = best[f], best[s]
        d = {"team": team, "fast": f, "slow": s,
             "gap": bs["lap"] - bf["lap"], "t_fast": bf["lap"], "t_slow": bs["lap"]}
        # decomposizione per settore (dove si accumula il distacco) se disponibile
        if None not in (bf["s1"], bf["s2"], bf["s3"], bs["s1"], bs["s2"], bs["s3"]):
            d["ds1"] = bs["s1"] - bf["s1"]
            d["ds2"] = bs["s2"] - bf["s2"]
            d["ds3"] = bs["s3"] - bf["s3"]
        out.append(d)
    out.sort(key=lambda p: -p["gap"])
    return out


# ------------------------------------------------------------- costruzione -----
def costruisci(data_bozza=None):
    ses = tele.carica_sessione(ANNO, GP, SES)
    piloti = tele.piloti_sessione(ses)
    colori = base.carica_colori()
    col = lambda t: colori.get(t) or "var(--dim)"

    best = best_laps(ses, piloti)
    pairs = coppie(best)
    if not pairs:
        return None

    idx = {p["team"]: p for p in pairs}
    merc = idx[TEAM_MERC]      # ANT > RUS
    mcl = idx[TEAM_MCL]        # NOR > PIA

    # spread di griglia: coppia più larga e più stretta
    p_max = pairs[0]
    p_min = pairs[-1]

    # rango delle due coppie in evidenza fra tutte
    n_coppie = len(pairs)
    rank_merc = pairs.index(merc) + 1
    rank_mcl = pairs.index(mcl) + 1

    # team di testa: i 4 col miglior giro assoluto (il gruppo che lotta per la pole)
    front_teams = [t for t, _ in sorted(
        {p["team"]: p["t_fast"] for p in pairs}.items(), key=lambda kv: kv[1])[:4]]
    front = sorted([p for p in pairs if p["team"] in front_teams],
                   key=lambda p: -p["gap"])
    rank_merc_front = front.index(merc) + 1   # posizione fra i team di testa

    # deficit di HAM dalla pole (nostro dato, ancora al cronometro)
    pole_sig = min(best, key=lambda s: best[s]["lap"])
    ham_pole_def = (best["HAM"]["lap"] - best[pole_sig]["lap"]) if "HAM" in best else None

    # Confonditori, letti bene: il giro secco (pick_fastest) è un giro PULITO. Chi
    # ha migliorato fino all'ultimo (ANT, NOR) vs chi è stato privato del run finale
    # (RUS guasto d'acqua, PIA impeding). Il settore-distacco è misurato su un giro
    # non sporcato → è passo vero; l'asterisco sta nel giro finale mancato.
    rf = {sig: run_finale(ses, best[sig]["num"], best[sig]["lap_n"], best[sig]["lap"])
          for sig in (merc["fast"], merc["slow"], mcl["fast"], mcl["slow"])
          if best.get(sig) and best[sig]["lap_n"] is not None}
    # il settore-distacco delle due coppie cade su un settore-migliore del più lento?
    rus_s3_pb = sett_pb(ses, best[merc["slow"]]["num"], "s3", best[merc["slow"]]["s3"])
    pia_s1_pb = sett_pb(ses, best[mcl["slow"]]["num"], "s1", best[mcl["slow"]]["s1"])

    F = {
        "id": ID, "anno": ANNO, "gp": GP_IT, "circuito": CIRC, "round": ROUND,
        "sessione": "Qualifiche", "n_coppie": n_coppie,
        "pole": {"sigla": pole_sig, "team": best[pole_sig]["team"],
                 "lap": best[pole_sig]["lap"]},
        "coppie": [{k: p[k] for k in p} for p in pairs],
        "featured": {
            "Mercedes": {k: merc[k] for k in merc},
            "McLaren": {k: mcl[k] for k in mcl},
        },
        "spread": {"max": {"team": p_max["team"], "fast": p_max["fast"],
                           "slow": p_max["slow"], "gap": p_max["gap"]},
                   "min": {"team": p_min["team"], "fast": p_min["fast"],
                           "slow": p_min["slow"], "gap": p_min["gap"]}},
        "rank_merc": rank_merc, "rank_mcl": rank_mcl,
        "front_teams": front_teams, "rank_merc_front": rank_merc_front,
        "n_front": len(front),
        "ham_pole_def": ham_pole_def,
        "griglia": GRIGLIA,
        "run_finale": rf,
        "rus_s3_pb": rus_s3_pb, "pia_s1_pb": pia_s1_pb,
        "lap_ref": {s: best[s]["lap_n"] for s in
                    (merc["fast"], merc["slow"], mcl["fast"], mcl["slow"]) if best.get(s)},
    }

    # ------------------------------------------------------------- grafici ------
    def etich(p):
        return f"{p['fast']} › {p['slow']}"   # "ANT › RUS" (più veloce › più lento)

    # grafico1 (EROE): barre del gap fra compagni, per coppia. Le due in evidenza
    # (Mercedes, McLaren) a piena opacità; le altre attenuate, come contesto.
    barre1 = [{"sigla": etich(p), "colore": col(p["team"]), "valore": p["gap"],
               "evidenza": p["team"] in (TEAM_MERC, TEAM_MCL)} for p in pairs]
    svg1 = svg.barre_dv(
        barre1, dec=3, base=0.0, ml=104,
        titolo="Il duello interno: distacco fra compagni sul giro secco",
        sub=f"Qualifiche {GP_IT} {ANNO} · {n_coppie} coppie",
        caption="distacco in secondi del compagno più lento (miglior giro di sessione)")

    # grafico2: dove si accumula il distacco — decomposizione per settore delle
    # due coppie in evidenza. Evidenzia i settori-chiave (i confonditori dichiarati).
    def righe_settori(p, evi):
        return [
            {"sigla": f"{p['slow']} · S1", "colore": col(p["team"]),
             "valore": p["ds1"], "evidenza": "S1" in evi},
            {"sigla": f"{p['slow']} · S2", "colore": col(p["team"]),
             "valore": p["ds2"], "evidenza": "S2" in evi},
            {"sigla": f"{p['slow']} · S3", "colore": col(p["team"]),
             "valore": p["ds3"], "evidenza": "S3" in evi},
        ]
    # Evidenziati i settori dove il distacco è più largo (su giri PULITI: è passo
    # vero, non i confonditori — quelli stanno nel giro finale mancato, non qui).
    # RUS: soprattutto S3 · PIA: fra S1 e S3.
    barre2 = righe_settori(merc, {"S3"}) + righe_settori(mcl, {"S1", "S3"})
    svg2 = svg.barre_dv(
        barre2, dec=3, base=0.0, ml=104,
        titolo="Dove si perde il tempo: il distacco settore per settore",
        sub=f"{merc['slow']} vs {merc['fast']} · {mcl['slow']} vs {mcl['fast']}",
        caption="distacco per settore dal compagno (s) · S1–S3 sul giro secco")

    # --------------------------------------------------------------- prosa ------
    def sg(s):
        return f"{s} ({best[s]['team']})"

    g = GRIGLIA
    occhiello = f"Cronometro delle qualifiche · {GP_IT} {ANNO} · round {ROUND}"
    titolo = f"Antonelli mette {mil(merc['gap'])} millesimi su Russell. Poi la griglia ribalta tutto."
    sommario = (
        f"Il duello più pulito è quello interno: stessa monoposto, due piloti. Sul giro "
        f"secco delle qualifiche d’Ungheria il rookie Antonelli batte Russell di "
        f"<b>+{it(merc['gap'],3)}</b> (Mercedes) e Norris batte Piastri di "
        f"<b>+{it(mcl['gap'],3)}</b> (McLaren). Ma sono numeri del CRONOMETRO, non della "
        f"griglia: con la penalità Antonelli scatterà P{g['ANT']['grid']}, dietro il "
        f"compagno che ha appena battuto. E su entrambi i confronti pesa un asterisco.")

    sez_evi = (
        f"<p>Il confronto fra compagni di squadra è l’unico che azzera la vettura: "
        f"stessa monoposto, stesso muretto, cambia la mano del pilota. Lo misuriamo sul "
        f"<b>giro secco</b> — il miglior giro di ciascun pilota nella sessione di "
        f"qualifica (FastF1), distacco = più lento meno più veloce.</p>"
        f"<p>In casa <b>Mercedes</b> il rookie <b>{merc['fast']}</b> mette "
        f"<b>+{it(merc['gap'],3)}</b> ({mil(merc['gap'])} millesimi) sul più esperto "
        f"<b>{merc['slow']}</b>; in casa <b>McLaren</b> <b>{mcl['fast']}</b> ne mette "
        f"<b>+{it(mcl['gap'],3)}</b> su <b>{mcl['slow']}</b>. Non sono i margini più larghi "
        f"dello schieramento — il più ampio è {sg(F['spread']['max']['fast'])} su "
        f"{F['spread']['max']['slow']} (+{it(F['spread']['max']['gap'],3)}), il più stretto "
        f"{sg(F['spread']['min']['fast'])} su {F['spread']['min']['slow']} "
        f"(+{it(F['spread']['min']['gap'],3)}) — ma fra i quattro team davanti raccontano "
        f"molto: Norris firma il divario interno più netto del gruppo di testa, Antonelli il "
        f"secondo, e lo fa da debuttante contro un compagno di ben altra esperienza. Il "
        f"cronometro, qui, è nudo.</p>")

    rus_delta = rf.get(merc["slow"], {}).get("delta_finale")
    rus_fin = (f"a <b>+{it(rus_delta,1)} s</b> dal suo riferimento" if rus_delta is not None
               else "un tempo compromesso")
    rus_s3_clau = ("anzi, il suo S3 lì è il più veloce dell’intera sessione"
                   if rus_s3_pb else "senza settori sporcati")
    pia_s1_clau = ("il suo miglior S1 della sessione" if pia_s1_pb else "l’S1 di quel giro")
    sez_causa = (
        f"<p>Dove si accumula il distacco lo dicono i settori. Su <b>{merc['slow']}</b> il "
        f"ritardo da {merc['fast']} è quasi tutto nel <b>settore 3</b> "
        f"(<b>+{it(merc['ds3'],3)}</b> dei +{it(merc['gap'],3)} totali, contro "
        f"+{it(merc['ds1'],3)} e +{it(merc['ds2'],3)} nei primi due); su <b>{mcl['slow']}</b> "
        f"si divide fra il <b>settore 1</b> (<b>+{it(mcl['ds1'],3)}</b>) e il settore 3 "
        f"(+{it(mcl['ds3'],3)}), col centrale quasi in pari (+{it(mcl['ds2'],3)}). Ma "
        f"attenzione a leggerli: sono settori di giri <b>puliti</b>. Il «giro secco» prende il "
        f"miglior giro di ciascuno, non l’ultimo: quello di {merc['slow']} è netto ({rus_s3_clau}) "
        f"e quello di {mcl['slow']} porta {pia_s1_clau}. Non c’è nulla di sporco lì dentro: quel "
        f"divario è passo vero.</p>"
        f"<p>L’asterisco è un altro, e sta nel <b>giro finale</b> — quello che {merc['slow']} e "
        f"{mcl['slow']} non hanno potuto sfruttare. Su una pista in evoluzione {merc['fast']} e "
        f"{mcl['fast']} hanno firmato il loro tempo migliore proprio sull’<b>ultimo</b> "
        f"lanciato; i compagni no. L’ultimo giro di {merc['slow']} è arrivato {rus_fin} — "
        f"coerente con le cronache, che parlano di una perdita d’acqua e dell’auto fermata — "
        f"mentre {mcl['slow']} è rientrato per l’ultimo run senza mettere a referto un tempo "
        f"valido, in quello che i media descrivono come un giro abortito alla curva 1 per "
        f"l’impeding di Hamilton (un intralcio, non un contatto). Morale: i due più lenti si "
        f"sono giocati un’ultima carta che non ha reso, e su un asfalto che migliorava il "
        f"margine che misuriamo può <b>sovrastimare</b> il divario reale. Sono letture di "
        f"contesto, non nostre misure — e ciò che isolerebbe il passo puro (assetto, carico, "
        f"mappe motore) non è pubblico: non lo stimiamo di nascosto.</p>")

    sez_eff = (
        f"<p>Ed ecco il ribaltamento. Il cronometro dice {merc['fast']}; la <b>griglia</b> "
        f"dice {merc['slow']}. Perché la qualifica non è lo schieramento: "
        f"<b>{merc['fast']}</b>, quarto sul giro, incassa tre posizioni di penalità "
        f"({g['ANT']['motivo']}) e scatterà <b>P{g['ANT']['grid']}</b> — <b>dietro</b> "
        f"<b>{merc['slow']}</b>, che risale a <b>P{g['RUS']['grid']}</b>. Stessa sorte per "
        f"Hamilton, secondo sul cronometro a soli {it(F['ham_pole_def'],3)} dalla pole: "
        f"tre posizioni ({g['HAM']['motivo']}) lo portano da P{g['HAM']['quali']} a "
        f"<b>P{g['HAM']['grid']}</b>. Chi ha vinto il duello interno sul giro secco, davanti, "
        f"partirà comunque dietro chi ha perso.</p>"
        f"<p>Il giro secco resta la fotografia più onesta del passo di ciascuno — con i due "
        f"asterischi dichiarati. Il resto è cronaca, e la cronaca dice che è la prima pole "
        f"non-Mercedes della stagione, con Norris a interrompere una serie di dieci pole del "
        f"duo Mercedes e Hamilton a mancare per dodici millesimi il suo decimo giro-record "
        f"all’Hungaroring. «Tough, tough Quali», l’ha chiamata Norris. Sul "
        f"cronometro, comunque, il duello dei compagni l’hanno vinto i due che scatteranno "
        f"più indietro.</p>")

    figure = {
        "grafico1": {"svg": svg1,
            "didascalia": (
                f"Distacco fra compagni sul miglior giro di sessione, una barra per coppia "
                f"(ordinate dal margine più largo). In evidenza le due di testa: {merc['fast']} "
                f"› {merc['slow']} +{it(merc['gap'],3)} (Mercedes) e {mcl['fast']} › "
                f"{mcl['slow']} +{it(mcl['gap'],3)} (McLaren)."),
            "fonte": f"FastF1 · giri di qualifica (pick_fastest), {GP_IT} {ANNO}"},
        "grafico2": {"svg": svg2,
            "didascalia": (
                f"Il distacco spezzato nei tre settori, misurato sui giri PULITI migliori di "
                f"ciascuno: {merc['slow']} cede soprattutto in S3, {mcl['slow']} fra S1 e S3 — "
                f"divari di passo reali. Gli asterischi (guasto d’acqua per {merc['slow']}, "
                f"impeding per {mcl['slow']}) riguardano il giro FINALE mancato, non questi "
                f"settori."),
            "fonte": f"FastF1 · tempi sul giro e per settore, {GP_IT} {ANNO}"},
    }

    sezioni = [
        {"tag": "Evidenza",
         "titolo": f"Stessa monoposto, due piloti: {merc['fast']} +{it(merc['gap'],3)}, {mcl['fast']} +{it(mcl['gap'],3)}",
         "html": sez_evi, "figura": figure["grafico1"]},
        {"tag": "Causa",
         "titolo": "Dove si accumula il distacco — e i due asterischi",
         "html": sez_causa, "figura": figure["grafico2"]},
        {"tag": "Effetto",
         "titolo": "Il cronometro dice Antonelli, la griglia dice Russell",
         "html": sez_eff},
    ]

    def _descr_run(sig):
        r = rf.get(sig, {})
        gn = F["lap_ref"].get(sig)
        if r.get("best_finale"):
            return f"{sig} giro {gn} (best = ultimo lanciato completato)"
        d = r.get("delta_finale")
        return (f"{sig} giro {gn} (best NON finale; ultimo lanciato +{it(d,1)} s)"
                if d is not None else f"{sig} giro {gn}")
    ref_run_txt = " · ".join(_descr_run(s) for s in
                             (merc["fast"], merc["slow"], mcl["fast"], mcl["slow"]))

    articolo = {
        "id": ID, "stato": "bozza", "data": data_bozza or DATA_DEFAULT,
        "firma": "Muretto · Redazione tecnica", "accent": col(TEAM_MERC),
        "canale": "B (nostri dati, cronometro qualifica FastF1)",
        "gp": GP_IT, "gara": GP_IT, "circuito": CIRC, "sessione": "Qualifiche",
        "round": ROUND,
        "tag": ["qualifiche", "H2H", "compagni", "Mercedes", "McLaren", "Ungheria"],
        "occhiello": occhiello, "titolo": titolo, "sommario": sommario,
        "sezioni": [
            {**{k: s[k] for k in ("tag", "titolo", "html")},
             "figura": s.get("figura")}
            for s in sezioni
        ],
        "provenienza": [
            {"grandezza": "distacco fra compagni sul giro secco",
             "valore": (f"{merc['fast']}›{merc['slow']} +{it(merc['gap'],3)} (Mercedes) · "
                        f"{mcl['fast']}›{mcl['slow']} +{it(mcl['gap'],3)} (McLaren) · "
                        f"{n_coppie} coppie, spread +{it(F['spread']['min']['gap'],3)}–"
                        f"+{it(F['spread']['max']['gap'],3)}"),
             "stato": "MISURATO",
             "da": "FastF1 pick_fastest per pilota; gap = miglior giro più lento − più veloce"},
            {"grandezza": "decomposizione per settore (coppie in evidenza)",
             "valore": (f"{merc['slow']}: S1 +{it(merc['ds1'],3)} / S2 +{it(merc['ds2'],3)} / "
                        f"S3 +{it(merc['ds3'],3)} · {mcl['slow']}: S1 +{it(mcl['ds1'],3)} / "
                        f"S2 +{it(mcl['ds2'],3)} / S3 +{it(mcl['ds3'],3)}"),
             "stato": "MISURATO",
             "da": "tempi per settore del miglior giro (FastF1 Sector1/2/3Time)"},
            {"grandezza": "deficit di Hamilton dalla pole (al cronometro)",
             "valore": f"+{it(F['ham_pole_def'],3)} da {F['pole']['sigla']}",
             "stato": "MISURATO", "da": "differenza fra i migliori giri di HAM e della pole"},
            {"grandezza": "giro di riferimento e stato del run finale",
             "valore": ref_run_txt,
             "stato": "MISURATO",
             "da": ("numero del giro veloce (pick_fastest) e confronto con l’ultimo giro "
                    "lanciato accurato completato: distingue chi ha migliorato fino all’ultimo "
                    "(ANT, NOR) da chi ha il riferimento su un giro precedente (RUS)")},
            {"grandezza": "posizioni di griglia dopo le penalità",
             "valore": (f"ANT P{g['ANT']['grid']} (da P{g['ANT']['quali']}, −3) dietro "
                        f"RUS P{g['RUS']['grid']} · HAM P{g['HAM']['grid']} (da P{g['HAM']['quali']}, −3)"),
             "stato": "NON_MISURABILE",
             "da": "decisione dei commissari (fatto ufficiale), non ricavabile dalla telemetria"},
            {"grandezza": "passo puro depurato dai confonditori (guasto RUS, impeding PIA)",
             "valore": "non isolabile",
             "stato": "NON_MISURABILE",
             "da": ("il run finale di RUS (perdita d’acqua) e di PIA (impeding, giro abortito) "
                    "li ha privati di un possibile miglioramento su pista in evoluzione; il "
                    "tempo che avrebbero fatto non è stimabile. NB: i settori-distacco sono "
                    "misurati su giri PULITI precedenti, non su quelli compromessi")},
            {"grandezza": "assetto, carico e mappe motore (che spiegherebbero il residuo)",
             "valore": "non pubblici",
             "stato": "NON_MISURABILE",
             "da": "dati di regolazione della vettura non nel feed pubblico 2026"},
        ],
        "fonti": [
            {"tipo": "dati", "testo": (f"FastF1 3.8.3 — tempi sul giro e per settore, giri di "
                                       f"qualifica del Gran Premio d’Ungheria {ANNO} "
                                       f"(round {ROUND}, Hungaroring), cache locale")},
            {"tipo": "contesto", "testo": (
                "Penalità di griglia e cronaca della sessione (prima pole non-Mercedes della "
                "stagione; Hamilton a 12 millesimi dal decimo giro-record all’Hungaroring; "
                f"citazione Norris «{CIT_NOR}») — F1.com/stampa specializzata: contesto "
                "giornalistico, non nostri dati")},
            {"tipo": "metodo", "testo": (
                "ai_lab/redazione/genera_hun_quali_h2h_2026.py — H2H = miglior giro di sessione "
                "per pilota (FastF1 pick_fastest), gap fra compagni identificati per nome-team; "
                "decomposizione per settore dal medesimo giro. Il gap Antonelli–Russell «0,035 s» "
                "che circola su motorsport.com è incoerente con la Q3 e viene scartato: valgono i "
                "nostri +0,281. Confonditori dichiarati e NON corretti: il giro secco di ciascuno "
                "è un giro pulito (i settori-distacco sono passo vero, non eventi), ma il run "
                "finale di Russell (perdita d’acqua) e di Piastri (impeding, giro abortito) è "
                "andato perso — su pista in evoluzione il margine misurato può sovrastimare il "
                "divario reale.")},
        ],
    }
    return F, articolo


META = {
    "id": ID, "canale": "B",
    "titolo": "H2H compagni in qualifica: il cronometro dice Antonelli, la griglia dice Russell",
    "tag": ["qualifiche", "H2H", "compagni", "Mercedes", "McLaren"],
    "descrizione": "distacco fra compagni sul giro secco a Budapest (ANT +0,281 su RUS; NOR +0,477 su PIA)",
    "richiede": "telemetria", "gare": ["Ungheria"], "sessioni": ["Q"],
}


def genera(gara=None, data=None):
    if gara not in (None, "Ungheria", "Hungary", "Hungarian Grand Prix"):
        return None
    r = costruisci(data_bozza=data)
    if not r:
        return None
    F, art = r
    base.scrivi_bozza(ID, art, F)
    return {"id": ID, "titolo": art["titolo"], "stato": art["stato"], "canale": "B"}


if __name__ == "__main__":
    r = costruisci()
    if not r:
        print("nessuna coppia trovata"); sys.exit(1)
    F, art = r
    out = base.scrivi_bozza(ID, art, F)
    m, k = F["featured"]["Mercedes"], F["featured"]["McLaren"]
    print(f"Bozza {ID} scritta in {out}")
    print(f"  numero-chiave: {m['fast']}›{m['slow']} +{it(m['gap'],3)} (Mercedes) "
          f"[rango {F['rank_merc']}/{F['n_coppie']}, {F['rank_merc_front']}/{F['n_front']} fra i team di testa]")
    print(f"  seconda in evidenza: {k['fast']}›{k['slow']} +{it(k['gap'],3)} (McLaren) "
          f"[rango {F['rank_mcl']}/{F['n_coppie']}]")
    print(f"  settori RUS: S1 +{it(m['ds1'],3)} S2 +{it(m['ds2'],3)} S3 +{it(m['ds3'],3)}")
    print(f"  settori PIA: S1 +{it(k['ds1'],3)} S2 +{it(k['ds2'],3)} S3 +{it(k['ds3'],3)}")
    print(f"  spread: max {F['spread']['max']['fast']}›{F['spread']['max']['slow']} "
          f"+{it(F['spread']['max']['gap'],3)} · min {F['spread']['min']['fast']}›"
          f"{F['spread']['min']['slow']} +{it(F['spread']['min']['gap'],3)}")
    print(f"  griglia: ANT P{GRIGLIA['ANT']['grid']} dietro RUS P{GRIGLIA['RUS']['grid']} · "
          f"HAM P{GRIGLIA['HAM']['grid']}")
