"""ingest_mirror_storico.py — congela in locale (data/ti_archive/{anno}/) il per-giro
2023-2025 da TracingInsights-Archive, per il prior storico del degrado (Fase 2.1/C).

Perche': il repo oggi conserva solo AGGREGATI delle 3 stagioni storiche (stint_gold,
pkl warm-in); se la fonte terza sparisce, i grezzi sono persi. Questo mirror e' il freeze.

Formato: un JSON per (anno, gara, sessione), column-oriented come i session_laptimes
originali. 2024 ha il file consolidato; 2023/2025 si ricostruiscono dalle cartelle
per-pilota (drivers.json). TUTTE le colonne, nessuna pulizia: i filtri vivono negli
script di analisi, dichiarati la'. Riesegubile: salta i file gia' presenti.

Uso:  python ingest_mirror_storico.py --probe   (stima dimensioni su gare campione)
      python ingest_mirror_storico.py           (mirror completo 2023-2025)
"""
import os, sys, json, time, urllib.request, urllib.parse

ANNI = ('2023','2024','2025')
GARE = ['Australian Grand Prix','Chinese Grand Prix','Japanese Grand Prix','Bahrain Grand Prix',
'Saudi Arabian Grand Prix','Miami Grand Prix','Emilia Romagna Grand Prix','Monaco Grand Prix',
'Spanish Grand Prix','Canadian Grand Prix','Austrian Grand Prix','British Grand Prix',
'Belgian Grand Prix','Hungarian Grand Prix','Dutch Grand Prix','Italian Grand Prix',
'Azerbaijan Grand Prix','Singapore Grand Prix','United States Grand Prix','Mexico City Grand Prix',
'São Paulo Grand Prix','Las Vegas Grand Prix','Qatar Grand Prix','Abu Dhabi Grand Prix']
SESSIONI = ('Race','Sprint')

def get(anno, path):
    u = f"https://raw.githubusercontent.com/TracingInsights-Archive/{anno}/main/{urllib.parse.quote(path)}"
    req = urllib.request.Request(u, headers={'User-Agent':'muretto'})
    try: return urllib.request.urlopen(req, timeout=40).read()
    except Exception: return None

def piloti_da_drivers(dj):
    """estrae i codici pilota da drivers.json, robusto alle forme note (2023 vs 2025)."""
    if isinstance(dj, dict):
        if isinstance(dj.get('drivers'), list):
            return [x['driver'] for x in dj['drivers'] if isinstance(x, dict) and 'driver' in x]
        for v in dj.values():
            if isinstance(v, list) and v and isinstance(v[0], str) and len(v[0]) == 3: return v
        return [k for k in dj if isinstance(k, str) and len(k) == 3]
    if isinstance(dj, list):
        out = []
        for x in dj:
            if isinstance(x, str) and len(x) == 3: out.append(x)
            elif isinstance(x, dict):
                for key in ('drv','code','abbreviation','driver'):
                    if key in x: out.append(x[key]); break
        return out
    return []

def consolida_per_pilota(anno, gara, sess):
    """strategia B: unisce i laptimes.json per-pilota in un dict column-oriented."""
    dj = get(anno, f"{gara}/{sess}/drivers.json")
    if dj is None: return None
    piloti = piloti_da_drivers(json.loads(dj))
    if not piloti: return None
    recs = []
    for drv in piloti:
        raw = get(anno, f"{gara}/{sess}/{drv}/laptimes.json")
        if raw is None: continue
        dp = json.loads(raw)
        if 'time' not in dp: continue
        n = len(dp['time'])
        for i in range(n):
            r = {k: dp[k][i] for k in dp if isinstance(dp[k], list) and len(dp[k]) == n}
            r.setdefault('drv', drv); recs.append(r)
        time.sleep(0.03)
    if not recs: return None
    keys = sorted(set().union(*[set(r) for r in recs]))
    return {k: [r.get(k) for r in recs] for k in keys}

def scarica_sessione(anno, gara, sess):
    raw = get(anno, f"{gara}/{sess}/session_laptimes.json")   # strategia A: consolidato
    if raw is not None:
        d = json.loads(raw)
        if 'time' in d: return d
    return consolida_per_pilota(anno, gara, sess)              # strategia B: per-pilota

def salva(anno, gara, sess, d):
    dst_dir = os.path.join('data','ti_archive',anno,gara)
    os.makedirs(dst_dir, exist_ok=True)
    dst = os.path.join(dst_dir, sess+'.json')
    with open(dst,'w') as f: json.dump(d, f, separators=(',',':'))
    return os.path.getsize(dst)

if __name__ == '__main__':
    if '--probe' in sys.argv:
        tot = 0
        for anno, gara in [('2024','British Grand Prix'), ('2023','British Grand Prix'), ('2025','British Grand Prix')]:
            d = scarica_sessione(anno, gara, 'Race')
            if d is None: print(f"{anno} {gara}: NON DISPONIBILE"); continue
            b = len(json.dumps(d, separators=(',',':')))
            tot += b
            print(f"{anno} {gara} Race: {len(d['time'])} righe, {b//1024} KB, colonne={len(d)}")
        print(f"\nstima mirror completo: ~{tot//3*28*3//(1024*1024)} MB "
              f"(media {tot//3//1024} KB x ~28 sessioni/stagione x 3 stagioni)")
        sys.exit(0)
    for anno in ANNI:
        n_ok = 0
        for gara in GARE:
            for sess in SESSIONI:
                dst = os.path.join('data','ti_archive',anno,gara,sess+'.json')
                if os.path.exists(dst) and os.path.getsize(dst) > 1000:
                    n_ok += 1; continue
                d = scarica_sessione(anno, gara, sess)
                if d is None: continue
                kb = salva(anno, gara, sess, d) // 1024
                n_ok += 1
                print(f"{anno} {gara} {sess}: {len(d['time'])} righe, {kb} KB", flush=True)
                time.sleep(0.05)
        print(f"== {anno}: {n_ok} sessioni nel mirror ==", flush=True)
    print("mirror storico completo.")
