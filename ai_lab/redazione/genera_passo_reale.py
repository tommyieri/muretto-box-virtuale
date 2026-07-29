"""
Il vero passo della gara — pezzo-gara GENERALE (tutto il gruppo), track-agnostic.

Che cosa misura e perche' cosi' (playbook esperto, rimisurato qui, non ricopiato):
 - passo di un pilota = MEDIANA dei suoi giri VERDI validi (TrackStatus puro "1"),
   MAI tutti i giri (out/in-lap, neutralizzazioni, giri cancellati fuori) e MAI il
   singolo giro veloce (non e' il passo, e' un exploit);
 - si scarta il PRIMO giro di ogni stint (gomma fredda) e i giri con NaT;
 - CONSISTENZA: si mostra la dispersione con l'IQR (Q1-Q3) e i baffi, non solo la
   mediana — due piloti con la stessa mediana ma IQR diverso NON hanno lo stesso
   passo utile;
 - SPLIT PER FASE: prima/dopo la prima neutralizzazione. La benzina che cala e la
   pista che gomma rendono i giri tardivi piu' rapidi: una sola mediana su tutta la
   gara mescola due regimi e gonfia l'IQR. I TIPI di neutralizzazione si DICHIARANO
   da TrackStatus (2 giallo, 4 Safety Car, 5 rossa, 6/7 VSC) — solo quelli occorsi.

CONFONDITORI (il punto di Tommi): un pilota bloccato nel traffico NON ha un passo
leggibile. Qui il "traffico" e' misurato: per ogni giro, il gap alla macchina
davanti nell'ordine di quel giro (dai tempi-sessione). Un giro entro 1,5 s dalla
macchina davanti e' in aria sporca. Chi corre in aria sporca per una quota alta dei
suoi giri (>=35%) e' MARCATO: la sua mediana e' una lettura "in scia", piu' lenta
del suo passo libero (che si stima con la mediana dei soli giri in aria pulita).
Chi ha pochi giri puliti (ritiro precoce) NON e' leggibile ed esce dal grafico.
Niente ERS/energia, niente meteo, niente strategia/soste: passo INDICATIVO.

python3 UTENTE (fastf1 3.8.3). Solo lettura; bozza nell'area Lab. Non tocca demo/.
"""
from __future__ import annotations
import os
import sys
import json
import math
import statistics as st
from collections import defaultdict

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele   # noqa: E402
import svg    # noqa: E402
import base   # noqa: E402

ID = "passo-reale"
REPO = os.path.abspath(os.path.join(_QUI, "..", ".."))

# --- parametri di misura (la "regola della casa", dichiarati in provenienza) ---
SOGLIA_TRAFFICO = 1.5     # s: entro questo gap dalla macchina davanti = aria sporca
QUOTA_TRAFFICO = 0.35     # frazione di giri puliti in aria sporca -> passo con riserva
MIN_GIRI = 20            # meno giri verdi puliti di cosi' = passo NON leggibile
MIN_FASE = 4             # giri minimi per avere una mediana di fase

# nome GP italiano -> nome FastF1; il circuito per la targhetta
_REG = {}
try:
    _REG = json.load(open(os.path.join(REPO, "data", "gare_registro.json")))
except Exception:
    _REG = {}

CIRCUITI = {
    "Australia": "Albert Park", "Cina": "Shanghai", "Giappone": "Suzuka",
    "Miami": "Miami", "Canada": "Montreal", "Monaco": "Monaco",
    "Spagna": "Barcellona-Catalunya", "Austria": "Red Bull Ring",
    "Gran Bretagna": "Silverstone", "Belgio": "Spa-Francorchamps",
    "Ungheria": "Hungaroring",
}

STATUS_NOMI = {"2": "bandiera gialla", "4": "Safety Car", "5": "bandiera rossa",
               "6": "Virtual Safety Car", "7": "Virtual Safety Car"}


def it(x, dec=1):
    return base.it(x, dec)


def _slug(nome):
    s = (nome or "").lower()
    for a, b in (("à", "a"), ("è", "e"), ("é", "e"), ("ì", "i"), ("ò", "o"),
                 ("ù", "u"), (" ", "-"), ("'", "")):
        s = s.replace(a, b)
    return "".join(c for c in s if c.isalnum() or c == "-") or "gara"


