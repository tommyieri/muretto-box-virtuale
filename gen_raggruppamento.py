#!/usr/bin/env python3
"""gen_raggruppamento.py — LA SAFETY CAR CHE RIMESCOLA, misurata sul fondo 2018-2026.

    python3 gen_raggruppamento.py            # scrive demo/data/raggruppamento.json
    python3 gen_raggruppamento.py --stampa

PERCHE' ESISTE. Il modello sapeva quanto costa una sosta e non sapeva la cosa che decide
davvero le gare: quando esce la Safety Car il gruppo si ACCODA, e i distacchi in tempo
evaporano. Senza quel pezzo il prodotto rispondeva a una domanda vera dando la risposta
sbagliata — verificato al tavolo con il PO su un caso di Silverstone.

TRE MISURE, tutte dal fondo, nessuna presa da una tabella.

1. SC E VSC SONO OPPOSTI, e trattarli insieme cancella entrambi:
       SC  (71 periodi)  distacchi fra auto consecutive  2,47 -> 1,60 s   x0,73
       VSC (16 periodi)                                  2,65 -> 3,49 s   x1,37
   Sotto Safety Car il gruppo si accoda; sotto Virtual SC ognuno rallenta per conto suo e
   i distacchi RESTANO, anzi si allargano. Un unico "neutralizzazione" li media a zero.

2. QUANTO RESTA DI UN DISTACCO quando esce la SC, per grandezza (10.092 coppie di piloti):
       0-2 s   -> 206%      i vicini si allontanano (la coda ha un passo minimo)
       2-5 s   -> 110%
       5-10 s  ->  83%
       10-20 s ->  53%      un vantaggio grosso si DIMEZZA
       20-40 s ->  52%
   Sopra i 40 s il rapporto risale al 113%: sono i doppiati, un fenomeno diverso.

3. L'ESITO OSSERVATO del caso che il muretto vive davvero — A si ferma in verde, B si ferma
   sotto Safety Car entro 4 giri, B era dietro. 286 casi reali:
       B era dietro 0-3 s   -> B passa nel 63% (n=51)
       B era dietro 3-6 s   -> B passa nel 61% (n=38)
       B era dietro 6-10 s  -> B passa nel 44% (n=59)
       B era dietro 10-25 s -> B passa nel 20% (n=138)
   Questo NON e' un modello: e' un tasso di base osservato. Il prodotto lo mostra come tale.

PERCHE' IL TASSO DI BASE E NON LA RICOSTRUZIONE. Ricomponendo i pezzi (pit-loss verde +
pit-loss sotto SC + compressione) la risposta dipendeva da un rapporto SC/verde stimato su
4 gare, e usciva ROVESCIATA. L'esito diretto poggia su 286 casi e non ha pezzi da sommare.
Dove si puo' misurare la risposta invece dei suoi ingredienti, si misura la risposta.
"""
import argparse
import json
import os
import statistics as st
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, 'lab'))
from fondo import giri, gare, per_pilota, piena        # noqa: E402
sys.path.insert(0, ROOT)
from fondo_identita import cid                          # noqa: E402

USCITA = os.path.join(ROOT, 'demo', 'data', 'raggruppamento.json')
ANNI = ('2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026')
FASCE_ESITO = ((0, 3), (3, 6), (6, 10), (10, 25))
FASCE_GAP = ((0, 2), (2, 5), (5, 10), (10, 20), (20, 40))
MIN_CASI = 15
# Per pubblicare una soglia di pareggio servono almeno TRE eventi per lato (B passa / A
# resta). Sotto, il numero descrive un pomeriggio, non una pista: e' la stessa regola con
# cui e' stato tolto dal prodotto il rapporto SC/verde.
MIN_LATO = 3
# ...e almeno tre EVENTI distinti. Senza questa seconda soglia la prima si lascia ingannare
# esattamente dall'errore che ha causato tutto: Miami mostrava una soglia di 12,4 s ricavata
# da UNA SOLA Safety Car (14 coppie correlate). Tre coppie non sono tre prove se vengono
# dallo stesso pomeriggio.
MIN_EVENTI = 3


def _tipo(c):
    s = str(c.get('status') or '')
    return 'SC' if '4' in s else ('VSC' if '6' in s else None)


