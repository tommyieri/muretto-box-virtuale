#!/usr/bin/env python3
"""run_pista.py — l'intensita' del traffico governata dalla PISTA, sopra il delta-passo.

    python3 ai_lab/scienziato/run_pista.py

Esce sempre 0. Prereg: PREREG_traffico_pista.md (scritto prima di misurare).
"""
import csv
import json
import os
import statistics as st
import sys

import numpy as np

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.abspath(os.path.join(QUI, '..', '..'))
sys.path.insert(0, QUI)

import degrado as DG
import fondo
import pista as PS
import scheletro
import sigillo_null
import traffico as TR

DATA = '2026-07-21'
K_RESTART = 3          # finestra derivata la notte scorsa
MIN_INC = 120          # incontri minimi perche' una pista sia stimabile (dichiarato)

# imputato A: il CSV orfano. Mappa nome-CSV -> pista del fondo.
CSV_MAP = {'Monte Carlo': 'Monaco', 'Budapest': 'Hungarian', 'Spielberg': 'Austrian',
           'Melbourne': 'Australian', 'Lusail': 'Qatar', 'Marina Bay': 'Singapore',
           'Monza': 'Italian', 'Silverstone': 'British', 'Montreal': 'Canadian',
           'Suzuka': 'Japanese', 'Sakhir': 'Bahrain', 'Baku': 'Azerbaijan',
           'Barcelona': 'Spanish', 'Jeddah': 'Saudi Arabian', 'Imola': 'Emilia Romagna',
           'Sao Paulo': 'São Paulo', 'Zandvoort': 'Dutch', 'Mexico City': 'Mexico City',
           'Miami': 'Miami', 'Spa': 'Belgian', 'Austin': 'United States',
           'Shanghai': 'Chinese', 'Yas Island': 'Abu Dhabi', 'Las Vegas': 'Las Vegas'}


def riga(t):
    print('=' * 92)
    print(t)
    print('=' * 92)


def boot(v, rip=2000, seed=20260721):
    import random
    rng = random.Random(seed)
    m = sorted(st.median([v[rng.randrange(len(v))] for _ in v]) for _ in range(rip))
    return st.median(v), [m[int(.025 * rip)], m[int(.975 * rip)]]


def spearman(x, y):
    import percircuito as PC
    return PC.spearman(x, y)


def raccogli(regime):
    per_gara, gare = {}, []
    for b in fondo.elenco_blocchi():
        if b['regime'] != regime:
            continue
        d = DG.prepara(b)
        if d is None:
            continue
        m = DG.stima(d)
        if 'escluso' in m:
            continue
        neut = TR.giri_neutralizzati(d['righe'])
        inc = TR.incontri(d, m, neutralizzati=neut, finestra=K_RESTART)
        if inc:
            per_gara[b['id']] = inc
            gare.append((b, d, m))
    return per_gara, gare


def valuta(per_gara, glob, theta, con_delta):
    fuori = []
    for gid, inc in per_gara.items():
        p = PS.prevedi(inc, glob, theta, con_delta)
        y = np.array([x['r'] for x in inc])
        fuori.append(float(np.median(np.abs(y - p))))
    return fuori


