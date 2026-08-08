"""gen_rc_feed.py — LIVELLO 1 UI (decisione PO su MOCKUP_RACE_CONTROL_UI.md: si' a tutto):
riduce data/race_control_2026.csv (generato da gen_race_control.py, fonte FastF1) al JSON
che la demo consuma -> demo/data/race_control_2026.json.

Per gara:
  feed:     tacche della timeline eventi, SOLO categorie decise (rumore escluso):
            - tipo "sc" / "vsc": Safety Car e Virtual Safety Car, come INTERVALLI
            - tipo "rossa":    bandiera rossa (gara sospesa)
            - tipo "giallo":   bandiere YELLOW / DOUBLE YELLOW (raggruppate per giro)
            - tipo "penalita": ogni annuncio penalita' (tempo e non-tempo; NON i "SERVED")
            - tipo "info":     investigazioni / lap time deleted (raggruppate per giro)
  penalita: SOLO annunci di penalita' di TEMPO (per i badge "+Ns" in tabella):
            {pilota, secondi, giro, motivo}
Le penalita' si MOSTRANO: niente aritmetica, niente simulazione (livello 1).

LE SAFETY CAR MANCAVANO (riparato 08/08/2026). La catena di elif non aveva un ramo per la
categoria 'SafetyCar': 45 messaggi su 45 — tutti con il numero di giro — cadevano fuori, e
il JSON pubblicato aveva 296 voci e ZERO eventi SC. Sparivano fra la sorgente e la pagina
gli eventi che decidono le gare.

DUE FONTI, DUE DOMANDE DIVERSE — e non vanno confuse (regola 1):
  - QUI c'e' l'ANNUNCIO: un istante, il giro in cui il messaggio e' uscito.
  - In demo/neutralizzazione.json c'e' il REGIME MISURATO per giro, ricavato dallo status
    per-auto: e' l'UNIONE fra i piloti, quindi comincia prima (l'auto piu' lenta sta ancora
    percorrendo il suo giro 11 quando l'annuncio cade nel giro 12 del battistrada).
    Misurato sulle 11 gare: la fine coincide quasi sempre, l'inizio anticipa di 0-5 giri.
  Nessuna delle due e' sbagliata. Le bande della barra e il colore del nastro leggono la
  seconda (il regime); questo feed porta la prima (l'annuncio). Non si mescolano.

L'ORDINE E' QUELLO DEL TIMESTAMP, non del file ne' del numero di giro: in Gran Bretagna la
Safety Car rientra alle 15:27:42 e ne parte una SECONDA alle 15:27:50, nello stesso giro 51.
Ordinare per (giro, testo) fondeva i due periodi in uno solo, sbagliato.
"""
import csv, json, os, re

PEN_RE = re.compile(r'(\d+)\s*SECOND(?:S)?\s*TIME\s*PENALTY.*?CAR\s*(\d+)\s*\((\w+)\)', re.I)
SERVED = 'FIA STEWARDS: PENALTY SERVED'

APRE = {'VSC DEPLOYED': 'vsc', 'SAFETY CAR DEPLOYED': 'sc'}
CHIUDE = {'VSC ENDING': 'vsc', 'SAFETY CAR IN THIS LAP': 'sc'}
ROSSA = 'RED FLAG'
ETICHETTA = {'sc': 'Safety Car', 'vsc': 'Virtual Safety Car'}


def motivo(testo):
    parti = testo.split(' - ', 1)
    return re.sub(r'\s*\(\d{2}:\d{2}:\d{2}\)\s*$', '', parti[1]).strip() if len(parti) > 1 else ''


def regimi(righe):
    """Gli intervalli SC/VSC/rossa di UNA gara, in ordine di timestamp.

    Un periodo si apre col DEPLOYED e si chiude col suo ENDING / IN THIS LAP. Se non
    arriva mai (a Monaco la seconda Safety Car e' interrotta dalla bandiera rossa, e in
    Gran Bretagna l'ultima e' interrotta dalla bandiera a scacchi) si chiude sull'evento
    che l'ha davvero interrotto: mai su un giro inventato, mai lasciato aperto in pagina.
    Ritorna [(tipo, giro_inizio, giro_fine, chiuso_da)]."""
    ordinate = sorted(righe, key=lambda r: r['timestamp'])
    fuori, aperto = [], {}
    ultimo_giro = max((int(r['giro']) for r in righe if r['giro']), default=None)
    for r in ordinate:
        if not r['giro']:
            continue
        giro, testo = int(r['giro']), r['testo'].strip().upper()
        if r['categoria'] == 'SafetyCar' and testo in APRE:
            tipo = APRE[testo]
            if tipo in aperto:                        # DEPLOYED ripetuto: il primo resta
                continue
            aperto[tipo] = giro
        elif r['categoria'] == 'SafetyCar' and testo in CHIUDE:
            tipo = CHIUDE[testo]
            if tipo in aperto:
                fuori.append((tipo, aperto.pop(tipo), giro, 'messaggio'))
        elif testo.startswith(ROSSA):
            for tipo in list(aperto):                 # la rossa interrompe cio' che e' aperto
                fuori.append((tipo, aperto.pop(tipo), giro, 'bandiera rossa'))
            fuori.append(('rossa', giro, giro, 'messaggio'))
    for tipo, giro in aperto.items():                 # mai chiuso: finisce con la gara
        fuori.append((tipo, giro, ultimo_giro, 'bandiera a scacchi'))
    return sorted(fuori, key=lambda x: (x[1], x[0]))

