#!/usr/bin/env python3
"""test_riparazione_cancello.py — collaudo della riparazione del cancello di partizione.

TRE ESITI OBBLIGATORI (dichiarati nel prereg PRIMA di calcolare la nuova soglia):
  CONTROLLO-B truccato per magnitudine -> ora RIFIUTATO (col cancello v1 passava)
  CONTROLLO-A truccato per segno       -> ancora RIFIUTATO
  partizione ONESTA bilanciata         -> ancora ACCETTATA

Se anche uno solo non si verifica, la riparazione non e' pronta: exit 1.
"""
import os
import statistics as st
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)

import calibrazione as C
import distruttore as D
from auditor import tools


def morsi_2026():
    Mt = D.carica_prereg()['misura']['traffico']
    return {f"{g['gara']}-2026": st.mean(C.morso_per_gara(
        {'circuito': g['gara'], 'anno': '2026', 'percorso': g['fonte']},
        Mt['orizzonte_H'], Mt['gap_max_inclusione_s'])) for g in tools.elenco_gare()}


def casi(morsi, panel):
    """I tre casi obbligatori + la proposta reale, a titolo informativo."""
    seg = sorted(morsi.items(), key=lambda kv: kv[1])          # per SEGNO
    mod = sorted(morsi.items(), key=lambda kv: abs(kv[1]))     # per MAGNITUDINE
    ord_ = [k for k, _ in seg]
    fuori_panel = sorted(k for k in morsi if k.rsplit('-', 1)[0] not in panel)
    dentro_panel = [f'{c}-2026' for c in panel if f'{c}-2026' in morsi]
    return [
        ('CONTROLLO-B truccato per magnitudine', [i for i, _ in mod[-4:]],
         [i for i, _ in mod[:3]], False),
        ('CONTROLLO-A truccato per segno', [i for i, _ in seg[-4:]],
         [i for i, _ in seg[:3]], False),
        ('ONESTA bilanciata (stratificata)', ord_[0::2], ord_[1::2], True),
        ('RIV-traffico-001 (proposta reale, informativo)', fuori_panel, dentro_panel, None),
    ]


def main():
    P = D.carica_prereg()
    scelto = P['difetto_cancello_partizione_v1']['riparazione']['statistico_scelto']
    morsi = morsi_2026()
    print(f'Cancello v2 — congiuntivo: delta_media (v1) + {scelto} (riparazione)\n')
    obbligatori, tutti_ok = [], True
    for nome, ex, co, atteso_passa in casi(morsi, P['panel_ostile']['circuiti']):
        v = D.valida_partizione_v2({'partizione': {'explore': ex, 'confirm': co}}, morsi, scelto)
        esito = 'ACCETTATA' if v['passa'] else 'RIFIUTATA'
        if atteso_passa is None:
            print(f'  {nome:46s} -> {esito}')
        else:
            ok = (v['passa'] == atteso_passa)
            tutti_ok &= ok
            obbligatori.append((nome, esito, ok))
            print(f"  {nome:46s} -> {esito:10s} atteso "
                  f"{'ACCETTATA' if atteso_passa else 'RIFIUTATA':10s} {'OK' if ok else 'FALLITO'}")
        for k, c in v['criteri'].items():
            print(f"      {k:22s} oss {c['osservato']:8.5f}  q95 {c['soglia_q95']:8.5f}  "
                  f"rapporto {c['margine_relativo']:6.3f}  {'SFONDA' if c['supera'] else 'ok'}")
    print(f"\n  TRE ESITI OBBLIGATORI: {'TUTTI OK' if tutti_ok else 'FALLITO'}")
    if not tutti_ok:
        print('  La riparazione NON e\' pronta.')
    return 0 if tutti_ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
