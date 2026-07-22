#!/usr/bin/env python3
"""gen_neutralizzazione_fondo.py — QUANTO VALE LA SAFETY CAR, per circuito, dal fondo.

    python3 gen_neutralizzazione_fondo.py            # scrive demo/data/neutralizzazione_fondo.json
    python3 gen_neutralizzazione_fondo.py --stampa   # guarda e basta

DUE NUMERI, e uno solo dei due era in casa (sbagliato).

1. QUANTO SPESSO ARRIVA, per circuito. Otto stagioni, non le dieci gare del 2026.

2. QUANTO COSTA FERMARSI SOTTO NEUTRALIZZAZIONE, misurato RELATIVAMENTE AL CAMPO.
   Il riferimento e' tutto, e prendere quello sbagliato ribalta il verdetto:
     - contro il PROPRIO passo verde  -> rapporto 2,19: "sotto SC fermarsi costa il doppio"
     - contro il CAMPO che non si e' fermato -> rapporto 0,79: "costa il 20% in meno"
   Il secondo e' quello che la strategia significa: perdo tempo CONTRO GLI ALTRI, e sotto
   neutralizzazione anche gli altri vanno piano. Il primo misura la Safety Car, non la sosta.
   Con il modo in cui e' fatto questo prodotto — una macchina instradata dentro una gara
   reale — il campo E' il riferimento, sempre.

MISURATO su 3.573 soste verdi e 636 neutralizzate, 2018-2026:
     verde 22,55 s · neutralizzata 18,58 s · risparmio 3,97 s · rapporto 0,79
     confronto dentro la stessa gara (66 gare): mediana 0,794, IQR [0,633, 1,023]
     costa meno in 49 gare su 66 = 74%  — NON e' una regola, e' una tendenza

E DOVE NON VALE, che e' la parte che serve di piu': a Monaco il rapporto e' 1,93 (2025) e
2,74 (2026) — sotto neutralizzazione fermarsi costa DI PIU', perche' si tuffano tutti
insieme e la pit lane si accoda. Un moltiplicatore unico avrebbe detto il contrario proprio
dove la risposta conta.

I NUMERI DI RIFERIMENTO CHE QUESTO SOSTITUISCE, tutti piu' ottimisti del vero:
     0,42  ratio di casa, orfano (nessun generatore)
     0,45  letteratura (sc_pit_factor)
     0,59-0,64  preview pubbliche 2026
Nessuno di questi e' misurato sul campo reale come riferimento.
"""
import argparse
import json
import os
import statistics as st
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, 'lab'))
sys.path.insert(0, ROOT)
from fondo import giri, gare, per_pilota, bagnata, piena, neutralizzato   # noqa: E402
from fondo_identita import cid                                            # noqa: E402

USCITA = os.path.join(ROOT, 'demo', 'data', 'neutralizzazione_fondo.json')
ANNI = ('2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026')
MIN_GARE = 4          # sotto, la quota non si pubblica: si dice che non si sa
MIN_SOSTE = 3


def _campo(byd, lap, escludi):
    v = []
    for d, g in byd.items():
        if d in escludi:
            continue
        c = g.get(lap)
        if c and c.get('time') is not None and c.get('pin') is None and c.get('pout') is None:
            v.append(c['time'])
    return st.median(v) if len(v) >= 6 else None


