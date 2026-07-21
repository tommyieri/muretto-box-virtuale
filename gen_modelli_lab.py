#!/usr/bin/env python3
"""gen_modelli_lab.py — ricalibra i MODELLI DEL LABORATORIO dopo ogni gara nuova.

    python3 gen_modelli_lab.py                 # ricalibra tutti i modelli registrati
    python3 gen_modelli_lab.py --data 2026-08-02
    python3 gen_modelli_lab.py --verifica      # ricalibra e stampa anche le verifiche
    python3 gen_modelli_lab.py --senza-gara "2026 Miami"   # prova: togli una gara

E' un generatore come gli altri del sito (gen_classifiche_ufficiali.py, gen_rc_feed.py...):
si aggiunge alla sequenza post-gara di auto_gara.py e si riesegue da solo quando il fondo
riceve un Gran Premio nuovo.

COSA FA E COSA NON FA
  fa     : ricalcola i coefficienti dal FONDO dentro il regime del modello, aggiorna la
           targhetta (N gare, data) e registra di quanto si sono mossi rispetto a prima.
  NON fa : accendere niente in produzione. Scrive il file dei coefficienti; se il motore
           lo legge e' un interruttore umano. Rispetta il confine di pipeline_gara.py
           ("non ricalcola mai coefficienti motore"): qui i coefficienti sono del
           LABORATORIO, e restano tali finche' un umano non li aggancia.

IDEMPOTENTE: rieseguirlo senza dati nuovi non tocca il file e non allunga lo storico.
Esce sempre 0: nessun exit-code decide.

AGGIUNGERE IL PROSSIMO MODELLO (degrado, carburante, ...): una riga in REGISTRO. Il
contratto e' in ai_lab/scienziato/autocalibra.py.
"""
import argparse
import os
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.join(QUI, 'ai_lab', 'scienziato')
sys.path.insert(0, LAB)

import autocalibra
import sigillo_null
from modello_degrado import ModelloDegrado
from modello_traffico import ModelloTraffico

# ---------------------------------------------------------------- IL REGISTRO
# Un modello = una riga. Deve rispettare il contratto di autocalibra.py.
# Il regime fa parte dell'identita': i regimi non si mescolano mai.
REGISTRO = [
    ModelloTraffico('2026', uscita='data/modello_traffico_2026.json'),
    ModelloDegrado('2026', uscita='data/modello_degrado_2026.json'),
]


def main():
    p = argparse.ArgumentParser(description='Ricalibra i modelli del laboratorio.')
    p.add_argument('--data', default=None,
                   help='AAAA-MM-GG della ricalibrazione (nessun orologio implicito)')
    p.add_argument('--verifica', action='store_true')
    p.add_argument('--senza-gara', default=None,
                   help='esclude una gara: serve a provare che l aggiornamento funziona')
    a = p.parse_args()

    if not sigillo_null.pretendi_integro('gen_modelli_lab.py'):
        return 0
    if not a.data:
        print('Serve --data AAAA-MM-GG: la targhetta non se la inventa il generatore.')
        return 0

    print(f'ricalibrazione modelli del laboratorio — data {a.data}'
          + (f'  [PROVA: senza {a.senza_gara}]' if a.senza_gara else ''))
    rapporti = []
    for mod in REGISTRO:
        per_gara, dati = mod.raccogli()
        if a.senza_gara:
            per_gara = {k: v for k, v in per_gara.items() if k != a.senza_gara}
            dati = {k: v for k, v in dati.items() if k != a.senza_gara}
            mod_calibra = mod.calibra
            mod.calibra = lambda pg=per_gara, dt=dati, m=mod: m.__class__.calibra(m, pg, dt)
        r = autocalibra.aggiorna(mod, a.data)
        rapporti.append(r)
        if a.verifica:
            coef = mod.calibra(per_gara, dati) if not a.senza_gara else None
            v = mod.verifica(per_gara, dati, coef)
            # il cancello di accensione e' l'unica cosa che OGNI modello deve saper dire:
            # sta dentro il modello, e qui si stampa e basta (nessuna decisione).
            ca = v.get('cancello_accensione')
            if ca:
                print(f"    cancello di accensione: ACCENDIBILE = {ca.get('ACCENDIBILE')}")
                for nome in ('A_predittivo', 'B_prodotto'):
                    if ca.get(nome):
                        print(f"      {nome:14s} {ca[nome]}")
            if 'oos' not in v:
                continue
            print(f"    fuori campione: modello {v['oos']['errore_modello']} "
                  f"IC95 {v['oos']['ci95']}  contro traffico-zero "
                  f"{v['oos']['errore_traffico_zero']} -> guadagno {v['oos']['guadagno']:+.4f} s")
            if v['mclaren']:
                mc = v['mclaren']
                print(f"    test McLaren: previsto delta-grande {mc['previsto_delta_grande']} "
                      f"vs pari-passo {mc['previsto_pari_passo']} -> "
                      f"{'ORDINA GIUSTO' if mc['ordina_giusto'] else 'ORDINE SBAGLIATO'}"
                      f"   (reale {mc['costo_reale_delta_grande']} vs "
                      f"{mc['costo_reale_pari_passo']})")
            if v['placebo']:
                print(f"    placebo (leader a caso): separazione finta "
                      f"{v['placebo']['separazione_finta']:+.3f} s")
    print('\n' + ('nessun modello cambiato' if not any(r['cambiato'] for r in rapporti)
                  else 'modelli aggiornati: '
                       + ', '.join(r['modello'] for r in rapporti if r['cambiato'])))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
