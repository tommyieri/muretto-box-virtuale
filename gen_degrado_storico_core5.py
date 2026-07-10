"""gen_degrado_storico_core5.py — STUDIO ADDITIVO: gamma (degrado lin+log) sull'archivio
storico congelato data/ti_archive/, limitato a 5 circuiti x 3 anni, + studio di stabilita'
cross-anno. NON tocca il motore ne' l'output 2026: usa la STESSA catena di calcolo
(gen_degrado_gamma.calcola_gamma), scrive un CSV NUOVO e separato.

Uso:
  python3 gen_degrado_storico_core5.py           # ricalcola, VERIFICA il CSV se esiste, stampa matrice+studio
  python3 gen_degrado_storico_core5.py --write    # scrive data/degrado_gamma_storico_core5.csv (writer verificato)

CONFINE: legge solo l'archivio; scrive solo il CSV storico e il report. Mai su
degrado_gamma_linlog.csv, engine/, golden, stint_gold, warmin, firme, grids.

MODELLO (identico Fase 2.1-bis, riusato — non reimplementato):
  tempo_fc = alpha(pilota) + delta_compound + beta_lin*(giro-media) + beta_log*ln(giro)
             + gamma_compound*life
  - gamma_scalar (per compound) = pendenza del degrado sulla vita-gomma: E' QUELLO CHE
    USA IL KPI (r1,r2). SE cluster-robust per (pilota,stint), IC95.
  - gamma_lin, gamma_log = i coefficienti CONDIVISI dell'evoluzione pista f(giro) del fit
    (beta_lin su giro-media, beta_log su ln(giro)); NON sono degrado per-compound, sono
    uguali per i 3 compound di una stessa (circuito,anno). Riportati per completezza.
  Assunzione KPI dichiarata: covarianza ~0 tra gamma di compound diversi (metodo delta).

CORE-5 (hardcoded, non derivato) — mappatura nome-core -> cartella archivio verificata a
mano nei nomi reali di data/ti_archive/<anno>/:
  Abu Dhabi -> 'Abu Dhabi Grand Prix'   Austria -> 'Austrian Grand Prix'
  Bahrain   -> 'Bahrain Grand Prix'     Ungheria -> 'Hungarian Grand Prix'
  Spagna    -> 'Spanish Grand Prix'
Anni: 2023, 2024, 2025.
"""
import sys, os, csv, math
from gen_degrado_gamma import calcola_gamma, SLICK

CORE5 = {  # nome-core -> cartella archivio (dichiarata, non indovinata)
    'Abu Dhabi': 'Abu Dhabi Grand Prix',
    'Austria':   'Austrian Grand Prix',
    'Bahrain':   'Bahrain Grand Prix',
    'Ungheria':  'Hungarian Grand Prix',
    'Spagna':    'Spanish Grand Prix',
}
ANNI = ['2023', '2024', '2025']
CSV_PATH = os.path.join('data', 'degrado_gamma_storico_core5.csv')
REPORT_PATH = os.path.join('data', 'DEGRADO_STORICO_CORE5_REPORT.txt')
COLS = ['anno', 'circuito', 'compound', 'gamma_lin', 'gamma_log', 'gamma_scalar',
        'se', 'ic95_low', 'ic95_high', 'n_stint', 'n_giri', 'identificabile']
DECIMALI = 4
TOL = 5e-5

# soglie CONGELATE del KPI (non modificare)
Q_ALPHA = 0.05        # Cochran Q: non-rifiuto a 95% => p >= 0.05
RANGE_REL_MAX = 0.25  # range relativo (max-min)/mediana
MIN_STABILI = 3       # >=3/5 circuiti stabili => metodo VALIDATO


def chi2_sf(x, dof):
    """P(chi2_dof > x). Qui dof e' sempre 1 o 2 (k=2 o k=3 anni)."""
    if x <= 0: return 1.0
    if dof == 1: return math.erfc(math.sqrt(x / 2.0))
    if dof == 2: return math.exp(-x / 2.0)
    return float('nan')


