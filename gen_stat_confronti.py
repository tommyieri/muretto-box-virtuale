"""gen_stat_confronti.py — GENERATORE di demo/data/stat/confronti.json (modulo C1).

COS'E': «la corsa al titolo, 2018→oggi». Per ogni stagione, per piloti e costruttori
separatamente, la curva del campionato round per round. Serve alla pagina
statistiche-confronti.html, che e' un CONSUMATORE PURO: legge solo demo/data/*.json e non
puo' aprire lo zip f1db ne' data/. Il generatore si'.

FONTE UNICA: le tabelle standings di f1db (races-driver-standings, 21.427 righe dal 1950;
races-constructor-standings, 10.599 righe dal 1958), piu' la tabella races per sapere quanti
round ha il calendario di ogni stagione. I punti NON si ricalcolano qui: sono quelli che f1db
ha gia' deciso, round per round, esattamente come fa gen_classifiche.py per il 2026.

COSA CALCOLA, per ogni stagione e per ogni round:
  vantaggio_leader        punti del 1° meno punti del 2° (in PUNTI: v. l'avvertenza qui sotto)
  vantaggio_leader_quota  lo stesso vantaggio diviso i punti assegnati fino a li' (relativo)
  quota_leader            punti del leader / punti assegnati fino a li'
  entro_20pct             quanti sono a >= 80% dei punti del leader (il leader incluso)
  capoclassifica          chi era in testa dopo quel round (id f1db)
e per ogni stagione: cambi_leader (quante volte il capoclassifica e' cambiato),
titolo_deciso_al_round (primo round con championshipWon = true; null se la stagione e' in
corso), campione, round_totali/round_in_calendario/in_corso.

AVVERTENZA DI UNITA' (il motivo per cui quota_leader esiste): fra ere diverse i punti ASSOLUTI
non si confrontano — cambia il sistema di punteggio, cambia il numero di gare, cambiano i punti
sprint. 25 punti di vantaggio nel 2018 e nel 2026 non sono la stessa cosa. Le grandezze
confrontabili sono quelle relative (quota_leader, vantaggio_leader_quota, entro_20pct); il
vantaggio in punti si pubblica solo ACCANTO alla quota, mai da solo.

DENOMINATORE: «punti assegnati» e' la somma dei punti della TABELLA STESSA a quel round (somma
piloti per i piloti, somma costruttori per i costruttori). Le due somme non sempre coincidono —
nel 2018 differiscono di 59 punti, quelli che la Force India perse come costruttore a meta'
stagione pur restando ai piloti. Mescolarle darebbe una quota falsa.

PERIMETRO DERIVATO (mai cablato): gli anni li conta dai dati (l'ultimo e' il massimo presente
nella tabella; l'unico numero scelto a mano e' l'anno di INIZIO, --da 2018, che e' una scelta
editoriale ed e' dichiarata nel file). I round per anno si contano, non si scrivono.

STAGIONE IN CORSO: dichiarata, non nascosta. Una stagione i cui round con classifica sono meno
dei round in calendario porta in_corso = true e titolo_deciso_al_round = null.

SECONDA SEZIONE, dispersione_quali: «il gruppo e' davvero piu' compatto di cinque anni fa, o
e' un'impressione da titolo?». Vive nello stesso artefatto e non tocca le altre chiavi. Misura
in Q1 (l'unico segmento in cui c'e' TUTTO il campo), in percentuale dal migliore della stessa
sessione (fra ere i secondi non sopravvivono), e solo sui circuiti comuni a tutti gli anni del
perimetro (altrimenti si confronta il cambiamento delle vetture insieme a quello delle piste).
Le regole, i circuiti scelti e i limiti — meteo non distinguibile, 2026 in corso, campo di 22
vetture invece di 20 — stanno scritti dentro la sezione, non solo applicati.

PROVENIENZA: il file dichiara la release PINNATA (data/f1db_release.txt) e, separatamente,
quella davvero LETTA. Non e' pedanteria: se la pinnata non e' in cache e non c'e' rete, il
generatore ripiega sulla release piu' recente disponibile e lo SCRIVE nel file — non dichiara
mai una release da cui non ha letto.

Uso:
  python3 gen_stat_confronti.py                 # scrive demo/data/stat/confronti.json
  python3 gen_stat_confronti.py --check         # rigenera, confronta, NON scrive
  python3 gen_stat_confronti.py [--zip <path>] [--release vX] [--da 2018]
"""
import argparse
import datetime
import hashlib
import json
import os
import re
import sys
import zipfile

