#!/usr/bin/env python3
"""run_degrado_2026.py — il DEGRADO 2026, dal censimento al cancello di accensione.

    python3 ai_lab/scienziato/run_degrado_2026.py --censimento   # disponibilita' dei dati
    python3 ai_lab/scienziato/run_degrado_2026.py --falsifica    # la regola nuova regge?
    python3 ai_lab/scienziato/run_degrado_2026.py --c1 --c2 --c3
    python3 ai_lab/scienziato/run_degrado_2026.py --tutto

Prereg: PREREG_degrado_2026.md — tutto dichiarato PRIMA dei numeri.
Esce sempre 0: nessun exit-code decide. L'agente porta la X, decidono gli umani.
"""
import argparse
import json
import os
import statistics as st
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)

import degrado as DG
import degrado_verde as DV
import fondo
import scheletro
import sigillo_null

USCITA = os.path.join(QUI, 'esito_degrado_2026.json')

# --- soglie del prereg, tutte dichiarate prima dei numeri
MIN_CASI, MIN_GARE = 30, 4          # §4 numerosita' (adattata al regime: 10 gare -> 5+5)
QUOTA_NETTA = 0.60                  # §4B, identica al prereg madre
FATTORE_MARGINE = 2.0               # §4B, identica al prereg madre
G_STELLA = 1.5                      # §3, ereditata dichiarata da esito_degrado.json


def riga(t):
    print('=' * 96)
    print(t)
    print('=' * 96)


# ---------------------------------------------------------------- il fondo, una volta sola
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


# ---------------------------------------------------------------- (0) CENSIMENTO
def censimento(regime='2026'):
    """Disponibilita' dei dati — eseguito PRIMA del prereg, perche' riguarda i dati e non il
    fenomeno. E' il generatore dei numeri citati in PREREG_degrado_2026.md §0."""
    fuori = []
    for b in fondo.elenco_blocchi():
        if b['regime'] != regime:
            continue
        righe = fondo.carica(b['percorso'])
        n_tot = sum(1 for r in righe if isinstance(r['lap'], (int, float)))
        N = max(int(r['lap']) for r in righe if isinstance(r['lap'], (int, float)))
        neu = [r for r in righe
               if ('4' in str(r['status'])) or ('6' in str(r['status']))]
        giri_neu = sorted({int(r['lap']) for r in neu
                           if isinstance(r['lap'], (int, float))})
        keep, _, _ = fondo.pulisci(righe, soglia_aria=0.0)
        gap = fondo.gap_davanti(righe)
        aria = [r for r in keep
                if gap.get((r['drv'], r['lap'])) is None
                or gap.get((r['drv'], r['lap'])) > DG.GAP_STIMA]
        mesc = {}
        for r in keep:
            mesc[r['compound']] = mesc.get(r['compound'], 0) + 1
        fuori.append({'gara': b['id'], 'bagnata': fondo.bagnato(righe), 'N': N,
                      'giri_totali': n_tot, 'giri_neutralizzati': len(neu),
                      'quota_neutralizzata': round(len(neu) / max(n_tot, 1), 4),
                      'indici_giro_neutralizzati': len(giri_neu),
                      'giri_puliti': len(keep), 'giri_aria_libera': len(aria),
                      'mescole': mesc})
    return fuori


def stampa_censimento(cen):
    print(f"{'gara':26s} {'bagn':6s} {'N':>4s} {'giri':>6s} {'neutr':>6s} {'%neu':>6s} "
          f"{'puliti':>7s} {'aria':>6s}  mescole")
    print('-' * 108)
    for c in cen:
        print(f"{c['gara']:26s} {str(c['bagnata']):6s} {c['N']:4d} {c['giri_totali']:6d} "
              f"{c['giri_neutralizzati']:6d} {100*c['quota_neutralizzata']:6.1f} "
              f"{c['giri_puliti']:7d} {c['giri_aria_libera']:6d}  {c['mescole']}")
    q = [c['quota_neutralizzata'] for c in cen]
    print(f"\n  gare: {len(cen)} | bagnate: {sum(1 for c in cen if c['bagnata'])} | "
          f"con almeno un giro neutralizzato: {sum(1 for c in cen if c['giri_neutralizzati'])}")
    if q:
        print(f"  quota neutralizzata: da {100*min(q):.1f} % a {100*max(q):.1f} %")
        print(f"  => il veto di gara costa {sum(1 for c in cen if c['giri_neutralizzati'])}"
              f"/{len(cen)} gare per proteggersi da {100*min(q):.1f}-{100*max(q):.1f} % di giri")


def main():
    p = argparse.ArgumentParser(description='Il degrado 2026, vivo.')
    p.add_argument('--censimento', action='store_true')
    p.add_argument('--falsifica', action='store_true')
    p.add_argument('--c1', action='store_true')
    p.add_argument('--c2', action='store_true')
    p.add_argument('--c3', action='store_true')
    p.add_argument('--tutto', action='store_true')
    a = p.parse_args()
    if not sigillo_null.pretendi_integro('run_degrado_2026.py'):
        return 0
    esito = json.load(open(USCITA)) if os.path.exists(USCITA) else {}

    if a.censimento or a.tutto:
        riga('(0) CENSIMENTO — quanto 2026 c e davvero, e quanto e neutralizzato')
        cen = censimento('2026')
        stampa_censimento(cen)
        esito['censimento_2026'] = cen

    with open(USCITA, 'w') as f:
        json.dump(esito, f, ensure_ascii=False, indent=1)
        f.write('\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
