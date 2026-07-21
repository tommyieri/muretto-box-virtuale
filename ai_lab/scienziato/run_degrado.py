#!/usr/bin/env python3
"""run_degrado.py — le tre capacita' dello scheletro puntate sul DEGRADO.

    python3 ai_lab/scienziato/run_degrado.py

Esce sempre 0. L'agente porta la X, decidono gli umani (regola d'ingaggio 90%/70%).
Prereg: PREREG_degrado.md — tutto dichiarato prima dei numeri.
"""
import json
import os
import statistics as st
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)

import carburante_fermo as CF
import degrado as DG
import fondo
import metro2
import percircuito as PC
import sigillo_null

FASCE = [(0, 0.5), (0.5, 1.0), (1.0, 1.5), (1.5, 2.0), (2.0, 2.5), (2.5, 3.0),
         (3.0, 4.0), (4.0, 5.0), (5.0, 8.0), (8.0, 1e9)]
MIN_CASI, MIN_GARE, QUOTA_NETTA, FATTORE_MARGINE = 30, 8, 0.60, 2.0


def riga(t):
    print('=' * 92)
    print(t)
    print('=' * 92)


def costruisci(eta_quadratica=False):
    """Modello per gara, dal fondo, col carburante congelato sottratto."""
    fuori = {}
    for b in fondo.elenco_blocchi():
        d = DG.prepara(b)
        if d is None:
            continue
        m = DG.stima(d, eta_quadratica=eta_quadratica)
        if 'escluso' in m:
            fuori[b['id']] = {'dati': d, 'modello': None, 'motivo': m['escluso']}
            continue
        fuori[b['id']] = {'dati': d, 'modello': m, 'motivo': None}
    return fuori


def misura_X(tabella, gare_cal, gare_ver, G, tol, etichetta):
    """La X: su quanti casi in aria libera la strategia ottima batte il reale."""
    casi, esclusi = [], {}
    for gid in gare_ver:
        t = tabella[gid]
        d, m = t['dati'], t['modello']
        if m is None or d['neutralizzata']:
            esclusi['gara neutralizzata o senza modello'] = \
                esclusi.get('gara neutralizzata o senza modello', 0) + 1
            continue
        pl = DG.pit_loss(d, m)
        if pl is None:
            esclusi['pit-loss non ricostruibile'] = esclusi.get('pit-loss non ricostruibile', 0) + 1
            continue
        cand = DG.strategie(m, d['N'], pl['pit_loss'])
        for drv in sorted(m['alpha']):
            v = DG.valuta_pilota(d, m, drv, pl['pit_loss'], G, tol, cand=cand)
            if 'escluso' in v:
                esclusi[v['escluso']] = esclusi.get(v['escluso'], 0) + 1
                continue
            v.update({'gara': gid, 'pilota': drv, 'circuito': d['circuito']})
            casi.append(v)
    vinti = [c for c in casi if c['vince']]
    gare = {c['gara'] for c in casi}
    return {'etichetta': etichetta, 'n_casi': len(casi), 'n_gare': len(gare),
            'n_vinti': len(vinti), 'quota': round(len(vinti) / len(casi), 4) if casi else None,
            'margine_mediano_vittorie': round(st.median([c['margine'] for c in vinti]), 3)
            if vinti else None,
            'tol': round(tol, 3), 'G_stella': G, 'esclusi': esclusi, 'casi': casi,
            'gare_calibrazione': sorted(gare_cal), 'gare_verifica': sorted(gare_ver)}


