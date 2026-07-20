"""gen_faseb_magnitudine.py — FASE B (PREREG_SESSIONE_FASEB.md).

Valida in REPLAY la magnitudine corretta della penalita' di degrado da sommare a
pace_base. Confronta M0 (gancio attuale, rate*(A-1)), M1 (rate*(A-A0), A0=mediana life
del window pace_base) e M2 (rate*(A-A_cur)) contro il residuo OSSERVATO
res_oss(A) = tempo_fuel_corretto(A) - pace_base, sui primi K giri verdi successivi.

Usa i DATI VERI della demo (demo/data/<gara>.json): pace[L][drv] E' la pace_base
autorevole del prodotto (calcolata dal kernel). Nessuna ristima. Monaco escluso
(CID_NO_DEGRADO), gare bagnate escluse. rate = banda centrale INFORMATIVA
(demo/data/climatologia_bande.json). NON tocca il gancio: i tre modelli sono solo
diverse forme dell'incremento, tutte ottenibili come adapter di tyreAge0 (dichiarato in
prereg); qui si calcolano in chiaro per il confronto.

CONFINE: sola lettura; scrive SOLO data/faseb_magnitudine.csv +
data/FASEB_MAGNITUDINE_REPORT.txt.

Uso:
  python3 gen_faseb_magnitudine.py           # calcola e stampa
  python3 gen_faseb_magnitudine.py --write    # scrive CSV + report
"""
import sys, os, csv, json, statistics as st
import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.join(ROOT, 'demo', 'data')
BANDE_PATH = os.path.join(DEMO, 'climatologia_bande.json')
CSV_OUT = os.path.join(ROOT, 'data', 'faseb_magnitudine.csv')
TXT_OUT = os.path.join(ROOT, 'data', 'FASEB_MAGNITUDINE_REPORT.txt')

# soglie CONGELATE (prereg §2-§4)
FUEL_COEFF = 3.0 / 70.0
K = 6                      # orizzonte: primi 6 giri verdi successivi al freeze
MIN_WINDOW = 3            # pace_base definita: >=3 giri verdi nello stint fino a L
QUOTA_WET_MAX = 0.05
BIAS_QUASI_NULLO = 0.03   # s/giro: |bias| sotto cui il modello e' "quasi-nullo"
MIN_COPPIE, MIN_GARE = 30, 4
B, SEED = 1000, 20260720
WET = ('INTERMEDIATE', 'WET')
SLICK = ('SOFT', 'MEDIUM', 'HARD')
COLS = ['gara', 'cid', 'drv', 'stint', 'compound', 'freezeL', 'A0', 'Acur', 'Afut',
        'rate', 'res_oss', 'pred_M0', 'pred_M1', 'pred_M2', 'err_M0', 'err_M1', 'err_M2']


def demo_races():
    """gara -> path per le gare demo (esclude Monaco: CID_NO_DEGRADO)."""
    reg = json.load(open(os.path.join(ROOT, 'data', 'gare_registro.json')))
    g2c = {g: v.get('cid') for g, v in reg.items() if v.get('cid')}
    out = {}
    for fn in sorted(os.listdir(DEMO)):
        if not fn.endswith('.json'):
            continue
        gara = fn[:-5]
        if gara not in g2c:
            continue
        if g2c[gara] == 'monaco':
            continue
        out[gara] = (g2c[gara], os.path.join(DEMO, fn))
    return out


def fuel_corr(lap_time, lap, N):
    return lap_time - max(0.0, 70.0 - (70.0 / N) * (lap - 1)) * FUEL_COEFF


