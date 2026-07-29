"""ai_lab/extractor/extractor.py — Knowledge Extractor: il secondo ricercatore del Lab.

COMPITO
  Legge ogni Research Dossier prodotto dall'Auditor e lo trasforma in conoscenza
  strutturata e incrementale: fenomeni, ipotesi, componenti, variabili, circuiti,
  condizioni, confidenza, collegamenti.

TRE CONFINI (in ordine di importanza)
  1. Non tocca il motore.                    -> importa solo tools per i tipi/aiuti, sola lettura.
  2. Non altera i dossier originali.         -> scrive UNICAMENTE in ai_lab/knowledge/.
  3. Non deduce relazioni non sostenute.     -> vedi sotto, e' la parte che conta.

PERCHE' NESSUN LLM, PER COSTRUZIONE
  Un LLM e' esattamente lo strumento che, messo qui, inventerebbe collegamenti plausibili
  e non sostenuti: e' il suo modo di fallire. Questo estrattore e' quindi 100% Python
  deterministico. Stessi dossier -> stessa mappa, sempre, senza chiamate di rete.

DA DOVE VENGONO I FATTI
  Dal sidecar `<ID>.facts.json` che l'Auditor congela alla generazione. La prosa del
  dossier .md viene letta SOLO per le ipotesi, e riportata **verbatim**: mai
  re-interpretata, mai convertita in un livello di confidenza dall'estrattore.

COSA E' UN COLLEGAMENTO (e cosa non e')
  Un collegamento e' una **co-occorrenza misurata** fra due osservazioni che condividono
  componente e condizione, con l'evidenza numerica allegata. Non e' mai una relazione
  causale, e non viene mai creato per somiglianza testuale.

COME CRESCE LA CONFIDENZA
  Non per insistenza: per **replicazione su gare diverse**. Una sola gara resta 'basso'
  anche con un effetto enorme, perche' e' in-sample. E' la legge anti-circolarita' del
  laboratorio resa meccanica.
"""
import json
import os
import re
import statistics as st
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(QUI)
if LAB not in sys.path:
    sys.path.insert(0, LAB)

from auditor.tools import _distribuzione as distribuzione   # riuso, niente doppioni

CONOSCENZA_DIR = os.path.join(LAB, 'knowledge')
STORE = os.path.join(CONOSCENZA_DIR, 'conoscenza.json')
MAPPA = os.path.join(CONOSCENZA_DIR, 'MAPPA.md')
INDICE_DOSSIER = os.path.join(LAB, 'memory', 'index.json')

# ---------------------------------------------------------------- soglie dichiarate
MIN_STINT_OSSERVAZIONE = 2   # sotto questo supporto non si crea un'osservazione
FATTORE_MARCATO = 2.0        # effetto > 2x rumore = 'marcato'
GARE_MEDIO = 2               # gare concordi per confidenza 'medio'
GARE_ALTO = 3                # gare concordi per confidenza 'alto'
STINT_MEDIO = 5              # supporto minimo complessivo per 'medio'

COMPONENTI_FENOMENO = ('degrado', 'traffico', 'rumore', 'non_classificabile')


# ---------------------------------------------------------------- lettura dossier
def _leggi_indice():
    if not os.path.exists(INDICE_DOSSIER):
        return []
    with open(INDICE_DOSSIER) as f:
        return json.load(f).get('dossier', [])


def _sezione(md, titolo):
    """Testo grezzo di una sezione '## <titolo>' del dossier. Verbatim, mai interpretato."""
    m = re.search(rf'^##\s+{re.escape(titolo)}\s*$(.*?)(?=^##\s|\Z)', md, re.M | re.S)
    return m.group(1).strip() if m else ''


