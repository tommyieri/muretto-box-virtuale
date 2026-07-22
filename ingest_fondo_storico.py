#!/usr/bin/env python3
"""ingest_fondo_storico.py — IL FONDO: otto stagioni di grezzo per-giro, in casa.

    python3 ingest_fondo_storico.py --scopri      # elenca le gare per anno (usa l'API, 8 chiamate)
    python3 ingest_fondo_storico.py --stima       # quanto pesa, senza scaricare tutto
    python3 ingest_fondo_storico.py               # scarica cio' che manca (Race + Sprint)
    python3 ingest_fondo_storico.py --sessioni tutte   # aggiunge Practice e Qualifying

PERCHE' ESISTE. Il repo aveva 2023-2025 Race+Sprint: 70 gare. Le stagioni 2018-2025 sono
tutte online, complete di Practice e Qualifying, con le stesse 42 colonne — comprese quelle
che nessuno ha mai caricato (wTT temperatura asfalto, wR pioggia). Senza mirror in casa il
fondo dipende dalla sopravvivenza di due organizzazioni GitHub di terzi.

LA ROTTA. `TracingInsights/{anno}` serve il file CONSOLIDATO session_laptimes.json (uno per
sessione). `TracingInsights-Archive/{anno}` ha lo stesso dato spezzato per pilota, e per la
maggior parte degli anni NON ha il consolidato: verificato, Archive/2018 e Archive/2021
rispondono 404 sul consolidato mentre TracingInsights/2018 e /2021 rispondono 200. La via
consolidata e' un file invece di venti, quindi si usa quella e si tiene l'altra come ripiego.

MAI I FILE DI TELEMETRIA. Nelle cartelle per-pilota ci sono i *_tel.json: pesano cento volte
tanto e non servono a nessuna delle domande del prodotto. Questo script non li tocca.

FORMATO IN CASA. data/fondo/{anno}/{Gara}/{Sessione}.json.gz — gzip DETERMINISTICO (mtime a
zero), cosi' rieseguire non produce un diff. Il grezzo si committa; qualunque cosa se ne
derivi NON si committa, perche' un derivato committato diventa in tre mesi il prossimo file
che nessuno sa piu' rifare.

RIESEGUIBILE: salta cio' che c'e' gia'. La scoperta e' messa in cache (data/fondo/_gare.json)
perche' l'API di GitHub concede 60 chiamate all'ora e non vanno sprecate.
"""
import argparse
import gzip
import json
import os
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
FONDO = os.path.join(ROOT, 'data', 'fondo')
CACHE_GARE = os.path.join(FONDO, '_gare.json')

ANNI = [str(a) for a in range(2018, 2026)]
BASE_RAW = 'https://raw.githubusercontent.com/TracingInsights/{anno}/main/{gara}/{sess}/session_laptimes.json'
BASE_API = 'https://api.github.com/repos/TracingInsights/{anno}/contents/'

SESSIONI_CORE = ('Race', 'Sprint')
SESSIONI_TUTTE = ('Race', 'Sprint', 'Qualifying', 'Practice 1', 'Practice 2', 'Practice 3')

# 42 colonne attese: se una sessione ne porta meno e' un dato mutilato, non un dato nuovo.
# Monaco 2019 e' il caso noto (3 colonne): entra nel fondo comunque, ma MARCATO.
COLONNE_PIENE = 42
CHIAVE = ('lap', 'time', 'compound', 'life', 'stint', 'pin', 'pout', 'status', 'drv')


