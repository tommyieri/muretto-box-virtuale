"""gen_foto.py — foto dei piloti da Wikimedia Commons, CON DISCIPLINA DI LICENZA.

Per ogni pilota della stagione (da demo/data/schede_2026.json):
  1. cerca l'entita' su Wikidata (wbsearchentities sul nome; si accetta solo un
     candidato la cui descrizione parla di automobilismo/F1);
  2. prende l'immagine principale P18 e ne chiede a Commons url + extmetadata;
  3. ACCETTA SOLO licenze libere: Public Domain, CC0, CC BY, CC BY-SA (qualunque
     versione). Licenza diversa, non determinabile, O AUTORE ASSENTE -> NIENTE foto
     (l'attribuzione e' parte del prodotto): la UI usa l'avatar sui colori team.
  4. scarica il thumb a 400px in demo/assets/piloti/<driverId>.<ext> e registra in
     demo/data/foto_credits.json: file, autore, licenza, url licenza, pagina Commons.

Idempotente e gentile con Commons: i piloti gia' presenti nel credits con file
scaricato vengono SALTATI (nessun ribombardamento a ogni gara); --force rifa' tutto.
Team: nessun logo — loghi e livree non hanno in generale licenza libera; si usano i
colori team (avatar). Scelta dichiarata qui.

Uso: python3 gen_foto.py [--force]
"""
import argparse, html, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request

UA = {'User-Agent': 'muretto-demo/1.0 (uso didattico; foto con licenza libera e attribuzione)'}
LICENZE_OK = re.compile(r'^(public domain|pd|cc0|cc[ -]by(-sa)?)([ -]\d|\b)', re.I)
DESC_OK = re.compile(r'racing driver|formula (one|1)|f1', re.I)
PASSO_S = 1.5          # gentilezza: ~1 richiesta ogni 1,5 s verso Wikimedia


def api(url):
    for tentativo in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                time.sleep(PASSO_S)
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429 and tentativo < 3:
                attesa = 15 * (tentativo + 1)
                print(f'    429 da Wikimedia: attendo {attesa}s e riprovo')
                time.sleep(attesa); continue
            raise


def wikidata_p18(nome):
    q = urllib.parse.quote(nome)
    s = api(f'https://www.wikidata.org/w/api.php?action=wbsearchentities&search={q}'
            '&language=en&type=item&limit=5&format=json')
    for cand in s.get('search', []):
        if DESC_OK.search(cand.get('description', '') or ''):
            c = api(f'https://www.wikidata.org/w/api.php?action=wbgetclaims'
                    f'&entity={cand["id"]}&property=P18&format=json')
            claims = c.get('claims', {}).get('P18', [])
            if claims:
                return claims[0]['mainsnak']['datavalue']['value'], cand['id']
            return None, cand['id']
    return None, None


def commons_info(filename):
    t = urllib.parse.quote(f'File:{filename}')
    d = api(f'https://commons.wikimedia.org/w/api.php?action=query&titles={t}'
            '&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=400&format=json')
    pages = d.get('query', {}).get('pages', {})
    for p in pages.values():
        ii = (p.get('imageinfo') or [None])[0]
        if ii: return ii
    return None


def pulisci_html(s):
    return html.unescape(re.sub(r'<[^>]+>', '', s or '')).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--force', action='store_true')
    args = ap.parse_args()
    schede = json.load(open(os.path.join('demo', 'data', 'schede_2026.json')))
    dest_dir = os.path.join('demo', 'assets', 'piloti')
    os.makedirs(dest_dir, exist_ok=True)
    credits_path = os.path.join('demo', 'data', 'foto_credits.json')
    credits = {}
    if os.path.exists(credits_path) and not args.force:
        credits = json.load(open(credits_path)).get('piloti', {})

    esiti = {'ok': 0, 'saltati': 0, 'avatar': 0}
    for pid, s in sorted(schede['piloti'].items()):
        if pid in credits and os.path.exists(os.path.join('demo', credits[pid]['percorso'])):
            esiti['saltati'] += 1; continue
        try:
            fname, qid = wikidata_p18(s['nome'])
            if not fname:
                print(f'  {s["sigla"]}: nessuna immagine P18 -> avatar'); esiti['avatar'] += 1; continue
            ii = commons_info(fname)
            em = (ii or {}).get('extmetadata', {})
            lic = pulisci_html(em.get('LicenseShortName', {}).get('value'))
            autore = pulisci_html(em.get('Artist', {}).get('value'))
            if not ii or not LICENZE_OK.match(lic or '') or not autore:
                print(f'  {s["sigla"]}: licenza "{lic or "n/d"}" o autore assente -> avatar')
                esiti['avatar'] += 1; continue
            url = ii.get('thumburl') or ii['url']
            ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower() or '.jpg'
            rel = f'assets/piloti/{pid}{ext}'
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r, \
                 open(os.path.join('demo', rel), 'wb') as f:
                f.write(r.read())
            credits[pid] = {'file': f'File:{fname}', 'autore': autore, 'licenza': lic,
                            'licenza_url': pulisci_html(em.get('LicenseUrl', {}).get('value')) or None,
                            'pagina': ii['descriptionurl'], 'wikidata': qid,
                            'larghezza_px': 400, 'percorso': rel}
            print(f'  {s["sigla"]}: OK — {lic}, {autore[:40]}')
            esiti['ok'] += 1
        except Exception as e:
            print(f'  {s["sigla"]}: errore {e} -> avatar'); esiti['avatar'] += 1

    out = {'_nota': ('GENERATO da gen_foto.py (Wikimedia Commons). Solo licenze libere '
                     '(PD/CC0/CC BY/CC BY-SA) CON autore: attribuzione obbligatoria in UI. '
                     'Pilota assente = avatar sui colori team. Team: niente loghi (non liberi '
                     'in generale), solo colori. Non modificare a mano.'),
           'piloti': dict(sorted(credits.items()))}
    with open(credits_path, 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1); f.write('\n')
    print(f'scritto {credits_path}: nuove={esiti["ok"]} saltate(gia presenti)={esiti["saltati"]} avatar={esiti["avatar"]}')


if __name__ == '__main__':
    main()
