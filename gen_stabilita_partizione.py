#!/usr/bin/env python3
"""gen_stabilita_partizione.py — la partizione nuova e' PIU STABILE della vecchia?

    python3 gen_stabilita_partizione.py

Prereg: ai_lab/scienziato/PREREG_partizione_temporale.md, committato PRIMA di guardare quale
modello si accende sotto la regola nuova.

MISURA LA STABILITA, NON L'ACCENSIONE (§3 del prereg). Le due condizioni, dichiarate prima:

  S1 (categorica)   nel leave-one-race-out, il numero di gare che tolte DA SOLE ribaltano
                    ACCENDIBILE dev'essere ZERO. Conta i ribaltamenti in ENTRAMBE le
                    direzioni: e' indifferente a quale verdetto esca.
  S2 (quantitativa) la massima escursione della statistica appaiata nel leave-one-race-out
                    dev'essere <= 50 % dell'ampiezza dell'IC95 a campione pieno. La soglia e'
                    ancorata a una grandezza che il modello produce da se'.

Servono ENTRAMBE. Se falliscono, la partizione temporale NON si adotta.
Esce sempre 0: nessun exit-code decide.
"""
import json
import os
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.join(QUI, 'ai_lab', 'scienziato')
sys.path.insert(0, LAB)

import partizione as PZ
import sigillo_null

USCITA = os.path.join(QUI, 'data', 'stabilita_partizione.json')
FRAZIONE_IC = 0.50          # S2: meta' dell'ampiezza dell'IC95 (dichiarata nel prereg)


def _cancello(mod, pg, dt, versione):
    """Il verdetto del cancello sotto una data versione di partizione."""
    prec = PZ.VERSIONE_ATTIVA
    PZ.VERSIONE_ATTIVA = versione
    try:
        v = mod.verifica(pg, dt, None)
    finally:
        PZ.VERSIONE_ATTIVA = prec
    return v['cancello_accensione']


def _dentro(d, chiave):
    """chiave con i punti: 'A_predittivo.guadagno_mediano_s'. I due modelli annidano
    diversamente il proprio verdetto, il generatore e' uno solo."""
    for k in chiave.split('.'):
        if not isinstance(d, dict):
            return None
        d = d.get(k)
    return d


def stabilita(mod, pg, dt, versione, chiave_stat, chiave_ci):
    """Campione pieno + leave-one-race-out. Ritorna le due condizioni del prereg."""
    pieno = _cancello(mod, pg, dt, versione)
    stat0 = _dentro(pieno, chiave_stat)
    ci0 = _dentro(pieno, chiave_ci)
    acc0 = pieno.get('ACCENDIBILE')
    amp = (ci0[1] - ci0[0]) if ci0 else None

    righe, ribalta = [], []
    for g in sorted(pg):
        p2 = {k: v for k, v in pg.items() if k != g}
        d2 = {k: v for k, v in dt.items() if k != g}
        c = _cancello(mod, p2, d2, versione)
        flip = (c.get('ACCENDIBILE') != acc0)
        if flip:
            ribalta.append(g)
        righe.append({'gara_tolta': g, 'appaiato': _dentro(c, chiave_stat),
                      'ci95': _dentro(c, chiave_ci), 'ACCENDIBILE': c.get('ACCENDIBILE'),
                      'ribalta': flip})
    scarti = [abs(r['appaiato'] - stat0) for r in righe
              if r['appaiato'] is not None and stat0 is not None]
    escursione = max(scarti) if scarti else None
    soglia = FRAZIONE_IC * amp if amp else None
    return {
        'versione': versione,
        'campione_pieno': {'appaiato': stat0, 'ci95': ci0, 'ampiezza_ci95': round(amp, 4)
                           if amp else None, 'ACCENDIBILE': acc0,
                           'partizione': pieno.get('partizione')},
        'leave_one_out': righe,
        'S1_n_ribaltamenti': len(ribalta), 'S1_gare_che_ribaltano': ribalta,
        'S1_SUPERATA': len(ribalta) == 0,
        'S2_escursione_max': round(escursione, 4) if escursione is not None else None,
        'S2_soglia': round(soglia, 4) if soglia else None,
        'S2_SUPERATA': bool(escursione is not None and soglia and escursione <= soglia),
    }


