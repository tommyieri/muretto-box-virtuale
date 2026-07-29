"""gen_cancello_combinazione.py — CANCELLO COMBINAZIONE (PREREG_SESSIONE_COMBINAZIONE.md).

Quinto sguardo, dichiarato. UNA regola senza parametri liberi:
  combo = live  se il prior cade FUORI dall'IC95 del gamma live de-confuso  [scatto]
  combo = prior altrimenti                                                  [riposo]
Valutata contro il prior da solo, sul bersaglio ultimo-terzo del cancello de-confuso.
Coppie ricalcolate dalla stessa catena (import da gen_cancello_deconfuso), non lette
dal CSV. Primario = POOLED 2026+2025, blocchi = gare.

CONFINE: sola lettura; scrive SOLO data/cancello_combinazione.csv +
data/CANCELLO_COMBINAZIONE_REPORT.txt. Gancio/kernel/golden: non toccati.

Uso:
  python3 gen_cancello_combinazione.py           # calcola e stampa
  python3 gen_cancello_combinazione.py --write   # scrive CSV + report
"""
import sys, os, csv, statistics as st
import numpy as np
from gen_cancello_deconfuso import valuta_ramo
from gen_cancello_intragara import prior_2026, prior_2324, B, SEED

ROOT = os.path.dirname(os.path.abspath(__file__))
CSV_OUT = os.path.join(ROOT, 'data', 'cancello_combinazione.csv')
TXT_OUT = os.path.join(ROOT, 'data', 'CANCELLO_COMBINAZIONE_REPORT.txt')

# soglie CONGELATE (prereg §3)
WIN_SOGLIA = 0.60
MIN_COPPIE = 12
MIN_SCATTI = 5
COLS = ['ramo', 'anno', 'gara', 'cid', 'compound', 'bersaglio', 'prior', 'gamma_live',
        'ic_lo', 'ic_hi', 'scatto', 'combo', 'err_prior', 'err_combo', 'vittoria_combo']


def applica_regola(coppie):
    out = []
    for c in coppie:
        scatto = (c['prior_centrale'] < c['ic_lo']) or (c['prior_centrale'] > c['ic_hi'])
        combo = c['gamma_live'] if scatto else c['prior_centrale']
        ep = abs(c['bersaglio'] - c['prior_centrale'])
        ec = abs(c['bersaglio'] - combo)
        win = 0.5 if round(ec, 4) == round(ep, 4) else (1.0 if ec < ep else 0.0)
        out.append(dict(ramo=c['ramo'], anno=c['anno'], gara=c['gara'], cid=c['cid'],
                        compound=c['compound'], bersaglio=c['bersaglio'],
                        prior=c['prior_centrale'], gamma_live=c['gamma_live'],
                        ic_lo=c['ic_lo'], ic_hi=c['ic_hi'], scatto=scatto, combo=combo,
                        err_prior=ep, err_combo=ec, vittoria_combo=win))
    return out


def boot_ci(coppie):
    per_gara = {}
    for c in coppie:
        per_gara.setdefault(c['gara'], []).append(c['err_prior'] - c['err_combo'])
    gare = sorted(per_gara)
    rng = np.random.default_rng(SEED)
    boots = []
    for _ in range(B):
        picks = rng.choice(len(gare), size=len(gare), replace=True)
        flat = [d for i in picks for d in per_gara[gare[i]]]
        boots.append(float(np.median(flat)))
    return float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))


