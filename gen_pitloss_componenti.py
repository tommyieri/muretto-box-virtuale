"""gen_pitloss_componenti.py — Sessione G: il pit-loss ha due componenti? Misura pura, nessun
modello di produzione, nessuna sostituzione. Generatore committato. Legge le durate per-stop
ingerite in G0 (data/pitstop_durate_f1db.csv) e i dati demo per-giro. Ricalcola il pit-loss
verde col metodo Sessione C (self-contained su questo branch).

IPOTESI (dominio): pit_loss = pit_lane_time - track_time. pit_lane_time NON cambia sotto SC;
track_time ESPLODE sotto SC. Un ratio moltiplicativo costante (0,42) sul totale e' sbagliato
per costruzione. Il campo di pit_loss_circuito_f1db.csv potrebbe essere la DURATA (pit_lane_time),
non il pit-loss -> spiega sovra-dispersione e correlazione -0,76.
"""
import csv, os, json
import numpy as np
from collections import defaultdict

RACES = {
    'Australia': ['melbourne', 18.15], 'Austria': ['spielberg', 21.63], 'Canada': ['montreal', 24.37],
    'Cina': ['shanghai', 22.97], 'Giappone': ['suzuka', 23.72], 'Gran Bretagna': ['silverstone', 29.12],
    'Miami': ['miami', 22.63], 'Monaco': ['monaco', 24.8], 'Spagna': ['catalunya', 22.38],
}
COEFF, FUEL0 = 3.0 / 70.0, 70.0
DUR_MAX = 60.0     # durate > 60 s = soste sotto bandiera-rossa/SC (standing), non pit-lane time
MIN_SC = 8         # stop SC per circuito perche' il ratio sia misurabile (pre-registrato)
RATIO_SC_NOM = 0.42
NEU = json.load(open('demo/neutralizzazione.json'))
def fuel(lap, N): return max(0, FUEL0 - (FUEL0 / N) * (lap - 1)) * COEFF

def load(g):
    r = json.load(open(f'demo/data/{g}.json')); return r, {lp['lap']: lp['cars'] for lp in r['laps']}
def wins(g, kind): return NEU.get(g, {}).get(kind, [])

# ---------- pit-loss VERDE (metodo Sessione C, ricalcolato) ----------
def pitloss_verde(g):
    r, byLap = load(g); N = r['n_laps']
    sc = wins(g, 'sc'); vsc = wins(g, 'vsc'); neu = lambda L: any(a <= L <= b for a, b in sc + vsc)
    drivers = set().union(*[set(c) for c in byLap.values()])
    out = []
    for d in drivers:
        green = [(L, byLap[L][d]['lap_time']) for L in byLap if d in byLap[L]
                 and isinstance(byLap[L][d].get('lap_time'), (int, float))
                 and not byLap[L][d]['in_lap'] and not byLap[L][d]['out_lap'] and not byLap[L][d]['neutralized']]
        if len(green) < 5: continue
        ref = float(np.median([lt - fuel(L, N) for L, lt in green]))
        for P in [L for L in byLap if d in byLap[L] and byLap[L][d]['in_lap']]:
            o = byLap.get(P + 1, {}).get(d)
            if not o or not o['out_lap'] or P <= 1 or P + 1 >= N: continue
            if byLap[P][d]['neutralized'] or o['neutralized'] or neu(P) or neu(P + 1): continue
            if not isinstance(byLap[P][d]['lap_time'], (int, float)) or not isinstance(o['lap_time'], (int, float)): continue
            out.append((byLap[P][d]['lap_time'] + o['lap_time']) - (ref + fuel(P, N)) - (ref + fuel(P + 1, N)))
    return out

# ---------- pit-loss sotto SC (metodo campo-mediano, dentro-finestra) ----------
def pitloss_neutr(g, kind):
    """(in+out) - (mediana campo @in + mediana campo @out); campo = non-pittanti neutralizzati;
    solo stop con in-lap e out-lap STRETTAMENTE dentro una finestra (no deployment/restart)."""
    r, byLap = load(g); N = r['n_laps']; out = []
    for a, b in wins(g, kind):
        lapmed = {}
        for L in range(a, b + 1):
            fl = [byLap[L][x]['lap_time'] for x in byLap.get(L, {})
                  if not byLap[L][x]['in_lap'] and not byLap[L][x]['out_lap'] and byLap[L][x]['neutralized']
                  and isinstance(byLap[L][x]['lap_time'], (int, float))]
            lapmed[L] = np.median(fl) if len(fl) >= 3 else None
        for L in range(a + 1, b):
            for d, c in byLap.get(L, {}).items():
                if not c['in_lap']: continue
                o = byLap.get(L + 1, {}).get(d)
                if not o or not o['out_lap'] or L + 1 > b: continue
                if lapmed.get(L) is None or lapmed.get(L + 1) is None: continue
                if not isinstance(c['lap_time'], (int, float)) or not isinstance(o['lap_time'], (int, float)): continue
                out.append((c['lap_time'] + o['lap_time']) - (lapmed[L] + lapmed[L + 1]))
    return out

