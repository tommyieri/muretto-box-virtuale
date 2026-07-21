"""ai_lab/scienziato/carburante_fermo.py — IL PRIMO PIANO, CONGELATO.

Il degrado si costruisce SOPRA questo. Non lo rimette in discussione: se emergesse che il
carburante sporca il degrado, si dichiara e si porta al tavolo, non si riapre in corsa.

CHE COSA E' CONGELATO (PREREG_degrado §0)
  regime 2022-25 : per-circuito SOLO per i circuiti PER-CIRCUITO VERI del metro a due
                   condizioni (segno stabile + distanza netta); globale ricostruito per
                   tutti gli altri.
  regime 2026    : numero UNICO globale. Con una gara per circuito il per-circuito non e'
                   calcolabile — nessuna ripetizione, nessuna stabilita'. E' "buono
                   abbastanza" per standard dichiarato, NON per-circuito. Migliorera' da
                   se' quando il 2026 accumula gare.

PROVENIENZA: i valori si leggono da predizioni_congelate.json e esito_fuel.json, cioe' da
artefatti gia' committati col loro generatore. Nessun numero riscritto a mano qui.

FORMA: il carburante toglie  Delta * (N - L)/(N - 1)  secondi al giro L di una gara di N
giri. A giro 1 vale Delta, a giro N vale 0.
"""
import json
import os

QUI = os.path.dirname(os.path.abspath(__file__))
CONGELATE = os.path.join(QUI, 'predizioni_congelate.json')
ESITO_FUEL = os.path.join(QUI, 'esito_fuel.json')


def _carica():
    cong = json.load(open(CONGELATE))
    fuel = json.load(open(ESITO_FUEL))
    veri = {x['circuito']: x['media_pesata'] for x in cong['gia_visti_NON_PROVA']
            if x['esito'] == 'PER-CIRCUITO VERO'}
    globali = {r: v['mediana'] for r, v in fuel['B1']['regimi'].items()}
    return veri, globali


PER_CIRCUITO, GLOBALE = _carica()


def delta(circuito, regime):
    """Lo scivolamento totale del carburante per quella gara, in secondi."""
    if regime != '2026' and circuito in PER_CIRCUITO:
        return PER_CIRCUITO[circuito], 'per-circuito (VERO)'
    return GLOBALE[regime], f'globale {regime}'


def sottrai(t, L, N, D):
    """Toglie il carburante dal tempo sul giro. D = delta della gara."""
    return t - D * (N - L) / max(N - 1, 1)


def aggiungi(L, N, D):
    """Quanto carburante pesa sul giro L (da sommare a un passo a serbatoio vuoto)."""
    return D * (N - L) / max(N - 1, 1)


def dichiarazione():
    return {'per_circuito_veri': PER_CIRCUITO, 'globali_per_regime': GLOBALE,
            'fonte': ['predizioni_congelate.json', 'esito_fuel.json'],
            'nota_2026': 'numero unico: con una gara per circuito il per-circuito non e\' '
                         'calcolabile (nessuna ripetizione = nessuna stabilita\')'}