def _quartili(secs):
    """(Q1, mediana, Q3) robusti; fallback per pochi campioni."""
    med = st.median(secs)
    if len(secs) >= 4:
        q = st.quantiles(secs, n=4, method="inclusive")
        return q[0], med, q[2]
    return min(secs), med, max(secs)


def _baffi(secs, q1, q3):
    """Baffi di Tukey: estremi dei DATI entro [Q1-1.5IQR, Q3+1.5IQR]."""
    iqr = q3 - q1
    lo_lim, hi_lim = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    lo = min((s for s in secs if s >= lo_lim), default=min(secs))
    hi = max((s for s in secs if s <= hi_lim), default=max(secs))
    return lo, hi


# ---------------------------------------------------------------------------
# MISURA (nessun numero arriva da fuori)
# ---------------------------------------------------------------------------
def _misura(anno, ti):
    ses = tele.carica_sessione(anno, ti, "Race")
    laps = ses.laps
    piloti = tele.piloti_sessione(ses)
    inv = {v["num"]: (k, v["team"]) for k, v in piloti.items()}
    try:
        res = ses.results
    except Exception:
        res = None

    # gap alla macchina davanti: dentro ogni LapNumber, l'ordine per tempo-sessione
    # coincide con l'ordine di corsa; il gap = differenza col precedente (None = in testa).
    by_ln = defaultdict(list)
    for _, lap in laps.iterrows():
        t = tele.secondi(lap["Time"])
        if t is None:
            continue
        by_ln[int(lap["LapNumber"])].append((t, lap["DriverNumber"]))
    gap_ahead = {}
    for ln, arr in by_ln.items():
        arr.sort()
        for i, (t, num) in enumerate(arr):
            gap_ahead[(num, ln)] = None if i == 0 else (t - arr[i - 1][0])

    # neutralizzazioni: quali TIPI (cifre) e quali giri toccati
    digits = set()
    neutr_laps = set()
    for _, lap in laps.iterrows():
        tsc = str(lap["TrackStatus"])
        d = {c for c in tsc if c in "24567"}
        if d:
            digits |= d
            neutr_laps.add(int(lap["LapNumber"]))
    neutr_laps = sorted(neutr_laps)
    primo_neutr = neutr_laps[0] if neutr_laps else None

    def fase(ln):
        if primo_neutr is None:
            return 1
        return 1 if ln < primo_neutr else 2

    records = []
    for num in ses.drivers:
        dl = laps.pick_drivers(num).sort_values("LapNumber")
        sig, team = inv.get(num, (num, "?"))
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
            stints[int(lap["Stint"])].append((int(lap["LapNumber"]), s))
        clean = []
        for _stint, lns in stints.items():
            lns.sort()
            for ln, s in lns[1:]:                            # scarto il primo giro (gomma fredda)
                clean.append((ln, s, gap_ahead.get((num, ln))))
        laps_done = int(dl["LapNumber"].max()) if len(dl) else 0
        status = "?"
        if res is not None and num in res.index:
            status = str(res.loc[num].get("Status", "?"))
        if not clean:
            continue
        secs = [c[1] for c in clean]
        q1, med, q3 = _quartili(secs)
        lo, hi = _baffi(secs, q1, q3)
        air = [s for _, s, g in clean if g is None or g > SOGLIA_TRAFFICO]
        n_traf = sum(1 for _, _, g in clean if g is not None and g <= SOGLIA_TRAFFICO)
        p1 = [s for ln, s, _ in clean if fase(ln) == 1]
        p2 = [s for ln, s, _ in clean if fase(ln) == 2]
        records.append({
            "sig": sig, "team": team, "num": num, "status": status,
            "laps_done": laps_done, "n": len(clean), "secs": secs,
            "med": med, "q1": q1, "q3": q3, "iqr": q3 - q1, "lo": lo, "hi": hi,
            "n_traf": n_traf, "frac_traf": n_traf / len(clean),
            "air_med": st.median(air) if len(air) >= 5 else None, "n_air": len(air),
            "p1": st.median(p1) if len(p1) >= MIN_FASE else None, "n1": len(p1),
            "p2": st.median(p2) if len(p2) >= MIN_FASE else None, "n2": len(p2),
        })
    meta = {
        "event": str(ses.event.get("EventName", ti)),
        "round": int(ses.event.get("RoundNumber", 0) or 0),
        "n_laps_tot": int(laps["LapNumber"].max()) if len(laps) else 0,
        "digits": sorted(digits), "neutr_laps": neutr_laps, "primo_neutr": primo_neutr,
    }
    return ses, records, meta