def soste_relative(anno, gara):
    """Perdita di OGNI sosta misurata contro il campo che non si e' fermato."""
    byd = per_pilota(giri(anno, gara))
    out = []
    for drv, g in byd.items():
        for lap in sorted(g):
            c = g[lap]
            if c.get('pin') is None:
                continue
            nx = g.get(lap + 1)
            if not nx or nx.get('pout') is None:
                continue
            if c.get('time') is None or nx.get('time') is None:
                continue
            k1, k2 = _campo(byd, lap, {drv}), _campo(byd, lap + 1, {drv})
            if k1 is None or k2 is None:
                continue
            p = (c['time'] - k1) + (nx['time'] - k2)
            if not (2 < p < 80):
                continue
            out.append((p, neutralizzato(c) or neutralizzato(nx)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stampa', action='store_true')
    a = ap.parse_args()

    freq = defaultdict(lambda: [0, 0])          # cid -> [gare, con neutralizzazione]
    rapporti = defaultdict(list)                # cid -> rapporti per gara
    tutti_v, tutti_n = [], []

    for anno in ANNI:
        for g in gare(anno):
            if not piena(anno, g):
                continue
            c = cid(g)
            if not c:
                continue
            righe = giri(anno, g)
            if not righe:
                continue
            freq[c][0] += 1
            if any(neutralizzato(x) for x in righe):
                freq[c][1] += 1
            if bagnata(anno, g):
                continue                        # sul bagnato la sosta e' un'altra cosa
            s = soste_relative(anno, g)
            v = [p for p, n in s if not n]
            n = [p for p, n in s if n]
            tutti_v += v
            tutti_n += n
            if len(v) >= 4 and len(n) >= MIN_SOSTE:
                rapporti[c].append(st.median(n) / st.median(v))

    glob_r = st.median([r for v in rapporti.values() for r in v]) if rapporti else None
    out = {
        '_nota': 'GENERATO da gen_neutralizzazione_fondo.py sul fondo 2018-2026. '
                 'La perdita e misurata CONTRO IL CAMPO che non si e fermato, non contro '
                 'il proprio passo verde: col riferimento sbagliato il verdetto si ribalta '
                 '(2,19 invece di 0,79).',
        'globale': {
            'perdita_verde_s': round(st.median(tutti_v), 2) if tutti_v else None,
            'perdita_neutralizzata_s': round(st.median(tutti_n), 2) if tutti_n else None,
            'rapporto': round(glob_r, 3) if glob_r else None,
            'n_verdi': len(tutti_v), 'n_neutralizzate': len(tutti_n),
            'quota_gare_in_cui_conviene': None,
        },
        'per_circuito': {},
    }
    tuttir = [r for v in rapporti.values() for r in v]
    if tuttir:
        out['globale']['quota_gare_in_cui_conviene'] = round(
            sum(1 for r in tuttir if r < 1) / len(tuttir), 3)

    for c, (tot, con) in sorted(freq.items()):
        voce = {'gare': tot,
                'con_neutralizzazione': con,
                # sotto MIN_GARE la quota non si pubblica: e' un null onesto
                'probabilita': round(con / tot, 3) if tot >= MIN_GARE else None}
        rr = rapporti.get(c) or []
        if len(rr) >= 2:
            voce['rapporto'] = round(st.median(rr), 3)
            voce['rapporto_n_gare'] = len(rr)
        else:
            voce['rapporto'] = None
            voce['rapporto_n_gare'] = len(rr)
        out['per_circuito'][c] = voce

    if a.stampa:
        gl = out['globale']
        print(f"globale: verde {gl['perdita_verde_s']} s · neutralizzata "
              f"{gl['perdita_neutralizzata_s']} s · rapporto {gl['rapporto']} "
              f"· conviene nel {gl['quota_gare_in_cui_conviene']:.0%} delle gare")
        print(f"\n{'circuito':20} {'gare':>5} {'prob':>6} {'rapporto':>9} {'n':>3}")
        for c, v in sorted(out['per_circuito'].items(),
                           key=lambda kv: -(kv[1]['probabilita'] or 0)):
            p = f"{v['probabilita']:.0%}" if v['probabilita'] is not None else '—'
            r = f"{v['rapporto']:.2f}" if v['rapporto'] is not None else '—'
            print(f"  {c:18} {v['gare']:5} {p:>6} {r:>9} {v['rapporto_n_gare']:3}")
        return 0

    os.makedirs(os.path.dirname(USCITA), exist_ok=True)
    with open(USCITA, 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'[scritto] {USCITA}  ({len(out["per_circuito"])} circuiti, '
          f'{out["globale"]["n_neutralizzate"]} soste neutralizzate)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
