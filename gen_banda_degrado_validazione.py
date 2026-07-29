#!/usr/bin/env python3
# gen_banda_degrado_validazione.py — SOLA LETTURA su misura+pit-loss.
# Sceglie la banda di degrado (min/centrale/max, s/giro) dai percentili della
# distribuzione GIA' MISURATA (data/replay_perdita_stint.csv, colonna
# marg_iso_centrale = perdita marginale degrado-isolata, metodo centrale),
# usando SOLO 2023+2024 (in-sample), poi la valida fuori campione su 2025.
# NON rifà la misura, NON ristima nulla di fisico: legge, taglia, testa.
# Costruzione e test su stagioni DISGIUNTE (anti-circolarità).
#
# Scrive DUE artefatti NUOVI:
#   data/banda_degrado_scelta.json            (la banda congelata + provenienza)
#   data/BANDA_DEGRADO_VALIDAZIONE_REPORT.txt (report a due lati)
# Nessun file di motore/gancio/golden toccato.

import csv, json, os
import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC  = os.path.join(ROOT, 'data', 'replay_perdita_stint.csv')
PITL = os.path.join(ROOT, 'data', 'pit_loss_circuito_f1db.csv')
OUT_JSON = os.path.join(ROOT, 'data', 'banda_degrado_scelta.json')
OUT_TXT  = os.path.join(ROOT, 'data', 'BANDA_DEGRADO_VALIDAZIONE_REPORT.txt')

# --- SOGLIE CONGELATE (dichiarate PRIMA dei risultati, non reinterpretate) ---
IN_SAMPLE_COVER = 0.80   # banda [0,max] tagliata all'80% sui dati 2023+2024
OOS_MIN_COVER   = 0.70   # PASS copertura se >= 70% sul 2025 tenuto da parte
UTIL_MAX_RATIO  = 0.25   # PASS utilità se larghezza_5giri/pit_loss <= 25% su TUTTI
FUEL_PRIOR_MED  = 0.091  # mediana marginale col metodo prior-carburante (misura complessiva)
STRETCH_LAPS    = 5      # allungamento su cui si cumula la larghezza (forma lineare v1.5)
PCTL_METHOD     = 'linear'  # np.percentile default (interpolazione lineare)
MAX_PCTL_ANCHOR = 90.0   # ancora esplicita della spec per il bordo alto ("~90° percentile").
                         # NON si usa il 100° pctile: la misura stessa dichiara min/max
                         # ARTEFATTI di estrapolazione (REPLAY_PERDITA_STINT_REPORT).

# --- lettura misura ---
rows = []
with open(SRC, newline='') as f:
    for r in csv.DictReader(f):
        try:
            rows.append((int(r['anno']), r['compound'], float(r['marg_iso_centrale'])))
        except (ValueError, KeyError):
            pass  # riga non parsabile -> scartata

insample = np.array([v for (a, c, v) in rows if a in (2023, 2024)], float)
oos      = np.array([v for (a, c, v) in rows if a == 2025], float)

def pctl(arr, p):
    return float(np.percentile(arr, p, method=PCTL_METHOD))

# ================= STEP 1 — costruzione banda (solo in-sample 2023-24) =================
n_in = len(insample)
frac_below_0 = float((insample < 0).mean())          # stint che il floor a 0 forfeita
ceiling_cover = float((insample >= 0).mean())          # tetto di copertura di QUALSIASI [0,max]
p10_in    = pctl(insample, 10)
median_in = pctl(insample, 50)

# min = pavimento a 0 (misurato: molti stint non degradano in coda; degrado<0 non ha
# senso operativo). Il 10° pctile è negativo -> floor a 0 forzato (dichiarato).
band_min = 0.0
floor_is_forced = p10_in < 0

# max: la spec vuole [0,max] all'80% in-sample -> F(max)=0.80+frac_below_0. Qui
# frac_below_0=%.3f, quindi 0.80+frac_below_0 > 1: l'80% in-sample è IRRAGGIUNGIBILE
# con un floor a 0 (il floor da solo forfeita più del 20%). Lo si DICHIARA e si àncora
# max al percentile esplicito della spec (90°), non al 100° (artefatto).
target_prob = IN_SAMPLE_COVER + frac_below_0
cover80_reachable = target_prob <= 1.0
band_max_anchor = pctl(insample, MAX_PCTL_ANCHOR)

# Assorbimento incertezza-carburante nel bordo alto: max deve coprire la mediana
# stimata col metodo prior-carburante (~0.091). Se non la copre, alzo max e dichiaro.
fuel_absorbed = band_max_anchor < FUEL_PRIOR_MED
band_max = max(band_max_anchor, FUEL_PRIOR_MED)
band_central = median_in

