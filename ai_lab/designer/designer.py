"""ai_lab/designer/designer.py — Experiment Designer V1.

!! DA RIVERIFICARE (rifondazione 21/07/2026) — ai_lab/scienziato/RETROCESSIONE.md
   I protocolli generati prescrivono 'fuel_corrected_pace' (engine.FUEL_COEFF) come
   variabile risposta: ogni esperimento cosi' generato e' CONDIZIONATO a un coefficiente
   non verificato dal fondo.

NON scrive relazioni: genera PROTOCOLLI SCIENTIFICI eseguibili.

COSA PRODUCE, PER OGNI ESPERIMENTO
    research/experiments/EXP-NNNN/
        protocol.md    protocollo leggibile dall'umano
        prereg.json    il CONTRATTO MACCHINA, sigillato con hash (per l'Experiment Runner)
        status.json    stato corrente nel ciclo di vita
        history.json   log append-only di ogni transizione: chi, quando, perche'

TRE CONFINI
    1. Non tocca il motore, i coefficienti, i CSV. Non apre PR. Produce solo protocolli.
    2. Non si auto-approva: nasce CREATO e li' resta finche' un umano non decide.
    3. Non inventa: ogni numero del protocollo viene dalla mappa della conoscenza.

IL CANCELLO DI NASCITA (la regola che conta)
    Un esperimento non nasce perche' un fenomeno e' interessante: nasce perche' ha
    superato soglie dichiarate PRIMA. Ogni protocollo dichiara **perche' nasce adesso**
    e **con che cosa non sarebbe nato**. I fenomeni respinti sono registrati col motivo:
    e' cosi' che il laboratorio evita di inseguire rumore.

SIGILLO ANTI-HARKing
    prereg.json e' sigillato con un hash del contenuto scientifico (ipotesi, dataset, KPI,
    regole di decisione) calcolato PRIMA di qualunque esecuzione. Se dopo i numeri qualcuno
    ritocca l'ipotesi o sposta una soglia, l'hash non torna e si vede.
"""
import datetime as _dt
import hashlib
import json
import math
import os
import re
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(QUI)
if LAB not in sys.path:
    sys.path.insert(0, LAB)

RADICE = os.path.dirname(LAB)
CONOSCENZA = os.path.join(LAB, 'knowledge', 'conoscenza.json')
ESPERIMENTI = os.path.join(LAB, 'research', 'experiments')

# ---------------------------------------------------------------- soglie del cancello
MIN_CIRCUITI = 3          # circuiti indipendenti concordi perche' un fenomeno meriti un esperimento
MIN_STINT = 20            # supporto complessivo minimo (piu' severo della soglia della mappa)
MIN_RAPPORTO_RUMORE = 1.0  # l'effetto deve superare il rumore locale
QUOTA_DOMINANZA = 0.40    # oltre questa quota di stint, un circuito e' dichiarato dominante
SOGLIA_TRAFFICO_CONF = 0.30   # frazione traffico oltre cui il confondente e' dichiarato

STATI = ('CREATO', 'APPROVATO', 'ESEGUITO', 'VALIDATO', 'GO', 'NO_GO', 'RESPINTO')
TRANSIZIONI = {
    'CREATO': ('APPROVATO', 'RESPINTO'),
    'APPROVATO': ('ESEGUITO', 'RESPINTO'),
    'ESEGUITO': ('VALIDATO', 'RESPINTO'),
    'VALIDATO': ('GO', 'NO_GO'),
    'GO': (), 'NO_GO': (), 'RESPINTO': (),
}
# Il Designer crea e basta. Approvare/respingere e' umano; eseguire e' dell'Experiment Runner.
DECISIONI_UMANE = ('APPROVATO', 'RESPINTO')


def _ora():
    return _dt.datetime.now().strftime('%Y-%m-%d %H:%M:%S')


# ---------------------------------------------------------------- lettura conoscenza
def carica_conoscenza():
    if not os.path.exists(CONOSCENZA):
        raise FileNotFoundError(
            'mappa della conoscenza assente: eseguire prima ai_lab/run_extractor.py')
    with open(CONOSCENZA) as f:
        return json.load(f)


def _osservazioni_di(c, fen_id):
    return [o for o in c['osservazioni'] if o['fenomeno'] == fen_id]


# ---------------------------------------------------------------- il cancello di nascita
def _tipo_protocollo(fen):
    """Che genere di esperimento merita questo fenomeno."""
    liv, comp = fen['confidenza']['livello'], fen['componente']
    if liv == 'contesa':
        return 'disambiguazione'
    if comp == 'non_classificabile':
        return 'identificazione_meccanismo'
    if comp in ('degrado', 'traffico'):
        return 'verifica_sistematica'
    return None


