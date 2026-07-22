"""gen_neutralizzazione_v2.py — GENERATORE COMMITTATO (sessione N, branch neutralizzazione-verita).

PROPOSTA, non produzione. NON sostituisce gen_neutralizzazione.py né tocca alcun file di
produzione. Legge SOLO i raw TracingInsights (ti_archive + ti_cache) e scrive tre CSV di analisi:

  data/status_vocabolario.csv         (N1) — vocabolario completo dei codici status
  data/neutralizzazione_due_livelli.csv (N2) — evento per-gara (A) + impatto per-auto (B)
  data/rlap_per_regime.csv            (N4) — R_lap per regime per circuito, pooled su stagioni

Regola di decodifica COMMITTATA (gen_neutralizzazione.py + data/NEUTRALIZZAZIONE_NOTA.txt):
  '4' = SC, '6' = VSC, '5' = bandiera rossa.
Codici NON committati, marcati esplicitamente come ipotesi (standard FIA TrackStatus, coerente coi
dati: alfabeto osservato = {1,2,4,5,6,7}, il '3' FIA è assente):
  '1' = verde (baseline convenzionale), '2' = giallo, '7' = VSC in chiusura.
Uno status di gara è una CONCATENAZIONE ordinata degli stati within-lap attraversati dall'auto in
quel giro (es. '14' = verde->SC = deployment sul giro; '41' = SC->verde = restart).

Soglia finestra di gara = 2 auto flaggate, IDENTICA al json committato (confrontabilità con v1).
"""
import os, json, glob, csv
from collections import Counter, defaultdict

DATA = 'data'

# ---- decodifica digit -> (nome, committato?) -----------------------------------------------
DECODE = {
    '1': ('VERDE',        'convenzionale'),           # baseline, implicito nel metodo v1
    '2': ('GIALLO',       'ipotesi_non_committata'),  # standard FIA TrackStatus
    '4': ('SC',           'committato'),               # gen_neutralizzazione.py / NOTA
    '5': ('RED',          'committato'),               # '5' = bandiera rossa (NOTA)
    '6': ('VSC',          'committato'),               # VSC deployed
    '7': ('VSC_END',      'ipotesi_non_committata'),  # VSC in chiusura (standard FIA)
}

def decode_code(code):
    """Sequenza leggibile degli stati within-lap + descrizione fisica."""
    seq = [DECODE.get(ch, ('?'+ch, 'sconosciuto'))[0] for ch in code]
    return '->'.join(seq)

def code_committed_level(code):
    lv = {DECODE.get(ch, ('','sconosciuto'))[1] for ch in code}
    if 'sconosciuto' in lv: return 'sconosciuto'
    if 'ipotesi_non_committata' in lv: return 'parziale (contiene ipotesi 2/7)'
    if lv <= {'committato', 'convenzionale'}: return 'committato'
    return 'misto'

def fisica(code):
    has = lambda d: d in code
    if has('5'): return 'bandiera rossa in questo giro (gara sospesa / laptime non valido)'
    if has('4') and has('6'):
        return 'SC e VSC nello stesso giro-auto: transizione mista, non classificabile come regime'
    if has('4'):
        if code[0] != '4' and code[-1] == '1': return 'deploy poi restart di SC entro il giro (SC breve)'
        if code[0] != '4' and '1' not in code[code.index('4'):]: return 'giro iniziato in verde/giallo e finito sotto SC = DEPLOY'
        if code[0] == '4' and code[-1] == '1': return 'giro iniziato sotto SC e finito in verde = RESTART'
        if code == '4': return 'giro interamente sotto SC = REGIME SC'
        return 'giro sotto SC (transizione con giallo)'
    if has('6') or has('7'):
        if code[0] != '6' and code[-1] == '1': return 'deploy poi chiusura di VSC entro il giro (VSC breve)'
        if code == '6': return 'giro interamente sotto VSC = REGIME VSC'
        if code[-1] == '1': return 'VSC che si chiude entro il giro, finito in verde'
        return 'giro sotto VSC (deploy/chiusura)'
    if has('2'):
        return 'bandiera gialla (settore) senza SC/VSC: nessuna neutralizzazione formale'
    return 'verde'

