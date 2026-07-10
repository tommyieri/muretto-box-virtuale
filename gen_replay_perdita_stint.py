"""gen_replay_perdita_stint.py — MISURA DESCRITTIVA (non un modello) della perdita di passo
negli ultimi giri degli stint reali che sono stati tirati. Archivio congelato, sola lettura.

NATURA: descrizione empirica di un fatto osservato ("di quanto peggiora il passo nella coda
dello stint"), NON stima di gamma=f(circuito,compound) (strada chiusa, NON-VALIDATA). Non si
aggrega in un parametro universale: si riporta una DISTRIBUZIONE con la sua dispersione.

============================ PROTOCOLLO PRE-REGISTRATO ============================
(fissato PRIMA di guardare i risultati; nessuna definizione scelta a posteriori)

CAMPIONE: tutti i circuiti x 3 anni presenti in data/ti_archive/{2023,2024,2025}/ (Race).
  Ordine di grandezza generale, NON specificita' di circuito.

IGIENE (riusa i filtri gia' validati, importati — non reimplementati):
  pulisci  = F1 verdi(status=='1') · F2 no in/out-lap(pin/pout nulli) · F3 slick ·
             F4 numerici · F5 lap>=2 · F6 life>=3 (out-lap + warm-in g0/g1 gia' esclusi)
  filtro_outlier(1.07) = F7 tempo <= 1.07 x mediana-stint
  ARIA PULITA (filtro NUOVO, dichiarato): un giro entra solo se il gap in sesT all'auto
    immediatamente davanti sullo STESSO giro > SOGLIA_ARIA = 2.0 s. Motivo: in scia il passo
    e' falso-lento (effetto-Leclerc) e verrebbe scambiato per degrado (stessa logica C1).
    Nota: 'iacc' nei dati NON e' una bandiera di traffico affidabile (verificato: iacc=True
    ha gap mediani PIU' larghi) -> non usato. wTT e' temperatura pista, non traffico.

STINT QUALIFICATO (soglia dichiarata):
  dopo tutti i filtri, uno stint (drv,stint) qualifica se ha >= MIN_USABLE = 8 giri usabili;
  CODA = ultimi CODA_N = 5 giri usabili (per vita-gomma); CENTRALE = i restanti, che devono
  essere >= MIN_CENTRALE = 3 (per stimare la pendenza-base). CODA=5 rispetta "coda >=4 giri".

ISOLARE IL DEGRADO DAL CARBURANTE (metodo dichiarato, riporto RAW ed entrambi i corretti):
  Il passo grezzo in coda risente di degrado (rallenta) + carburante (accelera, alleggerisce).
  - RAW marginale = pendenza OLS tempo~life sulla CODA (netto degrado-carburante).
  - ISOLATO (preferito, auto-contenuto): pendenza-base stimata dalla finestra CENTRALE (dove
    il degrado e' minimo, dominata dal carburante); ISOLATO = pendenza_coda - pendenza_base.
    (Se il centrale ha gia' degrado, l'isolato SOTTOSTIMA: bias conservativo, dichiarato.)
  - ISOLATO (prior carburante, per SENSIBILITA'): pendenza_coda - pendenza_carburante_prior,
    con pendenza_carburante_prior = -COEFF_FUEL * (FUEL_KG / N_laps), COEFF_FUEL=0.035 s/kg,
    FUEL_KG=100. APPROSSIMAZIONE non misurata per-circuito, dichiarata.

MISURE per stint qualificato:
  - perdita marginale (s/giro) in coda, degrado-isolata (metodo centrale);
  - perdita cumulata di un allungamento di 5 giri (s) = somma sulla coda (<=5 giri) di
    (tempo osservato - proiezione-base), cioe' l'eccesso osservato sopra la linea-carburante.

OUTPUT: copertura (n stint per anno/compound), distribuzione (mediana, IQR, min-max)
complessiva e per compound, riga onesta raw-vs-corretto. NESSUN KPI, NESSUNA banda, NESSUNA
soglia di copertura: RIMANDATI, a numeri visti.
"""
import os, csv, statistics as st
import numpy as np
from test_identificabilita_degrado import pulisci, filtro_outlier, SOGLIA_OUTLIER, SLICK

SOGLIA_ARIA = 2.0      # gap (s) all'auto davanti oltre cui il giro e' "aria pulita"
MIN_USABLE, CODA_N, MIN_CENTRALE = 8, 5, 3
COEFF_FUEL, FUEL_KG = 0.035, 100.0   # prior carburante (sensibilita'), dichiarato
CSV_PATH = os.path.join('data', 'replay_perdita_stint.csv')
REPORT_PATH = os.path.join('data', 'REPLAY_PERDITA_STINT_REPORT.txt')
COLS = ['anno','circuito','compound','drv','stint','n_usable','n_centrale','n_coda',
        'pend_base','pend_coda','marg_raw','marg_iso_centrale','marg_iso_fuelprior','cum5_iso']


