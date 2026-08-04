"""gen_stat_identita.py — UNA SOLA TABELLA DI IDENTITA' DELLE SQUADRE.

    python3 gen_stat_identita.py [--check]

Scrive demo/data/stat/identita.json: per ogni squadra del 2026, il nome CANONICO piu' tutti
gli alias sotto cui compare nel sito, in una mappa piatta che le pagine usano per tradurre.

IL PROBLEMA CHE CHIUDE (voce S6 del registro delle divergenze).
Nel sito le squadre si chiamano in quattro modi, e non e' un'impressione:

    demo/team_colori.json        Haas F1 Team   Red Bull Racing     <- chiave dei colori
    classifiche `nome`           Haas           Red Bull
    classifiche `team_demo`      Haas F1 Team   Red Bull Racing
    id f1db                      haas           red-bull
    demo/data/teams.json         Haas           Red Bull Racing     <- misto, e ORFANO

Finche' ogni pagina traduceva per conto suo, il difetto era SILENZIOSO PER COSTRUZIONE: un
nome che non risolve non da' errore, restituisce il grigio di riserva. Cioe' la livrea
sbagliata su una tabella che sembra a posto — la classe di guasto che un lettore esperto
nota prima di noi.

LA SCELTA DEL CANONICO NON E' ARBITRARIA, ed e' l'unica cosa qui dentro che somiglia a una
decisione: si prende `team_demo` delle classifiche perche' MISURATO che coincide gia' con le
chiavi di team_colori.json su tutte e undici le squadre. Non si inventa un vocabolario nuovo:
si dichiara quello che gia' funziona, e si porta tutto il resto li' sopra.

DOVE STA LA DIFFERENZA CON IL CEROTTO CHE SOSTITUISCE. `stat.mjs::normalizzaTeam` era un
dizionario di quattro alias scritto a mano dentro un modulo: copriva i casi che avevo visto,
e un nome nuovo (una squadra che cambia ragione sociale, un motorista nuovo) sarebbe passato
inosservato fino al primo grigio. Questa tabella si rigenera a ogni gara insieme al resto, e
il generatore ESCE 1 se una squadra non trova la sua livrea: il guasto smette di essere muto.
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
CLASSIFICHE = os.path.join(ROOT, 'demo', 'data', 'classifiche_2026.json')
COLORI = os.path.join(ROOT, 'demo', 'team_colori.json')
MOTORI = os.path.join(ROOT, 'demo', 'data', 'motori_2026.json')
SCHEDE = os.path.join(ROOT, 'demo', 'data', 'schede_2026.json')
STAT = os.path.join(ROOT, 'demo', 'data', 'stat')
DEST = os.path.join(STAT, 'identita.json')

# gli artefatti della sezione da cui si raccolgono gli alias realmente in uso: se una
# squadra compare li' dentro con un nome che questa tabella non conosce, il generatore
# se ne accorge PRIMA che diventi un grigio in pagina.
ARTEFATTI = ['gara_2026.json', 'piloti_2026.json']


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


def nomi_negli_artefatti():
    """Ogni valore di un campo `team` o `squadra`, ovunque sia nell'albero degli artefatti."""
    trovati = set()

    def cerca(v):
        if isinstance(v, list):
            for x in v:
                cerca(x)
        elif isinstance(v, dict):
            for k, x in v.items():
                if k in ('team', 'squadra') and isinstance(x, str):
                    trovati.add(x)
                else:
                    cerca(x)

    for nome in ARTEFATTI:
        p = os.path.join(STAT, nome)
        if os.path.exists(p):
            cerca(json.load(open(p, encoding='utf-8')))
    return trovati