def valuta_eleggibilita(fen, oss):
    """Ritorna (eleggibile: bool, tipo|None, motivazione|motivo_rifiuto).
    Soglie dichiarate qui, mai scelte dopo aver visto i numeri."""
    conf = fen['confidenza']
    liv = conf['livello']
    tipo = _tipo_protocollo(fen)
    circuiti = conf.get('circuiti') or fen['circuiti']
    n_circ = conf.get('gare_concordi', 0)
    n_stint = conf.get('n_stint_totali') or sum(o['supporto']['n_stint'] for o in oss)

    if liv == 'nullo':
        return False, None, {'motivo': "effetto dentro il rumore in ogni gara: non c'e' niente da "
                                       'spiegare', 'cosa_manca': 'un effetto che superi il rumore'}
    if tipo is None:
        return False, None, {'motivo': f'componente {fen["componente"]} non produce protocolli',
                             'cosa_manca': None}

    if liv == 'contesa':
        # un conflitto e' di per se' una domanda scientifica: nasce a prescindere dal supporto
        return True, tipo, {
            'nasce_perche': (f'lo stesso fenomeno mostra segno OPPOSTO fra circuiti '
                             f'({", ".join(fen["circuiti"])}): il conflitto e\' una domanda '
                             f'aperta, non un dettaglio da mediare'),
            'non_sarebbe_nato_con': 'osservazioni tutte concordi, che non pongono domande',
            'regola': 'confidenza = contesa (segni discordi sopra il rumore)',
        }

    if liv != 'alto':
        # Il motivo esatto sta nella mappa: NON dedurlo dal numero di circuiti, che puo'
        # gia' essere sufficiente mentre a mancare e' la forza delle osservazioni.
        return False, None, {
            'motivo': (f'confidenza {liv}, serve "alto" ({n_circ} circuiti concordi, '
                       f'{n_stint} stint): {fen["confidenza"]["perche"]}'),
            'cosa_manca': fen.get('manca_per_salire')}
    if n_circ < MIN_CIRCUITI:
        return False, None, {'motivo': f'{n_circ} circuiti concordi < {MIN_CIRCUITI}',
                             'cosa_manca': 'una misura su un circuito ulteriore'}
    if n_stint < MIN_STINT:
        return False, None, {
            'motivo': (f'supporto {n_stint} stint < {MIN_STINT}: confidenza alta ma campione '
                       f'troppo sottile per reggere un esperimento'),
            'cosa_manca': f'altri {MIN_STINT - n_stint} stint qualificati'}

    rapporti = [o['rapporto_effetto_rumore'] for o in oss
                if o['forza'] in ('debole', 'marcato') and o['rapporto_effetto_rumore']]
    return True, tipo, {
        'nasce_perche': (f'lo stesso fenomeno e\' stato osservato in {n_circ} circuiti '
                         f'indipendenti ({", ".join(circuiti)}), con segno concorde e effetto '
                         f'sopra il rumore locale in ciascuno, su {n_stint} stint complessivi'),
        'non_sarebbe_nato_con': (f'una sola gara: la soglia dichiarata e\' >= {MIN_CIRCUITI} '
                                 f'circuiti concordi e >= {MIN_STINT} stint. Un effetto grande '
                                 f'su un solo circuito resta in-sample e non giustifica un '
                                 f'esperimento'),
        'regola': (f'confidenza=alto AND circuiti>={MIN_CIRCUITI} AND stint>={MIN_STINT} '
                   f'AND effetto/rumore>{MIN_RAPPORTO_RUMORE} in ogni osservazione utile'),
        'evidenza': {'circuiti': circuiti, 'n_stint': n_stint,
                     'rapporti_effetto_rumore': sorted(round(r, 2) for r in rapporti)},
    }


