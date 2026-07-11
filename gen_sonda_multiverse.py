"""gen_sonda_multiverse.py — SONDA di selezione strategica (GATE) + MULTIVERSE di robustezza.

Riusa la MACCHINA DI PERMUTAZIONE di gen_osservabilita_degrado.py (importata, file NON
modificato): _mkblock (statistica Spearman entro blocco), nullo_empirico/analizza (nullo
per permutazione delle etichette life entro blocco), stat_osservata, p_emp. Riusa l'igiene
validata (pulisci=F1-F6, filtro_outlier=F7). Sola lettura sull'archivio 2023-25.

REGOLA ANTI-TUNING (la piu' importante): il multiverse misura la DISPERSIONE, MAI sceglie
una specificazione. Nessuna "specificazione migliore", nessuna classifica di rho per forza
del segnale, nessuna raccomandazione di estimatore. Si riporta distribuzione e concordanza,
non il massimo.

--- PARTE 1: SONDA (GATE, eseguita per prima) ---
Confound: a parita' di giro, chi ha gomma piu' vecchia non e' un pilota a caso (puo' gestire
o essere in strategia lunga). Due lame, ciascuna sul test primario completo (Spearman entro
blocco (gara,giro), nullo per permutazione life entro blocco, P>=10000, seed dichiarato):
  Lama A — esclusione giri pre-pit: scarta i K giri precedenti all'in-lap (pin non nullo)
    del pilota. K=2 e K=3. Unica def. di "gestione" ammessa (misurabile dal dato).
  Lama B — controllo posizione: stratifica per fascia di pos (1-5 / 6-12 / 13-20); permuta
    life entro (gara,giro,fascia_pos). Riporta per fascia e aggregato.
GATE (soglie CONGELATE): il segnale sopravvive se in ENTRAMBE le lame (ed entrambi i K):
  (1) segno rho>0, (2) p_empirico globale < 0.01, (3) rho >= 0.187 (= meta' del primario di
  riferimento non-stratificato +0.3746). Per-gara (>=50% gare a p<0.05) riportato come nel
  primario. Se una qualsiasi condizione cade in una qualsiasi lama -> NON si esegue la
  Parte 2 e si scrive che il segnale e' (almeno in parte) selezione strategica, coi numeri.

--- PARTE 2: MULTIVERSE (solo se il GATE regge) ---
Tutte le combinazioni (dichiarate a priori, nessuna aggiunta a posteriori):
  aria: 1.5/2.0/3.0 ; norm: mediana-pilota-gara / media-troncata-pilota-gara(10%) /
  mediana-pilota-stint ; outlier F7: 1.05/1.07/1.10 ; life_min: 3/4 ; min_blocco: 5/8 ;
  compound-strat: si/no  -> 3*3*3*2*2*2 = 216 specificazioni. P=2000 (dichiarato).
KPI robustezza (CONGELATO): ROBUSTO se >=90% concorda sul segno (rho>0) E >=75% ha rho
entro fattore 2 dalla mediana (mediana/2 <= rho <= mediana*2). Fattore 2 volutamente largo:
"l'ordine di grandezza sopravvive?", non "il numero e' preciso".

SEED dichiarato = 20260711 (writer deterministico). Per il multiverse P_PERM del modulo
importato e' impostato a 2000 a RUNTIME (attributo di modulo; il file NON e' modificato).
"""
import os, csv, json, itertools
import numpy as np
from scipy.stats import trim_mean
import gen_osservabilita_degrado as obs
from test_identificabilita_degrado import pulisci, filtro_outlier, SLICK

SEED = 20260711
RIF_PRIMARIO = 0.3746          # rho primario non-stratificato (riferimento dichiarato)
GATE_RHO = 0.187               # meta' del riferimento
FASCE = [(1, 5), (6, 12), (13, 20)]
P_GATE, P_MULTI = 10000, 2000
OUT_CSV = os.path.join('data', 'multiverse_specifiche.csv')
OUT_TXT = os.path.join('data', 'SONDA_MULTIVERSE_REPORT.txt')
CAMPI = ('drv', 'lap', 'time', 'life', 'stint', 'compound', 'status', 'pin', 'pout')


