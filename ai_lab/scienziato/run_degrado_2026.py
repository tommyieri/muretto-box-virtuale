#!/usr/bin/env python3
"""run_degrado_2026.py — il DEGRADO 2026, dal censimento al cancello di accensione.

    python3 ai_lab/scienziato/run_degrado_2026.py --censimento   # disponibilita' dei dati
    python3 ai_lab/scienziato/run_degrado_2026.py --falsifica    # la regola nuova regge?
    python3 ai_lab/scienziato/run_degrado_2026.py --c1 --c2 --c3
    python3 ai_lab/scienziato/run_degrado_2026.py --tutto

Prereg: PREREG_degrado_2026.md — tutto dichiarato PRIMA dei numeri.
Esce sempre 0: nessun exit-code decide. L'agente porta la X, decidono gli umani.
"""
import argparse
import json
import os
import statistics as st
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)

import degrado as DG
import degrado_verde as DV
import fondo
import scheletro
import sigillo_null

USCITA = os.path.join(QUI, 'esito_degrado_2026.json')

# --- soglie del prereg, tutte dichiarate prima dei numeri
MIN_CASI, MIN_GARE = 30, 4          # §4 numerosita' (adattata al regime: 10 gare -> 5+5)
QUOTA_NETTA = 0.60                  # §4B, identica al prereg madre
FATTORE_MARGINE = 2.0               # §4B, identica al prereg madre
G_STELLA = 1.5                      # §3, ereditata dichiarata da esito_degrado.json


def riga(t):
    print('=' * 96)
    print(t)
    print('=' * 96)


# ---------------------------------------------------------------- il fondo, una volta sola
def costruisci(regime, eta_quadratica=False):
    """Modello per gara dal fondo, col carburante congelato sottratto. Nessuna stima nuova
    di carburante, nessun coefficiente ereditato da altri regimi."""
    fuori = {}
    for b in fondo.elenco_blocchi():
        if b['regime'] != regime:
            continue
        d = DG.prepara(b)
        if d is None:
            continue                       # bagnata
        m = DG.stima(d, eta_quadratica=eta_quadratica)
        fuori[b['id']] = {'dati': d, 'modello': None if 'escluso' in m else m,
                          'motivo': m.get('escluso')}
    return fuori


def con_rho(mod, rho):
    """Il modello della gara con il rho SOSTITUITO da quello che viaggia (PREREG §2).
    alpha, beta, delta restano della gara: sono parametri di disturbo, non trasferibili."""
    m = dict(mod)
    m['rho'] = {c: rho.get(c, mod['rho'][c]) for c in mod['rho']}
    return m


# ---------------------------------------------------------------- (0) CENSIMENTO
def censimento(regime='2026'):
    """Disponibilita' dei dati — eseguito PRIMA del prereg, perche' riguarda i dati e non il
    fenomeno. E' il generatore dei numeri citati in PREREG_degrado_2026.md §0."""
    fuori = []
    for b in fondo.elenco_blocchi():
        if b['regime'] != regime:
            continue
        righe = fondo.carica(b['percorso'])
        n_tot = sum(1 for r in righe if isinstance(r['lap'], (int, float)))
        N = max(int(r['lap']) for r in righe if isinstance(r['lap'], (int, float)))
        neu = [r for r in righe
               if ('4' in str(r['status'])) or ('6' in str(r['status']))]
        giri_neu = sorted({int(r['lap']) for r in neu
                           if isinstance(r['lap'], (int, float))})
        keep, _, _ = fondo.pulisci(righe, soglia_aria=0.0)
        gap = fondo.gap_davanti(righe)
        aria = [r for r in keep
                if gap.get((r['drv'], r['lap'])) is None
                or gap.get((r['drv'], r['lap'])) > DG.GAP_STIMA]
        mesc = {}
        for r in keep:
            mesc[r['compound']] = mesc.get(r['compound'], 0) + 1
        fuori.append({'gara': b['id'], 'bagnata': fondo.bagnato(righe), 'N': N,
                      'giri_totali': n_tot, 'giri_neutralizzati': len(neu),
                      'quota_neutralizzata': round(len(neu) / max(n_tot, 1), 4),
                      'indici_giro_neutralizzati': len(giri_neu),
                      'giri_puliti': len(keep), 'giri_aria_libera': len(aria),
                      'mescole': mesc})
    return fuori