# ---------------------------------------------------------------- rischi (calcolati)
def _rischi(fen, oss, conoscenza):
    r = []
    tot = sum(o['supporto']['n_stint'] for o in oss) or 1
    per_circ = sorted(((o['supporto']['n_stint'] / tot, o['circuito']) for o in oss), reverse=True)
    quota, circ = per_circ[0]
    if quota > QUOTA_DOMINANZA:
        r.append({'rischio': 'circuito dominante',
                  'dettaglio': f'{circ} pesa il {quota:.0%} degli stint: il risultato potrebbe '
                               f'descrivere {circ} piu\' del fenomeno',
                  'mitigazione': 'leave-one-circuit-out obbligatorio, con {} escluso per primo'
                                 .format(circ)})
    traffici = [o['condizioni']['frazione_traffico_mediana'] for o in oss]
    if traffici and max(traffici) > SOGLIA_TRAFFICO_CONF:
        peggio = max(zip(traffici, [o['circuito'] for o in oss]))
        r.append({'rischio': 'confondente traffico',
                  'dettaglio': f'frazione di giri in traffico fino a {peggio[0]:.0%} '
                               f'({peggio[1]}): parte del residuo puo\' essere aria sporca',
                  'mitigazione': 'stratificare per aria pulita/traffico e riportare i due gruppi'})
    mescola = fen['condizione_chiave']['mescola']
    gemello = next((f for f in conoscenza['fenomeni']
                    if f['componente'] == 'non_classificabile'
                    and f['condizione_chiave']['mescola'] == mescola
                    and f['id'] != fen['id']
                    and f['confidenza']['livello'] in ('alto', 'medio', 'contesa')), None)
    if gemello:
        r.append({'rischio': 'residuo non spiegato sulla stessa mescola',
                  'dettaglio': f'su {mescola} esiste anche {gemello["id"]} '
                               f'({gemello["effetto_mediano_s_giro"]:+.3f} s/giro, confidenza '
                               f'{gemello["confidenza"]["livello"]}): parte dell\'effetto qui '
                               f'attribuito potrebbe essere quello',
                  'mitigazione': 'riportare i due gruppi separatamente, non sommarli'})
    if any(o['condizioni']['gara_con_neutralizzazioni'] for o in oss):
        r.append({'rischio': 'neutralizzazioni in gara',
                  'dettaglio': 'tutte le gare del campione contengono giri neutralizzati',
                  'mitigazione': 'i giri neutralizzati sono gia\' esclusi dal filtro F1: '
                                 'verificare che l\'esclusione regga anche nel Runner'})
    r.append({'rischio': 'overfitting',
              'dettaglio': 'qualunque parametro aggiunto migliora il fit in campione',
              'mitigazione': 'il KPI decisivo e\' leave-one-circuit-out, non l\'RMSE in campione'})
    r.append({'rischio': 'circolarita\' in-sample',
              'dettaglio': 'le gare del campione sono le stesse che alimentano i coefficienti '
                           'del progetto',
              'mitigazione': 'nessuna conclusione senza il passaggio LOCO'})
    return r


# ---------------------------------------------------------------- il protocollo
def _ipotesi(tipo, fen, oss):
    mescola = fen['condizione_chiave']['mescola']
    comp = fen['componente']
    eff = fen['effetto_mediano_s_giro']
    pend = [o['variabili']['pendenza_s_per_giro'] for o in oss if o['variabili']['pendenza_s_per_giro']]
    pend_med = round(sum(p['mediana'] for p in pend) / len(pend), 4) if pend else None

    if tipo == 'verifica_sistematica' and comp == 'degrado':
        return (
            f'Verificare se il degrado su mescola {mescola} e\' sistematicamente '
            f'SOTTOSTIMATO dal motore.',
            {'testo': (f'Il modello e\' corretto: il residuo fuel-corretto su {mescola} e\' '
                       f'centrato a zero e non dipende dall\'eta\' gomma (pendenza = 0).'),
             'forma': {'parametro': 'pendenza_residuo_vs_eta_gomma', 'valore_atteso': 0.0,
                       'e_anche': {'parametro': 'bias_residuo', 'valore_atteso': 0.0}}},
            {'testo': (f'Il modello sottostima: il residuo cresce con l\'eta\' gomma '
                       f'(pendenza mediana osservata {pend_med:+.4f} s/giro) e il bias mediano '
                       f'e\' {eff:+.3f} s/giro su {len(oss)} circuiti.'),
             'forma': {'parametro': 'pendenza_residuo_vs_eta_gomma', 'valore_osservato': pend_med,
                       'segno_atteso': 'positivo'}})
    if tipo == 'verifica_sistematica':      # traffico
        return (
            f'Verificare se la penalita\' da traffico su mescola {mescola} e\' sottostimata '
            f'dal TrafficModel.',
            {'testo': (f'Il modello e\' corretto: il differenziale traffico/aria pulita e\' '
                       f'nullo dopo la simulazione.'),
             'forma': {'parametro': 'differenziale_traffico_residuo', 'valore_atteso': 0.0}},
            {'testo': (f'Il modello sottostima: in traffico il residuo e\' {eff:+.3f} s/giro '
                       f'piu\' alto che in aria pulita.'),
             'forma': {'parametro': 'differenziale_traffico_residuo', 'valore_osservato': eff,
                       'segno_atteso': 'positivo'}})
    if tipo == 'identificazione_meccanismo':
        return (
            f'Identificare quale meccanismo genera il residuo non spiegato su mescola '
            f'{mescola}, oggi riproducibile ma senza causa attribuita.',
            {'testo': ('Il residuo non spiegato e\' rumore: non si concentra su nessuna '
                       'variabile misurata.'),
             'forma': {'parametro': 'associazione_residuo_variabili', 'valore_atteso': 0.0}},
            {'testo': (f'Il residuo ({eff:+.3f} s/giro) si concentra su almeno una variabile '
                       f'misurata (eta\' gomma, traffico, circuito, pilota, fase di gara).'),
             'forma': {'parametro': 'associazione_residuo_variabili', 'segno_atteso': 'non nullo'}})
    # disambiguazione
    return (
        f'Spiegare perche\' il fenomeno su mescola {mescola} cambia SEGNO fra circuiti.',
        {'testo': 'Il segno opposto e\' rumore campionario: i circuiti non differiscono davvero.',
         'forma': {'parametro': 'differenza_fra_circuiti', 'valore_atteso': 0.0}},
        {'testo': ('Il segno dipende da una caratteristica del circuito (difficolta\' di '
                   'sorpasso, lunghezza, neutralizzazioni) e non e\' rumore.'),
         'forma': {'parametro': 'differenza_fra_circuiti', 'segno_atteso': 'non nullo'}})


