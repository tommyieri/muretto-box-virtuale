#!/usr/bin/env python3
"""gen_giri.py — LA TELEMETRIA GIRO PER GIRO, non piu' solo il giro veloce.

Il problema che risolve. Fino a oggi il sito mostrava un giro solo per pilota
(il piu' veloce della sessione, demo/data/tele_*.json): chi voleva guardare un
giro preciso — il giro dell'undercut, quello dietro alla safety car, il primo
con la gomma nuova — non poteva. Qui ogni giro cronometrato di ogni pilota ha
la sua traccia, e la pagina puo' finalmente chiedere «fammi vedere il giro 34».

Metodo. Da FastF1 (car_data del giro + Distance), ogni giro viene ricampionato
su una griglia UNIFORME di N punti lungo il giro, normalizzata sulla distanza
percorsa: due giri qualsiasi, di piloti qualsiasi, cadono sugli stessi punti e
si confrontano senza allineamenti a occhio. Niente medie, niente riempimenti:
un giro senza campioni non entra.

Formato (compatto apposta: un giro sono ~1,2 KB, una gara intera ~2 MB).
  demo/data/giri/<gara>__<sess>.json          indice: piloti, giri, tempi, gomme
  demo/data/giri/<gara>__<sess>__<SIG>.json   tracce del pilota, giro per giro

Le tracce sono base64 di array interi:
  v      uint8   velocita' / 1.6   (0-408 km/h)
  gas    uint8   0-100 %
  freno  uint8   0/1
  marcia uint8   0-8
  drs    uint8   0/1
  t      uint16  tempo dall'inizio giro, in unita' di `t_scala` secondi

IL TEMPO HA UNA SCALA PER-GIRO, e non e' un vezzo. In centesimi fissi il fondo scala
di uint16 e' 655,35 s: 565 giri su 31.840 (i giri con una sosta lunga dentro, o una
bandiera rossa) ci sbattevano contro e venivano TRONCATI IN SILENZIO — la curva del
distacco di quei giri era falsa senza che niente lo dicesse. Con `t_scala =
durata/65535` la saturazione non e' piu' possibile per costruzione, e su un giro
normale la risoluzione MIGLIORA (1/65535 di 90 s = 1,4 ms contro i 10 ms dei centesimi).

Uso:
  python3 gen_giri.py --gara Belgio --sessione R
  python3 gen_giri.py --tutto              # tutte le gare del calendario, tutte le sessioni
  python3 gen_giri.py --tutto --solo R     # solo le gare
"""
import argparse
import base64
import json
import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.join(HERE, "demo")
DATI = os.path.join(DEMO, "data")
FUORI = os.path.join(DATI, "giri")

N = 150                      # punti per giro sulla griglia uniforme
SCALA_V = 1.6                # km/h per unita' (uint8 -> 408 km/h di fondo scala)

# le sessioni che proviamo, col nome che useremo nei file
SESSIONI = [("FP1", "fp1"), ("FP2", "fp2"), ("FP3", "fp3"),
            ("SQ", "sprint_quali"), ("S", "sprint"),
            ("Q", "qualifiche"), ("R", "gara")]


def b64(arr, dtype):
    return base64.b64encode(np.asarray(arr, dtype=dtype).tobytes()).decode("ascii")


def secondi(td):
    """Timedelta pandas -> secondi float, oppure None."""
    if td is None:
        return None
    try:
        if td != td:                      # NaT
            return None
        return round(td.total_seconds(), 3)
    except (TypeError, AttributeError):
        return None