def stampa_censimento(cen):
    print(f"{'gara':26s} {'bagn':6s} {'N':>4s} {'giri':>6s} {'neutr':>6s} {'%neu':>6s} "
          f"{'puliti':>7s} {'aria':>6s}  mescole")
    print('-' * 108)
    for c in cen:
        print(f"{c['gara']:26s} {str(c['bagnata']):6s} {c['N']:4d} {c['giri_totali']:6d} "
              f"{c['giri_neutralizzati']:6d} {100*c['quota_neutralizzata']:6.1f} "
              f"{c['giri_puliti']:7d} {c['giri_aria_libera']:6d}  {c['mescole']}")
    q = [c['quota_neutralizzata'] for c in cen]
    print(f"\n  gare: {len(cen)} | bagnate: {sum(1 for c in cen if c['bagnata'])} | "
          f"con almeno un giro neutralizzato: {sum(1 for c in cen if c['giri_neutralizzati'])}")
    if q:
        print(f"  quota neutralizzata: da {100*min(q):.1f} % a {100*max(q):.1f} %")
        print(f"  => il veto di gara costa {sum(1 for c in cen if c['giri_neutralizzati'])}"
              f"/{len(cen)} gare per proteggersi da {100*min(q):.1f}-{100*max(q):.1f} % di giri")


# ---------------------------------------------------------------- il rho che VIAGGIA
def rho_viaggiante(tab, gare_cal):
    """La mediana cross-gara delle pendenze, dalle SOLE gare di calibrazione (PREREG §2).
    Blocchi = gare. IC95 con scheletro.bootstrap_a_blocchi, che e' SOTTO SIGILLO: la chiamo,
    non la tocco."""
    per_c = {}
    for g in gare_cal:
        m = tab[g]['modello']
        if m is None:
            continue
        for c, v in m['rho'].items():
            per_c.setdefault(c, []).append(v)
    rho, dettaglio = {}, {}
    for c in sorted(per_c):
        v = per_c[c]
        b = scheletro.bootstrap_a_blocchi(v)
        rho[c] = b['mediana'] if b['mediana'] is not None else v[0]
        dettaglio[c] = {'mediana': rho[c], 'ci95': b['ci95'], 'n_gare': len(v),
                        'per_gara': {g: round(tab[g]['modello']['rho'][c], 5)
                                     for g in gare_cal
                                     if tab[g]['modello'] and c in tab[g]['modello']['rho']}}
    return rho, dettaglio


def _pl_gara(d, m, solo_verdi=True):
    """Il pit-loss dal fondo, dalle SOLE soste verdi (PREREG §7-ter). Identico per il modello
    e per il degrado-zero, e identico fra C1 e C3: non inclina nessun confronto appaiato."""
    r = DV.pit_loss_verde(d, m, solo_verdi)
    return None if r is None else r['pit_loss']


def tol_da_cal(tab, gare_cal, rho, cliff=None, solo_verdi=True, veto=False):
    """`tol` = 68o percentile di |sim(reale) - reale| sulle SOLE gare di calibrazione."""
    scarti = []
    for gid in gare_cal:
        t = tab[gid]
        if t['modello'] is None or (veto and t['dati']['neutralizzata']):
            continue
        m = con_rho(t['modello'], rho)
        pl = _pl_gara(t['dati'], m)
        if pl is None:
            continue
        scarti.extend(DV.scarti_calibrazione(t['dati'], m, pl, cliff, solo_verdi).values())
    return DV.tol_da_calibrazione(scarti), len(scarti)


def misura_X(tab, gare_ver, rho, tol, etichetta, cliff=None, solo_verdi=True, veto=False):
    """La X: su quanti casi valutabili in aria libera la strategia ottima batte il reale."""
    casi, esclusi = [], {}
    for gid in gare_ver:
        t = tab[gid]
        if t['modello'] is None:
            esclusi['gara senza modello'] = esclusi.get('gara senza modello', 0) + 1
            continue
        d = t['dati']
        if veto and d['neutralizzata']:
            esclusi['gara neutralizzata (veto)'] = esclusi.get('gara neutralizzata (veto)', 0) + 1
            continue
        m = con_rho(t['modello'], rho)
        pl = _pl_gara(d, m)
        if pl is None:
            esclusi['pit-loss non ricostruibile'] = esclusi.get('pit-loss non ricostruibile', 0) + 1
            continue
        eta_mappa = fondo.stint_ed_eta(d['righe'])
        for drv in sorted(m['alpha']):
            v = DV.valuta_pilota_verde(d, m, drv, pl, G_STELLA, tol, cliff=cliff,
                                       eta_mappa=eta_mappa, solo_verdi=solo_verdi)
            if 'escluso' in v:
                esclusi[v['escluso']] = esclusi.get(v['escluso'], 0) + 1
                continue
            v.update({'gara': gid, 'pilota': drv, 'circuito': d['circuito']})
            casi.append(v)
    vinti = [c for c in casi if c['vince']]
    gare = sorted({c['gara'] for c in casi})
    per_gara = {}
    for g in gare:
        cg = [c for c in casi if c['gara'] == g]
        per_gara[g] = {'n': len(cg), 'vinti': sum(1 for c in cg if c['vince']),
                       'quota': round(sum(1 for c in cg if c['vince']) / len(cg), 4)}
    return {'etichetta': etichetta, 'n_casi': len(casi), 'n_gare': len(gare),
            'n_vinti': len(vinti),
            'quota': round(len(vinti) / len(casi), 4) if casi else None,
            'margine_mediano_vittorie': round(st.median([c['margine'] for c in vinti]), 3)
            if vinti else None,
            'tol': round(tol, 3) if tol else None, 'G_stella': G_STELLA,
            'esclusi': esclusi, 'per_gara': per_gara, 'casi': casi,
            'gare_verifica': sorted(gare_ver)}