def _dataset(fen, oss):
    """Cosa serve al Runner per raccogliere il campione. Fonti risolte, non descritte."""
    from auditor import tools
    disponibili = {g['gara']: g['fonte'] for g in tools.elenco_gare()}
    usati = sorted({o['circuito'] for o in oss})
    return {
        'anni': [2026],
        'sessione': 'Race',
        'condizioni': 'asciutto (dry)',
        'mescola': fen['condizione_chiave']['mescola'],
        'min_giri_stint': tools.MIN_GIRI_STINT,
        'circuiti_nel_campione': usati,
        'circuiti_disponibili_non_usati': sorted(set(disponibili) - set(usati)),
        'fonti': {g: disponibili[g] for g in usati if g in disponibili},
        'filtri_igiene': ('F1-F6 pulisci() + F7 filtro_outlier(1.07), importati da '
                          'test_identificabilita_degrado — gli stessi dell\'Auditor'),
        'esclusioni': ['giri neutralizzati (status SC/VSC)', 'in-lap e out-lap',
                       'mescole non slick', 'giri con eta\' gomma < 3'],
        'spazio_di_confronto': ('fuel-corretto secondo engine.FUEL_COEFF: il kernel lavora a '
                                'serbatoio vuoto e non re-inflaziona il carburante'),
    }


def _kpi(tipo):
    base = [
        {'nome': 'BIAS', 'definizione': 'media del residuo fuel-corretto sul campione',
         'unita': 's/giro', 'obiettivo': 'tendere a 0'},
        {'nome': 'RMSE', 'definizione': 'radice dell\'errore quadratico medio del residuo',
         'unita': 's/giro', 'obiettivo': 'diminuire'},
        {'nome': 'LOCO', 'definizione': ('leave-one-circuit-out: si riadatta escludendo un '
                                         'circuito e si valuta su quello escluso, a rotazione'),
         'unita': 'quota di circuiti in cui il guadagno regge', 'obiettivo': 'reggere fuori campione'},
        {'nome': 'NON_REGRESSIONE', 'definizione': ('RMSE sulle altre mescole, che non deve '
                                                    'peggiorare'),
         'unita': 's/giro', 'obiettivo': 'invariato o migliore'},
    ]
    if tipo == 'identificazione_meccanismo':
        base.insert(0, {'nome': 'QUOTA_SPIEGATA',
                        'definizione': 'quota di varianza del residuo spiegata dalle variabili misurate',
                        'unita': 'frazione', 'obiettivo': 'massimizzare'})
    if tipo == 'disambiguazione':
        base.insert(0, {'nome': 'SEPARAZIONE_CIRCUITI',
                        'definizione': ('differenza fra gruppi di circuiti, con intervallo di '
                                        'confidenza: attraversa lo zero oppure no'),
                        'unita': 's/giro', 'obiettivo': 'stabilire se la differenza e\' reale'})
    return base


