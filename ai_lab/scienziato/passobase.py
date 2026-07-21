"""ai_lab/scienziato/passobase.py — la caccia agli 11,7 s del passo base.

Tre ipotesi dichiarate in PREREG_passobase.md PRIMA di misurare:
  H1  il livello NON e' costante dentro la gara (deriva)
  H2  il livello e' per-STINT, non per-gara (ogni set di gomme e' un oggetto diverso)
  H3  alpha stimato su pochi giri liberi e' rumoroso -> pooling parziale

Il permutation-null e' sotto sigillo: qui si CHIAMA scheletro.bootstrap_a_blocchi senza
modificarla. Nessun null nuovo e' stato scritto.

TARGHETTA: ogni numero prodotto da questo modulo porta n_gare e la data di calcolo.
"""
import statistics as st

import numpy as np

import degrado as DG
import fondo
import scheletro

GAP_LIBERO = 5.0


def casi_gara(dati, mod):
    """Giri liberi per (pilota, stint), gia' col carburante congelato sottratto."""
    per = {}
    for r in dati['stima']:
        if r['compound'] in mod['rho'] and r['drv'] in mod['alpha']:
            per.setdefault(r['drv'], []).append(r)
    return per


def _residuo(mod, dati, r):
    p = DG.previsione(mod, dati, r['drv'], r['lap'], r['compound'], r['eta'])
    return None if p is None else r['time'] - p


# ---------------------------------------------------------------- H1
def h1_deriva(dati, mod, min_per_meta=6):
    """alpha dalla PRIMA meta' dei giri liberi, misurato sulla SECONDA. Mai gli stessi giri.
    Ritorna lo scarto di livello (secondi/giro) per pilota."""
    fuori = []
    meta = dati['N'] / 2
    for drv, giri in casi_gara(dati, mod).items():
        a = [r for r in giri if r['lap'] <= meta]
        b = [r for r in giri if r['lap'] > meta]
        if len(a) < min_per_meta or len(b) < min_per_meta:
            continue
        ra = [x for x in (_residuo(mod, dati, r) for r in a) if x is not None]
        rb = [x for x in (_residuo(mod, dati, r) for r in b) if x is not None]
        if not ra or not rb:
            continue
        # livello stimato sulla prima meta', errore che ne deriva sulla seconda
        fuori.append({'drv': drv, 'liv_1a': st.median(ra), 'liv_2a': st.median(rb),
                      'scarto': st.median(rb) - st.median(ra), 'n1': len(ra), 'n2': len(rb)})
    return fuori


# ---------------------------------------------------------------- H2
def h2_per_stint(dati, mod, min_per_meta=4):
    """Livello per (pilota, stint): meta' dei giri liberi dello stint stima, l'altra meta'
    misura. Se il livello e' davvero per-stint, lo scarto fra stint dello stesso pilota e'
    grande rispetto allo scarto DENTRO lo stint."""
    dentro, fra = [], []
    for drv, giri in casi_gara(dati, mod).items():
        per_stint = {}
        for r in giri:
            per_stint.setdefault(r['stint'], []).append(r)
        livelli = []
        for s, righe in per_stint.items():
            righe = sorted(righe, key=lambda r: r['lap'])
            a, b = righe[0::2], righe[1::2]          # pari/dispari: stesso periodo, mai gli stessi giri
            if len(a) < min_per_meta or len(b) < min_per_meta:
                continue
            ra = [x for x in (_residuo(mod, dati, r) for r in a) if x is not None]
            rb = [x for x in (_residuo(mod, dati, r) for r in b) if x is not None]
            if not ra or not rb:
                continue
            dentro.append(st.median(rb) - st.median(ra))     # rumore entro lo stint
            livelli.append(st.median(ra + rb))
        if len(livelli) >= 2:
            fra += [x - st.mean(livelli) for x in livelli]   # dispersione fra stint
    return {'dentro_stint': dentro, 'fra_stint': fra}


# ---------------------------------------------------------------- H3
def h3_pochi_giri(dati, mod):
    """|livello| del pilota contro il numero di giri liberi che lo hanno stimato."""
    fuori = []
    for drv, giri in casi_gara(dati, mod).items():
        r = [x for x in (_residuo(mod, dati, g) for g in giri) if x is not None]
        if len(r) >= 3:
            fuori.append({'drv': drv, 'n_liberi': len(r), 'liv': st.median(r),
                          'sd': st.pstdev(r)})
    return fuori


# ---------------------------------------------------------------- il metro
def errore_ricostruzione(dati, mod, pl, alpha_override=None):
    """E = |sim(strategia reale) - tempo reale| per pilota. alpha_override permette di
    provare un passo base diverso senza toccare il resto del modello."""
    eta = fondo.stint_ed_eta(dati['righe'])
    N = dati['N']
    per_lap = {}
    for r in dati['righe']:
        if isinstance(r['lap'], (int, float)):
            per_lap.setdefault(r['drv'], {})[int(r['lap'])] = r
    fuori = []
    for drv in mod['alpha']:
        giri = per_lap.get(drv, {})
        if any(L not in giri or not isinstance(giri[L]['time'], (int, float))
               for L in range(2, N + 1)):
            continue
        reale = sim = 0.0
        soste = 0
        ok = True
        for L in range(2, N + 1):
            r = giri[L]
            a = eta.get((drv, L), (None, None))[1]
            p = DG.previsione(mod, dati, drv, L, r.get('compound'), a) if a else None
            if p is None:
                ok = False
                break
            if alpha_override is not None:
                p += alpha_override(drv, L, r.get('compound'), a, r)
            reale += r['time']
            sim += p
            if not fondo.nullo(r['pin']):
                soste += 1
        if not ok:
            continue
        sim += soste * pl
        fuori.append({'drv': drv, 'E': abs(sim - reale), 'segno': sim - reale})
    return fuori


def aggrega(per_gara_E, etichetta, n_gare, data):
    """p68 sui casi + mediana per gara aggregata sui BLOCCHI con la funzione sigillata."""
    tutti = [e['E'] for g in per_gara_E for e in g['casi']]
    med_gara = [st.median([e['E'] for e in g['casi']]) for g in per_gara_E if g['casi']]
    boot = scheletro.bootstrap_a_blocchi(med_gara) if len(med_gara) > 1 else None
    tutti.sort()
    return {'etichetta': etichetta,
            'p68_casi': round(tutti[int(.68 * len(tutti))], 3) if tutti else None,
            'mediana_per_gara': boot['mediana'] if boot else None,
            'ci95_blocchi': boot['ci95'] if boot else None,
            'n_casi': len(tutti), 'n_gare': len(med_gara),
            'targhetta': {'gare_sotto': n_gare, 'calcolato_il': data}}
