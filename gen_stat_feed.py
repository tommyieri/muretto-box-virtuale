"""gen_stat_feed.py — IL CENSIMENTO DEL FEED UFFICIALE, e la sentinella che lo sorveglia.

    python3 gen_stat_feed.py [--check] [--anni 2026,2025]

Scarica l'archivio pubblico di F1 (livetiming.formula1.com), decodifica lo stream della
telemetria e CONTA i canali che trasmette davvero. Scrive demo/data/stat/feed.json.

PERCHE' ESISTE, ed e' una storia che vale la pena scrivere qui.
Il sito dichiara che lo stato di carica della batteria e i MJ dell'ERS non sono osservabili.
Era un'affermazione: vera, ma di seconda mano — la si citava dal manutentore di FastF1. E una
affermazione non si aggiorna: se un giorno F1 riaprisse il rubinetto, quella riga resterebbe
li' a mentire finche' qualcuno non se ne accorgesse a mano.

Adesso e' una MISURA, e si rifa' a ogni gara. Il conto di oggi:
    2026  ->  CarData.z porta CINQUE canali: 0 RPM, 2 velocita', 3 marcia, 4 gas, 5 freno
    2025  ->  ne portava SEI: gli stessi piu' il 45, il DRS
    33 feed nell'indice, gli stessi identici nei due anni: nessuno stream nuovo per l'energia
Il canale 45 non e' «a zero» nel 2026: NON C'E'. La colonna DRS che si vede in FastF1 e'
sintetizzata dal parser con un default (`.get('45', 0)`), non letta dal feed — e chi ci
filtrasse sopra otterrebbe un risultato vuoto invece di un errore.

COSA QUESTO CENSIMENTO NON DIMOSTRA. Che il dato non esista da nessuna parte: dimostra che
non passa da QUESTO feed, che e' quello pubblico. Una barra di carica e' comparsa davvero
nel world feed televisivo dal GP d'Australia 2026 ed e' stata poi progressivamente tolta:
era una grafica, non un canale interrogabile. Sono due cose diverse e vanno tenute diverse.

E' UNA SENTINELLA, non solo una tabella: se un giorno comparisse un canale nuovo o uno stream
nuovo, il file lo direbbe da solo alla prima gara utile, invece di lasciare che la riga
pubblicata invecchi in silenzio. Il manutentore di FastF1 chiude la sua discussione con
«unless anything changes on the side of F1»: questo generatore e' il modo di accorgersene.
"""
from __future__ import annotations

import argparse
import base64
import collections
import datetime
import json
import os
import sys
import urllib.request
import zlib

ROOT = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.join(ROOT, 'demo', 'data', 'stat', 'feed.json')
BASE = 'https://livetiming.formula1.com/static/'

# i canali di CarData.z, secondo la mappatura che usa anche FastF1
CANALI = {'0': 'RPM', '2': 'velocita', '3': 'marcia', '4': 'gas', '5': 'freno', '45': 'DRS'}
# quello che ci aspettiamo di trovare oggi: se cambia, la sentinella deve accorgersene
ATTESI_2026 = {'0', '2', '3', '4', '5'}


def ora_utc() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')


def scarica(url, testo=True, timeout=30):
    r = urllib.request.urlopen(url, timeout=timeout).read()
    return r.decode('utf-8-sig') if testo else r


def ultima_gara(anno):
    """(nome, percorso della sessione di gara) dell'ultimo meeting con una gara archiviata.
    DERIVATO dall'indice di stagione: nessun percorso scritto a mano."""
    idx = json.loads(scarica(f'{BASE}{anno}/Index.json'))
    for m in reversed(idx.get('Meetings', [])):
        for s in reversed(m.get('Sessions', [])):
            if s.get('Name') == 'Race' and s.get('Path'):
                return m.get('Name'), s['Path']
    return None, None


