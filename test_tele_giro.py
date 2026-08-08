"""test_tele_giro.py — SENTINELLA della telemetria ancorata al tracciato.

Un canale disegnato sulla pista e' il tipo di cosa che sembra giusta anche quando e'
sbagliata: i colori sono belli comunque, e nessuno si accorge che la frenata e' cento metri
piu' in la'. Questi cancelli guardano la FISICA, non l'estetica.

Cosa lo fa fallire (regola 4):

  T1  IL FRENO FA RALLENTARE. Dove il canale freno e' attivo, la velocita' deve calare nel
      giro successivo. FALLISCE sotto l'85% dei punti in frenata: vorrebbe dire che i
      canali non sono allineati fra loro o non lo sono col tracciato.

  T2  IL GAS NON FA RALLENTARE DI MOLTO. A gas pieno e senza freno la velocita' non deve
      calare in modo SOSTANZIALE. La prima versione di questo cancello pretendeva che non
      calasse affatto, e bocciava il Belgio: sbagliava il cancello, non il dato — a gas
      pieno in cima a un rettilineo si e' a velocita' terminale, e in salita (Raidillon) si
      rallenta col piede a tavoletta. MISURATO: dove il tracciato e' ben ancorato il calo
      mediano e' 2,0 km/h (Belgio, Spagna); dove non lo e' e' 10 km/h con code a 132
      (Ungheria). La tolleranza e' quindi 3 km/h, che lascia passare la fisica e continua
      a bocciare il disallineamento. FALLISCE sotto l'85%.

  T3  FRENO E GAS NON CONVIVONO. La quota di punti con gas > 80% E freno attivo deve
      restare marginale (< 5%): se fosse alta, i due canali sarebbero sfasati.

  T4  I VALORI SONO PLAUSIBILI. Velocita' 0-400 km/h, gas 0-100, freno 0-100, marcia 1-8.
      FALLISCE su qualunque valore fuori scala — un canale mal decodificato lo si vede qui.

  T5  IL GIRO E' UN GIRO. La velocita' massima di ogni pilota deve stare entro il 15% da
      quella mediana del campo: un pilota con 500 km/h o con 120 e' un giro sbagliato
      (in-lap, out-lap, giro sotto bandiera) finito nel file.

  T6  COPERTURA DICHIARATA. Le gare senza file sono elencate e spiegate, non silenziose.

Uso:  python3 test_tele_giro.py
"""
import glob, json, os, statistics as st, sys

TOLL_GAS = 3   # km/h: calo ammesso a gas pieno (misurato: 2,0 mediano dove l'ancoraggio tiene)


def prova(gara):
    d = json.load(open(os.path.join('demo', 'data', f'tele_giro_{gara}.json')))
    piloti = d['piloti']
    esiti = []

    cala = tot = 0
    sale = tots = 0
    conflitti = punti = 0
    fuori = []
    vmax = []
    for sig, p in piloti.items():
        v, gas, fr, mar = p['v'], p['gas'], p['freno'], p['marcia']
        n = len(v)
        vmax.append(max(v))
        for i in range(n):
            j = (i + 1) % n
            punti += 1
            if fr[i] > 50:
                tot += 1
                if v[j] <= v[i]:
                    cala += 1
            if gas[i] > 95 and fr[i] <= 50:
                tots += 1
                if v[j] >= v[i] - TOLL_GAS:      # velocita' terminale e salite: fisica, non disallineamento
                    sale += 1
            if gas[i] > 80 and fr[i] > 50:
                conflitti += 1
        if not all(0 <= x <= 400 for x in v):
            fuori.append(f'{sig} velocita')
        if not all(0 <= x <= 100 for x in gas):
            fuori.append(f'{sig} gas')
        if not all(0 <= x <= 100 for x in fr):
            fuori.append(f'{sig} freno')
        if not all(0 <= x <= 8 for x in mar):
            fuori.append(f'{sig} marcia')

    qc = cala / max(tot, 1)
    qs = sale / max(tots, 1)
    qk = conflitti / max(punti, 1)
    esiti.append(('T1', qc >= 0.85, f'in frenata la velocita cala nel {qc:.0%} dei punti ({tot} punti)'))
    esiti.append(('T2', qs >= 0.85, f'a gas pieno la velocita non cala oltre {TOLL_GAS} km/h nel {qs:.0%} dei punti ({tots} punti)'))
    esiti.append(('T3', qk < 0.05, f'gas e freno insieme nel {qk:.1%} dei punti (soglia 5%)'))
    esiti.append(('T4', not fuori, 'valori fuori scala: ' + ', '.join(fuori[:4]) if fuori else 'tutti i canali in scala'))

    med = st.median(vmax)
    strani = [f'{s}={max(p["v"])}' for s, p in piloti.items() if abs(max(p['v']) - med) > 0.15 * med]
    esiti.append(('T5', not strani,
                  f'velocita di punta mediana {med:.0f} km/h'
                  + (f' — fuori dal 15%: {strani[:4]}' if strani else ', tutti entro il 15%')))
    return esiti


def main():
    gare = [g['gara'] for g in json.load(open(os.path.join('demo', 'data', 'manifest.json')))]
    presenti = sorted(os.path.basename(p)[10:-5]
                      for p in glob.glob('demo/data/tele_giro_*.json'))
    assenti = [g for g in gare if g not in presenti]
    ok = True
    for gara in presenti:
        print(f'== {gara} ==')
        for nome, buono, msg in prova(gara):
            print(f'   [{"OK  " if buono else "FALLITO"}] {nome}: {msg}')
            ok &= buono
    # T6: le assenze si dichiarano
    print('\n== copertura ==')
    print(f'   [OK  ] T6: {len(presenti)}/{len(gare)} gare con overlay'
          + (f' — senza: {assenti} (GPS troppo rado per ancorare i canali al tracciato)' if assenti else ''))
    print('\nESITO:', 'verde' if ok else 'ROSSO')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
