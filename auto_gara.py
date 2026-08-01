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


def sh(cmd, check=True, cwd=None):
    """Esegue un comando (lista). In dry-run lo stampa e basta.

    `cwd` serve ai passi che vivono in una sottocartella con la propria radice: il
    simulatore risolve i suoi percorsi da se' (dirname(import.meta.url)/..), quindi va
    lanciato da li' dentro. Default invariato: ROOT.
    """
    if DRY:
        log(f'DRY  {" ".join(cmd)}' + (f'   [in {cwd}]' if cwd else ''))
        return 0
    r = subprocess.run(cmd, cwd=cwd or ROOT)
    if check and r.returncode != 0:
        sys.exit(f'[auto] FERMO: comando fallito ({r.returncode}): {" ".join(cmd)}')
    return r.returncode


def raw_head_sess(ti, sess):
    # NOTA (25/07/2026): anche `sess` va quotato. Senza, 'Practice 1' e
    # 'Sprint Qualifying' (con lo spazio) alzavano InvalidURL, che l'except
    # qui sotto trasformava in "sessione non online": le ondate libere e
    # sprint non hanno MAI pubblicato nulla da sole. 'Race'/'Qualifying' non
    # hanno spazi, e infatti erano le uniche a funzionare.
    url = (f'https://raw.githubusercontent.com/TracingInsights/2026/main/'
           f'{urllib.parse.quote(ti)}/{urllib.parse.quote(sess)}/session_laptimes.json')
    req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'muretto'})
    try:
        urllib.request.urlopen(req, timeout=30); return True
    except Exception:
        return False


def raw_head(ti):
    return raw_head_sess(ti, 'Race')


# I golden del ciclo. test_live_bylap.mjs e' entrato il 22/07/2026 insieme al muretto in
# diretta: sorveglia il CAVO LIVE (flusso del collettore -> struttura del motore) contro la
# gara di Spa ricostruita dai dati ufficiali. Sta qui e non altrove perche' i suoi guasti
# sono silenziosi — quando il cavo sbaglia il pannello non si rompe, risponde col numero
# peggiore — e perche' le tabelle che legge (pit-loss di circuito, raggruppamento) le
# riscrive questo stesso ciclo dopo ogni gara.
GOLDEN = [('test_b.mjs', None), ('test_pit.mjs', 'demo'), ('test_live_bylap.mjs', 'demo')]


def golden():
    """True se i golden passano. In dry-run assume verde (non esegue)."""
    nomi = ', '.join(n for n, _ in GOLDEN)
    if DRY:
        log(f'DRY  golden ({nomi}) — assunti verdi'); return True
    ok = True
    for nome, sub in GOLDEN:
        cwd = os.path.join(ROOT, sub) if sub else ROOT
        if subprocess.run(['node', nome], cwd=cwd).returncode != 0:
            log(f'     golden ROTTO: {nome}')
            ok = False
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
def registro_committato():
    """Il registro COME STA IN GIT, non come sta sul disco.

    LA GARA ORFANA — il guasto che questa funzione chiude. `pipeline_gara.pubblica()`
    scrive la gara in data/gare_registro.json PRIMA che il giro finisca. Se un passo
    successivo falliva (gen_foto e gen_grids vanno in rete, quindi succede), il processo
    moriva prima di commit_push: la gara restava scritta sul disco, mai committata, mai
    online — e al giro dopo `gia_dentro` la leggeva dal disco e la SALTAVA PER SEMPRE.
    Nessun errore, nessuna bandiera: una gara semplicemente non esisteva piu'.

    Leggere il registro da HEAD sposta la definizione di "fatta" da «scritta» a
    «committata», che e' l'unica che conta: se il commit non c'e', il lavoro va rifatto.
    I generatori sono idempotenti, quindi rifarlo e' gratis.
    """
    try:
        out = subprocess.run(['git', 'show', f'HEAD:{REGISTRO}'], cwd=ROOT,
                             capture_output=True, text=True, timeout=30)
        if out.returncode != 0:
            return None
        return json.loads(out.stdout)
    except Exception:
        return None


