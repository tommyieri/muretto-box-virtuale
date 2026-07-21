"""ai_lab/scienziato/traffico.py — il primo ingresso del traffico: il DELTA-PASSO.

Tutto dichiarato in PREREG_traffico_deltapasso.md prima di misurare.

IL PUNTO: il modello attuale tratta il traffico come pura geometria (gap piccolo = tempo
perso). Confonde "non riesco a passare" con "sto per passare". Il delta-passo distingue.

ATTENZIONE — NULL NUOVO (§3 del prereg): `placebo_leader` e' una funzione di
ricampionamento NUOVA, non una modifica di quelle sigillate in sigillo_null.py. Non e'
stata sigillata dall'agente (il sigillo richiede --attore): VA PORTATA SOTTO SIGILLO DAL
TAVOLO.
"""
import math
import random
import statistics as st

import numpy as np

import degrado as DG
import fondo

GAP_MAX = 5.0          # oltre, si e' in aria libera (soglia gia' usata dal piano di sotto)


# ---------------------------------------------------------------- accoppiamento
def davanti(righe):
    """Chi ha chi davanti, giro per giro. Fra le auto che hanno completato lo STESSO giro,
    l'ordine per sesT e' l'ordine in pista. Ritorna {(drv, lap): (gap, drv_davanti)}.
    Limite dichiarato: i doppiati stanno su un altro indice di giro e non entrano."""
    per_giro = {}
    for r in righe:
        if isinstance(r['lap'], (int, float)) and isinstance(r.get('sesT'), (int, float)):
            per_giro.setdefault(int(r['lap']), []).append((float(r['sesT']), r['drv']))
    fuori = {}
    for L, v in per_giro.items():
        v.sort()
        for i, (t, d) in enumerate(v):
            fuori[(d, L)] = (None, None) if i == 0 else (t - v[i - 1][0], v[i - 1][1])
    return fuori


def stato_gomma(righe):
    """(stint, eta, compound) per (drv, lap), dai soli pit reali."""
    eta = fondo.stint_ed_eta(righe)
    comp = {}
    for r in righe:
        if isinstance(r['lap'], (int, float)) and isinstance(r.get('compound'), str):
            comp[(r['drv'], int(r['lap']))] = r['compound']
    return eta, comp


def incontri(dati, mod, neutralizzati=None, finestra=0):
    """Gli 'incontri': un giro verde, non in/out, con qualcuno davanti entro GAP_MAX.

    Per ognuno: gap, delta-passo DINAMICO (le due previsioni allo stesso giro, ciascuna
    con la propria mescola ed eta), e il residuo r = osservato - passo pulito.
    Il carburante e l'evoluzione pista si elidono nella differenza: sono lo stesso termine
    allo stesso giro.
    """
    dv = davanti(dati['righe'])
    eta, comp = stato_gomma(dati['righe'])
    neut = neutralizzati or set()
    fuori = []
    for r in dati['righe']:
        if not isinstance(r['lap'], (int, float)) or not isinstance(r['time'], (int, float)):
            continue
        L, d = int(r['lap']), r['drv']
        if str(r['status']) != '1' or not (fondo.nullo(r['pin']) and fondo.nullo(r['pout'])):
            continue
        if L < 2 or (d, L) not in dv:
            continue
        # finestra di recupero dopo l'ultima neutralizzazione
        if neut:
            ultima = max((x for x in neut if x < L), default=None)
            if ultima is not None and L - ultima <= finestra:
                continue
            if L in neut:
                continue
        gap, lead = dv[(d, L)]
        if gap is None or gap > GAP_MAX:
            continue
        a_d = eta.get((d, L), (None, None))[1]
        a_l = eta.get((lead, L), (None, None))[1]
        c_d, c_l = comp.get((d, L)), comp.get((lead, L))
        if None in (a_d, a_l, c_d, c_l):
            continue
        p_d = DG.previsione(mod, dati, d, L, c_d, a_d)
        p_l = DG.previsione(mod, dati, lead, L, c_l, a_l)
        if p_d is None or p_l is None:
            continue
        fuori.append({'gara': dati['blocco']['id'], 'drv': d, 'lap': L, 'lead': lead,
                      'gap': gap, 'delta': p_d - p_l, 'r': r['time'] - p_d,
                      'post_restart': bool(neut and any(x < L for x in neut)),
                      'eta': a_d, 'compound': c_d})
    return fuori


def giri_neutralizzati(righe):
    """Giri in cui QUALCUNO e' sotto SC/VSC (decodifica committata: '4' o '6')."""
    return {int(r['lap']) for r in righe
            if isinstance(r['lap'], (int, float))
            and (('4' in str(r['status'])) or ('6' in str(r['status'])))}


# ---------------------------------------------------------------- le forme
def _fit_lin(X, y):
    b, *_ = np.linalg.lstsq(X, y, rcond=None)
    return b


def fit_M0(inc, lam_grid=None):
    """r = a*exp(-gap/lambda). Griglia su lambda, minimi quadrati su a."""
    g = np.array([x['gap'] for x in inc])
    y = np.array([x['r'] for x in inc])
    best = None
    for lam in (lam_grid or [0.3, 0.5, 0.8, 1.0, 1.5, 2.0, 3.0]):
        X = np.exp(-g / lam)[:, None]
        b = _fit_lin(X, y)
        sse = float(((y - X @ b) ** 2).sum())
        if best is None or sse < best[0]:
            best = (sse, {'forma': 'M0', 'a': float(b[0]), 'lam': lam})
    return best[1]


