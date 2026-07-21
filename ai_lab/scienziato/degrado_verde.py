"""ai_lab/scienziato/degrado_verde.py — la CONTABILITA' A GIRI VERDI.

Tutto dichiarato in PREREG_degrado_2026.md §0 e §3 PRIMA dei numeri.

IL PROBLEMA CHE RISOLVE
    `degrado.neutralizzata()` butta fuori dal controfattuale l'INTERA gara se anche un solo
    giro e' sotto SC/VSC. Nel 2026 questo costa 10 gare su 10 (censimento: dal 5,7 % al
    15,9 % di giri neutralizzati per gara). La regola costa il 100 % del regime per
    proteggersi dal ~10 % dei giri.

LA REGOLA NUOVA
    Il confronto si somma SOLO sui giri verdi del pilota (status '1'), IDENTICI sui due lati.
    L'ETA' GOMMA avanza su TUTTI i giri (la gomma invecchia anche dietro la safety car):
    salta il conteggio del TEMPO, non l'invecchiamento.

PERCHE' NON E' UN AMMORBIDIMENTO (PREREG §0)
    Il cancello di calibrazione era gia' la vera protezione: una gara con secondi non
    spiegabili fa esplodere |sim(reale) - reale| e il caso esce da se'. Il veto di gara era
    RIDONDANTE, non additivo. In piu' il veto GONFIAVA `tol` (68o percentile di quello stesso
    scarto): togliere i giri neutralizzati STRINGE il metro, non lo allarga.

    La regola non si adotta sulla fiducia: `run_degrado_2026.py --falsifica` gira ENTRAMBE le
    contabilita' sullo storico e respinge la nuova se gonfia le vittorie.

L'OTTIMO RESTA ESATTO
    Con i giri verdi il costo di uno stint dipende anche da DOVE inizia, non solo da quanto e'
    lungo. Resta O(1) per stint con due cumulate sui giri verdi (V0, V1, V2 qui sotto):
    nessuna euristica, nessuna ricerca approssimata.
"""
import statistics as st

import carburante_fermo as CF
import degrado as DG
import fondo

MIN_STINT = DG.MIN_STINT


# ---------------------------------------------------------------- i giri verdi
def giri_verdi(righe, drv, N):
    """I giri 2..N in cui il pilota e' in bandiera verde pura (status '1').

    Lap 1 e' SEMPRE fuori (la partenza non e' un giro di passo): cosi' esce da solo da tutte
    le somme, senza la sottrazione a mano del primo giro che serviva prima.
    """
    per_lap = {}
    for r in righe:
        if r['drv'] == drv and isinstance(r['lap'], (int, float)):
            per_lap[int(r['lap'])] = r
    return {L for L in range(2, N + 1)
            if L in per_lap and str(per_lap[L]['status']) == '1'}, per_lap


def cumulate(verdi, N):
    """G0[L] = quanti giri verdi fino a L; G1[L] = somma dei loro indici. Da queste due,
    ogni somma su uno stint e' O(1)."""
    G0 = [0] * (N + 2)
    G1 = [0] * (N + 2)
    for L in range(1, N + 1):
        v = 1 if L in verdi else 0
        G0[L] = G0[L - 1] + v
        G1[L] = G1[L - 1] + (L if v else 0)
    G0[N + 1], G1[N + 1] = G0[N], G1[N]
    return G0, G1


def V0(G0, s, n, N):
    """Quanti giri verdi nello stint [s, s+n-1]."""
    a, b = min(s + n - 1, N), min(s - 1, N)
    return G0[a] - G0[b]


def V1(G0, G1, s, n, N):
    """Somma delle ETA' (L-s+1) sui soli giri verdi dello stint."""
    a, b = min(s + n - 1, N), min(s - 1, N)
    return (G1[a] - G1[b]) - (s - 1) * (G0[a] - G0[b])


def V2(G0, G1, s, n, k, N):
    """Somma di max(0, eta - k) sui soli giri verdi: il termine di CLIFF (C3)."""
    lo = min(s + k - 1, N)          # le eta <= k non contribuiscono
    a, b = min(s + n - 1, N), max(lo, min(s - 1, N))
    if a <= b:
        return 0.0
    return (G1[a] - G1[b]) - (s + k - 1) * (G0[a] - G0[b])


# ---------------------------------------------------------------- previsione e costi
def _passo(mod, dati, drv, L, c, eta, cliff=None):
    """Tempo previsto al giro L. Identica a degrado.previsione, piu' il termine di cliff."""
    p = DG.previsione(mod, dati, drv, L, c, eta)
    if p is None:
        return None
    if cliff and c in cliff.get('gamma', {}):
        p += cliff['gamma'][c] * max(0, eta - cliff['k'][c])
    return p


