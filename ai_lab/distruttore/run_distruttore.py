#!/usr/bin/env python3
"""run_distruttore.py — collaudo del Distruttore sui due patogeni piantati.

    python3 ai_lab/distruttore/run_distruttore.py            # test di accettazione completo
    python3 ai_lab/distruttore/run_distruttore.py --sigillo   # solo verifica prereg

Exit 0 SOLO SE: noto-falso = KILLED  E  noto-vero = SURVIVES.
Sensibilita' e specificita' sono entrambe obbligatorie.
"""
import argparse
import json
import os
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)

import distruttore as D
import patogeni


def _riga(t):
    print('=' * 78); print(t); print('=' * 78)


def _stampa_verdetto(v):
    print(f"\n  VERDETTO: {v['verdetto']}   [{v['rivendicazione']}, modulo {v['modulo']}, "
          f"evidenza dal regime {v['regime_evidenza']}]")
    for k, ve in v['veti'].items():
        segno = 'PASS' if ve['passa'] else 'FALLITO'
        print(f"    {segno:8s} {k}")
        for campo in ('media_miglioramento', 'p', 'p_min_raggiungibile', 'ci95_bootstrap',
                      'n_blocchi', 'piu_estremo_possibile', 'max_diff_dove_traffico_non_morde', 'n_casi_invarianti', 'golden_kernel',
                      'golden_pit', 'peggiorati', 'media', 'regime', 'regola', 'motivo'):
            if campo in ve and ve[campo] not in (None, [], {}):
                print(f"             {campo}: {ve[campo]}")
        if k == 'c_nessun_peggioramento' and ve.get('per_caso'):
            for c, val in ve['per_caso'].items():
                print(f"             {c:34s} {val:+.5f}  {'PEGGIORA' if val < 0 else ''}")
    print(f"    dettaglio: {json.dumps(v['dettaglio'], ensure_ascii=False)}")
    if v['verdetto'] == 'KILLED':
        print(f"    -> ucciso dai veti: {', '.join(v['veti_falliti'])}")
    else:
        print(f"    -> margine misurato: {json.dumps(v['margine'], ensure_ascii=False)}")


def main():
    p = argparse.ArgumentParser(description='Collaudo del Distruttore.')
    p.add_argument('--sigillo', action='store_true', help='verifica solo il sigillo del prereg')
    a = p.parse_args()

    _riga('PREREG — sigillo anti-HARKing')
    s = D.verifica_sigillo()
    print(f"  {'INTEGRO' if s['integro'] else 'ALTERATO'}  {s['depositato']}"
          + ('' if s['integro'] else f"  != ricalcolato {s['ricalcolato']}"))
    if not s['integro']:
        print('\n  Un criterio e\' stato ammorbidito dopo la creazione. exit 1.')
        return 1
    if a.sigillo:
        return 0

    _riga('VERIFICHE PRELIMINARI — kernel e golden')
    k = D.stato_kernel()
    gk, gp = D.golden_kernel(), D.golden_pit()
    print(f"  engine.py content-hash : {k['content_hash']} (atteso {k['atteso_hash']}) "
          f"{'OK' if k['hash_ok'] else 'MISMATCH'}")
    print(f"  engine.py ultimo commit: {k['ultimo_commit']} (atteso {k['atteso_commit']}) "
          f"{'OK' if k['commit_ok'] else 'MISMATCH'}")
    print(f"  albero pulito su engine: {'OK' if k['pulito'] else 'SPORCO'}")
    print(f"  golden kernel          : {gk['esito']} {'OK' if gk['passa'] else 'FALLITO'}")
    print(f"  golden pit             : {gp['esito']} {'OK' if gp['passa'] else 'FALLITO'}")
    if not (k['hash_ok'] and k['commit_ok'] and k['pulito'] and gk['passa'] and gp['passa']):
        print('\n  Verifica preliminare fallita. exit 1.')
        return 1

    _riga('PATOGENO 1/2 — NOTO-FALSO (atteso: KILLED)')
    print('  calibrazione sull\'explore-set ' + str(patogeni.EXPLORE)
          + ' (nessun circuito del panel):')
    falso = patogeni.costruisci_noto_falso(verbose=True)
    print(f"  overlay scelto dall'overfit: STRENGTH {falso['baseline']['STRENGTH']:.2f} -> "
          f"{falso['overlay']['STRENGTH']:.2f}  (ZONE invariata {falso['overlay']['ZONE']})")
    print(f"  KPI rivendicato sull'explore: "
          f"{falso['kpi_rivendicato']['miglioramento_su_explore_s']:+.5f} s")
    v_falso = D.giudica(falso)
    _stampa_verdetto(v_falso)

    _riga('PATOGENO 2/2 — NOTO-VERO (atteso: SURVIVES)')
    vero = patogeni.costruisci_noto_vero()
    print(f"  pit-loss {vero['baseline']['pitLoss']} -> {vero['overlay']['pitLoss']} "
          f"su {vero['circuito']} (fuori dal panel: resta out-of-sample)")
    v_vero = D.giudica(vero)
    _stampa_verdetto(v_vero)

    _riga('ESITO DEL COLLAUDO')
    sens = v_falso['verdetto'] == 'KILLED'
    spec = v_vero['verdetto'] == 'SURVIVES'
    print(f"  sensibilita' (uccide il falso) : {'OK' if sens else 'FALLITA'} "
          f"-> noto-falso = {v_falso['verdetto']}")
    print(f"  specificita' (lascia il vero)  : {'OK' if spec else 'FALLITA'} "
          f"-> noto-vero  = {v_vero['verdetto']}")
    if not sens:
        print('\n  Il Distruttore e\' TROPPO DEBOLE: non uccide un falso noto. exit 1.')
    if not spec:
        print('\n  Il Distruttore e\' TROPPO AGGRESSIVO: uccide un vero noto. exit 1.')
    if sens and spec:
        print('\n  COLLAUDO SUPERATO: sensibile e specifico.')

    with open(os.path.join(QUI, 'esito_collaudo.json'), 'w') as f:
        json.dump({'noto_falso': v_falso, 'noto_vero': v_vero,
                   'sensibilita': sens, 'specificita': spec,
                   'kernel': k, 'golden_kernel': gk, 'golden_pit': gp,
                   'sigillo_prereg': s['depositato']}, f, ensure_ascii=False, indent=2)
        f.write('\n')
    return 0 if (sens and spec) else 1


if __name__ == '__main__':
    raise SystemExit(main())
