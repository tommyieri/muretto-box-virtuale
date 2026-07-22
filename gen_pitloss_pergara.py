#!/usr/bin/env python3
"""
gen_pitloss_pergara.py — Sessione FF5 (pre-registrata in PREREG_SESSIONE_FF5.md).

Pit-loss REALIZZATO per-gara delle gare demo 2026: la grandezza che serve alla demo,
che rigioca gare specifiche ("se pitti al giro X, dove rientri IN QUELLA GARA").
Metodo FF4 invariato e IMPORTATO (giro intero, warm-in incluso; filtri FF2/FF3).

PERIMETRO DERIVATO (22/07/2026, non piu' la lista DEMO cablata a 9 gare).
  Perche': la lista `DEMO` era congelata sulle 9 gare del 14/07 e non si estendeva. Il
  Belgio, pubblicato il 19/07, e' rimasto FUORI dal CSV — assenza silenziosa, non
  verdetto (l'anomalia era gia' segnalata in REPORT_SPA_DOMENICA.md punto 2, e
  SPA_DOMENICA.md punto 2 si aspettava proprio righe `spa-francorchamps,2026` qui).
  Ora il perimetro si legge da `data/gare_registro.json` (stesso schema di
  gen_degrado_gamma.perimetro() e gen_neutralizzazione_v2._inventari()): quando arriva
  l'11a gara, il CSV ha 11 righe senza intervento umano.
  Il cid -> chiavi-di-localita' NON e' riscritto qui: si legge dalle liste CIRCUITS gia'
  committate in FF3 e FF4. Un cid nuovo senza chiavi ferma il generatore (va dichiarato
  la' dove il metodo lo dichiara, non qui).

FRONTIERA TEMPORALE. `events_for` (FF3) scarta le gare con data >= `TODAY`, e in FF3
  TODAY e' INCISO al 14/07/2026 (data di quella sessione): con quel valore Spa 2026
  (19/07) resta invisibile per sempre. Qui la frontiera e' la data ODIERNA REALE
  (semantica originale: "le gare future non esistono ancora"), impostata sul modulo FF3
  a runtime e STAMPATA a ogni esecuzione. Il file FF3 non e' toccato. Questa non e' una
  soglia allentata: e' l'orologio rimesso all'ora giusta, e la GUARDIA sotto verifica
  che non sposti nessuna delle righe gia' committate.

DUE GUARDIE (nessuna delle due si allenta per far passare un risultato):
  1. riproducibilita' pre-registrata (F5.1): le stime di scoping del 14/07 sono incise
     in STIME; se un valore ufficiale ne differisce di piu' di 0,2 s il generatore ESCE
     CON ERRORE. Una gara NUOVA non ha stima di scoping: il controllo non le si applica
     e questo viene DICHIARATO a video (non e' un controllo passato, e' un controllo
     che non esiste per quella gara).
  2. non-deriva del perimetro: le righe gia' committate (RIGHE_CONGELATE) devono essere
     tutte ritrovate, sullo stesso circuito, con lo stesso n stop, lo stesso realizzato
     entro 0,2 s e la stessa classe. Se una sparisce o cambia, STOP: il CSV non viene
     riscritto su un perimetro diverso in silenzio.

NON tocca alcun file di produzione. L'attivazione (F5.5) e' un'altra fase, dopo il
checkpoint PO. Scrive:
  - data/pitloss_realizzato_2026.csv  (una gara demo per riga)
  - data/pergara_stops.csv            (uno stop per riga, tutti i circuiti del registro,
                                       tutte le stagioni: la fonte per la tipicita' di
                                       demo/att6.mjs)

Uso:  python3 gen_pitloss_pergara.py
"""

import datetime
import json
import sys
import numpy as np
import pandas as pd
import fastf1  # cache abilitata dagli import sotto

import gen_censimento_pitloss as _ff3
from gen_censimento_pitloss import events_for, classify, log, SEASONS
from gen_pitloss_engine_ready import collect_whole_lap
from gen_pitloss_engine_ready import CIRCUITS as _CIRCUITS_FF4

# --- soglie pre-registrate (PREREG_SESSIONE_FF5.md) ---------------------------
MIN_STOP = 5            # F5.2: sotto 5 stop validi -> NON MISURABILE (non si abbassa)
SOGLIA_CALIBRATA = 1.0  # F5.2: |prod - realizzato| <= 1,0 -> GIA' CALIBRATA
TOL_RIPRODUCIBILITA = 0.2

