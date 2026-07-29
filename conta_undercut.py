"""conta_undercut.py — Fase 2.2 / FASE A: censimento degli undercut REALMENTE tentati.

Prima di modellare il controfattuale, si contano i casi dove il controfattuale E'
verificabile. Nessun modello qui: solo la definizione operativa e il conteggio.

DEFINIZIONE OPERATIVA DICHIARATA di "undercut tentato" (A attacca B):
  U1  A fa l'in-lap al giro P (pin valorizzato); il suo out-lap e' P+1.
  U2  al giro P-1, B precede A con gap = cum(A) - cum(B) in (0, 5.0] secondi.
  U3  B resta fuori al giro P (nessun pin) e fa il suo in-lap al giro Q,
      con 1 <= Q - P <= 4 (la finestra classica della risposta del muretto).
  U4  B e' il rivale PIU' VICINO davanti ad A che soddisfa U2-U3 (un caso per pit:
      indipendenza dei casi; il conteggio "tutti i rivali entro soglia" e' riportato
      a parte come riferimento).
  U5  A monta una slick fresca (compound out-lap in SOFT/MEDIUM/HARD).
  U6  nessun giro di [P-1, Q+2] cade in una finestra SC/VSC di gara (regola >=2 auto,
      gen_neutralizzazione) e ne' A ne' B hanno flag neutralized individuale in quei
      giri (cintura+bretelle, come il fix C1).
  U7  A non rifa' pit prima di Q+2; A e B hanno cum_time al giro di esito.
  ESITO al giro M = Q+2 (B ha completato out-lap + 1 giro): riuscito = cum(A) < cum(B).

GARE: le 8 dry 2026 (Canada Race esclusa: partenza umida, coerente con Fase 2.1).
Con --storico estende al mirror 2023-2025 (solo Race che passano il dry-check di
drycheck_2026.valuta — stessa unica definizione).
Con --gara <nome> (gare 10+): processa UNA gara nuova dal registro
(data/gare_registro.json, stessa definizione + dry-check) e scrive un file SEPARATO
data/undercut_casi_gara_<nome>.json — undercut_casi_2026.json e storico NON toccati.

GATE DICHIARATO (prima di contare): il KPI e' misurabile se n(2026) >= 30 con la
classe minoritaria >= 8; altrimenti si estende allo storico o ci si ferma.
"""
import os, sys, json
from gen_neutralizzazione import genera_gara
from drycheck_2026 import valuta

SOGLIA_GAP, FINESTRA_B, SLICK = 5.0, 4, ('SOFT', 'MEDIUM', 'HARD')

GARE_2026 = {  # nome: raw (le 8 dry; Canada esclusa — dichiarato sopra)
 'Australia':'data/ti_cache/Australian.json','Cina':'data/ti_cache/Chinese.json',
 'Giappone':'data/ti_cache/Japanese.json','Miami':'data/ti_cache/Miami.json',
 'Monaco':'data/ti_cache/Monaco.json','Spagna':'data/ti_cache/Barcelona.json',
 'Austria':'data/ti_cache/Austrian.json',
 'Gran Bretagna':'data/ti_archive/2026/British Grand Prix/Race.json'}

def per_pilota(raw_path):
    d = json.load(open(raw_path))
    n = len(d['lap']); P = {}
    for i in range(n):
        if d['lap'][i] is None: continue
        L = int(d['lap'][i])
        P.setdefault(d['drv'][i], {})[L] = dict(
            cum=d['sesT'][i] if isinstance(d['sesT'][i], (int, float)) else None,
            pin=str(d['pin'][i]) != 'None', pout=str(d['pout'][i]) != 'None',
            life=d['life'][i], comp=d['compound'][i],
            neu=('4' in str(d['status'][i])) or ('6' in str(d['status'][i])))
    return P

def casi_gara(nome, raw_path):
    P = per_pilota(raw_path)
    fin = genera_gara(raw_path); finestre = fin['sc'] + fin['vsc']
    in_fin = lambda L: any(a <= L <= b for a, b in finestre)
    casi, tutti = [], 0
    for A, lapsA in P.items():
        for Pp in sorted(lapsA):
            r = lapsA[Pp]
            if not r['pin'] or Pp < 2: continue
            outA = lapsA.get(Pp + 1)
            if not outA or not outA['pout'] or outA['comp'] not in SLICK: continue   # U5
            prevA = lapsA.get(Pp - 1)
            if not prevA or prevA['cum'] is None: continue
            # rivali davanti entro soglia (U2) che restano fuori e pittano in finestra (U3)
            rivali = []
            for B, lapsB in P.items():
                if B == A: continue
                pb, b0 = lapsB.get(Pp - 1), lapsB.get(Pp)
                if not pb or pb['cum'] is None or not b0 or b0['pin']: continue
                gap = prevA['cum'] - pb['cum']
                if not (0 < gap <= SOGLIA_GAP): continue
                Q = next((L for L in range(Pp + 1, Pp + 1 + FINESTRA_B)
                          if L in lapsB and lapsB[L]['pin']), None)
                if Q is None: continue
                rivali.append((gap, B, Q))
            tutti += len(rivali)
            if not rivali: continue
            gap0, B, Q = min(rivali)                                                # U4
            M = Q + 2
            lapsB = P[B]
            if any(L in lapsA and lapsA[L]['pin'] for L in range(Pp + 1, M)): continue  # U7
            if M not in lapsA or M not in lapsB: continue
            if lapsA[M]['cum'] is None or lapsB[M]['cum'] is None: continue
            span = range(Pp - 1, M + 1)
            if any(in_fin(L) for L in span): continue                               # U6 gara
            if any(lapsA.get(L, {}).get('neu') or lapsB.get(L, {}).get('neu') for L in span): continue
            casi.append(dict(gara=nome, A=A, B=B, P=Pp, Q=Q, gap0=round(gap0, 3),
                             comp_A=lapsA[Pp + 1]['comp'],
                             comp_B=lapsB[Q]['comp'], life_B=lapsB[Q]['life'],
                             K=Q - Pp, riuscito=bool(lapsA[M]['cum'] < lapsB[M]['cum']),
                             gap_fin=round(lapsA[M]['cum'] - lapsB[M]['cum'], 3)))
    return casi, tutti