def _decisione(tipo):
    if tipo == 'identificazione_meccanismo':
        return {
            'go': [{'kpi': 'QUOTA_SPIEGATA', 'operatore': '>=', 'soglia': 0.30,
                    'nota': 'almeno il 30% del residuo attribuito a una variabile misurata'},
                   {'kpi': 'LOCO', 'operatore': '>=', 'soglia': 0.67,
                    'nota': 'l\'associazione regge su almeno 2 circuiti su 3'}],
            'no_go': [{'kpi': 'QUOTA_SPIEGATA', 'operatore': '<', 'soglia': 0.30,
                       'nota': 'il residuo resta non attribuibile: il fenomeno torna in mappa '
                               'come non_classificabile, con questo esperimento allegato'}],
            'nullo': [{'condizione': 'campione sotto il minimo dichiarato'}],
        }
    if tipo == 'disambiguazione':
        return {
            'go': [{'kpi': 'SEPARAZIONE_CIRCUITI', 'operatore': 'IC_non_attraversa_zero',
                    'soglia': 0.95, 'nota': 'la differenza fra circuiti e\' reale al 95%'}],
            'no_go': [{'kpi': 'SEPARAZIONE_CIRCUITI', 'operatore': 'IC_attraversa_zero',
                       'soglia': 0.95, 'nota': 'il segno opposto e\' compatibile col rumore: '
                                               'il conflitto si chiude come artefatto'}],
            'nullo': [{'condizione': 'campione sotto il minimo dichiarato'}],
        }
    return {
        'go': [{'kpi': 'BIAS', 'operatore': 'riduzione_assoluta >=', 'soglia': 0.50,
                'nota': '|bias| almeno dimezzato'},
               {'kpi': 'RMSE', 'operatore': '<', 'soglia': 'RMSE_pre',
                'nota': 'l\'errore complessivo migliora'},
               {'kpi': 'LOCO', 'operatore': '>=', 'soglia': 0.67,
                'nota': 'il guadagno regge su almeno 2 circuiti su 3 tenuti fuori'},
               {'kpi': 'NON_REGRESSIONE', 'operatore': 'peggioramento <=', 'soglia': 0.05,
                'nota': 'nessuna altra mescola peggiora oltre il 5%'}],
        'no_go': [{'kpi': 'RMSE', 'operatore': '>=', 'soglia': 'RMSE_pre',
                   'nota': 'nessun miglioramento'},
                  {'kpi': 'LOCO', 'operatore': '<', 'soglia': 0.67,
                   'nota': 'il guadagno esiste solo in campione: overfitting'}],
        'nullo': [{'condizione': 'campione sotto il minimo dichiarato: esito NON GIUDICABILE, '
                                 'non NO-GO'}],
    }


def _campione_minimo(oss, n_stint):
    return {
        'stint': max(MIN_STINT, n_stint),
        'circuiti': MIN_CIRCUITI,
        'giustificazione': (f'soglia dichiarata ({MIN_STINT} stint, {MIN_CIRCUITI} circuiti) '
                            f'e comunque non inferiore al supporto gia\' osservato ({n_stint}). '
                            f'Non e\' un calcolo di potenza: e\' una soglia dichiarata prima.'),
        'nota_potenza': ('rapporto effetto/rumore osservato: '
                         + ', '.join(f"{o['circuito']}={o['rapporto_effetto_rumore']}"
                                     for o in oss if o['rapporto_effetto_rumore'])),
    }


def _variabili(tipo):
    v = [
        {'nome': 'compound', 'ruolo': 'condizione', 'fonte': 'TI: campo compound'},
        {'nome': 'tyre_age', 'ruolo': 'regressore', 'fonte': 'TI: campo life'},
        {'nome': 'fuel_corrected_pace', 'ruolo': 'risposta',
         'fonte': 'calcolata con engine.FUEL_COEFF, come in engine.pace_base'},
        {'nome': 'aria_pulita', 'ruolo': 'stratificazione',
         'fonte': 'gap all\'auto davanti > 2.0 s (stessa soglia di gen_replay_perdita_stint)'},
        {'nome': 'traffico', 'ruolo': 'confondente', 'fonte': 'gap all\'auto davanti < 2.0 s'},
        {'nome': 'circuito', 'ruolo': 'blocco per LOCO', 'fonte': 'gara'},
    ]
    if tipo in ('identificazione_meccanismo', 'disambiguazione'):
        v += [{'nome': 'pilota', 'ruolo': 'controllo', 'fonte': 'TI: campo drv'},
              {'nome': 'fase_gara', 'ruolo': 'controllo', 'fonte': 'numero giro / n_giri'},
              {'nome': 'neutralizzazioni', 'ruolo': 'controllo',
               'fonte': 'contesto gara: giri neutralizzati'}]
    return v