def main():
    with open(os.path.join('data', 'race_control_2026.csv')) as f:
        righe = list(csv.DictReader(f))
    out = {}
    # 1) i regimi (SC/VSC/rossa) si ricavano PRIMA, perche' sono intervalli e hanno bisogno
    #    dell'ordine cronologico dell'intera gara, non della singola riga
    per_gara = {}
    for r in righe:
        per_gara.setdefault(r['gara'], []).append(r)
    for gara, rg in per_gara.items():
        g = out.setdefault(gara, {'feed': [], 'penalita': [],
                                  'fonte': 'race control FastF1 (gen_race_control.py)'})
        for tipo, a, b, chiuso in regimi(rg):
            if tipo == 'rossa':
                g['feed'].append(dict(giro=a, tipo='rossa', testo='Bandiera rossa — gara sospesa'))
            else:
                durata = b - a
                g['feed'].append(dict(
                    giro=a, fine=b, tipo=tipo,
                    testo=f'{ETICHETTA[tipo]}: giri {a}-{b}' if durata else
                          f'{ETICHETTA[tipo]}: giro {a}',
                    **({'chiuso_da': chiuso} if chiuso != 'messaggio' else {})))

    # 2) il resto del feed, riga per riga
    for r in righe:
        g = out.setdefault(r['gara'], {'feed': [], 'penalita': [],
                                       'fonte': 'race control FastF1 (gen_race_control.py)'})
        testo, giro = r['testo'], int(r['giro']) if r['giro'] else None
        if giro is None:
            continue                                    # senza giro non e' agganciabile alla barra
        if testo.startswith(SERVED):
            continue                                    # feed = annunci; i SERVED sono rumore qui
        if r['categoria'] == 'SafetyCar':
            continue                                    # gia' resi come intervalli, sopra
        pm = PEN_RE.search(testo)
        if pm:
            g['penalita'].append(dict(pilota=pm.group(3).upper(), secondi=int(pm.group(1)),
                                      giro=giro, motivo=motivo(testo)))
            g['feed'].append(dict(giro=giro, tipo='penalita',
                                  testo=f"+{pm.group(1)}s {pm.group(3).upper()}"
                                        + (f" — {motivo(testo)}" if motivo(testo) else '')))
        elif 'PENALTY' in testo.upper():                # stop&go / drive-through: feed, no badge
            g['feed'].append(dict(giro=giro, tipo='penalita',
                                  testo=testo.replace('FIA STEWARDS: ', '')))
        elif r['categoria'] == 'Flag' and r['bandiera'] in ('YELLOW', 'DOUBLE YELLOW'):
            g['feed'].append(dict(giro=giro, tipo='giallo', testo=testo))
        elif 'INVESTIGATION' in testo.upper() or 'DELETED' in testo.upper():
            g['feed'].append(dict(giro=giro, tipo='info', testo=testo.replace('FIA STEWARDS: ', '')))

    # raggruppa giallo/info per giro (una tacca per giro e tipo, tooltip = primi 3 testi)
    for g in out.values():
        gr = {}
        for e in g['feed']:
            # penalita' e regimi restano DISTINTI: due Safety Car possono cominciare nello
            # stesso giro (Gran Bretagna, giro 51) e fonderle ne cancellerebbe una
            if e['tipo'] in ('penalita', 'sc', 'vsc', 'rossa'):
                gr[(e['tipo'], e['giro'], e['testo'])] = e
            else:
                k = (e['tipo'], e['giro'])
                if k in gr:
                    if gr[k]['testo'].count(' · ') < 2:
                        gr[k]['testo'] += ' · ' + e['testo']
                else:
                    gr[k] = dict(e)
        g['feed'] = sorted(gr.values(), key=lambda e: (e['giro'], e['tipo']))

    dst = os.path.join('demo', 'data', 'race_control_2026.json')
    with open(dst, 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    for gara, g in out.items():
        print(f'{gara:>14}: feed {len(g["feed"]):3} tacche | badge penalita\' tempo: '
              f'{[(p["pilota"], p["secondi"]) for p in g["penalita"]]}')
    print(f'[scritto] {dst}')

if __name__ == '__main__':
    main()
