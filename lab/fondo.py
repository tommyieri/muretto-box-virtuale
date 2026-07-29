#!/usr/bin/env python3
"""fondo.py — LA PORTA UNICA sul grezzo. Nessun derivato entra da qui.

Legge data/fondo/{anno}/{Gara}/{Sessione}.json.gz (8 stagioni storiche, ingerite da
ingest_fondo_storico.py) e, per il 2026, il grezzo che vive ancora in due posti diversi:
data/ti_archive/2026/ e data/ti_cache/ con nomi diversi. La mappa autorevole del 2026 e'
data/gare_registro.json.

E' l'unico punto del progetto che sa DOVE sta il dato. Se domani cambia la forma
dell'archivio, cambia qui e in nessun altro posto.
"""
import gzip
import json
import os
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONDO = os.path.join(ROOT, 'data', 'fondo')
ARCH = os.path.join(ROOT, 'data', 'ti_archive')
REG = os.path.join(ROOT, 'data', 'gare_registro.json')

ASCIUTTE = ('SOFT', 'MEDIUM', 'HARD')
BAGNATE = ('INTERMEDIATE', 'WET')
CHIAVE = ('lap', 'time', 'compound', 'life', 'stint', 'pin', 'pout', 'status', 'drv')


def _n(x):
    """il grezzo scrive la STRINGA 'None' per i mancanti: e' una trappola, non un valore"""
    return None if x is None or x == 'None' or x == '' else x


def _apri(path):
    if path.endswith('.gz'):
        with gzip.open(path, 'rb') as f:
            return json.loads(f.read())
    with open(path) as f:
        return json.load(f)


def _percorsi_2026():
    with open(REG) as f:
        reg = json.load(f)
    out = {}
    for _it, v in reg.items():
        p = os.path.join(ROOT, v['raw'])
        if os.path.exists(p):
            out[v['ti']] = p
    return out


def anni():
    a = sorted(x for x in os.listdir(FONDO) if x.isdigit()) if os.path.isdir(FONDO) else []
    return a + (['2026'] if _percorsi_2026() else [])


def gare(anno, sessione='Race'):
    anno = str(anno)
    if anno == '2026':
        v = set(_percorsi_2026())
        d = os.path.join(ARCH, '2026')
        if os.path.isdir(d):
            v |= {g for g in os.listdir(d)
                  if os.path.exists(os.path.join(d, g, sessione + '.json'))}
        return sorted(v)
    d = os.path.join(FONDO, anno)
    if not os.path.isdir(d):
        return []
    return sorted(g for g in os.listdir(d)
                  if os.path.exists(os.path.join(d, g, sessione + '.json.gz')))


def giri(anno, gara, sessione='Race'):
    """Righe per-giro-per-pilota. Mancanti a None, mai 'None'. [] se la sessione non c'e'."""
    anno = str(anno)
    if anno == '2026':
        p = os.path.join(ARCH, '2026', gara, sessione + '.json')
        if not os.path.exists(p) and sessione == 'Race':
            p = _percorsi_2026().get(gara, p)
    else:
        p = os.path.join(FONDO, anno, gara, sessione + '.json.gz')
    if not os.path.exists(p):
        return []
    d = _apri(p)
    if not isinstance(d, dict) or 'lap' not in d:
        return []
    cols = list(d)
    return [{c: _n(d[c][i]) for c in cols} for i in range(len(d['lap']))]


def piena(anno, gara, sessione='Race'):
    """False per le sessioni MUTILATE (2019 ne ha 30 con sole 3 colonne): entrano nel fondo
    ma non possono rispondere a domande su stint, gomma o bandiere."""
    r = giri(anno, gara, sessione)
    return bool(r) and all(k in r[0] for k in CHIAVE)


def bagnata(anno, gara, sessione='Race'):
    """Dal COMPOUND, non dal flag wR: verificato, wR e' False anche in gare partite su
    INTERMEDIATE (Spa 2025). Su 80 gare 2023-26 i due criteri discordano 4 volte."""
    return any(x.get('compound') in BAGNATE for x in giri(anno, gara, sessione))


def per_pilota(righe):
    out = defaultdict(dict)
    for r in righe:
        if r.get('drv') and r.get('lap') is not None:
            out[r['drv']][int(r['lap'])] = r
    return out


def neutralizzato(r):
    s = str(r.get('status') or '')
    return ('4' in s) or ('6' in s)


def verde(r):
    return (r.get('time') is not None and not neutralizzato(r)
            and r.get('pin') is None and r.get('pout') is None
            and r.get('compound') in ASCIUTTE)
