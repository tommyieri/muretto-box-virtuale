import urllib.request, json, urllib.parse, statistics as st, pickle, time
ANNI=['2023','2024','2025']
def GET(u): return urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent':'muretto'}), timeout=40).read()
def api(anno,path=''):
    u=f"https://api.github.com/repos/TracingInsights-Archive/{anno}/contents/{urllib.parse.quote(path)}"
    try: return json.loads(GET(u))
    except Exception: return []
def raw_json(anno,path):
    u=f"https://raw.githubusercontent.com/TracingInsights-Archive/{anno}/main/{urllib.parse.quote(path)}"
    try: return json.loads(GET(u))
    except Exception: return None

def sessione_records(anno, gara, sess):
    # strategia A: file consolidato
    d = raw_json(anno, f"{gara}/{sess}/session_laptimes.json")
    if d and 'time' in d:
        n=len(d['time'])
        return [{k:d[k][i] for k in d if isinstance(d[k],list) and len(d[k])==n} for i in range(n)]
    # strategia B: per-pilota
    items = api(anno, f"{gara}/{sess}")
    piloti=[it['name'] for it in items if it['type']=='dir']
    recs=[]
    for drv in piloti:
        dp = raw_json(anno, f"{gara}/{sess}/{drv}/laptimes.json")
        if not dp or 'time' not in dp: continue
        n=len(dp['time'])
        for i in range(n):
            r={k:dp[k][i] for k in dp if isinstance(dp[k],list) and len(dp[k])==n}
            r['drv']=r.get('drv',drv); recs.append(r)
    return recs

FUEL=0.03
raw,temp,n_stint={},{},{}
verde  = lambda r: str(r.get('status'))=='1'
outlap = lambda r: str(r.get('pout','None'))!='None'
inlap  = lambda r: str(r.get('pin','None'))!='None'

for anno in ANNI:
    gare=[it['name'] for it in api(anno) if it['type']=='dir' and 'Grand Prix' in it['name'] and 'Testing' not in it['name']]
    print(f"{anno}: {len(gare)} gare", flush=True)
    for gara in gare:
        for sess in ('Race','Sprint'):
            recs=sessione_records(anno,gara,sess)
            if not recs: continue
            by={}
            for r in recs: by.setdefault((r.get('drv'),r.get('stint')),[]).append(r)
            for rows in by.values():
                rows=[r for r in rows if isinstance(r.get('life'),(int,float)) and isinstance(r.get('time'),(int,float))]
                rows.sort(key=lambda r:r['life'])
                if not rows: continue
                comp=rows[0].get('compound')
                if comp not in ('SOFT','MEDIUM','HARD'): continue
                if rows[0].get('fresh') is not True: continue
                clean=lambda r: verde(r) and not outlap(r) and not inlap(r)
                caldo=[r['time'] for r in rows if 4<=r['life']<=6 and clean(r)]
                if not caldo: continue
                base=st.median(caldo)
                for g,life in [(0,2),(1,3),(2,4)]:
                    cand=[r['time'] for r in rows if r['life']==life and clean(r)]
                    if not cand: continue
                    delta=cand[0]-base-(5-life)*1.8*FUEL
                    if -3<delta<15: raw.setdefault((anno,comp,g),[]).append(delta)
                tt=rows[0].get('wTT')
                if isinstance(tt,(int,float)): temp.setdefault((anno,comp),[]).append(tt)
                n_stint[(anno,comp)]=n_stint.get((anno,comp),0)+1
        time.sleep(0.05)

print("\n=== WARM-IN per STAGIONE x COMPOUND (g0=life2, g1=life3, g2=life4) ===")
print(f"{'anno':5} {'comp':7} {'g0':>7} {'g1':>7} {'g2':>7} {'n':>6} {'trkT':>6}")
for anno in ANNI:
    for comp in ('SOFT','MEDIUM','HARD'):
        g=[round(st.median(raw[(anno,comp,gs)]),3) if raw.get((anno,comp,gs)) else None for gs in (0,1,2)]
        tt=temp.get((anno,comp),[]); ttm=round(st.mean(tt),1) if tt else None
        print(f"{anno:5} {comp:7} {str(g[0]):>7} {str(g[1]):>7} {str(g[2]):>7} {str(n_stint.get((anno,comp),0)):>6} {str(ttm):>6}")
pickle.dump(raw, open('data/_warmin_raw_multiyear.pkl','wb'))
print("\nPROVA DEL NOVE: g0 coerenti tra le 3 stagioni per compound?")
