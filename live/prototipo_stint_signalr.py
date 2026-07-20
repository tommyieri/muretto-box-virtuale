"""prototipo_stint_signalr.py — FASE C, prova di FATTIBILITA' (read-only, NON produzione).

Dimostra che gli input degli scenari di degrado — compound + eta'-gomma per pilota,
live — sono estraibili dal feed SignalR ufficiale (topic TimingAppData, campo
Stints[].Compound e .TotalLaps), SENZA dipendere dall'OpenF1 MQTT (rotto). Legge una
registrazione grezza gia' presente (data/live_raw/), decodifica gli stint per pilota e
li VERIFICA incrociando la sequenza di compound con la struttura nota della stessa gara
(demo/data/Gran Bretagna.json, fonte archivio).

NON tocca il collettore di produzione: e' un lettore separato. Nessun KPI, nessuna banda.

Uso:
  python3 live/prototipo_stint_signalr.py [registrazione.txt ...]
  (senza argomenti: usa tutte le data/live_raw/*.txt del checkout principale ~/muretto)
"""
import sys, os, ast, json, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# le registrazioni grezze sono gitignorate: vivono nel checkout principale
RAW_DIR_CANDIDATI = [os.path.join(ROOT, 'data', 'live_raw'),
                     os.path.expanduser('~/muretto/data/live_raw')]
GARA_RIF = os.path.join(ROOT, 'demo', 'data', 'Gran Bretagna.json')
SCHEDE = os.path.join(ROOT, 'demo', 'data', 'schede_2026.json')


def num2sigla():
    s = json.load(open(SCHEDE))['piloti']
    piloti = s.values() if isinstance(s, dict) else s
    return {str(p['numero']): p['sigla'] for p in piloti
            if isinstance(p, dict) and p.get('numero') and p.get('sigla')}


def stint_riferimento():
    """per-sigla: sequenza compound degli stint (dall'archivio demo)."""
    r = json.load(open(GARA_RIF))
    by = {}
    for lp in r['laps']:
        for d, c in lp['cars'].items():
            by.setdefault(d, {})[c['lap']] = (c.get('stint'), c.get('compound'))
    seq = {}
    for d, laps in by.items():
        last, s = None, []
        for lap in sorted(laps):
            st, comp = laps[lap]
            if st != last and comp:
                s.append(comp)
                last = st
        seq[d] = s
    return seq


def righe_registrazione(paths):
    for p in paths:
        with open(p, encoding='utf-8', errors='replace') as f:
            for line in f:
                line = line.strip()
                if not line.startswith('['):
                    continue
                try:
                    tup = ast.literal_eval(line)
                except (ValueError, SyntaxError):
                    continue
                if not (isinstance(tup, (list, tuple)) and len(tup) >= 2):
                    continue
                topic, payload = tup[0], tup[1]
                if topic != 'TimingAppData':
                    continue
                try:
                    yield json.loads(payload)
                except (ValueError, TypeError):
                    continue


def decodifica_stint(paths):
    """per RacingNumber: dict idx->{compound,total_laps} accumulato dai diff TimingAppData."""
    per_num = {}
    for obj in righe_registrazione(paths):
        lines = obj.get('Lines')
        if not isinstance(lines, dict):
            continue
        for num, dati in lines.items():
            st = dati.get('Stints')
            if st is None:
                continue
            acc = per_num.setdefault(num, {})
            # Stints puo' arrivare come LISTA (snapshot) o DICT idx->parziale (diff)
            items = enumerate(st) if isinstance(st, list) else (
                (int(k), v) for k, v in st.items() if str(k).isdigit())
            for idx, s in items:
                if not isinstance(s, dict):
                    continue
                cur = acc.setdefault(idx, {})
                if 'Compound' in s:
                    cur['compound'] = s['Compound']
                if 'TotalLaps' in s:
                    cur['total_laps'] = s['TotalLaps']
    return per_num


def main():
    paths = sys.argv[1:]
    if not paths:
        for d in RAW_DIR_CANDIDATI:
            paths += sorted(glob.glob(os.path.join(d, '*.txt')))
    paths = [p for p in paths if os.path.exists(p)]
    print('=' * 74)
    print('FASE C — fattibilita\': stint (compound + eta-gomma) dal SignalR TimingAppData')
    print('=' * 74)
    if not paths:
        print('NESSUNA registrazione trovata in', RAW_DIR_CANDIDATI)
        print('=> NON TESTABILE (registrazione grezza assente in locale)')
        return
    print('registrazioni:', ', '.join(os.path.basename(p) for p in paths))
    n2s = num2sigla()
    rif = stint_riferimento()
    per_num = decodifica_stint(paths)
    print(f'piloti con stint decodificati: {len(per_num)}\n')

    ok = mismatch = senza_rif = 0
    print(f"{'num':>4} {'sigla':<5} {'compound decodificati (eta-gomma)':<44} match archivio")
    print('-' * 74)
    for num in sorted(per_num, key=lambda x: int(x) if x.isdigit() else 999):
        acc = per_num[num]
        seq = [acc[i] for i in sorted(acc)]
        comp_dec = [s.get('compound') for s in seq if s.get('compound')]
        vita = [s.get('total_laps') for s in seq]
        sigla = n2s.get(num, '?' + num)
        rif_seq = rif.get(sigla)
        dett = ' '.join(f"{c}({v})" for c, v in zip(comp_dec, vita))
        if rif_seq is None:
            esito = 'no rif'
            senza_rif += 1
        elif comp_dec == rif_seq:
            esito = 'OK'
            ok += 1
        else:
            esito = f'DIFF (arch {rif_seq})'
            mismatch += 1
        print(f"{num:>4} {sigla:<5} {dett[:44]:<44} {esito}")

    print('-' * 74)
    tot = ok + mismatch
    print(f'cross-check compound vs archivio: {ok}/{tot} piloti OK'
          + (f', {mismatch} DIFF' if mismatch else '') + (f', {senza_rif} senza riferimento' if senza_rif else ''))
    if tot and ok == tot:
        print('\n=> FATTIBILE: la sequenza compound decodificata dal SignalR combacia con')
        print('   l\'archivio su TUTTI i piloti verificabili. compound + eta-gomma live sono')
        print('   estraibili dal feed che gia\' registriamo, senza l\'OpenF1 MQTT.')
    elif tot:
        print('\n=> PARZIALE: la maggior parte combacia; ispezionare le DIFF (probabile')
        print('   snapshot troncato della registrazione di test, non un difetto del feed).')
    else:
        print('\n=> NON VERIFICABILE con questa registrazione (nessun pilota con riferimento).')


if __name__ == '__main__':
    main()
