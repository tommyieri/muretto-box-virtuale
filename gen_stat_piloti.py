"""gen_stat_piloti.py — GENERATORE di demo/data/stat/piloti_2026.json (i due moduli «compagni»).

COS'E' E PERCHE' ESISTE. Su una stagione di undici gare un «voto ai piloti» non e'
identificabile: quello che si misura e' la vettura piu' la mano, e la vettura pesa un ordine
di grandezza di piu'. L'unico confronto in cui la vettura e' costante e' quello fra COMPAGNI DI
SQUADRA: stessa monoposto, stessa galleria del vento, stessa strategia di sviluppo, cambia la
mano. Non e' un voto — e' il sostituto onesto di un voto, ed e' l'unica cosa che i dati di una
stagione corta reggano.

Due moduli, due sessioni diverse, due regole diverse. Nessuno dei due si riassume in un numero
solo, e il file rifiuta di provarci.

MODULO 1 — COMPAGNI IN QUALIFICA (f1db races-qualifying-results)
  LA REGOLA: si confronta l'ULTIMO SEGMENTO in cui ENTRAMBI hanno un tempo valido. Q3 se
  q3Millis c'e' per tutti e due; altrimenti Q2; altrimenti Q1. Se non c'e' nessun segmento in
  comune quella sessione NON produce un confronto, e finisce nell'elenco delle cadute col nome
  e il motivo.
  PERCHE' LA REGOLA E' QUESTA: confrontare il Q3 di uno col Q1 dell'altro e' l'errore piu'
  diffuso del settore, e non e' un errore neutro — gonfia SEMPRE nella stessa direzione, a
  favore di chi arriva piu' avanti, perche' i tempi di Q3 sono piu' veloci di quelli di Q1 per
  costruzione (pista in evoluzione, gomma nuova, meno benzina). Un confronto che sbaglia sempre
  dalla stessa parte non e' rumore: e' un bias.
  IL CAMPO `time` NON SI USA: nelle righe 2026 e' vuoto in tutte. I millesimi stanno in
  q1Millis/q2Millis/q3Millis.

MODULO 2 — COMPAGNI IN GARA (f1db races-race-results + demo/data/ufficiali_2026.json)
  DUE COLONNE DICHIARATE, mai una sola:
    (a) tutte le gare        — chi e' arrivato davanti; il ritiro conta come sconfitta;
    (b) entrambi classificati — solo le gare in cui tutti e due hanno un arrivo classificato.
  E l'elenco NOMINALE delle gare che cadono fra (a) e (b), col motivo di ciascuna.
  IL BIAS, dichiarato e non eliminato: il filtro «solo classificati» non toglie solo la
  sfortuna, toglie anche gli incidenti CAUSATI dal pilota. Ripulisce cioe' a favore di chi
  sbaglia. La colonna (b) e' piu' pulita sulla vettura e piu' generosa sull'errore; la (a) e'
  il contrario. Si pubblicano tutte e due, accanto, e chi legge sa che cosa sta guardando.

L'ARBITRO DEI RISULTATI e' demo/data/ufficiali_2026.json (classifica FIA riportata da FastF1),
non f1db: e' la decisione che il progetto ha gia' preso altrove. Da f1db viene chi guidava per
chi (l'accoppiamento), dagli ufficiali viene chi era davanti e chi era classificato. Dove i due
non concordano, la divergenza si REGISTRA per-coppia: non si sceglie in silenzio.

LE COPPIE SI DERIVANO DAI DATI, mai scritte a mano: la chiave e' (constructorId, i due
driverId di quel round). Se in una stagione un team cambia pilota, escono DUE duo distinti per
lo stesso constructorId, ciascuno col suo perimetro di gare — che e' l'unico modo di non
sommare mele e pere. Nel 2026 letto qui i duo sono 11 su 11 costruttori: nessun cambio.

FONTE ORFANA, no. data/driver_profile_2026.csv contiene gia' un delta fra compagni e una
colonna `significativo`, e NON viene aperto qui nemmeno per confronto: e' senza generatore e
senza metodo scritto, e per la legge di casa un file cosi' e' un debito, non una fonte.

Uso:
  python3 gen_stat_piloti.py                  # scrive demo/data/stat/piloti_2026.json
  python3 gen_stat_piloti.py --check          # rigenera, confronta, NON scrive
  python3 gen_stat_piloti.py [--zip <path>] [--release vX] [--anno 2026]
"""
import argparse
import datetime
import hashlib
import json
import os
import re
import statistics
import sys
import zipfile

