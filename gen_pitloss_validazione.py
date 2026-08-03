"""gen_pitloss_validazione.py — Sessione H (ultima): valida il modello a due componenti
  pit_loss = pit_lane_time - track_time ;  pit_loss_SC = pit_lane_time - track_time_verde*R_lap
con tre test che possono BOCCIARLO. Nessun modello statistico nuovo, nessuna sostituzione:
produce una PROPOSTA solo se H1 PASSA e H2 VALIDATO. Generatore committato; golden verdi.

pit_lane_time = durata mediana dello stop (data/pitstop_durate_f1db.csv, dato di G).
R_lap = tempo giro sotto SC / tempo giro verde, dai LAP TIMES DI TUTTO IL CAMPO (fonte
indipendente dagli stop). Il degrado aggregato (0,044 s/giro, committato) e' usato SOLO come
correzione di BIAS su una media, MAI come predittore per-stint (filone degrado resta chiuso):
assunzione dichiarata, con SENSIBILITA' a 0,03 e 0,06.
"""
import csv, json
import numpy as np
from collections import defaultdict

RACES = {
    'Australia': ['melbourne', 18.15], 'Austria': ['spielberg', 21.63], 'Canada': ['montreal', 24.37],
    'Cina': ['shanghai', 22.97], 'Giappone': ['suzuka', 23.72], 'Gran Bretagna': ['silverstone', 29.12],
    'Miami': ['miami', 22.63], 'Monaco': ['monaco', 24.8], 'Spagna': ['catalunya', 22.38],
}
BEN_CAMP = ['Gran Bretagna', 'Miami', 'Monaco', 'Spagna', 'Austria']   # n>=15
PICCOLI = {'Cina': 6, 'Australia': 9}
COEFF_CENTR, COEFF_SENS = 0.044, [0.03, 0.044, 0.06]
DUR_MAX = 60.0
COEFF_FUEL, FUEL0 = 3.0 / 70.0, 70.0
NEU = json.load(open('demo/neutralizzazione.json'))
WARM = {}
for line in open('data/warmin_prior.csv').read().strip().split('\n')[1:]:
    c, gs, w, _ = line.split(',')
    if gs == '0': WARM[c] = float(w)

def fuelc(lap, N): return max(0, FUEL0 - (FUEL0 / N) * (lap - 1)) * COEFF_FUEL
def load(g):
    r = json.load(open(f'demo/data/{g}.json')); return r, {lp['lap']: lp['cars'] for lp in r['laps']}
def wins(g, k): return NEU.get(g, {}).get(k, [])

# ---------- verde per-stop con covariate del bias ----------
def stop_verdi(g):
    r, byLap = load(g); N = r['n_laps']
    sc = wins(g, 'sc'); vsc = wins(g, 'vsc'); neu = lambda L: any(a <= L <= b for a, b in sc + vsc)
    drivers = set().union(*[set(c) for c in byLap.values()])
    out = []
    for d in drivers:
        green = [(L, byLap[L][d]['lap_time'], byLap[L][d]['tyre_age']) for L in byLap if d in byLap[L]
                 and isinstance(byLap[L][d].get('lap_time'), (int, float))
                 and not byLap[L][d]['in_lap'] and not byLap[L][d]['out_lap'] and not byLap[L][d]['neutralized']]
        if len(green) < 5: continue
        ref = float(np.median([lt - fuelc(L, N) for L, lt, _ in green]))
        med_age = float(np.median([a for _, _, a in green if a is not None]))
        for P in [L for L in byLap if d in byLap[L] and byLap[L][d]['in_lap']]:
            o = byLap.get(P + 1, {}).get(d)
            if not o or not o['out_lap'] or P <= 1 or P + 1 >= N: continue
            if byLap[P][d]['neutralized'] or o['neutralized'] or neu(P) or neu(P + 1): continue
            if not isinstance(byLap[P][d]['lap_time'], (int, float)) or not isinstance(o['lap_time'], (int, float)): continue
            pl = (byLap[P][d]['lap_time'] + o['lap_time']) - (ref + fuelc(P, N)) - (ref + fuelc(P + 1, N))
            age_in = byLap[P][d]['tyre_age']
            out.append(dict(pit_loss=pl, age_in=age_in, med_age=med_age, comp_out=o['compound']))
    return out

# ---------- pit-lane time = durata mediana (G0) ----------
dur = defaultdict(list)
for r in csv.DictReader(open('data/pitstop_durate_f1db.csv')):
    if r.get('durata_s') and float(r['durata_s']) <= DUR_MAX: dur[r['gara']].append(float(r['durata_s']))
