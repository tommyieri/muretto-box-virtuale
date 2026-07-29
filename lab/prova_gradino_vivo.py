#!/usr/bin/env python3
"""prova_gradino_vivo.py — il coefficiente vivo messo alla prova sul GRADINO DI SOSTA.

Il gradino e' quanto va piu' forte l'auto DOPO la sosta: e' il numero da cui esce l'undercut,
e il motore lo modellava come zero. Qui si prova che il meccanismo di auto-aggiornamento
funziona su dati veri, non su un esempio inventato.

PROTOCOLLO, e l'ordine e' il metodo:
  - il prior nasce SOLO da 2023-2024-2025 (una stima per stagione, con il suo errore)
  - poi le dieci gare 2026 entrano UNA ALLA VOLTA, in ordine cronologico
  - per ogni gara: prima si prevede, poi si registra l'errore, SOLO DOPO si impara
  - tre candidati corrono in parallelo sulla stessa sequenza:
        A  prior storico CONGELATO   (non impara mai)
        B  solo 2026                 (nessuna memoria del passato)
        C  blend                     (l'architettura proposta)
    Se C non batte B, lo storico sta facendo danno e va spento: si vede, non si opina.

Tutto dal GREZZO. Nessun CSV derivato, nessun modello preesistente.
"""
import os
import statistics as st
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)
sys.path.insert(0, os.path.join(QUI, '..', '..', '..', '..'))

from coefficiente_vivo import (CoefficienteVivo, prior_dallo_storico,
                               confronto_prequenziale)

# il fondo e' in produzione: otto stagioni storiche piu' il 2026, una porta sola
from fondo import (giri, gare, per_pilota, verde, neutralizzato, piena,
                   bagnata as _bagnata, ASCIUTTE, BAGNATE)

W = 5


def bagnata(anno, gara):
    return _bagnata(anno, gara)


def gradini(anno, gara):
    byd = per_pilota(giri(anno, gara))
    out = []
    for drv, g in byd.items():
        for lap in sorted(g):
            c = g[lap]
            if c.get('pin') is None:
                continue
            nx = g.get(lap + 1)
            if not nx or nx.get('pout') is None:
                continue
            if neutralizzato(c) or neutralizzato(nx):
                continue
            if c.get('compound') not in ASCIUTTE or nx.get('compound') not in ASCIUTTE:
                continue
            pre = [g[k] for k in range(max(1, lap - W), lap)
                   if k in g and verde(g[k]) and g[k].get('stint') == c.get('stint')]
            post = [g[k] for k in range(lap + 2, lap + 2 + W)
                    if k in g and verde(g[k]) and g[k].get('stint') == nx.get('stint')]
            if len(pre) < 3 or len(post) < 3:
                continue
            out.append(st.median([x['time'] for x in post])
                       - st.median([x['time'] for x in pre]))
    return out


def stima_gara(anno, gara):
    """(valore, errore standard) del gradino di UNA gara. None se non misurabile."""
    v = gradini(anno, gara)
    if len(v) < 4:
        return None, None
    m = st.median(v)
    # errore standard della mediana ~ 1,253 * sd / sqrt(n)
    se = 1.253 * st.pstdev(v) / math.sqrt(len(v)) if len(v) > 1 else None
    return m, se


import math  # noqa: E402  (serve a stima_gara, tenuto qui per leggibilita' del blocco sopra)


def stima_stagione(anno):
    """(valore, errore standard) di una STAGIONE, con blocchi = gare (mai giri)."""
    per_gara = []
    for g in gare(anno):
        if bagnata(anno, g) or not piena(anno, g):
            continue                      # le 30 sessioni mutilate del 2019 restano fuori
        m, _ = stima_gara(anno, g)
        if m is not None:
            per_gara.append(m)
    if len(per_gara) < 3:
        return None, None, 0
    return (st.median(per_gara),
            st.pstdev(per_gara) / math.sqrt(len(per_gara)),
            len(per_gara))


print('=' * 98)
print('1. IL PRIOR — dalle sole stagioni storiche, una stima per stagione (blocchi = gare)')
print('=' * 98)
stime = []
for a in ('2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'):
    m, se, n = stima_stagione(a)
    if m is None:
        continue
    stime.append((a, m, se))
    print(f'  {a}:  {m:+.3f} ± {se:.3f} s/giro   ({n} gare asciutte)')

