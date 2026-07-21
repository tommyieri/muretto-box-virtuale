#!/usr/bin/env python3
"""run_percircuito.py — il coefficiente-carburante e' per-circuito, o lo sembra?

    python3 ai_lab/scienziato/run_percircuito.py

Esce sempre 0: nessun exit-code decide. Prepara la tabella per il tavolo umano, non
monta niente nel kernel. Prereg: PREREG_percircuito.md.
"""
import json
import os
import statistics as st
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)

import fondo
import percircuito as PC
import scheletro
import sigillo_null
from fenomeno_fuel import FenomenoFuel, KERNEL_SWING


def riga(t):
    print('=' * 92)
    print(t)
    print('=' * 92)


def main():
    # ZONA A CONTATTO UMANO OBBLIGATO: se il permutation-null e' stato toccato,
    # non si producono numeri finche' il tavolo non autorizza.
    if not sigillo_null.pretendi_integro('run_percircuito.py'):
        return 0

    cache = {}
    riga('FASE 1 — ricostruzione dal fondo, per CIRCUITO x ANNO')
    ric = scheletro.cosa_so_fare(FenomenoFuel(cache=cache), n_perm=0, verbose=False)
    # D1: diagnostico di curvatura (giro^2). Non modifica nessuna stima.
    diag = scheletro.cosa_so_fare(FenomenoFuel(cache=cache, giro_quadratico=True),
                                  n_perm=0, verbose=False)
    curv = {x['blocco']: x.get('curvatura_giro2') for x in diag['per_blocco']}

    tab = PC.tabella(ric['per_blocco'])
    anni = ('2023', '2024', '2025', '2026')
    print(f"  {'circuito':18s} " + ' '.join(f'{a:>16s}' for a in anni) + '   curv.giro2')
    for c in sorted(tab):
        celle = []
        for a in anni:
            x = tab[c].get(a)
            celle.append('' if x is None else
                         f"{x['valore']:+5.2f}[{x['valore_ci95'][0]:+.2f},{x['valore_ci95'][1]:+.2f}]")
        cs = [curv.get(f'{a} {n}') for a in anni for n in ({c} | {k for k, v in PC.ALIAS.items() if v == c})
              if curv.get(f'{a} {n}') is not None]
        print(f"  {c:18s} " + ' '.join(f'{s:>16s}' for s in celle)
              + (f"   {st.mean(cs):+.2e}" if cs else '        --'))

    riga(f'FASE 2 — il test di stabilita (>=3 anni del regime {fondo.REGIME_SUOLO})')
    print(f"  porta di potenza: INDECIDIBILE se <3 anni o semiampiezza IC95 media >= "
          f"{PC.MAX_SEMIAMPIEZZA} s")
    print('  Q di Cochran contro chi2_95(k-1); tau = oscillazione anno-su-anno in secondi\n')
    bucket = {}
    for c in sorted(tab):
        s = PC.stabilita(tab[c])
        s['circuito'] = c
        bucket.setdefault(s['bucket'], []).append(s)
    for b in ('STABILE', 'INSTABILE', 'INDECIDIBILE'):
        lista = bucket.get(b, [])
        print(f'  {b}  ({len(lista)})')
        for s in sorted(lista, key=lambda x: x.get('Q', 999)):
            if s['motivo']:
                print(f"    {s['circuito']:18s} {s['motivo']}"
                      + (f"   valori {[round(v,2) for v in s['valori']]}" if s['valori'] else ''))
            else:
                print(f"    {s['circuito']:18s} valori {s['valori']}  SE {s['se']}  "
                      f"Q={s['Q']:6.2f} vs {s['critico_95']}  tau={s['tau_s']:.2f}s  "
                      f"media pesata {s['media_pesata']:+.3f} {s['ci95_media_pesata']}")
        print()

    print('  SENSIBILITA dichiarata — SE gonfiate (la SE cluster-robust ignora gli shock')
    print('  comuni di gara, quindi il test e\' sbilanciato verso INSTABILE):')
    for g in (1.0, 1.5, 2.0):
        conta = {}
        for c in sorted(tab):
            conta[PC.stabilita(tab[c], gonfia_se=g)['bucket']] = \
                conta.get(PC.stabilita(tab[c], gonfia_se=g)['bucket'], 0) + 1
        print(f"    SE x{g}: " + '  '.join(f'{k}={v}' for k, v in sorted(conta.items())))

    bucket_di = {s['circuito']: b for b, v in bucket.items() for s in v}
    riga('FASE 2b — LA PROVA: predizione fuori campione (leave-one-year-out)')
    celle = [{'circuito': PC.circuito(x['blocco'])[0], 'anno': PC.circuito(x['blocco'])[1],
              'valore': x['valore']} for x in ric['per_blocco'] if x['regime'] == fondo.REGIME_SUOLO]
    loyo = PC.leave_one_year_out(celle)
    print(f"  {loyo['n_celle']} celle tenute fuori, {loyo['n_circuiti']} circuiti con >=3 anni")
    print(f"  errore mediano PER-CIRCUITO : {loyo['errore_mediano_percircuito']:.3f} s")
    print(f"  errore mediano GLOBALE      : {loyo['errore_mediano_globale']:.3f} s")
    print(f"  guadagno del per-circuito   : {loyo['guadagno']:+.3f} s   "
          f"(vince in {loyo['celle_dove_vince_percircuito']}/{loyo['n_celle']} celle)")
    nul = PC.null_etichette(celle)
    print(f"\n  null con etichette di circuito rimescolate ({nul['repliche']} repliche):")
    print(f"    guadagno mediano sotto il null {nul['mediana_null']:+.3f}, "
          f"q95 {nul['q95_null']:+.3f}  ->  p = {nul['p']}")

    dett = {}
    for x in loyo['dettaglio']:
        d = dett.setdefault(x['circuito'], {'vinte': 0, 'n': 0, 'ec': [], 'eg': []})
        d['vinte'] += x['errore_circuito'] < x['errore_globale']
        d['n'] += 1
        d['ec'].append(x['errore_circuito'])
        d['eg'].append(x['errore_globale'])
    print(f"\n  dove nasce il guadagno ({'circuito':16s} vince  err.circ  err.glob):")
    for c, d in sorted(dett.items(), key=lambda kv: -(st.mean(kv[1]['eg']) - st.mean(kv[1]['ec']))):
        d['err_circuito'], d['err_globale'] = round(st.mean(d['ec']), 3), round(st.mean(d['eg']), 3)
        print(f"    {c:18s} {d['vinte']}/{d['n']}   {d['err_circuito']:6.3f}   "
              f"{d['err_globale']:6.3f}   [{bucket_di.get(c, '?')}]")

    riga('FASE 3 — quanto costa la costante (informazione, NON azione)')
    glob_ric = ric['regimi'][fondo.REGIME_SUOLO]['mediana']
    print(f"  numero unico del kernel      : {KERNEL_SWING:.3f} s (x(N-1)/N ~ 2,95 s)")
    print(f"  globale ricostruito dal fondo: {glob_ric:+.3f} s\n")
    print(f"  {'circuito':18s} {'per-circuito':>22s} {'vs kernel':>10s} {'vs globale ric.':>16s}")
    stabili = sorted(bucket.get('STABILE', []), key=lambda s: -abs(s['media_pesata'] - 2.95))
    for s in stabili:
        ker = KERNEL_SWING * 0.982        # (N-1)/N mediano sul panel; vedi report
        print(f"  {s['circuito']:18s} {s['media_pesata']:+8.3f} "
              f"[{s['ci95_media_pesata'][0]:+.2f},{s['ci95_media_pesata'][1]:+.2f}]"
              f" {s['media_pesata']-ker:+10.3f} {s['media_pesata']-glob_ric:+16.3f}")

    riga('D1 — il confondimento e\' lo stesso per ogni circuito?')
    cur_c = []
    for c in sorted(tab):
        v = [x['valore'] for a, x in tab[c].items() if a != '2026']
        cu = [curv.get(f'{a} {n}') for a in ('2023', '2024', '2025')
              for n in ({c} | {k for k, vv in PC.ALIAS.items() if vv == c})]
        cu = [x for x in cu if x is not None]
        if v and cu:
            cur_c.append((c, st.mean(v), st.mean(cu)))
    cur_c.sort(key=lambda r: -r[2])
    print('  curvatura giro2 = firma dell\'evoluzione pista (satura); il carburante e\' '
          'esattamente lineare')
    for c, v, cu in cur_c:
        print(f'    {c:18s} Delta medio {v:+6.2f}   curvatura {cu:+10.2e}')
    rho_cur = PC.spearman([r[2] for r in cur_c], [r[1] for r in cur_c])
    print(f'\n  Spearman(curvatura, Delta medio) = {rho_cur}  -> se ~0, i circuiti con '
          'Delta alto NON sono\n  semplicemente quelli che si gommano di piu\'')

    riga('S3 — colonna 2026 (informativa, mai vincolante)')
    coppie = [(st.mean([tab[c][a]['valore'] for a in tab[c] if a != '2026']),
               tab[c]['2026']['valore'], c)
              for c in tab if '2026' in tab[c] and len([a for a in tab[c] if a != '2026']) >= 1]
    rho = PC.spearman([x[0] for x in coppie], [x[1] for x in coppie])
    print(f"  {len(coppie)} circuiti presenti in entrambi i regimi; Spearman(media 2023-25, "
          f"valore 2026) = {rho}")
    for a, b, c in sorted(coppie, key=lambda x: -x[0]):
        print(f"    {c:18s} 2023-25 {a:+6.2f}   2026 {b:+6.2f}")

    fuori = {'tabella': {c: {a: {'valore': x['valore'], 'ci95': x['valore_ci95'],
                                 'n_giri': x['n_giri'], 'curvatura_giro2': curv.get(x['blocco'])}
                             for a, x in tab[c].items()} for c in tab},
             'bucket': {b: [dict(s) for s in v] for b, v in bucket.items()},
             'leave_one_year_out': loyo,
             'loyo_per_circuito': {c: {k: v for k, v in d.items() if k not in ('ec', 'eg')}
                                   for c, d in dett.items()}, 'null_etichette': nul,
             'globale_ricostruito_2023_25': glob_ric, 'kernel': KERNEL_SWING,
             'spearman_2026': rho, 'spearman_curvatura_delta': rho_cur,
             'curvatura_per_circuito': {c: {'delta_medio': round(v, 3),
                                            'curvatura': cu} for c, v, cu in cur_c}}
    with open(os.path.join(QUI, 'esito_percircuito.json'), 'w') as f:
        json.dump(fuori, f, ensure_ascii=False, indent=1, default=str)
        f.write('\n')

    with open(os.path.join(QUI, 'fuel_per_circuito_anno.csv'), 'w') as f:
        f.write('circuito,anno,valore,ci_lo,ci_hi,n_giri,curvatura_giro2,bucket\n')
        buck = {s['circuito']: s['bucket'] for v in bucket.values() for s in v}
        for c in sorted(tab):
            for a in sorted(tab[c]):
                x = tab[c][a]
                f.write(f"{c},{a},{x['valore']},{x['valore_ci95'][0]},{x['valore_ci95'][1]},"
                        f"{x['n_giri']},{curv.get(x['blocco'])},{buck.get(c, '')}\n")
    print('\n  scritti: ai_lab/scienziato/fuel_per_circuito_anno.csv, esito_percircuito.json')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
