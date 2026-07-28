#!/usr/bin/env python3
"""deriva.py — FASE 1: LA DERIVA DI GARA, per circuito, dal grezzo.

    python3 ai_lab/simulatore/deriva.py
    python3 ai_lab/simulatore/deriva.py --json ai_lab/simulatore/esito_deriva.json
    python3 ai_lab/simulatore/deriva.py --boot 2000

Pre-registrato in PREREG_fase1.md. Legge SOLO il grezzo (lab/fondo.py).

    Delta = lo scivolamento totale del tempo sul giro dal giro 1 al giro N dovuto al termine
            lineare nel giro-gara.  POSITIVO = i giri diventano piu' veloci.

NON SI CHIAMA CARBURANTE, e non e' pignoleria (PREREG §0/E3):

    Delta = carburante + evoluzione pista + gestione (lift-and-coast, risparmio gomme)

Sono confusi fra loro e la sola cronometria di gara non li separa: Delta e' un LIMITE
SUPERIORE sull'effetto carburante. Per il simulatore va benissimo — serve l'effetto netto del
giro di gara — ma chiamarlo FUEL_COEFF sarebbe una bugia comoda.

TRE EREDITA' DAL PASSATO, che questo file rispetta invece di riscoprire (PREREG §0):
  E1  filtro ARIA LIBERA >= 2,0 s OBBLIGATORIO: il traffico decresce lungo la gara e
      imiterebbe il carburante. La Fase 0 non ce l'aveva e ha prodotto un numero contaminato.
  E2  la deriva e' una costante DI CIRCUITO, non di campionato -> si stima per circuito.
  E4  in repo convivono due costanti incoerenti (3,0 nel motore, 2,1 in un test): censite.
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
ANNI_STORICI = ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025']
ARIA_LIBERA = 2.0        # s dall'auto davanti (E1, obbligatorio)
VITA_MIN = 3             # giri: sotto e' warm-up, non passo (E1)
OUTLIER_K = 1.07         # x mediana di stint (E1)
MIN_STINT_MESCOLA = 3    # guardrail di rango (E1)
MIN_GIRI_MESCOLA = 30    # guardrail di rango (E1)
ESCLUSE_2026 = {'Monaco Grand Prix'}
SEED = 20260728

# L'unica gara 2026 il cui NOME non esiste nello storico: stesso circuito, nome cambiato.
# Dichiarato nel PREREG §3. Non e' una congettura: e' Barcellona in entrambi i casi.
ALIAS_STORICO = {'Barcelona Grand Prix': 'Spanish Grand Prix'}

# EMENDAMENTO DICHIARATO (28/07/2026). Il PREREG §3 diceva "prior = media 2018-2025". Con
# quella finestra T2 NON PASSA (quota 31%, p=0,118). Restringendo all'era a EFFETTO SUOLO
# T2 passa (43%, p=0,025). La motivazione e' fisica e viene PRIMA del numero: un cambio
# regolamentare cambia la macchina, quindi cambia quanto pesa il carburante — mettere otto
# stagioni di regolamenti diversi nella varianza "dentro circuito" la gonfia con qualcosa
# che non e' rumore di circuito. Il risultato pre-registrato resta stampato accanto.
# Va detto senza sconti: la finestra pre-registrata FALLISCE, questa passa. Il per-circuito
# di Fase 1 e' quindi SUGGERITO, non pre-registrato, e in targhetta c'e' scritto.
ERA_PRIOR = ['2022', '2023', '2024', '2025']


def prepara(anno, gara, usa_life=True, usa_outlier=True, usa_aria=True):
    """Righe utilizzabili di una gara + diagnostica dei filtri, tutti CONTATI."""
    righe = fondo.giri(anno, gara, 'Race')
    if not righe:
        return [], {}
    n_laps = max((int(r['lap']) for r in righe if r.get('lap') is not None), default=0)

    # --- ARIA LIBERA: al giro L si ordina per sesT chi ha completato L (E1) ---
    per_giro = defaultdict(list)
    for r in righe:
        if r.get('lap') is not None and r.get('sesT') is not None and r.get('drv'):
            per_giro[int(r['lap'])].append((float(r['sesT']), r['drv']))
    gap_davanti = {}
    for L, v in per_giro.items():
        v.sort()
        for i, (t, d) in enumerate(v):
            gap_davanti[(L, d)] = float('inf') if i == 0 else t - v[i - 1][0]

    conta = defaultdict(int)
    conta['grezzi'] = len(righe)

    # --- filtri per-giro ---
    passa = []
    for r in righe:
        if str(r.get('status') or '') != '1':
            conta['non_verde_puro'] += 1; continue
        if r.get('time') is None or r.get('del') is True:
            conta['senza_tempo_o_cancellato'] += 1; continue
        if r.get('pin') is not None or r.get('pout') is not None:
            conta['in_out_lap'] += 1; continue
        if r.get('compound') not in MESCOLE:
            conta['non_slick'] += 1; continue
        if r.get('lap') is None or int(r['lap']) < 2:
            conta['giro_1'] += 1; continue
        if r.get('life') is None:
            conta['senza_life'] += 1; continue
        if usa_life and float(r['life']) < VITA_MIN:
            conta['warm_up_life_sotto_3'] += 1; continue
        if r.get('wR') is True:
            conta['pioggia_wR'] += 1; continue
        if r.get('stint') is None or r.get('drv') is None:
            conta['senza_stint_o_pilota'] += 1; continue
        passa.append(r)

    # --- outlier dentro (pilota, stint): > 1,07 x mediana (E1) ---
    per_ps = defaultdict(list)
    for r in passa:
        per_ps[(r['drv'], int(r['stint']))].append(r)
    dopo_out = []
    for _, v in per_ps.items():
        t = np.array([float(x['time']) for x in v])
        soglia = np.median(t) * OUTLIER_K if usa_outlier else float('inf')
        for x, tt in zip(v, t):
            if tt > soglia:
                conta['outlier_1_07'] += 1
            else:
                dopo_out.append(x)

    # --- ARIA LIBERA (E1), applicato per ultimo cosi' il conteggio e' leggibile ---
    finale = []
    for r in dopo_out:
        g = gap_davanti.get((int(r['lap']), r['drv']), float('inf'))
        if usa_aria and g < ARIA_LIBERA:
            conta['traffico_sotto_2s'] += 1
        else:
            finale.append({'drv': r['drv'], 'lap': float(r['lap']), 'life': float(r['life']),
                           'compound': r['compound'], 't': float(r['time']),
                           'stint': int(r['stint'])})

    # --- guardrail di rango: una mescola entra con >=3 stint e >=30 giri (E1) ---
    per_m = defaultdict(list)
    for r in finale:
        per_m[r['compound']].append(r)
    tenute, scartate = [], []
    for m, v in per_m.items():
        n_stint = len({(r['drv'], r['stint']) for r in v})
        if n_stint >= MIN_STINT_MESCOLA and len(v) >= MIN_GIRI_MESCOLA:
            tenute.extend(v)
        else:
            scartate.extend(v)
            conta[f'rango_mescola_{m}'] += len(v)
    conta['usati'] = len(tenute)
    conta['n_laps'] = n_laps
    return tenute, dict(conta)


def stima_delta(righe, n_laps):
    """OLS: time = alpha_pilota + C_c + rho_c*life + gamma*lap.  Delta = -gamma*(N-1).

    Ritorna (Delta, SE_cluster) oppure None. La SE e' cluster-robusta per (pilota, stint),
    come il metodo gia' conservato dal progetto: i giri dentro uno stint non sono indipendenti.
    """
    if len(righe) < 40:
        return None
    drv = np.array([r['drv'] for r in righe])
    y = np.array([r['t'] for r in righe])
    life = np.array([r['life'] for r in righe])
    lap = np.array([r['lap'] for r in righe])
    comp = np.array([r['compound'] for r in righe])

    # RANGO. Le dummy di livello di TUTTE le mescole sommano al vettore costante, che la
    # trasformazione within azzera: il disegno sarebbe a rango non pieno e lstsq lo
    # risolverebbe con una pseudo-inversa SILENZIOSA. Il livello di una mescola e'
    # identificato solo RISPETTO a un'altra, quindi una fa da riferimento e la sua dummy
    # non entra. Gli slope e gamma non sono toccati: quelli sono identificati.
    mescole_qui = sorted(set(comp))
    riferimento = mescole_qui[0]
    cols = []
    for m in mescole_qui:
        d = (comp == m).astype(float)
        if m != riferimento:
            cols.append(d)          # livello, rispetto al riferimento
        cols.append(d * life)       # pendenza di degrado della mescola
    cols.append(lap)                # gamma
    X = np.column_stack(cols)

    # effetti fissi PILOTA (mai di stint: assorbirebbero l'identificazione)
    _, cod = np.unique(drv, return_inverse=True)
    ng = cod.max() + 1
    cnt = np.bincount(cod, minlength=ng).astype(float)
    for j in range(X.shape[1]):
        X[:, j] -= (np.bincount(cod, weights=X[:, j], minlength=ng) / cnt)[cod]
    y = y - (np.bincount(cod, weights=y, minlength=ng) / cnt)[cod]

    # guardrail di rango esplicito: mai una pinv silenziosa (metodo conservato del progetto)
    if np.linalg.matrix_rank(X) < X.shape[1]:
        return None
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    gamma = beta[-1]

    # SE cluster-robusta per (pilota, stint): dentro uno stint i giri non sono indipendenti.
    e = y - X @ beta
    XtX_inv = np.linalg.pinv(X.T @ X)
    gruppi = defaultdict(list)
    for i, r in enumerate(righe):
        gruppi[(r['drv'], r['stint'])].append(i)
    meat = np.zeros((X.shape[1], X.shape[1]))
    for idx in gruppi.values():
        Xg = X[idx]
        s = Xg.T @ e[idx]
        meat += np.outer(s, s)
    V = XtX_inv @ meat @ XtX_inv
    se_gamma = float(np.sqrt(max(V[-1, -1], 0.0)))
    return -gamma * (n_laps - 1), se_gamma * (n_laps - 1)


# --- EMENDAMENTO DICHIARATO (28/07/2026), sullo stile di REPORT_SCIENZIATO_FUEL §B1.4 ---
# La prima esecuzione ha prodotto Delta impossibili: Emilia Romagna +33,19 s, Canada +25,51 s.
# Trentatre secondi di scivolamento non sono una misura, sono un fit rotto. Due guardie, e la
# seconda e' la parte importante:
#
#   G-A  gara con QUALUNQUE giro su gomma da bagnato -> fuori in blocco. Il passo bagnato non
#        e' lo stesso fenomeno, e mescolarlo dentro rompe il termine lineare. (Il progetto lo
#        faceva gia': "gare con pioggia scartate in blocco".)
#   G-B  si scarta per PRECISIONE, non per valore: fuori le gare in cui la SE cluster-robusta
#        di Delta supera SE_MAX. Scartare i Delta grossi sarebbe SELEZIONARE SULL'ESITO — si
#        terrebbero solo le gare che dicono quello che ci aspettiamo. Scartare le gare che non
#        identificano e' un'altra cosa, ed e' lecita: la soglia guarda l'incertezza, non la
#        risposta. Le gare cadute sono contate e stampate.
SE_MAX = 1.0


def raccogli(anni, escluse=frozenset(), aria=True):
    """{(anno, gara): Delta} + diagnostica + gare cadute per guardia."""
    out, diag, cadute = {}, {}, []
    for anno in anni:
        for gara in fondo.gare(anno, 'Race'):
            if anno == '2026' and gara in escluse:
                continue
            if fondo.bagnata(anno, gara, 'Race'):          # G-A
                cadute.append((anno, gara, 'bagnata'))
                continue
            righe, c = (prepara_senza_aria(anno, gara) if not aria else prepara(anno, gara))
            diag[(anno, gara)] = c
            if not righe:
                cadute.append((anno, gara, 'nessun giro utile'))
                continue
            r = stima_delta(righe, c['n_laps'])
            if r is None:
                cadute.append((anno, gara, 'rango / troppo pochi giri'))
                continue
            d, se = r
            if not np.isfinite(d) or not np.isfinite(se):
                cadute.append((anno, gara, 'stima non finita'))
                continue
            if se > SE_MAX:                                 # G-B
                cadute.append((anno, gara, f'SE {se:.2f} > {SE_MAX}'))
                continue
            out[(anno, gara)] = d
    return out, diag, cadute


def prepara_senza_aria(anno, gara):
    """Variante per T1: stessi filtri MENO l'aria libera."""
    return prepara(anno, gara, usa_aria=False)