def _controlla_pista_nuova(nome):
    """Una pista che il motore non ha mai visto ha bisogno di UNA riga in una mappa
    scritta a mano (provenienza/pitloss.mjs, GP_PER_GARA). Se manca, il motore NON
    si lamenta: usa il pit-loss di ripiego e dichiara all'utente «circuito non
    misurato ne' dal prior ne' dal fondo» — una frase che e' FALSA ogni volta che
    il fondo quel Gran Premio lo misura davvero.

    E' successo con l'Olanda il 01/08/2026: Zandvoort era misurato sul fondo (22,382
    s su 85 soste verdi) e promosso, e sarebbe stato ignorato per una riga mancante.

    Qui non si indovina la traduzione — inventarla sarebbe peggio del buco. Si
    GRIDA, perche' questo e' l'unico momento in cui qualcuno sta guardando.
    """
    fonte = os.path.join(ROOT, 'simulatore', 'provenienza', 'pitloss.mjs')
    try:
        with open(fonte, encoding='utf-8') as f:
            mappa = f.read()
    except Exception:
        return
    chiave = nome.replace(' ', '')
    if f'{chiave}:' in mappa or f"'{chiave}'" in mappa:
        return
    log(f'ATTENZIONE — PISTA NUOVA SENZA TRADUZIONE: "{nome}" non compare in '
        f'simulatore/provenienza/pitloss.mjs (GP_PER_GARA). Il motore usera\' il '
        f'pit-loss di RIPIEGO e dichiarera\' di non conoscere il circuito. Se il fondo '
        f'ha quel Gran Premio, quella frase e\' falsa e il dato buono si sta buttando '
        f'via: aggiungere la riga PRIMA che la gara vada online.')


def _holdout_aperto(nome_gara):
    """Vero se esiste un sigillo APERTO proprio sulla gara appena pubblicata.

    Un sigillo su un'ALTRA gara non ferma niente: se il sigillo e' su Zandvoort e
    corre Monza, ri-stimare e' giusto e Zandvoort resta comunque fuori campione
    perche' e' gia' stata misurata (o perche' il suo sigillo e' ancora chiuso a
    quella gara). La guardia deve essere stretta, o diventa un blocco permanente
    che qualcuno togliera' per fastidio.
    """
    percorso = os.path.join(ROOT, 'ai_lab', 'confronto', 'SIGILLO_holdout.json')
    if not os.path.exists(percorso):
        return False
    try:
        with open(percorso, encoding='utf-8') as f:
            s = json.load(f)
    except Exception as e:                       # un sigillo illeggibile non e' un via libera
        log(f'SIGILLO illeggibile ({e}): mi comporto come se fosse APERTO.')
        return True
    if s.get('stato') != 'aperto':
        return False
    sigillata = (s.get('gara') or '').replace(' ', '').lower()
    return sigillata == (nome_gara or '').replace(' ', '').lower()