def stampa_X(X):
    print(f"  {X['etichetta']}")
    print(f"    casi valutabili {X['n_casi']} su {X['n_gare']} gare | vinti {X['n_vinti']} "
          f"| X = {100*(X['quota'] or 0):.1f} %")
    print(f"    tol = {X['tol']} s | margine mediano delle vittorie = "
          f"{X['margine_mediano_vittorie']} s")
    print(f"    esclusi: {X['esclusi']}")


# ---------------------------------------------------------------- cancello (A) predittivo
def cancello_predittivo(tab, gare_ver, rho, cliff=None):
    """(A) Il modello batte il NON-FARE-NIENTE? Il degrado-zero e' RISTIMATO senza le colonne
    dell'eta (PREREG §7-bis): non un fantoccio con le rho spente a mano.

    Confronto appaiato per gara sull'errore di ricostruzione |sim(reale) - reale|, mediano
    fra i piloti. IC95 con bootstrap_a_blocchi (blocchi = gare, SOTTO SIGILLO)."""
    coppie = []
    for gid in gare_ver:
        t = tab[gid]
        if t['modello'] is None:
            continue
        d = t['dati']
        m = con_rho(t['modello'], rho)
        z = DV.stima_senza_degrado(d)
        if 'escluso' in z:
            continue
        pl = _pl_gara(d, m)
        if pl is None:
            continue
        s_m = DV.scarti_calibrazione(d, m, pl, cliff)
        s_z = DV.scarti_calibrazione(d, z, pl, None)
        com = sorted(set(s_m) & set(s_z))
        if not com:
            continue
        e_m = st.median([s_m[k] for k in com])
        e_z = st.median([s_z[k] for k in com])
        coppie.append({'gara': gid, 'n_piloti': len(com),
                       'errore_modello': round(e_m, 3), 'errore_zero': round(e_z, 3),
                       'guadagno': round(e_z - e_m, 3)})
    if len(coppie) < 2:
        return {'giudicabile': False, 'motivo': f'{len(coppie)} gare', 'coppie': coppie}
    b = scheletro.bootstrap_a_blocchi([c['guadagno'] for c in coppie])
    esclude = bool(b['ci95'] and b['ci95'][0] > 0)
    return {'giudicabile': True, 'coppie': coppie,
            'guadagno_mediano': b['mediana'], 'ci95': b['ci95'], 'n_gare': b['n_blocchi'],
            'esclude_lo_zero': esclude, 'SUPERATO': esclude,
            'criterio': 'errore di ricostruzione minore del degrado-zero RISTIMATO, con '
                        'IC95 appaiato sui blocchi che esclude lo zero'}


# ---------------------------------------------------------------- (2) C2 — dove fallisce
FASCE_ETA = [(3, 9), (10, 14), (15, 19), (20, 24), (25, 29), (30, 99)]


