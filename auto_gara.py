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
import datetime, json, os, subprocess, sys, urllib.request, urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable   # stesso interprete per i sotto-processi (propaga il venv attivo)
DRY = '--dry-run' in sys.argv
PUSH = '--push' in sys.argv
MAPPA = os.path.join('data', 'mappa_gare.json')
REGISTRO = os.path.join('data', 'gare_registro.json')
REL_FILE = os.path.join('data', 'f1db_release.txt')
CALENDARIO = os.path.join('demo', 'data', 'calendario_2026.json')


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


def raw_head_sess(ti, sess):
    url = (f'https://raw.githubusercontent.com/TracingInsights/2026/main/'
           f'{urllib.parse.quote(ti)}/{sess}/session_laptimes.json')
    req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'muretto'})
    try:
        urllib.request.urlopen(req, timeout=30); return True
    except Exception:
        return False


def raw_head(ti):
    return raw_head_sess(ti, 'Race')


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
        # file per-gara accessori, ex ORFANI: ora hanno un generatore con perimetro dal
        # registro, quindi la gara nuova entra da sola. Vanno DOPO la pubblicazione in
        # demo/ perche' gen_arrivi legge demo/data/esiti.json (e' li' che vive l'NP).
        # check=False di proposito: la guardia sta DENTRO il generatore, che se non
        # riproduce una cella congelata esce 1 SENZA scrivere — il file resta buono e il
        # log lo grida. Fermare la pubblicazione di una gara di domenica perche' TI ha
        # ritoccato una gara vecchia sarebbe il rimedio peggiore del male.
        sh([PY, 'gen_classifica_giro.py', '--write'], check=False)
        sh([PY, 'gen_arrivi.py', '--write'], check=False)
        # ------------------------------------------------------------------ LABORATORIO
        # Tutto quello che segue e' RICERCA: aggiorna DATI, non accende niente in
        # produzione, e gira con check=False perche' la ricerca non deve MAI fermare la
        # pubblicazione di una gara. Regola che vale per tutto il blocco: si aggiorna il
        # DATO a ogni gara; il VERDETTO di un KPI pre-registrato NON si rigira qui — per
        # quello ci sono le sorveglianze in fondo, che contano e tacciono.
        # Percio' i generatori dei cancelli (gen_cancello_*.py) NON sono in questa lista.
        #
        # modelli vivi: si ricalibrano da soli sul fondo aggiornato, con targhetta.
        sh([PY, 'gen_modelli_lab.py', '--data', _oggi()])
        # climatologia e bande: deterministici, senza rete, secondi. Ognuno si
        # auto-verifica riproducibile prima di riscriversi. bande_demo DOPO climatologia
        # perche' ne deriva, e prende la mappa gara->cid dal registro.
        sh([PY, 'gen_climatologia_degrado.py', '--write'], check=False)
        sh([PY, 'gen_bande_demo.py', '--write'], check=False)
        # Fase B (magnitudine e copertura degli scenari) e stabilita' della partizione:
        # emettono un verdetto MECCANICO contro soglie congelate; quello strategico resta
        # del PO, e nessuno di questi accende alcunche'.
        sh([PY, 'gen_faseb_magnitudine.py', '--write'], check=False)
        sh([PY, 'gen_faseb2_copertura.py', '--write'], check=False)
        sh([PY, 'gen_stabilita_partizione.py'], check=False)
        # analisi neutralizzazione a due livelli: inventario derivato dal registro, quindi
        # la gara nuova entra da sola. Non tocca la produzione (gen_neutralizzazione.py).
        sh([PY, 'gen_neutralizzazione_v2.py'], check=False)
        # pit-loss realizzato per-gara (FF5): usa FastF1, quindi RETE. Idempotente.
        # Tempistica da sapere: events_for scarta le gare con data >= oggi, quindi la gara
        # entra IL GIORNO DOPO; rieseguirlo il lunedi' la prende. ~8 minuti a cache calda.
        sh([PY, 'gen_pitloss_pergara.py'], check=False)
        # catena undercut: la gomma per-gara si estende da sola (niente piu' fallback alla
        # mediana per la gara nuova) e il censimento dei casi cresce di una gara.
        # Una gara bagnata fa uscire conta_undercut con un messaggio: e' normale.
        sh([PY, 'gen_degrado_gamma.py', '--write'], check=False)
        sh([PY, 'conta_undercut.py', '--gara', nome], check=False)
        # SORVEGLIANZE — il modo giusto di far vivere un sigillo: il dato si aggiorna a
        # ogni gara, il verdetto si rivaluta UNA VOLTA quando il cancello dichiarato prima
        # si apre. Non rigirano nessun test, non toccano niente di congelato, tacciono se
        # non e' cambiato nulla.
        sh([PY, 'undercut_sorveglianza.py'], check=False)
        sh([PY, os.path.join('ai_lab', 'scienziato', 'sorveglianza.py')], check=False)
        # targhetta: ultima, cosi' vede tutto quello che e' stato appena rigenerato.
        sh([PY, 'gen_targhetta_lab.py'], check=False)
    if not golden():
        sys.exit('[auto] FERMO: golden falliti dopo l\'ondata 1 — niente commit, indagare.')
    ba = _bandiere_testo()
    commit_push('auto: pubblicate ' + ', '.join(n for _, n, _ in nuove)
                + ' (ondata 1: gara+UI+race control+ufficiali)' + ba)
    return True


