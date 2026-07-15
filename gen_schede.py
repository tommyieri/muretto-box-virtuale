"""gen_schede.py — GENERATORE di demo/data/schede_2026.json (schede pilota e team).

FONTI E METODO (breve):
  - CARRIERA: campi aggregati CANONICI di f1db (drivers.csv / constructors.csv:
    totalRaceStarts, totalRaceWins, totalPodiums, totalPolePositions,
    totalFastestLaps, totalChampionshipWins, totalPoints) — per i team gli aggregati
    f1db coprono dal 1950 per costruzione. CROSS-CHECK: le vittorie vengono ricontate
    da races-race-results (P1, raceId distinti); una divergenza finisce in
    "cross_check" nella scheda, mai corretta a mano. Nota: la carriera e' quella
    dell'id costruttore f1db (es. 'audi'), senza catena cronologica (Sauber ecc.).
  - prima/ultima vittoria: min/max per data da races-race-results + races.
  - STAGIONE 2026: punti/posizione dalle classifiche gia' generate (standings f1db,
    demo/data/classifiche_2026.json — eseguire prima gen_classifiche.py); il resto
    contato da races-race-results 2026 (migliore risultato, media griglia/arrivo,
    posizioni guadagnate = somma di gridPosition-position sulle gare classificate).
  - CROSS-CHECK COI NOSTRI DATI: per le gare in demo, griglia (grids.json) e ordine
    d'arrivo (ultimo giro dei JSON gara) vengono confrontati con f1db; le divergenze
    sono riportate per-scheda in "cross_check" (strutturate, niente testo libero).
Campo OBBLIGATORIO "aggiornato_al" (dalle classifiche). Deterministico, rieseguibile.

Uso: python3 gen_schede.py [--zip f1db-csv.zip] [--release vX]
"""
import argparse, json, os, sys
import f1db_zip

ANNO = '2026'


def med(xs): return round(sum(xs) / len(xs), 2) if xs else None


