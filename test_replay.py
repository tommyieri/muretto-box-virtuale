"""test_replay.py — SENTINELLA del replay a posizioni vere (demo/data/replay_<gara>.json).

Cosa lo fa fallire (regola 4: un test che stampa FALLITO ed esce 0 e' un ornamento):

  S1  ANCORAGGIO AL TRAGUARDO. Nell'istante in cui un pilota chiude il giro N — cum_time
      preso dai dati gara del sito, non da FastF1 — la posizione ricavata dal GPS deve
      trovarsi sulla linea: frazione ~ 0 (mod 1). E' la prova che la proiezione sul
      nastro e l'orologio sono d'accordo. FALLISCE se lo scarto mediano supera 0,02 giri
      (~140 m a Spa) o se il p95 supera 0,05.

  S2  CONTEGGIO DEI GIRI. Il numero di giri percorsi secondo il GPS (s/10000 finale) deve
      coincidere con i giri ufficiali del pilota. FALLISCE se piu' del 10% dei piloti
      sbaglia di piu' di un giro.

  S3  MONOTONIA. `s` non torna mai indietro: un'auto non percorre il circuito al
      contrario. FALLISCE alla prima inversione.

  S4  L'ASSENZA E' ASSENZA (regola 6). Nessun pilota deve avere posizioni dopo il suo
      ultimo giro completato: il ritirato sparisce, non resta congelato in pista.
      FALLISCE se un ritirato ha posizioni oltre 60 s dal suo ultimo giro.

  S5  PIT LANE MISURATA. Le frazioni di ingresso/uscita devono essere MISURATE e diverse
      dalle costanti 0,95/0,05 del generatore stilizzato — se coincidono esattamente su
      ogni pista, qualcuno ha ricablato una costante. FALLISCE anche se i tratti `pit`
      dichiarati non cadono nei giri di sosta veri.

Uso:  python3 test_replay.py            # tutte le gare con un replay_*.json
      python3 test_replay.py --gara Belgio
"""
import argparse, glob, json, os, sys

import numpy as np

SCALA = 10000
ASSENTE = -1


def decodifica(p, n):
    """delta -> assoluto; ritorna array float con np.nan dove il pilota e' assente."""
    out = np.full(n, np.nan)
    prec = 0
    for k, dv in enumerate(p['s']):
        i = p['da'] + k
        if dv == ASSENTE:
            continue
        prec += dv
        out[i] = prec / SCALA
    return out


def carica(gara):
    R = json.load(open(os.path.join('demo', 'data', f'replay_{gara}.json')))
    G = json.load(open(os.path.join('demo', 'data', f'{gara}.json')))
    return R, G