def _ristima_il_cuore():
    """Il cuore del simulatore, ri-stimato sul fondo aggiornato. Vedi il commento
    lungo nel chiamante per l'ordine, che e' vincolante."""
    sim = os.path.join(ROOT, 'simulatore')
    sh([PY, os.path.join('fisica', 'stima_v2.py'), '--data', _oggi()], cwd=sim, check=False)
    sh(['node', os.path.join('ai_lab', 'confronto', 'stima_rodaggio.mjs'), '--scrivi',
        '--data', _oggi()], check=False)
    sh(['node', 'banco/scrivi_banda_rientro.mjs'], cwd=sim, check=False)
    # I fattori di neutralizzazione, la persistenza del regime e la compressione
    # dei distacchi: misurati sul fondo, NON promossi (il loro cancello e' NULL,
    # vedi PREREG_neutralizzazione.md). Si ri-stimano lo stesso a ogni gara — e'
    # la regola: il DATO vive, il VERDETTO no. Il giorno in cui il cancello
    # passera', i numeri saranno gia' quelli della stagione in corso.
    sh(['node', 'provenienza/esporta_compressione_fondo.mjs', '--write'], cwd=sim, check=False)
    # NON genera_manifest.mjs: quello rigenera OGNI riga e benedirebbe in silenzio
    # qualunque cosa sia cambiata sotto data/, archivio grezzo compreso — e'
    # dichiarato "atto deliberato, mai in CI" e ha ragione. `ripinna` aggiorna i
    # due file che questo blocco ha appena riscritto ed ESCE 1 se qualunque altro
    # file pinnato e' cambiato.
    sh(['node', 'provenienza/ripinna.mjs',
        'data/modelli/modello_v2.json', 'data/modelli/banda_rientro.json',
        'data/viste/compressione_e_fattori_fondo.json'],
       cwd=sim, check=False)
    sh(['node', 'web/genera_vista_gara.mjs', '--sincronizza'], cwd=sim, check=False)
    sh(['node', 'web/trasporta_motore.mjs'], cwd=sim, check=False)
    # SORVEGLIANZA DEL RODAGGIO: rimisura il cancello coi parametri appena
    # ri-stimati. NON spegne niente — se una condizione pre-registrata cade, lo
    # grida nel log e la decisione resta di una persona che ha riletto
    # PREREG_rodaggio.md. Un cancello che si rigira da solo smette di esserlo.
    sh(['node', os.path.join('ai_lab', 'confronto', 'cancello_rodaggio.mjs')], check=False)


