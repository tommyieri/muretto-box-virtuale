"""ai_lab/distruttore/distruttore.py — IL DISTRUTTORE.

Riceve una rivendicazione di miglioramento e prova a UCCIDERLA per via statistica su un
panel ostile. Deterministico: nessun LLM, nessuna autovalutazione, nessuna introspezione.
La confidenza e' una statistica MISURATA.

CONFINI
  - non tocca engine/engine.py: i candidati sono OVERLAY, cioe' parametrizzazioni del
    motore congelato (TrafficModel(ZONE,STRENGTH,track), pitLoss di evaluatePit);
  - non duplica logica: il kernel lo parla tramite auditor/tools + engine, il pit-loss
    tramite att6_silverstone.mjs (riprodotto, non riscritto);
  - scrive unicamente dentro ai_lab/distruttore/.

SPAZIO DI MISURA
  Mai cum_time grezzi: il kernel lavora a serbatoio vuoto e non re-inflaziona il
  carburante. Per il traffico si misura il GAP fra due auto sullo stesso giro, che e'
  fuel-NEUTRO per costruzione (il termine carburante e' identico per le due auto e si
  elide nella differenza). Per il pit-loss si misura la posizione di rientro, che e'
  un rango e non un tempo.

I CINQUE VETI SONO CONGIUNTIVI: KILLED se anche uno fallisce.
"""
import hashlib
import json
import os
import random
import re
import statistics as st
import subprocess
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(QUI)
RADICE = os.path.dirname(LAB)
for _p in (LAB, RADICE, os.path.join(RADICE, 'engine')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import engine                                   # kernel congelato, sola lettura
from auditor import tools                       # riuso: risoluzione gare, elenco, hash motore

PREREG = os.path.join(QUI, 'PREREG_distruttore.json')


# ---------------------------------------------------------------- prereg + sigillo
def carica_prereg():
    with open(PREREG) as f:
        return json.load(f)


# Ambito del sigillo operativo: SOLO i criteri di veto. Non il file intero.
# Il sigillo v1 copriva tutto, quindi qualunque aggiunta — anche puramente additiva, come
# la tolleranza-partizione — lo rompeva: un anti-HARKing che vieta di aggiungere e' un
# anti-HARKing rotto. Qui si firma cio' che deve restare immobile, non il contenitore.
CHIAVI_CRITERI = ('veto_congiuntivo', 'statistica', 'misura', 'EPS_TIE',
                  'test_di_accettazione', 'panel_ostile', 'regimi',
                  'contratto_ingresso', 'kernel_atteso')
COMMIT_SIGILLO_V1 = 'd3fceb0'


def _sigilla(nucleo):
    """Stesso meccanismo del designer: sha256 del nucleo scientifico, json ordinato.
    Convenzione condivisa deliberatamente, cosi' i due sigilli sono confrontabili."""
    return 'sha256:' + hashlib.sha256(
        json.dumps(nucleo, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]


def verifica_sigillo():
    """Sigillo OPERATIVO: copre i soli criteri di veto."""
    p = carica_prereg()
    mancanti = [k for k in CHIAVI_CRITERI if k not in p]
    nucleo = {k: p[k] for k in CHIAVI_CRITERI if k in p}
    depositato = p.get('sigillo_criteri')
    ricalcolato = _sigilla(nucleo)
    return {'integro': depositato == ricalcolato and not mancanti,
            'depositato': depositato, 'ricalcolato': ricalcolato,
            'ambito': list(CHIAVI_CRITERI), 'chiavi_mancanti': mancanti}


def verifica_sigillo_v1_storico():
    """Il sigillo v1 si riferisce alla definizione FILE INTERO con cui nacque il commit
    d3fceb0. Non e' ricalcolabile dal file di oggi — e non deve esserlo: si verifica
    contro la versione che ha firmato. La storia non si riscrive, si controlla."""
    dichiarato = carica_prereg().get('sigillo_v1_file_intero')
    r = subprocess.run(['git', 'show', f'{COMMIT_SIGILLO_V1}:ai_lab/distruttore/'
                                       'PREREG_distruttore.json'],
                       cwd=RADICE, capture_output=True, text=True)
    if r.returncode != 0:
        return {'verificabile': False, 'motivo': 'commit d3fceb0 non raggiungibile',
                'dichiarato': dichiarato}
    p = json.loads(r.stdout)
    depositato = p.pop('sigillo', None)
    return {'verificabile': True, 'commit': COMMIT_SIGILLO_V1, 'dichiarato': dichiarato,
            'depositato_allora': depositato, 'ricalcolato_allora': _sigilla(p),
            'integro': depositato == _sigilla(p) == dichiarato}


# ---------------------------------------------------------------- tolleranza-partizione
def valida_partizione(riv, morsi_partizione):
    """CANCELLO DI PARTIZIONE — si applica PRIMA di entrare nel merito del KPI.

    Un investigatore potrebbe proporre un confirm scelto dove l'overlay morde poco: il KPI
    ci sembrerebbe stabile per pura selezione (malattia di ATT6 v2). Il test e' di
    taglia-effetto: |media(morso su explore) - media(morso su confirm)| non deve superare
    la tolleranza ricalcolata alle taglie effettive dalla nulla storica.

    AGGIUNTA STRETTAMENTE ADDITIVA e a senso unico: un cancello di RIFIUTO puo' solo rendere
    il Distruttore piu' severo, mai piu' permissivo. Non puo' favorire chi lo attraversa.
    `giudica()` non e' toccata: resta la funzione committata in 62049bf/964472b.
    """
    part = riv.get('partizione')
    if not part or not part.get('explore') or not part.get('confirm'):
        return {'passa': False, 'motivo': 'rivendicazione senza partizione explore/confirm'}
    ex, co = part['explore'], part['confirm']
    comuni = sorted(set(ex) & set(co))
    if comuni:
        return {'passa': False, 'motivo': f'explore e confirm si sovrappongono: {comuni}',
                'explore': ex, 'confirm': co}
    mancanti = [g for g in ex + co if g not in morsi_partizione]
    if mancanti:
        return {'passa': False, 'motivo': f'morso non misurato per: {mancanti}'}

    me = st.mean([morsi_partizione[g] for g in ex])
    mc = st.mean([morsi_partizione[g] for g in co])
    delta = abs(me - mc)
    tol = tolleranza_partizione(len(ex), len(co))
    return {'passa': delta <= tol['tolleranza_s'],
            'delta_taglia_effetto_s': round(delta, 5),
            'morso_medio_explore_s': round(me, 5), 'morso_medio_confirm_s': round(mc, 5),
            'tolleranza_s': tol['tolleranza_s'], 'taglie': f"{len(ex)}/{len(co)}",
            'seed': tol['seed'], 'riassegnazioni': tol['riassegnazioni'],
            'quantile': tol['quantile'],
            'explore': ex, 'confirm': co,
            'nota': ('tolleranza ricalcolata alle taglie effettive dalla nulla storica '
                     '2023-2025; se il delta la supera, il confirm e\' stato scelto dove il '
                     'fenomeno e\' ridotto e non si entra nel merito del KPI')}


def giudica_rivendicazione(riv, morsi_partizione):
    """Percorso completo: prima il cancello di partizione, poi — solo se passa — i cinque
    veti di giudica(), che resta invariata."""
    vp = valida_partizione(riv, morsi_partizione)
    if not vp['passa']:
        return {'rivendicazione': riv['id'], 'modulo': riv['modulo'],
                'verdetto': 'PARTIZIONE RIFIUTATA', 'validazione_partizione': vp,
                'veti': None, 'nota': 'non si entra nel merito del KPI'}
    v = giudica(riv)
    v['validazione_partizione'] = vp
    return v


def morsi_storici():
    with open(os.path.join(QUI, 'morsi_storici_2023_2025.json')) as f:
        return json.load(f)


def tolleranza_partizione(n1, n2, morsi=None, regola=None):
    """Tolleranza ESATTA per le taglie effettive di una partizione explore/confirm.

    Non una forma chiusa con k fisso: si costruisce la distribuzione NULLA del vero
    statistico del test — |media(morso su A) - media(morso su B)| per riassegnazioni
    casuali dei circuiti storici a quelle taglie — e se ne prende il quantile dichiarato.
    Seed, numero di riassegnazioni e quantile sono committati nel prereg: senza quelli la
    soglia "esatta" sarebbe riproducibile solo in media, che non basta."""
    R = regola or carica_prereg()['tolleranza_partizione']['regola_operativa']
    M = morsi or morsi_storici()
    valori = [c['morso'] for c in M['circuiti']]
    if n1 < 1 or n2 < 1 or n1 + n2 > len(valori):
        raise ValueError(f'taglie non ammissibili: {n1}+{n2} su {len(valori)} circuiti storici')
    rng = random.Random(R['seed'])
    nulla = []
    for _ in range(R['riassegnazioni']):
        v = valori[:]
        rng.shuffle(v)
        nulla.append(abs(st.mean(v[:n1]) - st.mean(v[n1:n1 + n2])))
    nulla.sort()
    return {'n1': n1, 'n2': n2, 'tolleranza_s': round(nulla[int(R['quantile'] * len(nulla))], 5),
            'seed': R['seed'], 'riassegnazioni': R['riassegnazioni'], 'quantile': R['quantile'],
            'n_circuiti_storici': len(valori), 'deterministica': True}


# ---------------------------------------------------------------- verifiche kernel
def stato_kernel():
    P = carica_prereg()['kernel_atteso']
    h = tools.versione_motore().split(':')[1]
    c = subprocess.run(['git', 'log', '-1', '--format=%H', '--', 'engine/engine.py'],
                       cwd=RADICE, capture_output=True, text=True).stdout.strip()[:8]
    sporco = subprocess.run(['git', 'status', '--porcelain', 'engine/engine.py'],
                            cwd=RADICE, capture_output=True, text=True).stdout.strip()
    return {'content_hash': h, 'atteso_hash': P['content_hash'], 'hash_ok': h == P['content_hash'],
            'ultimo_commit': c, 'atteso_commit': P['ultimo_commit'],
            'commit_ok': c == P['ultimo_commit'], 'pulito': sporco == ''}


def _node(script, cwd=RADICE):
    r = subprocess.run(['node', script], cwd=cwd, capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


def golden_kernel():
    rc, out = _node('test_b.mjs')
    m = re.search(r'\((\d+)/(\d+)', out)
    return {'passa': rc == 0 and bool(m) and m.group(1) == m.group(2),
            'esito': m.group(0)[1:] if m else '?', 'rc': rc}


def golden_pit():
    rc, out = _node('test_pit.mjs', cwd=os.path.join(RADICE, 'demo'))
    m = re.search(r'(\d+)/(\d+) casi', out)
    return {'passa': rc == 0 and bool(m) and m.group(1) == m.group(2),
            'esito': m.group(1) + '/' + m.group(2) if m else '?', 'rc': rc}


# ---------------------------------------------------------------- statistica
def permutazione_appaiata(diff, n_perm, seed):
    """Permutation null appaiato per inversione di segno. Esaustivo quando 2^n <= n_perm.

    p_min NON e' 1/2^n: una differenza NULLA e' invariante al segno, quindi 2^k
    permutazioni (k = numero di zeri) restano legate al massimo. Ignorarlo fa apparire
    "non abbastanza estremo" un risultato che invece E' il piu' estremo possibile.
    Ritorna: p osservata, p minima realmente raggiungibile, esaustivo, piu_estremo."""
    n = len(diff)
    if n == 0:
        return 1.0, 1.0, False, False
    oss = st.mean(diff)
    if 2 ** n <= n_perm:
        medie = [st.mean([d if (m >> i) & 1 else -d for i, d in enumerate(diff)])
                 for m in range(2 ** n)]
        massimo = max(medie)
        p = sum(1 for x in medie if x >= oss - 1e-12) / 2 ** n
        p_min = sum(1 for x in medie if x >= massimo - 1e-12) / 2 ** n
        return p, p_min, True, abs(oss - massimo) < 1e-12
    rng = random.Random(seed)
    conta = sum(1 for _ in range(n_perm)
                if st.mean([d if rng.random() < .5 else -d for d in diff]) >= oss - 1e-12)
    p_min = 2 ** sum(1 for d in diff if d == 0) / 2 ** n
    massimo = st.mean([abs(d) for d in diff])
    return ((conta + 1) / (n_perm + 1), max(p_min, 1 / (n_perm + 1)), False,
            abs(oss - massimo) < 1e-12)


def bootstrap_blocchi(blocchi, n_boot, seed):
    """Bootstrap a BLOCCHI INDIPENDENTI: si ricampionano i blocchi (gare/casi), mai le
    singole osservazioni, che dentro una gara sono correlate."""
    if not blocchi:
        return None, None
    rng = random.Random(seed)
    medie = []
    for _ in range(n_boot):
        camp = [rng.choice(blocchi) for _ in blocchi]
        vals = [x for b in camp for x in b]
        if vals:
            medie.append(st.mean(vals))
    if not medie:
        return None, None
    medie.sort()
    return (round(medie[int(.025 * len(medie))], 5),
            round(medie[min(len(medie) - 1, int(.975 * len(medie)))], 5))


# ---------------------------------------------------------------- misura: TRAFFICO
def _byLap(stati):
    b = {}
    for s in stati:
        for d, c in s.cars.items():
            b.setdefault(c.lap, {})[d] = c
    return b


def misura_traffico(gara, ZONE, STRENGTH, H, gap_max, cache={}, percorso=None):
    """Errore assoluto sul GAP previsto dopo H giri, per ogni coppia adiacente al freeze.
    Il gap fra due auto sullo stesso giro e' fuel-neutro: il carburante si elide.

    `percorso` (additivo, default None) permette di puntare a un Race.json qualunque —
    serve al regime storico 2023-2025, che non passa da tools.risolvi_gara (che conosce
    solo le gare 2026 pubblicate). Con percorso=None il comportamento e' identico a prima."""
    chiave = percorso or gara
    if chiave not in cache:
        rel = percorso if percorso else tools.risolvi_gara(gara)[1]
        import pandas as pd
        raw = pd.DataFrame(json.load(open(os.path.join(RADICE, rel))))
        stati, N = engine.ti_adapter(raw, gara)
        cache[chiave] = (stati, N, _byLap(stati))
    stati, N, byLap = cache[chiave]

    kern = engine.SimulationKernel()
    fuori = []
    for L in range(4, N - H + 1):
        if L not in byLap or (L + H) not in byLap:
            continue
        pm = engine.PaceModel(stati, N, L)
        st0 = stati[L - 1]
        fin = kern.run(st0, [pm, engine.TrafficModel(ZONE=ZONE, STRENGTH=STRENGTH),
                             engine.AdvanceModel()], H)
        # piloti validi: niente pit/neutralizzazioni nella finestra, cum_time e pace presenti
        validi = []
        for d, c in byLap[L].items():
            if c.cum_time is None or pm.pace.get(d) is None:
                continue
            if d not in byLap[L + H] or byLap[L + H][d].cum_time is None:
                continue
            if any(d in byLap[k] and (byLap[k][d].in_lap or byLap[k][d].out_lap
                                      or byLap[k][d].neutralized)
                   for k in range(L, L + H + 1) if k in byLap):
                continue
            if d not in fin.cars or fin.cars[d].cum_time is None:
                continue
            validi.append(d)
        ordinati = sorted(validi, key=lambda d: byLap[L][d].cum_time)
        for i in range(1, len(ordinati)):
            f, lead = ordinati[i], ordinati[i - 1]
            gap0 = byLap[L][f].cum_time - byLap[L][lead].cum_time
            if gap0 <= 0 or gap0 >= gap_max:
                continue
            gap_obs = byLap[L + H][f].cum_time - byLap[L + H][lead].cum_time
            gap_sim = fin.cars[f].cum_time - fin.cars[lead].cum_time
            fuori.append({'gara': gara, 'freeze': L, 'inseguitore': f, 'battistrada': lead,
                          'gap0': round(gap0, 3), 'errore': abs(gap_sim - gap_obs)})
    return fuori


def confronto_traffico(gara, base, cand, H, gap_max):
    """Errori appaiati baseline vs candidato sulle STESSE coppie."""
    a = misura_traffico(gara, base['ZONE'], base['STRENGTH'], H, gap_max)
    b = misura_traffico(gara, cand['ZONE'], cand['STRENGTH'], H, gap_max)
    idx = {(x['freeze'], x['inseguitore'], x['battistrada']): x for x in b}
    coppie = []
    for x in a:
        k = (x['freeze'], x['inseguitore'], x['battistrada'])
        if k in idx:
            coppie.append({**x, 'err_base': x['errore'], 'err_cand': idx[k]['errore'],
                           'migliora': x['errore'] - idx[k]['errore']})
    return coppie


# ---------------------------------------------------------------- misura: PIT-LOSS
def misura_pitloss_silverstone():
    """Riproduce att6_silverstone.mjs e ne estrae gli errori appaiati per caso.
    Non riscrive il criterio: lo esegue."""
    rc, out = _node('att6_silverstone.mjs')
    casi = []
    for riga in out.splitlines():
        m = re.search(r'^(\w{3}) pit giro (\d+).*err (\d+)->(\d+)', riga.strip())
        if m:
            eb, ec = int(m.group(3)), int(m.group(4))
            casi.append({'caso': f'{m.group(1)} pit {m.group(2)}', 'err_base': eb,
                         'err_cand': ec, 'migliora': eb - ec})
    return casi, rc, out


# ---------------------------------------------------------------- i cinque veti
def _veto_a(riv, P):
    """GOLDEN / invarianza: dove l'overlay non deve cambiare nulla, differenza ESATTAMENTE 0."""
    if riv['modulo'] == 'traffico':
        # Il traffico si propaga a CATENA su tutto il campo: una coppia in aria libera al
        # freeze puo' comunque essere spostata da un'auto piu' avanti che e' in scia.
        # L'invariante corretto usa come riferimento la simulazione SENZA traffico
        # (ZONE=0, che non si attiva mai): i casi dove il cap non ha MAI morso — nemmeno
        # con la zona piu' ampia dei due e alla forza massima — devono restare bit-identici.
        H = P['misura']['traffico']['orizzonte_H']
        zmax = max(riv['overlay']['ZONE'], riv['baseline']['ZONE'])
        peggiore, n = 0.0, 0
        for gara in P['panel_ostile']['circuiti'][:2]:      # due circuiti bastano: e' bit-level
            sen = {(x['freeze'], x['inseguitore'], x['battistrada']): x['errore']
                   for x in misura_traffico(gara, 0.0, 1.0, H, 60.0)}          # mai attivo
            lim = {(x['freeze'], x['inseguitore'], x['battistrada']): x['errore']
                   for x in misura_traffico(gara, zmax, 1.0, H, 60.0)}         # zona piu' ampia
            a = misura_traffico(gara, riv['baseline']['ZONE'], riv['baseline']['STRENGTH'], H, 60.0)
            b = {(x['freeze'], x['inseguitore'], x['battistrada']): x['errore']
                 for x in misura_traffico(gara, riv['overlay']['ZONE'],
                                          riv['overlay']['STRENGTH'], H, 60.0)}
            for x in a:
                k = (x['freeze'], x['inseguitore'], x['battistrada'])
                if k in sen and k in lim and k in b and sen[k] == lim[k]:
                    # il cap non morde nemmeno alla zona piu' ampia: deve essere no-op
                    peggiore = max(peggiore, abs(x['errore'] - b[k]))
                    n += 1
        return {'passa': peggiore == 0.0 and n > 0, 'max_diff_dove_traffico_non_morde': peggiore,
                'n_casi_invarianti': n,
                'nota': 'riferimento = simulazione senza traffico (ZONE=0); dove il cap non '
                        'morde nemmeno con la zona piu\' ampia, l\'overlay deve essere no-op'}
    gk, gp = golden_kernel(), golden_pit()
    return {'passa': gk['passa'] and gp['passa'], 'golden_kernel': gk['esito'],
            'golden_pit': gp['esito'],
            'nota': 'overlay pit-loss: Pace/Advance non toccati, i golden restano validi'}


def _veto_b(blocchi, P):
    """REPLICA OUT-OF-SAMPLE: il KPI si ripresenta fuori dall'explore."""
    S = P['statistica']
    diff = [st.mean(b) for b in blocchi if b]
    if not diff:
        return {'passa': False, 'motivo': 'nessun blocco out-of-sample misurabile'}
    p, p_min, esaustivo, piu_estremo = permutazione_appaiata(diff, S['n_perm'], S['seed'])
    lo, hi = bootstrap_blocchi([b for b in blocchi if b], S['n_boot'], S['seed'])
    media = st.mean(diff)
    alpha = S['alpha']
    if p_min > alpha:
        # regola di POTENZA MINIMA RAGGIUNGIBILE, dichiarata nel prereg.
        # "p osservata == minima raggiungibile" significa: risultato PIU' ESTREMO POSSIBILE.
        # Si verifica direttamente, cosi' i pareggi da differenza nulla non lo mascherano.
        migliorati = sum(1 for d in diff if d > 0)
        peggiorati = sum(1 for d in diff if d < 0)
        legge = migliorati >= (2 * len(diff) + 2) // 3 and peggiorati == 0
        passa = media > 0 and piu_estremo and legge
        regola = (f'potenza minima: p_min={p_min:.4f} > alpha={alpha}. Serve il risultato '
                  f'piu\' estremo possibile E >=2/3 migliorati con 0 peggiorati. Osservato: '
                  f'p={p:.4f} (= p_min), piu_estremo={piu_estremo}, migliorati '
                  f'{migliorati}/{len(diff)}, peggiorati {peggiorati}')
    else:
        passa = media > 0 and p <= alpha
        regola = f'p={p:.4f} vs alpha={alpha}'
    return {'passa': passa, 'media_miglioramento': round(media, 5), 'p': round(p, 5),
            'p_min_raggiungibile': round(p_min, 5), 'esaustivo': esaustivo,
            'piu_estremo_possibile': piu_estremo,
            'ci95_bootstrap': [lo, hi], 'n_blocchi': len(diff), 'regola': regola}


def _veto_c(per_caso):
    """NESSUN CASO SENSIBILE PEGGIORA. Un solo peggioramento -> KILLED."""
    peggiorati = [k for k, v in per_caso.items() if v < 0]
    return {'passa': not peggiorati, 'peggiorati': peggiorati,
            'per_caso': {k: round(v, 5) for k, v in per_caso.items()},
            'nota': 'legge del progetto: un solo caso sensibile peggiorato uccide'}


def _veto_d(riv, P):
    """REGIME: l'evidenza deve dichiarare da che lato del confine viene."""
    reg = riv.get('regime')
    ok = reg in ('2026', 'pre_2026')
    cross = riv.get('cross_regime', False)
    if cross and not riv.get('transfer_per_circuito'):
        return {'passa': False, 'regime': reg,
                'motivo': 'rivendica cross-regime senza transfer per-circuito: un offset '
                          'globale storico->2026 sarebbe sbagliato'}
    return {'passa': ok, 'regime': reg, 'cross_regime': cross,
            'nota': f'evidenza interamente dal regime {reg}; nessun offset globale assunto'}


def _veto_e(media, P):
    """NON E' UN PAREGGIO."""
    eps = P['EPS_TIE']
    return {'passa': abs(media) > eps and media > 0, 'media': round(media, 5), 'eps_tie': eps,
            'nota': 'un tie non e\' vittoria'}


# ---------------------------------------------------------------- giudizio
def giudica(riv):
    """Applica i cinque veti congiuntivi. Ritorna il verdetto con l'evidenza."""
    P = carica_prereg()
    panel = P['panel_ostile']['circuiti']
    Mt = P['misura']['traffico']

    if riv['modulo'] == 'traffico':
        blocchi, per_caso, sensibili = [], {}, []
        for gara in panel:
            coppie = confronto_traffico(gara, riv['baseline'], riv['overlay'],
                                        Mt['orizzonte_H'], Mt['gap_max_inclusione_s'])
            if len(coppie) < Mt['min_coppie_per_circuito']:
                per_caso[gara] = 0.0
                continue
            d = [c['migliora'] for c in coppie]
            blocchi.append(d)
            per_caso[gara] = st.mean(d)
            sensibili += [c['migliora'] for c in coppie if c['gap0'] < Mt['gap_sensibile_s']]
        tutte = [x for b in blocchi for x in b]
        media = st.mean(tutte) if tutte else 0.0
        veti = {'a_golden': _veto_a(riv, P), 'b_replica_oos': _veto_b(blocchi, P),
                'c_nessun_peggioramento': _veto_c(per_caso), 'd_regime': _veto_d(riv, P),
                'e_non_pareggio': _veto_e(media, P)}
        dettaglio = {'n_coppie': len(tutte), 'n_coppie_sensibili': len(sensibili),
                     'media_su_sensibili': round(st.mean(sensibili), 5) if sensibili else None,
                     'blocchi': 'gare del panel'}
    else:                                                     # pit-loss circuito-specifico
        casi, rc, out = misura_pitloss_silverstone()
        blocchi = [[c['migliora']] for c in casi]             # blocco = caso dichiarato a priori
        per_caso = {c['caso']: c['migliora'] for c in casi}
        tutte = [c['migliora'] for c in casi]
        media = st.mean(tutte) if tutte else 0.0
        fuori_panel = riv['circuito'] not in panel
        veti = {'a_golden': _veto_a(riv, P), 'b_replica_oos': _veto_b(blocchi, P),
                'c_nessun_peggioramento': _veto_c(per_caso), 'd_regime': _veto_d(riv, P),
                'e_non_pareggio': _veto_e(media, P)}
        veti['a_golden']['circuito_fuori_panel'] = fuori_panel
        if not fuori_panel:
            veti['a_golden']['passa'] = False
        dettaglio = {'n_casi': len(casi), 'att6_rc': rc, 'blocchi': 'casi dichiarati a priori',
                     'circuito': riv['circuito'], 'fuori_dal_panel': fuori_panel}

    falliti = [k for k, v in veti.items() if not v['passa']]
    return {'rivendicazione': riv['id'], 'modulo': riv['modulo'],
            'verdetto': 'KILLED' if falliti else 'SURVIVES',
            'veti_falliti': falliti, 'veti': veti, 'dettaglio': dettaglio,
            'regime_evidenza': riv.get('regime'),
            'margine': None if falliti else {
                'media_miglioramento': veti['b_replica_oos'].get('media_miglioramento'),
                'p_permutazione': veti['b_replica_oos'].get('p'),
                'ci95_bootstrap_blocchi': veti['b_replica_oos'].get('ci95_bootstrap')}}
