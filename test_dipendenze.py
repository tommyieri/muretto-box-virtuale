#!/usr/bin/env python3
"""test_dipendenze.py — le librerie che il codice VIVO importa, contro quelle DICHIARATE.

IL GUASTO CHE CHIUDE, e non e' un'ipotesi. Il 10/08/2026 la redazione e' passata dal Mac
al VPS: e' passato il codice, non le librerie che qualcuno mesi prima aveva installato a
mano. `ai_lab/redazione/fia_cp.py::_apri_pdf` importa `pdfplumber`; sul Mac c'era, in
`.venv-auto` no. L'import e' dentro la funzione APPOSTA — «se manca, stato, non crash» —
quindi il canale non e' esploso: si e' chiuso, dicendolo, sei volte di fila, e l'anteprima
FIA del GP d'Olanda non e' uscita col PDF gia' in cache dalle 08:15. Non esisteva un file
di requirements, quindi non c'era NIENTE da confrontare: nessuno poteva accorgersene prima
che il weekend cominciasse.

    FIA: CANCELLO IDENTITA' CHIUSO — dipendenza assente: pdfplumber. NON pubblico

DUE CONTROLLI, PERCHE' I GUASTI SONO DUE E STANNO IN POSTI DIVERSI.

  (statico, questa sentinella — gira nel repo, senza rete e senza le librerie installate)
      un import NUOVO nel codice vivo che nessun file dichiara. E' il difetto che nasce
      il giorno in cui si scrive `import qualcosa`, mesi prima di fare danno.

  (a macchina, `--ambiente <nome>` — lo lanciano i wrapper di cron col LORO python)
      una dipendenza dichiarata che su QUESTA macchina non c'e', o c'e' con un'altra
      versione. E' il difetto del 10/08, e nessun controllo dentro il repo lo puo' vedere:
      il repo e' identico sulle due macchine, e' l'ambiente a essere diverso.

L'ELENCO DEI MODULI VIVI SI CALCOLA, NON SI SCRIVE. Un elenco a mano invecchia al primo
generatore nuovo e allora dichiara una copertura che non ha — e' la stessa ragione per cui
`demo/test_lingua.mjs::raggiungibili()` calcola i moduli JS raggiungibili invece di
elencarli. Qui si parte dai LANCIATORI (la crontab del VPS, l'unit systemd del collettore,
la crontab del Mac, il workflow della CI) e si cammina sul grafo: import locali risolti a
file del repo, piu' gli script invocati per nome — perche' in questo repo `auto_gara.py`
non importa i generatori, li lancia come sottoprocessi, e un grafo che guardasse i soli
`import` vedrebbe due file su cento.

QUELLO CHE QUESTA SENTINELLA NON FA. Non apre una rete, non installa niente, non decide se
una versione e' quella giusta: pinnare e' una decisione umana, e le versioni di oggi sono
quelle in produzione oggi. Guarda che cio' che il codice chiede e cio' che il repo dichiara
siano la stessa lista, e che le quattro librerie numeriche portino la STESSA versione su
tutte le macchine — perche' su quella riposa l'invariante di riproducibilita' del pace
dichiarato in scheduling/README.md.

Uso:
    python3 test_dipendenze.py                 # la sentinella (verifica 14)
    python3 test_dipendenze.py --censimento    # chi importa che cosa, ambiente per ambiente
    python3 test_dipendenze.py --ambiente auto # dichiarate vs installate in QUESTO python
"""

from __future__ import annotations

