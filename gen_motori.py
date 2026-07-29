"""gen_motori.py — motorizzazioni della stagione 2026 per la demo UI.

Consumatore puro di f1db (release pinnata via f1db_zip): joina
seasons-entrants-constructors x seasons-entrants-engines x engine-manufacturers
per l'anno 2026 e scrive demo/data/motori_2026.json:

    { "<constructorId>": { "motore": "<nome>", "engineManufacturerId": "<id>" }, ... }

Nessuna mappa a mano: se f1db cambia (motorizzazioni, team), rilanciare basta.
Uso:  python3 gen_motori.py [--zip percorso.zip]
"""
import argparse, csv, io, json, os, sys

import f1db_zip

ANNO = '2026'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'demo', 'data', f'motori_{ANNO}.json')


def leggi(z, nome):
    with z.open(nome) as f:
        return list(csv.DictReader(io.TextIOWrapper(f, encoding='utf-8')))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--zip', dest='zip_path', default=None)
    args = ap.parse_args()

    z = f1db_zip.apri(zip_path=args.zip_path)
    cons = {r['entrantId']: r['constructorId']
            for r in leggi(z, 'f1db-seasons-entrants-constructors.csv') if r['year'] == ANNO}
    eng = {r['entrantId']: r['engineManufacturerId']
           for r in leggi(z, 'f1db-seasons-entrants-engines.csv') if r['year'] == ANNO}
    nomi = {r['id']: r['name'] for r in leggi(z, 'f1db-engine-manufacturers.csv')}

    out = {}
    for entrant, cid in sorted(cons.items()):
        emid = eng.get(entrant)
        if not emid:
            print(f'ATTENZIONE: nessun motore f1db per entrant {entrant} ({cid}) — salto', file=sys.stderr)
            continue
        out[cid] = {'motore': nomi.get(emid, emid), 'engineManufacturerId': emid}

    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f'{OUT}: {len(out)} costruttori')
    for cid, v in out.items():
        print(f"  {cid:14s} -> {v['motore']}")


if __name__ == '__main__':
    main()
