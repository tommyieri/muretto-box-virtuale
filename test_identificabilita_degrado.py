"""test_identificabilita_degrado.py — Fase 2.1: il degrado gomma e' identificabile dai dati 2026?

!! DA RIVERIFICARE (rifondazione 21/07/2026) — ai_lab/scienziato/RETROCESSIONE.md
   FUEL_SKG*FUEL_KG = 2,1 s e' una SECONDA costante carburante, diversa da quella del
   motore (3,0 s). La pre-correzione qui applicata e' un'IPOTESI: i gamma stimati sono
   condizionati. Il metodo (filtri contati, rango, cluster-robust) si conserva.

MODELLO (per gara, mai pooled tra gare):
    tempo_fc = alpha(pilota) + delta_compound + beta*giro + gamma_compound*life + eps
  - alpha per PILOTA-GARA (mai per stint: l'effetto fisso per stint assorbirebbe l'offset
    life-giro e renderebbe gamma non identificato — vincolo di disegno della Fase 2.1);
  - delta_compound: livello di passo del compound (rif. MEDIUM) — senza, il salto di passo
    tra mescole finirebbe dentro gamma;
  - beta*giro: evoluzione pista + residuo fuel (lineari nel giro, non separabili tra loro
    ne' necessarie separate); variante quadratica come robustezza;
  - gamma_compound*life: il degrado. Identificato SOLO dalla desincronizzazione cross-stint.

FUEL: tempo_fc = tempo - 0.03 s/kg * 70 kg * (1-(giro-1)/N). Lineare nel giro -> incide su
beta, NON su gamma (per questo la scelta del coefficiente non e' critica qui).

FILTRI (dichiarati; conteggiati per gara):
  F1 status=='1' (verdi)   F2 no in/out-lap (pin/pout nulli)   F3 compound slick
  F4 time/lap/life/stint numerici   F5 giro>=2 (via da fermo)   F6 life>=3 (out-lap e
  warm-in g0 esclusi; residuo warm-in a life=3 <=0.18s da warmin_prior.csv, dichiarato)
  F7 outlier: entro (pilota,stint), tempo <= 1.07 * mediana stint (aggressivita' verificata
  a 1.05/1.07/1.10 prima dell'adozione — vedi output).

GUARDRAIL D'IDENTIFICAZIONE (mai scarti silenziosi):
  - un compound entra solo con >=3 stint distinti e >=30 giri validi nella gara,
    altrimenti e' dichiarato "non identificabile" e i suoi giri sono ESCLUSI esplicitamente;
  - controllo di rango della design matrix: se rank<k la gara e' dichiarata non
    identificabile (niente pinv silenziosa).

INFERENZA: OLS, SE cluster-robust per (pilota,stint) con correzione small-sample. IC95.

CRITERI GO (dichiarati prima di guardare i risultati — data/DEGRADO_NOTA.txt):
  G1 gamma_MEDIUM e gamma_HARD con IC95 che esclude 0 in >=5 gare ciascuno
     (SOFT riportato ma non vincolante: pochi stint lunghi in gara);
  G2 ordinamento SOFT>=MEDIUM>=HARD dove i compound sono co-identificati
     (violazione forte = inversione con IC disgiunti);
  G3 stabilita' di segno: nessun compound significativo con segni opposti in gare diverse;
  G4 coerenza col prior storico stint_gold 2023-25 (S .07-.09, M .05-.07, H .04-.06 s/giro):
     mediana cross-gara di gamma entro un fattore 3, attesa >= dello storico
     (lo storico e' un PAVIMENTO: la contaminazione da evoluzione spinge le slope
     per-stint verso il basso — vedi nota).
"""
import json, os, statistics as st
import numpy as np

FUEL_SKG, FUEL_KG = 0.03, 70.0
SOGLIA_OUTLIER = 1.07
SLICK = ('SOFT','MEDIUM','HARD')
MIN_STINT, MIN_GIRI = 3, 30

