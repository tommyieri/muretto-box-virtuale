import urllib.request, json, urllib.parse, statistics as st, pickle, time
def GET(u): return urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent':'muretto'}), timeout=40).read()
def raw_json(anno,path):
    u=f"https://raw.githubusercontent.com/TracingInsights-Archive/{anno}/main/{urllib.parse.quote(path)}"
    try: return json.loads(GET(u))
    except Exception: return None

GARE=['Australian Grand Prix','Chinese Grand Prix','Japanese Grand Prix','Bahrain Grand Prix',
'Saudi Arabian Grand Prix','Miami Grand Prix','Emilia Romagna Grand Prix','Monaco Grand Prix',
'Spanish Grand Prix','Canadian Grand Prix','Austrian Grand Prix','British Grand Prix',
'Belgian Grand Prix','Hungarian Grand Prix','Dutch Grand Prix','Italian Grand Prix',
'Azerbaijan Grand Prix','Singapore Grand Prix','United States Grand Prix','Mexico City Grand Prix',
'São Paulo Grand Prix','Las Vegas Grand Prix','Qatar Grand Prix','Abu Dhabi Grand Prix']

def piloti(anno,gara,sess):
    dj=raw_json(anno,f"{gara}/{sess}/drivers.json")
    if isinstance(dj,dict) and isinstance(dj.get('drivers'),list):
        return [x['driver'] for x in dj['drivers'] if isinstance(x,dict) and 'driver' in x]
    return []

def sessione(anno,gara,sess):
    # A: consolidato
    d=raw_json(anno,f"{gara}/{sess}/session_laptimes.json")
    if d and 'time' in d:
        n=len(d['time']); return [{k:d[k][i] for k in d if isinstance(d[k],list) and len(d[k])==n} for i in range(n)]
    # B: per-pilota
    recs=[]
    for drv in piloti(anno,gara,sess):
        dp=raw_json(anno,f"{gara}/{sess}/{drv}/laptimes.json")
        if not dp or 'time' not in dp: continue
        n=len(dp['time'])
        for i in range(n):
            r={k:dp[k][i] for k in dp if isinstance(dp[k],list) and len(dp[k])==n}
            r['drv']=r.get('drv',drv); recs.append(r)
    return recs

FUEL=0.03
raw=pickle.load(open('data/_warmin_raw_multiyear.pkl','rb'))  # ha 2023
# ripulisco eventuali 2024/2025 parziali per ri-raccoglierli netti
raw={k:v for k,v in raw.items() if k[0]=='2023'}
n_stint={}
verde=lambda r:str(r.get('status'))=='1'
outlap=lambda r:str(r.get('pout','None'))!='None'
inlap=lambda r:str(r.get('pin','None'))!='None'

for anno in ('2024','2025'):
    got=0
    for gara in GARE:
        for sess in ('Race','Sprint'):
            recs=sessione(anno,gara,sess)
            if not recs: continue
            got+=1
            by={}
            for r in recs: by.setdefault((r.get('drv'),r.get('stint')),[]).append(r)
            for rows in by.values():
                rows=[r for r in rows if isinstance(r.get('life'),(int,float)) and isinstance(r.get('time'),(int,float))]
                rows.sort(key=lambda r:r['life'])
                if not rows: continue
                comp=rows[0].get('compound')
                if comp not in ('SOFT','MEDIUM','HARD'): continue
                if rows[0].get('fresh') is not True: continue
                clean=lambda r:verde(r) and not outlap(r) and not inlap(r)
                caldo=[r['time'] for r in rows if 4<=r['life']<=6 and clean(r)]
                if not caldo: continue
                base=st.median(caldo)
                for g,life in [(0,2),(1,3),(2,4)]:
                    cand=[r['time'] for r in rows if r['life']==life and clean(r)]
                    if not cand: continue
                    delta=cand[0]-base-(5-life)*1.8*FUEL
                    if -3<delta<15: raw.setdefault((anno,comp,g),[]).append(delta)
                n_stint[(anno,comp)]=n_stint.get((anno,comp),0)+1
            time.sleep(0.03)
    print(f"{anno}: {got} sessioni con dati", flush=True)

print("\n=== WARM-IN 3 STAGIONI (g0=primo giro lanciato, life=2) ===")
print(f"{'anno':5} {'comp':7} {'g0':>7} {'g1':>7} {'n':>6}")
for anno in ('2023','2024','2025'):
    for comp in ('SOFT','MEDIUM','HARD'):
        g0=raw.get((anno,comp,0)); g1=raw.get((anno,comp,1))
        print(f"{anno:5} {comp:7} {str(round(st.median(g0),3) if g0 else None):>7} {str(round(st.median(g1),3) if g1 else None):>7} {len(g0) if g0 else 0:>6}")
pickle.dump(raw, open('data/_warmin_raw_multiyear.pkl','wb'))
print("\nverifica: g0 coerente su 3 stagioni per compound?")
