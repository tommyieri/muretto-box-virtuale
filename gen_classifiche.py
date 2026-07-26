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

CODA PROVVISORIA (dal 26/07/2026, decisione PO). La regola qui sopra resta intera: i punti
della stagione NON si ricalcolano. Cambia solo cosa si fa con le gare che f1db non copre
ANCORA — prima si aspettava la release (cinque giorni, dopo il Belgio), lasciando il sito
con il risultato della gara e la classifica della gara prima. Ora alla base canonica si
SOMMANO quelle poche gare, dalla classifica ufficiale FastF1, via punti_provvisori.py.
La coda sparisce da sola quando la release avanza. Il meccanismo e' misurato, non
argomentato: test_classifiche_provvisorie.py rifa la stagione round per round e la
confronta con gli standings f1db (9/9 al 26/07/2026, zero divergenze).

Uso: python3 gen_classifiche.py [--zip f1db-csv.zip] [--release vX] [--solo-f1db]
"""
import argparse, json, os, sys
import f1db_zip
import punti_provvisori

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


def countback(righe_gara, chiave):
    """id -> tupla di countback: (-numero di P1, -numero di P2, ...).

    E' il criterio F1 per i pari punti: vince chi ha piu' primi posti, poi piu' secondi, e
    cosi' via. Serve solo quando c'e' una coda provvisoria — senza, l'ordine e' quello che
    f1db ha gia' deciso (positionDisplayOrder) e non lo si tocca.
    """
    conte = {}
    for r in righe_gara:
        if r['positionNumber']:
            c = conte.setdefault(r[chiave], [0] * 25)
            p = int(r['positionNumber'])
            if p <= 25:
                c[p - 1] += 1
    return {k: tuple(-n for n in v) for k, v in conte.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--zip'); ap.add_argument('--release', default=f1db_zip.RELEASE)
    ap.add_argument('--solo-f1db', action='store_true',
                    help='niente coda provvisoria: solo gli standings canonici')
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

    # ---------------------------------------------------------------- coda provvisoria
    ext = None
    if not args.solo_f1db:
        registro = json.load(open(os.path.join('data', 'gare_registro.json')))
        try:
            ext = punti_provvisori.calcola(zf, f1db_zip, team_demo, ultimo_round, registro)
        except punti_provvisori.ProvvisorioImpossibile as e:
            # NON e' un errore fatale: si pubblica la sola base canonica, ma lo si grida.
            print(f'ATTENZIONE: coda provvisoria NON applicata — {e}')
    if ext:
        for did, n in ext['vittorie_pilota'].items():
            vitt_pil[did] = vitt_pil.get(did, 0) + n
        for cid, n in ext['vittorie_costruttore'].items():
            vitt_cos[cid] = vitt_cos.get(cid, 0) + n
        for r in sorted(ext['righe_risultati'], key=lambda r: int(r['round'])):
            ultimo_team[r['driverId']] = r['constructorId']
    tutte_le_righe = rr + (ext['righe_risultati'] if ext else [])
    cb_pil = countback(tutte_le_righe, 'driverId') if ext else {}
    cb_cos = countback(tutte_le_righe, 'constructorId') if ext else {}

    def _riordina(out, cb):
        """Riordina per punti (poi countback) e riscrive pos/distacco. Solo con la coda:
        senza, l'ordine canonico di f1db resta intatto bit per bit."""
        vuoto = tuple([0] * 25)
        out.sort(key=lambda v: (-v['punti'], cb.get(v['id'], vuoto)))
        leader = out[0]['punti'] if out else 0
        for i, v in enumerate(out):
            v['pos'] = i + 1
            v['distacco'] = round(leader - v['punti'], 1)
        return out

    def righe_piloti():
        righe = [r for r in ds if int(r['raceId']) == ultimo_race_id]
        leader = max(float(r['points']) for r in righe)
        out = []
        for r in sorted(righe, key=lambda r: int(r['positionDisplayOrder'])):
            d = drivers[r['driverId']]
            did = r['driverId']
            cid = ultimo_team.get(did)
            punti = float(r['points']) + (ext['punti_pilota'].get(did, 0) if ext else 0)
            out.append({'pos': int(r['positionNumber']) if r['positionNumber'] else None,
                        'id': did, 'sigla': d['abbreviation'], 'nome': d['name'],
                        'punti': punti, 'vittorie': vitt_pil.get(did, 0),
                        'distacco': round(leader - float(r['points']), 1),
                        'constructorId': cid, 'team_demo': team_demo.get(cid)})
        return _riordina(out, cb_pil) if ext else out

    def righe_costruttori():
        righe = [r for r in cs if int(r['raceId']) == ultimo_race_id]
        leader = max(float(r['points']) for r in righe)
        out = []
        for r in sorted(righe, key=lambda r: int(r['positionDisplayOrder'])):
            c = constructors[r['constructorId']]
            cid = r['constructorId']
            punti = float(r['points']) + (ext['punti_costruttore'].get(cid, 0) if ext else 0)
            out.append({'pos': int(r['positionNumber']) if r['positionNumber'] else None,
                        'id': cid, 'nome': c['name'],
                        'punti': punti, 'vittorie': vitt_cos.get(cid, 0),
                        'distacco': round(leader - float(r['points']), 1),
                        'team_demo': team_demo.get(cid)})
        return _riordina(out, cb_cos) if ext else out

    # aggiornato_al: nome/titolo dal calendario gia' generato (stessa fonte f1db).
    # Con la coda provvisoria punta alla gara NUOVA — e' quella a cui la classifica e'
    # davvero aggiornata — e porta con se' `provvisorio`, cosi' la UI puo' dirlo e nessuno
    # scambia una coda in attesa di f1db per un dato canonico.
    canonico = {'round': ultimo_round, 'raceId_f1db': ultimo_race_id}
    try:
        cal = json.load(open(os.path.join('demo', 'data', 'calendario_2026.json')))
        g = next(g for g in cal['gare'] if g['round'] == ultimo_round)
        canonico.update({'nome': g['nome'], 'titolo': g['titolo'], 'data': g['data'],
                         'gara_demo': g['gara_demo']})
    except Exception:
        cal = None
    agg = dict(canonico)
    if ext:
        agg['provvisorio'] = {'da_round': ultimo_round + 1,
                              'gare': [d['gara'] for d in ext['gare']],
                              'fonte': 'classifica ufficiale FastF1 (demo/data/ufficiali_2026.json)',
                              'canonico_f1db': canonico}
        agg['round'] = ext['ultimo_round']
        agg.pop('raceId_f1db', None)
        try:
            g = next(g for g in cal['gare'] if g['round'] == ext['ultimo_round'])
            agg.update({'nome': g['nome'], 'titolo': g['titolo'], 'data': g['data'],
                        'gara_demo': g['gara_demo']})
        except Exception:
            agg.update({'nome': ext['ultima_gara'], 'titolo': ext['ultima_gara']})

    out = {
        '_nota': (f'GENERATO da gen_classifiche.py (f1db {args.release}, standings canonici '
                  'al round indicato in aggiornato_al). Non modificare a mano.'
                  + (' ' + punti_provvisori.nota(ext) if ext else '')),
        'aggiornato_al': agg,
        'piloti': righe_piloti(),
        'costruttori': righe_costruttori(),
    }
    dest = os.path.join('demo', 'data', 'classifiche_2026.json')
    with open(dest, 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1); f.write('\n')
    print(f'scritto {dest}: {len(out["piloti"])} piloti, {len(out["costruttori"])} costruttori, '
          f'aggiornato al round {agg["round"]} ({agg.get("titolo", "?")})'
          + (f' — PROVVISORIO: f1db si ferma al round {ultimo_round}, '
             f'sommata/e {", ".join(d["gara"] for d in ext["gare"])}' if ext else ''))


if __name__ == '__main__':
    main()