# stime di scoping dichiarate nel prereg (quadro del 14/07, scratchpad).
# Riguardano SOLO le 9 gare di allora: una gara successiva non ha stima e lo si dichiara.
STIME = {'Australia': 24.10, 'Cina': 34.51, 'Giappone': 22.79, 'Miami': 20.11,
         'Canada': 24.24, 'Monaco': 22.61, 'Spagna': 24.59, 'Austria': 21.98,
         'Gran Bretagna': 20.43}

# Le righe gia' committate al checkpoint FF5 del 14/07: la guardia contro la deriva.
# gara -> (cid, realizzato, n_stop_2026, produzione_allora, classe_allora).
#
# DUE NATURE IN UNA RIGA, e la guardia le tratta diversamente (senza allentare nulla):
#  - la MISURA (circuito, realizzato, n stop) e' la scienza: NON si muove. Se si muove,
#    STOP, e la tolleranza applicata e' quella pre-registrata di F5.1 (0,2 s).
#  - `produzione` (e quindi delta e classe) e' una FOTOGRAFIA di demo/data/pitloss.json,
#    che per costruzione cambia a ogni attivazione: al checkpoint FF5 Miami e' passata da
#    22,63 a 20,11 e la sua classe da DA ATTIVARE a GIA CALIBRATA. Quel movimento non e'
#    deriva, e' il CSV che dice la verita' nuova. La guardia lo LASCIA PASSARE solo se il
#    valore di produzione e' davvero cambiato, lo STAMPA come PRIMA -> ADESSO, e STOP se
#    la classe cambia mentre la produzione e' ferma (li' sarebbe deriva vera).
RIGHE_CONGELATE = {
    'Australia':     ('melbourne',   24.10,  7, 18.15, 'DA ATTIVARE'),
    'Cina':          ('shanghai',    34.51,  4, 22.97, 'NON MISURABILE'),
    'Giappone':      ('suzuka',      22.79,  4, 23.72, 'NON MISURABILE'),
    'Miami':         ('miami',       20.11, 18, 22.63, 'DA ATTIVARE'),
    'Canada':        ('montreal',    24.24,  5, 24.37, 'GIA CALIBRATA'),
    'Monaco':        ('monaco',      22.61, 14, 24.80, 'DA ATTIVARE'),
    'Spagna':        ('catalunya',   24.59, 35, 22.38, 'DA ATTIVARE'),
    'Austria':       ('spielberg',   21.98, 30, 21.63, 'GIA CALIBRATA'),
    'Gran Bretagna': ('silverstone', 20.43, 17, 20.80, 'GIA CALIBRATA'),
}

REGISTRO = 'data/gare_registro.json'

# cid -> chiavi di localita', dalle liste CIRCUITS gia' committate (FF3 + FF4, in
# quest'ordine: FF4 contiene silverstone che FF3 escludeva). Nessuna chiave scritta qui.
KEYS_PER_CID = {c['cid']: list(c['keys']) for c in _ff3.CIRCUITS}
KEYS_PER_CID.update({c['cid']: list(c['keys']) for c in _CIRCUITS_FF4})

# Frontiera temporale: la data odierna reale (vedi docstring). Il file FF3 non si tocca.
FRONTIERA = datetime.date.today()
_TODAY_FF3 = _ff3.TODAY
_ff3.TODAY = FRONTIERA

PROD = json.load(open('demo/data/pitloss.json'))


def med(v):
    v = [x for x in v if x is not None and not np.isnan(x)]
    return float(np.median(v)) if v else np.nan


def perimetro():
    """Le gare su cui il realizzato si misura, DERIVATE dal registro invece che a mano.

    Ritorna [(cid, keys, nome_gara), ...] nell'ordine del registro (ordine di calendario).
    Si ferma, invece di indovinare, se:
      - un cid del registro non ha chiavi di localita' nelle liste committate FF3/FF4;
      - una gara del registro non ha una voce in demo/data/pitloss.json (senza produzione
        il delta e la classe non sono definiti);
      - una gara gia' committata sparisce dal registro o cambia circuito (deriva).
    """
    reg = json.load(open(REGISTRO))
    out = []
    for nome, v in reg.items():
        cid = v['cid']
        if cid not in KEYS_PER_CID:
            raise RuntimeError(
                f"perimetro: '{nome}' -> cid '{cid}' non ha chiavi di localita' nelle liste "
                f"committate (gen_censimento_pitloss.CIRCUITS / gen_pitloss_engine_ready."
                f"CIRCUITS). Il circuito va dichiarato la', non qui.")
        if nome not in PROD:
            raise RuntimeError(
                f"perimetro: '{nome}' e' nel registro ma non in demo/data/pitloss.json: "
                f"senza il valore di produzione delta e classe non sono definiti.")
        out.append((cid, KEYS_PER_CID[cid], nome))

    visti = {nome: cid for cid, _, nome in out}
    for nome, (cid_atteso, *_) in RIGHE_CONGELATE.items():
        if nome not in visti:
            raise RuntimeError(f"deriva del perimetro: '{nome}' e' gia' nel CSV committato "
                               f"ma non nel registro -> il CSV cambierebbe base")
        if visti[nome] != cid_atteso:
            raise RuntimeError(f"deriva del perimetro: '{nome}' cambia circuito "
                               f"({cid_atteso} -> {visti[nome]})")
    return out