import f1db_zip

ROOT = os.path.dirname(os.path.abspath(__file__))
STAT = os.path.join(ROOT, 'demo', 'data', 'stat')
SCHEMA = 1
ANNO = 2026
ANNO_PERCHE = ("il file e' l'artefatto della stagione in corso del sito (demo/data/*_2026): "
               "l'anno e' il soggetto, non un risultato. Tutto il resto del perimetro — quali "
               "gare, quali coppie, quali sessioni cadono — e' contato dai dati.")
UFFICIALI = os.path.join(ROOT, 'demo', 'data', 'ufficiali_2026.json')
CALENDARIO = os.path.join(ROOT, 'demo', 'data', 'calendario_2026.json')
SEGMENTI = ('q3', 'q2', 'q1')                 # dall'ultimo al primo: l'ordine E' la regola
_RE_RELEASE = re.compile(r'^f1db-csv-(v[0-9][0-9A-Za-z.\-]*)\.zip$')


# --------------------------------------------------------------------- release e provenienza
# (stesse funzioni di gen_stat_confronti.py: stessa cache, stesso ripiego, stesse parole)
def _ordine_versione(rel):
    pezzi = re.findall(r'\d+', rel or '')
    return tuple(int(p) for p in pezzi) or (0,)


def release_in_cache():
    try:
        nomi = os.listdir(f1db_zip.CACHE_DIR)
    except OSError:
        return []
    trovate = [m.group(1) for m in (_RE_RELEASE.match(n) for n in nomi) if m]
    return sorted(trovate, key=_ordine_versione)


def apri_release(release, zip_esplicito):
    """(ZipFile, release_letta, come) — non dichiara mai una release da cui non ha letto."""
    if zip_esplicito:
        letta = None
        m = _RE_RELEASE.match(os.path.basename(zip_esplicito))
        if m:
            letta = m.group(1)
        else:
            print(f'ATTENZIONE: dal nome di {os.path.basename(zip_esplicito)} non si deduce '
                  f'la release: f1db_release_letta restera\' null.')
        return zipfile.ZipFile(zip_esplicito), letta, 'zip esplicito (--zip)'
    dest = f1db_zip.percorso_zip(release)
    if os.path.exists(dest):
        return zipfile.ZipFile(dest), release, 'cache'
    try:
        zf = f1db_zip.apri(release)
        return zf, release, 'scaricata'
    except Exception as e:
        disponibili = release_in_cache()
        if not disponibili:
            sys.exit(f'STOP: release {release} non in cache ({dest}), scaricamento fallito '
                     f'({type(e).__name__}: {e}) e la cache {f1db_zip.CACHE_DIR} e\' vuota. '
                     f'Niente da leggere: non invento una fonte.')
        ripiego = disponibili[-1]
        print(f'ATTENZIONE: release pinnata {release} NON disponibile ({type(e).__name__}: {e}). '
              f'Ripiego sulla piu\' recente in cache: {ripiego}. Il file lo dichiara in '
              f'provenienza.f1db_release_letta — la pinnata resta in f1db_release_pinnata.')
        return zipfile.ZipFile(f1db_zip.percorso_zip(ripiego)), ripiego, 'ripiego dalla cache'


def sha256_12(path):
    if not path or not os.path.exists(path):
        return None
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for blocco in iter(lambda: f.read(1 << 20), b''):
            h.update(blocco)
    return h.hexdigest()[:12]


# ------------------------------------------------------------------------------- statistica
def quartili(xs):
    """(mediano, medio, [Q1, Q3]) — percentili lineari (statistics.quantiles 'inclusive',
    la stessa definizione di numpy.percentile). Con meno di due valori l'IQR non esiste e
    vale null: un intervallo interquartile su un dato solo sarebbe una finzione."""
    if not xs:
        return None, None, None
    mediano = statistics.median(xs)
    medio = round(sum(xs) / len(xs), 1)
    if len(xs) < 2:
        return mediano, medio, None
    q1, _, q3 = statistics.quantiles(xs, n=4, method='inclusive')
    return mediano, medio, [round(q1, 1), round(q3, 1)]


