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
import argparse, hashlib, json, os, subprocess, sys
from datetime import datetime, timezone
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


SIGILLI = [
    os.path.join('simulatore', 'data', 'modelli', 'modello_v2.json'),
    os.path.join('simulatore', 'banco', 'ROSSE_DICHIARATE.json'),
    os.path.join('simulatore', 'data', 'modelli', 'banda_rientro.json'),
]
VERSIONE = os.path.join('demo', 'data', 'versione.json')


def scrivi_versione():
    """LA TARGHETTA DEL DEPLOY: cosa c'e' davvero online.

    Nessun controllo attraversava la catena Mac -> push -> VPS -> push -> Vercel:
    ogni pezzo si verificava da solo, e il guasto «la macchina che pubblica esegue
    un main vecchio» si scopriva solo entrando in ssh. Qui il sito porta addosso
    il commit con cui e' stato costruito e l'impronta dei sigilli del motore, cosi'
    `scheduling/sonda_deploy.sh` puo' chiedere DA FUORI se l'online e' il main.

    Il file e' un artefatto generato: se un hash cambia senza che nessuno abbia
    ri-pubblicato, la sonda lo dice. Se git non c'e' (o la cartella non e' un
    repo) si scrive `null` e lo si dichiara: regola 6, l'assenza non si traveste.
    """
    def git(*a):
        try:
            r = subprocess.run(['git', *a], capture_output=True, text=True)
            return r.stdout.strip() if r.returncode == 0 else None
        except Exception:
            return None

    sigilli = {}
    for rel in SIGILLI:
        try:
            with open(rel, 'rb') as fh:
                sigilli[rel] = hashlib.sha256(fh.read()).hexdigest()[:16]
        except OSError:
            sigilli[rel] = None          # assente: la sonda lo segnala, non lo inventa

    d = {
        '_nota': 'GENERATO da aggiorna_ui.py — la targhetta di cosa e\' online. '
                 'Confrontala con `git ls-remote origin main`: se divergono, la macchina '
                 'che pubblica non sta eseguendo il main. Sonda: scheduling/sonda_deploy.sh',
        '_ritardo_strutturale': 'Questo file non puo\' contenere il commit che lo include, e si '
                 'rigenera solo quando gira aggiorna_ui.py (cioe\' dopo una gara). Fra due gare il '
                 'ritardo su origin/main CRESCE di un commit per commit, ed e\' normale: non e\' la '
                 'catena rotta. Si azzera con `python3 -c "import aggiorna_ui; aggiorna_ui.scrivi_versione()"`. '
                 'Il rimedio strutturale sarebbe scriverlo a ogni deploy, che richiede un build step '
                 'su Vercel — impostazione del progetto, non codice.',
        'ramo_alla_generazione': git('rev-parse', '--abbrev-ref', 'HEAD'),
        'commit': git('rev-parse', 'HEAD'),
        'commit_breve': git('rev-parse', '--short', 'HEAD'),
        'data_commit': git('log', '-1', '--format=%cI'),
        'costruito_il': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'sigilli_sha256_16': sigilli,
    }
    os.makedirs(os.path.dirname(VERSIONE), exist_ok=True)
    with open(VERSIONE, 'w') as fh:
        json.dump(d, fh, ensure_ascii=False, indent=1)
        fh.write('\n')
    mancanti = [k for k, v in sigilli.items() if v is None]
    nota = f' — SIGILLI MANCANTI: {", ".join(mancanti)}' if mancanti else ''
    print(f'[{VERDE}OK{FINE}] versione     {d["commit_breve"] or "senza git"} '
          f'({d["ramo_alla_generazione"] or "?"}){nota}')


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
    scrivi_versione()
    if errori:
        sys.exit(f'{errori} passi falliti — vedi sopra.')
    print('aggiorna_ui: tutti i passi completati.')


if __name__ == '__main__':
    main()
