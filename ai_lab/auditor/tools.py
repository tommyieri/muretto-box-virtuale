"""ai_lab/auditor/tools.py — STRATO NUMERICO dell'Auditor. Solo Python, mai LLM.

CONFINE NON NEGOZIABILE
  Questo modulo LEGGE il motore congelato e i dati reali. Non scrive nulla in
  engine/, demo/, data/. Non reimplementa la fisica: la importa.

RIUSO (nessuna logica duplicata)
  - engine/engine.py      : ti_adapter (stato per giro), pace_base (passo del motore),
                            FUEL_COEFF (correzione carburante), FILES/FOLDER (mappa gare).
  - test_identificabilita_degrado.py : carica + pulisci (F1-F6) + filtro_outlier (F7),
                            SLICK, SOGLIA_OUTLIER — l'igiene gia' validata del progetto.
  - gen_replay_perdita_stint.py      : SOGLIA_ARIA = 2.0 s (definizione di "aria pulita"),
                            qui ripresa come SOGLIA_TRAFFICO con lo stesso valore e senso.

IL CONFRONTO (metodo, dichiarato prima dei numeri)
  Il motore simula un passo COSTANTE per stint: PaceModel tiene fermo pace_base
  (giro a serbatoio vuoto), Advance lo somma a ogni giro. La realta' invece degrada,
  incontra traffico e alleggerisce il serbatoio.

  Confrontare cum_time grezzo con la simulazione sarebbe SBAGLIATO: il kernel lavora a
  serbatoio vuoto e non re-inflaziona il carburante, quindi il residuo assoluto porta
  ~2 s/giro di carburante e coprirebbe ogni altro effetto. Percio' il confronto avviene
  nello spazio FUEL-CORRETTO del motore: al tempo osservato si applica la STESSA
  correzione che pace_base applica (coefficiente importato dal motore), e lo si confronta
  con la previsione costante del motore fissata all'inizio dello stint.

      residuo(giro) = tempo_osservato_fuel_corretto - pace_base(al freeze)

  Residuo > 0 = la realta' e' piu' lenta di quanto il motore simuli.
  Il residuo isola cio' che il motore NON modella: degrado, traffico, rumore.
"""
import hashlib
import json
import os
import statistics as st
import sys

import numpy as np

