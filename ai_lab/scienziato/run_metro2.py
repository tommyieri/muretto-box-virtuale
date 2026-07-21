#!/usr/bin/env python3
"""run_metro2.py — deriva la soglia, congela le predizioni, pianta la domanda.

    python3 ai_lab/scienziato/run_metro2.py

Scrive predizioni_congelate.json (che la sorveglianza legge e NON riscrive mai) e
sorveglianza_stato.json (lo stato iniziale). Esce sempre 0.

REGOLA ANTI-BARA (PREREG_metro2.md §3): i 13 circuiti gia' visti ricevono PREDIZIONI,
non verdetti. La prova arriva da celle fresche, e la emette sorveglianza.py.
"""
import json
import os
import statistics as st
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)

import metro2
import percircuito as PC
import scheletro
from fenomeno_fuel import FenomenoFuel, KERNEL_SWING

MIN_ANNI = PC.MIN_ANNI


def riga(t):
    print('=' * 92)
    print(t)
    print('=' * 92)


def costruisci(cache=None):
    """Tabella circuito x anno dal fondo, per regime. Nessun numero ereditato."""
    ric = scheletro.cosa_so_fare(FenomenoFuel(cache=cache or {}), n_perm=0, verbose=False)
    tab = PC.tabella(ric['per_blocco'])
    regime = {x['blocco']: x['regime'] for x in ric['per_blocco']}
    return tab, regime, ric


def anni_regime(tab_c, regime, circuito, reg):
    """Anni di quel circuito appartenenti a quel regime."""
    return sorted(a for a in tab_c if regime.get(f'{a} {_nome_grezzo(circuito, a, tab_c)}',
                                                 '2026' if a == '2026' else '2023-25') == reg)


def _nome_grezzo(c, a, tab_c):
    return tab_c[a]['blocco'].split(' ', 1)[1] if 'blocco' in tab_c[a] else c


