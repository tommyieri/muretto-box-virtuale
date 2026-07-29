#!/usr/bin/env python3
"""run_traffico.py — il primo ingresso del traffico: il DELTA-PASSO.

    python3 ai_lab/scienziato/run_traffico.py

Esce sempre 0. Prereg: PREREG_traffico_deltapasso.md (scritto prima di misurare).
TARGHETTA su ogni numero: gare sotto, data di calcolo.
"""
import json
import os
import statistics as st
import sys

import numpy as np

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)

import degrado as DG
import fondo
import scheletro
import sigillo_null
import traffico as TR

DATA = '2026-07-21'
REGIMI = ('2022-25', '2026')


def riga(t):
    print('=' * 92)
    print(t)
    print('=' * 92)


def q(v, p):
    v = sorted(v)
    return v[min(len(v) - 1, int(p * len(v)))]


def boot_med(v, rip=2000, seed=20260721):
    import random
    rng = random.Random(seed)
    m = sorted(st.median([v[rng.randrange(len(v))] for _ in v]) for _ in range(rip))
    return st.median(v), [m[int(.025 * rip)], m[int(.975 * rip)]]


def carica(regime):
    fuori = []
    for b in fondo.elenco_blocchi():
        if b['regime'] != regime:
            continue
        d = DG.prepara(b)
        if d is None:
            continue
        m = DG.stima(d)
        if 'escluso' in m:
            continue
        fuori.append((b, d, m))
    return fuori


def valuta(mod, per_gara):
    """Errore assoluto mediano per gara (blocco)."""
    fuori = []
    for gid, inc in per_gara.items():
        if not inc:
            continue
        p = TR.prevedi(mod, inc)
        y = np.array([x['r'] for x in inc])
        fuori.append(float(np.median(np.abs(y - p))))
    return fuori