theta0, sigma0, tau2, diag = prior_dallo_storico(stime)
print()
print(f'  PRIOR MAP        : {theta0:+.3f} ± {sigma0:.3f} s/giro')
print(f'  tau2 fra stagioni: {tau2:.6f}   (I2 = {diag["I2"]:.0%})')
print(f'  lettura          : {"le stagioni concordano -> prior stretto" if diag["I2"] < 0.5 else "le stagioni ballano -> prior largo, il 2026 lo scavalchera in fretta"}')

print()
print('=' * 98)
print('2. LE DIECI GARE 2026, UNA ALLA VOLTA — prima prevede, poi impara')
print('=' * 98)
seq = []
for g in gare('2026'):
    if bagnata('2026', g):
        print(f'  {g.replace(" Grand Prix", ""):20} SALTATA — gara bagnata (rilevata dalla mescola)')
        continue
    m, se = stima_gara('2026', g)
    if m is None:
        continue
    seq.append((g.replace(' Grand Prix', ''), m, se))

vivo = CoefficienteVivo('gradino_sosta', 's/giro', theta0, sigma0, tau2, diag)
print()
print(f'  {"gara":16} {"previsto":>10} {"osservato":>10} {"errore":>8} '
      f'{"theta dopo":>11} {"w storico":>10}')
for et, y, se in seq:
    prev, _ = vivo.prevedi()
    r = vivo.assorbi(y, se, et)
    print(f'  {et:16} {prev:+10.3f} {y:+10.3f} {r["errore"]:+8.3f} '
          f'{vivo.theta:+11.3f} {vivo.w:10.2f}' + ('   ⚠ DERIVA' if r['deriva'] else ''))

print()
t = vivo.targhetta()
print(f'  VALORE FINALE : {t["valore"]:+.3f} ± {t["sd"]:.3f} s/giro')
print(f'  peso storico  : {t["peso_storico_w"]:.2f}')
print(f'  lettura       : {t["lettura"]}')

print()
print('=' * 98)
print('3. LO STORICO AIUTA O FA DANNO? — tre candidati sulla stessa sequenza')
print('=' * 98)
# B parte dallo STESSO punto degli altri ma con varianza enorme: cosi' la prima previsione
# e' identica per tutti e tre (nessuno e' avvantaggiato), e da li' in poi B si incolla ai
# dati 2026 ignorando il passato. Farlo partire dal valore della PRIMA gara 2026, come
# avevo fatto, gli regalava un colpo gratis: prevedeva la gara 1 con la gara 1.
molto_largo = sigma0 * 50
cand = {
    'A prior storico congelato': CoefficienteVivo('A', 's', theta0, sigma0, congelato=True),
    'B solo 2026 (nessuna memoria)': CoefficienteVivo('B', 's', theta0, molto_largo, delta=1.0),
    'C blend (architettura)': CoefficienteVivo('C', 's', theta0, sigma0, tau2, diag),
}
res = confronto_prequenziale(cand, seq)
print(f'  {"candidato":34} {"MAE":>8} {"perdita recente":>17}')
for k, v in res.items():
    pr = v['perdita_recente']
    print(f'  {k:34} {v["mae"]:8.3f} {pr:17.3f}' if pr is not None
          else f'  {k:34} {v["mae"]:8.3f} {"—":>17}')
gc = res['C blend (architettura)']['mae']
gb = res['B solo 2026 (nessuna memoria)']['mae']
ga = res['A prior storico congelato']['mae']
print()
print(f'  guadagno del blend sul solo-2026 : {gb - gc:+.3f} s/giro')
print(f'  guadagno del blend sul solo-storico: {ga - gc:+.3f} s/giro')
print()
if gc <= gb and gc <= ga:
    print('  -> il BLEND vince: lo storico va usato, ma pesato. E l architettura proposta.')
elif gb < gc:
    print('  -> il solo-2026 vince: lo storico sta facendo DANNO su questa grandezza.')
else:
    print('  -> il solo-storico vince: il 2026 non ha ancora abbastanza materiale.')
