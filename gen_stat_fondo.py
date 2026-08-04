"""gen_stat_fondo.py — GENERATORE di demo/data/stat/fondo_anni.json (modulo C3).

COS'E': «quante gare di ogni stagione sono davvero usabili». NON aggiunge un confronto fra
stagioni: aggiunge LA MAPPA DI COSA E' CONFRONTABILE E COSA NO. E' il modulo piu' povero di
grafici e il piu' ricco di regole, ed e' cosi' per costruzione.

PERCHE' ESISTE. La pagina dei confronti fra stagioni oggi mostra solo cio' che f1db permette
(classifiche per round, dispersione in qualifica). Il FONDO — data/fondo/, otto stagioni di
grezzo per-giro — permetterebbe molto di piu': ci sono i giri veri, le mescole, gli stint, il
meteo, i microsettori. Ma il fondo e' pieno di buche che non si vedono da fuori: sei gare del
2019 sono un guscio con tre colonne, i microsettori mancano in ventinove file, il 2018 usa una
scala di mescole che nel 2019 non esiste piu', due gare durano tre e ventinove giri, e il 2026
non e' nel fondo affatto. Chi tirasse una serie 2018→2026 senza sapere queste cose
pubblicherebbe un grafico in cui meta' delle variazioni sono la fonte che cambia, non la F1.

Un pubblico di esperti la mappa delle buche la vuole. Questo file gliela da', con i numeri.

LA PORTA. Il grezzo si legge SOLO da lab/fondo.py, che e' l'unico punto del progetto che sa
dove stanno i file. Qui non si apre nessun percorso a mano tranne che in `percorso()`, che
esiste per la sola PROVENIENZA (gli sha dei file letti) e che si ricompone dalle costanti di
lab/fondo: se domani l'archivio cambia forma, `percorsi_non_risolti` diventa non-zero e il
JSON lo dice invece di pubblicare una provenienza vuota con l'aria di essere a posto.

NON SI USA data/fondo/_gare.json COME INDICE. E' la cache grezza della GitHub Contents API e
contiene voci che non sono gare ('cache', 'Pre-Season Test', 'cache_joblib', 'fastf1_cache').
Verificato qui e pubblicato nelle trappole.

E NON SI CREDE A lab/fondo.gare() SUL 2026, che dichiara 11 gare per OGNI sessione mentre le
sessioni davvero presenti sono Race 11, P1 10, P2 6, P3 6, Sprint 4, Qualifying 0. La causa e'
nel sorgente: `gare('2026', s)` unisce le gare del registro (sempre 11, sono le gare corse)
alle cartelle di ti_archive che hanno quella sessione, e il primo insieme non guarda la
sessione. Qui una sessione conta se e solo se restituisce delle RIGHE, e la divergenza fra il
dichiarato e il contato e' pubblicata come trappola.

Uso:
  python3 gen_stat_fondo.py                 # scrive demo/data/stat/fondo_anni.json
  python3 gen_stat_fondo.py --check         # rigenera, confronta, NON scrive
  python3 gen_stat_fondo.py [--zip <path>] [--release vX]
"""
from __future__ import annotations

import argparse
import collections
import datetime
import hashlib
import json
import os
import sys
import zipfile

import f1db_zip
import fondo_identita
import ingest_fondo_storico
from lab import fondo

ROOT = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.join(ROOT, 'demo', 'data', 'stat', 'fondo_anni.json')
DUPLICATO = os.path.join(ROOT, 'simulatore', 'data', 'fondo')
CACHE_INDICE = os.path.join(ROOT, 'data', 'fondo', '_gare.json')

# Il vocabolario delle sessioni viene dall'INGESTORE, non riscritto qui: chi domani
# aggiungesse 'Practice 4' lo aggiungerebbe li' e questo modulo lo conterebbe da solo.
SESSIONI = list(ingest_fondo_storico.SESSIONI_TUTTE)

MICRO = ('ms1', 'ms2', 'ms3')          # microsettori
METEO = ('wAT', 'wTT', 'wH', 'wR', 'wWS')   # aria, asfalto, umidita', pioggia, vento

# soglia della «gara accorciata» misurata DAL FONDO: giri corsi contro il massimo mai corso
# su quello stesso circuito. Non e' una verita', e' una regola dichiarata — e sotto c'e'
# scritto il caso in cui produce un falso positivo (yas-marina, che nel 2021 ha cambiato
# tracciato: meno giri senza nessuna bandiera rossa).
SOGLIA_CORTA = 0.98


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
    """(ZipFile, release_letta, come, percorso). Copiato da gen_stat_gara.py apposta: non si
    dichiara MAI una release da cui non si e' letto."""
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
        sys.exit(f'[stat_fondo] la release {pin} non e\' scaricabile e la cache e\' vuota.')
    ripiego = disponibili[-1].split('f1db-csv-')[1].removesuffix('.zip')
    print(f'[stat_fondo] ATTENZIONE: {pin} non disponibile, ripiego su {ripiego} dalla cache.')
    p = f1db_zip.percorso_zip(ripiego)
    return zipfile.ZipFile(p), ripiego, 'ripiego dalla cache', p


def num(x, d=None):
    try:
        return int(float(x))
    except (TypeError, ValueError):
        return d


def percorso(anno, gara, sessione):
    """SOLO PER LA PROVENIENZA. Ricompone il percorso di un file gia' letto dalla porta,
    usando le costanti di lab/fondo — non stringhe scritte qui. Se lab/fondo cambiasse
    layout questa funzione tornerebbe None e il JSON pubblicherebbe il conto dei percorsi
    non risolti, invece di una lista di sha silenziosamente vuota."""
    anno = str(anno)
    if anno == '2026':
        p = os.path.join(fondo.ARCH, '2026', gara, sessione + '.json')
        if os.path.exists(p):
            return p
        if sessione == 'Race':
            return fondo._percorsi_2026().get(gara)
        return None
    p = os.path.join(fondo.FONDO, anno, gara, sessione + '.json.gz')
    return p if os.path.exists(p) else None


# --------------------------------------------------------------------- lettura del fondo