def costruisci():
    clas = json.load(open(CLASSIFICHE, encoding='utf-8'))
    colori = json.load(open(COLORI, encoding='utf-8'))
    colori.pop('_nota', None)
    try:
        motori = json.load(open(MOTORI, encoding='utf-8'))
    except OSError:
        motori = {}
    try:
        schede = json.load(open(SCHEDE, encoding='utf-8'))
    except OSError:
        schede = {'piloti': {}}

    squadre, alias = [], {}
    senza_colore = []
    for c in clas['costruttori']:
        canonico = c.get('team_demo') or c.get('nome')
        piloti = sorted(s['sigla'] for s in schede['piloti'].values()
                        if s.get('constructorId') == c['id'])
        forme = {c['id'], c.get('nome'), c.get('team_demo'), canonico}
        forme.discard(None)
        for f in forme:
            alias[f] = canonico
        colore = colori.get(canonico)
        if not colore:
            senza_colore.append(canonico)
        squadre.append({
            'id': c['id'],
            'canonico': canonico,
            'nome_breve': c.get('nome'),
            'colore': colore,
            'motore': (motori.get(c['id']) or {}).get('motore'),
            'piloti': piloti,
            'alias': sorted(forme),
        })

    # gli alias che gli artefatti usano davvero e che la tabella non conosce ancora
    ignoti = sorted(n for n in nomi_negli_artefatti() if n not in alias and n != '?')
    for n in ignoti:
        alias.setdefault(n, None)

    return {
        '_nota': 'GENERATO da gen_stat_identita.py. Non modificare a mano: si rigenera a ogni '
                 'gara con `python3 aggiorna_stat.py`.',
        '_generatore': 'gen_stat_identita.py',
        'schema': 1,
        'calcolato_il': ora_utc(),
        'provenienza': {
            'artefatti_letti': [
                {'path': 'demo/data/classifiche_2026.json', 'sha256_12': sha256_12(CLASSIFICHE)},
                {'path': 'demo/team_colori.json', 'sha256_12': sha256_12(COLORI)},
                {'path': 'demo/data/motori_2026.json', 'sha256_12': sha256_12(MOTORI)},
            ],
            'canonico': 'il campo `team_demo` di demo/data/classifiche_2026.json, scelto perche\' '
                        'MISURATO che coincide gia\' con le chiavi di demo/team_colori.json su '
                        'tutte le squadre. Nessun vocabolario nuovo: si dichiara quello che '
                        'gia\' funziona.',
            'colori_scritti_a_mano': 'demo/team_colori.json non ha un generatore ed e\' dichiarato '
                                     'nel suo _nota: Audi e Cadillac hanno colori di marca '
                                     'provvisori, la livrea 2026 non e\' confermata.',
        },
        'perimetro': {
            'anno': 2026,
            'squadre': len(squadre),
            'note': [
                'la tabella copre la stagione in corso: e\' l\'anagrafica di CHI CORRE ADESSO, '
                'non la continuita\' storica delle squadre.',
                'la continuita\' fra stagioni (Sauber -> BMW -> Alfa -> Kick -> Audi) NON e\' qui: '
                'esiste in f1db (constructors-chronology) e nessun modulo della sezione la usa '
                'ancora. Quando servira\', andra\' dichiarata come si e\' fatto per i circuiti.',
            ],
        },
        'squadre': sorted(squadre, key=lambda s: s['canonico']),
        'alias': dict(sorted(alias.items())),
        'senza_colore': sorted(senza_colore),
        'alias_ignoti': ignoti,
    }


def senza_ora(d):
    d = dict(d)
    d.pop('calcolato_il', None)
    return d


def main() -> int:
    ap = argparse.ArgumentParser(description='tabella di identita\' delle squadre')
    ap.add_argument('--check', action='store_true', help='rigenera e confronta, senza scrivere')
    a = ap.parse_args()

    d = costruisci()
    print(f'[stat_identita] {len(d["squadre"])} squadre, {len(d["alias"])} alias')

    # IL CONTROLLO CHE RENDE LA TABELLA UTILE. Un nome senza livrea o un alias ignoto non e'
    # un dettaglio estetico: in pagina diventa una barra grigia che nessuno segnala.
    guasti = []
    if d['senza_colore']:
        guasti.append(f'squadre senza livrea in team_colori.json: {", ".join(d["senza_colore"])}')
    if d['alias_ignoti']:
        guasti.append('nomi usati dagli artefatti e sconosciuti alla tabella: '
                      + ', '.join(d['alias_ignoti']))
    for g in guasti:
        print(f'[stat_identita] GUASTO: {g}')

    if a.check:
        if not os.path.exists(DEST):
            print('[stat_identita] CHECK FALLITO: il file non esiste.')
            return 1
        vecchio = json.load(open(DEST, encoding='utf-8'))
        if senza_ora(vecchio) == senza_ora(d):
            print('[stat_identita] CHECK OK: identico al rigenerato.')
            return 1 if guasti else 0
        print('[stat_identita] CHECK FALLITO: il file su disco NON coincide col rigenerato.')
        return 1

    os.makedirs(STAT, exist_ok=True)
    with open(DEST, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'[stat_identita] scritto {os.path.relpath(DEST, ROOT)} '
          f'({os.path.getsize(DEST)} byte).')
    return 1 if guasti else 0


if __name__ == '__main__':
    sys.exit(main())
