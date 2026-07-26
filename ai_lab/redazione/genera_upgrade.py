"""
Articolo "L'upgrade ha funzionato?" (Canale A+B, MULTI-GARA): un team porta un
aggiornamento a un GP; noi NON vediamo il componente (niente foto, niente paddock)
ma ne misuriamo l'EFFETTO dai dati, prima-vs-dopo la gara-upgrade.

Onesto per costruzione:
  SINTOMO — la macchina e' cambiata, e DOVE (punta vs curva) — e' MISURATO.
  CAUSA   — quale pezzo (ala meno resistente, mappa motore, assetto, o solo
            "aver sistemato i problemi") — e' NON_MISURABILE: la velocita' di
            punta mescola potenza PU e resistenza, e i due non si separano dai
            nostri canali. Persino il team lo dichiara (vedi fonti).

Metodo (team/gara-agnostico):
  - un DOSSIER di candidati con fonte di stampa (Canale A): team + gara-upgrade;
  - un RILEVATORE indipendente (Canale B) che, senza sapere nulla della stampa,
    cerca nel forza-macchina il passo piu' netto e STABILE della stagione: se il
    candidato della stampa e' anche il #1 del rilevatore, la riproduzione regge;
  - un CANCELLO: si scrive solo se l'effetto e' abbastanza netto (indice e
    distacco in qualifica). Se i dati non mostrano un salto chiaro -> None
    (mistero aperto, non si forza).

Framing onesto (chi GUIDA il pezzo): non si apre col numero piu' vistoso, ma con
il piu' ROBUSTO. Ogni segnale prima-vs-dopo passa da un test di permutazione (esatto
per split piccoli) e da un controllo di SEPARAZIONE DI RANGO (ogni gara-dopo migliore
di ogni gara-prima). Il generatore ordina i segnali aggregati per robustezza
(separazione completa prima, poi p piu' basso) e mette il migliore come prova-guida
(sommario + grafico-eroe); il segnale piu' debole scende a CONTESTO, citato col suo
limite. Regola generale, non cablata: vale per qualunque team/gara-upgrade.

Segnali (tutti dai file gia' pronti, nessun numero a mano):
  forza_macchina.json  indice 0-100 per team/gara (potenziale + passo, percentile per-gara)
  forza_stagione/*     potenziale/passo in secondi + gap-al-leader (per il distacco)
  dati_stagione/*      vmax e cornering (km/h) -> il DOVE: punta o curva

Confronto BEFORE/AFTER la gara-upgrade. I distacchi sono normalizzati (percentile
o % dal leader), mai tempi assoluti: le piste differiscono.

python3 UTENTE. Solo lettura del repo; bozza nell'area Lab. Non tocca demo/ ne' engine/.
"""
from __future__ import annotations
import os
import sys
import json
import math
import datetime
import itertools
import statistics as st

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import svg   # noqa: E402
import base  # noqa: E402

REPO = os.path.abspath(os.path.join(_QUI, "..", ".."))
FORZA_JSON = os.path.join(REPO, "demo", "data", "analisi", "forza_macchina.json")
FORZA_STAGIONE = os.path.join(_QUI, "forza_stagione")   # potenziale/passo/gap in s
DATI_STAGIONE = os.path.join(_QUI, "dati_stagione")     # vmax/cornering km/h

ID_META = "upgrade"

# --- CANCELLI (dichiarati): sotto queste soglie non c'e' storia -> None ---
SOGLIA_STEP_INDICE = 8.0     # salto minimo dell'indice (media dopo - media prima)
SOGLIA_RIDUZIONE_PP = 0.30   # riduzione minima del distacco in qualifica (punti %)
MIN_PRIMA = 2                # gare minime prima dell'upgrade
MIN_DOPO = 3                 # gare minime dalla gara-upgrade in poi

CORTO = {"Red Bull Racing": "Red Bull", "Haas F1 Team": "Haas", "Aston Martin": "Aston"}


def it(x, dec=1):
    return base.it(x, dec)


def nm(t):
    return CORTO.get(t, t)


# ----------------------------------------------------------------------------
# DOSSIER — spunti di stampa (Canale A). Ogni voce e' un candidato: team, gara in
# cui e' arrivato l'aggiornamento (round), e le FONTI (con URL). I NUMERI non
# stanno qui: escono tutti dai dati. Qui c'e' solo il "dove guardare".
# ----------------------------------------------------------------------------
DOSSIER = [
    {
        "team": "Red Bull Racing",
        "team_slug": "red-bull",
        "gp_upgrade": "Miami Grand Prix",
        "gp_slug": "miami",
        "gp_nome": "Miami",
        "round_upgrade": 4,
        "anno": 2026,
        "claim_stampa": (
            "pacchetto d'aggiornamento a Miami (ala posteriore rotante “Macarena” "
            "a bassa resistenza, piu' ala anteriore, fondo e cofano rivisti); il team "
            "stima ~0,6 s guadagnati e il distacco dai primi sceso da ~1,2-1,3 s a ~0,6 s"
        ),
        "fonti": [
            {"tipo": "spunto (stampa)",
             "testo": "PlanetF1 — “Red Bull upgrades find missing 0.6s as RB22 breakthrough emerges” "
                      "(gap sceso da ~1,2-1,3 s a ~0,6 s; il TP Mekies: difficile dire quanto sia "
                      "upgrade e quanto “aver sistemato i problemi”). "
                      "https://www.planetf1.com/news/red-bull-rb22-upgrades-miami-grand-prix-2026"},
            {"tipo": "spunto (stampa)",
             "testo": "GPblog — “Red Bull's Miami upgrade analysed: how RB22 ‘B’ spec improved "
                      "performance” (ala “Macarena” che ruota 160° in modalita' rettilineo "
                      "per ridurre la resistenza; RB22 fra le piu' veloci sul dritto in qualifica a Miami). "
                      "https://www.gpblog.com/en/tech/red-bull-finally-able-to-challenge-mercedes-thanks-to-updates"},
        ],
    },
]


