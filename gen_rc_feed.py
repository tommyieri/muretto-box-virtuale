"""gen_rc_feed.py — LIVELLO 1 UI (decisione PO su MOCKUP_RACE_CONTROL_UI.md: si' a tutto):
riduce data/race_control_2026.csv (generato da gen_race_control.py, fonte FastF1) al JSON
che la demo consuma -> demo/data/race_control_2026.json.

Per gara:
  feed:     tacche della timeline eventi, SOLO categorie decise (rumore escluso):
            - tipo "giallo":   bandiere YELLOW / DOUBLE YELLOW (raggruppate per giro)
            - tipo "penalita": ogni annuncio penalita' (tempo e non-tempo; NON i "SERVED")
            - tipo "info":     investigazioni / lap time deleted (raggruppate per giro)
  penalita: SOLO annunci di penalita' di TEMPO (per i badge "+Ns" in tabella):
            {pilota, secondi, giro, motivo}
Le penalita' si MOSTRANO: niente aritmetica, niente simulazione (livello 1).
"""
import csv, json, os, re

PEN_RE = re.compile(r'(\d+)\s*SECOND(?:S)?\s*TIME\s*PENALTY.*?CAR\s*(\d+)\s*\((\w+)\)', re.I)
SERVED = 'FIA STEWARDS: PENALTY SERVED'

def motivo(testo):
    parti = testo.split(' - ', 1)
    return re.sub(r'\s*\(\d{2}:\d{2}:\d{2}\)\s*$', '', parti[1]).strip() if len(parti) > 1 else ''

def main():
    with open(os.path.join('data', 'race_control_2026.csv')) as f:
        righe = list(csv.DictReader(f))
    out = {}
    for r in righe:
        g = out.setdefault(r['gara'], {'feed': [], 'penalita': [],
                                       'fonte': 'race control FastF1 (gen_race_control.py)'})
        testo, giro = r['testo'], int(r['giro']) if r['giro'] else None
        if giro is None:
            continue                                    # senza giro non e' agganciabile alla barra
        if testo.startswith(SERVED):
            continue                                    # feed = annunci; i SERVED sono rumore qui
        pm = PEN_RE.search(testo)
        if pm:
            g['penalita'].append(dict(pilota=pm.group(3).upper(), secondi=int(pm.group(1)),
                                      giro=giro, motivo=motivo(testo)))
            g['feed'].append(dict(giro=giro, tipo='penalita',
                                  testo=f"+{pm.group(1)}s {pm.group(3).upper()}"
                                        + (f" — {motivo(testo)}" if motivo(testo) else '')))
        elif 'PENALTY' in testo.upper():                # stop&go / drive-through: feed, no badge
            g['feed'].append(dict(giro=giro, tipo='penalita',
                                  testo=testo.replace('FIA STEWARDS: ', '')))
        elif r['categoria'] == 'Flag' and r['bandiera'] in ('YELLOW', 'DOUBLE YELLOW'):
            g['feed'].append(dict(giro=giro, tipo='giallo', testo=testo))
        elif 'INVESTIGATION' in testo.upper() or 'DELETED' in testo.upper():
            g['feed'].append(dict(giro=giro, tipo='info', testo=testo.replace('FIA STEWARDS: ', '')))

    # raggruppa giallo/info per giro (una tacca per giro e tipo, tooltip = primi 3 testi)
    for g in out.values():
        gr = {}
        for e in g['feed']:
            if e['tipo'] == 'penalita':
                gr[('p', e['giro'], e['testo'])] = e
            else:
                k = (e['tipo'], e['giro'])
                if k in gr:
                    if gr[k]['testo'].count(' · ') < 2:
                        gr[k]['testo'] += ' · ' + e['testo']
                else:
                    gr[k] = dict(e)
        g['feed'] = sorted(gr.values(), key=lambda e: (e['giro'], e['tipo']))

    dst = os.path.join('demo', 'data', 'race_control_2026.json')
    with open(dst, 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    for gara, g in out.items():
        print(f'{gara:>14}: feed {len(g["feed"]):3} tacche | badge penalita\' tempo: '
              f'{[(p["pilota"], p["secondi"]) for p in g["penalita"]]}')
    print(f'[scritto] {dst}')

if __name__ == '__main__':
    main()
