#!/usr/bin/env python3
"""auto_tele.py — pubblica la TELEMETRIA di ogni sessione appena registrata.

Il pezzo mancante della catena "a ogni bandiera a scacchi": auto_gara.py (sul
VPS) pubblica tempi e settori da TracingInsights, ma la telemetria (velocita',
gas, freno del giro veloce) nasce dalle REGISTRAZIONI del collettore, che
`live/weekend_scheduler.py` salva SUL MAC in data/live_raw/. Il VPS quei file
non li ha: per questo la telemetria si fermava a Belgio/gara.

Cosa fa: guarda le registrazioni, capisce GP e sessione dal nome del file e
dalla data (calendario), salta quelle gia' pubblicate, chiama gen_tele.py e
committa. Idempotente: senza registrazioni nuove non fa nulla.

  python3 auto_tele.py              # genera + commit locale
  python3 auto_tele.py --push       # + push su main (deploy)
  python3 auto_tele.py --dry-run    # dice solo cosa farebbe

Pensato per girare a intervalli sul Mac (launchd/cron), come auto_gara.py sul VPS.
"""
import argparse
import datetime
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable
RAW_DIR = os.path.join(os.path.expanduser('~'), 'muretto', 'data', 'live_raw')
CALENDARIO = os.path.join(ROOT, 'demo', 'data', 'calendario_2026.json')
MANIFEST = os.path.join(ROOT, 'demo', 'data', 'tele_manifest.json')

# etichette del registratore (live/weekend_scheduler.py: NOMI) -> nome sessione
ETICHETTA = {
    'FP1': 'fp1', 'FP2': 'fp2', 'FP3': 'fp3',
    'SprintQuali': 'sprint_quali', 'Sprint': 'sprint',
    'Quali': 'qualifiche', 'GARA': 'gara',
}
# una registrazione sotto questa soglia e' un troncone (riavvio del collettore),
# non una sessione: il feed di una sessione vera pesa megabyte.
MIN_BYTE = 1_000_000


def log(m): print(f'[tele] {m}', flush=True)


def registrazioni():
    """[(sessione, data, path, byte)] dalle registrazioni utili."""
    if not os.path.isdir(RAW_DIR):
        log(f'nessuna cartella {RAW_DIR}'); return []
    out = []
    for nome in sorted(os.listdir(RAW_DIR)):
        m = re.match(r'^([A-Za-z][A-Za-z0-9]*)_(\d{4}-\d{2}-\d{2})_[\d-]+\.txt$', nome)
        if not m:
            continue                      # log, _part2, nomi non standard
        etich, giorno = m.group(1), m.group(2)
        if etich not in ETICHETTA:
            continue
        p = os.path.join(RAW_DIR, nome)
        b = os.path.getsize(p)
        if b < MIN_BYTE:
            continue                      # troncone
        out.append((ETICHETTA[etich], giorno, p, b))
    return out


def gp_del_giorno(cal, giorno):
    """Nome del GP il cui weekend contiene questa data (gara -3..+1 giorni)."""
    try:
        d = datetime.date.fromisoformat(giorno)
    except ValueError:
        return None, None
    for g in cal.get('gare', []):
        if not g.get('data'):
            continue
        try:
            gd = datetime.date.fromisoformat(g['data'])
        except ValueError:
            continue
        if -3 <= (d - gd).days <= 1:
            return (g.get('nome') or g.get('gara_demo')), (g.get('titolo') or g.get('nome'))
    return None, None


def gia_pubblicate():
    try:
        with open(MANIFEST, encoding='utf-8') as f:
            m = json.load(f)
    except OSError:
        return set()
    voci = m.get('disponibili', m) if isinstance(m, dict) else m
    return {(v.get('gara'), v.get('sessione')) for v in voci if isinstance(v, dict)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--push', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    try:
        with open(CALENDARIO, encoding='utf-8') as f:
            cal = json.load(f)
    except OSError as e:
        sys.exit(f'[tele] calendario illeggibile: {e}')

    fatte = gia_pubblicate()
    # a parita' di (gp, sessione) tengo la registrazione piu' grossa: e' quella
    # completa (il registratore riprova e lascia tronconi piu' piccoli)
    migliori = {}
    for sess, giorno, path, byte in registrazioni():
        gp, titolo = gp_del_giorno(cal, giorno)
        if not gp:
            log(f'salto {os.path.basename(path)}: nessun GP per il {giorno}')
            continue
        k = (gp, sess)
        if k not in migliori or byte > migliori[k][2]:
            migliori[k] = (path, titolo, byte)

    da_fare = [(gp, sess, v) for (gp, sess), v in sorted(migliori.items()) if (gp, sess) not in fatte]
    if not da_fare:
        log(f'niente di nuovo ({len(migliori)} sessioni registrate, tutte gia\' pubblicate).')
        return

    prodotte = []
    for gp, sess, (path, titolo, byte) in da_fare:
        log(f'{gp} {sess}  <-  {os.path.basename(path)} ({byte/1e6:.1f} MB)')
        cmd = [PY, 'gen_tele.py', path, '--gara', gp, '--sessione', sess]
        if titolo:
            cmd += ['--evento', titolo]
        if a.dry_run:
            log('DRY  ' + ' '.join(cmd)); continue
        if subprocess.run(cmd, cwd=ROOT).returncode == 0:
            prodotte.append(f'{gp} {sess}')
        else:
            log(f'  fallito, tiro dritto: {gp} {sess}')   # una sessione rotta non ferma le altre

    if a.dry_run or not prodotte:
        return
    msg = 'auto: telemetria ' + ', '.join(prodotte) + ' (dalle registrazioni del collettore)'
    subprocess.run(['git', 'add', '-A', 'demo/data'], cwd=ROOT, check=False)
    if subprocess.run(['git', 'diff', '--cached', '--quiet'], cwd=ROOT).returncode == 0:
        log('nessuna modifica da committare.'); return
    subprocess.run(['git', 'commit', '-q', '-m', msg], cwd=ROOT, check=False)
    log('commit: ' + msg)
    if a.push:
        subprocess.run(['git', 'push', 'origin', 'HEAD:main'], cwd=ROOT, check=False)
        log('pushato.')


if __name__ == '__main__':
    main()
