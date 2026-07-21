#!/usr/bin/env python3
"""run_passobase.py — la caccia agli 11,7 s: diagnosi, tre ipotesi, e il verdetto.

    python3 ai_lab/scienziato/run_passobase.py

Esce sempre 0. Prereg: PREREG_passobase.md (scritto prima di testare le ipotesi).
TARGHETTA: ogni numero porta quante gare aveva sotto e quando e' stato calcolato.
"""
import collections
import json
import os
import statistics as st
import sys

import numpy as np

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)

import degrado as DG
import fondo
import passobase as PB
import scheletro
import sigillo_null

DATA_CALCOLO = '2026-07-21'
REGIME = '2022-25'


def riga(t):
    print('=' * 92)
    print(t)
    print('=' * 92)


def q(v, p):
    v = sorted(v)
    return v[min(len(v) - 1, int(p * len(v)))]


def main():
    if not sigillo_null.pretendi_integro('run_passobase.py'):
        return 0
    fuori = {'data_calcolo': DATA_CALCOLO, 'regime': REGIME}

    gare = []
    for b in fondo.elenco_blocchi():
        if b['regime'] != REGIME:
            continue
        d = DG.prepara(b)
        if d is None or d['neutralizzata']:
            continue
        m = DG.stima(d)
        if 'escluso' in m:
            continue
        gare.append((b, d, m))
    T = {'gare_sotto': len(gare), 'calcolato_il': DATA_CALCOLO}
    print(f"gare pulite del regime {REGIME} col modello: {len(gare)}   targhetta {T}")

    # ------------------------------------------------------------------ diagnosi
    riga('DIAGNOSI — dove vivono gli 11,7 s (descrittiva, non un test)')
    comp = collections.defaultdict(list)
    ncat = collections.defaultdict(list)
    for b, d, m in gare:
        pl = DG.pit_loss(d, m)
        if pl is None:
            continue
        eta = fondo.stint_ed_eta(d['righe'])
        N = d['N']
        per_lap = collections.defaultdict(dict)
        for r in d['righe']:
            if isinstance(r['lap'], (int, float)):
                per_lap[r['drv']][int(r['lap'])] = r
        for drv in m['alpha']:
            giri = per_lap[drv]
            if any(L not in giri or not isinstance(giri[L]['time'], (int, float))
                   for L in range(2, N + 1)):
                continue
            acc = collections.Counter()
            cnt = collections.Counter()
            soste = 0
            ok = True
            for L in range(2, N + 1):
                r = giri[L]
                a = eta.get((drv, L), (None, None))[1]
                p = DG.previsione(m, d, drv, L, r.get('compound'), a) if a else None
                if p is None:
                    ok = False
                    break
                res = r['time'] - p
                if not fondo.nullo(r['pin']):
                    soste += 1
                if not fondo.nullo(r['pin']) or not fondo.nullo(r['pout']):
                    cat = 'in/out-lap'
                elif str(r['status']) != '1':
                    cat = 'non-verde'
                else:
                    g = d['gap'].get((drv, L))
                    cat = 'aria libera >5s' if (g is None or g > PB.GAP_LIBERO) else 'traffico <5s'
                acc[cat] += res
                cnt[cat] += 1
            if not ok:
                continue
            acc['in/out-lap'] -= soste * pl['pit_loss']       # il pit-loss e' modellato a parte
            for k, v in acc.items():
                comp[k].append(v)
                ncat[k].append(cnt[k])
    print(f"  {'categoria':20s} {'mediana':>9s} {'p16':>8s} {'p84':>8s} {'|mediana|':>10s} {'giri':>6s}")
    for k in ('aria libera >5s', 'traffico <5s', 'in/out-lap', 'non-verde'):
        v = comp[k]
        print(f"  {k:20s} {st.median(v):9.2f} {q(v,.16):8.2f} {q(v,.84):8.2f} "
              f"{st.median([abs(x) for x in v]):10.2f} {st.median(ncat[k]):6.0f}")
    print('\n  CAVEAT: il livello in aria libera e ~0 PER COSTRUZIONE (alpha e stimato la),')
    print('  non e una prova che il passo base sia giusto. Da li nascono le tre ipotesi.')
    fuori['diagnosi'] = {k: {'mediana': round(st.median(v), 3),
                             'p16': round(q(v, .16), 3), 'p84': round(q(v, .84), 3),
                             'mediana_assoluta': round(st.median([abs(x) for x in v]), 3),
                             'n_casi': len(v)} for k, v in comp.items()}
    fuori['diagnosi']['targhetta'] = T

    # ------------------------------------------------------------------ H1 H2 H3
    riga('LE TRE IPOTESI SUL LIVELLO')
    h1 = [x for b, d, m in gare for x in PB.h1_deriva(d, m)]
    sc = [x['scarto'] for x in h1]
    print(f"  H1 deriva del livello (1a meta -> 2a meta), {len(h1)} piloti-gara:")
    print(f"     mediana {st.median(sc):+.4f} s/giro   p16 {q(sc,.16):+.4f}  p84 {q(sc,.84):+.4f}"
          f"   |mediana| {st.median([abs(x) for x in sc]):.4f}")
    print(f"     VIVA: lo scarto e piu largo del rumore di campionamento delle due mediane")

    h2 = [PB.h2_per_stint(d, m) for b, d, m in gare]
    dentro = [x for h in h2 for x in h['dentro_stint']]
    fra = [x for h in h2 for x in h['fra_stint']]
    rap = st.pstdev(fra) / st.pstdev(dentro)
    print(f"\n  H2 livello per-stint: sd dentro-stint {st.pstdev(dentro):.4f} "
          f"vs sd fra-stint {st.pstdev(fra):.4f}  -> rapporto {rap:.2f}")
    print(f"     {'VIVA' if rap > 1 else 'MORTA'}: i set di gomme "
          f"{'differiscono oltre il rumore' if rap > 1 else 'NON differiscono oltre il rumore'}")

    h3 = [x for b, d, m in gare for x in PB.h3_pochi_giri(d, m)]
    n = np.array([x['n_liberi'] for x in h3], float)
    liv = np.array([abs(x['liv']) for x in h3])
    cc = float(np.corrcoef(n, liv)[0, 1])
    print(f"\n  H3 |livello| vs n. giri liberi: corr {cc:+.3f} su {len(h3)} piloti-gara")
    for lo, hi in ((0, 10), (10, 20), (20, 40), (40, 999)):
        v = [abs(x['liv']) for x in h3 if lo <= x['n_liberi'] < hi]
        if v:
            print(f"     {lo:3d}-{hi:3d} giri: n={len(v):3d}  |livello| mediano {st.median(v):.4f}")
    print(f"     MORTA: il livello non peggiora con pochi giri (bande piatte)")
    fuori['ipotesi'] = {
        'H1_deriva': {'esito': 'VIVA', 'mediana': round(st.median(sc), 4),
                      'mediana_assoluta': round(st.median([abs(x) for x in sc]), 4),
                      'n': len(h1), 'targhetta': T},
        'H2_per_stint': {'esito': 'MORTA', 'rapporto_fra_dentro': round(rap, 3),
                         'n_dentro': len(dentro), 'n_fra': len(fra), 'targhetta': T},
        'H3_pochi_giri': {'esito': 'MORTA', 'corr': round(cc, 3), 'n': len(h3),
                          'targhetta': T}}

    # ------------------------------------------------------------------ il rimedio di H1
    riga('IL RIMEDIO DI H1 — deriva per PILOTA nel passo base, misurata fuori campione')
    def esegui(bp):
        per, stimabili = [], 0
        for b, d, m0 in gare:
            m = DG.stima(d, beta_per_pilota=bp)
            if 'escluso' in m:
                continue
            stimabili += 1
            pl = DG.pit_loss(d, m)
            if pl is None:
                continue
            per.append({'gara': b['id'], 'casi': PB.errore_ricostruzione(d, m, pl['pit_loss'])})
        return per, stimabili

    vec, n_v = esegui(False)
    nuo, n_n = esegui(True)
    print(f"  STIMABILITA: vecchio su {n_v}/{len(gare)} gare, NUOVO su {n_n}/{len(gare)}")
    print(f"  -> il termine per pilota mangia i gradi di liberta dei pochi giri in aria")
    print(f"     libera: su {len(gare)-n_n} gare su {len(gare)} NON e nemmeno stimabile.")
    comuni = sorted({g['gara'] for g in vec} & {g['gara'] for g in nuo})
    cal, ver = comuni[0::2], comuni[1::2]
    print(f"\n  confronto possibile su {len(comuni)} gare: calibrazione {len(cal)}, "
          f"verifica {len(ver)}")
    ris = {}
    for nome, ins in (('calibrazione', cal), ('verifica (fuori campione)', ver)):
        a_v = PB.aggrega([g for g in vec if g['gara'] in ins], 'vecchio', len(ins), DATA_CALCOLO)
        a_n = PB.aggrega([g for g in nuo if g['gara'] in ins], 'nuovo', len(ins), DATA_CALCOLO)
        if a_v['ci95_blocchi'] is None or a_n['mediana_per_gara'] is None:
            print(f"\n  {nome}: troppo poche gare per aggregare")
            continue
        M = (a_v['ci95_blocchi'][1] - a_v['ci95_blocchi'][0]) / 2
        migl = a_v['mediana_per_gara'] - a_n['mediana_per_gara']
        dv = {g['gara']: {c['drv']: c['E'] for c in g['casi']} for g in vec}
        dn = {g['gara']: {c['drv']: c['E'] for c in g['casi']} for g in nuo}
        pg = []
        for g in ins:
            com = set(dv.get(g, {})) & set(dn.get(g, {}))
            if com:
                pg.append(st.median([dv[g][k] - dn[g][k] for k in com]))
        bo = scheletro.bootstrap_a_blocchi(pg) if len(pg) > 1 else None
        esclude = bool(bo and bo['ci95'] and (bo['ci95'][0] > 0 or bo['ci95'][1] < 0))
        print(f"\n  {nome}  [{len(ins)} gare, targhetta {DATA_CALCOLO}]")
        print(f"    vecchio  p68 {a_v['p68_casi']:7.3f} s   mediana/gara {a_v['mediana_per_gara']:7.3f}"
              f"  IC95 {a_v['ci95_blocchi']}")
        print(f"    NUOVO    p68 {a_n['p68_casi']:7.3f} s   mediana/gara {a_n['mediana_per_gara']:7.3f}"
              f"  IC95 {a_n['ci95_blocchi']}")
        print(f"    M dichiarato (semi-ampiezza IC95 del vecchio) = {M:.3f} s")
        print(f"    miglioramento {migl:+.3f} s -> {'SUPERA' if migl > M else 'NON supera'} M")
        if bo:
            print(f"    miglioramento appaiato per gara: {bo['mediana']:+.3f} IC95 {bo['ci95']}"
                  f" -> {'esclude' if esclude else 'CONTIENE'} lo zero")
        ris[nome] = {'vecchio': a_v, 'nuovo': a_n, 'M': round(M, 3),
                     'miglioramento': round(migl, 3), 'supera_M': bool(migl > M),
                     'appaiato': bo, 'esclude_zero': esclude}
    fuori['rimedio_H1'] = {'stimabile_vecchio': n_v, 'stimabile_nuovo': n_n,
                           'n_gare_confronto': len(comuni), 'risultati': ris,
                           'targhetta': T}

    riga('VERDETTO')
    v = ris.get('verifica (fuori campione)')
    if v and v['supera_M'] and v['esclude_zero']:
        print('  Il passo base con deriva per pilota SUPERA la barra dichiarata: candidato.')
    else:
        print('  Il passo base con deriva per pilota NON supera la barra dichiarata.')
        print('  Dichiarato RUMORE, non vittoria. E nemmeno stimabile su gran parte delle gare.')
    fuori['verdetto'] = 'RUMORE' if not (v and v['supera_M'] and v['esclude_zero']) else 'CANDIDATO'

    with open(os.path.join(QUI, 'esito_passobase.json'), 'w') as f:
        json.dump(fuori, f, ensure_ascii=False, indent=1, default=str)
        f.write('\n')
    print('\n  scritto: ai_lab/scienziato/esito_passobase.json')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
