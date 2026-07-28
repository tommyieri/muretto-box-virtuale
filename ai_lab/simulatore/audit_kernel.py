#!/usr/bin/env python3
"""audit_kernel.py — FASE 2, passo 0: IL KERNEL E' IN DISCUSSIONE.

    python3 ai_lab/simulatore/audit_kernel.py

Autorizzazione del PO, 28/07/2026: *"ciò che ho detto prima vale anche per il kernel. Anche
quello è in discussione, anche quello ci possono essere errori. Se ne trovi le puoi correggere,
anche se dà risultati precedenti alle fasi già fatte."*

Questo file NON corregge niente. Legge `engine/engine.py`, ne rifà `pace_base` riga per riga,
e MISURA quanto costano tre difetti che si vedono a occhio nel codice. Un difetto che non si
misura resta un'opinione.

I TRE, in ordine di come stanno nel file:

  D1  `_neut(s) = ('4' in s) or ('6' in s)`   (engine.py:20)
      L'alfabeto degli status e' {1,2,4,5,6,7} e sta scritto in data/STATUS_VOCABOLARIO_NOTA.md:
      **5 = BANDIERA ROSSA**, **2 = bandiera gialla di settore**. Il kernel li tratta da VERDI.
      Un giro di bandiera rossa contiene la sospensione: a Monaco sono ~38 minuti dentro un
      lap_time. Entra nella mediana del passo.

  D2  il filtro verde di `pace_base` non guarda la MESCOLA (engine.py:45)
      Un giro su INTERMEDIATE o WET entra nella mediana insieme agli slick. Il passo bagnato e
      il passo asciutto non sono la stessa grandezza.

  D3  `pace_base` non esclude i giri CANCELLATI
      Il grezzo ha la colonna `del`; `CarObs` non la porta nemmeno, quindi il kernel non puo'
      saperlo. Un giro cancellato dai commissari resta nel passo.

MISURA: si ricalcola `pace` con il filtro stretto e si guarda di quanto si sposta, per pilota
e per giro, sulle 11 gare 2026. Il confronto e' contro il `pace` VERO che il prodotto usa
(demo/data/<gara>.json), gia' verificato fedele al grezzo in Fase 0.
"""
import json
import os
import sys
from collections import defaultdict

import numpy as np

QUI = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(QUI))
sys.path.insert(0, os.path.join(ROOT, 'lab'))
import fondo  # noqa: E402

FUEL_COEFF = 3.0 / 70.0
MESCOLE = ('SOFT', 'MEDIUM', 'HARD')


def neut_kernel(s):
    """engine.py:20, copiato alla lettera."""
    s = str(s)
    return ('4' in s) or ('6' in s)


def pace_kernel(righe_pilota, N, L, filtro):
    """engine.py:41-48 rifatto. `filtro` decide quali giri sono 'verdi'."""
    obs = [righe_pilota[k] for k in sorted(righe_pilota) if int(righe_pilota[k]['lap']) <= L]
    if not obs:
        return None
    cur = obs[-1].get('stint')
    seg = [o for o in obs if o.get('stint') == cur and filtro(o)]
    if len(seg) < 3:
        return None
    fpl = 70.0 / N
    return float(np.median([float(o['time']) - max(0.0, 70.0 - fpl * (int(o['lap']) - 1)) * FUEL_COEFF
                            for o in seg]))


# --- i quattro filtri: quello del kernel, e i tre difetti tolti uno alla volta ---
def f_kernel(o):
    return (o.get('time') is not None and not neut_kernel(o.get('status'))
            and o.get('pin') is None and o.get('pout') is None)


def f_no_rosse(o):
    return f_kernel(o) and '5' not in str(o.get('status') or '')


def f_no_gialle(o):
    return f_no_rosse(o) and '2' not in str(o.get('status') or '')


def f_stretto(o):
    return (str(o.get('status') or '') == '1' and o.get('time') is not None
            and o.get('del') is not True and o.get('pin') is None and o.get('pout') is None
            and o.get('compound') in MESCOLE)


