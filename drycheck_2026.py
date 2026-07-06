"""drycheck_2026.py — verifica misurata (non assunta) che una sessione sia asciutta
e completa. Usato dalla Fase 2.1 (test degrado) e da pipeline_gara.py (guardrail 2).

Criteri dichiarati, per sessione:
  DRY:      zero giri su INTERMEDIATE/WET  E  frazione giri con wR (rainfall) < 1%
  COMPLETA: max(lap) plausibile (>= 50 per Race, >= 15 per Sprint) e >= 18 piloti
Le sessioni non DRY o non complete NON entrano in analisi/demo senza decisione umana
(il caso Canada Race: partenza umida — vedi data/DEGRADO_NOTA.txt).
"""
import os, json, statistics as st

def valuta(d, sess='Race'):
    """d = dict session_laptimes (column-oriented). Ritorna il verdetto con le misure."""
    laps  = [int(x) for x in d['lap'] if x is not None]
    drvs  = set(d['drv'])
    comps = {}
    for c in d['compound']:
        if isinstance(c, str): comps[c] = comps.get(c, 0) + 1
    intwet = sum(v for k, v in comps.items() if k in ('INTERMEDIATE', 'WET'))
    wr = d.get('wR')
    frac_rain = (sum(1 for x in wr if x not in (None, 0, False, '0', 'False')) / len(wr)) if wr else None
    times = [t for t in d['time'] if isinstance(t, (int, float))]
    dry      = intwet == 0 and (frac_rain is None or frac_rain < 0.01)
    completa = max(laps) >= (50 if sess == 'Race' else 15) and len(drvs) >= 18
    return dict(
        n_righe=len(d['time']), max_lap=max(laps), n_piloti=len(drvs),
        compound=sorted(comps), intwet=intwet, frac_rain=frac_rain,
        med_tempo=st.median(times) if times else None,
        dry=dry, completa=completa,
        esito='OK' if (dry and completa) else ('BAGNATA' if not dry else 'INCOMPLETA'))

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
                    yield gara.replace(' Grand Prix',''), sess, p

if __name__ == '__main__':
    print(f"{'sessione':22s} {'righe':>6s} {'maxlap':>6s} {'piloti':>6s} {'INT/WET':>8s} {'%wR':>6s} "
          f"{'medT':>7s} {'compound usati':32s} esito")
    esiti = {}
    for nome, sess, path in sessioni():
        v = valuta(json.load(open(path)), sess)
        esiti[(nome, sess)] = v['esito']
        print(f"{nome+' '+sess:22s} {v['n_righe']:>6d} {v['max_lap']:>6d} {v['n_piloti']:>6d} {v['intwet']:>8d} "
              f"{('%.1f%%' % (100*v['frac_rain'])) if v['frac_rain'] is not None else '  n/d':>6s} "
              f"{v['med_tempo']:>7.2f} {str(v['compound'])[:32]:32s} {v['esito']}")
    ok = [k for k, v in esiti.items() if v == 'OK']
    print(f"\nsessioni utilizzabili: {len(ok)}/{len(esiti)}")
    for k, v in esiti.items():
        if v != 'OK': print(f"  ESCLUSA {k[0]} {k[1]}: {v}")