# ---------------------------------------------------------------- sigillo
def _sigilla(prereg):
    """Hash del contenuto SCIENTIFICO. Cambiare un'ipotesi o una soglia dopo i numeri si vede."""
    nucleo = {k: prereg[k] for k in ('fenomeno', 'tipo', 'obiettivo', 'ipotesi_nulla',
                                     'ipotesi_alternativa', 'dataset', 'variabili',
                                     'campione_minimo', 'kpi', 'decisione', 'motivazione')}
    testo = json.dumps(nucleo, ensure_ascii=False, sort_keys=True)
    return 'sha256:' + hashlib.sha256(testo.encode()).hexdigest()[:16]


# ---------------------------------------------------------------- costruzione
def progetta(fen, oss, conoscenza, tipo, motivazione, exp_id):
    obiettivo, h0, h1 = _ipotesi(tipo, fen, oss)
    n_stint = fen['confidenza'].get('n_stint_totali') or sum(o['supporto']['n_stint'] for o in oss)
    prereg = {
        'id': exp_id,
        'tipo': tipo,
        'fenomeno': fen['id'],
        'componente': fen['componente'],
        'creato': _ora(),
        'versione_motore': oss[0]['versione_motore'],
        'osservazioni_di_origine': [o['id'] for o in oss],
        'dossier_di_origine': sorted({o['dossier_id'] for o in oss}),
        'motivazione': motivazione,
        'obiettivo': obiettivo,
        'ipotesi_nulla': h0,
        'ipotesi_alternativa': h1,
        'dataset': _dataset(fen, oss),
        'variabili': _variabili(tipo),
        'campione_minimo': _campione_minimo(oss, n_stint),
        'kpi': _kpi(tipo),
        'decisione': _decisione(tipo),
        'rischi': _rischi(fen, oss, conoscenza),
        'vincoli': [
            'l\'esperimento NON modifica il kernel: qualunque adattamento e\' fuori dal motore',
            'nessun coefficiente in produzione cambia senza ratifica umana',
            'esito NULLO ammesso: campione insufficiente non e\' NO-GO',
            'il prereg e\' sigillato: ipotesi e soglie non si toccano dopo i numeri',
        ],
    }
    prereg['sigillo'] = _sigilla(prereg)
    return prereg


