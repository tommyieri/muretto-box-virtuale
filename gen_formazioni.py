"""gen_formazioni.py — CHI GUIDA CHE COSA, E IN CHE GARA.

    python3 gen_formazioni.py            # scrive i due artefatti
    python3 gen_formazioni.py --verifica # rigenera e confronta, senza scrivere
    python3 gen_formazioni.py --round 12 # forza il round «corrente» (riproducibilita')

Scrive due file, e sono due cose diverse:

    demo/data/formazioni_2026.json   la formazione ROUND PER ROUND, con la provenienza
    demo/data/teams.json             la mappa piatta sigla->squadra del round corrente

IL BUCO CHE CHIUDE, e non e' teorico. Fino al 19/08/2026 demo/data/teams.json era una
mappa piatta scritta a mano UNA VOLTA (commit 2921a69, «team da f1db») e mai piu': nessun
generatore la produceva — gen_stat_identita.py la elencava per iscritto fra le fonti
«ORFANE». Una mappa piatta non ha l'asse del tempo, e una sostituzione a meta' stagione e'
precisamente l'ingresso che quell'asse richiede: Lawson passa in Red Bull per il solo GP
d'Olanda, quindi «LAW -> Red Bull Racing» e' VERO al round 12 e FALSO ai round 1-11. Chi
avesse corretto la mappa piatta avrebbe reso Lawson un pilota Red Bull anche a Budapest —
non subito, ma al primo `gen_giri.py --forza`, cioe' mesi dopo e senza che nessuno colleghi
le due cose. E' la stessa classe di guasto del What-If: un numero che cambia da solo sotto
una targhetta che dice «misurato».

DA DOVE VIENE LA FORMAZIONE DI BASE. Da `team_demo` di demo/data/classifiche_2026.json,
cioe' dagli standings f1db gia' generati — non trascritta a mano. E' la stessa scelta di
canonico che fa gen_stat_identita.py, per la stessa ragione misurata: quei nomi coincidono
gia' con le chiavi di demo/team_colori.json su tutte e undici le squadre.

    EFFETTO COLLATERALE, ed e' una riparazione: la vecchia teams.json diceva «Haas», mentre
    team_colori.json e' indicizzato «Haas F1 Team». gen_giri.py fa colori.get(team) senza
    alias, quindi BEA e OCO hanno il grigio di riserva #8A93A3 congelato dentro OGNI file di
    demo/data/giri/ — la livrea sbagliata su una tabella che sembra a posto, che e' il guasto
    che gen_stat_identita.py descrive nel suo stesso frontespizio. Prendendo il canonico dagli
    standings il nome torna «Haas F1 Team» e il colore torna argento. I file gia' scritti
    restano come sono finche' non si rilancia gen_giri.py --forza: sono output storico, non
    si ritoccano a mano.

DA DOVE VIENE IL RESTO. Da data/formazione_deroghe_2026.json, che e' scritto a mano E
DICHIARATO tale: contiene solo cio' che nessuna fonte numerica sa ancora, ogni voce con
data, fonte e perimetro di round. Il confine e' netto — la base e' misurata, la deroga e'
annunciata, e l'artefatto tiene le due cose separate anche in uscita.

LA MAPPA E LO SCHIERAMENTO NON SONO LA STESSA COSA. `per_round` dice a che squadra
APPARTIENE una sigla; `schieramento_per_round` dice chi SCENDE IN PISTA. Hadjar al round 12
sta nella prima e non nella seconda: e' infortunato, non ceduto — e tenerlo nella mappa e'
anche cio' che rende la deroga innocua se recupera all'ultimo momento.
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
CALENDARIO = os.path.join(ROOT, 'demo', 'data', 'calendario_2026.json')
COLORI = os.path.join(ROOT, 'demo', 'team_colori.json')
DEROGHE = os.path.join(ROOT, 'data', 'formazione_deroghe_2026.json')

DEST = os.path.join(ROOT, 'demo', 'data', 'formazioni_2026.json')
DEST_TEAMS = os.path.join(ROOT, 'demo', 'data', 'teams.json')


def sha256_12(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()[:12]


def ora_utc():
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()


def carica(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


# ------------------------------------------------------------------ il round corrente
def round_corrente(cal, oggi):
    """Il round a cui si riferisce la mappa piatta: quello del weekend in corso, altrimenti
    il primo che deve ancora correre, altrimenti l'ultimo della stagione.

    LA FINESTRA E' QUELLA DI auto_gara.py (dal giovedi' al lunedi'), e non per simmetria
    estetica: e' l'unico intervallo in cui il sito serve la formazione di una gara che non
    e' ancora nei dati. Fuori dal weekend «corrente» vuol dire «il prossimo», perche' e'
    quello che un lettore va a cercare."""
    gare = [g for g in cal.get('gare', []) if g.get('round') and g.get('data')]
    for g in gare:
        try:
            gd = datetime.date.fromisoformat(g['data'])
        except ValueError:
            continue
        if -3 <= (oggi - gd).days <= 1:
            return int(g['round'])
    futuri = []
    for g in gare:
        try:
            gd = datetime.date.fromisoformat(g['data'])
        except ValueError:
            continue
        if gd >= oggi:
            futuri.append((gd, int(g['round'])))
    if futuri:
        return min(futuri)[1]
    return max(int(g['round']) for g in gare) if gare else 1


# ------------------------------------------------------------------ la risoluzione
def deroghe_del_round(deroghe, rnd):
    return [d for d in deroghe if rnd in [int(r) for r in d.get('round', [])]]


def mappa_del_round(base, deroghe, rnd):
    """sigla -> squadra al round dato. Le deroghe si applicano in ordine di dichiarazione."""
    m = dict(base)
    for d in deroghe_del_round(deroghe, rnd):
        m.update(d.get('cambi', {}))
    return dict(sorted(m.items()))


def schieramento_del_round(base, deroghe, rnd):
    """Le sigle che scendono in pista al round dato. Chi entra da una deroga entra; chi e'
    dichiarato assente esce. La mappa sopra NON cambia per un assente."""
    sigle = set(base)
    for d in deroghe_del_round(deroghe, rnd):
        sigle |= set(d.get('cambi', {}))
        sigle -= set(d.get('assenti', []))
    return sorted(sigle)


def costruisci(rnd_corrente=None, oggi=None):
    clas = carica(CLASSIFICHE)
    cal = carica(CALENDARIO)
    colori = carica(COLORI)
    dch = carica(DEROGHE)

    base = {}
    for riga in clas.get('piloti', []):
        sigla, team = riga.get('sigla'), riga.get('team_demo')
        if sigla and team:
            base[sigla] = team
    if not base:
        raise SystemExit('STOP: classifiche_2026.json non ha piloti con sigla e team_demo.')
    base = dict(sorted(base.items()))

    deroghe = dch.get('deroghe', [])
    rounds = sorted({int(g['round']) for g in cal.get('gare', []) if g.get('round')})
    if rnd_corrente is None:
        rnd_corrente = round_corrente(cal, oggi or datetime.date.today())

    per_round, schier = {}, {}
    for r in rounds:
        per_round[str(r)] = mappa_del_round(base, deroghe, r)
        schier[str(r)] = schieramento_del_round(base, deroghe, r)

    # IL CONTROLLO CHE RENDE LA TABELLA UTILE, ed e' lo stesso di gen_stat_identita.py: una
    # squadra senza livrea non da' errore, da' una barra grigia che nessuno segnala. Qui pero'
    # si guarda OGNI round, perche' una deroga puo' introdurre un nome che la stagione non
    # aveva — ed e' proprio quando si scrive una deroga che si sbaglia a scriverne il nome.
    senza_colore = sorted({t for m in per_round.values() for t in m.values() if t not in colori})

    # una deroga che non ricade su nessun round del calendario e' una voce morta: o il round
    # e' sbagliato, o la gara e' passata e la voce andava tolta. In entrambi i casi va detto.
    deroghe_fuori = [d.get('id') for d in deroghe
                     if not (set(int(r) for r in d.get('round', [])) & set(rounds))]

    return {
        '_nota': 'GENERATO da gen_formazioni.py. Non modificare a mano: si rigenera con '
                 '`python3 gen_formazioni.py` e la sentinella (test_formazioni.py) fallisce '
                 'se il file e la sua sorgente divergono.',
        '_generatore': 'gen_formazioni.py',
        'schema': 1,
        'stagione': clas.get('stagione', 2026) or 2026,
        'calcolato_il': ora_utc(),
        'round_corrente': rnd_corrente,
        'provenienza': {
            'artefatti_letti': [
                {'path': 'demo/data/classifiche_2026.json', 'sha256_12': sha256_12(CLASSIFICHE)},
                {'path': 'demo/data/calendario_2026.json', 'sha256_12': sha256_12(CALENDARIO)},
                {'path': 'demo/team_colori.json', 'sha256_12': sha256_12(COLORI)},
                {'path': 'data/formazione_deroghe_2026.json', 'sha256_12': sha256_12(DEROGHE)},
            ],
            'base': 'il campo `team_demo` di demo/data/classifiche_2026.json (standings f1db), '
                    'la stessa scelta di canonico di gen_stat_identita.py: MISURATO che quei '
                    'nomi coincidono con le chiavi di demo/team_colori.json.',
            'deroghe': 'data/formazione_deroghe_2026.json — scritto a mano e dichiarato tale: '
                       'solo cio\' che nessuna fonte numerica sa ancora (annunci di entry list), '
                       'ogni voce con data, fonte e perimetro di round.',
        },
        'perimetro': {
            'per_round': 'a che squadra APPARTIENE una sigla, round per round.',
            'schieramento_per_round': 'chi SCENDE IN PISTA, round per round. Non e\' la stessa '
                                      'cosa: un pilota infortunato resta nella mappa della sua '
                                      'squadra e sparisce dallo schieramento.',
            'teams_json': 'demo/data/teams.json e\' `per_round[round_corrente]`, appiattito, '
                          'nella forma che avevano gia\' i suoi due consumatori.',
        },
        'base': base,
        'deroghe': deroghe,
        'per_round': per_round,
        'schieramento_per_round': schier,
        'senza_colore': senza_colore,
        'deroghe_fuori_calendario': deroghe_fuori,
    }


def senza_ora(d):
    d = dict(d)
    d.pop('calcolato_il', None)
    return d


def scrivi(path, dato):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(dato, f, ensure_ascii=False, indent=1, sort_keys=False)
        f.write('\n')


def main() -> int:
    ap = argparse.ArgumentParser(description='formazione round per round')
    ap.add_argument('--verifica', action='store_true',
                    help='rigenera e confronta con i file su disco, senza scrivere')
    ap.add_argument('--round', type=int, default=None,
                    help='forza il round «corrente» (per riproducibilita\')')
    a = ap.parse_args()

    rnd = a.round
    if rnd is None and a.verifica and os.path.exists(DEST):
        # IL ROUND SI RILEGGE, NON SI RICALCOLA. Ricalcolarlo da `oggi` renderebbe la verifica
        # dipendente dal giorno in cui gira: verde oggi e rossa lunedi' senza che nessuno
        # abbia toccato niente, che e' il modo piu' rapido per insegnare a ignorarla.
        try:
            rnd = int(carica(DEST).get('round_corrente'))
        except (OSError, TypeError, ValueError):
            rnd = None

    d = costruisci(rnd_corrente=rnd)
    teams = d['per_round'][str(d['round_corrente'])]
    print(f'[formazioni] round corrente {d["round_corrente"]}, {len(d["base"])} piloti in base, '
          f'{len(d["deroghe"])} deroghe dichiarate')
    for der in d['deroghe']:
        print(f'[formazioni]   deroga {der.get("id")}: round {der.get("round")} — '
              f'cambi {der.get("cambi")}, assenti {der.get("assenti") or []}')

    guasti = []
    if d['senza_colore']:
        guasti.append('squadre senza livrea in team_colori.json: ' + ', '.join(d['senza_colore']))
    if d['deroghe_fuori_calendario']:
        guasti.append('deroghe che non ricadono su nessun round del calendario: '
                      + ', '.join(str(x) for x in d['deroghe_fuori_calendario']))
    for g in guasti:
        print(f'[formazioni] GUASTO: {g}')
    if guasti:
        return 1

    if a.verifica:
        for path, atteso in ((DEST, d), (DEST_TEAMS, teams)):
            if not os.path.exists(path):
                print(f'[formazioni] VERIFICA FALLITA: manca {os.path.relpath(path, ROOT)}.')
                return 1
            vecchio = carica(path)
            if senza_ora(vecchio) != senza_ora(atteso):
                print(f'[formazioni] VERIFICA FALLITA: {os.path.relpath(path, ROOT)} non '
                      f'coincide con cio\' che il generatore produce oggi.')
                return 1
        print('[formazioni] verifica: gli artefatti coincidono con la loro sorgente.')
        return 0

    scrivi(DEST, d)
    scrivi(DEST_TEAMS, teams)
    print(f'[formazioni] scritto {os.path.relpath(DEST, ROOT)} '
          f'({len(d["per_round"])} round) e {os.path.relpath(DEST_TEAMS, ROOT)} '
          f'({len(teams)} sigle, round {d["round_corrente"]})')
    return 0


if __name__ == '__main__':
    sys.exit(main())
