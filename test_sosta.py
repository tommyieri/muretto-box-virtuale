"""test_sosta.py — il confronto pre-registrato in data/SOSTA_PREREG.md.

Mette le quattro definizioni candidate di «sosta» contro la verita' a terra (f1db, via
demo/data/pitstops_2026.json) su tutte le gare, e stampa precisione/richiamo complessivi e
per gara. Il cancello e' quello scritto nella prereg: precisione e richiamo >= 0,98
sull'unione, mai sotto 0,95 su una singola gara, nessun parametro per gara.

Uso:  python3 test_sosta.py            # tabella + esito del cancello
      python3 test_sosta.py --casi     # elenca i disaccordi, per capirli uno per uno
"""
import argparse, json, os, sys
from collections import defaultdict

SOGLIA_UNIONE = 0.98
SOGLIA_GARA = 0.95


def celle(gara):
    """{sigla: {giro: cella}} dai dati gara del sito."""
    d = json.load(open(os.path.join('demo', 'data', f'{gara}.json')))
    per = defaultdict(dict)
    for L in d['laps']:
        for sig, c in L['cars'].items():
            per[sig][L['lap']] = c
    return per, d['n_laps']


def candidate(per, n_laps):
    """I quattro insiemi di giri-sosta per ogni pilota."""
    out = {'D1': defaultdict(set), 'D2': defaultdict(set), 'D3': defaultdict(set),
           'D4': defaultdict(set), 'D5': defaultdict(set)}
    for sig, giri in per.items():
        for L in sorted(giri):
            c, d = giri.get(L), giri.get(L + 1)
            if c is None:
                continue
            if d is not None and d.get('stint') is not None and c.get('stint') is not None \
                    and d['stint'] > c['stint']:
                out['D1'][sig].add(L)
            if c.get('in_lap'):
                out['D2'][sig].add(L)
            eta_riparte = (d is not None and d.get('tyre_age') is not None
                           and c.get('tyre_age') is not None and d['tyre_age'] < c['tyre_age'])
            if eta_riparte:
                out['D3'][sig].add(L)
            if eta_riparte and c.get('in_lap'):
                out['D4'][sig].add(L)
            # D5 (SOSTA_PREREG2): un SET DIVERSO. La mescola da sola non vede un cambio
            # SOFT->SOFT; l'eta da sola non vede un set nuovo della stessa eta ne' un set
            # USATO piu' vecchio (Canada/SAI g2: eta 2 -> 9). Servono entrambe.
            if d is not None and c.get('compound') is not None and d.get('compound') is not None:
                if d['compound'] != c['compound'] or eta_riparte:
                    out['D5'][sig].add(L)
    return out