def carica_plus(path):
    """rows con i 9 campi che pulisci/filtro_outlier leggono + sesT + flag aria-pulita.
    Aria pulita calcolata dai RAW (tutte le auto sullo stesso giro), soglia dichiarata."""
    import json
    d = json.load(open(path)); n = len(d['time'])
    # gap all'auto davanti (sesT, stesso giro) -> clean per indice
    per_lap = {}
    for i in range(n):
        L = d['lap'][i]
        if L is None or not isinstance(d['sesT'][i], (int, float)): continue
        per_lap.setdefault(int(L), []).append((d['sesT'][i], i))
    clean = {}
    for L, arr in per_lap.items():
        arr.sort()
        for k, (s, i) in enumerate(arr):
            clean[i] = True if k == 0 else (s - arr[k-1][0]) > SOGLIA_ARIA  # leader = aria pulita
    rows = []
    for i in range(n):
        r = {k: d[k][i] for k in ('drv','lap','time','life','stint','compound','status','pin','pout')}
        r['sesT'] = d['sesT'][i]; r['clean'] = clean.get(i, False)
        rows.append(r)
    return rows


def slope(xs, ys):
    """pendenza OLS di ys su xs (s/giro)."""
    return float(np.polyfit(np.array(xs, float), np.array(ys, float), 1)[0])


def misura_stint(rows_stint, N):
    """rows_stint = giri usabili (verdi, aria pulita, no outlier, life>=3) di UNO stint.
    Ritorna dict misura o None se non qualificato."""
    us = sorted(rows_stint, key=lambda r: int(r['life']))
    if len(us) < MIN_USABLE: return None
    coda = us[-CODA_N:]
    centrale = us[:-CODA_N]
    if len(centrale) < MIN_CENTRALE: return None
    lc, tc = [int(r['life']) for r in centrale], [r['time'] for r in centrale]
    lk, tk = [int(r['life']) for r in coda], [r['time'] for r in coda]
    pend_base = slope(lc, tc)          # dominata dal carburante (degrado minimo nel centrale)
    pend_coda = slope(lk, tk)          # netto degrado-carburante
    marg_raw = pend_coda
    marg_iso_centrale = pend_coda - pend_base
    pend_fuel_prior = -COEFF_FUEL * (FUEL_KG / N)
    marg_iso_fuelprior = pend_coda - pend_fuel_prior
    # cumulata 5 giri: somma sull'osservato - proiezione-base (intercetta+pendenza dal centrale)
    a_base = float(np.polyfit(np.array(lc, float), np.array(tc, float), 1)[1])
    cum5 = sum(r['time'] - (a_base + pend_base * int(r['life'])) for r in coda)
    return dict(compound=coda[-1]['compound'], drv=coda[-1]['drv'], stint=int(coda[-1]['stint']),
                n_usable=len(us), n_centrale=len(centrale), n_coda=len(coda),
                pend_base=pend_base, pend_coda=pend_coda, marg_raw=marg_raw,
                marg_iso_centrale=marg_iso_centrale, marg_iso_fuelprior=marg_iso_fuelprior,
                cum5_iso=cum5)


def calcola():
    records = []
    for anno in ('2023', '2024', '2025'):
        base = os.path.join('data', 'ti_archive', anno)
        if not os.path.isdir(base): continue
        for folder in sorted(os.listdir(base)):
            path = os.path.join(base, folder, 'Race.json')
            if not os.path.exists(path): continue
            rows = carica_plus(path)
            keep, _, N = pulisci(rows)              # F1-F6 (importati)
            keep, _ = filtro_outlier(keep, SOGLIA_OUTLIER)   # F7 (importato)
            keep = [r for r in keep if r.get('clean')]       # ARIA PULITA (dichiarato)
            per_stint = {}
            for r in keep:
                per_stint.setdefault((r['drv'], int(r['stint'])), []).append(r)
            cir = folder.replace(' Grand Prix', '')
            for rows_stint in per_stint.values():
                m = misura_stint(rows_stint, N)
                if m: records.append(dict(anno=anno, circuito=cir, **m))
    return records


