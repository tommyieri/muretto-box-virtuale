"""gen_calendario.py — GENERATORE di data/calendario_2026.json (+ copia demo/data/).

Fonte: f1db (https://github.com/f1db/f1db), release CSV, tabella races della stagione 2026
— il calendario NON e' scritto a mano (fonte-orfana vietata). Il generatore:
  1. scarica (o legge da --zip) l'archivio f1db-csv.zip della release indicata;
  2. estrae le gare 2026 (round, data, grandPrixId, circuitId, giri) e il nome circuito;
  3. aggancia le gare gia' in demo via data/gare_registro.json (cid == circuitId f1db);
  4. per le gare in demo calcola il VINCITORE dai dati gara gia' pubblicati
     (demo/data/<gara>.json: min cum_time all'ultimo giro) — nessun dato inventato;
  5. scrive data/calendario_2026.json e la copia demo/data/calendario_2026.json
     (la UI legge solo demo/data/*).

I nomi italiani (nome breve + titolo "GP di ...") sono una TABELLA DI PRESENTAZIONE
keyed sui grandPrixId f1db: la sostanza (date, round, giri, circuiti) resta f1db.
Collisione dichiarata: nel 2026 f1db ha DUE GP spagnoli — barcelona-catalunya (round 7,
la "Spagna" della demo) e spain (round 14, Madring): il secondo e' presentato come "Madrid".

Uso:  python3 gen_calendario.py [--zip f1db-csv.zip] [--release v2026.9.1]
"""
import argparse, csv, io, json, os, sys, tempfile, urllib.request, zipfile

RELEASE_DEFAULT = 'v2026.9.1'
STAGIONE = 2026

# presentazione italiana: grandPrixId f1db -> (nome breve, titolo)
NOMI_IT = {
    'australia':           ('Australia',     "GP d'Australia"),
    'china':               ('Cina',          'GP di Cina'),
    'japan':               ('Giappone',      'GP del Giappone'),
    'miami':               ('Miami',         'GP di Miami'),
    'canada':              ('Canada',        'GP del Canada'),
    'monaco':              ('Monaco',        'GP di Monaco'),
    'barcelona-catalunya': ('Spagna',        'GP di Spagna — Barcellona'),
    'austria':             ('Austria',       "GP d'Austria"),
    'great-britain':       ('Gran Bretagna', 'GP di Gran Bretagna'),
    'belgium':             ('Belgio',        'GP del Belgio'),
    'hungary':             ('Ungheria',      "GP d'Ungheria"),
    'netherlands':         ('Olanda',        "GP d'Olanda"),
    'italy':               ('Italia',        "GP d'Italia"),
    'spain':               ('Madrid',        'GP di Madrid'),
    'azerbaijan':          ('Azerbaigian',   "GP dell'Azerbaigian"),
    'singapore':           ('Singapore',     'GP di Singapore'),
    'united-states':       ('Stati Uniti',   'GP degli Stati Uniti'),
    'mexico':              ('Messico',       'GP del Messico'),
    'sao-paulo':           ('San Paolo',     'GP di San Paolo'),
    'las-vegas':           ('Las Vegas',     'GP di Las Vegas'),
    'qatar':               ('Qatar',         'GP del Qatar'),
    'abu-dhabi':           ('Abu Dhabi',     'GP di Abu Dhabi'),
}


def leggi_zip(args):
    if args.zip:
        return zipfile.ZipFile(args.zip)
    url = f'https://github.com/f1db/f1db/releases/download/{args.release}/f1db-csv.zip'
    print(f'scarico {url} ...')
    tmp = os.path.join(tempfile.gettempdir(), f'f1db-csv-{args.release}.zip')
    if not os.path.exists(tmp):
        urllib.request.urlretrieve(url, tmp)
    return zipfile.ZipFile(tmp)


def csv_da_zip(zf, nome):
    with zf.open(nome) as f:
        return list(csv.DictReader(io.TextIOWrapper(f, encoding='utf-8')))


def vincitore_da_demo(gara):
    """Vincitore = min cum_time all'ultimo giro dei dati gara pubblicati (ground truth demo)."""
    path = os.path.join('demo', 'data', f'{gara}.json')
    if not os.path.exists(path):
        return None
    with open(path) as f:
        d = json.load(f)
    ultimo = next((lp for lp in d['laps'] if lp['lap'] == d['n_laps']), None)
    if not ultimo:
        return None
    ok = [(c['cum_time'], drv, c.get('team', '')) for drv, c in ultimo['cars'].items()
          if isinstance(c.get('cum_time'), (int, float))]
    if not ok:
        return None
    _, sigla, team = min(ok)
    return {'sigla': sigla, 'team': team}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--zip', help='archivio f1db-csv.zip locale (evita il download)')
    ap.add_argument('--release', default=RELEASE_DEFAULT)
    args = ap.parse_args()

    zf = leggi_zip(args)
    races = [r for r in csv_da_zip(zf, 'f1db-races.csv') if r['year'] == str(STAGIONE)]
    races.sort(key=lambda r: int(r['round']))
    circuiti = {r['id']: r['fullName'] for r in csv_da_zip(zf, 'f1db-circuits.csv')}
    with open(os.path.join('data', 'gare_registro.json')) as f:
        registro = json.load(f)
    demo_per_cid = {v['cid']: nome for nome, v in registro.items()}

    # sessioni del weekend: date/orari UTC come esposti da f1db (campi *Date/*Time);
    # orario assente -> None, la UI mostra solo la data: MAI orari inventati
    SESSIONI = [('fp1', 'freePractice1'), ('fp2', 'freePractice2'), ('fp3', 'freePractice3'),
                ('fp4', 'freePractice4'), ('sprint_quali', 'sprintQualifying'),
                ('sprint', 'sprintRace'), ('qualifiche', 'qualifying')]

    def sessioni_di(r):
        out = {}
        for chiave, pref in SESSIONI:
            if r.get(f'{pref}Date'):
                out[chiave] = {'data': r[f'{pref}Date'], 'ora_utc': r[f'{pref}Time'] or None}
        out['gara'] = {'data': r['date'], 'ora_utc': r['time'] or None}
        return out

    gare = []
    for r in races:
        gp, cid = r['grandPrixId'], r['circuitId']
        nome, titolo = NOMI_IT.get(gp, (r['officialName'], r['officialName']))
        gara_demo = demo_per_cid.get(cid)
        if gara_demo:
            nome = gara_demo  # il nome breve coincide con la chiave demo (link diretto)
        gare.append({
            'round': int(r['round']), 'data': r['date'], 'gp': gp, 'circuitId': cid,
            'nome': nome, 'titolo': titolo, 'circuito': circuiti.get(cid, cid),
            'giri': int(r['laps']) if r['laps'] else None,
            'sessioni': sessioni_di(r),
            'gara_demo': gara_demo, 'vincitore': vincitore_da_demo(gara_demo) if gara_demo else None,
        })

    out = {
        '_nota': (f'GENERATO da gen_calendario.py (f1db {args.release}, races {STAGIONE}). '
                  'Non modificare a mano: rilanciare il generatore.'),
        'stagione': STAGIONE,
        'gare': gare,
    }
    for dest in (os.path.join('data', 'calendario_2026.json'),
                 os.path.join('demo', 'data', 'calendario_2026.json')):
        with open(dest, 'w') as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
            f.write('\n')
        print('scritto', dest)
    print(f'{len(gare)} gare, {sum(1 for g in gare if g["gara_demo"])} in demo')


if __name__ == '__main__':
    main()