def main():
    with open(os.path.join(ROOT, 'data', 'gare_registro.json')) as f:
        reg = json.load(f)

    print('=' * 100)
    print('AUDIT DEL KERNEL — quanto costano i tre difetti di pace_base')
    print('=' * 100)

    # 1. quanti giri il kernel chiama VERDI e non lo sono
    conta = defaultdict(int)
    for demo, v in reg.items():
        for r in fondo.giri('2026', v['ti'], 'Race'):
            s = str(r.get('status') or '')
            if r.get('time') is None or r.get('pin') is not None or r.get('pout') is not None:
                continue
            verde_k = not neut_kernel(s)
            if not verde_k:
                continue
            conta['ammessi_dal_kernel'] += 1
            if '5' in s:
                conta['D1 bandiera ROSSA'] += 1
            elif '2' in s:
                conta['D1 bandiera gialla'] += 1
            elif s != '1':
                conta[f'D1 altro status non-1 ({s[:6]})'] += 1
            if r.get('compound') not in MESCOLE:
                conta['D2 mescola da bagnato'] += 1
            if r.get('del') is True:
                conta['D3 giro cancellato'] += 1

    print('\nGIRI CHE IL KERNEL CONTA COME VERDI (2026, 11 gare)')
    print(f"  {'ammessi dal filtro del kernel':38} {conta['ammessi_dal_kernel']:7d}")
    for k in sorted(conta):
        if k.startswith('D'):
            print(f'  {k:38} {conta[k]:7d}   '
                  f'({conta[k] / conta["ammessi_dal_kernel"] * 100:.2f}%)')

    # 2. di quanto si sposta il passo
    print('\nDI QUANTO SI SPOSTA IL PASSO (s/giro; positivo = il kernel dice PIU LENTO del vero)')
    print(f"  {'gara':16} {'celle':>7} {'D1 rosse':>10} {'D1+gialle':>11} {'tutto':>9} "
          f"{'max':>8} {'>0,10 s':>9}")
    tot = defaultdict(list)
    for demo, v in reg.items():
        righe = fondo.giri('2026', v['ti'], 'Race')
        per_pil = fondo.per_pilota(righe)
        N = max(int(r['lap']) for r in righe if r.get('lap') is not None)
        d1, d12, dtot = [], [], []
        for drv, laps in per_pil.items():
            for L in range(5, N + 1):
                a = pace_kernel(laps, N, L, f_kernel)
                if a is None:
                    continue
                b = pace_kernel(laps, N, L, f_no_rosse)
                c = pace_kernel(laps, N, L, f_no_gialle)
                d = pace_kernel(laps, N, L, f_stretto)
                if b is not None:
                    d1.append(a - b)
                if c is not None:
                    d12.append(a - c)
                if d is not None:
                    dtot.append(a - d)
        f = lambda v_: float(np.median(np.abs(v_))) if v_ else float('nan')  # noqa: E731
        mx = max((abs(x) for x in dtot), default=float('nan'))
        grandi = sum(1 for x in dtot if abs(x) > 0.10)
        print(f'  {demo:16} {len(dtot):7d} {f(d1):10.4f} {f(d12):11.4f} {f(dtot):9.4f} '
              f'{mx:8.2f} {grandi:9d}')
        tot['d1'] += d1; tot['d12'] += d12; tot['dtot'] += dtot

    dt = np.array(tot['dtot'])
    print(f"\n  TUTTE   celle {len(dt)}   scarto mediano assoluto {np.median(np.abs(dt)):.4f} s")
    print(f"          celle spostate di >0,10 s: {int((np.abs(dt) > 0.10).sum())} "
          f"({(np.abs(dt) > 0.10).mean() * 100:.2f}%)")
    print(f"          celle spostate di >0,50 s: {int((np.abs(dt) > 0.50).sum())} "
          f"({(np.abs(dt) > 0.50).mean() * 100:.2f}%)")
    print(f"          scarto massimo: {np.abs(dt).max():.2f} s")

    print('\nCOME LEGGERLO')
    print('  Il passo e una MEDIANA: un giro sporco su venti non la sposta. Percio lo scarto')
    print('  tipico e piccolo e le code sono grosse — ed e proprio nelle code che il difetto')
    print('  morde, perche li il pilota ha pochi giri validi nello stint e il giro sporco pesa.')


if __name__ == '__main__':
    main()