def stato_giri(byd):
    """lap -> 'SC' | 'VSC', quando la MAGGIORANZA delle auto lo dichiara."""
    laps = sorted({l for gg in byd.values() for l in gg})
    out = {}
    for l in laps:
        tt = [_tipo(gg[l]) for gg in byd.values() if l in gg]
        n = len([x for x in tt if x])
        tot = len(tt)
        if tot >= 8 and n / tot > 0.5:
            out[l] = 'SC' if tt.count('SC') >= tt.count('VSC') else 'VSC'
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stampa', action='store_true')
    a = ap.parse_args()

    comp = defaultdict(list)          # tipo -> [rapporto fra distacchi consecutivi]
    resta = defaultdict(list)         # fascia -> [gap_durante / gap_prima]
    esiti = []                        # {gap0, gap1, evento, cid} del caso A-verde / B-sotto-SC

    for anno in ANNI:
        for g in gare(anno):
            if not piena(anno, g):
                continue
            cidg = cid(g)
            byd = per_pilota(giri(anno, g))
            if not byd:
                continue
            stato = stato_giri(byd)
            if not stato:
                continue

            # --- 1 e 2: cosa succede ai distacchi all'inizio di ogni periodo ---
            for l in sorted(stato):
                if stato.get(l - 1) or stato.get(l + 2) != stato[l]:
                    continue
                A, B = l - 2, l + 2
                com = [d for d, gg in byd.items() if A in gg and B in gg
                       and gg[A].get('sesT') is not None and gg[B].get('sesT') is not None]
                if len(com) < 10:
                    continue
                pre = sorted(byd[d][A]['sesT'] for d in com)
                dur = sorted(byd[d][B]['sesT'] for d in com)
                gp = [pre[i + 1] - pre[i] for i in range(len(pre) - 1)]
                gd = [dur[i + 1] - dur[i] for i in range(len(dur) - 1)]
                if gp and gd and st.median(gp) > 0:
                    comp[stato[l]].append(st.median(gd) / st.median(gp))
                if stato[l] != 'SC':
                    continue
                for i, d1 in enumerate(com):
                    for d2 in com[i + 1:]:
                        p = abs(byd[d1][A]['sesT'] - byd[d2][A]['sesT'])
                        d = abs(byd[d1][B]['sesT'] - byd[d2][B]['sesT'])
                        if p <= 0:
                            continue
                        for lo, hi in FASCE_GAP:
                            if lo <= p < hi:
                                resta[f'{lo}-{hi}'].append(d / p)
                                break

            # --- 3: l'esito osservato ---
            soste = defaultdict(list)
            for d, gg in byd.items():
                for l, c in gg.items():
                    if c.get('pin') is not None and gg.get(l + 1, {}).get('pout') is not None:
                        soste[d].append(l)
            for dA, la in soste.items():
                for pa in la:
                    if stato.get(pa) or stato.get(pa + 1):
                        continue                       # A deve fermarsi in VERDE
                    for dB, lb in soste.items():
                        if dB == dA:
                            continue
                        for pb in lb:
                            if not (pa < pb <= pa + 4) or stato.get(pb) != 'SC':
                                continue
                            L0, L1 = pa - 1, pb + 3
                            try:
                                s0a, s0b = byd[dA][L0]['sesT'], byd[dB][L0]['sesT']
                                s1a, s1b = byd[dA][L1]['sesT'], byd[dB][L1]['sesT']
                            except (KeyError, TypeError):
                                continue
                            if None in (s0a, s0b, s1a, s1b):
                                continue
                            g0, g1 = s0b - s0a, s1b - s1a
                            if 0 < g0 < 30:
                                # L'EVENTO, non la coppia, e' l'unita' di prova. Una sola
                                # Safety Car genera decine di coppie CORRELATE: a Zandvoort
                                # 2023 ne uscivano 79 su 326 totali, e la curva interpolata
                                # finiva per descrivere quel pomeriggio invece del fenomeno.
                                ev = f'{anno}|{g}|{min(x for x in stato if x >= pb)}'
                                esiti.append({'g0': g0, 'g1': g1, 'ev': ev, 'cid': cidg})

    out = {
        '_nota': 'GENERATO da gen_raggruppamento.py sul fondo 2018-2026. Il tasso di esito '
                 'e OSSERVATO, non ricostruito: sommare pit-loss e compressione dava la '
                 'risposta rovesciata perche il rapporto SC/verde poggia su troppe poche gare.',
        'compressione': {
            k: {'mediana': round(st.median(v), 3), 'n_periodi': len(v),
                'lettura': ('il gruppo si accoda: i distacchi si comprimono'
                            if st.median(v) < 1 else
                            'i distacchi NON si comprimono, anzi si allargano')}
            for k, v in comp.items() if len(v) >= 5},
        'quanto_resta_del_distacco': {
            k: {'quota': round(st.median(v), 3), 'n_coppie': len(v)}
            for k, v in sorted(resta.items(), key=lambda kv: float(kv[0].split('-')[0]))
            if len(v) >= 50},
        'esito_A_verde_B_sotto_SC': {},
        'esito_complessivo': None,
    }
    if esiti:
        out['esito_complessivo'] = {
            'n': len(esiti),
            'quota_B_passa': round(sum(1 for e in esiti if e['g1'] < 0) / len(esiti), 3),
            'guadagno_mediano_s': round(st.median([e['g0'] - e['g1'] for e in esiti]), 1)}
        for lo, hi in FASCE_ESITO:
            v = [e for e in esiti if lo <= e['g0'] < hi]
            if len(v) >= MIN_CASI:
                out['esito_A_verde_B_sotto_SC'][f'{lo}-{hi}'] = {
                    'n': len(v),
                    'quota_B_passa': round(sum(1 for e in v if e['g1'] < 0) / len(v), 3)}

        # --- LA SOGLIA DI PAREGGIO: quanto vantaggio serve per NON farsi passare ---
        # Punto medio fra il gap tipico in cui B passa e quello in cui A resta davanti.
        # NON si interpola una curva: con 53 eventi e coppie correlate la curva descrive
        # gli eventi piu' prolifici (Zandvoort 2023 da solo faceva 79 coppie su 326) e la
        # soglia usciva a 7,1 s contro i 10 del riferimento di dominio. Con le mediane dei
        # due gruppi esce 10,1 — e sui primi due della classifica 11,1.
        def soglia(sel):
            passa = [e['g0'] for e in sel if e['g1'] < 0]
            resta_ = [e['g0'] for e in sel if e['g1'] >= 0]
            if len(passa) < MIN_LATO or len(resta_) < MIN_LATO:
                return None
            if len({e['ev'] for e in sel}) < MIN_EVENTI:
                return None
            return {'soglia_s': round((st.median(passa) + st.median(resta_)) / 2, 1),
                    'gap_tipico_B_passa': round(st.median(passa), 1),
                    'gap_tipico_A_resta': round(st.median(resta_), 1),
                    'n_eventi': len({e['ev'] for e in sel}),
                    'n_coppie': len(sel)}

        # I valori per-circuito restano come DIAGNOSTICA, non come prodotto: il test di
        # permutazione (2000 rimescolamenti degli eventi) dice che la loro dispersione
        # (11,1 s) e' indistinguibile da quella che il caso produce con le stesse taglie
        # (mediana 8,3 s, IC90 4,0-14,1; p = 0,199). Con 3-5 Safety Car a pista non c'e'
        # segnale per-circuito. demo/grossi.mjs::sogliaDifesa usa il globale per tutti.
        out['soglia_pareggio'] = {'globale': soglia(esiti),
                                  '_nota_per_circuito': 'DIAGNOSTICA, non usata dal prodotto: '
                                  'dispersione indistinguibile dal caso (p=0,20). Si riapre '
                                  'quando una pista supera ~10 eventi.',
                                  'per_circuito': {}}
        per_c = defaultdict(list)
        for e in esiti:
            if e['cid']:
                per_c[e['cid']].append(e)
        for c, v in sorted(per_c.items()):
            sg = soglia(v)
            if sg:
                out['soglia_pareggio']['per_circuito'][c] = sg

    if a.stampa:
        print(json.dumps(out, indent=1, ensure_ascii=False))
        return 0
    os.makedirs(os.path.dirname(USCITA), exist_ok=True)
    with open(USCITA, 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    e = out['esito_complessivo']
    print(f'[scritto] {USCITA}')
    print(f'  compressione SC {out["compressione"].get("SC", {}).get("mediana")} · '
          f'VSC {out["compressione"].get("VSC", {}).get("mediana")}')
    print(f'  esito osservato su {e["n"]} casi: B passa nel {e["quota_B_passa"]:.0%}')
    sg = out.get('soglia_pareggio', {}).get('globale')
    if sg:
        print(f'  soglia di pareggio: {sg["soglia_s"]} s  '
              f'({sg["n_eventi"]} eventi, {sg["n_coppie"]} coppie)')
        print(f'  circuiti con soglia propria: '
              f'{len(out["soglia_pareggio"]["per_circuito"])}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
