"""punti_provvisori.py — la classifica si muove il giorno stesso, senza aspettare f1db.

IL PROBLEMA. Gli standings f1db sono la verita' canonica, ma arrivano con la release: il
Belgio ha corso il 19/07/2026 e la release col round 10 e' uscita il 24. Per cinque giorni
il sito mostrava il risultato della gara e una classifica ferma alla gara precedente.

LA REGOLA CHE RESTA. `gen_classifiche.py` dice — e continua a dire — che i punti non si
ricalcolano da regole scritte a mano. Qui NON si ricalcola la stagione: si prende la
classifica f1db COSI' COM'E' all'ultimo round che copre, e le si sommano SOLO le gare che
f1db non ha ancora. Base canonica, coda provvisoria. Quando la release arriva, la coda
sparisce da sola perche' l'ultimo round f1db avanza.

PERCHE' CI SI PUO' FIDARE. Il meccanismo non e' argomentato, e' MISURATO:
test_classifiche_provvisorie.py fa un leave-one-round-out su tutta la stagione — per ogni
round N prende gli standings f1db a N-1, ci somma il round N dalla classifica ufficiale
FastF1, e confronta con gli standings f1db a N. Al 26/07/2026: 9 round su 9 (2..10),
piloti E costruttori, sprint incluse, ZERO divergenze. Se un giorno la FIA cambia il
sistema di punti o il formato sprint, quel test diventa rosso PRIMA che la coda sbagliata
arrivi in produzione.

FONTI, tutte locali (nessuna rete qui):
  - demo/data/ufficiali_2026.json  classifica FIA per gara, gia' con la sprint;
  - demo/data/calendario_2026.json numero di round della gara nuova;
  - demo/data/<gara>.json          team del pilota IN QUELLA GARA (guardrail sui cambi);
  - f1db                           identita' (sigla->driverId) e team dei round noti.

QUANDO SI RIFIUTA DI ESTENDERE. Meglio una classifica vecchia e dichiarata che una nuova e
sbagliata: se un pilota che ha preso punti non e' identificabile, o se il suo team nella
gara nuova non e' quello che f1db gli conosce (mercato a stagione in corso), si alza
ProvvisorioImpossibile e il chiamante pubblica la sola base canonica.
"""
import json, os

# Tabelle punti 2026. NON sono "regole scritte a mano" prese da un regolamento: sono le
# tabelle OSSERVATE nei risultati f1db 2026 (posizione -> punti, identica in tutte le gare
# e in tutte le sprint della stagione), e il leave-one-round-out le rivalida a ogni giro.
PUNTI_GARA = {1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1}
PUNTI_SPRINT = {1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1}

DEMO = os.path.join('demo', 'data')


class ProvvisorioImpossibile(Exception):
    """Non si puo' estendere in sicurezza: il chiamante pubblica la sola base f1db."""


def _carica(nome):
    with open(os.path.join(DEMO, nome)) as f:
        return json.load(f)


def sigle_2026(zf, tabella, drivers):
    """sigla -> driverId, RISTRETTA ai piloti che hanno corso nel 2026.

    La restrizione non e' pignoleria: le sigle di tre lettere si ripetono nella storia della
    F1 (piu' di un VER, piu' di un HIL), e cercarle nell'anagrafica intera darebbe l'omonimo
    sbagliato senza dire niente.
    """
    out = {}
    for r in tabella:
        out.setdefault(drivers[r['driverId']]['abbreviation'], set()).add(r['driverId'])
    doppie = {k: sorted(v) for k, v in out.items() if len(v) > 1}
    if doppie:
        raise ProvvisorioImpossibile(f'sigle ambigue fra i piloti 2026: {doppie}')
    return {k: v.pop() for k, v in out.items()}


def verifica_tabelle(zf, f1db_zip, anno='2026'):
    """Le tabelle punti qui sopra reggono ancora contro f1db?

    Non e' un doppione del test: il test prova il MECCANISMO (una volta, a mano o in CI),
    questa prova l'INGRESSO a ogni esecuzione, e costa niente perche' le righe sono gia' in
    memoria. Se la FIA cambiasse il sistema di punti o il formato sprint a stagione in
    corso, la coda provvisoria comincerebbe a produrre numeri sbagliati in silenzio fino
    alla release f1db successiva; cosi' invece si rifiuta di estendere e lo dice.
    """
    for tabella, nome, attesa in ((f1db_zip.tabella(zf, 'races-race-results'), 'gara', PUNTI_GARA),
                                  (f1db_zip.tabella(zf, 'races-sprint-race-results'), 'sprint',
                                   PUNTI_SPRINT)):
        for r in tabella:
            if r['year'] != anno or not r['positionNumber']:
                continue
            pos, punti = int(r['positionNumber']), float(r['points'] or 0)
            if punti != float(attesa.get(pos, 0)):
                raise ProvvisorioImpossibile(
                    f'tabella punti {nome} non piu\' valida: f1db da\' {punti} al {pos}o '
                    f'(round {r["round"]}), la tabella dice {attesa.get(pos, 0)}.')


def _team_demo_gara(gara):
    """sigla -> nome team nella gara demo. {} se il file non c'e' o non e' una gara."""
    try:
        d = _carica(f'{gara}.json')
    except (OSError, ValueError):
        return {}
    out = {}
    for lp in d.get('laps', []):
        for s, c in lp.get('cars', {}).items():
            if c.get('team'):
                out[s] = c['team']
    return out