def _mm(ms):
    """1:18.518 da 78518 — il tempo leggibile accanto ai millesimi, mai al posto loro."""
    if ms is None:
        return None
    m, resto = divmod(int(ms), 60000)
    return f'{m}:{resto // 1000:02d}.{resto % 1000:03d}'


# ------------------------------------------------------------------------------- il calcolo
def duo_per_round(righe_gara, righe_quali):
    """(constructorId, round) -> tuple ordinata dei driverId. L'accoppiamento viene
    dall'UNIONE di gara e qualifica: in Australia 2026 tre piloti (STR, VER, SAI) non hanno
    riga in qualifica ma hanno corso — la coppia esiste, e' il confronto in qualifica che
    manca, e la differenza fra le due cose e' esattamente quello che il file deve dire."""
    per = {}
    for r in list(righe_gara) + list(righe_quali):
        per.setdefault((r['constructorId'], int(r['round'])), set()).add(r['driverId'])
    return per


def confronto_quali(a, b, riga_a, riga_b):
    """(segmento, ms_a, ms_b) sull'ULTIMO segmento comune, oppure (None, motivo, None)."""
    if riga_a is None or riga_b is None:
        manca = [x for x, r in ((a, riga_a), (b, riga_b)) if r is None]
        return None, f'nessuna riga in qualifica per {", ".join(manca)}', None
    for seg in SEGMENTI:
        ma, mb = riga_a[seg + 'Millis'], riga_b[seg + 'Millis']
        if ma and mb:
            return seg, int(ma), int(mb)
    def spinto(r):
        fatti = [s.upper() for s in reversed(SEGMENTI) if r[s + 'Millis']]
        return f'{r["driverId"]} arriva a {fatti[-1]}' if fatti else f'{r["driverId"]} senza tempi'
    return None, f'nessun segmento in comune ({spinto(riga_a)}, {spinto(riga_b)})', None


