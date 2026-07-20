"""gen_classifiche_ufficiali.py — LIVELLO 1 UI (decisione PO): classifica UFFICIALE per
gara -> demo/data/ufficiali_2026.json, per la doppia vista "in pista | ufficiale".

Fonte: FastF1 results = classifica FIA. E' una FONTE di classifica, non una rettifica:
il verdetto RC2 (REPORT_RACE_CONTROL.md) e' STOP sulla ricostruzione automatica da race
control (penalita' post-gara nei documenti FIA, SERVED incompleto, conteggio giri).
L'ufficiale include quindi decisioni che race control non vede: qui si RIPORTA, non si
ricalcola. Cache di progetto: ~/muretto_shared/ff1_cache.
"""
import json, os
import fastf1

fastf1.Cache.enable_cache(os.path.expanduser('~/muretto_shared/ff1_cache'))
fastf1.set_log_level('ERROR')

# Lista gare DAL REGISTRO (data/gare_registro.json): una gara nuova pubblicata dalla
# pipeline entra qui da sola. 'ti' = nome evento FastF1 (coincidente per tutte le gare demo).
EVENTI = {nome: v['ti'] for nome, v in
          json.load(open(os.path.join('data', 'gare_registro.json'))).items()}

def main():
    out = {}
    for gara, ev in EVENTI.items():
        s = fastf1.get_session(2026, ev, 'R')
        s.load(laps=False, telemetry=False, weather=False, messages=False)
        cl = []
        for _, r in s.results.iterrows():
            if r['Position'] != r['Position']:
                continue
            cl.append(dict(pos=int(r['Position']), pilota=str(r['Abbreviation']),
                           status=str(r['Status'])))
        out[gara] = dict(fonte='FastF1 results (classifica FIA) — riportata, non ricostruita',
                         classifica=sorted(cl, key=lambda x: x['pos']))
        print(f'{gara:>14}: {len(cl)} classificati, vince {out[gara]["classifica"][0]["pilota"]}')
    dst = os.path.join('demo', 'data', 'ufficiali_2026.json')
    with open(dst, 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f'[scritto] {dst}')

if __name__ == '__main__':
    main()