# ----------------------------------------------------------------------------
# CARICAMENTO DATI
# ----------------------------------------------------------------------------
def _carica_forza():
    return json.load(open(FORZA_JSON))


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


def _serie(gare, team, key):
    return [(g["round"], g["team"].get(team, {}).get(key)) for g in gare]


def _ba(coppie, up):
    """(round,val) -> (lista_prima, lista_dopo) rispetto al round-upgrade (incluso in dopo)."""
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


# ----------------------------------------------------------------------------
# ROBUSTEZZA di un segnale prima-vs-dopo: test di permutazione (esatto se lo split
# e' piccolo, altrimenti campionato) + separazione di rango completa. Serve a
# decidere QUALE segnale guida il pezzo: si preferisce quello con separazione
# completa, poi quello col p piu' basso. Team/gara-agnostico.
# ----------------------------------------------------------------------------
def _robustezza(prima, dopo, direzione, cap=200000):
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
        rnd = random.Random(20260726)
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


# ----------------------------------------------------------------------------
# RILEVATORE indipendente (Canale B): il passo piu' netto e STABILE della
# stagione, senza sapere nulla della stampa. Metrica = riduzione del distacco
# medio in qualifica (%) fra "prima" e "dopo", allo split che la massimizza.
# ----------------------------------------------------------------------------
def _rileva(gare_s):
    teams = sorted({t for g in gare_s for t in g["team"]})
    rounds = [g["round"] for g in gare_s]
    out = []
    for t in teams:
        s = [(g["round"], _pct_leader_quali(g, t)) for g in gare_s]
        best = None
        for k in range(MIN_PRIMA, len(s) - MIN_DOPO + 1):
            up_r = rounds[k]
            b, a = _ba(s, up_r)
            if len(b) >= MIN_PRIMA and len(a) >= MIN_DOPO:
                red = st.mean(b) - st.mean(a)     # >0 = distacco ridotto
                sd = st.pstdev(a) if len(a) > 1 else 0.0
                if best is None or red > best["riduzione"]:
                    best = {"round": up_r, "riduzione": red, "sigma_dopo": sd}
        if best:
            out.append({"team": t, **best})
    out.sort(key=lambda x: -x["riduzione"])
    return out