def main():
    if not sigillo_null.pretendi_integro('run_pista.py'):
        return 0
    fuori = {'data_calcolo': DATA}

    per_gara, gare = raccogli('2022-25')
    T = {'gare_sotto': len(per_gara), 'piste': len({PS.pista_di(g) for g in per_gara}),
         'calcolato_il': DATA}
    print(f"incontri raccolti su {len(per_gara)} gare / {T['piste']} piste  targhetta {T}")

    gids = sorted(per_gara)
    cal, ver = gids[0::2], gids[1::2]
    inc_cal = [x for g in cal for x in per_gara[g]]
    glob = TR.fit_M1(inc_cal)          # a, lam, c globali dalla calibrazione
    print(f"  globali dalla calibrazione: a={glob['a']:.3f} lam={glob['lam']} c={glob['c']:.3f}")

    riga('(2) LA DIFFICOLTA-PISTA, isolata tenendo fisso il delta-passo')
    theta_cal = PS.theta_per_pista({g: per_gara[g] for g in cal}, glob, MIN_INC)
    theta_tutto = PS.theta_per_pista(per_gara, glob, MIN_INC)
    print(f"  theta stimabile su {len(theta_tutto)} piste (>= {MIN_INC} incontri)")
    print(f"  {'pista':18s} {'theta':>7s} {'se':>6s} {'b':>7s} {'n_inc':>6s} {'gare':>5s}")
    for p, s in sorted(theta_tutto.items(), key=lambda kv: -kv[1]['theta']):
        print(f"  {p:18s} {s['theta']:7.3f} {s['se_theta']:6.3f} {s['b']:7.3f} "
              f"{s['n']:6d} {s['n_gare']:5d}")
    th = [s['theta'] for s in theta_tutto.values()]
    sd_vero = st.pstdev(th)
    print(f"\n  dispersione dei theta fra piste: sd = {sd_vero:.4f}")

    print('\n  PLACEBO-PISTA (null NUOVO, non auto-sigillato): etichette-pista permutate')
    nulla = PS.permuta_piste(per_gara, glob, ripetizioni=400, min_inc=MIN_INC)
    nulla.sort()
    q95 = nulla[int(.95 * len(nulla))]
    p_val = (1 + sum(1 for x in nulla if x >= sd_vero)) / (len(nulla) + 1)
    print(f"    sd sotto il null: mediana {st.median(nulla):.4f}, q95 {q95:.4f} "
          f"({len(nulla)} repliche)")
    print(f"    sd vera {sd_vero:.4f}  ->  p = {p_val:.4f}  "
          f"{'REGGE: la pista non e rumore' if p_val < 0.05 else 'ARTEFATTO: dentro il rumore'}")
    fuori['theta'] = {p: {k: round(v, 4) if isinstance(v, float) else v
                          for k, v in s.items()} for p, s in theta_tutto.items()}
    fuori['placebo_pista'] = {'sd_vera': round(sd_vero, 4), 'q95_null': round(q95, 4),
                              'p': round(p_val, 4), 'repliche': len(nulla),
                              'null_nuovo_da_sigillare': True, 'targhetta': T}

    riga('(1) I DUE IMPUTATI messi alla prova, cella per cella')
    csv_a = {}
    with open(os.path.join(RADICE, 'data', 'difficolta_sorpasso.csv')) as f:
        for r in csv.DictReader(f):
            p = CSV_MAP.get(r['gara'])
            if p:
                csv_a[p] = float(r['difficolta_0_1'])
    com = sorted(set(csv_a) & set(theta_tutto))
    rho = spearman([csv_a[p] for p in com], [theta_tutto[p]['theta'] for p in com])
    print(f"  imputato A — CSV orfano (dichiarato NON FIDATO dal repo): {len(com)} celle")
    print(f"    Spearman(difficolta_0_1, theta dal fondo) = {rho}")
    print(f"    {'pista':18s} {'CSV 0-1':>8s} {'theta':>7s} {'IC95 theta':>18s}  esito")
    celle = {}
    for p in sorted(com, key=lambda x: -csv_a[x]):
        s = theta_tutto[p]
        lo, hi = s['theta'] - 1.96 * s['se_theta'], s['theta'] + 1.96 * s['se_theta']
        # il CSV e' 0-1 crescente in difficolta'; theta e' un moltiplicatore.
        # confronto di RANGO: la pista sta dallo stesso lato della mediana in entrambi?
        med_csv = st.median(list(csv_a.values()))
        med_th = st.median(th)
        lato_csv = csv_a[p] > med_csv
        lato_th = s['theta'] > med_th
        netto = (lo > med_th) or (hi < med_th)
        esito = ('dato insufficiente' if not netto else
                 ('CSV confermato' if lato_csv == lato_th else 'CSV CORRETTO dal fondo'))
        celle[p] = {'csv': csv_a[p], 'theta': round(s['theta'], 3),
                    'ci95': [round(lo, 3), round(hi, 3)], 'esito': esito}
        print(f"  {p:18s} {csv_a[p]:8.3f} {s['theta']:7.3f} "
              f"[{lo:7.3f},{hi:7.3f}]  {esito}")
    conta = {}
    for c in celle.values():
        conta[c['esito']] = conta.get(c['esito'], 0) + 1
    print(f"\n  bilancio: {conta}")
    fuori['imputato_A'] = {'spearman': rho, 'celle': celle, 'bilancio': conta,
                           'nota': 'CSV orfano, senza generatore, dichiarato NON FIDATO in '
                                   'data/SORPASSO_NOTA.txt', 'targhetta': T}

    riga('(3) I MODELLI — i due ingressi insieme, fuori campione')
    ver_gara = {g: per_gara[g] for g in ver}
    mod = {
        'M0 solo gap': valuta(ver_gara, {'a': glob['a'], 'lam': glob['lam'], 'c': 0.0},
                              None, False),
        'M1 + delta-passo': valuta(ver_gara, glob, None, True),
        'Mp + pista': valuta(ver_gara, {'a': glob['a'], 'lam': glob['lam'], 'c': 0.0},
                             theta_cal, False),
        'Mfull pista+delta': valuta(ver_gara, glob, theta_cal, True),
    }
    agg = {k: boot(v) for k, v in mod.items()}
    for k, (m, ci) in agg.items():
        print(f"    {k:20s} errore ass. mediano per gara {m:.4f}  IC95 [{ci[0]:.4f},{ci[1]:.4f}]")
    ris = {}
    for rif in ('M0 solo gap', 'M1 + delta-passo'):
        m_rif, ci_rif = agg[rif]
        M = (ci_rif[1] - ci_rif[0]) / 2
        print(f"\n  contro {rif}:  M dichiarato = {M:.4f} s")
        for k in ('Mp + pista', 'Mfull pista+delta'):
            migl = m_rif - agg[k][0]
            app = [a - b for a, b in zip(mod[rif], mod[k])]
            bo = scheletro.bootstrap_a_blocchi(app)
            esclude = bool(bo['ci95'] and (bo['ci95'][0] > 0 or bo['ci95'][1] < 0))
            vince = bool(migl > M and esclude)
            print(f"    {k:20s} miglioramento {migl:+.4f} "
                  f"{'SUPERA M' if migl > M else 'non supera M'}; appaiato {bo['mediana']:+.4f} "
                  f"IC95 {bo['ci95']} -> {'CANDIDATO' if vince else 'RUMORE'}")
            ris[f'{k} vs {rif}'] = {'miglioramento': round(migl, 4), 'M': round(M, 4),
                                    'supera_M': bool(migl > M), 'esclude_zero': esclude,
                                    'esito': 'CANDIDATO' if vince else 'RUMORE'}
    fuori['modelli'] = {'aggregati': {k: {'errore': round(v[0], 4), 'ci95': v[1]}
                                      for k, v in agg.items()},
                        'confronti': ris, 'targhetta': T}

    riga('LA TRAPPOLA CHE UCCISE IL v1 — theta e stabile fra stagioni?')
    per_st = PS.theta_per_stagione(per_gara, glob, MIN_INC)
    multi = {p: a for p, a in per_st.items() if len(a) >= 2}
    print(f"  piste con >=2 stagioni stimabili: {len(multi)}")
    dentro, fra = [], []
    for p, a in sorted(multi.items()):
        v = [s['theta'] for s in a.values()]
        se = [s['se_theta'] for s in a.values()]
        print(f"    {p:18s} " + '  '.join(f"{y}:{a[y]['theta']:+.2f}" for y in sorted(a))
              + f"   sd fra stagioni {st.pstdev(v):.3f}  se intra mediana {st.median(se):.3f}")
        fra.append(st.pstdev(v))
        dentro.append(st.median(se))
    if fra:
        rap = st.median(fra) / st.median(dentro)
        print(f"\n  sd inter-stagione mediana {st.median(fra):.3f} vs se intra mediana "
              f"{st.median(dentro):.3f}  ->  rapporto {rap:.2f}")
        print(f"  {'STABILE: il theta si ripete fra stagioni' if rap <= 1.5 else 'INSTABILE: theta balla fra stagioni, come l indice v1'}")
        fuori['stabilita'] = {'sd_inter_mediana': round(st.median(fra), 4),
                              'se_intra_mediana': round(st.median(dentro), 4),
                              'rapporto': round(rap, 3), 'n_piste': len(multi),
                              'targhetta': T}

    riga('(4) IL 2026 — quanto si puo stimare, e cosa resta cieco')
    pg26, _ = raccogli('2026')
    T26 = {'gare_sotto': len(pg26), 'piste': len({PS.pista_di(g) for g in pg26}),
           'calcolato_il': DATA}
    print(f"  gare 2026 con incontri: {len(pg26)}  targhetta {T26}")
    if pg26:
        inc26 = [x for v in pg26.values() for x in v]
        g26 = TR.fit_M1(inc26)
        print(f"    globali 2026: a={g26['a']:.3f} lam={g26['lam']} c={g26['c']:.3f}   "
              f"(storico: a={glob['a']:.3f} lam={glob['lam']} c={glob['c']:.3f})")
        th26 = PS.theta_per_pista(pg26, g26, MIN_INC)
        print(f"    piste 2026 con theta stimabile (>= {MIN_INC} incontri): {len(th26)}")
        for p, s in sorted(th26.items(), key=lambda kv: -kv[1]['theta']):
            sto = theta_tutto.get(p)
            print(f"      {p:18s} theta2026 {s['theta']:+.3f} +-{1.96*s['se_theta']:.3f}"
                  + (f"   storico {sto['theta']:+.3f}" if sto else '   (nessuno storico)'))
        com26 = [p for p in th26 if p in theta_tutto]
        if len(com26) >= 3:
            r26 = spearman([theta_tutto[p]['theta'] for p in com26],
                           [th26[p]['theta'] for p in com26])
            print(f"\n    Spearman(theta storico, theta 2026) su {len(com26)} piste = {r26}")
            print('    NON e un transfer: e la misura di QUANTO il vecchio non serve al nuovo.')
        else:
            r26 = None
            print('\n    meno di 3 piste in comune: il confronto non e possibile. CIECO.')
        fuori['regime_2026'] = {'globali': g26, 'theta': {p: round(s['theta'], 3)
                                                          for p, s in th26.items()},
                                'spearman_con_storico': r26, 'targhetta': T26}

    with open(os.path.join(QUI, 'esito_pista.json'), 'w') as f:
        json.dump(fuori, f, ensure_ascii=False, indent=1, default=str)
        f.write('\n')
    print('\n  scritto: ai_lab/scienziato/esito_pista.json')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