def scandisci():
    """Legge TUTTO il grezzo una volta sola e restituisce {anno: {(gara, sessione): scheda}}.

    Misurato: 837 file storici + 37 del 2026, 466.830 + 26.032 righe, sotto i tre secondi.
    Non si campiona niente: campionare qui vorrebbe dire pubblicare una mappa delle buche
    ricavata guardando meta' del terreno.
    """
    out = {}
    for anno in fondo.anni():
        # CANDIDATI dalla porta, VERITA' dalle righe. fondo.gare() e' affidabile sullo
        # storico (guarda i file) e bugiardo sul 2026 (unisce il registro a prescindere
        # dalla sessione): l'unione sulle sessioni resta comunque l'elenco giusto delle
        # GARE, ed e' solo il «quali sessioni» che qui si ricava contando le righe.
        candidati = sorted({g for s in SESSIONI for g in fondo.gare(anno, s)})
        schede = {}
        for gara in candidati:
            for sess in SESSIONI:
                righe = fondo.giri(anno, gara, sess)
                if not righe:
                    continue
                cols = set(righe[0])
                piena = all(k in cols for k in fondo.CHIAVE)
                verdi = sum(1 for r in righe if fondo.verde(r)) if piena else 0
                schede[(gara, sess)] = {
                    'colonne': sorted(cols),
                    'n_colonne': len(cols),
                    'righe': len(righe),
                    'piena': piena,
                    'micro': all(k in cols for k in MICRO),
                    'meteo': all(k in cols for k in METEO),
                    'verdi': verdi,
                    # verde() SU UNA SESSIONE MUTILATA direbbe di si': le colonne che lo
                    # smentirebbero (status, pin, pout) non ci sono, e un campo assente
                    # non contraddice nessuno. Si misura apposta, e' la trappola in forma pura.
                    'verdi_se_non_si_guardassero_le_colonne':
                        sum(1 for r in righe if fondo.verde(r)),
                    'compound': collections.Counter(
                        r['compound'] for r in righe if r.get('compound')),
                    'team': collections.Counter(r['team'] for r in righe if r.get('team')),
                    'cancellati': sum(1 for r in righe if r.get('del') in (True, 'True')),
                    'giro_max': max((num(r['lap'], 0) or 0 for r in righe), default=0),
                }
        out[str(anno)] = schede
    return out


# --------------------------------------------------------------------- f1db, per il calendario

def calendario_f1db(zf):
    """{anno: {'gare': n, 'sprint': n, 'per_circuito': {cid: [righe]}}}. Nient'altro: il
    calendario e' l'unica cosa che il fondo non puo' sapere di se stesso (una gara che nessuno
    ha mai scaricato non lascia traccia nella cartella)."""
    races = f1db_zip.tabella(zf, 'races')
    sprint = f1db_zip.tabella(zf, 'races-sprint-race-results')
    out = collections.defaultdict(lambda: {'gare': 0, 'sprint': 0, 'per_circuito': {}})
    for r in races:
        a = num(r['year'])
        if a is None:
            continue
        v = out[a]
        v['gare'] += 1
        v['per_circuito'].setdefault(r['circuitId'], []).append(r)
    # le sprint si contano dalle GARE con almeno un risultato sprint, non dal campo
    # sprintRaceDate: verificato, quel campo e' valorizzato solo dal 2024 in poi mentre le
    # sprint esistono dal 2021, e chi lo usasse concluderebbe che nel 2021 non ce n'erano.
    per_gara = collections.defaultdict(set)
    for r in sprint:
        a = num(r['year'])
        if a is not None:
            per_gara[a].add(r['raceId'])
    for a, s in per_gara.items():
        out[a]['sprint'] = len(s)
    return out


# --------------------------------------------------------------------- le sezioni per anno

def riga_anno(anno, schede, cal):
    a = int(anno)
    gare = sorted({g for g, _ in schede})
    sess_per_tipo = collections.Counter(s for _, s in schede)
    piene = {g for (g, s), v in schede.items() if s == 'Race' and v['piena']}
    mutilate = sorted(g for g in gare if g not in piene)

    def gare_con(chiave):
        """una GARA porta la colonna quando TUTTE le sue sessioni presenti la portano: se P1
        ce l'ha e la Race no, il weekend non e' confrontabile con uno che ce l'ha dappertutto"""
        return sorted(g for g in gare
                      if all(v[chiave] for (gg, _), v in schede.items() if gg == g))

    compound = collections.Counter()
    team = collections.Counter()
    for v in schede.values():
        compound.update(v['compound'])
        team.update(v['team'])

    righe_tot = sum(v['righe'] for v in schede.values())
    verdi_tot = sum(v['verdi'] for v in schede.values())
    canc_gara = sum(v['cancellati'] for (_, s), v in schede.items() if s == 'Race')

    # RICONOSCIUTE = quelle che lab/fondo.ASCIUTTE / BAGNATE conoscono. Il resto NON e'
    # spazzatura per definizione: nel 2018 sono gomme asciutte vere che il vocabolario del
    # 2019 non prevede. Si pubblica il valore e il suo peso, e la distinzione fra «gomma che
    # il vocabolario non conosce» e «segnaposto» la fa il lettore con i numeri sotto gli occhi.
    asciutte = [c for c in sorted(compound) if c in fondo.ASCIUTTE]
    bagnate = [c for c in sorted(compound) if c in fondo.BAGNATE]
    fuori = {c: compound[c] for c in sorted(compound)
             if c not in fondo.ASCIUTTE + fondo.BAGNATE}

    micro = gare_con('micro')
    meteo = gare_con('meteo')
    return {
        'anno': a,
        'catena': 'fondo storico (data/fondo, ingest_fondo_storico.py)' if a != 2026
                  else 'ingestione 2026 (data/ti_archive/2026 + data/ti_cache, ingest_ti2026.py)',
        'gare_in_calendario': cal.get(a, {}).get('gare'),
        'gare_nel_fondo': len(gare),
        'gare_piene': len(piene),
        'gare_guscio': mutilate,
        'con_microsettori': {'gare': len(micro), 'sessioni':
                             sum(1 for v in schede.values() if v['micro'])},
        'con_meteo': {'gare': len(meteo), 'sessioni':
                      sum(1 for v in schede.values() if v['meteo'])},
        'sessioni_per_tipo': {s: sess_per_tipo.get(s, 0) for s in SESSIONI},
        'sessioni_totali': len(schede),
        'sessioni_piene': sum(1 for v in schede.values() if v['piena']),
        'sprint_in_calendario': cal.get(a, {}).get('sprint', 0),
        'giri_totali': righe_tot,
        'giri_utilizzabili': verdi_tot,
        'quota_utilizzabile': round(verdi_tot / righe_tot, 4) if righe_tot else None,
        'giri_cancellati_in_gara': canc_gara,
        'giri_cancellati_ovunque': sum(v['cancellati'] for v in schede.values()),
        'mescole': {
            'distinte': len(compound),
            'riconosciute_asciutte': asciutte,
            'riconosciute_bagnate': bagnate,
            'fuori_dal_vocabolario': fuori,
            'giri_con_mescola': sum(compound.values()),
            'giri_riconosciuti_asciutti': sum(compound[c] for c in asciutte),
            'giri_fuori_dal_vocabolario': sum(fuori.values()),
        },
        'squadre': {'distinte': len(team), 'nomi': sorted(team)},
        'colonne_per_sessione': {str(k): v for k, v in sorted(
            collections.Counter(v['n_colonne'] for v in schede.values()).items())},
    }