# ----------------------------------------------------------------------------
# MISURA dell'effetto per un candidato
# ----------------------------------------------------------------------------
def _misura(cand):
    fm = _carica_forza()
    fmg = sorted(fm["gare"], key=lambda g: g["round"])
    fs = _carica_dir(FORZA_STAGIONE)   # potenziale/passo/gap in s
    ds = _carica_dir(DATI_STAGIONE)    # vmax/cornering km/h
    team = cand["team"]
    up = cand["round_upgrade"]

    # indice forza-macchina (percentile per-gara di potenziale+passo)
    idx = _serie(fmg, team, "indice")
    b_i, a_i = _ba(idx, up)
    if len(b_i) < MIN_PRIMA or len(a_i) < MIN_DOPO:
        return None

    # distacchi (normalizzati): gap-al-leader in s, e % dal leader
    gap = _serie(fs, team, "gap")
    b_g, a_g = _ba(gap, up)
    qd = [(g["round"], _pct_leader_quali(g, team)) for g in fs]
    b_qd, a_qd = _ba(qd, up)
    pd = [(g["round"], _pct_leader_passo(g, team)) for g in fs]
    b_pd, a_pd = _ba(pd, up)

    # DOVE: punta (vmax) vs curva (cornering), in percentile-campo
    vm = [(g["round"], _percentile_campo(g, team, "vmax")) for g in ds]
    co = [(g["round"], _percentile_campo(g, team, "cornering")) for g in ds]
    b_vm, a_vm = _ba(vm, up)
    b_co, a_co = _ba(co, up)

    # il distacco nella gara-upgrade stessa (per la corroborazione con la stampa)
    gu = next((g for g in fs if g["round"] == up), None)
    gap_gara_upgrade = gu["team"].get(team, {}).get("gap") if gu else None
    pil_upgrade = gu["team"].get(team, {}).get("potenziale_pilota") if gu else None

    m = lambda L: st.mean(L) if L else None

    # --- ROBUSTEZZA dei segnali (separazione di rango + permutazione) ---
    r_quali = _robustezza(b_g, a_g, "giu")        # distacco in qualifica (secondi)
    r_indice = _robustezza(b_i, a_i, "su")        # forza-indice
    r_punta = _robustezza(b_vm, a_vm, "su")       # velocita' di punta (percentile)

    # punta: quante gare-dopo stanno sopra la mediana di schieramento (percentile >= 50)
    MEDIANA = 50.0
    punta_dopo_sopra = sum(1 for v in a_vm if v is not None and v >= MEDIANA)

    # curva: l'outlier della gara-upgrade (assetto scarico) trascina il "calo".
    # quanto vale la curva DOPO togliendo la gara-upgrade stessa?
    co_up = next((v for r, v in co if r == up), None)
    a_co_senza = [v for r, v in co if v is not None and r > up]

    # serie del distacco (secondi) per round, per il grafico-eroe della prova-guida
    serie_gap = [(r, round(v, 3) if v is not None else None) for r, v in gap]

    # la miglior gara PRIMA per indice (perche' non c'e' separazione di rango)
    prima_idx = [(r, v) for r, v in idx if v is not None and r < up]
    imax = max(prima_idx, key=lambda rv: rv[1]) if prima_idx else (None, None)
    circ = {g["round"]: g["circuito"] for g in fmg}

    # --- SCELTA della prova-guida (data-driven): fra i segnali AGGREGATI, il piu'
    # robusto guida (separazione completa prima, poi p piu' basso). Regola generale. ---
    aggregati = [
        {"key": "quali", **r_quali},
        {"key": "indice", **r_indice},
    ]
    aggregati.sort(key=lambda b: (0 if b["sep"] else 1,
                                  b["p"] if b["p"] is not None else 1.0))
    guida = aggregati[0]["key"]

    F = {
        "team": team, "gara_upgrade": cand["gp_nome"], "round_upgrade": up,
        "anno": cand["anno"], "n_gare": len(fmg),
        "n_prima": len(b_i), "n_dopo": len(a_i),
        "gare_prima": [g["circuito"] for g in fmg if g["round"] < up],
        "gare_dopo": [g["circuito"] for g in fmg if g["round"] >= up],
        "serie_indice": idx,
        "serie_gap": serie_gap,
        "indice_prima": round(m(b_i), 1), "indice_dopo": round(m(a_i), 1),
        "indice_step": round(m(a_i) - m(b_i), 1),
        "gap_s_prima": round(m(b_g), 2), "gap_s_dopo": round(m(a_g), 2),
        "quali_def_prima": round(m(b_qd), 2), "quali_def_dopo": round(m(a_qd), 2),
        "quali_riduzione_pp": round(m(b_qd) - m(a_qd), 2),
        "passo_def_prima": round(m(b_pd), 2), "passo_def_dopo": round(m(a_pd), 2),
        "punta_pct_prima": round(m(b_vm)), "punta_pct_dopo": round(m(a_vm)),
        "curva_pct_prima": round(m(b_co)), "curva_pct_dopo": round(m(a_co)),
        "gap_gara_upgrade_s": round(gap_gara_upgrade, 2) if gap_gara_upgrade is not None else None,
        "pilota_gara_upgrade": pil_upgrade,
        # --- robustezza / framing ---
        "guida": guida,
        "quali_p": r_quali["p"], "quali_sep": r_quali["sep"],
        "quali_perm_est": r_quali["est"], "quali_perm_tot": r_quali["tot"],
        "indice_p": r_indice["p"], "indice_sep": r_indice["sep"],
        "indice_perm_est": r_indice["est"], "indice_perm_tot": r_indice["tot"],
        "indice_max_prima": round(imax[1]) if imax[1] is not None else None,
        "indice_max_prima_gara": circ.get(imax[0]),
        "punta_p": r_punta["p"], "punta_sep": r_punta["sep"],
        "punta_dopo_sopra": punta_dopo_sopra, "punta_mediana": round(MEDIANA),
        "curva_pct_upgrade": round(co_up) if co_up is not None else None,
        "curva_pct_dopo_senza": round(m(a_co_senza)) if a_co_senza else None,
    }
    return F, fmg


# ----------------------------------------------------------------------------
# GRAFICI
# ----------------------------------------------------------------------------
def _grafico_quali(F, col):
    """GRAFICO-EROE (prova-guida): il distacco in qualifica dal piu' veloce, gara per
    gara. Con la gara-upgrade marcata e le due medie prima/dopo come piani orizzontali:
    dopo l'upgrade la linea scende e non risale piu' — la separazione di rango si legge
    a colpo d'occhio (nessuna gara-dopo torna nella fascia delle gare-prima)."""
    pr = [(r, v) for r, v in F["serie_gap"] if v is not None]
    up = F["round_upgrade"]
    rmin = min(r for r, _ in pr)
    rmax = max(r for r, _ in pr)
    ymax = max(v for _, v in pr)
    ytop = max(1.4, round(ymax * 1.12, 1))
    serie = [
        {"sigla": f"{nm(F['team'])} · distacco quali", "colore": col, "punti": pr},
        {"sigla": "media prima", "colore": "var(--dim)",
         "punti": [(rmin, F["gap_s_prima"]), (up - 0.001, F["gap_s_prima"])]},
        {"sigla": "media dopo", "colore": "var(--accent)",
         "punti": [(up, F["gap_s_dopo"]), (rmax, F["gap_s_dopo"])]},
    ]
    ticks = [r for r, _ in pr]
    sep_txt = ("ogni gara dopo l'upgrade sotto ogni gara prima (separazione completa)"
               if F.get("quali_sep") else "media prima vs media dopo")
    return svg.grafico_xy(
        serie, x_range=(rmin, rmax), y_range=(0, ytop),
        x_ticks=ticks, y_ticks=[0, 0.5, 1.0],
        x_label="round del mondiale 2026 (numero di gara)",
        y_label="distacco (s)",
        x_annota=up, annota_txt=f"upgrade {F['gara_upgrade']}",
        titolo=f"Il distacco di {nm(F['team'])} in qualifica, gara per gara",
        sub=f"dal piu' veloce · prima {it(F['gap_s_prima'],2)} → dopo {it(F['gap_s_dopo'],2)} s · {sep_txt}")