# ---- inventario file per circuito ----------------------------------------------------------
# I due inventari erano scritti a mano e si fermavano ai 9 circuiti di allora: Spa non
# c'era, e nessuno se ne accorgeva perche' il generatore girava lo stesso. Ora si
# DERIVANO dal registro, cosi' una gara nuova entra da sola. Le mappe congelate restano
# come GUARDIA: se la derivazione non le riproduce identiche, il generatore si ferma.
_CIRCUITI_CONGELATI = {
    'melbourne':  'Australian Grand Prix',
    'shanghai':   'Chinese Grand Prix',
    'suzuka':     'Japanese Grand Prix',
    'miami':      'Miami Grand Prix',
    'montreal':   'Canadian Grand Prix',
    'monaco':     'Monaco Grand Prix',
    'catalunya':  'Spanish Grand Prix',
    'spielberg':  'Austrian Grand Prix',
    'silverstone':'British Grand Prix',
}
_TICACHE_CONGELATO = {
    'Australian Grand Prix':'Australian','Chinese Grand Prix':'Chinese','Japanese Grand Prix':'Japanese',
    'Miami Grand Prix':'Miami','Canadian Grand Prix':'Canadian','Monaco Grand Prix':'Monaco',
    'Spanish Grand Prix':'Barcelona','Austrian Grand Prix':'Austrian',
}
# TracingInsights ha RINOMINATO un evento fra lo storico e il 2026: l'archivio 2023-25 dice
# 'Spanish', il registro 2026 dice 'Barcelona'. Alias DICHIARATO, non indovinato: senza,
# la Spagna perderebbe in silenzio tutto il suo storico.
ALIAS_ARCHIVIO = {'Barcelona Grand Prix': 'Spanish Grand Prix'}


def _inventari():
    """(circuiti, ticache) derivati dal registro, con guardia contro la deriva."""
    reg = json.load(open(os.path.join(DATA, 'gare_registro.json')))
    circuiti, ticache = {}, {}
    for v in reg.values():
        gp = ALIAS_ARCHIVIO.get(v['ti'], v['ti'])
        circuiti[v['cid']] = gp
        if os.sep + 'ti_cache' + os.sep in os.sep + v['raw'].replace('/', os.sep):
            ticache[gp] = os.path.splitext(os.path.basename(v['raw']))[0]
    for cid, gp in _CIRCUITI_CONGELATI.items():
        if circuiti.get(cid) != gp:
            raise RuntimeError(f"deriva dell'inventario: '{cid}' era '{gp}', ora "
                               f"'{circuiti.get(cid)}' — serve un alias dichiarato")
    for gp, base in _TICACHE_CONGELATO.items():
        if ticache.get(gp) != base:
            raise RuntimeError(f"deriva del ti_cache: '{gp}' era '{base}', ora '{ticache.get(gp)}'")
    for cid, gp in circuiti.items():
        trovato = (gp in ticache and os.path.exists(os.path.join(DATA, 'ti_cache', ticache[gp] + '.json'))) \
            or any(os.path.exists(os.path.join(DATA, 'ti_archive', y, gp, 'Race.json'))
                   for y in ('2023', '2024', '2025', '2026'))
        if not trovato:
            raise RuntimeError(f"'{cid}' -> '{gp}': nessun Race.json da nessuna parte "
                               f"(rinominato a monte? va dichiarato in ALIAS_ARCHIVIO)")
    return circuiti, ticache


CIRCUITI, TICACHE_2026 = _inventari()

def race_files_for(gp):
    """Tutti i Race.json disponibili per un GP, tutte le stagioni (2023-2026)."""
    out = []
    for yr in ('2023','2024','2025','2026'):
        p = os.path.join(DATA,'ti_archive',yr,gp,'Race.json')
        if os.path.exists(p): out.append((yr,p))
    if gp in TICACHE_2026:
        p = os.path.join(DATA,'ti_cache',TICACHE_2026[gp]+'.json')
        if os.path.exists(p): out.append(('2026',p))
    return out

def all_status_files():
    """(scope, path) per l'enumerazione vocabolario: 'arch23-25' vs 'fmt2026'."""
    out=[]
    for yr in ('2023','2024','2025'):
        for p in glob.glob(os.path.join(DATA,'ti_archive',yr,'*','Race.json')): out.append(('arch23-25',p))
    for p in glob.glob(os.path.join(DATA,'ti_cache','*.json')): out.append(('fmt2026',p))
    for p in glob.glob(os.path.join(DATA,'ti_archive','2026','*','Race.json')): out.append(('fmt2026',p))
    return out

