"""ai_lab/auditor/agent.py — l'Auditor Agent: orchestrazione e scrittura del dossier.

DIVISIONE DEL LAVORO (regola del laboratorio)
  Python  -> tutti i numeri (tools.py). Deterministico, verificabile, riproducibile.
  LLM     -> SOLO interpretazione e scrittura del dossier. Mai un calcolo.

Se non ci sono credenziali Claude, l'agente produce comunque il dossier in modalita'
DETERMINISTICA (template dai numeri), marcata a chiare lettere: il laboratorio non
resta fermo, ma nessuno scambia un riassunto meccanico per un'interpretazione.
"""
import datetime as _dt
import json
import os

from . import tools

QUI = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(QUI)
REPORTS = os.path.join(LAB, 'reports')
MEMORY = os.path.join(LAB, 'memory')
INDICE = os.path.join(MEMORY, 'index.json')

MODELLO_DEFAULT = 'claude-opus-4-8'
MAX_DIFFERENZE = 25          # quante differenze passare all'LLM (le piu' grandi)


# ---------------------------------------------------------------- memoria
def _carica_indice():
    if os.path.exists(INDICE):
        with open(INDICE) as f:
            return json.load(f)
    return {'dossier': []}


def _nuovo_id(gara, indice):
    oggi = _dt.date.today().strftime('%Y%m%d')
    slug = gara.upper().replace(' ', '')[:6]
    n = 1 + sum(1 for d in indice['dossier'] if d['id'].startswith(f'AUD-{slug}-{oggi}'))
    return f'AUD-{slug}-{oggi}-{n:02d}'


def _registra(record):
    os.makedirs(MEMORY, exist_ok=True)
    indice = _carica_indice()
    indice['dossier'] = [d for d in indice['dossier'] if d['id'] != record['id']]
    indice['dossier'].append(record)
    indice['dossier'].sort(key=lambda d: d['id'])
    with open(INDICE, 'w') as f:
        json.dump(indice, f, ensure_ascii=False, indent=2)
        f.write('\n')
    return indice


# ---------------------------------------------------------------- blocco dati per l'LLM
def _blocco_dati(a):
    """I fatti, gia' calcolati. L'LLM li interpreta e non ne produce di nuovi."""
    ridotto = dict(a)
    ridotto['differenze'] = a['differenze'][:MAX_DIFFERENZE]
    ridotto['_nota_troncamento'] = (
        f"mostrate le {min(MAX_DIFFERENZE, len(a['differenze']))} differenze piu' grandi "
        f"su {len(a['differenze'])} stint analizzati (ordinate per perdita cumulata)")
    return (
        "Ecco i FATTI GIA' CALCOLATI dal confronto realta'/simulazione. Sono l'unica fonte\n"
        "numerica che puoi usare: non calcolarne altri, non stimare, non arrotondare a occhio.\n"
        "Scrivi il Research Dossier nel formato richiesto dal tuo system prompt.\n\n"
        "```json\n" + json.dumps(ridotto, ensure_ascii=False, indent=2) + "\n```\n"
    )


# ---------------------------------------------------------------- scrittura via Claude
def _scrivi_con_llm(a, modello):
    """Ritorna (testo, meta) oppure (None, motivo) se non e' possibile."""
    try:
        import anthropic
    except ImportError:
        return None, "SDK 'anthropic' non installato (pip install anthropic)"

    try:
        client = anthropic.Anthropic()
    except Exception as e:                                   # credenziali assenti/rotte
        return None, f'client Claude non inizializzabile: {e}'

    with open(os.path.join(QUI, 'prompt.md')) as f:
        sistema = f.read()

    try:
        risposta = client.messages.create(
            model=modello,
            max_tokens=16000,
            system=sistema,
            thinking={'type': 'adaptive'},
            output_config={'effort': 'high'},
            messages=[{'role': 'user', 'content': _blocco_dati(a)}],
        )
    except Exception as e:
        return None, f'chiamata a Claude fallita: {type(e).__name__}: {e}'

    if getattr(risposta, 'stop_reason', None) == 'refusal':
        return None, 'la richiesta e\' stata rifiutata dal modello'
    testo = '\n'.join(b.text for b in risposta.content if b.type == 'text').strip()
    if not testo:
        return None, 'risposta vuota dal modello'
    u = risposta.usage
    return testo, {'modello': risposta.model,
                   'token_input': u.input_tokens, 'token_output': u.output_tokens}