def main():
    cache = {}
    tab, regime, ric = costruisci(cache)
    REG = '2023-25'

    riga('SOGLIA della condizione (ii) — DERIVATA dai dati, non fissata a mano')
    celle_per_anno = {}
    for c in tab:
        for a, x in tab[c].items():
            if a == '2026':
                continue
            celle_per_anno.setdefault(a, []).append((x['valore'], metro2._se(x)))
    print('  nulla: etichette di circuito permutate dentro ogni stagione (valore e SE in')
    print('  coppia); stessa D, stessa condizione (i). Soglia = D al 5% di falsi positivi')
    print('  CONGIUNTI (i)^(ii).\n')
    soglie = {}
    for k in (2, 3, 4):
        if k > len(celle_per_anno):
            continue
        s = metro2.soglia_da_nulla(celle_per_anno, k)
        soglie[k] = s
        print(f"  k={k} stagioni: soglia = {s['soglia']:.3f} s   "
              f"(falsi positivi della sola (i): {s['fp_solo_condizione_i']:.3f}; "
              f"quantili D nulla {s['quantili_D_nulla']})")
    SOGLIA = soglie[3]['soglia']
    print(f"\n  -> si applica la soglia di k=3: {SOGLIA:.3f} s")

    riga('PREDIZIONI CONGELATE sui 13 gia visti — TARATE A POSTERIORI, NON PROVA')
    vecchio = {}
    for c in sorted(tab):
        vecchio[c] = PC.stabilita(tab[c])['bucket']
    tutti_2325 = [x['valore'] for x in ric['per_blocco'] if x['regime'] == REG]

    predizioni, giudicati = {}, []
    print(f"  {'circuito':18s} {'valori 2023-25':26s} {'lato':8s} {'D':>7s}  "
          f"{'metro NUOVO':18s} {'metro vecchio':12s}")
    for c in sorted(tab):
        anni = [a for a in tab[c] if a != '2026']
        if len(anni) < MIN_ANNI:
            continue
        v = [tab[c][a]['valore'] for a in sorted(anni)]
        se = [metro2._se(tab[c][a]) for a in sorted(anni)]
        G = metro2.globale_meno(tutti_2325, v)
        g = metro2.giudica(v, se, G, SOGLIA)
        g.update({'circuito': c, 'regime': REG, 'anni': sorted(anni),
                  'valori': [round(x, 3) for x in v], 'metro_vecchio': vecchio[c],
                  'predizione': ('PASSERA' if g['esito'] == 'PER-CIRCUITO VERO'
                                 else 'NON PASSERA'),
                  'statuto': 'PREDIZIONE CONGELATA — metro tarato a posteriori su questi '
                             'stessi circuiti: NON e\' prova'})
        giudicati.append(g)
        print(f"  {c:18s} {str([round(x,2) for x in v]):26s} {g['lato']:8s} "
              f"{g['D']:7.3f}  {g['esito']:18s} {vecchio[c]:12s}"
              + ('' if g['esito'] == 'PER-CIRCUITO VERO' else
                 '   [fallisce ' + '+'.join(
                     ([] if g['condizione_i_segno_stabile'] else ['(i) segno'])
                     + ([] if g['condizione_ii_distanza_netta'] else ['(ii) distanza'])) + ']'))
    predizioni['gia_visti_NON_PROVA'] = giudicati

    n_passa = sum(1 for g in giudicati if g['esito'] == 'PER-CIRCUITO VERO')
    print(f"\n  {n_passa}/{len(giudicati)} passerebbero il metro nuovo "
          f"(vecchio: {sum(1 for c in vecchio if vecchio[c]=='STABILE')} STABILI)")

    riga('PREDIZIONI CONGELATE sulle celle INDECIDIBILI — il test onesto, differito')
    attese = []
    for c in sorted(tab):
        anni = sorted(a for a in tab[c] if a != '2026')
        if len(anni) >= MIN_ANNI:
            continue
        mancanti = sorted({'2023', '2024', '2025'} - set(anni))
        v = [tab[c][a]['valore'] for a in anni]
        se = [metro2._se(tab[c][a]) for a in anni]
        pred = {'circuito': c, 'anni_2023_25': anni, 'stagioni_mancanti_2023_25': mancanti,
                'valori_2023_25': [round(x, 3) for x in v],
                'ha_2026': '2026' in tab[c],
                'valore_2026': round(tab[c]['2026']['valore'], 3) if '2026' in tab[c] else None}
        if v:
            G = metro2.globale_meno(tutti_2325, v)
            d = [x - G for x in v]
            Dp = abs(metro2.media_pesata(v, se) - G)
            pred.update({'globale_meno_c': round(G, 4),
                         'deviazioni_parziali': [round(x, 3) for x in d],
                         'D_parziale': round(Dp, 4),
                         'segno_finora': 'sopra' if all(x > 0 for x in d) else
                                         ('sotto' if all(x < 0 for x in d) else 'oscilla'),
                         'predizione': ('PASSERA' if (Dp >= SOGLIA and
                                                      (all(x > 0 for x in d) or all(x < 0 for x in d)))
                                        else 'NON PASSERA'),
                         'base': f'{len(v)} stagioni su 3 — predizione da dati parziali'})
        attese.append(pred)
        print(f"  {c:18s} finora {pred['valori_2023_25']}  segno {pred.get('segno_finora','?'):8s} "
              f"D={pred.get('D_parziale', float('nan')):6.3f}  ->  PREDICE "
              f"{pred.get('predizione','?')}"
              f"   (manca {','.join(mancanti)})")
    predizioni['indecidibili_predizione'] = attese

    riga('QUANDO scattera il verdetto vero — e perche NON e stanotte')
    print('  Confine di regime (PREREG_metro2 §4): una gara 2026 NON puo fare da terza')
    print('  stagione a un circuito 2023-25. Regimi mai mescolati.\n')
    perse = [p for p in attese if p['stagioni_mancanti_2023_25']]
    print(f"  Le {len(perse)} celle indecidibili aspettano stagioni del regime 2023-25 —")
    print('  che e CHIUSO. Le stagioni mancanti non arriveranno mai: sono state perse per')
    print('  pioggia o non si sono corse. Dentro il loro regime NON saranno mai giudicabili.\n')
    print('  L unica strada per un verdetto vero e il regime 2026, che deve accumulare 3')
    print('  stagioni: 2026 + 2027 + 2028. Circuiti gia con la prima:')
    for c in sorted(tab):
        if '2026' in tab[c]:
            print(f"    {c:18s} 2026 = {tab[c]['2026']['valore']:+.3f}  -> servono 2027 e 2028")

    riga('LETTURA CROSS-REGIME — INDIZIO, NON VERDETTO')
    print('  Si applica il metro come SE la posizione relativa fosse regime-invariante.')
    print('  Ipotesi NON verificata e contraddetta dall unica evidenza (Spearman -0,055).')
    print('  Riportata perche il tavolo veda quanto sarebbe fragile, non per decidere.\n')
    v2026 = [x['valore'] for x in ric['per_blocco'] if x['regime'] == '2026']
    G26 = st.median(v2026)
    incroci = []
    for p in attese:
        if not p['ha_2026'] or not p['anni_2023_25']:
            continue
        c = p['circuito']
        d = list(p['deviazioni_parziali']) + [tab[c]['2026']['valore'] - G26]
        segno = all(x > 0 for x in d) or all(x < 0 for x in d)
        incroci.append({'circuito': c, 'deviazioni': [round(x, 3) for x in d],
                        'segno_stabile_cross_regime': segno})
        print(f"    {c:18s} deviazioni {[round(x,2) for x in d]}  "
              f"segno {'STABILE' if segno else 'oscilla'}")
    print(f"\n  {sum(1 for x in incroci if x['segno_stabile_cross_regime'])}/{len(incroci)} "
          'mantengono il segno attraverso il confine di regime — con etichette a caso ce ne')
    print('  si aspetterebbero circa 1/4. INDIZIO, non verdetto.')

    predizioni['meta'] = {
        'soglia_k3': SOGLIA, 'soglie_per_k': soglie, 'globale_regime_2023_25':
        ric['regimi'][REG]['mediana'], 'globale_regime_2026': round(G26, 4),
        'kernel': KERNEL_SWING, 'min_anni': MIN_ANNI,
        'regola': 'PER-CIRCUITO VERO = (i) segno stabile E (ii) D >= soglia',
        'anti_bara': 'i 13 gia visti hanno predizioni, non verdetti; la prova viene da '
                     'celle che non hanno ispirato il metro',
        'cross_regime_indizio': incroci}

    with open(os.path.join(QUI, 'predizioni_congelate.json'), 'w') as f:
        json.dump(predizioni, f, ensure_ascii=False, indent=1, default=str)
        f.write('\n')
    print('\n  scritto (SOLA LETTURA d ora in poi): ai_lab/scienziato/predizioni_congelate.json')

    # stato iniziale della sorveglianza: le celle GIA' giudicabili stanotte sono la
    # linea di base (hanno ispirato il metro) e vengono marcate come gia' emesse, cosi'
    # la sorveglianza non le spaccia mai per verdetti freschi.
    foto = {}
    for x in ric['per_blocco']:
        cc, aa = PC.circuito(x['blocco'])
        foto.setdefault(f'{cc}|{x["regime"]}', []).append(aa)
    celle = {k: {'anni': sorted(v),
                 'stato': 'giudicabile' if len(v) >= MIN_ANNI else 'indecidibile'}
             for k, v in foto.items()}
    stato = {'celle': celle,
             'verdetti_emessi': sorted(k for k, v in celle.items()
                                       if v['stato'] == 'giudicabile'),
             'nota_linea_di_base': 'le celle gia giudicabili al commit delle predizioni '
                                   'sono quelle che hanno ISPIRATO il metro: marcate come '
                                   'gia emesse, non produrranno mai un verdetto "fresco"',
             'soglia_congelata': SOGLIA}
    with open(os.path.join(QUI, 'sorveglianza_stato.json'), 'w') as f:
        json.dump(stato, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('  scritto: ai_lab/scienziato/sorveglianza_stato.json (linea di base)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
