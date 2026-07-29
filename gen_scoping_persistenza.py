"""gen_scoping_persistenza.py — DIAGNOSTICO DI SOLA MISURA (non un build).

DOMANDA (forecasting persistenza vs climatologia, fuori campione):
  su stint 2025 mai visti, la PERSISTENZA (il degrado marginale gia' osservato nella
  parte iniziale dello stesso stint) predice il degrado marginale della CODA meglio
  della CLIMATOLOGIA (la mediana storica per compound del prior statico 2023-24)?

Sola lettura su archivio + misura + prior. Riusa l'IGIENE e il METODO CENTRALE gia'
prodotti (gen_replay_perdita_stint.py); nessun file di motore/gancio/golden toccato.
Scrive DUE artefatti NUOVI (writer deterministico):
  data/scoping_persistenza_2025.csv      (confronto per-stint)
  data/SCOPING_V2_PERSISTENZA_REPORT.txt (copertura + verdetto di scoping)

============================ PROTOCOLLO PRE-REGISTRATO ============================
FINESTRE (dichiarate PRIMA dei numeri; stessa igiene dell'artefatto archiviato).
Per ogni stint, U = giri USABILI (verdi status=='1', no out/in-lap, slick, numerici,
lap>=2, life>=3 [out-lap + warm-in g0/g1 esclusi], no outlier F7 a 1.07x mediana-stint,
ARIA PULITA gap-sesT all'auto davanti > 2.0s), ordinati per life. Con CODA_N=5:
  coda        C = U[-5:]                (5 giri, come l'archivio)
  base-coda   P = U[:-5]                (tutti i precedenti, riferimento carburante)
  fin.iniz.   I = U[-10:-5]             (i 5 giri appena PRIMA della coda)
  base-iniz.  F = U[:-10]               (tutti i precedenti a I, riferimento carburante)
Rappresentazione UNICA (perdita marginale degrado-isolata, metodo centrale = pendenza
finestra meno pendenza base, tutte in s/giro):
  coda_reale  (target)      = slope(C) - slope(P)   == marg_iso_centrale archiviato
  persistenza (predittore1) = slope(I) - slope(F)   [stesso metodo, finestra 5 giri
                                spostata indietro di 5: "cosa avrebbe detto la coda 5
                                giri prima"; usa SOLO U[:-5] -> nessun leak dalla coda]
  climatologia(predittore2) = mediana 2023-24 per compound di marg_iso_centrale (prior
                                statico archiviato, baseline da battere)
QUALIFICA DIAGNOSTICO (soglia dichiarata, filtri NON rilassati): len(F)>=MIN_CENTRALE=3
AND len(I)==5 AND len(C)==5  <=>  n_usable >= 13. Piu' stretta dell'archivio (>=8),
per garantire DUE finestre iniziali+coda disgiunte con una base ciascuna.

METRICA: per ogni stint 2025 qualificato, errore assoluto di predizione della coda:
  err_pers = |persistenza - coda_reale| ; err_clim = |climatologia - coda_reale|.
GATE DI SCOPING (c'e' segnale?), PASS se e solo se:
  Wilcoxon appaiato(err_pers, err_clim) p < 0.05  AND  miglioramento mediano > 0.
  "miglioramento mediano" operazionato come mediana delle DIFFERENZE APPAIATE
  median(err_clim - err_pers) > 0 (la persistenza riduce l'errore sullo stint tipico):
  e' l'effect-size COERENTE col test di Wilcoxon, che e' appaiato. Si riporta anche la
  differenza-delle-mediane median(err_clim)-median(err_pers) come misura secondaria;
  se le due divergono (caso di rumore) prevale l'appaiata, coerente col test.
Altrimenti NULL netto. Un PASS dice "c'e' segnale, v2 vale la costruzione", NON "v2
funziona": instrada verso un build con KPI piu' severo, non lo sostituisce.
AVVERTENZA dichiarata: la pendenza su finestre corte (5 giri) e' rumorosa; la
persistenza EREDITA quel rumore. E' parte onesta del risultato.
"""
import os, csv, statistics as st
import numpy as np
from scipy.stats import wilcoxon
import gen_replay_perdita_stint as g
from test_identificabilita_degrado import pulisci, filtro_outlier, SOGLIA_OUTLIER, SLICK