def _get(url, timeout=45):
    req = urllib.request.Request(url, headers={'User-Agent': 'muretto-fondo'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read()
    except Exception:
        return None


def scopri(usa_cache=True):
    """{anno: [nomi cartella gara]}. Una chiamata API per anno, messa in cache."""
    if usa_cache and os.path.exists(CACHE_GARE):
        with open(CACHE_GARE) as f:
            return json.load(f)
    out = {}
    for a in ANNI:
        raw = _get(BASE_API.format(anno=a))
        if raw is None:
            print(f'  {a}: API non raggiungibile', flush=True)
            out[a] = []
            continue
        try:
            voci = json.loads(raw)
        except Exception:
            print(f'  {a}: risposta non JSON (limite API?)', flush=True)
            out[a] = []
            continue
        if isinstance(voci, dict):
            print(f'  {a}: {voci.get("message")}', flush=True)
            out[a] = []
            continue
        gare = sorted(v['name'] for v in voci
                      if v.get('type') == 'dir' and not v['name'].startswith('.'))
        out[a] = gare
        print(f'  {a}: {len(gare)} gare', flush=True)
        time.sleep(1)
    os.makedirs(FONDO, exist_ok=True)
    with open(CACHE_GARE, 'w') as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    return out


def percorso(anno, gara, sess):
    return os.path.join(FONDO, anno, gara, sess + '.json.gz')


def scrivi_gz(path, dati_bytes):
    """gzip deterministico: mtime a zero, cosi' due esecuzioni danno lo stesso file."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        with gzip.GzipFile(fileobj=f, mode='wb', mtime=0, compresslevel=9) as gz:
            gz.write(dati_bytes)


def leggi_gz(path):
    with gzip.open(path, 'rb') as f:
        return json.loads(f.read())


def valuta(dati):
    """(n_colonne, n_righe, pieno). Non giudica: descrive."""
    if not isinstance(dati, dict) or 'lap' not in dati:
        return 0, 0, False
    n = len(dati['lap'])
    c = len(dati)
    pieno = all(k in dati for k in CHIAVE)
    return c, n, pieno


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--scopri', action='store_true', help='rifa la scoperta (consuma API)')
    p.add_argument('--stima', action='store_true', help='misura su un campione e stima il totale')
    p.add_argument('--sessioni', choices=('core', 'tutte'), default='core')
    p.add_argument('--anni', default=None, help='es. 2018,2019 (default: tutti)')
    a = p.parse_args()

    gare = scopri(usa_cache=not a.scopri)
    anni = a.anni.split(',') if a.anni else ANNI
    sess = SESSIONI_TUTTE if a.sessioni == 'tutte' else SESSIONI_CORE

    if a.stima:
        print('\nSTIMA su un campione (una Race per anno):')
        tot_raw = tot_gz = n = 0
        for y in anni:
            g = gare.get(y) or []
            if not g:
                continue
            campione = next((x for x in g if 'Italian' in x or 'Spanish' in x), g[0])
            raw = _get(BASE_RAW.format(anno=y, gara=urllib.parse.quote(campione), sess='Race'))
            if raw is None:
                print(f'  {y} {campione}: assente')
                continue
            import io
            buf = io.BytesIO()
            with gzip.GzipFile(fileobj=buf, mode='wb', mtime=0, compresslevel=9) as gz:
                gz.write(raw)
            tot_raw += len(raw); tot_gz += buf.tell(); n += 1
            print(f'  {y} {campione[:28]:30} {len(raw)/1024:6.0f} KB -> {buf.tell()/1024:5.0f} KB gz')
        if n:
            sess_tot = sum(len(gare.get(y) or []) for y in anni) * len(sess)
            print(f'\n  media per sessione: {tot_raw/n/1024:.0f} KB -> {tot_gz/n/1024:.0f} KB compressa')
            print(f'  sessioni da provare: ~{sess_tot}  (non tutte esistono)')
            print(f'  STIMA TOTALE COMPRESSO: ~{sess_tot*tot_gz/n/1e6:.0f} MB')
        return 0

    print(f'\nFONDO STORICO — anni {anni[0]}..{anni[-1]}, sessioni {list(sess)}')
    nuovi = saltati = assenti = mutilati = 0
    byte_tot = 0
    per_anno = {}
    for y in anni:
        g = gare.get(y) or []
        if not g:
            print(f'{y}: nessuna gara nota (lancia --scopri)')
            continue
        cnt = 0
        for gara in g:
            for s in sess:
                dst = percorso(y, gara, s)
                if os.path.exists(dst) and os.path.getsize(dst) > 500:
                    saltati += 1; cnt += 1
                    byte_tot += os.path.getsize(dst)
                    continue
                raw = _get(BASE_RAW.format(anno=y, gara=urllib.parse.quote(gara),
                                           sess=urllib.parse.quote(s)))
                if raw is None:
                    assenti += 1
                    continue
                try:
                    d = json.loads(raw)
                except Exception:
                    assenti += 1
                    continue
                nc, nr, pieno = valuta(d)
                if nr == 0:
                    assenti += 1
                    continue
                if not pieno:
                    mutilati += 1
                    print(f'  ⚠ {y}/{gara}/{s}: solo {nc} colonne — entra MARCATO, non e un dato nuovo')
                scrivi_gz(dst, raw)
                byte_tot += os.path.getsize(dst)
                nuovi += 1; cnt += 1
        per_anno[y] = cnt
        print(f'  {y}: {cnt} sessioni in casa')
    print(f'\n  nuove {nuovi} · gia presenti {saltati} · assenti online {assenti} · mutilate {mutilati}')
    print(f'  peso in casa: {byte_tot/1e6:.1f} MB compressi')
    return 0


if __name__ == '__main__':
    sys.exit(main())