def campiona(tel):
    """car_data di UN giro -> i sei canali sulla griglia uniforme, o None.

    L'asse e' la distanza percorsa nel giro, normalizzata a [0,1]: cosi' due
    giri di lunghezza leggermente diversa (traiettorie diverse) restano
    confrontabili punto per punto."""
    if tel is None or len(tel) < 20:
        return None
    d = tel["Distance"].to_numpy(dtype=float)
    d = d - d[0]
    if not np.isfinite(d).all() or d[-1] <= 0:
        return None
    x = d / d[-1]
    # la distanza deve crescere: se il GPS torna indietro, il giro non e' pulito
    if np.any(np.diff(x) < -1e-6):
        ordine = np.argsort(x, kind="stable")
        x = x[ordine]
        tel = tel.iloc[ordine]
    g = np.linspace(0.0, 1.0, N)

    def interp(col, default=0.0):
        try:
            y = tel[col].to_numpy(dtype=float)
        except (KeyError, ValueError):
            return np.full(N, default)
        y = np.nan_to_num(y, nan=default)
        return np.interp(g, x, y)

    v = np.clip(interp("Speed") / SCALA_V, 0, 255)
    gas = np.clip(interp("Throttle"), 0, 100)
    freno = (interp("Brake") > 0.5).astype(np.uint8)
    marcia = np.clip(interp("nGear"), 0, 8)
    try:
        drs_raw = interp("DRS")
        drs = np.isin(np.round(drs_raw), [10, 12, 14]).astype(np.uint8)
    except Exception:
        drs = np.zeros(N, dtype=np.uint8)
    t = tel["Time"].dt.total_seconds().to_numpy(dtype=float)
    t = t - t[0]
    tt_s = np.interp(g, x, t)
    durata = float(max(tt_s[-1], 1e-3))
    scala = durata / 65535.0
    tt = np.clip(np.round(tt_s / scala), 0, 65535)
    return {
        "t_scala": round(scala, 9),
        "v": b64(np.round(v), np.uint8),
        "gas": b64(np.round(gas), np.uint8),
        "freno": b64(freno, np.uint8),
        "marcia": b64(np.round(marcia), np.uint8),
        "drs": b64(drs, np.uint8),
        "t": b64(tt, np.uint16),
    }


def estrai(sess, gara, nome_sess, colori, teams):
    """Una sessione caricata -> (indice, {sigla: tracce})."""
    laps = sess.laps
    if laps is None or len(laps) == 0:
        return None, None
    indice_piloti, tracce = {}, {}
    for sig in sorted(set(laps["Driver"].dropna())):
        suoi = laps.pick_drivers(sig)
        if len(suoi) == 0:
            continue
        giri_meta, giri_tel = [], {}
        for _, lap in suoi.iterlaps():
            try:
                n_giro = int(lap["LapNumber"])
            except (TypeError, ValueError):
                continue
            try:
                tel = lap.get_car_data().add_distance()
            except Exception:
                tel = None
            canali = campiona(tel)
            t_giro = secondi(lap["LapTime"])
            in_lap = lap["PitInTime"] == lap["PitInTime"]
            out_lap = lap["PitOutTime"] == lap["PitOutTime"]
            meta = {
                "n": n_giro,
                "t": t_giro,
                "s1": secondi(lap["Sector1Time"]),
                "s2": secondi(lap["Sector2Time"]),
                "s3": secondi(lap["Sector3Time"]),
                "vmax": None,
                "mescola": (lap["Compound"] if isinstance(lap["Compound"], str) else None),
                "eta": (int(lap["TyreLife"]) if lap["TyreLife"] == lap["TyreLife"] else None),
                # UN GIRO CANCELLATO NON E' UN GIRO. La direzione gara ne toglie di
                # continuo per track limits, e FastF1 li lascia IsAccurate e cronometrati:
                # il foglio tempi proponeva come «miglior giro» tempi che non esistono.
                # `is not True` e non `== False`: quando i messaggi non ci sono la colonna
                # e' NaN, e la sessione si comporta come prima.
                "buono": (bool(lap["IsAccurate"]) and t_giro is not None
                          and lap.get("Deleted") is not True),
                "box": ("in" if in_lap else ("out" if out_lap else None)),
                "tel": bool(canali),
            }
            if canali:
                vmax = np.frombuffer(base64.b64decode(canali["v"]), dtype=np.uint8)
                meta["vmax"] = int(round(float(vmax.max()) * SCALA_V))
                giri_tel[str(n_giro)] = canali
            giri_meta.append(meta)
        if not giri_meta:
            continue
        try:
            num = str(int(sess.get_driver(sig)["DriverNumber"]))
            nome = str(sess.get_driver(sig)["FullName"])
        except Exception:
            num, nome = "", sig
        team = teams.get(sig, "")
        indice_piloti[sig] = {
            "num": num, "nome": nome, "team": team,
            "colore": colori.get(team, "#8A93A3"),
            "giri": giri_meta,
        }
        tracce[sig] = {"n": N, "giri": giri_tel}
    if not indice_piloti:
        return None, None
    indice = {
        "gara": gara, "sessione": nome_sess,
        "evento": str(sess.event["EventName"]),
        "circuito": str(sess.event["Location"]),
        "n": N,
        "piloti": indice_piloti,
    }
    return indice, tracce


def slug(s):
    return (s.lower().replace(" ", "-").replace("'", "")
            .replace("à", "a").replace("è", "e").replace("é", "e"))