def scrivi(records):
    with open(CSV_PATH, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        w.writeheader()
        for r in records:
            w.writerow({k: (f"{r[k]:.4f}" if isinstance(r[k], float) else r[k]) for k in COLS})


def distr(vals):
    v = sorted(vals)
    n = len(v)
    q = lambda p: v[min(n-1, int(p*n))]
    return dict(n=n, med=st.median(v), q25=q(.25), q75=q(.75), mn=v[0], mx=v[-1])


def report(records):
    out = []
    P = out.append
    P("=" * 76)
    P("REPLAY PERDITA STINT — misura descrittiva, archivio 2023-2025 (sola lettura)")
    P("=" * 76)
    P(f"Aria pulita: gap>{SOGLIA_ARIA}s all'auto davanti. Stint qualificato: >={MIN_USABLE} giri")
    P(f"usabili, coda={CODA_N} giri, centrale>={MIN_CENTRALE}. Isolamento carburante: metodo")
    P(f"centrale (preferito) + prior {COEFF_FUEL}s/kg x {FUEL_KG:.0f}kg/N_giri (sensibilita').")
    P("")
    # COPERTURA
    P("COPERTURA — stint qualificati")
    per_anno = {a: sum(1 for r in records if r['anno'] == a) for a in ('2023','2024','2025')}
    per_cmp = {c: sum(1 for r in records if r['compound'] == c) for c in SLICK}
    P(f"  totale: {len(records)}")
    P(f"  per anno   : " + "  ".join(f"{a}={per_anno[a]}" for a in per_anno))
    P(f"  per compound: " + "  ".join(f"{c}={per_cmp[c]}" for c in SLICK))
    if len(records) < 50:
        P(f"  ATTENZIONE: campione < ~50 -> POTENZA LIMITATA (dichiarato, filtri non rilassati).")
    P("")
    # DISTRIBUZIONI
    def blocco(nome, key, unit):
        P(f"{nome} ({unit}) — mediana [IQR 25-75] (min..max), n")
        d = distr([r[key] for r in records])
        P(f"  COMPLESSIVA : {d['med']:+.4f} [{d['q25']:+.4f},{d['q75']:+.4f}] ({d['mn']:+.4f}..{d['mx']:+.4f})  n={d['n']}")
        for c in SLICK:
            vv = [r[key] for r in records if r['compound'] == c]
            if not vv: P(f"  {c:11s}: (nessuno)"); continue
            d = distr(vv)
            P(f"  {c:11s}: {d['med']:+.4f} [{d['q25']:+.4f},{d['q75']:+.4f}] ({d['mn']:+.4f}..{d['mx']:+.4f})  n={d['n']}")
        P("")
    blocco("PERDITA MARGINALE degrado-isolata (metodo centrale)", 'marg_iso_centrale', 's/giro')
    blocco("PERDITA CUMULATA allungamento 5 giri (degrado-isolata)", 'cum5_iso', 's totali')
    # RAW vs CORRETTO
    P("RAW vs CORRETTO (mediana marginale, s/giro) — quanto sposta la correzione carburante")
    mr = st.median([r['marg_raw'] for r in records])
    mc = st.median([r['marg_iso_centrale'] for r in records])
    mf = st.median([r['marg_iso_fuelprior'] for r in records])
    P(f"  RAW (netto degrado-carburante)      : {mr:+.4f}")
    P(f"  ISOLATO metodo centrale (preferito) : {mc:+.4f}   (sposta {mc-mr:+.4f} vs raw)")
    P(f"  ISOLATO prior carburante            : {mf:+.4f}   (sensibilita' metodo: {mf-mc:+.4f} vs centrale)")
    P("")
    P("LETTURA ONESTA (limiti dichiarati):")
    P("  - DISPERSIONE ALTA: l'IQR della marginale attraversa lo zero -> in molti stint la")
    P("    coda NON mostra degrado distinguibile (coerente con Fase 2.1: il degrado spesso")
    P("    non emerge dal rumore). La distribuzione, non un valore singolo, e' il risultato.")
    P("  - CODE PESANTI della cumulata (min/max ~+-40-48s): sono ARTEFATTI di estrapolazione")
    P("    della linea-base su finestre centrali corte/rumorose. La lettura robusta e'")
    P("    mediana/IQR, NON i min-max. La marginale (differenza di pendenze) e' piu' robusta")
    P("    della cumulata (che estrapola). Nessun filtro ritoccato a posteriori.")
    P("")
    P("RIMANDATO (esplicito, a numeri visti — NON in questa misura):")
    P("  - scelta di una banda di degrado; nessun KPI di copertura ('la banda contiene il")
    P("    reale nell'X%'); nessuna soglia/verdetto. Questa e' descrizione, non predizione.")
    P("=" * 76)
    return "\n".join(out)


if __name__ == '__main__':
    records = calcola()
    scrivi(records)
    testo = report(records)
    print(testo)
    open(REPORT_PATH, 'w').write(testo + "\n")
    print(f"\nscritto {CSV_PATH} ({len(records)} righe) e {REPORT_PATH}")
