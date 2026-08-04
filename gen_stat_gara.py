"""gen_stat_gara.py — quello che si legge dai GIRI della stagione 2026.

    python3 gen_stat_gara.py [--zip <f1db.zip>] [--release vX] [--check]

Scrive demo/data/stat/gara_2026.json con quattro sezioni:

  giri_testa        chi ha materialmente condotto, giro per giro
  neutralizzazioni  quanto si e' corso a gara piena, in TRE metriche separate
  soste             quante volte ci si e' fermati, con l'arbitro che dice chi ha ragione
  gomme             mescole, lunghezza degli stint, mescola di partenza

PERCHE' UN GENERATORE E NON LA PAGINA. Le pagine del sito sono consumatori puri: leggono
solo demo/data/. Il campo che serve al modulo piu' importante di questo file — `pos`, la
posizione in pista giro per giro — vive in data/classifica_giro_2026.csv, cioe' fuori dal
perimetro del browser. Un generatore invece data/ puo' leggerlo: il divieto e' per le pagine.

IL PUNTO DELICATO, ed e' la ragione per cui questo file esiste.
Il leader di ogni giro NON si deduce dal tempo cumulato. Quando un giro manca, il feed COPIA
il tempo-sessione del leader nella riga, e nascono pareggi al millesimo: a Cina, al primo
giro, cinque piloti hanno esattamente 3483,760 e a vincere il pareggio e' chi viene prima in
ordine alfabetico. Misurato: dedotto dal cum_time il leader del primo giro e' sbagliato in
3 gare su 11. Il campo `pos` c'e', e' gia' letto da gen_classifica_giro.py, e da' 673 giri
attribuiti su 673 — nessuna barra grigia da mostrare, nessun giro buttato.
"""
from __future__ import annotations

import argparse
import collections
import csv
import datetime
import hashlib
import io
import json
import os
import sys
import zipfile

import f1db_zip

ROOT = os.path.dirname(os.path.abspath(__file__))
GIRI = os.path.join(ROOT, 'data', 'classifica_giro_2026.csv')
REGISTRO = os.path.join(ROOT, 'data', 'gare_registro.json')
VOCAB = os.path.join(ROOT, 'data', 'status_vocabolario.csv')
PITSTOPS = os.path.join(ROOT, 'demo', 'data', 'pitstops_2026.json')
UFFICIALI = os.path.join(ROOT, 'demo', 'data', 'ufficiali_2026.json')
CALENDARIO = os.path.join(ROOT, 'demo', 'data', 'calendario_2026.json')
SCHEDE = os.path.join(ROOT, 'demo', 'data', 'schede_2026.json')
RAGGR = os.path.join(ROOT, 'data', 'ritiri_raggruppamento.json')
DEST = os.path.join(ROOT, 'demo', 'data', 'stat', 'gara_2026.json')

ANNO = 2026

# I DIGIT DEL CAMPO `status`, da data/status_vocabolario.csv (39 codici, nota di metodo in
# data/STATUS_VOCABOLARIO_NOTA.md). Un `status` di gara e' la CONCATENAZIONE ordinata degli
# stati attraversati dall'auto in quel giro: '41' = iniziato sotto SC e finito in verde.
#   4 = SC        committato
#   6 = VSC       committato
#   5 = bandiera rossa  committato
#   2 = giallo di settore   IPOTESI FIA, non committata -> NON e' una neutralizzazione
#   7 = VSC in chiusura     IPOTESI FIA, non committata
#   1 = verde
REGIMI = [('sc', '4', 'safety car'), ('vsc', '6', 'virtual safety car'),
          ('rosso', '5', 'bandiera rossa')]


def ora_utc() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')


def sha256_12(percorso) -> str | None:
    if not percorso or not os.path.exists(percorso):
        return None
    h = hashlib.sha256()
    with open(percorso, 'rb') as f:
        for pezzo in iter(lambda: f.read(1 << 20), b''):
            h.update(pezzo)
    return h.hexdigest()[:12]


def apri_release(release=None, zip_esplicito=None):
    """(ZipFile, release_letta, come, percorso). Non dichiara MAI una release da cui non ha
    letto: e' il difetto che gen_calendario.py ha ancora e che qui non si replica."""
    if zip_esplicito:
        nome = os.path.basename(zip_esplicito)
        letta = None
        if 'f1db-csv-' in nome:
            letta = nome.split('f1db-csv-')[1].removesuffix('.zip') or None
        return zipfile.ZipFile(zip_esplicito), letta, 'zip esplicito (--zip)', zip_esplicito
    pin = release or f1db_zip._release_pinnata()
    try:
        return zipfile.ZipFile(f1db_zip.apri(pin).filename), pin, 'cache', f1db_zip.percorso_zip(pin)
    except Exception:
        pass
    cache = os.path.dirname(f1db_zip.percorso_zip(pin))
    disponibili = sorted(f for f in os.listdir(cache) if f.endswith('.zip')) if os.path.isdir(cache) else []
    if not disponibili:
        sys.exit(f'[stat_gara] la release {pin} non e\' scaricabile e la cache e\' vuota.')
    ripiego = disponibili[-1].split('f1db-csv-')[1].removesuffix('.zip')
    print(f'[stat_gara] ATTENZIONE: {pin} non disponibile, ripiego su {ripiego} dalla cache.')
    p = f1db_zip.percorso_zip(ripiego)
    return zipfile.ZipFile(p), ripiego, 'ripiego dalla cache', p


