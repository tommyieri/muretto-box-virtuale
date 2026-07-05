"""drycheck_2026.py — verifica misurata (non assunta) che ogni sessione 2026 sia asciutta
e completa, prima di usarla nel test di identificabilita' del degrado.

Criteri dichiarati, per sessione:
  DRY:      zero giri su INTERMEDIATE/WET  E  frazione giri con wR (rainfall) < 1%
  COMPLETA: max(lap) plausibile (>= 50 per Race, >= 15 per Sprint) e >= 18 piloti
Output: tabella con esito per sessione. Le sessioni non DRY o non complete NON entrano
nell'analisi (data/DEGRADO_NOTA.txt).
"""
import os, json, statistics as st

def sessioni():
    # 8 Race dalla cache del kernel + tutto cio' che sta nell'archivio 2026
    cache = {'Australian':'Australia','Chinese':'Cina','Japanese':'Giappone','Miami':'Miami',
             'Canadian':'Canada','Monaco':'Monaco','Barcelona':'Spagna','Austrian':'Austria'}
    for f, nome in cache.items():
        yield nome, 'Race', os.path.join('data','ti_cache',f+'.json')
    arch = os.path.join('data','ti_archive','2026')
    if os.path.isdir(arch):
        for gara in sorted(os.listdir(arch)):
            for sess in ('Race','Sprint'):
                p = os.path.join(arch,gara,sess+'.json')
                if os.path.exists(p):
                    nome = gara.replace(' Grand Prix','')
                    yield nome, sess, p

print(f"{'sessione':22s} {'righe':>6s} {'maxlap':>6s} {'piloti':>6s} {'INT/WET':>8s} {'%wR':>6s} "
      f"{'medT':>7s} {'compound usati':32s} esito")
esiti = {}
for nome, sess, path in sessioni():
    d = json.load(open(path))
    n = len(d['time'])
    laps  = [int(x) for x in d['lap'] if x is not None]
    drvs  = set(d['drv'])
    comps = {}
    for c in d['compound']:
        if isinstance(c,str): comps[c] = comps.get(c,0)+1
    intwet = sum(v for k,v in comps.items() if k in ('INTERMEDIATE','WET'))
    wr = d.get('wR')
    frac_rain = (sum(1 for x in wr if x not in (None,0,False,'0','False'))/len(wr)) if wr else None
    times = [t for t in d['time'] if isinstance(t,(int,float))]
    med = st.median(times) if times else None
    dry      = intwet==0 and (frac_rain is None or frac_rain < 0.01)
    completa = max(laps) >= (50 if sess=='Race' else 15) and len(drvs) >= 18
    esito = 'OK' if (dry and completa) else ('BAGNATA' if not dry else 'INCOMPLETA')
    esiti[(nome,sess)] = esito
    print(f"{nome+' '+sess:22s} {n:>6d} {max(laps):>6d} {len(drvs):>6d} {intwet:>8d} "
          f"{('%.1f%%'%(100*frac_rain)) if frac_rain is not None else '  n/d':>6s} "
          f"{med:>7.2f} {str(sorted(comps))[:32]:32s} {esito}")

ok = [k for k,v in esiti.items() if v=='OK']
print(f"\nsessioni utilizzabili: {len(ok)}/{len(esiti)}")
for k,v in esiti.items():
    if v!='OK': print(f"  ESCLUSA {k[0]} {k[1]}: {v}")