def c2(tab, gare, cal, ver, rho):
    """Dove il lineare fallisce, e la domanda dichiarata nel prereg §5: e' il CLIFF?

    PREDIZIONE FALSIFICABILE (dichiarata prima di guardare): se e' il cliff, il residuo
    mediano (reale - previsto) dev'essere CRESCENTE con l'eta gomma nella coda. Se e' piatto,
    il cliff non c'e' nei dati 2026 e C3 non ha bersaglio.
    """
    # --- (a) il residuo per fascia di ETA', a blocchi = gare
    per_fascia = {f: {} for f in FASCE_ETA}
    for gid in gare:
        t = tab[gid]
        if t['modello'] is None:
            continue
        d = t['dati']
        m = con_rho(t['modello'], rho)
        for r in d['puliti']:
            if r['compound'] not in m['rho']:
                continue
            if r['gap'] is not None and r['gap'] <= DG.GAP_STIMA:
                continue                      # aria libera: il traffico non deve sporcare
            p = DV._passo(m, d, r['drv'], r['lap'], r['compound'], r['eta'])
            if p is None:
                continue
            for f in FASCE_ETA:
                if f[0] <= r['eta'] <= f[1]:
                    per_fascia[f].setdefault(gid, []).append(r['time'] - p)
                    break
    print('  (a) RESIDUO (reale - previsto) per FASCIA DI ETA GOMMA, in aria libera')
    print('      se e il CLIFF, deve CRESCERE nella coda. Blocchi = gare.')
    curva = []
    for f in FASCE_ETA:
        per_gara = [st.median(v) for v in per_fascia[f].values() if len(v) >= 5]
        if len(per_gara) < 3:
            print(f"      eta {f[0]:2d}-{f[1]:2d}   (solo {len(per_gara)} gare: non giudicabile)")
            curva.append({'fascia': list(f), 'n_gare': len(per_gara), 'mediana': None})
            continue
        b = scheletro.bootstrap_a_blocchi(per_gara)
        print(f"      eta {f[0]:2d}-{f[1]:2d}   mediana {b['mediana']:+7.3f} s   "
              f"IC95 {b['ci95']}   ({len(per_gara)} gare)")
        curva.append({'fascia': list(f), 'n_gare': len(per_gara),
                      'mediana': b['mediana'], 'ci95': b['ci95']})
    validi = [c for c in curva if c['mediana'] is not None]
    cresce = (len(validi) >= 3
              and validi[-1]['mediana'] > validi[0]['mediana']
              and validi[-1]['ci95'] and validi[-1]['ci95'][0] > 0)
    print(f"      => il residuo {'CRESCE nella coda: il cliff ha un bersaglio' if cresce else 'NON cresce nella coda: NESSUN CLIFF nei dati 2026'}")

    # --- (b) identificabilita': quanto e' desincronizzato il fondo di questa gara
    print('\n  (b) IDENTIFICABILITA per gara: rho si separa da beta solo se eta e giro-gara')
    print('      sono DESINCRONIZZATI. |corr| alta = rho e beta si contendono lo stesso segnale.')
    ident = []
    for gid in gare:
        t = tab[gid]
        if t['modello'] is None:
            continue
        r = [x for x in t['dati']['stima']]
        c = scheletro.corr([x['lap'] for x in r], [x['eta'] for x in r])
        m = t['modello']
        se = {k: round(v, 5) for k, v in m['se_rho'].items()}
        rap = {k: (abs(m['rho'][k]) / v if v > 1e-9 else None) for k, v in m['se_rho'].items()}
        ident.append({'gara': gid, 'corr_giro_eta': round(c, 3), 'se_rho': se,
                      'rho': {k: round(v, 5) for k, v in m['rho'].items()},
                      'rapporto_rho_su_se': {k: (round(v, 2) if v else None)
                                             for k, v in rap.items()}})
        print(f"      {gid:22s} corr(giro,eta) {c:+.2f}   rho/SE: "
              + '  '.join(f"{k[:3]}={rap[k]:.1f}" if rap[k] else f'{k[:3]}=-'
                          for k in sorted(rap)))
    deboli = [x for x in ident
              if all((v is None or v < 2.0) for v in x['rapporto_rho_su_se'].values())]
    print(f"      => gare in cui NESSUNA pendenza arriva a 2 errori standard: "
          f"{len(deboli)}/{len(ident)}")

    # --- (c) instabilita' del segno fra gare
    print('\n  (c) STABILITA DEL SEGNO fra gare (il degrado non puo essere negativo)')
    segni = {}
    for c in ('SOFT', 'MEDIUM', 'HARD'):
        v = [x['rho'][c] for x in ident if c in x['rho']]
        if not v:
            continue
        neg = sum(1 for x in v if x < 0)
        segni[c] = {'n_gare': len(v), 'n_negative': neg, 'valori': [round(x, 4) for x in v],
                    'min': round(min(v), 4), 'max': round(max(v), 4),
                    'escursione': round(max(v) - min(v), 4)}
        print(f"      {c:7s} {len(v)} gare | negative {neg} | da {min(v):+.4f} a {max(v):+.4f} "
              f"| escursione {max(v)-min(v):.4f} s/giro")

    # --- (d) i casi persi, raggruppati
    print('\n  (d) I CASI, raggruppati (mescola dello stint piu lungo / circuito)')
    X = misura_X(tab, ver, rho, tol_da_cal(tab, cal, rho)[0], 'C2', )
    per_circ, per_lung = {}, {}
    for c in X['casi']:
        k = c['circuito']
        per_circ.setdefault(k, {'n': 0, 'v': 0})
        per_circ[k]['n'] += 1
        per_circ[k]['v'] += bool(c['vince'])
        lmax = max(c['strategia']['lunghezze'])
        f = 'stint max <=20' if lmax <= 20 else ('21-30' if lmax <= 30 else '>30')
        per_lung.setdefault(f, {'n': 0, 'v': 0})
        per_lung[f]['n'] += 1
        per_lung[f]['v'] += bool(c['vince'])
    for k, v in sorted(per_circ.items()):
        print(f"      {k:22s} vinti {v['v']}/{v['n']}")
    for k, v in sorted(per_lung.items()):
        print(f"      {k:22s} vinti {v['v']}/{v['n']}")

    return {'curva_residuo_per_eta': curva, 'cliff_ha_bersaglio': cresce,
            'identificabilita': ident, 'n_gare_senza_pendenza_a_2se': len(deboli),
            'stabilita_segno': segni,
            'per_circuito': per_circ, 'per_lunghezza_stint': per_lung,
            'esclusi': X['esclusi']}


