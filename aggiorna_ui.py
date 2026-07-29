"""aggiorna_ui.py — IL COMANDO UNICO per i dati della UI, da lanciare DOPO `pubblica`.

Esegue in ordine i generatori consumatori (la UI legge solo demo/data/*):
  1. gen_calendario.py                  calendario + vincitori
  2. gen_classifiche.py                 standings f1db canonici
  3. gen_schede.py                      schede pilota/team (dipende da 2)
  4. gen_foto.py                        foto Commons — salta i piloti gia' presi
                                        (nessun ribombardamento a ogni gara)
  5. gen_pista_svg.py --gara <nome>     SOLO con --gara: il tracciato della gara nuova

NON tocca pipeline_gara.py: e' un passo separato del runbook (e poi dell'automazione).
Idempotente: ogni generatore e' deterministico o salta cio' che esiste — rilanciare
due volte non cambia nulla la seconda. Ogni passo riporta esito e "aggiornato_al".

Uso:  python3 aggiorna_ui.py [--gara <nome>]     (python3 utente, NON venv: serve
      la rete verso f1db; gen_pista_svg richiede fastf1)
"""
import argparse, json, os, subprocess, sys
import f1db_zip

VERDE, ROSSO, FINE = '\033[32m', '\033[31m', '\033[0m'


def aggiornato_al(path):
    try:
        d = json.load(open(path))
        a = d.get('aggiornato_al')
        if isinstance(a, dict):
            return a.get('titolo') or a.get('nome') or f"round {a.get('round')}"
        if a:
            return a
        if 'gare' in d:            # calendario: ultima gara con vincitore nei dati demo
            con_win = [g for g in d['gare'] if g.get('vincitore')]
            return con_win[-1]['titolo'] if con_win else 'nessuna gara corsa'
        if 'piloti' in d:          # foto: quanti crediti liberi registrati
            return f'{len(d["piloti"])} foto con licenza libera'
        return None
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--gara', help='gara nuova appena pubblicata: genera anche la sua pista')
    args = ap.parse_args()

    # stessa release f1db per tutti: se la cache condivisa esiste la passiamo anche
    # a gen_calendario (che altrimenti scarica per conto suo)
    zip_cache = f1db_zip.percorso_zip()
    con_zip = ['--zip', zip_cache] if os.path.exists(zip_cache) else []

    passi = [
        ('calendario', [sys.executable, 'gen_calendario.py'] + con_zip,
         os.path.join('demo', 'data', 'calendario_2026.json')),
        ('classifiche', [sys.executable, 'gen_classifiche.py'] + con_zip,
         os.path.join('demo', 'data', 'classifiche_2026.json')),
        ('schede', [sys.executable, 'gen_schede.py'] + con_zip,
         os.path.join('demo', 'data', 'schede_2026.json')),
        ('pitstops', [sys.executable, 'gen_pitstops.py'] + con_zip,
         os.path.join('demo', 'data', 'pitstops_2026.json')),
        ('griglie', [sys.executable, 'gen_grids.py'],
         os.path.join('demo', 'data', 'grids.json')),
        ('foto', [sys.executable, 'gen_foto.py'], os.path.join('demo', 'data', 'foto_credits.json')),
    ]
    if args.gara:
        passi.append(('pista', [sys.executable, 'gen_pista_svg.py', '--gara', args.gara],
                      os.path.join('demo', 'data', f'pista_{args.gara}.json')))

    errori = 0
    for nome, cmd, artefatto in passi:
        r = subprocess.run(cmd, capture_output=True, text=True)
        ok = r.returncode == 0
        agg = aggiornato_al(artefatto)
        stato = f'{VERDE}OK{FINE}' if ok else f'{ROSSO}FAIL{FINE}'
        print(f'[{stato}] {nome:12s} {("aggiornato al: " + agg) if agg else ""}')
        if not ok:
            errori += 1
            for riga in (r.stdout + r.stderr).strip().splitlines()[-4:]:
                print('       ', riga)
    if errori:
        sys.exit(f'{errori} passi falliti — vedi sopra.')
    print('aggiorna_ui: tutti i passi completati.')


if __name__ == '__main__':
    main()
