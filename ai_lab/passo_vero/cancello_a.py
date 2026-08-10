#!/usr/bin/env python3
"""CANCELLO A — il controllo naturale migliora il passo dei prossimi giri?

Disegno e soglie: ai_lab/passo_vero/PREREG.md, scritto PRIMA di questa misura.
Fuori campione obbligatorio: leave-one-race-out sui divari fra squadre.

    python3 ai_lab/passo_vero/cancello_a.py
    python3 ai_lab/passo_vero/cancello_a.py --placebo   # etichette squadra rimescolate
"""
import argparse, json, os, random, statistics as st
from collections import defaultdict
from itertools import combinations

QUI = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.join(QUI, '..', '..', 'demo', 'data')
SOGLIA_ARIA, MAX_DETA = 2.0, 3
GIRI_AVANTI, FINESTRA_INDIETRO, MAGRO = 5, 10, 4
CONGELAMENTI = [10, 20, 30, 40, 50]


def gare():
    man = json.load(open(os.path.join(DEMO, 'manifest.json')))
    nomi = [g['gara'] for g in man] if isinstance(man, list) else list(man)
    for n in nomi:
        p = os.path.join(DEMO, f'{n}.json')
        if os.path.exists(p):
            yield n, json.load(open(p))


def pulita(c):
    return (not (c.get('in_lap') or c.get('out_lap') or c.get('neutralized') or c.get('deleted'))
            and isinstance(c.get('lap_time'), (int, float))
            and isinstance(c.get('cum_time'), (int, float)) and c.get('compound'))


def per_giro(d):
    """{giro: {sigla: cella}} con solo le celle pulite, piu' il gap dalla macchina davanti."""
    out = {}
    for L in d['laps']:
        cars = {s: c for s, c in L.get('cars', {}).items() if pulita(c)}
        if len(cars) < 2:
            continue
        ordinati = sorted(cars.items(), key=lambda kv: kv[1]['cum_time'])
        for i, (s, c) in enumerate(ordinati):
            c['_gap'] = float('inf') if i == 0 else c['cum_time'] - ordinati[i - 1][1]['cum_time']
        out[L['lap']] = cars
    return out


def divari(dati, escludi, mescola_squadre=False):
    """Divario mediano fra coppie di squadre, da TUTTE le gare tranne `escludi`.
    Ritorna {(t1,t2): (mediana, scarto_fra_gare, n_gare)}."""
    per_coppia = defaultdict(lambda: defaultdict(list))
    for nome, giri in dati.items():
        if nome == escludi:
            continue
        for L, cars in giri.items():
            sigle = list(cars)
            squadra = {s: cars[s]['team'] for s in sigle}
            if mescola_squadre:                       # PLACEBO: le squadre non contano piu'
                mescolate = list(squadra.values())
                random.shuffle(mescolate)
                squadra = dict(zip(sigle, mescolate))
            for a, b in combinations(sigle, 2):
                ca, cb = cars[a], cars[b]
                if squadra[a] == squadra[b] or ca['compound'] != cb['compound']:
                    continue
                ea, eb = ca.get('tyre_age'), cb.get('tyre_age')
                if ea is None or eb is None or abs(ea - eb) > MAX_DETA:
                    continue
                if ca['_gap'] <= SOGLIA_ARIA or cb['_gap'] <= SOGLIA_ARIA:
                    continue
                t1, t2 = sorted((squadra[a], squadra[b]))
                dt = (ca['lap_time'] - cb['lap_time']) if squadra[a] == t1 else (cb['lap_time'] - ca['lap_time'])
                per_coppia[(t1, t2)][nome].append(dt)
    out = {}
    for coppia, pg in per_coppia.items():
        med = [st.median(v) for v in pg.values() if len(v) >= 8]
        if len(med) >= 4:
            out[coppia] = (st.mean(med), st.pstdev(med) or 0.01, len(med))
    return out


def giri_propri(giri, sig, L):
    """Quanti giri verdi in aria libera ha questa macchina nei 10 giri prima di L, e la
    loro mediana: e' il campione su cui il nullo (`pace`) si regge."""
    v = []
    for k in range(max(1, L - FINESTRA_INDIETRO), L + 1):
        c = giri.get(k, {}).get(sig)
        if c and c['_gap'] > SOGLIA_ARIA:
            v.append(c['lap_time'])
    return v