def _estrai_ipotesi(md):
    """Ipotesi H1/H2/... dal dossier. Testo VERBATIM: l'estrattore non le giudica."""
    sez = _sezione(md, 'Ipotesi')
    if not sez:
        return [], 'sezione "Ipotesi" assente nel dossier'
    if 'Non generate in modalit' in sez:
        return [], 'dossier in modalita\' deterministica: nessuna ipotesi formulata'
    voci, correnti = [], None
    for riga in sez.splitlines():
        m = re.match(r'^\s*(?:[-*]\s*)?\**\s*(H\d+)\b[\.\):\s]*(.*)$', riga)
        if m:
            if correnti:
                voci.append(correnti)
            correnti = {'id': m.group(1), 'testo': m.group(2).strip()}
        elif correnti and riga.strip():
            correnti['testo'] += ' ' + riga.strip()
    if correnti:
        voci.append(correnti)
    for v in voci:
        v['testo'] = ' '.join(v['testo'].replace('**', '').split())
    return voci, None if voci else 'nessuna voce H<n> riconosciuta nella sezione'


def _carica_dossier(rec):
    """Fatti (macchina) + prosa (umana). Nessuna scrittura."""
    fatti_rel = rec.get('fatti')
    if not fatti_rel:
        return None, ("dossier senza sidecar dei fatti: prodotto da una versione "
                      "dell'Auditor precedente al sidecar. Rigenerarlo per estrarlo.")
    fatti_path = os.path.join(LAB, fatti_rel)
    if not os.path.exists(fatti_path):
        return None, f'sidecar dei fatti mancante: {fatti_rel}'
    with open(fatti_path) as f:
        fatti = json.load(f)
    md_path = os.path.join(LAB, rec['file'])
    md = open(md_path).read() if os.path.exists(md_path) else ''
    return {'record': rec, 'fatti': fatti, 'md': md}, None


# ---------------------------------------------------------------- osservazioni
def _forza(effetto, rumore, n_stint):
    """Quanto e' solido l'effetto DENTRO una gara. Regole dichiarate, nessun giudizio."""
    if n_stint < MIN_STINT_OSSERVAZIONE:
        return 'insufficiente'
    if abs(effetto) <= rumore:
        return 'nullo'
    if abs(effetto) <= FATTORE_MARCATO * rumore:
        return 'debole'
    return 'marcato'


def _osservazioni_da(d):
    """Un'osservazione per (dossier x componente x mescola). Solo fatti misurati."""
    fatti, rec = d['fatti'], d['record']
    rumore = fatti['rumore']['noise_floor_s']
    gruppi, scartati = {}, []
    for s in fatti['differenze']:
        gruppi.setdefault((s['componente'], s['compound']), []).append(s)

    fuori = []
    for (comp, mescola), stint in sorted(gruppi.items()):
        if len(stint) < MIN_STINT_OSSERVAZIONE:
            scartati.append({'componente': comp, 'mescola': mescola, 'n_stint': len(stint),
                             'motivo': f'supporto < {MIN_STINT_OSSERVAZIONE} stint'})
            continue
        res = [s['residuo_mediano_s'] for s in stint]
        cum = [s['perdita_cumulata_s'] for s in stint]
        pend = [s['pendenza_s_per_giro'] for s in stint]
        traf = [s['frazione_giri_in_traffico'] for s in stint]
        eta = [s['eta_gomma_max'] for s in stint]
        eff = st.median(res)
        # differenziale traffico<->aria pulita: per il componente 'traffico' e' QUESTA la
        # grandezza che porta il senso. Il residuo complessivo, da solo, si leggerebbe
        # come "in traffico si va piu' forte" — che non e' cio' che la misura dice.
        delta_traf = [s['residuo_mediano_in_traffico_s'] - s['residuo_mediano_aria_pulita_s']
                      for s in stint
                      if s['residuo_mediano_in_traffico_s'] is not None
                      and s['residuo_mediano_aria_pulita_s'] is not None]
        if comp == 'traffico' and delta_traf:
            eff = st.median(delta_traf)      # l'effetto che conta per questo componente
        fuori.append({
            'id': f"OSS-{fatti['gara'].replace(' ', '')}-{comp}-{mescola}",
            'dossier_id': rec['id'],
            'gara': fatti['gara'],
            'circuito': fatti['gara'],
            'versione_motore': fatti['versione_motore'],
            'fenomeno': f'FEN-{comp}-{mescola}',
            'componente': comp,
            'condizioni': {
                'mescola': mescola,
                'eta_gomma_max_mediana': st.median(eta),
                'frazione_traffico_mediana': round(st.median(traf), 2),
                'gara_con_neutralizzazioni': fatti['contesto_gara']['giri_neutralizzati'] > 0,
                'giri_neutralizzati_gara': fatti['contesto_gara']['giri_neutralizzati'],
            },
            'variabili': {
                'residuo_mediano_s': distribuzione(res),
                'perdita_cumulata_s': distribuzione(cum),
                'pendenza_s_per_giro': distribuzione(pend),
                'differenziale_traffico_s': distribuzione(delta_traf),
            },
            'grandezza_portante': ('differenziale_traffico_s' if comp == 'traffico'
                                   else 'residuo_mediano_s'),
            'supporto': {
                'n_stint': len(stint),
                'n_giri': sum(s['n_giri_confrontati'] for s in stint),
                'piloti': sorted({s['drv'] for s in stint}),
            },
            'rumore_gara_s': rumore,
            'effetto_s_giro': round(eff, 3),
            'segno': 'positivo' if eff > 0 else ('negativo' if eff < 0 else 'nullo'),
            'rapporto_effetto_rumore': round(abs(eff) / rumore, 2) if rumore else None,
            'forza': _forza(eff, rumore, len(stint)),
        })
    return fuori, scartati