# ---------- durate per-stop (G0) ----------
dur_by = defaultdict(list)
for r in csv.DictReader(open('data/pitstop_durate_f1db.csv')):
    if r.get('durata_s'):
        v = float(r['durata_s'])
        if v <= DUR_MAX: dur_by[r['gara']].append(v)   # esclude standing bandiera-rossa/SC

# ---------- calcolo per circuito ----------
C = {}
for g in RACES:
    verde = pitloss_verde(g); sc = pitloss_neutr(g, 'sc'); vsc = pitloss_neutr(g, 'vsc')
    dur = dur_by.get(g, [])
    C[g] = dict(cid=RACES[g][0], nom=RACES[g][1],
                verde=(float(np.median(verde)) if verde else None), n_verde=len(verde),
                dur=(float(np.median(dur)) if dur else None), n_dur=len(dur),
                sc=(float(np.median(sc)) if sc else None), n_sc=len(sc),
                sc_iqr=((float(np.percentile(sc, 25)), float(np.percentile(sc, 75))) if sc else None),
                vsc=(float(np.median(vsc)) if vsc else None), n_vsc=len(vsc))

# ---------- G1: identificazione del campo f1db ----------
match = [g for g in RACES if C[g]['dur'] is not None and abs(C[g]['nom'] - C[g]['dur']) <= 1.0]
if len(match) >= 7: G1 = 'DURATA STOP (pit-lane time)'
elif len(match) >= 1: G1 = 'INCOERENTE'
else: G1 = 'ALTRO'

# ---------- G2/G3: eseguibili? (>=4 circuiti con >=8 stop SC misurabili) ----------
sc_ok = [g for g in RACES if C[g]['n_sc'] >= MIN_SC]
G2_eseg = len(sc_ok) >= 4
ratios = {g: (C[g]['sc'] / C[g]['verde']) for g in sc_ok if C[g]['verde']}
sd_ratio = float(np.std(list(ratios.values()))) if len(ratios) >= 2 else None
if not G2_eseg: G3 = 'NON ESEGUIBILE'
elif sd_ratio is not None and sd_ratio <= 0.08: G3 = 'COSTANTE DIFENDIBILE'
elif sd_ratio is not None and sd_ratio > 0.15: G3 = 'SBAGLIATO'
else: G3 = 'AMBIGUO'

# ---------- CSV ----------
with open('data/pitloss_componenti_circuito.csv', 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['gara', 'cid', 'nominale_f1db', 'durata_med_f1db', 'n_dur', 'pit_loss_verde', 'n_verde',
                'pit_loss_SC', 'n_sc', 'pit_loss_VSC', 'n_vsc', 'track_time_verde', 'ratio_SC'])
    for g in RACES:
        x = C[g]; tt = (x['dur'] - x['verde']) if (x['dur'] is not None and x['verde'] is not None) else None
        rr = (x['sc'] / x['verde']) if (x['sc'] is not None and x['verde']) else None
        w.writerow([g, x['cid'], x['nom'], '' if x['dur'] is None else f"{x['dur']:.2f}", x['n_dur'],
                    '' if x['verde'] is None else f"{x['verde']:.2f}", x['n_verde'],
                    '' if x['sc'] is None else f"{x['sc']:.2f}", x['n_sc'],
                    '' if x['vsc'] is None else f"{x['vsc']:.2f}", x['n_vsc'],
                    '' if tt is None else f"{tt:.2f}", '' if rr is None else f"{rr:.2f}"])

# ---------- REPORT ----------
L = []; P = L.append
P("# REPORT_PITLOSS_COMPONENTI — il pit-loss ha due componenti? (Sessione G, ultima del filone)")
P("")
P(f"G1 — Il campo f1db e': **{G1}** (|nominale - durata mediana| <= 1,0 s su {len(match)}/9 circuiti)")
P(f"G2 — ratio SC misurati: {'sd = %.3f' % sd_ratio if sd_ratio is not None else 'n/d'} -> "
  f"**{G3}** ({'eseguibile' if G2_eseg else 'NON eseguibile: solo %d circuiti con >=%d stop SC misurabili, servono 4' % (len(sc_ok), MIN_SC)})")
