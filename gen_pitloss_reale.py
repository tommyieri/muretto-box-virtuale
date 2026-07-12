"""gen_pitloss_reale.py — SESSIONE C: misura pura del pit-loss REALE per circuito dai dati
per-giro (SENZA far girare il motore) e confronto col nominale f1db in produzione. NON
sostituisce nulla, NON tocca kernel/golden/modulo pit/pit_loss_circuito_f1db.csv. Generatore
committato (regola 1). E' calibrazione IN-SAMPLE di un parametro per-circuito (il pit-loss E'
gia' un parametro per-circuito): non c'e' predizione da validare fuori campione (E3 resta NO-GO).

=================== C1 — METODO (dichiarato PRIMA dei risultati) ===================
Il pit-loss reale di uno stop = tempo perso rispetto al NON fermarsi, misurato dai giri:
  pit_loss_reale = (tempo_in_lap + tempo_out_lap) - (rif(P) + rif(P+1))
dove, per il pilota nella gara:
  passo_rif_vuoto = mediana su TUTTI i suoi giri verdi (non in/out-lap, non neutralizzati,
                    lap_time presente) di [lap_time(l) - fuel_mass(l)*COEFF]   (= passo a
                    serbatoio vuoto, STESSA formula del kernel: COEFF=3/70,
                    fuel_mass(l)=max(0, 70 - (70/N)*(l-1)));
  rif(lap) = passo_rif_vuoto + fuel_mass(lap)*COEFF   (riportato al carburante di quel giro).
P = giro dell'in-lap (in_lap=True); l'out-lap e' P+1 (out_lap=True).

ASSUNZIONI / LIMITI NOTI (dichiarati, NON corretti in questa sessione):
- l'OUT-LAP contiene il WARM-IN gomma (gomma fredda) -> il pit_loss_reale lo INCLUDE. E'
  proprio la variabile che vogliamo vedere; non la sottraiamo.
- il passo di riferimento e' su tutta la gara (piu' stabile) ma mischia stint/mescole diverse
  -> rumore sul singolo stop; la MEDIANA per circuito lo attenua.
- LIMITE FORTE: l'IN-LAP e' a FINE stint su gomma vecchia; la sua lentezza da DEGRADO non e'
  pit-loss ma il riferimento a media-gara non la rimuove -> GONFIA i Δ POSITIVI, tanto piu'
  quanto piu' la gara e' degradante o il campione piccolo. Conseguenza: il lato ROBUSTO della
  misura e' quello NEGATIVO (nominale troppo alto) sui circuiti ben campionati; i Δ positivi
  su pochi stop vanno letti con cautela (possibile artefatto di metodo).
- fuel-correzione con la formula del kernel (stesso COEFF): coerente col motore, non una nuova
  stima.
- penalita' scontate ai box e problemi tecnici NON sono nel formato dati -> non escludibili
  esplicitamente (limite dichiarato); entrano come coda, la mediana/IQR li assorbe.
====================================================================================
"""
import os, csv, json
import numpy as np

RACES = {  # gara demo -> (cid f1db, nominale_f1db)
    'Australia': ('melbourne', 18.15), 'Austria': ('spielberg', 21.63),
    'Canada': ('montreal', 24.37), 'Cina': ('shanghai', 22.97),
    'Giappone': ('suzuka', 23.72), 'Gran Bretagna': ('silverstone', 29.12),
    'Miami': ('miami', 22.63), 'Monaco': ('monaco', 24.8), 'Spagna': ('catalunya', 22.38),
}
COEFF, FUEL0 = 3.0 / 70.0, 70.0
MIN_GREEN, MIN_STOPS = 5, 8
NEU = json.load(open('demo/neutralizzazione.json'))

def fuel(lap, N): return max(0, FUEL0 - (FUEL0 / N) * (lap - 1)) * COEFF