RACES = {
 'Australia':'data/ti_cache/Australian.json','Cina':'data/ti_cache/Chinese.json',
 'Giappone':'data/ti_cache/Japanese.json','Miami':'data/ti_cache/Miami.json',
 'Monaco':'data/ti_cache/Monaco.json','Spagna':'data/ti_cache/Barcelona.json',
 'Austria':'data/ti_cache/Austrian.json',
 'British':'data/ti_archive/2026/British Grand Prix/Race.json'}
# Canada Race ESCLUSA: partenza su pista umida (7 piloti su INTERMEDIATE, giri 1-3) — drycheck_2026.py
SPRINTS = {
 'Cina-SPR':'data/ti_archive/2026/Chinese Grand Prix/Sprint.json',
 'Miami-SPR':'data/ti_archive/2026/Miami Grand Prix/Sprint.json',
 'Canada-SPR':'data/ti_archive/2026/Canadian Grand Prix/Sprint.json',
 'British-SPR':'data/ti_archive/2026/British Grand Prix/Sprint.json'}

def nullo(x): return x is None or str(x)=='None'

def carica(path):
    d = json.load(open(path)); n = len(d['time'])
    rows=[]
    for i in range(n):
        rows.append({k: d[k][i] for k in ('drv','lap','time','life','stint','compound','status','pin','pout')})
    return rows

def pulisci(rows):
    N = max(int(r['lap']) for r in rows if r['lap'] is not None)
    keep, scarti = [], {'F1_status':0,'F2_inout':0,'F3_compound':0,'F4_nan':0,'F5_giro1':0,'F6_life':0}
    for r in rows:
        if not all(isinstance(r[k],(int,float)) for k in ('lap','time','life','stint')): scarti['F4_nan']+=1; continue
        if str(r['status'])!='1': scarti['F1_status']+=1; continue
        if not (nullo(r['pin']) and nullo(r['pout'])): scarti['F2_inout']+=1; continue
        if r['compound'] not in SLICK: scarti['F3_compound']+=1; continue
        if int(r['lap'])<2: scarti['F5_giro1']+=1; continue
        if int(r['life'])<3: scarti['F6_life']+=1; continue
        keep.append(r)
    return keep, scarti, N

def filtro_outlier(keep, soglia):
    per_stint={}
    for r in keep: per_stint.setdefault((r['drv'],int(r['stint'])),[]).append(r)
    out=[]; n_scartati=0
    for rows in per_stint.values():
        med = st.median([r['time'] for r in rows])
        for r in rows:
            if r['time'] <= soglia*med: out.append(r)
            else: n_scartati+=1
    return out, n_scartati