def stampa(s, etichetta):
    p = s['campione_pieno']
    print(f"\n  --- {etichetta} [{s['versione']}] ---")
    tg = p.get('partizione') or {}
    print(f"      partizione: {tg.get('n_calibrazione')} cal / {tg.get('n_verifica')} ver"
          + (f"   T* = {tg.get('T_stella')}" if tg.get('T_stella') else '')
          + f"   ({tg.get('ordinamento')})")
    print(f"      campione pieno: appaiato {p['appaiato']}  IC95 {p['ci95']}  "
          f"ampiezza {p['ampiezza_ci95']}")
    for r in s['leave_one_out']:
        print(f"        senza {r['gara_tolta']:22s} appaiato "
              f"{(r['appaiato'] if r['appaiato'] is not None else float('nan')):+.4f}"
              f"   {'RIBALTA' if r['ribalta'] else ''}")
    print(f"      S1 ribaltamenti: {s['S1_n_ribaltamenti']}  {s['S1_gare_che_ribaltano']}"
          f"  -> {'SUPERATA' if s['S1_SUPERATA'] else 'FALLITA'}")
    print(f"      S2 escursione max {s['S2_escursione_max']} contro soglia {s['S2_soglia']}"
          f"  -> {'SUPERATA' if s['S2_SUPERATA'] else 'FALLITA'}")


def main():
    if not sigillo_null.pretendi_integro('gen_stabilita_partizione.py'):
        return 0
    from modello_traffico import ModelloTraffico

    print('=' * 96)
    print('STABILITA DELLA PARTIZIONE — si giudica la STABILITA, non l accensione (prereg §3)')
    print('=' * 96)

    mod = ModelloTraffico('2026')
    pg, dt = mod.raccogli()
    fuori = {'traffico_2026': {}}
    for v in ('v1_pari_dispari', 'v2_temporale'):
        s = stabilita(mod, pg, dt, v, 'appaiato_vs_zero', 'ci95_appaiato')
        fuori['traffico_2026'][v] = s
        stampa(s, 'traffico 2026')

    try:
        from modello_degrado import ModelloDegrado
    except ImportError:
        ModelloDegrado = None
    if ModelloDegrado is not None:
        md = ModelloDegrado('2026')
        pgd, dtd = md.raccogli()
        fuori['degrado_2026'] = {}
        for v in ('v1_pari_dispari', 'v2_temporale'):
            s2 = stabilita(md, pgd, dtd, v, 'A_predittivo.guadagno_mediano_s',
                           'A_predittivo.ci95')
            fuori['degrado_2026'][v] = s2
            stampa(s2, 'degrado 2026')
    else:
        print('\n  (modello_degrado non presente in questo branch: misurato altrove)')

    print('\n' + '=' * 96)
    tutto_ok = True
    for nome, per_ver in fuori.items():
        a, b = per_ver['v1_pari_dispari'], per_ver['v2_temporale']
        # GUARDIA: se il cancello del modello non e' agganciato a partizione.py, le due
        # versioni danno lo stesso taglio e il confronto sarebbe FASULLO. Meglio dirlo che
        # stampare due righe identiche come se fossero un risultato.
        ta = (a['campione_pieno'].get('partizione') or {}).get('versione')
        tb = (b['campione_pieno'].get('partizione') or {}).get('versione')
        if ta == tb:
            print(f"  {nome}: NON AGGANCIATO a partizione.py (entrambe le versioni danno "
                  f"lo stesso taglio) -> confronto NON VALIDO, non lo riporto")
            continue
        print(f"  {nome}")
        print(f"     VECCHIA v1: ribaltamenti {a['S1_n_ribaltamenti']}/{len(a['leave_one_out'])}"
              f" | escursione {a['S2_escursione_max']} (soglia {a['S2_soglia']})"
              f" -> S1 {'ok' if a['S1_SUPERATA'] else 'FALLITA'}, S2 {'ok' if a['S2_SUPERATA'] else 'FALLITA'}")
        print(f"     NUOVA   v2: ribaltamenti {b['S1_n_ribaltamenti']}/{len(b['leave_one_out'])}"
              f" | escursione {b['S2_escursione_max']} (soglia {b['S2_soglia']})"
              f" -> S1 {'ok' if b['S1_SUPERATA'] else 'FALLITA'}, S2 {'ok' if b['S2_SUPERATA'] else 'FALLITA'}")
        tutto_ok = tutto_ok and b['S1_SUPERATA'] and b['S2_SUPERATA']
    print(f"  => la partizione temporale e {'STABILE secondo il prereg' if tutto_ok else 'NON stabile: NON si adotta'}")

    with open(USCITA, 'w') as f:
        json.dump(fuori, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'[scritto] {os.path.relpath(USCITA, QUI)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
