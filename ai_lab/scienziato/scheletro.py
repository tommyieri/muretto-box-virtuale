"""ai_lab/scienziato/scheletro.py — LO SCHELETRO DELL'AGENTE-SCIENZIATO.

Deterministico: nessun LLM, nessuna introspezione, nessuna autovalutazione.

Tre capacita', per un MATTONE qualunque. L'ossatura non cambia quando cambia il
fenomeno: cambia solo l'oggetto Fenomeno che le viene dato in pasto. E' questo il
valore che sopravvive ai cambi di regolamento — non il coefficiente di quest'anno.

    B1  cosa_so_fare        ricostruisce la grandezza dal FONDO, per regime, con
                            intervallo su BLOCCHI indipendenti + null di permutazione
    B2  confronto           confronta col mattone che il progetto gia' ha: UGUALE o
                            DIVERSO. Se DIVERSO -> si ferma e porta al tavolo umano.
                            Questo modulo non decide: propone. Nessun exit-code uccide.
    B3  cosa_mi_manca       dove la ricostruzione e' debole, e cosa servirebbe per
                            stringerla. Dichiara il fronte aperto, non monta nulla.

CONTRATTO DEL FENOMENO (chi vuole usare lo scheletro su un altro mattone implementa
questo, e nient'altro):

    nome            str
    grandezza       str — che cosa e' identificabile, in parole
    unita           str
    blocchi()       -> [ {id, regime, ...} ]   blocchi INDIPENDENTI (gare), mai osservazioni
    stima(blocco, **varianti)   -> {'valore': float, ...diagnostica} | {'escluso': motivo}
    valore_kernel(blocco)       -> float   che cosa afferma il mattone esistente
    null(blocco, n)             -> [float] valori sotto il null di permutazione dichiarato
    varianti_robustezza()       -> {nome: dict di parametri}
"""
import math
import random
import statistics as st

import numpy as np


# ---------------------------------------------------------------- attrezzi statistici
def ols_cluster(X, y, gruppi):
    """OLS con errori standard cluster-robust (correzione small-sample), niente pinv
    silenziosa: se il rango non e' pieno ritorna None e il chiamante dichiara la gara
    non identificabile."""
    n, k = X.shape
    if n <= k or np.linalg.matrix_rank(X) < k:
        return None
    XtX = X.T @ X
    try:
        XtX_inv = np.linalg.inv(XtX)
    except np.linalg.LinAlgError:
        return None
    b = XtX_inv @ (X.T @ y)
    u = y - X @ b
    idx = {}
    for i, g in enumerate(gruppi):
        idx.setdefault(g, []).append(i)
    G = len(idx)
    meat = np.zeros((k, k))
    for righe in idx.values():
        Xg, ug = X[righe], u[righe]
        s = Xg.T @ ug
        meat += np.outer(s, s)
    c = (G / max(G - 1, 1)) * ((n - 1) / max(n - k, 1))
    V = XtX_inv @ meat @ XtX_inv * c
    return {'beta': b, 'se': np.sqrt(np.clip(np.diag(V), 0, None)), 'n': n, 'k': k,
            'n_cluster': G, 'sigma': float(np.sqrt(u @ u / max(n - k, 1)))}


def bootstrap_a_blocchi(valori, repliche=5000, seed=20260721, q=(2.5, 97.5)):
    """Ricampiona i BLOCCHI (non le osservazioni) con reimmissione. La statistica
    aggregata e' la MEDIANA cross-blocco: robusta a una gara storta."""
    if len(valori) < 2:
        return {'mediana': valori[0] if valori else None, 'ci95': None, 'n_blocchi': len(valori)}
    rng = random.Random(seed)
    med = []
    for _ in range(repliche):
        camp = [valori[rng.randrange(len(valori))] for _ in valori]
        med.append(st.median(camp))
    med.sort()
    lo = med[int(q[0] / 100 * len(med))]
    hi = med[min(len(med) - 1, int(q[1] / 100 * len(med)))]
    return {'mediana': round(st.median(valori), 4), 'media': round(st.mean(valori), 4),
            'ci95': [round(lo, 4), round(hi, 4)], 'n_blocchi': len(valori),
            'repliche': repliche, 'seed': seed}


