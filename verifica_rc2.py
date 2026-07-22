"""verifica_rc2.py — RC2: classifica in pista + penalita' di tempo race control non scontate
= classifica rettificata; confronto con la classifica UFFICIALE.

REGOLE PRE-REGISTRATE (PREREG_SESSIONE_RC.md):
- entita' penalita' = annuncio; "PENALTY SERVED" con stesso testo-chiave si aggancia;
- R1 (pre-registrata): gia' scontata <=> SERVED agganciato con giro < ultimo giro pilota;
- classifica: giri desc, cum_time asc; verdetto: 9/9 GO | 7-8 GO PARZIALE | <7 STOP.

DEVIAZIONI DICHIARATE (scoperte in corso, motivate nel report):
1. arbitro ufficiale: il prereg indicava data/arrivi_2026.csv ("f1db"), ma il file e'
   ORFANO (nessun generatore nel repo) e dimostrabilmente PRE-penalita': a Miami gli
   mancano VER+5s e LEC+20s che i tempi FIA (FastF1 results) mostrano come quanti esatti.
   Arbitro corretto: FastF1 results (classifica FIA). L'orfano resta come cross-check.
2. R2 (rivista POST-HOC, diagnosi non verdetto): scontata <=> il pilota ha un pit
   (in_lap nei dati demo) in un giro >= giro dell'annuncio — e' la regola sportiva reale
   (la penalita' si sconta al pit successivo, altrimenti si somma al tempo finale);
   il messaggio SERVED si e' rivelato incompleto (Monaco: scontate senza messaggio).
Il VERDETTO pre-registrato si calcola con R1 (regola congelata) sull'arbitro corretto.
Solo lettura: nessun file del repo viene modificato.
"""
import csv, json, os
import fastf1
import pandas as pd

fastf1.Cache.enable_cache(os.path.expanduser('~/muretto_shared/ff1_cache'))
fastf1.set_log_level('ERROR')

GARE = ['Australia', 'Cina', 'Giappone', 'Miami', 'Canada', 'Monaco', 'Spagna',
        'Austria', 'Gran Bretagna']
EVENTI = {'Australia': 'Australian Grand Prix', 'Cina': 'Chinese Grand Prix',
          'Giappone': 'Japanese Grand Prix', 'Miami': 'Miami Grand Prix',
          'Canada': 'Canadian Grand Prix', 'Monaco': 'Monaco Grand Prix',
          'Spagna': 'Barcelona Grand Prix', 'Austria': 'Austrian Grand Prix',
          'Gran Bretagna': 'British Grand Prix'}
PREFIX_SERVED = 'FIA STEWARDS: PENALTY SERVED - '

def leggi_penalita(gara, righe_csv):
    ann, served = [], {}
    for r in righe_csv:
        if r['gara'] != gara or not r['penalita_secondi']:
            continue
        if r['testo'].startswith(PREFIX_SERVED):
            served['FIA STEWARDS: ' + r['testo'][len(PREFIX_SERVED):]] = \
                int(r['giro']) if r['giro'] else None
        else:
            ann.append(dict(pilota=r['pilota'], secondi=int(r['penalita_secondi']),
                            giro=int(r['giro']) if r['giro'] else None, testo=r['testo']))
    for a in ann:
        a['giro_servita'] = served.get(a['testo'], None)
    return ann

def dati_gara(gara):
    with open(f'demo/data/{gara}.json') as f:
        race = json.load(f)
    cum, laps, pit_laps = {}, {}, {}
    for lp in race['laps']:
        for d, c in lp['cars'].items():
            if isinstance(c.get('cum_time'), (int, float)):
                cum[d] = c['cum_time']; laps[d] = lp['lap']
            if c.get('in_lap'):
                pit_laps.setdefault(d, []).append(lp['lap'])
    return race['n_laps'], cum, laps, pit_laps

def classifica(cum, laps):
    return sorted(cum, key=lambda d: (-laps[d], cum[d]))

def rettifica(cum, laps, pen, pit_laps, regola):
    cum2, applicate = dict(cum), []
    for p in pen:
        if p['pilota'] not in cum2:
            continue
        if regola == 'R1':
            scontata = p['giro_servita'] is not None and p['giro_servita'] < laps[p['pilota']]
        else:  # R2: pit del pilota in un giro >= giro dell'annuncio
            scontata = p['giro'] is not None and any(
                g >= p['giro'] for g in pit_laps.get(p['pilota'], []))
        if not scontata:
            cum2[p['pilota']] += p['secondi']
            applicate.append(f"{p['pilota']}+{p['secondi']}s")
    return cum2, applicate

