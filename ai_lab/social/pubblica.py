#!/usr/bin/env python3
"""pubblica.py — l'ultimo metro: da 'approvato' a online su Instagram.

COME FUNZIONA DAVVERO L'API. Instagram (Graph API, Content Publishing) non
accetta i byte di un'immagine: vuole un URL pubblico da cui scaricarsela. Quindi
la catena e':

    bozza approvata ─► demo/social/<id>.png ─► merge su main ─► Vercel pubblica
                                              https://murettobox.com/social/<id>.png
                                                          │
                          POST /{ig}/media  (crea il contenitore, con quell'URL)
                          POST /{ig}/media_publish  (lo pubblica)

Cioe' il post esce solo DOPO che l'immagine e' online sul sito. Non e' un
inconveniente: e' lo stesso confine del resto del progetto — portare online =
merge su main — e rende impossibile pubblicare qualcosa che non sia anche
tracciato in git.

IL SEGRETO NON PASSA DA QUI. Il token si legge dall'ambiente
(`IG_TOKEN`, `IG_USER_ID`) e non viene mai stampato, nemmeno troncato, nemmeno
negli errori. Vale la lezione del 14/08 sulla chiave Anthropic: un valore finito
una volta in una trascrizione e' un valore bruciato. Le due strade sensate sono
le stesse di allora — keychain, oppure solo sul VPS.

QUESTO COMANDO NON GIRA DA SOLO. Nessun cron lo chiama, e senza `--conferma` non
fa nulla: stampa cosa pubblicherebbe e si ferma.
"""
from __future__ import annotations
import os
import json
import time
import shutil
import argparse
import datetime
import urllib.parse
import urllib.request

from . import coda

QUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(QUI, "..", ".."))
PUBBLICHE = os.path.join(REPO, "demo", "social")
DOMINIO = "https://murettobox.com"
API = "https://graph.facebook.com/v21.0"


def _token():
    t = os.environ.get("IG_TOKEN", "").strip()
    u = os.environ.get("IG_USER_ID", "").strip()
    if not t or not u:
        raise SystemExit(
            "[pubblica] manca IG_TOKEN o IG_USER_ID nell'ambiente.\n"
            "  Servono un account Instagram Professionale collegato a una Pagina\n"
            "  Facebook, un'app Meta e un token a lunga scadenza.\n"
            "  Non incollarli qui dentro ne' in una chat: mettili in un file letto\n"
            "  dall'ambiente (come ~/.muretto_env) o nel keychain.")
    return t, u


def _chiedi(url, dati=None):
    corpo = urllib.parse.urlencode(dati).encode() if dati else None
    req = urllib.request.Request(url, data=corpo)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        testo = e.read().decode()[:400]
        # il token puo' comparire nell'eco dell'URL: si ripulisce prima di stampare
        for seg in (os.environ.get("IG_TOKEN", ""),):
            if seg:
                testo = testo.replace(seg, "«token»")
        raise SystemExit(f"[pubblica] l'API ha risposto {e.code}: {testo}")


def prepara(ident: str) -> list:
    """Copia le immagini della bozza in demo/social/ — cioe' le mette sulla
    strada del deploy. Torna gli URL che AVRANNO una volta online."""
    post, stato = coda.leggi(ident)
    if stato.get("stato") != "approvato":
        raise SystemExit(f"[pubblica] {ident} e' in stato '{stato.get('stato')}': "
                         f"si pubblica solo cio' che e' 'approvato'.")
    os.makedirs(PUBBLICHE, exist_ok=True)
    url = []
    for i, nome in enumerate(post["immagini"]):
        sorg = os.path.join(coda._dir(ident), nome)
        est = os.path.splitext(nome)[1]
        dest_nome = f"{ident}-{i}{est}"
        shutil.copy2(sorg, os.path.join(PUBBLICHE, dest_nome))
        url.append(f"{DOMINIO}/social/{dest_nome}")
    return url


def _online(url: str) -> bool:
    """L'immagine e' gia' raggiungibile? Se no, Instagram non potra' prenderla:
    meglio dirlo prima di chiamare l'API che leggere un errore oscuro dopo."""
    try:
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status == 200
    except Exception:
        return False


def pubblica(ident: str, attore: str, conferma: bool = False):
    post, _ = coda.leggi(ident)
    url = prepara(ident)

    print(f"--- {ident}")
    print(f"tipo: {post['tipo']}   gara: {post['gara']}")
    for u in url:
        print(f"immagine: {u}   {'ONLINE' if _online(u) else 'NON ANCORA ONLINE'}")
    print("\n" + post["didascalia"] + "\n")

    if not conferma:
        print("[pubblica] prova a vuoto: non ho pubblicato niente.")
        print("  1. controlla il testo e l'immagine qui sopra")
        print("  2. porta online le immagini:  git add demo/social && git commit && merge su main")
        print("  3. poi rilancia con --conferma")
        return

    mancanti = [u for u in url if not _online(u)]
    if mancanti:
        raise SystemExit(f"[pubblica] FERMO: {len(mancanti)} immagini non sono ancora "
                         f"online. Instagram le scarica da li': prima il deploy, poi il post.")

    token, ig = _token()
    if len(url) == 1:
        cont = _chiedi(f"{API}/{ig}/media", {
            "image_url": url[0], "caption": post["didascalia"], "access_token": token})
        id_cont = cont["id"]
    else:
        figli = []
        for u in url:
            c = _chiedi(f"{API}/{ig}/media", {
                "image_url": u, "is_carousel_item": "true", "access_token": token})
            figli.append(c["id"])
        cont = _chiedi(f"{API}/{ig}/media", {
            "media_type": "CAROUSEL", "children": ",".join(figli),
            "caption": post["didascalia"], "access_token": token})
        id_cont = cont["id"]

    time.sleep(3)                      # il contenitore non e' pronto all'istante
    reso = _chiedi(f"{API}/{ig}/media_publish",
                   {"creation_id": id_cont, "access_token": token})

    st = coda.transizione(ident, "pubblicato", attore or "Tommi",
                          nota=f"instagram id {reso.get('id')}")
    print(f"[pubblica] online. id Instagram: {reso.get('id')}  stato: {st['stato']}")


def main():
    ap = argparse.ArgumentParser(description="pubblica su Instagram un post approvato")
    ap.add_argument("--id", required=True)
    ap.add_argument("--attore", default="Tommi")
    ap.add_argument("--conferma", action="store_true",
                    help="senza questo non pubblica: mostra e basta")
    a = ap.parse_args()
    pubblica(a.id, a.attore, a.conferma)


if __name__ == "__main__":
    main()
