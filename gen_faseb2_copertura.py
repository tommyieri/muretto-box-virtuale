"""gen_faseb2_copertura.py — FASE B 2a metà (PREREG_SESSIONE_FASEB2.md).

Cancello di CALIBRAZIONE: con la magnitudine M1, i tre scenari (banda q25/q50/q75
proiettata via M1) contengono il degrado cumulato OSSERVATO sui prossimi K giri, alla
copertura attesa? Replay 2026, dati veri della demo (pace_base = kernel). Monaco escluso.

CONFINE: sola lettura su demo/data + gare_registro; scrive SOLO data/faseb2_copertura.csv
+ data/FASEB2_COPERTURA_REPORT.txt. Kernel/gancio/golden: non toccati.

Uso:
  python3 gen_faseb2_copertura.py            # calcola e stampa
  python3 gen_faseb2_copertura.py --write     # scrive CSV + report
"""
import sys, os, csv, json
import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.join(ROOT, 'demo', 'data')
BANDE_PATH = os.path.join(DEMO, 'climatologia_bande.json')
CSV_OUT = os.path.join(ROOT, 'data', 'faseb2_copertura.csv')
TXT_OUT = os.path.join(ROOT, 'data', 'FASEB2_COPERTURA_REPORT.txt')

# soglie CONGELATE (prereg)
FUEL_COEFF = 3.0 / 70.0
K = 6
MIN_WINDOW = 3        # pace_base
MIN_FUT = 3           # >=3 giri futuri per il cumulato
QUOTA_WET_MAX = 0.05
COP_SOGLIA = 0.40
MIN_FINESTRE, MIN_GARE = 30, 4
B, SEED = 1000, 20260720
WET = ('INTERMEDIATE', 'WET')
SLICK = ('SOFT', 'MEDIUM', 'HARD')
COLS = ['gara', 'cid', 'drv', 'stint', 'compound', 'freezeL', 'A0', 'n_fut',
        'obs_cum', 'ott_cum', 'cen_cum', 'pess_cum', 'coperto',
        'obs_cum_live', 'ott_live', 'pess_live', 'coperto_live']


def demo_races():
    reg = json.load(open(os.path.join(ROOT, 'data', 'gare_registro.json')))
    g2c = {g: v.get('cid') for g, v in reg.items() if v.get('cid')}
    out = {}
    for fn in sorted(os.listdir(DEMO)):
        if not fn.endswith('.json'):
            continue
        gara = fn[:-5]
        if gara in g2c and g2c[gara] != 'monaco':
            out[gara] = (g2c[gara], os.path.join(DEMO, fn))
    return out


def fuel_corr(lt, lap, N):
    return lt - max(0.0, 70.0 - (70.0 / N) * (lap - 1)) * FUEL_COEFF


def quota_wet(laps):
    tot = wet = 0
    for lp in laps:
        for c in lp['cars'].values():
            if isinstance(c.get('compound'), str):
                tot += 1
                if c['compound'] in WET:
                    wet += 1
    return (wet / tot) if tot else 1.0


def verde(c):
    return (c.get('lap_time') is not None and c.get('tyre_age') is not None
            and not c.get('neutralized') and not c.get('in_lap') and not c.get('out_lap')
            and c.get('compound') in SLICK)


def raccogli():
    bande = json.load(open(BANDE_PATH))['per_cid']
    righe, escluse = [], []
    for gara, (cid, path) in demo_races().items():
        r = json.load(open(path))
        N = r['n_laps']
        if quota_wet(r['laps']) > QUOTA_WET_MAX:
            escluse.append((gara, 'bagnata'))
            continue
        per_cid = bande.get(cid, {})
        if not per_cid:
            escluse.append((gara, 'nessuna banda informativa'))
            continue
        pace = r['pace']
        byDrv = {}
        for lp in r['laps']:
            for d, c in lp['cars'].items():
                byDrv.setdefault(d, {})[c['lap']] = c
        for d, laps_d in byDrv.items():
            laps_sorted = sorted(laps_d)
            for L in laps_sorted:
                cL = laps_d[L]
                stint, comp = cL.get('stint'), cL.get('compound')
                if stint is None or comp not in SLICK or cL.get('tyre_age') is None:
                    continue
                terna = per_cid.get(comp)
                if not terna:
                    continue
                q25, q50, q75 = terna
                win = [laps_d[k] for k in laps_sorted if k <= L and laps_d[k].get('stint') == stint
                       and verde(laps_d[k])]
                if len(win) < MIN_WINDOW:
                    continue
                pb = pace.get(str(L), {}).get(d)
                if pb is None:
                    continue
                A0 = float(np.median([w['tyre_age'] for w in win]))
                fut = [laps_d[k] for k in laps_sorted if L < k <= min(L + K, N - 1)
                       and laps_d[k].get('stint') == stint and verde(laps_d[k])]
                if len(fut) < MIN_FUT:
                    continue
                obs_cum = sum(fuel_corr(w['lap_time'], w['lap'], N) - pb for w in fut)
                dA = [w['tyre_age'] - A0 for w in fut]
                ott = sum(q25 * x for x in dA)
                cen = sum(q50 * x for x in dA)
                pes = sum(q75 * x for x in dA)
                lo, hi = min(ott, pes), max(ott, pes)   # robustezza se q25<0
                coperto = int(lo <= obs_cum <= hi)
                # --- secondario: banda RICENTRATA sulla rate live (orienta) ---
                lives = [w['tyre_age'] for w in win]
                times = [fuel_corr(w['lap_time'], w['lap'], N) for w in win]
                rate_live = q50
                if len(set(lives)) >= 2:
                    rate_live = float(np.polyfit(np.array(lives, float), np.array(times, float), 1)[0])
                semi_lo, semi_hi = q50 - q25, q75 - q50
                ott_l = sum((rate_live - semi_lo) * x for x in dA)
                pes_l = sum((rate_live + semi_hi) * x for x in dA)
                lo_l, hi_l = min(ott_l, pes_l), max(ott_l, pes_l)
                coperto_l = int(lo_l <= obs_cum <= hi_l)
                righe.append(dict(gara=gara, cid=cid, drv=d, stint=stint, compound=comp,
                                  freezeL=L, A0=A0, n_fut=len(fut), obs_cum=obs_cum,
                                  ott_cum=ott, cen_cum=cen, pess_cum=pes, coperto=coperto,
                                  obs_cum_live=obs_cum, ott_live=ott_l, pess_live=pes_l,
                                  coperto_live=coperto_l))
    return righe, escluse