def _comune(mod, dati, drv, verdi, N):
    """La parte UGUALE per ogni strategia: passo del pilota, evoluzione, carburante.
    Sommata sui soli giri verdi."""
    bd = mod['beta'] + mod.get('beta_drv', {}).get(drv, 0.0)
    return sum(mod['alpha'][drv] + bd * (L - mod['lap_medio'])
               + CF.aggiungi(L, N, dati['delta_fuel']) for L in sorted(verdi))


def _costo_stint(mod, c, s, n, G0, G1, N, cliff=None):
    """delta_c * (giri verdi) + rho_c * (somma delle eta sui verdi) [+ cliff]."""
    v0 = V0(G0, s, n, N)
    v1 = V1(G0, G1, s, n, N)
    tot = mod['delta'][c] * v0 + mod['rho'][c] * v1
    if cliff and c in cliff.get('gamma', {}):
        tot += cliff['gamma'][c] * V2(G0, G1, s, n, cliff['k'][c], N)
    return tot


def strategie_verdi(mod, N, pl, G0, G1, n_soste=(1, 2), cliff=None):
    """Enumera ESATTAMENTE le strategie ammissibili. Regola sportiva: almeno DUE mescole.

    PIT-LOSS SEMPRE CONTATO (PREREG §3a): k * pl, che i giri della sosta siano verdi o no.
    Se lo contassi solo sui verdi, l'ottimizzatore imparerebbe a NASCONDERE le soste sotto
    safety car per non pagarlo: vincerebbe per un artefatto della contabilita'.
    """
    comp = [c for c in mod['rho'] if c in DG.SLICK]
    fuori = []
    for k in n_soste:
        for lun in DG._tagli(N, k):
            inizi, s = [], 1
            for n in lun:
                inizi.append(s)
                s += n
            for mesc in DG._mescole(comp, k + 1):
                if len(set(mesc)) < 2:
                    continue
                tot = sum(_costo_stint(mod, c, s0, n, G0, G1, N, cliff)
                          for c, s0, n in zip(mesc, inizi, lun)) + k * pl
                fuori.append((tot, lun, mesc, inizi))
    fuori.sort(key=lambda x: x[0])
    return fuori


