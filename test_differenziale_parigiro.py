"""test_differenziale_parigiro.py — Fase 2.1, ramo di ripiego: il DELTA di degrado a pari giro.

Idea: l'undercut dipende dal differenziale gomma-nuova-vs-vecchia tra due piloti allo
STESSO giro-sessione, dove evoluzione pista e fuel si elidono per costruzione (stesso giro).

DISEGNO (per gara, per compound):
    Dt(i,j,L) = FE(coppia i,j) + gamma_diff_c * Dlife(i,j,L) + eps
  - coppie di piloti sullo stesso giro L, STESSO compound, |Dlife| >= 5 giri;
  - effetto fisso di coppia: assorbe il delta di passo-base dei due piloti;
  - identificazione: SOLO coppie il cui Dlife CAMBIA tra giri osservati (un pit in mezzo)
    — le coppie a Dlife costante alimentano solo il FE e sono scartate ESPLICITAMENTE;
  - stessi filtri F1-F7 del test principale (import diretto: una sola definizione);
  - SE cluster-robust per coppia; IC95.
Il CONTEGGIO delle coppie utilizzabili per gara fa parte dell'esito (a Monaco-tipo poche).
"""
import statistics as st
import numpy as np
from test_identificabilita_degrado import (RACES, SLICK, SOGLIA_OUTLIER,
                                           carica, pulisci, filtro_outlier)

MIN_DLIFE = 5

def coppie_gara(keep):
    by_lap = {}
    for r in keep: by_lap.setdefault(int(r['lap']), []).append(r)
    oss = {}   # (compound, coppia) -> lista (Dlife, Dt)
    for L, rows in by_lap.items():
        for i in range(len(rows)):
            for j in range(i+1, len(rows)):
                a, b = rows[i], rows[j]
                if a['compound'] != b['compound']: continue
                dl = a['life'] - b['life']
                if abs(dl) < MIN_DLIFE: continue
                key = (a['compound'], tuple(sorted((a['drv'], b['drv']))))
                if a['drv'] > b['drv']: dl, dt = -dl, b['time']-a['time']
                else: dt = a['time']-b['time']
                oss.setdefault(key, []).append((dl, dt))
    return oss

def fit_diff(oss, compound):
    """FE di coppia + gamma*Dlife; solo coppie con Dlife variabile."""
    coppie = {k: v for k, v in oss.items()
              if k[0] == compound and len({dl for dl, _ in v}) >= 2 and len(v) >= 3}
    if len(coppie) < 3: return None, len(coppie)
    keys = sorted(coppie); ki = {k: i for i, k in enumerate(keys)}
    n = sum(len(v) for v in coppie.values()); k = len(keys)+1
    X = np.zeros((n, k)); y = np.zeros(n); grp = []
    r = 0
    for key, v in coppie.items():
        for dl, dt in v:
            X[r, ki[key]] = 1.0; X[r, -1] = dl; y[r] = dt; grp.append(key); r += 1
    if np.linalg.matrix_rank(X) < k: return None, len(coppie)
    b, *_ = np.linalg.lstsq(X, y, rcond=None)
    u = y - X@b
    XtX_inv = np.linalg.inv(X.T@X)
    G = len(coppie); meat = np.zeros((k, k)); per_g = {}
    for i, g in enumerate(grp): per_g.setdefault(g, []).append(i)
    for idx in per_g.values():
        s = X[idx].T @ u[idx]; meat += np.outer(s, s)
    V = XtX_inv @ meat @ XtX_inv * (G/(G-1))*((n-1)/(n-k))
    se = float(np.sqrt(V[-1, -1]))
    return dict(gamma=float(b[-1]), se=se, lo=float(b[-1]-1.96*se),
                hi=float(b[-1]+1.96*se), n_oss=n, n_coppie=G), G

if __name__ == '__main__':
    print("RAMO DIFFERENZIALE A PARI GIRO — gamma_diff per compound (evoluzione elisa per costruzione)")
    agg = {c: [] for c in SLICK}
    for nome, path in RACES.items():
        rows = carica(path); keep, _, N = pulisci(rows)
        keep, _ = filtro_outlier(keep, SOGLIA_OUTLIER)
        oss = coppie_gara(keep)
        print(f"\n--- {nome} ---")
        for c in SLICK:
            res, n_c = fit_diff(oss, c)
            tot_c = len([k for k in oss if k[0] == c])
            if res is None:
                print(f"    {c:6s}: NON IDENTIFICABILE (coppie a Dlife variabile: {n_c}; coppie totali stesso-compound: {tot_c})")
                continue
            sig = '*' if (res['lo'] > 0 or res['hi'] < 0) else ' '
            print(f"    {c:6s}: gamma_diff = {res['gamma']:+.4f} s/giro  IC95 [{res['lo']:+.4f},{res['hi']:+.4f}]{sig} "
                  f"(coppie utilizzabili {res['n_coppie']}/{tot_c}, osservazioni {res['n_oss']})")
            agg[c].append((nome, res))
    print("\n=== SINTESI CROSS-GARA (mediana gamma_diff; confronto col modello FE pilota-gara) ===")
    for c in SLICK:
        if not agg[c]: print(f"{c:6s}: mai identificabile"); continue
        med = st.median([r['gamma'] for _, r in agg[c]])
        sig = [n for n, r in agg[c] if r['lo'] > 0 or r['hi'] < 0]
        print(f"{c:6s}: identificabile in {len(agg[c])} gare, mediana {med:+.4f}, IC esclude 0 in {len(sig)} ({sig})")