import argparse
import ast
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# ─────────────────────────────────────────────────────────────── GLI AMBIENTI, DICHIARATI
#
# Un ambiente e' una venv che esiste davvero su una macchina, non un raggruppamento
# logico. Le RADICI non stanno qui: stanno nei `lanciatori`, cioe' nei file che quella
# macchina esegue per davvero. Se domani la crontab del VPS guadagna una riga, il
# censimento la segue da solo; se qualcuno rinomina uno script, il controllo (G) qui sotto
# se ne accorge invece di restare muto su un ambiente diventato vuoto.
#
# UN EFFETTO COLLATERALE DICHIARATO: `auto_run.sh` lancia questo file, quindi questo file
# entra nel grafo di `auto` — e i nomi qui sotto, che sono una DICHIARAZIONE, vengono letti
# come invocazioni. Cosi' `sentinella.py` e le sue tre sentinelle Python risultano vive
# anche in `auto`, dove nessuno le esegue. Non e' stato corretto perche' la cura costerebbe
# una regola in piu' per riparare un errore che non sposta niente: quei moduli non importano
# nulla di terze parti, e sbagliare per ECCESSO su un elenco di dipendenze non fa mancare
# una libreria a nessuno. E' scritto qui perche' chi legge `--censimento` non ci ragioni
# sopra mezz'ora.
AMBIENTI = {
    'auto': {
        'dove': '.venv-auto sul VPS (167.233.236.186) — gare e redazione',
        'file': 'requirements-auto.txt',
        'lanciatori': ['scheduling/vps.cron'],
    },
    'live': {
        'dove': '.venv-live sul VPS — collettore del live timing',
        'file': 'live/collector/requirements.txt',
        'lanciatori': ['live/collector/muretto-live.service'],
    },
    'banco': {
        'dove': 'il python3 di sistema: il Mac (telemetria, sentinella) e il runner CI',
        'file': 'requirements-banco.txt',
        'lanciatori': ['scheduling/auto_tele.cron', '.github/workflows/banco.yml',
                       'sentinella.py'],
    },
}

# LE QUATTRO CHE NON POSSONO DIVERGERE. `scheduling/README.md` dichiara che il pace e'
# bit-riproducibile fra Mac e VPS («test_b.py sul VPS da max diff 4.26e-12, identico al
# Mac»): quell'affermazione riposa su queste, e su nient'altro. Se un giorno una macchina
# prendesse un numpy diverso, i golden resterebbero verdi sul JS e i dati pubblicati
# cambierebbero all'ultima cifra senza che niente lo dica.
NUMERICHE = ('fastf1', 'numpy', 'pandas', 'scipy')

# IL NOME CHE SI IMPORTA NON E' SEMPRE IL NOME CHE SI INSTALLA. La tabella e' a mano —
# non c'e' modo di derivarla senza avere i pacchetti installati, e questa sentinella deve
# girare anche dove non lo sono (il runner CI installa solo numpy). E' pero' sorvegliata:
# il controllo (E) esce 1 su una voce che non serve piu' a nessuno, cosi' non diventa un
# elenco di condoni ereditati.
NOMI = {
    'PIL': 'pillow',
    'paho': 'paho-mqtt',
}

# I due marcatori di sezione dentro un file di requirements. Servono a distinguere cio'
# che il NOSTRO codice nomina da cio' che si tira dietro: solo le prime due domande
# ((C) e (D)) hanno senso sulle dirette, e una transitiva dichiarata «morta» sarebbe un
# falso rosso a ogni giro.
MARCA_DIRETTE = '@dirette'
MARCA_TRANSITIVE = '@transitive'

ROSSO, VERDE, GIALLO, GRIGIO, FINE = '\033[31m', '\033[32m', '\033[33m', '\033[90m', '\033[0m'

_esiti: list[tuple[bool, str]] = []


def esito(ok: bool, msg: str) -> bool:
    _esiti.append((bool(ok), msg))
    print(f'  {VERDE}ok{FINE}   {msg}' if ok else f'  {ROSSO}NO{FINE}   {msg}')
    return bool(ok)


# ═══════════════════════════════════════════════════════ il grafo dei moduli Python vivi

def _tracciati() -> list[str]:
    """I .py del repo secondo git — non secondo il disco.

    `.agents/` e `.claude/` portano skill di terze parti committate: sono nel repo ma non
    sono questo progetto, e i loro import non descrivono nessuna nostra macchina.
    """
    out = subprocess.run(['git', 'ls-files', '*.py'], cwd=ROOT,
                         capture_output=True, text=True).stdout.split()
    return [p for p in out if not p.startswith(('.agents/', '.claude/'))]


PATHS = set(_tracciati())
PER_BASE: dict[str, list[str]] = {}
for _p in PATHS:
    PER_BASE.setdefault(os.path.basename(_p), []).append(_p)
CARTELLE = {p.split('/')[0] for p in PATHS if '/' in p}
MODULI_LOCALI = {os.path.basename(p)[:-3] for p in PATHS}


def _albero(rel: str):
    try:
        return ast.parse((ROOT / rel).read_text(errors='replace'))
    except (SyntaxError, OSError):
        return None