# ---------------------------------------------------------------- collegamenti
def _collegamenti(osservazioni):
    """Co-occorrenze MISURATE. Mai causali, mai da somiglianza testuale."""
    link = []
    per_fen = {}
    for o in osservazioni:
        per_fen.setdefault(o['fenomeno'], []).append(o)

    for fen, oss in sorted(per_fen.items()):
        for i in range(len(oss)):
            for j in range(i + 1, len(oss)):
                a, b = oss[i], oss[j]
                if a['gara'] == b['gara']:
                    if a['dossier_id'] != b['dossier_id']:
                        link.append({
                            'tipo': 'stesso_circuito_rianalisi', 'da': a['id'], 'a': b['id'],
                            'fenomeno': fen,
                            'evidenza': (f"stessa gara {a['gara']}, due dossier distinti "
                                         f"({a['dossier_id']} e {b['dossier_id']})"),
                            'natura': 'co-occorrenza misurata, non relazione causale'})
                    continue
                nulli = [x for x in (a, b) if x['forza'] == 'nullo']
                if nulli:
                    tipo = 'non_replicato'
                    ev = (f"{fen} misurato in {a['gara']} ({a['effetto_s_giro']:+.3f} s/giro, "
                          f"{a['forza']}) e {b['gara']} ({b['effetto_s_giro']:+.3f} s/giro, "
                          f"{b['forza']}): in almeno una gara l'effetto resta dentro il rumore")
                elif a['segno'] == b['segno']:
                    tipo = 'ripetizione_altra_gara'
                    ev = (f"stesso componente e stessa mescola su circuiti diversi "
                          f"({a['gara']} {a['effetto_s_giro']:+.3f} s/giro; "
                          f"{b['gara']} {b['effetto_s_giro']:+.3f} s/giro), stesso segno, "
                          f"entrambi sopra il rumore della rispettiva gara")
                else:
                    tipo = 'divergenza'
                    ev = (f"stesso componente e stessa mescola ma segno OPPOSTO: "
                          f"{a['gara']} {a['effetto_s_giro']:+.3f} s/giro contro "
                          f"{b['gara']} {b['effetto_s_giro']:+.3f} s/giro")
                voce = {'tipo': tipo, 'da': a['id'], 'a': b['id'], 'fenomeno': fen,
                        'evidenza': ev,
                        'natura': 'co-occorrenza misurata, non relazione causale'}
                if a['versione_motore'] != b['versione_motore']:
                    voce['avvertenza'] = ('osservazioni prodotte da versioni DIVERSE del '
                                          'motore: non direttamente confrontabili')
                link.append(voce)
    return link


