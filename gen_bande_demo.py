"""gen_bande_demo.py — emette le bande climatologiche in un JSON servibile dal browser.

Fase A del PIANO_DEGRADO_LIVE: il pannello pit della demo alimenta il gancio v1.5 con i
tre scenari. Il browser (servito da demo/) non legge il CSV di root: questo generatore
deriva demo/data/climatologia_bande.json DAL CSV gia' prodotto e verificato
(data/climatologia_degrado.csv), senza ricalcolare nulla.

Regole (dichiarate):
  - SOLO righe flag_k1 == INFORMATIVA (le NON-INFORMATIVE non alimentano scenari).
  - banda per (cid, compound) = [min_q25, centrale_med, max_q75] cosi' com'e' nel CSV.
  - Monaco NON compare (escluso a monte, CID_NO_DEGRADO): la' il gancio resta banda-zero.
  - il browser tratta un compound assente come [0,0,0] (nessun degrado -> scenario che
    collassa sul run singolo per quel pilota): interruttore di sicurezza per-compound.
  - mappa gara(demo) -> cid da data/gare_registro.json (fonte unica, non ricopiata).

CONFINE: sola lettura su data/climatologia_degrado.csv + data/gare_registro.json;
scrive SOLO demo/data/climatologia_bande.json. Nessun file di kernel/gancio/golden.

Uso:
  python3 gen_bande_demo.py            # verifica (rigenera in memoria e confronta col JSON)
  python3 gen_bande_demo.py --write    # scrive il JSON
"""
import sys, os, csv, json

ROOT = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(ROOT, 'data', 'climatologia_degrado.csv')
REG_PATH = os.path.join(ROOT, 'data', 'gare_registro.json')
OUT_PATH = os.path.join(ROOT, 'demo', 'data', 'climatologia_bande.json')
COMPOUNDS = ('SOFT', 'MEDIUM', 'HARD')


def costruisci():
    per_cid = {}
    with open(CSV_PATH, newline='') as f:
        for r in csv.DictReader(f):
            if r['flag_k1'] != 'INFORMATIVA':
                continue
            cid = r['cid']
            comp = r['compound']
            if comp not in COMPOUNDS:
                continue
            terna = [float(r['banda_min_q25']), float(r['banda_centrale_med']),
                     float(r['banda_max_q75'])]
            per_cid.setdefault(cid, {})[comp] = [round(x, 4) for x in terna]
    reg = json.load(open(REG_PATH))
    gara2cid = {gara: v.get('cid') for gara, v in reg.items() if v.get('cid')}
    return {
        '_meta': {
            'fonte': 'data/climatologia_degrado.csv (righe INFORMATIVA)',
            'generatore': 'gen_bande_demo.py',
            'nota': ("bande = [min q25, centrale mediana, max q75] del degrado marginale "
                     "storico pesato al 2026 (s/giro). SCENARI, non previsioni. Compound "
                     "assente => il browser usa [0,0,0] (nessun degrado). Monaco assente: "
                     "degrado non misurabile (track-position), gancio banda-zero."),
            'unita': 's/giro',
        },
        'gara2cid': gara2cid,
        'per_cid': per_cid,
    }


def main():
    obj = costruisci()
    testo = json.dumps(obj, indent=2, ensure_ascii=False)
    if '--write' in sys.argv:
        with open(OUT_PATH, 'w') as f:
            f.write(testo + '\n')
        n_cid = len(obj['per_cid'])
        n_bande = sum(len(v) for v in obj['per_cid'].values())
        print(f'SCRITTO {OUT_PATH}: {n_cid} circuiti, {n_bande} bande (mescola x circuito).')
    else:
        if not os.path.exists(OUT_PATH):
            print(f'(JSON assente: {OUT_PATH} — usa --write)')
            return
        vecchio = open(OUT_PATH).read().rstrip('\n')
        stato = 'OK (riproducibile)' if vecchio == testo else 'DISCREPANZE — rilancia --write'
        print(f'verifica {OUT_PATH}: {stato}')


if __name__ == '__main__':
    main()