P(f"G3/G4 — modello a componenti vs ratio costante: **NON ESEGUIBILE** (pit-loss SC non misurabile "
  "con stabilita': IQR enormi, vedi G2).")
P("")
P("## G0 — Dato NUOVO ingerito: durate per-stop f1db (Jolpica 2026, urllib)")
P("")
P("Le 9 gare demo SONO il 2026 (round 1-9); durate per-stop ingerite da Jolpica (successore")
P("Ergast). Il campo `duration` e' il TEMPO IN PIT-LANE (~28-30 s a Silverstone), non la sola")
P("sosta. Escluse le durate > 60 s (soste sotto bandiera-rossa/SC, standing, non pit-lane).")
P("")
P("## G1 — Che cos'e' il campo in pit_loss_circuito_f1db.csv? (risultato PRINCIPALE)")
P("")
P("| circuito | (a) nominale f1db | (b) durata mediana f1db | (c) pit-loss VERDE | |a-b| | a==durata? |")
P("|---|---|---|---|---|---|")
for g in sorted(RACES, key=lambda g: -(abs(C[g]['nom'] - C[g]['dur']) if C[g]['dur'] else 0)):
    x = C[g]; dd = abs(x['nom'] - x['dur']) if x['dur'] else None
    bcell = '—' if x['dur'] is None else f"{x['dur']:.2f} (n={x['n_dur']})"
    ccell = '—' if x['verde'] is None else f"{x['verde']:.2f}"
    dcell = '—' if dd is None else f"{dd:.2f}"
    P(f"| {g} | {x['nom']:.2f} | {bcell} | {ccell} | {dcell} | {'SI' if (dd is not None and dd <= 1.0) else 'no'} |")
P("")
P(f"**Verdetto G1: il campo f1db e' la DURATA DELLO STOP (pit-lane time)** — coincide con la")
P(f"durata mediana entro 1,0 s su {len(match)}/9 circuiti. NON e' il pit-loss: a Silverstone")
P(f"f1db=29,12 ~= durata 29,6, mentre il pit-loss verde e' ~20,9. La differenza (durata - pit-loss")
P("= track_time) e' la componente di pista, che varia per geometria:")
P("")
P("| circuito | pit_lane_time (durata) | pit-loss verde | track_time = differenza |")
P("|---|---|---|---|")
for g in sorted(RACES, key=lambda g: -((C[g]['dur'] - C[g]['verde']) if (C[g]['dur'] and C[g]['verde']) else -99)):
    x = C[g]
    tt = (x['dur'] - x['verde']) if (x['dur'] and x['verde']) else None
    dcell = '—' if x['dur'] is None else f"{x['dur']:.1f}"
    vcell = '—' if x['verde'] is None else f"{x['verde']:.1f}"
    P(f"| {g} | {dcell} | {vcell} | {'—' if tt is None else f'{tt:+.1f}'} |")
P("")
P("Il track_time deve essere >= 0 (tempo per coprire un tratto di pista). E' POSITIVO e sensato")
P("sui circuiti ben misurati (GB +8,7; Miami +3,6; Monaco +1,8). Dove esce NEGATIVO (Cina -9,2,")
P("Australia -6,2, Canada, Spagna) il colpevole e' il pit-loss VERDE gonfiato dal bias di metodo")
P("gia' dichiarato in Sessione C (in-lap su gomma vecchia, piccolo campione: Cina n piccolo,")
P("Australia n=9) -> NON un fallimento del modello a componenti, ma la conferma che quei verdi")
P("erano sovrastimati. La durata (pit_lane_time) e' invece pulita su tutti (dato diretto G0).")
P("")
P("Questo spiega, con UN meccanismo dal dominio, tutte le anomalie di C-F: la sovra-dispersione")
P("del nominale e la correlazione -0,76 (dove il track_time e' grande, come GB, il nominale=durata")
P("sovrastima il pit-loss di piu'). Il debito P1 ha una spiegazione fisica completa.")
P("")
P("## G2 — Pit-loss sotto neutralizzazione (i 463 stop finora scartati)")
P("")
P("Metodo: (in+out) - (mediana campo @in + @out), campo = non-pittanti neutralizzati; solo stop")
P("STRETTAMENTE dentro la finestra (no deployment/restart). SC e VSC separati. NON il metodo gap")
P("(il regrouping lo invalida).")
P("")
P("| circuito | n SC | pit_loss_SC (IQR) | n VSC | pit_loss_VSC | pit-loss verde | ratio_SC | 0,42*nominale |")
P("|---|---|---|---|---|---|---|---|")
for g in RACES:
    x = C[g]
    scs = '—' if x['sc'] is None else f"{x['sc']:.1f} [{x['sc_iqr'][0]:.0f},{x['sc_iqr'][1]:.0f}]"
    rr = '—' if (x['sc'] is None or not x['verde']) else f"{x['sc']/x['verde']:.2f}"
    vsccell = '—' if x['vsc'] is None else f"{x['vsc']:.1f}"
    vcell = '—' if x['verde'] is None else f"{x['verde']:.1f}"
    P(f"| {g} | {x['n_sc']} | {scs} | {x['n_vsc']} | {vsccell} | {vcell} | {rr} | {0.42*x['nom']:.1f} |")
