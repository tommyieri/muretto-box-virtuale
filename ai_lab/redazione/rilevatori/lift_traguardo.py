"""
Rilevatore: lift prima del traguardo.

Misura, per ogni pilota di una sessione, se e di quanto alza il piede
dall'acceleratore nell'ultimo tratto prima della linea del traguardo, anche nel
giro lanciato.  E' un rilevatore del Canale B (caccia all'anomalia nei nostri
dati): NON scrive prosa e NON inventa nulla — misura e basta.

Definizioni dichiarate (soglie fissate qui, non a posteriori):
  FINALE_M     160  m   finestra finale in cui si cerca il lift
  THR_PIENO     95  %   soglia "gas pieno": l'ultimo campione >= 95% e' il punto di lift
  V0_MIN       200 km/h velocita' minima al punto di lift (esclude i lift da curva lenta)
  D_MIN         12  m   distanza minima gas-chiuso->linea perche' sia un "lift" e non rumore

Il costo sul giro in corso e' STIMATO (non misurato): tempo reale sul tratto del
lift meno il tempo che si farebbe tenendo la velocita' del punto di lift (V0)
fino alla linea.  E' un minorante: senza lift il pilota accelererebbe ancora.
"""
from __future__ import annotations
import os
import sys
import statistics as st

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(_QUI))          # ai_lab/redazione sul path
import tele  # noqa: E402

FINALE_M = 160.0
THR_PIENO = 95.0     # soglia "gas pieno"
THR_LINEA = 50.0     # gas alla linea sotto cui il giro "attraversa in rilascio"
V0_MIN = 200.0       # velocita' minima al picco (esclude i lift da curva lenta)
D_MIN = 12.0         # gas-pieno->linea minimo perche' sia un lift e non rumore
DV_MIN = 1.0         # km/h minimi ceduti alla linea


def misura_giro(tel):
    """Un giro (car-data con Distance) -> misure del finale, o None.

    Definizioni robuste al campionamento rado (~4 Hz) del car-data FastF1:
      d_lift  distanza-dalla-linea dell'ULTIMO campione a gas pieno (>=THR_PIENO):
              da qui in poi il gas non torna piu' pieno fino alla linea
      vpeak   velocita' massima nel finale (il picco toccato prima del rilascio)
      dv      vpeak - velocita' alla linea (>=0: km/h ceduti)
      lift    gas alla linea < THR_LINEA (attraversa in rilascio), d_lift>=D_MIN,
              vpeak>=V0_MIN (e' un rettilineo), dv>=DV_MIN
      costo_s tempo perso dopo il picco vs tenere vpeak fino alla linea (>=0, STIMATO)
    """
    if tel is None or len(tel) < 20 or "Distance" not in tel.columns:
        return None
    Lmax = float(tel["Distance"].max())
    fin = tel[tel["Distance"] >= Lmax - FINALE_M].reset_index(drop=True)
    if len(fin) < 5:
        return None
    dist_lin = [Lmax - float(d) for d in fin["Distance"]]   # distanza dalla linea
    spd = [float(v) for v in fin["Speed"]]
    thr = [float(t) for t in fin["Throttle"]]
    vpeak = max(spd)
    i_peak = spd.index(vpeak)
    vline = spd[-1]
    thr_line = thr[-1]
    dv = vpeak - vline

    pieni = [i for i in range(len(thr)) if thr[i] >= THR_PIENO]
    d_lift = dist_lin[max(pieni)] if pieni else None

    lift = bool(pieni) and (thr_line < THR_LINEA) and (d_lift is not None) \
        and (d_lift >= D_MIN) and (vpeak >= V0_MIN) and (dv >= DV_MIN)

    # costo STIMATO: integra dal picco alla linea (tempo reale - tempo a vpeak tenuto)
    costo = None
    if lift:
        c = 0.0
        for j in range(i_peak, len(spd) - 1):
            dd = dist_lin[j] - dist_lin[j + 1]            # metri verso la linea (>0)
            if dd <= 0:
                continue
            vavg = (spd[j] + spd[j + 1]) / 2.0
            if vavg > 0:
                c += dd / (vavg / 3.6) - dd / (vpeak / 3.6)
        costo = max(0.0, c)

    return {"lift": lift, "d_lift": d_lift, "vpeak": vpeak, "vline": vline,
            "dv": dv, "thr_line": thr_line, "costo_s": costo}


def misura_pilota(ses, num):
    """Tutti i giri validi di un pilota -> aggregato + il giro veloce."""
    giri = tele.giri_validi(ses, num)
    per_giro = []
    veloce = None
    t_veloce = None
    for lap in giri:
        try:
            tel = tele.canale_giro(lap)
        except Exception:
            continue
        m = misura_giro(tel)
        if m is None:
            continue
        lt = tele.secondi(lap["LapTime"])
        m["lap_time"] = lt
        per_giro.append(m)
        if lt is not None and (t_veloce is None or lt < t_veloce):
            t_veloce, veloce = lt, m
    con_lift = [g for g in per_giro if g["lift"]]

    def med(key, fonte):
        vals = [g[key] for g in fonte if g.get(key) is not None]
        return st.median(vals) if vals else None

    return {
        "n_giri": len(per_giro),
        "n_lift": len(con_lift),
        "frac_lift": (len(con_lift) / len(per_giro)) if per_giro else 0.0,
        "d_lift_med": med("d_lift", con_lift),
        "dv_med": med("dv", con_lift),
        "costo_med": med("costo_s", con_lift),
        "veloce": veloce,
        "t_veloce": t_veloce,
    }


def scansiona(anno, gp, sessione="Q"):
    ses = tele.carica_sessione(anno, gp, sessione)
    piloti = tele.piloti_sessione(ses)
    righe = {}
    for sig, info in piloti.items():
        try:
            righe[sig] = {**info, **misura_pilota(ses, info["num"])}
        except Exception as e:
            righe[sig] = {**info, "errore": str(e)}
    return ses, piloti, righe


if __name__ == "__main__":
    anno = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
    gp = sys.argv[2] if len(sys.argv) > 2 else "British Grand Prix"
    sess = sys.argv[3] if len(sys.argv) > 3 else "Q"
    _, _, righe = scansiona(anno, gp, sess)
    ok = {s: r for s, r in righe.items() if "errore" not in r and r.get("n_giri")}
    ordinati = sorted(ok.items(), key=lambda kv: kv[1]["t_veloce"] or 9e9)
    print(f"\n== LIFT PRIMA DEL TRAGUARDO — {gp} {anno} {sess} ==")
    print(f"{'DRV':4} {'TEAM':14} {'giri':4} {'lift':5} {'frac':5} "
          f"{'dLiftMed':8} {'dVmed':6} {'costoMed_s':10} | {'veloce:dLift':12} {'dV':5}")
    for sig, r in ordinati:
        v = r.get("veloce") or {}
        def f(x, n=1): return f"{x:.{n}f}" if isinstance(x, (int, float)) else "-"
        vd = v.get("d_lift"); vdv = v.get("dv")
        vlift = f"{vd:.0f}m" if isinstance(vd, (int, float)) else "no-lift"
        print(f"{sig:4} {str(r['team'])[:14]:14} {r['n_giri']:4d} {r['n_lift']:5d} "
              f"{r['frac_lift']*100:4.0f}% {f(r['d_lift_med']):>8} {f(r['dv_med']):>6} "
              f"{f(r['costo_med'],3):>10} | {vlift:>12} {f(vdv):>5}")
