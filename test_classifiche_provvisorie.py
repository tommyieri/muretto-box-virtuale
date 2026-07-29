"""test_classifiche_provvisorie.py — GOLDEN della coda provvisoria.

La classifica del sito non aspetta piu' la release f1db: alla base canonica somma le gare
che f1db non copre ancora, prese dalla classifica ufficiale FastF1 (punti_provvisori.py).
E' un ricalcolo, e un ricalcolo va MISURATO, non argomentato. Questo test lo misura in due
modi, entrambi contro f1db, che resta l'arbitro.

PROVA 1 — LEAVE-ONE-ROUND-OUT (il meccanismo).
Per ogni round N della stagione: standings f1db al round N-1, piu' il round N calcolato
come lo calcolerebbe la coda provvisoria, uguale? agli standings f1db al round N.
Si confrontano i PUNTI e l'ORDINE, piloti e costruttori. E' esattamente il gesto che la
coda fa in produzione, ripetuto su ogni round gia' verificato da f1db — quindi su ogni
round e' fuori campione.

PROVA 2 — LA FONTE (l'ingresso).
demo/data/ufficiali_2026.json deve riprodurre f1db riga per riga: stessa posizione e
stesso confine "classificato/non classificato". La seconda non e' un dettaglio — con
`Status` al posto di `ClassifiedPosition` divergevano 7 righe su 220, e sarebbero diventate
medie e conteggi sbagliati nelle schede pilota.

Se la FIA cambia il sistema di punti, il formato sprint o le regole di pari merito, questo
test diventa rosso PRIMA che una classifica sbagliata arrivi in produzione.

Uso: python3 test_classifiche_provvisorie.py   (esce 1 se qualcosa non torna)
"""
import json, os, sys
import f1db_zip
import punti_provvisori as pp

ANNO = '2026'
VERDE, ROSSO, FINE = '\033[32m', '\033[31m', '\033[0m'


def carica():
    zf = f1db_zip.apri()
    rr = [r for r in f1db_zip.tabella(zf, 'races-race-results') if r['year'] == ANNO]
    ds = [r for r in f1db_zip.tabella(zf, 'races-driver-standings') if r['year'] == ANNO]
    cs = [r for r in f1db_zip.tabella(zf, 'races-constructor-standings') if r['year'] == ANNO]
    drivers = {d['id']: d for d in f1db_zip.tabella(zf, 'drivers')}
    races = {int(r['round']): r for r in f1db_zip.tabella(zf, 'races') if r['year'] == ANNO}
    sprint = [r for r in f1db_zip.tabella(zf, 'races-sprint-race-results') if r['year'] == ANNO]
    reg = json.load(open(os.path.join('data', 'gare_registro.json')))
    uff = json.load(open(os.path.join('demo', 'data', 'ufficiali_2026.json')))
    cid2nome = {v['cid']: n for n, v in reg.items()}
    round2nome = {rnd: cid2nome.get(r['circuitId']) for rnd, r in races.items()}
    return zf, rr, ds, cs, drivers, round2nome, {int(r['round']) for r in sprint}, uff


def standings(tab, rr, rnd, chiave):
    rid = next((r['raceId'] for r in rr if int(r['round']) == rnd), None)
    return {r[chiave]: float(r['points']) for r in tab if r['raceId'] == rid}


def ordine_f1db(tab, rr, rnd, chiave):
    rid = next((r['raceId'] for r in rr if int(r['round']) == rnd), None)
    righe = [r for r in tab if r['raceId'] == rid]
    return [r[chiave] for r in sorted(righe, key=lambda r: int(r['positionDisplayOrder']))]


def countback(righe, chiave):
    conte = {}
    for r in righe:
        if r['positionNumber']:
            c = conte.setdefault(r[chiave], [0] * 25)
            p = int(r['positionNumber'])
            if p <= 25:
                c[p - 1] += 1
    return {k: tuple(-n for n in v) for k, v in conte.items()}


