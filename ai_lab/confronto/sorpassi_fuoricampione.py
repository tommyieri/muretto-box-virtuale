"""sorpassi_fuoricampione.py — il verdetto su 78 gare che nessuno di noi ha mai visto.

    python3 ai_lab/confronto/sorpassi_fuoricampione.py

Perimetro, scelte, soglie e condizione di non eseguibilita' stanno in
ai_lab/confronto/PREREG_sorpassi_fuoricampione.md, committata PRIMA che questo file
esistesse (commit 7a5f423). Qui non si decide niente: si esegue.

IL FUORI CAMPIONE. Tutta questa linea di lavoro legge data/ti_archive/ (2023-2026).
simulatore/data/fondo/ contiene 2018-2025 e non e' MAI stato aperto da
gen_difficolta_sorpasso.py. Le stagioni 2018-2022 sono percio' materiale mai visto:
78 gare asciutte dopo il dry-check.

IL PORTING E' UNA SCOMPATTAZIONE, NON UNA RISCRITTURA. I file del fondo sono lo stesso
JSON colonnare, gzippato, con le stesse otto colonne che servono. Quindi per_pilota(),
genera_gara(), valuta() ed episodi() girano INVARIATE su un file scompattato. Nessun
secondo proprietario di nessuna definizione (regola 1). Il cancello F0 lo verifica
sulle 59 gare che i due archivi hanno in comune: se il porting non riproduce
l'archivio noto, tutto il resto misura la scompattazione e non il fenomeno.

NON SCRIVE NIENTE su disco (solo file temporanei, rimossi).
"""
import gzip
import json
import math
import os
import random
import sys
import tempfile

sys.path.insert(0, os.getcwd())
from gen_difficolta_sorpasso import (  # noqa: E402
    PRIMARIO, episodi, gare_disponibili, genera_gara, per_pilota, valuta,
)
sys.path.insert(0, os.path.join(os.getcwd(), 'ai_lab', 'confronto'))
from sorpassi_intragara import spearman  # noqa: E402  la stessa, verificata contro scipy

# ── le tre scelte dichiarate nella prereg, e le soglie invariate ─────────────
PRIMO_GIRO = 5          # il giro 4 e' escluso: artefatto del dedup, non della pista
MIN_PARTE = 3           # episodi risolti richiesti in ciascuna parte
MIN_GARE = 8            # sotto, NON ESEGUIBILE
SOGLIA_RHO = 0.40
PERMUTAZIONI = 20000
FRAZIONI = (0.20, 0.30, 0.40, 0.50, 0.60)
SEME = 20260802

FONDO = os.path.join('simulatore', 'data', 'fondo')
FUORI = ('2018', '2019', '2020', '2021', '2022')
DENTRO = ('2023', '2024', '2025')
NECESSARIE = {'lap', 'drv', 'sesT', 'pin', 'pout', 'life', 'compound', 'status'}


def carica_gz(percorso):
    """Scompatta e passa il file alle funzioni ratificate, che restano invariate.

    Restituisce None se il file e' mutilato (le 6 gare 2019 a 3 colonne) o non asciutto:
    e' un'esclusione per DATO MANCANTE o per il dry-check gia' ratificato, mai per esito.
    """
    d = json.loads(gzip.open(percorso, 'rt').read())
    if NECESSARIE - set(d):
        return None, 'mutilata'
    if valuta(d, 'Race')['esito'] != 'OK':
        return None, 'non_asciutta'
    f = tempfile.NamedTemporaryFile('w', suffix='.json', delete=False)
    try:
        json.dump(d, f)
        f.close()
        P = per_pilota(f.name)
        fin = genera_gara(f.name)
        n = max((max(v) for v in (list(x) for x in P.values()) if v), default=0)
        eps, _rese, _cens = episodi(P, fin['sc'] + fin['vsc'], *PRIMARIO)
        return dict(n_giri=n, eps=eps), 'ok'
    finally:
        try:
            os.unlink(f.name)
        except OSError:
            pass


def raccogli(anni):
    fuori, scarti = [], {'mutilata': 0, 'non_asciutta': 0}
    for anno in anni:
        base = os.path.join(FONDO, anno)
        if not os.path.isdir(base):
            continue
        for gara in sorted(os.listdir(base)):
            p = os.path.join(base, gara, 'Race.json.gz')
            if not os.path.exists(p):
                continue
            g, motivo = carica_gz(p)
            if g is None:
                scarti[motivo] += 1
                continue
            fuori.append(dict(chiave=f'{gara}/{anno}', anno=anno, **g))
    return fuori, scarti


