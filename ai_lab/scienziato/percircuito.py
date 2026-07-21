"""ai_lab/scienziato/percircuito.py — il coefficiente e' PER-CIRCUITO o lo sembra?

Tutti gli attrezzi statistici usati qui sono ELENCATI in PREREG_percircuito.md prima di
aver visto un numero: Q di Cochran, tau DerSimonian-Laird, porta di potenza,
leave-one-year-out, permutazione delle etichette di circuito, Spearman, diagnostico giro^2.
Se ne servisse un altro, l'agente si ferma e lo porta al tavolo.

IL METRO (prereg §0): un per-circuito e' VERO se e' STABILE NEL TEMPO. L'R^2 non e' prova:
piu' manopole alzano sempre la varianza spiegata.
"""
import math
import random
import statistics as st

# nomi diversi, stesso tracciato (dichiarato nel prereg §1)
ALIAS = {'Australia': 'Australian', 'Austria': 'Austrian', 'Canada': 'Canadian',
         'Cina': 'Chinese', 'Giappone': 'Japanese', 'Spagna': 'Spanish'}

# valori critici chi-quadro al 95%, df 1..5 (tabella fissa, dichiarata)
CHI2_95 = {1: 3.841, 2: 5.991, 3: 7.815, 4: 9.488, 5: 11.070}

MIN_ANNI = 3              # sotto, INDECIDIBILE per costruzione
MAX_SEMIAMPIEZZA = 1.0    # s — porta di potenza: sopra, la cella non e' misurata abbastanza


def circuito(blocco_id):
    anno, nome = blocco_id.split(' ', 1)
    return ALIAS.get(nome, nome), anno


def tabella(per_blocco):
    """{circuito: {anno: cella}} — la cella e' la stima per gara, invariata."""
    t = {}
    for x in per_blocco:
        c, a = circuito(x['blocco'])
        t.setdefault(c, {})[a] = x
    return t


# ---------------------------------------------------------------- FASE 2: stabilita
def _se(cella):
    """SE della cella: meta' dell'ampiezza dell'IC95 diviso 1,96 (la stessa SE
    cluster-robust con cui l'IC e' stato costruito)."""
    lo, hi = cella['valore_ci95']
    return (hi - lo) / 2 / 1.96


def stabilita(anni, gonfia_se=1.0):
    """Q di Cochran + tau. `anni` = {anno: cella}. Ritorna il bucket e le sue misure."""
    ys = sorted(a for a in anni if a != '2026')          # il 2026 non entra nella prova
    k = len(ys)
    v = [anni[a]['valore'] for a in ys]
    se = [_se(anni[a]) * gonfia_se for a in ys]
    semi = st.mean([s * 1.96 for s in se]) if se else None

    if k < MIN_ANNI:
        return {'bucket': 'INDECIDIBILE', 'motivo': f'{k} anni (<{MIN_ANNI})', 'k': k,
                'anni': ys, 'valori': v, 'semiampiezza_media': None if semi is None else round(semi, 3)}
    if semi >= MAX_SEMIAMPIEZZA:
        return {'bucket': 'INDECIDIBILE',
                'motivo': f'semiampiezza IC95 media {semi:.2f} s >= {MAX_SEMIAMPIEZZA} s',
                'k': k, 'anni': ys, 'valori': v, 'semiampiezza_media': round(semi, 3)}

    w = [1 / s ** 2 for s in se]
    mw = sum(x * y for x, y in zip(w, v)) / sum(w)
    Q = sum(x * (y - mw) ** 2 for x, y in zip(w, v))
    df = k - 1
    crit = CHI2_95[df]
    denom = sum(w) - sum(x ** 2 for x in w) / sum(w)
    tau2 = max(0.0, (Q - df) / denom) if denom > 0 else 0.0
    return {'bucket': 'STABILE' if Q <= crit else 'INSTABILE',
            'Q': round(Q, 3), 'df': df, 'critico_95': crit,
            'tau_s': round(math.sqrt(tau2), 3),
            'I2': round(max(0.0, (Q - df) / Q), 3) if Q > 0 else 0.0,
            'k': k, 'anni': ys, 'valori': [round(x, 3) for x in v],
            'se': [round(s, 3) for s in se],
            'media_pesata': round(mw, 4),
            'ci95_media_pesata': [round(mw - 1.96 / math.sqrt(sum(w)), 4),
                                  round(mw + 1.96 / math.sqrt(sum(w)), 4)],
            'sd_inter_annuale': round(st.stdev(v), 3),
            'semiampiezza_media': round(semi, 3), 'motivo': None}


