#!/usr/bin/env python3
"""run_scienziato.py — CLI dell'agente-scienziato.

    python3 ai_lab/scienziato/run_scienziato.py                 # B1 + B2 (+ B3 se UGUALE)
    python3 ai_lab/scienziato/run_scienziato.py --senza-null    # piu' veloce, niente permutazioni
    python3 ai_lab/scienziato/run_scienziato.py --controllo-fondo

Nessun exit-code decide: esce sempre 0. Il cancello B2 e' una PROPOSTA per il tavolo
umano (Tommi + Claude). Se l'esito e' DIVERSO l'agente SI FERMA: non monta nulla, non
sostituisce nessun numero, non prosegue a B3.
"""
import argparse
import json
import os
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)

import fondo
import scheletro
import sigillo_null
from fenomeno_fuel import FenomenoFuel


def riga(t):
    print('=' * 84)
    print(t)
    print('=' * 84)


def controllo_fondo():
    """L'eta-gomma ricostruita dai soli PIT REALI regge il confronto col campo `life`
    della fonte? Non corregge nulla: misura l'accordo."""
    riga('CONTROLLO DEL FONDO — eta ricostruita dai pit vs campo `life` della fonte')
    tot = {'n': 0, 'esatti': 0, 'entro1': 0}
    for b in fondo.elenco_blocchi():
        righe = fondo.carica(b['percorso'])
        c = fondo.controllo_eta(righe, fondo.stint_ed_eta(righe))
        if not c:
            continue
        tot['n'] += c['n']
        tot['esatti'] += round(c['accordo_esatto'] * c['n'])
        tot['entro1'] += round(c['entro_1'] * c['n'])
        print(f"  {b['id']:34s} accordo esatto {c['accordo_esatto']:.3f}  "
              f"entro 1 {c['entro_1']:.3f}  scarti {c['scarti_piu_frequenti']}")
    print(f"\n  TOTALE {tot['n']} giri: accordo esatto {tot['esatti']/tot['n']:.4f}, "
          f"entro 1 giro {tot['entro1']/tot['n']:.4f}")
    print('  (uno scarto costante positivo e\' atteso: `life` conta anche i giri di '
          'qualifica sulla gomma di partenza; la ricostruzione conta solo i giri di gara)')
    return tot


