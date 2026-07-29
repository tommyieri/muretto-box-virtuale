#!/usr/bin/env python3
"""run_live.py — la composizione intensita' x durata, e la forma che va live.

    python3 ai_lab/scienziato/run_live.py

Esce sempre 0. Prereg: PREREG_traffico_live.md. IL PATTO: comunque vada si chiude e un
traffico va live (composizione o forma minima). Il go-live lo decide Tommi.
"""
import json
import os
import statistics as st
import sys

import numpy as np

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)

import composizione as CP
import degrado as DG
import fondo
import scheletro
import sigillo_null
import traffico as TR

DATA = '2026-07-21'
K_RESTART = 3


def riga(t):
    print('=' * 92)
    print(t)
    print('=' * 92)


def boot(v, rip=2000, seed=20260721):
    import random
    rng = random.Random(seed)
    m = sorted(st.median([v[rng.randrange(len(v))] for _ in v]) for _ in range(rip))
    return st.median(v), [m[int(.025 * rip)], m[int(.975 * rip)]]


def main():
    if not sigillo_null.pretendi_integro('run_live.py'):
        return 0
    fuori = {'data_calcolo': DATA}

    per_gara, dati_gara = {}, {}
    for b in fondo.elenco_blocchi():
        if b['regime'] != '2022-25':
            continue
        d = DG.prepara(b)
        if d is None:
            continue
        m = DG.stima(d)
        if 'escluso' in m:
            continue
        inc = TR.incontri(d, m, neutralizzati=TR.giri_neutralizzati(d['righe']),
                          finestra=K_RESTART)
        if inc:
            per_gara[b['id']] = inc
            dati_gara[b['id']] = (d, m)
    gids = sorted(per_gara)
    cal, ver = gids[0::2], gids[1::2]
    enc_cal = CP.incontri_costo([x for g in cal for x in per_gara[g]])
    enc_ver = CP.incontri_costo([x for g in ver for x in per_gara[g]])
    T = {'gare_sotto': len(gids), 'incontri_calibrazione': len(enc_cal),
         'incontri_verifica': len(enc_ver), 'calcolato_il': DATA}
    print(f"targhetta {T}")

    glob = TR.fit_M1([x for g in cal for x in per_gara[g]])
    glob_solo_gap = {'a': glob['a'], 'lam': glob['lam'], 'c': 0.0}
    dur = CP.stima_durata(enc_cal)
    riga('(1) LA COMPOSIZIONE — intensita(gap) x durata(delta-passo)')
    print(f"  intensita globale (calibrazione): a={glob['a']:.4f}  lam={glob['lam']}")
    print(f"  durata attesa D(delta), dalle stesse fasce verificate la notte scorsa:")
    for f in CP.FASCE:
        if f in dur['per_fascia']:
            print(f"    delta [{f[0]:+.2f},{f[1]:+.2f})  D = {dur['per_fascia'][f]:.3f} giri "
                  f"(n={dur['n_per_fascia'][f]})")
    print(f"    durata media GLOBALE (quella che il solo-gap puo sapere): "
          f"{dur['globale']:.3f} giri")
    kappa = CP.stima_kappa(enc_cal, glob_solo_gap, dur)
    print(f"  kappa di C2 (minimi quadrati in calibrazione): {kappa:.4f}")

    riga('(3) IL CONFRONTO FUORI CAMPIONE — sul COSTO TOTALE dell incontro')
    mod = {}
    for nome, forma in (('C0 solo-gap', 'C0'), ('C1 composizione', 'C1'),
                        ('C2 composizione scalata', 'C2')):
        p = CP.prevedi(enc_ver, glob_solo_gap, dur, forma, kappa)
        mod[nome] = CP.errore_per_gara(enc_ver, p)
    mod['traffico-zero'] = CP.errore_per_gara(enc_ver, np.zeros(len(enc_ver)))
    agg = {k: boot(v) for k, v in mod.items()}
    for k, (m, ci) in agg.items():
        print(f"    {k:26s} errore ass. mediano per gara {m:7.4f} s  IC95 [{ci[0]:.4f},{ci[1]:.4f}]")
    m0, ci0 = agg['C0 solo-gap']
    M = (ci0[1] - ci0[0]) / 2
    print(f"\n  M dichiarato (semi-ampiezza IC95 di C0) = {M:.4f} s")
    ris = {}
    for k in ('C1 composizione', 'C2 composizione scalata'):
        migl = m0 - agg[k][0]
        app = [a - b for a, b in zip(mod['C0 solo-gap'], mod[k])]
        bo = scheletro.bootstrap_a_blocchi(app)
        esclude = bool(bo['ci95'] and (bo['ci95'][0] > 0 or bo['ci95'][1] < 0))
        vince = bool(migl > M and esclude)
        print(f"    {k:26s} miglioramento {migl:+.4f} "
              f"{'SUPERA M' if migl > M else 'non supera M'}; appaiato {bo['mediana']:+.4f} "
              f"IC95 {bo['ci95']} -> {'CANDIDATO' if vince else 'RUMORE'}")
        ris[k] = {'errore': round(agg[k][0], 4), 'miglioramento': round(migl, 4),
                  'supera_M': bool(migl > M), 'esclude_zero': esclude,
                  'esito': 'CANDIDATO' if vince else 'RUMORE'}
    vincitrice = 'C1 composizione' if ris['C1 composizione']['esito'] == 'CANDIDATO' else (
        'C2 composizione scalata' if ris['C2 composizione scalata']['esito'] == 'CANDIDATO'
        else None)

    riga('(2) IL PLACEBO — con un leader a caso la composizione vince lo stesso?')
    print('  traffico.placebo_leader, GIA SOTTO SIGILLO: chiamata e non modificata.')
    pl_cal, pl_ver = [], []
    for g in gids:
        d, m = dati_gara[g]
        p = TR.placebo_leader(per_gara[g], d, m)
        (pl_cal if g in cal else pl_ver).extend(p)
    e_pc, e_pv = CP.incontri_costo(pl_cal), CP.incontri_costo(pl_ver)
    dur_pl = CP.stima_durata(e_pc)
    p0 = CP.errore_per_gara(e_pv, CP.prevedi(e_pv, glob_solo_gap, dur_pl, 'C0'))
    p1 = CP.errore_per_gara(e_pv, CP.prevedi(e_pv, glob_solo_gap, dur_pl, 'C1'))
    mp0, mp1 = st.median(p0), st.median(p1)
    migl_vero = ris['C1 composizione']['miglioramento']
    print(f"    placebo: C0 {mp0:.4f} -> C1 {mp1:.4f}   miglioramento {mp0-mp1:+.4f}")
    print(f"    vero   : miglioramento {migl_vero:+.4f}")
    regge = abs(mp0 - mp1) < abs(migl_vero) / 2 if migl_vero > 0 else True
    print(f"    -> {'il placebo NON riproduce l effetto' if regge else 'ATTENZIONE: il placebo riproduce parte dell effetto'}")
    fuori['placebo'] = {'miglioramento_placebo': round(mp0 - mp1, 4),
                        'miglioramento_vero': migl_vero, 'regge': bool(regge),
                        'null_gia_sigillato': True}

    riga('(4) VALIDAZIONE PER IL LIVE')
    forma_live = vincitrice or 'C0 solo-gap'
    print(f"  FORMA CHE VA LIVE: {'la COMPOSIZIONE' if vincitrice else 'la FORMA MINIMA'} "
          f"-> {forma_live}")
    mz, _ = agg['traffico-zero']
    ml, _ = agg[forma_live]
    print(f"\n  1. batte il traffico-zero? errore {ml:.4f} contro {mz:.4f}  -> "
          f"{'SI' if ml < mz else 'NO'}  (guadagno {mz-ml:+.4f} s per incontro)")
    app0 = [a - b for a, b in zip(mod['traffico-zero'], mod[forma_live])]
    bo0 = scheletro.bootstrap_a_blocchi(app0)
    print(f"     appaiato per gara {bo0['mediana']:+.4f}  IC95 {bo0['ci95']}")

    print('\n  2. TEST DELLA McLAREN (delta < -0,8: molto piu veloce dietro una lenta)')
    mc = [e for e in enc_ver if e['delta'] < -0.8]
    altri = [e for e in enc_ver if -0.15 <= e['delta'] < 0.15]
    pm = CP.prevedi(mc, glob_solo_gap, dur, 'C1' if vincitrice else 'C0', kappa)
    pa = CP.prevedi(altri, glob_solo_gap, dur, 'C1' if vincitrice else 'C0', kappa)
    print(f"     McLaren (delta<-0,8): n={len(mc)}  costo REALE mediano "
          f"{st.median([e['costo'] for e in mc]):.3f} s  previsto {float(np.median(pm)):.3f} s")
    print(f"     pari passo          : n={len(altri)}  costo REALE mediano "
          f"{st.median([e['costo'] for e in altri]):.3f} s  previsto {float(np.median(pa)):.3f} s")
    passa_mc = float(np.median(pm)) < float(np.median(pa))
    print(f"     il modello predice per la McLaren un costo "
          f"{'PIU BASSO' if passa_mc else 'PIU ALTO'} che a pari passo -> "
          f"{'TEST SUPERATO' if passa_mc else 'TEST FALLITO: non va live'}")

    fuori['confronto'] = {'aggregati': {k: {'errore': round(v[0], 4), 'ci95': v[1]}
                                        for k, v in agg.items()},
                          'M_dichiarato': round(M, 4), 'forme': ris,
                          'vincitrice': vincitrice, 'forma_live': forma_live,
                          'targhetta': T}
    fuori['validazione_live'] = {
        'batte_traffico_zero': bool(ml < mz), 'guadagno_vs_zero': round(mz - ml, 4),
        'appaiato_vs_zero': bo0, 'test_mclaren_superato': bool(passa_mc),
        'mclaren': {'n': len(mc), 'costo_reale_mediano': round(st.median([e['costo'] for e in mc]), 3),
                    'costo_previsto_mediano': round(float(np.median(pm)), 3)},
        'pari_passo': {'n': len(altri), 'costo_reale_mediano': round(st.median([e['costo'] for e in altri]), 3),
                       'costo_previsto_mediano': round(float(np.median(pa)), 3)}}

    riga('IL MODELLO LIVE — coefficienti con targhetta')
    live = {'forma': forma_live,
            'intensita': {'a': round(glob['a'], 5), 'lam': glob['lam'],
                          'formula': 'i(g) = a * exp(-g/lam)'},
            'durata': ({'per_fascia': {f'{f[0]}..{f[1]}': round(v, 3)
                                       for f, v in dur['per_fascia'].items()},
                        'globale': round(dur['globale'], 3)}
                       if vincitrice else {'globale': round(dur['globale'], 3)}),
            'kappa': round(kappa, 4) if forma_live.startswith('C2') else None,
            'soglia_incontro_s': CP.SOGLIA_INCONTRO,
            'finestra_post_restart': K_RESTART,
            'regime': '2022-25 (a effetto suolo)',
            'targhetta': T,
            'limite_onesto': ('si calcola SOLO contro il campo reale: le altre auto non '
                              'rallentano perche sei li, non si difendono, non cambiano '
                              'strategia. Dice "Leclerc diverso dentro la gara che E\' '
                              'successa", non "la gara che SAREBBE successa".'),
            'cieco_2026': ('Spearman(theta storico, theta 2026) = -0,024: il 2026 sul '
                           'sorpasso e scorrelato dal passato. Il modello nasce sul regime '
                           'storico; il 2026 si rafforza con l uso.')}
    print(json.dumps(live, ensure_ascii=False, indent=1))
    fuori['modello_live'] = live

    with open(os.path.join(QUI, 'esito_live.json'), 'w') as f:
        json.dump(fuori, f, ensure_ascii=False, indent=1, default=str)
        f.write('\n')
    with open(os.path.join(QUI, 'modello_traffico_live.json'), 'w') as f:
        json.dump(live, f, ensure_ascii=False, indent=1, default=str)
        f.write('\n')
    print('\n  scritti: esito_live.json, modello_traffico_live.json')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
