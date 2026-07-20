"""gen_grids.py — GENERATORE di demo/data/grids.json (griglie di partenza).

Toglie il passo a mano del runbook (estrazione f1db + cross-check FastF1): ora e'
automatico e ripetibile. Per ogni gara del REGISTRO (data/gare_registro.json) che la
release f1db pinnata copre:
  1. griglia da f1db (races-starting-grid-positions, raceId via anno 2026 + circuitId=cid);
  2. CROSS-CHECK con FastF1 (results.GridPosition) — safety. Se i due NON combaciano:
     AVVISA forte ma scrive comunque la versione f1db (canonica) e registra la discrepanza
     (filosofia PO: pubblica sempre, gli errori si correggono a valle). Il cross-check gira
     solo quando la griglia e' NUOVA o CAMBIATA (idempotente e veloce sui giri gia' scritti).
  3. gare che f1db non copre ancora (release pre-gara) o senza griglia: si SALTANO, la voce
     eventuale in grids.json resta com'e' (mai svuotata).

Deterministico e idempotente. Stile per-riga di grids.json preservato. Entra in
aggiorna_ui.py dopo la pista. Uso: python3 gen_grids.py  (python3 utente: serve fastf1).
"""
import io, csv, json, os, sys
import f1db_zip

DEST = os.path.join('demo', 'data', 'grids.json')
ANNO = '2026'


def griglia_f1db(z, sigla, raceId):
    """(griglia completa ordinata, set delle sigle partite dai box). None se assente.
    Ordine = positionDisplayOrder (1..N): le partenze dai box (positionText='PL',
    positionNumber vuoto) finiscono in coda, come nelle griglie verificate a mano."""
    rows = [r for r in csv.DictReader(io.TextIOWrapper(
        z.open('f1db-races-starting-grid-positions.csv'), encoding='utf-8'))
        if r['raceId'] == raceId]
    if not rows:
        return None
    rows.sort(key=lambda r: int(r['positionDisplayOrder']))
    ordine = [sigla[r['driverId']] for r in rows]
    pit = {sigla[r['driverId']] for r in rows if r['positionText'] == 'PL'}
    return ordine, pit


def griglia_fastf1(ev):
    """Ordine di griglia da FastF1 (results.GridPosition>0). None se non disponibile."""
    try:
        import fastf1
        fastf1.Cache.enable_cache(os.path.expanduser('~/muretto_shared/ff1_cache'))
        fastf1.set_log_level('ERROR')
        s = fastf1.get_session(int(ANNO), ev, 'R')
        s.load(laps=False, telemetry=False, weather=False, messages=False)
        gp = [(int(r['GridPosition']), r['Abbreviation']) for _, r in s.results.iterrows()
              if int(r['GridPosition']) > 0]
        return [a for _, a in sorted(gp)]
    except Exception as e:
        print(f'       [cross-check saltato: FastF1 non disponibile — {e}]')
        return None


def main():
    reg = json.load(open(os.path.join('data', 'gare_registro.json')))
    z = f1db_zip.apri()
    races = {r['circuitId']: r for r in csv.DictReader(
        io.TextIOWrapper(z.open('f1db-races.csv'), encoding='utf-8')) if r['year'] == ANNO}
    sigla = {d['id']: d['abbreviation'] for d in csv.DictReader(
        io.TextIOWrapper(z.open('f1db-drivers.csv'), encoding='utf-8'))}

    grids = json.load(open(DEST)) if os.path.exists(DEST) else {}
    nuovo = {}  # ricostruito in ORDINE REGISTRO (deterministico, idempotente)
    discrepanze, aggiunte, saltate = [], [], []

    for nome, v in reg.items():
        rr = races.get(v['cid'])
        res = griglia_f1db(z, sigla, rr['id']) if rr else None
        if not res:
            # f1db non copre ancora la gara (release pre-gara): mantieni l'eventuale
            # griglia esistente, non svuotarla mai.
            if nome in grids:
                nuovo[nome] = grids[nome]
            saltate.append(nome)
            continue
        g, pit = res
        if grids.get(nome) == g:
            nuovo[nome] = g          # gia' scritta e identica: niente cross-check
            continue
        ff = griglia_fastf1(v['ti'])
        # Confronto robusto alle partenze dai box: si escludono i PL da ENTRAMBE le liste
        # (f1db li marca 'PL'; FastF1 a volte li tiene in fondo con posizione, a volte a 0).
        g_cmp = [s for s in g if s not in pit]
        ff_cmp = [s for s in ff if s not in pit] if ff is not None else None
        if ff_cmp is not None and ff_cmp != g_cmp:
            discrepanze.append((nome, g_cmp, ff_cmp))
            print(f'  !! {nome}: f1db != FastF1 — scrivo f1db (canonica), discrepanza registrata')
        else:
            pl = f', {len(pit)} dai box in coda' if pit else ''
            tag = f'cross-check OK {len(g_cmp)}/{len(g_cmp)}{pl}' if ff_cmp is not None \
                else 'senza cross-check (FastF1 n/d)'
            print(f'  ++ {nome}: griglia f1db ({len(g)}) — {tag}')
        nuovo[nome] = g
        aggiunte.append(nome)

    for k in grids:  # difensivo: eventuali chiavi fuori dal registro restano
        if k not in nuovo:
            nuovo[k] = grids[k]
    grids = nuovo

    righe = ',\n'.join(f'"{k}":{json.dumps(v, ensure_ascii=False, separators=(",", ":"))}'
                       for k, v in grids.items())
    open(DEST, 'w').write('{\n' + righe + '\n}\n')

    print(f'[scritto] {DEST}: {len(grids)} griglie '
          f'(+{len(aggiunte)} nuove/aggiornate, {len(saltate)} saltate: {saltate or "-"})')
    if discrepanze:
        print(f'ATTENZIONE: {len(discrepanze)} discrepanze f1db/FastF1 (pubblicate come f1db):')
        for nome, g, ff in discrepanze:
            print(f'  - {nome}: f1db={g}\n           ff  ={ff}')


if __name__ == '__main__':
    main()
