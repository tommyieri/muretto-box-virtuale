"""gen_cancello_deconfuso.py — CANCELLO DE-CONFUSO (PREREG_SESSIONE_DECONFUSO.md).

Stima live de-confusa: gamma per mescola dal modello FE lin+log (evoluzione-pista
CONDIVISA tra le mescole = confronto a pari giro), ristretto alla PRIMA META' di gara,
contro il prior climatologico, sul bersaglio ultimo-terzo.

RIUSO INTEGRALE delle catene validate:
  - fit FE: carica/pulisci/filtro_outlier (test_identificabilita_degrado) +
    prepara/costruisci/stima (test_forma_fgiro) — unico passo nuovo: filtro-finestra
    sui giri tra F7 e prepara;
  - bersaglio e H2H: carica/quota_wet/stint_di_gara (gen_climatologia_degrado) +
    slope_finestra/prior/gare (gen_cancello_intragara).
CONFINE: sola lettura; scrive SOLO data/cancello_deconfuso.csv +
data/CANCELLO_DECONFUSO_REPORT.txt. Gancio/kernel/golden: non toccati.

Uso:
  python3 gen_cancello_deconfuso.py           # calcola e stampa
  python3 gen_cancello_deconfuso.py --write   # scrive CSV + report
"""
import sys, os, csv, statistics as st
import numpy as np
from test_identificabilita_degrado import carica as ff_carica, pulisci, filtro_outlier, SOGLIA_OUTLIER
from test_forma_fgiro import prepara, costruisci, stima
from gen_climatologia_degrado import carica, quota_wet, QUOTA_WET_MAX
from gen_cancello_intragara import (misure_gara, prior_2026, prior_2324, gare_ramo,
                                    bootstrap_ci, MIN_STINT_FINESTRA, WIN_SOGLIA,
                                    MIN_COPPIE, B, SEED)

ROOT = os.path.dirname(os.path.abspath(__file__))
CSV_OUT = os.path.join(ROOT, 'data', 'cancello_deconfuso.csv')
TXT_OUT = os.path.join(ROOT, 'data', 'CANCELLO_DECONFUSO_REPORT.txt')
CSV_STRATO1 = os.path.join(ROOT, 'data', 'cancello_intragara.csv')
COLS = ['ramo', 'anno', 'gara', 'cid', 'compound', 'gamma_live', 'ic_lo', 'ic_hi',
        'n_target', 'bersaglio', 'prior_centrale', 'err_live', 'err_prior', 'vittoria_live']


def gamma_finestra(path):
    """gamma FE lin+log sulla PRIMA META' (2 <= lap <= floor(N/2)).
    Ritorna ({compound: (gamma, lo, hi)}, N) — solo compound identificabili in finestra."""
    rows0 = ff_carica(path)
    keep, _, N = pulisci(rows0)                       # F1-F6 (importati)
    keep, _ = filtro_outlier(keep, SOGLIA_OUTLIER)    # F7
    lap_hi = N // 2
    keep = [r for r in keep if 2 <= int(r['lap']) <= lap_hi]   # UNICO passo nuovo
    rows, ident, _, _ = prepara(keep)                 # guardrail >=3 stint, >=30 giri
    if not ident or not rows:
        return {}, N
    X, y, grp, gidx, drvs, di = costruisci(rows, ident, N, 'linlog')
    s = stima(X, y, grp, gidx)                        # None se rank-deficiente
    if s is None:
        return {}, N
    return {c: (g['gamma'], g['lo'], g['hi']) for c, g in s['gamme'].items()}, N


def valuta_ramo(ramo, prior):
    coppie = []
    perse = {'gara_bagnata': 0, 'live_non_id': 0, 'target<3': 0, 'prior_assente': 0}
    for anno, cid, label, path in gare_ramo(ramo):
        rows = carica(path)
        if quota_wet(rows) > QUOTA_WET_MAX:
            perse['gara_bagnata'] += 1
            continue
        gam, N = gamma_finestra(path)
        mis, _ = misure_gara(path)                    # bersaglio ultimo-terzo (riuso)
        for comp in sorted(set(gam) | set(mis or {})):
            g = gam.get(comp)
            m = (mis or {}).get(comp, {})
            tgt = m.get('bersaglio')
            pr = prior.get((comp, cid))
            manca = []
            if g is None: manca.append('live_non_id')
            if tgt is None: manca.append('target<3')
            if pr is None: manca.append('prior_assente')
            if manca:
                for k in manca: perse[k] += 1
                continue
            el = abs(tgt - g[0]); ep = abs(tgt - pr)
            win = 0.5 if round(el, 4) == round(ep, 4) else (1.0 if el < ep else 0.0)
            coppie.append(dict(ramo=ramo, anno=anno, gara=label, cid=cid, compound=comp,
                               gamma_live=g[0], ic_lo=g[1], ic_hi=g[2],
                               n_target=m['n_target'], bersaglio=tgt, prior_centrale=pr,
                               err_live=el, err_prior=ep, vittoria_live=win))
    return coppie, perse