# ---------------------------------------------------------------- il controfattuale
def valuta_pilota_verde(dati, mod, drv, pl, G, tol, cand=None, cliff=None, eta_mappa=None):
    """Un caso = (gara, pilota), con contabilita' a giri verdi.

    Ritorna il verdetto con i due cancelli (calibrazione, margine) e l'aria libera al rientro.
    """
    N = dati['N']
    verdi, per_lap = giri_verdi(dati['righe'], drv, N)
    if any(L not in per_lap or not isinstance(per_lap[L]['time'], (int, float))
           for L in range(2, N + 1)):
        return {'escluso': 'giri mancanti (ritiro o buchi)'}
    if drv not in mod['alpha']:
        return {'escluso': 'pilota senza passo stimato'}
    if len(verdi) < 20:
        return {'escluso': f'troppi pochi giri verdi ({len(verdi)})'}

    eta = eta_mappa if eta_mappa is not None else fondo.stint_ed_eta(dati['righe'])
    G0, G1 = cumulate(verdi, N)

    # --- il REALE: solo giri verdi
    reale = sum(per_lap[L]['time'] for L in sorted(verdi))

    # --- la strategia REALE simulata (cancello di calibrazione), sugli STESSI giri
    sim_reale, soste_reali = 0.0, 0
    for L in range(2, N + 1):
        r = per_lap[L]
        a = eta.get((drv, L), (None, None))[1]
        if a is None or not isinstance(r.get('compound'), str):
            return {'escluso': 'stint reale non ricostruibile'}
        if not fondo.nullo(r['pin']):
            soste_reali += 1
        if L not in verdi:
            continue                       # l'eta e' avanzata, il tempo non si conta
        p = _passo(mod, dati, drv, L, r['compound'], a, cliff)
        if p is None:
            return {'escluso': f'mescola {r["compound"]} senza rho'}
        sim_reale += p
    sim_reale += soste_reali * pl          # sempre contato, come per le candidate
    scarto_cal = sim_reale - reale
    if abs(scarto_cal) > tol:
        return {'escluso': 'cancello di calibrazione',
                'scarto_calibrazione': round(scarto_cal, 2),
                'n_verdi': len(verdi), 'soste_reali': soste_reali}

    # --- l'ottimo ESATTO
    if cand is None:
        cand = strategie_verdi(mod, N, pl, G0, G1, cliff=cliff)
    if not cand:
        return {'escluso': 'nessuna strategia ammissibile'}
    comune = _comune(mod, dati, drv, verdi, N)
    tot_ott, lun_ott, mesc_ott, inizi_ott = min(cand, key=lambda x: x[0])
    tot_ott += comune

    # --- aria libera al rientro di OGNI sosta (SCHERMO, non punteggio: PREREG §3b)
    if 1 not in per_lap or not isinstance(per_lap[1].get('sesT'), (int, float)):
        return {'escluso': 'cronometria cumulata assente'}
    soste_lap = [i - 1 for i in inizi_ott[1:]]      # ultimo giro dello stint: il pit e' qui
    cum = float(per_lap[1]['sesT'])
    rientri = []
    for L in range(2, N + 1):
        j = sum(1 for s in soste_lap if s < L)
        c = mesc_ott[j]
        a = L - inizi_ott[j] + 1
        p = _passo(mod, dati, drv, L, c, a, cliff)
        if p is None:
            return {'escluso': f'mescola {c} senza rho'}
        cum += p                                    # traiettoria su TUTTI i giri (dichiarato)
        if (L - 1) in soste_lap:
            cum += pl
            rientri.append((L, cum))
    for L, c_cum in rientri:
        davanti = [x for x in DG._cum_altri(dati, L, drv) if x < c_cum]
        gap = c_cum - max(davanti) if davanti else None
        if gap is not None and gap < G:
            return {'escluso': 'rientro in traffico', 'gap_rientro': round(gap, 2),
                    'differito': 'a quando il traffico sara verificato dal fondo'}

    margine = reale - tot_ott
    return {'reale': round(reale, 2), 'sim_reale': round(sim_reale, 2),
            'scarto_calibrazione': round(scarto_cal, 2),
            'sim_ottima': round(tot_ott, 2), 'margine': round(margine, 2),
            'vince': margine > tol, 'n_verdi': len(verdi), 'n_giri_gara': N,
            'strategia': {'lunghezze': list(lun_ott), 'mescole': list(mesc_ott),
                          'pit_ai_giri': soste_lap},
            'strategia_reale_soste': soste_reali, 'pit_loss': pl}


# ---------------------------------------------------------------- il metro, per un insieme
def scarti_calibrazione(dati, mod, pl, cliff=None):
    """|sim(strategia reale) - reale| per ogni pilota valutabile. Da qui esce `tol` (68o
    percentile sulle sole gare di CALIBRAZIONE) e da qui esce il confronto col degrado-zero."""
    N = dati['N']
    eta = fondo.stint_ed_eta(dati['righe'])
    piloti = sorted({r['drv'] for r in dati['righe']})
    fuori = {}
    for drv in piloti:
        verdi, per_lap = giri_verdi(dati['righe'], drv, N)
        if drv not in mod['alpha'] or len(verdi) < 20:
            continue
        if any(L not in per_lap or not isinstance(per_lap[L]['time'], (int, float))
               for L in range(2, N + 1)):
            continue
        reale, sim, soste, ok = 0.0, 0.0, 0, True
        for L in range(2, N + 1):
            r = per_lap[L]
            a = eta.get((drv, L), (None, None))[1]
            if a is None or not isinstance(r.get('compound'), str):
                ok = False
                break
            if not fondo.nullo(r['pin']):
                soste += 1
            if L not in verdi:
                continue
            p = _passo(mod, dati, drv, L, r['compound'], a, cliff)
            if p is None:
                ok = False
                break
            sim += p
            reale += r['time']
        if ok:
            fuori[drv] = abs(sim + soste * pl - reale)
    return fuori


def tol_da_calibrazione(scarti, q=0.68):
    """`tol` = 68o percentile di |sim(reale) - reale| sulle gare di CALIBRAZIONE. Derivato
    dai dati, e da dati diversi da quelli su cui giudica."""
    v = sorted(scarti)
    if not v:
        return None
    return v[min(len(v) - 1, int(q * len(v)))]


def degrado_zero(mod):
    """IL NON-FARE-NIENTE: le gomme non calano. rho = 0 per ogni mescola, tutto il resto
    identico. E' il termine di paragone del cancello di accensione (PREREG §4A)."""
    z = dict(mod)
    z['rho'] = {c: 0.0 for c in mod['rho']}
    z['eta2'] = None
    return z


def mediana(v):
    return st.median(v) if v else None