def wave_nuove():
    mappa = json.load(open(os.path.join(ROOT, MAPPA)))
    reg_disco = json.load(open(os.path.join(ROOT, REGISTRO)))
    reg_git = registro_committato()
    if reg_git is None:
        # senza git non si puo' distinguere: si tiene il comportamento vecchio, ma si dice
        log('ATTENZIONE: registro di HEAD illeggibile, uso quello su disco '
            '(una gara pubblicata e non committata verrebbe saltata)')
        reg = reg_disco
    else:
        reg = reg_git
        orfane = set(reg_disco) - set(reg_git)
        if orfane:
            log(f'RIPRENDO {len(orfane)} gara/e pubblicata/e ma MAI COMMITTATA/E: '
                f'{sorted(orfane)}')
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
        _controlla_pista_nuova(nome)
        sh([PY, 'pipeline_gara.py', 'auto', nome, ti, cid])   # guardrail=bandiere
        # check=False su TUTTI i passi dopo la pubblicazione. Motivo: pipeline_gara ha
        # gia' scritto la gara nel registro, quindi un sys.exit qui lasciava una gara
        # pubblicata sul disco e mai committata (v. registro_committato). Adesso la ripresa
        # esiste, ma il rimedio giusto resta non morire: questi quattro passi rigenerano
        # viste e classifiche, e una vista mancante e' un guaio molto minore di una gara
        # che sparisce. Quello che NON puo' fallire in silenzio e' pipeline_gara (sopra,
        # check=True): li' c'e' il guardrail delle bandiere.
        sh([PY, 'aggiorna_ui.py', '--gara', nome], check=False)   # UI + griglie
        sh([PY, 'gen_race_control.py'], check=False)              # lista gare dal registro
        sh([PY, 'gen_rc_feed.py'], check=False)
        sh([PY, 'gen_classifiche_ufficiali.py'], check=False)
        # LA VISTA DEL SIMULATORE per la gara nuova. Senza questo passo il pannello
        # resterebbe muto proprio sulla gara appena pubblicata: la pagina non calcola
        # (regola 8 del simulatore), quindi se il pre-calcolo non gira non c'e' risposta.
        # check=False come i fratelli: una vista mancante e' un guaio minore di una gara
        # che non esce, e il log lo grida. ~2 minuti per gara.
        sh(['node', 'web/genera_vista_gara.mjs', nome], cwd=os.path.join(ROOT, 'simulatore'),
           check=False)
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
        sh([PY, 'gen_modelli_lab.py', '--data', _oggi()], check=False)   # la ricerca non ferma la gara
        # IL CUORE DEL SIMULATORE, dentro il ciclo (01/08/2026, direttiva del PO:
        # «quando si aggiunge una gara si deve aggiornare tutto e renderlo piu'
        # preciso, e vale per tutto il progetto»). Fino a oggi rho, delta70, la
        # banda di rientro e il rodaggio si stimavano A MANO: il motore restava
        # fermo alle 11 gare mentre tutto il resto cresceva.
        #
        # L'ORDINE NON E' CASUALE, e cambiarlo rompe cose:
        #   1. stima_v2      -> rho e delta70 dal fondo aggiornato. FONDE, non
        #                       sovrascrive: conserva delta_70.scelto, la decisione
        #                       pre-registrata e il blocco rodaggio. (Prima del
        #                       01/08 riscriveva con scelto=None e avrebbe ucciso
        #                       il costruttore la domenica notte.)
        #   2. stima_rodaggio-> c e tau, che si stimano CON rho e delta70 cablati:
        #                       quindi dopo il punto 1, mai prima. Non tocca
        #                       `attivo`: il dato si ri-stima, il verdetto no.
        #   3. banda_rientro -> si misura sul motore risultante, quindi dopo 1 e 2.
        #   4. viste         -> --sincronizza rigenera SOLO quelle il cui timbro non
        #                       e' piu' quello del motore. Se nessun coefficiente si
        #                       e' mosso costa secondi; se si e' mosso costa i ~45
        #                       minuti che ci vogliono, e li deve costare: la
        #                       sentinella s29 diventa rossa se non lo fa.
        #   5. trasporto     -> il motore nel browser porta le costanti: se il
        #                       modello cambia e il trasporto no, diretta e replay
        #                       divergono (E12).
        #
        # check=False su tutti, come il resto del blocco: la ricerca non ferma MAI
        # la pubblicazione di una gara. Se uno di questi fallisce, i golden e le
        # sentinelle lo gridano prima del commit.
        # ...MA NON MENTRE UN HOLDOUT E' SIGILLATO. Un fuori campione vive della
        # proprieta' opposta a questo blocco: i modelli non devono aver visto la
        # gara che li giudica. Senza questa guardia, la domenica sera in cui corre
        # Zandvoort l'automazione ri-stimerebbe PRIMA che qualcuno misuri
        # l'holdout, e il primo fuori campione vero del progetto si brucerebbe da
        # solo, in silenzio, e non si potrebbe rifare.
        # Il resto dell'ondata prosegue normale: si salta solo il cuore.
        if _holdout_aperto(nome):
            log(f'RI-STIMA SALTATA: {nome} e\' la gara sigillata di un holdout aperto '
                f'(ai_lab/confronto/SIGILLO_holdout.json). Prima si misura il fuori campione '
                f'coi modelli PRE-gara, poi si porta il sigillo a "chiuso" e dal giro dopo '
                f'la ri-stima riparte da sola.')
        else:
            _ristima_il_cuore()


        # IL BANCO DEL MOTORE, dentro il ciclo (22/07/2026). Era l'unico artefatto che
        # misura l'errore del PRODOTTO contro il reale, e stava FUORI: nessuno ricalcolava
        # a ogni gara quanto sbaglia il motore che il cliente usa. Ora il suo perimetro
        # viene dal registro e i coefficienti dai modelli vivi, quindi segue la stagione da
        # solo; e tiene una memoria (data/errore_motore_storico.json) con una regola
        # d'allarme dichiarata. DOPO gen_modelli_lab, perche' legge i coefficienti che
        # quello ha appena ricalibrato.
        sh(['node', 'gen_backtest_motore.mjs'], check=False)
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
        # REDAZIONE TECNICA — genera le BOZZE degli articoli dai rilevatori registrati.
        # Solo bozze nell'area Lab (ai_lab/redazione/bozze/): la pubblicazione resta un
        # gesto umano (coda.py --approva --attore). check=False e ogni rilevatore isolato:
        # i rilevatori telemetrici si auto-saltano se fastf1 non c'e' (es. VPS) o la
        # sessione non e' in cache. La redazione non ferma MAI la gara.
        sh([PY, os.path.join('ai_lab', 'redazione', 'genera.py'), '--gara', nome], check=False)
        # targhetta: ultima, cosi' vede tutto quello che e' stato appena rigenerato.
        sh([PY, 'gen_targhetta_lab.py'], check=False)
    if not golden():
        sys.exit('[auto] FERMO: golden falliti dopo l\'ondata 1 — niente commit, indagare.')
    ba = _bandiere_testo()
    commit_push('auto: pubblicate ' + ', '.join(n for _, n, _ in nuove)
                + ' (ondata 1: gara+UI+race control+ufficiali)' + ba)
    return True


