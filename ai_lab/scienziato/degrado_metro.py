"""ai_lab/scienziato/degrado_metro.py — IL METRO del degrado, condiviso.

Le funzioni che servono SIA allo studio (`run_degrado_2026.py`) SIA al modello vivo
(`modello_degrado.py`). Stanno qui perche' il modello che va in produzione non deve
dipendere da uno script di studio: il metro e' uno solo, e si misura sempre allo stesso modo.

Tutto dichiarato in PREREG_degrado_2026.md prima dei numeri.
"""
import statistics as st

import degrado as DG
import degrado_verde as DV
import fondo
import scheletro

# --- soglie del prereg, tutte dichiarate prima dei numeri
MIN_CASI, MIN_GARE = 30, 4          # §4 numerosita' (adattata al regime: 10 gare -> 5+5)
QUOTA_NETTA = 0.60                  # §4B, identica al prereg madre
FATTORE_MARGINE = 2.0               # §4B, identica al prereg madre
G_STELLA = 1.5                      # §3, ereditata dichiarata da esito_degrado.json


def costruisci(regime, eta_quadratica=False):
    """Modello per gara dal fondo, col carburante congelato sottratto. Nessuna stima nuova
    di carburante, nessun coefficiente ereditato da altri regimi."""
    fuori = {}
    for b in fondo.elenco_blocchi():
        if b['regime'] != regime:
            continue
        d = DG.prepara(b)
        if d is None:
            continue                       # bagnata
        m = DG.stima(d, eta_quadratica=eta_quadratica)
        fuori[b['id']] = {'dati': d, 'modello': None if 'escluso' in m else m,
                          'motivo': m.get('escluso')}
    return fuori


def con_rho(mod, rho):
    """Il modello della gara con il rho SOSTITUITO da quello che viaggia (PREREG §2).
    alpha, beta, delta restano della gara: sono parametri di disturbo, non trasferibili."""
    m = dict(mod)
    m['rho'] = {c: rho.get(c, mod['rho'][c]) for c in mod['rho']}
    return m


def rho_viaggiante(tab, gare_cal):
    """La mediana cross-gara delle pendenze, dalle SOLE gare di calibrazione (PREREG §2).
    Blocchi = gare. IC95 con scheletro.bootstrap_a_blocchi, che e' SOTTO SIGILLO: la chiamo,
    non la tocco."""
    per_c = {}
    for g in gare_cal:
        m = tab[g]['modello']
        if m is None:
            continue
        for c, v in m['rho'].items():
            per_c.setdefault(c, []).append(v)
    rho, dettaglio = {}, {}
    for c in sorted(per_c):
        v = per_c[c]
        b = scheletro.bootstrap_a_blocchi(v)
        rho[c] = b['mediana'] if b['mediana'] is not None else v[0]
        dettaglio[c] = {'mediana': rho[c], 'ci95': b['ci95'], 'n_gare': len(v),
                        'per_gara': {g: round(tab[g]['modello']['rho'][c], 5)
                                     for g in gare_cal
                                     if tab[g]['modello'] and c in tab[g]['modello']['rho']}}
    return rho, dettaglio


def _pl_gara(d, m, solo_verdi=True):
    """Il pit-loss dal fondo, dalle SOLE soste verdi (PREREG §7-ter). Identico per il modello
    e per il degrado-zero, e identico fra C1 e C3: non inclina nessun confronto appaiato."""
    r = DV.pit_loss_verde(d, m, solo_verdi)
    return None if r is None else r['pit_loss']


def tol_da_cal(tab, gare_cal, rho, cliff=None, solo_verdi=True, veto=False):
    """`tol` = 68o percentile di |sim(reale) - reale| sulle SOLE gare di calibrazione."""
    scarti = []
    for gid in gare_cal:
        t = tab[gid]
        if t['modello'] is None or (veto and t['dati']['neutralizzata']):
            continue
        m = con_rho(t['modello'], rho)
        pl = _pl_gara(t['dati'], m)
        if pl is None:
            continue
        scarti.extend(DV.scarti_calibrazione(t['dati'], m, pl, cliff, solo_verdi).values())
    return DV.tol_da_calibrazione(scarti), len(scarti)


