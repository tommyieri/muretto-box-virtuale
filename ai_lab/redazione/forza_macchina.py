"""
forza_macchina.py — l'estrattore della FORZA-MACCHINA per gara (indice di
potenziale-vettura, team per team, gara per gara, stagione 2026).

IL PUNTO (Tommi): il PIAZZAMENTO mente. Se una macchina fa la gara imbottigliata
nel traffico (es. partita indietro per una penalita' in qualifica), il suo passo
gara reale non e' leggibile. Quindi la forza NON e' il risultato: e' un indice
costruito su piu' segnali del POTENZIALE della vettura, ciascuno normalizzato PER
GARA cosi' le gare diventano confrontabili.

I SEGNALI (per team, per gara):
  1) POTENZIALE GIRO-SECCO (Q)  — miglior tempo di qualifica dal CRONOMETRO
     (Q1/Q2/Q3), NON dalla griglia: le penalita' non toccano il crono. Il team =
     il migliore dei suoi due piloti. E' il segnale piu' pulito e sempre presente.
  2) PASSO GARA PULITO (R)      — mediana dei giri in ARIA PULITA: verdi puri
     (TrackStatus '1', quindi niente Safety Car / VSC / bandiere), non out/in-lap,
     non cancellati, e SENZA traffico (esclusi i giri entro ~1,5 s dalla macchina
     davanti per >=2 giri di fila). Se un team non ha abbastanza giri puliti il
     passo e' NON_AFFIDABILE e pesa meno (o zero): l'indice si appoggia al
     potenziale. Team = il migliore dei suoi due piloti (rappresenta la vettura).
  3) GAP AL MIGLIORE            — distacco in secondi dal team piu' forte della
     gara sul potenziale. E' la MAGNITUDINE (quanto, non solo il rango): serve al
     cruscotto/slider per leggere se la gara era tirata o spaccata. Nota onesta:
     e' una trasformazione monotona del potenziale, quindi il suo percentile
     coinciderebbe col percentile-potenziale — per questo NON lo ri-sommo
     nell'indice (sarebbe doppio conteggio): lo pubblico come contesto.

NORMALIZZAZIONE PER GARA: ogni segnale -> percentile 0-100 fra i team di quella
gara (best=100, worst=0). Cosi' Melbourne e Budapest si confrontano.

INDICE DI FORZA (0-100) = combinazione dei DUE segnali indipendenti (potenziale e
passo), con pesi DICHIARATI che spostano il carico sul potenziale quando il passo
e' poco affidabile:
    passo affidabile (>=6 giri puliti):   w_passo = 0.45,  w_pot = 0.55
    passo debole    (3-5 giri puliti):    w_passo = 0.20,  w_pot = 0.80  [STIMATO]
    passo assente   (<3 giri puliti):     w_passo = 0.00,  w_pot = 1.00  [solo Q]
    indice = w_pot*potenziale_pct + w_passo*passo_pct

CONFONDITORI DICHIARATI: il passo pulito puo' sparire in gare dominate da SC/VSC
o quando una vettura corre tutta in scia (traffico) — allora passo NON_AFFIDABILE
e l'indice e' quasi-solo potenziale (va detto, non nascosto). Il potenziale mescola
motore+assetto+pilota nel giro secco; il passo mescola carburante+gomma+mappe
motore (ignoti): entrambi INDICATIVI, non verdetti.

CACHE per-gara in forza_stagione/<anno>_<gp>.json (l'estrazione pesante — due
sessioni FastF1 a gara — si fa una volta sola). L'aggregato per il front-end e'
demo/data/analisi/forza_macchina.json. La LISTA delle gare arriva da
stagione_dati.json (stessa fonte del cruscotto): l'estrattore resta in sync e si
auto-aggiorna quando arriva una gara nuova.

python3 UTENTE (fastf1 3.8.3). Solo lettura del repo; scrive la cache in Lab e il
dataset-tool in demo/data/analisi/ (infrastruttura come dati.html, non un articolo
col cancello-coda). Kernel/engine MAI toccati. Una gara lacunosa si salta senza
rompere.
"""
from __future__ import annotations
import os
import sys
import json
import glob
import datetime
import statistics as st

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele    # noqa: E402