# ---------------------------------------------------------------- B1
def cosa_so_fare(fen, n_perm=200, verbose=True):
    """Ricostruisce la grandezza dal fondo. Per regime, mai a cavallo del confine."""
    per_blocco, esclusi = [], []
    for b in fen.blocchi():
        s = fen.stima(b)
        if s is None or 'escluso' in (s or {}):
            esclusi.append({'blocco': b['id'], 'regime': b['regime'],
                            'motivo': (s or {}).get('escluso', 'stima impossibile')})
            continue
        s['blocco'], s['regime'] = b['id'], b['regime']
        s['kernel'] = fen.valore_kernel(b)
        per_blocco.append(s)
        if verbose:
            print(f"    {b['id']:34s} {s['valore']:+8.3f}  "
                  f"(kernel {s['kernel']:+.3f})  n={s['n_giri']:5d}  "
                  f"corr(giro,eta)={s.get('corr_giro_eta', float('nan')):+.2f}")

    regimi = {}
    for r in sorted({x['regime'] for x in per_blocco}):
        v = [x['valore'] for x in per_blocco if x['regime'] == r]
        k = [x['kernel'] for x in per_blocco if x['regime'] == r]
        agg = bootstrap_a_blocchi(v)
        agg['kernel_mediano'] = round(st.median(k), 4)
        regimi[r] = agg

    nulla = {}
    if n_perm:
        ammessi = {x['blocco'] for x in per_blocco}
        for r in regimi:
            # una colonna per gara: la replica j di ogni gara si aggrega con la replica j
            # delle altre. Il null va costruito sulla STESSA statistica dell'osservato
            # (la mediana cross-gara), non sui valori di singola gara.
            colonne = [fen.null(b, n_perm) for b in fen.blocchi()
                       if b['regime'] == r and b['id'] in ammessi]
            colonne = [c for c in colonne if len(c) == n_perm]
            if not colonne:
                continue
            per_gara = [v for c in colonne for v in c]
            aggregato = [st.median([c[j] for c in colonne]) for j in range(n_perm)]
            oss = abs(regimi[r]['mediana'])
            nulla[r] = {
                'n_permutazioni': n_perm, 'n_gare': len(colonne),
                'mediana_null_aggregato': round(st.median(aggregato), 4),
                'q95_|null_aggregato|': round(
                    sorted(abs(v) for v in aggregato)[int(.95 * len(aggregato))], 4),
                'p': round((1 + sum(1 for v in aggregato if abs(v) >= oss)) / (n_perm + 1), 5),
                'q95_|null_singola_gara|': round(
                    sorted(abs(v) for v in per_gara)[int(.95 * len(per_gara))], 4)}
    return {'grandezza': fen.grandezza, 'unita': fen.unita, 'per_blocco': per_blocco,
            'esclusi': esclusi, 'regimi': regimi, 'null': nulla,
            'confronto_regimi': confronto_regimi(per_blocco)}


def confronto_regimi(per_blocco, repliche=5000, seed=20260721):
    """Un coefficiente unico a cavallo di una rottura regolamentare e' sospetto per
    default: qui la differenza fra regimi si MISURA, con bootstrap sui blocchi di
    entrambi i lati. Se l'IC95 della differenza contiene 0, i dati non distinguono i
    due regimi (non e' una prova che siano uguali: puo' essere solo poca potenza)."""
    reg = sorted({x['regime'] for x in per_blocco})
    if len(reg) != 2:
        return None
    a = [x['valore'] for x in per_blocco if x['regime'] == reg[0]]
    b = [x['valore'] for x in per_blocco if x['regime'] == reg[1]]
    if len(a) < 2 or len(b) < 2:
        return None
    rng = random.Random(seed)
    d = []
    for _ in range(repliche):
        ca = [a[rng.randrange(len(a))] for _ in a]
        cb = [b[rng.randrange(len(b))] for _ in b]
        d.append(st.median(ca) - st.median(cb))
    d.sort()
    lo, hi = d[int(.025 * len(d))], d[int(.975 * len(d))]
    return {'regimi': reg, 'differenza': round(st.median(a) - st.median(b), 4),
            'ci95': [round(lo, 4), round(hi, 4)],
            'distinguibili': not (lo <= 0 <= hi),
            'n_blocchi': [len(a), len(b)]}


def dispersione(per_blocco, regime):
    """Quanto e' costante la grandezza FRA circuiti? Il kernel ne assume uno solo."""
    v = sorted(x['valore'] for x in per_blocco if x['regime'] == regime)
    if len(v) < 4:
        return None
    q = lambda p: v[min(len(v) - 1, int(p * len(v)))]
    return {'n': len(v), 'min': v[0], 'q25': q(.25), 'mediana': round(st.median(v), 4),
            'q75': q(.75), 'max': v[-1], 'iqr': round(q(.75) - q(.25), 4),
            'sd': round(st.stdev(v), 4)}