def fit(keep, N):
    """ritorna dict per compound {gamma, se, lo, hi, n_giri, n_stint} + diagnostica, o None se non identificabile."""
    # guardrail compound
    stint_per_c, giri_per_c = {}, {}
    for r in keep:
        c=r['compound']; giri_per_c[c]=giri_per_c.get(c,0)+1
        stint_per_c.setdefault(c,set()).add((r['drv'],int(r['stint'])))
    ident=[c for c in SLICK if len(stint_per_c.get(c,()))>=MIN_STINT and giri_per_c.get(c,0)>=MIN_GIRI]
    esclusi={c:(len(stint_per_c.get(c,())),giri_per_c.get(c,0)) for c in SLICK if c not in ident}
    rows=[r for r in keep if r['compound'] in ident]
    if not ident or not rows: return None, ident, esclusi, 'nessun compound identificabile'
    rif = 'MEDIUM' if 'MEDIUM' in ident else ident[0]   # riferimento livello
    drvs = sorted({r['drv'] for r in rows}); di={d:i for i,d in enumerate(drvs)}
    nd, nc = len(drvs), len(ident)
    lap_m = st.mean([r['lap'] for r in rows])
    cols  = nd + (nc-1) + 1 + nc                          # alpha + delta + beta + gamma
    X = np.zeros((len(rows), cols)); y=np.zeros(len(rows)); gruppo=[]
    delta_idx={c:nd+j for j,c in enumerate([c for c in ident if c!=rif])}
    beta_idx = nd+(nc-1)
    gamma_idx={c:beta_idx+1+j for j,c in enumerate(ident)}
    for i,r in enumerate(rows):
        X[i,di[r['drv']]]=1.0
        if r['compound']!=rif: X[i,delta_idx[r['compound']]]=1.0
        X[i,beta_idx]=r['lap']-lap_m
        X[i,gamma_idx[r['compound']]]=r['life']
        y[i]=r['time'] - FUEL_SKG*FUEL_KG*(1-(r['lap']-1)/N)
        gruppo.append((r['drv'],int(r['stint'])))
    # CONTROLLO DI RANGO ESPLICITO — la trappola dello scarto silenzioso
    rank = np.linalg.matrix_rank(X)
    if rank < X.shape[1]:
        return None, ident, esclusi, f'design matrix rank-deficiente ({rank}/{X.shape[1]})'
    b,*_ = np.linalg.lstsq(X,y,rcond=None)
    u = y - X@b
    XtX_inv = np.linalg.inv(X.T@X)
    G=len(set(gruppo)); n,k=X.shape
    meat=np.zeros((k,k))
    per_g={}
    for i,g in enumerate(gruppo): per_g.setdefault(g,[]).append(i)
    for idx in per_g.values():
        Xg,ug=X[idx],u[idx]; s=Xg.T@ug; meat+=np.outer(s,s)
    V = XtX_inv@meat@XtX_inv * (G/(G-1))*((n-1)/(n-k))
    se = np.sqrt(np.diag(V))
    out={}
    for c in ident:
        j=gamma_idx[c]
        out[c]=dict(gamma=b[j], se=se[j], lo=b[j]-1.96*se[j], hi=b[j]+1.96*se[j],
                    n_giri=giri_per_c[c], n_stint=len(stint_per_c[c]))
    # variante quadratica (robustezza forma di f(giro))
    Xq=np.column_stack([X,( np.array([r['lap'] for r in rows])-lap_m)**2])
    if np.linalg.matrix_rank(Xq)==Xq.shape[1]:
        bq,*_=np.linalg.lstsq(Xq,y,rcond=None)
        for c in ident: out[c]['gamma_quad']=bq[gamma_idx[c]]
    # curvatura residua (modello lineare): media residui per quintile di giro
    lapv=np.array([r['lap'] for r in rows]); qs=np.quantile(lapv,[0,.2,.4,.6,.8,1.0])
    curv=[float(np.mean(u[(lapv>=qs[i])&(lapv<=qs[i+1])])) for i in range(5)]
    return out, ident, esclusi, dict(n=len(rows), n_cluster=G, curvatura_quintili=curv)

def run(sessioni, titolo):
    print(f"\n{'='*100}\n{titolo}\n{'='*100}")
    risultati={}
    for nome,path in sessioni.items():
        if not os.path.exists(path): print(f"{nome}: FILE ASSENTE — salto"); continue
        rows=carica(path); keep,scarti,N=pulisci(rows)
        # verifica aggressivita' filtro outlier PRIMA dell'adozione
        n_out={s: filtro_outlier(keep,s)[1] for s in (1.05,1.07,1.10)}
        keep,_=filtro_outlier(keep,SOGLIA_OUTLIER)
        res,ident,esclusi,diag=fit(keep,N)
        print(f"\n--- {nome} (N={N}) --- giri validi {len(keep)} | scarti {scarti} | "
              f"outlier@1.05/1.07/1.10: {n_out[1.05]}/{n_out[1.07]}/{n_out[1.10]}")
        if esclusi: print(f"    compound non identificabili (stint,giri): {esclusi}")
        if res is None: print(f"    NON IDENTIFICABILE: {diag}"); risultati[nome]=None; continue
        for c in SLICK:
            if c not in res: continue
            r=res[c]; sig='*' if (r['lo']>0 or r['hi']<0) else ' '
            gq=f" | quad {r['gamma_quad']:+.3f}" if 'gamma_quad' in r else ''
            print(f"    gamma_{c:6s} = {r['gamma']:+.4f} s/giro  IC95 [{r['lo']:+.4f},{r['hi']:+.4f}]{sig} "
                  f"(giri {r['n_giri']}, stint {r['n_stint']}){gq}")
        print(f"    curvatura residua per quintile di giro: {[round(x,3) for x in diag['curvatura_quintili']]}")
        risultati[nome]=res
    return risultati