def costruisci(args):
    zf, release_letta, come = apri_release(args.release, args.zip)
    percorso = getattr(zf, 'filename', None)
    anno = str(args.anno)

    rr = [r for r in f1db_zip.tabella(zf, 'races-race-results') if r['year'] == anno]
    qq = [r for r in f1db_zip.tabella(zf, 'races-qualifying-results') if r['year'] == anno]
    if not rr and not qq:
        sys.exit(f'STOP: nella release {release_letta} non c\'e\' nessun risultato {anno}. '
                 f'Niente da contare: non invento una stagione.')
    races = {int(r['round']): r for r in f1db_zip.tabella(zf, 'races') if r['year'] == anno}
    gp = {g['id']: g['name'] for g in f1db_zip.tabella(zf, 'grands-prix')}
    drivers = {d['id']: d for d in f1db_zip.tabella(zf, 'drivers')}
    constructors = {c['id']: c['name'] for c in f1db_zip.tabella(zf, 'constructors')}

    ufficiali = json.load(open(UFFICIALI, encoding='utf-8'))
    calendario = json.load(open(CALENDARIO, encoding='utf-8'))
    # ponte round -> nome italiano della gara: e' la chiave con cui ufficiali_2026.json e' fatto.
    nome_it = {g['round']: (g.get('gara_demo') or g.get('nome')) for g in calendario['gare']}
    etichetta = {g['round']: g.get('nome') for g in calendario['gare']}

    # ---- PERIMETRO, contato: i round che hanno risultati, non quelli del calendario -------
    round_gara = sorted({int(r['round']) for r in rr})
    round_quali = sorted({int(r['round']) for r in qq})
    round_perimetro = sorted(set(round_gara) | set(round_quali))

    def nome_di(rd):
        """Il nome italiano del calendario del sito; se manca, quello inglese di f1db."""
        if etichetta.get(rd):
            return etichetta[rd]
        if rd in races:
            return gp.get(races[rd]['grandPrixId'], f'round {rd}')
        return f'round {rd}'

    gare = []
    for rd in round_perimetro:
        chiave = nome_it.get(rd)
        gare.append({
            'round': rd,
            'gara': nome_di(rd),
            'data': races[rd]['date'] if rd in races else None,
            'qualifica_f1db': rd in round_quali,
            'gara_f1db': rd in round_gara,
            'ufficiali_fia': bool(chiave and chiave in ufficiali),
        })

    assenti = []
    for rd in sorted(races):
        if rd in round_perimetro:
            continue
        assenti.append({'gara': nome_di(rd),
                        'motivo': f'round {rd} in calendario ma senza risultati in '
                                  f'races-race-results / races-qualifying-results della '
                                  f'release letta ({release_letta}): non ancora disputata'})
    for g in gare:
        if not g['ufficiali_fia']:
            assenti.append({'gara': g['gara'],
                            'motivo': f'round {g["round"]} ha risultati f1db ma nessuna voce in '
                                      f'demo/data/ufficiali_2026.json: il modulo GARA la salta '
                                      f'(l\'arbitro dei risultati e\' la classifica FIA, non f1db)'})

    # ---- le coppie, derivate ---------------------------------------------------------------
    per_round = duo_per_round(rr, qq)
    duo = {}                                  # (constructorId, (idA, idB)) -> {round: ...}
    for (cid, rd), piloti in per_round.items():
        if len(piloti) != 2:
            # non e' una coppia: un solo pilota (o tre) in quel round per quel team. Si
            # dichiara e non si confronta — inventare il compagno sarebbe inventare il dato.
            assenti.append({'gara': nome_di(rd),
                            'motivo': f'{cid} al round {rd} ha {len(piloti)} piloti '
                                      f'({", ".join(sorted(piloti))}): nessuna coppia da '
                                      f'confrontare'})
            continue
        duo.setdefault((cid, tuple(sorted(piloti))), []).append(rd)

    q_index = {(int(r['round']), r['driverId']): r for r in qq}
    r_index = {(int(r['round']), r['driverId']): r for r in rr}

    coppie_quali, coppie_gara = [], []
    for (cid, (a, b)), rounds in sorted(duo.items()):
        rounds = sorted(rounds)
        sigla = {p: drivers[p]['abbreviation'] for p in (a, b)}
        piloti = [{'driverId': p, 'sigla': sigla[p], 'nome': drivers[p]['name']} for p in (a, b)]
        verso = (f'delta_ms = tempo({sigla[a]}) - tempo({sigla[b]}); negativo = {sigla[a]} '
                 f'piu\' veloce')

        # ------------------------------------------------------------------ MODULO 1: quali
        dett, cadute, deltas, vinti = [], [], [], {a: 0, b: 0}
        pari, per_segmento = 0, {}
        for rd in rounds:
            ra, rb = q_index.get((rd, a)), q_index.get((rd, b))
            seg, ma, mb = confronto_quali(sigla[a], sigla[b], ra, rb)
            if seg is None:
                cadute.append({'round': rd, 'gara': nome_di(rd), 'motivo': ma})
                continue
            d = ma - mb
            deltas.append(d)
            if d < 0:
                vinti[a] += 1
            elif d > 0:
                vinti[b] += 1
            else:
                pari += 1
            per_segmento.setdefault(seg, []).append(d)
            dett.append({'round': rd, 'gara': nome_di(rd), 'segmento': seg.upper(),
                         'tempo_a_ms': ma, 'tempo_b_ms': mb,
                         'tempo_a': _mm(ma), 'tempo_b': _mm(mb),
                         'delta_ms': d,
                         'davanti': sigla[a] if d < 0 else (sigla[b] if d > 0 else None)})
        med, mean, iqr = quartili(deltas)
        if len(dett) + len(cadute) != len(rounds):          # quadratura: non si pubblica se non torna
            sys.exit(f'STOP quadratura quali {cid}: {len(dett)}+{len(cadute)} != {len(rounds)}')
        coppie_quali.append({
            'constructorId': cid, 'team': constructors.get(cid, cid),
            'piloti': piloti, 'verso': verso,
            'gare_del_duo': len(rounds),
            'n': len(dett),
            'duelli': {sigla[a]: vinti[a], sigla[b]: vinti[b]}, 'pari': pari,
            'delta_ms': {'mediano': med, 'medio': mean, 'iqr': iqr,
                         'min': min(deltas) if deltas else None,
                         'max': max(deltas) if deltas else None},
            'per_segmento': {s.upper(): {'n': len(v), 'mediano_ms': statistics.median(v)}
                             for s, v in sorted(per_segmento.items())},
            'segmenti_usati': {s.upper(): len(v) for s, v in sorted(per_segmento.items())},
            'sessioni_cadute': cadute,
            'gare': dett,
        })

        # ------------------------------------------------------------------- MODULO 2: gara
        dett, cadute_a, cadute_ab = [], [], []
        tutte = {a: 0, b: 0}
        classificati = {a: 0, b: 0}
        n_a = n_b = pari_a = entrambi_ritirati = 0
        divergenze = []
        for rd in rounds:
            if rd not in round_gara:
                cadute_a.append({'round': rd, 'gara': nome_di(rd),
                                 'motivo': 'nessun risultato di gara nella release letta '
                                           '(round presente solo in qualifica)'})
                continue
            chiave = nome_it.get(rd)
            uff = ufficiali.get(chiave, {}).get('classifica') if chiave else None
            if not uff:
                cadute_a.append({'round': rd, 'gara': nome_di(rd),
                                 'motivo': 'gara assente da demo/data/ufficiali_2026.json '
                                           '(l\'arbitro dei risultati): nessun confronto'})
                continue
            riga = {v['pilota']: v for v in uff}
            va, vb = riga.get(sigla[a]), riga.get(sigla[b])
            if va is None or vb is None:
                manca = [s for s, v in ((sigla[a], va), (sigla[b], vb)) if v is None]
                cadute_a.append({'round': rd, 'gara': nome_di(rd),
                                 'motivo': f'{", ".join(manca)} non compare nella classifica '
                                           f'ufficiale di questa gara'})
                continue
            n_a += 1
            davanti = sigla[a] if va['pos'] < vb['pos'] else sigla[b]
            tutte[a if va['pos'] < vb['pos'] else b] += 1
            if not va['classificato'] and not vb['classificato']:
                entrambi_ritirati += 1
            entrambi = bool(va['classificato'] and vb['classificato'])
            if entrambi:
                n_b += 1
                classificati[a if va['pos'] < vb['pos'] else b] += 1
            else:
                fuori = [f'{s} {v["status"]}' for s, v in ((sigla[a], va), (sigla[b], vb))
                         if not v['classificato']]
                cadute_ab.append({'round': rd, 'gara': nome_di(rd),
                                  'motivo': f'non classificato: {"; ".join(fuori)}'})
            # cross-check: f1db direbbe lo stesso? La divergenza si registra, non si sceglie.
            fa, fb = r_index.get((rd, a)), r_index.get((rd, b))
            if fa and fb:
                oa, ob = int(fa['positionDisplayOrder']), int(fb['positionDisplayOrder'])
                if (oa < ob) != (va['pos'] < vb['pos']):
                    divergenze.append({'round': rd, 'gara': nome_di(rd),
                                       'davanti_ufficiali': davanti,
                                       'davanti_f1db': sigla[a] if oa < ob else sigla[b]})
            dett.append({'round': rd, 'gara': nome_di(rd),
                         'pos_a': va['pos'], 'pos_b': vb['pos'],
                         'stato_a': va['status'], 'stato_b': vb['status'],
                         'classificato_a': va['classificato'],
                         'classificato_b': vb['classificato'],
                         'davanti': davanti, 'in_entrambi_classificati': entrambi})
        gare_gara = [rd for rd in rounds if rd in round_gara]
        if n_a + len(cadute_a) != len(rounds) or n_b + len(cadute_ab) != n_a:
            sys.exit(f'STOP quadratura gara {cid}: (a) {n_a}+{len(cadute_a)} != {len(rounds)} '
                     f'oppure (b) {n_b}+{len(cadute_ab)} != {n_a}')
        coppie_gara.append({
            'constructorId': cid, 'team': constructors.get(cid, cid),
            'piloti': piloti,
            'gare_del_duo': len(rounds), 'gare_con_risultato': len(gare_gara),
            'tutte_le_gare': {'n': n_a, 'duelli': {sigla[a]: tutte[a], sigla[b]: tutte[b]},
                              'entrambi_non_classificati': entrambi_ritirati},
            'entrambi_classificati': {'n': n_b,
                                      'duelli': {sigla[a]: classificati[a],
                                                 sigla[b]: classificati[b]}},
            'cadute_prima_di_a': cadute_a,
            'cadute_fra_a_e_b': cadute_ab,
            'divergenze_f1db_vs_ufficiali': divergenze,
            'gare': dett,
        })

    # ---------------------------------------------------------------------------- l'involucro
    note = [
        f'Perimetro contato dai dati: {len(round_perimetro)} round con risultati nella release '
        f'letta ({release_letta}) su {len(races)} in calendario. Nessun numero di gare e\' '
        f'scritto a mano nel generatore.',
        f'{len(duo)} coppie derivate da (constructorId, i due driverId di quel round). Se un '
        f'team cambiasse pilota uscirebbero due duo distinti per lo stesso constructorId, '
        f'ciascuno col suo perimetro: nella release letta non succede.',
        'QUALIFICA: si confronta l\'ULTIMO SEGMENTO in cui entrambi hanno un tempo valido '
        '(Q3, se no Q2, se no Q1). Confrontare segmenti diversi fra i due compagni gonfia '
        'sistematicamente chi arriva piu\' avanti, perche\' i tempi di Q3 sono piu\' veloci di '
        'quelli di Q1 per costruzione: non e\' rumore, e\' un bias con un verso solo.',
        'QUALIFICA, LIMITE DEL DELTA: il delta e\' DI SEGMENTO. Mediana, media e IQR qui sono '
        'calcolate su una lista che mescola sessioni decise in Q3, Q2 e Q1, e i tre segmenti '
        'non hanno la stessa scala (gomma, benzina, evoluzione della pista). Il delta non si '
        'somma e non si media FRA segmenti diversi: `per_segmento` tiene i tre conti separati, '
        'ed e\' li\' che si guarda quando la coppia ha sessioni in segmenti misti.',
        'QUALIFICA, campo `time`: vuoto in tutte le righe 2026 di f1db, mai usato. I millesimi '
        'vengono da q1Millis/q2Millis/q3Millis.',
        'QUALIFICA, perimetro: solo la qualifica del GP (races-qualifying-results). La '
        'qualifica sprint e\' un\'altra sessione e un\'altra tabella '
        '(races-sprint-qualifying-results): fuori.',
        'GARA, due colonne: (a) tutte le gare, il ritiro conta come sconfitta; '
        '(b) solo le gare in cui entrambi sono classificati. Si pubblicano accanto, mai una '
        'sola. `cadute_fra_a_e_b` elenca per nome le gare che la (b) toglie, con il motivo.',
        'GARA, IL BIAS DELLA COLONNA (b), dichiarato e non eliminato: «solo classificati» non '
        'toglie solo la sfortuna meccanica, toglie anche gli incidenti CAUSATI dal pilota. '
        'Ripulisce cioe\' a favore di chi sbaglia. Nessuna delle due colonne e\' quella giusta: '
        'la (a) punisce la sfortuna, la (b) perdona l\'errore.',
        'GARA, chi e\' davanti lo dice demo/data/ufficiali_2026.json (classifica FIA riportata '
        'da FastF1), che questo progetto ha stabilito essere l\'arbitro dei risultati; '
        'l\'accoppiamento pilota-team lo dice f1db. `classificato` e\' il campo degli '
        'ufficiali, non lo `status`: nella stagione letta ci sono 5 «Retired» classificati e 2 '
        '«Lapped» non classificati, e prendere lo status per il verdetto sbaglierebbe 7 volte.',
        'GARA, entrambi non classificati: il duello lo decide comunque l\'ordine della '
        'classifica FIA (chi e\' andato piu\' lontano). E\' un confronto debole e viene contato '
        'a parte in `entrambi_non_classificati`.',
        'GARA, sprint escluse: il modulo guarda il GP. Gli ufficiali portano anche la sprint '
        'per 4 gare del 2026, e non entra in nessuna delle due colonne.',
        'NON usa data/driver_profile_2026.csv, che pure contiene un delta fra compagni e una '
        'colonna `significativo`: e\' un file senza generatore e senza metodo scritto, quindi '
        'un debito e non una fonte. Non e\' stato aperto nemmeno per confronto.',
    ]
    div_tot = sum(len(c['divergenze_f1db_vs_ufficiali']) for c in coppie_gara)
    note.append(f'Cross-check f1db vs ufficiali FIA su chi era davanti: {div_tot} divergenze '
                f'sui duelli del perimetro. Dove divergono vince l\'arbitro (gli ufficiali) e '
                f'la divergenza resta scritta in `divergenze_f1db_vs_ufficiali`.')
    if release_letta != args.release:
        note.append(f'Release LETTA ({release_letta}) diversa dalla pinnata ({args.release}): '
                    f'i numeri sono quelli della release letta.')

    return {
        '_nota': ('GENERATO da gen_stat_piloti.py (i due moduli «compagni di squadra»: '
                  'qualifica e gara). Non modificare a mano: si rigenera da f1db + '
                  'demo/data/ufficiali_2026.json.'),
        '_generatore': 'gen_stat_piloti.py',
        'schema': SCHEMA,
        'calcolato_il': datetime.datetime.now(datetime.timezone.utc)
                        .strftime('%Y-%m-%dT%H:%M:%SZ'),
        'provenienza': {
            'f1db_release_pinnata': args.release,
            'f1db_release_letta': release_letta,
            'f1db_fallback_default': getattr(f1db_zip, '_DEFAULT_RELEASE', None),
            'come': come,
            'zip': os.path.basename(percorso) if percorso else None,
            'zip_sha256_12': sha256_12(percorso),
            'tabelle': ['races-qualifying-results', 'races-race-results', 'races',
                        'grands-prix', 'drivers', 'constructors'],
            'fonti_locali': [
                {'file': 'demo/data/ufficiali_2026.json', 'sha256_12': sha256_12(UFFICIALI),
                 'ruolo': 'arbitro dei risultati di gara (classifica FIA da FastF1)'},
                {'file': 'demo/data/calendario_2026.json', 'sha256_12': sha256_12(CALENDARIO),
                 'ruolo': 'ponte round -> nome italiano della gara, la chiave degli ufficiali'},
            ],
        },
        'perimetro': {
            'anno': args.anno,
            'anno_perche': ANNO_PERCHE,
            'gare': gare,
            'assenti': assenti,
            'coppie': len(duo),
            'note': note,
        },
        'qualifica': {
            'regola': ('ultimo segmento in cui ENTRAMBI i compagni hanno un tempo valido: Q3 se '
                       'q3Millis c\'e\' per tutti e due, altrimenti Q2, altrimenti Q1. Nessun '
                       'segmento in comune = nessun confronto, e la sessione finisce in '
                       '`sessioni_cadute` col motivo.'),
            'unita': 'millesimi di secondo',
            'coppie': coppie_quali,
        },
        'gara': {
            'regola': {
                'a_tutte_le_gare': 'chi e\' arrivato davanti nella classifica FIA; il ritiro '
                                   'conta come sconfitta',
                'b_entrambi_classificati': 'solo le gare in cui entrambi hanno un arrivo '
                                           'classificato (campo `classificato` degli ufficiali)',
            },
            'bias_dichiarato': ('il filtro «solo classificati» toglie anche gli incidenti '
                                'CAUSATI dal pilota: ripulisce a favore di chi sbaglia. Si '
                                'dichiara, non si elimina — per questo le colonne restano due.'),
            'coppie': coppie_gara,
        },
    }


