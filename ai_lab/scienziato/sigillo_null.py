#!/usr/bin/env python3
"""sigillo_null.py — ZONA A CONTATTO UMANO OBBLIGATO.

    python3 ai_lab/scienziato/sigillo_null.py            # verifica il sigillo
    python3 ai_lab/scienziato/sigillo_null.py --sigilla  # deposita il sigillo (solo col tavolo)

LA REGOLA (cablata il 21/07/2026, decisione del tavolo)
  Il permutation-null e' zona a contatto umano obbligato. QUALUNQUE modifica ad esso —
  anche di puro determinismo: seme, ordinamento, tipo di hash — si FERMA e si dichiara
  PRIMA, e la autorizza il tavolo.

  Niente piu' auto-giudizio "questa e' determinismo, non metodo": quella distinzione
  NON la fa l'agente. E' gia' successo tre volte (aggregazione del null sbagliata di
  scala; hash salato per processo; e prima ancora la scala del null per-gara). Da qui in
  avanti: contatto umano sempre.

COME E' CABLATA
  Il sigillo e' lo sha256 del CODICE SORGENTE delle funzioni del null. Ogni generatore lo
  verifica prima di produrre un numero. Se il sorgente e' cambiato, il sigillo si rompe e
  il generatore NON produce numeri: stampa la richiesta di autorizzazione e si ferma.

  Non e' un giudice: non uccide niente e non decide se un'ipotesi vive. Impedisce solo
  che una modifica al null passi inosservata. Esce sempre 0.

COPERTURA (dichiarata)
  Le funzioni del null vero e proprio, piu' quelle che il null CHIAMA (modificarle
  cambierebbe il null di riflesso) e il ricampionamento a blocchi, che e' lo stesso
  genere di strumento. cosa_so_fare e' sigillata intera perche' l'aggregazione del null
  vive dentro di lei: un'edizione non correlata rompera' il sigillo: e' voluto, costringe
  a guardare.
"""
import argparse
import hashlib
import inspect
import json
import os
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)

SIGILLO = os.path.join(QUI, 'sigillo_null.json')

# (modulo, attributo, perche' e' zona protetta)
ZONE = [
    ('fenomeno_fuel', 'FenomenoFuel.null',
     'il null di permutazione degli offset di stint'),
    ('scheletro', 'cosa_so_fare',
     'aggrega il null sulla stessa statistica dell osservato'),
    ('scheletro', 'bootstrap_a_blocchi',
     'ricampionamento a blocchi: stesso genere di strumento'),
    ('percircuito', 'null_etichette',
     'null con le etichette di circuito rimescolate'),
    ('percircuito', 'leave_one_year_out',
     'chiamata DENTRO il null: modificarla cambia il null'),
    ('metro2', 'soglia_da_nulla',
     'deriva la soglia del metro dalla nulla'),
    ('traffico', 'placebo_leader',
     'placebo col leader a caso: smonta il confondimento del passo di chi segue'),
    ('pista', 'permuta_piste',
     'null per permutazione delle etichette-pista'),
]


def _oggetto(modulo, attributo):
    m = __import__(modulo)
    ob = m
    for pezzo in attributo.split('.'):
        ob = getattr(ob, pezzo)
    return ob


def impronte():
    out = {}
    for modulo, attributo, perche in ZONE:
        src = inspect.getsource(_oggetto(modulo, attributo))
        out[f'{modulo}.{attributo}'] = {
            'sha256': hashlib.sha256(src.encode()).hexdigest()[:16],
            'perche': perche}
    return out


def verifica():
    if not os.path.exists(SIGILLO):
        return {'integro': False, 'motivo': 'sigillo mai depositato', 'rotte': []}
    dep = json.load(open(SIGILLO))['zone']
    ora = impronte()
    rotte = [k for k in ora if k not in dep or dep[k]['sha256'] != ora[k]['sha256']]
    sparite = [k for k in dep if k not in ora]
    return {'integro': not rotte and not sparite, 'rotte': rotte, 'sparite': sparite,
            'depositato': dep, 'ricalcolato': ora,
            'motivo': None if not (rotte or sparite) else 'sorgente del null modificato'}


def pretendi_integro(nome_generatore):
    """Da chiamare all'inizio di ogni generatore. True = si puo' procedere."""
    v = verifica()
    if v['integro']:
        return True
    print('=' * 92)
    print('SIGILLO DEL NULL ROTTO — ZONA A CONTATTO UMANO OBBLIGATO')
    print('=' * 92)
    print(f'  generatore fermato: {nome_generatore}')
    print(f'  motivo: {v["motivo"]}')
    for k in v['rotte']:
        print(f'    modificata: {k}   ({v["ricalcolato"][k]["perche"]})')
    for k in v.get('sparite', []):
        print(f'    sparita:    {k}')
    print('\n  Il permutation-null e\' stato toccato. NON produco numeri.')
    print('  Anche se la modifica sembra di puro determinismo (seme, ordinamento, hash):')
    print('  quella distinzione non la fa l\'agente. Serve l\'autorizzazione del tavolo.')
    print('\n  Per autorizzare, dopo aver guardato il diff:')
    print('    python3 ai_lab/scienziato/sigillo_null.py --sigilla --attore "Tommi" '
          '--nota "..."')
    return False


def main():
    p = argparse.ArgumentParser(description='Sigillo della zona null.')
    p.add_argument('--sigilla', action='store_true')
    p.add_argument('--attore', default=None)
    p.add_argument('--nota', default=None)
    p.add_argument('--data', default=None, help='AAAA-MM-GG (nessun orologio implicito)')
    a = p.parse_args()

    if a.sigilla:
        if not a.attore:
            print('Serve --attore: un sigillo senza un umano che lo depone non vale niente.')
            return 0
        prec = json.load(open(SIGILLO)) if os.path.exists(SIGILLO) else {'storia': []}
        nuovo = {'zone': impronte(),
                 'storia': prec.get('storia', []) + [
                     {'attore': a.attore, 'nota': a.nota, 'data': a.data,
                      'zone': {k: v['sha256'] for k, v in impronte().items()}}]}
        with open(SIGILLO, 'w') as f:
            json.dump(nuovo, f, ensure_ascii=False, indent=1)
            f.write('\n')
        print(f'Sigillo depositato da {a.attore}. Zone coperte: {len(nuovo["zone"])}.')
        return 0

    v = verifica()
    print('=' * 92)
    print('SIGILLO DEL NULL — zona a contatto umano obbligato')
    print('=' * 92)
    print(f"  stato: {'INTEGRO' if v['integro'] else 'ROTTO'}"
          + ('' if v['integro'] else f"  ({v['motivo']})"))
    for k, x in sorted(v['ricalcolato'].items()):
        segno = 'ok' if k not in v['rotte'] else 'MODIFICATA'
        print(f"    {segno:10s} {k:40s} {x['sha256']}  — {x['perche']}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
