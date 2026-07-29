"""ai_lab/distruttore/patogeni.py — i due patogeni piantati (test di accettazione).

!! DA RIVERIFICARE (rifondazione 21/07/2026) — ai_lab/scienziato/RETROCESSIONE.md
   Il 'noto-vero' e' il pit-loss 29,12 -> 20,80 e il 'noto-falso' parte dal cap
   ZONE=1.5/STRENGTH=1.0: entrambi numeri NON-FONDO. La taratura del giudice
   (sensibilita' e specificita') e' quindi condizionata a ipotesi da riverificare.

Non sono esempi didattici: sono il collaudo del Distruttore stesso.
  NOTO-FALSO  -> deve essere UCCISO   (sensibilita': se sopravvive, lo strumento e' debole)
  NOTO-VERO   -> deve SOPRAVVIVERE   (specificita': se muore, lo strumento e' aggressivo)

Entrambi sono OVERLAY: parametrizzazioni del motore congelato, mai edit a engine.py.
"""
import os
import statistics as st
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
if QUI not in sys.path:
    sys.path.insert(0, QUI)

import distruttore as D

# explore-set: gare 2026 che NON stanno nel panel ostile (e non e' Gran Bretagna, riservata
# al NOTO-VERO). E' il set su cui il patogeno falso viene sovra-adattato.
EXPLORE = ['Austria', 'Canada', 'Cina']
GRIGLIA_STRENGTH = [0.70, 0.80, 0.85, 0.90, 1.00]   # dichiarata, non scelta dopo i numeri


def costruisci_noto_falso(verbose=False):
    """Calibra STRENGTH sull'explore-set scegliendo il valore che 'migliora' di piu' LI'.
    E' esattamente l'overfit: la scelta e' guidata da un campione ristretto, e il cap del
    traffico ne esce indebolito dove il traffico conta."""
    P = D.carica_prereg()
    Mt = P['misura']['traffico']
    base = {'ZONE': 1.5, 'STRENGTH': 1.00}
    punteggi = {}
    for s in GRIGLIA_STRENGTH:
        if s == base['STRENGTH']:
            continue
        vals = []
        for gara in EXPLORE:
            coppie = D.confronto_traffico(gara, base, {'ZONE': 1.5, 'STRENGTH': s},
                                          Mt['orizzonte_H'], Mt['gap_max_inclusione_s'])
            vals += [c['migliora'] for c in coppie]
        punteggi[s] = st.mean(vals) if vals else float('-inf')
        if verbose:
            print(f'    STRENGTH {s:.2f} -> miglioramento medio su explore '
                  f'{punteggi[s]:+.5f} s')
    migliore = max(punteggi, key=punteggi.get)
    return {
        'id': 'PATOGENO-FALSO-traffico',
        'modulo': 'traffico',
        'baseline': base,
        'overlay': {'ZONE': 1.5, 'STRENGTH': migliore},
        'explore_set': EXPLORE,
        'kpi_rivendicato': {'nome': 'errore assoluto sul gap dopo H giri',
                            'miglioramento_su_explore_s': round(punteggi[migliore], 5)},
        'regime': '2026',
        'cross_regime': False,
        'ambito_out_of_sample': 'panel ostile a 6 circuiti',
        'invarianza': 'in aria libera (gap >= ZONE) l\'overlay deve essere no-op bit-identico',
        '_griglia': {str(k): round(v, 5) for k, v in punteggi.items()},
    }


def costruisci_noto_vero():
    """Correzione pit-loss Silverstone 29.12 -> 20.80. Miglioramento reale gia' validato
    (ATT6 v1, PR #26, NOTA_SILVERSTONE.md). Qui att6_silverstone.mjs e' usato come
    RIPRODUTTORE di un'attivazione, non per attivarne una nuova."""
    return {
        'id': 'PATOGENO-VERO-pitloss-silverstone',
        'modulo': 'pitloss',
        'circuito': 'Gran Bretagna',
        'baseline': {'pitLoss': 29.12},
        'overlay': {'pitLoss': 20.80},
        'explore_set': ['censimento FF2 pit-lane (7 blocchi), non le gare del panel'],
        'kpi_rivendicato': {'nome': 'errore assoluto di posizione di rientro',
                            'fonte': 'att6_silverstone.mjs, 3 casi dichiarati a priori'},
        'regime': '2026',
        'cross_regime': False,
        'ambito_out_of_sample': '3 casi di pit reali di Silverstone, circuito escluso dal panel',
        'invarianza': 'Pace/Advance non toccati: i golden restano validi',
    }
