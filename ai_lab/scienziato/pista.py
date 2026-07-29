"""ai_lab/scienziato/pista.py — l'INTENSITA' del traffico, governata dalla pista.

    r = theta_pista * a*e^(-gap/lam) + b_pista + c*max(0, -delta)

theta e' identificato dalla FORMA (quanto il residuo sale mentre il gap si stringe), non
dal LIVELLO: l'intercetta b_pista assorbe la distorsione del modello di passo su quella
pista. E' la difesa contro l'artefatto gemello di quello della notte scorsa.

ATTENZIONE — NULL NUOVO: `permuta_piste` e' una funzione di ricampionamento NUOVA. I
sigilli sono sette; questa NON e' stata sigillata dall'agente (serve --attore): VA PORTATA
SOTTO SIGILLO DAL TAVOLO.
"""
import random
import statistics as st

import numpy as np

# nomi TI -> nome breve del circuito (la pista, non il gran premio)
ALIAS = {'Australia': 'Australian', 'Austria': 'Austrian', 'Canada': 'Canadian',
         'Cina': 'Chinese', 'Giappone': 'Japanese', 'Spagna': 'Spanish'}


def pista_di(gara_id):
    nome = gara_id.split(' ', 1)[1]
    return ALIAS.get(nome, nome)


def base(inc, glob):
    """La colonna della penalita' aerodinamica globale, a*e^(-gap/lam)."""
    g = np.array([x['gap'] for x in inc])
    return glob['a'] * np.exp(-g / glob['lam'])


def resto(inc, glob):
    """La risposta ripulita del termine delta-passo (globale, non di pista)."""
    h = np.maximum(0.0, -np.array([x['delta'] for x in inc]))
    y = np.array([x['r'] for x in inc])
    return y - glob.get('c', 0.0) * h


def stima_theta(inc, glob, min_inc=120):
    """theta e b per una pista: regressione di (r - c*h) su [base, 1].
    min_inc dichiarato: sotto, la pista e' 'dato insufficiente'."""
    if len(inc) < min_inc:
        return None
    X = np.column_stack([base(inc, glob), np.ones(len(inc))])
    y = resto(inc, glob)
    if np.linalg.matrix_rank(X) < 2:
        return None
    b, *_ = np.linalg.lstsq(X, y, rcond=None)
    res = y - X @ b
    n, k = len(y), 2
    try:
        v = float(np.linalg.inv(X.T @ X)[0, 0]) * float(res @ res) / max(n - k, 1)
    except np.linalg.LinAlgError:
        return None
    return {'theta': float(b[0]), 'b': float(b[1]), 'se_theta': float(np.sqrt(max(v, 0))),
            'n': n}


def theta_per_pista(per_gara, glob, min_inc=120):
    """{pista: {theta, b, se, n, n_gare}} — il blocco e' la PISTA."""
    per_p = {}
    for gid, inc in per_gara.items():
        per_p.setdefault(pista_di(gid), []).extend(inc)
    ngare = {}
    for gid in per_gara:
        ngare[pista_di(gid)] = ngare.get(pista_di(gid), 0) + 1
    fuori = {}
    for p, inc in per_p.items():
        s = stima_theta(inc, glob, min_inc)
        if s:
            s['n_gare'] = ngare[p]
            fuori[p] = s
    return fuori


def prevedi(inc, glob, theta=None, con_delta=True):
    """Predizione per giro. theta=None -> modello globale (nessuna pista)."""
    b0 = base(inc, glob)
    h = np.maximum(0.0, -np.array([x['delta'] for x in inc]))
    p = np.zeros(len(inc))
    if theta is None:
        p = b0.copy()
    else:
        for i, x in enumerate(inc):
            t = theta.get(pista_di(x['gara']))
            if t is None:
                p[i] = b0[i]
            else:
                p[i] = t['theta'] * b0[i] + t['b']
    if con_delta:
        p = p + glob.get('c', 0.0) * h
    return p


# ---------------------------------------------------------------- NULL NUOVO
def permuta_piste(per_gara, glob, ripetizioni=400, seed=20260721, min_inc=120):
    """NULL NUOVO — DA PORTARE SOTTO SIGILLO DAL TAVOLO.

    Permuta le ETICHETTE-PISTA fra le gare e ricalcola la dispersione dei theta. Se la
    dispersione vera sta dentro questa distribuzione, la difficolta'-pista e' rumore.
    """
    gids = sorted(per_gara)
    piste = [pista_di(g) for g in gids]
    rng = random.Random(seed)
    fuori = []
    for _ in range(ripetizioni):
        et = piste[:]
        rng.shuffle(et)
        finto = {}
        for g, p in zip(gids, et):
            finto.setdefault(p, []).extend(per_gara[g])
        th = []
        for p, inc in finto.items():
            s = stima_theta(inc, glob, min_inc)
            if s:
                th.append(s['theta'])
        if len(th) >= 5:
            fuori.append(st.pstdev(th))
    return fuori


# ---------------------------------------------------------------- stabilita'
def theta_per_stagione(per_gara, glob, min_inc=120):
    """theta per (pista, stagione): la trappola che ha ucciso l'indice v1."""
    per = {}
    for gid, inc in per_gara.items():
        anno = gid.split(' ', 1)[0]
        per.setdefault((pista_di(gid), anno), []).extend(inc)
    fuori = {}
    for (p, a), inc in per.items():
        s = stima_theta(inc, glob, min_inc)
        if s:
            fuori.setdefault(p, {})[a] = s
    return fuori