def _tipi_neutralizzazione(digits):
    """Testo dei TIPI realmente occorsi (mai 'Safety Car' se il 4 non c'e')."""
    nomi = []
    for d in digits:
        nm = STATUS_NOMI.get(d)
        if nm and nm not in nomi:
            nomi.append(nm)
    return nomi


# ---------------------------------------------------------------------------
# COSTRUZIONE ARTICOLO
# ---------------------------------------------------------------------------
def costruisci(anno, gara, data_bozza=None):
    ti = (_REG.get(gara, {}) or {}).get("ti", gara)
    ses, records, meta = _misura(anno, ti)
    if not records:
        return None
    colori = base.carica_colori()
    circuito = CIRCUITI.get(gara) or str(ses.event.get("Location", ""))
    rnd = meta["round"]
    tipi = _tipi_neutralizzazione(meta["digits"])
    slug = _slug(gara)

    def col(team):
        return colori.get(team) or "var(--dim)"

    # leggibili: abbastanza giri puliti; ordinati per mediana crescente
    leggibili = sorted([r for r in records if r["n"] >= MIN_GIRI], key=lambda r: r["med"])
    esclusi = [r for r in records if r["n"] < MIN_GIRI]
    if not leggibili:
        return None
    top = leggibili[0]
    leader_med = top["med"]
    spread10 = (leggibili[9]["med"] - leader_med) if len(leggibili) >= 10 else \
        (leggibili[-1]["med"] - leader_med)
    n_top = min(10, len(leggibili))

    # traffico-limitati (fra i leggibili)
    traf_flag = [r for r in leggibili if r["frac_traf"] >= QUOTA_TRAFFICO]
    traf_flag_sorted = sorted(traf_flag, key=lambda r: -r["frac_traf"])

    # consistenza: fra i piloti ARRIVATI (passo pulito e completo)
    arrivati = [r for r in leggibili if "Finished" in r["status"] or "Lapped" in r["status"]]
    piu_consistente = min(arrivati, key=lambda r: r["iqr"]) if arrivati else None
    meno_consistente = max(arrivati, key=lambda r: r["iqr"]) if arrivati else None

    # doppiati / ritirati fra i leggibili
    doppiati = [r for r in leggibili if "Lapped" in r["status"]]
    ritirati = [r for r in records if "Retired" in r["status"]]

    # drift di fase (fase2 piu' rapida): p1 - p2, per chi ha entrambe le fasi
    drift = [(r, r["p1"] - r["p2"]) for r in leggibili if r["p1"] and r["p2"]]
    drift_med = st.median([d for _, d in drift]) if drift else None

    def nota_stato(r):
        if "Retired" in r["status"]:
            return f"ritirato g.{r['laps_done']}"
        if "Lapped" in r["status"]:
            return "doppiato"
        return ""

    # ------------------------------------------------------------------ FIGURA A (EROE)
    righe_box = []
    for r in leggibili:
        righe_box.append({
            "sigla": r["sig"], "colore": col(r["team"]),
            "med": r["med"], "q1": r["q1"], "q3": r["q3"], "lo": r["lo"], "hi": r["hi"],
            "traffico": r["frac_traf"] >= QUOTA_TRAFFICO, "nota": nota_stato(r),
        })
    fig_a = svg.boxplot(
        righe_box,
        titolo=f"Il vero passo di gara — {circuito}: mediana e dispersione, per pilota",
        sub=f"Gara {gara} {anno} · giri verdi puliti",
        caption=("box = IQR (metà centrale dei giri) · linea = mediana · baffi = estensione · "
                 "▲ = passo in aria sporca (non libero)"),
        dec=2)

    # ------------------------------------------------------------------ FIGURA B (CAUSA)
    righe_traf = []
    for r in sorted(leggibili, key=lambda r: -r["frac_traf"]):
        righe_traf.append({
            "sigla": r["sig"], "colore": col(r["team"]),
            "valore": r["frac_traf"] * 100.0,
            "evidenza": r["frac_traf"] >= QUOTA_TRAFFICO,
        })
    fig_b = svg.barre_dv(
        righe_traf, titolo="Quanto passo è «in scia»: giri in aria sporca per pilota",
        sub=f"gara {gara} {anno}", unita="%", base=0.0, ml=58, dec=0,
        caption=f"% di giri verdi puliti entro {it(SOGLIA_TRAFFICO,1)} s dalla macchina davanti — "
                f"marcati (pieno) ≥{int(QUOTA_TRAFFICO*100)}%: mediana «in scia», non passo libero")

    # ------------------------------------------------------------------ FIGURA C (EFFETTO)
    fig_c = None
    if drift:
        righe_fase = []
        for r, d in sorted(drift, key=lambda x: -x[1]):
            righe_fase.append({
                "sigla": r["sig"], "colore": col(r["team"]),
                "valore": d, "evidenza": (drift_med is not None and d >= drift_med),
            })
        fig_c = svg.barre_dv(
            righe_fase, titolo="Un passo, due regimi: quanto la Fase 2 è più rapida della Fase 1",
            sub=f"prima/dopo la 1ª neutralizzazione (g.{meta['primo_neutr']})",
            unita="s", base=0.0, ml=58, dec=2,
            caption="s/giro guadagnati dopo la 1ª neutralizzazione — benzina che cala + pista "
                    "gommata (non separabili): perché una sola mediana comprime due passi")

    # ------------------------------------------------------------------ FACTS
    F = {
        "id": ID, "anno": anno, "gara": gara, "circuito": circuito, "round": rnd,
        "sessione": "Gara", "n_laps_gara": meta["n_laps_tot"],
        "neutralizzazioni": {"tipi": tipi, "giri": meta["neutr_laps"],
                             "primo": meta["primo_neutr"], "digits": meta["digits"]},
        "parametri": {"soglia_traffico_s": SOGLIA_TRAFFICO, "quota_traffico": QUOTA_TRAFFICO,
                      "min_giri": MIN_GIRI},
        "leader": {"sig": top["sig"], "team": top["team"], "med": leader_med,
                   "iqr": top["iqr"], "n": top["n"], "frac_traf": top["frac_traf"],
                   "air_med": top["air_med"]},
        "spread_top": {"n": n_top, "valore": spread10},
        "traffico_flag": [{"sig": r["sig"], "frac": r["frac_traf"], "med": r["med"],
                           "air_med": r["air_med"]} for r in traf_flag_sorted],
        "consistenza": {
            "piu": {"sig": piu_consistente["sig"], "iqr": piu_consistente["iqr"]} if piu_consistente else None,
            "meno": {"sig": meno_consistente["sig"], "iqr": meno_consistente["iqr"]} if meno_consistente else None},
        "drift_fase_mediano": drift_med,
        "doppiati": [r["sig"] for r in doppiati],
        "ritirati": [{"sig": r["sig"], "g": r["laps_done"]} for r in ritirati],
        "esclusi_pochi_giri": [{"sig": r["sig"], "n": r["n"], "status": r["status"]} for r in esclusi],
        "classifica": [{"sig": r["sig"], "team": r["team"], "med": r["med"], "iqr": r["iqr"],
                        "n": r["n"], "frac_traf": r["frac_traf"], "air_med": r["air_med"],
                        "status": r["status"]} for r in leggibili],
    }

    # ------------------------------------------------------------------ PROSA
    accent = col(top["team"])

    def _lista_it(xs):
        xs = list(xs)
        if not xs:
            return ""
        if len(xs) == 1:
            return xs[0]
        return ", ".join(xs[:-1]) + " e " + xs[-1]

    tipi_txt = _lista_it(tipi) if tipi else "nessuna neutralizzazione"
    finestre = ", ".join(_finestre(meta["neutr_laps"])) if meta["neutr_laps"] else "—"
    n_flag = len(traf_flag)
    leader_air_txt = ""
    if top["air_med"] is not None:
        d_air = top["med"] - top["air_med"]
        leader_air_txt = (f" Tolti i giri in scia, la sua mediana in aria pulita scende a "
                          f"{base.lap_fmt(top['air_med'])} ({it(d_air,2)} s più rapida): "
                          f"la classifica grezza <b>sottostima</b> chi ha guidato dietro.")

    # il drift di fase è quantificabile solo se entrambe le fasi hanno abbastanza
    # giri (una neutralizzazione precoce svuota la Fase 1): prosa e provenienza si
    # adattano, senza inventare un numero quando non c'è.
    if drift_med is not None:
        sommario_drift = (f"e la benzina che cala rende l’intera griglia "
                          f"~{it(drift_med,1)} s più rapida nella seconda metà. ")
        effetto_p1 = (
            f"<p>C’è un secondo confondente, uguale per tutti: la <b>benzina</b>. La macchina "
            f"si alleggerisce giro dopo giro e la pista si gomma, così la seconda metà è più "
            f"rapida della prima. Spezzando ogni passo <b>prima e dopo la prima "
            f"neutralizzazione</b> (giro {meta['primo_neutr']}), la griglia guadagna in mediana "
            f"circa <b>{it(drift_med,2)} s/giro</b>. Non è degrado al contrario: è carburante ed "
            f"evoluzione pista, che questi dati non separano.</p>")
        prov_drift = {
            "grandezza": "guadagno di passo dopo la 1ª neutralizzazione",
            "valore": f"~{it(drift_med,2)} s/giro (mediano sulla griglia)",
            "stato": "MISURATO",
            "da": f"mediana Fase 2 − Fase 1 (spartiacque giro {meta['primo_neutr']}); giri verdi puliti"}
    else:
        primo = meta["primo_neutr"]
        sommario_drift = ("e la benzina che cala alleggerisce la macchina giro dopo giro, "
                          "spostando la scala dei tempi lungo la gara. ")
        effetto_p1 = (
            f"<p>C’è un secondo confondente, uguale per tutti: la <b>benzina</b>. La macchina "
            f"si alleggerisce giro dopo giro e la pista si gomma, così i giri tardivi sono più "
            f"rapidi. Qui però la prima neutralizzazione è arrivata troppo presto "
            f"(giro {primo}) per isolare un passo di prima fase pulito: il salto di benzina resta, "
            f"ma da questa gara <b>non lo quantifichiamo</b>. Resta carburante ed evoluzione pista, "
            f"che questi dati comunque non separano.</p>")
        prov_drift = {
            "grandezza": "guadagno di passo dopo la 1ª neutralizzazione",
            "valore": f"non isolabile (1ª neutralizzazione al giro {primo}, Fase 1 troppo corta)",
            "stato": "NON_MISURABILE",
            "da": "servono ≥4 giri verdi puliti sia prima sia dopo lo spartiacque; qui manca la Fase 1"}

    # frase sulle neutralizzazioni: adattata ai TIPI davvero occorsi (mai negare
    # una Safety Car che c'è stata, né inventarne una che non c'è stata).
    has_sc = "4" in meta["digits"]
    has_red = "5" in meta["digits"]
    if not tipi:
        neutr_effetto = ("In questa gara non ci sono state neutralizzazioni: la lettura del "
                         "passo non è mai stata interrotta.")
    elif has_sc or has_red:
        conseg = []
        if has_sc:
            conseg.append("una Safety Car ha ricompattato il campo")
        if has_red:
            conseg.append("una bandiera rossa ha azzerato i distacchi")
        neutr_effetto = (f"In questa gara le neutralizzazioni sono state <b>{tipi_txt}</b> "
                         f"(giri {finestre}): {' e '.join(conseg)}, quindi in quei tratti i "
                         f"distacchi non raccontano il passo.")
    else:
        neutr_effetto = (f"In questa gara le neutralizzazioni sono state <b>{tipi_txt}</b> "
                         f"(giri {finestre}): nessuna Safety Car schierata e nessuna bandiera "
                         f"rossa, quindi il campo non è mai stato ricompattato del tutto.")

    esclusi_txt = ""
    if esclusi:
        e = esclusi[0]
        altri = f" (e altri {len(esclusi)-1})" if len(esclusi) > 1 else ""
        esclusi_txt = (f" Fuori dal grafico {e['sig']}{altri}: {e['n']} giri puliti "
                       f"({e['status'].lower()}) non bastano a leggere un passo.")

    top3 = leggibili[:3]
    top3_txt = "; ".join(
        f"{r['sig']} {base.lap_fmt(r['med'])}" + (" ▲" if r["frac_traf"] >= QUOTA_TRAFFICO else "")
        for r in top3)

    art = {
        "id": ID, "slug": slug, "stato": "bozza",
        "data": data_bozza or "2026-07-26",
        "firma": "Muretto · Redazione tecnica", "accent": accent,
        "canale": "A (passo-gara, tutto il gruppo)",
        "gp": gara, "gara": gara, "circuito": circuito, "sessione": "Gara", "round": rnd,
        "tag": ["passo-gara", "gara", "long-run", "tutto-il-gruppo", circuito],
        "occhiello": f"Passo-gara · Gara {gara} {anno}",
        "titolo": (f"Il vero passo di {circuito}: {top['sig']} il più rapido "
                   f"({base.lap_fmt(leader_med)}), primi {n_top} in {it(spread10,1)} s"),
        "sommario": (
            f"Il passo di gara letto come va letto: per ogni pilota la mediana dei giri verdi "
            f"puliti (non il giro veloce, non tutti i giri), con la dispersione a fianco. "
            f"{top['sig']} fissa il riferimento a {base.lap_fmt(leader_med)}; i primi {n_top} "
            f"stanno in {it(spread10,1)} s. Ma la classifica grezza va corretta: {n_flag} piloti "
            f"hanno girato per oltre un terzo del tempo in aria sporca, "
            f"{sommario_drift}Passo indicativo: carburante e mappe motore restano ignoti."),
        "sezioni": [
            {"tag": "Evidenza", "titolo": f"Il passo vero: {top['sig']} davanti, il gruppo in {it(spread10,1)} s",
             "html": (
                f"<p>Il passo di gara non è il giro più veloce (un exploit isolato) né la media di "
                f"tutti i giri (sporcata da soste, traffico e neutralizzazioni): è la <b>mediana dei "
                f"giri verdi puliti</b>, con la <b>dispersione</b> a dire quanto quel passo è ripetibile. "
                f"Letta così, la gara di {circuito} mette <b>{top['sig']}</b> ({top['team']}) davanti a "
                f"<b>{base.lap_fmt(leader_med)}</b>, con i primi {n_top} racchiusi in "
                f"<b>{it(spread10,1)} s/giro</b>. In testa: {top3_txt}.</p>"
                f"<p>Il boxplot mostra anche <b>chi</b> è ripetibile e chi no: la metà centrale dei giri "
                f"(il box) è stretta per i più regolari, larga per chi ha avuto passo altalenante. "
                f"Il più costante fra gli arrivati è "
                f"<b>{piu_consistente['sig'] if piu_consistente else '–'}</b> "
                f"(IQR {it(piu_consistente['iqr'],2) if piu_consistente else '–'} s); il più "
                f"disperso è {meno_consistente['sig'] if meno_consistente else '–'} "
                f"(IQR {it(meno_consistente['iqr'],2) if meno_consistente else '–'} s). "
                f"I piloti marcati con ▲ hanno però un passo <b>non libero</b>: perché, lo dice la figura "
                f"successiva.</p>"),
             "figura": {"svg": fig_a,
                "didascalia": (
                    f"Un boxplot per pilota (il più rapido in alto): linea = mediana, box = IQR "
                    f"(metà centrale dei giri), baffi = estensione. ▲ = passo corso in gran parte in "
                    f"aria sporca. Passo indicativo: la benzina non è nei dati."),
                "fonte": f"FastF1 · laps Gara {gara} {anno} — mediana dei giri verdi puliti (TrackStatus «1»)"}},

            {"tag": "Causa", "titolo": "Perché la classifica grezza mente: il traffico",
             "html": (
                f"<p>Una mediana bassa non vale se arriva «in scia». Per ogni giro misuriamo il "
                f"<b>gap alla macchina davanti</b> nell’ordine di quel giro: un giro entro "
                f"<b>{it(SOGLIA_TRAFFICO,1)} s</b> è in <b>aria sporca</b>. Chi ha passato oltre il "
                f"{int(QUOTA_TRAFFICO*100)}% dei suoi giri puliti così ({n_flag} piloti) ha una "
                f"mediana che è un passo <b>di inseguimento</b>, non il suo passo libero.</p>"
                f"<p>Il caso più vistoso è proprio in cima: <b>{top['sig']}</b> ha girato il "
                f"<b>{it(top['frac_traf']*100,0)}%</b> dei giri puliti in aria sporca."
                f"{leader_air_txt}"
                f" È il confondente che il grafico-eroe segnala con ▲: quei passi vanno letti come "
                f"«almeno così veloci», non come il tetto.{esclusi_txt}</p>"),
             "figura": {"svg": fig_b,
                "didascalia": (
                    f"Percentuale di giri verdi puliti corsi entro {it(SOGLIA_TRAFFICO,1)} s dalla "
                    f"macchina davanti. Le barre piene (≥{int(QUOTA_TRAFFICO*100)}%) sono i piloti il "
                    f"cui passo mediano è «in scia»: la loro posizione in classifica è un minimo, non "
                    f"il vero potenziale."),
                "fonte": f"FastF1 · laps + tempi-sessione Gara {gara} {anno} — gap alla macchina davanti per giro"}},

            {"tag": "Effetto", "titolo": "Un passo solo non basta: la gara ha due regimi",
             "html": (
                effetto_p1 +
                f"<p>Ecco perché una sola mediana su tutta la gara <b>comprime</b> due passi diversi e "
                f"gonfia l’IQR: parte della dispersione non è rumore, è il calo di benzina. Il passo "
                f"vero di {circuito}, allora, è la lettura del grafico-eroe <b>con due avvertenze "
                f"scritte sopra</b>: chi era in aria sporca (▲) e che la benzina ha spostato tutta la "
                f"scala nel corso della gara. {neutr_effetto} Carburante e mappe motore restano ignoti: "
                f"è un passo indicativo, non un verdetto sul valore assoluto.</p>"),
             **({"figura": {"svg": fig_c,
                "didascalia": (
                    f"Secondi al giro guadagnati da ogni pilota dopo la prima neutralizzazione "
                    f"(giro {meta['primo_neutr']}): è sistematico su tutta la griglia — benzina che "
                    f"cala e pista che gomma, non separabili con questi dati."),
                "fonte": f"FastF1 · laps Gara {gara} {anno} — mediana per fase, giri verdi puliti"}}
                if fig_c else {})},
        ],
        "provenienza": [
            {"grandezza": f"passo più rapido ({top['sig']}, {top['team']})",
             "valore": f"{base.lap_fmt(leader_med)} · IQR {it(top['iqr'],2)} s, {top['n']} giri-core",
             "stato": "MISURATO",
             "da": "mediana dei giri verdi puliti (TrackStatus «1», senza out/in-lap, cancellati, "
                   "primo giro di stint) — FastF1 laps Gara"},
            {"grandezza": f"ampiezza dei primi {n_top}",
             "valore": f"~{it(spread10,1)} s/giro (dal più rapido al {n_top}º)",
             "stato": "MISURATO",
             "da": "differenza fra le mediane-passo dei piloti leggibili in classifica"},
            {"grandezza": f"traffico del leader ({top['sig']})",
             "valore": (f"{it(top['frac_traf']*100,0)}% giri in aria sporca"
                        + (f" · aria pulita {base.lap_fmt(top['air_med'])}" if top['air_med'] else "")),
             "stato": "MISURATO",
             "da": f"quota di giri entro {it(SOGLIA_TRAFFICO,1)} s dalla macchina davanti; la mediana "
                   f"grezza è una lettura «in scia»"},
            {"grandezza": f"piloti col passo «in scia» (≥{int(QUOTA_TRAFFICO*100)}%)",
             "valore": (", ".join(f"{d['sig']} {it(d['frac']*100,0)}%" for d in F["traffico_flag"])
                        or "nessuno"),
             "stato": "MISURATO",
             "da": "marcati con ▲ nel grafico-eroe: mediana non rappresentativa del passo libero"},
            {"grandezza": "consistenza (IQR) più stretta / più larga",
             "valore": (f"{piu_consistente['sig']} {it(piu_consistente['iqr'],2)} s ↔ "
                        f"{meno_consistente['sig']} {it(meno_consistente['iqr'],2)} s"
                        if piu_consistente and meno_consistente else "–"),
             "stato": "MISURATO",
             "da": "intervallo interquartile dei giri verdi puliti fra i piloti arrivati"},
            prov_drift,
            {"grandezza": "tipi di neutralizzazione occorsi",
             "valore": (tipi_txt + f" · giri {finestre}") if tipi else "nessuna",
             "stato": "MISURATO",
             "da": "TrackStatus FastF1 (2 giallo, 4 Safety Car, 5 rossa, 6/7 VSC) — dichiarati solo "
                   "quelli realmente presenti"},
            {"grandezza": "peso della benzina sul passo",
             "valore": "non separato dall’evoluzione pista",
             "stato": "NON_MISURABILE",
             "da": "il carico di carburante per giro non è nel feed FastF1: il drift di fase li somma"},
            {"grandezza": "mappe motore / modalità",
             "valore": "gestione vs spinta non distinguibili",
             "stato": "NON_MISURABILE",
             "da": "nessun canale di mappa/modalità motore nei dati"},
        ],
        "fonti": [
            {"tipo": "dati",
             "testo": f"FastF1 3.8.3 — laps + TrackStatus/Compound/Stint/tempi-sessione, "
                      f"Gara {meta['event']} {anno} (round {rnd}, {circuito})"},
            {"tipo": "metodo",
             "testo": ("ai_lab/redazione/genera_passo_reale.py — passo = mediana dei giri VERDI "
                       "puliti (TrackStatus «1», senza out/in-lap, giri cancellati, NaT e primo giro "
                       "di ogni stint); consistenza = IQR + baffi di Tukey; traffico = gap alla "
                       f"macchina davanti per giro (aria sporca ≤{it(SOGLIA_TRAFFICO,1)} s, passo "
                       f"con riserva se ≥{int(QUOTA_TRAFFICO*100)}% dei giri); split di fase prima/dopo "
                       "la 1ª neutralizzazione. Confronto solo entro i dati; carburante e mappe motore "
                       "ignoti (passo indicativo).")},
        ],
    }
    return F, art


