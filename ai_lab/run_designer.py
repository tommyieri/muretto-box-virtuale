#!/usr/bin/env python3
"""run_designer.py — Experiment Designer V1: dalla conoscenza al protocollo eseguibile.

    python3 ai_lab/run_designer.py                        # genera i protocolli mancanti
    python3 ai_lab/run_designer.py --dry-run              # mostra cosa farebbe, senza scrivere
    python3 ai_lab/run_designer.py --stato                # ciclo di vita di tutti gli esperimenti
    python3 ai_lab/run_designer.py --approva EXP-0001 --attore "Tommi" --nota "..."
    python3 ai_lab/run_designer.py --respingi EXP-0003 --attore "Tommi" --nota "..."

Non modifica il motore, i coefficienti, i CSV. Non apre PR. Produce solo protocolli.
Approvare e respingere sono atti UMANI: richiedono --attore.
Eseguire e validare spettano all'Experiment Runner, non a questo comando.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from designer import designer


def _stato():
    esist = designer.esperimenti_esistenti()
    if not esist:
        print('Nessun esperimento. Eseguire senza argomenti per generarli.')
        return 0
    print('Ciclo di vita degli esperimenti:\n')
    print(f"  {'ID':10s} {'STATO':10s} {'TIPO':28s} FENOMENO")
    for k, v in esist.items():
        print(f"  {k:10s} {v['stato']:10s} {v['tipo']:28s} {v['fenomeno']}")
    print('\n  CREATO → APPROVATO → ESEGUITO → VALIDATO → GO | NO_GO')
    return 0


def main():
    p = argparse.ArgumentParser(description='Experiment Designer del Muretto AI Lab.')
    p.add_argument('--dry-run', action='store_true', help='mostra cosa farebbe, senza scrivere')
    p.add_argument('--stato', action='store_true', help='elenca gli esperimenti e il loro stato')
    p.add_argument('--fenomeno', nargs='*', help='limita a questi fenomeni')
    p.add_argument('--approva', metavar='EXP', help='approva un esperimento (atto umano)')
    p.add_argument('--respingi', metavar='EXP', help='respinge un esperimento (atto umano)')
    p.add_argument('--attore', help='chi decide: resta scritto nella storia')
    p.add_argument('--nota', default='', help='motivazione della decisione')
    p.add_argument('--verifica', nargs='*', metavar='EXP',
                   help="verifica il sigillo anti-HARKing ('*' o vuoto = tutti)")
    a = p.parse_args()

    if a.verifica is not None:
        esiti = [designer.verifica_sigillo(e) for e in
                 (a.verifica or designer.esperimenti_esistenti())]
        for r in esiti:
            simbolo = 'INTEGRO ' if r['integro'] else 'ALTERATO'
            print(f"  {simbolo} {r['esperimento']}  {r['depositato']}"
                  + ('' if r['integro'] else f"  != ricalcolato {r['ricalcolato']}"))
        return 0 if all(r['integro'] for r in esiti) else 1

    if a.stato:
        return _stato()

    if a.approva or a.respingi:
        exp, nuovo = (a.approva, 'APPROVATO') if a.approva else (a.respingi, 'RESPINTO')
        if not a.attore:
            print('ERRORE: --attore obbligatorio. Chi decide deve restare scritto.',
                  file=sys.stderr)
            return 2
        try:
            s = designer.transizione(exp, nuovo, a.attore, a.nota)
        except ValueError as e:
            print(f'ERRORE: {e}', file=sys.stderr)
            return 2
        print(f"{exp}: {nuovo} (da {s['da']} il {s['quando']})")
        print(f"  prossimi stati ammessi: {', '.join(s['prossimi_stati_ammessi']) or '—'}")
        return 0

    try:
        c = designer.carica_conoscenza()
    except FileNotFoundError as e:
        print(f'ERRORE: {e}', file=sys.stderr)
        return 2

    if a.dry_run:
        print('Experiment Designer — DRY RUN (nessuna scrittura)\n')
        esist = designer.esperimenti_esistenti()
        coperti = {e['fenomeno'] for e in esist.values()}
        for fen in c['fenomeni']:
            oss = [o for o in c['osservazioni'] if o['fenomeno'] == fen['id']]
            if not oss:
                continue
            ok, tipo, info = designer.valuta_eleggibilita(fen, oss)
            if ok and fen['id'] in coperti:
                print(f"  = {fen['id']:30s} gia' coperto")
            elif ok:
                print(f"  + {fen['id']:30s} -> {tipo}")
                print(f"      nasce perche': {info['nasce_perche'][:110]}...")
            else:
                print(f"  - {fen['id']:30s} NON eleggibile: {info['motivo']}")
        return 0

    r = designer.genera(c, solo=set(a.fenomeno) if a.fenomeno else None)

    print('Experiment Designer — generazione protocolli\n')
    if r['creati']:
        print(f"  creati ({len(r['creati'])}):")
        for e in r['creati']:
            print(f"    {e['id']}  {e['tipo']:28s} da {e['fenomeno']}")
            print(f"              -> {e['cartella']}/")
    else:
        print('  nessun protocollo nuovo')
    if r['gia_coperti']:
        print(f"\n  gia' coperti ({len(r['gia_coperti'])}): "
              + ', '.join(f"{g['fenomeno']}→{g['esperimento']}" for g in r['gia_coperti']))
    if r['respinti']:
        print(f"\n  fenomeni NON eleggibili ({len(r['respinti'])}) — il laboratorio non li insegue:")
        for x in r['respinti']:
            print(f"    {x['fenomeno']:30s} [{x['confidenza']:8s}] {x['motivo']}")
    print('\n  Tutti nascono CREATO. L\'approvazione e\' un atto umano:')
    print('    python3 ai_lab/run_designer.py --approva EXP-0001 --attore "<nome>"')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
