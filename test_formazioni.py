#!/usr/bin/env python3
"""test_formazioni.py — LA SENTINELLA DELLA FORMAZIONE (verifica 12).

    python3 test_formazioni.py

Nasce il 19/08/2026 col primo cambio di sedile a stagione in corso: Lawson in Red Bull al
posto di Hadjar infortunato, Tsunoda in Racing Bulls, per il solo GP d'Olanda.

PERCHE' UNA SENTINELLA, e non solo un generatore. Fino a ieri demo/data/teams.json era una
mappa piatta senza generatore: chiunque poteva correggerla a mano per la gara in arrivo, e
la correzione sarebbe stata GIUSTA per il round 12 e SILENZIOSAMENTE FALSA per gli undici
gia' corsi — perche' gen_giri.py la rileggeva tale e quale per ogni sessione di ogni gara.
Il danno non si vede il giorno in cui lo fai: si vede al primo `gen_giri.py --forza`, mesi
dopo, quando Lawson risulta pilota Red Bull a Budapest e nessuno collega le due cose.

L'INVARIANTE FORTE E' IL PASSATO (prova C). Non «il file e' ben formato», ma: la formazione
risolta al round di una gara gia' pubblicata deve coincidere con le squadre che stanno DENTRO
i file di quella gara. E' l'unica prova che una modifica fatta per il futuro non ha toccato
il passato, e regge anche contro un guasto che nessuno ha ancora visto — il giorno in cui
f1db attribuisse a Lawson la squadra dell'ultima gara corsa, la base deriverebbe da sola e
questa prova andrebbe rossa senza che nessuno abbia scritto una riga.
"""
from __future__ import annotations

import glob
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DATI = os.path.join(ROOT, 'demo', 'data')
FORM = os.path.join(DATI, 'formazioni_2026.json')
TEAMS = os.path.join(DATI, 'teams.json')
CAL = os.path.join(DATI, 'calendario_2026.json')
COLORI = os.path.join(ROOT, 'demo', 'team_colori.json')
IDENT = os.path.join(DATI, 'stat', 'identita.json')
GIRI = os.path.join(DATI, 'giri')

guasti: list[str] = []