def guardia_righe_esistenti(tabella):
    """Le righe gia' committate devono uscire identiche, o il generatore si ferma.

    MISURA (circuito, n stop, realizzato entro la tolleranza pre-registrata di 0,2 s):
      qualunque scostamento e' un FALLIMENTO -> STOP, il CSV non viene scritto.
    FOTOGRAFIA DELLA PRODUZIONE (produzione, delta, classe):
      cambia solo se demo/data/pitloss.json e' cambiato (attivazione). In quel caso si
      stampa PRIMA -> ADESSO con la causa. Se la classe si muove a produzione FERMA,
      e' deriva -> STOP.
    """
    per_gara = {r['gara']: r for r in tabella}
    problemi, movimenti = [], []
    for nome, (cid, realizzato, n_stop, prod_allora, classe_allora) in RIGHE_CONGELATE.items():
        r = per_gara.get(nome)
        if r is None:
            problemi.append(f'{nome}: riga sparita dal perimetro derivato')
            continue
        if r['circuito'] != cid:
            problemi.append(f'{nome}: circuito {cid} -> {r["circuito"]}')
        if r['n_stop_2026'] != n_stop:
            problemi.append(f'{nome}: n stop 2026 {n_stop} -> {r["n_stop_2026"]}')
        got = r['realizzato']
        if got is None or abs(got - realizzato) > TOL_RIPRODUCIBILITA:
            problemi.append(f'{nome}: realizzato {realizzato} -> {got} '
                            f'(oltre la tolleranza pre-registrata {TOL_RIPRODUCIBILITA} s)')
        prod_ora = r['produzione']
        prod_mossa = abs(prod_ora - prod_allora) > 1e-9
        if r['classe'] != classe_allora or prod_mossa:
            if not prod_mossa:
                problemi.append(f'{nome}: classe {classe_allora} -> {r["classe"]} a '
                                f'produzione FERMA ({prod_allora}): deriva, non attivazione')
            else:
                movimenti.append(f'{nome}: produzione {prod_allora} -> {prod_ora} '
                                 f'(demo/data/pitloss.json, attivazione), classe '
                                 f'{classe_allora} -> {r["classe"]}; misura ferma a {got}')
    if problemi:
        sys.exit('GUARDIA RIGHE ESISTENTI VIOLATA (il CSV NON e stato riscritto):\n  - '
                 + '\n  - '.join(problemi))
    print(f'Guardia: le {len(RIGHE_CONGELATE)} righe gia committate sono riprodotte nella '
          f'MISURA (circuito, n stop, realizzato entro {TOL_RIPRODUCIBILITA} s).')
    if movimenti:
        print('Guardia: la fotografia della produzione si e mossa dove la produzione si e '
              'mossa (atteso, non deriva):\n  - ' + '\n  - '.join(movimenti))
    else:
        print('Guardia: anche produzione, delta e classe sono identici.')