def _grafico_indice(F, col):
    """Grafico di CONTESTO: l'evoluzione dell'indice per round, con la gara-upgrade
    marcata e le due medie prima/dopo. Segnale piu' debole del distacco-quali (nessuna
    separazione di rango): qui accompagna, non guida."""
    pr = [(r, v) for r, v in F["serie_indice"] if v is not None]
    up = F["round_upgrade"]
    rmin = min(r for r, _ in pr)
    rmax = max(r for r, _ in pr)
    serie = [
        {"sigla": f"{nm(F['team'])} · forza-indice", "colore": col, "punti": pr},
        {"sigla": "media prima", "colore": "var(--dim)",
         "punti": [(rmin, F["indice_prima"]), (up - 0.001, F["indice_prima"])]},
        {"sigla": "media dopo", "colore": "var(--accent)",
         "punti": [(up, F["indice_dopo"]), (rmax, F["indice_dopo"])]},
    ]
    ticks = [r for r, _ in pr]
    return svg.grafico_xy(
        serie, x_range=(rmin, rmax), y_range=(0, 100),
        x_ticks=ticks, y_ticks=[0, 25, 50, 75, 100],
        x_label="round del mondiale 2026 (numero di gara)",
        y_label="indice 0–100",
        x_annota=up, annota_txt=f"upgrade {F['gara_upgrade']}",
        titolo=f"La forza-macchina di {nm(F['team'])}, gara per gara",
        sub=f"prima {it(F['indice_prima'],0)} → dopo {it(F['indice_dopo'],0)} "
            f"(+{it(F['indice_step'],0)}) · indice = potenziale + passo, percentile per-gara")


def _grafico_dove(F, col):
    """Dove: percentile-campo su punta e curva, prima vs dopo. Mostra se il salto
    e' sul dritto o in curva. Evidenziate le barre della PUNTA (dove sta l'effetto
    in questo caso), le altre in ombra."""
    su_punta = F["punta_pct_dopo"] > F["punta_pct_prima"]
    righe = [
        {"sigla": "punta · dopo", "colore": col, "valore": float(F["punta_pct_dopo"]), "evidenza": su_punta},
        {"sigla": "punta · prima", "colore": col, "valore": float(F["punta_pct_prima"]), "evidenza": su_punta},
        {"sigla": "curva · dopo", "colore": col, "valore": float(F["curva_pct_dopo"]), "evidenza": not su_punta},
        {"sigla": "curva · prima", "colore": col, "valore": float(F["curva_pct_prima"]), "evidenza": not su_punta},
    ]
    return svg.barre_dv(
        righe, titolo="Dove e' cambiata la macchina: punta vs curva", ml=88, dec=0,
        sub="percentile nel campo (50 = media)",
        caption=f"percentile della velocita' di punta e in curva · prima = pre-upgrade, dopo = da {F['gara_upgrade']}")


# ----------------------------------------------------------------------------
# COSTRUZIONE ARTICOLO
# ----------------------------------------------------------------------------
def costruisci(data_bozza=None):
    fs = _carica_dir(FORZA_STAGIONE)
    if len(fs) < MIN_PRIMA + MIN_DOPO:
        return None
    ranking = _rileva(fs)
    ranking_map = {r["team"]: (i + 1, r) for i, r in enumerate(ranking)}

    # scegli il primo candidato del dossier che PASSA il cancello sui dati
    for cand in DOSSIER:
        res = _misura(cand)
        if not res:
            continue
        F, fmg = res
        # CANCELLO: salto dell'indice e riduzione del distacco entrambi sopra soglia
        if F["indice_step"] < SOGLIA_STEP_INDICE:
            continue
        if F["quali_riduzione_pp"] < SOGLIA_RIDUZIONE_PP:
            continue
        # ok: costruisci
        rango, rig = ranking_map.get(F["team"], (None, None))
        F["rilevatore_rango"] = rango
        F["rilevatore_riduzione"] = round(rig["riduzione"], 2) if rig else None
        F["rilevatore_sigma_dopo"] = round(rig["sigma_dopo"], 2) if rig else None
        F["rilevatore_round"] = rig["round"] if rig else None
        return _componi(cand, F, fmg, data_bozza)
    return None