def misura_X(tab, gare_ver, rho, tol, etichetta, cliff=None, solo_verdi=True, veto=False):
    """La X: su quanti casi valutabili in aria libera la strategia ottima batte il reale."""
    casi, esclusi = [], {}
    for gid in gare_ver:
        t = tab[gid]
        if t['modello'] is None:
            esclusi['gara senza modello'] = esclusi.get('gara senza modello', 0) + 1
            continue
        d = t['dati']
        if veto and d['neutralizzata']:
            esclusi['gara neutralizzata (veto)'] = esclusi.get('gara neutralizzata (veto)', 0) + 1
            continue
        m = con_rho(t['modello'], rho)
        pl = _pl_gara(d, m)
        if pl is None:
            esclusi['pit-loss non ricostruibile'] = esclusi.get('pit-loss non ricostruibile', 0) + 1
            continue
        eta_mappa = fondo.stint_ed_eta(d['righe'])
        for drv in sorted(m['alpha']):
            v = DV.valuta_pilota_verde(d, m, drv, pl, G_STELLA, tol, cliff=cliff,
                                       eta_mappa=eta_mappa, solo_verdi=solo_verdi)
            if 'escluso' in v:
                esclusi[v['escluso']] = esclusi.get(v['escluso'], 0) + 1
                continue
            v.update({'gara': gid, 'pilota': drv, 'circuito': d['circuito']})
            casi.append(v)
    vinti = [c for c in casi if c['vince']]
    gare = sorted({c['gara'] for c in casi})
    per_gara = {}
    for g in gare:
        cg = [c for c in casi if c['gara'] == g]
        per_gara[g] = {'n': len(cg), 'vinti': sum(1 for c in cg if c['vince']),
                       'quota': round(sum(1 for c in cg if c['vince']) / len(cg), 4)}
    return {'etichetta': etichetta, 'n_casi': len(casi), 'n_gare': len(gare),
            'n_vinti': len(vinti),
            'quota': round(len(vinti) / len(casi), 4) if casi else None,
            'margine_mediano_vittorie': round(st.median([c['margine'] for c in vinti]), 3)
            if vinti else None,
            'tol': round(tol, 3) if tol else None, 'G_stella': G_STELLA,
            'esclusi': esclusi, 'per_gara': per_gara, 'casi': casi,
            'gare_verifica': sorted(gare_ver)}


def stampa_X(X):
    print(f"  {X['etichetta']}")
    print(f"    casi valutabili {X['n_casi']} su {X['n_gare']} gare | vinti {X['n_vinti']} "
          f"| X = {100*(X['quota'] or 0):.1f} %")
    print(f"    tol = {X['tol']} s | margine mediano delle vittorie = "
          f"{X['margine_mediano_vittorie']} s")
    print(f"    esclusi: {X['esclusi']}")


# ---------------------------------------------------------------- cancello (A) predittivo
def cancello_predittivo(tab, gare_ver, rho, cliff=None):
    """(A) Il modello batte il NON-FARE-NIENTE? Il degrado-zero e' RISTIMATO senza le colonne
    dell'eta (PREREG §7-bis): non un fantoccio con le rho spente a mano.

    Confronto appaiato per gara sull'errore di ricostruzione |sim(reale) - reale|, mediano
    fra i piloti. IC95 con bootstrap_a_blocchi (blocchi = gare, SOTTO SIGILLO)."""
    coppie = []
    for gid in gare_ver:
        t = tab[gid]
        if t['modello'] is None:
            continue
        d = t['dati']
        m = con_rho(t['modello'], rho)
        z = DV.stima_senza_degrado(d)
        if 'escluso' in z:
            continue
        pl = _pl_gara(d, m)
        if pl is None:
            continue
        s_m = DV.scarti_calibrazione(d, m, pl, cliff)
        s_z = DV.scarti_calibrazione(d, z, pl, None)
        com = sorted(set(s_m) & set(s_z))
        if not com:
            continue
        e_m = st.median([s_m[k] for k in com])
        e_z = st.median([s_z[k] for k in com])
        coppie.append({'gara': gid, 'n_piloti': len(com),
                       'errore_modello': round(e_m, 3), 'errore_zero': round(e_z, 3),
                       'guadagno': round(e_z - e_m, 3)})
    if len(coppie) < 2:
        return {'giudicabile': False, 'motivo': f'{len(coppie)} gare', 'coppie': coppie}
    b = scheletro.bootstrap_a_blocchi([c['guadagno'] for c in coppie])
    esclude = bool(b['ci95'] and b['ci95'][0] > 0)
    return {'giudicabile': True, 'coppie': coppie,
            'guadagno_mediano': b['mediana'], 'ci95': b['ci95'], 'n_gare': b['n_blocchi'],
            'esclude_lo_zero': esclude, 'SUPERATO': esclude,
            'criterio': 'errore di ricostruzione minore del degrado-zero RISTIMATO, con '
                        'IC95 appaiato sui blocchi che esclude lo zero'}