# ---------------------------------------------------------------- FASE 2b: la prova
def leave_one_year_out(celle):
    """Prova PRIMARIA, indipendente dal modello di SE.

    celle = [{'circuito','anno','valore'}]. Per ogni cella di un circuito visto in >=3
    anni: previsione PER-CIRCUITO = media delle altre annate dello stesso circuito;
    previsione GLOBALE = mediana di tutte le altre gare degli ALTRI anni (mai la cella).
    Metrica: errore assoluto mediano.
    """
    per_c = {}
    for x in celle:
        per_c.setdefault(x['circuito'], {})[x['anno']] = x['valore']
    ammessi = {c for c, a in per_c.items() if len(a) >= MIN_ANNI}
    e_circ, e_glob, dettaglio = [], [], []
    for c in sorted(ammessi):
        for a, val in sorted(per_c[c].items()):
            altri_anni = [v for y, v in per_c[c].items() if y != a]
            prev_c = st.mean(altri_anni)
            fuori = [x['valore'] for x in celle if x['anno'] != a]
            if not fuori:
                continue
            prev_g = st.median(fuori)
            e_circ.append(abs(val - prev_c))
            e_glob.append(abs(val - prev_g))
            dettaglio.append({'circuito': c, 'anno': a, 'valore': round(val, 3),
                              'previsione_circuito': round(prev_c, 3),
                              'previsione_globale': round(prev_g, 3),
                              'errore_circuito': round(abs(val - prev_c), 3),
                              'errore_globale': round(abs(val - prev_g), 3)})
    if not e_circ:
        return None
    return {'n_celle': len(e_circ), 'n_circuiti': len(ammessi),
            'errore_mediano_percircuito': round(st.median(e_circ), 4),
            'errore_mediano_globale': round(st.median(e_glob), 4),
            'guadagno': round(st.median(e_glob) - st.median(e_circ), 4),
            'celle_dove_vince_percircuito': sum(1 for a, b in zip(e_circ, e_glob) if a < b),
            'dettaglio': dettaglio}


def null_etichette(celle, repliche=2000, seed=20260721):
    """Null di permutazione (S2b): rimescola le etichette di CIRCUITO dentro ogni anno e
    rifa' identica la leave-one-year-out. Se il guadagno vero non esce da questa
    distribuzione, la ripetibilita' e' un artefatto."""
    vero = leave_one_year_out(celle)
    if vero is None:
        return None
    rng = random.Random(seed)
    per_anno = {}
    for x in celle:
        per_anno.setdefault(x['anno'], []).append(x)
    guadagni = []
    for _ in range(repliche):
        mescolate = []
        for a, righe in per_anno.items():
            etich = [r['circuito'] for r in righe]
            rng.shuffle(etich)
            mescolate += [{'circuito': e, 'anno': a, 'valore': r['valore']}
                          for e, r in zip(etich, righe)]
        r = leave_one_year_out(mescolate)
        if r:
            guadagni.append(r['guadagno'])
    if not guadagni:
        return None
    guadagni.sort()
    return {'repliche': len(guadagni), 'guadagno_osservato': vero['guadagno'],
            'mediana_null': round(st.median(guadagni), 4),
            'q95_null': round(guadagni[int(.95 * len(guadagni))], 4),
            'p': round((1 + sum(1 for g in guadagni if g >= vero['guadagno']))
                       / (len(guadagni) + 1), 5)}


# ---------------------------------------------------------------- S3: colonna 2026
def spearman(x, y):
    def rango(v):
        ordine = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        i = 0
        while i < len(v):
            j = i
            while j + 1 < len(v) and v[ordine[j + 1]] == v[ordine[i]]:
                j += 1
            media = (i + j) / 2 + 1
            for kk in range(i, j + 1):
                r[ordine[kk]] = media
            i = j + 1
        return r
    if len(x) < 3:
        return None
    rx, ry = rango(x), rango(y)
    mx, my = st.mean(rx), st.mean(ry)
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = math.sqrt(sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry))
    return round(num / den, 3) if den else None
