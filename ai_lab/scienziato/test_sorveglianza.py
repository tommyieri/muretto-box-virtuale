#!/usr/bin/env python3
"""test_sorveglianza.py — le TRE verifiche meccaniche della sorveglianza.

Non produce numeri di dominio: verifica che il meccanismo si comporti come dichiarato.
Lavora su copie temporanee dello stato; predizioni_congelate.json non viene mai scritto.

  1  IDEMPOTENZA      due esecuzioni senza dati nuovi -> nessun verdetto
  2  SCATTA           se una cella passa da 2 a 3 stagioni -> emette UN verdetto, lo
                      confronta con la predizione congelata, e non lo ripete
  3  SOLA LETTURA     predizioni_congelate.json ha lo stesso contenuto prima e dopo

Esce 0 se le tre verifiche passano. E' un test di CODICE, non un giudice di ipotesi.
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

import sorveglianza as S


def _cattura(argv):
    vecchio = sys.argv
    sys.argv = argv
    buf = io.StringIO()
    try:
        with redirect_stdout(buf):
            S.main()
    finally:
        sys.argv = vecchio
    return buf.getvalue()


def main():
    sha_prima = hashlib.sha256(open(S.CONGELATE, 'rb').read()).hexdigest()
    base = json.load(open(S.STATO))
    esiti = []

    with tempfile.TemporaryDirectory() as tmp:
        S.STATO = os.path.join(tmp, 'stato.json')

        # ---- 1 idempotenza
        json.dump(base, open(S.STATO, 'w'))
        a = _cattura(['sorveglianza.py'])
        b = _cattura(['sorveglianza.py'])
        ok1 = 'nessun cambiamento' in a and 'nessun cambiamento' in b
        esiti.append(('IDEMPOTENZA', ok1, 'due esecuzioni pulite, nessun verdetto'))

        # ---- 2 scatta: si finge che un circuito avesse solo 2 stagioni
        cavia = next(k for k, v in base['celle'].items()
                     if v['stato'] == 'giudicabile' and k.endswith('|2023-25'))
        finto = json.loads(json.dumps(base))
        finto['celle'][cavia] = {'anni': base['celle'][cavia]['anni'][:2],
                                 'stato': 'indecidibile'}
        finto['verdetti_emessi'] = [k for k in finto['verdetti_emessi'] if k != cavia]
        json.dump(finto, open(S.STATO, 'w'))
        c = _cattura(['sorveglianza.py'])
        d = _cattura(['sorveglianza.py'])           # subito dopo: non deve ripetersi
        ok2 = (cavia.split('|')[0] in c and 'VERDETTO' in c
               and 'predizione congelata' in c and 'nessun cambiamento' in d)
        esiti.append(('SCATTA UNA VOLTA SOLA', ok2,
                      f'cavia {cavia}: verdetto emesso e non ripetuto'))

        # ---- 3 sola lettura
        ok3 = hashlib.sha256(open(S.CONGELATE, 'rb').read()).hexdigest() == sha_prima
        esiti.append(('PREDIZIONI SOLA LETTURA', ok3, 'sha256 invariato'))

    for nome, ok, nota in esiti:
        print(f"  {'PASS' if ok else 'FALLITO':8s} {nome:26s} {nota}")
    tutte = all(ok for _, ok, _ in esiti)
    print(f"\n  {'le tre verifiche passano' if tutte else 'MECCANISMO ROTTO'}")
    return 0 if tutte else 1


if __name__ == '__main__':
    raise SystemExit(main())