import f1db_zip

ROOT = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.join(ROOT, 'demo', 'data', 'stat', 'confronti.json')
SCHEMA = 1
ANNO_INIZIO = 2018
ANNO_INIZIO_PERCHE = ("scelta editoriale del modulo C1: il 2018 e' il primo anno che il sito "
                      "copre altrove (fondo storico, forza-vettura). L'anno di fine NON e' "
                      "scelto: e' il massimo presente negli standings f1db.")
SOGLIA_VICINI = 0.20      # «entro il 20% dei punti del leader»
MIN_CIRCUITI_COMUNI = 3   # v. dispersione_quali(): sotto questa soglia il set comune si rilassa
_RE_RELEASE = re.compile(r'^f1db-csv-(v[0-9][0-9A-Za-z.\-]*)\.zip$')


# --------------------------------------------------------------------- release e provenienza
def _ordine_versione(rel):
    """Chiave d'ordinamento per 'v2026.10.1' -> (2026, 10, 1). Robusta ai formati strani."""
    pezzi = re.findall(r'\d+', rel or '')
    return tuple(int(p) for p in pezzi) or (0,)


def release_in_cache():
    """Le release presenti nella cache condivisa, dalla piu' vecchia alla piu' recente."""
    try:
        nomi = os.listdir(f1db_zip.CACHE_DIR)
    except OSError:
        return []
    trovate = [m.group(1) for m in (_RE_RELEASE.match(n) for n in nomi) if m]
    return sorted(trovate, key=_ordine_versione)


def apri_release(release, zip_esplicito):
    """(ZipFile, release_letta, come) — non dichiara mai una release da cui non ha letto.

    Ordine: --zip esplicito > cache > scaricamento > ripiego sulla release piu' recente in
    cache (rumoroso). Se non c'e' nulla da leggere, si ferma con un messaggio chiaro.
    """
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
    except Exception as e:                                    # rete assente o release inesistente
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


# ------------------------------------------------------------------------------- il calcolo
def _num(x):
    """Punti: intero quando e' intero (evita '25.0' nel JSON), float quando ci sono i mezzi."""
    f = float(x)
    return int(f) if f == int(f) else f


def curva(righe, chiave_id):
    """Da righe standings di UNA stagione alla curva round per round.

    Le righe senza positionNumber (DSQ/EX: f1db le usa davvero, 18 volte dal 1950) sono
    ESCLUSE sia dalla classifica sia dal denominatore, e contate a parte.
    """
    per_round, saltate = {}, 0
    for r in righe:
        if not r['positionNumber']:
            saltate += 1
            continue
        per_round.setdefault(int(r['round']), []).append(r)
    out = {'round': [], 'capoclassifica': [], 'punti_leader': [], 'punti_assegnati': [],
           'vantaggio_leader': [], 'vantaggio_leader_quota': [], 'quota_leader': [],
           'entro_20pct': [], 'classificati': []}
    for rd in sorted(per_round):
        # positionDisplayOrder e' l'ordine che f1db ha gia' deciso (countback incluso):
        # non lo si tocca. Con un pari merito al vertice il vantaggio viene 0, ed e' giusto.
        ordinate = sorted(per_round[rd], key=lambda r: int(r['positionDisplayOrder']))
        punti = [float(r['points']) for r in ordinate]
        totale, primo = sum(punti), punti[0]
        secondo = punti[1] if len(punti) > 1 else 0.0
        vicini = sum(1 for p in punti if p >= primo * (1 - SOGLIA_VICINI) - 1e-9) if primo > 0 else None
        out['round'].append(rd)
        out['capoclassifica'].append(ordinate[0][chiave_id])
        out['punti_leader'].append(_num(primo))
        out['punti_assegnati'].append(_num(totale))
        out['vantaggio_leader'].append(_num(primo - secondo))
        out['vantaggio_leader_quota'].append(round((primo - secondo) / totale, 4) if totale > 0 else None)
        out['quota_leader'].append(round(primo / totale, 4) if totale > 0 else None)
        out['entro_20pct'].append(vicini)
        out['classificati'].append(len(ordinate))
    capi = out['capoclassifica']
    out['cambi_leader'] = sum(1 for i in range(1, len(capi)) if capi[i] != capi[i - 1])
    out['round_totali'] = len(out['round'])
    out['_saltate_senza_positionNumber'] = saltate
    # titolo: primo round in cui f1db alza championshipWon. Nessuno -> stagione in corso.
    vinti = [r for r in righe if r['championshipWon'] == 'true']
    if vinti:
        rd = min(int(r['round']) for r in vinti)
        out['titolo_deciso_al_round'] = rd
        out['campione'] = next(r[chiave_id] for r in vinti if int(r['round']) == rd)
    else:
        out['titolo_deciso_al_round'] = None
        out['campione'] = None
    return out