def csv_zip(zf, nome):
    with zf.open(f'f1db-{nome}.csv') as fh:
        return list(csv.DictReader(io.TextIOWrapper(fh, 'utf-8')))


def num(x, d=None):
    try:
        return int(float(x))
    except (TypeError, ValueError):
        return d


# --------------------------------------------------------------------------- le sezioni

def sezione_giri_testa(giri, gare):
    """Chi ha condotto, da `pos`. Verde e neutralizzato SEPARATI: la domanda e' «chi ha
    guidato materialmente la corsa», e un giro dietro la safety car non e' guidare."""
    per_pilota = collections.defaultdict(lambda: {'verdi': 0, 'neutralizzati': 0})
    per_gara = {}
    senza_leader = []
    for gara in gare:
        righe = [r for r in giri if r['gara'] == gara]
        n_giri = max((num(r['giro'], 0) for r in righe), default=0)
        seq = {}
        for g in range(1, n_giri + 1):
            leader = [r for r in righe if num(r['giro']) == g and num(r['pos']) == 1]
            if len(leader) != 1:
                senza_leader.append({'gara': gara, 'giro': g, 'candidati': len(leader)})
                continue
            r = leader[0]
            neutro = any(d in (r['status'] or '') for _, d, _ in REGIMI)
            per_pilota[r['pilota']]['neutralizzati' if neutro else 'verdi'] += 1
            seq[g] = r['pilota']
        per_gara[gara] = {
            'n_giri': n_giri,
            'attribuiti': len(seq),
            'sequenza': [seq.get(g) for g in range(1, n_giri + 1)],
            'cambi_al_comando': sum(1 for g in range(2, n_giri + 1)
                                    if seq.get(g) and seq.get(g - 1) and seq[g] != seq[g - 1]),
        }
    piloti = sorted(
        ({'pilota': p, **v, 'totale': v['verdi'] + v['neutralizzati']}
         for p, v in per_pilota.items()),
        key=lambda x: -x['totale'])
    return {
        'metodo': 'leader = la riga con pos == 1 in data/classifica_giro_2026.csv. NON dedotto '
                  'dal tempo cumulato: quando un giro manca il feed copia il tempo-sessione del '
                  'leader e nascono pareggi al millesimo (a Cina, giro 1, cinque piloti hanno lo '
                  'stesso 3483,760). Col cum_time il leader del giro 1 e\' sbagliato in 3 gare su 11.',
        'verde_vs_neutralizzato': 'un giro condotto dietro la safety car conta, ma separatamente: '
                                  'la domanda e\' chi ha guidato la corsa, non chi era davanti.',
        'giri_totali': sum(v['n_giri'] for v in per_gara.values()),
        'giri_attribuiti': sum(v['attribuiti'] for v in per_gara.values()),
        'giri_senza_leader': senza_leader,
        'piloti': piloti,
        'per_gara': per_gara,
    }


def sezione_neutralizzazioni(giri, gare):
    """TRE METRICHE, mai una sola.

    «Safety car stats» e' un'etichetta sotto cui i siti pubblicano indistintamente tre cose
    diverse, che danno classifiche di circuito diverse: quante volte e' uscita, quanti giri
    sono stati neutralizzati, e che quota della gara e' stata corsa cosi'. Qui ci sono tutte
    e tre, e chi ne cita una sola sta rispondendo a un'altra domanda.
    """
    out = {}
    for gara in gare:
        righe = [r for r in giri if r['gara'] == gara]
        n_giri = max((num(r['giro'], 0) for r in righe), default=0)
        # il REGIME DI GARA di ogni giro: l'unione dei digit visti su tutte le auto di quel
        # giro. Una singola auto puo' essere ai box e non vedere la bandiera.
        regime = collections.defaultdict(set)
        for r in righe:
            g = num(r['giro'])
            if g:
                regime[g].update(r['status'] or '')
        blocchi = {}
        giri_regime = {}
        for chiave, digit, _ in REGIMI:
            dentro = [g for g in range(1, n_giri + 1) if digit in regime.get(g, set())]
            giri_regime[chiave] = len(dentro)
            # dispiegamenti = blocchi contigui di giri
            n = 0
            for i, g in enumerate(dentro):
                if i == 0 or g != dentro[i - 1] + 1:
                    n += 1
            blocchi[chiave] = n
        # giri-auto: il denominatore vero di «quanta gara»
        auto_neutre = sum(1 for r in righe
                          if any(d in (r['status'] or '') for _, d, _ in REGIMI))
        out[gara] = {
            'n_giri': n_giri,
            'dispiegamenti': blocchi,
            'giri_di_gara_per_regime': giri_regime,
            'giri_auto_totali': len(righe),
            'giri_auto_neutralizzati': auto_neutre,
            'quota_neutralizzata': round(auto_neutre / len(righe), 4) if righe else None,
        }
    return {
        'metodo': 'i digit del campo `status` di ogni giro-auto, secondo data/status_vocabolario.csv '
                  '(4 = safety car, 6 = virtual safety car, 5 = bandiera rossa). Il regime di un giro '
                  'e\' l\'unione dei digit visti su tutte le auto di quel giro: una singola auto ai box '
                  'puo\' non vedere la bandiera.',
        'perche_tre_metriche': 'dispiegamenti, giri di gara neutralizzati e quota di giri-auto sono tre '
                               'grandezze diverse e danno classifiche diverse. Sono pubblicate tutte e tre.',
        'non_neutralizzazioni': 'il digit 2 (giallo di settore) e il 7 (VSC in chiusura) sono IPOTESI '
                                'sul vocabolario FIA, non committate dal progetto: non contano come '
                                'neutralizzazione.',
        'dove_NON_stanno': 'demo/data/race_control_2026.json non contiene le safety car: il suo '
                           'vocabolario ha solo giallo/info/penalita. Chi le cerca li\' ne trova due '
                           'in tutta la stagione invece di tutte quelle che ci sono.',
        'per_gara': out,
    }


