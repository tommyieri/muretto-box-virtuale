"""gen_classifiche.py — GENERATORE di demo/data/classifiche_2026.json.

METODO (breve): le classifiche piloti e costruttori vengono dalle tabelle STANDINGS
di f1db (races-driver-standings / races-constructor-standings), che sono la verita'
canonica — i punti NON vengono ricalcolati da regole scritte qui. Si prende l'ultimo
GP 2026 presente negli standings (round massimo, id f1db interno) e le righe a quel
raceId. Aggiunte SOLO da conteggi diretti sulle stesse tabelle f1db:
  - vittorie 2026 = numero di P1 in races-race-results (fino al round incluso);
  - distacco     = punti del leader - punti;
  - team_demo    = nome team come appare nella demo (derivato incrociando la sigla
    f1db del pilota coi team dei nostri JSON gara: nessuna mappa scritta a mano).
Campo OBBLIGATORIO "aggiornato_al": ultimo GP incluso (round, raceId f1db, nome/titolo
dal calendario generato). Deterministico e rieseguibile (stessa release -> stesso file).

Uso: python3 gen_classifiche.py [--zip f1db-csv.zip] [--release vX]
"""
import argparse, json, os, sys
import f1db_zip

ANNO = '2026'


def team_demo_per_costruttore(zf, race_results):
    """constructorId f1db -> nome team della demo, via sigla pilota nei nostri JSON gara."""
    sigla = {d['id']: d['abbreviation'] for d in f1db_zip.tabella(zf, 'drivers')}
    team_di_sigla = {}
    for fn in os.listdir(os.path.join('demo', 'data')):
        if fn.endswith('.json') and not fn.startswith(('pista_', 'calendario', 'classifiche', 'schede', 'foto')):
            try:
                d = json.load(open(os.path.join('demo', 'data', fn)))
            except Exception:
                continue
            if isinstance(d, dict) and 'laps' in d:
                for lp in d['laps']:
                    for s, c in lp['cars'].items():
                        if c.get('team'): team_di_sigla[s] = c['team']
    per_costruttore = {}
    for r in race_results:
        t = team_di_sigla.get(sigla.get(r['driverId'], ''), None)
        if t:
            per_costruttore.setdefault(r['constructorId'], {}).setdefault(t, 0)
            per_costruttore[r['constructorId']][t] += 1
    return {cid: max(conte, key=conte.get) for cid, conte in per_costruttore.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--zip'); ap.add_argument('--release', default=f1db_zip.RELEASE)
    args = ap.parse_args()
    zf = f1db_zip.apri(args.release, args.zip)

    ds = [r for r in f1db_zip.tabella(zf, 'races-driver-standings') if r['year'] == ANNO]
    cs = [r for r in f1db_zip.tabella(zf, 'races-constructor-standings') if r['year'] == ANNO]
    if not ds or not cs:
        sys.exit('STOP: standings f1db assenti per il 2026 — non ricalcolo i punti a mano.')
    ultimo_round = max(int(r['round']) for r in ds)
    ultimo_race_id = next(int(r['raceId']) for r in ds if int(r['round']) == ultimo_round)

    rr = [r for r in f1db_zip.tabella(zf, 'races-race-results')
          if r['year'] == ANNO and int(r['round']) <= ultimo_round]
    vitt_pil, vitt_cos = {}, {}
    for r in rr:
        if r['positionText'] == '1':
            vitt_pil[r['driverId']] = vitt_pil.get(r['driverId'], 0) + 1
            vitt_cos[r['constructorId']] = vitt_cos.get(r['constructorId'], 0) + 1

    drivers = {d['id']: d for d in f1db_zip.tabella(zf, 'drivers')}
    constructors = {c['id']: c for c in f1db_zip.tabella(zf, 'constructors')}
    ultimo_team = {}                      # pilota -> constructorId del suo round piu' recente
    for r in sorted(rr, key=lambda r: int(r['round'])):
        ultimo_team[r['driverId']] = r['constructorId']
    team_demo = team_demo_per_costruttore(zf, rr)

    def righe_piloti():
        righe = [r for r in ds if int(r['raceId']) == ultimo_race_id]
        leader = max(float(r['points']) for r in righe)
        out = []
        for r in sorted(righe, key=lambda r: int(r['positionDisplayOrder'])):
            d = drivers[r['driverId']]
            cid = ultimo_team.get(r['driverId'])
            out.append({'pos': int(r['positionNumber']) if r['positionNumber'] else None,
                        'id': r['driverId'], 'sigla': d['abbreviation'], 'nome': d['name'],
                        'punti': float(r['points']), 'vittorie': vitt_pil.get(r['driverId'], 0),
                        'distacco': round(leader - float(r['points']), 1),
                        'constructorId': cid, 'team_demo': team_demo.get(cid)})
        return out

    def righe_costruttori():
        righe = [r for r in cs if int(r['raceId']) == ultimo_race_id]
        leader = max(float(r['points']) for r in righe)
        out = []
        for r in sorted(righe, key=lambda r: int(r['positionDisplayOrder'])):
            c = constructors[r['constructorId']]
            out.append({'pos': int(r['positionNumber']) if r['positionNumber'] else None,
                        'id': r['constructorId'], 'nome': c['name'],
                        'punti': float(r['points']), 'vittorie': vitt_cos.get(r['constructorId'], 0),
                        'distacco': round(leader - float(r['points']), 1),
                        'team_demo': team_demo.get(r['constructorId'])})
        return out

    # aggiornato_al: nome/titolo dal calendario gia' generato (stessa fonte f1db)
    agg = {'round': ultimo_round, 'raceId_f1db': ultimo_race_id}
    try:
        cal = json.load(open(os.path.join('demo', 'data', 'calendario_2026.json')))
        g = next(g for g in cal['gare'] if g['round'] == ultimo_round)
        agg.update({'nome': g['nome'], 'titolo': g['titolo'], 'data': g['data'],
                    'gara_demo': g['gara_demo']})
    except Exception:
        pass

    out = {
        '_nota': (f'GENERATO da gen_classifiche.py (f1db {args.release}, standings canonici '
                  'al round indicato in aggiornato_al). Non modificare a mano.'),
        'aggiornato_al': agg,
        'piloti': righe_piloti(),
        'costruttori': righe_costruttori(),
    }
    dest = os.path.join('demo', 'data', 'classifiche_2026.json')
    with open(dest, 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1); f.write('\n')
    print(f'scritto {dest}: {len(out["piloti"])} piloti, {len(out["costruttori"])} costruttori, '
          f'aggiornato al round {ultimo_round} ({agg.get("titolo", "?")})')


if __name__ == '__main__':
    main()