def main():
    p = argparse.ArgumentParser(description='Agente-scienziato: fuel dal fondo.')
    p.add_argument('--senza-null', action='store_true')
    p.add_argument('--senza-robustezze', action='store_true')
    p.add_argument('--controllo-fondo', action='store_true')
    p.add_argument('--n-perm', type=int, default=200)
    a = p.parse_args()

    # ZONA A CONTATTO UMANO OBBLIGATO: se il permutation-null e' stato toccato,
    # non si producono numeri finche' il tavolo non autorizza.
    if not sigillo_null.pretendi_integro('run_scienziato.py'):
        return 0

    if a.controllo_fondo:
        controllo_fondo()
        return 0

    cache = {}
    fen = FenomenoFuel(cache=cache)

    riga('B1 — COSA SO FARE: la correzione carburante ricostruita dal FONDO')
    print(f'  grandezza: {fen.grandezza}')
    print(f'  unita:     {fen.unita}')
    print(f'  blocco:    una GARA (blocchi indipendenti, mai osservazioni)\n')
    ric = scheletro.cosa_so_fare(fen, n_perm=0 if a.senza_null else a.n_perm)

    print('\n  ESCLUSI:')
    for e in ric['esclusi']:
        print(f"    {e['blocco']:34s} {e['motivo']}")

    print('\n  AGGREGATO PER REGIME (mediana cross-gara, IC95 bootstrap sui BLOCCHI):')
    for r, v in ric['regimi'].items():
        print(f"    regime {r:8s} n_gare={v['n_blocchi']:3d}  Delta = {v['mediana']:+.3f} s  "
              f"IC95 {v['ci95']}   (kernel mediano {v['kernel_mediano']:+.3f} s)")
        if r in ric['null']:
            n = ric['null'][r]
            print(f"                 null di permutazione ({n['n_permutazioni']} repliche): "
                  f"mediana aggregata {n['mediana_null_aggregato']:+.3f}, "
                  f"q95|null| {n['q95_|null_aggregato|']:.3f}, p = {n['p']}")
            print(f"                 (spread del null su UNA gara sola: "
                  f"q95 {n['q95_|null_singola_gara|']:.3f} s)")

    cr = ric.get('confronto_regimi')
    if cr:
        print(f"\n  I DUE REGIMI SONO DISTINGUIBILI? differenza {cr['regimi'][0]} - "
              f"{cr['regimi'][1]} = {cr['differenza']:+.3f} s   IC95 {cr['ci95']}   "
              f"-> {'SI' if cr['distinguibili'] else 'NO (l\'IC95 contiene 0)'}")

    oos = scheletro.fuori_campione(ric, fen)
    print('\n  FUORI CAMPIONE (calibrazione su gare pari, misura su dispari):')
    for r, v in oos.items():
        if v['possibile']:
            print(f"    regime {r:8s} previsione {v['previsione_ricostruita']:+.3f} -> errore "
                  f"mediano {v['errore_mediano_ricostruita']:.3f} s   "
                  f"(kernel: {v['errore_mediano_kernel']:.3f} s)  vince: {v['vince']}")
        else:
            print(f"    regime {r:8s} {v['motivo']}")

    robustezze = {}
    if not a.senza_robustezze:
        riga('ROBUSTEZZE DICHIARATE')
        for nome, par in FenomenoFuel.varianti_robustezza().items():
            f2 = FenomenoFuel(cache=cache, **par)
            r2 = scheletro.cosa_so_fare(f2, n_perm=0, verbose=False)
            robustezze[nome] = {k: {'mediana': v['mediana'], 'ci95': v['ci95'],
                                    'n_blocchi': v['n_blocchi']}
                                for k, v in r2['regimi'].items()}
            for k, v in r2['regimi'].items():
                print(f"  {nome:24s} regime {k:8s} Delta = {v['mediana']:+.3f}  "
                      f"IC95 {v['ci95']}  n={v['n_blocchi']}")

    riga('B2 — CONFRONTO COL MATTONE ESISTENTE (il cancello umano)')
    print('  kernel: engine/engine.py:40  FUEL_COEFF = 3.0/70.0 su 70 kg'
          '  =>  Delta_kernel = 3,0*(N-1)/N')
    conf = scheletro.confronto(ric)
    for r, e in conf['per_regime'].items():
        print(f"\n  regime {r}: {e['esito']}")
        print(f"    kernel      {e['kernel']:+.3f} s")
        print(f"    ricostruito {e['ricostruito']:+.3f} s   IC95 {e['ci95']}   "
              f"scarto {e['scarto']:+.3f} s   ({e['n_blocchi']} blocchi)")
        print(f"    gare che divergono singolarmente (IC95 di gara che esclude il kernel): "
              f"{len(e['blocchi_divergenti'])}/{e['n_blocchi']}")
        for x in e['blocchi_divergenti'][:12]:
            print(f"       {x['blocco']:34s} {x['ricostruito']:+7.3f}  IC95 {x['ci95']}  "
                  f"kernel {x['kernel']:+.3f}")
        if len(e['blocchi_divergenti']) > 12:
            print(f"       ... e altre {len(e['blocchi_divergenti'])-12}")

    print(f"\n  ESITO COMPLESSIVO: {conf['esito']}")
    print(f"  {conf['autorita']}")

    fuori = {'B1': ric, 'B2': conf, 'fuori_campione': oos, 'robustezze': robustezze}

    if conf['esito'] == 'DIVERSO':
        riga('FERMO — discrepanza sul mattone piu basso')
        print('  Non proseguo a B3. Non monto niente, non sostituisco nessun numero.')
        print('  La discrepanza va al tavolo umano (Tommi + Claude).')
        fuori['B3'] = {'eseguito': False, 'motivo': 'B2 = DIVERSO: fermo per regola di prereg'}
    else:
        riga('B3 — COSA MI MANCA: la mappa dei fronti deboli')
        b3 = scheletro.cosa_mi_manca(ric, robustezze, oos)
        for f in b3['fronti']:
            print(f"  - {json.dumps(f, ensure_ascii=False)}")
        fuori['B3'] = b3

    # ogni valore ha il suo generatore committato: la tabella per gara accanto al JSON
    csv = os.path.join(QUI, 'fuel_per_gara.csv')
    campi = ('blocco', 'regime', 'data', 'valore', 'ci_lo', 'ci_hi', 'kernel',
             'gamma_s_per_giro', 'se_gamma', 'n_laps_gara', 'n_giri', 'n_piloti',
             'n_stint', 'corr_giro_eta', 'sigma_residuo', 'degrado_medio_s_giro')
    with open(csv, 'w') as f:
        f.write(','.join(campi) + '\n')
        for x in sorted(ric['per_blocco'], key=lambda z: z['blocco']):
            r = dict(x, ci_lo=x['valore_ci95'][0], ci_hi=x['valore_ci95'][1])
            f.write(','.join(str(r.get(c, '')) for c in campi) + '\n')
    print(f'\n  scritto: {os.path.relpath(csv, os.path.dirname(os.path.dirname(QUI)))}')

    dest = os.path.join(QUI, 'esito_fuel.json')
    with open(dest, 'w') as f:
        json.dump(fuori, f, ensure_ascii=False, indent=1, default=str)
        f.write('\n')
    print(f'\n  scritto: {os.path.relpath(dest, os.path.dirname(os.path.dirname(QUI)))}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