# ------------------------------------------------------- dispersione delle qualifiche (Q1)
def _percentile(valori, p):
    """Percentile per interpolazione lineare fra le statistiche d'ordine (tipo 7, il default
    di numpy e di R). Scritto a mano per non aggiungere una dipendenza al generatore: il
    METODO va dichiarato perche' con campioni da ~100 valori percentili diversi danno numeri
    diversi, e chi rilegge deve sapere quale."""
    v = sorted(valori)
    n = len(v)
    if n == 0:
        return None
    if n == 1:
        return round(v[0], 3)
    k = (n - 1) * p
    basso = int(k)
    alto = min(basso + 1, n - 1)
    return round(v[basso] + (v[alto] - v[basso]) * (k - basso), 3)


def dispersione_quali(zf, races, da):
    """«Il gruppo e' piu' compatto di cinque anni fa?» — dispersione di Q1, per anno.

    TRE REGOLE, e nessuna e' un dettaglio.

    1. SOLO Q1. E' l'unico segmento in cui e' presente TUTTO il campo. Q2 e Q3 sono
       sottoinsiemi gia' selezionati: la loro dispersione misura la selezione (chi e' passato),
       non il campo. Il campo `time` della tabella e' VUOTO in f1db: si usa q1Millis.

    2. IN PERCENTUALE DAL MIGLIORE della stessa sessione, mai in secondi. Fra ere cambiano
       regolamento, gomme, lunghezza del tracciato e punti di misura: mezzo secondo a Monaco e
       mezzo secondo a Spa non sono la stessa distanza, e nemmeno lo stesso mezzo secondo a
       dieci anni di distanza.

    3. SOLO CIRCUITI COMUNI. Confrontare anni con calendari diversi somma il cambiamento delle
       vetture a quello delle piste. Il set e' quello dei circuiti presenti in TUTTI gli anni
       del perimetro; se venissero meno di MIN_CIRCUITI_COMUNI la soglia si abbassa di un anno
       alla volta finche' non ne bastano, e l'anno richiesto viene DICHIARATO nel JSON.

    Il legame gara -> circuito passa da f1db-races.csv (raceId -> circuitId), mai per assonanza
    di nome: i circuitId sono quelli di f1db.
    """
    quali = f1db_zip.tabella(zf, 'races-qualifying-results')
    per_id = {r['id']: r for r in races}

    anni = sorted({int(r['year']) for r in quali if int(r['year']) >= da})
    if not anni:
        sys.exit(f'STOP: nessuna qualifica dal {da} in races-qualifying-results.')

    # righe per gara, e circuiti che ogni anno ha DAVVERO corso (non quelli in calendario:
    # nel 2026 il calendario ha 22 round e le qualifiche disputate sono 11)
    righe_gara, circuiti_anno = {}, {a: set() for a in anni}
    for r in quali:
        a = int(r['year'])
        if a < da:
            continue
        gara = per_id.get(r['raceId'])
        if gara is None:                       # nessuna gara per quel raceId: non si inventa
            continue
        righe_gara.setdefault(r['raceId'], []).append(r)
        circuiti_anno[a].add(gara['circuitId'])

    presenze = {}                              # circuito -> in quanti anni del perimetro
    for a in anni:
        for c in circuiti_anno[a]:
            presenze[c] = presenze.get(c, 0) + 1

    # il set comune, DERIVATO: si parte dal requisito piu' forte (tutti gli anni) e si molla
    # di un anno alla volta solo se il set resterebbe troppo sottile per dire qualcosa.
    anni_richiesti = len(anni)
    comuni = sorted(c for c, k in presenze.items() if k >= anni_richiesti)
    while len(comuni) < MIN_CIRCUITI_COMUNI and anni_richiesti > 1:
        anni_richiesti -= 1
        comuni = sorted(c for c, k in presenze.items() if k >= anni_richiesti)
    if not comuni:
        sys.exit('STOP: nessun circuito comune nel perimetro delle qualifiche. '
                 'Senza circuiti comuni il confronto fra anni mescola vetture e piste: '
                 'non pubblico un numero che non significa quello che dice.')
    insieme_comuni = set(comuni)

    # ------------------------------------------------------------------ il calcolo, per gara
    calendario = {}
    for r in races:
        a = int(r['year'])
        if a in anni:
            calendario[a] = max(calendario.get(a, 0), int(r['round']))

    per_anno = {a: {'valori': [], 'piloti': set(), 'gare': 0, 'senza_q1': 0,
                    'gare_senza_q1': 0, 'circuiti': {}} for a in anni}
    campo_min, campo_min_da = None, None
    for race_id, righe in righe_gara.items():
        gara = per_id[race_id]
        a, circuito = int(gara['year']), gara['circuitId']
        if circuito not in insieme_comuni:
            continue
        acc = per_anno[a]
        millis = []
        for r in righe:
            # senza q1Millis: non ha girato, e' partito dai box, o f1db porta una riga
            # doppia (2023 Silverstone ha Bottas due volte, NC + DSQ, e la DSQ e' vuota).
            # Si salta e SI CONTA: una riga sparita in silenzio e' un dato inventato.
            if not r['q1Millis']:
                acc['senza_q1'] += 1
                continue
            millis.append((int(r['q1Millis']), r['driverId']))
        if not millis:
            acc['gare_senza_q1'] += 1
            continue
        migliore = min(m for m, _ in millis)
        distacchi = sorted(100.0 * (m - migliore) / migliore for m, _ in millis)
        if campo_min is None or len(distacchi) < campo_min:
            campo_min = len(distacchi)
            campo_min_da = {'anno': a, 'round': int(gara['round']), 'circuito': circuito,
                            'n': len(distacchi)}
        acc['valori'].append(distacchi)
        acc['piloti'].update(d for _, d in millis)
        acc['gare'] += 1
        c = acc['circuiti'].setdefault(circuito, {'valori': [], 'gare': []})
        c['valori'] += distacchi
        c['gare'].append({
            'round': int(gara['round']),
            'gara_id': race_id,
            'formato': gara['qualifyingFormat'],
            'n': len(distacchi),
            'mediana_pct': _percentile(distacchi, 0.5),
            'p90_pct': _percentile(distacchi, 0.9),
        })

    # ------------------------------------------------------------------------ per anno, fuori
    fuori = {}
    for a in anni:
        acc = per_anno[a]
        tutti = [x for sessione in acc['valori'] for x in sessione]
        # controllo a CAMPO PARI: i K piu' veloci di ogni sessione, con K = il campo piu'
        # piccolo del perimetro. Serve perche' nel 2026 le vetture sono 22 e negli altri anni
        # 20: le due in piu' stanno in coda e il p90 le sente. Non sostituisce il numero
        # pubblicato — lo affianca, per sapere quanta parte dell'allargamento e' il campo.
        pari = [x for sessione in acc['valori'] for x in sessione[:campo_min]]
        round_con_quali = len({r['raceId'] for r in quali if int(r['year']) == a})
        esclusi = [{'circuito': c,
                    'motivo': f'corso in {presenze[c]} anni del perimetro su {len(anni)}; '
                              f'per il set comune ne servono {anni_richiesti}'}
                   for c in sorted(circuiti_anno[a] - insieme_comuni)]
        esclusi += [{'circuito': c,
                     'motivo': 'nel set comune, ma in questo anno non e\' stato corso '
                               '(il set e\' rilassato: non richiede tutti gli anni)'}
                    for c in comuni if c not in circuiti_anno[a]]
        in_corso = bool(calendario.get(a) and round_con_quali < calendario[a])
        fuori[str(a)] = {
            'mediana_pct': _percentile(tutti, 0.5),
            'p90_pct': _percentile(tutti, 0.9),
            'mediana_pct_campo_pari': _percentile(pari, 0.5),
            'p90_pct_campo_pari': _percentile(pari, 0.9),
            'n_piloti': len(acc['piloti']),
            'n_gare': acc['gare'],
            'n_osservazioni': len(tutti),
            'righe_senza_q1': acc['senza_q1'],
            'gare_senza_nessun_q1': acc['gare_senza_q1'],
            'stagione_in_corso': in_corso,
            'round_con_qualifica': round_con_quali,
            'round_in_calendario': calendario.get(a),
            'circuiti_usati': sorted(acc['circuiti']),
            'circuiti_esclusi': esclusi,
            'per_circuito': {
                c: {'n_gare': len(d['gare']),
                    'n_osservazioni': len(d['valori']),
                    'mediana_pct': _percentile(d['valori'], 0.5),
                    'p90_pct': _percentile(d['valori'], 0.9),
                    'gare': sorted(d['gare'], key=lambda g: g['round'])}
                for c, d in sorted(acc['circuiti'].items())
            },
        }

    citati = set(comuni) | {e['circuito'] for a in fuori.values() for e in a['circuiti_esclusi']}
    nomi = {c['id']: c['name'] for c in f1db_zip.tabella(zf, 'circuits') if c['id'] in citati}

    senza_q1 = sum(a['righe_senza_q1'] for a in fuori.values())
    aperte = [a for a, d in fuori.items() if d['stagione_in_corso']]
    note = [
        'SOLO Q1: e\' l\'unico segmento in cui c\'e\' tutto il campo. Q2 e Q3 sono '
        'sottoinsiemi gia\' selezionati e la loro dispersione misurerebbe la selezione, non '
        'il gruppo. Il campo `time` di f1db e\' vuoto in questa tabella: si usa q1Millis.',
        'IN PERCENTUALE dal miglior tempo della STESSA sessione, mai in secondi: fra ere '
        'cambiano regolamento, gomme, lunghezza del tracciato e punti di misura, e i secondi '
        'assoluti non sopravvivono al confronto.',
        f'SOLO CIRCUITI COMUNI ({", ".join(comuni)}): confrontare anni con calendari diversi '
        f'somma il cambiamento delle vetture a quello delle piste. Il set e\' derivato — i '
        f'circuiti corsi in almeno {anni_richiesti} anni del perimetro su {len(anni)} — e '
        f'ogni anno dichiara che cosa ha usato e che cosa ha escluso.',
        'IL METEO NON SI VEDE DA QUI. Una qualifica bagnata allarga la dispersione di molto e '
        'non e\' un fatto sulle vetture; questa fonte non dice se la sessione era asciutta o '
        'bagnata e NON lo si indovina. E\' un limite, non un dettaglio: il dettaglio per gara '
        'e\' pubblicato apposta, cosi\' una sessione molto piu\' larga delle altre dello '
        'stesso anno si vede — ma «larga» non autorizza a scrivere «bagnata».',
        f'Righe senza q1Millis saltate e contate: {senza_q1} nel perimetro (chi non ha girato, '
        f'chi e\' partito dai box, e le righe doppie che f1db tiene per una squalifica).',
        f'CAMPO PARI: mediana_pct e p90_pct sono su tutto il campo presente, che non e\' lo '
        f'stesso ogni anno (22 vetture nel 2026, 20 negli anni precedenti). Le colonne '
        f'*_campo_pari rifanno lo stesso conto sui {campo_min} piu\' veloci di ogni sessione '
        f'({campo_min} e\' il campo piu\' piccolo del perimetro, '
        f'{campo_min_da["anno"]} round {campo_min_da["round"]}): se le due letture divergono, '
        f'una parte dell\'allargamento e\' il numero di vetture e non la loro distanza.',
        'n_gare conta le GARE, non i circuiti: nel 2020 e nel 2021 alcune piste ne hanno '
        'ospitate due nello stesso anno, e valgono due sessioni.',
        'Il formato della qualifica e\' riportato per ogni gara: nei fine settimana con sprint '
        'del 2021 e 2022 f1db marca la sessione SPRINT_RACE, ma il segmento Q1 resta un Q1 a '
        'eliminazione e resta confrontabile.',
    ]
    for a in aperte:
        d = fuori[a]
        note.append(
            f'{a} IN CORSO: {d["round_con_qualifica"]} qualifiche su {d["round_in_calendario"]} '
            f'round in calendario. La sua dispersione e\' su un sottoinsieme della stagione e '
            f'NON e\' confrontabile alla pari con un anno chiuso. Il vincolo dei circuiti '
            f'comuni attenua il problema (le {d["n_gare"]} sessioni contate sono sulle stesse '
            f'piste di tutti gli altri anni) ma non lo cancella: una stagione a meta\' puo\' '
            f'ancora muoversi, e il set comune e\' ristretto proprio dalla sua parzialita\'.')
    note.append(
        'FRAGILITA\' NOTA: il set comune si stringe quando una stagione del perimetro ha pochi '
        'round — a inizio stagione nuova l\'intersezione crolla. Per questo la soglia si '
        f'abbassa da sola sotto i {MIN_CIRCUITI_COMUNI} circuiti, e l\'anno richiesto '
        f'({anni_richiesti}) e\' scritto qui sopra invece che sottinteso.')

    return {
        'domanda': 'Il gruppo e\' davvero piu\' compatto di cinque anni fa, o e\' '
                   'un\'impressione da titolo?',
        'misura': 'distacco dal miglior tempo della stessa sessione di Q1, in percentuale: '
                  '100 * (q1 - q1_migliore) / q1_migliore. Piu\' piccolo = gruppo piu\' vicino.',
        'metodo': {
            'segmento': 'Q1',
            'percentile': 'interpolazione lineare fra le statistiche d\'ordine (tipo 7, il '
                          'default di numpy e di R)',
            'unita': 'percento del tempo del migliore',
            'aggregazione': 'tutti i piloti di tutte le gare dei circuiti comuni dell\'anno, '
                            'messi in un unico campione (nessuna media di medie)',
        },
        'perimetro': {
            'anni': anni,
            'anno_inizio_scelto': da,
            'anno_fine_derivato': anni[-1],
            'stagioni_in_corso': aperte,
        },
        'circuiti_comuni': {
            'regola': 'circuiti corsi in almeno anni_minimi_richiesti anni del perimetro; si '
                      'parte da TUTTI e si scende solo se il set resterebbe sotto '
                      f'{MIN_CIRCUITI_COMUNI} circuiti',
            'anni_del_perimetro': len(anni),
            'anni_minimi_richiesti': anni_richiesti,
            'rilassato': anni_richiesti < len(anni),
            'elenco': comuni,
            'presenze_per_circuito': dict(sorted(presenze.items())),
        },
        'campo_pari': {
            'k': campo_min,
            'perche': 'il campo non e\' lo stesso ogni anno; a campo pari si confrontano i K '
                      'piu\' veloci di ogni sessione, con K il campo piu\' piccolo del perimetro',
            'gara_che_lo_fissa': campo_min_da,
        },
        'nomi_circuiti': nomi,
        'anni': fuori,
        'note': note,
    }