RADICE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
for _p in (RADICE, os.path.join(RADICE, 'engine')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import engine                                                    # il kernel congelato
from test_identificabilita_degrado import (                      # igiene gia' validata
    SLICK, SOGLIA_OUTLIER, carica, filtro_outlier, pulisci,
)

# ---------------------------------------------------------------- soglie dichiarate
SOGLIA_TRAFFICO = 2.0    # s — gap all'auto davanti sotto cui il giro e' "in traffico"
MIN_GIRI_STINT = 8       # giri puliti minimi perche' uno stint sia analizzabile
N_FREEZE = 3             # giri iniziali che fissano la previsione del motore (min. di pace_base)
SOGLIA_DEGRADO = 0.03    # s/giro — pendenza residuo~eta-gomma oltre cui si sospetta degrado
ETA_BASSA = 6            # eta' gomma sotto cui il giro serve a stimare il rumore
FRAZ_TRAFFICO = 0.50     # frazione di giri in traffico oltre cui si sospetta il traffico

COMPONENTI = ('degrado', 'traffico', 'pit_lane', 'warm_up', 'safety_car',
              'dati_mancanti', 'rumore', 'non_classificabile')

# gare oltre le 8 mappate nel kernel (il kernel resta la fonte, qui si estende soltanto)
_EXTRA_FOLDER = {'Belgio': 'Belgian Grand Prix', 'Gran Bretagna': 'British Grand Prix'}
_ALIAS = {
    'australia': 'Australia', 'australian': 'Australia', 'melbourne': 'Australia',
    'cina': 'Cina', 'china': 'Cina', 'chinese': 'Cina', 'shanghai': 'Cina',
    'giappone': 'Giappone', 'japan': 'Giappone', 'japanese': 'Giappone', 'suzuka': 'Giappone',
    'miami': 'Miami',
    'canada': 'Canada', 'canadian': 'Canada', 'montreal': 'Canada',
    'monaco': 'Monaco', 'montecarlo': 'Monaco',
    'spagna': 'Spagna', 'spain': 'Spagna', 'spanish': 'Spagna',
    'barcellona': 'Spagna', 'barcelona': 'Spagna', 'catalunya': 'Spagna',
    'austria': 'Austria', 'austrian': 'Austria', 'spielberg': 'Austria',
    'belgio': 'Belgio', 'belgium': 'Belgio', 'belgian': 'Belgio', 'spa': 'Belgio',
    'granbretagna': 'Gran Bretagna', 'gran bretagna': 'Gran Bretagna',
    'britain': 'Gran Bretagna', 'greatbritain': 'Gran Bretagna', 'great britain': 'Gran Bretagna',
    'british': 'Gran Bretagna', 'uk': 'Gran Bretagna', 'silverstone': 'Gran Bretagna',
}


# ---------------------------------------------------------------- provenienza / gare
def versione_motore():
    """Impronta del kernel auditato. Se il motore cambia, i dossier restano tracciabili."""
    h = hashlib.sha256(open(os.path.join(RADICE, 'engine', 'engine.py'), 'rb').read())
    return 'sha256:' + h.hexdigest()[:12]


def _cartella(gara):
    return dict(engine.FOLDER, **_EXTRA_FOLDER).get(gara)


def _percorsi(gara):
    """Sorgenti possibili, in ordine di preferenza: archivio 2026, poi cache del kernel."""
    fuori = []
    cart = _cartella(gara)
    if cart:
        fuori.append(os.path.join(RADICE, 'data', 'ti_archive', '2026', cart, 'Race.json'))
    base = engine.FILES.get(gara)
    if base:
        fuori.append(os.path.join(RADICE, 'data', 'ti_cache', base + '.json'))
    return fuori


def elenco_gare():
    """Gare realmente disponibili su disco (nome demo, sorgente)."""
    fuori = []
    for gara in sorted(set(list(engine.FILES) + list(_EXTRA_FOLDER))):
        for p in _percorsi(gara):
            if os.path.exists(p) and os.path.getsize(p) > 1000:
                fuori.append({'gara': gara, 'fonte': os.path.relpath(p, RADICE)})
                break
    return fuori


def risolvi_gara(query):
    """'Belgium 2026' / 'Spa' / 'Belgio' -> 'Belgio'. Alza ValueError se ambiguo/assente."""
    q = ' '.join(str(query).lower().replace('grand prix', ' ').replace('gp', ' ').split())
    for tok in ('2023', '2024', '2025', '2026'):
        q = q.replace(tok, ' ')
    q = ' '.join(q.split())
    nome = _ALIAS.get(q) or _ALIAS.get(q.replace(' ', ''))
    if not nome:
        raise ValueError(f"gara non riconosciuta: {query!r}. Disponibili: "
                         + ', '.join(g['gara'] for g in elenco_gare()))
    disponibili = {g['gara']: g['fonte'] for g in elenco_gare()}
    if nome not in disponibili:
        raise ValueError(f"'{nome}' riconosciuta ma senza dati su disco. Disponibili: "
                         + ', '.join(disponibili))
    return nome, disponibili[nome]


# ---------------------------------------------------------------- caricamento
def carica_gara(gara):
    """Realta' (righe grezze TI) + vista del motore (stato per giro). Sola lettura."""
    _, rel = risolvi_gara(gara)
    path = os.path.join(RADICE, rel)
    import pandas as pd
    raw = pd.DataFrame(json.load(open(path)))
    stati, N = engine.ti_adapter(raw, gara)            # <- vista del KERNEL
    righe = carica(path)                               # <- righe grezze (igiene validata)
    byLap = {}
    for s in stati:
        for d, c in s.cars.items():
            byLap.setdefault(c.lap, {})[d] = c
    return {'gara': gara, 'fonte': rel, 'n_giri': N, 'stati': stati,
            'byLap': byLap, 'righe': righe}


# ---------------------------------------------------------------- misure
def _fuel_corretto(lap_time, lap, N):
    """Riporta un tempo a serbatoio vuoto. Rispecchia la correzione dentro engine.pace_base,
    con il coefficiente IMPORTATO dal motore (mai una seconda costante)."""
    return lap_time - max(0.0, 70.0 - (70.0 / N) * (lap - 1)) * engine.FUEL_COEFF


def _pendenza(xs, ys):
    if len(xs) < 2 or len(set(xs)) < 2:
        return 0.0
    return float(np.polyfit(np.array(xs, float), np.array(ys, float), 1)[0])


def _gap_davanti(byLap):
    """gap in secondi all'auto immediatamente davanti, sullo stesso giro reale."""
    gap = {}
    for L, cars in byLap.items():
        ordinati = sorted((c.cum_time, d) for d, c in cars.items() if c.cum_time is not None)
        for i, (ct, d) in enumerate(ordinati):
            gap[(L, d)] = None if i == 0 else ct - ordinati[i - 1][0]
    return gap


def _distribuzione(vals):
    if not vals:
        return None
    v = sorted(vals)
    q = lambda p: v[min(len(v) - 1, int(p * len(v)))]
    return {'n': len(v), 'mediana': round(st.median(v), 4), 'q25': round(q(.25), 4),
            'q75': round(q(.75), 4), 'min': round(v[0], 4), 'max': round(v[-1], 4)}


# ---------------------------------------------------------------- analisi
def analizza_gara(gara):
    """Confronta realta' e simulazione del motore e classifica le differenze.
    Ritorna un dict JSON-serializzabile. Nessun giudizio: solo misure + candidati."""
    d = carica_gara(gara)
    N, byLap, righe = d['n_giri'], d['byLap'], d['righe']

    puliti, scarti, _ = pulisci(righe)                          # F1-F6 (importati)
    puliti, n_outlier = filtro_outlier(puliti, SOGLIA_OUTLIER)  # F7 (importato)
    scarti = dict(scarti, F7_outlier=n_outlier)
    gap = _gap_davanti(byLap)

    per_stint = {}
    for r in puliti:
        per_stint.setdefault((r['drv'], int(r['stint'])), []).append(r)

    stint_out, scartati, residui_bassa_eta = [], [], []
    for (drv, stint), giri in sorted(per_stint.items()):
        giri.sort(key=lambda r: int(r['lap']))
        if len(giri) < MIN_GIRI_STINT:
            scartati.append({'drv': drv, 'stint': stint, 'n_giri': len(giri),
                             'motivo': f'meno di {MIN_GIRI_STINT} giri puliti'})
            continue
        freeze = giri[N_FREEZE - 1]
        # previsione del MOTORE: pace_base calcolato dal kernel al giro di freeze
        previsione = engine.pace_base(d['stati'], N, drv, int(freeze['lap']))
        if previsione is None:
            scartati.append({'drv': drv, 'stint': stint, 'n_giri': len(giri),
                             'motivo': 'pace_base non stimabile al freeze'})
            continue
        seguito = giri[N_FREEZE:]
        if not seguito:
            continue

        res, eta, in_traffico = [], [], []
        for r in seguito:
            L = int(r['lap'])
            res.append(_fuel_corretto(r['time'], L, N) - previsione)
            eta.append(int(r['life']))
            g = gap.get((L, drv))
            in_traffico.append(g is not None and g < SOGLIA_TRAFFICO)

        # rumore: residui a gomma ancora giovane, dove il degrado e' minimo (finestra
        # "centrale" nello spirito di gen_replay_perdita_stint) -> stima onesta del fondo
        residui_bassa_eta += [x for x, e in zip(res, eta) if e <= ETA_BASSA]

        med = st.median(res)
        pend = _pendenza(eta, res)
        cum = sum(res)
        fr_traff = sum(in_traffico) / len(in_traffico)
        med_traff = st.median([x for x, t in zip(res, in_traffico) if t]) if any(in_traffico) else None
        med_pulito = st.median([x for x, t in zip(res, in_traffico) if not t]) if not all(in_traffico) else None
        stint_out.append({
            'drv': drv, 'stint': stint, 'compound': giri[0]['compound'],
            'giro_freeze': int(freeze['lap']), 'giro_fine': int(giri[-1]['lap']),
            'n_giri_confrontati': len(res),
            'pace_motore_s': round(previsione, 3),
            'residuo_mediano_s': round(med, 3),
            'perdita_cumulata_s': round(cum, 2),
            'pendenza_s_per_giro': round(pend, 4),
            'eta_gomma_max': max(eta),
            'frazione_giri_in_traffico': round(fr_traff, 2),
            'residuo_mediano_in_traffico_s': None if med_traff is None else round(med_traff, 3),
            'residuo_mediano_aria_pulita_s': None if med_pulito is None else round(med_pulito, 3),
        })

    # ---- rumore: dispersione dei residui a gomma giovane (dichiarato PRIMA dei numeri).
    # Si misura dove il degrado e' ancora minimo, cosi' il fondo non incorpora l'effetto
    # che deve servire a giudicare.
    tutti = [s['residuo_mediano_s'] for s in stint_out]
    if residui_bassa_eta:
        m0 = st.median(residui_bassa_eta)
        rumore = round(st.median([abs(x - m0) for x in residui_bassa_eta]), 3)
    else:
        rumore = 0.0
    rumore = max(rumore, 0.05)   # pavimento minimo dichiarato: 50 ms

    # ---- classificazione (regole deterministiche, dichiarate)
    for s in stint_out:
        med, pend, fr = s['residuo_mediano_s'], s['pendenza_s_per_giro'], s['frazione_giri_in_traffico']
        mt, mp = s['residuo_mediano_in_traffico_s'], s['residuo_mediano_aria_pulita_s']
        coda = pend * s['n_giri_confrontati']
        if abs(med) <= rumore and abs(coda) <= rumore:
            s['componente'] = 'rumore'
            s['perche'] = f"residuo entro il rumore della gara ({rumore:+.3f} s)"
        elif pend >= SOGLIA_DEGRADO and fr >= FRAZ_TRAFFICO:
            # CO-PRESENZA: la gomma invecchia E l'auto e' in coda. Un'auto in treno rallenta
            # col treno esattamente come rallenterebbe degradando: questa misura NON li separa.
            # Dichiararlo e' piu' onesto che assegnare il primo candidato che passa la soglia.
            s['componente'] = 'non_classificabile'
            s['perche'] = (f"degrado e traffico CO-PRESENTI e non separabili: pendenza "
                           f"{pend:+.4f} s/giro ma anche {fr:.0%} dei giri entro "
                           f"{SOGLIA_TRAFFICO}s dall'auto davanti")
        elif pend >= SOGLIA_DEGRADO and coda > rumore:
            s['componente'] = 'degrado'
            s['perche'] = (f"il residuo cresce con l'eta' gomma ({pend:+.4f} s/giro su "
                           f"{s['n_giri_confrontati']} giri): il motore tiene il passo costante")
        elif fr >= FRAZ_TRAFFICO and mt is not None and mp is not None and (mt - mp) > rumore:
            s['componente'] = 'traffico'
            s['perche'] = (f"{fr:.0%} dei giri entro {SOGLIA_TRAFFICO}s dall'auto davanti e li' il "
                           f"residuo e' piu' alto di {mt - mp:+.3f} s che in aria pulita")
        elif fr >= FRAZ_TRAFFICO and mp is None:
            s['componente'] = 'traffico'
            s['perche'] = f"stint interamente in traffico ({fr:.0%} dei giri), nessun confronto in aria pulita"
        else:
            s['componente'] = 'non_classificabile'
            s['perche'] = ("residuo fuori dal rumore ma nessun meccanismo candidato "
                           "(ne' pendenza da degrado, ne' concentrazione in traffico)")

    stint_out.sort(key=lambda s: -abs(s['perdita_cumulata_s']))

    # ---- fatti grezzi a livello di gara (contesto, non residui)
    neut = [(L, drv) for L, cars in byLap.items() for drv, c in cars.items() if c.neutralized]
    inlap = sum(1 for cars in byLap.values() for c in cars.values() if c.in_lap)
    outlap = sum(1 for cars in byLap.values() for c in cars.values() if c.out_lap)
    mancanti = sum(1 for cars in byLap.values() for c in cars.values() if c.lap_time is None)

    conteggi = {k: sum(1 for s in stint_out if s['componente'] == k) for k in COMPONENTI}
    conteggi['dati_mancanti'] = len(scartati)
    per_comp = {}
    for k in COMPONENTI:
        v = [s['perdita_cumulata_s'] for s in stint_out if s['componente'] == k]
        if v:
            per_comp[k] = {'stint': len(v), 'perdita_cumulata_totale_s': round(sum(v), 1),
                           'perdita_mediana_s': round(st.median(v), 2)}

    return {
        'gara': d['gara'],
        'fonte': d['fonte'],
        'versione_motore': versione_motore(),
        'n_giri': N,
        'n_piloti': len({drv for cars in byLap.values() for drv in cars}),
        'metodo': {
            'confronto': ('residuo = tempo osservato fuel-corretto - pace_base del motore '
                          'fissato ai primi %d giri puliti dello stint' % N_FREEZE),
            'perche_fuel_corretto': ('il kernel lavora a serbatoio vuoto e non re-inflaziona il '
                                     'carburante: sul grezzo il residuo porterebbe ~2 s/giro di '
                                     'carburante e coprirebbe ogni altro effetto'),
            'igiene': 'F1-F6 pulisci() + F7 filtro_outlier(%.2f) importati da test_identificabilita_degrado'
                      % SOGLIA_OUTLIER,
            'soglie': {'MIN_GIRI_STINT': MIN_GIRI_STINT, 'N_FREEZE': N_FREEZE,
                       'SOGLIA_TRAFFICO_s': SOGLIA_TRAFFICO, 'SOGLIA_DEGRADO_s_giro': SOGLIA_DEGRADO,
                       'FRAZ_TRAFFICO': FRAZ_TRAFFICO, 'ETA_BASSA': ETA_BASSA,
                       'compound_ammessi': list(SLICK)},
            'limiti_dichiarati': [
                'il motore non modella il pit-stop: il confronto resta DENTRO lo stint',
                'degrado e evoluzione pista non sono separabili da questa misura',
                ('degrado e traffico non sono separabili quando co-presenti: quegli stint '
                 'sono marcati non_classificabile, non assegnati'),
                ('su circuiti a basso sorpasso (es. Monaco) il passo puo\' scendere per '
                 'gestione o treno DRS: la pendenza da sola non prova il degrado'),
                'la classificazione propone un candidato, non stabilisce una causa',
            ],
        },
        'copertura': {
            'giri_grezzi': len(righe), 'giri_puliti': len(puliti), 'scarti_igiene': scarti,
            'stint_analizzati': len(stint_out), 'stint_scartati': len(scartati),
        },
        'rumore': {
            'noise_floor_s': rumore,
            'definizione': ('scarto assoluto mediano dei residui per-giro con eta\' gomma <= %d '
                            '(dove il degrado e\' minimo), pavimento dichiarato 0.05 s; sotto '
                            'questa soglia un residuo non e\' un effetto' % ETA_BASSA),
            'n_giri_usati': len(residui_bassa_eta),
        },
        'residui_complessivi': _distribuzione(tutti),
        'classificazione': {'conteggi': conteggi, 'per_componente': per_comp},
        'differenze': stint_out,
        'stint_scartati': scartati,
        'contesto_gara': {
            'giri_neutralizzati': len(neut),
            'piloti_con_giri_neutralizzati': len({drv for _, drv in neut}),
            'in_lap': inlap, 'out_lap': outlap, 'giri_senza_tempo': mancanti,
            'nota': ('giri neutralizzati, in-lap e out-lap sono ESCLUSI dai residui (F1/F2). '
                     'Sono riportati come contesto: safety_car, pit_lane e warm_up si '
                     'manifestano qui, non nella misura di passo.'),
        },
    }