def calcola_core5():
    """Ritorna: records (lista dict per riga CSV) e dati[circuito][anno][compound]=dict."""
    records, dati = [], {}
    for cir, folder in CORE5.items():
        dati[cir] = {}
        for anno in ANNI:
            path = os.path.join('data', 'ti_archive', anno, folder, 'Race.json')
            if not os.path.exists(path):
                raise FileNotFoundError(f'{cir} {anno}: manca {path}')
            r = calcola_gamma(path)
            s, ident = r['s'], r['ident']
            # coefficienti condivisi f(giro) del fit (se il fit e' andato)
            beta_lin = beta_log = None
            if s is not None and ident:
                base = len(r['drvs']) + (len(ident) - 1)   # dopo alpha + delta, prima dei gamma
                beta_lin = float(s['b'][base]); beta_log = float(s['b'][base + 1])
            dati[cir][anno] = {}
            for c in SLICK:
                n_st = len(r['stint_per_c'].get(c, ()))
                n_gi = r['giri_per_c'].get(c, 0)
                identificabile = (s is not None) and (c in ident)
                if identificabile:
                    g = s['gamme'][c]
                    gamma = g['gamma']; lo = g['lo']; hi = g['hi']
                    se = (hi - lo) / (2 * 1.96)   # esatto: lo/hi = gamma -/+ 1.96*se
                    rec = dict(anno=anno, circuito=cir, compound=c,
                               gamma_lin=beta_lin, gamma_log=beta_log, gamma_scalar=gamma,
                               se=se, ic95_low=lo, ic95_high=hi,
                               n_stint=n_st, n_giri=n_gi, identificabile=True)
                    # motivo di NULL (per la matrice) = None
                    dati[cir][anno][c] = dict(gamma=gamma, se=se, lo=lo, hi=hi,
                                              n_stint=n_st, n_giri=n_gi, ident=True, motivo=None)
                else:
                    if s is None: motivo = 'rango'
                    elif n_st < 3:  motivo = f'stint<3 ({n_st})'
                    elif n_gi < 30: motivo = f'giri<30 ({n_gi})'
                    else:           motivo = 'non identificato'
                    rec = dict(anno=anno, circuito=cir, compound=c,
                               gamma_lin=None, gamma_log=None, gamma_scalar=None,
                               se=None, ic95_low=None, ic95_high=None,
                               n_stint=n_st, n_giri=n_gi, identificabile=False)
                    dati[cir][anno][c] = dict(gamma=None, se=None, lo=None, hi=None,
                                              n_stint=n_st, n_giri=n_gi, ident=False, motivo=motivo)
                records.append(rec)
    return records, dati


# ------------------------------------------------------- CSV writer + auto-verifica
def fmt(x):
    if x is None: return ''
    s = f"{x:.{DECIMALI}f}"
    zero = "0." + "0" * DECIMALI
    return zero if s == "-" + zero else s

def scrivi(records):
    with open(CSV_PATH, 'w', newline='') as f:
        w = csv.writer(f); w.writerow(COLS)
        for r in records:
            w.writerow([r['anno'], r['circuito'], r['compound'],
                        fmt(r['gamma_lin']), fmt(r['gamma_log']), fmt(r['gamma_scalar']),
                        fmt(r['se']), fmt(r['ic95_low']), fmt(r['ic95_high']),
                        r['n_stint'], r['n_giri'], str(r['identificabile'])])

def verifica(records):
    if not os.path.exists(CSV_PATH):
        print(f"(CSV storico assente: {CSV_PATH} — usa --write per crearlo)\n"); return None
    with open(CSV_PATH, newline='') as f:
        old = {(r['anno'], r['circuito'], r['compound']): r for r in csv.DictReader(f)}
    discrep = 0
    for r in records:
        v = old.get((r['anno'], r['circuito'], r['compound']))
        if v is None: discrep += 1; continue
        for campo in ('gamma_lin', 'gamma_log', 'gamma_scalar', 'se', 'ic95_low', 'ic95_high'):
            nuovo = fmt(r[campo]); vecchio = v[campo]
            if nuovo == '' or vecchio == '':
                if nuovo != vecchio: discrep += 1; break
            elif abs(float(nuovo) - float(vecchio)) > TOL: discrep += 1; break
        else:
            if str(r['n_stint']) != v['n_stint'] or str(r['n_giri']) != v['n_giri'] \
               or str(r['identificabile']) != v['identificabile']: discrep += 1
    print(f"auto-verifica CSV storico: {len(records)} righe, {discrep} discrepanze -> "
          f"{'OK (riproducibile)' if discrep == 0 else 'DISCREPANZE — NON fidarsi'}\n")
    return discrep