def statistica(gare, taglio_di, minimo=MIN_PARTE, primo=PRIMO_GIRO):
    xs, ys, ammesse = [], [], []
    for g in gare:
        e = [x for x in g['eps'] if x[1] >= primo]
        t = taglio_di(g)
        a = [x for x in e if x[1] <= t]
        b = [x for x in e if x[1] > t]
        if len(a) < minimo or len(b) < minimo:
            continue
        xs.append(100.0 * sum(1 for q, _ in a if q == 'conv') / len(a))
        ys.append(100.0 * sum(1 for q, _ in b if q == 'conv') / len(b))
        ammesse.append(g['chiave'])
    if len(xs) < MIN_GARE:
        return dict(n=len(xs), rho=None, p=None, eseguibile=False, ammesse=ammesse)
    rho = spearman(xs, ys)
    rng = random.Random(SEME)
    fuori = 0
    for _ in range(PERMUTAZIONI):
        m = list(ys)
        rng.shuffle(m)
        r = spearman(xs, m)
        if not math.isnan(r) and r >= rho:
            fuori += 1
    p = (fuori + 1) / (PERMUTAZIONI + 1)
    return dict(n=len(xs), rho=rho, p=p, eseguibile=True, ammesse=ammesse,
                ok=(not math.isnan(rho)) and rho >= SOGLIA_RHO and p < 0.05)


META = lambda g: g['n_giri'] // 2 + g['n_giri'] % 2   # noqa: E731


def riga(nome, r):
    if not r['eseguibile']:
        return f"  {nome:26s} NON ESEGUIBILE — {r['n']} gare ammesse, ne servono {MIN_GARE}"
    return (f"  {nome:26s} n={r['n']:3d}   ρ = {r['rho']:+.3f}   nullo p = {r['p']:.4f}   "
            f"{'PASSA' if r['ok'] else 'fallito'}")


print('IL FUORI CAMPIONE — 78 gare che questa linea di lavoro non ha mai aperto')
print('  prereg: ai_lab/confronto/PREREG_sorpassi_fuoricampione.md (commit 7a5f423, ANTERIORE a questo file)')
print(f'  scelte dichiarate: Spearman · ammissione ≥{MIN_PARTE} per parte · giro 4 escluso (L ≥ {PRIMO_GIRO})')
print(f'  soglie invariate:  ρ ≥ {SOGLIA_RHO} e nullo p < 0,05')
print('')

# ── F0 · il porting riproduce l'archivio gia' usato? (diritto di veto) ───────
print('F0 · INTEGRITÀ DEL PORTING (59 gare che i due archivi hanno in comune)')
noti = {}
for cid, stag, p in gare_disponibili():
    if stag in DENTRO:
        P = per_pilota(p)
        fin = genera_gara(p)
        n = max((max(v) for v in (list(x) for x in P.values()) if v), default=0)
        eps, _, _ = episodi(P, fin['sc'] + fin['vsc'], *PRIMARIO)
        noti[f'{cid}/{stag}'] = (n, eps)

comune, identiche, diverse = [], 0, []
for anno in DENTRO:
    base = os.path.join(FONDO, anno)
    if not os.path.isdir(base):
        continue
    for gara in sorted(os.listdir(base)):
        p = os.path.join(base, gara, 'Race.json.gz')
        if not os.path.exists(p):
            continue
        g, motivo = carica_gz(p)
        if g is None:
            continue
        comune.append(dict(chiave=f'{gara}/{anno}', anno=anno, **g))

# l'accoppiamento fra i due archivi passa per il NOME del Gran Premio, non per il cid:
# il fondo usa 'Italian_Grand_Prix', ti_archive il cid 'monza'. Si confronta quindi la
# DISTRIBUZIONE degli episodi, non gara per gara, piu' la statistica finale.
tot_gz = sum(len(g['eps']) for g in comune)
tot_ti = sum(len(e) for _, e in noti.values())
conv_gz = sum(1 for g in comune for q, _ in g['eps'] if q == 'conv')
conv_ti = sum(1 for _, e in noti.values() for q, _ in e if q == 'conv')
print(f'  gare: gz {len(comune)} · ti_archive {len(noti)}')
print(f'  episodi risolti: gz {tot_gz} · ti_archive {tot_ti}   (scarto {abs(tot_gz - tot_ti)})')
print(f'  conversioni:     gz {conv_gz} · ti_archive {conv_ti}')

