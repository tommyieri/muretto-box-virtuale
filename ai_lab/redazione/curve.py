"""
curve.py — la mappa-curve GPS: il mattone che sblocca i temi telemetrici del
mandato (Tecnica, Assetto/frenata, e la segmentazione dei rettilinei per l'energia).

Da FastF1 `circuit_info` ricava le curve del circuito (numero + distanza lungo il
giro) e offre helper per misurare un canale telemetrico al PUNTO-FIRMA (l'apice
della curva) su piu' giri, in modo comparabile fra piloti.

Costruita una volta, i rilevatori che misurano "un canale in un punto di pista"
diventano economici: si chiede la curva, si misura, si confronta.

python3 UTENTE (fastf1). Solo lettura.
"""
from __future__ import annotations
import os
import sys
import statistics as st

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)
import tele  # noqa: E402


def curve(ses):
    """Le curve del circuito: lista di dict {numero, lettera, dist, angolo, x, y}.
    dist = distanza lungo il giro (stessa scala di canale_giro().Distance)."""
    ci = ses.get_circuit_info()
    out = []
    for _, r in ci.corners.iterrows():
        out.append({
            "numero": int(r["Number"]),
            "lettera": str(r.get("Letter", "") or ""),
            "dist": float(r["Distance"]),
            "angolo": float(r.get("Angle", 0.0)),
            "x": float(r.get("X", 0.0)), "y": float(r.get("Y", 0.0)),
        })
    return out


def _apice(tel, dist_curva, indietro=25.0, avanti=75.0):
    """La riga di telemetria all'apice (min velocita') in una finestra ASIMMETRICA
    attorno alla distanza della curva. Il riferimento di circuit_info marca l'INIZIO
    della curva: il vero apice (min velocita') cade tipicamente 20-60 m DOPO, quindi
    la finestra guarda piu' avanti che indietro (evita anche di invadere la curva
    precedente). None se fuori giro o troppo pochi campioni."""
    d = tel["Distance"].values
    m = (d >= dist_curva - indietro) & (d <= dist_curva + avanti)
    sub = tel[m]
    if len(sub) < 3:
        return None
    i = sub["Speed"].values.argmin()
    r = sub.iloc[i]
    return {"gear": int(r["nGear"]), "speed": float(r["Speed"]),
            "rpm": float(r["RPM"]), "dist": float(r["Distance"])}


def al_apice(ses, num, dist_curva, indietro=25.0, avanti=75.0):
    """Aggregato di un pilota all'apice di una curva su TUTTI i giri lanciati:
    marcia modale (+ consistenza), velocita' e RPM mediani, n giri."""
    marce, vel, rpm = [], [], []
    for lap in tele.giri_validi(ses, num):
        try:
            tel = tele.canale_giro(lap)
        except Exception:
            continue
        a = _apice(tel, dist_curva, indietro, avanti)
        if a:
            marce.append(a["gear"]); vel.append(a["speed"]); rpm.append(a["rpm"])
    if len(marce) < 3:
        return None
    modo = st.mode(marce)
    return {
        "gear_modo": modo,
        "gear_consistenza": marce.count(modo) / len(marce),
        "gear_tutte": marce,
        "vmin_med": st.median(vel),
        "rpm_med": st.median(rpm),
        "n": len(marce),
    }


def profilo_curva(tel, dist_curva, indietro=25.0, avanti=75.0):
    """Profilo di frenata e trazione attorno a una curva, ancorato al VERO apice
    (min velocita'). Un giro -> dict con: apex (dist/vel/gear/rpm), v d'ingresso,
    punto di frenata (m prima dell'apice), rilascio freno (rel. all'apice, >0 =
    trail-braking oltre l'apice), e ripresa gas pieno (m dopo l'apice)."""
    import numpy as np
    d = tel["Distance"].values
    sp = tel["Speed"].values
    thr = tel["Throttle"].values
    brk = tel["Brake"].values.astype(bool)
    gear = tel["nGear"].values
    rpm = tel["RPM"].values
    m = (d >= dist_curva - indietro) & (d <= dist_curva + avanti)
    idx = np.where(m)[0]
    if len(idx) < 3:
        return None
    ia = idx[sp[idx].argmin()]
    apex_d = float(d[ia])
    appr = (d >= apex_d - 200) & (d <= apex_d - 5)
    v_ing = float(sp[appr].max()) if appr.any() else float(sp[ia])
    bwin = np.where((d >= apex_d - 220) & (d <= apex_d + 40) & brk)[0]
    brake_on = (apex_d - float(d[bwin.min()])) if len(bwin) else None
    brake_off = (float(d[bwin.max()]) - apex_d) if len(bwin) else None
    full_after = None
    for j in np.where((d >= apex_d) & (d <= apex_d + 300))[0]:
        if thr[j] >= 95:
            full_after = float(d[j]) - apex_d
            break
    return {"apex_d": apex_d, "apex_v": float(sp[ia]), "apex_gear": int(gear[ia]),
            "apex_rpm": float(rpm[ia]), "v_ing": v_ing,
            "brake_on": brake_on, "brake_off": brake_off, "full_after": full_after}


def aggrega(ses, num, dist_curva):
    """Mediana del profilo-curva sui giri lanciati di un pilota (+ n)."""
    import statistics as _st
    prof = []
    for lap in tele.giri_validi(ses, num):
        try:
            tel = tele.canale_giro(lap)
        except Exception:
            continue
        p = profilo_curva(tel, dist_curva)
        if p:
            prof.append(p)
    if len(prof) < 3:
        return None
    def med(k):
        vals = [p[k] for p in prof if p.get(k) is not None]
        return _st.median(vals) if vals else None
    return {k: med(k) for k in ("apex_v", "apex_gear", "v_ing", "brake_on", "brake_off", "full_after")} | {"n": len(prof)}


def traccia_curva(ses, num, dist_curva, meta=140.0, n=80):
    """Traccia Speed/nGear/RPM attorno a una curva (dist-dalla-curva in metri,
    negativa in avvicinamento) per il grafico. Dal giro veloce del pilota."""
    lap = ses.laps.pick_drivers(num).pick_fastest()
    tel = tele.canale_giro(lap)
    d = tel["Distance"].values
    m = (d >= dist_curva - meta) & (d <= dist_curva + meta)
    sub = tel[m].reset_index(drop=True)
    punti = []
    for _, r in sub.iterrows():
        punti.append((float(r["Distance"]) - dist_curva, float(r["Speed"]),
                      int(r["nGear"]), float(r["RPM"])))
    if len(punti) > n:
        step = len(punti) / n
        punti = [punti[int(i * step)] for i in range(n)]
    return punti


def traccia_gas(ses, num, dist_curva, meta=170.0, n=90):
    """Traccia (dist-dall'apice, velocita', gas%) attorno a una curva, dal giro
    veloce. L'apice = vero minimo di velocita' nella finestra -25/+75."""
    lap = ses.laps.pick_drivers(num).pick_fastest()
    tel = tele.canale_giro(lap)
    a = _apice(tel, dist_curva)
    if not a:
        return []
    apex_d = a["dist"]
    d = tel["Distance"].values
    m = (d >= apex_d - meta) & (d <= apex_d + meta)
    sub = tel[m].reset_index(drop=True)
    punti = [(float(r["Distance"]) - apex_d, float(r["Speed"]), float(r["Throttle"]))
             for _, r in sub.iterrows()]
    if len(punti) > n:
        step = len(punti) / n
        punti = [punti[int(i * step)] for i in range(n)]
    return punti
