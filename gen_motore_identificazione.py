#!/usr/bin/env python3
"""gen_motore_identificazione.py — separare CARBURANTE e DEGRADO dentro l'errore del motore.

    node gen_motore_appaiato.mjs        # produce data/motore_casi_bias.json
    python3 gen_motore_identificazione.py

LA DOMANDA. Il motore simula i piloti sistematicamente PIU VELOCI di come vanno davvero.
Due pezzi di fisica mancano, e sono entrambi candidati:
  - il CARBURANTE: `pace_base` sottrae il peso (passo a serbatoio vuoto) e `simulate` non lo
    ri-aggiunge mai;
  - il DEGRADO: `pace_base` e' la MEDIANA dello stint fino a qui, quindi e' misurato su gomme
    piu' giovani di quelle che correranno i giri simulati; `simulate` non modella l'eta.

Attribuirli a occhio non vale: si sommano nello stesso numero. Ma hanno FORME DIVERSE lungo
la gara — il carburante scende col giro-gara, l'eta-gomma sale dentro lo stint e si azzera a
ogni sosta — e questo li rende separabili:

    bias_per_giro = -(TOTALE/70)*kg_medi - rho*eta_extra + intercetta

L'INTERCETTA E' OBBLIGATORIA. Senza, la colonna dell'eta assorbe il livello e restituisce un
rho gonfiato: misurato, il placebo saliva a +0,0375 invece di stare sullo zero. Con
l'intercetta il placebo torna centrato (+0,0003) e il rho stimato e' solo forma.

PLACEBO (obbligatorio, teso prima di guardare): si rimescola l'eta-gomma FRA i casi tenendo
tutto il resto fermo. Se il coefficiente sopravvive al rimescolamento, non sta misurando
l'eta ma il livello. Blocchi = gare, sempre.
"""
import json
import os
import random

import numpy as np

QUI = os.path.dirname(os.path.abspath(__file__))
CASI = os.path.join(QUI, 'data', 'motore_casi_bias.json')
USCITA = os.path.join(QUI, 'data', 'motore_identificazione.json')

# riferimenti indipendenti, gia' a referto altrove (nessuno di questi entra nella stima)
RIF = {'kernel_engine_py': 3.000, 'fondo_2022_25': 3.151, 'fondo_2026': 2.1939,
       'rho_fondo_2026_MEDIUM': 0.0441, 'rho_fondo_2026_SOFT': 0.0541,
       'rho_fondo_2026_HARD': 0.0398}
SEED = 20260721


def carica():
    C = json.load(open(CASI))
    y = np.array([c['bias_per_giro'] for c in C])
    kg = np.array([c['kg'] for c in C])
    eta = np.array([c['eta_extra'] for c in C])
    X = np.column_stack([-kg / 70.0, -eta, np.ones(len(C))])
    return C, y, X, kg, eta, [c['gara'] for c in C]


def fit(X, y, idx):
    b, *_ = np.linalg.lstsq(X[idx], y[idx], rcond=None)
    return b


def main():
    C, y, X, kg, eta, gare = carica()
    G = sorted(set(gare))
    idxg = {g: np.array([i for i, x in enumerate(gare) if x == g]) for g in G}

    print('=' * 96)
    print('IDENTIFICAZIONE — carburante e degrado separati dentro l errore del motore')
    print('=' * 96)
    print(f'  casi {len(C)} su {len(G)} gare | orizzonti {sorted({c["S"] for c in C})}')
    print(f'  correlazione fra i due regressori: {np.corrcoef(kg, eta)[0, 1]:+.3f} '
          f'(bassa = separabili)   condizione {np.linalg.cond(X):.1f}')

    b = fit(X, y, np.arange(len(C)))
    rng = random.Random(SEED)
    bs = []
    for _ in range(2000):
        camp = np.concatenate([idxg[G[rng.randrange(len(G))]] for _ in G])
        try:
            bs.append(fit(X, y, camp))
        except Exception:
            pass
    bs = np.array(bs)
    ci = lambda i: [float(np.percentile(bs[:, i], 2.5)), float(np.percentile(bs[:, i], 97.5))]

    print(f"\n  {'grandezza':34s} {'stima':>9s}  {'IC95 a blocchi (gare)':>24s}")
    nomi = ['carburante totale (s su 70 kg)', 'rho degrado (s/giro per giro)',
            'intercetta (s/giro)']
    for i, n in enumerate(nomi):
        lo, hi = ci(i)
        print(f'  {n:34s} {b[i]:9.4f}  [{lo:+.4f}, {hi:+.4f}]')

    # --- il placebo
    fin = []
    for _ in range(400):
        p = list(eta)
        rng.shuffle(p)
        Xf = np.column_stack([-kg / 70.0, -np.array(p), np.ones(len(C))])
        fin.append(fit(Xf, y, np.arange(len(C)))[1])
    fin = np.array(fin)
    quota = float(np.mean(fin >= b[1]))
    print(f"\n  PLACEBO — eta-gomma rimescolata fra i casi (400 estrazioni):")
    print(f'    rho VERO   {b[1]:+.4f}')
    print(f'    rho FINTO  mediana {np.median(fin):+.4f}  '
          f'IC95 [{np.percentile(fin, 2.5):+.4f}, {np.percentile(fin, 97.5):+.4f}]')
    print(f'    finti che raggiungono il vero: {100 * quota:.1f} %  '
          f"-> {'il rho e FORMA, non livello' if quota < 0.05 else 'ATTENZIONE: e livello'}")

    # --- il confronto coi riferimenti indipendenti
    lo_f, hi_f = ci(0)
    lo_r, hi_r = ci(1)
    print(f'\n  I NUMERI TORNANO? (nessuno di questi riferimenti e entrato nella stima)')
    for nome, v in (('kernel engine.py', RIF['kernel_engine_py']),
                    ('fondo 2022-25', RIF['fondo_2022_25']),
                    ('fondo 2026', RIF['fondo_2026'])):
        dentro = lo_f <= v <= hi_f
        print(f"    carburante {nome:18s} {v:6.3f}  -> {'DENTRO' if dentro else 'FUORI'} l IC95 del motore")
    for nome, v in (('MEDIUM', RIF['rho_fondo_2026_MEDIUM']), ('SOFT', RIF['rho_fondo_2026_SOFT']),
                    ('HARD', RIF['rho_fondo_2026_HARD'])):
        dentro = lo_r <= v <= hi_r
        print(f"    rho fondo 2026 {nome:14s} {v:6.4f}  -> {'DENTRO' if dentro else 'FUORI'} l IC95 del motore")

    fuori = {'n_casi': len(C), 'n_gare': len(G),
             'correlazione_regressori': float(np.corrcoef(kg, eta)[0, 1]),
             'carburante_totale_s': float(b[0]), 'carburante_ci95': ci(0),
             'rho': float(b[1]), 'rho_ci95': ci(1),
             'intercetta': float(b[2]), 'intercetta_ci95': ci(2),
             'placebo': {'rho_vero': float(b[1]), 'rho_finto_mediano': float(np.median(fin)),
                         'rho_finto_ci95': [float(np.percentile(fin, 2.5)),
                                            float(np.percentile(fin, 97.5))],
                         'quota_finti_oltre_il_vero': quota,
                         'NULL NUOVO': 'non auto-sigillato: lo sigilla Tommi se il tavolo lo vuole'},
             'riferimenti_indipendenti': RIF}
    with open(USCITA, 'w') as f:
        json.dump(fuori, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'\n[scritto] {os.path.relpath(USCITA, QUI)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