def protocollo_markdown(p):
    o = []
    P = o.append
    P(f"# {p['id']} — protocollo sperimentale\n")
    P(f"| campo | valore |\n|---|---|")
    P(f"| esperimento | `{p['id']}` |")
    P(f"| tipo | {p['tipo']} |")
    P(f"| fenomeno | `{p['fenomeno']}` ({p['componente']}) |")
    P(f"| creato | {p['creato']} |")
    P(f"| versione motore | `{p['versione_motore']}` |")
    P(f"| sigillo prereg | `{p['sigillo']}` |")
    P(f"| dossier di origine | {', '.join(f'`{d}`' for d in p['dossier_di_origine'])} |\n")
    P('> Questo è un **protocollo**, non una relazione. Non modifica nulla: né il kernel, né i\n'
      '> coefficienti, né i CSV. Descrive un esperimento che qualcun altro potrà eseguire.\n')

    m = p['motivazione']
    P('## Motivazione — perché nasce adesso\n')
    P(f"{m.get('nasce_perche', '—')}\n")
    P(f"**Non sarebbe nato con:** {m.get('non_sarebbe_nato_con', '—')}\n")
    P(f"*Regola applicata:* `{m.get('regola', '—')}`\n")
    if 'evidenza' in m:
        e = m['evidenza']
        P(f"*Evidenza:* {len(e['circuiti'])} circuiti ({', '.join(e['circuiti'])}), "
          f"{e['n_stint']} stint, rapporti effetto/rumore {e['rapporti_effetto_rumore']}\n")

    P('## Obiettivo\n')
    P(p['obiettivo'] + '\n')
    P('## Ipotesi nulla (H0)\n')
    P(p['ipotesi_nulla']['testo'] + '\n')
    P(f"```json\n{json.dumps(p['ipotesi_nulla']['forma'], ensure_ascii=False, indent=2)}\n```\n")
    P('## Ipotesi alternativa (H1)\n')
    P(p['ipotesi_alternativa']['testo'] + '\n')
    P(f"```json\n{json.dumps(p['ipotesi_alternativa']['forma'], ensure_ascii=False, indent=2)}\n```\n")

    d = p['dataset']
    P('## Dataset richiesto\n')
    P(f"- anni: {d['anni']} · sessione: {d['sessione']} · condizioni: {d['condizioni']}")
    P(f"- mescola: **{d['mescola']}** · stint di almeno **{d['min_giri_stint']} giri** puliti")
    P(f"- circuiti nel campione: {', '.join(d['circuiti_nel_campione'])}")
    P(f"- circuiti disponibili non ancora usati: "
      f"{', '.join(d['circuiti_disponibili_non_usati']) or '—'}")
    P(f"- igiene: {d['filtri_igiene']}")
    P(f"- esclusioni: {'; '.join(d['esclusioni'])}")
    P(f"- spazio di confronto: {d['spazio_di_confronto']}\n")
    P('Fonti risolte:\n')
    for g, f in d['fonti'].items():
        P(f"- `{g}` → `{f}`")
    P('')

    P('## Variabili\n')
    P('| variabile | ruolo | fonte |\n|---|---|---|')
    for v in p['variabili']:
        P(f"| `{v['nome']}` | {v['ruolo']} | {v['fonte']} |")
    P('')

    c = p['campione_minimo']
    P('## Campione minimo\n')
    P(f"**{c['stint']} stint** su almeno **{c['circuiti']} circuiti**.\n")
    P(f"{c['giustificazione']}\n")
    P(f"*{c['nota_potenza']}*\n")

    P('## KPI\n')
    P('| KPI | definizione | unità | obiettivo |\n|---|---|---|---|')
    for k in p['kpi']:
        P(f"| **{k['nome']}** | {k['definizione']} | {k['unita']} | {k['obiettivo']} |")
    P('')

    P('## Criterio GO\n')
    for r in p['decisione']['go']:
        P(f"- `{r.get('kpi','—')}` {r.get('operatore','')} {r.get('soglia','')} — {r['nota']}")
    P('\n**Tutte** le condizioni GO devono valere insieme.\n')
    P('## Criterio NO-GO\n')
    for r in p['decisione']['no_go']:
        P(f"- `{r.get('kpi','—')}` {r.get('operatore','')} {r.get('soglia','')} — {r['nota']}")
    P('\n## Esito NULLO (né GO né NO-GO)\n')
    for r in p['decisione']['nullo']:
        P(f"- {r.get('condizione', r)}")
    P('')

    P('## Rischi\n')
    for r in p['rischi']:
        P(f"- **{r['rischio']}** — {r['dettaglio']}  \n  *mitigazione:* {r['mitigazione']}")
    P('')
    P('## Vincoli\n')
    for v in p['vincoli']:
        P(f"- {v}")
    P('')
    P('## Ciclo di vita\n')
    P('```\nCREATO → APPROVATO → ESEGUITO → VALIDATO → GO | NO_GO\n```\n')
    P("Questo protocollo nasce **CREATO**. L'approvazione è un atto umano: il Designer non "
      "si auto-approva. L'esecuzione spetta all'Experiment Runner.\n")
    return '\n'.join(o)


# ---------------------------------------------------------------- scrittura / stato
def _prossimo_id():
    os.makedirs(ESPERIMENTI, exist_ok=True)
    n = 0
    for d in os.listdir(ESPERIMENTI):
        m = re.fullmatch(r'EXP-(\d{4})', d)
        if m:
            n = max(n, int(m.group(1)))
    return f'EXP-{n + 1:04d}'


def esperimenti_esistenti():
    if not os.path.isdir(ESPERIMENTI):
        return {}
    fuori = {}
    for d in sorted(os.listdir(ESPERIMENTI)):
        p = os.path.join(ESPERIMENTI, d, 'prereg.json')
        s = os.path.join(ESPERIMENTI, d, 'status.json')
        if os.path.exists(p):
            with open(p) as f:
                pr = json.load(f)
            stato = json.load(open(s))['stato'] if os.path.exists(s) else '?'
            fuori[d] = {'fenomeno': pr['fenomeno'], 'stato': stato,
                        'versione_motore': pr['versione_motore'], 'tipo': pr['tipo']}
    return fuori


def scrivi(prereg):
    cartella = os.path.join(ESPERIMENTI, prereg['id'])
    os.makedirs(cartella, exist_ok=True)
    with open(os.path.join(cartella, 'prereg.json'), 'w') as f:
        json.dump(prereg, f, ensure_ascii=False, indent=2); f.write('\n')
    with open(os.path.join(cartella, 'protocol.md'), 'w') as f:
        f.write(protocollo_markdown(prereg))
    stato = {'id': prereg['id'], 'stato': 'CREATO', 'da': 'Experiment Designer',
             'quando': _ora(), 'sigillo_prereg': prereg['sigillo'],
             'prossimi_stati_ammessi': list(TRANSIZIONI['CREATO']),
             'nota': 'l\'approvazione e\' un atto umano: il Designer non si auto-approva'}
    with open(os.path.join(cartella, 'status.json'), 'w') as f:
        json.dump(stato, f, ensure_ascii=False, indent=2); f.write('\n')
    storia = [{'quando': _ora(), 'da': None, 'a': 'CREATO', 'attore': 'Experiment Designer',
               'nota': f"nato dal fenomeno {prereg['fenomeno']}",
               'sigillo_prereg': prereg['sigillo']}]
    with open(os.path.join(cartella, 'history.json'), 'w') as f:
        json.dump(storia, f, ensure_ascii=False, indent=2); f.write('\n')
    return cartella