def costruisci(args):
    zf, release_letta, come = apri_release(args.release, args.zip)
    percorso = getattr(zf, 'filename', None)

    ds = f1db_zip.tabella(zf, 'races-driver-standings')
    cs = f1db_zip.tabella(zf, 'races-constructor-standings')
    races = f1db_zip.tabella(zf, 'races')

    anno_fine = max(int(r['year']) for r in ds)              # DERIVATO, non cablato
    anni = [a for a in range(args.da, anno_fine + 1)
            if any(r['year'] == str(a) for r in ds)]
    if not anni:
        sys.exit(f'STOP: nessuna stagione dal {args.da} negli standings di {release_letta}.')

    calendario = {}                                          # anno -> round in calendario
    for r in races:
        a = int(r['year'])
        if a in anni:
            calendario[a] = max(calendario.get(a, 0), int(r['round']))

    serie, saltate_tot = {}, {'piloti': 0, 'costruttori': 0}
    for etichetta, tabella, chiave in (('piloti', ds, 'driverId'),
                                       ('costruttori', cs, 'constructorId')):
        per_anno = {}
        for a in anni:
            c = curva([r for r in tabella if r['year'] == str(a)], chiave)
            saltate_tot[etichetta] += c.pop('_saltate_senza_positionNumber')
            c['round_in_calendario'] = calendario.get(a)
            # in corso = il calendario ha piu' round di quanti ne copra la classifica.
            c['in_corso'] = bool(c['round_in_calendario']
                                 and c['round_totali'] < c['round_in_calendario'])
            if c['in_corso']:
                c['titolo_deciso_al_round'] = None           # una stagione aperta non ha vincitore
                c['campione'] = None
            per_anno[str(a)] = c
        serie[etichetta] = per_anno

    # nomi: la pagina non puo' aprire altre fonti, quindi gli id che compaiono qui dentro si
    # portano dietro il nome. Solo quelli che servono davvero.
    id_piloti = {i for a in serie['piloti'].values() for i in a['capoclassifica']}
    id_piloti |= {a['campione'] for a in serie['piloti'].values() if a['campione']}
    id_cost = {i for a in serie['costruttori'].values() for i in a['capoclassifica']}
    id_cost |= {a['campione'] for a in serie['costruttori'].values() if a['campione']}
    nomi = {
        'piloti': {d['id']: d['name'] for d in f1db_zip.tabella(zf, 'drivers') if d['id'] in id_piloti},
        'costruttori': {c['id']: c['name'] for c in f1db_zip.tabella(zf, 'constructors') if c['id'] in id_cost},
    }

    in_corso = [str(a) for a in anni if serie['piloti'][str(a)]['in_corso']]
    note = [
        'I punti vengono dagli standings f1db (races-driver-standings / '
        'races-constructor-standings) e non sono ricalcolati qui.',
        'Fra ere diverse i punti ASSOLUTI non si confrontano (sistema di punteggio, numero di '
        'gare e punti sprint cambiano): confrontabili sono quota_leader, '
        'vantaggio_leader_quota ed entro_20pct. Il vantaggio in punti va mostrato accanto '
        'alla quota, mai da solo.',
        'punti_assegnati e\' la somma della tabella stessa: quella dei piloti e quella dei '
        'costruttori possono differire (2018: 59 punti, la Force India che li perse come '
        'costruttore e li tenne ai piloti).',
        'entro_20pct conta chi ha almeno l\'80% dei punti del leader, leader incluso; e\' null '
        'se a quel round nessuno ha ancora segnato.',
        'Righe senza positionNumber (DSQ/EX) escluse da classifica e denominatore: '
        f'{saltate_tot["piloti"]} fra i piloti, {saltate_tot["costruttori"]} fra i costruttori '
        'nel perimetro.',
    ]
    for a in in_corso:
        p = serie['piloti'][a]
        note.append(f'{a} PARZIALE: {p["round_totali"]} round con classifica su '
                    f'{p["round_in_calendario"]} in calendario nella release letta '
                    f'({release_letta}); nessun titolo assegnato.')
    if release_letta != args.release:
        note.append(f'Release LETTA ({release_letta}) diversa dalla pinnata ({args.release}): '
                    f'i numeri sono quelli della release letta.')

    return {
        '_nota': ('GENERATO da gen_stat_confronti.py (modulo C1 «la corsa al titolo»). '
                  'Non modificare a mano: si rigenera da f1db.'),
        '_generatore': 'gen_stat_confronti.py',
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
            'tabelle': ['races-driver-standings', 'races-constructor-standings', 'races',
                        'drivers', 'constructors',
                        'races-qualifying-results', 'circuits'],
        },
        'perimetro': {
            'anni': anni,
            'anno_inizio_scelto': args.da,
            'anno_inizio_perche': ANNO_INIZIO_PERCHE,
            'anno_fine_derivato': anno_fine,
            'round_per_anno': {str(a): {'calendario': calendario.get(a),
                                        'piloti': serie['piloti'][str(a)]['round_totali'],
                                        'costruttori': serie['costruttori'][str(a)]['round_totali']}
                               for a in anni},
            'stagioni_in_corso': in_corso,
            'note': note,
        },
        'nomi': nomi,
        'piloti': serie['piloti'],
        'costruttori': serie['costruttori'],
        'dispersione_quali': dispersione_quali(zf, races, args.da),
    }


