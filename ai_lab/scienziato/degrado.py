"""ai_lab/scienziato/degrado.py — il DEGRADO, sopra il carburante fermo.

Tutto dichiarato in PREREG_degrado.md prima dei numeri. Il permutation-null e' sotto
sigillo: qui si CHIAMA (metro2.soglia_da_nulla), non si tocca.

MODELLO (§3)
    t - carburante_congelato(L) = alpha_pilota + delta_mescola + beta*(giro - medio)
                                  + somma_c rho_c * eta * 1[mescola=c] + eps
    rho_c = degrado: secondi persi al giro per giro di vita gomma.
    beta assorbe evoluzione pista E residuo di carburante -> rho e' poco sensibile alla
    scelta del carburante congelato (verificato e riportato).

CONTROFATTUALE (§1)
    Il costo di una strategia dipende SOLO dalle lunghezze degli stint e dalle mescole:
    alpha, beta e carburante sono identici per ogni strategia sugli stessi giri. Quindi
        costo(mescola c, stint lungo n) = delta_c * n + rho_c * n(n+1)/2
    e la ricerca dell'ottimo e' esatta, non euristica.
"""
import statistics as st

import numpy as np

import carburante_fermo as CF
import fondo
import scheletro

SLICK = fondo.SLICK
GAP_STIMA = 5.0           # §2: il modello si stima solo oltre questo gap (ultra-conservativo)
MIN_STINT = 8             # giri minimi di uno stint nella ricerca strategica
MIN_GIRI = 150
MIN_COMPOUND_STINT, MIN_COMPOUND_GIRI = 3, 30


def neutralizzata(righe):
    """Un solo giro sotto SC/VSC (decodifica committata: '4' o '6') e la gara e' fuori dal
    controfattuale: contiene secondi che nessun degrado puo' spiegare."""
    return any(('4' in str(r['status'])) or ('6' in str(r['status'])) for r in righe)


# ---------------------------------------------------------------- dati della gara
def prepara(blocco, gap_min=GAP_STIMA):
    """Giri puliti col carburante CONGELATO gia' sottratto. Nessuna stima nuova di fuel."""
    righe = fondo.carica(blocco['percorso'])
    if fondo.bagnato(righe):
        return None
    circuito = blocco['id'].split(' ', 1)[1]
    D, fonte_fuel = CF.delta(circuito, blocco['regime'])
    keep, scarti, N = fondo.pulisci(righe, soglia_aria=0.0)     # il gap lo filtro qui sotto
    gap = fondo.gap_davanti(righe)
    for r in keep:
        r['gap'] = gap.get((r['drv'], r['lap']))
        r['tfc'] = CF.sottrai(r['time'], r['lap'], N, D)
    stima = [r for r in keep
             if r['gap'] is None or r['gap'] > gap_min]
    return {'blocco': blocco, 'righe': righe, 'puliti': keep, 'stima': stima, 'N': N,
            'delta_fuel': D, 'fonte_fuel': fonte_fuel, 'circuito': circuito,
            'scarti': scarti, 'gap': gap, 'neutralizzata': neutralizzata(righe)}


def _compound_ok(righe):
    stint, giri = {}, {}
    for r in righe:
        stint.setdefault(r['compound'], set()).add((r['drv'], r['stint']))
        giri[r['compound']] = giri.get(r['compound'], 0) + 1
    return {c for c in giri if len(stint[c]) >= MIN_COMPOUND_STINT
            and giri[c] >= MIN_COMPOUND_GIRI}