def fuori_campione(ric, fen):
    """Replica out-of-sample: la stima non vede mai le gare su cui e' misurata.
    Regola dichiarata: gare ordinate per data, indici pari = calibrazione, dispari =
    verifica."""
    out = {}
    for r in ric['regimi']:
        b = sorted([x for x in ric['per_blocco'] if x['regime'] == r],
                   key=lambda x: (x.get('data', ''), x['blocco']))
        cal, ver = b[0::2], b[1::2]
        if len(cal) < 2 or len(ver) < 2:
            out[r] = {'possibile': False, 'motivo': f'{len(cal)}/{len(ver)} gare: troppo poche'}
            continue
        prev = st.median([x['valore'] for x in cal])
        e_ric = st.median([abs(x['valore'] - prev) for x in ver])
        e_ker = st.median([abs(x['valore'] - x['kernel']) for x in ver])
        out[r] = {'possibile': True, 'n_calibrazione': len(cal), 'n_verifica': len(ver),
                  'previsione_ricostruita': round(prev, 4),
                  'errore_mediano_ricostruita': round(e_ric, 4),
                  'errore_mediano_kernel': round(e_ker, 4),
                  'vince': 'ricostruita' if e_ric < e_ker else 'kernel',
                  'gare_calibrazione': [x['blocco'] for x in cal],
                  'gare_verifica': [x['blocco'] for x in ver]}
    return out


# ---------------------------------------------------------------- B2
def confronto(ric):
    """IL CANCELLO. UGUALE = il valore del kernel cade dentro l'IC95 sui blocchi.
    DIVERSO = fuori. Regola scritta nel prereg PRIMA dei numeri.

    Questa funzione NON decide niente da sola: prepara la proposta per il tavolo umano.
    Nessun exit-code, nessuna sentenza."""
    esiti = {}
    for r, a in ric['regimi'].items():
        ker = a['kernel_mediano']
        ci = a['ci95']
        dentro = ci is not None and ci[0] <= ker <= ci[1]
        div = [x for x in ric['per_blocco'] if x['regime'] == r
               and not (x['valore_ci95'][0] <= x['kernel'] <= x['valore_ci95'][1])]
        esiti[r] = {'esito': 'UGUALE' if dentro else 'DIVERSO', 'kernel': ker,
                    'ricostruito': a['mediana'], 'ci95': ci,
                    'scarto': None if ci is None else round(a['mediana'] - ker, 4),
                    'n_blocchi': a['n_blocchi'],
                    'blocchi_divergenti': [{'blocco': x['blocco'], 'ricostruito': x['valore'],
                                            'ci95': x['valore_ci95'], 'kernel': x['kernel']}
                                           for x in sorted(div, key=lambda x: x['valore'])]}
    globale = 'UGUALE' if all(e['esito'] == 'UGUALE' for e in esiti.values()) else 'DIVERSO'
    return {'per_regime': esiti, 'esito': globale,
            'autorita': 'proposta — la decisione e\' del tavolo umano (Tommi + Claude)',
            'se_diverso': 'FERMO: non si monta nulla, non si sostituisce il numero'}


# ---------------------------------------------------------------- B3
def cosa_mi_manca(ric, robustezze, oos):
    """Mappa dei fronti deboli. Non monta nulla: dichiara dove il segnale e' sporco,
    dove l'intervallo e' largo, e cosa servirebbe per stringerlo."""
    fronti = []
    for r, a in ric['regimi'].items():
        b = [x for x in ric['per_blocco'] if x['regime'] == r]
        if a['ci95']:
            larghezza = a['ci95'][1] - a['ci95'][0]
            fronti.append({'fronte': f'ampiezza IC95 regime {r}',
                           'misura': round(larghezza, 3),
                           'relativa': round(larghezza / abs(a['mediana']), 3) if a['mediana'] else None,
                           'n_blocchi': a['n_blocchi']})
        peggiori = sorted(b, key=lambda x: -(x['valore_ci95'][1] - x['valore_ci95'][0]))[:5]
        fronti.append({'fronte': f'gare con intervallo piu largo, regime {r}',
                       'gare': [{'blocco': x['blocco'],
                                 'ampiezza_ci95': round(x['valore_ci95'][1] - x['valore_ci95'][0], 3),
                                 'corr_giro_eta': x.get('corr_giro_eta'),
                                 'n_giri': x['n_giri']} for x in peggiori]})
        disp = dispersione(ric['per_blocco'], r)
        if disp:
            fronti.append({'fronte': f'dispersione FRA circuiti, regime {r} '
                                     '(il kernel assume un valore unico)', **disp})
        deb = [x for x in b if abs(x.get('corr_giro_eta') or 0) > 0.75]
        fronti.append({'fronte': f'desincronizzazione debole (|corr|>0.75), regime {r}',
                       'n_gare': len(deb), 'gare': [x['blocco'] for x in deb]})
    return {'fronti': fronti, 'esclusi': ric['esclusi'], 'robustezze': robustezze,
            'fuori_campione': oos}


# ---------------------------------------------------------------- utilita'
def corr(x, y):
    if len(x) < 3 or st.pstdev(x) == 0 or st.pstdev(y) == 0:
        return float('nan')
    mx, my = st.mean(x), st.mean(y)
    num = sum((a - mx) * (b - my) for a, b in zip(x, y))
    den = math.sqrt(sum((a - mx) ** 2 for a in x) * sum((b - my) ** 2 for b in y))
    return num / den if den else float('nan')