# ---------------------------------------------------------------- scrittura deterministica
def _tabella(diff, n=10):
    righe = ['| pilota | stint | mescola | giri | residuo mediano (s) | perdita cumulata (s) |'
             ' pendenza (s/giro) | in traffico | candidato |',
             '|---|---|---|---|---|---|---|---|---|']
    for s in diff[:n]:
        righe.append('| {drv} | {stint} | {compound} | {n_giri_confrontati} | {residuo_mediano_s:+.3f} '
                     '| {perdita_cumulata_s:+.1f} | {pendenza_s_per_giro:+.4f} '
                     '| {frazione_giri_in_traffico:.0%} | {componente} |'.format(**s))
    return '\n'.join(righe)


def _scrivi_deterministico(a):
    """Dossier meccanico dai soli numeri. Nessuna interpretazione: e' dichiarato."""
    c = a['classificazione']['conteggi']
    r = a['residui_complessivi'] or {}
    rum = a['rumore']['noise_floor_s']
    cop = a['copertura']
    peggio = a['differenze'][0] if a['differenze'] else None
    dom = max(('degrado', 'traffico', 'non_classificabile', 'rumore'), key=lambda k: c.get(k, 0))
    p = a['classificazione']['per_componente'].get(dom, {})

    return f"""> **MODALITÀ DETERMINISTICA — SENZA INTERPRETAZIONE LLM.**
> Questo dossier è stato composto meccanicamente dai numeri, perché non erano disponibili
> credenziali Claude. I numeri sono completi e verificati; l'interpretazione, le ipotesi e
> il giudizio di confidenza **mancano** e vanno prodotti rieseguendo con l'LLM attivo
> (vedi `ai_lab/CONFIG.md`). Non trattare questo testo come un'analisi.

## Executive Summary

Sul GP **{a['gara']}** ({a['n_giri']} giri, {a['n_piloti']} piloti) sono stati confrontati
**{cop['stint_analizzati']} stint** tra realtà e simulazione del motore `{a['versione_motore']}`.
Il residuo mediano di stint è **{r.get('mediana', float('nan')):+.3f} s/giro**
(IQR {r.get('q25', float('nan')):+.3f} … {r.get('q75', float('nan')):+.3f}), contro un rumore
misurato di **{rum:.3f} s**. Il candidato più frequente è **{dom}**
({c.get(dom, 0)} stint, perdita cumulata totale {p.get('perdita_cumulata_totale_s', 0)} s).
{f"Il caso più grande è **{peggio['drv']}** stint {peggio['stint']} ({peggio['compound']}): {peggio['perdita_cumulata_s']:+.1f} s cumulati su {peggio['n_giri_confrontati']} giri." if peggio else ""}

## Scenario analizzato

Gara **{a['gara']}**, sessione di gara. Il confronto avviene **dentro ogni stint**, dal
giro di freeze (dopo {a['metodo']['soglie']['N_FREEZE']} giri puliti) fino alla fine dello
stint. Il pit-stop non è simulato dal motore, quindi non viene attraversato.

## Dati utilizzati

- Fonte: `{a['fonte']}`
- Motore auditato: `{a['versione_motore']}`
- Giri grezzi: {cop['giri_grezzi']} → giri puliti: {cop['giri_puliti']}
- Scarti d'igiene: `{json.dumps(cop['scarti_igiene'], ensure_ascii=False)}`
- Stint analizzati: {cop['stint_analizzati']} — scartati: {cop['stint_scartati']}
- Contesto: {a['contesto_gara']['giri_neutralizzati']} giri neutralizzati,
  {a['contesto_gara']['in_lap']} in-lap, {a['contesto_gara']['out_lap']} out-lap,
  {a['contesto_gara']['giri_senza_tempo']} giri senza tempo.

## Metodo

{a['metodo']['confronto']}.

Perché in quello spazio: {a['metodo']['perche_fuel_corretto']}.

Igiene: {a['metodo']['igiene']}.

Rumore: {a['rumore']['definizione']} — misurato su {a['rumore'].get('n_giri_usati', 0)} giri.

Limiti dichiarati:
{chr(10).join('- ' + x for x in a['metodo']['limiti_dichiarati'])}

## Differenze osservate

{_tabella(a['differenze'])}

Conteggio per candidato: `{json.dumps(c, ensure_ascii=False)}`

## Ipotesi

*Non generate in modalità deterministica.* I numeri sopra sono il materiale grezzo da cui
un Auditor con LLM attivo formulerebbe ipotesi falsificabili.

## Livello di confidenza

Non valutabile meccanicamente. Elementi oggettivi disponibili: campione =
{cop['stint_analizzati']} stint; rapporto effetto/rumore mediano =
{(abs(r.get('mediana', 0)) / rum if rum else 0):.1f}×.

## Possibili spiegazioni

Candidati assegnati dalle regole dichiarate, non da un ragionamento:
`{json.dumps(a['classificazione']['per_componente'], ensure_ascii=False)}`

## Esperimenti suggeriti

Non generati in modalità deterministica.

## Rischi

Il rischio principale di questo file è che venga letto come un'analisi: **non lo è**.
Vale inoltre il rischio strutturale di circolarità — le differenze sono misurate sulle
stesse gare che alimentano i coefficienti del progetto.

## Conclusione

Nessuna ipotesi è stata formulata né validata in questa modalità. I numeri richiedono
interpretazione e ogni ipotesi che ne derivi **richiede validazione indipendente** prima
di qualunque uso.
"""