ARCH_CSV = os.path.join('data', 'replay_perdita_stint.csv')
OUT_CSV  = os.path.join('data', 'scoping_persistenza_2025.csv')
OUT_TXT  = os.path.join('data', 'SCOPING_V2_PERSISTENZA_REPORT.txt')
MIN_F = g.MIN_CENTRALE            # base-iniziale >= 3 (come MIN_CENTRALE)
CODA_N = g.CODA_N                 # 5
POWER_MIN = 40                    # sotto -> potenza limitata (dichiarato, non rilassato)

def slope(xs, ys):
    return float(np.polyfit(np.array(xs, float), np.array(ys, float), 1)[0])

def misura_diag(us):
    """us = giri usabili di UNO stint (gia' filtrati), ordinati per life.
    Ritorna (coda_reale, persistenza, n_usable) o None se non qualificato."""
    us = sorted(us, key=lambda r: int(r['life']))
    n = len(us)
    C = us[-CODA_N:]              # coda
    P = us[:-CODA_N]             # base-coda (tutti i precedenti)
    I = us[-2*CODA_N:-CODA_N]     # finestra iniziale (5 giri prima della coda)
    F = us[:-2*CODA_N]           # base-iniziale
    if len(F) < MIN_F or len(I) != CODA_N or len(C) != CODA_N:
        return None               # n_usable < 13 -> non qualificato per il diagnostico
    life = lambda w: [int(r['life']) for r in w]
    time = lambda w: [r['time'] for r in w]
    coda_reale  = slope(life(C), time(C)) - slope(life(P), time(P))   # == marg_iso_centrale
    persistenza = slope(life(I), time(I)) - slope(life(F), time(F))
    return coda_reale, persistenza, n, C[-1]['compound'], C[-1]['drv'], int(C[-1]['stint'])

def raccogli():
    """Ricostruisce gli stint usabili con l'IGIENE archiviata (replica calcola())."""
    out = {}   # (anno,circuito,drv,stint) -> (coda_reale,persistenza,n,compound)
    for anno in ('2023', '2024', '2025'):
        base = os.path.join('data', 'ti_archive', anno)
        if not os.path.isdir(base): continue
        for folder in sorted(os.listdir(base)):
            path = os.path.join(base, folder, 'Race.json')
            if not os.path.exists(path): continue
            rows = g.carica_plus(path)
            keep, _, N = pulisci(rows)
            keep, _ = filtro_outlier(keep, SOGLIA_OUTLIER)
            keep = [r for r in keep if r.get('clean')]
            per_stint = {}
            for r in keep:
                per_stint.setdefault((r['drv'], int(r['stint'])), []).append(r)
            cir = folder.replace(' Grand Prix', '')
            for us in per_stint.values():
                m = misura_diag(us)
                if m is None: continue
                cr, pe, n, comp, drv, stint = m
                out[(anno, cir, drv, stint)] = dict(anno=anno, circuito=cir, compound=comp,
                    drv=drv, stint=stint, n_usable=n, coda_reale=cr, persistenza=pe)
    return out

def climatologia_prior():
    """Prior statico archiviato: mediana 2023-24 per compound di marg_iso_centrale."""
    rows = list(csv.DictReader(open(ARCH_CSV)))
    prior = {}
    for cc in SLICK:
        v = [float(r['marg_iso_centrale']) for r in rows
             if r['compound'] == cc and r['anno'] in ('2023', '2024')]
        prior[cc] = (st.median(v) if v else None, len(v))
    return prior