def carica(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def esito(nome, ok, dettaglio=''):
    print(f"  {'✓' if ok else '✗'} {nome}" + (f' — {dettaglio}' if dettaglio else ''))
    if not ok:
        guasti.append(f'{nome}: {dettaglio}')


def main() -> int:
    print('sentinella formazioni — chi guida che cosa, round per round\n')

    for p in (FORM, TEAMS, CAL, COLORI):
        if not os.path.exists(p):
            esito('artefatti presenti', False, f'manca {os.path.relpath(p, ROOT)}')
            return riassunto()

    form = carica(FORM)
    teams = carica(TEAMS)
    colori = carica(COLORI)
    cal = carica(CAL)
    # la tabella canonica traduce «Haas» e «Haas F1 Team» nello stesso nome. Senza, il
    # confronto col passato segnalerebbe come guasto una differenza di vocabolario.
    alias = carica(IDENT).get('alias', {}) if os.path.exists(IDENT) else {}
    def canon(t):
        return alias.get(t, t)

    base = form.get('base', {})
    per_round = form.get('per_round', {})
    schier = form.get('schieramento_per_round', {})
    deroghe = form.get('deroghe', [])

    # ---------------------------------------------------------------- A. riproducibilita'
    r = subprocess.run([sys.executable, 'gen_formazioni.py', '--verifica'],
                       cwd=ROOT, capture_output=True, text=True)
    esito('A. gli artefatti coincidono con la loro sorgente', r.returncode == 0,
          (r.stdout + r.stderr).strip().splitlines()[-1] if r.returncode else
          'gen_formazioni.py --verifica')

    # ---------------------------------------------------------------- B. nessun grigio muto
    senza = sorted({t for m in per_round.values() for t in m.values()
                    if canon(t) not in colori and t not in colori})
    esito('B. ogni squadra di ogni round ha una livrea', not senza,
          ('senza livrea: ' + ', '.join(senza)) if senza
          else f'{len(per_round)} round, 0 grigi di riserva')

    # ------------------------------------------------- C. l'invariante storico (il vero test)
    rnd_di = {}
    for g in cal.get('gare', []):
        if g.get('nome') and g.get('round'):
            rnd_di[g['nome']] = int(g['round'])
    divergenze, controllati, sessioni = [], 0, 0
    for f in sorted(glob.glob(os.path.join(GIRI, '*.json'))):
        nome_f = os.path.basename(f)
        if nome_f.count('__') != 1:            # gli indici, non le tracce per pilota
            continue
        idx = carica(f)
        rnd = rnd_di.get(idx.get('gara'))
        if rnd is None or str(rnd) not in per_round:
            continue
        sessioni += 1
        atteso = per_round[str(rnd)]
        for sig, p in (idx.get('piloti') or {}).items():
            scritto = p.get('team') or ''
            if not scritto:
                continue
            controllati += 1
            if canon(scritto) != canon(atteso.get(sig, '')):
                divergenze.append(f'{nome_f}:{sig} scritto «{scritto}», '
                                  f'risolto «{atteso.get(sig)}» al round {rnd}')
    esito('C. il passato non si muove (sessioni gia\' pubblicate)', not divergenze,
          ('; '.join(divergenze[:4]) + (f' … e altre {len(divergenze)-4}' if len(divergenze) > 4 else ''))
          if divergenze else f'{sessioni} sessioni, {controllati} attribuzioni, 0 divergenze')

    # ---------------------------------------------------------------- D. perimetro delle deroghe
    fuori = []
    for d in deroghe:
        suoi = {int(x) for x in d.get('round', [])}
        for r_ in per_round:
            if int(r_) in suoi:
                continue
            diff = {k for k in set(base) | set(per_round[r_]) if base.get(k) != per_round[r_].get(k)}
            if diff:
                fuori.append(f'round {r_} diverge dalla base su {sorted(diff)}')
    esito('D. fuori dai round dichiarati la deroga non esiste', not fuori,
          '; '.join(sorted(set(fuori))[:3]) if fuori else
          f'{len(deroghe)} deroghe, effetto confinato ai round dichiarati')

    # ---------------------------------------------------------------- E. dentro i round dichiarati
    dentro = []
    for d in deroghe:
        for r_ in [str(int(x)) for x in d.get('round', [])]:
            if r_ not in per_round:
                dentro.append(f'{d.get("id")}: round {r_} fuori calendario'); continue
            for sig, team in (d.get('cambi') or {}).items():
                if per_round[r_].get(sig) != team:
                    dentro.append(f'{d.get("id")}: {sig} al round {r_} e\' '
                                  f'«{per_round[r_].get(sig)}», atteso «{team}»')
            for sig in (d.get('assenti') or []):
                if sig in schier.get(r_, []):
                    dentro.append(f'{d.get("id")}: {sig} risulta ancora schierato al round {r_}')
    esito('E. dentro i round dichiarati la deroga fa cio\' che dice', not dentro,
          '; '.join(dentro[:3]) if dentro else 'cambi applicati, assenti fuori dallo schieramento')

    # ---------------------------------------------------------------- F. teams.json e' derivato
    rc = str(form.get('round_corrente'))
    esito('F. teams.json e\' la formazione del round corrente', teams == per_round.get(rc),
          f'round {rc}, {len(teams)} sigle' if teams == per_round.get(rc)
          else 'teams.json non coincide con per_round[round_corrente]')

    # ---------------------------------------------------------------- G. la deroga e' tracciabile
    magre = [d.get('id') or '(senza id)' for d in deroghe
             if not (d.get('dichiarata_il') and d.get('fonte') and d.get('motivo')
                     and d.get('round'))]
    esito('G. ogni deroga porta data, fonte, motivo e perimetro', not magre,
          'incomplete: ' + ', '.join(magre) if magre else
          'una dichiarazione senza fonte sarebbe un numero inventato con l\'aria di un default')

    return riassunto()


def riassunto() -> int:
    print()
    if guasti:
        print(f'sentinella formazioni: {len(guasti)} GUASTI')
        for g in guasti:
            print(f'  » {g}')
        return 1
    print('sentinella formazioni: tutto verde — la formazione e\' derivata, '
          'le deroghe sono dichiarate e il passato non si muove.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
