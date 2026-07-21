#!/usr/bin/env python3
"""sorveglianza.py — la domanda falsificabile piantata stanotte, che si giudica da sola.

    python3 ai_lab/scienziato/sorveglianza.py            # riporta solo i cambiamenti
    python3 ai_lab/scienziato/sorveglianza.py --stato    # stampa lo stato, non lo cambia

COSA FA
  Ricalcola dal FONDO la tabella circuito x anno. La confronta con lo stato salvato.
  Riporta SOLO quando una cella CAMBIA STATO: da "indecidibile" (<3 stagioni nello stesso
  regime) a "giudicabile" (3 stagioni). In quel momento — e solo allora — applica il metro
  a due condizioni con la SOGLIA CONGELATA e dice se la PREDIZIONE CONGELATA reggeva.

PERCHE' E' UN TEST ONESTO
  Il metro e' stato ispirato dai 13 circuiti gia' visti: giudicarli con esso non prova
  niente (PREREG_metro2 §3). Una cella che raggiunge le 3 stagioni DOPO il commit delle
  predizioni non ha ispirato il metro. Quello e' il test.

INVARIANTI
  - predizioni_congelate.json e' SOLA LETTURA: non viene mai riscritto. Se la predizione
    potesse cambiare, non sarebbe congelata.
  - La soglia usata e' quella congelata, non ricalcolata sui dati nuovi.
  - Regimi mai mescolati: le 3 stagioni devono stare nello STESSO regime.
  - Idempotente: due esecuzioni senza dati nuovi non producono nessun verdetto.
  - Esce sempre 0. Nessun exit-code decide: il verdetto va al tavolo umano.
"""
import argparse
import json
import os
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)

import metro2
import percircuito as PC
import scheletro
from fenomeno_fuel import FenomenoFuel

CONGELATE = os.path.join(QUI, 'predizioni_congelate.json')
STATO = os.path.join(QUI, 'sorveglianza_stato.json')
MIN_ANNI = PC.MIN_ANNI


def fotografia():
    """Stato attuale dal fondo: {circuito: {regime: {anno: cella}}}."""
    ric = scheletro.cosa_so_fare(FenomenoFuel(), n_perm=0, verbose=False)
    foto = {}
    for x in ric['per_blocco']:
        c, a = PC.circuito(x['blocco'])
        foto.setdefault(c, {}).setdefault(x['regime'], {})[a] = {
            'valore': x['valore'], 'valore_ci95': x['valore_ci95']}
    globali = {r: v['mediana'] for r, v in ric['regimi'].items()}
    return foto, globali, ric


def _stato_cella(anni):
    return 'giudicabile' if len(anni) >= MIN_ANNI else 'indecidibile'


def carica_stato():
    if os.path.exists(STATO):
        return json.load(open(STATO))
    return {'celle': {}, 'verdetti_emessi': []}


def main():
    p = argparse.ArgumentParser(description='Sorveglianza per-circuito.')
    p.add_argument('--stato', action='store_true', help='stampa lo stato senza cambiarlo')
    a = p.parse_args()

    if not os.path.exists(CONGELATE):
        print('Nessuna predizione congelata: eseguire prima run_metro2.py. Niente da sorvegliare.')
        return 0
    cong = json.load(open(CONGELATE))
    soglia = cong['meta']['soglia_k3']
    pred_di = {x['circuito']: x for x in cong['indecidibili_predizione']}
    pred_di.update({x['circuito']: x for x in cong['gia_visti_NON_PROVA']})

    foto, globali, ric = fotografia()
    stato = carica_stato()
    nuovo = {}
    for c, regimi in foto.items():
        for r, anni in regimi.items():
            nuovo[f'{c}|{r}'] = {'anni': sorted(anni), 'stato': _stato_cella(anni)}

    if a.stato:
        print(f'soglia congelata: {soglia:.3f} s   celle sorvegliate: {len(nuovo)}')
        for k in sorted(nuovo):
            vecchio = stato['celle'].get(k, {}).get('stato', '(nuova)')
            print(f"  {k:28s} {nuovo[k]['stato']:12s} anni {nuovo[k]['anni']}"
                  + ('' if vecchio == nuovo[k]['stato'] else f'   [era {vecchio}]'))
        return 0

    transizioni = []
    for k, v in sorted(nuovo.items()):
        prima = stato['celle'].get(k, {}).get('stato')
        if v['stato'] == 'giudicabile' and prima != 'giudicabile' and k not in stato['verdetti_emessi']:
            transizioni.append((k, v, prima))

    if not transizioni:
        # idempotenza: nessun rumore quando non e' cambiato niente
        stato['celle'] = nuovo
        json.dump(stato, open(STATO, 'w'), ensure_ascii=False, indent=1)
        print('nessun cambiamento di stato: nessuna cella e\' diventata giudicabile.')
        return 0

    print('=' * 92)
    print('CELLE DIVENTATE GIUDICABILI — primo verdetto vero del metro a due condizioni')
    print('=' * 92)
    for k, v, prima in transizioni:
        c, r = k.split('|')
        anni = sorted(foto[c][r])[:MIN_ANNI]
        celle = [foto[c][r][x] for x in anni]
        val = [x['valore'] for x in celle]
        se = [metro2._se(x) for x in celle]
        tutti = [y['valore'] for cc, rr in foto.items() for x, y in rr.get(r, {}).items()]
        G = metro2.globale_meno(tutti, val)
        g = metro2.giudica(val, se, G, soglia)
        atteso = pred_di.get(c, {}).get('predizione')
        ottenuto = 'PASSERA' if g['esito'] == 'PER-CIRCUITO VERO' else 'NON PASSERA'
        regge = None if atteso is None else (atteso == ottenuto)
        print(f"\n  {c}  (regime {r})   era: {prima or '(mai vista)'}")
        print(f"    stagioni {anni}  valori {[round(x,3) for x in val]}")
        print(f"    lato {g['lato']}   D = {g['D']:.3f}  vs soglia congelata {soglia:.3f}")
        print(f"    (i) segno stabile   : {g['condizione_i_segno_stabile']}")
        print(f"    (ii) distanza netta : {g['condizione_ii_distanza_netta']}")
        print(f"    VERDETTO: {g['esito']}")
        if atteso:
            print(f"    predizione congelata: {atteso}  ->  "
                  f"{'REGGE' if regge else 'NON REGGE'}")
        else:
            print('    nessuna predizione congelata per questa cella (circuito nuovo)')
        stato['verdetti_emessi'].append(k)
        stato.setdefault('verdetti', []).append(
            {'cella': k, 'anni': anni, 'verdetto': g['esito'], 'D': g['D'],
             'soglia_congelata': soglia, 'predizione': atteso, 'predizione_regge': regge})

    print('\n  Nessun exit-code decide: il verdetto va al tavolo umano (Tommi + Claude).')
    stato['celle'] = nuovo
    json.dump(stato, open(STATO, 'w'), ensure_ascii=False, indent=1)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