# ------------------------------------------ ONDATA RIPARAZIONE: cio' che arriva tardi
# IL BUCO DELL'UNA-TANTUM (aperto fino al 26/07/2026). L'ondata 1 parte quando la gara
# compare su TracingInsights — poche ore dopo la bandiera a scacchi. Ma tre dei suoi passi
# non leggono TracingInsights: leggono FastF1, che a quell'ora spesso NON HA ANCORA i dati
# della gara appena finita. Girando con check=False fallivano in silenzio, e siccome
# `wave_nuove` salta le gare gia' nel registro, NESSUN giro successivo ci riprovava: quei
# tre artefatti restavano senza la gara PER SEMPRE.
#
# Successo davvero, per l'Ungheria (26/07/2026, ondata 1 alle 15:32 UTC): ufficiali_2026 e
# race_control_2026 si sono fermati al Belgio. Rilanciati a mano poche ore dopo hanno
# funzionato al primo colpo — non era un errore, era solo troppo presto.
#
# Questa ondata chiude il buco: a ogni giro guarda quali gare del registro MANCANO dagli
# artefatti derivati e rigenera solo quelli. Convergente invece che una-tantum.
#
# FINESTRA di 14 giorni sulla data di gara, e non un contatore di tentativi: e' senza stato
# (niente file da tenere allineato), copre con abbondanza il ritardo di f1db (5 giorni per
# il Belgio) e impedisce da sola il ciclo infinito su una gara che FastF1 non avra' mai.
# Una gara fuori finestra e ancora incompleta viene DETTA nel log, non ritentata in eterno.
FINESTRA_RIPARAZIONE = 14      # giorni dalla gara entro cui vale la pena riprovare

# (artefatto in demo/data, comandi che lo rigenerano). L'artefatto e' un dict con una
# chiave per gara: "manca" = la gara del registro non e' fra le sue chiavi.
RIPARAZIONI = [
    ('ufficiali_2026.json',    [['gen_classifiche_ufficiali.py']]),
    ('race_control_2026.json', [['gen_race_control.py'], ['gen_rc_feed.py']]),
    # grids: da quando ha il ripiego FastF1 non dipende piu' dalla release f1db, quindi
    # una griglia mancante e' riparabile lo stesso giorno (v. gen_grids.py).
    ('grids.json',             [['gen_grids.py']]),
]


def _date_gare():
    """gara -> data (date) dal calendario. {} se il calendario non si legge."""
    out = {}
    try:
        cal = json.load(open(os.path.join(ROOT, CALENDARIO)))
    except OSError:
        return out
    for g in cal.get('gare', []):
        nome, d = (g.get('nome') or g.get('gara_demo')), g.get('data')
        if not nome or not d:
            continue
        try:
            out[nome] = datetime.date.fromisoformat(d)
        except ValueError:
            pass
    return out


def _gare_mancanti(artefatto, gare):
    """Gare del registro assenti dalle chiavi dell'artefatto. [] se illeggibile: un file
    rotto o assente e' un guaio diverso, non lo si cura rilanciando generatori a raffica."""
    try:
        d = json.load(open(os.path.join(ROOT, 'demo', 'data', artefatto)))
    except (OSError, ValueError):
        log(f'ondata riparazione: {artefatto} illeggibile — non ci provo.')
        return []
    return [g for g in gare if g not in d]


