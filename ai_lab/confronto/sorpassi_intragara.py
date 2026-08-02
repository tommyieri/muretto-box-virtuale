"""sorpassi_intragara.py — la sorpassabilita' si tiene DENTRO una gara sola?

    python3 ai_lab/confronto/sorpassi_intragara.py

E' la STRADA v2 (a) di data/SORPASSO_NOTA.txt, decisa dal PO il 02/08/2026.
Perimetro, metro, soglie e condizione di non eseguibilita' stanno in
ai_lab/confronto/PREREG_sorpassi_intragara.md, scritta PRIMA di questa misura.
Qui non si decide niente: si esegue.

L'INDICE NON SI RISCRIVE. Episodio, soglie del setting primario (ZONA 1,0 s ·
CHIUSURA 0,6 s · K 4), censure e dedup vengono da `episodi()` di
gen_difficolta_sorpasso.py — la metrica v2 ratificata dal PO, recuperata dal
commit 8c4eaec^. L'unica modifica a quel file e' che ora l'esito viaggia col
giro in cui l'episodio comincia; il cancello I0 ha verificato che i gate G0-G3
dell'indice v1 restano identici byte a byte.

LA DOMANDA. L'indice v1 ha fallito G2 (stabilita' fra stagioni) e la diagnosi
scritta allora era: con UNA gara per circuito-stagione l'indice osserva la pista
PIU' le condizioni di quella domenica. Dentro una gara sola le condizioni sono
fisse per costruzione. Se il tasso di conversione non si tiene nemmeno li',
nessun indicatore di sorpassabilita' disponibile al congelamento puo' esistere.

NON SCRIVE NIENTE su disco.
"""
import json
import math
import random
import sys
import os

sys.path.insert(0, os.getcwd())
from gen_difficolta_sorpasso import (  # noqa: E402
    PRIMARIO, episodi, gare_disponibili, genera_gara, per_pilota,
)

MIN_MEZZO = 10          # episodi risolti richiesti in CIASCUNA meta' (prereg)
MIN_MEZZO_ROBUSTO = 15  # controllo di sensibilita', dichiarato prima
MIN_GARE = 8            # sotto, NON ESEGUIBILE
SOGLIA_RHO = 0.40
PERMUTAZIONI = 2000
FRAZIONI = (0.20, 0.30, 0.40, 0.50, 0.60)
SEME = 20260802         # il caso e' riproducibile o non e' una misura


def spearman(xs, ys):
    """Spearman con correzione per i pari merito (le percentuali si ripetono)."""
    n = len(xs)
    if n < 3:
        return float('nan')

    def rank(v):
        ordine = sorted(range(n), key=lambda i: v[i])
        r = [0.0] * n
        i = 0
        while i < n:
            j = i
            while j + 1 < n and v[ordine[j + 1]] == v[ordine[i]]:
                j += 1
            media = (i + j) / 2.0 + 1.0
            for k in range(i, j + 1):
                r[ordine[k]] = media
            i = j + 1
        return r

    rx, ry = rank(xs), rank(ys)
    mx, my = sum(rx) / n, sum(ry) / n
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    dx = math.sqrt(sum((a - mx) ** 2 for a in rx))
    dy = math.sqrt(sum((b - my) ** 2 for b in ry))
    return float('nan') if dx == 0 or dy == 0 else num / (dx * dy)


def indice(eps):
    return 100.0 * sum(1 for e, _ in eps if e == 'conv') / len(eps)


def dividi(eps, taglio):
    a = [x for x in eps if x[1] <= taglio]
    b = [x for x in eps if x[1] > taglio]
    return a, b