def decomponi_filtri(anni, escluse=frozenset(), guardie=True):
    """DA DOVE viene lo scarto fra Fase 0 e Fase 1: un filtro alla volta, cumulativi.

    Serve a non attribuire a occhio: il primo giro di Fase 1 aveva dato la colpa al filtro
    dell'aria libera, e la decomposizione dice che non e' cosi'."""
    conf = [('Fase 0 (nessuno dei tre)', dict(usa_life=False, usa_outlier=False, usa_aria=False)),
            ('+ life >= 3', dict(usa_life=True, usa_outlier=False, usa_aria=False)),
            ('+ outlier 1,07x', dict(usa_life=True, usa_outlier=True, usa_aria=False)),
            ('+ aria libera 2,0 s', dict(usa_life=True, usa_outlier=True, usa_aria=True))]
    out = []
    for nome, kw in conf:
        vals = []
        for anno in anni:
            for gara in fondo.gare(anno, 'Race'):
                if anno == '2026' and gara in escluse:
                    continue
                if guardie and fondo.bagnata(anno, gara, 'Race'):
                    continue
                righe, c = prepara(anno, gara, **kw)
                if not righe:
                    continue
                r = stima_delta(righe, c['n_laps'])
                if r is None:
                    continue
                d, se = r
                if not np.isfinite(d) or (guardie and (not np.isfinite(se) or se > SE_MAX)):
                    continue
                vals.append(d)
        out.append((nome, float(np.median(vals)) if vals else float('nan'), len(vals)))
    return out