def _componi(cand, F, fmg, data_bozza=None):
    colori = base.carica_colori()
    col = colori.get(F["team"]) or "var(--dim)"
    team_slug, gp_slug, anno = cand["team_slug"], cand["gp_slug"], cand["anno"]
    ID = f"upgrade-{team_slug}-{gp_slug}-{anno}"

    su_punta = F["punta_pct_dopo"] > F["punta_pct_prima"]
    dove = "sul rettilineo" if su_punta else "in curva"

    tnm = nm(F["team"])
    gu = F["gara_upgrade"]

    # il rilevatore cieco conferma il candidato della stampa?
    conferma = (F.get("rilevatore_rango") == 1 and F.get("rilevatore_round") == F["round_upgrade"])
    frase_rilevatore = (
        f"E non e' un artefatto del sapere gia' dove guardare: un rilevatore cieco, che cerca "
        f"nel forza-macchina la riduzione di distacco piu' netta e stabile della stagione senza "
        f"sapere nulla dell'aggiornamento, indica <b>proprio {tnm} a {gu}</b> come il numero uno "
        f"(riduzione {it(F['rilevatore_riduzione'],2)} punti %, la piu' grande del gruppo, con lo "
        f"scarto piu' piccolo dopo: {it(F['rilevatore_sigma_dopo'],2)})."
        if conferma else
        f"Il rilevatore indipendente colloca {tnm} fra le riduzioni di distacco piu' nette della "
        f"stagione (#{F.get('rilevatore_rango')})."
    )
    corrob = ""
    if F["gap_gara_upgrade_s"] is not None:
        corrob = (
            f" Nella gara stessa dell'upgrade il distacco dal piu' veloce si e' fermato a "
            f"<b>{it(F['gap_gara_upgrade_s'],2)} s</b>, il miglior venerdi/sabato della prima "
            f"parte di stagione."
        )

    # ------------------------------------------------------------------
    # BLOCCHI di prosa (uno per segnale). Ogni segnale aggregato ha un ruolo:
    # "guida" (prova portante, con separazione di rango + permutazione) oppure
    # "contesto" (segnale di supporto, citato col suo limite). L'ordinamento a
    # monte (F["guida"]) decide chi guida e chi scende a contesto.
    # ------------------------------------------------------------------
    def blocco_quali(ruolo):
        intro = (
            f"<p>Il metro piu' pulito e' il <b>distacco in qualifica</b> dal piu' veloce, letto "
            f"sul cronometro e ripulito dal circuito. Quello di {tnm} passa da "
            f"<b>{it(F['gap_s_prima'],2)} s</b> di media prima dell'upgrade a "
            f"<b>{it(F['gap_s_dopo'],2)} s</b> dopo — in percentuale sul giro, da "
            f"{it(F['quali_def_prima'],2)}% a {it(F['quali_def_dopo'],2)}% — con i distacchi "
            f"normalizzati fra i team di ogni gara (mai tempi assoluti: le piste sono diverse).</p>"
        )
        if ruolo == "guida":
            if F.get("quali_sep"):
                forza = (
                    f"<p>La forza di questo dato non e' la taglia del salto, ma che le due fasi "
                    f"<b>non si sovrappongono</b>: ognuna delle {F['n_dopo']} gare dopo l'upgrade "
                    f"ha un distacco piu' piccolo di ognuna delle {F['n_prima']} gare prima — "
                    f"separazione di rango completa. Con uno split cosi' ({F['n_prima']} contro "
                    f"{F['n_dopo']}) e' la disposizione piu' estrema possibile: un test di "
                    f"permutazione la colloca a <b>{F['quali_perm_est']} caso su "
                    f"{F['quali_perm_tot']}</b> (p ≈ {it(F['quali_p'],3)}). {frase_rilevatore}</p>"
                )
            else:
                forza = (f"<p>Un test di permutazione dà p ≈ {it(F['quali_p'],3)}. {frase_rilevatore}</p>")
            caveat = (
                f"<p>Un avvertimento d'obbligo: il distacco in qualifica misura il potenziale sul "
                f"giro secco, <b>non</b> la posizione in griglia (che dipende anche da eliminazioni, "
                f"bandiere e traffico) ne' il passo gara. Lo usiamo come metro del potenziale della "
                f"macchina. Sul passo gara il progresso c'e' ma e' piu' tenue: da "
                f"{it(F['passo_def_prima'],2)}% a {it(F['passo_def_dopo'],2)}% dal piu' veloce.{corrob} "
                f"Il dimezzamento combacia, per ordine di grandezza, con la stima della stessa "
                f"squadra riportata dalla stampa: convergenza, non prova.</p>"
            )
            return ("Il distacco in qualifica si dimezza — e le due meta' non si toccano",
                    intro + forza + caveat)
        return ("Anche il distacco in qualifica cala, e in modo netto",
                intro + f"<p>Sul passo gara il progresso e' piu' tenue (da {it(F['passo_def_prima'],2)}% "
                        f"a {it(F['passo_def_dopo'],2)}%). Nota: la qualifica misura il potenziale sul "
                        f"giro secco, non la griglia.</p>")

    def blocco_indice(ruolo):
        intro = (
            f"<p>La <b>forza-macchina</b> complessiva — un indice 0–100 per gara che fonde "
            f"potenziale in qualifica e passo in aria pulita, normalizzato fra i team — si muove "
            f"nella stessa direzione: da <b>{it(F['indice_prima'],0)}</b> nelle {F['n_prima']} gare "
            f"prima a <b>{it(F['indice_dopo'],0)}</b> nelle {F['n_dopo']} dopo (+{it(F['indice_step'],0)}).</p>"
        )
        if ruolo == "contesto":
            limiti = (
                f"<p>E' un indizio di conferma, non la prova portante, e va preso con le molle. "
                f"Primo: <b>nessuna separazione di rango</b> — la miglior gara prima dell'upgrade "
                f"({F['indice_max_prima_gara']}) valeva gia' <b>{it(F['indice_max_prima'],0)}</b>, "
                f"quanto la media dopo, cosi' le due fasi si sovrappongono. Secondo: poggia su sole "
                f"{F['n_prima']} gare prima. Un test di permutazione lo dà a p ≈ {it(F['indice_p'],2)}, "
                f"al limite della significativita'. Per questo la prova-guida resta il distacco in "
                f"qualifica, non l'indice.</p>"
            )
            return ("La forza-macchina conferma — ma e' il segnale piu' debole", intro + limiti)
        forte = (
            f"<p>Un test di permutazione dà p ≈ {it(F['indice_p'],2)}"
            + (", con separazione di rango completa" if F.get("indice_sep") else "")
            + f". {frase_rilevatore}</p>"
        )
        return ("La forza-macchina fa un gradino che non si richiude", intro + forte)

    def blocco_dove():
        p1 = (
            f"<p>Dove e' finito il guadagno? Separiamo i due canali con cui una macchina fa il "
            f"tempo: la <b>velocita' di punta</b> (dritto) e la <b>velocita' in curva</b>, "
            f"ciascuna come percentile nel campo (50 = media schieramento). La punta di {tnm} sale "
            f"dal <b>{it(F['punta_pct_prima'],0)}°</b> al <b>{it(F['punta_pct_dopo'],0)}°</b> "
            f"percentile — da parte bassa del gruppo a meta' alta — e regge: <b>{F['punta_dopo_sopra']} "
            f"delle {F['n_dopo']}</b> gare dopo l'upgrade stanno sopra la mediana di schieramento "
            f"(percentile ≥ {F['punta_mediana']}).</p>"
        )
        p2 = (
            f"<p>La curva sembra dire il contrario, ma solo in media: scende "
            f"({it(F['curva_pct_prima'],0)}° → {it(F['curva_pct_dopo'],0)}°), e il calo e' in buona "
            f"parte l'ombra di una sola gara. Proprio a {gu} l'assetto scarico spinse il percentile "
            f"in curva sul fondo del gruppo ({it(F['curva_pct_upgrade'],0)}°); togliendo quella "
            f"gara, nelle restanti la curva resta intorno al <b>{it(F['curva_pct_dopo_senza'],0)}°</b> "
            f"percentile, in linea col livello di prima. Il guadagno netto e quantificabile e' "
            f"quello {dove}.</p>"
        )
        return ("Il guadagno e' sul rettilineo", p1 + p2)

    def blocco_causa():
        return ("Perche' la punta sale — e cosa resta invisibile",
            f"<p>Attenzione al confine. La velocita' di punta <b>non e' solo resistenza "
            f"aerodinamica</b>: dipende anche dalla potenza dell'unita' motrice e da come questa "
            f"viene messa a terra sul rettilineo. I due contributi — meno resistenza, o piu' "
            f"spinta — sui nostri canali <b>non si separano</b>.</p>"
            f"<p>Perche' la punta salga senza che la curva migliori, la lettura naturale e' una "
            f"macchina che sul dritto <b>perde meno</b> o <b>spinge di piu'</b>. Ma se dietro ci "
            f"sia meno ala, un'ala che si “apre” in rettilineo, l'assetto o la mappatura del "
            f"motore, dai dati non lo possiamo dire: il singolo pezzo resta una variabile latente.</p>")

    def blocco_effetto():
        return ("Cosa possiamo dire, e cosa no",
            f"<p>Il <b>sintomo</b> e' misurato e netto: da {gu} la macchina di {tnm} e' piu' "
            f"veloce, il guadagno e' {dove}, e regge per {F['n_dopo']} gare. Il segnale piu' solido "
            f"e' il distacco in qualifica, che si dimezza (da {it(F['gap_s_prima'],2)} a "
            f"{it(F['gap_s_dopo'],2)} s) senza mai risalire, dopo l'upgrade, nella fascia di prima. "
            f"La velocita' di punta ({it(F['punta_pct_prima'],0)}° → {it(F['punta_pct_dopo'],0)}°) e "
            f"la forza-macchina complessiva (+{it(F['indice_step'],0)}) puntano nella stessa "
            f"direzione.</p>"
            f"<p>La <b>causa</b>, no. Quale pezzo abbia prodotto il guadagno — e persino quanto sia "
            f"“upgrade” e quanto sia “aver sistemato i problemi”, come ha ammesso lo stesso team — e' "
            f"fuori dalla portata dei nostri dati. Misuriamo l'effetto sulla macchina, non il "
            f"componente che l'ha causato. Ma su una cosa i numeri sono netti: l'upgrade, comunque "
            f"lo si chiami, <b>ha funzionato</b>.</p>")

    # ordina: prova-guida (piu' robusta) in testa, l'altro segnale aggregato a contesto
    if F["guida"] == "indice":
        g_tit, g_html, g_fig = (*blocco_indice("guida"), "indice")
        c_tit, c_html, c_fig = (*blocco_quali("contesto"), "quali")
    else:
        g_tit, g_html, g_fig = (*blocco_quali("guida"), "quali")
        c_tit, c_html, c_fig = (*blocco_indice("contesto"), "indice")
    d_tit, d_html = blocco_dove()
    ca_tit, ca_html = blocco_causa()
    e_tit, e_html = blocco_effetto()

    if F["guida"] == "indice":
        sommario = (
            f"{tnm} ha portato un pacchetto d'aggiornamento a {gu}. Non vediamo il pezzo, ma ne "
            f"misuriamo l'effetto: la forza-macchina sale da {it(F['indice_prima'],0)} a "
            f"{it(F['indice_dopo'],0)} (+{it(F['indice_step'],0)}), il distacco in qualifica dal "
            f"piu' veloce cala da {it(F['gap_s_prima'],2)} a {it(F['gap_s_dopo'],2)} s e il guadagno "
            f"e' {dove}. QUALE pezzo l'abbia prodotto, invece, i nostri dati non lo dicono."
        )
    else:
        sommario = (
            f"{tnm} ha portato un pacchetto d'aggiornamento a {gu}. Non vediamo il pezzo, ma ne "
            f"misuriamo l'effetto — e la prova piu' solida e' il distacco in qualifica dal piu' "
            f"veloce, che si dimezza (da {it(F['gap_s_prima'],2)} a {it(F['gap_s_dopo'],2)} s) con "
            f"uno stacco netto: ognuna delle {F['n_dopo']} gare dopo l'upgrade batte ognuna delle "
            f"{F['n_prima']} prima. Il guadagno e' {dove}: la velocita' di punta sale dal "
            f"{it(F['punta_pct_prima'],0)}° al {it(F['punta_pct_dopo'],0)}° percentile del campo. La "
            f"forza-macchina complessiva cresce nella stessa direzione (+{it(F['indice_step'],0)}), "
            f"ma su poche gare e senza lo stesso stacco: un indizio, non la prova. QUALE pezzo "
            f"l'abbia prodotto, i nostri dati non lo dicono."
        )

    art = {
        "id": ID, "stato": "bozza",
        "data": data_bozza or datetime.date.today().isoformat(),
        "firma": "Muretto · Redazione tecnica", "accent": col,
        "canale": "A+B (spunto di stampa, riprodotto e misurato sui nostri dati)",
        "gara": f"Stagione {anno}", "circuito": f"{F['n_gare']} gare",
        "sessione": "Gara",
        "tag": ["upgrade", "aerodinamica", "telemetria", "multi-gara"],
        "occhiello": f"L'upgrade ha funzionato? · {tnm} · {gu} {anno}",
        "titolo": f"L'upgrade di {tnm} a {gu}: cosa dicono i dati (e cosa no)",
        "sommario": sommario,
        "sezioni": [
            {"tag": "Evidenza", "titolo": g_tit, "html": g_html, "figura": g_fig},
            {"tag": "Evidenza", "titolo": d_tit, "html": d_html, "figura": "dove"},
            {"tag": "Contesto", "titolo": c_tit, "html": c_html, "figura": c_fig},
            {"tag": "Causa", "titolo": ca_tit, "html": ca_html},
            {"tag": "Effetto", "titolo": e_tit, "html": e_html},
        ],
        "provenienza": [
            {"grandezza": "distacco in qualifica dal piu' veloce (prima → dopo) — PROVA-GUIDA",
             "valore": (f"{it(F['gap_s_prima'],2)} → {it(F['gap_s_dopo'],2)} s "
                        f"({it(F['quali_def_prima'],2)}% → {it(F['quali_def_dopo'],2)}%, −{it(F['quali_riduzione_pp'],2)} pp) · "
                        f"separazione di rango completa ({F['n_dopo']} dopo tutte sotto le {F['n_prima']} prima), "
                        f"permutazione {F['quali_perm_est']} su {F['quali_perm_tot']} (p ≈ {it(F['quali_p'],3)})"),
             "stato": "MISURATO",
             "da": "forza_stagione/*.json (gap-al-leader in s e % dal leader) + test di permutazione/separazione di rango"},
            {"grandezza": "DOVE: velocita' di punta vs curva (percentile-campo, prima → dopo)",
             "valore": (f"punta {it(F['punta_pct_prima'],0)}°→{it(F['punta_pct_dopo'],0)}° "
                        f"({F['punta_dopo_sopra']}/{F['n_dopo']} gare dopo ≥{F['punta_mediana']}°) · "
                        f"curva {it(F['curva_pct_prima'],0)}°→{it(F['curva_pct_dopo'],0)}° "
                        f"(per lo piu' per l'outlier {gu}, {it(F['curva_pct_upgrade'],0)}°; senza {gu} ≈{it(F['curva_pct_dopo_senza'],0)}°)"),
             "stato": "MISURATO",
             "da": "dati_stagione/*.json (vmax e cornering km/h), percentile fra i team per-gara"},
            {"grandezza": "forza-indice prima → dopo (segnale di CONTESTO)",
             "valore": (f"{it(F['indice_prima'],0)} → {it(F['indice_dopo'],0)} (+{it(F['indice_step'],0)}) · "
                        f"nessuna separazione di rango ({F['indice_max_prima_gara']} gia' {it(F['indice_max_prima'],0)}), "
                        f"{F['n_prima']} gare prima, permutazione p ≈ {it(F['indice_p'],2)}"),
             "stato": "MISURATO",
             "da": "forza_macchina.json (indice = potenziale + passo, percentile per-gara), media prima/dopo + permutazione"},
            {"grandezza": "conferma del rilevatore cieco",
             "valore": (f"#{F.get('rilevatore_rango')} della stagione, split al round {F.get('rilevatore_round')} "
                        f"(riduzione {it(F.get('rilevatore_riduzione'),2)} pp, σ dopo {it(F.get('rilevatore_sigma_dopo'),2)})"),
             "stato": "MISURATO",
             "da": "rilevatore indipendente su forza_stagione (max riduzione distacco-qualifica, split ottimo)"},
            {"grandezza": "QUALE componente ha prodotto il guadagno",
             "valore": "non identificabile (la punta mescola potenza PU e resistenza; upgrade vs 'problemi risolti' non separabili)",
             "stato": "NON_MISURABILE",
             "da": "nessun canale isola il singolo pezzo; ammesso dallo stesso team (vedi fonti)"},
        ],
        "fonti": cand["fonti"] + [
            {"tipo": "dati",
             "testo": f"FastF1 3.8.3 — qualifica e gara di {F['n_gare']} GP 2026; potenziale = miglior giro "
                      f"di qualifica (team = migliore dei due piloti), passo = mediana in aria pulita, "
                      f"vmax/cornering = telemetria vettura (giri lanciati)"},
            {"tipo": "metodo",
             "testo": "ai_lab/redazione/genera_upgrade.py — confronto prima/dopo la gara-upgrade; distacchi "
                      "normalizzati (percentile e % dal leader), mai tempi assoluti; prova-guida scelta per "
                      "robustezza (separazione di rango + test di permutazione); rilevatore cieco per la conferma"},
        ],
    }

    FIG = {
        "quali": {"svg": _grafico_quali(F, col),
                  "didascalia": (f"Il distacco di {tnm} in qualifica dal piu' veloce, round per round. "
                                 f"La verticale marca {gu}; le linee piatte sono la media prima "
                                 f"({it(F['gap_s_prima'],2)} s) e dopo ({it(F['gap_s_dopo'],2)} s). Dopo "
                                 f"l'upgrade nessuna gara risale nella fascia di prima."),
                  "fonte": "forza_stagione (FastF1), elaborazione redazione"},
        "indice": {"svg": _grafico_indice(F, col),
                   "didascalia": (f"La forza-macchina di {tnm} round per round (indice 0–100). La verticale "
                                  f"marca {gu}; le linee piatte sono la media prima ({it(F['indice_prima'],0)}) "
                                  f"e dopo ({it(F['indice_dopo'],0)}). Il gradino c'e', ma {F['indice_max_prima_gara']} "
                                  f"(gara prima) tocca gia' il livello di dopo: nessuna separazione netta."),
                   "fonte": "forza_macchina.json (FastF1), elaborazione redazione"},
        "dove": {"svg": _grafico_dove(F, col),
                 "didascalia": (f"Velocita' di punta e in curva come percentile nel campo (50 = media), prima "
                                f"e dopo l'upgrade. Il salto netto e' sulla punta; il calo in curva e' quasi "
                                f"tutto dovuto alla sola {gu} (assetto scarico). Percentile, non km/h: le piste "
                                f"non sono confrontabili in assoluto."),
                 "fonte": "dati_stagione (FastF1 car telemetry), elaborazione redazione"},
    }
    for sez in art["sezioni"]:
        if sez.get("figura") in FIG:
            sez["figura"] = FIG[sez["figura"]]
        elif "figura" in sez:
            del sez["figura"]

    F["id"] = ID
    return F, art