REPO = os.path.abspath(os.path.join(_QUI, "..", ".."))
CACHE = os.path.join(_QUI, "forza_stagione")
FONTE_GARE = os.path.join(REPO, "demo", "data", "analisi", "stagione_dati.json")
DEST = os.path.join(REPO, "demo", "data", "analisi", "forza_macchina.json")

# soglie (rimisurate qui, non ricopiate da altrove)
SOGLIA_TRAFFICO = 1.5      # s dalla macchina davanti: sotto = scia/aria sporca
RUN_TRAFFICO = 2           # giri di fila entro soglia perche' conti come traffico
SOGLIA_OUTLIER = 1.07      # x il best pulito del pilota: taglia carburante/stragglers
GIRI_AFFIDABILE = 6        # giri puliti per un passo affidabile
GIRI_MINIMI = 3            # giri puliti minimi per stimare un passo


# ---------------------------------------------------------------------------
# segnale 1 — POTENZIALE GIRO-SECCO (qualifica, dal cronometro)
# ---------------------------------------------------------------------------
def _potenziale(ses):
    """team -> {sec, pilota, per_pilota{sig:sec}} dal miglior Q1/Q2/Q3 (crono).

    Le penalita' colpiscono la griglia, non il cronometro: usiamo il tempo, mai
    la posizione. Fallback robusto: se i results non danno un tempo valido per un
    pilota, si prova il giro piu' veloce dai laps."""
    res = ses.results
    per_team = {}
    for _, row in res.iterrows():
        team = row.get("TeamName")
        sig = row.get("Abbreviation")
        num = row.get("DriverNumber")
        if not team or not sig:
            continue
        tempi = []
        for col in ("Q1", "Q2", "Q3"):
            s = tele.secondi(row.get(col))
            if s is not None and s > 0:
                tempi.append(s)
        best = min(tempi) if tempi else None
        if best is None:                       # fallback: giro veloce dai laps
            try:
                lap = ses.laps.pick_drivers(num).pick_fastest()
                best = tele.secondi(lap["LapTime"]) if lap is not None else None
            except Exception:
                best = None
        if best is None:
            continue
        per_team.setdefault(team, {})[sig] = round(best, 3)
    out = {}
    for team, piloti in per_team.items():
        if not piloti:
            continue
        mig = min(piloti, key=lambda s: piloti[s])
        out[team] = {"sec": piloti[mig], "pilota": mig, "per_pilota": piloti}
    return out


# ---------------------------------------------------------------------------
# segnale 2 — PASSO GARA PULITO (aria pulita, niente traffico ne' SC/VSC)
# ---------------------------------------------------------------------------
def _gap_avanti(ses):
    """(num, lapnum) -> gap in secondi dalla macchina davanti sullo STESSO giro.

    A ogni giro-numero ordino le vetture per tempo cumulato di sessione al
    passaggio sul traguardo (ses.laps 'Time'): il delta col precedente e' il
    distacco reale sulla pista. Il leader di quel giro ha aria pulita (None)."""
    gap = {}
    laps = ses.laps
    try:
        numeri_giro = sorted({int(x) for x in laps["LapNumber"].dropna().unique()})
    except Exception:
        return gap
    for L in numeri_giro:
        fila = []
        sub = laps[laps["LapNumber"] == L]
        for _, lap in sub.iterrows():
            t = tele.secondi(lap["Time"])
            if t is not None:
                fila.append((lap["DriverNumber"], t))
        fila.sort(key=lambda x: x[1])
        prev = None
        for num, t in fila:
            gap[(num, L)] = None if prev is None else round(t - prev, 3)
            prev = t
    return gap


