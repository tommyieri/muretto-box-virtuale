#!/usr/bin/env python3
"""test_sigillo_null.py — le TRE verifiche meccaniche della zona a contatto umano.

Non produce numeri di dominio: verifica che il cablaggio della regola-stop funzioni.
Lavora su un file di sigillo temporaneo; sigillo_null.json non viene mai scritto.

  1  INTEGRO            col sigillo depositato, la verifica passa
  2  SCATTA             se il sorgente di una funzione del null cambia, si rompe e
                        nomina la funzione modificata
  3  BLOCCA IL GENERATORE  col sigillo rotto, un generatore NON produce numeri

Esce 0 se le tre passano. Test di CODICE, non giudice di ipotesi.
"""
import hashlib
import io
import json
import os
import sys
import tempfile
from contextlib import redirect_stdout

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)

import sigillo_null as SN
import sorveglianza as SORV


def main():
    sha_prima = hashlib.sha256(open(SN.SIGILLO, 'rb').read()).hexdigest()
    vero = json.load(open(SN.SIGILLO))
    esiti = []

    ok1 = SN.verifica()['integro']
    esiti.append(('INTEGRO', ok1, 'il sigillo depositato combacia col sorgente'))

    with tempfile.TemporaryDirectory() as tmp:
        finto_path = os.path.join(tmp, 'sigillo.json')
        finto = json.loads(json.dumps(vero))
        bersaglio = 'fenomeno_fuel.FenomenoFuel.null'
        finto['zone'][bersaglio]['sha256'] = '0' * 16      # come se il null fosse cambiato
        json.dump(finto, open(finto_path, 'w'))

        SN.SIGILLO = finto_path
        v = SN.verifica()
        buf = io.StringIO()
        with redirect_stdout(buf):
            proc = SN.pretendi_integro('test')
        testo = buf.getvalue()
        ok2 = (not v['integro'] and bersaglio in v['rotte'] and proc is False
               and 'SIGILLO DEL NULL ROTTO' in testo and bersaglio in testo)
        esiti.append(('SCATTA', ok2, f'nomina {bersaglio} come modificata'))

        buf = io.StringIO()
        vecchio_argv, sys.argv = sys.argv, ['sorveglianza.py']
        try:
            with redirect_stdout(buf):
                SORV.main()
        finally:
            sys.argv = vecchio_argv
        uscita = buf.getvalue()
        ok3 = ('SIGILLO DEL NULL ROTTO' in uscita
               and 'cambiamento di stato' not in uscita and 'VERDETTO' not in uscita)
        esiti.append(('BLOCCA IL GENERATORE', ok3, 'sorveglianza.py non produce numeri'))

        SN.SIGILLO = os.path.join(QUI, 'sigillo_null.json')

    ok4 = hashlib.sha256(open(SN.SIGILLO, 'rb').read()).hexdigest() == sha_prima
    esiti.append(('SIGILLO NON RISCRITTO', ok4, 'sha256 invariato'))

    for nome, ok, nota in esiti:
        print(f"  {'PASS' if ok else 'FALLITO':8s} {nome:24s} {nota}")
    tutte = all(ok for _, ok, _ in esiti)
    print(f"\n  {'la regola-stop e cablata e funziona' if tutte else 'CABLAGGIO ROTTO'}")
    return 0 if tutte else 1


if __name__ == '__main__':
    raise SystemExit(main())
