import os, sys, pandas as pd
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "engine"))
from engine import (ti_adapter, load, PaceModel, TrafficModel, AdvanceModel,
                    SimulationKernel, FILES)

DATA = os.path.join(os.path.dirname(__file__), "data")
G = pd.read_csv(os.path.join(DATA, "golden_testB.csv"))
DRIFT = G["drift"].median()

def run_testB(models_factory):
    out=[]
    for gara in FILES:
        states,N = ti_adapter(load(gara), gara)
        by_lap={s.cars[next(iter(s.cars))].lap: s for s in states}
        pos={(d,s.cars[d].lap): s.cars[d].cum_time for s in states for d in s.cars}
        gg=G[G.gara==gara]
        for L,grp in gg.groupby("L"):
            if L not in by_lap: continue
            fin=SimulationKernel().run(by_lap[L], models_factory(states,N,L), 5)
            for _,r in grp.iterrows():
                A,B=r["A"],r["B"]
                if A not in fin.cars or B not in fin.cars: continue
                cA,cB=fin.cars[A].cum_time, fin.cars[B].cum_time
                gE,aE=pos.get((B,L+5)),pos.get((A,L+5))
                if None in (cA,cB,gE,aE): continue
                out.append(dict(gara=gara,err=abs((cB-cA)-(gE-aE)),err_gold=r["err"]))
    return pd.DataFrame(out)

print("PROVA DEL NOVE — Test B in locale sul Mac\n")

R1=run_testB(lambda h,N,L:[PaceModel(h,N,L), AdvanceModel()])
d1=(R1["err"]-R1["err_gold"]).abs()
ok1 = len(R1)==449 and d1.max()<1e-6
print(f"[Pace, Advance]          : n={len(R1)} | max diff vs golden {d1.max():.2e} | {'GOLDEN OK' if ok1 else 'DEVIAZIONE'}")

R2=run_testB(lambda h,N,L:[PaceModel(h,N,L), TrafficModel(), AdvanceModel()])
med=R2["err"].median()
gain=100*(DRIFT-med)/DRIFT
ok2 = med<2.10
print(f"[Pace, Traffic, Advance] : n={len(R2)} | mediana {med:.3f} (golden 2.231) | +{gain:.0f}% vs gap-fermo")

print()
if ok1 and ok2:
    print("=> MIGRAZIONE FATTA: engine fuori da Colab riproduce golden a precisione-float e +27%.")
else:
    print("=> INDAGARE: un numero non torna, la migrazione NON e' validata.")