def cover_band(arr, lo, hi):
    return float(((arr >= lo) & (arr <= hi)).mean()) if len(arr) else float('nan')

insample_cover_final = cover_band(insample, band_min, band_max)

# Nota informativa (NON seconda banda): dove spinge il bordo alto il SOFT in-sample?
soft_in = np.array([v for (a, c, v) in rows if a in (2023, 2024) and c == 'SOFT'], float)
soft_high = pctl(soft_in, MAX_PCTL_ANCHOR) if len(soft_in) else float('nan')

# Sweep percentile->copertura->utilità: mostra che NESSUN max concilia le due soglie.
sweep = []
worst_pit = None  # riempito dopo aver letto i pit-loss

# ================= STEP 2 — validazione fuori campione (2025) =================
oos_cover = cover_band(oos, band_min, band_max)
oos_by_comp = {}
for cc in ('SOFT', 'MEDIUM', 'HARD'):
    a = np.array([v for (a_, c, v) in rows if a_ == 2025 and c == cc], float)
    oos_by_comp[cc] = {'n': int(len(a)), 'coverage': cover_band(a, band_min, band_max)}

oos_above = float((oos > band_max).mean()) if len(oos) else float('nan')  # coda alta
oos_below = float((oos < band_min).mean()) if len(oos) else float('nan')  # bordo zero
oos_ceiling = float((oos >= 0).mean())  # copertura massima possibile sul 2025 (max=+inf)
cover_pass = (oos_cover >= OOS_MIN_COVER)

# ================= STEP 3 — utilità vs pit-loss (per circuito) =================
# larghezza cumulata su 5 giri (forma lineare v1.5): max*5 - min*5.
width_5 = band_max * STRETCH_LAPS - band_min * STRETCH_LAPS
circuits = []
with open(PITL, newline='') as f:
    for r in csv.DictReader(f):
        cid = r['cid']; pl = float(r['pit_loss_s'])
        ratio = width_5 / pl
        circuits.append({'cid': cid, 'pit_loss_s': pl, 'ratio': ratio,
                         'sfora': ratio > UTIL_MAX_RATIO})
ratios = np.array([c['ratio'] for c in circuits])
ratio_median = float(np.median(ratios))
worst = max(circuits, key=lambda c: c['ratio'])   # pit-loss minimo = rapporto peggiore
sforano = [c for c in circuits if c['sfora']]
util_pass = (len(sforano) == 0)
min_pit = min(c['pit_loss_s'] for c in circuits)   # per lo sweep

# sweep completo (dopo aver letto min_pit)
for p in (70, 75, 80, 85, MAX_PCTL_ANCHOR, 95, 97.5, 99, 100):
    v = pctl(insample, p)
    w5 = v * STRETCH_LAPS
    sweep.append({'p': p, 'max': v,
                  'cov_in': cover_band(insample, 0.0, v),
                  'cov_2025': cover_band(oos, 0.0, v),
                  'larg5': w5, 'worst_ratio': w5 / min_pit})

# ================= ESITO MECCANICO =================
esito = 'PASS' if (cover_pass and util_pass) else 'NON-VALIDATO'

band = {
    'metodo_colonna': 'marg_iso_centrale',
    'min': round(band_min, 4), 'centrale': round(band_central, 4), 'max': round(band_max, 4),
    'unita': 's/giro', 'compound_agnostica': True,
    'provenienza_percentili': {
        'in_sample_anni': [2023, 2024], 'n_in_sample': n_in,
        'metodo_percentile': PCTL_METHOD,
        'frac_sotto_zero_in_sample': round(frac_below_0, 4),
        'tetto_copertura_in_sample_[0,+inf]': round(ceiling_cover, 4),
        'p10_in_sample': round(p10_in, 4),
        'min_da': 'pavimento a 0 (degrado<0 privo di senso operativo; floor forzato=%s)' % floor_is_forced,
        'centrale_da': 'mediana in-sample (p50)',
        'max_da': 'percentile %.0f in-sample (ancora spec)' % MAX_PCTL_ANCHOR,
        'max_pctl_level': MAX_PCTL_ANCHOR,
        'copertura_80_in_sample_raggiungibile': cover80_reachable,
        'nota_copertura_80': ('IRRAGGIUNGIBILE con floor a 0: 0.80+%.3f=%.3f>1; '
                              'tetto assoluto %.1f%%' % (frac_below_0, target_prob, ceiling_cover*100)),
        'assorbimento_fuel_prior': {'soglia': FUEL_PRIOR_MED, 'max_alzato_per_coprirla': fuel_absorbed},
        'copertura_in_sample_finale_[0,max]': round(insample_cover_final, 4),
    },
    'soglie_congelate': {'in_sample_cover': IN_SAMPLE_COVER, 'oos_min_cover': OOS_MIN_COVER,
                         'util_max_ratio': UTIL_MAX_RATIO, 'stretch_laps': STRETCH_LAPS},
    'esito_meccanico': {'copertura_2025': round(oos_cover, 4), 'copertura_pass': cover_pass,
                        'utilita_ratio_peggiore': round(worst['ratio'], 4), 'utilita_pass': util_pass,
                        'esito': esito},
}
with open(OUT_JSON, 'w') as f:
    json.dump(band, f, indent=2)