pit_lane = {g: (float(np.median(dur[g])) if dur[g] else None) for g in RACES}

# ---------- H1: correzione bias + vincolo fisico ----------
def bias_stop(s, coeff):
    deg = ((s['age_in'] - s['med_age']) * coeff) if (s['age_in'] is not None and s['med_age'] is not None) else 0.0
    warm = WARM.get(s['comp_out'], 0.0)
    return deg + warm

verdi = {g: stop_verdi(g) for g in RACES}
def track_verde(g, coeff):
    st = verdi[g]
    if not st or pit_lane[g] is None: return None, None, None
    plc = float(np.median([s['pit_loss'] - bias_stop(s, coeff) for s in st]))
    pl_raw = float(np.median([s['pit_loss'] for s in st]))
    return pit_lane[g] - plc, plc, pl_raw

H1 = {}
for coeff in COEFF_SENS:
    H1[coeff] = {g: track_verde(g, coeff) for g in RACES}
def h1_pass(coeff):
    return all(H1[coeff][g][0] is not None and H1[coeff][g][0] >= 0 for g in BEN_CAMP)
h1_centr = h1_pass(COEFF_CENTR)
h1_robusto = all(h1_pass(c) == h1_centr for c in COEFF_SENS)

# ---------- H2: R_lap dai lap times ----------
def rlap(g):
    r, byLap = load(g); sc = wins(g, 'sc'); vsc = wins(g, 'vsc')
    def field_median(pred):
        v = [byLap[L][d]['lap_time'] for L in byLap for d in byLap[L]
             if pred(L, byLap[L][d]) and isinstance(byLap[L][d].get('lap_time'), (int, float))]
        return (float(np.median(v)), len(v)) if v else (None, 0)
    green, ng = field_median(lambda L, c: L > 1 and not c['in_lap'] and not c['out_lap'] and not c['neutralized'])
    def instrict(L, W): return any(a + 1 <= L <= b - 1 for a, b in W)   # esclude deployment/restart
    scm, nsc = field_median(lambda L, c: instrict(L, sc) and not c['in_lap'] and not c['out_lap'])
    vscm, nvsc = field_median(lambda L, c: instrict(L, vsc) and not c['in_lap'] and not c['out_lap'])
    return dict(green=green, ng=ng, sc=scm, nsc=nsc, vsc=vscm, nvsc=nvsc,
                R_sc=(scm / green if scm and green else None), R_vsc=(vscm / green if vscm and green else None))
R = {g: rlap(g) for g in RACES}

# osservato SC da G (ricalcolo con lo stesso metodo di G, per GB e Giappone)
def pitloss_sc_oss(g):
    r, byLap = load(g); N = r['n_laps']; out = []
    for a, b in wins(g, 'sc'):
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
                if not o or not o['out_lap'] or L + 1 > b or lapmed.get(L) is None or lapmed.get(L + 1) is None: continue
                if not isinstance(c['lap_time'], (int, float)) or not isinstance(o['lap_time'], (int, float)): continue
                out.append((c['lap_time'] + o['lap_time']) - (lapmed[L] + lapmed[L + 1]))
    return out
SC_OSS = {}
for g in ['Gran Bretagna', 'Giappone']:
    v = pitloss_sc_oss(g)
    SC_OSS[g] = (float(np.median(v)), len(v)) if len(v) >= 8 else (None, len(v))

# H2b predizione
H2 = {}
for g in ['Gran Bretagna', 'Giappone']:
    tt, plc, _ = track_verde(g, COEFF_CENTR)
    oss, noss = SC_OSS[g]
    if tt is None or R[g]['R_sc'] is None or oss is None:
        H2[g] = None; continue
    pred_comp = pit_lane[g] - tt * R[g]['R_sc']
    pred_ratio = 0.42 * plc
    H2[g] = dict(pred_comp=pred_comp, pred_ratio=pred_ratio, oss=oss, noss=noss,
                 err_comp=abs(pred_comp - oss), err_ratio=abs(pred_ratio - oss), R_sc=R[g]['R_sc'], tt=tt, plc=plc)
testabili = [g for g in H2 if H2[g] is not None]
if testabili:
    maxerr = max(H2[g]['err_comp'] for g in testabili)
    H2_verd = 'VALIDATO' if maxerr <= 2.0 else ('SBAGLIATO' if maxerr > 4.0 else 'AMBIGUO')
    comp_meglio = all(H2[g]['err_comp'] <= H2[g]['err_ratio'] for g in testabili)
else:
    maxerr = None; H2_verd = 'NON TESTABILE'; comp_meglio = None

