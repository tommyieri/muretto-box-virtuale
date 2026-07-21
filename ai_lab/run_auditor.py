#!/usr/bin/env python3
"""run_auditor.py — lancia l'Auditor Agent su una gara storica.

    python3 ai_lab/run_auditor.py --race "Belgium 2026"
    python3 ai_lab/run_auditor.py --race Monaco --no-llm
    python3 ai_lab/run_auditor.py --list
    python3 ai_lab/run_auditor.py --race Spa --json      # solo i numeri, nessun dossier

Sola lettura sul motore e sui dati. Scrive unicamente dentro ai_lab/.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from auditor import agent, tools


def main():
    p = argparse.ArgumentParser(
        description="Auditor Agent — trova le differenze tra realta' e simulazione.")
    p.add_argument('--race', '--gara', dest='race',
                   help='gara storica, es. "Belgium 2026", "Spa", "Monaco"')
    p.add_argument('--list', action='store_true', help='elenca le gare disponibili')
    p.add_argument('--no-llm', action='store_true',
                   help='salta Claude: dossier deterministico dai soli numeri')
    p.add_argument('--json', action='store_true',
                   help="stampa l'analisi numerica grezza e esce (nessun dossier)")
    p.add_argument('--model', default=agent.MODELLO_DEFAULT,
                   help=f'modello Claude (default: {agent.MODELLO_DEFAULT})')
    a = p.parse_args()

    if a.list or not a.race:
        print('Gare disponibili:\n')
        for g in tools.elenco_gare():
            print(f"  {g['gara']:16s} {g['fonte']}")
        print(f"\nMotore auditato: {tools.versione_motore()}")
        if not a.race:
            print('\nEsempio:  python3 ai_lab/run_auditor.py --race "Belgium 2026"')
        return 0

    try:
        nome, fonte = tools.risolvi_gara(a.race)
    except ValueError as e:
        print(f'ERRORE: {e}', file=sys.stderr)
        return 2

    if a.json:
        print(json.dumps(tools.analizza_gara(nome), ensure_ascii=False, indent=2))
        return 0

    print(f'Auditor Agent — gara: {nome}')
    print(f'  fonte  : {fonte}')
    print(f'  motore : {tools.versione_motore()} (sola lettura)')
    print('  analisi numerica in corso (Python)...')

    percorso, rec, avviso = agent.genera_dossier(
        nome, usa_llm=not a.no_llm, modello=a.model)

    s = rec['sintesi']
    print(f"  stint analizzati: {s['stint_analizzati']} | residuo mediano: "
          f"{s['residuo_mediano_s']} s | rumore: {s['noise_floor_s']} s")
    print(f"  candidati: {json.dumps(s['conteggi'], ensure_ascii=False)}")
    if avviso:
        print(f'\n  AVVISO: {avviso}\n  -> dossier prodotto in modalita\' DETERMINISTICA '
              f'(numeri completi, interpretazione assente).')
    print(f"\nDossier {rec['id']} [{rec['stato']}] -> {os.path.relpath(percorso)}")
    print(f"Memoria aggiornata          -> ai_lab/memory/index.json")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