def nullo(x): return x is None or str(x) == 'None'


def carica_ricco(path):
    """Loader arricchito: campi igiene + sesT (aria) + pos (fascia) + pit-laps del pilota.
    L'igiene (pulisci/filtro_outlier) e' importata e opera invariata su questi rows."""
    d = json.load(open(path)); n = len(d['time'])
    rows = []
    pit_laps = {}   # drv -> set(lap con pin non nullo = in-lap)
    for i in range(n):
        r = {k: d[k][i] for k in CAMPI}
        r['sesT'] = d['sesT'][i]
        r['pos'] = d['pos'][i]
        rows.append(r)
        if not nullo(d['pin'][i]) and d['lap'][i] is not None:
            pit_laps.setdefault(d['drv'][i], set()).add(int(d['lap'][i]))
    return rows, pit_laps


def calcola_clean(rows, soglia_aria):
    """Aria pulita (regola IDENTICA a carica_plus, parametrizzata sulla soglia): leader di
    ogni giro = pulito; gli altri puliti se gap-sesT all'auto davanti > soglia. Calcolata su
    TUTTE le auto del giro (come l'originale), prima dei filtri."""
    per_lap = {}
    for idx, r in enumerate(rows):
        L = r['lap']
        if L is None or not isinstance(r['sesT'], (int, float)): continue
        per_lap.setdefault(int(L), []).append((r['sesT'], idx))
    for L, arr in per_lap.items():
        arr.sort()
        for k, (s, idx) in enumerate(arr):
            rows[idx]['clean'] = True if k == 0 else (s - arr[k - 1][0]) > soglia_aria


CACHE = {}   # path -> (rows, pit_laps)  (caricato una sola volta, sola lettura)


def races():
    out = []
    for anno in ('2023', '2024', '2025'):
        base = os.path.join('data', 'ti_archive', anno)
        if not os.path.isdir(base): continue
        for folder in sorted(os.listdir(base)):
            path = os.path.join(base, folder, 'Race.json')
            if os.path.exists(path):
                out.append((anno, folder.replace(' Grand Prix', ''), path))
    return out


def normalizza(keep, modo):
    """Aggiunge passo_norm a ogni riga (centraggio dichiarato, NON un modello)."""
    if modo == 'med_gara':
        per = {}
        for r in keep: per.setdefault(r['drv'], []).append(r['time'])
        ref = {d: float(np.median(v)) for d, v in per.items()}
        for r in keep: r['passo_norm'] = r['time'] - ref[r['drv']]
    elif modo == 'trim_gara':
        per = {}
        for r in keep: per.setdefault(r['drv'], []).append(r['time'])
        ref = {d: float(trim_mean(v, 0.1)) if len(v) >= 5 else float(np.median(v)) for d, v in per.items()}
        for r in keep: r['passo_norm'] = r['time'] - ref[r['drv']]
    elif modo == 'med_stint':
        per = {}
        for r in keep: per.setdefault((r['drv'], int(r['stint'])), []).append(r['time'])
        ref = {k: float(np.median(v)) for k, v in per.items()}
        for r in keep: r['passo_norm'] = r['time'] - ref[(r['drv'], int(r['stint']))]
    else:
        raise ValueError(modo)


def fascia_di(pos):
    if not isinstance(pos, (int, float)): return None
    for lo, hi in FASCE:
        if lo <= pos <= hi: return (lo, hi)
    return None