# ---- report leggibile a due lati ----
L = []
def w(s=''): L.append(s)
w('=' * 76)
w('BANDA DEGRADO — SCELTA + VALIDAZIONE FUORI CAMPIONE (sola lettura su misura)')
w('=' * 76)
w('Fonte: data/replay_perdita_stint.csv, colonna marg_iso_centrale (perdita')
w('marginale degrado-isolata, metodo centrale). Costruzione e test su stagioni')
w('DISGIUNTE: banda tagliata su 2023+2024, validata sul 2025 tenuto da parte.')
w('Percentili: numpy method=%s.' % PCTL_METHOD)
w('')
w('SOGLIE CONGELATE (dichiarate prima dei risultati):')
w('  - copertura in-sample banda [0,max] : %.0f%% su 2023+2024' % (IN_SAMPLE_COVER * 100))
w('  - PASS copertura 2025 (fuori camp.) : >= %.0f%%' % (OOS_MIN_COVER * 100))
w('  - PASS utilità (larghezza %d giri)   : <= %.0f%% del pit-loss su TUTTI i circuiti'
  % (STRETCH_LAPS, UTIL_MAX_RATIO * 100))
w('  - ESITO PASS solo se reggono ENTRAMBE; se una cade -> NON-VALIDATO.')
w('')
w('-' * 76)
w('STEP 1 — BANDA su 2023-24 (solo in-sample, n=%d)' % n_in)
w('-' * 76)
w('  frazione stint con marg_iso_centrale < 0 (in-sample) : %.1f%%' % (frac_below_0 * 100))
w('  10° percentile in-sample                              : %+.4f  (floor a 0 %s)'
  % (p10_in, 'taglia coda negativa reale' if floor_is_forced else 'non necessario'))
w('  mediana in-sample (p50)                               : %+.4f' % median_in)
w('')
w('  LIMITE STRUTTURALE DICHIARATO (non un fallimento di taratura):')
w('    l\'80%% in-sample con banda [0,max] richiede F(max)=0.80+%.3f=%.3f > 1.'
  % (frac_below_0, target_prob))
w('    Il floor a 0, da solo, forfeita il %.1f%% degli stint (degrado<0). Quindi la'
  % (frac_below_0 * 100))
w('    copertura in-sample di QUALSIASI [0,max] ha tetto %.1f%% (anche a max=+inf).'
  % (ceiling_cover * 100))
w('    L\'80%% è IRRAGGIUNGIBILE per struttura. max ancorato al %.0f° pctile (spec);'
  % MAX_PCTL_ANCHOR)
w('    NON al 100° (la misura dichiara min/max artefatti di estrapolazione).')
w('  assorbimento incertezza-carburante nel bordo alto:')
w('    mediana metodo prior-carburante (misura complessiva) = %.3f' % FUEL_PRIOR_MED)
w('    max=%+.4f %s -> %s'
  % (band_max_anchor, 'la copre' if not fuel_absorbed else 'NON la copre',
     'nessun innalzamento' if not fuel_absorbed else 'max alzato a %.3f (dichiarato)' % FUEL_PRIOR_MED))
w('  copertura in-sample con banda FINALE [0,%.4f]         : %.1f%%'
  % (band_max, insample_cover_final * 100))
w('')
w('  >> BANDA SCELTA (s/giro, compound-agnostica):')
w('       min (ottimistico)  = %+.4f   [pavimento a 0]' % band_min)
w('       centrale           = %+.4f   [mediana in-sample p50]' % band_central)
w('       max (pessimistico) = %+.4f   [%.0f° pctile in-sample; copre fuel-prior %.3f]'
  % (band_max, MAX_PCTL_ANCHOR, FUEL_PRIOR_MED))
w('  nota informativa (NON seconda banda): SOFT in-sample al %.0f° pctile = %+.4f%s'
  % (MAX_PCTL_ANCHOR, soft_high,
     '  (il SOFT spinge il bordo alto piu\' su)' if soft_high > band_max else ''))
w('')
w('-' * 76)
w('STEP 2 — VALIDAZIONE FUORI CAMPIONE su 2025 (banda congelata dallo Step 1)')
w('-' * 76)
w('  copertura 2025 complessiva (marg in [%.4f,%.4f]) : %.1f%%   (soglia >= %.0f%%)  %s'
  % (band_min, band_max, oos_cover * 100, OOS_MIN_COVER * 100, 'PASS' if cover_pass else 'FAIL'))
