"""ai_lab/scienziato/fondo.py — IL FONDO, e nient'altro.

Unico modulo autorizzato a leggere i dati. Legge SOLO la cronometria grezza:

    time, sesT      tempi sul giro e cronometria cumulata
    pin, pout       pit reali (giro di ingresso / di uscita)
    pos             posizioni
    status          bandiera, nella sola decodifica COMMITTATA ('1' = verde)

Metadati della stessa fonte, ammessi con dichiarazione esplicita e mai per stimare il
coefficiente (solo livelli / esclusioni): compound, del, fresh, life, wR.

NON importa engine/, non legge nessun CSV derivato di data/, non conosce FUEL_COEFF,
pace_base, pit-loss, bande. Se un giorno servisse un pezzo intermedio, si ricostruisce
qui dal fondo — non si eredita.
"""
import json
import os
import statistics as st

RADICE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ARCHIVIO = os.path.join(RADICE, 'data', 'ti_archive')
CACHE = os.path.join(RADICE, 'data', 'ti_cache')

SLICK = ('SOFT', 'MEDIUM', 'HARD')
SOGLIA_OUTLIER = 1.07     # metodo conservato dal progetto (F8)
SOGLIA_ARIA = 2.0         # s — aria libera (F9); metodo conservato, calcolato dal fondo
ETA_MIN = 3               # F6

# le 2026 che vivono solo in ti_cache (nome file -> nome gara leggibile)
CACHE_2026 = {'Australian': 'Australia', 'Austrian': 'Austria', 'Barcelona': 'Spagna',
              'Canadian': 'Canada', 'Chinese': 'Cina', 'Japanese': 'Giappone',
              'Miami': 'Miami', 'Monaco': 'Monaco'}


def nullo(x):
    return x is None or str(x) == 'None'


# ---------------------------------------------------------------- blocchi
def elenco_blocchi():
    """Un blocco = una GARA. Blocchi indipendenti, mai osservazioni.
    Regime dichiarato: '2023-25' e '2026' non si mescolano mai."""
    b = []
    for anno in sorted(os.listdir(ARCHIVIO)):
        d = os.path.join(ARCHIVIO, anno)
        if not os.path.isdir(d):
            continue
        for gp in sorted(os.listdir(d)):
            p = os.path.join(d, gp, 'Race.json')
            if os.path.exists(p):
                b.append({'id': f'{anno} {gp.replace(" Grand Prix", "")}', 'anno': int(anno),
                          'regime': '2026' if anno == '2026' else '2023-25', 'percorso': p})
    presenti = {x['id'].split(' ', 1)[1] for x in b if x['anno'] == 2026}
    for f, nome in sorted(CACHE_2026.items()):
        p = os.path.join(CACHE, f + '.json')
        if os.path.exists(p) and os.path.getsize(p) > 1000 and nome not in presenti:
            b.append({'id': f'2026 {nome}', 'anno': 2026, 'regime': '2026', 'percorso': p})
    return sorted(b, key=lambda x: x['id'])


def carica(percorso):
    """La sorgente TI e' colonnare. Ritorna righe, senza toccare i valori."""
    d = json.load(open(percorso))
    n = len(d['time'])
    campi = ('drv', 'lap', 'time', 'sesT', 'pos', 'status', 'pin', 'pout',
             'compound', 'life', 'fresh', 'del', 'wR', 'lSD')
    return [{k: d[k][i] for k in campi if k in d} for i in range(n)]


def data_gara(righe):
    """Dal timestamp del primo giro (fondo)."""
    ts = [r.get('lSD') for r in righe if not nullo(r.get('lSD'))]
    return min(ts)[:10] if ts else '0000-00-00'


def bagnato(righe):
    """Pioggia: un solo giro con wR True basta a scartare la gara."""
    return any(r.get('wR') is True for r in righe)


# ---------------------------------------------------------------- ricostruzioni dal fondo
def stint_ed_eta(righe):
    """Ricostruisce stint ed ETA-GOMMA dai soli PIT REALI (pin/pout) — fondo puro.

    Convenzione: il pit avviene alla fine del giro con pin; il giro successivo e'
    l'out-lap e apre lo stint nuovo con eta 1. Chi parte con gomme usate (quali) ha
    un'eta vera maggiore: lo scarto col campo `life` e' misurato, non assunto.
    """
    per_drv = {}
    for r in righe:
        if isinstance(r['lap'], (int, float)):
            per_drv.setdefault(r['drv'], []).append(r)
    fuori = {}
    for drv, giri in per_drv.items():
        giri.sort(key=lambda r: int(r['lap']))
        stint, eta = 1, 0
        for r in giri:
            if not nullo(r['pout']) and eta > 0:      # out-lap: apre lo stint
                stint, eta = stint + 1, 0
            eta += 1
            fuori[(drv, int(r['lap']))] = (stint, eta)
            if not nullo(r['pin']):                   # pit a fine giro
                pass
    return fuori


