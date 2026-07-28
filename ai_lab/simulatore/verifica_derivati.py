#!/usr/bin/env python3
"""verifica_derivati.py — FASE 0, passo 3a: i derivati che il motore mangia sono fedeli al grezzo?

    python3 ai_lab/simulatore/verifica_derivati.py

PERCHE' ESISTE. La regola di questo arco e' "non si eredita niente dai derivati". Ma il banco
del «quando» deve misurare IL MOTORE IN PRODUZIONE, e il motore in produzione mangia
demo/data/<gara>.json. Misurarlo su input diversi da quelli veri non misurerebbe il prodotto.

La via d'uscita non e' fidarsi: e' VERIFICARE. Se ogni fatto per-giro del derivato coincide
col grezzo, allora quel file e' una ri-serializzazione fedele e usarlo e' sicuro — e lo si sa,
invece di sperarlo. Se non coincide, la discrepanza e' un risultato di Fase 0.

Confronta, cella per cella (gara, giro, pilota):
    lap_time    <->  time
    compound    <->  compound
    tyre_age    <->  life
    in_lap      <->  pin non nullo          out_lap  <->  pout non nullo
    neutralized <->  status contiene 4 o 6  (criterio del generatore, NON quello del PREREG:
                     qui si verifica la fedelta al SUO criterio, non si giudica il criterio)
"""
import json
import os
import sys
from collections import Counter

QUI = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(QUI))
sys.path.insert(0, os.path.join(ROOT, 'lab'))
import fondo  # noqa: E402

DEMO = os.path.join(ROOT, 'demo', 'data')


def neutro_generatore(r):
    s = str(r.get('status') or '')
    return ('4' in s) or ('6' in s)


def main():
    with open(os.path.join(ROOT, 'data', 'gare_registro.json')) as f:
        reg = json.load(f)

    print('=' * 100)
    print('VERIFICA DEI DERIVATI CONTRO IL GREZZO — demo/data/<gara>.json vs ti_cache/ti_archive')
    print('=' * 100)
    print(f"{'gara':16} {'celle':>7} {'confrontate':>12} {'lap_time':>9} {'compound':>9} "
          f"{'eta':>6} {'in/out':>7} {'neutr':>7}")

    tot = Counter()
    for demo_nome, v in reg.items():
        p = os.path.join(DEMO, f'{demo_nome}.json')
        if not os.path.exists(p):
            print(f'{demo_nome:16} derivato assente')
            continue
        with open(p) as f:
            d = json.load(f)
        grezzo = fondo.per_pilota(fondo.giri('2026', v['ti'], 'Race'))

        celle = conf = 0
        diff = Counter()
        for lp in d['laps']:
            L = lp['lap']
            for drv, c in lp['cars'].items():
                celle += 1
                g = grezzo.get(drv, {}).get(L)
                if g is None:
                    diff['assente_nel_grezzo'] += 1
                    continue
                conf += 1
                if c.get('lap_time') is not None and g.get('time') is not None:
                    if abs(float(c['lap_time']) - float(g['time'])) > 1e-6:
                        diff['lap_time'] += 1
                elif (c.get('lap_time') is None) != (g.get('time') is None):
                    diff['lap_time'] += 1
                # LA TRAPPOLA DEL LETTERALE 'None'. Il grezzo scrive la STRINGA 'None' per i
                # mancanti; lab/fondo.py la ripulisce, l'esportatore della demo NO. Non e' una
                # divergenza di contenuto (grezzo e derivato dicono la stessa cosa), e' un
                # mancato lavaggio che arriva fino in pagina. Si conta a parte per non
                # confonderlo con un dato davvero diverso.
                cd, cg = c.get('compound'), g.get('compound')
                if cd == 'None' and cg is None:
                    diff['compound_letterale_None'] += 1
                elif cd != cg:
                    diff['compound'] += 1
                if g.get('life') is not None and c.get('tyre_age') is not None:
                    if int(c['tyre_age']) != int(g['life']):
                        diff['tyre_age'] += 1
                if bool(c.get('in_lap')) != (g.get('pin') is not None):
                    diff['in_lap'] += 1
                if bool(c.get('out_lap')) != (g.get('pout') is not None):
                    diff['out_lap'] += 1
                if bool(c.get('neutralized')) != neutro_generatore(g):
                    diff['neutralized'] += 1

        io = diff['in_lap'] + diff['out_lap']
        print(f"{demo_nome:16} {celle:7d} {conf:12d} {diff['lap_time']:9d} {diff['compound']:9d} "
              f"{diff['tyre_age']:6d} {io:7d} {diff['neutralized']:7d}")
        tot.update(diff)
        tot['celle'] += celle
        tot['confrontate'] += conf

    print()
    print(f"TOTALE: {tot['celle']} celle, {tot['confrontate']} confrontate col grezzo")
    campi = ['lap_time', 'compound', 'tyre_age', 'in_lap', 'out_lap', 'neutralized',
             'assente_nel_grezzo']
    for k in campi:
        n = tot[k]
        stato = 'IDENTICO' if n == 0 else f'{n} DIFFORMI'
        print(f'  {k:20} {stato}')
    ok = all(tot[k] == 0 for k in campi)
    print()
    print('VERDETTO SUL CONTENUTO: ' + (
        'i derivati sono una ri-serializzazione FEDELE del grezzo — usarli per misurare il '
        'motore in produzione e sicuro.' if ok else
        'i derivati DIVERGONO dal grezzo nel contenuto: e un risultato di Fase 0.'))

    n_lett = tot['compound_letterale_None']
    if n_lett:
        print()
        print(f'DIFETTO SEPARATO — il letterale "None" non lavato: {n_lett} celle')
        print('  Il grezzo scrive la STRINGA "None" per i mancanti. lab/fondo.py la ripulisce,')
        print('  l esportatore della demo no: in demo/data/ arriva compound = "None" (stringa).')
        print('  Non e un dato diverso, e un dato non lavato — ma viaggia fino in pagina.')
        print('  Effetto misurato: quelle celle escono da pace/gradino (il filtro verde vuole')
        print('  SOFT|MEDIUM|HARD), quindi il motore e SALVO; e la mescola mostrata all utente')
        print('  per quel pilota e sbagliata. Da chiudere alla fonte, nell esportatore.')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
