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
    # AGGIUNTI 28/07/2026 (audit del kernel, autorizzato dal PO). Senza questi due campi il
    # filtro "verde" di pace_base non PUO' essere corretto: lo status grezzo e il flag di
    # giro cancellato non arrivavano fin qui, quindi 421 giri di bandiera gialla e 153 giri
    # cancellati entravano nella mediana del passo. Additivi, con default: nessun chiamante
    # esistente si rompe.  Vedi ai_lab/simulatore/REPORT_FASE2.md §1.
    status:Optional[str]=None; deleted:bool=False

@dataclass(frozen=True)
class RaceState:
    t:Optional[float]; circuit:str; n_laps:int; cars:Mapping[str,CarObs]
    pending:Mapping[str,float]=field(default_factory=lambda:MappingProxyType({}))

# CORRETTO 28/07/2026. Prima: ('4' in s) or ('6' in s).
# L'alfabeto degli status e' {1,2,4,5,6,7} ed e' scritto in data/STATUS_VOCABOLARIO_NOTA.md:
# 4 = SC, 5 = BANDIERA ROSSA, 6 = VSC, tutti e tre CODICI COMMITTATI. Il 5 mancava, quindi un
# giro di gara sospesa passava per verde (a Monaco sono ~38 minuti dentro un lap_time).
# 2 (gialla di settore) e 7 (VSC in chiusura) NON entrano qui: il vocabolario li marca
# "ipotesi FIA, non committata", e `neutralized` e' un regime dichiarato, non un sospetto.
# Che non siano VERDI e' un'altra affermazione, piu' debole, e vive nel filtro di pace_base.
def _neut(s): s=str(s); return ('4' in s) or ('5' in s) or ('6' in s)

def ti_adapter(raw, circuit):
    df=raw.copy()
    for c in ['sesT','lap','stint','life']: df[c]=pd.to_numeric(df[c],errors='coerce')
    df['time']=pd.to_numeric(df['time'].astype(object).where(df['time'].astype(str)!='None'),errors='coerce')
    for c in ['pin','pout']: df[c]=df[c].astype(object).where(df[c].astype(str)!='None')
    df=df.dropna(subset=['lap']); N=int(df['lap'].max()); teams=df.groupby('drv')['team'].first().to_dict()
    # IL LETTERALE 'None' (corretto 28/07/2026). Il grezzo scrive la STRINGA 'None' per i
    # mancanti. `time`, `pin`, `pout`, `stint`, `life` erano gia' lavati; `compound` no —
    # e' una str, quindi `isinstance(...,str)` la lasciava passare tale e quale. Risultato:
    # compound = "None" (stringa) fino in pagina — 25 celle su Ungheria, PER giri 22-46.
    # Trovato in Fase 0 (ai_lab/simulatore/verifica_derivati.py).
    _comp=lambda x: x if (isinstance(x,str) and x!='None' and x!='') else None
    states=[]
    for L,grp in df.groupby('lap'):
        cars={r['drv']:CarObs(teams.get(r['drv']),
            float(r['sesT']) if pd.notna(r['sesT']) else None,
            float(r['time']) if pd.notna(r['time']) else None, int(r['lap']),
            int(r['stint']) if pd.notna(r['stint']) else None,
            _comp(r['compound']),
            int(r['life']) if pd.notna(r['life']) else None,
            pd.notna(r['pin']),pd.notna(r['pout']),_neut(r['status']),
            str(r['status']) if pd.notna(r.get('status')) else None,
            bool(r['del']) if ('del' in grp.columns and pd.notna(r['del'])) else False)
            for _,r in grp.iterrows()}
        states.append(RaceState(None,circuit,N,MappingProxyType(cars)))
    return states,N

FUEL_COEFF=3.0/70.0
SLICK=('SOFT','MEDIUM','HARD')

def _verde(o):
    """Un giro entra nella mediana del passo solo se e' UNA MISURA PULITA DI PASSO.

    CORRETTO 28/07/2026 (audit del kernel). Prima bastava: ha un tempo, non e' neutralizzato
    secondo _neut, non e' in/out-lap. Misurato sulle 11 gare 2026, quel filtro ammetteva:
        421 giri di BANDIERA GIALLA (status contiene '2')  — piu' lenti, ma non neutralizzati
        153 giri CANCELLATI dai commissari                 — il campo non arrivava fin qui
         30 giri su gomma da BAGNATO                       — un'altra grandezza fisica
    Effetto sul passo: mediano 0,000 s (la mediana e' robusta) ma l'11,4% delle celle si
    sposta di oltre 0,10 s e lo 0,82% di oltre 0,50 s, con punte di 2,93 s. Il danno e'
    tutto nelle CODE, cioe' quando il pilota ha pochi giri validi nello stint: subito dopo
    una sosta, che e' il momento in cui il muretto guarda il pannello.

    PREZZO, misurato prima di decidere: la copertura scende di 1,00 punto (148 celle su
    14.748 perdono il passo). Undici punti percentuali di celle migliori contro uno di
    silenzio in piu': si paga.

    Qui `status == '1'` esatto — verde puro. E' piu' severo di `neutralized` di proposito:
    "non e' un regime di neutralizzazione dichiarato" e "e' una misura pulita di passo" sono
    due affermazioni diverse, e per il passo serve la seconda.
    """
    return (o.lap_time is not None and str(o.status or '')=='1' and not o.deleted
            and not o.in_lap and not o.out_lap and o.compound in SLICK)

def pace_base(history, N, drv, L):
    obs=[s.cars[drv] for s in history if drv in s.cars and s.cars[drv].lap<=L]
    if not obs: return None
    cur=obs[-1].stint
    seg=[o for o in obs if o.stint==cur and _verde(o)]
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
    # GEMELLO della correzione in demo/engine.mjs (28/07/2026): chi non ha un passo esce con
    # cum_time = None, non col cum del giro di congelamento. Un pilota fermo mentre la gara
    # scorre e' una bugia che sembra un numero; nel banco JS valeva 480 s di errore su 5 giri.
    def apply(self, st):
        new={d:replace(c, cum_time=((c.cum_time+st.pending[d]) if (d in st.pending and c.cum_time is not None) else None),
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