# --------------------------------------------- ONDATA QUALI: qualifica nuova
# Stessa logica delle gare, stessa fonte (TracingInsights raw su GitHub, VPS-ok):
# quando la sessione Qualifying di un GP e' online e non l'abbiamo ancora
# pubblicata, gen_quali_ti.py la trasforma in demo/data/quali_<gara>.json e
# aggiorna il manifest. NON tocca il motore: nessun golden qui (sono dati di
# classifica, non simulazione). Idempotente: gia' pubblicate -> salta.
def _quali_gia_pubblicate():
    p = os.path.join(ROOT, 'demo', 'data', 'quali_manifest.json')
    try:
        man = json.load(open(p))
    except OSError:
        return set()
    return {v.get('gara') for v in man.get('disponibili', [])}


def wave_quali():
    mappa = json.load(open(os.path.join(ROOT, MAPPA)))
    gia = _quali_gia_pubblicate()
    nuove = []
    for ti, m in mappa.items():
        if m['nome'] in gia:
            continue
        if raw_head_sess(ti, 'Qualifying'):
            nuove.append((ti, m['nome'], m.get('titolo', m['nome'])))
    if not nuove:
        log('ondata quali: nessuna qualifica nuova online.'); return False
    log(f'ondata quali: qualifiche nuove -> {[n for _, n, _ in nuove]}')
    prodotte = []
    for ti, nome, titolo in nuove:
        # check=False: una sessione ancora parziale esce non-zero senza scrivere,
        # e riproveremo al prossimo giro (mai una quali a meta').
        rc = sh([PY, 'gen_quali_ti.py', '--gara', nome, '--ti', ti,
                 '--evento', titolo], check=False)
        if rc == 0:
            prodotte.append(nome)
    if not prodotte:
        log('ondata quali: sessioni ancora parziali, riprovo al prossimo giro.'); return False
    commit_push('auto: qualifiche pubblicate ' + ', '.join(prodotte)
                + ' (fonte TracingInsights)')
    return True