def selfcheck(diag):
    """Verifica che coda_reale ricostruito == marg_iso_centrale archiviato (stesse righe)."""
    arch = {}
    for r in csv.DictReader(open(ARCH_CSV)):
        arch[(r['anno'], r['circuito'], r['drv'], int(r['stint']))] = float(r['marg_iso_centrale'])
    maxd, n = 0.0, 0
    for k, d in diag.items():
        if k in arch:
            maxd = max(maxd, abs(d['coda_reale'] - arch[k])); n += 1
    return maxd, n

def wilcox(ep, ec):
    """Wilcoxon appaiato; ritorna (stat,p) o (None,None) se degenere."""
    if len(ep) < 1 or all(abs(a-b) < 1e-12 for a, b in zip(ep, ec)):
        return None, None
    try:
        s, p = wilcoxon(ep, ec, alternative='two-sided', zero_method='wilcox')
        return float(s), float(p)
    except ValueError:
        return None, None

def main():
    diag = raccogli()
    prior = climatologia_prior()
    maxd, ncheck = selfcheck(diag)

    # target = stint 2025 qualificati
    d25 = sorted([d for k, d in diag.items() if d['anno'] == '2025'],
                 key=lambda d: (d['circuito'], d['drv'], d['stint']))
    for d in d25:
        d['climatologia'] = prior[d['compound']][0]
        d['err_pers'] = abs(d['persistenza'] - d['coda_reale'])
        d['err_clim'] = abs(d['climatologia'] - d['coda_reale'])

    # scrittura CSV deterministica
    cols = ['anno','circuito','compound','drv','stint','n_usable',
            'persistenza','coda_reale','climatologia','err_pers','err_clim']
    with open(OUT_CSV, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader()
        for d in d25:
            w.writerow({k: (f"{d[k]:.4f}" if isinstance(d[k], float) else d[k]) for k in cols})

    # verdetto complessivo + per compound
    def verdetto(sub):
        ep = [d['err_pers'] for d in sub]; ec = [d['err_clim'] for d in sub]
        if not sub: return None
        s, p = wilcox(ep, ec)
        med_p, med_c = st.median(ep), st.median(ec)
        migl_medians = med_c - med_p                                  # differenza-delle-mediane (secondaria)
        paired = st.median([c - pp for c, pp in zip(ec, ep)])         # mediana diff appaiate (primaria)
        passa = (p is not None and p < 0.05 and paired > 0)
        divergono = (migl_medians > 0) != (paired > 0)
        return dict(n=len(sub), med_pers=med_p, med_clim=med_c, migl=migl_medians,
                    paired=paired, stat=s, p=p, passa=passa, divergono=divergono)

    over = verdetto(d25)
    perc = {cc: verdetto([d for d in d25 if d['compound'] == cc]) for cc in SLICK}

    L = []; P = L.append
    P("=" * 76)
    P("SCOPING v2 — PERSISTENZA intra-stint vs CLIMATOLOGIA storica (diagnostico)")
    P("=" * 76)
    P("Fuori campione: target = stint 2025; climatologia = prior statico 2023-24")
    P("(mediana per compound di marg_iso_centrale, archiviato). Rappresentazione unica:")
    P("perdita marginale degrado-isolata metodo centrale. Persistenza = misura la stessa")
    P("cosa 5 giri prima della coda (solo U[:-5]) -> nessun leak. Igiene: archiviata.")
    P("")
    P("SELF-CHECK: coda_reale ricostruita == marg_iso_centrale archiviato:")
    P(f"  max |diff| = {maxd:.2e} su {ncheck} stint appaiati  (metodo/igiene riprodotti)")
    P("")
    P("CLIMATOLOGIA (prior statico 2023-24, mediana per compound, s/giro):")
    for cc in SLICK:
        m, nn = prior[cc]
        P(f"  {cc:6s}: {m:+.4f}  (n storico {nn})" if m is not None else f"  {cc:6s}: NULL")
    P("")
    P("-" * 76)
    P("STEP 1 — COPERTURA (stint 2025 qualificati per il diagnostico, n_usable>=13)")
    P("-" * 76)
    P(f"  totale 2025 qualificati: {len(d25)}")
    for cc in SLICK:
        nn = sum(1 for d in d25 if d['compound'] == cc)
        flag = "  (< ~40: POTENZA LIMITATA, dichiarato)" if nn < POWER_MIN else ""
        P(f"    {cc:6s}: {nn}{flag}")
    if len(d25) < POWER_MIN:
        P(f"  ATTENZIONE complessivo < ~{POWER_MIN}: POTENZA LIMITATA (filtri NON rilassati).")
    P("  AVVERTENZA: pendenza su 5 giri e' rumorosa; la persistenza eredita quel rumore.")
    P("")
    P("-" * 76)
    P("STEP 2 — CONFRONTO E VERDETTO (errore assoluto di predizione della coda)")
    P("-" * 76)
    def blocco(nome, v):
        if v is None or v['n'] == 0:
            P(f"  {nome}: (nessuno stint)"); return
        ps = "n/d" if v['p'] is None else f"{v['p']:.4g}"
        P(f"  {nome}  n={v['n']}")
        P(f"    errore mediano  persistenza={v['med_pers']:.4f}  climatologia={v['med_clim']:.4f}  s/giro")
        P(f"    miglioramento mediano appaiato (clim-pers per stint) = {v['paired']:+.4f}  <- effect-size del gate")
        P(f"    differenza-delle-mediane (secondaria)                = {v['migl']:+.4f}")
        P(f"    Wilcoxon appaiato p = {ps}")
        if v['divergono']:
            P(f"    NB: le due misure DIVERGONO (rumore): l'appaiata (col test) e' {'>' if v['paired']>0 else '<'}0,")
            P(f"        la differenza-delle-mediane e' {'>' if v['migl']>0 else '<'}0 -> prevale l'appaiata.")
        P(f"    -> {'PASS' if v['passa'] else 'NULL'}  (serve p<0.05 AND miglioramento appaiato>0)")
    blocco("COMPLESSIVO", over)
    P("")
    for cc in SLICK:
        blocco(cc, perc[cc])
    P("")
    P("=" * 76)
    P("VERDETTO DI SCOPING (meccanico)")
    P("=" * 76)
    if over is None:
        P("  NULL: nessuno stint qualificato.")
    elif over['passa']:
        P("  PASS: c'e' segnale intra-stint oltre la climatologia storica (p<0.05 e")
        P("  miglioramento mediano positivo). Significa 'v2 vale la costruzione', NON 'v2")
        P("  funziona': instrada verso un build con KPI piu' severo, non lo sostituisce.")
    else:
        P("  NULL: il segnale intra-stint NON batte la climatologia storica")
        ragione = []
        if over['p'] is None or over['p'] >= 0.05: ragione.append("p>=0.05")
        if over['paired'] <= 0: ragione.append("miglioramento mediano appaiato <= 0 (persistenza tipicamente PEGGIORE)")
        P(f"  ({', '.join(ragione)}). Esito forte e utile: a costo minimo si scopre che")
        P("  nemmeno il segnale della gara stessa predice la gara stessa a livello di stint.")
    P("")
    P("Nota: verdetto MECCANICO di scoping. Il verdetto STRATEGICO (costruire v2, passare")
    P("all'FP, o fermarsi) NON e' scritto qui: e' del PO.")
    P("=" * 76)
    testo = "\n".join(L)
    print(testo)
    open(OUT_TXT, 'w').write(testo + "\n")
    print(f"\n[scritto] {OUT_CSV} ({len(d25)} righe)")
    print(f"[scritto] {OUT_TXT}")

if __name__ == '__main__':
    main()
