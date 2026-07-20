"""auto_gara.py — ORCHESTRATORE: quando una gara nuova e' online, la mette in demo e la
pubblica DA SOLA, senza nessun 'si'/'ok'. Piu' il secondo passaggio f1db (standings,
pit-lane, griglia) appena esce la release col round nuovo.

Non reimplementa niente: incatena i mattoni gia' testati
  pipeline_gara.py auto  ->  aggiorna_ui.py  ->  gen_race_control/rc_feed/ufficiali  ->  golden
e committa (e pubblica su Vercel con --push).

DUE ONDATE (la seconda serve perche' i dati f1db escono ORE/GIORNI dopo la gara):
  1. gara nuova su TracingInsights  -> pubblica gara + UI + race control + ufficiali
  2. release f1db col round nuovo    -> standings, durate pit-lane, griglia

FILOSOFIA (decisione PO 20/07/2026): pubblica SEMPRE, gli errori si correggono a valle.
I guardrail non bloccano (bandiere in demo/data/bandiere.json). L'unico stop e' il GOLDEN
(regressione del motore/pit): non deve arrivare in produzione.

Uso:
  python3 auto_gara.py                 # fa il lavoro in locale + commit (NON pusha)
  python3 auto_gara.py --push          # + git push su main -> deploy Vercel
  python3 auto_gara.py --dry-run       # mostra cosa farebbe, non tocca niente
Pensato per girare a intervalli (cron/launchd). Idempotente: senza gare nuove ne' release
nuove, non fa nulla.
"""
import json, os, subprocess, sys, urllib.request, urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable   # stesso interprete per i sotto-processi (propaga il venv attivo)
DRY = '--dry-run' in sys.argv
PUSH = '--push' in sys.argv
MAPPA = os.path.join('data', 'mappa_gare.json')
REGISTRO = os.path.join('data', 'gare_registro.json')
REL_FILE = os.path.join('data', 'f1db_release.txt')


def log(msg): print(f'[auto] {msg}', flush=True)


def sh(cmd, check=True):
    """Esegue un comando (lista). In dry-run lo stampa e basta."""
    if DRY:
        log(f'DRY  {" ".join(cmd)}')
        return 0
    r = subprocess.run(cmd, cwd=ROOT)
    if check and r.returncode != 0:
        sys.exit(f'[auto] FERMO: comando fallito ({r.returncode}): {" ".join(cmd)}')
    return r.returncode


def raw_head(ti):
    url = (f'https://raw.githubusercontent.com/TracingInsights/2026/main/'
           f'{urllib.parse.quote(ti)}/Race/session_laptimes.json')
    req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'muretto'})
    try:
        urllib.request.urlopen(req, timeout=30); return True
    except Exception:
        return False


def golden():
    """True se i golden passano. In dry-run assume verde (non esegue)."""
    if DRY:
        log('DRY  golden (test_b.mjs, test_pit.mjs) — assunti verdi'); return True
    ok = subprocess.run(['node', 'test_b.mjs'], cwd=ROOT).returncode == 0
    ok &= subprocess.run(['node', 'test_pit.mjs'], cwd=os.path.join(ROOT, 'demo')).returncode == 0
    return ok


def git(*args, check=True):
    return sh(['git', *args], check=check)


def commit_push(msg):
    if DRY:
        log(f'DRY  git add -A && commit -m "{msg.splitlines()[0]}"'
            + (' && push' if PUSH else '')); return
    git('add', '-A')
    if subprocess.run(['git', 'diff', '--cached', '--quiet'], cwd=ROOT).returncode == 0:
        log('niente da committare.'); return
    git('commit', '-q', '-m', msg)
    log('commit fatto.')
    if PUSH:
        subprocess.run(['git', 'fetch', 'origin', '-q'], cwd=ROOT)
        if subprocess.run(['git', 'rev-list', '--count', 'HEAD..origin/main'],
                          cwd=ROOT, capture_output=True, text=True).stdout.strip() != '0':
            git('rebase', 'origin/main')
        git('push', 'origin', 'main')
        log('push su main -> deploy Vercel.')
    else:
        log('NON pushato (usa --push per mettere online).')