def blocco(nome, coppie):
    L = []
    w = L.append
    if not coppie:
        w(f'--- {nome}: 0 coppie ---')
        return L, None
    wins = sum(c['vittoria_combo'] for c in coppie)
    n = len(coppie)
    scatti = [c for c in coppie if c['scatto']]
    scatti_giusti = sum(1 for c in scatti if c['err_combo'] < c['err_prior'])
    med_p = st.median([c['err_prior'] for c in coppie])
    med_c = st.median([c['err_combo'] for c in coppie])
    diffs = [c['err_prior'] - c['err_combo'] for c in coppie]
    lo, hi = boot_ci(coppie)
    w(f'--- {nome} ---')
    w(f'  coppie: {n} | vittorie combo: {wins:g}/{n} = {wins/n:.1%} (soglia >= {WIN_SOGLIA:.0%})')
    w(f'  scatti: {len(scatti)}/{n} | scattando ha ragione: {scatti_giusti}/{len(scatti)}'
      + (f' = {scatti_giusti/len(scatti):.0%}' if scatti else ''))
    w(f'  err mediano: combo {med_c:.4f} vs prior {med_p:.4f} '
      f'({"combo meglio" if med_c < med_p else "combo NON meglio"})')
    w(f'  mediana(err_prior - err_combo): {st.median(diffs):+.4f} | '
      f'IC95 blocchi-gara [{lo:+.4f}, {hi:+.4f}] (B={B}, seed={SEED})')
    return L, dict(wins=wins, n=n, n_scatti=len(scatti), scatti_giusti=scatti_giusti,
                   med_c=med_c, med_p=med_p, med_diff=st.median(diffs), ci=(lo, hi))


def main():
    cop26, _ = valuta_ramo('primario', prior_2026())
    cop25, _ = valuta_ramo('secondario', prior_2324())
    tutte = applica_regola(cop26 + cop25)
    solo26 = [c for c in tutte if c['anno'] == 2026]
    solo25 = [c for c in tutte if c['anno'] == 2025]

    L = []
    w = L.append
    w('=' * 78)
    w('CANCELLO COMBINAZIONE — prior base + live de-confuso su scatto IC-esclusione')
    w('=' * 78)
    w('Protocollo: PREREG_SESSIONE_COMBINAZIONE.md (quinto sguardo dichiarato,')
    w('una regola senza parametri, KPI a tre condizioni congiunte).')
    w('')
    Lp, s = blocco('PRIMARIO POOLED 2026+2025 (decide)', tutte)
    L += Lp
    w('')
    L26, _ = blocco('ripartizione 2026 (riportata, non decide)', solo26)
    L += L26
    w('')
    L25, _ = blocco('ripartizione 2025 (riportata, non decide)', solo25)
    L += L25
    w('')
    w('--- dettaglio scatti (dove la regola agisce) ---')
    for c in tutte:
        if not c['scatto']:
            continue
        w(f'  {c["gara"]:26s} {c["compound"]:6s} prior {c["prior"]:+.4f} fuori da '
          f'IC[{c["ic_lo"]:+.3f},{c["ic_hi"]:+.3f}] -> live {c["gamma_live"]:+.4f} | '
          f'bersaglio {c["bersaglio"]:+.4f} | err {c["err_combo"]:.4f} vs {c["err_prior"]:.4f} '
          f'-> {"GIUSTO" if c["err_combo"] < c["err_prior"] else "SBAGLIATO"}')
    w('')
    w('=' * 78)
    if s is None or s['n'] < MIN_COPPIE or s['n_scatti'] < MIN_SCATTI:
        verdetto = 'NON TESTABILE'
    else:
        ok = (s['wins'] / s['n'] >= WIN_SOGLIA) and (s['med_diff'] > 0) \
             and (s['ci'][0] > 0) and (s['med_c'] < s['med_p'])
        verdetto = 'APERTO' if ok else 'NULL'
    w(f'CANCELLO: {verdetto} — vittorie {s["wins"]:g}/{s["n"]} ({s["wins"]/s["n"]:.0%}), '
      f'IC95 [{s["ci"][0]:+.4f}, {s["ci"][1]:+.4f}], err mediano combo {s["med_c"]:.4f} '
      f'vs prior {s["med_p"]:.4f}')
    w('Verdetto MECCANICO contro soglie congelate. Il verdetto strategico e\' del PO.')
    w('=' * 78)
    testo = '\n'.join(L)
    print(testo)

    if '--write' in sys.argv:
        with open(CSV_OUT, 'w', newline='') as f:
            wcsv = csv.writer(f)
            wcsv.writerow(COLS)
            for c in tutte:
                wcsv.writerow([(f'{c[k]:.4f}' if isinstance(c[k], float) else c[k]) for k in COLS])
        open(TXT_OUT, 'w').write(testo + '\n')
        print(f'\nSCRITTO {CSV_OUT} ({len(tutte)} righe) e {TXT_OUT}')


if __name__ == '__main__':
    main()