def costruisci_blocchi(spec):
    """Costruisce i blocchi (via obs._mkblock) per UNA specificazione. spec chiavi:
    aria, norm, outlier, life_min, min_block, strat(list di ['compound'|'pos']), prepit_K."""
    blocchi = []
    strat = spec.get('strat', [])
    K = spec.get('prepit_K', 0)
    for anno, cir, path in races():
        if path not in CACHE: CACHE[path] = carica_ricco(path)
        rows_raw, pit_laps = CACHE[path]
        rows = [dict(r) for r in rows_raw]                 # copia (aggiungo clean/passo_norm)
        calcola_clean(rows, spec['aria'])
        keep, _, _ = pulisci(rows)                         # F1-F6 (life>=3) importato
        if spec['life_min'] > 3:
            keep = [r for r in keep if int(r['life']) >= spec['life_min']]
        keep, _ = filtro_outlier(keep, spec['outlier'])    # F7 importato
        keep = [r for r in keep if r.get('clean')]         # aria pulita (soglia dello spec)
        if K > 0:                                          # Lama A: esclusione pre-pit
            excl = set()
            for d, laps in pit_laps.items():
                for pl in laps:
                    for k in range(1, K + 1): excl.add((d, pl - k))
            keep = [r for r in keep if (r['drv'], int(r['lap'])) not in excl]
        if not keep: continue
        normalizza(keep, spec['norm'])
        gara = f"{anno}:{cir}"
        gruppi = {}
        for r in keep:
            if 'pos' in strat:
                fa = fascia_di(r['pos'])
                if fa is None: continue
            key = [int(r['lap'])]
            if 'compound' in strat: key.append(r['compound'])
            if 'pos' in strat: key.append(fascia_di(r['pos']))
            gruppi.setdefault(tuple(key), []).append(r)
        for rr in gruppi.values():
            if len({r['drv'] for r in rr}) < spec['min_block']: continue
            if len({int(r['life']) for r in rr}) < obs.MIN_LIFE: continue
            b = obs._mkblock(rr, gara, anno)               # macchina statistica importata
            if b is not None: blocchi.append(b)
    return blocchi


def analizza(blocchi, etichetta):
    return obs.analizza(blocchi, etichetta, np.random.default_rng(SEED))


DEFAULT = dict(aria=2.0, norm='med_gara', outlier=1.07, life_min=3, min_block=5, strat=[], prepit_K=0)


def gate_eval(r):
    return dict(seg=r['oss'] > 0, pglob=r['p_glob'] < 0.01, rho=r['oss'] >= GATE_RHO,
                passa=(r['oss'] > 0 and r['p_glob'] < 0.01 and r['oss'] >= GATE_RHO))


def riga_res(Pr, nome, r, g=None):
    seg = '+' if r['oss'] > 0 else '-'
    alert = '' if r['oss'] > 0 else '  <-- SEGNO SBAGLIATO'
    Pr(f"  {nome}: rho={r['oss']:+.4f} ({seg}){alert} | p_glob={r['p_glob']:.2e} "
       f"({r['n_exceed']} perm>=oss) | per-gara {r['n_sig']}/{r['n_gare']}="
       f"{r['frac']*100:.0f}% {'PASS' if r['frac']>=0.5 else 'FAIL'}")
    if g is not None:
        Pr(f"      GATE: segno>0 {'OK' if g['seg'] else 'NO'} | p<0.01 {'OK' if g['pglob'] else 'NO'} | "
           f"rho>=0.187 {'OK' if g['rho'] else 'NO'}  -> {'PASS' if g['passa'] else 'FAIL'}")