# ------------------------------------------------------------------------------------- I/O
def testo(dati):
    return json.dumps(dati, ensure_ascii=False, indent=1) + '\n'


def senza_ora(dati):
    """Copia confrontabile: fuori cio' che dipende dall'INVOCAZIONE e non dal contenuto.

    Identica a gen_stat_confronti.senza_ora e per lo stesso motivo: `calcolato_il` cambia
    sempre; `provenienza.come` dice per quale strada lo zip e' stato trovato ('cache' a mano,
    'zip esplicito (--zip)' da aggiorna_stat.py) ed e' la stessa release, quindi gli stessi
    dati. Confrontarlo farebbe fallire --check a ogni cambio di invocazione: un allarme falso
    che a lungo andare insegna a ignorare l'allarme. La release LETTA resta confrontata.
    """
    d = dict(dati)
    d.pop('calcolato_il', None)
    if isinstance(d.get('provenienza'), dict):
        d['provenienza'] = {k: v for k, v in d['provenienza'].items() if k != 'come'}
    return d


def riassunto(dati):
    righe = []
    q = {c['constructorId']: c for c in dati['qualifica']['coppie']}
    g = {c['constructorId']: c for c in dati['gara']['coppie']}
    n_gare = len(dati['perimetro']['gare'])
    for cid in sorted(q):
        cq, cg = q[cid], g[cid]
        sa, sb = [p['sigla'] for p in cq['piloti']]
        dq = cq['duelli']
        dt = cg['tutte_le_gare']['duelli']
        db = cg['entrambi_classificati']['duelli']
        seg = ' '.join(f'{s}:{n}' for s, n in cq['segmenti_usati'].items())
        righe.append(
            f"  {cq['team']:<12} {sa}-{sb}"
            f" · QUALI {dq[sa]}-{dq[sb]} su {cq['n']}/{n_gare}"
            f" (cadute {len(cq['sessioni_cadute'])}; {seg})"
            f" mediana {cq['delta_ms']['mediano']} ms  IQR {cq['delta_ms']['iqr']}"
            f" · GARA tutte {dt[sa]}-{dt[sb]} su {cg['tutte_le_gare']['n']}"
            f" | classificati {db[sa]}-{db[sb]} su {cg['entrambi_classificati']['n']}"
            f" (cadute a->b {len(cg['cadute_fra_a_e_b'])})")
    return '\n'.join(righe)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--zip')
    ap.add_argument('--release', default=f1db_zip.RELEASE)
    ap.add_argument('--anno', type=int, default=ANNO)
    ap.add_argument('--check', action='store_true',
                    help='rigenera e confronta col file su disco, senza scrivere')
    args = ap.parse_args()
    dest = os.path.join(STAT, f'piloti_{args.anno}.json')

    dati = costruisci(args)
    print(f'[stat_piloti] release pinnata {args.release} · letta '
          f'{dati["provenienza"]["f1db_release_letta"]} ({dati["provenienza"]["come"]})')
    print(f'[stat_piloti] perimetro {args.anno}: {len(dati["perimetro"]["gare"])} gare con '
          f'risultati, {dati["perimetro"]["coppie"]} coppie, '
          f'{len(dati["perimetro"]["assenti"])} voci in assenti')
    print(riassunto(dati))

    if args.check:
        if not os.path.exists(dest):
            print(f'[stat_piloti] CHECK FALLITO: {os.path.relpath(dest, ROOT)} non esiste.')
            return 1
        vecchio = json.load(open(dest, encoding='utf-8'))
        if senza_ora(vecchio) == senza_ora(dati):
            print(f'[stat_piloti] CHECK OK: {os.path.relpath(dest, ROOT)} e\' identico al '
                  f'rigenerato (a parte calcolato_il). Nessuna scrittura.')
            return 0
        print('[stat_piloti] CHECK FALLITO: il file su disco NON coincide col rigenerato.')
        for k in sorted(set(vecchio) | set(dati)):
            if senza_ora(vecchio).get(k) != senza_ora(dati).get(k):
                print(f'    diverge: {k}')
        return 1

    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, 'w', encoding='utf-8') as f:
        f.write(testo(dati))
    print(f'[stat_piloti] scritto {os.path.relpath(dest, ROOT)} '
          f'({os.path.getsize(dest)} byte, {dati["perimetro"]["coppie"]} coppie x 2 moduli).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
