"""gen_neutralizzazione.py — genera demo/neutralizzazione.json dai flag per-auto dei raw.

Fonte di verita': i raw TracingInsights per gara (percorsi in data/gare_registro.json —
il registro e' il superset di engine.FILES: il kernel resta congelato, le gare nuove
entrano dal registro via pipeline_gara.py).
Definizione (vedi data/NEUTRALIZZAZIONE_NOTA.txt):
  - un giro L e' "neutralizzato per la gara" se >=2 auto hanno status SC ('4') o VSC ('6') a L;
  - finestra = run massimale di giri neutralizzati consecutivi;
  - tipo finestra = codice prevalente tra i flag della finestra (pareggio -> SC, il caso peggiore);
  - durata_sc / durata_vsc = durata media delle finestre di quel tipo (giri).
Schema di output identico al precedente: {gara: {sc, vsc, durata_sc, durata_vsc}}.
"""
import os, json

REGISTRO = os.path.join('data', 'gare_registro.json')
SOGLIA = 2  # auto flaggate perche' il giro conti per la gara (esclude artefatti mono-auto)

def finestre(giri):
    if not giri: return []
    giri = sorted(giri); out = [[giri[0], giri[0]]]
    for g in giri[1:]:
        if g == out[-1][1] + 1: out[-1][1] = g
        else: out.append([g, g])
    return out

def genera_gara(raw_path):
    d = json.load(open(raw_path))
    n = len(d["lap"])
    sc_cnt, vsc_cnt, rf_cnt = {}, {}, {}  # lap -> n auto flaggate
    for i in range(n):
        lap, status = d["lap"][i], str(d["status"][i])
        if lap is None: continue
        L = int(lap)
        if "4" in status: sc_cnt[L] = sc_cnt.get(L, 0) + 1
        if "6" in status: vsc_cnt[L] = vsc_cnt.get(L, 0) + 1
        if "5" in status: rf_cnt[L] = rf_cnt.get(L, 0) + 1  # '5' = bandiera rossa (gara sospesa)
    neut = [L for L in set(sc_cnt) | set(vsc_cnt)
            if sc_cnt.get(L, 0) + vsc_cnt.get(L, 0) >= SOGLIA]
    sc_fin, vsc_fin = [], []
    for a, b in finestre(neut):
        n_sc = sum(sc_cnt.get(L, 0) for L in range(a, b + 1))
        n_vsc = sum(vsc_cnt.get(L, 0) for L in range(a, b + 1))
        (sc_fin if n_sc >= n_vsc else vsc_fin).append([a, b])
    dur = lambda fs: round(sum(b - a + 1 for a, b in fs) / len(fs), 1) if fs else 0.0
    # rf = finestre bandiera rossa. ADDITIVO: i giri rossi restano dentro la finestra sc
    # (la soppressione gap del pit, che legge sc/vsc, non cambia — C1 intatto). rf serve
    # SOLO al banner/timeline dell'interfaccia.
    rf_fin = finestre([L for L in rf_cnt if rf_cnt[L] >= SOGLIA])
    return {"sc": sc_fin, "vsc": vsc_fin, "rf": rf_fin,
            "durata_sc": dur(sc_fin), "durata_vsc": dur(vsc_fin)}

def genera(gare):
    """gare: {nome_demo: percorso_raw} -> dict completo per neutralizzazione.json"""
    return {gara: genera_gara(raw) for gara, raw in gare.items()}

def gare_da_registro():
    reg = json.load(open(REGISTRO))
    return {g: v['raw'] for g, v in reg.items()}

if __name__ == '__main__':
    out = genera(gare_da_registro())
    for gara, v in out.items():
        print(f"{gara:14s} sc={v['sc']} vsc={v['vsc']}")
    with open(os.path.join("demo", "neutralizzazione.json"), "w") as f:
        json.dump(out, f, indent=2)
    print(f"\ndemo/neutralizzazione.json scritto: {len(out)} gare (soglia >={SOGLIA} auto)")
