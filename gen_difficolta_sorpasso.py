"""gen_difficolta_sorpasso.py — indice v1 di difficolta' di sorpasso per circuito.

METRICA (v2 ratificata dal PO): "tasso di attacco convertito", puramente in pista.
  indice(circuito) = P(sorpasso completato | attacco sostenuto) — il fattore residuo
  della pista a parita' di situazione. Gap e chiusura sono variabili di CONDIZIONAMENTO
  (definiscono attacchi comparabili), non l'output: per questo NON e' gap+pace mascherato.

EPISODIO (setting primario dichiarato: ZONA=1.0s, CHIUSURA=0.6s, K=4):
  E1 aggancio per merito : gap(L) in (0, ZONA] e gap(L-3)-gap(L) >= CHIUSURA
                           (l'attaccante ha chiuso: evidenza di passo senza stimare
                           il passo in aria sporca, che e' inquinato per definizione);
  E2 pressione reale     : al giro L+1 l'attaccante e' ancora in zona OPPURE ha gia'
                           passato (l'aggancio occasionale non conta; il sorpasso
                           immediato si');
  E3 gara vera           : L >= 4 (partenza esclusa); niente pin/pout di A o B in
                           [L-3, L] (aggancio non fabbricato dai pit); coppie a pari
                           giro (garantito dal gap<=1.5s a pari indice di giro);
  ESITO in (L, L+K]      : CONVERTITO se A passa B e resta davanti anche il giro dopo;
                           NON CONVERTITO se resta dietro per tutta la finestra;
                           CENSURATO (fuori campione) se QUALSIASI pit di A o B, o
                           SC/VSC (finestre >=2 auto + flag individuali), o dati
                           mancanti prima della risoluzione. La censura totale evita
                           il legame spurio con la frequenza pit del circuito; la
                           "resa al pit" e' contata a parte come descrittiva.
  DEDUP: stessa coppia -> nuovo episodio solo dopo 5 giri dalla fine del precedente.

GATE (soglie dichiarate PRIMA di calcolare — vedi data/SORPASSO_NOTA.txt):
  G0 robustezza : ordinamento stabile su griglia ZONA{1.0,1.5} x CHIUSURA{0.5,0.8} x
                  K{3,5}: Spearman medio col setting primario >= 0.8;
  G1 dispersione: range >=15 punti tra circuiti (n>=20 episodi); std tra circuiti >
                  mediana errore std binomiale entro circuito;
  G2 stabilita' : circuiti con >=2 stagioni e >=15 episodi/stagione: spread stagionale
                  mediano <=20 punti; nessuna inversione radicale (>35 punti con n adeguati);
  G3 ground truth (dichiarato prima): difficili attesi = monaco, hungaroring, catalunya,
                  marina-bay, zandvoort; facili attesi = monza, baku, shanghai,
                  spa-francorchamps, las-vegas, jeddah. Difficili nella meta' bassa e
                  facili nella meta' alta, max UNA eccezione per gruppo; Monaco tra i
                  facili = fallimento senza appello.

Il vecchio data/difficolta_sorpasso.csv (orfano, senza generatore) NON e' input di nulla.
Output: data/difficolta_sorpasso_v1.csv (setting primario).
"""
import os, json, csv, math
from conta_undercut import per_pilota
from gen_neutralizzazione import genera_gara
from drycheck_2026 import valuta

PRIMARIO = (1.0, 0.6, 4)
GRIGLIA = [(z, c, k) for z in (1.0, 1.5) for c in (0.5, 0.8) for k in (3, 5)]
MIN_EP, MIN_EP_STAG = 20, 15

CID_GP = {'Australian':'melbourne','Chinese':'shanghai','Japanese':'suzuka','Bahrain':'bahrain',
'Saudi Arabian':'jeddah','Miami':'miami','Emilia Romagna':'imola','Monaco':'monaco',
'Spanish':'catalunya','Canadian':'montreal','Austrian':'spielberg','British':'silverstone',
'Belgian':'spa-francorchamps','Hungarian':'hungaroring','Dutch':'zandvoort','Italian':'monza',
'Azerbaijan':'baku','Singapore':'marina-bay','United States':'austin','Mexico City':'mexico-city',
'São Paulo':'interlagos','Las Vegas':'las-vegas','Qatar':'lusail','Abu Dhabi':'yas-marina'}

ATTESI_DIFF = ['monaco','hungaroring','catalunya','marina-bay','zandvoort']
ATTESI_FACI = ['monza','baku','shanghai','spa-francorchamps','las-vegas','jeddah']