# --------------------------------------------- ONDATA LIBERE: prove libere
# Stessa fonte delle gare/quali (TracingInsights). Le libere sono tre sessioni
# (FP1/FP2/FP3) che compaiono in momenti diversi: il file cresce nel weekend.
# BOUNDED: si processa solo il GP del weekend in corso (finestra di date dal
# calendario), non tutti i 22 -> poche richieste. Isolata: non tocca gare/quali.
# Idempotente: rigenera dallo stato attuale di TI, commit solo se cambia.
def _gp_weekend_corrente():
    try:
        cal = json.load(open(os.path.join(ROOT, CALENDARIO)))
        mappa = json.load(open(os.path.join(ROOT, MAPPA)))
    except OSError:
        return []
    nome2ti = {m['nome']: (ti, m.get('titolo', m['nome']))
               for ti, m in mappa.items()}
    oggi = datetime.date.today()
    out = []
    for g in cal.get('gare', []):
        nome = g.get('nome') or g.get('gara_demo')
        d = g.get('data')
        if not d or nome not in nome2ti:
            continue
        try:
            gd = datetime.date.fromisoformat(d)
        except ValueError:
            continue
        if -3 <= (oggi - gd).days <= 2:      # dal giovedi al lunedi del weekend
            ti, titolo = nome2ti[nome]
            out.append((ti, nome, titolo))
    return out


def wave_libere():
    correnti = _gp_weekend_corrente()
    if not correnti:
        log('ondata libere: nessun weekend in corso.'); return False
    prodotte = []
    for ti, nome, titolo in correnti:
        if not raw_head_sess(ti, 'Practice 1'):   # nessuna libera ancora online
            continue
        rc = sh([PY, 'gen_libere_ti.py', '--gara', nome, '--ti', ti,
                 '--evento', titolo], check=False)
        if rc == 0:
            prodotte.append(nome)
    if not prodotte:
        log('ondata libere: nessuna sessione utile online.'); return False
    commit_push('auto: prove libere aggiornate ' + ', '.join(prodotte)
                + ' (fonte TracingInsights)')
    return True


# --------------------------------------------- ONDATA SPRINT: weekend sprint
# Come le libere ma per le sessioni "Sprint Qualifying" e "Sprint": esiste solo
# nei weekend sprint (le cartelle mancano negli altri -> raw_head salta).
# Bounded al weekend in corso, isolata dopo gare/quali/libere.
def wave_sprint():
    correnti = _gp_weekend_corrente()
    if not correnti:
        log('ondata sprint: nessun weekend in corso.'); return False
    prodotte = []
    for ti, nome, titolo in correnti:
        if not raw_head_sess(ti, 'Sprint Qualifying'):   # non e' un weekend sprint
            continue
        rc = sh([PY, 'gen_sprint_ti.py', '--gara', nome, '--ti', ti,
                 '--evento', titolo], check=False)
        if rc == 0:
            prodotte.append(nome)
    if not prodotte:
        log('ondata sprint: nessuna sessione sprint online (weekend non-sprint).')
        return False
    commit_push('auto: sprint aggiornato ' + ', '.join(prodotte)
                + ' (fonte TracingInsights)')
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


def _oggi():
    """Data della ricalibrazione per la targhetta dei modelli del laboratorio."""
    import datetime
    return datetime.date.today().isoformat()


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
    # Gare PRIME (automazione provata, prioritaria). Le qualifiche DOPO e
    # isolate: un errore sulle quali non deve mai fermare le gare.
    fatto1 = wave_nuove()
    fatto2 = wave_f1db()
    try:
        fattoq = wave_quali()
    except SystemExit:
        raise
    except Exception as e:
        log(f"ondata quali: errore ({e!r}) — le gare sono gia state gestite, proseguo.")
        fattoq = False
    try:
        fattol = wave_libere()
    except SystemExit:
        raise
    except Exception as e:
        log(f"ondata libere: errore ({e!r}) — gare e quali gia gestite, proseguo.")
        fattol = False
    try:
        fattos = wave_sprint()
    except SystemExit:
        raise
    except Exception as e:
        log(f"ondata sprint: errore ({e!r}) — resto gia gestito, proseguo.")
        fattos = False
    if not (fatto1 or fatto2 or fattoq or fattol or fattos):
        log('niente da fare: demo allineata.')