def main():
    L = []; Pr = L.append
    Pr("=" * 80)
    Pr("SONDA SELEZIONE STRATEGICA (GATE) + MULTIVERSE — osservabilita' eta'-gomma")
    Pr("=" * 80)
    Pr(f"Macchina di permutazione importata da gen_osservabilita_degrado (non modificato).")
    Pr(f"Seed={SEED}. Riferimento primario non-stratificato rho={RIF_PRIMARIO:+.4f}; "
       f"soglia gate rho>={GATE_RHO}.")
    Pr(f"ANTI-TUNING: il multiverse misura la dispersione, non sceglie una specificazione.")
    Pr("")

    # sanity: la specificazione DEFAULT deve riprodurre il primario (+0.3746)
    obs.P_PERM = P_GATE
    base = analizza(costruisci_blocchi(DEFAULT), 'default (riproduzione primario)')
    Pr(f"CONTROLLO riproduzione primario (default, P={P_GATE}): rho={base['oss']:+.4f} "
       f"(atteso ~{RIF_PRIMARIO:+.4f}) | p_glob={base['p_glob']:.2e} | "
       f"per-gara {base['n_sig']}/{base['n_gare']}")
    Pr("")

    # ---------------- PARTE 1: GATE ----------------
    Pr("-" * 80)
    Pr("PARTE 1 — SONDA (GATE)")
    Pr("-" * 80)
    gates = {}
    # Lama A K=2, K=3
    Pr("Lama A — esclusione giri pre-pit (K giri prima dell'in-lap, pin non nullo):")
    for K in (2, 3):
        r = analizza(costruisci_blocchi({**DEFAULT, 'prepit_K': K}), f'Lama A K={K}')
        g = gate_eval(r); gates[f'A_K{K}'] = g
        riga_res(Pr, f'K={K}', r, g)
    # Lama B: per fascia + aggregato
    Pr("Lama B — controllo posizione (stratifica per fascia pos 1-5/6-12/13-20):")
    blocchi_B = costruisci_blocchi({**DEFAULT, 'strat': ['pos']})
    # per fascia: ricostruisco separatamente (i blocchi aggregati non portano l'etichetta fascia)
    for lo, hi in FASCE:
        spec = {**DEFAULT, 'strat': ['pos'], 'solo_fascia': (lo, hi)}
        bsub = _blocchi_fascia(spec, (lo, hi))
        if bsub:
            r = analizza(bsub, f'Lama B fascia {lo}-{hi}')
            riga_res(Pr, f'fascia {lo}-{hi}', r)
        else:
            Pr(f"  fascia {lo}-{hi}: nessun blocco usabile")
    rB = analizza(blocchi_B, 'Lama B aggregato')
    gB = gate_eval(rB); gates['B'] = gB
    riga_res(Pr, 'aggregato', rB, gB)
    Pr("")

    gate_ok = all(g['passa'] for g in gates.values())
    Pr(f"ESITO GATE: {'REGGE' if gate_ok else 'FALLISCE'} "
       f"(tutte le lame e i K devono soddisfare segno>0, p<0.01, rho>=0.187)")
    if not gate_ok:
        caduti = [k for k, g in gates.items() if not g['passa']]
        Pr(f"  condizioni cadute in: {caduti}")
        Pr("  Il segnale e' (almeno in parte) attribuibile alla selezione strategica, non")
        Pr("  solo alla gomma. PARTE 2 (multiverse) NON eseguita (la risposta c'e' gia').")
    Pr("")

    # ---------------- PARTE 2: MULTIVERSE ----------------
    specs_written = []
    if gate_ok:
        Pr("-" * 80)
        Pr("PARTE 2 — MULTIVERSE (dispersione, NON selezione)")
        Pr("-" * 80)
        obs.P_PERM = P_MULTI
        arias = (1.5, 2.0, 3.0); norms = ('med_gara', 'trim_gara', 'med_stint')
        outs = (1.05, 1.07, 1.10); lifes = (3, 4); mins = (5, 8); strats = (True, False)
        combos = list(itertools.product(arias, norms, outs, lifes, mins, strats))
        rows_csv = []
        for (aria, norm, out_, lf, mb, st_) in combos:
            spec = dict(aria=aria, norm=norm, outlier=out_, life_min=lf, min_block=mb,
                        strat=(['compound'] if st_ else []), prepit_K=0)
            r = analizza(costruisci_blocchi(spec), 'multi')
            rows_csv.append(dict(aria=aria, norm=norm, outlier=out_, life_min=lf, min_block=mb,
                                 compound_strat=int(st_), rho=r['oss'], p_glob=r['p_glob'],
                                 n_blocchi=r['n_blocchi']))
        specs_written = rows_csv
        rhos = np.array([x['rho'] for x in rows_csv])
        med = float(np.median(rhos))
        conc_segno = float(np.mean(rhos > 0))
        entro2 = float(np.mean((rhos >= med / 2) & (rhos <= med * 2))) if med > 0 else 0.0
        robusto = (conc_segno >= 0.90 and entro2 >= 0.75)
        Pr(f"  specificazioni testate: {len(rows_csv)} (P={P_MULTI})")
        Pr(f"  distribuzione rho: mediana {med:+.4f}  IQR [{np.percentile(rhos,25):+.4f},"
           f"{np.percentile(rhos,75):+.4f}]  min-max [{rhos.min():+.4f},{rhos.max():+.4f}]")
        Pr(f"  concordi sul segno (rho>0): {conc_segno*100:.1f}%  (soglia >=90%)")
        Pr(f"  entro fattore 2 dalla mediana [{med/2:+.4f},{med*2:+.4f}]: {entro2*100:.1f}%  (soglia >=75%)")
        Pr(f"  ESITO: {'ROBUSTO' if robusto else 'NON ROBUSTO'}")
        # diagnostica: quale dimensione muove di piu' (spread, NON classifica per forza)
        Pr("  dimensioni che muovono di piu' il rho (spread entro-dimensione, diagnostica):")
        dims = dict(aria='aria', norm='norm', outlier='outlier', life_min='life_min',
                    min_block='min_block', compound_strat='compound_strat')
        spreads = []
        for key in dims:
            vals = {}
            for x in rows_csv: vals.setdefault(x[key], []).append(x['rho'])
            medie = {v: float(np.median(a)) for v, a in vals.items()}
            spread = max(medie.values()) - min(medie.values())
            spreads.append((spread, key, medie))
        for spread, key, medie in sorted(spreads, reverse=True):
            det = ", ".join(f"{v}:{m:+.3f}" for v, m in sorted(medie.items(), key=lambda t: str(t[0])))
            Pr(f"    {key:15s} spread mediane={spread:.4f}  ({det})")
        Pr("")

    # limiti
    Pr("-" * 80)
    Pr("LIMITI DICHIARATI")
    Pr("-" * 80)
    Pr("  - Il disegno resta CROSS-DRIVER (associazione tra piloti allo stesso giro): e' la")
    Pr("    traccia OSSERVABILE del degrado, NON il degrado within-stint.")
    Pr("  - La Lama A esclude SOLO il pre-pit (K giri prima dell'in-lap): unica 'gestione'")
    Pr("    misurabile dal dato. Scelta esplicita del PO di non includerne altre.")
    Pr("  - Il multiverse misura la dispersione, NON raccomanda una specificazione o un")
    Pr("    estimatore. Nessun verdetto strategico: e' del PO.")
    Pr("=" * 80)

    testo = "\n".join(L)
    print(testo)
    open(OUT_TXT, 'w').write(testo + "\n")
    # writer deterministico CSV (solo se multiverse eseguito)
    with open(OUT_CSV, 'w', newline='') as f:
        cols = ['aria', 'norm', 'outlier', 'life_min', 'min_block', 'compound_strat',
                'rho', 'p_glob', 'n_blocchi']
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader()
        for x in sorted(specs_written, key=lambda x: (x['aria'], x['norm'], x['outlier'],
                        x['life_min'], x['min_block'], x['compound_strat'])):
            w.writerow({**x, 'rho': f"{x['rho']:.6f}", 'p_glob': f"{x['p_glob']:.6f}"})
    print(f"\n[scritto] {OUT_TXT}")
    print(f"[scritto] {OUT_CSV} ({len(specs_written)} specificazioni)")


def _blocchi_fascia(spec, fascia):
    """Blocchi della SOLA fascia indicata (per il riporto per-fascia della Lama B)."""
    out = []
    lo, hi = fascia
    for anno, cir, path in races():
        if path not in CACHE: CACHE[path] = carica_ricco(path)
        rows_raw, _ = CACHE[path]
        rows = [dict(r) for r in rows_raw]
        calcola_clean(rows, spec['aria'])
        keep, _, _ = pulisci(rows)
        keep, _ = filtro_outlier(keep, spec['outlier'])
        keep = [r for r in keep if r.get('clean')]
        if not keep: continue
        normalizza(keep, spec['norm'])
        gara = f"{anno}:{cir}"
        gruppi = {}
        for r in keep:
            if fascia_di(r['pos']) != (lo, hi): continue
            gruppi.setdefault(int(r['lap']), []).append(r)
        for rr in gruppi.values():
            if len({r['drv'] for r in rr}) < spec['min_block']: continue
            if len({int(r['life']) for r in rr}) < obs.MIN_LIFE: continue
            b = obs._mkblock(rr, gara, anno)
            if b is not None: out.append(b)
    return out


if __name__ == '__main__':
    main()