def _giri_puliti_pilota(dl, num, gap):
    """Lista dei tempi (s) dei giri in ARIA PULITA di un pilota, gia' filtrati.

    Aria pulita = verde puro, non out/in-lap, non cancellato, e NON dentro una
    sequenza di >=RUN_TRAFFICO giri consecutivi entro SOGLIA_TRAFFICO dalla
    macchina davanti. Poi taglio outlier (>SOGLIA_OUTLIER x il best pulito) per
    togliere i giri a serbatoio pieno d'inizio gara e gli stragglers."""
    dl = dl.sort_values("LapNumber")
    # candidati verdi puri (niente SC/VSC/giallo, niente box, niente cancellati)
    verdi = []
    for _, lap in dl.iterrows():
        if lap["LapTime"] != lap["LapTime"]:                 # NaT
            continue
        if lap["PitOutTime"] == lap["PitOutTime"]:           # out-lap
            continue
        if lap["PitInTime"] == lap["PitInTime"]:             # in-lap
            continue
        if bool(lap.get("Deleted", False)):
            continue
        if str(lap.get("TrackStatus", "1")) != "1":          # solo verde puro
            continue
        s = tele.secondi(lap["LapTime"])
        if s is None:
            continue
        ln = int(lap["LapNumber"])
        g = gap.get((num, ln))
        traffico = (g is not None) and (g <= SOGLIA_TRAFFICO)
        verdi.append({"lap": ln, "sec": s, "traffico": traffico})
    if not verdi:
        return []
    # marca come "in traffico" solo i giri dentro una corsa di >=RUN_TRAFFICO
    # giri consecutivi (per numero di giro) tutti entro soglia
    n = len(verdi)
    i = 0
    while i < n:
        if verdi[i]["traffico"]:
            j = i
            while (j + 1 < n and verdi[j + 1]["traffico"]
                   and verdi[j + 1]["lap"] == verdi[j]["lap"] + 1):
                j += 1
            if (j - i + 1) >= RUN_TRAFFICO:
                for k in range(i, j + 1):
                    verdi[k]["escluso"] = True
            i = j + 1
        else:
            i += 1
    puliti = [v["sec"] for v in verdi if not v.get("escluso")]
    if not puliti:
        return []
    best = min(puliti)
    return [s for s in puliti if s <= best * SOGLIA_OUTLIER]


def _passo(ses, gap):
    """team -> {sec, n, affidabile, stato, pilota, per_pilota{sig:{sec,n}}}.

    Il team prende il MIGLIORE dei suoi piloti (rappresenta la vettura, come per il
    potenziale). Affidabile se il pilota scelto ha >=GIRI_AFFIDABILE giri puliti."""
    res = ses.results
    num2sig, num2team = {}, {}
    for _, row in res.iterrows():
        num2sig[row.get("DriverNumber")] = row.get("Abbreviation")
        num2team[row.get("DriverNumber")] = row.get("TeamName")
    per_team = {}
    for num in ses.drivers:
        team = num2team.get(num)
        sig = num2sig.get(num) or num
        if not team:
            continue
        dl = ses.laps.pick_drivers(num)
        if dl.empty:
            continue
        puliti = _giri_puliti_pilota(dl, num, gap)
        if len(puliti) < GIRI_MINIMI:
            continue
        per_team.setdefault(team, {})[sig] = {"sec": round(st.median(puliti), 3),
                                              "n": len(puliti)}
    out = {}
    for team, piloti in per_team.items():
        if not piloti:
            continue
        mig = min(piloti, key=lambda s: piloti[s]["sec"])
        n = piloti[mig]["n"]
        affid = n >= GIRI_AFFIDABILE
        stato = "MISURATO" if affid else "STIMATO"
        out[team] = {"sec": piloti[mig]["sec"], "n": n, "affidabile": affid,
                     "stato": stato, "pilota": mig, "per_pilota": piloti}
    return out


# ---------------------------------------------------------------------------
# normalizzazione per-gara + indice
# ---------------------------------------------------------------------------
def _percentile(valore, valori, meglio_basso=True):
    """Percentile 0-100 di `valore` fra `valori` (best=100, worst=0).

    pct = 100 * (quanti team batte) / (n-1). I pari condividono. Robusto: un solo
    team -> 100 (unico, quindi il migliore per definizione)."""
    n = len(valori)
    if n <= 1:
        return 100.0
    if meglio_basso:
        batte = sum(1 for v in valori if valore < v)
    else:
        batte = sum(1 for v in valori if valore > v)
    return round(100.0 * batte / (n - 1), 1)


def _pesi_passo(passo):
    """(w_passo, w_pot) secondo l'affidabilita' del passo (pesi dichiarati)."""
    if passo is None:
        return 0.0, 1.0
    if passo["affidabile"]:
        return 0.45, 0.55
    if passo["n"] >= GIRI_MINIMI:
        return 0.20, 0.80
    return 0.0, 1.0