def main():
    p = argparse.ArgumentParser(description='Il degrado 2026, vivo.')
    p.add_argument('--equivalenza', action='store_true')
    p.add_argument('--censimento', action='store_true')
    p.add_argument('--falsifica', action='store_true')
    p.add_argument('--c1', action='store_true')
    p.add_argument('--c2', action='store_true')
    p.add_argument('--c3', action='store_true')
    p.add_argument('--tutto', action='store_true')
    a = p.parse_args()
    if not sigillo_null.pretendi_integro('run_degrado_2026.py'):
        return 0
    esito = json.load(open(USCITA)) if os.path.exists(USCITA) else {}

    if a.censimento or a.tutto:
        riga('(0) CENSIMENTO — quanto 2026 c e davvero, e quanto e neutralizzato')
        cen = censimento('2026')
        stampa_censimento(cen)
        esito['censimento_2026'] = cen

    if a.equivalenza or a.tutto:
        riga('(0-bis) EQUIVALENZA — la macchina nuova, a maschera piena, E la vecchia')
        esito['equivalenza'] = prova_equivalenza()

    if a.falsifica or a.tutto:
        riga('(0-ter) FALSIFICAZIONE F — la contabilita a giri verdi GONFIA le vittorie?')
        esito['falsificazione_F'] = falsifica()

    if a.c1 or a.c2 or a.c3 or a.tutto:
        tab = costruisci('2026')
        gare = sorted(g for g, v in tab.items() if v['modello'])
        cal, ver = gare[0::2], gare[1::2]
        if a.c1 or a.tutto:
            riga('(1) C1 — il modello lineare 2026, calibrato SOLO sul 2026')
            esito['C1'] = c1(tab, gare, cal, ver)
        if a.c2 or a.tutto:
            riga('(2) C2 — dove fallisce, e la domanda dichiarata: e il CLIFF?')
            rho = esito.get('C1', {}).get('rho') or rho_viaggiante(tab, cal)[0]
            esito['C2'] = c2(tab, gare, cal, ver, rho)

    with open(USCITA, 'w') as f:
        json.dump(esito, f, ensure_ascii=False, indent=1)
        f.write('\n')
    return 0


# ---------------------------------------------------------------- (0-bis) equivalenza
def prova_equivalenza(regime='2022-25', n_gare=3):
    """La contabilita' VECCHIA e' la nuova a maschera piena. Non lo dichiaro: lo dimostro,
    confrontando verdetto per verdetto su gare storiche NON neutralizzate."""
    tab = costruisci(regime)
    gare = [g for g, v in tab.items()
            if v['modello'] and not v['dati']['neutralizzata']][:n_gare]
    if not gare:
        print('  nessuna gara storica non neutralizzata: prova impossibile')
        return {'possibile': False}
    rho = {}
    conf, diff = 0, []
    for gid in gare:
        t = tab[gid]
        d, m = t['dati'], t['modello']
        pl = _pl_gara(d, m, solo_verdi=False)
        if pl is None:
            continue
        cand_v = DG.strategie(m, d['N'], pl)
        eta_mappa = fondo.stint_ed_eta(d['righe'])
        tol = 1e9                                   # tol enorme: confronto i NUMERI, non i verdetti
        for drv in sorted(m['alpha']):
            a1 = DG.valuta_pilota(d, m, drv, pl, G_STELLA, tol, cand=cand_v)
            a2 = DV.valuta_pilota_verde(d, m, drv, pl, G_STELLA, tol, eta_mappa=eta_mappa,
                                        solo_verdi=False)
            if 'escluso' in a1 or 'escluso' in a2:
                continue
            conf += 1
            for k in ('reale', 'sim_reale', 'sim_ottima'):
                if abs(a1[k] - a2[k]) > 0.05:
                    diff.append({'gara': gid, 'pilota': drv, 'campo': k,
                                 'vecchia': a1[k], 'nuova': a2[k]})
    print(f"  gare provate: {gare}")
    print(f"  confronti: {conf} | scostamenti oltre 0,05 s: {len(diff)}")
    if diff[:5]:
        for x in diff[:5]:
            print(f"    {x}")
    ok = conf > 0 and not diff
    print(f"  => {'PASS: a maschera piena la macchina nuova RITROVA la vecchia' if ok else 'DIFFORME'}")
    return {'possibile': True, 'gare': gare, 'n_confronti': conf,
            'n_scostamenti': len(diff), 'scostamenti': diff[:20], 'PASS': ok}