def fit_M1(inc, lam_grid=None):
    """r = a*exp(-gap/lambda) + c*max(0, -delta)."""
    g = np.array([x['gap'] for x in inc])
    y = np.array([x['r'] for x in inc])
    h = np.maximum(0.0, -np.array([x['delta'] for x in inc]))
    best = None
    for lam in (lam_grid or [0.3, 0.5, 0.8, 1.0, 1.5, 2.0, 3.0]):
        X = np.column_stack([np.exp(-g / lam), h])
        b = _fit_lin(X, y)
        sse = float(((y - X @ b) ** 2).sum())
        if best is None or sse < best[0]:
            best = (sse, {'forma': 'M1', 'a': float(b[0]), 'c': float(b[1]), 'lam': lam})
    return best[1]


def fit_M2(inc, lam_grid=None, c_grid=None):
    """r = max(a*exp(-gap/lambda), c*max(0,-delta)). Griglia su lambda e c, minimi
    quadrati impossibili in forma chiusa: ricerca su griglia dichiarata."""
    g = np.array([x['gap'] for x in inc])
    y = np.array([x['r'] for x in inc])
    h = np.maximum(0.0, -np.array([x['delta'] for x in inc]))
    best = None
    for lam in (lam_grid or [0.3, 0.5, 0.8, 1.0, 1.5, 2.0, 3.0]):
        e = np.exp(-g / lam)
        for c in (c_grid or [0.0, 0.25, 0.5, 0.75, 1.0]):
            # a ottimo per griglia grossolana
            for a in np.arange(0.0, 2.01, 0.1):
                p = np.maximum(a * e, c * h)
                sse = float(((y - p) ** 2).sum())
                if best is None or sse < best[0]:
                    best = (sse, {'forma': 'M2', 'a': float(a), 'c': float(c), 'lam': lam})
    return best[1]


def prevedi(mod, inc):
    g = np.array([x['gap'] for x in inc])
    h = np.maximum(0.0, -np.array([x['delta'] for x in inc]))
    e = np.exp(-g / mod['lam'])
    if mod['forma'] == 'M0':
        return mod['a'] * e
    if mod['forma'] == 'M1':
        return mod['a'] * e + mod['c'] * h
    return np.maximum(mod['a'] * e, mod['c'] * h)


# ---------------------------------------------------------------- NULL NUOVO (§3)
def placebo_leader(inc, dati, mod_pace, seed=20260721):
    """NULL NUOVO — DA PORTARE SOTTO SIGILLO DAL TAVOLO.

    Sostituisce l'auto davanti con un'altra auto A CASO dello stesso giro, tenendo fermo
    il passo del pilota che segue. Se l'effetto del delta-passo sopravvive a questo,
    l'effetto e' errore di misura del passo di chi segue, non fisica del traffico.
    """
    eta, comp = stato_gomma(dati['righe'])
    per_giro = {}
    for r in dati['righe']:
        if isinstance(r['lap'], (int, float)):
            per_giro.setdefault(int(r['lap']), set()).add(r['drv'])
    rng = random.Random(seed)
    fuori = []
    for x in inc:
        cand = [c for c in per_giro.get(x['lap'], ()) if c not in (x['drv'], x['lead'])]
        if not cand:
            continue
        finto = cand[rng.randrange(len(cand))]
        a_l = eta.get((finto, x['lap']), (None, None))[1]
        c_l = comp.get((finto, x['lap']))
        if a_l is None or c_l is None:
            continue
        p_l = DG.previsione(mod_pace, dati, finto, x['lap'], c_l, a_l)
        if p_l is None:
            continue
        p_d = DG.previsione(mod_pace, dati, x['drv'], x['lap'], x['compound'], x['eta'])
        if p_d is None:
            continue
        y = dict(x)
        y['delta'] = p_d - p_l      # stesso passo di chi segue, leader FINTO
        y['lead'] = finto
        fuori.append(y)
    return fuori


# ---------------------------------------------------------------- esempio-guida
def durata_incontri(inc, soglia_gap=1.5):
    """Quanti giri consecutivi un pilota resta dietro LO STESSO leader entro soglia_gap.
    Serve al test dell'esempio-guida: chi ha un grande vantaggio di passo passa in fretta?"""
    per = {}
    for x in inc:
        if x['gap'] is not None and x['gap'] <= soglia_gap:
            per.setdefault((x['gara'], x['drv'], x['lead']), []).append((x['lap'], x['delta']))
    fuori = []
    for (gara, d, lead), v in per.items():
        v.sort()
        run, inizio = 1, 0
        for i in range(1, len(v) + 1):
            if i < len(v) and v[i][0] == v[i - 1][0] + 1:
                run += 1
                continue
            blocco = v[inizio:i]
            fuori.append({'gara': gara, 'drv': d, 'lead': lead, 'giri': len(blocco),
                          'delta': st.median([b[1] for b in blocco])})
            inizio, run = i, 1
    return fuori