# ---------------------------------------------------------------- fenomeni
def _confidenza(oss_del_fen):
    """La confidenza sale con la REPLICAZIONE su gare diverse, non con l'insistenza."""
    utili = [o for o in oss_del_fen if o['forza'] in ('debole', 'marcato')]
    circuiti = sorted({o['circuito'] for o in utili})
    if not utili:
        return {'livello': 'nullo', 'gare_concordi': 0, 'circuiti': [],
                'perche': 'in nessuna gara l\'effetto supera il rumore locale',
                'regola': 'effetto <= rumore in tutte le osservazioni'}
    segni = {o['segno'] for o in utili}
    if len(segni) > 1:
        return {'livello': 'contesa', 'gare_concordi': 0, 'circuiti': circuiti,
                'perche': ('osservazioni di segno opposto su circuiti diversi: la mappa '
                           'registra il conflitto e NON lo media'),
                'regola': 'segni discordi fra osservazioni sopra il rumore'}
    n_gare, n_stint = len(circuiti), sum(o['supporto']['n_stint'] for o in utili)
    n_marcate = sum(1 for o in utili if o['forza'] == 'marcato')
    if n_gare >= GARE_ALTO and n_stint >= STINT_MEDIO and n_marcate >= 2:
        liv, perche = 'alto', f'replicato su {n_gare} circuiti con segno concorde'
    elif n_gare >= GARE_MEDIO and n_stint >= STINT_MEDIO:
        liv, perche = 'medio', f'replicato su {n_gare} circuiti con segno concorde'
    else:
        liv, perche = 'basso', ('osservato su un solo circuito: in-sample, non ancora '
                                'replicato fuori campione')
    return {'livello': liv, 'gare_concordi': n_gare, 'circuiti': circuiti,
            'n_stint_totali': n_stint, 'perche': perche,
            'regola': (f'basso=1 circuito; medio>={GARE_MEDIO} circuiti e >={STINT_MEDIO} '
                       f'stint; alto>={GARE_ALTO} circuiti, >=2 marcate, segno concorde')}


def _fenomeni(osservazioni):
    per_fen = {}
    for o in osservazioni:
        per_fen.setdefault(o['fenomeno'], []).append(o)
    fuori = []
    for fen, oss in sorted(per_fen.items()):
        conf = _confidenza(oss)
        utili = [o for o in oss if o['forza'] in ('debole', 'marcato')]
        manca = None
        if conf['livello'] == 'basso':
            manca = (f"una misura su un circuito diverso da {conf['circuiti'][0]} "
                     f"per passare da in-sample a replicato")
        elif conf['livello'] == 'medio':
            manca = f'un terzo circuito concorde per salire ad "alto"'
        elif conf['livello'] == 'contesa':
            manca = 'un esperimento che spieghi perche\' il segno si inverte fra circuiti'
        # La confidenza misura la RIPRODUCIBILITA' fra circuiti, non la comprensione della
        # causa. Tenerle distinte evita la lettura peggiore: "alto" su un fenomeno che,
        # per costruzione, non ha ancora un meccanismo identificato.
        comp0 = oss[0]['componente']
        natura = {
            'degrado': 'meccanismo candidato: degrado, non ancora validato',
            'traffico': 'meccanismo candidato: traffico, non ancora validato',
            'rumore': 'assenza di effetto: il motore regge entro il rumore',
            'non_classificabile': ('osservazione riproducibile SENZA meccanismo identificato: '
                                   'la confidenza riguarda la ripetibilita\', non la spiegazione'),
        }[comp0]
        fuori.append({
            'id': fen,
            'componente': comp0,
            'natura': natura,
            'condizione_chiave': {'mescola': oss[0]['condizioni']['mescola']},
            'osservazioni': [o['id'] for o in oss],
            'circuiti': sorted({o['circuito'] for o in oss}),
            'n_gare': len({o['gara'] for o in oss}),
            'effetto_mediano_s_giro': (round(st.median([o['effetto_s_giro'] for o in utili]), 3)
                                       if utili else None),
            'confidenza': conf,
            'manca_per_salire': manca,
        })
    fuori.sort(key=lambda f: (-{'alto': 3, 'medio': 2, 'basso': 1, 'contesa': 1, 'nullo': 0}
                              [f['confidenza']['livello']],
                              -(abs(f['effetto_mediano_s_giro'] or 0))))
    return fuori