# ---------------------------------------------------------------- (0-ter) falsificazione F
def falsifica(regime='2022-25'):
    """FALSIFICAZIONE F (PREREG §0): sullo storico, dove le gare pulite esistono, girano
    ENTRAMBE le contabilita'. Se quella a giri verdi produce una X sistematicamente PIU ALTA
    — IC95 appaiato per gara che esclude lo zero VERSO L'ALTO — la regola nuova gonfia le
    vittorie ed e' RESPINTA: il 2026 torna non misurabile."""
    tab = costruisci(regime)
    gare = sorted(g for g, v in tab.items()
                  if v['modello'] and not v['dati']['neutralizzata'])
    print(f"  gare storiche non neutralizzate (le sole dove il VETO permette il confronto): "
          f"{len(gare)}")
    if len(gare) < 4:
        print('  troppo poche: F NON GIUDICABILE')
        return {'giudicabile': False, 'n_gare': len(gare)}
    cal, ver = gare[0::2], gare[1::2]
    rho, _ = rho_viaggiante(tab, cal)
    print(f"  rho viaggiante dalle gare di calibrazione: "
          f"{ {c: round(v, 5) for c, v in rho.items()} }")
    fuori = {}
    for nome, sv in (('veto (vecchia)', False), ('giri verdi (nuova)', True)):
        tol, n = tol_da_cal(tab, cal, rho, solo_verdi=sv)
        X = misura_X(tab, ver, rho, tol, f'storico — {nome}', solo_verdi=sv)
        stampa_X(X)
        fuori[nome] = X
    a, b = fuori['veto (vecchia)'], fuori['giri verdi (nuova)']
    comuni = sorted(set(a['per_gara']) & set(b['per_gara']))
    app = [b['per_gara'][g]['quota'] - a['per_gara'][g]['quota'] for g in comuni]
    if len(app) < 2:
        return {'giudicabile': False, 'motivo': f'{len(app)} gare appaiate'}
    boot = scheletro.bootstrap_a_blocchi(app)
    gonfia = bool(boot['ci95'] and boot['ci95'][0] > 0)
    print(f"\n  differenza appaiata per gara (nuova - vecchia): mediana {boot['mediana']:+.4f}"
          f"  IC95 {boot['ci95']}  su {len(app)} gare")
    print(f"  => F {'SCATTA: la regola nuova GONFIA le vittorie -> RESPINTA' if gonfia else 'NON scatta: la regola nuova non gonfia le vittorie'}")
    # QUANTO POTEVA VEDERE, F? Sulle gare NON neutralizzate le due contabilita' sono quasi
    # lo stesso oggetto: se i giri non verdi sono ~0, un pareggio non e' una promozione, e'
    # cecita' dello strumento. Si misura, non si spera.
    tot_l = tot_ng = 0
    for gid in gare:
        d = tab[gid]['dati']
        for r in d['righe']:
            if isinstance(r['lap'], (int, float)) and 2 <= int(r['lap']) <= d['N']:
                tot_l += 1
                tot_ng += (str(r['status']) != '1')
    quota_ng = tot_ng / max(tot_l, 1)
    vacua = quota_ng < 0.02
    print(f"\n  POTERE DI F: sulle gare non neutralizzate i giri non verdi sono "
          f"{tot_ng}/{tot_l} = {100*quota_ng:.2f} %")
    if vacua:
        print('  => F e VACUA: le due contabilita quasi coincidono dove il veto permette il')
        print('     confronto. Il pareggio NON e una promozione. Serve F2 (sotto).')

    f2 = falsifica2(tab, rho)
    return {'giudicabile': True, 'n_gare_confronto': len(gare),
            'gare_calibrazione': cal, 'gare_verifica': ver,
            'rho_viaggiante': {c: round(v, 5) for c, v in rho.items()},
            'X_veto': {k: v for k, v in a.items() if k != 'casi'},
            'X_verde': {k: v for k, v in b.items() if k != 'casi'},
            'appaiato_per_gara': dict(zip(comuni, [round(x, 4) for x in app])),
            'mediana': boot['mediana'], 'ci95': boot['ci95'],
            'GONFIA': gonfia,
            'potere': {'giri_non_verdi': tot_ng, 'giri_totali': tot_l,
                       'quota_non_verdi': round(quota_ng, 4), 'VACUA': vacua,
                       'nota': 'dove il veto permette il confronto le due contabilita quasi '
                               'coincidono: il pareggio non e una promozione'},
            'esito': 'VACUA — non giudica' if vacua
                     else ('RESPINTA' if gonfia else 'REGGE'),
            'F2': f2}