# ---------------------------------------------------------------- C1: il modello
def stima(dati, eta_quadratica=False, beta_per_pilota=False):
    """Ritorna rho per mescola, delta, alpha per pilota, beta. None se non identificabile."""
    righe = [r for r in dati['stima'] if r['compound'] in _compound_ok(dati['stima'])]
    if len(righe) < MIN_GIRI:
        return {'escluso': f'{len(righe)} giri in aria libera (<{MIN_GIRI})'}
    piloti = sorted({r['drv'] for r in righe})
    comp = sorted({r['compound'] for r in righe})
    if len(comp) < 2:
        return {'escluso': 'una sola mescola identificabile'}
    rif = 'MEDIUM' if 'MEDIUM' in comp else comp[0]
    di = {d: i for i, d in enumerate(piloti)}
    nd, nc = len(piloti), len(comp)
    altri = [c for c in comp if c != rif]
    i_delta = {c: nd + j for j, c in enumerate(altri)}
    k = nd + len(altri)
    # H1 (PREREG_passobase): la DERIVA del livello e' per PILOTA. Quando si accende, il
    # beta COMUNE non si alloca affatto: la sua colonna sarebbe la somma esatta di quelle
    # per pilota, e il rango cadrebbe.
    i_beta = None
    if not beta_per_pilota:
        i_beta = k
        k += 1
    i_rho = {c: k + j for j, c in enumerate(comp)}
    k += nc
    i_bd = {}
    if beta_per_pilota:
        i_bd = {d: k + j for j, d in enumerate(piloti)}
        k += nd
    i_eta2 = k if eta_quadratica else None
    cols = k + (1 if eta_quadratica else 0)
    lap_m = st.mean(r['lap'] for r in righe)
    X = np.zeros((len(righe), cols))
    y = np.array([r['tfc'] for r in righe], float)
    for i, r in enumerate(righe):
        X[i, di[r['drv']]] = 1.0
        if r['compound'] != rif:
            X[i, i_delta[r['compound']]] = 1.0
        if i_beta is not None:
            X[i, i_beta] = r['lap'] - lap_m
        X[i, i_rho[r['compound']]] = r['eta']
        if beta_per_pilota:
            X[i, i_bd[r['drv']]] = r['lap'] - lap_m
        if eta_quadratica:
            X[i, i_eta2] = r['eta'] ** 2
    fit = scheletro.ols_cluster(X, y, [(r['drv'], r['stint']) for r in righe])
    if fit is None:
        return {'escluso': 'rango non pieno'}
    b, se = fit['beta'], fit['se']
    return {'rho': {c: float(b[i_rho[c]]) for c in comp},
            'se_rho': {c: float(se[i_rho[c]]) for c in comp},
            'delta': {c: (0.0 if c == rif else float(b[i_delta[c]])) for c in comp},
            'alpha': {d: float(b[di[d]]) for d in piloti},
            'beta': 0.0 if i_beta is None else float(b[i_beta]),
            'lap_medio': lap_m, 'rif': rif,
            'beta_drv': {d: float(b[i_bd[d]]) for d in i_bd},
            'eta2': float(b[i_eta2]) if eta_quadratica else None,
            'n_giri': len(righe), 'n_stint': fit['n_cluster'], 'sigma': fit['sigma'],
            'compound': comp}


def previsione(mod, dati, drv, L, compound, eta):
    """Tempo sul giro previsto: passo del pilota + mescola + evoluzione + degrado + fuel."""
    if compound not in mod['rho'] or drv not in mod['alpha']:
        return None
    return (mod['alpha'][drv] + mod['delta'][compound]
            + (mod['beta'] + mod.get('beta_drv', {}).get(drv, 0.0)) * (L - mod['lap_medio'])
            + mod['rho'][compound] * eta
            + (mod['eta2'] * eta ** 2 if mod.get('eta2') else 0.0)
            + CF.aggiungi(L, dati['N'], dati['delta_fuel']))


# ---------------------------------------------------------------- §2: la soglia aria libera
def residui_per_gap(dati, mod, fasce):
    """Residuo (osservato - previsto) su TUTTI i giri puliti, raggruppato per fascia di gap.
    Il modello e' stato stimato solo oltre GAP_STIMA: nessuna circolarita'."""
    out = {f: [] for f in fasce}
    for r in dati['puliti']:
        if r['compound'] not in mod['rho'] or r['gap'] is None:
            continue
        p = previsione(mod, dati, r['drv'], r['lap'], r['compound'], r['eta'])
        if p is None:
            continue
        for lo, hi in fasce:
            if lo <= r['gap'] < hi:
                out[(lo, hi)].append(r['time'] - p)
                break
    return out