def prova(gara):
    R, G = carica(gara)
    n, t0, hz = R['n'], R['t0'], R['hz']
    esiti = []

    S = {sig: decodifica(p, n) for sig, p in R['piloti'].items()}

    # ── S1 ancoraggio al traguardo
    # Si misura sui giri di CORSA. Un'auto in in-lap o out-lap sta percorrendo la corsia
    # box, che non e' il nastro: proiettarla sul nastro e poi pretendere che sia sulla
    # linea misurerebbe una cosa che non esiste. I giri di sosta si contano a parte e si
    # stampano, cosi' restano visibili invece di sparire dentro una soglia.
    scarti, scarti_box = [], []
    for L in G['laps']:
        for sig, c in L['cars'].items():
            if sig not in S or c.get('cum_time') is None:
                continue
            i = int(round((c['cum_time'] - t0) * hz))
            if not (0 <= i < n) or not np.isfinite(S[sig][i]):
                continue
            f = S[sig][i] % 1.0
            d = min(f, 1.0 - f)                     # distanza dalla linea, in giri
            (scarti_box if (c.get('in_lap') or c.get('out_lap')) else scarti).append(d)
    scarti = np.array(scarti)
    nbox = len(scarti_box)
    if len(scarti) < 50:
        esiti.append(('S1', False, f'troppo poche coppie da verificare ({len(scarti)})'))
    else:
        med, p95 = float(np.median(scarti)), float(np.percentile(scarti, 95))
        ok = med <= 0.02 and p95 <= 0.05
        esiti.append(('S1', ok, f'{len(scarti)} fine-giro di corsa: scarto dalla linea mediano '
                                f'{med:.4f} giri, p95 {p95:.4f} (soglie 0,02 / 0,05) '
                                f'· {nbox} fine-giro in corsia esclusi'))

    # ── S2 conteggio giri
    uff = {}
    for L in G['laps']:
        for sig, c in L['cars'].items():
            if c.get('cum_time') is not None:
                uff[sig] = max(uff.get(sig, 0), L['lap'])
    sbagliati = []
    for sig, s in S.items():
        v = s[np.isfinite(s)]
        if not len(v) or sig not in uff:
            continue
        giri_gps = int(np.floor(v[-1])) + 1
        if abs(giri_gps - uff[sig]) > 1:
            sbagliati.append(f'{sig} gps={giri_gps} uff={uff[sig]}')
    quota = len(sbagliati) / max(len(S), 1)
    esiti.append(('S2', quota <= 0.10,
                  f'{len(sbagliati)}/{len(S)} piloti fuori di piu\' di un giro'
                  + (f' ({", ".join(sbagliati[:5])})' if sbagliati else '')))

    # ── S3 monotonia
    rotture = []
    for sig, s in S.items():
        v = s[np.isfinite(s)]
        if len(v) > 1 and np.any(np.diff(v) < -1e-9):
            rotture.append(sig)
    esiti.append(('S3', not rotture, f'inversioni in {rotture[:5]}' if rotture else 'nessuna inversione'))

    # ── S4 l'assenza e' assenza
    tardivi = []
    for sig, s in S.items():
        if sig not in uff:
            continue
        ultimo_cum = None
        for L in G['laps']:
            c = L['cars'].get(sig)
            if c and c.get('cum_time') is not None:
                ultimo_cum = c['cum_time']
        if ultimo_cum is None:
            continue
        i_max = int(round((ultimo_cum + 60 - t0) * hz))
        oltre = np.flatnonzero(np.isfinite(s))
        if len(oltre) and oltre[-1] > i_max:
            tardivi.append(f'{sig} (+{(oltre[-1] - i_max) / hz:.0f}s)')
    esiti.append(('S4', not tardivi,
                  f'posizioni oltre l\'ultimo giro: {tardivi[:5]}' if tardivi
                  else 'nessun ritirato congelato in pista'))

    # ── S6 FLUIDITA': il pallino non deve stare fermo mentre l'auto corre
    # Nessuna sentinella misurava il MOVIMENTO, e per questo lo scatto e' arrivato fino
    # all'utente: i cinque cancelli guardavano dove sta il pallino, non se ci arriva
    # scorrendo. All'Ungheria il 68,8% dei campioni consecutivi era identico al precedente
    # — il feed ripete le coordinate (76,9% dei campioni grezzi) e la pipeline lo
    # riproduceva fedelmente, cioe' pubblicava come «ferma» un'auto che stava correndo.
    # Un pianoro lungo e' legittimo solo se l'auto e' davvero ferma (box, rossa, ritiro).
    fermi = mossi = 0
    pianori_lunghi = []
    for sig, s_arr in S.items():
        v = s_arr[np.isfinite(s_arr)]
        if len(v) < 2:
            continue
        d = np.diff(v)
        fermi += int((d == 0).sum())
        mossi += len(d)
        run = 1
        for k in range(1, len(v)):
            if v[k] == v[k - 1]:
                run += 1
            else:
                if run >= 12:            # 6 s fermi: o e' ai box, o e' un artefatto
                    pianori_lunghi.append((sig, run))
                run = 1
    quota = fermi / max(mossi, 1)
    esiti.append(('S6', quota <= 0.10,
                  f'campioni consecutivi identici {quota:.1%} (soglia 10%) · '
                  f'{len(pianori_lunghi)} pianori oltre 6 s'))

    # ── S5 pit lane misurata
    pl = R.get('pitlane')
    if not pl:
        esiti.append(('S5', True, 'pit lane non misurabile su questa gara (dichiarato)'))
    else:
        fe, fx = pl['frazione_ingresso'], pl['frazione_uscita']
        misurata = not (abs(fe - 0.95) < 1e-9 and abs(fx - 0.05) < 1e-9)
        # i tratti pit devono cadere in giri con in_lap/out_lap veri
        veri, dichiarati, dentro = set(), 0, 0
        for L in G['laps']:
            for sig, c in L['cars'].items():
                if c.get('in_lap') or c.get('out_lap'):
                    veri.add((sig, L['lap']))
        for sig, p in R['piloti'].items():
            for a, b in p.get('pit', []):
                fetta = S[sig][a:b + 1]
                if not np.any(np.isfinite(fetta)):
                    continue          # tratto senza posizioni valide: non e' giudicabile
                dichiarati += 1
                giro = int(np.floor(np.nanmedian(fetta))) + 1
                if any((sig, giro + d) in veri for d in (-1, 0, 1)):
                    dentro += 1
        quota = dentro / max(dichiarati, 1)
        ok = misurata and quota >= 0.80
        esiti.append(('S5', ok, f'ingresso {fe} uscita {fx} (stilizzata 0,95/0,05) · '
                                f'{dentro}/{dichiarati} tratti pit dentro un giro di sosta vero '
                                f'({quota:.0%}, soglia 80%)'))

    return esiti


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--gara')
    a = ap.parse_args()
    gare = [a.gara] if a.gara else sorted(
        os.path.basename(p)[7:-5] for p in glob.glob('demo/data/replay_*.json'))
    if not gare:
        sys.exit('nessun replay_*.json da provare')
    tutto_ok = True
    for g in gare:
        print(f'== {g} ==')
        for nome, ok, msg in prova(g):
            print(f'   [{"OK  " if ok else "FALLITO"}] {nome}: {msg}')
            tutto_ok &= ok
    print('\nESITO:', 'verde' if tutto_ok else 'ROSSO')
    sys.exit(0 if tutto_ok else 1)


if __name__ == '__main__':
    main()
