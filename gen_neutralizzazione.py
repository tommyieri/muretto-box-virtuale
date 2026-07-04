"""gen_neutralizzazione.py — genera demo/neutralizzazione.json dai flag per-auto dei raw ti_cache.

Fonte di verita': data/ti_cache/*.json (gli stessi raw da cui nascono i JSON demo).
Definizione (vedi data/NEUTRALIZZAZIONE_NOTA.txt):
  - un giro L e' "neutralizzato per la gara" se >=2 auto hanno status SC ('4') o VSC ('6') a L;
  - finestra = run massimale di giri neutralizzati consecutivi;
  - tipo finestra = codice prevalente tra i flag della finestra (pareggio -> SC, il caso peggiore);
  - durata_sc / durata_vsc = durata media delle finestre di quel tipo (giri).
Schema di output identico al precedente: {gara: {sc, vsc, durata_sc, durata_vsc}}.
"""
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "engine"))
from engine import FILES  # mapping gara demo -> file ti_cache; nessun download: solo il dict

SOGLIA = 2  # auto flaggate perche' il giro conti per la gara (esclude artefatti mono-auto)

def finestre(giri):
    if not giri: return []
    giri = sorted(giri); out = [[giri[0], giri[0]]]
    for g in giri[1:]:
        if g == out[-1][1] + 1: out[-1][1] = g
        else: out.append([g, g])
    return out

out = {}
for gara, fname in FILES.items():
    d = json.load(open(os.path.join("data", "ti_cache", fname + ".json")))
    n = len(d["lap"])
    sc_cnt, vsc_cnt = {}, {}  # lap -> n auto flaggate
    for i in range(n):
        lap, status = d["lap"][i], str(d["status"][i])
        if lap is None: continue
        L = int(lap)
        if "4" in status: sc_cnt[L] = sc_cnt.get(L, 0) + 1
        if "6" in status: vsc_cnt[L] = vsc_cnt.get(L, 0) + 1
    neut = [L for L in set(sc_cnt) | set(vsc_cnt)
            if sc_cnt.get(L, 0) + vsc_cnt.get(L, 0) >= SOGLIA]
    sc_fin, vsc_fin = [], []
    for a, b in finestre(neut):
        n_sc = sum(sc_cnt.get(L, 0) for L in range(a, b + 1))
        n_vsc = sum(vsc_cnt.get(L, 0) for L in range(a, b + 1))
        (sc_fin if n_sc >= n_vsc else vsc_fin).append([a, b])
    dur = lambda fs: round(sum(b - a + 1 for a, b in fs) / len(fs), 1) if fs else 0.0
    out[gara] = {"sc": sc_fin, "vsc": vsc_fin,
                 "durata_sc": dur(sc_fin), "durata_vsc": dur(vsc_fin)}
    print(f"{gara:10s} sc={sc_fin} vsc={vsc_fin}")

with open(os.path.join("demo", "neutralizzazione.json"), "w") as f:
    json.dump(out, f, indent=2)
print(f"\ndemo/neutralizzazione.json scritto: {len(out)} gare (soglia >={SOGLIA} auto)")