w('  per compound:')
for cc in ('SOFT', 'MEDIUM', 'HARD'):
    d = oos_by_comp[cc]
    w('    %-7s (n=%3d) : %.1f%%' % (cc, d['n'], d['coverage'] * 100))
w('  dove cade il fuori-banda 2025: sopra max (coda alta) %.1f%% | sotto 0 (bordo zero) %.1f%%'
  % (oos_above * 100, oos_below * 100))
w('  TETTO copertura 2025 (anche a max=+inf) : %.1f%% -> sotto il %.0f%%: la copertura'
  % (oos_ceiling * 100, OOS_MIN_COVER * 100))
w('    non può passare con NESSUN max, perché il %.1f%% dei 2025 è sotto il floor a 0.'
  % (oos_below * 100))
if not cover_pass:
    w('  >> SOTTO soglia di %.1f punti. Sfondamento dominante: %s.'
      % ((OOS_MIN_COVER - oos_cover) * 100,
         'coda alta (>max)' if oos_above >= oos_below else 'bordo zero (<0)'))
w('')
w('-' * 76)
w('STEP 3 — UTILITÀ vs pit-loss per circuito (pit_loss_circuito_f1db.csv, n=%d circuiti)'
  % len(circuits))
w('-' * 76)
w('  larghezza cumulata su %d giri (forma lineare v1.5, max*5 - min*5) = %.4f s'
  % (STRETCH_LAPS, width_5))
w('  rapporto larghezza_5giri / pit_loss_circuito:')
w('    mediano   : %.3f' % ratio_median)
w('    peggiore  : %.3f  (%s, pit-loss %.2fs)  (soglia <= %.2f)  %s'
  % (worst['ratio'], worst['cid'], worst['pit_loss_s'], UTIL_MAX_RATIO,
     'PASS' if util_pass else 'FAIL'))
if sforano:
    w('    circuiti che sforano %.2f: %s'
      % (UTIL_MAX_RATIO, ', '.join('%s(%.3f)' % (c['cid'], c['ratio'])
                                   for c in sorted(sforano, key=lambda x: -x['ratio']))))
else:
    w('    nessun circuito sfora la soglia %.2f (banda utile su tutti i tracciati).' % UTIL_MAX_RATIO)
w('')
w('  SWEEP percentile bordo-alto -> copertura vs utilità (mostra che NESSUN max')
w('  concilia le due soglie: la copertura satura sotto il 70% ben prima che l\'utilità')
w('  ceda, e per spingerla su serve un max che fa sforare l\'utilità):')
w('    %5s  %8s  %7s  %8s  %7s  %s' % ('pctile', 'max', 'cov_in', 'cov_2025', 'larg5s', 'worst_ratio'))
for s in sweep:
    flags = []
    if s['cov_2025'] >= OOS_MIN_COVER: flags.append('cov>=70')
    if s['worst_ratio'] <= UTIL_MAX_RATIO: flags.append('util<=.25')
    w('    %5s  %+7.4f  %6.1f%%  %7.1f%%  %7.3f  %7.3f  %s'
      % (('p%g' % s['p']), s['max'], s['cov_in']*100, s['cov_2025']*100,
         s['larg5'], s['worst_ratio'], ' '.join(flags)))
w('')
w('=' * 76)
w('ESITO MECCANICO')
w('=' * 76)
w('  copertura 2025 : %s   utilità : %s   =>  %s'
  % ('PASS' if cover_pass else 'FAIL', 'PASS' if util_pass else 'FAIL', esito))
if esito == 'NON-VALIDATO' and not cover_pass:
    w('')
    w('  Lettura CANDIDATA (segnalata, NON conclusa — il verdetto strategico è del PO):')
    w('  il prior storico 2023-24 non generalizza in copertura al 2025. Di piu\': la banda')
    w('  [0,max] non può in linea di principio raggiungere il 70%%, perché ~%.0f%% degli'
      % (oos_below * 100))
    w('  stint 2025 ha degrado marginale isolato < 0 (coda che non degrada / rumore /')
    w('  residuo carburante), fuori dal floor a 0 per costruzione.')
w('')
w('Nota: verdetto MECCANICO (copertura/utilità vs soglie). Il verdetto STRATEGICO')
w('(banda statica vs passaggio a v2 dal weekend) NON è scritto qui: è del PO.')
w('=' * 76)

with open(OUT_TXT, 'w') as f:
    f.write('\n'.join(L) + '\n')

print('\n'.join(L))
print('\n[scritto] %s' % OUT_JSON)
print('[scritto] %s' % OUT_TXT)