# ---- N1 vocabolario ------------------------------------------------------------------------
def vocabolario():
    arch, fmt = Counter(), Counter()
    for scope,p in all_status_files():
        d=json.load(open(p))
        if 'status' not in d: continue
        c = arch if scope=='arch23-25' else fmt
        for s in d['status']: c[str(s)] += 1
    # tie-break sul codice (stringa): ordine deterministico a pari frequenza, indipendente
    # da PYTHONHASHSEED. Non cambia i codici né i dati, solo l'ordine stabile delle righe.
    codes = sorted(set(arch)|set(fmt), key=lambda x:(-(arch[x]+fmt[x]), x))
    rows=[]
    for c in codes:
        rows.append({'codice':c,'freq_arch_2023_25':arch[c],'freq_2026':fmt[c],
                     'freq_totale':arch[c]+fmt[c],'sequenza':decode_code(c),
                     'decodifica':code_committed_level(c),
                     'neutralizzato_v1':('4' in c or '6' in c),
                     'significato_fisico':fisica(c)})
    with open(os.path.join(DATA,'status_vocabolario.csv'),'w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    return rows

# ---- classificazione ----------------------------------------------------------------------
def _finestre(laps):
    laps=sorted(laps)
    if not laps: return []
    out=[[laps[0],laps[0]]]
    for g in laps[1:]:
        if g==out[-1][1]+1: out[-1][1]=g
        else: out.append([g,g])
    return out

def evento_per_gara(status_by_lap):
    """(A) regime EVENTO per-gara. status_by_lap: {lap: [status per auto]}.
    Ritorna {lap: regime}. Regimi con DEPLOY/RESTART separati dal REGIME."""
    sc,vsc,red = {},{},{}
    for L,ss in status_by_lap.items():
        sc[L]  = sum(1 for s in ss if '4' in s)
        vsc[L] = sum(1 for s in ss if '6' in s)
        red[L] = sum(1 for s in ss if '5' in s)
    sc_l  = {L for L in sc  if sc[L]>=2}
    vsc_l = {L for L in vsc if vsc[L]>=2}
    red_l = {L for L in red if red[L]>=2}
    reg = {L:'VERDE' for L in status_by_lap}
    def stamp(laps, base):
        for a,b in _finestre(laps):
            for L in range(a,b+1):
                if L==a and L==b: reg[L]=base+'_DEPLOY'      # finestra di 1 giro: pura transizione
                elif L==a:        reg[L]=base+'_DEPLOY'
                elif L==b:        reg[L]=base+'_RESTART'
                else:             reg[L]=base+'_REGIME'
    stamp(sc_l,'SC'); stamp(vsc_l,'VSC')
    for L in red_l: reg[L]='RED'
    for L in (sc_l & vsc_l): reg[L]='MISTO_NON_CLASSIFICABILE'
    return reg

def impatto_atomico(code):
    """(B) regime base per-auto-per-giro dal solo status (senza deploy/restart, aggiunti dal run)."""
    if '5' in code: return 'RED'
    if '4' in code and '6' in code: return 'MISTO_NON_CLASSIFICABILE'
    if '4' in code: return 'SC'
    if '6' in code or '7' in code: return 'VSC'
    return 'VERDE'

def impatto_per_auto(status_rows):
    """status_rows: lista (lap, drv, status). Ritorna {(drv,lap): regime} con deploy/restart
    dedotti dal run individuale dell'auto."""
    base = {(drv,L): impatto_atomico(str(s)) for L,drv,s in status_rows}
    by_drv = defaultdict(list)
    for (drv,L),r in base.items():
        if r not in ('VERDE','RED'): by_drv[drv].append((L,r))
    out = dict(base)
    for drv,items in by_drv.items():
        # separa per tipo (SC / VSC / MISTO) e marca primo/ultimo del run consecutivo
        for tipo in ('SC','VSC'):
            laps=sorted(L for L,r in items if r==tipo)
            for a,b in _finestre(laps):
                for L in range(a,b+1):
                    if   L==a and L==b: out[(drv,L)]=tipo+'_DEPLOY'
                    elif L==a:          out[(drv,L)]=tipo+'_DEPLOY'
                    elif L==b:          out[(drv,L)]=tipo+'_RESTART'
                    else:               out[(drv,L)]=tipo+'_REGIME'
    return out

def carica_gara(path):
    """Ritorna (status_by_lap, status_rows, laptime_rows). laptime_rows: (lap,drv,time,is_pit)."""
    d=json.load(open(path))
    n=len(d['lap'])
    lap,drv,status = d['lap'], d.get('drv',[None]*n), d['status']
    time = d.get('time',[None]*n)
    pin  = d.get('pin',['None']*n); pout=d.get('pout',['None']*n)
    sbl=defaultdict(list); rows=[]; lts=[]
    for i in range(n):
        if lap[i] is None: continue
        L=int(lap[i]); s=str(status[i]); dv=drv[i]
        sbl[L].append(s); rows.append((L,dv,s))
        t=time[i]
        try: t=float(t)
        except (TypeError,ValueError): t=None
        is_pit = (str(pin[i])!='None') or (str(pout[i])!='None')
        lts.append((L,dv,t,is_pit))
    return sbl, rows, lts

import statistics as _stat

# ---- N2 due livelli + matrici di contingenza ----------------------------------------------
def _finestre_regime(reg):
    """da {lap:regime} a lista finestre [a,b,tipo] per REGIME/DEPLOY/RESTART, per il CSV evento."""
    out=[]
    for L in sorted(reg):
        r=reg[L]
        if r=='VERDE': continue
        if out and out[-1][2]==r and out[-1][1]==L-1: out[-1][1]=L
        else: out.append([L,L,r])
    return out

def due_livelli():
    """Scrive neutralizzazione_due_livelli.csv (livello A per finestra) e ritorna, per l'analisi,
    le mappe (A) e (B) e la matrice di contingenza per-auto-per-giro."""
    rows=[]; conc=Counter(); AxB=Counter()
    A_vs_json=Counter(); B_vs_flag=Counter()
    NEU=json.load(open(os.path.join('demo','neutralizzazione.json')))
    import gen_neutralizzazione as v1
    for cid,gp in CIRCUITI.items():
        for yr,path in race_files_for(gp):
            sbl,srows,_ = carica_gara(path)
            A = evento_per_gara(sbl)                 # {lap: regime gara}
            B = impatto_per_auto(srows)              # {(drv,lap): regime auto}
            # CSV livello A: finestre non-verdi
            for a,b,r in _finestre_regime(A):
                rows.append({'circuito':cid,'gp':gp,'stagione':yr,'giro_inizio':a,'giro_fine':b,
                             'regime_evento':r,'n_giri':b-a+1})
            # matrice A x B (per-auto-per-giro): confronta regime-gara del giro col regime-auto
            base = lambda r: r.split('_')[0]          # SC_REGIME->SC, VSC_DEPLOY->VSC, ...
            for (drv,L),rb in B.items():
                ra = A.get(L,'VERDE')
                if base(ra)==base(rb): conc['concorda']+=1
                else: conc['discorda']+=1
                AxB[(base(ra),base(rb))]+=1
    with open(os.path.join(DATA,'neutralizzazione_due_livelli.csv'),'w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=['circuito','gp','stagione','giro_inizio','giro_fine',
                                       'regime_evento','n_giri']); w.writeheader(); w.writerows(rows)
    return rows, conc, AxB