# --------------------------------------------------------------------- le trappole

def trappola_mescole(per_anno):
    """2018 usa una scala ASSOLUTA (piu' nomi, ognuno una gomma fisica); dal 2019 i nomi sono
    RELATIVI e riassegnati a ogni gara."""
    return {
        'verdetto': 'CONFERMATA, con una precisazione sul conteggio',
        'cosa_significa': 'nel 2018 i nomi delle mescole asciutte sono una SCALA ASSOLUTA: '
                          'HYPERSOFT, ULTRASOFT, SUPERSOFT, SOFT, MEDIUM, HARD sono sei gomme '
                          'fisiche diverse e il nome dice quale. Dal 2019 i nomi asciutti sono '
                          'tre — SOFT, MEDIUM, HARD — e sono RELATIVI: indicano la posizione '
                          'nella terna scelta per quella gara, e la terna cambia gara per gara.',
        'conseguenza': '«SOFT 2018» e «SOFT 2019» non sono la stessa gomma ne\' la stessa '
                       'posizione nella gamma. Qualunque serie storica per nome di mescola che '
                       'attraversi il confine 2018/2019 confronta due vocabolari, non due gomme.',
        'precisazione': 'i nomi asciutti che il fondo 2018 contiene davvero sono SEI. Il numero '
                        'pubblicato e\' quello CONTATO nei dati, non quello della gamma '
                        'annunciata: un nome previsto e mai usato in pista non lascia righe, e '
                        'qui si contano le righe.',
        'riconosciute_per_anno': {str(r['anno']): r['mescole']['riconosciute_asciutte']
                                  for r in per_anno},
        'fuori_dal_vocabolario_per_anno': {str(r['anno']): r['mescole']['fuori_dal_vocabolario']
                                           for r in per_anno
                                           if r['mescole']['fuori_dal_vocabolario']},
        'il_costo_misurato': {
            'cosa_succede': 'lab/fondo.ASCIUTTE vale (SOFT, MEDIUM, HARD): e\' il vocabolario '
                            'dal 2019 in poi. Applicato al 2018 scarta HYPERSOFT, ULTRASOFT e '
                            'SUPERSOFT, che sono gomme asciutte a tutti gli effetti — e sono la '
                            'maggioranza dei giri di quella stagione. Non e\' un difetto di '
                            'lab/fondo: e\' il prezzo di avere UN vocabolario per due ere. Ma '
                            'chi legge giri_utilizzabili del 2018 deve sapere che quel numero '
                            'non e\' confrontabile con quello del 2019.',
            'per_anno': {str(r['anno']): {
                'giri_con_mescola': r['mescole']['giri_con_mescola'],
                'riconosciuti_asciutti': r['mescole']['giri_riconosciuti_asciutti'],
                'fuori_dal_vocabolario': r['mescole']['giri_fuori_dal_vocabolario'],
                'quota_fuori': round(r['mescole']['giri_fuori_dal_vocabolario']
                                     / r['mescole']['giri_con_mescola'], 4)
                if r['mescole']['giri_con_mescola'] else None,
            } for r in per_anno},
        },
        'due_specie_dentro_fuori_dal_vocabolario': 'i valori non riconosciuti sono di due specie '
                                                   'e vanno letti diversamente: GOMME VERE che il '
                                                   'vocabolario non prevede (HYPERSOFT, '
                                                   'ULTRASOFT, SUPERSOFT nel 2018) e SEGNAPOSTO '
                                                   'travestiti da valore (TEST, TEST_UNKNOWN, '
                                                   'UNKNOWN e, nel 2019, la stringa \'nan\'). '
                                                   'I conteggi qui sopra tengono i due casi '
                                                   'separati per anno, cosi\' si vede quale dei '
                                                   'due pesa.',
    }


def trappola_accorciate(per_gara, cal):
    """DUE misure indipendenti, e la loro discordanza.

    f1db  : laps < scheduledLaps, cioe' la gara e' stata dichiarata finita prima.
    fondo : giri registrati contro il massimo mai registrato su quel circuito.
    """
    # ---- la misura f1db, incrociata per cid dove l'incrocio e' sicuro
    joinabili, ambigue, fuori_vocabolario = [], [], []
    accorciate_f1db = []
    divergenze = []
    for (anno, gara), v in sorted(per_gara.items()):
        c = fondo_identita.cid(gara)
        righe = cal.get(int(anno), {}).get('per_circuito', {}).get(c, []) if c else []
        if not righe:
            fuori_vocabolario.append({'anno': int(anno), 'gara': gara, 'cid': c})
            continue
        corte = [r for r in righe if num(r['laps']) is not None
                 and num(r['scheduledLaps']) is not None
                 and num(r['laps']) < num(r['scheduledLaps'])]
        if len(righe) > 1:
            # DUE GARE SULLO STESSO CIRCUITO NELLO STESSO ANNO: non si sa quale sia quale, ma
            # se NESSUNA delle due e' accorciata la risposta e' la stessa comunque.
            if not corte:
                ambigue.append({'anno': int(anno), 'gara': gara, 'cid': c,
                                'gp_f1db': sorted(r['grandPrixId'] for r in righe),
                                'esito': 'nessuna delle due e\' accorciata: la risposta non '
                                         'dipende da quale sia quale'})
                joinabili.append((anno, gara))
            else:
                ambigue.append({'anno': int(anno), 'gara': gara, 'cid': c,
                                'gp_f1db': sorted(r['grandPrixId'] for r in righe),
                                'esito': 'INDECIDIBILE per cid'})
            continue
        joinabili.append((anno, gara))
        r = righe[0]
        l, s = num(r['laps']), num(r['scheduledLaps'])
        if l is not None and s and l < s:
            accorciate_f1db.append({'anno': int(anno), 'gara': gara,
                                    'giri_f1db': l, 'giri_previsti': s,
                                    'quota': round(l / s, 3), 'giri_nel_fondo': v['giro_max']})
        if l is not None and l != v['giro_max']:
            divergenze.append({'anno': int(anno), 'gara': gara, 'giri_f1db': l,
                               'giri_nel_fondo': v['giro_max']})

    # ---- la misura interna al fondo: giri contro il massimo dello stesso circuito
    per_cid = collections.defaultdict(dict)
    for (anno, gara), v in per_gara.items():
        per_cid[fondo_identita.cid(gara)][f'{anno} {gara}'] = v['giro_max']
    sospette = []
    for c, v in per_cid.items():
        top = max(v.values()) if v else 0
        for k, m in sorted(v.items()):
            if top and m < SOGLIA_CORTA * top:
                sospette.append({'circuito': c, 'gara': k, 'giri': m, 'massimo_del_circuito': top,
                                 'quota': round(m / top, 3)})
    sospette.sort(key=lambda x: x['quota'])

    return {
        'verdetto': 'CONFERMATA — e le due gare citate non sono le uniche',
        'regola_f1db': 'una gara e\' accorciata quando f1db races.laps < races.scheduledLaps. '
                       'E\' la misura giusta perche\' guarda cosa era PREVISTO, non cosa e\' '
                       'tipico.',
        'regola_fondo': f'seconda misura, indipendente: giri registrati nel fondo sotto il '
                        f'{SOGLIA_CORTA:.0%} del massimo mai registrato su quello stesso '
                        f'circuito. Serve dove l\'incrocio con f1db non e\' sicuro, e produce '
                        f'FALSI POSITIVI quando un circuito cambia tracciato — yas-marina, '
                        f'accorciato nel 2021 di tre curve, corre 58 giri dal 2021 e 55 prima: '
                        f'i tre anni vecchi risultano «corti» senza nessuna bandiera rossa.',
        'accorciate_f1db': accorciate_f1db,
        'sospette_dal_fondo': sospette,
        'incrocio': {
            'metodo': 'gara del fondo -> cid (fondo_identita.NOME2CID) -> f1db races.circuitId',
            'gare_incrociate': len(joinabili),
            'gare_totali': len(per_gara),
            'ambigue': ambigue,
            'fuori_vocabolario': fuori_vocabolario,
        },
        'divergenza_giri': {
            'cosa_e': 'il giro piu\' alto REGISTRATO nel fondo e i giri CLASSIFICATI da f1db '
                      'non sempre coincidono. Non e\' un errore di nessuno dei due: quando la '
                      'bandiera a scacchi esce in anticipo o la gara viene chiusa in regime di '
                      'bandiera rossa, le auto un giro lo percorrono e la classifica non lo conta.',
            'casi': divergenze,
        },
    }