def verita(gara, ps):
    g = ps['gare'].get(gara, {})
    return {sig: {s['giro'] for s in stop} for sig, stop in g.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--casi', action='store_true')
    ap.add_argument('--d5', action='store_true', help='il cancello di SOSTA_PREREG2.md')
    ap.add_argument('--arbitro', action='store_true', help='il cancello di SOSTA_PREREG3.md')
    ap.add_argument('--sentinella', action='store_true', help='come --arbitro ma esce 1 su QUALSIASI disaccordo (sorveglianza continua)')
    a = ap.parse_args()

    ps = json.load(open(os.path.join('demo', 'data', 'pitstops_2026.json')))
    gare = [g['gara'] for g in json.load(open(os.path.join('demo', 'data', 'manifest.json')))]

    tot = {k: [0, 0, 0] for k in ('D1', 'D2', 'D3', 'D4', 'D5')}     # veri, predetti, reali
    per_gara = defaultdict(dict)
    casi = defaultdict(list)

    for gara in gare:
        per, n = celle(gara)
        cand = candidate(per, n)
        vero = verita(gara, ps)
        if not vero:
            print(f'   (nessuna verita f1db per {gara}: saltata)')
            continue
        for k in tot:
            v = p = r = 0
            for sig in set(list(cand[k]) + list(vero)):
                pred, real = cand[k].get(sig, set()), vero.get(sig, set())
                v += len(pred & real); p += len(pred); r += len(real)
                if a.casi:
                    for L in sorted(pred - real):
                        casi[k].append(f'{gara}/{sig} g{L} predetta ma non in f1db')
                    for L in sorted(real - pred):
                        casi[k].append(f'{gara}/{sig} g{L} in f1db ma non predetta')
            tot[k][0] += v; tot[k][1] += p; tot[k][2] += r
            per_gara[gara][k] = (v / p if p else 0.0, v / r if r else 0.0)

    NOME = {'D1': 'contatore stint', 'D2': 'in_lap (transito)', 'D3': 'eta che riparte',
            'D4': 'transito E eta', 'D5': 'set diverso (mescola o eta)'}
    print(f'\n{"definizione":24} {"precisione":>11} {"richiamo":>10}   peggiore gara')
    esiti = {}
    for k in ('D1', 'D2', 'D3', 'D4', 'D5'):
        v, p, r = tot[k]
        prec, rich = (v / p if p else 0.0), (v / r if r else 0.0)
        peggio_g, peggio_v, peggio_q = None, 1.1, ''
        for gara, d in per_gara.items():
            for i, q in enumerate(d[k]):
                if q < peggio_v:
                    peggio_v, peggio_g, peggio_q = q, gara, ('precisione', 'richiamo')[i]
        passa = (prec >= SOGLIA_UNIONE and rich >= SOGLIA_UNIONE and peggio_v >= SOGLIA_GARA)
        esiti[k] = (passa, prec, rich, peggio_g, peggio_v, peggio_q)
        print(f'{NOME[k]:24} {prec:11.3f} {rich:10.3f}   {peggio_g} {peggio_v:.3f} ({peggio_q})'
              f'   {"PASSA" if passa else "no"}')

    print(f'\nsoglie pre-registrate: unione >= {SOGLIA_UNIONE}, nessuna gara < {SOGLIA_GARA}')
    vincitrici = [k for k, e in esiti.items() if e[0]]
    if vincitrici:
        print('PASSANO:', ', '.join(f'{k} ({NOME[k]})' for k in vincitrici))
    else:
        print('NESSUNA CANDIDATA PASSA il cancello come pre-registrato.')

    if a.casi:
        for k in ('D3', 'D4', 'D5'):
            print(f'\n--- disaccordi di {k} ({NOME[k]}): {len(casi[k])} ---')
            for c in casi[k][:40]:
                print('   ', c)

    if a.d5:
        cancello_d5(gare, ps)
    if a.arbitro or a.sentinella:
        return 0 if cancello_arbitro(gare, strict=a.sentinella) else 1
    return 0


def cancello_arbitro(gare, strict=False):
    """Il cancello di data/SOSTA_PREREG3.md: la STESSA regola D5 posta a due fornitori
    indipendenti (TracingInsights via i dati gara del sito, FastF1 via Compound/TyreLife).
    Se la nostra catena avesse un difetto sistematico su compound/tyre_age, i due
    divergerebbero e questo passo lo direbbe."""
    arb = json.load(open(os.path.join('data', 'soste_fastf1_2026.json')))['gare']
    v = p = r = 0
    peggio_v, peggio_g, peggio_q = 1.1, None, ''
    disaccordi = []
    for gara in gare:
        if gara not in arb:
            continue
        per, n = celle(gara)
        nostro = candidate(per, n)['D5']
        loro = {sig: set(d['cambi']) for sig, d in arb[gara].items()}
        gv = gp = gr = 0
        for sig in set(list(nostro) + list(loro)):
            a_, b_ = nostro.get(sig, set()), loro.get(sig, set())
            gv += len(a_ & b_); gp += len(a_); gr += len(b_)
            for L in sorted(a_ - b_):
                disaccordi.append(f'{gara}/{sig} g{L}: solo noi')
            for L in sorted(b_ - a_):
                disaccordi.append(f'{gara}/{sig} g{L}: solo FastF1')
        v += gv; p += gp; r += gr
        for q, nome in (((gv / gp) if gp else 1.0, 'precisione'), ((gv / gr) if gr else 1.0, 'richiamo')):
            if q < peggio_v:
                peggio_v, peggio_g, peggio_q = q, gara, nome
    prec, rich = (v / p if p else 0.0), (v / r if r else 0.0)
    ok = prec >= SOGLIA_UNIONE and rich >= SOGLIA_UNIONE and peggio_v >= SOGLIA_GARA
    if strict:
        # SENTINELLA, non cancello. Il cancello pre-registrato tollerava il 2%: serviva a
        # decidere se promuovere D5 senza sapere quanto avrebbe preso. Ora si sa — l'accordo
        # misurato e' ESATTO, 0 disaccordi su 382 cambi — e cio' che si sorveglia e' quel
        # valore, non la soglia di allora. Un solo disaccordo nuovo e' una regressione:
        # senza questo, un guasto che fa sparire una sosta passerebbe inosservato (provato:
        # cancellando la sosta di Belgio/VER il cancello morbido restava verde).
        ok = not disaccordi
    print('\n=== CANCELLO ARBITRO (data/SOSTA_PREREG3.md) ===')
    print(f'  D5 sul nostro dato contro D5 su FastF1, {r} cambi gomma di riferimento')
    print(f'  precisione {prec:.4f} · richiamo {rich:.4f} · peggiore gara '
          f'{peggio_g} {peggio_v:.3f} ({peggio_q})')
    print(f'  soglie: unione >= {SOGLIA_UNIONE}, nessuna gara < {SOGLIA_GARA}')
    print(f'  disaccordi: {len(disaccordi)}')
    for d in disaccordi[:12]:
        print('     ', d)
    print(f'\nESITO: {"verde" if ok else "ROSSO"}' if strict else f'\nESITO: D5 {"PROMOSSA" if ok else "BOCCIATA"}')
    return ok


def cancello_d5(gare, ps):
    """Il cancello di data/SOSTA_PREREG2.md: fuori dalla bandiera rossa D5 deve coincidere
    con f1db; dentro, i casi in piu' devono essere TUTTI spiegati dalla rossa."""
    neu = json.load(open(os.path.join('demo', 'neutralizzazione.json')))
    v = p = r = 0
    peggio_v, peggio_g, peggio_q = 1.1, None, ''
    extra_dentro = extra_fuori = 0
    for gara in gare:
        rf = neu.get(gara, {}).get('rf', []) or []
        dentro_rf = lambda L: any(x <= L <= y for x, y in rf)
        per, n = celle(gara)
        cand = candidate(per, n)['D5']
        vero = verita(gara, ps)
        if not vero:
            continue
        gv = gp = gr = 0
        for sig in set(list(cand) + list(vero)):
            pred, real = cand.get(sig, set()), vero.get(sig, set())
            for L in pred - real:
                if dentro_rf(L):
                    extra_dentro += 1
                else:
                    extra_fuori += 1
            pf = {L for L in pred if not dentro_rf(L)}
            rfl = {L for L in real if not dentro_rf(L)}
            gv += len(pf & rfl); gp += len(pf); gr += len(rfl)
        v += gv; p += gp; r += gr
        for q, nome in (((gv / gp) if gp else 1.0, 'precisione'), ((gv / gr) if gr else 1.0, 'richiamo')):
            if q < peggio_v:
                peggio_v, peggio_g, peggio_q = q, gara, nome
    prec, rich = (v / p if p else 0.0), (v / r if r else 0.0)
    extra = extra_dentro + extra_fuori
    quota_rf = extra_dentro / extra if extra else 1.0
    c1 = prec >= SOGLIA_UNIONE and rich >= SOGLIA_UNIONE and peggio_v >= SOGLIA_GARA
    c2 = quota_rf >= 0.95
    print('\n=== CANCELLO D5 (data/SOSTA_PREREG2.md) ===')
    print(f'  §1 fuori dalla bandiera rossa: precisione {prec:.3f}, richiamo {rich:.3f}, '
          f'peggiore {peggio_g} {peggio_v:.3f} ({peggio_q})  -> {"PASSA" if c1 else "FALLITO"}')
    print(f'  §2 i {extra} casi in piu\' rispetto a f1db: {extra_dentro} dentro una finestra '
          f'rossa, {extra_fuori} fuori ({quota_rf:.0%}, soglia 95%)  -> {"PASSA" if c2 else "FALLITO"}')
    print(f'\nESITO D5: {"PROMOSSA" if (c1 and c2) else "BOCCIATA"}')
    return c1 and c2


if __name__ == '__main__':
    sys.exit(main())
