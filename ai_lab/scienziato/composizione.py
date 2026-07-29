"""ai_lab/scienziato/composizione.py — intensita' x durata, la forma che mancava.

Le quattro forme bocciate erano ADDITIVE: gap e delta-passo messi a competere nello
spiegare il tempo perso PER GIRO. Ma non competono: il gap governa l'INTENSITA' (quanto
perdi ogni giro attaccato), il delta-passo la DURATA (per quanti giri ci resti). Si
COMPONGONO.

    C = D(delta) * i(g0)      i(g) = a*e^(-g/lam)   [imbattuta su due notti]

Predittivo per costruzione: all'inizio dell'incontro si conoscono solo g0 e delta.
La durata realizzata NON entra: in live non la si ha.

Nessun null nuovo: il placebo e' traffico.placebo_leader, gia' sotto sigillo.
"""
import statistics as st

import numpy as np

# le stesse fasce di delta sotto cui la U rovesciata e' stata verificata
FASCE = [(-99.0, -0.8), (-0.8, -0.4), (-0.4, -0.15), (-0.15, 0.15), (0.15, 99.0)]
SOGLIA_INCONTRO = 1.5     # s — stessa definizione della notte scorsa, non si tocca


def fascia(delta):
    for lo, hi in FASCE:
        if lo <= delta < hi:
            return (lo, hi)
    return FASCE[-1]


def incontri_costo(inc):
    """Da giri a INCONTRI: giri consecutivi entro SOGLIA_INCONTRO dallo stesso leader.
    Ogni incontro porta g0 (gap al primo giro), delta (mediano), durata e COSTO totale."""
    per = {}
    for x in inc:
        if x['gap'] is not None and x['gap'] <= SOGLIA_INCONTRO:
            per.setdefault((x['gara'], x['drv'], x['lead']), []).append(x)
    fuori = []
    for (gara, d, lead), v in per.items():
        v.sort(key=lambda z: z['lap'])
        inizio = 0
        for i in range(1, len(v) + 1):
            if i < len(v) and v[i]['lap'] == v[i - 1]['lap'] + 1:
                continue
            blocco = v[inizio:i]
            fuori.append({'gara': gara, 'drv': d, 'lead': lead,
                          'lap0': blocco[0]['lap'], 'g0': blocco[0]['gap'],
                          'delta': st.median([b['delta'] for b in blocco]),
                          'durata': len(blocco),
                          'costo': float(sum(b['r'] for b in blocco))})
            inizio = i
    return fuori


def stima_durata(enc):
    """D(delta): durata ATTESA per fascia (media: il costo e' additivo). Piu' la media
    globale, che e' quello che il solo-gap puo' sapere."""
    per = {}
    for e in enc:
        per.setdefault(fascia(e['delta']), []).append(e['durata'])
    D = {f: st.mean(v) for f, v in per.items() if len(v) >= 10}
    return {'per_fascia': D, 'globale': st.mean([e['durata'] for e in enc]),
            'n_per_fascia': {f: len(v) for f, v in per.items()}}


def intensita(g0, glob):
    return glob['a'] * np.exp(-np.asarray(g0) / glob['lam'])


def prevedi(enc, glob, dur, forma, kappa=1.0):
    """C0 = D_globale * i(g0);  C1 = D(delta) * i(g0);  C2 = kappa * C1."""
    g = np.array([e['g0'] for e in enc])
    i = intensita(g, glob)
    if forma == 'C0':
        return dur['globale'] * i
    d = np.array([dur['per_fascia'].get(fascia(e['delta']), dur['globale']) for e in enc])
    return (kappa if forma == 'C2' else 1.0) * d * i


def stima_kappa(enc, glob, dur):
    """Il fattore di scala unico di C2, ai minimi quadrati sulla calibrazione."""
    p = prevedi(enc, glob, dur, 'C1')
    y = np.array([e['costo'] for e in enc])
    den = float(p @ p)
    return float(p @ y / den) if den > 0 else 1.0


def errore_per_gara(enc, pred):
    """Errore assoluto mediano sul COSTO TOTALE, per gara (blocco)."""
    per = {}
    for e, p in zip(enc, pred):
        per.setdefault(e['gara'], []).append(abs(e['costo'] - p))
    return [float(np.median(v)) for v in per.values()]
