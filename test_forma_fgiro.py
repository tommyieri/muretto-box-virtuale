"""test_forma_fgiro.py — sessione-ponte pre-2.2: la forma di f(giro).

DOMANDA UNICA: una f(giro) che catturi l'evoluzione front-loaded risolve l'anomalia
Australia-MEDIUM (gamma~0, inversione forte M<H) senza destabilizzare i gamma delle
altre gare?

FORME CANDIDATE (dichiarate):
  lin    : beta1*giro                       (baseline Fase 2.1)
  linlog : beta1*giro + beta2*ln(giro)      (evoluzione saturante: la gommatura rende
                                             molto nei primi giri, poi si stabilizza)
  spline : lineare a tratti, nodi ai terzili dei giri della gara (flessibile, nessuna
                                             forma imposta)

CRITERIO DI PREFERENZA (dichiarato PRIMA dei risultati, applicato senza sconti):
  PRIMARIO   : BIC per gara; la forma non-lineare e' adottata solo se batte il lineare
               in >=5/8 gare.
  SECONDARIO (riportato, non decisivo): RMSE leave-one-stint-out (fuori campione,
               fold = cluster (pilota,stint); righe di piloti assenti dal train escluse).
  GUARDIA    : se gli IC dei gamma si allargano oltre il 50% mediano, la forma ricca
               non e' sostenuta dai dati e il lineare resta il male minore.

VERDETTO (criteri dichiarati):
  Australia-MEDIUM chiusa se gamma_M >= +0.02 oppure IC95 con hi >= +0.047 (storico).
  LOCALE  : tutti i gamma delle ALTRE 7 gare (forma adottata) dentro il proprio IC95
            lineare originale -> GO pulito alla 2.2.
  GLOBALE : anche un solo gamma fuori dal proprio IC originale -> i gamma della Fase 2.1
            vanno ricalcolati con la forma corretta prima della 2.2.

Stesso disegno della Fase 2.1 (import diretto: una sola definizione dei filtri):
base per (pilota, gara) — MAI per stint —, delta_compound, guardrail di soglia e di rango,
SE cluster-robust per (pilota, stint).
"""
import statistics as st
import numpy as np
from test_identificabilita_degrado import (RACES, SLICK, MIN_STINT, MIN_GIRI,
                                           FUEL_SKG, FUEL_KG, SOGLIA_OUTLIER,
                                           carica, pulisci, filtro_outlier)

def basi_giro(forma, lap, tutti_lap):
    m = float(np.mean(tutti_lap))
    if forma == 'lin':    return [lap - m]
    if forma == 'linlog': return [lap - m, float(np.log(lap))]
    if forma == 'spline':
        k1, k2 = np.quantile(tutti_lap, [1/3, 2/3])
        return [lap - m, max(0.0, lap - k1), max(0.0, lap - k2)]
    raise ValueError(forma)

def prepara(keep):
    """guardrail compound identici alla Fase 2.1"""
    stint_per_c, giri_per_c = {}, {}
    for r in keep:
        c = r['compound']; giri_per_c[c] = giri_per_c.get(c, 0) + 1
        stint_per_c.setdefault(c, set()).add((r['drv'], int(r['stint'])))
    ident = [c for c in SLICK if len(stint_per_c.get(c, ())) >= MIN_STINT and giri_per_c.get(c, 0) >= MIN_GIRI]
    rows = [r for r in keep if r['compound'] in ident]
    return rows, ident, stint_per_c, giri_per_c

def costruisci(rows, ident, N, forma):
    rif = 'MEDIUM' if 'MEDIUM' in ident else ident[0]
    drvs = sorted({r['drv'] for r in rows}); di = {d: i for i, d in enumerate(drvs)}
    tutti_lap = [r['lap'] for r in rows]
    nb = len(basi_giro(forma, tutti_lap[0], tutti_lap))
    nd, nc = len(drvs), len(ident)
    k = nd + (nc-1) + nb + nc
    delta_idx = {c: nd+j for j, c in enumerate([c for c in ident if c != rif])}
    gamma_idx = {c: nd+(nc-1)+nb+j for j, c in enumerate(ident)}
    X = np.zeros((len(rows), k)); y = np.zeros(len(rows)); grp = []
    for i, r in enumerate(rows):
        X[i, di[r['drv']]] = 1.0
        if r['compound'] != rif: X[i, delta_idx[r['compound']]] = 1.0
        for j, v in enumerate(basi_giro(forma, r['lap'], tutti_lap)): X[i, nd+(nc-1)+j] = v
        X[i, gamma_idx[r['compound']]] = r['life']
        y[i] = r['time'] - FUEL_SKG*FUEL_KG*(1 - (r['lap']-1)/N)
        grp.append((r['drv'], int(r['stint'])))
    return X, y, grp, gamma_idx, drvs, di

def stima(X, y, grp, gamma_idx):
    if np.linalg.matrix_rank(X) < X.shape[1]: return None
    b, *_ = np.linalg.lstsq(X, y, rcond=None)
    u = y - X@b; n, k = X.shape
    XtX_inv = np.linalg.inv(X.T@X)
    per_g = {}
    for i, g in enumerate(grp): per_g.setdefault(g, []).append(i)
    G = len(per_g); meat = np.zeros((k, k))
    for idx in per_g.values():
        s = X[idx].T @ u[idx]; meat += np.outer(s, s)
    V = XtX_inv@meat@XtX_inv * (G/(G-1))*((n-1)/(n-k))
    se = np.sqrt(np.diag(V))
    rss = float(u@u)
    bic = n*np.log(rss/n) + k*np.log(n)
    out = {c: dict(gamma=float(b[j]), lo=float(b[j]-1.96*se[j]), hi=float(b[j]+1.96*se[j]))
           for c, j in gamma_idx.items()}
    return dict(gamme=out, bic=float(bic), b=b, per_g=per_g)

