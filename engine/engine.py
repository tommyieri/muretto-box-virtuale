import os, json, urllib.parse, urllib.request, numpy as np, pandas as pd
from dataclasses import dataclass, replace, field
from types import MappingProxyType
from typing import Mapping, Optional

DATA = os.path.join(os.path.dirname(__file__), "..", "data")
TICACHE = os.path.join(DATA, "ti_cache")

@dataclass(frozen=True)
class CarObs:
    team:Optional[str]; cum_time:Optional[float]; lap_time:Optional[float]; lap:int
    stint:Optional[int]; compound:Optional[str]; tyre_age:Optional[int]
    in_lap:bool; out_lap:bool; neutralized:bool

@dataclass(frozen=True)
class RaceState:
    t:Optional[float]; circuit:str; n_laps:int; cars:Mapping[str,CarObs]
    pending:Mapping[str,float]=field(default_factory=lambda:MappingProxyType({}))

def _neut(s): s=str(s); return ('4' in s) or ('6' in s)

def ti_adapter(raw, circuit):
    df=raw.copy()
    for c in ['sesT','lap','stint','life']: df[c]=pd.to_numeric(df[c],errors='coerce')
    df['time']=pd.to_numeric(df['time'].astype(object).where(df['time'].astype(str)!='None'),errors='coerce')
    for c in ['pin','pout']: df[c]=df[c].astype(object).where(df[c].astype(str)!='None')
    df=df.dropna(subset=['lap']); N=int(df['lap'].max()); teams=df.groupby('drv')['team'].first().to_dict()
    states=[]
    for L,grp in df.groupby('lap'):
        cars={r['drv']:CarObs(teams.get(r['drv']),
            float(r['sesT']) if pd.notna(r['sesT']) else None,
            float(r['time']) if pd.notna(r['time']) else None, int(r['lap']),
            int(r['stint']) if pd.notna(r['stint']) else None,
            r['compound'] if isinstance(r['compound'],str) else None,
            int(r['life']) if pd.notna(r['life']) else None,
            pd.notna(r['pin']),pd.notna(r['pout']),_neut(r['status'])) for _,r in grp.iterrows()}
        states.append(RaceState(None,circuit,N,MappingProxyType(cars)))
    return states,N

FUEL_COEFF=3.0/70.0
def pace_base(history, N, drv, L):
    obs=[s.cars[drv] for s in history if drv in s.cars and s.cars[drv].lap<=L]
    if not obs: return None
    cur=obs[-1].stint
    seg=[o for o in obs if o.stint==cur and o.lap_time is not None and not o.neutralized and not o.in_lap and not o.out_lap]
    if len(seg)<3: return None
    fpl=70.0/N
    return float(np.median([o.lap_time-max(0,70.0-fpl*(o.lap-1))*FUEL_COEFF for o in seg]))

class PaceModel:
    def __init__(self, history, N, freeze_lap):
        seen=set().union(*[set(s.cars) for s in history])
        self.pace={d: pace_base(history, N, d, freeze_lap) for d in seen}
    def apply(self, st):
        return replace(st, pending=MappingProxyType({d:self.pace[d] for d in st.cars if self.pace.get(d) is not None}))

class TrafficModel:
    def __init__(self, ZONE=1.5, STRENGTH=1.0, track=1.0):
        self.ZONE, self.STRENGTH, self.track = ZONE, STRENGTH, track
    def apply(self, st):
        cand=sorted([(d,st.cars[d].cum_time) for d in st.pending if st.cars[d].cum_time is not None], key=lambda x:(x[1], x[0]))
        eff=dict(st.pending)
        for i in range(1,len(cand)):
            d,ct=cand[i]; dfr,ctf=cand[i-1]; gap=ct-ctf
            if eff[d]<eff[dfr] and gap<self.ZONE:
                capf=self.track*self.STRENGTH
                eff[d]=eff[d]+capf*(eff[dfr]-eff[d])
        return replace(st, pending=MappingProxyType(eff))

class AdvanceModel:
    def apply(self, st):
        new={d:replace(c, cum_time=(c.cum_time+st.pending[d] if (d in st.pending and c.cum_time is not None) else c.cum_time),
                       lap=c.lap+1, tyre_age=(c.tyre_age+1 if c.tyre_age is not None else None)) for d,c in st.cars.items()}
        return RaceState(st.t, st.circuit, st.n_laps, MappingProxyType(new), MappingProxyType({}))

class SimulationKernel:
    def run(self, state0, models, n_steps):
        st=state0
        for _ in range(n_steps):
            for m in models: st=m.apply(st)
        return st

FILES={"Australia":"Australian","Cina":"Chinese","Giappone":"Japanese","Miami":"Miami",
       "Canada":"Canadian","Monaco":"Monaco","Spagna":"Barcelona","Austria":"Austrian"}
FOLDER={"Australia":"Australian Grand Prix","Cina":"Chinese Grand Prix","Giappone":"Japanese Grand Prix",
        "Miami":"Miami Grand Prix","Canada":"Canadian Grand Prix","Monaco":"Monaco Grand Prix",
        "Spagna":"Barcelona Grand Prix","Austria":"Austrian Grand Prix"}

def load(gara):
    loc=os.path.join(TICACHE, FILES[gara]+".json")
    if not (os.path.exists(loc) and os.path.getsize(loc)>1000):
        url=f"https://raw.githubusercontent.com/TracingInsights/2026/main/{urllib.parse.quote(FOLDER[gara])}/Race/session_laptimes.json"
        urllib.request.urlretrieve(url, loc)
    return pd.DataFrame(json.load(open(loc)))