def gare_disponibili():
    """[(cid, stagione, raw_path)] — solo Race che passano il dry-check."""
    out = []
    reg = json.load(open('data/gare_registro.json'))
    for nome, v in reg.items():
        d = json.load(open(v['raw']))
        if valuta(d, 'Race')['esito'] == 'OK': out.append((v['cid'], '2026', v['raw']))
    for anno in ('2023', '2024', '2025'):
        base = os.path.join('data', 'ti_archive', anno)
        for g in sorted(os.listdir(base)):
            p = os.path.join(base, g, 'Race.json')
            if not os.path.exists(p): continue
            cid = CID_GP.get(g.replace(' Grand Prix', ''))
            if cid is None: continue
            if valuta(json.load(open(p)), 'Race')['esito'] == 'OK': out.append((cid, anno, p))
    return out

def episodi(P, win, zona, chiusura, K):
    """[(esito, resa_pit)] con esito in {conv, nonconv} (censurati esclusi, rese contate)."""
    in_w = lambda L: any(a <= L <= b for a, b in win)
    out, rese, cens = [], 0, 0
    piloti = list(P)
    for A in piloti:
        LA = P[A]
        for B in piloti:
            if A == B: continue
            LB = P[B]
            comuni = sorted(set(LA) & set(LB))
            gap = {L: LA[L]['cum'] - LB[L]['cum'] for L in comuni
                   if LA[L]['cum'] is not None and LB[L]['cum'] is not None}
            cool = 0
            for L in comuni:
                if L < 4 or L < cool or L not in gap: continue
                if not (0 < gap[L] <= zona): continue
                if any(x not in gap for x in (L - 3, L + 1)): continue
                if gap[L - 3] - gap[L] < chiusura: continue                       # E1
                if gap[L + 1] > zona: continue                                    # E2
                if any(LA.get(x, {}).get('pin') or LA.get(x, {}).get('pout') or
                       LB.get(x, {}).get('pin') or LB.get(x, {}).get('pout')
                       for x in range(L - 3, L + 1)): continue                    # E3
                esito, fine = None, L + K
                for M in range(L + 1, L + K + 1):
                    if in_w(M) or M not in gap or \
                       LA.get(M, {}).get('neu') or LB.get(M, {}).get('neu'):
                        esito = 'cens'; fine = M; break
                    if LA[M]['pin']:
                        esito = 'cens'; rese += (gap[M] > 0 if M in gap else True); fine = M; break
                    if LB[M]['pin']:
                        esito = 'cens'; fine = M; break
                    if gap[M] < 0:                                                # passato:
                        Mn = M + 1                                                # persiste?
                        if Mn in gap and not LA.get(Mn, {}).get('pin') and not LB.get(Mn, {}).get('pin'):
                            esito = 'conv' if gap[Mn] < 0 else None
                            if esito: fine = Mn; break
                        else: esito = 'cens'; fine = M; break
                if esito is None: esito = 'nonconv'
                if esito == 'cens': cens += 1
                else: out.append(esito)
                cool = fine + 5                                                   # dedup
    return out, rese, cens

def calcola(setting, cache):
    zona, chiusura, K = setting
    per_cid = {}   # cid -> stagione -> [conv, tot]
    for cid, stag, P, win in cache:
        eps, rese, cens = episodi(P, win, zona, chiusura, K)
        if not eps and not cens: continue
        d = per_cid.setdefault(cid, {}).setdefault(stag, [0, 0, 0, 0])
        d[0] += sum(1 for e in eps if e == 'conv'); d[1] += len(eps)
        d[2] += rese; d[3] += cens
    return per_cid

def indice_pooled(per_cid):
    out = {}
    for cid, st in per_cid.items():
        c = sum(v[0] for v in st.values()); n = sum(v[1] for v in st.values())
        if n >= MIN_EP: out[cid] = (100.0 * c / n, n)
    return out

def spearman(a, b):
    ks = [k for k in a if k in b]
    if len(ks) < 5: return float('nan')
    def ranks(vals):
        s = sorted(range(len(vals)), key=lambda i: vals[i])
        r = [0] * len(vals)
        for pos, i in enumerate(s): r[i] = pos
        return r
    ra, rb = ranks([a[k][0] for k in ks]), ranks([b[k][0] for k in ks])
    n = len(ks); d2 = sum((x - y) ** 2 for x, y in zip(ra, rb))
    return 1 - 6 * d2 / (n * (n * n - 1))

