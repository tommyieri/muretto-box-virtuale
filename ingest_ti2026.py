"""ingest_ti2026.py — ingerisce in data/ti_archive/2026/ le sessioni TracingInsights 2026
non gia' presenti in data/ti_cache/ (che resta la cache del kernel, intoccata).

Salva il session_laptimes.json cosi' com'e' (mirror fedele, TUTTE le colonne):
nessuna pulizia qui — i filtri sono compito degli script di analisi, dichiarati la'.
Riesegubile: salta i file gia' scaricati.
"""
import os, json, urllib.request, urllib.parse, time

GARE = ['Australian Grand Prix','Chinese Grand Prix','Japanese Grand Prix','Miami Grand Prix',
        'Monaco Grand Prix','Barcelona Grand Prix','Canadian Grand Prix','Austrian Grand Prix',
        'British Grand Prix','Belgian Grand Prix','Hungarian Grand Prix']
SESSIONI = ('Race','Sprint')

# PROVE LIBERE (aggiunte 22/07/2026). Il per-giro delle FP non esisteva nel repo — il TODO
# lo dava per irrecuperabile — ma e' online con lo STESSO schema di Race.json: verificato
# scaricandolo. Non serviva una fonte nuova, serviva chiederla.
#
# LIMITE DICHIARATO, e vale la pena ripeterlo: questi giri sono SPORCHI (carico carburante
# ignoto, run interrotti, push e long-run mescolati). Servono a descrivere il venerdi —
# chi ha girato, su che mescola, per quanti giri — NON a stimare il degrado: quel rigetto e'
# gia' a referto (i gap FP-replay escono tutti negativi e l'ordine SOFT>=MEDIUM>=HARD si
# rovescia, firma di un termine per-giro non rimosso).
SESSIONI_FP = ('Practice 1', 'Practice 2', 'Practice 3')

# Sui weekend SPRINT si corre una sola libera: provare anche FP2/FP3 stamperebbe due
# "assente online" per riga, indistinguibili da un guasto della fonte. Elenco derivato da
# data/calendario_2026.json (le gare con una sessione 'sprint'), non indovinato.
SPRINT = {'Chinese Grand Prix', 'Miami Grand Prix', 'Canadian Grand Prix',
          'British Grand Prix', 'Dutch Grand Prix', 'Singapore Grand Prix'}
# gare la cui Race e' gia' in ti_cache (nome file cache) -> non riscaricare la Race
IN_CACHE = {'Australian Grand Prix':'Australian','Chinese Grand Prix':'Chinese',
            'Japanese Grand Prix':'Japanese','Miami Grand Prix':'Miami',
            'Monaco Grand Prix':'Monaco','Barcelona Grand Prix':'Barcelona',
            'Canadian Grand Prix':'Canadian','Austrian Grand Prix':'Austrian'}

OUT = os.path.join('data','ti_archive','2026')

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent':'muretto'})
    try: return urllib.request.urlopen(req, timeout=40).read()
    except Exception: return None

for gara in GARE:
    fp = SESSIONI_FP[:1] if gara in SPRINT else SESSIONI_FP
    for sess in SESSIONI + fp:
        if sess=='Race' and gara in IN_CACHE and \
           os.path.exists(os.path.join('data','ti_cache',IN_CACHE[gara]+'.json')):
            continue  # gia' congelata in ti_cache
        dst_dir = os.path.join(OUT, gara); dst = os.path.join(dst_dir, sess+'.json')
        if os.path.exists(dst) and os.path.getsize(dst)>1000:
            print(f"skip (gia' presente): {gara}/{sess}"); continue
        raw = get(f"https://raw.githubusercontent.com/TracingInsights/2026/main/{urllib.parse.quote(gara)}/{urllib.parse.quote(sess)}/session_laptimes.json")
        if raw is None:
            print(f"assente online: {gara}/{sess}"); continue
        d = json.loads(raw)  # valida che sia JSON prima di scrivere
        os.makedirs(dst_dir, exist_ok=True)
        with open(dst,'wb') as f: f.write(raw)
        n = len(d.get('time',[]))
        print(f"scaricato: {gara}/{sess}  ({n} righe, {len(raw)//1024} KB)")
        time.sleep(0.1)
print("\ningest 2026 completo.")