def _classifiche_indietro():
    """La classifica e' ferma a una gara prima di quelle che sappiamo gia'?

    Serve perche' la CODA PROVVISORIA (punti_provvisori.py) ha un ingresso che spesso
    arriva tardi: `ufficiali_2026.json`. Nell'ondata 1 quel file fallisce quando FastF1 non
    ha ancora la gara, quindi `gen_classifiche` gira su una fonte senza la gara nuova e
    lascia la classifica al round prima. Riparare `ufficiali` senza rigenerare la classifica
    lascerebbe il dato buono sul disco e la pagina vecchia: la riparazione si fermerebbe a
    meta'. Qui si guarda il RISULTATO (a che gara e' aggiornata la classifica) invece dei
    passi, cosi' vale anche quando f1db resta indietro per giorni.
    """
    try:
        clas = json.load(open(os.path.join(ROOT, 'demo', 'data', 'classifiche_2026.json')))
        uff = json.load(open(os.path.join(ROOT, 'demo', 'data', 'ufficiali_2026.json')))
        cal = json.load(open(os.path.join(ROOT, CALENDARIO)))
    except (OSError, ValueError):
        return None
    round_di = {(g.get('nome') or g.get('gara_demo')): g.get('round') for g in cal.get('gare', [])}
    noti = [round_di[g] for g in uff if round_di.get(g) is not None]
    if not noti:
        return None
    piu_recente = max(noti)
    attuale = clas.get('aggiornato_al', {}).get('round')
    if attuale is None or attuale >= piu_recente:
        return None
    return (attuale, piu_recente)


def wave_riparazione():
    reg = registro_committato()
    if reg is None:
        try:
            reg = json.load(open(os.path.join(ROOT, REGISTRO)))
        except OSError:
            return False
    date = _date_gare()
    oggi = datetime.date.today()
    da_fare, fuori = [], []
    for artefatto, comandi in RIPARAZIONI:
        manca = _gare_mancanti(artefatto, reg)
        if not manca:
            continue
        # dentro la finestra? una gara senza data nel calendario si tenta (meglio un giro
        # in piu' che un artefatto muto)
        dentro = [g for g in manca
                  if g not in date or (oggi - date[g]).days <= FINESTRA_RIPARAZIONE]
        fuori += [(artefatto, g) for g in manca if g not in dentro]
        if dentro:
            da_fare.append((artefatto, comandi, dentro))
    for artefatto, g in fuori:
        log(f'ondata riparazione: {artefatto} senza {g} ma fuori finestra '
            f'({FINESTRA_RIPARAZIONE}gg) — NON ritento, va guardato a mano.')
    indietro = _classifiche_indietro()
    if not da_fare and not indietro:
        log('ondata riparazione: artefatti derivati completi.'); return False
    for artefatto, comandi, manca in da_fare:
        log(f'ondata riparazione: {artefatto} senza {manca} -> rigenero')
        for c in comandi:
            sh([PY, *c], check=False)
    # ricontrollo: si committa solo cio' che e' davvero rientrato, e si dice cosa no
    riparati, ancora = [], []
    for artefatto, _, manca in da_fare:
        resta = _gare_mancanti(artefatto, manca)
        riparati += [(artefatto, g) for g in manca if g not in resta]
        ancora += [(artefatto, g) for g in resta]
    for artefatto, g in ancora:
        log(f'ondata riparazione: {artefatto} ancora senza {g} — riprovo al prossimo giro.')
    # la classifica DOPO gli artefatti: la sua fonte (ufficiali_2026.json) potrebbe essere
    # appena rientrata qui sopra. gen_schede va sempre insieme a gen_classifiche — legge il
    # file che quello scrive, e da solo resterebbe indietro di una gara.
    indietro = _classifiche_indietro()
    if indietro:
        log(f'ondata riparazione: classifica al round {indietro[0]} ma sappiamo gia\' il '
            f'{indietro[1]} -> rigenero classifiche e schede')
        sh([PY, 'gen_classifiche.py'], check=False)
        sh([PY, 'gen_schede.py'], check=False)
        dopo = _classifiche_indietro()
        if dopo:
            log(f'ondata riparazione: classifica ANCORA al round {dopo[0]} — '
                f'riprovo al prossimo giro.')
        else:
            riparati.append(('classifiche_2026.json', f'round {indietro[1]}'))
    if not riparati:
        return False
    log(f'ondata riparazione: rientrati {len(riparati)} -> '
        + ', '.join(f'{a}:{g}' for a, g in riparati))
    commit_push('auto: riparazione artefatti derivati — '
                + ', '.join(f'{a} (+{g})' for a, g in riparati))
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