def falsifica2(tab, rho):
    """F2 — la falsificazione CON I DENTI, aggiunta dopo che F si e' rivelata vacua.

    Il veto RIFIUTAVA di calcolare le gare neutralizzate: era una POLITICA, non
    un'impossibilita'. Quelle gare si possono calcolare in entrambi i modi, ed e' li' che le
    due contabilita' differiscono al massimo (dal 5,7 % al 15,9 % di giri nel 2026).

    Su ogni gara storica NEUTRALIZZATA, appaiata con se stessa:
        (a) contabilita' a giri verdi   — la regola nuova
        (b) contabilita' a giri pieni   — quello che la vecchia macchina AVREBBE detto
    Se mascherare i giri di safety car FABBRICA vittorie, (a) deve stare sistematicamente
    sopra (b). IC95 appaiato sui blocchi (bootstrap_a_blocchi, SOTTO SIGILLO).

    NOTA DI ONESTA': F2 e' stata aggiunta DOPO aver visto che F non scattava. E' un test
    PIU SEVERO, non piu' permissivo: cerco il mio errore dove F non poteva vederlo.
    """
    gare = sorted(g for g, v in tab.items()
                  if v['modello'] and v['dati']['neutralizzata'])
    print(f"\n  F2 — gare storiche NEUTRALIZZATE (dove le due contabilita divergono davvero): "
          f"{len(gare)}")
    if len(gare) < 4:
        print('    troppo poche: F2 NON GIUDICABILE')
        return {'giudicabile': False, 'n_gare': len(gare)}
    cal, ver = gare[0::2], gare[1::2]
    fuori = {}
    for nome, sv in (('giri pieni (cosa avrebbe detto la vecchia)', False),
                     ('giri verdi (la regola nuova)', True)):
        tol, _ = tol_da_cal(tab, cal, rho, solo_verdi=sv)
        X = misura_X(tab, ver, rho, tol, f'F2 — {nome}', solo_verdi=sv)
        stampa_X(X)
        fuori[nome] = X
    a = fuori['giri pieni (cosa avrebbe detto la vecchia)']
    b = fuori['giri verdi (la regola nuova)']
    comuni = sorted(set(a['per_gara']) & set(b['per_gara']))
    app = [b['per_gara'][g]['quota'] - a['per_gara'][g]['quota'] for g in comuni]
    if len(app) < 2:
        print(f"    solo {len(app)} gare appaiate: F2 NON GIUDICABILE")
        return {'giudicabile': False, 'motivo': f'{len(app)} gare appaiate',
                'X_pieni': {k: v for k, v in a.items() if k != 'casi'},
                'X_verdi': {k: v for k, v in b.items() if k != 'casi'}}
    boot = scheletro.bootstrap_a_blocchi(app)
    gonfia = bool(boot['ci95'] and boot['ci95'][0] > 0)
    print(f"    differenza appaiata (verdi - pieni): mediana {boot['mediana']:+.4f}  "
          f"IC95 {boot['ci95']}  su {len(app)} gare")
    print(f"    => F2 {'SCATTA: mascherare i giri SC FABBRICA vittorie -> REGOLA RESPINTA' if gonfia else 'NON scatta: mascherare non fabbrica vittorie'}")
    return {'giudicabile': True, 'gare': gare, 'gare_calibrazione': cal, 'gare_verifica': ver,
            'X_pieni': {k: v for k, v in a.items() if k != 'casi'},
            'X_verdi': {k: v for k, v in b.items() if k != 'casi'},
            'appaiato_per_gara': dict(zip(comuni, [round(x, 4) for x in app])),
            'mediana': boot['mediana'], 'ci95': boot['ci95'], 'GONFIA': gonfia,
            'esito': 'RESPINTA' if gonfia else 'REGGE',
            'nota_onesta': 'F2 aggiunta DOPO che F si e rivelata vacua: test piu severo, '
                           'non piu permissivo'}


