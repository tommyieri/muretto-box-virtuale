"""ai_lab/distruttore/calibrazione.py — tolleranza della validazione-partizione.

PERCHE'
  Quando un investigatore proporra' una partizione explore/confirm, il Distruttore deve
  poter rifiutare una partizione TRUCCATA: un confirm scelto dove l'overlay traffico morde
  poco (stessa malattia di ATT6 v2 — set di misura scelto dove il fenomeno e' ridotto).
  Il test e' di taglia-effetto: l'overlay deve mordere sul confirm quanto sull'explore,
  entro una tolleranza. Questo modulo FISSA quella tolleranza.

DA DOVE VIENE LA TOLLERANZA
  Dalla variabilita' NATURALE dell'effetto-traffico fra circuiti, misurata sul regime
  STORICO 2023-2025. NON dal panel 2026 che poi giudichera': sarebbe di nuovo il righello
  che misura se stesso.

TAGLIA-EFFETTO ("quanto morde il traffico" su un circuito)
  morso = KPI(senza cap, ZONE=0) - KPI(cap attivo, ZONE=1.5, STRENGTH=1.0)
  con KPI = errore assoluto sul gap previsto dopo H giri, in spazio fuel-neutro.
  Segno positivo = il cap avvicina la simulazione al reale su quel circuito.

BLOCCHI
  L'unita' indipendente e' il CIRCUITO, non la coppia di auto e nemmeno la singola gara:
  le coppie dentro una gara sono correlate, e lo stesso circuito in anni diversi condivide
  la geometria. Si contano i blocchi, non i punti.
"""
import json
import os
import random
import statistics as st
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
if QUI not in sys.path:
    sys.path.insert(0, QUI)

import distruttore as D

ANNI_STORICI = ('2023', '2024', '2025')
ARCHIVIO = os.path.join(D.RADICE, 'data', 'ti_archive')
BASE = {'ZONE': 1.5, 'STRENGTH': 1.0}      # cap attivo, valori di produzione del kernel
SENZA = {'ZONE': 0.0, 'STRENGTH': 1.0}     # ZONE=0: il cap non si attiva mai


def _gare_storiche():
    """Tutte le gare 2023-2025. Nessun file 2026 puo' entrare: il percorso lo impedisce."""
    fuori = []
    for anno in ANNI_STORICI:
        base = os.path.join(ARCHIVIO, anno)
        if not os.path.isdir(base):
            continue
        for cart in sorted(os.listdir(base)):
            p = os.path.join(base, cart, 'Race.json')
            if os.path.exists(p):
                fuori.append({'anno': anno, 'circuito': cart.replace(' Grand Prix', ''),
                              'percorso': os.path.relpath(p, D.RADICE)})
    return fuori


def morso_per_gara(g, H, gap_max):
    """Spostamento del KPI dovuto al cap del traffico, coppia per coppia."""
    nome = f"{g['circuito']}-{g['anno']}"
    on = D.misura_traffico(nome, BASE['ZONE'], BASE['STRENGTH'], H, gap_max, percorso=g['percorso'])
    off = D.misura_traffico(nome, SENZA['ZONE'], SENZA['STRENGTH'], H, gap_max, percorso=g['percorso'])
    idx = {(x['freeze'], x['inseguitore'], x['battistrada']): x['errore'] for x in off}
    fuori = []
    for x in on:
        k = (x['freeze'], x['inseguitore'], x['battistrada'])
        if k in idx:
            fuori.append(idx[k] - x['errore'])       # >0 = il cap avvicina al reale
    return fuori


