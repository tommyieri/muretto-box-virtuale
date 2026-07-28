#!/usr/bin/env python3
"""degrado.py — FASE 0, passo 2: RICOSTRUIRE IL DEGRADO DAL GREZZO.

    python3 ai_lab/simulatore/degrado.py
    python3 ai_lab/simulatore/degrado.py --json ai_lab/simulatore/esito_degrado.json
    python3 ai_lab/simulatore/degrado.py --boot 2000

Pre-registrato in PREREG_fase0.md. Ogni scelta qui sotto e' li' dentro, scritta PRIMA.

NON LEGGE NESSUN DERIVATO. Non apre data/modello_degrado_2026.json, non apre demo/data/,
non apre nessun CSV di laboratorio. Solo il grezzo, via lab/fondo.py.

    t(d, L) = alpha_d + C_c + rho_c * life + Phi * L + eps

alpha_d  effetto fisso di pilota DENTRO la gara: ogni pilota fa da controllo di se stesso
C_c      livello della mescola (in questa gara, rispetto al riferimento)
rho_c    DEGRADO: secondi al giro per ogni giro di vita della gomma
Phi      DERIVA DI GARA: carburante ed evoluzione pista INSIEME. Non si chiama fuel
         perche' non e' il carburante da solo, e chiamarlo cosi' sarebbe una bugia comoda.

IDENTIFICAZIONE: dentro uno stint `life` e `L` crescono insieme di 1 (collineari). Cio' che
li separa e' la SOSTA: `life` si azzera, `L` no. Percio' servono piloti con >=2 stint.
"""
import argparse
import json
import os
import sys
from collections import defaultdict

import numpy as np

QUI = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(QUI))
sys.path.insert(0, os.path.join(ROOT, 'lab'))
import fondo  # noqa: E402

MESCOLE = ['SOFT', 'MEDIUM', 'HARD']
ESCLUSE = {'Monaco Grand Prix'}          # decisione PO (PREREG §2)
IQR_K = 1.5                              # taglio unilaterale del traffico (PREREG §5)
MIN_GIRI_STINT = 4                       # sotto, una mediana di stint non significa niente
MIN_PILOTI_2STINT = 10                   # sotto, la gara non identifica (PREREG §9)
SEED = 20260728


def verde_puro(r):
    """PREREG §3 — verde = status '1' esatto.

    lab/fondo.py::verde guarda solo i digit 4 (SC) e 6 (VSC): una BANDIERA ROSSA ('5') e una
    gialla di settore ('2') gli passano per verdi. Vocabolario in data/STATUS_VOCABOLARIO_NOTA.md.
    """
    return (str(r.get('status') or '') == '1'
            and r.get('time') is not None
            and r.get('del') is not True
            and r.get('pin') is None and r.get('pout') is None
            and r.get('compound') in MESCOLE
            and r.get('life') is not None
            and r.get('lap') is not None and int(r['lap']) > 1)


_CACHE = {}


def righe_gara(anno, gara, taglia_traffico=True):
    """Righe utili di una gara, gia' filtrate e ripulite dal traffico. Ritorna (righe, diagn).

    Il grezzo si legge UNA volta per gara: il bootstrap ricampiona le gare, non rilegge i file.
    """
    ck = (anno, gara, taglia_traffico)
    if ck in _CACHE:
        return _CACHE[ck]
    out = _righe_gara(anno, gara, taglia_traffico)
    _CACHE[ck] = out
    return out


def _righe_gara(anno, gara, taglia_traffico=True):
    per_pil = fondo.per_pilota(fondo.giri(anno, gara, 'Race'))
    grezze, tolti_traffico, tolti_corti = [], 0, 0
    piloti_2stint = 0

    for drv, laps in per_pil.items():
        per_stint = defaultdict(list)
        for lap in sorted(laps):
            r = laps[lap]
            if verde_puro(r):
                per_stint[int(r['stint'])].append(r)
        # quanti stint DISTINTI ha davvero corso (anche non verdi): serve all'identificazione
        stint_visti = {int(x['stint']) for x in laps.values() if x.get('stint') is not None}
        if len(stint_visti) >= 2:
            piloti_2stint += 1

        for s, righe in per_stint.items():
            if len(righe) < MIN_GIRI_STINT:
                tolti_corti += len(righe)
                continue
            t = np.array([float(x['time']) for x in righe])
            # TAGLIO UNILATERALE (PREREG §5): il traffico rallenta, non accelera.
            if taglia_traffico:
                q1, q3 = np.percentile(t, [25, 75])
                soglia = np.median(t) + IQR_K * (q3 - q1)
            else:
                soglia = float('inf')
            for x, tt in zip(righe, t):
                if tt > soglia:
                    tolti_traffico += 1
                    continue
                grezze.append({
                    'drv': drv, 'lap': int(x['lap']), 'life': float(x['life']),
                    'compound': x['compound'], 't': float(tt), 'stint': s,
                })
    return grezze, {'tolti_traffico': tolti_traffico, 'tolti_stint_corti': tolti_corti,
                    'piloti_con_2_stint': piloti_2stint}