# ------------------------------------------------------- STEP 2: matrice identificabilita'
def stampa_matrice(dati, out):
    out.append("STEP 2 — MATRICE DI IDENTIFICABILITA' (5 circuiti x 3 anni x 3 compound)")
    out.append("  OK (n_stint, n_giri)  |  NULL (motivo)")
    out.append("-" * 78)
    hdr = f"{'circuito':10s} {'compound':7s} " + " ".join(f"{a:>18s}" for a in ANNI)
    out.append(hdr)
    for cir in CORE5:
        for c in SLICK:
            celle = []
            for anno in ANNI:
                d = dati[cir][anno][c]
                celle.append(f"OK({d['n_stint']},{d['n_giri']})" if d['ident']
                             else f"NULL:{d['motivo']}")
            out.append(f"{cir:10s} {c:7s} " + " ".join(f"{x:>18s}" for x in celle))
        out.append("")


# ------------------------------------------------------- STEP 3: KPI stabilita'
def se_ratio(num, se_num, den, se_den):
    """metodo delta, covarianza ~0 (dichiarata). den!=0."""
    r = num / den
    return r, abs(r) * math.sqrt((se_num / num) ** 2 + (se_den / den) ** 2) if num != 0 else abs(r) * (se_den / abs(den))

def rapporti_anno(dati, cir, anno):
    """r1=soft/medium, r2=medium/hard con SE, dove i compound sono identificabili."""
    d = dati[cir][anno]
    out = {}
    S, M, H = d['SOFT'], d['MEDIUM'], d['HARD']
    if S['ident'] and M['ident'] and M['gamma'] != 0:
        out['r1'] = se_ratio(S['gamma'], S['se'], M['gamma'], M['se'])
    if M['ident'] and H['ident'] and H['gamma'] != 0:
        out['r2'] = se_ratio(M['gamma'], M['se'], H['gamma'], H['se'])
    return out

def cochran(vals, ses):
    w = [1.0 / s ** 2 for s in ses]
    rbar = sum(wi * vi for wi, vi in zip(w, vals)) / sum(w)
    Q = sum(wi * (vi - rbar) ** 2 for wi, vi in zip(w, vals))
    dof = len(vals) - 1
    return Q, dof, chi2_sf(Q, dof), rbar