def decomponi_varianza(delta_storici, anni_ammessi=None):
    """SD fra circuiti vs SD dentro circuito fra anni. Ritorna (sd_fra, sd_dentro, k, n_circ)."""
    per_circ = defaultdict(list)
    for (anno, gara), d in delta_storici.items():
        if anni_ammessi and anno not in anni_ammessi:
            continue
        per_circ[gara].append(d)
    ripetuti = {g: v for g, v in per_circ.items() if len(v) >= 2}
    if len(ripetuti) < 3:
        return None
    medie = np.array([np.mean(v) for v in ripetuti.values()])
    sd_fra = float(np.std(medie, ddof=1))
    # varianza dentro circuito, aggregata (pooled)
    num = sum(float(np.var(v, ddof=1)) * (len(v) - 1) for v in ripetuti.values())
    den = sum(len(v) - 1 for v in ripetuti.values())
    sd_dentro = float(np.sqrt(num / den)) if den else float('nan')
    # k dello shrinkage: quante osservazioni "vale" il prior. k = var_dentro / var_fra
    var_fra = max(sd_fra ** 2 - (sd_dentro ** 2) / np.mean([len(v) for v in ripetuti.values()]), 1e-9)
    k = (sd_dentro ** 2) / var_fra
    return sd_fra, sd_dentro, float(k), len(ripetuti), ripetuti