# ---------------------------------------------------------------- intestazione + API
def _intestazione(rec, a):
    return (f"# Research Dossier {rec['id']} — {a['gara']}\n\n"
            f"| campo | valore |\n|---|---|\n"
            f"| ID | `{rec['id']}` |\n"
            f"| data | {rec['data']} |\n"
            f"| gara | {a['gara']} |\n"
            f"| versione motore | `{rec['versione_motore']}` |\n"
            f"| dataset | `{'`, `'.join(rec['dataset'])}` |\n"
            f"| stato | **{rec['stato']}** |\n"
            f"| generato da | {rec['generato_da']} |\n\n"
            f"*Prodotto dall'Auditor Agent del Muretto AI Lab. Il motore non è stato "
            f"toccato: sola lettura.*\n\n---\n\n")


def genera_dossier(gara, usa_llm=True, modello=MODELLO_DEFAULT):
    """Analizza una gara e produce il Research Dossier. Ritorna (percorso, record, avviso)."""
    nome, _ = tools.risolvi_gara(gara)
    analisi = tools.analizza_gara(nome)

    avviso = None
    if usa_llm:
        corpo, meta = _scrivi_con_llm(analisi, modello)
        if corpo is None:
            avviso = meta
            corpo, generato = _scrivi_deterministico(analisi), 'deterministico (LLM non disponibile)'
        else:
            generato = (f"Claude {meta['modello']} "
                        f"({meta['token_input']}→{meta['token_output']} token)")
    else:
        corpo, generato = _scrivi_deterministico(analisi), 'deterministico (richiesto)'

    indice = _carica_indice()
    record = {
        'id': _nuovo_id(nome, indice),
        'data': _dt.datetime.now().strftime('%Y-%m-%d %H:%M'),
        'gara': nome,
        'versione_motore': analisi['versione_motore'],
        'dataset': [analisi['fonte']],
        'stato': 'aperto',                      # aperto | validato | respinto — lo muove un umano
        'generato_da': generato,
        'sintesi': {
            'stint_analizzati': analisi['copertura']['stint_analizzati'],
            'residuo_mediano_s': (analisi['residui_complessivi'] or {}).get('mediana'),
            'noise_floor_s': analisi['rumore']['noise_floor_s'],
            'conteggi': analisi['classificazione']['conteggi'],
        },
    }
    os.makedirs(REPORTS, exist_ok=True)
    percorso = os.path.join(REPORTS, f"{record['id']}.md")
    with open(percorso, 'w') as f:
        f.write(_intestazione(record, analisi) + corpo)
    record['file'] = os.path.relpath(percorso, LAB)

    # Sidecar dei FATTI, congelato al momento della generazione. Il dossier .md resta
    # la versione umana e non viene mai toccato; questo file e' la versione macchina,
    # cosi' chi legge a valle (Knowledge Extractor) non deve parsare la prosa — che e'
    # il modo piu' rapido di inventare relazioni che i dati non sostengono.
    fatti = os.path.join(REPORTS, f"{record['id']}.facts.json")
    with open(fatti, 'w') as f:
        json.dump(analisi, f, ensure_ascii=False, indent=2)
        f.write('\n')
    record['fatti'] = os.path.relpath(fatti, LAB)

    _registra(record)
    return percorso, record, avviso
