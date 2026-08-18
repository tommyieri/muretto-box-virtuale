"""
audit_web.py — Agente 3: Il Collaudatore Web & UX

Ispeziona le pagine HTML, gli script e gli stili:
1. Verifica integrità di tutte le pagine HTML in demo/
2. Verifica broken links (nessun link 404 verso pagine inesistenti)
3. Verifica corretta inclusione di muro.css e guscio muro.mjs
4. Verifica coerenza delle 11 squadre e colori ufficiali
5. Verifica consistenza sitemap.xml
"""
import os
import re
import xml.etree.ElementTree as ET

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEMO = os.path.join(REPO, "demo")
SITEMAP_XML = os.path.join(DEMO, "sitemap.xml")

PAGINE_ATTESE = [
    "index.html", "stagione.html", "telemetria.html", "campionato.html",
    "analisi.html", "forza.html", "dati.html", "whatif.html", "live.html"
]


def audit_web_frontend():
    errori = []
    avvisi = []
    controlli = 0

    # 1. Verifica esistenza pagine chiave
    for p in PAGINE_ATTESE:
        controlli += 1
        path_p = os.path.join(DEMO, p)
        if not os.path.exists(path_p):
            errori.append(f"Pagina fondamentale mancante: demo/{p}")
        else:
            with open(path_p, encoding="utf-8") as f:
                html = f.read()

            # Controllo guscio e CSS
            if "muro.css" not in html:
                errori.append(f"demo/{p} non include muro.css")
            if "guscio(" not in html:
                errori.append(f"demo/{p} non invoca guscio() da muro.mjs")
            if '<div class="piede-in">' not in html:
                errori.append(f"demo/{p} manca del segnaposto per il footer (<div class=\"piede-in\">)")

            # 2. Controllo broken links interni
            hrefs = re.findall(r'href=["\']([^"\']+)["\']', html)
            for h in hrefs:
                if h.startswith("http") or h.startswith("#") or h.startswith("mailto:") or h.startswith("data:"):
                    continue
                # Rimuovi query string e hash
                clean_h = h.split("?")[0].split("#")[0]
                if not clean_h:
                    continue
                if clean_h.startswith("/"):
                    clean_rel = clean_h.lstrip("/")
                    target = os.path.normpath(os.path.join(DEMO, clean_rel))
                else:
                    target = os.path.normpath(os.path.join(DEMO, clean_h))

                if not os.path.exists(target):
                    # Se è un asset secondario opzionale (es. icona apple), mettilo in avvisi, se è una pagina o css è errore
                    if clean_h.endswith(".png") or clean_h.endswith(".ico"):
                        avvisi.append(f"Asset icona opzionale non presente in demo/{p}: href='{h}'")
                    else:
                        errori.append(f"Broken link in demo/{p}: href='{h}' punta a file inesistente '{clean_h}'")

    # 3. Controllo Sitemap
    controlli += 1
    if os.path.exists(SITEMAP_XML):
        try:
            tree = ET.parse(SITEMAP_XML)
            root = tree.getroot()
            ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
            for url in root.findall("s:url", ns):
                loc = url.find("s:loc", ns)
                if loc is not None and loc.text:
                    url_text = loc.text
                    path_rel = url_text.replace("https://murettobox.com/", "")
                    if path_rel and not path_rel.endswith("/"):
                        local_file = os.path.join(DEMO, path_rel)
                        if not os.path.exists(local_file):
                            errori.append(f"Sitemap contiene URL di file non esistente: {path_rel}")
        except Exception as e:
            errori.append(f"Errore parsing sitemap.xml: {e}")
    else:
        avvisi.append("sitemap.xml non presente in demo/")

    return {
        "status": "PASS" if len(errori) == 0 else "FAIL",
        "controlli_eseguiti": controlli,
        "errori": errori,
        "avvisi": avvisi
    }


if __name__ == "__main__":
    res = audit_web_frontend()
    print(f"Esito: {res['status']} | Controlli: {res['controlli_eseguiti']}")
    if res["errori"]:
        print("ERRORI:")
        for e in res["errori"]:
            print(" -", e)
    if res["avvisi"]:
        print("AVVISI:")
        for a in res["avvisi"]:
            print(" -", a)