if __name__=='__main__':
    R = run(RACES, "GARE 2026 (dry, complete) — test di identificabilita'")
    S = run(SPRINTS, "SPRINT 2026 — solo verifica incrociata (pochi pit attesi: guardrail al lavoro)")

    print(f"\n{'='*100}\nVALUTAZIONE CRITERI GO (dichiarati in testa allo script)\n{'='*100}")
    PRIOR={'SOFT':(.072,.091),'MEDIUM':(.047,.071),'HARD':(.039,.059)}
    per_c={c:[] for c in SLICK}
    for nome,res in R.items():
        if res:
            for c,r in res.items(): per_c[c].append((nome,r))
    for c in SLICK:
        vs=per_c[c]; sig=[(n,r) for n,r in vs if r['lo']>0 or r['hi']<0]
        segni={('+' if r['gamma']>0 else '-') for n,r in sig}
        med=st.median([r['gamma'] for _,r in vs]) if vs else None
        print(f"gamma_{c:6s}: identificabile in {len(vs)} gare, IC esclude 0 in {len(sig)} "
              f"({[n for n,_ in sig]}), segni significativi {segni or '{}'}, mediana {med if med is None else round(med,4)} "
              f"(prior storico {PRIOR[c]})")
    g1 = len([1 for n,r in per_c['MEDIUM'] if r['lo']>0 or r['hi']<0])>=5 and \
         len([1 for n,r in per_c['HARD'] if r['lo']>0 or r['hi']<0])>=5
    print(f"\nG1 (MEDIUM e HARD significativi in >=5 gare): {'PASS' if g1 else 'FAIL'}")
    # G2 ordinamento nelle gare con >=2 compound co-identificati
    v_ord, n_conf=0,0
    for nome,res in R.items():
        if not res: continue
        pres=[c for c in SLICK if c in res]
        for a,bc in [('SOFT','MEDIUM'),('MEDIUM','HARD'),('SOFT','HARD')]:
            if a in pres and bc in pres:
                n_conf+=1
                if res[a]['gamma']<res[bc]['gamma']:
                    forte = res[a]['hi']<res[bc]['lo']
                    v_ord+=1
                    print(f"  G2 violazione{' FORTE' if forte else ''}: {nome} gamma_{a}<{'gamma_'+bc}")
    print(f"G2 (ordinamento S>=M>=H): {n_conf-v_ord}/{n_conf} confronti rispettati")
    g3 = all(len({('+' if r['gamma']>0 else '-') for n,r in per_c[c] if r['lo']>0 or r['hi']<0})<=1 for c in SLICK)
    print(f"G3 (stabilita' segno): {'PASS' if g3 else 'FAIL'}")
    for c in SLICK:
        if per_c[c]:
            med=st.median([r['gamma'] for _,r in per_c[c]]); lo,hi=PRIOR[c]
            print(f"G4 {c}: mediana {med:+.4f} vs storico [{lo},{hi}] -> "
                  f"{'coerente (>=storico/3, <=3x)' if lo/3<=med<=hi*3 else 'INCOERENTE'}")