def trappola_cancellati(per_anno):
    return {
        'verdetto': 'CONFERMATA',
        'cosa_dice': 'il flag `del` (giro cancellato per track limits) vale zero nel 2018 e due '
                     'in tutta la stagione 2019, poi centinaia ogni anno. Non e\' la F1 che ha '
                     'cominciato a cancellare giri nel 2020: e\' la fonte che ha cominciato a '
                     'registrarli.',
        'conseguenza': 'una serie «giri cancellati per stagione» che parta dal 2018 racconta la '
                       'storia della fonte e la spaccia per storia dello sport. Il campo si puo\' '
                       'usare dal 2020 in avanti, e va detto.',
        'in_gara': {str(r['anno']): r['giri_cancellati_in_gara'] for r in per_anno},
        'in_tutte_le_sessioni': {str(r['anno']): r['giri_cancellati_ovunque'] for r in per_anno},
        'nota_denominatore': 'i due conteggi sono diversi e diranno cose diverse: nel 2019 due '
                             'in gara e ventotto contando le libere. Chi cita «due» e chi cita '
                             '«ventotto» hanno ragione tutti e due su domande diverse.',
    }


def trappola_2020(per_gara, cal):
    per_cid = collections.defaultdict(list)
    senza_identita = []
    for (anno, gara) in sorted(per_gara):
        c = fondo_identita.cid(gara)
        if not c:
            # una gara senza identita' non puo' entrare in un conteggio per circuito: sarebbe
            # un circuito finto che compare una volta sola. Sta nella sua trappola, non qui.
            senza_identita.append(f'{anno} {gara}')
            continue
        per_cid[c].append(f'{anno} {gara}')
    una_volta = {c: v[0] for c, v in sorted(per_cid.items()) if len(v) == 1}
    doppie = collections.defaultdict(list)
    for c, v in per_cid.items():
        conta = collections.Counter(k.split(' ')[0] for k in v)
        for anno, n in conta.items():
            if n > 1:
                doppie[f'{anno} {c}'] = sorted(k for k in v if k.startswith(anno))

    # la lunghezza del giro, da f1db: e' il numero che rende la separazione un fatto e non
    # un'opinione sui nomi
    lung = {}
    for a, v in cal.items():
        for c, righe in v['per_circuito'].items():
            for r in righe:
                if r['grandPrixId'] in ('bahrain', 'sakhir') and a == 2020:
                    lung[r['grandPrixId']] = {'circuitId': r['circuitId'],
                                              'circuitLayoutId': r['circuitLayoutId'],
                                              'km': r['courseLength'], 'giri': num(r['laps'])}
    return {
        'verdetto': 'CONFERMATA, e vale anche per il 2021',
        'cosa_dice': 'il 2020 e\' la stagione con il calendario piu\' anomalo del fondo: sedici '
                     'gare invece di ventidue, tre circuiti che compaiono una volta sola in otto '
                     'anni, e due weekend consecutivi sulla stessa pista due volte.',
        'circuiti_una_volta_sola': una_volta,
        'due_gare_stessa_pista_stesso_anno': dict(sorted(doppie.items())),
        'gare_fuori_dal_conteggio_perche_senza_cid': senza_identita,
        'precisazione': 'la doppietta a spielberg NON e\' solo del 2020: anche il 2021 ha '
                        'Austrian e Styrian sullo stesso circuito. Chi filtrasse «un anno = una '
                        'gara per circuito» perderebbe una gara in due stagioni, non in una.',
        'sakhir_non_e_il_bahrain': {
            'cosa_dice': 'il Sakhir Grand Prix 2020 e\' il tracciato ESTERNO dello stesso '
                         'autodromo, non il Bahrain Grand Prix. Sommarli mette due piste diverse '
                         'nella stessa cella.',
            'prova_f1db': lung,
            'nel_progetto': 'fondo_identita.py li tiene separati (bahrain vs bahrain-outer), '
                            'ed e\' l\'unica ragione per cui questo modulo puo\' contarli bene.',
        },
    }