# ---------------------------------------------------------------- (2) C2 — dove fallisce
FASCE_ETA = [(3, 9), (10, 14), (15, 19), (20, 24), (25, 29), (30, 99)]


def c2(tab, gare, cal, ver, rho):
    """Dove il lineare fallisce, e la domanda dichiarata nel prereg §5: e' il CLIFF?

    PREDIZIONE FALSIFICABILE (dichiarata prima di guardare): se e' il cliff, il residuo
    mediano (reale - previsto) dev'essere CRESCENTE con l'eta gomma nella coda. Se e' piatto,
    il cliff non c'e' nei dati 2026 e C3 non ha bersaglio.
    """
    # --- (a) il residuo per fascia di ETA', a blocchi = gare
    per_fascia = {f: {} for f in FASCE_ETA}
    for gid in gare:
        t = tab[gid]
        if t['modello'] is None:
            continue
        d = t['dati']
        m = con_rho(t['modello'], rho)
        for r in d['puliti']:
            if r['compound'] not in m['rho']:
                continue
            if r['gap'] is not None and r['gap'] <= DG.GAP_STIMA:
                continue                      # aria libera: il traffico non deve sporcare
            p = DV._passo(m, d, r['drv'], r['lap'], r['compound'], r['eta'])
            if p is None:
                continue
            for f in FASCE_ETA:
                if f[0] <= r['eta'] <= f[1]:
                    per_fascia[f].setdefault(gid, []).append(r['time'] - p)
                    break
    print('  (a) RESIDUO (reale - previsto) per FASCIA DI ETA GOMMA, in aria libera')
    print('      se e il CLIFF, deve CRESCERE nella coda. Blocchi = gare.')
    curva = []
    for f in FASCE_ETA:
        per_gara = [st.median(v) for v in per_fascia[f].values() if len(v) >= 5]
        if len(per_gara) < 3:
            print(f"      eta {f[0]:2d}-{f[1]:2d}   (solo {len(per_gara)} gare: non giudicabile)")
            curva.append({'fascia': list(f), 'n_gare': len(per_gara), 'mediana': None})
            continue
        b = scheletro.bootstrap_a_blocchi(per_gara)
        print(f"      eta {f[0]:2d}-{f[1]:2d}   mediana {b['mediana']:+7.3f} s   "
              f"IC95 {b['ci95']}   ({len(per_gara)} gare)")
        curva.append({'fascia': list(f), 'n_gare': len(per_gara),
                      'mediana': b['mediana'], 'ci95': b['ci95']})
    validi = [c for c in curva if c['mediana'] is not None]
    cresce = (len(validi) >= 3
              and validi[-1]['mediana'] > validi[0]['mediana']
              and validi[-1]['ci95'] and validi[-1]['ci95'][0] > 0)
    print(f"      => il residuo {'CRESCE nella coda: il cliff ha un bersaglio' if cresce else 'NON cresce nella coda: NESSUN CLIFF nei dati 2026'}")

    # --- (b) identificabilita': quanto e' desincronizzato il fondo di questa gara
    print('\n  (b) IDENTIFICABILITA per gara: rho si separa da beta solo se eta e giro-gara')
    print('      sono DESINCRONIZZATI. |corr| alta = rho e beta si contendono lo stesso segnale.')
    ident = []
    for gid in gare:
        t = tab[gid]
        if t['modello'] is None:
            continue
        r = [x for x in t['dati']['stima']]
        c = scheletro.corr([x['lap'] for x in r], [x['eta'] for x in r])
        m = t['modello']
        se = {k: round(v, 5) for k, v in m['se_rho'].items()}
        rap = {k: (abs(m['rho'][k]) / v if v > 1e-9 else None) for k, v in m['se_rho'].items()}
        ident.append({'gara': gid, 'corr_giro_eta': round(c, 3), 'se_rho': se,
                      'rho': {k: round(v, 5) for k, v in m['rho'].items()},
                      'rapporto_rho_su_se': {k: (round(v, 2) if v else None)
                                             for k, v in rap.items()}})
        print(f"      {gid:22s} corr(giro,eta) {c:+.2f}   rho/SE: "
              + '  '.join(f"{k[:3]}={rap[k]:.1f}" if rap[k] else f'{k[:3]}=-'
                          for k in sorted(rap)))
    deboli = [x for x in ident
              if all((v is None or v < 2.0) for v in x['rapporto_rho_su_se'].values())]
    print(f"      => gare in cui NESSUNA pendenza arriva a 2 errori standard: "
          f"{len(deboli)}/{len(ident)}")

    # --- (c) instabilita' del segno fra gare
    print('\n  (c) STABILITA DEL SEGNO fra gare (il degrado non puo essere negativo)')
    segni = {}
    for c in ('SOFT', 'MEDIUM', 'HARD'):
        v = [x['rho'][c] for x in ident if c in x['rho']]
        if not v:
            continue
        neg = sum(1 for x in v if x < 0)
        segni[c] = {'n_gare': len(v), 'n_negative': neg, 'valori': [round(x, 4) for x in v],
                    'min': round(min(v), 4), 'max': round(max(v), 4),
                    'escursione': round(max(v) - min(v), 4)}
        print(f"      {c:7s} {len(v)} gare | negative {neg} | da {min(v):+.4f} a {max(v):+.4f} "
              f"| escursione {max(v)-min(v):.4f} s/giro")

    # --- (d) i casi persi, raggruppati
    print('\n  (d) I CASI, raggruppati (mescola dello stint piu lungo / circuito)')
    X = misura_X(tab, ver, rho, tol_da_cal(tab, cal, rho)[0], 'C2', )
    per_circ, per_lung = {}, {}
    for c in X['casi']:
        k = c['circuito']
        per_circ.setdefault(k, {'n': 0, 'v': 0})
        per_circ[k]['n'] += 1
        per_circ[k]['v'] += bool(c['vince'])
        lmax = max(c['strategia']['lunghezze'])
        f = 'stint max <=20' if lmax <= 20 else ('21-30' if lmax <= 30 else '>30')
        per_lung.setdefault(f, {'n': 0, 'v': 0})
        per_lung[f]['n'] += 1
        per_lung[f]['v'] += bool(c['vince'])
    for k, v in sorted(per_circ.items()):
        print(f"      {k:22s} vinti {v['v']}/{v['n']}")
    for k, v in sorted(per_lung.items()):
        print(f"      {k:22s} vinti {v['v']}/{v['n']}")

    return {'curva_residuo_per_eta': curva, 'cliff_ha_bersaglio': cresce,
            'identificabilita': ident, 'n_gare_senza_pendenza_a_2se': len(deboli),
            'stabilita_segno': segni,
            'per_circuito': per_circ, 'per_lunghezza_stint': per_lung,
            'esclusi': X['esclusi']}


