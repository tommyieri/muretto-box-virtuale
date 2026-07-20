"""gen_cancello_intragara.py — CANCELLO STRATO 1 (PREREG_SESSIONE_INTRAGARA.md).

Domanda unica: nella stessa gara, il degrado marginale dei primi 15 giri predice
quello dell'ultimo terzo meglio del prior climatologico archiviato?

Confronto tra due STIME (finestra iniziale vs prior) contro una MISURA (ultimo terzo),
a gara finita, in replay. Nessuna banda live costruita, nessun gancio toccato.

RIUSO (non reimplementato): igiene, fuel-corretto 3/70, plateau life>=3, guardia
gara-bagnata e quantili pesati vengono da gen_climatologia_degrado (una sola
definizione dei filtri). CONFINE: sola lettura; scrive SOLO
data/cancello_intragara.csv + data/CANCELLO_INTRAGARA_REPORT.txt.

Uso:
  python3 gen_cancello_intragara.py           # calcola e stampa (niente scrittura)
  python3 gen_cancello_intragara.py --write   # scrive CSV + report
"""
import sys, os, csv, statistics as st
import numpy as np
from gen_climatologia_degrado import (carica, quota_wet, stint_di_gara, righe_csv,
                                      raccogli, QUOTA_WET_MAX, TICACHE2CID, FOLDER2CID,
                                      L_PLATEAU_MIN)

ROOT = os.path.dirname(os.path.abspath(__file__))
CSV_CLIM = os.path.join(ROOT, 'data', 'climatologia_degrado.csv')
CSV_OUT = os.path.join(ROOT, 'data', 'cancello_intragara.csv')
TXT_OUT = os.path.join(ROOT, 'data', 'CANCELLO_INTRAGARA_REPORT.txt')

# soglie CONGELATE (prereg §2-§3, non ritoccate)
CALIB_LAP_MAX = 15          # finestra calibrazione: 2 <= lap <= 15
MIN_STINT_FINESTRA = 3      # >=3 stint misurabili per finestra
WIN_SOGLIA = 0.60           # vittorie live >= 60%
MIN_COPPIE = 8              # sotto: NON TESTABILE
B, SEED = 1000, 20260716
COLS = ['ramo', 'anno', 'gara', 'cid', 'compound', 'n_calib', 'stima_live',
        'n_target', 'bersaglio', 'prior_centrale', 'err_live', 'err_prior', 'vittoria_live']


def slope_finestra(rs, lap_lo, lap_hi):
    """pendenza OLS t_fc~life sui giri di plateau dentro [lap_lo, lap_hi], o None."""
    sub = [r for r in rs if lap_lo <= int(r['lap']) <= lap_hi and int(r['life']) >= L_PLATEAU_MIN]
    if len(sub) < 3 or len({int(r['life']) for r in sub}) < 2:
        return None
    x = np.array([int(r['life']) for r in sub], float)
    y = np.array([r['tfc'] for r in sub], float)
    return float(np.polyfit(x, y, 1)[0])


def misure_gara(path):
    """per (compound): (stima_live, n_calib, bersaglio, n_target) delle mediane per finestra."""
    rows = carica(path)
    if quota_wet(rows) > QUOTA_WET_MAX:
        return None, None   # gara bagnata: fuori (stessa guardia della climatologia)
    N = max(int(r['lap']) for r in rows if r['lap'] is not None)
    t_lo = int(np.ceil(2 * N / 3))
    calib, target = {}, {}
    for (drv, sid), rs in stint_di_gara(rows).items():
        comp = rs[0]['compound']
        sc = slope_finestra(rs, 2, CALIB_LAP_MAX)
        if sc is not None:
            calib.setdefault(comp, []).append(sc)
        stg = slope_finestra(rs, t_lo, N - 1)
        if stg is not None:
            target.setdefault(comp, []).append(stg)
    out = {}
    for comp in set(calib) | set(target):
        c, t = calib.get(comp, []), target.get(comp, [])
        out[comp] = dict(stima_live=(st.median(c) if len(c) >= MIN_STINT_FINESTRA else None),
                         n_calib=len(c),
                         bersaglio=(st.median(t) if len(t) >= MIN_STINT_FINESTRA else None),
                         n_target=len(t))
    return out, N