def verita(giri, sig, L):
    v = [giri[k][sig]['lap_time'] for k in range(L + 1, L + 1 + GIRI_AVANTI)
         if k in giri and sig in giri[k]]
    return st.median(v) if len(v) >= 3 else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--placebo', action='store_true')
    a = ap.parse_args()
    if a.placebo:
        random.seed(20260810)

    dati, grezzi = {}, {}
    for nome, d in gare():
        grezzi[nome] = d
        dati[nome] = per_giro(d)

    casi = []
    for nome, giri in dati.items():
        D = divari(dati, escludi=nome, mescola_squadre=a.placebo)
        pace = grezzi[nome].get('pace', {})
        for L in CONGELAMENTI:
            if L not in giri:
                continue
            cars = giri[L]
            base_giro = pace.get(str(L), {})
            # `pace` E' IL PASSO A SERBATOIO VUOTO, non un tempo sul giro: misurato, il
            # tempo reale lo supera di +2,79 s al giro 10 e di +1,10 s al giro 50, cioe' la
            # benzina che si consuma. Confrontarlo grezzo coi tempi veri regalava al nullo
            # un handicap di due secondi — e la prima esecuzione di questo cancello dava
            # +32,9% che era tutto li'. Qui si rimette la benzina, con lo scarto MEDIANO
            # osservato a QUEL giro (informazione disponibile al congelamento, uguale per
            # tutti i piloti): toglie una differenza di unita', non un segnale.
            scarti = [cc['lap_time'] - base_giro[ss] for ss, cc in cars.items()
                      if base_giro.get(ss) is not None]
            if len(scarti) < 5:
                continue
            benzina = st.median(scarti)
            for sig, c in cars.items():
                nullo = base_giro.get(sig)
                if nullo is not None:
                    nullo += benzina
                vero = verita(giri, sig, L)
                if nullo is None or vero is None:
                    continue
                propri = giri_propri(giri, sig, L)

                # L'ALTERNATIVA: cosa dicono gli ALTRI, adesso, su questa macchina.
                # Per ogni rivale in aria libera con la stessa mescola ed eta' simile,
                # il suo tempo piu' il divario storico fra le due squadre e' una stima
                # indipendente del passo di questa macchina. Ognuna pesa quanto e'
                # affidabile la coppia (divario/scarto).
                stime, pesi = [], []
                for altro, ca in cars.items():
                    if altro == sig or ca['team'] == c['team'] or ca['compound'] != c['compound']:
                        continue
                    ea, eb = ca.get('tyre_age'), c.get('tyre_age')
                    if ea is None or eb is None or abs(ea - eb) > MAX_DETA:
                        continue
                    if ca['_gap'] <= SOGLIA_ARIA or c['_gap'] <= SOGLIA_ARIA:
                        continue
                    t1, t2 = sorted((c['team'], ca['team']))
                    if (t1, t2) not in D:
                        continue
                    m, sd, _ = D[(t1, t2)]
                    delta = m if c['team'] == t1 else -m          # quanto io sto DIETRO lui
                    stime.append(ca['lap_time'] + delta)
                    pesi.append(min(4.0, abs(m) / sd))            # coppie vaghe pesano poco
                if not stime:
                    continue
                prior = sum(s * p for s, p in zip(stime, pesi)) / sum(pesi)

                # peso del prior: cresce quando il campione proprio e' magro
                w = 0.6 if len(propri) <= MAGRO else 0.2
                alt = (1 - w) * nullo + w * prior
                casi.append({'gara': nome, 'sig': sig, 'L': L, 'magro': len(propri) <= MAGRO,
                             'e_nullo': abs(nullo - vero), 'e_alt': abs(alt - vero)})

    def referto(sel, eti):
        if not sel:
            print(f'   {eti:<22} nessun caso'); return None
        en = st.median(x['e_nullo'] for x in sel)
        ea = st.median(x['e_alt'] for x in sel)
        meglio = sum(1 for x in sel if x['e_alt'] < x['e_nullo'])
        var = (en - ea) / en * 100 if en else 0
        print(f'   {eti:<22} n={len(sel):<5} nullo {en:.3f} s   alt {ea:.3f} s   '
              f'{var:+.1f}%   meglio in {meglio}/{len(sel)}')
        return var

    print(f'CANCELLO A{" — PLACEBO (squadre rimescolate)" if a.placebo else ""}')
    print(f'   fuori campione: leave-one-race-out · {len(casi)} casi\n')
    v_tot = referto(casi, 'tutti')
    v_magro = referto([x for x in casi if x['magro']], 'campione magro')
    v_ricco = referto([x for x in casi if not x['magro']], 'campione ricco')
    if v_magro is None:
        return
    print()
    print(f'   soglia 1 (magro migliora >= 15%): {"SI" if v_magro >= 15 else "NO"}  ({v_magro:+.1f}%)')
    print(f'   soglia 2 (ricco non peggiora > 2%): {"SI" if v_ricco >= -2 else "NO"}  ({v_ricco:+.1f}%)')


if __name__ == '__main__':
    main()