# ---------------------------------------------------------------- (3) C3 — soglia + rampa
GRIGLIA_K = list(range(8, 27, 2))
SEED_C3 = 20260721


def _cliff_viaggiante(tab, gare_cal, k):
    """Fit col ginocchio k su ogni gara di calibrazione; rho e gamma che VIAGGIANO sono le
    mediane cross-gara (stessa regola del lineare, PREREG §2)."""
    rr, gg = {}, {}
    for g in gare_cal:
        m = DV.stima_cliff(tab[g]['dati'], k)
        if 'escluso' in m:
            continue
        for c, v in m['rho'].items():
            rr.setdefault(c, []).append(v)
        for c, v in m['gamma'].items():
            gg.setdefault(c, []).append(v)
    if not rr:
        return None, None
    rho = {c: st.median(v) for c, v in rr.items()}
    gam = {c: st.median(v) for c, v in gg.items()}
    return rho, gam


def _errore_ricostruzione(tab, gare, rho, cliff=None):
    """Mediana per gara di |sim(strategia reale) - reale|. E' la grandezza A MONTE della X."""
    fuori = []
    for g in gare:
        t = tab[g]
        if t['modello'] is None:
            continue
        m = con_rho(t['modello'], rho)
        pl = _pl_gara(t['dati'], m)
        if pl is None:
            continue
        s = DV.scarti_calibrazione(t['dati'], m, pl, cliff)
        if s:
            fuori.append(st.median(s.values()))
    return fuori