def progetta(righe, per_mescola=True):
    """Matrice del disegno. Ritorna (X, y, nomi). Effetti fissi pilota assorbiti per centratura
    dentro-pilota: e' equivalente alle dummy e non fa esplodere il rango."""
    if not righe:
        return None, None, None
    drv = np.array([r['drv'] for r in righe])
    y = np.array([r['t'] for r in righe])
    life = np.array([r['life'] for r in righe])
    lap = np.array([float(r['lap']) for r in righe])
    comp = np.array([r['compound'] for r in righe])

    # RANGO — CORRETTO IL 28/07/2026, e la correzione va raccontata perche' e' una trappola
    # che il progetto aveva gia' a referto ("guardrail di rango, mai pinv silenziosa") e che
    # ho rifatto lo stesso. Le dummy di livello di TUTTE le mescole sommano al vettore
    # costante; la trasformazione within lo azzera; il disegno era a rango non pieno e
    # np.linalg.lstsq lo risolveva con una PSEUDO-INVERSA SILENZIOSA. Il livello di una
    # mescola e' identificato solo RISPETTO a un'altra: una fa da riferimento e non entra.
    # Le pendenze (rho) e Phi NON stanno nello spazio nullo, quindi non erano sbagliate —
    # ma questo va VERIFICATO, non affermato: vedi --confronta-rango.
    presenti = [m for m in MESCOLE if (comp == m).sum() >= MIN_GIRI_STINT]
    riferimento = presenti[0] if presenti else None
    cols, nomi = [], []
    if per_mescola:
        for m in presenti:
            d = (comp == m).astype(float)
            if m != riferimento:
                cols.append(d); nomi.append(f'C_{m}')
            cols.append(d * life); nomi.append(f'rho_{m}')
    else:
        for m in presenti:                     # i livelli restano separati, la pendenza no
            if m == riferimento:
                continue
            d = (comp == m).astype(float)
            cols.append(d); nomi.append(f'C_{m}')
        cols.append(life); nomi.append('rho_comune')
    cols.append(lap); nomi.append('Phi')
    X = np.column_stack(cols)

    # Effetti fissi pilota = trasformazione WITHIN (centratura dentro-pilota) di X e y.
    # Equivalente alle dummy per pilota, senza farne esplodere il numero. Vettorizzata con
    # bincount: il ciclo per-pilota costava piu' del bootstrap stesso.
    _, cod = np.unique(drv, return_inverse=True)
    n_g = cod.max() + 1
    cnt = np.bincount(cod, minlength=n_g).astype(float)
    for j in range(X.shape[1]):
        X[:, j] -= (np.bincount(cod, weights=X[:, j], minlength=n_g) / cnt)[cod]
    y = y - (np.bincount(cod, weights=y, minlength=n_g) / cnt)[cod]
    return X, y, nomi


def stima(righe, per_mescola=True):
    X, y, nomi = progetta(righe, per_mescola)
    if X is None or X.shape[0] <= X.shape[1] + 2:
        return None
    # GUARDRAIL DI RANGO ESPLICITO (metodo conservato del progetto): mai una pinv silenziosa.
    if np.linalg.matrix_rank(X) < X.shape[1]:
        return None
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    return dict(zip(nomi, beta))


def per_gara(anno, gare):
    """Stima gara per gara. Ritorna {gara: {'coef':..., 'n':..., 'diagn':...}}"""
    out = {}
    for g in gare:
        righe, diagn = righe_gara(anno, g)
        if diagn['piloti_con_2_stint'] < MIN_PILOTI_2STINT:
            out[g] = {'escluso': f"solo {diagn['piloti_con_2_stint']} piloti con >=2 stint",
                      'n': len(righe), 'diagn': diagn}
            continue
        out[g] = {'coef': stima(righe, True), 'coef_comune': stima(righe, False),
                  'n': len(righe), 'diagn': diagn,
                  'per_mescola_n': {m: sum(1 for r in righe if r['compound'] == m)
                                    for m in MESCOLE}}
    return out


