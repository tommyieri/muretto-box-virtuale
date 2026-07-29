"""gen_cancello_adattamento.py — CANCELLO ADATTAMENTO (PREREG_SESSIONE_ADATTAMENTO.md).

La storia da' la forma (climatologia archiviata), le 9 gare 2026 gia' corse danno la
taratura — validata LEAVE-ONE-RACE-OUT: la gara di verifica non vede mai i propri
dati in taratura. PRIMARIO: M1 offset globale (1 parametro). SECONDARI (non decidono,
non riscattano): M2 offset per mescola, M3 ricalibrazione Theil-Sen.

RIUSO: stint e igiene da gen_climatologia_degrado.raccogli() (stessa misura del
bersaglio e del prior: pendenza plateau fuel-corretta 3/70, riferimento locale);
prior da data/climatologia_degrado.csv (leave-2026-out, righe INFORMATIVA);
bootstrap a blocchi-gara come nei cancelli precedenti.
CONFINE: sola lettura; scrive SOLO data/cancello_adattamento.csv +
data/CANCELLO_ADATTAMENTO_REPORT.txt. Gancio/kernel/golden: non toccati.

Uso:
  python3 gen_cancello_adattamento.py           # calcola e stampa
  python3 gen_cancello_adattamento.py --write   # scrive CSV + report
"""
import sys, os, csv, statistics as st
import numpy as np
from gen_climatologia_degrado import raccogli
from gen_cancello_intragara import prior_2026, WIN_SOGLIA, MIN_COPPIE, B, SEED

ROOT = os.path.dirname(os.path.abspath(__file__))
CSV_OUT = os.path.join(ROOT, 'data', 'cancello_adattamento.csv')
TXT_OUT = os.path.join(ROOT, 'data', 'CANCELLO_ADATTAMENTO_REPORT.txt')
MIN_STINT_TARGET = 3     # coppia testabile: >=3 stint 2026 (prereg)
MIN_TARATURA = 6         # coppie di taratura minime in LORO (prereg)
COLS = ['gara', 'cid', 'compound', 'n_stint', 'bersaglio', 'prior_M0',
        'stima_M1', 'stima_M2', 'stima_M3',
        'err_M0', 'err_M1', 'err_M2', 'err_M3', 'vittoria_M1']


def coppie_2026():
    """(gara, cid, compound) -> bersaglio = mediana pendenze-stint di TUTTA la gara."""
    stints, _ = raccogli()
    per = {}
    for s in stints:
        if s['anno'] != 2026:
            continue
        per.setdefault((s['gara'], s['cid'], s['comp']), []).append(s['marg'])
    prior = prior_2026()
    coppie, perse = [], {'target<3': 0, 'prior_assente': 0}
    for (gara, cid, comp), vals in sorted(per.items()):
        if len(vals) < MIN_STINT_TARGET:
            perse['target<3'] += 1
            continue
        pr = prior.get((comp, cid))
        if pr is None:
            perse['prior_assente'] += 1
            continue
        coppie.append(dict(gara=gara, cid=cid, compound=comp,
                           n_stint=len(vals), bersaglio=st.median(vals), prior_M0=pr))
    return coppie, perse


def theil_sen(xs, ys):
    """pendenza = mediana delle pendenze a coppie; intercetta = mediana(y - b*x)."""
    sl = [(ys[j] - ys[i]) / (xs[j] - xs[i])
          for i in range(len(xs)) for j in range(i + 1, len(xs)) if xs[j] != xs[i]]
    b = st.median(sl) if sl else 0.0
    a = st.median([y - b * x for x, y in zip(xs, ys)])
    return a, b


def loro(coppie):
    """riempe stima_M1/M2/M3 (LORO) su ogni coppia; perse per taratura<MIN_TARATURA."""
    out, n_perse_taratura = [], 0
    gare = sorted({c['gara'] for c in coppie})
    for g in gare:
        train = [c for c in coppie if c['gara'] != g]
        test = [c for c in coppie if c['gara'] == g]
        if len(train) < MIN_TARATURA:
            n_perse_taratura += len(test)
            continue
        resid = [c['bersaglio'] - c['prior_M0'] for c in train]
        d_glob = st.median(resid)
        d_comp = {}
        for comp in {c['compound'] for c in train}:
            rr = [c['bersaglio'] - c['prior_M0'] for c in train if c['compound'] == comp]
            d_comp[comp] = st.median(rr)
        a, b = theil_sen([c['prior_M0'] for c in train], [c['bersaglio'] for c in train])
        for c in test:
            m1 = c['prior_M0'] + d_glob
            m2 = c['prior_M0'] + d_comp.get(c['compound'], d_glob)
            m3 = a + b * c['prior_M0']
            e0 = abs(c['bersaglio'] - c['prior_M0'])
            e1 = abs(c['bersaglio'] - m1)
            e2 = abs(c['bersaglio'] - m2)
            e3 = abs(c['bersaglio'] - m3)
            win1 = 0.5 if round(e1, 4) == round(e0, 4) else (1.0 if e1 < e0 else 0.0)
            out.append(dict(c, stima_M1=m1, stima_M2=m2, stima_M3=m3,
                            err_M0=e0, err_M1=e1, err_M2=e2, err_M3=e3, vittoria_M1=win1))
    return out, n_perse_taratura


