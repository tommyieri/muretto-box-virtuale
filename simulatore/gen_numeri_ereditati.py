#!/usr/bin/env python3
"""gen_numeri_ereditati.py — i numeri di CLAUDE.md li scrivono i SIGILLI, non le dita.

    python3 gen_numeri_ereditati.py             riscrive il blocco in CLAUDE.md
    python3 gen_numeri_ereditati.py --verifica  esce 1 se il documento e' alla deriva

PERCHE' ESISTE. Il 02/08/2026 `simulatore/CLAUDE.md` — il documento che ogni sessione
legge per primo, la costituzione del progetto — dichiarava rho = 0,0389 [0,0220; 0,0629]
mentre il sigillo `data/modelli/modello_v2.json` diceva 0,030776 [0,010836; 0,052744].
Non era l'unico: la deriva delta era descritta come «CONFLITTO APERTO» quando
l'esperimento l'aveva gia' decisa a 2,2, e la tabella del pit-loss elencava il prior
esterno mentre 26 Gran Premi erano stati promossi a misura interna. Quattro numeri
sbagliati nel posto piu' letto del repo.

Nessuno aveva mentito: erano stati TRASCRITTI A MANO quando erano giusti, e poi il
modello e' stato rimisurato. E' l'errore E22 del catalogo (numeri pubblicati e mai
rimisurati dopo un fix) applicato alla prosa invece che alla pagina.

COME. Lo stesso schema che il repo ha gia' pagato due volte per il codice
(`web/trasporta_formattatori.mjs`, `web/trasporta_motore.mjs`): una sorgente unica, una
copia GENERATA, e un `--verifica` in CI che esce 1 sulla deriva. Qui la sorgente sono i
sigilli con targhetta e la copia e' un blocco di tabella fra due marcatori. Un numero
dentro il blocco non puo' piu' divergere dal motore senza che la CI lo dica.

NIENTE DIPENDENZE NUOVE. La strada ovvia sarebbe `cog`, ma su questa macchina pip e'
bloccato da PEP 668 e un documento-verita' non deve dipendere da un ambiente che si
installa: quaranta righe di Python standard fanno la stessa cosa e girano ovunque giri
il resto del banco.

COSA LO FA FALLIRE (--verifica esce 1):
 (a) qualcuno modifica un numero DENTRO il blocco a mano;
 (b) un sigillo cambia (rimisura, promozione, nuovo cancello) e nessuno rigenera;
 (c) i marcatori spariscono o si invertono.
"""
import argparse
import json
import os
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
DOC = os.path.join(QUI, 'CLAUDE.md')
INIZIO = '<!-- NUMERI:INIZIO — generati da gen_numeri_ereditati.py, non scrivere a mano -->'
FINE = '<!-- NUMERI:FINE -->'


def leggi(*pezzi):
    with open(os.path.join(QUI, *pezzi), encoding='utf-8') as fh:
        return json.load(fh)


def it(x, cifre=None):
    """Numero all'italiana: la virgola decimale, come in tutto il resto del documento."""
    if x is None:
        return '—'
    s = f'{x:.{cifre}f}' if cifre is not None else f'{x:g}'
    return s.replace('.', ',')


def ic(banda, cifre=4):
    return f'IC95 [{it(banda[0], cifre)}; {it(banda[1], cifre)}]' if banda else 'IC95 non calcolabile'