dentro_gz = statistica(comune, META)
dentro_ti = statistica([dict(chiave=k, n_giri=n, eps=e) for k, (n, e) in noti.items()], META)
scarto_rho = (abs(dentro_gz['rho'] - dentro_ti['rho'])
              if dentro_gz['rho'] is not None and dentro_ti['rho'] is not None else float('nan'))
print(f"  ρ dalle due strade: gz {dentro_gz['rho']:+.3f} (n={dentro_gz['n']}) · "
      f"ti_archive {dentro_ti['rho']:+.3f} (n={dentro_ti['n']})   scarto {scarto_rho:.4f}")
quota = min(tot_gz, tot_ti) / max(tot_gz, tot_ti) if max(tot_gz, tot_ti) else 0
f0 = quota >= 0.95 and scarto_rho <= 0.02
print(f"  F0 {'PASSA' if f0 else 'FALLITO'} — accordo sugli episodi {quota * 100:.1f}% (soglia 95%), "
      f"scarto ρ {scarto_rho:.4f} (soglia 0,02)")

if not f0:
    print('')
    print('  F0 HA DIRITTO DI VETO: il porting non riproduce l\'archivio noto.')
    print("  Tutto cio' che verrebbe dopo misurerebbe la scompattazione, non il fenomeno.")
    print('  NON SI CONCLUDE NIENTE.')
    sys.exit(0)

# ── il fuori campione ────────────────────────────────────────────────────────
print('')
print('carico il fuori campione 2018-2022 (mai aperto da questa linea)...')
oos, scarti = raccogli(FUORI)
print(f"  gare asciutte utilizzabili: {len(oos)} "
      f"(scartate: {scarti['mutilata']} mutilate, {scarti['non_asciutta']} non asciutte)")
for a in FUORI:
    q = [g for g in oos if g['anno'] == a]
    print(f"    {a}: {len(q):2d} gare · {sum(len(g['eps']) for g in q):4d} episodi risolti")

print('')
print('F1 · IL VERDETTO, FUORI CAMPIONE (prima metà contro seconda)')
f1 = statistica(oos, META)
print(riga('2018-2022', f1))
senza2020 = statistica([g for g in oos if g['anno'] != '2020'], META)
print(riga('senza 2020 (sensibilità)', senza2020))
for a in FUORI:
    r = statistica([g for g in oos if g['anno'] == a], META)
    print(riga(f'  solo {a}', r))

print('')
print('F2 · LA DOMANDA DEL PRODOTTO, FUORI CAMPIONE (fino a X contro dopo X)')
f2 = {}
for x in FRAZIONI:
    f2[x] = statistica(oos, lambda g, x=x: max(1, int(round(g['n_giri'] * x))))
    atteso = ' (previsto fallito dalla prereg)' if x <= 0.40 else ''
    print(riga(f'X = {int(x * 100)}% della gara', f2[x]) + atteso)

print('')
print('DENTRO CAMPIONE, per completezza — NON CONTA COME PROVA (gia\' visto)')
print(riga('2023-2025', dentro_ti))

print('')
print('VERDETTI, dai cancelli della prereg')
print(f"  F0  {'PASSA' if f0 else 'FALLITO'}")
print(f"  F1  {'PASSA' if f1.get('ok') else 'FALLITO' if f1['eseguibile'] else 'NON ESEGUIBILE'}")
pass2 = [x for x in (0.50, 0.60) if f2[x].get('ok')]
print(f"  F2  {'PASSA a X = ' + ', '.join(str(int(x * 100)) + '%' for x in pass2) if pass2 else 'FALLITO'}")
print('')
if f1.get('ok'):
    print('  → la proprietà è stabilita su gare mai viste. Prossimo passo dichiarato in prereg:')
    print('    Cancello B di banco/prereg/PREREG_difesa_II.md, riscrivendone prima la linea di base.')
else:
    print('  → il ramo si chiude. La prereg dichiara: nessun quarto tentativo su questa metrica.')
