#!/usr/bin/env python3
"""gen_targhetta_lab.py — la targhetta, per gli artefatti che non se la mettono da soli.

    python3 gen_targhetta_lab.py            # aggiorna data/targhetta_lab.json se serve
    python3 gen_targhetta_lab.py --stato    # stampa e basta, non scrive

PERCHE' ESISTE. `autocalibra.py` mette la targhetta ai modelli vivi — «quante gare aveva
sotto e quando e' stato calcolato» viaggia col numero. Gli artefatti di laboratorio in
data/ (climatologia, Fase B, stabilita' della partizione, bande demo, gamma, pit-loss...)
la targhetta non ce l'hanno: sono CSV e JSON nudi, e guardandoli non si sa su quante gare
sono stati prodotti ne' quando. E' esattamente il buco che ha lasciato passare un file
fermo a 8 gare in mezzo a file a 10.

PERCHE' NON DENTRO OGNI GENERATORE. Molti di quei generatori hanno un'auto-verifica che
confronta il file rigenerato con quello su disco riga per riga: infilarci dentro un campo
di metadati romperebbe la loro stessa prova di riproducibilita'. La targhetta sta quindi
FUORI, in un manifesto unico, e non tocca un solo byte degli artefatti.

COSA REGISTRA, per ogni artefatto: impronta del contenuto, dimensione, numero di righe
(per i CSV), data in cui l'impronta e' cambiata l'ultima volta, e quante gare c'erano nel
REGISTRO in quel momento. Attenzione a leggerlo bene: `gare_nel_registro_allora` dice
quante gare esistevano quando il file e' cambiato, NON quante gare il file copra — ci sono
artefatti che ne coprono meno APPOSTA (data/undercut_casi_2026.json e' l'insieme in
campione a 8 gare, congelato di proposito). La targhetta data il file, non lo certifica. Chi legge un CSV di laboratorio puo' finalmente chiedersi
«questo su quante gare gira?» e avere una risposta scritta.

INVARIANTI
  - SOLA LETTURA sugli artefatti: qui non si rigenera niente, si guarda e si annota.
  - Idempotente: se nessuna impronta e' cambiata, il manifesto NON viene riscritto (la
    data di ieri resta la data di ieri: e' il punto, altrimenti la targhetta mentirebbe
    dicendo "calcolato oggi" un file vecchio di un mese).
  - Esce sempre 0: e' un'etichetta, non un giudice.
"""
import argparse
import csv
import datetime
import hashlib
import json
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
USCITA = os.path.join(ROOT, 'data', 'targhetta_lab.json')
REGISTRO = os.path.join(ROOT, 'data', 'gare_registro.json')

# Gli artefatti per-gara del laboratorio e della catena dati. Elenco DICHIARATO: un file
# che non e' qui dentro non ha targhetta, e va aggiunto quando nasce.
ARTEFATTI = [
    'data/climatologia_degrado.csv',
    'data/degrado_gamma_linlog.csv',
    'data/faseb_magnitudine.csv',
    'data/faseb2_copertura.csv',
    'data/stabilita_partizione.json',
    'data/neutralizzazione_due_livelli.csv',
    'data/rlap_per_regime.csv',
    'data/status_vocabolario.csv',
    'data/pitloss_realizzato_2026.csv',
    'data/pergara_stops.csv',
    'data/arrivi_2026.csv',
    'data/classifica_giro_2026.csv',
    'data/undercut_casi_2026.json',
    'data/copertura_alpha_undercut.json',
    'data/undercut_sorveglianza.json',
    'demo/data/climatologia_bande.json',
    'data/modello_degrado_2026.json',
    'data/modello_traffico_2026.json',
]


def impronta(percorso):
    with open(percorso, 'rb') as f:
        b = f.read()
    voce = {'sha256_12': hashlib.sha256(b).hexdigest()[:12], 'byte': len(b)}
    if percorso.endswith('.csv'):
        with open(percorso, newline='') as f:
            voce['righe'] = sum(1 for _ in csv.reader(f)) - 1
    return voce


def n_gare_registro():
    try:
        return len(json.load(open(REGISTRO)))
    except OSError:
        return None


def misura(oggi):
    vecchio = {}
    try:
        vecchio = json.load(open(USCITA)).get('artefatti', {})
    except OSError:
        pass
    n_gare = n_gare_registro()
    fuori, cambiati = {}, []
    for rel in ARTEFATTI:
        p = os.path.join(ROOT, rel)
        if not os.path.exists(p):
            fuori[rel] = {'assente': True, 'visto_il': oggi}
            if not vecchio.get(rel, {}).get('assente'):
                cambiati.append(rel)
            continue
        voce = impronta(p)
        prima = vecchio.get(rel, {})
        if prima.get('sha256_12') == voce['sha256_12']:
            voce['cambiato_il'] = prima.get('cambiato_il', oggi)
            voce['gare_nel_registro_allora'] = prima.get('gare_nel_registro_allora', n_gare)
        else:
            voce['cambiato_il'] = oggi
            voce['gare_nel_registro_allora'] = n_gare
            cambiati.append(rel)
        fuori[rel] = voce
    return {'aggiornato_il': oggi, 'gare_nel_registro': n_gare, 'artefatti': fuori}, cambiati


def stampa(man):
    print(f"targhetta laboratorio — {man['gare_nel_registro']} gare nel registro")
    print(f"{'artefatto':44s} {'righe':>6s} {'reg.':>5s} {'cambiato il':>12s}  impronta")
    print('-' * 92)
    for rel, v in man['artefatti'].items():
        if v.get('assente'):
            print(f"{rel:44s} {'—':>6s} {'—':>5s} {'ASSENTE':>12s}")
            continue
        print(f"{rel:44s} {str(v.get('righe', '—')):>6s} {str(v.get('gare_nel_registro_allora', '—')):>5s} "
              f"{v['cambiato_il']:>12s}  {v['sha256_12']}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stato', action='store_true', help='stampa e basta, non scrive')
    a = ap.parse_args()

    oggi = datetime.date.today().isoformat()
    man, cambiati = misura(oggi)
    stampa(man)

    if a.stato:
        return 0
    if not cambiati and os.path.exists(USCITA):
        print('\nnessuna impronta cambiata: manifesto NON riscritto (la targhetta non mente).')
        return 0
    json.dump(man, open(USCITA, 'w'), indent=1, ensure_ascii=False)
    print(f"\ncambiati {len(cambiati)}: {', '.join(cambiati)}")
    print(f"scritto {os.path.relpath(USCITA, ROOT)}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