def righe():
    m = leggi('data', 'modelli', 'modello_v2.json')
    prior = leggi('data', 'priors', 'pitloss_priors.json')
    interno = leggi('data', 'modelli', 'pitloss_interno.json')

    rho, d70, rod, mgb = m['rho'], m['delta_70'], m['rodaggio'], m['min_giri_base']
    promossi = {k: v for k, v in interno['circuiti'].items()
                if v.get('cancello_A', {}).get('promosso')}
    # i tre piu' bassi e i tre piu' alti: la tabella mostra l'ESCURSIONE, non 26 righe
    ordinati = sorted(promossi.items(), key=lambda kv: kv[1]['mediana_green_s'])
    def gp(nome):
        return nome.replace('_Grand_Prix', '').replace('_', ' ')
    estremi = ' · '.join(f'{gp(k)} {it(v["mediana_green_s"], 2)}' for k, v in ordinati[:3]) \
        + ' … ' + ' · '.join(f'{gp(k)} {it(v["mediana_green_s"], 2)}' for k, v in ordinati[-3:])
    fatt = prior['fattori_neutralizzazione']

    return [
        ('ρ degrado comune 2026',
         f'{it(rho["valore"], 6)} s/giro·giro · {ic(rho.get("ic95"))}',
         rho['targhetta']),
        ('deriva δ (carburante su 70 kg)',
         f'in uso {it(d70["scelto"], 1)} s · stima libera {it(d70["stimato_libero"], 6)} s '
         f'({ic(d70.get("ic95"), 3)})',
         'DECISO dall\'esperimento pre-registrato: il valore in uso è quello scelto, '
         'non la stima libera — la differenza è dichiarata, non un conflitto aperto'),
        ('rodaggio gomma nuova',
         ('ATTIVO' if rod.get('attivo') else 'SPENTO')
         + f' · c = {it(rod["c"], 2)} s/giro · τ = {it(rod["tau"], 2)} giri',
         rod['targhetta']),
        ('giri verdi minimi prima del congelamento',
         f'{mgb["valore"]}',
         mgb['targhetta']),
        ('pit-loss per circuito',
         f'MISURA INTERNA promossa su {len(promossi)} Gran Premi (mediana green, cancello A) — '
         f'{estremi}; fuori da questi, prior esterno (mediana era {it(prior["mediana_era_2022_2026_s"], 1)} s)',
         'sorgente: data/modelli/pitloss_interno.json + data/priors/pitloss_priors.json — '
         'il motore usa perditaBox(), che sceglie fra i due e lo dichiara nella targhetta'),
        ('fattori neutralizzazione',
         f'SC {it(fatt["SC"], 2)} · VSC {it(fatt["VSC"], 2)} · RED {it(fatt["RED"], 2)} '
         '(frazione della perdita green pagata pittando sotto quel regime)',
         fatt['incertezza']),
        ('stazionario',
         f'tipico {it(prior["stazionario_tipico_s"], 1)} s · pavimento fisico '
         f'{it(prior["stazionario_minimo_fisico_s"], 1)} s',
         'prior esterno → Director'),
    ]


def blocco():
    out = [INIZIO, '', '| grandezza | valore | targhetta |', '|---|---|---|']
    for nome, valore, targhetta in righe():
        t = ' '.join(str(targhetta).split())
        out.append(f'| {nome} | {valore} | {t} |')
    out += ['',
            '> Questa tabella è GENERATA da `gen_numeri_ereditati.py` leggendo i sigilli. '
            'Non modificarla a mano: `--verifica` esce 1 sulla deriva, e la CI lo esegue. '
            'Se un numero qui è sbagliato, è sbagliato nel sigillo.',
            '',
            FINE]
    return '\n'.join(out)


def sostituisci(testo, nuovo):
    i, f = testo.find(INIZIO), testo.find(FINE)
    if i == -1 or f == -1 or f < i:
        raise SystemExit(
            f'marcatori assenti o invertiti in {DOC}: attesi\n  {INIZIO}\n  {FINE}')
    return testo[:i] + nuovo + testo[f + len(FINE):]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--verifica', action='store_true',
                    help='esce 1 se il documento diverge dai sigilli (per la CI)')
    args = ap.parse_args()

    with open(DOC, encoding='utf-8') as fh:
        testo = fh.read()
    atteso = sostituisci(testo, blocco())

    if args.verifica:
        if testo != atteso:
            print('CLAUDE.md E\' ALLA DERIVA dai sigilli del motore.', file=sys.stderr)
            print('  rigenera con:  python3 simulatore/gen_numeri_ereditati.py', file=sys.stderr)
            vecchie = [r for r in testo.splitlines() if r.startswith('| ')]
            nuove = [r for r in atteso.splitlines() if r.startswith('| ')]
            for r in nuove:
                if r not in vecchie:
                    print(f'  atteso: {r}', file=sys.stderr)
            return 1
        print('CLAUDE.md: i numeri ereditati coincidono con i sigilli.')
        return 0

    with open(DOC, 'w', encoding='utf-8') as fh:
        fh.write(atteso)
    print(f'CLAUDE.md aggiornato dai sigilli — {len(righe())} grandezze.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