def main():
    zf, rr, ds, cs, drivers, round2nome, rounds_sprint, uff = carica()
    sigla2id = pp.sigle_2026(zf, rr, drivers)
    team_round = {(int(r['round']), r['driverId']): r['constructorId'] for r in rr}
    rounds = sorted({int(r['round']) for r in rr})
    errori = []

    # ------------------------------------------------------------------ PROVA 2: la fonte
    confrontate = 0
    for r in rr:
        nome = round2nome.get(int(r['round']))
        if not nome or nome not in uff:
            continue
        sig = drivers[r['driverId']]['abbreviation']
        riga = next((x for x in uff[nome]['classifica'] if x['pilota'] == sig), None)
        if riga is None:
            errori.append(f'fonte: {nome} {sig} assente da ufficiali_2026.json')
            continue
        confrontate += 1
        if bool(r['positionNumber']) != riga.get('classificato', True):
            errori.append(f'fonte: {nome} {sig} classificato f1db={r["positionText"]} '
                          f'vs ufficiali={riga.get("classificato")}')
        elif r['positionNumber'] and int(r['positionNumber']) != riga['pos']:
            errori.append(f'fonte: {nome} {sig} pos f1db={r["positionNumber"]} '
                          f'vs ufficiali={riga["pos"]}')
    stato = ROSSO + 'ROSSO' + FINE if errori else VERDE + 'VERDE' + FINE
    print(f'[{stato}] fonte: {confrontate} righe di ufficiali_2026.json contro f1db '
          f'(posizione + confine classificato)')

    # ------------------------------------------------ PROVA 1: leave-one-round-out
    for rnd in rounds:
        if rnd == min(rounds):
            continue
        nome = round2nome.get(rnd)
        if not nome or nome not in uff:
            print(f'  round {rnd}: fuori dal registro demo, salto'); continue
        voce = uff[nome]
        if (rnd in rounds_sprint) != bool(voce.get('sprint')):
            errori.append(f'round {rnd} ({nome}): f1db sprint={rnd in rounds_sprint} '
                          f'ma ufficiali sprint={bool(voce.get("sprint"))}')
            continue
        # delta del round, con le stesse regole della produzione
        dp, dc, righe_rnd = {}, {}, []
        sessioni = [('classifica', pp.PUNTI_GARA, True)]
        if voce.get('sprint'):
            sessioni.append(('sprint', pp.PUNTI_SPRINT, False))
        for chiave, tab, e_gara in sessioni:
            for riga in voce[chiave]:
                did = sigla2id.get(riga['pilota'])
                if did is None:
                    continue
                cid = team_round.get((rnd, did))
                classificato = riga.get('classificato', True)
                punti = tab.get(riga['pos'], 0) if classificato else 0
                if e_gara:
                    righe_rnd.append({'driverId': did, 'constructorId': cid,
                                      'positionNumber': str(riga['pos']) if classificato else ''})
                if punti:
                    dp[did] = dp.get(did, 0) + punti
                    dc[cid] = dc.get(cid, 0) + punti
        precedenti = [r for r in rr if int(r['round']) < rnd]
        for eti, tab, chiave, delta in (('piloti', ds, 'driverId', dp),
                                        ('costruttori', cs, 'constructorId', dc)):
            prima = standings(tab, rr, rnd - 1, chiave)
            atteso = standings(tab, rr, rnd, chiave)
            # La coda somma alla LISTA che f1db ha gia': chi f1db non elenca ancora non
            # compare. Non e' un errore del meccanismo finche' quel qualcuno sta a ZERO —
            # e' solo f1db che inizia a elencarlo (lance-stroll entra al round 2 a 0 punti).
            # Se invece manca qualcuno CON punti, o ne avanza uno che f1db non ha, e' un
            # guasto vero e va detto.
            calc = {k: prima.get(k, 0) + delta.get(k, 0) for k in set(prima) | set(delta)}
            diff = {k: (calc[k], atteso[k]) for k in set(calc) & set(atteso)
                    if calc[k] != atteso[k]}
            persi = {k: atteso[k] for k in set(atteso) - set(calc) if atteso[k]}
            avanzati = {k: calc[k] for k in set(calc) - set(atteso)}
            if diff or persi or avanzati:
                errori.append(f'round {rnd} ({nome}) {eti}: punti diversi {diff or ""} '
                              f'{f"mancanti con punti {persi}" if persi else ""} '
                              f'{f"in piu {avanzati}" if avanzati else ""}'.strip())
                continue
            # ORDINE: stessa regola della produzione (punti, poi countback), confrontato
            # con l'ordine f1db ristretto a chi la coda conosce.
            cb = countback(precedenti + righe_rnd, chiave)
            vuoto = tuple([0] * 25)
            mio = sorted(calc, key=lambda k: (-calc[k], cb.get(k, vuoto)))
            suo = [k for k in ordine_f1db(tab, rr, rnd, chiave) if k in calc]
            if mio != suo:
                primi = next((i for i, (a, b) in enumerate(zip(mio, suo)) if a != b), 0)
                errori.append(f'round {rnd} ({nome}) {eti}: ordine diverso alla pos '
                              f'{primi + 1} — mio={mio[primi]} f1db={suo[primi]}')
        if not any(f'round {rnd} ' in e for e in errori):
            sp = ' +sprint' if voce.get('sprint') else ''
            print(f'  round {rnd:>2} {nome:>14}{sp:>8}: punti e ordine OK (piloti e costruttori)')

    print()
    if errori:
        print(f'{ROSSO}=> FALLITO: {len(errori)} divergenze{FINE}')
        for e in errori:
            print(f'  - {e}')
        return 1
    print(f'{VERDE}=> PASS: la coda provvisoria riproduce f1db su {len(rounds) - 1} round '
          f'(punti e ordine, piloti e costruttori, sprint incluse){FINE}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
