#!/usr/bin/env python
"""Diagnostica di un file registrato con record_session.py.

Legge il file riga per riga (formato grezzo del SignalRClient di FastF1:
una lista Python `['Topic', dati, 'timestamp']` per riga) e stampa:
  - numero di messaggi per topic;
  - presenza e frequenza media di Position.z e CarData.z;
  - primo e ultimo timestamp;
  - gap > 10 secondi tra messaggi consecutivi;
  - un messaggio d'esempio decodificato per ogni topic .z
    (base64 + zlib deflate raw, wbits=-zlib.MAX_WBITS).

Nessuna dipendenza da FastF1 ne' dal kernel: solo libreria standard.
"""

import argparse
import ast
import base64
import json
import sys
import zlib
from datetime import datetime
from pathlib import Path

SOGLIA_GAP = 10.0  # secondi
TOPIC_Z_PRINCIPALI = ("Position.z", "CarData.z")


def decodifica_z(payload: str):
    """Decodifica un payload .z: base64 -> deflate raw -> JSON."""
    grezzo = zlib.decompress(base64.b64decode(payload), -zlib.MAX_WBITS)
    return json.loads(grezzo)


def parse_timestamp(testo):
    """Timestamp del feed, es. '2026-07-16T12:00:00.4360000Z'.

    Il feed F1 usa fino a 7 cifre di frazione: fromisoformat ne accetta al
    massimo 6, quindi la frazione viene troncata.
    """
    if not testo:
        return None
    testo = testo.rstrip("Z")
    if "." in testo:
        intero, frazione = testo.split(".", 1)
        testo = f"{intero}.{frazione[:6]}"
    try:
        return datetime.fromisoformat(testo)
    except ValueError:
        return None


def parse_riga(riga: str):
    """Una riga -> (topic, dati, timestamp) oppure None se non parsabile."""
    riga = riga.strip()
    if not riga:
        return None
    try:
        msg = ast.literal_eval(riga)
    except (ValueError, SyntaxError):
        # fallback stile FastF1 per righe non repr-compliant
        aggiustata = (riga.replace("'", '"')
                          .replace("True", "true")
                          .replace("False", "false"))
        try:
            msg = json.loads(aggiustata)
        except json.JSONDecodeError:
            return None
    if not isinstance(msg, list) or len(msg) < 2:
        return None
    topic = msg[0]
    dati = msg[1]
    ts = parse_timestamp(msg[2]) if len(msg) > 2 else None
    return topic, dati, ts


def analizza(path):
    """Legge il file e restituisce il riepilogo come dict."""
    conteggi = {}
    timestamps = []
    gaps = []
    esempi_z = {}
    errori_z = {}
    righe_illeggibili = 0

    with open(path, encoding="utf-8") as f:
        for riga in f:
            parsata = parse_riga(riga)
            if parsata is None:
                if riga.strip():
                    righe_illeggibili += 1
                continue
            topic, dati, ts = parsata
            conteggi[topic] = conteggi.get(topic, 0) + 1

            if ts is not None:
                if timestamps:
                    delta = (ts - timestamps[-1]).total_seconds()
                    if delta > SOGLIA_GAP:
                        gaps.append((timestamps[-1], ts, delta))
                timestamps.append(ts)

            if topic.endswith(".z") and topic not in esempi_z \
                    and isinstance(dati, str):
                try:
                    esempi_z[topic] = decodifica_z(dati)
                except Exception as e:
                    errori_z[topic] = repr(e)

    primo = timestamps[0] if timestamps else None
    ultimo = timestamps[-1] if timestamps else None
    durata = (ultimo - primo).total_seconds() if timestamps else 0.0

    frequenze_z = {}
    for topic in sorted(t for t in conteggi if t.endswith(".z")):
        n = conteggi[topic]
        frequenze_z[topic] = n / durata if durata > 0 else None

    return {
        "conteggi": conteggi,
        "primo_ts": primo,
        "ultimo_ts": ultimo,
        "durata_s": durata,
        "gaps": gaps,
        "frequenze_z": frequenze_z,
        "esempi_z": esempi_z,
        "errori_z": errori_z,
        "righe_illeggibili": righe_illeggibili,
    }


def stampa_report(path, r):
    print(f"File: {path}")
    print(f"Righe illeggibili: {r['righe_illeggibili']}")
    print()

    print("Messaggi per topic:")
    for topic in sorted(r["conteggi"], key=r["conteggi"].get, reverse=True):
        print(f"  {topic:<24} {r['conteggi'][topic]}")
    print()

    print("Topic .z principali:")
    for topic in TOPIC_Z_PRINCIPALI:
        if topic not in r["conteggi"]:
            print(f"  {topic:<24} ASSENTE")
            continue
        freq = r["frequenze_z"].get(topic)
        freq_txt = f"{freq:.2f} msg/s" if freq is not None else "n/d (durata 0)"
        print(f"  {topic:<24} {r['conteggi'][topic]} messaggi, "
              f"frequenza media {freq_txt}")
    print()

    print(f"Primo timestamp:  {r['primo_ts']}")
    print(f"Ultimo timestamp: {r['ultimo_ts']}")
    print(f"Durata coperta:   {r['durata_s']:.1f}s")
    print()

    if r["gaps"]:
        print(f"Gap > {SOGLIA_GAP:.0f}s ({len(r['gaps'])}):")
        for prima, dopo, delta in r["gaps"]:
            print(f"  {prima} -> {dopo}  ({delta:.1f}s)")
    else:
        print(f"Nessun gap > {SOGLIA_GAP:.0f}s.")
    print()

    for topic, esempio in sorted(r["esempi_z"].items()):
        testo = json.dumps(esempio, ensure_ascii=False)
        if len(testo) > 500:
            testo = testo[:500] + " …[troncato]"
        print(f"Esempio decodificato {topic}:")
        print(f"  {testo}")
    for topic, errore in sorted(r["errori_z"].items()):
        print(f"ERRORE decodifica {topic}: {errore}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Diagnostica di una registrazione live timing.")
    parser.add_argument("file", help="file registrato da ispezionare")
    args = parser.parse_args()

    path = Path(args.file)
    if not path.is_file():
        print(f"File non trovato: {path}", file=sys.stderr)
        return 1

    stampa_report(path, analizza(path))
    return 0


if __name__ == "__main__":
    sys.exit(main())