def _letterale(n, costanti: dict[str, str]):
    """`os.path.join('a', 'b')` -> `'a/b'`, quando tutte le parti si sanno leggere.

    Serve a capire quali cartelle un modulo si aggiunge a `sys.path`: in questo repo e'
    la forma normale di importare (`auto_articoli.py` si mette in path
    `ai_lab/redazione`, e da li' `import genera_weekend` significa un file preciso).
    Senza, l'unico modo di risolvere quel nome sarebbe indovinarlo dal basename — e i
    basename qui si ripetono: `coda.py` esiste sia in redazione sia in social.
    """
    if isinstance(n, ast.Constant) and isinstance(n.value, str):
        return n.value
    if isinstance(n, ast.Name):
        return costanti.get(n.id)
    if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == 'join':
        parti = [_letterale(a, costanti) for a in n.args]
        if parti and all(p is not None for p in parti):
            return os.path.join(*parti)
    return None


def _cartelle_syspath(a: ast.AST, rel: str) -> list[str]:
    costanti: dict[str, str] = {}
    for n in ast.walk(a):
        if isinstance(n, ast.Assign) and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name):
            v = _letterale(n.value, costanti)
            if v:
                costanti[n.targets[0].id] = v
    fuori = []
    for n in ast.walk(a):
        if (isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute)
                and n.func.attr in ('insert', 'append')
                and isinstance(n.func.value, ast.Attribute) and n.func.value.attr == 'path'):
            v = _letterale(n.args[-1], costanti) if n.args else None
            if not v:
                continue
            for base in (Path(rel).parent, Path('.')):
                c = os.path.normpath(str(base / v)).lstrip('./')
                if (ROOT / c).is_dir():
                    fuori.append(c)
    return fuori


def _risolvi(nome: str, rel: str, dirs: list[str]) -> set[str]:
    """Un nome di modulo -> i file del repo che puo' essere, a scaletta.

    L'ordine e' quello che vede l'interprete: prima la cartella del file che importa, poi
    quelle che quel file si e' aggiunto a `sys.path`, poi la radice. L'ultimo gradino
    (basename unico in tutto il repo) accetta solo se non c'e' ambiguita': con due
    candidati la risposta giusta e' «non lo so», non «prendine uno».
    """
    parti = nome.split('.')
    scale: list[list[str] | None] = [[str(Path(rel).parent)], dirs, ['.'], None]
    for scala in scale:
        trovati: set[str] = set()
        if scala is None:
            cands = PER_BASE.get(parti[-1] + '.py', [])
            if len(cands) == 1:
                trovati.add(cands[0])
        else:
            for d in scala:
                for cand in (os.path.normpath(os.path.join(d, *parti) + '.py'),
                             os.path.normpath(os.path.join(d, *parti, '__init__.py'))):
                    if cand in PATHS:
                        trovati.add(cand)
        if trovati:
            return trovati
    return set()