def boot_ci(coppie, chiave_a, chiave_b):
    """IC95 bootstrap blocchi-gara della mediana di (err_a - err_b)."""
    per_gara = {}
    for c in coppie:
        per_gara.setdefault(c['gara'], []).append(c[chiave_a] - c[chiave_b])
    gare = sorted(per_gara)
    rng = np.random.default_rng(SEED)
    boots = []
    for _ in range(B):
        picks = rng.choice(len(gare), size=len(gare), replace=True)
        flat = [d for i in picks for d in per_gara[gare[i]]]
        boots.append(float(np.median(flat)))
    return float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))


def confronto(coppie, ka, kb, nome):
    """riga di confronto err_a vs err_b (a = sfidante, b = riferimento)."""
    wins = sum(1.0 if c[ka] < c[kb] else (0.5 if round(c[ka], 4) == round(c[kb], 4) else 0.0)
               for c in coppie)
    n = len(coppie)
    diffs = [c[kb] - c[ka] for c in coppie]
    lo, hi = boot_ci(coppie, kb, ka)
    return (f'  {nome}: vittorie {wins:g}/{n} = {wins/n:.1%} | mediana(diff) {st.median(diffs):+.4f} | '
            f'IC95 [{lo:+.4f}, {hi:+.4f}] | err mediano {st.median([c[ka] for c in coppie]):.4f} '
            f'vs {st.median([c[kb] for c in coppie]):.4f}'), wins, n, st.median(diffs), (lo, hi)


def main():
    base, perse = coppie_2026()
    coppie, perse_tar = loro(base)

    L = []
    w = L.append
    w('=' * 78)
    w('CANCELLO ADATTAMENTO — struttura dalla storia, taratura LORO sulle 9 gare 2026')
    w('=' * 78)
    w('Protocollo: PREREG_SESSIONE_ADATTAMENTO.md (primario M1; M2/M3 non riscattano).')
    w('')
    w(f'coppie perse: target<3={perse["target<3"]}, prior_assente={perse["prior_assente"]}, '
      f'taratura<{MIN_TARATURA}={perse_tar}')
    w(f'coppie testabili (LORO): {len(coppie)} su {len({c["gara"] for c in coppie})} gare')
    w('')
    if coppie:
        w('--- PRIMARIO: M1 (prior + offset globale) vs M0 (prior grezzo) ---')
        r1, wins, n, med, (lo, hi) = confronto(coppie, 'err_M1', 'err_M0', 'M1 vs M0')
        w(r1)
        w('')
        w('--- SECONDARI (non decidono, non riscattano) ---')
        w(confronto(coppie, 'err_M2', 'err_M0', 'M2 vs M0')[0])
        w(confronto(coppie, 'err_M2', 'err_M1', 'M2 vs M1')[0])
        w(confronto(coppie, 'err_M3', 'err_M0', 'M3 vs M0')[0])
        w(confronto(coppie, 'err_M3', 'err_M1', 'M3 vs M1')[0])
        w('')
        w('--- dettaglio coppie (LORO) ---')
        for c in coppie:
            w(f'  {c["gara"]:18s} {c["compound"]:6s} bersaglio {c["bersaglio"]:+.4f} (n={c["n_stint"]:2d}) | '
              f'M0 {c["prior_M0"]:+.4f} e={c["err_M0"]:.4f} | M1 {c["stima_M1"]:+.4f} e={c["err_M1"]:.4f} | '
              f'M2 e={c["err_M2"]:.4f} | M3 e={c["err_M3"]:.4f} -> '
              f'{"M1" if c["vittoria_M1"] == 1 else ("pari" if c["vittoria_M1"] == 0.5 else "M0")}')
        w('')
        if n < MIN_COPPIE:
            verdetto = 'NON TESTABILE'
        else:
            ok = (wins / n >= WIN_SOGLIA) and (med > 0) and (lo > 0)
            verdetto = 'APERTO' if ok else 'NULL'
    else:
        verdetto, wins, n, (lo, hi) = 'NON TESTABILE', 0, 0, (float('nan'), float('nan'))
    w('=' * 78)
    quota = f'{wins/n:.0%}' if n else 'n/d'
    w(f'CANCELLO: {verdetto} — M1 vittorie {wins:g}/{n} ({quota}), IC95 [{lo:+.4f}, {hi:+.4f}]')
    w('Verdetto MECCANICO contro soglie congelate. Il verdetto strategico e\' del PO.')
    w('=' * 78)
    testo = '\n'.join(L)
    print(testo)

    if '--write' in sys.argv:
        with open(CSV_OUT, 'w', newline='') as f:
            wcsv = csv.writer(f)
            wcsv.writerow(COLS)
            for c in coppie:
                wcsv.writerow([(f'{c[k]:.4f}' if isinstance(c[k], float) else c[k]) for k in COLS])
        open(TXT_OUT, 'w').write(testo + '\n')
        print(f'\nSCRITTO {CSV_OUT} ({len(coppie)} righe) e {TXT_OUT}')


if __name__ == '__main__':
    main()