def main():
    with open('data/race_control_2026.csv') as f:
        rc = list(csv.DictReader(f))
    # NON PIU' ORFANO (22/07/2026): data/arrivi_2026.csv ha ora un generatore committato
    # (gen_arrivi.py, con guardia che riproduce cella per cella le 7 gare congelate) e copre
    # tutte le gare del registro. Resta comunque la classifica DEI DATI DI PISTA, non la FIA:
    # il confronto qui sotto e' di trasparenza, l'arbitro resta FastF1 results.
    orfano = {}
    with open('data/arrivi_2026.csv') as f:
        for r in csv.DictReader(f):
            if r['pos_finale']:
                orfano.setdefault(r['gara'], {})[r['pilota']] = float(r['pos_finale'])
    with open('demo/data/esiti.json') as f:
        esiti = json.load(f)

    tab, n_r1, n_r2, n_orf, n_cop = [], 0, 0, 0, 0
    for gara in GARE:
        nl, cum, laps, pit_laps = dati_gara(gara)
        np_ = {d for d, t in esiti.get(gara, {}).items() if t == 'NP'}
        cum = {d: v for d, v in cum.items() if d not in np_}
        pista = classifica(cum, laps)

        s = fastf1.get_session(2026, EVENTI[gara], 'R')
        s.load(laps=False, telemetry=False, weather=False, messages=False)
        res = s.results
        uff = {r['Abbreviation']: float(r['Position']) for _, r in res.iterrows()
               if r['Position'] == r['Position'] and r['Abbreviation'] in cum}
        ordine_uff = sorted(cum, key=lambda d: uff.get(d, 99))

        pen = leggi_penalita(gara, rc)
        esiti_regole = {}
        for regola in ('R1', 'R2'):
            cum2, applicate = rettifica(cum, laps, pen, pit_laps, regola)
            rett = classifica(cum2, laps)
            esiti_regole[regola] = (rett == ordine_uff, applicate, rett)
        ok1, app1, rett1 = esiti_regole['R1']
        ok2, app2, _ = esiti_regole['R2']
        n_r1 += ok1; n_r2 += ok2
        if gara in orfano:
            n_cop += 1
            n_orf += (rett1 == sorted(cum, key=lambda d: orfano[gara].get(d, 99)))

        # attribuzione automatica: aggiunte ufficiali (quanti FIA) senza traccia RCM,
        # e divergenze di conteggio giri demo<->FIA
        note = []
        win = res.iloc[0]['Abbreviation']
        for _, r in res.iterrows():
            d = r['Abbreviation']
            if d not in cum or pd.isna(r['Position']):
                continue
            if not pd.isna(r['Time']) and d != win and laps[d] == nl:
                diff = r['Time'].total_seconds() - (cum[d] - cum[win])
                if abs(diff) > 0.5 and not any(p['pilota'] == d for p in pen):
                    note.append(f'{d}{diff:+.0f}s ufficiale SENZA traccia race control')
            st = str(r['Status'])
            if laps[d] == nl and st not in ('Finished',) and 'Lap' in st or \
               (laps[d] == nl and st == 'Lapped'):
                note.append(f'{d}: {nl} giri nei dati pista ma "{st}" per la FIA (conteggio giri)')
        if gara == 'Gran Bretagna':
            pp, pr, pu = pista.index('ANT')+1, rett1.index('ANT')+1, ordine_uff.index('ANT')+1
            print(f'=== CASO PO: Antonelli (ANT), Silverstone ===')
            print(f'  in pista P{pp} | +5s (giro 47, nessun pit dopo -> post-gara, R1 e R2 concordi)')
            print(f'  rettificata P{pr} | ufficiale FIA P{pu} -> {"COINCIDE" if pr == pu else "NON COINCIDE"}')
            print(f'  (la differenza residua non e\' la penalita\' di ANT: v. note {gara})\n')
        tab.append((gara, ', '.join(app1) or '—', 'SI' if ok1 else 'NO',
                    'SI' if ok2 else 'NO', '; '.join(note) or ''))

    print(f'{"gara":>14} | {"penalita\' applicate (R1)":<32} | {"R1":>2} | {"R2":>2} | note (attribuzione)')
    for g, a, o1, o2, n in tab:
        print(f'{g:>14} | {a:<32} | {o1:>2} | {o2:>2} | {n}')
    v = lambda n: 'GO' if n == 9 else ('GO PARZIALE' if n >= 7 else 'STOP')
    print(f'\nR1 (pre-registrata) vs ufficiale FIA: {n_r1}/9 -> {v(n_r1)}')
    print(f'R2 (rivista post-hoc, diagnosi)     : {n_r2}/9 -> {v(n_r2)}')
    # denominatore DERIVATO (era cablato a 7): arrivi_2026.csv ora cresce col registro
    print(f'per trasparenza, R1 vs arrivi_2026.csv ({n_cop} gare coperte): {n_orf}/{n_cop}')
    print('\nVERDETTO pre-registrato (R1, arbitro ufficiale corretto): '
          f'{n_r1}/9 -> {v(n_r1)}  (soglie: 9/9 GO, 7-8 GO PARZIALE, <7 STOP)')

if __name__ == '__main__':
    main()
