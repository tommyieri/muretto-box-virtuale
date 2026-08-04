"""gen_stat_regolamento.py — i limiti energetici del regolamento 2026, e la sentinella sull'Issue.

    python3 gen_stat_regolamento.py [--check] [--senza-rete]

Proietta data/regolamento_2026.json (file FIRMATO A MANO) in demo/data/stat/regolamento.json,
e controlla se la FIA ha nel frattempo pubblicato una revisione piu' recente di quella firmata.

PERCHE' UN FILE FIRMATO E NON UN'ESTRAZIONE DAL PDF.
La tentazione naturale e' leggere i numeri dal documento con un parser. E' la scelta sbagliata,
e il progetto ha gia' l'esempio sotto mano: i parser di documenti FIA si rompono in SILENZIO
quando cambia il layout — e un parser che si rompe in silenzio su un regolamento produce numeri
plausibili e sbagliati, che e' peggio di nessun numero. Qui il testo lo legge una persona, che
firma; il generatore fa le due cose che una persona non puo' fare a ogni gara: proiettare e
sorvegliare.

PERCHE' LA FORMULA E NON LA SOGLIA.
Questa tabella era stata scartata perche' «le fonti discordano»: 288 contro 290 km/h, 350
contro 355. Non discordano le fonti: discordano i riassunti, che arrotondano una derivazione.
Il testo dice P = 1800 - 5v, e da li' i 350 kW finiscono a 290 km/h esatti. Pubblicata la
formula, la discordanza non esiste piu' — e chi legge puo' rifare il conto invece di fidarsi.
Per questo il generatore DERIVA le soglie dalle formule e le pubblica accanto, dichiarando che
sono derivate.

LA SENTINELLA. La Sezione C ha avuto diciannove revisioni in una stagione. Una tabella firmata
su una revisione vecchia e' esattamente il tipo di numero che invecchia senza che nessuno se ne
accorga — lo stesso guasto che gen_stat_feed.py evita per i canali. Se la FIA pubblica un Issue
piu' recente di quello firmato, il file lo dichiara e demo/test_stat.mjs diventa rosso.
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
SORGENTE = os.path.join(ROOT, 'data', 'regolamento_2026.json')
DEST = os.path.join(ROOT, 'demo', 'data', 'stat', 'regolamento.json')
INDICE_FIA = 'https://www.fia.com/regulation/category/110'


def ora_utc() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')


def sha256_12(p):
    if not p or not os.path.exists(p):
        return None
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()[:12]


def issue_pubblicati(timeout=20):
    """Gli Issue delle Sezioni B e C che la FIA espone oggi. None se non raggiungibile.

    NON e' un fallimento se torna None: e' un'informazione, e viene dichiarata. Il sito FIA
    e' lento e a volte non risponde; una sentinella che si spegne in silenzio quando la rete
    manca sarebbe peggio di nessuna sentinella.
    """
    try:
        req = urllib.request.Request(INDICE_FIA, headers={'User-Agent': 'Mozilla/5.0'})
        html = urllib.request.urlopen(req, timeout=timeout).read().decode('utf-8', 'ignore')
    except Exception as e:
        return None, f'{type(e).__name__}: {e}'
    trovati = {}
    for m in re.finditer(r'fia_2026_f1_regulations_-_section_([bc])_[a-z]+_-_iss_(\d+)', html, re.I):
        sez, iss = m.group(1).lower(), int(m.group(2))
        trovati[f'sezione_{sez.upper()}'] = max(trovati.get(f'sezione_{sez.upper()}', 0), iss)
    return trovati, None


def deriva_soglie(formula):
    """Da una curva a tratti alle velocita' notevoli. Le soglie NON si scrivono a mano.

    Per ogni tratto della forma «a - b*v» si risolve P(v) = 350 (il tetto dell'ERS-K) e
    P(v) = 0, e si tiene la soluzione dentro il tratto. E' esattamente il conto che i
    riassunti fanno male: qui e' esplicito e verificabile.
    """
    fuori = []
    for t in formula or []:
        p = str(t.get('P', ''))
        m = re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*\*\s*v\s*', p)
        if not m:
            continue
        a, b = float(m.group(1)), float(m.group(2))
        for bersaglio, eti in ((350.0, 'i 350 kW si esauriscono a'), (0.0, 'il deployment e\' zero da')):
            v = (a - bersaglio) / b
            lo, hi = t.get('da'), t.get('a')
            if (lo is None or v >= lo) and (hi is None or v <= hi):
                fuori.append({'a_km_h': round(v, 1), 'significato': eti,
                              'da_formula': p, 'derivata': True})
    return fuori


def costruisci(senza_rete=False):
    src = json.load(open(SORGENTE, encoding='utf-8'))
    firmato = bool(src.get('firmato'))

    # SOLO le voci con un valore (o una formula) CONFERMATO. Una voce ancora in
    # `valore_proposto` non e' firmata, e non si pubblica: e' lavoro da fare, non un dato.
    pubblicabili, da_firmare = [], []
    for v in src.get('voci', []):
        confermata = v.get('valore') is not None or v.get('formula') is not None
        doc = src['documenti'].get(v.get('documento'), {})
        voce = {
            'id': v['id'], 'cosa': v['cosa'], 'articolo': v['articolo'],
            'documento': doc.get('titolo'), 'issue': doc.get('issue'), 'data': doc.get('data'),
            'unita': v.get('unita'), 'nota': v.get('nota'),
        }
        if confermata:
            voce['valore'] = v.get('valore')
            voce['formula'] = v.get('formula')
            if v.get('formula'):
                voce['soglie_derivate'] = deriva_soglie(v['formula'])
            for k in ('riducibile_a', 'pavimento', 'addizionale'):
                if v.get(k) is not None:
                    voce[k] = v[k]
            pubblicabili.append(voce)
        else:
            voce['valore_proposto'] = v.get('valore_proposto')
            voce['formula_proposta'] = v.get('formula_proposta')
            da_firmare.append(voce)

    pubblicati, errore_rete = (None, 'saltato (--senza-rete)') if senza_rete else issue_pubblicati()
    piu_recenti = {}
    if pubblicati:
        for chiave, doc in src['documenti'].items():
            k = 'sezione_' + chiave.split('_')[-1].upper()
            att = pubblicati.get(k)
            if att and att > doc.get('issue', 0):
                piu_recenti[chiave] = {'firmato': doc.get('issue'), 'pubblicato': att}

    return {
        '_nota': 'GENERATO da gen_stat_regolamento.py da data/regolamento_2026.json, che e\' '
                 'firmato a mano. Non modificare a mano ne\' l\'uno ne\' l\'altro senza firmare.',
        '_generatore': 'gen_stat_regolamento.py',
        'schema': 1,
        'calcolato_il': ora_utc(),
        'provenienza': {
            'sorgente': 'data/regolamento_2026.json',
            'sorgente_sha256_12': sha256_12(SORGENTE),
            'documenti': src['documenti'],
            'perche_firmato_e_non_estratto':
                'i numeri li legge una persona dal testo primario e li firma. Un parser di PDF '
                'FIA si romperebbe in silenzio al primo cambio di layout, e su un regolamento '
                'produrrebbe numeri plausibili e sbagliati — peggio di nessun numero.',
        },
        'perimetro': {
            'anno': 2026,
            'voci_pubblicate': len(pubblicabili),
            'voci_da_firmare': len(da_firmare),
            'note': [
                'si pubblica la FORMULA, non la soglia: le soglie qui sotto sono DERIVATE e '
                'marcate come tali, cosi\' chiunque puo\' rifare il conto.',
                'una voce senza valore confermato non si pubblica: resta in `da_firmare`.',
            ],
        },
        'firma': {
            'firmato': firmato,
            'firmato_da': src.get('firmato_da'),
            'firmato_il': src.get('firmato_il'),
            'perche_grezzo': None if firmato else
                'il file non e\' firmato: nessun numero di regolamento viene pubblicato. I valori '
                'proposti stanno in `da_firmare` e aspettano che qualcuno apra il documento '
                'all\'articolo indicato e confermi.',
        },
        'sentinella_issue': {
            'issue_firmati': {k: v.get('issue') for k, v in src['documenti'].items()},
            'issue_pubblicati': pubblicati,
            'errore_rete': errore_rete,
            'piu_recenti_di_quello_firmato': piu_recenti,
            'allarme': bool(piu_recenti),
            'cosa_significherebbe': 'la Sezione C ha avuto diciannove revisioni in una stagione. '
                                    'Se la FIA ne pubblica una piu\' recente di quella firmata, i '
                                    'numeri in pagina potrebbero non essere piu\' quelli in vigore '
                                    'e la firma va rifatta sull\'Issue nuovo.',
        },
        'voci': pubblicabili,
        'da_firmare': da_firmare,
        'cosa_non_entra': src.get('_cosa_NON_entra_in_questo_file'),
    }


def senza_ora(d):
    d = dict(d)
    d.pop('calcolato_il', None)
    # la sentinella dipende dalla rete: quando il sito FIA non risponde il campo cambia, e
    # non e' contenuto. Si confronta cio' che e' FIRMATO, non cio' che la rete ha risposto.
    s = dict(d.get('sentinella_issue') or {})
    for k in ('issue_pubblicati', 'errore_rete', 'piu_recenti_di_quello_firmato', 'allarme'):
        s.pop(k, None)
    d['sentinella_issue'] = s
    return d


def main() -> int:
    ap = argparse.ArgumentParser(description='limiti energetici del regolamento 2026')
    ap.add_argument('--check', action='store_true', help='rigenera e confronta, senza scrivere')
    ap.add_argument('--senza-rete', action='store_true',
                    help='salta il controllo dell\'Issue sul sito FIA')
    a = ap.parse_args()

    d = costruisci(senza_rete=a.senza_rete)
    f = d['firma']
    print(f'[stat_regolamento] firma: {"SI" if f["firmato"] else "NO"} · '
          f'{d["perimetro"]["voci_pubblicate"]} voci pubblicate, '
          f'{d["perimetro"]["voci_da_firmare"]} da firmare')
    s = d['sentinella_issue']
    if s.get('errore_rete'):
        print(f'[stat_regolamento] sentinella Issue: non verificata — {s["errore_rete"]}')
        print('                   (dichiarato nel file: una sentinella che tace quando la rete '
              'manca sarebbe peggio di nessuna sentinella)')
    elif s.get('allarme'):
        for k, v in s['piu_recenti_di_quello_firmato'].items():
            print(f'[stat_regolamento] ALLARME: {k} firmata all\'Issue {v["firmato"]}, '
                  f'la FIA e\' all\'Issue {v["pubblicato"]}. La firma va rifatta.')
    else:
        print('[stat_regolamento] sentinella Issue: nessuna revisione piu\' recente.')

    if a.check:
        if not os.path.exists(DEST):
            print('[stat_regolamento] CHECK FALLITO: il file non esiste.')
            return 1
        vecchio = json.load(open(DEST, encoding='utf-8'))
        if senza_ora(vecchio) == senza_ora(d):
            print('[stat_regolamento] CHECK OK.')
            return 0
        print('[stat_regolamento] CHECK FALLITO: il file su disco NON coincide col rigenerato.')
        return 1

    os.makedirs(os.path.dirname(DEST), exist_ok=True)
    with open(DEST, 'w', encoding='utf-8') as fh:
        json.dump(d, fh, ensure_ascii=False, indent=1)
        fh.write('\n')
    print(f'[stat_regolamento] scritto {os.path.relpath(DEST, ROOT)} '
          f'({os.path.getsize(DEST)} byte).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