def prior_2026():
    """centrale del CSV climatologia archiviato (leave-2026-out), solo righe INFORMATIVA."""
    pri = {}
    with open(CSV_CLIM, newline='') as f:
        for r in csv.DictReader(f):
            if r['flag_k1'] == 'INFORMATIVA':
                pri[(r['compound'], r['cid'])] = float(r['banda_centrale_med'])
    return pri


def prior_2324():
    """secondario: prior 2023+2024 (pesi 2:1) ricalcolato con la STESSA catena e lo
    stesso flag K1 della climatologia (righe_csv su soli stint 2023-24)."""
    stints, _ = raccogli()
    s2324 = [s for s in stints if s['anno'] in (2023, 2024)]
    righe, _ = righe_csv(s2324, include_2026=False)
    return {(r['compound'], r['cid']): r['banda_centrale_med']
            for r in righe if r['flag_k1'] == 'INFORMATIVA'}


def gare_ramo(ramo):
    """[(anno, cid, label, path)] per il ramo primario (2026) o secondario (2025)."""
    out = []
    if ramo == 'primario':
        for f, cid in sorted(TICACHE2CID.items()):
            out.append((2026, cid, f'2026 {f}', os.path.join(ROOT, 'data', 'ti_cache', f + '.json')))
        out.append((2026, 'silverstone', '2026 British',
                    os.path.join(ROOT, 'data', 'ti_archive', '2026', 'British Grand Prix', 'Race.json')))
        # riesecuzione post-Spa (TODO voce 7): 10a gara 2026, KPI intatti.
        p_spa = os.path.join(ROOT, 'data', 'ti_archive', '2026', 'Belgian Grand Prix', 'Race.json')
        if os.path.exists(p_spa):
            out.append((2026, 'spa-francorchamps', '2026 Belgian', p_spa))
    else:
        base = os.path.join(ROOT, 'data', 'ti_archive', '2025')
        for folder in sorted(os.listdir(base)):
            cid = FOLDER2CID.get(folder)
            p = os.path.join(base, folder, 'Race.json')
            if cid and os.path.exists(p):
                out.append((2025, cid, f'2025 {folder}', p))
    return out


def valuta_ramo(ramo, prior):
    coppie, perse = [], {'gara_bagnata': 0, 'calib<3': 0, 'target<3': 0, 'prior_assente': 0}
    for anno, cid, label, path in gare_ramo(ramo):
        mis, N = misure_gara(path)
        if mis is None:
            perse['gara_bagnata'] += 1
            continue
        for comp, m in sorted(mis.items()):
            pr = prior.get((comp, cid))
            manca = []
            if m['stima_live'] is None: manca.append('calib<3')
            if m['bersaglio'] is None: manca.append('target<3')
            if pr is None: manca.append('prior_assente')
            if manca:
                for k in manca: perse[k] += 1
                continue
            el = abs(m['bersaglio'] - m['stima_live'])
            ep = abs(m['bersaglio'] - pr)
            win = 0.5 if round(el, 4) == round(ep, 4) else (1.0 if el < ep else 0.0)
            coppie.append(dict(ramo=ramo, anno=anno, gara=label, cid=cid, compound=comp,
                               n_calib=m['n_calib'], stima_live=m['stima_live'],
                               n_target=m['n_target'], bersaglio=m['bersaglio'],
                               prior_centrale=pr, err_live=el, err_prior=ep, vittoria_live=win))
    return coppie, perse


def bootstrap_ci(coppie):
    per_gara = {}
    for c in coppie:
        per_gara.setdefault(c['gara'], []).append(c['err_prior'] - c['err_live'])
    gare = sorted(per_gara)
    rng = np.random.default_rng(SEED)
    boots = []
    for _ in range(B):
        picks = rng.choice(len(gare), size=len(gare), replace=True)
        flat = [d for i in picks for d in per_gara[gare[i]]]
        boots.append(float(np.median(flat)))
    return float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))


