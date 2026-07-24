"""
multigara.py — l'estrattore di feature per-gara: il mattone della macchina
multi-gara (temi A aero e X DNA circuito del mandato).

Per una gara estrae, dal giro veloce di ogni pilota, due firme confrontabili:
  vmax       velocita' di punta (km/h)
  cornering  velocita' mediana all'apice delle curve medio-lente (< 250 km/h)
e le aggrega per team. Cache in dati_stagione/<anno>_<gp>.json cosi' l'estrazione
pesante (telemetria di gara) si fa una volta sola.

CONFONDITORI da ricordare a valle: vmax mescola potenza PU + resistenza; cornering
mescola carico aero + grip meccanico. Il confronto e' una firma di ASSETTO
(punta-vs-curva), non aero puro: va dichiarato.

python3 UTENTE (fastf1). Solo lettura del repo; scrive solo la cache in Lab.
"""
from __future__ import annotations
import os
import sys
import json
import statistics as st

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele    # noqa: E402
import curve   # noqa: E402

CACHE = os.path.join(_QUI, "dati_stagione")
CORNER_MAX = 250.0   # sopra = quasi-rettilineo, non "curva"


def _percorso(anno, gp):
    return os.path.join(CACHE, f"{anno}_{gp.replace(' ', '_')}.json")


def estrai_gara(anno, gp, sessione="Race", forza=False):
    os.makedirs(CACHE, exist_ok=True)
    p = _percorso(anno, gp)
    if os.path.exists(p) and not forza:
        return json.load(open(p))

    ses = tele.carica_sessione(anno, gp, sessione)
    piloti = tele.piloti_sessione(ses)
    corner_dists = [c["dist"] for c in curve.curve(ses)]
    try:
        loc = str(ses.event["Location"])
    except Exception:
        loc = gp
    try:
        data_gara = str(ses.event["EventDate"])[:10]
        rnd = int(ses.event["RoundNumber"])
    except Exception:
        data_gara, rnd = "", 0

    per_pilota = {}
    for sig, info in piloti.items():
        laps = tele.giri_validi(ses, info["num"])
        if len(laps) < 2:
            continue
        vmax_giri, apici = [], []
        for lap in laps[:12]:                       # cap per costo
            try:
                tel = tele.canale_giro(lap)
            except Exception:
                continue
            if tel is None or len(tel) < 50:
                continue
            vmax_giri.append(float(tel["Speed"].max()))
            for cd in corner_dists:
                a = curve._apice(tel, cd)
                if a and 40.0 <= a["speed"] < 235.0:   # curva vera (non kink, non glitch)
                    apici.append(a["speed"])
        if len(vmax_giri) < 2 or len(apici) < 6:
            continue
        # vmax = MEDIANA sui giri (robusta alla scia: un singolo giro in traino
        # non gonfia il team). cornering = mediana su tutti gli apici, molti giri.
        per_pilota[sig] = {"team": info["team"], "vmax": round(st.median(vmax_giri), 1),
                           "cornering": round(st.median(apici), 1),
                           "n_giri": len(vmax_giri), "n_curve": len(apici)}

    per_team = {}
    for sig, d in per_pilota.items():
        per_team.setdefault(d["team"], []).append(d)
    team = {t: {"vmax": round(st.mean(x["vmax"] for x in v), 1),
                "cornering": round(st.mean(x["cornering"] for x in v), 1), "n_auto": len(v)}
            for t, v in per_team.items()}

    res = {"anno": anno, "gp": gp, "circuito": loc, "data": data_gara, "round": rnd,
           "sessione": sessione, "corner_max": CORNER_MAX, "n_piloti": len(per_pilota),
           "piloti": per_pilota, "team": team}
    json.dump(res, open(p, "w"), ensure_ascii=False, indent=2)
    return res


def estrai_dna(anno, gp, sessione="Race"):
    """Aggiunge alla cache della gara la firma del CIRCUITO (tema X, DNA pista),
    dal giro veloce assoluto della sessione: percentuale a tutto gas (quanto del
    giro e' flat-out), velocita' di punta, numero e velocita' delle curve,
    lunghezza. La percentuale-gas e' il canale piu' pulito per dire se un tracciato
    chiede MOTORE (tanto flat-out) o CARICO (tante curve)."""
    p = _percorso(anno, gp)
    base = json.load(open(p)) if os.path.exists(p) else {"anno": anno, "gp": gp}
    ses = tele.carica_sessione(anno, gp, sessione)
    corner_dists = [c["dist"] for c in curve.curve(ses)]
    # firma robusta: MEDIANA sui giri lanciati del pilota piu' veloce (non il
    # singolo giro piu' flat-out, che sovrastima il polo-motore).
    num = ses.laps.pick_fastest()["DriverNumber"]
    laps = tele.giri_validi(ses, num)[:12]
    ft_pcts, vmaxs, Ls = [], [], []
    per_corner = {j: [] for j in range(len(corner_dists))}
    for lap in laps:
        try:
            tel = tele.canale_giro(lap)
        except Exception:
            continue
        d = tel["Distance"].values
        thr = tel["Throttle"].values
        spd = tel["Speed"].values
        L = float(d[-1] - d[0])
        if L <= 0:
            continue
        ft = sum(float(d[i + 1] - d[i]) for i in range(len(d) - 1) if thr[i] >= 95.0)
        ft_pcts.append(100 * ft / L)
        vmaxs.append(float(spd.max()))
        Ls.append(L)
        for j, cd in enumerate(corner_dists):
            a = curve._apice(tel, cd)
            if a:
                per_corner[j].append(a["speed"])
    if len(ft_pcts) < 2:
        return None
    cm = [st.median(v) for v in per_corner.values() if v]     # velocita' mediana per curva
    lente = sum(1 for v in cm if v < 130)
    medie = sum(1 for v in cm if 130 <= v < 210)
    veloci = sum(1 for v in cm if v >= 210)
    base["dna"] = {
        "full_throttle_pct": round(st.median(ft_pcts), 1),
        "top": round(st.median(vmaxs), 0),
        "n_curve": len(corner_dists),
        "curve_lente": lente, "curve_medie": medie, "curve_veloci": veloci,
        "vel_curva_med": round(st.median(cm), 0) if cm else None,
        "lunghezza_m": round(st.median(Ls), 0),
        "n_giri": len(ft_pcts),
    }
    json.dump(base, open(p, "w"), ensure_ascii=False, indent=2)
    return base["dna"]


def carica_stagione(anno=2026):
    """Tutte le gare estratte per un anno (dalla cache)."""
    out = []
    if not os.path.isdir(CACHE):
        return out
    for f in sorted(os.listdir(CACHE)):
        if f.startswith(f"{anno}_") and f.endswith(".json"):
            out.append(json.load(open(os.path.join(CACHE, f))))
    return out


if __name__ == "__main__":
    anno = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
    gp = sys.argv[2] if len(sys.argv) > 2 else "British Grand Prix"
    r = estrai_gara(anno, gp, sys.argv[3] if len(sys.argv) > 3 else "Race")
    print(f"{r['gp']} ({r['circuito']}): {r['n_piloti']} piloti, {len(r['team'])} team")
    for t, d in sorted(r["team"].items(), key=lambda kv: -kv[1]["vmax"]):
        print(f"  {t[:16]:16} vmax {d['vmax']:.0f}  cornering {d['cornering']:.0f}  ({d['n_auto']} auto)")