def main():
    gare = perimetro()
    print(f'Perimetro DERIVATO da {REGISTRO}: {len(gare)} gare '
          f'({", ".join(n for _, _, n in gare)}).')
    print(f'Frontiera temporale: gare con data >= {FRONTIERA} escluse '
          f'(FF3 aveva inciso {_TODAY_FF3}; il file FF3 non e stato toccato).')
    senza_stima = [n for _, _, n in gare if n not in STIME]
    if senza_stima:
        print(f'DICHIARATO: {", ".join(senza_stima)} NON ha stima di scoping pre-registrata '
              f'(gara successiva al 14/07): il controllo F5.1 non le si applica. '
              f'Nessuna tolleranza e stata allargata.')

    tabella, per_stop = [], []
    for cid, keys, nome in gare:
        circ = dict(cid=cid, keys=keys)
        rows_all = []
        for y in SEASONS:
            for rnd, name, date in events_for(circ, y):
                label = f'{y}-r{rnd}'
                try:
                    s = fastf1.get_session(y, rnd, 'R')
                    s.load(laps=True, telemetry=False, weather=True, messages=False)
                    cond, fw, fr, _ = classify(s)
                    rows, dg = collect_whole_lap(s, cid, y, label)
                    # riconciliazione esatta (regola di sempre)
                    n_valid = sum(1 for r in rows if r.get('escluso') == '')
                    scarti = sum(v for k, v in dg.items() if k != 'stop_grezzi')
                    if n_valid + scarti != dg['stop_grezzi']:
                        sys.exit(f'RICONCILIAZIONE FALLITA {cid} {label}: '
                                 f'{dg["stop_grezzi"]} != {n_valid}+{scarti}. STOP.')
                    for r in rows:
                        r['condizione'] = cond
                    rows_all += rows
                except Exception as e:
                    log(f'  [{cid}] {label} skip: {type(e).__name__}: {e}')
        valid = [r for r in rows_all if r.get('escluso') == '']
        per_stop += valid
        df = pd.DataFrame(valid)

        g26 = df[df['stagione'] == 2026] if len(df) else df
        realized = med(list(g26['pit_loss'])) if len(g26) else np.nan
        iqr = (float(np.percentile(g26['pit_loss'], 75) - np.percentile(g26['pit_loss'], 25))
               if len(g26) >= 2 else np.nan)
        cond26 = g26['condizione'].iloc[0] if len(g26) else '-'
        storico = df[(df['stagione'] <= 2025) & (df['condizione'] == 'DRY')] if len(df) else df
        blocchi = [med(list(v['pit_loss'])) for _, v in storico.groupby('gara')] if len(storico) else []
        tipico = float(np.median(blocchi)) if blocchi else np.nan
        prod = PROD[nome]
        delta = prod - realized if not np.isnan(realized) else np.nan

        # F5.1: controllo di riproducibilita' (pre-registrato, esce con errore).
        # Si applica SOLO alle gare che hanno una stima di scoping: una gara nuova non ne
        # ha, e fingere che il controllo l'abbia superata sarebbe una bugia.
        if nome in STIME:
            stima = STIME[nome]
            if np.isnan(realized) or abs(realized - stima) > TOL_RIPRODUCIBILITA:
                got = 'NaN' if np.isnan(realized) else f'{realized:.2f}'
                sys.exit(f'RIPRODUCIBILITA VIOLATA su {nome}: ufficiale '
                         f'{got} vs stima {stima:.2f} (tol {TOL_RIPRODUCIBILITA}). STOP.')

        # F5.2: classificazione (precedenza pre-registrata)
        if len(g26) < MIN_STOP:
            classe = 'NON MISURABILE'
        elif abs(delta) <= SOGLIA_CALIBRATA:
            classe = 'GIA CALIBRATA'
        else:
            classe = 'DA ATTIVARE'

        tabella.append(dict(gara=nome, circuito=cid, condizione_2026=cond26,
                            n_stop_2026=len(g26),
                            realizzato=round(realized, 2) if not np.isnan(realized) else None,
                            iqr_2026=round(iqr, 2) if not np.isnan(iqr) else None,
                            tipico_2018_2025=round(tipico, 2) if not np.isnan(tipico) else None,
                            n_blocchi_storico=len(blocchi), produzione=prod,
                            delta_prod_realizzato=round(delta, 2) if not np.isnan(delta) else None,
                            classe=classe))
        log(f'[{cid}] {nome}: realizzato '
            f'{"n/d" if np.isnan(realized) else f"{realized:.2f}"} (n={len(g26)}) -> {classe}')

    guardia_righe_esistenti(tabella)   # prima di scrivere: se non torna, non si scrive
    tdf = pd.DataFrame(tabella)
    tdf.to_csv('data/pitloss_realizzato_2026.csv', index=False)
    scols = ['circuito', 'stagione', 'gara', 'condizione', 'pilota', 'giro',
             'pit_lane_time', 'delta_inlap', 'delta_outlap', 'pit_loss']
    pd.DataFrame(per_stop).reindex(columns=scols).to_csv(
        'data/pergara_stops.csv', index=False, float_format='%.4f')

    print('\n' + tdf.to_string(index=False))
    print('\nclassi:', tdf['classe'].value_counts().to_dict())
    print('[scritto] data/pitloss_realizzato_2026.csv + data/pergara_stops.csv '
          f'({len(per_stop)} stop)')
    con_stima = [n for _, _, n in gare if n in STIME]
    print(f'Riproducibilita: le {len(con_stima)} gare con stima pre-registrata sono entro '
          f'{TOL_RIPRODUCIBILITA} s (altrimenti sarei uscito con errore).')
    if senza_stima:
        print(f'Senza stima pre-registrata (controllo F5.1 NON applicabile): '
              f'{", ".join(senza_stima)}.')


if __name__ == '__main__':
    main()