def trappola_squadre(per_anno, schede_per_anno):
    # la spaccatura DENTRO una stagione: due nomi che si dividono le gare invece di coprirle tutte
    dentro = {}
    for anno, schede in sorted(schede_per_anno.items()):
        # IL DENOMINATORE SONO LE GARE PIENE, non tutte. Contando anche i gusci del 2019 —
        # che il campo `team` non ce l'hanno affatto — TUTTE le squadre risulterebbero a
        # copertura parziale (quindici gare su ventuno) e la trappola direbbe una cosa falsa
        # su una stagione intera. Una colonna assente non e' una squadra che non ha corso.
        gare_piene = {g for (g, s), v in schede.items() if s == 'Race' and v['piena']}
        per_team_gara = collections.defaultdict(set)
        for (g, s), v in schede.items():
            if s == 'Race' and g in gare_piene:
                for t in v['team']:
                    per_team_gara[t].add(g)
        parziali = {t: len(v) for t, v in sorted(per_team_gara.items())
                    if len(v) < len(gare_piene)}
        if parziali:
            dentro[anno] = {'gare_piene_in_stagione': len(gare_piene),
                            'squadre_a_copertura_parziale': parziali,
                            'contate_sulle_gare': True}
    tutti = sorted({t for r in per_anno for t in r['squadre']['nomi']})
    return {
        'verdetto': 'CONFERMATA',
        'cosa_dice': 'il campo `team` e\' il nome commerciale del momento, non l\'identita\' '
                     'della squadra. Cambia fra stagioni e — nel 2018 — cambia DENTRO la '
                     'stagione: Force India corre dodici gare e Racing Point nove, come due '
                     'entita\' separate, e nessun campo del fondo dice che sono la stessa.',
        'conseguenza': 'qualunque aggregazione per squadra che attraversi gli anni somma cose '
                       'che il dato non dichiara uguali, e nel 2018 spacca in due una squadra '
                       'anche restando dentro l\'anno. La congiunzione va DICHIARATA da fuori '
                       '(come fa demo/team_colori.json per il 2026), mai dedotta dal campo.',
        'nomi_distinti_in_tutto_il_fondo': len(tutti),
        'nomi': tutti,
        'nomi_per_anno': {str(r['anno']): r['squadre']['nomi'] for r in per_anno},
        'copertura_parziale_dentro_la_stagione': dentro,
        'nota_conteggio': 'i dodici e i nove sono contati sulle GARE. Contando tutte le sessioni '
                          'Force India arriva a tredici, perche\' in un weekend compaiono '
                          'entrambe le ragioni sociali: il cambio non e\' avvenuto fra due gare, '
                          'e\' avvenuto dentro un weekend.',
    }


def trappola_2026(schede_per_anno):
    s26 = schede_per_anno.get('2026', {})
    dichiarate = {s: len(fondo.gare('2026', s)) for s in SESSIONI}
    contate = {s: sum(1 for (_, ss) in s26 if ss == s) for s in SESSIONI}
    reg = json.load(open(fondo.REG, encoding='utf-8'))
    ti_cache = sorted({os.path.basename(v['raw']) for v in reg.values()
                       if 'ti_cache' in v['raw']})
    return {
        'verdetto': 'CONFERMATA',
        'cosa_dice': 'data/fondo/ contiene 2018-2025 e basta. Il 2026 arriva da un\'ingestione '
                     'DIVERSA — data/ti_archive/2026/ per le sessioni del weekend e '
                     'data/ti_cache/ per le gare piu\' vecchie — con file .json non compressi '
                     'invece di .json.gz e con i nomi dei file decisi da data/gare_registro.json.',
        'conseguenza': 'la colonna 2026 di qualunque serie storica di questo progetto viene da '
                       'una catena di produzione diversa dalle altre otto. Va scritto come riga '
                       'propria in ogni tabella: non e\' il nono punto della stessa serie.',
        'radici': {'storico': 'data/fondo/{anno}/{Gara}/{Sessione}.json.gz',
                   '2026_weekend': 'data/ti_archive/2026/{Gara}/{Sessione}.json',
                   '2026_gare_vecchie': 'data/ti_cache/{Nome}.json (mappa: data/gare_registro.json)'},
        'gare_dal_ti_cache': ti_cache,
        'copertura_dichiarata_da_lab_fondo': dichiarate,
        'copertura_contata_sui_file': contate,
        'la_bugia': 'lab/fondo.gare(2026, sessione) risponde 11 per OGNI sessione, comprese '
                    'Qualifying (che non c\'e\' affatto) e Practice 2 (che ce n\'e\' sei). La '
                    'causa e\' nel sorgente: le gare del registro entrano nell\'insieme senza '
                    'guardare la sessione richiesta, e solo le cartelle di ti_archive vengono '
                    'filtrate. Chi conta le sessioni del 2026 con quella funzione pubblica '
                    'undici qualifiche che non esistono.',
        'come_si_conta_bene': 'una sessione esiste se e solo se fondo.giri() restituisce righe. '
                              'E\' la regola usata da questo generatore.',
    }


def trappola_spagna_2026(schede_per_anno):
    cartelle = sorted({g for g, _ in schede_per_anno.get('2026', {})})
    mappa = {g: fondo_identita.cid(g) for g in cartelle}
    orfane = sorted(g for g, c in mappa.items() if not c)
    return {
        'verdetto': 'CONFERMATA',
        'cosa_dice': 'la cartella del Gran Premio di Spagna 2026 si chiama «Barcelona Grand '
                     'Prix». fondo_identita.NOME2CID non contiene quella chiave (contiene '
                     '«Spanish Grand Prix»), quindi cid() torna None.',
        'perche_e_silenziosa': 'i generatori che incrociano per circuito scrivono '
                               '`c = cid(gara)` seguito da `if not c: continue`. Una gara senza '
                               'identita\' non produce un errore: produce una riga in meno. '
                               'Il conto finale sembra giusto perche\' non c\'e\' niente con cui '
                               'confrontarlo.',
        'cartelle_2026_e_loro_cid': mappa,
        'orfane': orfane,
        'gare_2026_perse_da_un_incrocio_per_cid': len(orfane),
        'gare_2026_totali': len(cartelle),
        'nota': 'il registro data/gare_registro.json la mappa correttamente (Spagna -> '
                'catalunya): l\'identita\' esiste, e\' NOME2CID che non la vede. Due mappe che '
                'dicono cose diverse sulla stessa gara.',
    }