def controllo_eta(righe, ricostruita):
    """Controllo di coerenza fra l'eta ricostruita dal fondo e il campo `life` della
    fonte. Non corregge nulla: MISURA l'accordo e lo riporta."""
    diff, n = {}, 0
    for r in righe:
        k = (r['drv'], int(r['lap'])) if isinstance(r['lap'], (int, float)) else None
        if k is None or k not in ricostruita or not isinstance(r.get('life'), (int, float)):
            continue
        d = int(r['life']) - ricostruita[k][1]
        diff[d] = diff.get(d, 0) + 1
        n += 1
    if not n:
        return None
    return {'n': n, 'accordo_esatto': round(diff.get(0, 0) / n, 4),
            'entro_1': round(sum(v for d, v in diff.items() if abs(d) <= 1) / n, 4),
            'scarti_piu_frequenti': sorted(diff.items(), key=lambda x: -x[1])[:4]}


def gap_davanti(righe):
    """Gap all'auto immediatamente davanti, FRA AUTO SULLO STESSO GIRO reale (l'ordine
    per sesT fra chi ha completato lo stesso giro e' l'ordine in pista). Il leader non
    ha nessuno davanti: aria libera per definizione.

    Limite dichiarato: non cattura il traffico dei doppiati, che stanno su un altro
    indice di giro.
    """
    per_giro = {}
    for r in righe:
        if isinstance(r['lap'], (int, float)) and isinstance(r.get('sesT'), (int, float)):
            per_giro.setdefault(int(r['lap']), []).append((float(r['sesT']), r['drv']))
    gap = {}
    for L, v in per_giro.items():
        v.sort()
        for i, (t, d) in enumerate(v):
            gap[(d, L)] = None if i == 0 else t - v[i - 1][0]
    return gap


# ---------------------------------------------------------------- igiene
def pulisci(righe, soglia_aria=SOGLIA_ARIA, eta_da_life=False):
    """Filtri F1-F9 del prereg, contati. Ritorna (righe_pulite, scarti, N)."""
    eta = stint_ed_eta(righe)
    gap = gap_davanti(righe)
    N = max(int(r['lap']) for r in righe if isinstance(r['lap'], (int, float)))
    scarti = {k: 0 for k in ('F1_status', 'F2_inout', 'F3_cancellato', 'F4_nan',
                             'F5_giro1', 'F6_eta', 'F7_compound', 'F9_traffico')}
    keep = []
    for r in righe:
        if not isinstance(r['lap'], (int, float)) or not isinstance(r['time'], (int, float)):
            scarti['F4_nan'] += 1
            continue
        L, drv = int(r['lap']), r['drv']
        if str(r['status']) != '1':
            scarti['F1_status'] += 1
            continue
        if not (nullo(r['pin']) and nullo(r['pout'])):
            scarti['F2_inout'] += 1
            continue
        if r.get('del') is True:
            scarti['F3_cancellato'] += 1
            continue
        if L < 2:
            scarti['F5_giro1'] += 1
            continue
        if (drv, L) not in eta:
            scarti['F4_nan'] += 1
            continue
        s, e = eta[(drv, L)]
        if eta_da_life:
            if not isinstance(r.get('life'), (int, float)):
                scarti['F4_nan'] += 1
                continue
            e = int(r['life'])
        if e < ETA_MIN:
            scarti['F6_eta'] += 1
            continue
        if r.get('compound') not in SLICK:
            scarti['F7_compound'] += 1
            continue
        g = gap.get((drv, L))
        if g is not None and g < soglia_aria:
            scarti['F9_traffico'] += 1
            continue
        keep.append({'drv': drv, 'lap': L, 'time': float(r['time']), 'stint': s, 'eta': e,
                     'compound': r['compound'], 'gap': g})
    keep, n_out = filtro_outlier(keep, SOGLIA_OUTLIER)
    scarti['F8_outlier'] = n_out
    return keep, scarti, N


def filtro_outlier(keep, soglia):
    """F8 — dentro (pilota, stint): tempo <= soglia * mediana dello stint."""
    per_stint = {}
    for r in keep:
        per_stint.setdefault((r['drv'], r['stint']), []).append(r)
    out, n = [], 0
    for righe in per_stint.values():
        med = st.median([r['time'] for r in righe])
        for r in righe:
            if r['time'] <= soglia * med:
                out.append(r)
            else:
                n += 1
    return out, n
