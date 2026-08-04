"""aggiorna_stat.py — IL COMANDO UNICO dei dati della sezione Statistiche.

Gemello di aggiorna_ui.py, e SEPARATO da lui apposta.

PERCHE' NON DENTRO I `passi` DI aggiorna_ui.py, che sarebbe la scelta ovvia.
auto_gara.py invoca aggiorna_ui.py con `check=False`: un passo che fallisce non ferma
niente e non alza nessuna bandiera. Va bene per gen_foto, che va in rete e puo' non
rispondere. Non va bene per i generatori di una sezione che pubblica numeri: fallirebbero
in silenzio e la sezione mostrerebbe l'artefatto della gara precedente con l'aria di essere
aggiornata. Qui invece l'uscita e' non-zero, e chi lo lancia se ne accorge.

Uso:
    python3 aggiorna_stat.py                     # tutti i passi
    python3 aggiorna_stat.py --solo confronti    # un passo solo

Gli artefatti vivono in demo/data/stat/ e portano tutti lo stesso involucro: `_generatore`,
`schema`, `calcolato_il` (ora UTC di CALCOLO, mai una data di gara), `provenienza`,
`perimetro`. demo/test_stat.mjs esce 1 se un file compare li' dentro senza essere prodotto
da un passo registrato in questa lista — un file senza generatore e' un debito, non una
fonte, e il progetto ha gia' pagato quel precedente sei volte.
"""
import argparse
import json
import os
import subprocess
import sys

import f1db_zip

VERDE, ROSSO, GIALLO, FINE = '\033[32m', '\033[31m', '\033[33m', '\033[0m'
PY = sys.executable
STAT = os.path.join('demo', 'data', 'stat')


def targhetta(path):
    """La riga di esito: quando e' stato calcolato e su quale perimetro."""
    try:
        d = json.load(open(path))
    except Exception:
        return None
    pezzi = []
    if d.get('calcolato_il'):
        pezzi.append(d['calcolato_il'].replace('T', ' ').replace('+00:00', 'Z'))
    per = d.get('perimetro') or {}
    if per.get('gare'):
        pezzi.append(f"{len(per['gare'])} gare")
    if per.get('anni'):
        pezzi.append(f"{per['anni'][0]}-{per['anni'][-1]}")
    rel = (d.get('provenienza') or {}).get('f1db_release_letta')
    if rel:
        pezzi.append(f'f1db {rel}')
    return ' · '.join(pezzi) or None


def main():
    ap = argparse.ArgumentParser(description='dati della sezione Statistiche')
    ap.add_argument('--solo', metavar='PASSO', help='esegue un passo solo (es. confronti)')
    ap.add_argument('--gara', help='gara nuova appena pubblicata, per i passi che la usano')
    args = ap.parse_args()

    os.makedirs(STAT, exist_ok=True)

    # stessa release f1db per tutti i passi: se la cache condivisa esiste la si passa,
    # altrimenti ogni generatore andrebbe in rete per conto suo e potrebbero divergere.
    zip_cache = f1db_zip.percorso_zip()
    con_zip = ['--zip', zip_cache] if os.path.exists(zip_cache) else []

    passi = [
        ('confronti', [PY, 'gen_stat_confronti.py'] + con_zip,
         os.path.join(STAT, 'confronti.json')),
        ('piloti', [PY, 'gen_stat_piloti.py'] + con_zip,
         os.path.join(STAT, 'piloti_2026.json')),
        ('gara', [PY, 'gen_stat_gara.py'] + con_zip,
         os.path.join(STAT, 'gara_2026.json')),
        ('fondo', [PY, 'gen_stat_fondo.py'] + con_zip,
         os.path.join(STAT, 'fondo_anni.json')),
        # VA IN RETE: censisce l'archivio pubblico F1 e conta i canali che trasmette. E' la
        # sentinella che si accorgerebbe se F1 riaprisse il rubinetto sull'energia. Se la rete
        # non c'e', non tocca il file e torna 1: meglio una misura vecchia e datata che una
        # misura degradata con l'aria di essere fresca.
        ('feed', [PY, 'gen_stat_feed.py'],
         os.path.join(STAT, 'feed.json')),
        # VA IN RETE anche questo, ma solo per la sentinella sull'Issue: i numeri vengono da
        # data/regolamento_2026.json, che e' firmato a mano. Se il sito FIA non risponde, il
        # controllo si dichiara non eseguito invece di tacere.
        ('regolamento', [PY, 'gen_stat_regolamento.py'],
         os.path.join(STAT, 'regolamento.json')),
        # ULTIMO: raccoglie gli alias dagli artefatti gia' scritti, quindi deve vederli tutti.
        ('identita', [PY, 'gen_stat_identita.py'],
         os.path.join(STAT, 'identita.json')),
    ]

    if args.solo:
        nomi = [p[0] for p in passi]
        if args.solo not in nomi:
            sys.exit(f'passo sconosciuto: {args.solo} (disponibili: {", ".join(nomi)})')
        passi = [p for p in passi if p[0] == args.solo]

    errori = 0
    for nome, cmd, artefatto in passi:
        r = subprocess.run(cmd, capture_output=True, text=True)
        ok = r.returncode == 0
        stato = f'{VERDE}OK{FINE}' if ok else f'{ROSSO}FAIL{FINE}'
        t = targhetta(artefatto)
        print(f'[{stato}] {nome:12s} {t or ""}')
        if not ok:
            errori += 1
            for riga in (r.stdout + r.stderr).strip().splitlines()[-4:]:
                print('       ', riga)

    # UN FILE SENZA PASSO E' UN DEBITO. Lo stesso controllo lo fa demo/test_stat.mjs in CI;
    # qui si fa subito, perche' chi ha appena scritto un generatore nuovo se ne accorga
    # prima del push e non dopo.
    attesi = {os.path.basename(a) for _, _, a in passi}
    if not args.solo and os.path.isdir(STAT):
        orfani = [f for f in sorted(os.listdir(STAT))
                  if f.endswith('.json') and f not in attesi]
        if orfani:
            print(f'[{GIALLO}ATTENZIONE{FINE}] in {STAT} ci sono file che nessun passo '
                  f'produce: {", ".join(orfani)}')
            print('            un file senza generatore e\' un debito, non una fonte.')
            errori += 1

    if errori:
        sys.exit(f'{errori} passi falliti — vedi sopra.')
    print('aggiorna_stat: tutti i passi completati.')


if __name__ == '__main__':
    main()