def trappola_duplicato(schede_per_anno):
    def censisci(radice, sep):
        if not os.path.isdir(radice):
            return None
        anni, file = [], 0
        for y in sorted(os.listdir(radice)):
            d = os.path.join(radice, y)
            if not (y.isdigit() and os.path.isdir(d)):
                continue
            anni.append(y)
            for g in os.listdir(d):
                gd = os.path.join(d, g)
                if os.path.isdir(gd):
                    file += sum(1 for f in os.listdir(gd) if f.endswith('.json.gz'))
        return {'radice': os.path.relpath(radice, ROOT), 'anni': anni, 'file': file,
                'convenzione': sep}

    a = censisci(fondo.FONDO, 'nomi con SPAZI: «Italian Grand Prix/Practice 1.json.gz»')
    b = censisci(DUPLICATO, 'nomi con UNDERSCORE: «Italian_Grand_Prix/Practice_1.json.gz»')
    # una coppia di prova: se i byte coincidono non e' una variante, e' una copia
    p1 = os.path.join(fondo.FONDO, '2022', 'Italian Grand Prix', 'Race.json.gz')
    p2 = os.path.join(DUPLICATO, '2022', 'Italian_Grand_Prix', 'Race.json.gz')
    return {
        'verdetto': 'CONFERMATA',
        'cosa_dice': 'lo stesso fondo esiste due volte nel repo, sotto due radici, con due '
                     'convenzioni di nome diverse.',
        'porte': [x for x in (a, b) if x],
        'prova_identita': {'file': '2022 Italian Grand Prix / Race',
                           'sha256_12_data_fondo': sha256_12(p1),
                           'sha256_12_simulatore': sha256_12(p2),
                           'identici': bool(sha256_12(p1)) and sha256_12(p1) == sha256_12(p2)},
        'perche_e_pericolosa': 'codice che sceglie la radice sbagliata NON fallisce: trova zero '
                               'gare, o le trova e non trova le sessioni, perche\' cerca '
                               '«Practice 1» dove il file si chiama «Practice_1». Un errore che '
                               'si presenta come un dato piu\' scarso, non come un errore.',
        'la_porta_giusta': 'lab/fondo.py, che legge data/fondo. Questo modulo non apre mai '
                           'l\'altra radice se non per contarla, qui.',
    }


def trappola_indice(schede_per_anno):
    if not os.path.exists(CACHE_INDICE):
        return {'verdetto': 'NON VERIFICABILE: data/fondo/_gare.json non esiste'}
    cache = json.load(open(CACHE_INDICE, encoding='utf-8'))
    non_gare = {}
    for anno, voci in sorted(cache.items()):
        vere = {g for g, _ in schede_per_anno.get(anno, {})}
        estranee = sorted(v for v in voci if v not in vere)
        if estranee:
            non_gare[anno] = estranee
    return {
        'verdetto': 'CONFERMATA',
        'cosa_dice': 'data/fondo/_gare.json e\' la cache grezza della GitHub Contents API, '
                     'salvata per non consumare le sessanta chiamate all\'ora concesse. Elenca '
                     'le CARTELLE del repository remoto, e li\' dentro ci sono anche cartelle '
                     'che non sono gare.',
        'voci_che_non_sono_gare': non_gare,
        'conseguenza': 'chi lo usasse come indice conterebbe fino a quattro gare in piu\' per '
                       'stagione, e proverebbe a leggere sessioni dentro una cartella di cache.',
        'indice_giusto': 'lab/fondo.gare(anno), che guarda i file davvero presenti.',
    }


def trappola_microsettori(schede_per_anno):
    senza = collections.defaultdict(lambda: collections.defaultdict(list))
    for anno, schede in sorted(schede_per_anno.items()):
        for (g, s), v in sorted(schede.items()):
            if not v['micro'] and v['piena']:
                senza[anno][g].append(s)
    dettaglio = {a: {g: v for g, v in sorted(gs.items())} for a, gs in sorted(senza.items())}
    n_file = {a: sum(len(v) for v in gs.values()) for a, gs in dettaglio.items()}
    tocca_race = {a: sorted(g for g, ss in gs.items() if 'Race' in ss)
                  for a, gs in dettaglio.items()}
    return {
        'verdetto': 'CONFERMATA per il 2024, ma NON e\' un fatto solo del 2024',
        'cosa_dice': 'le colonne ms1/ms2/ms3 — i microsettori, che nel resto del sito sono i '
                     'settori S1/S2/S3 — mancano in ventinove file del 2024, distribuiti su '
                     'otto weekend e sempre nelle sessioni diverse dalla gara.',
        'precisazione': 'la stessa lacuna c\'e\' nel 2026, e li\' TOCCA ANCHE LE GARE: Belgio, '
                        'Gran Bretagna e Ungheria non hanno microsettori nemmeno in gara. Non e\' '
                        'un incidente di una stagione, e\' un\'intermittenza della fonte.',
        'file_senza_microsettori_per_anno': n_file,
        'dettaglio': dettaglio,
        'weekend_in_cui_manca_anche_in_gara': {a: v for a, v in tocca_race.items() if v},
        'come_si_riconosce': 'una sessione senza microsettori ha 39 colonne invece di 42. '
                             '(Le sessioni di qualifica ne hanno 43: una in piu\', `qs`, che dice '
                             'in quale segmento — Q1/Q2/Q3 — e\' stato fatto il giro.)',
    }


def trappola_sprint(per_anno):
    return {
        'verdetto': 'CONFERMATA',
        'cosa_dice': 'nel 2021 il fondo non ha nemmeno un file Sprint, e le sprint si sono corse: '
                     'f1db ne registra tre in quella stagione. Il 2022 ne ha tre, e ci sono. '
                     'Il buco e\' solo del 2021.',
        'per_anno': {str(r['anno']): {'sprint_nel_fondo': r['sessioni_per_tipo'].get('Sprint', 0),
                                      'sprint_in_calendario': r['sprint_in_calendario']}
                     for r in per_anno},
        'conseguenza': 'una serie «giri di gara per stagione» che sommi Race e Sprint ha nel 2021 '
                       'un avvallamento che non e\' successo in pista.',
        'come_si_conta_il_calendario': 'dalle gare con almeno un risultato in f1db '
                                       'races-sprint-race-results. NON dal campo '
                                       'races.sprintRaceDate: verificato, e\' valorizzato solo '
                                       'dal 2024 in poi e farebbe concludere che prima non ce '
                                       'n\'erano.',
    }