# ---------- CSV ----------
with open('data/rlap_per_circuito.csv', 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['gara', 'giro_verde', 'n_verde', 'giro_SC', 'n_SC', 'R_lap_SC', 'giro_VSC', 'n_VSC', 'R_lap_VSC'])
    for g in RACES:
        x = R[g]
        w.writerow([g, '' if x['green'] is None else f"{x['green']:.2f}", x['ng'],
                    '' if x['sc'] is None else f"{x['sc']:.2f}", x['nsc'], '' if x['R_sc'] is None else f"{x['R_sc']:.3f}",
                    '' if x['vsc'] is None else f"{x['vsc']:.2f}", x['nvsc'], '' if x['R_vsc'] is None else f"{x['R_vsc']:.3f}"])
with open('data/pitloss_due_componenti_proposta.csv', 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['gara', 'cid', 'pit_lane_time', 'pit_loss_verde_corretto', 'track_time_verde', 'n_verde', 'ben_campionato'])
    for g in RACES:
        tt, plc, _ = track_verde(g, COEFF_CENTR)
        w.writerow([g, RACES[g][0], '' if pit_lane[g] is None else f"{pit_lane[g]:.2f}",
                    '' if plc is None else f"{plc:.2f}", '' if tt is None else f"{tt:.2f}",
                    len(verdi[g]), int(g in BEN_CAMP)])

# ---------- REPORT ----------
L = []; P = L.append
neg_centr = [g for g in BEN_CAMP if H1[COEFF_CENTR][g][0] is not None and H1[COEFF_CENTR][g][0] < 0]
P("# REPORT_VALIDAZIONE_COMPONENTI — validazione del modello a due componenti (Sessione H)")
P("")
P(f"H1 vincolo fisico dopo correzione bias: **{'PASSA' if h1_centr else 'FALLISCE'}** — circuiti "
  f"ben campionati negativi: {', '.join(neg_centr) if neg_centr else 'nessuno'}")
P(f"H1 sensibilita' al degrado (0,03/0,044/0,06): **{'ROBUSTO' if h1_robusto else 'FRAGILE'}** "
  f"(verdetto {'invariato' if h1_robusto else 'CAMBIA'} al variare del coefficiente)")
if testabili:
    P(f"H2 predizione SC: errore max = {maxerr:.2f} s -> **{H2_verd}**")
    P(f"H2 componenti vs ratio 0,42: **{'MEGLIO' if comp_meglio else 'NON meglio'}**")
else:
    P("H2 predizione SC: **NON TESTABILE** (nessun circuito con SC osservato + R_lap)")
P("")
P("## H1 — Vincolo fisico 0 <= pit_loss <= pit_lane_time, e correzione del bias del metodo C")
P("")
P("Bias del metodo C (noto, unidirezionale, gonfia il pit-loss verde): degrado dell'in-lap")
P("(gomma vecchia) + warm-in dell'out-lap. degrado = (eta_inlap - eta_mediana_pilota)x0,044")
P("(degrado AGGREGATO committato, usato SOLO come correzione di bias su una media, MAI per-stint");
P("il filone degrado resta chiuso). warm-in da warmin_prior.csv (compound, giro_stint 0).")
P("")
P("| circuito | n | pit_lane_time | pit_loss verde GREZZO | bias mediano | pit_loss CORRETTO | track_time | >=0? |")
P("|---|---|---|---|---|---|---|---|")
for g in sorted(RACES, key=lambda g: (g not in BEN_CAMP, g)):
    tt, plc, raw = track_verde(g, COEFF_CENTR)
    if tt is None: continue
    bm = raw - plc
    tag = ' (piccolo n)' if g in PICCOLI else ('' if g in BEN_CAMP else '')
    ok = 'SI' if tt >= 0 else 'NO'
    star = ' ⭐' if g in BEN_CAMP else (' (escluso, n=%d)' % PICCOLI[g] if g in PICCOLI else '')
    P(f"| {g}{star} | {len(verdi[g])} | {pit_lane[g]:.1f} | {raw:.1f} | {bm:+.2f} | {plc:.1f} | {tt:+.1f} | {ok} |")
P("")
P(f"⭐ = ben campionato (n>=15), il test H1 riguarda SOLO questi. Cina (n=6) e Australia (n=9)")
P("sono ESCLUSI dal test e resteranno NON CORRETTI nella proposta.")
P("")
P("Sensibilita' al coefficiente di degrado (track_time dei ben campionati):")
P("| circuito | " + " | ".join(f"coeff {c}" for c in COEFF_SENS) + " |")
P("|---|" + "---|" * len(COEFF_SENS))
for g in BEN_CAMP:
    P(f"| {g} | " + " | ".join(f"{H1[c][g][0]:+.1f}" for c in COEFF_SENS) + " |")
