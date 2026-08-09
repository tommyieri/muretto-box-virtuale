"""gen_soste_fastf1.py — congela l'ARBITRO indipendente per la definizione di sosta.

Scrive data/soste_fastf1_2026.json: per ogni gara e pilota, i giri in cui e' stato montato
un set diverso SECONDO FASTF1 (colonne `Compound` e `TyreLife` di session.laps), piu' i
giri di transito in corsia (`PitInTime`).

PERCHE' ESISTE. La definizione di sosta (data/SOSTA_PREREG3.md) va giudicata da una fonte
indipendente da quella che la alimenta: i dati gara del sito vengono da TracingInsights,
questi dal feed FastF1. Due fornitori che descrivono lo stesso pomeriggio. f1db, provato
sul campo, non va bene: sul 2026 gli mancano otto soste (confermate proprio da FastF1) e
per un pilota l'elenco e' vuoto benche' l'auto sia passata ai box.

Il file e' congelato perche' la sentinella gira in CI, dove non c'e' ne' rete ne' cache
FastF1. Si rigenera a mano quando arriva una gara nuova.

Uso: python3 gen_soste_fastf1.py [--gara Belgio]
"""
import argparse, json, logging, os, warnings

import fastf1

warnings.filterwarnings('ignore')
logging.getLogger('fastf1').setLevel(logging.ERROR)
fastf1.Cache.enable_cache(os.path.expanduser('~/muretto_shared/ff1_cache'))

ANNO = 2026
DEST = os.path.join('data', 'soste_fastf1_2026.json')


def soste_di(session):
    """{sigla: {'cambi': [giri], 'transiti': [giri]}} applicando D5 ai campi FastF1."""
    out = {}
    laps = session.laps
    for sig in sorted(set(laps['Driver'])):
        g = laps[laps['Driver'] == sig].sort_values('LapNumber')
        righe = []
        for _, r in g.iterrows():
            n = int(r['LapNumber'])
            comp = r['Compound'] if isinstance(r['Compound'], str) else None
            if comp in ('UNKNOWN', 'None', ''):
                comp = None
            vita = r['TyreLife']
            vita = float(vita) if vita == vita else None
            pin = r['PitInTime'] == r['PitInTime'] and r['PitInTime'] is not None
            righe.append((n, comp, vita, bool(pin)))
        cambi, transiti = [], []
        for i in range(len(righe) - 1):
            n, c0, v0, pin = righe[i]
            _, c1, v1, _ = righe[i + 1]
            if pin:
                transiti.append(n)
            if c0 is None or c1 is None:
                continue                      # l'assenza non decide: null (regola 6)
            eta_riparte = v0 is not None and v1 is not None and v1 < v0
            if c1 != c0 or eta_riparte:
                cambi.append(n)
        if righe and righe[-1][3]:
            transiti.append(righe[-1][0])
        out[sig] = {'cambi': cambi, 'transiti': transiti}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--gara')
    a = ap.parse_args()
    base = os.path.join('demo', 'data')
    gare = [g['gara'] for g in json.load(open(os.path.join(base, 'manifest.json')))]
    if a.gara:
        gare = [a.gara]
    vecchio = {}
    if os.path.exists(DEST):
        vecchio = json.load(open(DEST)).get('gare', {})
    fuori = dict(vecchio)
    for nome in gare:
        ev = json.load(open(os.path.join(base, f'pista_{nome}.json')))['sorgente']['evento']
        ev = ev.replace(f'{ANNO} ', '').strip()
        s = fastf1.get_session(ANNO, ev, 'R')
        s.load(telemetry=False, laps=True, weather=False, messages=False)
        fuori[nome] = soste_di(s)
        n = sum(len(v['cambi']) for v in fuori[nome].values())
        t = sum(len(v['transiti']) for v in fuori[nome].values())
        print(f'{nome:16} {len(fuori[nome]):3} piloti | {n:3} cambi gomma | {t:3} transiti in corsia')
    out = {
        '_nota': ('GENERATO da gen_soste_fastf1.py. ARBITRO INDIPENDENTE per la definizione '
                  'di sosta (data/SOSTA_PREREG3.md): D5 applicata ai campi Compound/TyreLife '
                  'di FastF1, che vengono da un fornitore diverso da quello dei dati gara '
                  'del sito. Congelato perche la sentinella gira in CI senza rete.'),
        'fonte': f'FastF1 {fastf1.__version__}, session.laps (Compound, TyreLife, PitInTime)',
        'regola': 'cambio = compound[L+1] != compound[L] oppure tyre_life[L+1] < tyre_life[L]',
        'gare': fuori,
    }
    with open(DEST, 'w') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
    print(f'\n[scritto] {DEST} ({os.path.getsize(DEST) / 1024:.0f} KB)')


if __name__ == '__main__':
    main()