def _script_invocati(a: ast.AST, rel: str) -> set[str]:
    """Gli script che questo modulo LANCIA, letti dalle stringhe letterali.

    `auto_gara.py` non importa i generatori: fa `sh([PY, 'gen_giri.py', '--gara', nome])`.
    Un grafo di soli `import` vedrebbe due file su cento, quindi le stringhe vanno lette —
    ma solo quelle che sono davvero un argomento, e qui stanno le due trappole:

      · I COMMENTI NON CONTANO, e `ast` li ha gia' buttati. Le DOCSTRING no: sono nodi
        veri, e in questo repo raccontano la pipeline per nome. Si escludono a mano.
      · UNA FRASE NON E' UN PERCORSO. `print("... lancia python3 live/estrai_riferimenti.py")`
        finisce in `.py` come un argomento vero. Un argomento di sottoprocesso non ha
        spazi dentro: e' l'unico segno che separa un'invocazione da un consiglio a chi
        legge il log, e senza di lui il grafo si gonfia di moduli che nessuno esegue.
      · UN BASENAME AMBIGUO NON E' UNA RISPOSTA, ed e' il difetto che questa sentinella
        si e' trovata addosso da sola: `sentinella.py` lancia `test_dipendenze.py`, quindi
        appena questo file e' diventato tracciato e' entrato nel proprio grafo — e la riga
        `os.path.join(d, *parti, '__init__.py')` qui sopra ha fatto risolvere quel
        letterale a TUTTI gli `__init__.py` del repo, tirandosi dentro `ai_lab/social/`
        e il suo `PIL`. Con due candidati la risposta giusta e' «non lo so», ed e' gia'
        la regola di `_risolvi()`: qui era scritta al contrario.
        Il percorso vero, quando c'e', si legge dal `join` INTERO
        (`os.path.join('ai_lab', 'redazione', 'genera.py')` — dove il solo basename
        sarebbe ambiguo con quello di social), e per questo si guarda prima quello.
    """
    docstring = set()
    for n in ast.walk(a):
        if isinstance(n, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            primo = n.body[0] if n.body else None
            if (isinstance(primo, ast.Expr) and isinstance(primo.value, ast.Constant)
                    and isinstance(primo.value.value, str)):
                docstring.add(id(primo.value))
    out: set[str] = set()
    for n in ast.walk(a):                        # prima i percorsi interi: sono certi
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == 'join':
            v = _letterale(n, {})
            if v and os.path.normpath(v) in PATHS:
                out.add(os.path.normpath(v))
    for n in ast.walk(a):
        if not (isinstance(n, ast.Constant) and isinstance(n.value, str)):
            continue
        v = n.value
        if id(n) in docstring or not v.endswith('.py') or any(c.isspace() for c in v):
            continue
        if v in PATHS:
            out.add(v)
            continue
        cands = PER_BASE.get(os.path.basename(v), [])
        if len(cands) == 1:                      # ambiguo -> non si indovina, si tace
            out.add(cands[0])
    return out


def vicini(rel: str) -> set[str]:
    a = _albero(rel)
    if a is None:
        return set()
    dirs = _cartelle_syspath(a, rel)
    out: set[str] = set()
    for n in ast.walk(a):
        if isinstance(n, ast.Import):
            for al in n.names:
                out |= _risolvi(al.name, rel, dirs)
        elif isinstance(n, ast.ImportFrom):
            mod = n.module or ''
            if n.level:                                  # import relativo: la base e' certa
                d = Path(rel).parent
                for _ in range(n.level - 1):
                    d = d.parent
                radice = str(d)
                pezzi = mod.split('.') if mod else []
                for cand in (os.path.normpath(os.path.join(radice, *pezzi) + '.py'),
                             os.path.normpath(os.path.join(radice, *pezzi, '__init__.py'))):
                    if cand in PATHS:
                        out.add(cand)
                for al in n.names:
                    cand = os.path.normpath(os.path.join(radice, *pezzi, al.name + '.py'))
                    if cand in PATHS:
                        out.add(cand)
            elif mod:
                out |= _risolvi(mod, rel, dirs)
                for al in n.names:                       # `from pacchetto import modulo`
                    out |= _risolvi(mod + '.' + al.name, rel, dirs)
    return out | _script_invocati(a, rel)


def raggiungibili(radici) -> set[str]:
    visti: set[str] = set()
    coda = list(radici)
    while coda:
        f = coda.pop()
        if f in visti:
            continue
        visti.add(f)
        for g in vicini(f):
            if g not in visti:
                coda.append(g)
    return visti


def esterni(rel: str) -> set[str]:
    """I moduli di terze parti importati da un file — a qualunque profondita'.

    Anche gli import PIGRI, quelli dentro una funzione o dentro un `try`: e' proprio li'
    che stava `pdfplumber`, ed e' proprio per questo che il guasto era silenzioso.
    """
    a = _albero(rel)
    if a is None:
        return set()
    out: set[str] = set()
    for n in ast.walk(a):
        nomi: list[str] = []
        if isinstance(n, ast.Import):
            nomi = [al.name.split('.')[0] for al in n.names]
        elif isinstance(n, ast.ImportFrom) and n.level == 0 and n.module:
            nomi = [n.module.split('.')[0]]
        for m in nomi:
            if (m in sys.stdlib_module_names or m in CARTELLE
                    or m in MODULI_LOCALI or m == '__future__'):
                continue
            out.add(m)
    return out


# ═══════════════════════════════════════════════════════════ i lanciatori e le loro radici

_COMMENTO = {'.cron': r'^\s*#', '.sh': r'^\s*#', '.service': r'^\s*#',
             '.py': None, '.yml': None}


def _righe_esecutive(rel: str) -> list[str]:
    """Le righe di un lanciatore che ESEGUONO qualcosa. Le altre raccontano.

    Ogni formato ha il suo modo di dire «questa riga non gira», e leggerle tutte
    significherebbe far entrare nel grafo ogni script mai nominato in un commento —
    `banco.yml` da solo ne cita una decina che non lancia.
    """
    testo = (ROOT / rel).read_text(errors='replace')
    suff = Path(rel).suffix
    if suff == '.yml':                       # GitHub Actions: gira solo cio' che sta in `run:`
        return re.findall(r'^\s*run:\s*(.*)$', testo, re.M)
    if suff == '.service':                   # systemd: gira solo ExecStart*/ExecStop*
        return re.findall(r'^\s*Exec\w*=(.*)$', testo, re.M)
    if suff == '.py':                        # un lanciatore che e' gia' un programma
        return [rel]
    return [r for r in testo.splitlines() if not re.match(r'^\s*#', r)]


def radici_di(lanciatori) -> tuple[set[str], list[str]]:
    """Dai lanciatori ai file .py da cui parte il grafo, passando per gli script di shell."""
    visti: set[str] = set()
    coda = list(lanciatori)
    radici: set[str] = set()
    muti: list[str] = []
    while coda:
        l = coda.pop()
        if l in visti:
            continue
        visti.add(l)
        if not (ROOT / l).exists():
            muti.append(l)
            continue
        if l.endswith('.py'):
            radici.add(l)
            continue
        trovato = False
        for riga in _righe_esecutive(l):
            for tok in re.findall(r'[\w./~$-]+\.(?:py|sh)\b', riga):
                nome = tok.split('/')[-1]
                for cand in PER_BASE.get(nome, []):
                    coda.append(cand)
                    trovato = True
                if not nome.endswith('.py'):
                    for c in (ROOT / 'scheduling' / nome, ROOT / nome):
                        if c.exists():
                            coda.append(str(c.relative_to(ROOT)))
                            trovato = True
        if not trovato and not l.endswith('.sh'):
            muti.append(l)
    return radici, muti


# ═══════════════════════════════════════════════════════════════ i file di requirements

def _norma(dist: str) -> str:
    return re.sub(r'[-_.]+', '-', dist).lower()


def leggi_requirements(rel: str):
    """-> (dirette{dist: versione}, transitive{dist: versione}, errori[])"""
    dirette: dict[str, str] = {}
    transitive: dict[str, str] = {}
    errori: list[str] = []
    if not (ROOT / rel).exists():
        return dirette, transitive, [f'{rel}: non esiste']
    sezione = None
    for i, riga in enumerate((ROOT / rel).read_text().splitlines(), 1):
        nudo = riga.strip()
        if nudo.startswith('#'):
            if MARCA_DIRETTE in nudo:
                sezione = dirette
            elif MARCA_TRANSITIVE in nudo:
                sezione = transitive
            continue
        if not nudo:
            continue
        m = re.fullmatch(r'([A-Za-z0-9][A-Za-z0-9._-]*)==([\w.+!-]+)', nudo)
        if not m:
            errori.append(f'{rel}:{i}: «{nudo}» non e\' una riga `nome==versione` pinnata')
            continue
        if sezione is None:
            errori.append(f'{rel}:{i}: «{nudo}» sta fuori da entrambe le sezioni '
                          f'({MARCA_DIRETTE} / {MARCA_TRANSITIVE})')
            continue
        dist = _norma(m.group(1))
        if dist in dirette or dist in transitive:
            errori.append(f'{rel}:{i}: «{dist}» dichiarata due volte')
        sezione[dist] = m.group(2)
    return dirette, transitive, errori


# ═══════════════════════════════════════════════════════════════════════ il censimento

def censimento():
    """-> {ambiente: {'moduli': [...], 'esterni': {modulo: [file...]}, 'muti': [...]}}"""
    out = {}
    for nome, cfg in AMBIENTI.items():
        radici, muti = radici_di(cfg['lanciatori'])
        vivi = raggiungibili(radici)
        tot: dict[str, list[str]] = {}
        for f in sorted(vivi):
            for m in esterni(f):
                tot.setdefault(m, []).append(f)
        out[nome] = {'radici': sorted(radici), 'moduli': sorted(vivi),
                     'esterni': tot, 'muti': muti}
    return out


# ═══════════════════════════════════════════════════════════ (2) dichiarate vs installate

def verifica_ambiente(nome: str) -> int:
    """Le dipendenze dichiarate esistono in QUESTO interprete? — il controllo del 10/08.

    Non importa niente: `importlib.metadata` legge i metadati installati. Importare
    davvero costerebbe secondi a ogni giro di cron (fastf1 si tira dietro matplotlib) e
    non risponderebbe a una domanda in piu' — a un import che fallisce per un motivo suo
    questo controllo non saprebbe comunque rispondere meglio di chi lo esegue.
    """
    from importlib import metadata

    cfg = AMBIENTI.get(nome)
    if cfg is None:
        print(f'ambiente sconosciuto: {nome} (noti: {", ".join(AMBIENTI)})', file=sys.stderr)
        return 2
    dirette, transitive, errori = leggi_requirements(cfg['file'])
    if errori:
        for e in errori:
            print(f'   !! {e}')
        return 2

    assenti, diverse = [], []
    for dist, atteso in sorted({**dirette, **transitive}.items()):
        try:
            avuto = metadata.version(dist)
        except metadata.PackageNotFoundError:
            assenti.append((dist, atteso, 'diretta' if dist in dirette else 'transitiva'))
            continue
        if _norma(avuto) != _norma(atteso):
            diverse.append((dist, atteso, avuto))

    quante = len(dirette) + len(transitive)
    if not assenti and not diverse:
        print(f'dipendenze [{nome}]: {quante}/{quante} presenti alla versione dichiarata '
              f'({cfg["file"]}, python {sys.version.split()[0]})')
        return 0
    print(f'dipendenze [{nome}]: {cfg["file"]} contro {sys.executable}')
    for dist, atteso, tipo in assenti:
        print(f'   !! ASSENTE       {dist}=={atteso} ({tipo}) — qui non c\'e\'.')
    for dist, atteso, avuto in diverse:
        print(f'   !! VERSIONE      {dist}: dichiarata {atteso}, installata {avuto}')
    if assenti:
        print('      installa con:  <python di questa macchina> -m pip install -r '
              + cfg['file'])
        print('      NON aggiornare le versioni per farlo passare: il pace e\' '
              'bit-riproducibile solo se le quattro numeriche restano queste.')
    return 1


# ═════════════════════════════════════════════════════════════════════════ la sentinella

def sentinella() -> int:
    cens = censimento()

    print(f'\n{GRIGIO}— gli ambienti e le loro radici{FINE}')
    for nome, dati in cens.items():
        cfg = AMBIENTI[nome]
        # (G) UN AMBIENTE VUOTO NON E' UN AMBIENTE PULITO. Se un lanciatore cambia nome o
        # sparisce, il grafo si svuota e ogni controllo qui sotto passerebbe per assenza
        # di domande: verde, e cieco. Questo e' il controllo che tiene in piedi gli altri.
        esito(bool(dati['radici']),
              f'[{nome}] {len(dati["radici"])} radici dai lanciatori '
              f'({", ".join(cfg["lanciatori"])}) -> {len(dati["moduli"])} moduli vivi')
        esito(not dati['muti'],
              f'[{nome}] ogni lanciatore dichiarato esiste ed esegue qualcosa'
              + (f' — muti: {", ".join(dati["muti"])}' if dati['muti'] else ''))

    print(f'\n{GRIGIO}— la forma dei file dichiarati{FINE}')
    letti = {}
    for nome, cfg in AMBIENTI.items():
        dirette, transitive, errori = leggi_requirements(cfg['file'])
        letti[nome] = (dirette, transitive)
        esito(not errori, f'[{nome}] {cfg["file"]}: {len(dirette)} dirette + '
                          f'{len(transitive)} transitive, tutte pinnate con =='
                          + (f' — {errori[0]}' if errori else ''))
        doppie = set(dirette) & set(transitive)
        esito(not doppie, f'[{nome}] nessuna dipendenza sta in tutt\'e due le sezioni'
                          + (f' — {", ".join(sorted(doppie))}' if doppie else ''))

    print(f'\n{GRIGIO}— quello che il codice vivo importa, e quello che il repo dichiara{FINE}')
    mappa_usata: set[str] = set()
    for nome, dati in cens.items():
        dirette, transitive = letti[nome]
        chiesti = {}
        for modulo, chi in dati['esterni'].items():
            if modulo in NOMI:
                mappa_usata.add(modulo)
            chiesti[_norma(NOMI.get(modulo, modulo))] = (modulo, chi)

        # (C) OGNI IMPORT HA UNA RIGA. E' il controllo che il 10/08 non esisteva: un
        # `import pdfplumber` nuovo in un file vivo esce rosso QUI, il giorno che si
        # scrive, e non a weekend cominciato con un canale che si chiude da solo.
        mancanti = sorted(d for d in chiesti if d not in dirette)
        esito(not mancanti,
              f'[{nome}] ogni libreria importata dal codice vivo e\' dichiarata fra le dirette'
              + (''.join(f'\n         MANCA {d} — la importa {chiesti[d][1][0]}'
                         + (f' (+{len(chiesti[d][1]) - 1})' if len(chiesti[d][1]) > 1 else '')
                         for d in mancanti) if mancanti else ''))

        # (D) E OGNI RIGA HA UN IMPORT. Una dichiarazione che nessuno usa piu' non fa
        # danno subito: fa credere che l'elenco sia stato letto di recente.
        morte = sorted(d for d in dirette if d not in chiesti)
        esito(not morte,
              f'[{nome}] nessuna diretta dichiarata che nessun modulo vivo importa'
              + (f' — {", ".join(morte)}' if morte else ''))

        # E le transitive non devono travestirsi da dirette: se il nostro codice la
        # nomina, quella riga sta nella sezione sbagliata e la (D) non la sorveglia piu'.
        travestite = sorted(d for d in transitive if d in chiesti)
        esito(not travestite,
              f'[{nome}] nessuna transitiva che il codice in realta\' importa per nome'
              + (f' — {", ".join(travestite)}' if travestite else ''))

    inutili = sorted(set(NOMI) - mappa_usata)
    esito(not inutili,
          'la tabella nome-importato -> nome-installato non ha voci che non servono piu\''
          + (f' — {", ".join(inutili)}' if inutili else ''))

    print(f'\n{GRIGIO}— l\'invariante che tiene: le quattro numeriche non divergono{FINE}')
    for lib in NUMERICHE:
        versioni = {}
        for nome, (dirette, transitive) in letti.items():
            v = dirette.get(lib) or transitive.get(lib)
            if v:
                versioni[nome] = v
        if not versioni:
            continue
        uniche = set(versioni.values())
        esito(len(uniche) == 1,
              f'{lib}: stessa versione su ogni macchina che la dichiara — '
              + ', '.join(f'{k} {v}' for k, v in sorted(versioni.items())))

    rossi = [m for ok, m in _esiti if not ok]
    print()
    if rossi:
        print(f'{ROSSO}sentinella dipendenze: {len(rossi)} su {len(_esiti)} ROSSE{FINE}')
        return 1
    print(f'{VERDE}sentinella dipendenze: tutto verde{FINE} ({len(_esiti)} controlli)')
    return 0


def stampa_censimento() -> int:
    cens = censimento()
    for nome, dati in cens.items():
        cfg = AMBIENTI[nome]
        print(f'\n=== {nome} — {cfg["dove"]}')
        print(f'    dichiarato in : {cfg["file"]}')
        print(f'    lanciatori    : {", ".join(cfg["lanciatori"])}')
        print(f'    radici        : {", ".join(dati["radici"])}')
        print(f'    moduli vivi   : {len(dati["moduli"])}')
        if dati['muti']:
            print(f'    !! muti       : {", ".join(dati["muti"])}')
        for m in sorted(dati['esterni']):
            chi = dati['esterni'][m]
            dist = NOMI.get(m, m)
            eti = f'{m} -> {dist}' if dist != m else m
            print(f'    {eti:24s} {len(chi):3d} moduli   es. {chi[0]}')
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--censimento', action='store_true',
                    help='stampa chi importa che cosa, ambiente per ambiente')
    ap.add_argument('--ambiente', metavar='NOME',
                    help='verifica che le dipendenze dichiarate siano installate QUI')
    a = ap.parse_args()
    if a.ambiente:
        return verifica_ambiente(a.ambiente)
    if a.censimento:
        return stampa_censimento()
    print(f'{GRIGIO}sentinella dipendenze — il codice vivo contro i file dichiarati{FINE}')
    return sentinella()


if __name__ == '__main__':
    sys.exit(main())