def trappola_guscio_2019(schede_per_anno):
    gusci = {}
    for anno, schede in sorted(schede_per_anno.items()):
        for (g, s), v in sorted(schede.items()):
            if not v['piena']:
                gusci.setdefault(anno, {}).setdefault(g, []).append(
                    {'sessione': s, 'colonne': v['colonne'], 'righe': v['righe'],
                     'giri_che_verde_direbbe_utilizzabili':
                         v['verdi_se_non_si_guardassero_le_colonne']})
    tot = sum(len(ss) for gs in gusci.values() for ss in gs.values())
    falsi = sum(x['giri_che_verde_direbbe_utilizzabili']
                for gs in gusci.values() for ss in gs.values() for x in ss)
    return {
        'verdetto': 'CONFERMATA',
        'cosa_dice': 'sei gare del 2019 — Mexican, Monaco, Russian, Singapore, Spanish, United '
                     'States — hanno TRE sole colonne in tutte e cinque le sessioni: compound, '
                     'lap, time. Manca perfino `drv`, quindi un giro non si puo\' attribuire a '
                     'un pilota.',
        'sessioni_mutilate': tot,
        'dettaglio': gusci,
        'perche_e_la_trappola_peggiore': 'il test di lab/fondo.verde() — «giro cronometrato, in '
                                         'verde, asciutto, fuori dai box» — su queste righe '
                                         'risponde di SI\', perche\' le colonne che lo '
                                         'smentirebbero (status, pin, pout) non ci sono e un '
                                         'campo assente non contraddice nessuno. Un contatore '
                                         'ingenuo aggiungerebbe '
                                         f'{falsi} giri «utilizzabili» che non sono attribuibili '
                                         'a nessuno.',
        'giri_che_un_contatore_ingenuo_aggiungerebbe': falsi,
        'come_si_evita': 'giri_utilizzabili conta solo dentro le sessioni PIENE, cioe\' quelle '
                         'che portano tutte e nove le colonne di lab/fondo.CHIAVE.',
    }


def trappola_cid_vs_f1db(cal):
    ids = {c for v in cal.values() for c in v['per_circuito']}
    nostri = {fondo_identita.cid(g) for g in fondo_identita.cartelle_del_fondo()}
    fuori = sorted(c for c in nostri if c and c not in ids)
    return {
        'verdetto': 'TROVATA QUI, non era nell\'elenco di partenza',
        'cosa_dice': 'il vocabolario dei circuiti del progetto (fondo_identita.NOME2CID) e i '
                     'circuitId di f1db non coincidono su due piste.',
        'cid_del_fondo_che_f1db_non_conosce': fuori,
        'traduzione': {'hockenheim': 'f1db lo chiama hockenheimring',
                       'bahrain-outer': 'f1db non ha un circuitId a parte: usa circuitId '
                                        '«bahrain» con circuitLayoutId «bahrain-3» '
                                        '(3,543 km) contro «bahrain-1» (5,412 km)'},
        'perche_conta': 'un incrocio fondo-f1db fatto per cid perde in silenzio le gare su '
                        'quelle due piste — e una delle perse, il Gran Premio di Germania 2019, '
                        'e\' una gara ACCORCIATA (64 giri sui 67 previsti). La trappola non '
                        'toglie solo righe: toglie proprio le righe anomale, che sono quelle '
                        'per cui si guarda.',
    }


# --------------------------------------------------------------------- assemblaggio