def soglia_aria_libera(per_gara_fasce, repliche=2000, seed=20260721):
    """G* = la piu' piccola fascia il cui residuo mediano ha l'IC95 (bootstrap sui BLOCCHI
    = gare) che contiene lo zero. Non e' un modello di traffico: e' una soglia di
    esclusione, derivata dai dati."""
    import random
    fasce = sorted({f for g in per_gara_fasce for f in g})
    rng = random.Random(seed)
    fuori = []
    for f in fasce:
        per_gara = [st.median(g[f]) for g in per_gara_fasce if g.get(f)]
        if len(per_gara) < 4:
            fuori.append({'fascia': f, 'n_gare': len(per_gara), 'mediana': None,
                          'ci95': None, 'contiene_zero': None})
            continue
        med = []
        for _ in range(repliche):
            med.append(st.median([per_gara[rng.randrange(len(per_gara))]
                                  for _ in per_gara]))
        med.sort()
        lo, hi = med[int(.025 * repliche)], med[int(.975 * repliche)]
        fuori.append({'fascia': f, 'n_gare': len(per_gara),
                      'mediana': round(st.median(per_gara), 4),
                      'ci95': [round(lo, 4), round(hi, 4)],
                      'contiene_zero': lo <= 0 <= hi})
    g_star = next((f['fascia'][0] for f in fuori if f['contiene_zero']), None)
    return {'per_fascia': fuori, 'G_stella': g_star,
            'regola': 'piu piccola fascia con IC95 del residuo mediano che contiene 0'}