def quota_wet(laps):
    tot = wet = 0
    for lp in laps:
        for c in lp['cars'].values():
            if isinstance(c.get('compound'), str):
                tot += 1
                if c['compound'] in WET:
                    wet += 1
    return (wet / tot) if tot else 1.0


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
        # serie per pilota: lap -> car
        byDrv = {}
        for lp in r['laps']:
            for d, c in lp['cars'].items():
                byDrv.setdefault(d, {})[c['lap']] = c
        for d, laps_d in byDrv.items():
            laps_sorted = sorted(laps_d)
            # giri verdi usabili del pilota (per stint), fuel-corretti
            for L in laps_sorted:
                cL = laps_d[L]
                stint = cL.get('stint')
                comp = cL.get('compound')
                if stint is None or comp not in SLICK or cL.get('tyre_age') is None:
                    continue
                rate = per_cid.get(comp, [None, None, None])[1]  # centrale
                if rate is None:
                    continue
                # window pace_base: giri stint corrente, verdi, no in/out, lap<=L, con lap_time
                win = [laps_d[k] for k in laps_sorted if k <= L and laps_d[k].get('stint') == stint
                       and laps_d[k].get('lap_time') is not None and laps_d[k].get('tyre_age') is not None
                       and not laps_d[k].get('neutralized')
                       and not laps_d[k].get('in_lap') and not laps_d[k].get('out_lap')
                       and laps_d[k].get('compound') in SLICK]
                if len(win) < MIN_WINDOW:
                    continue
                pb = pace.get(str(L), {}).get(d)
                if pb is None:
                    continue
                A0 = float(np.median([w['tyre_age'] for w in win]))
                Acur = float(cL['tyre_age'])
                # giri futuri verdi nello stesso stint, entro K, no in/out/neutro, lap<=N-1
                fut = [laps_d[k] for k in laps_sorted if L < k <= min(L + K, N - 1)
                       and laps_d[k].get('stint') == stint and laps_d[k].get('lap_time') is not None
                       and laps_d[k].get('tyre_age') is not None
                       and not laps_d[k].get('neutralized') and not laps_d[k].get('in_lap')
                       and not laps_d[k].get('out_lap') and laps_d[k].get('compound') in SLICK]
                for w in fut:
                    A = float(w['tyre_age'])
                    res_oss = fuel_corr(w['lap_time'], w['lap'], N) - pb
                    p0 = rate * max(0.0, A - 1)
                    p1 = rate * (A - A0)
                    p2 = rate * max(0.0, A - Acur)
                    righe.append(dict(gara=gara, cid=cid, drv=d, stint=stint, compound=comp,
                                      freezeL=L, A0=A0, Acur=Acur, Afut=A, rate=rate,
                                      res_oss=res_oss, pred_M0=p0, pred_M1=p1, pred_M2=p2,
                                      err_M0=p0 - res_oss, err_M1=p1 - res_oss, err_M2=p2 - res_oss))
    return righe, escluse


def boot_ci_median(vals, blocks):
    """IC95 bootstrap a blocchi (blocks = etichetta gara per riga) della MEDIANA."""
    by = {}
    for v, b in zip(vals, blocks):
        by.setdefault(b, []).append(v)
    keys = sorted(by)
    rng = np.random.default_rng(SEED)
    out = []
    for _ in range(B):
        pick = rng.choice(len(keys), size=len(keys), replace=True)
        flat = [x for i in pick for x in by[keys[i]]]
        out.append(float(np.median(flat)))
    return float(np.percentile(out, 2.5)), float(np.percentile(out, 97.5))


def stat_modello(righe, key):
    errs = [r[key] for r in righe]
    blocks = [r['gara'] for r in righe]
    bias = float(np.median(errs))
    mae = float(np.median([abs(e) for e in errs]))
    lo, hi = boot_ci_median(errs, blocks)
    return dict(bias=bias, mae=mae, ci=(lo, hi))