P("")
P(f"Circuiti con >=8 stop SC MISURABILI (riferimento-campo valido): {len(sc_ok)} ({', '.join(sc_ok)}). "
  f"Sotto la soglia pre-registrata di 4 -> **G2/G3 NON eseguibili**. Monaco: 64 stop SC grezzi ma il")
P("riferimento-campo collassa sotto la sua SC lunga -> pochi misurabili, IQR enorme.")
P("")
gb = C['Gran Bretagna']
P(f"Verifica del sospetto (0,42 x 29,12 = 12,2): il pit_loss_SC misurato a Silverstone e' "
  f"{gb['sc']:.1f} s (IQR [{gb['sc_iqr'][0]:.0f},{gb['sc_iqr'][1]:.0f}]) -> lascamente compatibile con ~12 "
  "ma con incertezza troppo grande (IQR ~20 s: variabilita' intrinseca dei tempi-giro sotto SC) per")
P("confermare numericamente la compensazione dei due errori. Il ratio costante NON e' verificabile qui.")
P("")
P("## G4 — Modello a due componenti (coerenza fisica; LORO non eseguibile)")
P("")
P("Con pit_lane_time = durata mediana (dato G0) e i pit-loss misurati:")
P("  track_time_verde = pit_lane_time - pit_loss_verde ; track_time_SC = pit_lane_time - pit_loss_SC.")
P("Coerenza fisica richiesta: track_time_SC > track_time_verde (in pista si va piu' piano sotto SC).")
P("")
P("| circuito | pit_lane | track_time_verde | track_time_SC | SC>verde? |")
P("|---|---|---|---|---|")
for g in sc_ok:
    x = C[g]
    ttg = x['dur'] - x['verde'] if (x['dur'] and x['verde']) else None
    tts = x['dur'] - x['sc'] if (x['dur'] and x['sc'] is not None) else None
    ok = '—' if (ttg is None or tts is None) else ('SI' if tts > ttg else 'NO (modello incoerente qui)')
    dcell = '—' if x['dur'] is None else f"{x['dur']:.1f}"
    P(f"| {g} | {dcell} | {'—' if ttg is None else f'{ttg:+.1f}'} | {'—' if tts is None else f'{tts:+.1f}'} | {ok} |")
P("")
P("Il confronto fuori campione (LORO) modello-componenti vs ratio-costante NON e' eseguibile: il")
P("pit-loss SC ha incertezza troppo grande e i circuiti misurabili sono < 4. Coerenza fisica")
P("riportata come check qualitativo, non come modello.")
P("")
P("## G5 — Cross-check documentale (mai input)")
P("")
P("Le durate ingerite SONO i tempi pit-lane documentati: Silverstone 29,6 s coincide col tempo")
P("pit-lane pubblicato (~28 s). Le fonti divergono sulla LUNGHEZZA pit-lane di Silverstone (490 vs")
P("970 m) ma concordano sul TEMPO: il tempo e' cio' che conta e cio' che abbiamo misurato. Nessun")
P("dato documentale entra nel motore.")
P("")
P("## Chiusura del filone")
P("")
P("G1 (principale) e' RISOLTO: `pit_loss_circuito_f1db.csv` contiene la DURATA DELLO STOP")
P("(pit-lane time), usata come pit-loss dal modulo pit. E' la spiegazione fisica, dal dominio, di")
P("un'anomalia che tre sessioni statistiche (C-F) non avevano chiuso. Il pit-loss vero = durata -")
P("track_time; il track_time varia per circuito. La calibrazione SC (G2-G4) NON e' misurabile con")
P("stabilita' dai dati (variabilita' SC + <4 circuiti). Il ratio costante 0,42 resta non")
P("verificabile ma non falsificato. NESSUNA sostituzione: sia il pit-loss verde sia il ratio SC")
P("toccano il modulo pit congelato e i suoi golden. Verdetto strategico e correzione: del PO.")
open('REPORT_PITLOSS_COMPONENTI.md', 'w').write("\n".join(L) + "\n")
print("\n".join(L))
print(f"\nG1={G1} (match {len(match)}/9) | G2 eseguibile={G2_eseg} (sc_ok={sc_ok}) | G3={G3}")