def rmse_loso(X, y, grp, di_col_max):
    """leave-one-stint-out; il pilota deve restare nel train (altrimenti riga esclusa)."""
    per_g = {}
    for i, g in enumerate(grp): per_g.setdefault(g, []).append(i)
    err = []
    for g, idx in per_g.items():
        mask = np.ones(len(y), bool); mask[idx] = False
        Xtr, ytr = X[mask], y[mask]
        # righe di test valide: la colonna-pilota deve avere supporto nel train
        ok = [i for i in idx if Xtr[:, np.argmax(X[i, :di_col_max])].sum() > 0]
        if not ok: continue
        if np.linalg.matrix_rank(Xtr) < Xtr.shape[1]: continue
        b, *_ = np.linalg.lstsq(Xtr, ytr, rcond=None)
        err.extend((y[i] - X[i]@b)**2 for i in ok)
    return float(np.sqrt(np.mean(err))) if err else None

if __name__ == '__main__':
    FORME = ('lin', 'linlog', 'spline')
    ris = {}          # gara -> forma -> {gamme, bic, rmse}
    for nome, path in RACES.items():
        rows0 = carica(path); keep, _, N = pulisci(rows0)
        keep, _ = filtro_outlier(keep, SOGLIA_OUTLIER)
        rows, ident, _, _ = prepara(keep)
        ris[nome] = {}
        for f in FORME:
            X, y, grp, gidx, drvs, di = costruisci(rows, ident, N, f)
            s = stima(X, y, grp, gidx)
            if s is None: ris[nome][f] = None; continue
            s['rmse'] = rmse_loso(X, y, grp, len(drvs))
            ris[nome][f] = s

    print("=== CONFRONTO FORME f(giro): BIC (primario) e RMSE leave-one-stint-out (secondario) ===")
    print(f"{'gara':10s} {'BIC lin':>10s} {'BIC linlog':>11s} {'BIC spline':>11s} | {'RMSE lin':>9s} {'linlog':>7s} {'spline':>7s}")
    vittorie = {f: 0 for f in FORME[1:]}
    for nome in RACES:
        r = ris[nome]
        bl, bg, bs = (r[f]['bic'] if r[f] else float('nan') for f in FORME)
        rl, rg, rs = (r[f]['rmse'] if r[f] else float('nan') for f in FORME)
        for f, b in (('linlog', bg), ('spline', bs)):
            if b < bl: vittorie[f] += 1
        print(f"{nome:10s} {bl:>10.1f} {bg:>11.1f} {bs:>11.1f} | {rl:>9.3f} {rg:>7.3f} {rs:>7.3f}")
    print(f"\nBIC migliore del lineare: linlog in {vittorie['linlog']}/8 gare, spline in {vittorie['spline']}/8 gare")
    adottata = None
    if max(vittorie.values()) >= 5:
        adottata = 'linlog' if vittorie['linlog'] >= vittorie['spline'] else 'spline'
    print(f"FORMA ADOTTATA (criterio dichiarato, >=5/8): {adottata or 'LINEARE (nessuna alternativa qualificata)'}")

    if adottata:
        print(f"\n=== GAMMA lineare vs {adottata}: fuori dal proprio IC95 originale? ===")
        fuori = []
        larghezze = []
        for nome in RACES:
            rl, rn = ris[nome]['lin'], ris[nome][adottata]
            if not rl or not rn: continue
            for c in SLICK:
                if c not in rl['gamme']: continue
                a, b = rl['gamme'][c], rn['gamme'][c]
                out = not (a['lo'] <= b['gamma'] <= a['hi'])
                if out and nome != 'Australia': fuori.append((nome, c))
                larghezze.append(((b['hi']-b['lo'])/(a['hi']-a['lo'])) if a['hi'] > a['lo'] else 1.0)
                sig_l = '*' if (a['lo'] > 0 or a['hi'] < 0) else ' '
                sig_n = '*' if (b['lo'] > 0 or b['hi'] < 0) else ' '
                print(f"{nome:10s} {c:6s}: lin {a['gamma']:+.4f} [{a['lo']:+.4f},{a['hi']:+.4f}]{sig_l} -> "
                      f"{adottata} {b['gamma']:+.4f} [{b['lo']:+.4f},{b['hi']:+.4f}]{sig_n}"
                      f"{'   <-- FUORI IC ORIGINALE' if out else ''}")
        print(f"\nrapporto mediano larghezza IC ({adottata}/lin): {st.median(larghezze):.2f} "
              f"(guardia: <=1.50)")
        au = ris['Australia'][adottata]['gamme'].get('MEDIUM')
        chiusa = au and (au['gamma'] >= 0.02 or au['hi'] >= 0.047)
        print(f"\nAustralia-MEDIUM ({adottata}): gamma {au['gamma']:+.4f} [{au['lo']:+.4f},{au['hi']:+.4f}] "
              f"-> anomalia {'CHIUSA' if chiusa else 'NON CHIUSA'} (criterio: gamma>=+0.02 o hi>=+0.047)")
        print(f"\nVERDETTO: {'LOCALE' if not fuori else 'GLOBALE'}"
              + (f" — gamma fuori IC nelle altre gare: {fuori}" if fuori else
                 " — nessun gamma delle altre 7 gare esce dal proprio IC95 originale"))