def _componi(pot, passo):
    """Da potenziale + passo (grezzi per-gara) ai team con percentili e indice."""
    teams = sorted(set(pot) | set(passo))
    pot_vals = [pot[t]["sec"] for t in teams if t in pot]
    passo_vals = [passo[t]["sec"] for t in teams if t in passo]
    best_pot = min(pot_vals) if pot_vals else None
    out = {}
    for t in teams:
        p = pot.get(t)
        q = passo.get(t)
        pot_pct = _percentile(p["sec"], pot_vals, True) if p else None
        passo_pct = _percentile(q["sec"], passo_vals, True) if q else None
        w_passo, w_pot = _pesi_passo(q)
        if passo_pct is not None and w_passo > 0 and pot_pct is not None:
            indice = round(w_pot * pot_pct + w_passo * passo_pct, 1)
        elif pot_pct is not None:
            indice = pot_pct
        else:
            indice = passo_pct
        gap = round(p["sec"] - best_pot, 3) if (p and best_pot is not None) else None
        out[t] = {
            "potenziale": p["sec"] if p else None,
            "potenziale_pct": pot_pct,
            "potenziale_pilota": p["pilota"] if p else None,
            "passo": q["sec"] if q else None,
            "passo_pct": passo_pct,
            "passo_affidabile": bool(q["affidabile"]) if q else False,
            "passo_stato": q["stato"] if q else "NON_MISURABILE",
            "passo_giri": q["n"] if q else 0,
            "passo_pilota": q["pilota"] if q else None,
            "gap": gap,
            "peso_passo": w_passo,
            "indice": indice,
        }
    return out


# ---------------------------------------------------------------------------
# estrazione per-gara (con cache) + aggregato
# ---------------------------------------------------------------------------
def _percorso(anno, gp):
    return os.path.join(CACHE, f"{anno}_{gp.replace(' ', '_')}.json")


def estrai_gara(anno, gp, meta=None, forza=False):
    """Estrae (o rilegge dalla cache) i segnali di forza per una gara.

    meta: {circuito, data, round} da portarsi dietro (dalla lista gare). Ritorna
    il dict per-gara pronto per l'aggregato, oppure None se la gara e' lacunosa /
    non caricabile (si salta senza rompere)."""
    os.makedirs(CACHE, exist_ok=True)
    p = _percorso(anno, gp)
    if os.path.exists(p) and not forza:
        return json.load(open(p))
    meta = meta or {}
    try:
        sesQ = tele.carica_sessione(anno, gp, "Q")
        pot = _potenziale(sesQ)
    except Exception as e:
        print(f"  ! {gp}: qualifica non caricabile ({e}) — gara saltata")
        return None
    if not pot:
        print(f"  ! {gp}: nessun potenziale estraibile — gara saltata")
        return None
    try:
        sesR = tele.carica_sessione(anno, gp, "R")
        gap = _gap_avanti(sesR)
        passo = _passo(sesR, gap)
    except Exception as e:
        print(f"  ~ {gp}: gara (R) non caricabile ({e}) — solo potenziale")
        passo = {}
    team = _componi(pot, passo)

    # circuito/data/round: dai meta, con fallback all'evento della sessione Q
    circuito = meta.get("circuito")
    data = meta.get("data")
    rnd = meta.get("round")
    try:
        if not circuito:
            circuito = str(sesQ.event["Location"])
        if not data:
            data = str(sesQ.event["EventDate"])[:10]
        if rnd is None:
            rnd = int(sesQ.event["RoundNumber"])
    except Exception:
        pass

    n_passo = sum(1 for t in team.values() if t["passo"] is not None)
    n_affid = sum(1 for t in team.values() if t["passo_affidabile"])
    note = []
    if n_affid == 0:
        note.append("nessun passo affidabile: gara dominata da SC/VSC o traffico — "
                    "indice quasi-solo su potenziale")
    elif n_affid < len(team) / 2:
        note.append(f"passo affidabile solo per {n_affid}/{len(team)} team — "
                    "molte vetture in traffico / poca aria pulita")

    res = {
        "anno": anno, "gp": gp, "circuito": circuito, "data": data or "",
        "round": rnd or 0, "n_team": len(team),
        "n_team_passo": n_passo, "n_team_passo_affidabile": n_affid,
        "note": note, "team": team,
    }
    json.dump(res, open(p, "w"), ensure_ascii=False, indent=2)
    return res