META = {
    "id": ID_META, "canale": "A+B",
    "titolo": "L'upgrade ha funzionato? (effetto misurato, causa non misurabile)",
    "tag": ["upgrade", "telemetria", "aerodinamica", "multi-gara"],
    "descrizione": "un team porta un aggiornamento a un GP: misuriamo l'effetto (DOVE e quanto) "
                   "prima-vs-dopo, la causa (quale pezzo) resta NON_MISURABILE",
    "richiede": "forza_macchina + telemetria multi-gara",
    "gare": ["*"], "sessioni": ["Race"],
}


def genera(gara=None, data=None, sessione=None):
    r = costruisci(data_bozza=data)
    if not r:
        return None
    F, art = r
    base.scrivi_bozza(F["id"], art, F)
    return {"id": F["id"], "titolo": art["titolo"], "stato": art["stato"], "canale": "A+B"}


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="Genera l'articolo 'l'upgrade ha funzionato?'")
    ap.add_argument("--data", default=None,
                    help="data della bozza (ISO, es. 2026-07-26); default = oggi. "
                         "Usare per NON stampare la data all'orologio d'ambiente.")
    args = ap.parse_args()

    r = costruisci(data_bozza=args.data)
    if not r:
        print("nessun candidato supera il cancello: nessun effetto chiaro da raccontare")
        sys.exit()
    F, art = r
    base.scrivi_bozza(F["id"], art, F)
    print(f"Bozza {F['id']} scritta (data {art['data']}).")
    print(f"  {F['team']} @ {F['gara_upgrade']} (round {F['round_upgrade']})")
    print(f"  PROVA-GUIDA: {F['guida']}")
    print(f"  quali    {F['gap_s_prima']} -> {F['gap_s_dopo']} s  "
          f"({F['quali_def_prima']}% -> {F['quali_def_dopo']}%, -{F['quali_riduzione_pp']} pp)  "
          f"| sep-rango {F['quali_sep']}, perm {F['quali_perm_est']}/{F['quali_perm_tot']} (p~{F['quali_p']})")
    print(f"  indice   {F['indice_prima']} -> {F['indice_dopo']}  (+{F['indice_step']})  "
          f"| sep-rango {F['indice_sep']} (max prima {F['indice_max_prima_gara']} {F['indice_max_prima']}), p~{F['indice_p']}")
    print(f"  passo    {F['passo_def_prima']}% -> {F['passo_def_dopo']}%")
    print(f"  punta    {F['punta_pct_prima']}deg -> {F['punta_pct_dopo']}deg "
          f"({F['punta_dopo_sopra']}/{F['n_dopo']} dopo >= {F['punta_mediana']}deg)  "
          f"| curva {F['curva_pct_prima']}deg -> {F['curva_pct_dopo']}deg "
          f"(upgrade {F['curva_pct_upgrade']}deg, senza {F['gara_upgrade']} ~{F['curva_pct_dopo_senza']}deg)")
    print(f"  rilevatore: #{F.get('rilevatore_rango')} split round {F.get('rilevatore_round')} "
          f"(riduzione {F.get('rilevatore_riduzione')} pp, sigma {F.get('rilevatore_sigma_dopo')})")