def main():
    if not sigillo_null.pretendi_integro('run_traffico.py'):
        return 0
    fuori = {'data_calcolo': DATA}

    riga('(4) LA DECISIONE SC/VSC — misurata, non assunta')
    gare = carica('2022-25')
    T = {'gare_sotto': len(gare), 'calcolato_il': DATA}
    print(f"  gare del regime a effetto suolo col modello di passo: {len(gare)}  targhetta {T}")

    # --- finestra di recupero K, derivata dai dati
    print('\n  residuo mediano contro "giri dalla fine dell\'ultima neutralizzazione":')
    per_dist = {}
    for b, d, m in gare:
        neut = TR.giri_neutralizzati(d['righe'])
        if not neut:
            continue
        inc = TR.incontri(d, m, neutralizzati=neut, finestra=0)
        for x in inc:
            ult = max((u for u in neut if u < x['lap']), default=None)
            if ult is None:
                continue
            per_dist.setdefault(min(x['lap'] - ult, 9), []).append(x['r'])
    K, prima_zero = None, None
    for dist in sorted(per_dist):
        v = per_dist[dist]
        if len(v) < 30:
            continue
        med, ci = boot_med(v)
        zero = ci[0] <= 0 <= ci[1]
        print(f"    {dist} giri dopo: n={len(v):5d}  residuo mediano {med:+.3f}  IC95 "
              f"[{ci[0]:+.3f},{ci[1]:+.3f}]  {'contiene zero' if zero else 'contaminato'}")
        if zero and prima_zero is None and dist < 9:
            prima_zero = dist
    # REGOLA DICHIARATA (prereg §4): K = la prima fascia il cui IC95 contiene lo zero,
    # meno uno (si buttano i giri fino a quello precedente incluso).
    K = (prima_zero - 1) if prima_zero else 3
    print(f"\n  finestra di recupero DERIVATA dalla regola dichiarata: K = {K} giri")
    print(f"  (primo giro-dopo-restart col residuo compatibile con zero: {prima_zero})")

    # --- il test dichiarato: la penalita' e' la stessa in gara normale e post-restart?
    normali, post = [], []
    per_gara_tutto = {}
    for b, d, m in gare:
        neut = TR.giri_neutralizzati(d['righe'])
        inc = TR.incontri(d, m, neutralizzati=neut, finestra=K)
        per_gara_tutto[b['id']] = inc
        for x in inc:
            (post if x['post_restart'] else normali).append(x)
    print(f"\n  incontri: {len(normali)} in gara normale, {len(post)} post-restart")
    fn, fp = TR.fit_M1(normali), TR.fit_M1(post)
    print(f"    M1 su gara normale : a={fn['a']:.3f}  lam={fn['lam']}  c={fn['c']:.3f}")
    print(f"    M1 su post-restart : a={fp['a']:.3f}  lam={fp['lam']}  c={fp['c']:.3f}")
    # confronto sui BLOCCHI: coefficiente c stimato per gara, nei due insiemi
    c_norm, c_post = [], []
    for gid, inc in per_gara_tutto.items():
        a = [x for x in inc if not x['post_restart']]
        b_ = [x for x in inc if x['post_restart']]
        if len(a) > 80:
            c_norm.append(TR.fit_M1(a)['c'])
        if len(b_) > 80:
            c_post.append(TR.fit_M1(b_)['c'])
    if len(c_norm) > 3 and len(c_post) > 3:
        mn, cin = boot_med(c_norm)
        mp, cip = boot_med(c_post)
        print(f"    c per gara — normale : mediana {mn:+.3f} IC95 [{cin[0]:+.3f},{cin[1]:+.3f}] "
              f"({len(c_norm)} gare)")
        print(f"    c per gara — restart : mediana {mp:+.3f} IC95 [{cip[0]:+.3f},{cip[1]:+.3f}] "
              f"({len(c_post)} gare)")
        compat = not (cin[1] < cip[0] or cip[1] < cin[0])
        print(f"    -> gli IC95 {'si SOVRAPPONGONO: post-restart = traffico vero, li TENGO' if compat else 'sono DISGIUNTI: traffico artificiale, filtro SEVERO'}")
    else:
        compat = False
        print('    -> troppe poche gare per il confronto: filtro SEVERO')
    fuori['sc_vsc'] = {'K': K, 'n_normali': len(normali), 'n_post': len(post),
                       'c_normale': fn['c'], 'c_post_restart': fp['c'],
                       'compatibili': bool(compat), 'targhetta': T}

    if not compat:
        gare_uso = [(b, d, m) for b, d, m in gare if not d['neutralizzata']]
        per_gara = {b['id']: TR.incontri(d, m) for b, d, m in gare_uso}
        print(f"\n  FILTRO SEVERO: {len(gare_uso)} gare")
    else:
        per_gara = {k: v for k, v in per_gara_tutto.items() if v}
        print(f"\n  FILTRO PER-GIRO: {len(per_gara)} gare (recuperate)")
    T2 = {'gare_sotto': len(per_gara), 'calcolato_il': DATA}

    riga('(2) IL TEST DELL\'ESEMPIO-GUIDA — chi ha un grande vantaggio di passo, passa?')
    tutti = [x for v in per_gara.values() for x in v]
    dur = TR.durata_incontri(tutti)
    print(f"  {len(dur)} incontri consecutivi entro 1,5 s. Giri passati dietro lo STESSO leader,")
    print('  per fascia di delta-passo (negativo = chi segue e piu veloce):')
    fasce = [(-99, -0.8), (-0.8, -0.4), (-0.4, -0.15), (-0.15, 0.15), (0.15, 99)]
    esempio = {}
    for lo, hi in fasce:
        v = [x['giri'] for x in dur if lo <= x['delta'] < hi]
        if len(v) < 10:
            continue
        med, ci = boot_med(v)
        nome = f'{lo:+.2f}..{hi:+.2f}' if lo > -90 else f'< {hi:+.2f}'
        print(f"    delta {nome:16s} n={len(v):5d}  giri mediani {med:.2f} "
              f"IC95 [{ci[0]:.2f},{ci[1]:.2f}]  media {st.mean(v):.2f}")
        esempio[nome] = {'n': len(v), 'giri_mediani': med, 'ci95': ci,
                         'media': round(st.mean(v), 3)}
    fuori['esempio_guida'] = {'per_fascia': esempio, 'targhetta': T2}

    riga('(3) LE FORME — M0 solo-gap contro M1 e M2 col delta-passo, fuori campione')
    gids = sorted(per_gara)
    cal, ver = gids[0::2], gids[1::2]
    inc_cal = [x for g in cal for x in per_gara[g]]
    print(f"  calibrazione {len(cal)} gare ({len(inc_cal)} incontri), verifica {len(ver)} gare")
    modelli = {'M0': TR.fit_M0(inc_cal), 'M1': TR.fit_M1(inc_cal), 'M2': TR.fit_M2(inc_cal)}
    for k, v in modelli.items():
        print(f"    {k}: {v}")
    ver_gara = {g: per_gara[g] for g in ver}
    e = {k: valuta(v, ver_gara) for k, v in modelli.items()}
    base_med, base_ci = boot_med(e['M0'])
    M = (base_ci[1] - base_ci[0]) / 2
    print(f"\n  errore assoluto mediano per gara, sulle gare di VERIFICA:")
    print(f"    M0 (solo gap)  {base_med:.4f} s  IC95 [{base_ci[0]:.4f},{base_ci[1]:.4f}]")
    print(f"    M dichiarato (semi-ampiezza IC95 di M0) = {M:.4f} s")
    ris = {}
    for k in ('M1', 'M2'):
        med, ci = boot_med(e[k])
        migl = base_med - med
        app = [a - b for a, b in zip(e['M0'], e[k])]
        bo = scheletro.bootstrap_a_blocchi(app)
        esclude = bool(bo['ci95'] and (bo['ci95'][0] > 0 or bo['ci95'][1] < 0))
        vince = bool(migl > M and esclude)
        print(f"    {k}  {med:.4f} s  IC95 [{ci[0]:.4f},{ci[1]:.4f}]   miglioramento "
              f"{migl:+.4f} -> {'SUPERA M' if migl > M else 'non supera M'}")
        print(f"        appaiato per gara {bo['mediana']:+.4f} IC95 {bo['ci95']} -> "
              f"{'esclude' if esclude else 'CONTIENE'} lo zero    ==> "
              f"{'CANDIDATO' if vince else 'RUMORE'}")
        ris[k] = {'errore': med, 'ci95': ci, 'miglioramento': round(migl, 4),
                  'supera_M': bool(migl > M), 'esclude_zero': esclude, 'esito':
                  'CANDIDATO' if vince else 'RUMORE', 'parametri': modelli[k]}
    fuori['forme'] = {'M0': {'errore': base_med, 'ci95': base_ci, 'parametri': modelli['M0']},
                      'M_dichiarato': round(M, 4), **ris, 'targhetta': T2}

    riga('IL PLACEBO — l\'effetto sopravvive con un leader a caso? (NULL NUOVO)')
    print('  Se sopravvive, il delta-passo sta misurando l\'errore di stima del passo di chi')
    print('  segue, non la fisica del traffico. AVVISO: funzione di ricampionamento NUOVA,')
    print('  non sigillata dall\'agente — va portata sotto sigillo dal tavolo.')
    pl_cal, pl_ver = [], []
    for b, d, m in gare:
        if b['id'] not in per_gara:
            continue
        p = TR.placebo_leader(per_gara[b['id']], d, m)
        (pl_cal if b['id'] in cal else pl_ver).append((b['id'], p))
    mod_pl = TR.fit_M1([x for _, v in pl_cal for x in v])
    e_pl = valuta(mod_pl, {g: v for g, v in pl_ver})
    e_pl0 = valuta(TR.fit_M0([x for _, v in pl_cal for x in v]), {g: v for g, v in pl_ver})
    m_pl, ci_pl = boot_med(e_pl)
    m_pl0, _ = boot_med(e_pl0)
    print(f"\n    placebo: c stimato {mod_pl['c']:+.3f} (vero: {modelli['M1']['c']:+.3f})")
    print(f"    placebo: miglioramento M1 su M0 = {m_pl0 - m_pl:+.4f} s "
          f"(vero: {base_med - ris['M1']['errore']:+.4f} s)")
    ok = abs(m_pl0 - m_pl) < abs(base_med - ris['M1']['errore']) / 2
    print(f"    -> {'il placebo NON riproduce l effetto: la fisica regge' if ok else 'ATTENZIONE: il placebo riproduce buona parte dell effetto'}")
    fuori['placebo'] = {'c_placebo': mod_pl['c'], 'c_vero': modelli['M1']['c'],
                        'miglioramento_placebo': round(m_pl0 - m_pl, 4),
                        'miglioramento_vero': round(base_med - ris['M1']['errore'], 4),
                        'regge': bool(ok), 'null_nuovo_da_sigillare': True, 'targhetta': T2}

    with open(os.path.join(QUI, 'esito_traffico.json'), 'w') as f:
        json.dump(fuori, f, ensure_ascii=False, indent=1, default=str)
        f.write('\n')
    print('\n  scritto: ai_lab/scienziato/esito_traffico.json')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