if __name__ == '__main__':
    print("carico le gare (dry-check per ciascuna)...")
    cache = []
    for cid, stag, p in gare_disponibili():
        d = json.load(open(p))
        f = genera_gara(p)
        cache.append((cid, stag, per_pilota(p), f['sc'] + f['vsc']))
    print(f"gare utilizzabili: {len(cache)} ({len({c for c,_,_,_ in cache})} circuiti)")

    prim = calcola(PRIMARIO, cache)
    idx = indice_pooled(prim)

    # G0 — robustezza alle soglie
    rhos = []
    for s in GRIGLIA:
        rho = spearman(idx, indice_pooled(calcola(s, cache)))
        rhos.append(rho)
        print(f"  G0 setting {s}: Spearman vs primario = {rho:.3f}")
    g0 = sum(rhos) / len(rhos)

    # tabella primaria
    print(f"\n{'circuito':18s} {'indice%':>8s} {'ep':>5s} {'stag':>4s} {'spread':>7s} {'resa_pit%':>9s}  stagioni")
    righe = []
    for cid in sorted(idx, key=lambda c: idx[c][0]):
        st = prim[cid]
        rates = {s: 100 * v[0] / v[1] for s, v in st.items() if v[1] >= MIN_EP_STAG}
        spread = (max(rates.values()) - min(rates.values())) if len(rates) >= 2 else None
        rese = sum(v[2] for v in st.values()); cens = sum(v[3] for v in st.values())
        tot_eps = idx[cid][1]
        resa_pct = 100 * rese / (tot_eps + cens) if tot_eps + cens else 0
        righe.append(dict(cid=cid, indice=round(idx[cid][0], 1), episodi=tot_eps,
                          n_stagioni=len(st), spread=None if spread is None else round(spread, 1),
                          resa_pit_pct=round(resa_pct, 1)))
        print(f"{cid:18s} {idx[cid][0]:>8.1f} {tot_eps:>5d} {len(st):>4d} "
              f"{('%.1f' % spread) if spread is not None else '   n/d':>7s} {resa_pct:>9.1f}  "
              f"{ {s: round(r,1) for s,r in sorted(rates.items())} }")

    # G1 — dispersione
    vals = [idx[c][0] for c in idx]
    rng = max(vals) - min(vals)
    std_tra = (sum((v - sum(vals)/len(vals))**2 for v in vals) / (len(vals)-1)) ** .5
    se_med = sorted(math.sqrt(v/100*(1-v/100)/idx[c][1])*100 for c, v in ((c, idx[c][0]) for c in idx))[len(idx)//2]
    g1 = rng >= 15 and std_tra > se_med
    print(f"\nG1 dispersione: range {rng:.1f} pt (soglia 15) | std tra circuiti {std_tra:.1f} vs "
          f"err.std mediano entro circuito {se_med:.1f} -> {'PASS' if g1 else 'FAIL'}")

    # G2 — stabilita'
    spreads = [r['spread'] for r in righe if r['spread'] is not None]
    med_spread = sorted(spreads)[len(spreads)//2] if spreads else None
    inversioni = [r['cid'] for r in righe if r['spread'] is not None and r['spread'] > 35]
    g2 = med_spread is not None and med_spread <= 20 and not inversioni
    print(f"G2 stabilita': spread stagionale mediano {med_spread} pt (soglia 20) su {len(spreads)} circuiti; "
          f"inversioni radicali (>35pt): {inversioni or 'nessuna'} -> {'PASS' if g2 else 'FAIL'}")

    # G3 — ground truth
    ordinati = [r['cid'] for r in sorted(righe, key=lambda r: r['indice'])]
    meta = len(ordinati) // 2
    bassa, alta = set(ordinati[:meta + len(ordinati) % 2]), set(ordinati[meta:])
    ecc_d = [c for c in ATTESI_DIFF if c in idx and c not in bassa]
    ecc_f = [c for c in ATTESI_FACI if c in idx and c not in alta]
    monaco_facile = 'monaco' in idx and 'monaco' in set(ordinati[-meta:])
    g3 = len(ecc_d) <= 1 and len(ecc_f) <= 1 and not monaco_facile
    print(f"G3 ground truth: difficili fuori posto {ecc_d or 'nessuno'} | facili fuori posto {ecc_f or 'nessuno'}"
          f"{' | MONACO TRA I FACILI' if monaco_facile else ''} -> {'PASS' if g3 else 'FAIL'}")
    print(f"G0 robustezza soglie: Spearman medio {g0:.3f} (soglia 0.80) -> {'PASS' if g0 >= 0.8 else 'FAIL'}")

    # REGOLA: non si consegna un indice che non supera i gate. Il CSV esiste solo a gate verdi.
    if g0 >= 0.8 and g1 and g2 and g3:
        with open('data/difficolta_sorpasso_v1.csv', 'w', newline='') as f:
            w = csv.DictWriter(f, fieldnames=['cid','indice','episodi','n_stagioni','spread','resa_pit_pct'])
            w.writeheader(); w.writerows(sorted(righe, key=lambda r: r['indice']))
        print("\nGATE TUTTI VERDI -> scritto data/difficolta_sorpasso_v1.csv")
    else:
        if os.path.exists('data/difficolta_sorpasso_v1.csv'): os.remove('data/difficolta_sorpasso_v1.csv')
        print("\nGATE NON SUPERATI -> NESSUN CSV consegnato (verdetto e tabella: data/SORPASSO_NOTA.txt)")