def misura_storico(verbose=True):
    """Taglia-effetto per CIRCUITO, aggregando le coppie di tutti gli anni disponibili."""
    P = D.carica_prereg()
    Mt = P['misura']['traffico']
    H, gap_max, min_coppie = (Mt['orizzonte_H'], Mt['gap_max_inclusione_s'],
                              Mt['min_coppie_per_circuito'])
    per_circuito, per_gara = {}, []
    for g in _gare_storiche():
        d = morso_per_gara(g, H, gap_max)
        per_gara.append({**g, 'n_coppie': len(d),
                         'morso': round(st.mean(d), 5) if d else None})
        per_circuito.setdefault(g['circuito'], {'coppie': [], 'anni': []})
        per_circuito[g['circuito']]['coppie'] += d
        per_circuito[g['circuito']]['anni'].append(g['anno'])
    circuiti = []
    scartati = []
    for c, v in sorted(per_circuito.items()):
        if len(v['coppie']) < min_coppie:
            scartati.append({'circuito': c, 'n_coppie': len(v['coppie']),
                             'motivo': f'< {min_coppie} coppie (soglia gia\' dichiarata nel prereg)'})
            continue
        circuiti.append({'circuito': c, 'anni': sorted(set(v['anni'])),
                         'n_coppie': len(v['coppie']),
                         'morso': round(st.mean(v['coppie']), 5)})
    return {'per_gara': per_gara, 'circuiti': circuiti, 'scartati': scartati,
            'min_coppie_per_circuito': min_coppie, 'H': H, 'gap_max': gap_max}


def deriva_tolleranza(circuiti, n_resample, seed):
    """La tolleranza NON e' un k scelto a occhio: e' il quantile 95 della distribuzione
    NULLA del vero statistico del test — |media(morso) su A - media(morso) su B| per
    partizioni CASUALI dei circuiti. k viene poi RICAVATO, non deciso."""
    valori = [c['morso'] for c in circuiti]
    n = len(valori)
    s = st.stdev(valori)
    rng = random.Random(seed)
    m = n // 2
    delta = []
    for _ in range(n_resample):
        v = valori[:]
        rng.shuffle(v)
        delta.append(abs(st.mean(v[:m]) - st.mean(v[m:])))
    delta.sort()
    q95 = delta[int(.95 * len(delta))]
    # errore standard atteso della differenza fra due medie di blocchi indipendenti
    se_bilanciata = s * (1 / m + 1 / (n - m)) ** .5
    k = q95 / se_bilanciata
    # controllo su partizioni SBILANCIATE: la regola deve reggere anche li'
    controlli = []
    for n1 in (max(3, n // 4), n // 3, m):
        n2 = n - n1
        dd = []
        for _ in range(n_resample // 5):
            v = valori[:]
            rng.shuffle(v)
            dd.append(abs(st.mean(v[:n1]) - st.mean(v[n1:])))
        dd.sort()
        atteso = k * s * (1 / n1 + 1 / n2) ** .5
        controlli.append({'n1': n1, 'n2': n2, 'q95_empirico': round(dd[int(.95 * len(dd))], 5),
                          'regola_prevede': round(atteso, 5)})
    return {'n_circuiti': n, 'media_morso': round(st.mean(valori), 5),
            'mediana_morso': round(st.median(valori), 5),
            'sd_fra_circuiti': round(s, 5),
            'min': round(min(valori), 5), 'max': round(max(valori), 5),
            'q95_partizione_bilanciata': round(q95, 5),
            'se_bilanciata': round(se_bilanciata, 5), 'k_ricavato': round(k, 4),
            'controlli_sbilanciati': controlli, 'n_resample': n_resample, 'seed': seed}


def verifica_anticircolarita(mis, panel):
    """Nessun dato 2026 puo' essere entrato: si controllano i percorsi effettivi."""
    anni = sorted({g['anno'] for g in mis['per_gara']})
    percorsi_2026 = [g['percorso'] for g in mis['per_gara'] if '2026' in g['percorso']]
    circuiti_storici = {c['circuito'] for c in mis['circuiti']}
    return {
        'anni_usati': anni,
        'nessun_2026': not percorsi_2026 and '2026' not in anni,
        'percorsi_2026_trovati': percorsi_2026,
        'panel_2026': panel,
        'nota': ('i circuiti del panel possono comparire QUI nella loro versione storica '
                 '2023-2025: e\' un altro regime (altra macchina), non contaminazione del '
                 'confirm 2026. Cio\' che conta e\' che nessun file 2026 sia entrato.'),
        'circuiti_storici_omonimi_del_panel': sorted(circuiti_storici & set(panel)),
    }