def main():
    righe, escluse = raccogli()
    n = len(righe)
    gare = sorted({r['gara'] for r in righe})
    casi = len({(r['gara'], r['drv'], r['stint'], r['freezeL']) for r in righe})

    L = []
    w = L.append
    w('=' * 78)
    w('FASE B — magnitudine corretta della proiezione di degrado (replay 2026)')
    w('=' * 78)
    w('Protocollo: PREREG_SESSIONE_FASEB.md. pace_base = dato vero della demo (kernel).')
    w('M0 gancio attuale rate*(A-1) | M1 rate*(A-A0) | M2 rate*(A-Acur). BIAS+MAE, s/giro.')
    w('')
    w('gare escluse: ' + (', '.join(f'{g} ({m})' for g, m in escluse) if escluse else 'nessuna'))
    w(f'coppie (caso,giro-futuro): {n} | casi (pilota,stint,freeze): {casi} | gare: {len(gare)}')
    if n:
        A0s = [r['A0'] for r in righe]
        rate_med = float(np.median([r['rate'] for r in righe]))
        sovrastima = rate_med * (float(np.median(A0s)) - 1)
        w('')
        w('CONFERMA DIAGNOSI (descrittiva, non decide):')
        w(f'  A0 (mediana life del window pace_base): mediana {np.median(A0s):.1f} '
          f'[q25 {np.percentile(A0s,25):.1f}, q75 {np.percentile(A0s,75):.1f}]')
        w(f'  sovrastima implicata del gancio ~ rate*(A0-1) con rate mediano {rate_med:.4f} '
          f'-> ~{sovrastima:+.3f} s/giro')
    w('')
    if n < MIN_COPPIE or len(gare) < MIN_GARE:
        w(f'=> MAGNITUDINE: NON TESTABILE (coppie {n}<{MIN_COPPIE} o gare {len(gare)}<{MIN_GARE})')
        _finish(L, righe, ('NON TESTABILE', None, None, None))
        return

    S = {m: stat_modello(righe, f'err_{m}') for m in ('M0', 'M1', 'M2')}
    w('MODELLI (err = predetto - osservato):')
    for m in ('M0', 'M1', 'M2'):
        s = S[m]
        w(f'  {m}: BIAS {s["bias"]:+.4f}  IC95 [{s["ci"][0]:+.4f}, {s["ci"][1]:+.4f}] | MAE {s["mae"]:.4f}')

    # decisione (prereg §4): Mx adottato se |bias|<|bias M0| con IC non sovrapposti,
    # MAE<=MAE M0, e bias quasi-nullo (IC include 0 o |bias|<=0.03).
    def non_sovrap(a, b):
        return a[1] < b[0] or b[1] < a[0]
    def quasi_nullo(s):
        return (s['ci'][0] <= 0 <= s['ci'][1]) or abs(s['bias']) <= BIAS_QUASI_NULLO
    cand = {}
    for m in ('M1', 'M2'):
        s, s0 = S[m], S['M0']
        ok = (abs(s['bias']) < abs(s0['bias'])) and non_sovrap(s['ci'], s0['ci']) \
            and (s['mae'] <= s0['mae']) and quasi_nullo(s)
        cand[m] = ok
        w(f'  {m} vs M0: |bias| minore={abs(s["bias"])<abs(s0["bias"])}, IC disgiunti={non_sovrap(s["ci"],s0["ci"])}, '
          f'MAE non peggiora={s["mae"]<=s0["mae"]}, quasi-nullo={quasi_nullo(s)} -> {"QUALIFICA" if ok else "no"}')
    vincitori = [m for m in ('M1', 'M2') if cand[m]]
    if vincitori:
        best = min(vincitori, key=lambda m: (abs(S[m]['bias']), S[m]['mae']))
        verdetto = best
    else:
        verdetto = 'NULL'
    w('')
    w('=' * 78)
    if verdetto in ('M1', 'M2'):
        w(f'MAGNITUDINE: {verdetto} — corregge il doppio conteggio di M0 '
          f'(BIAS M0 {S["M0"]["bias"]:+.4f} -> {verdetto} {S[verdetto]["bias"]:+.4f}). '
          f'Fix = adapter tyreAge0 (gancio non toccato).')
    elif verdetto == 'NULL':
        w('MAGNITUDINE: NULL — nessun modello correttivo qualifica; scenari restano '
          'dormienti, disegno da rivedere col PO.')
    w('Verdetto MECCANICO contro soglie congelate. Il verdetto strategico e\' del PO.')
    w('=' * 78)
    _finish(L, righe, (verdetto, S.get('M0'), S.get('M1'), S.get('M2')))


def _finish(L, righe, esito):
    testo = '\n'.join(L)
    print(testo)
    if '--write' in sys.argv:
        with open(CSV_OUT, 'w', newline='') as f:
            wcsv = csv.writer(f)
            wcsv.writerow(COLS)
            for r in righe:
                wcsv.writerow([(f'{r[k]:.4f}' if isinstance(r[k], float) else r[k]) for k in COLS])
        open(TXT_OUT, 'w').write(testo + '\n')
        print(f'\nSCRITTO {CSV_OUT} ({len(righe)} righe) e {TXT_OUT}')


if __name__ == '__main__':
    main()