# ---------------------------------------------------------------- (1) C1
def c1(tab, gare, cal, ver):
    print(f"  gare 2026 col modello stimabile: {len(gare)}/{len(tab)}")
    for g, v in sorted(tab.items()):
        if v['modello'] is None:
            print(f"    ESCLUSA {g}: {v['motivo']}")
    print(f"  calibrazione (indici pari): {cal}")
    print(f"  verifica     (indici dispari): {ver}")

    rho, dett = rho_viaggiante(tab, cal)
    print('\n  PENDENZE 2026 (s/giro per giro di vita gomma), mediana cross-gara sulle '
          'gare di calibrazione:')
    for c in ('SOFT', 'MEDIUM', 'HARD'):
        if c in dett:
            d = dett[c]
            print(f"    rho_{c:7s} {d['mediana']:+.5f}   IC95 {d['ci95']}   "
                  f"({d['n_gare']} gare sotto)")
        else:
            print(f"    rho_{c:7s} NON IDENTIFICABILE nelle gare di calibrazione")
    ordinati = [c for c in ('SOFT', 'MEDIUM', 'HARD') if c in rho]
    ordine_ok = all(rho[ordinati[i]] > rho[ordinati[i + 1]] for i in range(len(ordinati) - 1)) \
        if len(ordinati) > 1 else None
    print(f"\n  controllo di sanita SOFT>MEDIUM>HARD (check, NON vincolo): "
          f"{'ESCE DA SOLO' if ordine_ok else 'NON esce'}  "
          f"[{' > '.join(f'{c}={rho[c]:+.4f}' for c in ordinati)}]")

    tol, n_scarti = tol_da_cal(tab, cal, rho)
    print(f"\n  tol = {tol:.3f} s (68o percentile di |sim(reale)-reale| su {n_scarti} "
          f"piloti delle gare di CALIBRAZIONE)")
    X = misura_X(tab, ver, rho, tol, 'C1 lineare 2026 — fuori campione')
    print()
    stampa_X(X)
    riassunto = {g: '{}/{}'.format(v['vinti'], v['n']) for g, v in X['per_gara'].items()}
    print(f'    per gara: {riassunto}')

    A = cancello_predittivo(tab, ver, rho)
    print('\n  CANCELLO (A) predittivo — contro il degrado-zero RISTIMATO:')
    if A['giudicabile']:
        for c in A['coppie']:
            print(f"    {c['gara']:22s} modello {c['errore_modello']:7.2f} s   "
                  f"zero {c['errore_zero']:7.2f} s   guadagno {c['guadagno']:+7.2f} s")
        print(f"    guadagno mediano {A['guadagno_mediano']:+.3f} s  IC95 {A['ci95']}  "
              f"-> {'SUPERATO' if A['SUPERATO'] else 'NON superato'}")
    else:
        print(f"    NON GIUDICABILE: {A['motivo']}")

    abbastanza = X['n_casi'] >= MIN_CASI and X['n_gare'] >= MIN_GARE
    B = bool(abbastanza and X['quota'] and X['quota'] >= QUOTA_NETTA
             and X['margine_mediano_vittorie']
             and X['margine_mediano_vittorie'] >= FATTORE_MARGINE * tol)
    print(f"\n  CANCELLO (B) prodotto — X>={100*QUOTA_NETTA:.0f}% e margine>={FATTORE_MARGINE}*tol:")
    print(f"    numerosita: {X['n_casi']} casi (serve {MIN_CASI}) su {X['n_gare']} gare "
          f"(servono {MIN_GARE}) -> {'OK' if abbastanza else 'NON GIUDICABILE'}")
    print(f"    X = {100*(X['quota'] or 0):.1f} % (serve {100*QUOTA_NETTA:.0f} %) | "
          f"margine {X['margine_mediano_vittorie']} s (serve {FATTORE_MARGINE*tol:.2f} s) "
          f"-> {'SUPERATO' if B else 'NON superato'}")
    acc = bool(A.get('SUPERATO') and B)
    print(f"\n  ACCENDIBILE = {acc}")
    return {'gare': gare, 'gare_calibrazione': cal, 'gare_verifica': ver,
            'rho': rho, 'rho_dettaglio': dett, 'ordine_SMH_esce_da_solo': ordine_ok,
            'tol': round(tol, 3), 'n_scarti_calibrazione': n_scarti,
            'X': {k: v for k, v in X.items() if k != 'casi'},
            'casi': X['casi'],
            'cancello_A_predittivo': A,
            'cancello_B_prodotto': {'numerosita_ok': abbastanza, 'SUPERATO': B,
                                    'quota_richiesta': QUOTA_NETTA,
                                    'margine_richiesto': round(FATTORE_MARGINE * tol, 3)},
            'ACCENDIBILE': acc}


if __name__ == '__main__':
    raise SystemExit(main())