# ---------------------------------------------------------------- costruzione
def estrai(solo_dossier=None):
    """Ricostruisce la conoscenza da TUTTI i dossier con sidecar. Idempotente."""
    dossier_letti, saltati, osservazioni, ipotesi_tot = [], [], [], []
    for rec in _leggi_indice():
        if solo_dossier and rec['id'] not in solo_dossier:
            continue
        d, err = _carica_dossier(rec)
        if err:
            saltati.append({'dossier_id': rec['id'], 'motivo': err})
            continue
        oss, scartati = _osservazioni_da(d)
        ip, nota = _estrai_ipotesi(d['md'])
        osservazioni += oss
        ipotesi_tot += [dict(x, dossier_id=rec['id'], gara=rec['gara']) for x in ip]
        dossier_letti.append({
            'id': rec['id'], 'gara': rec['gara'], 'data': rec['data'],
            'versione_motore': rec['versione_motore'], 'stato': rec['stato'],
            'generato_da': rec.get('generato_da'),
            'n_osservazioni': len(oss),
            'gruppi_scartati_per_supporto': scartati,
            'ipotesi': ip,
            'nota_ipotesi': nota,
            'confidenza_dichiarata_testo': _sezione(d['md'], 'Livello di confidenza') or None,
        })

    fenomeni = _fenomeni(osservazioni)
    link = _collegamenti(osservazioni)
    motori = sorted({o['versione_motore'] for o in osservazioni})
    return {
        'metodo': {
            'natura': 'estrazione deterministica, nessun LLM coinvolto per costruzione',
            'fonte_fatti': 'sidecar <ID>.facts.json congelato dall\'Auditor',
            'fonte_ipotesi': 'sezione "## Ipotesi" del dossier, riportata VERBATIM',
            'grana_osservazione': 'dossier x componente x mescola',
            'natura_collegamenti': ('co-occorrenze misurate fra osservazioni che condividono '
                                    'componente e condizione; mai causali, mai testuali'),
            'regola_confidenza': ('sale con la replicazione su circuiti diversi, non con la '
                                  'dimensione dell\'effetto: una sola gara resta "basso"'),
            'soglie': {'MIN_STINT_OSSERVAZIONE': MIN_STINT_OSSERVAZIONE,
                       'FATTORE_MARCATO': FATTORE_MARCATO, 'GARE_MEDIO': GARE_MEDIO,
                       'GARE_ALTO': GARE_ALTO, 'STINT_MEDIO': STINT_MEDIO},
            'limiti': [
                ('le osservazioni vengono dalle stesse gare che alimentano i coefficienti '
                 'del progetto: la replicazione qui e\' fra circuiti, NON fuori campione'),
                ('un fenomeno "non_classificabile" resta tale: l\'estrattore non scioglie '
                 'ambiguita\' che la misura non ha sciolto'),
                'osservazioni con versioni diverse del motore non sono confrontabili',
            ],
        },
        'copertura': {
            'dossier_letti': len(dossier_letti), 'dossier_saltati': saltati,
            'osservazioni': len(osservazioni), 'fenomeni': len(fenomeni),
            'collegamenti': len(link), 'ipotesi': len(ipotesi_tot),
            'versioni_motore': motori,
            'motore_omogeneo': len(motori) <= 1,
        },
        'dossier': dossier_letti,
        'osservazioni': osservazioni,
        'fenomeni': fenomeni,
        'collegamenti': link,
        'ipotesi': ipotesi_tot,
    }


def salva(c):
    os.makedirs(CONOSCENZA_DIR, exist_ok=True)
    with open(STORE, 'w') as f:
        json.dump(c, f, ensure_ascii=False, indent=2)
        f.write('\n')
    with open(MAPPA, 'w') as f:
        f.write(mappa_markdown(c))
    return STORE, MAPPA


# ---------------------------------------------------------------- mappa leggibile
_SIMBOLO = {'alto': 'ALTO', 'medio': 'MEDIO', 'basso': 'BASSO',
            'contesa': 'CONTESA', 'nullo': 'NULLO'}