def scrivi(indice, tracce, gara):
    os.makedirs(FUORI, exist_ok=True)
    base = f"{slug(gara)}__{indice['sessione']}"
    tot = 0
    p = os.path.join(FUORI, base + ".json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(indice, f, ensure_ascii=False, separators=(",", ":"))
    tot += os.path.getsize(p)
    for sig, tr in tracce.items():
        p = os.path.join(FUORI, f"{base}__{sig}.json")
        with open(p, "w", encoding="utf-8") as f:
            json.dump(tr, f, ensure_ascii=False, separators=(",", ":"))
        tot += os.path.getsize(p)
    return base, tot


def una(anno, rnd, gara, sess_ff, nome_sess, colori, teams, forza=False):
    import fastf1
    base = f"{slug(gara)}__{nome_sess}"
    if not forza and os.path.exists(os.path.join(FUORI, base + ".json")):
        print(f"  · {gara} {nome_sess}: gia' scritto, salto")
        return True
    t0 = time.time()
    try:
        s = fastf1.get_session(anno, rnd, sess_ff)
        # messages=True: senza il race control la colonna `Deleted` resta vuota e i
        # giri cancellati passerebbero per buoni.
        s.load(telemetry=True, weather=False, messages=True)
    except Exception as e:
        print(f"  · {gara} {sess_ff}: non disponibile ({type(e).__name__})")
        return False
    try:
        indice, tracce = estrai(s, gara, nome_sess, colori, teams)
    except Exception as e:
        print(f"  ! {gara} {sess_ff}: estrazione fallita — {type(e).__name__}: {e}")
        return False
    if not indice:
        print(f"  · {gara} {sess_ff}: nessun giro")
        return False
    base, tot = scrivi(indice, tracce, gara)
    ngiri = sum(len(p["giri"]) for p in indice["piloti"].values())
    print(f"  ✓ {base}: {len(indice['piloti'])} piloti, {ngiri} giri, "
          f"{tot/1e6:.2f} MB, {time.time()-t0:.0f}s")
    return True


def manifest():
    """Riscrive l'elenco di cio' che c'e' davvero su disco."""
    voci = {}
    for f in sorted(os.listdir(FUORI)):
        if not f.endswith(".json") or f.count("__") != 1:
            continue
        try:
            d = json.load(open(os.path.join(FUORI, f), encoding="utf-8"))
        except Exception:
            continue
        voci.setdefault(d["gara"], []).append({
            "sessione": d["sessione"],
            "piloti": len(d["piloti"]),
            "giri": sum(len(p["giri"]) for p in d["piloti"].values()),
        })
    p = os.path.join(DATI, "giri_manifest.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump({"gare": voci}, f, ensure_ascii=False, indent=1)
    print(f"manifest: {len(voci)} gare -> {p}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gara")
    ap.add_argument("--sessione")
    ap.add_argument("--tutto", action="store_true")
    ap.add_argument("--solo", action="append", help="limita alle sessioni indicate (R, Q, FP2...)")
    ap.add_argument("--anno", type=int, default=2026)
    ap.add_argument("--forza", action="store_true")
    ap.add_argument("--cache", default=os.path.join(HERE, "data", "ff1_cache"))
    ap.add_argument("--solo-manifest", action="store_true")
    a = ap.parse_args()

    os.makedirs(FUORI, exist_ok=True)
    if a.solo_manifest:
        manifest()
        return 0

    os.makedirs(a.cache, exist_ok=True)
    import fastf1
    import logging
    fastf1.Cache.enable_cache(a.cache)
    logging.getLogger("fastf1").setLevel(logging.ERROR)

    colori = json.load(open(os.path.join(DEMO, "team_colori.json"), encoding="utf-8"))
    teams = json.load(open(os.path.join(DATI, "teams.json"), encoding="utf-8"))
    cal = json.load(open(os.path.join(DATI, "calendario_2026.json"), encoding="utf-8"))
    corse = [g for g in cal["gare"] if g.get("gara_demo")]

    if a.gara:
        corse = [g for g in corse if g["nome"] == a.gara]
        if not corse:
            print(f"gara sconosciuta: {a.gara}", file=sys.stderr)
            return 2
    elif not a.tutto:
        print("serve --gara o --tutto", file=sys.stderr)
        return 2

    sessioni = SESSIONI
    if a.sessione:
        sessioni = [(s, n) for s, n in SESSIONI if s == a.sessione or n == a.sessione]
    elif a.solo:
        voluti = {v.upper() for v in a.solo}
        sessioni = [(s, n) for s, n in SESSIONI if s.upper() in voluti or n.upper() in voluti]

    for g in corse:
        print(f"{g['round']:>2}. {g['nome']}")
        for sess_ff, nome in sessioni:
            una(a.anno, g["round"], g["nome"], sess_ff, nome, colori, teams, a.forza)
    manifest()
    return 0


if __name__ == "__main__":
    sys.exit(main())
