#!/usr/bin/env python
"""Registra il feed live timing F1 su file, riga per riga, senza processing.

Usa fastf1.livetiming.client.SignalRClient: il client scrive il flusso grezzo
cosi' com'e' (una riga per messaggio). Questo wrapper aggiunge solo:
  - path di output di default con data/ora;
  - gestione del limite noto di disconnessione a ~2h: quando la connessione
    cade a meta' sessione, riavvia la registrazione su un nuovo file con
    suffisso incrementale (_part2, _part3, ...), loggando l'istante del gap.

Modulo separato dal kernel: nessun import da engine/ o dagli altri script.
"""

import argparse
import logging
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from fastf1.livetiming.client import SignalRClient

# Il client esce da start() sia per timeout (nessun messaggio per --timeout
# secondi) sia quando il server chiude la connessione (~2h): in entrambi i
# casi e' il supervisore interno a scattare. Distinzione euristica: se la
# parte e' durata poco piu' del timeout non e' mai arrivato un flusso dati
# (sessione non live / finita) -> uscita pulita; se e' durata di piu', i dati
# scorrevano e poi si sono fermati -> disconnessione, si riavvia.
MARGINE_DISCONNESSIONE = 15  # secondi oltre il timeout

log = logging.getLogger("record_session")


def percorso_parte(base: Path, parte: int) -> Path:
    if parte == 1:
        return base
    return base.with_name(f"{base.stem}_part{parte}{base.suffix}")


def main() -> int:
    default_out = "data/live_raw/{}.txt".format(
        datetime.now().strftime("%Y-%m-%d_%H-%M-%S"))
    parser = argparse.ArgumentParser(
        description="Registra il feed live timing F1 su file (raw).")
    parser.add_argument("--out", default=default_out,
                        help=f"file di output (default: {default_out})")
    parser.add_argument("--timeout", type=int, default=60,
                        help="secondi senza messaggi prima dell'uscita "
                             "pulita (default: 60)")
    args = parser.parse_args()

    logging.basicConfig(format="%(asctime)s - %(levelname)s: %(message)s",
                        level=logging.INFO)

    base = Path(args.out)
    base.parent.mkdir(parents=True, exist_ok=True)

    # SignalRClient.start() intercetta il KeyboardInterrupt al suo interno e
    # ritorna: senza questo flag un Ctrl-C sarebbe indistinguibile da una
    # disconnessione e il wrapper riavvierebbe la registrazione.
    interrotto = {"flag": False}

    def su_sigint(signum, frame):
        interrotto["flag"] = True
        raise KeyboardInterrupt

    signal.signal(signal.SIGINT, su_sigint)

    parte = 1
    while True:
        path = percorso_parte(base, parte)
        log.info("registrazione parte %d su %s (timeout %ds)",
                 parte, path, args.timeout)
        t0 = time.time()
        try:
            client = SignalRClient(str(path), filemode="w",
                                   timeout=args.timeout)
            client.start()
        except KeyboardInterrupt:
            interrotto["flag"] = True
        except Exception:
            log.exception("errore nella parte %d", parte)
        durata = time.time() - t0

        if interrotto["flag"]:
            log.info("interrotto dall'utente dopo %.0fs (parte %d)",
                     durata, parte)
            return 0

        if durata <= args.timeout + MARGINE_DISCONNESSIONE:
            log.info("nessun flusso dati entro il timeout (%.0fs): "
                     "uscita pulita", durata)
            return 0

        istante_gap = datetime.now(timezone.utc).isoformat()
        parte += 1
        log.warning("connessione chiusa dopo %.0fs (limite noto ~2h?) — "
                    "gap alle %s — riavvio su parte %d",
                    durata, istante_gap, parte)


if __name__ == "__main__":
    sys.exit(main())