# ---- N4 R_lap per regime per circuito ------------------------------------------------------
def _median(xs):
    xs=[x for x in xs if x is not None]
    return _stat.median(xs) if xs else None

def rlap():
    """R_lap[regime] = mediana(laptime regime)/mediana(laptime VERDE), per circuito, pooled stagioni.
    Esclude deploy/restart (misti) e giri RED. Usa il regime EVENTO (livello A): tutto il campo sotto
    lo stesso track status. Esclude in/out lap e laptime nulli."""
    rows=[]
    for cid,gp in CIRCUITI.items():
        # laptime pooled per regime, su tutte le stagioni del circuito
        bucket=defaultdict(list)
        for yr,path in race_files_for(gp):
            sbl,_,lts = carica_gara(path)
            A = evento_per_gara(sbl)
            for L,drv,t,is_pit in lts:
                if t is None or is_pit: continue
                reg=A.get(L,'VERDE')
                bucket[reg].append(t)
        green=_median(bucket.get('VERDE',[]))
        for reg in ('SC_REGIME','VSC_REGIME','SC_DEPLOY','SC_RESTART','VSC_DEPLOY','VSC_RESTART','RED'):
            m=_median(bucket.get(reg,[])); n=len(bucket.get(reg,[]))
            rl = round(m/green,3) if (m and green) else None
            rows.append({'circuito':cid,'regime':reg,'n_giri':n,
                         'mediana_laptime':round(m,3) if m else None,
                         'mediana_verde':round(green,3) if green else None,'R_lap':rl})
        rows.append({'circuito':cid,'regime':'VERDE','n_giri':len(bucket.get('VERDE',[])),
                     'mediana_laptime':round(green,3) if green else None,
                     'mediana_verde':round(green,3) if green else None,'R_lap':1.0 if green else None})
    with open(os.path.join(DATA,'rlap_per_regime.csv'),'w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=['circuito','regime','n_giri','mediana_laptime',
                                       'mediana_verde','R_lap']); w.writeheader(); w.writerows(rows)
    return rows

if __name__=='__main__':
    v=vocabolario(); print(f"[N1] status_vocabolario.csv: {len(v)} codici distinti")
    d,conc,axb=due_livelli(); print(f"[N2] neutralizzazione_due_livelli.csv: {len(d)} finestre; "
                                    f"concorda A/B={conc['concorda']} discorda={conc['discorda']}")
    r=rlap(); print(f"[N4] rlap_per_regime.csv: {len(r)} righe")