# ------------------------------------------------------------------------------------- I/O
def testo(dati):
    return json.dumps(dati, ensure_ascii=False, indent=1) + '\n'


def senza_ora(dati):
    """Copia confrontabile: tutto tranne cio' che dipende dall'INVOCAZIONE e non dal contenuto.

    `calcolato_il` cambia sempre, ed e' ovvio. `provenienza.come` no ed e' meno ovvio: dice
    per quale strada lo zip e' stato trovato — 'zip esplicito (--zip)' quando lo passa
    aggiorna_stat.py, 'cache' quando il generatore lo cerca da solo. E' la stessa release e
    quindi gli stessi dati; confrontarlo faceva fallire --check ogni volta che le due
    invocazioni differivano, cioe' un allarme falso che a lungo andare insegna a ignorare
    l'allarme. La release LETTA invece resta confrontata: se cambia quella, cambia il dato.
    """
    d = dict(dati)
    d.pop('calcolato_il', None)
    if isinstance(d.get('provenienza'), dict):
        d['provenienza'] = {k: v for k, v in d['provenienza'].items() if k != 'come'}
    return d


def riassunto(dati):
    righe = []
    for etichetta in ('piloti', 'costruttori'):
        for anno, c in dati[etichetta].items():
            capo = dati['nomi'][etichetta].get(c['capoclassifica'][-1], c['capoclassifica'][-1])
            titolo = c['titolo_deciso_al_round']
            righe.append(f"  {etichetta[:4]} {anno}: {c['round_totali']:>2} round"
                         f"{' (IN CORSO)' if c['in_corso'] else ''}"
                         f" · in testa {capo}"
                         f" · vantaggio {c['vantaggio_leader'][-1]} pt"
                         f" (quota {c['quota_leader'][-1]})"
                         f" · entro 20% {c['entro_20pct'][-1]}"
                         f" · cambi leader {c['cambi_leader']}"
                         f" · titolo al round {titolo if titolo else '—'}")
    return '\n'.join(righe)