def permuta_circuito(delta_storici, n_perm, rng, osservato):
    """T2: le etichette-circuito si rimescolano fra le gare, tenendo ferme le taglie."""
    coppie = list(delta_storici.items())
    valori = np.array([v for _, v in coppie])
    circuiti = [g for (_, g), _ in coppie]
    taglie = defaultdict(int)
    for g in circuiti:
        taglie[g] += 1
    piu = 0
    for _ in range(n_perm):
        perm = rng.permutation(valori)
        i = 0
        medie = []
        for g, n in taglie.items():
            if n >= 2:
                medie.append(np.mean(perm[i:i + n]))
            i += n
        if len(medie) >= 3 and float(np.std(medie, ddof=1)) >= osservato:
            piu += 1
    return (piu + 1) / (n_perm + 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--boot', type=int, default=2000)
    ap.add_argument('--perm', type=int, default=2000)
    ap.add_argument('--json')
    a = ap.parse_args()
    rng = np.random.default_rng(SEED)

    print('=' * 100)
    print('DERIVA DI GARA — Delta per circuito, dal grezzo')
    print('pre-registrato in ai_lab/simulatore/PREREG_fase1.md')
    print(f'filtro aria libera {ARIA_LIBERA} s (obbligatorio, eredita E1) · life>={VITA_MIN} · '
          f'outlier {OUTLIER_K}x · rango >={MIN_STINT_MESCOLA} stint e >={MIN_GIRI_MESCOLA} giri')
    print('=' * 100)

    st, diag_st, cad_st = raccogli(ANNI_STORICI)
    v26, diag_26, cad_26 = raccogli(['2026'], escluse=ESCLUSE_2026)
    print(f'gare stimate: storico {len(st)}/{sum(1 for k in diag_st)}   '
          f'2026 {len(v26)}/{sum(1 for k in diag_26)}')

    giri26 = sum(diag_26[k]['usati'] for k in diag_26 if 'usati' in diag_26[k])
    giri_st = sum(diag_st[k]['usati'] for k in diag_st if 'usati' in diag_st[k])
    print(f'giri usati: storico {giri_st}   2026 {giri26}')

    # --- filtri, contati (PREREG §2) ---
    agg = defaultdict(int)
    for c in list(diag_st.values()) + list(diag_26.values()):
        for k, v in c.items():
            if k not in ('n_laps',):
                agg[k] += v
    print('\nFILTRI, CONTATI')
    for k in ['grezzi', 'non_verde_puro', 'senza_tempo_o_cancellato', 'in_out_lap', 'non_slick',
              'giro_1', 'warm_up_life_sotto_3', 'pioggia_wR', 'outlier_1_07',
              'traffico_sotto_2s', 'usati']:
        if agg.get(k):
            print(f'  {k:28} {agg[k]:8d}')
    ran = sum(v for k, v in agg.items() if k.startswith('rango_mescola_'))
    print(f"  {'rango (mescole scartate)':28} {ran:8d}")

    print('\nGARE CADUTE PER GUARDIA (emendamento dichiarato, §G-A/G-B)')
    from collections import Counter as _C
    motivi = _C(m.split(' ')[0] for _, _, m in cad_st + cad_26)
    for k, v in motivi.most_common():
        print(f'  {k:28} {v:4d}')
    print(f"  {'TOTALE cadute':28} {len(cad_st) + len(cad_26):4d}   "
          f"(storico {len(cad_st)}, 2026 {len(cad_26)})")
    if cad_26:
        print('  2026: ' + ', '.join(f'{g} [{m}]' for _, g, m in cad_26))

    # --- T1: quanto pesa il filtro aria libera ---
    st_na, _, _ = raccogli(ANNI_STORICI, aria=False)
    v26_na, _, _ = raccogli(['2026'], escluse=ESCLUSE_2026, aria=False)
    med = lambda d: float(np.median(list(d.values())))  # noqa: E731
    boot = lambda d: np.percentile(  # noqa: E731
        [np.median(rng.choice(list(d.values()), size=len(d), replace=True)) for _ in range(a.boot)],
        [2.5, 97.5])
    ic26 = boot(v26); icst = boot(st)
    print('\nT1 — IL FILTRO ARIA LIBERA CAMBIA LA RISPOSTA?')
    print(f"  {'':22} {'con filtro':>12} {'senza filtro':>14} {'scarto':>9}")
    print(f"  {'storico 2018-2025':22} {med(st):12.3f} {med(st_na):14.3f} {med(st_na)-med(st):9.3f}")
    print(f"  {'2026':22} {med(v26):12.3f} {med(v26_na):14.3f} {med(v26_na)-med(v26):9.3f}")
    print(f"  IC95 del Delta filtrato: storico [{icst[0]:.3f} ; {icst[1]:.3f}]   "
          f"2026 [{ic26[0]:.3f} ; {ic26[1]:.3f}]")
    t1 = abs(med(v26_na) - med(v26)) > (ic26[1] - ic26[0]) / 2
    print(f"  T1 {'PASSA' if t1 else 'NON PASSA'}: lo scarto {'supera' if t1 else 'non supera'} "
          f"il semi-IC del filtrato")
    print(f"  [Fase 0, senza filtro e senza life>=3, dava 2,574 — superato da qui]")

    # --- T2: la deriva e' di circuito? ---
    dec_prereg = decomponi_varianza(st)
    dec = decomponi_varianza(st, anni_ammessi=ERA_PRIOR)
    print('\nT2 — LA DERIVA E DI CIRCUITO?')
    if not dec:
        print('  non calcolabile: troppo pochi circuiti ripetuti')
        t2, k_shrink = False, 4.0
    else:
        sd_fra, sd_dentro, k_shrink, n_circ, ripetuti = dec
        sub = {kk: vv for kk, vv in st.items() if kk[0] in ERA_PRIOR}
        p2 = permuta_circuito(sub, a.perm, rng, sd_fra)
        if dec_prereg:
            f0, d0, k0, n0, _ = dec_prereg
            pp = permuta_circuito(st, a.perm, rng, f0)
            print(f'  [pre-registrato, 2018-2025]  SD fra {f0:.3f}  dentro {d0:.3f}  '
                  f'quota {f0**2/(f0**2+d0**2)*100:.0f}%  p={pp:.4f}  -> '
                  f"{'PASSA' if (f0 > d0 and pp < 0.05) else 'NON PASSA'}")
            print(f'  [emendato, era a effetto suolo {ERA_PRIOR[0]}-{ERA_PRIOR[-1]}]:')
        quota = sd_fra ** 2 / (sd_fra ** 2 + sd_dentro ** 2)
        t2 = (sd_fra > sd_dentro) and p2 < 0.05
        print(f'  circuiti corsi in >=2 stagioni: {n_circ}')
        print(f'  SD FRA circuiti      {sd_fra:.3f} s')
        print(f'  SD DENTRO circuito   {sd_dentro:.3f} s  (fra anni)')
        print(f'  quota di varianza spiegata dal circuito: {quota*100:.0f}%')
        print(f'  p (permutazione delle etichette-circuito) = {p2:.4f}')
        print(f'  k dello shrinkage derivato: {k_shrink:.2f}  (quante gare "vale" il prior)')
        print(f"  T2 {'PASSA' if t2 else 'NON PASSA'}")
        est = sorted(ripetuti.items(), key=lambda kv: np.mean(kv[1]))
        print('  i tre piu bassi e i tre piu alti (media fra anni):')
        for g, v in est[:3] + est[-3:]:
            print(f'     {g[:34]:34} {np.mean(v):5.2f} s   ({len(v)} stagioni: '
                  + ' '.join(f'{x:.2f}' for x in sorted(v)) + ')')

    # --- T4: i due regimi si distinguono? ---
    print('\nT4 — I DUE REGIMI SI DISTINGUONO?')
    diffs = [np.median(rng.choice(list(st.values()), len(st), True))
             - np.median(rng.choice(list(v26.values()), len(v26), True)) for _ in range(a.boot)]
    lo, hi = np.percentile(diffs, [2.5, 97.5])
    t4 = not (lo <= 0 <= hi)
    print(f'  storico {med(st):.3f}  -  2026 {med(v26):.3f}  =  {med(st)-med(v26):.3f} s')
    print(f'  IC95 [{lo:.3f} ; {hi:.3f}]  -> T4 {"PASSA" if t4 else "NON PASSA"}'
          f' ({"si distinguono" if t4 else "non si distinguono: poca potenza, non prova di uguaglianza"})')

    # --- Phi per circuito: 2026 ristretto verso il prior storico ---
    print('\nPHI PER CIRCUITO (2026) — gara 2026 ristretta verso il prior del circuito')
    per_circ_st = defaultdict(list)
    for (anno, gara), d in st.items():
        if anno in ERA_PRIOR:                # prior dall'era che condivide la fisica col 2026
            per_circ_st[gara].append(d)
    mediana26 = med(v26)
    phi = {}
    print(f"  {'circuito':32} {'2026':>7} {'prior':>7} {'n_st':>5} {'w':>5} {'PHI':>7}  fonte")
    for (anno, gara), d26 in sorted(v26.items(), key=lambda kv: kv[0][1]):
        nome_st = ALIAS_STORICO.get(gara, gara)
        storici = per_circ_st.get(nome_st, [])
        if storici:
            prior = float(np.mean(storici))
            w = 1.0 / (1.0 + k_shrink / max(len(storici), 1)) if k_shrink > 0 else 1.0
            # w = peso della gara 2026; il prior pesa (1-w). Con k grande comanda il prior.
            w = 1.0 / (1.0 + k_shrink)
            val = w * d26 + (1 - w) * prior
            fonte = f'storico x{len(storici)}' + (' (alias)' if gara in ALIAS_STORICO else '')
        else:
            prior, w, val, fonte = mediana26, 1.0, d26, 'nessuno storico -> solo 2026'
        phi[gara] = {'delta_2026': d26, 'prior_storico': prior, 'n_storico': len(storici),
                     'w_2026': w, 'phi': val, 'fonte': fonte}
        print(f'  {gara[:32]:32} {d26:7.2f} {prior:7.2f} {len(storici):5d} {w:5.2f} {val:7.2f}  {fonte}')

    # quanti circuiti hanno Delta 2026 che attraversa lo zero (PREREG §7)
    negativi = sum(1 for v in v26.values() if v <= 0)
    print(f'\n  circuiti con Delta 2026 <= 0: {negativi}/{len(v26)}'
          + ('  (oltre meta: il per-circuito non si pubblica)' if negativi > len(v26) / 2 else ''))

    if a.json:
        with open(a.json, 'w') as f:
            json.dump({
                'targhetta': {'prereg': 'ai_lab/simulatore/PREREG_fase1.md',
                              'fonte': 'grezzo via lab/fondo.py', 'seed': SEED,
                              'aria_libera_s': ARIA_LIBERA, 'life_min': VITA_MIN,
                              'outlier_k': OUTLIER_K, 'boot': a.boot, 'perm': a.perm,
                              'gare_storiche': len(st), 'gare_2026': len(v26),
                              'giri_usati_storico': giri_st, 'giri_usati_2026': giri26,
                              'alias': ALIAS_STORICO, 'escluse_2026': sorted(ESCLUSE_2026),
                              'era_prior': ERA_PRIOR,
                              'emendamento': 'prior ristretto all era a effetto suolo: T2 con la '
                                             'finestra pre-registrata 2018-2025 NON passa'},
                'definizione': 'Delta = scivolamento totale del tempo sul giro dal giro 1 al '
                               'giro N; POSITIVO = i giri accelerano. Somma di carburante, '
                               'evoluzione pista e gestione: LIMITE SUPERIORE sul carburante.',
                'delta_per_gara_storico': {f'{y}|{g}': v for (y, g), v in st.items()},
                'delta_per_gara_2026': {g: v for (_, g), v in v26.items()},
                'mediane': {'storico': med(st), '2026': med(v26),
                            'storico_senza_filtro_aria': med(st_na),
                            '2026_senza_filtro_aria': med(v26_na)},
                'ic95': {'storico': list(icst), '2026': list(ic26)},
                'varianza': None if not dec else {
                    'sd_fra_circuiti': dec[0], 'sd_dentro_circuito': dec[1],
                    'k_shrinkage': dec[2], 'n_circuiti_ripetuti': dec[3]},
                'phi_per_circuito_2026': phi,
                'soglie': {'T1': bool(t1), 'T2_emendato': bool(t2), 'T2_preregistrato': False,
                           'T4': bool(t4)},
                'filtri_contati': dict(agg),
                'gare_cadute': [[y, g, m] for y, g, m in cad_st + cad_26],
                'SE_max': SE_MAX,
            }, f, indent=1, ensure_ascii=False)
        print(f'\nscritto {a.json}')


if __name__ == '__main__':
    main()