def censisci(percorso, max_record=400):
    """Conta le chiavi di Cars[pilota]['Channels'] e i feed dell'indice di sessione.

    Non serve leggere tutto lo stream: i canali sono gli stessi in ogni record, e qualche
    centinaio basta a stabilire l'insieme. Il numero di record letti e' dichiarato, cosi'
    chi rilegge sa su cosa e' stato contato.
    """
    feeds = sorted(json.loads(scarica(f'{BASE}{percorso}Index.json')).get('Feeds', {}))
    canali = collections.Counter()
    letti = 0
    for riga in scarica(f'{BASE}{percorso}CarData.z.jsonStream').splitlines():
        i = riga.find('"')
        if i < 0:
            continue
        try:
            d = json.loads(zlib.decompress(
                base64.b64decode(riga[i + 1:riga.rfind('"')]), -zlib.MAX_WBITS))
        except Exception:
            continue
        for e in d.get('Entries', []):
            for _, c in (e.get('Cars') or {}).items():
                for k in (c.get('Channels') or {}):
                    canali[k] += 1
        letti += 1
        if letti >= max_record:
            break
    return {
        'feed': feeds,
        'n_feed': len(feeds),
        'canali': {k: {'nome': CANALI.get(k, f'sconosciuto ({k})'), 'campioni': n}
                   for k, n in sorted(canali.items(), key=lambda x: int(x[0]))},
        'n_canali': len(canali),
        'record_letti': letti,
    }


def costruisci(anni):
    per_anno, errori = {}, []
    for anno in anni:
        try:
            nome, perc = ultima_gara(anno)
            if not perc:
                errori.append(f'{anno}: nessuna gara archiviata nell\'indice')
                continue
            c = censisci(perc)
            c.update({'gara': nome, 'percorso': perc})
            per_anno[str(anno)] = c
        except Exception as e:
            errori.append(f'{anno}: {type(e).__name__} {e}')

    corrente = per_anno.get(str(max(anni)))
    trovati = set(corrente['canali']) if corrente else set()
    nuovi = sorted(trovati - ATTESI_2026)
    spariti = sorted(ATTESI_2026 - trovati)

    return {
        '_nota': 'GENERATO da gen_stat_feed.py: scarica l\'archivio pubblico F1 e conta i canali '
                 'che trasmette. Non modificare a mano.',
        '_generatore': 'gen_stat_feed.py',
        'schema': 1,
        'calcolato_il': ora_utc(),
        'provenienza': {
            'fonte': 'livetiming.formula1.com/static — archivio pubblico ufficiale F1',
            'come': 'decodifica DEFLATE dei record di CarData.z.jsonStream ed enumerazione delle '
                    'chiavi di Cars[pilota].Channels; elenco dei feed da Index.json di sessione.',
            'sessioni_controllate': [
                {'anno': a, 'gara': v['gara'], 'percorso': v['percorso'],
                 'record_letti': v['record_letti']}
                for a, v in sorted(per_anno.items())
            ],
        },
        'perimetro': {
            'anni': sorted(int(a) for a in per_anno),
            'sessioni': len(per_anno),
            'note': [
                'una sessione di GARA per anno: l\'ultima archiviata, trovata dall\'indice di '
                'stagione e mai scritta a mano.',
                'i canali sono gli stessi in ogni record dello stream, quindi qualche centinaio '
                'di record basta a stabilirne l\'insieme — il numero letto e\' dichiarato.',
                'il censimento riguarda IL FEED, non quello che il sito esporta: quello lo conta '
                'gen_stat_gara.py, ed e\' un\'altra domanda.',
            ],
        },
        'per_anno': per_anno,
        'sentinella': {
            'canali_attesi_2026': sorted(ATTESI_2026),
            'canali_nuovi': nuovi,
            'canali_spariti': spariti,
            'allarme': bool(nuovi or spariti),
            'cosa_significherebbe': 'un canale NUOVO sarebbe la notizia: vorrebbe dire che F1 ha '
                                    'riaperto il rubinetto, e la riga sul sito che dichiara '
                                    'l\'energia non osservabile andrebbe riscritta. Un canale '
                                    'SPARITO sarebbe l\'opposto, e andrebbe dichiarato anche quello.',
        },
        'cosa_dimostra': 'che lo stato di carica, i MJ recuperati e schierati, le mappe motore e '
                         'l\'Overtake Mode non passano da questo feed — che e\' quello pubblico.',
        'cosa_NON_dimostra': 'che il dato non esista da nessuna parte. Una barra di carica e\' '
                             'comparsa nel world feed televisivo dal GP d\'Australia 2026 ed e\' '
                             'stata poi progressivamente tolta: era una GRAFICA, non un canale '
                             'interrogabile. Sono due cose diverse.',
        'il_caso_DRS': 'il canale 45 c\'era nel 2025 e nel 2026 NON C\'E\'. Non e\' «a zero»: la '
                       'colonna DRS che si vede in FastF1 e\' sintetizzata dal parser con un '
                       'default, non letta dal feed. Chi ci filtrasse sopra otterrebbe un '
                       'risultato vuoto invece di un errore.',
        'errori': errori,
    }