def riassunto_dispersione(dati):
    d = dati['dispersione_quali']
    cc = d['circuiti_comuni']
    righe = [f'  circuiti comuni: {len(cc["elenco"])} ({", ".join(cc["elenco"])}) — '
             f'presenti in almeno {cc["anni_minimi_richiesti"]} anni su '
             f'{cc["anni_del_perimetro"]}'
             + ('  [SET RILASSATO]' if cc['rilassato'] else ''),
             f'  {"anno":>6} {"mediana%":>9} {"p90%":>7} | {"med% K=" + str(d["campo_pari"]["k"]):>9}'
             f' {"p90% K":>7} | {"pil":>4} {"gare":>5} {"oss":>5}  note']
    for anno, a in d['anni'].items():
        nota = []
        if a['stagione_in_corso']:
            nota.append(f'IN CORSO {a["round_con_qualifica"]}/{a["round_in_calendario"]}')
        if a['righe_senza_q1']:
            nota.append(f'{a["righe_senza_q1"]} righe senza q1')
        righe.append(f'  {anno:>6} {a["mediana_pct"]:>9.3f} {a["p90_pct"]:>7.3f} | '
                     f'{a["mediana_pct_campo_pari"]:>9.3f} {a["p90_pct_campo_pari"]:>7.3f} | '
                     f'{a["n_piloti"]:>4} {a["n_gare"]:>5} {a["n_osservazioni"]:>5}  '
                     f'{"; ".join(nota)}')
    return '\n'.join(righe)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--zip')
    ap.add_argument('--release', default=f1db_zip.RELEASE)
    ap.add_argument('--da', type=int, default=ANNO_INIZIO,
                    help=f'prima stagione del perimetro (default {ANNO_INIZIO}); '
                         f'l\'ultima e\' sempre derivata dai dati')
    ap.add_argument('--check', action='store_true',
                    help='rigenera e confronta col file su disco, senza scrivere')
    args = ap.parse_args()

    dati = costruisci(args)
    print(f'[stat_confronti] release pinnata {args.release} · letta '
          f'{dati["provenienza"]["f1db_release_letta"]} ({dati["provenienza"]["come"]})')
    print(f'[stat_confronti] perimetro {dati["perimetro"]["anni"][0]}-'
          f'{dati["perimetro"]["anni"][-1]} · in corso: '
          f'{", ".join(dati["perimetro"]["stagioni_in_corso"]) or "nessuna"}')
    print(riassunto(dati))
    print('[stat_confronti] dispersione Q1 (distacco % dal migliore, circuiti comuni):')
    print(riassunto_dispersione(dati))

    if args.check:
        if not os.path.exists(DEST):
            print(f'[stat_confronti] CHECK FALLITO: {os.path.relpath(DEST, ROOT)} non esiste.')
            return 1
        vecchio = json.load(open(DEST, encoding='utf-8'))
        if senza_ora(vecchio) == senza_ora(dati):
            print(f'[stat_confronti] CHECK OK: {os.path.relpath(DEST, ROOT)} e\' identico al '
                  f'rigenerato (a parte calcolato_il). Nessuna scrittura.')
            return 0
        print(f'[stat_confronti] CHECK FALLITO: il file su disco NON coincide col rigenerato.')
        for k in sorted(set(vecchio) | set(dati)):
            if senza_ora(vecchio).get(k) != senza_ora(dati).get(k):
                print(f'    diverge: {k}')
        return 1

    os.makedirs(os.path.dirname(DEST), exist_ok=True)
    with open(DEST, 'w', encoding='utf-8') as f:
        f.write(testo(dati))
    print(f'[stat_confronti] scritto {os.path.relpath(DEST, ROOT)} '
          f'({os.path.getsize(DEST)} byte, {len(dati["perimetro"]["anni"])} stagioni x 2 serie).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