def conta(gare, etichetta):
    out = []
    print(f"\n=== {etichetta} ===")
    print(f"{'gara':16s} {'tentati':>7s} {'riusciti':>8s} {'falliti':>7s} {'(tutti-i-rivali)':>17s}")
    for nome, raw in gare.items():
        casi, tutti = casi_gara(nome, raw)
        r = sum(1 for c in casi if c['riuscito'])
        print(f"{nome:16s} {len(casi):>7d} {r:>8d} {len(casi)-r:>7d} {tutti:>17d}")
        out += casi
    r = sum(1 for c in out if c['riuscito'])
    n = len(out)
    print(f"{'TOTALE':16s} {n:>7d} {r:>8d} {n-r:>7d}   -> maggioranza = "
          f"{'riuscito' if r >= n-r else 'fallito'} {max(r, n-r)}/{n} = {100*max(r,n-r)/n:.0f}%" if n else "nessun caso")
    return out

if __name__ == '__main__':
    if '--gara' in sys.argv:
        # gare 10+ (raccolta, NON backtest — il modello resta NO-GO, UNDERCUT_NOTA.txt):
        # una gara alla volta dal registro, file per-gara separato, storico intatto.
        try:
            nome = sys.argv[sys.argv.index('--gara') + 1]
        except IndexError:
            sys.exit("uso: python3 conta_undercut.py --gara <nome>  (nome come nel registro)")
        reg = json.load(open('data/gare_registro.json'))
        if nome not in reg:
            sys.exit(f"'{nome}' non e' nel registro (data/gare_registro.json): "
                     f"va prima pubblicata con pipeline_gara.py.")
        raw = reg[nome]['raw']
        dc = valuta(json.load(open(raw)), 'Race')
        if dc['esito'] != 'OK':
            sys.exit(f"'{nome}' non passa il dry-check ({dc['esito']}): "
                     f"fuori dalla definizione dichiarata (solo Race dry).")
        casi_g = conta({nome: raw}, f"GARA NUOVA: {nome} (raccolta gare 10+)")
        out_p = f"data/undercut_casi_gara_{nome}.json"
        json.dump(casi_g, open(out_p, 'w'), indent=1)
        print(f"\nscritto {out_p} (undercut_casi_2026.json e storico NON toccati)")
        sys.exit(0)
    casi = conta(GARE_2026, "GARE 2026 (8 dry; Canada esclusa)")
    # distribuzione gap0 ed esito (serve a dichiarare i 'difficili' PRIMA del modello)
    print("\ndistribuzione gap0 x esito (2026):")
    for lo, hi in [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5)]:
        b = [c for c in casi if lo < c['gap0'] <= hi]
        r = sum(1 for c in b if c['riuscito'])
        print(f"  gap ({lo},{hi}]s: {len(b):3d} casi, riusciti {r} ({100*r/len(b):.0f}%)" if b else f"  gap ({lo},{hi}]s:   0 casi")
    json.dump(casi, open('data/undercut_casi_2026.json', 'w'), indent=1)
    print("\nscritto data/undercut_casi_2026.json")
    if '--storico' in sys.argv:
        arch = 'data/ti_archive'
        gare_st = {}
        for anno in ('2023', '2024', '2025'):
            base = os.path.join(arch, anno)
            for g in sorted(os.listdir(base)):
                p = os.path.join(base, g, 'Race.json')
                if not os.path.exists(p): continue
                if valuta(json.load(open(p)), 'Race')['esito'] != 'OK': continue   # dry-check
                gare_st[f"{anno} {g.replace(' Grand Prix','')}"] = p
        casi_st = conta(gare_st, f"STORICO 2023-2025 ({len(gare_st)} Race dry)")
        json.dump(casi_st, open('data/undercut_casi_storico.json', 'w'), indent=1)
        print("scritto data/undercut_casi_storico.json")