def senza_ora(d):
    d = dict(d)
    d.pop('calcolato_il', None)
    # il numero di campioni dipende da quanti record si riesce a leggere: e' rumore di rete,
    # non contenuto. Conta QUALI canali ci sono, non quanti campioni ne ho visti.
    p = {}
    for a, v in (d.get('per_anno') or {}).items():
        v = dict(v)
        v['canali'] = {k: x['nome'] for k, x in v['canali'].items()}
        v.pop('record_letti', None)
        p[a] = v
    d['per_anno'] = p
    prov = dict(d.get('provenienza') or {})
    prov['sessioni_controllate'] = [{k: s[k] for k in ('anno', 'gara', 'percorso')}
                                    for s in prov.get('sessioni_controllate', [])]
    d['provenienza'] = prov
    return d


def riassunto(d) -> str:
    righe = []
    for a, v in sorted(d['per_anno'].items()):
        nomi = ', '.join(x['nome'] for x in v['canali'].values())
        righe.append(f'  {a} ({v["gara"]}): {v["n_canali"]} canali [{nomi}] · {v["n_feed"]} feed')
    s = d['sentinella']
    righe.append('  sentinella: ' + ('ALLARME — ' + (f'canali nuovi {s["canali_nuovi"]} '
                 if s['canali_nuovi'] else '') + (f'spariti {s["canali_spariti"]}'
                 if s['canali_spariti'] else '') if s['allarme']
                 else 'nessun canale nuovo, nessuno sparito'))
    return '\n'.join(righe)


def main() -> int:
    ap = argparse.ArgumentParser(description='censimento dei canali del feed ufficiale F1')
    ap.add_argument('--anni', default='2026,2025', help='anni da confrontare (default 2026,2025)')
    ap.add_argument('--check', action='store_true', help='rigenera e confronta, senza scrivere')
    a = ap.parse_args()
    anni = [int(x) for x in a.anni.split(',')]

    try:
        d = costruisci(anni)
    except Exception as e:
        print(f'[stat_feed] rete non raggiungibile o archivio cambiato: {type(e).__name__} {e}')
        print('[stat_feed] il file NON viene toccato: meglio una misura vecchia e datata che una '
              'misura degradata con l\'aria di essere fresca.')
        return 1

    print(f'[stat_feed] {d["provenienza"]["fonte"]}')
    print(riassunto(d))
    for e in d['errori']:
        print(f'[stat_feed] ATTENZIONE: {e}')

    if a.check:
        if not os.path.exists(DEST):
            print('[stat_feed] CHECK FALLITO: il file non esiste.')
            return 1
        vecchio = json.load(open(DEST, encoding='utf-8'))
        if senza_ora(vecchio) == senza_ora(d):
            print('[stat_feed] CHECK OK: i canali sono gli stessi.')
            return 0
        print('[stat_feed] CHECK FALLITO: il censimento e\' cambiato. '
              'Se e\' comparso un canale nuovo, e\' una NOTIZIA: vedi `sentinella` nel file.')
        return 1

    os.makedirs(os.path.dirname(DEST), exist_ok=True)
    with open(DEST, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'[stat_feed] scritto {os.path.relpath(DEST, ROOT)} ({os.path.getsize(DEST)} byte).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