def sezione_soste(giri, gare, pitstops, f1db_stops, r2g, sigla_di):
    """Quante volte ci si e' fermati — e i modi sbagliati di contarlo.

    TRE conteggi possibili, e non sono equivalenti:
      A  le righe di demo/data/pitstops_2026.json  (semantica dichiarata e auto-verificata)
      B  il massimo `stint` meno uno
      C  il numero di righe col flag `pit`
    L'ARBITRO e' f1db races-pit-stops. Misurato: A coincide con f1db su TUTTE le coppie
    confrontabili; B sbaglia in 27 casi su 241; C non e' affatto un conteggio di soste —
    segna sia il giro d'ingresso sia quello d'uscita e vale circa il doppio.
    """
    A, B, C = {}, collections.defaultdict(int), collections.defaultdict(int)
    stint_max = collections.defaultdict(int)
    for r in giri:
        k = (r['gara'], r['pilota'])
        if str(r['pit']).lower() in ('true', '1'):
            C[k] += 1
        s = num(r['stint'])
        if s:
            stint_max[k] = max(stint_max[k], s)
    for k, v in stint_max.items():
        B[k] = v - 1
    for gara, piloti in pitstops.items():
        for sg, stops in piloti.items():
            A[(gara, sg)] = len(stops)

    # l'arbitro
    arb = collections.Counter()
    for r in f1db_stops:
        g = r2g.get(num(r['round']))
        s = sigla_di.get(r['driverId'])
        if g and s:
            arb[(g, s)] += 1
    conf = [k for k in arb if k in A and A[k] == arb[k]]
    disc = [{'gara': k[0], 'pilota': k[1], 'nostro': A[k], 'f1db': arb[k]}
            for k in sorted(arb) if k in A and A[k] != arb[k]]

    chiavi = sorted(set(A) | set(B) | set(C))
    per_pilota = [{'gara': g, 'pilota': p, 'soste': A.get((g, p), 0),
                   'da_stint': B.get((g, p), 0), 'righe_pit': C.get((g, p), 0)}
                  for g, p in chiavi]
    per_gara = {}
    for gara in gare:
        v = [x['soste'] for x in per_pilota if x['gara'] == gara]
        d = collections.Counter(v)
        per_gara[gara] = {'soste_totali': sum(v), 'per_pilota_mediana': sorted(v)[len(v) // 2] if v else None,
                          'distribuzione': {str(k): d[k] for k in sorted(d)}}
    return {
        'metodo': 'il conteggio pubblicato viene da demo/data/pitstops_2026.json, che il suo '
                  'generatore rimisura a ogni esecuzione contro il censimento FastF1 e che qui e\' '
                  'confrontato con f1db races-pit-stops.',
        'attenzione_semantica': 'la DURATA in pitstops_2026.json e\' il TRANSITO IN PIT LANE (circa '
                                '22 s), non l\'auto ferma e non i secondi persi contro chi resta in '
                                'pista. Sono tre grandezze diverse con nomi simili: «durata sosta», '
                                '«transito pit lane» e «pit-loss».',
        'arbitro': {
            'fonte': 'f1db races-pit-stops',
            'coppie_confrontate': len(conf) + len(disc),
            'concordi': len(conf),
            'discordi': disc,
            'nota_numerazione': 'il campo `stop` di f1db SALTA dei numeri (Australia STR: 1, 2, 4). '
                                'Le soste si contano per RIGHE, non col numero di sosta piu\' alto: '
                                'con max(stop) si conterebbe una sosta in piu\' in 5 casi su 219.',
        },
        'i_tre_conteggi': {
            'A_file_soste': 'righe di pitstops_2026.json — confermato dall\'arbitro',
            'B_da_stint': 'massimo stint meno uno — sbaglia dove uno stint non si chiude',
            'C_righe_pit': 'NON e\' un conteggio di soste: il flag segna sia il giro d\'ingresso '
                           'sia quello d\'uscita, e vale circa il doppio',
            'accordo_A_B': sum(1 for g, p in chiavi if A.get((g, p), 0) == B.get((g, p), 0)),
            'accordo_A_C': sum(1 for g, p in chiavi if A.get((g, p), 0) == C.get((g, p), 0)),
            'coppie': len(chiavi),
        },
        'per_gara': per_gara,
        'per_pilota': per_pilota,
    }


def sezione_copertura_canonica(zf, r2g):
    """«ASSENTE OVUNQUE» E «ASSENTE DA NOI» SONO DUE COSE DIVERSE, e il muro delle coperture
    le confondeva.

    Il muro dice «sprint 1/4» e «libere 2/11», e un lettore esperto conclude «i dati non ci
    sono». E' falso: la fonte canonica ha TUTTE le qualifiche, TUTTE le libere principali e
    TUTTI i weekend sprint. Non li abbiamo importati — che e' un debito nostro con un rimedio
    noto, non un limite del mondo. Uno dei due si risolve lavorando, l'altro no, e chiamarli
    con lo stesso rosso e' il difetto che questa sezione esiste per non commettere.

    Qui si CONTA quanti round la fonte canonica copre per ogni tipo di sessione. Il confronto
    con quello che pubblichiamo lo fa la pagina.
    """
    tabelle = {
        'qualifiche': 'races-qualifying-results',
        'libere_fp1': 'races-free-practice-1-results',
        'libere_fp2': 'races-free-practice-2-results',
        'libere_fp3': 'races-free-practice-3-results',
        'sprint': 'races-sprint-race-results',
        'sprint_quali': 'races-sprint-qualifying-results',
        'giro_veloce': 'races-fastest-laps',
        'soste': 'races-pit-stops',
    }
    out = {}
    for chiave, tab in tabelle.items():
        try:
            righe = [r for r in csv_zip(zf, tab) if num(r['year']) == ANNO]
        except KeyError:
            out[chiave] = {'tabella': tab, 'presente': False}
            continue
        rounds = sorted({num(r['round']) for r in righe if num(r['round'])})
        out[chiave] = {
            'tabella': tab,
            'presente': True,
            'round': len(rounds),
            'gare': [r2g[x] for x in rounds if x in r2g],
            'righe': len(righe),
        }
    return {
        'cosa_dice': 'quanti round del 2026 la fonte canonica (f1db) copre, per tipo di sessione. '
                     'Serve a distinguere «assente ovunque» da «assente da noi»: il primo e\' un '
                     'limite del mondo, il secondo un debito con un rimedio noto.',
        'per_sessione': out,
    }


def sezione_osservabilita(tele_manifest, tele_files):
    """IL CENSIMENTO DEI CANALI, cioe' la parte MISURATA del muro dell'osservabilita'.

    Prima questa era prosa: «lo stato di carica e l'aerodinamica attiva non sono osservabili».
    Vero, ma non verificabile da chi legge, e soprattutto non aggiornabile: se un giorno il
    collettore cominciasse a esportare un canale nuovo, quella frase resterebbe li' a mentire.

    Qui si CONTA cosa il sito pubblica davvero. Il risultato di oggi e' piu' netto di quanto
    diceva la prosa: i canali pubblicati sono cinque — tempo, velocita', gas, freno, marcia —
    e il DRS non c'e' AFFATTO, nemmeno a zero. Chi volesse verificare l'affermazione «nel 2026
    il canale DRS e' a zero» su questi dati non potrebbe: quel canale non viene esportato, e
    l'affermazione viene da fuori. Dirlo cosi' e' piu' onesto che citare un numero che non
    abbiamo misurato.
    """
    canali = {}
    for f, d in tele_files.items():
        for c in d.get('canali') or []:
            canali.setdefault(c, []).append(f)
    disponibili = tele_manifest.get('disponibili') or []
    return {
        'metodo': 'censimento del campo `canali` di ogni demo/data/tele_*.json pubblicato. E\' una '
                  'misura di COSA IL SITO ESPORTA, non di cosa esiste nel feed.',
        'canali_pubblicati': sorted(canali),
        'n_canali': len(canali),
        'sessioni_con_telemetria': len(disponibili),
        'gare_con_telemetria': sorted({d['gara'] for d in disponibili}),
        'assenti_e_perche': {
            'drs': 'NON esportato. Non e\' «a zero»: il canale non c\'e\' proprio, quindi su questi '
                   'dati l\'affermazione «nel 2026 il DRS e\' a zero» non e\' verificabile — viene '
                   'da fuori, e va attribuita a chi la fa.',
            'ers_stato_di_carica': 'non esportato, e non esiste nei dati pubblici: F1 ha deciso di '
                                   'non renderlo disponibile.',
            'aerodinamica_attiva': 'la posizione delle ali (modalita\' X/Z) non e\' nei dati pubblici.',
            'mj_recuperati_schierati': 'non nei dati pubblici.',
            'carico_carburante': 'non nei dati pubblici; e\' il motivo per cui un passo medio non '
                                 'corretto porta con se\' circa due secondi al giro.',
        },
        'cosa_resta_misurabile': [
            'velocita\' di punta e velocita\' minima in curva',
            'quota di giro a pieno gas (dal canale del gas)',
            'tempi per settore e distacchi in qualifica',
            'numero e durata degli stint',
        ],
        'limite': 'la telemetria pubblicata e\' UN GIRO per pilota (il piu\' veloce), non la '
                  'sessione: qualunque media o tendenza «telemetrica di stagione» sarebbe costruita '
                  'su un giro solo per gara, e non si fa.',
    }


def sezione_ritiri(f1db_results, uff, r2g, sigla_di, team_di, mappa):
    """Chi non e' arrivato, e per cosa.

    DUE FONTI CON DUE RUOLI DIVERSI, e non sono intercambiabili:
      - CHI non e' arrivato: demo/data/ufficiali_2026.json, campo `classificato`. E' l'arbitro
        dei risultati per decisione del progetto. NON si usa `status`: fra gli ufficiali ci
        sono «Retired» che risultano CLASSIFICATI e «Lapped» che NON lo sono, quindi leggere
        lo status al posto del campo sbaglierebbe il verdetto.
      - PER COSA: f1db `reasonRetired`, l'UNICA fonte delle cause. E' testo libero.

    IL RAGGRUPPAMENTO NON LO DECIDE QUESTO FILE. Le famiglie stanno in
    data/ritiri_raggruppamento.json, che nasce con firmato = false: finche' resta cosi' si
    pubblica il testo grezzo. Non e' prudenza eccessiva — «Battery» nella power unit o
    nell'elettronica cambia il numero, e un generatore che sceglie da solo pubblica
    un'opinione con l'aria di una misura.
    """
    per_gara = collections.defaultdict(lambda: {'non_arrivati': 0, 'dettaglio': []})
    cause = collections.Counter()
    stati = collections.Counter()
    per_squadra = collections.defaultdict(lambda: {'partenze': 0, 'non_arrivati': 0})

    # la causa, indicizzata per (gara, sigla), dalla sola fonte che ce l'ha
    causa_di = {}
    squadra_di = {}
    for r in f1db_results:
        if num(r['year']) != ANNO:
            continue
        g, s = r2g.get(num(r['round'])), sigla_di.get(r['driverId'])
        if not g or not s:
            continue
        # NON l'id f1db: quello e' un quarto alfabeto («aston-martin») che nessuna pagina
        # sa colorare. Si traduce qui, una volta, nel nome che usano le classifiche.
        squadra_di[(g, s)] = team_di.get(r.get('constructorId'), r.get('constructorId'))
        if r.get('reasonRetired'):
            causa_di[(g, s)] = r['reasonRetired']

    for gara, blocco in uff.items():
        for r in blocco.get('classifica', []):
            s = r['pilota']
            t = squadra_di.get((gara, s)) or '?'
            per_squadra[t]['partenze'] += 1
            stati[r.get('status') or '?'] += 1
            if r.get('classificato'):
                continue
            per_squadra[t]['non_arrivati'] += 1
            c = causa_di.get((gara, s))
            if c:
                cause[c] += 1
            per_gara[gara]['non_arrivati'] += 1
            per_gara[gara]['dettaglio'].append(
                {'pilota': s, 'squadra': t, 'stato': r.get('status'), 'causa': c})

    firmata = bool(mappa.get('firmato')) and bool(mappa.get('famiglie'))
    senza_famiglia = [c for c in cause if c not in (mappa.get('famiglie') or {})]
    return {
        'chi_non_e_arrivato': 'demo/data/ufficiali_2026.json, campo `classificato` — l\'arbitro '
                              'dei risultati. NON il campo `status`: fra gli ufficiali ci sono '
                              '«Retired» classificati e «Lapped» non classificati, e leggere lo '
                              'status al posto del campo sbaglierebbe il verdetto.',
        'perche': 'f1db races-race-results.reasonRetired, l\'unica fonte delle cause. Testo libero.',
        'raggruppamento': {
            'firmato': firmata,
            'firmato_da': mappa.get('firmato_da'),
            'firmato_il': mappa.get('firmato_il'),
            'file': 'data/ritiri_raggruppamento.json',
            'perche_grezzo': None if firmata else
                'Le famiglie non sono firmate: si pubblica il testo grezzo di ogni causa. '
                'Raggruppare e\' una scelta editoriale che cambia il numero, e questo '
                'generatore non la prende al posto di nessuno.',
            'cause_senza_famiglia': sorted(senza_famiglia) if firmata else None,
        },
        'non_arrivati_totali': sum(v['non_arrivati'] for v in per_gara.values()),
        'con_causa_dichiarata': sum(cause.values()),
        'cause_grezze': dict(cause.most_common()),
        'famiglie': ({f: sum(n for c, n in cause.items()
                             if (mappa['famiglie'] or {}).get(c) == f)
                      for f in sorted(set((mappa.get('famiglie') or {}).values()))}
                     if firmata else None),
        'per_squadra': sorted(
            ({'squadra': t, **v,
              'quota': round(v['non_arrivati'] / v['partenze'], 4) if v['partenze'] else None}
             for t, v in per_squadra.items()),
            key=lambda x: -(x['quota'] or 0)),
        'per_gara': dict(per_gara),
    }


def sezione_pit_lane(pitstops, giri, gare):
    """Il transito in pit lane per squadra, NORMALIZZATO dentro la gara.

    PERCHE' NON I SECONDI ASSOLUTI. La durata pubblicata e' il tempo per attraversare la
    corsia, e quel tempo lo decide soprattutto il CIRCUITO: la pit lane di Monaco e quella
    di Spa non si confrontano. Una classifica in secondi assoluti misurerebbe il calendario,
    non le squadre. Qui ogni sosta diventa lo scarto dalla MEDIANA DELLA SUA GARA, e solo
    dopo si aggrega per squadra.

    E ANCHE COSI' NON E' LA PRESTAZIONE DEI MECCANICI. Il transito comprende l'ingresso,
    l'uscita e il limite di velocita': l'auto ferma e' una frazione di quel tempo, e non e'
    separabile con questi dati. Va detto, non stimato.
    """
    squadra = {}
    for r in giri:
        squadra[(r['gara'], r['pilota'])] = r['team']

    scarti = collections.defaultdict(list)
    per_gara = {}
    for gara, piloti in pitstops.items():
        durate = [(sg, s['durata_s']) for sg, ss in piloti.items()
                  for s in ss if s.get('durata_s') is not None]
        if not durate:
            continue
        v = sorted(d for _, d in durate)
        med = v[len(v) // 2] if len(v) % 2 else (v[len(v) // 2 - 1] + v[len(v) // 2]) / 2
        per_gara[gara] = {'n': len(v), 'mediana_s': round(med, 3),
                          'minimo_s': round(v[0], 3), 'massimo_s': round(v[-1], 3)}
        for sg, d in durate:
            t = squadra.get((gara, sg))
            if t:
                scarti[t].append(round(d - med, 3))

    def stat(v):
        v = sorted(v)
        m = len(v) // 2
        return {'n': len(v),
                'scarto_mediano_s': round(v[m] if len(v) % 2 else (v[m - 1] + v[m]) / 2, 3),
                'q1_s': round(v[len(v) // 4], 3), 'q3_s': round(v[(3 * len(v)) // 4], 3),
                'minimo_s': round(v[0], 3), 'massimo_s': round(v[-1], 3)}

    return {
        'metodo': 'ogni sosta diventa lo scarto dalla mediana della propria gara, e solo dopo si '
                  'aggrega per squadra: il tempo assoluto lo decide il circuito, non la squadra.',
        'cosa_NON_e': 'NON e\' il tempo con l\'auto ferma e NON e\' la prestazione dei meccanici. '
                      'La grandezza misurata e\' il TRANSITO IN PIT LANE — ingresso, corsia a '
                      'velocita\' limitata, uscita — e l\'auto ferma ne e\' solo una frazione, non '
                      'separabile con questi dati.',
        'per_squadra': sorted(({'team': t, **stat(v)} for t, v in scarti.items() if v),
                              key=lambda x: x['scarto_mediano_s']),
        'per_gara': per_gara,
    }


def sezione_gomme(giri, gare):
    """Mescole e stint: il dato piu' pieno che il sito possiede — 11 gare su 11.

    NON E' UN MODULO DI DEGRADO, ed e' scritto apposta. I modelli di degrado e traffico di
    questo progetto hanno ACCENDIBILE=false per verdetto proprio, e l'arco si e' chiuso con
    cinque cancelli NULL. Qui ci sono durate e conteggi con il loro N: descrizione, non curve.
    """
    stint = {}
    for r in giri:
        k = (r['gara'], r['pilota'], num(r['stint']))
        if k[2] is None or not r['compound']:
            continue
        s = stint.setdefault(k, {'compound': r['compound'], 'giri': 0, 'primo': num(r['giro']),
                                 'ultimo': num(r['giro']), 'eta_max': 0})
        s['giri'] += 1
        s['primo'] = min(s['primo'], num(r['giro']))
        s['ultimo'] = max(s['ultimo'], num(r['giro']))
        s['eta_max'] = max(s['eta_max'], num(r['life'], 0) or 0)

    per_mescola = collections.defaultdict(list)
    per_gara = collections.defaultdict(lambda: collections.defaultdict(int))
    partenza = collections.defaultdict(collections.Counter)
    for (gara, pil, n), s in stint.items():
        per_mescola[s['compound']].append(s['giri'])
        per_gara[gara][s['compound']] += s['giri']
        if n == 1:
            partenza[gara][s['compound']] += 1

    def stat(v):
        v = sorted(v)
        if not v:
            return None
        m = len(v) // 2
        return {'n': len(v), 'mediana': v[m] if len(v) % 2 else (v[m - 1] + v[m]) / 2,
                'minimo': v[0], 'massimo': v[-1],
                'q1': v[len(v) // 4], 'q3': v[(3 * len(v)) // 4]}

    return {
        'metodo': 'uno stint = una coppia (pilota, numero di stint) dentro una gara; la sua lunghezza '
                  'e\' il numero di giri percorsi con quella mescola. Le mediane sono su tutti gli '
                  'stint della stagione, ritiri compresi: uno stint interrotto da un ritiro e\' corto '
                  'e resta nel conto, quindi la mediana e\' una durata OSSERVATA, non una durata voluta.',
        'non_e_degrado': 'questo modulo NON stima il degrado. I modelli di degrado e traffico del '
                         'progetto sono spenti per verdetto proprio (ACCENDIBILE=false) e l\'arco si e\' '
                         'chiuso con cinque cancelli NULL. Qui ci sono durate e conteggi con il loro N.',
        'stint_totali': len(stint),
        'giri_con_mescola': sum(s['giri'] for s in stint.values()),
        'lunghezza_per_mescola': {c: stat(v) for c, v in sorted(per_mescola.items())},
        'giri_per_gara': {g: dict(sorted(v.items())) for g, v in per_gara.items()},
        'mescola_di_partenza': {g: dict(v) for g, v in partenza.items()},
    }


# --------------------------------------------------------------------------- assemblaggio

def costruisci(zf, release_letta, come, percorso_zip):
    registro = json.load(open(REGISTRO, encoding='utf-8'))
    gare_registro = list(registro.get('gare', registro).keys()) if isinstance(
        registro.get('gare', registro), dict) else list(registro)

    giri = list(csv.DictReader(open(GIRI, encoding='utf-8')))
    presenti = {r['gara'] for r in giri}
    # PERIMETRO DERIVATO: le gare che hanno davvero righe nel per-giro, nell'ordine del calendario
    cal = json.load(open(CALENDARIO, encoding='utf-8'))
    ordine = [g['gara_demo'] for g in cal['gare'] if g.get('gara_demo')]
    gare = [g for g in ordine if g in presenti]
    assenti = [{'gara': g, 'motivo': 'nessuna riga nel per-giro'}
               for g in ordine if g not in presenti and g in gare_registro]

    r2g = {g['round']: g['gara_demo'] for g in cal['gare'] if g.get('gara_demo')}
    schede = json.load(open(SCHEDE, encoding='utf-8'))
    sigla_di = {i: s['sigla'] for i, s in schede['piloti'].items()}
    pitstops = json.load(open(PITSTOPS, encoding='utf-8'))['gare']
    f1db_stops = [r for r in csv_zip(zf, 'races-pit-stops') if num(r['year']) == ANNO]
    f1db_res = csv_zip(zf, 'races-race-results')
    uff = json.load(open(UFFICIALI, encoding='utf-8'))
    # constructorId f1db -> nome mostrato dalle classifiche (e chiave dei colori squadra)
    clas = json.load(open(os.path.join(ROOT, 'demo', 'data', 'classifiche_2026.json'),
                          encoding='utf-8'))
    team_di = {c['id']: c.get('team_demo') or c.get('nome') for c in clas['costruttori']}
    # telemetria: il manifest piu' i file che dichiara, per il censimento dei canali
    tdir = os.path.join(ROOT, 'demo', 'data')
    try:
        tele_manifest = json.load(open(os.path.join(tdir, 'tele_manifest.json'), encoding='utf-8'))
    except OSError:
        tele_manifest = {}
    tele_files = {}
    for d in tele_manifest.get('disponibili') or []:
        try:
            tele_files[d['file']] = json.load(open(os.path.join(tdir, d['file']), encoding='utf-8'))
        except OSError:
            pass
    try:
        mappa = json.load(open(RAGGR, encoding='utf-8'))
    except OSError:
        mappa = {}

    return {
        '_nota': 'GENERATO da gen_stat_gara.py. Non modificare a mano: si rigenera a ogni gara '
                 'con `python3 aggiorna_stat.py`.',
        '_generatore': 'gen_stat_gara.py',
        'schema': 1,
        'calcolato_il': ora_utc(),
        'provenienza': {
            'f1db_release_pinnata': f1db_zip._release_pinnata(),
            'f1db_release_letta': release_letta,
            'f1db_fallback_default': getattr(f1db_zip, '_DEFAULT_RELEASE', None),
            'come': come,
            'zip': os.path.basename(percorso_zip) if percorso_zip else None,
            'zip_sha256_12': sha256_12(percorso_zip),
            'tabelle': ['races-pit-stops', 'races-race-results'],
            'artefatti_letti': [
                {'path': 'data/ritiri_raggruppamento.json', 'sha256_12': sha256_12(RAGGR)},
                {'path': 'data/classifica_giro_2026.csv', 'sha256_12': sha256_12(GIRI)},
                {'path': 'demo/data/pitstops_2026.json', 'sha256_12': sha256_12(PITSTOPS)},
                {'path': 'demo/data/ufficiali_2026.json', 'sha256_12': sha256_12(UFFICIALI)},
                {'path': 'data/status_vocabolario.csv', 'sha256_12': sha256_12(VOCAB)},
            ],
        },
        'perimetro': {
            'anno': ANNO,
            'gare': gare,
            'assenti': assenti,
            'note': [
                f'{len(gare)} gare con dati per-giro, su {len(ordine)} corse e pubblicate.',
                'il perimetro e\' derivato: le gare vengono dal calendario incrociato con le righe '
                'davvero presenti nel per-giro, mai da un elenco scritto nel sorgente.',
            ],
        },
        'giri_testa': sezione_giri_testa(giri, gare),
        'neutralizzazioni': sezione_neutralizzazioni(giri, gare),
        'soste': sezione_soste(giri, gare, pitstops, f1db_stops, r2g, sigla_di),
        'pit_lane': sezione_pit_lane(pitstops, giri, gare),
        'ritiri': sezione_ritiri(f1db_res, uff, r2g, sigla_di, team_di, mappa),
        'osservabilita': sezione_osservabilita(tele_manifest, tele_files),
        'copertura_canonica': sezione_copertura_canonica(zf, r2g),
        'gomme': sezione_gomme(giri, gare),
    }


def senza_ora(dati):
    """Copia confrontabile: fuori cio' che dipende dall'INVOCAZIONE e non dal contenuto."""
    d = dict(dati)
    d.pop('calcolato_il', None)
    if isinstance(d.get('provenienza'), dict):
        d['provenienza'] = {k: v for k, v in d['provenienza'].items() if k != 'come'}
    return d


def testo(dati) -> str:
    return json.dumps(dati, ensure_ascii=False, indent=1) + '\n'


def riassunto(d) -> str:
    gt, ne, so, go = d['giri_testa'], d['neutralizzazioni'], d['soste'], d['gomme']
    righe = [
        f'  giri: {gt["giri_attribuiti"]}/{gt["giri_totali"]} attribuiti, '
        f'{len(gt["piloti"])} piloti hanno condotto',
    ]
    for p in gt['piloti'][:4]:
        righe.append(f'     {p["pilota"]:4} {p["totale"]:3} giri '
                     f'({p["verdi"]} verdi, {p["neutralizzati"]} neutralizzati)')
    tot_sc = sum(v['dispiegamenti']['sc'] for v in ne['per_gara'].values())
    tot_vsc = sum(v['dispiegamenti']['vsc'] for v in ne['per_gara'].values())
    tot_r = sum(v['dispiegamenti']['rosso'] for v in ne['per_gara'].values())
    q = sum(v['giri_auto_neutralizzati'] for v in ne['per_gara'].values()) / \
        max(1, sum(v['giri_auto_totali'] for v in ne['per_gara'].values()))
    righe.append(f'  neutralizzazioni: {tot_sc} SC, {tot_vsc} VSC, {tot_r} rosse · '
                 f'{q*100:.1f}% dei giri-auto')
    a = so['arbitro']
    righe.append(f'  soste: arbitro f1db {a["concordi"]}/{a["coppie_confrontate"]} concordi, '
                 f'{len(a["discordi"])} discordi · A=B {so["i_tre_conteggi"]["accordo_A_B"]}/'
                 f'{so["i_tre_conteggi"]["coppie"]}, A=C {so["i_tre_conteggi"]["accordo_A_C"]}/'
                 f'{so["i_tre_conteggi"]["coppie"]}')
    pl = d['pit_lane']['per_squadra']
    if pl:
        righe.append(f'  pit lane: {len(pl)} squadre · miglior scarto {pl[0]["team"]} '
                     f'{pl[0]["scarto_mediano_s"]:+.2f} s, peggiore {pl[-1]["team"]} '
                     f'{pl[-1]["scarto_mediano_s"]:+.2f} s (dalla mediana della gara)')
    ri = d['ritiri']
    righe.append(f'  ritiri: {ri["non_arrivati_totali"]} non arrivati, '
                 f'{ri["con_causa_dichiarata"]} con causa · raggruppamento '
                 + ('FIRMATO' if ri['raggruppamento']['firmato'] else 'NON firmato (testo grezzo)'))
    cc = d['copertura_canonica']['per_sessione']
    righe.append('  copertura canonica: ' + ' · '.join(
        f'{k} {v["round"]}' for k, v in cc.items() if v.get('presente')))
    o = d['osservabilita']
    righe.append(f'  osservabilita: {o["n_canali"]} canali pubblicati '
                 f'({", ".join(o["canali_pubblicati"])}) su {o["sessioni_con_telemetria"]} sessioni')
    m = ' · '.join(f'{c} med {v["mediana"]:.0f}g (n={v["n"]})'
                   for c, v in go['lunghezza_per_mescola'].items() if v)
    righe.append(f'  gomme: {go["stint_totali"]} stint, {go["giri_con_mescola"]} giri · {m}')
    return '\n'.join(righe)


def main() -> int:
    ap = argparse.ArgumentParser(description='statistiche dai giri della stagione 2026')
    ap.add_argument('--zip', help='percorso di uno zip f1db gia\' scaricato')
    ap.add_argument('--release', help='release f1db da usare (default: il pin)')
    ap.add_argument('--check', action='store_true',
                    help='rigenera e confronta col file su disco, senza scrivere')
    a = ap.parse_args()

    zf, letta, come, percorso = apri_release(a.release, a.zip)
    dati = costruisci(zf, letta, come, percorso)
    print(f'[stat_gara] f1db {letta} ({come}) · {len(dati["perimetro"]["gare"])} gare')
    print(riassunto(dati))

    if a.check:
        if not os.path.exists(DEST):
            print(f'[stat_gara] CHECK FALLITO: {os.path.relpath(DEST, ROOT)} non esiste.')
            return 1
        vecchio = json.load(open(DEST, encoding='utf-8'))
        if senza_ora(vecchio) == senza_ora(dati):
            print('[stat_gara] CHECK OK: identico al rigenerato (a parte calcolato_il).')
            return 0
        print('[stat_gara] CHECK FALLITO: il file su disco NON coincide col rigenerato.')
        for k in sorted(set(vecchio) | set(dati)):
            if senza_ora(vecchio).get(k) != senza_ora(dati).get(k):
                print(f'    diverge: {k}')
        return 1

    os.makedirs(os.path.dirname(DEST), exist_ok=True)
    with open(DEST, 'w', encoding='utf-8') as f:
        f.write(testo(dati))
    print(f'[stat_gara] scritto {os.path.relpath(DEST, ROOT)} ({os.path.getsize(DEST)} byte).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
