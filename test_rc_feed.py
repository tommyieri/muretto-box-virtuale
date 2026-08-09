"""test_rc_feed.py — SENTINELLA del feed race control (demo/data/race_control_2026.json).

Nasce da un difetto vero: fino al 08/08/2026 la catena di elif di gen_rc_feed.py non aveva
un ramo per la categoria 'SafetyCar', e 45 messaggi su 45 — tutti con il numero di giro —
cadevano fuori. Il JSON pubblicato aveva 296 voci e ZERO eventi Safety Car: sparivano fra
la sorgente e la pagina gli eventi che decidono le gare. Nessun test se ne accorgeva.

Cosa lo fa fallire (regola 4):

  R1  NESSUN MESSAGGIO DI REGIME SI PERDE. Ogni riga di categoria 'SafetyCar' del CSV deve
      trovarsi rappresentata in un intervallo del feed. FALLISCE se anche uno solo dei
      messaggi non e' coperto.

  R2  GLI INTERVALLI SONO SANI. Inizio <= fine, dentro il numero di giri della gara,
      nessun intervallo aperto. FALLISCE su un intervallo storto o senza fine.

  R3  I PERIODI DISTINTI RESTANO DISTINTI. Due Safety Car che cominciano nello stesso giro
      (Gran Bretagna, giro 51: una rientra alle 15:27:42, un'altra parte alle 15:27:50) non
      devono fondersi in una sola. FALLISCE se il numero di intervalli non corrisponde al
      numero di aperture nel CSV.

  R4  L'ANNUNCIO STA DENTRO IL REGIME MISURATO. Ogni intervallo del feed deve intersecare
      la finestra corrispondente di demo/neutralizzazione.json. Le due fonti rispondono a
      domande diverse (annuncio vs regime per-auto) e l'inizio differisce di 0-5 giri, ma
      se NON si sovrappongono affatto una delle due e' sbagliata. FALLISCE sotto il 90%.

  R5  LA BANDIERA ROSSA C'E' DOVE C'E'. Se neutralizzazione.json dichiara una finestra rf,
      il feed deve avere l'evento 'rossa'; e viceversa. FALLISCE sul disaccordo.

Uso:  python3 test_rc_feed.py
"""
import csv, json, os, sys
from collections import defaultdict

APRE = {'VSC DEPLOYED': 'vsc', 'SAFETY CAR DEPLOYED': 'sc'}
CHIUDE = {'VSC ENDING': 'vsc', 'SAFETY CAR IN THIS LAP': 'sc'}


def main():
    with open(os.path.join('data', 'race_control_2026.csv')) as f:
        righe = list(csv.DictReader(f))
    feed = json.load(open(os.path.join('demo', 'data', 'race_control_2026.json')))
    neu = json.load(open(os.path.join('demo', 'neutralizzazione.json')))
    manifest = {g['gara']: g['n_laps']
                for g in json.load(open(os.path.join('demo', 'data', 'manifest.json')))}

    csv_per_gara = defaultdict(list)
    for r in righe:
        if r['categoria'] == 'SafetyCar' and r['giro']:
            csv_per_gara[r['gara']].append(r)

    esiti = []

    # ── R1 nessun messaggio perso
    persi = []
    for gara, msg in csv_per_gara.items():
        interv = [e for e in feed.get(gara, {}).get('feed', []) if e['tipo'] in ('sc', 'vsc')]
        for r in msg:
            t = r['testo'].strip().upper()
            tipo = APRE.get(t) or CHIUDE.get(t)
            giro = int(r['giro'])
            if tipo is None:
                persi.append(f'{gara} g{giro} "{t}" (testo non riconosciuto)')
                continue
            if not any(e['tipo'] == tipo and e['giro'] <= giro <= e.get('fine', e['giro'])
                       for e in interv):
                persi.append(f'{gara} g{giro} {t}')
    tot_msg = sum(len(v) for v in csv_per_gara.values())
    esiti.append(('R1', not persi,
                  f'{tot_msg - len(persi)}/{tot_msg} messaggi di regime rappresentati'
                  + (f' — persi: {persi[:5]}' if persi else '')))

    # ── R2 intervalli sani
    storti = []
    for gara, v in feed.items():
        n = manifest.get(gara, 10 ** 6)
        for e in v['feed']:
            if e['tipo'] not in ('sc', 'vsc'):
                continue
            fine = e.get('fine')
            if fine is None:
                storti.append(f'{gara} g{e["giro"]} senza fine')
            elif not (1 <= e['giro'] <= fine <= n):
                storti.append(f'{gara} {e["giro"]}-{fine} (gara di {n} giri)')
    esiti.append(('R2', not storti, f'{len(storti)} intervalli storti' + (f': {storti[:4]}' if storti else '')))

    # ── R3 periodi distinti
    male = []
    for gara, msg in csv_per_gara.items():
        att = sum(1 for r in msg if r['testo'].strip().upper() in APRE)
        got = sum(1 for e in feed.get(gara, {}).get('feed', []) if e['tipo'] in ('sc', 'vsc'))
        if att != got:
            male.append(f'{gara}: {att} aperture nel CSV, {got} intervalli nel feed')
    esiti.append(('R3', not male, 'periodi distinti conservati' if not male else '; '.join(male)))

    # ── R4 annuncio dentro il regime misurato
    dentro = fuori = 0
    esempi = []
    for gara, v in feed.items():
        fin = neu.get(gara, {})
        for e in v['feed']:
            if e['tipo'] not in ('sc', 'vsc'):
                continue
            a, b = e['giro'], e.get('fine', e['giro'])
            if any(not (b < x or a > y) for x, y in fin.get(e['tipo'], [])):
                dentro += 1
            else:
                fuori += 1
                esempi.append(f'{gara} {e["tipo"]} {a}-{b} vs {fin.get(e["tipo"])}')
    quota = dentro / max(dentro + fuori, 1)
    esiti.append(('R4', quota >= 0.90,
                  f'{dentro}/{dentro + fuori} annunci dentro il regime misurato ({quota:.0%}, soglia 90%)'
                  + (f' — fuori: {esempi[:3]}' if esempi else '')))

    # ── R5 bandiera rossa
    disaccordi = []
    for gara in manifest:
        ha_neu = bool(neu.get(gara, {}).get('rf'))
        ha_feed = any(e['tipo'] == 'rossa' for e in feed.get(gara, {}).get('feed', []))
        if ha_neu != ha_feed:
            disaccordi.append(f'{gara}: neutralizzazione={ha_neu} feed={ha_feed}')
    esiti.append(('R5', not disaccordi,
                  'rossa d\'accordo fra le due fonti' if not disaccordi else '; '.join(disaccordi)))

    ok = True
    for nome, buono, msg in esiti:
        print(f'   [{"OK  " if buono else "FALLITO"}] {nome}: {msg}')
        ok &= buono
    print('\nESITO:', 'verde' if ok else 'ROSSO')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