def arrivo_demo(gara):
    """Ordine d'arrivo dai nostri dati gara: classificati (non RIT/NP) ordinati per
    (giri completati DESC, cum_time all'ultimo giro completato) — la regola del traguardo."""
    d = json.load(open(os.path.join('demo', 'data', f'{gara}.json')))
    esiti = json.load(open(os.path.join('demo', 'data', 'esiti.json'))).get(gara, {})
    ult = {}                                    # sigla -> (ultimo giro, cum a quel giro)
    for lp in d['laps']:
        for s, c in lp['cars'].items():
            if isinstance(c.get('cum_time'), (int, float)):
                ult[s] = (lp['lap'], c['cum_time'])
    classificati = [(s, g, cum) for s, (g, cum) in ult.items()
                    if esiti.get(s) not in ('RIT', 'NP')]
    classificati.sort(key=lambda x: (-x[1], x[2]))
    return {s: i + 1 for i, (s, _, _) in enumerate(classificati)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--zip'); ap.add_argument('--release', default=f1db_zip.RELEASE)
    args = ap.parse_args()
    zf = f1db_zip.apri(args.release, args.zip)

    try:
        clas = json.load(open(os.path.join('demo', 'data', 'classifiche_2026.json')))
    except FileNotFoundError:
        sys.exit('STOP: manca classifiche_2026.json — eseguire prima gen_classifiche.py')
    agg = clas['aggiornato_al']; ultimo_round = agg['round']

    drivers = {d['id']: d for d in f1db_zip.tabella(zf, 'drivers')}
    constructors = {c['id']: c for c in f1db_zip.tabella(zf, 'constructors')}
    races = {r['id']: r for r in f1db_zip.tabella(zf, 'races')}
    gp = {g['id']: g for g in f1db_zip.tabella(zf, 'grands-prix')}
    paesi = {p['id']: p['name'] for p in f1db_zip.tabella(zf, 'countries')}
    rr_tutti = f1db_zip.tabella(zf, 'races-race-results')
    rr26 = [r for r in rr_tutti if r['year'] == ANNO and int(r['round']) <= ultimo_round]

    # vittorie per pilota/costruttore ricontate (cross-check degli aggregati canonici)
    vitt_pil, vitt_cos, prima_ult = {}, {}, {}
    for r in rr_tutti:
        if r['positionText'] != '1': continue
        vitt_pil.setdefault(r['driverId'], []).append(r['raceId'])
        vitt_cos.setdefault(r['constructorId'], set()).add(r['raceId'])  # raceId distinti (auto condivise)
    def prima_ultima(race_ids):
        if not race_ids: return None, None
        ordinati = sorted(race_ids, key=lambda i: races[i]['date'])
        def voce(i):
            r = races[i]
            return {'anno': int(r['year']), 'gp': gp[r['grandPrixId']]['name'], 'data': r['date']}
        return voce(ordinati[0]), voce(ordinati[-1])

    # cross-check coi nostri dati: griglia e arrivo per le gare in demo
    cal = json.load(open(os.path.join('demo', 'data', 'calendario_2026.json')))
    demo_per_round = {g['round']: g['gara_demo'] for g in cal['gare'] if g['gara_demo']}
    grids_demo = json.load(open(os.path.join('demo', 'data', 'grids.json')))
    arrivi = {g: arrivo_demo(g) for g in demo_per_round.values()}
    griglie = {g: {s: i + 1 for i, s in enumerate(grids_demo.get(g, []))} for g in demo_per_round.values()}

    schede_piloti = {}
    for riga in clas['piloti']:
        pid = riga['id']; d = drivers[pid]; sigla = d['abbreviation']
        miei = [r for r in rr26 if r['driverId'] == pid]
        classificate = [r for r in miei if r['positionNumber']]
        pos = [int(r['positionNumber']) for r in classificate]
        grid = [int(r['gridPositionNumber']) for r in miei if r['gridPositionNumber']]
        guadagnate = sum(int(r['gridPositionNumber']) - int(r['positionNumber'])
                         for r in classificate if r['gridPositionNumber'])
        prima, ultima = prima_ultima(vitt_pil.get(pid, []))
        cross = []
        n_vitt_contate = len(vitt_pil.get(pid, []))
        if n_vitt_contate != int(d['totalRaceWins'] or 0):
            cross.append({'campo': 'vittorie_carriera', 'f1db_aggregato': int(d['totalRaceWins'] or 0),
                          'conteggio_risultati': n_vitt_contate})
        for r in miei:                     # nostri dati vs f1db, gare in demo
            gd = demo_per_round.get(int(r['round']))
            if not gd: continue
            fg = int(r['gridPositionNumber']) if r['gridPositionNumber'] else None
            fa = int(r['positionNumber']) if r['positionNumber'] else None
            ng = griglie[gd].get(sigla); na = arrivi[gd].get(sigla)
            if (fg and ng and fg != ng) or (fa and na and fa != na):
                voce = {'campo': 'gara_demo', 'gara': gd,
                        'griglia_f1db': fg, 'griglia_demo': ng,
                        'arrivo_f1db': fa, 'arrivo_demo': na}
                # causa nota: il cum_time demo e' il transito grezzo, f1db applica le
                # penalita' post-gara — se c'e' una timePenalty la riportiamo accanto
                if r['timePenalty']:
                    voce['penalita_f1db_s'] = float(r['timePenalty'])
                cross.append(voce)
        schede_piloti[pid] = {
            'sigla': sigla, 'nome': d['name'], 'numero': d['permanentNumber'] or d.get('permanentNumber'),
            'nazionalita': paesi.get(d['nationalityCountryId']),
            'constructorId': riga['constructorId'], 'team_demo': riga['team_demo'],
            'carriera': {'gp_disputati': int(d['totalRaceStarts'] or 0),
                         'vittorie': int(d['totalRaceWins'] or 0),
                         'podi': int(d['totalPodiums'] or 0),
                         'pole': int(d['totalPolePositions'] or 0),
                         'giri_veloci': int(d['totalFastestLaps'] or 0),
                         'titoli': int(d['totalChampionshipWins'] or 0),
                         'punti': float(d['totalPoints'] or 0),
                         'prima_vittoria': prima, 'ultima_vittoria': ultima},
            'stagione': {'pos': riga['pos'], 'punti': riga['punti'], 'vittorie': riga['vittorie'],
                         'migliore_risultato': min(pos) if pos else None,
                         'media_griglia': med(grid), 'media_arrivo': med(pos),
                         'pos_guadagnate': guadagnate,
                         'su_gare': {'partite': len(miei), 'classificate': len(classificate)}},
            'cross_check': cross,
        }

    schede_team = {}
    for riga in clas['costruttori']:
        cid = riga['id']; c = constructors[cid]
        miei = [r for r in rr26 if r['constructorId'] == cid]
        pos = [int(r['positionNumber']) for r in miei if r['positionNumber']]
        podi26 = sum(1 for p in pos if p <= 3)
        prima, ultima = prima_ultima(sorted(vitt_cos.get(cid, set())))
        cross = []
        n_vitt_contate = len(vitt_cos.get(cid, set()))
        if n_vitt_contate != int(c['totalRaceWins'] or 0):
            cross.append({'campo': 'vittorie_carriera', 'f1db_aggregato': int(c['totalRaceWins'] or 0),
                          'conteggio_risultati': n_vitt_contate})
        schede_team[cid] = {
            'nome': c['name'], 'nome_completo': c['fullName'], 'team_demo': riga['team_demo'],
            'paese': paesi.get(c['countryId']),
            'carriera': {'gp_disputati': int(c['totalRaceStarts'] or 0),
                         'vittorie': int(c['totalRaceWins'] or 0),
                         'podi': int(c['totalPodiums'] or 0),
                         'pole': int(c['totalPolePositions'] or 0),
                         'giri_veloci': int(c['totalFastestLaps'] or 0),
                         'titoli': int(c['totalChampionshipWins'] or 0),
                         'punti': float(c['totalPoints'] or 0),
                         'prima_vittoria': prima, 'ultima_vittoria': ultima},
            'stagione': {'pos': riga['pos'], 'punti': riga['punti'], 'vittorie': riga['vittorie'],
                         'migliore_risultato': min(pos) if pos else None, 'podi': podi26},
            'cross_check': cross,
        }

    out = {'_nota': (f'GENERATO da gen_schede.py (f1db {args.release}; carriera = aggregati '
                     'canonici f1db, stagione = standings + conteggi risultati; cross_check '
                     'strutturato, mai correzioni a mano). Non modificare a mano.'),
           'aggiornato_al': agg, 'piloti': schede_piloti, 'team': schede_team}
    dest = os.path.join('demo', 'data', 'schede_2026.json')
    with open(dest, 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1); f.write('\n')
    div = sum(1 for s in list(schede_piloti.values()) + list(schede_team.values()) if s['cross_check'])
    print(f'scritto {dest}: {len(schede_piloti)} piloti, {len(schede_team)} team, '
          f'{div} schede con divergenze cross-check')
    fer = schede_team.get('ferrari', {})
    print(f'  Ferrari carriera: vittorie={fer["carriera"]["vittorie"]} (contate '
          f'{len(vitt_cos.get("ferrari", set()))}), titoli={fer["carriera"]["titoli"]}')


if __name__ == '__main__':
    main()
