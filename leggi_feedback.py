#!/usr/bin/env python3
"""leggi_feedback.py — le segnalazioni arrivate dal sito, sul terminale.

    export FEEDBACK_CHIAVE='...'          # la stessa impostata su Vercel
    python3 leggi_feedback.py             # le nuove, dalla più recente
    python3 leggi_feedback.py --tutte     # anche quelle già lavorate
    python3 leggi_feedback.py --fatto <id>  # segna lavorata

PERCHÉ ESISTE, e non è una comodità. Una buca delle lettere che nessuno apre è peggio
di nessuna buca: promette a chi scrive che qualcuno leggerà. Questo script è l'altra
metà della promessa, ed è di proposito un comando da lanciare a mano — non c'è nessuna
notifica e nessun ticket automatico, quindi la lettura è un gesto, non un processo.

LA CHIAVE NON STA NEL REPO. Vive in ~/.muretto_env come le altre (`export
FEEDBACK_CHIAVE=...`), e deve essere identica a quella impostata fra le variabili
d'ambiente del progetto su Vercel. Senza, l'endpoint non risponde: la lettura è chiusa
per costruzione, perché fra le segnalazioni possono esserci indirizzi email di persone.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

SITO = os.environ.get("MURETTO_SITO", "https://murettobox.com")
CHIAVE = os.environ.get("FEEDBACK_CHIAVE", "")

TIPI = {
    "rotto": "NON FUNZIONA",
    "sbagliato": "NUMERO SBAGLIATO",
    "oscuro": "NON SI CAPISCE",
    "manca": "MANCA QUALCOSA",
    "idea": "IDEA",
}

VERDE, ROSSO, GIALLO, CIANO, FIOCO, GROSSO, FINE = (
    "\033[92m", "\033[91m", "\033[93m", "\033[96m", "\033[90m", "\033[1m", "\033[0m")


def chiedi(parametri: dict) -> dict:
    parametri = {**parametri, "chiave": CHIAVE}
    url = f"{SITO}/api/feedback?" + urllib.parse.urlencode(parametri)
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        corpo = e.read().decode("utf-8", "replace")
        try:
            detto = json.loads(corpo).get("errore", corpo)
        except Exception:
            detto = corpo
        raise SystemExit(f"{ROSSO}[feedback] il server ha detto {e.code}: {detto}{FINE}")
    except urllib.error.URLError as e:
        raise SystemExit(f"{ROSSO}[feedback] non raggiungibile: {e.reason}{FINE}")


def stampa(v: dict) -> None:
    fatta = v.get("stato") == "fatto"
    testa = f"{FIOCO if fatta else CIANO}{GROSSO}[{v.get('id')}]{FINE}"
    tipo = TIPI.get(v.get("tipo"), v.get("tipo") or "?")
    colore = FIOCO if fatta else (GIALLO if v.get("tipo") in ("rotto", "sbagliato") else "")
    print(f"\n{testa} {colore}{tipo}{FINE}"
          f"{VERDE + '  · lavorata' + FINE if fatta else ''}")
    print(f"  {FIOCO}quando{FINE}  {v.get('ricevuta_il', '—')}")
    print(f"  {FIOCO}dove{FINE}    {v.get('pagina') or '—'}")
    print(f"  {FIOCO}con{FINE}     {v.get('navigatore') or '—'}  ·  finestra {v.get('schermo') or '—'}")
    if v.get("contatto"):
        print(f"  {FIOCO}risposta a{FINE}  {v['contatto']}")
    print()
    for riga in (v.get("testo") or "").splitlines() or [""]:
        print(f"    {riga}")


def main() -> int:
    ap = argparse.ArgumentParser(description="le segnalazioni arrivate dal sito")
    ap.add_argument("--tutte", action="store_true", help="mostra anche quelle già lavorate")
    ap.add_argument("--n", type=int, default=100, help="quante leggerne al massimo")
    ap.add_argument("--fatto", metavar="ID", help="segna una segnalazione come lavorata")
    ap.add_argument("--json", action="store_true", help="rendi il grezzo, senza colori")
    a = ap.parse_args()

    if not CHIAVE:
        print(f"{ROSSO}[feedback] manca FEEDBACK_CHIAVE.{FINE}\n"
              "  È la chiave di lettura: deve essere la stessa impostata fra le variabili\n"
              "  d'ambiente del progetto su Vercel. Mettila in ~/.muretto_env:\n"
              "      echo 'export FEEDBACK_CHIAVE=\"...\"' >> ~/.muretto_env", file=sys.stderr)
        return 2

    if a.fatto:
        esito = chiedi({"fatto": a.fatto})
        print(f"{VERDE}[feedback] {esito.get('id')} segnata «{esito.get('stato')}»{FINE}")
        return 0

    d = chiedi({"leggi": "1", "n": a.n})
    voci = d.get("voci", [])
    if a.json:
        print(json.dumps(d, ensure_ascii=False, indent=1))
        return 0

    nuove = [v for v in voci if v.get("stato") != "fatto"]
    da_mostrare = voci if a.tutte else nuove
    # GLI SCATTI DELL'ESCA SI GUARDANO, non si ignorano. È l'unico numero che dice se il
    # filtro anti-robot sta prendendo persone vere: chi ci finisce dentro vede una
    # ricevuta e il suo messaggio non arriva, quindi non si lamenterà mai. Se questo
    # numero cresce come i totali, l'esca va tolta.
    esca = d.get("esca", 0)
    print(f"{GROSSO}{CIANO}  {len(nuove)} da leggere{FINE}"
          f"{FIOCO}  ·  {len(voci)} in coda  ·  {d.get('totale', 0)} da sempre{FINE}"
          + (f"{GIALLO}  ·  {esca} fermate dall'esca{FINE}" if esca else ""))
    if not da_mostrare:
        print(f"\n{FIOCO}  Niente di nuovo. E l'assenza è una risposta.{FINE}")
        return 0
    for v in da_mostrare:
        stampa(v)
    print(f"\n{FIOCO}  Per chiuderne una:  python3 leggi_feedback.py --fatto <id>{FINE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