def calcola(zf, f1db_zip, team_demo, ultimo_round_f1db, registro):
    """Punti/vittorie delle gare OLTRE l'ultimo round coperto da f1db.

    `team_demo`: constructorId -> nome team demo (lo costruisce gia' gen_classifiche).
    Ritorna None se non c'e' niente da estendere. Alza ProvvisorioImpossibile se c'e' ma
    non e' sicuro farlo.
    """
    anno = '2026'
    verifica_tabelle(zf, f1db_zip, anno)
    rr = [r for r in f1db_zip.tabella(zf, 'races-race-results') if r['year'] == anno]
    drivers = {d['id']: d for d in f1db_zip.tabella(zf, 'drivers')}
    sigla2id = sigle_2026(zf, rr, drivers)
    # team dell'ULTIMO round noto a f1db: e' la nostra ipotesi per la gara nuova, e sotto
    # la si mette alla prova contro il team che il pilota ha davvero in quella gara.
    team_f1db = {}
    for r in sorted(rr, key=lambda r: int(r['round'])):
        team_f1db[r['driverId']] = r['constructorId']

    try:
        cal = _carica('calendario_2026.json')
        uff = _carica('ufficiali_2026.json')
    except (OSError, ValueError) as e:
        raise ProvvisorioImpossibile(f'fonti locali illeggibili: {e}')

    # gare del registro, con round dal calendario, oltre l'ultimo round f1db e con ufficiale
    nuove = []
    for g in cal.get('gare', []):
        nome, rnd = (g.get('nome') or g.get('gara_demo')), g.get('round')
        if not nome or rnd is None or int(rnd) <= ultimo_round_f1db:
            continue
        if nome in registro and nome in uff:
            nuove.append((int(rnd), nome))
    if not nuove:
        return None
    nuove.sort()

    try:
        griglie = _carica('grids.json')
    except (OSError, ValueError):
        griglie = {}

    pd, pc, vd, vc = {}, {}, {}, {}
    righe = []                # righe in FORMATO f1db races-race-results (v. sotto)
    dettaglio = []
    for rnd, nome in nuove:
        voce = uff[nome]
        squadre = _team_demo_gara(nome)
        griglia = {s: i + 1 for i, s in enumerate(griglie.get(nome, []))}
        sessioni = [('classifica', PUNTI_GARA, True)]
        if voce.get('sprint'):
            sessioni.append(('sprint', PUNTI_SPRINT, False))
        for chiave, tabella, e_gara in sessioni:
            for riga in voce[chiave]:
                pos, sig = riga['pos'], riga['pilota']
                did = sigla2id.get(sig)
                # non classificato = niente punti, qualunque sia la posizione d'arrivo
                classificato = riga.get('classificato', True)
                punti = tabella.get(pos, 0) if classificato else 0
                if did is None:
                    if punti:
                        raise ProvvisorioImpossibile(
                            f'{nome}: {sig} ha preso {punti} punti ma non e\' fra i piloti '
                            f'2026 noti a f1db — non estendo.')
                    continue          # pilota nuovo a zero punti: non sposta nulla
                cid = team_f1db.get(did)
                # GUARDRAIL MERCATO: il team che f1db gli conosce deve essere quello con
                # cui ha corso QUESTA gara. Se no, i punti costruttori finirebbero alla
                # squadra sbagliata in silenzio.
                atteso, visto = team_demo.get(cid), squadre.get(sig)
                if punti and atteso and visto and atteso != visto:
                    raise ProvvisorioImpossibile(
                        f'{nome}: {sig} corre per "{visto}" ma f1db lo da\' a "{atteso}" '
                        f'— cambio squadra a stagione in corso, non estendo.')
                if e_gara:
                    # RIGA IN FORMATO f1db. Non e' un vezzo: gen_schede deriva TUTTA la
                    # stagione (migliore risultato, medie griglia/arrivo, posizioni
                    # guadagnate, gare disputate, podi di squadra) da races-race-results.
                    # Dandogli la gara nuova nella stessa forma, quelle statistiche seguono
                    # la classifica senza un solo ramo di codice in piu' — e senza il rischio
                    # di una scheda con i punti dell'Ungheria e le medie ferme al Belgio.
                    righe.append({
                        'year': anno, 'round': str(rnd), 'driverId': did,
                        'constructorId': cid,
                        # positionNumber VUOTO se non classificato: e' la convenzione f1db,
                        # ed e' quella che gen_schede legge per distinguere "gare disputate"
                        # da "gare classificate".
                        'positionNumber': str(pos) if classificato else '',
                        'positionText': str(pos) if classificato else 'DNF',
                        'gridPositionNumber': (str(griglia[sig]) if sig in griglia else ''),
                        'points': str(float(punti)), 'timePenalty': '',
                        'raceId': f'provvisorio-{rnd}',
                    })
                    if classificato and pos == 1:
                        vd[did] = vd.get(did, 0) + 1
                        vc[cid] = vc.get(cid, 0) + 1
                if punti:
                    pd[did] = pd.get(did, 0) + punti
                    pc[cid] = pc.get(cid, 0) + punti
        dettaglio.append({'round': rnd, 'gara': nome, 'sprint': bool(voce.get('sprint'))})

    ultimo = dettaglio[-1]
    return {'gare': dettaglio, 'ultimo_round': ultimo['round'], 'ultima_gara': ultimo['gara'],
            'punti_pilota': pd, 'punti_costruttore': pc,
            'vittorie_pilota': vd, 'vittorie_costruttore': vc,
            'righe_risultati': righe}


def nota(ext):
    """Frase pronta per il campo `_nota` / la UI."""
    g = ', '.join(d['gara'] for d in ext['gare'])
    return (f'PROVVISORIA: agli standings f1db e\' stata sommata {g} '
            f'(round {ext["ultimo_round"]}) dalla classifica ufficiale FastF1, in attesa '
            f'della release f1db che la copra.')