def c3(tab, gare, cal, ver, rho_lin, tol_lin, X_lin):
    print('  C2 ha FALSIFICATO la predizione del cliff (residuo piatto in eta).')
    print('  C3 si esegue lo stesso ma e DECLASSATO A INFORMATIVO: serve a mostrare che cosa')
    print('  fa il termine in piu quando il fenomeno che dovrebbe catturare NON c e.\n')

    # --- scelta del ginocchio, SOLO sulle gare di calibrazione
    print(f'  (a) scelta del ginocchio k sulla griglia {GRIGLIA_K}, solo gare di CALIBRAZIONE')
    best, tabella_k = None, []
    for k in GRIGLIA_K:
        rho_k, gam_k = _cliff_viaggiante(tab, cal, k)
        if rho_k is None:
            continue
        cl = {'gamma': gam_k, 'k': {c: k for c in gam_k}}
        e = _errore_ricostruzione(tab, cal, rho_k, cl)
        if not e:
            continue
        med = st.median(e)
        tabella_k.append({'k': k, 'errore_calibrazione': round(med, 3),
                          'gamma': {c: round(v, 5) for c, v in gam_k.items()}})
        print(f"      k={k:2d}  errore ricostruzione (calibrazione) {med:8.2f} s   "
              f"gamma { {c: round(v, 4) for c, v in gam_k.items()} }")
        if best is None or med < best[0]:
            best = (med, k, rho_k, gam_k)
    if best is None:
        print('  nessun ginocchio stimabile: C3 NON GIUDICABILE')
        return {'giudicabile': False}
    _, k_star, rho_c3, gam_c3 = best
    cliff = {'gamma': gam_c3, 'k': {c: k_star for c in gam_c3}}
    print(f"      => ginocchio scelto k* = {k_star}  (mai visto le gare di verifica)")

    # --- guadagno di ricostruzione FUORI CAMPIONE
    e_lin = _errore_ricostruzione(tab, ver, rho_lin, None)
    e_c3 = _errore_ricostruzione(tab, ver, rho_c3, cliff)
    n = min(len(e_lin), len(e_c3))
    guad = [a - b for a, b in zip(e_lin[:n], e_c3[:n])]
    b_g = scheletro.bootstrap_a_blocchi(guad) if n > 1 else None
    print(f"\n  (b) guadagno di RICOSTRUZIONE fuori campione (lineare - cliff), {n} gare:")
    print(f"      mediana {b_g['mediana']:+.3f} s   IC95 {b_g['ci95']}" if b_g else '      non giudicabile')

    # --- PLACEBO: il ginocchio FINTO (NULL NUOVO, NON AUTO-SIGILLATO)
    print(f"\n  (c) PLACEBO — ginocchio FINTO, estratto a caso nello stesso intervallo,")
    print(f"      stessa procedura e stessi gradi di liberta. NULL NUOVO: non auto-sigillato.")
    import random
    rng = random.Random(SEED_C3)
    finti = []
    for _ in range(40):
        kf = rng.choice(GRIGLIA_K)
        rho_f, gam_f = _cliff_viaggiante(tab, cal, kf)
        if rho_f is None:
            continue
        cf = {'gamma': gam_f, 'k': {c: kf for c in gam_f}}
        e_f = _errore_ricostruzione(tab, ver, rho_f, cf)
        m2 = min(len(e_lin), len(e_f))
        if m2 > 1:
            finti.append(st.median([a - b for a, b in zip(e_lin[:m2], e_f[:m2])]))
    vero = b_g['mediana'] if b_g else None
    if finti and vero is not None:
        finti.sort()
        quota = sum(1 for f in finti if f >= vero) / len(finti)
        print(f"      guadagno VERO   {vero:+.3f} s")
        print(f"      guadagno FINTO  mediana {st.median(finti):+.3f} s  "
              f"[{finti[0]:+.3f} .. {finti[-1]:+.3f}]  su {len(finti)} estrazioni")
        print(f"      ginocchi finti che fanno ALMENO quanto il vero: "
              f"{100*quota:.0f} %")
        placebo_uccide = quota >= 0.10
        print(f"      => {'PLACEBO UCCIDE: il guadagno e flessibilita, non cliff' if placebo_uccide else 'il ginocchio vero si stacca dai finti'}")
    else:
        quota, placebo_uccide = None, True

    # --- la X, e il margine dichiarato PRIMA
    tol_c3, _ = tol_da_cal(tab, cal, rho_c3, cliff=cliff)
    X_c3 = misura_X(tab, ver, rho_c3, tol_c3, 'C3 soglia+rampa — fuori campione', cliff=cliff)
    print()
    stampa_X(X_c3)
    comuni = sorted(set(X_lin['per_gara']) & set(X_c3['per_gara']))
    app = [X_c3['per_gara'][g]['quota'] - X_lin['per_gara'][g]['quota'] for g in comuni]
    b_x = scheletro.bootstrap_a_blocchi(app) if len(app) > 1 else None
    print(f"\n  (d) MARGINE DICHIARATO PRIMA: X_nuova - X_vecchia appaiata per gara,")
    print(f"      IC95 che deve ESCLUDERE LO ZERO VERSO L ALTO.")
    print(f"      X_vecchia (C1) = {100*(X_lin['quota'] or 0):.1f} %   "
          f"X_nuova (C3) = {100*(X_c3['quota'] or 0):.1f} %")
    if b_x:
        print(f"      differenza appaiata: mediana {b_x['mediana']:+.4f}  IC95 {b_x['ci95']}  "
              f"su {len(app)} gare")
    supera = bool(b_x and b_x['ci95'] and b_x['ci95'][0] > 0 and not placebo_uccide)
    print(f"\n  => C3 {'SUPERA' if supera else 'NON SUPERA'} margine e placebo -> "
          f"{'candidato' if supera else 'DICHIARATO E SCARTATO'}")
    return {'informativo': True, 'motivo_declassamento': 'C2 ha falsificato il cliff',
            'griglia_k': tabella_k, 'k_scelto': k_star,
            'rho': {c: round(v, 5) for c, v in rho_c3.items()},
            'gamma': {c: round(v, 5) for c, v in gam_c3.items()},
            'guadagno_ricostruzione_oos': {'mediana': b_g['mediana'] if b_g else None,
                                           'ci95': b_g['ci95'] if b_g else None,
                                           'n_gare': n},
            'placebo': {'n_estrazioni': len(finti),
                        'guadagno_vero': vero,
                        'guadagno_finto_mediano': round(st.median(finti), 4) if finti else None,
                        'quota_finti_almeno_quanto_il_vero': quota,
                        'UCCIDE': placebo_uccide,
                        'SIGILLO': 'NULL NUOVO, NON auto-sigillato: lo sigilla Tommi al '
                                   'merge con --attore, se il tavolo lo vuole permanente'},
            'X_c3': {k: v for k, v in X_c3.items() if k != 'casi'},
            'differenza_appaiata': {'mediana': b_x['mediana'] if b_x else None,
                                    'ci95': b_x['ci95'] if b_x else None},
            'SUPERA': supera,
            'esito': 'candidato' if supera else 'DICHIARATO E SCARTATO'}


