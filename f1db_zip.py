"""f1db_zip.py — accesso condiviso all'archivio CSV di f1db per i generatori UI.

Scarica (una volta) la release CSV pinnata in una cache stabile FUORI dal repo
(~/muretto_shared/f1db_csv/) e offre lettura delle tabelle. Stessa fonte e stessa
release per tutti i generatori: gen_calendario (via --zip), gen_classifiche,
gen_schede, aggiorna_ui. Nessun ricalcolo qui: solo I/O.

ATTENZIONE SCHEMI: f1db usa i SUOI id (es. Austria 2026 = raceId 1157, driverId
'kimi-antonelli') — mai mescolare con schemi esterni (Ergast ecc.).
"""
import csv, io, os, urllib.request, zipfile

RELEASE = 'v2026.9.1'
CACHE_DIR = os.path.expanduser('~/muretto_shared/f1db_csv')


def percorso_zip(release=RELEASE):
    return os.path.join(CACHE_DIR, f'f1db-csv-{release}.zip')


def apri(release=RELEASE, zip_path=None):
    """ZipFile della release CSV: da percorso esplicito, dalla cache, o scaricando."""
    if zip_path:
        return zipfile.ZipFile(zip_path)
    dest = percorso_zip(release)
    if not os.path.exists(dest):
        os.makedirs(CACHE_DIR, exist_ok=True)
        url = f'https://github.com/f1db/f1db/releases/download/{release}/f1db-csv.zip'
        print(f'scarico {url} -> {dest}')
        urllib.request.urlretrieve(url, dest + '.tmp')
        os.replace(dest + '.tmp', dest)
    return zipfile.ZipFile(dest)


def tabella(zf, nome):
    """Righe (dict) di una tabella, es. tabella(zf, 'races-driver-standings')."""
    with zf.open(f'f1db-{nome}.csv') as f:
        return list(csv.DictReader(io.TextIOWrapper(f, encoding='utf-8')))