P("")
P(f"Verdetto H1 identico a 0,03/0,044/0,06: {'SI -> ROBUSTO' if h1_robusto else 'NO -> FRAGILE, il risultato dipende dal coefficiente'}.")
P("")
if not h1_centr:
    P(f"**H1 FALLISCE: track_time negativo su {', '.join(neg_centr)} (ben campionati) anche dopo la")
    P("correzione del bias.** Il modello a due componenti NON regge sui dati. STOP: nessuna")
    P("correzione, nessuna proposta. Il filone si chiude con il debito documentato e la sua causa")
    P("(G: il campo f1db e' la durata), ma la ricalibrazione a componenti non e' validata.")
else:
    P("**H1 PASSA: track_time >= 0 su tutti i ben campionati dopo la correzione del bias.** Il")
    P("modello a componenti e' fisicamente coerente. Si procede a H2.")
P("")
P("## H2 — R_lap dai lap times (fonte indipendente) e predizione dell'SC")
P("")
P("| circuito | giro verde | giro SC | R_lap_SC | n giri SC | giro VSC | R_lap_VSC |")
P("|---|---|---|---|---|---|---|")
for g in RACES:
    x = R[g]
    gc = '—' if x['green'] is None else f"{x['green']:.1f}"
    sc_ = '—' if x['sc'] is None else f"{x['sc']:.1f}"
    rsc = '—' if x['R_sc'] is None else f"{x['R_sc']:.2f}"
    vsc_ = '—' if x['vsc'] is None else f"{x['vsc']:.1f}"
    rvsc = '—' if x['R_vsc'] is None else f"{x['R_vsc']:.2f}"
    P(f"| {g} | {gc} | {sc_} | {rsc} | {x['nsc']} | {vsc_} | {rvsc} |")
P("")
P("### H2b — Test di predizione (il cuore): pit_loss_SC = pit_lane_time - track_time_verde x R_lap_SC")
P("")
P("| circuito | predetto (componenti) | predetto (ratio 0,42) | osservato (G) | err componenti | err ratio |")
P("|---|---|---|---|---|---|")
for g in testabili:
    h = H2[g]
    P(f"| {g} | {h['pred_comp']:.1f} | {h['pred_ratio']:.1f} | {h['oss']:.1f} (n={h['noss']}) | "
      f"{h['err_comp']:.2f} | {h['err_ratio']:.2f} |")
P("")
if testabili:
    P(f"**SOLO {len(testabili)} CIRCUITI TESTABILI ({', '.join(testabili)}): un PASSA e' un INDIZIO")
    P("FORTE, non una dimostrazione.** Non si arrotonda verso l'alto.")
    vs_txt = 'il modello a componenti BATTE il ratio' if comp_meglio else "il ratio costante NON e' battuto -> il modello non serve"
    P(f"Verdetto H2: errore max componenti {maxerr:.2f} s -> **{H2_verd}**. Componenti vs ratio costante: {vs_txt}.")
P("")
proposta = h1_centr and H2_verd == 'VALIDATO' and comp_meglio
P("## Esito")
P("")
if proposta:
    P("H1 PASSA e H2 VALIDATO -> scritta la PROPOSTA (PROPOSTA_PITLOSS_DUE_COMPONENTI.md), NON eseguita.")
else:
    ragioni = []
    if not h1_centr: ragioni.append('H1 fallisce (track_time negativo)')
    if testabili and H2_verd != 'VALIDATO': ragioni.append(f'H2 {H2_verd}')
    if comp_meglio is False: ragioni.append('componenti non batte il ratio 0,42')
    if not testabili: ragioni.append('H2 non testabile')
    P(f"**Nessuna proposta: {'; '.join(ragioni)}.** Il filone si chiude. Il debito resta scritto")
    P("con la sua causa fisica (G): il file f1db e' la durata dello stop, non il pit-loss. La")
    P("ricalibrazione a due componenti non e' validata dai dati disponibili.")
P("")
P("Nessun verdetto strategico: e' del PO. Nessun file di produzione toccato.")
open('REPORT_VALIDAZIONE_COMPONENTI.md', 'w').write("\n".join(L) + "\n")
print("\n".join(L))
print(f"\nH1={'PASSA' if h1_centr else 'FALLISCE'} robusto={h1_robusto} | H2={H2_verd} maxerr={maxerr} | proposta={proposta}")
