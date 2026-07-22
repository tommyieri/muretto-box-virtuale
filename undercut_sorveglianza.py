#!/usr/bin/env python3
"""undercut_sorveglianza.py — il cancello dell'undercut v2 che si sorveglia da solo.

    python3 undercut_sorveglianza.py          # riporta SOLO i cambiamenti
    python3 undercut_sorveglianza.py --stato  # stampa lo stato, non lo cambia

COSA FA
  Conta, a ogni gara nuova, quanti casi DIFFICILI fuori campione si sono accumulati
  (data/undercut_casi_gara_*.json), misura la copertura di alpha su quelli, e riporta
  SOLO quando qualcosa cambia: una gara nuova entra, oppure il cancello 6.0 del prereg
  passa da CHIUSO ad APERTO.

COSA NON FA — ed e' il punto
  NON esegue nessun backtest, NON costruisce nessun margine, NON legge mai il campo
  'riuscito'. Automatizzare un prereg sigillato NON vuol dire rigirare il test a ogni
  gara finche' passa: quello sarebbe multiple testing, cioe' la stessa malattia che il
  NO-GO della v1 aveva smascherato. Qui si ACCUMULA e si CONTA; il backtest e' un atto
  umano, e si esegue UNA volta, quando il cancello e' aperto (prereg §9.4-§9.7).

INVARIANTI (pattern di ai_lab/scienziato/sorveglianza.py)
  - PREREG_UNDERCUT_V2.md e' SOLA LETTURA: soglie e modello non si ricalcolano mai sui
    dati nuovi. Se la soglia potesse cambiare, non sarebbe pre-registrata.
  - Idempotente: due esecuzioni senza gare nuove non producono nessun verdetto.
  - Esce SEMPRE 0. Nessun exit-code decide: il verdetto va al tavolo umano.
"""
import argparse
import glob
import json
import os
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)

import copertura_alpha_undercut as CA          # noqa: E402

STATO = os.path.join(QUI, 'data', 'undercut_sorveglianza.json')

# --- soglie LETTE dal prereg, non decise qui (§6.0). Cambiarle e' un atto umano ---
D_NEW_MIN = 15          # casi difficili nuovi
COPERTURA_MIN = 0.80    # alpha per ENTRAMBI i piloti della coppia
GAP_DIFFICILE = (1.0, 3.5)


def casi_fuori_campione():
    """I casi delle gare 10+, dai file per-gara. 'riuscito' cancellato all'ingresso."""
    fuori = []
    for p in sorted(glob.glob(os.path.join(QUI, 'data', 'undercut_casi_gara_*.json'))):
        gara = os.path.basename(p)[len('undercut_casi_gara_'):-len('.json')]
        casi = json.load(open(p))
        for c in casi:
            c.pop('riuscito', None)
            c.pop('gap_fin', None)
        fuori.append({'gara': gara, 'casi': casi,
                      'difficili': [c for c in casi
                                    if GAP_DIFFICILE[0] < c['gap0'] <= GAP_DIFFICILE[1]]})
    return fuori


def misura():
    """Stato corrente del cancello. Solo conteggi e presenza di alpha: nessun esito."""
    gare = CA.alpha_per_gara()
    per_data = {g['gara']: g['data'] for g in gare}
    blocchi = casi_fuori_campione()
    difficili, coperti, dettaglio = 0, 0, []
    for b in blocchi:
        # una gara non ancora nel fondo del laboratorio e' comunque piu' recente di tutte
        # quelle che ci sono: il prior temporale e' l'intero fondo disponibile.
        d = per_data.get(b['gara'], '9999-99-99')
        pri = CA.prior_fino_a(gare, d)
        cop = sum(1 for c in b['difficili'] if c['A'] in pri and c['B'] in pri)
        difficili += len(b['difficili'])
        coperti += cop
        dettaglio.append({'gara': b['gara'], 'casi': len(b['casi']),
                          'difficili': len(b['difficili']), 'difficili_coperti': cop,
                          'nel_fondo': b['gara'] in per_data})
    q = (coperti / difficili) if difficili else 0.0
    return {'gare_fuori_campione': [b['gara'] for b in blocchi],
            'D_new': difficili, 'difficili_coperti': coperti, 'copertura': q,
            'cancello_aperto': difficili >= D_NEW_MIN and q >= COPERTURA_MIN,
            'soglie': {'D_new_min': D_NEW_MIN, 'copertura_min': COPERTURA_MIN},
            'dettaglio': dettaglio}


def stampa(m):
    print(f"  gare fuori campione: {', '.join(m['gare_fuori_campione']) or '(nessuna)'}")
    for d in m['dettaglio']:
        nota = '' if d['nel_fondo'] else '  (non ancora nel fondo: prior = tutto il fondo)'
        print(f"    {d['gara']:16s} casi {d['casi']:3d} | difficili {d['difficili']:3d} "
              f"| con alpha {d['difficili_coperti']:3d}{nota}")
    print(f"  |D_new| = {m['D_new']}/{D_NEW_MIN}   copertura alpha = "
          f"{100*m['copertura']:.0f}%/{100*COPERTURA_MIN:.0f}%")
    print(f"  cancello 6.0: {'APERTO' if m['cancello_aperto'] else 'CHIUSO'}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stato', action='store_true', help='stampa lo stato, non lo cambia')
    a = ap.parse_args()

    m = misura()
    try:
        vecchio = json.load(open(STATO))
    except OSError:
        vecchio = None

    if a.stato:
        print('=== sorveglianza undercut v2 — stato (nessuna scrittura) ===')
        stampa(m)
        return 0

    cambiato = (vecchio is None
                or vecchio.get('gare_fuori_campione') != m['gare_fuori_campione']
                or vecchio.get('D_new') != m['D_new'])
    apertura = m['cancello_aperto'] and not (vecchio or {}).get('cancello_aperto', False)

    if not cambiato and not apertura:
        return 0                                    # idempotente: silenzio

    print('=== sorveglianza undercut v2 ===')
    stampa(m)

    if apertura:
        print()
        print('  ' + '!' * 76)
        print('  CANCELLO 6.0 APERTO — il backtest v2 e\' diventato ESEGUIBILE.')
        print('  Non lo eseguo io: e\' un atto umano e si fa UNA volta sola.')
        print('  Procedura: PREREG_UNDERCUT_V2.md §9.4-§9.7 (alpha_prior causale, termine')
        print('  K*Delta-passo, placebo sotto sigillo, verdetto GO/NO-GO/NULL).')
        print('  Prima di eseguire: ratificare o respingere §11 (GO-5, controllo a')
        print('  spostamento costante) — serve --attore.')
        print('  ' + '!' * 76)
    elif m['D_new'] < D_NEW_MIN:
        mancano = D_NEW_MIN - m['D_new']
        print(f"\n  ancora NON giudicabile: mancano {mancano} casi difficili "
              f"(~{max(1, round(mancano / 2.62))} gare pulite al ritmo 2026 di 2,62/gara).")
        print("  Nessun backtest, nessuna anteprima: si accumula e si tace.")

    json.dump(m, open(STATO, 'w'), indent=1, ensure_ascii=False)
    return 0


if __name__ == '__main__':
    sys.exit(main())