def range_rel(vals):
    med = sorted(vals)[len(vals) // 2] if len(vals) % 2 else sum(sorted(vals)[len(vals)//2-1:len(vals)//2+1]) / 2
    return (max(vals) - min(vals)) / med if med else float('inf')

def studio(dati, out):
    # Livello 1 — pre-check ordinamento (NON decide)
    out.append("STEP 3 / LIVELLO 1 — pre-check di sanita' (ordinamento gamma_soft > gamma_medium > gamma_hard)")
    anomalie = []
    for cir in CORE5:
        for anno in ANNI:
            d = dati[cir][anno]
            if all(d[c]['ident'] for c in SLICK):
                gS, gM, gH = d['SOFT']['gamma'], d['MEDIUM']['gamma'], d['HARD']['gamma']
                ok = gS > gM > gH
                if not ok:
                    anomalie.append(f"{cir} {anno}: S={gS:+.4f} M={gM:+.4f} H={gH:+.4f}  <-- ordinamento VIOLATO")
    if anomalie:
        out.append("  ANOMALIE DA ISPEZIONARE A MANO (non fanno fallire lo studio):")
        for a in anomalie: out.append("    " + a)
    else:
        out.append("  nessuna violazione dove tutti e 3 i compound sono identificabili.")
    out.append("")

    # Livello 2 — decide
    out.append("STEP 3 / LIVELLO 2 — KPI di stabilita' (soglie congelate: Q p>=0.05, range_rel<=0.25)")
    out.append("  Assunzioni dichiarate: SE(r) col metodo delta, covarianza ~0 tra compound.")
    out.append("-" * 78)
    stabili = 0
    riepilogo = []
    for cir in CORE5:
        r1v, r1s, r2v, r2s, anni1, anni2 = [], [], [], [], [], []
        for anno in ANNI:
            rp = rapporti_anno(dati, cir, anno)
            if 'r1' in rp: r1v.append(rp['r1'][0]); r1s.append(rp['r1'][1]); anni1.append(anno)
            if 'r2' in rp: r2v.append(rp['r2'][0]); r2s.append(rp['r2'][1]); anni2.append(anno)
        out.append(f"\n### {cir}")
        # dettaglio per anno
        for anno in ANNI:
            rp = rapporti_anno(dati, cir, anno)
            t1 = f"r1={rp['r1'][0]:+.3f}±{rp['r1'][1]:.3f}" if 'r1' in rp else "r1=n/d"
            t2 = f"r2={rp['r2'][0]:+.3f}±{rp['r2'][1]:.3f}" if 'r2' in rp else "r2=n/d"
            out.append(f"    {anno}: {t1:22s} {t2:22s}")
        esiti_test = {}
        for nome, vv, ss, aa in (('r1', r1v, r1s, anni1), ('r2', r2v, r2s, anni2)):
            if len(vv) >= 2:
                Q, dof, p, rbar = cochran(vv, ss); rr = range_rel(vv)
                pass_q = p >= Q_ALPHA; pass_r = rr <= RANGE_REL_MAX
                nota = " [2-anni, potenza ridotta]" if len(vv) == 2 else ""
                out.append(f"    {nome}: Q={Q:.3f} dof={dof} p={p:.3f} ({'OK' if pass_q else 'RIFIUTA'}) | "
                           f"range_rel={rr:.3f} ({'OK' if pass_r else 'FUORI'}){nota}")
                esiti_test[nome] = pass_q and pass_r
            else:
                out.append(f"    {nome}: SOLO {len(vv)} anno identificabile -> omogeneita' non testabile (FAIL primario)")
                esiti_test[nome] = False
        stabile = esiti_test.get('r1', False) and esiti_test.get('r2', False)
        stabili += 1 if stabile else 0
        out.append(f"    => {cir}: {'STABILE' if stabile else 'INSTABILE'}")
        riepilogo.append((cir, stabile, len(r1v), len(r2v)))

    out.append("")
    out.append("=" * 78)
    validato = stabili >= MIN_STABILI
    out.append(f"ESITO METODO: {stabili}/5 circuiti STABILI -> "
               f"{'VALIDATO' if validato else 'NON-VALIDATO'} (soglia >= {MIN_STABILI}/5)")
    for cir, st, n1, n2 in riepilogo:
        out.append(f"   {cir:10s}: {'STABILE  ' if st else 'INSTABILE'} (anni con r1={n1}, r2={n2})")
    out.append("=" * 78)


if __name__ == '__main__':
    records, dati = calcola_core5()
    if '--write' in sys.argv:
        scrivi(records)
        print(f"SCRITTO {CSV_PATH} ({len(records)} righe) — writer verificato.\n")
    else:
        verifica(records)

    out = []
    out.append("=" * 78)
    out.append("STUDIO DEGRADO STORICO CORE-5 — gamma lin+log su archivio 2023/2024/2025")
    out.append("=" * 78)
    out.append("STEP 1 — MAPPATURA nome-core -> cartella archivio (dichiarata):")
    for cir, folder in CORE5.items():
        out.append(f"   {cir:10s} -> data/ti_archive/<anno>/{folder}/Race.json")
    out.append("")
    stampa_matrice(dati, out)
    studio(dati, out)
    testo = "\n".join(out)
    print(testo)
    open(REPORT_PATH, 'w').write(testo + "\n")
    print(f"\n(report salvato in {REPORT_PATH})")
