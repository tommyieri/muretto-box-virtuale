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

--senza-gara E' UNA PROVA, E UNA PROVA NON SCRIVE ARTEFATTI VERI.
  Serve a far vedere che l'auto-aggiornamento funziona (togli una gara, i coefficienti si
  muovono, la targhetta cala). Prima lo faceva SUL FILE DI PRODUZIONE: abbassava la
  targhetta a N-1 gare, lasciava nello storico una voce di ricalibrazione MAI AVVENUTA, e
  in un caso misurato ha ribaltato ACCENDIBILE da false a true su un file che gli umani
  leggono per decidere se un modello se l'e' guadagnata.
  Adesso la prova lavora su una COPIA in una cartella temporanea, che viene buttata alla
  fine: `data/` non viene mai aperta in scrittura. Lo script lo VERIFICA da solo a ogni
  esecuzione (impronta sha256 dei file veri prima e dopo) e lo stampa.

AGGIUNGERE IL PROSSIMO MODELLO (degrado, carburante, ...): una riga in REGISTRO. Il
contratto e' in ai_lab/scienziato/autocalibra.py.
"""
import argparse
import hashlib
import os
import shutil
import sys
import tempfile

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


def _impronta(percorsi):
    """sha256 dei file veri: serve a DIMOSTRARE, non a promettere, che una prova non
    ha scritto in data/."""
    fuori = {}
    for p in percorsi:
        if os.path.exists(p):
            fuori[p] = hashlib.sha256(open(p, 'rb').read()).hexdigest()
        else:
            fuori[p] = None          # assente prima e assente dopo e' comunque "non scritto"
    return fuori


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

    prova = bool(a.senza_gara)
    print(f'ricalibrazione modelli del laboratorio — data {a.data}'
          + (f'  [PROVA: senza {a.senza_gara}]' if prova else ''))

    # I file VERI: sotto prova non devono essere toccati, e lo si dimostra col sha256.
    veri = [os.path.join(QUI, m.uscita) for m in REGISTRO]
    prima = _impronta(veri) if prova else None
    sandbox = None
    if prova:
        sandbox = tempfile.mkdtemp(prefix='modelli_lab_prova_')
        print(f'  [prova] lavoro su COPIA in {sandbox} — data/ non viene mai aperta in '
              f'scrittura')

    rapporti = []
    try:
        for mod in REGISTRO:
            per_gara, dati = mod.raccogli()
            if prova:
                # La copia parte dal file vero, cosi' la prova vede lo stesso "prima" e il
                # delta dei coefficienti resta fedele. `uscita` diventa un percorso
                # ASSOLUTO: autocalibra fa os.path.join(RADICE, uscita), e un assoluto
                # vince sulla radice -> scrive nella sandbox, mai in data/.
                vero = os.path.join(QUI, mod.uscita)
                copia = os.path.join(sandbox, os.path.basename(mod.uscita))
                if os.path.exists(vero):
                    shutil.copy2(vero, copia)
                mod.uscita = copia
                per_gara = {k: v for k, v in per_gara.items() if k != a.senza_gara}
                dati = {k: v for k, v in dati.items() if k != a.senza_gara}
                mod.calibra = lambda pg=per_gara, dt=dati, m=mod: m.__class__.calibra(m, pg, dt)
            r = autocalibra.aggiorna(mod, a.data)
            rapporti.append(r)
            if a.verifica:
                coef = mod.calibra(per_gara, dati) if not prova else None
                v = mod.verifica(per_gara, dati, coef)
                # il cancello di accensione e' l'unica cosa che OGNI modello deve saper dire:
                # sta dentro il modello, e qui si stampa e basta (nessuna decisione).
                ca = v.get('cancello_accensione')
                if ca:
                    print(f"    cancello di accensione: ACCENDIBILE = {ca.get('ACCENDIBILE')}"
                          + (f"   [partizione {ca['partizione']['versione']}]"
                             if ca.get('partizione') else ''))
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
    finally:
        if sandbox:
            shutil.rmtree(sandbox, ignore_errors=True)      # la copia si butta, sempre

    print('\n' + ('nessun modello cambiato' if not any(r['cambiato'] for r in rapporti)
                  else 'modelli aggiornati: '
                       + ', '.join(r['modello'] for r in rapporti if r['cambiato'])))

    if prova:
        # LA GARANZIA, DIMOSTRATA: i file veri hanno la stessa impronta di prima.
        dopo = _impronta(veri)
        intatti = [p for p in veri if prima[p] == dopo[p]]
        toccati = [p for p in veri if prima[p] != dopo[p]]
        for p in intatti:
            print(f'  [prova] INTATTO  {os.path.relpath(p, QUI)}  '
                  f'sha256 {(prima[p] or "assente")[:16]}')
        for p in toccati:
            print(f'  [prova] !! SCRITTO !!  {os.path.relpath(p, QUI)}: '
                  f'{prima[p]} -> {dopo[p]}')
        print(f"  [prova] copia buttata. data/: {len(intatti)}/{len(veri)} file intatti"
              + ('' if not toccati else '  <-- REGRESSIONE: una prova ha scritto in data/'))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
