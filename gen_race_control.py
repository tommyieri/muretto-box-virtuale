"""gen_race_control.py — RC1: ingestione messaggi race control (FastF1) per le 9 gare
demo 2026 -> data/race_control_2026.csv. LIVELLO 1: i messaggi si MOSTRANO, non entrano
nella simulazione. Nessun file di demo/data/ (consumata dal motore/demo) viene toccato.

Fonte: FastF1 race_control_messages (scelta e motivata in PREREG_SESSIONE_RC.md, RC0;
OpenF1 = conferma). Cache di progetto: ~/muretto_shared/ff1_cache.

Schema CSV (una riga per messaggio):
  gara, giro, timestamp, categoria, pilota, bandiera, testo, penalita_secondi
- pilota: sigla estratta da "CAR <num> (<SIGLA>)" nel testo, vuoto se assente;
- penalita_secondi: valorizzato SOLO dove il testo matcha la regex pre-registrata delle
  penalita' di TEMPO (sia annuncio sia "PENALTY SERVED": l'accoppiamento annuncio/servita
  e' compito di verifica_rc2.py, regole in PREREG);
- messaggi con "PENALTY" non parsabili come penalita' di tempo (griglia, drive-through,
  deleted lap...) restano nel CSV con penalita_secondi vuoto e sono conteggiati a video.
"""
import os, re, csv
import fastf1

fastf1.Cache.enable_cache(os.path.expanduser('~/muretto_shared/ff1_cache'))
fastf1.set_log_level('ERROR')

GARE = [('Australia', 'Australian Grand Prix'), ('Cina', 'Chinese Grand Prix'),
        ('Giappone', 'Japanese Grand Prix'), ('Miami', 'Miami Grand Prix'),
        ('Canada', 'Canadian Grand Prix'), ('Monaco', 'Monaco Grand Prix'),
        ('Spagna', 'Barcelona Grand Prix'), ('Austria', 'Austrian Grand Prix'),
        ('Gran Bretagna', 'British Grand Prix'), ('Belgio', 'Belgian Grand Prix')]

PEN_RE = re.compile(r'(\d+)\s*SECOND(?:S)?\s*TIME\s*PENALTY.*?CAR\s*(\d+)\s*\((\w+)\)', re.I)
CAR_RE = re.compile(r'CAR\s*\d+\s*\((\w+)\)', re.I)

def main():
    righe, riass = [], []
    for nome, ev in GARE:
        s = fastf1.get_session(2026, ev, 'R')
        s.load(laps=False, telemetry=False, weather=False, messages=True)
        m = s.race_control_messages
        cats, pen_annunci, pen_servite, non_pars = {}, 0, 0, []
        for _, r in m.iterrows():
            testo = str(r['Message'])
            pm = PEN_RE.search(testo)
            cm = CAR_RE.search(testo)
            cat = str(r['Category'])
            cats[cat] = cats.get(cat, 0) + 1
            if pm:
                if testo.upper().startswith('FIA STEWARDS: PENALTY SERVED'): pen_servite += 1
                else: pen_annunci += 1
            elif 'PENALTY' in testo.upper():
                non_pars.append(testo)
            giro = r.get('Lap')
            righe.append(dict(
                gara=nome,
                giro=int(giro) if giro == giro and giro is not None else '',
                timestamp=str(r['Time']),
                categoria=cat,
                pilota=cm.group(1).upper() if cm else '',
                bandiera=str(r['Flag']) if r.get('Flag') == r.get('Flag') and r.get('Flag') is not None else '',
                testo=testo,
                penalita_secondi=int(pm.group(1)) if pm else ''))
        riass.append((nome, len(m), cats, pen_annunci, pen_servite, non_pars))

    os.makedirs('data', exist_ok=True)
    out = os.path.join('data', 'race_control_2026.csv')
    with open(out, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['gara', 'giro', 'timestamp', 'categoria',
                                          'pilota', 'bandiera', 'testo', 'penalita_secondi'])
        w.writeheader()
        w.writerows(righe)

    print(f'[scritto] {out} ({len(righe)} messaggi)\n')
    print(f'{"gara":>14} {"msg":>4} {"pen.annunci":>11} {"pen.servite":>11} {"non pars.":>9}  categorie')
    tot_np = 0
    for nome, n, cats, pa, ps, np_ in riass:
        tot_np += len(np_)
        print(f'{nome:>14} {n:>4} {pa:>11} {ps:>11} {len(np_):>9}  {cats}')
    print(f'\nmessaggi con "PENALTY" non parsabili come penalita\' di tempo: {tot_np}')
    for nome, *_ , np_ in riass:
        for t in np_[:2]:
            print(f'  es. [{nome}] {t}')

if __name__ == '__main__':
    main()