def _lista_gare(anno):
    """Le gare con telemetria = quelle del cruscotto (stagione_dati.json)."""
    try:
        d = json.load(open(FONTE_GARE))
    except Exception:
        return []
    gare = [{"gp": g.get("gp"), "circuito": g.get("circuito"),
             "data": g.get("data", ""), "round": g.get("round", 0)}
            for g in d.get("gare", []) if g.get("gp")]
    gare.sort(key=lambda g: (g["round"] or 0, g["data"] or ""))
    return gare


def pubblica(anno=2026, forza=False, oggi=None):
    """Estrae tutte le gare (cache) e scrive l'aggregato per il front-end."""
    gare_meta = _lista_gare(anno)
    gare = []
    for m in gare_meta:
        r = estrai_gara(anno, m["gp"], meta=m, forza=forza)
        if r is None:
            continue
        gare.append({
            "gp": r["gp"], "circuito": r["circuito"], "data": r["data"],
            "round": r["round"], "n_team": r["n_team"],
            "n_team_passo": r.get("n_team_passo", 0),
            "n_team_passo_affidabile": r.get("n_team_passo_affidabile", 0),
            "note": r.get("note", []), "team": r["team"],
        })
    gare.sort(key=lambda g: (g["round"] or 0, g["data"] or ""))
    out = {
        "anno": anno,
        "aggiornato": oggi or datetime.date.today().isoformat(),
        "n_gare": len(gare),
        "ultima": gare[-1]["circuito"] if gare else None,
        "metodo": {
            "titolo": "Forza-macchina: indice di potenziale-vettura per gara",
            "segnali": {
                "potenziale": "miglior tempo di qualifica (Q1/Q2/Q3, cronometro non "
                              "griglia), team = migliore dei due piloti",
                "passo": "mediana dei giri in aria pulita (verde puro, no box, no "
                         "cancellati, no traffico entro 1,5 s per >=2 giri di fila), "
                         "team = migliore dei due piloti",
                "gap": "distacco in secondi dal team piu' forte sul potenziale "
                       "(magnitudine, non ri-sommato nell'indice per non doppiare)",
            },
            "normalizzazione": "ogni segnale -> percentile 0-100 fra i team della "
                               "gara (best=100, worst=0)",
            "indice": "w_pot*potenziale_pct + w_passo*passo_pct; w_passo = 0.45 se "
                      "affidabile (>=6 giri puliti), 0.20 se debole (3-5), 0.00 se "
                      "assente (<3) — il potenziale pesa piu' del passo quando il "
                      "passo e' poco affidabile",
            "soglie": {
                "traffico_s": SOGLIA_TRAFFICO, "run_traffico_giri": RUN_TRAFFICO,
                "outlier_x": SOGLIA_OUTLIER, "giri_affidabile": GIRI_AFFIDABILE,
                "giri_minimi": GIRI_MINIMI,
            },
            "confonditori": [
                "potenziale: mescola motore + assetto + pilota nel giro secco",
                "passo: mescola carburante + gomma + mappe motore (ignoti)",
                "passo NON_AFFIDABILE in gare SC/VSC-dominate o con vettura sempre "
                "in scia -> l'indice si appoggia al potenziale (dichiarato)",
            ],
        },
        "gare": gare,
    }
    os.makedirs(os.path.dirname(DEST), exist_ok=True)
    json.dump(out, open(DEST, "w"), ensure_ascii=False, indent=2)
    return out


if __name__ == "__main__":
    anno = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
    forza = "--forza" in sys.argv
    o = pubblica(anno, forza=forza)
    print(f"\nPubblicato demo/data/analisi/forza_macchina.json: {o['n_gare']} gare, "
          f"ultima {o['ultima']}")
    for g in o["gare"]:
        top = sorted(g["team"].items(), key=lambda kv: -(kv[1]["indice"] or 0))[:3]
        capo = ", ".join(f"{t.split()[0]} {d['indice']:.0f}" for t, d in top)
        print(f"  r{g['round']:<2} {g['circuito'][:14]:14} "
              f"team {g['n_team']:2}  passo affid {g['n_team_passo_affidabile']:2}/"
              f"{g['n_team']:2}  top: {capo}")