def nullo_e_soffitto(per_gara, rng, minimo):
    """DUE distribuzioni di riferimento, e servono a cose opposte.

    NULLO (quello giusto): si rimescola QUALE `tardi` sta con QUALE `presto`, cioe'
    si rompe l'accoppiamento fra le due meta' della STESSA gara conservando le due
    distribuzioni marginali. Se l'accoppiamento non porta informazione, la Spearman
    osservata sta dentro questa distribuzione.

    SOFFITTO: si divide ogni gara in due gruppi A CASO, delle stesse dimensioni delle
    due meta'. Non e' un nullo — conserva proprio la cosa in esame, il tasso medio di
    quella gara — ed e' il MASSIMO che si potrebbe ottenere con quel numero di episodi.
    Dice se una correlazione bassa e' colpa del fenomeno o del rumore binomiale.

    La prima scrittura di questa prereg chiamava «placebo» la seconda: era una
    specifica sbagliata. E' a referto nell'ESITO di PREREG_sorpassi_intragara.md, non
    corretta in silenzio (regola 3). Nessuno dei due cambia il verdetto di S1 e S2:
    entrambi falliscono gia' sulla soglia rho, da soli.

    NOTA SUL SOFFITTO, aggiunta dopo la verifica avversariale del 02/08: e' una MEDIANA,
    non un massimo, e per di piu' dividendo un insieme FISSO di episodi le due parti sono
    anti-correlate per costruzione — quindi SOTTOSTIMA il tetto vero (misurato +0,649
    contro +0,550). Non va letto come «oltre questo non si puo' andare»: S1 aveva il
    91,7% di probabilita' di passare sotto l'ipotesi ideale. Chi lo usa per dire che un
    cancello non poteva passare sbaglia, ed e' successo.
    """
    ps = [a for a, _ in per_gara.values()]
    ts = [b for _, b in per_gara.values()]
    osservata = spearman(ps, ts)

    fuori, dist_null = 0, []
    for _ in range(PERMUTAZIONI):
        mescolati = list(ts)
        rng.shuffle(mescolati)
        r = spearman(ps, mescolati)
        if not math.isnan(r):
            dist_null.append(r)
            if r >= osservata:
                fuori += 1
    p_null = (fuori + 1) / (len(dist_null) + 1) if dist_null else float('nan')

    soffitti = []
    for _ in range(PERMUTAZIONI // 4):
        xs, ys = [], []
        for eps, na in _grezzi:
            m = list(eps)
            rng.shuffle(m)
            a, b = m[:na], m[na:]
            if len(a) < minimo or len(b) < minimo:
                continue
            xs.append(indice(a))
            ys.append(indice(b))
        r = spearman(xs, ys) if len(xs) >= 3 else float('nan')
        if not math.isnan(r):
            soffitti.append(r)
    soffitti.sort()
    soffitto = soffitti[len(soffitti) // 2] if soffitti else float('nan')
    return osservata, p_null, len(dist_null), soffitto


print('LA SORPASSABILITA\' SI TIENE DENTRO UNA GARA SOLA?')
print('  metrica: tasso di attacco convertito, setting primario', PRIMARIO, '— NON riscritta')
print('  prereg:  ai_lab/confronto/PREREG_sorpassi_intragara.md')
print('')
print('carico le gare (dry-check per ciascuna)...')

GARE = []
for cid, stag, p in gare_disponibili():
    P = per_pilota(p)
    f = genera_gara(p)
    n = max((max(l) for l in (list(v) for v in P.values()) if l), default=0)
    eps, _rese, _cens = episodi(P, f['sc'] + f['vsc'], *PRIMARIO)
    GARE.append(dict(cid=cid, stag=stag, n_giri=n, eps=eps))

print(f"gare caricate: {len(GARE)} ({len({g['cid'] for g in GARE})} circuiti, "
      f"{len({g['stag'] for g in GARE})} stagioni) · episodi risolti in totale "
      f"{sum(len(g['eps']) for g in GARE)}")


def esegui(nome, taglio_di, minimo):
    global _grezzi
    per_gara, _grezzi = {}, []
    for g in GARE:
        taglio = taglio_di(g)
        a, b = dividi(g['eps'], taglio)
        if len(a) < minimo or len(b) < minimo:
            continue
        chiave = f"{g['cid']}/{g['stag']}"
        per_gara[chiave] = (indice(a), indice(b))
        _grezzi.append((g['eps'], len(a)))
    if len(per_gara) < MIN_GARE:
        print(f"  {nome:22s} NON ESEGUIBILE — {len(per_gara)} gare ammesse, ne servono {MIN_GARE}")
        return None
    rho, p, nperm, soffitto = nullo_e_soffitto(per_gara, random.Random(SEME), minimo)
    ok = (not math.isnan(rho)) and rho >= SOGLIA_RHO and p < 0.05
    print(f"  {nome:24s} n={len(per_gara):3d}   ρ = {rho:+.3f}   nullo p = {p:.4f}   "
          f"soffitto ρ = {soffitto:+.3f}   {'PASSA' if ok else 'FALLITO'}")
    return dict(n=len(per_gara), rho=rho, p=p, ok=ok, soffitto=soffitto, per_gara=per_gara)


print('')
print('S1 · LE DUE META\' DELLA STESSA GARA (soglia ρ ≥ 0,40 e nullo p < 0,05)')
print('     «soffitto» = due meta\' A CASO della stessa gara: il massimo ottenibile con questi episodi')
s1 = esegui('meta\' (≥10 per meta\')', lambda g: g['n_giri'] // 2 + g['n_giri'] % 2, MIN_MEZZO)
s1r = esegui('meta\' (≥15, sensibilita\')', lambda g: g['n_giri'] // 2 + g['n_giri'] % 2, MIN_MEZZO_ROBUSTO)

print('')
print('S2 · DA QUALE GIRO IN POI E\' CONOSCIBILE (fino a X contro dopo X)')
s2 = {}
for x in FRAZIONI:
    s2[x] = esegui(f'X = {int(x * 100)}% della gara', lambda g, x=x: max(1, int(round(g['n_giri'] * x))), MIN_MEZZO)

print('')
print('VERDETTI, dai cancelli scritti prima')
if s1 is None:
    print('  S1  NON ESEGUIBILE')
else:
    print(f"  S1  {'PASSA' if s1['ok'] else 'FALLITO'}")
passa2 = [x for x, r in s2.items() if r and r['ok']]
print(f"  S2  {'PASSA a X = ' + ', '.join(str(int(x * 100)) + '%' for x in passa2) if passa2 else 'FALLITO a ogni X ≤ 60%'}")

# il 2026 SEPARATO, mai fuso col resto: quelle gare non hanno il DRS (prereg §paletti)
if s1:
    d2026 = {k: v for k, v in s1['per_gara'].items() if k.endswith('/2026')}
    altre = {k: v for k, v in s1['per_gara'].items() if not k.endswith('/2026')}
    print('')
    print('IL 2026 A PARTE (senza DRS: non si fonde col resto)')
    print(f"  gare 2026 ammesse a S1: {len(d2026)} · gare 2023-2025: {len(altre)}")
    if len(altre) >= 3:
        r = spearman([p for p, _ in altre.values()], [t for _, t in altre.values()])
        print(f"  ρ sulle sole 2023-2025: {r:+.3f}")
    for k, (a, b) in sorted(d2026.items()):
        print(f"    {k:22s} presto {a:5.1f}%   tardi {b:5.1f}%   scarto {b - a:+6.1f}")