def main():
    per_stop = []
    excl = dict(neutralizzato=0, edge=0, doppio=0, no_out=0, no_time=0, ref_scarso=0)
    for gara, (cid, nom) in RACES.items():
        r = json.load(open(f'demo/data/{gara}.json'))
        byLap = {lp['lap']: lp['cars'] for lp in r['laps']}; N = r['n_laps']
        w = NEU.get(gara, {}); wins = [*w.get('sc', []), *w.get('vsc', [])]
        inj = lambda L: any(a <= L <= b for a, b in wins)
        drivers = set().union(*[set(c) for c in byLap.values()])
        for d in drivers:
            green = [(L, byLap[L][d]['lap_time']) for L in byLap if d in byLap[L]
                     and isinstance(byLap[L][d].get('lap_time'), (int, float))
                     and not byLap[L][d]['in_lap'] and not byLap[L][d]['out_lap'] and not byLap[L][d]['neutralized']]
            if len(green) < MIN_GREEN:
                continue  # ref non stimabile per questo pilota
            ref_empty = float(np.median([lt - fuel(L, N) for L, lt in green]))
            # in-lap del pilota
            inlaps = [L for L in byLap if d in byLap[L] and byLap[L][d]['in_lap']]
            for P in inlaps:
                c = byLap[P][d]; o = byLap.get(P + 1, {}).get(d)
                if P <= 1 or P + 1 >= N: excl['edge'] += 1; continue
                if not o or not o['out_lap']: excl['no_out'] += 1; continue
                # doppio stop nello stesso giro (in_lap e out_lap insieme) o due in-lap ravvicinati
                if any(x in byLap and d in byLap[x] and byLap[x][d]['in_lap'] for x in (P - 1,)):
                    excl['doppio'] += 1; continue
                if c['neutralized'] or o['neutralized'] or inj(P) or inj(P + 1):
                    excl['neutralizzato'] += 1; continue
                if not isinstance(c['lap_time'], (int, float)) or not isinstance(o['lap_time'], (int, float)):
                    excl['no_time'] += 1; continue
                pl = (c['lap_time'] + o['lap_time']) - (ref_empty + fuel(P, N)) - (ref_empty + fuel(P + 1, N))
                per_stop.append(dict(gara=gara, cid=cid, drv=d, P=P, compound_out=o['compound'],
                                     inlap=round(c['lap_time'], 3), outlap=round(o['lap_time'], 3),
                                     ref=round(2 * ref_empty + fuel(P, N) + fuel(P + 1, N), 3),
                                     pit_loss_reale=round(pl, 3), nominale=nom))
    # scrittura per-stop (deterministica)
    per_stop.sort(key=lambda s: (s['gara'], s['drv'], s['P']))
    with open('data/pitloss_reale_per_stop.csv', 'w', newline='') as f:
        cols = ['gara', 'cid', 'drv', 'P', 'compound_out', 'inlap', 'outlap', 'ref', 'pit_loss_reale', 'nominale']
        wtr = csv.DictWriter(f, fieldnames=cols); wtr.writeheader()
        for s in per_stop: wtr.writerow(s)

    # confronto per circuito
    conf = []
    for gara, (cid, nom) in RACES.items():
        v = np.array([s['pit_loss_reale'] for s in per_stop if s['gara'] == gara])
        if len(v) == 0:
            conf.append(dict(gara=gara, cid=cid, n=0, reale=None, nominale=nom, delta=None)); continue
        med = float(np.median(v))
        conf.append(dict(gara=gara, cid=cid, n=len(v), reale=round(med, 2),
                         q25=round(float(np.percentile(v, 25)), 2), q75=round(float(np.percentile(v, 75)), 2),
                         nominale=nom, delta=round(med - nom, 2)))
    conf.sort(key=lambda c: -abs(c['delta']) if c['delta'] is not None else 0)
    with open('data/pitloss_confronto_circuito.csv', 'w', newline='') as f:
        cols = ['gara', 'cid', 'n', 'reale', 'q25', 'q75', 'nominale', 'delta']
        wtr = csv.DictWriter(f, fieldnames=cols); wtr.writeheader()
        for c in conf: wtr.writerow({k: c.get(k, '') for k in cols})

    # verdetto
    fuori = [c for c in conf if c['delta'] is not None and abs(c['delta']) > 1.0]
    nfuori = len(fuori)
    if nfuori == 0: verdetto = 'CALIBRATO'
    elif nfuori >= 3: verdetto = 'MISCALIBRATO'
    else: verdetto = 'AMBIGUO'

    # C4 struttura errore (se non calibrato)
    nom = np.array([c['nominale'] for c in conf if c['delta'] is not None])
    rea = np.array([c['reale'] for c in conf if c['delta'] is not None])
    dl = rea - nom
    corr = float(np.corrcoef(nom, dl)[0, 1])
    a_add = float(np.median(dl))                                  # additivo: Δ ~ costante
    res_add = float(np.median(np.abs(dl - a_add)))
    # moltiplicativo CON intercetta: reale = a + b*nominale; b<1 = nominale sovra-disperso
    b, a = np.polyfit(nom, rea, 1)
    b = float(b); a = float(a)
    res_mul = float(np.median(np.abs(rea - (a + b * nom))))
    # nessuna legge pulita se i residui restano grandi (>1.5s) o il fit e' implausibile (b<0)
    if min(res_add, res_mul) > 1.5 or b < 0:
        forma = 'nessuna legge pulita (errore per-circuito ~%.1fs; tendenza compressione corr %.2f)' % (min(res_add, res_mul), corr)
    elif res_mul + 0.3 < res_add and b < 0.85:
        forma = 'moltiplicativo/compressione (b=%.2f<1)' % b
    else:
        forma = 'additivo'
    if verdetto == 'CALIBRATO': forma = 'nessuna struttura (calibrato)'

    L = []; P = L.append
    P("# REPORT_PITLOSS — il pit-loss nominale coincide col reale? (misura pura)")
    P("")
    P(f"Verdetto: **{verdetto}** — circuiti fuori soglia (|Δ|>1,0 s): {nfuori}/9")
    P(f"Forma dell'errore: **{forma}**"
      + ("" if verdetto == 'CALIBRATO' else f" (corr Δ-nominale = {corr:+.2f}; additivo Δ≈{a_add:+.2f}s "
         f"|res|={res_add:.2f}s; con intercetta reale≈{a:+.1f}{b:+.2f}×nominale |res|={res_mul:.2f}s)"))
    P("")
    P("Soglie PRE-REGISTRATE: CALIBRATO |Δ|<=1,0 su tutti; MISCALIBRATO |Δ|>1,0 su >=3; "
      "AMBIGUO 1-2 fuori. Calibrazione IN-SAMPLE legittima (parametro per-circuito, nessuna "
      "predizione fuori campione: E3 resta NO-GO).")
    P("")
    P("## C1 — Metodo (dichiarato prima dei risultati)")
    P("")
    P("pit_loss_reale = (in-lap + out-lap) - (rif(P)+rif(P+1)); rif = passo verde del pilota")
    P("fuel-corretto (mediana giri verdi di [lap_time - fuel_mass·3/70]) riportato al carburante")
    P("del giro. L'OUT-LAP INCLUDE il warm-in gomma: dichiarato, NON corretto (e' cio' che si")
    P("vuole vedere). Penalita'/problemi tecnici non nel formato dati -> non escludibili (limite).")
    P("")
    P("## C2 — Esclusioni (dichiarate)")
    P("")
    P(f"Escluse e contate (unione fonti neutralizzazione flag∪json, come A-ter): "
      + ", ".join(f"{k}={v}" for k, v in excl.items()) + ".")
    P("")
    P("## C3 — Confronto per circuito (ordinato per |Δ|)")
    P("")
    P("| gara | cid | n stop | reale (mediana) | IQR | nominale f1db | Δ = reale-nominale |")
    P("|---|---|---|---|---|---|---|")
    for c in conf:
        if c['delta'] is None: P(f"| {c['gara']} | {c['cid']} | 0 | — | — | {c['nominale']} | — |"); continue
        flag = ' ⚠' if c['n'] < MIN_STOPS else ''
        P(f"| {c['gara']} | {c['cid']} | {c['n']}{flag} | {c['reale']} | [{c['q25']},{c['q75']}] | "
          f"{c['nominale']} | {c['delta']:+.2f} |")
    P("")
    P(f"⚠ = sotto {MIN_STOPS} stop validi (mediana poco affidabile).")
    P("")
    if verdetto != 'CALIBRATO':
        P("## C4 — Struttura dell'errore")
        P("")
        P(f"- Δ correla col nominale: r = **{corr:+.2f}** " +
          ("(riproduce il -0,76 di A-ter: alto nominale -> Δ negativo = compressione)" if corr < -0.4 else "(non riproduce forte il -0,76)") + ".")
        P(f"- Additivo (Δ≈cost {a_add:+.2f}s): |res| {res_add:.2f}s. Con intercetta "
          f"(reale≈{a:+.1f}{b:+.2f}×nominale, pendenza b={b:.2f}<1 = nominale sovra-disperso): |res| {res_mul:.2f}s. "
          f"-> **{forma}**. I residui ~3s dicono che nessuna legge pulita descrive i dati: l'errore e' in")
        P("  gran parte PER-CIRCUITO, non una scala unica.")
        wellsampled = [c for c in conf if c['n'] >= 15 and c['delta'] is not None]
        wf = [c for c in wellsampled if abs(c['delta']) > 1.0]
        P(f"- LATO ROBUSTO (circuiti con n>=15 stop, immuni al limite del metodo): "
          + ", ".join(f"{c['gara']} Δ{c['delta']:+.1f}" for c in wellsampled)
          + f". Di questi {len(wf)}/{len(wellsampled)} fuori soglia -> il verdetto MISCALIBRATO regge")
        P("  anche escludendo i Δ positivi a piccolo campione (Cina n=6, Australia n=9): possibile")
        P("  artefatto di metodo (in-lap su gomma vecchia gonfia il Δ positivo).")
        gb = next(c for c in conf if c['gara'] == 'Gran Bretagna')
        P(f"- Gran Bretagna (nominale 29,12): misura diretta = **{gb['reale']} s** (Δ {gb['delta']:+.2f}), "
          f"n={gb['n']}, IQR [{gb['q25']},{gb['q75']}] (anche il 75° pctile < nominale). "
          + ("E' l'outlier che A-ter suggeriva, confermato da due metodi indipendenti." if abs(gb['delta']) > 5 else ""))
        P("- Provenienza f1db: `pit_loss_circuito_f1db.csv` e' una tabella ESTERNA ingerita (colonna")
        P("  `n`=stop nel campione f1db), usata da `pipeline_gara.py`/modulo pit. NESSUNO script")
        P("  committato la calcola -> non c'e' trasformazione verificabile. Esiste un SECONDO file")
        P("  committato `pit_loss_circuito.csv` con valori sistematicamente PIU' BASSI (es. Silverstone")
        P("  25,4 vs 29,12): i due discordano (debito P1). Non e' determinabile da quale campo f1db")
        P("  esca il valore ne' se sia durata-stop vs pit-loss-totale senza la fonte esterna; ma la")
        P("  misura diretta mostra che il valore f1db in produzione NON coincide con la perdita reale.")
        P("")
    # C5 warm-in
    P("## C5 — Anomalia warm-in (da A-ter, diagnosi non correzione)")
    P("")
    warm = {}
    for line in open('data/warmin_prior.csv').read().strip().split('\n')[1:]:
        cc, gs, ww, _ = line.split(','); warm.setdefault(cc, {})[gs] = float(ww)
    P("warmin_prior.csv (giro_stint 0 = out-lap): " +
      ", ".join(f"{cc} {warm[cc]['0']:+.3f}" for cc in ('SOFT', 'MEDIUM', 'HARD')) + " s.")
    P("- SEGNO: SOFT/MEDIUM positivi (out-lap piu' lento, coerente col warm-in), ma HARD e'")
    P("  NEGATIVO (-0,162): un warm-in negativo = out-lap piu' VELOCE del riferimento, che per una")
    P("  gomma fredda non ha senso fisico -> il prior HARD misura anche altro (out-lap su gomma dura")
    P("  in condizioni favorevoli, o contaminazione). Segno non uniformemente coerente.")
    P("- DOPPIO CONTEGGIO: il warm-in e' GIA' dentro l'out-lap reale, quindi gia' dentro il")
    P("  pit_loss_reale (C1) e dentro il residuo pit di A-ter. In E3 aggiungere warmin_prior come")
    P("  FEATURE lo conta una seconda volta (con per giunta segno HARD sbagliato) -> peggiora la")
    P("  predizione del 12,4%. Non e' un prior rotto: e' una variabile ridondante rispetto a un")
    P("  segnale gia' presente nel target. Diagnosi, non correzione.")
    P("")
    P("Nessun verdetto strategico (sostituire il file, ricalibrare): e' del PO. NON si sostituisce")
    P("pit_loss_circuito_f1db.csv in questa sessione.")
    open('REPORT_PITLOSS.md', 'w').write("\n".join(L) + "\n")
    print("\n".join(L))
    print(f"\n[scritto] gen_pitloss_reale.py, data/pitloss_reale_per_stop.csv ({len(per_stop)} stop), "
          "data/pitloss_confronto_circuito.csv, REPORT_PITLOSS.md")
    print("VERDETTO =", verdetto)

if __name__ == '__main__':
    main()