# ---------------------------------------------------------------- §2: pit-loss dal fondo
def pit_loss(dati, mod):
    """(in-lap + out-lap) - attesa pulita ai due giri, mediana sulle soste della gara."""
    per_drv = {}
    for r in dati['righe']:
        if isinstance(r['lap'], (int, float)):
            per_drv.setdefault(r['drv'], {})[int(r['lap'])] = r
    eta = fondo.stint_ed_eta(dati['righe'])
    perdite = []
    for drv, giri in per_drv.items():
        for L, r in giri.items():
            if fondo.nullo(r['pin']) or L + 1 not in giri:
                continue
            r2 = giri[L + 1]
            if not all(isinstance(x['time'], (int, float)) for x in (r, r2)):
                continue
            if not (isinstance(r.get('compound'), str) and isinstance(r2.get('compound'), str)):
                continue
            a1 = eta.get((drv, L), (None, None))[1]
            a2 = eta.get((drv, L + 1), (None, None))[1]
            if a1 is None or a2 is None or drv not in mod['alpha']:
                continue
            p1 = previsione(mod, dati, drv, L, r['compound'], a1)
            p2 = previsione(mod, dati, drv, L + 1, r2['compound'], a2)
            if p1 is None or p2 is None:
                continue
            perdite.append((r['time'] + r2['time']) - (p1 + p2))
    if len(perdite) < 3:
        return None
    return {'pit_loss': round(st.median(perdite), 3), 'n_soste': len(perdite),
            'iqr': [round(sorted(perdite)[len(perdite) // 4], 2),
                    round(sorted(perdite)[3 * len(perdite) // 4], 2)]}


# ---------------------------------------------------------------- §1: il controfattuale
def _costo(mod, c, n):
    """Costo di uno stint: delta*n + rho*n(n+1)/2 (+ eta2 sui quadrati). Dipende SOLO
    dalla mescola e dalla lunghezza — per questo l'ottimo e' esatto."""
    s = mod['delta'][c] * n + mod['rho'][c] * n * (n + 1) / 2
    if mod.get('eta2'):
        s += mod['eta2'] * n * (n + 1) * (2 * n + 1) / 6
    return s


def strategie(mod, N, pl, n_soste=(1, 2)):
    """Enumera esattamente. Regola sportiva: almeno DUE mescole diverse."""
    comp = [c for c in mod['rho'] if c in SLICK]
    fuori = []
    for k in n_soste:
        tagli = _tagli(N, k)
        for lun in tagli:
            for mesc in _mescole(comp, k + 1):
                if len(set(mesc)) < 2:
                    continue
                tot = sum(_costo(mod, c, n) for c, n in zip(mesc, lun)) + k * pl
                fuori.append((tot, lun, mesc))
    fuori.sort(key=lambda x: x[0])
    return fuori


def _tagli(N, k):
    """Lunghezze di stint che sommano a N, ciascuna >= MIN_STINT."""
    out = []
    if k == 1:
        for a in range(MIN_STINT, N - MIN_STINT + 1):
            out.append((a, N - a))
    elif k == 2:
        for a in range(MIN_STINT, N - 2 * MIN_STINT + 1):
            for b in range(MIN_STINT, N - a - MIN_STINT + 1):
                out.append((a, b, N - a - b))
    return out


def _mescole(comp, k):
    if k == 1:
        return [(c,) for c in comp]
    return [(c,) + resto for c in comp for resto in _mescole(comp, k - 1)]


def valuta_pilota(dati, mod, drv, pl, G, tol, cand=None):
    """Un caso = (gara, pilota). Ritorna il verdetto con i due cancelli e l'aria libera."""
    N = dati['N']
    per_lap = {}
    for r in dati['righe']:
        if r['drv'] == drv and isinstance(r['lap'], (int, float)):
            per_lap[int(r['lap'])] = r
    if any(L not in per_lap or not isinstance(per_lap[L]['time'], (int, float))
           for L in range(2, N + 1)):
        return {'escluso': 'giri mancanti (ritiro o buchi)'}
    if drv not in mod['alpha']:
        return {'escluso': 'pilota senza passo stimato'}

    eta = fondo.stint_ed_eta(dati['righe'])
    reale = sum(per_lap[L]['time'] for L in range(2, N + 1))

    # --- strategia REALE simulata (cancello di calibrazione)
    sim_reale, soste_reali = 0.0, 0
    for L in range(2, N + 1):
        r = per_lap[L]
        a = eta.get((drv, L), (None, None))[1]
        if a is None or not isinstance(r.get('compound'), str):
            return {'escluso': 'stint reale non ricostruibile'}
        p = previsione(mod, dati, drv, L, r['compound'], a)
        if p is None:
            return {'escluso': f'mescola {r["compound"]} senza rho'}
        sim_reale += p
        if not fondo.nullo(r['pin']):
            soste_reali += 1
    sim_reale += soste_reali * pl
    scarto_cal = sim_reale - reale
    if abs(scarto_cal) > tol:
        return {'escluso': 'cancello di calibrazione', 'scarto_calibrazione': round(scarto_cal, 2)}

    # --- ottimo ESATTO (nessuna euristica): il costo dipende solo da mescola e lunghezza
    if cand is None:
        cand = strategie(mod, N, pl)
    if not cand:
        return {'escluso': 'nessuna strategia ammissibile'}
    # parte comune a tutte le strategie (alpha, beta, carburante sui giri 2..N)
    comune = sum(mod['alpha'][drv] + mod['beta'] * (L - mod['lap_medio'])
                 + CF.aggiungi(L, N, dati['delta_fuel']) for L in range(2, N + 1))
    # _costo somma le eta 1..n di TUTTI i giri 1..N: il giro 1 esce dal confronto
    def _primo(c):
        return mod['delta'][c] + mod['rho'][c] * 1 + (mod['eta2'] if mod.get('eta2') else 0.0)
    tot_ott, lun_ott, mesc_ott = min(
        ((comune + tot - _primo(mesc[0]), lun, mesc) for tot, lun, mesc in cand),
        key=lambda x: x[0])

    # --- aria libera al rientro di OGNI sosta
    if 1 not in per_lap or not isinstance(per_lap[1].get('sesT'), (int, float)):
        return {'escluso': 'cronometria cumulata assente'}
    rientri, cum = [], float(per_lap[1]['sesT'])
    soste_lap = []
    acc = 0
    for n in lun_ott[:-1]:
        acc += n
        soste_lap.append(acc)          # ultimo giro dello stint: il pit avviene qui
    for L in range(2, N + 1):
        c = mesc_ott[sum(1 for s in soste_lap if s < L)]
        a = L - (max([s for s in soste_lap if s < L], default=0))
        cum += previsione(mod, dati, drv, L, c, a)
        if (L - 1) in soste_lap:
            cum += pl
            rientri.append((L, cum))
    for L, c_cum in rientri:
        davanti = [x for x in _cum_altri(dati, L, drv) if x < c_cum]
        gap = c_cum - max(davanti) if davanti else None
        if gap is not None and gap < G:
            return {'escluso': 'rientro in traffico', 'gap_rientro': round(gap, 2),
                    'differito': 'a quando il traffico sara verificato dal fondo'}

    margine = reale - tot_ott
    return {'reale': round(reale, 2), 'sim_reale': round(sim_reale, 2),
            'scarto_calibrazione': round(scarto_cal, 2),
            'sim_ottima': round(tot_ott, 2), 'margine': round(margine, 2),
            'vince': margine > tol, 'strategia': {'lunghezze': list(lun_ott),
                                                  'mescole': list(mesc_ott),
                                                  'pit_ai_giri': soste_lap},
            'strategia_reale_soste': soste_reali, 'pit_loss': pl}


def _cum_altri(dati, L, drv):
    return [float(r['sesT']) for r in dati['righe']
            if isinstance(r['lap'], (int, float)) and int(r['lap']) == L
            and r['drv'] != drv and isinstance(r.get('sesT'), (int, float))]