def main():
    if not sigillo_null.pretendi_integro('run_degrado.py'):
        return 0

    riga('(1) IL CARBURANTE CONGELATO COME INPUT')
    dic = CF.dichiarazione()
    print(f"  per-circuito VERI (regime a effetto suolo): {dic['per_circuito_veri']}")
    print(f"  globali per regime:                        {dic['globali_per_regime']}")
    print(f"  2026: {dic['nota_2026']}")
    print(f"  fonte: {dic['fonte']} — nessun numero riscritto a mano")

    tab = costruisci()
    ok = {k: v for k, v in tab.items() if v['modello']}
    print(f"\n  gare col modello stimabile: {len(ok)}/{len(tab)}")

    riga('(2) ARIA LIBERA — soglia G* derivata dai dati')
    per_gara = [DG.residui_per_gap(v['dati'], v['modello'], FASCE) for v in ok.values()]
    sog = DG.soglia_aria_libera(per_gara)
    print('  residuo mediano (osservato - previsto) per fascia di gap davanti:')
    for f in sog['per_fascia']:
        lo, hi = f['fascia']
        nome = f'{lo:.1f}-{hi:.1f}s' if hi < 1e8 else f'>{lo:.1f}s'
        if f['mediana'] is None:
            print(f"    {nome:12s} (poche gare)")
        else:
            print(f"    {nome:12s} mediana {f['mediana']:+7.3f}  IC95 {f['ci95']}  "
                  f"{'CONTIENE ZERO' if f['contiene_zero'] else 'traffico visibile'}")
    G = sog['G_stella']
    print(f"\n  G* = {G} s  ({sog['regola']})")

    riga('(3) C1 — la X grezza del modello lineare, per regime')
    fuori = {'carburante_congelato': dic, 'G_stella': G, 'soglia_aria': sog['per_fascia']}
    X = {}
    for reg in ('2022-25', '2026'):
        gare = sorted([g for g, v in ok.items()
                       if v['dati']['blocco']['regime'] == reg
                       and not v['dati']['neutralizzata']],
                      key=lambda g: ok[g]['dati']['blocco']['id'])
        if len(gare) < 4:
            print(f"  regime {reg}: solo {len(gare)} gare non neutralizzate — X non misurabile")
            X[reg] = {'n_gare_utili': len(gare), 'misurabile': False}
            continue
        cal, ver = gare[0::2], gare[1::2]
        # tol derivata SULLE SOLE GARE DI CALIBRAZIONE (68esimo percentile dello scarto)
        scarti = []
        for gid in cal:
            d, m = ok[gid]['dati'], ok[gid]['modello']
            pl = DG.pit_loss(d, m)
            if pl is None:
                continue
            for drv in sorted(m['alpha']):
                v = DG.valuta_pilota(d, m, drv, pl['pit_loss'], 0.0, 1e9)
                if 'scarto_calibrazione' in v:
                    scarti.append(abs(v['scarto_calibrazione']))
        if len(scarti) < 10:
            print(f"  regime {reg}: {len(scarti)} scarti di calibrazione — tol non derivabile")
            X[reg] = {'misurabile': False, 'n_scarti': len(scarti)}
            continue
        scarti.sort()
        tol = scarti[int(0.68 * len(scarti))]
        print(f"\n  regime {reg}: {len(gare)} gare utili — calibrazione {len(cal)}, "
              f"verifica {len(ver)}")
        print(f"    tol derivata (68mo percentile |sim(reale)-reale| in calibrazione) = "
              f"{tol:.2f} s  su {len(scarti)} casi")
        x = misura_X(ok, cal, ver, G, tol, reg)
        X[reg] = x
        quota = '--' if x['quota'] is None else f"{x['quota'] * 100:.1f}%"
        print(f"    X = {x['n_vinti']}/{x['n_casi']} casi in aria libera ({quota})  "
              f"su {x['n_gare']} gare")
        if x['margine_mediano_vittorie'] is not None:
            print(f"    margine mediano delle vittorie: {x['margine_mediano_vittorie']:.2f} s "
                  f"(serve >= {FATTORE_MARGINE*tol:.2f})")
        print('    esclusi:')
        for k, v in sorted(x['esclusi'].items(), key=lambda kv: -kv[1]):
            print(f"      {v:5d}  {k}")

    fuori['C1'] = {r: {k: v for k, v in x.items() if k != 'casi'} for r, x in X.items()}

    riga('CRITERIO DI STOP (dichiarato prima di misurare)')
    print(f"  abbastanza casi: >= {MIN_CASI} casi su >= {MIN_GARE} gare")
    print(f"  abbastanza netto: quota >= {QUOTA_NETTA:.0%} e margine mediano >= "
          f"{FATTORE_MARGINE} x tol")
    for reg, x in X.items():
        if not x.get('n_casi'):
            print(f"  regime {reg}: NON VALUTABILE")
            continue
        c1 = x['n_casi'] >= MIN_CASI and x['n_gare'] >= MIN_GARE
        c2 = (x['quota'] or 0) >= QUOTA_NETTA and \
             (x['margine_mediano_vittorie'] or 0) >= FATTORE_MARGINE * x['tol']
        print(f"  regime {reg}: casi {'OK' if c1 else 'INSUFFICIENTI'}, "
              f"nettezza {'OK' if c2 else 'NON RAGGIUNTA'} -> "
              f"{'FERMARSI QUI' if (c1 and c2) else 'C3 serve davvero'}")
        fuori['C1'][reg]['stop_raggiunto'] = bool(c1 and c2)

    # ------------------------------------------------------------------ C2
    riga('(4) C2 — dove fallisce, e la prima ipotesi: il degrado e per-circuito?')
    reg = '2022-25'
    x = X.get(reg, {})
    if x.get('casi'):
        persi = [c for c in x['casi'] if not c['vince']]
        vinti = [c for c in x['casi'] if c['vince']]
        print(f"  {len(persi)} casi persi su {x['n_casi']}. Raggruppati:")
        for chiave, f_et in (('circuito', lambda c: c['circuito']),
                             ('mescola della strategia ottima', lambda c: '+'.join(
                                 sorted(set(c['strategia']['mescole'])))),
                             ('n. soste ottime', lambda c: str(len(c['strategia']['lunghezze']) - 1)),
                             ('n. soste reali', lambda c: str(c['strategia_reale_soste']))):
            gruppi = {}
            for c in x['casi']:
                k = f_et(c)
                g = gruppi.setdefault(k, [0, 0])
                g[0] += 1
                g[1] += bool(c['vince'])
            print(f"    per {chiave}:")
            for k, (n, v) in sorted(gruppi.items(), key=lambda kv: kv[1][1] / kv[1][0]):
                print(f"      {k:24s} vince {v}/{n}")
        fuori['C2_cluster'] = {'n_persi': len(persi), 'n_vinti': len(vinti)}

    # --- il degrado e per-circuito? metro a due condizioni, soglia RIDERIVATA per il fenomeno
    print('\n  il degrado e PER-CIRCUITO? metro a due condizioni (segno stabile + distanza')
    print('  netta). La soglia del carburante (0,869 s) NON gli appartiene: si rideriva con')
    print('  la stessa procedura sigillata, al 5% di falsi positivi congiunti.')
    celle = {}
    for gid, v in ok.items():
        if v['dati']['blocco']['regime'] != reg:
            continue
        m = v['modello']
        if 'MEDIUM' not in m['rho']:
            continue
        anno, nome = gid.split(' ', 1)
        c = PC.ALIAS.get(nome, nome)
        celle.setdefault(c, {})[anno] = {'valore': m['rho']['MEDIUM'],
                                         'valore_ci95': [m['rho']['MEDIUM'] - 1.96 * m['se_rho']['MEDIUM'],
                                                         m['rho']['MEDIUM'] + 1.96 * m['se_rho']['MEDIUM']]}
    per_anno = {}
    for c, anni in celle.items():
        for a, cel in anni.items():
            per_anno.setdefault(a, []).append((cel['valore'], metro2._se(cel)))
    tre = {c: a for c, a in celle.items() if len(a) >= 3}
    print(f"\n  celle rho_MEDIUM: {sum(len(a) for a in celle.values())} su "
          f"{len(celle)} circuiti; con >=3 stagioni: {len(tre)}")
    if len(per_anno) >= 3 and tre:
        sog2 = metro2.soglia_da_nulla(per_anno, 3, repliche=4000)
        S2 = sog2['soglia']
        print(f"  soglia derivata per il DEGRADO (k=3): {S2:.4f} s/giro   "
              f"(falsi positivi della sola (i): {sog2['fp_solo_condizione_i']:.3f})")
        tutti = [cel['valore'] for a in celle.values() for cel in a.values()]
        veri = []
        for c, anni in sorted(tre.items()):
            ys = sorted(anni)[:3]
            val = [anni[y]['valore'] for y in ys]
            se = [metro2._se(anni[y]) for y in ys]
            G2 = metro2.globale_meno(tutti, val)
            g = metro2.giudica(val, se, G2, S2)
            if g['esito'] == 'PER-CIRCUITO VERO':
                veri.append(c)
            print(f"    {c:18s} {[round(v,4) for v in val]}  lato {g['lato']:8s} "
                  f"D={g['D']:.4f}  {g['esito']}")
        print(f"\n  PER-CIRCUITO VERI sul degrado: {len(veri)}/{len(tre)}  {veri}")
        fuori['C2_percircuito'] = {'soglia_degrado': S2, 'veri': veri,
                                   'n_circuiti_giudicabili': len(tre)}

    # ------------------------------------------------------------------ C3
    riga('(5) C3 — un termine, uno solo: degrado NON LINEARE (eta al quadrato)')
    print('  Suggerito da C2: se il degrado accelera a fine stint, il modello lineare')
    print('  sbaglia proprio dove la strategia si decide (quanto tirare uno stint).')
    tab2 = costruisci(eta_quadratica=True)
    ok2 = {k: v for k, v in tab2.items() if v['modello']}
    X2 = {}
    for reg2 in ('2022-25',):
        gare = sorted([g for g, v in ok2.items()
                       if v['dati']['blocco']['regime'] == reg2
                       and not v['dati']['neutralizzata']])
        if len(gare) < 4 or not X.get(reg2, {}).get('n_casi'):
            continue
        cal, ver = gare[0::2], gare[1::2]
        scarti = []
        for gid in cal:
            d, m = ok2[gid]['dati'], ok2[gid]['modello']
            pl = DG.pit_loss(d, m)
            if pl is None:
                continue
            for drv in sorted(m['alpha']):
                vv = DG.valuta_pilota(d, m, drv, pl['pit_loss'], 0.0, 1e9)
                if 'scarto_calibrazione' in vv:
                    scarti.append(abs(vv['scarto_calibrazione']))
        if len(scarti) < 10:
            continue
        scarti.sort()
        tol2 = scarti[int(0.68 * len(scarti))]
        x2 = misura_X(ok2, cal, ver, G, tol2, reg2 + ' (eta^2)')
        X2[reg2] = x2
        q1 = X[reg2]['quota'], X[reg2]['n_vinti'], X[reg2]['n_casi'], X[reg2]['tol']
        print(f"\n  X_vecchia (lineare)  : {q1[1]}/{q1[2]} = {q1[0]*100:.1f}%  tol {q1[3]:.2f} s")
        print(f"  X_nuova   (con eta^2): {x2['n_vinti']}/{x2['n_casi']} = "
              f"{(x2['quota'] or 0)*100:.1f}%  tol {x2['tol']:.2f} s")
        eta2 = [v['modello']['eta2'] for v in ok2.values()
                if v['dati']['blocco']['regime'] == reg2 and v['modello'].get('eta2')]
        if eta2:
            print(f"  coefficiente eta^2, mediana sulle gare: {st.median(eta2):+.5f} s/giro^2")
        meglio = (x2['quota'] or 0) > (X[reg2]['quota'] or 0)
        print(f"  -> il termine {'MIGLIORA' if meglio else 'NON migliora'} la X")
        fuori['C3'] = {'X_vecchia': {k: v for k, v in X[reg2].items() if k != 'casi'},
                       'X_nuova': {k: v for k, v in x2.items() if k != 'casi'},
                       'eta2_mediano': st.median(eta2) if eta2 else None,
                       'migliora': bool(meglio)}

    with open(os.path.join(QUI, 'esito_degrado.json'), 'w') as f:
        json.dump(fuori, f, ensure_ascii=False, indent=1, default=str)
        f.write('\n')
    with open(os.path.join(QUI, 'degrado_per_gara.csv'), 'w') as f:
        f.write('gara,regime,circuito,rho_SOFT,rho_MEDIUM,rho_HARD,beta,n_giri,n_stint,sigma\n')
        for gid, v in sorted(ok.items()):
            m, d = v['modello'], v['dati']
            f.write(f"{gid},{d['blocco']['regime']},{d['circuito']},"
                    + ','.join(str(round(m['rho'].get(c), 5)) if m['rho'].get(c) is not None
                               else '' for c in ('SOFT', 'MEDIUM', 'HARD'))
                    + f",{m['beta']:.5f},{m['n_giri']},{m['n_stint']},{m['sigma']:.3f}\n")
    print('\n  scritti: ai_lab/scienziato/esito_degrado.json, degrado_per_gara.csv')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
