import urllib.request, json, urllib.parse, statistics as st, pickle, time
def GET(u): return urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent':'muretto'}), timeout=40).read()
def raw_json(anno,path):
    u=f"https://raw.githubusercontent.com/TracingInsights-Archive/{anno}/main/{urllib.parse.quote(path)}"
    try: return json.loads(GET(u))
    except Exception: return None

GARE_2025=['Australian Grand Prix','Chinese Grand Prix','Japanese Grand Prix','Bahrain Grand Prix',
'Saudi Arabian Grand Prix','Miami Grand Prix','Emilia Romagna Grand Prix','Monaco Grand Prix',
'Spanish Grand Prix','Canadian Grand Prix','Austrian Grand Prix','British Grand Prix',
'Belgian Grand Prix','Hungarian Grand Prix','Dutch Grand Prix','Italian Grand Prix',
'Azerbaijan Grand Prix','Singapore Grand Prix','United States Grand Prix','Mexico City Grand Prix',
'São Paulo Grand Prix','Las Vegas Grand Prix','Qatar Grand Prix','Abu Dhabi Grand Prix']

FUEL=0.03
raw=pickle.load(open('data/_warmin_raw_multiyear.pkl','rb'))  # riparto da 2023+2024 gia' raccolti
temp,n_stint={},{}
verde=lambda r:str(r.get('status'))=='1'
outlap=lambda r:str(r.get('pout','None'))!='None'
inlap=lambda r:str(r.get('pin','None'))!='None'

def piloti_da_drivers(anno,gara,sess):
    dj=raw_json(anno,f"{gara}/{sess}/drivers.json")
    if not dj: return []
    # drivers.json: provo a estrarre i codici pilota qualunque sia la forma
    if isinstance(dj,dict):
        for v in dj.values():
            if isinstance(v,list) and v and isinstance(v[0],str) and len(v[0])==3: return v
        return [k for k in dj.keys() if isinstance(k,str) and len(k)==3]
    if isinstance(dj,list):
        out=[]
        for x in dj:
            if isinstance(x,str) and len(x)==3: out.append(x)
            elif isinstance(x,dict):
                for key in ('drv','code','abbreviation'):
                    if key in x: out.append(x[key])
        return out
    return []

got=0
for gara in GARE_2025:
    for sess in ('Race','Sprint'):
        piloti=piloti_da_drivers('2025',gara,sess)
        if not piloti: continue
        recs=[]
        for drv in piloti:
            dp=raw_json('2025',f"{gara}/{sess}/{drv}/laptimes.json")
            if not dp or 'time' not in dp: continue
            n=len(dp['time'])
            for i in range(n):
                r={k:dp[k][i] for k in dp if isinstance(dp[k],list) and len(dp[k])==n}
                r['drv']=r.get('drv',drv); recs.append(r)
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
                if -3<delta<15: raw.setdefault(('2025',comp,g),[]).append(delta)
            tt=rows[0].get('wTT')
            if isinstance(tt,(int,float)): temp.setdefault(('2025',comp),[]).append(tt)
            n_stint[('2025',comp)]=n_stint.get(('2025',comp),0)+1
        time.sleep(0.03)

print(f"sessioni 2025 con dati: {got}")
print("\n=== WARM-IN 3 STAGIONI (g0=primo giro lanciato) ===")
print(f"{'anno':5} {'comp':7} {'g0':>7} {'g1':>7} {'n':>6}")
for anno in ('2023','2024','2025'):
    for comp in ('SOFT','MEDIUM','HARD'):
        g0=raw.get((anno,comp,0)); g1=raw.get((anno,comp,1))
        v0=round(st.median(g0),3) if g0 else None
        v1=round(st.median(g1),3) if g1 else None
        nn=len(g0) if g0 else 0
        print(f"{anno:5} {comp:7} {str(v0):>7} {str(v1):>7} {nn:>6}")
pickle.dump(raw, open('data/_warmin_raw_multiyear.pkl','wb'))
print("\nse 2025 e' coerente con 2023/2024 -> verificato su 3 stagioni consecutive.")