def riassunto(nome, coppie, perse, decide):
    L = []
    w = L.append
    w(f'--- ramo {nome} ({"decide" if decide else "NON decide"}) ---')
    w(f'  coppie perse: ' + ', '.join(f'{k}={v}' for k, v in perse.items()))
    if not coppie:
        w('  0 coppie testabili.')
        return L, None
    wins = sum(c['vittoria_live'] for c in coppie)
    n = len(coppie)
    diffs = [c['err_prior'] - c['err_live'] for c in coppie]
    lo, hi = bootstrap_ci(coppie)
    w(f'  coppie testabili: {n} | vittorie live: {wins}/{n} = {wins/n:.1%} (soglia >= {WIN_SOGLIA:.0%})')
    w(f'  mediana(err_prior - err_live): {st.median(diffs):+.4f} s/giro | '
      f'IC95 bootstrap blocchi-gara [{lo:+.4f}, {hi:+.4f}] (B={B}, seed={SEED})')
    w(f'  errore mediano: live {st.median([c["err_live"] for c in coppie]):.4f} | '
      f'prior {st.median([c["err_prior"] for c in coppie]):.4f}')
    for c in coppie:
        w(f'    {c["gara"]:22s} {c["compound"]:6s} live {c["stima_live"]:+.4f}'
          f' (n={c["n_calib"]:2d}) | prior {c["prior_centrale"]:+.4f} | '
          f'bersaglio {c["bersaglio"]:+.4f} (n={c["n_target"]:2d}) | '
          f'err {c["err_live"]:.4f} vs {c["err_prior"]:.4f} -> {"LIVE" if c["vittoria_live"] == 1 else ("pari" if c["vittoria_live"] == 0.5 else "prior")}')
    esito = None
    if decide:
        if n < MIN_COPPIE:
            esito = ('NON TESTABILE', wins, n, (lo, hi))
        else:
            ok = (wins / n >= WIN_SOGLIA) and (st.median(diffs) > 0) and (lo > 0)
            esito = ('APERTO' if ok else 'NULL', wins, n, (lo, hi))
    return L, esito


def main():
    pri26 = prior_2026()
    cop26, per26 = valuta_ramo('primario', pri26)
    pri25 = prior_2324()
    cop25, per25 = valuta_ramo('secondario', pri25)

    L = []
    w = L.append
    w('=' * 78)
    w('CANCELLO INTRA-GARA (strato 1) — primi 15 giri vs prior climatologico')
    w('=' * 78)
    w('Protocollo: PREREG_SESSIONE_INTRAGARA.md (KPI congelato prima dei numeri).')
    w('')
    L1, esito = riassunto('PRIMARIO 2026', cop26, per26, decide=True)
    L += L1
    w('')
    L2, _ = riassunto('SECONDARIO 2025 (prior 2023-24, stessa catena)', cop25, per25, decide=False)
    L += L2
    w('')
    w('=' * 78)
    verdetto, wins, n, (lo, hi) = esito
    w(f'CANCELLO: {verdetto} — vittorie {wins:g}/{n} ({wins/n:.0%} se n>0), '
      f'IC95 mediana differenza [{lo:+.4f}, {hi:+.4f}]')
    w('Verdetto MECCANICO contro soglie congelate. Il verdetto strategico e\' del PO.')
    w('=' * 78)
    testo = '\n'.join(L)
    print(testo)

    if '--write' in sys.argv:
        with open(CSV_OUT, 'w', newline='') as f:
            wcsv = csv.writer(f)
            wcsv.writerow(COLS)
            for c in cop26 + cop25:
                wcsv.writerow([(f'{c[k]:.4f}' if isinstance(c[k], float) else c[k]) for k in COLS])
        open(TXT_OUT, 'w').write(testo + '\n')
        print(f'\nSCRITTO {CSV_OUT} ({len(cop26) + len(cop25)} righe) e {TXT_OUT}')


if __name__ == '__main__':
    main()