# ------------------------------------------------------ ONDATA 1: gara nuova
def wave_nuove():
    mappa = json.load(open(os.path.join(ROOT, MAPPA)))
    reg = json.load(open(os.path.join(ROOT, REGISTRO)))
    gia_dentro = {v['ti'] for v in reg.values()}
    nuove = []
    for ti, m in mappa.items():
        if ti in gia_dentro:
            continue
        if raw_head(ti):
            nuove.append((ti, m['nome'], m['cid']))
    if not nuove:
        log('ondata 1: nessuna gara nuova online.'); return False
    log(f'ondata 1: gare nuove -> {[n for _, n, _ in nuove]}')
    for ti, nome, cid in nuove:
        log(f'== {nome} ({ti}) ==')
        sh([PY, 'pipeline_gara.py', 'auto', nome, ti, cid])   # guardrail=bandiere
        sh([PY, 'aggiorna_ui.py', '--gara', nome])            # UI + griglie (se f1db le ha)
        sh([PY, 'gen_race_control.py'])                       # lista gare dal registro
        sh([PY, 'gen_rc_feed.py'])
        sh([PY, 'gen_classifiche_ufficiali.py'])
    if not golden():
        sys.exit('[auto] FERMO: golden falliti dopo l\'ondata 1 — niente commit, indagare.')
    ba = _bandiere_testo()
    commit_push('auto: pubblicate ' + ', '.join(n for _, n, _ in nuove)
                + ' (ondata 1: gara+UI+race control+ufficiali)' + ba)
    return True


# ------------------------------------------------------ ONDATA 2: release f1db
def _github_latest():
    req = urllib.request.Request('https://api.github.com/repos/f1db/f1db/releases/latest',
                                 headers={'User-Agent': 'muretto', 'Accept': 'application/vnd.github+json'})
    try:
        return json.load(urllib.request.urlopen(req, timeout=30))['tag_name']
    except Exception as e:
        log(f'ondata 2: impossibile leggere l\'ultima release f1db ({e}).'); return None


def _release_pinnata():
    try:
        v = open(os.path.join(ROOT, REL_FILE)).read().strip()
        if v:
            return v
    except OSError:
        pass
    import f1db_zip
    return f1db_zip._DEFAULT_RELEASE


def wave_f1db():
    latest = _github_latest()
    if not latest:
        return False
    pinnata = _release_pinnata()
    if latest == pinnata:
        log(f'ondata 2: release f1db gia\' aggiornata ({pinnata}).'); return False
    log(f'ondata 2: nuova release f1db {latest} (pinnata {pinnata}) -> aggiorno pin e rigenero UI')
    if DRY:
        log(f'DRY  scrivo {REL_FILE} = {latest}')
    else:
        open(os.path.join(ROOT, REL_FILE), 'w').write(latest + '\n')
    sh([PY, 'aggiorna_ui.py'])   # standings, pit-lane, griglie dalla release nuova
    if not golden():
        sys.exit('[auto] FERMO: golden falliti dopo l\'ondata 2 — niente commit, indagare.')
    commit_push(f'auto: release f1db {latest} — standings, pit-lane, griglie aggiornate (ondata 2)')
    return True


def _bandiere_testo():
    p = os.path.join(ROOT, 'demo', 'data', 'bandiere.json')
    try:
        ba = json.load(open(p))
    except OSError:
        return ''
    if not ba:
        return ''
    return '\n\nBandiere (pubblicate lo stesso, da correggere a valle):\n' + \
        '\n'.join(f'  - {g}: {"; ".join(v)}' for g, v in ba.items())


if __name__ == '__main__':
    log(f'avvio {"[DRY-RUN] " if DRY else ""}{"[PUSH] " if PUSH else ""}')
    fatto1 = wave_nuove()
    fatto2 = wave_f1db()
    if not (fatto1 or fatto2):
        log('niente da fare: demo allineata.')