def riassunto(nome, coppie, perse, decide):
    L = []
    w = L.append
    w(f'--- ramo {nome} ({"decide" if decide else "NON decide"}) ---')
    w('  coppie perse: ' + ', '.join(f'{k}={v}' for k, v in perse.items()))
    if not coppie:
        w('  0 coppie testabili.')
        return L, ('NON TESTABILE', 0, 0, (float("nan"), float("nan"))) if decide else (L, None)
    wins = sum(c['vittoria_live'] for c in coppie)
    n = len(coppie)
    diffs = [c['err_prior'] - c['err_live'] for c in coppie]
    lo, hi = bootstrap_ci(coppie)
    w(f'  coppie testabili: {n} | vittorie live: {wins:g}/{n} = {wins/n:.1%} (soglia >= {WIN_SOGLIA:.0%})')
    w(f'  mediana(err_prior - err_live): {st.median(diffs):+.4f} s/giro | '
      f'IC95 bootstrap blocchi-gara [{lo:+.4f}, {hi:+.4f}] (B={B}, seed={SEED})')
    w(f'  errore mediano: live {st.median([c["err_live"] for c in coppie]):.4f} | '
      f'prior {st.median([c["err_prior"] for c in coppie]):.4f}')
    for c in coppie:
        w(f'    {c["gara"]:22s} {c["compound"]:6s} live {c["gamma_live"]:+.4f}'
          f' [{c["ic_lo"]:+.3f},{c["ic_hi"]:+.3f}] | prior {c["prior_centrale"]:+.4f} | '
          f'bersaglio {c["bersaglio"]:+.4f} (n={c["n_target"]:2d}) | '
          f'err {c["err_live"]:.4f} vs {c["err_prior"]:.4f} -> '
          f'{"LIVE" if c["vittoria_live"] == 1 else ("pari" if c["vittoria_live"] == 0.5 else "prior")}')
    esito = None
    if decide:
        if n < MIN_COPPIE:
            esito = ('NON TESTABILE', wins, n, (lo, hi))
        else:
            ok = (wins / n >= WIN_SOGLIA) and (st.median(diffs) > 0) and (lo > 0)
            esito = ('APERTO' if ok else 'NULL', wins, n, (lo, hi))
    return L, esito


def diagnostica_vs_strato1(coppie):
    """confronto (non decide) con la stima grezza dello strato 1 sulle coppie comuni."""
    if not os.path.exists(CSV_STRATO1):
        return ['  (CSV strato 1 assente: diagnostica saltata)']
    grezzo = {}
    with open(CSV_STRATO1, newline='') as f:
        for r in csv.DictReader(f):
            grezzo[(r['gara'], r['compound'])] = float(r['err_live'])
    L, wins, n = [], 0.0, 0
    for c in coppie:
        eg = grezzo.get((c['gara'], c['compound']))
        if eg is None:
            continue
        n += 1
        esito = 'DE-CONFUSO' if c['err_live'] < eg else ('pari' if round(c['err_live'], 4) == round(eg, 4) else 'grezzo')
        if c['err_live'] < eg: wins += 1
        elif round(c['err_live'], 4) == round(eg, 4): wins += 0.5
        L.append(f'    {c["gara"]:22s} {c["compound"]:6s} err de-confuso {c["err_live"]:.4f} '
                 f'vs grezzo {eg:.4f} -> {esito}')
    head = [f'  coppie comuni con lo strato 1: {n}' +
            (f' | de-confuso meglio in {wins:g}/{n}' if n else '')]
    return head + L


def main():
    cop26, per26 = valuta_ramo('primario', prior_2026())
    cop25, per25 = valuta_ramo('secondario', prior_2324())

    L = []
    w = L.append
    w('=' * 78)
    w('CANCELLO DE-CONFUSO — gamma a pari giro (FE lin+log, prima meta\') vs prior')
    w('=' * 78)
    w('Protocollo: PREREG_SESSIONE_DECONFUSO.md (KPI congelato prima dei numeri).')
    w('')
    L1, esito = riassunto('PRIMARIO 2026', cop26, per26, decide=True)
    L += L1
    w('')
    L2, _ = riassunto('SECONDARIO 2025 (prior 2023-24)', cop25, per25, decide=False)
    L += L2
    w('')
    w('--- diagnostica vs strato 1 (non decide) ---')
    L += diagnostica_vs_strato1(cop26 + cop25)
    w('')
    w('=' * 78)
    verdetto, wins, n, (lo, hi) = esito
    quota = f'{wins/n:.0%}' if n else 'n/d'
    w(f'CANCELLO: {verdetto} — vittorie {wins:g}/{n} ({quota}), IC95 [{lo:+.4f}, {hi:+.4f}]')
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