def costruisci(zf, release_letta, come, percorso_zip):
    schede_per_anno = scandisci()
    cal = calendario_f1db(zf)

    anni = sorted(int(a) for a in schede_per_anno)
    per_anno = [riga_anno(a, schede_per_anno[str(a)], cal) for a in anni]

    # (anno, gara) -> aggregato di gara, per le trappole che ragionano per gara
    per_gara = {}
    for anno, schede in schede_per_anno.items():
        for (g, s), v in schede.items():
            if s != 'Race':
                continue
            per_gara[(anno, g)] = v

    # PROVENIENZA: ogni file letto, con il suo sha. L'elenco per esteso sarebbe ottocento
    # righe: si pubblica il conto, i byte e un DIGESTO per anno (sha256 dei singoli sha in
    # ordine), che cambia se cambia un solo file e non occupa mezzo megabyte.
    prov_anni, non_risolti = [], []
    for anno in sorted(schede_per_anno):
        h = hashlib.sha256()
        n = byte = 0
        for (g, s) in sorted(schede_per_anno[anno]):
            p = percorso(anno, g, s)
            if not p or not os.path.exists(p):
                non_risolti.append(f'{anno}/{g}/{s}')
                continue
            h.update(f'{anno}/{g}/{s}:{sha256_12(p)}'.encode())
            n += 1
            byte += os.path.getsize(p)
        prov_anni.append({'anno': int(anno), 'file': n, 'byte': byte,
                          'digesto_12': h.hexdigest()[:12]})

    return {
        '_nota': 'GENERATO da gen_stat_fondo.py. Non modificare a mano: si rigenera a ogni gara '
                 'con `python3 aggiorna_stat.py`.',
        '_generatore': 'gen_stat_fondo.py',
        'schema': 1,
        'calcolato_il': ora_utc(),
        'provenienza': {
            'porta': 'lab/fondo.py — l\'unico modulo autorizzato a sapere dove sta il grezzo',
            'radici': {'storico': os.path.relpath(fondo.FONDO, ROOT),
                       '2026_weekend': os.path.relpath(fondo.ARCH, ROOT) + '/2026',
                       '2026_registro': os.path.relpath(fondo.REG, ROOT)},
            'file_letti': sum(x['file'] for x in prov_anni),
            'byte_letti': sum(x['byte'] for x in prov_anni),
            'per_anno': prov_anni,
            'percorsi_non_risolti': len(non_risolti),
            'quali_non_risolti': sorted(non_risolti),
            'nota_digesto': 'digesto_12 = sha256 della sequenza «anno/gara/sessione:sha256_12» '
                            'dei file di quell\'anno, in ordine. Cambia se cambia un solo file.',
            'f1db_release_pinnata': f1db_zip._release_pinnata(),
            'f1db_release_letta': release_letta,
            'f1db_fallback_default': getattr(f1db_zip, '_DEFAULT_RELEASE', None),
            'come': come,
            'zip': os.path.basename(percorso_zip) if percorso_zip else None,
            'zip_sha256_12': sha256_12(percorso_zip),
            'tabelle': ['races', 'races-sprint-race-results'],
            'a_cosa_serve_f1db': 'solo al DENOMINATORE: quante gare e quante sprint aveva il '
                                 'calendario di ogni stagione, e quanti giri erano previsti. '
                                 'Il fondo non puo\' saperlo di se stesso — una gara che nessuno '
                                 'ha mai scaricato non lascia traccia nella cartella.',
        },
        'perimetro': {
            'anni': anni,
            'note': [
                f'{len(anni)} stagioni: {anni[0]}-{anni[-1]}. L\'elenco e\' DERIVATO da '
                'lab/fondo.anni(), mai scritto nel sorgente.',
                'il 2026 e\' dentro il perimetro ma NON e\' nel fondo: viene da un\'altra '
                'ingestione, ed e\' la prima cosa che questo modulo dichiara.',
                'tutto il grezzo si legge a ogni esecuzione: nessun campionamento.',
            ],
        },
        'legenda': {
            'gare_in_calendario': 'quante gare aveva la stagione, da f1db races. Per il 2026 '
                                  'sono le 22 in calendario, non le 11 gia\' corse.',
            'gare_nel_fondo': 'quante cartelle-gara hanno almeno una sessione con delle righe.',
            'gare_piene': 'quante hanno una sessione Race che porta tutte e nove le colonne di '
                          'lab/fondo.CHIAVE (lap, time, compound, life, stint, pin, pout, '
                          'status, drv). Sotto questa soglia non si puo\' attribuire un giro a '
                          'un pilota ne\' sapere sotto che bandiera e\' stato fatto.',
            'con_microsettori': 'gare = weekend in cui TUTTE le sessioni presenti portano '
                                'ms1/ms2/ms3; sessioni = i singoli file che le portano.',
            'con_meteo': 'stessa regola, per wAT/wTT/wH/wR/wWS (aria, asfalto, umidita\', '
                         'pioggia, vento).',
            'giri_totali': 'righe giro-auto, tutte le sessioni comprese.',
            'giri_utilizzabili': 'righe che passano lab/fondo.verde(): giro cronometrato, fuori '
                                 'da SC/VSC/bandiera rossa, su mescola asciutta, senza ingresso '
                                 'ne\' uscita dai box. Contate SOLO dentro le sessioni piene '
                                 '(v. la trappola guscio_2019). ATTENZIONE AL 2018: «mescola '
                                 'asciutta» vuol dire SOFT/MEDIUM/HARD, quindi i giri su '
                                 'HYPERSOFT, ULTRASOFT e SUPERSOFT — la maggioranza di quella '
                                 'stagione — non ci sono. Il numero del 2018 NON e\' '
                                 'confrontabile con quello degli altri anni: v. la trappola '
                                 'mescole_2018.',
            'sprint_in_calendario': 'gare con almeno un risultato in f1db '
                                    'races-sprint-race-results.',
            'colonne_per_sessione': 'quante sessioni hanno quel numero di colonne. 42 e\' la '
                                    'forma piena, 43 e\' una qualifica (aggiunge `qs`), 39 e\' '
                                    'una sessione senza microsettori, 3 e\' un guscio.',
        },
        'anni': per_anno,
        'trappole': {
            'guscio_2019': trappola_guscio_2019(schede_per_anno),
            'microsettori_intermittenti': trappola_microsettori(schede_per_anno),
            'mescole_2018': trappola_mescole(per_anno),
            'gare_accorciate': trappola_accorciate(per_gara, cal),
            'giri_cancellati_prima_del_2020': trappola_cancellati(per_anno),
            'sprint_2021_mancanti': trappola_sprint(per_anno),
            'stagione_2020': trappola_2020(per_gara, cal),
            'il_campo_team_spacca_le_squadre': trappola_squadre(per_anno, schede_per_anno),
            'il_2026_non_e_nel_fondo': trappola_2026(schede_per_anno),
            'spagna_2026_cade_fuori_in_silenzio': trappola_spagna_2026(schede_per_anno),
            'il_fondo_e_duplicato': trappola_duplicato(schede_per_anno),
            'gare_json_non_e_un_indice': trappola_indice(schede_per_anno),
            'i_cid_non_sono_i_circuitId_di_f1db': trappola_cid_vs_f1db(cal),
        },
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
    righe = [f'  {"anno":5}{"cal":>5}{"fondo":>7}{"piene":>7}{"micro":>7}{"meteo":>7}'
             f'{"giri":>9}{"usabili":>9}  sessioni']
    for r in d['anni']:
        s = r['sessioni_per_tipo']
        pezzi = ' '.join(f'{k.replace("Practice ", "P")[:2]}{v}' for k, v in s.items() if v)
        righe.append(
            f'  {r["anno"]:<5}{r["gare_in_calendario"] or "?":>5}{r["gare_nel_fondo"]:>7}'
            f'{r["gare_piene"]:>7}{r["con_microsettori"]["gare"]:>7}{r["con_meteo"]["gare"]:>7}'
            f'{r["giri_totali"]:>9}{r["giri_utilizzabili"]:>9}  {pezzi}')
    tot = sum(r['giri_totali'] for r in d['anni'])
    righe.append(f'  ---- {sum(r["gare_nel_fondo"] for r in d["anni"])} gare, '
                 f'{sum(r["sessioni_totali"] for r in d["anni"])} sessioni, {tot} giri · '
                 f'{d["provenienza"]["file_letti"]} file, '
                 f'{d["provenienza"]["byte_letti"]/1e6:.1f} MB')
    for k, v in d['trappole'].items():
        righe.append(f'  [{v.get("verdetto", "?").split(",")[0][:28]:28}] {k}')
    return '\n'.join(righe)


def main() -> int:
    ap = argparse.ArgumentParser(description='quante gare di ogni stagione sono davvero usabili')
    ap.add_argument('--zip', help='percorso di uno zip f1db gia\' scaricato')
    ap.add_argument('--release', help='release f1db da usare (default: il pin)')
    ap.add_argument('--check', action='store_true',
                    help='rigenera e confronta col file su disco, senza scrivere')
    a = ap.parse_args()

    zf, letta, come, perc = apri_release(a.release, a.zip)
    dati = costruisci(zf, letta, come, perc)
    print(f'[stat_fondo] f1db {letta} ({come}) · {len(dati["anni"])} stagioni')
    print(riassunto(dati))

    if a.check:
        if not os.path.exists(DEST):
            print(f'[stat_fondo] CHECK FALLITO: {os.path.relpath(DEST, ROOT)} non esiste.')
            return 1
        vecchio = json.load(open(DEST, encoding='utf-8'))
        if senza_ora(vecchio) == senza_ora(dati):
            print('[stat_fondo] CHECK OK: identico al rigenerato (a parte calcolato_il).')
            return 0
        print('[stat_fondo] CHECK FALLITO: il file su disco NON coincide col rigenerato.')
        for k in sorted(set(vecchio) | set(dati)):
            if senza_ora(vecchio).get(k) != senza_ora(dati).get(k):
                print(f'    diverge: {k}')
        return 1

    os.makedirs(os.path.dirname(DEST), exist_ok=True)
    with open(DEST, 'w', encoding='utf-8') as f:
        f.write(testo(dati))
    print(f'[stat_fondo] scritto {os.path.relpath(DEST, ROOT)} ({os.path.getsize(DEST)} byte).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
