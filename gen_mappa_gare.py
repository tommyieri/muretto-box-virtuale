"""gen_mappa_gare.py — GENERATORE di data/mappa_gare.json: il ponte per l'automazione.

Per ogni gara della stagione (dal calendario) mappa:
    cartella TracingInsights (nome che usa lo scopritore)  ->  {nome_demo, cid, titolo}

Cosi' l'orchestratore automatico, trovata una gara nuova online, sa COME chiamarla in
demo (nome italiano) e quale cid f1db usare — senza input umano.

Derivazione: calendario (nome_demo italiano + circuitId=cid + grandPrixId) unito a
f1db-grands-prix (grandPrixId -> fullName = cartella TI). Due nomi NON coincidono tra f1db
e TracingInsights: stanno in OVERRIDE, l'unica conoscenza-nomi a mano (una volta a stagione).

VERIFICA INTEGRATA: le gare gia' pubblicate devono combaciare col registro (ti, cid); se
no, il generatore SI FERMA (la mappa sbagliata romperebbe l'automazione). Idempotente.
Uso: python3 gen_mappa_gare.py
"""
import io, csv, json, os, sys
import f1db_zip

# Cartelle TracingInsights che NON coincidono col fullName f1db del grand prix.
# (verificato 20/07/2026: TI usa 'Barcelona'/'Mexico City', f1db 'Barcelona-Catalunya'/'Mexican')
OVERRIDE_TI = {
    'barcelona-catalunya': 'Barcelona Grand Prix',  # f1db: 'Barcelona-Catalunya Grand Prix'
    'mexico': 'Mexico City Grand Prix',             # f1db: 'Mexican Grand Prix'
}
DEST = os.path.join('data', 'mappa_gare.json')


def main():
    z = f1db_zip.apri()
    full = {r['id']: r['fullName'] for r in csv.DictReader(
        io.TextIOWrapper(z.open('f1db-grands-prix.csv'), encoding='utf-8'))}
    cal = json.load(open(os.path.join('demo', 'data', 'calendario_2026.json')))['gare']

    mappa = {}
    for ga in cal:
        gpid, nome, cid, titolo = ga['gp'], ga['nome'], ga['circuitId'], ga['titolo']
        ti = OVERRIDE_TI.get(gpid, full.get(gpid))
        if not ti:
            sys.exit(f"BLOCCO: nessuna cartella TI per {nome} (grandPrixId={gpid}). "
                     f"Aggiungere a OVERRIDE_TI.")
        mappa[ti] = dict(nome=nome, cid=cid, titolo=titolo)

    # VERIFICA contro il registro: le pubblicate devono combaciare (ti -> nome, cid)
    reg = json.load(open(os.path.join('data', 'gare_registro.json')))
    errori = []
    for nome, v in reg.items():
        m = mappa.get(v['ti'])
        if not m:
            errori.append(f"{nome}: ti '{v['ti']}' non nella mappa")
        elif m['nome'] != nome or m['cid'] != v['cid']:
            errori.append(f"{nome}: mappa dice {m['nome']}/{m['cid']}, registro {nome}/{v['cid']}")
    if errori:
        sys.exit("BLOCCO: mappa incoerente col registro:\n  " + "\n  ".join(errori))

    json.dump(mappa, open(DEST, 'w'), ensure_ascii=False, indent=1)
    print(f"[scritto] {DEST}: {len(mappa)} gare mappate; {len(reg)} pubblicate coerenti col registro.")


if __name__ == '__main__':
    main()
