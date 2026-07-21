#!/usr/bin/env python3
"""run_extractor.py — Knowledge Extractor: dai dossier alla mappa della conoscenza.

    python3 ai_lab/run_extractor.py                    # rilegge tutti i dossier
    python3 ai_lab/run_extractor.py --dossier AUD-...  # solo alcuni
    python3 ai_lab/run_extractor.py --mappa            # stampa la mappa a schermo
    python3 ai_lab/run_extractor.py --fenomeni         # solo il quadro dei fenomeni

Deterministico, nessun LLM. Scrive unicamente in ai_lab/knowledge/.
I dossier originali non vengono mai toccati.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from extractor import extractor


def main():
    p = argparse.ArgumentParser(description='Knowledge Extractor del Muretto AI Lab.')
    p.add_argument('--dossier', nargs='*', help='limita a questi ID di dossier')
    p.add_argument('--mappa', action='store_true', help='stampa la mappa markdown e esce')
    p.add_argument('--fenomeni', action='store_true', help='stampa solo i fenomeni')
    a = p.parse_args()

    c = extractor.estrai(solo_dossier=set(a.dossier) if a.dossier else None)

    if a.mappa:
        print(extractor.mappa_markdown(c))
        return 0

    cop = c['copertura']
    print('Knowledge Extractor — estrazione deterministica (nessun LLM)')
    print(f"  dossier letti   : {cop['dossier_letti']}")
    for s in cop['dossier_saltati']:
        print(f"    ! saltato {s['dossier_id']}: {s['motivo']}")
    print(f"  osservazioni    : {cop['osservazioni']}")
    print(f"  fenomeni        : {cop['fenomeni']}")
    print(f"  collegamenti    : {cop['collegamenti']}")
    print(f"  ipotesi raccolte: {cop['ipotesi']}")
    if not cop['motore_omogeneo']:
        print(f"  ATTENZIONE: versioni motore diverse {cop['versioni_motore']} "
              f"-> osservazioni non confrontabili")

    if a.fenomeni or True:
        print('\n  fenomeni (confidenza = replicazione su circuiti diversi):')
        for f in c['fenomeni']:
            eff = '   —  ' if f['effetto_mediano_s_giro'] is None else f"{f['effetto_mediano_s_giro']:+6.3f}"
            print(f"    {f['confidenza']['livello']:8s} {f['id']:28s} {eff} s/giro"
                  f"  circuiti={','.join(f['circuiti'])}")

    store, mappa = extractor.salva(c)
    print(f"\nConoscenza -> {os.path.relpath(store)}")
    print(f"Mappa      -> {os.path.relpath(mappa)}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