def _finestre(giri):
    """Compatta [37,38,39,48,49,50] -> ['37–39','48–50'] per la prosa."""
    if not giri:
        return []
    out, a, b = [], giri[0], giri[0]
    for g in giri[1:]:
        if g == b + 1:
            b = g
        else:
            out.append(f"{a}" if a == b else f"{a}–{b}")
            a = b = g
    out.append(f"{a}" if a == b else f"{a}–{b}")
    return out


META = {
    "id": ID, "canale": "A",
    "titolo": "Il vero passo della gara (tutto il gruppo)",
    "tag": ["passo-gara", "gara", "long-run"],
    "descrizione": "il passo di gara di tutta la griglia: mediana + IQR dei giri verdi puliti, "
                   "confondenti (traffico) dichiarati, split per fase",
    "richiede": "laps", "sessioni": ["Race"], "gare": ["*"],
}


def genera(gara=None, data=None, sessione=None):
    g = gara or "Ungheria"
    try:
        r = costruisci(2026, g, data_bozza=data)
    except Exception as e:
        if os.environ.get("REDAZIONE_DEBUG"):
            raise
        return None
    if not r:
        return None
    F, art = r
    bid = f"{ID}-{art['slug']}-{F['anno']}"
    art["id"] = bid   # id track-specifico coerente col dir: evita che ogni gara sovrascriva l'altra
    base.scrivi_bozza(bid, art, F)
    return {"id": bid, "titolo": art["titolo"], "stato": art["stato"], "canale": "A"}


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--gara", default="Ungheria")
    ap.add_argument("--anno", type=int, default=2026)
    ap.add_argument("--data", default="2026-07-26")
    a = ap.parse_args()
    r = costruisci(a.anno, a.gara, data_bozza=a.data)
    if not r:
        print("nessun passo leggibile"); sys.exit(1)
    F, art = r
    bid = f"{ID}-{art['slug']}-{F['anno']}"
    art["id"] = bid
    out = base.scrivi_bozza(bid, art, F)
    print(f"Bozza {bid} scritta in {out}")
    print(f"  Gara {F['gara']} {F['anno']} — {F['circuito']} (round {F['round']}), "
          f"{F['n_laps_gara']} giri")
    print(f"  neutralizzazioni: {', '.join(F['neutralizzazioni']['tipi']) or 'nessuna'} "
          f"(giri {F['neutralizzazioni']['giri']})")
    print(f"  leader {F['leader']['sig']} {base.lap_fmt(F['leader']['med'])} "
          f"(IQR {it(F['leader']['iqr'],2)}, traffico {it(F['leader']['frac_traf']*100,0)}%)")
    print(f"  primi {F['spread_top']['n']} in {it(F['spread_top']['valore'],2)} s")
    print(f"  traffico-flag: {', '.join(d['sig']+' '+it(d['frac']*100,0)+'%' for d in F['traffico_flag'])}")
    print(f"  drift di fase mediano: {it(F['drift_fase_mediano'],2)} s")
    print(f"  esclusi (pochi giri): {[e['sig']+':'+str(e['n']) for e in F['esclusi_pochi_giri']]}")
    print(f"  scrittura prosa: {art.get('scrittura','template')}")
