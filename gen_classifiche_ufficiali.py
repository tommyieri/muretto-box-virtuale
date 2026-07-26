"""gen_classifiche_ufficiali.py — LIVELLO 1 UI (decisione PO): classifica UFFICIALE per
gara -> demo/data/ufficiali_2026.json, per la doppia vista "in pista | ufficiale".

Fonte: FastF1 results = classifica FIA. E' una FONTE di classifica, non una rettifica:
il verdetto RC2 (REPORT_RACE_CONTROL.md) e' STOP sulla ricostruzione automatica da race
control (penalita' post-gara nei documenti FIA, SERVED incompleto, conteggio giri).
L'ufficiale include quindi decisioni che race control non vede: qui si RIPORTA, non si
ricalcola. Cache di progetto: ~/muretto_shared/ff1_cache.

ANCHE LA SPRINT (dal 26/07/2026). Non serve alla doppia vista: serve alla CLASSIFICA
PROVVISORIA (punti_provvisori.py), che estende gli standings f1db con le gare che la
release non copre ancora. Senza la sprint quei punti mancherebbero, e nel 2026 le sprint
sono ai round 2, 4, 5, 9 — un weekend sprint su tre. Sta qui e non in un generatore a
parte perche' la fonte e' la stessa sessione FastF1 dello stesso weekend: cosi' la
classifica provvisoria si calcola OFFLINE, leggendo solo questo file.
"""
import json, os
import fastf1

fastf1.Cache.enable_cache(os.path.expanduser('~/muretto_shared/ff1_cache'))
fastf1.set_log_level('ERROR')

# Lista gare DAL REGISTRO (data/gare_registro.json): una gara nuova pubblicata dalla
# pipeline entra qui da sola. 'ti' = nome evento FastF1 (coincidente per tutte le gare demo).
EVENTI = {nome: v['ti'] for nome, v in
          json.load(open(os.path.join('data', 'gare_registro.json'))).items()}


def classifica(ev, sessione):
    """Classifica FIA di una sessione. None se la sessione non esiste (weekend non-sprint).

    `classificato` viene da ClassifiedPosition, NON da Status. Status e' una descrizione
    ('Retired', 'Lapped') e sul confine della classifica mente in entrambi i sensi: a
    Barcellona LEC/ANT/BEA risultano 'Retired' ma sono classificati 15o/16o/17o (avevano
    coperto il 90% della distanza), mentre ALB risulta 'Lapped' e NON e' classificato.
    Prendendo Status per buono, 7 righe su 220 divergevano da f1db. ClassifiedPosition e'
    la posizione ufficiale come stringa — numerica se classificato, 'R'/'N'/'D'/'W' se no —
    e riproduce f1db esattamente (v. test_classifiche_provvisorie.py).
    """
    try:
        s = fastf1.get_session(2026, ev, sessione)
        s.load(laps=False, telemetry=False, weather=False, messages=False)
    except Exception:
        return None
    cl = [dict(pos=int(r['Position']), pilota=str(r['Abbreviation']), status=str(r['Status']),
               classificato=str(r['ClassifiedPosition']).strip().isdigit())
          for _, r in s.results.iterrows() if r['Position'] == r['Position']]
    return sorted(cl, key=lambda x: x['pos']) or None


def main():
    out = {}
    for gara, ev in EVENTI.items():
        cl = classifica(ev, 'R')
        if not cl:
            # la gara DEVE esserci: se manca e' un guaio, non un weekend senza sprint
            raise SystemExit(f'STOP: nessuna classifica di gara per {gara} ({ev}).')
        voce = dict(fonte='FastF1 results (classifica FIA) — riportata, non ricostruita',
                    classifica=cl)
        sp = classifica(ev, 'S')
        if sp:
            voce['sprint'] = sp
        out[gara] = voce
        print(f'{gara:>14}: {len(cl)} classificati, vince {cl[0]["pilota"]}'
              + (f' | sprint: {len(sp)}, vince {sp[0]["pilota"]}' if sp else ''))
    dst = os.path.join('demo', 'data', 'ufficiali_2026.json')
    with open(dst, 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f'[scritto] {dst}')


if __name__ == '__main__':
    main()