def verifica_sigillo(exp_id):
    """Ricalcola il sigillo e lo confronta con quello depositato.
    Se qualcuno ha ritoccato ipotesi, dataset, KPI o soglie DOPO la creazione, si vede."""
    f = os.path.join(ESPERIMENTI, exp_id, 'prereg.json')
    if not os.path.exists(f):
        raise ValueError(f'esperimento sconosciuto: {exp_id}')
    with open(f) as fh:
        pr = json.load(fh)
    depositato = pr.get('sigillo')
    ricalcolato = _sigilla(pr)
    return {'esperimento': exp_id, 'integro': depositato == ricalcolato,
            'depositato': depositato, 'ricalcolato': ricalcolato}


def transizione(exp_id, nuovo, attore, nota=''):
    """Motore di stato. Usato dall'umano (approva/respingi) e domani dall'Experiment Runner."""
    cartella = os.path.join(ESPERIMENTI, exp_id)
    fs, fh = os.path.join(cartella, 'status.json'), os.path.join(cartella, 'history.json')
    if not os.path.exists(fs):
        raise ValueError(f'esperimento sconosciuto: {exp_id}')
    stato = json.load(open(fs))
    corrente = stato['stato']
    if nuovo not in STATI:
        raise ValueError(f'stato inesistente: {nuovo}')
    if nuovo not in TRANSIZIONI[corrente]:
        raise ValueError(f'transizione non ammessa {corrente} -> {nuovo}. '
                         f'Da {corrente} si puo\' solo: {", ".join(TRANSIZIONI[corrente]) or "—"}')
    if not attore:
        raise ValueError('ogni transizione richiede un attore: chi decide resta scritto')
    stato.update({'stato': nuovo, 'da': attore, 'quando': _ora(),
                  'prossimi_stati_ammessi': list(TRANSIZIONI[nuovo]), 'nota': nota})
    with open(fs, 'w') as f:
        json.dump(stato, f, ensure_ascii=False, indent=2); f.write('\n')
    storia = json.load(open(fh))
    storia.append({'quando': _ora(), 'da': corrente, 'a': nuovo, 'attore': attore, 'nota': nota})
    with open(fh, 'w') as f:
        json.dump(storia, f, ensure_ascii=False, indent=2); f.write('\n')
    return stato


# ---------------------------------------------------------------- orchestrazione
def genera(conoscenza=None, solo=None):
    """Esamina la mappa e crea i protocolli mancanti. Idempotente: un fenomeno gia'
    coperto (stesso motore) non genera un doppione."""
    c = conoscenza or carica_conoscenza()
    esistenti = esperimenti_esistenti()
    coperti = {(e['fenomeno'], e['versione_motore']) for e in esistenti.values()}

    creati, respinti, gia_coperti = [], [], []
    for fen in c['fenomeni']:
        if solo and fen['id'] not in solo:
            continue
        oss = _osservazioni_di(c, fen['id'])
        if not oss:
            continue
        ok, tipo, info = valuta_eleggibilita(fen, oss)
        if not ok:
            respinti.append({'fenomeno': fen['id'], 'confidenza': fen['confidenza']['livello'],
                             **info})
            continue
        chiave = (fen['id'], oss[0]['versione_motore'])
        if chiave in coperti:
            gia_coperti.append({'fenomeno': fen['id'],
                                'esperimento': next(k for k, v in esistenti.items()
                                                    if v['fenomeno'] == fen['id'])})
            continue
        exp_id = _prossimo_id()
        prereg = progetta(fen, oss, c, tipo, info, exp_id)
        cartella = scrivi(prereg)
        creati.append({'id': exp_id, 'fenomeno': fen['id'], 'tipo': tipo,
                       'cartella': os.path.relpath(cartella, RADICE)})
        esistenti[exp_id] = {'fenomeno': fen['id'], 'stato': 'CREATO',
                             'versione_motore': prereg['versione_motore'], 'tipo': tipo}
        coperti.add(chiave)
    return {'creati': creati, 'respinti': respinti, 'gia_coperti': gia_coperti,
            'esistenti': esperimenti_esistenti()}