def mappa_markdown(c):
    cop, out = c['copertura'], []
    P = out.append
    P('# Mappa della conoscenza — Muretto AI Lab\n')
    P('*Generata dal Knowledge Extractor. Deterministica: stessi dossier, stessa mappa.*')
    P('*Nessun LLM coinvolto. I collegamenti sono co-occorrenze misurate, mai causali.*\n')
    P(f"- dossier letti: **{cop['dossier_letti']}** "
      f"(saltati: {len(cop['dossier_saltati'])})")
    P(f"- osservazioni: **{cop['osservazioni']}** · fenomeni: **{cop['fenomeni']}** · "
      f"collegamenti: **{cop['collegamenti']}** · ipotesi: **{cop['ipotesi']}**")
    P(f"- motore: {', '.join(f'`{m}`' for m in cop['versioni_motore']) or 'n/d'}"
      f"{'' if cop['motore_omogeneo'] else '  **ATTENZIONE: versioni diverse, non confrontabili**'}\n")

    P('## Fenomeni\n')
    P('La confidenza sale con la **replicazione su circuiti diversi**, non con la dimensione '
      "dell'effetto. Un fenomeno visto su una sola gara resta `basso`: è in-sample.\n")
    P('> **Cosa misura la confidenza:** quanto l\'osservazione si **ripete** fra circuiti — '
      'non quanto la causa è capita. Un `non_classificabile` può essere `ALTO`: significa '
      'che il residuo ricompare ovunque, **non** che sappiamo perché.\n')
    P('| fenomeno | componente | mescola | circuiti | effetto (s/giro) | confidenza | natura | manca per salire |')
    P('|---|---|---|---|---|---|---|---|')
    for f in c['fenomeni']:
        eff = '—' if f['effetto_mediano_s_giro'] is None else f"{f['effetto_mediano_s_giro']:+.3f}"
        P(f"| `{f['id']}` | {f['componente']} | {f['condizione_chiave']['mescola']} | "
          f"{', '.join(f['circuiti'])} | {eff} | **{_SIMBOLO[f['confidenza']['livello']]}** | "
          f"{f['natura']} | {f['manca_per_salire'] or '—'} |")
    P('')

    conflitti = [f for f in c['fenomeni'] if f['confidenza']['livello'] == 'contesa']
    if conflitti:
        P('## Conflitti aperti\n')
        P('Segni opposti fra circuiti. La mappa **registra e non media**.\n')
        for f in conflitti:
            P(f"- `{f['id']}` — {f['confidenza']['perche']} (circuiti: {', '.join(f['circuiti'])})")
        P('')

    rip = [l for l in c['collegamenti'] if l['tipo'] == 'ripetizione_altra_gara']
    if rip:
        P('## Ripetizioni fra gare diverse\n')
        P('È il meccanismo che fa crescere la conoscenza: lo stesso fenomeno ricompare altrove.\n')
        for l in rip:
            P(f"- **{l['fenomeno']}** · `{l['da']}` ↔ `{l['a']}`  \n  {l['evidenza']}"
              + (f"  \n  ⚠ {l['avvertenza']}" if 'avvertenza' in l else ''))
        P('')

    div = [l for l in c['collegamenti'] if l['tipo'] == 'divergenza']
    nonrep = [l for l in c['collegamenti'] if l['tipo'] == 'non_replicato']
    if div or nonrep:
        P('## Mancate repliche e divergenze\n')
        for l in div + nonrep:
            P(f"- *{l['tipo']}* — **{l['fenomeno']}**: {l['evidenza']}")
        P('')

    P('## Ipotesi raccolte dai dossier\n')
    if c['ipotesi']:
        for i in c['ipotesi']:
            P(f"- **{i['id']}** ({i['gara']}, `{i['dossier_id']}`): {i['testo']}")
    else:
        P('Nessuna ipotesi presente nei dossier letti. Motivi per dossier:\n')
        for d in c['dossier']:
            if d['nota_ipotesi']:
                P(f"- `{d['id']}`: {d['nota_ipotesi']}")
    P('')
    P('*Le ipotesi sono riportate verbatim dai dossier: il Knowledge Extractor non le '
      'giudica e non ne deriva confidenza.*\n')

    P('## Limiti dichiarati\n')
    for x in c['metodo']['limiti']:
        P(f'- {x}')
    return '\n'.join(out) + '\n'