def pooled(anno, gare, taglia_traffico=True):
    """Stima su tutte le gare insieme, con effetti fissi PILOTA-DENTRO-GARA (drv|gara)."""
    tutte = []
    for g in gare:
        righe, _ = righe_gara(anno, g, taglia_traffico)
        for r in righe:
            r = dict(r); r['drv'] = f"{g}|{r['drv']}"   # il pilota di UNA gara e' un'unita' a se
            tutte.append(r)
    return stima(tutte, True), stima(tutte, False), len(tutte)


def bootstrap_blocchi(anno, gare, n_boot, rng):
    """IC95 con ricampionamento delle GARE (PREREG §6), non delle righe."""
    cache = {}
    for g in gare:
        righe, _ = righe_gara(anno, g)
        cache[g] = righe
    keys = list(gare)
    acc = defaultdict(list)
    for _ in range(n_boot):
        scelte = rng.choice(len(keys), size=len(keys), replace=True)
        tutte = []
        for i, k in enumerate(scelte):
            g = keys[k]
            for r in cache[g]:
                r = dict(r); r['drv'] = f'{g}|{i}|{r["drv"]}'
                tutte.append(r)
        a = stima(tutte, True)
        b = stima(tutte, False)
        if a:
            for k2, v in a.items():
                acc[k2].append(v)
            if 'rho_SOFT' in a and 'rho_HARD' in a:
                acc['rho_SOFT_meno_HARD'].append(a['rho_SOFT'] - a['rho_HARD'])
        if b and 'rho_comune' in b:
            acc['rho_comune'].append(b['rho_comune'])
    return {k: (float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5)))
            for k, v in acc.items() if v}