def _scrivi_pin(valore):
    """Scrive (o cancella, se valore e' None) data/f1db_release.txt."""
    p = os.path.join(ROOT, REL_FILE)
    if valore is None:
        try:
            os.remove(p)
        except OSError:
            pass
    else:
        open(p, 'w').write(valore)


def wave_f1db():
    """Release f1db nuova -> standings, schede, pit-lane, griglie.

    IL PIN CHE AVANZAVA ANCHE QUANDO IL LAVORO NON RIUSCIVA (corretto il 26/07/2026).
    Il pin e' l'INGRESSO dei generatori (f1db_zip lo legge per sapere quale release
    scaricare), quindi va scritto PRIMA di `aggiorna_ui`. Ma finiva scritto anche quando
    `aggiorna_ui` moriva: al giro dopo `latest == pinnata` e l'ondata 2 diceva "gia'
    aggiornata" — per sempre. Un singolo intoppo di rete su gen_foto avrebbe congelato
    classifica e schede pilota all'ultima release riuscita, in silenzio.

    Rimedio: il pin si RIAVVOLGE se il giro non arriva in fondo. Cosi' il suo significato
    torna a essere quello giusto — «la release da cui la UI e' stata davvero rigenerata» —
    e il giro successivo riprova da solo.
    """
    latest = _github_latest()
    if not latest:
        return False
    pinnata = _release_pinnata()
    if latest == pinnata:
        log(f'ondata 2: release f1db gia\' aggiornata ({pinnata}).'); return False
    log(f'ondata 2: nuova release f1db {latest} (pinnata {pinnata}) -> aggiorno pin e rigenero UI')
    if DRY:
        log(f'DRY  scrivo {REL_FILE} = {latest}')
        log(f'DRY  {PY} aggiorna_ui.py')
        log('DRY  golden — assunti verdi')
        log(f'DRY  git add -A && commit -m "auto: release f1db {latest} ..."'
            + (' && push' if PUSH else ''))
        return True
    try:
        prima = open(os.path.join(ROOT, REL_FILE)).read()
    except OSError:
        prima = None                       # il file non c'era: riavvolgere = cancellarlo
    _scrivi_pin(latest + '\n')
    # check=False: un passo di aggiorna_ui che fallisce (gen_foto va in rete) non deve
    # uccidere il processo — deve solo far riavvolgere il pin e riprovare al giro dopo.
    if sh([PY, 'aggiorna_ui.py'], check=False) != 0:
        _scrivi_pin(prima)
        log(f'ondata 2: aggiorna_ui fallito — pin riavvolto a {pinnata}, riprovo al prossimo giro.')
        return False
    if not golden():
        _scrivi_pin(prima)
        sys.exit('[auto] FERMO: golden falliti dopo l\'ondata 2 — pin riavvolto, niente commit, indagare.')
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
    # DOPO le due ondate principali: raccoglie quello che loro hanno lasciato indietro
    # (passi FastF1 falliti perche' troppo presto). Isolata come le altre: se si rompe,
    # gare e release sono gia' state pubblicate.
    try:
        fattor = wave_riparazione()
    except SystemExit:
        raise
    except Exception as e:
        log(f"ondata riparazione: errore ({e!r}) — gare e release gia gestite, proseguo.")
        fattor = False
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
    if not (fatto1 or fatto2 or fattor or fattoq or fattol or fattos):
        log('niente da fare: demo allineata.')