def boot_ci(vals, blocks):
    by = {}
    for v, b in zip(vals, blocks):
        by.setdefault(b, []).append(v)
    keys = sorted(by)
    rng = np.random.default_rng(SEED)
    out = []
    for _ in range(B):
        pick = rng.choice(len(keys), size=len(keys), replace=True)
        flat = [x for i in pick for x in by[keys[i]]]
        out.append(sum(flat) / len(flat) if flat else float('nan'))
    return float(np.percentile(out, 2.5)), float(np.percentile(out, 97.5))


def main():
    righe, escluse = raccogli()
    n = len(righe)
    gare = sorted({r['gara'] for r in righe})

    L = []
    w = L.append
    w('=' * 78)
    w('FASE B 2a metà — CALIBRAZIONE degli scenari (la banda M1 contiene la realtà?)')
    w('=' * 78)
    w('Protocollo: PREREG_SESSIONE_FASEB2.md. Copertura = obs_cum in [ottimistico,')
    w('pessimistico] sui prossimi giri; soglia congelata 40%.')
    w('')
    w('gare escluse: ' + (', '.join(f'{g} ({m})' for g, m in escluse) if escluse else 'nessuna'))
    w(f'finestre testabili: {n} | gare: {len(gare)}')
    if n < MIN_FINESTRE or len(gare) < MIN_GARE:
        w('')
        w(f'=> CALIBRAZIONE: NON TESTABILE (finestre {n}<{MIN_FINESTRE} o gare {len(gare)}<{MIN_GARE})')
        _finish(L, righe)
        return

    cop = [r['coperto'] for r in righe]
    blk = [r['gara'] for r in righe]
    copertura = sum(cop) / n
    lo, hi = boot_ci(cop, blk)
    sotto = sum(1 for r in righe if r['obs_cum'] < min(r['ott_cum'], r['pess_cum'])) / n
    sopra = sum(1 for r in righe if r['obs_cum'] > max(r['ott_cum'], r['pess_cum'])) / n
    cop_live = sum(r['coperto_live'] for r in righe) / n
    w('')
    w(f'COPERTURA (statica, banda climatologica M1): {copertura:.1%}  '
      f'IC95 blocchi-gara [{lo:.1%}, {hi:.1%}]  (soglia >= {COP_SOGLIA:.0%})')
    w(f'  miss sotto ottimistico (realtà meglio del best): {sotto:.1%} | '
      f'sopra pessimistico (peggio del worst): {sopra:.1%}')
    w('  per compound:')
    for c in SLICK:
        sub = [r['coperto'] for r in righe if r['compound'] == c]
        if sub:
            w(f'    {c:6s}: {sum(sub)/len(sub):.1%} (n={len(sub)})')
    w('  per circuito:')
    per_cir = {}
    for r in righe:
        per_cir.setdefault(r['cid'], []).append(r['coperto'])
    for cid, sub in sorted(per_cir.items()):
        w(f'    {cid:18s}: {sum(sub)/len(sub):.1%} (n={len(sub)})')
    w('')
    w(f'  [secondario, NON decide] banda RICENTRATA su rate live: {cop_live:.1%} '
      f'(delta {cop_live-copertura:+.1%})')
    w('')
    calibrata = copertura >= COP_SOGLIA
    w('=' * 78)
    if calibrata:
        w(f'CALIBRAZIONE: CALIBRATA — copertura {copertura:.1%} >= {COP_SOGLIA:.0%}. '
          'Gli scenari sono onesti sull\'orizzonte pit; accensione SCENARI_ATTIVI = PO.')
    else:
        w(f'CALIBRAZIONE: SOTTO-COPERTURA — copertura {copertura:.1%} < {COP_SOGLIA:.0%}. '
          'Scenari restano dormienti; miss dominante: '
          + ('sotto ottimistico (evoluzione-pista/rumore)' if sotto >= sopra else 'sopra pessimistico') + '.')
    w('Verdetto MECCANICO contro soglia congelata. Il verdetto strategico è del PO.')
    w('=' * 78)
    _finish(L, righe)


def _finish(L, righe):
    testo = '\n'.join(L)
    print(testo)
    if '--write' in sys.argv:
        with open(CSV_OUT, 'w', newline='') as f:
            wc = csv.writer(f)
            wc.writerow(COLS)
            for r in righe:
                wc.writerow([(f'{r[k]:.4f}' if isinstance(r[k], float) else r[k]) for k in COLS])
        open(TXT_OUT, 'w').write(testo + '\n')
        print(f'\nSCRITTO {CSV_OUT} ({len(righe)} righe) e {TXT_OUT}')


if __name__ == '__main__':
    main()