def nullo_permutazione(anno, gare, n_perm, rng, osservato):
    """PREREG §6 — rimescola le ETICHETTE DI MESCOLA fra gli stint dentro (gara, pilota).

    Conserva macchina e momento della gara: cambia solo come si chiamava la gomma. Statistica
    = |rho_SOFT - rho_HARD|. p = quota di permutazioni che eguagliano o superano l'osservato.
    """
    base = {}
    for g in gare:
        righe, _ = righe_gara(anno, g)
        base[g] = righe
    piu_estremi = 0
    fatti = 0
    for _ in range(n_perm):
        tutte = []
        for g, righe in base.items():
            per_drv = defaultdict(lambda: defaultdict(list))
            for r in righe:
                per_drv[r['drv']][r['stint']].append(r)
            for drv, stints in per_drv.items():
                chiavi = list(stints)
                etich = [stints[s][0]['compound'] for s in chiavi]
                rng.shuffle(etich)
                for s, e in zip(chiavi, etich):
                    for r in stints[s]:
                        r2 = dict(r); r2['compound'] = e
                        r2['drv'] = f'{g}|{drv}'
                        tutte.append(r2)
        a = stima(tutte, True)
        if not a or 'rho_SOFT' not in a or 'rho_HARD' not in a:
            continue
        fatti += 1
        if abs(a['rho_SOFT'] - a['rho_HARD']) >= abs(osservato):
            piu_estremi += 1
    return (piu_estremi + 1) / (fatti + 1), fatti


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--anno', default='2026')
    ap.add_argument('--boot', type=int, default=2000)
    ap.add_argument('--perm', type=int, default=2000)
    ap.add_argument('--json')
    a = ap.parse_args()
    rng = np.random.default_rng(SEED)

    gare = [g for g in fondo.gare(a.anno, 'Race') if g not in ESCLUSE]
    print('=' * 100)
    print(f'DEGRADO RICOSTRUITO DAL GREZZO — {a.anno}, {len(gare)} gare (Monaco escluso)')
    print('pre-registrato in ai_lab/simulatore/PREREG_fase0.md — nessun derivato letto')
    print('=' * 100)

    pg = per_gara(a.anno, gare)
    print(f"{'gara':30} {'giri':>6} {'traff':>6} {'2stint':>7}   {'rho_S':>7} {'rho_M':>7} "
          f"{'rho_H':>7}   {'Phi':>8}")
    usate = []
    for g in gare:
        r = pg[g]
        if 'escluso' in r:
            print(f"{g[:30]:30} {r['n']:6d} {'':>6} {'':>7}   ESCLUSA: {r['escluso']}")
            continue
        usate.append(g)
        c = r['coef'] or {}
        f = lambda k: f"{c[k]:7.4f}" if k in c else '      —'  # noqa: E731
        print(f"{g[:30]:30} {r['n']:6d} {r['diagn']['tolti_traffico']:6d} "
              f"{r['diagn']['piloti_con_2_stint']:7d}   {f('rho_SOFT')} {f('rho_MEDIUM')} "
              f"{f('rho_HARD')}   {c.get('Phi', float('nan')):8.4f}")

    pm, pc, n = pooled(a.anno, usate)
    print()
    print(f'POOLED — {n} giri verdi puri, effetti fissi pilota-dentro-gara')
    print(f"  rho comune   {pc['rho_comune']:8.4f} s/giro per giro di vita gomma")
    for m in MESCOLE:
        if f'rho_{m}' in pm:
            print(f"  rho {m:7} {pm[f'rho_{m}']:8.4f}")
    print(f"  Phi          {pm['Phi']:8.4f} s per giro di gara  (carburante + evoluzione pista)")

    print(f'\nbootstrap sui blocchi (gare), {a.boot} ripetizioni…')
    ic = bootstrap_blocchi(a.anno, usate, a.boot, rng)

    def riga(k, etichetta, val):
        lo, hi = ic.get(k, (float('nan'), float('nan')))
        zero = 'contiene lo zero' if lo <= 0 <= hi else 'NON contiene lo zero'
        print(f'  {etichetta:24} {val:8.4f}   IC95 [{lo:8.4f} ; {hi:8.4f}]   {zero}')

    print()
    riga('rho_comune', 'rho comune', pc['rho_comune'])
    for m in MESCOLE:
        if f'rho_{m}' in pm:
            riga(f'rho_{m}', f'rho {m}', pm[f'rho_{m}'])
    d_sh = pm.get('rho_SOFT', float('nan')) - pm.get('rho_HARD', float('nan'))
    riga('rho_SOFT_meno_HARD', 'rho SOFT - rho HARD', d_sh)
    riga('Phi', 'Phi (deriva di gara)', pm['Phi'])

    print(f'\nnullo per permutazione delle mescole, {a.perm} ripetizioni…')
    p, fatti = nullo_permutazione(a.anno, usate, a.perm, rng, d_sh)
    print(f'  |rho_SOFT - rho_HARD| osservato = {abs(d_sh):.4f}')
    print(f'  p = {p:.4f}   ({fatti} permutazioni valide)')

    # --- le soglie del prereg, applicate ---
    print()
    print('=' * 100)
    print('SOGLIE DEL PREREG (§7) — verdetto')
    print('=' * 100)
    lo_c, hi_c = ic.get('rho_comune', (0, 0))
    s1 = not (lo_c <= 0 <= hi_c)
    lo_d, hi_d = ic.get('rho_SOFT_meno_HARD', (0, 0))
    s2 = (not (lo_d <= 0 <= hi_d)) and p < 0.05
    ordini = 0
    for g in usate:
        c = pg[g].get('coef') or {}
        if all(f'rho_{m}' in c for m in MESCOLE) and \
           c['rho_SOFT'] > c['rho_MEDIUM'] > c['rho_HARD']:
            ordini += 1
    s3 = ordini >= 7
    lo_p, hi_p = ic.get('Phi', (0, 0))
    print(f"  S1  la gomma degrada                    {'PASSA' if s1 else 'NON PASSA'}")
    print(f"  S2  le mescole degradano diversamente   {'PASSA' if s2 else 'NON PASSA'}"
          f"   (IC {'esclude' if not (lo_d <= 0 <= hi_d) else 'contiene'} lo zero, p={p:.3f})")
    print(f"  S3  ordine SOFT>MEDIUM>HARD spontaneo   {'PASSA' if s3 else 'NON PASSA'}"
          f"   ({ordini}/{len(usate)} gare)")
    print('  S4  Phi del kernel fuori dall IC         → §Phi qui sotto')

    print()
    print('S4 — CONFRONTO CON IL CARBURANTE DEL KERNEL')
    print('  il kernel (demo/engine.mjs via pace_base) usa 3,0 s su 70 kg, cioe una discesa')
    print('  di 3,0/N s per giro di gara. Qui Phi e misurato per giro, quindi si confronta')
    print('  Phi*N con -3,0 (segno negativo: i tempi SCENDONO col passare dei giri).')
    nl = {}
    for g in usate:
        righe = fondo.giri(a.anno, g, 'Race')
        nl[g] = max(int(r['lap']) for r in righe if r.get('lap') is not None)
    nmed = float(np.median(list(nl.values())))
    print(f'  giri di gara mediani: {nmed:.0f}')
    print(f'  Phi * N  = {pm["Phi"] * nmed:7.3f} s su tutta la gara'
          f'   IC95 [{lo_p * nmed:7.3f} ; {hi_p * nmed:7.3f}]')
    dentro = lo_p * nmed <= -3.0 <= hi_p * nmed
    print(f'  il -3,000 del kernel e {"DENTRO" if dentro else "FUORI"} dall IC95'
          f'  → S4 {"NON PASSA" if dentro else "PASSA"}')

    # --- §9: le condizioni che renderebbero nullo il lavoro, verificate ---
    print()
    print('CONDIZIONI DI VALIDITA (PREREG §9)')
    per_m = {m: sorted(pg[g]['per_mescola_n'].get(m, 0) for g in usate) for m in MESCOLE}
    ok9 = True
    for m in MESCOLE:
        med = float(np.median(per_m[m]))
        buono = med >= 30
        ok9 &= buono
        print(f'  giri verdi {m:7} per gara: mediana {med:6.1f}  min {per_m[m][0]:4d}'
              f'   {"ok" if buono else "SOTTO SOGLIA (30) → per-mescola non sostenibile"}')
    p2 = sorted(pg[g]['diagn']['piloti_con_2_stint'] for g in usate)
    print(f'  piloti con >=2 stint per gara: mediana {float(np.median(p2)):.1f}  min {p2[0]}'
          f'   {"ok" if np.median(p2) >= MIN_PILOTI_2STINT else "SOTTO SOGLIA"}')
    segni = [ic[f'rho_{m}'] for m in MESCOLE if f'rho_{m}' in ic]
    tutti_ambigui = all(lo <= 0 <= hi for lo, hi in segni) if segni else False
    print(f'  IC che coprono entrambi i segni su tutte le mescole: '
          f'{"SI → NULL" if tutti_ambigui else "no"}')

    # --- sensibilita: il taglio del traffico sta fabbricando il risultato? ---
    pm_nt, pc_nt, n_nt = pooled(a.anno, usate, taglia_traffico=False)
    print()
    print('SENSIBILITA — il taglio del traffico sta fabbricando il risultato?')
    print(f'  {"":26} {"con taglio":>12} {"senza taglio":>14}')
    print(f'  {"giri usati":26} {n:12d} {n_nt:14d}')
    print(f'  {"rho comune":26} {pc["rho_comune"]:12.4f} {pc_nt["rho_comune"]:14.4f}')
    print(f'  {"Phi":26} {pm["Phi"]:12.4f} {pm_nt["Phi"]:14.4f}')
    print('  (se rho cambia poco, il segnale non viene dai giri tolti)')

    if a.json:
        with open(a.json, 'w') as f:
            json.dump({
                'targhetta': {'anno': a.anno, 'gare_usate': usate, 'escluse': sorted(ESCLUSE),
                              'n_giri': n, 'boot': a.boot, 'perm': a.perm, 'seed': SEED,
                              'prereg': 'ai_lab/simulatore/PREREG_fase0.md',
                              'fonte': 'grezzo (ti_cache + ti_archive) via lab/fondo.py',
                              'nessun_derivato_letto': True},
                'pooled_per_mescola': pm, 'pooled_comune': pc,
                'ic95_blocchi_gara': ic,
                'nullo_permutazione': {'stat': 'abs(rho_SOFT - rho_HARD)',
                                       'osservato': d_sh, 'p': p, 'n': fatti},
                'per_gara': {g: pg[g].get('coef') for g in usate},
                'diagnostica': {g: pg[g].get('diagn') for g in usate},
                'soglie': {'S1': bool(s1), 'S2': bool(s2), 'S3': bool(s3),
                           'S3_gare_in_ordine': ordini, 'S4': bool(not dentro)},
                'validita_prereg_9': {'giri_per_mescola_per_gara': per_m,
                                      'piloti_2stint_per_gara': p2,
                                      'tutti_ic_ambigui': bool(tutti_ambigui)},
                'sensibilita_senza_taglio_traffico': {'n': n_nt, 'pooled_comune': pc_nt,
                                                      'pooled_per_mescola': pm_nt},
                'forma': 't(d,L) = alpha_d + C_c + rho_c*life + Phi*L',
                'nota_Phi': 'carburante ed evoluzione pista INSIEME: questi dati non li separano',
            }, f, indent=1, ensure_ascii=False)
        print(f'\nscritto {a.json}')


if __name__ == '__main__':
    main()
